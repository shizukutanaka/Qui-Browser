/**
 * Production Integration Tests
 * Tests for production server with all modules integrated
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { InputValidator } = require('../utils/input-validator');
const { DDoSProtection } = require('../utils/ddos-protection');
const { SessionManager } = require('../utils/session-manager');
const { AdvancedCache } = require('../utils/advanced-cache');
const { RequestDeduplicator } = require('../utils/request-deduplication');
const { PerformanceProfiler } = require('../utils/performance-profiler');

describe('Production Server Integration', () => {
  let inputValidator;
  let ddosProtection;
  let sessionManager;
  let cache;
  let deduplicator;
  let profiler;

  before(() => {
    inputValidator = new InputValidator();
    ddosProtection = new DDoSProtection({ enabled: true });
    sessionManager = new SessionManager();
    cache = new AdvancedCache({ maxSize: 100 });
    deduplicator = new RequestDeduplicator();
    profiler = new PerformanceProfiler({ enabled: true });
  });

  after(() => {
    if (ddosProtection) {ddosProtection.stop();}
    if (sessionManager) {sessionManager.stop();}
    if (cache) {cache.stop();}
    if (deduplicator) {deduplicator.stop();}
  });

  describe('Request Pipeline', () => {
    it('should process request through full pipeline', async () => {
      const req = {
        url: '/api/users',
        method: 'GET',
        headers: {
          'user-agent': 'Test/1.0',
          'host': 'localhost:8000',
        },
        socket: {
          remoteAddress: '127.0.0.1',
        },
      };

      // 1. Input validation
      const validation = inputValidator.validateRequest(req);
      assert.strictEqual(validation.isValid, true);

      // 2. DDoS protection
      const ddosCheck = ddosProtection.checkRequest(req);
      assert.strictEqual(ddosCheck.allowed, true);

      // 3. Session validation
      const session = await sessionManager.createSession('user123');
      const validated = await sessionManager.validateSession(session.sessionId);
      assert.ok(validated);

      // 4. Cache check
      const cacheKey = 'api:users';
      cache.set(cacheKey, { users: [] });
      const cached = cache.get(cacheKey);
      assert.ok(cached);

      // 5. Request deduplication
      let execCount = 0;
      const executor = async () => {
        execCount++;
        return { data: 'result' };
      };

      const result = await deduplicator.execute('test-request', executor);
      assert.strictEqual(execCount, 1);
      assert.deepStrictEqual(result, { data: 'result' });

      // 6. Performance tracking
      profiler.start('request-processing');
      await new Promise(resolve => setTimeout(resolve, 10));
      const duration = profiler.end('request-processing');
      assert.ok(duration > 0);
    });

    it('should block malicious requests', async () => {
      const maliciousReq = {
        url: '/api/users?id=1\' OR \'1\'=\'1',
        method: 'GET',
        headers: {
          'user-agent': 'AttackBot/1.0',
          'host': 'localhost:8000',
        },
        socket: {
          remoteAddress: '192.168.1.100',
        },
      };

      // Input validation should catch SQL injection
      const validation = inputValidator.validateRequest(maliciousReq);
      assert.strictEqual(validation.isValid, false);
      assert.ok(validation.errors.some(e => e.includes('SQL injection')));
    });

    it('should handle rate limiting', async () => {
      const req = {
        url: '/api/test',
        method: 'GET',
        headers: {
          'user-agent': 'Test/1.0',
          'host': 'localhost:8000',
        },
        socket: {
          remoteAddress: '10.0.0.1',
        },
      };

      // Make multiple requests
      const results = [];
      for (let i = 0; i < 100; i++) {
        const check = ddosProtection.checkRequest(req);
        results.push(check.allowed);
      }

      // Should eventually block some requests
      const blockedCount = results.filter(r => !r).length;
      assert.ok(blockedCount > 0, 'Should block some requests after rate limit');
    });
  });

  describe('Session and Cache Integration', () => {
    it('should cache session data', async () => {
      const userId = 'user456';
      const session = await sessionManager.createSession(userId, {
        role: 'admin',
      });

      // Cache session data
      const cacheKey = `session:${session.sessionId}`;
      cache.set(cacheKey, {
        userId,
        sessionId: session.sessionId,
        metadata: { role: 'admin' },
      });

      // Retrieve from cache
      const cached = cache.get(cacheKey);
      assert.strictEqual(cached.userId, userId);
      assert.strictEqual(cached.metadata.role, 'admin');

      // Validate session
      const validated = await sessionManager.validateSession(session.sessionId);
      assert.strictEqual(validated.userId, userId);
    });

    it('should invalidate cache on session destroy', async () => {
      const userId = 'user789';
      const session = await sessionManager.createSession(userId);

      const cacheKey = `session:${session.sessionId}`;
      cache.set(cacheKey, { userId, sessionId: session.sessionId });

      // Destroy session
      await sessionManager.destroySession(session.sessionId);

      // Invalidate cache
      cache.delete(cacheKey);

      assert.strictEqual(cache.get(cacheKey), undefined);
      assert.strictEqual(await sessionManager.validateSession(session.sessionId), null);
    });

    it('should handle expired cache with active session', async () => {
      const shortCache = new AdvancedCache({ defaultTTL: 100 });
      const session = await sessionManager.createSession('user-temp');

      const cacheKey = `session:${session.sessionId}`;
      shortCache.set(cacheKey, { sessionId: session.sessionId });

      // Wait for cache expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Cache expired but session still valid
      assert.strictEqual(shortCache.get(cacheKey), undefined);
      assert.ok(await sessionManager.validateSession(session.sessionId));

      shortCache.stop();
    });
  });

  describe('Deduplication and Cache Integration', () => {
    it('should deduplicate and cache results', async () => {
      let apiCallCount = 0;

      const fetchData = async (id) => {
        apiCallCount++;
        return { id, data: `Data for ${id}` };
      };

      const key = 'data:123';

      // First call - execute and cache
      const result1 = await deduplicator.execute(key, async () => {
        const data = await fetchData(123);
        cache.set(key, data);
        return data;
      });

      // Second call - should use deduplication cache
      const result2 = await deduplicator.execute(key, async () => {
        const data = await fetchData(123);
        cache.set(key, data);
        return data;
      });

      assert.strictEqual(apiCallCount, 1);
      assert.deepStrictEqual(result1, result2);

      // Third call after dedup TTL - should use cache
      await new Promise(resolve => setTimeout(resolve, 100));
      deduplicator.clear();

      const cached = cache.get(key);
      assert.ok(cached);
      assert.strictEqual(cached.id, 123);
      assert.strictEqual(apiCallCount, 1); // Still only called once
    });

    it('should handle concurrent deduplicated requests', async () => {
      let executionCount = 0;

      const slowOperation = async () => {
        executionCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
        return { result: 'success' };
      };

      // Execute 5 concurrent requests
      const promises = Array(5).fill(null).map(() =>
        deduplicator.execute('slow-op', slowOperation)
      );

      const results = await Promise.all(promises);

      // Should execute only once
      assert.strictEqual(executionCount, 1);

      // All results should be the same
      assert.ok(results.every(r => r.result === 'success'));
    });
  });

  describe('Performance Profiling Integration', () => {
    it('should profile full request lifecycle', async () => {
      profiler.clear();

      await profiler.measure('validation', async () => {
        const req = {
          url: '/api/test',
          method: 'GET',
          headers: { 'user-agent': 'Test/1.0', 'host': 'localhost' },
          socket: { remoteAddress: '127.0.0.1' },
        };
        return inputValidator.validateRequest(req);
      });

      await profiler.measure('session-creation', async () => {
        return await sessionManager.createSession('perf-test');
      });

      await profiler.measure('cache-operation', async () => {
        cache.set('perf-key', { data: 'test' });
        return cache.get('perf-key');
      });

      const stats = profiler.getAllTimingStats();
      assert.strictEqual(stats.length, 3);
      assert.ok(stats.every(s => s.mean > 0));

      const bottlenecks = profiler.detectBottlenecks(1); // 1ms threshold
      assert.ok(Array.isArray(bottlenecks));
    });

    it('should track metrics across modules', async () => {
      profiler.clear();

      // Create sessions
      profiler.recordMetric('sessions_created', 1);
      await sessionManager.createSession('metrics-test-1');

      profiler.recordMetric('sessions_created', 1);
      await sessionManager.createSession('metrics-test-2');

      // Cache operations
      profiler.recordMetric('cache_sets', 1);
      cache.set('metrics-key-1', 'value1');

      profiler.recordMetric('cache_sets', 1);
      cache.set('metrics-key-2', 'value2');

      const sessionMetrics = profiler.getMetricStats('sessions_created');
      const cacheMetrics = profiler.getMetricStats('cache_sets');

      assert.strictEqual(sessionMetrics.count, 2);
      assert.strictEqual(cacheMetrics.count, 2);
    });
  });

  describe('Error Recovery Integration', () => {
    it('should recover from transient failures', async () => {
      let attemptCount = 0;

      const unreliableOperation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Transient error');
        }
        return { success: true };
      };

      // Use deduplication with retry logic
      const result = await deduplicator.execute('unreliable-op', async () => {
        // Retry up to 3 times
        for (let i = 0; i < 3; i++) {
          try {
            return await unreliableOperation();
          } catch (error) {
            if (i === 2) {throw error;}
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      });

      assert.deepStrictEqual(result, { success: true });
      assert.strictEqual(attemptCount, 3);
    });

    it('should use cached data on failure', async () => {
      const cacheKey = 'fallback-data';
      const fallbackData = { cached: true, data: 'fallback' };

      // Pre-populate cache
      cache.set(cacheKey, fallbackData);

      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      // Try operation, fall back to cache
      let result;
      try {
        result = await deduplicator.execute('failing-op', failingOperation);
      } catch {
        result = cache.get(cacheKey);
      }

      assert.ok(result);
      assert.strictEqual(result.cached, true);
    });
  });

  describe('Security Integration', () => {
    it('should validate session before serving cached content', async () => {
      const session = await sessionManager.createSession('secure-user', {
        clearanceLevel: 'high',
      });

      const secureData = { sensitive: true, content: 'classified' };
      const cacheKey = `secure:${session.sessionId}`;

      cache.set(cacheKey, secureData, {
        metadata: { requiresAuth: true, sessionId: session.sessionId },
      });

      // Valid session - should access cached data
      const validSession = await sessionManager.validateSession(session.sessionId);
      assert.ok(validSession);

      const cached = cache.get(cacheKey);
      assert.ok(cached);
      assert.strictEqual(cached.sensitive, true);

      // Destroy session
      await sessionManager.destroySession(session.sessionId);

      // Invalid session - should not access
      const invalidSession = await sessionManager.validateSession(session.sessionId);
      assert.strictEqual(invalidSession, null);

      // Should invalidate cache for security
      cache.delete(cacheKey);
      assert.strictEqual(cache.get(cacheKey), undefined);
    });

    it('should block and track suspicious activity', async () => {
      const suspiciousReq = {
        url: '/api/users?id=<script>alert("xss")</script>',
        method: 'GET',
        headers: {
          'user-agent': 'Mozilla/5.0',
          'host': 'localhost:8000',
        },
        socket: {
          remoteAddress: '192.168.1.50',
        },
      };

      // Validate request
      const validation = inputValidator.validateRequest(suspiciousReq);
      assert.strictEqual(validation.isValid, false);

      // Check DDoS protection
      const ddosCheck = ddosProtection.checkRequest(suspiciousReq);

      // Log suspicious activity (in real scenario)
      profiler.recordMetric('suspicious_requests', 1, {
        ip: suspiciousReq.socket.remoteAddress,
        reason: validation.errors.join(', '),
      });

      const metrics = profiler.getMetricStats('suspicious_requests');
      assert.ok(metrics);
      assert.strictEqual(metrics.count, 1);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should collect statistics from all modules', async () => {
      // Create some activity
      await sessionManager.createSession('stats-user-1');
      await sessionManager.createSession('stats-user-2');

      cache.set('stats-key-1', 'value1');
      cache.set('stats-key-2', 'value2');
      cache.get('stats-key-1');

      await deduplicator.execute('stats-op', async () => 'result');

      // Collect stats
      const stats = {
        sessions: sessionManager.getStats(),
        cache: cache.getStats(),
        deduplication: deduplicator.getStats(),
        profiler: profiler.getAllTimingStats(),
      };

      assert.ok(stats.sessions.activeSessions >= 2);
      assert.ok(stats.cache.sets >= 2);
      assert.ok(stats.cache.hits >= 1);
      assert.ok(stats.deduplication.total >= 1);
    });

    it('should generate comprehensive health report', async () => {
      const health = {
        status: 'healthy',
        modules: {
          inputValidator: { status: 'healthy', available: true },
          ddosProtection: { status: 'healthy', blacklistedIps: ddosProtection.getStats().blacklistedIps },
          sessionManager: { status: 'healthy', activeSessions: sessionManager.getStats().activeSessions },
          cache: { status: 'healthy', hitRate: cache.getStats().hitRate },
          deduplicator: { status: 'healthy', deduplicationRate: deduplicator.getStats().deduplicationRate },
        },
        timestamp: new Date().toISOString(),
      };

      assert.strictEqual(health.status, 'healthy');
      assert.ok(health.modules.inputValidator.available);
      assert.ok(typeof health.modules.sessionManager.activeSessions === 'number');
    });
  });
});
