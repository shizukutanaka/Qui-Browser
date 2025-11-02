/**
 * VR Performance Metrics - Shared metrics collection
 * ==================================================
 * Centralizes performance tracking across all modules
 * Eliminates 100+ lines of duplicate metrics code in 8 modules
 *
 * Used by: All Phase 6 & 7 modules
 */

class VRPerformanceMetrics {
  constructor(moduleName = 'UnnamedModule') {
    this.moduleName = moduleName;
    this.metrics = {
      operationCount: 0,
      totalTime: 0,
      minTime: Infinity,
      maxTime: 0,
      successCount: 0,
      errorCount: 0,
      averageTime: 0,
      lastUpdate: Date.now(),
    };

    this.operationLog = [];
    this.maxLogSize = 100;
  }

  /**
   * Record a successful operation
   */
  recordOperation(operationName, duration) {
    this.metrics.operationCount++;
    this.metrics.totalTime += duration;
    this.metrics.minTime = Math.min(this.metrics.minTime, duration);
    this.metrics.maxTime = Math.max(this.metrics.maxTime, duration);
    this.metrics.successCount++;
    this.metrics.averageTime = this.metrics.totalTime / this.metrics.operationCount;
    this.metrics.lastUpdate = Date.now();

    this.logOperation(operationName, duration, 'success');
  }

  /**
   * Record an error
   */
  recordError(operationName, error) {
    this.metrics.errorCount++;
    this.metrics.operationCount++;
    this.logOperation(operationName, 0, 'error', error);
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    const successRate = this.metrics.operationCount > 0
      ? this.metrics.successCount / this.metrics.operationCount
      : 0;

    return {
      moduleName: this.moduleName,
      ...this.metrics,
      successRate: successRate,
      isHealthy: successRate > 0.95,
    };
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      operationCount: 0,
      totalTime: 0,
      minTime: Infinity,
      maxTime: 0,
      successCount: 0,
      errorCount: 0,
      averageTime: 0,
      lastUpdate: Date.now(),
    };
    this.operationLog = [];
  }

  /**
   * Get operation history
   */
  getOperationLog(limit = 20) {
    return {
      operations: this.operationLog.slice(-limit),
      total: this.operationLog.length,
    };
  }

  // Helper methods

  logOperation(operationName, duration, status, error = null) {
    const logEntry = {
      operation: operationName,
      duration: duration,
      status: status,
      timestamp: Date.now(),
      error: error ? error.message : null,
    };

    this.operationLog.push(logEntry);
    if (this.operationLog.length > this.maxLogSize) {
      this.operationLog.shift();
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRPerformanceMetrics;
}
