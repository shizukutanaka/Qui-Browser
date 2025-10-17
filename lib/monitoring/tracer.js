/**
 * Qui Browser - Distributed Tracing Utilities
 *
 * OpenTelemetry-compatible tracing with automatic instrumentation
 */

const { MonitoringManager } = require('./manager');
const crypto = require('crypto');

class Tracer {
  constructor(monitoringManager) {
    this.monitoring = monitoringManager;
    this.activeSpans = new Map();
    this.serviceName = 'qui-browser';
    this.serviceVersion = '1.1.0';
  }

  /**
   * Start a new trace
   */
  startTrace(operation, options = {}) {
    const {
      parentSpan,
      tags = {},
      kind = 'internal'
    } = options;

    const span = this.monitoring.startTrace(operation, parentSpan);

    // Add standard tags
    this.addTags(span, {
      'service.name': this.serviceName,
      'service.version': this.serviceVersion,
      'span.kind': kind,
      ...tags
    });

    // Store active span
    this.activeSpans.set(operation, span);

    return span;
  }

  /**
   * Get the currently active span
   */
  getActiveSpan() {
    // Return the most recently started active span
    const spans = Array.from(this.activeSpans.values());
    return spans[spans.length - 1];
  }

  /**
   * End a trace
   */
  endTrace(span, error = null) {
    if (!span) return;

    // Remove from active spans
    this.activeSpans.delete(span.operation);

    // End the trace
    this.monitoring.endTrace(span, error);
  }

  /**
   * Add tags to a span
   */
  addTags(span, tags) {
    if (!span) return;

    for (const [key, value] of Object.entries(tags)) {
      this.monitoring.addSpanTag(span, key, value);
    }
  }

  /**
   * Add an event to a span
   */
  addEvent(span, name, attributes = {}) {
    if (!span) return;

    this.monitoring.addSpanEvent(span, name, attributes);
  }

  /**
   * Create a child span
   */
  startChildSpan(parentSpan, operation, tags = {}) {
    return this.startTrace(operation, {
      parentSpan,
      tags: {
        ...tags,
        'span.kind': 'internal'
      }
    });
  }

  /**
   * HTTP request tracing middleware
   */
  httpMiddleware() {
    return (req, res, next) => {
      // Extract trace context from headers
      const traceId = req.headers['x-trace-id'] || crypto.randomUUID();
      const spanId = req.headers['x-span-id'] || crypto.randomUUID();
      const parentSpanId = req.headers['x-parent-span-id'];

      // Create request span
      const span = this.startTrace(`${req.method} ${req.url}`, {
        tags: {
          'http.method': req.method,
          'http.url': req.url,
          'http.user_agent': req.headers['user-agent'],
          'http.remote_addr': req.socket.remoteAddress,
          'span.kind': 'server'
        }
      });

      // Set trace headers on response
      res.setHeader('x-trace-id', span.traceId);
      res.setHeader('x-span-id', span.id);

      // Add request details
      this.addTags(span, {
        'http.request_id': req.headers['x-request-id'],
        'http.correlation_id': req.correlationId,
        'user.id': req.user?.id,
        'session.id': req.session?.id
      });

      // Track response
      const originalEnd = res.end;
      res.end = (...args) => {
        // Add response details
        this.addTags(span, {
          'http.status_code': res.statusCode,
          'http.response_size': res.getHeader('content-length') || 0
        });

        // Add error if status is error
        if (res.statusCode >= 400) {
          this.addEvent(span, 'http.error', {
            'http.status_code': res.statusCode,
            'error.message': res.statusMessage
          });
        }

        // End span
        this.endTrace(span);

        return originalEnd.apply(res, args);
      };

      // Store span on request for child spans
      req._traceSpan = span;

      next();
    };
  }

  /**
   * Database operation tracing
   */
  async traceDatabaseOperation(operation, query, callback) {
    const span = this.startChildSpan(this.getActiveSpan(), `db.${operation}`, {
      'db.operation': operation,
      'db.query': query.substring(0, 100), // Truncate long queries
      'span.kind': 'client'
    });

    const startTime = Date.now();

    try {
      const result = await callback();

      // Add success details
      this.addTags(span, {
        'db.rows_affected': result?.rowCount || result?.length || 0,
        'db.duration': Date.now() - startTime
      });

      this.endTrace(span);
      return result;

    } catch (error) {
      // Add error details
      this.addEvent(span, 'db.error', {
        'error.message': error.message,
        'error.code': error.code
      });

      this.endTrace(span, error);
      throw error;
    }
  }

  /**
   * External API call tracing
   */
  async traceExternalCall(url, method, callback) {
    const span = this.startChildSpan(this.getActiveSpan(), `http.${method.toLowerCase()}`, {
      'http.method': method,
      'http.url': url,
      'span.kind': 'client'
    });

    const startTime = Date.now();

    try {
      const response = await callback();

      // Add response details
      this.addTags(span, {
        'http.status_code': response.status,
        'http.response_size': response.headers.get('content-length') || 0,
        'http.duration': Date.now() - startTime
      });

      this.endTrace(span);
      return response;

    } catch (error) {
      this.addEvent(span, 'http.error', {
        'error.message': error.message
      });

      this.endTrace(span, error);
      throw error;
    }
  }

  /**
   * Cache operation tracing
   */
  async traceCacheOperation(operation, key, callback) {
    const span = this.startChildSpan(this.getActiveSpan(), `cache.${operation}`, {
      'cache.operation': operation,
      'cache.key': key,
      'span.kind': 'client'
    });

    const startTime = Date.now();

    try {
      const result = await callback();

      this.addTags(span, {
        'cache.hit': result !== null && result !== undefined,
        'cache.duration': Date.now() - startTime
      });

      this.endTrace(span);
      return result;

    } catch (error) {
      this.addEvent(span, 'cache.error', {
        'error.message': error.message
      });

      this.endTrace(span, error);
      throw error;
    }
  }

  /**
   * Business logic tracing
   */
  traceBusinessOperation(operation, data = {}) {
    return (target, propertyKey, descriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function(...args) {
        const span = this.tracer?.startChildSpan(
          this.tracer?.getActiveSpan(),
          `business.${operation}`,
          {
            'business.operation': operation,
            'span.kind': 'internal',
            ...data
          }
        );

        try {
          const result = await originalMethod.apply(this, args);
          this.tracer?.endTrace(span);
          return result;
        } catch (error) {
          this.tracer?.addEvent(span, 'business.error', {
            'error.message': error.message
          });
          this.tracer?.endTrace(span, error);
          throw error;
        }
      };

      return descriptor;
    };
  }

  /**
   * Authentication tracing
   */
  async traceAuthentication(operation, callback) {
    const span = this.startChildSpan(this.getActiveSpan(), `auth.${operation}`, {
      'auth.operation': operation,
      'span.kind': 'internal'
    });

    try {
      const result = await callback();

      this.addTags(span, {
        'auth.success': result.success || true,
        'auth.user_id': result.user?.id
      });

      this.endTrace(span);
      return result;

    } catch (error) {
      this.addEvent(span, 'auth.error', {
        'error.message': error.message,
        'error.type': error.constructor.name
      });

      this.endTrace(span, error);
      throw error;
    }
  }

  /**
   * Performance profiling with tracing
   */
  startPerformanceProfile(operation) {
    const profileId = this.monitoring.startProfiling(null, operation);
    const span = this.startTrace(`profile.${operation}`, {
      tags: {
        'profile.id': profileId,
        'span.kind': 'internal'
      }
    });

    return {
      profileId,
      span,
      addSample: (sample) => {
        this.monitoring.addProfileSample(profileId, sample);
        this.addEvent(span, 'profile.sample', sample);
      },
      end: () => {
        this.monitoring.endProfiling(profileId);
        this.endTrace(span);
      }
    };
  }

  /**
   * Get trace context for propagation
   */
  getTraceContext(span = null) {
    const activeSpan = span || this.getActiveSpan();

    if (!activeSpan) return {};

    return {
      traceId: activeSpan.traceId,
      spanId: activeSpan.id,
      parentSpanId: activeSpan.parentId
    };
  }

  /**
   * Inject trace context into headers
   */
  injectTraceContext(headers = {}) {
    const context = this.getTraceContext();

    if (context.traceId) {
      headers['x-trace-id'] = context.traceId;
    }
    if (context.spanId) {
      headers['x-span-id'] = context.spanId;
    }
    if (context.parentSpanId) {
      headers['x-parent-span-id'] = context.parentSpanId;
    }

    return headers;
  }

  /**
   * Extract trace context from headers
   */
  extractTraceContext(headers = {}) {
    return {
      traceId: headers['x-trace-id'],
      spanId: headers['x-span-id'],
      parentSpanId: headers['x-parent-span-id']
    };
  }

  /**
   * Get traces with filtering
   */
  getTraces(options = {}) {
    const {
      operation,
      minDuration,
      maxDuration,
      errorOnly,
      limit = 100
    } = options;

    let traces = this.monitoring.getTraces(limit * 2); // Get more to filter

    // Apply filters
    if (operation) {
      traces = traces.filter(t => t.operation === operation);
    }

    if (minDuration) {
      traces = traces.filter(t => t.duration >= minDuration);
    }

    if (maxDuration) {
      traces = traces.filter(t => t.duration <= maxDuration);
    }

    if (errorOnly) {
      traces = traces.filter(t => t.error);
    }

    return traces.slice(0, limit);
  }

  /**
   * Export traces in Jaeger format
   */
  exportJaegerTraces() {
    const traces = this.monitoring.getTraces();

    // Convert to Jaeger format
    const jaegerTraces = traces.map(span => ({
      traceID: span.traceId,
      spans: [{
        traceID: span.traceId,
        spanID: span.id,
        operationName: span.operation,
        startTime: span.startTime * 1000, // Convert to microseconds
        duration: span.duration * 1000,
        tags: Array.from(span.tags.entries()).map(([key, value]) => ({
          key,
          value: String(value),
          type: typeof value === 'number' ? 'int64' : 'string'
        })),
        logs: span.events.map(event => ({
          timestamp: event.timestamp * 1000,
          fields: Object.entries(event.attributes).map(([key, value]) => ({
            key,
            value: String(value),
            type: typeof value === 'number' ? 'int64' : 'string'
          }))
        }))
      }]
    }));

    return jaegerTraces;
  }

  /**
   * Get tracing statistics
   */
  getStats() {
    const traces = this.monitoring.getTraces(1000);

    const stats = {
      totalTraces: traces.length,
      activeSpans: this.activeSpans.size,
      operations: {},
      avgDuration: 0,
      errorRate: 0,
      p95Duration: 0
    };

    if (traces.length > 0) {
      // Count operations
      traces.forEach(span => {
        stats.operations[span.operation] = (stats.operations[span.operation] || 0) + 1;
      });

      // Calculate durations
      const durations = traces.map(t => t.duration).sort((a, b) => a - b);
      stats.avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      stats.p95Duration = durations[Math.floor(durations.length * 0.95)] || 0;

      // Calculate error rate
      const errors = traces.filter(t => t.error).length;
      stats.errorRate = errors / traces.length;
    }

    return stats;
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.activeSpans.clear();
  }
}

module.exports = Tracer;
