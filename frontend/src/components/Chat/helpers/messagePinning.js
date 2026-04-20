export const computePinExpiresAt = (createdAt, hours) => {
  if (hours == null) return null;
  const base = new Date(createdAt || Date.now());
  if (Number.isNaN(base.getTime())) return null;
  const expires = new Date(base.getTime() + hours * 60 * 60 * 1000);
  return expires.toISOString();
};

export const isPinActive = (meta = {}) => {
  if (!meta?.pinConfig?.pinnedAt) return false;
  if (!meta?.pinConfig?.expiresAt) return true;
  const expires = new Date(meta.pinConfig.expiresAt);
  if (Number.isNaN(expires.getTime())) return false;
  return expires.getTime() > Date.now();
};
