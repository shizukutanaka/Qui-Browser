/**
 * Qui Browser - PostgreSQL Database Adapter
 *
 * PostgreSQL implementation of the database interface
 */

const { Pool } = require('pg');
const DatabaseInterface = require('./interface');

class PostgreSQLAdapter extends DatabaseInterface {
  constructor(config) {
    super();
    this.config = config;
    this.pool = null;
    this.isInitialized = false;
  }

  /**
   * Connect to PostgreSQL database
   */
  async connect() {
    try {
      this.pool = new Pool({
        host: this.config.database.host || 'localhost',
        port: this.config.database.port || 5432,
        database: this.config.database.name || 'qui_browser',
        user: this.config.database.user || 'postgres',
        password: this.config.database.password,
        max: this.config.database.maxConnections || 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        ssl: this.config.database.ssl || false
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      console.log('Connected to PostgreSQL database');
      return true;
    } catch (error) {
      console.error('Failed to connect to PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('Disconnected from PostgreSQL database');
    }
  }

  /**
   * Check connection status
   */
  isConnected() {
    return this.pool && !this.pool.ended;
  }

  /**
   * Create database tables
   */
  async createTables() {
    if (!this.pool) throw new Error('Database not connected');

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255),
          username VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Bookmarks table
      await client.query(`
        CREATE TABLE IF NOT EXISTS bookmarks (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          bookmark_id VARCHAR(255) NOT NULL,
          url TEXT NOT NULL,
          title VARCHAR(500),
          description TEXT,
          tags TEXT[],
          folder VARCHAR(255),
          favicon_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, bookmark_id)
        );
      `);

      // History table
      await client.query(`
        CREATE TABLE IF NOT EXISTS history (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          history_id VARCHAR(255) NOT NULL,
          url TEXT NOT NULL,
          title VARCHAR(500),
          visit_count INTEGER DEFAULT 1,
          last_visit TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, history_id)
        );
      `);

      // Sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          session_id VARCHAR(255) NOT NULL,
          name VARCHAR(255),
          tabs JSONB,
          windows JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, session_id)
        );
      `);

      // Settings table
      await client.query(`
        CREATE TABLE IF NOT EXISTS settings (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) UNIQUE NOT NULL,
          settings JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Files table
      await client.query(`
        CREATE TABLE IF NOT EXISTS files (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          file_id VARCHAR(255) NOT NULL,
          original_name VARCHAR(500) NOT NULL,
          secure_name VARCHAR(500) NOT NULL,
          path TEXT NOT NULL,
          size BIGINT NOT NULL,
          mimetype VARCHAR(255),
          extension VARCHAR(50),
          hash VARCHAR(128),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, file_id)
        );
      `);

      // Analytics table
      await client.query(`
        CREATE TABLE IF NOT EXISTS analytics (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255),
          event_type VARCHAR(100) NOT NULL,
          event_data JSONB DEFAULT '{}',
          session_id VARCHAR(255),
          user_agent TEXT,
          ip_address INET,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create indexes for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
        CREATE INDEX IF NOT EXISTS idx_history_user_id ON history(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
        CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id);
        CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type);
        CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at);
      `);

      await client.query('COMMIT');
      this.isInitialized = true;
      console.log('PostgreSQL tables created successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Failed to create PostgreSQL tables:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Bookmark operations
  async getBookmarks(userId) {
    const result = await this.pool.query(
      'SELECT bookmark_id, url, title, description, tags, folder, favicon_url, created_at, updated_at FROM bookmarks WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  async addBookmark(userId, bookmark) {
    const result = await this.pool.query(`
      INSERT INTO bookmarks (user_id, bookmark_id, url, title, description, tags, folder, favicon_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, bookmark_id) DO UPDATE SET
        url = EXCLUDED.url,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        tags = EXCLUDED.tags,
        folder = EXCLUDED.folder,
        favicon_url = EXCLUDED.favicon_url,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [userId, bookmark.id, bookmark.url, bookmark.title, bookmark.description, bookmark.tags, bookmark.folder, bookmark.faviconUrl]);
    return result.rows[0];
  }

  async updateBookmark(userId, bookmarkId, bookmark) {
    const result = await this.pool.query(`
      UPDATE bookmarks SET
        url = $3, title = $4, description = $5, tags = $6, folder = $7, favicon_url = $8, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND bookmark_id = $2
      RETURNING *
    `, [userId, bookmarkId, bookmark.url, bookmark.title, bookmark.description, bookmark.tags, bookmark.folder, bookmark.faviconUrl]);
    return result.rows[0];
  }

  async deleteBookmark(userId, bookmarkId) {
    const result = await this.pool.query(
      'DELETE FROM bookmarks WHERE user_id = $1 AND bookmark_id = $2 RETURNING *',
      [userId, bookmarkId]
    );
    return result.rowCount > 0;
  }

  // History operations
  async getHistory(userId, options = {}) {
    let query = 'SELECT history_id, url, title, visit_count, last_visit, created_at FROM history WHERE user_id = $1';
    const params = [userId];
    let paramCount = 1;

    if (options.limit) {
      query += ` LIMIT $${++paramCount}`;
      params.push(options.limit);
    }

    if (options.offset) {
      query += ` OFFSET $${++paramCount}`;
      params.push(options.offset);
    }

    query += ' ORDER BY last_visit DESC';

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async addHistoryEntry(userId, entry) {
    const result = await this.pool.query(`
      INSERT INTO history (user_id, history_id, url, title, visit_count, last_visit)
      VALUES ($1, $2, $3, $4, 1, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, history_id) DO UPDATE SET
        visit_count = history.visit_count + 1,
        last_visit = CURRENT_TIMESTAMP,
        title = COALESCE(EXCLUDED.title, history.title)
      RETURNING *
    `, [userId, entry.id, entry.url, entry.title]);
    return result.rows[0];
  }

  async clearHistory(userId) {
    const result = await this.pool.query('DELETE FROM history WHERE user_id = $1', [userId]);
    return result.rowCount;
  }

  // Session operations
  async getSessions(userId) {
    const result = await this.pool.query(
      'SELECT session_id, name, tabs, windows, created_at, updated_at FROM sessions WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );
    return result.rows;
  }

  async saveSession(userId, session) {
    const result = await this.pool.query(`
      INSERT INTO sessions (user_id, session_id, name, tabs, windows)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, session_id) DO UPDATE SET
        name = EXCLUDED.name,
        tabs = EXCLUDED.tabs,
        windows = EXCLUDED.windows,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [userId, session.id, session.name, JSON.stringify(session.tabs), JSON.stringify(session.windows)]);
    return result.rows[0];
  }

  async restoreSession(userId, sessionId) {
    const result = await this.pool.query(
      'SELECT session_id, name, tabs, windows FROM sessions WHERE user_id = $1 AND session_id = $2',
      [userId, sessionId]
    );
    return result.rows[0];
  }

  async deleteSession(userId, sessionId) {
    const result = await this.pool.query(
      'DELETE FROM sessions WHERE user_id = $1 AND session_id = $2 RETURNING *',
      [userId, sessionId]
    );
    return result.rowCount > 0;
  }

  // Settings operations
  async getSettings(userId) {
    const result = await this.pool.query(
      'SELECT settings FROM settings WHERE user_id = $1',
      [userId]
    );
    return result.rows[0]?.settings || {};
  }

  async updateSettings(userId, settings) {
    const result = await this.pool.query(`
      INSERT INTO settings (user_id, settings)
      VALUES ($1, $2)
      ON CONFLICT (user_id) DO UPDATE SET
        settings = EXCLUDED.settings,
        updated_at = CURRENT_TIMESTAMP
      RETURNING settings
    `, [userId, JSON.stringify(settings)]);
    return result.rows[0].settings;
  }

  // File operations
  async saveFileInfo(fileInfo) {
    const result = await this.pool.query(`
      INSERT INTO files (user_id, file_id, original_name, secure_name, path, size, mimetype, extension, hash, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [fileInfo.userId, fileInfo.id, fileInfo.originalName, fileInfo.secureName, fileInfo.path, fileInfo.size, fileInfo.mimetype, fileInfo.extension, fileInfo.hash, JSON.stringify(fileInfo.metadata)]);
    return result.rows[0];
  }

  async getFileInfo(fileId) {
    const result = await this.pool.query(
      'SELECT * FROM files WHERE file_id = $1',
      [fileId]
    );
    return result.rows[0];
  }

  async deleteFileInfo(fileId) {
    const result = await this.pool.query(
      'DELETE FROM files WHERE file_id = $1 RETURNING *',
      [fileId]
    );
    return result.rowCount > 0;
  }

  async listUserFiles(userId, options = {}) {
    let query = 'SELECT file_id, original_name, secure_name, size, mimetype, extension, created_at FROM files WHERE user_id = $1';
    const params = [userId];
    let paramCount = 1;

    if (options.extension) {
      query += ` AND extension = $${++paramCount}`;
      params.push(options.extension);
    }

    if (options.limit) {
      query += ` LIMIT $${++paramCount}`;
      params.push(options.limit);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  // User operations
  async createUser(userData) {
    const result = await this.pool.query(`
      INSERT INTO users (user_id, email, username)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [userData.id, userData.email, userData.username]);
    return result.rows[0];
  }

  async getUser(userId) {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );
    return result.rows[0];
  }

  async updateUser(userId, userData) {
    const result = await this.pool.query(`
      UPDATE users SET
        email = $2, username = $3, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *
    `, [userId, userData.email, userData.username]);
    return result.rows[0];
  }

  async deleteUser(userId) {
    const result = await this.pool.query(
      'DELETE FROM users WHERE user_id = $1 RETURNING *',
      [userId]
    );
    return result.rowCount > 0;
  }

  // Analytics operations
  async saveAnalyticsEvent(event) {
    await this.pool.query(`
      INSERT INTO analytics (user_id, event_type, event_data, session_id, user_agent, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [event.userId, event.type, JSON.stringify(event.data), event.sessionId, event.userAgent, event.ipAddress]);
  }

  async getAnalyticsData(userId, options = {}) {
    let query = 'SELECT event_type, event_data, created_at FROM analytics WHERE user_id = $1';
    const params = [userId];
    let paramCount = 1;

    if (options.eventType) {
      query += ` AND event_type = $${++paramCount}`;
      params.push(options.eventType);
    }

    if (options.startDate) {
      query += ` AND created_at >= $${++paramCount}`;
      params.push(options.startDate);
    }

    if (options.endDate) {
      query += ` AND created_at <= $${++paramCount}`;
      params.push(options.endDate);
    }

    if (options.limit) {
      query += ` LIMIT $${++paramCount}`;
      params.push(options.limit);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.pool.query(query, params);
    return result.rows;
  }
}

module.exports = PostgreSQLAdapter;
