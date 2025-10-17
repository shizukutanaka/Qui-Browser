/**
 * Request Deduplication System
 * Prevents duplicate requests and optimizes resource usage
 *
 * @module utils/request-deduplication
 */

const crypto = require('crypto');

/**
 * Request Deduplicator
 * Deduplicates concurrent identical requests
 *
 * @class RequestDeduplicator
 * @description Provides request deduplication:
 * - Prevents duplicate concurrent requests
 * - Shares results between duplicate requests
 * - Reduces server load
 * - Optimizes network usage
 */
class RequestDeduplicator {
  /**
   * Create request deduplicator
   * @param {Object} options - Configuration options
   * @param {number} [options.ttl=5000] - Request TTL (ms)
   * @param {boolean} [options.enableHashing=true] - Enable request hashing
   * @param {number} [options.maxPending=1000] - Max pending requests
   */
  constructor(options = {}) {
    this.ttl = options.ttl || 5000;
    this.enableHashing = options.enableHashing !== false;
    this.maxPending = options.maxPending || 1000;

    this.pending = new Map();
    this.results = new Map();

    this.stats = {
      total: 0,
      deduplicated: 0,
      completed: 0,
      failed: 0,
      expired: 0
    };

    this.startCleanupTimer();
  }

  /**
   * Execute request with deduplication
   * @param {string|Object} request - Request identifier or object
   * @param {Function} executor - Function to execute
   * @returns {Promise<*>} - Request result
   */
  async execute(request, executor) {
    this.stats.total++;

    // Generate request key
    const key = this.generateKey(request);

    // Check if request is already pending
    if (this.pending.has(key)) {
      this.stats.deduplicated++;
      return this.pending.get(key);
    }

    // Check if result is cached
    const cached = this.results.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      this.stats.deduplicated++;
      return cached.value;
    }

    // Check max pending limit
    if (this.pending.size >= this.maxPending) {
      throw new Error('Too many pending requests');
    }

    // Execute request
    const promise = this.executeRequest(key, executor);

    // Store pending promise
    this.pending.set(key, promise);

    return promise;
  }

  /**
   * Execute request
   * @private
   * @param {string} key - Request key
   * @param {Function} executor - Executor function
   * @returns {Promise<*>} - Result
   */
  async executeRequest(key, executor) {
    try {
      const result = await executor();

      // Cache result
      this.results.set(key, {
        value: result,
        expiresAt: Date.now() + this.ttl
      });

      this.stats.completed++;

      return result;
    } catch (error) {
      this.stats.failed++;
      throw error;
    } finally {
      // Remove from pending
      this.pending.delete(key);
    }
  }

  /**
   * Generate request key
   * @private
   * @param {string|Object} request - Request
   * @returns {string} - Key
   */
  generateKey(request) {
    if (typeof request === 'string') {
      return request;
    }

    if (!this.enableHashing) {
      return JSON.stringify(request);
    }

    // Hash for efficiency
    const data = JSON.stringify(request);
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Start cleanup timer
   * @private
   */
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 10000); // Every 10 seconds
  }

  /**
   * Cleanup expired results
   * @private
   */
  cleanup() {
    const now = Date.now();
    let expired = 0;

    for (const [key, result] of this.results.entries()) {
      if (now >= result.expiresAt) {
        this.results.delete(key);
        expired++;
      }
    }

    this.stats.expired += expired;
  }

  /**
   * Clear all cached results
   */
  clear() {
    this.results.clear();
  }

  /**
   * Get statistics
   * @returns {Object} - Statistics
   */
  getStats() {
    return {
      ...this.stats,
      pending: this.pending.size,
      cached: this.results.size,
      deduplicationRate: this.stats.total > 0
        ? this.stats.deduplicated / this.stats.total
        : 0
    };
  }

  /**
   * Stop deduplicator
   */
  stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

/**
 * Batch Request Deduplicator
 * Groups multiple requests into batches
 */
class BatchDeduplicator extends RequestDeduplicator {
  /**
   * Create batch deduplicator
   * @param {Object} options - Options
   */
  constructor(options = {}) {
    super(options);

    this.batchSize = options.batchSize || 10;
    this.batchDelay = options.batchDelay || 100;
    this.batches = new Map();
  }

  /**
   * Execute request with batching
   * @param {string|Object} request - Request
   * @param {Function} executor - Batch executor
   * @returns {Promise<*>} - Result
   */
  async executeBatch(request, executor) {
    const key = this.generateKey(request);

    // Check cache
    const cached = this.results.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      this.stats.deduplicated++;
      return cached.value;
    }

    // Add to batch
    return new Promise((resolve, reject) => {
      const batchKey = this.getBatchKey(request);

      if (!this.batches.has(batchKey)) {
        this.batches.set(batchKey, {
          requests: [],
          timer: null
        });
      }

      const batch = this.batches.get(batchKey);

      batch.requests.push({
        key,
        request,
        resolve,
        reject
      });

      // Schedule batch execution
      if (!batch.timer) {
        batch.timer = setTimeout(() => {
          this.executeBatchRequests(batchKey, executor);
        }, this.batchDelay);
      }

      // Execute immediately if batch is full
      if (batch.requests.length >= this.batchSize) {
        clearTimeout(batch.timer);
        this.executeBatchRequests(batchKey, executor);
      }
    });
  }

  /**
   * Execute batch of requests
   * @private
   * @param {string} batchKey - Batch key
   * @param {Function} executor - Executor
   */
  async executeBatchRequests(batchKey, executor) {
    const batch = this.batches.get(batchKey);

    if (!batch) {
      return;
    }

    this.batches.delete(batchKey);

    const requests = batch.requests.map(item => item.request);

    try {
      const results = await executor(requests);

      // Resolve individual promises
      for (let i = 0; i < batch.requests.length; i++) {
        const item = batch.requests[i];
        const result = results[i];

        // Cache result
        this.results.set(item.key, {
          value: result,
          expiresAt: Date.now() + this.ttl
        });

        item.resolve(result);
      }

      this.stats.completed += batch.requests.length;
    } catch (error) {
      // Reject all promises
      for (const item of batch.requests) {
        item.reject(error);
      }

      this.stats.failed += batch.requests.length;
    }
  }

  /**
   * Get batch key
   * @private
   * @param {Object} request - Request
   * @returns {string} - Batch key
   */
  getBatchKey(request) {
    // Group by request type/endpoint
    if (request.url) {
      return request.url.split('?')[0];
    }

    if (request.endpoint) {
      return request.endpoint;
    }

    return 'default';
  }
}

/**
 * Create deduplication middleware
 * @param {RequestDeduplicator} deduplicator - Deduplicator instance
 * @returns {Function} - Middleware
 */
function createDeduplicationMiddleware(deduplicator) {
  return async (req, res, next) => {
    const key = `${req.method}:${req.url}`;

    try {
      const result = await deduplicator.execute(key, async () => {
        // Store original send
        const originalSend = res.send;

        return new Promise((resolve) => {
          res.send = function(data) {
            resolve(data);
            return originalSend.call(this, data);
          };

          next();
        });
      });

      // If deduplicated, send cached result
      if (result !== undefined) {
        res.send(result);
      }
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  RequestDeduplicator,
  BatchDeduplicator,
  createDeduplicationMiddleware
};
