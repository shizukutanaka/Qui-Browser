/**
 * Performance Navigation Observer
 *
 * Advanced performance monitoring using Navigation Timing API and Resource Timing API.
 * Based on 2025 W3C Performance specifications.
 *
 * Features:
 * - Navigation timing monitoring
 * - Resource timing tracking
 * - Performance bottleneck detection
 * - Real-time metrics collection
 * - Automated performance recommendations
 * - Integration with Core Web Vitals
 *
 * API Support:
 * - PerformanceNavigationTiming
 * - PerformanceResourceTiming
 * - PerformanceObserver
 * - User Timing API
 *
 * @module PerformanceNavigationObserver
 * @version 1.0.0
 */

const { EventEmitter } = require('events');

class PerformanceNavigationObserver extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      // Monitoring configuration
      enableNavigationTiming: options.enableNavigationTiming !== false,
      enableResourceTiming: options.enableResourceTiming !== false,
      enableUserTiming: options.enableUserTiming !== false,

      // Thresholds (milliseconds)
      thresholds: {
        dnsLookup: options.dnsLookup || 100,
        tcpConnection: options.tcpConnection || 100,
        tlsNegotiation: options.tlsNegotiation || 200,
        serverResponse: options.serverResponse || 200,
        domContentLoaded: options.domContentLoaded || 1500,
        windowLoad: options.windowLoad || 2500,
        resourceLoad: options.resourceLoad || 500,
        ...options.thresholds
      },

      // Resource monitoring
      resourceTypes: options.resourceTypes || [
        'script', 'css', 'img', 'font', 'fetch', 'xmlhttprequest'
      ],
      trackLongResources: options.trackLongResources !== false,
      longResourceThreshold: options.longResourceThreshold || 1000,

      // Buffering
      buffered: options.buffered !== false,
      maxBufferSize: options.maxBufferSize || 1000,

      // Reporting
      autoReport: options.autoReport !== false,
      reportInterval: options.reportInterval || 30000, // 30 seconds

      ...options
    };

    // Observers
    this.navigationObserver = null;
    this.resourceObserver = null;
    this.measureObserver = null;

    // Data storage
    this.navigationMetrics = [];
    this.resourceMetrics = [];
    this.userMetrics = [];
    this.bottlenecks = [];

    // Statistics
    this.stats = {
      navigations: 0,
      resources: 0,
      slowResources: 0,
      bottlenecksDetected: 0,
      avgDNSTime: 0,
      avgTCPTime: 0,
      avgTLSTime: 0,
      avgServerTime: 0,
      avgDOMContentLoaded: 0,
      avgWindowLoad: 0
    };

    this.reportTimer = null;
    this.initialized = false;
  }

  /**
   * Initialize performance monitoring
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Check if PerformanceObserver is available
      if (typeof PerformanceObserver === 'undefined') {
        throw new Error('PerformanceObserver not supported');
      }

      // Initialize navigation timing observer
      if (this.options.enableNavigationTiming) {
        this.initializeNavigationObserver();
      }

      // Initialize resource timing observer
      if (this.options.enableResourceTiming) {
        this.initializeResourceObserver();
      }

      // Initialize user timing observer
      if (this.options.enableUserTiming) {
        this.initializeUserTimingObserver();
      }

      // Start auto-reporting if enabled
      if (this.options.autoReport) {
        this.startAutoReporting();
      }

      this.initialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Initialize navigation timing observer
   */
  initializeNavigationObserver() {
    try {
      this.navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processNavigationEntry(entry);
        }
      });

      this.navigationObserver.observe({
        type: 'navigation',
        buffered: this.options.buffered
      });
    } catch (error) {
      this.emit('warning', {
        message: 'Failed to initialize navigation observer',
        error
      });
    }
  }

  /**
   * Initialize resource timing observer
   */
  initializeResourceObserver() {
    try {
      this.resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processResourceEntry(entry);
        }
      });

      this.resourceObserver.observe({
        type: 'resource',
        buffered: this.options.buffered
      });
    } catch (error) {
      this.emit('warning', {
        message: 'Failed to initialize resource observer',
        error
      });
    }
  }

  /**
   * Initialize user timing observer
   */
  initializeUserTimingObserver() {
    try {
      this.measureObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processUserTimingEntry(entry);
        }
      });

      this.measureObserver.observe({
        entryTypes: ['mark', 'measure'],
        buffered: this.options.buffered
      });
    } catch (error) {
      this.emit('warning', {
        message: 'Failed to initialize user timing observer',
        error
      });
    }
  }

  /**
   * Process navigation timing entry
   */
  processNavigationEntry(entry) {
    const metrics = {
      timestamp: Date.now(),
      type: entry.type, // 'navigate', 'reload', 'back_forward', 'prerender'

      // Connection timing
      dnsLookup: entry.domainLookupEnd - entry.domainLookupStart,
      tcpConnection: entry.connectEnd - entry.connectStart,
      tlsNegotiation: entry.secureConnectionStart > 0
        ? entry.connectEnd - entry.secureConnectionStart
        : 0,

      // Request/Response timing
      requestTime: entry.responseStart - entry.requestStart,
      responseTime: entry.responseEnd - entry.responseStart,
      serverTime: entry.responseEnd - entry.requestStart,

      // DOM processing
      domInteractive: entry.domInteractive - entry.fetchStart,
      domContentLoaded: entry.domContentLoadedEventEnd - entry.fetchStart,
      domComplete: entry.domComplete - entry.fetchStart,

      // Window load
      windowLoad: entry.loadEventEnd - entry.fetchStart,

      // Total navigation time
      totalTime: entry.loadEventEnd - entry.fetchStart,

      // Transfer size
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,

      // Protocol
      nextHopProtocol: entry.nextHopProtocol, // 'http/1.1', 'h2', 'h3'

      // Full entry for reference
      raw: entry
    };

    // Store metrics
    this.navigationMetrics.push(metrics);
    if (this.navigationMetrics.length > this.options.maxBufferSize) {
      this.navigationMetrics.shift();
    }

    // Update statistics
    this.updateNavigationStats(metrics);

    // Detect bottlenecks
    this.detectBottlenecks(metrics);

    // Emit event
    this.emit('navigation', metrics);

    this.stats.navigations++;
  }

  /**
   * Process resource timing entry
   */
  processResourceEntry(entry) {
    // Filter by resource type
    const resourceType = entry.initiatorType;
    if (this.options.resourceTypes.length > 0 &&
        !this.options.resourceTypes.includes(resourceType)) {
      return;
    }

    const metrics = {
      timestamp: Date.now(),
      name: entry.name,
      type: resourceType,

      // Timing
      duration: entry.duration,
      startTime: entry.startTime,

      // Connection (may be 0 if reused)
      dnsLookup: entry.domainLookupEnd - entry.domainLookupStart,
      tcpConnection: entry.connectEnd - entry.connectStart,
      tlsNegotiation: entry.secureConnectionStart > 0
        ? entry.connectEnd - entry.secureConnectionStart
        : 0,

      // Request/Response
      requestTime: entry.responseStart - entry.requestStart,
      responseTime: entry.responseEnd - entry.responseStart,

      // Size
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,

      // Cache status
      cached: entry.transferSize === 0 && entry.decodedBodySize > 0,

      // Protocol
      nextHopProtocol: entry.nextHopProtocol,

      // Full entry
      raw: entry
    };

    // Store metrics
    this.resourceMetrics.push(metrics);
    if (this.resourceMetrics.length > this.options.maxBufferSize) {
      this.resourceMetrics.shift();
    }

    // Track slow resources
    if (this.options.trackLongResources &&
        metrics.duration > this.options.longResourceThreshold) {
      this.stats.slowResources++;
      this.emit('slowResource', metrics);
    }

    // Emit event
    this.emit('resource', metrics);

    this.stats.resources++;
  }

  /**
   * Process user timing entry
   */
  processUserTimingEntry(entry) {
    const metrics = {
      timestamp: Date.now(),
      name: entry.name,
      entryType: entry.entryType, // 'mark' or 'measure'
      startTime: entry.startTime,
      duration: entry.duration || 0,
      detail: entry.detail || null,
      raw: entry
    };

    this.userMetrics.push(metrics);
    if (this.userMetrics.length > this.options.maxBufferSize) {
      this.userMetrics.shift();
    }

    this.emit('userTiming', metrics);
  }

  /**
   * Update navigation statistics
   */
  updateNavigationStats(metrics) {
    const count = this.stats.navigations + 1;

    this.stats.avgDNSTime = (this.stats.avgDNSTime * this.stats.navigations + metrics.dnsLookup) / count;
    this.stats.avgTCPTime = (this.stats.avgTCPTime * this.stats.navigations + metrics.tcpConnection) / count;
    this.stats.avgTLSTime = (this.stats.avgTLSTime * this.stats.navigations + metrics.tlsNegotiation) / count;
    this.stats.avgServerTime = (this.stats.avgServerTime * this.stats.navigations + metrics.serverTime) / count;
    this.stats.avgDOMContentLoaded = (this.stats.avgDOMContentLoaded * this.stats.navigations + metrics.domContentLoaded) / count;
    this.stats.avgWindowLoad = (this.stats.avgWindowLoad * this.stats.navigations + metrics.windowLoad) / count;
  }

  /**
   * Detect performance bottlenecks
   */
  detectBottlenecks(metrics) {
    const bottlenecks = [];
    const thresholds = this.options.thresholds;

    if (metrics.dnsLookup > thresholds.dnsLookup) {
      bottlenecks.push({
        type: 'dns',
        value: metrics.dnsLookup,
        threshold: thresholds.dnsLookup,
        severity: metrics.dnsLookup > thresholds.dnsLookup * 2 ? 'high' : 'medium',
        recommendation: 'Consider using DNS prefetching or a faster DNS resolver'
      });
    }

    if (metrics.tcpConnection > thresholds.tcpConnection) {
      bottlenecks.push({
        type: 'tcp',
        value: metrics.tcpConnection,
        threshold: thresholds.tcpConnection,
        severity: metrics.tcpConnection > thresholds.tcpConnection * 2 ? 'high' : 'medium',
        recommendation: 'Consider using connection keep-alive or HTTP/2+'
      });
    }

    if (metrics.tlsNegotiation > thresholds.tlsNegotiation) {
      bottlenecks.push({
        type: 'tls',
        value: metrics.tlsNegotiation,
        threshold: thresholds.tlsNegotiation,
        severity: metrics.tlsNegotiation > thresholds.tlsNegotiation * 2 ? 'high' : 'medium',
        recommendation: 'Consider using TLS session resumption or OCSP stapling'
      });
    }

    if (metrics.serverTime > thresholds.serverResponse) {
      bottlenecks.push({
        type: 'server',
        value: metrics.serverTime,
        threshold: thresholds.serverResponse,
        severity: metrics.serverTime > thresholds.serverResponse * 2 ? 'high' : 'medium',
        recommendation: 'Optimize server response time with caching or faster processing'
      });
    }

    if (metrics.domContentLoaded > thresholds.domContentLoaded) {
      bottlenecks.push({
        type: 'domContentLoaded',
        value: metrics.domContentLoaded,
        threshold: thresholds.domContentLoaded,
        severity: metrics.domContentLoaded > thresholds.domContentLoaded * 2 ? 'high' : 'medium',
        recommendation: 'Reduce render-blocking resources or defer script execution'
      });
    }

    if (metrics.windowLoad > thresholds.windowLoad) {
      bottlenecks.push({
        type: 'windowLoad',
        value: metrics.windowLoad,
        threshold: thresholds.windowLoad,
        severity: metrics.windowLoad > thresholds.windowLoad * 2 ? 'high' : 'medium',
        recommendation: 'Consider lazy loading images or splitting code bundles'
      });
    }

    if (bottlenecks.length > 0) {
      this.bottlenecks.push({
        timestamp: Date.now(),
        bottlenecks
      });

      this.stats.bottlenecksDetected += bottlenecks.length;
      this.emit('bottlenecks', bottlenecks);
    }
  }

  /**
   * Get navigation metrics
   */
  getNavigationMetrics(limit = 10) {
    return this.navigationMetrics.slice(-limit);
  }

  /**
   * Get resource metrics
   */
  getResourceMetrics(options = {}) {
    let metrics = [...this.resourceMetrics];

    // Filter by type
    if (options.type) {
      metrics = metrics.filter(m => m.type === options.type);
    }

    // Filter by duration
    if (options.minDuration) {
      metrics = metrics.filter(m => m.duration >= options.minDuration);
    }

    // Sort
    if (options.sort === 'duration') {
      metrics.sort((a, b) => b.duration - a.duration);
    } else if (options.sort === 'size') {
      metrics.sort((a, b) => b.transferSize - a.transferSize);
    }

    // Limit
    if (options.limit) {
      metrics = metrics.slice(0, options.limit);
    }

    return metrics;
  }

  /**
   * Get slow resources
   */
  getSlowResources(limit = 10) {
    return this.resourceMetrics
      .filter(m => m.duration > this.options.longResourceThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get user timing metrics
   */
  getUserTimingMetrics(name = null, limit = 10) {
    let metrics = [...this.userMetrics];

    if (name) {
      metrics = metrics.filter(m => m.name === name);
    }

    return metrics.slice(-limit);
  }

  /**
   * Get bottlenecks
   */
  getBottlenecks(limit = 10) {
    return this.bottlenecks.slice(-limit);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const lastNav = this.navigationMetrics[this.navigationMetrics.length - 1];

    return {
      navigation: lastNav ? {
        type: lastNav.type,
        dnsLookup: lastNav.dnsLookup,
        tcpConnection: lastNav.tcpConnection,
        tlsNegotiation: lastNav.tlsNegotiation,
        serverTime: lastNav.serverTime,
        domContentLoaded: lastNav.domContentLoaded,
        windowLoad: lastNav.windowLoad,
        totalTime: lastNav.totalTime,
        protocol: lastNav.nextHopProtocol
      } : null,

      resources: {
        total: this.stats.resources,
        slow: this.stats.slowResources,
        slowPercentage: this.stats.resources > 0
          ? (this.stats.slowResources / this.stats.resources) * 100
          : 0,
        byType: this.getResourceStatsByType()
      },

      averages: {
        dnsLookup: Math.round(this.stats.avgDNSTime),
        tcpConnection: Math.round(this.stats.avgTCPTime),
        tlsNegotiation: Math.round(this.stats.avgTLSTime),
        serverResponse: Math.round(this.stats.avgServerTime),
        domContentLoaded: Math.round(this.stats.avgDOMContentLoaded),
        windowLoad: Math.round(this.stats.avgWindowLoad)
      },

      bottlenecks: {
        total: this.stats.bottlenecksDetected,
        recent: this.getBottlenecks(5)
      }
    };
  }

  /**
   * Get resource statistics by type
   */
  getResourceStatsByType() {
    const byType = {};

    for (const metric of this.resourceMetrics) {
      if (!byType[metric.type]) {
        byType[metric.type] = {
          count: 0,
          totalDuration: 0,
          totalSize: 0,
          cached: 0
        };
      }

      const stats = byType[metric.type];
      stats.count++;
      stats.totalDuration += metric.duration;
      stats.totalSize += metric.transferSize;
      if (metric.cached) {
        stats.cached++;
      }
    }

    // Calculate averages
    for (const type in byType) {
      const stats = byType[type];
      stats.avgDuration = stats.totalDuration / stats.count;
      stats.avgSize = stats.totalSize / stats.count;
      stats.cacheRate = (stats.cached / stats.count) * 100;
    }

    return byType;
  }

  /**
   * Start auto-reporting
   */
  startAutoReporting() {
    this.reportTimer = setInterval(() => {
      const summary = this.getPerformanceSummary();
      this.emit('report', summary);
    }, this.options.reportInterval);
  }

  /**
   * Stop auto-reporting
   */
  stopAutoReporting() {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      navigationMetricsStored: this.navigationMetrics.length,
      resourceMetricsStored: this.resourceMetrics.length,
      userMetricsStored: this.userMetrics.length,
      bottlenecksStored: this.bottlenecks.length
    };
  }

  /**
   * Clear stored metrics
   */
  clearMetrics() {
    this.navigationMetrics = [];
    this.resourceMetrics = [];
    this.userMetrics = [];
    this.bottlenecks = [];
  }

  /**
   * Cleanup
   */
  cleanup() {
    // Disconnect observers
    if (this.navigationObserver) {
      this.navigationObserver.disconnect();
    }
    if (this.resourceObserver) {
      this.resourceObserver.disconnect();
    }
    if (this.measureObserver) {
      this.measureObserver.disconnect();
    }

    // Stop auto-reporting
    this.stopAutoReporting();

    // Clear metrics
    this.clearMetrics();

    this.emit('cleanup');
  }
}

module.exports = PerformanceNavigationObserver;
