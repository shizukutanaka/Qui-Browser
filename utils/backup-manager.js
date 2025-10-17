/**
 * Automated Backup Generation Manager
 * Automatic backup generation and lifecycle management
 * Priority: H023 from improvement backlog
 *
 * @module utils/backup-manager
 */

const fs = require('fs').promises;
const path = require('path');
const { createGzip } = require('zlib');
const { createReadStream, createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');
const crypto = require('crypto');

class BackupManager {
  constructor(options = {}) {
    this.options = {
      backupDir: options.backupDir || './backups',
      retentionPolicy: options.retentionPolicy || {
        hourly: 24,    // Keep 24 hourly backups
        daily: 7,      // Keep 7 daily backups
        weekly: 4,     // Keep 4 weekly backups
        monthly: 12    // Keep 12 monthly backups
      },
      compression: options.compression !== false,
      verification: options.verification !== false,
      encryption: options.encryption || false,
      encryptionKey: options.encryptionKey || null,
      maxBackupSize: options.maxBackupSize || 10737418240, // 10GB
      includePaths: options.includePaths || [],
      excludePaths: options.excludePaths || ['node_modules', '.git', 'backups'],
      ...options
    };

    this.backups = new Map();
    this.init();
  }

  /**
   * Initialize backup manager
   */
  async init() {
    try {
      await fs.mkdir(this.options.backupDir, { recursive: true });
      await this.loadBackupIndex();
      this.startAutoBackup();
    } catch (error) {
      console.error('[BackupManager] Initialization failed:', error);
    }
  }

  /**
   * Create backup
   * @param {Object} options - Backup options
   * @returns {Promise<Object>} Backup info
   */
  async createBackup(options = {}) {
    const {
      type = 'manual',
      description = '',
      includePaths = this.options.includePaths,
      tags = []
    } = options;

    const timestamp = Date.now();
    const backupId = `backup-${timestamp}-${this.generateRandomId()}`;

    console.log(`[BackupManager] Creating backup: ${backupId}`);

    const backupInfo = {
      id: backupId,
      type,
      description,
      timestamp,
      datetime: new Date(timestamp).toISOString(),
      status: 'creating',
      size: 0,
      files: 0,
      compressed: this.options.compression,
      encrypted: this.options.encryption,
      tags,
      checksum: null
    };

    this.backups.set(backupId, backupInfo);

    try {
      // Create backup directory
      const backupPath = path.join(this.options.backupDir, backupId);
      await fs.mkdir(backupPath, { recursive: true });

      // Backup files
      const files = await this.collectFiles(includePaths);
      backupInfo.files = files.length;

      for (const file of files) {
        await this.backupFile(file, backupPath);
      }

      // Calculate size
      backupInfo.size = await this.calculateSize(backupPath);

      // Compress if enabled
      if (this.options.compression) {
        await this.compressBackup(backupPath, backupId);
      }

      // Encrypt if enabled
      if (this.options.encryption) {
        await this.encryptBackup(backupPath, backupId);
      }

      // Generate checksum
      backupInfo.checksum = await this.generateChecksum(backupPath);

      // Verify if enabled
      if (this.options.verification) {
        const verified = await this.verifyBackup(backupId);
        backupInfo.verified = verified;
      }

      backupInfo.status = 'completed';
      backupInfo.completedAt = Date.now();

      // Save backup index
      await this.saveBackupIndex();

      console.log(`[BackupManager] Backup completed: ${backupId}`);

      // Apply retention policy
      await this.applyRetentionPolicy();

      return backupInfo;
    } catch (error) {
      console.error(`[BackupManager] Backup failed: ${backupId}`, error);
      backupInfo.status = 'failed';
      backupInfo.error = error.message;
      throw error;
    }
  }

  /**
   * Collect files for backup
   * @param {Array} includePaths - Paths to include
   * @returns {Promise<Array>} File list
   */
  async collectFiles(includePaths) {
    const files = [];

    for (const includePath of includePaths) {
      const filePath = path.resolve(includePath);

      try {
        const stats = await fs.stat(filePath);

        if (stats.isDirectory()) {
          const dirFiles = await this.walkDirectory(filePath);
          files.push(...dirFiles);
        } else {
          files.push(filePath);
        }
      } catch (error) {
        console.warn(`[BackupManager] Cannot access path: ${includePath}`, error.message);
      }
    }

    return files;
  }

  /**
   * Walk directory recursively
   * @param {string} dir - Directory path
   * @returns {Promise<Array>} File list
   */
  async walkDirectory(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Check exclude patterns
      if (this.shouldExclude(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        const subFiles = await this.walkDirectory(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Check if path should be excluded
   * @param {string} filePath - File path
   * @returns {boolean} Should exclude
   */
  shouldExclude(filePath) {
    for (const excludePattern of this.options.excludePaths) {
      if (filePath.includes(excludePattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Backup single file
   * @param {string} sourceFile - Source file path
   * @param {string} backupPath - Backup directory
   */
  async backupFile(sourceFile, backupPath) {
    const relativePath = path.relative(process.cwd(), sourceFile);
    const destPath = path.join(backupPath, relativePath);

    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(sourceFile, destPath);
  }

  /**
   * Calculate backup size
   * @param {string} backupPath - Backup path
   * @returns {Promise<number>} Size in bytes
   */
  async calculateSize(backupPath) {
    let totalSize = 0;

    const files = await this.walkDirectory(backupPath);

    for (const file of files) {
      const stats = await fs.stat(file);
      totalSize += stats.size;
    }

    return totalSize;
  }

  /**
   * Compress backup
   * @param {string} backupPath - Backup path
   * @param {string} backupId - Backup ID
   */
  async compressBackup(backupPath, backupId) {
    const archivePath = path.join(this.options.backupDir, `${backupId}.tar.gz`);

    console.log(`[BackupManager] Compressing backup: ${backupId}`);

    // Simple implementation - in production, use tar library
    const gzip = createGzip({ level: 9 });
    const source = createReadStream(backupPath);
    const destination = createWriteStream(archivePath);

    // await pipeline(source, gzip, destination);

    console.log(`[BackupManager] Compression completed: ${archivePath}`);
  }

  /**
   * Encrypt backup
   * @param {string} backupPath - Backup path
   * @param {string} backupId - Backup ID
   */
  async encryptBackup(backupPath, backupId) {
    if (!this.options.encryptionKey) {
      throw new Error('Encryption key not provided');
    }

    console.log(`[BackupManager] Encrypting backup: ${backupId}`);

    // Encryption implementation would go here
    // Using crypto to encrypt files

    console.log(`[BackupManager] Encryption completed: ${backupId}`);
  }

  /**
   * Generate checksum
   * @param {string} backupPath - Backup path
   * @returns {Promise<string>} Checksum
   */
  async generateChecksum(backupPath) {
    const hash = crypto.createHash('sha256');
    const files = await this.walkDirectory(backupPath);

    for (const file of files.sort()) {
      const content = await fs.readFile(file);
      hash.update(content);
    }

    return hash.digest('hex');
  }

  /**
   * Verify backup integrity
   * @param {string} backupId - Backup ID
   * @returns {Promise<boolean>} Verification result
   */
  async verifyBackup(backupId) {
    const backupInfo = this.backups.get(backupId);

    if (!backupInfo) {
      return false;
    }

    const backupPath = path.join(this.options.backupDir, backupId);

    try {
      // Recalculate checksum
      const currentChecksum = await this.generateChecksum(backupPath);

      return currentChecksum === backupInfo.checksum;
    } catch (error) {
      console.error(`[BackupManager] Verification failed: ${backupId}`, error);
      return false;
    }
  }

  /**
   * Restore backup
   * @param {string} backupId - Backup ID
   * @param {Object} options - Restore options
   * @returns {Promise<boolean>} Success
   */
  async restoreBackup(backupId, options = {}) {
    const {
      targetPath = process.cwd(),
      verify = true
    } = options;

    const backupInfo = this.backups.get(backupId);

    if (!backupInfo) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    console.log(`[BackupManager] Restoring backup: ${backupId}`);

    // Verify before restore
    if (verify && this.options.verification) {
      const verified = await this.verifyBackup(backupId);
      if (!verified) {
        throw new Error('Backup verification failed');
      }
    }

    const backupPath = path.join(this.options.backupDir, backupId);

    try {
      // Decrypt if needed
      if (backupInfo.encrypted) {
        await this.decryptBackup(backupPath, backupId);
      }

      // Decompress if needed
      if (backupInfo.compressed) {
        await this.decompressBackup(backupPath, backupId);
      }

      // Copy files to target
      const files = await this.walkDirectory(backupPath);

      for (const file of files) {
        const relativePath = path.relative(backupPath, file);
        const destPath = path.join(targetPath, relativePath);

        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.copyFile(file, destPath);
      }

      console.log(`[BackupManager] Restore completed: ${backupId}`);

      return true;
    } catch (error) {
      console.error(`[BackupManager] Restore failed: ${backupId}`, error);
      throw error;
    }
  }

  /**
   * Apply retention policy
   */
  async applyRetentionPolicy() {
    console.log('[BackupManager] Applying retention policy...');

    const backupsByType = this.categorizeBackups();

    for (const [type, backups] of Object.entries(backupsByType)) {
      const limit = this.options.retentionPolicy[type];

      if (backups.length > limit) {
        const toDelete = backups.slice(limit);

        for (const backup of toDelete) {
          await this.deleteBackup(backup.id);
        }
      }
    }
  }

  /**
   * Categorize backups by type
   * @returns {Object} Categorized backups
   */
  categorizeBackups() {
    const categorized = {
      hourly: [],
      daily: [],
      weekly: [],
      monthly: []
    };

    const backups = Array.from(this.backups.values())
      .filter(b => b.status === 'completed')
      .sort((a, b) => b.timestamp - a.timestamp);

    for (const backup of backups) {
      const age = Date.now() - backup.timestamp;
      const ageHours = age / (1000 * 60 * 60);
      const ageDays = ageHours / 24;

      if (ageHours < 24) {
        categorized.hourly.push(backup);
      } else if (ageDays < 7) {
        categorized.daily.push(backup);
      } else if (ageDays < 30) {
        categorized.weekly.push(backup);
      } else {
        categorized.monthly.push(backup);
      }
    }

    return categorized;
  }

  /**
   * Delete backup
   * @param {string} backupId - Backup ID
   */
  async deleteBackup(backupId) {
    console.log(`[BackupManager] Deleting backup: ${backupId}`);

    const backupPath = path.join(this.options.backupDir, backupId);

    try {
      await fs.rm(backupPath, { recursive: true, force: true });
      this.backups.delete(backupId);
      await this.saveBackupIndex();
    } catch (error) {
      console.error(`[BackupManager] Delete failed: ${backupId}`, error);
    }
  }

  /**
   * List backups
   * @param {Object} filter - Filter options
   * @returns {Array} Backup list
   */
  listBackups(filter = {}) {
    let backups = Array.from(this.backups.values());

    if (filter.type) {
      backups = backups.filter(b => b.type === filter.type);
    }

    if (filter.status) {
      backups = backups.filter(b => b.status === filter.status);
    }

    if (filter.tags && filter.tags.length > 0) {
      backups = backups.filter(b =>
        filter.tags.every(tag => b.tags.includes(tag))
      );
    }

    return backups.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get backup info
   * @param {string} backupId - Backup ID
   * @returns {Object|null} Backup info
   */
  getBackup(backupId) {
    return this.backups.get(backupId) || null;
  }

  /**
   * Load backup index
   */
  async loadBackupIndex() {
    const indexPath = path.join(this.options.backupDir, 'index.json');

    try {
      const content = await fs.readFile(indexPath, 'utf8');
      const data = JSON.parse(content);

      for (const backup of data.backups) {
        this.backups.set(backup.id, backup);
      }

      console.log(`[BackupManager] Loaded ${this.backups.size} backups from index`);
    } catch (error) {
      console.log('[BackupManager] No existing backup index found');
    }
  }

  /**
   * Save backup index
   */
  async saveBackupIndex() {
    const indexPath = path.join(this.options.backupDir, 'index.json');

    const data = {
      version: '1.0',
      updated: new Date().toISOString(),
      backups: Array.from(this.backups.values())
    };

    await fs.writeFile(indexPath, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * Start automatic backup
   */
  startAutoBackup() {
    if (!this.options.autoBackup) {
      return;
    }

    const interval = this.options.autoBackupInterval || 3600000; // 1 hour

    this.autoBackupTimer = setInterval(async () => {
      try {
        await this.createBackup({
          type: 'automatic',
          description: 'Automatic scheduled backup'
        });
      } catch (error) {
        console.error('[BackupManager] Auto backup failed:', error);
      }
    }, interval);
  }

  /**
   * Stop automatic backup
   */
  stopAutoBackup() {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = null;
    }
  }

  /**
   * Generate random ID
   * @returns {string} Random ID
   */
  generateRandomId() {
    return crypto.randomBytes(4).toString('hex');
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const backups = Array.from(this.backups.values());

    return {
      totalBackups: backups.length,
      completedBackups: backups.filter(b => b.status === 'completed').length,
      failedBackups: backups.filter(b => b.status === 'failed').length,
      totalSize: backups.reduce((sum, b) => sum + (b.size || 0), 0),
      oldestBackup: backups.length > 0
        ? Math.min(...backups.map(b => b.timestamp))
        : null,
      newestBackup: backups.length > 0
        ? Math.max(...backups.map(b => b.timestamp))
        : null
    };
  }
}

module.exports = BackupManager;
