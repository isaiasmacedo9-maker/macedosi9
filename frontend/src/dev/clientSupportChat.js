const SUPPORT_STORAGE_KEY = 'mock_client_support_chat_v1';
const SUPPORT_EVENT = 'mock-client-support-chat-updated';

const readStore = () => {
  try {
    const raw = localStorage.getItem(SUPPORT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') {
      return { threads: {} };
    }
    if (!parsed.threads || typeof parsed.threads !== 'object') {
      return { threads: {} };
    }
    return parsed;
  } catch {
    return { threads: {} };
  }
};

const writeStore = (store) => {
  localStorage.setItem(SUPPORT_STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent(SUPPORT_EVENT));
};

const createThread = (clientId, clientName) => ({
  clientId,
  clientName: clientName || 'Cliente',
  messages: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  readState: {
    clienteLastReadAt: null,
    contabilidadeLastReadAt: null,
  },
});

const normalizeAudience = (value) => (value === 'cliente' ? 'cliente' : 'contabilidade');

const isUnreadForAudience = (message, audience) => {
  if (!message) return false;
  if (audience === 'cliente') return message.from !== 'cliente';
  return message.from !== 'contabilidade';
};

export const getSupportThread = (clientId, clientName) => {
  const store = readStore();
  const thread = store.threads?.[clientId];
  if (thread) return thread;
  return createThread(clientId, clientName);
};

export const getSupportThreadMessages = (clientId) => {
  const thread = getSupportThread(clientId);
  return Array.isArray(thread.messages) ? thread.messages : [];
};

export const listSupportThreadsForAccounting = () => {
  const store = readStore();
  return Object.values(store.threads || {}).sort(
    (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
  );
};

export const startSupportThread = ({ clientId, clientName }) => {
  const normalizedClientId = String(clientId || '').trim();
  if (!normalizedClientId) return null;

  const store = readStore();
  const existing = store.threads?.[normalizedClientId];
  if (existing) return existing;

  const now = new Date().toISOString();
  const thread = {
    ...createThread(normalizedClientId, clientName),
    createdAt: now,
    updatedAt: now,
  };

  store.threads = {
    ...(store.threads || {}),
    [normalizedClientId]: thread,
  };
  writeStore(store);
  return thread;
};

export const sendSupportMessage = ({ clientId, clientName, from, senderName, text }) => {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;

  const store = readStore();
  const existing = store.threads?.[clientId] || createThread(clientId, clientName);
  const now = new Date().toISOString();

  const message = {
    id: `support-msg-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    clientId,
    from: from === 'cliente' ? 'cliente' : 'contabilidade',
    senderName: senderName || (from === 'cliente' ? 'Cliente' : 'Contabilidade'),
    text: trimmed,
    createdAt: now,
  };

  const nextThread = {
    ...existing,
    clientName: clientName || existing.clientName || 'Cliente',
    updatedAt: now,
    messages: [...(Array.isArray(existing.messages) ? existing.messages : []), message],
  };

  store.threads = {
    ...(store.threads || {}),
    [clientId]: nextThread,
  };

  writeStore(store);
  return message;
};

export const markSupportThreadRead = ({ clientId, audience }) => {
  const normalizedAudience = normalizeAudience(audience);
  const store = readStore();
  const existing = store.threads?.[clientId];
  if (!existing) return;

  const now = new Date().toISOString();
  const readState = {
    ...(existing.readState || {}),
    ...(normalizedAudience === 'cliente'
      ? { clienteLastReadAt: now }
      : { contabilidadeLastReadAt: now }),
  };

  store.threads[clientId] = {
    ...existing,
    readState,
  };
  writeStore(store);
};

export const getSupportUnreadCount = ({ audience, clientId }) => {
  const normalizedAudience = normalizeAudience(audience);
  const store = readStore();
  const threads = store.threads || {};

  const selected = clientId ? [threads[clientId]].filter(Boolean) : Object.values(threads);

  return selected.reduce((total, thread) => {
    const readAt =
      normalizedAudience === 'cliente'
        ? thread?.readState?.clienteLastReadAt
        : thread?.readState?.contabilidadeLastReadAt;
    const readTime = readAt ? new Date(readAt).getTime() : 0;
    const unreadInThread = (thread?.messages || []).filter((message) => {
      if (!isUnreadForAudience(message, normalizedAudience)) return false;
      const msgTime = new Date(message.createdAt || 0).getTime();
      return msgTime > readTime;
    }).length;
    return total + unreadInThread;
  }, 0);
};

export const subscribeSupportChat = (handler) => {
  const wrapped = () => handler();
  window.addEventListener(SUPPORT_EVENT, wrapped);
  window.addEventListener('storage', wrapped);
  return () => {
    window.removeEventListener(SUPPORT_EVENT, wrapped);
    window.removeEventListener('storage', wrapped);
  };
};
