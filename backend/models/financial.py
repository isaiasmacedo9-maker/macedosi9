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

class ContaReceberCreate(BaseModel):
    empresa_id: str
    empresa: str
    descricao: str
    documento: str
    forma_pagamento: str
    conta: str
    centro_custo: str
    plano_custo: str
    data_emissao: date
    data_vencimento: date
    valor_original: float
    observacao: Optional[str] = None
    cidade_atendimento: str
    usuario_responsavel: str

class FinancialClient(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    empresa_id: str
    empresa: str
    valor_com_desconto: float
    valor_boleto: float
    dia_vencimento: int = Field(..., ge=1, le=31)
    tipo_honorario: str = Field(..., pattern="^(mensal|avulso|anual)$")
    empresa_individual_grupo: str = Field(..., pattern="^(individual|grupo)$")
    contas_pagamento: List[str]
    tipo_pagamento: str = Field(..., pattern="^(recorrente|unico)$")
    forma_pagamento_especial: Optional[str] = None
    tipo_empresa: str
    ultimo_pagamento: Optional[date] = None
    status_pagamento: str = Field(..., pattern="^(em_dia|atrasado|renegociado)$")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class FinancialClientCreate(BaseModel):
    empresa_id: str
    empresa: str
    valor_com_desconto: float
    valor_boleto: float
    dia_vencimento: int = Field(..., ge=1, le=31)
    tipo_honorario: str = Field(..., pattern="^(mensal|avulso|anual)$")
    empresa_individual_grupo: str = Field(..., pattern="^(individual|grupo)$")
    contas_pagamento: List[str]
    tipo_pagamento: str = Field(..., pattern="^(recorrente|unico)$")
    forma_pagamento_especial: Optional[str] = None
    tipo_empresa: str
    status_pagamento: str = Field(default="em_dia", pattern="^(em_dia|atrasado|renegociado)$")