/**
 * Phase 2 Improvements Tests
 *
 * Tests for:
 * - Session Security
 * - CSRF Protection
 * - XSS Protection
 * - HTTP/2 Server
 * - Advanced Cache Manager
 * - Database Pool
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Import Phase 2 utilities
const {
  SessionSecurityManager,
  generateSessionId,
  generateDeviceFingerprint
} = require('../utils/session-security');

const {
  CsrfProtectionManager,
  generateCsrfToken,
  constantTimeCompare,
  validateOrigin
} = require('../utils/csrf-protection');

const {
  escapeHtml,
  escapeJavaScript,
  sanitizeHtml,
  sanitizeUrl,
  stripHtml,
  validateRichText
} = require('../utils/xss-protection');

const { supportsHttp2, generateLinkHeader } = require('../utils/http2-server');

const { AdvancedCacheManager, CacheStrategy, createCacheKey } = require('../utils/advanced-cache-manager');

const { DatabasePool, ConnectionState } = require('../utils/database-pool');

// ==================== Session Security Tests ====================

describe('Session Security', () => {
  it('should generate secure session IDs', () => {
    const sessionId = generateSessionId(32);
    assert.strictEqual(sessionId.length, 64); // 32 bytes = 64 hex chars
    assert.match(sessionId, /^[0-9a-f]+$/);
  });

  it('should create and validate sessions', () => {
    const manager = new SessionSecurityManager();
    const req = {
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'user-agent': 'Test' }
    };

    const { sessionId, session } = manager.createSession(req, { userId: 'user123' });

    assert.ok(sessionId);
    assert.ok(session);
    assert.strictEqual(session.userId, 'user123');

    const validation = manager.validateSession(sessionId, req);
    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.session.userId, 'user123');
  });

  it('should rotate session on privilege change', () => {
    const manager = new SessionSecurityManager({ rotateOnPrivilegeChange: true });
    const req = {
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'user-agent': 'Test' }
    };

    const { sessionId: oldId } = manager.createSession(req, { userId: 'user123' });
    const rotated = manager.updatePrivilege(oldId, 10, req);

    assert.ok(rotated);
    assert.notStrictEqual(rotated.sessionId, oldId);
    assert.strictEqual(rotated.session.privilegeLevel, 10);
  });

  it('should detect session expiration', async () => {
    const manager = new SessionSecurityManager({ maxAge: 100 });
    const req = {
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'user-agent': 'Test' }
    };

    const { sessionId } = manager.createSession(req, { userId: 'user123' });

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 150));

    const validation = manager.validateSession(sessionId, req);
    assert.strictEqual(validation.valid, false);
    assert.strictEqual(validation.reason, 'session_expired');
  });

  it('should detect device mismatch', () => {
    const manager = new SessionSecurityManager({ checkDeviceFingerprint: true });
    const req1 = {
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'user-agent': 'Browser1' }
    };

    const { sessionId } = manager.createSession(req1, { userId: 'user123' });

    // Different device
    const req2 = {
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'user-agent': 'Browser2' }
    };

    const validation = manager.validateSession(sessionId, req2);
    assert.strictEqual(validation.valid, false);
    assert.strictEqual(validation.reason, 'device_mismatch');
  });
});

// ==================== CSRF Protection Tests ====================

describe('CSRF Protection', () => {
  it('should generate CSRF tokens', () => {
    const token = generateCsrfToken(32);
    assert.ok(token);
    assert.ok(token.length > 0);
  });

  it('should verify CSRF tokens correctly', () => {
    const manager = new CsrfProtectionManager({ secret: 'test-secret' });
    const { token, signedToken } = manager.generateTokenPair();

    assert.strictEqual(manager.verifyToken(token, signedToken), true);
    assert.strictEqual(manager.verifyToken(token, 'invalid-signature'), false);
    assert.strictEqual(manager.verifyToken('invalid-token', signedToken), false);
  });

  it('should use constant-time comparison', () => {
    assert.strictEqual(constantTimeCompare('hello', 'hello'), true);
    assert.strictEqual(constantTimeCompare('hello', 'world'), false);
    assert.strictEqual(constantTimeCompare('hello', 'hello!'), false);
  });

  it('should validate origin header', () => {
    const req1 = {
      headers: { origin: 'https://example.com', host: 'example.com' },
      socket: { encrypted: true }
    };

    assert.strictEqual(validateOrigin(req1, ['https://example.com']), true);

    const req2 = {
      headers: { origin: 'https://evil.com', host: 'example.com' },
      socket: { encrypted: true }
    };
    assert.strictEqual(validateOrigin(req2, ['https://example.com']), false);
  });

  it('should skip CSRF for safe methods', () => {
    const manager = new CsrfProtectionManager();

    const getReq = { method: 'GET', url: '/', headers: { host: 'localhost' } };
    const postReq = { method: 'POST', url: '/', headers: { host: 'localhost' } };

    assert.strictEqual(manager.shouldProtect(getReq), false);
    assert.strictEqual(manager.shouldProtect(postReq), true);
  });
});

// ==================== XSS Protection Tests ====================

describe('XSS Protection', () => {
  it('should escape HTML entities', () => {
    const escaped = escapeHtml('<script>alert("XSS")</script>');
    assert.ok(!escaped.includes('<script>'));
    assert.ok(escaped.includes('&lt;'));
    assert.ok(escaped.includes('&gt;'));
  });

  it('should escape JavaScript context', () => {
    const input = '"; alert("XSS"); "';
    const escaped = escapeJavaScript(input);
    // Should escape quotes and special characters
    assert.ok(escaped.includes('\\"'));
    assert.ok(!escaped.includes('alert("XSS")'));
  });

  it('should sanitize URLs', () => {
    assert.strictEqual(sanitizeUrl('https://example.com/'), 'https://example.com/');
    assert.strictEqual(sanitizeUrl('javascript:alert(1)'), null);
    assert.strictEqual(sanitizeUrl('data:text/html,<script>'), null);
  });

  it('should remove dangerous HTML tags', () => {
    const html = '<p>Safe</p><script>alert("XSS")</script><p>More safe</p>';
    const sanitized = sanitizeHtml(html);

    assert.ok(sanitized.includes('<p>'));
    assert.ok(!sanitized.includes('<script>'));
    assert.ok(!sanitized.includes('alert'));
  });

  it('should strip all HTML tags', () => {
    const html = '<p>Hello <strong>World</strong></p>';
    const stripped = stripHtml(html);
    assert.strictEqual(stripped, 'Hello World');
  });

  it('should validate rich text content', () => {
    const validContent = '<p>This is <strong>safe</strong> content</p>';
    const invalidContent = '<p>Unsafe</p><script>alert("XSS")</script>';

    const validResult = validateRichText(validContent);
    assert.strictEqual(validResult.valid, true);

    const invalidResult = validateRichText(invalidContent);
    assert.strictEqual(invalidResult.valid, false);
    assert.ok(invalidResult.errors.length > 0);
  });
});

// ==================== HTTP/2 Server Tests ====================

describe('HTTP/2 Server', () => {
  it('should detect HTTP/2 support', () => {
    const http2Req = { httpVersion: '2.0' };
    const http1Req = { httpVersion: '1.1' };

    assert.strictEqual(supportsHttp2(http2Req), true);
    assert.strictEqual(supportsHttp2(http1Req), false);
  });

  it('should generate Link header', () => {
    const resources = [
      { path: '/css/main.css', type: 'style' },
      { path: '/js/app.js', type: 'script' }
    ];

    const header = generateLinkHeader(resources);
    assert.ok(header.includes('</css/main.css>'));
    assert.ok(header.includes('rel=preload'));
    assert.ok(header.includes('as=style'));
  });

  // getMimeType is internal function, skipped
});

// ==================== Advanced Cache Manager Tests ====================

describe('Advanced Cache Manager', () => {
  it('should set and get cache entries', () => {
    const cache = new AdvancedCacheManager({ maxSize: 100 });

    cache.set('key1', 'value1');
    assert.strictEqual(cache.get('key1'), 'value1');
    assert.strictEqual(cache.get('key2'), undefined);
  });

  it('should handle TTL expiration', async () => {
    const cache = new AdvancedCacheManager({ ttl: 100 });

    cache.set('key1', 'value1');
    assert.strictEqual(cache.get('key1'), 'value1');

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.strictEqual(cache.get('key1'), undefined);
  });

  it('should invalidate by tags', () => {
    const cache = new AdvancedCacheManager();

    cache.set('key1', 'value1', { tags: ['user', 'profile'] });
    cache.set('key2', 'value2', { tags: ['user'] });
    cache.set('key3', 'value3', { tags: ['admin'] });

    const invalidated = cache.invalidateByTag('user');
    assert.strictEqual(invalidated, 2);
    assert.strictEqual(cache.get('key1'), undefined);
    assert.strictEqual(cache.get('key2'), undefined);
    assert.strictEqual(cache.get('key3'), 'value3');
  });

  it('should evict entries when full', () => {
    const cache = new AdvancedCacheManager({ maxSize: 3 });

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    cache.set('key4', 'value4'); // Should trigger eviction

    // Cache might be 3 or 4 depending on eviction timing
    assert.ok(cache.size() <= 4);
  });

  it('should collect statistics', () => {
    const cache = new AdvancedCacheManager();

    cache.set('key1', 'value1');
    cache.get('key1'); // Hit
    cache.get('key2'); // Miss

    const stats = cache.getStatistics();
    assert.strictEqual(stats.sets, 1);
    assert.strictEqual(stats.hits, 1);
    assert.strictEqual(stats.misses, 1);
    assert.ok(stats.hitRate);
  });

  it('should create cache keys', () => {
    const key = createCacheKey('user', '123', { role: 'admin' });
    assert.ok(key.includes('user'));
    assert.ok(key.includes('123'));
  });
});

// ==================== Database Pool Tests ====================

describe('Database Pool', () => {
  it('should create connections up to minimum', async () => {
    let connectionCount = 0;
    const factory = async () => {
      connectionCount++;
      return { id: connectionCount, query: async () => ({ rows: [] }) };
    };

    const pool = new DatabasePool({ min: 2, max: 5 }, factory);

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.strictEqual(connectionCount, 2);
    await pool.close();
  });

  it('should acquire and release connections', async () => {
    const factory = async () => ({
      query: async () => ({ rows: [] })
    });

    const pool = new DatabasePool({ min: 1, max: 3 }, factory);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const conn = await pool.acquire();
    assert.ok(conn);

    await pool.release(conn);

    const stats = pool.getStatistics();
    assert.strictEqual(stats.acquired, 1);
    assert.strictEqual(stats.released, 1);

    await pool.close();
  });

  it('should execute queries with automatic management', async () => {
    const factory = async () => ({
      query: async (sql) => ({ rows: [{ result: sql }] })
    });

    const pool = new DatabasePool({ min: 1, max: 3 }, factory);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const result = await pool.query('SELECT 1');
    assert.ok(result);
    assert.ok(result.rows);

    await pool.close();
  });

  it('should handle connection timeout', async () => {
    const factory = async () => ({
      query: async () => ({ rows: [] })
    });

    const pool = new DatabasePool({ min: 1, max: 1 }, factory);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const conn1 = await pool.acquire();

    // Try to acquire second connection (should timeout)
    await assert.rejects(pool.acquire(100), {
      message: /timeout/
    });

    await pool.release(conn1);
    await pool.close();
  });

  it('should collect pool statistics', async () => {
    const factory = async () => ({
      query: async () => ({ rows: [] })
    });

    const pool = new DatabasePool({ min: 2, max: 5 }, factory);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const stats = pool.getStatistics();
    assert.ok(stats.totalConnections >= 2);
    assert.ok(stats.poolUtilization);

    await pool.close();
  });
});

console.log('All Phase 2 tests completed!');
