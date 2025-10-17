/**
 * Tests for Caching Module
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { CacheManager } = require('../lib/caching');

test('Caching Module', async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qui-cache-test-'));
  const testFile = path.join(tempDir, 'test.html');

  // Create test file
  await fs.writeFile(testFile, '<html><body>Test</body></html>');

  const mockConfig = {
    caching: {
      fileCacheEnabled: true,
      fileCacheMaxSize: 50,
      fileCacheMaxFileSize: 1024 * 1024, // 1MB
      fileCacheTTL: 30000, // 30 seconds
      compressionCacheEnabled: true,
      compressionCacheMaxSize: 100,
      compressionCacheTTL: 60000 // 1 minute
    },
    static: {
      root: tempDir,
      allowedPaths: ['/']
    }
  };

  let cache;

  t.beforeEach(() => {
    cache = new CacheManager(mockConfig);
  });

  t.afterEach(async () => {
    if (cache) {
      cache.cleanup();
    }
  });

  await t.test('CacheManager initializes correctly', () => {
    assert(cache instanceof CacheManager);
    assert.strictEqual(cache.staticRoot, tempDir);
    assert(Array.isArray(cache.allowedPaths));
  });

  await t.test('initialize() sets up cache components', () => {
    cache.initialize();

    if (mockConfig.caching.fileCacheEnabled) {
      assert(cache.fileCache !== null);
    }

    if (mockConfig.caching.compressionCacheEnabled) {
      assert(cache.compressionCache !== null);
    }
  });

  await t.test('isPathAllowed() validates paths correctly', () => {
    assert(cache.isPathAllowed('/'));
    assert(cache.isPathAllowed('/test.html'));
    assert(!cache.isPathAllowed('/../outside'));
    assert(!cache.isPathAllowed('/admin'));
  });

  await t.test('resolveFilePath() handles different path types', () => {
    assert.strictEqual(cache.resolveFilePath('/'), path.join(tempDir, 'index.html'));
    assert.strictEqual(cache.resolveFilePath('/test.html'), path.join(tempDir, 'test.html'));
  });

  await t.test('getMimeType() returns correct types', () => {
    assert.strictEqual(cache.getMimeType('/test.html'), 'text/html; charset=utf-8');
    assert.strictEqual(cache.getMimeType('/test.css'), 'text/css; charset=utf-8');
    assert.strictEqual(cache.getMimeType('/test.js'), 'application/javascript; charset=utf-8');
    assert.strictEqual(cache.getMimeType('/test.json'), 'application/json; charset=utf-8');
    assert.strictEqual(cache.getMimeType('/test.png'), 'image/png');
    assert.strictEqual(cache.getMimeType('/test.unknown'), 'application/octet-stream');
  });

  await t.test('isCacheableFile() checks file properties', async () => {
    const stats = await fs.stat(testFile);

    // Small file should be cacheable
    assert(cache.isCacheableFile(testFile));

    // Create a large file (over max size)
    const largeFile = path.join(tempDir, 'large.txt');
    const largeContent = 'x'.repeat(mockConfig.caching.fileCacheMaxFileSize + 1);
    await fs.writeFile(largeFile, largeContent);

    // Large file should not be cacheable
    assert(!cache.isCacheableFile(largeFile));

    await fs.unlink(largeFile);
  });

  await t.test('loadFile() reads file correctly', async () => {
    const fileData = await cache.loadFile(testFile);

    assert.strictEqual(typeof fileData, 'object');
    assert(Buffer.isBuffer(fileData.buffer));
    assert.strictEqual(fileData.buffer.toString(), '<html><body>Test</body></html>');
    assert.strictEqual(typeof fileData.stats, 'object');
    assert.strictEqual(fileData.mimeType, 'text/html; charset=utf-8');
  });

  await t.test('generateETag() creates valid ETags', () => {
    const mockFileData = {
      buffer: Buffer.from('test content'),
      stats: { mtimeMs: Date.now() }
    };

    const etag = cache.generateETag(mockFileData);
    assert.strictEqual(typeof etag, 'string');
    assert(etag.startsWith('W/"'));
    assert(etag.endsWith('"'));
  });

  await t.test('acceptsGzip() checks Accept-Encoding header', () => {
    const reqWithGzip = { headers: { 'accept-encoding': 'gzip, deflate' } };
    assert(cache.acceptsGzip(reqWithGzip));

    const reqWithoutGzip = { headers: { 'accept-encoding': 'deflate' } };
    assert(!cache.acceptsGzip(reqWithoutGzip));

    const reqNoHeader = { headers: {} };
    assert(!cache.acceptsGzip(reqNoHeader));
  });

  await t.test('setCacheHeaders() applies correct headers', () => {
    const mockRes = {
      setHeader: function(key, value) {
        this.headers = this.headers || {};
        this.headers[key] = value;
      }
    };

    const mockFileData = {
      buffer: Buffer.from('test'),
      stats: { mtime: new Date() },
      mimeType: 'text/plain',
      encoding: null
    };

    cache.setCacheHeaders(mockRes, mockFileData, false);

    assert(mockRes.headers['Content-Type']);
    assert(mockRes.headers['Content-Length']);
    assert(mockRes.headers['Last-Modified']);
    assert(mockRes.headers['ETag']);
    assert(mockRes.headers['Cache-Control']);
    assert(mockRes.headers['Accept-Ranges']);
  });

  await t.test('serveFromCache() serves cached content', async () => {
    const mockRes = {
      writeHead: function(status, headers) {
        this.statusCode = status;
        this.headersSent = true;
      },
      end: function(data) {
        this.responseData = data;
      }
    };

    const cachedData = {
      buffer: Buffer.from('cached content'),
      stats: { mtime: new Date() },
      mimeType: 'text/plain'
    };

    await cache.serveFromCache(
      { method: 'GET' },
      mockRes,
      cachedData,
      'test-key'
    );

    assert.strictEqual(mockRes.statusCode, 200);
    assert(Buffer.isBuffer(mockRes.responseData));
  });

  await t.test('serveFile() serves file content', async () => {
    const mockRes = {
      writeHead: function(status, headers) {
        this.statusCode = status;
        this.headersSent = true;
      },
      end: function(data) {
        this.responseData = data;
      }
    };

    const fileData = {
      buffer: Buffer.from('file content'),
      stats: { mtime: new Date() },
      mimeType: 'text/plain',
      path: testFile
    };

    await cache.serveFile(
      { method: 'GET' },
      mockRes,
      fileData,
      testFile
    );

    assert.strictEqual(mockRes.statusCode, 200);
    assert(Buffer.isBuffer(mockRes.responseData));
  });

  await t.test('handleStaticFile() processes requests', async () => {
    const mockReq = {
      method: 'GET',
      headers: {}
    };

    let handled = false;
    const mockRes = {
      writeHead: function(status) {
        this.statusCode = status;
        handled = true;
      },
      end: function() {
        handled = true;
      },
      setHeader: function() {}
    };

    const result = await cache.handleStaticFile(mockReq, mockRes, '/test.html');

    // Should return true for successful handling or false for not found
    assert.strictEqual(typeof result, 'boolean');
  });

  await t.test('getStats() returns cache statistics', () => {
    const stats = cache.getStats();

    assert.strictEqual(typeof stats, 'object');
    assert(stats.hasOwnProperty('fileCache'));
    assert(stats.hasOwnProperty('compressionCache'));

    assert.strictEqual(typeof stats.fileCache.enabled, 'boolean');
    assert.strictEqual(typeof stats.compressionCache.enabled, 'boolean');
  });

  await t.test('cleanup() clears cache resources', () => {
    cache.cleanup();

    if (cache.fileCache) {
      assert.strictEqual(cache.fileCache.size, 0);
    }

    if (cache.compressionCache) {
      assert.strictEqual(cache.compressionCache.size, 0);
    }
  });

  // Cleanup
  t.after(async () => {
    try {
      await fs.unlink(testFile);
      await fs.rmdir(tempDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  });
});
