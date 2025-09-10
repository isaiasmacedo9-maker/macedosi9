import json
import os
import uuid
from datetime import datetime, date
from typing import Dict, List, Any, Optional
from pathlib import Path
import hashlib
import shutil
from cryptography.fernet import Fernet
import base64

class JSONDatabase:
    def __init__(self, data_dir: str = "/app/data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        
        # Estrutura de diretórios
        self.collections = {
            'users': 'users.json',
            'companies': 'companies.json',
            'accounts_receivable': 'accounts_receivable.json',
            'financial_clients': 'financial_clients.json',
            'tasks': 'tasks.json',
            'tickets': 'tickets.json',
            'chats': 'chats.json',
            'opportunities': 'opportunities.json',
            'proposals': 'proposals.json',
            'contracts': 'contracts.json',
            'service_orders': 'service_orders.json',
            'trabalhista_requests': 'trabalhista_requests.json',
            'fiscal_obligations': 'fiscal_obligations.json',
            'accounting_entries': 'accounting_entries.json',
            'chart_accounts': 'chart_accounts.json',
            'import_queue': 'import_queue.json',
            'mapping_rules': 'mapping_rules.json',
            'audit_log': 'audit_log.json',
            'settings': 'settings.json',
            'backup_history': 'backup_history.json'
        }
        
        # Inicializar arquivos se não existirem
        self._initialize_collections()
        
        # Configurações gerais
        self.cities = ["jacobina", "ourolandia", "umburanas", "uberlandia"]
        self.sectors = ["comercial", "trabalhista", "fiscal", "financeiro", "contabil", "atendimento"]
        
    def _initialize_collections(self):
        """Inicializa collections vazias se não existirem"""
        for collection, filename in self.collections.items():
            file_path = self.data_dir / filename
            if not file_path.exists():
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump([], f, ensure_ascii=False, indent=2)
    
    def _read_collection(self, collection_name: str) -> List[Dict]:
        """Lê uma collection do JSON"""
        try:
            file_path = self.data_dir / self.collections[collection_name]
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return []
    
    def _write_collection(self, collection_name: str, data: List[Dict]):
        """Escreve uma collection no JSON"""
        file_path = self.data_dir / self.collections[collection_name]
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=self._json_serializer)
    
    def _json_serializer(self, obj):
        """Serializa objetos especiais para JSON"""
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, uuid.UUID):
            return str(obj)
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
    
    def _generate_id(self) -> str:
        """Gera um ID único"""
        return str(uuid.uuid4())
    
    def _add_audit_log(self, action: str, collection: str, record_id: str, user_id: str, changes: Dict = None):
        """Adiciona entrada no log de auditoria"""
        audit_entry = {
            'id': self._generate_id(),
            'timestamp': datetime.now().isoformat(),
            'action': action,
            'collection': collection,
            'record_id': record_id,
            'user_id': user_id,
            'changes': changes or {}
        }
        
        audit_log = self._read_collection('audit_log')
        audit_log.append(audit_entry)
        self._write_collection('audit_log', audit_log)
    
    # CRUD Operations
    def insert(self, collection_name: str, data: Dict, user_id: str = None) -> str:
        """Insere um novo registro"""
        if 'id' not in data:
            data['id'] = self._generate_id()
        
        data['created_at'] = datetime.now().isoformat()
        data['updated_at'] = datetime.now().isoformat()
        
        collection = self._read_collection(collection_name)
        collection.append(data)
        self._write_collection(collection_name, collection)
        
        if user_id:
            self._add_audit_log('INSERT', collection_name, data['id'], user_id, data)
        
        return data['id']
    
    def find(self, collection_name: str, query: Dict = None, limit: int = None, skip: int = 0) -> List[Dict]:
        """Busca registros com filtros"""
        collection = self._read_collection(collection_name)
        
        if query:
            filtered = []
            for item in collection:
                match = True
                for key, value in query.items():
                    if key not in item:
                        match = False
                        break
                    
                    # Suporte a operadores especiais
                    if isinstance(value, dict):
                        if '$in' in value:
                            if item[key] not in value['$in']:
                                match = False
                                break
                        elif '$regex' in value:
                            import re
                            pattern = value['$regex']
                            flags = re.IGNORECASE if value.get('$options') == 'i' else 0
                            if not re.search(pattern, str(item[key]), flags):
                                match = False
                                break
                        elif '$gte' in value:
                            if item[key] < value['$gte']:
                                match = False
                                break
                        elif '$lte' in value:
                            if item[key] > value['$lte']:
                                match = False
                                break
                    else:
                        if item[key] != value:
                            match = False
                            break
                
                if match:
                    filtered.append(item)
            
            collection = filtered
        
        # Aplicar skip e limit
        if skip > 0:
            collection = collection[skip:]
        if limit:
            collection = collection[:limit]
        
        return collection
    
    def find_one(self, collection_name: str, query: Dict) -> Optional[Dict]:
        """Busca um único registro"""
        results = self.find(collection_name, query, limit=1)
        return results[0] if results else None
    
    def update(self, collection_name: str, query: Dict, update_data: Dict, user_id: str = None) -> int:
        """Atualiza registros"""
        collection = self._read_collection(collection_name)
        updated_count = 0
        
        for i, item in enumerate(collection):
            match = True
            for key, value in query.items():
                if key not in item or item[key] != value:
                    match = False
                    break
            
            if match:
                old_data = item.copy()
                item.update(update_data)
                item['updated_at'] = datetime.now().isoformat()
                collection[i] = item
                updated_count += 1
                
                if user_id:
                    changes = {k: {'old': old_data.get(k), 'new': v} for k, v in update_data.items()}
                    self._add_audit_log('UPDATE', collection_name, item['id'], user_id, changes)
        
        if updated_count > 0:
            self._write_collection(collection_name, collection)
        
        return updated_count
    
    def delete(self, collection_name: str, query: Dict, user_id: str = None) -> int:
        """Remove registros"""
        collection = self._read_collection(collection_name)
        deleted_count = 0
        new_collection = []
        
        for item in collection:
            match = True
            for key, value in query.items():
                if key not in item or item[key] != value:
                    match = False
                    break
            
            if match:
                deleted_count += 1
                if user_id:
                    self._add_audit_log('DELETE', collection_name, item['id'], user_id, item)
            else:
                new_collection.append(item)
        
        if deleted_count > 0:
            self._write_collection(collection_name, new_collection)
        
        return deleted_count
    
    def count(self, collection_name: str, query: Dict = None) -> int:
        """Conta registros"""
        return len(self.find(collection_name, query))
    
    # Backup e Restore
    def create_backup(self, backup_name: str = None) -> str:
        """Cria backup completo do sistema"""
        if not backup_name:
            backup_name = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        backup_dir = self.data_dir / 'backups' / backup_name
        backup_dir.mkdir(parents=True, exist_ok=True)
        
        # Copiar todos os arquivos JSON
        for collection, filename in self.collections.items():
            source = self.data_dir / filename
            if source.exists():
                shutil.copy2(source, backup_dir / filename)
        
        # Criar metadados do backup
        metadata = {
            'name': backup_name,
            'created_at': datetime.now().isoformat(),
            'collections': list(self.collections.keys()),
            'checksum': self._calculate_backup_checksum(backup_dir)
        }
        
        with open(backup_dir / 'metadata.json', 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        # Registrar no histórico
        backup_history = self._read_collection('backup_history')
        backup_history.append(metadata)
        self._write_collection('backup_history', backup_history)
        
        return backup_name
    
    def restore_backup(self, backup_name: str) -> bool:
        """Restaura backup"""
        backup_dir = self.data_dir / 'backups' / backup_name
        
        if not backup_dir.exists():
            return False
        
        # Verificar integridade
        metadata_path = backup_dir / 'metadata.json'
        if metadata_path.exists():
            with open(metadata_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            current_checksum = self._calculate_backup_checksum(backup_dir)
            if current_checksum != metadata.get('checksum'):
                raise ValueError("Backup corrupted - checksum mismatch")
        
        # Restaurar arquivos
        for collection, filename in self.collections.items():
            backup_file = backup_dir / filename
            if backup_file.exists():
                shutil.copy2(backup_file, self.data_dir / filename)
        
        return True
    
    def _calculate_backup_checksum(self, backup_dir: Path) -> str:
        """Calcula checksum do backup"""
        hasher = hashlib.sha256()
        
        for collection, filename in self.collections.items():
            file_path = backup_dir / filename
            if file_path.exists():
                with open(file_path, 'rb') as f:
                    hasher.update(f.read())
        
        return hasher.hexdigest()
    
    # Utilitários para cidades e setores
    def check_city_access(self, user_cities: List[str], required_city: str) -> bool:
        """Verifica acesso à cidade"""
        return required_city in user_cities or not user_cities  # Admin tem lista vazia
    
    def check_sector_access(self, user_sectors: List[str], required_sector: str) -> bool:
        """Verifica acesso ao setor"""
        return required_sector in user_sectors or not user_sectors  # Admin tem lista vazia
    
    # Importação de extratos
    def add_to_import_queue(self, import_data: Dict) -> str:
        """Adiciona item na fila de importação"""
        return self.insert('import_queue', import_data)
    
    def get_import_queue(self, status: str = 'pending') -> List[Dict]:
        """Obtém fila de importação"""
        return self.find('import_queue', {'status': status})
    
    def add_mapping_rule(self, rule: Dict) -> str:
        """Adiciona regra de mapeamento automático"""
        return self.insert('mapping_rules', rule)
    
    def get_mapping_rules(self) -> List[Dict]:
        """Obtém regras de mapeamento"""
        return self.find('mapping_rules', {'active': True})

# Instância global do banco
db = JSONDatabase()