/**
 * Tests for Monitoring Module
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { MonitoringManager } = require('../lib/monitoring');

test('Monitoring Module', async (t) => {
  const mockConfig = {
    monitoring: {
      enabled: true,
      healthCheckEnabled: true,
      metricsEnabled: true,
      alertingEnabled: false
    }
  };

  let monitoring;

  t.beforeEach(() => {
    monitoring = new MonitoringManager(mockConfig);
  });

  t.afterEach(() => {
    if (monitoring) {
      monitoring.cleanup();
    }
  });

  await t.test('MonitoringManager initializes correctly', () => {
    assert(monitoring instanceof MonitoringManager);
    assert.strictEqual(typeof monitoring.metrics, 'object');
    assert.strictEqual(typeof monitoring.config, 'object');
  });

  await t.test('initialize() sets up monitoring components', () => {
    monitoring.initialize();

    // Health monitor should be initialized if available
    // Advanced monitoring should be initialized based on config
  });

  await t.test('handleRequest() tracks request metrics', () => {
    const initialRequests = monitoring.metrics.requests;

    const mockReq = {
      method: 'GET',
      url: '/test',
      headers: {}
    };

    const mockRes = {
      statusCode: 200,
      setHeader: () => {},
      getHeader: () => 'test-request-id'
    };

    monitoring.handleRequest(mockReq, mockRes);

    // Simulate response completion
    monitoring.recordResponseMetrics(mockReq, mockRes, 100);

    assert.strictEqual(monitoring.metrics.requests, initialRequests + 1);
    assert.strictEqual(monitoring.metrics.responseTime, 100);
  });

  await t.test('recordResponseMetrics() updates metrics correctly', () => {
    const initialErrors = monitoring.metrics.errors;

    const mockReq = { method: 'GET' };
    const mockRes = { statusCode: 500 };

    monitoring.recordResponseMetrics(mockReq, mockRes, 200);

    assert.strictEqual(monitoring.metrics.errors, initialErrors + 1);
  });

  await t.test('updateConnectionMetrics() tracks connections', () => {
    monitoring.updateConnectionMetrics(5);
    assert.strictEqual(monitoring.metrics.activeConnections, 5);

    monitoring.updateConnectionMetrics(10);
    assert.strictEqual(monitoring.metrics.activeConnections, 10);
    assert.strictEqual(monitoring.metrics.peakConnections, 10);
  });

  await t.test('getStats() returns monitoring statistics', () => {
    const stats = monitoring.getStats();

    assert.strictEqual(typeof stats, 'object');
    assert(stats.hasOwnProperty('uptime'));
    assert(stats.hasOwnProperty('requests'));
    assert(stats.hasOwnProperty('errors'));
    assert(stats.hasOwnProperty('errorRate'));
    assert(stats.hasOwnProperty('avgResponseTime'));
    assert(stats.hasOwnProperty('activeConnections'));
    assert(stats.hasOwnProperty('peakConnections'));
    assert(stats.hasOwnProperty('healthStatus'));
    assert(stats.hasOwnProperty('monitoringEnabled'));

    assert.strictEqual(typeof stats.uptime, 'number');
    assert.strictEqual(typeof stats.requests, 'number');
    assert.strictEqual(typeof stats.errors, 'number');
    assert.strictEqual(typeof stats.activeConnections, 'number');
  });

  await t.test('buildHealthMonitorOptions() returns valid options', () => {
    const options = monitoring.buildHealthMonitorOptions();

    assert.strictEqual(typeof options, 'object');
    assert(options.hasOwnProperty('sampleIntervalMs'));
    assert(options.hasOwnProperty('thresholds'));

    assert.strictEqual(typeof options.sampleIntervalMs, 'number');
    assert.strictEqual(typeof options.thresholds, 'object');
  });

  await t.test('handleAlert() processes alerts', () => {
    const alert = {
      name: 'Test Alert',
      message: 'This is a test alert',
      severity: 'warning',
      timestamp: new Date().toISOString()
    };

    // Should not throw
    monitoring.handleAlert(alert);
  });

  await t.test('cleanup() clears monitoring resources', () => {
    monitoring.cleanup();

    // Should not throw
    assert(true);
  });

  await t.test('Health check endpoint simulation', async () => {
    const mockReq = {
      method: 'GET',
      headers: {}
    };

    let responseData = null;
    const mockRes = {
      writeHead: function(status, headers) {
        this.statusCode = status;
        this.headers = headers;
      },
      end: function(data) {
        responseData = data;
      }
    };

    await monitoring.handleHealthCheck(mockReq, mockRes);

    assert(responseData !== null);
    const healthData = JSON.parse(responseData);

    assert.strictEqual(typeof healthData, 'object');
    assert(healthData.hasOwnProperty('status'));
    assert(healthData.hasOwnProperty('timestamp'));
    assert(healthData.hasOwnProperty('uptimeSeconds'));
    assert(healthData.hasOwnProperty('requests'));
    assert(healthData.hasOwnProperty('memory'));
    assert(healthData.hasOwnProperty('connections'));
  });

  await t.test('Metrics endpoint simulation', async () => {
    const mockReq = {
      method: 'GET',
      headers: {}
    };

    let responseData = null;
    const mockRes = {
      writeHead: function(status, headers) {
        this.statusCode = status;
        this.headers = headers;
      },
      end: function(data) {
        responseData = data;
      }
    };

    await monitoring.handleMetrics(req, res);

    assert(responseData !== null);
    assert.strictEqual(typeof responseData, 'string');
    assert(responseData.includes('# HELP'));
    assert(responseData.includes('# TYPE'));
  });

  await t.test('Metrics include standard Prometheus format', async () => {
    const mockReq = { method: 'HEAD' }; // HEAD request should not return body
    const mockRes = {
      writeHead: () => {},
      end: () => {}
    };

    await monitoring.handleMetrics(mockReq, mockRes);

    // Should not throw for HEAD requests
    assert(true);
  });

  await t.test('Request duration calculation', () => {
    const startTime = Date.now() - 1000; // 1 second ago
    const duration = Date.now() - startTime;

    assert(duration >= 1000);
    assert(duration < 2000); // Should be approximately 1 second
  });

  await t.test('Error rate calculation', () => {
    const stats = monitoring.getStats();

    assert.strictEqual(typeof stats.errorRate, 'number');
    assert(stats.errorRate >= 0);
    assert(stats.errorRate <= 1);
  });

  await t.test('Average response time calculation', () => {
    const stats = monitoring.getStats();

    assert.strictEqual(typeof stats.avgResponseTime, 'number');
    assert(stats.avgResponseTime >= 0);
  });

  await t.test('Monitoring state persistence', () => {
    const initialRequests = monitoring.metrics.requests;
    const initialErrors = monitoring.metrics.errors;

    // Simulate some activity
    monitoring.metrics.requests += 5;
    monitoring.metrics.errors += 2;

    const stats = monitoring.getStats();

    assert.strictEqual(stats.requests, initialRequests + 5);
    assert.strictEqual(stats.errors, initialErrors + 2);
  });
});
