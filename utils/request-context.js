/**
 * Request Context Manager
 *
 * Implements request context tracking and management (Improvements #349-350)
 * - Request correlation IDs
 * - Distributed tracing support
 * - Context propagation across async calls
 * - Performance timing
 * - Request metadata storage
 */

const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');

/**
 * Request context configuration
 */
const DEFAULT_CONTEXT_CONFIG = {
  // ID generation
  generateRequestId: true,
  requestIdHeader: 'X-Request-ID',
  correlationIdHeader: 'X-Correlation-ID',

  // Tracing
  enableTracing: true,
  tracingHeader: 'X-Trace-ID',
  spanIdHeader: 'X-Span-ID',

  // Performance
  enableTiming: true,
  trackMemory: false,

  // Metadata
  captureHeaders: ['user-agent', 'referer', 'accept-language'],
  captureQuery: true,
  redactSensitive: true
};

/**
 * Request context
 */
class RequestContext {
  constructor(req, config = {}) {
    this.config = config;

    // IDs
    this.requestId = this.generateId('req');
    this.correlationId = null;
    this.traceId = null;
    this.spanId = null;

    // Request info
    this.method = req.method;
    this.url = req.url;
    this.path = req.path || req.url?.split('?')[0];
    this.query = config.captureQuery ? req.query : null;

    // Client info
    this.ip = req.ip || req.socket?.remoteAddress;
    this.userAgent = req.headers?.['user-agent'];
    this.origin = req.headers?.origin;

    // User info
    this.userId = req.user?.id || null;
    this.sessionId = req.session?.id || null;

    // Headers
    this.headers = {};
    if (config.captureHeaders) {
      for (const header of config.captureHeaders) {
        const value = req.headers?.[header];
        if (value) {
          this.headers[header] = value;
        }
      }
    }

    // Timing
    this.timing = {
      startTime: Date.now(),
      startHrTime: process.hrtime.bigint(),
      endTime: null,
      duration: null,
      phases: {}
    };

    // Memory
    if (config.trackMemory) {
      this.memory = {
        start: process.memoryUsage(),
        end: null,
        delta: null
      };
    }

    // Metadata storage
    this.metadata = {};

    // Child spans for distributed tracing
    this.spans = [];
  }

  /**
   * Generate unique ID
   */
  generateId(prefix = '') {
    const random = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now().toString(36);
    return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
  }

  /**
   * Set correlation ID
   */
  setCorrelationId(id) {
    this.correlationId = id;
  }

  /**
   * Set trace ID
   */
  setTraceId(id) {
    this.traceId = id;
  }

  /**
   * Set span ID
   */
  setSpanId(id) {
    this.spanId = id;
  }

  /**
   * Set user info
   */
  setUser(userId, sessionId = null) {
    this.userId = userId;
    this.sessionId = sessionId;
  }

  /**
   * Set metadata
   */
  set(key, value) {
    this.metadata[key] = value;
  }

  /**
   * Get metadata
   */
  get(key) {
    return this.metadata[key];
  }

  /**
   * Start timing phase
   */
  startPhase(name) {
    this.timing.phases[name] = {
      startTime: Date.now(),
      startHrTime: process.hrtime.bigint(),
      endTime: null,
      duration: null
    };
  }

  /**
   * End timing phase
   */
  endPhase(name) {
    const phase = this.timing.phases[name];
    if (!phase) {
      return;
    }

    phase.endTime = Date.now();
    const endHrTime = process.hrtime.bigint();
    phase.duration = Number(endHrTime - phase.startHrTime) / 1000000; // Convert to ms
  }

  /**
   * Create child span for distributed tracing
   */
  createSpan(name, attributes = {}) {
    const span = {
      spanId: this.generateId('span'),
      traceId: this.traceId || this.requestId,
      parentSpanId: this.spanId,
      name,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      attributes
    };

    this.spans.push(span);

    return {
      end: () => {
        span.endTime = Date.now();
        span.duration = span.endTime - span.startTime;
      },
      setAttribute: (key, value) => {
        span.attributes[key] = value;
      },
      setStatus: (status) => {
        span.status = status;
      }
    };
  }

  /**
   * Complete request
   */
  complete(statusCode = null) {
    this.timing.endTime = Date.now();
    const endHrTime = process.hrtime.bigint();
    this.timing.duration = Number(endHrTime - this.timing.startHrTime) / 1000000; // Convert to ms

    if (statusCode !== null) {
      this.statusCode = statusCode;
    }

    if (this.config.trackMemory) {
      this.memory.end = process.memoryUsage();
      this.memory.delta = {
        heapUsed: this.memory.end.heapUsed - this.memory.start.heapUsed,
        external: this.memory.end.external - this.memory.start.external
      };
    }
  }

  /**
   * Redact sensitive data
   */
  redact(data) {
    if (!this.config.redactSensitive) {
      return data;
    }

    const sensitiveKeys = ['password', 'token', 'secret', 'apikey', 'api_key', 'authorization'];
    const redacted = { ...data };

    for (const key of Object.keys(redacted)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
        redacted[key] = '[REDACTED]';
      }
    }

    return redacted;
  }

  /**
   * Get context summary
   */
  toJSON() {
    return {
      requestId: this.requestId,
      correlationId: this.correlationId,
      traceId: this.traceId,
      spanId: this.spanId,
      method: this.method,
      url: this.url,
      path: this.path,
      statusCode: this.statusCode,
      ip: this.ip,
      userId: this.userId,
      sessionId: this.sessionId,
      timing: this.timing,
      memory: this.memory,
      metadata: this.metadata,
      spans: this.spans
    };
  }

  /**
   * Get formatted log entry
   */
  toLogEntry() {
    return {
      request_id: this.requestId,
      correlation_id: this.correlationId,
      trace_id: this.traceId,
      method: this.method,
      path: this.path,
      status_code: this.statusCode,
      duration_ms: this.timing.duration?.toFixed(2),
      user_id: this.userId,
      ip: this.ip
    };
  }
}

/**
 * Request context manager using AsyncLocalStorage
 */
class RequestContextManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONTEXT_CONFIG, ...config };
    this.storage = new AsyncLocalStorage();
    this.contexts = new Map(); // Store contexts by request ID
  }

  /**
   * Create and set context for request
   */
  create(req, res) {
    const context = new RequestContext(req, this.config);

    // Extract IDs from headers
    if (this.config.generateRequestId) {
      const headerRequestId = req.headers?.[this.config.requestIdHeader.toLowerCase()];
      if (headerRequestId) {
        context.requestId = headerRequestId;
      }
    }

    const headerCorrelationId = req.headers?.[this.config.correlationIdHeader.toLowerCase()];
    if (headerCorrelationId) {
      context.setCorrelationId(headerCorrelationId);
    }

    if (this.config.enableTracing) {
      const headerTraceId = req.headers?.[this.config.tracingHeader.toLowerCase()];
      if (headerTraceId) {
        context.setTraceId(headerTraceId);
      } else {
        context.setTraceId(context.generateId('trace'));
      }

      const headerSpanId = req.headers?.[this.config.spanIdHeader.toLowerCase()];
      if (headerSpanId) {
        context.setSpanId(headerSpanId);
      } else {
        context.setSpanId(context.generateId('span'));
      }
    }

    // Store context
    this.contexts.set(context.requestId, context);

    // Set response headers
    if (res) {
      res.setHeader(this.config.requestIdHeader, context.requestId);
      if (context.correlationId) {
        res.setHeader(this.config.correlationIdHeader, context.correlationId);
      }
      if (context.traceId) {
        res.setHeader(this.config.tracingHeader, context.traceId);
      }
    }

    return context;
  }

  /**
   * Run function with context
   */
  run(context, fn) {
    return this.storage.run(context, fn);
  }

  /**
   * Get current context
   */
  get() {
    return this.storage.getStore();
  }

  /**
   * Get context by request ID
   */
  getById(requestId) {
    return this.contexts.get(requestId);
  }

  /**
   * Remove context
   */
  remove(requestId) {
    this.contexts.delete(requestId);
  }

  /**
   * Cleanup old contexts
   */
  cleanup(maxAge = 3600000) {
    const now = Date.now();
    const toRemove = [];

    for (const [requestId, context] of this.contexts.entries()) {
      const age = now - context.timing.startTime;
      if (age > maxAge) {
        toRemove.push(requestId);
      }
    }

    for (const requestId of toRemove) {
      this.contexts.delete(requestId);
    }

    return toRemove.length;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const contexts = Array.from(this.contexts.values());
    const completed = contexts.filter((ctx) => ctx.timing.endTime !== null);

    const totalDuration = completed.reduce((sum, ctx) => sum + (ctx.timing.duration || 0), 0);
    const avgDuration = completed.length > 0 ? totalDuration / completed.length : 0;

    const statusCodes = {};
    for (const ctx of completed) {
      const code = ctx.statusCode || 'unknown';
      statusCodes[code] = (statusCodes[code] || 0) + 1;
    }

    return {
      activeContexts: this.contexts.size,
      completedRequests: completed.length,
      averageDuration: avgDuration.toFixed(2) + 'ms',
      statusCodes,
      oldestContext: contexts.length > 0 ?
        Math.min(...contexts.map((ctx) => ctx.timing.startTime)) : null
    };
  }
}

/**
 * Create request context middleware
 */
function createRequestContextMiddleware(config = {}) {
  const manager = new RequestContextManager(config);

  // Periodic cleanup
  const cleanupInterval = setInterval(() => {
    manager.cleanup();
  }, 300000); // Every 5 minutes

  const middleware = (req, res, next) => {
    const context = manager.create(req, res);

    // Complete context on response finish
    res.on('finish', () => {
      context.complete(res.statusCode);

      // Remove from active contexts after a delay
      setTimeout(() => {
        manager.remove(context.requestId);
      }, 60000); // Keep for 1 minute after completion
    });

    // Run request in context
    manager.run(context, () => {
      next();
    });
  };

  return {
    manager,
    middleware,
    cleanup: () => {
      clearInterval(cleanupInterval);
    }
  };
}

/**
 * Helper to get current request context
 */
let globalManager = null;

function setGlobalManager(manager) {
  globalManager = manager;
}

function getCurrentContext() {
  return globalManager ? globalManager.get() : null;
}

function withContext(fn) {
  const context = getCurrentContext();
  if (!context) {
    throw new Error('No active request context');
  }
  return fn(context);
}

module.exports = {
  RequestContext,
  RequestContextManager,
  createRequestContextMiddleware,
  setGlobalManager,
  getCurrentContext,
  withContext,
  DEFAULT_CONTEXT_CONFIG
};
