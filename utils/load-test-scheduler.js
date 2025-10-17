/**
 * Load Testing Scheduler
 * Automated scheduled load tests
 * Priority: H035 from improvement backlog
 *
 * Features:
 * - Automated scheduled load testing
 * - Environment separation (validation/production)
 * - Incident detection (<15 minutes)
 * - Performance baseline tracking
 * - Cache hit rate monitoring
 * - Configurable test scenarios
 * - Result visualization
 *
 * @module utils/load-test-scheduler
 */

const http = require('http');
const https = require('https');
const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');

class LoadTestScheduler extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      baseUrl: options.baseUrl || 'http://localhost:3000',
      environment: options.environment || process.env.NODE_ENV || 'development',
      scheduleInterval: options.scheduleInterval || 3600000, // 1 hour
      reportDir: options.reportDir || './reports/load-tests',
      enableAutoSchedule: options.enableAutoSchedule !== false,
      incidentDetectionThreshold: options.incidentDetectionThreshold || 900000, // 15 minutes
      ...options
    };

    this.scheduleTimer = null;
    this.testHistory = [];
    this.baselines = new Map();

    this.init();
  }

  /**
   * Initialize load test scheduler
   */
  async init() {
    try {
      await fs.mkdir(this.options.reportDir, { recursive: true });
      await this.loadBaselines();
      await this.loadTestHistory();

      if (this.options.enableAutoSchedule) {
        this.startScheduler();
      }

      console.log(`[LoadTest] Scheduler initialized (environment: ${this.options.environment})`);
    } catch (error) {
      console.error('[LoadTest] Initialization failed:', error);
    }
  }

  /**
   * Start automatic scheduler
   */
  startScheduler() {
    if (this.scheduleTimer) return;

    console.log(`[LoadTest] Auto-schedule enabled (interval: ${this.options.scheduleInterval}ms)`);

    this.scheduleTimer = setInterval(async () => {
      try {
        await this.runScheduledTest();
      } catch (error) {
        console.error('[LoadTest] Scheduled test failed:', error);
      }
    }, this.options.scheduleInterval);
  }

  /**
   * Stop automatic scheduler
   */
  stopScheduler() {
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
      console.log('[LoadTest] Auto-schedule disabled');
    }
  }

  /**
   * Run scheduled test
   */
  async runScheduledTest() {
    console.log('[LoadTest] Running scheduled load test...');

    const scenarios = [
      { name: 'light_load', concurrency: 10, duration: 30000 },
      { name: 'medium_load', concurrency: 50, duration: 30000 },
      { name: 'peak_load', concurrency: 100, duration: 30000 }
    ];

    const results = [];

    for (const scenario of scenarios) {
      const result = await this.runLoadTest(scenario);
      results.push(result);

      // Check for incidents
      this.checkForIncidents(result);
    }

    await this.saveTestResults(results);
    await this.updateBaselines(results);

    this.emit('scheduledTestComplete', results);

    return results;
  }

  /**
   * Run load test
   * @param {Object} scenario - Test scenario
   * @returns {Promise<Object>} Test results
   */
  async runLoadTest(scenario) {
    const {
      name,
      concurrency = 10,
      duration = 30000,
      rampUp = 5000,
      endpoints = ['/']
    } = scenario;

    console.log(`[LoadTest] Starting scenario: ${name} (${concurrency} concurrent users, ${duration}ms)`);

    const startTime = Date.now();
    const results = {
      scenario: name,
      timestamp: startTime,
      environment: this.options.environment,
      config: { concurrency, duration, rampUp, endpoints },
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalDuration: 0,
        avgResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        requestsPerSecond: 0,
        errorsPerSecond: 0,
        percentiles: {
          p50: 0,
          p75: 0,
          p90: 0,
          p95: 0,
          p99: 0
        },
        cacheHitRate: 0,
        errorRate: 0
      },
      responseTimes: [],
      errors: [],
      incidents: []
    };

    // Calculate requests per user
    const requestsPerUser = Math.floor(duration / (1000 / concurrency));
    const rampUpPerUser = rampUp / concurrency;

    // Start concurrent users
    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      const delay = i * rampUpPerUser;
      workers.push(this.simulateUser(endpoints, duration, delay, results));
    }

    // Wait for all workers to complete
    await Promise.all(workers);

    // Calculate final metrics
    const totalDuration = Date.now() - startTime;
    results.metrics.totalDuration = totalDuration;
    results.metrics.avgResponseTime =
      results.responseTimes.length > 0
        ? results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length
        : 0;
    results.metrics.requestsPerSecond = (results.metrics.totalRequests / totalDuration) * 1000;
    results.metrics.errorsPerSecond = (results.metrics.failedRequests / totalDuration) * 1000;
    results.metrics.errorRate =
      results.metrics.totalRequests > 0
        ? (results.metrics.failedRequests / results.metrics.totalRequests) * 100
        : 0;

    // Calculate percentiles
    if (results.responseTimes.length > 0) {
      const sorted = results.responseTimes.sort((a, b) => a - b);
      results.metrics.minResponseTime = sorted[0];
      results.metrics.maxResponseTime = sorted[sorted.length - 1];
      results.metrics.percentiles.p50 = this.getPercentile(sorted, 0.5);
      results.metrics.percentiles.p75 = this.getPercentile(sorted, 0.75);
      results.metrics.percentiles.p90 = this.getPercentile(sorted, 0.9);
      results.metrics.percentiles.p95 = this.getPercentile(sorted, 0.95);
      results.metrics.percentiles.p99 = this.getPercentile(sorted, 0.99);
    }

    console.log(`[LoadTest] Scenario ${name} complete:`, {
      totalRequests: results.metrics.totalRequests,
      successRate: (100 - results.metrics.errorRate).toFixed(2) + '%',
      avgResponseTime: results.metrics.avgResponseTime.toFixed(2) + 'ms',
      requestsPerSecond: results.metrics.requestsPerSecond.toFixed(2)
    });

    return results;
  }

  /**
   * Simulate user making requests
   * @param {Array} endpoints - Endpoints to test
   * @param {number} duration - Test duration
   * @param {number} delay - Initial delay
   * @param {Object} results - Results object to update
   */
  async simulateUser(endpoints, duration, delay, results) {
    // Wait for ramp-up delay
    await this.sleep(delay);

    const endTime = Date.now() + duration - delay;

    while (Date.now() < endTime) {
      // Select random endpoint
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

      try {
        const startTime = Date.now();
        const response = await this.makeRequest(endpoint);
        const responseTime = Date.now() - startTime;

        results.metrics.totalRequests++;
        results.responseTimes.push(responseTime);

        if (response.statusCode >= 200 && response.statusCode < 400) {
          results.metrics.successfulRequests++;

          // Check for cache hit
          if (response.headers['x-cache-hit'] === 'true') {
            results.metrics.cacheHitRate++;
          }
        } else {
          results.metrics.failedRequests++;
          results.errors.push({
            endpoint,
            statusCode: response.statusCode,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        results.metrics.totalRequests++;
        results.metrics.failedRequests++;
        results.errors.push({
          endpoint,
          error: error.message,
          timestamp: Date.now()
        });
      }

      // Small delay between requests
      await this.sleep(100 + Math.random() * 200);
    }
  }

  /**
   * Make HTTP request
   * @param {string} path - URL path
   * @returns {Promise<Object>} Response
   */
  async makeRequest(path) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.options.baseUrl);
      const protocol = url.protocol === 'https:' ? https : http;

      const req = protocol.get(url, (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body
          });
        });
      });

      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
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
   * Sleep for specified duration
   * @param {number} ms - Milliseconds
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check for incidents in test results
   * @param {Object} results - Test results
   */
  checkForIncidents(results) {
    const incidents = [];

    // High error rate
    if (results.metrics.errorRate > 5) {
      incidents.push({
        type: 'high_error_rate',
        severity: 'critical',
        value: results.metrics.errorRate,
        threshold: 5,
        message: `Error rate ${results.metrics.errorRate.toFixed(2)}% exceeds threshold of 5%`
      });
    }

    // High response time
    if (results.metrics.avgResponseTime > 2000) {
      incidents.push({
        type: 'high_response_time',
        severity: 'warning',
        value: results.metrics.avgResponseTime,
        threshold: 2000,
        message: `Average response time ${results.metrics.avgResponseTime.toFixed(0)}ms exceeds threshold of 2000ms`
      });
    }

    // P95 response time
    if (results.metrics.percentiles.p95 > 5000) {
      incidents.push({
        type: 'high_p95_response_time',
        severity: 'warning',
        value: results.metrics.percentiles.p95,
        threshold: 5000,
        message: `P95 response time ${results.metrics.percentiles.p95.toFixed(0)}ms exceeds threshold of 5000ms`
      });
    }

    // Low throughput
    if (results.metrics.requestsPerSecond < 10) {
      incidents.push({
        type: 'low_throughput',
        severity: 'warning',
        value: results.metrics.requestsPerSecond,
        threshold: 10,
        message: `Requests per second ${results.metrics.requestsPerSecond.toFixed(2)} below threshold of 10`
      });
    }

    // Compare with baseline
    const baseline = this.baselines.get(results.scenario);
    if (baseline) {
      // Response time regression
      if (results.metrics.avgResponseTime > baseline.avgResponseTime * 1.35) {
        incidents.push({
          type: 'response_time_regression',
          severity: 'warning',
          value: results.metrics.avgResponseTime,
          baseline: baseline.avgResponseTime,
          regression: ((results.metrics.avgResponseTime / baseline.avgResponseTime - 1) * 100).toFixed(2),
          message: `Response time regressed by ${((results.metrics.avgResponseTime / baseline.avgResponseTime - 1) * 100).toFixed(2)}% from baseline`
        });
      }

      // Throughput regression
      if (results.metrics.requestsPerSecond < baseline.requestsPerSecond * 0.65) {
        incidents.push({
          type: 'throughput_regression',
          severity: 'warning',
          value: results.metrics.requestsPerSecond,
          baseline: baseline.requestsPerSecond,
          regression: ((1 - results.metrics.requestsPerSecond / baseline.requestsPerSecond) * 100).toFixed(2),
          message: `Throughput regressed by ${((1 - results.metrics.requestsPerSecond / baseline.requestsPerSecond) * 100).toFixed(2)}% from baseline`
        });
      }
    }

    results.incidents = incidents;

    if (incidents.length > 0) {
      console.warn(`[LoadTest] ${incidents.length} incidents detected in ${results.scenario}`);
      this.emit('incidentsDetected', { scenario: results.scenario, incidents });
    }
  }

  /**
   * Save test results
   * @param {Array} results - Test results
   */
  async saveTestResults(results) {
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const filename = `load-test-${this.options.environment}-${timestamp}.json`;
    const filepath = path.join(this.options.reportDir, filename);

    const report = {
      timestamp: new Date().toISOString(),
      environment: this.options.environment,
      results
    };

    await fs.writeFile(filepath, JSON.stringify(report, null, 2), 'utf8');

    console.log(`[LoadTest] Results saved to ${filename}`);

    // Add to history
    this.testHistory.push({
      timestamp: Date.now(),
      file: filename,
      summary: results.map(r => ({
        scenario: r.scenario,
        requestsPerSecond: r.metrics.requestsPerSecond,
        avgResponseTime: r.metrics.avgResponseTime,
        errorRate: r.metrics.errorRate,
        incidentCount: r.incidents.length
      }))
    });

    await this.saveTestHistory();
  }

  /**
   * Update performance baselines
   * @param {Array} results - Test results
   */
  async updateBaselines(results) {
    for (const result of results) {
      const existing = this.baselines.get(result.scenario);

      if (!existing || result.metrics.errorRate < 1) {
        // Update baseline if this is better
        this.baselines.set(result.scenario, {
          timestamp: result.timestamp,
          avgResponseTime: result.metrics.avgResponseTime,
          requestsPerSecond: result.metrics.requestsPerSecond,
          errorRate: result.metrics.errorRate,
          p95: result.metrics.percentiles.p95
        });
      }
    }

    await this.saveBaselines();
  }

  /**
   * Load baselines from disk
   */
  async loadBaselines() {
    const filepath = path.join(this.options.reportDir, 'baselines.json');

    try {
      const content = await fs.readFile(filepath, 'utf8');
      const data = JSON.parse(content);

      for (const [scenario, baseline] of Object.entries(data.baselines)) {
        this.baselines.set(scenario, baseline);
      }

      console.log(`[LoadTest] Loaded ${this.baselines.size} baselines`);
    } catch (error) {
      console.log('[LoadTest] No baselines found');
    }
  }

  /**
   * Save baselines to disk
   */
  async saveBaselines() {
    const filepath = path.join(this.options.reportDir, 'baselines.json');

    const data = {
      version: '1.0',
      updated: new Date().toISOString(),
      baselines: Object.fromEntries(this.baselines)
    };

    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * Load test history from disk
   */
  async loadTestHistory() {
    const filepath = path.join(this.options.reportDir, 'test-history.json');

    try {
      const content = await fs.readFile(filepath, 'utf8');
      const data = JSON.parse(content);

      this.testHistory = data.history || [];

      console.log(`[LoadTest] Loaded ${this.testHistory.length} test history entries`);
    } catch (error) {
      console.log('[LoadTest] No test history found');
    }
  }

  /**
   * Save test history to disk
   */
  async saveTestHistory() {
    const filepath = path.join(this.options.reportDir, 'test-history.json');

    const data = {
      version: '1.0',
      updated: new Date().toISOString(),
      history: this.testHistory.slice(-100) // Keep last 100 entries
    };

    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * Get performance summary
   * @returns {Object} Summary
   */
  getSummary() {
    return {
      environment: this.options.environment,
      totalTests: this.testHistory.length,
      baselines: Array.from(this.baselines.entries()).map(([scenario, baseline]) => ({
        scenario,
        avgResponseTime: baseline.avgResponseTime,
        requestsPerSecond: baseline.requestsPerSecond,
        errorRate: baseline.errorRate,
        lastUpdated: new Date(baseline.timestamp).toISOString()
      })),
      recentTests: this.testHistory.slice(-5)
    };
  }

  /**
   * Shutdown scheduler
   */
  async shutdown() {
    console.log('[LoadTest] Shutting down...');

    this.stopScheduler();
    await this.saveBaselines();
    await this.saveTestHistory();

    console.log('[LoadTest] Shutdown complete');
  }
}

module.exports = LoadTestScheduler;
