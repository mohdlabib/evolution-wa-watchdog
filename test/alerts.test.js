import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldSendAlert, shouldSendRecovery, buildDownMessage } from '../src/alerts.js';

test('send alert on first disconnected detection', () => {
  assert.equal(shouldSendAlert({
    previousState: undefined,
    currentState: 'disconnected',
    lastAlertAt: null,
    nowMs: 1000,
    cooldownMs: 900000,
  }), true);
});

test('do not spam repeated disconnected alerts inside cooldown', () => {
  assert.equal(shouldSendAlert({
    previousState: 'disconnected',
    currentState: 'disconnected',
    lastAlertAt: new Date(1000).toISOString(),
    nowMs: 2000,
    cooldownMs: 900000,
  }), false);
});

test('never send repeated disconnected alerts while still down', () => {
  assert.equal(shouldSendAlert({
    previousState: 'disconnected',
    currentState: 'disconnected',
    lastAlertAt: new Date(1000).toISOString(),
    nowMs: 901001,
    cooldownMs: 900000,
  }), false);
});

test('send recovery only when moving from down to connected', () => {
  assert.equal(shouldSendRecovery({ previousState: 'disconnected', currentState: 'connected' }), true);
  assert.equal(shouldSendRecovery({ previousState: 'connected', currentState: 'connected' }), false);
});

test('down message includes key operational fields', () => {
  const msg = buildDownMessage({ instance: 'wa-1', previousState: 'connected', rawState: 'close', checkedAt: '1/1/2026 WIB' });
  assert.match(msg, /WA Watchdog Alert/);
  assert.match(msg, /wa-1/);
  assert.match(msg, /TERPUTUS/);
});
