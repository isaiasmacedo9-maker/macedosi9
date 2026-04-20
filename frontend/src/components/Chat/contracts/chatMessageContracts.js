export const ChatActionTypes = {
  quickInteraction: 'quick_interaction',
  save: 'save_message',
  markUnread: 'mark_unread',
  reminder: 'reminder',
  pin: 'pin_message',
  unpin: 'unpin_message',
  forward: 'forward_message',
};

export const buildPinContractPayload = ({ conversationId, messageKey, durationId, expiresAt }) => ({
  action: ChatActionTypes.pin,
  conversationId,
  messageKey,
  durationId,
  expiresAt,
  requestedAt: new Date().toISOString(),
});

export const buildReminderContractPayload = ({ conversationId, messageKey, text }) => ({
  action: ChatActionTypes.reminder,
  conversationId,
  messageKey,
  text,
  requestedAt: new Date().toISOString(),
});
