/**
 * Production Security Middleware
 *
 * Implements critical P0 security improvements (#3-10):
 * - CORS default hardening (no wildcards)
 * - HTTPS redirect enforcement
 * - Security headers mandatory enforcement
 * - API key exposure prevention
 * - Session secret validation
 * - Webhook signature validation
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');

/**
 * Production security configuration
 */
const DEFAULT_PRODUCTION_SECURITY_CONFIG = {
  // CORS (Improvement #3)
  cors: {
    enabled: true,
    allowWildcard: false, // Never allow '*' in production
    origins: [], // Whitelist only
    credentials: true,
    maxAge: 600 // 10 minutes preflight cache
  },

  // HTTPS enforcement (Improvement #8)
  https: {
    enabled: true,
    trustProxy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  },

  // Security headers (Improvement #9)
  headers: {
    enforceOnAllResponses: true,
    removeServerHeader: true,
    removePoweredBy: true
  },

  // Session security (Improvement #5)
  session: {
    requireSecret: true,
    minSecretLength: 32,
    rotateOnLogin: true
  },

  // Webhook validation (Improvement #6)
  webhook: {
    timestampTolerance: 300, // 5 minutes
    requireTimestamp: true
  },

  // API key protection (Improvement #10)
  apiKey: {
    preventExposure: true,
    maskLength: 4, // Show only last 4 chars
    dangerousPatterns: [
      /[a-zA-Z0-9]{20,}/g, // Tokens
      /sk_live_[a-zA-Z0-9]+/g, // Stripe secret keys
      /pk_live_[a-zA-Z0-9]+/g, // Stripe public keys
      /AIza[a-zA-Z0-9_-]{35}/g, // Google API keys
      /AKIA[A-Z0-9]{16}/g, // AWS access keys
      /[a-f0-9]{40}/g // Generic API keys
    ]
  }
};

/**
 * CORS policy manager
 */
class CORSPolicyManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_PRODUCTION_SECURITY_CONFIG.cors, ...config };
    this.allowedOrigins = new Set(this.config.origins);
  }

  /**
   * Check if origin is allowed
   */
  isOriginAllowed(origin) {
    if (!origin) return false;

    // Never allow wildcard in production
    if (this.config.allowWildcard === false && origin === '*') {
      return false;
    }

    // Check exact match
    if (this.allowedOrigins.has(origin)) {
      return true;
    }

    // Check pattern match (e.g., *.example.com)
    for (const allowed of this.allowedOrigins) {
      if (this.matchOriginPattern(origin, allowed)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Match origin against pattern
   */
  matchOriginPattern(origin, pattern) {
    if (!pattern.includes('*')) {
      return origin === pattern;
    }

    const regex = new RegExp(
      '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^.]+') + '$'
    );
    return regex.test(origin);
  }

  /**
   * Get CORS headers
   */
  getHeaders(origin) {
    if (!this.isOriginAllowed(origin)) {
      return {};
    }

    const headers = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': this.config.maxAge.toString()
    };

    if (this.config.credentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    return headers;
  }

  /**
   * Add allowed origin
   */
  addOrigin(origin) {
    this.allowedOrigins.add(origin);
  }

  /**
   * Remove allowed origin
   */
  removeOrigin(origin) {
    this.allowedOrigins.delete(origin);
  }
}

/**
 * HTTPS redirect manager
 */
class HTTPSRedirectManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_PRODUCTION_SECURITY_CONFIG.https, ...config };
  }

  /**
   * Check if request is HTTPS
   */
  isHTTPS(req) {
    // Check protocol
    if (req.protocol === 'https') return true;

    // Check X-Forwarded-Proto header (behind proxy)
    if (this.config.trustProxy) {
      const forwarded = req.headers['x-forwarded-proto'];
      if (forwarded === 'https') return true;
    }

    // Check encrypted flag
    if (req.connection && req.connection.encrypted) return true;

    return false;
  }

  /**
   * Get HTTPS redirect URL
   */
  getRedirectURL(req) {
    const host = req.headers.host || 'localhost';
    const url = req.url || '/';
    return `https://${host}${url}`;
  }

  /**
   * Create middleware
   */
  createMiddleware() {
    return (req, res, next) => {
      if (!this.config.enabled) {
        return next();
      }

      if (!this.isHTTPS(req)) {
        const redirectURL = this.getRedirectURL(req);
        res.writeHead(301, { Location: redirectURL });
        res.end();
        return;
      }

      // Add HSTS header
      if (this.config.hsts) {
        const hsts = [
          `max-age=${this.config.hsts.maxAge}`,
          this.config.hsts.includeSubDomains ? 'includeSubDomains' : null,
          this.config.hsts.preload ? 'preload' : null
        ]
          .filter(Boolean)
          .join('; ');

        res.setHeader('Strict-Transport-Security', hsts);
      }

      next();
    };
  }
}

/**
 * Security headers enforcer
 */
class SecurityHeadersEnforcer extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULT_PRODUCTION_SECURITY_CONFIG.headers, ...config };
    this.responsesChecked = 0;
    this.violationsDetected = 0;
  }

  /**
   * Check if response has required headers
   */
  checkHeaders(res) {
    const requiredHeaders = [
      'Content-Security-Policy',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Referrer-Policy'
    ];

    const missing = [];

    for (const header of requiredHeaders) {
      if (!res.getHeader(header)) {
        missing.push(header);
      }
    }

    this.responsesChecked++;

    if (missing.length > 0) {
      this.violationsDetected++;
      this.emit('violation', {
        missing,
        url: res.req ? res.req.url : 'unknown',
        timestamp: Date.now()
      });
      return false;
    }

    return true;
  }

  /**
   * Remove dangerous headers
   */
  sanitizeHeaders(res) {
    if (this.config.removeServerHeader) {
      res.removeHeader('Server');
    }

    if (this.config.removePoweredBy) {
      res.removeHeader('X-Powered-By');
    }
  }

  /**
   * Create middleware
   */
  createMiddleware() {
    return (req, res, next) => {
      // Intercept res.end to check headers
      const originalEnd = res.end;
      const self = this;

      res.end = function (...args) {
        // Sanitize headers
        self.sanitizeHeaders(res);

        // Check required headers
        if (self.config.enforceOnAllResponses) {
          const hasAllHeaders = self.checkHeaders(res);
          if (!hasAllHeaders) {
            console.warn(
              `[Security] Response missing required headers: ${res.req.url}`
            );
          }
        }

        // Call original end
        return originalEnd.apply(res, args);
      };

      next();
    };
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      responsesChecked: this.responsesChecked,
      violationsDetected: this.violationsDetected,
      violationRate: this.responsesChecked > 0
        ? (this.violationsDetected / this.responsesChecked * 100).toFixed(2) + '%'
        : '0%'
    };
  }
}

/**
 * Session secret validator
 */
class SessionSecretValidator {
  constructor(config = {}) {
    this.config = { ...DEFAULT_PRODUCTION_SECURITY_CONFIG.session, ...config };
  }

  /**
   * Validate session secret
   */
  validate(secret) {
    if (!secret) {
      return {
        valid: false,
        error: 'Session secret is required'
      };
    }

    if (typeof secret !== 'string') {
      return {
        valid: false,
        error: 'Session secret must be a string'
      };
    }

    if (secret.length < this.config.minSecretLength) {
      return {
        valid: false,
        error: `Session secret must be at least ${this.config.minSecretLength} characters`
      };
    }

    // Check for common weak secrets
    const weakSecrets = [
      'secret',
      'session-secret',
      'your-secret-here',
      'change-me',
      '123456',
      'password'
    ];

    if (weakSecrets.includes(secret.toLowerCase())) {
      return {
        valid: false,
        error: 'Session secret is too weak. Use a strong random value.'
      };
    }

    return { valid: true };
  }

  /**
   * Generate strong secret
   */
  generateSecret(length = 64) {
    return crypto.randomBytes(length).toString('hex');
  }
}

/**
 * Webhook signature validator
 */
class WebhookSignatureValidator {
  constructor(config = {}) {
    this.config = { ...DEFAULT_PRODUCTION_SECURITY_CONFIG.webhook, ...config };
  }

  /**
   * Validate Stripe webhook signature
   */
  validateStripeSignature(payload, signature, secret) {
    try {
      const parts = signature.split(',');
      const timestamp = parts.find((p) => p.startsWith('t='))?.substring(2);
      const signatures = parts.filter((p) => p.startsWith('v1='));

      if (!timestamp || signatures.length === 0) {
        return { valid: false, error: 'Invalid signature format' };
      }

      // Check timestamp tolerance
      if (this.config.requireTimestamp) {
        const now = Math.floor(Date.now() / 1000);
        const diff = Math.abs(now - parseInt(timestamp, 10));

        if (diff > this.config.timestampTolerance) {
          return {
            valid: false,
            error: `Timestamp too old: ${diff}s (tolerance: ${this.config.timestampTolerance}s)`
          };
        }
      }

      // Compute expected signature
      const signedPayload = `${timestamp}.${payload}`;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

      // Compare signatures (constant-time)
      for (const sig of signatures) {
        const providedSignature = sig.substring(3);
        if (this.constantTimeCompare(expectedSignature, providedSignature)) {
          return { valid: true };
        }
      }

      return { valid: false, error: 'Signature mismatch' };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Validate generic HMAC signature
   */
  validateHMACSignature(payload, signature, secret, algorithm = 'sha256') {
    try {
      const expectedSignature = crypto
        .createHmac(algorithm, secret)
        .update(payload)
        .digest('hex');

      if (this.constantTimeCompare(expectedSignature, signature)) {
        return { valid: true };
      }

      return { valid: false, error: 'Signature mismatch' };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Constant-time string comparison
   */
  constantTimeCompare(a, b) {
    if (a.length !== b.length) return false;

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}

/**
 * API key exposure preventer
 */
class APIKeyProtector {
  constructor(config = {}) {
    this.config = { ...DEFAULT_PRODUCTION_SECURITY_CONFIG.apiKey, ...config };
  }

  /**
   * Detect API keys in text
   */
  detectKeys(text) {
    if (!text || typeof text !== 'string') return [];

    const detected = [];

    for (const pattern of this.config.dangerousPatterns) {
      const matches = text.match(pattern) || [];
      detected.push(...matches);
    }

    return [...new Set(detected)];
  }

  /**
   * Mask API key
   */
  maskKey(key) {
    if (key.length <= this.config.maskLength) {
      return '*'.repeat(key.length);
    }

    const visible = key.slice(-this.config.maskLength);
    const masked = '*'.repeat(key.length - this.config.maskLength);
    return masked + visible;
  }

  /**
   * Sanitize error message
   */
  sanitizeError(error) {
    if (!error) return error;

    let message = error.message || String(error);
    const stack = error.stack || '';

    // Detect keys in message
    const detectedKeys = this.detectKeys(message);
    for (const key of detectedKeys) {
      const masked = this.maskKey(key);
      message = message.replace(new RegExp(key, 'g'), masked);
    }

    // Detect keys in stack trace
    let sanitizedStack = stack;
    const stackKeys = this.detectKeys(stack);
    for (const key of stackKeys) {
      const masked = this.maskKey(key);
      sanitizedStack = sanitizedStack.replace(new RegExp(key, 'g'), masked);
    }

    return {
      ...error,
      message,
      stack: sanitizedStack,
      keysDetected: detectedKeys.length > 0
    };
  }

  /**
   * Create error handler middleware
   */
  createErrorMiddleware() {
    return (err, req, res, next) => {
      if (!this.config.preventExposure) {
        return next(err);
      }

      // Sanitize error
      const sanitized = this.sanitizeError(err);

      // Replace original error
      err.message = sanitized.message;
      err.stack = sanitized.stack;

      if (sanitized.keysDetected) {
        console.warn('[Security] API keys detected in error message - sanitized');
      }

      next(err);
    };
  }
}

/**
 * Production security manager
 */
class ProductionSecurityManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = this.mergeConfig(DEFAULT_PRODUCTION_SECURITY_CONFIG, config);

    // Initialize components
    this.cors = new CORSPolicyManager(this.config.cors);
    this.https = new HTTPSRedirectManager(this.config.https);
    this.headersEnforcer = new SecurityHeadersEnforcer(this.config.headers);
    this.sessionValidator = new SessionSecretValidator(this.config.session);
    this.webhookValidator = new WebhookSignatureValidator(this.config.webhook);
    this.apiKeyProtector = new APIKeyProtector(this.config.apiKey);

    // Forward events
    this.headersEnforcer.on('violation', (data) => this.emit('header-violation', data));
  }

  /**
   * Merge configurations
   */
  mergeConfig(defaults, custom) {
    const merged = { ...defaults };

    for (const key in custom) {
      if (custom[key] && typeof custom[key] === 'object' && !Array.isArray(custom[key])) {
        merged[key] = this.mergeConfig(defaults[key] || {}, custom[key]);
      } else {
        merged[key] = custom[key];
      }
    }

    return merged;
  }

  /**
   * Validate startup configuration
   */
  validateStartup(options = {}) {
    const errors = [];
    const warnings = [];

    // Check session secret
    if (this.config.session.requireSecret) {
      const sessionSecret = options.sessionSecret || process.env.SESSION_SECRET;
      const validation = this.sessionValidator.validate(sessionSecret);

      if (!validation.valid) {
        errors.push(`Session: ${validation.error}`);
      }
    }

    // Check CORS configuration
    if (this.config.cors.enabled && this.config.cors.origins.length === 0) {
      warnings.push('CORS: No allowed origins configured');
    }

    // Check HTTPS in production
    if (process.env.NODE_ENV === 'production' && !this.config.https.enabled) {
      warnings.push('HTTPS: Not enforced in production');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Create combined middleware
   */
  createMiddleware() {
    const middlewares = [
      // HTTPS redirect
      this.https.createMiddleware(),

      // CORS policy
      (req, res, next) => {
        if (!this.config.cors.enabled) {
          return next();
        }

        const origin = req.headers.origin;
        const headers = this.cors.getHeaders(origin);

        for (const [name, value] of Object.entries(headers)) {
          res.setHeader(name, value);
        }

        // Handle preflight
        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        next();
      },

      // Security headers enforcer
      this.headersEnforcer.createMiddleware(),

      // API key protector error handler
      this.apiKeyProtector.createErrorMiddleware()
    ];

    return middlewares;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      headers: this.headersEnforcer.getStatistics(),
      cors: {
        allowedOrigins: this.cors.allowedOrigins.size
      }
    };
  }
}

/**
 * Create production security middleware
 */
function createProductionSecurityMiddleware(config = {}) {
  const manager = new ProductionSecurityManager(config);

  // Log header violations
  manager.on('header-violation', (violation) => {
    console.warn(
      `[Security] Missing headers on ${violation.url}: ${violation.missing.join(', ')}`
    );
  });

  return {
    manager,
    middlewares: manager.createMiddleware()
  };
}

module.exports = {
  ProductionSecurityManager,
  CORSPolicyManager,
  HTTPSRedirectManager,
  SecurityHeadersEnforcer,
  SessionSecretValidator,
  WebhookSignatureValidator,
  APIKeyProtector,
  createProductionSecurityMiddleware,
  DEFAULT_PRODUCTION_SECURITY_CONFIG
};
