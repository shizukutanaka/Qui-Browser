/**
 * Tests for Security Module
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { SecurityManager } = require('../lib/security');

test('Security Module', async (t) => {
  const mockConfig = {
    port: 8000,
    security: {
      enabled: true,
      allowedOrigins: ['http://localhost:3000'],
      allowedHosts: ['localhost', '127.0.0.1']
    },
    rateLimiting: {
      enabled: true,
      maxRequests: 100,
      windowMs: 60000,
      maxEntries: 1000
    }
  };

  let security;

  await t.test('SecurityManager initializes correctly', () => {
    security = new SecurityManager(mockConfig);
    assert(security instanceof SecurityManager);
    assert(Array.isArray(security.allowedOriginEntries));
    assert(Array.isArray(security.allowedHostEntries));
  });

  await t.test('initialize() sets up security components', () => {
    security.initialize();
    assert(security.rateLimitMap !== null);
    assert(Array.isArray(security.allowedOriginEntries));
    assert(Array.isArray(security.allowedHostEntries));
  });

  await t.test('parseAllowedOrigins() handles various inputs', () => {
    // Test wildcard
    const wildcardConfig = { ...mockConfig, security: { ...mockConfig.security, allowedOrigins: ['*'] } };
    const wildcardSecurity = new SecurityManager(wildcardConfig);
    wildcardSecurity.parseAllowedOrigins();
    assert(wildcardSecurity.allowAnyOrigin);

    // Test specific origins
    const specificSecurity = new SecurityManager(mockConfig);
    specificSecurity.parseAllowedOrigins();
    assert(!specificSecurity.allowAnyOrigin);
    assert(specificSecurity.allowedOriginEntries.length > 0);
  });

  await t.test('parseAllowedHosts() handles various inputs', () => {
    security.parseAllowedHosts();
    assert(!security.allowAnyHostHeader);
    assert(security.allowedHostEntries.length > 0);
  });

  await t.test('validateHostHeader() accepts valid hosts', () => {
    assert(security.validateHostHeader('localhost:8000'));
    assert(security.validateHostHeader('127.0.0.1:8000'));
    assert(security.validateHostHeader('localhost'));
  });

  await t.test('validateHostHeader() rejects invalid hosts', () => {
    assert(!security.validateHostHeader('evil.com'));
    assert(!security.validateHostHeader(''));
    assert(!security.validateHostHeader(null));
  });

  await t.test('checkRateLimit() allows requests within limits', () => {
    const clientIP = '192.168.1.1';
    security.rateLimitMap.clear();

    // Should allow initial requests
    assert(security.checkRateLimit(clientIP));
    assert(security.checkRateLimit(clientIP));
  });

  await t.test('checkRateLimit() blocks excessive requests', () => {
    const clientIP = '192.168.1.2';
    security.rateLimitMap.clear();

    // Exhaust the rate limit
    for (let i = 0; i < mockConfig.rateLimiting.maxRequests; i++) {
      assert(security.checkRateLimit(clientIP), `Request ${i + 1} should be allowed`);
    }

    // Next request should be blocked
    assert(!security.checkRateLimit(clientIP), 'Excessive request should be blocked');
  });

  await t.test('resolveAllowedOrigin() handles self origin', () => {
    const result = security.resolveAllowedOrigin(null, 'localhost', false);
    assert(result === 'http://localhost' || result === null);
  });

  await t.test('resolveAllowedOrigin() handles wildcard', () => {
    const wildcardSecurity = new SecurityManager({
      ...mockConfig,
      security: { ...mockConfig.security, allowedOrigins: ['*'] }
    });
    wildcardSecurity.initialize();

    const result = wildcardSecurity.resolveAllowedOrigin('http://example.com', 'localhost', false);
    assert.strictEqual(result, '*');
  });

  await t.test('resolveAllowedOrigin() handles specific origins', () => {
    const result = security.resolveAllowedOrigin('http://localhost:3000', 'localhost', false);
    assert(result !== null);
  });

  await t.test('buildSecurityHeaders() returns proper headers', () => {
    security.initializeSecurityHeaders();

    const headers = security.buildSecurityHeaders({}, {
      requestOrigin: 'http://localhost:3000',
      requestHost: 'localhost',
      requestMethod: 'GET',
      isTls: false
    });

    assert.strictEqual(typeof headers, 'object');
    assert(headers.hasOwnProperty('X-Content-Type-Options'));
    assert(headers.hasOwnProperty('X-Frame-Options'));
    assert(headers.hasOwnProperty('X-XSS-Protection'));
  });

  await t.test('addSecurityHeaders() applies headers to response', () => {
    const mockRes = {
      setHeader: function(key, value) {
        this.headers = this.headers || {};
        this.headers[key] = value;
      }
    };

    security.addSecurityHeaders({
      headers: { origin: 'http://localhost:3000', host: 'localhost' },
      method: 'GET',
      socket: { encrypted: false }
    }, mockRes);

    assert(mockRes.headers);
    assert(mockRes.headers.hasOwnProperty('X-Content-Type-Options'));
  });

  await t.test('getClientIP() extracts IP correctly', () => {
    // Test X-Forwarded-For header
    const reqWithProxy = {
      headers: { 'x-forwarded-for': '192.168.1.100, 10.0.0.1' },
      connection: { remoteAddress: '127.0.0.1' }
    };
    assert.strictEqual(security.getClientIP(reqWithProxy), '192.168.1.100');

    // Test direct connection
    const reqDirect = {
      headers: {},
      connection: { remoteAddress: '192.168.1.200' }
    };
    assert.strictEqual(security.getClientIP(reqDirect), '192.168.1.200');
  });

  await t.test('cleanup() clears resources', () => {
    security.cleanup();
    assert.strictEqual(security.rateLimitMap.size, 0);
  });

  await t.test('rateLimitTokenInterval getter works', () => {
    const interval = security.rateLimitTokenInterval;
    assert.strictEqual(typeof interval, 'number');
    assert(interval > 0);
  });
});
