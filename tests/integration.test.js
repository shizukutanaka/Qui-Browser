/**
 * Integration Tests for Qui Browser
 * Tests end-to-end workflows and component interactions
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');

const TEST_PORT = 8888;
const SERVER_STARTUP_TIMEOUT = 3000;

/**
 * Start server process for testing
 */
async function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, '..', 'server-modular.js');
    const serverProcess = spawn('node', [serverPath], {
      env: {
        ...process.env,
        PORT: TEST_PORT,
        NODE_ENV: 'test',
        ADMIN_TOKEN: 'test-admin-token-1234567890'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';

    serverProcess.stdout.on('data', data => {
      output += data.toString();
      if (output.includes('Server running')) {
        resolve(serverProcess);
      }
    });

    serverProcess.stderr.on('data', data => {
      console.error('Server error:', data.toString());
    });

    serverProcess.on('error', err => {
      reject(new Error(`Failed to start server: ${err.message}`));
    });

    setTimeout(() => {
      if (!output.includes('Server running')) {
        serverProcess.kill();
        reject(new Error('Server startup timeout'));
      }
    }, SERVER_STARTUP_TIMEOUT);
  });
}

/**
 * Stop server process
 */
async function stopServer(serverProcess) {
  return new Promise(resolve => {
    if (!serverProcess || serverProcess.killed) {
      resolve();
      return;
    }

    serverProcess.on('exit', () => {
      resolve();
    });

    serverProcess.kill('SIGTERM');

    setTimeout(() => {
      if (!serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
      resolve();
    }, 2000);
  });
}

/**
 * Make HTTP request
 */
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ res, data });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

describe('Integration Tests', () => {
  let serverProcess;

  beforeEach(async () => {
    serverProcess = await startServer();
    // Give server time to fully initialize
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  afterEach(async () => {
    await stopServer(serverProcess);
  });

  describe('Basic Workflows', () => {
    test('should serve main page and assets', async () => {
      // Get main page
      const { res: mainRes, data: mainData } = await makeRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/',
        method: 'GET'
      });

      assert.strictEqual(mainRes.statusCode, 200);
      assert.ok(mainData.includes('<!DOCTYPE html>'));
      assert.ok(mainData.includes('Qui Browser'));

      // Get CSS asset
      const { res: cssRes } = await makeRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/assets/css/style.css',
        method: 'GET'
      });

      assert.strictEqual(cssRes.statusCode, 200);
      assert.strictEqual(cssRes.headers['content-type'], 'text/css; charset=utf-8');
    });

    test('should handle service worker registration', async () => {
      const { res, data } = await makeRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/sw.js',
        method: 'GET'
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['content-type'], 'application/javascript; charset=utf-8');
      assert.ok(data.includes('Service Worker'));
    });

    test('should handle manifest.json for PWA', async () => {
      const { res, data } = await makeRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/manifest.json',
        method: 'GET'
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['content-type'], 'application/json; charset=utf-8');

      const manifest = JSON.parse(data);
      assert.ok(manifest.name);
      assert.ok(manifest.short_name);
      assert.ok(Array.isArray(manifest.icons));
    });
  });

  describe('API Endpoints', () => {
    test('should get health status', async () => {
      const { res, data } = await makeRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/health',
        method: 'GET'
      });

      assert.strictEqual(res.statusCode, 200);
      const health = JSON.parse(data);
      assert.strictEqual(health.status, 'healthy');
      assert.ok(health.uptime);
      assert.ok(health.version);
    });

    test('should get metrics', async () => {
      const { res, data } = await makeRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/metrics',
        method: 'GET'
      });

      assert.strictEqual(res.statusCode, 200);
      assert.ok(data.includes('qui_browser_'));
    });

    test('should get stats with admin token', async () => {
      const { res, data } = await makeRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/stats',
        method: 'GET',
        headers: {
          Authorization: 'Bearer test-admin-token-1234567890'
        }
      });

      assert.strictEqual(res.statusCode, 200);
      const stats = JSON.parse(data);
      assert.ok(stats.requests);
      assert.ok(stats.cache);
      assert.ok(stats.health);
    });

    test('should reject stats request without valid token', async () => {
      const { res } = await makeRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/stats',
        method: 'GET',
        headers: {
          Authorization: 'Bearer invalid-token'
        }
      });

      assert.strictEqual(res.statusCode, 401);
    });
  });

  describe('Security Features', () => {
    test('should include security headers', async () => {
      const { res } = await makeRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/',
        method: 'GET'
      });

      assert.ok(res.headers['x-frame-options']);
      assert.ok(res.headers['x-content-type-options']);
      assert.ok(res.headers['x-xss-protection']);
      assert.ok(res.headers['content-security-policy']);
    });

    test('should block path traversal attempts', async () => {
      const { res } = await makeRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/../../../etc/passwd',
        method: 'GET'
      });

      assert.strictEqual(res.statusCode, 400);
    });

    test('should handle CORS properly', async () => {
      const { res } = await makeRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/',
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'GET'
        }
      });

      assert.ok(res.headers['access-control-allow-origin']);
      assert.ok(res.headers['access-control-allow-methods']);
    });
  });

  describe('Performance Features', () => {
    test('should support compression', async () => {
      const { res } = await makeRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/',
        method: 'GET',
        headers: {
          'Accept-Encoding': 'gzip, deflate, br'
        }
      });

      assert.strictEqual(res.statusCode, 200);
      assert.ok(
        res.headers['content-encoding'] === 'br' ||
          res.headers['content-encoding'] === 'gzip' ||
          res.headers['content-encoding'] === 'deflate'
      );
    });

    test('should cache static assets', async () => {
      // First request
      const { res: res1 } = await makeRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/assets/css/style.css',
        method: 'GET'
      });

      assert.strictEqual(res1.statusCode, 200);
      assert.ok(res1.headers['cache-control']);

      // Second request should be cached
      const { res: res2 } = await makeRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/assets/css/style.css',
        method: 'GET'
      });

      assert.strictEqual(res2.statusCode, 200);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent files', async () => {
      const { res } = await makeRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/non-existent-file.html',
        method: 'GET'
      });

      assert.strictEqual(res.statusCode, 404);
    });

    test('should handle malformed requests gracefully', async () => {
      const { res } = await makeRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/billing/create-checkout',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'invalid-json{'
      });

      assert.ok(res.statusCode >= 400 && res.statusCode < 500);
    });
  });
});
