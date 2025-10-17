/**
 * Tests for PWA Integration
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const PWAIntegration = require('../lib/pwa');

// Mock configuration
const mockConfig = {
  pwa: {
    enabled: true,
    manifest: {
      name: 'Test Browser',
      shortName: 'Test',
      description: 'Test PWA',
      themeColor: '#000000',
      backgroundColor: '#ffffff',
      display: 'standalone',
      startUrl: '/'
    },
    serviceWorker: {
      enabled: true,
      scope: '/',
      cacheName: 'test-v1.0.0'
    }
  }
};

test('PWA Integration', async (t) => {
  let tempDir;
  let pwaIntegration;

  t.before(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qui-pwa-test-'));

    // Create mock PWA files
    await fs.mkdir(path.join(tempDir, 'js'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'manifest.json'), '{"name":"Test"}');
    await fs.writeFile(path.join(tempDir, 'sw.js'), 'console.log("SW");');
    await fs.writeFile(path.join(tempDir, 'offline.html'), '<html>Offline</html>');
    await fs.writeFile(path.join(tempDir, 'js', 'pwa.js'), 'console.log("PWA");');

    // Override the public path for testing
    PWAIntegration.prototype.publicPath = tempDir;

    pwaIntegration = new PWAIntegration(mockConfig);
  });

  t.after(async () => {
    if (tempDir) {
      try {
        await fs.rmdir(tempDir, { recursive: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  await t.test('PWAIntegration initializes correctly', () => {
    assert(pwaIntegration instanceof PWAIntegration);
    assert.strictEqual(typeof pwaIntegration.config, 'object');
    assert.strictEqual(typeof pwaIntegration.publicPath, 'string');
  });

  await t.test('initialize() sets up PWA when enabled', async () => {
    await pwaIntegration.initialize();
    assert(pwaIntegration.isInitialized);
  });

  await t.test('getPWAStatus() returns correct status', () => {
    const status = pwaIntegration.getPWAStatus();

    assert.strictEqual(typeof status, 'object');
    assert.strictEqual(status.enabled, true);
    assert.strictEqual(status.manifest, '/manifest.json');
    assert.strictEqual(status.serviceWorker, '/sw.js');
    assert.strictEqual(status.offlinePage, '/offline.html');
    assert(typeof status.installSnippet === 'string');
  });

  await t.test('getPWAInstallSnippet() generates HTML snippet', () => {
    const snippet = pwaIntegration.getPWAInstallSnippet();

    assert(typeof snippet === 'string');
    assert(snippet.includes('manifest'));
    assert(snippet.includes('theme-color'));
    assert(snippet.includes('/js/pwa.js'));
  });

  await t.test('handlePWARequest() serves manifest', async () => {
    const mockReq = { headers: { host: 'localhost' } };
    let responseSent = false;
    let responseData = null;

    const mockRes = {
      writeHead: () => {},
      end: (data) => {
        responseSent = true;
        responseData = data;
      },
      setHeader: () => {}
    };

    const result = await pwaIntegration.handlePWARequest(mockReq, mockRes, '/manifest.json');

    assert.strictEqual(result, true);
    assert(responseSent);
    assert(responseData);

    const manifest = JSON.parse(responseData);
    assert.strictEqual(manifest.name, 'Test Browser');
  });

  await t.test('handlePWARequest() serves service worker', async () => {
    const mockReq = {};
    let responseSent = false;
    let responseData = null;

    const mockRes = {
      writeHead: () => {},
      end: (data) => {
        responseSent = true;
        responseData = data;
      },
      setHeader: () => {}
    };

    const result = await pwaIntegration.handlePWARequest(mockReq, mockRes, '/sw.js');

    assert.strictEqual(result, true);
    assert(responseSent);
    assert.strictEqual(responseData, 'console.log("SW");');
  });

  await t.test('handlePWARequest() serves offline page', async () => {
    const mockReq = {};
    let responseSent = false;
    let responseData = null;

    const mockRes = {
      writeHead: () => {},
      end: (data) => {
        responseSent = true;
        responseData = data;
      },
      setHeader: () => {}
    };

    const result = await pwaIntegration.handlePWARequest(mockReq, mockRes, '/offline.html');

    assert.strictEqual(result, true);
    assert(responseSent);
    assert.strictEqual(responseData, '<html>Offline</html>');
  });

  await t.test('handlePWARequest() serves PWA JS', async () => {
    const mockReq = {};
    let responseSent = false;
    let responseData = null;

    const mockRes = {
      writeHead: () => {},
      end: (data) => {
        responseSent = true;
        responseData = data;
      },
      setHeader: () => {}
    };

    const result = await pwaIntegration.handlePWARequest(mockReq, mockRes, '/js/pwa.js');

    assert.strictEqual(result, true);
    assert(responseSent);
    assert.strictEqual(responseData, 'console.log("PWA");');
  });

  await t.test('handlePWARequest() serves icons', async () => {
    const mockReq = {};
    let responseSent = false;

    const mockRes = {
      writeHead: () => {},
      end: () => {
        responseSent = true;
      },
      setHeader: () => {}
    };

    const result = await pwaIntegration.handlePWARequest(mockReq, mockRes, '/icons/icon-192.png');

    assert.strictEqual(result, true);
    assert(responseSent);
  });

  await t.test('handlePWAApiRequest() handles PWA status', async () => {
    const mockReq = { method: 'GET' };
    let responseSent = false;
    let responseData = null;

    const mockRes = {
      writeHead: () => {},
      end: (data) => {
        responseSent = true;
        responseData = data;
      },
      setHeader: () => {}
    };

    const result = await pwaIntegration.handlePWAApiRequest(mockReq, mockRes, '/api/pwa/status', new URLSearchParams());

    assert.strictEqual(result, true);
    assert(responseSent);
    const status = JSON.parse(responseData);
    assert.strictEqual(typeof status, 'object');
  });

  await t.test('handlePWAApiRequest() handles push subscription', async () => {
    const mockReq = {
      method: 'POST',
      on: (event, callback) => {
        if (event === 'data') {
          callback(JSON.stringify({ endpoint: 'test' }));
        } else if (event === 'end') {
          callback();
        }
      }
    };
    let responseSent = false;

    const mockRes = {
      writeHead: () => {},
      end: () => {
        responseSent = true;
      },
      setHeader: () => {}
    };

    const result = await pwaIntegration.handlePWAApiRequest(mockReq, mockRes, '/api/push-subscription', new URLSearchParams());

    assert.strictEqual(result, true);
    assert(responseSent);
  });

  await t.test('handlePWAApiRequest() returns false for unknown routes', async () => {
    const mockReq = { method: 'GET' };
    const mockRes = {};

    const result = await pwaIntegration.handlePWAApiRequest(mockReq, mockRes, '/api/unknown', new URLSearchParams());

    assert.strictEqual(result, false);
  });

  await t.test('addPWAHeaders() adds appropriate headers', () => {
    const mockRes = {
      setHeader: function(key, value) {
        this.headers = this.headers || {};
        this.headers[key] = value;
      }
    };

    pwaIntegration.addPWAHeaders(mockRes);

    assert(mockRes.headers['theme-color']);
  });
});

// Test disabled PWA
test('PWA Integration (Disabled)', async (t) => {
  const disabledConfig = {
    pwa: {
      enabled: false
    }
  };

  const pwaIntegration = new PWAIntegration(disabledConfig);

  await t.test('Disabled PWA returns false for all requests', async () => {
    const mockReq = {};
    const mockRes = {};

    const result1 = await pwaIntegration.handlePWARequest(mockReq, mockRes, '/manifest.json');
    assert.strictEqual(result1, false);

    const result2 = await pwaIntegration.handlePWAApiRequest(mockReq, mockRes, '/api/pwa/status', new URLSearchParams());
    assert.strictEqual(result2, false);
  });

  await t.test('Disabled PWA returns empty install snippet', () => {
    const snippet = pwaIntegration.getPWAInstallSnippet();
    assert.strictEqual(snippet, '');
  });

  await t.test('Disabled PWA status shows disabled', () => {
    const status = pwaIntegration.getPWAStatus();
    assert.strictEqual(status.enabled, false);
  });
});
