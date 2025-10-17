/**
 * Security Headers Manager
 *
 * Implements comprehensive security headers (Improvements #196-200, #209-215)
 * - Content Security Policy Level 3
 * - Strict-Transport-Security (HSTS)
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - Referrer-Policy
 * - Permissions-Policy
 * - Cross-Origin policies
 */

const crypto = require('crypto');

/**
 * Security headers configuration
 */
const DEFAULT_SECURITY_CONFIG = {
  // Content Security Policy
  csp: {
    enabled: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"]
    },
    reportOnly: false,
    reportUri: null,
    upgradeInsecureRequests: true
  },

  // HSTS
  hsts: {
    enabled: true,
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: false
  },

  // X-Frame-Options
  frameOptions: 'DENY',

  // X-Content-Type-Options
  noSniff: true,

  // Referrer-Policy
  referrerPolicy: 'strict-origin-when-cross-origin',

  // Permissions-Policy
  permissionsPolicy: {
    enabled: true,
    features: {
      camera: [],
      microphone: [],
      geolocation: [],
      'payment': [],
      'usb': [],
      'interest-cohort': []
    }
  },

  // Cross-Origin policies
  crossOriginEmbedderPolicy: 'require-corp',
  crossOriginOpenerPolicy: 'same-origin',
  crossOriginResourcePolicy: 'same-origin'
};

/**
 * CSP directive builder
 */
class CSPBuilder {
  constructor(directives = {}) {
    this.directives = new Map();

    // Initialize with provided directives
    for (const [key, values] of Object.entries(directives)) {
      this.addDirective(key, values);
    }
  }

  /**
   * Add directive
   */
  addDirective(directive, values) {
    if (!Array.isArray(values)) {
      values = [values];
    }

    if (this.directives.has(directive)) {
      const existing = this.directives.get(directive);
      this.directives.set(directive, [...existing, ...values]);
    } else {
      this.directives.set(directive, values);
    }

    return this;
  }

  /**
   * Add nonce to script-src and style-src
   */
  addNonce(nonce) {
    const nonceValue = `'nonce-${nonce}'`;

    this.addDirective('script-src', nonceValue);
    this.addDirective('style-src', nonceValue);

    return this;
  }

  /**
   * Add hash to script-src or style-src
   */
  addHash(content, algorithm = 'sha256', directive = 'script-src') {
    const hash = crypto
      .createHash(algorithm)
      .update(content)
      .digest('base64');

    const hashValue = `'${algorithm}-${hash}'`;
    this.addDirective(directive, hashValue);

    return this;
  }

  /**
   * Enable unsafe-inline (not recommended)
   */
  unsafeInline(directive = 'script-src') {
    this.addDirective(directive, "'unsafe-inline'");
    return this;
  }

  /**
   * Enable unsafe-eval (not recommended)
   */
  unsafeEval(directive = 'script-src') {
    this.addDirective(directive, "'unsafe-eval'");
    return this;
  }

  /**
   * Set report-uri
   */
  reportUri(uri) {
    this.addDirective('report-uri', uri);
    return this;
  }

  /**
   * Set report-to
   */
  reportTo(groupName) {
    this.addDirective('report-to', groupName);
    return this;
  }

  /**
   * Enable upgrade-insecure-requests
   */
  upgradeInsecureRequests() {
    this.addDirective('upgrade-insecure-requests', []);
    return this;
  }

  /**
   * Build CSP header value
   */
  build() {
    const parts = [];

    for (const [directive, values] of this.directives.entries()) {
      if (values.length === 0) {
        parts.push(directive);
      } else {
        parts.push(`${directive} ${values.join(' ')}`);
      }
    }

    return parts.join('; ');
  }

  /**
   * Parse CSP header
   */
  static parse(header) {
    const builder = new CSPBuilder();
    if (!header) return builder;

    const directives = header.split(';').map((d) => d.trim()).filter(Boolean);

    for (const directive of directives) {
      const parts = directive.split(/\s+/);
      const name = parts[0];
      const values = parts.slice(1);

      if (values.length > 0) {
        builder.addDirective(name, values);
      } else {
        builder.addDirective(name, []);
      }
    }

    return builder;
  }
}

/**
 * Permissions-Policy builder
 */
class PermissionsPolicyBuilder {
  constructor(features = {}) {
    this.features = new Map();

    for (const [feature, origins] of Object.entries(features)) {
      this.addFeature(feature, origins);
    }
  }

  /**
   * Add feature
   */
  addFeature(feature, origins = []) {
    if (!Array.isArray(origins)) {
      origins = [origins];
    }

    this.features.set(feature, origins);
    return this;
  }

  /**
   * Allow feature for all origins
   */
  allowAll(feature) {
    this.features.set(feature, ['*']);
    return this;
  }

  /**
   * Allow feature for self only
   */
  allowSelf(feature) {
    this.features.set(feature, ['self']);
    return this;
  }

  /**
   * Deny feature
   */
  deny(feature) {
    this.features.set(feature, []);
    return this;
  }

  /**
   * Build Permissions-Policy header
   */
  build() {
    const parts = [];

    for (const [feature, origins] of this.features.entries()) {
      if (origins.length === 0) {
        parts.push(`${feature}=()`);
      } else if (origins.includes('*')) {
        parts.push(`${feature}=*`);
      } else if (origins.includes('self')) {
        parts.push(`${feature}=(self)`);
      } else {
        const formatted = origins.map((o) => `"${o}"`).join(' ');
        parts.push(`${feature}=(${formatted})`);
      }
    }

    return parts.join(', ');
  }
}

/**
 * Security headers manager
 */
class SecurityHeadersManager {
  constructor(config = {}) {
    this.config = this.mergeConfig(DEFAULT_SECURITY_CONFIG, config);
  }

  /**
   * Deep merge configurations
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
   * Generate nonce for CSP
   */
  generateNonce() {
    return crypto.randomBytes(16).toString('base64');
  }

  /**
   * Build CSP header
   */
  buildCSP(nonce = null) {
    const builder = new CSPBuilder(this.config.csp.directives);

    if (nonce) {
      builder.addNonce(nonce);
    }

    if (this.config.csp.upgradeInsecureRequests) {
      builder.upgradeInsecureRequests();
    }

    if (this.config.csp.reportUri) {
      builder.reportUri(this.config.csp.reportUri);
    }

    return builder.build();
  }

  /**
   * Build HSTS header
   */
  buildHSTS() {
    const parts = [`max-age=${this.config.hsts.maxAge}`];

    if (this.config.hsts.includeSubDomains) {
      parts.push('includeSubDomains');
    }

    if (this.config.hsts.preload) {
      parts.push('preload');
    }

    return parts.join('; ');
  }

  /**
   * Build Permissions-Policy header
   */
  buildPermissionsPolicy() {
    const builder = new PermissionsPolicyBuilder(this.config.permissionsPolicy.features);
    return builder.build();
  }

  /**
   * Get all security headers
   */
  getHeaders(options = {}) {
    const headers = {};
    const { nonce } = options;

    // Content-Security-Policy
    if (this.config.csp.enabled) {
      const headerName = this.config.csp.reportOnly ?
        'Content-Security-Policy-Report-Only' :
        'Content-Security-Policy';

      headers[headerName] = this.buildCSP(nonce);
    }

    // Strict-Transport-Security
    if (this.config.hsts.enabled) {
      headers['Strict-Transport-Security'] = this.buildHSTS();
    }

    // X-Frame-Options
    if (this.config.frameOptions) {
      headers['X-Frame-Options'] = this.config.frameOptions;
    }

    // X-Content-Type-Options
    if (this.config.noSniff) {
      headers['X-Content-Type-Options'] = 'nosniff';
    }

    // Referrer-Policy
    if (this.config.referrerPolicy) {
      headers['Referrer-Policy'] = this.config.referrerPolicy;
    }

    // Permissions-Policy
    if (this.config.permissionsPolicy.enabled) {
      headers['Permissions-Policy'] = this.buildPermissionsPolicy();
    }

    // Cross-Origin-Embedder-Policy
    if (this.config.crossOriginEmbedderPolicy) {
      headers['Cross-Origin-Embedder-Policy'] = this.config.crossOriginEmbedderPolicy;
    }

    // Cross-Origin-Opener-Policy
    if (this.config.crossOriginOpenerPolicy) {
      headers['Cross-Origin-Opener-Policy'] = this.config.crossOriginOpenerPolicy;
    }

    // Cross-Origin-Resource-Policy
    if (this.config.crossOriginResourcePolicy) {
      headers['Cross-Origin-Resource-Policy'] = this.config.crossOriginResourcePolicy;
    }

    // X-XSS-Protection (legacy, for older browsers)
    headers['X-XSS-Protection'] = '1; mode=block';

    return headers;
  }

  /**
   * Create middleware
   */
  createMiddleware() {
    return (req, res, next) => {
      // Generate nonce for this request
      const nonce = this.generateNonce();
      req.cspNonce = nonce;

      // Set security headers
      const headers = this.getHeaders({ nonce });

      for (const [name, value] of Object.entries(headers)) {
        res.setHeader(name, value);
      }

      next();
    };
  }

  /**
   * Get security score
   */
  getSecurityScore() {
    let score = 0;
    const checks = {
      csp: this.config.csp.enabled ? 25 : 0,
      hsts: this.config.hsts.enabled ? 20 : 0,
      frameOptions: this.config.frameOptions ? 15 : 0,
      noSniff: this.config.noSniff ? 10 : 0,
      referrerPolicy: this.config.referrerPolicy ? 10 : 0,
      permissionsPolicy: this.config.permissionsPolicy.enabled ? 10 : 0,
      crossOriginPolicies: (
        this.config.crossOriginEmbedderPolicy &&
        this.config.crossOriginOpenerPolicy &&
        this.config.crossOriginResourcePolicy
      ) ? 10 : 0
    };

    for (const points of Object.values(checks)) {
      score += points;
    }

    return {
      score,
      maxScore: 100,
      grade: this.getGrade(score),
      checks
    };
  }

  /**
   * Get letter grade from score
   */
  getGrade(score) {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
}

/**
 * Create security headers middleware
 */
function createSecurityHeadersMiddleware(config = {}) {
  const manager = new SecurityHeadersManager(config);

  return {
    manager,
    middleware: manager.createMiddleware()
  };
}

module.exports = {
  SecurityHeadersManager,
  CSPBuilder,
  PermissionsPolicyBuilder,
  createSecurityHeadersMiddleware,
  DEFAULT_SECURITY_CONFIG
};
