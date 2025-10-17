/**
 * Request Tracer
 * High-performance distributed tracing for request tracking
 * Priority: H004 from improvement backlog
 *
 * @module utils/request-tracer
 */

const crypto = require('crypto');
const { performance } = require('perf_hooks');

class RequestTracer {
  constructor(options = {}) {
    this.options = {
      serviceName: options.serviceName || 'qui-browser',
      enableSampling: options.enableSampling !== false,
      samplingRate: options.samplingRate || 1.0, // 100% by default
      maxSpansPerTrace: options.maxSpansPerTrace || 1000,
      storageLimit: options.storageLimit || 10000,
      enableMetrics: options.enableMetrics !== false,
      ...options
    };

    this.traces = new Map();
    this.metrics = {
      totalTraces: 0,
      totalSpans: 0,
      sampledTraces: 0,
      droppedTraces: 0
    };

    // Periodic cleanup
    this.startCleanup();
  }

  /**
   * Generate unique trace ID
   * @returns {string} 128-bit trace ID
   */
  generateTraceId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate unique span ID
   * @returns {string} 64-bit span ID
   */
  generateSpanId() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Start a new trace
   * @param {Object} options - Trace options
   * @returns {Object} Trace context
   */
  startTrace(options = {}) {
    const {
      name = 'http.request',
      attributes = {},
      parentTraceId = null,
      parentSpanId = null
    } = options;

    // Sampling decision
    if (this.options.enableSampling) {
      const shouldSample = Math.random() < this.options.samplingRate;
      if (!shouldSample) {
        this.metrics.droppedTraces++;
        return this.createNoOpTrace();
      }
    }

    const traceId = parentTraceId || this.generateTraceId();
    const spanId = this.generateSpanId();

    const trace = {
      traceId,
      spanId,
      parentSpanId,
      name,
      startTime: performance.now(),
      startTimestamp: Date.now(),
      attributes: {
        'service.name': this.options.serviceName,
        ...attributes
      },
      events: [],
      status: 'ok',
      sampled: true
    };

    // Storage limit check
    if (this.traces.size >= this.options.storageLimit) {
      // Remove oldest trace
      const firstKey = this.traces.keys().next().value;
      this.traces.delete(firstKey);
      this.metrics.droppedTraces++;
    }

    this.traces.set(traceId, trace);
    this.metrics.totalTraces++;
    this.metrics.sampledTraces++;

    return {
      traceId,
      spanId,
      addEvent: (name, attrs) => this.addEvent(traceId, name, attrs),
      addAttribute: (key, value) => this.addAttribute(traceId, key, value),
      setStatus: (status, message) => this.setStatus(traceId, status, message),
      end: () => this.endTrace(traceId),
      createSpan: (name, attrs) => this.createSpan(traceId, spanId, name, attrs)
    };
  }

  /**
   * Create no-op trace for dropped samples
   * @returns {Object} No-op trace context
   */
  createNoOpTrace() {
    return {
      traceId: 'noop',
      spanId: 'noop',
      sampled: false,
      addEvent: () => {},
      addAttribute: () => {},
      setStatus: () => {},
      end: () => {},
      createSpan: () => this.createNoOpTrace()
    };
  }

  /**
   * Create child span
   * @param {string} traceId - Parent trace ID
   * @param {string} parentSpanId - Parent span ID
   * @param {string} name - Span name
   * @param {Object} attributes - Span attributes
   * @returns {Object} Span context
   */
  createSpan(traceId, parentSpanId, name, attributes = {}) {
    const trace = this.traces.get(traceId);
    if (!trace) {
      return this.createNoOpTrace();
    }

    // Check span limit
    if (!trace.spans) {
      trace.spans = [];
    }

    if (trace.spans.length >= this.options.maxSpansPerTrace) {
      console.warn(`[RequestTracer] Max spans reached for trace ${traceId}`);
      return this.createNoOpTrace();
    }

    const spanId = this.generateSpanId();

    const span = {
      spanId,
      parentSpanId,
      name,
      startTime: performance.now(),
      startTimestamp: Date.now(),
      attributes: {
        ...attributes
      },
      events: [],
      status: 'ok'
    };

    trace.spans.push(span);
    this.metrics.totalSpans++;

    return {
      traceId,
      spanId,
      addEvent: (name, attrs) => this.addSpanEvent(traceId, spanId, name, attrs),
      addAttribute: (key, value) => this.addSpanAttribute(traceId, spanId, key, value),
      setStatus: (status, message) => this.setSpanStatus(traceId, spanId, status, message),
      end: () => this.endSpan(traceId, spanId),
      createSpan: (name, attrs) => this.createSpan(traceId, spanId, name, attrs)
    };
  }

  /**
   * Add event to trace
   * @param {string} traceId - Trace ID
   * @param {string} name - Event name
   * @param {Object} attributes - Event attributes
   */
  addEvent(traceId, name, attributes = {}) {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.events.push({
      name,
      timestamp: Date.now(),
      attributes
    });
  }

  /**
   * Add event to span
   * @param {string} traceId - Trace ID
   * @param {string} spanId - Span ID
   * @param {string} name - Event name
   * @param {Object} attributes - Event attributes
   */
  addSpanEvent(traceId, spanId, name, attributes = {}) {
    const trace = this.traces.get(traceId);
    if (!trace || !trace.spans) return;

    const span = trace.spans.find(s => s.spanId === spanId);
    if (!span) return;

    span.events.push({
      name,
      timestamp: Date.now(),
      attributes
    });
  }

  /**
   * Add attribute to trace
   * @param {string} traceId - Trace ID
   * @param {string} key - Attribute key
   * @param {*} value - Attribute value
   */
  addAttribute(traceId, key, value) {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.attributes[key] = value;
  }

  /**
   * Add attribute to span
   * @param {string} traceId - Trace ID
   * @param {string} spanId - Span ID
   * @param {string} key - Attribute key
   * @param {*} value - Attribute value
   */
  addSpanAttribute(traceId, spanId, key, value) {
    const trace = this.traces.get(traceId);
    if (!trace || !trace.spans) return;

    const span = trace.spans.find(s => s.spanId === spanId);
    if (!span) return;

    span.attributes[key] = value;
  }

  /**
   * Set trace status
   * @param {string} traceId - Trace ID
   * @param {string} status - Status (ok, error)
   * @param {string} message - Status message
   */
  setStatus(traceId, status, message = '') {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.status = status;
    if (message) {
      trace.statusMessage = message;
    }
  }

  /**
   * Set span status
   * @param {string} traceId - Trace ID
   * @param {string} spanId - Span ID
   * @param {string} status - Status (ok, error)
   * @param {string} message - Status message
   */
  setSpanStatus(traceId, spanId, status, message = '') {
    const trace = this.traces.get(traceId);
    if (!trace || !trace.spans) return;

    const span = trace.spans.find(s => s.spanId === spanId);
    if (!span) return;

    span.status = status;
    if (message) {
      span.statusMessage = message;
    }
  }

  /**
   * End trace
   * @param {string} traceId - Trace ID
   * @returns {Object} Completed trace
   */
  endTrace(traceId) {
    const trace = this.traces.get(traceId);
    if (!trace) return null;

    trace.endTime = performance.now();
    trace.endTimestamp = Date.now();
    trace.duration = trace.endTime - trace.startTime;

    // Export trace (implement your exporter)
    if (this.options.onTraceComplete) {
      this.options.onTraceComplete(trace);
    }

    return trace;
  }

  /**
   * End span
   * @param {string} traceId - Trace ID
   * @param {string} spanId - Span ID
   * @returns {Object} Completed span
   */
  endSpan(traceId, spanId) {
    const trace = this.traces.get(traceId);
    if (!trace || !trace.spans) return null;

    const span = trace.spans.find(s => s.spanId === spanId);
    if (!span) return null;

    span.endTime = performance.now();
    span.endTimestamp = Date.now();
    span.duration = span.endTime - span.startTime;

    return span;
  }

  /**
   * Get trace by ID
   * @param {string} traceId - Trace ID
   * @returns {Object|null} Trace object
   */
  getTrace(traceId) {
    return this.traces.get(traceId) || null;
  }

  /**
   * Get all traces
   * @returns {Array} Array of traces
   */
  getAllTraces() {
    return Array.from(this.traces.values());
  }

  /**
   * Get traces by status
   * @param {string} status - Status filter
   * @returns {Array} Filtered traces
   */
  getTracesByStatus(status) {
    return this.getAllTraces().filter(trace => trace.status === status);
  }

  /**
   * Get slow traces (above threshold)
   * @param {number} thresholdMs - Duration threshold in ms
   * @returns {Array} Slow traces
   */
  getSlowTraces(thresholdMs = 1000) {
    return this.getAllTraces().filter(trace =>
      trace.duration && trace.duration > thresholdMs
    );
  }

  /**
   * Get metrics
   * @returns {Object} Tracer metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeTraces: this.traces.size,
      averageSpansPerTrace: this.metrics.totalTraces > 0
        ? (this.metrics.totalSpans / this.metrics.totalTraces).toFixed(2)
        : 0,
      samplingRate: this.options.samplingRate,
      droppedRate: this.metrics.totalTraces > 0
        ? ((this.metrics.droppedTraces / (this.metrics.totalTraces + this.metrics.droppedTraces)) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Clear all traces
   */
  clear() {
    this.traces.clear();
    this.metrics = {
      totalTraces: 0,
      totalSpans: 0,
      sampledTraces: 0,
      droppedTraces: 0
    };
  }

  /**
   * Start periodic cleanup of old traces
   */
  startCleanup() {
    // Clean up traces older than 1 hour
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = 60 * 60 * 1000; // 1 hour

      for (const [traceId, trace] of this.traces.entries()) {
        if (trace.endTimestamp && (now - trace.endTimestamp) > maxAge) {
          this.traces.delete(traceId);
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Export traces in Jaeger format
   * @returns {Object} Jaeger-compatible format
   */
  exportJaeger() {
    const traces = this.getAllTraces();

    return {
      data: traces.map(trace => ({
        traceID: trace.traceId,
        spans: [
          {
            traceID: trace.traceId,
            spanID: trace.spanId,
            operationName: trace.name,
            startTime: trace.startTimestamp * 1000, // microseconds
            duration: (trace.duration || 0) * 1000, // microseconds
            tags: Object.entries(trace.attributes).map(([key, value]) => ({
              key,
              type: typeof value,
              value
            })),
            logs: trace.events.map(event => ({
              timestamp: event.timestamp * 1000,
              fields: [
                { key: 'event', type: 'string', value: event.name },
                ...Object.entries(event.attributes).map(([key, value]) => ({
                  key,
                  type: typeof value,
                  value
                }))
              ]
            }))
          },
          ...(trace.spans || []).map(span => ({
            traceID: trace.traceId,
            spanID: span.spanId,
            parentSpanID: span.parentSpanId,
            operationName: span.name,
            startTime: span.startTimestamp * 1000,
            duration: (span.duration || 0) * 1000,
            tags: Object.entries(span.attributes).map(([key, value]) => ({
              key,
              type: typeof value,
              value
            })),
            logs: span.events.map(event => ({
              timestamp: event.timestamp * 1000,
              fields: [
                { key: 'event', type: 'string', value: event.name },
                ...Object.entries(event.attributes).map(([key, value]) => ({
                  key,
                  type: typeof value,
                  value
                }))
              ]
            }))
          }))
        ]
      }))
    };
  }

  /**
   * Create Express middleware for automatic request tracing
   * @returns {Function} Express middleware
   */
  middleware() {
    return (req, res, next) => {
      const trace = this.startTrace({
        name: 'http.request',
        attributes: {
          'http.method': req.method,
          'http.url': req.url,
          'http.target': req.path,
          'http.host': req.hostname,
          'http.scheme': req.protocol,
          'http.user_agent': req.get('user-agent'),
          'http.client_ip': req.ip
        }
      });

      // Attach trace context to request
      req.trace = trace;

      // Measure response time
      const startTime = performance.now();

      // Hook into response finish
      res.on('finish', () => {
        const duration = performance.now() - startTime;

        trace.addAttribute('http.status_code', res.statusCode);
        trace.addAttribute('http.response_time_ms', duration.toFixed(2));

        if (res.statusCode >= 400) {
          trace.setStatus('error', `HTTP ${res.statusCode}`);
        }

        trace.end();
      });

      next();
    };
  }
}

module.exports = RequestTracer;
