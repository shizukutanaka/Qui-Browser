/**
 * Advanced Cache Manager with LRU/LFU/TTL Support
 *
 * Provides multiple caching strategies and eviction policies
 */

const EventEmitter = require('events');

class CacheEntry {
  constructor(key, value, options = {}) {
    this.key = key;
    this.value = value;
    this.size = options.size || this.calculateSize(value);
    this.createdAt = Date.now();
    this.lastAccessedAt = this.createdAt;
    this.accessCount = 0;
    this.ttl = options.ttl || 0; // 0 means no expiration
    this.priority = options.priority || 1; // Higher priority = less likely to be evicted
    this.evictionScore = 0;
  }

  calculateSize(value) {
    if (Buffer.isBuffer(value)) {
      return value.length;
    }
    if (typeof value === 'string') {
      return Buffer.byteLength(value, 'utf8');
    }
    // For objects, estimate size
    return JSON.stringify(value).length;
  }

  isExpired() {
    if (this.ttl === 0) return false;
    return Date.now() - this.createdAt > this.ttl;
  }

  access() {
    this.lastAccessedAt = Date.now();
    this.accessCount++;
    return this;
  }

  updateEvictionScore(strategy = 'lru') {
    switch (strategy) {
      case 'lru':
        this.evictionScore = this.lastAccessedAt;
        break;
      case 'lfu':
        this.evictionScore = this.accessCount;
        break;
      case 'size':
        this.evictionScore = this.size;
        break;
      case 'priority':
        this.evictionScore = this.priority;
        break;
      case 'combined':
        // Combined score: priority * access frequency / size
        this.evictionScore = (this.priority * this.accessCount) / Math.max(this.size, 1);
        break;
      default:
        this.evictionScore = this.lastAccessedAt;
    }
    return this.evictionScore;
  }

  toJSON() {
    return {
      key: this.key,
      size: this.size,
      createdAt: this.createdAt,
      lastAccessedAt: this.lastAccessedAt,
      accessCount: this.accessCount,
      ttl: this.ttl,
      priority: this.priority
    };
  }
}

class AdvancedCacheManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.maxSize = options.maxSize || 100 * 1024 * 1024; // 100MB default
    this.maxEntries = options.maxEntries || 10000;
    this.defaultTTL = options.defaultTTL || 3600000; // 1 hour
    this.evictionStrategy = options.evictionStrategy || 'lru'; // lru, lfu, size, priority, combined
    this.cleanupInterval = options.cleanupInterval || 300000; // 5 minutes

    this.entries = new Map();
    this.size = 0;
    this.accessOrder = []; // For LRU tracking
    this.sizeOrder = []; // For size-based eviction

    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0,
      deletes: 0,
      expirations: 0,
      size: 0,
      entries: 0
    };

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Set a cache entry
   */
  set(key, value, options = {}) {
    const ttl = options.ttl || this.defaultTTL;
    const priority = options.priority || 1;

    // Remove existing entry if it exists
    this.delete(key);

    const entry = new CacheEntry(key, value, { ttl, priority });

    // Check if we need to evict before adding
    this.ensureCapacity(entry.size);

    // Add the entry
    this.entries.set(key, entry);
    this.size += entry.size;
    this.updateOrders(entry);
    this.stats.sets++;
    this.stats.entries++;
    this.stats.size = this.size;

    this.emit('set', { key, entry: entry.toJSON() });

    return entry;
  }

  /**
   * Get a cache entry
   */
  get(key) {
    const entry = this.entries.get(key);

    if (!entry) {
      this.stats.misses++;
      this.emit('miss', { key });
      return null;
    }

    if (entry.isExpired()) {
      this.delete(key);
      this.stats.expirations++;
      this.emit('expire', { key, entry: entry.toJSON() });
      return null;
    }

    entry.access();
    this.updateOrders(entry);
    this.stats.hits++;

    this.emit('hit', { key, entry: entry.toJSON() });

    return entry.value;
  }

  /**
   * Delete a cache entry
   */
  delete(key) {
    const entry = this.entries.get(key);
    if (!entry) return false;

    this.entries.delete(key);
    this.size -= entry.size;
    this.removeFromOrders(entry);
    this.stats.deletes++;
    this.stats.entries--;
    this.stats.size = this.size;

    this.emit('delete', { key, entry: entry.toJSON() });

    return true;
  }

  /**
   * Check if key exists
   */
  has(key) {
    const entry = this.entries.get(key);
    return entry && !entry.isExpired();
  }

  /**
   * Clear all entries
   */
  clear() {
    const count = this.entries.size;
    this.entries.clear();
    this.accessOrder.length = 0;
    this.sizeOrder.length = 0;
    this.size = 0;

    this.stats.entries = 0;
    this.stats.size = 0;

    this.emit('clear', { count });
  }

  /**
   * Get cache size in bytes
   */
  getSize() {
    return this.size;
  }

  /**
   * Get number of entries
   */
  getEntryCount() {
    return this.entries.size;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? this.stats.hits / (this.stats.hits + this.stats.misses)
      : 0;

    return {
      ...this.stats,
      hitRate,
      hitRatePercent: Math.round(hitRate * 100 * 100) / 100,
      maxSize: this.maxSize,
      maxEntries: this.maxEntries,
      currentSize: this.size,
      currentEntries: this.entries.size,
      utilizationPercent: Math.round((this.size / this.maxSize) * 100 * 100) / 100
    };
  }

  /**
   * Ensure there's capacity for a new entry
   */
  ensureCapacity(requiredSize) {
    // Check entry count limit
    while (this.entries.size >= this.maxEntries) {
      this.evictOne();
    }

    // Check size limit
    while (this.size + requiredSize > this.maxSize) {
      if (!this.evictOne()) break; // Can't evict more
    }
  }

  /**
   * Evict one entry based on current strategy
   */
  evictOne() {
    if (this.entries.size === 0) return false;

    let entryToEvict = null;
    let worstScore = Infinity;

    for (const entry of this.entries.values()) {
      const score = entry.updateEvictionScore(this.evictionStrategy);

      // For LRU, lower timestamp is worse (older)
      // For LFU, lower access count is worse
      // For size, higher size is worse
      // For priority, lower priority is worse
      // For combined, lower score is worse

      let isWorse = false;
      switch (this.evictionStrategy) {
        case 'lru':
          isWorse = score < worstScore;
          break;
        case 'lfu':
          isWorse = score < worstScore;
          break;
        case 'size':
          isWorse = score > worstScore;
          break;
        case 'priority':
          isWorse = score < worstScore;
          break;
        case 'combined':
          isWorse = score < worstScore;
          break;
        default:
          isWorse = score < worstScore;
      }

      if (isWorse) {
        worstScore = score;
        entryToEvict = entry;
      }
    }

    if (entryToEvict) {
      this.delete(entryToEvict.key);
      this.stats.evictions++;
      return true;
    }

    return false;
  }

  /**
   * Update ordering arrays for eviction
   */
  updateOrders(entry) {
    // Remove from current positions
    this.removeFromOrders(entry);

    // Add to access order (most recent first)
    this.accessOrder.unshift(entry);

    // Add to size order (largest first)
    const sizeIndex = this.sizeOrder.findIndex(e => e.size <= entry.size);
    if (sizeIndex === -1) {
      this.sizeOrder.push(entry);
    } else {
      this.sizeOrder.splice(sizeIndex, 0, entry);
    }
  }

  /**
   * Remove entry from ordering arrays
   */
  removeFromOrders(entry) {
    const accessIndex = this.accessOrder.indexOf(entry);
    if (accessIndex > -1) {
      this.accessOrder.splice(accessIndex, 1);
    }

    const sizeIndex = this.sizeOrder.indexOf(entry);
    if (sizeIndex > -1) {
      this.sizeOrder.splice(sizeIndex, 1);
    }
  }

  /**
   * Start periodic cleanup
   */
  startCleanupInterval() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Manual cleanup of expired entries
   */
  cleanup() {
    const expiredKeys = [];

    for (const [key, entry] of this.entries) {
      if (entry.isExpired()) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.delete(key);
      this.stats.expirations++;
    }

    if (expiredKeys.length > 0) {
      this.emit('cleanup', { expiredCount: expiredKeys.length });
    }
  }

  /**
   * Get all entries (for debugging)
   */
  getEntries() {
    const result = {};
    for (const [key, entry] of this.entries) {
      result[key] = entry.toJSON();
    }
    return result;
  }

  /**
   * Set eviction strategy
   */
  setEvictionStrategy(strategy) {
    if (!['lru', 'lfu', 'size', 'priority', 'combined'].includes(strategy)) {
      throw new Error(`Invalid eviction strategy: ${strategy}`);
    }

    this.evictionStrategy = strategy;
    this.emit('strategyChanged', { strategy });
  }

  /**
   * Resize cache
   */
  resize(maxSize, maxEntries) {
    this.maxSize = maxSize || this.maxSize;
    this.maxEntries = maxEntries || this.maxEntries;

    // Evict if necessary
    this.ensureCapacity(0);

    this.emit('resized', { maxSize: this.maxSize, maxEntries: this.maxEntries });
  }

  /**
   * Destroy cache and cleanup
   */
  destroy() {
    this.stopCleanupInterval();
    this.clear();
    this.removeAllListeners();
  }
}

module.exports = {
  AdvancedCacheManager,
  CacheEntry
};
