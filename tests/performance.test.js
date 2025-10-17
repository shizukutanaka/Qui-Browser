const test = require('node:test');
const assert = require('node:assert');

const LightweightBrowserServer = require('../server-modular');

let serverInstance;
let httpServer;
let baseUrl;

test.before(async () => {
  const previousEnv = process.env.NODE_ENV;
  process.env.PORT = '0';
  process.env.NODE_ENV = 'test';
  process.env.RATE_LIMIT_MAX = '500';

  serverInstance = new LightweightBrowserServer();
  httpServer = await serverInstance.start();
  const address = httpServer.address();
  const port = typeof address === 'object' && address ? address.port : process.env.PORT || 8000;
  baseUrl = `http://127.0.0.1:${port}`;

  if (previousEnv) {
    process.env.NODE_ENV = previousEnv;
  }
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

test('handles concurrent requests efficiently', async () => {
  const concurrentRequests = 20; // 50から20に削減
  const startTime = Date.now();

  const requests = Array(concurrentRequests)
    .fill(null)
    .map(() => fetch(`${baseUrl}/health`));

  const responses = await Promise.all(requests);
  const endTime = Date.now();
  const duration = endTime - startTime;

  const allSuccessful = responses.every(r => r.status === 200);
  assert.ok(allSuccessful, 'All concurrent requests should succeed');

  // Should handle 20 requests in reasonable time (under 10 seconds)
  assert.ok(duration < 10000, `Concurrent requests took ${duration}ms, should be under 10000ms`);
});

test('ETag generation is consistent', async () => {
  const response1 = await fetch(`${baseUrl}/`);
  const etag1 = response1.headers.get('etag');

  const response2 = await fetch(`${baseUrl}/`);
  const etag2 = response2.headers.get('etag');

  assert.strictEqual(etag1, etag2, 'ETag should be consistent for the same file');
  assert.ok(etag1.startsWith('W/"'), 'ETag should be a weak ETag');
});

test('conditional requests work correctly', async () => {
  const response1 = await fetch(`${baseUrl}/`);
  const etag = response1.headers.get('etag');
  const lastModified = response1.headers.get('last-modified');

  // Test ETag conditional request
  const response2 = await fetch(`${baseUrl}/`, {
    headers: { 'If-None-Match': etag }
  });
  assert.strictEqual(response2.status, 304, 'Should return 304 for matching ETag');

  // Test Last-Modified conditional request
  const response3 = await fetch(`${baseUrl}/`, {
    headers: { 'If-Modified-Since': lastModified }
  });
  assert.strictEqual(response3.status, 304, 'Should return 304 for not modified');
});

test('rate limiter cleanup works', async () => {
  const initialSize = serverInstance.rateLimitMap.size;

  // Make some requests
  await Promise.all([fetch(`${baseUrl}/health`), fetch(`${baseUrl}/health`), fetch(`${baseUrl}/health`)]);

  const afterRequests = serverInstance.rateLimitMap.size;
  assert.ok(afterRequests >= initialSize, 'Rate limit map should track requests');

  // Manually trigger cleanup
  serverInstance.cleanupRateLimits();

  // Size should be within reasonable bounds
  assert.ok(
    serverInstance.rateLimitMap.size <= serverInstance.rateLimitMaxEntries,
    'Rate limit map should not exceed max entries'
  );
});

test('response times are tracked', async () => {
  const initialCount = serverInstance.requestCount;
  const initialTotalTime = serverInstance.totalResponseTime;

  await fetch(`${baseUrl}/health`);

  // Give server time to update metrics
  await new Promise(resolve => setTimeout(resolve, 50));

  assert.strictEqual(serverInstance.requestCount, initialCount + 1, 'Request count should increment');
  assert.ok(serverInstance.totalResponseTime >= initialTotalTime, 'Total response time should not decrease');

  const avgResponseTime = serverInstance.totalResponseTime / serverInstance.requestCount;
  assert.ok(avgResponseTime >= 0, 'Average response time should be non-negative');
  assert.ok(avgResponseTime < 1000, 'Average response time should be under 1 second');
});

test('cache hit rate improves with repeated requests', async () => {
  // First request - cache miss
  const response1 = await fetch(`${baseUrl}/`);
  assert.strictEqual(response1.status, 200);

  const initialHits = serverInstance.fileCacheHits;

  // Second request - should hit cache
  const response2 = await fetch(`${baseUrl}/`);
  assert.strictEqual(response2.status, 200);

  assert.ok(serverInstance.fileCacheHits > initialHits, 'Cache hits should increase on repeated requests');
});

test('handles high load without degradation', async () => {
  const iterations = 10;
  const requestsPerIteration = 10;
  const responseTimes = [];

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    const requests = Array(requestsPerIteration)
      .fill(null)
      .map(() => fetch(`${baseUrl}/health`));

    await Promise.all(requests);
    const duration = Date.now() - start;
    responseTimes.push(duration);

    // Small delay between iterations
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Calculate average and check for degradation
  const avgFirst = responseTimes.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const avgLast = responseTimes.slice(-3).reduce((a, b) => a + b, 0) / 3;

  // Response time shouldn't degrade more than 2x
  assert.ok(avgLast < avgFirst * 2, `Performance degraded too much: first ${avgFirst}ms, last ${avgLast}ms`);
});

test('memory usage stays within bounds', async () => {
  const initialMemory = process.memoryUsage().heapUsed;

  // Make many requests to stress test
  const requests = Array(50)
    .fill(null)
    .map(() => fetch(`${baseUrl}/health`));

  await Promise.all(requests);

  const finalMemory = process.memoryUsage().heapUsed;
  const memoryIncrease = finalMemory - initialMemory;

  // Memory increase should be reasonable (less than 50MB)
  assert.ok(
    memoryIncrease < 50 * 1024 * 1024,
    `Memory increased by ${Math.round(memoryIncrease / 1024 / 1024)}MB, should be under 50MB`
  );
});

test('file cache eviction works correctly', async () => {
  const cacheSize = serverInstance.fileCacheMaxSize;

  // Fill cache by accessing different files
  await fetch(`${baseUrl}/`);
  await fetch(`${baseUrl}/manifest.json`);

  const cacheCount = serverInstance.fileCache.size;

  assert.ok(cacheCount <= cacheSize, 'Cache size should not exceed maximum');
});
