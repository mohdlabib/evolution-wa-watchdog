import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConfig } from '../src/config.js';

const baseEnv = {
  EVOLUTION_BASE_URL: 'https://wa-api.example.test/',
  EVOLUTION_API_KEY: 'secret',
  ALERT_SENDER_INSTANCE: 'test-bot',
  ALERT_RECIPIENT_NUMBER: '083185730662',
};

test('excludes alert sender instance from monitoring by default', () => {
  const config = buildConfig(baseEnv);
  assert.equal(config.evolutionBaseUrl, 'https://wa-api.example.test');
  assert.deepEqual(config.ignoredInstances, ['test-bot']);
});

test('merges configured excluded instances and disables recovery alerts by default', () => {
  const config = buildConfig({
    ...baseEnv,
    EXCLUDED_INSTANCES: 'foo, bar',
    IGNORE_INSTANCES: 'legacy',
  });

  assert.deepEqual(config.ignoredInstances, ['legacy', 'foo', 'bar', 'test-bot']);
  assert.equal(config.sendRecoveryAlerts, false);
});

test('can explicitly enable recovery alerts', () => {
  const config = buildConfig({ ...baseEnv, SEND_RECOVERY_ALERTS: 'true' });
  assert.equal(config.sendRecoveryAlerts, true);
});
