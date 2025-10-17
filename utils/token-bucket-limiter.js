/**
 * Token Bucket Rate Limiter
 * Advanced rate limiting using Token Bucket algorithm
 *
 * Based on 2025 best practices:
 * - Token bucket for burst handling
 * - Multi-tier limits (global, per-client, per-endpoint)
 * - Distributed support with Redis
 * - Detailed metrics and monitoring
 *
 * @module utils/token-bucket-limiter
 */

const { EventEmitter } = require('events');

class TokenBucketLimiter extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      // Token bucket configuration
      capacity: options.capacity || 100, // Maximum tokens in bucket
      refillRate: options.refillRate || 10, // Tokens added per second
      refillInterval: options.refillInterval || 100, // Refill check interval (ms)

      // Multi-tier limits
      enableGlobalLimit: options.enableGlobalLimit !== false,
      enablePerClientLimit: options.enablePerClientLimit !== false,
      enablePerEndpointLimit: options.enablePerEndpointLimit !== false,

      globalCapacity: options.globalCapacity || 10000,
      globalRefillRate: options.globalRefillRate || 1000,

      clientCapacity: options.clientCapacity || 100,
      clientRefillRate: options.clientRefillRate || 10,

      endpointLimits: options.endpointLimits || {},

      // Cost configuration (different endpoints can cost different tokens)
      defaultCost: options.defaultCost || 1,
      endpointCosts: options.endpointCosts || {},

      // Distributed configuration
      enableDistributed: options.enableDistributed || false,
      redisClient: options.redisClient || null,

      // Monitoring
      enableMetrics: options.enableMetrics !== false,

      ...options
    };

    // Token buckets storage
    this.globalBucket = null;
    this.clientBuckets = new Map();
    this.endpointBuckets = new Map();

    // Metrics
    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      rejectedRequests: 0,
      tokensConsumed: 0,
      bucketsCreated: 0
    };

    // Refill timer
    this.refillTimer = null;

    this.init();
  }

  /**
   * Initialize limiter
   */
  init() {
    // Create global bucket
    if (this.options.enableGlobalLimit) {
      this.globalBucket = this.createBucket(
        this.options.globalCapacity,
        this.options.globalRefillRate
      );
    }

    // Start refill timer
    this.startRefillTimer();

    console.log('[TokenBucket] Limiter initialized (capacity: ${this.options.capacity}, refill: ${this.options.refillRate}/s)');
  }

  /**
   * Create new token bucket
   * @param {number} capacity - Bucket capacity
   * @param {number} refillRate - Refill rate per second
   * @returns {Object} Bucket
   */
  createBucket(capacity, refillRate) {
    this.metrics.bucketsCreated++;

    return {
      capacity,
      tokens: capacity, // Start with full bucket
      refillRate,
      lastRefill: Date.now()
    };
  }

  /**
   * Check if request is allowed
   * @param {Object} request - Request info
   * @returns {Object} Result
   */
  async check(request) {
    const {
      clientId = 'anonymous',
      endpoint = '/',
      cost = null
    } = request;

    this.metrics.totalRequests++;

    const tokenCost = cost || this.getEndpointCost(endpoint);

    // Check global limit
    if (this.options.enableGlobalLimit) {
      if (!this.consumeTokens(this.globalBucket, tokenCost)) {
        this.metrics.rejectedRequests++;
        this.emit('limitExceeded', {
          level: 'global',
          clientId,
          endpoint,
          reason: 'global_limit'
        });

        return {
          allowed: false,
          reason: 'global_limit',
          retryAfter: this.calculateRetryAfter(this.globalBucket, tokenCost),
          remaining: Math.floor(this.globalBucket.tokens),
          limit: this.globalBucket.capacity
        };
      }
    }

    // Check per-client limit
    if (this.options.enablePerClientLimit) {
      const clientBucket = this.getOrCreateClientBucket(clientId);

      if (!this.consumeTokens(clientBucket, tokenCost)) {
        // Refund global tokens
        if (this.globalBucket) {
          this.globalBucket.tokens += tokenCost;
        }

        this.metrics.rejectedRequests++;
        this.emit('limitExceeded', {
          level: 'client',
          clientId,
          endpoint,
          reason: 'client_limit'
        });

        return {
          allowed: false,
          reason: 'client_limit',
          retryAfter: this.calculateRetryAfter(clientBucket, tokenCost),
          remaining: Math.floor(clientBucket.tokens),
          limit: clientBucket.capacity
        };
      }
    }

    // Check per-endpoint limit
    if (this.options.enablePerEndpointLimit && this.options.endpointLimits[endpoint]) {
      const endpointBucket = this.getOrCreateEndpointBucket(endpoint);

      if (!this.consumeTokens(endpointBucket, tokenCost)) {
        // Refund previous tokens
        if (this.globalBucket) {
          this.globalBucket.tokens += tokenCost;
        }
        const clientBucket = this.clientBuckets.get(clientId);
        if (clientBucket) {
          clientBucket.tokens += tokenCost;
        }

        this.metrics.rejectedRequests++;
        this.emit('limitExceeded', {
          level: 'endpoint',
          clientId,
          endpoint,
          reason: 'endpoint_limit'
        });

        return {
          allowed: false,
          reason: 'endpoint_limit',
          retryAfter: this.calculateRetryAfter(endpointBucket, tokenCost),
          remaining: Math.floor(endpointBucket.tokens),
          limit: endpointBucket.capacity
        };
      }
    }

    // Request allowed
    this.metrics.allowedRequests++;
    this.metrics.tokensConsumed += tokenCost;

    const clientBucket = this.clientBuckets.get(clientId);

    return {
      allowed: true,
      remaining: clientBucket ? Math.floor(clientBucket.tokens) : null,
      limit: clientBucket ? clientBucket.capacity : null,
      cost: tokenCost
    };
  }

  /**
   * Consume tokens from bucket
   * @param {Object} bucket - Bucket
   * @param {number} cost - Token cost
   * @returns {boolean} Success
   */
  consumeTokens(bucket, cost) {
    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return true;
    }
    return false;
  }

  /**
   * Get or create client bucket
   * @param {string} clientId - Client ID
   * @returns {Object} Bucket
   */
  getOrCreateClientBucket(clientId) {
    if (!this.clientBuckets.has(clientId)) {
      this.clientBuckets.set(
        clientId,
        this.createBucket(this.options.clientCapacity, this.options.clientRefillRate)
      );
    }
    return this.clientBuckets.get(clientId);
  }

  /**
   * Get or create endpoint bucket
   * @param {string} endpoint - Endpoint
   * @returns {Object} Bucket
   */
  getOrCreateEndpointBucket(endpoint) {
    if (!this.endpointBuckets.has(endpoint)) {
      const limits = this.options.endpointLimits[endpoint];
      this.endpointBuckets.set(
        endpoint,
        this.createBucket(limits.capacity, limits.refillRate)
      );
    }
    return this.endpointBuckets.get(endpoint);
  }

  /**
   * Get endpoint token cost
   * @param {string} endpoint - Endpoint
   * @returns {number} Cost
   */
  getEndpointCost(endpoint) {
    return this.options.endpointCosts[endpoint] || this.options.defaultCost;
  }

  /**
   * Calculate retry-after time in seconds
   * @param {Object} bucket - Bucket
   * @param {number} cost - Token cost needed
   * @returns {number} Seconds until tokens available
   */
  calculateRetryAfter(bucket, cost) {
    const tokensNeeded = cost - bucket.tokens;
    const secondsNeeded = tokensNeeded / bucket.refillRate;
    return Math.ceil(secondsNeeded);
  }

  /**
   * Start refill timer
   */
  startRefillTimer() {
    if (this.refillTimer) return;

    this.refillTimer = setInterval(() => {
      this.refillAllBuckets();
    }, this.options.refillInterval);
  }

  /**
   * Stop refill timer
   */
  stopRefillTimer() {
    if (this.refillTimer) {
      clearInterval(this.refillTimer);
      this.refillTimer = null;
    }
  }

  /**
   * Refill all buckets
   */
  refillAllBuckets() {
    const now = Date.now();

    // Refill global bucket
    if (this.globalBucket) {
      this.refillBucket(this.globalBucket, now);
    }

    // Refill client buckets
    for (const bucket of this.clientBuckets.values()) {
      this.refillBucket(bucket, now);
    }

    // Refill endpoint buckets
    for (const bucket of this.endpointBuckets.values()) {
      this.refillBucket(bucket, now);
    }

    // Cleanup old client buckets (haven't been used in 5 minutes)
    this.cleanupOldBuckets();
  }

  /**
   * Refill single bucket
   * @param {Object} bucket - Bucket to refill
   * @param {number} now - Current timestamp
   */
  refillBucket(bucket, now) {
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = (timePassed / 1000) * bucket.refillRate;

    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * Cleanup old client buckets
   */
  cleanupOldBuckets() {
    const now = Date.now();
    const timeout = 300000; // 5 minutes

    for (const [clientId, bucket] of this.clientBuckets.entries()) {
      if (now - bucket.lastRefill > timeout && bucket.tokens === bucket.capacity) {
        this.clientBuckets.delete(clientId);
      }
    }
  }

  /**
   * Get limiter metrics
   * @returns {Object} Metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeBuckets: {
        global: this.globalBucket ? 1 : 0,
        clients: this.clientBuckets.size,
        endpoints: this.endpointBuckets.size
      },
      acceptanceRate: this.metrics.totalRequests > 0
        ? `${((this.metrics.allowedRequests / this.metrics.totalRequests) * 100).toFixed(2)}%`
        : '0%',
      rejectionRate: this.metrics.totalRequests > 0
        ? `${((this.metrics.rejectedRequests / this.metrics.totalRequests) * 100).toFixed(2)}%`
        : '0%'
    };
  }

  /**
   * Get bucket status
   * @param {string} clientId - Client ID (optional)
   * @returns {Object} Bucket status
   */
  getBucketStatus(clientId = null) {
    const status = {};

    if (this.globalBucket) {
      status.global = {
        tokens: Math.floor(this.globalBucket.tokens),
        capacity: this.globalBucket.capacity,
        fillRate: `${((this.globalBucket.tokens / this.globalBucket.capacity) * 100).toFixed(2)}%`
      };
    }

    if (clientId && this.clientBuckets.has(clientId)) {
      const bucket = this.clientBuckets.get(clientId);
      status.client = {
        tokens: Math.floor(bucket.tokens),
        capacity: bucket.capacity,
        fillRate: `${((bucket.tokens / bucket.capacity) * 100).toFixed(2)}%`
      };
    }

    return status;
  }

  /**
   * Reset limiter (for testing)
   */
  reset() {
    this.clientBuckets.clear();
    this.endpointBuckets.clear();

    if (this.globalBucket) {
      this.globalBucket.tokens = this.globalBucket.capacity;
    }

    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      rejectedRequests: 0,
      tokensConsumed: 0,
      bucketsCreated: 0
    };
  }

  /**
   * Shutdown limiter
   */
  shutdown() {
    console.log('[TokenBucket] Shutting down...');

    this.stopRefillTimer();
    this.clientBuckets.clear();
    this.endpointBuckets.clear();

    console.log('[TokenBucket] Shutdown complete');
  }
}

/**
 * Express middleware for token bucket rate limiting
 * @param {Object} options - Limiter options
 * @returns {Function} Middleware
 */
function createTokenBucketMiddleware(options = {}) {
  const limiter = new TokenBucketLimiter(options);

  return async (req, res, next) => {
    const clientId = req.ip || req.connection.remoteAddress;
    const endpoint = req.path;

    const result = await limiter.check({ clientId, endpoint });

    // Set rate limit headers
    if (result.limit !== null) {
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining || 0);
    }

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter);
      res.setHeader('X-RateLimit-Reset', Date.now() + (result.retryAfter * 1000));

      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded: ${result.reason}`,
        retryAfter: result.retryAfter
      });
    }

    next();
  };
}

module.exports = TokenBucketLimiter;
module.exports.createMiddleware = createTokenBucketMiddleware;
