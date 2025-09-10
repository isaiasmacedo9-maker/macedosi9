from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
import uuid

class Conversa(BaseModel):
    data: datetime
    usuario: str
    mensagem: str

class Ticket(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    empresa_id: str
    empresa: str
    titulo: str
    descricao: str
    prioridade: str = Field(..., pattern="^(baixa|media|alta|urgente)$")
    status: str = Field(..., pattern="^(aberto|em_andamento|resolvido|fechado|aguardando_cliente)$")
    responsavel: str
    canal: str = Field(..., pattern="^(telefone|email|whatsapp|chat|presencial)$")
    data_abertura: date
    sla: datetime
    conversas: List[Conversa] = []
    arquivos: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TicketCreate(BaseModel):
    empresa_id: str
    empresa: str
    titulo: str
    descricao: str
    prioridade: str = Field(default="media", pattern="^(baixa|media|alta|urgente)$")
    responsavel: str
    canal: str = Field(..., pattern="^(telefone|email|whatsapp|chat|presencial)$")
    data_abertura: date

class TicketUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    prioridade: Optional[str] = None
    status: Optional[str] = None
    responsavel: Optional[str] = None