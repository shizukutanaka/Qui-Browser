/**
 * Qui Browser - Monitoring Module
 *
 * Comprehensive monitoring and alerting system
 */

const SimpleHealthMonitor = require('../utils/simple-health');
const AdvancedMonitoring = require('../utils/advanced-monitoring');

class MonitoringManager {
  constructor(config) {
    this.config = config;
    this.healthMonitor = null;
    this.advancedMonitoring = null;
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTime: 0,
      activeConnections: 0,
      peakConnections: 0
    };
  }

  /**
   * Initialize monitoring components
   */
  initialize() {
    if (this.config.monitoring.enabled) {
      this.initializeHealthMonitor();
      this.initializeAdvancedMonitoring();
    }
  }

  /**
   * Initialize health monitor
   */
  initializeHealthMonitor() {
    try {
      const options = this.buildHealthMonitorOptions();
      this.healthMonitor = new SimpleHealthMonitor(options);
    } catch (error) {
      console.warn('Health monitor initialization failed:', error.message);
    }
  }

  /**
   * Initialize advanced monitoring
   */
  initializeAdvancedMonitoring() {
    try {
      this.advancedMonitoring = new AdvancedMonitoring({
        metricsRetention: 4 * 60 * 60 * 1000, // 4 hours
        alertThresholds: {
          response_time_p95: { warning: 120, critical: 400 },
          http_requests_total: { warning: 5000, critical: 20000 }
        }
      });

      // Set up alert handlers
      this.advancedMonitoring.on('alert', alert => {
        this.handleAlert(alert);
      });
    } catch (error) {
      console.warn('Advanced monitoring initialization failed:', error.message);
    }
  }

  /**
   * Build health monitor options from config
   */
  buildHealthMonitorOptions() {
    return {
      sampleIntervalMs: 30000, // 30 seconds
      thresholds: {
        memoryWarning: 0.8,
        memoryCritical: 0.95,
        heapWarning: 0.8,
        heapCritical: 0.95,
        cpuWarning: 0.8,
        cpuCritical: 0.95,
        eventLoopLagWarningMs: 100,
        eventLoopLagCriticalMs: 300
      }
    };
  }

  /**
   * Handle incoming request for monitoring
   */
  async handleRequest(req, res) {
    const startTime = Date.now();

    // Add monitoring to request
    if (this.advancedMonitoring) {
      req.monitoringTrace = this.advancedMonitoring.startTrace(
        res.getHeader('X-Request-ID') || 'unknown',
        { method: req.method, url: req.url }
      );
    }

    // Track request
    this.metrics.requests++;

    // Set up response tracking
    const originalEnd = res.end;
    res.end = (...args) => {
      const duration = Date.now() - startTime;
      this.recordResponseMetrics(req, res, duration);
      return originalEnd.apply(res, args);
    };
  }

  /**
   * Record response metrics
   */
  recordResponseMetrics(req, res, duration) {
    this.metrics.responseTime += duration;

    const statusCode = res.statusCode || 200;
    if (statusCode >= 400) {
      this.metrics.errors++;
    }

    // Update advanced monitoring
    if (this.advancedMonitoring) {
      const statusLabel = statusCode.toString();
      this.advancedMonitoring.incrementCounter('http_requests_total', 1, {
        method: req.method,
        status: statusLabel
      });

      this.advancedMonitoring.recordHistogram('response_time_p95', duration, {
        method: req.method,
        status: statusLabel
      });

      this.advancedMonitoring.recordTimeseries('response_time_ms', duration);

      // End trace
      if (req.monitoringTrace) {
        req.monitoringTrace.metadata = req.monitoringTrace.metadata || {};
        req.monitoringTrace.metadata.status = statusCode;
        req.monitoringTrace.metadata.duration = duration;
        this.advancedMonitoring.endTrace(req.monitoringTrace);
      }
    }
  }

  /**
   * Handle health check endpoint
   */
  async handleHealthCheck(req, res) {
    const uptime = Date.now() - (global.startTime || Date.now());
    const healthSnapshot = this.healthMonitor?.getHealth();

    const healthData = {
      status: healthSnapshot?.status || 'healthy',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(uptime / 1000),
      requests: this.metrics.requests,
      errors: this.metrics.errors,
      rateLimited: 0, // Will be filled by rate limiter
      avgResponseTimeMs: this.metrics.requests > 0 ?
        Math.floor(this.metrics.responseTime / this.metrics.requests) : 0,
      memory: process.memoryUsage(),
      connections: {
        active: this.metrics.activeConnections,
        peak: this.metrics.peakConnections
      },
      version: this.config.version || '1.0.0',
      metrics: {
        server: {
          uptimeMs: uptime,
          totalRequests: this.metrics.requests,
          totalErrors: this.metrics.errors,
          avgResponseTimeMs: this.metrics.requests > 0 ?
            Math.floor(this.metrics.responseTime / this.metrics.requests) : 0,
          activeConnections: this.metrics.activeConnections,
          peakConnections: this.metrics.peakConnections
        },
        system: healthSnapshot?.metrics || null
      },
      thresholds: healthSnapshot?.thresholds || null,
      environment: {
        nodeVersion: process.version,
        pid: process.pid
      }
    };

    const statusCode = healthSnapshot?.status === 'critical' ? 503 :
                      healthSnapshot?.status === 'warning' ? 200 : 200;

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(healthData, null, 2));
  }

  /**
   * Handle metrics endpoint
   */
  async handleMetrics(req, res) {
    const uptime = Date.now() - (global.startTime || Date.now());

    let metrics = [
      '# HELP http_requests_total Total HTTP requests',
      '# TYPE http_requests_total counter',
      `http_requests_total ${this.metrics.requests}`,
      '',
      '# HELP http_errors_total Total HTTP errors',
      '# TYPE http_errors_total counter',
      `http_errors_total ${this.metrics.errors}`,
      '',
      '# HELP process_uptime_seconds Process uptime',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${Math.floor(uptime / 1000)}`,
      '',
      '# HELP http_active_connections Active connections',
      '# TYPE http_active_connections gauge',
      `http_active_connections ${this.metrics.activeConnections}`,
      '',
      '# HELP http_peak_connections Peak connections',
      '# TYPE http_peak_connections gauge',
      `http_peak_connections ${this.metrics.peakConnections}`,
      ''
    ];

    // Add advanced metrics if available
    if (this.advancedMonitoring) {
      const advancedMetrics = this.advancedMonitoring.exportPrometheus();
      if (advancedMetrics) {
        metrics = metrics.concat(['', advancedMetrics]);
      }
    }

    const metricsText = metrics.join('\n');

    res.writeHead(200, {
      'Content-Type': 'text/plain; version=0.0.4'
    });
    res.end(req.method === 'HEAD' ? '' : metricsText);
  }

  /**
   * Handle alert from monitoring system
   */
  async handleAlert(alert) {
    console.warn(`[ALERT] ${alert.name}: ${alert.message}`, alert);

    // Here you could integrate with notification systems
    // For now, just log the alert
  }

  /**
   * Update connection metrics
   */
  updateConnectionMetrics(activeConnections) {
    this.metrics.activeConnections = activeConnections;
    this.metrics.peakConnections = Math.max(this.metrics.peakConnections, activeConnections);

    if (this.advancedMonitoring) {
      this.advancedMonitoring.setGauge('http_active_connections', activeConnections);
    }
  }

  /**
   * Get monitoring statistics
   */
  getStats() {
    const uptime = Date.now() - (global.startTime || Date.now());

    return {
      uptime: Math.floor(uptime / 1000),
      requests: this.metrics.requests,
      errors: this.metrics.errors,
      errorRate: this.metrics.requests > 0 ? this.metrics.errors / this.metrics.requests : 0,
      avgResponseTime: this.metrics.requests > 0 ?
        this.metrics.responseTime / this.metrics.requests : 0,
      activeConnections: this.metrics.activeConnections,
      peakConnections: this.metrics.peakConnections,
      healthStatus: this.healthMonitor?.getHealth()?.status || 'unknown',
      monitoringEnabled: Boolean(this.advancedMonitoring)
    };
  }

  /**
   * Cleanup monitoring resources
   */
  cleanup() {
    if (this.healthMonitor && typeof this.healthMonitor.stop === 'function') {
      this.healthMonitor.stop();
    }

    if (this.advancedMonitoring && typeof this.advancedMonitoring.destroy === 'function') {
      this.advancedMonitoring.destroy();
    }
  }
}

module.exports = {
  MonitoringManager
};
