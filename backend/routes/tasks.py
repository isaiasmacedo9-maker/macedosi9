from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from models.task import Task, TaskCreate, TaskUpdate, TaskComment
from models.user import UserResponse
from auth import get_current_user
from database import get_tasks_collection
from datetime import datetime

router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.post("/", response_model=Task)
async def create_task(
    task_data: TaskCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create new task"""
    tasks_collection = await get_tasks_collection()
    
    task = Task(
        **task_data.model_dump(),
        criador_id=current_user.id,
        criador_nome=current_user.name,
        responsavel_nome="Sistema"  # Will be updated when we get user info
    )
    
    await tasks_collection.insert_one(task.model_dump())
    return task

@router.get("/", response_model=List[Task])
async def get_tasks(
    current_user: UserResponse = Depends(get_current_user),
    status: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    prioridade: Optional[str] = Query(None),
    responsavel_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get tasks with filters"""
    tasks_collection = await get_tasks_collection()
    
    # Build query
    query = {}
    
    # User can see tasks they created or are responsible for
    if current_user.role != "admin":
        query["$or"] = [
            {"criador_id": current_user.id},
            {"responsavel_id": current_user.id}
        ]
    
    # Apply filters
    if status:
        query["status"] = status
    if categoria:
        query["categoria"] = categoria
    if prioridade:
        query["prioridade"] = prioridade
    if responsavel_id:
        query["responsavel_id"] = responsavel_id
    if search:
        query["$or"] = [
            {"titulo": {"$regex": search, "$options": "i"}},
            {"descricao": {"$regex": search, "$options": "i"}}
        ]
    
    tasks_cursor = tasks_collection.find(query).skip(skip).limit(limit).sort("data_criacao", -1)
    tasks = []
    async for task_data in tasks_cursor:
        tasks.append(Task(**task_data))
    
    return tasks

@router.get("/{task_id}", response_model=Task)
async def get_task(
    task_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get specific task"""
    tasks_collection = await get_tasks_collection()
    task_data = await tasks_collection.find_one({"id": task_id})
    
    if not task_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tarefa não encontrada"
        )
    
    task = Task(**task_data)
    
    # Check access
    if (current_user.role != "admin" and 
        current_user.id != task.criador_id and 
        current_user.id != task.responsavel_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado à tarefa"
        )
    
    return task

@router.put("/{task_id}", response_model=Task)
async def update_task(
    task_id: str,
    task_update: TaskUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Update task"""
    tasks_collection = await get_tasks_collection()
    
    # Check if task exists
    existing_task = await tasks_collection.find_one({"id": task_id})
    if not existing_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tarefa não encontrada"
        )
    
    task = Task(**existing_task)
    
    # Check access
    if (current_user.role != "admin" and 
        current_user.id != task.criador_id and 
        current_user.id != task.responsavel_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado à tarefa"
        )
    
    # Update fields
    update_data = task_update.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        
        # Mark as completed if status is concluida
        if update_data.get("status") == "concluida":
            update_data["data_conclusao"] = datetime.utcnow()
            update_data["progresso"] = 100
        
        await tasks_collection.update_one(
            {"id": task_id}, 
            {"$set": update_data}
        )
    
    # Return updated task
    updated_task_data = await tasks_collection.find_one({"id": task_id})
    return Task(**updated_task_data)

@router.post("/{task_id}/comment")
async def add_comment(
    task_id: str,
    comentario: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Add comment to task"""
    tasks_collection = await get_tasks_collection()
    
    # Check if task exists and user has access
    task_data = await tasks_collection.find_one({"id": task_id})
    if not task_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tarefa não encontrada"
        )
    
    task = Task(**task_data)
    if (current_user.role != "admin" and 
        current_user.id != task.criador_id and 
        current_user.id != task.responsavel_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado à tarefa"
        )
    
    # Create comment
    comment = TaskComment(
        usuario_id=current_user.id,
        usuario_nome=current_user.name,
        comentario=comentario
    )
    
    # Add comment to task
    await tasks_collection.update_one(
        {"id": task_id},
        {
            "$push": {"comentarios": comment.model_dump()},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    return {"message": "Comentário adicionado com sucesso", "comment_id": comment.id}

@router.get("/stats/dashboard")
async def get_tasks_stats(current_user: UserResponse = Depends(get_current_user)):
    """Get tasks dashboard statistics"""
    tasks_collection = await get_tasks_collection()
    
    # Build base query for user access
    base_query = {}
    if current_user.role != "admin":
        base_query["$or"] = [
            {"criador_id": current_user.id},
            {"responsavel_id": current_user.id}
        ]
    
    # Count by status
    status_stats = {}
    status_list = ["pendente", "em_andamento", "concluida", "cancelada"]
    
    for status_item in status_list:
        query = {**base_query, "status": status_item}
        count = await tasks_collection.count_documents(query)
        status_stats[status_item] = count
    
    # Count by priority
    priority_stats = {}
    priority_list = ["baixa", "media", "alta", "urgente"]
    
    for priority_item in priority_list:
        query = {**base_query, "prioridade": priority_item}
        count = await tasks_collection.count_documents(query)
        priority_stats[priority_item] = count
    
    # Count by category
    category_stats = {}
    category_list = ["comercial", "financeiro", "trabalhista", "fiscal", "contabil", "atendimento"]
    
    for category_item in category_list:
        query = {**base_query, "categoria": category_item}
        count = await tasks_collection.count_documents(query)
        category_stats[category_item] = count
    
    return {
        "status_stats": status_stats,
        "priority_stats": priority_stats,
        "category_stats": category_stats
    }