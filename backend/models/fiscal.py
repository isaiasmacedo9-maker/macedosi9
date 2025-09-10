from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum
import uuid

# Enums para controle de dados
class TipoObrigacao(str, Enum):
    PGDAS = "pgdas"
    DEFIS = "defis"
    DCTF = "dctf"
    SPED_FISCAL = "sped_fiscal"
    SPED_CONTRIBUICOES = "sped_contribuicoes"
    ECF = "ecf"
    DARF = "darf"
    GIAS = "gias"
    DIF = "dif"
    DIRF = "dirf"

class StatusObrigacao(str, Enum):
    PENDENTE = "pendente"
    EM_ANDAMENTO = "em_andamento"
    ENTREGUE = "entregue"
    ATRASADO = "atrasado"
    RETIFICADO = "retificado"
    CANCELADO = "cancelado"

class PeriodicidadeObrigacao(str, Enum):
    MENSAL = "mensal"
    BIMESTRAL = "bimestral"
    TRIMESTRAL = "trimestral"
    SEMESTRAL = "semestral"
    ANUAL = "anual"
    EVENTUAL = "eventual"

class TipoNota(str, Enum):
    ENTRADA = "entrada"
    SAIDA = "saida"
    CANCELADA = "cancelada"
    INUTILIZADA = "inutilizada"

class StatusConciliacao(str, Enum):
    NAO_CONCILIADO = "nao_conciliado"
    CONCILIADO = "conciliado"
    DIVERGENTE = "divergente"
    PENDENTE = "pendente"

class RegimeTributario(str, Enum):
    SIMPLES_NACIONAL = "simples_nacional"
    LUCRO_PRESUMIDO = "lucro_presumido"
    LUCRO_REAL = "lucro_real"
    MEI = "mei"

# Modelos para impostos e tributos
class ImpostoCalculado(BaseModel):
    tipo: str  # ICMS, IPI, PIS, COFINS, ISS
    base_calculo: float
    aliquota: float
    valor: float
    isento: bool = False
    observacoes: Optional[str] = None

class ResumoImpostos(BaseModel):
    periodo: str  # YYYY-MM
    icms: float = 0.0
    ipi: float = 0.0
    pis: float = 0.0
    cofins: float = 0.0
    iss: float = 0.0
    irpj: float = 0.0
    csll: float = 0.0
    total_impostos: float = 0.0

# Modelo principal para obrigações (expandido)
class ObrigacaoFiscal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    empresa_id: str
    empresa: str
    tipo: TipoObrigacao
    nome: str
    descricao: Optional[str] = None
    periodicidade: PeriodicidadeObrigacao
    dia_vencimento: int = Field(..., ge=1, le=31)
    proximo_vencimento: date
    ultimo_vencimento: Optional[date] = None
    status: StatusObrigacao = StatusObrigacao.PENDENTE
    responsavel: str
    regime_tributario: RegimeTributario
    
    # Documentos e entrega
    protocolo_entrega: Optional[str] = None
    data_entrega: Optional[date] = None
    arquivo_enviado: Optional[str] = None
    comprovante_entrega: Optional[str] = None
    observacoes: Optional[str] = None
    valor: Optional[float] = None
    
    # Arrays originais mantidos para compatibilidade
    documentos: List[str] = []
    vencimento: Optional[date] = None  # Mantido para compatibilidade
    
    # Histórico
    historico_entregas: List[Dict[str, Any]] = []
    
    # Metadados
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Modelo para notas fiscais
class NotaFiscal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    empresa_id: str
    empresa: str
    tipo: TipoNota
    numero: int
    serie: str
    chave_nfe: str
    data_emissao: date
    data_vencimento: Optional[date] = None
    
    # Dados do emitente/destinatário
    emitente_cnpj: str
    emitente_razao_social: str
    destinatario_cnpj: Optional[str] = None
    destinatario_razao_social: Optional[str] = None
    
    # Valores
    valor_total: float
    valor_produtos: float
    valor_servicos: float = 0.0
    base_icms: float = 0.0
    valor_icms: float = 0.0
    base_ipi: float = 0.0
    valor_ipi: float = 0.0
    valor_pis: float = 0.0
    valor_cofins: float = 0.0
    valor_iss: float = 0.0
    
    # Impostos calculados
    impostos: List[ImpostoCalculado] = []
    
    # Conciliação
    status_conciliacao: StatusConciliacao = StatusConciliacao.NAO_CONCILIADO
    conciliado_com: Optional[str] = None  # ID do documento conciliado
    data_conciliacao: Optional[datetime] = None
    
    # Arquivos
    arquivo_xml: Optional[str] = None
    arquivo_pdf: Optional[str] = None
    
    # Classificação fiscal
    cfop: Optional[str] = None
    natureza_operacao: Optional[str] = None
    
    # Metadados
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Modelos para criação e atualização (expandidos)
class ObrigacaoFiscalCreate(BaseModel):
    empresa_id: str
    empresa: str
    tipo: TipoObrigacao
    nome: str
    descricao: Optional[str] = None
    periodicidade: PeriodicidadeObrigacao
    dia_vencimento: int = Field(..., ge=1, le=31)
    responsavel: str
    regime_tributario: RegimeTributario
    observacoes: Optional[str] = None
    valor: Optional[float] = None

class ObrigacaoFiscalUpdate(BaseModel):
    tipo: Optional[TipoObrigacao] = None
    nome: Optional[str] = None
    descricao: Optional[str] = None
    periodicidade: Optional[PeriodicidadeObrigacao] = None
    dia_vencimento: Optional[int] = Field(None, ge=1, le=31)
    status: Optional[StatusObrigacao] = None
    responsavel: Optional[str] = None
    protocolo_entrega: Optional[str] = None
    data_entrega: Optional[date] = None
    observacoes: Optional[str] = None
    valor: Optional[float] = None
    # Campos legados mantidos para compatibilidade
    vencimento: Optional[date] = None

class NotaFiscalCreate(BaseModel):
    empresa_id: str
    empresa: str
    tipo: TipoNota
    numero: int
    serie: str
    chave_nfe: str
    data_emissao: date
    emitente_cnpj: str
    emitente_razao_social: str
    destinatario_cnpj: Optional[str] = None
    destinatario_razao_social: Optional[str] = None
    valor_total: float
    valor_produtos: float
    valor_servicos: float = 0.0
    cfop: Optional[str] = None
    natureza_operacao: Optional[str] = None

class NotaFiscalUpdate(BaseModel):
    status_conciliacao: Optional[StatusConciliacao] = None
    conciliado_com: Optional[str] = None
    valor_icms: Optional[float] = None
    valor_ipi: Optional[float] = None
    valor_pis: Optional[float] = None
    valor_cofins: Optional[float] = None

# Modelos para filtros e relatórios
class FiscalFilters(BaseModel):
    empresa: Optional[str] = None
    tipo: Optional[List[TipoObrigacao]] = None
    status: Optional[List[StatusObrigacao]] = None
    responsavel: Optional[str] = None
    vencimento_inicio: Optional[date] = None
    vencimento_fim: Optional[date] = None
    regime_tributario: Optional[RegimeTributario] = None

class NotaFiscalFilters(BaseModel):
    empresa: Optional[str] = None
    tipo: Optional[List[TipoNota]] = None
    chave_nfe: Optional[str] = None
    emitente_cnpj: Optional[str] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    status_conciliacao: Optional[List[StatusConciliacao]] = None
    valor_minimo: Optional[float] = None
    valor_maximo: Optional[float] = None

class RelatorioFiscal(BaseModel):
    periodo_inicio: date
    periodo_fim: date
    total_obrigacoes: int
    obrigacoes_pendentes: int
    obrigacoes_atrasadas: int
    obrigacoes_entregues: int
    total_notas_fiscais: int
    valor_total_saidas: float
    valor_total_entradas: float
    impostos_apurados: ResumoImpostos
    por_regime_tributario: Dict[str, int]
    por_tipo_obrigacao: Dict[str, int]