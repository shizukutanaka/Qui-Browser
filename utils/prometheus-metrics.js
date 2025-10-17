/**
 * Prometheus Metrics Integration
 *
 * Implements comprehensive metrics collection (Improvement #348)
 * - HTTP request metrics
 * - System metrics (CPU, memory, event loop)
 * - Custom business metrics
 * - Histogram buckets for latency
 */

/**
 * Metric types
 */
const MetricType = {
  COUNTER: 'counter',
  GAUGE: 'gauge',
  HISTOGRAM: 'histogram',
  SUMMARY: 'summary'
};

/**
 * Default histogram buckets (in seconds)
 */
const DEFAULT_BUCKETS = [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10];

/**
 * Metric class
 */
class Metric {
  constructor(name, type, help, labels = []) {
    this.name = name;
    this.type = type;
    this.help = help;
    this.labels = labels;
    this.values = new Map();
  }

  /**
   * Get label key
   */
  getLabelKey(labelValues = {}) {
    if (this.labels.length === 0) {
      return '_default';
    }

    const keys = this.labels.map((label) => labelValues[label] || '').join(',');
    return keys;
  }

  /**
   * Initialize value
   */
  initValue(labelValues = {}) {
    const key = this.getLabelKey(labelValues);
    if (!this.values.has(key)) {
      if (this.type === MetricType.HISTOGRAM) {
        this.values.set(key, {
          count: 0,
          sum: 0,
          buckets: new Map(DEFAULT_BUCKETS.map((b) => [b, 0]))
        });
      } else {
        this.values.set(key, 0);
      }
    }
    return key;
  }

  /**
   * Format for Prometheus
   */
  format() {
    const lines = [];

    // Add HELP and TYPE
    lines.push(`# HELP ${this.name} ${this.help}`);
    lines.push(`# TYPE ${this.name} ${this.type}`);

    // Add values
    for (const [labelKey, value] of this.values.entries()) {
      const labelStr = this.formatLabels(labelKey);

      if (this.type === MetricType.HISTOGRAM) {
        // Histogram buckets
        for (const [bucket, count] of value.buckets.entries()) {
          lines.push(`${this.name}_bucket{${labelStr}le="${bucket}"} ${count}`);
        }
        lines.push(`${this.name}_bucket{${labelStr}le="+Inf"} ${value.count}`);
        lines.push(`${this.name}_sum${labelStr ? `{${labelStr}}` : ''} ${value.sum}`);
        lines.push(`${this.name}_count${labelStr ? `{${labelStr}}` : ''} ${value.count}`);
      } else {
        lines.push(`${this.name}${labelStr ? `{${labelStr}}` : ''} ${value}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format labels
   */
  formatLabels(labelKey) {
    if (labelKey === '_default') {
      return '';
    }

    const values = labelKey.split(',');
    const pairs = this.labels.map((label, i) => `${label}="${values[i]}"`);
    return pairs.join(',');
  }
}

/**
 * Counter metric
 */
class Counter extends Metric {
  constructor(name, help, labels = []) {
    super(name, MetricType.COUNTER, help, labels);
  }

  inc(labelValues = {}, value = 1) {
    const key = this.initValue(labelValues);
    this.values.set(key, this.values.get(key) + value);
  }
}

/**
 * Gauge metric
 */
class Gauge extends Metric {
  constructor(name, help, labels = []) {
    super(name, MetricType.GAUGE, help, labels);
  }

  set(labelValues = {}, value) {
    const key = this.initValue(labelValues);
    this.values.set(key, value);
  }

  inc(labelValues = {}, value = 1) {
    const key = this.initValue(labelValues);
    this.values.set(key, this.values.get(key) + value);
  }

  dec(labelValues = {}, value = 1) {
    const key = this.initValue(labelValues);
    this.values.set(key, this.values.get(key) - value);
  }
}

/**
 * Histogram metric
 */
class Histogram extends Metric {
  constructor(name, help, labels = [], buckets = DEFAULT_BUCKETS) {
    super(name, MetricType.HISTOGRAM, help, labels);
    this.buckets = buckets.sort((a, b) => a - b);
  }

  observe(labelValues = {}, value) {
    const key = this.initValue(labelValues);
    const histogram = this.values.get(key);

    histogram.count++;
    histogram.sum += value;

    // Update buckets
    for (const bucket of this.buckets) {
      if (value <= bucket) {
        histogram.buckets.set(bucket, histogram.buckets.get(bucket) + 1);
      }
    }
  }

  /**
   * Start timer
   */
  startTimer(labelValues = {}) {
    const start = Date.now();
    return () => {
      const duration = (Date.now() - start) / 1000; // Convert to seconds
      this.observe(labelValues, duration);
    };
  }
}

/**
 * Prometheus Metrics Manager
 */
class PrometheusMetrics {
  constructor() {
    this.metrics = new Map();
    this.startTime = Date.now();

    // Initialize default metrics
    this.initializeDefaultMetrics();
  }

  /**
   * Initialize default metrics
   */
  initializeDefaultMetrics() {
    // HTTP metrics
    this.httpRequestsTotal = this.counter(
      'http_requests_total',
      'Total HTTP requests',
      ['method', 'route', 'status_code']
    );

    this.httpRequestDuration = this.histogram(
      'http_request_duration_seconds',
      'HTTP request duration in seconds',
      ['method', 'route', 'status_code']
    );

    this.httpRequestSize = this.histogram(
      'http_request_size_bytes',
      'HTTP request size in bytes',
      ['method', 'route'],
      [100, 1000, 10000, 100000, 1000000]
    );

    this.httpResponseSize = this.histogram(
      'http_response_size_bytes',
      'HTTP response size in bytes',
      ['method', 'route'],
      [100, 1000, 10000, 100000, 1000000]
    );

    // System metrics
    this.processUptime = this.gauge('process_uptime_seconds', 'Process uptime in seconds');

    this.processCpuUsage = this.gauge('process_cpu_usage_percent', 'Process CPU usage percentage');

    this.processMemoryUsage = this.gauge(
      'process_memory_usage_bytes',
      'Process memory usage in bytes',
      ['type']
    );

    this.eventLoopLag = this.gauge('event_loop_lag_seconds', 'Event loop lag in seconds');

    // Cache metrics
    this.cacheHits = this.counter('cache_hits_total', 'Total cache hits', ['cache_name']);

    this.cacheMisses = this.counter('cache_misses_total', 'Total cache misses', ['cache_name']);

    this.cacheSize = this.gauge('cache_size', 'Current cache size', ['cache_name']);

    // Database metrics
    this.dbConnectionsActive = this.gauge('db_connections_active', 'Active database connections', ['pool']);

    this.dbConnectionsIdle = this.gauge('db_connections_idle', 'Idle database connections', ['pool']);

    this.dbQueryDuration = this.histogram(
      'db_query_duration_seconds',
      'Database query duration in seconds',
      ['operation']
    );

    // Custom metrics
    this.activeUsers = this.gauge('active_users', 'Number of active users');

    this.activeSessions = this.gauge('active_sessions', 'Number of active sessions');
  }

  /**
   * Create counter
   */
  counter(name, help, labels = []) {
    const metric = new Counter(name, help, labels);
    this.metrics.set(name, metric);
    return metric;
  }

  /**
   * Create gauge
   */
  gauge(name, help, labels = []) {
    const metric = new Gauge(name, help, labels);
    this.metrics.set(name, metric);
    return metric;
  }

  /**
   * Create histogram
   */
  histogram(name, help, labels = [], buckets = DEFAULT_BUCKETS) {
    const metric = new Histogram(name, help, labels, buckets);
    this.metrics.set(name, metric);
    return metric;
  }

  /**
   * Update system metrics
   */
  updateSystemMetrics() {
    const memUsage = process.memoryUsage();

    this.processUptime.set({}, (Date.now() - this.startTime) / 1000);
    this.processCpuUsage.set({}, process.cpuUsage().user / 1000000);
    this.processMemoryUsage.set({ type: 'rss' }, memUsage.rss);
    this.processMemoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
    this.processMemoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
    this.processMemoryUsage.set({ type: 'external' }, memUsage.external);

    // Measure event loop lag
    const start = Date.now();
    setImmediate(() => {
      const lag = (Date.now() - start) / 1000;
      this.eventLoopLag.set({}, lag);
    });
  }

  /**
   * Get metrics in Prometheus format
   */
  getMetrics() {
    this.updateSystemMetrics();

    const lines = [];
    for (const metric of this.metrics.values()) {
      lines.push(metric.format());
    }

    return lines.join('\n\n');
  }

  /**
   * Create middleware for HTTP metrics
   */
  createMiddleware() {
    return (req, res, next) => {
      const start = Date.now();

      // Record request size
      const requestSize = parseInt(req.headers['content-length'] || '0', 10);
      const route = this.normalizeRoute(req.url);

      if (requestSize > 0) {
        this.httpRequestSize.observe({ method: req.method, route }, requestSize);
      }

      // Hook into response
      const originalEnd = res.end;
      res.end = (...args) => {
        res.end = originalEnd;
        res.end.apply(res, args);

        // Record metrics
        const duration = (Date.now() - start) / 1000;
        const labels = {
          method: req.method,
          route,
          status_code: String(res.statusCode)
        };

        this.httpRequestsTotal.inc(labels);
        this.httpRequestDuration.observe(labels, duration);

        // Record response size
        const responseSize = parseInt(res.getHeader('content-length') || '0', 10);
        if (responseSize > 0) {
          this.httpResponseSize.observe({ method: req.method, route }, responseSize);
        }
      };

      next();
    };
  }

  /**
   * Normalize route for metrics
   */
  normalizeRoute(url) {
    // Remove query string
    const path = url.split('?')[0];

    // Replace IDs with placeholder
    return path.replace(/\/\d+/g, '/:id').replace(/\/[a-f0-9-]{36}/g, '/:uuid');
  }

  /**
   * Create metrics endpoint handler
   */
  createHandler() {
    return (req, res) => {
      res.setHeader('Content-Type', 'text/plain; version=0.0.4');
      res.end(this.getMetrics());
    };
  }
}

/**
 * Create global metrics instance
 */
let globalMetrics = null;

function getMetrics() {
  if (!globalMetrics) {
    globalMetrics = new PrometheusMetrics();
  }
  return globalMetrics;
}

module.exports = {
  PrometheusMetrics,
  Counter,
  Gauge,
  Histogram,
  MetricType,
  getMetrics,
  DEFAULT_BUCKETS
};
