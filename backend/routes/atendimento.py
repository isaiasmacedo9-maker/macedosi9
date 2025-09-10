from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from models.atendimento import Ticket, TicketCreate, TicketUpdate
from models.user import UserResponse
from auth import get_current_user
from database import get_atendimento_collection
from datetime import datetime

router = APIRouter(prefix="/atendimento", tags=["Atendimento"])

def check_atendimento_access(user: UserResponse):
    """Check if user has access to atendimento module"""
    if user.role != "admin" and "atendimento" not in user.allowed_sectors:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to atendimento module not allowed"
        )

@router.post("/", response_model=Ticket)
async def create_ticket(
    ticket_data: TicketCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create new ticket"""
    check_atendimento_access(current_user)
    atendimento_collection = await get_atendimento_collection()
    
    # Calculate SLA (24 hours from now)
    sla = datetime.utcnow().replace(hour=23, minute=59, second=59)
    
    ticket = Ticket(
        **ticket_data.model_dump(),
        status="aberto",
        sla=sla
    )
    
    await atendimento_collection.insert_one(ticket.model_dump())
    return ticket

@router.get("/", response_model=List[Ticket])
async def get_tickets(
    current_user: UserResponse = Depends(get_current_user),
    status: Optional[str] = Query(None),
    prioridade: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Get tickets with filters"""
    check_atendimento_access(current_user)
    atendimento_collection = await get_atendimento_collection()
    
    # Build query
    query = {}
    
    # Status filter
    if status:
        query["status"] = status
    
    # Priority filter
    if prioridade:
        query["prioridade"] = prioridade
    
    # Search filter
    if search:
        query["$or"] = [
            {"empresa": {"$regex": search, "$options": "i"}},
            {"titulo": {"$regex": search, "$options": "i"}},
            {"descricao": {"$regex": search, "$options": "i"}}
        ]
    
    tickets_cursor = atendimento_collection.find(query).skip(skip).limit(limit).sort("data_abertura", -1)
    tickets = []
    async for ticket_data in tickets_cursor:
        tickets.append(Ticket(**ticket_data))
    
    return tickets

@router.get("/{ticket_id}", response_model=Ticket)
async def get_ticket(
    ticket_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get ticket by ID"""
    check_atendimento_access(current_user)
    atendimento_collection = await get_atendimento_collection()
    ticket_data = await atendimento_collection.find_one({"id": ticket_id})
    
    if not ticket_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    return Ticket(**ticket_data)

@router.put("/{ticket_id}", response_model=Ticket)
async def update_ticket(
    ticket_id: str,
    ticket_update: TicketUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Update ticket"""
    check_atendimento_access(current_user)
    atendimento_collection = await get_atendimento_collection()
    
    # Check if ticket exists
    existing_ticket = await atendimento_collection.find_one({"id": ticket_id})
    if not existing_ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    # Update fields
    update_data = ticket_update.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        await atendimento_collection.update_one(
            {"id": ticket_id}, 
            {"$set": update_data}
        )
    
    # Return updated ticket
    updated_ticket_data = await atendimento_collection.find_one({"id": ticket_id})
    return Ticket(**updated_ticket_data)