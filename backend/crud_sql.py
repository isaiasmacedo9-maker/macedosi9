"""
CRUD operations for SQL database
Helper functions to replace MongoDB operations
"""
from sqlalchemy import select, update, delete, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any, Optional
import json
from datetime import date, datetime

def json_loads(value):
    """Convert JSON string to list/dict"""
    if value is None:
        return []
    if isinstance(value, str):
        try:
            return json.loads(value)
        except:
            return []
    return value

def json_dumps(value):
    """Convert list/dict to JSON string"""
    if value is None:
        return None
    if isinstance(value, (list, dict)):
        return json.dumps(value, default=str, ensure_ascii=False)
    return value

# Generic CRUD operations
async def get_by_id(session: AsyncSession, model, id: str):
    """Get single record by ID"""
    result = await session.execute(select(model).where(model.id == id))
    return result.scalar_one_or_none()

async def get_all(session: AsyncSession, model, limit: int = 100, skip: int = 0):
    """Get all records with pagination"""
    result = await session.execute(select(model).limit(limit).offset(skip))
    return result.scalars().all()

async def create(session: AsyncSession, obj):
    """Create new record"""
    session.add(obj)
    await session.flush()
    return obj

async def update_by_id(session: AsyncSession, model, id: str, data: Dict):
    """Update record by ID"""
    stmt = update(model).where(model.id == id).values(**data)
    await session.execute(stmt)
    await session.flush()
    return await get_by_id(session, model, id)

async def delete_by_id(session: AsyncSession, model, id: str):
    """Delete record by ID"""
    stmt = delete(model).where(model.id == id)
    result = await session.execute(stmt)
    await session.flush()
    return result.rowcount > 0

async def count_records(session: AsyncSession, model, filters=None):
    """Count records with optional filters"""
    stmt = select(func.count()).select_from(model)
    if filters:
        stmt = stmt.where(filters)
    result = await session.execute(stmt)
    return result.scalar()

# User operations
async def get_user_by_email(session: AsyncSession, email: str):
    """Get user by email"""
    from models_sql import UserSQL
    result = await session.execute(select(UserSQL).where(UserSQL.email == email))
    return result.scalar_one_or_none()

# Client operations
async def get_clients_filtered(session: AsyncSession, filters: Dict):
    """Get clients with filters"""
    from models_sql import ClientSQL
    stmt = select(ClientSQL)
    
    if filters.get('nome_empresa'):
        stmt = stmt.where(ClientSQL.nome_empresa.ilike(f"%{filters['nome_empresa']}%"))
    if filters.get('cnpj'):
        stmt = stmt.where(ClientSQL.cnpj.like(f"%{filters['cnpj']}%"))
    if filters.get('cidade_atendimento'):
        stmt = stmt.where(ClientSQL.cidade_atendimento == filters['cidade_atendimento'])
    if filters.get('status_empresa'):
        stmt = stmt.where(ClientSQL.status_empresa.in_(filters['status_empresa']))
    
    result = await session.execute(stmt)
    return result.scalars().all()

# Contas a receber operations
async def get_contas_receber_filtered(session: AsyncSession, filters: Dict, limit: int = 100):
    """Get contas a receber with filters"""
    from models_sql import ContaReceberSQL
    stmt = select(ContaReceberSQL)
    
    if filters.get('empresa'):
        stmt = stmt.where(ContaReceberSQL.empresa.ilike(f"%{filters['empresa']}%"))
    if filters.get('situacao'):
        stmt = stmt.where(ContaReceberSQL.situacao.in_(filters['situacao']))
    if filters.get('cidade'):
        stmt = stmt.where(ContaReceberSQL.cidade_atendimento == filters['cidade'])
    if filters.get('usuario_responsavel'):
        stmt = stmt.where(ContaReceberSQL.usuario_responsavel == filters['usuario_responsavel'])
    if filters.get('data_vencimento_inicio'):
        stmt = stmt.where(ContaReceberSQL.data_vencimento >= filters['data_vencimento_inicio'])
    if filters.get('data_vencimento_fim'):
        stmt = stmt.where(ContaReceberSQL.data_vencimento <= filters['data_vencimento_fim'])
    if filters.get('valor_minimo'):
        stmt = stmt.where(ContaReceberSQL.valor_original >= filters['valor_minimo'])
    if filters.get('valor_maximo'):
        stmt = stmt.where(ContaReceberSQL.valor_original <= filters['valor_maximo'])
    
    stmt = stmt.order_by(ContaReceberSQL.data_vencimento.desc()).limit(limit)
    result = await session.execute(stmt)
    return result.scalars().all()

async def get_conta_with_relations(session: AsyncSession, conta_id: str):
    """Get conta a receber with all related data"""
    from models_sql import ContaReceberSQL
    from sqlalchemy.orm import selectinload
    
    stmt = select(ContaReceberSQL).where(ContaReceberSQL.id == conta_id).options(
        selectinload(ContaReceberSQL.historico),
        selectinload(ContaReceberSQL.contatos_cobranca),
        selectinload(ContaReceberSQL.anexos)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()

# Trabalhista operations
async def get_solicitacoes_trabalhistas_filtered(session: AsyncSession, filters: Dict):
    """Get solicitações trabalhistas with filters"""
    from models_sql import SolicitacaoTrabalhistaSQL
    stmt = select(SolicitacaoTrabalhistaSQL)
    
    if filters.get('empresa'):
        stmt = stmt.where(SolicitacaoTrabalhistaSQL.empresa.ilike(f"%{filters['empresa']}%"))
    if filters.get('tipo'):
        stmt = stmt.where(SolicitacaoTrabalhistaSQL.tipo.in_(filters['tipo']))
    if filters.get('status'):
        stmt = stmt.where(SolicitacaoTrabalhistaSQL.status.in_(filters['status']))
    if filters.get('responsavel'):
        stmt = stmt.where(SolicitacaoTrabalhistaSQL.responsavel == filters['responsavel'])
    if filters.get('data_inicio'):
        stmt = stmt.where(SolicitacaoTrabalhistaSQL.data_solicitacao >= filters['data_inicio'])
    if filters.get('data_fim'):
        stmt = stmt.where(SolicitacaoTrabalhistaSQL.data_solicitacao <= filters['data_fim'])
    
    stmt = stmt.order_by(SolicitacaoTrabalhistaSQL.prazo.desc())
    result = await session.execute(stmt)
    return result.scalars().all()

# Fiscal operations
async def get_obrigacoes_fiscais_filtered(session: AsyncSession, filters: Dict):
    """Get obrigações fiscais with filters"""
    from models_sql import ObrigacaoFiscalSQL
    stmt = select(ObrigacaoFiscalSQL)
    
    if filters.get('empresa'):
        stmt = stmt.where(ObrigacaoFiscalSQL.empresa.ilike(f"%{filters['empresa']}%"))
    if filters.get('tipo'):
        stmt = stmt.where(ObrigacaoFiscalSQL.tipo.in_(filters['tipo']))
    if filters.get('status'):
        stmt = stmt.where(ObrigacaoFiscalSQL.status.in_(filters['status']))
    if filters.get('responsavel'):
        stmt = stmt.where(ObrigacaoFiscalSQL.responsavel == filters['responsavel'])
    if filters.get('regime_tributario'):
        stmt = stmt.where(ObrigacaoFiscalSQL.regime_tributario == filters['regime_tributario'])
    
    stmt = stmt.order_by(ObrigacaoFiscalSQL.proximo_vencimento.desc())
    result = await session.execute(stmt)
    return result.scalars().all()

# Atendimento operations
async def get_tickets_filtered(session: AsyncSession, filters: Dict):
    """Get tickets with filters"""
    from models_sql import TicketSQL
    stmt = select(TicketSQL)
    
    if filters.get('empresa'):
        stmt = stmt.where(TicketSQL.empresa.ilike(f"%{filters['empresa']}%"))
    if filters.get('status'):
        stmt = stmt.where(TicketSQL.status.in_(filters['status']))
    if filters.get('prioridade'):
        stmt = stmt.where(TicketSQL.prioridade.in_(filters['prioridade']))
    if filters.get('responsavel'):
        stmt = stmt.where(TicketSQL.responsavel == filters['responsavel'])
    if filters.get('equipe'):
        stmt = stmt.where(TicketSQL.equipe == filters['equipe'])
    
    stmt = stmt.order_by(TicketSQL.data_abertura.desc())
    result = await session.execute(stmt)
    return result.scalars().all()

async def get_ticket_with_conversas(session: AsyncSession, ticket_id: str):
    """Get ticket with all conversations"""
    from models_sql import TicketSQL
    from sqlalchemy.orm import selectinload
    
    stmt = select(TicketSQL).where(TicketSQL.id == ticket_id).options(
        selectinload(TicketSQL.conversas)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()

# Statistic operations
async def get_dashboard_stats(session: AsyncSession, model, group_by_field: str):
    """Get dashboard statistics grouped by field"""
    stmt = select(
        getattr(model, group_by_field),
        func.count(model.id).label('count')
    ).group_by(getattr(model, group_by_field))
    
    result = await session.execute(stmt)
    return {row[0]: row[1] for row in result.all()}

def convert_to_dict(obj, exclude_relations=False):
    """Convert SQLAlchemy model to dictionary"""
    if obj is None:
        return None
    
    result = {}
    for column in obj.__table__.columns:
        value = getattr(obj, column.name)
        
        # Convert dates and datetimes to strings
        if isinstance(value, (date, datetime)):
            value = value.isoformat()
        
        # Parse JSON strings
        if column.name in ['allowed_cities', 'allowed_sectors', 'contas_pagamento', 'tags', 
                           'documentos_anexos', 'documentos_necessarios', 'arquivos_entrega',
                           'historico_alteracoes', 'checklist_items', 'documentos', 'impostos',
                           'tickets_relacionados', 'documentos_relacionados', 'arquivos',
                           'historico_status', 'anexos', 'log_processamento']:
            value = json_loads(value)
        
        result[column.name] = value
    
    # Include relationships if not excluded
    if not exclude_relations and hasattr(obj, '__mapper__'):
        for rel in obj.__mapper__.relationships:
            if rel.key in ['historico', 'contatos_cobranca', 'anexos', 'conversas', 'movimentos']:
                rel_value = getattr(obj, rel.key, None)
                if rel_value is not None:
                    if isinstance(rel_value, list):
                        result[rel.key] = [convert_to_dict(item, exclude_relations=True) for item in rel_value]
                    else:
                        result[rel.key] = convert_to_dict(rel_value, exclude_relations=True)
    
    return result
