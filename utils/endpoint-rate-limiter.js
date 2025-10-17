/**
 * Endpoint-Specific Rate Limiter
 * Provides granular rate limiting per API endpoint with different limits
 * @module utils/endpoint-rate-limiter
 */

const { RateLimitError } = require('./custom-errors');

/**
 * @typedef {Object} RateLimitConfig
 * @property {number} window - Time window in milliseconds
 * @property {number} maxRequests - Maximum requests per window
 * @property {string} [message] - Custom error message
 */

/**
 * @typedef {Object} RateLimitEntry
 * @property {number} count - Request count
 * @property {number} resetAt - Timestamp when limit resets
 * @property {number} firstRequest - Timestamp of first request in window
 */

class EndpointRateLimiter {
  /**
   * Create an endpoint rate limiter
   * @param {Object} options - Configuration options
   * @param {number} [options.defaultWindow=60000] - Default time window (1 minute)
   * @param {number} [options.defaultMaxRequests=100] - Default max requests
   * @param {number} [options.maxEntries=50000] - Maximum cache entries
   */
  constructor(options = {}) {
    this.defaultWindow = options.defaultWindow || 60000;
    this.defaultMaxRequests = options.defaultMaxRequests || 100;
    this.maxEntries = options.maxEntries || 50000;

    // Map<endpoint:ip, RateLimitEntry>
    this.limitMap = new Map();

    // Endpoint-specific configurations
    this.endpointConfigs = new Map();

    // Statistics
    this.stats = {
      requests: 0,
      blocked: 0,
      endpoints: {}
    };

    // Setup default endpoint configurations
    this.setupDefaultConfigs();

    // Periodic cleanup
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Setup default rate limit configurations for common endpoints
   */
  setupDefaultConfigs() {
    // Public endpoints - more permissive
    this.setEndpointConfig('/health', { window: 10000, maxRequests: 60 });
    this.setEndpointConfig('/metrics', { window: 10000, maxRequests: 60 });
    this.setEndpointConfig('/manifest.json', { window: 60000, maxRequests: 10 });

    // API endpoints - moderate limits
    this.setEndpointConfig('/api/search', { window: 60000, maxRequests: 30 });
    this.setEndpointConfig('/api/bookmarks', { window: 60000, maxRequests: 50 });
    this.setEndpointConfig('/api/history', { window: 60000, maxRequests: 50 });

    // Admin endpoints - strict limits
    this.setEndpointConfig('/api/stats', { window: 60000, maxRequests: 20 });
    this.setEndpointConfig('/api/cache/clear', { window: 300000, maxRequests: 5 });
    this.setEndpointConfig('/api/admin/*', { window: 60000, maxRequests: 10 });

    // Billing endpoints - very strict
    this.setEndpointConfig('/api/billing/create-checkout', { window: 300000, maxRequests: 3 });
    this.setEndpointConfig('/api/billing/create-portal-session', {
      window: 300000,
      maxRequests: 5
    });
    this.setEndpointConfig('/api/billing/webhook', { window: 60000, maxRequests: 100 });

    // Authentication endpoints - strict to prevent brute force
    this.setEndpointConfig('/api/auth/login', { window: 300000, maxRequests: 5 });
    this.setEndpointConfig('/api/auth/register', { window: 3600000, maxRequests: 3 });
    this.setEndpointConfig('/api/auth/reset-password', { window: 3600000, maxRequests: 3 });

    // Static assets - very permissive
    this.setEndpointConfig('/assets/*', { window: 60000, maxRequests: 200 });
    this.setEndpointConfig('*.css', { window: 60000, maxRequests: 100 });
    this.setEndpointConfig('*.js', { window: 60000, maxRequests: 100 });
    this.setEndpointConfig('*.png', { window: 60000, maxRequests: 100 });
    this.setEndpointConfig('*.jpg', { window: 60000, maxRequests: 100 });
  }

  /**
   * Set rate limit configuration for an endpoint
   * @param {string} endpoint - Endpoint path or pattern
   * @param {RateLimitConfig} config - Rate limit configuration
   */
  setEndpointConfig(endpoint, config) {
    this.endpointConfigs.set(endpoint, {
      window: config.window || this.defaultWindow,
      maxRequests: config.maxRequests || this.defaultMaxRequests,
      message: config.message || `Rate limit exceeded for ${endpoint}`
    });
  }

  /**
   * Get configuration for an endpoint
   * @param {string} endpoint - Endpoint path
   * @returns {RateLimitConfig} Configuration
   */
  getEndpointConfig(endpoint) {
    // Direct match
    if (this.endpointConfigs.has(endpoint)) {
      return this.endpointConfigs.get(endpoint);
    }

    // Pattern matching
    for (const [pattern, config] of this.endpointConfigs.entries()) {
      if (this.matchPattern(endpoint, pattern)) {
        return config;
      }
    }

    // Default configuration
    return {
      window: this.defaultWindow,
      maxRequests: this.defaultMaxRequests,
      message: 'Rate limit exceeded'
    };
  }

  /**
   * Match endpoint against pattern
   * @param {string} endpoint - Endpoint path
   * @param {string} pattern - Pattern to match
   * @returns {boolean} True if matches
   */
  matchPattern(endpoint, pattern) {
    // Exact match
    if (endpoint === pattern) {
      return true;
    }

    // Wildcard match (/api/admin/* matches /api/admin/users)
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      return endpoint.startsWith(prefix);
    }

    // Extension match (*.css matches /assets/style.css)
    if (pattern.startsWith('*.')) {
      const ext = pattern.slice(1);
      return endpoint.endsWith(ext);
    }

    return false;
  }

  /**
   * Check if request is allowed
   * @param {string} endpoint - Endpoint path
   * @param {string} clientIP - Client IP address
   * @returns {Object} Result with allowed status and metadata
   */
  checkLimit(endpoint, clientIP) {
    const config = this.getEndpointConfig(endpoint);
    const key = `${endpoint}:${clientIP}`;
    const now = Date.now();

    this.stats.requests++;

    // Initialize endpoint stats
    if (!this.stats.endpoints[endpoint]) {
      this.stats.endpoints[endpoint] = { requests: 0, blocked: 0 };
    }
    this.stats.endpoints[endpoint].requests++;

    // Get or create entry
    let entry = this.limitMap.get(key);

    if (!entry || now >= entry.resetAt) {
      // Create new entry
      entry = {
        count: 1,
        resetAt: now + config.window,
        firstRequest: now
      };
      this.limitMap.set(key, entry);

      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - 1,
        reset: entry.resetAt
      };
    }

    // Increment count
    entry.count++;

    // Check limit
    if (entry.count > config.maxRequests) {
      this.stats.blocked++;
      this.stats.endpoints[endpoint].blocked++;

      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        reset: entry.resetAt,
        message: config.message
      };
    }

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - entry.count,
      reset: entry.resetAt
    };
  }

  /**
   * Express/Connect middleware
   * @param {Object} options - Middleware options
   * @param {Function} [options.keyGenerator] - Custom key generator
   * @param {Function} [options.skip] - Skip rate limiting for certain requests
   * @returns {Function} Middleware function
   */
  middleware(options = {}) {
    return (req, res, next) => {
      // Skip if specified
      if (options.skip && options.skip(req)) {
        return next();
      }

      const endpoint = req.path || req.url;
      const clientIP =
        (options.keyGenerator && options.keyGenerator(req)) ||
        req.headers['x-forwarded-for']?.split(',')[0] ||
        req.headers['x-real-ip'] ||
        req.socket.remoteAddress ||
        req.connection.remoteAddress ||
        'unknown';

      const result = this.checkLimit(endpoint, clientIP);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', new Date(result.reset).toISOString());

      if (!result.allowed) {
        res.setHeader('Retry-After', Math.ceil((result.reset - Date.now()) / 1000));

        const error = new RateLimitError(result.message, {
          endpoint,
          limit: result.limit,
          reset: result.reset
        });

        return res.status(429).json(error.toJSON());
      }

      next();
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.limitMap.entries()) {
      if (now >= entry.resetAt) {
        this.limitMap.delete(key);
        removed++;
      }
    }

    // Enforce max entries limit
    if (this.limitMap.size > this.maxEntries) {
      const toRemove = this.limitMap.size - this.maxEntries;
      const keys = Array.from(this.limitMap.keys()).slice(0, toRemove);
      keys.forEach(key => this.limitMap.delete(key));
      removed += keys.length;
    }

    return removed;
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      mapSize: this.limitMap.size,
      maxEntries: this.maxEntries,
      blockRate: this.stats.requests > 0 ? this.stats.blocked / this.stats.requests : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      requests: 0,
      blocked: 0,
      endpoints: {}
    };
  }

  /**
   * Clear all entries
   */
  clear() {
    this.limitMap.clear();
  }

  /**
   * Destroy the rate limiter
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

module.exports = EndpointRateLimiter;
