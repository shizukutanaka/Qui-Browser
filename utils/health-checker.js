/**
 * Advanced Health Check System
 * Production-grade health monitoring with dependency verification
 *
 * @module utils/health-checker
 */

const fs = require('fs');
const http = require('http');
const https = require('https');

/**
 * Health status levels
 * @enum {string}
 */
const HealthStatus = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy'
};

/**
 * Health Check Manager
 * Comprehensive health monitoring with dependency checks
 *
 * @class HealthChecker
 * @description Provides detailed health checks for:
 * - System resources (CPU, memory, disk)
 * - External dependencies (databases, APIs, services)
 * - Internal components
 * - Performance metrics
 */
class HealthChecker {
  /**
   * Create health checker
   * @param {Object} options - Configuration options
   * @param {number} [options.checkInterval=30000] - Check interval (ms)
   * @param {number} [options.timeout=5000] - Dependency check timeout (ms)
   * @param {Object} [options.thresholds] - Health thresholds
   */
  constructor(options = {}) {
    this.checkInterval = options.checkInterval || 30000;
    this.timeout = options.timeout || 5000;
    this.thresholds = {
      memory: options.thresholds?.memory || 0.9, // 90%
      cpu: options.thresholds?.cpu || 0.8, // 80%
      disk: options.thresholds?.disk || 0.9, // 90%
      eventLoop: options.thresholds?.eventLoop || 500, // 500ms
      ...options.thresholds
    };

    this.dependencies = new Map();
    this.components = new Map();
    this.healthHistory = [];
    this.maxHistorySize = 100;
    this.currentStatus = HealthStatus.HEALTHY;
    this.lastCheck = null;
    this.checkTimer = null;

    this.startTime = Date.now();
    this.checks = {
      total: 0,
      healthy: 0,
      degraded: 0,
      unhealthy: 0
    };
  }

  /**
   * Register external dependency
   * @param {string} name - Dependency name
   * @param {Function} checker - Async health check function
   * @param {Object} options - Check options
   * @param {boolean} [options.critical=true] - Is dependency critical
   * @param {number} [options.timeout] - Check timeout (ms)
   */
  registerDependency(name, checker, options = {}) {
    this.dependencies.set(name, {
      name,
      checker,
      critical: options.critical !== false,
      timeout: options.timeout || this.timeout,
      status: null,
      lastCheck: null,
      lastSuccess: null,
      lastFailure: null,
      consecutiveFailures: 0
    });
  }

  /**
   * Register internal component
   * @param {string} name - Component name
   * @param {Function} checker - Async health check function
   */
  registerComponent(name, checker) {
    this.components.set(name, {
      name,
      checker,
      status: null,
      lastCheck: null
    });
  }

  /**
   * Perform complete health check
   * @returns {Promise<Object>} - Health report
   */
  async check() {
    const startTime = Date.now();
    this.checks.total++;

    const results = {
      status: HealthStatus.HEALTHY,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      system: await this.checkSystem(),
      dependencies: await this.checkDependencies(),
      components: await this.checkComponents(),
      checks: { ...this.checks },
      duration: 0
    };

    // Determine overall status
    results.status = this.determineOverallStatus(results);
    this.currentStatus = results.status;
    this.lastCheck = Date.now();

    // Update statistics
    this.checks[results.status]++;

    // Store in history
    results.duration = Date.now() - startTime;
    this.addToHistory(results);

    return results;
  }

  /**
   * Check system resources
   * @private
   * @returns {Promise<Object>} - System health
   */
  async checkSystem() {
    const system = {
      memory: this.checkMemory(),
      eventLoop: await this.checkEventLoop(),
      process: this.checkProcess()
    };

    // Determine system status
    const issues = [];
    if (system.memory.usagePercent > this.thresholds.memory) {
      issues.push('High memory usage');
    }
    if (system.eventLoop.lag > this.thresholds.eventLoop) {
      issues.push('Event loop lag detected');
    }

    system.status = issues.length === 0 ? HealthStatus.HEALTHY : HealthStatus.DEGRADED;
    system.issues = issues;

    return system;
  }

  /**
   * Check memory usage
   * @private
   * @returns {Object} - Memory status
   */
  checkMemory() {
    const usage = process.memoryUsage();
    const total = usage.heapTotal;
    const used = usage.heapUsed;
    const external = usage.external;

    return {
      heapUsed: used,
      heapTotal: total,
      external,
      rss: usage.rss,
      usagePercent: total > 0 ? used / total : 0,
      available: total - used
    };
  }

  /**
   * Check event loop lag
   * @private
   * @returns {Promise<Object>} - Event loop status
   */
  async checkEventLoop() {
    const start = Date.now();
    await new Promise(resolve => setImmediate(resolve));
    const lag = Date.now() - start;

    return {
      lag,
      status: lag < this.thresholds.eventLoop ? 'normal' : 'lagging'
    };
  }

  /**
   * Check process information
   * @private
   * @returns {Object} - Process status
   */
  checkProcess() {
    return {
      pid: process.pid,
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };
  }

  /**
   * Check all dependencies
   * @private
   * @returns {Promise<Object>} - Dependencies health
   */
  async checkDependencies() {
    const results = {};
    let allHealthy = true;
    let anyCriticalDown = false;

    for (const [name, dep] of this.dependencies.entries()) {
      try {
        const checkResult = await this.runDependencyCheck(dep);
        results[name] = checkResult;

        if (checkResult.status !== HealthStatus.HEALTHY) {
          allHealthy = false;
          if (dep.critical) {
            anyCriticalDown = true;
          }
        }
      } catch (error) {
        results[name] = {
          status: HealthStatus.UNHEALTHY,
          error: error.message,
          critical: dep.critical
        };
        allHealthy = false;
        if (dep.critical) {
          anyCriticalDown = true;
        }
      }
    }

    return {
      status: anyCriticalDown
        ? HealthStatus.UNHEALTHY
        : allHealthy
          ? HealthStatus.HEALTHY
          : HealthStatus.DEGRADED,
      checks: results,
      total: this.dependencies.size,
      healthy: Object.values(results).filter(r => r.status === HealthStatus.HEALTHY).length
    };
  }

  /**
   * Run single dependency check
   * @private
   * @param {Object} dep - Dependency config
   * @returns {Promise<Object>} - Check result
   */
  async runDependencyCheck(dep) {
    const startTime = Date.now();

    try {
      const result = await this.withTimeout(dep.checker(), dep.timeout);

      dep.lastCheck = Date.now();
      dep.lastSuccess = Date.now();
      dep.consecutiveFailures = 0;
      dep.status = HealthStatus.HEALTHY;

      return {
        status: HealthStatus.HEALTHY,
        latency: Date.now() - startTime,
        critical: dep.critical,
        lastSuccess: dep.lastSuccess,
        ...result
      };
    } catch (error) {
      dep.lastCheck = Date.now();
      dep.lastFailure = Date.now();
      dep.consecutiveFailures++;
      dep.status = HealthStatus.UNHEALTHY;

      return {
        status: HealthStatus.UNHEALTHY,
        error: error.message,
        critical: dep.critical,
        consecutiveFailures: dep.consecutiveFailures,
        lastFailure: dep.lastFailure
      };
    }
  }

  /**
   * Check all components
   * @private
   * @returns {Promise<Object>} - Components health
   */
  async checkComponents() {
    const results = {};
    let allHealthy = true;

    for (const [name, comp] of this.components.entries()) {
      try {
        const result = await comp.checker();
        results[name] = {
          status: result.healthy ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
          ...result
        };

        if (!result.healthy) {
          allHealthy = false;
        }

        comp.lastCheck = Date.now();
        comp.status = results[name].status;
      } catch (error) {
        results[name] = {
          status: HealthStatus.UNHEALTHY,
          error: error.message
        };
        allHealthy = false;
      }
    }

    return {
      status: allHealthy ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
      checks: results,
      total: this.components.size
    };
  }

  /**
   * Determine overall health status
   * @private
   * @param {Object} results - Check results
   * @returns {HealthStatus} - Overall status
   */
  determineOverallStatus(results) {
    // Critical dependency down = unhealthy
    if (results.dependencies.status === HealthStatus.UNHEALTHY) {
      return HealthStatus.UNHEALTHY;
    }

    // System issues or non-critical deps down = degraded
    if (
      results.system.status === HealthStatus.DEGRADED ||
      results.dependencies.status === HealthStatus.DEGRADED ||
      results.components.status === HealthStatus.DEGRADED
    ) {
      return HealthStatus.DEGRADED;
    }

    return HealthStatus.HEALTHY;
  }

  /**
   * Add check to history
   * @private
   * @param {Object} result - Check result
   */
  addToHistory(result) {
    this.healthHistory.push({
      timestamp: result.timestamp,
      status: result.status,
      duration: result.duration
    });

    // Trim history
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory.shift();
    }
  }

  /**
   * Start periodic health checks
   * @param {Function} [callback] - Callback for each check
   */
  startPeriodicChecks(callback) {
    this.stopPeriodicChecks();

    this.checkTimer = setInterval(async () => {
      try {
        const result = await this.check();
        if (callback) {
          callback(result);
        }
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, this.checkInterval);
  }

  /**
   * Stop periodic health checks
   */
  stopPeriodicChecks() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * Get current health status
   * @returns {HealthStatus} - Current status
   */
  getStatus() {
    return this.currentStatus;
  }

  /**
   * Get health history
   * @returns {Array<Object>} - Health history
   */
  getHistory() {
    return [...this.healthHistory];
  }

  /**
   * Get health statistics
   * @returns {Object} - Statistics
   */
  getStatistics() {
    const history = this.healthHistory;
    const recentChecks = history.slice(-10);

    return {
      checks: { ...this.checks },
      uptime: Date.now() - this.startTime,
      lastCheck: this.lastCheck,
      currentStatus: this.currentStatus,
      successRate:
        this.checks.total > 0 ? this.checks.healthy / this.checks.total : 0,
      recentStatuses: recentChecks.map(h => h.status),
      averageDuration:
        recentChecks.length > 0
          ? recentChecks.reduce((sum, h) => sum + h.duration, 0) /
            recentChecks.length
          : 0
    };
  }

  /**
   * Run with timeout
   * @private
   * @param {Promise} promise - Promise to wrap
   * @param {number} timeout - Timeout in ms
   * @returns {Promise} - Promise with timeout
   */
  withTimeout(promise, timeout) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), timeout)
      )
    ]);
  }

  /**
   * Create HTTP dependency checker
   * @param {string} url - URL to check
   * @param {Object} [options] - Request options
   * @returns {Function} - Checker function
   */
  static createHttpChecker(url, options = {}) {
    return async () => {
      return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const lib = urlObj.protocol === 'https:' ? https : http;

        const req = lib.request(
          url,
          {
            method: options.method || 'GET',
            timeout: options.timeout || 5000
          },
          res => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ healthy: true, statusCode: res.statusCode });
            } else {
              reject(
                new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`)
              );
            }
            res.resume();
          }
        );

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        req.end();
      });
    };
  }

  /**
   * Create file system checker
   * @param {string} path - Path to check
   * @returns {Function} - Checker function
   */
  static createFileSystemChecker(path) {
    return async () => {
      return new Promise((resolve, reject) => {
        fs.access(path, fs.constants.R_OK | fs.constants.W_OK, err => {
          if (err) {
            reject(new Error(`Cannot access ${path}: ${err.message}`));
          } else {
            resolve({ healthy: true });
          }
        });
      });
    };
  }

  /**
   * Create memory checker
   * @param {number} maxPercent - Max memory percent (0-1)
   * @returns {Function} - Checker function
   */
  static createMemoryChecker(maxPercent = 0.9) {
    return async () => {
      const usage = process.memoryUsage();
      const percent = usage.heapUsed / usage.heapTotal;

      return {
        healthy: percent < maxPercent,
        memoryUsed: usage.heapUsed,
        memoryTotal: usage.heapTotal,
        percent
      };
    };
  }
}

module.exports = {
  HealthChecker,
  HealthStatus
};
