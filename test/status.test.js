import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhoneNumber, normalizeConnectionState, summarizeInstance } from '../src/status.js';

test('normalize Indonesian WhatsApp numbers', () => {
  assert.equal(normalizePhoneNumber('083185730662'), '6283185730662');
  assert.equal(normalizePhoneNumber('6283185730662'), '6283185730662');
  assert.equal(normalizePhoneNumber('83185730662'), '6283185730662');
});

test('normalize common Evolution connection states', () => {
  assert.equal(normalizeConnectionState('open'), 'connected');
  assert.equal(normalizeConnectionState('connected'), 'connected');
  assert.equal(normalizeConnectionState('close'), 'disconnected');
  assert.equal(normalizeConnectionState('disconnected'), 'disconnected');
  assert.equal(normalizeConnectionState('connecting'), 'connecting');
  assert.equal(normalizeConnectionState('something-new'), 'unknown');
});

test('summarize instance from multiple Evolution response shapes', () => {
  assert.deepEqual(summarizeInstance({ name: 'wa-1', state: 'open' }), {
    name: 'wa-1',
    rawState: 'open',
    state: 'connected',
    ownerJid: null,
  });
  assert.equal(summarizeInstance({ instance: { instanceName: 'wa-2', connectionStatus: 'close' } }).name, 'wa-2');
});
