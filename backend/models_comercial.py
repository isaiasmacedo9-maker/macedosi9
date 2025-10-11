"""
Modelos SQL para o módulo Comercial
"""
from sqlalchemy import Column, String, Date, DateTime, Text, ForeignKey, Float, Integer
from sqlalchemy.orm import relationship
from models_sql import Base
from datetime import datetime
import uuid

class ServicoComercialSQL(Base):
    """Serviços comerciais (IRPF, IRPJ, MEI, ITR, etc)"""
    __tablename__ = "servicos_comerciais"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    numero = Column(String(20), unique=True, index=True)  # SC-YYYY-NNNN
    
    # Vinculação
    empresa_id = Column(String(36), ForeignKey("clients.id"), nullable=False, index=True)
    empresa_nome = Column(String(255), nullable=False)
    
    # Tipo de serviço
    tipo_servico = Column(String(50), nullable=False, index=True)  # IRPF, IRPJ, MEI, ITR
    descricao = Column(Text, nullable=False)
    
    # Valores
    valor_servico = Column(Float, nullable=False)
    valor_desconto = Column(Float, default=0.0)
    valor_total = Column(Float, nullable=False)
    
    # Datas
    data_contratacao = Column(Date, nullable=False)
    data_inicio_previsto = Column(Date)
    data_conclusao_prevista = Column(Date)
    data_conclusao_real = Column(DateTime)
    
    # Status
    status = Column(String(50), default="contratado", index=True)  # contratado, em_andamento, concluido, cancelado
    
    # Responsável
    responsavel_id = Column(String(36), ForeignKey("users.id"))
    responsavel_nome = Column(String(255))
    
    # Observações
    observacoes = Column(Text)
    
    # Metadados
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    empresa = relationship("ClientSQL", foreign_keys=[empresa_id])
    responsavel = relationship("UserSQL", foreign_keys=[responsavel_id])
    ordem_servico = relationship("OrdemServicoSQL", back_populates="servico", uselist=False)

class OrdemServicoSQL(Base):
    """Ordem de Serviço - gerada automaticamente ao criar serviço comercial"""
    __tablename__ = "ordens_servico"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    numero = Column(String(20), unique=True, index=True)  # OS-YYYY-NNNN
    
    # Vinculação
    servico_id = Column(String(36), ForeignKey("servicos_comerciais.id"), nullable=False, unique=True)
    empresa_id = Column(String(36), ForeignKey("clients.id"), nullable=False)
    empresa_nome = Column(String(255), nullable=False)
    
    # Dados da O.S.
    tipo_servico = Column(String(50), nullable=False)
    descricao_servico = Column(Text, nullable=False)
    valor_total = Column(Float, nullable=False)
    
    # Datas
    data_emissao = Column(Date, nullable=False)
    data_validade = Column(Date)
    
    # Status
    status = Column(String(50), default="aberta", index=True)  # aberta, em_execucao, concluida, cancelada
    
    # Execução
    data_inicio_execucao = Column(DateTime)
    data_conclusao = Column(DateTime)
    executor_id = Column(String(36), ForeignKey("users.id"))
    executor_nome = Column(String(255))
    
    # Observações
    observacoes_execucao = Column(Text)
    
    # Metadados
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    servico = relationship("ServicoComercialSQL", back_populates="ordem_servico")
    empresa = relationship("ClientSQL", foreign_keys=[empresa_id])
    executor = relationship("UserSQL", foreign_keys=[executor_id])

class ContratoSQL(Base):
    """Contratos com clientes"""
    __tablename__ = "contratos"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    numero = Column(String(20), unique=True, index=True)  # CTR-YYYY-NNNN
    
    # Vinculação
    empresa_id = Column(String(36), ForeignKey("clients.id"), nullable=False, index=True)
    empresa_nome = Column(String(255), nullable=False)
    
    # Dados do contrato
    nome_contrato = Column(String(255), nullable=False)
    tipo_servico = Column(String(100), nullable=False)
    descricao = Column(Text)
    
    # Valores
    valor_mensal = Column(Float)
    valor_total = Column(Float)
    forma_pagamento = Column(String(100))
    
    # Datas
    data_assinatura = Column(Date, nullable=False, index=True)
    data_inicio_vigencia = Column(Date, nullable=False)
    data_vencimento = Column(Date, nullable=False, index=True)
    data_renovacao = Column(Date)
    
    # Status
    status = Column(String(50), default="ativo", index=True)  # ativo, vencido, renovado, cancelado
    renovacao_automatica = Column(String(10), default="nao")  # sim, nao
    
    # Arquivo
    arquivo_contrato = Column(String(500))  # Caminho do PDF
    
    # Observações
    observacoes = Column(Text)
    clausulas_especiais = Column(Text)
    
    # Alertas de vencimento
    alerta_30_dias = Column(String(10), default="pendente")  # pendente, enviado
    alerta_90_dias = Column(String(10), default="pendente")
    alerta_180_dias = Column(String(10), default="pendente")
    
    # Responsável
    responsavel_id = Column(String(36), ForeignKey("users.id"))
    responsavel_nome = Column(String(255))
    
    # Metadados
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    empresa = relationship("ClientSQL", foreign_keys=[empresa_id])
    responsavel = relationship("UserSQL", foreign_keys=[responsavel_id])
    
class HistoricoContratoSQL(Base):
    """Histórico de alterações em contratos"""
    __tablename__ = "historico_contratos"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    contrato_id = Column(String(36), ForeignKey("contratos.id"), nullable=False, index=True)
    data = Column(DateTime, default=datetime.utcnow)
    usuario_id = Column(String(36), ForeignKey("users.id"))
    usuario_nome = Column(String(255))
    acao = Column(String(100), nullable=False)
    descricao = Column(Text)
    
    contrato = relationship("ContratoSQL", foreign_keys=[contrato_id])
    usuario = relationship("UserSQL", foreign_keys=[usuario_id])
