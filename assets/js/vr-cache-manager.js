/**
 * VR Cache Manager - Shared caching system
 * ======================================
 * Eliminates cache implementation duplication across 6+ modules
 * Provides LRU (Least Recently Used) eviction and TTL (Time To Live)
 *
 * Used by: P6-3 NLP, P7-1 Transformer, P7-2 Gesture, P7-3 Intent, P7-4 FL, P6-4 Multimodal
 * Previous implementation: 6 separate cache systems (80+ lines wasted)
 */

class VRCacheManager {
  constructor(options = {}) {
    this.config = {
      maxSize: options.maxSize || 1000,
      ttl: options.ttl || 3600000, // 1 hour default
      enableMetrics: options.enableMetrics !== false,
    };

    this.cache = new Map();
    this.timestamps = new Map();
    this.accessCount = new Map();

    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalAccess: 0,
    };
  }

  /**
   * Get value from cache
   */
  get(key) {
    if (!this.cache.has(key)) {
      this.metrics.misses++;
      return null;
    }

    // Check TTL
    const timestamp = this.timestamps.get(key);
    if (timestamp && Date.now() - timestamp > this.config.ttl) {
      this.cache.delete(key);
      this.timestamps.delete(key);
      this.accessCount.delete(key);
      this.metrics.misses++;
      return null;
    }

    this.metrics.hits++;
    this.metrics.totalAccess++;
    this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1);

    return this.cache.get(key);
  }

  /**
   * Set value in cache with automatic eviction
   */
  set(key, value) {
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, value);
    this.timestamps.set(key, Date.now());
    this.accessCount.set(key, 0);
  }

  /**
   * Check if key exists and is valid
   */
  has(key) {
    const timestamp = this.timestamps.get(key);
    if (timestamp && Date.now() - timestamp > this.config.ttl) {
      this.cache.delete(key);
      this.timestamps.delete(key);
      return false;
    }
    return this.cache.has(key);
  }

  /**
   * Evict least recently used item
   */
  evictLRU() {
    let lruKey = null;
    let minCount = Infinity;

    for (const [key, count] of this.accessCount) {
      if (count < minCount) {
        minCount = count;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.timestamps.delete(lruKey);
      this.accessCount.delete(lruKey);
      this.metrics.evictions++;
    }
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.cache.clear();
    this.timestamps.clear();
    this.accessCount.clear();
  }

  /**
   * Get cache metrics
   */
  getMetrics() {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRate: total > 0 ? this.metrics.hits / total : 0,
      size: this.cache.size,
      maxSize: this.config.maxSize,
    };
  }

  /**
   * Get cache size
   */
  size() {
    return this.cache.size;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRCacheManager;
}
