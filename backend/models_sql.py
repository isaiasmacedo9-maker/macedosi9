"""
SQLAlchemy models for SQL database migration
Converte estrutura MongoDB para tabelas relacionais SQL
"""
from sqlalchemy import Column, String, Float, Integer, Boolean, Date, DateTime, Text, ForeignKey, Table, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

Base = declarative_base()

# ==================== USERS ====================
class UserSQL(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)  # admin, colaborador
    allowed_cities = Column(Text)  # JSON string
    allowed_sectors = Column(Text)  # JSON string
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ==================== CLIENTS ====================
class ClientSQL(Base):
    __tablename__ = "clients"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nome_empresa = Column(String(255), nullable=False, index=True)
    nome_fantasia = Column(String(255))
    status_empresa = Column(String(50), default="ativa")  # ativa, inativa, suspensa
    cidade_atendimento = Column(String(255), nullable=False, index=True)
    
    # Contatos
    telefone = Column(String(20))
    whatsapp = Column(String(20))
    email = Column(String(255))
    responsavel_empresa = Column(String(255))
    
    # Documentos
    cnpj = Column(String(18), unique=True, nullable=False, index=True)
    codigo_iob = Column(String(50))
    
    # Classificações
    novo_cliente = Column(Boolean, default=False)
    tipo_empresa = Column(String(50), default="matriz")  # matriz, filial
    tipo_regime = Column(String(50), nullable=False)  # mei, simples, lucro_presumido, lucro_real
    
    # Endereço (desnormalizado)
    endereco_logradouro = Column(String(255))
    endereco_numero = Column(String(20))
    endereco_complemento = Column(String(255))
    endereco_bairro = Column(String(255))
    endereco_distrito = Column(String(255))
    endereco_cep = Column(String(10))
    endereco_cidade = Column(String(255))
    endereco_estado = Column(String(2))
    
    # Configurações
    forma_envio = Column(String(50), default="email")  # whatsapp, email, impresso
    empresa_grupo = Column(String(255))
    
    # Metadados
    external_task_id = Column(String(64), index=True, unique=True)
    official_locked = Column(Boolean, default=False, nullable=False)
    official_source = Column(String(50))
    official_imported_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ==================== FINANCIAL CLIENTS ====================
class FinancialClientSQL(Base):
    __tablename__ = "financial_clients"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    empresa_id = Column(String(36), nullable=False, index=True)
    empresa = Column(String(255), nullable=False)
    valor_com_desconto = Column(Float, nullable=False)
    valor_boleto = Column(Float, nullable=False)
    dia_vencimento = Column(Integer, nullable=False)
    tipo_honorario = Column(String(50), nullable=False)  # mensal, avulso, anual, trimestral, semestral
    empresa_individual_grupo = Column(String(50), nullable=False)  # individual, grupo
    contas_pagamento = Column(Text)  # JSON string list
    tipo_pagamento = Column(String(50), nullable=False)  # recorrente, unico
    forma_pagamento_especial = Column(String(255))
    tipo_empresa = Column(String(50), nullable=False)  # mei, simples, lucro_presumido, lucro_real, outros
    ultimo_pagamento = Column(Date)
    status_pagamento = Column(String(50), default="em_dia")  # em_dia, atrasado, renegociado, cancelado
    observacoes = Column(Text)
    external_task_id = Column(String(64), index=True)
    official_locked = Column(Boolean, default=False, nullable=False)
    official_source = Column(String(50))
    official_imported_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClientActivityLogSQL(Base):
    __tablename__ = "client_activity_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    client_id = Column(String(36), nullable=False, index=True)
    client_name = Column(String(255), nullable=False)
    action = Column(String(50), nullable=False, index=True)  # create, update, delete
    actor_id = Column(String(36), nullable=False, index=True)
    actor_name = Column(String(255), nullable=False)
    actor_email = Column(String(255))
    details = Column(Text)  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

# ==================== CONTAS A RECEBER ====================
class ContaReceberSQL(Base):
    __tablename__ = "contas_receber"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    empresa_id = Column(String(36), nullable=False, index=True)
    empresa = Column(String(255), nullable=False, index=True)
    situacao = Column(String(50), default="em_aberto", index=True)  # em_aberto, pago, atrasado, renegociado, cancelado
    
    # Dados do documento
    descricao = Column(String(500), nullable=False)
    documento = Column(String(100), nullable=False)
    tipo_documento = Column(String(50), default="boleto")  # nf, recibo, boleto, duplicata, promissoria, outros
    
    # Dados de pagamento
    forma_pagamento = Column(String(50), nullable=False)  # boleto, pix, transferencia, especie, cartao_credito, etc
    conta = Column(String(255), nullable=False)
    centro_custo = Column(String(255), nullable=False)
    plano_custo = Column(String(255), nullable=False)
    
    # Datas
    data_emissao = Column(Date, nullable=False)
    data_vencimento = Column(Date, nullable=False, index=True)
    data_recebimento = Column(Date, index=True)
    
    # Valores
    valor_original = Column(Float, nullable=False)
    desconto_aplicado = Column(Float, default=0.0)
    acrescimo_aplicado = Column(Float, default=0.0)
    valor_quitado = Column(Float, default=0.0)
    troco = Column(Float, default=0.0)
    total_bruto = Column(Float)
    total_liquido = Column(Float)
    
    # Localização e responsáveis
    cidade_atendimento = Column(String(255), nullable=False, index=True)
    usuario_responsavel = Column(String(255), nullable=False, index=True)
    
    # Observações
    observacao = Column(Text)
    
    # Metadados
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    historico = relationship("HistoricoAlteracaoSQL", back_populates="conta", cascade="all, delete-orphan")
    contatos_cobranca = relationship("ContatoCobrancaSQL", back_populates="conta", cascade="all, delete-orphan")
    anexos = relationship("AnexoSQL", back_populates="conta", cascade="all, delete-orphan")

class HistoricoAlteracaoSQL(Base):
    __tablename__ = "historico_alteracoes"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conta_id = Column(String(36), ForeignKey("contas_receber.id"), nullable=False, index=True)
    data = Column(DateTime, default=datetime.utcnow)
    acao = Column(String(100), nullable=False)
    usuario = Column(String(255), nullable=False)
    campo_alterado = Column(String(255))
    valor_anterior = Column(Text)
    valor_novo = Column(Text)
    observacao = Column(Text)
    
    conta = relationship("ContaReceberSQL", back_populates="historico")

class ContatoCobrancaSQL(Base):
    __tablename__ = "contatos_cobranca"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conta_id = Column(String(36), ForeignKey("contas_receber.id"), nullable=False, index=True)
    data_contato = Column(DateTime, default=datetime.utcnow)
    tipo_contato = Column(String(50), nullable=False)  # whatsapp, email, telefone, visita
    usuario_responsavel = Column(String(255), nullable=False)
    observacao = Column(Text, nullable=False)
    resultado = Column(String(255))
    
    conta = relationship("ContaReceberSQL", back_populates="contatos_cobranca")

class AnexoSQL(Base):
    __tablename__ = "anexos"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conta_id = Column(String(36), ForeignKey("contas_receber.id"), nullable=False, index=True)
    nome_arquivo = Column(String(255), nullable=False)
    tipo_arquivo = Column(String(50), nullable=False)
    caminho_arquivo = Column(String(500), nullable=False)
    tamanho_arquivo = Column(Integer, nullable=False)
    data_upload = Column(DateTime, default=datetime.utcnow)
    usuario_upload = Column(String(255), nullable=False)
    
    conta = relationship("ContaReceberSQL", back_populates="anexos")

# ==================== IMPORTAÇÃO DE EXTRATOS ====================
class ImportacaoExtratoSQL(Base):
    __tablename__ = "importacoes_extrato"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nome_arquivo = Column(String(255), nullable=False)
    tipo_arquivo = Column(String(10), nullable=False)  # PDF, CSV
    conta_bancaria = Column(String(255), nullable=False)
    cidade = Column(String(255), nullable=False)
    usuario_responsavel = Column(String(255), nullable=False)
    data_importacao = Column(DateTime, default=datetime.utcnow)
    total_movimentos = Column(Integer, default=0)
    movimentos_processados = Column(Integer, default=0)
    baixas_automaticas = Column(Integer, default=0)
    pendentes_classificacao = Column(Integer, default=0)
    status = Column(String(50), default="processando")  # processando, concluido, erro
    log_processamento = Column(Text)  # JSON string
    
    movimentos = relationship("MovimentoExtratoSQL", back_populates="importacao", cascade="all, delete-orphan")

class MovimentoExtratoSQL(Base):
    __tablename__ = "movimentos_extrato"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    importacao_id = Column(String(36), ForeignKey("importacoes_extrato.id"), nullable=False, index=True)
    data_movimento = Column(Date, nullable=False)
    descricao_original = Column(Text, nullable=False)
    descricao_processada = Column(Text, nullable=False)
    valor = Column(Float, nullable=False)
    tipo_movimento = Column(String(20), nullable=False)  # credito, debito
    saldo = Column(Float)
    cnpj_detectado = Column(String(18))
    empresa_sugerida = Column(String(255))
    titulo_sugerido = Column(String(36))
    score_match = Column(Float)
    status_classificacao = Column(String(50), default="pendente")  # pendente, classificado, ignorado
    classificado_por = Column(String(255))
    data_classificacao = Column(DateTime)
    
    importacao = relationship("ImportacaoExtratoSQL", back_populates="movimentos")


# ==================== IMPORTAÇÃO OFX (CONTAS A RECEBER) ====================
class ImportBatchSQL(Base):
    __tablename__ = "import_batches"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nome_arquivo = Column(String(255), nullable=False)
    banco_origem = Column(String(120), default="Cora", nullable=False)
    conta_origem = Column(String(120))
    bank_id = Column(String(60))
    hash_arquivo = Column(String(128), nullable=False, index=True)
    data_importacao = Column(DateTime, default=datetime.utcnow, index=True)
    usuario_id = Column(String(36), nullable=False, index=True)
    usuario_nome = Column(String(255), nullable=False)

    total_transacoes = Column(Integer, default=0)
    total_elegiveis = Column(Integer, default=0)
    total_lancadas = Column(Integer, default=0)
    total_nao_identificadas = Column(Integer, default=0)
    total_ja_lancados = Column(Integer, default=0)
    total_conflitos = Column(Integer, default=0)
    total_ignoradas = Column(Integer, default=0)
    status_processamento = Column(String(50), default="simulado")  # simulado, confirmado, confirmado_parcial, erro
    metadata_json = Column(Text)  # JSON


class ImportRowSQL(Base):
    __tablename__ = "import_rows"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    batch_id = Column(String(36), ForeignKey("import_batches.id"), nullable=False, index=True)
    fitid = Column(String(255), index=True)
    hash_linha = Column(String(128), nullable=False, index=True)
    data_transacao = Column(Date, nullable=False, index=True)
    nome_pagador = Column(String(255))
    documento_pagador = Column(String(20), index=True)
    memo_original = Column(Text)
    descricao_transacao_extraida = Column(String(255))
    tipo_transacao = Column(String(50), nullable=False)
    valor = Column(Float, nullable=False)
    banco_origem = Column(String(120), default="Cora")
    conta_origem = Column(String(120))
    bank_id = Column(String(60))

    status_conciliacao = Column(String(50), default="nao_identificadas", index=True)
    titulo_id = Column(String(36), index=True)
    cliente_id = Column(String(36), index=True)
    dias_atraso = Column(Integer, default=0)
    multa = Column(Float, default=0.0)
    juros = Column(Float, default=0.0)
    motivo_resultado = Column(Text)
    candidatos_json = Column(Text)  # JSON

    confirmado_manualmente = Column(Boolean, default=False)
    confirmado_por = Column(String(255))
    confirmado_em = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AliasClienteSQL(Base):
    __tablename__ = "aliases_cliente"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    cliente_id = Column(String(36), nullable=False, index=True)
    alias_nome = Column(String(255), nullable=False, index=True)
    origem = Column(String(100), default="manual")
    ativo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ImportSettlementLinkSQL(Base):
    __tablename__ = "import_settlement_links"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conta_id = Column(String(36), nullable=False, index=True)
    batch_id = Column(String(36), nullable=False, index=True)
    row_id = Column(String(36), nullable=False, index=True)
    fitid = Column(String(255), index=True)
    valor_recebido = Column(Float, nullable=False)
    juros = Column(Float, default=0.0)
    multa = Column(Float, default=0.0)
    dias_atraso = Column(Integer, default=0)
    status_baixa = Column(String(60), default="pago")
    usuario_id = Column(String(36), nullable=False)
    usuario_nome = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

# ==================== TRABALHISTA ====================
class SolicitacaoTrabalhistaSQL(Base):
    __tablename__ = "solicitacoes_trabalhistas"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    empresa_id = Column(String(36), nullable=False, index=True)
    empresa = Column(String(255), nullable=False)
    tipo = Column(String(50), nullable=False, index=True)  # admissao, demissao, folha, afastamento, etc
    titulo = Column(String(255), nullable=False)
    descricao = Column(Text, nullable=False)
    data_solicitacao = Column(Date, nullable=False)
    prazo = Column(Date, nullable=False, index=True)
    responsavel = Column(String(255), nullable=False, index=True)
    status = Column(String(50), default="pendente", index=True)  # pendente, em_andamento, concluido, atrasado, cancelado
    prioridade = Column(String(50), default="media")  # alta, media, baixa
    
    # Dados específicos
    funcionario_id = Column(String(36))
    tipo_afastamento = Column(String(50))
    periodo_afastamento = Column(Text)  # JSON string
    detalhes_folha = Column(Text)  # JSON string
    
    # Documentos
    documentos_anexos = Column(Text)  # JSON string list
    documentos_necessarios = Column(Text)  # JSON string list
    
    # Checklist
    checklist_id = Column(String(36))
    checklist_items = Column(Text)  # JSON string
    
    # Observações
    observacoes = Column(Text)
    historico_alteracoes = Column(Text)  # JSON string
    
    # Metadados
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class FuncionarioSQL(Base):
    __tablename__ = "funcionarios"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    empresa_id = Column(String(36), nullable=False, index=True)
    
    # Dados pessoais
    nome_completo = Column(String(255), nullable=False, index=True)
    cpf = Column(String(14), nullable=False, unique=True, index=True)
    rg = Column(String(20))
    data_nascimento = Column(Date)
    estado_civil = Column(String(50))
    endereco = Column(Text)
    telefone = Column(String(20))
    email = Column(String(255))
    nome_mae = Column(String(255))
    nome_pai = Column(String(255))
    
    # Dados contratuais
    funcao = Column(String(255), nullable=False, index=True)
    cargo = Column(String(255))
    tipo_contrato = Column(String(50), default="clt")  # clt, temporario, terceirizado, estagiario, autonomo, pj
    salario_base = Column(Float, nullable=False)
    carga_horaria = Column(Integer)
    data_admissao = Column(Date, nullable=False, index=True)
    data_demissao = Column(Date, index=True)
    motivo_demissao = Column(Text)
    setor = Column(String(255))
    centro_custo = Column(String(255))
    
    # Status
    status = Column(String(50), default="ativo", index=True)  # ativo, demitido, afastado, ferias
    observacoes = Column(Text)
    documentos_anexos = Column(Text)  # JSON string list
    historico_alteracoes = Column(Text)  # JSON string
    
    # Metadados
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ObrigacaoTrabalhistaSQL(Base):
    __tablename__ = "obrigacoes_trabalhistas"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    empresa_id = Column(String(36), nullable=False, index=True)
    nome = Column(String(255), nullable=False)
    descricao = Column(Text, nullable=False)
    periodicidade = Column(String(50), nullable=False)  # mensal, bimestral, trimestral, semestral, anual
    dia_vencimento = Column(Integer, nullable=False)
    proximo_vencimento = Column(Date, nullable=False, index=True)
    status = Column(String(50), default="pendente", index=True)  # pendente, entregue, atrasada
    responsavel = Column(String(255), index=True)
    observacoes = Column(Text)
    arquivos_entrega = Column(Text)  # JSON string list
    historico_entregas = Column(Text)  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ChecklistTrabalhistaSQL(Base):
    __tablename__ = "checklists_trabalhistas"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tipo_processo = Column(String(50), nullable=False)
    nome = Column(String(255), nullable=False)
    descricao = Column(Text, nullable=False)
    itens = Column(Text, nullable=False)  # JSON string
    template = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

# ==================== FISCAL ====================
class ObrigacaoFiscalSQL(Base):
    __tablename__ = "obrigacoes_fiscais"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    empresa_id = Column(String(36), nullable=False, index=True)
    empresa = Column(String(255), nullable=False)
    tipo = Column(String(50), nullable=False, index=True)  # pgdas, defis, dctf, sped_fiscal, etc
    nome = Column(String(255), nullable=False)
    descricao = Column(Text)
    periodicidade = Column(String(50), nullable=False)  # mensal, bimestral, trimestral, semestral, anual, eventual
    dia_vencimento = Column(Integer, nullable=False)
    proximo_vencimento = Column(Date, nullable=False, index=True)
    ultimo_vencimento = Column(Date)
    status = Column(String(50), default="pendente", index=True)  # pendente, em_andamento, entregue, atrasado, retificado, cancelado
    responsavel = Column(String(255), nullable=False, index=True)
    regime_tributario = Column(String(50), nullable=False)  # simples_nacional, lucro_presumido, lucro_real, mei
    
    # Documentos e entrega
    protocolo_entrega = Column(String(100))
    data_entrega = Column(Date)
    arquivo_enviado = Column(String(500))
    comprovante_entrega = Column(String(500))
    observacoes = Column(Text)
    valor = Column(Float)
    documentos = Column(Text)  # JSON string list
    vencimento = Column(Date)  # compatibilidade
    historico_entregas = Column(Text)  # JSON string
    
    # Metadados
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class NotaFiscalSQL(Base):
    __tablename__ = "notas_fiscais"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    empresa_id = Column(String(36), nullable=False, index=True)
    empresa = Column(String(255), nullable=False)
    tipo = Column(String(50), nullable=False, index=True)  # entrada, saida, cancelada, inutilizada
    numero = Column(Integer, nullable=False)
    serie = Column(String(10), nullable=False)
    chave_nfe = Column(String(44), nullable=False, unique=True, index=True)
    data_emissao = Column(Date, nullable=False, index=True)
    data_vencimento = Column(Date)
    
    # Dados emitente/destinatário
    emitente_cnpj = Column(String(18), nullable=False, index=True)
    emitente_razao_social = Column(String(255), nullable=False)
    destinatario_cnpj = Column(String(18), index=True)
    destinatario_razao_social = Column(String(255))
    
    # Valores
    valor_total = Column(Float, nullable=False)
    valor_produtos = Column(Float, nullable=False)
    valor_servicos = Column(Float, default=0.0)
    base_icms = Column(Float, default=0.0)
    valor_icms = Column(Float, default=0.0)
    base_ipi = Column(Float, default=0.0)
    valor_ipi = Column(Float, default=0.0)
    valor_pis = Column(Float, default=0.0)
    valor_cofins = Column(Float, default=0.0)
    valor_iss = Column(Float, default=0.0)
    
    # Impostos calculados
    impostos = Column(Text)  # JSON string
    
    # Conciliação
    status_conciliacao = Column(String(50), default="nao_conciliado", index=True)  # nao_conciliado, conciliado, divergente, pendente
    conciliado_com = Column(String(36))
    data_conciliacao = Column(DateTime)
    
    # Arquivos
    arquivo_xml = Column(String(500))
    arquivo_pdf = Column(String(500))
    
    # Classificação fiscal
    cfop = Column(String(10))
    natureza_operacao = Column(String(255))
    
    # Metadados
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ApuracaoFiscalSQL(Base):
    __tablename__ = "apuracoes_fiscais"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    empresa_id = Column(String(36), nullable=False, index=True)
    periodo = Column(String(7), nullable=False, index=True)  # YYYY-MM
    regime_tributario = Column(String(50), nullable=False)
    
    # Valores de impostos
    icms = Column(Float, default=0.0)
    ipi = Column(Float, default=0.0)
    pis = Column(Float, default=0.0)
    cofins = Column(Float, default=0.0)
    iss = Column(Float, default=0.0)
    irpj = Column(Float, default=0.0)
    csll = Column(Float, default=0.0)
    total_impostos = Column(Float, default=0.0)
    
    # Metadados
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ==================== ATENDIMENTO ====================
class TicketSQL(Base):
    __tablename__ = "tickets"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    numero = Column(String(20), unique=True, index=True)
    
    # Dados do solicitante
    empresa_id = Column(String(36), nullable=False, index=True)
    empresa = Column(String(255), nullable=False)
    solicitante_nome = Column(String(255))
    solicitante_email = Column(String(255))
    solicitante_telefone = Column(String(20))
    
    # Dados do ticket
    titulo = Column(String(500), nullable=False, index=True)
    descricao = Column(Text, nullable=False)
    tipo = Column(String(50), default="duvida", index=True)  # duvida, problema, solicitacao, reclamacao, sugestao, etc
    categoria = Column(String(100))
    prioridade = Column(String(50), default="media", index=True)  # baixa, media, alta, urgente, critica
    status = Column(String(50), default="aberto", index=True)  # aberto, em_andamento, aguardando_cliente, resolvido, fechado, cancelado
    responsavel = Column(String(255), nullable=False, index=True)
    equipe = Column(String(100), index=True)
    canal = Column(String(50), nullable=False)  # telefone, email, whatsapp, chat, presencial, portal
    
    # Datas e prazos
    data_abertura = Column(Date, nullable=False)
    data_primeira_resposta = Column(DateTime)
    data_resolucao = Column(DateTime)
    data_fechamento = Column(DateTime)
    sla = Column(DateTime, nullable=False)
    prazo_primeira_resposta = Column(DateTime)
    prazo_resolucao = Column(DateTime)
    
    # SLA status
    sla_primeira_resposta_violado = Column(Boolean, default=False)
    sla_resolucao_violado = Column(Boolean, default=False)
    tempo_primeira_resposta = Column(Integer)  # minutos
    tempo_resolucao = Column(Integer)  # minutos
    
    # Resolução e feedback
    solucao = Column(Text)
    satisfacao_cliente = Column(Integer)
    feedback_cliente = Column(Text)
    
    # Relacionamentos
    tags = Column(Text)  # JSON string list
    tickets_relacionados = Column(Text)  # JSON string list
    documentos_relacionados = Column(Text)  # JSON string list
    arquivos = Column(Text)  # JSON string list
    historico_status = Column(Text)  # JSON string
    
    # Metadados
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    conversas = relationship("ConversaSQL", back_populates="ticket", cascade="all, delete-orphan")

class ConversaSQL(Base):
    __tablename__ = "conversas"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id = Column(String(36), ForeignKey("tickets.id"), nullable=False, index=True)
    data = Column(DateTime, default=datetime.utcnow)
    usuario = Column(String(255), nullable=False)
    mensagem = Column(Text, nullable=False)
    tipo = Column(String(50), default="resposta")  # resposta, nota_interna, encaminhamento, resolucao
    eh_cliente = Column(Boolean, default=False)
    eh_publico = Column(Boolean, default=True)
    anexos = Column(Text)  # JSON string list
    editado = Column(Boolean, default=False)
    data_edicao = Column(DateTime)
    
    ticket = relationship("TicketSQL", back_populates="conversas")

class ArtigoBaseConhecimentoSQL(Base):
    __tablename__ = "base_conhecimento"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    titulo = Column(String(500), nullable=False, index=True)
    conteudo = Column(Text, nullable=False)
    resumo = Column(Text)
    categoria = Column(String(100), nullable=False, index=True)
    tags = Column(Text)  # JSON string list
    publicado = Column(Boolean, default=False, index=True)
    visivel_cliente = Column(Boolean, default=False)
    visualizacoes = Column(Integer, default=0)
    avaliacoes_positivas = Column(Integer, default=0)
    avaliacoes_negativas = Column(Integer, default=0)
    tickets_relacionados = Column(Text)  # JSON string list
    autor = Column(String(255), nullable=False)
    data_publicacao = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class AvaliacaoAtendimentoSQL(Base):
    __tablename__ = "avaliacoes_atendimento"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id = Column(String(36), nullable=False, index=True)
    empresa_id = Column(String(36))
    cliente_nome = Column(String(255), nullable=False)
    cliente_email = Column(String(255), nullable=False)
    satisfacao_geral = Column(Integer, nullable=False)
    satisfacao_atendimento = Column(Integer, nullable=False)
    satisfacao_tempo_resposta = Column(Integer, nullable=False)
    satisfacao_resolucao = Column(Integer, nullable=False)
    comentarios = Column(Text)
    sugestoes = Column(Text)
    recomendaria_servico = Column(Integer, nullable=False)  # NPS 0-10
    data_avaliacao = Column(DateTime, default=datetime.utcnow)

# ==================== OUTROS MÓDULOS ====================
class ConfiguracaoSQL(Base):
    __tablename__ = "configuracoes"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    chave = Column(String(255), unique=True, nullable=False, index=True)
    valor = Column(Text, nullable=False)
    tipo = Column(String(50))  # string, json, integer, boolean
    descricao = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ChatSQL(Base):
    __tablename__ = "chats"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False, index=True)
    messages = Column(Text, nullable=False)  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class TaskSQL(Base):
    __tablename__ = "tasks"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(500), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="pending", index=True)  # pending, in_progress, completed, cancelled
    priority = Column(String(50), default="medium")  # low, medium, high, urgent
    assigned_to = Column(String(255), index=True)
    due_date = Column(Date, index=True)
    completed_at = Column(DateTime)
    tags = Column(Text)  # JSON string list
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ==================== GUIAS FISCAIS ====================
class GuiaFiscalSQL(Base):
    __tablename__ = "guias_fiscais"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    empresa_id = Column(String(36), nullable=False, index=True)
    empresa_nome = Column(String(255), nullable=False)
    tipo_guia = Column(String(100), nullable=False, index=True)
    competencia = Column(String(7), nullable=False, index=True)  # YYYY-MM
    valor = Column(Float, nullable=False)
    data_vencimento = Column(Date, nullable=False, index=True)
    data_pagamento = Column(Date)
    status = Column(String(50), default="pendente", index=True)  # pendente, pago, atrasado
    colaborador_responsavel = Column(String(255), nullable=False, index=True)
    colaborador_lancamento_id = Column(String(36), nullable=False)
    colaborador_lancamento_nome = Column(String(255), nullable=False)
    observacoes = Column(Text)
    arquivo_guia = Column(String(500))  # path to PDF
    arquivo_comprovante = Column(String(500))  # path to payment proof
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
