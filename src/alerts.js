import { isDisconnectedState } from './status.js';

export function shouldSendAlert({ previousState, currentState }) {
  const currentlyDown = isDisconnectedState(currentState);
  if (!currentlyDown) return false;

  // Send exactly once per disconnect episode.
  // Do not repeat while the instance stays disconnected, even after hours/days.
  return !previousState || !isDisconnectedState(previousState);
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
