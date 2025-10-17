/**
 * Core Web Vitals Monitor
 *
 * Implements real-time Core Web Vitals monitoring based on 2025 standards:
 * - LCP (Largest Contentful Paint) - Target: <2.5s
 * - INP (Interaction to Next Paint) - Target: <200ms (NEW in 2024, replaces FID)
 * - CLS (Cumulative Layout Shift) - Target: <0.1
 * - FCP (First Contentful Paint) - Target: <1.8s
 * - TTFB (Time to First Byte) - Target: <800ms
 *
 * Research sources:
 * - Google Core Web Vitals 2025 update
 * - INP replaces FID (March 2024)
 * - PerformanceObserver API
 *
 * Key findings:
 * - INP: Measures all interactions (FID only measured first)
 * - LCP: Videos now count as LCP candidates (2024 update)
 * - CLS: Mousemove events after mousedown excluded (2024 update)
 * - 75th percentile: Metric for "good" threshold
 * - Real User Monitoring (RUM): Critical for 2025
 *
 * @module core-web-vitals-monitor
 * @author Qui Browser Team
 * @since 1.3.0
 */

import { EventEmitter } from 'events';

/**
 * Core Web Vitals Monitor
 *
 * Provides real-time monitoring of Core Web Vitals:
 * - LCP, INP, CLS tracking
 * - Performance recommendations
 * - Historical data analysis
 * - Threshold alerts
 */
class CoreWebVitalsMonitor extends EventEmitter {
  /**
   * Initialize Core Web Vitals Monitor
   *
   * @param {Object} options - Configuration options
   * @param {Object} options.thresholds - Performance thresholds
   * @param {boolean} options.enableReporting - Enable automatic reporting
   * @param {string} options.reportingEndpoint - Endpoint for reporting
   * @param {boolean} options.enableAlerts - Enable threshold alerts
   */
  constructor(options = {}) {
    super();

    this.options = {
      thresholds: {
        lcp: {
          good: options.thresholds?.lcp?.good || 2500,
          needsImprovement: options.thresholds?.lcp?.needsImprovement || 4000
        },
        inp: {
          good: options.thresholds?.inp?.good || 200,
          needsImprovement: options.thresholds?.inp?.needsImprovement || 500
        },
        cls: {
          good: options.thresholds?.cls?.good || 0.1,
          needsImprovement: options.thresholds?.cls?.needsImprovement || 0.25
        },
        fcp: {
          good: options.thresholds?.fcp?.good || 1800,
          needsImprovement: options.thresholds?.fcp?.needsImprovement || 3000
        },
        ttfb: {
          good: options.thresholds?.ttfb?.good || 800,
          needsImprovement: options.thresholds?.ttfb?.needsImprovement || 1800
        }
      },
      enableReporting: options.enableReporting || false,
      reportingEndpoint: options.reportingEndpoint || '/api/web-vitals',
      enableAlerts: options.enableAlerts !== false,
      sampleRate: options.sampleRate || 1.0 // 100% sampling by default
    };

    // State
    this.initialized = false;
    this.observers = new Map();
    this.measurements = new Map();
    this.interactions = [];

    // Metrics
    this.metrics = {
      lcp: null,
      inp: null,
      cls: null,
      fcp: null,
      ttfb: null
    };

    // Statistics
    this.stats = {
      pageLoads: 0,
      metricsCollected: 0,
      alertsTriggered: 0,
      reportsS ent: 0
    };
  }

  /**
   * Initialize monitor
   */
  async initialize() {
    if (this.initialized) return;

    // Check browser support
    if (typeof window === 'undefined' || !window.PerformanceObserver) {
      throw new Error('PerformanceObserver API not supported');
    }

    // Setup metric observers
    this.observeLCP();
    this.observeINP();
    this.observeCLS();
    this.observeFCP();
    this.observeTTFB();

    // Setup page visibility listener
    this.setupVisibilityListener();

    this.initialized = true;
    this.stats.pageLoads++;

    this.emit('initialized', {
      thresholds: this.options.thresholds
    });
  }

  /**
   * Observe Largest Contentful Paint (LCP)
   */
  observeLCP() {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];

        this.metrics.lcp = {
          value: lastEntry.renderTime || lastEntry.loadTime,
          rating: this.getRating('lcp', lastEntry.renderTime || lastEntry.loadTime),
          element: lastEntry.element,
          url: lastEntry.url,
          size: lastEntry.size,
          timestamp: Date.now()
        };

        this.handleMetricUpdate('lcp', this.metrics.lcp);
      });

      observer.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.set('lcp', observer);

      this.emit('observer-started', { metric: 'lcp' });
    } catch (error) {
      this.emit('error', {
        phase: 'observe-lcp',
        error: error.message
      });
    }
  }

  /**
   * Observe Interaction to Next Paint (INP)
   * NEW in 2024 - replaces FID
   */
  observeINP() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Track all interactions
          this.interactions.push({
            type: entry.name,
            duration: entry.duration,
            startTime: entry.startTime,
            processingStart: entry.processingStart,
            processingEnd: entry.processingEnd,
            timestamp: Date.now()
          });

          // Calculate INP (worst interaction)
          const interactions = this.interactions
            .slice(-50) // Last 50 interactions
            .sort((a, b) => b.duration - a.duration);

          if (interactions.length > 0) {
            const worstInteraction = interactions[0];

            this.metrics.inp = {
              value: worstInteraction.duration,
              rating: this.getRating('inp', worstInteraction.duration),
              interactionType: worstInteraction.type,
              totalInteractions: this.interactions.length,
              timestamp: Date.now()
            };

            this.handleMetricUpdate('inp', this.metrics.inp);
          }
        }
      });

      observer.observe({
        type: 'event',
        buffered: true,
        durationThreshold: 16 // 60fps threshold
      });

      this.observers.set('inp', observer);

      this.emit('observer-started', { metric: 'inp' });
    } catch (error) {
      this.emit('error', {
        phase: 'observe-inp',
        error: error.message
      });
    }
  }

  /**
   * Observe Cumulative Layout Shift (CLS)
   */
  observeCLS() {
    try {
      let clsValue = 0;

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Exclude layout shifts with recent user input
          // 2024 update: Mousemove events after mousedown excluded
          if (!entry.hadRecentInput) {
            clsValue += entry.value;

            this.metrics.cls = {
              value: clsValue,
              rating: this.getRating('cls', clsValue),
              entries: list.getEntries().length,
              timestamp: Date.now()
            };

            this.handleMetricUpdate('cls', this.metrics.cls);
          }
        }
      });

      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.set('cls', observer);

      this.emit('observer-started', { metric: 'cls' });
    } catch (error) {
      this.emit('error', {
        phase: 'observe-cls',
        error: error.message
      });
    }
  }

  /**
   * Observe First Contentful Paint (FCP)
   */
  observeFCP() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.fcp = {
              value: entry.startTime,
              rating: this.getRating('fcp', entry.startTime),
              timestamp: Date.now()
            };

            this.handleMetricUpdate('fcp', this.metrics.fcp);
          }
        }
      });

      observer.observe({ entryTypes: ['paint'] });
      this.observers.set('fcp', observer);

      this.emit('observer-started', { metric: 'fcp' });
    } catch (error) {
      this.emit('error', {
        phase: 'observe-fcp',
        error: error.message
      });
    }
  }

  /**
   * Observe Time to First Byte (TTFB)
   */
  observeTTFB() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const ttfb = entry.responseStart - entry.requestStart;

            this.metrics.ttfb = {
              value: ttfb,
              rating: this.getRating('ttfb', ttfb),
              timestamp: Date.now()
            };

            this.handleMetricUpdate('ttfb', this.metrics.ttfb);
          }
        }
      });

      observer.observe({ entryTypes: ['navigation'] });
      this.observers.set('ttfb', observer);

      this.emit('observer-started', { metric: 'ttfb' });
    } catch (error) {
      this.emit('error', {
        phase: 'observe-ttfb',
        error: error.message
      });
    }
  }

  /**
   * Setup page visibility listener
   */
  setupVisibilityListener() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          // Report metrics when page becomes hidden
          this.reportMetrics();
        }
      });
    }
  }

  /**
   * Get rating for metric
   *
   * @param {string} metric - Metric name
   * @param {number} value - Metric value
   * @returns {string} Rating: 'good', 'needs-improvement', 'poor'
   */
  getRating(metric, value) {
    const thresholds = this.options.thresholds[metric];

    if (!thresholds) return 'unknown';

    if (value <= thresholds.good) {
      return 'good';
    } else if (value <= thresholds.needsImprovement) {
      return 'needs-improvement';
    } else {
      return 'poor';
    }
  }

  /**
   * Handle metric update
   *
   * @param {string} metricName - Metric name
   * @param {Object} metricData - Metric data
   */
  handleMetricUpdate(metricName, metricData) {
    this.stats.metricsCollected++;

    this.emit('metric-updated', {
      metric: metricName,
      ...metricData
    });

    // Trigger alert if threshold exceeded
    if (this.options.enableAlerts && metricData.rating === 'poor') {
      this.stats.alertsTriggered++;

      this.emit('threshold-exceeded', {
        metric: metricName,
        value: metricData.value,
        threshold: this.options.thresholds[metricName].needsImprovement,
        rating: metricData.rating
      });
    }

    // Store measurement
    if (!this.measurements.has(metricName)) {
      this.measurements.set(metricName, []);
    }

    this.measurements.get(metricName).push(metricData);

    // Keep last 100 measurements
    const measurements = this.measurements.get(metricName);
    if (measurements.length > 100) {
      measurements.shift();
    }
  }

  /**
   * Report metrics
   */
  async reportMetrics() {
    if (!this.options.enableReporting) return;

    // Sample rate check
    if (Math.random() > this.options.sampleRate) return;

    const report = {
      url: typeof window !== 'undefined' ? window.location.href : '',
      timestamp: Date.now(),
      metrics: this.metrics,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      connection: this.getConnectionInfo()
    };

    try {
      if (typeof fetch !== 'undefined') {
        await fetch(this.options.reportingEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(report),
          keepalive: true // Send even if page is closing
        });

        this.stats.reportsSent++;

        this.emit('metrics-reported', report);
      }
    } catch (error) {
      this.emit('error', {
        phase: 'report-metrics',
        error: error.message
      });
    }
  }

  /**
   * Get connection info
   *
   * @returns {Object} Connection information
   */
  getConnectionInfo() {
    if (typeof navigator !== 'undefined' && navigator.connection) {
      const conn = navigator.connection;

      return {
        effectiveType: conn.effectiveType,
        downlink: conn.downlink,
        rtt: conn.rtt,
        saveData: conn.saveData
      };
    }

    return {};
  }

  /**
   * Get current metrics
   *
   * @returns {Object} Current metrics
   */
  getCurrentMetrics() {
    return {
      ...this.metrics
    };
  }

  /**
   * Get metrics summary
   *
   * @returns {Object} Metrics summary with ratings
   */
  getMetricsSummary() {
    return {
      lcp: this.metrics.lcp ? {
        value: this.metrics.lcp.value,
        rating: this.metrics.lcp.rating,
        threshold: this.options.thresholds.lcp.good
      } : null,
      inp: this.metrics.inp ? {
        value: this.metrics.inp.value,
        rating: this.metrics.inp.rating,
        threshold: this.options.thresholds.inp.good
      } : null,
      cls: this.metrics.cls ? {
        value: this.metrics.cls.value,
        rating: this.metrics.cls.rating,
        threshold: this.options.thresholds.cls.good
      } : null,
      fcp: this.metrics.fcp ? {
        value: this.metrics.fcp.value,
        rating: this.metrics.fcp.rating,
        threshold: this.options.thresholds.fcp.good
      } : null,
      ttfb: this.metrics.ttfb ? {
        value: this.metrics.ttfb.value,
        rating: this.metrics.ttfb.rating,
        threshold: this.options.thresholds.ttfb.good
      } : null,
      overallRating: this.calculateOverallRating()
    };
  }

  /**
   * Calculate overall rating
   *
   * @returns {string} Overall rating
   */
  calculateOverallRating() {
    const ratings = Object.values(this.metrics)
      .filter(m => m !== null)
      .map(m => m.rating);

    if (ratings.length === 0) return 'unknown';

    const poorCount = ratings.filter(r => r === 'poor').length;
    const needsImprovementCount = ratings.filter(r => r === 'needs-improvement').length;

    if (poorCount > 0) return 'poor';
    if (needsImprovementCount > 0) return 'needs-improvement';
    return 'good';
  }

  /**
   * Get performance recommendations
   *
   * @returns {Array<Object>} Recommendations
   */
  getRecommendations() {
    const recommendations = [];

    // LCP recommendations
    if (this.metrics.lcp && this.metrics.lcp.rating !== 'good') {
      recommendations.push({
        metric: 'lcp',
        severity: this.metrics.lcp.rating,
        recommendations: [
          'Optimize largest image/video loading',
          'Use CDN for static assets',
          'Implement lazy loading for below-fold content',
          'Reduce server response time',
          'Eliminate render-blocking resources'
        ]
      });
    }

    // INP recommendations
    if (this.metrics.inp && this.metrics.inp.rating !== 'good') {
      recommendations.push({
        metric: 'inp',
        severity: this.metrics.inp.rating,
        recommendations: [
          'Optimize JavaScript execution',
          'Reduce third-party scripts',
          'Use web workers for heavy computations',
          'Implement code splitting',
          'Defer non-essential JavaScript'
        ]
      });
    }

    // CLS recommendations
    if (this.metrics.cls && this.metrics.cls.rating !== 'good') {
      recommendations.push({
        metric: 'cls',
        severity: this.metrics.cls.rating,
        recommendations: [
          'Set explicit dimensions for images and videos',
          'Reserve space for ads and embeds',
          'Avoid inserting content above existing content',
          'Use CSS transform for animations',
          'Preload fonts to avoid FOIT/FOUT'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Get statistics
   *
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      measurements: Array.from(this.measurements.keys()).reduce((acc, key) => {
        acc[key] = this.measurements.get(key).length;
        return acc;
      }, {}),
      interactions: this.interactions.length
    };
  }

  /**
   * Clean up
   */
  async cleanup() {
    // Disconnect all observers
    for (const observer of this.observers.values()) {
      observer.disconnect();
    }

    this.observers.clear();
    this.measurements.clear();
    this.interactions = [];

    this.removeAllListeners();
    this.initialized = false;
  }
}

export default CoreWebVitalsMonitor;
