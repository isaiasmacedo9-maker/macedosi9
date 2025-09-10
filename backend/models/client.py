from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
import uuid

class Address(BaseModel):
    logradouro: str
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: str
    distrito: Optional[str] = None
    cep: str
    cidade: str
    estado: str

class Client(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome_empresa: str
    nome_fantasia: str
    status: str = Field(..., pattern="^(ativa|inativa|suspensa)$")
    cidade: str
    telefone: str
    whatsapp: str
    email: str
    responsavel: str
    cnpj: str
    forma_envio: str = Field(..., pattern="^(whatsapp|email|impresso)$")
    codigo_iob: str
    novo_cliente: bool = False
    tipo_empresa: str = Field(..., pattern="^(matriz|filial)$")
    endereco: Address
    tipo_regime: str = Field(..., pattern="^(simples|lucro_presumido|lucro_real|mei)$")
    empresa_grupo: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ClientCreate(BaseModel):
    nome_empresa: str
    nome_fantasia: str
    status: str = Field(default="ativa", pattern="^(ativa|inativa|suspensa)$")
    cidade: str
    telefone: str
    whatsapp: str
    email: str
    responsavel: str
    cnpj: str
    forma_envio: str = Field(..., pattern="^(whatsapp|email|impresso)$")
    codigo_iob: str
    novo_cliente: bool = False
    tipo_empresa: str = Field(..., pattern="^(matriz|filial)$")
    endereco: Address
    tipo_regime: str = Field(..., pattern="^(simples|lucro_presumido|lucro_real|mei)$")
    empresa_grupo: Optional[str] = None

class ClientUpdate(BaseModel):
    nome_empresa: Optional[str] = None
    nome_fantasia: Optional[str] = None
    status: Optional[str] = None
    cidade: Optional[str] = None
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    responsavel: Optional[str] = None
    cnpj: Optional[str] = None
    forma_envio: Optional[str] = None
    codigo_iob: Optional[str] = None
    novo_cliente: Optional[bool] = None
    tipo_empresa: Optional[str] = None
    endereco: Optional[Address] = None
    tipo_regime: Optional[str] = None
    empresa_grupo: Optional[str] = None