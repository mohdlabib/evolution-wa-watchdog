import test from 'node:test';
import assert from 'node:assert/strict';
import { EvolutionClient } from '../src/evolutionClient.js';

test('fetchInstances accepts array response', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return new Response(JSON.stringify([{ name: 'wa-1' }]), { status: 200 });
  };
  const client = new EvolutionClient({ baseUrl: 'https://example.com/', apiKey: 'secret', fetchImpl });
  const instances = await client.fetchInstances();
  assert.equal(instances[0].name, 'wa-1');
  assert.equal(calls[0].url, 'https://example.com/instance/fetchInstances');
  assert.equal(calls[0].opts.headers.apikey, 'secret');
});

test('sendText posts expected Evolution payload', async () => {
  let captured;
  const fetchImpl = async (url, opts) => {
    captured = { url, opts };
    return new Response(JSON.stringify({ key: { id: 'msg-1' } }), { status: 200 });
  };
  const client = new EvolutionClient({ baseUrl: 'https://example.com', apiKey: 'secret', fetchImpl });
  await client.sendText('test-bot', '6283185730662', 'hello');
  assert.equal(captured.url, 'https://example.com/message/sendText/test-bot');
  assert.equal(captured.opts.method, 'POST');
  assert.deepEqual(JSON.parse(captured.opts.body), { number: '6283185730662', text: 'hello' });
});

test('request throws useful error on non-2xx', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ message: 'forbidden' }), { status: 403 });
  const client = new EvolutionClient({ baseUrl: 'https://example.com', apiKey: 'secret', fetchImpl });
  await assert.rejects(() => client.fetchInstances(), /403 forbidden/);
});
