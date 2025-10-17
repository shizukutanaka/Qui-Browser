/**
 * Advanced Monitoring and Observability
 * Provides comprehensive metrics, traces, and alerts
 * @module utils/advanced-monitoring
 */

const EventEmitter = require('events');

/**
 * @typedef {Object} MetricValue
 * @property {number} value - Metric value
 * @property {number} timestamp - When the metric was recorded
 * @property {Object} [labels] - Metric labels
 */

/**
 * @typedef {Object} Alert
 * @property {string} id - Alert ID
 * @property {string} name - Alert name
 * @property {string} severity - Alert severity (critical, warning, info)
 * @property {string} message - Alert message
 * @property {number} timestamp - When the alert was triggered
 * @property {Object} [metadata] - Additional metadata
 */

class AdvancedMonitoring extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      metricsRetention: options.metricsRetention || 3600000, // 1 hour
      alertThresholds: options.alertThresholds || {},
      enableTracing: options.enableTracing !== false,
      enableProfiling: options.enableProfiling !== false
    };

    // Metrics storage (circular buffer approach)
    this.metrics = {
      counters: new Map(),
      gauges: new Map(),
      histograms: new Map(),
      timeseries: new Map()
    };

    // Active alerts
    this.alerts = new Map();

    // Request traces
    this.traces = [];
    this.maxTraces = 1000;

    // Performance profiles
    this.profiles = {
      cpu: [],
      memory: [],
      eventLoop: []
    };

    // Default alert thresholds
    this.setupDefaultThresholds();

    // Start background monitoring
    this.startMonitoring();
  }

  /**
   * Setup default alert thresholds
   */
  setupDefaultThresholds() {
    this.setThreshold('error_rate', {
      warning: 0.01, // 1% error rate
      critical: 0.05 // 5% error rate
    });

    this.setThreshold('response_time_p95', {
      warning: 100, // 100ms
      critical: 500 // 500ms
    });

    this.setThreshold('memory_usage', {
      warning: 0.75, // 75% of heap
      critical: 0.9 // 90% of heap
    });

    this.setThreshold('cpu_usage', {
      warning: 0.7, // 70%
      critical: 0.9 // 90%
    });

    this.setThreshold('event_loop_delay', {
      warning: 50, // 50ms
      critical: 100 // 100ms
    });
  }

  /**
   * Set alert threshold
   */
  setThreshold(metric, thresholds) {
    this.options.alertThresholds[metric] = thresholds;
  }

  /**
   * Increment counter
   */
  incrementCounter(name, value = 1, labels = {}) {
    const key = this.getMetricKey(name, labels);
    const current = this.metrics.counters.get(key) || 0;
    this.metrics.counters.set(key, current + value);

    this.emit('metric:counter', { name, value, labels });
  }

  /**
   * Set gauge value
   */
  setGauge(name, value, labels = {}) {
    const key = this.getMetricKey(name, labels);
    this.metrics.gauges.set(key, {
      value,
      timestamp: Date.now(),
      labels
    });

    this.emit('metric:gauge', { name, value, labels });
  }

  /**
   * Record histogram value
   */
  recordHistogram(name, value, labels = {}) {
    const key = this.getMetricKey(name, labels);

    if (!this.metrics.histograms.has(key)) {
      this.metrics.histograms.set(key, {
        values: [],
        labels
      });
    }

    const histogram = this.metrics.histograms.get(key);
    histogram.values.push(value);

    // Keep only last 1000 values
    if (histogram.values.length > 1000) {
      histogram.values.shift();
    }

    this.emit('metric:histogram', { name, value, labels });

    // Calculate and check percentiles
    this.checkHistogramThresholds(name, histogram);
  }

  /**
   * Record timeseries data point
   */
  recordTimeseries(name, value, labels = {}) {
    const key = this.getMetricKey(name, labels);

    if (!this.metrics.timeseries.has(key)) {
      this.metrics.timeseries.set(key, {
        datapoints: [],
        labels
      });
    }

    const series = this.metrics.timeseries.get(key);
    series.datapoints.push({
      value,
      timestamp: Date.now()
    });

    // Cleanup old datapoints
    const cutoff = Date.now() - this.options.metricsRetention;
    series.datapoints = series.datapoints.filter(dp => dp.timestamp >= cutoff);

    this.emit('metric:timeseries', { name, value, labels });
  }

  /**
   * Start request trace
   */
  startTrace(requestId, metadata = {}) {
    if (!this.options.enableTracing) {
      return null;
    }

    const trace = {
      requestId,
      startTime: Date.now(),
      spans: [],
      metadata
    };

    this.traces.push(trace);

    // Keep only recent traces
    if (this.traces.length > this.maxTraces) {
      this.traces.shift();
    }

    return trace;
  }

  /**
   * Add span to trace
   */
  addSpan(trace, name, duration, metadata = {}) {
    if (!trace) {
      return;
    }

    trace.spans.push({
      name,
      duration,
      timestamp: Date.now(),
      metadata
    });
  }

  /**
   * End trace
   */
  endTrace(trace) {
    if (!trace) {
      return;
    }

    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;

    this.emit('trace:complete', trace);

    // Record metrics
    this.recordHistogram('request_duration', trace.duration, {
      method: trace.metadata.method,
      path: trace.metadata.path
    });
  }

  /**
   * Trigger alert
   */
  triggerAlert(name, severity, message, metadata = {}) {
    const alertId = `${name}:${Date.now()}`;

    const alert = {
      id: alertId,
      name,
      severity,
      message,
      timestamp: Date.now(),
      metadata
    };

    this.alerts.set(alertId, alert);
    this.emit('alert', alert);

    // Auto-clear alerts after 5 minutes
    setTimeout(() => {
      this.alerts.delete(alertId);
    }, 300000);

    return alert;
  }

  /**
   * Check histogram thresholds
   */
  checkHistogramThresholds(name, histogram) {
    const thresholds = this.options.alertThresholds[name];
    if (!thresholds || histogram.values.length < 10) {
      return;
    }

    const p95 = this.calculatePercentile(histogram.values, 0.95);

    if (thresholds.critical && p95 > thresholds.critical) {
      this.triggerAlert(
        name,
        'critical',
        `${name} P95 (${p95.toFixed(2)}) exceeded critical threshold (${thresholds.critical})`,
        { p95, threshold: thresholds.critical }
      );
    } else if (thresholds.warning && p95 > thresholds.warning) {
      this.triggerAlert(
        name,
        'warning',
        `${name} P95 (${p95.toFixed(2)}) exceeded warning threshold (${thresholds.warning})`,
        { p95, threshold: thresholds.warning }
      );
    }
  }

  /**
   * Calculate percentile
   */
  calculatePercentile(values, percentile) {
    if (values.length === 0) {
      return 0;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get metric key
   */
  getMetricKey(name, labels) {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }

    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    return `${name}{${labelStr}}`;
  }

  /**
   * Start background monitoring
   */
  startMonitoring() {
    // Monitor event loop lag
    this.eventLoopMonitor = setInterval(() => {
      const start = Date.now();
      setImmediate(() => {
        const lag = Date.now() - start;
        this.setGauge('event_loop_lag_ms', lag);

        const threshold = this.options.alertThresholds.event_loop_delay;
        if (threshold) {
          if (threshold.critical && lag > threshold.critical) {
            this.triggerAlert('event_loop_delay', 'critical', `Event loop lag (${lag}ms) exceeded critical threshold`, {
              lag
            });
          } else if (threshold.warning && lag > threshold.warning) {
            this.triggerAlert('event_loop_delay', 'warning', `Event loop lag (${lag}ms) exceeded warning threshold`, {
              lag
            });
          }
        }
      });
    }, 1000);

    // Monitor memory
    this.memoryMonitor = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedPercent = usage.heapUsed / usage.heapTotal;

      this.setGauge('memory_heap_used_bytes', usage.heapUsed);
      this.setGauge('memory_heap_total_bytes', usage.heapTotal);
      this.setGauge('memory_rss_bytes', usage.rss);
      this.setGauge('memory_heap_used_percent', heapUsedPercent);

      this.recordTimeseries('memory_usage', heapUsedPercent);

      const threshold = this.options.alertThresholds.memory_usage;
      if (threshold) {
        if (threshold.critical && heapUsedPercent > threshold.critical) {
          this.triggerAlert(
            'memory_usage',
            'critical',
            `Memory usage (${(heapUsedPercent * 100).toFixed(1)}%) exceeded critical threshold`,
            { heapUsedPercent, heapUsed: usage.heapUsed, heapTotal: usage.heapTotal }
          );
        } else if (threshold.warning && heapUsedPercent > threshold.warning) {
          this.triggerAlert(
            'memory_usage',
            'warning',
            `Memory usage (${(heapUsedPercent * 100).toFixed(1)}%) exceeded warning threshold`,
            { heapUsedPercent, heapUsed: usage.heapUsed, heapTotal: usage.heapTotal }
          );
        }
      }
    }, 5000);
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics() {
    const metrics = {
      counters: Object.fromEntries(this.metrics.counters),
      gauges: Object.fromEntries(this.metrics.gauges),
      histograms: {},
      timeseries: {}
    };

    // Calculate histogram statistics
    for (const [key, histogram] of this.metrics.histograms.entries()) {
      if (histogram.values.length === 0) {
        continue;
      }

      const sorted = [...histogram.values].sort((a, b) => a - b);
      metrics.histograms[key] = {
        count: histogram.values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean: histogram.values.reduce((a, b) => a + b, 0) / histogram.values.length,
        p50: this.calculatePercentile(histogram.values, 0.5),
        p95: this.calculatePercentile(histogram.values, 0.95),
        p99: this.calculatePercentile(histogram.values, 0.99),
        labels: histogram.labels
      };
    }

    // Include timeseries
    for (const [key, series] of this.metrics.timeseries.entries()) {
      metrics.timeseries[key] = {
        datapoints: series.datapoints,
        labels: series.labels
      };
    }

    return metrics;
  }

  /**
   * Get active alerts
   */
  getAlerts() {
    return Array.from(this.alerts.values());
  }

  /**
   * Get recent traces
   */
  getTraces(limit = 100) {
    return this.traces.slice(-limit);
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus() {
    const lines = [];

    // Counters
    for (const [key, value] of this.metrics.counters.entries()) {
      lines.push(`# TYPE ${key} counter`);
      lines.push(`${key} ${value}`);
    }

    // Gauges
    for (const [key, metric] of this.metrics.gauges.entries()) {
      lines.push(`# TYPE ${key} gauge`);
      lines.push(`${key} ${metric.value}`);
    }

    // Histograms
    for (const [key, histogram] of this.metrics.histograms.entries()) {
      if (histogram.values.length === 0) {
        continue;
      }

      const stats = this.getMetrics().histograms[key];
      lines.push(`# TYPE ${key} summary`);
      lines.push(`${key}{quantile="0.5"} ${stats.p50}`);
      lines.push(`${key}{quantile="0.95"} ${stats.p95}`);
      lines.push(`${key}{quantile="0.99"} ${stats.p99}`);
      lines.push(`${key}_sum ${stats.mean * stats.count}`);
      lines.push(`${key}_count ${stats.count}`);
    }

    return lines.join('\n');
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics.counters.clear();
    this.metrics.gauges.clear();
    this.metrics.histograms.clear();
    this.metrics.timeseries.clear();
    this.traces = [];
    this.alerts.clear();
  }

  /**
   * Destroy monitoring
   */
  destroy() {
    if (this.eventLoopMonitor) {
      clearInterval(this.eventLoopMonitor);
    }
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
    }
    this.reset();
    this.removeAllListeners();
  }
}

module.exports = AdvancedMonitoring;
