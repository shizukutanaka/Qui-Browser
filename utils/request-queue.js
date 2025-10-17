/**
 * Request Queue Manager
 * Production-grade request batching and queue management
 *
 * @module utils/request-queue
 */

/**
 * Priority levels for requests
 * @enum {number}
 */
const Priority = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3
};

/**
 * Request Queue
 * Manages request queuing with priority, batching, and throttling
 *
 * @class RequestQueue
 * @description Provides request queue management with:
 * - Priority-based processing
 * - Request batching
 * - Intelligent throttling
 * - Retry mechanisms
 * - Timeout handling
 */
class RequestQueue {
  /**
   * Create a request queue
   * @param {Object} options - Configuration options
   * @param {number} [options.concurrency=5] - Max concurrent requests
   * @param {number} [options.batchSize=10] - Batch size for processing
   * @param {number} [options.batchDelay=100] - Delay before processing batch (ms)
   * @param {number} [options.timeout=30000] - Request timeout (ms)
   * @param {number} [options.maxRetries=3] - Max retry attempts
   * @param {number} [options.retryDelay=1000] - Delay between retries (ms)
   * @param {Function} [options.processor] - Request processor function
   */
  constructor(options = {}) {
    this.concurrency = options.concurrency || 5;
    this.batchSize = options.batchSize || 10;
    this.batchDelay = options.batchDelay || 100;
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.processor = options.processor || (req => Promise.resolve(req));

    this.queues = {
      [Priority.CRITICAL]: [],
      [Priority.HIGH]: [],
      [Priority.NORMAL]: [],
      [Priority.LOW]: []
    };

    this.processing = new Map();
    this.batchTimer = null;
    this.paused = false;

    this.stats = {
      queued: 0,
      processed: 0,
      failed: 0,
      retried: 0,
      timeout: 0,
      batches: 0
    };
  }

  /**
   * Add request to queue
   * @param {Object} request - Request object
   * @param {Priority} [priority=Priority.NORMAL] - Request priority
   * @returns {Promise<*>} - Request result
   */
  async add(request, priority = Priority.NORMAL) {
    if (this.paused) {
      throw new Error('Queue is paused');
    }

    return new Promise((resolve, reject) => {
      const queueItem = {
        id: this.generateId(),
        request,
        priority,
        resolve,
        reject,
        retries: 0,
        addedAt: Date.now()
      };

      this.queues[priority].push(queueItem);
      this.stats.queued++;

      this.scheduleBatch();
    });
  }

  /**
   * Add multiple requests to queue
   * @param {Array<Object>} requests - Array of requests
   * @param {Priority} [priority=Priority.NORMAL] - Priority for all requests
   * @returns {Promise<Array>} - Array of results
   */
  async addBatch(requests, priority = Priority.NORMAL) {
    const promises = requests.map(request => this.add(request, priority));
    return Promise.all(promises);
  }

  /**
   * Schedule batch processing
   * @private
   */
  scheduleBatch() {
    if (this.batchTimer) {
      return;
    }

    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      this.processBatch();
    }, this.batchDelay);
  }

  /**
   * Process batch of requests
   * @private
   */
  async processBatch() {
    if (this.paused) {
      return;
    }

    // Get items to process
    const items = this.getNextBatch();

    if (items.length === 0) {
      return;
    }

    this.stats.batches++;

    // Process items concurrently with limit
    const promises = items.map(item => this.processItem(item));
    await Promise.allSettled(promises);

    // Schedule next batch if queue not empty
    if (this.getTotalQueued() > 0) {
      this.scheduleBatch();
    }
  }

  /**
   * Get next batch of items to process
   * @private
   * @returns {Array<Object>} - Batch items
   */
  getNextBatch() {
    const items = [];
    const availableSlots = this.concurrency - this.processing.size;

    if (availableSlots <= 0) {
      return items;
    }

    const count = Math.min(this.batchSize, availableSlots);

    // Process by priority
    for (const priority of [Priority.CRITICAL, Priority.HIGH, Priority.NORMAL, Priority.LOW]) {
      const queue = this.queues[priority];

      while (queue.length > 0 && items.length < count) {
        items.push(queue.shift());
      }

      if (items.length >= count) {
        break;
      }
    }

    return items;
  }

  /**
   * Process single queue item
   * @private
   * @param {Object} item - Queue item
   */
  async processItem(item) {
    this.processing.set(item.id, item);

    try {
      const result = await this.executeWithTimeout(item);
      item.resolve(result);
      this.stats.processed++;
    } catch (error) {
      await this.handleError(item, error);
    } finally {
      this.processing.delete(item.id);
    }
  }

  /**
   * Execute request with timeout
   * @private
   * @param {Object} item - Queue item
   * @returns {Promise<*>} - Result
   */
  async executeWithTimeout(item) {
    return Promise.race([
      this.processor(item.request),
      new Promise((_, reject) =>
        setTimeout(() => {
          this.stats.timeout++;
          reject(new Error('Request timeout'));
        }, this.timeout)
      )
    ]);
  }

  /**
   * Handle request error
   * @private
   * @param {Object} item - Queue item
   * @param {Error} error - Error
   */
  async handleError(item, error) {
    item.retries++;

    // Retry if below max retries
    if (item.retries < this.maxRetries) {
      this.stats.retried++;

      // Exponential backoff
      const delay = this.retryDelay * Math.pow(2, item.retries - 1);

      await new Promise(resolve => setTimeout(resolve, delay));

      // Re-queue with same priority
      this.queues[item.priority].unshift(item);
      this.scheduleBatch();
    } else {
      this.stats.failed++;
      item.reject(error);
    }
  }

  /**
   * Generate unique ID
   * @private
   * @returns {string} - Unique ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get total queued items
   * @returns {number} - Total queued
   */
  getTotalQueued() {
    return Object.values(this.queues).reduce((sum, queue) => sum + queue.length, 0);
  }

  /**
   * Get queue statistics
   * @returns {Object} - Statistics
   */
  getStats() {
    return {
      ...this.stats,
      queued: this.getTotalQueued(),
      processing: this.processing.size,
      byPriority: {
        critical: this.queues[Priority.CRITICAL].length,
        high: this.queues[Priority.HIGH].length,
        normal: this.queues[Priority.NORMAL].length,
        low: this.queues[Priority.LOW].length
      }
    };
  }

  /**
   * Pause queue processing
   */
  pause() {
    this.paused = true;

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Resume queue processing
   */
  resume() {
    this.paused = false;
    this.scheduleBatch();
  }

  /**
   * Clear all queued requests
   */
  clear() {
    for (const priority in this.queues) {
      const queue = this.queues[priority];

      for (const item of queue) {
        item.reject(new Error('Queue cleared'));
      }

      queue.length = 0;
    }

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Wait for all requests to complete
   * @returns {Promise<void>}
   */
  async drain() {
    while (this.getTotalQueued() > 0 || this.processing.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

/**
 * Adaptive Request Queue
 * Request queue with adaptive throttling based on system load
 *
 * @class AdaptiveRequestQueue
 */
class AdaptiveRequestQueue extends RequestQueue {
  /**
   * Create an adaptive request queue
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super(options);

    this.minConcurrency = options.minConcurrency || 1;
    this.maxConcurrency = options.maxConcurrency || this.concurrency;
    this.adjustInterval = options.adjustInterval || 5000;
    this.targetLatency = options.targetLatency || 100;

    this.latencies = [];
    this.maxLatencies = 100;

    this.startAdaptiveAdjustment();
  }

  /**
   * Start adaptive concurrency adjustment
   * @private
   */
  startAdaptiveAdjustment() {
    this.adjustTimer = setInterval(() => {
      this.adjustConcurrency();
    }, this.adjustInterval);
  }

  /**
   * Adjust concurrency based on latency
   * @private
   */
  adjustConcurrency() {
    if (this.latencies.length < 10) {
      return;
    }

    const avgLatency = this.latencies.reduce((sum, l) => sum + l, 0) / this.latencies.length;

    if (avgLatency > this.targetLatency * 1.5) {
      // Decrease concurrency
      this.concurrency = Math.max(this.minConcurrency, this.concurrency - 1);
    } else if (avgLatency < this.targetLatency * 0.5) {
      // Increase concurrency
      this.concurrency = Math.min(this.maxConcurrency, this.concurrency + 1);
    }

    // Clear latencies
    this.latencies = [];
  }

  /**
   * Process item with latency tracking
   * @private
   * @param {Object} item - Queue item
   */
  async processItem(item) {
    const startTime = Date.now();

    try {
      await super.processItem(item);
    } finally {
      const latency = Date.now() - startTime;
      this.latencies.push(latency);

      // Keep only recent latencies
      if (this.latencies.length > this.maxLatencies) {
        this.latencies.shift();
      }
    }
  }

  /**
   * Stop adaptive adjustment
   */
  stop() {
    if (this.adjustTimer) {
      clearInterval(this.adjustTimer);
      this.adjustTimer = null;
    }
  }
}

/**
 * Request Queue Manager
 * Manages multiple request queues
 *
 * @class RequestQueueManager
 */
class RequestQueueManager {
  constructor() {
    this.queues = new Map();
  }

  /**
   * Create or get request queue
   * @param {string} name - Queue name
   * @param {Object} options - Queue options
   * @param {boolean} [adaptive=false] - Use adaptive queue
   * @returns {RequestQueue} - Request queue
   */
  createQueue(name, options, adaptive = false) {
    if (this.queues.has(name)) {
      return this.queues.get(name);
    }

    const Queue = adaptive ? AdaptiveRequestQueue : RequestQueue;
    const queue = new Queue(options);
    this.queues.set(name, queue);
    return queue;
  }

  /**
   * Get request queue
   * @param {string} name - Queue name
   * @returns {RequestQueue|null} - Request queue
   */
  getQueue(name) {
    return this.queues.get(name) || null;
  }

  /**
   * Clear specific queue
   * @param {string} name - Queue name
   */
  clearQueue(name) {
    const queue = this.queues.get(name);
    if (queue) {
      queue.clear();
    }
  }

  /**
   * Clear all queues
   */
  clearAll() {
    for (const queue of this.queues.values()) {
      queue.clear();
    }
  }

  /**
   * Drain specific queue
   * @param {string} name - Queue name
   * @returns {Promise<void>}
   */
  async drainQueue(name) {
    const queue = this.queues.get(name);
    if (queue) {
      await queue.drain();
    }
  }

  /**
   * Drain all queues
   * @returns {Promise<void>}
   */
  async drainAll() {
    const drainPromises = Array.from(this.queues.values()).map(queue => queue.drain());
    await Promise.all(drainPromises);
  }

  /**
   * Get all queue statistics
   * @returns {Object} - Statistics by queue name
   */
  getAllStats() {
    const stats = {};

    for (const [name, queue] of this.queues.entries()) {
      stats[name] = queue.getStats();
    }

    return stats;
  }

  /**
   * Remove queue
   * @param {string} name - Queue name
   */
  removeQueue(name) {
    const queue = this.queues.get(name);
    if (queue) {
      queue.clear();
      if (queue.stop) {
        queue.stop();
      }
      this.queues.delete(name);
    }
  }
}

module.exports = {
  RequestQueue,
  AdaptiveRequestQueue,
  RequestQueueManager,
  Priority
};
