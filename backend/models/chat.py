from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    usuario_id: str
    usuario_nome: str
    mensagem: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    tipo: str = Field(default="text", pattern="^(text|file|image|system)$")
    arquivo_url: Optional[str] = None

class Chat(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    descricao: Optional[str] = None
    tipo: str = Field(..., pattern="^(grupo|privado|suporte)$")
    participantes: List[str] = []
    admin_id: str
    mensagens: List[Message] = []
    ativo: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ChatCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    tipo: str = Field(..., pattern="^(grupo|privado|suporte)$")
    participantes: List[str] = []

class MessageCreate(BaseModel):
    mensagem: str
    tipo: str = Field(default="text", pattern="^(text|file|image|system)$")
    arquivo_url: Optional[str] = None