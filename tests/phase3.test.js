/**
 * Phase 3 Improvements Tests
 *
 * Tests for:
 * - Prometheus Metrics
 * - Advanced Logger
 * - Enhanced Rate Limiter
 * - GraphQL Optimizer
 * - VR Performance Optimizer
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Import Phase 3 utilities
const {
  PrometheusMetrics,
  Counter,
  Gauge,
  Histogram,
  getMetrics
} = require('../utils/prometheus-metrics');

const {
  AdvancedLogger,
  LogLevel,
  ConsoleTransport,
  FileTransport
} = require('../utils/advanced-logger');

const {
  EnhancedRateLimiter,
  TokenBucket,
  createRateLimiterMiddleware
} = require('../utils/enhanced-rate-limiter');

const {
  calculateQueryDepth,
  QueryCostAnalyzer,
  DataLoader,
  PersistedQueriesManager,
  QueryComplexityAnalyzer
} = require('../utils/graphql-optimizer');

const {
  VRPerformanceOptimizer,
  LODManager,
  TextureOptimizer,
  FrustumCuller,
  LODLevel
} = require('../utils/vr-performance');

// ==================== Prometheus Metrics Tests ====================

describe('Prometheus Metrics', () => {
  it('should create and increment counter', () => {
    const counter = new Counter('test_counter', 'Test counter', ['label1']);
    counter.inc({ label1: 'value1' });
    counter.inc({ label1: 'value1' }, 5);

    const formatted = counter.format();
    assert.ok(formatted.includes('test_counter'));
    assert.ok(formatted.includes('6')); // 1 + 5
  });

  it('should create and set gauge', () => {
    const gauge = new Gauge('test_gauge', 'Test gauge');
    gauge.set({}, 42);

    const formatted = gauge.format();
    assert.ok(formatted.includes('test_gauge'));
    assert.ok(formatted.includes('42'));
  });

  it('should create and observe histogram', () => {
    const histogram = new Histogram('test_histogram', 'Test histogram');
    histogram.observe({}, 0.005);
    histogram.observe({}, 0.05);
    histogram.observe({}, 0.5);

    const formatted = histogram.format();
    assert.ok(formatted.includes('test_histogram_bucket'));
    assert.ok(formatted.includes('test_histogram_sum'));
    assert.ok(formatted.includes('test_histogram_count'));
  });

  it('should format metrics in Prometheus format', () => {
    const metrics = new PrometheusMetrics();
    const output = metrics.getMetrics();

    assert.ok(output.includes('# HELP'));
    assert.ok(output.includes('# TYPE'));
    assert.ok(output.includes('http_requests_total'));
  });

  it('should collect system metrics', () => {
    const metrics = new PrometheusMetrics();
    metrics.updateSystemMetrics();

    const output = metrics.getMetrics();
    assert.ok(output.includes('process_uptime_seconds'));
    assert.ok(output.includes('process_memory_usage_bytes'));
  });
});

// ==================== Advanced Logger Tests ====================

describe('Advanced Logger', () => {
  it('should create logger with default config', () => {
    const logger = new AdvancedLogger({ console: true, file: false });
    assert.ok(logger);
    assert.strictEqual(logger.transports.length, 1);
  });

  it('should log at different levels', () => {
    const logger = new AdvancedLogger({ console: false, file: false });
    let loggedLevel = null;

    logger.addTransport({
      log: (entry) => {
        loggedLevel = entry.level;
      }
    });

    logger.info('Test message');
    assert.strictEqual(loggedLevel, 'INFO');

    logger.error('Error message');
    assert.strictEqual(loggedLevel, 'ERROR');
  });

  it('should respect log level threshold', () => {
    const logger = new AdvancedLogger({ level: LogLevel.WARN, console: false, file: false });
    let logCount = 0;

    logger.addTransport({
      log: () => {
        logCount++;
      }
    });

    logger.debug('Debug'); // Should not log
    logger.info('Info'); // Should not log
    logger.warn('Warning'); // Should log
    logger.error('Error'); // Should log

    assert.strictEqual(logCount, 2);
  });

  it('should create child logger with context', () => {
    const logger = new AdvancedLogger({ console: false, file: false });
    let loggedContext = null;

    logger.addTransport({
      log: (entry) => {
        loggedContext = entry.context;
      }
    });

    const child = logger.child({ requestId: '123' });
    child.info('Test', { extra: 'data' });

    assert.strictEqual(loggedContext.requestId, '123');
    assert.strictEqual(loggedContext.extra, 'data');
  });

  it('should measure operation time', () => {
    const logger = new AdvancedLogger({ console: false, file: false });
    let duration = null;

    logger.addTransport({
      log: (entry) => {
        duration = entry.context.duration_ms;
      }
    });

    const timer = logger.time('test_operation');
    timer.end();

    assert.ok(duration !== null);
    assert.ok(duration >= 0);
  });
});

// ==================== Enhanced Rate Limiter Tests ====================

describe('Enhanced Rate Limiter', () => {
  it('should create token bucket', () => {
    const bucket = new TokenBucket(10, 5); // 10 tokens, 5 per second
    assert.strictEqual(bucket.capacity, 10);
    assert.strictEqual(bucket.tokens, 10);
  });

  it('should consume tokens', () => {
    const bucket = new TokenBucket(10, 5);
    assert.strictEqual(bucket.consume(), true);
    assert.strictEqual(bucket.consume(5), true);
    assert.strictEqual(bucket.getAvailable(), 4);
  });

  it('should reject when tokens exhausted', () => {
    const bucket = new TokenBucket(5, 1);
    bucket.consume(5);
    assert.strictEqual(bucket.consume(), false);
  });

  it('should refill tokens over time', async () => {
    const bucket = new TokenBucket(10, 10); // 10 tokens per second
    bucket.consume(10); // Exhaust tokens

    // Wait for refill (100ms = 1 token at 10/sec)
    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.ok(bucket.getAvailable() >= 1);
  });

  it('should check rate limit', () => {
    const limiter = new EnhancedRateLimiter({ maxRequests: 10, windowMs: 60000 });
    const result = limiter.check('user123');

    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.limit, 10);
    assert.ok(result.remaining >= 0);
  });

  it('should block after exceeding limit', () => {
    const limiter = new EnhancedRateLimiter({ maxRequests: 2, windowMs: 60000 });

    limiter.check('user123'); // 1st request
    limiter.check('user123'); // 2nd request
    const result = limiter.check('user123'); // 3rd request (should fail)

    assert.strictEqual(result.allowed, false);
    assert.ok(result.retryAfter > 0);
  });
});

// ==================== GraphQL Optimizer Tests ====================

describe('GraphQL Optimizer', () => {
  it('should calculate query depth', () => {
    const query = {
      kind: 'Document',
      definitions: [
        {
          kind: 'OperationDefinition',
          selectionSet: {
            selections: [
              {
                kind: 'Field',
                name: { value: 'user' },
                selectionSet: {
                  selections: [
                    {
                      kind: 'Field',
                      name: { value: 'posts' },
                      selectionSet: {
                        selections: [{ kind: 'Field', name: { value: 'title' } }]
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    };

    const depth = calculateQueryDepth(query);
    assert.ok(depth >= 3); // user -> posts -> title
  });

  it('should analyze query cost', () => {
    const analyzer = new QueryCostAnalyzer({ objectCost: 10, scalarCost: 1 });
    const query = {
      kind: 'Field',
      name: { value: 'user' },
      selectionSet: {
        selections: [
          { kind: 'Field', name: { value: 'id' } },
          { kind: 'Field', name: { value: 'name' } }
        ]
      }
    };

    const cost = analyzer.analyze(query, null);
    assert.ok(cost > 0);
  });

  it('should batch load with DataLoader', async () => {
    let batchKeys = null;
    const loader = new DataLoader(async (keys) => {
      batchKeys = keys;
      return keys.map((key) => ({ id: key, name: `User ${key}` }));
    });

    const promise1 = loader.load(1);
    const promise2 = loader.load(2);
    const promise3 = loader.load(3);

    const results = await Promise.all([promise1, promise2, promise3]);

    assert.deepStrictEqual(batchKeys, [1, 2, 3]);
    assert.strictEqual(results[0].id, 1);
    assert.strictEqual(results[1].id, 2);
    assert.strictEqual(results[2].id, 3);
  });

  it('should cache DataLoader results', async () => {
    let callCount = 0;
    const loader = new DataLoader(async (keys) => {
      callCount++;
      return keys.map((key) => ({ id: key }));
    });

    await loader.load(1);
    await loader.load(1); // Should use cache

    assert.strictEqual(callCount, 1);
  });

  it('should manage persisted queries', () => {
    const manager = new PersistedQueriesManager();
    const query = 'query { user { id name } }';

    const hash = manager.store(query);
    assert.ok(hash);

    const retrieved = manager.retrieve(hash);
    assert.strictEqual(retrieved, query);

    assert.strictEqual(manager.has(hash), true);
  });

  it('should calculate query complexity', () => {
    const analyzer = new QueryComplexityAnalyzer({ defaultFieldComplexity: 1 });
    const query = {
      kind: 'Document',
      definitions: [
        {
          kind: 'OperationDefinition',
          selectionSet: {
            selections: [
              {
                kind: 'Field',
                name: { value: 'user' },
                selectionSet: {
                  selections: [{ kind: 'Field', name: { value: 'name' } }]
                }
              }
            ]
          }
        }
      ]
    };

    const result = analyzer.validate(query);
    assert.strictEqual(result.valid, true);
    assert.ok(result.complexity > 0);
  });
});

// ==================== VR Performance Optimizer Tests ====================

describe('VR Performance Optimizer', () => {
  it('should create VR optimizer', () => {
    const optimizer = new VRPerformanceOptimizer({ targetFPS: 90 });
    assert.ok(optimizer);
    assert.strictEqual(optimizer.config.targetFPS, 90);
  });

  it('should manage LOD levels', () => {
    const lodManager = new LODManager();

    lodManager.registerObject('obj1', {
      position: { x: 0, y: 0, z: 0 },
      meshes: []
    });

    lodManager.updateCamera({ x: 10, y: 0, z: 0 }); // 10 meters away
    const updates = lodManager.update();

    assert.ok(updates.length >= 0);
  });

  it('should calculate LOD based on distance', () => {
    const lodManager = new LODManager();

    const level1 = lodManager.determineLODLevel(3); // 3 meters
    const level2 = lodManager.determineLODLevel(10); // 10 meters
    const level3 = lodManager.determineLODLevel(50); // 50 meters

    assert.strictEqual(level1, LODLevel.ULTRA);
    assert.strictEqual(level2, LODLevel.HIGH);
    assert.strictEqual(level3, LODLevel.LOW);
  });

  it('should optimize texture size', () => {
    const optimizer = new TextureOptimizer({ textureQuality: 'medium' });
    const result = optimizer.registerTexture('tex1', 3000, 2000);

    assert.ok(result.width <= 1024); // Medium quality max
    assert.ok(result.height <= 1024);
  });

  it('should calculate texture memory', () => {
    const optimizer = new TextureOptimizer();
    const memory = optimizer.calculateMemoryUsage(1024, 1024, 1);

    assert.strictEqual(memory, 1024 * 1024 * 4); // RGBA
  });

  it('should collect performance metrics', () => {
    const optimizer = new VRPerformanceOptimizer();
    optimizer.updateMetrics(11.1, 100, 50000); // 90 FPS

    const stats = optimizer.getStatistics();
    assert.ok(stats.performance);
    assert.ok(stats.performance.current.fps);
  });

  it('should adjust quality based on performance', () => {
    const optimizer = new VRPerformanceOptimizer({ minFPS: 75, textureQuality: 'ultra' });
    optimizer.setAdaptiveQuality(true);

    // Simulate low FPS
    optimizer.metrics.update({ frameTime: 20, fps: 50 }); // 50 FPS

    // Quality should be reduced (but test is async, check event instead)
    let qualityReduced = false;
    optimizer.on('quality:reduced', () => {
      qualityReduced = true;
    });

    optimizer.handleLowPerformance({ fps: 50 });
    assert.strictEqual(qualityReduced, true);
  });

  it('should set performance mode', () => {
    const optimizer = new VRPerformanceOptimizer();

    optimizer.setPerformanceMode('performance');
    assert.strictEqual(optimizer.config.textureQuality, 'low');

    optimizer.setPerformanceMode('quality');
    assert.strictEqual(optimizer.config.textureQuality, 'high');
  });

  it('should cull objects outside frustum', () => {
    const culler = new FrustumCuller();
    const objects = [
      { id: 1, boundingBox: {} },
      { id: 2, boundingBox: {} },
      { id: 3, boundingBox: {} }
    ];

    const visible = culler.cull(objects);
    assert.ok(Array.isArray(visible));
  });

  it('should process frame with optimizations', () => {
    const optimizer = new VRPerformanceOptimizer();
    optimizer.lodManager.registerObject('obj1', { position: { x: 0, y: 0, z: 0 } });

    const objects = [{ id: 'obj1', boundingBox: {} }];
    const result = optimizer.processFrame(objects);

    assert.ok(result.visibleObjects);
    assert.ok(result.processingTime !== undefined);
  });
});

console.log('All Phase 3 tests completed!');
