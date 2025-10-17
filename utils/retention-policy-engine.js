/**
 * Data Retention Policy Automation Engine
 * Automated data retention policy enforcement
 * Priority: H026 from improvement backlog
 *
 * Features:
 * - Policy-based data lifecycle management
 * - GDPR/HIPAA/CCPA compliance
 * - Automated data cleanup and archival
 * - Audit logging and reporting
 * - Flexible policy configuration
 *
 * @module utils/retention-policy-engine
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class RetentionPolicyEngine extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      policiesFile: options.policiesFile || './config/retention-policies.json',
      dataDir: options.dataDir || './data',
      archiveDir: options.archiveDir || './data/archives',
      auditLogDir: options.auditLogDir || './logs/retention',
      enableAutoCleanup: options.enableAutoCleanup !== false,
      cleanupInterval: options.cleanupInterval || 3600000, // 1 hour
      enableAuditLog: options.enableAuditLog !== false,
      enableCompliance: options.enableCompliance !== false,
      complianceStandards: options.complianceStandards || ['GDPR', 'HIPAA', 'CCPA'],
      dryRun: options.dryRun || false,
      ...options
    };

    this.policies = new Map();
    this.retentionRecords = new Map();
    this.cleanupTimer = null;
    this.stats = {
      totalPolicies: 0,
      totalRecords: 0,
      recordsExpired: 0,
      recordsArchived: 0,
      recordsDeleted: 0,
      lastCleanup: null
    };

    this.init();
  }

  /**
   * Initialize retention policy engine
   */
  async init() {
    try {
      await fs.mkdir(this.options.archiveDir, { recursive: true });
      await fs.mkdir(this.options.auditLogDir, { recursive: true });
      await this.loadPolicies();
      await this.loadRetentionRecords();

      if (this.options.enableAutoCleanup) {
        this.startAutoCleanup();
      }

      console.log('[RetentionPolicy] Engine initialized');
    } catch (error) {
      console.error('[RetentionPolicy] Initialization failed:', error);
    }
  }

  /**
   * Load retention policies from configuration
   */
  async loadPolicies() {
    try {
      const content = await fs.readFile(this.options.policiesFile, 'utf8');
      const config = JSON.parse(content);

      for (const policy of config.policies) {
        this.registerPolicy(policy);
      }

      console.log(`[RetentionPolicy] Loaded ${this.policies.size} policies`);
    } catch (error) {
      // Create default policies if file doesn't exist
      console.log('[RetentionPolicy] No policies file found, creating defaults');
      await this.createDefaultPolicies();
    }
  }

  /**
   * Create default retention policies
   */
  async createDefaultPolicies() {
    const defaultPolicies = {
      version: '1.0',
      policies: [
        {
          name: 'user_sessions',
          description: 'User session data retention',
          dataType: 'session',
          retentionPeriod: 2592000000, // 30 days
          action: 'delete',
          enabled: true,
          complianceStandards: ['GDPR'],
          patterns: ['data/sessions/*.json']
        },
        {
          name: 'user_logs',
          description: 'User activity logs retention',
          dataType: 'logs',
          retentionPeriod: 7776000000, // 90 days
          action: 'archive',
          enabled: true,
          complianceStandards: ['GDPR', 'HIPAA'],
          patterns: ['logs/**/*.log']
        },
        {
          name: 'temporary_files',
          description: 'Temporary files cleanup',
          dataType: 'temporary',
          retentionPeriod: 86400000, // 1 day
          action: 'delete',
          enabled: true,
          complianceStandards: [],
          patterns: ['data/temp/**/*']
        },
        {
          name: 'error_reports',
          description: 'Error report retention',
          dataType: 'error',
          retentionPeriod: 15552000000, // 180 days
          action: 'archive',
          enabled: true,
          complianceStandards: ['HIPAA'],
          patterns: ['reports/errors/**/*.json']
        },
        {
          name: 'user_data',
          description: 'User personal data retention',
          dataType: 'personal',
          retentionPeriod: 31536000000, // 365 days
          action: 'archive',
          enabled: true,
          complianceStandards: ['GDPR', 'CCPA'],
          patterns: ['data/users/*/profile.json']
        },
        {
          name: 'backups',
          description: 'Backup files retention',
          dataType: 'backup',
          retentionPeriod: 7776000000, // 90 days
          action: 'delete',
          enabled: true,
          complianceStandards: [],
          patterns: ['backups/**/*']
        },
        {
          name: 'audit_logs',
          description: 'Audit logs retention',
          dataType: 'audit',
          retentionPeriod: 31536000000, // 365 days (compliance requirement)
          action: 'archive',
          enabled: true,
          complianceStandards: ['GDPR', 'HIPAA', 'CCPA'],
          patterns: ['logs/audit/**/*.log']
        }
      ]
    };

    await fs.writeFile(
      this.options.policiesFile,
      JSON.stringify(defaultPolicies, null, 2),
      'utf8'
    );

    for (const policy of defaultPolicies.policies) {
      this.registerPolicy(policy);
    }
  }

  /**
   * Register retention policy
   * @param {Object} policy - Policy configuration
   */
  registerPolicy(policy) {
    const {
      name,
      description = '',
      dataType,
      retentionPeriod,
      action = 'delete',
      enabled = true,
      complianceStandards = [],
      patterns = [],
      customHandler = null
    } = policy;

    if (!name || !dataType || !retentionPeriod) {
      throw new Error('Policy must have name, dataType, and retentionPeriod');
    }

    if (!['delete', 'archive', 'anonymize'].includes(action)) {
      throw new Error(`Invalid action: ${action}`);
    }

    this.policies.set(name, {
      name,
      description,
      dataType,
      retentionPeriod,
      action,
      enabled,
      complianceStandards,
      patterns,
      customHandler,
      createdAt: Date.now(),
      lastExecuted: null,
      executionCount: 0,
      recordsProcessed: 0
    });

    this.stats.totalPolicies = this.policies.size;

    console.log(`[RetentionPolicy] Registered policy: ${name}`);
  }

  /**
   * Track data record for retention
   * @param {Object} record - Data record
   */
  async trackRecord(record) {
    const {
      id,
      dataType,
      filePath,
      createdAt = Date.now(),
      metadata = {}
    } = record;

    if (!id || !dataType) {
      throw new Error('Record must have id and dataType');
    }

    const retentionRecord = {
      id,
      dataType,
      filePath,
      createdAt,
      trackedAt: Date.now(),
      expiresAt: null,
      status: 'active',
      policy: null,
      metadata
    };

    // Find applicable policy
    const policy = this.findApplicablePolicy(dataType, filePath);
    if (policy) {
      retentionRecord.policy = policy.name;
      retentionRecord.expiresAt = createdAt + policy.retentionPeriod;
    }

    this.retentionRecords.set(id, retentionRecord);
    this.stats.totalRecords = this.retentionRecords.size;

    await this.saveRetentionRecords();

    this.emit('recordTracked', retentionRecord);

    return retentionRecord;
  }

  /**
   * Find applicable policy for data type
   * @param {string} dataType - Data type
   * @param {string} filePath - File path
   * @returns {Object|null} Policy
   */
  findApplicablePolicy(dataType, filePath = '') {
    for (const policy of this.policies.values()) {
      if (!policy.enabled) continue;

      if (policy.dataType === dataType) {
        // Check pattern matching if specified
        if (policy.patterns.length === 0) return policy;

        for (const pattern of policy.patterns) {
          const regex = this.patternToRegex(pattern);
          if (regex.test(filePath)) {
            return policy;
          }
        }
      }
    }

    return null;
  }

  /**
   * Convert glob pattern to regex
   * @param {string} pattern - Glob pattern
   * @returns {RegExp} Regular expression
   */
  patternToRegex(pattern) {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');

    return new RegExp(`^${regexPattern}$`);
  }

  /**
   * Execute retention policies
   * @returns {Promise<Object>} Execution results
   */
  async executeRetention() {
    console.log('[RetentionPolicy] Starting retention execution...');

    const results = {
      timestamp: Date.now(),
      policiesExecuted: 0,
      recordsProcessed: 0,
      recordsExpired: 0,
      recordsArchived: 0,
      recordsDeleted: 0,
      recordsAnonymized: 0,
      errors: []
    };

    for (const policy of this.policies.values()) {
      if (!policy.enabled) continue;

      try {
        const policyResult = await this.executePolicyRetention(policy);
        results.policiesExecuted++;
        results.recordsProcessed += policyResult.recordsProcessed;
        results.recordsExpired += policyResult.recordsExpired;
        results.recordsArchived += policyResult.recordsArchived;
        results.recordsDeleted += policyResult.recordsDeleted;
        results.recordsAnonymized += policyResult.recordsAnonymized;
      } catch (error) {
        console.error(`[RetentionPolicy] Policy execution failed: ${policy.name}`, error);
        results.errors.push({
          policy: policy.name,
          error: error.message
        });
      }
    }

    // Update global stats
    this.stats.recordsExpired += results.recordsExpired;
    this.stats.recordsArchived += results.recordsArchived;
    this.stats.recordsDeleted += results.recordsDeleted;
    this.stats.lastCleanup = results.timestamp;

    // Audit logging
    if (this.options.enableAuditLog) {
      await this.logRetentionExecution(results);
    }

    console.log(`[RetentionPolicy] Execution complete: ${results.recordsProcessed} records processed`);

    this.emit('retentionExecuted', results);

    return results;
  }

  /**
   * Execute retention for specific policy
   * @param {Object} policy - Policy
   * @returns {Promise<Object>} Policy results
   */
  async executePolicyRetention(policy) {
    console.log(`[RetentionPolicy] Executing policy: ${policy.name}`);

    const now = Date.now();
    const results = {
      recordsProcessed: 0,
      recordsExpired: 0,
      recordsArchived: 0,
      recordsDeleted: 0,
      recordsAnonymized: 0
    };

    // Find expired records for this policy
    const expiredRecords = Array.from(this.retentionRecords.values()).filter(
      record =>
        record.policy === policy.name &&
        record.status === 'active' &&
        record.expiresAt &&
        record.expiresAt <= now
    );

    for (const record of expiredRecords) {
      results.recordsProcessed++;

      try {
        // Execute policy action
        if (policy.customHandler) {
          await policy.customHandler(record, policy);
        } else {
          switch (policy.action) {
            case 'archive':
              await this.archiveRecord(record);
              results.recordsArchived++;
              break;

            case 'delete':
              await this.deleteRecord(record);
              results.recordsDeleted++;
              break;

            case 'anonymize':
              await this.anonymizeRecord(record);
              results.recordsAnonymized++;
              break;
          }
        }

        // Update record status
        record.status = 'expired';
        record.processedAt = now;
        results.recordsExpired++;

        this.emit('recordExpired', record, policy);
      } catch (error) {
        console.error(`[RetentionPolicy] Record processing failed: ${record.id}`, error);
        record.status = 'error';
        record.error = error.message;
      }
    }

    // Update policy stats
    policy.lastExecuted = now;
    policy.executionCount++;
    policy.recordsProcessed += results.recordsProcessed;

    await this.saveRetentionRecords();

    return results;
  }

  /**
   * Archive record
   * @param {Object} record - Record to archive
   */
  async archiveRecord(record) {
    if (this.options.dryRun) {
      console.log(`[RetentionPolicy] [DRY RUN] Would archive: ${record.id}`);
      return;
    }

    if (!record.filePath) {
      console.warn(`[RetentionPolicy] Cannot archive record without filePath: ${record.id}`);
      return;
    }

    const sourcePath = path.resolve(record.filePath);
    const archiveDate = new Date().toISOString().split('T')[0];
    const archivePath = path.join(
      this.options.archiveDir,
      record.dataType,
      archiveDate,
      path.basename(sourcePath)
    );

    try {
      // Check if source exists
      await fs.access(sourcePath);

      // Create archive directory
      await fs.mkdir(path.dirname(archivePath), { recursive: true });

      // Copy to archive
      await fs.copyFile(sourcePath, archivePath);

      // Delete original
      await fs.unlink(sourcePath);

      record.archivedAt = Date.now();
      record.archivePath = archivePath;

      console.log(`[RetentionPolicy] Archived: ${record.id} -> ${archivePath}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(`[RetentionPolicy] File not found for archival: ${sourcePath}`);
        record.status = 'file_not_found';
      } else {
        throw error;
      }
    }
  }

  /**
   * Delete record
   * @param {Object} record - Record to delete
   */
  async deleteRecord(record) {
    if (this.options.dryRun) {
      console.log(`[RetentionPolicy] [DRY RUN] Would delete: ${record.id}`);
      return;
    }

    if (!record.filePath) {
      console.warn(`[RetentionPolicy] Cannot delete record without filePath: ${record.id}`);
      return;
    }

    const filePath = path.resolve(record.filePath);

    try {
      // Check if file exists
      await fs.access(filePath);

      // Delete file
      await fs.unlink(filePath);

      record.deletedAt = Date.now();

      console.log(`[RetentionPolicy] Deleted: ${record.id} - ${filePath}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(`[RetentionPolicy] File not found for deletion: ${filePath}`);
        record.status = 'file_not_found';
      } else {
        throw error;
      }
    }

    // Remove from tracking
    this.retentionRecords.delete(record.id);
  }

  /**
   * Anonymize record
   * @param {Object} record - Record to anonymize
   */
  async anonymizeRecord(record) {
    if (this.options.dryRun) {
      console.log(`[RetentionPolicy] [DRY RUN] Would anonymize: ${record.id}`);
      return;
    }

    if (!record.filePath) {
      console.warn(`[RetentionPolicy] Cannot anonymize record without filePath: ${record.id}`);
      return;
    }

    const filePath = path.resolve(record.filePath);

    try {
      // Read file content
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);

      // Anonymize PII fields
      const anonymizedData = this.anonymizeData(data);

      // Write back
      await fs.writeFile(filePath, JSON.stringify(anonymizedData, null, 2), 'utf8');

      record.anonymizedAt = Date.now();

      console.log(`[RetentionPolicy] Anonymized: ${record.id}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(`[RetentionPolicy] File not found for anonymization: ${filePath}`);
        record.status = 'file_not_found';
      } else {
        throw error;
      }
    }
  }

  /**
   * Anonymize data object
   * @param {Object} data - Data to anonymize
   * @returns {Object} Anonymized data
   */
  anonymizeData(data) {
    const piiFields = [
      'email',
      'phone',
      'address',
      'ssn',
      'creditCard',
      'name',
      'firstName',
      'lastName',
      'username',
      'ip',
      'ipAddress'
    ];

    const anonymized = { ...data };

    for (const field of piiFields) {
      if (anonymized[field]) {
        anonymized[field] = '[REDACTED]';
      }
    }

    // Recursively anonymize nested objects
    for (const key in anonymized) {
      if (typeof anonymized[key] === 'object' && anonymized[key] !== null) {
        anonymized[key] = this.anonymizeData(anonymized[key]);
      }
    }

    return anonymized;
  }

  /**
   * Log retention execution
   * @param {Object} results - Execution results
   */
  async logRetentionExecution(results) {
    const timestamp = new Date().toISOString();
    const logFile = path.join(
      this.options.auditLogDir,
      `retention-${timestamp.split('T')[0]}.log`
    );

    const logEntry = {
      timestamp,
      ...results
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    await fs.appendFile(logFile, logLine, 'utf8');
  }

  /**
   * Load retention records
   */
  async loadRetentionRecords() {
    const recordsFile = path.join(this.options.dataDir, 'retention-records.json');

    try {
      const content = await fs.readFile(recordsFile, 'utf8');
      const data = JSON.parse(content);

      for (const record of data.records) {
        this.retentionRecords.set(record.id, record);
      }

      console.log(`[RetentionPolicy] Loaded ${this.retentionRecords.size} retention records`);
    } catch (error) {
      console.log('[RetentionPolicy] No retention records found');
    }
  }

  /**
   * Save retention records
   */
  async saveRetentionRecords() {
    const recordsFile = path.join(this.options.dataDir, 'retention-records.json');

    const data = {
      version: '1.0',
      updated: new Date().toISOString(),
      records: Array.from(this.retentionRecords.values())
    };

    await fs.writeFile(recordsFile, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * Start automatic cleanup
   */
  startAutoCleanup() {
    if (this.cleanupTimer) {
      return;
    }

    console.log(`[RetentionPolicy] Auto cleanup enabled (interval: ${this.options.cleanupInterval}ms)`);

    this.cleanupTimer = setInterval(async () => {
      try {
        await this.executeRetention();
      } catch (error) {
        console.error('[RetentionPolicy] Auto cleanup failed:', error);
      }
    }, this.options.cleanupInterval);
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log('[RetentionPolicy] Auto cleanup disabled');
    }
  }

  /**
   * Get policy statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      policies: Array.from(this.policies.values()).map(p => ({
        name: p.name,
        dataType: p.dataType,
        retentionPeriod: p.retentionPeriod,
        enabled: p.enabled,
        lastExecuted: p.lastExecuted,
        executionCount: p.executionCount,
        recordsProcessed: p.recordsProcessed
      })),
      activeRecords: Array.from(this.retentionRecords.values()).filter(
        r => r.status === 'active'
      ).length,
      expiredRecords: Array.from(this.retentionRecords.values()).filter(
        r => r.status === 'expired'
      ).length
    };
  }

  /**
   * Generate compliance report
   * @param {string} standard - Compliance standard (GDPR, HIPAA, CCPA)
   * @returns {Object} Compliance report
   */
  generateComplianceReport(standard) {
    const applicablePolicies = Array.from(this.policies.values()).filter(p =>
      p.complianceStandards.includes(standard)
    );

    const report = {
      standard,
      timestamp: new Date().toISOString(),
      policies: applicablePolicies.map(p => ({
        name: p.name,
        dataType: p.dataType,
        retentionPeriod: p.retentionPeriod,
        retentionDays: Math.floor(p.retentionPeriod / 86400000),
        action: p.action,
        enabled: p.enabled,
        lastExecuted: p.lastExecuted,
        recordsProcessed: p.recordsProcessed
      })),
      summary: {
        totalPolicies: applicablePolicies.length,
        enabledPolicies: applicablePolicies.filter(p => p.enabled).length,
        totalRecordsProcessed: applicablePolicies.reduce(
          (sum, p) => sum + p.recordsProcessed,
          0
        )
      }
    };

    return report;
  }

  /**
   * Disable policy
   * @param {string} policyName - Policy name
   */
  disablePolicy(policyName) {
    const policy = this.policies.get(policyName);
    if (policy) {
      policy.enabled = false;
      console.log(`[RetentionPolicy] Policy disabled: ${policyName}`);
    }
  }

  /**
   * Enable policy
   * @param {string} policyName - Policy name
   */
  enablePolicy(policyName) {
    const policy = this.policies.get(policyName);
    if (policy) {
      policy.enabled = true;
      console.log(`[RetentionPolicy] Policy enabled: ${policyName}`);
    }
  }
}

module.exports = RetentionPolicyEngine;
