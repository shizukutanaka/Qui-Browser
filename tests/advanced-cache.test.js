/**
 * Advanced Cache Tests
 * Comprehensive test suite for multi-tier caching system
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { AdvancedCache, MultiTierCache } = require('../utils/advanced-cache');

describe('AdvancedCache', () => {
  let cache;

  beforeEach(() => {
    cache = new AdvancedCache({
      maxSize: 5,
      defaultTTL: 5000,
      strategy: 'lru',
      maxMemory: 1024 * 1024 // 1MB
    });
  });

  after(() => {
    if (cache) {
      cache.stop();
    }
  });

  describe('Basic Operations', () => {
    it('should set and get values', () => {
      const result = cache.set('key1', 'value1');
      assert.strictEqual(result, true);

      const value = cache.get('key1');
      assert.strictEqual(value, 'value1');
    });

    it('should return undefined for missing keys', () => {
      const value = cache.get('non-existent');
      assert.strictEqual(value, undefined);
    });

    it('should overwrite existing keys', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');

      const value = cache.get('key1');
      assert.strictEqual(value, 'value2');
    });

    it('should delete values', () => {
      cache.set('key1', 'value1');

      const deleted = cache.delete('key1');
      assert.strictEqual(deleted, true);

      const value = cache.get('key1');
      assert.strictEqual(value, undefined);
    });

    it('should return false when deleting non-existent key', () => {
      const deleted = cache.delete('non-existent');
      assert.strictEqual(deleted, false);
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');

      assert.strictEqual(cache.has('key1'), true);
      assert.strictEqual(cache.has('non-existent'), false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.clear();

      assert.strictEqual(cache.get('key1'), undefined);
      assert.strictEqual(cache.get('key2'), undefined);
      assert.strictEqual(cache.get('key3'), undefined);
    });
  });

  describe('Expiration', () => {
    it('should expire entries after TTL', async () => {
      const shortCache = new AdvancedCache({ defaultTTL: 100 });

      shortCache.set('key1', 'value1');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      const value = shortCache.get('key1');
      assert.strictEqual(value, undefined);

      shortCache.stop();
    });

    it('should use custom TTL', async () => {
      cache.set('key1', 'value1', { ttl: 100 });

      await new Promise(resolve => setTimeout(resolve, 150));

      const value = cache.get('key1');
      assert.strictEqual(value, undefined);
    });

    it('should not return expired entries', async () => {
      cache.set('key1', 'value1', { ttl: 100 });

      await new Promise(resolve => setTimeout(resolve, 150));

      assert.strictEqual(cache.has('key1'), false);
    });

    it('should cleanup expired entries automatically', async () => {
      const testCache = new AdvancedCache({ defaultTTL: 100 });

      testCache.set('key1', 'value1');
      testCache.set('key2', 'value2');

      await new Promise(resolve => setTimeout(resolve, 150));

      testCache.cleanup();

      const stats = testCache.getStats();
      assert.strictEqual(stats.size, 0);

      testCache.stop();
    });
  });

  describe('ETags', () => {
    it('should generate ETags for values', () => {
      cache.set('key1', { data: 'value1' });

      const etag = cache.getETag('key1');
      assert.ok(etag);
      assert.strictEqual(typeof etag, 'string');
      assert.strictEqual(etag.length, 32); // MD5 hex
    });

    it('should return same ETag for same value', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value1');

      const etag1 = cache.getETag('key1');
      const etag2 = cache.getETag('key2');

      assert.strictEqual(etag1, etag2);
    });

    it('should return different ETags for different values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const etag1 = cache.getETag('key1');
      const etag2 = cache.getETag('key2');

      assert.notStrictEqual(etag1, etag2);
    });

    it('should validate ETags', () => {
      cache.set('key1', 'value1');
      const etag = cache.getETag('key1');

      assert.strictEqual(cache.validateETag('key1', etag), true);
      assert.strictEqual(cache.validateETag('key1', 'invalid-etag'), false);
    });

    it('should return null for non-existent key', () => {
      const etag = cache.getETag('non-existent');
      assert.strictEqual(etag, null);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used item', () => {
      cache.strategy = 'lru';

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');
      cache.set('key5', 'value5');

      // Access key1 to make it recently used
      cache.get('key1');

      // This should evict key2 (least recently used)
      cache.set('key6', 'value6');

      assert.strictEqual(cache.get('key1'), 'value1'); // Still exists
      assert.strictEqual(cache.get('key2'), undefined); // Evicted
      assert.strictEqual(cache.get('key6'), 'value6'); // New entry
    });

    it('should update access order on get', () => {
      cache.strategy = 'lru';

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');
      cache.set('key5', 'value5');

      // Access key1 and key2
      cache.get('key1');
      cache.get('key2');

      // Fill cache
      cache.set('key6', 'value6'); // Evicts key3
      cache.set('key7', 'value7'); // Evicts key4

      assert.strictEqual(cache.get('key1'), 'value1');
      assert.strictEqual(cache.get('key2'), 'value2');
      assert.strictEqual(cache.get('key3'), undefined);
      assert.strictEqual(cache.get('key4'), undefined);
    });
  });

  describe('LFU Eviction', () => {
    it('should evict least frequently used item', () => {
      cache.strategy = 'lfu';

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');
      cache.set('key5', 'value5');

      // Access key1 multiple times
      cache.get('key1');
      cache.get('key1');
      cache.get('key1');

      // Access key2 once
      cache.get('key2');

      // This should evict key3 (least frequently used, hits=0)
      cache.set('key6', 'value6');

      assert.strictEqual(cache.get('key1'), 'value1');
      assert.strictEqual(cache.get('key2'), 'value2');
      assert.strictEqual(cache.get('key3'), undefined);
    });
  });

  describe('TTL Eviction', () => {
    it('should evict entry expiring soonest', async () => {
      cache.strategy = 'ttl';

      cache.set('key1', 'value1', { ttl: 10000 });
      cache.set('key2', 'value2', { ttl: 5000 });
      cache.set('key3', 'value3', { ttl: 15000 });
      cache.set('key4', 'value4', { ttl: 8000 });
      cache.set('key5', 'value5', { ttl: 12000 });

      // This should evict key2 (expires soonest)
      cache.set('key6', 'value6', { ttl: 10000 });

      assert.strictEqual(cache.get('key2'), undefined);
      assert.strictEqual(cache.get('key1'), 'value1');
    });
  });

  describe('Adaptive Eviction', () => {
    it('should use adaptive scoring for eviction', () => {
      cache.strategy = 'adaptive';

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');
      cache.set('key5', 'value5');

      // Access key1 frequently
      cache.get('key1');
      cache.get('key1');
      cache.get('key1');

      // key2 is never accessed
      // This should evict key2 (low score: low frequency, older)
      cache.set('key6', 'value6');

      assert.strictEqual(cache.get('key1'), 'value1');
      assert.strictEqual(cache.get('key2'), undefined);
    });
  });

  describe('Metadata', () => {
    it('should store metadata with entries', () => {
      cache.set('key1', 'value1', {
        metadata: { source: 'api', version: 1 }
      });

      const entry = cache.cache.get('key1');
      assert.deepStrictEqual(entry.metadata, { source: 'api', version: 1 });
    });

    it('should track access counts', () => {
      cache.set('key1', 'value1');

      cache.get('key1');
      cache.get('key1');
      cache.get('key1');

      const entry = cache.cache.get('key1');
      assert.strictEqual(entry.hits, 3);
    });
  });

  describe('Pattern Invalidation', () => {
    it('should invalidate by string pattern', () => {
      cache.set('user:123', 'data1');
      cache.set('user:456', 'data2');
      cache.set('post:789', 'data3');

      const count = cache.invalidate('user:*');
      assert.strictEqual(count, 2);

      assert.strictEqual(cache.get('user:123'), undefined);
      assert.strictEqual(cache.get('user:456'), undefined);
      assert.strictEqual(cache.get('post:789'), 'data3');
    });

    it('should invalidate by regex pattern', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('test', 'value3');

      const count = cache.invalidate(/^key/);
      assert.strictEqual(count, 2);

      assert.strictEqual(cache.get('key1'), undefined);
      assert.strictEqual(cache.get('key2'), undefined);
      assert.strictEqual(cache.get('test'), 'value3');
    });

    it('should handle wildcard patterns', () => {
      cache.set('api:users:list', 'data1');
      cache.set('api:users:detail', 'data2');
      cache.set('api:posts:list', 'data3');

      const count = cache.invalidate('api:users:*');
      assert.strictEqual(count, 2);
    });
  });

  describe('Memory Management', () => {
    it('should track memory usage', () => {
      cache.set('key1', 'short');
      cache.set('key2', 'much longer string that uses more memory');

      const stats = cache.getStats();
      assert.ok(stats.memoryUsage > 0);
    });

    it('should evict when memory limit reached', () => {
      const smallCache = new AdvancedCache({
        maxMemory: 100,
        maxSize: 100
      });

      const largeValue = 'x'.repeat(50);

      smallCache.set('key1', largeValue);
      smallCache.set('key2', largeValue);
      smallCache.set('key3', largeValue); // Should trigger eviction

      const stats = smallCache.getStats();
      assert.ok(stats.memoryUsage <= 100);

      smallCache.stop();
    });

    it('should estimate size correctly for different types', () => {
      cache.set('string', 'test');
      cache.set('number', 123);
      cache.set('boolean', true);
      cache.set('object', { a: 1, b: 2 });
      cache.set('array', [1, 2, 3]);

      // All should have estimated sizes
      assert.ok(cache.cache.get('string').size > 0);
      assert.ok(cache.cache.get('number').size > 0);
      assert.ok(cache.cache.get('boolean').size > 0);
      assert.ok(cache.cache.get('object').size > 0);
      assert.ok(cache.cache.get('array').size > 0);
    });
  });

  describe('Statistics', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1');

      cache.get('key1'); // Hit
      cache.get('key2'); // Miss
      cache.get('key1'); // Hit
      cache.get('key3'); // Miss

      const stats = cache.getStats();
      assert.strictEqual(stats.hits, 2);
      assert.strictEqual(stats.misses, 2);
      assert.strictEqual(stats.hitRate, 0.5);
    });

    it('should track sets and evictions', () => {
      for (let i = 0; i < 7; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      const stats = cache.getStats();
      assert.strictEqual(stats.sets, 7);
      assert.strictEqual(stats.evictions, 2); // maxSize is 5
    });

    it('should track invalidations', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.invalidate('key*');

      const stats = cache.getStats();
      assert.strictEqual(stats.invalidations, 2);
    });

    it('should calculate hit rate correctly', () => {
      cache.set('key1', 'value1');

      for (let i = 0; i < 10; i++) {
        cache.get('key1'); // Hits
      }

      for (let i = 0; i < 5; i++) {
        cache.get('nonexistent'); // Misses
      }

      const stats = cache.getStats();
      assert.strictEqual(stats.hitRate, 10 / 15);
    });

    it('should report current size and limits', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();
      assert.strictEqual(stats.size, 2);
      assert.strictEqual(stats.maxSize, 5);
      assert.ok(stats.maxMemory > 0);
    });
  });
});

describe('MultiTierCache', () => {
  let multiCache;
  let tier1;
  let tier2;
  let tier3;

  beforeEach(() => {
    tier1 = new AdvancedCache({ maxSize: 10, defaultTTL: 1000 }); // Fast, small
    tier2 = new AdvancedCache({ maxSize: 50, defaultTTL: 5000 }); // Medium
    tier3 = new AdvancedCache({ maxSize: 100, defaultTTL: 10000 }); // Large, slow

    multiCache = new MultiTierCache([tier1, tier2, tier3]);
  });

  after(() => {
    if (tier1) {tier1.stop();}
    if (tier2) {tier2.stop();}
    if (tier3) {tier3.stop();}
  });

  describe('Basic Operations', () => {
    it('should set in all tiers', async () => {
      await multiCache.set('key1', 'value1');

      assert.strictEqual(tier1.get('key1'), 'value1');
      assert.strictEqual(tier2.get('key1'), 'value1');
      assert.strictEqual(tier3.get('key1'), 'value1');
    });

    it('should get from first available tier', async () => {
      tier2.set('key1', 'value1');

      const value = await multiCache.get('key1');
      assert.strictEqual(value, 'value1');
    });

    it('should promote to higher tiers on get', async () => {
      tier3.set('key1', 'value1');

      const value = await multiCache.get('key1');
      assert.strictEqual(value, 'value1');

      // Should now be in tier1 and tier2
      assert.strictEqual(tier1.get('key1'), 'value1');
      assert.strictEqual(tier2.get('key1'), 'value1');
    });

    it('should delete from all tiers', async () => {
      await multiCache.set('key1', 'value1');

      await multiCache.delete('key1');

      assert.strictEqual(tier1.get('key1'), undefined);
      assert.strictEqual(tier2.get('key1'), undefined);
      assert.strictEqual(tier3.get('key1'), undefined);
    });

    it('should invalidate in all tiers', async () => {
      await multiCache.set('user:1', 'data1');
      await multiCache.set('user:2', 'data2');

      await multiCache.invalidate('user:*');

      assert.strictEqual(tier1.get('user:1'), undefined);
      assert.strictEqual(tier2.get('user:1'), undefined);
      assert.strictEqual(tier3.get('user:1'), undefined);
    });

    it('should clear all tiers', async () => {
      await multiCache.set('key1', 'value1');
      await multiCache.set('key2', 'value2');

      await multiCache.clear();

      assert.strictEqual(tier1.cache.size, 0);
      assert.strictEqual(tier2.cache.size, 0);
      assert.strictEqual(tier3.cache.size, 0);
    });
  });

  describe('Tier Priority', () => {
    it('should check tiers in order', async () => {
      tier2.set('key1', 'tier2-value');
      tier3.set('key1', 'tier3-value');

      const value = await multiCache.get('key1');
      assert.strictEqual(value, 'tier2-value');
    });

    it('should return undefined if not in any tier', async () => {
      const value = await multiCache.get('non-existent');
      assert.strictEqual(value, undefined);
    });
  });

  describe('Statistics', () => {
    it('should provide combined statistics', async () => {
      await multiCache.set('key1', 'value1');
      await multiCache.get('key1');

      const stats = multiCache.getStats();
      assert.strictEqual(stats.length, 3);
      assert.strictEqual(stats[0].tier, 0);
      assert.strictEqual(stats[1].tier, 1);
      assert.strictEqual(stats[2].tier, 2);
    });

    it('should show hits in appropriate tier', async () => {
      tier1.set('key1', 'value1');

      tier1.get('key1'); // Hit in tier1

      const stats = multiCache.getStats();
      assert.strictEqual(stats[0].hits, 1);
    });
  });

  describe('Cache Promotion', () => {
    it('should not promote if already in tier1', async () => {
      tier1.set('key1', 'value1');
      tier2.set('key1', 'value1');

      const initialT1Size = tier1.cache.size;

      await multiCache.get('key1');

      assert.strictEqual(tier1.cache.size, initialT1Size);
    });

    it('should skip tiers without the value', async () => {
      tier3.set('key1', 'value1');

      await multiCache.get('key1');

      // Should promote to tier1 and tier2
      assert.strictEqual(tier1.get('key1'), 'value1');
      assert.strictEqual(tier2.get('key1'), 'value1');
    });
  });
});
