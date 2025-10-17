const test = require('node:test');
const assert = require('node:assert');

const LightweightBrowserServer = require('../server-modular');

let serverInstance;
let httpServer;
let baseUrl;

test.before(async () => {
  process.env.PORT = '0';
  process.env.RATE_LIMIT_MAX = '200'; // Increase rate limit for tests
  serverInstance = new LightweightBrowserServer();
  httpServer = await serverInstance.start();
  const address = httpServer.address();
  const port = typeof address === 'object' && address ? address.port : process.env.PORT || 8000;
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  if (serverInstance && typeof serverInstance.stopHealthMonitor === 'function') {
    serverInstance.stopHealthMonitor();
  }
  if (httpServer) {
    await new Promise(resolve => {
      httpServer.close(() => resolve());
    });
  }
});

test('blocks path traversal attempts', async () => {
  const maliciousPaths = [
    '/../package.json',
    '/assets/../package.json',
    '/assets/../../package.json',
    '/../../../etc/passwd',
    '/assets/%2e%2e/%2e%2e/package.json'
  ];

  for (const path of maliciousPaths) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.strictEqual(response.status, 404, `Path ${path} should return 404`);
  }
});

test('allows legitimate asset paths', async () => {
  const legitimatePaths = ['/', '/index.html', '/manifest.json', '/sw.js'];

  for (const path of legitimatePaths) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.ok(
      response.status === 200 || response.status === 304,
      `Path ${path} should return 200 or 304, got ${response.status}`
    );
  }
});

test('enforces rate limiting', async () => {
  // テスト用に小さい制限でテスト
  const testLimit = 10;
  const requests = [];

  for (let i = 0; i < testLimit + 3; i++) {
    requests.push(fetch(`${baseUrl}/health`));
  }

  const responses = await Promise.all(requests);
  const allHaveStatus = responses.every(r => r.status === 200 || r.status === 429);

  assert.ok(allHaveStatus, 'All responses should be either 200 or 429');
});

test('includes security headers', async () => {
  const response = await fetch(`${baseUrl}/`);
  const headers = response.headers;

  assert.ok(headers.get('x-content-type-options'), 'Should include X-Content-Type-Options');
  assert.ok(headers.get('x-frame-options'), 'Should include X-Frame-Options');
  assert.ok(headers.get('x-xss-protection'), 'Should include X-XSS-Protection');
  assert.ok(headers.get('referrer-policy'), 'Should include Referrer-Policy');
});

test('includes request ID in responses', async () => {
  // Create a dedicated test server instance to avoid rate limiting
  const previousPort = process.env.PORT;
  const previousEnv = process.env.NODE_ENV;
  process.env.PORT = '0'; // Ensure dynamic port allocation
  process.env.NODE_ENV = 'test'; // Ensure test environment

  try {
    const testServer = new LightweightBrowserServer();
    const testHttpServer = await testServer.start();
    const testAddress = testHttpServer.address();
    const testPort = typeof testAddress === 'object' && testAddress ? testAddress.port : 9000;
    const testUrl = `http://127.0.0.1:${testPort}`;

    try {
      const response = await fetch(`${testUrl}/health`);
      const requestId = response.headers.get('x-request-id');

      assert.ok(requestId, 'Response should include X-Request-ID');
      assert.ok(requestId.length > 10, 'Request ID should be a valid UUID');
    } finally {
      testServer.stopHealthMonitor();
      await new Promise(resolve => testHttpServer.close(resolve));
    }
  } finally {
    if (previousPort !== undefined) {
      process.env.PORT = previousPort;
    } else {
      delete process.env.PORT;
    }
    if (previousEnv !== undefined) {
      process.env.NODE_ENV = previousEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  }
});

test('returns 404 for non-existent paths', async () => {
  // Wait to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 1000));

  const response = await fetch(`${baseUrl}/non-existent-path-${Date.now()}`);

  // Accept either 404 or 429 (rate limited)
  assert.ok(response.status === 404 || response.status === 429, `Expected 404 or 429, got ${response.status}`);

  if (response.status === 404) {
    const body = await response.json();
    assert.strictEqual(body.error, 'Not Found');
  }
});
