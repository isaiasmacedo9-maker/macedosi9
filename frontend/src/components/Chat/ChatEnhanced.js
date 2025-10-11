import React, { useState, useEffect, useRef } from 'react';
import { Send, Plus, Users, UserPlus, Shield, LogOut, Globe, Lock, MessageSquare } from 'lucide-react';

const ChatEnhanced = () => {
  const [conversations, setConversations] = useState([]);
  const [publicGroups, setPublicGroups] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const [groupForm, setGroupForm] = useState({
    nome: '',
    descricao: '',
    tipo_grupo: 'public',
    member_ids: []
  });

  const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  useEffect(() => {
    loadConversations();
    loadPublicGroups();
    loadUsers();
    
    // Heartbeat para manter status online
    const heartbeatInterval = setInterval(() => {
      sendHeartbeat();
    }, 30000); // A cada 30 segundos

    return () => clearInterval(heartbeatInterval);
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      
      // Atualizar mensagens a cada 3 segundos
      const interval = setInterval(() => {
        loadMessages(selectedConversation.id);
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendHeartbeat = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/chat/heartbeat`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Erro no heartbeat:', error);
    }
  };

  const loadConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/chat/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setConversations(data);
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    }
  };

  const loadPublicGroups = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/chat/public-groups`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setPublicGroups(data);
    } catch (error) {
      console.error('Erro ao carregar grupos públicos:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/users-management/basic`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setAllUsers(data);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/chat/${conversationId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/chat/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: newMessage })
      });

      if (response.ok) {
        setNewMessage('');
        await loadMessages(selectedConversation.id);
        await loadConversations();
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };

  const createDirectChat = async (userId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/chat/direct`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId })
      });

      if (response.ok) {
        const data = await response.json();
        await loadConversations();
        const conv = conversations.find(c => c.id === data.conversation_id);
        if (conv) setSelectedConversation(conv);
        setShowNewChatModal(false);
      }
    } catch (error) {
      console.error('Erro ao criar chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/chat/group`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(groupForm)
      });

      if (response.ok) {
        await loadConversations();
        setShowNewGroupModal(false);
        setGroupForm({ nome: '', descricao: '', tipo_grupo: 'public', member_ids: [] });
        alert('Grupo criado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao criar grupo:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinPublicGroup = async (groupId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/chat/${groupId}/join`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await loadConversations();
        await loadPublicGroups();
        alert('Você entrou no grupo!');
      }
    } catch (error) {
      console.error('Erro ao entrar no grupo:', error);
    }
  };

  const getConversationName = (conv) => {
    if (conv.tipo === 'group') {
      return conv.nome;
    }
    // Para chat direto, mostrar nome do outro usuário
    return conv.nome || 'Chat Direto';
  };

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar - Lista de Conversas */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4">Conversas</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowNewChatModal(true)}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              <MessageSquare size={16} />
              Novo Chat
            </button>
            <button
              onClick={() => setShowNewGroupModal(true)}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              <Users size={16} />
              Novo Grupo
            </button>
          </div>
        </div>

        {/* Lista de Conversas */}
        <div className="flex-1 overflow-y-auto">
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => setSelectedConversation(conv)}
              className={`w-full p-4 text-left hover:bg-gray-700 transition-colors border-b border-gray-700 ${
                selectedConversation?.id === conv.id ? 'bg-gray-700' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {conv.tipo === 'group' ? (
                    <Users size={16} className="text-gray-400" />
                  ) : (
                    <MessageSquare size={16} className="text-gray-400" />
                  )}
                  <span className="font-medium text-white">{getConversationName(conv)}</span>
                </div>
                {conv.unread_count > 0 && (
                  <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                    {conv.unread_count}
                  </span>
                )}
              </div>
              {conv.last_message && (
                <p className="text-sm text-gray-400 truncate">
                  {conv.last_message.message}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                {conv.tipo === 'group' && (
                  <>
                    {conv.tipo_grupo === 'public' ? (
                      <Globe size={12} />
                    ) : (
                      <Lock size={12} />
                    )}
                    <span>{conv.members_count} membros</span>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Grupos Públicos Disponíveis */}
        {publicGroups.length > 0 && (
          <div className="border-t border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Grupos que você não faz parte</h3>
            <div className="space-y-2">
              {publicGroups.map(group => (
                <div key={group.id} className="flex items-center justify-between bg-gray-700 p-2 rounded">
                  <div>
                    <p className="text-white text-sm">{group.nome}</p>
                    <p className="text-xs text-gray-400">{group.members_count} membros</p>
                  </div>
                  <button
                    onClick={() => joinPublicGroup(group.id)}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                  >
                    Entrar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Área de Mensagens */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Header da Conversa */}
            <div className="bg-gray-800 p-4 border-b border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white">{getConversationName(selectedConversation)}</h3>
                {selectedConversation.tipo === 'group' && (
                  <p className="text-sm text-gray-400">
                    {selectedConversation.members_count} membros • {selectedConversation.tipo_grupo === 'public' ? 'Público' : 'Privado'}
                  </p>
                )}
              </div>
              {selectedConversation.tipo === 'group' && (
                <div className="flex gap-2">
                  {selectedConversation.my_role === 'admin' && (
                    <span className="flex items-center gap-1 text-xs bg-red-900/50 text-red-300 px-2 py-1 rounded">
                      <Shield size={12} />
                      Admin
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => {
                const isMe = msg.sender.id === currentUser.id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-md ${isMe ? 'bg-red-600' : 'bg-gray-700'} rounded-lg p-3`}>
                      {!isMe && (
                        <p className="text-xs font-medium text-gray-300 mb-1">{msg.sender.name}</p>
                      )}
                      <p className="text-white">{msg.message}</p>
                      <p className="text-xs text-gray-300 mt-1">
                        {new Date(msg.created_at).toLocaleTimeString('pt-BR', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de Mensagem */}
            <form onSubmit={sendMessage} className="bg-gray-800 p-4 border-t border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                />
                <button
                  type="submit"
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Send size={20} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageSquare size={64} className="mx-auto mb-4 opacity-50" />
              <p>Selecione uma conversa para começar</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal Novo Chat */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Novo Chat</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {allUsers
                .filter(user => user.id !== currentUser.id)
                .map(user => (
                  <button
                    key={user.id}
                    onClick={() => createDirectChat(user.id)}
                    disabled={loading}
                    className="w-full flex items-center gap-3 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-left"
                  >
                    <div className={`w-3 h-3 rounded-full ${user.is_online ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <div>
                      <p className="text-white font-medium">{user.name}</p>
                      <p className="text-sm text-gray-400">{user.email}</p>
                    </div>
                  </button>
                ))}
            </div>
            <button
              onClick={() => setShowNewChatModal(false)}
              className="mt-4 w-full bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal Novo Grupo */}
      {showNewGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">Criar Novo Grupo</h3>
            <form onSubmit={createGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nome do Grupo</label>
                <input
                  type="text"
                  value={groupForm.nome}
                  onChange={(e) => setGroupForm({ ...groupForm, nome: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Descrição (opcional)</label>
                <textarea
                  value={groupForm.descricao}
                  onChange={(e) => setGroupForm({ ...groupForm, descricao: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de Grupo</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="public"
                      checked={groupForm.tipo_grupo === 'public'}
                      onChange={(e) => setGroupForm({ ...groupForm, tipo_grupo: e.target.value })}
                      className="text-red-600"
                    />
                    <Globe size={16} className="text-gray-400" />
                    <span className="text-white">Público (todos podem entrar)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="private"
                      checked={groupForm.tipo_grupo === 'private'}
                      onChange={(e) => setGroupForm({ ...groupForm, tipo_grupo: e.target.value })}
                      className="text-red-600"
                    />
                    <Lock size={16} className="text-gray-400" />
                    <span className="text-white">Privado (apenas convidados)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Selecionar Membros</label>
                <div className="space-y-2 max-h-64 overflow-y-auto bg-gray-700 p-3 rounded-lg">
                  {allUsers
                    .filter(user => user.id !== currentUser.id)
                    .map(user => (
                      <label key={user.id} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-600 rounded">
                        <input
                          type="checkbox"
                          checked={groupForm.member_ids.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setGroupForm({
                                ...groupForm,
                                member_ids: [...groupForm.member_ids, user.id]
                              });
                            } else {
                              setGroupForm({
                                ...groupForm,
                                member_ids: groupForm.member_ids.filter(id => id !== user.id)
                              });
                            }
                          }}
                          className="text-red-600"
                        />
                        <span className="text-white">{user.name}</span>
                      </label>
                    ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition-colors"
                >
                  Criar Grupo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewGroupModal(false);
                    setGroupForm({ nome: '', descricao: '', tipo_grupo: 'public', member_ids: [] });
                  }}
                  className="px-6 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatEnhanced;
