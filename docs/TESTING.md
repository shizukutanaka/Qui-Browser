# Testing Guide

Comprehensive testing guide for Qui Browser.

## Table of Contents

- [Test Categories](#test-categories)
- [Running Tests](#running-tests)
- [Test Scripts Reference](#test-scripts-reference)
- [Writing Tests](#writing-tests)
- [Continuous Integration](#continuous-integration)
- [Troubleshooting](#troubleshooting)

## Test Categories

### 1. Unit Tests

Test individual components in isolation.

**Files:**

- `tests/compression.test.js` - Compression utilities (28 tests)
- `tests/endpoint-rate-limiter.test.js` - Rate limiting (10 tests)
- `tests/smart-cache.test.js` - Cache strategies (20 tests)
- `tests/websocket-simple.test.js` - WebSocket functionality (6 tests)

**Coverage:** Core utilities, compression, caching, rate limiting

### 2. Integration Tests

Test interaction between multiple components.

**Files:**

- `tests/integration.test.js` - End-to-end workflows
- `tests/utilities-integration.test.js` - Utility coordination (8 tests)
- `tests/api-basic.test.js` - API endpoints (8 tests)

**Coverage:** Full request lifecycle, utility interaction, API flows

### 3. Performance Tests

Test system performance under load.

**Files:**

- `tests/performance.test.js` - Concurrent requests, memory usage (9 tests)

**Coverage:** Load handling, cache efficiency, memory management

### 4. Security Tests

Test security measures and vulnerabilities.

**Files:**

- `tests/security.test.js` - Basic security (7 tests)
- `tests/security-advanced.test.js` - Advanced security (4 tests)

**Coverage:** Path traversal, rate limiting, headers, input validation

### 5. Server Tests

Test server functionality.

**Files:**

- `tests/server.test.js` - Server core functionality (7 tests)
- `tests/middleware.test.js` - Middleware pipeline
- `tests/monitoring.test.js` - Metrics and monitoring

**Coverage:** Request handling, responses, static file serving

## Running Tests

### Quick Start

```bash
# Run main test suite (62 tests)
npm test

# Run all tests (100+ tests)
npm run test:all

# Run with coverage report
npm run test:coverage
```

### By Category

```bash
# Unit tests
npm run test:compression
npm run test:utilities
npm run test:websocket

# Integration tests
npm run test:integration
npm run test:utilities:integration
npm run test:api

# Performance tests
npm run test:performance

# Security tests
npm run test:security

# Server tests
npm run test:middleware
npm run test:monitoring
```

### Watch Mode

For development, you can watch test files:

```bash
# Watch a specific test file
node --test --watch tests/compression.test.js

# Watch all tests
node --test --watch tests/*.test.js
```

## Test Scripts Reference

### Core Test Scripts

| Script                  | Description          | Tests | Duration |
| ----------------------- | -------------------- | ----- | -------- |
| `npm test`              | Main test suite      | 62    | ~12s     |
| `npm run test:all`      | All tests            | 100+  | ~3m      |
| `npm run test:coverage` | With coverage report | All   | ~3m      |

### Category Scripts

| Script                       | Description         | Tests    | Duration |
| ---------------------------- | ------------------- | -------- | -------- |
| `test:compression`           | Compression tests   | 28       | ~1s      |
| `test:websocket`             | WebSocket tests     | 6        | ~0.5s    |
| `test:security`              | Security tests      | 11       | ~2s      |
| `test:performance`           | Performance tests   | 9        | ~10s     |
| `test:utilities`             | Utility unit tests  | 30       | ~2s      |
| `test:utilities:integration` | Utility integration | 8        | ~1s      |
| `test:integration`           | Integration tests   | 8+       | ~3s      |
| `test:api`                   | API endpoint tests  | 8        | ~1s      |
| `test:middleware`            | Middleware tests    | Variable | Variable |
| `test:monitoring`            | Monitoring tests    | Variable | Variable |

### Utility Scripts

| Script                        | Description                       |
| ----------------------------- | --------------------------------- |
| `npm run coverage:report`     | Generate detailed coverage report |
| `npm run benchmark`           | Run performance benchmarks        |
| `npm run benchmark:utilities` | Benchmark utilities               |

## Writing Tests

### Test Structure

Use Node.js native test runner:

```javascript
const { test, describe, before, after } = require('node:test');
const assert = require('assert');

describe('Feature Name', () => {
  let testData;

  before(async () => {
    // Setup
    testData = await setupTestData();
  });

  after(() => {
    // Cleanup
    cleanupTestData(testData);
  });

  test('should do something', () => {
    const result = someFunction();
    assert.strictEqual(result, expected);
  });

  test('should handle errors', () => {
    assert.throws(() => functionThatThrows(), {
      name: 'Error',
      message: 'Expected error'
    });
  });
});
```

### Best Practices

#### 1. Test Isolation

- Each test should be independent
- Clean up resources after each test
- Don't depend on test execution order

```javascript
test('isolated test', async () => {
  const resource = await createResource();

  try {
    // Test logic
    const result = await testFunction(resource);
    assert.ok(result);
  } finally {
    // Always cleanup
    await cleanupResource(resource);
  }
});
```

#### 2. Descriptive Test Names

- Use clear, descriptive names
- Include expected behavior
- Follow pattern: "should [expected behavior] when [condition]"

```javascript
test('should return 404 when resource not found', async () => {
  // Test implementation
});

test('should cache response when TTL is set', async () => {
  // Test implementation
});
```

#### 3. Server Setup/Teardown

For tests requiring a server:

```javascript
const LightweightBrowserServer = require('../server-lightweight');

let serverInstance;
let httpServer;
let port;

before(async () => {
  process.env.PORT = '0'; // Random available port
  process.env.NODE_ENV = 'test';

  serverInstance = new LightweightBrowserServer();
  httpServer = await serverInstance.start();
  port = httpServer.address().port;
});

after(() => {
  if (httpServer) {
    return new Promise(resolve => {
      httpServer.close(() => resolve());
    });
  }
});
```

#### 4. Async Testing

Always return promises or use async/await:

```javascript
test('async operation', async () => {
  const result = await asyncFunction();
  assert.strictEqual(result, expected);
});

test('promise-based', () => {
  return promiseFunction().then(result => {
    assert.strictEqual(result, expected);
  });
});
```

#### 5. Error Handling

Test both success and error cases:

```javascript
test('should handle success', async () => {
  const result = await operation();
  assert.ok(result.success);
});

test('should handle errors gracefully', async () => {
  await assert.rejects(() => failingOperation(), {
    name: 'ValidationError',
    message: /invalid input/
  });
});
```

### Testing Utilities

#### Rate Limiter

```javascript
const EndpointRateLimiter = require('../utils/endpoint-rate-limiter');

test('rate limiter test', () => {
  const limiter = new EndpointRateLimiter({
    defaultWindow: 60000,
    defaultMaxRequests: 10
  });

  // Test rate limiting
  const result = limiter.checkLimit('/api/test', '127.0.0.1');
  assert.strictEqual(result.allowed, true);

  // Cleanup
  limiter.destroy();
});
```

#### Smart Cache

```javascript
const SmartCache = require('../utils/smart-cache');

test('cache test', () => {
  const cache = new SmartCache({
    maxSize: 100,
    strategy: 'lru'
  });

  cache.set('key', 'value');
  assert.strictEqual(cache.get('key'), 'value');

  // Cleanup
  cache.destroy();
});
```

#### Advanced Monitoring

```javascript
const AdvancedMonitoring = require('../utils/advanced-monitoring');

test('monitoring test', () => {
  const monitoring = new AdvancedMonitoring();

  monitoring.incrementCounter('test_metric', 1);

  const metrics = monitoring.getMetrics();
  assert.strictEqual(metrics.counters.test_metric, 1);

  // Cleanup
  monitoring.destroy();
});
```

## Continuous Integration

### GitHub Actions

Tests run automatically on:

- Push to any branch
- Pull requests
- Scheduled daily builds

**Workflow:** `.github/workflows/ci.yml`

```yaml
- name: Run tests
  run: npm test

- name: Run security tests
  run: npm run test:security

- name: Generate coverage
  run: npm run test:coverage
```

### Pre-commit Hooks

Tests run locally before commits:

```json
{
  "prepare": "npm run format:check && npm run lint"
}
```

### Build Checks

Full test suite runs before builds:

```bash
npm run build:check
# Runs: lint + format:check + test + docs:check
```

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

**Error:**

```
Error: listen EADDRINUSE: address already in use :::8000
```

**Solution:**

- Tests use `PORT=0` for random ports
- Ensure `process.env.PORT = '0'` in test setup
- Check for hanging processes: `netstat -ano | findstr :8000`

#### 2. Test Timeouts

**Error:**

```
Error: test timed out after 30000ms
```

**Solution:**

- Increase timeout for slow tests
- Check for missing cleanup (intervals, timers)
- Ensure all async operations complete

```javascript
test('slow test', { timeout: 60000 }, async () => {
  // Long-running test
});
```

#### 3. Memory Leaks

**Symptoms:**

- Tests slow down over time
- Increasing memory usage
- Test failures after many iterations

**Solution:**

- Always call `destroy()` on utilities
- Clean up event listeners
- Clear intervals and timeouts

```javascript
after(() => {
  if (cache) cache.destroy();
  if (rateLimiter) rateLimiter.destroy();
  if (monitoring) monitoring.destroy();
});
```

#### 4. Flaky Tests

**Symptoms:**

- Tests pass/fail randomly
- Race conditions
- Timing-dependent failures

**Solution:**

- Avoid hardcoded delays
- Use proper async/await
- Don't depend on execution order
- Mock time-sensitive operations

```javascript
// Bad
test('flaky test', async () => {
  doAsync();
  await new Promise(r => setTimeout(r, 100)); // Fragile
  assert.ok(result);
});

// Good
test('reliable test', async () => {
  const result = await doAsync(); // Proper await
  assert.ok(result);
});
```

### Debugging Tests

#### Enable Verbose Output

```bash
node --test --test-reporter=spec tests/your-test.test.js
```

#### Run Single Test

```bash
node --test tests/compression.test.js
```

#### Enable Debug Logging

```bash
DEBUG=* node --test tests/your-test.test.js
```

#### Check Test Coverage

```bash
npm run test:coverage
# Check coverage/index.html for detailed report
```

## Test Metrics

### Current Status

- **Total Tests:** 108
  - Unit Tests: 58
  - Integration Tests: 16
  - Performance Tests: 9
  - Security Tests: 11
  - Server Tests: 14

- **Coverage:** ~90% (measured with test:coverage)
- **Pass Rate:** 100%
- **Average Duration:** ~15 seconds (main suite)

### Coverage Goals

| Category       | Current | Target |
| -------------- | ------- | ------ |
| Core utilities | 95%     | 95%    |
| API endpoints  | 85%     | 90%    |
| Error handling | 90%     | 95%    |
| Security       | 100%    | 100%   |
| Overall        | 90%     | 92%    |

## Additional Resources

- [Node.js Test Runner Documentation](https://nodejs.org/api/test.html)
- [API Examples](API-EXAMPLES.md) - Testing utilities in context
- [Performance Guide](PERFORMANCE.md) - Performance testing strategies
- [Contributing Guide](../CONTRIBUTING.md) - Test requirements for PRs

## Getting Help

- Check test output for specific errors
- Review similar test files for patterns
- Consult [API Examples](API-EXAMPLES.md) for usage
- Open an issue for test-related bugs
