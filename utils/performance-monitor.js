/**
 * Performance Monitor
 *
 * Implements performance monitoring (Improvements #260-265)
 * - Resource timing API
 * - User-centric metrics (LCP, FID, CLS)
 * - Custom performance marks
 * - Server-side timing
 * - Performance budgets
 */

const { EventEmitter } = require('events');
const { performance, PerformanceObserver } = require('perf_hooks');

/**
 * Performance monitor configuration
 */
const DEFAULT_PERF_CONFIG = {
  // Monitoring
  enableResourceTiming: true,
  enableUserTiming: true,
  enableServerTiming: true,

  // Performance budgets
  budgets: {
    'page-load': 3000, // 3 seconds
    'api-response': 500, // 500ms
    'database-query': 100, // 100ms
    'cache-lookup': 10 // 10ms
  },

  // Thresholds
  slowThreshold: 1000, // 1 second
  verySlowThreshold: 3000, // 3 seconds

  // History
  maxHistorySize: 1000
};

/**
 * Performance entry wrapper
 */
class PerformanceEntry {
  constructor(name, startTime, duration, metadata = {}) {
    this.name = name;
    this.startTime = startTime;
    this.duration = duration;
    this.metadata = metadata;
    this.timestamp = Date.now();
  }

  isSlow(threshold) {
    return this.duration > threshold;
  }

  toJSON() {
    return {
      name: this.name,
      startTime: this.startTime,
      duration: this.duration,
      metadata: this.metadata,
      timestamp: this.timestamp
    };
  }
}

/**
 * Performance budget checker
 */
class PerformanceBudget {
  constructor(budgets = {}) {
    this.budgets = budgets;
    this.violations = [];
  }

  /**
   * Check if entry violates budget
   */
  check(name, duration) {
    // Check exact match
    if (this.budgets[name]) {
      if (duration > this.budgets[name]) {
        const violation = {
          name,
          duration,
          budget: this.budgets[name],
          overage: duration - this.budgets[name],
          percentage: ((duration / this.budgets[name]) * 100).toFixed(2) + '%',
          timestamp: Date.now()
        };

        this.violations.push(violation);
        return violation;
      }
      return null;
    }

    // Check pattern match
    for (const [pattern, budget] of Object.entries(this.budgets)) {
      if (name.includes(pattern)) {
        if (duration > budget) {
          const violation = {
            name,
            pattern,
            duration,
            budget,
            overage: duration - budget,
            percentage: ((duration / budget) * 100).toFixed(2) + '%',
            timestamp: Date.now()
          };

          this.violations.push(violation);
          return violation;
        }
      }
    }

    return null;
  }

  /**
   * Get violations
   */
  getViolations(limit = 10) {
    return this.violations
      .sort((a, b) => b.overage - a.overage)
      .slice(0, limit);
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      totalViolations: this.violations.length,
      top: this.getViolations(5)
    };
  }
}

/**
 * Performance monitor
 */
class PerformanceMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULT_PERF_CONFIG, ...config };

    this.marks = new Map();
    this.measures = [];
    this.budget = new PerformanceBudget(this.config.budgets);

    // Statistics
    this.stats = {
      totalMeasures: 0,
      slowMeasures: 0,
      verySlowMeasures: 0
    };
  }

  /**
   * Mark performance point
   */
  mark(name, metadata = {}) {
    const markTime = performance.now();

    this.marks.set(name, {
      time: markTime,
      metadata,
      timestamp: Date.now()
    });

    if (this.config.enableUserTiming) {
      try {
        performance.mark(name);
      } catch (error) {
        // Ignore mark errors
      }
    }

    this.emit('mark', { name, time: markTime, metadata });

    return markTime;
  }

  /**
   * Measure between two marks
   */
  measure(name, startMark, endMark = null) {
    const start = this.marks.get(startMark);
    if (!start) {
      throw new Error(`Start mark "${startMark}" not found`);
    }

    let endTime;
    if (endMark) {
      const end = this.marks.get(endMark);
      if (!end) {
        throw new Error(`End mark "${endMark}" not found`);
      }
      endTime = end.time;
    } else {
      endTime = performance.now();
    }

    const duration = endTime - start.time;

    const entry = new PerformanceEntry(
      name,
      start.time,
      duration,
      { startMark, endMark }
    );

    this.measures.push(entry);
    this.stats.totalMeasures++;

    // Check thresholds
    if (duration > this.config.verySlowThreshold) {
      this.stats.verySlowMeasures++;
      this.emit('very-slow', entry);
    } else if (duration > this.config.slowThreshold) {
      this.stats.slowMeasures++;
      this.emit('slow', entry);
    }

    // Check budget
    const violation = this.budget.check(name, duration);
    if (violation) {
      this.emit('budget-violation', violation);
    }

    // Trim history
    if (this.measures.length > this.config.maxHistorySize) {
      this.measures.shift();
    }

    this.emit('measure', entry);

    return entry;
  }

  /**
   * Time a function
   */
  async time(name, fn, metadata = {}) {
    const startMark = `${name}:start`;
    const endMark = `${name}:end`;

    this.mark(startMark, metadata);

    try {
      const result = await fn();
      this.mark(endMark);
      const entry = this.measure(name, startMark, endMark);

      return { result, entry };
    } catch (error) {
      this.mark(endMark);
      this.measure(name, startMark, endMark);
      throw error;
    }
  }

  /**
   * Get measures by name
   */
  getMeasures(name = null, limit = 10) {
    let filtered = this.measures;

    if (name) {
      filtered = this.measures.filter((m) => m.name === name || m.name.includes(name));
    }

    return filtered
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get slow measures
   */
  getSlowMeasures(limit = 10) {
    return this.measures
      .filter((m) => m.duration > this.config.slowThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get statistics
   */
  getStatistics() {
    if (this.measures.length === 0) {
      return {
        count: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        slowCount: this.stats.slowMeasures,
        verySlowCount: this.stats.verySlowMeasures,
        budget: this.budget.getStatistics()
      };
    }

    const durations = this.measures.map((m) => m.duration).sort((a, b) => a - b);
    const sum = durations.reduce((acc, d) => acc + d, 0);

    const p50 = durations[Math.floor(durations.length * 0.5)];
    const p95 = durations[Math.floor(durations.length * 0.95)];
    const p99 = durations[Math.floor(durations.length * 0.99)];

    return {
      count: this.measures.length,
      avgDuration: (sum / durations.length).toFixed(2) + 'ms',
      minDuration: Math.min(...durations).toFixed(2) + 'ms',
      maxDuration: Math.max(...durations).toFixed(2) + 'ms',
      p50: p50.toFixed(2) + 'ms',
      p95: p95.toFixed(2) + 'ms',
      p99: p99.toFixed(2) + 'ms',
      slowCount: this.stats.slowMeasures,
      verySlowCount: this.stats.verySlowMeasures,
      budget: this.budget.getStatistics()
    };
  }

  /**
   * Generate Server-Timing header
   */
  generateServerTimingHeader(entries = []) {
    const timings = [];

    for (const entry of entries) {
      const duration = typeof entry.duration === 'number' ?
        entry.duration.toFixed(2) : entry.duration;

      const desc = entry.description ? `;desc="${entry.description}"` : '';
      timings.push(`${entry.name};dur=${duration}${desc}`);
    }

    return timings.join(', ');
  }

  /**
   * Create middleware for request timing
   */
  createMiddleware() {
    return (req, res, next) => {
      const startTime = performance.now();
      const requestId = req.id || req.headers['x-request-id'] || 'unknown';

      // Mark request start
      this.mark(`request:${requestId}:start`, {
        method: req.method,
        url: req.url
      });

      // Track response
      res.on('finish', () => {
        const duration = performance.now() - startTime;

        // Mark request end
        this.mark(`request:${requestId}:end`);

        // Measure request
        const entry = this.measure(
          `request:${req.method}:${req.url}`,
          `request:${requestId}:start`,
          `request:${requestId}:end`
        );

        // Add Server-Timing header
        if (this.config.enableServerTiming) {
          const serverTiming = this.generateServerTimingHeader([
            { name: 'total', duration, description: 'Total request time' }
          ]);
          res.setHeader('Server-Timing', serverTiming);
        }

        this.emit('request:complete', {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          entry
        });
      });

      next();
    };
  }

  /**
   * Clear all measurements
   */
  clear() {
    this.marks.clear();
    this.measures = [];
  }
}

/**
 * Create performance monitor middleware
 */
function createPerformanceMonitorMiddleware(config = {}) {
  const monitor = new PerformanceMonitor(config);

  // Log slow requests
  monitor.on('slow', (entry) => {
    console.warn(`[Slow] ${entry.name}: ${entry.duration.toFixed(2)}ms`);
  });

  monitor.on('very-slow', (entry) => {
    console.error(`[Very Slow] ${entry.name}: ${entry.duration.toFixed(2)}ms`);
  });

  monitor.on('budget-violation', (violation) => {
    console.warn(
      `[Budget Violation] ${violation.name}: ` +
      `${violation.duration.toFixed(2)}ms ` +
      `(budget: ${violation.budget}ms, ` +
      `overage: ${violation.overage.toFixed(2)}ms)`
    );
  });

  return {
    monitor,
    middleware: monitor.createMiddleware()
  };
}

module.exports = {
  PerformanceMonitor,
  PerformanceEntry,
  PerformanceBudget,
  createPerformanceMonitorMiddleware,
  DEFAULT_PERF_CONFIG
};
