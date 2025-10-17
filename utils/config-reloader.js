/**
 * Dynamic Configuration Reloader
 * Zero-downtime configuration reload with validation
 * Priority: H014 from improvement backlog
 *
 * @module utils/config-reloader
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class ConfigReloader extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      configPath: options.configPath || './.env',
      watchInterval: options.watchInterval || 5000, // 5 seconds
      validateBeforeReload: options.validateBeforeReload !== false,
      backupConfig: options.backupConfig !== false,
      auditLog: options.auditLog !== false,
      auditLogPath: options.auditLogPath || './logs/config-audit.log',
      ...options
    };

    this.currentConfig = {};
    this.configHash = null;
    this.watcher = null;
    this.validators = new Map();
    this.changeHistory = [];
  }

  /**
   * Start configuration monitoring
   */
  async start() {
    console.log('[ConfigReloader] Starting configuration monitoring...');

    // Load initial configuration
    await this.loadConfig();

    // Start file watcher
    this.startWatching();

    this.emit('started', { config: this.currentConfig });
  }

  /**
   * Stop configuration monitoring
   */
  stop() {
    if (this.watcher) {
      clearInterval(this.watcher);
      this.watcher = null;
    }

    this.emit('stopped');
    console.log('[ConfigReloader] Configuration monitoring stopped');
  }

  /**
   * Load configuration from file
   */
  async loadConfig() {
    try {
      const content = fs.readFileSync(this.options.configPath, 'utf8');
      const newHash = this.calculateHash(content);

      // Check if configuration changed
      if (newHash === this.configHash) {
        return false; // No changes
      }

      const newConfig = this.parseConfig(content);

      // Validate configuration
      if (this.options.validateBeforeReload) {
        const validation = await this.validateConfig(newConfig);
        if (!validation.valid) {
          console.error('[ConfigReloader] Configuration validation failed:', validation.errors);
          this.emit('validation-failed', validation);
          return false;
        }
      }

      // Backup current configuration
      if (this.options.backupConfig && Object.keys(this.currentConfig).length > 0) {
        await this.backupCurrentConfig();
      }

      // Apply configuration
      const changes = this.detectChanges(this.currentConfig, newConfig);
      const previousConfig = { ...this.currentConfig };

      this.currentConfig = newConfig;
      this.configHash = newHash;

      // Apply to process.env
      this.applyToEnvironment(newConfig);

      // Audit log
      if (this.options.auditLog) {
        await this.logConfigChange(changes, previousConfig, newConfig);
      }

      // Record change history
      this.recordChange(changes, previousConfig, newConfig);

      this.emit('reloaded', {
        changes,
        previousConfig,
        currentConfig: newConfig
      });

      console.log('[ConfigReloader] Configuration reloaded successfully');
      console.log(`[ConfigReloader] Changes: ${changes.length} items`);

      return true;
    } catch (error) {
      console.error('[ConfigReloader] Failed to load configuration:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Parse configuration content
   * @param {string} content - Configuration file content
   * @returns {Object} Parsed configuration
   */
  parseConfig(content) {
    const config = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Parse key=value
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Remove quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        config[key] = value;
      }
    }

    return config;
  }

  /**
   * Calculate content hash
   * @param {string} content - Content to hash
   * @returns {string} Hash string
   */
  calculateHash(content) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Detect changes between configurations
   * @param {Object} oldConfig - Old configuration
   * @param {Object} newConfig - New configuration
   * @returns {Array} List of changes
   */
  detectChanges(oldConfig, newConfig) {
    const changes = [];

    // Check for modified and new keys
    for (const [key, newValue] of Object.entries(newConfig)) {
      const oldValue = oldConfig[key];

      if (oldValue === undefined) {
        changes.push({
          type: 'added',
          key,
          newValue,
          timestamp: Date.now()
        });
      } else if (oldValue !== newValue) {
        changes.push({
          type: 'modified',
          key,
          oldValue: this.maskSensitiveValue(key, oldValue),
          newValue: this.maskSensitiveValue(key, newValue),
          timestamp: Date.now()
        });
      }
    }

    // Check for deleted keys
    for (const key of Object.keys(oldConfig)) {
      if (!(key in newConfig)) {
        changes.push({
          type: 'deleted',
          key,
          oldValue: this.maskSensitiveValue(key, oldConfig[key]),
          timestamp: Date.now()
        });
      }
    }

    return changes;
  }

  /**
   * Mask sensitive values in logs
   * @param {string} key - Configuration key
   * @param {string} value - Configuration value
   * @returns {string} Masked value
   */
  maskSensitiveValue(key, value) {
    const sensitiveKeys = [
      'password', 'secret', 'token', 'key', 'api_key',
      'private', 'credential', 'auth', 'stripe'
    ];

    const isSensitive = sensitiveKeys.some(keyword =>
      key.toLowerCase().includes(keyword)
    );

    if (isSensitive && value) {
      if (value.length <= 4) {
        return '****';
      }
      return value.slice(0, 2) + '****' + value.slice(-2);
    }

    return value;
  }

  /**
   * Apply configuration to process.env
   * @param {Object} config - Configuration object
   */
  applyToEnvironment(config) {
    for (const [key, value] of Object.entries(config)) {
      process.env[key] = value;
    }
  }

  /**
   * Start watching configuration file
   */
  startWatching() {
    this.watcher = setInterval(async () => {
      await this.loadConfig();
    }, this.options.watchInterval);
  }

  /**
   * Register configuration validator
   * @param {string} key - Configuration key
   * @param {Function} validator - Validator function
   */
  registerValidator(key, validator) {
    this.validators.set(key, validator);
  }

  /**
   * Validate configuration
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result
   */
  async validateConfig(config) {
    const errors = [];

    for (const [key, validator] of this.validators.entries()) {
      try {
        const result = await validator(config[key], config);

        if (result !== true) {
          errors.push({
            key,
            message: result || 'Validation failed'
          });
        }
      } catch (error) {
        errors.push({
          key,
          message: error.message
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Backup current configuration
   */
  async backupCurrentConfig() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = this.options.configPath + `.backup.${timestamp}`;

      const content = Object.entries(this.currentConfig)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      fs.writeFileSync(backupPath, content, 'utf8');

      console.log(`[ConfigReloader] Configuration backed up to: ${backupPath}`);
    } catch (error) {
      console.error('[ConfigReloader] Failed to backup configuration:', error);
    }
  }

  /**
   * Log configuration change to audit log
   * @param {Array} changes - List of changes
   * @param {Object} previousConfig - Previous configuration
   * @param {Object} currentConfig - Current configuration
   */
  async logConfigChange(changes, previousConfig, currentConfig) {
    try {
      const logDir = path.dirname(this.options.auditLogPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logEntry = {
        timestamp: new Date().toISOString(),
        changes: changes.map(change => ({
          type: change.type,
          key: change.key,
          oldValue: change.oldValue,
          newValue: change.newValue
        })),
        configHash: this.configHash,
        user: process.env.USER || 'system',
        hostname: require('os').hostname()
      };

      const logLine = JSON.stringify(logEntry) + '\n';

      fs.appendFileSync(this.options.auditLogPath, logLine, 'utf8');
    } catch (error) {
      console.error('[ConfigReloader] Failed to write audit log:', error);
    }
  }

  /**
   * Record change in history
   * @param {Array} changes - Changes
   * @param {Object} previousConfig - Previous config
   * @param {Object} currentConfig - Current config
   */
  recordChange(changes, previousConfig, currentConfig) {
    this.changeHistory.push({
      timestamp: Date.now(),
      changes,
      configHash: this.configHash
    });

    // Keep only last 100 changes
    if (this.changeHistory.length > 100) {
      this.changeHistory = this.changeHistory.slice(-100);
    }
  }

  /**
   * Get configuration value
   * @param {string} key - Configuration key
   * @param {*} defaultValue - Default value
   * @returns {*} Configuration value
   */
  get(key, defaultValue = null) {
    return this.currentConfig[key] !== undefined
      ? this.currentConfig[key]
      : defaultValue;
  }

  /**
   * Get all configuration
   * @returns {Object} Current configuration
   */
  getAll() {
    return { ...this.currentConfig };
  }

  /**
   * Get change history
   * @returns {Array} Change history
   */
  getHistory() {
    return [...this.changeHistory];
  }

  /**
   * Manually reload configuration
   */
  async reload() {
    console.log('[ConfigReloader] Manual reload triggered');
    return await this.loadConfig();
  }

  /**
   * Create Express middleware
   * @returns {Function} Express middleware
   */
  middleware() {
    return (req, res, next) => {
      req.config = {
        get: (key, defaultValue) => this.get(key, defaultValue),
        getAll: () => this.getAll(),
        reload: () => this.reload()
      };
      next();
    };
  }
}

// Built-in validators
ConfigReloader.validators = {
  /**
   * Port number validator
   */
  port: (value) => {
    const port = parseInt(value);
    if (isNaN(port) || port < 1 || port > 65535) {
      return 'Port must be between 1 and 65535';
    }
    return true;
  },

  /**
   * Boolean validator
   */
  boolean: (value) => {
    const valid = ['true', 'false', '1', '0', 'yes', 'no'];
    if (!valid.includes(String(value).toLowerCase())) {
      return 'Value must be a boolean (true/false)';
    }
    return true;
  },

  /**
   * URL validator
   */
  url: (value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return 'Value must be a valid URL';
    }
  },

  /**
   * Email validator
   */
  email: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Value must be a valid email address';
    }
    return true;
  },

  /**
   * Required validator
   */
  required: (value) => {
    if (value === undefined || value === null || value === '') {
      return 'Value is required';
    }
    return true;
  },

  /**
   * Numeric validator
   */
  numeric: (value) => {
    if (isNaN(Number(value))) {
      return 'Value must be numeric';
    }
    return true;
  },

  /**
   * Enum validator
   */
  enum: (allowedValues) => (value) => {
    if (!allowedValues.includes(value)) {
      return `Value must be one of: ${allowedValues.join(', ')}`;
    }
    return true;
  },

  /**
   * Min/Max length validator
   */
  length: (min, max) => (value) => {
    const len = String(value).length;
    if (min !== undefined && len < min) {
      return `Value must be at least ${min} characters`;
    }
    if (max !== undefined && len > max) {
      return `Value must be at most ${max} characters`;
    }
    return true;
  }
};

module.exports = ConfigReloader;
