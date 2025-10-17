/**
 * Qui Browser - Security Module
 *
 * Comprehensive security management including headers, rate limiting, and validation
 */

const crypto = require('crypto');
const AutoCleanupMap = require('../utils/auto-cleanup-map');
const AdvancedRateLimiter = require('./advanced-rate-limiter');

class SecurityManager {
  constructor(config) {
    this.config = config;
    this.rateLimitMap = null;
    this.endpointRateLimiter = null;
    this.allowedOriginEntries = [];
    this.allowedHostEntries = [];
    this.allowAnyOrigin = false;
    this.allowAnyHostHeader = false;
  }

  /**
   * Initialize security components
   */
  initialize() {
    // Initialize rate limiting
    if (this.config.rateLimiting.enabled) {
      this.initializeRateLimiting();
    }

    // Parse allowed origins and hosts
    this.parseAllowedOrigins();
    this.parseAllowedHosts();

    // Initialize security headers
    this.initializeSecurityHeaders();
  }

  /**
   * Initialize rate limiting
   */
  initializeRateLimiting() {
    // Initialize advanced rate limiter
    this.advancedRateLimiter = new AdvancedRateLimiter({
      endpointLimits: this.config.endpointLimits || {},
      tiers: this.config.rateLimitTiers || {}
    });

    // Keep legacy rate limiter for backward compatibility
    this.rateLimitMap = new AutoCleanupMap({
      maxSize: this.config.rateLimiting?.maxEntries || 10000,
      maxAge: this.config.rateLimiting?.windowMs || 900000, // 15 minutes
      cleanupInterval: 300000 // 5 minutes
    });

    // Initialize endpoint rate limiter if available
    try {
      const EndpointRateLimiter = require('./endpoint-rate-limiter');
      this.endpointRateLimiter = new EndpointRateLimiter({
        defaultWindow: this.config.rateLimiting.windowMs,
        defaultMaxRequests: this.config.rateLimiting.maxRequests,
        maxEntries: this.config.rateLimiting.maxEntries
      });
    } catch (error) {
      console.warn('Endpoint rate limiter not available:', error.message);
    }
  }

  /**
   * Parse allowed origins from configuration
   */
  parseAllowedOrigins() {
    const entries = [];
    let allowAny = false;

    // Always allow self-origin
    entries.push({ type: 'self' });

    const tokens = this.config.security.allowedOrigins;

    if (tokens.length === 0) {
      // Add defaults for development
      const defaultPort = this.config.port || 8000;
      const defaults = [
        { type: 'domain', hostname: 'localhost' },
        { type: 'domain', hostname: '127.0.0.1' },
        { type: 'exact', origin: `http://localhost:${defaultPort}` },
        { type: 'exact', origin: `http://127.0.0.1:${defaultPort}` }
      ];
      entries.push(...defaults);
    } else {
      for (const token of tokens) {
        if (token === '*') {
          allowAny = true;
          continue;
        }

        if (token.startsWith('.')) {
          entries.push({ type: 'domain', hostname: token.slice(1).toLowerCase() });
          continue;
        }

        if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(token)) {
          try {
            const parsed = new URL(token);
            entries.push({ type: 'exact', origin: `${parsed.protocol}//${parsed.host}` });
            continue;
          } catch {
            // Invalid URL, skip
          }
        }

        entries.push({ type: 'domain', hostname: token.toLowerCase() });
      }
    }

    this.allowedOriginEntries = entries;
    this.allowAnyOrigin = allowAny;
  }

  /**
   * Parse allowed hosts from configuration
   */
  parseAllowedHosts() {
    const entries = [];
    let allowAny = false;
    const fallbackPort = this.config.port || 8000;

    const tokens = this.config.security.allowedHosts;

    if (tokens.length === 0) {
      // Add defaults
      const defaults = [
        { type: 'domain', hostname: 'localhost' },
        { type: 'domain', hostname: '127.0.0.1' },
        { type: 'exact', host: `localhost:${fallbackPort}` },
        { type: 'exact', host: `127.0.0.1:${fallbackPort}` }
      ];
      entries.push(...defaults);
    } else {
      for (const token of tokens) {
        if (token === '*') {
          allowAny = true;
          continue;
        }

        if (token.includes(':')) {
          entries.push({ type: 'exact', host: token.toLowerCase() });
        } else {
          entries.push({ type: 'domain', hostname: token.toLowerCase() });
        }
      }
    }

    this.allowedHostEntries = entries;
    this.allowAnyHostHeader = allowAny;
  }

  /**
   * Initialize security headers
   */
  initializeSecurityHeaders() {
    if (!this.config.security.enabled) {
      console.warn('[security] Security headers are disabled');
      return;
    }

    // Base security headers
    this.baseSecurityHeaders = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
      'X-Permitted-Cross-Domain-Policies': 'none'
    };

    // Add CSP if enabled
    if (this.config.security.cspEnabled) {
      // Initialize CSP logic here
    }

    // Add HSTS for production
    if (this.config.security.hstsEnabled && this.config.environment === 'production') {
      this.baseSecurityHeaders['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
    }

    // VR/WebXR specific headers
    this.baseSecurityHeaders['Permissions-Policy'] =
      'geolocation=(), microphone=(), camera=(), payment=(), usb=(), serial=(), xr-spatial-tracking=*, webxr=*';
    this.baseSecurityHeaders['Cross-Origin-Embedder-Policy'] = 'credentialless';
    this.baseSecurityHeaders['Cross-Origin-Opener-Policy'] = 'same-origin-allow-popups';
    this.baseSecurityHeaders['Cross-Origin-Resource-Policy'] = 'cross-origin';
  }

  /**
   * Handle security for incoming request
   */
  async handleRequest(req, res) {
    // Validate host header
    if (!this.validateHostHeader(req.headers.host)) {
      throw new Error('Invalid Host header');
    }

    // Check rate limiting
    if (this.config.rateLimiting.enabled) {
      const clientIP = this.getClientIP(req);
      if (!this.checkRateLimit(clientIP)) {
        throw Object.assign(new Error('Too Many Requests'), { statusCode: 429 });
      }
    }

    // Add security headers
    this.addSecurityHeaders(req, res);
  }

  /**
   * Validate host header
   */
  validateHostHeader(hostHeader) {
    if (this.allowAnyHostHeader) {
      return true;
    }

    if (typeof hostHeader !== 'string' || !hostHeader.trim()) {
      return false;
    }

    const normalized = hostHeader.trim().toLowerCase();
    const valueForMatch = normalized.includes(':')
      ? normalized
      : `${normalized}:${this.config.port}`;

    for (const entry of this.allowedHostEntries) {
      if (entry.type === 'exact' && valueForMatch === entry.host) {
        return true;
      }

      if (entry.type === 'domain') {
        const hostname = normalized.split(':')[0];
        if (hostname === entry.hostname || hostname.endsWith(`.${entry.hostname}`)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check rate limit for a client
   */
  async checkRateLimit(clientIP, userId = null, apiKey = null, options = {}) {
    if (!this.config.rateLimiting?.enabled) {
      return { allowed: true };
    }

    // Use advanced rate limiter if available
    if (this.advancedRateLimiter) {
      // Determine identifier (prefer userId, then apiKey, then IP)
      const identifier = userId || apiKey || clientIP;

      // Determine tier (this would come from user data in production)
      const tier = this.determineUserTier(userId, apiKey);

      try {
        const result = await this.advancedRateLimiter.checkLimit(identifier, {
          tier,
          endpoint: options.endpoint,
          method: options.method
        });

        if (!result.allowed) {
          return {
            allowed: false,
            retryAfter: result.retryAfter,
            limit: result.limit,
            remaining: result.remaining,
            resetTime: result.resetTime,
            tier: result.tier,
            limitType: result.limitType
          };
        }

        return {
          allowed: true,
          remaining: result.remaining,
          resetTime: result.resetTime,
          limit: result.limit,
          tier: result.tier
        };

      } catch (error) {
        console.warn('Advanced rate limiter error, falling back to legacy:', error);
      }
    }

    // Fallback to legacy rate limiting
    return this.checkLegacyRateLimit(clientIP, options);
  }

  /**
   * Check rate limiting for client IP (legacy)
   */
  checkLegacyRateLimit(clientIP, options) {
    if (!this.rateLimitMap) return true;

    const now = Date.now();
    let bucket = this.rateLimitMap.get(clientIP);

    if (!bucket) {
      bucket = {
        tokens: this.config.rateLimiting.maxRequests,
        lastRefill: now,
        lastAccess: now
      };
      this.rateLimitMap.set(clientIP, bucket);
    }

    const elapsed = now - bucket.lastRefill;
    if (elapsed > 0) {
      const tokensToAdd = Math.floor(elapsed / this.rateLimitTokenInterval);
      if (tokensToAdd > 0) {
        bucket.tokens = Math.min(
          this.config.rateLimiting.maxRequests,
          bucket.tokens + tokensToAdd
        );
        bucket.lastRefill += tokensToAdd * this.rateLimitTokenInterval;
      }
    }

    bucket.lastAccess = now;

    if (bucket.tokens <= 0) {
      return {
        allowed: false,
        retryAfter: this.rateLimitTokenInterval
      };
    }

    bucket.tokens--;
    return {
      allowed: true,
      remaining: bucket.tokens,
      resetTime: bucket.lastRefill + this.rateLimitTokenInterval
    };
  }

  /**
   * Add security headers to response
   */
  addSecurityHeaders(req, res) {
    if (!this.config.security.enabled) return;

    const headers = { ...this.baseSecurityHeaders };

    // Add CORS headers
    const allowedOrigin = this.resolveAllowedOrigin(
      req.headers.origin,
      req.headers.host,
      Boolean(req.socket?.encrypted)
    );

    if (allowedOrigin) {
      headers['Access-Control-Allow-Origin'] = allowedOrigin;
      if (allowedOrigin !== '*') {
        headers['Access-Control-Allow-Credentials'] = 'true';
      }
    }

    // Apply headers to response
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }
  }

  /**
   * Resolve allowed origin for CORS
   */
  resolveAllowedOrigin(requestOrigin, requestHost, isTls) {
    if (this.allowAnyOrigin) {
      return '*';
    }

    const candidates = [];
    if (typeof requestOrigin === 'string' && requestOrigin && requestOrigin !== 'null') {
      candidates.push(requestOrigin);
    }

    if (typeof requestHost === 'string' && requestHost.trim()) {
      const scheme = isTls ? 'https' : 'http';
      candidates.push(`${scheme}://${requestHost.trim()}`);
    }

    for (const candidate of candidates) {
      let parsed;
      try {
        parsed = new URL(candidate);
      } catch {
        continue;
      }

      const normalizedOrigin = `${parsed.protocol}//${parsed.host}`;

      for (const entry of this.allowedOriginEntries) {
        if (entry.type === 'wildcard') {
          return '*';
        }

        if (entry.type === 'self' && typeof requestHost === 'string') {
          if (normalizedOrigin.endsWith(`://${requestHost.trim()}`)) {
            return normalizedOrigin;
          }
        }

        if (entry.type === 'exact' && normalizedOrigin === entry.origin) {
          return entry.origin;
        }

        if (entry.type === 'domain') {
          const hostname = parsed.hostname.toLowerCase();
          if (hostname === entry.hostname || hostname.endsWith(`.${entry.hostname}`)) {
            return normalizedOrigin;
          }
        }
      }
    }

    return null;
  }

  /**
   * Determine user tier for rate limiting
   */
  determineUserTier(userId, apiKey) {
    // In a real implementation, this would check user subscription/tier
    // For now, return default tier
    if (apiKey) {
      // Check API key tier
      return 'pro'; // Assume API keys are for paid users
    }

    if (userId) {
      // Check user tier from database/cache
      return 'free'; // Default for regular users
    }

    return 'free'; // Default for anonymous users
  }

  /**
   * Get rate limiting statistics
   */
  getRateLimitStats() {
    if (this.advancedRateLimiter) {
      return this.advancedRateLimiter.getGlobalStats();
    }

    // Legacy stats
    return {
      totalClients: this.rateLimitMap ? this.rateLimitMap.size : 0,
      legacyMode: true
    };
  }

  /**
   * Set custom rate limits for user/API key
   */
  setCustomRateLimit(identifier, limits) {
    if (this.advancedRateLimiter) {
      this.advancedRateLimiter.setCustomLimits(identifier, limits);
    }
  }

  /**
   * Set quota for user/API key
   */
  setQuota(identifier, quota) {
    if (this.advancedRateLimiter) {
      this.advancedRateLimiter.setQuota(identifier, quota);
    }
  }

  /**
   * Get quota usage for user/API key
   */
  getQuotaUsage(identifier) {
    if (this.advancedRateLimiter) {
      return this.advancedRateLimiter.checkQuota(identifier);
    }
    return null;
  }

  /**
   * Reset rate limits for identifier
   */
  resetRateLimits(identifier) {
    if (this.advancedRateLimiter) {
      this.advancedRateLimiter.resetLimits(identifier);
    }

    // Also reset legacy limits
    if (this.rateLimitMap) {
      this.rateLimitMap.delete(identifier);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.rateLimitMap) {
      this.rateLimitMap.clear();
    }

    if (this.advancedRateLimiter) {
      this.advancedRateLimiter.destroy();
    }
  }

  /**
   * Get client IP from request
   */
  getClientIP(req) {
    // Try X-Forwarded-For header first (for proxies/load balancers)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      // Take the first IP if there are multiple
      return forwarded.split(',')[0].trim();
    }

    // Try X-Real-IP header
    if (req.headers['x-real-ip']) {
      return req.headers['x-real-ip'];
    }

    // Fall back to connection remote address
    return req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
  }

  // Getter for rate limit token interval
  get rateLimitTokenInterval() {
    return Math.max(1, Math.floor(this.config.rateLimiting.windowMs / this.config.rateLimiting.maxRequests));
  }
}

module.exports = {
  SecurityManager
};
