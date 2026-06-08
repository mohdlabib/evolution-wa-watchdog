export function normalizePhoneNumber(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

export function instanceName(instance) {
  return instance?.name || instance?.instanceName || instance?.instance?.instanceName || instance?.instance?.instance || instance?.instance || instance?.id || 'unknown';
}

export function extractRawState(payload) {
  if (!payload) return 'unknown';
  if (typeof payload === 'string') return payload;
  return payload.state
    || payload.connectionState
    || payload.status
    || payload.instance?.state
    || payload.instance?.connectionState
    || payload.instance?.status
    || payload.instance?.connectionStatus
    || payload.connectionStatus
    || payload.ownerJid
    || 'unknown';
}

export function normalizeConnectionState(raw) {
  const text = String(raw || '').toLowerCase();
  // Check negative states before positive states because "disconnected" contains "connected".
  if (['close', 'closed', 'disconnected', 'disconnect', 'offline', 'logout', 'not_found', 'notfound', 'false'].some((x) => text === x || text.includes(x))) return 'disconnected';
  if (['connecting', 'qr', 'pairing', 'loading'].some((x) => text.includes(x))) return 'connecting';
  if (['open', 'connected', 'connect', 'online', 'true'].some((x) => text === x || text.includes(x))) return 'connected';
  return 'unknown';
}

export function summarizeInstance(instance, statePayload = null) {
  const raw = statePayload ? extractRawState(statePayload) : extractRawState(instance);
  return {
    name: instanceName(instance),
    rawState: raw,
    state: normalizeConnectionState(raw),
    ownerJid: instance?.ownerJid || instance?.instance?.ownerJid || statePayload?.ownerJid || statePayload?.instance?.ownerJid || null,
  };
}

export function isDisconnectedState(state) {
  return ['disconnected', 'unknown'].includes(state);
}
