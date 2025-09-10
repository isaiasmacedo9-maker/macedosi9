from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from models.configuracoes import Configuracoes, ConfiguracoesCreate, ConfiguracoesUpdate
from models.user import UserResponse
from auth import get_current_user
from database import get_configuracoes_collection
from datetime import datetime

router = APIRouter(prefix="/configuracoes", tags=["Configuracoes"])

@router.post("/", response_model=Configuracoes)
async def create_configuracao(
    config_data: ConfiguracoesCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create new configuracao"""
    configuracoes_collection = await get_configuracoes_collection()
    
    configuracao = Configuracoes(**config_data.model_dump())
    await configuracoes_collection.insert_one(configuracao.model_dump())
    
    return configuracao

@router.get("/", response_model=List[Configuracoes])
async def get_configuracoes(
    current_user: UserResponse = Depends(get_current_user),
    setor: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Get configuracoes with filters"""
    configuracoes_collection = await get_configuracoes_collection()
    
    # Build query
    query = {}
    
    # Sector filter
    if setor:
        query["setor"] = setor
    
    # Search filter
    if search:
        query["nome"] = {"$regex": search, "$options": "i"}
    
    configs_cursor = configuracoes_collection.find(query).skip(skip).limit(limit).sort("updated_at", -1)
    configs = []
    async for config_data in configs_cursor:
        configs.append(Configuracoes(**config_data))
    
    return configs

@router.get("/{config_id}", response_model=Configuracoes)
async def get_configuracao(
    config_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get configuracao by ID"""
    configuracoes_collection = await get_configuracoes_collection()
    config_data = await configuracoes_collection.find_one({"id": config_id})
    
    if not config_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuracao not found"
        )
    
    return Configuracoes(**config_data)

@router.put("/{config_id}", response_model=Configuracoes)
async def update_configuracao(
    config_id: str,
    config_update: ConfiguracoesUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Update configuracao"""
    configuracoes_collection = await get_configuracoes_collection()
    
    # Check if config exists
    existing_config = await configuracoes_collection.find_one({"id": config_id})
    if not existing_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuracao not found"
        )
    
    # Update fields
    update_data = config_update.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await configuracoes_collection.update_one(
            {"id": config_id}, 
            {"$set": update_data}
        )
    
    # Return updated config
    updated_config_data = await configuracoes_collection.find_one({"id": config_id})
    return Configuracoes(**updated_config_data)