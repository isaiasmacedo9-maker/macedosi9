"""
Rotas para chat com grupos públicos/privados
"""
from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy import select, delete, and_, or_, func
from sqlalchemy.orm import selectinload
from database_sql import AsyncSessionLocal
from models_sql import UserSQL
from models_chat_users import (
    ConversationSQL, ConversationMemberSQL, ChatMessageSQL,
    MessageReadStatusSQL, UserOnlineStatusSQL
)
from auth import get_current_user
from crud_sql import convert_to_dict, json_dumps, json_loads
from models.user import UserResponse
from database_compat import get_configuracoes_collection
from services.google_drive_service import (
    DEFAULT_GOOGLE_SCOPES,
    GoogleDriveService,
    GoogleIntegrationError,
    decrypt_service_account_payload,
)
import json

router = APIRouter(prefix="/chat", tags=["Chat"])
ONLINE_WINDOW_SECONDS = 90
GOOGLE_INTEGRATION_KEY = "google_drive_integration"

# ==================== MODELS ====================

class CreateDirectChatRequest(BaseModel):
    user_id: str

class CreateGroupRequest(BaseModel):
    nome: str
    descricao: Optional[str] = None
    tipo_grupo: str = Field(..., pattern="^(public|private)$")
    member_ids: List[str]

class SendMessageRequest(BaseModel):
    message: str
    reply_to_id: Optional[str] = None

class AddMembersRequest(BaseModel):
    user_ids: List[str]

class UpdateMemberRoleRequest(BaseModel):
    user_id: str
    role: str = Field(..., pattern="^(admin|member)$")

class ConversationResponse(BaseModel):
    id: str
    tipo: str
    nome: Optional[str]
    descricao: Optional[str]
    tipo_grupo: Optional[str]
    avatar: Optional[str]
    created_by: str
    created_at: datetime
    last_message_at: Optional[datetime]
    unread_count: int
    members_count: int
    last_message: Optional[dict]
    my_role: Optional[str]
    is_active: bool

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender: dict
    message: str
    tipo: str
    reply_to: Optional[dict]
    is_edited: bool
    is_deleted: bool
    created_at: datetime
    read_by: List[dict]

# ==================== HELPER FUNCTIONS ====================

async def update_user_activity(session, user_id: str):
    """Atualiza atividade do usuário"""
    result = await session.execute(
        select(UserOnlineStatusSQL).where(UserOnlineStatusSQL.user_id == user_id)
    )
    status_obj = result.scalar_one_or_none()
    
    if status_obj:
        status_obj.is_online = True
        status_obj.last_activity = datetime.utcnow()
        status_obj.last_seen = datetime.utcnow()
    else:
        status_obj = UserOnlineStatusSQL(
            user_id=user_id,
            is_online=True,
            last_seen=datetime.utcnow(),
            last_activity=datetime.utcnow()
        )
        session.add(status_obj)
    
    await session.flush()

def resolve_presence(online_status: Optional[UserOnlineStatusSQL]):
    """Define presença com base na última atividade."""
    if not online_status:
        return {"is_online": False, "last_seen": None, "last_activity": None}

    now = datetime.utcnow()
    last_activity = online_status.last_activity or online_status.last_seen
    is_recent = bool(last_activity and (now - last_activity) <= timedelta(seconds=ONLINE_WINDOW_SECONDS))
    is_online = bool(online_status.is_online and is_recent)

    return {
        "is_online": is_online,
        "last_seen": online_status.last_seen,
        "last_activity": last_activity,
    }

async def build_conversation_payload(session, target_user_id: str):
    """Monta payload de conversas para um usuário alvo."""
    result = await session.execute(
        select(ConversationSQL, ConversationMemberSQL)
        .join(ConversationMemberSQL)
        .where(
            and_(
                ConversationMemberSQL.user_id == target_user_id,
                ConversationMemberSQL.is_active == True
            )
        )
        .order_by(ConversationSQL.last_message_at.desc().nullslast())
    )

    conversations = []
    for conv, my_membership in result.all():
        direct_user = None

        members_result = await session.execute(
            select(func.count(ConversationMemberSQL.id))
            .where(
                and_(
                    ConversationMemberSQL.conversation_id == conv.id,
                    ConversationMemberSQL.is_active == True
                )
            )
        )
        members_count = members_result.scalar()

        last_msg_result = await session.execute(
            select(ChatMessageSQL, UserSQL)
            .join(UserSQL, ChatMessageSQL.sender_id == UserSQL.id)
            .where(
                and_(
                    ChatMessageSQL.conversation_id == conv.id,
                    ChatMessageSQL.is_deleted == False
                )
            )
            .order_by(ChatMessageSQL.created_at.desc())
            .limit(1)
        )
        last_msg_row = last_msg_result.first()
        last_msg = None
        if last_msg_row:
            msg, sender = last_msg_row
            last_msg = {
                "id": msg.id,
                "message": msg.message[:100],
                "sender_name": sender.name,
                "created_at": msg.created_at.isoformat()
            }

        if conv.tipo == "direct":
            other_result = await session.execute(
                select(UserSQL, UserOnlineStatusSQL)
                .join(
                    ConversationMemberSQL,
                    and_(
                        ConversationMemberSQL.user_id == UserSQL.id,
                        ConversationMemberSQL.conversation_id == conv.id,
                        ConversationMemberSQL.is_active == True
                    )
                )
                .outerjoin(UserOnlineStatusSQL, UserOnlineStatusSQL.user_id == UserSQL.id)
                .where(UserSQL.id != target_user_id)
                .limit(1)
            )
            other_row = other_result.first()
            if other_row:
                other_user, other_status = other_row
                presence = resolve_presence(other_status)
                direct_user = {
                    "id": other_user.id,
                    "name": other_user.name,
                    "email": other_user.email,
                    "is_online": presence["is_online"],
                    "last_seen": presence["last_seen"],
                }

        conversations.append({
            "id": conv.id,
            "tipo": conv.tipo,
            "nome": conv.nome,
            "descricao": conv.descricao,
            "tipo_grupo": conv.tipo_grupo,
            "avatar": conv.avatar,
            "created_by": conv.created_by,
            "created_at": conv.created_at,
            "last_message_at": conv.last_message_at,
            "unread_count": my_membership.unread_count,
            "members_count": members_count,
            "last_message": last_msg,
            "my_role": my_membership.role,
            "is_active": my_membership.is_active,
            "direct_user": direct_user,
        })

    return conversations

async def get_or_create_direct_chat(session, user1_id: str, user2_id: str):
    """Busca ou cria chat direto entre dois usuários"""
    # Buscar chat existente
    result = await session.execute(
        select(ConversationSQL)
        .join(ConversationMemberSQL)
        .where(
            and_(
                ConversationSQL.tipo == "direct",
                ConversationMemberSQL.user_id.in_([user1_id, user2_id])
            )
        )
        .group_by(ConversationSQL.id)
        .having(func.count(ConversationMemberSQL.id) == 2)
    )
    
    existing_conv = result.scalar_one_or_none()
    if existing_conv:
        memberships_result = await session.execute(
            select(ConversationMemberSQL).where(
                and_(
                    ConversationMemberSQL.conversation_id == existing_conv.id,
                    ConversationMemberSQL.user_id.in_([user1_id, user2_id]),
                )
            )
        )
        for membership in memberships_result.scalars().all():
            if not membership.is_active:
                membership.is_active = True
                membership.joined_at = datetime.utcnow()
                membership.left_at = None
        return existing_conv
    
    # Criar novo chat
    conversation = ConversationSQL(
        tipo="direct",
        created_by=user1_id
    )
    session.add(conversation)
    await session.flush()
    
    # Adicionar membros
    for user_id in [user1_id, user2_id]:
        member = ConversationMemberSQL(
            conversation_id=conversation.id,
            user_id=user_id,
            role="member"
        )
        session.add(member)
    
    await session.flush()
    return conversation


def _safe_json_load(raw: str) -> dict:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


async def _load_google_drive_integration() -> dict:
    collection = await get_configuracoes_collection()
    row = await collection.find_one({"chave": GOOGLE_INTEGRATION_KEY})
    if not row:
        raise HTTPException(status_code=400, detail="Integracao Google Drive nao configurada.")
    payload = _safe_json_load(str(row.get("valor") or ""))
    if not payload.get("enabled"):
        raise HTTPException(status_code=400, detail="Integracao Google Drive esta desabilitada.")
    if not payload.get("credentials_encrypted"):
        raise HTTPException(status_code=400, detail="Credencial Google Drive ausente.")
    if not payload.get("root_folder_id"):
        raise HTTPException(status_code=400, detail="Pasta raiz do Google Drive nao configurada.")
    return payload

# ==================== ROUTES ====================

@router.post("/heartbeat")
async def heartbeat(current_user: UserResponse = Depends(get_current_user)):
    """Atualiza status online do usuário (polling)"""
    async with AsyncSessionLocal() as session:
        await update_user_activity(session, current_user.id)
        await session.commit()
        return {"status": "ok"}

@router.post("/offline")
async def mark_offline(current_user: UserResponse = Depends(get_current_user)):
    """Marca usuário como offline no logout."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(UserOnlineStatusSQL).where(UserOnlineStatusSQL.user_id == current_user.id)
        )
        status_obj = result.scalar_one_or_none()
        if status_obj:
            status_obj.is_online = False
            status_obj.last_seen = datetime.utcnow()
            status_obj.last_activity = datetime.utcnow()
        else:
            session.add(
                UserOnlineStatusSQL(
                    user_id=current_user.id,
                    is_online=False,
                    last_seen=datetime.utcnow(),
                    last_activity=datetime.utcnow(),
                )
            )
        await session.commit()
        return {"status": "offline"}

@router.get("/conversations")
async def list_conversations(current_user: UserResponse = Depends(get_current_user)):
    """Lista todas as conversas do usuário"""
    async with AsyncSessionLocal() as session:
        await update_user_activity(session, current_user.id)
        conversations = await build_conversation_payload(session, current_user.id)
        await session.commit()
        return conversations

@router.get("/public-groups")
async def list_public_groups(current_user: UserResponse = Depends(get_current_user)):
    """Lista grupos públicos que o usuário não faz parte"""
    async with AsyncSessionLocal() as session:
        # Buscar IDs dos grupos que o usuário já participa
        my_groups_result = await session.execute(
            select(ConversationMemberSQL.conversation_id)
            .where(
                and_(
                    ConversationMemberSQL.user_id == current_user.id,
                    ConversationMemberSQL.is_active == True
                )
            )
        )
        my_group_ids = [row[0] for row in my_groups_result.all()]
        
        # Buscar grupos públicos que não estou
        query = select(ConversationSQL).where(
            and_(
                ConversationSQL.tipo == "group",
                ConversationSQL.tipo_grupo == "public"
            )
        )
        
        if my_group_ids:
            query = query.where(ConversationSQL.id.not_in(my_group_ids))
        
        result = await session.execute(query)
        groups = result.scalars().all()
        
        groups_response = []
        for group in groups:
            # Contar membros
            members_result = await session.execute(
                select(func.count(ConversationMemberSQL.id))
                .where(
                    and_(
                        ConversationMemberSQL.conversation_id == group.id,
                        ConversationMemberSQL.is_active == True
                    )
                )
            )
            members_count = members_result.scalar()
            
            groups_response.append({
                "id": group.id,
                "nome": group.nome,
                "descricao": group.descricao,
                "members_count": members_count,
                "created_at": group.created_at
            })
        
        return groups_response

@router.get("/admin/{target_user_id}/conversations")
async def admin_list_user_conversations(
    target_user_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Acesso especial: admin visualiza as conversas visíveis para um colaborador."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")

    async with AsyncSessionLocal() as session:
        user_result = await session.execute(select(UserSQL).where(UserSQL.id == target_user_id))
        target_user = user_result.scalar_one_or_none()
        if not target_user:
            raise HTTPException(status_code=404, detail="Usuário alvo não encontrado")

        conversations = await build_conversation_payload(session, target_user_id)
        await session.commit()
        return conversations

@router.get("/admin/{target_user_id}/conversations/{conversation_id}/messages")
async def admin_list_user_conversation_messages(
    target_user_id: str,
    conversation_id: str,
    limit: int = 50,
    before: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """Acesso especial: admin visualiza mensagens de conversa pertencente ao escopo do colaborador."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")

    async with AsyncSessionLocal() as session:
        # Verificar se colaborador participa da conversa
        membership_result = await session.execute(
            select(ConversationMemberSQL).where(
                and_(
                    ConversationMemberSQL.conversation_id == conversation_id,
                    ConversationMemberSQL.user_id == target_user_id,
                    ConversationMemberSQL.is_active == True,
                )
            )
        )
        if not membership_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Conversa fora do escopo do colaborador selecionado")

        query = select(ChatMessageSQL, UserSQL).join(
            UserSQL, ChatMessageSQL.sender_id == UserSQL.id
        ).where(
            and_(
                ChatMessageSQL.conversation_id == conversation_id,
                ChatMessageSQL.is_deleted == False
            )
        )

        if before:
            query = query.where(ChatMessageSQL.id < before)

        query = query.order_by(ChatMessageSQL.created_at.desc()).limit(limit)
        result = await session.execute(query)
        messages = []
        for msg, sender in result.all():
            messages.append({
                "id": msg.id,
                "conversation_id": msg.conversation_id,
                "sender": {
                    "id": sender.id,
                    "name": sender.name,
                    "email": sender.email
                },
                "message": msg.message,
                "tipo": msg.tipo,
                "is_edited": msg.is_edited,
                "is_deleted": msg.is_deleted,
                "created_at": msg.created_at,
                "reply_to_id": msg.reply_to_id
            })

        return list(reversed(messages))

@router.get("/admin/{target_user_id}/conversations/{conversation_id}/members")
async def admin_list_user_conversation_members(
    target_user_id: str,
    conversation_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Acesso especial: admin visualiza membros de conversa do escopo do colaborador."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")

    async with AsyncSessionLocal() as session:
        membership_result = await session.execute(
            select(ConversationMemberSQL).where(
                and_(
                    ConversationMemberSQL.conversation_id == conversation_id,
                    ConversationMemberSQL.user_id == target_user_id,
                    ConversationMemberSQL.is_active == True,
                )
            )
        )
        if not membership_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Conversa fora do escopo do colaborador selecionado")

        result = await session.execute(
            select(ConversationMemberSQL, UserSQL, UserOnlineStatusSQL)
            .join(UserSQL, ConversationMemberSQL.user_id == UserSQL.id)
            .outerjoin(UserOnlineStatusSQL, UserSQL.id == UserOnlineStatusSQL.user_id)
            .where(
                and_(
                    ConversationMemberSQL.conversation_id == conversation_id,
                    ConversationMemberSQL.is_active == True
                )
            )
        )

        members = []
        for membership, user, online_status in result.all():
            presence = resolve_presence(online_status)
            members.append({
                "user_id": user.id,
                "name": user.name,
                "email": user.email,
                "role": membership.role,
                "joined_at": membership.joined_at,
                "is_online": presence["is_online"],
                "last_seen": presence["last_seen"],
            })

        return members

@router.post("/direct")
async def create_direct_chat(
    request: CreateDirectChatRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """Cria ou retorna chat direto com outro usuário"""
    async with AsyncSessionLocal() as session:
        # Verificar se usuário existe
        result = await session.execute(
            select(UserSQL).where(UserSQL.id == request.user_id)
        )
        other_user = result.scalar_one_or_none()
        if not other_user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
        # Não permitir chat consigo mesmo
        if request.user_id == current_user.id:
            raise HTTPException(status_code=400, detail="Não é possível criar chat consigo mesmo")
        
        # Buscar ou criar chat
        conversation = await get_or_create_direct_chat(session, current_user.id, request.user_id)
        await session.commit()
        
        return {"conversation_id": conversation.id}

@router.post("/group")
async def create_group(
    request: CreateGroupRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """Cria novo grupo"""
    async with AsyncSessionLocal() as session:
        # Validar membros
        if current_user.id not in request.member_ids:
            request.member_ids.append(current_user.id)
        
        for user_id in request.member_ids:
            result = await session.execute(select(UserSQL).where(UserSQL.id == user_id))
            if not result.scalar_one_or_none():
                raise HTTPException(status_code=404, detail=f"Usuário {user_id} não encontrado")
        
        # Criar grupo
        group = ConversationSQL(
            tipo="group",
            nome=request.nome,
            descricao=request.descricao,
            tipo_grupo=request.tipo_grupo,
            created_by=current_user.id
        )
        session.add(group)
        await session.flush()
        
        # Adicionar criador como admin
        creator_member = ConversationMemberSQL(
            conversation_id=group.id,
            user_id=current_user.id,
            role="admin"
        )
        session.add(creator_member)
        
        # Adicionar outros membros
        for user_id in request.member_ids:
            if user_id != current_user.id:
                member = ConversationMemberSQL(
                    conversation_id=group.id,
                    user_id=user_id,
                    role="member"
                )
                session.add(member)
        
        await session.commit()
        
        return {"group_id": group.id, "message": "Grupo criado com sucesso"}

@router.post("/{conversation_id}/join")
async def join_public_group(
    conversation_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Entrar em grupo público"""
    async with AsyncSessionLocal() as session:
        # Verificar se grupo existe e é público
        result = await session.execute(
            select(ConversationSQL).where(ConversationSQL.id == conversation_id)
        )
        group = result.scalar_one_or_none()
        if not group:
            raise HTTPException(status_code=404, detail="Grupo não encontrado")
        
        if group.tipo != "group" or group.tipo_grupo != "public":
            raise HTTPException(status_code=403, detail="Apenas grupos públicos podem ser acessados livremente")
        
        # Verificar se já é membro
        result = await session.execute(
            select(ConversationMemberSQL).where(
                and_(
                    ConversationMemberSQL.conversation_id == conversation_id,
                    ConversationMemberSQL.user_id == current_user.id
                )
            )
        )
        existing_member = result.scalar_one_or_none()
        
        if existing_member:
            if existing_member.is_active:
                raise HTTPException(status_code=400, detail="Você já é membro deste grupo")
            else:
                # Reativar membership
                existing_member.is_active = True
                existing_member.joined_at = datetime.utcnow()
        else:
            # Adicionar como novo membro
            member = ConversationMemberSQL(
                conversation_id=conversation_id,
                user_id=current_user.id,
                role="member"
            )
            session.add(member)
        
        await session.commit()
        return {"message": "Você entrou no grupo com sucesso"}

@router.get("/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    limit: int = 50,
    before: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """Lista mensagens de uma conversa"""
    async with AsyncSessionLocal() as session:
        # Verificar se usuário é membro
        result = await session.execute(
            select(ConversationMemberSQL).where(
                and_(
                    ConversationMemberSQL.conversation_id == conversation_id,
                    ConversationMemberSQL.user_id == current_user.id,
                    ConversationMemberSQL.is_active == True
                )
            )
        )
        membership = result.scalar_one_or_none()
        if not membership:
            raise HTTPException(status_code=403, detail="Você não tem acesso a esta conversa")
        
        # Buscar mensagens
        query = select(ChatMessageSQL, UserSQL).join(
            UserSQL, ChatMessageSQL.sender_id == UserSQL.id
        ).where(
            and_(
                ChatMessageSQL.conversation_id == conversation_id,
                ChatMessageSQL.is_deleted == False
            )
        )
        
        if before:
            query = query.where(ChatMessageSQL.id < before)
        
        query = query.order_by(ChatMessageSQL.created_at.desc()).limit(limit)
        
        result = await session.execute(query)
        messages = []
        
        for msg, sender in result.all():
            messages.append({
                "id": msg.id,
                "conversation_id": msg.conversation_id,
                "sender": {
                    "id": sender.id,
                    "name": sender.name,
                    "email": sender.email
                },
                "message": msg.message,
                "tipo": msg.tipo,
                "is_edited": msg.is_edited,
                "is_deleted": msg.is_deleted,
                "created_at": msg.created_at,
                "reply_to_id": msg.reply_to_id
            })
        
        # Marcar como lido
        membership.last_read_at = datetime.utcnow()
        membership.unread_count = 0
        
        await session.commit()
        
        return list(reversed(messages))


@router.post("/{conversation_id}/attachments/upload-drive")
async def upload_chat_attachment_to_drive(
    conversation_id: str,
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user),
):
    """Faz upload de anexo do chat para Google Drive e retorna metadados para o frontend."""
    if not file or not str(file.filename or "").strip():
        raise HTTPException(status_code=400, detail="Arquivo nao informado.")

    async with AsyncSessionLocal() as session:
        membership_result = await session.execute(
            select(ConversationMemberSQL).where(
                and_(
                    ConversationMemberSQL.conversation_id == conversation_id,
                    ConversationMemberSQL.user_id == current_user.id,
                    ConversationMemberSQL.is_active == True,
                )
            )
        )
        if not membership_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Voce nao tem acesso a esta conversa")

        conv_result = await session.execute(select(ConversationSQL).where(ConversationSQL.id == conversation_id))
        conversation = conv_result.scalar_one_or_none()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversa nao encontrada")

    integration = await _load_google_drive_integration()
    templates = integration.get("templates") if isinstance(integration.get("templates"), dict) else {}
    chat_templates = templates.get("chat") if isinstance(templates, dict) else {}
    chat_folder_name = str((chat_templates or {}).get("attachments_folder_name") or "Anexos do Chat").strip()

    try:
        service_account_info = decrypt_service_account_payload(str(integration.get("credentials_encrypted") or ""))
        scopes = integration.get("scopes") or list(DEFAULT_GOOGLE_SCOPES)
        drive_service = GoogleDriveService(service_account_info=service_account_info, scopes=scopes)
        folder_info = drive_service.ensure_folder_path(
            str(integration.get("root_folder_id")),
            [
                chat_folder_name,
                f"Conversa-{conversation_id}",
                datetime.utcnow().strftime("%Y-%m-%d"),
            ],
        )
        file_bytes = await file.read()
        uploaded = drive_service.upload_file(
            parent_folder_id=str(folder_info.get("id")),
            file_name=file.filename,
            file_bytes=file_bytes,
            mime_type=file.content_type or "application/octet-stream",
        )
    except GoogleIntegrationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "id": f"chat-file-{uploaded.get('id')}",
        "name": uploaded.get("name") or file.filename,
        "size": int(uploaded.get("size") or len(file_bytes)),
        "type": uploaded.get("mimeType") or file.content_type or "application/octet-stream",
        "storage_provider": "google_drive",
        "drive_file_id": uploaded.get("id"),
        "drive_folder_id": folder_info.get("id"),
        "web_view_link": uploaded.get("webViewLink"),
        "web_content_link": uploaded.get("webContentLink"),
    }

@router.post("/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    request: SendMessageRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """Envia mensagem em uma conversa"""
    async with AsyncSessionLocal() as session:
        # Verificar se usuário é membro
        result = await session.execute(
            select(ConversationMemberSQL).where(
                and_(
                    ConversationMemberSQL.conversation_id == conversation_id,
                    ConversationMemberSQL.user_id == current_user.id,
                    ConversationMemberSQL.is_active == True
                )
            )
        )
        membership = result.scalar_one_or_none()
        if not membership:
            raise HTTPException(status_code=403, detail="Você não tem acesso a esta conversa")
        
        # Criar mensagem
        message = ChatMessageSQL(
            conversation_id=conversation_id,
            sender_id=current_user.id,
            message=request.message,
            reply_to_id=request.reply_to_id
        )
        session.add(message)
        
        # Atualizar conversa
        result = await session.execute(
            select(ConversationSQL).where(ConversationSQL.id == conversation_id)
        )
        conversation = result.scalar_one()
        conversation.last_message_at = datetime.utcnow()
        
        # Incrementar unread_count dos outros membros
        await session.execute(
            select(ConversationMemberSQL).where(
                and_(
                    ConversationMemberSQL.conversation_id == conversation_id,
                    ConversationMemberSQL.user_id != current_user.id,
                    ConversationMemberSQL.is_active == True
                )
            )
        )
        
        # Atualizar contador de não lidos dos outros membros
        result = await session.execute(
            select(ConversationMemberSQL).where(
                and_(
                    ConversationMemberSQL.conversation_id == conversation_id,
                    ConversationMemberSQL.user_id != current_user.id,
                    ConversationMemberSQL.is_active == True
                )
            )
        )
        
        for other_member in result.scalars().all():
            other_member.unread_count += 1
        
        await session.commit()
        
        return {"message_id": message.id, "message": "Mensagem enviada"}

@router.get("/{conversation_id}/members")
async def get_conversation_members(
    conversation_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Lista membros de uma conversa"""
    async with AsyncSessionLocal() as session:
        # Verificar acesso
        result = await session.execute(
            select(ConversationMemberSQL).where(
                and_(
                    ConversationMemberSQL.conversation_id == conversation_id,
                    ConversationMemberSQL.user_id == current_user.id,
                    ConversationMemberSQL.is_active == True
                )
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Você não tem acesso a esta conversa")
        
        # Buscar membros
        result = await session.execute(
            select(ConversationMemberSQL, UserSQL, UserOnlineStatusSQL)
            .join(UserSQL, ConversationMemberSQL.user_id == UserSQL.id)
            .outerjoin(UserOnlineStatusSQL, UserSQL.id == UserOnlineStatusSQL.user_id)
            .where(
                and_(
                    ConversationMemberSQL.conversation_id == conversation_id,
                    ConversationMemberSQL.is_active == True
                )
            )
        )
        
        members = []
        for membership, user, online_status in result.all():
            presence = resolve_presence(online_status)
            members.append({
                "user_id": user.id,
                "name": user.name,
                "email": user.email,
                "role": membership.role,
                "joined_at": membership.joined_at,
                "is_online": presence["is_online"],
                "last_seen": presence["last_seen"],
            })
        
        return members

@router.post("/{conversation_id}/members/add")
async def add_members_to_group(
    conversation_id: str,
    request: AddMembersRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """Adiciona membros a um grupo (apenas admins)"""
    async with AsyncSessionLocal() as session:
        # Verificar se usuário é admin
        result = await session.execute(
            select(ConversationMemberSQL, ConversationSQL)
            .join(ConversationSQL)
            .where(
                and_(
                    ConversationMemberSQL.conversation_id == conversation_id,
                    ConversationMemberSQL.user_id == current_user.id,
                    ConversationMemberSQL.is_active == True
                )
            )
        )
        row = result.first()
        if not row:
            raise HTTPException(status_code=403, detail="Você não tem acesso a esta conversa")
        
        membership, conversation = row
        
        if conversation.tipo != "group":
            raise HTTPException(status_code=400, detail="Apenas grupos podem adicionar membros")
        
        if membership.role != "admin":
            raise HTTPException(status_code=403, detail="Apenas administradores podem adicionar membros")
        
        # Adicionar membros
        for user_id in request.user_ids:
            # Verificar se usuário existe
            result = await session.execute(select(UserSQL).where(UserSQL.id == user_id))
            if not result.scalar_one_or_none():
                continue
            
            # Verificar se já é membro
            result = await session.execute(
                select(ConversationMemberSQL).where(
                    and_(
                        ConversationMemberSQL.conversation_id == conversation_id,
                        ConversationMemberSQL.user_id == user_id
                    )
                )
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                if not existing.is_active:
                    existing.is_active = True
                    existing.joined_at = datetime.utcnow()
            else:
                new_member = ConversationMemberSQL(
                    conversation_id=conversation_id,
                    user_id=user_id,
                    role="member"
                )
                session.add(new_member)
        
        await session.commit()
        return {"message": "Membros adicionados com sucesso"}

@router.delete("/{conversation_id}/members/{user_id}")
async def remove_member_from_group(
    conversation_id: str,
    user_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Remove membro de um grupo (apenas admins do grupo)."""
    async with AsyncSessionLocal() as session:
        # Verificar se solicitante é admin ativo do grupo
        result = await session.execute(
            select(ConversationMemberSQL, ConversationSQL)
            .join(ConversationSQL)
            .where(
                and_(
                    ConversationMemberSQL.conversation_id == conversation_id,
                    ConversationMemberSQL.user_id == current_user.id,
                    ConversationMemberSQL.role == "admin",
                    ConversationMemberSQL.is_active == True,
                )
            )
        )
        row = result.first()
        if not row:
            raise HTTPException(status_code=403, detail="Apenas administradores podem remover membros")

        _, conversation = row
        if conversation.tipo != "group":
            raise HTTPException(status_code=400, detail="Ação permitida apenas para grupos")

        # Não permitir remover o criador do grupo
        if user_id == conversation.created_by:
            raise HTTPException(status_code=400, detail="Não é possível remover o criador do grupo")

        # Buscar alvo
        result = await session.execute(
            select(ConversationMemberSQL).where(
                and_(
                    ConversationMemberSQL.conversation_id == conversation_id,
                    ConversationMemberSQL.user_id == user_id,
                    ConversationMemberSQL.is_active == True,
                )
            )
        )
        target_member = result.scalar_one_or_none()
        if not target_member:
            raise HTTPException(status_code=404, detail="Membro não encontrado")

        target_member.is_active = False
        target_member.left_at = datetime.utcnow()
        await session.commit()
        return {"message": "Membro removido com sucesso"}

@router.put("/{conversation_id}/members/role")
async def update_member_role(
    conversation_id: str,
    request: UpdateMemberRoleRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """Atualiza role de um membro (apenas admins)"""
    async with AsyncSessionLocal() as session:
        # Verificar se usuário é admin
        result = await session.execute(
            select(ConversationMemberSQL).where(
                and_(
                    ConversationMemberSQL.conversation_id == conversation_id,
                    ConversationMemberSQL.user_id == current_user.id,
                    ConversationMemberSQL.role == "admin",
                    ConversationMemberSQL.is_active == True
                )
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Apenas administradores podem alterar roles")
        
        # Atualizar role do membro
        result = await session.execute(
            select(ConversationMemberSQL).where(
                and_(
                    ConversationMemberSQL.conversation_id == conversation_id,
                    ConversationMemberSQL.user_id == request.user_id,
                    ConversationMemberSQL.is_active == True
                )
            )
        )
        target_member = result.scalar_one_or_none()
        if not target_member:
            raise HTTPException(status_code=404, detail="Membro não encontrado")
        
        target_member.role = request.role
        await session.commit()
        
        return {"message": f"Role atualizada para {request.role}"}

@router.post("/{conversation_id}/leave")
async def leave_conversation(
    conversation_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Sair de uma conversa/grupo"""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ConversationMemberSQL).where(
                and_(
                    ConversationMemberSQL.conversation_id == conversation_id,
                    ConversationMemberSQL.user_id == current_user.id,
                    ConversationMemberSQL.is_active == True
                )
            )
        )
        membership = result.scalar_one_or_none()
        if not membership:
            raise HTTPException(status_code=404, detail="Você não é membro desta conversa")
        
        membership.is_active = False
        membership.left_at = datetime.utcnow()
        
        await session.commit()
        return {"message": "Você saiu da conversa"}
