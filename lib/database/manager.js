/**
 * Qui Browser - Database Manager
 *
 * Manages database connections and provides unified interface
 */

const PostgreSQLAdapter = require('./postgresql');
const MongoDBAdapter = require('./mongodb');

class DatabaseManager {
  constructor(config) {
    this.config = config;
    this.adapter = null;
    this.isConnected = false;
  }

  /**
   * Initialize database connection
   */
  async initialize() {
    if (!this.config.database.enabled) {
      console.log('Database integration disabled');
      return;
    }

    const dbType = this.config.database.type || 'sqlite';

    switch (dbType.toLowerCase()) {
      case 'postgresql':
      case 'postgres':
      case 'pg':
        this.adapter = new PostgreSQLAdapter(this.config);
        break;

      case 'mongodb':
      case 'mongo':
        this.adapter = new MongoDBAdapter(this.config);
        break;

      case 'sqlite':
      default:
        console.log('Using SQLite/file-based storage (no external database)');
        return;
    }

    try {
      await this.adapter.connect();
      await this.adapter.createTables();
      this.isConnected = true;
      console.log(`Database initialized successfully (${dbType})`);
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.adapter && this.isConnected) {
      await this.adapter.disconnect();
      this.isConnected = false;
    }
  }

  /**
   * Check if database is connected
   */
  isDatabaseConnected() {
    return this.isConnected && this.adapter?.isConnected();
  }

  /**
   * Get database adapter
   */
  getAdapter() {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    return this.adapter;
  }

  // Delegate all database operations to the adapter
  async getBookmarks(userId) {
    if (!this.adapter) return [];
    return await this.adapter.getBookmarks(userId);
  }

  async addBookmark(userId, bookmark) {
    if (!this.adapter) throw new Error('Database not available');
    return await this.adapter.addBookmark(userId, bookmark);
  }

  async updateBookmark(userId, bookmarkId, bookmark) {
    if (!this.adapter) throw new Error('Database not available');
    return await this.adapter.updateBookmark(userId, bookmarkId, bookmark);
  }

  async deleteBookmark(userId, bookmarkId) {
    if (!this.adapter) return false;
    return await this.adapter.deleteBookmark(userId, bookmarkId);
  }

  async getHistory(userId, options) {
    if (!this.adapter) return [];
    return await this.adapter.getHistory(userId, options);
  }

  async addHistoryEntry(userId, entry) {
    if (!this.adapter) throw new Error('Database not available');
    return await this.adapter.addHistoryEntry(userId, entry);
  }

  async clearHistory(userId) {
    if (!this.adapter) return 0;
    return await this.adapter.clearHistory(userId);
  }

  async getSessions(userId) {
    if (!this.adapter) return [];
    return await this.adapter.getSessions(userId);
  }

  async saveSession(userId, session) {
    if (!this.adapter) throw new Error('Database not available');
    return await this.adapter.saveSession(userId, session);
  }

  async restoreSession(userId, sessionId) {
    if (!this.adapter) return null;
    return await this.adapter.restoreSession(userId, sessionId);
  }

  async deleteSession(userId, sessionId) {
    if (!this.adapter) return false;
    return await this.adapter.deleteSession(userId, sessionId);
  }

  async getSettings(userId) {
    if (!this.adapter) return {};
    return await this.adapter.getSettings(userId);
  }

  async updateSettings(userId, settings) {
    if (!this.adapter) throw new Error('Database not available');
    return await this.adapter.updateSettings(userId, settings);
  }

  async saveFileInfo(fileInfo) {
    if (!this.adapter) throw new Error('Database not available');
    return await this.adapter.saveFileInfo(fileInfo);
  }

  async getFileInfo(fileId) {
    if (!this.adapter) return null;
    return await this.adapter.getFileInfo(fileId);
  }

  async deleteFileInfo(fileId) {
    if (!this.adapter) return false;
    return await this.adapter.deleteFileInfo(fileId);
  }

  async listUserFiles(userId, options) {
    if (!this.adapter) return [];
    return await this.adapter.listUserFiles(userId, options);
  }

  async createUser(userData) {
    if (!this.adapter) throw new Error('Database not available');
    return await this.adapter.createUser(userData);
  }

  async getUser(userId) {
    if (!this.adapter) return null;
    return await this.adapter.getUser(userId);
  }

  async updateUser(userId, userData) {
    if (!this.adapter) throw new Error('Database not available');
    return await this.adapter.updateUser(userId, userData);
  }

  async deleteUser(userId) {
    if (!this.adapter) return false;
    return await this.adapter.deleteUser(userId);
  }

  async saveAnalyticsEvent(event) {
    if (!this.adapter) return;
    return await this.adapter.saveAnalyticsEvent(event);
  }

  async getAnalyticsData(userId, options) {
    if (!this.adapter) return [];
    return await this.adapter.getAnalyticsData(userId, options);
  }

  /**
   * Get database statistics
   */
  getStats() {
    return {
      enabled: this.config.database.enabled,
      type: this.config.database.type,
      connected: this.isConnected,
      adapter: this.adapter ? this.adapter.constructor.name : null
    };
  }
}

module.exports = DatabaseManager;
