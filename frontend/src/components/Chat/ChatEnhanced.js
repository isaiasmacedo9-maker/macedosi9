import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  FileUp,
  Globe,
  Lock,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Shield,
  Users,
  UserPlus,
  UserMinus,
  UserCog,
  Eye,
} from 'lucide-react';

const CHAT_MESSAGE_META_KEY = 'mock_chat_message_meta_v1';
const ACADEMY_REAL_PROCESSES_KEY = 'mock_macedo_academy_generated_processes_v2';

const parseJson = (value, fallback) => {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const getMessageKey = (msg = {}) => {
  if (msg.id) return String(msg.id);
  return `${msg?.sender?.id || 'unknown'}-${msg?.created_at || ''}-${msg?.message || ''}`;
};

const formatLastSeen = (value) => {
  if (!value) return 'Visto por último: recentemente';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Visto por último: recentemente';
  return `Visto por último: ${date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

const formatFullDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ChatEnhanced = () => {
  const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
  const currentUser = parseJson(localStorage.getItem('user') || '{}', {});
  const isAdmin = currentUser?.role === 'admin';

  const [conversations, setConversations] = useState([]);
  const [publicGroups, setPublicGroups] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [messageMeta, setMessageMeta] = useState({});
  const [selectedMessageKey, setSelectedMessageKey] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [selectedProcessId, setSelectedProcessId] = useState('');
  const [processSelectorOpen, setProcessSelectorOpen] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupMembersLoading, setGroupMembersLoading] = useState(false);
  const [addMemberIds, setAddMemberIds] = useState([]);
  const [showSpecialAccessModal, setShowSpecialAccessModal] = useState(false);
  const [specialAccessUser, setSpecialAccessUser] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const [groupForm, setGroupForm] = useState({
    nome: '',
    descricao: '',
    tipo_grupo: 'public',
    member_ids: [],
  });

  useEffect(() => {
    loadUsers();
    loadConversations();
    loadPublicGroups();
    sendHeartbeat();

    const heartbeatInterval = setInterval(() => {
      sendHeartbeat();
    }, 30000);

    const refreshInterval = setInterval(() => {
      if (specialAccessUser?.id) {
        loadConversations(specialAccessUser.id);
      } else {
        loadConversations();
      }
      loadUsers();
    }, 15000);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(refreshInterval);
    };
  }, [specialAccessUser?.id]);

  useEffect(() => {
    if (!selectedConversation) return;
    loadMessages(selectedConversation.id);
    loadConversationMeta(selectedConversation.id);
    setSelectedMessageKey('');
    setPendingAttachments([]);
    setSelectedProcessId('');

    const interval = setInterval(() => {
      loadMessages(selectedConversation.id);
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedConversation?.id, specialAccessUser?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const userProcesses = useMemo(() => {
    const raw = parseJson(localStorage.getItem(ACADEMY_REAL_PROCESSES_KEY) || '[]', []);
    if (!Array.isArray(raw)) return [];

    const currentUserIds = new Set([currentUser?.id, currentUser?.email].filter(Boolean));
    const processList = raw.filter((proc) => {
      const etapas = Array.isArray(proc?.etapas) ? proc.etapas : [];
      return etapas.some((step) => {
        const stepAssigned = Array.isArray(step?.assignedTo) ? step.assignedTo : [];
        if (stepAssigned.some((id) => currentUserIds.has(id))) return true;
        const tarefas = Array.isArray(step?.tarefas) ? step.tarefas : [];
        return tarefas.some((task) => {
          const taskAssigned = Array.isArray(task?.assignedTo) ? task.assignedTo : [];
          return taskAssigned.some((id) => currentUserIds.has(id));
        });
      });
    });

    return processList.map((proc) => ({
      id: proc.id,
      nome: proc.nome,
      clienteNome: proc.clienteNome || '-',
    }));
  }, [currentUser?.id, currentUser?.email]);

  const selectedProcess = useMemo(
    () => userProcesses.find((item) => item.id === selectedProcessId) || null,
    [userProcesses, selectedProcessId],
  );

  const canManageCurrentGroup = useMemo(
    () =>
      selectedConversation?.tipo === 'group' &&
      selectedConversation?.my_role === 'admin' &&
      !specialAccessUser,
    [selectedConversation, specialAccessUser],
  );

  const sendHeartbeat = async () => {
    if (specialAccessUser) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/chat/heartbeat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error('Erro no heartbeat:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/users-management/basic`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setAllUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const loadConversations = async (adminTargetUserId = null) => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = adminTargetUserId
        ? `${API_URL}/api/chat/admin/${adminTargetUserId}/conversations`
        : `${API_URL}/api/chat/conversations`;
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      const safeList = Array.isArray(data) ? data : [];
      setConversations(safeList);

      if (selectedConversation?.id) {
        const updatedSelected = safeList.find((conv) => conv.id === selectedConversation.id);
        if (updatedSelected) {
          setSelectedConversation(updatedSelected);
        } else {
          setSelectedConversation(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    }
  };

  const loadPublicGroups = async () => {
    if (specialAccessUser) {
      setPublicGroups([]);
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/chat/public-groups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setPublicGroups(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar grupos públicos:', error);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = specialAccessUser?.id
        ? `${API_URL}/api/chat/admin/${specialAccessUser.id}/conversations/${conversationId}/messages`
        : `${API_URL}/api/chat/${conversationId}/messages`;
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      const safeData = Array.isArray(data) ? data : [];
      setMessages(safeData);
      return safeData;
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      return [];
    }
  };

  const loadConversationMembers = async (conversationId) => {
    try {
      setGroupMembersLoading(true);
      const token = localStorage.getItem('token');
      const endpoint = specialAccessUser?.id
        ? `${API_URL}/api/chat/admin/${specialAccessUser.id}/conversations/${conversationId}/members`
        : `${API_URL}/api/chat/${conversationId}/members`;
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setGroupMembers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar membros:', error);
      setGroupMembers([]);
    } finally {
      setGroupMembersLoading(false);
    }
  };

  const loadConversationMeta = (conversationId) => {
    const all = parseJson(localStorage.getItem(CHAT_MESSAGE_META_KEY) || '{}', {});
    const current = all[conversationId] || {};
    setMessageMeta(current && typeof current === 'object' ? current : {});
  };

  const saveConversationMeta = (conversationId, nextMeta) => {
    const all = parseJson(localStorage.getItem(CHAT_MESSAGE_META_KEY) || '{}', {});
    const next = {
      ...all,
      [conversationId]: nextMeta,
    };
    localStorage.setItem(CHAT_MESSAGE_META_KEY, JSON.stringify(next));
    setMessageMeta(nextMeta);
  };

  const persistMetaForMessage = (conversationId, messageKey, payload) => {
    const current = parseJson(localStorage.getItem(CHAT_MESSAGE_META_KEY) || '{}', {});
    const convMeta = current[conversationId] || {};
    const nextConvMeta = {
      ...convMeta,
      [messageKey]: {
        ...(convMeta[messageKey] || {}),
        ...payload,
      },
    };
    saveConversationMeta(conversationId, nextConvMeta);
  };

  const getConversationName = (conv) => {
    if (conv.tipo === 'group') return conv.nome;
    return conv.direct_user?.name || conv.nome || 'Chat Direto';
  };

  const getPresenceText = (conversation) => {
    if (!conversation || conversation.tipo === 'group') return '';
    if (conversation.direct_user?.is_online) return 'Online';
    return formatLastSeen(conversation.direct_user?.last_seen);
  };

  const getSeenByForMessage = (msg) => {
    const msgDate = new Date(msg?.created_at || 0);
    if (selectedConversation?.tipo === 'direct') {
      const other = selectedConversation?.direct_user;
      if (!other) return [];
      if (other.is_online) return [other.name || 'Usuário'];
      if (other.last_seen && new Date(other.last_seen) >= msgDate) return [other.name || 'Usuário'];
      return [];
    }

    if (!groupMembers.length) return [];
    return groupMembers
      .filter((member) => member?.user_id !== msg?.sender?.id)
      .filter((member) => member?.is_online || (member?.last_seen && new Date(member.last_seen) >= msgDate))
      .map((member) => member?.name)
      .filter(Boolean);
  };

  const handleAttachDocuments = (event) => {
    const files = Array.from(event.target.files || []);
    const mapped = files.map((file) => ({
      id: `file-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
    }));
    setPendingAttachments((prev) => [...prev, ...mapped]);
    event.target.value = '';
  };

  const removePendingAttachment = (fileId) => {
    setPendingAttachments((prev) => prev.filter((item) => item.id !== fileId));
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (specialAccessUser) return;
    if (!newMessage.trim() || !selectedConversation) return;

    const outboundText = newMessage.trim();
    const outboundMeta = {
      attachments: pendingAttachments,
      processRef: selectedProcess
        ? {
            id: selectedProcess.id,
            nome: selectedProcess.nome,
            clienteNome: selectedProcess.clienteNome,
          }
        : null,
    };

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/chat/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: outboundText }),
      });

      if (response.ok) {
        setNewMessage('');
        setPendingAttachments([]);
        setSelectedProcessId('');
        setProcessSelectorOpen(false);
        const updatedMessages = await loadMessages(selectedConversation.id);
        await loadConversations();

        const sentMessage = [...updatedMessages]
          .reverse()
          .find((msg) => msg?.sender?.id === currentUser?.id && msg?.message === outboundText);

        if (sentMessage && (outboundMeta.attachments.length || outboundMeta.processRef)) {
          persistMetaForMessage(selectedConversation.id, getMessageKey(sentMessage), outboundMeta);
        }
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };

  const openOrCreateDirectChat = async (userId) => {
    const existing = conversations.find(
      (conv) => conv.tipo === 'direct' && conv.direct_user?.id === userId,
    );
    if (existing) {
      setSelectedConversation(existing);
      setShowNewChatModal(false);
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/chat/direct`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      });

      if (response.ok) {
        const data = await response.json();
        setSpecialAccessUser(null);
        await loadConversations();
        const token2 = localStorage.getItem('token');
        const refreshResponse = await fetch(`${API_URL}/api/chat/conversations`, {
          headers: { Authorization: `Bearer ${token2}` },
        });
        const refreshData = await refreshResponse.json();
        const list = Array.isArray(refreshData) ? refreshData : [];
        setConversations(list);
        const conv = list.find((c) => c.id === data.conversation_id);
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
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(groupForm),
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
    if (specialAccessUser) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/chat/${groupId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
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

  const openMembersModal = async () => {
    if (!selectedConversation || selectedConversation.tipo !== 'group') return;
    setShowMembersModal(true);
    setAddMemberIds([]);
    await loadConversationMembers(selectedConversation.id);
  };

  const handleAddMembers = async () => {
    if (!selectedConversation || !addMemberIds.length) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/chat/${selectedConversation.id}/members/add`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_ids: addMemberIds }),
      });
      if (response.ok) {
        setAddMemberIds([]);
        await loadConversationMembers(selectedConversation.id);
        await loadConversations(specialAccessUser?.id || null);
      } else {
        const err = await response.json();
        alert(err?.detail || 'Não foi possível adicionar membros.');
      }
    } catch (error) {
      console.error('Erro ao adicionar membros:', error);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!selectedConversation) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/chat/${selectedConversation.id}/members/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        await loadConversationMembers(selectedConversation.id);
        await loadConversations(specialAccessUser?.id || null);
      } else {
        const err = await response.json();
        alert(err?.detail || 'Não foi possível remover o membro.');
      }
    } catch (error) {
      console.error('Erro ao remover membro:', error);
    }
  };

  const handleUpdateMemberRole = async (userId, role) => {
    if (!selectedConversation) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/chat/${selectedConversation.id}/members/role`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId, role }),
      });
      if (response.ok) {
        await loadConversationMembers(selectedConversation.id);
        await loadConversations(specialAccessUser?.id || null);
      } else {
        const err = await response.json();
        alert(err?.detail || 'Não foi possível atualizar o papel do membro.');
      }
    } catch (error) {
      console.error('Erro ao atualizar role do membro:', error);
    }
  };

  const applySpecialAccess = async (targetUser) => {
    setSpecialAccessUser(targetUser);
    setSelectedConversation(null);
    setMessages([]);
    await loadConversations(targetUser.id);
    setShowSpecialAccessModal(false);
  };

  const exitSpecialAccess = async () => {
    setSpecialAccessUser(null);
    setSelectedConversation(null);
    setMessages([]);
    await loadConversations();
  };

  const availableUsersToAdd = useMemo(() => {
    const memberIds = new Set(groupMembers.map((m) => m.user_id));
    return allUsers.filter((user) => !memberIds.has(user.id));
  }, [allUsers, groupMembers]);

  return (
    <div className="flex h-[calc(100vh-128px)] overflow-hidden bg-gray-900 rounded-xl border border-gray-700">
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4">Conversas</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowNewChatModal(true)}
              disabled={Boolean(specialAccessUser)}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 disabled:opacity-40 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              <MessageSquare size={16} />
              Novo Chat
            </button>
            <button
              onClick={() => setShowNewGroupModal(true)}
              disabled={Boolean(specialAccessUser)}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 disabled:opacity-40 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              <Users size={16} />
              Novo Grupo
            </button>
          </div>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setShowSpecialAccessModal(true)}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/35 bg-amber-500/15 px-3 py-2 text-xs text-amber-100 hover:bg-amber-500/25"
            >
              <Eye size={14} />
              Acesso especial
            </button>
          ) : null}
          {specialAccessUser ? (
            <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
              <p className="text-xs text-amber-100">Visualizando como: {specialAccessUser.name}</p>
              <button
                type="button"
                onClick={exitSpecialAccess}
                className="mt-1 text-[11px] text-amber-200 underline"
              >
                Sair do acesso especial
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
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
                  <span className="font-medium text-white">{conv.tipo === 'group' ? conv.nome : (conv.direct_user?.name || conv.nome || 'Chat Direto')}</span>
                </div>
                {conv.unread_count > 0 && (
                  <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">{conv.unread_count}</span>
                )}
              </div>
              {conv.last_message && <p className="text-sm text-gray-400 truncate">{conv.last_message.message}</p>}
              {conv.tipo === 'direct' && (
                <p className={`mt-1 text-xs ${conv.direct_user?.is_online ? 'text-green-400' : 'text-gray-500'}`}>
                  {conv.direct_user?.is_online ? 'Online' : formatLastSeen(conv.direct_user?.last_seen)}
                </p>
              )}
              {conv.tipo === 'group' ? (
                <p className="mt-1 text-xs text-gray-500">{conv.members_count} membros</p>
              ) : null}
            </button>
          ))}
        </div>

        {publicGroups.length > 0 && !specialAccessUser && (
          <div className="border-t border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Grupos públicos disponíveis</h3>
            <div className="space-y-2">
              {publicGroups.map((group) => (
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

      <div className="flex-1 flex flex-col min-h-0">
        {selectedConversation ? (
          <>
            <div className="bg-gray-800 p-4 border-b border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white">{getConversationName(selectedConversation)}</h3>
                {selectedConversation.tipo === 'group' ? (
                  <button
                    type="button"
                    onClick={openMembersModal}
                    className="text-sm text-gray-400 hover:text-white underline-offset-2 hover:underline"
                  >
                    {selectedConversation.members_count} membros •{' '}
                    {selectedConversation.tipo_grupo === 'public' ? 'Público' : 'Privado'}
                  </button>
                ) : (
                  <p className={`text-sm ${selectedConversation.direct_user?.is_online ? 'text-green-400' : 'text-gray-400'}`}>
                    {getPresenceText(selectedConversation)}
                  </p>
                )}
              </div>
              {selectedConversation.tipo === 'group' && selectedConversation.my_role === 'admin' && (
                <span className="flex items-center gap-1 text-xs bg-red-900/50 text-red-300 px-2 py-1 rounded">
                  <Shield size={12} />
                  Admin
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {messages.map((msg) => {
                const isMe = msg.sender.id === currentUser.id;
                const msgKey = getMessageKey(msg);
                const meta = messageMeta[msgKey] || {};
                const isSelected = selectedMessageKey === msgKey;
                const seenBy = isMe ? getSeenByForMessage(msg) : [];

                return (
                  <div key={msgKey} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xl ${isMe ? 'bg-red-600' : 'bg-gray-700'} rounded-lg p-3`}>
                      {!isMe && <p className="text-xs font-medium text-gray-300 mb-1">{msg.sender.name}</p>}
                      <button
                        type="button"
                        onClick={() => setSelectedMessageKey((prev) => (prev === msgKey ? '' : msgKey))}
                        className="text-left w-full"
                      >
                        <p className="text-white whitespace-pre-wrap">{msg.message}</p>
                      </button>

                      {meta?.processRef ? (
                        <div className="mt-2 rounded-md border border-white/20 bg-black/20 px-2.5 py-2 text-xs text-white">
                          Processo vinculado: {meta.processRef.nome} ({meta.processRef.clienteNome})
                        </div>
                      ) : null}

                      {Array.isArray(meta?.attachments) && meta.attachments.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {meta.attachments.map((file) => (
                            <div
                              key={file.id || file.name}
                              onContextMenu={(event) => event.preventDefault()}
                              className="rounded-md border border-white/20 bg-black/20 px-2.5 py-1.5 text-xs text-white flex items-center gap-2 select-none"
                            >
                              <FileUp size={12} />
                              <span className="truncate">{file.name}</span>
                              <span className="ml-auto text-[10px] text-gray-300">Download bloqueado</span>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <p className="text-xs text-gray-300 mt-1">
                        {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>

                      {isSelected ? (
                        <div className="mt-2 rounded-md border border-white/20 bg-black/25 p-2 text-xs text-gray-100">
                          <p>Data de envio: {formatFullDate(msg.created_at)}</p>
                          {isMe ? (
                            <>
                              <p className="mt-1">Visualizado por:</p>
                              {seenBy.length ? (
                                <p className="mt-1 text-gray-200">{seenBy.join(', ')}</p>
                              ) : (
                                <p className="mt-1 text-gray-300">Ainda não visualizado.</p>
                              )}
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="bg-gray-800 p-3 border-t border-gray-700">
              {specialAccessUser ? (
                <p className="mb-2 text-xs text-amber-200">
                  Modo leitura do acesso especial ativo. Envio de mensagens desabilitado.
                </p>
              ) : null}

              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={handleAttachDocuments}
                  disabled={Boolean(specialAccessUser)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={Boolean(specialAccessUser)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-gray-700 px-3 py-1.5 text-xs text-white hover:bg-gray-600 disabled:opacity-40"
                >
                  <Paperclip size={14} />
                  Anexar documento
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setProcessSelectorOpen((prev) => !prev)}
                    disabled={Boolean(specialAccessUser)}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-gray-700 px-3 py-1.5 text-xs text-white hover:bg-gray-600 disabled:opacity-40"
                  >
                    <span>{selectedProcess ? `Processo: ${selectedProcess.nome}` : 'Selecionar processo'}</span>
                    <ChevronDown size={13} className={processSelectorOpen ? 'rotate-180 transition' : 'transition'} />
                  </button>
                  {processSelectorOpen ? (
                    <div className="absolute z-20 mt-2 w-80 rounded-lg border border-gray-600 bg-gray-900 p-2 shadow-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProcessId('');
                          setProcessSelectorOpen(false);
                        }}
                        className="w-full text-left rounded px-2 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
                      >
                        Sem processo vinculado
                      </button>
                      <div className="max-h-48 overflow-y-auto">
                        {userProcesses.map((proc) => (
                          <button
                            key={proc.id}
                            type="button"
                            onClick={() => {
                              setSelectedProcessId(proc.id);
                              setProcessSelectorOpen(false);
                            }}
                            className="w-full text-left rounded px-2 py-1.5 text-xs text-white hover:bg-gray-700"
                          >
                            {proc.nome} - {proc.clienteNome}
                          </button>
                        ))}
                        {userProcesses.length === 0 ? (
                          <p className="px-2 py-2 text-xs text-gray-400">Nenhum processo vinculado ao seu usuário.</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {pendingAttachments.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {pendingAttachments.map((file) => (
                    <div key={file.id} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-gray-700 px-3 py-1 text-xs text-white">
                      <span className="max-w-[220px] truncate">{file.name}</span>
                      <button type="button" onClick={() => removePendingAttachment(file.id)} className="text-gray-300 hover:text-white">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  disabled={Boolean(specialAccessUser)}
                  className="flex-1 bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                />
                <button
                  type="submit"
                  disabled={Boolean(specialAccessUser)}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Send size={18} />
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

      {showMembersModal ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Membros do grupo</h3>
              <button
                type="button"
                onClick={() => setShowMembersModal(false)}
                className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm"
              >
                Fechar
              </button>
            </div>

            {groupMembersLoading ? (
              <p className="text-sm text-gray-400">Carregando membros...</p>
            ) : (
              <div className="space-y-2">
                {groupMembers.map((member) => (
                  <div key={member.user_id} className="rounded-lg border border-gray-700 bg-gray-900/40 p-3 flex items-center justify-between gap-3">
                    <div>
                      <button
                        type="button"
                        onClick={() => openOrCreateDirectChat(member.user_id)}
                        className="text-sm font-medium text-white hover:underline"
                      >
                        {member.name}
                      </button>
                      <p className="text-xs text-gray-400">{member.email}</p>
                      <p className="text-xs text-gray-500">{member.is_online ? 'Online' : formatLastSeen(member.last_seen)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] px-2 py-1 rounded ${member.role === 'admin' ? 'bg-red-900/40 text-red-200' : 'bg-gray-700 text-gray-200'}`}>
                        {member.role === 'admin' ? 'Admin' : 'Membro'}
                      </span>
                      {canManageCurrentGroup && member.user_id !== currentUser.id ? (
                        <>
                          {member.role !== 'admin' ? (
                            <button
                              type="button"
                              onClick={() => handleUpdateMemberRole(member.user_id, 'admin')}
                              className="inline-flex items-center gap-1 rounded border border-indigo-500/40 bg-indigo-500/20 px-2 py-1 text-xs text-indigo-100"
                            >
                              <UserCog size={12} />
                              → Transformar em Administrador
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleUpdateMemberRole(member.user_id, 'member')}
                              className="inline-flex items-center gap-1 rounded border border-gray-500/40 bg-gray-500/20 px-2 py-1 text-xs text-gray-100"
                            >
                              <UserCog size={12} />
                              Tornar membro
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.user_id)}
                            className="inline-flex items-center gap-1 rounded border border-red-500/40 bg-red-500/20 px-2 py-1 text-xs text-red-100"
                          >
                            <UserMinus size={12} />
                            Remover
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {canManageCurrentGroup ? (
              <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900/30 p-3">
                <p className="text-sm text-white mb-2">Adicionar membros</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {availableUsersToAdd.map((user) => (
                    <label key={user.id} className="flex items-center gap-2 text-sm text-gray-200">
                      <input
                        type="checkbox"
                        checked={addMemberIds.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAddMemberIds((prev) => [...new Set([...prev, user.id])]);
                          } else {
                            setAddMemberIds((prev) => prev.filter((id) => id !== user.id));
                          }
                        }}
                      />
                      {user.name}
                    </label>
                  ))}
                  {availableUsersToAdd.length === 0 ? (
                    <p className="text-xs text-gray-500">Não há usuários disponíveis para adicionar.</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={handleAddMembers}
                  disabled={!addMemberIds.length}
                  className="mt-3 inline-flex items-center gap-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white px-3 py-2 text-sm"
                >
                  <UserPlus size={14} />
                  Adicionar selecionados
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Novo Chat</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {allUsers
                .filter((user) => user.id !== currentUser.id)
                .map((user) => (
                  <button
                    key={user.id}
                    onClick={() => openOrCreateDirectChat(user.id)}
                    disabled={loading}
                    className="w-full flex items-center gap-3 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-left"
                  >
                    <div className={`w-3 h-3 rounded-full ${user.is_online ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <div>
                      <p className="text-white font-medium">{user.name}</p>
                      <p className="text-sm text-gray-400">{user.is_online ? 'Online' : formatLastSeen(user.last_seen)}</p>
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

      {showSpecialAccessModal && isAdmin ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Acesso especial</h3>
            <p className="text-sm text-gray-300 mb-3">Selecione um colaborador para visualizar conversas e grupos dele.</p>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {allUsers
                .filter((user) => user.id !== currentUser.id)
                .map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => applySpecialAccess(user)}
                    className="w-full rounded-lg bg-gray-700 hover:bg-gray-600 text-left p-3"
                  >
                    <p className="text-white">{user.name}</p>
                    <p className="text-xs text-gray-400">{user.email}</p>
                  </button>
                ))}
            </div>
            <button
              type="button"
              onClick={() => setShowSpecialAccessModal(false)}
              className="mt-4 w-full bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg"
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}

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
                    .filter((user) => user.id !== currentUser.id)
                    .map((user) => (
                      <label key={user.id} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-600 rounded">
                        <input
                          type="checkbox"
                          checked={groupForm.member_ids.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setGroupForm({
                                ...groupForm,
                                member_ids: [...groupForm.member_ids, user.id],
                              });
                            } else {
                              setGroupForm({
                                ...groupForm,
                                member_ids: groupForm.member_ids.filter((id) => id !== user.id),
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
