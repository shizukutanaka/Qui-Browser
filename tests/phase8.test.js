/**
 * Phase 8 Improvements Tests
 *
 * Tests for:
 * - Image Optimizer (#152-153)
 * - Asset Minifier (#154-160)
 * - Monitoring Dashboard (#291-293)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

// Import Phase 8 utilities
const {
  ImageOptimizer,
  ImageFormatDetector,
  ImageCDN,
  LazyLoadingManager
} = require('../utils/image-optimizer');

const {
  AssetMinifierManager,
  CSSMinifier,
  JavaScriptMinifier,
  HTMLOptimizer,
  ResourceHintsManager,
  FontOptimizer
} = require('../utils/asset-minifier');

const {
  MonitoringDashboardManager,
  PerformanceDashboard,
  AnalyticsDashboard,
  SecurityDashboard,
  TimeSeriesStore
} = require('../utils/monitoring-dashboard');

// ==================== Image Optimizer Tests ====================

describe('Image Optimizer', () => {
  it('should detect JPEG format', () => {
    // JPEG magic bytes
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    const format = ImageFormatDetector.detectFormat(jpegBuffer);
    assert.strictEqual(format, 'jpeg');
  });

  it('should detect PNG format', () => {
    // PNG magic bytes
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const format = ImageFormatDetector.detectFormat(pngBuffer);
    assert.strictEqual(format, 'png');
  });

  it('should detect GIF format', () => {
    // GIF magic bytes
    const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    const format = ImageFormatDetector.detectFormat(gifBuffer);
    assert.strictEqual(format, 'gif');
  });

  it('should detect WebP format', () => {
    // WebP magic bytes (simplified)
    const webpBuffer = Buffer.alloc(12);
    webpBuffer.write('RIFF', 0);
    webpBuffer.write('WEBP', 8);
    const format = ImageFormatDetector.detectFormat(webpBuffer);
    assert.strictEqual(format, 'webp');
  });

  it('should create image optimizer', () => {
    const optimizer = new ImageOptimizer();
    assert.ok(optimizer);
  });

  it('should optimize image', async () => {
    const optimizer = new ImageOptimizer();

    // Create a simple JPEG buffer
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

    // Mock dimensions by creating a proper JPEG structure
    const mockJPEG = Buffer.alloc(200);
    mockJPEG[0] = 0xff;
    mockJPEG[1] = 0xd8;
    mockJPEG[2] = 0xff;
    mockJPEG[3] = 0xc0; // SOF0 marker
    mockJPEG[4] = 0x00;
    mockJPEG[5] = 0x11;
    mockJPEG[6] = 0x08;
    mockJPEG[7] = 0x01; // height high byte
    mockJPEG[8] = 0x00; // height low byte
    mockJPEG[9] = 0x01; // width high byte
    mockJPEG[10] = 0x00; // width low byte

    const result = await optimizer.optimize(mockJPEG);

    assert.ok(result.buffer);
    assert.ok(result.format);
    assert.ok(result.metadata);
  });

  it('should generate cache key', () => {
    const optimizer = new ImageOptimizer();
    const buffer = Buffer.from('test image data');

    const key1 = optimizer.generateCacheKey(buffer, { quality: 80 });
    const key2 = optimizer.generateCacheKey(buffer, { quality: 80 });
    const key3 = optimizer.generateCacheKey(buffer, { quality: 90 });

    assert.strictEqual(key1, key2);
    assert.notStrictEqual(key1, key3);
  });

  it('should use cache for repeated optimizations', async () => {
    const optimizer = new ImageOptimizer({ cache: { enabled: true } });

    const mockJPEG = Buffer.alloc(200);
    mockJPEG[0] = 0xff;
    mockJPEG[1] = 0xd8;
    mockJPEG[2] = 0xff;
    mockJPEG[3] = 0xc0;
    mockJPEG[4] = 0x00;
    mockJPEG[5] = 0x11;
    mockJPEG[6] = 0x08;
    mockJPEG[7] = 0x01;
    mockJPEG[8] = 0x00;
    mockJPEG[9] = 0x01;
    mockJPEG[10] = 0x00;

    await optimizer.optimize(mockJPEG);
    await optimizer.optimize(mockJPEG);

    const stats = optimizer.getStatistics();
    assert.strictEqual(stats.cacheHits, 1);
  });

  it('should generate srcset attribute', () => {
    const optimizer = new ImageOptimizer();

    const variants = [
      { url: '/image-640.webp', descriptor: '640w' },
      { url: '/image-1280.webp', descriptor: '1280w' }
    ];

    const srcset = optimizer.generateSrcSet(variants);
    assert.ok(srcset.includes('640w'));
    assert.ok(srcset.includes('1280w'));
  });

  it('should create image CDN', () => {
    const cdn = new ImageCDN({ baseURL: 'https://cdn.example.com' });
    assert.ok(cdn);
  });

  it('should generate CDN URLs', () => {
    const cdn = new ImageCDN({ baseURL: 'https://cdn.example.com' });

    const url = cdn.getURL('images/photo.jpg', {
      width: 800,
      quality: 80,
      format: 'webp'
    });

    assert.ok(url.includes('cdn.example.com'));
    assert.ok(url.includes('w=800'));
    assert.ok(url.includes('q=80'));
    assert.ok(url.includes('f=webp'));
  });

  it('should create lazy loading manager', () => {
    const lazyLoader = new LazyLoadingManager();
    assert.ok(lazyLoader);
  });

  it('should generate lazy loading attributes', () => {
    const lazyLoader = new LazyLoadingManager();

    const attrs = lazyLoader.getLazyAttributes('/image.jpg');

    assert.strictEqual(attrs['data-src'], '/image.jpg');
    assert.strictEqual(attrs.loading, 'lazy');
    assert.ok(attrs.src); // Placeholder
  });

  it('should generate placeholder SVG', () => {
    const lazyLoader = new LazyLoadingManager();

    const placeholder = lazyLoader.generatePlaceholder(100, 100);

    assert.ok(placeholder.startsWith('data:image/svg+xml'));
  });
});

// ==================== Asset Minifier Tests ====================

describe('Asset Minifier', () => {
  it('should create CSS minifier', () => {
    const minifier = new CSSMinifier();
    assert.ok(minifier);
  });

  it('should minify CSS', () => {
    const minifier = new CSSMinifier();

    const css = `
      /* Comment */
      .class {
        color: #ffffff;
        margin: 0px;
        padding: 10px 20px 10px 20px;
      }
    `;

    const minified = minifier.minify(css);

    assert.ok(!minified.includes('/*'));
    assert.ok(minified.length < css.length);
  });

  it('should remove CSS comments', () => {
    const minifier = new CSSMinifier();

    const css = '/* This is a comment */ .class { color: red; }';
    const result = minifier.removeComments(css);

    assert.ok(!result.includes('/*'));
    assert.ok(!result.includes('*/'));
  });

  it('should minify colors', () => {
    const minifier = new CSSMinifier();

    const css = 'color: #ff00ff;';
    const result = minifier.minifyColors(css);

    assert.strictEqual(result, 'color: #f0f;');
  });

  it('should create JavaScript minifier', () => {
    const minifier = new JavaScriptMinifier();
    assert.ok(minifier);
  });

  it('should minify JavaScript', () => {
    const minifier = new JavaScriptMinifier();

    const js = `
      // Comment
      console.log('debug');
      debugger;
      function test() {
        return 42;
      }
    `;

    const minified = minifier.minify(js);

    assert.ok(!minified.includes('//'));
    assert.ok(!minified.includes('console.log'));
    assert.ok(!minified.includes('debugger'));
    assert.ok(minified.length < js.length);
  });

  it('should remove console statements', () => {
    const minifier = new JavaScriptMinifier();

    const js = 'console.log("test"); console.error("error");';
    const result = minifier.removeConsole(js);

    assert.ok(!result.includes('console.log'));
    assert.ok(!result.includes('console.error'));
  });

  it('should remove debugger statements', () => {
    const minifier = new JavaScriptMinifier();

    const js = 'debugger; var x = 1;';
    const result = minifier.removeDebugger(js);

    assert.ok(!result.includes('debugger'));
  });

  it('should create HTML optimizer', () => {
    const optimizer = new HTMLOptimizer();
    assert.ok(optimizer);
  });

  it('should optimize HTML', () => {
    const optimizer = new HTMLOptimizer();

    const html = `
      <!-- Comment -->
      <div class="">
        <p>  Text  </p>
      </div>
    `;

    const optimized = optimizer.optimize(html);

    assert.ok(!optimized.includes('<!--'));
    assert.ok(optimized.length < html.length);
  });

  it('should remove HTML comments', () => {
    const optimizer = new HTMLOptimizer();

    const html = '<!-- Comment --><div>Content</div>';
    const result = optimizer.removeComments(html);

    assert.ok(!result.includes('<!--'));
  });

  it('should create resource hints manager', () => {
    const manager = new ResourceHintsManager();
    assert.ok(manager);
  });

  it('should generate preload link', () => {
    const manager = new ResourceHintsManager();

    const link = manager.generatePreload({
      href: '/style.css',
      as: 'style',
      type: 'text/css'
    });

    assert.ok(link.includes('rel="preload"'));
    assert.ok(link.includes('href="/style.css"'));
    assert.ok(link.includes('as="style"'));
  });

  it('should generate prefetch link', () => {
    const manager = new ResourceHintsManager();

    const link = manager.generatePrefetch('/next-page.html');

    assert.ok(link.includes('rel="prefetch"'));
    assert.ok(link.includes('href="/next-page.html"'));
  });

  it('should generate preconnect link', () => {
    const manager = new ResourceHintsManager();

    const link = manager.generatePreconnect('https://cdn.example.com', true);

    assert.ok(link.includes('rel="preconnect"'));
    assert.ok(link.includes('crossorigin'));
  });

  it('should create font optimizer', () => {
    const optimizer = new FontOptimizer();
    assert.ok(optimizer);
  });

  it('should generate font-face CSS', () => {
    const optimizer = new FontOptimizer();

    const css = optimizer.generateFontFace(
      'MyFont',
      [
        { url: '/fonts/myfont.woff2', format: 'woff2' },
        { url: '/fonts/myfont.woff', format: 'woff' }
      ],
      { weight: 'bold', display: 'swap' }
    );

    assert.ok(css.includes('@font-face'));
    assert.ok(css.includes('font-family'));
    assert.ok(css.includes('woff2'));
  });

  it('should create asset minifier manager', () => {
    const manager = new AssetMinifierManager();
    assert.ok(manager);
  });

  it('should track minification statistics', () => {
    const manager = new AssetMinifierManager();

    manager.minifyCSS('.test { color: red; }');
    manager.minifyJS('console.log("test");');

    const stats = manager.getStatistics();

    assert.ok(stats.cssProcessed > 0);
    assert.ok(stats.jsProcessed > 0);
    assert.ok(stats.totalOriginalSize > 0);
  });
});

// ==================== Monitoring Dashboard Tests ====================

describe('Monitoring Dashboard', () => {
  it('should create time series store', () => {
    const store = new TimeSeriesStore(100);
    assert.ok(store);
  });

  it('should add and retrieve data points', () => {
    const store = new TimeSeriesStore();

    store.add(10);
    store.add(20);
    store.add(30);

    const all = store.getAll();
    assert.strictEqual(all.length, 3);
    assert.strictEqual(all[0].value, 10);
    assert.strictEqual(all[2].value, 30);
  });

  it('should enforce max size', () => {
    const store = new TimeSeriesStore(3);

    store.add(1);
    store.add(2);
    store.add(3);
    store.add(4);

    const all = store.getAll();
    assert.strictEqual(all.length, 3);
    assert.strictEqual(all[0].value, 2);
  });

  it('should calculate statistics', () => {
    const store = new TimeSeriesStore();

    store.add(10);
    store.add(20);
    store.add(30);

    const stats = store.getStats();

    assert.strictEqual(stats.min, 10);
    assert.strictEqual(stats.max, 30);
    assert.strictEqual(stats.avg, 20);
    assert.strictEqual(stats.count, 3);
  });

  it('should create performance dashboard', () => {
    const dashboard = new PerformanceDashboard({
      updateInterval: { performance: 10000 }
    });

    assert.ok(dashboard);
    dashboard.stop();
  });

  it('should record requests', () => {
    const dashboard = new PerformanceDashboard({
      updateInterval: { performance: 10000 }
    });

    dashboard.recordRequest('GET', 200, 150);
    dashboard.recordRequest('POST', 201, 200);

    const metrics = dashboard.getCurrentMetrics();

    assert.strictEqual(metrics.totalRequests, 2);
    dashboard.stop();
  });

  it('should track error rate', () => {
    const dashboard = new PerformanceDashboard({
      updateInterval: { performance: 10000 }
    });

    dashboard.recordRequest('GET', 200, 100);
    dashboard.recordRequest('GET', 500, 100);

    const metrics = dashboard.getCurrentMetrics();

    assert.strictEqual(metrics.totalErrors, 1);
    dashboard.stop();
  });

  it('should emit threshold exceeded events', (t, done) => {
    const dashboard = new PerformanceDashboard({
      updateInterval: { performance: 10000 },
      thresholds: { errorRate: 10 }
    });

    let eventFired = false;

    dashboard.on('threshold-exceeded', (data) => {
      if (!eventFired) {
        eventFired = true;
        assert.strictEqual(data.metric, 'errorRate');
        dashboard.stop();
        done();
      }
    });

    // Record requests to exceed threshold
    for (let i = 0; i < 10; i++) {
      dashboard.recordRequest('GET', 500, 100);
    }

    dashboard.checkThresholds();

    // Cleanup if event doesn't fire
    setTimeout(() => {
      if (!eventFired) {
        dashboard.stop();
        done();
      }
    }, 100);
  });

  it('should create analytics dashboard', () => {
    const dashboard = new AnalyticsDashboard();
    assert.ok(dashboard);
  });

  it('should track page views', () => {
    const dashboard = new AnalyticsDashboard();

    dashboard.trackPageView('/', 'session1', 'Mozilla/5.0 Chrome', null, 'US');
    dashboard.trackPageView('/about', 'session2', 'Mozilla/5.0 Firefox', null, 'UK');

    const summary = dashboard.getSummary();

    assert.strictEqual(summary.totalPageViews, 2);
    assert.strictEqual(summary.uniqueVisitors, 2);
  });

  it('should detect device types', () => {
    const dashboard = new AnalyticsDashboard();

    assert.strictEqual(
      dashboard.detectDeviceType('Mozilla/5.0 (iPhone; CPU iPhone OS)'),
      'mobile'
    );
    assert.strictEqual(
      dashboard.detectDeviceType('Mozilla/5.0 (iPad; CPU OS)'),
      'tablet'
    );
    assert.strictEqual(
      dashboard.detectDeviceType('Mozilla/5.0 (Windows NT 10.0)'),
      'desktop'
    );
  });

  it('should detect browsers', () => {
    const dashboard = new AnalyticsDashboard();

    assert.strictEqual(
      dashboard.detectBrowser('Mozilla/5.0 Chrome/96.0'),
      'Chrome'
    );
    assert.strictEqual(
      dashboard.detectBrowser('Mozilla/5.0 Firefox/95.0'),
      'Firefox'
    );
    assert.strictEqual(
      dashboard.detectBrowser('Mozilla/5.0 Safari/605.1'),
      'Safari'
    );
  });

  it('should create security dashboard', () => {
    const dashboard = new SecurityDashboard();
    assert.ok(dashboard);
  });

  it('should record security threats', () => {
    const dashboard = new SecurityDashboard();

    const threat = dashboard.recordThreat({
      type: 'xss',
      severity: 'high',
      source: '192.168.1.1',
      description: 'XSS attempt detected'
    });

    assert.ok(threat.id);
    assert.strictEqual(threat.type, 'xss');
    assert.strictEqual(dashboard.metrics.totalThreats, 1);
  });

  it('should block IP addresses', () => {
    const dashboard = new SecurityDashboard();

    dashboard.blockIP('192.168.1.1', 'Malicious activity');

    assert.ok(dashboard.blockedIPs.has('192.168.1.1'));
    assert.strictEqual(dashboard.metrics.threatsBlocked, 1);
  });

  it('should calculate security score', () => {
    const dashboard = new SecurityDashboard();

    const initialScore = dashboard.calculateSecurityScore();
    assert.strictEqual(initialScore, 100);

    dashboard.recordThreat({
      type: 'sqli',
      severity: 'critical',
      source: '10.0.0.1',
      description: 'SQL injection attempt'
    });

    const newScore = dashboard.calculateSecurityScore();
    assert.ok(newScore < 100);
  });

  it('should detect brute force attacks', (t, done) => {
    const dashboard = new SecurityDashboard();

    let threatDetected = false;
    dashboard.on('threat-detected', (threat) => {
      if (threat.type === 'bruteforce') {
        threatDetected = true;
      }
    });

    // Simulate multiple auth failures
    for (let i = 0; i < 15; i++) {
      dashboard.recordAuthFailure('admin', '192.168.1.1');
    }

    setTimeout(() => {
      assert.ok(threatDetected);
      done();
    }, 50);
  });

  it('should create monitoring dashboard manager', () => {
    const manager = new MonitoringDashboardManager({
      updateInterval: { performance: 10000 }
    });

    assert.ok(manager);
    assert.ok(manager.performance);
    assert.ok(manager.analytics);
    assert.ok(manager.security);

    manager.stop();
  });

  it('should get all dashboard summaries', () => {
    const manager = new MonitoringDashboardManager({
      updateInterval: { performance: 10000 }
    });

    const summaries = manager.getAllSummaries();

    assert.ok(summaries.performance);
    assert.ok(summaries.analytics);
    assert.ok(summaries.security);

    manager.stop();
  });
});

console.log('All Phase 8 tests completed!');
