"""
Database Adapter - Wrapper que funciona com MongoDB ou SQL
Permite usar SQL mantendo a mesma interface das rotas MongoDB
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional
import json
from datetime import datetime, date

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

USE_SQL = os.environ.get('USE_SQL', 'false').lower() == 'true'

if USE_SQL:
    print("Using SQL database (SQLite)")
    from sqlalchemy import select, update, delete, func
    from sqlalchemy.ext.asyncio import AsyncSession
    from database_sql import AsyncSessionLocal, init_db, close_db
    from models_sql import *
    from crud_sql import json_loads, json_dumps, convert_to_dict
else:
    print("Using MongoDB database")
    from database import connect_to_mongo, close_mongo_connection

class DatabaseAdapter:
    """Adapter pattern to support both MongoDB and SQL"""
    
    def __init__(self):
        self.use_sql = USE_SQL
        self.session = None
    
    async def __aenter__(self):
        if self.use_sql:
            self.session = AsyncSessionLocal()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.use_sql and self.session:
            if exc_type is not None:
                await self.session.rollback()
            else:
                await self.session.commit()
            await self.session.close()
    
    async def find_one(self, collection_name: str, query: Dict):
        """Find single document/record"""
        if not self.use_sql:
            # MongoDB implementation would go here
            raise NotImplementedError("MongoDB support disabled")
        
        model = self._get_sql_model(collection_name)
        stmt = select(model)
        
        # Build WHERE clause from query
        for key, value in query.items():
            if hasattr(model, key):
                stmt = stmt.where(getattr(model, key) == value)
        
        result = await self.session.execute(stmt)
        obj = result.scalar_one_or_none()
        return convert_to_dict(obj) if obj else None
    
    async def find(self, collection_name: str, query: Dict = None, limit: int = 100, skip: int = 0):
        """Find multiple documents/records"""
        if not self.use_sql:
            raise NotImplementedError("MongoDB support disabled")
        
        model = self._get_sql_model(collection_name)
        stmt = select(model)
        
        # Build WHERE clause from query
        if query:
            for key, value in query.items():
                if hasattr(model, key):
                    if isinstance(value, dict) and '$in' in value:
                        stmt = stmt.where(getattr(model, key).in_(value['$in']))
                    elif isinstance(value, dict) and '$gte' in value:
                        stmt = stmt.where(getattr(model, key) >= value['$gte'])
                    elif isinstance(value, dict) and '$lte' in value:
                        stmt = stmt.where(getattr(model, key) <= value['$lte'])
                    else:
                        stmt = stmt.where(getattr(model, key) == value)
        
        stmt = stmt.limit(limit).offset(skip)
        result = await self.session.execute(stmt)
        objects = result.scalars().all()
        # Convert objects without loading relationships to avoid async issues
        return [convert_to_dict(obj, exclude_relations=True) for obj in objects]
    
    async def insert_one(self, collection_name: str, document: Dict):
        """Insert single document/record"""
        if not self.use_sql:
            raise NotImplementedError("MongoDB support disabled")
        
        model = self._get_sql_model(collection_name)
        
        # Convert document to SQL object
        obj = self._dict_to_sql_object(model, document)
        self.session.add(obj)
        await self.session.flush()
        
        return {"inserted_id": obj.id}
    
    async def update_one(self, collection_name: str, query: Dict, update_data: Dict):
        """Update single document/record"""
        if not self.use_sql:
            raise NotImplementedError("MongoDB support disabled")
        
        model = self._get_sql_model(collection_name)
        
        # Extract $set from update
        set_data = update_data.get('$set', update_data)
        
        # Build UPDATE statement
        stmt = update(model)
        for key, value in query.items():
            if hasattr(model, key):
                stmt = stmt.where(getattr(model, key) == value)
        
        # Prepare update values
        update_values = {}
        for key, value in set_data.items():
            if hasattr(model, key):
                # Convert lists/dicts to JSON strings for SQL
                if isinstance(value, (list, dict)):
                    value = json_dumps(value)
                update_values[key] = value
        
        stmt = stmt.values(**update_values)
        result = await self.session.execute(stmt)
        await self.session.flush()
        
        return {"modified_count": result.rowcount}
    
    async def delete_one(self, collection_name: str, query: Dict):
        """Delete single document/record"""
        if not self.use_sql:
            raise NotImplementedError("MongoDB support disabled")
        
        model = self._get_sql_model(collection_name)
        stmt = delete(model)
        
        for key, value in query.items():
            if hasattr(model, key):
                stmt = stmt.where(getattr(model, key) == value)
        
        result = await self.session.execute(stmt)
        await self.session.flush()
        
        return {"deleted_count": result.rowcount}
    
    async def count_documents(self, collection_name: str, query: Dict = None):
        """Count documents/records"""
        if not self.use_sql:
            raise NotImplementedError("MongoDB support disabled")
        
        model = self._get_sql_model(collection_name)
        stmt = select(func.count()).select_from(model)
        
        if query:
            for key, value in query.items():
                if hasattr(model, key):
                    stmt = stmt.where(getattr(model, key) == value)
        
        result = await self.session.execute(stmt)
        return result.scalar()
    
    def _get_sql_model(self, collection_name: str):
        """Map collection name to SQL model"""
        mapping = {
            'users': UserSQL,
            'clients': ClientSQL,
            'financial_clients': FinancialClientSQL,
            'financial_settings': FinancialSettingSQL,
            'contas_receber': ContaReceberSQL,
            'historico_alteracoes': HistoricoAlteracaoSQL,
            'contatos_cobranca': ContatoCobrancaSQL,
            'anexos': AnexoSQL,
            'importacoes_extrato': ImportacaoExtratoSQL,
            'movimentos_extrato': MovimentoExtratoSQL,
            'trabalhista': SolicitacaoTrabalhistaSQL,
            'solicitacoes_trabalhistas': SolicitacaoTrabalhistaSQL,
            'funcionarios': FuncionarioSQL,
            'obrigacoes_trabalhistas': ObrigacaoTrabalhistaSQL,
            'checklists_trabalhistas': ChecklistTrabalhistaSQL,
            'fiscal': ObrigacaoFiscalSQL,
            'obrigacoes_fiscais': ObrigacaoFiscalSQL,
            'notas_fiscais': NotaFiscalSQL,
            'apuracoes_fiscais': ApuracaoFiscalSQL,
            'atendimento': TicketSQL,
            'tickets': TicketSQL,
            'conversas': ConversaSQL,
            'base_conhecimento': ArtigoBaseConhecimentoSQL,
            'avaliacoes_atendimento': AvaliacaoAtendimentoSQL,
            'configuracoes': ConfiguracaoSQL,
            'documents_center': DocumentCenterSQL,
            'chats': ChatSQL,
            'tasks': TaskSQL,
            'guias_fiscais': GuiaFiscalSQL,
            'import_batches': ImportBatchSQL,
            'import_rows': ImportRowSQL,
            'aliases_cliente': AliasClienteSQL,
            'import_settlement_links': ImportSettlementLinkSQL,
        }
        
        model = mapping.get(collection_name)
        if not model:
            raise ValueError(f"Unknown collection: {collection_name}")
        return model
    
    def _dict_to_sql_object(self, model, data: Dict):
        """Convert dictionary to SQL model object"""
        # Handle nested objects
        processed_data = {}
        
        for key, value in data.items():
            if not hasattr(model, key):
                continue
            
            # Convert lists/dicts to JSON strings
            if isinstance(value, (list, dict)) and key not in ['dados_pessoais', 'dados_contratuais', 'endereco']:
                value = json_dumps(value)
            # Flatten nested objects
            elif key == 'endereco' and isinstance(value, dict):
                for nested_key, nested_value in value.items():
                    processed_data[f'endereco_{nested_key}'] = nested_value
                continue
            elif key == 'dados_pessoais' and isinstance(value, dict):
                for nested_key, nested_value in value.items():
                    processed_data[nested_key] = nested_value
                continue
            elif key == 'dados_contratuais' and isinstance(value, dict):
                for nested_key, nested_value in value.items():
                    if nested_key in ['data_admissao', 'data_demissao'] and isinstance(nested_value, str):
                        try:
                            nested_value = datetime.fromisoformat(nested_value).date()
                        except:
                            pass
                    processed_data[nested_key] = nested_value
                continue
            # Convert date strings
            elif 'data_' in key or key.endswith('_date') or key == 'prazo':
                if isinstance(value, str):
                    try:
                        value = datetime.fromisoformat(value.replace('Z', '+00:00'))
                        if 'datetime' not in str(type(model.__table__.columns[key].type)).lower():
                            value = value.date()
                    except:
                        pass
            
            processed_data[key] = value
        
        return model(**processed_data)

# Global adapter instance
_db_adapter = None

async def get_db_adapter():
    """Get or create database adapter instance"""
    global _db_adapter
    if _db_adapter is None:
        _db_adapter = DatabaseAdapter()
    return _db_adapter

# Startup/shutdown functions
async def startup_database():
    """Initialize database on startup"""
    if USE_SQL:
        await init_db()
    else:
        await connect_to_mongo()

async def shutdown_database():
    """Close database on shutdown"""
    if USE_SQL:
        await close_db()
    else:
        await close_mongo_connection()
