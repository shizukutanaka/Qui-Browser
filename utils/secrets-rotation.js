/**
 * Secrets Rotation Automation
 * Automated secrets rotation workflows
 * Priority: H032 from improvement backlog
 *
 * Features:
 * - Automated rotation of API keys, tokens, passwords
 * - Integration with environment variables
 * - Zero-downtime rotation strategy
 * - Rotation history and audit logging
 * - Configurable rotation schedules
 *
 * @module utils/secrets-rotation
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');

class SecretsRotation extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      envFile: options.envFile || '.env',
      backupDir: options.backupDir || './backups/secrets',
      auditLogFile: options.auditLogFile || './logs/secrets-rotation.log',
      enableAutoRotation: options.enableAutoRotation !== false,
      rotationInterval: options.rotationInterval || 2592000000, // 30 days
      minPasswordLength: options.minPasswordLength || 32,
      maxPasswordLength: options.maxPasswordLength || 64,
      enableNotifications: options.enableNotifications !== false,
      dryRun: options.dryRun || false,
      ...options
    };

    this.secrets = new Map();
    this.rotationHistory = [];
    this.rotationTimer = null;

    this.init();
  }

  /**
   * Initialize secrets rotation
   */
  async init() {
    try {
      await fs.mkdir(this.options.backupDir, { recursive: true });
      await fs.mkdir(path.dirname(this.options.auditLogFile), { recursive: true });
      await this.loadSecrets();
      await this.loadRotationHistory();

      if (this.options.enableAutoRotation) {
        this.startAutoRotation();
      }

      console.log('[SecretsRotation] Initialized');
    } catch (error) {
      console.error('[SecretsRotation] Initialization failed:', error);
    }
  }

  /**
   * Load secrets from environment file
   */
  async loadSecrets() {
    try {
      const envPath = path.resolve(this.options.envFile);
      const content = await fs.readFile(envPath, 'utf8');

      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const [, key, value] = match;
          const trimmedKey = key.trim();
          const trimmedValue = value.trim();

          // Identify secret types
          if (this.isSecret(trimmedKey)) {
            this.secrets.set(trimmedKey, {
              key: trimmedKey,
              value: trimmedValue,
              type: this.detectSecretType(trimmedKey),
              rotatable: this.isRotatable(trimmedKey),
              lastRotated: null,
              rotationCount: 0
            });
          }
        }
      }

      console.log(`[SecretsRotation] Loaded ${this.secrets.size} secrets`);
    } catch (error) {
      console.error('[SecretsRotation] Failed to load secrets:', error);
    }
  }

  /**
   * Check if key is a secret
   * @param {string} key - Environment variable key
   * @returns {boolean} Is secret
   */
  isSecret(key) {
    const secretPatterns = [
      /SECRET/i,
      /PASSWORD/i,
      /KEY/i,
      /TOKEN/i,
      /AUTH/i,
      /API_/i,
      /PRIVATE/i,
      /CREDENTIAL/i,
      /ENCRYPTION/i
    ];

    return secretPatterns.some(pattern => pattern.test(key));
  }

  /**
   * Detect secret type
   * @param {string} key - Secret key
   * @returns {string} Secret type
   */
  detectSecretType(key) {
    if (/JWT.*SECRET/i.test(key)) return 'jwt_secret';
    if (/SESSION.*SECRET/i.test(key)) return 'session_secret';
    if (/ENCRYPTION.*KEY/i.test(key)) return 'encryption_key';
    if (/API.*KEY/i.test(key)) return 'api_key';
    if (/API.*SECRET/i.test(key)) return 'api_secret';
    if (/PASSWORD/i.test(key)) return 'password';
    if (/TOKEN/i.test(key)) return 'token';
    if (/PRIVATE.*KEY/i.test(key)) return 'private_key';
    return 'generic_secret';
  }

  /**
   * Check if secret is rotatable
   * @param {string} key - Secret key
   * @returns {boolean} Is rotatable
   */
  isRotatable(key) {
    // Some secrets may not be safe to auto-rotate
    const nonRotatable = [
      /GITHUB_TOKEN/i, // External service tokens
      /SLACK_TOKEN/i,
      /STRIPE_KEY/i
    ];

    return !nonRotatable.some(pattern => pattern.test(key));
  }

  /**
   * Generate new secret value
   * @param {string} type - Secret type
   * @returns {string} Generated secret
   */
  generateSecret(type) {
    const length = Math.floor(
      Math.random() * (this.options.maxPasswordLength - this.options.minPasswordLength + 1)
    ) + this.options.minPasswordLength;

    switch (type) {
      case 'jwt_secret':
      case 'session_secret':
      case 'encryption_key':
        // High entropy for cryptographic secrets
        return crypto.randomBytes(length).toString('base64');

      case 'api_key':
        // Alphanumeric format
        return crypto.randomBytes(length).toString('hex');

      case 'api_secret':
        // Base64 encoded
        return crypto.randomBytes(length).toString('base64url');

      case 'password':
        // Strong password with mixed characters
        return this.generateStrongPassword(length);

      case 'token':
        // URL-safe token
        return crypto.randomBytes(length).toString('base64url');

      default:
        // Default high-entropy secret
        return crypto.randomBytes(length).toString('base64');
    }
  }

  /**
   * Generate strong password
   * @param {number} length - Password length
   * @returns {string} Strong password
   */
  generateStrongPassword(length) {
    const charset = {
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      numbers: '0123456789',
      special: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    };

    const allChars = Object.values(charset).join('');
    let password = '';

    // Ensure at least one character from each category
    password += charset.lowercase[Math.floor(Math.random() * charset.lowercase.length)];
    password += charset.uppercase[Math.floor(Math.random() * charset.uppercase.length)];
    password += charset.numbers[Math.floor(Math.random() * charset.numbers.length)];
    password += charset.special[Math.floor(Math.random() * charset.special.length)];

    // Fill remaining length
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Rotate secret
   * @param {string} secretKey - Secret key to rotate
   * @param {Object} options - Rotation options
   * @returns {Promise<Object>} Rotation result
   */
  async rotateSecret(secretKey, options = {}) {
    const secret = this.secrets.get(secretKey);

    if (!secret) {
      throw new Error(`Secret not found: ${secretKey}`);
    }

    if (!secret.rotatable && !options.force) {
      throw new Error(`Secret is not rotatable: ${secretKey}. Use force option to override.`);
    }

    console.log(`[SecretsRotation] Rotating secret: ${secretKey}`);

    const oldValue = secret.value;
    const newValue = options.newValue || this.generateSecret(secret.type);

    if (this.options.dryRun) {
      console.log(`[SecretsRotation] [DRY RUN] Would rotate: ${secretKey}`);
      return {
        success: true,
        dryRun: true,
        secretKey,
        rotatedAt: Date.now()
      };
    }

    try {
      // Backup current secrets
      await this.backupSecrets();

      // Update secret value
      secret.value = newValue;
      secret.lastRotated = Date.now();
      secret.rotationCount++;

      // Update environment file
      await this.updateEnvFile(secretKey, newValue);

      // Record rotation history
      const rotationRecord = {
        secretKey,
        type: secret.type,
        rotatedAt: Date.now(),
        rotatedBy: options.rotatedBy || 'system',
        reason: options.reason || 'scheduled_rotation',
        oldValueHash: this.hashValue(oldValue),
        newValueHash: this.hashValue(newValue)
      };

      this.rotationHistory.push(rotationRecord);
      await this.saveRotationHistory();

      // Audit logging
      await this.logRotation(rotationRecord);

      // Emit event
      this.emit('secretRotated', {
        secretKey,
        type: secret.type,
        rotatedAt: rotationRecord.rotatedAt
      });

      // Notify if enabled
      if (this.options.enableNotifications) {
        await this.notifyRotation(rotationRecord);
      }

      console.log(`[SecretsRotation] Successfully rotated: ${secretKey}`);

      return {
        success: true,
        secretKey,
        type: secret.type,
        rotatedAt: rotationRecord.rotatedAt,
        rotationCount: secret.rotationCount
      };
    } catch (error) {
      console.error(`[SecretsRotation] Rotation failed: ${secretKey}`, error);
      throw error;
    }
  }

  /**
   * Rotate all rotatable secrets
   * @param {Object} options - Rotation options
   * @returns {Promise<Object>} Rotation results
   */
  async rotateAllSecrets(options = {}) {
    console.log('[SecretsRotation] Starting rotation of all secrets...');

    const results = {
      timestamp: Date.now(),
      totalSecrets: this.secrets.size,
      rotatedSecrets: 0,
      skippedSecrets: 0,
      failedSecrets: 0,
      errors: []
    };

    for (const [key, secret] of this.secrets.entries()) {
      if (!secret.rotatable && !options.force) {
        results.skippedSecrets++;
        continue;
      }

      try {
        await this.rotateSecret(key, options);
        results.rotatedSecrets++;
      } catch (error) {
        results.failedSecrets++;
        results.errors.push({
          secretKey: key,
          error: error.message
        });
      }
    }

    console.log(`[SecretsRotation] Rotation complete: ${results.rotatedSecrets}/${this.secrets.size} rotated`);

    return results;
  }

  /**
   * Backup secrets before rotation
   */
  async backupSecrets() {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupFile = path.join(this.options.backupDir, `secrets-backup-${timestamp}.env`);

    try {
      const envPath = path.resolve(this.options.envFile);
      const content = await fs.readFile(envPath, 'utf8');
      await fs.writeFile(backupFile, content, 'utf8');

      console.log(`[SecretsRotation] Secrets backed up to: ${backupFile}`);
    } catch (error) {
      console.error('[SecretsRotation] Backup failed:', error);
      throw error;
    }
  }

  /**
   * Update environment file with new secret
   * @param {string} key - Secret key
   * @param {string} value - New value
   */
  async updateEnvFile(key, value) {
    const envPath = path.resolve(this.options.envFile);

    try {
      const content = await fs.readFile(envPath, 'utf8');
      const lines = content.split('\n');

      let updated = false;
      const newLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith(`${key}=`)) {
          updated = true;
          return `${key}=${value}`;
        }
        return line;
      });

      if (!updated) {
        // Key not found, append it
        newLines.push(`${key}=${value}`);
      }

      await fs.writeFile(envPath, newLines.join('\n'), 'utf8');

      console.log(`[SecretsRotation] Updated environment file: ${key}`);
    } catch (error) {
      console.error('[SecretsRotation] Failed to update environment file:', error);
      throw error;
    }
  }

  /**
   * Hash value for audit logging
   * @param {string} value - Value to hash
   * @returns {string} SHA256 hash
   */
  hashValue(value) {
    return crypto.createHash('sha256').update(value).digest('hex').substring(0, 16);
  }

  /**
   * Log rotation to audit file
   * @param {Object} record - Rotation record
   */
  async logRotation(record) {
    const logEntry = {
      timestamp: new Date(record.rotatedAt).toISOString(),
      secretKey: record.secretKey,
      type: record.type,
      rotatedBy: record.rotatedBy,
      reason: record.reason,
      oldValueHash: record.oldValueHash,
      newValueHash: record.newValueHash
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    await fs.appendFile(this.options.auditLogFile, logLine, 'utf8');
  }

  /**
   * Load rotation history
   */
  async loadRotationHistory() {
    const historyFile = path.join(path.dirname(this.options.envFile), 'rotation-history.json');

    try {
      const content = await fs.readFile(historyFile, 'utf8');
      const data = JSON.parse(content);
      this.rotationHistory = data.history || [];

      console.log(`[SecretsRotation] Loaded ${this.rotationHistory.length} rotation records`);
    } catch (error) {
      console.log('[SecretsRotation] No rotation history found');
    }
  }

  /**
   * Save rotation history
   */
  async saveRotationHistory() {
    const historyFile = path.join(path.dirname(this.options.envFile), 'rotation-history.json');

    const data = {
      version: '1.0',
      updated: new Date().toISOString(),
      history: this.rotationHistory.slice(-1000) // Keep last 1000 records
    };

    await fs.writeFile(historyFile, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * Notify rotation
   * @param {Object} record - Rotation record
   */
  async notifyRotation(record) {
    // Integration with notification system
    this.emit('rotationNotification', {
      severity: 'info',
      title: 'Secret Rotated',
      message: `Secret "${record.secretKey}" has been rotated`,
      metadata: {
        secretKey: record.secretKey,
        type: record.type,
        rotatedAt: record.rotatedAt,
        rotatedBy: record.rotatedBy,
        reason: record.reason
      }
    });
  }

  /**
   * Check secrets that need rotation
   * @returns {Array} Secrets needing rotation
   */
  checkRotationNeeded() {
    const now = Date.now();
    const needsRotation = [];

    for (const [key, secret] of this.secrets.entries()) {
      if (!secret.rotatable) continue;

      const timeSinceRotation = secret.lastRotated
        ? now - secret.lastRotated
        : Infinity;

      if (timeSinceRotation >= this.options.rotationInterval) {
        needsRotation.push({
          key,
          type: secret.type,
          lastRotated: secret.lastRotated,
          daysSinceRotation: Math.floor(timeSinceRotation / 86400000)
        });
      }
    }

    return needsRotation;
  }

  /**
   * Start automatic rotation
   */
  startAutoRotation() {
    if (this.rotationTimer) {
      return;
    }

    console.log(`[SecretsRotation] Auto rotation enabled (interval: ${this.options.rotationInterval}ms)`);

    // Check daily for secrets needing rotation
    this.rotationTimer = setInterval(async () => {
      try {
        const needsRotation = this.checkRotationNeeded();

        if (needsRotation.length > 0) {
          console.log(`[SecretsRotation] ${needsRotation.length} secrets need rotation`);

          for (const { key } of needsRotation) {
            try {
              await this.rotateSecret(key, {
                reason: 'scheduled_rotation',
                rotatedBy: 'auto_rotation'
              });
            } catch (error) {
              console.error(`[SecretsRotation] Auto rotation failed: ${key}`, error);
            }
          }
        }
      } catch (error) {
        console.error('[SecretsRotation] Auto rotation check failed:', error);
      }
    }, 86400000); // Check daily
  }

  /**
   * Stop automatic rotation
   */
  stopAutoRotation() {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
      console.log('[SecretsRotation] Auto rotation disabled');
    }
  }

  /**
   * Get rotation statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const now = Date.now();

    return {
      totalSecrets: this.secrets.size,
      rotatableSecrets: Array.from(this.secrets.values()).filter(s => s.rotatable).length,
      nonRotatableSecrets: Array.from(this.secrets.values()).filter(s => !s.rotatable).length,
      totalRotations: this.rotationHistory.length,
      secretsByType: this.groupSecretsByType(),
      needsRotation: this.checkRotationNeeded().length,
      recentRotations: this.rotationHistory.slice(-10)
    };
  }

  /**
   * Group secrets by type
   * @returns {Object} Grouped secrets
   */
  groupSecretsByType() {
    const grouped = {};

    for (const secret of this.secrets.values()) {
      if (!grouped[secret.type]) {
        grouped[secret.type] = 0;
      }
      grouped[secret.type]++;
    }

    return grouped;
  }

  /**
   * Get secret info (without value)
   * @param {string} secretKey - Secret key
   * @returns {Object|null} Secret info
   */
  getSecretInfo(secretKey) {
    const secret = this.secrets.get(secretKey);

    if (!secret) {
      return null;
    }

    return {
      key: secret.key,
      type: secret.type,
      rotatable: secret.rotatable,
      lastRotated: secret.lastRotated,
      rotationCount: secret.rotationCount,
      valueLength: secret.value.length
    };
  }

  /**
   * Generate rotation report
   * @returns {Object} Rotation report
   */
  generateReport() {
    const stats = this.getStats();
    const needsRotation = this.checkRotationNeeded();

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalSecrets: stats.totalSecrets,
        rotatableSecrets: stats.rotatableSecrets,
        nonRotatableSecrets: stats.nonRotatableSecrets,
        totalRotations: stats.totalRotations,
        needsRotation: needsRotation.length
      },
      secretsByType: stats.secretsByType,
      needsRotation: needsRotation,
      recentRotations: stats.recentRotations.map(r => ({
        secretKey: r.secretKey,
        type: r.type,
        rotatedAt: new Date(r.rotatedAt).toISOString(),
        rotatedBy: r.rotatedBy,
        reason: r.reason
      }))
    };
  }
}

module.exports = SecretsRotation;
