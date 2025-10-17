/**
 * Error Report Portal
 * Centralized error collection, analysis, and reporting system
 * Priority: H009 from improvement backlog
 *
 * @module utils/error-reporter
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ErrorReporter {
  constructor(options = {}) {
    this.options = {
      reportDir: options.reportDir || './reports/errors',
      maxReports: options.maxReports || 10000,
      groupingEnabled: options.groupingEnabled !== false,
      notificationCallbacks: options.notificationCallbacks || [],
      severityLevels: options.severityLevels || ['critical', 'error', 'warning', 'info'],
      enableStackTrace: options.enableStackTrace !== false,
      enableContext: options.enableContext !== false,
      autoCleanupDays: options.autoCleanupDays || 30,
      ...options
    };

    this.errors = new Map();
    this.errorGroups = new Map();
    this.stats = {
      totalErrors: 0,
      bySeverity: {},
      byType: {},
      byPath: {}
    };

    // Initialize stats
    this.options.severityLevels.forEach(level => {
      this.stats.bySeverity[level] = 0;
    });

    this.init();
  }

  /**
   * Initialize error reporter
   */
  async init() {
    try {
      await fs.mkdir(this.options.reportDir, { recursive: true });
      await this.loadExistingReports();
      this.startAutoCleanup();
    } catch (error) {
      console.error('[ErrorReporter] Initialization failed:', error);
    }
  }

  /**
   * Report an error
   * @param {Error|Object} error - Error object or error details
   * @param {Object} context - Additional context
   * @returns {string} Error ID
   */
  async report(error, context = {}) {
    const errorReport = this.createErrorReport(error, context);
    const errorId = errorReport.id;

    // Store in memory
    this.errors.set(errorId, errorReport);

    // Update statistics
    this.updateStats(errorReport);

    // Group similar errors
    if (this.options.groupingEnabled) {
      this.groupError(errorReport);
    }

    // Persist to disk
    await this.saveReport(errorReport);

    // Trigger notifications
    await this.notify(errorReport);

    // Cleanup if needed
    if (this.errors.size > this.options.maxReports) {
      await this.cleanup();
    }

    return errorId;
  }

  /**
   * Create error report object
   * @param {Error|Object} error - Error
   * @param {Object} context - Context
   * @returns {Object} Error report
   */
  createErrorReport(error, context) {
    const timestamp = Date.now();
    const errorId = this.generateErrorId(error, timestamp);

    const report = {
      id: errorId,
      timestamp,
      datetime: new Date(timestamp).toISOString(),
      severity: this.determineSeverity(error, context),
      type: error.name || 'Error',
      message: error.message || String(error),
      code: error.code || null,
      statusCode: error.statusCode || error.status || null
    };

    // Stack trace
    if (this.options.enableStackTrace && error.stack) {
      report.stack = this.parseStackTrace(error.stack);
      report.stackString = error.stack;
    }

    // Context information
    if (this.options.enableContext) {
      report.context = {
        ...context,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      };

      // Request context (if available)
      if (context.req) {
        report.request = this.extractRequestInfo(context.req);
      }

      // User context (if available)
      if (context.user) {
        report.user = this.sanitizeUserInfo(context.user);
      }
    }

    // Additional properties from error object
    const additionalProps = Object.keys(error).filter(
      key => !['name', 'message', 'stack', 'code'].includes(key)
    );

    if (additionalProps.length > 0) {
      report.additional = {};
      additionalProps.forEach(key => {
        report.additional[key] = error[key];
      });
    }

    return report;
  }

  /**
   * Generate unique error ID
   * @param {Error} error - Error object
   * @param {number} timestamp - Timestamp
   * @returns {string} Error ID
   */
  generateErrorId(error, timestamp) {
    const hash = crypto
      .createHash('sha256')
      .update(`${error.message}${error.stack}${timestamp}`)
      .digest('hex')
      .substring(0, 16);

    return `err_${timestamp}_${hash}`;
  }

  /**
   * Determine error severity
   * @param {Error} error - Error object
   * @param {Object} context - Context
   * @returns {string} Severity level
   */
  determineSeverity(error, context) {
    // Explicit severity
    if (context.severity) {
      return context.severity;
    }

    // Critical errors
    if (error.name === 'FatalError' || error.fatal) {
      return 'critical';
    }

    // HTTP errors
    if (error.statusCode >= 500) {
      return 'critical';
    }

    if (error.statusCode >= 400) {
      return 'error';
    }

    // Known error types
    const criticalTypes = ['TypeError', 'ReferenceError', 'SyntaxError'];
    if (criticalTypes.includes(error.name)) {
      return 'error';
    }

    // Default
    return error.name === 'Warning' ? 'warning' : 'error';
  }

  /**
   * Parse stack trace
   * @param {string} stack - Stack trace string
   * @returns {Array} Parsed stack frames
   */
  parseStackTrace(stack) {
    const frames = [];
    const lines = stack.split('\n').slice(1); // Skip first line (error message)

    for (const line of lines) {
      const match = line.trim().match(/^at\s+(.+?)\s+\((.+):(\d+):(\d+)\)$/);
      if (match) {
        frames.push({
          function: match[1],
          file: match[2],
          line: parseInt(match[3]),
          column: parseInt(match[4])
        });
      } else {
        const simpleMatch = line.trim().match(/^at\s+(.+):(\d+):(\d+)$/);
        if (simpleMatch) {
          frames.push({
            function: '(anonymous)',
            file: simpleMatch[1],
            line: parseInt(simpleMatch[2]),
            column: parseInt(simpleMatch[3])
          });
        }
      }
    }

    return frames;
  }

  /**
   * Extract request information
   * @param {Object} req - Request object
   * @returns {Object} Sanitized request info
   */
  extractRequestInfo(req) {
    return {
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      headers: this.sanitizeHeaders(req.headers),
      ip: req.ip,
      userAgent: req.get('user-agent')
    };
  }

  /**
   * Sanitize headers (remove sensitive data)
   * @param {Object} headers - Request headers
   * @returns {Object} Sanitized headers
   */
  sanitizeHeaders(headers) {
    const sensitive = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    const sanitized = { ...headers };

    sensitive.forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Sanitize user information
   * @param {Object} user - User object
   * @returns {Object} Sanitized user info
   */
  sanitizeUserInfo(user) {
    return {
      id: user.id,
      username: user.username,
      email: user.email ? this.maskEmail(user.email) : null,
      roles: user.roles
    };
  }

  /**
   * Mask email address
   * @param {string} email - Email address
   * @returns {string} Masked email
   */
  maskEmail(email) {
    const [local, domain] = email.split('@');
    const maskedLocal = local.substring(0, 2) + '***';
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Update statistics
   * @param {Object} errorReport - Error report
   */
  updateStats(errorReport) {
    this.stats.totalErrors++;

    // By severity
    if (this.stats.bySeverity[errorReport.severity] !== undefined) {
      this.stats.bySeverity[errorReport.severity]++;
    }

    // By type
    if (!this.stats.byType[errorReport.type]) {
      this.stats.byType[errorReport.type] = 0;
    }
    this.stats.byType[errorReport.type]++;

    // By path (if request context available)
    if (errorReport.request && errorReport.request.path) {
      const path = errorReport.request.path;
      if (!this.stats.byPath[path]) {
        this.stats.byPath[path] = 0;
      }
      this.stats.byPath[path]++;
    }
  }

  /**
   * Group similar errors
   * @param {Object} errorReport - Error report
   */
  groupError(errorReport) {
    const groupKey = this.generateGroupKey(errorReport);

    if (!this.errorGroups.has(groupKey)) {
      this.errorGroups.set(groupKey, {
        key: groupKey,
        type: errorReport.type,
        message: errorReport.message,
        firstSeen: errorReport.timestamp,
        lastSeen: errorReport.timestamp,
        count: 0,
        errors: []
      });
    }

    const group = this.errorGroups.get(groupKey);
    group.count++;
    group.lastSeen = errorReport.timestamp;
    group.errors.push(errorReport.id);

    // Keep only last 100 error IDs per group
    if (group.errors.length > 100) {
      group.errors = group.errors.slice(-100);
    }
  }

  /**
   * Generate group key for similar errors
   * @param {Object} errorReport - Error report
   * @returns {string} Group key
   */
  generateGroupKey(errorReport) {
    // Group by type and first stack frame location
    const firstFrame = errorReport.stack?.[0];
    const location = firstFrame
      ? `${firstFrame.file}:${firstFrame.line}`
      : 'unknown';

    return crypto
      .createHash('md5')
      .update(`${errorReport.type}:${errorReport.message}:${location}`)
      .digest('hex');
  }

  /**
   * Save error report to disk
   * @param {Object} errorReport - Error report
   */
  async saveReport(errorReport) {
    try {
      const date = new Date(errorReport.timestamp);
      const dateDir = path.join(
        this.options.reportDir,
        date.getFullYear().toString(),
        (date.getMonth() + 1).toString().padStart(2, '0'),
        date.getDate().toString().padStart(2, '0')
      );

      await fs.mkdir(dateDir, { recursive: true });

      const filename = `${errorReport.id}.json`;
      const filepath = path.join(dateDir, filename);

      await fs.writeFile(filepath, JSON.stringify(errorReport, null, 2), 'utf8');
    } catch (error) {
      console.error('[ErrorReporter] Failed to save report:', error);
    }
  }

  /**
   * Load existing reports
   */
  async loadExistingReports() {
    // Implement if needed - loads recent reports from disk
    // For now, start fresh on each restart
  }

  /**
   * Notify about error
   * @param {Object} errorReport - Error report
   */
  async notify(errorReport) {
    for (const callback of this.options.notificationCallbacks) {
      try {
        await callback(errorReport);
      } catch (error) {
        console.error('[ErrorReporter] Notification callback failed:', error);
      }
    }
  }

  /**
   * Get error by ID
   * @param {string} errorId - Error ID
   * @returns {Object|null} Error report
   */
  getError(errorId) {
    return this.errors.get(errorId) || null;
  }

  /**
   * Get errors by filter
   * @param {Object} filter - Filter criteria
   * @returns {Array} Filtered errors
   */
  getErrors(filter = {}) {
    let errors = Array.from(this.errors.values());

    if (filter.severity) {
      errors = errors.filter(e => e.severity === filter.severity);
    }

    if (filter.type) {
      errors = errors.filter(e => e.type === filter.type);
    }

    if (filter.startTime) {
      errors = errors.filter(e => e.timestamp >= filter.startTime);
    }

    if (filter.endTime) {
      errors = errors.filter(e => e.timestamp <= filter.endTime);
    }

    if (filter.limit) {
      errors = errors.slice(0, filter.limit);
    }

    return errors;
  }

  /**
   * Get error groups
   * @returns {Array} Error groups
   */
  getGroups() {
    return Array.from(this.errorGroups.values())
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get statistics
   * @returns {Object} Error statistics
   */
  getStats() {
    return {
      ...this.stats,
      groups: this.errorGroups.size,
      topErrors: this.getTopErrors(10),
      topPaths: this.getTopPaths(10)
    };
  }

  /**
   * Get top errors by type
   * @param {number} limit - Number of results
   * @returns {Array} Top errors
   */
  getTopErrors(limit = 10) {
    return Object.entries(this.stats.byType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([type, count]) => ({ type, count }));
  }

  /**
   * Get top error paths
   * @param {number} limit - Number of results
   * @returns {Array} Top paths
   */
  getTopPaths(limit = 10) {
    return Object.entries(this.stats.byPath)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([path, count]) => ({ path, count }));
  }

  /**
   * Cleanup old errors
   */
  async cleanup() {
    // Remove oldest errors if over limit
    const errors = Array.from(this.errors.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    const toRemove = errors.length - this.options.maxReports;
    if (toRemove > 0) {
      for (let i = 0; i < toRemove; i++) {
        this.errors.delete(errors[i][0]);
      }
    }
  }

  /**
   * Start automatic cleanup of old reports
   */
  startAutoCleanup() {
    // Run cleanup daily
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupOldReports();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Cleanup old report files
   */
  async cleanupOldReports() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.options.autoCleanupDays);

      // Implement directory traversal and cleanup
      // (simplified version - full implementation would recursively clean directories)
    } catch (error) {
      console.error('[ErrorReporter] Cleanup failed:', error);
    }
  }

  /**
   * Stop auto cleanup
   */
  stopAutoCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Generate HTML report
   * @returns {string} HTML report
   */
  generateHTMLReport() {
    const stats = this.getStats();
    const groups = this.getGroups();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Error Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
    h1 { color: #d32f2f; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
    .stat-card { background: #f5f5f5; padding: 15px; border-radius: 4px; }
    .stat-value { font-size: 32px; font-weight: bold; }
    .stat-label { color: #666; font-size: 14px; }
    .severity { display: inline-block; padding: 4px 8px; border-radius: 3px; font-size: 12px; font-weight: bold; }
    .severity.critical { background: #d32f2f; color: white; }
    .severity.error { background: #f44336; color: white; }
    .severity.warning { background: #ff9800; color: white; }
    .severity.info { background: #2196f3; color: white; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Error Report</h1>
    <p>Generated: ${new Date().toISOString()}</p>

    <h2>Statistics</h2>
    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${stats.totalErrors}</div>
        <div class="stat-label">Total Errors</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.bySeverity.critical || 0}</div>
        <div class="stat-label">Critical</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.bySeverity.error || 0}</div>
        <div class="stat-label">Errors</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.groups}</div>
        <div class="stat-label">Error Groups</div>
      </div>
    </div>

    <h2>Error Groups</h2>
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Message</th>
          <th>Count</th>
          <th>First Seen</th>
          <th>Last Seen</th>
        </tr>
      </thead>
      <tbody>
        ${groups.slice(0, 20).map(group => `
          <tr>
            <td>${group.type}</td>
            <td>${group.message}</td>
            <td>${group.count}</td>
            <td>${new Date(group.firstSeen).toLocaleString()}</td>
            <td>${new Date(group.lastSeen).toLocaleString()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h2>Top Error Types</h2>
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Count</th>
        </tr>
      </thead>
      <tbody>
        ${stats.topErrors.map(item => `
          <tr>
            <td>${item.type}</td>
            <td>${item.count}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;
  }

  /**
   * Create Express middleware for error reporting
   * @returns {Function} Express error middleware
   */
  middleware() {
    return async (err, req, res, next) => {
      await this.report(err, { req });

      // Don't interfere with error handling
      next(err);
    };
  }
}

module.exports = ErrorReporter;
