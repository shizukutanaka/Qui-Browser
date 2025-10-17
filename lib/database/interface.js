/**
 * Qui Browser - Database Interface
 *
 * Common interface for database operations
 */

class DatabaseInterface {
  /**
   * Connect to the database
   * @returns {Promise<void>}
   */
  async connect() {
    throw new Error('connect() must be implemented by subclass');
  }

  /**
   * Disconnect from the database
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error('disconnect() must be implemented by subclass');
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  isConnected() {
    throw new Error('isConnected() must be implemented by subclass');
  }

  /**
   * Create tables/collections
   * @returns {Promise<void>}
   */
  async createTables() {
    throw new Error('createTables() must be implemented by subclass');
  }

  // Bookmark operations
  async getBookmarks(userId) {
    throw new Error('getBookmarks() must be implemented by subclass');
  }

  async addBookmark(userId, bookmark) {
    throw new Error('addBookmark() must be implemented by subclass');
  }

  async updateBookmark(userId, bookmarkId, bookmark) {
    throw new Error('updateBookmark() must be implemented by subclass');
  }

  async deleteBookmark(userId, bookmarkId) {
    throw new Error('deleteBookmark() must be implemented by subclass');
  }

  // History operations
  async getHistory(userId, options) {
    throw new Error('getHistory() must be implemented by subclass');
  }

  async addHistoryEntry(userId, entry) {
    throw new Error('addHistoryEntry() must be implemented by subclass');
  }

  async clearHistory(userId) {
    throw new Error('clearHistory() must be implemented by subclass');
  }

  // Session operations
  async getSessions(userId) {
    throw new Error('getSessions() must be implemented by subclass');
  }

  async saveSession(userId, session) {
    throw new Error('saveSession() must be implemented by subclass');
  }

  async restoreSession(userId, sessionId) {
    throw new Error('restoreSession() must be implemented by subclass');
  }

  async deleteSession(userId, sessionId) {
    throw new Error('deleteSession() must be implemented by subclass');
  }

  // Settings operations
  async getSettings(userId) {
    throw new Error('getSettings() must be implemented by subclass');
  }

  async updateSettings(userId, settings) {
    throw new Error('updateSettings() must be implemented by subclass');
  }

  // File operations
  async saveFileInfo(fileInfo) {
    throw new Error('saveFileInfo() must be implemented by subclass');
  }

  async getFileInfo(fileId) {
    throw new Error('getFileInfo() must be implemented by subclass');
  }

  async deleteFileInfo(fileId) {
    throw new Error('deleteFileInfo() must be implemented by subclass');
  }

  async listUserFiles(userId, options) {
    throw new Error('listUserFiles() must be implemented by subclass');
  }

  // User operations
  async createUser(userData) {
    throw new Error('createUser() must be implemented by subclass');
  }

  async getUser(userId) {
    throw new Error('getUser() must be implemented by subclass');
  }

  async updateUser(userId, userData) {
    throw new Error('updateUser() must be implemented by subclass');
  }

  async deleteUser(userId) {
    throw new Error('deleteUser() must be implemented by subclass');
  }

  // Analytics operations
  async saveAnalyticsEvent(event) {
    throw new Error('saveAnalyticsEvent() must be implemented by subclass');
  }

  async getAnalyticsData(userId, options) {
    throw new Error('getAnalyticsData() must be implemented by subclass');
  }
}

module.exports = DatabaseInterface;
