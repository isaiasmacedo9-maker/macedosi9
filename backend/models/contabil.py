from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum
import uuid

# Enums para controle de dados
class TipoConta(str, Enum):
    ATIVO_CIRCULANTE = "ativo_circulante"
    ATIVO_NAO_CIRCULANTE = "ativo_nao_circulante"
    PASSIVO_CIRCULANTE = "passivo_circulante"
    PASSIVO_NAO_CIRCULANTE = "passivo_nao_circulante"
    PATRIMONIO_LIQUIDO = "patrimonio_liquido"
    RECEITA = "receita"
    DESPESA = "despesa"
    CUSTO = "custo"

class TipoLancamento(str, Enum):
    MANUAL = "manual"
    AUTOMATICO = "automatico"
    IMPORTADO = "importado"
    CONCILIACAO = "conciliacao"

class StatusLancamento(str, Enum):
    RASCUNHO = "rascunho"
    LANCADO = "lancado"
    CONCILIADO = "conciliado"
    ESTORNADO = "estornado"

class TipoDocumento(str, Enum):
    NOTA_FISCAL = "nota_fiscal"
    RECIBO = "recibo"
    CONTRATO = "contrato"
    BOLETO = "boleto"
    TRANSFERENCIA = "transferencia"
    OUTROS = "outros"

class PeriodoApuracao(str, Enum):
    MENSAL = "mensal"
    TRIMESTRAL = "trimestral"
    SEMESTRAL = "semestral"
    ANUAL = "anual"

# Modelo para plano de contas
class ContaContabil(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    codigo: str  # Ex: 1.1.1.001
    nome: str
    tipo: TipoConta
    conta_pai: Optional[str] = None  # ID da conta pai (para hierarquia)
    nivel: int = 1  # Nível na hierarquia
    aceita_lancamento: bool = True  # Conta sintética ou analítica
    ativa: bool = True
    descricao: Optional[str] = None
    
    # Classificações especiais
    centro_custo_obrigatorio: bool = False
    historico_padrao: Optional[str] = None
    
    # Metadados
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Modelo para centros de custo
class CentroCusto(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    codigo: str
    nome: str
    descricao: Optional[str] = None
    ativo: bool = True
    centro_pai: Optional[str] = None  # Para hierarquia
    empresa_id: str
    empresa: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Modelo para lançamentos contábeis
class LancamentoItem(BaseModel):
    conta_id: str
    conta_codigo: str
    conta_nome: str
    valor_debito: float = 0.0
    valor_credito: float = 0.0
    centro_custo_id: Optional[str] = None
    centro_custo_nome: Optional[str] = None
    historico: Optional[str] = None

class LancamentoContabil(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    empresa_id: str
    empresa: str
    numero_lancamento: Optional[str] = None  # Sequencial
    data_lancamento: date
    tipo: TipoLancamento = TipoLancamento.MANUAL
    status: StatusLancamento = StatusLancamento.RASCUNHO
    
    # Documento origem
    tipo_documento: TipoDocumento
    numero_documento: Optional[str] = None
    documento_vinculado_id: Optional[str] = None  # ID do documento original
    
    # Items do lançamento (partidas dobradas)
    itens: List[LancamentoItem]
    
    # Totais (calculados automaticamente)
    total_debito: Optional[float] = None
    total_credito: Optional[float] = None
    
    # Histórico geral do lançamento
    historico_geral: str
    observacoes: Optional[str] = None
    
    # Responsável e aprovação
    responsavel: str
    aprovado_por: Optional[str] = None
    data_aprovacao: Optional[datetime] = None
    
    # Metadados
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @validator('total_debito', always=True)
    def calculate_total_debito(cls, v, values):
        if 'itens' in values and values['itens']:
            return sum(item.valor_debito for item in values['itens'])
        return v or 0

    @validator('total_credito', always=True)
    def calculate_total_credito(cls, v, values):
        if 'itens' in values and values['itens']:
            return sum(item.valor_credito for item in values['itens'])
        return v or 0

# Modelo para balancete
class ItemBalancete(BaseModel):
    conta_id: str
    conta_codigo: str
    conta_nome: str
    tipo_conta: TipoConta
    saldo_anterior: float = 0.0
    movimentos_debito: float = 0.0
    movimentos_credito: float = 0.0
    saldo_atual: float = 0.0

class Balancete(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    empresa_id: str
    empresa: str
    periodo: str  # YYYY-MM
    data_referencia: date
    
    # Itens do balancete
    contas: List[ItemBalancete]
    
    # Totais
    total_ativo: float = 0.0
    total_passivo: float = 0.0
    total_patrimonio_liquido: float = 0.0
    total_receitas: float = 0.0
    total_despesas: float = 0.0
    
    # Status
    status: str = "em_andamento"  # em_andamento, fechado, aprovado
    
    # Metadados
    responsavel: str
    data_geracao: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Modelo para DRE (Demonstração do Resultado do Exercício)
class ItemDRE(BaseModel):
    grupo: str  # Ex: "Receita Bruta", "Custos", "Despesas Operacionais"
    conta_codigo: str
    conta_nome: str
    valor_periodo: float
    valor_acumulado: float
    percentual_receita: Optional[float] = None

class DRE(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    empresa_id: str
    empresa: str
    periodo_inicio: date
    periodo_fim: date
    tipo_periodo: PeriodoApuracao
    
    # Grupos da DRE
    receita_bruta: List[ItemDRE] = []
    deducoes_receita: List[ItemDRE] = []
    custos: List[ItemDRE] = []
    despesas_operacionais: List[ItemDRE] = []
    outras_receitas_despesas: List[ItemDRE] = []
    
    # Resultados calculados
    receita_liquida: float = 0.0
    lucro_bruto: float = 0.0
    lucro_operacional: float = 0.0
    lucro_antes_impostos: float = 0.0
    lucro_liquido: float = 0.0
    
    # Margem
    margem_bruta: float = 0.0  # %
    margem_operacional: float = 0.0  # %
    margem_liquida: float = 0.0  # %
    
    # Metadados
    responsavel: str
    data_geracao: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Modelo para conciliação bancária
class ItemConciliacao(BaseModel):
    data: date
    historico: str
    valor: float
    tipo: str  # debito, credito
    conciliado: bool = False
    lancamento_id: Optional[str] = None

class ConciliacaoBancaria(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    empresa_id: str
    empresa: str
    conta_bancaria: str
    periodo: str  # YYYY-MM
    data_inicial: date
    data_final: date
    
    # Saldos
    saldo_inicial_banco: float
    saldo_final_banco: float
    saldo_inicial_contabil: float
    saldo_final_contabil: float
    
    # Itens
    itens_banco: List[ItemConciliacao] = []
    itens_contabil: List[ItemConciliacao] = []
    
    # Diferenças
    diferencas_nao_explicadas: float = 0.0
    
    # Status
    status: str = "em_andamento"  # em_andamento, concluida
    observacoes: Optional[str] = None
    
    # Metadados
    responsavel: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Modelos para criação e atualização
class ContaContabilCreate(BaseModel):
    codigo: str
    nome: str
    tipo: TipoConta
    conta_pai: Optional[str] = None
    aceita_lancamento: bool = True
    centro_custo_obrigatorio: bool = False
    historico_padrao: Optional[str] = None
    descricao: Optional[str] = None

class ContaContabilUpdate(BaseModel):
    nome: Optional[str] = None
    ativa: Optional[bool] = None
    aceita_lancamento: Optional[bool] = None
    centro_custo_obrigatorio: Optional[bool] = None
    historico_padrao: Optional[str] = None
    descricao: Optional[str] = None

class LancamentoContabilCreate(BaseModel):
    empresa_id: str
    empresa: str
    data_lancamento: date
    tipo_documento: TipoDocumento
    numero_documento: Optional[str] = None
    documento_vinculado_id: Optional[str] = None
    itens: List[LancamentoItem]
    historico_geral: str
    observacoes: Optional[str] = None

class LancamentoContabilUpdate(BaseModel):
    data_lancamento: Optional[date] = None
    status: Optional[StatusLancamento] = None
    numero_documento: Optional[str] = None
    itens: Optional[List[LancamentoItem]] = None
    historico_geral: Optional[str] = None
    observacoes: Optional[str] = None

class CentroCustoCreate(BaseModel):
    codigo: str
    nome: str
    descricao: Optional[str] = None
    centro_pai: Optional[str] = None
    empresa_id: str
    empresa: str

# Modelos para filtros
class ContabilFilters(BaseModel):
    empresa: Optional[str] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    conta_codigo: Optional[str] = None
    centro_custo: Optional[str] = None
    tipo_documento: Optional[TipoDocumento] = None
    status: Optional[StatusLancamento] = None
    responsavel: Optional[str] = None

# Modelos para relatórios
class RelatorioContabil(BaseModel):
    periodo_inicio: date
    periodo_fim: date
    total_lancamentos: int
    total_debitos: float
    total_creditos: float
    contas_mais_movimentadas: List[Dict[str, Any]]
    centros_custo_resumo: List[Dict[str, Any]]

class LivroRazao(BaseModel):
    conta_id: str
    conta_codigo: str
    conta_nome: str
    periodo_inicio: date
    periodo_fim: date
    saldo_anterior: float
    movimentacoes: List[Dict[str, Any]]
    saldo_final: float