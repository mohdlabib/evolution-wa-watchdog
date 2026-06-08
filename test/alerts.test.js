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

test('send once to private owner if old alert record used another recipient', () => {
  assert.equal(shouldSendAlert({
    previousState: 'disconnected',
    currentState: 'disconnected',
    lastRecipientNumber: '6280000000000',
    currentRecipientNumber: '6281111111111',
  }), true);
});

test('do not repeat after private owner already received the disconnect alert', () => {
  assert.equal(shouldSendAlert({
    previousState: 'disconnected',
    currentState: 'disconnected',
    lastRecipientNumber: '6281111111111',
    currentRecipientNumber: '6281111111111',
  }), false);
});

test('send recovery only when moving from down to connected', () => {
  assert.equal(shouldSendRecovery({ previousState: 'disconnected', currentState: 'connected' }), true);
  assert.equal(shouldSendRecovery({ previousState: 'connected', currentState: 'connected' }), false);
});

test('down message includes key operational fields', () => {
  const msg = buildDownMessage({ instance: 'wa-1', profileName: 'Customer A', checkedAt: '1/1/2026 WIB' });
  assert.match(msg, /Digichat Alert/);
  assert.match(msg, /Customer A \(wa-1\)/);
  assert.match(msg, /Tidak Terhubung/);
  assert.match(msg, /hanya dikirim ke nomor pemilik instance/);
  assert.doesNotMatch(msg, /WA Watchdog/);
});
