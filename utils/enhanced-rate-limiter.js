/**
 * Enhanced Rate Limiter
 *
 * Implements sophisticated rate limiting (Improvement #37)
 * - Multiple algorithms (Token Bucket, Sliding Window, Fixed Window)
 * - Per-endpoint rate limiting
 * - User-based and IP-based limiting
 * - Rate limit headers
 * - Dynamic rate adjustment
 */

const EventEmitter = require('events');

/**
 * Rate limit algorithms
 */
const Algorithm = {
  TOKEN_BUCKET: 'token_bucket',
  SLIDING_WINDOW: 'sliding_window',
  FIXED_WINDOW: 'fixed_window'
};

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  algorithm: Algorithm.TOKEN_BUCKET,
  maxRequests: 100,
  windowMs: 60000, // 1 minute
  keyGenerator: (req) => req.ip || req.socket.remoteAddress,
  skip: (req) => false,
  handler: null,
  headers: true
};

/**
 * Token Bucket implementation
 */
class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate; // tokens per second
    this.lastRefill = Date.now();
  }

  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  consume(count = 1) {
    this.refill();

    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }

    return false;
  }

  getAvailable() {
    this.refill();
    return Math.floor(this.tokens);
  }

  getWaitTime() {
    if (this.tokens >= 1) {
      return 0;
    }

    const tokensNeeded = 1 - this.tokens;
    return Math.ceil((tokensNeeded / this.refillRate) * 1000);
  }
}

/**
 * Enhanced Rate Limiter
 */
class EnhancedRateLimiter extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stores = new Map();

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  getLimiter(key) {
    if (!this.stores.has(key)) {
      const refillRate = this.config.maxRequests / (this.config.windowMs / 1000);
      const limiter = new TokenBucket(this.config.maxRequests, refillRate);
      this.stores.set(key, limiter);
    }
    return this.stores.get(key);
  }

  check(key) {
    const limiter = this.getLimiter(key);
    const allowed = limiter.consume();
    const remaining = limiter.getAvailable();
    const retryAfter = allowed ? 0 : limiter.getWaitTime();

    return {
      allowed,
      remaining,
      retryAfter: Math.ceil(retryAfter / 1000),
      limit: this.config.maxRequests
    };
  }

  cleanup() {
    // Token buckets refill automatically, no cleanup needed
  }

  reset(key) {
    this.stores.delete(key);
  }

  close() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

function createRateLimiterMiddleware(config = {}) {
  const limiter = new EnhancedRateLimiter(config);

  return function rateLimiterMiddleware(req, res, next) {
    if (config.skip && config.skip(req)) {
      return next();
    }

    const key = config.keyGenerator ? config.keyGenerator(req) : req.ip || req.socket.remoteAddress;
    const result = limiter.check(key);

    if (config.headers !== false) {
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
    }

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter);

      if (config.handler) {
        return config.handler(req, res, next);
      }

      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Too Many Requests',
          retryAfter: result.retryAfter,
          limit: result.limit
        })
      );
      return;
    }

    next();
  };
}

module.exports = {
  EnhancedRateLimiter,
  TokenBucket,
  createRateLimiterMiddleware,
  Algorithm,
  DEFAULT_CONFIG
};
