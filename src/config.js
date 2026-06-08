import { readFileSync, existsSync } from 'node:fs';

export function loadDotEnv(path = '.env') {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

export function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).toLowerCase());
}

export function parseList(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function requireEnv(env, key) {
  const value = env[key];
  if (!value) throw new Error(`Missing required env: ${key}`);
  return value;
}

export function buildConfig(env = process.env) {
  const pollIntervalSeconds = Number(env.POLL_INTERVAL_SECONDS || 60);
  const alertCooldownSeconds = Number(env.ALERT_COOLDOWN_SECONDS || 900);

  return {
    evolutionBaseUrl: requireEnv(env, 'EVOLUTION_BASE_URL').replace(/\/+$/, ''),
    evolutionApiKey: requireEnv(env, 'EVOLUTION_API_KEY'),
    alertSenderInstance: requireEnv(env, 'ALERT_SENDER_INSTANCE'),
    alertRecipientNumber: requireEnv(env, 'ALERT_RECIPIENT_NUMBER'),
    ignoredInstances: parseList(env.IGNORE_INSTANCES),
    pollIntervalMs: Math.max(10, pollIntervalSeconds) * 1000,
    alertCooldownMs: Math.max(60, alertCooldownSeconds) * 1000,
    stateFile: env.STATE_FILE || './data/state.json',
    port: Number(env.PORT || 8080),
    sendRecoveryAlerts: parseBool(env.SEND_RECOVERY_ALERTS, true),
    sendStartupSummary: parseBool(env.SEND_STARTUP_SUMMARY, false),
    dryRun: parseBool(env.DRY_RUN, false),
    requestTimeoutMs: Number(env.REQUEST_TIMEOUT_MS || 15000),
  };
}
