/**
 * Request Deduplication Tests
 * Comprehensive test suite for request deduplication system
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const {
  RequestDeduplicator,
  BatchDeduplicator,
  createDeduplicationMiddleware
} = require('../utils/request-deduplication');

describe('RequestDeduplicator', () => {
  let deduplicator;

  beforeEach(() => {
    deduplicator = new RequestDeduplicator({
      ttl: 5000,
      enableHashing: true,
      maxPending: 10
    });
  });

  after(() => {
    if (deduplicator) {
      deduplicator.stop();
    }
  });

  describe('Basic Deduplication', () => {
    it('should execute request once', async () => {
      let executionCount = 0;

      const executor = async () => {
        executionCount++;
        return 'result';
      };

      const result = await deduplicator.execute('request1', executor);

      assert.strictEqual(result, 'result');
      assert.strictEqual(executionCount, 1);
    });

    it('should deduplicate concurrent identical requests', async () => {
      let executionCount = 0;

      const executor = async () => {
        executionCount++;
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'result';
      };

      // Execute 5 identical requests concurrently
      const promises = Array(5).fill(null).map(() =>
        deduplicator.execute('request1', executor)
      );

      const results = await Promise.all(promises);

      assert.strictEqual(executionCount, 1); // Only executed once
      assert.strictEqual(results.every(r => r === 'result'), true);
    });

    it('should execute different requests separately', async () => {
      let count1 = 0;
      let count2 = 0;

      const executor1 = async () => {
        count1++;
        return 'result1';
      };

      const executor2 = async () => {
        count2++;
        return 'result2';
      };

      const [result1, result2] = await Promise.all([
        deduplicator.execute('request1', executor1),
        deduplicator.execute('request2', executor2)
      ]);

      assert.strictEqual(result1, 'result1');
      assert.strictEqual(result2, 'result2');
      assert.strictEqual(count1, 1);
      assert.strictEqual(count2, 1);
    });

    it('should handle executor errors', async () => {
      const executor = async () => {
        throw new Error('Execution failed');
      };

      await assert.rejects(
        async () => await deduplicator.execute('request1', executor),
        { message: 'Execution failed' }
      );
    });

    it('should not cache errors', async () => {
      let executionCount = 0;

      const executor = async () => {
        executionCount++;
        throw new Error('Failed');
      };

      await assert.rejects(async () => await deduplicator.execute('request1', executor));
      await assert.rejects(async () => await deduplicator.execute('request1', executor));

      assert.strictEqual(executionCount, 2); // Both requests executed
    });
  });

  describe('Request Key Generation', () => {
    it('should handle string requests', async () => {
      let count = 0;

      const executor = async () => {
        count++;
        return 'result';
      };

      await deduplicator.execute('simple-key', executor);
      await deduplicator.execute('simple-key', executor);

      assert.strictEqual(count, 1);
    });

    it('should handle object requests', async () => {
      let count = 0;

      const executor = async () => {
        count++;
        return 'result';
      };

      const request = { url: '/api/users', method: 'GET' };

      await deduplicator.execute(request, executor);
      await deduplicator.execute(request, executor);

      assert.strictEqual(count, 1);
    });

    it('should treat different objects as different requests', async () => {
      let count = 0;

      const executor = async () => {
        count++;
        return 'result';
      };

      await deduplicator.execute({ id: 1 }, executor);
      await deduplicator.execute({ id: 2 }, executor);

      assert.strictEqual(count, 2);
    });

    it('should use hashing for object keys', async () => {
      const request = { url: '/api/users', method: 'GET', params: { page: 1 } };

      let executed = false;
      const executor = async () => {
        executed = true;
        return 'result';
      };

      await deduplicator.execute(request, executor);

      // Same object should use cached result
      const cached = deduplicator.results.get(deduplicator.generateKey(request));
      assert.ok(cached);
      assert.strictEqual(cached.value, 'result');
    });

    it('should work without hashing', async () => {
      const dedup = new RequestDeduplicator({ enableHashing: false });

      let count = 0;
      const executor = async () => {
        count++;
        return 'result';
      };

      const request = { id: 1 };

      await dedup.execute(request, executor);
      await dedup.execute(request, executor);

      assert.strictEqual(count, 1);

      dedup.stop();
    });
  });

  describe('Result Caching', () => {
    it('should cache results', async () => {
      let executionCount = 0;

      const executor = async () => {
        executionCount++;
        return 'result';
      };

      await deduplicator.execute('request1', executor);

      // Should use cached result
      await deduplicator.execute('request1', executor);

      assert.strictEqual(executionCount, 1);
    });

    it('should expire cached results after TTL', async () => {
      const dedup = new RequestDeduplicator({ ttl: 100 });

      let executionCount = 0;

      const executor = async () => {
        executionCount++;
        return 'result';
      };

      await dedup.execute('request1', executor);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      await dedup.execute('request1', executor);

      assert.strictEqual(executionCount, 2);

      dedup.stop();
    });

    it('should clear cached results', async () => {
      let executionCount = 0;

      const executor = async () => {
        executionCount++;
        return 'result';
      };

      await deduplicator.execute('request1', executor);

      deduplicator.clear();

      await deduplicator.execute('request1', executor);

      assert.strictEqual(executionCount, 2);
    });
  });

  describe('Pending Requests', () => {
    it('should track pending requests', async () => {
      const executor = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'result';
      };

      const promise = deduplicator.execute('request1', executor);

      assert.strictEqual(deduplicator.pending.size, 1);

      await promise;

      assert.strictEqual(deduplicator.pending.size, 0);
    });

    it('should reject when max pending reached', async () => {
      const dedup = new RequestDeduplicator({ maxPending: 2 });

      const slowExecutor = async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'result';
      };

      // Start 2 pending requests (max)
      dedup.execute('request1', slowExecutor);
      dedup.execute('request2', slowExecutor);

      // Third should fail
      await assert.rejects(
        async () => await dedup.execute('request3', slowExecutor),
        { message: 'Too many pending requests' }
      );

      dedup.stop();
    });

    it('should remove from pending after completion', async () => {
      const executor = async () => 'result';

      await deduplicator.execute('request1', executor);

      assert.strictEqual(deduplicator.pending.has('request1'), false);
    });

    it('should remove from pending after error', async () => {
      const executor = async () => {
        throw new Error('Failed');
      };

      await assert.rejects(async () => await deduplicator.execute('request1', executor));

      assert.strictEqual(deduplicator.pending.has('request1'), false);
    });
  });

  describe('Statistics', () => {
    it('should track total requests', async () => {
      const executor = async () => 'result';

      await deduplicator.execute('request1', executor);
      await deduplicator.execute('request2', executor);
      await deduplicator.execute('request3', executor);

      const stats = deduplicator.getStats();
      assert.strictEqual(stats.total, 3);
    });

    it('should track deduplicated requests', async () => {
      const executor = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'result';
      };

      // Concurrent duplicates
      await Promise.all([
        deduplicator.execute('request1', executor),
        deduplicator.execute('request1', executor),
        deduplicator.execute('request1', executor)
      ]);

      const stats = deduplicator.getStats();
      assert.strictEqual(stats.deduplicated, 2);
    });

    it('should track completed requests', async () => {
      const executor = async () => 'result';

      await deduplicator.execute('request1', executor);
      await deduplicator.execute('request2', executor);

      const stats = deduplicator.getStats();
      assert.strictEqual(stats.completed, 2);
    });

    it('should track failed requests', async () => {
      const executor = async () => {
        throw new Error('Failed');
      };

      await assert.rejects(async () => await deduplicator.execute('request1', executor));

      const stats = deduplicator.getStats();
      assert.strictEqual(stats.failed, 1);
    });

    it('should calculate deduplication rate', async () => {
      const executor = async () => 'result';

      await deduplicator.execute('request1', executor);
      await deduplicator.execute('request1', executor);
      await deduplicator.execute('request2', executor);

      const stats = deduplicator.getStats();
      assert.strictEqual(stats.deduplicationRate, 1 / 3);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup expired results', async () => {
      const dedup = new RequestDeduplicator({ ttl: 100 });

      const executor = async () => 'result';

      await dedup.execute('request1', executor);
      await dedup.execute('request2', executor);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      dedup.cleanup();

      const stats = dedup.getStats();
      assert.strictEqual(stats.cached, 0);
      assert.strictEqual(stats.expired, 2);

      dedup.stop();
    });
  });
});

describe('BatchDeduplicator', () => {
  let batchDedup;

  beforeEach(() => {
    batchDedup = new BatchDeduplicator({
      batchSize: 3,
      batchDelay: 50,
      ttl: 5000
    });
  });

  after(() => {
    if (batchDedup) {
      batchDedup.stop();
    }
  });

  describe('Batch Processing', () => {
    it('should batch multiple requests', async () => {
      let batchCount = 0;

      const executor = async (requests) => {
        batchCount++;
        return requests.map((req, i) => `result-${i}`);
      };

      const promises = [
        batchDedup.executeBatch({ id: 1 }, executor),
        batchDedup.executeBatch({ id: 2 }, executor),
        batchDedup.executeBatch({ id: 3 }, executor)
      ];

      const results = await Promise.all(promises);

      assert.strictEqual(batchCount, 1); // Only one batch executed
      assert.strictEqual(results.length, 3);
    });

    it('should execute batch immediately when full', async () => {
      let executionTime = Date.now();

      const executor = async (requests) => {
        executionTime = Date.now();
        return requests.map(() => 'result');
      };

      const startTime = Date.now();

      await Promise.all([
        batchDedup.executeBatch({ id: 1 }, executor),
        batchDedup.executeBatch({ id: 2 }, executor),
        batchDedup.executeBatch({ id: 3 }, executor)
      ]);

      const elapsed = executionTime - startTime;

      // Should execute immediately, not wait for delay
      assert.ok(elapsed < 40); // Well before the 50ms delay
    });

    it('should wait for delay if batch not full', async () => {
      let executionTime = Date.now();

      const executor = async (requests) => {
        executionTime = Date.now();
        return requests.map(() => 'result');
      };

      const startTime = Date.now();

      await Promise.all([
        batchDedup.executeBatch({ id: 1 }, executor),
        batchDedup.executeBatch({ id: 2 }, executor)
      ]);

      const elapsed = executionTime - startTime;

      // Should wait for delay
      assert.ok(elapsed >= 50);
    });

    it('should handle batch errors', async () => {
      const executor = async (requests) => {
        throw new Error('Batch failed');
      };

      await assert.rejects(
        async () => await batchDedup.executeBatch({ id: 1 }, executor),
        { message: 'Batch failed' }
      );
    });

    it('should cache individual batch results', async () => {
      let executionCount = 0;

      const executor = async (requests) => {
        executionCount++;
        return requests.map((req, i) => `result-${req.id}`);
      };

      await batchDedup.executeBatch({ id: 1 }, executor);
      await batchDedup.executeBatch({ id: 2 }, executor);

      // Wait for batch to execute
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should use cached result
      const result = await batchDedup.executeBatch({ id: 1 }, executor);

      assert.strictEqual(result, 'result-1');
      assert.strictEqual(executionCount, 1);
    });
  });

  describe('Batch Grouping', () => {
    it('should group by URL', async () => {
      let batch1Count = 0;
      let batch2Count = 0;

      const executor1 = async (requests) => {
        batch1Count = requests.length;
        return requests.map(() => 'result1');
      };

      const executor2 = async (requests) => {
        batch2Count = requests.length;
        return requests.map(() => 'result2');
      };

      await Promise.all([
        batchDedup.executeBatch({ url: '/api/users', id: 1 }, executor1),
        batchDedup.executeBatch({ url: '/api/users', id: 2 }, executor1),
        batchDedup.executeBatch({ url: '/api/posts', id: 3 }, executor2)
      ]);

      // Wait for batches to execute
      await new Promise(resolve => setTimeout(resolve, 100));

      assert.strictEqual(batch1Count, 2); // /api/users batch
      assert.strictEqual(batch2Count, 1); // /api/posts batch
    });

    it('should group by endpoint', async () => {
      let usersCount = 0;
      let postsCount = 0;

      const executor = async (requests) => {
        if (requests[0].endpoint === 'users') {
          usersCount = requests.length;
        } else {
          postsCount = requests.length;
        }
        return requests.map(() => 'result');
      };

      await Promise.all([
        batchDedup.executeBatch({ endpoint: 'users', id: 1 }, executor),
        batchDedup.executeBatch({ endpoint: 'users', id: 2 }, executor),
        batchDedup.executeBatch({ endpoint: 'posts', id: 3 }, executor)
      ]);

      await new Promise(resolve => setTimeout(resolve, 100));

      assert.strictEqual(usersCount, 2);
      assert.strictEqual(postsCount, 1);
    });
  });
});

describe('Deduplication Middleware', () => {
  let deduplicator;

  beforeEach(() => {
    deduplicator = new RequestDeduplicator();
  });

  after(() => {
    if (deduplicator) {
      deduplicator.stop();
    }
  });

  describe('Middleware Integration', () => {
    it('should create middleware', () => {
      const middleware = createDeduplicationMiddleware(deduplicator);
      assert.strictEqual(typeof middleware, 'function');
    });

    it('should deduplicate concurrent requests', async () => {
      const middleware = createDeduplicationMiddleware(deduplicator);

      let executionCount = 0;

      const req = {
        method: 'GET',
        url: '/api/users'
      };

      const res = {
        send: function(data) {
          executionCount++;
          return this;
        }
      };

      const next = () => {
        setTimeout(() => res.send('result'), 50);
      };

      // Execute 3 concurrent requests
      await Promise.all([
        middleware(req, res, next),
        middleware(req, res, next),
        middleware(req, res, next)
      ]);

      assert.strictEqual(executionCount, 3); // All should receive result
    });

    it('should generate key from method and URL', async () => {
      const middleware = createDeduplicationMiddleware(deduplicator);

      const req1 = { method: 'GET', url: '/api/users' };
      const req2 = { method: 'POST', url: '/api/users' };

      const res = { send: () => {} };
      const next = () => res.send('result');

      await middleware(req1, res, next);
      await middleware(req2, res, next);

      // Should be treated as different requests
      const stats = deduplicator.getStats();
      assert.strictEqual(stats.total, 2);
    });

    it('should handle errors in next()', async () => {
      const middleware = createDeduplicationMiddleware(deduplicator);

      const req = { method: 'GET', url: '/api/error' };
      const res = {};

      const next = () => {
        throw new Error('Handler error');
      };

      let errorHandled = false;

      await middleware(req, res, (error) => {
        errorHandled = true;
      });

      assert.strictEqual(errorHandled, true);
    });
  });
});
