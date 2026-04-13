from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum
import uuid

# Enums para controle de dados
class TipoSolicitacao(str, Enum):
    ADMISSAO = "admissao"
    DEMISSAO = "demissao" 
    FOLHA = "folha"
    FOLHA_PAGAMENTO = "folha_pagamento"
    AFASTAMENTO = "afastamento"
    RECLAMACAO = "reclamacao"
    FERIAS = "ferias"
    RESCISAO = "rescisao"
    ALTERACAO_CONTRATUAL = "alteracao_contratual"
    AUXILIO_DOENCA = "auxilio_doenca"
    LICENCA_MATERNIDADE = "licenca_maternidade"
    OUTROS = "outros"

class StatusSolicitacao(str, Enum):
    PENDENTE = "pendente"
    EM_ANDAMENTO = "em_andamento"
    CONCLUIDO = "concluido"
    ATRASADO = "atrasado"
    CANCELADO = "cancelado"
    AGUARDANDO_DOCUMENTOS = "aguardando_documentos"

class TipoContrato(str, Enum):
    CLT = "clt"
    TEMPORARIO = "temporario"
    TERCEIRIZADO = "terceirizado"
    ESTAGIARIO = "estagiario"
    AUTONOMO = "autonomo"
    PJ = "pj"

class TipoAfastamento(str, Enum):
    DOENCA = "doenca"
    ACIDENTE_TRABALHO = "acidente_trabalho"
    LICENCA_MATERNIDADE = "licenca_maternidade"
    LICENCA_PATERNIDADE = "licenca_paternidade"
    FERIAS = "ferias"
    LICENCA_SEM_VENCIMENTO = "licenca_sem_vencimento"

class PeriodicidadeObrigacao(str, Enum):
    MENSAL = "mensal"
    BIMESTRAL = "bimestral"
    TRIMESTRAL = "trimestral"
    SEMESTRAL = "semestral"
    ANUAL = "anual"

# Modelos para dados de funcionários
class DadosPessoais(BaseModel):
    nome_completo: str
    cpf: str
    rg: Optional[str] = None
    data_nascimento: Optional[date] = None
    estado_civil: Optional[str] = None
    endereco: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    nome_mae: Optional[str] = None
    nome_pai: Optional[str] = None

class DadosContratuais(BaseModel):
    funcao: str
    cargo: Optional[str] = None
    tipo_contrato: TipoContrato = TipoContrato.CLT
    salario_base: float
    carga_horaria: Optional[int] = None
    data_admissao: date
    data_demissao: Optional[date] = None
    motivo_demissao: Optional[str] = None
    setor: Optional[str] = None
    centro_custo: Optional[str] = None

class Funcionario(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    empresa_id: str
    dados_pessoais: DadosPessoais
    dados_contratuais: DadosContratuais
    status: str = "ativo"  # ativo, demitido, afastado, ferias
    observacoes: Optional[str] = None
    documentos_anexos: List[str] = []
    historico_alteracoes: List[Dict[str, Any]] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Modelo para detalhes da folha de pagamento
class ItemFolha(BaseModel):
    codigo: str
    descricao: str
    tipo: str  # provento, desconto
    valor: float
    base_calculo: Optional[float] = None

class DetalheFolha(BaseModel):
    mes_referencia: str  # formato: "2025-01"
    funcionario_id: Optional[str] = None
    total_funcionarios: int
    total_proventos: float
    total_descontos: float
    total_liquido: float
    inss_empresa: Optional[float] = None
    fgts: Optional[float] = None
    itens_folha: List[ItemFolha] = []

# Modelo para obrigações trabalhistas
class ObrigacaoTrabalhista(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    empresa_id: str
    nome: str  # GFIP, eSocial, DCTF (quando trabalhista), RAIS, DIRF
    descricao: str
    periodicidade: PeriodicidadeObrigacao
    dia_vencimento: int = Field(..., ge=1, le=31)
    proximo_vencimento: date
    status: str = "pendente"  # pendente, entregue, atrasada
    responsavel: Optional[str] = None
    observacoes: Optional[str] = None
    arquivos_entrega: List[str] = []
    historico_entregas: List[Dict[str, Any]] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Modelo para checklists
class ItemChecklist(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    descricao: str
    concluido: bool = False
    responsavel: Optional[str] = None
    prazo: Optional[date] = None
    observacoes: Optional[str] = None

class ChecklistTrabalhista(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tipo_processo: TipoSolicitacao
    nome: str
    descricao: str
    itens: List[ItemChecklist]
    template: bool = False  # Se é um template reutilizável
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Modelo principal para solicitações trabalhistas
class SolicitacaoTrabalhista(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    empresa_id: str
    empresa: str
    tipo: TipoSolicitacao
    titulo: str
    descricao: str
    data_solicitacao: date = Field(default_factory=date.today)
    prazo: date
    responsavel: str
    status: StatusSolicitacao = StatusSolicitacao.PENDENTE
    prioridade: str = "media"  # alta, media, baixa
    
    # Dados específicos por tipo
    funcionario_id: Optional[str] = None
    funcionario_dados: Optional[Funcionario] = None
    detalhes_folha: Optional[DetalheFolha] = None
    tipo_afastamento: Optional[TipoAfastamento] = None
    periodo_afastamento: Optional[Dict[str, date]] = None
    
    # Anexos e documentos
    documentos_anexos: List[str] = []
    documentos_necessarios: List[str] = []
    
    # Checklist
    checklist_id: Optional[str] = None
    checklist_items: List[ItemChecklist] = []
    
    # Observações e histórico
    observacoes: Optional[str] = None
    historico_alteracoes: List[Dict[str, Any]] = []
    
    # Metadados
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Modelos para criação e atualização
class SolicitacaoTrabalhistaCreate(BaseModel):
    empresa_id: str
    empresa: str
    tipo: TipoSolicitacao
    titulo: str
    descricao: str
    prazo: date
    responsavel: str
    prioridade: str = "media"
    funcionario_id: Optional[str] = None
    detalhes_folha: Optional[DetalheFolha] = None
    tipo_afastamento: Optional[TipoAfastamento] = None
    periodo_afastamento: Optional[Dict[str, date]] = None
    observacoes: Optional[str] = None

class SolicitacaoTrabalhistaUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    prazo: Optional[date] = None
    responsavel: Optional[str] = None
    status: Optional[StatusSolicitacao] = None
    prioridade: Optional[str] = None
    observacoes: Optional[str] = None

class FuncionarioCreate(BaseModel):
    empresa_id: str
    dados_pessoais: DadosPessoais
    dados_contratuais: DadosContratuais
    observacoes: Optional[str] = None

class FuncionarioUpdate(BaseModel):
    dados_pessoais: Optional[DadosPessoais] = None
    dados_contratuais: Optional[DadosContratuais] = None
    status: Optional[str] = None
    observacoes: Optional[str] = None

class ObrigacaoTrabalhistaCreate(BaseModel):
    empresa_id: str
    nome: str
    descricao: str
    periodicidade: PeriodicidadeObrigacao
    dia_vencimento: int = Field(..., ge=1, le=31)
    responsavel: Optional[str] = None
    observacoes: Optional[str] = None

class ObrigacaoTrabalhistaUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    periodicidade: Optional[PeriodicidadeObrigacao] = None
    dia_vencimento: Optional[int] = Field(None, ge=1, le=31)
    status: Optional[str] = None
    responsavel: Optional[str] = None
    observacoes: Optional[str] = None

# Modelos para filtros e relatórios
class TrabalhistaFilters(BaseModel):
    empresa: Optional[str] = None
    tipo: Optional[List[TipoSolicitacao]] = None
    status: Optional[List[StatusSolicitacao]] = None
    responsavel: Optional[str] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    prioridade: Optional[str] = None

class RelatorioTrabalhista(BaseModel):
    periodo_inicio: date
    periodo_fim: date
    total_solicitacoes: int
    por_tipo: Dict[str, int]
    por_status: Dict[str, int]
    prazo_medio_conclusao: Optional[float] = None
    obrigacoes_vencendo: List[ObrigacaoTrabalhista]
    funcionarios_admitidos: int
    funcionarios_demitidos: int