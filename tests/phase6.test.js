/**
 * Phase 6 Improvements Tests
 *
 * Tests for:
 * - HTTP Cache Manager
 * - Security Headers Manager
 * - Performance Monitor
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Import Phase 6 utilities
const {
  HttpCacheManager,
  ETagGenerator,
  CacheControlBuilder
} = require('../utils/http-cache');

const {
  SecurityHeadersManager,
  CSPBuilder,
  PermissionsPolicyBuilder
} = require('../utils/security-headers');

const {
  PerformanceMonitor,
  PerformanceBudget
} = require('../utils/performance-monitor');

// ==================== HTTP Cache Tests ====================

describe('HTTP Cache Manager', () => {
  it('should create ETag generator', () => {
    const generator = new ETagGenerator('sha1', false);
    assert.ok(generator);
  });

  it('should generate consistent ETags', () => {
    const generator = new ETagGenerator('sha1');
    const content = 'test content';

    const etag1 = generator.generate(content);
    const etag2 = generator.generate(content);

    assert.strictEqual(etag1, etag2);
  });

  it('should generate weak ETags', () => {
    const generator = new ETagGenerator('sha1', true);
    const etag = generator.generate('content');

    assert.ok(etag.startsWith('W/"'));
  });

  it('should parse ETags', () => {
    const generator = new ETagGenerator();

    const parsed = generator.parse('W/"abc123"');
    assert.strictEqual(parsed.weak, true);
    assert.strictEqual(parsed.etag, 'abc123');
  });

  it('should compare ETags', () => {
    const generator = new ETagGenerator();

    assert.strictEqual(
      generator.compare('"abc123"', '"abc123"'),
      true
    );

    assert.strictEqual(
      generator.compare('"abc123"', '"def456"'),
      false
    );
  });

  it('should create Cache-Control builder', () => {
    const builder = new CacheControlBuilder();
    assert.ok(builder);
  });

  it('should build Cache-Control header', () => {
    const builder = new CacheControlBuilder();
    builder.maxAge(300).public().staleWhileRevalidate(3600);

    const header = builder.build();

    assert.ok(header.includes('max-age=300'));
    assert.ok(header.includes('public'));
    assert.ok(header.includes('stale-while-revalidate=3600'));
  });

  it('should parse Cache-Control header', () => {
    const builder = CacheControlBuilder.parse('max-age=600, public, immutable');

    assert.strictEqual(builder.directives.get('max-age'), 600);
    assert.strictEqual(builder.directives.get('public'), true);
    assert.strictEqual(builder.directives.get('immutable'), true);
  });

  it('should create HTTP cache manager', () => {
    const manager = new HttpCacheManager();
    assert.ok(manager);
  });

  it('should generate cache headers', () => {
    const manager = new HttpCacheManager();
    const content = 'test content';

    const headers = manager.generateHeaders(content, { maxAge: 600 });

    assert.ok(headers['ETag']);
    assert.ok(headers['Cache-Control']);
    assert.ok(headers['Cache-Control'].includes('max-age=600'));
  });

  it('should handle conditional requests', () => {
    const manager = new HttpCacheManager();
    const content = 'test content';

    const headers = manager.generateHeaders(content);
    const etag = headers['ETag'];

    const req = {
      headers: {
        'if-none-match': etag
      }
    };

    const check = manager.checkConditionalRequest(req, etag);

    assert.strictEqual(check.notModified, true);
    assert.strictEqual(check.matchType, 'etag');
  });

  it('should check Last-Modified', () => {
    const manager = new HttpCacheManager();
    const lastModified = new Date('2025-01-01');

    const req = {
      headers: {
        'if-modified-since': new Date('2025-01-02').toUTCString()
      }
    };

    const check = manager.checkConditionalRequest(req, null, lastModified);

    assert.strictEqual(check.notModified, true);
    assert.strictEqual(check.matchType, 'last-modified');
  });

  it('should get cache strategy for resource types', () => {
    const manager = new HttpCacheManager();

    const staticStrategy = manager.getCacheStrategy('static');
    const apiStrategy = manager.getCacheStrategy('api');

    assert.strictEqual(staticStrategy.immutable, true);
    assert.ok(staticStrategy.maxAge > apiStrategy.maxAge);
  });
});

// ==================== Security Headers Tests ====================

describe('Security Headers Manager', () => {
  it('should create CSP builder', () => {
    const builder = new CSPBuilder();
    assert.ok(builder);
  });

  it('should add CSP directives', () => {
    const builder = new CSPBuilder();
    builder.addDirective('default-src', ["'self'"]);
    builder.addDirective('script-src', ["'self'", 'https://cdn.example.com']);

    const csp = builder.build();

    assert.ok(csp.includes("default-src 'self'"));
    assert.ok(csp.includes('script-src'));
  });

  it('should add nonce to CSP', () => {
    const builder = new CSPBuilder();
    builder.addNonce('abc123');

    const csp = builder.build();

    assert.ok(csp.includes("'nonce-abc123'"));
  });

  it('should add hash to CSP', () => {
    const builder = new CSPBuilder();
    builder.addHash('console.log("test");', 'sha256', 'script-src');

    const csp = builder.build();

    assert.ok(csp.includes("'sha256-"));
  });

  it('should parse CSP header', () => {
    const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'";
    const builder = CSPBuilder.parse(csp);

    assert.ok(builder.directives.has('default-src'));
    assert.ok(builder.directives.has('script-src'));
  });

  it('should create Permissions-Policy builder', () => {
    const builder = new PermissionsPolicyBuilder();
    assert.ok(builder);
  });

  it('should build Permissions-Policy header', () => {
    const builder = new PermissionsPolicyBuilder();
    builder.deny('camera');
    builder.deny('microphone');
    builder.allowSelf('geolocation');

    const header = builder.build();

    assert.ok(header.includes('camera=()'));
    assert.ok(header.includes('microphone=()'));
    assert.ok(header.includes('geolocation=(self)'));
  });

  it('should create security headers manager', () => {
    const manager = new SecurityHeadersManager();
    assert.ok(manager);
  });

  it('should generate nonce', () => {
    const manager = new SecurityHeadersManager();
    const nonce = manager.generateNonce();

    assert.ok(nonce);
    assert.ok(nonce.length > 0);
  });

  it('should build HSTS header', () => {
    const manager = new SecurityHeadersManager({
      hsts: {
        enabled: true,
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    });

    const hsts = manager.buildHSTS();

    assert.ok(hsts.includes('max-age=31536000'));
    assert.ok(hsts.includes('includeSubDomains'));
    assert.ok(hsts.includes('preload'));
  });

  it('should get all security headers', () => {
    const manager = new SecurityHeadersManager();
    const headers = manager.getHeaders();

    assert.ok(headers['Content-Security-Policy']);
    assert.ok(headers['Strict-Transport-Security']);
    assert.ok(headers['X-Frame-Options']);
    assert.ok(headers['X-Content-Type-Options']);
    assert.ok(headers['Referrer-Policy']);
  });

  it('should calculate security score', () => {
    const manager = new SecurityHeadersManager();
    const score = manager.getSecurityScore();

    assert.ok(score.score >= 0);
    assert.strictEqual(score.maxScore, 100);
    assert.ok(score.grade);
  });

  it('should get A+ grade for full security', () => {
    const manager = new SecurityHeadersManager({
      csp: { enabled: true },
      hsts: { enabled: true },
      frameOptions: 'DENY',
      noSniff: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: { enabled: true },
      crossOriginEmbedderPolicy: 'require-corp',
      crossOriginOpenerPolicy: 'same-origin',
      crossOriginResourcePolicy: 'same-origin'
    });

    const score = manager.getSecurityScore();

    assert.strictEqual(score.score, 100);
    assert.strictEqual(score.grade, 'A+');
  });
});

// ==================== Performance Monitor Tests ====================

describe('Performance Monitor', () => {
  it('should create performance monitor', () => {
    const monitor = new PerformanceMonitor();
    assert.ok(monitor);
  });

  it('should mark performance points', () => {
    const monitor = new PerformanceMonitor();
    const time = monitor.mark('test-mark');

    assert.ok(time >= 0);
    assert.ok(monitor.marks.has('test-mark'));
  });

  it('should measure between marks', () => {
    const monitor = new PerformanceMonitor();

    monitor.mark('start');
    monitor.mark('end');

    const entry = monitor.measure('test-measure', 'start', 'end');

    assert.ok(entry);
    assert.ok(entry.duration >= 0);
  });

  it('should time async functions', async () => {
    const monitor = new PerformanceMonitor();

    const { result, entry } = await monitor.time('async-test', async () => {
      return 'test-result';
    });

    assert.strictEqual(result, 'test-result');
    assert.ok(entry.duration >= 0);
  });

  it('should create performance budget', () => {
    const budget = new PerformanceBudget({
      'api-call': 500,
      'database-query': 100
    });

    assert.ok(budget);
  });

  it('should detect budget violations', () => {
    const budget = new PerformanceBudget({ 'api-call': 500 });

    const violation = budget.check('api-call', 750);

    assert.ok(violation);
    assert.strictEqual(violation.budget, 500);
    assert.strictEqual(violation.overage, 250);
  });

  it('should track slow measures', () => {
    const monitor = new PerformanceMonitor({ slowThreshold: 100 });

    let slowDetected = false;
    monitor.on('slow', () => {
      slowDetected = true;
    });

    monitor.mark('start');
    // Simulate slow operation
    monitor.marks.set('end', { time: monitor.marks.get('start').time + 150 });
    monitor.measure('slow-operation', 'start', 'end');

    assert.strictEqual(slowDetected, true);
  });

  it('should get performance statistics', () => {
    const monitor = new PerformanceMonitor();

    monitor.mark('start1');
    monitor.mark('end1');
    monitor.measure('measure1', 'start1', 'end1');

    const stats = monitor.getStatistics();

    assert.ok(stats.count >= 1);
    assert.ok(stats.avgDuration);
  });

  it('should generate Server-Timing header', () => {
    const monitor = new PerformanceMonitor();

    const header = monitor.generateServerTimingHeader([
      { name: 'db', duration: 45.67, description: 'Database query' },
      { name: 'cache', duration: 12.34, description: 'Cache lookup' }
    ]);

    assert.ok(header.includes('db;dur=45.67'));
    assert.ok(header.includes('cache;dur=12.34'));
  });

  it('should get slow measures', () => {
    const monitor = new PerformanceMonitor({ slowThreshold: 50 });

    monitor.mark('start1');
    monitor.marks.set('end1', { time: monitor.marks.get('start1').time + 100 });
    monitor.measure('slow1', 'start1', 'end1');

    monitor.mark('start2');
    monitor.marks.set('end2', { time: monitor.marks.get('start2').time + 10 });
    monitor.measure('fast1', 'start2', 'end2');

    const slowMeasures = monitor.getSlowMeasures();

    assert.strictEqual(slowMeasures.length, 1);
    assert.strictEqual(slowMeasures[0].name, 'slow1');
  });
});

console.log('All Phase 6 tests completed!');
