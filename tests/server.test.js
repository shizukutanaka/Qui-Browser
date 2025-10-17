const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { gzipSync } = require('node:zlib');

const LightweightBrowserServer = require('../server-modular');

let serverInstance;
let httpServer;
let baseUrl;
let previousPortEnv;
let tempAssetPath;
let tempAssetGzipPath;

async function closeServer(server) {
  if (!server) {
    return;
  }
  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      console.warn('Server close timeout, forcing resolution');
      resolve();
    }, 5000);

    server.close(() => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

test.before(async () => {
  previousPortEnv = process.env.PORT;
  const previousEnv = process.env.NODE_ENV;
  process.env.PORT = '0';
  process.env.NODE_ENV = 'test';
  process.env.RATE_LIMIT_MAX = '500';

  // Create assets directory if it doesn't exist
  const assetsDir = path.join(__dirname, '..', 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // Create test files before starting server
  tempAssetPath = path.join(assetsDir, 'test-precompressed.txt');
  tempAssetGzipPath = `${tempAssetPath}.gz`;
  const testContent = `precompressed fixture ${Date.now()}`;
  fs.writeFileSync(tempAssetPath, testContent, 'utf8');
  fs.writeFileSync(tempAssetGzipPath, gzipSync(Buffer.from(testContent, 'utf8')));

  // Start server with timeout protection
  serverInstance = new LightweightBrowserServer();
  httpServer = await Promise.race([
    serverInstance.start(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Server start timeout')), 10000))
  ]);

  const address = httpServer.address();
  const port = typeof address === 'object' && address ? address.port : process.env.PORT || 8000;
  baseUrl = `http://127.0.0.1:${port}`;

  if (previousEnv) {
    process.env.NODE_ENV = previousEnv;
  }
});

test.after(async () => {
  try {
    if (serverInstance && typeof serverInstance.stopHealthMonitor === 'function') {
      serverInstance.stopHealthMonitor();
    }
    if (serverInstance && typeof serverInstance.cleanup === 'function') {
      serverInstance.cleanup();
    }
    if (httpServer) {
      await closeServer(httpServer);
      httpServer = null;
    }
    serverInstance = null;

    if (typeof previousPortEnv === 'undefined') {
      delete process.env.PORT;
    } else {
      process.env.PORT = previousPortEnv;
    }

    if (tempAssetGzipPath && fs.existsSync(tempAssetGzipPath)) {
      fs.unlinkSync(tempAssetGzipPath);
    }
    if (tempAssetPath && fs.existsSync(tempAssetPath)) {
      fs.unlinkSync(tempAssetPath);
    }
  } catch (error) {
    console.warn('Cleanup error:', error.message);
  }
});

test('health endpoint exposes enriched metrics', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.strictEqual(response.status, 200);
  const body = await response.json();
  assert.ok(body.metrics, 'Health payload should include metrics object');
  assert.ok(body.metrics.server, 'Health metrics should include server section');
  assert.deepStrictEqual(body.metrics.server.rateLimited, serverInstance.rateLimitedCount);
  assert.strictEqual(body.version, serverInstance.version);
  assert.ok(body.metrics.system, 'Health metrics should include system snapshot');
  assert.ok(body.environment, 'Health payload should include environment section');
});

test('serves precompressed static asset when client accepts gzip', async () => {
  const targetPath = '/assets/test-precompressed.txt';
  const url = `${baseUrl}${targetPath}`;

  await new Promise((resolve, reject) => {
    const request = http.get(
      url,
      {
        headers: {
          'Accept-Encoding': 'gzip'
        }
      },
      res => {
        try {
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(res.headers['content-encoding'], 'gzip');
          assert.ok(res.headers['vary'].includes('Accept-Encoding'), 'Vary header should include Accept-Encoding');
          // X-Cache header may not be present on first request
          if (res.headers['x-cache']) {
            assert.ok(['HIT', 'MISS'].includes(res.headers['x-cache']), 'X-Cache should be HIT or MISS');
          }
          let length = 0;
          res.on('data', chunk => {
            length += chunk.length;
          });
          res.on('end', () => {
            try {
              assert.ok(length > 0, 'Compressed body should have content');
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        } catch (error) {
          reject(error);
        }
      }
    );

    request.on('error', reject);
    request.end();
  });
});
