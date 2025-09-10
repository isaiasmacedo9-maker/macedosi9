from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, date
from enum import Enum
import uuid

# Enums para validação
class UserRole(str, Enum):
    ADMIN = "admin"
    COLABORADOR = "colaborador"

class CompanyStatus(str, Enum):
    ATIVA = "ativa"
    INATIVA = "inativa"
    SUSPENSA = "suspensa"

class TaskStatus(str, Enum):
    PENDENTE = "pendente"
    EM_ANDAMENTO = "em_andamento"
    CONCLUIDA = "concluida"
    ATRASADA = "atrasada"
    CANCELADA = "cancelada"

class AccountReceivableStatus(str, Enum):
    EM_ABERTO = "em_aberto"
    PAGO = "pago"
    ATRASADO = "atrasado"
    RENEGOCIADO = "renegociado"
    CANCELADO = "cancelado"

class TicketStatus(str, Enum):
    ABERTO = "aberto"
    EM_ANDAMENTO = "em_andamento"
    RESOLVIDO = "resolvido"
    FECHADO = "fechado"
    AGUARDANDO_CLIENTE = "aguardando_cliente"

class Priority(str, Enum):
    BAIXA = "baixa"
    MEDIA = "media"
    ALTA = "alta"
    URGENTE = "urgente"

# Modelos base
class BaseModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

# Modelos de usuário e autenticação
class User(BaseModel):
    email: EmailStr
    name: str
    password_hash: str
    role: UserRole
    allowed_cities: List[str] = []
    allowed_sectors: List[str] = []
    is_active: bool = True
    last_login: Optional[datetime] = None
    login_count: int = 0

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    allowed_cities: List[str]
    allowed_sectors: List[str]
    is_active: bool
    last_login: Optional[datetime]

# Modelos de empresa
class Address(BaseModel):
    logradouro: str
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: str
    distrito: Optional[str] = None
    cep: str
    cidade: str
    estado: str

class Company(BaseModel):
    nome_empresa: str
    nome_fantasia: str
    status: CompanyStatus
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
    tags: List[str] = []
    documentos_obrigatorios: List[str] = []
    documentos_entregues: List[str] = []

# Modelos financeiros
class HistoricoAction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data: datetime
    acao: str
    usuario: str
    observacao: Optional[str] = None
    valor: Optional[float] = None

class AccountReceivable(BaseModel):
    empresa_id: str
    empresa: str
    situacao: AccountReceivableStatus
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
    data_recebimento: Optional[date] = None
    desconto_aplicado: float = 0.0
    acrescimo_aplicado: float = 0.0
    valor_quitado: float = 0.0
    troco: float = 0.0
    total_bruto: float
    total_liquido: float
    usuario_responsavel: str
    historico: List[HistoricoAction] = []
    multa_juros: float = 0.0
    dias_atraso: int = 0
    score_risco: int = 0  # 0-100

class FinancialClient(BaseModel):
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
    credito_futuro: float = 0.0
    meta_mensal: float = 0.0

# Modelos de tarefas
class TaskComment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    usuario_id: str
    usuario_nome: str
    comentario: str
    timestamp: datetime = Field(default_factory=datetime.now)
    arquivos: List[str] = []

class Task(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDENTE
    prioridade: Priority = Priority.MEDIA
    categoria: str = Field(..., pattern="^(comercial|financeiro|trabalhista|fiscal|contabil|atendimento)$")
    responsavel_id: str
    responsavel_nome: str
    criador_id: str
    criador_nome: str
    empresa_id: Optional[str] = None
    empresa_nome: Optional[str] = None
    data_prazo: Optional[date] = None
    data_conclusao: Optional[datetime] = None
    progresso: int = Field(default=0, ge=0, le=100)
    tempo_gasto: int = 0  # em minutos
    comentarios: List[TaskComment] = []
    tags: List[str] = []
    arquivos: List[str] = []
    checklist: List[Dict[str, Any]] = []  # [{item: str, concluido: bool}]
    recorrente: bool = False
    cidade: str

# Modelos de atendimento
class Conversa(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data: datetime
    usuario: str
    mensagem: str
    tipo: str = "text"  # text, file, image
    arquivo_url: Optional[str] = None

class Ticket(BaseModel):
    empresa_id: str
    empresa: str
    titulo: str
    descricao: str
    prioridade: Priority
    status: TicketStatus = TicketStatus.ABERTO
    responsavel: str
    canal: str = Field(..., pattern="^(telefone|email|whatsapp|chat|presencial)$")
    data_abertura: date
    sla: datetime
    conversas: List[Conversa] = []
    arquivos: List[str] = []
    tempo_resposta: Optional[int] = None  # em minutos
    satisfacao_cliente: Optional[int] = None  # 1-5
    custo_atendimento: float = 0.0
    cidade: str

# Modelos comerciais
class Opportunity(BaseModel):
    company_id: str
    titulo: str
    descricao: str
    valor_proposto: float
    status: str = Field(..., pattern="^(lead|proposta_enviada|negociando|ganho|perdido)$")
    probabilidade: int = Field(default=50, ge=0, le=100)
    responsavel_id: str
    responsavel_nome: str
    etapa_pipeline: str
    data_contato: Optional[date] = None
    data_fechamento_prevista: Optional[date] = None
    notas: List[str] = []
    arquivos: List[str] = []
    tags: List[str] = []
    origem: str  # indicação, site, telefone, etc
    cidade: str

class Proposal(BaseModel):
    opportunity_id: str
    template_id: Optional[str] = None
    itens: List[Dict[str, Any]]  # [{descricao, qty, valor_unitario}]
    valor_total: float
    validade: date
    status: str = Field(..., pattern="^(rascunho|enviada|aceita|rejeitada|vencida)$")
    assinada: bool = False
    data_assinatura: Optional[date] = None
    observacoes: str = ""

# Modelos trabalhistas
class FuncionarioData(BaseModel):
    nome: str
    cpf: str
    funcao: str
    salario: Optional[float] = None
    data_admissao: Optional[date] = None
    data_demissao: Optional[date] = None
    motivo_demissao: Optional[str] = None

class TrabalhistaRequest(BaseModel):
    empresa_id: str
    empresa: str
    tipo: str = Field(..., pattern="^(admissao|demissao|folha|afastamento|reclamacao|ferias)$")
    descricao: str
    data_solicitacao: date
    prazo: date
    responsavel: str
    status: str = Field(..., pattern="^(pendente|em_andamento|concluido|atrasado)$")
    funcionario: Optional[FuncionarioData] = None
    arquivos: List[str] = []
    observacoes: Optional[str] = None
    valor_envolvido: Optional[float] = None
    cidade: str

# Modelos fiscais
class FiscalObligation(BaseModel):
    empresa_id: str
    empresa: str
    tipo: str = Field(..., pattern="^(pgdas|dctf|sped|defis|darf|gfip|esocial)$")
    nome: str
    periodicidade: str = Field(..., pattern="^(mensal|trimestral|semestral|anual|evento)$")
    vencimento: date
    status: str = Field(..., pattern="^(pendente|em_andamento|entregue|atrasado)$")
    responsavel: str
    documentos: List[str] = []
    valor: Optional[float] = None
    data_entrega: Optional[date] = None
    observacoes: Optional[str] = None
    cidade: str

# Modelos contábeis
class ChartAccount(BaseModel):
    codigo: str
    nome: str
    tipo: str = Field(..., pattern="^(ativo|passivo|receita|despesa|patrimonio)$")
    nivel: int
    conta_pai: Optional[str] = None
    aceita_lancamento: bool = True

class AccountingEntry(BaseModel):
    empresa_id: str
    empresa: str
    data: date
    descricao: str
    documento: str
    debitos: List[Dict[str, Any]]  # [{conta_id, valor}]
    creditos: List[Dict[str, Any]]  # [{conta_id, valor}]
    valor_total: float
    responsavel: str
    tipo_lancamento: str = "manual"  # manual, automatico
    origem_id: Optional[str] = None  # ID do documento origem
    cidade: str

# Modelos de chat
class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    usuario_id: str
    usuario_nome: str
    mensagem: str
    timestamp: datetime = Field(default_factory=datetime.now)
    tipo: str = Field(default="text", pattern="^(text|file|image|system)$")
    arquivo_url: Optional[str] = None
    editada: bool = False
    importante: bool = False

class Chat(BaseModel):
    nome: str
    descricao: Optional[str] = None
    tipo: str = Field(..., pattern="^(grupo|privado|suporte|empresa)$")
    participantes: List[str] = []
    admin_id: str
    empresa_id: Optional[str] = None  # Chat específico de empresa
    setor: Optional[str] = None  # Chat específico de setor
    cidade: Optional[str] = None  # Chat específico de cidade
    mensagens: List[ChatMessage] = []
    ativo: bool = True

# Modelos de importação
class ImportQueueItem(BaseModel):
    arquivo_nome: str
    tipo_arquivo: str = Field(..., pattern="^(pdf|csv|ofx)$")
    linha_texto: str
    data_movimento: Optional[date] = None
    valor: Optional[float] = None
    cnpj_detectado: Optional[str] = None
    descricao_parsed: str
    status: str = Field(default="pending", pattern="^(pending|classified|ignored)$")
    candidate_matches: List[Dict[str, Any]] = []
    score_melhor_match: int = 0
    empresa_associada: Optional[str] = None
    titulo_associado: Optional[str] = None
    processado_por: Optional[str] = None
    data_processamento: Optional[datetime] = None

class MappingRule(BaseModel):
    pattern: str  # regex ou string
    tipo_pattern: str = Field(..., pattern="^(regex|exact|contains)$")
    empresa_id: str
    empresa_nome: str
    confiabilidade: int = Field(default=80, ge=0, le=100)
    uso_count: int = 0
    data_ultima_utilizacao: Optional[datetime] = None
    active: bool = True
    criado_por: str

# Modelos de configuração e relatórios
class SystemSetting(BaseModel):
    modulo: str
    chave: str
    valor: Any
    descricao: str
    tipo: str = Field(..., pattern="^(string|number|boolean|json)$")
    editavel: bool = True

class AuditLog(BaseModel):
    timestamp: datetime
    action: str
    collection: str
    record_id: str
    user_id: str
    user_name: str
    changes: Dict[str, Any] = {}
    ip_address: Optional[str] = None