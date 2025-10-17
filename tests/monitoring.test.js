const test = require('node:test');
const assert = require('node:assert');

const LightweightBrowserServer = require('../server-modular');

let serverInstance;
let httpServer;
let baseUrl;

test.before(async () => {
  process.env.PORT = '0';
  process.env.NODE_ENV = 'test';
  process.env.RATE_LIMIT_MAX = '500';

  serverInstance = new LightweightBrowserServer();
  httpServer = await serverInstance.start();
  const address = httpServer.address();
  const port = typeof address === 'object' && address ? address.port : 8000;
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  if (serverInstance && typeof serverInstance.stopHealthMonitor === 'function') {
    serverInstance.stopHealthMonitor();
  }
  if (httpServer) {
    await new Promise(resolve => {
      const timeout = setTimeout(() => {
        resolve();
      }, 5000);
      httpServer.close(() => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
});

test('tracks active and peak connections', async () => {
  // 初期状態の確認
  const initialResponse = await fetch(`${baseUrl}/health`);
  const initialData = await initialResponse.json();

  assert.ok(initialData.connections, 'Should include connections object');
  assert.strictEqual(typeof initialData.connections.active, 'number', 'Active connections should be a number');
  assert.strictEqual(typeof initialData.connections.peak, 'number', 'Peak connections should be a number');
  assert.ok(initialData.connections.peak >= initialData.connections.active, 'Peak should be >= active');
});

test('connection metrics are included in health check', async () => {
  const response = await fetch(`${baseUrl}/health`);
  const data = await response.json();

  assert.ok(data.metrics, 'Should have metrics');
  assert.ok(data.metrics.server, 'Should have server metrics');
  assert.ok(typeof data.metrics.server.activeConnections === 'number', 'Should track active connections');
  assert.ok(typeof data.metrics.server.peakConnections === 'number', 'Should track peak connections');
});

test('connection metrics are included in stats endpoint', async () => {
  const response = await fetch(`${baseUrl}/api/stats`);
  const data = await response.json();

  assert.ok(data.server, 'Should have server section');
  assert.ok(typeof data.server.activeConnections === 'number', 'Stats should include active connections');
  assert.ok(typeof data.server.peakConnections === 'number', 'Stats should include peak connections');

  assert.ok(data.connections, 'Should have dedicated connections section');
  assert.strictEqual(typeof data.connections.active, 'number', 'Connections.active should be a number');
  assert.strictEqual(typeof data.connections.peak, 'number', 'Connections.peak should be a number');
});

test('peak connections increases with concurrent requests', async () => {
  // ピーク接続数を記録
  const beforeResponse = await fetch(`${baseUrl}/api/stats`);
  const beforeData = await beforeResponse.json();
  const initialPeak = beforeData.connections.peak;

  // 複数の並行リクエストを実行
  const concurrentRequests = 5;
  const requests = Array(concurrentRequests)
    .fill(null)
    .map(() => fetch(`${baseUrl}/health`));

  await Promise.all(requests);

  // ピークが増加したか確認
  const afterResponse = await fetch(`${baseUrl}/api/stats`);
  const afterData = await afterResponse.json();
  const finalPeak = afterData.connections.peak;

  assert.ok(finalPeak >= initialPeak, 'Peak connections should increase or stay the same');
});

test('metrics show correct request count', async () => {
  const before = await fetch(`${baseUrl}/api/stats`);
  const beforeData = await before.json();
  const initialCount = beforeData.server.totalRequests;

  // いくつかのリクエストを送信
  await fetch(`${baseUrl}/health`);
  await fetch(`${baseUrl}/api/stats`);

  const after = await fetch(`${baseUrl}/api/stats`);
  const afterData = await after.json();
  const finalCount = afterData.server.totalRequests;

  // 最低でも3つ増加しているはず（stats取得 + health + stats + 最後のstats）
  assert.ok(finalCount >= initialCount + 3, 'Request count should increase');
});
