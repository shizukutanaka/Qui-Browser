/**
 * Smart Cache with Multiple Eviction Strategies
 * Supports LRU, LFU, TTL, and adaptive caching
 * @module utils/smart-cache
 */

/**
 * @typedef {Object} CacheEntry
 * @property {*} value - Cached value
 * @property {number} accessCount - Number of times accessed
 * @property {number} lastAccess - Timestamp of last access
 * @property {number} created - Timestamp when created
 * @property {number} [ttl] - Time to live in milliseconds
 * @property {number} size - Size in bytes
 */

class SmartCache {
  /**
   * Create a smart cache
   * @param {Object} options - Configuration options
   * @param {number} [options.maxSize=1000] - Maximum number of entries
   * @param {number} [options.maxMemory] - Maximum memory in bytes
   * @param {string} [options.strategy='lru'] - Eviction strategy (lru, lfu, ttl, adaptive)
   * @param {number} [options.defaultTTL] - Default TTL in milliseconds
   * @param {number} [options.cleanupInterval=60000] - Cleanup interval
   */
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;
    this.maxMemory = options.maxMemory;
    this.strategy = options.strategy || 'lru';
    this.defaultTTL = options.defaultTTL;
    this.cleanupInterval = options.cleanupInterval || 60000;

    // Cache storage
    this.cache = new Map();

    // Access order (for LRU)
    this.accessOrder = [];

    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      expirations: 0,
      totalSize: 0,
      totalMemory: 0
    };

    // Start cleanup interval
    this.cleanupTimer = setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check TTL
    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.expirations++;
      this.stats.misses++;
      return undefined;
    }

    // Update access metadata
    entry.accessCount++;
    entry.lastAccess = Date.now();

    // Update access order for LRU
    if (this.strategy === 'lru' || this.strategy === 'adaptive') {
      this.updateAccessOrder(key);
    }

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {Object} [options] - Set options
   * @param {number} [options.ttl] - TTL in milliseconds
   * @param {number} [options.size] - Size in bytes
   * @returns {boolean} True if set successfully
   */
  set(key, value, options = {}) {
    const size = options.size || this.estimateSize(value);
    const ttl = options.ttl || this.defaultTTL;

    // Check if we need to evict
    if (this.cache.size >= this.maxSize || (this.maxMemory && this.wouldExceedMemory(size))) {
      const evicted = this.evict(size);
      if (!evicted && this.cache.size >= this.maxSize) {
        return false; // Could not make room
      }
    }

    const entry = {
      value,
      accessCount: 0,
      lastAccess: Date.now(),
      created: Date.now(),
      ttl,
      size
    };

    // Update existing or add new
    const existing = this.cache.get(key);
    if (existing) {
      this.stats.totalMemory -= existing.size;
    } else {
      this.stats.totalSize++;
    }

    this.cache.set(key, entry);
    this.stats.totalMemory += size;
    this.stats.sets++;

    // Update access order for LRU
    if (this.strategy === 'lru' || this.strategy === 'adaptive') {
      this.updateAccessOrder(key);
    }

    return true;
  }

  /**
   * Delete key from cache
   * @param {string} key - Cache key
   * @returns {boolean} True if deleted
   */
  delete(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    this.cache.delete(key);
    this.stats.totalSize--;
    this.stats.totalMemory -= entry.size;

    // Remove from access order
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }

    return true;
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {boolean} True if exists and not expired
   */
  has(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
    this.stats.totalSize = 0;
    this.stats.totalMemory = 0;
  }

  /**
   * Get cache size
   * @returns {number} Number of entries
   */
  size() {
    return this.cache.size;
  }

  /**
   * Check if entry is expired
   * @param {CacheEntry} entry - Cache entry
   * @returns {boolean} True if expired
   */
  isExpired(entry) {
    if (!entry.ttl) {
      return false;
    }
    return Date.now() - entry.created > entry.ttl;
  }

  /**
   * Check if adding size would exceed memory limit
   * @param {number} size - Size to add
   * @returns {boolean} True if would exceed
   */
  wouldExceedMemory(size) {
    if (!this.maxMemory) {
      return false;
    }
    return this.stats.totalMemory + size > this.maxMemory;
  }

  /**
   * Estimate size of value in bytes
   * @param {*} value - Value to estimate
   * @returns {number} Estimated size
   */
  estimateSize(value) {
    if (Buffer.isBuffer(value)) {
      return value.length;
    }

    if (typeof value === 'string') {
      return value.length * 2; // UTF-16
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value).length * 2;
      } catch {
        return 1024; // Default estimate
      }
    }

    return 8; // Primitive types
  }

  /**
   * Update access order for LRU
   * @param {string} key - Cache key
   */
  updateAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Evict entries to make room
   * @param {number} sizeNeeded - Size needed in bytes
   * @returns {boolean} True if successfully made room
   */
  evict(sizeNeeded = 0) {
    if (this.cache.size === 0) {
      return false;
    }

    let freedMemory = 0;
    let evicted = false;

    while (
      (this.cache.size >= this.maxSize || (this.maxMemory && this.stats.totalMemory + sizeNeeded > this.maxMemory)) &&
      this.cache.size > 0
    ) {
      const keyToEvict = this.selectEvictionCandidate();
      if (!keyToEvict) {
        break;
      }

      const entry = this.cache.get(keyToEvict);
      if (entry) {
        freedMemory += entry.size;
      }

      this.delete(keyToEvict);
      this.stats.evictions++;
      evicted = true;

      // Check if we've freed enough memory
      if (this.maxMemory && freedMemory >= sizeNeeded) {
        break;
      }
    }

    return evicted;
  }

  /**
   * Select candidate for eviction based on strategy
   * @returns {string|null} Key to evict
   */
  selectEvictionCandidate() {
    if (this.cache.size === 0) {
      return null;
    }

    switch (this.strategy) {
      case 'lru':
        return this.selectLRU();
      case 'lfu':
        return this.selectLFU();
      case 'ttl':
        return this.selectTTL();
      case 'adaptive':
        return this.selectAdaptive();
      default:
        return this.selectLRU();
    }
  }

  /**
   * Select least recently used entry
   * @returns {string|null} Key to evict
   */
  selectLRU() {
    return this.accessOrder[0] || null;
  }

  /**
   * Select least frequently used entry
   * @returns {string|null} Key to evict
   */
  selectLFU() {
    let minAccessCount = Infinity;
    let candidate = null;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < minAccessCount) {
        minAccessCount = entry.accessCount;
        candidate = key;
      }
    }

    return candidate;
  }

  /**
   * Select entry closest to expiration
   * @returns {string|null} Key to evict
   */
  selectTTL() {
    let minTimeLeft = Infinity;
    let candidate = null;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (!entry.ttl) {
        continue;
      }

      const timeLeft = entry.ttl - (now - entry.created);
      if (timeLeft < minTimeLeft) {
        minTimeLeft = timeLeft;
        candidate = key;
      }
    }

    return candidate || this.selectLRU(); // Fallback to LRU
  }

  /**
   * Adaptive eviction combining multiple strategies
   * @returns {string|null} Key to evict
   */
  selectAdaptive() {
    const hitRate = this.getHitRate();

    // If hit rate is low, use LFU to remove unused items
    if (hitRate < 0.5) {
      return this.selectLFU();
    }

    // If hit rate is high, use LRU to keep frequently accessed items
    return this.selectLRU();
  }

  /**
   * Cleanup expired entries
   * @returns {number} Number of entries cleaned up
   */
  cleanup() {
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.delete(key);
        this.stats.expirations++;
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get cache statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      hitRate: this.getHitRate(),
      size: this.cache.size,
      maxSize: this.maxSize,
      memoryUsage: this.stats.totalMemory,
      maxMemory: this.maxMemory,
      memoryUsagePercent: this.maxMemory ? (this.stats.totalMemory / this.maxMemory) * 100 : 0,
      strategy: this.strategy
    };
  }

  /**
   * Get hit rate
   * @returns {number} Hit rate between 0 and 1
   */
  getHitRate() {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Get all keys
   * @returns {string[]} Array of keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all values
   * @returns {*[]} Array of values
   */
  values() {
    const values = [];
    for (const entry of this.cache.values()) {
      if (!this.isExpired(entry)) {
        values.push(entry.value);
      }
    }
    return values;
  }

  /**
   * Get all entries
   * @returns {Array<[string, *]>} Array of [key, value] pairs
   */
  entries() {
    const entries = [];
    for (const [key, entry] of this.cache.entries()) {
      if (!this.isExpired(entry)) {
        entries.push([key, entry.value]);
      }
    }
    return entries;
  }

  /**
   * Destroy the cache
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

module.exports = SmartCache;
