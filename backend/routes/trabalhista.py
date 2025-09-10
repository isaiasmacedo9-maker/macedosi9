from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from models.trabalhista import SolicitacaoTrabalhista, SolicitacaoTrabalhistaCreate, SolicitacaoTrabalhistaUpdate
from models.user import UserResponse
from auth import get_current_user
from database import get_trabalhista_collection
from datetime import datetime

router = APIRouter(prefix="/trabalhista", tags=["Trabalhista"])

def check_trabalhista_access(user: UserResponse):
    """Check if user has access to trabalhista module"""
    if user.role != "admin" and "trabalhista" not in user.allowed_sectors:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to trabalhista module not allowed"
        )

@router.post("/", response_model=SolicitacaoTrabalhista)
async def create_solicitacao(
    solicitacao_data: SolicitacaoTrabalhistaCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create new solicitacao trabalhista"""
    check_trabalhista_access(current_user)
    trabalhista_collection = await get_trabalhista_collection()
    
    solicitacao = SolicitacaoTrabalhista(
        **solicitacao_data.model_dump(),
        status="pendente"
    )
    
    await trabalhista_collection.insert_one(solicitacao.model_dump())
    return solicitacao

@router.get("/", response_model=List[SolicitacaoTrabalhista])
async def get_solicitacoes(
    current_user: UserResponse = Depends(get_current_user),
    tipo: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Get solicitacoes trabalhistas with filters"""
    check_trabalhista_access(current_user)
    trabalhista_collection = await get_trabalhista_collection()
    
    # Build query
    query = {}
    
    # Type filter
    if tipo:
        query["tipo"] = tipo
    
    # Status filter
    if status:
        query["status"] = status
    
    # Search filter
    if search:
        query["$or"] = [
            {"empresa": {"$regex": search, "$options": "i"}},
            {"descricao": {"$regex": search, "$options": "i"}},
            {"responsavel": {"$regex": search, "$options": "i"}}
        ]
    
    solicitacoes_cursor = trabalhista_collection.find(query).skip(skip).limit(limit).sort("data_solicitacao", -1)
    solicitacoes = []
    async for solicitacao_data in solicitacoes_cursor:
        solicitacoes.append(SolicitacaoTrabalhista(**solicitacao_data))
    
    return solicitacoes

@router.get("/{solicitacao_id}", response_model=SolicitacaoTrabalhista)
async def get_solicitacao(
    solicitacao_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get solicitacao trabalhista by ID"""
    check_trabalhista_access(current_user)
    trabalhista_collection = await get_trabalhista_collection()
    solicitacao_data = await trabalhista_collection.find_one({"id": solicitacao_id})
    
    if not solicitacao_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitacao not found"
        )
    
    return SolicitacaoTrabalhista(**solicitacao_data)

@router.put("/{solicitacao_id}", response_model=SolicitacaoTrabalhista)
async def update_solicitacao(
    solicitacao_id: str,
    solicitacao_update: SolicitacaoTrabalhistaUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Update solicitacao trabalhista"""
    check_trabalhista_access(current_user)
    trabalhista_collection = await get_trabalhista_collection()
    
    # Check if solicitacao exists
    existing_solicitacao = await trabalhista_collection.find_one({"id": solicitacao_id})
    if not existing_solicitacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitacao not found"
        )
    
    # Update fields
    update_data = solicitacao_update.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await trabalhista_collection.update_one(
            {"id": solicitacao_id}, 
            {"$set": update_data}
        )
    
    # Return updated solicitacao
    updated_solicitacao_data = await trabalhista_collection.find_one({"id": solicitacao_id})
    return SolicitacaoTrabalhista(**updated_solicitacao_data)

@router.delete("/{solicitacao_id}")
async def delete_solicitacao(
    solicitacao_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Delete solicitacao trabalhista"""
    check_trabalhista_access(current_user)
    trabalhista_collection = await get_trabalhista_collection()
    
    # Check if solicitacao exists
    existing_solicitacao = await trabalhista_collection.find_one({"id": solicitacao_id})
    if not existing_solicitacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitacao not found"
        )
    
    await trabalhista_collection.delete_one({"id": solicitacao_id})
    return {"message": "Solicitacao deleted successfully"}

@router.get("/stats/dashboard")
async def get_dashboard_stats(current_user: UserResponse = Depends(get_current_user)):
    """Get trabalhista dashboard statistics"""
    check_trabalhista_access(current_user)
    trabalhista_collection = await get_trabalhista_collection()
    
    # Count by status
    status_stats = {}
    status_list = ["pendente", "em_andamento", "concluido", "atrasado"]
    
    for status_item in status_list:
        count = await trabalhista_collection.count_documents({"status": status_item})
        status_stats[status_item] = count
    
    # Count by type
    type_stats = {}
    type_list = ["admissao", "demissao", "folha", "afastamento", "reclamacao"]
    
    for type_item in type_list:
        count = await trabalhista_collection.count_documents({"tipo": type_item})
        type_stats[type_item] = count
    
    return {
        "status_stats": status_stats,
        "type_stats": type_stats
    }