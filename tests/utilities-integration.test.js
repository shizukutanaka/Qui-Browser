/**
 * Integration tests for utility modules
 * Tests interaction between rate limiter, cache, monitoring, and logging
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const EndpointRateLimiter = require('../utils/endpoint-rate-limiter');
const SmartCache = require('../utils/smart-cache');
const AdvancedMonitoring = require('../utils/advanced-monitoring');
const RequestLogger = require('../utils/request-logger');

describe('Utilities Integration Tests', () => {
  let rateLimiter;
  let cache;
  let monitoring;
  let logger;

  beforeEach(() => {
    rateLimiter = new EndpointRateLimiter({
      defaultWindow: 60000,
      defaultMaxRequests: 100
    });

    cache = new SmartCache({
      maxSize: 100,
      strategy: 'lru',
      defaultTTL: 5000
    });

    monitoring = new AdvancedMonitoring();
    logger = new RequestLogger({ maxLogs: 100 });
  });

  afterEach(() => {
    if (rateLimiter) {
      rateLimiter.destroy();
    }
    if (cache) {
      cache.destroy();
    }
    if (monitoring) {
      monitoring.destroy();
    }
  });

  test('should coordinate rate limiting with monitoring', () => {
    const endpoint = '/api/test';
    const clientId = '127.0.0.1';

    // Start trace
    const traceId = monitoring.startTrace('api_request', {
      endpoint,
      clientId
    });

    // Check rate limit
    const result = rateLimiter.checkLimit(endpoint, clientId);

    // Record metric based on result
    if (result.allowed) {
      monitoring.incrementCounter('api_requests_allowed', 1);
      monitoring.setGauge('rate_limit_remaining', result.remaining);
    } else {
      monitoring.incrementCounter('api_requests_blocked', 1);
    }

    // End trace
    monitoring.endTrace(traceId);

    // Verify
    assert.strictEqual(result.allowed, true);
    assert.ok(result.remaining < 100);

    const metrics = monitoring.getMetrics();
    const traces = monitoring.getTraces();
    assert.ok(metrics.counters.api_requests_allowed >= 1);
    assert.ok(traces.length > 0);
  });

  test('should coordinate cache with monitoring', () => {
    const key = 'test-key';
    const value = 'test-value';

    // Start trace for cache operation
    const traceId = monitoring.startTrace('cache_operation', { key });

    // Cache miss
    let cachedValue = cache.get(key);
    if (!cachedValue) {
      monitoring.incrementCounter('cache_misses', 1);
      cache.set(key, value);
      cachedValue = value;
    } else {
      monitoring.incrementCounter('cache_hits', 1);
    }

    monitoring.endTrace(traceId);

    // Verify
    assert.strictEqual(cachedValue, value);
    assert.strictEqual(cache.get(key), value);

    const metrics = monitoring.getMetrics();
    assert.strictEqual(metrics.counters.cache_misses, 1);
  });

  test('should log rate limit decisions', () => {
    const endpoint = '/api/test';
    const clientId = '127.0.0.1';

    // Simulate multiple requests
    for (let i = 0; i < 5; i++) {
      const result = rateLimiter.checkLimit(endpoint, clientId);

      logger.addLog({
        method: 'GET',
        url: endpoint,
        ip: clientId,
        status: result.allowed ? 200 : 429,
        responseTime: Math.random() * 100,
        userAgent: 'test-agent',
        headers: {}
      });
    }

    // Verify logs
    const logs = logger.getLogs();
    assert.strictEqual(logs.length, 5);
    assert.ok(logs.every(log => log.url === endpoint));
    assert.ok(logs.every(log => log.ip === clientId));
  });

  test('should coordinate all utilities in API request flow', () => {
    const endpoint = '/api/users/profile';
    const clientId = '192.168.1.100';
    const cacheKey = `${endpoint}:${clientId}`;

    // 1. Start monitoring trace
    const traceId = monitoring.startTrace('api_request', {
      endpoint,
      clientId
    });

    // 2. Check rate limit
    const rateLimitResult = rateLimiter.checkLimit(endpoint, clientId);
    monitoring.incrementCounter('rate_limit_check', rateLimitResult.allowed ? 1 : 0);

    let responseData = null;
    let statusCode = 200;
    let responseTime = 0;

    if (!rateLimitResult.allowed) {
      // Rate limited
      statusCode = 429;
      responseData = { error: 'Too Many Requests' };
      monitoring.incrementCounter('requests_rate_limited', 1);
    } else {
      // 3. Check cache
      const startTime = Date.now();
      responseData = cache.get(cacheKey);

      if (responseData) {
        // Cache hit
        monitoring.incrementCounter('cache_hits', 1);
        monitoring.setGauge('cache_hit_rate', 1);
        responseTime = Date.now() - startTime;
      } else {
        // Cache miss - simulate API call
        monitoring.incrementCounter('cache_misses', 1);
        monitoring.setGauge('cache_hit_rate', 0);

        // Simulate processing
        responseData = { id: 1, name: 'Test User', email: 'test@example.com' };
        responseTime = Math.random() * 50 + 10;

        // Store in cache
        cache.set(cacheKey, responseData);
      }

      monitoring.incrementCounter('request_success', 1);
    }

    // 4. End trace
    monitoring.endTrace(traceId);

    // 5. Log request
    logger.addLog({
      method: 'GET',
      url: endpoint,
      ip: clientId,
      status: statusCode,
      responseTime,
      userAgent: 'integration-test',
      headers: {}
    });

    // 6. Verify complete flow
    assert.strictEqual(rateLimitResult.allowed, true);
    assert.ok(responseData);
    assert.strictEqual(statusCode, 200);

    const monitoringMetrics = monitoring.getMetrics();
    assert.ok(monitoringMetrics.counters.rate_limit_check >= 1);
    assert.ok(monitoringMetrics.counters.request_success >= 1);

    const logs = logger.getLogs();
    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].status, 200);
  });

  test('should handle rate limit with cache eviction', () => {
    // Fill cache to capacity
    for (let i = 0; i < 100; i++) {
      cache.set(`key${i}`, `value${i}`);
    }

    // Try to access endpoint multiple times
    const endpoint = '/api/cache-test';
    const clientId = '10.0.0.1';

    for (let i = 0; i < 50; i++) {
      const result = rateLimiter.checkLimit(endpoint, clientId);

      if (result.allowed) {
        // Try to cache response
        const cacheKey = `${endpoint}:request${i}`;
        cache.set(cacheKey, { data: `response${i}` });

        monitoring.incrementCounter('requests_processed', 1);
      }
    }

    // Verify cache size limit maintained
    assert.ok(cache.size() <= 100);

    // Verify monitoring tracked everything
    const monitoringMetrics = monitoring.getMetrics();
    assert.ok(monitoringMetrics.counters.requests_processed > 0);
  });

  test('should handle error scenarios across utilities', () => {
    const endpoint = '/api/error-test';
    const clientId = '172.16.0.1';

    // Start trace
    const traceId = monitoring.startTrace('error_scenario', {
      endpoint,
      clientId
    });

    try {
      // Check rate limit
      const result = rateLimiter.checkLimit(endpoint, clientId);

      if (!result.allowed) {
        throw new Error('Rate limit exceeded');
      }

      // Simulate error in processing
      throw new Error('Internal server error');
    } catch (error) {
      // Record error
      monitoring.incrementCounter('errors', 1);

      // Log error
      logger.addLog({
        method: 'GET',
        url: endpoint,
        ip: clientId,
        status: 500,
        responseTime: 10,
        userAgent: 'test-agent',
        headers: {},
        error: error.message
      });

      // End trace with error
      monitoring.endTrace(traceId, { error: error.message });
    }

    // Verify error handling
    const metrics = monitoring.getMetrics();
    assert.strictEqual(metrics.counters.errors, 1);

    const logs = logger.getLogs();
    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].status, 500);
    assert.ok(logs[0].error);
  });

  test('should support concurrent operations', () => {
    const operations = [];

    // Simulate 20 concurrent requests
    for (let i = 0; i < 20; i++) {
      operations.push(
        new Promise(resolve => {
          const endpoint = `/api/endpoint${i % 5}`;
          const clientId = `192.168.1.${i % 10}`;

          // Rate limit check
          const result = rateLimiter.checkLimit(endpoint, clientId);

          // Cache operation
          const cacheKey = `${endpoint}:${clientId}`;
          if (!cache.has(cacheKey)) {
            cache.set(cacheKey, { data: `response${i}` });
          }

          // Monitoring
          monitoring.incrementCounter('concurrent_requests', 1);

          // Logging
          logger.addLog({
            method: 'GET',
            url: endpoint,
            ip: clientId,
            status: result.allowed ? 200 : 429,
            responseTime: Math.random() * 50,
            userAgent: 'concurrent-test',
            headers: {}
          });

          resolve({ result, endpoint, clientId });
        })
      );
    }

    // Wait for all operations
    return Promise.all(operations).then(results => {
      // Verify all operations completed
      assert.strictEqual(results.length, 20);

      // Verify cache has entries
      assert.ok(cache.size() > 0);

      // Verify monitoring tracked all requests
      const monitoringMetrics = monitoring.getMetrics();
      assert.strictEqual(monitoringMetrics.counters.concurrent_requests, 20);

      // Verify logger captured all requests
      const logs = logger.getLogs();
      assert.strictEqual(logs.length, 20);
    });
  });

  test('should maintain performance under load', () => {
    const iterations = 1000;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      const endpoint = `/api/load-test/${i % 10}`;
      const clientId = `10.0.${Math.floor(i / 256)}.${i % 256}`;

      // Rate limit
      rateLimiter.checkLimit(endpoint, clientId);

      // Cache
      const cacheKey = `${endpoint}:${clientId}`;
      if (!cache.has(cacheKey)) {
        cache.set(cacheKey, { iteration: i });
      }

      // Monitoring (sample 10%)
      if (i % 10 === 0) {
        monitoring.incrementCounter('load_test_samples', 1);
      }

      // Logging (sample 10%)
      if (i % 10 === 0) {
        logger.addLog({
          method: 'GET',
          url: endpoint,
          ip: clientId,
          status: 200,
          responseTime: 5,
          userAgent: 'load-test',
          headers: {}
        });
      }
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Should complete in reasonable time (< 1 second for 1000 iterations)
    assert.ok(totalTime < 1000, `Performance too slow: ${totalTime}ms`);

    // Verify all utilities still functional
    assert.ok(cache.size() > 0);
    const monitoringMetrics = monitoring.getMetrics();
    assert.ok(monitoringMetrics.counters.load_test_samples > 0);
    assert.ok(logger.getLogs().length > 0);
  });
});
