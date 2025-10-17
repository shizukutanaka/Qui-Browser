/**
 * Qui Browser - Authentication Middleware
 *
 * Express-style middleware for authentication and authorization
 */

const AuthenticationManager = require('./manager');

class AuthMiddleware {
  constructor(authManager) {
    this.authManager = authManager;
  }

  /**
   * JWT authentication middleware
   */
  authenticate(required = true) {
    return async (req, res, next) => {
      try {
        const token = this.extractToken(req);

        if (!token) {
          if (required) {
            return this.unauthorized(res, 'No authentication token provided');
          }
          req.user = null;
          return next();
        }

        const authResult = await this.authManager.verifyToken(token);

        req.user = authResult.user;
        req.tokenData = authResult.tokenData;

        next();
      } catch (error) {
        if (required) {
          return this.unauthorized(res, 'Invalid authentication token');
        }
        req.user = null;
        next();
      }
    };
  }

  /**
   * API key authentication middleware
   */
  authenticateApiKey(required = true) {
    return async (req, res, next) => {
      try {
        const apiKey = this.extractApiKey(req);

        if (!apiKey) {
          if (required) {
            return this.unauthorized(res, 'No API key provided');
          }
          req.apiUser = null;
          return next();
        }

        const authResult = await this.authManager.verifyApiKey(apiKey);

        if (!authResult) {
          if (required) {
            return this.unauthorized(res, 'Invalid API key');
          }
          req.apiUser = null;
          return next();
        }

        req.apiUser = authResult.user;
        req.apiPermissions = authResult.permissions;
        req.apiKeyData = authResult.keyData;

        next();
      } catch (error) {
        if (required) {
          return this.unauthorized(res, 'API key authentication failed');
        }
        req.apiUser = null;
        next();
      }
    };
  }

  /**
   * Combined authentication middleware (JWT or API key)
   */
  authenticateAny(required = true) {
    return async (req, res, next) => {
      try {
        // Try JWT first
        const token = this.extractToken(req);
        if (token) {
          try {
            const authResult = await this.authManager.verifyToken(token);
            req.user = authResult.user;
            req.tokenData = authResult.tokenData;
            req.authType = 'jwt';
            return next();
          } catch (error) {
            // JWT failed, try API key
          }
        }

        // Try API key
        const apiKey = this.extractApiKey(req);
        if (apiKey) {
          try {
            const authResult = await this.authManager.verifyApiKey(apiKey);
            if (authResult) {
              req.apiUser = authResult.user;
              req.apiPermissions = authResult.permissions;
              req.apiKeyData = authResult.keyData;
              req.authType = 'api_key';
              req.user = authResult.user; // For compatibility
              return next();
            }
          } catch (error) {
            // API key failed
          }
        }

        // No valid authentication found
        if (required) {
          return this.unauthorized(res, 'Authentication required');
        }

        req.user = null;
        req.authType = null;
        next();
      } catch (error) {
        if (required) {
          return this.unauthorized(res, 'Authentication failed');
        }
        req.user = null;
        req.authType = null;
        next();
      }
    };
  }

  /**
   * Authorization middleware for permissions
   */
  authorize(permission, resource = null) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return this.forbidden(res, 'Authentication required');
        }

        const hasPermission = await this.authManager.checkPermission(
          req.user.id,
          permission,
          resource
        );

        if (!hasPermission) {
          return this.forbidden(res, 'Insufficient permissions');
        }

        next();
      } catch (error) {
        return this.forbidden(res, 'Authorization failed');
      }
    };
  }

  /**
   * Role-based authorization middleware
   */
  requireRole(role) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return this.forbidden(res, 'Authentication required');
        }

        // Check if user has required role or higher
        const roleHierarchy = {
          admin: 3,
          moderator: 2,
          user: 1,
          guest: 0
        };

        const userLevel = roleHierarchy[req.user.role] || 0;
        const requiredLevel = roleHierarchy[role] || 0;

        if (userLevel < requiredLevel) {
          return this.forbidden(res, 'Insufficient role permissions');
        }

        next();
      } catch (error) {
        return this.forbidden(res, 'Role authorization failed');
      }
    };
  }

  /**
   * API key permission middleware
   */
  requireApiPermission(permission) {
    return async (req, res, next) => {
      try {
        if (!req.apiPermissions) {
          return this.forbidden(res, 'API key required');
        }

        if (!req.apiPermissions.includes(permission) &&
            !req.apiPermissions.includes('*')) {
          return this.forbidden(res, 'API key lacks required permission');
        }

        next();
      } catch (error) {
        return this.forbidden(res, 'API permission check failed');
      }
    };
  }

  /**
   * Rate limiting middleware
   */
  rateLimit(options = {}) {
    return async (req, res, next) => {
      try {
        const clientIP = this.getClientIP(req);
        const userId = req.user?.id;
        const apiKey = req.apiKeyData?.id;

        const result = await this.authManager.checkRateLimit(clientIP, userId, apiKey, {
          endpoint: req.url,
          method: req.method
        });

        if (!result.allowed) {
          res.setHeader('X-RateLimit-Limit', result.limit);
          res.setHeader('X-RateLimit-Remaining', result.remaining);
          res.setHeader('X-RateLimit-Reset', result.resetTime);
          res.setHeader('Retry-After', result.retryAfter);

          return res.status(429).json({
            error: 'Too many requests',
            message: 'Rate limit exceeded',
            retryAfter: result.retryAfter,
            limit: result.limit,
            remaining: result.remaining,
            resetTime: result.resetTime
          });
        }

        // Add rate limit headers
        res.setHeader('X-RateLimit-Limit', result.limit);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', result.resetTime);

        next();
      } catch (error) {
        console.error('Rate limiting error:', error);
        next(); // Continue on rate limiting errors
      }
    };
  }

  /**
   * User ownership middleware
   */
  requireOwnership(resourceType, resourceIdParam = 'id') {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return this.forbidden(res, 'Authentication required');
        }

        const resourceId = req.params[resourceIdParam];

        // Check if user owns the resource
        // This would need to be implemented based on your resource types
        const ownsResource = await this.checkResourceOwnership(
          req.user.id,
          resourceType,
          resourceId
        );

        if (!ownsResource) {
          return this.forbidden(res, 'Resource access denied');
        }

        next();
      } catch (error) {
        return this.forbidden(res, 'Ownership check failed');
      }
    };
  }

  /**
   * Session validation middleware
   */
  validateSession() {
    return async (req, res, next) => {
      try {
        const sessionId = req.headers['x-session-id'];

        if (sessionId) {
          // Validate session exists and is not expired
          const session = this.authManager.sessions.get(sessionId);

          if (!session) {
            return this.unauthorized(res, 'Invalid session');
          }

          if (session.expiresAt < new Date()) {
            this.authManager.sessions.delete(sessionId);
            return this.unauthorized(res, 'Session expired');
          }

          // Update last activity
          session.lastActivity = new Date();

          req.session = session;
        }

        next();
      } catch (error) {
        return this.unauthorized(res, 'Session validation failed');
      }
    };
  }

  /**
   * MFA requirement middleware
   */
  requireMFA() {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return this.forbidden(res, 'Authentication required');
        }

        // Check if user has MFA enabled and verified
        const hasMFA = req.user.mfaEnabled && req.user.mfaVerified;

        if (!hasMFA) {
          return res.status(403).json({
            error: 'MFA required',
            message: 'Multi-factor authentication is required for this action',
            mfaRequired: true
          });
        }

        // Check MFA token if provided
        const mfaToken = req.headers['x-mfa-token'];
        if (mfaToken) {
          const isValidMFA = await this.authManager.verifyMFAToken(req.user.id, mfaToken);
          if (!isValidMFA) {
            return this.unauthorized(res, 'Invalid MFA token');
          }
        } else {
          return res.status(403).json({
            error: 'MFA token required',
            message: 'MFA token must be provided in X-MFA-Token header',
            mfaTokenRequired: true
          });
        }

        next();
      } catch (error) {
        return this.forbidden(res, 'MFA validation failed');
      }
    };
  }

  /**
   * Audit logging middleware
   */
  auditLog(action, includeBody = false) {
    return async (req, res, next) => {
      const startTime = Date.now();

      // Store original send method
      const originalSend = res.send;
      let responseBody = null;

      res.send = function(body) {
        responseBody = body;
        return originalSend.call(this, body);
      };

      res.on('finish', async () => {
        try {
          const auditEntry = {
            timestamp: new Date(),
            userId: req.user?.id || req.apiUser?.id,
            action: action,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: Date.now() - startTime,
            ip: this.getClientIP(req),
            userAgent: req.headers['user-agent'],
            requestSize: req.headers['content-length'] || 0,
            responseSize: responseBody ? Buffer.byteLength(responseBody.toString()) : 0
          };

          if (includeBody && req.body) {
            auditEntry.requestBody = this.sanitizeRequestBody(req.body);
          }

          // Log to database or external service
          await this.logAuditEntry(auditEntry);
        } catch (error) {
          console.error('Audit logging failed:', error);
        }
      });

      next();
    };
  }

  // Helper methods

  extractToken(req) {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check query parameter
    if (req.query.token) {
      return req.query.token;
    }

    // Check cookie
    if (req.cookies && req.cookies.token) {
      return req.cookies.token;
    }

    return null;
  }

  extractApiKey(req) {
    // Check X-API-Key header
    if (req.headers['x-api-key']) {
      return req.headers['x-api-key'];
    }

    // Check Authorization header (API Key format)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('ApiKey ')) {
      return authHeader.substring(7);
    }

    // Check query parameter
    if (req.query.api_key) {
      return req.query.api_key;
    }

    return null;
  }

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

  async checkResourceOwnership(userId, resourceType, resourceId) {
    // Placeholder - implement based on your resource types
    // This would check database ownership records
    return true; // Placeholder
  }

  sanitizeRequestBody(body) {
    // Remove sensitive fields from request body for audit logging
    const sanitized = { ...body };

    // Remove passwords, tokens, etc.
    const sensitiveFields = ['password', 'passwordHash', 'token', 'apiKey', 'secret'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  async logAuditEntry(entry) {
    // Placeholder - implement audit logging to database or external service
    console.log('AUDIT:', entry);
  }

  unauthorized(res, message = 'Unauthorized') {
    res.status(401).json({
      error: 'Unauthorized',
      message: message
    });
  }

  forbidden(res, message = 'Forbidden') {
    res.status(403).json({
      error: 'Forbidden',
      message: message
    });
  }
}

module.exports = AuthMiddleware;
