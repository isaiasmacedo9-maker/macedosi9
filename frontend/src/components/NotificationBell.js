import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckSquare, MessageCircle, RefreshCcw, UsersRound } from 'lucide-react';
import {
  getSupportUnreadCount,
  listSupportThreadsForAccounting,
  markSupportThreadRead,
  subscribeSupportChat,
} from '../dev/clientSupportChat';
import {
  getDashboardTasks,
  getNewTasksForToday,
  getPendingTasks,
} from './Dashboard/dashboardTaskData';
import { Z_LAYERS } from '../constants/zLayers';

const NOTIFICATIONS_KEY = 'mock_internal_notifications_v1';
const CHAT_INTERNAL_SEEN_KEY = 'mock_chat_internal_seen_ids_v1';
const VIEWED_ITEMS_KEY = 'mock_notification_viewed_items_v1';
const VIEWED_RETENTION_MS = 24 * 60 * 60 * 1000;

const readJsonArray = (key) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readJsonObject = (key) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeJsonArray = (key, value) => {
  localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
};

const writeJsonObject = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value && typeof value === 'object' ? value : {}));
};

const purgeExpiredNotifications = (items = []) => {
  const now = Date.now();
  return items.filter((item) => {
    const viewedAt = item?.viewed_at ? new Date(item.viewed_at).getTime() : null;
    if (!viewedAt || Number.isNaN(viewedAt)) return true;
    return now - viewedAt <= VIEWED_RETENTION_MS;
  });
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

const playNotificationSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.2);
  } catch {}
};

const NotificationBell = ({
  mode = 'admin',
  userName = 'Contabilidade',
  user = null,
  hasModuleAccess = () => true,
  clientId = null,
  onOpenClientChat = null,
  onNavigate = null,
}) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [supportThreads, setSupportThreads] = useState([]);
  const [activeTab, setActiveTab] = useState('chat_macedo');
  const prevTotalRef = useRef(0);
  const buttonRef = useRef(null);
  const [panelStyle, setPanelStyle] = useState({ top: 64, left: 16, width: 360 });

  const audience = mode === 'client' ? 'cliente' : 'contabilidade';

  const reloadData = () => {
    const cleanedNotifications = purgeExpiredNotifications(readJsonArray(NOTIFICATIONS_KEY));
    writeJsonArray(NOTIFICATIONS_KEY, cleanedNotifications);
    setNotifications(cleanedNotifications);
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

  const unreadSupportCount = useMemo(
    () =>
      getSupportUnreadCount({
        audience,
        clientId: mode === 'client' ? clientId : null,
      }),
    [audience, mode, clientId, supportThreads],
  );

  const unseenInternalChatCount = useMemo(() => {
    if (mode === 'client') return 0;
    const seenMap = readJsonObject(CHAT_INTERNAL_SEEN_KEY);
    const unread = notifications.filter(
      (item) =>
        item?.scope === 'chat_macedo' &&
        !item?.viewed_at &&
        !seenMap[item.messageId || item.id],
    );
    return unread.length;
  }, [notifications, mode]);

  const viewedItemsMap = useMemo(() => {
    const map = readJsonObject(VIEWED_ITEMS_KEY);
    const now = Date.now();
    const cleaned = Object.fromEntries(
      Object.entries(map).filter(([, value]) => {
        const timestamp = new Date(value).getTime();
        return !Number.isNaN(timestamp) && now - timestamp <= VIEWED_RETENTION_MS;
      }),
    );
    if (Object.keys(cleaned).length !== Object.keys(map).length) {
      writeJsonObject(VIEWED_ITEMS_KEY, cleaned);
    }
    return cleaned;
  }, [notifications, supportThreads, open]);

  const tasks = useMemo(() => {
    if (mode === 'client' || !user) return [];
    const isAdmin = user?.role === 'admin';
    return getDashboardTasks({ user, isAdmin, hasModuleAccess });
  }, [mode, user, hasModuleAccess, notifications]);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const newTasks = useMemo(() => {
    if (mode === 'client') return [];
    return getNewTasksForToday({ user, tasks, todayIso });
  }, [mode, user, tasks, todayIso]);
  const taskUpdates = useMemo(() => {
    if (mode === 'client') return [];
    return getPendingTasks(tasks).filter(
      (task) => task.status === 'tarefa_aceita' || task.status === 'em_andamento',
    );
  }, [mode, tasks]);

  const unreadNewTasks = useMemo(
    () => newTasks.filter((task) => !viewedItemsMap[`task_new:${task.id}`]),
    [newTasks, viewedItemsMap],
  );
  const unreadTaskUpdates = useMemo(
    () => taskUpdates.filter((task) => !viewedItemsMap[`task_update:${task.id}`]),
    [taskUpdates, viewedItemsMap],
  );

  const unreadInternalCount = useMemo(() => {
    if (mode === 'client') return 0;
    return unseenInternalChatCount + unreadNewTasks.length + unreadTaskUpdates.length + unreadSupportCount;
  }, [mode, unseenInternalChatCount, unreadNewTasks.length, unreadTaskUpdates.length, unreadSupportCount]);

  const totalUnread = mode === 'client' ? unreadSupportCount : unreadInternalCount;

  useEffect(() => {
    if (totalUnread > prevTotalRef.current) {
      playNotificationSound();
    }
    prevTotalRef.current = totalUnread;
  }, [totalUnread]);

  useEffect(() => {
    if (!open) return;

    const updatePanelPosition = () => {
      const trigger = buttonRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const margin = 12;
      const panelWidth = Math.min(360, Math.max(280, window.innerWidth - margin * 2));
      const top = rect.bottom + 8;
      const desiredLeft = rect.right - panelWidth;
      const maxLeft = window.innerWidth - panelWidth - margin;
      const left = Math.min(Math.max(margin, desiredLeft), Math.max(margin, maxLeft));
      setPanelStyle({ top, left, width: panelWidth });
    };

    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [open]);

  const markNotificationViewed = (item) => {
    if (!item) return;
    const list = readJsonArray(NOTIFICATIONS_KEY);
    const nowIso = new Date().toISOString();
    const next = list.map((entry) => {
      const sameId = entry.id && item.id && entry.id === item.id;
      const sameMsg = entry.messageId && item.messageId && entry.messageId === item.messageId;
      if (sameId || sameMsg) {
        return { ...entry, viewed_at: entry.viewed_at || nowIso };
      }
      return entry;
    });
    writeJsonArray(NOTIFICATIONS_KEY, next);
    const seenMap = readJsonObject(CHAT_INTERNAL_SEEN_KEY);
    const key = item.messageId || item.id;
    if (key) {
      seenMap[key] = nowIso;
      writeJsonObject(CHAT_INTERNAL_SEEN_KEY, seenMap);
    }
    setNotifications(purgeExpiredNotifications(next));
  };

  const markGenericViewed = (key) => {
    if (!key) return;
    const map = readJsonObject(VIEWED_ITEMS_KEY);
    map[key] = new Date().toISOString();
    writeJsonObject(VIEWED_ITEMS_KEY, map);
  };

  const chatClienteSummary = useMemo(
    () => supportThreads.slice(0, 4).map((thread) => {
      const last = (thread.messages || [])[thread.messages.length - 1];
      return {
        id: thread.clientId,
        title: thread.clientName,
        subtitle: last?.text || 'Sem mensagens',
        date: formatDateTime(last?.createdAt),
      };
    }),
    [supportThreads],
  );

  const chatMacedoSummary = useMemo(
    () =>
      notifications
        .filter((item) => item?.scope === 'chat_macedo')
        .slice(-4)
        .reverse()
        .map((item) => ({
          id: item.id,
          messageId: item.messageId,
          raw: item,
          title: item.title || 'Chat interno',
          subtitle: item.message,
          date: formatDateTime(item.createdAt),
        })),
    [notifications],
  );

  const tabs = mode === 'client'
    ? [{ key: 'chat_cliente', label: 'Chat Cliente', count: unreadSupportCount }]
    : [
        { key: 'chat_macedo', label: 'Chat Macedo', count: unseenInternalChatCount },
        { key: 'novas_tarefas', label: 'Novas Tarefas', count: unreadNewTasks.length },
        { key: 'atualizacoes_tarefas', label: 'Atualizações de Tarefas', count: unreadTaskUpdates.length },
        { key: 'chat_cliente', label: 'Chat Cliente', count: unreadSupportCount },
      ];

  const goTo = (path) => {
    setOpen(false);
    if (onNavigate) onNavigate(path);
  };

  const renderAdminTab = () => {
    if (activeTab === 'chat_macedo') {
      if (!chatMacedoSummary.length) {
        return <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-gray-400">Sem novas mensagens internas.</div>;
      }
      return chatMacedoSummary.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => {
            markNotificationViewed(item.raw || item);
            goTo('/chat');
          }}
          className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10"
        >
          <p className="text-xs font-medium text-white">{item.title}</p>
          <p className="mt-1 text-xs text-gray-300 line-clamp-2">{item.subtitle}</p>
          <p className="mt-1 text-[10px] text-gray-500">{item.date}</p>
        </button>
      ));
    }

    if (activeTab === 'novas_tarefas') {
      if (!newTasks.length) {
        return <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-gray-400">Sem novas tarefas.</div>;
      }
      return newTasks.slice(0, 4).map((task) => (
        <button
          key={task.id}
          type="button"
          onClick={() => {
            markGenericViewed(`task_new:${task.id}`);
            goTo('/dashboard/novas-tarefas');
          }}
          className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10"
        >
          <p className="text-xs font-medium text-white">{task.titulo}</p>
          <p className="mt-1 text-[11px] text-gray-400">Setor: {task.moduleKey}</p>
        </button>
      ));
    }

    if (activeTab === 'atualizacoes_tarefas') {
      if (!taskUpdates.length) {
        return <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-gray-400">Sem atualizações de tarefas.</div>;
      }
      return taskUpdates.slice(0, 4).map((task) => (
        <button
          key={task.id}
          type="button"
          onClick={() => {
            markGenericViewed(`task_update:${task.id}`);
            goTo('/dashboard/tarefas-pendentes');
          }}
          className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10"
        >
          <p className="text-xs font-medium text-white">{task.titulo}</p>
          <p className="mt-1 text-[11px] text-gray-400">Status: {task.status}</p>
        </button>
      ));
    }

    if (!chatClienteSummary.length) {
      return <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-gray-400">Sem mensagens de clientes.</div>;
    }
    return chatClienteSummary.map((item) => (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          if (item.id) markSupportThreadRead({ clientId: item.id, audience: 'contabilidade' });
          goTo('/chat');
        }}
        className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10"
      >
        <p className="text-xs font-medium text-white">{item.title}</p>
        <p className="mt-1 text-xs text-gray-300 line-clamp-2">{item.subtitle}</p>
        <p className="mt-1 text-[10px] text-gray-500">{item.date}</p>
      </button>
    ));
  };

  return (
    <div style={{ zIndex: Z_LAYERS.notificationTrigger }} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
        }}
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

      {open ? createPortal(
        <div
          style={{ top: panelStyle.top, left: panelStyle.left, width: panelStyle.width, zIndex: Z_LAYERS.notificationPanel }}
          className="fixed rounded-2xl border border-white/10 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-xl"
        >
          {mode === 'client' ? (
            <div className="space-y-2">
              {chatClienteSummary.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id) markSupportThreadRead({ clientId: item.id, audience: mode === 'client' ? 'cliente' : 'contabilidade' });
                    setOpen(false);
                    if (onOpenClientChat) onOpenClientChat();
                  }}
                  className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10"
                >
                  <p className="text-xs font-medium text-white">{item.title}</p>
                  <p className="mt-1 text-xs text-gray-300">{item.subtitle}</p>
                </button>
              ))}
              {!chatClienteSummary.length ? (
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-gray-400">
                  Sem novidades no chat do cliente.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] ${
                      activeTab === tab.key
                        ? 'border-red-500/35 bg-red-500/15 text-red-100'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {tab.key === 'chat_macedo' ? <MessageCircle className="h-3 w-3" /> : null}
                    {tab.key === 'novas_tarefas' ? <CheckSquare className="h-3 w-3" /> : null}
                    {tab.key === 'atualizacoes_tarefas' ? <RefreshCcw className="h-3 w-3" /> : null}
                    {tab.key === 'chat_cliente' ? <UsersRound className="h-3 w-3" /> : null}
                    {tab.label}
                    {tab.count > 0 ? <span className="ml-0.5 text-[10px] text-red-200">({tab.count})</span> : null}
                  </button>
                ))}
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {renderAdminTab()}
              </div>
            </div>
          )}
        </div>,
        document.body,
      ) : null}
    </div>
  );
};

export default NotificationBell;
