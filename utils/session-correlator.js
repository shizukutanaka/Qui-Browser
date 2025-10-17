/**
 * Session Log Correlation Analytics
 * Lightweight correlation analytics across session logs
 * Priority: H012 from improvement backlog
 *
 * @module utils/session-correlator
 */

const crypto = require('crypto');

class SessionCorrelator {
  constructor(options = {}) {
    this.options = {
      sessionTimeout: options.sessionTimeout || 1800000, // 30 minutes
      maxSessionsTracked: options.maxSessionsTracked || 10000,
      enablePatternDetection: options.enablePatternDetection !== false,
      enableAnomalyDetection: options.enableAnomalyDetection || false,
      correlationWindow: options.correlationWindow || 300000, // 5 minutes
      ...options
    };

    // Session tracking
    this.sessions = new Map();
    this.correlations = new Map();

    // Pattern detection
    this.patterns = {
      requestSequences: new Map(),
      errorPatterns: new Map(),
      performancePatterns: new Map()
    };

    // Start cleanup
    this.startCleanup();
  }

  /**
   * Track session event
   * @param {string} sessionId - Session ID
   * @param {Object} event - Event data
   */
  trackEvent(sessionId, event) {
    // Get or create session
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = this.createSession(sessionId);
      this.sessions.set(sessionId, session);
    }

    // Update session
    session.lastActivity = Date.now();
    session.eventCount++;

    // Add event to session
    const enrichedEvent = {
      ...event,
      timestamp: Date.now(),
      sequenceNumber: session.eventCount
    };

    session.events.push(enrichedEvent);

    // Trim events if too many
    if (session.events.length > 1000) {
      session.events = session.events.slice(-1000);
    }

    // Update session metadata
    this.updateSessionMetadata(session, enrichedEvent);

    // Pattern detection
    if (this.options.enablePatternDetection) {
      this.detectPatterns(session, enrichedEvent);
    }

    // Anomaly detection
    if (this.options.enableAnomalyDetection) {
      this.detectAnomalies(session, enrichedEvent);
    }

    // Check for correlations
    this.checkCorrelations(sessionId, enrichedEvent);
  }

  /**
   * Create new session
   * @param {string} sessionId - Session ID
   * @returns {Object} Session object
   */
  createSession(sessionId) {
    return {
      id: sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      events: [],
      eventCount: 0,
      metadata: {
        userAgent: null,
        ip: null,
        endpoints: new Set(),
        errors: [],
        totalResponseTime: 0,
        requestCount: 0
      },
      flags: {
        suspicious: false,
        highError: false,
        slowPerformance: false
      }
    };
  }

  /**
   * Update session metadata
   * @param {Object} session - Session object
   * @param {Object} event - Event data
   */
  updateSessionMetadata(session, event) {
    const { metadata } = session;

    // User agent
    if (event.userAgent && !metadata.userAgent) {
      metadata.userAgent = event.userAgent;
    }

    // IP address
    if (event.ip && !metadata.ip) {
      metadata.ip = event.ip;
    }

    // Endpoints
    if (event.endpoint) {
      metadata.endpoints.add(event.endpoint);
    }

    // Errors
    if (event.type === 'error' || event.error) {
      metadata.errors.push({
        timestamp: event.timestamp,
        type: event.errorType || 'unknown',
        message: event.errorMessage || event.message,
        statusCode: event.statusCode
      });
    }

    // Performance
    if (event.responseTime) {
      metadata.totalResponseTime += event.responseTime;
      metadata.requestCount++;
    }

    // Update flags
    this.updateSessionFlags(session);
  }

  /**
   * Update session flags
   * @param {Object} session - Session object
   */
  updateSessionFlags(session) {
    const { metadata } = session;

    // High error rate
    if (metadata.errors.length > 10) {
      session.flags.highError = true;
    }

    // Slow performance
    if (metadata.requestCount > 0) {
      const avgResponseTime = metadata.totalResponseTime / metadata.requestCount;
      if (avgResponseTime > 1000) { // 1 second average
        session.flags.slowPerformance = true;
      }
    }

    // Suspicious patterns
    if (metadata.endpoints.size > 50) { // Too many different endpoints
      session.flags.suspicious = true;
    }
  }

  /**
   * Detect patterns in session
   * @param {Object} session - Session object
   * @param {Object} event - Current event
   */
  detectPatterns(session, event) {
    // Request sequence detection
    if (event.type === 'request' && event.endpoint) {
      this.trackRequestSequence(session.id, event.endpoint);
    }

    // Error pattern detection
    if (event.type === 'error') {
      this.trackErrorPattern(session.id, event);
    }

    // Performance pattern detection
    if (event.responseTime) {
      this.trackPerformancePattern(session.id, event);
    }
  }

  /**
   * Track request sequence
   * @param {string} sessionId - Session ID
   * @param {string} endpoint - Endpoint
   */
  trackRequestSequence(sessionId, endpoint) {
    if (!this.patterns.requestSequences.has(sessionId)) {
      this.patterns.requestSequences.set(sessionId, []);
    }

    const sequence = this.patterns.requestSequences.get(sessionId);
    sequence.push({
      endpoint,
      timestamp: Date.now()
    });

    // Keep only last 20 requests
    if (sequence.length > 20) {
      sequence.shift();
    }
  }

  /**
   * Track error pattern
   * @param {string} sessionId - Session ID
   * @param {Object} event - Error event
   */
  trackErrorPattern(sessionId, event) {
    if (!this.patterns.errorPatterns.has(sessionId)) {
      this.patterns.errorPatterns.set(sessionId, []);
    }

    const errors = this.patterns.errorPatterns.get(sessionId);
    errors.push({
      type: event.errorType || 'unknown',
      endpoint: event.endpoint,
      timestamp: Date.now()
    });

    // Keep only last 50 errors
    if (errors.length > 50) {
      errors.shift();
    }
  }

  /**
   * Track performance pattern
   * @param {string} sessionId - Session ID
   * @param {Object} event - Performance event
   */
  trackPerformancePattern(sessionId, event) {
    if (!this.patterns.performancePatterns.has(sessionId)) {
      this.patterns.performancePatterns.set(sessionId, []);
    }

    const perf = this.patterns.performancePatterns.get(sessionId);
    perf.push({
      endpoint: event.endpoint,
      responseTime: event.responseTime,
      timestamp: Date.now()
    });

    // Keep only last 100 measurements
    if (perf.length > 100) {
      perf.shift();
    }
  }

  /**
   * Detect anomalies in session
   * @param {Object} session - Session object
   * @param {Object} event - Current event
   * @returns {Array} Detected anomalies
   */
  detectAnomalies(session, event) {
    const anomalies = [];

    // Rapid request rate
    const recentEvents = session.events.slice(-10);
    if (recentEvents.length === 10) {
      const timeSpan = recentEvents[9].timestamp - recentEvents[0].timestamp;
      if (timeSpan < 1000) { // 10 requests in 1 second
        anomalies.push({
          type: 'rapid_requests',
          severity: 'medium',
          message: '10 requests in less than 1 second'
        });
      }
    }

    // Repeated errors
    const recentErrors = session.metadata.errors.slice(-5);
    if (recentErrors.length === 5) {
      const errorTypes = new Set(recentErrors.map(e => e.type));
      if (errorTypes.size === 1) {
        anomalies.push({
          type: 'repeated_errors',
          severity: 'high',
          message: `5 consecutive errors of type: ${Array.from(errorTypes)[0]}`
        });
      }
    }

    // Unusual endpoint access
    if (event.endpoint && this.isUnusualEndpoint(event.endpoint)) {
      anomalies.push({
        type: 'unusual_endpoint',
        severity: 'low',
        message: `Unusual endpoint accessed: ${event.endpoint}`
      });
    }

    if (anomalies.length > 0) {
      session.anomalies = session.anomalies || [];
      session.anomalies.push(...anomalies);
    }

    return anomalies;
  }

  /**
   * Check if endpoint is unusual
   * @param {string} endpoint - Endpoint
   * @returns {boolean} Is unusual
   */
  isUnusualEndpoint(endpoint) {
    const unusualPatterns = [
      /\/admin\//,
      /\/\.env/,
      /\/\.git/,
      /\/config\//,
      /\/backup/,
      /\.\./
    ];

    return unusualPatterns.some(pattern => pattern.test(endpoint));
  }

  /**
   * Check for correlations with other sessions
   * @param {string} sessionId - Session ID
   * @param {Object} event - Event
   */
  checkCorrelations(sessionId, event) {
    const now = Date.now();
    const windowStart = now - this.options.correlationWindow;

    // Find sessions with similar recent activity
    for (const [otherId, otherSession] of this.sessions.entries()) {
      if (otherId === sessionId) continue;

      if (otherSession.lastActivity >= windowStart) {
        const correlation = this.calculateCorrelation(
          this.sessions.get(sessionId),
          otherSession
        );

        if (correlation.score > 0.7) {
          this.recordCorrelation(sessionId, otherId, correlation);
        }
      }
    }
  }

  /**
   * Calculate correlation between two sessions
   * @param {Object} session1 - First session
   * @param {Object} session2 - Second session
   * @returns {Object} Correlation data
   */
  calculateCorrelation(session1, session2) {
    let score = 0;
    const factors = [];

    // Same IP
    if (session1.metadata.ip === session2.metadata.ip) {
      score += 0.3;
      factors.push('same_ip');
    }

    // Same user agent
    if (session1.metadata.userAgent === session2.metadata.userAgent) {
      score += 0.2;
      factors.push('same_user_agent');
    }

    // Similar endpoints
    const endpoints1 = Array.from(session1.metadata.endpoints);
    const endpoints2 = Array.from(session2.metadata.endpoints);
    const commonEndpoints = endpoints1.filter(e => endpoints2.includes(e));
    const endpointSimilarity = commonEndpoints.length / Math.max(endpoints1.length, endpoints2.length);

    if (endpointSimilarity > 0.5) {
      score += endpointSimilarity * 0.3;
      factors.push('similar_endpoints');
    }

    // Similar errors
    const errors1 = session1.metadata.errors.map(e => e.type);
    const errors2 = session2.metadata.errors.map(e => e.type);
    const commonErrors = errors1.filter(e => errors2.includes(e));

    if (commonErrors.length > 2) {
      score += 0.2;
      factors.push('similar_errors');
    }

    return {
      score,
      factors,
      timestamp: Date.now()
    };
  }

  /**
   * Record correlation between sessions
   * @param {string} sessionId1 - First session ID
   * @param {string} sessionId2 - Second session ID
   * @param {Object} correlation - Correlation data
   */
  recordCorrelation(sessionId1, sessionId2, correlation) {
    const key = [sessionId1, sessionId2].sort().join('::');

    this.correlations.set(key, {
      sessions: [sessionId1, sessionId2],
      ...correlation
    });
  }

  /**
   * Get session data
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Session data
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get correlated sessions
   * @param {string} sessionId - Session ID
   * @returns {Array} Correlated sessions
   */
  getCorrelatedSessions(sessionId) {
    const correlated = [];

    for (const [key, correlation] of this.correlations.entries()) {
      if (correlation.sessions.includes(sessionId)) {
        const otherId = correlation.sessions.find(id => id !== sessionId);
        correlated.push({
          sessionId: otherId,
          ...correlation
        });
      }
    }

    return correlated.sort((a, b) => b.score - a.score);
  }

  /**
   * Get session patterns
   * @param {string} sessionId - Session ID
   * @returns {Object} Session patterns
   */
  getSessionPatterns(sessionId) {
    return {
      requestSequence: this.patterns.requestSequences.get(sessionId) || [],
      errorPattern: this.patterns.errorPatterns.get(sessionId) || [],
      performancePattern: this.patterns.performancePatterns.get(sessionId) || []
    };
  }

  /**
   * Get suspicious sessions
   * @returns {Array} Suspicious sessions
   */
  getSuspiciousSessions() {
    const suspicious = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.flags.suspicious ||
          session.flags.highError ||
          (session.anomalies && session.anomalies.length > 3)) {
        suspicious.push({
          sessionId,
          flags: session.flags,
          anomalies: session.anomalies || [],
          eventCount: session.eventCount,
          errorCount: session.metadata.errors.length
        });
      }
    }

    return suspicious.sort((a, b) => b.eventCount - a.eventCount);
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const now = Date.now();
    const activeThreshold = now - this.options.sessionTimeout;

    const activeSessions = Array.from(this.sessions.values())
      .filter(s => s.lastActivity >= activeThreshold);

    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      totalCorrelations: this.correlations.size,
      suspiciousSessions: this.getSuspiciousSessions().length,
      patterns: {
        requestSequences: this.patterns.requestSequences.size,
        errorPatterns: this.patterns.errorPatterns.size,
        performancePatterns: this.patterns.performancePatterns.size
      }
    };
  }

  /**
   * Start cleanup interval
   */
  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute
  }

  /**
   * Cleanup old sessions and data
   */
  cleanup() {
    const now = Date.now();
    const expireTime = now - this.options.sessionTimeout;

    // Remove expired sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActivity < expireTime) {
        this.sessions.delete(sessionId);
        this.patterns.requestSequences.delete(sessionId);
        this.patterns.errorPatterns.delete(sessionId);
        this.patterns.performancePatterns.delete(sessionId);
      }
    }

    // Remove old correlations
    for (const [key, correlation] of this.correlations.entries()) {
      if (correlation.timestamp < expireTime) {
        this.correlations.delete(key);
      }
    }

    // Enforce max sessions limit
    if (this.sessions.size > this.options.maxSessionsTracked) {
      const sortedSessions = Array.from(this.sessions.entries())
        .sort((a, b) => a[1].lastActivity - b[1].lastActivity);

      const toRemove = sortedSessions.slice(0, this.sessions.size - this.options.maxSessionsTracked);

      for (const [sessionId] of toRemove) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Stop cleanup interval
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Create Express middleware
   * @returns {Function} Express middleware
   */
  middleware() {
    return (req, res, next) => {
      const sessionId = req.sessionID || req.session?.id || this.generateSessionId(req);

      // Track request event
      this.trackEvent(sessionId, {
        type: 'request',
        endpoint: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      // Track response
      const startTime = Date.now();

      res.on('finish', () => {
        this.trackEvent(sessionId, {
          type: 'response',
          endpoint: req.path,
          statusCode: res.statusCode,
          responseTime: Date.now() - startTime
        });

        if (res.statusCode >= 400) {
          this.trackEvent(sessionId, {
            type: 'error',
            endpoint: req.path,
            statusCode: res.statusCode,
            errorType: res.statusCode >= 500 ? 'server_error' : 'client_error'
          });
        }
      });

      next();
    };
  }

  /**
   * Generate session ID from request
   * @param {Object} req - Request object
   * @returns {string} Session ID
   */
  generateSessionId(req) {
    const components = [
      req.ip,
      req.get('user-agent'),
      Date.now().toString()
    ].join('::');

    return crypto.createHash('sha256').update(components).digest('hex').substring(0, 16);
  }
}

module.exports = SessionCorrelator;
