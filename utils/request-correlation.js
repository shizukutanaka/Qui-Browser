/**
 * Request Correlation System
 * Distributed tracing with correlation IDs
 *
 * @module utils/request-correlation
 */

const crypto = require('crypto');

/**
 * Request Correlation Manager
 * Generates and manages correlation IDs for distributed tracing
 *
 * @class RequestCorrelation
 * @description Provides request correlation for:
 * - Distributed tracing across services
 * - Request tracking through logs
 * - Performance analysis
 * - Debugging support
 */
class RequestCorrelation {
  /**
   * Create request correlation manager
   * @param {Object} options - Configuration options
   * @param {string} [options.headerName='X-Correlation-ID'] - Header name
   * @param {string} [options.format='uuid'] - ID format (uuid|short|numeric)
   * @param {boolean} [options.includeTimestamp=false] - Include timestamp in ID
   * @param {Function} [options.generator] - Custom ID generator
   */
  constructor(options = {}) {
    this.headerName = options.headerName || 'X-Correlation-ID';
    this.format = options.format || 'uuid';
    this.includeTimestamp = options.includeTimestamp || false;
    this.generator = options.generator || this.defaultGenerator.bind(this);

    this.activeRequests = new Map();
    this.stats = {
      total: 0,
      active: 0,
      completed: 0
    };
  }

  /**
   * Generate correlation ID
   * @param {Object} [req] - HTTP request
   * @returns {string} - Correlation ID
   */
  generate(req = null) {
    // Check if correlation ID already exists in request
    if (req && req.headers) {
      const existing = req.headers[this.headerName.toLowerCase()];
      if (existing && this.isValidId(existing)) {
        return existing;
      }
    }

    // Generate new ID
    return this.generator(req);
  }

  /**
   * Default ID generator
   * @private
   * @param {Object} req - HTTP request
   * @returns {string} - Generated ID
   */
  defaultGenerator(req) {
    let id;

    switch (this.format) {
      case 'uuid':
        id = this.generateUuid();
        break;
      case 'short':
        id = this.generateShortId();
        break;
      case 'numeric':
        id = this.generateNumericId();
        break;
      default:
        id = this.generateUuid();
    }

    if (this.includeTimestamp) {
      const timestamp = Date.now();
      id = `${timestamp}-${id}`;
    }

    return id;
  }

  /**
   * Generate UUID v4
   * @private
   * @returns {string} - UUID
   */
  generateUuid() {
    return crypto.randomUUID();
  }

  /**
   * Generate short ID
   * @private
   * @returns {string} - Short ID (16 chars)
   */
  generateShortId() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Generate numeric ID
   * @private
   * @returns {string} - Numeric ID
   */
  generateNumericId() {
    return Date.now().toString() + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  }

  /**
   * Validate correlation ID
   * @param {string} id - ID to validate
   * @returns {boolean} - True if valid
   */
  isValidId(id) {
    if (typeof id !== 'string' || id.length === 0) {
      return false;
    }

    switch (this.format) {
      case 'uuid':
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
      case 'short':
        return /^[0-9a-f]{16}$/i.test(id) || /^\d+-[0-9a-f]{16}$/i.test(id);
      case 'numeric':
        return /^\d{16,20}$/.test(id) || /^\d+-\d{16,20}$/.test(id);
      default:
        return id.length > 0 && id.length < 100;
    }
  }

  /**
   * Start tracking request
   * @param {string} correlationId - Correlation ID
   * @param {Object} metadata - Request metadata
   */
  startTracking(correlationId, metadata = {}) {
    this.stats.total++;
    this.stats.active++;

    this.activeRequests.set(correlationId, {
      id: correlationId,
      startTime: Date.now(),
      ...metadata
    });
  }

  /**
   * End tracking request
   * @param {string} correlationId - Correlation ID
   * @param {Object} result - Request result
   */
  endTracking(correlationId, result = {}) {
    const request = this.activeRequests.get(correlationId);

    if (request) {
      const duration = Date.now() - request.startTime;
      this.activeRequests.delete(correlationId);
      this.stats.active--;
      this.stats.completed++;

      return {
        ...request,
        duration,
        endTime: Date.now(),
        ...result
      };
    }

    return null;
  }

  /**
   * Get request info
   * @param {string} correlationId - Correlation ID
   * @returns {Object|null} - Request info
   */
  getRequestInfo(correlationId) {
    return this.activeRequests.get(correlationId) || null;
  }

  /**
   * Get all active requests
   * @returns {Array<Object>} - Active requests
   */
  getActiveRequests() {
    return Array.from(this.activeRequests.values());
  }

  /**
   * Get statistics
   * @returns {Object} - Statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Middleware factory for Express-like frameworks
   * @returns {Function} - Middleware function
   */
  middleware() {
    return (req, res, next) => {
      // Generate or extract correlation ID
      const correlationId = this.generate(req);

      // Attach to request
      req.correlationId = correlationId;

      // Set response header
      res.setHeader(this.headerName, correlationId);

      // Start tracking
      this.startTracking(correlationId, {
        method: req.method,
        url: req.url,
        ip: req.socket?.remoteAddress
      });

      // End tracking on response finish
      const originalEnd = res.end;
      res.end = (...args) => {
        this.endTracking(correlationId, {
          statusCode: res.statusCode
        });
        return originalEnd.apply(res, args);
      };

      next();
    };
  }

  /**
   * Create child correlation ID
   * @param {string} parentId - Parent correlation ID
   * @param {string} [suffix] - Suffix for child ID
   * @returns {string} - Child correlation ID
   */
  createChild(parentId, suffix = null) {
    const childSuffix = suffix || crypto.randomBytes(4).toString('hex');
    return `${parentId}.${childSuffix}`;
  }

  /**
   * Parse correlation ID to extract timestamp
   * @param {string} correlationId - Correlation ID
   * @returns {number|null} - Timestamp or null
   */
  extractTimestamp(correlationId) {
    if (!this.includeTimestamp) {
      return null;
    }

    const match = correlationId.match(/^(\d+)-/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Clean up old requests (for memory management)
   * @param {number} [maxAge=3600000] - Max age in ms (default: 1 hour)
   */
  cleanup(maxAge = 3600000) {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, request] of this.activeRequests.entries()) {
      if (now - request.startTime > maxAge) {
        this.activeRequests.delete(id);
        this.stats.active--;
        cleaned++;
      }
    }

    return cleaned;
  }
}

/**
 * Global correlation context (for async operations)
 */
class CorrelationContext {
  constructor() {
    this.storage = new Map();
  }

  /**
   * Run function with correlation context
   * @param {string} correlationId - Correlation ID
   * @param {Function} fn - Function to run
   * @returns {*} - Function result
   */
  run(correlationId, fn) {
    const asyncId = this.generateAsyncId();
    this.storage.set(asyncId, correlationId);

    try {
      return fn();
    } finally {
      this.storage.delete(asyncId);
    }
  }

  /**
   * Get current correlation ID
   * @returns {string|null} - Current correlation ID
   */
  getCurrentId() {
    const asyncId = this.generateAsyncId();
    return this.storage.get(asyncId) || null;
  }

  /**
   * Generate async operation ID
   * @private
   * @returns {string} - Async ID
   */
  generateAsyncId() {
    // Simple implementation - in production, use async_hooks
    return 'global';
  }
}

/**
 * Logger wrapper with correlation ID
 */
class CorrelationLogger {
  constructor(logger, correlation) {
    this.logger = logger;
    this.correlation = correlation;
  }

  /**
   * Log with correlation ID
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} meta - Metadata
   */
  log(level, message, meta = {}) {
    const correlationId = this.correlation.getCurrentId();

    this.logger[level](message, {
      ...meta,
      correlationId
    });
  }

  info(message, meta) {
    this.log('info', message, meta);
  }

  warn(message, meta) {
    this.log('warn', message, meta);
  }

  error(message, meta) {
    this.log('error', message, meta);
  }

  debug(message, meta) {
    this.log('debug', message, meta);
  }
}

/**
 * Create correlation middleware
 * @param {Object} options - Options
 * @returns {Function} - Middleware
 */
function createCorrelationMiddleware(options = {}) {
  const correlation = new RequestCorrelation(options);
  return correlation.middleware();
}

module.exports = {
  RequestCorrelation,
  CorrelationContext,
  CorrelationLogger,
  createCorrelationMiddleware
};
