/**
 * Real-time Metrics Aggregator
 * High-performance metrics collection and aggregation pipeline
 * Priority: H005 from improvement backlog
 *
 * @module utils/metrics-aggregator
 */

const EventEmitter = require('events');

class MetricsAggregator extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      aggregationInterval: options.aggregationInterval || 10000, // 10 seconds
      retentionPeriod: options.retentionPeriod || 3600000, // 1 hour
      maxDataPoints: options.maxDataPoints || 10000,
      enableHistogram: options.enableHistogram !== false,
      histogramBuckets: options.histogramBuckets || [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
      ...options
    };

    // Metric storage
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.summaries = new Map();

    // Aggregated data
    this.aggregatedData = [];

    // Start aggregation loop
    this.startAggregation();
  }

  /**
   * Increment counter
   * @param {string} name - Counter name
   * @param {number} value - Increment value
   * @param {Object} labels - Metric labels
   */
  incrementCounter(name, value = 1, labels = {}) {
    const key = this.getMetricKey(name, labels);

    if (!this.counters.has(key)) {
      this.counters.set(key, {
        name,
        labels,
        value: 0,
        type: 'counter',
        timestamp: Date.now()
      });
    }

    const counter = this.counters.get(key);
    counter.value += value;
    counter.timestamp = Date.now();

    this.emit('metric', { type: 'counter', name, value, labels });
  }

  /**
   * Set gauge value
   * @param {string} name - Gauge name
   * @param {number} value - Gauge value
   * @param {Object} labels - Metric labels
   */
  setGauge(name, value, labels = {}) {
    const key = this.getMetricKey(name, labels);

    this.gauges.set(key, {
      name,
      labels,
      value,
      type: 'gauge',
      timestamp: Date.now()
    });

    this.emit('metric', { type: 'gauge', name, value, labels });
  }

  /**
   * Record histogram observation
   * @param {string} name - Histogram name
   * @param {number} value - Observed value
   * @param {Object} labels - Metric labels
   */
  observeHistogram(name, value, labels = {}) {
    const key = this.getMetricKey(name, labels);

    if (!this.histograms.has(key)) {
      this.histograms.set(key, {
        name,
        labels,
        type: 'histogram',
        observations: [],
        buckets: this.initializeBuckets(),
        sum: 0,
        count: 0,
        timestamp: Date.now()
      });
    }

    const histogram = this.histograms.get(key);
    histogram.observations.push(value);
    histogram.sum += value;
    histogram.count++;
    histogram.timestamp = Date.now();

    // Update buckets
    for (let i = 0; i < this.options.histogramBuckets.length; i++) {
      if (value <= this.options.histogramBuckets[i]) {
        histogram.buckets[i]++;
      }
    }

    // Trim observations if too many
    if (histogram.observations.length > this.options.maxDataPoints) {
      histogram.observations = histogram.observations.slice(-this.options.maxDataPoints);
    }

    this.emit('metric', { type: 'histogram', name, value, labels });
  }

  /**
   * Record summary observation
   * @param {string} name - Summary name
   * @param {number} value - Observed value
   * @param {Object} labels - Metric labels
   */
  observeSummary(name, value, labels = {}) {
    const key = this.getMetricKey(name, labels);

    if (!this.summaries.has(key)) {
      this.summaries.set(key, {
        name,
        labels,
        type: 'summary',
        observations: [],
        sum: 0,
        count: 0,
        timestamp: Date.now()
      });
    }

    const summary = this.summaries.get(key);
    summary.observations.push(value);
    summary.sum += value;
    summary.count++;
    summary.timestamp = Date.now();

    // Trim observations if too many
    if (summary.observations.length > this.options.maxDataPoints) {
      summary.observations = summary.observations.slice(-this.options.maxDataPoints);
    }

    this.emit('metric', { type: 'summary', name, value, labels });
  }

  /**
   * Initialize histogram buckets
   * @returns {Array} Bucket counts
   */
  initializeBuckets() {
    return new Array(this.options.histogramBuckets.length).fill(0);
  }

  /**
   * Generate metric key from name and labels
   * @param {string} name - Metric name
   * @param {Object} labels - Metric labels
   * @returns {string} Unique key
   */
  getMetricKey(name, labels) {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    return labelStr ? `${name}{${labelStr}}` : name;
  }

  /**
   * Start aggregation loop
   */
  startAggregation() {
    this.aggregationTimer = setInterval(() => {
      this.aggregate();
    }, this.options.aggregationInterval);
  }

  /**
   * Stop aggregation loop
   */
  stopAggregation() {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }
  }

  /**
   * Perform aggregation
   */
  aggregate() {
    const timestamp = Date.now();
    const snapshot = {
      timestamp,
      counters: this.aggregateCounters(),
      gauges: this.aggregateGauges(),
      histograms: this.aggregateHistograms(),
      summaries: this.aggregateSummaries()
    };

    this.aggregatedData.push(snapshot);

    // Clean up old data
    const cutoffTime = timestamp - this.options.retentionPeriod;
    this.aggregatedData = this.aggregatedData.filter(d => d.timestamp >= cutoffTime);

    // Clean up old metrics
    this.cleanupOldMetrics(cutoffTime);

    this.emit('aggregated', snapshot);
  }

  /**
   * Aggregate counters
   * @returns {Array} Aggregated counter data
   */
  aggregateCounters() {
    const result = [];

    for (const [key, counter] of this.counters.entries()) {
      result.push({
        name: counter.name,
        labels: counter.labels,
        value: counter.value,
        timestamp: counter.timestamp
      });
    }

    return result;
  }

  /**
   * Aggregate gauges
   * @returns {Array} Aggregated gauge data
   */
  aggregateGauges() {
    const result = [];

    for (const [key, gauge] of this.gauges.entries()) {
      result.push({
        name: gauge.name,
        labels: gauge.labels,
        value: gauge.value,
        timestamp: gauge.timestamp
      });
    }

    return result;
  }

  /**
   * Aggregate histograms
   * @returns {Array} Aggregated histogram data
   */
  aggregateHistograms() {
    const result = [];

    for (const [key, histogram] of this.histograms.entries()) {
      const percentiles = this.calculatePercentiles(histogram.observations);

      result.push({
        name: histogram.name,
        labels: histogram.labels,
        count: histogram.count,
        sum: histogram.sum,
        mean: histogram.count > 0 ? histogram.sum / histogram.count : 0,
        buckets: this.options.histogramBuckets.map((le, i) => ({
          le,
          count: histogram.buckets[i]
        })),
        percentiles,
        timestamp: histogram.timestamp
      });
    }

    return result;
  }

  /**
   * Aggregate summaries
   * @returns {Array} Aggregated summary data
   */
  aggregateSummaries() {
    const result = [];

    for (const [key, summary] of this.summaries.entries()) {
      const percentiles = this.calculatePercentiles(summary.observations);

      result.push({
        name: summary.name,
        labels: summary.labels,
        count: summary.count,
        sum: summary.sum,
        mean: summary.count > 0 ? summary.sum / summary.count : 0,
        percentiles,
        timestamp: summary.timestamp
      });
    }

    return result;
  }

  /**
   * Calculate percentiles from observations
   * @param {Array} observations - Array of numbers
   * @returns {Object} Percentile values
   */
  calculatePercentiles(observations) {
    if (observations.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }

    const sorted = [...observations].sort((a, b) => a - b);

    return {
      p50: this.getPercentile(sorted, 0.50),
      p90: this.getPercentile(sorted, 0.90),
      p95: this.getPercentile(sorted, 0.95),
      p99: this.getPercentile(sorted, 0.99)
    };
  }

  /**
   * Get percentile value
   * @param {Array} sorted - Sorted array
   * @param {number} percentile - Percentile (0-1)
   * @returns {number} Percentile value
   */
  getPercentile(sorted, percentile) {
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Clean up old metrics
   * @param {number} cutoffTime - Cutoff timestamp
   */
  cleanupOldMetrics(cutoffTime) {
    for (const [key, counter] of this.counters.entries()) {
      if (counter.timestamp < cutoffTime) {
        this.counters.delete(key);
      }
    }

    for (const [key, gauge] of this.gauges.entries()) {
      if (gauge.timestamp < cutoffTime) {
        this.gauges.delete(key);
      }
    }

    for (const [key, histogram] of this.histograms.entries()) {
      if (histogram.timestamp < cutoffTime) {
        this.histograms.delete(key);
      }
    }

    for (const [key, summary] of this.summaries.entries()) {
      if (summary.timestamp < cutoffTime) {
        this.summaries.delete(key);
      }
    }
  }

  /**
   * Get current metrics snapshot
   * @returns {Object} Current metrics
   */
  getSnapshot() {
    return {
      timestamp: Date.now(),
      counters: Array.from(this.counters.values()),
      gauges: Array.from(this.gauges.values()),
      histograms: Array.from(this.histograms.values()).map(h => ({
        ...h,
        mean: h.count > 0 ? h.sum / h.count : 0,
        percentiles: this.calculatePercentiles(h.observations)
      })),
      summaries: Array.from(this.summaries.values()).map(s => ({
        ...s,
        mean: s.count > 0 ? s.sum / s.count : 0,
        percentiles: this.calculatePercentiles(s.observations)
      }))
    };
  }

  /**
   * Get aggregated data for time range
   * @param {number} startTime - Start timestamp
   * @param {number} endTime - End timestamp
   * @returns {Array} Aggregated data points
   */
  getAggregatedData(startTime, endTime = Date.now()) {
    return this.aggregatedData.filter(d =>
      d.timestamp >= startTime && d.timestamp <= endTime
    );
  }

  /**
   * Get metric by name
   * @param {string} name - Metric name
   * @param {Object} labels - Optional label filter
   * @returns {Array} Matching metrics
   */
  getMetric(name, labels = null) {
    const results = [];

    // Search counters
    for (const counter of this.counters.values()) {
      if (counter.name === name && this.matchesLabels(counter.labels, labels)) {
        results.push(counter);
      }
    }

    // Search gauges
    for (const gauge of this.gauges.values()) {
      if (gauge.name === name && this.matchesLabels(gauge.labels, labels)) {
        results.push(gauge);
      }
    }

    // Search histograms
    for (const histogram of this.histograms.values()) {
      if (histogram.name === name && this.matchesLabels(histogram.labels, labels)) {
        results.push({
          ...histogram,
          mean: histogram.count > 0 ? histogram.sum / histogram.count : 0,
          percentiles: this.calculatePercentiles(histogram.observations)
        });
      }
    }

    // Search summaries
    for (const summary of this.summaries.values()) {
      if (summary.name === name && this.matchesLabels(summary.labels, labels)) {
        results.push({
          ...summary,
          mean: summary.count > 0 ? summary.sum / summary.count : 0,
          percentiles: this.calculatePercentiles(summary.observations)
        });
      }
    }

    return results;
  }

  /**
   * Check if labels match filter
   * @param {Object} metricLabels - Metric labels
   * @param {Object} filterLabels - Filter labels
   * @returns {boolean} True if matches
   */
  matchesLabels(metricLabels, filterLabels) {
    if (!filterLabels) return true;

    for (const [key, value] of Object.entries(filterLabels)) {
      if (metricLabels[key] !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Export metrics in Prometheus format
   * @returns {string} Prometheus-formatted metrics
   */
  exportPrometheus() {
    const lines = [];
    const timestamp = Date.now();

    // Export counters
    for (const counter of this.counters.values()) {
      const labels = this.formatPrometheusLabels(counter.labels);
      lines.push(`# TYPE ${counter.name} counter`);
      lines.push(`${counter.name}${labels} ${counter.value} ${timestamp}`);
    }

    // Export gauges
    for (const gauge of this.gauges.values()) {
      const labels = this.formatPrometheusLabels(gauge.labels);
      lines.push(`# TYPE ${gauge.name} gauge`);
      lines.push(`${gauge.name}${labels} ${gauge.value} ${timestamp}`);
    }

    // Export histograms
    for (const histogram of this.histograms.values()) {
      const labels = this.formatPrometheusLabels(histogram.labels);
      lines.push(`# TYPE ${histogram.name} histogram`);

      for (let i = 0; i < this.options.histogramBuckets.length; i++) {
        const le = this.options.histogramBuckets[i];
        const count = histogram.buckets[i];
        const bucketLabels = this.formatPrometheusLabels({
          ...histogram.labels,
          le: le === Infinity ? '+Inf' : le
        });
        lines.push(`${histogram.name}_bucket${bucketLabels} ${count} ${timestamp}`);
      }

      lines.push(`${histogram.name}_sum${labels} ${histogram.sum} ${timestamp}`);
      lines.push(`${histogram.name}_count${labels} ${histogram.count} ${timestamp}`);
    }

    // Export summaries
    for (const summary of this.summaries.values()) {
      const labels = this.formatPrometheusLabels(summary.labels);
      const percentiles = this.calculatePercentiles(summary.observations);

      lines.push(`# TYPE ${summary.name} summary`);
      lines.push(`${summary.name}_sum${labels} ${summary.sum} ${timestamp}`);
      lines.push(`${summary.name}_count${labels} ${summary.count} ${timestamp}`);

      for (const [quantile, value] of Object.entries(percentiles)) {
        const q = quantile.replace('p', '0.');
        const qLabels = this.formatPrometheusLabels({
          ...summary.labels,
          quantile: q
        });
        lines.push(`${summary.name}${qLabels} ${value} ${timestamp}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format labels for Prometheus
   * @param {Object} labels - Label object
   * @returns {string} Formatted labels
   */
  formatPrometheusLabels(labels) {
    if (!labels || Object.keys(labels).length === 0) {
      return '';
    }

    const pairs = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    return `{${pairs}}`;
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.summaries.clear();
    this.aggregatedData = [];
  }

  /**
   * Get statistics
   * @returns {Object} Aggregator statistics
   */
  getStats() {
    return {
      counters: this.counters.size,
      gauges: this.gauges.size,
      histograms: this.histograms.size,
      summaries: this.summaries.size,
      totalMetrics: this.counters.size + this.gauges.size + this.histograms.size + this.summaries.size,
      aggregatedDataPoints: this.aggregatedData.length,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }
}

module.exports = MetricsAggregator;
