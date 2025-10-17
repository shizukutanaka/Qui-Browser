/**
 * Log Sanitizer
 * Enhanced log sanitization rules for security and compliance
 * Priority: H021 from improvement backlog
 *
 * @module utils/log-sanitizer
 */

class LogSanitizer {
  constructor(options = {}) {
    this.options = {
      maskPattern: options.maskPattern || '****',
      enableRedaction: options.enableRedaction !== false,
      enableHashing: options.enableHashing || false,
      customRules: options.customRules || [],
      strictMode: options.strictMode || false,
      ...options
    };

    // Initialize built-in patterns
    this.patterns = this.initializePatterns();

    // Add custom rules
    this.addCustomRules(this.options.customRules);
  }

  /**
   * Initialize built-in sanitization patterns
   * @returns {Array} Sanitization patterns
   */
  initializePatterns() {
    return [
      // Credentials
      {
        name: 'password',
        pattern: /("password"\s*:\s*)"[^"]*"/gi,
        replacement: '$1"' + this.options.maskPattern + '"',
        severity: 'critical'
      },
      {
        name: 'api_key',
        pattern: /("(?:api[_-]?key|apikey)"\s*:\s*)"[^"]*"/gi,
        replacement: '$1"' + this.options.maskPattern + '"',
        severity: 'critical'
      },
      {
        name: 'secret',
        pattern: /("(?:secret|token)"\s*:\s*)"[^"]*"/gi,
        replacement: '$1"' + this.options.maskPattern + '"',
        severity: 'critical'
      },
      {
        name: 'authorization_header',
        pattern: /(authorization:\s*)([^\s,}]+)/gi,
        replacement: '$1' + this.options.maskPattern,
        severity: 'critical'
      },

      // Personal Information (PII)
      {
        name: 'email',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        replacement: (match) => this.maskEmail(match),
        severity: 'high'
      },
      {
        name: 'phone',
        pattern: /\b(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\b/g,
        replacement: '***-***-$3',
        severity: 'high'
      },
      {
        name: 'ssn',
        pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
        replacement: '***-**-' + this.options.maskPattern.slice(0, 4),
        severity: 'critical'
      },
      {
        name: 'credit_card',
        pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        replacement: '****-****-****-' + this.options.maskPattern.slice(0, 4),
        severity: 'critical'
      },

      // IP Addresses
      {
        name: 'ipv4',
        pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
        replacement: (match) => this.maskIP(match),
        severity: 'medium'
      },
      {
        name: 'ipv6',
        pattern: /\b(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}\b/gi,
        replacement: (match) => this.maskIPv6(match),
        severity: 'medium'
      },

      // URLs with credentials
      {
        name: 'url_with_credentials',
        pattern: /https?:\/\/[^:]+:[^@]+@[^\s]+/gi,
        replacement: (match) => this.maskURLCredentials(match),
        severity: 'critical'
      },

      // JWT tokens
      {
        name: 'jwt',
        pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
        replacement: 'eyJ' + this.options.maskPattern + '.' + this.options.maskPattern,
        severity: 'critical'
      },

      // AWS Keys
      {
        name: 'aws_access_key',
        pattern: /\bAKIA[0-9A-Z]{16}\b/g,
        replacement: 'AKIA' + this.options.maskPattern,
        severity: 'critical'
      },
      {
        name: 'aws_secret_key',
        pattern: /\b[A-Za-z0-9/+=]{40}\b/g,
        replacement: this.options.maskPattern,
        severity: 'critical',
        context: 'aws' // Only match in AWS context
      },

      // Database connection strings
      {
        name: 'db_connection',
        pattern: /((?:mongodb|mysql|postgresql|redis):\/\/[^:]+:)([^@]+)(@[^\s]+)/gi,
        replacement: '$1' + this.options.maskPattern + '$3',
        severity: 'critical'
      },

      // Private keys
      {
        name: 'private_key',
        pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC )?PRIVATE KEY-----/g,
        replacement: '-----BEGIN PRIVATE KEY----- [REDACTED] -----END PRIVATE KEY-----',
        severity: 'critical'
      },

      // Session IDs
      {
        name: 'session_id',
        pattern: /("(?:session[_-]?id|sessionid|sid)"\s*:\s*)"[^"]*"/gi,
        replacement: '$1"' + this.options.maskPattern + '"',
        severity: 'high'
      },

      // Stripe keys
      {
        name: 'stripe_key',
        pattern: /\b(?:sk|pk)_(?:test|live)_[0-9a-zA-Z]{24,}\b/g,
        replacement: this.options.maskPattern,
        severity: 'critical'
      }
    ];
  }

  /**
   * Add custom sanitization rules
   * @param {Array} rules - Custom rules
   */
  addCustomRules(rules) {
    for (const rule of rules) {
      if (rule.pattern && rule.replacement) {
        this.patterns.push({
          name: rule.name || 'custom',
          pattern: rule.pattern,
          replacement: rule.replacement,
          severity: rule.severity || 'medium'
        });
      }
    }
  }

  /**
   * Sanitize log message
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   * @returns {string} Sanitized message
   */
  sanitize(message, context = {}) {
    if (typeof message !== 'string') {
      message = JSON.stringify(message);
    }

    let sanitized = message;

    for (const pattern of this.patterns) {
      // Check context requirement
      if (pattern.context && !this.matchesContext(context, pattern.context)) {
        continue;
      }

      try {
        if (typeof pattern.replacement === 'function') {
          sanitized = sanitized.replace(pattern.pattern, pattern.replacement);
        } else {
          sanitized = sanitized.replace(pattern.pattern, pattern.replacement);
        }
      } catch (error) {
        console.error(`[LogSanitizer] Error applying pattern ${pattern.name}:`, error);
      }
    }

    // Additional strict mode sanitization
    if (this.options.strictMode) {
      sanitized = this.applyStrictMode(sanitized);
    }

    return sanitized;
  }

  /**
   * Sanitize object (recursive)
   * @param {Object} obj - Object to sanitize
   * @returns {Object} Sanitized object
   */
  sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized = {};

    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = this.sanitize(key);

      if (typeof value === 'string') {
        sanitized[sanitizedKey] = this.sanitize(value);
      } else if (typeof value === 'object') {
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      } else {
        sanitized[sanitizedKey] = value;
      }
    }

    return sanitized;
  }

  /**
   * Check if context matches pattern requirement
   * @param {Object} context - Context
   * @param {string} required - Required context
   * @returns {boolean} Matches
   */
  matchesContext(context, required) {
    return context[required] === true || context.type === required;
  }

  /**
   * Apply strict mode sanitization
   * @param {string} message - Message
   * @returns {string} Sanitized message
   */
  applyStrictMode(message) {
    // Remove all potentially sensitive patterns
    // This is overly cautious but ensures no leaks

    // Remove long alphanumeric strings (potential keys)
    message = message.replace(/\b[A-Za-z0-9]{32,}\b/g, this.options.maskPattern);

    // Remove base64-like strings
    message = message.replace(/\b[A-Za-z0-9+/]{20,}={0,2}\b/g, this.options.maskPattern);

    return message;
  }

  /**
   * Mask email address
   * @param {string} email - Email address
   * @returns {string} Masked email
   */
  maskEmail(email) {
    const [local, domain] = email.split('@');

    if (local.length <= 2) {
      return '**@' + domain;
    }

    return local.slice(0, 2) + '***@' + domain;
  }

  /**
   * Mask IP address
   * @param {string} ip - IP address
   * @returns {string} Masked IP
   */
  maskIP(ip) {
    const parts = ip.split('.');

    if (parts.length !== 4) {
      return this.options.maskPattern;
    }

    // Keep first two octets, mask last two
    return `${parts[0]}.${parts[1]}.***.***.`;
  }

  /**
   * Mask IPv6 address
   * @param {string} ip - IPv6 address
   * @returns {string} Masked IPv6
   */
  maskIPv6(ip) {
    const parts = ip.split(':');

    if (parts.length < 3) {
      return this.options.maskPattern;
    }

    // Keep first two groups, mask rest
    return parts.slice(0, 2).join(':') + ':****:****:****:****';
  }

  /**
   * Mask URL credentials
   * @param {string} url - URL with credentials
   * @returns {string} Masked URL
   */
  maskURLCredentials(url) {
    try {
      const urlObj = new URL(url);
      urlObj.username = this.options.maskPattern;
      urlObj.password = this.options.maskPattern;
      return urlObj.toString();
    } catch {
      return url.replace(/:\/\/[^:]+:[^@]+@/, '://' + this.options.maskPattern + ':' + this.options.maskPattern + '@');
    }
  }

  /**
   * Hash sensitive value
   * @param {string} value - Value to hash
   * @returns {string} Hashed value
   */
  hash(value) {
    if (!this.options.enableHashing) {
      return this.options.maskPattern;
    }

    const crypto = require('crypto');
    return crypto.createHash('sha256').update(value).digest('hex').substring(0, 16);
  }

  /**
   * Create Winston format
   * @returns {Function} Winston format
   */
  createWinstonFormat() {
    return {
      transform: (info) => {
        if (info.message) {
          info.message = this.sanitize(info.message);
        }

        // Sanitize metadata
        for (const key in info) {
          if (key !== 'level' && key !== 'message' && key !== 'timestamp') {
            if (typeof info[key] === 'string') {
              info[key] = this.sanitize(info[key]);
            } else if (typeof info[key] === 'object') {
              info[key] = this.sanitizeObject(info[key]);
            }
          }
        }

        return info;
      }
    };
  }

  /**
   * Create Express middleware
   * @returns {Function} Express middleware
   */
  middleware() {
    return (req, res, next) => {
      // Sanitize request logging
      const originalSend = res.send.bind(res);
      const originalJson = res.json.bind(res);

      res.send = (body) => {
        if (typeof body === 'string') {
          body = this.sanitize(body);
        }
        return originalSend(body);
      };

      res.json = (body) => {
        body = this.sanitizeObject(body);
        return originalJson(body);
      };

      next();
    };
  }

  /**
   * Get sanitization statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      patterns: this.patterns.length,
      byCategory: {
        credentials: this.patterns.filter(p => p.severity === 'critical').length,
        pii: this.patterns.filter(p => p.severity === 'high').length,
        other: this.patterns.filter(p => p.severity === 'medium').length
      }
    };
  }
}

module.exports = LogSanitizer;
