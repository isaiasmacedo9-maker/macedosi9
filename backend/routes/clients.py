from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import Optional, List
from models.client import Client, ClientCreate, ClientUpdate
from models.user import UserResponse
from auth import get_current_user
from database import get_clients_collection
from datetime import datetime

router = APIRouter(prefix="/clients", tags=["Clients"])

def check_city_access(user: UserResponse, cidade: str) -> bool:
    """Check if user has access to specific city"""
    if user.role == "admin":
        return True
    return cidade in user.allowed_cities

@router.post("/")
async def create_client(
    client_data: ClientCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create new client"""
    if not check_city_access(current_user, client_data.cidade):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied for this city"
        )
    
    clients_collection = await get_clients_collection()
    
    # Check if CNPJ already exists
    existing_client = await clients_collection.find_one({"cnpj": client_data.cnpj})
    if existing_client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CNPJ already registered"
        )
    
    client = Client(**client_data.model_dump())
    await clients_collection.insert_one(client.model_dump())
    
    return client

@router.get("/")
async def get_clients(
    current_user: UserResponse = Depends(get_current_user),
    cidade: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
):
    """Get clients with filters"""
    clients_collection = await get_clients_collection()
    
    # Build filter
    filter_query = {}
    
    # City access control
    if current_user.role != "admin":
        filter_query["cidade"] = {"$in": current_user.allowed_cities}
    elif cidade:
        filter_query["cidade"] = cidade
    
    if status:
        filter_query["status"] = status
    
    if search:
        filter_query["$or"] = [
            {"nome_empresa": {"$regex": search, "$options": "i"}},
            {"nome_fantasia": {"$regex": search, "$options": "i"}},
            {"cnpj": {"$regex": search, "$options": "i"}},
            {"responsavel": {"$regex": search, "$options": "i"}}
        ]
    
    cursor = clients_collection.find(filter_query).skip(skip).limit(limit)
    clients = []
    async for client_data in cursor:
        clients.append(Client(**client_data))
    
    total = await clients_collection.count_documents(filter_query)
    
    return {
        "clients": clients,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/{client_id}")
async def get_client(
    client_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get client by ID"""
    clients_collection = await get_clients_collection()
    client_data = await clients_collection.find_one({"id": client_id})
    
    if not client_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    client = Client(**client_data)
    
    if not check_city_access(current_user, client.cidade):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied for this city"
        )
    
    return client

@router.put("/{client_id}")
async def update_client(
    client_id: str,
    client_update: ClientUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Update client"""
    clients_collection = await get_clients_collection()
    
    # Check if client exists
    existing_client = await clients_collection.find_one({"id": client_id})
    if not existing_client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
        
    client = Client(**existing_client)
    
    if not check_city_access(current_user, client.cidade):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied for this city"
        )
    
    # Update fields
    update_data = client_update.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await clients_collection.update_one(
            {"id": client_id}, 
            {"$set": update_data}
        )
    
    # Return updated client
    updated_client_data = await clients_collection.find_one({"id": client_id})
    return Client(**updated_client_data)

@router.delete("/{client_id}")
async def delete_client(
    client_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Delete client"""
    clients_collection = await get_clients_collection()
    
    # Check if client exists
    existing_client = await clients_collection.find_one({"id": client_id})
    if not existing_client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    client = Client(**existing_client)
    
    if not check_city_access(current_user, client.cidade):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied for this city"
        )
    
    await clients_collection.delete_one({"id": client_id})
    return {"message": "Client deleted successfully"}

@router.get("/cnpj/{cnpj}")
async def get_client_by_cnpj(
    cnpj: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get client by CNPJ"""
    clients_collection = await get_clients_collection()
    client_data = await clients_collection.find_one({"cnpj": cnpj})
    
    if not client_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    client = Client(**client_data)
    
    if not check_city_access(current_user, client.cidade):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied for this city"
        )
    
    return client