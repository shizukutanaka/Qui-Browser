/**
 * XSS Protection Enhancement
 *
 * Provides comprehensive XSS protection (Improvement #14)
 * - HTML sanitization
 * - Attribute filtering
 * - JavaScript context escaping
 * - URL sanitization
 */

/**
 * HTML entities for escaping
 */
const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

/**
 * Dangerous HTML tags that should be removed
 */
const DANGEROUS_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'link',
  'style',
  'base',
  'meta',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option'
]);

/**
 * Allowed HTML tags for basic formatting
 */
const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'em',
  'u',
  'b',
  'i',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
  'pre',
  'span',
  'div'
]);

/**
 * Allowed HTML attributes
 */
const ALLOWED_ATTRIBUTES = new Set(['class', 'id', 'title', 'lang', 'dir']);

/**
 * Dangerous protocols in URLs
 */
const DANGEROUS_PROTOCOLS = new Set([
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'about:',
  'blob:'
]);

/**
 * Escape HTML entities
 *
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (typeof str !== 'string') {
    return '';
  }

  return str.replace(/[&<>"'`=\/]/g, (char) => HTML_ENTITIES[char]);
}

/**
 * Escape for JavaScript context
 *
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeJavaScript(str) {
  if (typeof str !== 'string') {
    return '';
  }

  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\f/g, '\\f')
    .replace(/\v/g, '\\v')
    .replace(/\0/g, '\\0')
    .replace(/</g, '\\x3C')
    .replace(/>/g, '\\x3E');
}

/**
 * Escape for JSON context
 *
 * @param {any} value - Value to escape
 * @returns {string} JSON string
 */
function escapeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003C').replace(/>/g, '\\u003E');
}

/**
 * Escape for HTML attribute context
 *
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeAttribute(str) {
  if (typeof str !== 'string') {
    return '';
  }

  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#x60;');
}

/**
 * Escape for CSS context
 *
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeCss(str) {
  if (typeof str !== 'string') {
    return '';
  }

  return str.replace(/[<>"'\/]/g, (char) => `\\${char.charCodeAt(0).toString(16)} `);
}

/**
 * Sanitize URL to prevent XSS
 *
 * @param {string} url - URL to sanitize
 * @returns {string|null} Sanitized URL or null if dangerous
 */
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim().toLowerCase();

  // Check for dangerous protocols
  for (const protocol of DANGEROUS_PROTOCOLS) {
    if (trimmed.startsWith(protocol)) {
      return null;
    }
  }

  // Check for encoded dangerous protocols
  const decoded = decodeURIComponent(trimmed);
  for (const protocol of DANGEROUS_PROTOCOLS) {
    if (decoded.startsWith(protocol)) {
      return null;
    }
  }

  // Only allow http, https, mailto, and relative URLs
  if (
    !trimmed.startsWith('http://') &&
    !trimmed.startsWith('https://') &&
    !trimmed.startsWith('mailto:') &&
    !trimmed.startsWith('/') &&
    !trimmed.startsWith('#')
  ) {
    return null;
  }

  return url;
}

/**
 * Remove dangerous HTML tags
 *
 * @param {string} html - HTML string
 * @returns {string} Sanitized HTML
 */
function removeDangerousTags(html) {
  if (typeof html !== 'string') {
    return '';
  }

  let sanitized = html;

  // Remove script tags and content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove other dangerous tags
  for (const tag of DANGEROUS_TAGS) {
    const regex = new RegExp(`<${tag}\\b[^<]*(?:(?!<\\/${tag}>)<[^<]*)*<\\/${tag}>`, 'gi');
    sanitized = sanitized.replace(regex, '');

    // Also remove self-closing tags
    const selfClosingRegex = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi');
    sanitized = sanitized.replace(selfClosingRegex, '');
  }

  // Remove event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

  return sanitized;
}

/**
 * Sanitize HTML with whitelist approach
 *
 * @param {string} html - HTML string
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized HTML
 */
function sanitizeHtml(html, options = {}) {
  const { allowedTags = ALLOWED_TAGS, allowedAttributes = ALLOWED_ATTRIBUTES, stripAll = false } = options;

  if (typeof html !== 'string') {
    return '';
  }

  if (stripAll) {
    return html.replace(/<[^>]*>/g, '');
  }

  // First pass: remove dangerous tags
  let sanitized = removeDangerousTags(html);

  // Second pass: filter allowed tags
  sanitized = sanitized.replace(/<(\/?)([\w]+)([^>]*)>/gi, (match, closing, tagName, attributes) => {
    const tag = tagName.toLowerCase();

    // Remove tags not in whitelist
    if (!allowedTags.has(tag)) {
      return '';
    }

    // For closing tags, just return them
    if (closing === '/') {
      return `</${tag}>`;
    }

    // Filter attributes
    const filteredAttrs = attributes.replace(/\s+([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*)))?/gi, (
      attrMatch,
      attrName,
      doubleQuoted,
      singleQuoted,
      unquoted
    ) => {
      const attr = attrName.toLowerCase();

      // Remove attributes not in whitelist
      if (!allowedAttributes.has(attr)) {
        return '';
      }

      // Get attribute value
      const value = doubleQuoted || singleQuoted || unquoted || '';

      // Sanitize attribute value
      const sanitizedValue = escapeAttribute(value);

      return ` ${attr}="${sanitizedValue}"`;
    });

    return `<${tag}${filteredAttrs}>`;
  });

  return sanitized;
}

/**
 * Strip all HTML tags
 *
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
function stripHtml(html) {
  if (typeof html !== 'string') {
    return '';
  }

  return html.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize user input for safe display
 *
 * @param {string} input - User input
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized input
 */
function sanitizeInput(input, options = {}) {
  const { allowHtml = false, allowedTags, allowedAttributes } = options;

  if (typeof input !== 'string') {
    return '';
  }

  if (allowHtml) {
    return sanitizeHtml(input, { allowedTags, allowedAttributes });
  }

  return escapeHtml(input);
}

/**
 * Create safe HTML from template
 *
 * @param {string} template - Template string
 * @param {Object} data - Data to interpolate
 * @returns {string} Safe HTML
 */
function createSafeHtml(template, data = {}) {
  if (typeof template !== 'string') {
    return '';
  }

  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = data[key];
    if (value === undefined || value === null) {
      return '';
    }
    return escapeHtml(String(value));
  });
}

/**
 * XSS Protection middleware
 *
 * @param {Object} options - Middleware options
 * @returns {Function} Middleware function
 */
function createXssMiddleware(options = {}) {
  const { sanitizeBody = true, sanitizeQuery = true, sanitizeParams = true } = options;

  return function xssMiddleware(req, res, next) {
    // Sanitize request body
    if (sanitizeBody && req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (sanitizeQuery && req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize route parameters
    if (sanitizeParams && req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }

    // Add helper methods to request
    req.sanitize = {
      html: (str) => escapeHtml(str),
      attribute: (str) => escapeAttribute(str),
      javascript: (str) => escapeJavaScript(str),
      json: (val) => escapeJson(val),
      css: (str) => escapeCss(str),
      url: (str) => sanitizeUrl(str)
    };

    next();
  };
}

/**
 * Recursively sanitize object
 *
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
function sanitizeObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map((item) => (typeof item === 'object' ? sanitizeObject(item) : sanitizeInput(item)));
  }

  if (obj !== null && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = escapeHtml(key);
      sanitized[sanitizedKey] =
        typeof value === 'object' && value !== null ? sanitizeObject(value) : sanitizeInput(value);
    }
    return sanitized;
  }

  return sanitizeInput(obj);
}

/**
 * Validate and sanitize rich text content
 *
 * @param {string} content - Rich text content
 * @returns {Object} Validation result
 */
function validateRichText(content) {
  if (!content || typeof content !== 'string') {
    return { valid: false, sanitized: '', errors: ['Content is required'] };
  }

  const errors = [];

  // Check for dangerous patterns
  if (/<script/i.test(content)) {
    errors.push('Script tags are not allowed');
  }

  if (/javascript:/i.test(content)) {
    errors.push('JavaScript URLs are not allowed');
  }

  if (/on\w+\s*=/i.test(content)) {
    errors.push('Event handlers are not allowed');
  }

  // Sanitize content
  const sanitized = sanitizeHtml(content);

  return {
    valid: errors.length === 0,
    sanitized,
    errors
  };
}

module.exports = {
  escapeHtml,
  escapeJavaScript,
  escapeJson,
  escapeAttribute,
  escapeCss,
  sanitizeUrl,
  sanitizeHtml,
  stripHtml,
  sanitizeInput,
  removeDangerousTags,
  createSafeHtml,
  createXssMiddleware,
  validateRichText,
  DANGEROUS_TAGS,
  ALLOWED_TAGS,
  ALLOWED_ATTRIBUTES,
  DANGEROUS_PROTOCOLS
};
