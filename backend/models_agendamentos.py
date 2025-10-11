"""
Modelos SQL para o módulo de Agendamentos (Atendimento + Contadores)
"""
from sqlalchemy import Column, String, Date, DateTime, Time, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from models_sql import Base
from datetime import datetime
import uuid

class AgendamentoSQL(Base):
    """Agendamentos de atendimento"""
    __tablename__ = "agendamentos"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    numero = Column(String(20), unique=True, index=True)  # AGD-YYYY-NNNN
    
    # Empresa e Cliente
    empresa_id = Column(String(36), ForeignKey("clients.id"), nullable=False, index=True)
    empresa_nome = Column(String(255), nullable=False)
    cliente_nome = Column(String(255), nullable=False)
    cliente_telefone = Column(String(20))
    cliente_email = Column(String(255))
    
    # Data e Hora
    data_agendamento = Column(Date, nullable=False, index=True)
    hora_inicio = Column(Time, nullable=False)
    hora_fim = Column(Time, nullable=False)
    duracao_minutos = Column(String(10))  # 30min, 1h, 2h
    
    # Tipo e Motivo
    tipo_atendimento = Column(String(100), nullable=False)  # presencial, online, telefone
    motivo_atendimento = Column(Text, nullable=False)
    setor_responsavel = Column(String(100), nullable=False)  # Contadores, Fiscal, etc
    
    # Contador
    contador_id = Column(String(36), ForeignKey("users.id"), index=True)
    contador_nome = Column(String(255))
    
    # Solicitante
    solicitante_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    solicitante_nome = Column(String(255), nullable=False)
    
    # Status
    status = Column(String(50), default="pendente", index=True)
    # pendente: aguardando confirmação do contador
    # confirmado: contador confirmou
    # recusado: contador recusou
    # realizado: atendimento foi realizado
    # cancelado: cliente cancelou
    # nao_compareceu: cliente não compareceu
    
    # Observações
    observacoes = Column(Text)
    motivo_recusa = Column(Text)  # Se status = recusado
    notas_atendimento = Column(Text)  # Notas após atendimento realizado
    
    # Notificações
    notificacao_enviada = Column(Boolean, default=False)
    notificacao_contador = Column(Boolean, default=False)
    lembrete_enviado = Column(Boolean, default=False)
    
    # Metadados
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    empresa = relationship("ClientSQL", foreign_keys=[empresa_id])
    contador = relationship("UserSQL", foreign_keys=[contador_id])
    solicitante = relationship("UserSQL", foreign_keys=[solicitante_id])

class DisponibilidadeContadorSQL(Base):
    """Disponibilidade de horários dos contadores"""
    __tablename__ = "disponibilidade_contadores"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    contador_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    contador_nome = Column(String(255), nullable=False)
    
    # Dia da semana (0-6: segunda a domingo)
    dia_semana = Column(String(10), nullable=False)  # segunda, terca, etc
    
    # Horários
    hora_inicio = Column(Time, nullable=False)
    hora_fim = Column(Time, nullable=False)
    
    # Status
    ativo = Column(Boolean, default=True)
    
    # Metadados
    created_at = Column(DateTime, default=datetime.utcnow)
    
    contador = relationship("UserSQL", foreign_keys=[contador_id])

class BloqueioAgendaSQL(Base):
    """Bloqueios de agenda (férias, feriados, compromissos)"""
    __tablename__ = "bloqueios_agenda"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    contador_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    contador_nome = Column(String(255), nullable=False)
    
    # Período
    data_inicio = Column(Date, nullable=False, index=True)
    data_fim = Column(Date, nullable=False, index=True)
    
    # Horários (se bloqueio parcial do dia)
    hora_inicio = Column(Time)
    hora_fim = Column(Time)
    dia_todo = Column(Boolean, default=True)
    
    # Motivo
    motivo = Column(String(100), nullable=False)  # ferias, feriado, reuniao, etc
    descricao = Column(Text)
    
    # Metadados
    created_at = Column(DateTime, default=datetime.utcnow)
    
    contador = relationship("UserSQL", foreign_keys=[contador_id])

class HistoricoAgendamentoSQL(Base):
    """Histórico de alterações em agendamentos"""
    __tablename__ = "historico_agendamentos"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agendamento_id = Column(String(36), ForeignKey("agendamentos.id"), nullable=False, index=True)
    data = Column(DateTime, default=datetime.utcnow)
    usuario_id = Column(String(36), ForeignKey("users.id"))
    usuario_nome = Column(String(255))
    acao = Column(String(100), nullable=False)
    descricao = Column(Text)
    
    agendamento = relationship("AgendamentoSQL", foreign_keys=[agendamento_id])
    usuario = relationship("UserSQL", foreign_keys=[usuario_id])
