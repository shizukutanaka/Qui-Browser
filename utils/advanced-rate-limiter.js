/**
 * Advanced Rate Limiting
 *
 * Based on 2025 research: Kong Gateway and Ambassador Edge Stack best practices
 *
 * Kong Rate Limiting Features (2025):
 * - Sliding window algorithm (dynamic calculation)
 * - Fixed window buckets (statically assigned time ranges)
 * - Redis Sentinel and Redis Cluster support
 * - Multiple limits per route/consumer
 * - Local and distributed limiting
 *
 * Ambassador Rate Limiting Features (2025):
 * - Label-based rate limiting
 * - Domain-based organization (team autonomy)
 * - Decentralized configuration model
 * - gRPC API for third-party services
 * - Per-team domains with independent labels
 *
 * 2025 Best Practices:
 * - Sliding windows for accurate rate limiting
 * - Distributed limiting with Redis for multi-node deployments
 * - Per-user, per-endpoint, and global limits
 * - Custom headers for client notification
 * - Circuit breaker integration
 *
 * @see https://docs.konghq.com/hub/kong-inc/rate-limiting-advanced/
 * @see https://www.getambassador.io/docs/edge-stack/latest/howtos/advanced-rate-limiting
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class AdvancedRateLimiter extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      // Window type
      windowType: options.windowType || 'sliding', // sliding, fixed

      // Default limits
      defaultLimits: options.defaultLimits || [
        { window: 1000, limit: 10 },      // 10/second
        { window: 60000, limit: 100 },    // 100/minute
        { window: 3600000, limit: 1000 }  // 1000/hour
      ],

      // Limit types
      limitBy: options.limitBy || ['ip'], // ip, user, api-key, custom-header

      // Distributed mode
      distributed: options.distributed || false,
      redisUrl: options.redisUrl,

      // Response behavior
      enforceMode: options.enforceMode || 'block', // block, throttle, log-only
      retryAfter: options.retryAfter || true,

      // Headers
      includeHeaders: options.includeHeaders !== false,

      // Circuit breaker integration
      enableCircuitBreaker: options.enableCircuitBreaker || false,
      circuitBreakerThreshold: options.circuitBreakerThreshold || 0.5, // 50% error rate

      // Label-based limiting (Ambassador style)
      enableLabels: options.enableLabels || false,
      domains: options.domains || {},

      ...options
    };

    // Storage for rate limit data
    this.windows = new Map(); // key -> window data
    this.fixedBuckets = new Map(); // key -> bucket data

    // Circuit breaker state
    this.circuitBreakers = new Map(); // endpoint -> state

    // Label-based limits (Ambassador style)
    this.labelLimits = new Map(); // domain -> label limits

    // Statistics
    this.stats = {
      totalRequests: 0,
      blockedRequests: 0,
      throttledRequests: 0,
      passedRequests: 0,
      circuitBreakerTrips: 0,
      redisOperations: 0
    };
  }

  /**
   * Create middleware for rate limiting
   */
  createMiddleware() {
    return async (req, res, next) => {
      try {
        this.stats.totalRequests++;

        // Extract rate limit key(s)
        const keys = this.extractKeys(req);

        // Check each key against all limits
        for (const key of keys) {
          const result = await this.checkRateLimit(key, req);

          if (!result.allowed) {
            this.handleRateLimitExceeded(req, res, result);
            return;
          }
        }

        // Check circuit breaker
        if (this.options.enableCircuitBreaker) {
          const endpoint = this.getEndpointKey(req);
          if (this.isCircuitOpen(endpoint)) {
            this.handleCircuitOpen(req, res, endpoint);
            return;
          }
        }

        // Add rate limit headers
        if (this.options.includeHeaders) {
          this.addRateLimitHeaders(req, res);
        }

        this.stats.passedRequests++;

        // Track response for circuit breaker
        if (this.options.enableCircuitBreaker) {
          this.trackResponse(req, res);
        }

        next();
      } catch (error) {
        this.emit('error', { error, path: req.url });
        next(error);
      }
    };
  }

  /**
   * Extract rate limit keys from request
   */
  extractKeys(req) {
    const keys = [];

    for (const limitType of this.options.limitBy) {
      switch (limitType) {
        case 'ip':
          keys.push({
            type: 'ip',
            value: this.getClientIP(req),
            limits: this.options.defaultLimits
          });
          break;

        case 'user':
          if (req.user) {
            keys.push({
              type: 'user',
              value: req.user.id,
              limits: this.getUserLimits(req.user)
            });
          }
          break;

        case 'api-key':
          const apiKey = req.headers['x-api-key'];
          if (apiKey) {
            keys.push({
              type: 'api-key',
              value: apiKey,
              limits: this.getApiKeyLimits(apiKey)
            });
          }
          break;

        case 'custom-header':
          const customHeader = req.headers['x-rate-limit-key'];
          if (customHeader) {
            keys.push({
              type: 'custom-header',
              value: customHeader,
              limits: this.options.defaultLimits
            });
          }
          break;
      }
    }

    // Add endpoint-specific limits
    const endpointLimits = this.getEndpointLimits(req.path);
    if (endpointLimits) {
      keys.push({
        type: 'endpoint',
        value: req.path,
        limits: endpointLimits
      });
    }

    // Add label-based limits (Ambassador style)
    if (this.options.enableLabels) {
      const labels = this.extractLabels(req);
      for (const label of labels) {
        const limits = this.getLabelLimits(label);
        if (limits) {
          keys.push({
            type: 'label',
            value: label.key,
            limits
          });
        }
      }
    }

    return keys;
  }

  /**
   * Check rate limit for a key
   */
  async checkRateLimit(key, req) {
    const { type, value, limits } = key;

    // Check all configured limits
    for (const limit of limits) {
      const limitKey = `${type}:${value}:${limit.window}`;

      let result;

      if (this.options.windowType === 'sliding') {
        result = await this.checkSlidingWindow(limitKey, limit);
      } else {
        result = await this.checkFixedWindow(limitKey, limit);
      }

      if (!result.allowed) {
        return {
          allowed: false,
          limit: limit.limit,
          window: limit.window,
          current: result.current,
          remaining: 0,
          resetTime: result.resetTime,
          key: limitKey
        };
      }
    }

    // All limits passed
    return {
      allowed: true,
      limit: limits[0].limit,
      remaining: this.calculateRemaining(key),
      resetTime: this.calculateResetTime(key)
    };
  }

  /**
   * Check sliding window rate limit
   */
  async checkSlidingWindow(key, limit) {
    if (this.options.distributed) {
      return await this.checkSlidingWindowRedis(key, limit);
    }

    // Local sliding window
    const now = Date.now();
    const windowStart = now - limit.window;

    // Get or create window
    let window = this.windows.get(key);

    if (!window) {
      window = {
        requests: [],
        createdAt: now
      };
      this.windows.set(key, window);
    }

    // Remove old requests outside window
    window.requests = window.requests.filter(time => time > windowStart);

    // Count requests in current window
    const currentCount = window.requests.length;

    if (currentCount >= limit.limit) {
      // Rate limit exceeded
      return {
        allowed: false,
        current: currentCount,
        resetTime: window.requests[0] + limit.window
      };
    }

    // Add current request
    window.requests.push(now);

    return {
      allowed: true,
      current: currentCount + 1
    };
  }

  /**
   * Check fixed window rate limit
   */
  async checkFixedWindow(key, limit) {
    if (this.options.distributed) {
      return await this.checkFixedWindowRedis(key, limit);
    }

    // Local fixed window
    const now = Date.now();
    const bucketStart = Math.floor(now / limit.window) * limit.window;
    const bucketKey = `${key}:${bucketStart}`;

    // Get or create bucket
    let bucket = this.fixedBuckets.get(bucketKey);

    if (!bucket) {
      bucket = {
        count: 0,
        startTime: bucketStart,
        endTime: bucketStart + limit.window
      };
      this.fixedBuckets.set(bucketKey, bucket);

      // Auto-cleanup old buckets
      setTimeout(() => {
        this.fixedBuckets.delete(bucketKey);
      }, limit.window + 60000); // Cleanup 1 minute after expiry
    }

    // Check if bucket expired (new window started)
    if (now >= bucket.endTime) {
      bucket.count = 0;
      bucket.startTime = bucketStart;
      bucket.endTime = bucketStart + limit.window;
    }

    // Check limit
    if (bucket.count >= limit.limit) {
      return {
        allowed: false,
        current: bucket.count,
        resetTime: bucket.endTime
      };
    }

    // Increment count
    bucket.count++;

    return {
      allowed: true,
      current: bucket.count
    };
  }

  /**
   * Check sliding window with Redis (distributed)
   */
  async checkSlidingWindowRedis(key, limit) {
    // In production: Use Redis ZSET with scores as timestamps
    // ZADD key timestamp timestamp
    // ZREMRANGEBYSCORE key -inf (now - window)
    // ZCARD key

    this.stats.redisOperations++;

    // Simplified simulation
    return { allowed: true, current: 0 };
  }

  /**
   * Check fixed window with Redis (distributed)
   */
  async checkFixedWindowRedis(key, limit) {
    // In production: Use Redis INCR with EXPIRE
    // SET key 1 EX ttl NX
    // INCR key

    this.stats.redisOperations++;

    // Simplified simulation
    return { allowed: true, current: 0 };
  }

  /**
   * Extract labels from request (Ambassador style)
   */
  extractLabels(req) {
    const labels = [];

    // Custom label extraction logic
    // Example: Extract from headers, query params, etc.

    // Domain-based labels
    const domain = req.headers['x-rate-limit-domain'] || 'default';

    labels.push({
      domain,
      key: `method:${req.method}`,
      value: req.method
    });

    labels.push({
      domain,
      key: `path:${req.path}`,
      value: req.path
    });

    if (req.user) {
      labels.push({
        domain,
        key: `user:${req.user.id}`,
        value: req.user.id
      });
    }

    return labels;
  }

  /**
   * Get label-based limits (Ambassador style)
   */
  getLabelLimits(label) {
    const domainLimits = this.labelLimits.get(label.domain);

    if (!domainLimits) return null;

    return domainLimits[label.key] || null;
  }

  /**
   * Set label-based limit (Ambassador style)
   */
  setLabelLimit(domain, labelKey, limits) {
    if (!this.labelLimits.has(domain)) {
      this.labelLimits.set(domain, {});
    }

    this.labelLimits.get(domain)[labelKey] = limits;
  }

  /**
   * Check if circuit breaker is open
   */
  isCircuitOpen(endpoint) {
    const breaker = this.circuitBreakers.get(endpoint);

    if (!breaker) return false;

    // Circuit breaker states: CLOSED, OPEN, HALF_OPEN
    if (breaker.state === 'OPEN') {
      // Check if timeout expired
      if (Date.now() > breaker.openUntil) {
        breaker.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Track response for circuit breaker
   */
  trackResponse(req, res) {
    const endpoint = this.getEndpointKey(req);

    // Get or create circuit breaker
    let breaker = this.circuitBreakers.get(endpoint);

    if (!breaker) {
      breaker = {
        state: 'CLOSED',
        failures: 0,
        successes: 0,
        total: 0,
        errorRate: 0,
        openUntil: 0
      };
      this.circuitBreakers.set(endpoint, breaker);
    }

    // Track response on finish
    res.on('finish', () => {
      breaker.total++;

      if (res.statusCode >= 500) {
        breaker.failures++;
      } else if (res.statusCode < 400) {
        breaker.successes++;
      }

      // Calculate error rate
      breaker.errorRate = breaker.failures / breaker.total;

      // Check if should trip circuit breaker
      if (breaker.state === 'CLOSED' &&
          breaker.errorRate >= this.options.circuitBreakerThreshold &&
          breaker.total >= 10) { // Minimum requests
        // Open circuit breaker
        breaker.state = 'OPEN';
        breaker.openUntil = Date.now() + 60000; // 1 minute timeout

        this.stats.circuitBreakerTrips++;

        this.emit('circuitBreakerOpened', {
          endpoint,
          errorRate: breaker.errorRate,
          failures: breaker.failures,
          total: breaker.total
        });
      }

      // Reset counters after threshold
      if (breaker.total >= 100) {
        breaker.failures = Math.floor(breaker.failures / 2);
        breaker.successes = Math.floor(breaker.successes / 2);
        breaker.total = breaker.failures + breaker.successes;
      }
    });
  }

  /**
   * Handle rate limit exceeded
   */
  handleRateLimitExceeded(req, res, result) {
    this.emit('rateLimitExceeded', {
      key: result.key,
      limit: result.limit,
      current: result.current,
      ip: this.getClientIP(req),
      path: req.url
    });

    switch (this.options.enforceMode) {
      case 'block':
        this.stats.blockedRequests++;

        res.status(429).json({
          error: 'Rate limit exceeded',
          limit: result.limit,
          window: result.window,
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });

        // Add rate limit headers
        res.setHeader('X-RateLimit-Limit', result.limit);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', Math.floor(result.resetTime / 1000));

        if (this.options.retryAfter) {
          res.setHeader('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000));
        }
        break;

      case 'throttle':
        this.stats.throttledRequests++;

        // Add delay before processing
        const delay = Math.min(5000, result.current * 100); // Max 5 seconds

        setTimeout(() => {
          req.next();
        }, delay);
        break;

      case 'log-only':
        // Log but allow request
        this.emit('rateLimitWarning', {
          key: result.key,
          limit: result.limit,
          current: result.current
        });
        req.next();
        break;
    }
  }

  /**
   * Handle circuit breaker open
   */
  handleCircuitOpen(req, res, endpoint) {
    this.emit('circuitBreakerOpen', { endpoint, path: req.url });

    res.status(503).json({
      error: 'Service temporarily unavailable',
      reason: 'Circuit breaker open',
      endpoint
    });
  }

  /**
   * Add rate limit headers to response
   */
  addRateLimitHeaders(req, res) {
    const keys = this.extractKeys(req);

    if (keys.length === 0) return;

    const primaryKey = keys[0];
    const limit = primaryKey.limits[0];

    res.setHeader('X-RateLimit-Limit', limit.limit);
    res.setHeader('X-RateLimit-Remaining', this.calculateRemaining(primaryKey));
    res.setHeader('X-RateLimit-Reset', Math.floor(this.calculateResetTime(primaryKey) / 1000));
  }

  /**
   * Calculate remaining requests
   */
  calculateRemaining(key) {
    const limit = key.limits[0];
    const limitKey = `${key.type}:${key.value}:${limit.window}`;

    if (this.options.windowType === 'sliding') {
      const window = this.windows.get(limitKey);
      if (!window) return limit.limit;

      const now = Date.now();
      const windowStart = now - limit.window;
      const currentCount = window.requests.filter(time => time > windowStart).length;

      return Math.max(0, limit.limit - currentCount);
    } else {
      const now = Date.now();
      const bucketStart = Math.floor(now / limit.window) * limit.window;
      const bucketKey = `${limitKey}:${bucketStart}`;

      const bucket = this.fixedBuckets.get(bucketKey);
      if (!bucket) return limit.limit;

      return Math.max(0, limit.limit - bucket.count);
    }
  }

  /**
   * Calculate reset time
   */
  calculateResetTime(key) {
    const limit = key.limits[0];
    const now = Date.now();

    if (this.options.windowType === 'sliding') {
      return now + limit.window;
    } else {
      const bucketStart = Math.floor(now / limit.window) * limit.window;
      return bucketStart + limit.window;
    }
  }

  /**
   * Get client IP
   */
  getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] ||
      req.headers['x-real-ip'] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      '127.0.0.1';
  }

  /**
   * Get endpoint key
   */
  getEndpointKey(req) {
    return `${req.method}:${req.path}`;
  }

  /**
   * Get user-specific limits
   */
  getUserLimits(user) {
    // Example: Premium users get higher limits
    if (user.tier === 'premium') {
      return [
        { window: 1000, limit: 50 },      // 50/second
        { window: 60000, limit: 1000 },   // 1000/minute
        { window: 3600000, limit: 10000 } // 10000/hour
      ];
    }

    return this.options.defaultLimits;
  }

  /**
   * Get API key-specific limits
   */
  getApiKeyLimits(apiKey) {
    // Example: Different limits per API key
    // In production: Query from database

    return this.options.defaultLimits;
  }

  /**
   * Get endpoint-specific limits
   */
  getEndpointLimits(path) {
    // Example: Different limits per endpoint
    const endpointConfig = {
      '/api/upload': [
        { window: 60000, limit: 10 }  // 10/minute for uploads
      ],
      '/api/search': [
        { window: 1000, limit: 5 }    // 5/second for search
      ]
    };

    return endpointConfig[path] || null;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      blockRate: this.stats.totalRequests > 0
        ? this.stats.blockedRequests / this.stats.totalRequests
        : 0,
      passRate: this.stats.totalRequests > 0
        ? this.stats.passedRequests / this.stats.totalRequests
        : 0,
      activeWindows: this.windows.size,
      activeBuckets: this.fixedBuckets.size,
      circuitBreakers: this.circuitBreakers.size
    };
  }

  /**
   * Clear all rate limit data
   */
  clear() {
    this.windows.clear();
    this.fixedBuckets.clear();
    this.circuitBreakers.clear();

    this.emit('cleared');
  }
}

module.exports = AdvancedRateLimiter;
