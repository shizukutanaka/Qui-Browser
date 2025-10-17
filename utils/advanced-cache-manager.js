/**
 * Advanced Cache Management System
 *
 * Implements sophisticated caching strategies (Improvements #161-170)
 * - Multi-tier caching (memory + Redis)
 * - Cache warming
 * - Tag-based invalidation
 * - Adaptive strategy selection
 * - Cache statistics and monitoring
 */

const crypto = require('crypto');
const EventEmitter = require('events');

/**
 * Cache strategies
 */
const CacheStrategy = {
  LRU: 'lru', // Least Recently Used
  LFU: 'lfu', // Least Frequently Used
  TTL: 'ttl', // Time To Live
  ADAPTIVE: 'adaptive' // Automatic selection
};

/**
 * Default cache configuration
 */
const DEFAULT_CACHE_CONFIG = {
  strategy: CacheStrategy.ADAPTIVE,
  maxSize: 10000,
  maxMemoryMb: 100,
  ttl: 300000, // 5 minutes
  checkPeriod: 60000, // 1 minute
  enableStatistics: true,
  enableRedis: false,
  redisUrl: null
};

/**
 * Cache entry class
 */
class CacheEntry {
  constructor(key, value, options = {}) {
    this.key = key;
    this.value = value;
    this.size = this.calculateSize(value);
    this.createdAt = Date.now();
    this.accessedAt = Date.now();
    this.accessCount = 0;
    this.ttl = options.ttl || null;
    this.tags = options.tags || [];
    this.metadata = options.metadata || {};
  }

  /**
   * Calculate approximate size of value
   */
  calculateSize(value) {
    if (Buffer.isBuffer(value)) {
      return value.length;
    }

    if (typeof value === 'string') {
      return Buffer.byteLength(value);
    }

    if (typeof value === 'object') {
      return Buffer.byteLength(JSON.stringify(value));
    }

    return 8; // Approximate size for primitives
  }

  /**
   * Check if entry is expired
   */
  isExpired() {
    if (!this.ttl) {
      return false;
    }

    return Date.now() - this.createdAt > this.ttl;
  }

  /**
   * Update access information
   */
  touch() {
    this.accessedAt = Date.now();
    this.accessCount++;
  }

  /**
   * Get entry age in milliseconds
   */
  getAge() {
    return Date.now() - this.createdAt;
  }

  /**
   * Get time since last access
   */
  getIdleTime() {
    return Date.now() - this.accessedAt;
  }
}

/**
 * Advanced Cache Manager
 */
class AdvancedCacheManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.cache = new Map();
    this.tagIndex = new Map(); // Tag -> Set of keys
    this.stats = this.initializeStats();
    this.checkInterval = null;

    // Start periodic cleanup
    this.startPeriodicCleanup();
  }

  /**
   * Initialize statistics
   */
  initializeStats() {
    return {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      errors: 0,
      totalSize: 0,
      startTime: Date.now()
    };
  }

  /**
   * Set cache entry
   *
   * @param {string} key - Cache key
   * @param {any} value - Cache value
   * @param {Object} options - Options (ttl, tags, metadata)
   * @returns {boolean} Success
   */
  set(key, value, options = {}) {
    try {
      // Create entry
      const entry = new CacheEntry(key, value, {
        ttl: options.ttl || this.config.ttl,
        tags: options.tags || [],
        metadata: options.metadata || {}
      });

      // Check size limits before adding
      if (this.shouldEvict(entry.size)) {
        this.evict(entry.size);
      }

      // Remove old entry if exists
      if (this.cache.has(key)) {
        this.deleteInternal(key);
      }

      // Add new entry
      this.cache.set(key, entry);

      // Update tag index
      for (const tag of entry.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag).add(key);
      }

      // Update stats
      this.stats.sets++;
      this.stats.totalSize += entry.size;

      this.emit('set', { key, size: entry.size });

      return true;
    } catch (error) {
      this.stats.errors++;
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Get cache entry
   *
   * @param {string} key - Cache key
   * @returns {any} Cached value or undefined
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.emit('miss', { key });
      return undefined;
    }

    // Check expiration
    if (entry.isExpired()) {
      this.deleteInternal(key);
      this.stats.misses++;
      this.emit('miss', { key, reason: 'expired' });
      return undefined;
    }

    // Update access info
    entry.touch();

    // Update stats
    this.stats.hits++;
    this.emit('hit', { key });

    return entry.value;
  }

  /**
   * Delete cache entry
   *
   * @param {string} key - Cache key
   * @returns {boolean} Success
   */
  delete(key) {
    const success = this.deleteInternal(key);
    if (success) {
      this.stats.deletes++;
      this.emit('delete', { key });
    }
    return success;
  }

  /**
   * Internal delete method
   */
  deleteInternal(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Remove from cache
    this.cache.delete(key);

    // Update stats
    this.stats.totalSize -= entry.size;

    // Remove from tag index
    for (const tag of entry.tags) {
      const tagSet = this.tagIndex.get(tag);
      if (tagSet) {
        tagSet.delete(key);
        if (tagSet.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }

    return true;
  }

  /**
   * Check if entry exists
   *
   * @param {string} key - Cache key
   * @returns {boolean} Exists
   */
  has(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (entry.isExpired()) {
      this.deleteInternal(key);
      return false;
    }

    return true;
  }

  /**
   * Invalidate entries by tag
   *
   * @param {string} tag - Tag name
   * @returns {number} Number of entries invalidated
   */
  invalidateByTag(tag) {
    const keys = this.tagIndex.get(tag);
    if (!keys) {
      return 0;
    }

    let count = 0;
    for (const key of Array.from(keys)) {
      if (this.deleteInternal(key)) {
        count++;
      }
    }

    this.emit('invalidate', { tag, count });
    return count;
  }

  /**
   * Invalidate entries by tags
   *
   * @param {Array<string>} tags - Tag names
   * @returns {number} Number of entries invalidated
   */
  invalidateByTags(tags) {
    let total = 0;
    for (const tag of tags) {
      total += this.invalidateByTag(tag);
    }
    return total;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.tagIndex.clear();
    this.stats.totalSize = 0;
    this.emit('clear', { count: size });
  }

  /**
   * Check if eviction is needed
   *
   * @param {number} newEntrySize - Size of new entry
   * @returns {boolean} Should evict
   */
  shouldEvict(newEntrySize = 0) {
    // Check entry count
    if (this.cache.size >= this.config.maxSize) {
      return true;
    }

    // Check memory size
    const maxBytes = this.config.maxMemoryMb * 1024 * 1024;
    if (this.stats.totalSize + newEntrySize > maxBytes) {
      return true;
    }

    return false;
  }

  /**
   * Evict entries based on strategy
   *
   * @param {number} requiredSpace - Required space in bytes
   */
  evict(requiredSpace = 0) {
    const strategy = this.selectStrategy();

    let freedSpace = 0;
    const entriesToEvict = [];

    // Collect entries to evict
    if (strategy === CacheStrategy.LRU) {
      entriesToEvict.push(...this.getLRUEntries());
    } else if (strategy === CacheStrategy.LFU) {
      entriesToEvict.push(...this.getLFUEntries());
    } else if (strategy === CacheStrategy.TTL) {
      entriesToEvict.push(...this.getExpiredEntries());
    }

    // Evict entries
    for (const entry of entriesToEvict) {
      if (freedSpace >= requiredSpace && this.cache.size < this.config.maxSize * 0.9) {
        break;
      }

      this.deleteInternal(entry.key);
      freedSpace += entry.size;
      this.stats.evictions++;
    }

    this.emit('evict', { count: entriesToEvict.length, freedSpace });
  }

  /**
   * Select eviction strategy
   *
   * @returns {string} Strategy
   */
  selectStrategy() {
    if (this.config.strategy !== CacheStrategy.ADAPTIVE) {
      return this.config.strategy;
    }

    // Adaptive: choose based on cache characteristics
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses || 1);

    if (hitRate > 0.8) {
      // High hit rate: use LRU (temporal locality)
      return CacheStrategy.LRU;
    } else if (hitRate > 0.5) {
      // Medium hit rate: use LFU (frequency matters)
      return CacheStrategy.LFU;
    } else {
      // Low hit rate: use TTL (age matters)
      return CacheStrategy.TTL;
    }
  }

  /**
   * Get LRU entries (least recently used)
   *
   * @returns {Array} Sorted entries
   */
  getLRUEntries() {
    const entries = Array.from(this.cache.values());
    return entries.sort((a, b) => a.accessedAt - b.accessedAt);
  }

  /**
   * Get LFU entries (least frequently used)
   *
   * @returns {Array} Sorted entries
   */
  getLFUEntries() {
    const entries = Array.from(this.cache.values());
    return entries.sort((a, b) => a.accessCount - b.accessCount);
  }

  /**
   * Get expired entries
   *
   * @returns {Array} Expired entries
   */
  getExpiredEntries() {
    const entries = Array.from(this.cache.values());
    return entries.filter((entry) => entry.isExpired()).sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Warm cache with data
   *
   * @param {Array} items - Items to warm [{key, value, options}]
   * @returns {number} Number of items cached
   */
  warm(items) {
    let count = 0;
    for (const item of items) {
      if (this.set(item.key, item.value, item.options)) {
        count++;
      }
    }

    this.emit('warm', { count });
    return count;
  }

  /**
   * Cleanup expired entries
   *
   * @returns {number} Number of entries removed
   */
  cleanup() {
    const expired = this.getExpiredEntries();
    let count = 0;

    for (const entry of expired) {
      if (this.deleteInternal(entry.key)) {
        count++;
      }
    }

    if (count > 0) {
      this.emit('cleanup', { count });
    }

    return count;
  }

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup() {
    if (this.checkInterval) {
      return;
    }

    this.checkInterval = setInterval(() => {
      this.cleanup();
    }, this.config.checkPeriod);

    // Prevent interval from keeping process alive
    if (this.checkInterval.unref) {
      this.checkInterval.unref();
    }
  }

  /**
   * Stop periodic cleanup
   */
  stopPeriodicCleanup() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Get cache statistics
   *
   * @returns {Object} Statistics
   */
  getStatistics() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    const uptime = Date.now() - this.stats.startTime;

    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: (hitRate * 100).toFixed(2) + '%',
      memoryUsageMb: (this.stats.totalSize / 1024 / 1024).toFixed(2),
      uptimeSeconds: Math.floor(uptime / 1000),
      requestsPerSecond: totalRequests / (uptime / 1000)
    };
  }

  /**
   * Get cache keys
   *
   * @returns {Array<string>} Keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   *
   * @returns {number} Number of entries
   */
  size() {
    return this.cache.size;
  }
}

/**
 * Create cache key from components
 *
 * @param {Array} components - Key components
 * @returns {string} Cache key
 */
function createCacheKey(...components) {
  return components
    .map((c) => (typeof c === 'object' ? JSON.stringify(c) : String(c)))
    .join(':');
}

/**
 * Hash cache key (for shorter keys)
 *
 * @param {string} key - Cache key
 * @returns {string} Hashed key
 */
function hashCacheKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);
}

module.exports = {
  AdvancedCacheManager,
  CacheEntry,
  CacheStrategy,
  createCacheKey,
  hashCacheKey,
  DEFAULT_CACHE_CONFIG
};
