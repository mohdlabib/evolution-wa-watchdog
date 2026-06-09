import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldSendAlert, shouldSendRecovery, buildDownMessage } from '../src/alerts.js';

const GRACE_MS = 120000; // 2 menit

test('do not alert before the 2-minute grace period elapses', () => {
  assert.equal(shouldSendAlert({
    currentState: 'disconnected',
    disconnectedSince: 1000,
    alreadyAlerted: false,
    graceMs: GRACE_MS,
    nowMs: 1000 + 60000, // baru 1 menit
  }), false);
});

test('alert once after the disconnect lasts at least the grace period', () => {
  assert.equal(shouldSendAlert({
    currentState: 'disconnected',
    disconnectedSince: 1000,
    alreadyAlerted: false,
    graceMs: GRACE_MS,
    nowMs: 1000 + GRACE_MS, // tepat 2 menit
  }), true);
});

test('do not repeat the alert once it has already been sent this episode', () => {
  assert.equal(shouldSendAlert({
    currentState: 'disconnected',
    disconnectedSince: 1000,
    alreadyAlerted: true,
    graceMs: GRACE_MS,
    nowMs: 1000 + GRACE_MS + 600000,
  }), false);
});

test('never alert while the instance is connected', () => {
  assert.equal(shouldSendAlert({
    currentState: 'connected',
    disconnectedSince: null,
    alreadyAlerted: false,
    graceMs: GRACE_MS,
    nowMs: 999999999,
  }), false);
});

test('do not alert if disconnect episode has not been recorded yet', () => {
  assert.equal(shouldSendAlert({
    currentState: 'disconnected',
    disconnectedSince: null,
    alreadyAlerted: false,
    graceMs: GRACE_MS,
    nowMs: 999999999,
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
