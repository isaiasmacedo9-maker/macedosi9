import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../config/api';
import { MessageCircle, Plus, Send } from 'lucide-react';

const Chat = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/chat');
      setChats(response.data || []);
    } catch (error) {
      console.error('Error loading chats:', error);
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !selectedChat) return;

    try {
      await api.post(`/chat/${selectedChat.id}/message`, {
        mensagem: message
      });
      setMessage('');
      // Reload selected chat messages
      loadChats();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold neon-text-white flex items-center">
            <span className="mr-3">💬</span>
            Chat
          </h1>
          <p className="text-gray-400 mt-2">Sistema de comunicação interna</p>
        </div>
        <button
          onClick={() => window.alert('Criacao de novo chat sera disponibilizada nesta tela.')}
          className="btn-futuristic px-6 py-3 rounded-xl text-white font-semibold flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Novo Chat</span>
        </button>
      </div>

      <div className="glass rounded-2xl overflow-hidden" style={{ height: '600px' }}>
        <div className="flex h-full">
          {/* Chat List */}
          <div className="w-1/3 border-r border-red-600/30 p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Conversas</h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="spinner w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full"></div>
              </div>
            ) : chats.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50 text-gray-400" />
                <p className="text-gray-400">Nenhum chat encontrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {chats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className={`w-full text-left p-3 rounded-xl transition-colors ${
                      selectedChat?.id === chat.id
                        ? 'bg-red-600/20 border border-red-600/30'
                        : 'hover:bg-red-600/10 border border-transparent'
                    }`}
                  >
                    <p className="text-white font-medium">{chat.nome}</p>
                    <p className="text-gray-400 text-sm">
                      {chat.mensagens?.length || 0} mensagens
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chat Content */}
          <div className="flex-1 flex flex-col">
            {selectedChat ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-red-600/30">
                  <h3 className="text-lg font-semibold text-white">{selectedChat.nome}</h3>
                  <p className="text-gray-400 text-sm">{selectedChat.descricao}</p>
                </div>

                {/* Messages */}
                <div className="flex-1 p-4 overflow-y-auto">
                  {selectedChat.mensagens?.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400">Nenhuma mensagem ainda</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedChat.mensagens?.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.usuario_id === user?.id ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                              msg.usuario_id === user?.id
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-700 text-white'
                            }`}
                          >
                            <p className="text-sm">{msg.mensagem}</p>
                            <p className="text-xs opacity-75 mt-1">
                              {msg.usuario_nome} • {new Date(msg.timestamp).toLocaleTimeString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Message Input */}
                <div className="p-4 border-t border-red-600/30">
                  <form onSubmit={sendMessage} className="flex space-x-2">
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="input-futuristic flex-1 px-4 py-2 rounded-xl text-white placeholder-gray-400 focus:outline-none"
                      placeholder="Digite sua mensagem..."
                    />
                    <button
                      type="submit"
                      className="btn-futuristic px-4 py-2 rounded-xl text-white"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50 text-gray-400" />
                  <p className="text-gray-400">Selecione um chat para começar</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
