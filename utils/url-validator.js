/**
 * URL Validator and Sanitizer
 *
 * Provides comprehensive URL validation and sanitization
 * to prevent XSS, SSRF, and other injection attacks.
 */

const { URL } = require('url');

/**
 * Dangerous URL schemes that should always be blocked
 */
const DANGEROUS_SCHEMES = [
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'about:',
  'blob:',
  'jar:',
  'ftp:',
  'tel:',
  'sms:',
  'mailto:',
  'ws:',
  'wss:'
];

/**
 * Allowed URL schemes for web browsing
 */
const ALLOWED_SCHEMES = ['http:', 'https:'];

/**
 * Private/Internal IP ranges (SSRF prevention)
 */
const PRIVATE_IP_RANGES = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^224\./,
  /^240\./,
  /^255\.255\.255\.255$/,
  /^::1$/,
  /^fe80:/i,
  /^fc00:/i,
  /^fd00:/i,
  /^ff00:/i
];

/**
 * Maximum allowed URL length
 */
const MAX_URL_LENGTH = 2048;

/**
 * Validation result class
 */
class URLValidationResult {
  constructor(valid = false, url = null, error = null) {
    this.valid = valid;
    this.url = url;
    this.error = error;
    this.sanitized = null;
  }
}

/**
 * Validates a URL string
 *
 * @param {string} urlString - The URL to validate
 * @param {Object} options - Validation options
 * @returns {URLValidationResult}
 */
function validateURL(urlString, options = {}) {
  const {
    allowedSchemes = ALLOWED_SCHEMES,
    blockPrivateIPs = false,
    maxLength = MAX_URL_LENGTH,
    requireTLS = false
  } = options;

  // Basic checks
  if (typeof urlString !== 'string') {
    return new URLValidationResult(false, null, 'URL must be a string');
  }

  if (!urlString || urlString.trim().length === 0) {
    return new URLValidationResult(false, null, 'URL cannot be empty');
  }

  const trimmed = urlString.trim();

  // Length check
  if (trimmed.length > maxLength) {
    return new URLValidationResult(false, null, `URL exceeds maximum length of ${maxLength} characters`);
  }

  // Check for dangerous schemes first (case-insensitive)
  const lowerURL = trimmed.toLowerCase();
  for (const scheme of DANGEROUS_SCHEMES) {
    if (lowerURL.startsWith(scheme)) {
      return new URLValidationResult(false, null, `Dangerous URL scheme detected: ${scheme}`);
    }
  }

  // Check for NULL bytes and control characters
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return new URLValidationResult(false, null, 'URL contains invalid control characters');
  }

  // Check for CRLF injection
  if (/[\r\n]/.test(trimmed)) {
    return new URLValidationResult(false, null, 'URL contains CRLF characters');
  }

  // Parse URL
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (error) {
    return new URLValidationResult(false, null, `Invalid URL format: ${error.message}`);
  }

  // Validate scheme
  if (!allowedSchemes.includes(parsed.protocol)) {
    return new URLValidationResult(false, null, `URL scheme '${parsed.protocol}' is not allowed`);
  }

  // TLS requirement
  if (requireTLS && parsed.protocol !== 'https:') {
    return new URLValidationResult(false, null, 'HTTPS is required');
  }

  // Hostname validation
  if (!parsed.hostname) {
    return new URLValidationResult(false, null, 'URL must have a hostname');
  }

  // Block private IPs if requested (SSRF prevention)
  if (blockPrivateIPs) {
    const hostname = parsed.hostname.toLowerCase();

    // Check for localhost variants
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return new URLValidationResult(false, null, 'Access to localhost is not allowed');
    }

    // Check for private IP ranges
    for (const range of PRIVATE_IP_RANGES) {
      if (range.test(hostname)) {
        return new URLValidationResult(false, null, 'Access to private IP ranges is not allowed');
      }
    }

    // Check for IP address bypasses (hex, octal, etc.)
    if (/^0x[0-9a-f]+$/i.test(hostname) || /^0[0-7]+$/.test(hostname)) {
      return new URLValidationResult(false, null, 'Alternative IP encoding is not allowed');
    }
  }

  // Check for URL encoding bypasses
  const decoded = decodeURIComponent(trimmed);
  if (decoded !== trimmed) {
    // Re-validate decoded URL
    const decodedResult = validateURL(decoded, { ...options, maxDepth: 0 });
    if (!decodedResult.valid) {
      return new URLValidationResult(false, null, 'URL decoding reveals invalid content');
    }
  }

  // Success
  const result = new URLValidationResult(true, parsed, null);
  result.sanitized = parsed.href;
  return result;
}

/**
 * Sanitizes a URL string
 *
 * @param {string} urlString - The URL to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string|null} - Sanitized URL or null if invalid
 */
function sanitizeURL(urlString, options = {}) {
  const validation = validateURL(urlString, options);
  return validation.valid ? validation.sanitized : null;
}

/**
 * Validates and extracts query parameters safely
 *
 * @param {string} urlString - The URL to parse
 * @returns {Object} - Object with url and params
 */
function parseURLSafely(urlString) {
  const validation = validateURL(urlString);

  if (!validation.valid) {
    return {
      valid: false,
      error: validation.error,
      url: null,
      params: {}
    };
  }

  const params = {};
  const searchParams = validation.url.searchParams;

  for (const [key, value] of searchParams.entries()) {
    // Sanitize parameter keys and values
    const sanitizedKey = sanitizeString(key);
    const sanitizedValue = sanitizeString(value);
    params[sanitizedKey] = sanitizedValue;
  }

  return {
    valid: true,
    error: null,
    url: validation.url,
    params
  };
}

/**
 * Sanitizes a string by removing dangerous characters
 *
 * @param {string} str - String to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeString(str) {
  if (typeof str !== 'string') {
    return String(str);
  }

  return str
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[<>'"]/g, '') // Remove HTML characters
    .trim();
}

/**
 * Checks if a URL is safe for redirection
 *
 * @param {string} urlString - The redirect URL
 * @param {string} allowedDomain - Optional domain restriction
 * @returns {boolean}
 */
function isSafeRedirect(urlString, allowedDomain = null) {
  const validation = validateURL(urlString);

  if (!validation.valid) {
    return false;
  }

  // If domain restriction is set, enforce it
  if (allowedDomain) {
    const targetDomain = validation.url.hostname.toLowerCase();
    const allowed = allowedDomain.toLowerCase();

    // Exact match or subdomain
    if (targetDomain !== allowed && !targetDomain.endsWith('.' + allowed)) {
      return false;
    }
  }

  // Must use HTTPS for redirects
  if (validation.url.protocol !== 'https:') {
    return false;
  }

  return true;
}

/**
 * Normalizes a URL for comparison
 *
 * @param {string} urlString - The URL to normalize
 * @returns {string|null} - Normalized URL or null
 */
function normalizeURL(urlString) {
  const validation = validateURL(urlString);

  if (!validation.valid) {
    return null;
  }

  const url = validation.url;

  // Remove default ports
  const port = url.port;
  if ((url.protocol === 'http:' && port === '80') || (url.protocol === 'https:' && port === '443')) {
    url.port = '';
  }

  // Remove trailing slash from pathname (including root)
  let pathname = url.pathname;
  if (pathname.endsWith('/') && pathname.length > 1) {
    url.pathname = pathname.slice(0, -1);
  }

  // Sort query parameters for consistent comparison
  const params = Array.from(url.searchParams.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  url.search = '';
  for (const [key, value] of params) {
    url.searchParams.append(key, value);
  }

  // Remove fragment
  url.hash = '';

  return url.href;
}

/**
 * Validates a list of URLs
 *
 * @param {Array<string>} urls - Array of URL strings
 * @param {Object} options - Validation options
 * @returns {Array<string>} - Array of valid, sanitized URLs
 */
function validateURLList(urls, options = {}) {
  if (!Array.isArray(urls)) {
    return [];
  }

  const valid = [];
  const seen = new Set();

  for (const url of urls) {
    const validation = validateURL(url, options);
    if (validation.valid) {
      const normalized = normalizeURL(url);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        valid.push(validation.sanitized);
      }
    }
  }

  return valid;
}

/**
 * Escapes HTML in a string
 *
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeHTML(str) {
  if (typeof str !== 'string') {
    return '';
  }

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

module.exports = {
  validateURL,
  sanitizeURL,
  parseURLSafely,
  isSafeRedirect,
  normalizeURL,
  validateURLList,
  sanitizeString,
  escapeHTML,
  URLValidationResult,
  DANGEROUS_SCHEMES,
  ALLOWED_SCHEMES,
  PRIVATE_IP_RANGES,
  MAX_URL_LENGTH
};
