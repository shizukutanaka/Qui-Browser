/**
 * Comprehensive Audit Logging System
 * Government-level compliance audit logging
 *
 * @module utils/audit-logger
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Audit event types
 * @enum {string}
 */
const AuditEventType = {
  // Authentication events
  AUTH_LOGIN: 'AUTH_LOGIN',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  AUTH_FAILED: 'AUTH_FAILED',
  AUTH_TOKEN_CREATED: 'AUTH_TOKEN_CREATED',
  AUTH_TOKEN_REVOKED: 'AUTH_TOKEN_REVOKED',

  // Data access events
  DATA_READ: 'DATA_READ',
  DATA_CREATED: 'DATA_CREATED',
  DATA_UPDATED: 'DATA_UPDATED',
  DATA_DELETED: 'DATA_DELETED',
  DATA_EXPORTED: 'DATA_EXPORTED',

  // Security events
  SECURITY_BREACH_ATTEMPT: 'SECURITY_BREACH_ATTEMPT',
  SECURITY_RATE_LIMITED: 'SECURITY_RATE_LIMITED',
  SECURITY_IP_BLOCKED: 'SECURITY_IP_BLOCKED',
  SECURITY_SUSPICIOUS_ACTIVITY: 'SECURITY_SUSPICIOUS_ACTIVITY',

  // System events
  SYSTEM_STARTUP: 'SYSTEM_STARTUP',
  SYSTEM_SHUTDOWN: 'SYSTEM_SHUTDOWN',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  SYSTEM_CONFIG_CHANGED: 'SYSTEM_CONFIG_CHANGED',

  // Admin events
  ADMIN_ACCESS: 'ADMIN_ACCESS',
  ADMIN_CONFIG_CHANGED: 'ADMIN_CONFIG_CHANGED',
  ADMIN_USER_CREATED: 'ADMIN_USER_CREATED',
  ADMIN_USER_DELETED: 'ADMIN_USER_DELETED',
  ADMIN_PERMISSION_CHANGED: 'ADMIN_PERMISSION_CHANGED',

  // Payment events
  PAYMENT_INITIATED: 'PAYMENT_INITIATED',
  PAYMENT_COMPLETED: 'PAYMENT_COMPLETED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_REFUNDED: 'PAYMENT_REFUNDED',

  // API events
  API_REQUEST: 'API_REQUEST',
  API_ERROR: 'API_ERROR'
};

/**
 * Audit severity levels
 * @enum {string}
 */
const AuditSeverity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL'
};

/**
 * Comprehensive Audit Logger
 *
 * @class AuditLogger
 * @description Provides immutable, tamper-evident audit logging with:
 * - Structured JSON logging
 * - Cryptographic signatures for tamper detection
 * - Automatic log rotation
 * - Search and filtering capabilities
 * - Compliance with government standards
 */
class AuditLogger {
  /**
   * Create an audit logger
   * @param {Object} options - Configuration options
   * @param {string} [options.logDir='./logs/audit'] - Log directory
   * @param {string} [options.logPrefix='audit'] - Log file prefix
   * @param {number} [options.maxFileSize=10485760] - Max file size (10MB)
   * @param {number} [options.maxFiles=30] - Max number of log files
   * @param {boolean} [options.enableSignature=true] - Enable cryptographic signatures
   * @param {string} [options.signatureKey] - Key for signatures (auto-generated if not provided)
   * @param {boolean} [options.enableConsole=true] - Also log to console
   * @param {Array<string>} [options.sensitiveFields] - Fields to redact
   */
  constructor(options = {}) {
    this.logDir = options.logDir || './logs/audit';
    this.logPrefix = options.logPrefix || 'audit';
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 30;
    this.enableSignature = options.enableSignature !== false;
    this.signatureKey = options.signatureKey || crypto.randomBytes(32).toString('hex');
    this.enableConsole = options.enableConsole !== false;
    this.sensitiveFields = options.sensitiveFields || [
      'password',
      'token',
      'secret',
      'apiKey',
      'creditCard',
      'ssn',
      'authorization'
    ];

    this.currentLogFile = null;
    this.currentLogStream = null;
    this.sequenceNumber = 0;
    this.lastLogHash = null;

    // Create log directory
    this.ensureLogDirectory();
    this.initializeLogFile();
  }

  /**
   * Ensure log directory exists
   * @private
   */
  ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true, mode: 0o700 });
      }
    } catch (error) {
      console.error('Failed to create audit log directory:', error.message);
    }
  }

  /**
   * Initialize log file
   * @private
   */
  initializeLogFile() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.currentLogFile = path.join(this.logDir, `${this.logPrefix}-${timestamp}.jsonl`);

    try {
      this.currentLogStream = fs.createWriteStream(this.currentLogFile, {
        flags: 'a',
        mode: 0o600
      });

      this.currentLogStream.on('error', error => {
        console.error('Audit log stream error:', error.message);
      });
    } catch (error) {
      console.error('Failed to initialize audit log file:', error.message);
    }
  }

  /**
   * Log an audit event
   * @param {Object} event - Audit event
   * @param {AuditEventType} event.type - Event type
   * @param {AuditSeverity} [event.severity] - Event severity
   * @param {string} [event.userId] - User ID
   * @param {string} [event.sessionId] - Session ID
   * @param {string} [event.ip] - IP address
   * @param {string} [event.userAgent] - User agent
   * @param {string} [event.resource] - Resource accessed
   * @param {string} [event.action] - Action performed
   * @param {Object} [event.data] - Additional data
   * @param {string} [event.message] - Human-readable message
   * @param {Error} [event.error] - Error object
   */
  log(event) {
    try {
      const auditEntry = this.createAuditEntry(event);
      this.writeAuditEntry(auditEntry);

      if (this.enableConsole) {
        this.logToConsole(auditEntry);
      }

      // Check if log rotation needed
      this.checkLogRotation();
    } catch (error) {
      console.error('Failed to write audit log:', error.message);
    }
  }

  /**
   * Create structured audit entry
   * @private
   * @param {Object} event - Event data
   * @returns {Object} - Audit entry
   */
  createAuditEntry(event) {
    this.sequenceNumber++;

    const entry = {
      // Standard fields
      timestamp: new Date().toISOString(),
      sequence: this.sequenceNumber,
      type: event.type,
      severity: event.severity || AuditSeverity.INFO,

      // Identity fields
      userId: event.userId || null,
      sessionId: event.sessionId || null,
      ip: event.ip || null,
      userAgent: event.userAgent || null,

      // Action fields
      resource: event.resource || null,
      action: event.action || null,
      message: event.message || null,

      // Data fields (redacted)
      data: event.data ? this.redactSensitiveData(event.data) : null,

      // Error fields
      error: event.error
        ? {
            name: event.error.name,
            message: event.error.message,
            stack: event.error.stack
          }
        : null,

      // Chain integrity
      previousHash: this.lastLogHash
    };

    // Add signature
    if (this.enableSignature) {
      entry.signature = this.signEntry(entry);
    }

    // Update hash chain
    this.lastLogHash = this.hashEntry(entry);
    entry.hash = this.lastLogHash;

    return entry;
  }

  /**
   * Redact sensitive data from objects
   * @private
   * @param {*} data - Data to redact
   * @returns {*} - Redacted data
   */
  redactSensitiveData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.redactSensitiveData(item));
    }

    const redacted = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = this.sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()));

      if (isSensitive) {
        redacted[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        redacted[key] = this.redactSensitiveData(value);
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  /**
   * Sign audit entry
   * @private
   * @param {Object} entry - Audit entry
   * @returns {string} - Signature
   */
  signEntry(entry) {
    const data = JSON.stringify({
      timestamp: entry.timestamp,
      sequence: entry.sequence,
      type: entry.type,
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource,
      previousHash: entry.previousHash
    });

    return crypto.createHmac('sha256', this.signatureKey).update(data).digest('hex');
  }

  /**
   * Hash audit entry for chain integrity
   * @private
   * @param {Object} entry - Audit entry
   * @returns {string} - Hash
   */
  hashEntry(entry) {
    const data = JSON.stringify({
      timestamp: entry.timestamp,
      sequence: entry.sequence,
      type: entry.type,
      signature: entry.signature
    });

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Write audit entry to file
   * @private
   * @param {Object} entry - Audit entry
   */
  writeAuditEntry(entry) {
    if (!this.currentLogStream) {
      return;
    }

    const line = JSON.stringify(entry) + '\n';
    this.currentLogStream.write(line);
  }

  /**
   * Log to console
   * @private
   * @param {Object} entry - Audit entry
   */
  logToConsole(entry) {
    const level = entry.severity === AuditSeverity.ERROR || entry.severity === AuditSeverity.CRITICAL ? 'error' : 'log';

    console[level](
      `[AUDIT] ${entry.timestamp} [${entry.type}] [${entry.severity}]`,
      entry.message || '',
      entry.userId ? `user=${entry.userId}` : '',
      entry.ip ? `ip=${entry.ip}` : ''
    );
  }

  /**
   * Check if log rotation is needed
   * @private
   */
  checkLogRotation() {
    try {
      const stats = fs.statSync(this.currentLogFile);
      if (stats.size >= this.maxFileSize) {
        this.rotateLog();
      }
    } catch (error) {
      // File doesn't exist yet, ignore
    }
  }

  /**
   * Rotate log files
   * @private
   */
  rotateLog() {
    try {
      // Close current stream
      if (this.currentLogStream) {
        this.currentLogStream.end();
      }

      // Initialize new log file
      this.initializeLogFile();

      // Clean up old log files
      this.cleanupOldLogs();
    } catch (error) {
      console.error('Failed to rotate audit log:', error.message);
    }
  }

  /**
   * Clean up old log files
   * @private
   */
  cleanupOldLogs() {
    try {
      const files = fs
        .readdirSync(this.logDir)
        .filter(file => file.startsWith(this.logPrefix) && file.endsWith('.jsonl'))
        .map(file => ({
          name: file,
          path: path.join(this.logDir, file),
          time: fs.statSync(path.join(this.logDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      // Remove old files beyond maxFiles limit
      if (files.length > this.maxFiles) {
        for (let i = this.maxFiles; i < files.length; i++) {
          fs.unlinkSync(files[i].path);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old audit logs:', error.message);
    }
  }

  /**
   * Search audit logs
   * @param {Object} criteria - Search criteria
   * @param {string} [criteria.type] - Event type
   * @param {string} [criteria.userId] - User ID
   * @param {string} [criteria.ip] - IP address
   * @param {Date} [criteria.startDate] - Start date
   * @param {Date} [criteria.endDate] - End date
   * @param {number} [criteria.limit=100] - Max results
   * @returns {Array<Object>} - Matching audit entries
   */
  search(criteria = {}) {
    const results = [];
    const limit = criteria.limit || 100;

    try {
      const files = fs
        .readdirSync(this.logDir)
        .filter(file => file.startsWith(this.logPrefix) && file.endsWith('.jsonl'))
        .map(file => path.join(this.logDir, file))
        .sort()
        .reverse();

      for (const file of files) {
        if (results.length >= limit) {
          break;
        }

        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines.reverse()) {
          if (results.length >= limit) {
            break;
          }

          try {
            const entry = JSON.parse(line);

            if (this.matchesCriteria(entry, criteria)) {
              results.push(entry);
            }
          } catch (parseError) {
            // Skip invalid JSON lines
          }
        }
      }
    } catch (error) {
      console.error('Failed to search audit logs:', error.message);
    }

    return results;
  }

  /**
   * Check if entry matches search criteria
   * @private
   * @param {Object} entry - Audit entry
   * @param {Object} criteria - Search criteria
   * @returns {boolean} - True if matches
   */
  matchesCriteria(entry, criteria) {
    if (criteria.type && entry.type !== criteria.type) {
      return false;
    }

    if (criteria.userId && entry.userId !== criteria.userId) {
      return false;
    }

    if (criteria.ip && entry.ip !== criteria.ip) {
      return false;
    }

    if (criteria.severity && entry.severity !== criteria.severity) {
      return false;
    }

    if (criteria.startDate) {
      const entryDate = new Date(entry.timestamp);
      if (entryDate < criteria.startDate) {
        return false;
      }
    }

    if (criteria.endDate) {
      const entryDate = new Date(entry.timestamp);
      if (entryDate > criteria.endDate) {
        return false;
      }
    }

    return true;
  }

  /**
   * Verify log integrity
   * @param {string} [logFile] - Specific log file (or current if not specified)
   * @returns {Object} - Verification result
   */
  verifyIntegrity(logFile = null) {
    const file = logFile || this.currentLogFile;
    const result = {
      valid: true,
      errors: [],
      entriesChecked: 0
    };

    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      let previousHash = null;

      for (let i = 0; i < lines.length; i++) {
        try {
          const entry = JSON.parse(lines[i]);
          result.entriesChecked++;

          // Check hash chain
          if (entry.previousHash !== previousHash) {
            result.valid = false;
            result.errors.push(`Hash chain broken at sequence ${entry.sequence}`);
          }

          // Verify signature
          if (this.enableSignature && entry.signature) {
            const expectedSignature = this.signEntry(entry);
            if (entry.signature !== expectedSignature) {
              result.valid = false;
              result.errors.push(`Signature mismatch at sequence ${entry.sequence}`);
            }
          }

          previousHash = entry.hash;
        } catch (parseError) {
          result.valid = false;
          result.errors.push(`Invalid JSON at line ${i + 1}`);
        }
      }
    } catch (error) {
      result.valid = false;
      result.errors.push(`Failed to read log file: ${error.message}`);
    }

    return result;
  }

  /**
   * Close audit logger
   */
  close() {
    if (this.currentLogStream) {
      this.currentLogStream.end();
      this.currentLogStream = null;
    }
  }
}

module.exports = {
  AuditLogger,
  AuditEventType,
  AuditSeverity
};
