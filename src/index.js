import http from 'node:http';
import { buildConfig, loadDotEnv } from './config.js';
import { EvolutionClient } from './evolutionClient.js';
import { JsonStateStore } from './stateStore.js';
import { normalizePhoneNumber, summarizeInstance, isDisconnectedState } from './status.js';
import { buildDownMessage, buildRecoveryMessage, buildStartupMessage, shouldSendAlert, shouldSendRecovery } from './alerts.js';

export class WatchdogWorker {
  constructor({ config, client, store, logger = console, now = () => Date.now() }) {
    this.config = config;
    this.client = client;
    this.store = store;
    this.logger = logger;
    this.now = now;
    this.state = store.load();
    this.timer = null;
    this.running = false;
    this.lastHealth = { ok: true, lastCheckAt: null, error: null, summary: [] };
  }

  async sendAlert(text, recipientNumber) {
    const number = normalizePhoneNumber(recipientNumber);
    if (!number) throw new Error('Missing private recipient owner number');
    if (this.config.dryRun) {
      this.logger.log(`[DRY RUN] Alert to ${number}: ${text.split('\n')[0]}`);
      return { dryRun: true, number };
    }
    return this.client.sendText(this.config.alertSenderInstance, number, text);
  }

  async checkOnce() {
    const nowMs = this.now();
    const now = new Date(nowMs);
    const checkedAt = now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB';
    const ignored = new Set(this.config.ignoredInstances);
    const instances = await this.client.fetchInstances();
    const summaries = [];
    let alertCount = 0;

    // Kumpulkan semua nama instance yang masih ada di Evolution untuk keperluan prune.
    const existingNames = new Set();
    for (const instance of instances) {
      const existingName = summarizeInstance(instance).name;
      if (existingName && existingName !== 'unknown') existingNames.add(existingName);
    }

    for (const instance of instances) {
      const name = summarizeInstance(instance).name;
      if (!name || name === 'unknown' || ignored.has(name)) continue;

      let statePayload = instance;
      try {
        statePayload = await this.client.connectionState(name);
      } catch (err) {
        statePayload = { state: 'unknown', error: err.message };
      }

      const summary = summarizeInstance(instance, statePayload);
      summaries.push(summary);

      const previous = this.state.instances[name] || {};
      const alertRecord = this.state.alerts[name] || {};

      if (isDisconnectedState(summary.state)) {
        // Mulai atau lanjutkan episode disconnect. disconnectedSince adalah
        // awal episode; dipertahankan selama instance belum reconnect.
        const disconnectedSince = alertRecord.disconnectedSince || nowMs;
        const alreadyAlerted = Boolean(alertRecord.alerted);

        if (shouldSendAlert({
          currentState: summary.state,
          disconnectedSince,
          alreadyAlerted,
          graceMs: this.config.disconnectGraceMs,
          nowMs,
        })) {
          if (!summary.ownerNumber) {
            this.logger.warn(`[SKIP] ${name} is down but owner number is missing`);
            // Pertahankan episode agar grace tetap dihitung; alert dikirim saat owner number tersedia.
            this.state.alerts[name] = { disconnectedSince, alerted: false };
          } else {
            await this.sendAlert(buildDownMessage({
              instance: name,
              profileName: summary.profileName,
              checkedAt,
            }), summary.ownerNumber);
            this.state.alerts[name] = {
              disconnectedSince,
              alerted: true,
              lastAlertAt: now.toISOString(),
              lastRecipientNumber: summary.ownerNumber,
            };
            alertCount++;
          }
        } else {
          // Masih dalam masa grace, atau alert episode ini sudah dikirim: jaga record.
          this.state.alerts[name] = {
            ...alertRecord,
            disconnectedSince,
            alerted: alreadyAlerted,
          };
        }
      } else if (summary.state === 'connected') {
        // Reconnect: reset notifikasi supaya episode disconnect berikutnya dialert lagi.
        if (
          this.config.sendRecoveryAlerts &&
          shouldSendRecovery({ previousState: previous.state, currentState: summary.state }) &&
          summary.ownerNumber
        ) {
          await this.sendAlert(buildRecoveryMessage({ instance: name, checkedAt }), summary.ownerNumber);
        }
        delete this.state.alerts[name];
      }
      // State transisi seperti 'connecting': biarkan record apa adanya (tidak reset, tidak mulai episode baru).

      this.state.instances[name] = {
        ...summary,
        checkedAt: now.toISOString(),
      };
    }

    // Privacy rule: do not send a global startup summary because it can mix multiple customers.
    // Each disconnect alert is sent only to the owner number of that specific instance.

    // Prune: hapus state untuk instance yang sudah tidak ada lagi di Evolution
    // (mis. instance dihapus), sehingga datanya ikut terhapus.
    for (const name of Object.keys(this.state.instances)) {
      if (!existingNames.has(name)) delete this.state.instances[name];
    }
    for (const name of Object.keys(this.state.alerts)) {
      if (!existingNames.has(name)) delete this.state.alerts[name];
    }

    this.state.lastCheckAt = now.toISOString();
    this.state.lastSummary = summaries;
    this.store.save(this.state);
    this.lastHealth = { ok: true, lastCheckAt: this.state.lastCheckAt, error: null, summary: summaries };
    this.logger.log(`[CHECK] ${summaries.length} instance checked, ${alertCount} alert sent`);
    return this.lastHealth;
  }

  async safeCheckOnce() {
    try {
      return await this.checkOnce();
    } catch (err) {
      this.lastHealth = { ok: false, lastCheckAt: new Date().toISOString(), error: err.message, summary: this.state.lastSummary || [] };
      this.logger.error('[CHECK] failed:', err.message);
      return this.lastHealth;
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.safeCheckOnce();
    this.timer = setInterval(() => this.safeCheckOnce(), this.config.pollIntervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.running = false;
  }
}

export function createHealthServer(worker, port) {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      // Liveness healthcheck for orchestrators/Coolify. Dependency status is exposed on /status.
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ alive: true, ...worker.lastHealth }));
      return;
    }
    if (req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(worker.state));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Evolution WA Watchdog OK\n');
  });
  server.listen(port, () => console.log(`[HTTP] health server listening on :${port}`));
  return server;
}

export function createWorker() {
  loadDotEnv();
  const config = buildConfig();
  const client = new EvolutionClient({
    baseUrl: config.evolutionBaseUrl,
    apiKey: config.evolutionApiKey,
    timeoutMs: config.requestTimeoutMs,
  });
  const store = new JsonStateStore(config.stateFile);
  return new WatchdogWorker({ config, client, store });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const worker = createWorker();
  createHealthServer(worker, worker.config.port);
  worker.start();

  process.on('SIGTERM', () => { worker.stop(); process.exit(0); });
  process.on('SIGINT', () => { worker.stop(); process.exit(0); });
}
