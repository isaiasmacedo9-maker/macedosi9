from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
import uuid

class ObrigacaoFiscal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    empresa_id: str
    empresa: str
    tipo: str = Field(..., pattern="^(pgdas|dctf|sped|defis|darf)$")
    nome: str
    periodicidade: str = Field(..., pattern="^(mensal|trimestral|semestral|anual|evento)$")
    vencimento: date
    status: str = Field(..., pattern="^(pendente|em_andamento|entregue|atrasado)$")
    responsavel: str
    documentos: List[str] = []
    observacoes: Optional[str] = None
    valor: Optional[float] = None
    data_entrega: Optional[date] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ObrigacaoFiscalCreate(BaseModel):
    empresa_id: str
    empresa: str
    tipo: str = Field(..., pattern="^(pgdas|dctf|sped|defis|darf)$")
    nome: str
    periodicidade: str = Field(..., pattern="^(mensal|trimestral|semestral|anual|evento)$")
    vencimento: date
    responsavel: str
    observacoes: Optional[str] = None
    valor: Optional[float] = None

class ObrigacaoFiscalUpdate(BaseModel):
    tipo: Optional[str] = None
    nome: Optional[str] = None
    periodicidade: Optional[str] = None
    vencimento: Optional[date] = None
    status: Optional[str] = None
    responsavel: Optional[str] = None
    observacoes: Optional[str] = None
    valor: Optional[float] = None
    data_entrega: Optional[date] = None