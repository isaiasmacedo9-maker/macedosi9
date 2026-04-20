import React from 'react';
import { Pin } from 'lucide-react';

const PinnedMessagesBar = ({ pinnedMessages = [], onOpenMessage, formatPinExpiry }) => {
  if (!pinnedMessages.length) return null;

  return (
    <div className="border-b border-gray-700 bg-gray-800/70 px-4 py-2">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-300">Mensagens fixadas</p>
      <div className="flex flex-wrap gap-2">
        {pinnedMessages.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onOpenMessage(item.key)}
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-amber-500/35 bg-amber-500/15 px-3 py-1 text-xs text-amber-100 hover:bg-amber-500/25"
          >
            <Pin size={12} />
            <span className="max-w-[220px] truncate">{String(item.message?.message || '(Sem texto)')}</span>
            <span className="text-[10px] text-amber-200/85">{formatPinExpiry(item.pinConfig?.expiresAt)}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default PinnedMessagesBar;
