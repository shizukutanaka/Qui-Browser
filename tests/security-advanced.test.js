const test = require('node:test');
const assert = require('node:assert');

const LightweightBrowserServer = require('../server-modular');

let serverInstance;
let httpServer;
let baseUrl;

test.before(async () => {
  process.env.PORT = '0';
  process.env.NODE_ENV = 'test';
  process.env.RATE_LIMIT_MAX = '500';

  serverInstance = new LightweightBrowserServer();
  httpServer = await serverInstance.start();
  const address = httpServer.address();
  const port = typeof address === 'object' && address ? address.port : 8000;
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  if (serverInstance && typeof serverInstance.stopHealthMonitor === 'function') {
    serverInstance.stopHealthMonitor();
  }
  if (httpServer) {
    await new Promise(resolve => {
      const timeout = setTimeout(() => {
        resolve();
      }, 5000);
      httpServer.close(() => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
});

test('rejects URI that is too long', async () => {
  const longPath = '/test' + 'a'.repeat(2100);
  const response = await fetch(`${baseUrl}${longPath}`);

  assert.strictEqual(response.status, 414, 'Should return 414 URI Too Long');
  const body = await response.json();
  assert.strictEqual(body.error, 'URI Too Long');
});

test('rejects unsupported HTTP methods', async () => {
  const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];

  for (const method of methods) {
    const response = await fetch(`${baseUrl}/`, { method });
    assert.strictEqual(response.status, 405, `Should reject ${method} method`);

    const allowHeader = response.headers.get('allow');
    assert.ok(allowHeader.includes('GET'), 'Allow header should include GET');
    assert.ok(allowHeader.includes('HEAD'), 'Allow header should include HEAD');
    assert.ok(allowHeader.includes('OPTIONS'), 'Allow header should include OPTIONS');
  }
});

test('handles OPTIONS requests correctly', async () => {
  const response = await fetch(`${baseUrl}/`, { method: 'OPTIONS' });

  assert.strictEqual(response.status, 204, 'OPTIONS should return 204');

  const allowHeader = response.headers.get('allow');
  assert.ok(allowHeader, 'Should include Allow header');
  assert.ok(allowHeader.includes('GET'), 'Allow header should include GET');

  const corsMethodsHeader = response.headers.get('access-control-allow-methods');
  assert.ok(corsMethodsHeader, 'Should include CORS methods header');

  const maxAgeHeader = response.headers.get('access-control-max-age');
  assert.strictEqual(maxAgeHeader, '86400', 'Should cache preflight for 24 hours');
});

test('HEAD requests work correctly', async () => {
  const response = await fetch(`${baseUrl}/health`, { method: 'HEAD' });

  assert.strictEqual(response.status, 200, 'HEAD request should succeed');

  // HEADリクエストではボディがない
  const text = await response.text();
  assert.strictEqual(text, '', 'HEAD response should have no body');

  // ヘッダーは存在する
  const contentType = response.headers.get('content-type');
  assert.ok(contentType, 'Should include Content-Type header');
});

test('includes request ID in all responses', async () => {
  const response = await fetch(`${baseUrl}/health`);
  const requestId = response.headers.get('x-request-id');

  assert.ok(requestId, 'Should include request ID');
  assert.ok(requestId.length > 30, 'Request ID should be a UUID');

  // 2回目のリクエストで異なるIDが返ってくることを確認
  const response2 = await fetch(`${baseUrl}/health`);
  const requestId2 = response2.headers.get('x-request-id');

  assert.notStrictEqual(requestId, requestId2, 'Each request should have unique ID');
});

test('handles concurrent different method requests', async () => {
  const requests = [
    fetch(`${baseUrl}/health`, { method: 'GET' }),
    fetch(`${baseUrl}/health`, { method: 'HEAD' }),
    fetch(`${baseUrl}/`, { method: 'OPTIONS' }),
    fetch(`${baseUrl}/api/stats`, { method: 'GET' })
  ];

  const responses = await Promise.all(requests);

  assert.strictEqual(responses[0].status, 200, 'GET should succeed');
  assert.strictEqual(responses[1].status, 200, 'HEAD should succeed');
  assert.strictEqual(responses[2].status, 204, 'OPTIONS should succeed');
  assert.strictEqual(responses[3].status, 200, 'GET stats should succeed');
});

test('Security: Blocks NULL byte injection', async () => {
  const maliciousPaths = ['/index.html\x00.jpg', '/assets/test\x00.txt'];

  for (const path of maliciousPaths) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.strictEqual(response.status, 404, `NULL byte injection path ${path} should return 404`);
  }
});

test('Security: Blocks CRLF injection in paths', async () => {
  const maliciousPaths = ['/index.html\r\nSet-Cookie: malicious=true', '/test\r\n\r\n<script>alert(1)</script>'];

  for (const path of maliciousPaths) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.strictEqual(response.status, 404, 'CRLF injection path should return 404');
  }
});

test('Security: CSP headers are strict', async () => {
  process.env.ENABLE_SECURITY_HEADERS = 'true';
  const response = await fetch(`${baseUrl}/`);
  const csp = response.headers.get('content-security-policy');

  if (csp) {
    assert.ok(!csp.includes('unsafe-inline'), 'CSP should not allow unsafe-inline');
    assert.ok(!csp.includes('unsafe-eval'), 'CSP should not allow unsafe-eval');
    assert.ok(csp.includes("default-src 'self'"), 'CSP should restrict default-src');
  }
});

test('Security: Request IDs are UUIDs', async () => {
  const response = await fetch(`${baseUrl}/health`);
  const requestId = response.headers.get('x-request-id');

  assert.ok(requestId, 'Request ID must be present');

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.ok(uuidRegex.test(requestId), 'Request ID should be a valid UUID v4');
});

test('Security: ETag validation works correctly', async () => {
  const response1 = await fetch(`${baseUrl}/`);
  const etag1 = response1.headers.get('etag');

  assert.ok(etag1, 'ETag should be present');

  const response2 = await fetch(`${baseUrl}/`, {
    headers: { 'If-None-Match': etag1 }
  });

  assert.strictEqual(response2.status, 304, 'Valid ETag should return 304 Not Modified');
});
