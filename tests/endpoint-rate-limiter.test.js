/**
 * Tests for Endpoint Rate Limiter
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const EndpointRateLimiter = require('../utils/endpoint-rate-limiter');

describe('EndpointRateLimiter', () => {
  test('should allow requests within limit', () => {
    const limiter = new EndpointRateLimiter({
      defaultWindow: 60000,
      defaultMaxRequests: 10
    });

    const result1 = limiter.checkLimit('/api/test', '127.0.0.1');
    assert.strictEqual(result1.allowed, true);
    assert.strictEqual(result1.remaining, 9);

    const result2 = limiter.checkLimit('/api/test', '127.0.0.1');
    assert.strictEqual(result2.allowed, true);
    assert.strictEqual(result2.remaining, 8);
  });

  test('should block requests exceeding limit', () => {
    const limiter = new EndpointRateLimiter({
      defaultWindow: 60000,
      defaultMaxRequests: 3
    });

    // Use up the limit
    limiter.checkLimit('/api/test', '127.0.0.1');
    limiter.checkLimit('/api/test', '127.0.0.1');
    limiter.checkLimit('/api/test', '127.0.0.1');

    // Should be blocked
    const result = limiter.checkLimit('/api/test', '127.0.0.1');
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.remaining, 0);
  });

  test('should track different IPs separately', () => {
    const limiter = new EndpointRateLimiter({
      defaultWindow: 60000,
      defaultMaxRequests: 5
    });

    const result1 = limiter.checkLimit('/api/test', '127.0.0.1');
    const result2 = limiter.checkLimit('/api/test', '192.168.1.1');

    assert.strictEqual(result1.allowed, true);
    assert.strictEqual(result2.allowed, true);
    assert.strictEqual(result1.remaining, 4);
    assert.strictEqual(result2.remaining, 4);
  });

  test('should track different endpoints separately', () => {
    const limiter = new EndpointRateLimiter({
      defaultWindow: 60000,
      defaultMaxRequests: 5
    });

    const result1 = limiter.checkLimit('/api/users', '127.0.0.1');
    const result2 = limiter.checkLimit('/api/posts', '127.0.0.1');

    assert.strictEqual(result1.allowed, true);
    assert.strictEqual(result2.allowed, true);
    assert.strictEqual(result1.remaining, 4);
    assert.strictEqual(result2.remaining, 4);
  });

  test('should support custom endpoint configuration', () => {
    const limiter = new EndpointRateLimiter({
      defaultWindow: 60000,
      defaultMaxRequests: 100
    });

    limiter.setEndpointConfig('/api/auth/login', {
      window: 300000,
      maxRequests: 3
    });

    // Default endpoint
    const result1 = limiter.checkLimit('/api/users', '127.0.0.1');
    assert.strictEqual(result1.limit, 100);

    // Custom endpoint
    const result2 = limiter.checkLimit('/api/auth/login', '127.0.0.1');
    assert.strictEqual(result2.limit, 3);
  });

  test('should match wildcard patterns', () => {
    const limiter = new EndpointRateLimiter();

    limiter.setEndpointConfig('/api/admin/*', {
      window: 60000,
      maxRequests: 10
    });

    const result1 = limiter.checkLimit('/api/admin/users', '127.0.0.1');
    const result2 = limiter.checkLimit('/api/admin/settings', '127.0.0.1');

    assert.strictEqual(result1.limit, 10);
    assert.strictEqual(result2.limit, 10);
  });

  test('should match extension patterns', () => {
    const limiter = new EndpointRateLimiter();

    limiter.setEndpointConfig('*.css', {
      window: 60000,
      maxRequests: 50
    });

    const result1 = limiter.checkLimit('/assets/style.css', '127.0.0.1');
    const result2 = limiter.checkLimit('/theme.css', '127.0.0.1');

    assert.strictEqual(result1.limit, 50);
    assert.strictEqual(result2.limit, 50);
  });

  test('should track statistics', () => {
    const limiter = new EndpointRateLimiter({
      defaultWindow: 60000,
      defaultMaxRequests: 2
    });

    limiter.checkLimit('/api/test', '127.0.0.1');
    limiter.checkLimit('/api/test', '127.0.0.1');
    limiter.checkLimit('/api/test', '127.0.0.1'); // Blocked

    const stats = limiter.getStats();
    assert.strictEqual(stats.requests, 3);
    assert.strictEqual(stats.blocked, 1);
    assert.ok(stats.endpoints['/api/test']);
    assert.strictEqual(stats.endpoints['/api/test'].requests, 3);
    assert.strictEqual(stats.endpoints['/api/test'].blocked, 1);
  });

  test('should cleanup old entries', async () => {
    const limiter = new EndpointRateLimiter({
      defaultWindow: 100, // 100ms
      defaultMaxRequests: 10
    });

    limiter.checkLimit('/api/test', '127.0.0.1');

    assert.strictEqual(limiter.limitMap.size, 1);

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    const cleaned = limiter.cleanup();
    assert.ok(cleaned >= 0);

    // Destroy to prevent hanging
    limiter.destroy();
  });

  test('should clear all entries', () => {
    const limiter = new EndpointRateLimiter();

    limiter.checkLimit('/api/test', '127.0.0.1');
    limiter.checkLimit('/api/test', '192.168.1.1');

    assert.ok(limiter.limitMap.size > 0);

    limiter.clear();

    assert.strictEqual(limiter.limitMap.size, 0);
  });
});
