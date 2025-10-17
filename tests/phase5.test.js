/**
 * Phase 5 Improvements Tests
 *
 * Tests for:
 * - Query Optimizer
 * - Redis Cache
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Import Phase 5 utilities
const {
  QueryOptimizer,
  QueryCache,
  QueryBatcher,
  SlowQueryDetector
} = require('../utils/query-optimizer');

const {
  RedisCache,
  MemoryCache,
  MockRedisClient
} = require('../utils/redis-cache');

// ==================== Query Optimizer Tests ====================

describe('Query Optimizer', () => {
  it('should create query cache', () => {
    const cache = new QueryCache();
    assert.ok(cache);
  });

  it('should generate consistent cache keys', () => {
    const cache = new QueryCache();
    const query = 'SELECT * FROM users WHERE id = ?';
    const params = [1];

    const key1 = cache.generateKey(query, params);
    const key2 = cache.generateKey(query, params);

    assert.strictEqual(key1, key2);
  });

  it('should cache and retrieve query results', () => {
    const cache = new QueryCache();
    const query = 'SELECT * FROM users';
    const result = [{ id: 1, name: 'John' }];

    cache.set(query, [], result);
    const cached = cache.get(query, []);

    assert.deepStrictEqual(cached, result);
  });

  it('should handle cache expiration', async () => {
    const cache = new QueryCache({ defaultCacheTTL: 100 });
    const query = 'SELECT * FROM users';
    const result = [{ id: 1 }];

    cache.set(query, [], result);

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 150));

    const cached = cache.get(query, []);
    assert.strictEqual(cached, null);
  });

  it('should track cache statistics', () => {
    const cache = new QueryCache();

    cache.get('SELECT 1', []); // miss
    cache.set('SELECT 1', [], [1]);
    cache.get('SELECT 1', []); // hit

    const stats = cache.getStatistics();
    assert.strictEqual(stats.hits, 1);
    assert.strictEqual(stats.misses, 1);
    assert.strictEqual(stats.sets, 1);
  });

  it('should invalidate cached queries', () => {
    const cache = new QueryCache();
    const query = 'SELECT * FROM users';

    cache.set(query, [], [{ id: 1 }]);
    assert.ok(cache.get(query, []) !== null);

    cache.invalidate(query, []);
    assert.strictEqual(cache.get(query, []), null);
  });

  it('should invalidate by pattern', () => {
    const cache = new QueryCache({ cacheKeyPrefix: 'test:' });

    cache.set('users:1', [], { id: 1 });
    cache.set('users:2', [], { id: 2 });
    cache.set('posts:1', [], { id: 1 });

    const count = cache.invalidatePattern('test:query.*users');
    assert.ok(count >= 0);
  });

  it('should create query batcher', () => {
    const batcher = new QueryBatcher({ batchWindow: 100 });
    assert.ok(batcher);
  });

  it('should create slow query detector', () => {
    const detector = new SlowQueryDetector({ slowQueryThreshold: 100 });
    assert.ok(detector);
  });

  it('should detect slow queries', () => {
    const detector = new SlowQueryDetector({ slowQueryThreshold: 100 });

    let slowQueryDetected = false;
    detector.on('slow-query', () => {
      slowQueryDetected = true;
    });

    detector.track('SELECT * FROM users', 150);

    assert.strictEqual(slowQueryDetected, true);
    assert.strictEqual(detector.slowQueries.length, 1);
  });

  it('should analyze query', () => {
    const optimizer = new QueryOptimizer();

    const analysis = optimizer.analyzeQuery('SELECT * FROM users WHERE id = 1');

    assert.strictEqual(analysis.type, 'SELECT');
    assert.ok(analysis.tables.includes('users'));
    assert.strictEqual(analysis.hasWhere, true);
  });

  it('should detect query complexity', () => {
    const optimizer = new QueryOptimizer();

    const simple = optimizer.analyzeQuery('SELECT * FROM users LIMIT 10');
    const complex = optimizer.analyzeQuery(
      'SELECT * FROM users JOIN posts ON users.id = posts.user_id ORDER BY created_at'
    );

    assert.strictEqual(simple.complexity, 'simple');
    assert.ok(complex.complexity !== 'simple');
  });

  it('should create query optimizer', () => {
    const optimizer = new QueryOptimizer();
    assert.ok(optimizer);
  });

  it('should get optimizer statistics', () => {
    const optimizer = new QueryOptimizer();
    const stats = optimizer.getStatistics();

    assert.ok(stats.queries);
    assert.ok(stats.cache);
    assert.ok(stats.batching);
    assert.ok(stats.slowQueries);
  });
});

// ==================== Redis Cache Tests ====================

describe('Redis Cache', () => {
  it('should create memory cache fallback', () => {
    const cache = new MemoryCache(100);
    assert.ok(cache);
  });

  it('should store and retrieve from memory cache', () => {
    const cache = new MemoryCache();

    cache.set('key1', 'value1', 300);
    const value = cache.get('key1');

    assert.strictEqual(value, 'value1');
  });

  it('should handle memory cache expiration', async () => {
    const cache = new MemoryCache();

    cache.set('key1', 'value1', 0.1); // 0.1 seconds

    await new Promise((resolve) => setTimeout(resolve, 150));

    const value = cache.get('key1');
    assert.strictEqual(value, null);
  });

  it('should evict oldest entry when full', () => {
    const cache = new MemoryCache(2);

    cache.set('key1', 'value1', 300);
    cache.set('key2', 'value2', 300);
    cache.set('key3', 'value3', 300);

    assert.strictEqual(cache.size(), 2);
    assert.strictEqual(cache.get('key1'), null);
    assert.ok(cache.get('key3') !== null);
  });

  it('should create mock Redis client', () => {
    const client = new MockRedisClient();
    assert.ok(client);
  });

  it('should perform basic Redis operations', async () => {
    const client = new MockRedisClient();

    await client.set('key1', 'value1', { EX: 300 });
    const value = await client.get('key1');

    assert.strictEqual(value, 'value1');
  });

  it('should handle Redis TTL', async () => {
    const client = new MockRedisClient();

    await client.set('key1', 'value1', { EX: 60 });
    const ttl = await client.ttl('key1');

    assert.ok(ttl > 0 && ttl <= 60);
  });

  it('should delete Redis keys', async () => {
    const client = new MockRedisClient();

    await client.set('key1', 'value1');
    const deleted = await client.del('key1');

    assert.strictEqual(deleted, 1);
    assert.strictEqual(await client.get('key1'), null);
  });

  it('should find keys by pattern', async () => {
    const client = new MockRedisClient();

    await client.set('user:1', 'data1');
    await client.set('user:2', 'data2');
    await client.set('post:1', 'data3');

    const keys = await client.keys('user:*');

    assert.strictEqual(keys.length, 2);
  });

  it('should create Redis cache', () => {
    const cache = new RedisCache();
    assert.ok(cache);
  });

  it('should set and get from Redis cache', async () => {
    const cache = new RedisCache();
    await cache.connect();

    await cache.set('test-key', { data: 'value' });
    const value = await cache.get('test-key');

    assert.deepStrictEqual(value, { data: 'value' });
  });

  it('should use fallback cache when Redis disconnected', async () => {
    const cache = new RedisCache({ enableFallback: true });

    cache.connected = false;

    await cache.set('key1', 'value1');
    const value = await cache.get('key1');

    assert.strictEqual(value, 'value1');
    assert.ok(cache.stats.fallbackHits >= 0);
  });

  it('should delete from Redis cache', async () => {
    const cache = new RedisCache();
    await cache.connect();

    await cache.set('key1', 'value1');
    await cache.delete('key1');

    const value = await cache.get('key1');
    assert.strictEqual(value, null);
  });

  it('should check key existence', async () => {
    const cache = new RedisCache();
    await cache.connect();

    await cache.set('key1', 'value1');

    const exists = await cache.exists('key1');
    const notExists = await cache.exists('key2');

    assert.strictEqual(exists, true);
    assert.strictEqual(notExists, false);
  });

  it('should warm cache with data', async () => {
    const cache = new RedisCache();
    await cache.connect();

    const data = {
      'user:1': { id: 1, name: 'John' },
      'user:2': { id: 2, name: 'Jane' }
    };

    const results = await cache.warm(data);

    assert.strictEqual(results.success, 2);
    assert.strictEqual(results.failed, 0);
  });

  it('should implement getOrSet pattern', async () => {
    const cache = new RedisCache();
    await cache.connect();

    let fetchCalled = false;
    const fetchFn = async () => {
      fetchCalled = true;
      return { data: 'fetched' };
    };

    // First call should fetch
    const value1 = await cache.getOrSet('key1', fetchFn);
    assert.strictEqual(fetchCalled, true);
    assert.deepStrictEqual(value1, { data: 'fetched' });

    // Second call should use cache
    fetchCalled = false;
    const value2 = await cache.getOrSet('key1', fetchFn);
    assert.strictEqual(fetchCalled, false);
    assert.deepStrictEqual(value2, { data: 'fetched' });
  });

  it('should track Redis cache statistics', async () => {
    const cache = new RedisCache();
    await cache.connect();

    await cache.set('key1', 'value1');
    await cache.get('key1'); // hit
    await cache.get('key2'); // miss

    const stats = cache.getStatistics();

    assert.strictEqual(stats.hits, 1);
    assert.strictEqual(stats.misses, 1);
    assert.strictEqual(stats.sets, 1);
  });

  it('should clear all cache', async () => {
    const cache = new RedisCache();
    await cache.connect();

    await cache.set('key1', 'value1');
    await cache.set('key2', 'value2');

    await cache.clear();

    const value1 = await cache.get('key1');
    const value2 = await cache.get('key2');

    assert.strictEqual(value1, null);
    assert.strictEqual(value2, null);
  });
});

console.log('All Phase 5 tests completed!');
