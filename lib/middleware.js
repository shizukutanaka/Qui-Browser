/**
 * Qui Browser - Middleware Module
 *
 * Request/response middleware utilities
 */

/**
 * Send JSON response
 */
function sendJsonResponse(req, res, statusCode, payload, extraHeaders = {}) {
  const bodyString = payload === undefined ? '' : typeof payload === 'string' ? payload : JSON.stringify(payload);

  const headers = { ...extraHeaders };

  if (!('Content-Type' in headers)) {
    headers['Content-Type'] = 'application/json; charset=utf-8';
  }
  if (!('Cache-Control' in headers)) {
    headers['Cache-Control'] = 'no-store';
  }
  if (!('Content-Length' in headers)) {
    headers['Content-Length'] = Buffer.byteLength(bodyString);
  }

  // Add security headers
  const securityHeaders = getSecurityHeaders(req);
  Object.assign(headers, securityHeaders);

  res.writeHead(statusCode, headers);
  if (req?.method === 'HEAD' || statusCode === 204) {
    res.end();
  } else {
    res.end(bodyString);
  }
}

/**
 * Send JSON error response
 */
function sendJsonError(req, res, statusCode, message, extraPayload = {}, extraHeaders = {}) {
  const payload = { error: message, ...extraPayload };
  const requestId = res.getHeader('X-Request-ID');
  if (requestId && !('requestId' in payload)) {
    payload.requestId = requestId;
  }
  sendJsonResponse(req, res, statusCode, payload, extraHeaders);
}

/**
 * Get security headers for response
 */
function getSecurityHeaders(req) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  };

  // Add CORS headers if needed
  if (req?.headers?.origin) {
    // This would be handled by the security module
    // For now, just set basic CORS
    headers['Access-Control-Allow-Origin'] = req.headers.origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Create security context from request
 */
function createSecurityContext(req) {
  return {
    requestOrigin: typeof req?.headers?.origin === 'string' ? req.headers.origin : undefined,
    requestHost: typeof req?.headers?.host === 'string' ? req.headers.host : undefined,
    requestMethod: req?.method,
    isTls: Boolean(req?.socket?.encrypted)
  };
}

/**
 * Error handling utility
 */
function toError(value, fallback = 'Unknown error') {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value || fallback);
  }
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(fallback);
  }
}

/**
 * Get error status code
 */
function getErrorStatusCode(error) {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  if (!('statusCode' in error)) {
    return undefined;
  }
  const candidate = error.statusCode;
  return typeof candidate === 'number' ? candidate : undefined;
}

/**
 * Sanitize string for logging
 */
function sanitizeString(value, maxLength = 200) {
  if (typeof value !== 'string') {
    return undefined;
  }
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}…`;
}

/**
 * Sanitize headers for logging
 */
function sanitizeHeadersForLog(headers) {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }

  const sanitized = {};
  const allowedHeaders = ['host', 'user-agent', 'accept', 'content-type', 'content-length', 'origin', 'referer'];

  for (const key of allowedHeaders) {
    const raw = headers[key];
    if (typeof raw === 'string' && raw.trim()) {
      sanitized[key] = sanitizeString(raw.trim(), 300);
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

/**
 * Sanitize query parameters for logging
 */
function sanitizeQueryForLog(query) {
  if (!query || typeof query !== 'object') {
    return undefined;
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(query)) {
    if (typeof key !== 'string' || !key.trim()) {
      continue;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        sanitized[key] = sanitizeString(trimmed, 200);
      }
      continue;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = String(value);
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

/**
 * Rate limiting check utility
 */
class RateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 100;
    this.windowMs = options.windowMs || 60000;
    this.requests = new Map();
  }

  check(clientId) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Clean old entries
    for (const [id, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter(ts => ts > windowStart);
      if (validTimestamps.length === 0) {
        this.requests.delete(id);
      } else {
        this.requests.set(id, validTimestamps);
      }
    }

    // Get current requests for client
    const clientRequests = this.requests.get(clientId) || [];

    // Check if under limit
    if (clientRequests.length >= this.maxRequests) {
      return false;
    }

    // Add new request
    clientRequests.push(now);
    this.requests.set(clientId, clientRequests);

    return true;
  }

  reset(clientId) {
    this.requests.delete(clientId);
  }
}

/**
 * Request logging middleware
 */
function createLoggingMiddleware(options = {}) {
  const maxRequests = options.maxRequests || 1000;
  const requestCounts = new Map();
  const lastReset = Date.now();

  return (req, res, next) => {
    const now = Date.now();

    // Reset counters periodically
    if (now - lastReset > 60000) { // 1 minute
      requestCounts.clear();
      lastReset = now;
    }

    const clientIP = req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
    const count = (requestCounts.get(clientIP) || 0) + 1;
    requestCounts.set(clientIP, count);

    if (count > maxRequests) {
      res.writeHead(429, { 'Content-Type': 'text/plain' });
      res.end('Too many requests');
      return;
    }

    // Log request
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: sanitizeString(req.url, 500),
      ip: clientIP,
      userAgent: sanitizeString(req.headers['user-agent'], 200),
      requestId: res.getHeader('X-Request-ID')
    };

    console.log(JSON.stringify(logEntry));

    if (next) next();
  };
}

/**
 * Compression middleware
 */
function createCompressionMiddleware(options = {}) {
  const { compressResponse, shouldCompress } = require('../utils/compression');

  return async (req, res, next) => {
    const originalWriteHead = res.writeHead;
    const originalEnd = res.end;

    let buffer = null;

    res.writeHead = function(statusCode, headers) {
      // Intercept response
      return originalWriteHead.apply(this, arguments);
    };

    res.end = function(data) {
      if (data && shouldCompress(res.getHeader('Content-Type'))) {
        // Compress response
        const compressed = compressResponse(data, res.getHeader('Content-Type'), 'gzip');
        if (compressed) {
          res.setHeader('Content-Encoding', 'gzip');
          res.setHeader('Content-Length', compressed.data.length);
          data = compressed.data;
        }
      }

      return originalEnd.call(this, data);
    };

    if (next) await next();
  };
}

module.exports = {
  sendJsonResponse,
  sendJsonError,
  getSecurityHeaders,
  createSecurityContext,
  toError,
  getErrorStatusCode,
  sanitizeString,
  sanitizeHeadersForLog,
  sanitizeQueryForLog,
  RateLimiter,
  createLoggingMiddleware,
  createCompressionMiddleware
};
