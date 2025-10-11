"""
Compatibility layer for database operations
Makes MongoDB-style code work with SQL adapter
"""
from database_adapter import DatabaseAdapter
from typing import Dict, Any, List

class CompatCollection:
    """MongoDB-compatible collection wrapper for SQL adapter"""
    
    def __init__(self, collection_name: str):
        self.collection_name = collection_name
    
    async def find_one(self, query: Dict) -> Dict:
        """Find single document"""
        async with DatabaseAdapter() as db:
            return await db.find_one(self.collection_name, query)
    
    async def find(self, query: Dict = None, limit: int = 100, skip: int = 0) -> List[Dict]:
        """Find multiple documents"""
        async with DatabaseAdapter() as db:
            return await db.find(self.collection_name, query or {}, limit=limit, skip=skip)
    
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
    
    async def aggregate(self, pipeline: List[Dict]) -> List[Dict]:
        """
        Aggregate - simplified implementation for basic aggregations
        Suporta operações básicas de agregação do MongoDB
        """
        async with DatabaseAdapter() as db:
            # Para agregações simples, vamos buscar todos os dados e processar
            # Isso funciona para casos básicos como count, sum, group
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
            if len(pipeline) > 1 and pipeline[1].get('$group'):
                group_spec = pipeline[1]['$group']
                return self._do_group(all_data, group_spec)
            
            # Se tem apenas $count
            if pipeline and pipeline[0].get('$count'):
                return [{'count': len(all_data)}]
            
            return all_data
    
    def _match_document(self, doc: Dict, query: Dict) -> bool:
        """Check if document matches query"""
        for key, value in query.items():
            if key not in doc:
                return False
            if isinstance(value, dict):
                # Operadores especiais
                if '$in' in value:
                    if doc[key] not in value['$in']:
                        return False
                elif '$gte' in value:
                    if doc[key] < value['$gte']:
                        return False
                elif '$lte' in value:
                    if doc[key] > value['$lte']:
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

async def get_importacoes_extrato_collection():
    """Get importacoes extrato collection"""
    return CompatCollection("importacoes_extrato")
