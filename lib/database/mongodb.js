/**
 * Qui Browser - MongoDB Database Adapter
 *
 * MongoDB implementation of the database interface
 */

const { MongoClient } = require('mongodb');
const DatabaseInterface = require('./interface');

class MongoDBAdapter extends DatabaseInterface {
  constructor(config) {
    super();
    this.config = config;
    this.client = null;
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * Connect to MongoDB database
   */
  async connect() {
    try {
      const uri = this.config.database.url || `mongodb://localhost:27017/qui_browser`;
      this.client = new MongoClient(uri, {
        maxPoolSize: this.config.database.maxConnections || 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      await this.client.connect();
      this.db = this.client.db();

      // Test connection
      await this.db.admin().ping();

      console.log('Connected to MongoDB database');
      return true;
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log('Disconnected from MongoDB database');
    }
  }

  /**
   * Check connection status
   */
  isConnected() {
    return this.client && this.client.topology && this.client.topology.isConnected();
  }

  /**
   * Create database collections and indexes
   */
  async createTables() {
    if (!this.db) throw new Error('Database not connected');

    try {
      // Create collections (MongoDB creates them automatically when first used)
      const collections = ['users', 'bookmarks', 'history', 'sessions', 'settings', 'files', 'analytics'];

      for (const collection of collections) {
        await this.db.createCollection(collection).catch(() => {
          // Collection already exists, ignore error
        });
      }

      // Create indexes for performance
      await Promise.all([
        // Users indexes
        this.db.collection('users').createIndex({ userId: 1 }, { unique: true }),
        this.db.collection('users').createIndex({ email: 1 }),

        // Bookmarks indexes
        this.db.collection('bookmarks').createIndex({ userId: 1 }),
        this.db.collection('bookmarks').createIndex({ userId: 1, bookmarkId: 1 }, { unique: true }),
        this.db.collection('bookmarks').createIndex({ userId: 1, folder: 1 }),

        // History indexes
        this.db.collection('history').createIndex({ userId: 1 }),
        this.db.collection('history').createIndex({ userId: 1, historyId: 1 }, { unique: true }),
        this.db.collection('history').createIndex({ userId: 1, lastVisit: -1 }),

        // Sessions indexes
        this.db.collection('sessions').createIndex({ userId: 1 }),
        this.db.collection('sessions').createIndex({ userId: 1, sessionId: 1 }, { unique: true }),

        // Settings indexes
        this.db.collection('settings').createIndex({ userId: 1 }, { unique: true }),

        // Files indexes
        this.db.collection('files').createIndex({ userId: 1 }),
        this.db.collection('files').createIndex({ userId: 1, fileId: 1 }, { unique: true }),
        this.db.collection('files').createIndex({ userId: 1, extension: 1 }),

        // Analytics indexes
        this.db.collection('analytics').createIndex({ userId: 1 }),
        this.db.collection('analytics').createIndex({ eventType: 1 }),
        this.db.collection('analytics').createIndex({ createdAt: -1 }),
        this.db.collection('analytics').createIndex({ userId: 1, createdAt: -1 })
      ]);

      this.isInitialized = true;
      console.log('MongoDB collections and indexes created successfully');
    } catch (error) {
      console.error('Failed to create MongoDB collections:', error);
      throw error;
    }
  }

  // Bookmark operations
  async getBookmarks(userId) {
    const bookmarks = await this.db.collection('bookmarks')
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    return bookmarks.map(bookmark => ({
      bookmarkId: bookmark.bookmarkId,
      url: bookmark.url,
      title: bookmark.title,
      description: bookmark.description,
      tags: bookmark.tags,
      folder: bookmark.folder,
      faviconUrl: bookmark.faviconUrl,
      createdAt: bookmark.createdAt,
      updatedAt: bookmark.updatedAt
    }));
  }

  async addBookmark(userId, bookmark) {
    const now = new Date();
    const doc = {
      userId,
      bookmarkId: bookmark.id,
      url: bookmark.url,
      title: bookmark.title,
      description: bookmark.description,
      tags: bookmark.tags,
      folder: bookmark.folder,
      faviconUrl: bookmark.faviconUrl,
      createdAt: now,
      updatedAt: now
    };

    await this.db.collection('bookmarks').updateOne(
      { userId, bookmarkId: bookmark.id },
      { $set: doc, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );

    return doc;
  }

  async updateBookmark(userId, bookmarkId, bookmark) {
    const result = await this.db.collection('bookmarks').updateOne(
      { userId, bookmarkId },
      {
        $set: {
          ...bookmark,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return null;
    }

    return this.getBookmarkById(userId, bookmarkId);
  }

  async deleteBookmark(userId, bookmarkId) {
    const result = await this.db.collection('bookmarks').deleteOne({ userId, bookmarkId });
    return result.deletedCount > 0;
  }

  async getBookmarkById(userId, bookmarkId) {
    return await this.db.collection('bookmarks').findOne({ userId, bookmarkId });
  }

  // History operations
  async getHistory(userId, options = {}) {
    const query = { userId };
    const sort = { lastVisit: -1 };

    let cursor = this.db.collection('history').find(query).sort(sort);

    if (options.limit) {
      cursor = cursor.limit(options.limit);
    }

    if (options.offset) {
      cursor = cursor.skip(options.offset);
    }

    const history = await cursor.toArray();

    return history.map(entry => ({
      historyId: entry.historyId,
      url: entry.url,
      title: entry.title,
      visitCount: entry.visitCount,
      lastVisit: entry.lastVisit,
      createdAt: entry.createdAt
    }));
  }

  async addHistoryEntry(userId, entry) {
    const now = new Date();
    const doc = {
      userId,
      historyId: entry.id,
      url: entry.url,
      title: entry.title,
      visitCount: 1,
      lastVisit: now,
      createdAt: now
    };

    const result = await this.db.collection('history').updateOne(
      { userId, historyId: entry.id },
      {
        $set: {
          url: entry.url,
          title: entry.title,
          lastVisit: now
        },
        $inc: { visitCount: 1 },
        $setOnInsert: {
          userId,
          historyId: entry.id,
          createdAt: now
        }
      },
      { upsert: true }
    );

    return await this.db.collection('history').findOne({ userId, historyId: entry.id });
  }

  async clearHistory(userId) {
    const result = await this.db.collection('history').deleteMany({ userId });
    return result.deletedCount;
  }

  // Session operations
  async getSessions(userId) {
    const sessions = await this.db.collection('sessions')
      .find({ userId })
      .sort({ updatedAt: -1 })
      .toArray();

    return sessions.map(session => ({
      sessionId: session.sessionId,
      name: session.name,
      tabs: session.tabs,
      windows: session.windows,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    }));
  }

  async saveSession(userId, session) {
    const now = new Date();
    const doc = {
      userId,
      sessionId: session.id,
      name: session.name,
      tabs: session.tabs,
      windows: session.windows,
      createdAt: now,
      updatedAt: now
    };

    await this.db.collection('sessions').updateOne(
      { userId, sessionId: session.id },
      { $set: doc, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );

    return doc;
  }

  async restoreSession(userId, sessionId) {
    const session = await this.db.collection('sessions').findOne({ userId, sessionId });
    if (!session) return null;

    return {
      sessionId: session.sessionId,
      name: session.name,
      tabs: session.tabs,
      windows: session.windows
    };
  }

  async deleteSession(userId, sessionId) {
    const result = await this.db.collection('sessions').deleteOne({ userId, sessionId });
    return result.deletedCount > 0;
  }

  // Settings operations
  async getSettings(userId) {
    const doc = await this.db.collection('settings').findOne({ userId });
    return doc?.settings || {};
  }

  async updateSettings(userId, settings) {
    const now = new Date();
    const result = await this.db.collection('settings').updateOne(
      { userId },
      {
        $set: {
          settings,
          updatedAt: now
        },
        $setOnInsert: {
          userId,
          createdAt: now
        }
      },
      { upsert: true }
    );

    return settings;
  }

  // File operations
  async saveFileInfo(fileInfo) {
    const now = new Date();
    const doc = {
      userId: fileInfo.userId,
      fileId: fileInfo.id,
      originalName: fileInfo.originalName,
      secureName: fileInfo.secureName,
      path: fileInfo.path,
      size: fileInfo.size,
      mimetype: fileInfo.mimetype,
      extension: fileInfo.extension,
      hash: fileInfo.hash,
      metadata: fileInfo.metadata,
      createdAt: now,
      updatedAt: now
    };

    await this.db.collection('files').insertOne(doc);
    return doc;
  }

  async getFileInfo(fileId) {
    return await this.db.collection('files').findOne({ fileId });
  }

  async deleteFileInfo(fileId) {
    const result = await this.db.collection('files').deleteOne({ fileId });
    return result.deletedCount > 0;
  }

  async listUserFiles(userId, options = {}) {
    const query = { userId };
    if (options.extension) {
      query.extension = options.extension;
    }

    let cursor = this.db.collection('files')
      .find(query)
      .sort({ createdAt: -1 });

    if (options.limit) {
      cursor = cursor.limit(options.limit);
    }

    const files = await cursor.toArray();

    return files.map(file => ({
      fileId: file.fileId,
      originalName: file.originalName,
      secureName: file.secureName,
      size: file.size,
      mimetype: file.mimetype,
      extension: file.extension,
      createdAt: file.createdAt
    }));
  }

  // User operations
  async createUser(userData) {
    const now = new Date();
    const doc = {
      userId: userData.id,
      email: userData.email,
      username: userData.username,
      createdAt: now,
      updatedAt: now
    };

    await this.db.collection('users').insertOne(doc);
    return doc;
  }

  async getUser(userId) {
    return await this.db.collection('users').findOne({ userId });
  }

  async updateUser(userId, userData) {
    const result = await this.db.collection('users').updateOne(
      { userId },
      {
        $set: {
          ...userData,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return null;
    }

    return await this.getUser(userId);
  }

  async deleteUser(userId) {
    const result = await this.db.collection('users').deleteOne({ userId });
    return result.deletedCount > 0;
  }

  // Analytics operations
  async saveAnalyticsEvent(event) {
    const doc = {
      userId: event.userId,
      eventType: event.type,
      eventData: event.data,
      sessionId: event.sessionId,
      userAgent: event.userAgent,
      ipAddress: event.ipAddress,
      createdAt: new Date()
    };

    await this.db.collection('analytics').insertOne(doc);
  }

  async getAnalyticsData(userId, options = {}) {
    const query = { userId };

    if (options.eventType) {
      query.eventType = options.eventType;
    }

    if (options.startDate || options.endDate) {
      query.createdAt = {};
      if (options.startDate) {
        query.createdAt.$gte = new Date(options.startDate);
      }
      if (options.endDate) {
        query.createdAt.$lte = new Date(options.endDate);
      }
    }

    let cursor = this.db.collection('analytics')
      .find(query)
      .sort({ createdAt: -1 });

    if (options.limit) {
      cursor = cursor.limit(options.limit);
    }

    const events = await cursor.toArray();

    return events.map(event => ({
      eventType: event.eventType,
      eventData: event.eventData,
      createdAt: event.createdAt
    }));
  }
}

module.exports = MongoDBAdapter;
