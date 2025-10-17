/**
 * Bandwidth Controller
 * Granular bandwidth control policies for network optimization
 * Priority: H020 from improvement backlog
 *
 * @module utils/bandwidth-controller
 */

const { Transform } = require('stream');

class BandwidthController {
  constructor(options = {}) {
    this.options = {
      globalLimit: options.globalLimit || null, // bytes per second
      perClientLimit: options.perClientLimit || null,
      perEndpointLimit: options.perEndpointLimit || {},
      priorityLevels: options.priorityLevels || {
        critical: 1.0,  // 100% bandwidth
        high: 0.75,     // 75% bandwidth
        medium: 0.5,    // 50% bandwidth
        low: 0.25       // 25% bandwidth
      },
      burstSize: options.burstSize || 65536, // 64KB burst
      enableQoS: options.enableQoS !== false,
      enableShaping: options.enableShaping !== false,
      ...options
    };

    // Bandwidth tracking
    this.globalUsage = {
      bytes: 0,
      resetTime: Date.now()
    };

    this.clientUsage = new Map();
    this.endpointUsage = new Map();

    // QoS queue
    this.qosQueue = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };

    // Start bandwidth reset interval
    this.startResetInterval();
  }

  /**
   * Create throttle stream
   * @param {Object} context - Request context
   * @returns {Transform} Throttle stream
   */
  createThrottleStream(context = {}) {
    const {
      clientId,
      endpoint,
      priority = 'medium',
      contentLength
    } = context;

    const limit = this.calculateLimit(context);

    return new ThrottleStream({
      limit,
      priority,
      controller: this,
      context
    });
  }

  /**
   * Calculate bandwidth limit for request
   * @param {Object} context - Request context
   * @returns {number} Bandwidth limit in bytes/sec
   */
  calculateLimit(context) {
    const { clientId, endpoint, priority, contentType } = context;

    let limit = this.options.globalLimit;

    // Per-client limit
    if (this.options.perClientLimit) {
      limit = Math.min(limit || Infinity, this.options.perClientLimit);
    }

    // Per-endpoint limit
    if (endpoint && this.options.perEndpointLimit[endpoint]) {
      limit = Math.min(limit || Infinity, this.options.perEndpointLimit[endpoint]);
    }

    // Priority-based adjustment
    if (priority && this.options.priorityLevels[priority]) {
      const multiplier = this.options.priorityLevels[priority];
      limit = limit ? Math.floor(limit * multiplier) : limit;
    }

    // Content-type based adjustment
    if (contentType) {
      const adjustment = this.getContentTypeAdjustment(contentType);
      limit = limit ? Math.floor(limit * adjustment) : limit;
    }

    return limit;
  }

  /**
   * Get content-type bandwidth adjustment
   * @param {string} contentType - Content type
   * @returns {number} Multiplier
   */
  getContentTypeAdjustment(contentType) {
    const adjustments = {
      'text/html': 1.0,
      'text/css': 1.0,
      'application/javascript': 1.0,
      'application/json': 1.0,
      'image/jpeg': 0.8,
      'image/png': 0.8,
      'image/webp': 0.8,
      'video/mp4': 0.5,
      'video/webm': 0.5,
      'application/octet-stream': 0.6
    };

    for (const [type, multiplier] of Object.entries(adjustments)) {
      if (contentType.includes(type)) {
        return multiplier;
      }
    }

    return 1.0;
  }

  /**
   * Check if bandwidth available
   * @param {string} clientId - Client ID
   * @param {string} endpoint - Endpoint
   * @param {number} bytes - Bytes to send
   * @returns {boolean} Available
   */
  checkBandwidthAvailable(clientId, endpoint, bytes) {
    const now = Date.now();

    // Check global limit
    if (this.options.globalLimit) {
      const elapsed = (now - this.globalUsage.resetTime) / 1000;
      const allowedBytes = this.options.globalLimit * elapsed;

      if (this.globalUsage.bytes + bytes > allowedBytes) {
        return false;
      }
    }

    // Check per-client limit
    if (this.options.perClientLimit && clientId) {
      const usage = this.clientUsage.get(clientId) || { bytes: 0, resetTime: now };
      const elapsed = (now - usage.resetTime) / 1000;
      const allowedBytes = this.options.perClientLimit * elapsed;

      if (usage.bytes + bytes > allowedBytes) {
        return false;
      }
    }

    // Check per-endpoint limit
    if (endpoint && this.options.perEndpointLimit[endpoint]) {
      const usage = this.endpointUsage.get(endpoint) || { bytes: 0, resetTime: now };
      const elapsed = (now - usage.resetTime) / 1000;
      const allowedBytes = this.options.perEndpointLimit[endpoint] * elapsed;

      if (usage.bytes + bytes > allowedBytes) {
        return false;
      }
    }

    return true;
  }

  /**
   * Record bandwidth usage
   * @param {string} clientId - Client ID
   * @param {string} endpoint - Endpoint
   * @param {number} bytes - Bytes sent
   */
  recordUsage(clientId, endpoint, bytes) {
    const now = Date.now();

    // Global usage
    this.globalUsage.bytes += bytes;

    // Per-client usage
    if (clientId) {
      const usage = this.clientUsage.get(clientId) || { bytes: 0, resetTime: now };
      usage.bytes += bytes;
      this.clientUsage.set(clientId, usage);
    }

    // Per-endpoint usage
    if (endpoint) {
      const usage = this.endpointUsage.get(endpoint) || { bytes: 0, resetTime: now };
      usage.bytes += bytes;
      this.endpointUsage.set(endpoint, usage);
    }
  }

  /**
   * Start bandwidth reset interval
   */
  startResetInterval() {
    this.resetInterval = setInterval(() => {
      this.resetBandwidth();
    }, 1000); // Reset every second
  }

  /**
   * Reset bandwidth counters
   */
  resetBandwidth() {
    const now = Date.now();

    // Reset global
    this.globalUsage = {
      bytes: 0,
      resetTime: now
    };

    // Reset per-client (keep only active clients)
    for (const [clientId, usage] of this.clientUsage.entries()) {
      if (now - usage.resetTime > 60000) { // 1 minute inactive
        this.clientUsage.delete(clientId);
      } else {
        usage.bytes = 0;
        usage.resetTime = now;
      }
    }

    // Reset per-endpoint
    for (const [endpoint, usage] of this.endpointUsage.entries()) {
      usage.bytes = 0;
      usage.resetTime = now;
    }
  }

  /**
   * Stop bandwidth controller
   */
  stop() {
    if (this.resetInterval) {
      clearInterval(this.resetInterval);
      this.resetInterval = null;
    }
  }

  /**
   * Get bandwidth statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      global: {
        bytesUsed: this.globalUsage.bytes,
        limit: this.options.globalLimit,
        utilization: this.options.globalLimit
          ? (this.globalUsage.bytes / this.options.globalLimit * 100).toFixed(2) + '%'
          : 'N/A'
      },
      clients: {
        active: this.clientUsage.size,
        topClients: this.getTopClients(10)
      },
      endpoints: {
        active: this.endpointUsage.size,
        topEndpoints: this.getTopEndpoints(10)
      }
    };
  }

  /**
   * Get top bandwidth consumers (clients)
   * @param {number} limit - Number of results
   * @returns {Array} Top clients
   */
  getTopClients(limit = 10) {
    return Array.from(this.clientUsage.entries())
      .sort(([, a], [, b]) => b.bytes - a.bytes)
      .slice(0, limit)
      .map(([clientId, usage]) => ({
        clientId,
        bytes: usage.bytes,
        formattedSize: this.formatBytes(usage.bytes)
      }));
  }

  /**
   * Get top bandwidth consumers (endpoints)
   * @param {number} limit - Number of results
   * @returns {Array} Top endpoints
   */
  getTopEndpoints(limit = 10) {
    return Array.from(this.endpointUsage.entries())
      .sort(([, a], [, b]) => b.bytes - a.bytes)
      .slice(0, limit)
      .map(([endpoint, usage]) => ({
        endpoint,
        bytes: usage.bytes,
        formattedSize: this.formatBytes(usage.bytes)
      }));
  }

  /**
   * Format bytes to human readable
   * @param {number} bytes - Bytes
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Create Express middleware
   * @param {Object} options - Middleware options
   * @returns {Function} Express middleware
   */
  middleware(options = {}) {
    return (req, res, next) => {
      const context = {
        clientId: req.ip,
        endpoint: req.path,
        priority: options.priority || 'medium',
        contentType: res.getHeader('content-type')
      };

      // Skip if no bandwidth limit
      const limit = this.calculateLimit(context);
      if (!limit) {
        return next();
      }

      // Create throttle stream
      const throttleStream = this.createThrottleStream(context);

      // Intercept res.write and res.end
      const originalWrite = res.write.bind(res);
      const originalEnd = res.end.bind(res);

      res.write = function(chunk, encoding, callback) {
        return throttleStream.write(chunk, encoding, callback);
      };

      res.end = function(chunk, encoding, callback) {
        if (chunk) {
          throttleStream.end(chunk, encoding, callback);
        } else {
          throttleStream.end(callback);
        }
      };

      // Pipe throttle stream to original response
      throttleStream.on('data', (chunk) => {
        originalWrite(chunk);
      });

      throttleStream.on('end', () => {
        originalEnd();
      });

      next();
    };
  }
}

/**
 * Throttle Stream
 * Transform stream that throttles data flow
 */
class ThrottleStream extends Transform {
  constructor(options = {}) {
    super();

    this.limit = options.limit; // bytes per second
    this.priority = options.priority || 'medium';
    this.controller = options.controller;
    this.context = options.context;

    this.bytesWritten = 0;
    this.startTime = Date.now();
    this.queue = [];
  }

  _transform(chunk, encoding, callback) {
    if (!this.limit) {
      // No throttling
      this.push(chunk);
      return callback();
    }

    const now = Date.now();
    const elapsed = (now - this.startTime) / 1000;
    const allowedBytes = this.limit * elapsed;

    if (this.bytesWritten + chunk.length <= allowedBytes) {
      // Within limit
      this.bytesWritten += chunk.length;
      this.controller.recordUsage(
        this.context.clientId,
        this.context.endpoint,
        chunk.length
      );
      this.push(chunk);
      callback();
    } else {
      // Exceeded limit, delay
      const bytesOver = (this.bytesWritten + chunk.length) - allowedBytes;
      const delay = (bytesOver / this.limit) * 1000;

      setTimeout(() => {
        this.bytesWritten += chunk.length;
        this.controller.recordUsage(
          this.context.clientId,
          this.context.endpoint,
          chunk.length
        );
        this.push(chunk);
        callback();
      }, delay);
    }
  }
}

module.exports = BandwidthController;
