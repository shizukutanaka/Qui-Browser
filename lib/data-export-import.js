/**
 * Qui Browser - Data Export/Import Module
 *
 * Handles exporting and importing user data for backup, migration, and portability
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { createReadStream, createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');

class DataExportImport {
  constructor(config, databaseManager) {
    this.config = config;
    this.databaseManager = databaseManager;
    this.exportDir = path.join(process.cwd(), 'exports');
    this.maxFileSize = 50 * 1024 * 1024; // 50MB limit
    this.supportedFormats = ['json', 'csv', 'xml'];

    this.ensureExportDirectory();
  }

  /**
   * Ensure export directory exists
   */
  async ensureExportDirectory() {
    try {
      await fs.mkdir(this.exportDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to create export directory:', error.message);
    }
  }

  /**
   * Export user data
   */
  async exportData(userId, options = {}) {
    const {
      format = 'json',
      includeBookmarks = true,
      includeHistory = true,
      includeSettings = true,
      includeSessions = false,
      includeFiles = false,
      dateRange = null,
      compress = true
    } = options;

    if (!this.supportedFormats.includes(format)) {
      throw new Error(`Unsupported format: ${format}`);
    }

    const exportId = this.generateExportId();
    const timestamp = new Date().toISOString();

    // Gather data
    const data = {
      metadata: {
        exportId,
        userId,
        timestamp,
        format,
        version: '1.0.0',
        quiBrowserVersion: '1.1.0'
      },
      data: {}
    };

    // Collect bookmarks
    if (includeBookmarks) {
      try {
        data.data.bookmarks = await this.databaseManager.getBookmarks(userId);
      } catch (error) {
        console.warn('Failed to export bookmarks:', error.message);
        data.data.bookmarks = [];
      }
    }

    // Collect history
    if (includeHistory) {
      try {
        const historyOptions = {};
        if (dateRange) {
          historyOptions.startDate = dateRange.start;
          historyOptions.endDate = dateRange.end;
        }
        data.data.history = await this.databaseManager.getHistory(userId, historyOptions);
      } catch (error) {
        console.warn('Failed to export history:', error.message);
        data.data.history = [];
      }
    }

    // Collect settings
    if (includeSettings) {
      try {
        data.data.settings = await this.databaseManager.getSettings(userId);
      } catch (error) {
        console.warn('Failed to export settings:', error.message);
        data.data.settings = {};
      }
    }

    // Collect sessions
    if (includeSessions) {
      try {
        data.data.sessions = await this.databaseManager.getSessions(userId);
      } catch (error) {
        console.warn('Failed to export sessions:', error.message);
        data.data.sessions = [];
      }
    }

    // Collect file metadata
    if (includeFiles) {
      try {
        data.data.files = await this.databaseManager.listUserFiles(userId);
      } catch (error) {
        console.warn('Failed to export files:', error.message);
        data.data.files = [];
      }
    }

    // Generate export file
    const exportPath = await this.generateExportFile(data, format, compress);
    const stats = await fs.stat(exportPath);

    return {
      exportId,
      filePath: exportPath,
      fileName: path.basename(exportPath),
      size: stats.size,
      format,
      compressed: compress,
      dataTypes: Object.keys(data.data),
      recordCounts: Object.fromEntries(
        Object.entries(data.data).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.length : 1
        ])
      ),
      timestamp
    };
  }

  /**
   * Import user data
   */
  async importData(userId, importPath, options = {}) {
    const {
      format = null,
      overwrite = false,
      validateOnly = false,
      skipValidation = false
    } = options;

    // Detect format if not specified
    const detectedFormat = format || this.detectFormat(importPath);
    if (!this.supportedFormats.includes(detectedFormat)) {
      throw new Error(`Unsupported format: ${detectedFormat}`);
    }

    // Read and parse data
    const rawData = await this.readImportFile(importPath);
    const data = await this.parseImportData(rawData, detectedFormat);

    // Validate data structure
    if (!skipValidation) {
      const validation = this.validateImportData(data);
      if (!validation.valid) {
        throw new Error(`Invalid import data: ${validation.errors.join(', ')}`);
      }
    }

    if (validateOnly) {
      return {
        valid: true,
        dataTypes: Object.keys(data.data || {}),
        recordCounts: this.countImportRecords(data),
        warnings: []
      };
    }

    // Import data
    const results = await this.performImport(userId, data, { overwrite });

    return {
      success: true,
      imported: results,
      skipped: [],
      errors: [],
      dataTypes: Object.keys(data.data || {}),
      recordCounts: this.countImportRecords(data)
    };
  }

  /**
   * Generate export file
   */
  async generateExportFile(data, format, compress) {
    const exportId = data.metadata.exportId;
    const fileName = `qui-browser-export-${exportId}.${format}`;
    const filePath = path.join(this.exportDir, fileName);

    // Serialize data
    let content;
    switch (format) {
      case 'json':
        content = JSON.stringify(data, null, 2);
        break;
      case 'csv':
        content = this.convertToCSV(data);
        break;
      case 'xml':
        content = this.convertToXML(data);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Write file
    await fs.writeFile(filePath, content, 'utf8');

    // Compress if requested
    if (compress) {
      const compressedPath = await this.compressFile(filePath);
      // Clean up uncompressed file
      await fs.unlink(filePath);
      return compressedPath;
    }

    return filePath;
  }

  /**
   * Read import file
   */
  async readImportFile(filePath) {
    const stats = await fs.stat(filePath);

    if (stats.size > this.maxFileSize) {
      throw new Error(`File too large: ${stats.size} bytes (max: ${this.maxFileSize})`);
    }

    // Handle compressed files
    if (filePath.endsWith('.gz') || filePath.endsWith('.zip')) {
      return await this.decompressFile(filePath);
    }

    return await fs.readFile(filePath, 'utf8');
  }

  /**
   * Parse import data
   */
  async parseImportData(rawData, format) {
    switch (format) {
      case 'json':
        return JSON.parse(rawData);
      case 'csv':
        return this.parseCSV(rawData);
      case 'xml':
        return this.parseXML(rawData);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Validate import data structure
   */
  validateImportData(data) {
    const errors = [];
    const warnings = [];

    if (!data || typeof data !== 'object') {
      errors.push('Invalid data structure');
      return { valid: false, errors, warnings };
    }

    // Check metadata
    if (!data.metadata) {
      warnings.push('Missing metadata');
    } else {
      if (!data.metadata.userId && !data.metadata.exportId) {
        warnings.push('Missing user identification in metadata');
      }
    }

    // Check data sections
    if (!data.data || typeof data.data !== 'object') {
      errors.push('Missing data section');
      return { valid: false, errors, warnings };
    }

    // Validate bookmarks
    if (data.data.bookmarks) {
      if (!Array.isArray(data.data.bookmarks)) {
        errors.push('Bookmarks must be an array');
      } else {
        data.data.bookmarks.forEach((bookmark, index) => {
          if (!bookmark.url || !bookmark.title) {
            warnings.push(`Bookmark ${index} missing required fields`);
          }
        });
      }
    }

    // Validate history
    if (data.data.history) {
      if (!Array.isArray(data.data.history)) {
        errors.push('History must be an array');
      }
    }

    // Validate settings
    if (data.data.settings) {
      if (typeof data.data.settings !== 'object') {
        errors.push('Settings must be an object');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Perform the actual import
   */
  async performImport(userId, data, options) {
    const results = {
      bookmarks: 0,
      history: 0,
      settings: 0,
      sessions: 0,
      files: 0
    };

    // Import bookmarks
    if (data.data.bookmarks && Array.isArray(data.data.bookmarks)) {
      for (const bookmark of data.data.bookmarks) {
        try {
          await this.databaseManager.addBookmark(userId, {
            id: bookmark.bookmarkId || this.generateId(),
            url: bookmark.url,
            title: bookmark.title,
            description: bookmark.description,
            tags: bookmark.tags || [],
            folder: bookmark.folder,
            faviconUrl: bookmark.faviconUrl
          });
          results.bookmarks++;
        } catch (error) {
          console.warn('Failed to import bookmark:', error.message);
        }
      }
    }

    // Import history
    if (data.data.history && Array.isArray(data.data.history)) {
      for (const entry of data.data.history) {
        try {
          await this.databaseManager.addHistoryEntry(userId, {
            id: entry.historyId || this.generateId(),
            url: entry.url,
            title: entry.title
          });
          results.history++;
        } catch (error) {
          console.warn('Failed to import history entry:', error.message);
        }
      }
    }

    // Import settings
    if (data.data.settings && typeof data.data.settings === 'object') {
      try {
        await this.databaseManager.updateSettings(userId, data.data.settings);
        results.settings = 1;
      } catch (error) {
        console.warn('Failed to import settings:', error.message);
      }
    }

    // Import sessions
    if (data.data.sessions && Array.isArray(data.data.sessions)) {
      for (const session of data.data.sessions) {
        try {
          await this.databaseManager.saveSession(userId, {
            id: session.sessionId || this.generateId(),
            name: session.name,
            tabs: session.tabs || [],
            windows: session.windows || []
          });
          results.sessions++;
        } catch (error) {
          console.warn('Failed to import session:', error.message);
        }
      }
    }

    return results;
  }

  /**
   * Convert data to CSV format
   */
  convertToCSV(data) {
    const lines = ['Type,Data'];

    // Convert bookmarks
    if (data.data.bookmarks) {
      data.data.bookmarks.forEach(bookmark => {
        lines.push(`bookmark,${JSON.stringify(bookmark).replace(/"/g, '""')}`);
      });
    }

    // Convert history
    if (data.data.history) {
      data.data.history.forEach(entry => {
        lines.push(`history,${JSON.stringify(entry).replace(/"/g, '""')}`);
      });
    }

    // Convert settings
    if (data.data.settings) {
      lines.push(`settings,${JSON.stringify(data.data.settings).replace(/"/g, '""')}`);
    }

    return lines.join('\n');
  }

  /**
   * Parse CSV data
   */
  parseCSV(csvData) {
    const lines = csvData.split('\n');
    const data = { metadata: {}, data: {} };

    lines.forEach(line => {
      const [type, jsonData] = line.split(',');
      if (type && jsonData) {
        try {
          const parsed = JSON.parse(jsonData.replace(/""/g, '"'));
          if (!data.data[type + 's']) {
            data.data[type + 's'] = [];
          }
          if (type === 'setting') {
            data.data.settings = parsed;
          } else {
            data.data[type + 's'].push(parsed);
          }
        } catch (error) {
          console.warn('Failed to parse CSV line:', line);
        }
      }
    });

    return data;
  }

  /**
   * Convert data to XML format
   */
  convertToXML(data) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<qui-browser-export>\n';

    // Metadata
    xml += '  <metadata>\n';
    Object.entries(data.metadata).forEach(([key, value]) => {
      xml += `    <${key}>${this.escapeXml(String(value))}</${key}>\n`;
    });
    xml += '  </metadata>\n';

    // Data sections
    xml += '  <data>\n';

    Object.entries(data.data).forEach(([section, items]) => {
      xml += `    <${section}>\n`;
      if (Array.isArray(items)) {
        items.forEach(item => {
          xml += `      <item>${this.escapeXml(JSON.stringify(item))}</item>\n`;
        });
      } else {
        xml += `      ${this.escapeXml(JSON.stringify(items))}\n`;
      }
      xml += `    </${section}>\n`;
    });

    xml += '  </data>\n</qui-browser-export>';
    return xml;
  }

  /**
   * Parse XML data
   */
  parseXML(xmlData) {
    // Simple XML parser for our specific format
    const data = { metadata: {}, data: {} };

    // Extract metadata
    const metadataMatch = xmlData.match(/<metadata>(.*?)<\/metadata>/s);
    if (metadataMatch) {
      const metadataXml = metadataMatch[1];
      const fieldMatches = metadataXml.matchAll(/<(\w+)>(.*?)<\/\1>/g);
      for (const match of fieldMatches) {
        data.metadata[match[1]] = match[2];
      }
    }

    // Extract data sections
    const dataMatch = xmlData.match(/<data>(.*?)<\/data>/s);
    if (dataMatch) {
      const dataXml = dataMatch[1];
      const sectionMatches = dataXml.matchAll(/<(\w+)>(.*?)<\/\1>/gs);
      for (const match of sectionMatches) {
        const sectionName = match[1];
        const sectionContent = match[2];

        if (sectionContent.includes('<item>')) {
          // Array data
          const items = [];
          const itemMatches = sectionContent.matchAll(/<item>(.*?)<\/item>/g);
          for (const itemMatch of itemMatches) {
            try {
              items.push(JSON.parse(itemMatch[1]));
            } catch (error) {
              console.warn('Failed to parse XML item:', itemMatch[1]);
            }
          }
          data.data[sectionName] = items;
        } else {
          // Object data
          try {
            data.data[sectionName] = JSON.parse(sectionContent.trim());
          } catch (error) {
            console.warn('Failed to parse XML section:', sectionName);
          }
        }
      }
    }

    return data;
  }

  /**
   * Compress file using gzip
   */
  async compressFile(filePath) {
    const { createGzip } = require('zlib');
    const compressedPath = `${filePath}.gz`;

    const source = createReadStream(filePath);
    const destination = createWriteStream(compressedPath);
    const gzip = createGzip();

    await pipeline(source, gzip, destination);
    return compressedPath;
  }

  /**
   * Decompress file
   */
  async decompressFile(filePath) {
    const { createGunzip } = require('zlib');
    const { Readable } = require('stream');

    const source = createReadStream(filePath);
    const gunzip = createGunzip();

    let decompressed = '';
    for await (const chunk of source.pipe(gunzip)) {
      decompressed += chunk;
    }

    return decompressed;
  }

  /**
   * Detect file format from content or extension
   */
  detectFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.json' || ext === '.gz') {
      return 'json';
    } else if (ext === '.csv') {
      return 'csv';
    } else if (ext === '.xml') {
      return 'xml';
    }

    // Try to detect from content
    try {
      const content = fs.readFileSync(filePath, 'utf8').trim();
      if (content.startsWith('{')) {
        return 'json';
      } else if (content.startsWith('<?xml') || content.startsWith('<')) {
        return 'xml';
      } else if (content.includes(',')) {
        return 'csv';
      }
    } catch (error) {
      // Ignore
    }

    return 'json'; // Default
  }

  /**
   * Count records in import data
   */
  countImportRecords(data) {
    const counts = {};

    if (data.data) {
      Object.entries(data.data).forEach(([key, value]) => {
        counts[key] = Array.isArray(value) ? value.length : 1;
      });
    }

    return counts;
  }

  /**
   * Generate unique export ID
   */
  generateExportId() {
    return `export_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Escape XML characters
   */
  escapeXml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Get export file info
   */
  async getExportInfo(exportId) {
    const files = await fs.readdir(this.exportDir);
    const exportFile = files.find(file => file.includes(exportId));

    if (!exportFile) {
      return null;
    }

    const filePath = path.join(this.exportDir, exportFile);
    const stats = await fs.stat(filePath);

    return {
      exportId,
      fileName: exportFile,
      filePath,
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime
    };
  }

  /**
   * List user exports
   */
  async listExports(userId) {
    const files = await fs.readdir(this.exportDir);
    const exports = [];

    for (const file of files) {
      if (file.startsWith('qui-browser-export-')) {
        const filePath = path.join(this.exportDir, file);
        const stats = await fs.stat(filePath);

        exports.push({
          fileName: file,
          size: stats.size,
          createdAt: stats.birthtime,
          exportId: file.match(/qui-browser-export-(export_[^.-]+)/)?.[1]
        });
      }
    }

    return exports.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Delete export file
   */
  async deleteExport(exportId) {
    const exportInfo = await this.getExportInfo(exportId);
    if (!exportInfo) {
      return false;
    }

    await fs.unlink(exportInfo.filePath);
    return true;
  }

  /**
   * Clean up old exports
   */
  async cleanupOldExports(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 days
    const files = await fs.readdir(this.exportDir);
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      if (file.startsWith('qui-browser-export-')) {
        const filePath = path.join(this.exportDir, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }
    }

    return deletedCount;
  }
}

module.exports = DataExportImport;
