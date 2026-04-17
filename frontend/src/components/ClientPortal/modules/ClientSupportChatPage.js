import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import {
  getSupportThread,
  markSupportThreadRead,
  sendSupportMessage,
  subscribeSupportChat,
} from '../../../dev/clientSupportChat';
import { getPortalClientById } from '../../../dev/clientPortalData';

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

const ClientSupportChatPage = ({ clienteId, authUser }) => {
  const [draft, setDraft] = useState('');
  const [thread, setThread] = useState(() => getSupportThread(clienteId));

  const portalClient = useMemo(() => getPortalClientById(clienteId), [clienteId]);

  const reloadThread = () => {
    setThread(getSupportThread(clienteId, portalClient?.nome_fantasia));
  };

  useEffect(() => {
    reloadThread();
    markSupportThreadRead({ clientId: clienteId, audience: 'cliente' });
    const unsubscribe = subscribeSupportChat(reloadThread);
    return () => unsubscribe();
  }, [clienteId, portalClient?.nome_fantasia]);

  const handleSend = () => {
    if (!draft.trim()) return;
    sendSupportMessage({
      clientId: clienteId,
      clientName: portalClient?.nome_fantasia,
      from: 'cliente',
      senderName: authUser?.name || portalClient?.nome_fantasia || 'Cliente',
      text: draft,
    });
    setDraft('');
    markSupportThreadRead({ clientId: clienteId, audience: 'cliente' });
    reloadThread();
  };

  return (
    <div className="space-y-5">
      <div className="glass-intense rounded-[26px] border border-white/10 p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/15 p-2.5">
            <MessageCircle className="h-5 w-5 text-sky-200" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Contato com a Contabilidade</h1>
            <p className="text-sm text-gray-400">Canal direto para dúvidas, solicitações e acompanhamento.</p>
          </div>
        </div>
      </div>

      <div className="glass rounded-[24px] border border-white/10 p-4">
        <div className="max-h-[460px] space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-3">
          {(thread?.messages || []).map((message) => {
            const isClient = message.from === 'cliente';
            return (
              <div key={message.id} className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl border px-4 py-2.5 ${
                  isClient
                    ? 'border-sky-500/35 bg-sky-500/20 text-sky-50'
                    : 'border-white/15 bg-white/10 text-white'
                }`}>
                  <p className="text-xs opacity-80">{message.senderName}</p>
                  <p className="mt-1 text-sm">{message.text}</p>
                  <p className="mt-1 text-[11px] opacity-70">{formatDateTime(message.createdAt)}</p>
                </div>
              </div>
            );
          })}

          {!thread?.messages?.length ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-gray-400">
              Nenhuma conversa ainda. Envie sua primeira mensagem para a contabilidade.
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Digite sua mensagem..."
            className="input-futuristic w-full rounded-xl px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleSend}
            className="rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-2 text-red-100 hover:bg-red-500/25"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientSupportChatPage;
