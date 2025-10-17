/**
 * Advanced Input Validation Module
 * Production-grade input validation for government-level security
 *
 * @module utils/input-validator
 */

const crypto = require('crypto');

/**
 * Input validation result
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether input is valid
 * @property {string[]} errors - Array of validation errors
 * @property {*} sanitized - Sanitized value (if valid)
 */

class InputValidator {
  constructor() {
    // Common attack patterns
    // eslint-disable-next-line no-useless-escape
    this.sqlInjectionPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b|--|;|\/\*|\*\/|xp_|sp_)/gi;
    this.xssPattern = /<script|javascript:|onerror=|onload=|<iframe|<object|<embed/gi;
    // eslint-disable-next-line no-useless-escape
    this.pathTraversalPattern = /\.\.[\/\\]|%2e%2e[\/\\]|\.\.%2f|\.\.%5c/gi;
    this.commandInjectionPattern = /[;&|`$(){}[\]<>]/g;
    this.ldapInjectionPattern = /[()&|*]/g;
    this.xmlInjectionPattern = /<!ENTITY|<!DOCTYPE|CDATA/gi;

    // Allowed patterns
    this.alphanumericPattern = /^[a-zA-Z0-9]+$/;
    this.emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    this.urlPattern = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;
    this.ipv4Pattern = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    this.ipv6Pattern = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    this.uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    // Max sizes
    this.maxStringLength = 10000;
    this.maxArrayLength = 1000;
    this.maxObjectDepth = 10;
  }

  /**
   * Validate and sanitize string input
   * @param {*} value - Input value
   * @param {Object} options - Validation options
   * @returns {ValidationResult}
   */
  validateString(value, options = {}) {
    const errors = [];

    // Type check
    if (typeof value !== 'string') {
      return { valid: false, errors: ['Input must be a string'], sanitized: null };
    }

    // Length check
    const minLength = options.minLength || 0;
    const maxLength = options.maxLength || this.maxStringLength;

    if (value.length < minLength) {
      errors.push(`String must be at least ${minLength} characters`);
    }

    if (value.length > maxLength) {
      errors.push(`String must not exceed ${maxLength} characters`);
    }

    // Attack pattern detection
    if (!options.allowHtml && this.xssPattern.test(value)) {
      errors.push('Potential XSS attack detected');
    }

    if (!options.allowSql && this.sqlInjectionPattern.test(value)) {
      errors.push('Potential SQL injection detected');
    }

    if (this.pathTraversalPattern.test(value)) {
      errors.push('Path traversal attempt detected');
    }

    if (!options.allowCommands && this.commandInjectionPattern.test(value)) {
      errors.push('Command injection attempt detected');
    }

    if (!options.allowXml && this.xmlInjectionPattern.test(value)) {
      errors.push('XML injection attempt detected');
    }

    // Pattern validation
    if (options.pattern && !options.pattern.test(value)) {
      errors.push('String does not match required pattern');
    }

    // Sanitize
    let sanitized = value;
    if (options.trim !== false) {
      sanitized = sanitized.trim();
    }

    if (options.lowercase) {
      sanitized = sanitized.toLowerCase();
    }

    if (options.uppercase) {
      sanitized = sanitized.toUpperCase();
    }

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Remove control characters except newline and tab
    if (options.removeControlChars !== false) {
      // eslint-disable-next-line no-control-regex
      sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: errors.length === 0 ? sanitized : null
    };
  }

  /**
   * Validate email address
   * @param {*} email - Email address
   * @returns {ValidationResult}
   */
  validateEmail(email) {
    const result = this.validateString(email, { maxLength: 254, trim: true, lowercase: true });

    if (!result.valid) {
      return result;
    }

    if (!this.emailPattern.test(result.sanitized)) {
      return { valid: false, errors: ['Invalid email format'], sanitized: null };
    }

    // Additional checks
    const [localPart, domain] = result.sanitized.split('@');

    if (localPart.length > 64) {
      return { valid: false, errors: ['Email local part too long'], sanitized: null };
    }

    if (domain.length > 253) {
      return { valid: false, errors: ['Email domain too long'], sanitized: null };
    }

    return result;
  }

  /**
   * Validate URL
   * @param {*} url - URL string
   * @param {Object} options - Validation options
   * @returns {ValidationResult}
   */
  validateUrl(url, options = {}) {
    const result = this.validateString(url, { maxLength: 2048, trim: true });

    if (!result.valid) {
      return result;
    }

    try {
      const parsed = new URL(result.sanitized);

      // Protocol whitelist
      const allowedProtocols = options.allowedProtocols || ['http:', 'https:'];
      if (!allowedProtocols.includes(parsed.protocol)) {
        return { valid: false, errors: ['Invalid URL protocol'], sanitized: null };
      }

      // Domain whitelist (if provided)
      if (options.allowedDomains && !options.allowedDomains.includes(parsed.hostname)) {
        return { valid: false, errors: ['Domain not allowed'], sanitized: null };
      }

      return { valid: true, errors: [], sanitized: result.sanitized };
    } catch (error) {
      return { valid: false, errors: ['Invalid URL format'], sanitized: null };
    }
  }

  /**
   * Validate integer
   * @param {*} value - Input value
   * @param {Object} options - Validation options
   * @returns {ValidationResult}
   */
  validateInteger(value, options = {}) {
    const errors = [];
    let num = value;

    // Type coercion if allowed
    if (options.coerce && typeof value === 'string') {
      num = parseInt(value, 10);
    }

    if (!Number.isInteger(num)) {
      return { valid: false, errors: ['Value must be an integer'], sanitized: null };
    }

    // Range check
    if (options.min !== undefined && num < options.min) {
      errors.push(`Value must be at least ${options.min}`);
    }

    if (options.max !== undefined && num > options.max) {
      errors.push(`Value must not exceed ${options.max}`);
    }

    // Safe integer check
    if (!Number.isSafeInteger(num)) {
      errors.push('Value exceeds safe integer range');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: errors.length === 0 ? num : null
    };
  }

  /**
   * Validate number
   * @param {*} value - Input value
   * @param {Object} options - Validation options
   * @returns {ValidationResult}
   */
  validateNumber(value, options = {}) {
    const errors = [];
    let num = value;

    // Type coercion if allowed
    if (options.coerce && typeof value === 'string') {
      num = parseFloat(value);
    }

    if (typeof num !== 'number' || !Number.isFinite(num)) {
      return { valid: false, errors: ['Value must be a valid number'], sanitized: null };
    }

    // Range check
    if (options.min !== undefined && num < options.min) {
      errors.push(`Value must be at least ${options.min}`);
    }

    if (options.max !== undefined && num > options.max) {
      errors.push(`Value must not exceed ${options.max}`);
    }

    // Precision check
    if (options.precision !== undefined) {
      const factor = Math.pow(10, options.precision);
      num = Math.round(num * factor) / factor;
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: errors.length === 0 ? num : null
    };
  }

  /**
   * Validate boolean
   * @param {*} value - Input value
   * @param {Object} options - Validation options
   * @returns {ValidationResult}
   */
  validateBoolean(value, options = {}) {
    if (typeof value === 'boolean') {
      return { valid: true, errors: [], sanitized: value };
    }

    // Type coercion if allowed
    if (options.coerce) {
      if (typeof value === 'string') {
        const lower = value.toLowerCase().trim();
        if (['true', '1', 'yes', 'on'].includes(lower)) {
          return { valid: true, errors: [], sanitized: true };
        }
        if (['false', '0', 'no', 'off'].includes(lower)) {
          return { valid: true, errors: [], sanitized: false };
        }
      }
      if (typeof value === 'number') {
        return { valid: true, errors: [], sanitized: value !== 0 };
      }
    }

    return { valid: false, errors: ['Value must be a boolean'], sanitized: null };
  }

  /**
   * Validate array
   * @param {*} value - Input value
   * @param {Object} options - Validation options
   * @returns {ValidationResult}
   */
  validateArray(value, options = {}) {
    const errors = [];

    if (!Array.isArray(value)) {
      return { valid: false, errors: ['Value must be an array'], sanitized: null };
    }

    // Length check
    const minLength = options.minLength || 0;
    const maxLength = options.maxLength || this.maxArrayLength;

    if (value.length < minLength) {
      errors.push(`Array must have at least ${minLength} items`);
    }

    if (value.length > maxLength) {
      errors.push(`Array must not exceed ${maxLength} items`);
    }

    // Item validation
    const sanitizedItems = [];
    if (options.itemValidator) {
      for (let i = 0; i < value.length; i++) {
        const itemResult = options.itemValidator(value[i], i);
        if (!itemResult.valid) {
          errors.push(`Item at index ${i}: ${itemResult.errors.join(', ')}`);
        } else {
          sanitizedItems.push(itemResult.sanitized);
        }
      }
    } else {
      sanitizedItems.push(...value);
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: errors.length === 0 ? sanitizedItems : null
    };
  }

  /**
   * Validate object
   * @param {*} value - Input value
   * @param {Object} options - Validation options
   * @returns {ValidationResult}
   */
  validateObject(value, options = {}, depth = 0) {
    const errors = [];

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { valid: false, errors: ['Value must be an object'], sanitized: null };
    }

    // Depth check
    if (depth > this.maxObjectDepth) {
      return { valid: false, errors: ['Object nesting too deep'], sanitized: null };
    }

    // Schema validation
    const sanitized = {};
    if (options.schema) {
      for (const [key, validator] of Object.entries(options.schema)) {
        const fieldValue = value[key];

        // Required field check
        if (validator.required && (fieldValue === undefined || fieldValue === null)) {
          errors.push(`Field '${key}' is required`);
          continue;
        }

        // Skip optional undefined fields
        if (fieldValue === undefined || fieldValue === null) {
          continue;
        }

        // Validate field
        const fieldResult = validator.validate(fieldValue);
        if (!fieldResult.valid) {
          errors.push(`Field '${key}': ${fieldResult.errors.join(', ')}`);
        } else {
          sanitized[key] = fieldResult.sanitized;
        }
      }

      // Check for unknown fields
      if (!options.allowUnknownFields) {
        for (const key of Object.keys(value)) {
          if (!(key in options.schema)) {
            errors.push(`Unknown field '${key}'`);
          }
        }
      }
    } else {
      Object.assign(sanitized, value);
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: errors.length === 0 ? sanitized : null
    };
  }

  /**
   * Validate IP address
   * @param {*} ip - IP address
   * @param {Object} options - Validation options
   * @returns {ValidationResult}
   */
  validateIp(ip, options = {}) {
    const result = this.validateString(ip, { trim: true });

    if (!result.valid) {
      return result;
    }

    const isV4 = this.ipv4Pattern.test(result.sanitized);
    const isV6 = this.ipv6Pattern.test(result.sanitized);

    if (!isV4 && !isV6) {
      return { valid: false, errors: ['Invalid IP address format'], sanitized: null };
    }

    // Version check
    if (options.version === 4 && !isV4) {
      return { valid: false, errors: ['Must be IPv4 address'], sanitized: null };
    }

    if (options.version === 6 && !isV6) {
      return { valid: false, errors: ['Must be IPv6 address'], sanitized: null };
    }

    // Block private IPs if required
    if (options.blockPrivate && isV4) {
      const parts = result.sanitized.split('.').map(Number);
      if (
        parts[0] === 10 ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168) ||
        parts[0] === 127
      ) {
        return { valid: false, errors: ['Private IP addresses not allowed'], sanitized: null };
      }
    }

    return result;
  }

  /**
   * Validate UUID
   * @param {*} uuid - UUID string
   * @returns {ValidationResult}
   */
  validateUuid(uuid) {
    const result = this.validateString(uuid, { trim: true, lowercase: true });

    if (!result.valid) {
      return result;
    }

    if (!this.uuidPattern.test(result.sanitized)) {
      return { valid: false, errors: ['Invalid UUID format'], sanitized: null };
    }

    return result;
  }

  /**
   * Validate enum value
   * @param {*} value - Input value
   * @param {Array} allowedValues - Array of allowed values
   * @returns {ValidationResult}
   */
  validateEnum(value, allowedValues) {
    if (!Array.isArray(allowedValues) || allowedValues.length === 0) {
      return { valid: false, errors: ['Invalid enum configuration'], sanitized: null };
    }

    if (!allowedValues.includes(value)) {
      return {
        valid: false,
        errors: [`Value must be one of: ${allowedValues.join(', ')}`],
        sanitized: null
      };
    }

    return { valid: true, errors: [], sanitized: value };
  }

  /**
   * Sanitize filename
   * @param {string} filename - Filename to sanitize
   * @returns {ValidationResult}
   */
  sanitizeFilename(filename) {
    const result = this.validateString(filename, { maxLength: 255 });

    if (!result.valid) {
      return result;
    }

    // Remove dangerous characters
    // eslint-disable-next-line no-control-regex
    let sanitized = result.sanitized
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/^\.+/, '')
      .replace(/\.+$/, '');

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Prevent reserved names (Windows)
    const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reserved.includes(sanitized.toUpperCase())) {
      return { valid: false, errors: ['Reserved filename'], sanitized: null };
    }

    if (sanitized.length === 0) {
      return { valid: false, errors: ['Filename cannot be empty'], sanitized: null };
    }

    return { valid: true, errors: [], sanitized };
  }

  /**
   * Validate file path
   * @param {string} filepath - File path to validate
   * @param {Object} options - Validation options
   * @returns {ValidationResult}
   */
  validateFilePath(filepath, options = {}) {
    const result = this.validateString(filepath, { maxLength: 4096 });

    if (!result.valid) {
      return result;
    }

    // Check for path traversal
    if (this.pathTraversalPattern.test(result.sanitized)) {
      return { valid: false, errors: ['Path traversal detected'], sanitized: null };
    }

    // Normalize path separators
    let sanitized = result.sanitized.replace(/\\/g, '/');

    // Remove consecutive slashes
    sanitized = sanitized.replace(/\/+/g, '/');

    // Remove leading slashes if not allowed
    if (!options.allowAbsolute && sanitized.startsWith('/')) {
      return { valid: false, errors: ['Absolute paths not allowed'], sanitized: null };
    }

    // Check base path restriction
    if (options.basePath) {
      const normalized = options.basePath.replace(/\\/g, '/');
      if (!sanitized.startsWith(normalized)) {
        return { valid: false, errors: ['Path outside allowed directory'], sanitized: null };
      }
    }

    return { valid: true, errors: [], sanitized };
  }

  /**
   * Generate secure random token
   * @param {number} bytes - Number of bytes (default: 32)
   * @returns {string} - Hex token
   */
  generateToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Hash password securely
   * @param {string} password - Password to hash
   * @returns {string} - Hashed password
   */
  hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  /**
   * Constant-time string comparison
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {boolean} - True if strings match
   */
  constantTimeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') {
      return false;
    }

    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);

    if (bufA.length !== bufB.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
  }
}

module.exports = InputValidator;
