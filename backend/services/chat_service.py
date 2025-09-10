from datetime import datetime
from typing import Dict, List, Optional
from database_json import db
import uuid

class ChatService:
    def __init__(self):
        pass
    
    def create_chat(self, nome: str, tipo: str, admin_id: str, participantes: List[str], 
                   descricao: Optional[str] = None, empresa_id: Optional[str] = None, 
                   setor: Optional[str] = None, cidade: Optional[str] = None) -> str:
        """Cria um novo chat"""
        
        chat_data = {
            'nome': nome,
            'descricao': descricao,
            'tipo': tipo,
            'participantes': list(set([admin_id] + participantes)),  # Garantir que admin está incluído
            'admin_id': admin_id,
            'empresa_id': empresa_id,
            'setor': setor,
            'cidade': cidade,
            'mensagens': [],
            'ativo': True
        }
        
        chat_id = db.insert('chats', chat_data, admin_id)
        
        # Adicionar mensagem de sistema
        self.add_system_message(chat_id, f"Chat '{nome}' criado", admin_id)
        
        return chat_id
    
    def get_user_chats(self, user_id: str, user_cities: List[str], user_sectors: List[str], 
                      is_admin: bool = False) -> List[Dict]:
        """Obtém chats do usuário com base em suas permissões"""
        
        all_chats = db.find('chats', {'ativo': True})
        user_chats = []
        
        for chat in all_chats:
            # Verificar se usuário é participante
            if user_id not in chat.get('participantes', []):
                continue
            
            # Para admin, mostrar todos os chats que participa
            if is_admin:
                user_chats.append(chat)
                continue
            
            # Para colaboradores, verificar permissões de cidade/setor
            chat_cidade = chat.get('cidade')
            chat_setor = chat.get('setor')
            
            # Chat sem restrição de cidade/setor
            if not chat_cidade and not chat_setor:
                user_chats.append(chat)
                continue
            
            # Verificar acesso à cidade
            if chat_cidade and chat_cidade not in user_cities:
                continue
            
            # Verificar acesso ao setor
            if chat_setor and chat_setor not in user_sectors:
                continue
            
            user_chats.append(chat)
        
        # Ordenar por última atividade
        user_chats.sort(key=lambda x: x.get('updated_at', ''), reverse=True)
        
        return user_chats
    
    def add_message(self, chat_id: str, user_id: str, user_name: str, mensagem: str, 
                   tipo: str = "text", arquivo_url: Optional[str] = None) -> str:
        """Adiciona mensagem ao chat"""
        
        chat = db.find_one('chats', {'id': chat_id})
        if not chat:
            raise ValueError("Chat não encontrado")
        
        # Verificar se usuário é participante
        if user_id not in chat.get('participantes', []):
            raise ValueError("Usuário não é participante do chat")
        
        message_data = {
            'id': str(uuid.uuid4()),
            'usuario_id': user_id,
            'usuario_nome': user_name,
            'mensagem': mensagem,
            'timestamp': datetime.now().isoformat(),
            'tipo': tipo,
            'arquivo_url': arquivo_url,
            'editada': False,
            'importante': False
        }
        
        # Adicionar mensagem ao chat
        mensagens_atuais = chat.get('mensagens', [])
        mensagens_atuais.append(message_data)
        
        db.update('chats', {'id': chat_id}, {
            'mensagens': mensagens_atuais,
            'updated_at': datetime.now().isoformat()
        }, user_id)
        
        return message_data['id']
    
    def add_system_message(self, chat_id: str, mensagem: str, user_id: str) -> str:
        """Adiciona mensagem do sistema"""
        return self.add_message(chat_id, 'system', 'Sistema', mensagem, 'system')
    
    def get_chat_messages(self, chat_id: str, user_id: str, limit: int = 50, skip: int = 0) -> Dict:
        """Obtém mensagens do chat"""
        
        chat = db.find_one('chats', {'id': chat_id})
        if not chat:
            raise ValueError("Chat não encontrado")
        
        # Verificar se usuário é participante
        if user_id not in chat.get('participantes', []):
            raise ValueError("Usuário não é participante do chat")
        
        mensagens = chat.get('mensagens', [])
        
        # Ordenar por timestamp (mais recentes primeiro)
        mensagens.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        # Aplicar paginação
        total = len(mensagens)
        mensagens_paginadas = mensagens[skip:skip + limit]
        
        return {
            'chat_id': chat_id,
            'messages': mensagens_paginadas,
            'total': total,
            'skip': skip,
            'limit': limit,
            'chat_info': {
                'nome': chat.get('nome'),
                'tipo': chat.get('tipo'),
                'participantes': chat.get('participantes', []),
                'empresa_id': chat.get('empresa_id'),
                'setor': chat.get('setor'),
                'cidade': chat.get('cidade')
            }
        }
    
    def mark_message_important(self, chat_id: str, message_id: str, user_id: str, importante: bool = True) -> bool:
        """Marca/desmarca mensagem como importante"""
        
        chat = db.find_one('chats', {'id': chat_id})
        if not chat:
            raise ValueError("Chat não encontrado")
        
        # Verificar se usuário é participante
        if user_id not in chat.get('participantes', []):
            raise ValueError("Usuário não é participante do chat")
        
        mensagens = chat.get('mensagens', [])
        message_found = False
        
        for mensagem in mensagens:
            if mensagem.get('id') == message_id:
                mensagem['importante'] = importante
                message_found = True
                break
        
        if not message_found:
            raise ValueError("Mensagem não encontrada")
        
        db.update('chats', {'id': chat_id}, {
            'mensagens': mensagens,
            'updated_at': datetime.now().isoformat()
        }, user_id)
        
        return True
    
    def edit_message(self, chat_id: str, message_id: str, user_id: str, nova_mensagem: str) -> bool:
        """Edita mensagem (apenas o autor pode editar)"""
        
        chat = db.find_one('chats', {'id': chat_id})
        if not chat:
            raise ValueError("Chat não encontrado")
        
        mensagens = chat.get('mensagens', [])
        message_found = False
        
        for mensagem in mensagens:
            if mensagem.get('id') == message_id:
                # Verificar se usuário é o autor da mensagem
                if mensagem.get('usuario_id') != user_id:
                    raise ValueError("Apenas o autor pode editar a mensagem")
                
                mensagem['mensagem'] = nova_mensagem
                mensagem['editada'] = True
                mensagem['editada_em'] = datetime.now().isoformat()
                message_found = True
                break
        
        if not message_found:
            raise ValueError("Mensagem não encontrada")
        
        db.update('chats', {'id': chat_id}, {
            'mensagens': mensagens,
            'updated_at': datetime.now().isoformat()
        }, user_id)
        
        return True
    
    def add_participant(self, chat_id: str, new_user_id: str, admin_user_id: str) -> bool:
        """Adiciona participante ao chat (apenas admin do chat)"""
        
        chat = db.find_one('chats', {'id': chat_id})
        if not chat:
            raise ValueError("Chat não encontrado")
        
        # Verificar se usuário é admin do chat
        if chat.get('admin_id') != admin_user_id:
            raise ValueError("Apenas o administrador pode adicionar participantes")
        
        participantes = chat.get('participantes', [])
        
        if new_user_id not in participantes:
            participantes.append(new_user_id)
            
            # Buscar nome do usuário
            user = db.find_one('users', {'id': new_user_id})
            user_name = user.get('name', 'Usuário') if user else 'Usuário'
            
            db.update('chats', {'id': chat_id}, {
                'participantes': participantes,
                'updated_at': datetime.now().isoformat()
            }, admin_user_id)
            
            # Adicionar mensagem de sistema
            self.add_system_message(chat_id, f"{user_name} foi adicionado ao chat", admin_user_id)
            
            return True
        
        return False
    
    def remove_participant(self, chat_id: str, user_id_to_remove: str, admin_user_id: str) -> bool:
        """Remove participante do chat (apenas admin do chat)"""
        
        chat = db.find_one('chats', {'id': chat_id})
        if not chat:
            raise ValueError("Chat não encontrado")
        
        # Verificar se usuário é admin do chat
        if chat.get('admin_id') != admin_user_id:
            raise ValueError("Apenas o administrador pode remover participantes")
        
        # Não permitir remover o próprio admin
        if user_id_to_remove == admin_user_id:
            raise ValueError("O administrador não pode ser removido")
        
        participantes = chat.get('participantes', [])
        
        if user_id_to_remove in participantes:
            participantes.remove(user_id_to_remove)
            
            # Buscar nome do usuário
            user = db.find_one('users', {'id': user_id_to_remove})
            user_name = user.get('name', 'Usuário') if user else 'Usuário'
            
            db.update('chats', {'id': chat_id}, {
                'participantes': participantes,
                'updated_at': datetime.now().isoformat()
            }, admin_user_id)
            
            # Adicionar mensagem de sistema
            self.add_system_message(chat_id, f"{user_name} foi removido do chat", admin_user_id)
            
            return True
        
        return False
    
    def archive_chat(self, chat_id: str, admin_user_id: str) -> bool:
        """Arquiva chat (apenas admin do chat)"""
        
        chat = db.find_one('chats', {'id': chat_id})
        if not chat:
            raise ValueError("Chat não encontrado")
        
        # Verificar se usuário é admin do chat
        if chat.get('admin_id') != admin_user_id:
            raise ValueError("Apenas o administrador pode arquivar o chat")
        
        db.update('chats', {'id': chat_id}, {
            'ativo': False,
            'arquivado_em': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }, admin_user_id)
        
        # Adicionar mensagem de sistema
        self.add_system_message(chat_id, "Chat arquivado", admin_user_id)
        
        return True
    
    def get_chat_statistics(self, chat_id: str, user_id: str) -> Dict:
        """Obtém estatísticas do chat"""
        
        chat = db.find_one('chats', {'id': chat_id})
        if not chat:
            raise ValueError("Chat não encontrado")
        
        # Verificar se usuário é participante
        if user_id not in chat.get('participantes', []):
            raise ValueError("Usuário não é participante do chat")
        
        mensagens = chat.get('mensagens', [])
        
        # Estatísticas gerais
        total_mensagens = len(mensagens)
        mensagens_importantes = len([m for m in mensagens if m.get('importante', False)])
        
        # Mensagens por usuário
        por_usuario = {}
        for mensagem in mensagens:
            usuario_nome = mensagem.get('usuario_nome', 'Desconhecido')
            por_usuario[usuario_nome] = por_usuario.get(usuario_nome, 0) + 1
        
        # Mensagens por tipo
        por_tipo = {}
        for mensagem in mensagens:
            tipo = mensagem.get('tipo', 'text')
            por_tipo[tipo] = por_tipo.get(tipo, 0) + 1
        
        # Atividade por dia (últimos 30 dias)
        from collections import defaultdict
        atividade_diaria = defaultdict(int)
        
        data_limite = datetime.now().date()
        
        for mensagem in mensagens:
            timestamp = mensagem.get('timestamp')
            if timestamp:
                try:
                    data_mensagem = datetime.fromisoformat(timestamp).date()
                    dias_diferenca = (data_limite - data_mensagem).days
                    
                    if dias_diferenca <= 30:
                        atividade_diaria[data_mensagem.isoformat()] += 1
                except:
                    continue
        
        return {
            'chat_id': chat_id,
            'nome_chat': chat.get('nome'),
            'total_mensagens': total_mensagens,
            'mensagens_importantes': mensagens_importantes,
            'total_participantes': len(chat.get('participantes', [])),
            'mensagens_por_usuario': por_usuario,
            'mensagens_por_tipo': por_tipo,
            'atividade_ultimos_30_dias': dict(atividade_diaria),
            'gerado_em': datetime.now().isoformat()
        }
    
    def search_messages(self, chat_id: str, user_id: str, query: str, limit: int = 20) -> List[Dict]:
        """Busca mensagens no chat"""
        
        chat = db.find_one('chats', {'id': chat_id})
        if not chat:
            raise ValueError("Chat não encontrado")
        
        # Verificar se usuário é participante
        if user_id not in chat.get('participantes', []):
            raise ValueError("Usuário não é participante do chat")
        
        mensagens = chat.get('mensagens', [])
        query_lower = query.lower()
        
        mensagens_encontradas = []
        
        for mensagem in mensagens:
            if query_lower in mensagem.get('mensagem', '').lower():
                mensagens_encontradas.append(mensagem)
                
                if len(mensagens_encontradas) >= limit:
                    break
        
        # Ordenar por timestamp (mais recentes primeiro)
        mensagens_encontradas.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        return mensagens_encontradas