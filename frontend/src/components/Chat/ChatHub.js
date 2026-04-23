import React, { useMemo, useState } from 'react';
import { Building2, MessageSquare, Send, Users } from 'lucide-react';
import ChatEnhanced from './ChatEnhanced';
import {
  listSupportThreadsForAccounting,
  markSupportThreadRead,
  sendSupportMessage,
  startSupportThread,
} from '../../dev/clientSupportChat';

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

const ChatClientePanel = () => {
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);
  const [threads, setThreads] = useState(() => listSupportThreadsForAccounting());
  const [selectedClientId, setSelectedClientId] = useState(() => listSupportThreadsForAccounting()?.[0]?.clientId || '');
  const [draft, setDraft] = useState('');
  const [clientOptions, setClientOptions] = useState([]);
  const [newClientId, setNewClientId] = useState('');

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.clientId === selectedClientId) || null,
    [threads, selectedClientId],
  );

  const reload = () => {
    const list = listSupportThreadsForAccounting();
    setThreads(list);
    if (!selectedClientId && list.length) setSelectedClientId(list[0].clientId);
  };

  React.useEffect(() => {
    let mounted = true;
    const loadClients = async () => {
      try {
        const token = localStorage.getItem('token');
        const baseUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
        const response = await fetch(`${baseUrl}/api/clients?limit=2000`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) return;
        const payload = await response.json();
        const rows = Array.isArray(payload?.clients) ? payload.clients : Array.isArray(payload) ? payload : [];
        const mapped = rows
          .map((item) => ({
            id: String(item?.id || '').trim(),
            nome: String(item?.nome_empresa || item?.nome_fantasia || '').trim(),
          }))
          .filter((item) => item.id && item.nome)
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        if (mounted) {
          setClientOptions(mapped);
          if (!newClientId && mapped.length) setNewClientId(mapped[0].id);
        }
      } catch {
        // silencioso
      }
    };
    loadClients();
    return () => {
      mounted = false;
    };
  }, []);

  const handleStartChat = () => {
    const selected = clientOptions.find((item) => String(item.id) === String(newClientId));
    if (!selected) return;
    startSupportThread({ clientId: selected.id, clientName: selected.nome });
    setSelectedClientId(selected.id);
    reload();
  };

  const handleSend = () => {
    if (!selectedClientId || !draft.trim()) return;
    sendSupportMessage({
      clientId: selectedClientId,
      clientName: selectedThread?.clientName,
      from: 'contabilidade',
      senderName: currentUser?.name || 'Contabilidade',
      text: draft,
    });
    markSupportThreadRead({ clientId: selectedClientId, audience: 'contabilidade' });
    setDraft('');
    reload();
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
        <div className="mb-3 text-sm font-semibold text-white">Chat cliente</div>
        <div className="mb-3 rounded-lg border border-white/10 bg-white/5 p-2">
          <div className="mb-2 text-xs text-gray-300">Iniciar chat com cliente</div>
          <div className="flex gap-2">
            <select
              value={newClientId}
              onChange={(event) => setNewClientId(event.target.value)}
              className="input-futuristic w-full rounded-lg px-2 py-2 text-sm"
            >
              <option value="">Selecione o cliente</option>
              {clientOptions.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.nome}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleStartChat}
              disabled={!newClientId}
              className="rounded-lg border border-red-500/30 bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-100 hover:bg-red-500/25 disabled:opacity-40"
            >
              Iniciar
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {threads.map((thread) => (
            <button
              key={thread.clientId}
              type="button"
              onClick={() => {
                setSelectedClientId(thread.clientId);
                markSupportThreadRead({ clientId: thread.clientId, audience: 'contabilidade' });
              }}
              className={`w-full rounded-lg border px-3 py-2 text-left ${
                selectedClientId === thread.clientId
                  ? 'border-red-500/35 bg-red-500/15'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="text-sm font-medium text-white">{thread.clientName}</div>
              <div className="text-xs text-gray-400">{thread.clientId}</div>
            </button>
          ))}
          {!threads.length ? (
            <div className="rounded-lg border border-dashed border-white/15 bg-white/5 p-3 text-sm text-gray-400">
              Nenhum chat de cliente ainda.
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
        {selectedThread ? (
          <>
            <div className="mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-cyan-300" />
              <div className="text-sm font-semibold text-white">{selectedThread.clientName}</div>
            </div>
            <div className="max-h-[440px] space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3">
              {(selectedThread.messages || []).map((message) => (
                <div key={message.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-[11px] text-gray-400">{message.senderName}</div>
                  <div className="mt-1 text-sm text-white">{message.text}</div>
                  <div className="mt-1 text-[10px] text-gray-500">{formatDateTime(message.createdAt)}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Responder cliente..."
                className="input-futuristic w-full rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!draft.trim()}
                className="rounded-lg border border-red-500/30 bg-red-500/15 px-3 py-2 text-red-100 hover:bg-red-500/25 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-5 text-sm text-gray-400">
            Selecione uma conversa de cliente.
          </div>
        )}
      </div>
    </div>
  );
};

const ChatHub = () => {
  const [tab, setTab] = useState('interno');

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl border border-white/10 p-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('interno')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
              tab === 'interno'
                ? 'bg-red-600 text-white'
                : 'bg-white/5 text-gray-200 hover:bg-white/10'
            }`}
          >
            <Users className="h-4 w-4" />
            Chat Interno
          </button>
          <button
            type="button"
            onClick={() => setTab('cliente')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
              tab === 'cliente'
                ? 'bg-red-600 text-white'
                : 'bg-white/5 text-gray-200 hover:bg-white/10'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Chat Cliente
          </button>
        </div>
      </div>

      {tab === 'interno' ? <ChatEnhanced /> : <ChatClientePanel />}
    </div>
  );
};

export default ChatHub;
