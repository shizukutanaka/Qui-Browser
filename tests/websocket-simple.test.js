/**
 * WebSocketサーバー簡易テスト
 *
 * 基本機能の検証
 */

const assert = require('assert');
const { test } = require('node:test');
const QuiWebSocketServer = require('../server-websocket');

test('WebSocket server can be instantiated', () => {
  const server = new QuiWebSocketServer({ port: 19000 });
  assert.ok(server);
  assert.strictEqual(server.port, 19000);
  assert.strictEqual(server.activeConnections, 0);
  assert.strictEqual(server.totalConnections, 0);
});

test('WebSocket server validates messages correctly', () => {
  const server = new QuiWebSocketServer({ port: 19001 });

  // Valid message
  const valid1 = server.validateMessage('{"type":"ping"}');
  assert.strictEqual(valid1.valid, true);
  assert.strictEqual(valid1.data.type, 'ping');

  // Valid subscribe message
  const valid2 = server.validateMessage('{"type":"subscribe","channel":"test"}');
  assert.strictEqual(valid2.valid, true);
  assert.strictEqual(valid2.data.type, 'subscribe');
  assert.strictEqual(valid2.data.channel, 'test');

  // Invalid JSON
  const invalid1 = server.validateMessage('not json');
  assert.strictEqual(invalid1.valid, false);
  assert.strictEqual(invalid1.error, 'Invalid JSON');

  // Missing type
  const invalid2 = server.validateMessage('{"data":"test"}');
  assert.strictEqual(invalid2.valid, false);
  assert.strictEqual(invalid2.error, 'Invalid message type');

  // Unknown type
  const invalid3 = server.validateMessage('{"type":"unknown"}');
  assert.strictEqual(invalid3.valid, false);
  assert.strictEqual(invalid3.error, 'Unknown message type');
});

test('WebSocket server rate limit works', () => {
  const server = new QuiWebSocketServer({
    port: 19002,
    rateLimitMax: 3,
    rateLimitWindow: 60000
  });

  const clientIP = '127.0.0.1';

  // First 3 requests should pass
  assert.strictEqual(server.checkRateLimit(clientIP), true);
  assert.strictEqual(server.checkRateLimit(clientIP), true);
  assert.strictEqual(server.checkRateLimit(clientIP), true);

  // 4th request should be blocked
  assert.strictEqual(server.checkRateLimit(clientIP), false);
  assert.strictEqual(server.checkRateLimit(clientIP), false);
});

test('WebSocket server generates unique client IDs', () => {
  const server = new QuiWebSocketServer({ port: 19003 });

  const id1 = server.generateClientId();
  const id2 = server.generateClientId();
  const id3 = server.generateClientId();

  assert.ok(id1);
  assert.ok(id2);
  assert.ok(id3);
  assert.notStrictEqual(id1, id2);
  assert.notStrictEqual(id2, id3);
  assert.notStrictEqual(id1, id3);

  // UUID v4 format check
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.ok(uuidPattern.test(id1));
  assert.ok(uuidPattern.test(id2));
  assert.ok(uuidPattern.test(id3));
});

test('WebSocket server channel management works', () => {
  const server = new QuiWebSocketServer({ port: 19004 });

  const clientId1 = 'client-1';
  const clientId2 = 'client-2';
  const channelName = 'test-channel';

  // Subscribe clients
  server.subscribe(clientId1, channelName);
  server.subscribe(clientId2, channelName);

  assert.ok(server.channels.has(channelName));
  assert.strictEqual(server.channels.get(channelName).size, 2);

  // Unsubscribe one client
  server.unsubscribe(clientId1, channelName);
  assert.strictEqual(server.channels.get(channelName).size, 1);

  // Unsubscribe last client (channel should be removed)
  server.unsubscribe(clientId2, channelName);
  assert.strictEqual(server.channels.has(channelName), false);
});

test('WebSocket server stats are tracked', () => {
  const server = new QuiWebSocketServer({ port: 19005 });

  const stats = server.getStats();
  assert.strictEqual(stats.totalConnections, 0);
  assert.strictEqual(stats.activeConnections, 0);
  assert.strictEqual(stats.messagesReceived, 0);
  assert.strictEqual(stats.messagesSent, 0);
  assert.strictEqual(stats.errors, 0);
  assert.strictEqual(stats.channels, 0);
  assert.ok(stats.version);
});

console.log('✅ All WebSocket simple tests completed');
