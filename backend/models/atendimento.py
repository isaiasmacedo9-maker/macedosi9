from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from enum import Enum
import uuid

# Enums para controle de dados
class StatusTicket(str, Enum):
    ABERTO = "aberto"
    EM_ANDAMENTO = "em_andamento"
    AGUARDANDO_CLIENTE = "aguardando_cliente"
    RESOLVIDO = "resolvido"
    FECHADO = "fechado"
    CANCELADO = "cancelado"

class PrioridadeTicket(str, Enum):
    BAIXA = "baixa"
    MEDIA = "media"
    ALTA = "alta"
    URGENTE = "urgente"
    CRITICA = "critica"

class CanalAtendimento(str, Enum):
    TELEFONE = "telefone"
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    CHAT = "chat"
    PRESENCIAL = "presencial"
    PORTAL = "portal"

class TipoTicket(str, Enum):
    DUVIDA = "duvida"
    PROBLEMA = "problema"
    SOLICITACAO = "solicitacao"
    RECLAMACAO = "reclamacao"
    SUGESTAO = "sugestao"
    CONTABIL = "contabil"
    FISCAL = "fiscal"
    TRABALHISTA = "trabalhista"
    FINANCEIRO = "financeiro"

class TipoResposta(str, Enum):
    RESPOSTA = "resposta"
    NOTA_INTERNA = "nota_interna"
    ENCAMINHAMENTO = "encaminhamento"
    RESOLUCAO = "resolucao"

# Modelo para conversas (expandido)
class Conversa(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data: datetime = Field(default_factory=datetime.utcnow)
    usuario: str
    mensagem: str
    tipo: TipoResposta = TipoResposta.RESPOSTA
    eh_cliente: bool = False
    eh_publico: bool = True
    anexos: List[str] = []
    editado: bool = False
    data_edicao: Optional[datetime] = None

# Modelo expandido para tickets
class Ticket(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    numero: Optional[str] = None  # Número sequencial público
    
    # Dados do solicitante (expandido)
    empresa_id: str
    empresa: str
    solicitante_nome: Optional[str] = None
    solicitante_email: Optional[str] = None
    solicitante_telefone: Optional[str] = None
    
    # Dados do ticket (expandido)
    titulo: str
    descricao: str
    tipo: TipoTicket = TipoTicket.DUVIDA
    categoria: Optional[str] = None
    prioridade: PrioridadeTicket = PrioridadeTicket.MEDIA
    status: StatusTicket = StatusTicket.ABERTO
    responsavel: str
    equipe: Optional[str] = None
    canal: CanalAtendimento
    
    # Datas e prazos (expandido)
    data_abertura: date
    data_primeira_resposta: Optional[datetime] = None
    data_resolucao: Optional[datetime] = None
    data_fechamento: Optional[datetime] = None
    sla: datetime  # Mantido para compatibilidade
    prazo_primeira_resposta: Optional[datetime] = None
    prazo_resolucao: Optional[datetime] = None
    
    # SLA status
    sla_primeira_resposta_violado: bool = False
    sla_resolucao_violado: bool = False
    tempo_primeira_resposta: Optional[int] = None  # minutos
    tempo_resolucao: Optional[int] = None  # minutos
    
    # Resolução e feedback
    solucao: Optional[str] = None
    satisfacao_cliente: Optional[int] = Field(None, ge=1, le=5)
    feedback_cliente: Optional[str] = None
    
    # Relacionamentos e tags
    tags: List[str] = []
    tickets_relacionados: List[str] = []
    documentos_relacionados: List[str] = []
    
    # Conversas e arquivos (mantidos para compatibilidade)
    conversas: List[Conversa] = []
    arquivos: List[str] = []  # Mantido para compatibilidade
    
    # Histórico de mudanças
    historico_status: List[Dict[str, Any]] = []
    
    # Metadados
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Modelo para base de conhecimento
class ArtigoBaseConhecimento(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    titulo: str
    conteudo: str
    resumo: Optional[str] = None
    categoria: str
    tags: List[str] = []
    publicado: bool = False
    visivel_cliente: bool = False
    visualizacoes: int = 0
    avaliacoes_positivas: int = 0
    avaliacoes_negativas: int = 0
    tickets_relacionados: List[str] = []
    autor: str
    data_publicacao: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Modelo para avaliação
class AvaliacaoAtendimento(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticket_id: str
    empresa_id: Optional[str] = None
    cliente_nome: str
    cliente_email: str
    satisfacao_geral: int = Field(..., ge=1, le=5)
    satisfacao_atendimento: int = Field(..., ge=1, le=5)
    satisfacao_tempo_resposta: int = Field(..., ge=1, le=5)
    satisfacao_resolucao: int = Field(..., ge=1, le=5)
    comentarios: Optional[str] = None
    sugestoes: Optional[str] = None
    recomendaria_servico: int = Field(..., ge=0, le=10)  # NPS
    data_avaliacao: datetime = Field(default_factory=datetime.utcnow)

# Modelos de criação e atualização (expandidos)
class TicketCreate(BaseModel):
    empresa_id: str
    empresa: str
    solicitante_nome: Optional[str] = None
    solicitante_email: Optional[str] = None
    solicitante_telefone: Optional[str] = None
    titulo: str
    descricao: str
    tipo: TipoTicket = TipoTicket.DUVIDA
    categoria: Optional[str] = None
    prioridade: PrioridadeTicket = PrioridadeTicket.MEDIA
    responsavel: str
    equipe: Optional[str] = None
    canal: CanalAtendimento
    data_abertura: date
    tags: List[str] = []

class TicketUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    tipo: Optional[TipoTicket] = None
    categoria: Optional[str] = None
    prioridade: Optional[PrioridadeTicket] = None
    status: Optional[StatusTicket] = None
    responsavel: Optional[str] = None
    equipe: Optional[str] = None
    solucao: Optional[str] = None
    tags: Optional[List[str]] = None

class ConversaCreate(BaseModel):
    mensagem: str
    tipo: TipoResposta = TipoResposta.RESPOSTA
    eh_publico: bool = True
    anexos: List[str] = []

class ArtigoBaseConhecimentoCreate(BaseModel):
    titulo: str
    conteudo: str
    resumo: Optional[str] = None
    categoria: str
    tags: List[str] = []
    publicado: bool = False
    visivel_cliente: bool = False

# Modelos para filtros
class AtendimentoFilters(BaseModel):
    empresa: Optional[str] = None
    status: Optional[List[StatusTicket]] = None
    prioridade: Optional[List[PrioridadeTicket]] = None
    tipo: Optional[List[TipoTicket]] = None
    responsavel: Optional[str] = None
    equipe: Optional[str] = None
    canal: Optional[List[CanalAtendimento]] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    sla_violado: Optional[bool] = None
    tags: Optional[List[str]] = None

# Modelos para relatórios
class RelatorioAtendimento(BaseModel):
    periodo_inicio: date
    periodo_fim: date
    total_tickets: int
    tickets_resolvidos: int
    tickets_em_aberto: int
    taxa_resolucao: float
    tempo_medio_primeira_resposta: float
    tempo_medio_resolucao: float
    satisfacao_media: float
    nps_medio: float
    violacoes_sla: int
    por_status: Dict[str, int]
    por_prioridade: Dict[str, int]
    por_tipo: Dict[str, int]
    por_canal: Dict[str, int]
    por_responsavel: Dict[str, Dict[str, Any]]

class DashboardAtendimento(BaseModel):
    tickets_abertos: int
    tickets_vencidos: int
    tempo_medio_resposta: float
    satisfacao_media: float
    tickets_por_equipe: Dict[str, int]
    tendencia_volume: List[Dict[str, Any]]
    principais_categorias: List[Dict[str, Any]]