/**
 * Tests for Middleware Module
 */

const { test } = require('node:test');
const assert = require('node:assert');
const {
  sendJsonResponse,
  sendJsonError,
  getSecurityHeaders,
  createSecurityContext,
  toError,
  getErrorStatusCode,
  sanitizeString,
  sanitizeHeadersForLog,
  sanitizeQueryForLog,
  RateLimiter,
  createLoggingMiddleware,
  createCompressionMiddleware
} = require('../lib/middleware');

test('Middleware Module', async (t) => {
  await t.test('sendJsonResponse() sends JSON responses', () => {
    const mockReq = { method: 'GET' };
    const mockRes = {
      writeHead: function(status, headers) {
        this.statusCode = status;
        this.headersSent = true;
        this.sentHeaders = headers;
      },
      end: function(data) {
        this.responseData = data;
      },
      setHeader: function() {}
    };

    const testData = { message: 'test', count: 42 };
    sendJsonResponse(mockReq, mockRes, 200, testData);

    assert.strictEqual(mockRes.statusCode, 200);
    assert(mockRes.sentHeaders['Content-Type'].includes('application/json'));
    assert(mockRes.sentHeaders['Cache-Control']);
    assert(mockRes.sentHeaders['Content-Length']);

    const response = JSON.parse(mockRes.responseData);
    assert.deepStrictEqual(response, testData);
  });

  await t.test('sendJsonError() sends error responses', () => {
    const mockReq = { method: 'GET' };
    const mockRes = {
      writeHead: function(status, headers) {
        this.statusCode = status;
        this.headersSent = true;
        this.sentHeaders = headers;
      },
      end: function(data) {
        this.responseData = data;
      },
      setHeader: function() {},
      getHeader: () => 'test-request-id'
    };

    sendJsonError(mockReq, mockRes, 400, 'Test error', { code: 'TEST_ERROR' });

    assert.strictEqual(mockRes.statusCode, 400);
    const response = JSON.parse(mockRes.responseData);
    assert.strictEqual(response.error, 'Test error');
    assert.strictEqual(response.code, 'TEST_ERROR');
    assert(response.requestId);
  });

  await t.test('getSecurityHeaders() returns security headers', () => {
    const headers = getSecurityHeaders();

    assert.strictEqual(typeof headers, 'object');
    assert(headers.hasOwnProperty('X-Content-Type-Options'));
    assert(headers.hasOwnProperty('X-Frame-Options'));
    assert(headers.hasOwnProperty('X-XSS-Protection'));
    assert(headers.hasOwnProperty('Referrer-Policy'));
  });

  await t.test('createSecurityContext() creates context objects', () => {
    const mockReq = {
      headers: { origin: 'http://example.com', host: 'localhost' },
      method: 'GET',
      socket: { encrypted: false }
    };

    const context = createSecurityContext(mockReq);

    assert.strictEqual(typeof context, 'object');
    assert.strictEqual(context.requestOrigin, 'http://example.com');
    assert.strictEqual(context.requestHost, 'localhost');
    assert.strictEqual(context.requestMethod, 'GET');
    assert.strictEqual(context.isTls, false);
  });

  await t.test('toError() converts values to Error objects', () => {
    // Test with Error object
    const existingError = new Error('test');
    assert.strictEqual(toError(existingError), existingError);

    // Test with string
    const stringError = toError('test message');
    assert(stringError instanceof Error);
    assert.strictEqual(stringError.message, 'test message');

    // Test with object
    const objectError = toError({ code: 'TEST', message: 'test' });
    assert(objectError instanceof Error);
    assert(objectError.message.includes('code'));

    // Test with undefined/null
    const defaultError = toError(null, 'default message');
    assert(defaultError instanceof Error);
    assert.strictEqual(defaultError.message, 'default message');
  });

  await t.test('getErrorStatusCode() extracts status codes', () => {
    const errorWithStatus = Object.assign(new Error('test'), { statusCode: 404 });
    assert.strictEqual(getErrorStatusCode(errorWithStatus), 404);

    const errorWithoutStatus = new Error('test');
    assert.strictEqual(getErrorStatusCode(errorWithoutStatus), undefined);

    const plainObject = { message: 'test' };
    assert.strictEqual(getErrorStatusCode(plainObject), undefined);
  });

  await t.test('sanitizeString() truncates long strings', () => {
    const shortString = 'hello';
    assert.strictEqual(sanitizeString(shortString), 'hello');

    const longString = 'a'.repeat(300);
    const sanitized = sanitizeString(longString, 50);
    assert.strictEqual(sanitized.length, 50);
    assert(sanitized.endsWith('…'));
  });

  await t.test('sanitizeHeadersForLog() sanitizes headers', () => {
    const headers = {
      'host': 'example.com',
      'user-agent': 'test-agent',
      'authorization': 'secret-token',
      'accept': 'application/json',
      'invalid-header': ''
    };

    const sanitized = sanitizeHeadersForLog(headers);

    assert(sanitized.hasOwnProperty('host'));
    assert(sanitized.hasOwnProperty('user-agent'));
    assert(sanitized.hasOwnProperty('accept'));
    assert(!sanitized.hasOwnProperty('authorization'));
    assert(!sanitized.hasOwnProperty('invalid-header'));
  });

  await t.test('sanitizeQueryForLog() sanitizes query parameters', () => {
    const query = {
      search: 'test query',
      page: 1,
      limit: '10',
      token: 'secret',
      empty: ''
    };

    const sanitized = sanitizeQueryForLog(query);

    assert(sanitized.hasOwnProperty('search'));
    assert(sanitized.hasOwnProperty('page'));
    assert(sanitized.hasOwnProperty('limit'));
    assert(!sanitized.hasOwnProperty('token'));
    assert(!sanitized.hasOwnProperty('empty'));
  });

  await t.test('RateLimiter class works correctly', () => {
    const limiter = new RateLimiter({
      maxRequests: 3,
      windowMs: 1000
    });

    // Should allow initial requests
    assert(limiter.check('user1'));
    assert(limiter.check('user1'));
    assert(limiter.check('user1'));

    // Should block further requests
    assert(!limiter.check('user1'));

    // Should allow different users
    assert(limiter.check('user2'));

    // Reset should work
    limiter.reset('user1');
    assert(limiter.check('user1'));
  });

  await t.test('createLoggingMiddleware() creates logging function', () => {
    const middleware = createLoggingMiddleware({ maxRequests: 1000 });

    assert.strictEqual(typeof middleware, 'function');

    const mockReq = {
      method: 'GET',
      url: '/test',
      headers: { 'user-agent': 'test' },
      connection: { remoteAddress: '127.0.0.1' }
    };

    const mockRes = {
      setHeader: () => {},
      getHeader: () => 'req-123'
    };

    let nextCalled = false;
    const next = () => { nextCalled = true; };

    middleware(mockReq, mockRes, next);

    assert(nextCalled);
  });

  await t.test('createCompressionMiddleware() creates compression function', () => {
    const middleware = createCompressionMiddleware();

    assert.strictEqual(typeof middleware, 'function');

    const mockReq = {
      method: 'GET',
      headers: { 'accept-encoding': 'gzip' }
    };

    const mockRes = {
      writeHead: function() {
        this.headersSent = true;
      },
      end: function(data) {
        this.responseData = data;
      },
      setHeader: function(key, value) {
        this.headers = this.headers || {};
        this.headers[key] = value;
      },
      getHeader: function(key) {
        return this.headers?.[key];
      }
    };

    let nextCalled = false;
    const next = () => { nextCalled = true; return Promise.resolve(); };

    // Test with compressible content
    middleware(mockReq, mockRes, next);

    assert(nextCalled);
  });

  await t.test('RateLimiter handles edge cases', () => {
    const limiter = new RateLimiter({ maxRequests: 0, windowMs: 1000 });

    // Should not allow any requests with 0 maxRequests
    assert(!limiter.check('user1'));

    const limiter2 = new RateLimiter({ maxRequests: 1, windowMs: 0 });

    // Should handle zero window
    assert(limiter2.check('user1'));
    assert(!limiter2.check('user1'));
  });

  await t.test('sanitizeString() handles edge cases', () => {
    assert.strictEqual(sanitizeString(null), undefined);
    assert.strictEqual(sanitizeString(undefined), undefined);
    assert.strictEqual(sanitizeString(''), '');
    assert.strictEqual(sanitizeString('short'), 'short');

    const exactLength = 'a'.repeat(200);
    assert.strictEqual(sanitizeString(exactLength, 200), exactLength);
  });

  await t.test('sanitizeHeadersForLog() handles edge cases', () => {
    assert.strictEqual(sanitizeHeadersForLog(null), undefined);
    assert.strictEqual(sanitizeHeadersForLog({}), undefined);

    const headersWithNull = { 'host': null, 'user-agent': undefined, 'accept': '' };
    const result = sanitizeHeadersForLog(headersWithNull);
    assert(!result.hasOwnProperty('host'));
    assert(!result.hasOwnProperty('user-agent'));
    assert(!result.hasOwnProperty('accept'));
  });

  await t.test('sanitizeQueryForLog() handles edge cases', () => {
    assert.strictEqual(sanitizeQueryForLog(null), undefined);
    assert.strictEqual(sanitizeQueryForLog({}), undefined);

    const queryWithNulls = {
      valid: 'value',
      empty: '',
      null: null,
      undefined: undefined,
      number: 42,
      boolean: true
    };

    const result = sanitizeQueryForLog(queryWithNulls);
    assert(result.hasOwnProperty('valid'));
    assert(result.hasOwnProperty('number'));
    assert(result.hasOwnProperty('boolean'));
    assert(!result.hasOwnProperty('empty'));
    assert(!result.hasOwnProperty('null'));
    assert(!result.hasOwnProperty('undefined'));
  });

  await t.test('getSecurityHeaders() includes all required headers', () => {
    const headers = getSecurityHeaders();

    const requiredHeaders = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection',
      'Referrer-Policy'
    ];

    for (const header of requiredHeaders) {
      assert(headers.hasOwnProperty(header), `Missing required header: ${header}`);
      assert.strictEqual(typeof headers[header], 'string');
      assert(headers[header].length > 0);
    }
  });

  await t.test('sendJsonResponse() handles HEAD requests', () => {
    const mockReq = { method: 'HEAD' };
    const mockRes = {
      writeHead: function(status, headers) {
        this.statusCode = status;
        this.headersSent = true;
      },
      end: function(data) {
        this.responseData = data;
        this.endedWithData = data !== undefined;
      },
      setHeader: function() {}
    };

    sendJsonResponse(mockReq, mockRes, 200, { test: 'data' });

    assert.strictEqual(mockRes.statusCode, 200);
    assert(!mockRes.endedWithData);
  });

  await t.test('sendJsonResponse() handles undefined payload', () => {
    const mockReq = { method: 'GET' };
    const mockRes = {
      writeHead: function() { this.headersSent = true; },
      end: function(data) {
        this.responseData = data;
      },
      setHeader: function() {}
    };

    sendJsonResponse(mockReq, mockRes, 204, undefined);

    assert.strictEqual(mockRes.responseData, '');
  });
});
