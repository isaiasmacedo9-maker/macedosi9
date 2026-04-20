export const getLocalDayKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'invalid-day';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDaySeparatorLabel = (value) => {
  if (!value) return 'Data indisponivel';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponivel';
  const now = new Date();
  const todayKey = getLocalDayKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = getLocalDayKey(yesterday);
  const targetKey = getLocalDayKey(date);

  if (targetKey === todayKey) return 'Hoje';
  if (targetKey === yesterdayKey) return 'Ontem';

  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

export const buildMessageTimelineItems = (messages = [], getMessageKey) => {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const timeline = [];
  let previousDayKey = '';

  safeMessages.forEach((msg, index) => {
    const dayKey = getLocalDayKey(msg?.created_at);
    if (dayKey !== previousDayKey) {
      timeline.push({
        type: 'day',
        key: `day-${dayKey}-${index}`,
        dateValue: msg?.created_at,
      });
      previousDayKey = dayKey;
    }
    timeline.push({
      type: 'message',
      key: getMessageKey(msg),
      message: msg,
    });
  });

  return timeline;
};
