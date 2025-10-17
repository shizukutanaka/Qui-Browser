/**
 * Auto-cleanup Map - Prevents memory leaks with automatic cleanup
 * @module utils/auto-cleanup-map
 */

/**
 * Map with automatic cleanup of old entries
 * @class AutoCleanupMap
 * @extends Map
 */
class AutoCleanupMap extends Map {
  /**
   * Create an auto-cleanup map
   * @param {Object} options - Configuration options
   * @param {number} options.maxSize - Maximum number of entries (default: 10000)
   * @param {number} options.maxAge - Maximum age in milliseconds (default: 3600000 = 1 hour)
   * @param {number} options.cleanupInterval - Cleanup interval in milliseconds (default: 300000 = 5 minutes)
   */
  constructor(options = {}) {
    super();

    this.maxSize = options.maxSize || 10000;
    this.maxAge = options.maxAge || 3600000; // 1 hour
    this.cleanupInterval = options.cleanupInterval || 300000; // 5 minutes
    this.timestamps = new Map();
    this.cleanupTimer = null;

    // Start automatic cleanup
    this.startAutoCleanup();
  }

  /**
   * Set a value with automatic timestamp tracking
   * @param {*} key - Key
   * @param {*} value - Value
   * @returns {AutoCleanupMap} This map
   */
  set(key, value) {
    // Check size limit before adding
    if (this.size >= this.maxSize && !this.has(key)) {
      this.evictOldest();
    }

    this.timestamps.set(key, Date.now());
    return super.set(key, value);
  }

  /**
   * Delete a value and its timestamp
   * @param {*} key - Key
   * @returns {boolean} True if deleted
   */
  delete(key) {
    this.timestamps.delete(key);
    return super.delete(key);
  }

  /**
   * Clear all entries and timestamps
   */
  clear() {
    this.timestamps.clear();
    super.clear();
  }

  /**
   * Evict the oldest entry
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, time] of this.timestamps.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      this.delete(oldestKey);
    }
  }

  /**
   * Remove expired entries
   * @returns {number} Number of entries removed
   */
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, timestamp] of this.timestamps.entries()) {
      if (now - timestamp > this.maxAge) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }

    return keysToDelete.length;
  }

  /**
   * Start automatic cleanup timer
   */
  startAutoCleanup() {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);

    // Don't prevent process from exiting
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop automatic cleanup timer
   */
  stopAutoCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Get statistics about this map
   * @returns {Object} Statistics
   */
  getStats() {
    const now = Date.now();
    let oldestAge = 0;
    let newestAge = Infinity;

    for (const timestamp of this.timestamps.values()) {
      const age = now - timestamp;
      oldestAge = Math.max(oldestAge, age);
      newestAge = Math.min(newestAge, age);
    }

    return {
      size: this.size,
      maxSize: this.maxSize,
      maxAge: this.maxAge,
      oldestEntryAge: oldestAge,
      newestEntryAge: newestAge === Infinity ? 0 : newestAge,
      utilizationPercent: (this.size / this.maxSize) * 100
    };
  }
}

module.exports = AutoCleanupMap;
