from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum
import uuid

# Enums para melhor controle de dados
class SituacaoTitulo(str, Enum):
    EM_ABERTO = "em_aberto"
    PAGO = "pago"
    ATRASADO = "atrasado"
    RENEGOCIADO = "renegociado"
    CANCELADO = "cancelado"

class TipoDocumento(str, Enum):
    NF = "nf"
    RECIBO = "recibo"
    BOLETO = "boleto"
    DUPLICATA = "duplicata"
    PROMISSORIA = "promissoria"
    OUTROS = "outros"

class FormaPagamento(str, Enum):
    BOLETO = "boleto"
    PIX = "pix"
    TRANSFERENCIA = "transferencia"
    ESPECIE = "especie"
    CARTAO_CREDITO = "cartao_credito"
    CARTAO_DEBITO = "cartao_debito"
    CHEQUE = "cheque"
    DEPOSITO = "deposito"

class TipoHonorario(str, Enum):
    MENSAL = "mensal"
    AVULSO = "avulso"
    ANUAL = "anual"
    TRIMESTRAL = "trimestral"
    SEMESTRAL = "semestral"

class StatusPagamento(str, Enum):
    EM_DIA = "em_dia"
    ATRASADO = "atrasado"
    RENEGOCIADO = "renegociado"
    CANCELADO = "cancelado"

class TipoEmpresa(str, Enum):
    MEI = "mei"
    SIMPLES = "simples"
    LUCRO_PRESUMIDO = "lucro_presumido"
    LUCRO_REAL = "lucro_real"
    OUTROS = "outros"

class TipoPagamento(str, Enum):
    RECORRENTE = "recorrente"
    UNICO = "unico"

class EmpresaTipo(str, Enum):
    INDIVIDUAL = "individual"
    GRUPO = "grupo"

# Modelo para histórico de alterações
class HistoricoAlteracao(BaseModel):
    data: datetime = Field(default_factory=datetime.utcnow)
    acao: str  # Ex: "criado", "editado", "pago", "renegociado"
    usuario: str
    campo_alterado: Optional[str] = None
    valor_anterior: Optional[str] = None
    valor_novo: Optional[str] = None
    observacao: Optional[str] = None

# Modelo para anexos
class Anexo(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome_arquivo: str
    tipo_arquivo: str  # PDF, JPG, PNG, etc.
    caminho_arquivo: str
    tamanho_arquivo: int  # em bytes
    data_upload: datetime = Field(default_factory=datetime.utcnow)
    usuario_upload: str

# Modelo para contatos de cobrança
class ContatoCobranca(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data_contato: datetime = Field(default_factory=datetime.utcnow)
    tipo_contato: str  # whatsapp, email, telefone, visita
    usuario_responsavel: str
    observacao: str
    resultado: Optional[str] = None  # Ex: "não atendeu", "prometeu pagar", "renegociou"

# Modelo principal para Contas a Receber
class ContaReceber(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Dados da empresa
    empresa_id: str
    empresa: str
    
    # Status do título
    situacao: SituacaoTitulo = SituacaoTitulo.EM_ABERTO
    
    # Dados do documento
    descricao: str
    documento: str
    tipo_documento: TipoDocumento = TipoDocumento.BOLETO
    
    # Dados de pagamento
    forma_pagamento: FormaPagamento
    conta: str  # Banco interno cadastrado
    centro_custo: str
    plano_custo: str
    
    # Datas
    data_emissao: date
    data_vencimento: date
    data_recebimento: Optional[date] = None
    
    # Valores
    valor_original: float
    desconto_aplicado: float = 0.0
    acrescimo_aplicado: float = 0.0
    valor_quitado: float = 0.0
    troco: float = 0.0
    
    # Campos calculados
    total_bruto: Optional[float] = None
    total_liquido: Optional[float] = None
    
    # Localização e responsáveis
    cidade_atendimento: str
    usuario_responsavel: str
    
    # Observações
    observacao: Optional[str] = None
    
    # Histórico e anexos
    historico_alteracoes: List[HistoricoAlteracao] = []
    contatos_cobranca: List[ContatoCobranca] = []
    anexos: List[Anexo] = []
    
    # Metadados
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    @validator('total_bruto', always=True)
    def calculate_total_bruto(cls, v, values):
        if 'valor_original' in values and 'acrescimo_aplicado' in values:
            return values['valor_original'] + values['acrescimo_aplicado']
        return v
    
    @validator('total_liquido', always=True)
    def calculate_total_liquido(cls, v, values):
        if 'total_bruto' in values and values['total_bruto'] is not None and 'desconto_aplicado' in values:
            return values['total_bruto'] - values['desconto_aplicado']
        return v

# Modelos para criação e atualização
class ContaReceberCreate(BaseModel):
    empresa_id: str
    empresa: str
    descricao: str
    documento: str
    tipo_documento: TipoDocumento = TipoDocumento.BOLETO
    forma_pagamento: FormaPagamento
    conta: str
    centro_custo: str
    plano_custo: str
    data_emissao: date
    data_vencimento: date
    valor_original: float
    observacao: Optional[str] = None
    cidade_atendimento: str
    usuario_responsavel: str

class ContaReceberUpdate(BaseModel):
    empresa_id: Optional[str] = None
    empresa: Optional[str] = None
    situacao: Optional[SituacaoTitulo] = None
    descricao: Optional[str] = None
    documento: Optional[str] = None
    tipo_documento: Optional[TipoDocumento] = None
    forma_pagamento: Optional[FormaPagamento] = None
    conta: Optional[str] = None
    centro_custo: Optional[str] = None
    plano_custo: Optional[str] = None
    data_emissao: Optional[date] = None
    data_vencimento: Optional[date] = None
    valor_original: Optional[float] = None
    desconto_aplicado: Optional[float] = None
    acrescimo_aplicado: Optional[float] = None
    valor_quitado: Optional[float] = None
    troco: Optional[float] = None
    cidade_atendimento: Optional[str] = None
    data_recebimento: Optional[date] = None
    observacao: Optional[str] = None
    usuario_responsavel: Optional[str] = None

class PagamentoTitulo(BaseModel):
    data_recebimento: date
    valor_recebido: float
    forma_pagamento: FormaPagamento
    desconto_aplicado: float = 0.0
    acrescimo_aplicado: float = 0.0
    troco: float = 0.0
    observacao: Optional[str] = None
    usuario_responsavel: str

# Modelo para Cliente Financeiro
class FinancialClient(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    empresa_id: str
    empresa: str
    client_id: Optional[str] = None
    empresa_nome: Optional[str] = None
    cnpj: Optional[str] = None
    cidade: Optional[str] = None
    valor_com_desconto: float
    valor_boleto: float
    dia_vencimento: int = Field(..., ge=1, le=31)
    tipo_honorario: TipoHonorario
    empresa_individual_grupo: EmpresaTipo
    contas_pagamento: List[str]
    tipo_pagamento: TipoPagamento
    forma_pagamento_especial: Optional[str] = None
    tipo_pagamento_especial: Optional[str] = None
    tipo_empresa: TipoEmpresa
    responsavel_financeiro: Optional[str] = None
    quantidade_funcionarios: Optional[int] = 0
    status_fiscal: Optional[str] = "sem_movimento"
    capacidade_pagamento: Optional[str] = "paga_em_dia"
    status_cliente: Optional[str] = "ativa"
    data_vencimento: Optional[str] = None
    valor_desconto: Optional[float] = 0.0
    ultimo_pagamento: Optional[date] = None
    status_pagamento: StatusPagamento = StatusPagamento.EM_DIA
    observacoes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class FinancialClientCreate(BaseModel):
    empresa_id: str
    empresa: str
    client_id: Optional[str] = None
    empresa_nome: Optional[str] = None
    cnpj: Optional[str] = None
    cidade: Optional[str] = None
    valor_com_desconto: float
    valor_boleto: float
    dia_vencimento: int = Field(..., ge=1, le=31)
    tipo_honorario: TipoHonorario
    empresa_individual_grupo: EmpresaTipo
    contas_pagamento: List[str]
    tipo_pagamento: TipoPagamento
    forma_pagamento_especial: Optional[str] = None
    tipo_pagamento_especial: Optional[str] = None
    tipo_empresa: TipoEmpresa
    responsavel_financeiro: Optional[str] = None
    quantidade_funcionarios: Optional[int] = 0
    status_fiscal: Optional[str] = "sem_movimento"
    capacidade_pagamento: Optional[str] = "paga_em_dia"
    status_cliente: Optional[str] = "ativa"
    data_vencimento: Optional[str] = None
    valor_desconto: Optional[float] = 0.0
    status_pagamento: Optional[StatusPagamento] = StatusPagamento.EM_DIA
    observacoes: Optional[str] = None

class FinancialClientUpdate(BaseModel):
    client_id: Optional[str] = None
    empresa_nome: Optional[str] = None
    cnpj: Optional[str] = None
    cidade: Optional[str] = None
    valor_com_desconto: Optional[float] = None
    valor_boleto: Optional[float] = None
    valor_desconto: Optional[float] = None
    data_vencimento: Optional[str] = None
    dia_vencimento: Optional[int] = Field(None, ge=1, le=31)
    tipo_honorario: Optional[TipoHonorario] = None
    empresa_individual_grupo: Optional[EmpresaTipo] = None
    contas_pagamento: Optional[List[str]] = None
    tipo_pagamento: Optional[TipoPagamento] = None
    forma_pagamento_especial: Optional[str] = None
    tipo_pagamento_especial: Optional[str] = None
    tipo_empresa: Optional[TipoEmpresa] = None
    status_pagamento: Optional[StatusPagamento] = None
    responsavel_financeiro: Optional[str] = None
    quantidade_funcionarios: Optional[int] = None
    status_fiscal: Optional[str] = None
    capacidade_pagamento: Optional[str] = None
    status_cliente: Optional[str] = None
    observacoes: Optional[str] = None

# Modelos para filtros e busca
class ContaReceberFilters(BaseModel):
    empresa: Optional[str] = None
    cnpj: Optional[str] = None
    cidade: Optional[str] = None
    situacao: Optional[List[SituacaoTitulo]] = None
    data_vencimento_inicio: Optional[date] = None
    data_vencimento_fim: Optional[date] = None
    valor_minimo: Optional[float] = None
    valor_maximo: Optional[float] = None
    usuario_responsavel: Optional[str] = None
    forma_pagamento: Optional[List[FormaPagamento]] = None

# Modelos para relatórios
class RelatorioFinanceiro(BaseModel):
    periodo_inicio: date
    periodo_fim: date
    total_titulos: int
    valor_total_original: float
    valor_total_recebido: float
    valor_total_em_aberto: float
    valor_total_atrasado: float
    taxa_inadimplencia: float
    total_por_situacao: Dict[str, Dict[str, Any]]  # situacao -> {count, valor}
    total_por_cidade: Dict[str, Dict[str, Any]]
    total_por_forma_pagamento: Dict[str, Dict[str, Any]]

# Modelos para Cobrança
class ContatoCobrancaCreate(BaseModel):
    titulo_id: str
    tipo_contato: str
    observacao: str
    resultado: Optional[str] = None
    usuario_responsavel: str

class PropostaRenegociacao(BaseModel):
    titulo_id: str
    nova_data_vencimento: date
    novo_valor: float
    desconto_proposto: float = 0.0
    condicoes: str
    observacao: Optional[str] = None
    usuario_responsavel: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Modelos para Importação de Extrato
class MovimentoExtrato(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data_movimento: date
    descricao_original: str
    descricao_processada: str
    valor: float
    tipo_movimento: str  # credito, debito
    saldo: Optional[float] = None
    cnpj_detectado: Optional[str] = None
    empresa_sugerida: Optional[str] = None
    titulo_sugerido: Optional[str] = None
    score_match: Optional[float] = None
    status_classificacao: str = "pendente"  # pendente, classificado, ignorado
    classificado_por: Optional[str] = None
    data_classificacao: Optional[datetime] = None

class ImportacaoExtrato(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome_arquivo: str
    tipo_arquivo: str  # PDF, CSV
    conta_bancaria: str
    cidade: str
    usuario_responsavel: str
    data_importacao: datetime = Field(default_factory=datetime.utcnow)
    total_movimentos: int
    movimentos_processados: int = 0
    baixas_automaticas: int = 0
    pendentes_classificacao: int = 0
    status: str = "processando"  # processando, concluido, erro
    movimentos: List[MovimentoExtrato] = []
    log_processamento: List[str] = []

class ClassificacaoMovimento(BaseModel):
    movimento_id: str
    acao: str  # associar_titulo, nova_empresa, ignorar, transferencia_interna
    titulo_id: Optional[str] = None
    empresa_id: Optional[str] = None
    observacao: Optional[str] = None
    usuario_responsavel: str
