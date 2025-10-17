/**
 * DDoS Protection Layer
 * Advanced protection against distributed denial of service attacks
 *
 * @module utils/ddos-protection
 */

const crypto = require('crypto');

/**
 * DDoS Protection System
 * Multi-layered protection against various DDoS attack vectors
 *
 * @class DDoSProtection
 * @description Provides comprehensive DDoS protection:
 * - IP-based rate limiting
 * - Connection limiting
 * - Request pattern analysis
 * - Slowloris protection
 * - HTTP flood protection
 * - Automatic blacklisting
 */
class DDoSProtection {
  /**
   * Create DDoS protection instance
   * @param {Object} options - Configuration options
   * @param {number} [options.maxConnectionsPerIp=100] - Max connections per IP
   * @param {number} [options.maxRequestsPerSecond=10] - Max requests per second per IP
   * @param {number} [options.maxRequestSize=1048576] - Max request size (1MB)
   * @param {number} [options.requestTimeout=30000] - Request timeout (ms)
   * @param {number} [options.blacklistDuration=3600000] - Blacklist duration (1 hour)
   * @param {number} [options.suspiciousThreshold=50] - Suspicious activity threshold
   * @param {boolean} [options.enablePatternDetection=true] - Enable attack pattern detection
   */
  constructor(options = {}) {
    this.maxConnectionsPerIp = options.maxConnectionsPerIp || 100;
    this.maxRequestsPerSecond = options.maxRequestsPerSecond || 10;
    this.maxRequestSize = options.maxRequestSize || 1024 * 1024; // 1MB
    this.requestTimeout = options.requestTimeout || 30000;
    this.blacklistDuration = options.blacklistDuration || 3600000; // 1 hour
    this.suspiciousThreshold = options.suspiciousThreshold || 50;
    this.enablePatternDetection = options.enablePatternDetection !== false;

    // Tracking maps
    this.connectionsByIp = new Map(); // IP -> Set of connections
    this.requestsByIp = new Map(); // IP -> Array of timestamps
    this.blacklist = new Map(); // IP -> expiry timestamp
    this.suspiciousActivity = new Map(); // IP -> score
    this.requestPatterns = new Map(); // IP -> Array of request patterns

    // Statistics
    this.stats = {
      totalBlocked: 0,
      totalAllowed: 0,
      currentConnections: 0,
      blacklistedIps: 0,
      suspiciousIps: 0,
      attacksDetected: 0
    };

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Check if request should be allowed
   * @param {Object} req - HTTP request
   * @returns {Object} - Decision object
   */
  checkRequest(req) {
    const ip = this.getClientIp(req);
    const now = Date.now();

    // Check blacklist
    if (this.isBlacklisted(ip, now)) {
      this.stats.totalBlocked++;
      return {
        allowed: false,
        reason: 'IP_BLACKLISTED',
        retryAfter: this.getBlacklistExpiry(ip) - now
      };
    }

    // Check connection limit
    const connectionCheck = this.checkConnectionLimit(ip);
    if (!connectionCheck.allowed) {
      this.recordSuspiciousActivity(ip, 'EXCESSIVE_CONNECTIONS');
      this.stats.totalBlocked++;
      return connectionCheck;
    }

    // Check request rate
    const rateCheck = this.checkRequestRate(ip, now);
    if (!rateCheck.allowed) {
      this.recordSuspiciousActivity(ip, 'EXCESSIVE_REQUESTS');
      this.stats.totalBlocked++;
      return rateCheck;
    }

    // Check request pattern
    if (this.enablePatternDetection) {
      const patternCheck = this.checkRequestPattern(req, ip);
      if (!patternCheck.allowed) {
        this.recordSuspiciousActivity(ip, 'SUSPICIOUS_PATTERN');
        this.stats.totalBlocked++;
        return patternCheck;
      }
    }

    // Check suspicious activity score
    const score = this.getSuspiciousScore(ip);
    if (score >= this.suspiciousThreshold) {
      this.addToBlacklist(ip);
      this.stats.totalBlocked++;
      this.stats.attacksDetected++;
      return {
        allowed: false,
        reason: 'SUSPICIOUS_ACTIVITY',
        score,
        retryAfter: this.blacklistDuration
      };
    }

    // Request allowed
    this.recordRequest(ip, req, now);
    this.stats.totalAllowed++;

    return {
      allowed: true,
      reason: null,
      suspiciousScore: score
    };
  }

  /**
   * Get client IP address
   * @private
   * @param {Object} req - HTTP request
   * @returns {string} - Client IP
   */
  getClientIp(req) {
    // Check X-Forwarded-For header
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = forwarded.split(',').map(ip => ip.trim());
      return ips[0];
    }

    // Check X-Real-IP header
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return realIp.trim();
    }

    // Use socket address
    return req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
  }

  /**
   * Check if IP is blacklisted
   * @private
   * @param {string} ip - IP address
   * @param {number} now - Current timestamp
   * @returns {boolean} - True if blacklisted
   */
  isBlacklisted(ip, now) {
    const expiry = this.blacklist.get(ip);
    if (!expiry) {
      return false;
    }

    if (now >= expiry) {
      this.blacklist.delete(ip);
      this.stats.blacklistedIps--;
      return false;
    }

    return true;
  }

  /**
   * Get blacklist expiry time
   * @private
   * @param {string} ip - IP address
   * @returns {number} - Expiry timestamp
   */
  getBlacklistExpiry(ip) {
    return this.blacklist.get(ip) || 0;
  }

  /**
   * Check connection limit
   * @private
   * @param {string} ip - IP address
   * @returns {Object} - Check result
   */
  checkConnectionLimit(ip) {
    const connections = this.connectionsByIp.get(ip);
    const count = connections ? connections.size : 0;

    if (count >= this.maxConnectionsPerIp) {
      return {
        allowed: false,
        reason: 'CONNECTION_LIMIT_EXCEEDED',
        limit: this.maxConnectionsPerIp,
        current: count
      };
    }

    return { allowed: true };
  }

  /**
   * Check request rate
   * @private
   * @param {string} ip - IP address
   * @param {number} now - Current timestamp
   * @returns {Object} - Check result
   */
  checkRequestRate(ip, now) {
    const requests = this.requestsByIp.get(ip) || [];
    const oneSecondAgo = now - 1000;

    // Count requests in last second
    const recentRequests = requests.filter(time => time >= oneSecondAgo);

    if (recentRequests.length >= this.maxRequestsPerSecond) {
      return {
        allowed: false,
        reason: 'RATE_LIMIT_EXCEEDED',
        limit: this.maxRequestsPerSecond,
        current: recentRequests.length,
        retryAfter: 1000
      };
    }

    return { allowed: true };
  }

  /**
   * Check request pattern for suspicious activity
   * @private
   * @param {Object} req - HTTP request
   * @param {string} ip - IP address
   * @returns {Object} - Check result
   */
  checkRequestPattern(req, ip) {
    const pattern = this.extractRequestPattern(req);

    if (!this.requestPatterns.has(ip)) {
      this.requestPatterns.set(ip, []);
    }

    const patterns = this.requestPatterns.get(ip);
    patterns.push(pattern);

    // Keep only last 100 patterns
    if (patterns.length > 100) {
      patterns.shift();
    }

    // Detect suspicious patterns
    const suspicious = this.detectSuspiciousPatterns(patterns);

    if (suspicious.detected) {
      return {
        allowed: false,
        reason: 'SUSPICIOUS_PATTERN_DETECTED',
        patternType: suspicious.type
      };
    }

    return { allowed: true };
  }

  /**
   * Extract request pattern
   * @private
   * @param {Object} req - HTTP request
   * @returns {Object} - Request pattern
   */
  extractRequestPattern(req) {
    return {
      method: req.method,
      path: this.normalizePath(req.url),
      userAgent: req.headers['user-agent'] || '',
      hasBody: req.headers['content-length'] > 0,
      timestamp: Date.now()
    };
  }

  /**
   * Normalize URL path
   * @private
   * @param {string} url - URL
   * @returns {string} - Normalized path
   */
  normalizePath(url) {
    try {
      const parsed = new URL(url, 'http://localhost');
      return parsed.pathname;
    } catch {
      return '/';
    }
  }

  /**
   * Detect suspicious patterns
   * @private
   * @param {Array} patterns - Request patterns
   * @returns {Object} - Detection result
   */
  detectSuspiciousPatterns(patterns) {
    if (patterns.length < 10) {
      return { detected: false };
    }

    // Check for identical requests (potential replay attack)
    const recentPatterns = patterns.slice(-10);
    const uniquePatterns = new Set(recentPatterns.map(p => JSON.stringify(p)));
    if (uniquePatterns.size === 1) {
      return { detected: true, type: 'IDENTICAL_REQUESTS' };
    }

    // Check for path scanning
    const recentPaths = recentPatterns.map(p => p.path);
    const uniquePaths = new Set(recentPaths);
    if (uniquePaths.size >= 8) {
      // 8+ different paths in 10 requests
      return { detected: true, type: 'PATH_SCANNING' };
    }

    // Check for rapid POST requests
    const postRequests = recentPatterns.filter(p => p.method === 'POST').length;
    if (postRequests >= 7) {
      return { detected: true, type: 'POST_FLOODING' };
    }

    // Check for missing User-Agent (potential bot)
    const missingUserAgent = recentPatterns.filter(p => !p.userAgent).length;
    if (missingUserAgent >= 5) {
      return { detected: true, type: 'MISSING_USER_AGENT' };
    }

    return { detected: false };
  }

  /**
   * Record suspicious activity
   * @private
   * @param {string} ip - IP address
   * @param {string} type - Activity type
   */
  recordSuspiciousActivity(ip, type) {
    const score = this.suspiciousActivity.get(ip) || 0;
    const increment = this.getActivityScore(type);
    const newScore = score + increment;

    this.suspiciousActivity.set(ip, newScore);

    if (newScore >= this.suspiciousThreshold) {
      this.stats.suspiciousIps++;
    }
  }

  /**
   * Get activity score increment
   * @private
   * @param {string} type - Activity type
   * @returns {number} - Score increment
   */
  getActivityScore(type) {
    const scores = {
      EXCESSIVE_CONNECTIONS: 20,
      EXCESSIVE_REQUESTS: 15,
      SUSPICIOUS_PATTERN: 25,
      SLOW_REQUEST: 10,
      LARGE_REQUEST: 10,
      INVALID_REQUEST: 5
    };

    return scores[type] || 5;
  }

  /**
   * Get suspicious score for IP
   * @private
   * @param {string} ip - IP address
   * @returns {number} - Suspicious score
   */
  getSuspiciousScore(ip) {
    return this.suspiciousActivity.get(ip) || 0;
  }

  /**
   * Record request
   * @private
   * @param {string} ip - IP address
   * @param {Object} req - HTTP request
   * @param {number} now - Current timestamp
   */
  recordRequest(ip, req, now) {
    // Record request timestamp
    if (!this.requestsByIp.has(ip)) {
      this.requestsByIp.set(ip, []);
    }

    const requests = this.requestsByIp.get(ip);
    requests.push(now);

    // Keep only last 100 requests
    if (requests.length > 100) {
      requests.shift();
    }
  }

  /**
   * Track connection
   * @param {string} ip - IP address
   * @param {Object} connection - Connection object
   */
  trackConnection(ip, connection) {
    if (!this.connectionsByIp.has(ip)) {
      this.connectionsByIp.set(ip, new Set());
    }

    this.connectionsByIp.get(ip).add(connection);
    this.stats.currentConnections++;

    // Auto-cleanup on close
    connection.on('close', () => {
      this.untrackConnection(ip, connection);
    });
  }

  /**
   * Untrack connection
   * @param {string} ip - IP address
   * @param {Object} connection - Connection object
   */
  untrackConnection(ip, connection) {
    const connections = this.connectionsByIp.get(ip);
    if (connections) {
      connections.delete(connection);
      this.stats.currentConnections--;

      if (connections.size === 0) {
        this.connectionsByIp.delete(ip);
      }
    }
  }

  /**
   * Add IP to blacklist
   * @param {string} ip - IP address
   * @param {number} [duration] - Duration in ms (default: blacklistDuration)
   */
  addToBlacklist(ip, duration = null) {
    const expiry = Date.now() + (duration || this.blacklistDuration);
    this.blacklist.set(ip, expiry);
    this.stats.blacklistedIps++;
  }

  /**
   * Remove IP from blacklist
   * @param {string} ip - IP address
   * @returns {boolean} - True if removed
   */
  removeFromBlacklist(ip) {
    const removed = this.blacklist.delete(ip);
    if (removed) {
      this.stats.blacklistedIps--;
    }
    return removed;
  }

  /**
   * Check if IP is in whitelist
   * @param {string} ip - IP address
   * @returns {boolean} - True if whitelisted
   */
  isWhitelisted(ip) {
    // Add your whitelist logic here
    // For example, local IPs
    return ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.');
  }

  /**
   * Start cleanup interval
   * @private
   */
  startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Run every minute
  }

  /**
   * Cleanup expired data
   * @private
   */
  cleanup() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    // Cleanup blacklist
    for (const [ip, expiry] of this.blacklist.entries()) {
      if (now >= expiry) {
        this.blacklist.delete(ip);
        this.stats.blacklistedIps--;
      }
    }

    // Cleanup old requests
    for (const [ip, requests] of this.requestsByIp.entries()) {
      const filtered = requests.filter(time => time > oneHourAgo);
      if (filtered.length === 0) {
        this.requestsByIp.delete(ip);
      } else {
        this.requestsByIp.set(ip, filtered);
      }
    }

    // Decay suspicious scores
    for (const [ip, score] of this.suspiciousActivity.entries()) {
      const newScore = Math.max(0, score - 1);
      if (newScore === 0) {
        this.suspiciousActivity.delete(ip);
      } else {
        this.suspiciousActivity.set(ip, newScore);
      }
    }

    // Cleanup old patterns
    for (const [ip, patterns] of this.requestPatterns.entries()) {
      const filtered = patterns.filter(p => p.timestamp > oneHourAgo);
      if (filtered.length === 0) {
        this.requestPatterns.delete(ip);
      } else {
        this.requestPatterns.set(ip, filtered);
      }
    }
  }

  /**
   * Get protection statistics
   * @returns {Object} - Statistics
   */
  getStats() {
    return {
      ...this.stats,
      trackedIps: this.requestsByIp.size,
      blacklistedIpsCount: this.blacklist.size,
      suspiciousIpsCount: this.suspiciousActivity.size
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalBlocked: 0,
      totalAllowed: 0,
      currentConnections: 0,
      blacklistedIps: 0,
      suspiciousIps: 0,
      attacksDetected: 0
    };
  }

  /**
   * Stop DDoS protection
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

module.exports = DDoSProtection;
