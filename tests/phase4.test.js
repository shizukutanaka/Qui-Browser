/**
 * Phase 4 Improvements Tests
 *
 * Tests for:
 * - WebSocket Manager
 * - Memory Leak Detector
 * - Request Context Manager
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('events');

// Import Phase 4 utilities
const {
  WebSocketManager,
  WebSocketConnection,
  ConnectionState
} = require('../utils/websocket-manager');

const {
  MemoryLeakDetector,
  MemoryStats,
  EventListenerTracker,
  TimerTracker
} = require('../utils/memory-leak-detector');

const {
  RequestContext,
  RequestContextManager
} = require('../utils/request-context');

// ==================== WebSocket Manager Tests ====================

describe('WebSocket Manager', () => {
  it('should create WebSocket connection wrapper', () => {
    const mockWs = new EventEmitter();
    mockWs.ping = () => {};
    mockWs.send = () => {};
    mockWs.close = () => {};

    const connection = new WebSocketConnection(mockWs, { heartbeatInterval: 0 });

    assert.ok(connection);
    assert.ok(connection.id);
    assert.strictEqual(connection.state, ConnectionState.CONNECTED);
  });

  it('should track message statistics', () => {
    const mockWs = new EventEmitter();
    mockWs.ping = () => {};
    mockWs.send = () => {};
    mockWs.close = () => {};

    const connection = new WebSocketConnection(mockWs, { heartbeatInterval: 0 });

    // Simulate received message
    connection.handleMessage(Buffer.from('test message'));

    assert.strictEqual(connection.stats.messagesReceived, 1);
    assert.ok(connection.stats.bytesReceived > 0);
  });

  it('should handle pong response', () => {
    const mockWs = new EventEmitter();
    mockWs.ping = () => {};
    mockWs.send = () => {};
    mockWs.close = () => {};

    const connection = new WebSocketConnection(mockWs, { heartbeatInterval: 0 });

    let pongReceived = false;
    connection.on('pong', () => {
      pongReceived = true;
    });

    connection.lastPing = Date.now();
    connection.handlePong();

    assert.strictEqual(pongReceived, true);
    assert.ok(connection.lastPong >= connection.lastPing);
  });

  it('should queue messages when disconnected', () => {
    const mockWs = new EventEmitter();
    mockWs.ping = () => {};
    mockWs.send = () => {};
    mockWs.close = () => {};

    const connection = new WebSocketConnection(mockWs, {
      heartbeatInterval: 0,
      enableAutoReconnect: true
    });

    connection.state = ConnectionState.DISCONNECTED;

    let queued = false;
    connection.on('message:queued', () => {
      queued = true;
    });

    connection.send('test');

    assert.strictEqual(queued, true);
    assert.strictEqual(connection.messageQueue.length, 1);
  });

  it('should create WebSocket manager', () => {
    const manager = new WebSocketManager({ maxConnections: 10 });
    assert.ok(manager);
    assert.strictEqual(manager.config.maxConnections, 10);
  });

  it('should add connection to manager', () => {
    const manager = new WebSocketManager({ maxConnections: 10 });

    const mockWs = new EventEmitter();
    mockWs.ping = () => {};
    mockWs.send = () => {};
    mockWs.close = () => {};

    const connection = manager.addConnection(mockWs, { origin: 'test.com', userId: 'user123' });

    assert.ok(connection);
    assert.strictEqual(connection.origin, 'test.com');
    assert.strictEqual(connection.userId, 'user123');
    assert.strictEqual(manager.connections.size, 1);
  });

  it('should reject connection when limit reached', () => {
    const manager = new WebSocketManager({ maxConnections: 1 });

    const mockWs1 = new EventEmitter();
    mockWs1.ping = () => {};
    mockWs1.send = () => {};
    mockWs1.close = () => {};

    const mockWs2 = new EventEmitter();
    mockWs2.ping = () => {};
    mockWs2.send = () => {};
    let closed = false;
    mockWs2.close = () => { closed = true; };

    manager.addConnection(mockWs1, {});
    const connection2 = manager.addConnection(mockWs2, {});

    assert.strictEqual(connection2, null);
    assert.strictEqual(closed, true);
  });

  it('should get connections by user', () => {
    const manager = new WebSocketManager();

    const mockWs1 = new EventEmitter();
    mockWs1.ping = () => {};
    mockWs1.send = () => {};
    mockWs1.close = () => {};

    const mockWs2 = new EventEmitter();
    mockWs2.ping = () => {};
    mockWs2.send = () => {};
    mockWs2.close = () => {};

    manager.addConnection(mockWs1, { userId: 'user1' });
    manager.addConnection(mockWs2, { userId: 'user1' });

    const connections = manager.getConnectionsByUser('user1');
    assert.strictEqual(connections.length, 2);
  });

  it('should broadcast to all connections', () => {
    const manager = new WebSocketManager();

    let sent1 = false;
    let sent2 = false;

    const mockWs1 = new EventEmitter();
    mockWs1.ping = () => {};
    mockWs1.send = () => { sent1 = true; };
    mockWs1.close = () => {};

    const mockWs2 = new EventEmitter();
    mockWs2.ping = () => {};
    mockWs2.send = () => { sent2 = true; };
    mockWs2.close = () => {};

    manager.addConnection(mockWs1, {});
    manager.addConnection(mockWs2, {});

    const result = manager.broadcast('test message');

    assert.strictEqual(result.sent, 2);
    assert.strictEqual(sent1, true);
    assert.strictEqual(sent2, true);
  });
});

// ==================== Memory Leak Detector Tests ====================

describe('Memory Leak Detector', () => {
  it('should create memory stats', () => {
    const stats = new MemoryStats();
    stats.update();

    assert.ok(stats.heapUsed > 0);
    assert.ok(stats.heapTotal > 0);
    assert.ok(stats.rss > 0);
  });

  it('should calculate memory growth', () => {
    const stats1 = new MemoryStats();
    stats1.heapUsed = 1000000;

    const stats2 = new MemoryStats();
    stats2.heapUsed = 1500000;

    const growth = stats2.calculateGrowth(stats1);

    assert.strictEqual(growth.heapGrowth, 500000);
    assert.strictEqual(growth.growthRate, 0.5);
  });

  it('should track event listeners', () => {
    const tracker = new EventListenerTracker();
    const emitter = new EventEmitter();

    emitter.on('test', () => {});
    emitter.on('test', () => {});
    emitter.on('other', () => {});

    tracker.track(emitter, 'test-emitter');

    const stats = tracker.getStatistics();
    assert.strictEqual(stats.trackedEmitters, 1);
    assert.ok(stats.totalListeners >= 3);
  });

  it('should detect event listener leaks', () => {
    const tracker = new EventListenerTracker();
    const emitter = new EventEmitter();

    // Add many listeners
    for (let i = 0; i < 150; i++) {
      emitter.on('test', () => {});
    }

    tracker.track(emitter, 'leaky-emitter');
    const leaks = tracker.detectLeaks(100);

    assert.ok(leaks.length > 0);
    assert.ok(leaks[0].listenerCount > 100);
  });

  it('should track timers', () => {
    const tracker = new TimerTracker();

    const initialCount = tracker.timers.size;
    const timerId = setTimeout(() => {}, 1000);

    assert.strictEqual(tracker.timers.size, initialCount + 1);

    clearTimeout(timerId);
    assert.strictEqual(tracker.timers.size, initialCount);
  });

  it('should create memory leak detector', () => {
    const detector = new MemoryLeakDetector({
      checkInterval: 0,
      snapshotInterval: 0,
      enableHeapDumps: false
    });

    assert.ok(detector);
  });

  it('should take memory snapshot', () => {
    const detector = new MemoryLeakDetector({
      checkInterval: 0,
      snapshotInterval: 0,
      enableHeapDumps: false
    });

    const snapshot = detector.takeSnapshot();

    assert.ok(snapshot);
    assert.ok(snapshot.heapUsed > 0);
    assert.strictEqual(detector.memoryHistory.length, 1);
  });

  it('should detect heap growth leak', () => {
    const detector = new MemoryLeakDetector({
      checkInterval: 0,
      snapshotInterval: 0,
      heapGrowthThreshold: 0.1,
      leakDetectionSamples: 3,
      enableHeapDumps: false
    });

    // Create baseline snapshots
    for (let i = 0; i < 2; i++) {
      const stats = new MemoryStats();
      stats.heapUsed = 1000000;
      stats.timestamp = Date.now() - (2 - i) * 60000;
      detector.memoryHistory.push(stats);
    }

    // Create growth snapshot
    const growthStats = new MemoryStats();
    growthStats.heapUsed = 1500000; // 50% growth
    growthStats.timestamp = Date.now();
    detector.memoryHistory.push(growthStats);

    const leak = detector.detectHeapLeak();

    assert.ok(leak);
    assert.strictEqual(leak.type, 'heap_growth');
    assert.ok(leak.growthRate > 0.1);
  });

  it('should get detector statistics', () => {
    const detector = new MemoryLeakDetector({
      checkInterval: 0,
      snapshotInterval: 0,
      enableHeapDumps: false
    });

    detector.takeSnapshot();

    const stats = detector.getStatistics();

    assert.ok(stats.memory);
    assert.ok(stats.heap);
    assert.ok(stats.eventListeners);
    assert.ok(stats.timers);
  });
});

// ==================== Request Context Manager Tests ====================

describe('Request Context Manager', () => {
  it('should create request context', () => {
    const mockReq = {
      method: 'GET',
      url: '/api/users',
      path: '/api/users',
      headers: { 'user-agent': 'test' },
      ip: '127.0.0.1'
    };

    const context = new RequestContext(mockReq, {});

    assert.ok(context);
    assert.ok(context.requestId);
    assert.strictEqual(context.method, 'GET');
    assert.strictEqual(context.path, '/api/users');
  });

  it('should set and get metadata', () => {
    const mockReq = {
      method: 'GET',
      url: '/',
      headers: {},
      ip: '127.0.0.1'
    };

    const context = new RequestContext(mockReq, {});

    context.set('key1', 'value1');
    context.set('key2', { nested: 'value' });

    assert.strictEqual(context.get('key1'), 'value1');
    assert.deepStrictEqual(context.get('key2'), { nested: 'value' });
  });

  it('should track timing phases', () => {
    const mockReq = {
      method: 'GET',
      url: '/',
      headers: {},
      ip: '127.0.0.1'
    };

    const context = new RequestContext(mockReq, { enableTiming: true });

    context.startPhase('database');
    context.endPhase('database');

    assert.ok(context.timing.phases.database);
    assert.ok(context.timing.phases.database.duration !== null);
  });

  it('should create child span for tracing', () => {
    const mockReq = {
      method: 'GET',
      url: '/',
      headers: {},
      ip: '127.0.0.1'
    };

    const context = new RequestContext(mockReq, { enableTracing: true });
    context.setTraceId('trace123');

    const span = context.createSpan('database_query', { table: 'users' });
    span.setAttribute('rows', 5);
    span.end();

    assert.strictEqual(context.spans.length, 1);
    assert.strictEqual(context.spans[0].name, 'database_query');
    assert.strictEqual(context.spans[0].attributes.table, 'users');
    assert.ok(context.spans[0].duration !== null);
  });

  it('should complete request with timing', () => {
    const mockReq = {
      method: 'GET',
      url: '/',
      headers: {},
      ip: '127.0.0.1'
    };

    const context = new RequestContext(mockReq, {});

    context.complete(200);

    assert.strictEqual(context.statusCode, 200);
    assert.ok(context.timing.endTime !== null);
    assert.ok(context.timing.duration !== null);
  });

  it('should redact sensitive data', () => {
    const mockReq = {
      method: 'POST',
      url: '/api/login',
      headers: {},
      ip: '127.0.0.1'
    };

    const context = new RequestContext(mockReq, { redactSensitive: true });

    const data = {
      username: 'user',
      password: 'secret123',
      apiKey: 'key123'
    };

    const redacted = context.redact(data);

    assert.strictEqual(redacted.username, 'user');
    assert.strictEqual(redacted.password, '[REDACTED]');
    assert.strictEqual(redacted.apiKey, '[REDACTED]');
  });

  it('should create context manager', () => {
    const manager = new RequestContextManager();
    assert.ok(manager);
  });

  it('should create and store context', () => {
    const manager = new RequestContextManager();

    const mockReq = {
      method: 'GET',
      url: '/',
      headers: {},
      ip: '127.0.0.1'
    };

    const mockRes = {
      setHeader: () => {}
    };

    const context = manager.create(mockReq, mockRes);

    assert.ok(context);
    assert.strictEqual(manager.contexts.size, 1);
    assert.strictEqual(manager.getById(context.requestId), context);
  });

  it('should extract IDs from headers', () => {
    const manager = new RequestContextManager({
      generateRequestId: true,
      requestIdHeader: 'X-Request-ID',
      correlationIdHeader: 'X-Correlation-ID'
    });

    const mockReq = {
      method: 'GET',
      url: '/',
      headers: {
        'x-request-id': 'req123',
        'x-correlation-id': 'corr456'
      },
      ip: '127.0.0.1'
    };

    const mockRes = {
      setHeader: () => {}
    };

    const context = manager.create(mockReq, mockRes);

    assert.strictEqual(context.requestId, 'req123');
    assert.strictEqual(context.correlationId, 'corr456');
  });

  it('should cleanup old contexts', () => {
    const manager = new RequestContextManager();

    const mockReq = {
      method: 'GET',
      url: '/',
      headers: {},
      ip: '127.0.0.1'
    };

    const mockRes = {
      setHeader: () => {}
    };

    const context = manager.create(mockReq, mockRes);

    // Manually set old timestamp
    context.timing.startTime = Date.now() - 7200000; // 2 hours ago

    const removed = manager.cleanup(3600000); // 1 hour max age

    assert.strictEqual(removed, 1);
    assert.strictEqual(manager.contexts.size, 0);
  });

  it('should get manager statistics', () => {
    const manager = new RequestContextManager();

    const mockReq = {
      method: 'GET',
      url: '/',
      headers: {},
      ip: '127.0.0.1'
    };

    const mockRes = {
      setHeader: () => {}
    };

    const context = manager.create(mockReq, mockRes);
    context.complete(200);

    const stats = manager.getStatistics();

    assert.ok(stats);
    assert.ok(stats.activeContexts >= 0);
    assert.ok(stats.completedRequests >= 0);
  });
});

console.log('All Phase 4 tests completed!');
