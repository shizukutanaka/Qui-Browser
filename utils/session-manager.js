/**
 * Session Management System
 * Enterprise-grade session handling with security and persistence
 *
 * @module utils/session-manager
 */

const crypto = require('crypto');

/**
 * Session Manager
 * Manages user sessions with security, expiration, and persistence
 *
 * @class SessionManager
 * @description Provides comprehensive session management:
 * - Secure session generation
 * - Session expiration
 * - Session validation
 * - Session persistence
 * - Concurrent session handling
 */
class SessionManager {
  /**
   * Create session manager
   * @param {Object} options - Configuration options
   * @param {number} [options.sessionTimeout=3600000] - Session timeout (ms)
   * @param {number} [options.maxSessions=10] - Max concurrent sessions per user
   * @param {boolean} [options.persistSessions=true] - Persist to storage
   * @param {string} [options.secret] - Secret for signing sessions
   * @param {Function} [options.storage] - Custom storage adapter
   */
  constructor(options = {}) {
    this.sessionTimeout = options.sessionTimeout || 3600000; // 1 hour
    this.maxSessions = options.maxSessions || 10;
    this.persistSessions = options.persistSessions !== false;
    this.secret = options.secret || this.generateSecret();
    this.storage = options.storage || new MemoryStorage();

    this.sessions = new Map();
    this.userSessions = new Map(); // userId -> Set of sessionIds

    this.stats = {
      created: 0,
      destroyed: 0,
      expired: 0,
      validated: 0,
      refreshed: 0
    };

    this.startCleanupTimer();
  }

  /**
   * Create new session
   * @param {string} userId - User ID
   * @param {Object} [metadata] - Session metadata
   * @returns {Object} - Session object
   */
  async createSession(userId, metadata = {}) {
    const sessionId = this.generateSessionId();
    const now = Date.now();

    const session = {
      id: sessionId,
      userId,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: now + this.sessionTimeout,
      metadata: { ...metadata },
      signature: null
    };

    // Sign session
    session.signature = this.signSession(session);

    // Store session
    this.sessions.set(sessionId, session);

    // Track user sessions
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }

    const userSessionSet = this.userSessions.get(userId);
    userSessionSet.add(sessionId);

    // Enforce max sessions per user
    if (userSessionSet.size > this.maxSessions) {
      const oldestSession = this.getOldestSessionForUser(userId);
      if (oldestSession) {
        await this.destroySession(oldestSession.id);
      }
    }

    // Persist
    if (this.persistSessions) {
      await this.storage.set(sessionId, session);
    }

    this.stats.created++;

    return {
      sessionId,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt
    };
  }

  /**
   * Validate session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} - Session or null if invalid
   */
  async validateSession(sessionId) {
    this.stats.validated++;

    // Check memory cache
    let session = this.sessions.get(sessionId);

    // Check storage if not in memory
    if (!session && this.persistSessions) {
      session = await this.storage.get(sessionId);
      if (session) {
        this.sessions.set(sessionId, session);
      }
    }

    if (!session) {
      return null;
    }

    // Check expiration
    if (Date.now() >= session.expiresAt) {
      await this.destroySession(sessionId);
      this.stats.expired++;
      return null;
    }

    // Verify signature
    const expectedSignature = this.signSession(session);
    if (session.signature !== expectedSignature) {
      console.warn('Session signature mismatch:', sessionId);
      await this.destroySession(sessionId);
      return null;
    }

    // Update last accessed
    session.lastAccessedAt = Date.now();

    return session;
  }

  /**
   * Refresh session expiration
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} - True if refreshed
   */
  async refreshSession(sessionId) {
    const session = await this.validateSession(sessionId);

    if (!session) {
      return false;
    }

    session.expiresAt = Date.now() + this.sessionTimeout;
    session.signature = this.signSession(session);

    this.sessions.set(sessionId, session);

    if (this.persistSessions) {
      await this.storage.set(sessionId, session);
    }

    this.stats.refreshed++;
    return true;
  }

  /**
   * Destroy session
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} - True if destroyed
   */
  async destroySession(sessionId) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return false;
    }

    // Remove from user sessions tracking
    const userSessionSet = this.userSessions.get(session.userId);
    if (userSessionSet) {
      userSessionSet.delete(sessionId);
      if (userSessionSet.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }

    // Remove from memory
    this.sessions.delete(sessionId);

    // Remove from storage
    if (this.persistSessions) {
      await this.storage.delete(sessionId);
    }

    this.stats.destroyed++;
    return true;
  }

  /**
   * Destroy all sessions for user
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Number of sessions destroyed
   */
  async destroyUserSessions(userId) {
    const userSessionSet = this.userSessions.get(userId);

    if (!userSessionSet) {
      return 0;
    }

    const sessionIds = Array.from(userSessionSet);
    const destroyPromises = sessionIds.map(id => this.destroySession(id));

    await Promise.all(destroyPromises);

    return sessionIds.length;
  }

  /**
   * Update session metadata
   * @param {string} sessionId - Session ID
   * @param {Object} metadata - Metadata to update
   * @returns {Promise<boolean>} - True if updated
   */
  async updateSessionMetadata(sessionId, metadata) {
    const session = await this.validateSession(sessionId);

    if (!session) {
      return false;
    }

    session.metadata = { ...session.metadata, ...metadata };
    session.signature = this.signSession(session);

    this.sessions.set(sessionId, session);

    if (this.persistSessions) {
      await this.storage.set(sessionId, session);
    }

    return true;
  }

  /**
   * Get all sessions for user
   * @param {string} userId - User ID
   * @returns {Array<Object>} - Array of sessions
   */
  getUserSessions(userId) {
    const userSessionSet = this.userSessions.get(userId);

    if (!userSessionSet) {
      return [];
    }

    const sessions = [];
    for (const sessionId of userSessionSet) {
      const session = this.sessions.get(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
  }

  /**
   * Get oldest session for user
   * @private
   * @param {string} userId - User ID
   * @returns {Object|null} - Oldest session
   */
  getOldestSessionForUser(userId) {
    const sessions = this.getUserSessions(userId);

    if (sessions.length === 0) {
      return null;
    }

    return sessions.reduce((oldest, current) =>
      current.lastAccessedAt < oldest.lastAccessedAt ? current : oldest
    );
  }

  /**
   * Generate secure session ID
   * @private
   * @returns {string} - Session ID
   */
  generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate secret for signing
   * @private
   * @returns {string} - Secret
   */
  generateSecret() {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Sign session
   * @private
   * @param {Object} session - Session object
   * @returns {string} - Signature
   */
  signSession(session) {
    const data = JSON.stringify({
      id: session.id,
      userId: session.userId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt
    });

    return crypto.createHmac('sha256', this.secret).update(data).digest('hex');
  }

  /**
   * Start cleanup timer
   * @private
   */
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute
  }

  /**
   * Cleanup expired sessions
   * @private
   */
  async cleanup() {
    const now = Date.now();
    const expiredSessions = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now >= session.expiresAt) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      await this.destroySession(sessionId);
      this.stats.expired++;
    }
  }

  /**
   * Get session statistics
   * @returns {Object} - Statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeSessions: this.sessions.size,
      activeUsers: this.userSessions.size
    };
  }

  /**
   * Stop session manager
   */
  stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

/**
 * Memory Storage Adapter
 */
class MemoryStorage {
  constructor() {
    this.data = new Map();
  }

  async get(key) {
    return this.data.get(key) || null;
  }

  async set(key, value) {
    this.data.set(key, value);
  }

  async delete(key) {
    return this.data.delete(key);
  }

  async clear() {
    this.data.clear();
  }
}

/**
 * Redis Storage Adapter (example)
 */
class RedisStorage {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  async get(key) {
    const data = await this.redis.get(`session:${key}`);
    return data ? JSON.parse(data) : null;
  }

  async set(key, value) {
    await this.redis.set(`session:${key}`, JSON.stringify(value));
  }

  async delete(key) {
    await this.redis.del(`session:${key}`);
  }

  async clear() {
    const keys = await this.redis.keys('session:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

/**
 * Express middleware for session management
 * @param {SessionManager} sessionManager - Session manager instance
 * @returns {Function} - Middleware function
 */
function sessionMiddleware(sessionManager) {
  return async (req, res, next) => {
    const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;

    if (sessionId) {
      const session = await sessionManager.validateSession(sessionId);

      if (session) {
        req.session = session;
        req.sessionId = sessionId;

        // Auto-refresh session
        await sessionManager.refreshSession(sessionId);
      }
    }

    next();
  };
}

module.exports = {
  SessionManager,
  MemoryStorage,
  RedisStorage,
  sessionMiddleware
};
