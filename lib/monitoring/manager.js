/**
 * Qui Browser - Comprehensive Monitoring & Observability System
 *
 * Complete monitoring solution with metrics, tracing, logging, and alerting
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');

class MonitoringManager extends EventEmitter {
  constructor(config, databaseManager) {
    super();

    this.config = config;
    this.databaseManager = databaseManager;

    // Core monitoring components
    this.metrics = new Map();
    this.traces = new Map();
    this.alerts = new Map();
    this.healthChecks = new Map();
    this.performanceProfiles = new Map();

    // Monitoring state
    this.isMonitoring = false;
    this.startTime = Date.now();
    this.uptime = 0;

    // Configuration
    this.metricsInterval = config.monitoring?.metricsInterval || 30000; // 30 seconds
    this.healthCheckInterval = config.monitoring?.healthCheckInterval || 60000; // 1 minute
    this.alertCheckInterval = config.monitoring?.alertCheckInterval || 30000; // 30 seconds
    this.metricsRetention = config.monitoring?.metricsRetention || 7 * 24 * 60 * 60 * 1000; // 7 days
    this.traceRetention = config.monitoring?.traceRetention || 24 * 60 * 60 * 1000; // 24 hours

    // Thresholds and rules
    this.alertRules = new Map();
    this.performanceThresholds = {
      responseTime: { warning: 1000, critical: 5000 }, // ms
      errorRate: { warning: 0.05, critical: 0.10 }, // 5%, 10%
      cpuUsage: { warning: 70, critical: 90 }, // %
      memoryUsage: { warning: 80, critical: 95 }, // %
      diskUsage: { warning: 85, critical: 95 } // %
    };

    // External integrations
    this.integrations = new Map();

    // Sampling and aggregation
    this.metricsBuffer = new Map();
    this.samplingRates = new Map();

    this.initialize();
  }

  async initialize() {
    // Initialize default metrics
    this.initializeDefaultMetrics();

    // Initialize health checks
    this.initializeHealthChecks();

    // Initialize alert rules
    this.initializeAlertRules();

    // Set up periodic tasks
    this.startMonitoring();

    // Initialize integrations
    await this.initializeIntegrations();

    console.log('Monitoring system initialized');
  }

  initializeDefaultMetrics() {
    // Application metrics
    this.registerMetric('http_requests_total', 'counter', 'Total HTTP requests');
    this.registerMetric('http_requests_duration', 'histogram', 'HTTP request duration');
    this.registerMetric('http_requests_errors', 'counter', 'HTTP request errors');
    this.registerMetric('active_connections', 'gauge', 'Active connections');
    this.registerMetric('websocket_connections', 'gauge', 'WebSocket connections');

    // System metrics
    this.registerMetric('cpu_usage', 'gauge', 'CPU usage percentage');
    this.registerMetric('memory_usage', 'gauge', 'Memory usage percentage');
    this.registerMetric('disk_usage', 'gauge', 'Disk usage percentage');
    this.registerMetric('network_rx_bytes', 'counter', 'Network received bytes');
    this.registerMetric('network_tx_bytes', 'counter', 'Network transmitted bytes');

    // Business metrics
    this.registerMetric('users_active', 'gauge', 'Active users');
    this.registerMetric('sessions_active', 'gauge', 'Active sessions');
    this.registerMetric('api_calls_total', 'counter', 'Total API calls');
    this.registerMetric('bookmarks_created', 'counter', 'Bookmarks created');
    this.registerMetric('exports_completed', 'counter', 'Data exports completed');

    // Performance metrics
    this.registerMetric('cache_hit_ratio', 'gauge', 'Cache hit ratio');
    this.registerMetric('db_connection_pool_size', 'gauge', 'Database connection pool size');
    this.registerMetric('db_query_duration', 'histogram', 'Database query duration');
    this.registerMetric('rate_limit_hits', 'counter', 'Rate limit hits');
  }

  initializeHealthChecks() {
    // Register default health checks
    this.registerHealthCheck('database', async () => {
      try {
        // Check database connectivity
        const startTime = Date.now();
        await this.databaseManager.ping();
        const responseTime = Date.now() - startTime;

        return {
          status: 'healthy',
          responseTime,
          details: { connectionPool: this.databaseManager.getPoolStats() }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date()
        };
      }
    });

    this.registerHealthCheck('cache', async () => {
      try {
        // Check cache connectivity and performance
        const cache = require('../caching');
        const stats = await cache.getStats();

        return {
          status: 'healthy',
          details: stats
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message
        };
      }
    });

    this.registerHealthCheck('external_services', async () => {
      const results = {};

      // Check configured external services
      if (this.config.notifications?.email?.enabled) {
        try {
          // Simple email service check
          results.email = { status: 'healthy' };
        } catch (error) {
          results.email = { status: 'unhealthy', error: error.message };
        }
      }

      if (this.config.analytics?.enabled) {
        try {
          const analytics = require('../analytics/engine');
          results.analytics = { status: 'healthy' };
        } catch (error) {
          results.analytics = { status: 'unhealthy', error: error.message };
        }
      }

      const hasUnhealthy = Object.values(results).some(r => r.status === 'unhealthy');

      return {
        status: hasUnhealthy ? 'degraded' : 'healthy',
        details: results
      };
    });

    this.registerHealthCheck('system_resources', async () => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const uptime = process.uptime();

      const memoryPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      return {
        status: memoryPercent > 95 ? 'critical' : memoryPercent > 85 ? 'warning' : 'healthy',
        details: {
          memory: {
            used: memUsage.heapUsed,
            total: memUsage.heapTotal,
            percentage: memoryPercent
          },
          cpu: cpuUsage,
          uptime: uptime,
          pid: process.pid
        }
      };
    });
  }

  initializeAlertRules() {
    // Error rate alert
    this.registerAlertRule('high_error_rate', {
      condition: (metrics) => {
        const errorRate = metrics.get('http_requests_errors')?.value /
                         metrics.get('http_requests_total')?.value;
        return errorRate > this.performanceThresholds.errorRate.critical;
      },
      severity: 'critical',
      message: 'Error rate exceeds critical threshold',
      channels: ['email', 'slack'],
      cooldown: 300000 // 5 minutes
    });

    // Response time alert
    this.registerAlertRule('slow_response_time', {
      condition: (metrics) => {
        const avgResponseTime = this.calculateAverageResponseTime();
        return avgResponseTime > this.performanceThresholds.responseTime.critical;
      },
      severity: 'warning',
      message: 'Average response time is too high',
      channels: ['email'],
      cooldown: 600000 // 10 minutes
    });

    // High CPU usage alert
    this.registerAlertRule('high_cpu_usage', {
      condition: (metrics) => {
        const cpuUsage = metrics.get('cpu_usage')?.value || 0;
        return cpuUsage > this.performanceThresholds.cpuUsage.critical;
      },
      severity: 'critical',
      message: 'CPU usage is critically high',
      channels: ['email', 'sms'],
      cooldown: 300000
    });

    // Memory usage alert
    this.registerAlertRule('high_memory_usage', {
      condition: (metrics) => {
        const memoryUsage = metrics.get('memory_usage')?.value || 0;
        return memoryUsage > this.performanceThresholds.memoryUsage.critical;
      },
      severity: 'critical',
      message: 'Memory usage is critically high',
      channels: ['email', 'sms'],
      cooldown: 300000
    });

    // Database connection alert
    this.registerAlertRule('database_unhealthy', {
      condition: async (metrics) => {
        const healthCheck = await this.runHealthCheck('database');
        return healthCheck.status !== 'healthy';
      },
      severity: 'critical',
      message: 'Database health check failed',
      channels: ['email', 'sms'],
      cooldown: 60000 // 1 minute
    });
  }

  async initializeIntegrations() {
    // Prometheus metrics endpoint
    if (this.config.monitoring?.prometheus?.enabled) {
      this.integrations.set('prometheus', {
        type: 'metrics',
        endpoint: '/metrics',
        format: 'prometheus'
      });
    }

    // DataDog integration
    if (this.config.monitoring?.datadog?.enabled) {
      this.integrations.set('datadog', {
        type: 'metrics',
        apiKey: this.config.monitoring.datadog.apiKey,
        tags: this.config.monitoring.datadog.tags || []
      });
    }

    // New Relic integration
    if (this.config.monitoring?.newrelic?.enabled) {
      this.integrations.set('newrelic', {
        type: 'apm',
        licenseKey: this.config.monitoring.newrelic.licenseKey,
        appName: this.config.monitoring.newrelic.appName
      });
    }

    // Slack webhook integration
    if (this.config.monitoring?.slack?.enabled) {
      this.integrations.set('slack', {
        type: 'alerts',
        webhookUrl: this.config.monitoring.slack.webhookUrl,
        channel: this.config.monitoring.slack.channel
      });
    }
  }

  startMonitoring() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    // Collect metrics periodically
    setInterval(() => {
      this.collectMetrics();
    }, this.metricsInterval);

    // Run health checks periodically
    setInterval(() => {
      this.runAllHealthChecks();
    }, this.healthCheckInterval);

    // Check alerts periodically
    setInterval(() => {
      this.checkAlerts();
    }, this.alertCheckInterval);

    // Clean up old data periodically
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000); // Hourly

    console.log('Monitoring started');
  }

  stopMonitoring() {
    this.isMonitoring = false;
    console.log('Monitoring stopped');
  }

  /**
   * Metrics Collection
   */
  registerMetric(name, type, description, labels = []) {
    this.metrics.set(name, {
      type,
      description,
      labels,
      values: [],
      lastUpdated: null
    });
  }

  recordMetric(name, value, labels = {}) {
    const metric = this.metrics.get(name);
    if (!metric) return;

    const timestamp = Date.now();
    const metricValue = {
      value,
      labels,
      timestamp
    };

    metric.values.push(metricValue);
    metric.lastUpdated = timestamp;

    // Keep only recent values (last 1000)
    if (metric.values.length > 1000) {
      metric.values = metric.values.slice(-1000);
    }

    // Emit metric event
    this.emit('metric', { name, ...metricValue });
  }

  incrementCounter(name, labels = {}) {
    const currentValue = this.getMetricValue(name, labels) || 0;
    this.recordMetric(name, currentValue + 1, labels);
  }

  setGauge(name, value, labels = {}) {
    this.recordMetric(name, value, labels);
  }

  observeHistogram(name, value, labels = {}) {
    this.recordMetric(name, value, labels);
  }

  getMetricValue(name, labels = {}) {
    const metric = this.metrics.get(name);
    if (!metric || metric.values.length === 0) return null;

    // Find the most recent value with matching labels
    const matchingValues = metric.values
      .filter(v => this.labelsMatch(v.labels, labels))
      .sort((a, b) => b.timestamp - a.timestamp);

    return matchingValues.length > 0 ? matchingValues[0].value : null;
  }

  labelsMatch(metricLabels, queryLabels) {
    for (const [key, value] of Object.entries(queryLabels)) {
      if (metricLabels[key] !== value) return false;
    }
    return true;
  }

  getAllMetrics() {
    const result = {};
    for (const [name, metric] of this.metrics) {
      result[name] = {
        type: metric.type,
        description: metric.description,
        lastValue: metric.values.length > 0 ? metric.values[metric.values.length - 1] : null,
        count: metric.values.length,
        lastUpdated: metric.lastUpdated
      };
    }
    return result;
  }

  async collectMetrics() {
    try {
      // System metrics
      this.collectSystemMetrics();

      // Application metrics
      await this.collectApplicationMetrics();

      // Business metrics
      await this.collectBusinessMetrics();

      this.uptime = Date.now() - this.startTime;

    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  collectSystemMetrics() {
    // Memory usage
    const memUsage = process.memoryUsage();
    const memoryPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    this.setGauge('memory_usage', memoryPercent);

    // CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    const cpuPercent = ((cpuUsage.user + cpuUsage.system) / 1000000) * 100;
    this.setGauge('cpu_usage', Math.min(cpuPercent, 100));

    // Uptime
    this.setGauge('uptime_seconds', this.uptime / 1000);
  }

  async collectApplicationMetrics() {
    // Database metrics
    try {
      const dbStats = await this.databaseManager.getStats();
      this.setGauge('db_connection_pool_size', dbStats.poolSize || 0);
    } catch (error) {
      console.warn('Failed to collect database metrics:', error.message);
    }

    // Cache metrics
    try {
      const cacheStats = await require('../caching').getStats();
      if (cacheStats) {
        this.setGauge('cache_hit_ratio', cacheStats.hitRatio || 0);
      }
    } catch (error) {
      console.warn('Failed to collect cache metrics:', error.message);
    }
  }

  async collectBusinessMetrics() {
    // Analytics metrics
    try {
      const analyticsStats = require('../analytics/engine').getGlobalStats();
      this.setGauge('users_active', analyticsStats.totalIdentifiers || 0);
      this.setGauge('api_calls_total', analyticsStats.totalRequests || 0);
    } catch (error) {
      console.warn('Failed to collect analytics metrics:', error.message);
    }
  }

  /**
   * Health Checks
   */
  registerHealthCheck(name, checkFunction) {
    this.healthChecks.set(name, {
      name,
      checkFunction,
      lastResult: null,
      lastChecked: null,
      status: 'unknown'
    });
  }

  async runHealthCheck(name) {
    const healthCheck = this.healthChecks.get(name);
    if (!healthCheck) {
      throw new Error(`Health check '${name}' not found`);
    }

    try {
      const result = await healthCheck.checkFunction();
      healthCheck.lastResult = result;
      healthCheck.lastChecked = new Date();
      healthCheck.status = result.status;

      return result;
    } catch (error) {
      const errorResult = {
        status: 'error',
        error: error.message,
        timestamp: new Date()
      };

      healthCheck.lastResult = errorResult;
      healthCheck.lastChecked = new Date();
      healthCheck.status = 'error';

      return errorResult;
    }
  }

  async runAllHealthChecks() {
    const results = {};

    for (const [name] of this.healthChecks) {
      results[name] = await this.runHealthCheck(name);
    }

    // Emit health check results
    this.emit('health_checks', results);

    return results;
  }

  getHealthStatus() {
    const overallStatus = {
      status: 'healthy',
      timestamp: new Date(),
      checks: {}
    };

    let hasWarning = false;
    let hasCritical = false;

    for (const [name, check] of this.healthChecks) {
      const status = check.status;
      overallStatus.checks[name] = {
        status,
        lastChecked: check.lastChecked,
        details: check.lastResult
      };

      if (status === 'critical' || status === 'error') {
        hasCritical = true;
      } else if (status === 'warning' || status === 'degraded') {
        hasWarning = true;
      }
    }

    if (hasCritical) {
      overallStatus.status = 'critical';
    } else if (hasWarning) {
      overallStatus.status = 'warning';
    }

    return overallStatus;
  }

  /**
   * Alerting System
   */
  registerAlertRule(name, rule) {
    this.alertRules.set(name, {
      name,
      ...rule,
      lastTriggered: null,
      activeAlerts: new Set()
    });
  }

  async checkAlerts() {
    for (const [ruleName, rule] of this.alertRules) {
      try {
        const shouldTrigger = await rule.condition(this.metrics);

        if (shouldTrigger) {
          const now = Date.now();
          const cooldownPeriod = rule.cooldown || 300000; // 5 minutes default

          // Check if we're still in cooldown
          if (rule.lastTriggered && (now - rule.lastTriggered) < cooldownPeriod) {
            continue;
          }

          // Create alert
          const alert = {
            id: crypto.randomUUID(),
            rule: ruleName,
            severity: rule.severity,
            message: rule.message,
            timestamp: new Date(),
            metrics: this.getAllMetrics(),
            status: 'active'
          };

          this.alerts.set(alert.id, alert);
          rule.lastTriggered = now;

          // Send notifications
          await this.sendAlertNotifications(alert, rule.channels);

          // Emit alert event
          this.emit('alert', alert);

        } else {
          // Clear active alerts for this rule
          for (const [alertId, alert] of this.alerts) {
            if (alert.rule === ruleName && alert.status === 'active') {
              alert.status = 'resolved';
              alert.resolvedAt = new Date();
              this.emit('alert_resolved', alert);
            }
          }
        }

      } catch (error) {
        console.error(`Error checking alert rule ${ruleName}:`, error);
      }
    }
  }

  async sendAlertNotifications(alert, channels) {
    const notificationService = require('../notifications/service');

    for (const channel of channels) {
      try {
        if (channel === 'email') {
          // Send to administrators
          const adminEmails = this.config.monitoring?.alertEmails || [];
          for (const email of adminEmails) {
            await notificationService.sendNotification({
              type: 'email',
              to: email,
              template: 'system_alert',
              data: {
                alert: alert,
                severity: alert.severity.toUpperCase(),
                timestamp: alert.timestamp.toISOString()
              }
            });
          }
        } else if (channel === 'slack' && this.integrations.has('slack')) {
          await this.sendSlackAlert(alert);
        } else if (channel === 'sms') {
          // Send SMS alerts (simplified)
          const adminPhones = this.config.monitoring?.alertPhones || [];
          for (const phone of adminPhones) {
            await notificationService.sendSms(phone, `ALERT: ${alert.message}`);
          }
        }
      } catch (error) {
        console.error(`Failed to send alert via ${channel}:`, error);
      }
    }
  }

  async sendSlackAlert(alert) {
    const slack = this.integrations.get('slack');
    if (!slack) return;

    const payload = {
      channel: slack.channel,
      text: `🚨 *${alert.severity.toUpperCase()} ALERT*`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🚨 ${alert.severity.toUpperCase()} ALERT`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${alert.message}*\n\n*Rule:* ${alert.rule}\n*Time:* ${alert.timestamp.toISOString()}`
          }
        }
      ]
    };

    try {
      await fetch(slack.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }

  getActiveAlerts() {
    const activeAlerts = [];
    for (const alert of this.alerts.values()) {
      if (alert.status === 'active') {
        activeAlerts.push(alert);
      }
    }
    return activeAlerts;
  }

  /**
   * Distributed Tracing
   */
  startTrace(operation, parentSpan = null) {
    const spanId = crypto.randomUUID();
    const traceId = parentSpan?.traceId || crypto.randomUUID();

    const span = {
      id: spanId,
      traceId,
      operation,
      startTime: Date.now(),
      tags: new Map(),
      events: [],
      parentId: parentSpan?.id || null
    };

    this.traces.set(spanId, span);
    return span;
  }

  endTrace(span, error = null) {
    if (!span) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.error = error;

    // Emit trace event
    this.emit('trace', span);

    // Store trace for analysis
    this.storeTrace(span);
  }

  addSpanTag(span, key, value) {
    if (span) {
      span.tags.set(key, value);
    }
  }

  addSpanEvent(span, name, attributes = {}) {
    if (span) {
      span.events.push({
        name,
        timestamp: Date.now(),
        attributes
      });
    }
  }

  storeTrace(span) {
    // Store trace for analysis (simplified - would use proper tracing backend)
    console.log(`Trace: ${span.operation} (${span.duration}ms)`);
  }

  getTraces(limit = 100) {
    const traces = Array.from(this.traces.values())
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);

    return traces;
  }

  /**
   * Performance Profiling
   */
  startProfiling(sessionId, operation) {
    const profile = {
      id: crypto.randomUUID(),
      sessionId,
      operation,
      startTime: Date.now(),
      samples: [],
      memorySnapshots: [],
      cpuSamples: []
    };

    this.performanceProfiles.set(profile.id, profile);
    return profile.id;
  }

  addProfileSample(profileId, sample) {
    const profile = this.performanceProfiles.get(profileId);
    if (profile) {
      profile.samples.push({
        timestamp: Date.now(),
        ...sample
      });
    }
  }

  endProfiling(profileId) {
    const profile = this.performanceProfiles.get(profileId);
    if (profile) {
      profile.endTime = Date.now();
      profile.duration = profile.endTime - profile.startTime;

      // Analyze profile
      this.analyzeProfile(profile);

      return profile;
    }
    return null;
  }

  analyzeProfile(profile) {
    const analysis = {
      averageResponseTime: 0,
      memoryLeakSuspected: false,
      cpuIntensive: false,
      slowQueries: []
    };

    // Analyze samples
    if (profile.samples.length > 0) {
      const responseTimes = profile.samples
        .filter(s => s.responseTime)
        .map(s => s.responseTime);

      if (responseTimes.length > 0) {
        analysis.averageResponseTime = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
      }

      // Check for memory leaks
      const memorySamples = profile.samples.filter(s => s.memoryUsage);
      if (memorySamples.length > 1) {
        const firstMemory = memorySamples[0].memoryUsage;
        const lastMemory = memorySamples[memorySamples.length - 1].memoryUsage;
        const memoryGrowth = ((lastMemory - firstMemory) / firstMemory) * 100;

        analysis.memoryLeakSuspected = memoryGrowth > 50; // 50% growth
      }

      // Check for slow queries
      analysis.slowQueries = profile.samples
        .filter(s => s.queryDuration && s.queryDuration > 1000) // > 1 second
        .map(s => ({
          query: s.query,
          duration: s.queryDuration,
          timestamp: s.timestamp
        }));
    }

    profile.analysis = analysis;
    this.emit('profile_analyzed', profile);
  }

  /**
   * Utility Methods
   */
  calculateAverageResponseTime() {
    const responseTimes = [];
    const responseTimeMetric = this.metrics.get('http_requests_duration');

    if (responseTimeMetric) {
      responseTimeMetric.values.forEach(v => {
        if (v.value) responseTimes.push(v.value);
      });
    }

    return responseTimes.length > 0
      ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
      : 0;
  }

  cleanupOldData() {
    const now = Date.now();
    const metricsCutoff = now - this.metricsRetention;
    const tracesCutoff = now - this.traceRetention;

    // Clean up old metrics
    for (const metric of this.metrics.values()) {
      metric.values = metric.values.filter(v => v.timestamp > metricsCutoff);
    }

    // Clean up old traces
    for (const [spanId, span] of this.traces) {
      if (span.endTime && span.endTime < tracesCutoff) {
        this.traces.delete(spanId);
      }
    }

    // Clean up old alerts
    for (const [alertId, alert] of this.alerts) {
      if (alert.resolvedAt && (now - alert.resolvedAt.getTime()) > (7 * 24 * 60 * 60 * 1000)) {
        this.alerts.delete(alertId);
      }
    }
  }

  /**
   * Get comprehensive monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      uptime: this.uptime,
      startTime: new Date(this.startTime),
      metrics: this.getAllMetrics(),
      healthStatus: this.getHealthStatus(),
      activeAlerts: this.getActiveAlerts(),
      recentTraces: this.getTraces(10),
      integrations: Array.from(this.integrations.keys()),
      config: {
        metricsInterval: this.metricsInterval,
        healthCheckInterval: this.healthCheckInterval,
        alertCheckInterval: this.alertCheckInterval
      }
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics() {
    let output = '';

    for (const [name, metric] of this.metrics) {
      if (metric.values.length > 0) {
        const latestValue = metric.values[metric.values.length - 1];

        // Add HELP comment
        output += `# HELP ${name} ${metric.description}\n`;
        output += `# TYPE ${name} ${metric.type}\n`;

        // Add metric value
        let line = `${name}`;
        if (latestValue.labels && Object.keys(latestValue.labels).length > 0) {
          const labels = Object.entries(latestValue.labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');
          line += `{${labels}}`;
        }
        line += ` ${latestValue.value} ${latestValue.timestamp}\n`;

        output += line;
      }
    }

    return output;
  }

  /**
   * Destroy the monitoring manager
   */
  destroy() {
    this.stopMonitoring();
    this.metrics.clear();
    this.traces.clear();
    this.alerts.clear();
    this.healthChecks.clear();
    this.performanceProfiles.clear();
    this.removeAllListeners();
  }
}

module.exports = MonitoringManager;
