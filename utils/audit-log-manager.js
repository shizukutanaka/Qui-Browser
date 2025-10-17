/**
 * Audit Log Retention Extension
 * Extended audit log retention and searchability
 * Priority: H033 from improvement backlog
 *
 * Features:
 * - Extended retention periods for compliance
 * - High-performance search with indexing
 * - Environment separation (validation/production)
 * - Real-time incident detection (<15 minutes)
 * - Backup integrity verification
 * - Log compression and archival
 * - Query optimization
 *
 * @module utils/audit-log-manager
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');
const EventEmitter = require('events');

const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);

class AuditLogManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      logDir: options.logDir || './logs/audit',
      archiveDir: options.archiveDir || './logs/audit/archives',
      indexDir: options.indexDir || './logs/audit/indexes',
      environment: options.environment || process.env.NODE_ENV || 'development',
      retentionPeriod: options.retentionPeriod || 31536000000, // 365 days
      compressionEnabled: options.compressionEnabled !== false,
      indexingEnabled: options.indexingEnabled !== false,
      realTimeMonitoring: options.realTimeMonitoring !== false,
      incidentDetectionThreshold: options.incidentDetectionThreshold || 900000, // 15 minutes
      maxLogSize: options.maxLogSize || 104857600, // 100MB
      rotationInterval: options.rotationInterval || 86400000, // 24 hours
      ...options
    };

    this.currentLogFile = null;
    this.logBuffer = [];
    this.bufferSize = 0;
    this.maxBufferSize = 1000;
    this.flushInterval = 5000; // 5 seconds
    this.index = new Map();
    this.stats = {
      totalLogs: 0,
      totalSize: 0,
      archivedLogs: 0,
      searchQueries: 0,
      incidentsDetected: 0,
      lastRotation: null
    };

    this.init();
  }

  /**
   * Initialize audit log manager
   */
  async init() {
    try {
      await fs.mkdir(this.options.logDir, { recursive: true });
      await fs.mkdir(this.options.archiveDir, { recursive: true });
      await fs.mkdir(this.options.indexDir, { recursive: true });

      await this.loadIndex();
      await this.createNewLogFile();

      // Start buffer flush timer
      this.flushTimer = setInterval(() => this.flushBuffer(), this.flushInterval);

      // Start log rotation timer
      this.rotationTimer = setInterval(
        () => this.rotateLogsIfNeeded(),
        this.options.rotationInterval
      );

      // Start real-time monitoring
      if (this.options.realTimeMonitoring) {
        this.startRealTimeMonitoring();
      }

      console.log(`[AuditLog] Manager initialized (environment: ${this.options.environment})`);
    } catch (error) {
      console.error('[AuditLog] Initialization failed:', error);
    }
  }

  /**
   * Log audit event
   * @param {Object} event - Audit event
   */
  async log(event) {
    const {
      action,
      actor,
      resource,
      result,
      metadata = {},
      severity = 'info',
      category = 'general'
    } = event;

    const logEntry = {
      id: this.generateLogId(),
      timestamp: Date.now(),
      datetime: new Date().toISOString(),
      environment: this.options.environment,
      action,
      actor,
      resource,
      result,
      severity,
      category,
      metadata,
      checksum: null
    };

    // Calculate checksum for integrity
    logEntry.checksum = this.calculateChecksum(logEntry);

    // Add to buffer
    this.logBuffer.push(logEntry);
    this.bufferSize++;
    this.stats.totalLogs++;

    // Flush if buffer is full
    if (this.bufferSize >= this.maxBufferSize) {
      await this.flushBuffer();
    }

    // Index entry
    if (this.options.indexingEnabled) {
      this.indexEntry(logEntry);
    }

    // Real-time incident detection
    if (this.options.realTimeMonitoring) {
      this.detectIncident(logEntry);
    }

    this.emit('logged', logEntry);

    return logEntry;
  }

  /**
   * Generate unique log ID
   * @returns {string} Log ID
   */
  generateLogId() {
    return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Calculate checksum for log entry
   * @param {Object} entry - Log entry
   * @returns {string} SHA256 checksum
   */
  calculateChecksum(entry) {
    const data = JSON.stringify({
      timestamp: entry.timestamp,
      action: entry.action,
      actor: entry.actor,
      resource: entry.resource,
      result: entry.result
    });

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Flush log buffer to disk
   */
  async flushBuffer() {
    if (this.logBuffer.length === 0) return;

    try {
      const entries = [...this.logBuffer];
      this.logBuffer = [];
      this.bufferSize = 0;

      const logLines = entries.map(entry => JSON.stringify(entry)).join('\n') + '\n';

      await fs.appendFile(this.currentLogFile, logLines, 'utf8');

      const stats = await fs.stat(this.currentLogFile);
      this.stats.totalSize += Buffer.byteLength(logLines, 'utf8');

      // Check if rotation is needed
      if (stats.size >= this.options.maxLogSize) {
        await this.rotateLog();
      }
    } catch (error) {
      console.error('[AuditLog] Buffer flush failed:', error);
      // Re-add entries to buffer
      this.logBuffer.unshift(...entries);
      this.bufferSize = this.logBuffer.length;
    }
  }

  /**
   * Create new log file
   */
  async createNewLogFile() {
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const filename = `audit-${this.options.environment}-${timestamp}.log`;
    this.currentLogFile = path.join(this.options.logDir, filename);

    // Create file with header
    const header = {
      version: '1.0',
      environment: this.options.environment,
      created: new Date().toISOString(),
      hostname: require('os').hostname()
    };

    await fs.writeFile(
      this.currentLogFile,
      JSON.stringify(header) + '\n',
      'utf8'
    );

    console.log(`[AuditLog] Created new log file: ${filename}`);
  }

  /**
   * Rotate log file
   */
  async rotateLog() {
    console.log('[AuditLog] Rotating log file...');

    // Flush remaining buffer
    await this.flushBuffer();

    const oldLogFile = this.currentLogFile;

    // Create new log file
    await this.createNewLogFile();

    // Compress and archive old log file
    if (this.options.compressionEnabled) {
      await this.compressAndArchive(oldLogFile);
    }

    this.stats.lastRotation = Date.now();

    this.emit('rotated', { oldFile: oldLogFile, newFile: this.currentLogFile });
  }

  /**
   * Rotate logs if needed
   */
  async rotateLogsIfNeeded() {
    try {
      const stats = await fs.stat(this.currentLogFile);
      if (stats.size >= this.options.maxLogSize) {
        await this.rotateLog();
      }
    } catch (error) {
      console.error('[AuditLog] Rotation check failed:', error);
    }
  }

  /**
   * Compress and archive log file
   * @param {string} logFile - Log file path
   */
  async compressAndArchive(logFile) {
    try {
      const content = await fs.readFile(logFile);
      const compressed = await gzipAsync(content, { level: 9 });

      const archiveFile = path.join(
        this.options.archiveDir,
        path.basename(logFile) + '.gz'
      );

      await fs.writeFile(archiveFile, compressed);

      // Delete original
      await fs.unlink(logFile);

      this.stats.archivedLogs++;

      console.log(`[AuditLog] Archived: ${path.basename(logFile)}`);
    } catch (error) {
      console.error('[AuditLog] Archive failed:', error);
    }
  }

  /**
   * Index log entry for fast search
   * @param {Object} entry - Log entry
   */
  indexEntry(entry) {
    // Index by various fields
    const indexKeys = [
      `action:${entry.action}`,
      `actor:${entry.actor}`,
      `resource:${entry.resource}`,
      `severity:${entry.severity}`,
      `category:${entry.category}`,
      `result:${entry.result}`,
      `date:${entry.datetime.split('T')[0]}`
    ];

    for (const key of indexKeys) {
      if (!this.index.has(key)) {
        this.index.set(key, []);
      }
      this.index.get(key).push({
        id: entry.id,
        timestamp: entry.timestamp,
        file: path.basename(this.currentLogFile)
      });
    }
  }

  /**
   * Search audit logs
   * @param {Object} query - Search query
   * @returns {Promise<Array>} Search results
   */
  async search(query) {
    console.log('[AuditLog] Searching logs:', query);
    this.stats.searchQueries++;

    const {
      action,
      actor,
      resource,
      severity,
      category,
      result,
      startDate,
      endDate,
      limit = 100
    } = query;

    const results = [];
    const indexKeys = [];

    // Build index keys
    if (action) indexKeys.push(`action:${action}`);
    if (actor) indexKeys.push(`actor:${actor}`);
    if (resource) indexKeys.push(`resource:${resource}`);
    if (severity) indexKeys.push(`severity:${severity}`);
    if (category) indexKeys.push(`category:${category}`);
    if (result) indexKeys.push(`result:${result}`);

    // Get candidate entries from index
    let candidates = [];
    if (indexKeys.length > 0) {
      // Intersection of all index keys
      const sets = indexKeys.map(key => new Set(
        (this.index.get(key) || []).map(e => e.id)
      ));

      if (sets.length > 0) {
        const intersection = sets.reduce((a, b) =>
          new Set([...a].filter(x => b.has(x)))
        );

        candidates = Array.from(intersection);
      }
    } else {
      // No index keys, search all logs
      candidates = await this.getAllLogIds();
    }

    // Filter by date range and retrieve entries
    for (const id of candidates) {
      const entry = await this.getLogById(id);
      if (!entry) continue;

      // Date range filter
      if (startDate && entry.timestamp < new Date(startDate).getTime()) continue;
      if (endDate && entry.timestamp > new Date(endDate).getTime()) continue;

      results.push(entry);

      if (results.length >= limit) break;
    }

    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp - a.timestamp);

    this.emit('searched', { query, resultsCount: results.length });

    return results;
  }

  /**
   * Get all log IDs
   * @returns {Promise<Array>} Log IDs
   */
  async getAllLogIds() {
    const ids = [];

    for (const entries of this.index.values()) {
      for (const entry of entries) {
        if (!ids.includes(entry.id)) {
          ids.push(entry.id);
        }
      }
    }

    return ids;
  }

  /**
   * Get log entry by ID
   * @param {string} id - Log ID
   * @returns {Promise<Object|null>} Log entry
   */
  async getLogById(id) {
    // Find in index
    let logFile = null;
    for (const entries of this.index.values()) {
      const entry = entries.find(e => e.id === id);
      if (entry) {
        logFile = entry.file;
        break;
      }
    }

    if (!logFile) return null;

    // Read log file
    const filePath = path.join(this.options.logDir, logFile);

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.id === id) {
            return entry;
          }
        } catch (error) {
          // Skip malformed lines
        }
      }
    } catch (error) {
      // File might be archived
      return await this.getLogFromArchive(id, logFile);
    }

    return null;
  }

  /**
   * Get log from archive
   * @param {string} id - Log ID
   * @param {string} logFile - Log file name
   * @returns {Promise<Object|null>} Log entry
   */
  async getLogFromArchive(id, logFile) {
    const archiveFile = path.join(this.options.archiveDir, logFile + '.gz');

    try {
      const compressed = await fs.readFile(archiveFile);
      const content = await gunzipAsync(compressed);
      const lines = content.toString('utf8').split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.id === id) {
            return entry;
          }
        } catch (error) {
          // Skip malformed lines
        }
      }
    } catch (error) {
      console.error('[AuditLog] Archive read failed:', error);
    }

    return null;
  }

  /**
   * Start real-time monitoring for incident detection
   */
  startRealTimeMonitoring() {
    this.on('logged', (entry) => {
      // Check for incidents based on severity and patterns
      if (entry.severity === 'critical' || entry.severity === 'error') {
        this.detectIncident(entry);
      }
    });

    console.log('[AuditLog] Real-time monitoring started');
  }

  /**
   * Detect incidents in real-time
   * @param {Object} entry - Log entry
   */
  detectIncident(entry) {
    const now = Date.now();
    const threshold = this.options.incidentDetectionThreshold;

    // Check if entry represents an incident
    const isIncident =
      entry.severity === 'critical' ||
      (entry.severity === 'error' && entry.result === 'failure') ||
      entry.category === 'security_violation';

    if (isIncident) {
      const detectionTime = now - entry.timestamp;

      if (detectionTime <= threshold) {
        this.stats.incidentsDetected++;

        this.emit('incidentDetected', {
          entry,
          detectionTime,
          withinThreshold: detectionTime <= threshold
        });

        console.log(`[AuditLog] Incident detected: ${entry.action} (detection time: ${detectionTime}ms)`);
      }
    }
  }

  /**
   * Verify log integrity
   * @param {string} logId - Log ID
   * @returns {Promise<boolean>} Integrity status
   */
  async verifyIntegrity(logId) {
    const entry = await this.getLogById(logId);
    if (!entry) return false;

    const storedChecksum = entry.checksum;
    const calculatedChecksum = this.calculateChecksum(entry);

    return storedChecksum === calculatedChecksum;
  }

  /**
   * Load index from disk
   */
  async loadIndex() {
    const indexFile = path.join(this.options.indexDir, 'audit-index.json');

    try {
      const content = await fs.readFile(indexFile, 'utf8');
      const data = JSON.parse(content);

      for (const [key, value] of Object.entries(data.index)) {
        this.index.set(key, value);
      }

      console.log(`[AuditLog] Loaded index with ${this.index.size} keys`);
    } catch (error) {
      console.log('[AuditLog] No existing index found, starting fresh');
    }
  }

  /**
   * Save index to disk
   */
  async saveIndex() {
    const indexFile = path.join(this.options.indexDir, 'audit-index.json');

    const data = {
      version: '1.0',
      updated: new Date().toISOString(),
      index: Object.fromEntries(this.index)
    };

    await fs.writeFile(indexFile, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * Get audit log statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      environment: this.options.environment,
      currentLogFile: path.basename(this.currentLogFile || ''),
      bufferSize: this.bufferSize,
      indexKeys: this.index.size,
      retentionPeriod: this.options.retentionPeriod,
      retentionDays: Math.floor(this.options.retentionPeriod / 86400000)
    };
  }

  /**
   * Generate audit report
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Audit report
   */
  async generateReport(options = {}) {
    const {
      startDate,
      endDate,
      groupBy = 'action'
    } = options;

    const logs = await this.search({ startDate, endDate, limit: 10000 });

    const report = {
      timestamp: new Date().toISOString(),
      environment: this.options.environment,
      period: { startDate, endDate },
      summary: {
        totalLogs: logs.length,
        bySeverity: {},
        byCategory: {},
        byResult: {},
        byActor: {}
      },
      topActions: [],
      incidents: []
    };

    // Aggregate data
    const groupedData = new Map();

    for (const log of logs) {
      // By severity
      report.summary.bySeverity[log.severity] =
        (report.summary.bySeverity[log.severity] || 0) + 1;

      // By category
      report.summary.byCategory[log.category] =
        (report.summary.byCategory[log.category] || 0) + 1;

      // By result
      report.summary.byResult[log.result] =
        (report.summary.byResult[log.result] || 0) + 1;

      // By actor
      report.summary.byActor[log.actor] =
        (report.summary.byActor[log.actor] || 0) + 1;

      // Group by specified field
      const groupKey = log[groupBy];
      if (!groupedData.has(groupKey)) {
        groupedData.set(groupKey, 0);
      }
      groupedData.set(groupKey, groupedData.get(groupKey) + 1);

      // Collect incidents
      if (log.severity === 'critical' || log.severity === 'error') {
        report.incidents.push({
          id: log.id,
          timestamp: log.datetime,
          action: log.action,
          actor: log.actor,
          severity: log.severity,
          result: log.result
        });
      }
    }

    // Top actions
    report.topActions = Array.from(groupedData.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));

    return report;
  }

  /**
   * Clean up old logs based on retention policy
   */
  async cleanupOldLogs() {
    console.log('[AuditLog] Cleaning up old logs...');

    const now = Date.now();
    const retentionThreshold = now - this.options.retentionPeriod;

    try {
      const files = await fs.readdir(this.options.archiveDir);

      for (const file of files) {
        const filePath = path.join(this.options.archiveDir, file);
        const stats = await fs.stat(filePath);

        if (stats.mtimeMs < retentionThreshold) {
          await fs.unlink(filePath);
          console.log(`[AuditLog] Deleted old archive: ${file}`);
        }
      }
    } catch (error) {
      console.error('[AuditLog] Cleanup failed:', error);
    }
  }

  /**
   * Shutdown audit log manager
   */
  async shutdown() {
    console.log('[AuditLog] Shutting down...');

    // Clear timers
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.rotationTimer) clearInterval(this.rotationTimer);

    // Flush remaining buffer
    await this.flushBuffer();

    // Save index
    if (this.options.indexingEnabled) {
      await this.saveIndex();
    }

    console.log('[AuditLog] Shutdown complete');
  }
}

module.exports = AuditLogManager;
