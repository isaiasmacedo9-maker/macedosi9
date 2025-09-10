from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from models.chat import Chat, ChatCreate, Message, MessageCreate
from models.user import UserResponse
from auth import get_current_user
from database import get_chats_collection
from datetime import datetime

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post("/", response_model=Chat)
async def create_chat(
    chat_data: ChatCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create new chat"""
    chats_collection = await get_chats_collection()
    
    chat = Chat(
        **chat_data.model_dump(),
        admin_id=current_user.id,
        participantes=[current_user.id] + chat_data.participantes
    )
    
    await chats_collection.insert_one(chat.model_dump())
    return chat

@router.get("/", response_model=List[Chat])
async def get_user_chats(
    current_user: UserResponse = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get user's chats"""
    chats_collection = await get_chats_collection()
    
    query = {"participantes": current_user.id, "ativo": True}
    
    chats_cursor = chats_collection.find(query).skip(skip).limit(limit).sort("updated_at", -1)
    chats = []
    async for chat_data in chats_cursor:
        chats.append(Chat(**chat_data))
    
    return chats

@router.get("/{chat_id}", response_model=Chat)
async def get_chat(
    chat_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get specific chat"""
    chats_collection = await get_chats_collection()
    chat_data = await chats_collection.find_one({"id": chat_id})
    
    if not chat_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat não encontrado"
        )
    
    chat = Chat(**chat_data)
    
    # Check if user is participant
    if current_user.id not in chat.participantes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado ao chat"
        )
    
    return chat

@router.post("/{chat_id}/message")
async def send_message(
    chat_id: str,
    message_data: MessageCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Send message to chat"""
    chats_collection = await get_chats_collection()
    
    # Check if chat exists and user has access
    chat_data = await chats_collection.find_one({"id": chat_id})
    if not chat_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat não encontrado"
        )
    
    chat = Chat(**chat_data)
    if current_user.id not in chat.participantes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado ao chat"
        )
    
    # Create message
    message = Message(
        **message_data.model_dump(),
        usuario_id=current_user.id,
        usuario_nome=current_user.name
    )
    
    # Add message to chat
    await chats_collection.update_one(
        {"id": chat_id},
        {
            "$push": {"mensagens": message.model_dump()},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    return {"message": "Mensagem enviada com sucesso", "message_id": message.id}

@router.get("/{chat_id}/messages")
async def get_chat_messages(
    chat_id: str,
    current_user: UserResponse = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get chat messages"""
    chats_collection = await get_chats_collection()
    
    # Check access
    chat_data = await chats_collection.find_one({"id": chat_id})
    if not chat_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat não encontrado"
        )
    
    chat = Chat(**chat_data)
    if current_user.id not in chat.participantes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado ao chat"
        )
    
    # Get messages with pagination
    messages = sorted(chat.mensagens, key=lambda x: x.timestamp, reverse=True)
    paginated_messages = messages[skip:skip + limit]
    
    return {
        "messages": paginated_messages,
        "total": len(messages),
        "skip": skip,
        "limit": limit
    }