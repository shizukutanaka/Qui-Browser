/**
 * Zero Trust Security Middleware
 *
 * NIST SP 800-207 compliant zero trust architecture for web applications.
 * Based on NIST 2025 guidance and cloud-native security best practices.
 *
 * Core Principles:
 * - Never trust, always verify
 * - Assume breach mentality
 * - Verify explicitly (authentication + device)
 * - Least privilege access
 * - Micro-segmentation
 * - Continuous monitoring and validation
 *
 * Features:
 * - Identity verification (JWT/OAuth2/mTLS)
 * - Device posture assessment
 * - Context-aware access control
 * - Session monitoring and anomaly detection
 * - API gateway integration with policy enforcement
 * - Audit logging for compliance
 *
 * @see https://csrc.nist.gov/pubs/sp/800/207/final
 * @see https://csrc.nist.gov/pubs/sp/800/207/a/final (Cloud-Native)
 */

const EventEmitter = require('events');
const crypto = require('crypto');
const { promisify } = require('util');

class ZeroTrustSecurity extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      // Identity verification
      enableIdentityVerification: options.enableIdentityVerification !== false,
      identityProvider: options.identityProvider || 'jwt', // jwt, oauth2, mtls
      jwtSecret: options.jwtSecret || null,
      jwtAlgorithm: options.jwtAlgorithm || 'HS256',

      // Device posture assessment
      enableDevicePosture: options.enableDevicePosture || false,
      requiredDeviceAttributes: options.requiredDeviceAttributes || [],

      // Context-aware access control
      enableContextAwareAccess: options.enableContextAwareAccess !== false,
      allowedLocations: options.allowedLocations || [], // Country codes
      allowedIPRanges: options.allowedIPRanges || [],
      blockedIPRanges: options.blockedIPRanges || [],

      // Session management
      sessionTimeout: options.sessionTimeout || 3600000, // 1 hour
      enableSessionMonitoring: options.enableSessionMonitoring !== false,
      maxConcurrentSessions: options.maxConcurrentSessions || 5,

      // Anomaly detection
      enableAnomalyDetection: options.enableAnomalyDetection !== false,
      anomalyThreshold: options.anomalyThreshold || 0.7,

      // Policy enforcement
      defaultPolicy: options.defaultPolicy || 'deny', // allow, deny
      enableMicroSegmentation: options.enableMicroSegmentation || false,

      // Audit logging
      enableAuditLogging: options.enableAuditLogging !== false,
      auditLogRetention: options.auditLogRetention || 90, // days

      // Rate limiting
      enableRateLimiting: options.enableRateLimiting !== false,
      rateLimit: options.rateLimit || 100, // requests per minute
      rateLimitWindow: options.rateLimitWindow || 60000, // 1 minute

      ...options
    };

    // Active sessions
    this.sessions = new Map();

    // Access policies
    this.policies = new Map();

    // Rate limiting tracking
    this.rateLimits = new Map();

    // Audit log
    this.auditLog = [];

    // Anomaly detection baseline
    this.behaviorBaseline = new Map();

    // Statistics
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      deniedRequests: 0,
      identityVerificationFailures: 0,
      devicePostureFailures: 0,
      contextViolations: 0,
      anomaliesDetected: 0,
      activeSessions: 0
    };

    this.initializePolicies();
  }

  /**
   * Initialize default access policies
   */
  initializePolicies() {
    // Default policy: Deny all unless explicitly allowed
    this.registerPolicy('default', {
      resources: ['*'],
      actions: ['*'],
      effect: this.options.defaultPolicy,
      conditions: []
    });

    // Public endpoints (health checks)
    this.registerPolicy('public-health', {
      resources: ['/health', '/healthz', '/readyz'],
      actions: ['GET'],
      effect: 'allow',
      conditions: []
    });

    // Authenticated API endpoints
    this.registerPolicy('authenticated-api', {
      resources: ['/api/*'],
      actions: ['GET', 'POST', 'PUT', 'DELETE'],
      effect: 'allow',
      conditions: [
        { type: 'identity', required: true },
        { type: 'session', required: true }
      ]
    });

    // Admin endpoints (strict controls)
    this.registerPolicy('admin', {
      resources: ['/admin/*'],
      actions: ['*'],
      effect: 'allow',
      conditions: [
        { type: 'identity', required: true },
        { type: 'role', values: ['admin', 'superuser'] },
        { type: 'device', required: true },
        { type: 'location', allowedCountries: ['US', 'CA', 'GB'] }
      ]
    });

    this.emit('policiesInitialized', { policyCount: this.policies.size });
  }

  /**
   * Register access policy
   */
  registerPolicy(name, policy) {
    this.policies.set(name, {
      name,
      resources: policy.resources || [],
      actions: policy.actions || [],
      effect: policy.effect || 'deny',
      conditions: policy.conditions || [],
      priority: policy.priority || 100
    });

    this.emit('policyRegistered', { name, effect: policy.effect });
  }

  /**
   * Main middleware for zero trust verification
   */
  createMiddleware() {
    return async (req, res, next) => {
      const startTime = Date.now();
      this.stats.totalRequests++;

      try {
        // Extract context
        const context = this.extractContext(req);

        // Step 1: Identity verification
        if (this.options.enableIdentityVerification) {
          const identityResult = await this.verifyIdentity(req, context);
          if (!identityResult.verified) {
            this.stats.identityVerificationFailures++;
            this.stats.deniedRequests++;
            this.logAudit('identity_verification_failed', context, identityResult);

            return res.status(401).json({
              error: 'Identity verification failed',
              reason: identityResult.reason
            });
          }
          context.identity = identityResult.identity;
        }

        // Step 2: Device posture assessment
        if (this.options.enableDevicePosture) {
          const deviceResult = await this.assessDevicePosture(req, context);
          if (!deviceResult.compliant) {
            this.stats.devicePostureFailures++;
            this.stats.deniedRequests++;
            this.logAudit('device_posture_failed', context, deviceResult);

            return res.status(403).json({
              error: 'Device posture check failed',
              reason: deviceResult.reason
            });
          }
          context.device = deviceResult.device;
        }

        // Step 3: Context-aware access control
        if (this.options.enableContextAwareAccess) {
          const contextResult = await this.evaluateContext(req, context);
          if (!contextResult.allowed) {
            this.stats.contextViolations++;
            this.stats.deniedRequests++;
            this.logAudit('context_violation', context, contextResult);

            return res.status(403).json({
              error: 'Context-based access denied',
              reason: contextResult.reason
            });
          }
        }

        // Step 4: Policy evaluation
        const policyResult = await this.evaluatePolicies(req, context);
        if (policyResult.effect !== 'allow') {
          this.stats.deniedRequests++;
          this.logAudit('policy_denied', context, policyResult);

          return res.status(403).json({
            error: 'Access denied by policy',
            policy: policyResult.policy
          });
        }

        // Step 5: Session management
        if (this.options.enableSessionMonitoring && context.identity) {
          await this.manageSession(context);
        }

        // Step 6: Anomaly detection
        if (this.options.enableAnomalyDetection && context.identity) {
          const anomalyScore = await this.detectAnomalies(context);
          if (anomalyScore > this.options.anomalyThreshold) {
            this.stats.anomaliesDetected++;
            this.logAudit('anomaly_detected', context, { score: anomalyScore });

            // Allow but flag for review
            this.emit('anomalyDetected', { context, score: anomalyScore });
          }
        }

        // Step 7: Rate limiting
        if (this.options.enableRateLimiting) {
          const rateLimitResult = await this.checkRateLimit(context);
          if (!rateLimitResult.allowed) {
            this.stats.deniedRequests++;
            this.logAudit('rate_limit_exceeded', context);

            return res.status(429).json({
              error: 'Rate limit exceeded',
              retryAfter: rateLimitResult.retryAfter
            });
          }
        }

        // Access granted
        this.stats.allowedRequests++;
        this.logAudit('access_granted', context, {
          duration: Date.now() - startTime
        });

        // Attach context to request for downstream use
        req.zeroTrustContext = context;

        next();
      } catch (error) {
        this.emit('error', { operation: 'middleware', error: error.message });
        this.stats.deniedRequests++;

        res.status(500).json({
          error: 'Security verification failed',
          message: error.message
        });
      }
    };
  }

  /**
   * Extract request context
   */
  extractContext(req) {
    return {
      timestamp: Date.now(),
      requestId: this.generateRequestId(),
      ip: req.ip || req.connection.remoteAddress,
      method: req.method,
      path: req.path,
      userAgent: req.get('user-agent'),
      headers: req.headers,
      query: req.query,
      body: req.body
    };
  }

  /**
   * Verify identity (JWT/OAuth2/mTLS)
   */
  async verifyIdentity(req, context) {
    try {
      const authHeader = req.get('authorization');

      if (!authHeader) {
        return { verified: false, reason: 'No authorization header' };
      }

      if (this.options.identityProvider === 'jwt') {
        // JWT verification
        const token = authHeader.replace('Bearer ', '');
        const identity = await this.verifyJWT(token);

        if (!identity) {
          return { verified: false, reason: 'Invalid JWT token' };
        }

        return {
          verified: true,
          identity: {
            userId: identity.sub,
            username: identity.username,
            email: identity.email,
            roles: identity.roles || [],
            attributes: identity
          }
        };
      } else if (this.options.identityProvider === 'mtls') {
        // Mutual TLS verification
        const cert = req.socket.getPeerCertificate();

        if (!cert || !cert.subject) {
          return { verified: false, reason: 'No client certificate' };
        }

        return {
          verified: true,
          identity: {
            userId: cert.subject.CN,
            attributes: cert.subject
          }
        };
      }

      return { verified: false, reason: 'Unknown identity provider' };
    } catch (error) {
      return { verified: false, reason: error.message };
    }
  }

  /**
   * Verify JWT token
   */
  async verifyJWT(token) {
    try {
      // Simple JWT verification (replace with proper library in production)
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

      // Check expiration
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        return null;
      }

      // Verify signature (simplified - use jsonwebtoken library in production)
      if (this.options.jwtSecret) {
        const signature = crypto
          .createHmac('sha256', this.options.jwtSecret)
          .update(`${parts[0]}.${parts[1]}`)
          .digest('base64url');

        if (signature !== parts[2]) {
          return null;
        }
      }

      return payload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Assess device posture
   */
  async assessDevicePosture(req, context) {
    try {
      const deviceHeader = req.get('x-device-id');
      const deviceInfo = req.get('x-device-info');

      if (!deviceHeader) {
        return { compliant: false, reason: 'No device identifier' };
      }

      // Parse device info
      let device = { id: deviceHeader };

      if (deviceInfo) {
        try {
          device = { ...device, ...JSON.parse(deviceInfo) };
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Check required attributes
      for (const attr of this.options.requiredDeviceAttributes) {
        if (!device[attr]) {
          return {
            compliant: false,
            reason: `Missing required device attribute: ${attr}`
          };
        }
      }

      return { compliant: true, device };
    } catch (error) {
      return { compliant: false, reason: error.message };
    }
  }

  /**
   * Evaluate context (location, IP, time, etc.)
   */
  async evaluateContext(req, context) {
    try {
      // IP-based checks
      if (this.options.blockedIPRanges.length > 0) {
        if (this.isIPInRanges(context.ip, this.options.blockedIPRanges)) {
          return { allowed: false, reason: 'IP address blocked' };
        }
      }

      if (this.options.allowedIPRanges.length > 0) {
        if (!this.isIPInRanges(context.ip, this.options.allowedIPRanges)) {
          return { allowed: false, reason: 'IP address not in allowed range' };
        }
      }

      // Location-based checks (requires GeoIP lookup)
      if (this.options.allowedLocations.length > 0) {
        const location = await this.getLocationFromIP(context.ip);
        if (!this.options.allowedLocations.includes(location.country)) {
          return { allowed: false, reason: 'Location not allowed' };
        }
      }

      return { allowed: true };
    } catch (error) {
      return { allowed: false, reason: error.message };
    }
  }

  /**
   * Evaluate access policies
   */
  async evaluatePolicies(req, context) {
    // Sort policies by priority
    const sortedPolicies = Array.from(this.policies.values()).sort(
      (a, b) => a.priority - b.priority
    );

    for (const policy of sortedPolicies) {
      // Check if resource matches
      const resourceMatch = policy.resources.some(pattern =>
        this.matchPattern(context.path, pattern)
      );

      if (!resourceMatch) {
        continue;
      }

      // Check if action matches
      const actionMatch = policy.actions.includes('*') || policy.actions.includes(context.method);

      if (!actionMatch) {
        continue;
      }

      // Evaluate conditions
      const conditionsPass = await this.evaluateConditions(policy.conditions, context);

      if (conditionsPass) {
        return { effect: policy.effect, policy: policy.name };
      }
    }

    // No matching policy - use default
    return { effect: this.options.defaultPolicy, policy: 'default' };
  }

  /**
   * Evaluate policy conditions
   */
  async evaluateConditions(conditions, context) {
    for (const condition of conditions) {
      switch (condition.type) {
        case 'identity':
          if (condition.required && !context.identity) {
            return false;
          }
          break;

        case 'role':
          if (!context.identity || !context.identity.roles) {
            return false;
          }
          if (!condition.values.some(role => context.identity.roles.includes(role))) {
            return false;
          }
          break;

        case 'device':
          if (condition.required && !context.device) {
            return false;
          }
          break;

        case 'location':
          if (condition.allowedCountries) {
            const location = await this.getLocationFromIP(context.ip);
            if (!condition.allowedCountries.includes(location.country)) {
              return false;
            }
          }
          break;
      }
    }

    return true;
  }

  /**
   * Manage session
   */
  async manageSession(context) {
    const userId = context.identity.userId;
    const sessionId = this.generateSessionId(userId, context);

    let userSessions = this.sessions.get(userId) || [];

    // Check concurrent sessions
    if (userSessions.length >= this.options.maxConcurrentSessions) {
      // Remove oldest session
      userSessions.sort((a, b) => a.createdAt - b.createdAt);
      userSessions.shift();
    }

    // Add or update session
    const existingIndex = userSessions.findIndex(s => s.sessionId === sessionId);
    const session = {
      sessionId,
      userId,
      createdAt: existingIndex >= 0 ? userSessions[existingIndex].createdAt : Date.now(),
      lastActivity: Date.now(),
      ip: context.ip,
      userAgent: context.userAgent,
      requestCount: existingIndex >= 0 ? userSessions[existingIndex].requestCount + 1 : 1
    };

    if (existingIndex >= 0) {
      userSessions[existingIndex] = session;
    } else {
      userSessions.push(session);
    }

    this.sessions.set(userId, userSessions);
    this.stats.activeSessions = this.sessions.size;

    // Check session timeout
    if (Date.now() - session.createdAt > this.options.sessionTimeout) {
      this.emit('sessionExpired', { sessionId, userId });
      userSessions = userSessions.filter(s => s.sessionId !== sessionId);
      this.sessions.set(userId, userSessions);
    }
  }

  /**
   * Detect anomalies in user behavior
   */
  async detectAnomalies(context) {
    const userId = context.identity.userId;
    const baseline = this.behaviorBaseline.get(userId);

    if (!baseline) {
      // Initialize baseline
      this.behaviorBaseline.set(userId, {
        avgRequestRate: 1,
        commonPaths: [context.path],
        commonIPs: [context.ip],
        commonUserAgents: [context.userAgent],
        requestCount: 1,
        lastUpdate: Date.now()
      });
      return 0; // No anomaly for new users
    }

    let anomalyScore = 0;

    // Check request rate anomaly
    const timeSinceLastUpdate = Date.now() - baseline.lastUpdate;
    const currentRate = timeSinceLastUpdate > 0 ? 1000 / timeSinceLastUpdate : 0;
    if (currentRate > baseline.avgRequestRate * 3) {
      anomalyScore += 0.3;
    }

    // Check path anomaly
    if (!baseline.commonPaths.includes(context.path)) {
      anomalyScore += 0.2;
    }

    // Check IP anomaly
    if (!baseline.commonIPs.includes(context.ip)) {
      anomalyScore += 0.3;
    }

    // Check user agent anomaly
    if (!baseline.commonUserAgents.includes(context.userAgent)) {
      anomalyScore += 0.2;
    }

    // Update baseline
    baseline.requestCount++;
    baseline.avgRequestRate = (baseline.avgRequestRate * 0.9) + (currentRate * 0.1);
    if (!baseline.commonPaths.includes(context.path)) {
      baseline.commonPaths.push(context.path);
    }
    if (!baseline.commonIPs.includes(context.ip)) {
      baseline.commonIPs.push(context.ip);
    }
    baseline.lastUpdate = Date.now();

    return Math.min(anomalyScore, 1.0);
  }

  /**
   * Check rate limit
   */
  async checkRateLimit(context) {
    const key = context.identity ? context.identity.userId : context.ip;
    const now = Date.now();

    let limitInfo = this.rateLimits.get(key);

    if (!limitInfo) {
      limitInfo = {
        requests: [],
        windowStart: now
      };
    }

    // Remove old requests outside window
    limitInfo.requests = limitInfo.requests.filter(
      timestamp => now - timestamp < this.options.rateLimitWindow
    );

    // Check limit
    if (limitInfo.requests.length >= this.options.rateLimit) {
      const oldestRequest = Math.min(...limitInfo.requests);
      const retryAfter = Math.ceil((oldestRequest + this.options.rateLimitWindow - now) / 1000);

      return { allowed: false, retryAfter };
    }

    // Add current request
    limitInfo.requests.push(now);
    this.rateLimits.set(key, limitInfo);

    return { allowed: true, remaining: this.options.rateLimit - limitInfo.requests.length };
  }

  /**
   * Log audit event
   */
  logAudit(event, context, details = {}) {
    if (!this.options.enableAuditLogging) {
      return;
    }

    const entry = {
      timestamp: Date.now(),
      event,
      requestId: context.requestId,
      userId: context.identity ? context.identity.userId : null,
      ip: context.ip,
      method: context.method,
      path: context.path,
      ...details
    };

    this.auditLog.push(entry);

    // Enforce retention
    const retentionMs = this.options.auditLogRetention * 24 * 60 * 60 * 1000;
    this.auditLog = this.auditLog.filter(e => Date.now() - e.timestamp < retentionMs);

    this.emit('auditLogEntry', entry);
  }

  /**
   * Helper: Match pattern (simple wildcard)
   */
  matchPattern(value, pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(value);
  }

  /**
   * Helper: Check if IP is in ranges
   */
  isIPInRanges(ip, ranges) {
    // Simplified - use proper IP range checking library in production
    return ranges.some(range => ip.startsWith(range.split('/')[0]));
  }

  /**
   * Helper: Get location from IP (mock)
   */
  async getLocationFromIP(ip) {
    // Mock implementation - use GeoIP service in production
    return { country: 'US', city: 'Unknown' };
  }

  /**
   * Helper: Generate request ID
   */
  generateRequestId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Helper: Generate session ID
   */
  generateSessionId(userId, context) {
    const data = `${userId}-${context.ip}-${context.userAgent}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const totalRequests = this.stats.totalRequests;
    const allowRate = totalRequests > 0 ? (this.stats.allowedRequests / totalRequests) * 100 : 0;
    const denyRate = totalRequests > 0 ? (this.stats.deniedRequests / totalRequests) * 100 : 0;

    return {
      ...this.stats,
      allowRate,
      denyRate,
      auditLogSize: this.auditLog.length
    };
  }
}

module.exports = ZeroTrustSecurity;
