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
        self._adapter = None
    
    async def __aenter__(self):
        self._adapter = DatabaseAdapter()
        await self._adapter.__aenter__()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._adapter:
            await self._adapter.__aexit__(exc_type, exc_val, exc_tb)
    
    async def find_one(self, query: Dict) -> Dict:
        """Find single document"""
        if self._adapter:
            return await self._adapter.find_one(self.collection_name, query)
        return None
    
    async def find(self, query: Dict = None, limit: int = 100, skip: int = 0) -> List[Dict]:
        """Find multiple documents"""
        if self._adapter:
            return await self._adapter.find(self.collection_name, query or {}, limit=limit, skip=skip)
        return []
    
    async def insert_one(self, document: Dict) -> Dict:
        """Insert single document"""
        if self._adapter:
            return await self._adapter.insert_one(self.collection_name, document)
        return {}
    
    async def update_one(self, query: Dict, update_data: Dict) -> Dict:
        """Update single document"""
        if self._adapter:
            return await self._adapter.update_one(self.collection_name, query, update_data)
        return {}
    
    async def delete_one(self, query: Dict) -> Dict:
        """Delete single document"""
        if self._adapter:
            return await self._adapter.delete_one(self.collection_name, query)
        return {}
    
    async def count_documents(self, query: Dict = None) -> int:
        """Count documents"""
        if self._adapter:
            return await self._adapter.count_documents(self.collection_name, query or {})
        return 0

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
