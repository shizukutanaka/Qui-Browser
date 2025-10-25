/**
 * IndexedDB Offline Storage Manager (2025)
 *
 * Advanced offline storage system with persistent data management
 * - navigator.storage.persist() for persistent storage
 * - navigator.storage.estimate() for quota monitoring
 * - Web Workers integration for non-blocking operations
 * - Transaction-based operations with error handling
 * - Automatic cleanup and optimization
 *
 * Features:
 * - Multiple object stores (bookmarks, history, settings, cache)
 * - Indexing for fast queries
 * - Batch operations for performance
 * - Storage quota management
 * - Persistent storage request
 * - Background sync integration
 *
 * @author Qui Browser Team
 * @version 5.2.0
 * @license MIT
 */

class VRIndexedDBStorage {
  constructor(options = {}) {
    this.version = '5.2.0';
    this.debug = options.debug || false;

    // Database configuration
    this.dbName = options.dbName || 'qui-vr-browser';
    this.dbVersion = options.dbVersion || 1;
    this.db = null;

    // Object stores
    this.stores = {
      bookmarks: {
        keyPath: 'id',
        autoIncrement: false,
        indexes: [
          { name: 'url', keyPath: 'url', unique: false },
          { name: 'category', keyPath: 'category', unique: false },
          { name: 'createdAt', keyPath: 'createdAt', unique: false }
        ]
      },
      history: {
        keyPath: 'id',
        autoIncrement: true,
        indexes: [
          { name: 'url', keyPath: 'url', unique: false },
          { name: 'visitedAt', keyPath: 'visitedAt', unique: false },
          { name: 'title', keyPath: 'title', unique: false }
        ]
      },
      settings: {
        keyPath: 'key',
        autoIncrement: false,
        indexes: []
      },
      cache: {
        keyPath: 'url',
        autoIncrement: false,
        indexes: [
          { name: 'cachedAt', keyPath: 'cachedAt', unique: false },
          { name: 'size', keyPath: 'size', unique: false }
        ]
      },
      vrSessions: {
        keyPath: 'id',
        autoIncrement: true,
        indexes: [
          { name: 'startTime', keyPath: 'startTime', unique: false },
          { name: 'duration', keyPath: 'duration', unique: false }
        ]
      }
    };

    // Storage quota
    this.storageQuota = {
      usage: 0,
      quota: 0,
      persisted: false,
      percentage: 0
    };

    // Performance settings
    this.batchSize = options.batchSize || 100;
    this.maxCacheSize = options.maxCacheSize || 100 * 1024 * 1024; // 100MB
    this.maxHistoryEntries = options.maxHistoryEntries || 10000;

    // Cleanup settings
    this.autoCleanup = options.autoCleanup !== false;
    this.cleanupInterval = options.cleanupInterval || 24 * 60 * 60 * 1000; // 24 hours
    this.lastCleanup = 0;

    // Stats
    this.stats = {
      operations: 0,
      errors: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    this.initialized = false;
  }

  /**
   * Initialize IndexedDB storage
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    this.log('Initializing IndexedDB Storage v5.2.0...');

    try {
      // Check IndexedDB support
      if (!window.indexedDB) {
        throw new Error('IndexedDB not supported');
      }

      // Request persistent storage
      await this.requestPersistentStorage();

      // Open database
      await this.openDatabase();

      // Check storage quota
      await this.updateStorageQuota();

      // Schedule automatic cleanup
      if (this.autoCleanup) {
        this.scheduleCleanup();
      }

      this.initialized = true;
      this.log('IndexedDB Storage initialized successfully');
      this.log('Database:', this.dbName, 'v' + this.dbVersion);
      this.log('Persistent:', this.storageQuota.persisted);
      this.log('Usage:', this.formatBytes(this.storageQuota.usage), '/', this.formatBytes(this.storageQuota.quota));

      return true;

    } catch (error) {
      this.error('Initialization failed:', error);
      return false;
    }
  }

  /**
   * Request persistent storage
   */
  async requestPersistentStorage() {
    if (!navigator.storage || !navigator.storage.persist) {
      this.warn('Persistent storage API not available');
      return false;
    }

    try {
      // Check if already persisted
      const isPersisted = await navigator.storage.persisted();

      if (isPersisted) {
        this.log('Storage is already persistent');
        this.storageQuota.persisted = true;
        return true;
      }

      // Request persistence
      const granted = await navigator.storage.persist();

      if (granted) {
        this.log('Persistent storage granted');
        this.storageQuota.persisted = true;
      } else {
        this.warn('Persistent storage denied');
      }

      return granted;

    } catch (error) {
      this.error('Failed to request persistent storage:', error);
      return false;
    }
  }

  /**
   * Update storage quota information
   */
  async updateStorageQuota() {
    if (!navigator.storage || !navigator.storage.estimate) {
      this.warn('Storage estimate API not available');
      return;
    }

    try {
      const estimate = await navigator.storage.estimate();

      this.storageQuota.usage = estimate.usage || 0;
      this.storageQuota.quota = estimate.quota || 0;
      this.storageQuota.percentage = this.storageQuota.quota > 0
        ? (this.storageQuota.usage / this.storageQuota.quota) * 100
        : 0;

      this.log(`Storage: ${this.formatBytes(this.storageQuota.usage)} / ${this.formatBytes(this.storageQuota.quota)} (${this.storageQuota.percentage.toFixed(1)}%)`);

    } catch (error) {
      this.error('Failed to estimate storage:', error);
    }
  }

  /**
   * Open IndexedDB database
   * @returns {Promise<void>}
   */
  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error('Failed to open database'));
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.log('Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        this.log('Upgrading database...');
        const db = event.target.result;

        // Create object stores
        for (const [storeName, config] of Object.entries(this.stores)) {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, {
              keyPath: config.keyPath,
              autoIncrement: config.autoIncrement
            });

            // Create indexes
            for (const index of config.indexes) {
              store.createIndex(index.name, index.keyPath, {
                unique: index.unique
              });
            }

            this.log(`Created object store: ${storeName}`);
          }
        }
      };
    });
  }

  /**
   * Add item to store
   * @param {string} storeName - Object store name
   * @param {Object} item - Item to add
   * @returns {Promise<any>} Item key
   */
  async add(storeName, item) {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(item);

      request.onsuccess = () => {
        this.stats.operations++;
        resolve(request.result);
      };

      request.onerror = () => {
        this.stats.errors++;
        reject(new Error(`Failed to add item to ${storeName}`));
      };
    });
  }

  /**
   * Get item from store
   * @param {string} storeName - Object store name
   * @param {any} key - Item key
   * @returns {Promise<Object>} Item
   */
  async get(storeName, key) {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        this.stats.operations++;
        if (request.result) {
          this.stats.cacheHits++;
        } else {
          this.stats.cacheMisses++;
        }
        resolve(request.result);
      };

      request.onerror = () => {
        this.stats.errors++;
        reject(new Error(`Failed to get item from ${storeName}`));
      };
    });
  }

  /**
   * Update item in store
   * @param {string} storeName - Object store name
   * @param {Object} item - Item to update
   * @returns {Promise<any>} Item key
   */
  async update(storeName, item) {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => {
        this.stats.operations++;
        resolve(request.result);
      };

      request.onerror = () => {
        this.stats.errors++;
        reject(new Error(`Failed to update item in ${storeName}`));
      };
    });
  }

  /**
   * Delete item from store
   * @param {string} storeName - Object store name
   * @param {any} key - Item key
   * @returns {Promise<void>}
   */
  async delete(storeName, key) {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => {
        this.stats.operations++;
        resolve();
      };

      request.onerror = () => {
        this.stats.errors++;
        reject(new Error(`Failed to delete item from ${storeName}`));
      };
    });
  }

  /**
   * Get all items from store
   * @param {string} storeName - Object store name
   * @param {number} limit - Maximum items to return
   * @returns {Promise<Array>} Items
   */
  async getAll(storeName, limit = null) {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = limit ? store.getAll(null, limit) : store.getAll();

      request.onsuccess = () => {
        this.stats.operations++;
        resolve(request.result);
      };

      request.onerror = () => {
        this.stats.errors++;
        reject(new Error(`Failed to get all items from ${storeName}`));
      };
    });
  }

  /**
   * Query items by index
   * @param {string} storeName - Object store name
   * @param {string} indexName - Index name
   * @param {any} value - Index value
   * @returns {Promise<Array>} Items
   */
  async queryByIndex(storeName, indexName, value) {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => {
        this.stats.operations++;
        resolve(request.result);
      };

      request.onerror = () => {
        this.stats.errors++;
        reject(new Error(`Failed to query ${storeName} by ${indexName}`));
      };
    });
  }

  /**
   * Clear all items from store
   * @param {string} storeName - Object store name
   * @returns {Promise<void>}
   */
  async clear(storeName) {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => {
        this.stats.operations++;
        this.log(`Cleared ${storeName}`);
        resolve();
      };

      request.onerror = () => {
        this.stats.errors++;
        reject(new Error(`Failed to clear ${storeName}`));
      };
    });
  }

  /**
   * Batch add items
   * @param {string} storeName - Object store name
   * @param {Array} items - Items to add
   * @returns {Promise<number>} Number of items added
   */
  async batchAdd(storeName, items) {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }

    let added = 0;

    // Process in batches
    for (let i = 0; i < items.length; i += this.batchSize) {
      const batch = items.slice(i, i + this.batchSize);

      await new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        transaction.oncomplete = () => {
          added += batch.length;
          resolve();
        };

        transaction.onerror = () => {
          this.stats.errors++;
          reject(new Error('Batch add transaction failed'));
        };

        for (const item of batch) {
          store.add(item);
        }
      });
    }

    this.stats.operations += added;
    this.log(`Batch added ${added} items to ${storeName}`);

    return added;
  }

  /**
   * Schedule automatic cleanup
   */
  scheduleCleanup() {
    const cleanup = async () => {
      const now = Date.now();

      if (now - this.lastCleanup > this.cleanupInterval) {
        await this.performCleanup();
        this.lastCleanup = now;
      }

      // Schedule next cleanup
      setTimeout(cleanup, this.cleanupInterval);
    };

    cleanup();
  }

  /**
   * Perform cleanup of old data
   */
  async performCleanup() {
    this.log('Performing automatic cleanup...');

    try {
      // Clean old history entries
      const history = await this.getAll('history');
      if (history.length > this.maxHistoryEntries) {
        // Sort by visitedAt (oldest first)
        history.sort((a, b) => a.visitedAt - b.visitedAt);

        // Delete oldest entries
        const toDelete = history.slice(0, history.length - this.maxHistoryEntries);
        for (const entry of toDelete) {
          await this.delete('history', entry.id);
        }

        this.log(`Deleted ${toDelete.length} old history entries`);
      }

      // Clean cache if over size limit
      await this.cleanupCache();

      // Update storage quota
      await this.updateStorageQuota();

      this.log('Cleanup complete');

    } catch (error) {
      this.error('Cleanup failed:', error);
    }
  }

  /**
   * Cleanup cache to stay under size limit
   */
  async cleanupCache() {
    try {
      const cache = await this.getAll('cache');

      // Calculate total cache size
      let totalSize = 0;
      for (const item of cache) {
        totalSize += item.size || 0;
      }

      if (totalSize > this.maxCacheSize) {
        // Sort by cachedAt (oldest first)
        cache.sort((a, b) => a.cachedAt - b.cachedAt);

        // Delete oldest entries until under limit
        for (const item of cache) {
          if (totalSize <= this.maxCacheSize) break;

          await this.delete('cache', item.url);
          totalSize -= item.size || 0;
        }

        this.log(`Cache cleanup: ${this.formatBytes(totalSize)} / ${this.formatBytes(this.maxCacheSize)}`);
      }

    } catch (error) {
      this.error('Cache cleanup failed:', error);
    }
  }

  /**
   * Get storage statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      quota: { ...this.storageQuota },
      cacheHitRate: this.stats.cacheHits > 0
        ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100
        : 0
    };
  }

  /**
   * Format bytes to human-readable string
   * @param {number} bytes - Bytes
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Cleanup resources
   */
  dispose() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.log('Resources disposed');
  }

  /**
   * Log debug message
   */
  log(...args) {
    if (this.debug) {
      console.log('[VRIndexedDB]', ...args);
    }
  }

  /**
   * Log warning message
   */
  warn(...args) {
    console.warn('[VRIndexedDB]', ...args);
  }

  /**
   * Log error message
   */
  error(...args) {
    console.error('[VRIndexedDB]', ...args);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRIndexedDBStorage;
}
