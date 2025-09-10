from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date
import uuid

class TaskComment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    usuario_id: str
    usuario_nome: str
    comentario: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    titulo: str
    descricao: Optional[str] = None
    status: str = Field(default="pendente", pattern="^(pendente|em_andamento|concluida|cancelada)$")
    prioridade: str = Field(default="media", pattern="^(baixa|media|alta|urgente)$")
    categoria: str = Field(..., pattern="^(comercial|financeiro|trabalhista|fiscal|contabil|atendimento)$")
    responsavel_id: str
    responsavel_nome: str
    criador_id: str
    criador_nome: str
    data_criacao: datetime = Field(default_factory=datetime.utcnow)
    data_prazo: Optional[date] = None
    data_conclusao: Optional[datetime] = None
    progresso: int = Field(default=0, ge=0, le=100)
    comentarios: List[TaskComment] = []
    tags: List[str] = []
    arquivos: List[str] = []
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TaskCreate(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    prioridade: str = Field(default="media", pattern="^(baixa|media|alta|urgente)$")
    categoria: str = Field(..., pattern="^(comercial|financeiro|trabalhista|fiscal|contabil|atendimento)$")
    responsavel_id: str
    data_prazo: Optional[date] = None
    tags: List[str] = []

class TaskUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    status: Optional[str] = None
    prioridade: Optional[str] = None
    responsavel_id: Optional[str] = None
    data_prazo: Optional[date] = None
    progresso: Optional[int] = None
    tags: Optional[List[str]] = None