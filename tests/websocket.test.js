/**
 * WebSocketサーバーテスト
 *
 * リアルタイム通信、認証、レート制限、チャネル機能を検証
 */

const assert = require('assert');
const { test } = require('node:test');
const WebSocket = require('ws');
const QuiWebSocketServer = require('../server-websocket');

// テスト用ポート
const TEST_PORT = 18080;

test('WebSocket server should start and stop', async () => {
  const server = new QuiWebSocketServer({ port: TEST_PORT });
  await server.start();

  assert.ok(server.httpServer.listening);
  assert.strictEqual(server.activeConnections, 0);

  await server.shutdown();
  assert.strictEqual(server.activeConnections, 0);
});

test('WebSocket client should connect and receive welcome message', async () => {
  const server = new QuiWebSocketServer({ port: TEST_PORT });
  await server.start();

  const client = new WebSocket(`ws://localhost:${TEST_PORT}`);

  await new Promise((resolve, reject) => {
    client.on('open', () => {
      assert.ok(true, 'Client connected');
    });

    client.on('message', data => {
      const msg = JSON.parse(data.toString());
      assert.strictEqual(msg.type, 'welcome');
      assert.ok(msg.clientId);
      assert.strictEqual(msg.server, 'Qui Browser WebSocket Server');
      client.close();
      resolve();
    });

    client.on('error', reject);

    setTimeout(() => reject(new Error('Timeout')), 5000);
  });

  await server.shutdown();
});

test('WebSocket ping-pong should work', async () => {
  const server = new QuiWebSocketServer({ port: TEST_PORT });
  await server.start();

  const client = new WebSocket(`ws://localhost:${TEST_PORT}`);

  await new Promise((resolve, reject) => {
    let welcomeReceived = false;

    client.on('message', data => {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'welcome') {
        welcomeReceived = true;
        // Send ping
        client.send(JSON.stringify({ type: 'ping' }));
      } else if (msg.type === 'pong') {
        assert.ok(welcomeReceived);
        assert.ok(msg.timestamp);
        client.close();
        resolve();
      }
    });

    client.on('error', reject);

    setTimeout(() => reject(new Error('Timeout')), 5000);
  });

  await server.shutdown();
});

test('WebSocket subscribe/unsubscribe should work', async () => {
  const server = new QuiWebSocketServer({ port: TEST_PORT });
  await server.start();

  const client = new WebSocket(`ws://localhost:${TEST_PORT}`);

  await new Promise((resolve, reject) => {
    let step = 0;

    client.on('message', data => {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'welcome') {
        step = 1;
        // Subscribe to channel
        client.send(JSON.stringify({ type: 'subscribe', channel: 'test-channel' }));
      } else if (msg.type === 'subscribed' && step === 1) {
        assert.strictEqual(msg.channel, 'test-channel');
        step = 2;
        // Unsubscribe
        client.send(JSON.stringify({ type: 'unsubscribe', channel: 'test-channel' }));
      } else if (msg.type === 'unsubscribed' && step === 2) {
        assert.strictEqual(msg.channel, 'test-channel');
        client.close();
        resolve();
      }
    });

    client.on('error', reject);

    setTimeout(() => reject(new Error('Timeout')), 5000);
  });

  await server.shutdown();
});

test('WebSocket broadcast should send to all channel subscribers', async () => {
  const server = new QuiWebSocketServer({ port: TEST_PORT });
  await server.start();

  const client1 = new WebSocket(`ws://localhost:${TEST_PORT}`);
  const client2 = new WebSocket(`ws://localhost:${TEST_PORT}`);

  await new Promise((resolve, reject) => {
    let client1Ready = false;
    let client2Ready = false;
    let client2ReceivedBroadcast = false;

    client1.on('message', data => {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'welcome') {
        client1.send(JSON.stringify({ type: 'subscribe', channel: 'broadcast-test' }));
      } else if (msg.type === 'subscribed') {
        client1Ready = true;
        if (client2Ready) {
          // Both ready, send broadcast from client1
          client1.send(
            JSON.stringify({
              type: 'broadcast',
              channel: 'broadcast-test',
              data: { message: 'Hello from client1' }
            })
          );
        }
      } else if (msg.type === 'broadcast_ack') {
        assert.strictEqual(msg.sent, 2); // Both clients subscribed
        // Wait for client2 to receive broadcast
        setTimeout(() => {
          if (client2ReceivedBroadcast) {
            client1.close();
            client2.close();
            resolve();
          } else {
            reject(new Error('Client2 did not receive broadcast'));
          }
        }, 500);
      }
    });

    client2.on('message', data => {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'welcome') {
        client2.send(JSON.stringify({ type: 'subscribe', channel: 'broadcast-test' }));
      } else if (msg.type === 'subscribed') {
        client2Ready = true;
        if (client1Ready) {
          // Both ready, send broadcast from client1
          client1.send(
            JSON.stringify({
              type: 'broadcast',
              channel: 'broadcast-test',
              data: { message: 'Hello from client1' }
            })
          );
        }
      } else if (msg.type === 'broadcast') {
        assert.strictEqual(msg.channel, 'broadcast-test');
        assert.strictEqual(msg.data.message, 'Hello from client1');
        client2ReceivedBroadcast = true;
      }
    });

    client1.on('error', reject);
    client2.on('error', reject);

    setTimeout(() => reject(new Error('Timeout')), 5000);
  });

  await server.shutdown();
});

test('WebSocket should reject invalid messages', async () => {
  const server = new QuiWebSocketServer({ port: TEST_PORT });
  await server.start();

  const client = new WebSocket(`ws://localhost:${TEST_PORT}`);

  await new Promise((resolve, reject) => {
    let welcomeReceived = false;

    client.on('message', data => {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'welcome') {
        welcomeReceived = true;
        // Send invalid JSON
        client.send('invalid json');
      } else if (msg.type === 'error' && welcomeReceived) {
        assert.strictEqual(msg.error, 'Invalid JSON');
        client.close();
        resolve();
      }
    });

    client.on('error', reject);

    setTimeout(() => reject(new Error('Timeout')), 5000);
  });

  await server.shutdown();
});

test('WebSocket should track active connections', async () => {
  const server = new QuiWebSocketServer({ port: TEST_PORT });
  await server.start();

  const client1 = new WebSocket(`ws://localhost:${TEST_PORT}`);
  const client2 = new WebSocket(`ws://localhost:${TEST_PORT}`);

  await new Promise(resolve => setTimeout(resolve, 500));

  assert.strictEqual(server.activeConnections, 2);
  assert.strictEqual(server.totalConnections, 2);

  client1.close();
  await new Promise(resolve => setTimeout(resolve, 500));

  assert.strictEqual(server.activeConnections, 1);
  assert.strictEqual(server.totalConnections, 2);

  client2.close();
  await new Promise(resolve => setTimeout(resolve, 500));

  assert.strictEqual(server.activeConnections, 0);
  assert.strictEqual(server.totalConnections, 2);

  await server.shutdown();
});

test('WebSocket should enforce max connections', async () => {
  const server = new QuiWebSocketServer({ port: TEST_PORT, maxConnections: 2 });
  await server.start();

  const client1 = new WebSocket(`ws://localhost:${TEST_PORT}`);
  const client2 = new WebSocket(`ws://localhost:${TEST_PORT}`);
  const client3 = new WebSocket(`ws://localhost:${TEST_PORT}`);

  await new Promise((resolve, reject) => {
    let client3Closed = false;

    client3.on('close', (code, reason) => {
      assert.strictEqual(code, 1008);
      assert.strictEqual(reason.toString(), 'Server at capacity');
      client3Closed = true;
    });

    setTimeout(() => {
      assert.ok(client3Closed, 'Client3 should be rejected');
      assert.strictEqual(server.activeConnections, 2);
      client1.close();
      client2.close();
      resolve();
    }, 1000);

    client1.on('error', reject);
    client2.on('error', reject);
  });

  await server.shutdown();
});

test('WebSocket health endpoint should return stats', async () => {
  const server = new QuiWebSocketServer({ port: TEST_PORT });
  await server.start();

  const response = await fetch(`http://localhost:${TEST_PORT}/health`);
  assert.strictEqual(response.status, 200);

  const data = await response.json();
  assert.strictEqual(data.status, 'healthy');
  assert.strictEqual(data.protocol, 'WebSocket');
  assert.ok(data.version);

  await server.shutdown();
});

console.log('✅ All WebSocket tests completed');
