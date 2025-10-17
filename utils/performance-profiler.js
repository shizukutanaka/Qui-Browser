/**
 * Performance Profiler
 * Detailed performance analysis and monitoring
 *
 * @module utils/performance-profiler
 */

const { performance } = require('perf_hooks');

/**
 * Performance Profiler
 * Tracks and analyzes application performance
 *
 * @class PerformanceProfiler
 * @description Provides performance profiling:
 * - Function execution timing
 * - Memory usage tracking
 * - CPU profiling
 * - Bottleneck detection
 * - Performance reports
 */
class PerformanceProfiler {
  /**
   * Create performance profiler
   * @param {Object} options - Configuration options
   * @param {boolean} [options.enabled=true] - Enable profiling
   * @param {number} [options.sampleInterval=100] - Sample interval (ms)
   * @param {number} [options.maxSamples=1000] - Max samples to keep
   */
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.sampleInterval = options.sampleInterval || 100;
    this.maxSamples = options.maxSamples || 1000;

    this.timings = new Map();
    this.marks = new Map();
    this.samples = [];
    this.metrics = new Map();

    this.startTime = Date.now();
  }

  /**
   * Start timing measurement
   * @param {string} name - Measurement name
   */
  start(name) {
    if (!this.enabled) {return;}

    this.marks.set(name, performance.now());
  }

  /**
   * End timing measurement
   * @param {string} name - Measurement name
   * @returns {number} - Duration in ms
   */
  end(name) {
    if (!this.enabled) {return 0;}

    const startTime = this.marks.get(name);

    if (!startTime) {
      console.warn(`No start mark found for: ${name}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.marks.delete(name);

    // Record timing
    if (!this.timings.has(name)) {
      this.timings.set(name, []);
    }

    const timings = this.timings.get(name);
    timings.push({
      duration,
      timestamp: Date.now(),
      memory: process.memoryUsage()
    });

    // Keep only recent timings
    if (timings.length > this.maxSamples) {
      timings.shift();
    }

    return duration;
  }

  /**
   * Measure function execution
   * @param {string} name - Measurement name
   * @param {Function} fn - Function to measure
   * @returns {Promise<*>} - Function result
   */
  async measure(name, fn) {
    if (!this.enabled) {
      return fn();
    }

    this.start(name);

    try {
      const result = await fn();
      return result;
    } finally {
      this.end(name);
    }
  }

  /**
   * Record metric
   * @param {string} name - Metric name
   * @param {number} value - Metric value
   * @param {Object} [tags] - Additional tags
   */
  recordMetric(name, value, tags = {}) {
    if (!this.enabled) {return;}

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name);
    metrics.push({
      value,
      timestamp: Date.now(),
      tags
    });

    // Keep only recent metrics
    if (metrics.length > this.maxSamples) {
      metrics.shift();
    }
  }

  /**
   * Take performance sample
   * @returns {Object} - Performance sample
   */
  takeSample() {
    if (!this.enabled) {return null;}

    const sample = {
      timestamp: Date.now(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: process.uptime()
    };

    this.samples.push(sample);

    // Keep only recent samples
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    return sample;
  }

  /**
   * Get timing statistics
   * @param {string} name - Measurement name
   * @returns {Object} - Statistics
   */
  getTimingStats(name) {
    const timings = this.timings.get(name);

    if (!timings || timings.length === 0) {
      return null;
    }

    const durations = timings.map(t => t.duration);
    durations.sort((a, b) => a - b);

    return {
      name,
      count: durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      mean: durations.reduce((a, b) => a + b, 0) / durations.length,
      median: durations[Math.floor(durations.length / 2)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)]
    };
  }

  /**
   * Get all timing statistics
   * @returns {Array<Object>} - Array of statistics
   */
  getAllTimingStats() {
    const stats = [];

    for (const name of this.timings.keys()) {
      const stat = this.getTimingStats(name);
      if (stat) {
        stats.push(stat);
      }
    }

    return stats.sort((a, b) => b.mean - a.mean);
  }

  /**
   * Get metric statistics
   * @param {string} name - Metric name
   * @returns {Object} - Statistics
   */
  getMetricStats(name) {
    const metrics = this.metrics.get(name);

    if (!metrics || metrics.length === 0) {
      return null;
    }

    const values = metrics.map(m => m.value);
    values.sort((a, b) => a - b);

    return {
      name,
      count: values.length,
      min: values[0],
      max: values[values.length - 1],
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      median: values[Math.floor(values.length / 2)],
      latest: metrics[metrics.length - 1].value
    };
  }

  /**
   * Get memory statistics
   * @returns {Object} - Memory stats
   */
  getMemoryStats() {
    if (this.samples.length === 0) {
      return null;
    }

    const heapUsed = this.samples.map(s => s.memory.heapUsed);
    const heapTotal = this.samples.map(s => s.memory.heapTotal);
    const external = this.samples.map(s => s.memory.external);

    return {
      heapUsed: {
        min: Math.min(...heapUsed),
        max: Math.max(...heapUsed),
        mean: heapUsed.reduce((a, b) => a + b, 0) / heapUsed.length,
        current: heapUsed[heapUsed.length - 1]
      },
      heapTotal: {
        min: Math.min(...heapTotal),
        max: Math.max(...heapTotal),
        mean: heapTotal.reduce((a, b) => a + b, 0) / heapTotal.length,
        current: heapTotal[heapTotal.length - 1]
      },
      external: {
        min: Math.min(...external),
        max: Math.max(...external),
        mean: external.reduce((a, b) => a + b, 0) / external.length,
        current: external[external.length - 1]
      }
    };
  }

  /**
   * Detect bottlenecks
   * @param {number} [threshold=100] - Threshold in ms
   * @returns {Array<Object>} - Bottlenecks
   */
  detectBottlenecks(threshold = 100) {
    const bottlenecks = [];

    for (const [name, stats] of this.timings.entries()) {
      const timingStats = this.getTimingStats(name);

      if (timingStats && timingStats.p95 > threshold) {
        bottlenecks.push({
          name,
          p95: timingStats.p95,
          mean: timingStats.mean,
          count: timingStats.count
        });
      }
    }

    return bottlenecks.sort((a, b) => b.p95 - a.p95);
  }

  /**
   * Generate performance report
   * @returns {Object} - Report
   */
  generateReport() {
    return {
      uptime: Date.now() - this.startTime,
      timings: this.getAllTimingStats(),
      memory: this.getMemoryStats(),
      bottlenecks: this.detectBottlenecks(),
      sampleCount: this.samples.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Export report as JSON
   * @returns {string} - JSON report
   */
  exportReport() {
    return JSON.stringify(this.generateReport(), null, 2);
  }

  /**
   * Clear all data
   */
  clear() {
    this.timings.clear();
    this.marks.clear();
    this.samples = [];
    this.metrics.clear();
  }

  /**
   * Enable profiling
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable profiling
   */
  disable() {
    this.enabled = false;
  }
}

/**
 * Global profiler instance
 */
let globalProfiler = null;

/**
 * Get global profiler
 * @returns {PerformanceProfiler} - Profiler instance
 */
function getProfiler() {
  if (!globalProfiler) {
    globalProfiler = new PerformanceProfiler();
  }
  return globalProfiler;
}

/**
 * Profile function decorator
 * @param {string} name - Function name
 * @returns {Function} - Decorator
 */
function profile(name) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args) {
      const profiler = getProfiler();
      return profiler.measure(name || propertyKey, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * Create profiling middleware
 * @param {PerformanceProfiler} profiler - Profiler instance
 * @returns {Function} - Middleware
 */
function createProfilingMiddleware(profiler) {
  return (req, res, next) => {
    const start = Date.now();
    const route = `${req.method} ${req.path}`;

    profiler.start(route);

    res.on('finish', () => {
      profiler.end(route);

      profiler.recordMetric('http_request_duration', Date.now() - start, {
        method: req.method,
        path: req.path,
        status: res.statusCode
      });
    });

    next();
  };
}

module.exports = {
  PerformanceProfiler,
  getProfiler,
  profile,
  createProfilingMiddleware
};
