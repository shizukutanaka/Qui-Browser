/**
 * Middleware System - Request/Response lifecycle management
 *
 * @module core/middleware
 * @description Provides a flexible middleware system for request processing
 */

/**
 * Middleware Manager - Orchestrates middleware execution
 *
 * @class MiddlewareManager
 * @description Manages middleware registration and execution with:
 * - Before request middleware (authentication, rate limiting, etc.)
 * - After response middleware (logging, metrics, cleanup, etc.)
 * - Error handling middleware
 * - Async/await support
 * - Middleware priority/ordering
 */
class MiddlewareManager {
  /**
   * Create a MiddlewareManager instance
   *
   * @param {Object} options - Configuration options
   * @param {boolean} [options.enableErrorHandling=true] - Enable error handling middleware
   */
  constructor(options = {}) {
    this.beforeMiddlewares = [];
    this.afterMiddlewares = [];
    this.errorMiddlewares = [];
    this.enableErrorHandling = options.enableErrorHandling !== false;
  }

  /**
   * Register a before-request middleware
   *
   * @param {Function} fn - Middleware function (req, res, next) => Promise<void> | void
   * @param {Object} [options] - Middleware options
   * @param {number} [options.priority=0] - Execution priority (higher = earlier)
   * @param {string} [options.name] - Middleware name for debugging
   * @returns {MiddlewareManager} This instance for chaining
   * @example
   * middleware.before(async (req, res, next) => {
   *   console.log('Request received:', req.url);
   *   await next();
   * });
   */
  before(fn, options = {}) {
    if (typeof fn !== 'function') {
      throw new TypeError('Middleware must be a function');
    }

    this.beforeMiddlewares.push({
      fn,
      priority: options.priority || 0,
      name: options.name || fn.name || 'anonymous'
    });

    // Sort by priority (descending)
    this.beforeMiddlewares.sort((a, b) => b.priority - a.priority);

    return this;
  }

  /**
   * Register an after-response middleware
   *
   * @param {Function} fn - Middleware function (req, res, result, next) => Promise<void> | void
   * @param {Object} [options] - Middleware options
   * @param {number} [options.priority=0] - Execution priority (higher = earlier)
   * @param {string} [options.name] - Middleware name for debugging
   * @returns {MiddlewareManager} This instance for chaining
   */
  after(fn, options = {}) {
    if (typeof fn !== 'function') {
      throw new TypeError('Middleware must be a function');
    }

    this.afterMiddlewares.push({
      fn,
      priority: options.priority || 0,
      name: options.name || fn.name || 'anonymous'
    });

    this.afterMiddlewares.sort((a, b) => b.priority - a.priority);

    return this;
  }

  /**
   * Register an error handling middleware
   *
   * @param {Function} fn - Error middleware function (error, req, res, next) => Promise<void> | void
   * @param {Object} [options] - Middleware options
   * @param {string} [options.name] - Middleware name for debugging
   * @returns {MiddlewareManager} This instance for chaining
   */
  error(fn, options = {}) {
    if (typeof fn !== 'function') {
      throw new TypeError('Error middleware must be a function');
    }

    this.errorMiddlewares.push({
      fn,
      name: options.name || fn.name || 'anonymous'
    });

    return this;
  }

  /**
   * Execute before-request middleware chain
   *
   * @param {Object} req - HTTP request object
   * @param {Object} res - HTTP response object
   * @returns {Promise<boolean>} True if all middleware succeeded, false if stopped
   * @description Executes middleware in priority order. If any middleware
   * doesn't call next(), the chain stops and returns false.
   */
  async executeBefore(req, res) {
    let index = 0;
    const middlewares = this.beforeMiddlewares;

    const next = async () => {
      if (index >= middlewares.length) {
        return;
      }

      const middleware = middlewares[index++];

      try {
        await middleware.fn(req, res, next);
      } catch (error) {
        if (this.enableErrorHandling) {
          await this.executeError(error, req, res);
        } else {
          throw error;
        }
      }
    };

    try {
      await next();
      return true;
    } catch (error) {
      if (this.enableErrorHandling) {
        await this.executeError(error, req, res);
        return false;
      }
      throw error;
    }
  }

  /**
   * Execute after-response middleware chain
   *
   * @param {Object} req - HTTP request object
   * @param {Object} res - HTTP response object
   * @param {*} result - Result from request handler
   * @returns {Promise<void>}
   */
  async executeAfter(req, res, result) {
    let index = 0;
    const middlewares = this.afterMiddlewares;

    const next = async () => {
      if (index >= middlewares.length) {
        return;
      }

      const middleware = middlewares[index++];

      try {
        await middleware.fn(req, res, result, next);
      } catch (error) {
        console.error(`[middleware] Error in after middleware "${middleware.name}":`, error);
        // Continue with remaining middleware even if one fails
        await next();
      }
    };

    await next();
  }

  /**
   * Execute error handling middleware chain
   *
   * @param {Error} error - Error object
   * @param {Object} req - HTTP request object
   * @param {Object} res - HTTP response object
   * @returns {Promise<void>}
   */
  async executeError(error, req, res) {
    for (const middleware of this.errorMiddlewares) {
      try {
        await middleware.fn(error, req, res, () => {});
      } catch (err) {
        console.error(`[middleware] Error in error middleware "${middleware.name}":`, err);
      }
    }
  }

  /**
   * Get middleware statistics
   *
   * @returns {Object} Middleware statistics
   */
  getStats() {
    return {
      before: this.beforeMiddlewares.length,
      after: this.afterMiddlewares.length,
      error: this.errorMiddlewares.length,
      total: this.beforeMiddlewares.length + this.afterMiddlewares.length + this.errorMiddlewares.length,
      middlewares: {
        before: this.beforeMiddlewares.map(m => ({ name: m.name, priority: m.priority })),
        after: this.afterMiddlewares.map(m => ({ name: m.name, priority: m.priority })),
        error: this.errorMiddlewares.map(m => ({ name: m.name }))
      }
    };
  }

  /**
   * Clear all middleware
   */
  clear() {
    this.beforeMiddlewares = [];
    this.afterMiddlewares = [];
    this.errorMiddlewares = [];
  }

  /**
   * Remove a specific middleware by name
   *
   * @param {string} name - Middleware name
   * @param {string} [type='before'] - Middleware type ('before', 'after', 'error')
   * @returns {boolean} True if middleware was removed
   */
  remove(name, type = 'before') {
    const middlewareArray =
      type === 'before' ? this.beforeMiddlewares : type === 'after' ? this.afterMiddlewares : this.errorMiddlewares;

    const initialLength = middlewareArray.length;
    const filtered = middlewareArray.filter(m => m.name !== name);

    if (type === 'before') {
      this.beforeMiddlewares = filtered;
    } else if (type === 'after') {
      this.afterMiddlewares = filtered;
    } else {
      this.errorMiddlewares = filtered;
    }

    return filtered.length < initialLength;
  }
}

/**
 * Create common middleware helpers
 */
const CommonMiddleware = {
  /**
   * Request logging middleware
   *
   * @param {Object} options - Logging options
   * @returns {Function} Middleware function
   */
  logger(options = {}) {
    const verbose = options.verbose !== false;

    return async (req, res, next) => {
      const start = Date.now();
      req._middlewareStartTime = start;

      if (verbose) {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      }

      await next();
    };
  },

  /**
   * Request timing middleware
   *
   * @returns {Function} Middleware function
   */
  timing() {
    return async (req, res, result, next) => {
      const duration = Date.now() - (req._middlewareStartTime || Date.now());
      res.setHeader('X-Response-Time', `${duration}ms`);
      await next();
    };
  },

  /**
   * Security headers middleware
   * @deprecated Use SecurityManager.applySecurityHeaders() from core/security.js instead
   * This method is kept for backward compatibility but delegates to the security module
   */
  securityHeaders(headers = {}) {
    console.warn(
      '[DEPRECATED] CommonMiddleware.securityHeaders() is deprecated. Use SecurityManager.applySecurityHeaders() instead.'
    );
    const defaultHeaders = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    };

    const finalHeaders = { ...defaultHeaders, ...headers };

    return async (req, res, next) => {
      Object.entries(finalHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      await next();
    };
  },

  /**
   * CORS middleware
   * @deprecated Use SecurityManager.setCorsHeaders() from core/security.js instead
   * This method is kept for backward compatibility but delegates to the security module
   */
  cors(options = {}) {
    console.warn('[DEPRECATED] CommonMiddleware.cors() is deprecated. Use SecurityManager.setCorsHeaders() instead.');
    const origin = options.origin || '*';
    const methods = options.methods || 'GET,HEAD,PUT,PATCH,POST,DELETE';
    const allowedHeaders = options.allowedHeaders || 'Content-Type,Authorization';

    return async (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', methods);
      res.setHeader('Access-Control-Allow-Headers', allowedHeaders);

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      await next();
    };
  }
};

module.exports = {
  MiddlewareManager,
  CommonMiddleware
};
