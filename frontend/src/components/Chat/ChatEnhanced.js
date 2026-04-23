import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AtSign,
  Bell,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  Copy,
  Eye,
  FileUp,
  Forward,
  Globe,
  Lock,
  List,
  MessageSquare,
  MoreHorizontal,
  PinOff,
  Plus,
  Reply,
  Star,
  Smile,
  Send,
  Shield,
  Users,
  UserPlus,
  UserMinus,
  UserCog,
} from 'lucide-react';
import { Z_LAYERS } from '../../constants/zLayers';
import PinnedMessagesBar from './components/PinnedMessagesBar';
import { buildMessageTimelineItems, formatDaySeparatorLabel } from './helpers/timelineGrouping';
import { computePinExpiresAt, isPinActive } from './helpers/messagePinning';
import { buildPinContractPayload, buildReminderContractPayload } from './contracts/chatMessageContracts';

const CHAT_MESSAGE_META_KEY = 'mock_chat_message_meta_v1';
const ACADEMY_REAL_PROCESSES_KEY = 'mock_macedo_academy_generated_processes_v2';
const NOTIFICATIONS_KEY = 'mock_internal_notifications_v1';
const CHAT_SEEN_MESSAGES_KEY = 'mock_chat_internal_seen_ids_v1';
const CHAT_REMINDERS_KEY = 'mock_chat_internal_reminders_v1';

const PIN_DURATION_OPTIONS = [
  { id: '24h', label: '24 horas', hours: 24 },
  { id: '7d', label: '7 dias', hours: 24 * 7 },
  { id: '30d', label: '30 dias', hours: 24 * 30 },
  { id: 'always', label: 'Tempo indeterminado', hours: null },
];

const DEFAULT_COMPOSER_TEXT_STYLE = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
};

const applyLinePrefixTransform = (value, start, end, prefix) => {
  const safePrefix = String(prefix || '');
  const safeValue = String(value || '');
  const from = Math.max(0, Number(start || 0));
  const to = Math.max(from, Number(end || from));
  const selected = safeValue.slice(from, to);
  const source = selected || safeValue.slice(from);
  const transformed = String(source)
    .split('\n')
    .map((line) => `${safePrefix}${line}`)
    .join('\n');

  if (selected) {
    return {
      nextValue: `${safeValue.slice(0, from)}${transformed}${safeValue.slice(to)}`,
      nextSelectionStart: from,
      nextSelectionEnd: from + transformed.length,
    };
  }

  return {
    nextValue: `${safeValue.slice(0, from)}${transformed}`,
    nextSelectionStart: from + Math.min(transformed.length, safePrefix.length),
    nextSelectionEnd: from + Math.min(transformed.length, safePrefix.length),
  };
};
// Minimal emoji picker (safe, frontend-only) prepared for future integration.
const DEFAULT_EMOJIS = [
  '😀',
  '😁',
  '😂',
  '🤣',
  '🙂',
  '😉',
  '😍',
  '😎',
  '🤔',
  '🙌',
  '👏',
  '👍',
  '👎',
  '🙏',
  '🔥',
  '🎉',
  '✅',
  '❗',
  '📌',
  '📎',
  '🧠',
  '📅',
  '🕒',
];

const EMOJI_PICKER_OPTIONS = [
  '😀', '😁', '😂', '🤣', '🙂', '😉', '😍', '😎', '🤔', '🙌', '👏', '👍', '👎', '🙏', '🔥', '🎉',
  '✅', '❗', '📌', '📎', '🧠', '📝', '🕒', '😊', '😇', '🙃', '😬', '😴', '🥱', '🤯', '🥳', '😭',
  '😡', '🤬', '😱', '🥶', '👀', '🤝', '💪', '👌', '💡', '⏰', '📞', '💬', '📢', '📣', '💼', '📚',
  '💰', '🎯', '🚀', '🏁', '🌟', '❤️',
];

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

const composerToolbarActions = [
  {
    id: 'bold',
    label: 'B',
    title: 'Negrito',
    mode: 'toggle-style',
    styleKey: 'bold',
  },
  {
    id: 'italic',
    label: 'I',
    title: 'Italico',
    mode: 'toggle-style',
    styleKey: 'italic',
  },
  {
    id: 'underline',
    label: 'U',
    title: 'Sublinhado',
    mode: 'toggle-style',
    styleKey: 'underline',
  },
  {
    id: 'strike',
    label: 'S',
    title: 'Riscado',
    mode: 'toggle-style',
    styleKey: 'strike',
  },
  {
    id: 'quote',
    label: '"',
    title: 'Citacao',
    mode: 'insert',
    apply: (value, start, end) => applyLinePrefixTransform(value, start, end, '> '),
  },
  {
    id: 'bullet-list',
    label: '- List',
    title: 'Lista com marcadores',
    mode: 'insert',
    apply: (value, start, end) => applyLinePrefixTransform(value, start, end, '- '),
  },
  {
    id: 'ordered-list',
    label: '1.',
    title: 'Lista numerada',
    mode: 'insert',
    apply: (value, start, end) => {
      const safeValue = String(value || '');
      const from = Math.max(0, Number(start || 0));
      const to = Math.max(from, Number(end || from));
      const selected = safeValue.slice(from, to);
      const source = selected || safeValue.slice(from);
      const transformed = String(source)
        .split('\n')
        .map((line, index) => `${index + 1}. ${line}`)
        .join('\n');
      if (selected) {
        return {
          nextValue: `${safeValue.slice(0, from)}${transformed}${safeValue.slice(to)}`,
          nextSelectionStart: from,
          nextSelectionEnd: from + transformed.length,
        };
      }
      return {
        nextValue: `${safeValue.slice(0, from)}${transformed}`,
        nextSelectionStart: from + 3,
        nextSelectionEnd: from + 3,
      };
    },
  },
];

const normalizeForSearch = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const mentionTokenForUser = (user) => {
  const raw = String(user?.name || '').trim();
  const safe = raw.replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
  return `@${safe || 'usuario'}`;
};

const formatDateTimeCompact = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getActivityLabel = (type) => {
  if (type === 'mention') return 'Mencao';
  if (type === 'dm_reply') return 'Resposta em mensagem direta';
  if (type === 'channel_reply') return 'Resposta em conversa';
  return 'Interacao relevante';
};

const getAttachmentKindLabel = (attachment = {}) => {
  const name = String(attachment?.name || '');
  const type = String(attachment?.type || '');
  if (type.startsWith('image/')) return 'Imagem';
  if (type.startsWith('video/')) return 'Video';
  if (type.startsWith('audio/')) return 'Audio';
  const ext = name.includes('.') ? name.split('.').pop() : '';
  return ext ? ext.toUpperCase() : 'Arquivo';
};

const formatPinExpiry = (expiresAt) => {
  if (!expiresAt) return 'Sem expiracao';
  return `Expira em ${formatDateTimeCompact(expiresAt)}`;
};


const pushInternalChatNotifications = ({ conversation, messages, currentUser }) => {
  if (!conversation || !Array.isArray(messages) || !messages.length) return;
  const currentNotifications = parseJson(localStorage.getItem(NOTIFICATIONS_KEY) || '[]', []);
  const seenMap = parseJson(localStorage.getItem(CHAT_SEEN_MESSAGES_KEY) || '{}', {});
  const currentUserId = String(currentUser?.id || '');

  const nextNotifications = [...(Array.isArray(currentNotifications) ? currentNotifications : [])];

  messages.forEach((message) => {
    const messageId = String(message?.id || '');
    if (!messageId) return;

    const senderId = String(message?.sender?.id || '');
    if (senderId && currentUserId && senderId === currentUserId) return;

    if (Object.prototype.hasOwnProperty.call(seenMap, messageId)) return;

    seenMap[messageId] = false;

    nextNotifications.push({
      id: `ntf-chat-${messageId}`,
      messageId,
      scope: 'chat_macedo',
      title:
        conversation?.tipo === 'group'
          ? `Grupo: ${conversation?.nome || 'Sem nome'}`
          : `Chat: ${conversation?.direct_user?.name || conversation?.nome || 'Conversa'}`,
      message: message?.message || 'Nova mensagem',
      createdAt: message?.created_at || new Date().toISOString(),
      read: false,
    });
  });

  localStorage.setItem(CHAT_SEEN_MESSAGES_KEY, JSON.stringify(seenMap));
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(nextNotifications));
};

const ChatEnhanced = () => {
  const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
  const navigate = useNavigate();
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
  const [composerMenuOpen, setComposerMenuOpen] = useState(false);
  const [composerMenuActiveIndex, setComposerMenuActiveIndex] = useState(0);
  const [processSelectorOpen, setProcessSelectorOpen] = useState(false);
  const [showFormattingToolbar, setShowFormattingToolbar] = useState(false);
  const [composerTextStyle, setComposerTextStyle] = useState(DEFAULT_COMPOSER_TEXT_STYLE);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [mentionState, setMentionState] = useState({
    open: false,
    query: '',
    start: 0,
    end: 0,
    activeIndex: 0,
  });
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupMembersLoading, setGroupMembersLoading] = useState(false);
  const [addMemberIds, setAddMemberIds] = useState([]);
  const [showSpecialAccessModal, setShowSpecialAccessModal] = useState(false);
  const [specialAccessUser, setSpecialAccessUser] = useState(null);
  const [linkedProcessesSource, setLinkedProcessesSource] = useState([]);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState('activities');
  const [activitiesUnreadOnly, setActivitiesUnreadOnly] = useState(false);
  const [messageActionsOpenKey, setMessageActionsOpenKey] = useState('');
  const [actionFeedback, setActionFeedback] = useState('');
  const [highlightedMessageKey, setHighlightedMessageKey] = useState('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const composerInputRef = useRef(null);
  const composerMenuRef = useRef(null);
  const composerMenuItemRefs = useRef([]);
  const emojiButtonRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const mentionListRef = useRef(null);
  const mentionItemRefs = useRef([]);
  const messageActionMenuRef = useRef(null);
  const messageItemRefs = useRef({});

  const [groupForm, setGroupForm] = useState({
    nome: '',
    descricao: '',
    tipo_grupo: 'public',
    member_ids: [],
  });

  const currentUserIdentity = useMemo(() => {
    const ids = new Set();
    if (currentUser?.id) ids.add(String(currentUser.id).trim());
    if (currentUser?.email) ids.add(String(currentUser.email).trim().toLowerCase());
    const name = normalizeForSearch(currentUser?.name || '');
    return { ids, name };
  }, [currentUser?.email, currentUser?.id, currentUser?.name]);

  const isProcessAssignedToCurrentUser = (proc) => {
    const direct = new Set([
      proc?.responsavel_id,
      proc?.responsavel_email,
      ...(Array.isArray(proc?.assigned_to) ? proc.assigned_to : []),
      ...(Array.isArray(proc?.assignedTo) ? proc.assignedTo : []),
    ].filter(Boolean).map((value) => String(value).trim()));

    if (proc?.responsavel_email) {
      direct.add(String(proc.responsavel_email).trim().toLowerCase());
    }

    if (proc?.colaboradores_por_setor && typeof proc.colaboradores_por_setor === 'object') {
      Object.values(proc.colaboradores_por_setor).forEach((list) => {
        if (Array.isArray(list)) list.forEach((value) => direct.add(String(value).trim()));
      });
    }

    const byIdOrEmail = Array.from(currentUserIdentity.ids).some((id) => direct.has(id));
    if (byIdOrEmail) return true;

    const responsibleName = normalizeForSearch(
      proc?.responsavel_nome || proc?.responsavel_conta || proc?.colaborador_responsavel || proc?.colaborador_lancamento_nome || '',
    );
    if (responsibleName && currentUserIdentity.name && responsibleName === currentUserIdentity.name) return true;

    const etapas = Array.isArray(proc?.etapas) ? proc.etapas : [];
    return etapas.some((step) => {
      const stepAssigned = Array.isArray(step?.assignedTo) ? step.assignedTo : [];
      if (stepAssigned.some((value) => currentUserIdentity.ids.has(String(value).trim()))) return true;
      const tarefas = Array.isArray(step?.tarefas) ? step.tarefas : [];
      return tarefas.some((task) => {
        const taskAssigned = Array.isArray(task?.assignedTo) ? task.assignedTo : [];
        return taskAssigned.some((value) => currentUserIdentity.ids.has(String(value).trim()));
      });
    });
  };

  useEffect(() => {
    loadUsers();
    loadConversations();
    loadPublicGroups();
    loadLinkedProcesses();
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
      loadLinkedProcesses();
    }, 15000);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(refreshInterval);
    };
  }, [specialAccessUser?.id]);

  const loadLinkedProcesses = async () => {
    const token = localStorage.getItem('token');
    let backendProcesses = [];
    try {
      const response = await fetch(`${API_URL}/api/services/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const payload = await response.json();
        backendProcesses = Array.isArray(payload) ? payload : [];
      }
    } catch {}

    const fromMockServices = parseJson(localStorage.getItem('mock_internal_services') || '[]', []);
    const fromAcademy = parseJson(localStorage.getItem(ACADEMY_REAL_PROCESSES_KEY) || '[]', []);
    const merged = []
      .concat(Array.isArray(backendProcesses) ? backendProcesses : [])
      .concat(Array.isArray(fromMockServices) ? fromMockServices : [])
      .concat(Array.isArray(fromAcademy) ? fromAcademy : []);

    const unique = [];
    const seen = new Set();
    merged.forEach((item, index) => {
      const key = String(item?.id || `${item?.nome || item?.tipo_servico || 'proc'}-${index}`);
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(item);
    });
    setLinkedProcessesSource(unique);
  };

  useEffect(() => {
    if (!selectedConversation) return;
    loadMessages(selectedConversation.id);
    loadConversationMeta(selectedConversation.id);
    setSelectedMessageKey('');
    setPendingAttachments([]);
    setSelectedProcessId('');
    setComposerMenuOpen(false);
    setProcessSelectorOpen(false);
    setShowFormattingToolbar(false);
    setComposerTextStyle(DEFAULT_COMPOSER_TEXT_STYLE);
    setEmojiPickerOpen(false);
    setMentionState((prev) => ({ ...prev, open: false, query: '', activeIndex: 0 }));
    setSidePanelOpen(false);
    setSidePanelTab('activities');
    setActivitiesUnreadOnly(false);
    setMessageActionsOpenKey('');
    setActionFeedback('');
    setHighlightedMessageKey('');

    const interval = setInterval(() => {
      loadMessages(selectedConversation.id);
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedConversation?.id, specialAccessUser?.id]);

  const getTextRenderStyle = (style = DEFAULT_COMPOSER_TEXT_STYLE) => {
    const safe = { ...DEFAULT_COMPOSER_TEXT_STYLE, ...(style || {}) };
    const decorations = [];
    if (safe.underline) decorations.push('underline');
    if (safe.strike) decorations.push('line-through');
    return {
      fontWeight: safe.bold ? 700 : 400,
      fontStyle: safe.italic ? 'italic' : 'normal',
      textDecoration: decorations.length ? decorations.join(' ') : 'none',
    };
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!composerMenuOpen) return undefined;

    const handleOutsideComposerMenu = (event) => {
      if (composerMenuRef.current?.contains(event.target)) return;
      setComposerMenuOpen(false);
      setProcessSelectorOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideComposerMenu);
    return () => document.removeEventListener('mousedown', handleOutsideComposerMenu);
  }, [composerMenuOpen]);

  useEffect(() => {
    if (!emojiPickerOpen) return undefined;

    const handleOutsideEmojiPicker = (event) => {
      if (emojiPickerRef.current?.contains(event.target)) return;
      if (emojiButtonRef.current?.contains(event.target)) return;
      setEmojiPickerOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideEmojiPicker);
    return () => document.removeEventListener('mousedown', handleOutsideEmojiPicker);
  }, [emojiPickerOpen]);

  useEffect(() => {
    if (!mentionState.open) return undefined;

    const handleOutsideMentions = (event) => {
      if (mentionListRef.current?.contains(event.target)) return;
      setMentionState((prev) => ({ ...prev, open: false }));
    };

    document.addEventListener('mousedown', handleOutsideMentions);
    return () => document.removeEventListener('mousedown', handleOutsideMentions);
  }, [mentionState.open]);

  useEffect(() => {
    if (!messageActionsOpenKey) return undefined;

    const handleOutsideMessageActions = (event) => {
      if (messageActionMenuRef.current?.contains(event.target)) return;
      setMessageActionsOpenKey('');
    };

    document.addEventListener('mousedown', handleOutsideMessageActions);
    return () => document.removeEventListener('mousedown', handleOutsideMessageActions);
  }, [messageActionsOpenKey]);

  useEffect(() => {
    if (!actionFeedback) return undefined;
    const timeout = setTimeout(() => setActionFeedback(''), 2200);
    return () => clearTimeout(timeout);
  }, [actionFeedback]);

  useEffect(() => {
    if (!composerMenuOpen) return;
    setComposerMenuActiveIndex(0);
    requestAnimationFrame(() => {
      composerMenuItemRefs.current?.[0]?.focus?.();
    });
  }, [composerMenuOpen]);

  useEffect(() => {
    if (!mentionState.open) return;
    const index = Math.max(0, Math.min(Number(mentionState.activeIndex ?? 0), mentionItemRefs.current.length - 1));
    const node = mentionItemRefs.current?.[index];
    node?.scrollIntoView?.({ block: 'nearest' });
  }, [mentionState.open, mentionState.activeIndex]);

  const userProcesses = useMemo(() => {
    const source = Array.isArray(linkedProcessesSource) ? linkedProcessesSource : [];
    return source
      .filter((proc) => isProcessAssignedToCurrentUser(proc))
      .map((proc) => ({
        id: proc.id,
        nome: proc.nome || proc.tipo_servico || proc.titulo || 'Processo',
        clienteNome: proc.clienteNome || proc.empresa_nome || proc.cliente_nome || '-',
      }));
  }, [linkedProcessesSource, currentUserIdentity]);

  const selectedProcess = useMemo(
    () => userProcesses.find((item) => item.id === selectedProcessId) || null,
    [userProcesses, selectedProcessId],
  );

  const openLinkedProcessDetails = (processRef) => {
    const processId = String(processRef?.id || '').trim();
    if (!processId) {
      setActionFeedback('Processo vinculado sem identificador para abrir detalhes.');
      return;
    }
    const params = new URLSearchParams();
    params.set('servicoId', processId);
    params.set('tab', 'processos');
    params.set('scope', 'cliente');
    navigate(`/servicos?${params.toString()}`);
  };

  const canManageCurrentGroup = useMemo(
    () =>
      selectedConversation?.tipo === 'group' &&
      selectedConversation?.my_role === 'admin' &&
      !specialAccessUser,
    [selectedConversation, specialAccessUser],
  );

  const activityItems = useMemo(() => {
    const seenMap = parseJson(localStorage.getItem(CHAT_SEEN_MESSAGES_KEY) || '{}', {});
    const myToken = mentionTokenForUser(currentUser);
    const safeMessages = Array.isArray(messages) ? messages : [];

    return safeMessages
      .map((msg) => {
        const msgKey = String(msg?.id || '');
        const unread = msgKey ? seenMap[msgKey] === false : false;
        const isMention = String(msg?.message || '').includes(myToken);
        const type = isMention
          ? 'mention'
          : selectedConversation?.tipo === 'direct'
            ? 'dm_reply'
            : 'channel_reply';
        const hasRelevantInteraction = Boolean(
          messageMeta?.[getMessageKey(msg)]?.processRef ||
            (Array.isArray(messageMeta?.[getMessageKey(msg)]?.attachments) &&
              messageMeta[getMessageKey(msg)].attachments.length),
        );

        return {
          id: getMessageKey(msg),
          type: hasRelevantInteraction && !isMention ? 'relevant_interaction' : type,
          senderName: msg?.sender?.name || 'Usuario',
          text: msg?.message || '',
          createdAt: msg?.created_at || '',
          unread,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [messages, selectedConversation?.tipo, currentUser, messageMeta]);

  const visibleActivityItems = useMemo(() => {
    if (!activitiesUnreadOnly) return activityItems;
    return activityItems.filter((item) => item.unread);
  }, [activityItems, activitiesUnreadOnly]);

  const conversationFiles = useMemo(() => {
    const safeMessages = Array.isArray(messages) ? messages : [];
    const list = [];

    safeMessages.forEach((msg) => {
      const msgMeta = messageMeta?.[getMessageKey(msg)] || {};
      const attachments = Array.isArray(msgMeta?.attachments) ? msgMeta.attachments : [];
      attachments.forEach((attachment, index) => {
        list.push({
          id: `${getMessageKey(msg)}-${attachment?.id || index}`,
          name: attachment?.name || 'Arquivo sem nome',
          type: getAttachmentKindLabel(attachment),
          senderName: msg?.sender?.name || 'Usuario',
          createdAt: msg?.created_at || '',
          isImage: String(attachment?.type || '').startsWith('image/'),
        });
      });
    });

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [messages, messageMeta]);

  const messageTimelineItems = useMemo(() => {
    return buildMessageTimelineItems(messages, getMessageKey);
  }, [messages]);

  const pinnedMessages = useMemo(() => {
    const safeMessages = Array.isArray(messages) ? messages : [];
    return safeMessages
      .map((msg) => {
        const msgKey = getMessageKey(msg);
        const meta = messageMeta?.[msgKey] || {};
        if (!isPinActive(meta)) return null;
        return {
          key: msgKey,
          message: msg,
          pinConfig: meta.pinConfig,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.pinConfig?.pinnedAt || 0).getTime() - new Date(a.pinConfig?.pinnedAt || 0).getTime());
  }, [messages, messageMeta]);

  useEffect(() => {
    if (!selectedConversation?.id) return;
    const keysToClear = Object.entries(messageMeta || {})
      .filter(([, meta]) => meta?.pinConfig?.expiresAt)
      .filter(([, meta]) => !isPinActive(meta))
      .map(([key]) => key);

    if (!keysToClear.length) return;

    const nextMeta = { ...(messageMeta || {}) };
    keysToClear.forEach((key) => {
      nextMeta[key] = {
        ...(nextMeta[key] || {}),
        pinConfig: null,
      };
    });
    saveConversationMeta(selectedConversation.id, nextMeta);
  }, [selectedConversation?.id, messageMeta]);

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
      const conversation = conversations.find((item) => item.id === conversationId) || selectedConversation;
      pushInternalChatNotifications({ conversation, messages: safeData, currentUser });
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

  const updateCurrentConversationMessageMeta = (messageKey, updater) => {
    if (!selectedConversation?.id || !messageKey) return;
    const currentMeta = parseJson(localStorage.getItem(CHAT_MESSAGE_META_KEY) || '{}', {});
    const convMeta = currentMeta[selectedConversation.id] || {};
    const currentEntry = convMeta[messageKey] || {};
    const patch = typeof updater === 'function' ? updater(currentEntry) : updater;
    const nextEntry = { ...currentEntry, ...(patch || {}) };
    const nextConvMeta = { ...convMeta, [messageKey]: nextEntry };
    saveConversationMeta(selectedConversation.id, nextConvMeta);
  };

  const handleReplyToMessage = (msg) => {
    const sender = msg?.sender?.name || 'Usuario';
    const text = String(msg?.message || '').slice(0, 140);
    const prefix = `↪ ${sender}: ${text}\n`;
    setNewMessage((prev) => `${prefix}${prev || ''}`);
    setMessageActionsOpenKey('');
    requestAnimationFrame(() => composerInputRef.current?.focus());
  };

  const handleForwardMessage = (msg) => {
    const sender = msg?.sender?.name || 'Usuario';
    const text = String(msg?.message || '');
    const forwardText = `[Encaminhada de ${sender}] ${text}`;
    setNewMessage((prev) => (prev ? `${prev}\n${forwardText}` : forwardText));
    setMessageActionsOpenKey('');
    setActionFeedback('Mensagem preparada para encaminhamento.');
    requestAnimationFrame(() => composerInputRef.current?.focus());
  };

  const handleSaveMessage = (messageKey) => {
    updateCurrentConversationMessageMeta(messageKey, (entry) => ({
      saved: !entry?.saved,
    }));
    setMessageActionsOpenKey('');
    setActionFeedback('Estado de mensagem salva atualizado.');
  };

  const handleCopyMessage = async (text) => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      setActionFeedback('Mensagem copiada.');
    } catch {
      setActionFeedback('Nao foi possivel copiar automaticamente.');
    } finally {
      setMessageActionsOpenKey('');
    }
  };

  const appendChatNotification = ({ messageId = '', title = 'Chat interno', message = '' }) => {
    const currentNotifications = parseJson(localStorage.getItem(NOTIFICATIONS_KEY) || '[]', []);
    const safeList = Array.isArray(currentNotifications) ? currentNotifications : [];
    const messageKey = String(messageId || '');
    const alreadyExists = safeList.some((item) => {
      if (!item) return false;
      if (messageKey && String(item.messageId || '') === messageKey) return true;
      return normalizeForSearch(item.message || '') === normalizeForSearch(message || '');
    });
    if (alreadyExists) return;
    const next = [
      ...safeList,
      {
        id: `ntf-chat-manual-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        messageId: messageKey || undefined,
        scope: 'chat_macedo',
        title: String(title || 'Chat interno'),
        message: String(message || ''),
        createdAt: new Date().toISOString(),
        read: false,
      },
    ];
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
  };

  const handleMarkAsUnreadFromMessage = (msg) => {
    const messageId = String(msg?.id || '');
    if (!messageId) {
      setActionFeedback('Mensagem sem identificador para marcar não lida.');
      return;
    }
    const seenMap = parseJson(localStorage.getItem(CHAT_SEEN_MESSAGES_KEY) || '{}', {});
    seenMap[messageId] = false;
    localStorage.setItem(CHAT_SEEN_MESSAGES_KEY, JSON.stringify(seenMap));
    appendChatNotification({
      messageId,
      title:
        selectedConversation?.tipo === 'group'
          ? `Grupo: ${selectedConversation?.nome || 'Sem nome'}`
          : `Chat: ${selectedConversation?.direct_user?.name || selectedConversation?.nome || 'Conversa'}`,
      message: msg?.message || 'Mensagem marcada como nao lida.',
    });
    setMessageActionsOpenKey('');
    setActionFeedback('Mensagem marcada como não lida.');
  };

  const handleCreateReminder = (msg, messageKey) => {
    const reminders = parseJson(localStorage.getItem(CHAT_REMINDERS_KEY) || '[]', []);
    const contract = buildReminderContractPayload({
      conversationId: selectedConversation?.id || '',
      messageKey,
      text: msg?.message || '',
    });
    const payload = {
      id: `reminder-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      conversationId: contract.conversationId,
      messageKey: contract.messageKey,
      text: contract.text,
      createdAt: contract.requestedAt,
      status: 'pending_backend',
      contract,
    };
    localStorage.setItem(CHAT_REMINDERS_KEY, JSON.stringify([...(Array.isArray(reminders) ? reminders : []), payload]));
    appendChatNotification({
      messageId: msg?.id || messageKey,
      title: 'Lembrete criado',
      message: `Lembrete: ${String(msg?.message || '').slice(0, 120) || 'Mensagem do chat'}`,
    });
    setMessageActionsOpenKey('');
    setActionFeedback('Lembrete registrado (pendente de backend).');
  };

  const handleQuickInteraction = (messageKey, interaction) => {
    updateCurrentConversationMessageMeta(messageKey, (entry) => ({
      quickInteraction: entry?.quickInteraction === interaction ? '' : interaction,
      quickInteractionAt: new Date().toISOString(),
    }));
    setActionFeedback('Interacao atualizada.');
  };

  const handlePinMessage = (messageKey, durationOption, msgCreatedAt) => {
    const expiresAt = computePinExpiresAt(msgCreatedAt || Date.now(), durationOption.hours);
    const contract = buildPinContractPayload({
      conversationId: selectedConversation?.id || '',
      messageKey,
      durationId: durationOption.id,
      expiresAt,
    });
    updateCurrentConversationMessageMeta(messageKey, () => ({
      pinConfig: {
        pinnedAt: contract.requestedAt,
        durationId: durationOption.id,
        expiresAt,
        contract,
      },
    }));
    setMessageActionsOpenKey('');
    setActionFeedback(`Mensagem fixada (${durationOption.label}).`);
  };

  const handleUnpinMessage = (messageKey) => {
    updateCurrentConversationMessageMeta(messageKey, () => ({
      pinConfig: null,
    }));
    setMessageActionsOpenKey('');
    setActionFeedback('Mensagem desafixada.');
  };

  const scrollToMessage = (messageKey) => {
    const target = messageItemRefs.current?.[messageKey];
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageKey(messageKey);
    setTimeout(() => {
      setHighlightedMessageKey((current) => (current === messageKey ? '' : current));
    }, 1800);
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
      rawFile: file,
    }));
    setPendingAttachments((prev) => [...prev, ...mapped]);
    event.target.value = '';
  };

  const removePendingAttachment = (fileId) => {
    setPendingAttachments((prev) => prev.filter((item) => item.id !== fileId));
  };

  const updateMentionFromValue = (value, cursorIndex) => {
    const cursor = Math.max(0, Math.min(Number(cursorIndex ?? value.length), value.length));
    const beforeCursor = value.slice(0, cursor);
    const atIndex = beforeCursor.lastIndexOf('@');

    if (atIndex < 0) {
      setMentionState((prev) => ({ ...prev, open: false, query: '' }));
      return;
    }

    const charBefore = atIndex === 0 ? ' ' : beforeCursor[atIndex - 1];
    const isBoundary = /\s|[([{"'.,;:!?]/.test(charBefore);
    if (!isBoundary) {
      setMentionState((prev) => ({ ...prev, open: false, query: '' }));
      return;
    }

    const query = beforeCursor.slice(atIndex + 1);
    if (/\s/.test(query)) {
      setMentionState((prev) => ({ ...prev, open: false, query: '' }));
      return;
    }

    setMentionState({
      open: true,
      query,
      start: atIndex,
      end: cursor,
      activeIndex: 0,
    });
  };

  const applyComposerTransform = (transform) => {
    const input = composerInputRef.current;
    const value = newMessage || '';
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    const result = transform(value, start, end);

    setNewMessage(result.nextValue);

    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
      if (typeof result.nextSelectionStart === 'number' && typeof result.nextSelectionEnd === 'number') {
        composerInputRef.current?.setSelectionRange(result.nextSelectionStart, result.nextSelectionEnd);
        updateMentionFromValue(result.nextValue, result.nextSelectionEnd);
      }
    });
  };

  const insertComposerText = (text) => {
    applyComposerTransform((value, start, end) => ({
      nextValue: `${value.slice(0, start)}${text}${value.slice(end)}`,
      nextSelectionStart: start + text.length,
      nextSelectionEnd: start + text.length,
    }));
  };

  const handleToolbarAction = (action) => {
    if (action?.mode === 'toggle-style' && action?.styleKey) {
      setComposerTextStyle((prev) => ({
        ...prev,
        [action.styleKey]: !prev[action.styleKey],
      }));
      composerInputRef.current?.focus();
      return;
    }
    if (typeof action?.apply === 'function') {
      applyComposerTransform(action.apply);
    }
  };

  const handleInsertList = () => {
    applyComposerTransform((value, start, end) => {
      if (start !== end) return applyLinePrefixTransform(value, start, end, '- ');
      const safeValue = String(value || '');
      const insertion = safeValue ? '\n- ' : '- ';
      return {
        nextValue: `${safeValue.slice(0, start)}${insertion}${safeValue.slice(end)}`,
        nextSelectionStart: start + insertion.length,
        nextSelectionEnd: start + insertion.length,
      };
    });
    setComposerMenuOpen(false);
    setProcessSelectorOpen(false);
  };

  const handleUploadFromComputer = () => {
    fileInputRef.current?.click();
    setComposerMenuOpen(false);
    setProcessSelectorOpen(false);
  };

  const handleInsertMention = () => {
    setEmojiPickerOpen(false);
    setComposerMenuOpen(false);
    setProcessSelectorOpen(false);
    insertComposerText('@');
  };

  const handleInsertEmoji = () => {
    setComposerMenuOpen(false);
    setProcessSelectorOpen(false);
    setMentionState((prev) => ({ ...prev, open: false }));
    setEmojiPickerOpen((prev) => !prev);
  };

  const handleSelectEmoji = (emoji) => {
    insertComposerText(String(emoji || ''));
    setEmojiPickerOpen(false);
  };

  const mentionCandidates = useMemo(() => {
    if (!mentionState.open) return [];
    const query = normalizeForSearch(mentionState.query);
    const base = Array.isArray(allUsers) ? allUsers : [];
    const filtered = query
      ? base.filter((user) => {
          const name = normalizeForSearch(user?.name || '');
          const email = normalizeForSearch(user?.email || '');
          return name.includes(query) || email.includes(query);
        })
      : base;

    return filtered.slice(0, 8);
  }, [allUsers, mentionState.open, mentionState.query]);

  const applyMentionSelection = (user) => {
    const token = mentionTokenForUser(user);
    applyComposerTransform((value) => {
      const start = mentionState.start ?? 0;
      const end = mentionState.end ?? start;
      const nextValue = `${value.slice(0, start)}${token} ${value.slice(end)}`;
      const nextCursor = start + token.length + 1;
      return {
        nextValue,
        nextSelectionStart: nextCursor,
        nextSelectionEnd: nextCursor,
      };
    });
    setMentionState((prev) => ({ ...prev, open: false, query: '', activeIndex: 0 }));
  };

  const renderMessageText = (text) => {
    const tokenMap = new Map(
      (Array.isArray(allUsers) ? allUsers : []).map((user) => [mentionTokenForUser(user), user]),
    );

    const parts = String(text || '').split(/(\s+)/);
    return parts.map((part, index) => {
      if (!part) return null;
      if (/^\s+$/.test(part)) return part;

      const match = part.match(/^(@[\w.-]+)([^\w.-].*)?$/);
      if (!match) return part;

      const token = match[1];
      const suffix = match[2] || '';
      if (!tokenMap.has(token)) return part;

      return (
        <span key={`${token}-${index}`}>
          <span className="rounded bg-white/10 px-1 py-0.5 text-[12px] text-cyan-100">
            {token}
          </span>
          {suffix}
        </span>
      );
    });
  };

  const handleComposerInputKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !mentionState.open) {
      event.preventDefault();
      sendMessage(event);
      return;
    }

    if (event.key === 'Escape') {
      if (emojiPickerOpen) {
        event.preventDefault();
        setEmojiPickerOpen(false);
        return;
      }
      if (composerMenuOpen) {
        event.preventDefault();
        setComposerMenuOpen(false);
        setProcessSelectorOpen(false);
        return;
      }
      if (mentionState.open) {
        event.preventDefault();
        setMentionState((prev) => ({ ...prev, open: false }));
        return;
      }
      if (messageActionsOpenKey) {
        event.preventDefault();
        setMessageActionsOpenKey('');
      }
      return;
    }

    if (!mentionState.open) return;
    if (!mentionCandidates.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setMentionState((prev) => ({
        ...prev,
        activeIndex: Math.min((prev.activeIndex || 0) + 1, mentionCandidates.length - 1),
      }));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setMentionState((prev) => ({
        ...prev,
        activeIndex: Math.max((prev.activeIndex || 0) - 1, 0),
      }));
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const target = mentionCandidates[mentionState.activeIndex || 0];
      if (target) applyMentionSelection(target);
    }
  };

  const handleComposerMenuKeyDown = (event) => {
    if (!composerMenuOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      setComposerMenuOpen(false);
      setProcessSelectorOpen(false);
      return;
    }

    const maxIndex = 2;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = Math.min((composerMenuActiveIndex ?? 0) + 1, maxIndex);
      setComposerMenuActiveIndex(nextIndex);
      requestAnimationFrame(() => composerMenuItemRefs.current?.[nextIndex]?.focus?.());
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = Math.max((composerMenuActiveIndex ?? 0) - 1, 0);
      setComposerMenuActiveIndex(nextIndex);
      requestAnimationFrame(() => composerMenuItemRefs.current?.[nextIndex]?.focus?.());
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const index = composerMenuActiveIndex ?? 0;
      if (index === 0) handleUploadFromComputer();
      if (index === 1) handleInsertList();
      if (index === 2) setProcessSelectorOpen((prev) => !prev);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (specialAccessUser) return;
    if (!newMessage.trim() || !selectedConversation) return;

    const outboundText = newMessage.trim();

    const uploadAttachmentsToDrive = async () => {
      if (!pendingAttachments.length) return [];
      const token = localStorage.getItem('token');
      const uploaded = [];
      for (const attachment of pendingAttachments) {
        const file = attachment?.rawFile;
        if (!file) {
          uploaded.push({
            id: attachment.id,
            name: attachment.name,
            size: attachment.size,
            type: attachment.type,
          });
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(`${API_URL}/api/chat/${selectedConversation.id}/attachments/upload-drive`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.detail || `Falha ao enviar anexo ${attachment.name}`);
        }

        uploaded.push({
          id: payload?.id || attachment.id,
          name: payload?.name || attachment.name,
          size: payload?.size || attachment.size,
          type: payload?.type || attachment.type,
          storage_provider: payload?.storage_provider || 'google_drive',
          drive_file_id: payload?.drive_file_id || '',
          drive_folder_id: payload?.drive_folder_id || '',
          web_view_link: payload?.web_view_link || '',
          web_content_link: payload?.web_content_link || '',
        });
      }
      return uploaded;
    };

    let uploadedAttachments = [];
    try {
      uploadedAttachments = await uploadAttachmentsToDrive();
    } catch (error) {
      console.error('Erro ao enviar anexos do chat para o Drive:', error);
      setActionFeedback('Nao foi possivel enviar os anexos para o Google Drive.');
      return;
    }

    const outboundMeta = {
      attachments: uploadedAttachments,
      textStyle: { ...composerTextStyle },
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
        setComposerTextStyle(DEFAULT_COMPOSER_TEXT_STYLE);
        setProcessSelectorOpen(false);
        setComposerMenuOpen(false);
        setEmojiPickerOpen(false);
        setMentionState((prev) => ({ ...prev, open: false, query: '', activeIndex: 0 }));
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

      <div className="flex-1 flex min-h-0 relative">
        {selectedConversation ? (
          <>
            <div className="flex-1 flex flex-col min-h-0">
            <div className="bg-gray-800 p-4 border-b border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white">{getConversationName(selectedConversation)}</h3>
                {selectedConversation.tipo === 'group' ? (
                  <button
                    type="button"
                    onClick={openMembersModal}
                    className="text-sm text-gray-400 hover:text-white underline-offset-2 hover:underline"
                  >
                    {selectedConversation.members_count} membros - {selectedConversation.tipo_grupo === 'public' ? 'Publico' : 'Privado'}
                  </button>
                ) : (
                  <p className={`text-sm ${selectedConversation.direct_user?.is_online ? 'text-green-400' : 'text-gray-400'}`}>
                    {getPresenceText(selectedConversation)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSidePanelOpen((prev) => !prev)}
                  aria-expanded={sidePanelOpen}
                  aria-controls={sidePanelTab === 'activities' ? 'chat-side-panel-activities' : 'chat-side-panel-files'}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-white transition ${
                    sidePanelOpen ? 'border-red-500/40 bg-red-500/20' : 'border-white/20 bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <MessageSquare size={12} />
                  Painel
                </button>
                {selectedConversation.tipo === 'group' && selectedConversation.my_role === 'admin' ? (
                  <span className="flex items-center gap-1 text-xs bg-red-900/50 text-red-300 px-2 py-1 rounded">
                    <Shield size={12} />
                    Admin
                  </span>
                ) : null}
              </div>
            </div>
            <PinnedMessagesBar pinnedMessages={pinnedMessages} onOpenMessage={scrollToMessage} formatPinExpiry={formatPinExpiry} />
            {actionFeedback ? (
              <div className="border-b border-gray-700 bg-gray-900/60 px-4 py-1.5 text-[11px] text-cyan-200">
                {actionFeedback}
              </div>
            ) : null}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {messageTimelineItems.map((item) => {
                if (item.type === 'day') {
                  return (
                    <div key={item.key} className="relative py-1">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-700" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="rounded-full border border-gray-600 bg-gray-900 px-3 py-1 text-[11px] font-medium text-gray-300">
                          {formatDaySeparatorLabel(item.dateValue)}
                        </span>
                      </div>
                    </div>
                  );
                }

                const msg = item.message;
                const isMe = msg.sender.id === currentUser.id;
                const msgKey = getMessageKey(msg);
                const meta = messageMeta[msgKey] || {};
                const isSelected = selectedMessageKey === msgKey;
                const seenBy = isMe ? getSeenByForMessage(msg) : [];
                const currentInteraction = String(meta?.quickInteraction || '');
                const isSaved = Boolean(meta?.saved);
                const isPinned = isPinActive(meta);
                return (
                  <div
                    key={item.key}
                    ref={(node) => {
                      messageItemRefs.current[msgKey] = node;
                    }}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${
                      highlightedMessageKey === msgKey ? 'ring-2 ring-amber-300/70 rounded-xl transition' : ''
                    }`}
                  >
                    <div className={`group relative max-w-xl ${isMe ? 'bg-red-600' : 'bg-gray-700'} rounded-lg p-3`}>
                      <div className="absolute right-2 top-2">
                        <button
                          type="button"
                          onClick={() => setMessageActionsOpenKey((prev) => (prev === msgKey ? '' : msgKey))}
                          title="Acoes da mensagem"
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-white/20 bg-black/20 text-white opacity-40 hover:bg-black/35 hover:opacity-100 focus:opacity-100 group-hover:opacity-100 transition"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        {messageActionsOpenKey === msgKey ? (
                          <div
                            ref={messageActionMenuRef}
                            style={{ zIndex: Z_LAYERS.chatPopover }}
                            className="absolute right-0 top-8 w-72 rounded-lg border border-gray-600 bg-gray-900 p-2 shadow-xl"
                          >
                            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Reacoes rapidas</p>
                            <div className="grid grid-cols-3 gap-1">
                              <button type="button" onClick={() => handleQuickInteraction(msgKey, 'concluido')} className={`rounded px-2 py-1.5 text-[11px] ${currentInteraction === 'concluido' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-100 hover:bg-gray-600'}`}>
                                <CheckCircle2 size={12} className="inline-block mr-1" />
                                Concluido
                              </button>
                              <button type="button" onClick={() => handleQuickInteraction(msgKey, 'dando_uma_olhada')} className={`rounded px-2 py-1.5 text-[11px] ${currentInteraction === 'dando_uma_olhada' ? 'bg-sky-600 text-white' : 'bg-gray-700 text-gray-100 hover:bg-gray-600'}`}>
                                <Eye size={12} className="inline-block mr-1" />
                                Olhando
                              </button>
                              <button type="button" onClick={() => handleQuickInteraction(msgKey, 'otimo_trabalho')} className={`rounded px-2 py-1.5 text-[11px] ${currentInteraction === 'otimo_trabalho' ? 'bg-fuchsia-600 text-white' : 'bg-gray-700 text-gray-100 hover:bg-gray-600'}`}>
                                <Star size={12} className="inline-block mr-1" />
                                Otimo
                              </button>
                            </div>

                            <p className="mt-2 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Acoes</p>
                            <div className="space-y-1">
                              <button type="button" onClick={() => handleReplyToMessage(msg)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-white hover:bg-gray-700">
                                <Reply size={13} />
                                Responder mensagem na conversa
                              </button>
                              <button type="button" onClick={() => handleForwardMessage(msg)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-white hover:bg-gray-700">
                                <Forward size={13} />
                                Encaminhar mensagem
                              </button>
                              <button type="button" onClick={() => handleSaveMessage(msgKey)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-white hover:bg-gray-700">
                                <Bookmark size={13} />
                                {isSaved ? 'Remover de salvas' : 'Salvar mensagem'}
                              </button>
                            </div>

                            <p className="mt-2 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Fixar</p>
                            <div className="grid grid-cols-2 gap-1">
                              {PIN_DURATION_OPTIONS.map((option) => (
                                <button key={option.id} type="button" onClick={() => handlePinMessage(msgKey, option, msg?.created_at)} className="rounded bg-gray-700 px-2 py-1.5 text-[11px] text-white hover:bg-gray-600">
                                  {option.label}
                                </button>
                              ))}
                              {isPinned ? (
                                <button type="button" onClick={() => handleUnpinMessage(msgKey)} className="col-span-2 rounded bg-amber-600/30 px-2 py-1.5 text-[11px] text-amber-100 hover:bg-amber-600/40">
                                  <PinOff size={12} className="inline-block mr-1" />
                                  Desafixar
                                </button>
                              ) : null}
                            </div>

                            <p className="mt-2 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Mais acoes</p>
                            <div className="space-y-1">
                              <button type="button" onClick={() => handleMarkAsUnreadFromMessage(msg)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-white hover:bg-gray-700">
                                <Eye size={13} />
                                Marcar como não lida
                              </button>
                              <button type="button" onClick={() => handleCreateReminder(msg, msgKey)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-white hover:bg-gray-700">
                                <Bell size={13} />
                                Lembrar-me
                              </button>
                              <button type="button" onClick={() => handleCopyMessage(msg?.message)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-white hover:bg-gray-700">
                                <Copy size={13} />
                                Copiar mensagem
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      {!isMe && <p className="text-xs font-medium text-gray-300 mb-1">{msg.sender.name}</p>}
                      <button
                        type="button"
                        onClick={() => setSelectedMessageKey((prev) => (prev === msgKey ? '' : msgKey))}
                        className="text-left w-full"
                      >
                        <p className="text-white whitespace-pre-wrap" style={getTextRenderStyle(meta?.textStyle)}>
                          {renderMessageText(msg.message)}
                        </p>
                      </button>
                      {meta?.processRef ? (
                        <button
                          type="button"
                          onClick={() => openLinkedProcessDetails(meta.processRef)}
                          className="mt-2 w-full rounded-md border border-red-400/35 bg-black/20 px-2.5 py-2 text-left text-xs text-white hover:bg-red-500/10"
                          title="Abrir detalhes do processo vinculado"
                        >
                          Processo vinculado: {meta.processRef.nome} ({meta.processRef.clienteNome})
                        </button>
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
                      {isSaved || isPinned || currentInteraction ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {isPinned ? <span className="rounded border border-amber-500/35 bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-100">Fixada</span> : null}
                          {isSaved ? <span className="rounded border border-cyan-500/35 bg-cyan-500/15 px-1.5 py-0.5 text-[10px] text-cyan-100">Salva</span> : null}
                          {currentInteraction === 'concluido' ? <span className="rounded border border-emerald-500/35 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-100">Concluido</span> : null}
                          {currentInteraction === 'dando_uma_olhada' ? <span className="rounded border border-sky-500/35 bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-100">Dando uma olhada</span> : null}
                          {currentInteraction === 'otimo_trabalho' ? <span className="rounded border border-fuchsia-500/35 bg-fuchsia-500/15 px-1.5 py-0.5 text-[10px] text-fuchsia-100">Otimo trabalho</span> : null}
                        </div>
                      ) : null}
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
                <p className="mb-2 text-xs text-amber-200">Modo leitura do acesso especial ativo. Envio de mensagens desabilitado.</p>
              ) : null}
              {showFormattingToolbar ? (
                <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-900/70 p-2">
                  {composerToolbarActions.map((action) => {
                    const isActive = action?.styleKey ? Boolean(composerTextStyle?.[action.styleKey]) : false;
                    return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => handleToolbarAction(action)}
                      disabled={Boolean(specialAccessUser)}
                      title={action.title}
                      className={`min-w-9 rounded-md border px-2.5 py-1.5 text-xs font-medium text-white hover:bg-gray-600 disabled:opacity-40 ${
                        isActive ? 'border-red-500/50 bg-red-500/25' : 'border-white/10 bg-gray-700'
                      }`}
                    >
                      {action.label}
                    </button>
                    );
                  })}
                </div>
              ) : null}
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handleAttachDocuments} disabled={Boolean(specialAccessUser)} />
                <div ref={composerMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setComposerMenuOpen((prev) => {
                        const nextOpen = !prev;
                        if (!nextOpen) setProcessSelectorOpen(false);
                        return nextOpen;
                      });
                    }}
                    disabled={Boolean(specialAccessUser)}
                    aria-haspopup="menu"
                    aria-expanded={composerMenuOpen}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-40"
                  >
                    <Plus size={16} />
                  </button>
                  {composerMenuOpen ? (
                    <div style={{ zIndex: Z_LAYERS.chatPopover }} className="absolute bottom-full left-0 mb-2 w-80 rounded-lg border border-gray-600 bg-gray-900 p-2 shadow-xl" role="menu" aria-label="Acoes do chat" onKeyDown={handleComposerMenuKeyDown}>
                      <button
                        type="button"
                        onClick={handleUploadFromComputer}
                        ref={(node) => {
                          composerMenuItemRefs.current[0] = node;
                        }}
                        tabIndex={-1}
                        role="menuitem"
                        className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-white hover:bg-gray-700"
                      >
                        <FileUp size={14} />
                        Upload do computador
                      </button>
                      <button
                        type="button"
                        onClick={handleInsertList}
                        ref={(node) => {
                          composerMenuItemRefs.current[1] = node;
                        }}
                        tabIndex={-1}
                        role="menuitem"
                        className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-white hover:bg-gray-700"
                      >
                        <List size={14} />
                        Adicionar lista
                      </button>
                      <button
                        type="button"
                        onClick={() => setProcessSelectorOpen((prev) => !prev)}
                        ref={(node) => {
                          composerMenuItemRefs.current[2] = node;
                        }}
                        tabIndex={-1}
                        role="menuitem"
                        className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-white hover:bg-gray-700"
                      >
                        <ChevronDown size={14} className={processSelectorOpen ? 'rotate-180 transition' : 'transition'} />
                        <span>Selecionar processo</span>
                      </button>
                      {processSelectorOpen ? (
                        <div className="mt-1 rounded-md border border-white/10 bg-black/20 p-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProcessId('');
                              setProcessSelectorOpen(false);
                              setComposerMenuOpen(false);
                            }}
                            className="w-full rounded px-2 py-1.5 text-left text-xs text-gray-300 hover:bg-gray-700"
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
                                  setComposerMenuOpen(false);
                                }}
                                className="w-full rounded px-2 py-1.5 text-left text-xs text-white hover:bg-gray-700"
                              >
                                {proc.nome} - {proc.clienteNome}
                              </button>
                            ))}
                            {userProcesses.length === 0 ? <p className="px-2 py-2 text-xs text-gray-400">Nenhum processo vinculado ao seu usuário.</p> : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setShowFormattingToolbar((prev) => !prev)}
                  disabled={Boolean(specialAccessUser)}
                  className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600 disabled:opacity-40 ${
                    showFormattingToolbar ? 'border-red-500/40 bg-red-500/20' : 'border-white/20 bg-gray-700'
                  }`}
                >
                  Aa
                </button>
                <div className="relative">
                  <button
                    ref={emojiButtonRef}
                    type="button"
                    onClick={handleInsertEmoji}
                    disabled={Boolean(specialAccessUser)}
                    aria-haspopup="dialog"
                    aria-expanded={emojiPickerOpen}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-40"
                    title="Adicionar emoji"
                  >
                    <Smile size={16} />
                  </button>
                  {emojiPickerOpen ? (
                    <div ref={emojiPickerRef} style={{ zIndex: Z_LAYERS.chatPopover }} className="absolute bottom-full right-0 mb-2 w-56 rounded-lg border border-gray-600 bg-gray-900 p-2 shadow-xl" role="dialog" aria-label="Selecionar emoji">
                      <div className="grid grid-cols-8 gap-1">
                        {EMOJI_PICKER_OPTIONS.map((emoji) => (
                          <button key={emoji} type="button" onClick={() => handleSelectEmoji(emoji)} className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-gray-700 focus:bg-gray-700 focus:outline-none" title={emoji}>
                            <span className="text-base leading-none">{emoji}</span>
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] text-gray-400">Picker minimo (frontend).</p>
                    </div>
                  ) : null}
                </div>
                <button type="button" onClick={handleInsertMention} disabled={Boolean(specialAccessUser)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-40" title="Mencionar">
                  <AtSign size={16} />
                </button>
              </div>
              {selectedProcess ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100">
                    <span className="max-w-[260px] truncate">Processo: {selectedProcess.nome} - {selectedProcess.clienteNome}</span>
                    <button type="button" onClick={() => setSelectedProcessId('')} className="text-cyan-100 hover:text-white">x</button>
                  </div>
                </div>
              ) : null}
              {pendingAttachments.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {pendingAttachments.map((file) => (
                    <div key={file.id} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-gray-700 px-3 py-1 text-xs text-white">
                      <span className="max-w-[220px] truncate">{file.name}</span>
                      <button type="button" onClick={() => removePendingAttachment(file.id)} className="text-gray-300 hover:text-white">x</button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  {mentionState.open ? (
                    <div ref={mentionListRef} style={{ zIndex: Z_LAYERS.chatPopover }} className="absolute bottom-full left-0 mb-2 w-full max-w-[420px] rounded-lg border border-gray-600 bg-gray-900 p-1.5 shadow-xl" role="listbox" aria-label="Sugestoes de mencao">
                      {mentionCandidates.length ? (
                        <div className="max-h-56 overflow-y-auto">
                          {mentionCandidates.map((user, index) => {
                            const isActive = index === (mentionState.activeIndex || 0);
                            const label = user?.name || user?.email || 'Usuario';
                            const sub = user?.email && user?.name ? user.email : '';
                            return (
                              <button key={user?.id || user?.email || label} type="button" ref={(node) => { mentionItemRefs.current[index] = node; }} role="option" aria-selected={isActive} onMouseDown={(e) => e.preventDefault()} onClick={() => applyMentionSelection(user)} className={`flex w-full items-start gap-2 rounded px-2 py-2 text-left text-sm text-white hover:bg-gray-700 ${isActive ? 'bg-gray-700' : ''}`}>
                                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded bg-white/10 text-[11px]">{(label || 'U').slice(0, 1).toUpperCase()}</span>
                                <span className="min-w-0">
                                  <span className="block truncate">{label}</span>
                                  {sub ? <span className="block truncate text-[11px] text-gray-300">{sub}</span> : null}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="px-2 py-2 text-xs text-gray-300">Nenhuma sugestao.</p>
                      )}
                    </div>
                  ) : null}
                  <textarea
                    ref={composerInputRef}
                    value={newMessage}
                    onChange={(e) => {
                      const next = e.target.value;
                      setNewMessage(next);
                      updateMentionFromValue(next, e.target.selectionStart ?? next.length);
                    }}
                    onKeyDown={handleComposerInputKeyDown}
                    onClick={(e) => updateMentionFromValue(e.target.value || '', e.target.selectionStart ?? (e.target.value || '').length)}
                    placeholder="Digite sua mensagem..."
                    disabled={Boolean(specialAccessUser)}
                    rows={2}
                    style={getTextRenderStyle(composerTextStyle)}
                    className="w-full bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-red-500 outline-none resize-none min-h-[44px] max-h-40 overflow-y-auto"
                  />
                </div>
                <button type="submit" disabled={Boolean(specialAccessUser)} className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"><Send size={18} /></button>
              </div>
            </form>
            </div>
            {sidePanelOpen ? (
              <aside
                style={{ zIndex: Z_LAYERS.chatSidePanel }}
                className="absolute inset-y-0 right-0 w-full max-w-[360px] border-l border-gray-700 bg-gray-900/95 backdrop-blur-sm md:static md:w-[340px] md:max-w-none"
                aria-label="Painel lateral do chat"
              >
                <div className="flex h-full flex-col min-h-0">
                  <div className="border-b border-gray-700 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-300">Painel da conversa</p>
                      <button
                        type="button"
                        onClick={() => setSidePanelOpen(false)}
                        className="rounded border border-white/15 px-2 py-1 text-xs text-gray-200 hover:bg-gray-700"
                      >
                        Fechar
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-gray-800 p-1" role="tablist" aria-label="Navegacao do painel lateral">
                      <button
                        id="chat-side-tab-activities"
                        type="button"
                        role="tab"
                        aria-selected={sidePanelTab === 'activities'}
                        aria-controls="chat-side-panel-activities"
                        onClick={() => setSidePanelTab('activities')}
                        className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                          sidePanelTab === 'activities' ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <MessageSquare size={14} />
                        Atividades
                      </button>
                      <button
                        id="chat-side-tab-files"
                        type="button"
                        role="tab"
                        aria-selected={sidePanelTab === 'files'}
                        aria-controls="chat-side-panel-files"
                        onClick={() => setSidePanelTab('files')}
                        className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                          sidePanelTab === 'files' ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <FileUp size={14} />
                        Arquivos
                      </button>
                    </div>
                  </div>

                  {sidePanelTab === 'activities' ? (
                    <section id="chat-side-panel-activities" role="tabpanel" aria-labelledby="chat-side-tab-activities" className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                      <div className="rounded-lg border border-gray-700 bg-gray-800/70 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-white">Atividades</p>
                          <label className="inline-flex items-center gap-1.5 text-xs text-gray-300">
                            <input
                              type="checkbox"
                              checked={activitiesUnreadOnly}
                              onChange={(event) => setActivitiesUnreadOnly(event.target.checked)}
                              className="h-3.5 w-3.5 rounded border-gray-500 bg-gray-700"
                            />
                            Nao lidas
                          </label>
                        </div>
                        <p className="mt-1 text-[11px] text-gray-400">Estrutura pronta para integrar backend de feed de atividades.</p>
                      </div>

                      {visibleActivityItems.length ? (
                        visibleActivityItems.map((item) => (
                          <article key={item.id} className="rounded-lg border border-gray-700 bg-gray-800/60 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium text-gray-200">{getActivityLabel(item.type)}</p>
                              {item.unread ? (
                                <span className="rounded-full bg-red-600/20 px-2 py-0.5 text-[10px] font-semibold text-red-200">Nao lida</span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-white">{item.senderName}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-gray-300">{item.text || '(Sem texto)'}</p>
                            <p className="mt-2 text-[11px] text-gray-400">{formatDateTimeCompact(item.createdAt)}</p>
                          </article>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-gray-700 bg-gray-800/50 p-3 text-xs text-gray-400">
                          Nenhuma atividade para este filtro.
                        </div>
                      )}
                    </section>
                  ) : (
                    <section id="chat-side-panel-files" role="tabpanel" aria-labelledby="chat-side-tab-files" className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                      {conversationFiles.length ? (
                        conversationFiles.map((file) => (
                          <article key={file.id} className="rounded-lg border border-gray-700 bg-gray-800/60 p-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-white">{file.name}</p>
                                <p className="mt-0.5 text-[11px] text-gray-300">{file.type}</p>
                              </div>
                              {file.isImage ? (
                                <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-100">Previa</span>
                              ) : null}
                            </div>
                            {file.isImage ? (
                              <div className="mt-2 rounded border border-white/10 bg-gray-700/50 px-2 py-1 text-[11px] text-gray-300">
                                Previa local indisponivel neste ambiente.
                              </div>
                            ) : null}
                            <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
                              <span className="truncate">Enviado por: {file.senderName}</span>
                              <span>{formatDateTimeCompact(file.createdAt)}</span>
                            </div>
                          </article>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-gray-700 bg-gray-800/50 p-3 text-xs text-gray-400">
                          Nenhum arquivo anexado nesta conversa.
                        </div>
                      )}
                    </section>
                  )}
                </div>
              </aside>
            ) : null}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageSquare size={64} className="mx-auto mb-4 opacity-50" />
              <p>Selecione uma conversa para comecar</p>
            </div>
          </div>
        )}
      </div>
      {showMembersModal ? (
        <div style={{ zIndex: Z_LAYERS.chatModal }} className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
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
        <div style={{ zIndex: Z_LAYERS.chatModal }} className="fixed inset-0 bg-black/50 flex items-center justify-center">
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
        <div style={{ zIndex: Z_LAYERS.chatModal }} className="fixed inset-0 bg-black/50 flex items-center justify-center">
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
        <div style={{ zIndex: Z_LAYERS.chatModal }} className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
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
