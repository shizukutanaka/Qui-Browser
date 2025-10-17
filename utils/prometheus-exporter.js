/**
 * Prometheus Metrics Exporter
 * Production-ready Prometheus metrics collection and export
 *
 * Based on 2025 best practices:
 * - Standard Prometheus text format
 * - Four metric types: Counter, Gauge, Histogram, Summary
 * - Label support for dimensional metrics
 * - Efficient in-memory aggregation
 * - /metrics endpoint compatible
 *
 * @module utils/prometheus-exporter
 */

const { EventEmitter } = require('events');

class PrometheusExporter extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      prefix: options.prefix || 'qui_browser_',
      enableDefaultMetrics: options.enableDefaultMetrics !== false,
      collectInterval: options.collectInterval || 10000, // 10 seconds
      ...options
    };

    // Metrics storage
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.summaries = new Map();

    // Collection timer
    this.collectTimer = null;

    this.init();
  }

  /**
   * Initialize exporter
   */
  init() {
    // Register default metrics
    if (this.options.enableDefaultMetrics) {
      this.registerDefaultMetrics();
    }

    // Start collection
    this.startCollection();

    console.log('[Prometheus] Exporter initialized');
  }

  /**
   * Register default Node.js metrics
   */
  registerDefaultMetrics() {
    // Process metrics
    this.registerGauge('process_cpu_user_seconds_total', 'Total user CPU time', ['pid']);
    this.registerGauge('process_cpu_system_seconds_total', 'Total system CPU time', ['pid']);
    this.registerGauge('process_resident_memory_bytes', 'Resident memory size', ['pid']);
    this.registerGauge('process_heap_bytes', 'Process heap size', ['pid']);
    this.registerGauge('nodejs_heap_size_total_bytes', 'Total heap size');
    this.registerGauge('nodejs_heap_size_used_bytes', 'Used heap size');
    this.registerGauge('nodejs_external_memory_bytes', 'External memory');
    this.registerGauge('nodejs_heap_space_size_total_bytes', 'Heap space total', ['space']);
    this.registerGauge('nodejs_heap_space_size_used_bytes', 'Heap space used', ['space']);

    // Event loop metrics
    this.registerGauge('nodejs_eventloop_lag_seconds', 'Event loop lag');
    this.registerCounter('nodejs_eventloop_lag_min_seconds', 'Event loop lag min');
    this.registerCounter('nodejs_eventloop_lag_max_seconds', 'Event loop lag max');

    // GC metrics
    this.registerCounter('nodejs_gc_duration_seconds', 'GC duration', ['kind']);
    this.registerCounter('nodejs_gc_runs_total', 'Total GC runs', ['kind']);

    // HTTP metrics
    this.registerCounter('http_requests_total', 'Total HTTP requests', ['method', 'path', 'status']);
    this.registerHistogram('http_request_duration_seconds', 'HTTP request duration', ['method', 'path'], [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]);
    this.registerGauge('http_requests_in_flight', 'HTTP requests currently in flight');
  }

  /**
   * Register counter metric
   * @param {string} name - Metric name
   * @param {string} help - Help text
   * @param {Array} labels - Label names
   */
  registerCounter(name, help, labels = []) {
    const fullName = this.options.prefix + name;

    if (!this.counters.has(fullName)) {
      this.counters.set(fullName, {
        name: fullName,
        help,
        type: 'counter',
        labels,
        values: new Map()
      });
    }

    return fullName;
  }

  /**
   * Register gauge metric
   * @param {string} name - Metric name
   * @param {string} help - Help text
   * @param {Array} labels - Label names
   */
  registerGauge(name, help, labels = []) {
    const fullName = this.options.prefix + name;

    if (!this.gauges.has(fullName)) {
      this.gauges.set(fullName, {
        name: fullName,
        help,
        type: 'gauge',
        labels,
        values: new Map()
      });
    }

    return fullName;
  }

  /**
   * Register histogram metric
   * @param {string} name - Metric name
   * @param {string} help - Help text
   * @param {Array} labels - Label names
   * @param {Array} buckets - Bucket boundaries
   */
  registerHistogram(name, help, labels = [], buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]) {
    const fullName = this.options.prefix + name;

    if (!this.histograms.has(fullName)) {
      this.histograms.set(fullName, {
        name: fullName,
        help,
        type: 'histogram',
        labels,
        buckets,
        values: new Map()
      });
    }

    return fullName;
  }

  /**
   * Register summary metric
   * @param {string} name - Metric name
   * @param {string} help - Help text
   * @param {Array} labels - Label names
   */
  registerSummary(name, help, labels = []) {
    const fullName = this.options.prefix + name;

    if (!this.summaries.has(fullName)) {
      this.summaries.set(fullName, {
        name: fullName,
        help,
        type: 'summary',
        labels,
        values: new Map()
      });
    }

    return fullName;
  }

  /**
   * Increment counter
   * @param {string} name - Metric name
   * @param {number} value - Increment value
   * @param {Object} labels - Label values
   */
  incCounter(name, value = 1, labels = {}) {
    const fullName = this.options.prefix + name;
    const counter = this.counters.get(fullName);

    if (!counter) {
      console.warn(`[Prometheus] Counter not registered: ${name}`);
      return;
    }

    const labelKey = this.getLabelKey(labels);
    const current = counter.values.get(labelKey) || 0;
    counter.values.set(labelKey, current + value);
  }

  /**
   * Set gauge value
   * @param {string} name - Metric name
   * @param {number} value - Gauge value
   * @param {Object} labels - Label values
   */
  setGauge(name, value, labels = {}) {
    const fullName = this.options.prefix + name;
    const gauge = this.gauges.get(fullName);

    if (!gauge) {
      console.warn(`[Prometheus] Gauge not registered: ${name}`);
      return;
    }

    const labelKey = this.getLabelKey(labels);
    gauge.values.set(labelKey, value);
  }

  /**
   * Observe histogram value
   * @param {string} name - Metric name
   * @param {number} value - Observed value
   * @param {Object} labels - Label values
   */
  observeHistogram(name, value, labels = {}) {
    const fullName = this.options.prefix + name;
    const histogram = this.histograms.get(fullName);

    if (!histogram) {
      console.warn(`[Prometheus] Histogram not registered: ${name}`);
      return;
    }

    const labelKey = this.getLabelKey(labels);

    if (!histogram.values.has(labelKey)) {
      histogram.values.set(labelKey, {
        sum: 0,
        count: 0,
        buckets: histogram.buckets.map(b => ({ le: b, count: 0 }))
      });
    }

    const data = histogram.values.get(labelKey);
    data.sum += value;
    data.count++;

    // Update bucket counts
    for (const bucket of data.buckets) {
      if (value <= bucket.le) {
        bucket.count++;
      }
    }
  }

  /**
   * Observe summary value
   * @param {string} name - Metric name
   * @param {number} value - Observed value
   * @param {Object} labels - Label values
   */
  observeSummary(name, value, labels = {}) {
    const fullName = this.options.prefix + name;
    const summary = this.summaries.get(fullName);

    if (!summary) {
      console.warn(`[Prometheus] Summary not registered: ${name}`);
      return;
    }

    const labelKey = this.getLabelKey(labels);

    if (!summary.values.has(labelKey)) {
      summary.values.set(labelKey, {
        sum: 0,
        count: 0,
        values: []
      });
    }

    const data = summary.values.get(labelKey);
    data.sum += value;
    data.count++;
    data.values.push(value);

    // Keep only last 1000 values for quantile calculation
    if (data.values.length > 1000) {
      data.values.shift();
    }
  }

  /**
   * Get label key from labels object
   * @param {Object} labels - Labels
   * @returns {string} Label key
   */
  getLabelKey(labels) {
    if (Object.keys(labels).length === 0) return '';

    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }

  /**
   * Start default metrics collection
   */
  startCollection() {
    if (this.collectTimer) return;

    this.collectTimer = setInterval(() => {
      this.collectDefaultMetrics();
    }, this.options.collectInterval);

    // Initial collection
    this.collectDefaultMetrics();
  }

  /**
   * Collect default Node.js metrics
   */
  collectDefaultMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Memory metrics
    this.setGauge('process_resident_memory_bytes', memUsage.rss, { pid: process.pid.toString() });
    this.setGauge('process_heap_bytes', memUsage.heapTotal, { pid: process.pid.toString() });
    this.setGauge('nodejs_heap_size_total_bytes', memUsage.heapTotal);
    this.setGauge('nodejs_heap_size_used_bytes', memUsage.heapUsed);
    this.setGauge('nodejs_external_memory_bytes', memUsage.external);

    // CPU metrics (convert to seconds)
    this.setGauge('process_cpu_user_seconds_total', cpuUsage.user / 1000000, { pid: process.pid.toString() });
    this.setGauge('process_cpu_system_seconds_total', cpuUsage.system / 1000000, { pid: process.pid.toString() });

    // Event loop lag (simplified)
    const start = Date.now();
    setImmediate(() => {
      const lag = (Date.now() - start) / 1000;
      this.setGauge('nodejs_eventloop_lag_seconds', lag);
    });
  }

  /**
   * Export metrics in Prometheus text format
   * @returns {string} Prometheus metrics
   */
  exportMetrics() {
    let output = [];

    // Export counters
    for (const [name, metric] of this.counters.entries()) {
      output.push(`# HELP ${name} ${metric.help}`);
      output.push(`# TYPE ${name} counter`);

      for (const [labelKey, value] of metric.values.entries()) {
        const labels = labelKey ? `{${labelKey}}` : '';
        output.push(`${name}${labels} ${value}`);
      }
    }

    // Export gauges
    for (const [name, metric] of this.gauges.entries()) {
      output.push(`# HELP ${name} ${metric.help}`);
      output.push(`# TYPE ${name} gauge`);

      for (const [labelKey, value] of metric.values.entries()) {
        const labels = labelKey ? `{${labelKey}}` : '';
        output.push(`${name}${labels} ${value}`);
      }
    }

    // Export histograms
    for (const [name, metric] of this.histograms.entries()) {
      output.push(`# HELP ${name} ${metric.help}`);
      output.push(`# TYPE ${name} histogram`);

      for (const [labelKey, data] of metric.values.entries()) {
        const baseLabels = labelKey ? `${labelKey},` : '';

        // Bucket counts
        for (const bucket of data.buckets) {
          output.push(`${name}_bucket{${baseLabels}le="${bucket.le}"} ${bucket.count}`);
        }

        // +Inf bucket
        output.push(`${name}_bucket{${baseLabels}le="+Inf"} ${data.count}`);

        // Sum and count
        output.push(`${name}_sum{${labelKey ? labelKey : ''}} ${data.sum}`);
        output.push(`${name}_count{${labelKey ? labelKey : ''}} ${data.count}`);
      }
    }

    // Export summaries
    for (const [name, metric] of this.summaries.entries()) {
      output.push(`# HELP ${name} ${metric.help}`);
      output.push(`# TYPE ${name} summary`);

      for (const [labelKey, data] of metric.values.entries()) {
        const baseLabels = labelKey ? `${labelKey},` : '';

        // Quantiles
        const sorted = [...data.values].sort((a, b) => a - b);
        const quantiles = [0.5, 0.9, 0.95, 0.99];

        for (const q of quantiles) {
          const index = Math.floor(sorted.length * q);
          const value = sorted[index] || 0;
          output.push(`${name}{${baseLabels}quantile="${q}"} ${value}`);
        }

        // Sum and count
        output.push(`${name}_sum{${labelKey ? labelKey : ''}} ${data.sum}`);
        output.push(`${name}_count{${labelKey ? labelKey : ''}} ${data.count}`);
      }
    }

    return output.join('\n') + '\n';
  }

  /**
   * Get metrics statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      counters: this.counters.size,
      gauges: this.gauges.size,
      histograms: this.histograms.size,
      summaries: this.summaries.size,
      totalMetrics: this.counters.size + this.gauges.size + this.histograms.size + this.summaries.size
    };
  }

  /**
   * Reset all metrics
   */
  reset() {
    for (const counter of this.counters.values()) {
      counter.values.clear();
    }
    for (const gauge of this.gauges.values()) {
      gauge.values.clear();
    }
    for (const histogram of this.histograms.values()) {
      histogram.values.clear();
    }
    for (const summary of this.summaries.values()) {
      summary.values.clear();
    }
  }

  /**
   * Shutdown exporter
   */
  shutdown() {
    console.log('[Prometheus] Shutting down...');

    if (this.collectTimer) {
      clearInterval(this.collectTimer);
      this.collectTimer = null;
    }

    console.log('[Prometheus] Shutdown complete');
  }
}

/**
 * Create Express middleware for Prometheus metrics endpoint
 * @param {PrometheusExporter} exporter - Prometheus exporter instance
 * @returns {Function} Middleware
 */
function createMetricsMiddleware(exporter) {
  return (req, res) => {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(exporter.exportMetrics());
  };
}

module.exports = PrometheusExporter;
module.exports.createMiddleware = createMetricsMiddleware;
