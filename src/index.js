import http from 'node:http';
import { buildConfig, loadDotEnv } from './config.js';
import { EvolutionClient } from './evolutionClient.js';
import { JsonStateStore } from './stateStore.js';
import { normalizePhoneNumber, summarizeInstance } from './status.js';
import { buildDownMessage, buildRecoveryMessage, buildStartupMessage, shouldSendAlert, shouldSendRecovery } from './alerts.js';

export class WatchdogWorker {
  constructor({ config, client, store, logger = console }) {
    this.config = config;
    this.client = client;
    this.store = store;
    this.logger = logger;
    this.state = store.load();
    this.timer = null;
    this.running = false;
    this.lastHealth = { ok: true, lastCheckAt: null, error: null, summary: [] };
  }

  async sendAlert(text) {
    const number = normalizePhoneNumber(this.config.alertRecipientNumber);
    if (this.config.dryRun) {
      this.logger.log(`[DRY RUN] Alert to ${number}: ${text.split('\n')[0]}`);
      return { dryRun: true };
    }
    return this.client.sendText(this.config.alertSenderInstance, number, text);
  }

  async checkOnce() {
    const now = new Date();
    const checkedAt = now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB';
    const nowMs = now.getTime();
    const ignored = new Set(this.config.ignoredInstances);
    const instances = await this.client.fetchInstances();
    const summaries = [];
    let alertCount = 0;

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
      const lastAlertAt = this.state.alerts[name]?.lastAlertAt || null;

      if (shouldSendAlert({
        previousState: previous.state,
        currentState: summary.state,
        lastAlertAt,
        nowMs,
        cooldownMs: this.config.alertCooldownMs,
      })) {
        await this.sendAlert(buildDownMessage({
          instance: name,
          previousState: previous.state,
          rawState: summary.rawState,
          checkedAt,
        }));
        this.state.alerts[name] = { lastAlertAt: now.toISOString(), lastStatus: summary.state };
        alertCount++;
      } else if (this.config.sendRecoveryAlerts && shouldSendRecovery({ previousState: previous.state, currentState: summary.state })) {
        await this.sendAlert(buildRecoveryMessage({ instance: name, checkedAt }));
      }

      this.state.instances[name] = {
        ...summary,
        checkedAt: now.toISOString(),
      };
    }

    if (this.config.sendStartupSummary && !this.state.startupSummarySent) {
      const connected = summaries.filter((s) => s.state === 'connected').length;
      const disconnected = summaries.length - connected;
      await this.sendAlert(buildStartupMessage({ connected, disconnected, checkedAt }));
      this.state.startupSummarySent = true;
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
