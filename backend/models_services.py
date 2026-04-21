"""
Modelos SQL para o módulo de Serviços/Tarefas
"""
from sqlalchemy import Column, String, Date, DateTime, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from models_sql import Base
from datetime import datetime
import uuid
import enum

class TipoServico(str, enum.Enum):
    """Tipos de serviços disponíveis"""
    IRPF = "IRPF"
    IRPJ = "IRPJ"
    MEI = "MEI"
    ITR = "ITR"
    CONSULTORIA = "Consultoria"
    AUDITORIA = "Auditoria"
    CONTABIL = "Contábil"
    TRABALHISTA = "Trabalhista"
    FISCAL = "Fiscal"
    OUTROS = "Outros"

class StatusServico(str, enum.Enum):
    """Status do serviço"""
    PENDENTE = "pendente"
    EM_ANDAMENTO = "em_andamento"
    AGUARDANDO_CLIENTE = "aguardando_cliente"
    AGUARDANDO_DOCUMENTO = "aguardando_documento"
    CONCLUIDO = "concluido"
    CANCELADO = "cancelado"

class PrioridadeServico(str, enum.Enum):
    """Prioridade do serviço"""
    BAIXA = "baixa"
    MEDIA = "media"
    ALTA = "alta"
    URGENTE = "urgente"

class ServicoSQL(Base):
    """Serviços/Tarefas do sistema"""
    __tablename__ = "servicos"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    numero = Column(String(20), unique=True, index=True)  # Auto-gerado: SRV-YYYY-NNNN
    
    # Vinculação
    empresa_id = Column(String(36), ForeignKey("clients.id"), nullable=False, index=True)
    empresa_nome = Column(String(255), nullable=False)  # Desnormalizado para performance
    
    # Classificação
    tipo_servico = Column(String(50), nullable=False, index=True)
    setor = Column(String(100), nullable=False, index=True)  # Atendimento, Contadores, Comercial, etc
    cidade = Column(String(100), nullable=False, index=True)
    
    # Dados do serviço
    titulo = Column(String(500), nullable=False)
    descricao = Column(Text, nullable=False)
    status = Column(String(50), default="pendente", index=True)
    prioridade = Column(String(50), default="media", index=True)
    
    # Responsáveis
    solicitante_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    solicitante_nome = Column(String(255), nullable=False)
    responsavel_id = Column(String(36), ForeignKey("users.id"), index=True)
    responsavel_nome = Column(String(255))
    
    # Datas
    data_solicitacao = Column(Date, nullable=False, default=datetime.utcnow)
    data_prazo = Column(Date, index=True)
    data_inicio = Column(DateTime)
    data_conclusao = Column(DateTime)
    
    # Observações e histórico
    observacoes = Column(Text)
    historico_alteracoes = Column(Text)  # JSON string
    
    # Chat integration
    conversation_id = Column(String(36), ForeignKey("conversations.id"))  # Se foi enviado para chat
    
    # Anexos
    anexos = Column(Text)  # JSON string list
    
    # Metadados
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    empresa = relationship("ClientSQL", foreign_keys=[empresa_id])
    solicitante = relationship("UserSQL", foreign_keys=[solicitante_id])
    responsavel = relationship("UserSQL", foreign_keys=[responsavel_id])
    conversation = relationship("ConversationSQL", foreign_keys=[conversation_id])

class ComentarioServicoSQL(Base):
    """Comentários em serviços"""
    __tablename__ = "comentarios_servicos"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    servico_id = Column(String(36), ForeignKey("servicos.id"), nullable=False, index=True)
    usuario_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    usuario_nome = Column(String(255), nullable=False)
    comentario = Column(Text, nullable=False)
    anexos = Column(Text)  # JSON string list
    created_at = Column(DateTime, default=datetime.utcnow)
    
    servico = relationship("ServicoSQL", foreign_keys=[servico_id])
    usuario = relationship("UserSQL", foreign_keys=[usuario_id])


class ServicesConfigurationSQL(Base):
    """Configurações do módulo de serviços."""
    __tablename__ = "services_configuration"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    config_key = Column(String(100), unique=True, nullable=False, index=True, default="default")
    payload_json = Column(Text, nullable=False, default="{}")
    updated_by_id = Column(String(36))
    updated_by_name = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
