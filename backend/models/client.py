from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum
import uuid
import re

# Enums para controle de dados
class StatusEmpresa(str, Enum):
    ATIVA = "ativa"
    INATIVA = "inativa"
    SUSPENSA = "suspensa"

class FormaEnvio(str, Enum):
    WHATSAPP = "whatsapp"
    EMAIL = "email"
    IMPRESSO = "impresso"

class TipoEmpresa(str, Enum):
    MATRIZ = "matriz"
    FILIAL = "filial"

class TipoRegime(str, Enum):
    MEI = "mei"
    SIMPLES = "simples"
    LUCRO_PRESUMIDO = "lucro_presumido"
    LUCRO_REAL = "lucro_real"

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
    
    # Dados básicos da empresa
    nome_empresa: str
    nome_fantasia: Optional[str] = None
    status_empresa: StatusEmpresa = StatusEmpresa.ATIVA
    
    # Localização
    cidade_atendimento: str
    
    # Contatos
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    responsavel_empresa: Optional[str] = None
    
    # Documentos
    cnpj: str
    codigo_iob: Optional[str] = None
    
    # Classificações
    novo_cliente: bool = False
    tipo_empresa: TipoEmpresa = TipoEmpresa.MATRIZ
    tipo_regime: TipoRegime
    
    # Endereço completo
    endereco: Address
    
    # Configurações
    forma_envio: FormaEnvio = FormaEnvio.EMAIL
    empresa_grupo: Optional[str] = None  # Vinculação com outras empresas
    
    # Metadados
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    @validator('cnpj')
    def validate_cnpj(cls, v):
        # Remove caracteres especiais
        cnpj = re.sub(r'[^0-9]', '', v)
        if len(cnpj) != 14:
            raise ValueError('CNPJ deve ter 14 dígitos')
        return v
    
    @validator('email')
    def validate_email(cls, v):
        if v and '@' not in v:
            raise ValueError('Email inválido')
        return v

class ClientCreate(BaseModel):
    nome_empresa: str
    nome_fantasia: Optional[str] = None
    status_empresa: StatusEmpresa = StatusEmpresa.ATIVA
    cidade_atendimento: str
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    responsavel_empresa: Optional[str] = None
    cnpj: str
    codigo_iob: Optional[str] = None
    novo_cliente: bool = False
    tipo_empresa: TipoEmpresa = TipoEmpresa.MATRIZ
    tipo_regime: TipoRegime
    endereco: Address
    forma_envio: FormaEnvio = FormaEnvio.EMAIL
    empresa_grupo: Optional[str] = None

class ClientUpdate(BaseModel):
    nome_empresa: Optional[str] = None
    nome_fantasia: Optional[str] = None
    status_empresa: Optional[StatusEmpresa] = None
    cidade_atendimento: Optional[str] = None
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    responsavel_empresa: Optional[str] = None
    cnpj: Optional[str] = None
    codigo_iob: Optional[str] = None
    novo_cliente: Optional[bool] = None
    tipo_empresa: Optional[TipoEmpresa] = None
    tipo_regime: Optional[TipoRegime] = None
    endereco: Optional[Address] = None
    forma_envio: Optional[FormaEnvio] = None
    empresa_grupo: Optional[str] = None

# Modelo para filtros
class ClientFilters(BaseModel):
    nome_empresa: Optional[str] = None
    cnpj: Optional[str] = None
    cidade_atendimento: Optional[str] = None
    status_empresa: Optional[List[StatusEmpresa]] = None
    tipo_regime: Optional[List[TipoRegime]] = None
    novo_cliente: Optional[bool] = None
    empresa_grupo: Optional[str] = None