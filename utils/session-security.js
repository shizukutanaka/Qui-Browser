/**
 * Session Security Enhancement
 *
 * Implements secure session management with:
 * - Session fixation attack prevention (Improvement #13)
 * - Secure session ID generation
 * - Session rotation
 * - Device fingerprinting
 */

const crypto = require('crypto');

/**
 * Session configuration
 */
const DEFAULT_SESSION_CONFIG = {
  idLength: 32, // bytes
  cookieName: 'qui_session',
  secure: true, // HTTPS only
  httpOnly: true, // No JavaScript access
  sameSite: 'strict', // CSRF protection
  maxAge: 3600000, // 1 hour
  rotateOnPrivilegeChange: true,
  checkDeviceFingerprint: true
};

/**
 * Generate cryptographically secure session ID
 *
 * @param {number} length - Length in bytes
 * @returns {string} Session ID
 */
function generateSessionId(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash session ID for storage
 *
 * @param {string} sessionId - Raw session ID
 * @returns {string} Hashed session ID
 */
function hashSessionId(sessionId) {
  return crypto.createHash('sha256').update(sessionId).digest('hex');
}

/**
 * Generate device fingerprint
 *
 * @param {Object} req - HTTP request object
 * @returns {string} Device fingerprint
 */
function generateDeviceFingerprint(req) {
  const components = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
    req.socket.remoteAddress || '',
    // Don't include volatile headers like accept, referer
  ];

  const fingerprint = components.join('|');
  return crypto.createHash('sha256').update(fingerprint).digest('hex');
}

/**
 * Verify device fingerprint
 *
 * @param {Object} req - HTTP request object
 * @param {string} storedFingerprint - Stored fingerprint
 * @returns {boolean} Match result
 */
function verifyDeviceFingerprint(req, storedFingerprint) {
  const currentFingerprint = generateDeviceFingerprint(req);
  return currentFingerprint === storedFingerprint;
}

/**
 * Session Security Manager
 */
class SessionSecurityManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_SESSION_CONFIG, ...config };
    this.sessions = new Map(); // In-memory store (use Redis in production)
  }

  /**
   * Create new session (Improvement #13: Regenerate after login)
   *
   * @param {Object} req - HTTP request object
   * @param {Object} userData - User data to store in session
   * @returns {Object} Session object
   */
  createSession(req, userData = {}) {
    const sessionId = generateSessionId(this.config.idLength);
    const hashedId = hashSessionId(sessionId);

    const session = {
      id: hashedId,
      userId: userData.userId,
      data: userData,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      deviceFingerprint: this.config.checkDeviceFingerprint ? generateDeviceFingerprint(req) : null,
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      privilegeLevel: userData.privilegeLevel || 0
    };

    this.sessions.set(hashedId, session);

    return {
      sessionId, // Return raw ID to set in cookie
      session
    };
  }

  /**
   * Rotate session ID (anti-fixation)
   *
   * @param {string} oldSessionId - Current session ID
   * @param {Object} req - HTTP request object
   * @returns {Object|null} New session or null if not found
   */
  rotateSession(oldSessionId, req) {
    const oldHashedId = hashSessionId(oldSessionId);
    const oldSession = this.sessions.get(oldHashedId);

    if (!oldSession) {
      return null;
    }

    // Delete old session
    this.sessions.delete(oldHashedId);

    // Create new session with same data
    const newSessionId = generateSessionId(this.config.idLength);
    const newHashedId = hashSessionId(newSessionId);

    const newSession = {
      ...oldSession,
      id: newHashedId,
      lastActivity: Date.now(),
      rotatedAt: Date.now(),
      previousId: oldHashedId
    };

    this.sessions.set(newHashedId, newSession);

    return {
      sessionId: newSessionId,
      session: newSession
    };
  }

  /**
   * Validate session
   *
   * @param {string} sessionId - Session ID from cookie
   * @param {Object} req - HTTP request object
   * @returns {Object} Validation result
   */
  validateSession(sessionId, req) {
    if (!sessionId) {
      return { valid: false, reason: 'no_session_id' };
    }

    const hashedId = hashSessionId(sessionId);
    const session = this.sessions.get(hashedId);

    if (!session) {
      return { valid: false, reason: 'session_not_found' };
    }

    // Check expiration
    const now = Date.now();
    const age = now - session.createdAt;
    if (age > this.config.maxAge) {
      this.sessions.delete(hashedId);
      return { valid: false, reason: 'session_expired' };
    }

    // Check device fingerprint
    if (this.config.checkDeviceFingerprint && session.deviceFingerprint) {
      if (!verifyDeviceFingerprint(req, session.deviceFingerprint)) {
        this.sessions.delete(hashedId);
        return { valid: false, reason: 'device_mismatch' };
      }
    }

    // Update last activity
    session.lastActivity = now;

    return {
      valid: true,
      session
    };
  }

  /**
   * Destroy session
   *
   * @param {string} sessionId - Session ID
   * @returns {boolean} Success
   */
  destroySession(sessionId) {
    const hashedId = hashSessionId(sessionId);
    return this.sessions.delete(hashedId);
  }

  /**
   * Update session on privilege change
   *
   * @param {string} sessionId - Current session ID
   * @param {number} newPrivilegeLevel - New privilege level
   * @param {Object} req - HTTP request object
   * @returns {Object|null} New session or null
   */
  updatePrivilege(sessionId, newPrivilegeLevel, req) {
    if (!this.config.rotateOnPrivilegeChange) {
      const hashedId = hashSessionId(sessionId);
      const session = this.sessions.get(hashedId);
      if (session) {
        session.privilegeLevel = newPrivilegeLevel;
        return { sessionId, session };
      }
      return null;
    }

    // Rotate session on privilege change
    const rotated = this.rotateSession(sessionId, req);
    if (rotated) {
      rotated.session.privilegeLevel = newPrivilegeLevel;
    }
    return rotated;
  }

  /**
   * Get all sessions for a user
   *
   * @param {string} userId - User ID
   * @returns {Array} Sessions
   */
  getUserSessions(userId) {
    const userSessions = [];
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        userSessions.push(session);
      }
    }
    return userSessions;
  }

  /**
   * Destroy all sessions for a user
   *
   * @param {string} userId - User ID
   * @returns {number} Number of sessions destroyed
   */
  destroyUserSessions(userId) {
    let count = 0;
    for (const [hashedId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(hashedId);
        count++;
      }
    }
    return count;
  }

  /**
   * Set session cookie
   *
   * @param {Object} res - HTTP response object
   * @param {string} sessionId - Session ID
   */
  setSessionCookie(res, sessionId) {
    const cookieOptions = [];

    cookieOptions.push(`${this.config.cookieName}=${sessionId}`);
    cookieOptions.push(`Max-Age=${Math.floor(this.config.maxAge / 1000)}`);
    cookieOptions.push('Path=/');

    if (this.config.httpOnly) {
      cookieOptions.push('HttpOnly');
    }

    if (this.config.secure) {
      cookieOptions.push('Secure');
    }

    if (this.config.sameSite) {
      cookieOptions.push(`SameSite=${this.config.sameSite}`);
    }

    res.setHeader('Set-Cookie', cookieOptions.join('; '));
  }

  /**
   * Clear session cookie
   *
   * @param {Object} res - HTTP response object
   */
  clearSessionCookie(res) {
    res.setHeader('Set-Cookie', `${this.config.cookieName}=; Max-Age=0; Path=/`);
  }

  /**
   * Cleanup expired sessions
   *
   * @returns {number} Number of sessions removed
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    let count = 0;

    for (const [hashedId, session] of this.sessions.entries()) {
      const age = now - session.createdAt;
      if (age > this.config.maxAge) {
        this.sessions.delete(hashedId);
        count++;
      }
    }

    return count;
  }

  /**
   * Get session statistics
   *
   * @returns {Object} Statistics
   */
  getStatistics() {
    const now = Date.now();
    const stats = {
      total: this.sessions.size,
      active: 0,
      expired: 0,
      byPrivilege: {}
    };

    for (const session of this.sessions.values()) {
      const age = now - session.createdAt;
      if (age > this.config.maxAge) {
        stats.expired++;
      } else {
        stats.active++;
      }

      const level = session.privilegeLevel || 0;
      stats.byPrivilege[level] = (stats.byPrivilege[level] || 0) + 1;
    }

    return stats;
  }
}

/**
 * Parse cookies from request
 *
 * @param {Object} req - HTTP request object
 * @returns {Object} Parsed cookies
 */
function parseCookies(req) {
  const cookies = {};
  const cookieHeader = req.headers.cookie;

  if (cookieHeader) {
    const pairs = cookieHeader.split(';');
    for (const pair of pairs) {
      const [key, value] = pair.trim().split('=');
      if (key && value) {
        cookies[key] = decodeURIComponent(value);
      }
    }
  }

  return cookies;
}

/**
 * Session middleware factory
 *
 * @param {Object} config - Session configuration
 * @returns {Function} Middleware function
 */
function createSessionMiddleware(config = {}) {
  const manager = new SessionSecurityManager(config);

  // Cleanup interval
  const cleanupInterval = setInterval(() => {
    manager.cleanupExpiredSessions();
  }, 60000); // Every minute

  // Clear interval on process exit
  process.on('exit', () => clearInterval(cleanupInterval));

  return function sessionMiddleware(req, res, next) {
    const cookies = parseCookies(req);
    const sessionId = cookies[config.cookieName || DEFAULT_SESSION_CONFIG.cookieName];

    if (sessionId) {
      const validation = manager.validateSession(sessionId, req);
      if (validation.valid) {
        req.session = validation.session;
        req.sessionId = sessionId;
      }
    }

    // Helper methods
    req.createSession = (userData) => {
      const result = manager.createSession(req, userData);
      manager.setSessionCookie(res, result.sessionId);
      req.session = result.session;
      req.sessionId = result.sessionId;
      return result;
    };

    req.rotateSession = () => {
      if (!req.sessionId) return null;
      const result = manager.rotateSession(req.sessionId, req);
      if (result) {
        manager.setSessionCookie(res, result.sessionId);
        req.session = result.session;
        req.sessionId = result.sessionId;
      }
      return result;
    };

    req.destroySession = () => {
      if (!req.sessionId) return false;
      const success = manager.destroySession(req.sessionId);
      if (success) {
        manager.clearSessionCookie(res);
        delete req.session;
        delete req.sessionId;
      }
      return success;
    };

    next();
  };
}

module.exports = {
  SessionSecurityManager,
  generateSessionId,
  hashSessionId,
  generateDeviceFingerprint,
  verifyDeviceFingerprint,
  parseCookies,
  createSessionMiddleware,
  DEFAULT_SESSION_CONFIG
};
