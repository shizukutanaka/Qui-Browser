/**
 * Tests for Smart Cache
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const SmartCache = require('../utils/smart-cache');

describe('SmartCache', () => {
  test('should store and retrieve values', () => {
    const cache = new SmartCache();

    cache.set('key1', 'value1');
    const value = cache.get('key1');

    assert.strictEqual(value, 'value1');
  });

  test('should return undefined for missing keys', () => {
    const cache = new SmartCache();

    const value = cache.get('nonexistent');

    assert.strictEqual(value, undefined);
  });

  test('should track hits and misses', () => {
    const cache = new SmartCache();

    cache.set('key1', 'value1');

    cache.get('key1'); // Hit
    cache.get('key2'); // Miss

    const stats = cache.getStats();

    assert.strictEqual(stats.hits, 1);
    assert.strictEqual(stats.misses, 1);
    assert.strictEqual(stats.hitRate, 0.5);
  });

  test('should evict when maxSize is reached', () => {
    const cache = new SmartCache({
      maxSize: 3,
      strategy: 'lru'
    });

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    cache.set('key4', 'value4'); // Should evict key1

    assert.strictEqual(cache.get('key1'), undefined);
    assert.strictEqual(cache.get('key4'), 'value4');

    const stats = cache.getStats();
    assert.strictEqual(stats.evictions, 1);
  });

  test('should support TTL expiration', async () => {
    const cache = new SmartCache({
      defaultTTL: 100 // 100ms
    });

    cache.set('key1', 'value1');

    // Should exist immediately
    assert.strictEqual(cache.get('key1'), 'value1');

    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should be expired
    assert.strictEqual(cache.get('key1'), undefined);

    const stats = cache.getStats();
    assert.ok(stats.expirations > 0);
  });

  test('should support custom TTL per item', async () => {
    const cache = new SmartCache();

    cache.set('short', 'value1', { ttl: 50 });
    cache.set('long', 'value2', { ttl: 200 });

    await new Promise(resolve => setTimeout(resolve, 100));

    assert.strictEqual(cache.get('short'), undefined); // Expired
    assert.strictEqual(cache.get('long'), 'value2'); // Still valid
  });

  test('should use LRU strategy correctly', () => {
    const cache = new SmartCache({
      maxSize: 3,
      strategy: 'lru'
    });

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');

    // Access key1 to make it recently used
    cache.get('key1');

    // Add new key, should evict key2 (least recently used)
    cache.set('key4', 'value4');

    assert.strictEqual(cache.get('key1'), 'value1');
    assert.strictEqual(cache.get('key2'), undefined); // Evicted
    assert.strictEqual(cache.get('key3'), 'value3');
    assert.strictEqual(cache.get('key4'), 'value4');
  });

  test('should use LFU strategy correctly', () => {
    const cache = new SmartCache({
      maxSize: 3,
      strategy: 'lfu'
    });

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');

    // Access key1 multiple times
    cache.get('key1');
    cache.get('key1');
    cache.get('key1');

    // Access key2 once
    cache.get('key2');

    // key3 is least frequently used

    // Add new key, should evict key3
    cache.set('key4', 'value4');

    assert.strictEqual(cache.get('key1'), 'value1');
    assert.strictEqual(cache.get('key2'), 'value2');
    assert.strictEqual(cache.get('key3'), undefined); // Evicted
    assert.strictEqual(cache.get('key4'), 'value4');
  });

  test('should check key existence', () => {
    const cache = new SmartCache();

    cache.set('key1', 'value1');

    assert.strictEqual(cache.has('key1'), true);
    assert.strictEqual(cache.has('key2'), false);
  });

  test('should delete keys', () => {
    const cache = new SmartCache();

    cache.set('key1', 'value1');

    assert.strictEqual(cache.delete('key1'), true);
    assert.strictEqual(cache.get('key1'), undefined);
    assert.strictEqual(cache.delete('key1'), false); // Already deleted
  });

  test('should clear all entries', () => {
    const cache = new SmartCache();

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    cache.clear();

    assert.strictEqual(cache.size(), 0);
    assert.strictEqual(cache.get('key1'), undefined);
  });

  test('should track cache size', () => {
    const cache = new SmartCache();

    assert.strictEqual(cache.size(), 0);

    cache.set('key1', 'value1');
    assert.strictEqual(cache.size(), 1);

    cache.set('key2', 'value2');
    assert.strictEqual(cache.size(), 2);

    cache.delete('key1');
    assert.strictEqual(cache.size(), 1);
  });

  test('should get all keys', () => {
    const cache = new SmartCache();

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    const keys = cache.keys();

    assert.strictEqual(keys.length, 2);
    assert.ok(keys.includes('key1'));
    assert.ok(keys.includes('key2'));
  });

  test('should get all values', () => {
    const cache = new SmartCache();

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    const values = cache.values();

    assert.strictEqual(values.length, 2);
    assert.ok(values.includes('value1'));
    assert.ok(values.includes('value2'));
  });

  test('should get all entries', () => {
    const cache = new SmartCache();

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    const entries = cache.entries();

    assert.strictEqual(entries.length, 2);
    assert.deepStrictEqual(entries[0], ['key1', 'value1']);
    assert.deepStrictEqual(entries[1], ['key2', 'value2']);
  });

  test('should estimate size correctly', () => {
    const cache = new SmartCache();

    // String
    const str = 'hello';
    const strSize = cache.estimateSize(str);
    assert.strictEqual(strSize, str.length * 2);

    // Buffer
    const buf = Buffer.from('hello');
    const bufSize = cache.estimateSize(buf);
    assert.strictEqual(bufSize, buf.length);

    // Object
    const obj = { key: 'value' };
    const objSize = cache.estimateSize(obj);
    assert.ok(objSize > 0);
  });

  test('should handle memory limits', () => {
    const cache = new SmartCache({
      maxMemory: 100, // 100 bytes
      strategy: 'lru'
    });

    // Add items that exceed memory limit
    cache.set('key1', 'x'.repeat(40), { size: 40 });
    cache.set('key2', 'y'.repeat(40), { size: 40 });
    cache.set('key3', 'z'.repeat(40), { size: 40 }); // Should evict key1

    assert.strictEqual(cache.get('key1'), undefined); // Evicted
    assert.strictEqual(cache.get('key2'), 'y'.repeat(40));
    assert.strictEqual(cache.get('key3'), 'z'.repeat(40));
  });

  test('should cleanup expired entries automatically', async () => {
    const cache = new SmartCache({
      defaultTTL: 50,
      cleanupInterval: 100
    });

    cache.set('key1', 'value1');

    await new Promise(resolve => setTimeout(resolve, 150));

    // Cleanup should have run
    assert.strictEqual(cache.size(), 0);

    // Destroy to prevent hanging
    cache.destroy();
  });
});
