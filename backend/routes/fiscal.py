from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from models.fiscal import ObrigacaoFiscal, ObrigacaoFiscalCreate, ObrigacaoFiscalUpdate
from models.user import UserResponse
from auth import get_current_user
from database import get_fiscal_collection
from datetime import datetime

router = APIRouter(prefix="/fiscal", tags=["Fiscal"])

def check_fiscal_access(user: UserResponse):
    """Check if user has access to fiscal module"""
    if user.role != "admin" and "fiscal" not in user.allowed_sectors:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to fiscal module not allowed"
        )

@router.post("/", response_model=ObrigacaoFiscal)
async def create_obrigacao(
    obrigacao_data: ObrigacaoFiscalCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create new obrigacao fiscal"""
    check_fiscal_access(current_user)
    fiscal_collection = await get_fiscal_collection()
    
    obrigacao = ObrigacaoFiscal(
        **obrigacao_data.model_dump(),
        status="pendente"
    )
    
    await fiscal_collection.insert_one(obrigacao.model_dump())
    return obrigacao

@router.get("/", response_model=List[ObrigacaoFiscal])
async def get_obrigacoes(
    current_user: UserResponse = Depends(get_current_user),
    tipo: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Get obrigacoes fiscais with filters"""
    check_fiscal_access(current_user)
    fiscal_collection = await get_fiscal_collection()
    
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
            {"nome": {"$regex": search, "$options": "i"}},
            {"responsavel": {"$regex": search, "$options": "i"}}
        ]
    
    obrigacoes_cursor = fiscal_collection.find(query).skip(skip).limit(limit).sort("vencimento", -1)
    obrigacoes = []
    async for obrigacao_data in obrigacoes_cursor:
        obrigacoes.append(ObrigacaoFiscal(**obrigacao_data))
    
    return obrigacoes

@router.get("/{obrigacao_id}", response_model=ObrigacaoFiscal)
async def get_obrigacao(
    obrigacao_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get obrigacao fiscal by ID"""
    check_fiscal_access(current_user)
    fiscal_collection = await get_fiscal_collection()
    obrigacao_data = await fiscal_collection.find_one({"id": obrigacao_id})
    
    if not obrigacao_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obrigacao not found"
        )
    
    return ObrigacaoFiscal(**obrigacao_data)

@router.put("/{obrigacao_id}", response_model=ObrigacaoFiscal)
async def update_obrigacao(
    obrigacao_id: str,
    obrigacao_update: ObrigacaoFiscalUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Update obrigacao fiscal"""
    check_fiscal_access(current_user)
    fiscal_collection = await get_fiscal_collection()
    
    # Check if obrigacao exists
    existing_obrigacao = await fiscal_collection.find_one({"id": obrigacao_id})
    if not existing_obrigacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obrigacao not found"
        )
    
    # Update fields
    update_data = obrigacao_update.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await fiscal_collection.update_one(
            {"id": obrigacao_id}, 
            {"$set": update_data}
        )
    
    # Return updated obrigacao
    updated_obrigacao_data = await fiscal_collection.find_one({"id": obrigacao_id})
    return ObrigacaoFiscal(**updated_obrigacao_data)

@router.delete("/{obrigacao_id}")
async def delete_obrigacao(
    obrigacao_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Delete obrigacao fiscal"""
    check_fiscal_access(current_user)
    fiscal_collection = await get_fiscal_collection()
    
    # Check if obrigacao exists
    existing_obrigacao = await fiscal_collection.find_one({"id": obrigacao_id})
    if not existing_obrigacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Obrigacao not found"
        )
    
    await fiscal_collection.delete_one({"id": obrigacao_id})
    return {"message": "Obrigacao deleted successfully"}