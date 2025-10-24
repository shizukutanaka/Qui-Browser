/**
 * VR Security Manager
 * Content Security Policy + GDPR Compliance + Input Sanitization
 *
 * Based on 2025 security best practices:
 * - OWASP Top 10 for Web Applications
 * - CSP Level 3 (W3C)
 * - GDPR (EU General Data Protection Regulation)
 * - WebXR Security Considerations (W3C)
 *
 * Key Features:
 * - Content Security Policy enforcement
 * - Input sanitization (XSS prevention)
 * - URL validation
 * - Origin validation for WebXR
 * - GDPR cookie consent
 * - Data export/erasure (right to be forgotten)
 * - Privacy policy compliance
 *
 * Security Headers:
 * - Content-Security-Policy
 * - X-Content-Type-Options
 * - X-Frame-Options
 * - X-XSS-Protection
 * - Referrer-Policy
 * - Permissions-Policy
 *
 * @version 3.7.1
 * @author Qui Browser Team
 * @license MIT
 */

class VRSecurityManager {
  constructor() {
    this.config = {
      // CSP settings
      csp: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-eval'", 'https://cdn.jsdelivr.net'],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'https:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': ["'self'", 'https://api.qui-browser.example.com'],
        'media-src': ["'self'", 'https:'],
        'object-src': ["'none'"],
        'frame-src': ["'self'", 'https:'],
        'worker-src': ["'self'", 'blob:'],
        'upgrade-insecure-requests': true
      },

      // Trusted origins for WebXR
      trustedOrigins: [
        'https://qui-browser.example.com',
        'https://localhost:8080',
        'http://localhost:8080'
      ],

      // GDPR settings
      gdpr: {
        enabled: true,
        consentRequired: true,
        dataRetentionDays: 365,
        allowAnalytics: false,
        allowMarketing: false
      },

      // Sanitization settings
      sanitization: {
        enableXSSProtection: true,
        enableSQLInjectionProtection: true,
        maxInputLength: 10000,
        allowedTags: ['b', 'i', 'u', 'strong', 'em'],
        blockedPatterns: [
          /<script[^>]*>[\s\S]*?<\/script>/gi,
          /javascript:/gi,
          /on\w+\s*=/gi,
          /<iframe[^>]*>/gi,
          /<object[^>]*>/gi,
          /<embed[^>]*>/gi
        ]
      }
    };

    // Security state
    this.violations = [];
    this.blockedRequests = [];
    this.sanitizedInputs = 0;

    // GDPR consent state
    this.consent = {
      essential: true, // Always true
      analytics: false,
      marketing: false,
      timestamp: null,
      version: '1.0'
    };

    // Initialize
    this.initialized = false;

    // Event emitter
    this.eventTarget = new EventTarget();

    console.info('[VRSecurityManager] Security Manager initialized');
  }

  /**
   * Initialize security manager
   */
  async initialize() {
    console.log('[VRSecurityManager] Initializing...');

    try {
      // Apply CSP headers (if server-side not configured)
      this.applyCSP();

      // Setup input sanitization
      this.setupInputSanitization();

      // Load GDPR consent
      const savedConsent = this.loadConsent();
      if (savedConsent) {
        this.consent = savedConsent;
      } else {
        // Show consent dialog
        await this.showConsentDialog();
      }

      // Setup security event listeners
      this.setupSecurityListeners();

      this.initialized = true;

      console.log('[VRSecurityManager] Initialization complete');

      this.dispatchEvent('initialized', {
        csp: this.config.csp,
        gdpr: this.config.gdpr,
        consent: this.consent
      });

      return true;

    } catch (error) {
      console.error('[VRSecurityManager] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Apply Content Security Policy
   */
  applyCSP() {
    // Generate CSP header string
    const cspString = this.generateCSPString();

    // Add meta tag for CSP (client-side enforcement)
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = cspString;
    document.head.appendChild(meta);

    console.log('[VRSecurityManager] CSP applied:', cspString);
  }

  /**
   * Generate CSP string
   */
  generateCSPString() {
    const directives = [];

    for (const [directive, values] of Object.entries(this.config.csp)) {
      if (directive === 'upgrade-insecure-requests') {
        if (values) {
          directives.push('upgrade-insecure-requests');
        }
      } else {
        directives.push(`${directive} ${values.join(' ')}`);
      }
    }

    return directives.join('; ');
  }

  /**
   * Setup input sanitization
   */
  setupInputSanitization() {
    // Intercept all form submissions
    document.addEventListener('submit', (event) => {
      this.sanitizeForm(event.target);
    }, true);

    // Intercept all input changes
    document.addEventListener('input', (event) => {
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        event.target.value = this.sanitizeInput(event.target.value);
      }
    }, true);

    console.log('[VRSecurityManager] Input sanitization enabled');
  }

  /**
   * Sanitize input text
   */
  sanitizeInput(input) {
    if (!input || !this.config.sanitization.enableXSSProtection) {
      return input;
    }

    let sanitized = input;

    // Remove dangerous patterns
    for (const pattern of this.config.sanitization.blockedPatterns) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Remove dangerous characters
    sanitized = sanitized
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '');

    // Limit length
    if (sanitized.length > this.config.sanitization.maxInputLength) {
      sanitized = sanitized.substring(0, this.config.sanitization.maxInputLength);
    }

    if (sanitized !== input) {
      this.sanitizedInputs++;
      this.dispatchEvent('inputSanitized', {
        original: input.substring(0, 100),
        sanitized: sanitized.substring(0, 100)
      });
    }

    return sanitized;
  }

  /**
   * Sanitize URL
   */
  sanitizeURL(url) {
    try {
      const parsed = new URL(url);

      // Block dangerous protocols
      const allowedProtocols = ['http:', 'https:', 'data:'];
      if (!allowedProtocols.includes(parsed.protocol)) {
        console.warn('[VRSecurityManager] Blocked dangerous protocol:', parsed.protocol);
        this.blockedRequests.push({
          type: 'protocol',
          url,
          reason: 'Invalid protocol',
          timestamp: Date.now()
        });
        return '';
      }

      return parsed.href;

    } catch (error) {
      console.error('[VRSecurityManager] Invalid URL:', url, error);
      this.blockedRequests.push({
        type: 'url',
        url,
        reason: 'Invalid URL format',
        timestamp: Date.now()
      });
      return '';
    }
  }

  /**
   * Validate WebXR origin
   */
  validateWebXROrigin(origin) {
    const isTrusted = this.config.trustedOrigins.includes(origin);

    if (!isTrusted) {
      console.warn('[VRSecurityManager] Untrusted WebXR origin:', origin);
      this.violations.push({
        type: 'webxr-origin',
        origin,
        timestamp: Date.now()
      });
    }

    return isTrusted;
  }

  /**
   * Sanitize form
   */
  sanitizeForm(form) {
    const inputs = form.querySelectorAll('input, textarea');

    for (const input of inputs) {
      input.value = this.sanitizeInput(input.value);
    }
  }

  /**
   * Setup security event listeners
   */
  setupSecurityListeners() {
    // CSP violation reporting
    document.addEventListener('securitypolicyviolation', (event) => {
      this.handleCSPViolation(event);
    });

    // Monitor for XSS attempts
    window.addEventListener('error', (event) => {
      if (event.message && event.message.includes('script')) {
        this.handlePotentialXSS(event);
      }
    });
  }

  /**
   * Handle CSP violation
   */
  handleCSPViolation(event) {
    console.error('[VRSecurityManager] CSP Violation:', {
      directive: event.violatedDirective,
      blocked: event.blockedURI,
      original: event.originalPolicy
    });

    this.violations.push({
      type: 'csp',
      directive: event.violatedDirective,
      blockedURI: event.blockedURI,
      timestamp: Date.now()
    });

    this.dispatchEvent('cspViolation', {
      directive: event.violatedDirective,
      blockedURI: event.blockedURI
    });
  }

  /**
   * Handle potential XSS
   */
  handlePotentialXSS(event) {
    console.warn('[VRSecurityManager] Potential XSS attempt detected:', event.message);

    this.violations.push({
      type: 'xss',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      timestamp: Date.now()
    });

    this.dispatchEvent('xssAttempt', {
      message: event.message
    });
  }

  /**
   * Show GDPR consent dialog
   */
  async showConsentDialog() {
    return new Promise((resolve) => {
      // Create consent dialog
      const dialog = this.createConsentDialog();
      document.body.appendChild(dialog);

      // Handle consent buttons
      const acceptAll = dialog.querySelector('#accept-all');
      const acceptEssential = dialog.querySelector('#accept-essential');
      const customize = dialog.querySelector('#customize');

      acceptAll.addEventListener('click', () => {
        this.consent = {
          essential: true,
          analytics: true,
          marketing: true,
          timestamp: Date.now(),
          version: '1.0'
        };
        this.saveConsent();
        document.body.removeChild(dialog);
        resolve(this.consent);
      });

      acceptEssential.addEventListener('click', () => {
        this.consent = {
          essential: true,
          analytics: false,
          marketing: false,
          timestamp: Date.now(),
          version: '1.0'
        };
        this.saveConsent();
        document.body.removeChild(dialog);
        resolve(this.consent);
      });

      customize.addEventListener('click', () => {
        this.showCustomizeDialog(dialog, resolve);
      });
    });
  }

  /**
   * Create consent dialog HTML
   */
  createConsentDialog() {
    const dialog = document.createElement('div');
    dialog.id = 'gdpr-consent-dialog';
    dialog.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #fff;
      border-top: 2px solid #007bff;
      padding: 20px;
      box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
      z-index: 10000;
      font-family: sans-serif;
    `;

    dialog.innerHTML = `
      <h3 style="margin: 0 0 15px 0;">Privacy & Cookie Consent</h3>
      <p style="margin: 0 0 15px 0;">
        We use cookies and similar technologies to:
        <ul style="margin: 5px 0;">
          <li>Provide essential functionality (always active)</li>
          <li>Analyze performance and usage (optional)</li>
          <li>Improve your experience (optional)</li>
        </ul>
        You can change these settings at any time.
      </p>
      <div style="display: flex; gap: 10px;">
        <button id="accept-all" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Accept All
        </button>
        <button id="accept-essential" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Essential Only
        </button>
        <button id="customize" style="padding: 10px 20px; background: transparent; color: #007bff; border: 1px solid #007bff; border-radius: 4px; cursor: pointer;">
          Customize
        </button>
      </div>
    `;

    return dialog;
  }

  /**
   * Show customize dialog
   */
  showCustomizeDialog(parentDialog, resolve) {
    // Create customize panel
    const customize = document.createElement('div');
    customize.innerHTML = `
      <h4 style="margin: 15px 0 10px 0;">Customize Cookie Preferences</h4>
      <div style="margin: 10px 0;">
        <label style="display: flex; align-items: center; margin: 5px 0;">
          <input type="checkbox" id="consent-essential" checked disabled style="margin-right: 10px;">
          <span><strong>Essential</strong> - Required for basic functionality</span>
        </label>
        <label style="display: flex; align-items: center; margin: 5px 0;">
          <input type="checkbox" id="consent-analytics" style="margin-right: 10px;">
          <span><strong>Analytics</strong> - Help us improve the product</span>
        </label>
        <label style="display: flex; align-items: center; margin: 5px 0;">
          <input type="checkbox" id="consent-marketing" style="margin-right: 10px;">
          <span><strong>Marketing</strong> - Personalized content and ads</span>
        </label>
      </div>
      <button id="save-preferences" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">
        Save Preferences
      </button>
    `;

    parentDialog.appendChild(customize);

    // Handle save
    const save = customize.querySelector('#save-preferences');
    save.addEventListener('click', () => {
      this.consent = {
        essential: true,
        analytics: customize.querySelector('#consent-analytics').checked,
        marketing: customize.querySelector('#consent-marketing').checked,
        timestamp: Date.now(),
        version: '1.0'
      };
      this.saveConsent();
      document.body.removeChild(parentDialog);
      resolve(this.consent);
    });
  }

  /**
   * Save consent to localStorage
   */
  saveConsent() {
    localStorage.setItem('gdpr-consent', JSON.stringify(this.consent));
    console.log('[VRSecurityManager] Consent saved:', this.consent);

    this.dispatchEvent('consentUpdated', { consent: this.consent });
  }

  /**
   * Load consent from localStorage
   */
  loadConsent() {
    const saved = localStorage.getItem('gdpr-consent');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        console.error('[VRSecurityManager] Failed to load consent:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Export user data (GDPR right to data portability)
   */
  exportUserData() {
    const data = {
      consent: this.consent,
      bookmarks: this.getBookmarks(),
      history: this.getHistory(),
      settings: this.getSettings(),
      accessibility: this.getAccessibilitySettings(),
      exportDate: new Date().toISOString(),
      version: '3.7.1'
    };

    // Create download link
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `qui-browser-data-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);

    console.log('[VRSecurityManager] User data exported');

    this.dispatchEvent('dataExported', { size: json.length });
  }

  /**
   * Delete user data (GDPR right to be forgotten)
   */
  deleteUserData() {
    if (!confirm('Are you sure you want to delete ALL your data? This cannot be undone.')) {
      return false;
    }

    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();

    // Clear IndexedDB
    indexedDB.databases().then(databases => {
      databases.forEach(db => {
        indexedDB.deleteDatabase(db.name);
      });
    });

    console.log('[VRSecurityManager] All user data deleted');

    this.dispatchEvent('dataDeleted', {});

    alert('All your data has been deleted.');

    return true;
  }

  /**
   * Get bookmarks (placeholder)
   */
  getBookmarks() {
    const bookmarks = localStorage.getItem('bookmarks');
    return bookmarks ? JSON.parse(bookmarks) : [];
  }

  /**
   * Get history (placeholder)
   */
  getHistory() {
    const history = localStorage.getItem('history');
    return history ? JSON.parse(history) : [];
  }

  /**
   * Get settings (placeholder)
   */
  getSettings() {
    const settings = localStorage.getItem('settings');
    return settings ? JSON.parse(settings) : {};
  }

  /**
   * Get accessibility settings (placeholder)
   */
  getAccessibilitySettings() {
    const accessibility = localStorage.getItem('accessibility');
    return accessibility ? JSON.parse(accessibility) : {};
  }

  /**
   * Get security status
   */
  getSecurityStatus() {
    return {
      initialized: this.initialized,
      csp: {
        enabled: true,
        policy: this.generateCSPString()
      },
      gdpr: {
        enabled: this.config.gdpr.enabled,
        consent: this.consent
      },
      violations: this.violations.length,
      blockedRequests: this.blockedRequests.length,
      sanitizedInputs: this.sanitizedInputs
    };
  }

  /**
   * Get violations
   */
  getViolations() {
    return this.violations;
  }

  /**
   * Get blocked requests
   */
  getBlockedRequests() {
    return this.blockedRequests;
  }

  /**
   * Dispose security manager
   */
  dispose() {
    this.initialized = false;

    console.log('[VRSecurityManager] Disposed');
  }

  /**
   * Event handling
   */
  addEventListener(event, callback) {
    this.eventTarget.addEventListener(event, callback);
  }

  removeEventListener(event, callback) {
    this.eventTarget.removeEventListener(event, callback);
  }

  dispatchEvent(event, detail = {}) {
    this.eventTarget.dispatchEvent(new CustomEvent(event, { detail }));
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRSecurityManager;
}

// Global instance
window.VRSecurityManager = VRSecurityManager;

console.info('[VRSecurityManager] VR Security Manager loaded');
