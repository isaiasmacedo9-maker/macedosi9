from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum
import uuid

# Enums para controle de dados
class StatusOportunidade(str, Enum):
    LEAD = "lead"
    QUALIFICADO = "qualificado"
    PROPOSTA_ENVIADA = "proposta_enviada"
    NEGOCIANDO = "negociando"
    GANHO = "ganho"
    PERDIDO = "perdido"
    CANCELADO = "cancelado"

class TipoContato(str, Enum):
    TELEFONE = "telefone"
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    VISITA = "visita"
    REUNIAO = "reuniao"
    VIDEOCONFERENCIA = "videoconferencia"

class StatusProposta(str, Enum):
    RASCUNHO = "rascunho"
    ENVIADA = "enviada"
    VISUALIZADA = "visualizada"
    APROVADA = "aprovada"
    REJEITADA = "rejeitada"
    EXPIRADA = "expirada"

class TipoServico(str, Enum):
    CONTABILIDADE = "contabilidade"
    FISCAL = "fiscal"
    TRABALHISTA = "trabalhista"
    CONSULTORIA = "consultoria"
    ABERTURA_EMPRESA = "abertura_empresa"
    OUTROS = "outros"

class OrigemLead(str, Enum):
    WEBSITE = "website"
    INDICACAO = "indicacao"
    MARKETING = "marketing"
    TELEFONE = "telefone"
    EMAIL = "email"
    REDE_SOCIAL = "rede_social"
    EVENTO = "evento"
    OUTROS = "outros"

# Modelos para itens de proposta
class ItemProposta(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    descricao: str
    tipo_servico: TipoServico
    quantidade: float = 1.0
    valor_unitario: float
    desconto: float = 0.0
    valor_total: Optional[float] = None
    observacoes: Optional[str] = None

    @validator('valor_total', always=True)
    def calculate_valor_total(cls, v, values):
        if 'quantidade' in values and 'valor_unitario' in values and 'desconto' in values:
            total = values['quantidade'] * values['valor_unitario']
            return total - values['desconto']
        return v

# Modelo para registro de contatos/visitas
class ContatoComercial(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data_contato: datetime = Field(default_factory=datetime.utcnow)
    tipo_contato: TipoContato
    responsavel: str
    cliente_contato: Optional[str] = None  # Pessoa que atendeu
    resumo: str
    observacoes: Optional[str] = None
    proxima_acao: Optional[str] = None
    data_proxima_acao: Optional[date] = None
    anexos: List[str] = []

# Modelo para oportunidades
class Oportunidade(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    titulo: str
    empresa_id: Optional[str] = None  # Se já é cliente
    empresa_nome: str
    cnpj: Optional[str] = None
    contato_nome: str
    contato_email: Optional[str] = None
    contato_telefone: Optional[str] = None
    
    # Dados da oportunidade
    status: StatusOportunidade = StatusOportunidade.LEAD
    probabilidade: int = Field(default=10, ge=0, le=100)  # Percentual
    valor_estimado: float = 0.0
    data_fechamento_prevista: Optional[date] = None
    origem: OrigemLead = OrigemLead.OUTROS
    
    # Detalhes
    descricao: str
    necessidades: Optional[str] = None
    servicos_interesse: List[TipoServico] = []
    concorrentes: Optional[str] = None
    motivo_ganho_perda: Optional[str] = None
    
    # Responsabilidade
    responsavel: str
    cidade: str
    
    # Relacionamentos
    proposta_id: Optional[str] = None
    contrato_id: Optional[str] = None
    
    # Histórico de contatos
    contatos: List[ContatoComercial] = []
    
    # Tags e categorização
    tags: List[str] = []
    
    # Metadados
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Modelo para propostas
class Proposta(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    oportunidade_id: str
    numero_proposta: str
    titulo: str
    empresa_nome: str
    contato_nome: str
    
    # Status e datas
    status: StatusProposta = StatusProposta.RASCUNHO
    data_envio: Optional[datetime] = None
    data_visualizacao: Optional[datetime] = None
    data_resposta: Optional[datetime] = None
    validade: date
    
    # Conteúdo da proposta
    introducao: Optional[str] = None
    itens: List[ItemProposta] = []
    valor_subtotal: Optional[float] = None
    desconto_geral: float = 0.0
    valor_total: Optional[float] = None
    
    # Condições
    condicoes_pagamento: Optional[str] = None
    prazo_execucao: Optional[str] = None
    observacoes: Optional[str] = None
    
    # Template e formatação
    template_id: Optional[str] = None
    arquivo_pdf: Optional[str] = None
    
    # Assinatura
    assinado: bool = False
    data_assinatura: Optional[datetime] = None
    arquivo_assinado: Optional[str] = None
    
    # Responsável
    responsavel: str
    
    # Metadados
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @validator('valor_subtotal', always=True)
    def calculate_subtotal(cls, v, values):
        if 'itens' in values and values['itens']:
            return sum(item.valor_total or 0 for item in values['itens'])
        return v or 0

    @validator('valor_total', always=True)
    def calculate_total(cls, v, values):
        if 'valor_subtotal' in values and 'desconto_geral' in values:
            subtotal = values['valor_subtotal'] or 0
            return subtotal - values['desconto_geral']
        return v

# Modelo para templates de proposta
class TemplateProposta(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    descricao: Optional[str] = None
    introducao: str
    condicoes_pagamento: str
    prazo_execucao: str
    observacoes: Optional[str] = None
    itens_padrao: List[ItemProposta] = []
    ativo: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Modelos para criação e atualização
class OportunidadeCreate(BaseModel):
    titulo: str
    empresa_nome: str
    cnpj: Optional[str] = None
    contato_nome: str
    contato_email: Optional[str] = None
    contato_telefone: Optional[str] = None
    valor_estimado: float = 0.0
    data_fechamento_prevista: Optional[date] = None
    origem: OrigemLead = OrigemLead.OUTROS
    descricao: str
    necessidades: Optional[str] = None
    servicos_interesse: List[TipoServico] = []
    responsavel: str
    cidade: str
    tags: List[str] = []

class OportunidadeUpdate(BaseModel):
    titulo: Optional[str] = None
    empresa_nome: Optional[str] = None
    contato_nome: Optional[str] = None
    contato_email: Optional[str] = None
    contato_telefone: Optional[str] = None
    status: Optional[StatusOportunidade] = None
    probabilidade: Optional[int] = Field(None, ge=0, le=100)
    valor_estimado: Optional[float] = None
    data_fechamento_prevista: Optional[date] = None
    descricao: Optional[str] = None
    necessidades: Optional[str] = None
    servicos_interesse: Optional[List[TipoServico]] = None
    concorrentes: Optional[str] = None
    motivo_ganho_perda: Optional[str] = None
    tags: Optional[List[str]] = None

class PropostaCreate(BaseModel):
    oportunidade_id: str
    titulo: str
    validade: date
    introducao: Optional[str] = None
    itens: List[ItemProposta] = []
    desconto_geral: float = 0.0
    condicoes_pagamento: Optional[str] = None
    prazo_execucao: Optional[str] = None
    observacoes: Optional[str] = None
    template_id: Optional[str] = None

class PropostaUpdate(BaseModel):
    titulo: Optional[str] = None
    status: Optional[StatusProposta] = None
    validade: Optional[date] = None
    introducao: Optional[str] = None
    itens: Optional[List[ItemProposta]] = None
    desconto_geral: Optional[float] = None
    condicoes_pagamento: Optional[str] = None
    prazo_execucao: Optional[str] = None
    observacoes: Optional[str] = None
    assinado: Optional[bool] = None

class ContatoComercialCreate(BaseModel):
    tipo_contato: TipoContato
    cliente_contato: Optional[str] = None
    resumo: str
    observacoes: Optional[str] = None
    proxima_acao: Optional[str] = None
    data_proxima_acao: Optional[date] = None

# Modelos para filtros
class ComercialFilters(BaseModel):
    empresa: Optional[str] = None
    status: Optional[List[StatusOportunidade]] = None
    responsavel: Optional[str] = None
    cidade: Optional[str] = None
    origem: Optional[List[OrigemLead]] = None
    servicos: Optional[List[TipoServico]] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    valor_minimo: Optional[float] = None
    valor_maximo: Optional[float] = None
    tags: Optional[List[str]] = None

# Modelos para relatórios
class RelatorioComercial(BaseModel):
    periodo_inicio: date
    periodo_fim: date
    total_oportunidades: int
    oportunidades_ganhas: int
    oportunidades_perdidas: int
    valor_total_pipeline: float
    valor_total_ganho: float
    taxa_conversao: float
    ticket_medio: float
    tempo_medio_fechamento: Optional[float] = None  # em dias
    por_status: Dict[str, int]
    por_origem: Dict[str, int]
    por_servico: Dict[str, int]
    por_responsavel: Dict[str, Dict[str, Any]]

class Pipeline(BaseModel):
    total_oportunidades: int
    valor_total: float
    por_estagio: Dict[str, Dict[str, Any]]  # status -> {count, valor, probabilidade_media}
    previsao_fechamento: Dict[str, float]  # mes -> valor estimado