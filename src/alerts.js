import { isDisconnectedState } from './status.js';

/**
 * Tentukan apakah alert disconnect perlu dikirim.
 *
 * Aturan:
 * 1. Instance harus dalam keadaan terputus (disconnected/unknown).
 * 2. Belum pernah dialert pada episode disconnect saat ini (kirim sekali saja).
 * 3. Sudah terputus terus-menerus minimal `graceMs` (default 2 menit) agar
 *    tidak sensitif terhadap gangguan koneksi sesaat.
 *
 * @param {object} params
 * @param {string} params.currentState     - State ternormalisasi saat ini.
 * @param {number|null} params.disconnectedSince - Epoch ms saat episode disconnect dimulai.
 * @param {boolean} params.alreadyAlerted   - True jika alert episode ini sudah terkirim.
 * @param {number} params.graceMs           - Durasi grace sebelum alert dikirim.
 * @param {number} params.nowMs             - Epoch ms saat ini.
 * @returns {boolean}
 */
export function shouldSendAlert({ currentState, disconnectedSince, alreadyAlerted, graceMs = 0, nowMs = Date.now() }) {
  if (!isDisconnectedState(currentState)) return false;
  if (alreadyAlerted) return false;
  if (!disconnectedSince) return false;
  return nowMs - disconnectedSince >= graceMs;
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
