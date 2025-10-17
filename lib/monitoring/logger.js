/**
 * Qui Browser - Advanced Logging System
 *
 * Structured logging with correlation IDs, log levels, and aggregation
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class Logger {
  constructor(config) {
    this.config = config;
    this.logLevel = this.parseLogLevel(config.logging?.level || 'info');
    this.logDirectory = config.logging?.directory || path.join(process.cwd(), 'logs');
    this.maxFileSize = config.logging?.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = config.logging?.maxFiles || 5;

    // Log buffers
    this.buffer = [];
    this.bufferSize = config.logging?.bufferSize || 100;
    this.flushInterval = config.logging?.flushInterval || 5000; // 5 seconds

    // Correlation ID tracking
    this.correlationIds = new Map();

    // Log levels
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };

    // Log formatters
    this.formatters = {
      json: this.formatJson.bind(this),
      text: this.formatText.bind(this),
      structured: this.formatStructured.bind(this)
    };

    this.format = config.logging?.format || 'json';

    // External integrations
    this.integrations = new Map();

    this.initialize();
  }

  async initialize() {
    // Ensure log directory exists
    await fs.mkdir(this.logDirectory, { recursive: true });

    // Set up periodic buffer flush
    setInterval(() => {
      this.flushBuffer();
    }, this.flushInterval);

    // Initialize integrations
    await this.initializeIntegrations();

    // Log startup
    this.info('Logger initialized', { component: 'logger' });
  }

  parseLogLevel(level) {
    const parsed = this.levels[level.toLowerCase()];
    return parsed !== undefined ? parsed : this.levels.info;
  }

  async initializeIntegrations() {
    // Winston-like transports
    if (this.config.logging?.transports?.console?.enabled !== false) {
      this.integrations.set('console', {
        type: 'transport',
        write: (entry) => {
          const output = this.formatters[this.format](entry);
          if (entry.level === 'error') {
            console.error(output);
          } else if (entry.level === 'warn') {
            console.warn(output);
          } else {
            console.log(output);
          }
        }
      });
    }

    // File transport
    if (this.config.logging?.transports?.file?.enabled !== false) {
      this.integrations.set('file', {
        type: 'transport',
        write: async (entry) => {
          await this.writeToFile(entry);
        }
      });
    }

    // Elasticsearch integration
    if (this.config.logging?.elasticsearch?.enabled) {
      this.integrations.set('elasticsearch', {
        type: 'transport',
        client: null, // Would initialize Elasticsearch client
        index: this.config.logging.elasticsearch.index || 'qui-browser-logs',
        write: async (entry) => {
          // Would send to Elasticsearch
          console.log('Elasticsearch:', entry);
        }
      });
    }

    // DataDog integration
    if (this.config.logging?.datadog?.enabled) {
      this.integrations.set('datadog', {
        type: 'transport',
        apiKey: this.config.logging.datadog.apiKey,
        write: async (entry) => {
          // Would send to DataDog
          console.log('DataDog:', entry);
        }
      });
    }
  }

  /**
   * Core logging methods
   */
  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  trace(message, meta = {}) {
    this.log('trace', message, meta);
  }

  log(level, message, meta = {}) {
    if (this.levels[level] > this.logLevel) return;

    const entry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      level,
      message,
      meta: {
        ...meta,
        correlationId: meta.correlationId || this.getCurrentCorrelationId(),
        component: meta.component || 'unknown',
        userId: meta.userId,
        sessionId: meta.sessionId,
        requestId: meta.requestId,
        ip: meta.ip,
        userAgent: meta.userAgent
      },
      process: {
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      },
      stack: level === 'error' ? this.getStackTrace() : undefined
    };

    // Add to buffer
    this.buffer.push(entry);

    // Flush immediately for errors
    if (level === 'error') {
      this.flushBuffer();
    }

    // Auto-flush if buffer is full
    if (this.buffer.length >= this.bufferSize) {
      this.flushBuffer();
    }
  }

  /**
   * Correlation ID management
   */
  generateCorrelationId() {
    return crypto.randomUUID();
  }

  setCorrelationId(id) {
    this.correlationIds.set(process.pid, id);
  }

  getCurrentCorrelationId() {
    return this.correlationIds.get(process.pid);
  }

  withCorrelationId(id, fn) {
    const previousId = this.getCurrentCorrelationId();
    this.setCorrelationId(id);

    try {
      return fn();
    } finally {
      if (previousId) {
        this.setCorrelationId(previousId);
      } else {
        this.correlationIds.delete(process.pid);
      }
    }
  }

  /**
   * Request logging middleware
   */
  requestLogger() {
    return (req, res, next) => {
      const correlationId = this.generateCorrelationId();
      const startTime = Date.now();

      // Set correlation ID for this request
      req.correlationId = correlationId;
      res.setHeader('X-Correlation-ID', correlationId);

      // Log request
      this.info('Request started', {
        correlationId,
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        component: 'http'
      });

      // Log response
      const originalSend = res.send;
      res.send = (body) => {
        const duration = Date.now() - startTime;

        this.info('Request completed', {
          correlationId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          responseSize: body ? Buffer.byteLength(body.toString()) : 0,
          component: 'http'
        });

        return originalSend.call(res, body);
      };

      next();
    };
  }

  /**
   * Performance logging
   */
  time(label, correlationId = null) {
    const startTime = process.hrtime.bigint();
    const id = correlationId || this.getCurrentCorrelationId();

    return {
      end: (additionalMeta = {}) => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

        this.info(`Timer: ${label}`, {
          correlationId: id,
          duration,
          label,
          component: 'performance',
          ...additionalMeta
        });

        return duration;
      }
    };
  }

  /**
   * Error logging with context
   */
  logError(error, context = {}) {
    const errorEntry = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      ...context
    };

    this.error('Application error', errorEntry);
  }

  /**
   * Security event logging
   */
  logSecurityEvent(event, details = {}) {
    this.warn(`Security event: ${event}`, {
      ...details,
      component: 'security',
      eventType: 'security'
    });
  }

  /**
   * Audit logging
   */
  logAudit(action, userId, details = {}) {
    this.info(`Audit: ${action}`, {
      userId,
      action,
      component: 'audit',
      eventType: 'audit',
      ...details
    });
  }

  /**
   * Business event logging
   */
  logBusinessEvent(event, data = {}) {
    this.info(`Business event: ${event}`, {
      ...data,
      component: 'business',
      eventType: 'business'
    });
  }

  /**
   * Flush buffered logs
   */
  async flushBuffer() {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    // Write to all configured transports
    const promises = [];

    for (const integration of this.integrations.values()) {
      if (integration.type === 'transport') {
        for (const entry of entries) {
          promises.push(integration.write(entry));
        }
      }
    }

    try {
      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to flush log buffer:', error);
      // Re-add entries to buffer for retry
      this.buffer.unshift(...entries);
    }
  }

  /**
   * Write to file with rotation
   */
  async writeToFile(entry) {
    const date = entry.timestamp.toISOString().split('T')[0];
    const logFile = path.join(this.logDirectory, `${date}.log`);

    try {
      // Check if file needs rotation
      let stats;
      try {
        stats = await fs.stat(logFile);
        if (stats.size > this.maxFileSize) {
          await this.rotateLogFile(logFile);
        }
      } catch (error) {
        // File doesn't exist, that's fine
      }

      // Append to file
      const output = this.formatters[this.format](entry) + '\n';
      await fs.appendFile(logFile, output);

    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  async rotateLogFile(logFile) {
    const baseName = path.basename(logFile, '.log');
    const dirName = path.dirname(logFile);

    // Move current file to .1
    const rotatedFile = path.join(dirName, `${baseName}.1.log`);
    try {
      await fs.rename(logFile, rotatedFile);
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }

    // Rotate existing numbered files
    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const currentFile = path.join(dirName, `${baseName}.${i}.log`);
      const nextFile = path.join(dirName, `${baseName}.${i + 1}.log`);

      try {
        await fs.rename(currentFile, nextFile);
      } catch (error) {
        // File might not exist, continue
      }
    }
  }

  /**
   * Log formatters
   */
  formatJson(entry) {
    return JSON.stringify(entry, null, 0);
  }

  formatText(entry) {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const correlationId = entry.meta.correlationId?.substring(0, 8) || '--------';
    const component = entry.meta.component?.padEnd(12) || 'unknown'.padEnd(12);

    return `${timestamp} ${level} [${correlationId}] ${component} ${entry.message}`;
  }

  formatStructured(entry) {
    const parts = [
      entry.timestamp.toISOString(),
      entry.level.toUpperCase(),
      `correlationId=${entry.meta.correlationId}`,
      `component=${entry.meta.component}`,
      entry.message
    ];

    if (entry.meta.userId) parts.push(`userId=${entry.meta.userId}`);
    if (entry.meta.sessionId) parts.push(`sessionId=${entry.meta.sessionId}`);

    return parts.join(' | ');
  }

  /**
   * Query logs
   */
  async queryLogs(options = {}) {
    const {
      startDate,
      endDate,
      level,
      component,
      correlationId,
      userId,
      limit = 100,
      offset = 0
    } = options;

    // This is a simplified implementation
    // In production, you'd query from Elasticsearch, database, etc.

    const matchingEntries = [];

    // Read from recent log files
    try {
      const files = await fs.readdir(this.logDirectory);
      const logFiles = files
        .filter(f => f.endsWith('.log'))
        .sort()
        .reverse()
        .slice(0, 7); // Last 7 days

      for (const file of logFiles) {
        const filePath = path.join(this.logDirectory, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.trim().split('\n');

        for (const line of lines) {
          try {
            const entry = JSON.parse(line);

            // Apply filters
            if (startDate && entry.timestamp < startDate) continue;
            if (endDate && entry.timestamp > endDate) continue;
            if (level && entry.level !== level) continue;
            if (component && entry.meta.component !== component) continue;
            if (correlationId && entry.meta.correlationId !== correlationId) continue;
            if (userId && entry.meta.userId !== userId) continue;

            matchingEntries.push(entry);
          } catch (error) {
            // Skip malformed lines
          }
        }
      }
    } catch (error) {
      console.error('Failed to query logs:', error);
    }

    // Sort by timestamp (newest first) and apply pagination
    return matchingEntries
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(offset, offset + limit);
  }

  /**
   * Get stack trace for errors
   */
  getStackTrace() {
    const error = new Error();
    return error.stack?.split('\n').slice(2) || []; // Remove first two lines
  }

  /**
   * Get logger statistics
   */
  getStats() {
    return {
      bufferSize: this.buffer.length,
      logLevel: Object.keys(this.levels).find(key => this.levels[key] === this.logLevel),
      integrations: Array.from(this.integrations.keys()),
      correlationIds: this.correlationIds.size,
      config: {
        format: this.format,
        directory: this.logDirectory,
        maxFileSize: this.maxFileSize,
        maxFiles: this.maxFiles,
        bufferSize: this.bufferSize,
        flushInterval: this.flushInterval
      }
    };
  }

  /**
   * Clean up resources
   */
  async destroy() {
    await this.flushBuffer();
    this.correlationIds.clear();
    this.integrations.clear();
  }
}

module.exports = Logger;
