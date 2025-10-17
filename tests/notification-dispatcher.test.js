'use strict';

const test = require('node:test');
const assert = require('node:assert');

const NotificationDispatcher = require('../utils/notification-dispatcher');

const TEST_WEBHOOK = 'https://example.com/webhook';

function createDispatcher(overrides = {}) {
  return new NotificationDispatcher({
    enabled: true,
    webhooks: [TEST_WEBHOOK],
    minLevel: 'info',
    timeoutMs: 100,
    batchWindowMs: 0,
    retryLimit: 0,
    retryBackoffMs: 100,
    ...overrides
  });
}

test('dispatch respects minimum level and captures payload', async t => {
  const calls = [];
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    calls.push({ url, body: JSON.parse(options.body || '{}') });
    return { ok: true, status: 200 };
  });

  const dispatcher = createDispatcher({ minLevel: 'warning' });

  await dispatcher.dispatch({ level: 'info', title: 'should be ignored' });
  await dispatcher.dispatch({ level: 'warning', title: 'should send', data: { id: 1 } });

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, TEST_WEBHOOK);
  assert.strictEqual(calls[0].body.title, 'should send');
  assert.deepStrictEqual(calls[0].body.data, { id: 1 });
  assert.strictEqual(dispatcher.dispatchedCount, 1);
  assert.strictEqual(dispatcher.failedCount, 0);

  fetchMock.mock.restore();
});

test('batch window groups multiple events into single payload', async t => {
  const calls = [];
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    calls.push({ url, body: JSON.parse(options.body || '{}') });
    return { ok: true, status: 200 };
  });

  const dispatcher = createDispatcher({ batchWindowMs: 50 });

  await dispatcher.dispatch({ level: 'warning', title: 'first' });
  await dispatcher.dispatch({ level: 'error', title: 'second' });

  await new Promise(resolve => setTimeout(resolve, 80));

  assert.strictEqual(calls.length, 1, 'batched dispatch should send once');
  const payload = calls[0].body;
  assert.strictEqual(payload.type, 'batch');
  assert.ok(Array.isArray(payload.data?.entries));
  assert.strictEqual(payload.data.entries.length, 2);
  assert.deepStrictEqual(
    payload.data.entries.map(entry => entry.title),
    ['first', 'second']
  );
  assert.strictEqual(dispatcher.dispatchedCount, 1);
  assert.strictEqual(dispatcher.failedCount, 0);

  fetchMock.mock.restore();
});

test('retry logic retries until success and records statistics', async t => {
  let attempt = 0;
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    attempt += 1;
    if (attempt < 3) {
      const error = new Error('temporary failure');
      /** @type {Error & { code?: string }} */ (error).code = 'ECONNRESET';
      throw error;
    }
    return { ok: true, status: 200 };
  });

  const dispatcher = createDispatcher({ retryLimit: 4, retryBackoffMs: 10 });

  await dispatcher.dispatch({ level: 'error', title: 'retry test' });

  assert.strictEqual(fetchMock.mock.calls.length, 3);
  assert.strictEqual(dispatcher.dispatchedCount, 1);
  assert.strictEqual(dispatcher.failedCount, 0);
  assert.ok(typeof dispatcher.lastDispatchAt === 'number');

  fetchMock.mock.restore();
});

test('exhausted retries increment failure counter', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('permanent failure');
  });

  const dispatcher = createDispatcher({ retryLimit: 2, retryBackoffMs: 5 });

  await dispatcher.dispatch({ level: 'error', title: 'will fail' });

  assert.strictEqual(dispatcher.dispatchedCount, 0);
  assert.strictEqual(dispatcher.failedCount, 1);
  assert.strictEqual(fetchMock.mock.calls.length, 3);

  fetchMock.mock.restore();
});
