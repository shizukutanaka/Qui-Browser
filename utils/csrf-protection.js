/**
 * CSRF Protection
 *
 * Implements CSRF token generation and validation (Improvement #16)
 * Uses Double Submit Cookie pattern with additional security measures
 */

const crypto = require('crypto');

/**
 * CSRF configuration
 */
const DEFAULT_CSRF_CONFIG = {
  tokenLength: 32, // bytes
  cookieName: 'qui_csrf',
  headerName: 'X-CSRF-Token',
  formFieldName: '_csrf',
  cookieOptions: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 3600000 // 1 hour
  },
  safeMethods: ['GET', 'HEAD', 'OPTIONS'],
  excludePaths: ['/health', '/metrics', '/api/webhook'],
  validateOrigin: true,
  validateReferer: true
};

/**
 * Generate CSRF token
 *
 * @param {number} length - Token length in bytes
 * @returns {string} CSRF token
 */
function generateCsrfToken(length = 32) {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Hash CSRF token for comparison
 *
 * @param {string} token - CSRF token
 * @param {string} secret - Secret key
 * @returns {string} Hashed token
 */
function hashCsrfToken(token, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(token)
    .digest('base64url');
}

/**
 * Constant-time string comparison (timing attack prevention)
 *
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} Equality result
 */
function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Validate origin header
 *
 * @param {Object} req - HTTP request object
 * @param {Array<string>} allowedOrigins - Allowed origins
 * @returns {boolean} Validation result
 */
function validateOrigin(req, allowedOrigins = []) {
  const origin = req.headers.origin;
  if (!origin) {
    return true; // No origin header (same-origin request)
  }

  // Check allowed origins
  if (allowedOrigins.includes('*')) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Check if origin matches host
  const host = req.headers.host;
  if (host) {
    const protocol = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const expectedOrigin = `${protocol}://${host}`;
    if (origin === expectedOrigin) {
      return true;
    }
  }

  return false;
}

/**
 * Validate referer header
 *
 * @param {Object} req - HTTP request object
 * @returns {boolean} Validation result
 */
function validateReferer(req) {
  const referer = req.headers.referer || req.headers.referrer;
  if (!referer) {
    return false; // Referer should be present for state-changing requests
  }

  const host = req.headers.host;
  if (!host) {
    return false;
  }

  try {
    const refererUrl = new URL(referer);
    return refererUrl.host === host;
  } catch (e) {
    return false;
  }
}

/**
 * CSRF Protection Manager
 */
class CsrfProtectionManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CSRF_CONFIG, ...config };
    this.secret = config.secret || crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate CSRF token pair (token + signed token)
   *
   * @returns {Object} Token pair
   */
  generateTokenPair() {
    const token = generateCsrfToken(this.config.tokenLength);
    const signedToken = hashCsrfToken(token, this.secret);

    return {
      token,
      signedToken
    };
  }

  /**
   * Verify CSRF token
   *
   * @param {string} token - Token from request
   * @param {string} signedToken - Signed token from cookie
   * @returns {boolean} Validation result
   */
  verifyToken(token, signedToken) {
    if (!token || !signedToken) {
      return false;
    }

    const expectedSignedToken = hashCsrfToken(token, this.secret);
    return constantTimeCompare(signedToken, expectedSignedToken);
  }

  /**
   * Check if request should be protected
   *
   * @param {Object} req - HTTP request object
   * @returns {boolean} Protection required
   */
  shouldProtect(req) {
    // Skip safe methods
    if (this.config.safeMethods.includes(req.method)) {
      return false;
    }

    // Skip excluded paths
    const pathname = req.url ? new URL(req.url, `http://${req.headers.host}`).pathname : req.path;
    for (const excludePath of this.config.excludePaths) {
      if (pathname.startsWith(excludePath)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Extract CSRF token from request
   *
   * @param {Object} req - HTTP request object
   * @returns {string|null} CSRF token
   */
  extractToken(req) {
    // Check header first
    let token = req.headers[this.config.headerName.toLowerCase()];

    // Check body (for form submissions)
    if (!token && req.body && typeof req.body === 'object') {
      token = req.body[this.config.formFieldName];
    }

    // Check query (not recommended, but supported)
    if (!token && req.query && typeof req.query === 'object') {
      token = req.query[this.config.formFieldName];
    }

    return token || null;
  }

  /**
   * Extract signed token from cookie
   *
   * @param {Object} req - HTTP request object
   * @returns {string|null} Signed token
   */
  extractSignedToken(req) {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      return null;
    }

    const cookies = {};
    const pairs = cookieHeader.split(';');
    for (const pair of pairs) {
      const [key, value] = pair.trim().split('=');
      if (key && value) {
        cookies[key] = decodeURIComponent(value);
      }
    }

    return cookies[this.config.cookieName] || null;
  }

  /**
   * Set CSRF cookie
   *
   * @param {Object} res - HTTP response object
   * @param {string} signedToken - Signed CSRF token
   */
  setCsrfCookie(res, signedToken) {
    const cookieOptions = [];

    cookieOptions.push(`${this.config.cookieName}=${signedToken}`);
    cookieOptions.push(`Max-Age=${Math.floor(this.config.cookieOptions.maxAge / 1000)}`);
    cookieOptions.push('Path=/');

    if (this.config.cookieOptions.httpOnly) {
      cookieOptions.push('HttpOnly');
    }

    if (this.config.cookieOptions.secure) {
      cookieOptions.push('Secure');
    }

    if (this.config.cookieOptions.sameSite) {
      cookieOptions.push(`SameSite=${this.config.cookieOptions.sameSite}`);
    }

    const existingCookies = res.getHeader('Set-Cookie') || [];
    const cookiesArray = Array.isArray(existingCookies) ? existingCookies : [existingCookies];
    cookiesArray.push(cookieOptions.join('; '));

    res.setHeader('Set-Cookie', cookiesArray);
  }

  /**
   * Validate CSRF protection
   *
   * @param {Object} req - HTTP request object
   * @returns {Object} Validation result
   */
  validateRequest(req) {
    // Check if protection is needed
    if (!this.shouldProtect(req)) {
      return { valid: true, reason: 'safe_method_or_excluded' };
    }

    // Validate origin if configured
    if (this.config.validateOrigin) {
      const allowedOrigins = this.config.allowedOrigins || [];
      if (!validateOrigin(req, allowedOrigins)) {
        return { valid: false, reason: 'invalid_origin' };
      }
    }

    // Validate referer if configured
    if (this.config.validateReferer) {
      if (!validateReferer(req)) {
        return { valid: false, reason: 'invalid_referer' };
      }
    }

    // Extract tokens
    const token = this.extractToken(req);
    const signedToken = this.extractSignedToken(req);

    if (!token) {
      return { valid: false, reason: 'missing_token' };
    }

    if (!signedToken) {
      return { valid: false, reason: 'missing_cookie' };
    }

    // Verify token
    if (!this.verifyToken(token, signedToken)) {
      return { valid: false, reason: 'invalid_token' };
    }

    return { valid: true };
  }
}

/**
 * CSRF middleware factory
 *
 * @param {Object} config - CSRF configuration
 * @returns {Function} Middleware function
 */
function createCsrfMiddleware(config = {}) {
  const manager = new CsrfProtectionManager(config);

  return function csrfMiddleware(req, res, next) {
    // Generate token pair if not exists
    let signedToken = manager.extractSignedToken(req);

    if (!signedToken) {
      const tokenPair = manager.generateTokenPair();
      signedToken = tokenPair.signedToken;
      manager.setCsrfCookie(res, signedToken);

      // Expose token to request for rendering in forms
      req.csrfToken = tokenPair.token;
    } else {
      // Generate new token for existing signed token
      const token = generateCsrfToken(manager.config.tokenLength);
      req.csrfToken = token;
    }

    // Helper function to get CSRF token
    req.getCsrfToken = () => req.csrfToken;

    // Validate request if needed
    if (manager.shouldProtect(req)) {
      const validation = manager.validateRequest(req);

      if (!validation.valid) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'CSRF validation failed',
            reason: validation.reason,
            message: getCsrfErrorMessage(validation.reason)
          })
        );
        return;
      }
    }

    next();
  };
}

/**
 * Get user-friendly CSRF error message
 *
 * @param {string} reason - Error reason
 * @returns {string} Error message
 */
function getCsrfErrorMessage(reason) {
  const messages = {
    invalid_origin: 'Request origin is not allowed',
    invalid_referer: 'Invalid referer header',
    missing_token: 'CSRF token is missing from request',
    missing_cookie: 'CSRF cookie is missing',
    invalid_token: 'CSRF token is invalid or expired'
  };

  return messages[reason] || 'CSRF validation failed';
}

/**
 * Generate CSRF token HTML input
 *
 * @param {string} token - CSRF token
 * @param {string} fieldName - Field name
 * @returns {string} HTML input
 */
function generateCsrfInput(token, fieldName = '_csrf') {
  return `<input type="hidden" name="${fieldName}" value="${token}">`;
}

/**
 * Generate CSRF meta tag
 *
 * @param {string} token - CSRF token
 * @returns {string} HTML meta tag
 */
function generateCsrfMeta(token) {
  return `<meta name="csrf-token" content="${token}">`;
}

module.exports = {
  CsrfProtectionManager,
  generateCsrfToken,
  hashCsrfToken,
  constantTimeCompare,
  validateOrigin,
  validateReferer,
  createCsrfMiddleware,
  generateCsrfInput,
  generateCsrfMeta,
  getCsrfErrorMessage,
  DEFAULT_CSRF_CONFIG
};
