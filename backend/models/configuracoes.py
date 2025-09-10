from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
from datetime import datetime
import uuid

class Configuracoes(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    setor: str = Field(..., pattern="^(trabalhista|fiscal|contabil|atendimento|financeiro|comercial)$")
    nome: str
    configuracoes: Dict[str, Any]
    updated_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ConfiguracoesCreate(BaseModel):
    setor: str = Field(..., pattern="^(trabalhista|fiscal|contabil|atendimento|financeiro|comercial)$")
    nome: str
    configuracoes: Dict[str, Any]
    updated_by: str

class ConfiguracoesUpdate(BaseModel):
    configuracoes: Dict[str, Any]
    updated_by: str