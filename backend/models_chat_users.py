"""
Modelos expandidos para Chat e Usuários com permissões granulares
"""
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, Integer
from sqlalchemy.orm import relationship
from models_sql import Base
from datetime import datetime
import uuid

# ==================== USUÁRIOS EXPANDIDOS ====================

class UserPermissionSQL(Base):
    """Permissões granulares por setor e visualização"""
    __tablename__ = "user_permissions"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    setor = Column(String(100), nullable=False, index=True)
    # Setores: Atendimento, Contadores, Comercial, Fiscal, Financeiro, Trabalhista
    visualizacoes = Column(Text, nullable=False)  # JSON array de visualizações permitidas
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("UserSQL", foreign_keys=[user_id])

class UserOnlineStatusSQL(Base):
    """Status online dos usuários"""
    __tablename__ = "user_online_status"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    is_online = Column(Boolean, default=False)
    last_seen = Column(DateTime, default=datetime.utcnow)
    last_activity = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("UserSQL", foreign_keys=[user_id])

# ==================== CHAT E GRUPOS ====================

class ConversationSQL(Base):
    """Conversas (1-1 ou grupos)"""
    __tablename__ = "conversations"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tipo = Column(String(20), nullable=False, index=True)  # "direct" ou "group"
    nome = Column(String(255))  # Nome do grupo (null para conversas diretas)
    descricao = Column(Text)  # Descrição do grupo
    tipo_grupo = Column(String(20))  # "public" ou "private" (null para direct)
    avatar = Column(String(500))  # URL do avatar do grupo
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_message_at = Column(DateTime)
    
    creator = relationship("UserSQL", foreign_keys=[created_by])
    members = relationship("ConversationMemberSQL", back_populates="conversation", cascade="all, delete-orphan")
    messages = relationship("ChatMessageSQL", back_populates="conversation", cascade="all, delete-orphan")

class ConversationMemberSQL(Base):
    """Membros de uma conversa/grupo"""
    __tablename__ = "conversation_members"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(20), default="member")  # "admin" ou "member"
    joined_at = Column(DateTime, default=datetime.utcnow)
    last_read_at = Column(DateTime)
    unread_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)  # Se ainda está no grupo
    left_at = Column(DateTime)
    
    conversation = relationship("ConversationSQL", back_populates="members")
    user = relationship("UserSQL", foreign_keys=[user_id])

class ChatMessageSQL(Base):
    """Mensagens do chat"""
    __tablename__ = "chat_messages"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False, index=True)
    sender_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    message = Column(Text, nullable=False)
    tipo = Column(String(20), default="text")  # text, image, file, system
    attachments = Column(Text)  # JSON array de anexos
    reply_to_id = Column(String(36), ForeignKey("chat_messages.id"))  # Responder mensagem
    is_edited = Column(Boolean, default=False)
    edited_at = Column(DateTime)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    conversation = relationship("ConversationSQL", back_populates="messages")
    sender = relationship("UserSQL", foreign_keys=[sender_id])
    reply_to = relationship("ChatMessageSQL", remote_side=[id], foreign_keys=[reply_to_id])

class MessageReadStatusSQL(Base):
    """Status de leitura de mensagens"""
    __tablename__ = "message_read_status"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id = Column(String(36), ForeignKey("chat_messages.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    read_at = Column(DateTime, default=datetime.utcnow)
    
    message = relationship("ChatMessageSQL", foreign_keys=[message_id])
    user = relationship("UserSQL", foreign_keys=[user_id])
