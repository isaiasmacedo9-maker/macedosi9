from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
import uuid

class FuncionarioData(BaseModel):
    nome: str
    cpf: str
    funcao: str
    salario: Optional[float] = None
    data_admissao: Optional[date] = None
    motivo_demissao: Optional[str] = None

class DetalheFolha(BaseModel):
    total_funcionarios: int
    total_proventos: float
    total_descontos: float
    total_liquido: float

class SolicitacaoTrabalhista(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    empresa_id: str
    empresa: str
    tipo: str = Field(..., pattern="^(admissao|demissao|folha|afastamento|reclamacao)$")
    descricao: str
    data_solicitacao: date
    prazo: date
    responsavel: str
    status: str = Field(..., pattern="^(pendente|em_andamento|concluido|atrasado)$")
    arquivos: List[str] = []
    observacoes: Optional[str] = None
    funcionario: Optional[FuncionarioData] = None
    detalhes: Optional[DetalheFolha] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class SolicitacaoTrabalhistaCreate(BaseModel):
    empresa_id: str
    empresa: str
    tipo: str = Field(..., pattern="^(admissao|demissao|folha|afastamento|reclamacao)$")
    descricao: str
    data_solicitacao: date
    prazo: date
    responsavel: str
    observacoes: Optional[str] = None
    funcionario: Optional[FuncionarioData] = None
    detalhes: Optional[DetalheFolha] = None

class SolicitacaoTrabalhistaUpdate(BaseModel):
    tipo: Optional[str] = None
    descricao: Optional[str] = None
    prazo: Optional[date] = None
    responsavel: Optional[str] = None
    status: Optional[str] = None
    observacoes: Optional[str] = None
    funcionario: Optional[FuncionarioData] = None
    detalhes: Optional[DetalheFolha] = None