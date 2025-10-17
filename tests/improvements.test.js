/**
 * Tests for New Improvements
 *
 * Tests for startup validator, URL validator, error formatter,
 * retry handler, and asset optimizer
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Import utilities
const {
  validateStartupConfiguration,
  generateSecureKey,
  INSECURE_DEFAULTS
} = require('../utils/startup-validator');

const { validateURL, sanitizeURL, parseURLSafely, isSafeRedirect, normalizeURL } = require('../utils/url-validator');

const { formatError, createErrorResponse, formatValidationErrors, isRetryableError } = require('../utils/error-formatter');

const { RetryHandler, CircuitBreaker, CircuitState } = require('../utils/retry-handler');

const { shouldCompress, parseAcceptEncoding, getBestCompression } = require('../utils/asset-optimizer');

// ==================== Startup Validator Tests ====================

describe('Startup Validator', () => {
  it('should generate secure random keys', () => {
    const key = generateSecureKey(32);
    assert.strictEqual(key.length, 64); // 32 bytes = 64 hex characters
    assert.match(key, /^[0-9a-f]+$/);
  });

  it('should detect insecure default keys', () => {
    const testEnv = {
      NODE_ENV: 'production',
      ENABLE_AUDIT_LOG: 'true',
      AUDIT_SIGNATURE_KEY: INSECURE_DEFAULTS[0]
    };

    const validation = validateStartupConfiguration({ env: testEnv });
    assert.strictEqual(validation.passed, false);
    assert.ok(validation.errors.length > 0);
  });

  it('should pass validation with secure keys', () => {
    const testEnv = {
      NODE_ENV: 'development',
      PORT: '8000',
      AUDIT_SIGNATURE_KEY: generateSecureKey(32)
    };

    const validation = validateStartupConfiguration({ env: testEnv });
    assert.strictEqual(validation.passed, true);
  });

  it('should validate port numbers', () => {
    const testEnv = {
      PORT: '99999' // Invalid port
    };

    const validation = validateStartupConfiguration({ env: testEnv });
    assert.strictEqual(validation.passed, false);
  });
});

// ==================== URL Validator Tests ====================

describe('URL Validator', () => {
  it('should validate valid URLs', () => {
    const result = validateURL('https://example.com/path');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.url.protocol, 'https:');
  });

  it('should reject dangerous schemes', () => {
    const dangerousUrls = ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd'];

    for (const url of dangerousUrls) {
      const result = validateURL(url);
      assert.strictEqual(result.valid, false);
    }
  });

  it('should reject URLs with control characters', () => {
    const result = validateURL('https://example.com/path\x00injection');
    assert.strictEqual(result.valid, false);
  });

  it('should block private IPs when requested', () => {
    const privateIPs = ['http://localhost/', 'http://127.0.0.1/', 'http://192.168.1.1/', 'http://10.0.0.1/'];

    for (const url of privateIPs) {
      const result = validateURL(url, { blockPrivateIPs: true });
      assert.strictEqual(result.valid, false);
    }
  });

  it('should sanitize URLs', () => {
    const sanitized = sanitizeURL('https://example.com/path?param=value');
    assert.ok(sanitized);
    assert.ok(sanitized.startsWith('https://'));
  });

  it('should parse URLs safely', () => {
    const result = parseURLSafely('https://example.com/path?foo=bar&baz=qux');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.params.foo, 'bar');
    assert.strictEqual(result.params.baz, 'qux');
  });

  it('should validate safe redirects', () => {
    assert.strictEqual(isSafeRedirect('https://example.com/', 'example.com'), true);
    assert.strictEqual(isSafeRedirect('http://example.com/'), false); // Not HTTPS
    assert.strictEqual(isSafeRedirect('https://evil.com/', 'example.com'), false); // Wrong domain
  });

  it('should normalize URLs', () => {
    const normalized1 = normalizeURL('https://example.com:443/path/');
    const normalized2 = normalizeURL('https://example.com/path');
    assert.strictEqual(normalized1, normalized2);
  });
});

// ==================== Error Formatter Tests ====================

describe('Error Formatter', () => {
  it('should format HTTP status codes', () => {
    const formatted = formatError(404);
    assert.strictEqual(formatted.code, 404);
    assert.strictEqual(formatted.title, 'Page Not Found');
    assert.ok(formatted.message);
  });

  it('should format Error objects', () => {
    const error = new Error('Test error');
    const formatted = formatError(error);
    assert.strictEqual(formatted.title, 'Error');
    assert.ok(formatted.message);
  });

  it('should sanitize error messages', () => {
    const error = new Error('Error at /home/user/secret.txt with token abc123def456ghi789jkl012');
    const formatted = formatError(error);
    assert.ok(!formatted.message.includes('/home/user'));
    assert.ok(!formatted.message.includes('abc123def456ghi789jkl012'));
  });

  it('should create error responses', () => {
    const response = createErrorResponse(500, { requestId: 'req-123' });
    assert.strictEqual(response.success, false);
    assert.strictEqual(response.requestId, 'req-123');
    assert.ok(response.error);
  });

  it('should format validation errors', () => {
    const errors = [
      { field: 'email', message: 'Invalid email' },
      { field: 'password', message: 'Too short' }
    ];

    const formatted = formatValidationErrors(errors);
    assert.strictEqual(formatted.type, 'validation');
    assert.strictEqual(formatted.errors.length, 2);
  });

  it('should identify retryable errors', () => {
    assert.strictEqual(isRetryableError({ code: 503 }), true);
    assert.strictEqual(isRetryableError({ code: 429 }), true);
    assert.strictEqual(isRetryableError({ code: 404 }), false);
    assert.strictEqual(isRetryableError({ code: 'NETWORK_ERROR' }), true);
  });
});

// ==================== Retry Handler Tests ====================

describe('Retry Handler', () => {
  it('should retry on retryable errors', async () => {
    const handler = new RetryHandler({ maxRetries: 3, initialDelay: 10 });

    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) {
        const error = new Error('Temporary error');
        error.code = 'ETIMEDOUT';
        throw error;
      }
      return 'success';
    };

    const result = await handler.executeWithRetry(fn);
    assert.strictEqual(result, 'success');
    assert.strictEqual(attempts, 3);
  });

  it('should not retry non-retryable errors', async () => {
    const handler = new RetryHandler({ maxRetries: 3 });

    let attempts = 0;
    const fn = async () => {
      attempts++;
      const error = new Error('Permanent error');
      error.code = 'INVALID_INPUT';
      throw error;
    };

    await assert.rejects(handler.executeWithRetry(fn), {
      message: /Permanent error/
    });

    assert.strictEqual(attempts, 1);
  });

  it('should throw after max retries exceeded', async () => {
    const handler = new RetryHandler({ maxRetries: 2, initialDelay: 10 });

    let attempts = 0;
    const fn = async () => {
      attempts++;
      const error = new Error('Always fails');
      error.code = 'ETIMEDOUT';
      throw error;
    };

    await assert.rejects(handler.executeWithRetry(fn), {
      code: 'MAX_RETRIES_EXCEEDED'
    });

    assert.strictEqual(attempts, 3); // Initial + 2 retries
  });

  it('should calculate exponential backoff delay', () => {
    const handler = new RetryHandler({
      initialDelay: 100,
      backoffMultiplier: 2,
      jitter: false
    });

    assert.strictEqual(handler.calculateDelay(0), 100);
    assert.strictEqual(handler.calculateDelay(1), 200);
    assert.strictEqual(handler.calculateDelay(2), 400);
  });
});

// ==================== Circuit Breaker Tests ====================

describe('Circuit Breaker', () => {
  it('should open after failure threshold', () => {
    const circuit = new CircuitBreaker({ failureThreshold: 3 });

    assert.strictEqual(circuit.state, CircuitState.CLOSED);

    circuit.recordFailure();
    circuit.recordFailure();
    circuit.recordFailure();

    assert.strictEqual(circuit.state, CircuitState.OPEN);
  });

  it('should transition to half-open after timeout', async () => {
    const circuit = new CircuitBreaker({
      failureThreshold: 2,
      timeout: 50 // 50ms
    });

    circuit.recordFailure();
    circuit.recordFailure();

    assert.strictEqual(circuit.state, CircuitState.OPEN);
    assert.strictEqual(circuit.canAttempt(), false);

    // Wait for timeout
    await new Promise((resolve) => setTimeout(resolve, 60));

    assert.strictEqual(circuit.canAttempt(), true);
    assert.strictEqual(circuit.state, CircuitState.HALF_OPEN);
  });

  it('should close after success threshold in half-open', () => {
    const circuit = new CircuitBreaker({
      failureThreshold: 2,
      successThreshold: 2
    });

    // Open circuit
    circuit.recordFailure();
    circuit.recordFailure();
    assert.strictEqual(circuit.state, CircuitState.OPEN);

    // Manually set to half-open
    circuit.state = CircuitState.HALF_OPEN;

    // Record successes
    circuit.recordSuccess();
    assert.strictEqual(circuit.state, CircuitState.HALF_OPEN);

    circuit.recordSuccess();
    assert.strictEqual(circuit.state, CircuitState.CLOSED);
  });

  it('should reopen if failure occurs in half-open', () => {
    const circuit = new CircuitBreaker({ failureThreshold: 2 });

    circuit.state = CircuitState.HALF_OPEN;
    circuit.recordFailure();

    assert.strictEqual(circuit.state, CircuitState.OPEN);
  });
});

// ==================== Asset Optimizer Tests ====================

describe('Asset Optimizer', () => {
  it('should identify compressible content', () => {
    assert.strictEqual(shouldCompress('a'.repeat(2000), 'text/html'), true);
    assert.strictEqual(shouldCompress('a'.repeat(2000), 'application/json'), true);
    assert.strictEqual(shouldCompress('a'.repeat(500), 'text/html'), false); // Too small
    assert.strictEqual(shouldCompress('a'.repeat(2000), 'image/png'), false); // Not compressible
  });

  it('should parse Accept-Encoding header', () => {
    const encodings = parseAcceptEncoding('gzip, deflate, br');
    assert.ok(encodings.includes('gzip'));
    assert.ok(encodings.includes('br'));
    assert.ok(encodings.includes('deflate'));
  });

  it('should select best compression', async () => {
    const content = Buffer.from('a'.repeat(2000));
    const result = await getBestCompression(content, ['br', 'gzip']);

    assert.ok(result.encoding);
    assert.ok(result.data);
    assert.ok(result.size < content.length); // Should be compressed
  });

  it('should handle content without compression support', async () => {
    const content = Buffer.from('a'.repeat(2000));
    const result = await getBestCompression(content, ['identity']);

    assert.strictEqual(result.encoding, 'identity');
    assert.strictEqual(result.size, content.length);
  });
});

console.log('All improvement tests completed!');
