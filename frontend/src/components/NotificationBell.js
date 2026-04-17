import React, { useEffect, useMemo, useState } from 'react';
import { Bell, MessageCircle, Send, Wrench } from 'lucide-react';
import {
  getSupportUnreadCount,
  listSupportThreadsForAccounting,
  markSupportThreadRead,
  sendSupportMessage,
  subscribeSupportChat,
} from '../dev/clientSupportChat';

const NOTIFICATIONS_KEY = 'mock_internal_notifications_v1';

const readJsonArray = (key) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const formatDateTime = (value) => {
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

const NotificationBell = ({
  mode = 'admin',
  userName = 'Contabilidade',
  clientId = null,
  clientName = '',
  onOpenClientChat = null,
}) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [supportThreads, setSupportThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [replyText, setReplyText] = useState('');

  const audience = mode === 'client' ? 'cliente' : 'contabilidade';

  const reloadData = () => {
    setNotifications(readJsonArray(NOTIFICATIONS_KEY));
    setSupportThreads(listSupportThreadsForAccounting());
  };

  useEffect(() => {
    reloadData();
    const onStorage = () => reloadData();
    window.addEventListener('storage', onStorage);
    const unsubscribeSupport = subscribeSupportChat(reloadData);
    return () => {
      window.removeEventListener('storage', onStorage);
      unsubscribeSupport();
    };
  }, []);

  useEffect(() => {
    if (!selectedThreadId && supportThreads.length) {
      setSelectedThreadId(supportThreads[0].clientId);
    }
  }, [selectedThreadId, supportThreads]);

  const unreadSupportCount = useMemo(
    () =>
      getSupportUnreadCount({
        audience,
        clientId: mode === 'client' ? clientId : null,
      }),
    [audience, mode, clientId, supportThreads],
  );

  const unreadInternalCount = useMemo(() => {
    if (mode === 'client') return 0;
    return notifications.filter((item) => item && !item.read).length;
  }, [notifications, mode]);

  const totalUnread = unreadSupportCount + unreadInternalCount;

  const selectedThread = useMemo(
    () => supportThreads.find((thread) => thread.clientId === selectedThreadId) || null,
    [supportThreads, selectedThreadId],
  );

  const clientThread = useMemo(() => {
    if (mode !== 'client') return null;
    return supportThreads.find((thread) => thread.clientId === clientId) || null;
  }, [mode, supportThreads, clientId]);

  const clientPreview = useMemo(
    () => (clientThread?.messages || []).slice(-4).reverse(),
    [clientThread],
  );

  const markInternalAsRead = () => {
    if (mode === 'client') return;
    const next = notifications.map((item) => ({ ...item, read: true }));
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
    setNotifications(next);
  };

  const handleOpen = () => {
    setOpen((prev) => !prev);
    if (!open) {
      if (mode === 'client' && clientId) {
        markSupportThreadRead({ clientId, audience: 'cliente' });
      } else {
        markInternalAsRead();
      }
    }
  };

  const handleSendReply = () => {
    if (!selectedThreadId || !replyText.trim()) return;
    sendSupportMessage({
      clientId: selectedThreadId,
      clientName: selectedThread?.clientName,
      from: 'contabilidade',
      senderName: userName,
      text: replyText,
    });
    markSupportThreadRead({ clientId: selectedThreadId, audience: 'contabilidade' });
    setReplyText('');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="top-action-btn"
        aria-label="Notificações"
        title="Notificações"
      >
        <Bell className="h-5 w-5" />
        {totalUnread > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-[52px] z-[90] w-[360px] rounded-2xl border border-white/10 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-xl">
          {mode === 'client' ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <MessageCircle className="h-4 w-4 text-sky-300" />
                  Mensagens da contabilidade
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Novas mensagens e atualizações sobre seus serviços.
                </p>
              </div>

              <div className="space-y-2">
                {clientPreview.length ? (
                  clientPreview.map((message) => (
                    <div key={message.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-xs text-gray-400">{message.senderName}</div>
                      <div className="mt-1 text-sm text-white">{message.text}</div>
                      <div className="mt-1 text-[11px] text-gray-500">{formatDateTime(message.createdAt)}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-gray-400">
                    Nenhuma mensagem nova no momento.
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (onOpenClientChat) onOpenClientChat();
                }}
                className="w-full rounded-xl border border-sky-500/30 bg-sky-500/15 px-3 py-2 text-sm font-medium text-sky-100 hover:bg-sky-500/25"
              >
                Abrir chat da contabilidade
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="text-sm font-semibold text-white">Notificações internas</div>
                <div className="mt-2 space-y-2">
                  {notifications.slice(-4).reverse().map((item) => (
                    <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                      <div className="flex items-start gap-2">
                        <Wrench className="mt-0.5 h-4 w-4 text-amber-300" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-200">{item.message}</p>
                          <p className="mt-1 text-[11px] text-gray-500">{formatDateTime(item.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!notifications.length ? (
                    <p className="text-xs text-gray-500">Sem alertas internos recentes.</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="mb-2 text-sm font-semibold text-white">Mensagens de clientes</div>
                <div className="grid grid-cols-1 gap-2">
                  <select
                    value={selectedThreadId}
                    onChange={(event) => {
                      const nextClientId = event.target.value;
                      setSelectedThreadId(nextClientId);
                      markSupportThreadRead({ clientId: nextClientId, audience: 'contabilidade' });
                    }}
                    className="input-futuristic w-full rounded-lg px-3 py-2 text-sm"
                  >
                    {!supportThreads.length ? (
                      <option value="">Nenhuma conversa de cliente</option>
                    ) : null}
                    {supportThreads.map((thread) => (
                      <option key={thread.clientId} value={thread.clientId}>
                        {thread.clientName}
                      </option>
                    ))}
                  </select>

                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-black/25 p-2">
                    {(selectedThread?.messages || []).slice(-6).map((message) => (
                      <div key={message.id} className="rounded-md border border-white/10 bg-white/5 p-2">
                        <p className="text-[11px] text-gray-400">{message.senderName}</p>
                        <p className="mt-0.5 text-xs text-white">{message.text}</p>
                        <p className="mt-0.5 text-[10px] text-gray-500">{formatDateTime(message.createdAt)}</p>
                      </div>
                    ))}
                    {!selectedThread?.messages?.length ? (
                      <p className="text-xs text-gray-500">Sem mensagens neste chat.</p>
                    ) : null}
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                      placeholder="Responder cliente..."
                      className="input-futuristic w-full rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleSendReply}
                      disabled={!selectedThreadId || !replyText.trim()}
                      className="rounded-lg border border-red-500/30 bg-red-500/15 px-3 py-2 text-red-100 hover:bg-red-500/25 disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default NotificationBell;
