import { isDisconnectedState } from './status.js';

export function shouldSendAlert({ previousState, currentState, lastAlertAt, nowMs, cooldownMs }) {
  const currentlyDown = isDisconnectedState(currentState);
  if (!currentlyDown) return false;

  const wasUpOrNew = !previousState || !isDisconnectedState(previousState);
  const cooldownExpired = !lastAlertAt || (nowMs - new Date(lastAlertAt).getTime()) >= cooldownMs;

  return wasUpOrNew || cooldownExpired;
}

export function shouldSendRecovery({ previousState, currentState }) {
  return isDisconnectedState(previousState) && currentState === 'connected';
}

export function buildDownMessage({ instance, previousState, rawState, checkedAt }) {
  return [
    '🚨 *WA Watchdog Alert*',
    '',
    `Instance: *${instance}*`,
    `Status: *TERPUTUS / TIDAK CONNECT*`,
    previousState ? `Sebelumnya: ${previousState}` : 'Sebelumnya: belum ada data',
    `Raw state: ${rawState || '-'}`,
    `Waktu: ${checkedAt}`,
    '',
    'Mohon cek QR/login Evolution API atau koneksi instance tersebut.',
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
