/**
 * Secure file upload utilities for Qui Browser
 * Provides comprehensive file handling with security validations
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');

class FileUploadManager {
  constructor(options = {}) {
    this.uploadDir = options.uploadDir || path.join(__dirname, '..', 'uploads');
    this.tempDir = options.tempDir || path.join(this.uploadDir, 'temp');
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.allowedTypes = options.allowedTypes || [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'application/json',
      'application/zip', 'application/x-zip-compressed'
    ];
    this.allowedExtensions = options.allowedExtensions || [
      '.jpg', '.jpeg', '.png', '.gif', '.webp',
      '.pdf', '.txt', '.json', '.zip'
    ];

    // Initialize directories
    this.initializeDirectories();
  }

  async initializeDirectories() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create upload directories:', error);
    }
  }

  /**
   * Validate file before upload
   * @param {Object} file - File object from multipart form
   * @returns {Object} Validation result
   */
  validateFile(file) {
    const errors = [];
    const warnings = [];

    // Check file size
    if (file.size > this.maxFileSize) {
      errors.push(`File size ${file.size} exceeds maximum ${this.maxFileSize}`);
    }

    // Check MIME type
    if (!this.allowedTypes.includes(file.mimetype)) {
      errors.push(`MIME type ${file.mimetype} is not allowed`);
    }

    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!this.allowedExtensions.includes(ext)) {
      errors.push(`File extension ${ext} is not allowed`);
    }

    // Check filename security
    if (this.hasUnsafeFilename(file.originalname)) {
      errors.push('Filename contains unsafe characters');
    }

    // Basic content validation
    if (file.mimetype.startsWith('image/')) {
      // Could add image-specific validation here
      warnings.push('Image files should be validated for malicious content');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check for unsafe filename characters
   * @param {string} filename
   * @returns {boolean}
   */
  hasUnsafeFilename(filename) {
    // Check for path traversal attempts
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return true;
    }

    // Check for null bytes
    if (filename.includes('\0')) {
      return true;
    }

    // Check for control characters
    for (let i = 0; i < filename.length; i++) {
      const charCode = filename.charCodeAt(i);
      if (charCode < 32 || charCode === 127) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate secure filename
   * @param {string} originalName
   * @returns {string}
   */
  generateSecureFilename(originalName) {
    const ext = path.extname(originalName);
    const basename = path.basename(originalName, ext);
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    return `${basename}_${timestamp}_${random}${ext}`;
  }

  /**
   * Save uploaded file
   * @param {Object} file - Multer file object
   * @param {Object} options - Additional options
   * @returns {Object} File info
   */
  async saveFile(file, options = {}) {
    const validation = this.validateFile(file);
    if (!validation.isValid) {
      throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
    }

    const secureName = this.generateSecureFilename(file.originalname);
    const filePath = path.join(this.uploadDir, secureName);

    try {
      // Move file from temp to final location
      if (file.path) {
        await fs.rename(file.path, filePath);
      } else if (file.buffer) {
        await fs.writeFile(filePath, file.buffer);
      } else {
        throw new Error('No file data provided');
      }

      // Get file stats
      const stats = await fs.stat(filePath);

      const fileInfo = {
        id: crypto.randomUUID(),
        originalName: file.originalname,
        secureName,
        path: filePath,
        size: stats.size,
        mimetype: file.mimetype,
        extension: path.extname(secureName),
        uploadedAt: new Date(),
        hash: await this.calculateFileHash(filePath),
        metadata: options.metadata || {}
      };

      return fileInfo;
    } catch (error) {
      // Clean up on failure
      try {
        await fs.unlink(filePath);
      } catch (cleanupError) {
        console.error('Failed to cleanup failed upload:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * Calculate file hash for integrity checking
   * @param {string} filePath
   * @returns {string}
   */
  async calculateFileHash(filePath) {
    const fileStream = require('fs').createReadStream(filePath);
    const hash = crypto.createHash('sha256');

    return new Promise((resolve, reject) => {
      fileStream.on('data', chunk => hash.update(chunk));
      fileStream.on('end', () => resolve(hash.digest('hex')));
      fileStream.on('error', reject);
    });
  }

  /**
   * Delete file
   * @param {string} secureName
   * @returns {boolean}
   */
  async deleteFile(secureName) {
    try {
      const filePath = path.join(this.uploadDir, secureName);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error('Failed to delete file:', error);
      return false;
    }
  }

  /**
   * Get file info
   * @param {string} secureName
   * @returns {Object|null}
   */
  async getFileInfo(secureName) {
    try {
      const filePath = path.join(this.uploadDir, secureName);
      const stats = await fs.stat(filePath);

      return {
        secureName,
        path: filePath,
        size: stats.size,
        modifiedAt: stats.mtime,
        exists: true
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * List uploaded files
   * @param {Object} options - Filter options
   * @returns {Array}
   */
  async listFiles(options = {}) {
    try {
      const files = await fs.readdir(this.uploadDir);
      const fileInfos = [];

      for (const file of files) {
        if (file === 'temp') continue;

        const filePath = path.join(this.uploadDir, file);
        try {
          const stats = await fs.stat(filePath);
          if (stats.isFile()) {
            fileInfos.push({
              name: file,
              size: stats.size,
              modifiedAt: stats.mtime,
              extension: path.extname(file)
            });
          }
        } catch (error) {
          console.warn(`Failed to stat file ${file}:`, error);
        }
      }

      // Apply filters
      let filtered = fileInfos;
      if (options.extension) {
        filtered = filtered.filter(f => f.extension === options.extension);
      }
      if (options.limit) {
        filtered = filtered.slice(0, options.limit);
      }

      return filtered;
    } catch (error) {
      console.error('Failed to list files:', error);
      return [];
    }
  }

  /**
   * Clean up old temp files
   * @param {number} maxAge - Max age in milliseconds
   */
  async cleanupTempFiles(maxAge = 3600000) { // 1 hour
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        try {
          const stats = await fs.stat(filePath);
          if (now - stats.mtime.getTime() > maxAge) {
            await fs.unlink(filePath);
          }
        } catch (error) {
          console.warn(`Failed to cleanup temp file ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
    }
  }

  /**
   * Get upload statistics
   * @returns {Object}
   */
  async getStats() {
    try {
      const files = await this.listFiles();
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);

      return {
        totalFiles: files.length,
        totalSize,
        totalSizeFormatted: this.formatBytes(totalSize),
        fileTypes: this.groupByExtension(files)
      };
    } catch (error) {
      console.error('Failed to get upload stats:', error);
      return { totalFiles: 0, totalSize: 0, totalSizeFormatted: '0 B', fileTypes: {} };
    }
  }

  /**
   * Group files by extension
   * @param {Array} files
   * @returns {Object}
   */
  groupByExtension(files) {
    return files.reduce((groups, file) => {
      const ext = file.extension || 'no-ext';
      groups[ext] = (groups[ext] || 0) + 1;
      return groups;
    }, {});
  }

  /**
   * Format bytes for display
   * @param {number} bytes
   * @returns {string}
   */
  formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

module.exports = FileUploadManager;
