"""
Modelos SQL para Macedo Academy (modelos de processo e processos gerados).
"""
from sqlalchemy import Column, String, DateTime, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
from models_sql import Base
from datetime import datetime
import uuid


class AcademyProcessModelSQL(Base):
    __tablename__ = "academy_process_models"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nome = Column(String(255), nullable=False, index=True)
    descricao = Column(Text)
    setor_destino = Column(String(100), index=True)
    regimes_config = Column(Text)  # JSON
    clientes_excecoes_config = Column(Text)  # JSON
    prazo_config = Column(Text)  # JSON
    recorrencia_config = Column(Text)  # JSON
    etapas = Column(Text)  # JSON
    metadata_json = Column(Text)  # JSON
    criado_por_id = Column(String(36))
    criado_por_nome = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AcademyGeneratedProcessSQL(Base):
    __tablename__ = "academy_generated_processes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    model_id = Column(String(36), ForeignKey("academy_process_models.id"), index=True)
    model_nome = Column(String(255), nullable=False, index=True)
    cliente_nome = Column(String(255), nullable=False, index=True)
    cliente_cnpj = Column(String(30), index=True)
    status = Column(String(50), default="pendente", index=True)
    data_vencimento = Column(Date, index=True)
    payload = Column(Text)  # JSON
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    model = relationship("AcademyProcessModelSQL", foreign_keys=[model_id])

