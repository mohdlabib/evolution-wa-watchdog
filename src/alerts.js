import { isDisconnectedState } from './status.js';

export function shouldSendAlert({ previousState, currentState, lastRecipientNumber, currentRecipientNumber }) {
  const currentlyDown = isDisconnectedState(currentState);
  if (!currentlyDown) return false;

  const wasUpOrNew = !previousState || !isDisconnectedState(previousState);
  if (wasUpOrNew) return true;

  // If the alert-routing policy changed, send once to the correct private owner number,
  // then persist lastRecipientNumber so it will not repeat while still disconnected.
  return Boolean(currentRecipientNumber) && lastRecipientNumber !== currentRecipientNumber;
}

export function shouldSendRecovery({ previousState, currentState }) {
  return isDisconnectedState(previousState) && currentState === 'connected';
}

export function buildDownMessage({ instance, profileName, checkedAt }) {
  const displayName = profileName ? `${profileName} (${instance})` : instance;
  return [
    '🚨 *Digichat Alert*',
    '',
    `Halo, kami mendeteksi koneksi WhatsApp *${displayName}* sedang terputus.`,
    '',
    'Status: *Tidak Terhubung*',
    `Waktu: ${checkedAt}`,
    '',
    'Silakan scan ulang QR / login kembali di dashboard Digichat agar layanan dapat berjalan normal lagi.',
    '',
    '_Pesan ini otomatis dan hanya dikirim ke nomor pemilik instance terkait._',
  ].join('\n');
}

export function buildRecoveryMessage({ instance, checkedAt }) {
  return [
    '✅ *WA Watchdog Recovery*',
    '',
    `Instance: *${instance}*`,
    'Status: *TERHUBUNG KEMBALI*',
    `Waktu: ${checkedAt}`,
  ].join('\n');
}

export function buildStartupMessage({ connected, disconnected, checkedAt }) {
  return [
    '🟢 *WA Watchdog Aktif*',
    '',
    `Terhubung: ${connected}`,
    `Terputus/Unknown: ${disconnected}`,
    `Waktu: ${checkedAt}`,
  ].join('\n');
}
