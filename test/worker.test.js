import test from 'node:test';
import assert from 'node:assert/strict';
import { WatchdogWorker } from '../src/index.js';

function createStore(initial = {}) {
  return {
    state: { instances: {}, alerts: {}, lastSummary: [], ...initial },
    load() { return this.state; },
    save(next) { this.state = structuredClone(next); },
  };
}

function baseConfig() {
  return {
    alertSenderInstance: 'test-bot',
    alertRecipientNumber: '6280000000000',
    ignoredInstances: ['test-bot'],
    dryRun: false,
    sendRecoveryAlerts: false,
    sendStartupSummary: false,
    pollIntervalMs: 60000,
    alertCooldownMs: 900000,
  };
}

test('disconnect alerts are private per instance owner number', async () => {
  const sent = [];
  const client = {
    async fetchInstances() {
      return [
        { name: 'Customer A', ownerJid: '6281111111111@s.whatsapp.net', connectionStatus: 'close' },
        { name: 'Customer B', ownerJid: '6282222222222@s.whatsapp.net', connectionStatus: 'close' },
        { name: 'test-bot', ownerJid: '6283333333333@s.whatsapp.net', connectionStatus: 'close' },
      ];
    },
    async connectionState(name) {
      return { state: name === 'test-bot' ? 'close' : 'close' };
    },
    async sendText(instance, number, text) {
      sent.push({ instance, number, text });
      return { ok: true };
    },
  };

  const worker = new WatchdogWorker({
    config: baseConfig(),
    client,
    store: createStore(),
    logger: { log() {}, warn() {}, error() {} },
  });

  await worker.checkOnce();

  assert.deepEqual(sent.map((item) => item.number), ['6281111111111', '6282222222222']);
  assert.equal(sent.every((item) => item.instance === 'test-bot'), true);
  assert.equal(sent.every((item) => item.text.includes('Digichat Alert')), true);
  assert.equal(sent.some((item) => item.number === '6280000000000'), false);
});

test('down instance without owner number is skipped instead of sent to another number', async () => {
  const sent = [];
  const warnings = [];
  const client = {
    async fetchInstances() { return [{ name: 'No Owner', connectionStatus: 'close' }]; },
    async connectionState() { return { state: 'close' }; },
    async sendText(instance, number, text) { sent.push({ instance, number, text }); },
  };

  const worker = new WatchdogWorker({
    config: baseConfig(),
    client,
    store: createStore(),
    logger: { log() {}, warn(message) { warnings.push(message); }, error() {} },
  });

  await worker.checkOnce();

  assert.equal(sent.length, 0);
  assert.equal(warnings.some((message) => message.includes('owner number is missing')), true);
});
