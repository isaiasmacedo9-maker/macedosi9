"""
Compatibility layer for database operations
Makes MongoDB-style code work with SQL adapter
"""
from database_adapter import DatabaseAdapter
from typing import Dict, Any, List


class CompatCursor:
    """Acts like a MongoDB cursor - both awaitable and async-iterable.
    Supports: await cursor (returns list) and async for item in cursor (iterates).
    """
    
    def __init__(self, collection_name, query, limit=100, skip=0):
        self.collection_name = collection_name
        self.query = query
        self.limit = limit
        self.skip = skip
        self._results = None
        self._index = 0
    
    async def _fetch(self):
        if self._results is None:
            async with DatabaseAdapter() as db:
                self._results = await db.find(
                    self.collection_name, self.query or {},
                    limit=self.limit, skip=self.skip
                )
        return self._results
    
    def __await__(self):
        return self._fetch().__await__()
    
    def __aiter__(self):
        return self
    
    async def __anext__(self):
        if self._results is None:
            await self._fetch()
        if self._index >= len(self._results):
            raise StopAsyncIteration
        item = self._results[self._index]
        self._index += 1
        return item


class AsyncIterableList:
    """Wrapper to make a coroutine result async-iterable like a MongoDB aggregate cursor"""
    def __init__(self, coro):
        self._coro = coro
        self._results = None
        self._index = 0

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._results is None:
            self._results = await self._coro
        if self._index >= len(self._results):
            raise StopAsyncIteration
        item = self._results[self._index]
        self._index += 1
        return item


class CompatCollection:
    """MongoDB-compatible collection wrapper for SQL adapter"""
    
    def __init__(self, collection_name: str):
        self.collection_name = collection_name
    
    async def find_one(self, query: Dict) -> Dict:
        """Find single document"""
        async with DatabaseAdapter() as db:
            return await db.find_one(self.collection_name, query)
    
    def find(self, query: Dict = None, limit: int = 100, skip: int = 0):
        """Find multiple documents - returns cursor (both awaitable and async-iterable)"""
        return CompatCursor(self.collection_name, query or {}, limit=limit, skip=skip)
    
    async def insert_one(self, document: Dict) -> Dict:
        """Insert single document"""
        async with DatabaseAdapter() as db:
            return await db.insert_one(self.collection_name, document)
    
    async def update_one(self, query: Dict, update_data: Dict) -> Dict:
        """Update single document"""
        async with DatabaseAdapter() as db:
            return await db.update_one(self.collection_name, query, update_data)
    
    async def delete_one(self, query: Dict) -> Dict:
        """Delete single document"""
        async with DatabaseAdapter() as db:
            return await db.delete_one(self.collection_name, query)
    
    async def count_documents(self, query: Dict = None) -> int:
        """Count documents"""
        async with DatabaseAdapter() as db:
            return await db.count_documents(self.collection_name, query or {})
    
    def aggregate(self, pipeline: List[Dict]):
        """
        Aggregate - returns async-iterable (like MongoDB cursor).
        NOT async - matches MongoDB driver behavior.
        """
        return AsyncIterableList(self._do_aggregate(pipeline))

    async def _do_aggregate(self, pipeline: List[Dict]) -> List[Dict]:
        """Internal async aggregate implementation"""
        async with DatabaseAdapter() as db:
            all_data = await db.find(self.collection_name, {}, limit=10000)
            
            # Se o pipeline tem $match, aplicar filtro
            if pipeline and pipeline[0].get('$match'):
                match_query = pipeline[0]['$match']
                filtered_data = []
                for doc in all_data:
                    if self._match_document(doc, match_query):
                        filtered_data.append(doc)
                all_data = filtered_data
            
            # Se tem $group, fazer agregação
            for stage in pipeline:
                if '$group' in stage:
                    group_spec = stage['$group']
                    return self._do_group(all_data, group_spec)
            
            # Se tem apenas $count
            if pipeline and pipeline[0].get('$count'):
                return [{'count': len(all_data)}]
            
            return all_data
    
    def _match_document(self, doc: Dict, query: Dict) -> bool:
        """Check if document matches query"""
        from datetime import datetime, date
        for key, value in query.items():
            if key.startswith('$'):
                # Skip MongoDB operators like $or, $and at top level
                continue
            if key not in doc:
                return False
            doc_val = doc[key]
            if isinstance(value, dict):
                # Operadores especiais
                if '$in' in value:
                    if doc_val not in value['$in']:
                        return False
                elif '$gte' in value:
                    try:
                        cmp_val = value['$gte']
                        # Convert string dates to datetime for comparison
                        if isinstance(doc_val, str) and isinstance(cmp_val, (datetime, date)):
                            doc_val = datetime.fromisoformat(doc_val.replace('Z', '+00:00'))
                            if isinstance(cmp_val, date) and not isinstance(cmp_val, datetime):
                                doc_val = doc_val.date() if hasattr(doc_val, 'date') else doc_val
                        if doc_val < cmp_val:
                            return False
                    except (TypeError, ValueError):
                        return False
                elif '$lte' in value:
                    try:
                        cmp_val = value['$lte']
                        if isinstance(doc_val, str) and isinstance(cmp_val, (datetime, date)):
                            doc_val = datetime.fromisoformat(doc_val.replace('Z', '+00:00'))
                            if isinstance(cmp_val, date) and not isinstance(cmp_val, datetime):
                                doc_val = doc_val.date() if hasattr(doc_val, 'date') else doc_val
                        if doc_val > cmp_val:
                            return False
                    except (TypeError, ValueError):
                        return False
                elif '$lt' in value:
                    try:
                        cmp_val = value['$lt']
                        if isinstance(doc_val, str) and isinstance(cmp_val, (datetime, date)):
                            doc_val = datetime.fromisoformat(doc_val.replace('Z', '+00:00'))
                            if isinstance(cmp_val, date) and not isinstance(cmp_val, datetime):
                                doc_val = doc_val.date() if hasattr(doc_val, 'date') else doc_val
                        if doc_val >= cmp_val:
                            return False
                    except (TypeError, ValueError):
                        return False
            elif doc[key] != value:
                return False
        return True
    
    def _do_group(self, data: List[Dict], group_spec: Dict) -> List[Dict]:
        """Perform grouping operation"""
        # Agregação simples por _id
        groups = {}
        id_field = group_spec.get('_id')
        
        for doc in data:
            # Determinar chave de agrupamento
            if id_field == "$situacao":
                group_key = doc.get('situacao', 'unknown')
            elif id_field == "$status":
                group_key = doc.get('status', 'unknown')
            else:
                group_key = 'all'
            
            if group_key not in groups:
                groups[group_key] = {
                    '_id': group_key,
                    'count': 0,
                    'total': 0
                }
            
            groups[group_key]['count'] += 1
            
            # Se tem operações de soma
            for key, operation in group_spec.items():
                if key != '_id' and isinstance(operation, dict):
                    if '$sum' in operation:
                        sum_field = operation['$sum']
                        if sum_field == 1:
                            continue  # Já contamos
                        elif isinstance(sum_field, str) and sum_field.startswith('$'):
                            field_name = sum_field[1:]  # Remove $
                            groups[group_key][key] = groups[group_key].get(key, 0) + doc.get(field_name, 0)
        
        return list(groups.values())

# Wrapper functions that return compat collections
async def get_clients_collection():
    """Get clients collection"""
    return CompatCollection("clients")

async def get_users_collection():
    """Get users collection"""
    return CompatCollection("users")

async def get_chat_enhanced_collection():
    """Get chat enhanced collection"""
    return CompatCollection("chats")

async def get_contas_receber_collection():
    """Get contas a receber collection"""
    return CompatCollection("contas_receber")

async def get_financial_clients_collection():
    """Get financial clients collection"""
    return CompatCollection("financial_clients")

async def get_financial_settings_collection():
    """Get financial settings collection"""
    return CompatCollection("financial_settings")

async def get_importacoes_extrato_collection():
    """Get importacoes extrato collection"""
    return CompatCollection("importacoes_extrato")

async def get_import_batches_collection():
    """Get OFX import batches collection"""
    return CompatCollection("import_batches")

async def get_import_rows_collection():
    """Get OFX import rows collection"""
    return CompatCollection("import_rows")

async def get_aliases_cliente_collection():
    """Get client aliases collection"""
    return CompatCollection("aliases_cliente")

async def get_import_settlement_links_collection():
    """Get settlement links created from import rows"""
    return CompatCollection("import_settlement_links")

async def get_documents_collection():
    """Get documents center collection"""
    return CompatCollection("documents_center")

async def get_clients_setup_collection():
    """Get client setup/configuration collection"""
    return CompatCollection("clients_setup")

async def get_client_portal_users_collection():
    """Get client portal users collection"""
    return CompatCollection("client_portal_users")

async def get_tasks_collection():
    """Get tasks collection"""
    return CompatCollection("tasks")

async def get_tickets_collection():
    """Get tickets collection"""
    return CompatCollection("tickets")

async def get_base_conhecimento_collection():
    """Get base conhecimento collection"""
    return CompatCollection("base_conhecimento")

async def get_avaliacoes_atendimento_collection():
    """Get avaliacoes atendimento collection"""
    return CompatCollection("avaliacoes_atendimento")

async def get_configuracoes_collection():
    """Get configuracoes collection"""
    return CompatCollection("configuracoes")

async def get_chats_collection():
    """Get chats collection"""
    return CompatCollection("chats")

async def get_trabalhista_collection():
    """Get trabalhista/solicitacoes collection"""
    return CompatCollection("solicitacoes_trabalhistas")

async def get_funcionarios_collection():
    """Get funcionarios collection"""
    return CompatCollection("funcionarios")

async def get_obrigacoes_trabalhistas_collection():
    """Get obrigacoes trabalhistas collection"""
    return CompatCollection("obrigacoes_trabalhistas")

async def get_checklists_trabalhistas_collection():
    """Get checklists trabalhistas collection"""
    return CompatCollection("checklists_trabalhistas")

async def get_fiscal_collection():
    """Get fiscal/obrigacoes fiscais collection"""
    return CompatCollection("obrigacoes_fiscais")

async def get_notas_fiscais_collection():
    """Get notas fiscais collection"""
    return CompatCollection("notas_fiscais")

async def get_apuracoes_fiscais_collection():
    """Get apuracoes fiscais collection"""
    return CompatCollection("apuracoes_fiscais")

async def get_atendimento_collection():
    """Get atendimento/tickets collection"""
    return CompatCollection("tickets")
