const EventEmitter = require('events');

/**
 * ARIA Validator
 */
class ARIAValidator {
  constructor() {
    // Valid ARIA roles
    this.validRoles = new Set([
      'alert',
      'alertdialog',
      'application',
      'article',
      'banner',
      'button',
      'checkbox',
      'columnheader',
      'combobox',
      'complementary',
      'contentinfo',
      'dialog',
      'directory',
      'document',
      'feed',
      'figure',
      'form',
      'grid',
      'gridcell',
      'group',
      'heading',
      'img',
      'link',
      'list',
      'listbox',
      'listitem',
      'log',
      'main',
      'marquee',
      'math',
      'menu',
      'menubar',
      'menuitem',
      'menuitemcheckbox',
      'menuitemradio',
      'navigation',
      'none',
      'note',
      'option',
      'presentation',
      'progressbar',
      'radio',
      'radiogroup',
      'region',
      'row',
      'rowgroup',
      'rowheader',
      'scrollbar',
      'search',
      'searchbox',
      'separator',
      'slider',
      'spinbutton',
      'status',
      'switch',
      'tab',
      'table',
      'tablist',
      'tabpanel',
      'term',
      'textbox',
      'timer',
      'toolbar',
      'tooltip',
      'tree',
      'treegrid',
      'treeitem'
    ]);

    // Valid ARIA attributes
    this.validAttributes = new Set([
      'aria-activedescendant',
      'aria-atomic',
      'aria-autocomplete',
      'aria-busy',
      'aria-checked',
      'aria-colcount',
      'aria-colindex',
      'aria-colspan',
      'aria-controls',
      'aria-current',
      'aria-describedby',
      'aria-details',
      'aria-disabled',
      'aria-dropeffect',
      'aria-errormessage',
      'aria-expanded',
      'aria-flowto',
      'aria-grabbed',
      'aria-haspopup',
      'aria-hidden',
      'aria-invalid',
      'aria-keyshortcuts',
      'aria-label',
      'aria-labelledby',
      'aria-level',
      'aria-live',
      'aria-modal',
      'aria-multiline',
      'aria-multiselectable',
      'aria-orientation',
      'aria-owns',
      'aria-placeholder',
      'aria-posinset',
      'aria-pressed',
      'aria-readonly',
      'aria-relevant',
      'aria-required',
      'aria-roledescription',
      'aria-rowcount',
      'aria-rowindex',
      'aria-rowspan',
      'aria-selected',
      'aria-setsize',
      'aria-sort',
      'aria-valuemax',
      'aria-valuemin',
      'aria-valuenow',
      'aria-valuetext'
    ]);
  }

  /**
   * Validate ARIA role
   */
  validateRole(role) {
    if (!role) return { valid: true };

    const roles = role.split(' ');
    const invalid = roles.filter((r) => !this.validRoles.has(r));

    return {
      valid: invalid.length === 0,
      invalidRoles: invalid
    };
  }

  /**
   * Validate ARIA attribute
   */
  validateAttribute(attribute) {
    return this.validAttributes.has(attribute);
  }

  /**
   * Validate element attributes
   */
  validateElement(attributes) {
    const issues = [];

    // Check role
    if (attributes.role) {
      const roleValidation = this.validateRole(attributes.role);
      if (!roleValidation.valid) {
        issues.push({
          type: 'invalid-role',
          message: `Invalid ARIA role(s): ${roleValidation.invalidRoles.join(', ')}`,
          severity: 'error'
        });
      }
    }

    // Check ARIA attributes
    Object.keys(attributes).forEach((attr) => {
      if (attr.startsWith('aria-')) {
        if (!this.validateAttribute(attr)) {
          issues.push({
            type: 'invalid-aria-attribute',
            message: `Invalid ARIA attribute: ${attr}`,
            severity: 'error'
          });
        }
      }
    });

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

/**
 * Accessibility Checker
 */
class AccessibilityChecker extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      level: 'AA', // WCAG level: A, AA, or AAA
      checkContrast: true,
      checkLabels: true,
      checkKeyboard: true,
      checkSemantics: true,
      ...options
    };

    this.validator = new ARIAValidator();
    this.issues = [];
  }

  /**
   * Check color contrast ratio
   */
  checkContrast(foreground, background) {
    const getLuminance = (rgb) => {
      const [r, g, b] = rgb.map((val) => {
        val = val / 255;
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const l1 = getLuminance(foreground);
    const l2 = getLuminance(background);

    const ratio = l1 > l2 ? (l1 + 0.05) / (l2 + 0.05) : (l2 + 0.05) / (l1 + 0.05);

    // WCAG 2.1 requirements
    const requirements = {
      A: { normal: 3, large: 3 },
      AA: { normal: 4.5, large: 3 },
      AAA: { normal: 7, large: 4.5 }
    };

    const level = this.config.level;
    const required = requirements[level];

    return {
      ratio,
      passNormal: ratio >= required.normal,
      passLarge: ratio >= required.large,
      level
    };
  }

  /**
   * Check if element has accessible label
   */
  checkLabel(element) {
    const hasLabel =
      element['aria-label'] ||
      element['aria-labelledby'] ||
      element.alt ||
      element.title ||
      element.label;

    if (!hasLabel) {
      this.addIssue({
        type: 'missing-label',
        element,
        message: 'Element is missing accessible label',
        severity: 'error',
        wcag: '4.1.2'
      });
      return false;
    }

    return true;
  }

  /**
   * Check keyboard accessibility
   */
  checkKeyboardAccess(element) {
    const interactive = ['button', 'link', 'input', 'select', 'textarea'];
    const role = element.role || element.type;

    if (interactive.includes(role)) {
      const hasTabIndex = element.tabindex !== undefined;
      const isNativelyFocusable = ['button', 'input', 'select', 'textarea', 'a'].includes(
        element.tagName
      );

      if (!hasTabIndex && !isNativelyFocusable) {
        this.addIssue({
          type: 'keyboard-access',
          element,
          message: 'Interactive element is not keyboard accessible',
          severity: 'error',
          wcag: '2.1.1'
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Check semantic HTML
   */
  checkSemantics(element) {
    const semanticElements = ['header', 'nav', 'main', 'article', 'section', 'aside', 'footer'];

    // Check for divitis (excessive div usage)
    if (element.tagName === 'div' && !element.role) {
      this.addIssue({
        type: 'semantic-hint',
        element,
        message: 'Consider using semantic HTML5 elements instead of div',
        severity: 'warning',
        wcag: '1.3.1'
      });
      return false;
    }

    return true;
  }

  /**
   * Check element
   */
  checkElement(element) {
    const results = {
      valid: true,
      issues: []
    };

    // ARIA validation
    if (this.config.checkSemantics) {
      const ariaValidation = this.validator.validateElement(element);
      if (!ariaValidation.valid) {
        results.valid = false;
        results.issues.push(...ariaValidation.issues);
      }
    }

    // Label check
    if (this.config.checkLabels) {
      this.checkLabel(element);
    }

    // Keyboard access
    if (this.config.checkKeyboard) {
      this.checkKeyboardAccess(element);
    }

    // Semantics
    if (this.config.checkSemantics) {
      this.checkSemantics(element);
    }

    return results;
  }

  /**
   * Add issue
   */
  addIssue(issue) {
    this.issues.push({
      ...issue,
      timestamp: Date.now()
    });

    this.emit('issue', issue);
  }

  /**
   * Get issues by severity
   */
  getIssuesBySeverity(severity) {
    return this.issues.filter((i) => i.severity === severity);
  }

  /**
   * Get issues by WCAG criterion
   */
  getIssuesByWCAG(wcag) {
    return this.issues.filter((i) => i.wcag === wcag);
  }

  /**
   * Get report
   */
  getReport() {
    const errors = this.getIssuesBySeverity('error');
    const warnings = this.getIssuesBySeverity('warning');

    return {
      totalIssues: this.issues.length,
      errors: errors.length,
      warnings: warnings.length,
      level: this.config.level,
      issues: this.issues
    };
  }

  /**
   * Clear issues
   */
  clear() {
    this.issues = [];
  }
}

/**
 * Screen Reader Announcer
 */
class ScreenReaderAnnouncer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      polite: true, // Use aria-live="polite" by default
      ...options
    };

    this.announcements = [];
    this.queue = [];
  }

  /**
   * Announce message
   */
  announce(message, priority = 'polite') {
    const announcement = {
      message,
      priority, // 'polite' or 'assertive'
      timestamp: Date.now()
    };

    this.announcements.push(announcement);
    this.emit('announce', announcement);

    return announcement;
  }

  /**
   * Announce with delay
   */
  announceDelayed(message, delay = 1000, priority = 'polite') {
    setTimeout(() => {
      this.announce(message, priority);
    }, delay);
  }

  /**
   * Get announcement history
   */
  getHistory() {
    return [...this.announcements];
  }

  /**
   * Clear history
   */
  clear() {
    this.announcements = [];
  }
}

/**
 * Keyboard Navigation Manager
 */
class KeyboardNavigationManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      trapFocus: false,
      skipLinks: true,
      shortcuts: {},
      ...options
    };

    this.focusHistory = [];
    this.shortcuts = new Map(Object.entries(this.config.shortcuts));
    this.focusTrap = null;
  }

  /**
   * Track focus change
   */
  trackFocus(element) {
    this.focusHistory.push({
      element,
      timestamp: Date.now()
    });

    this.emit('focus', element);
  }

  /**
   * Set focus trap
   */
  setFocusTrap(container) {
    this.focusTrap = container;
    this.emit('focus-trap-set', container);
  }

  /**
   * Clear focus trap
   */
  clearFocusTrap() {
    this.focusTrap = null;
    this.emit('focus-trap-cleared');
  }

  /**
   * Register keyboard shortcut
   */
  registerShortcut(key, handler, description = '') {
    this.shortcuts.set(key, {
      handler,
      description,
      key
    });

    this.emit('shortcut-registered', { key, description });
  }

  /**
   * Unregister shortcut
   */
  unregisterShortcut(key) {
    const existed = this.shortcuts.delete(key);
    if (existed) {
      this.emit('shortcut-unregistered', key);
    }
    return existed;
  }

  /**
   * Get all shortcuts
   */
  getShortcuts() {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Get focus history
   */
  getFocusHistory() {
    return [...this.focusHistory];
  }

  /**
   * Clear history
   */
  clear() {
    this.focusHistory = [];
  }
}

/**
 * Accessibility Manager
 */
class AccessibilityManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      wcagLevel: 'AA',
      enableChecker: true,
      enableAnnouncer: true,
      enableKeyboard: true,
      ...options
    };

    // Initialize components
    this.checker = this.config.enableChecker
      ? new AccessibilityChecker({ level: this.config.wcagLevel })
      : null;

    this.announcer = this.config.enableAnnouncer ? new ScreenReaderAnnouncer() : null;

    this.keyboard = this.config.enableKeyboard ? new KeyboardNavigationManager() : null;

    // Setup event forwarding
    this.setupEventForwarding();
  }

  /**
   * Setup event forwarding
   */
  setupEventForwarding() {
    if (this.checker) {
      this.checker.on('issue', (issue) => this.emit('checker:issue', issue));
    }

    if (this.announcer) {
      this.announcer.on('announce', (announcement) => this.emit('announcer:announce', announcement));
    }

    if (this.keyboard) {
      this.keyboard.on('focus', (element) => this.emit('keyboard:focus', element));
      this.keyboard.on('shortcut-registered', (data) =>
        this.emit('keyboard:shortcut-registered', data)
      );
    }
  }

  /**
   * Get accessibility report
   */
  getReport() {
    return {
      checker: this.checker ? this.checker.getReport() : null,
      announcements: this.announcer ? this.announcer.getHistory().length : 0,
      shortcuts: this.keyboard ? this.keyboard.getShortcuts().length : 0,
      wcagLevel: this.config.wcagLevel
    };
  }

  /**
   * Clear all data
   */
  clearAll() {
    if (this.checker) this.checker.clear();
    if (this.announcer) this.announcer.clear();
    if (this.keyboard) this.keyboard.clear();
  }

  /**
   * Destroy manager
   */
  destroy() {
    if (this.checker) this.checker.removeAllListeners();
    if (this.announcer) this.announcer.removeAllListeners();
    if (this.keyboard) this.keyboard.removeAllListeners();

    this.removeAllListeners();
  }
}

module.exports = {
  ARIAValidator,
  AccessibilityChecker,
  ScreenReaderAnnouncer,
  KeyboardNavigationManager,
  AccessibilityManager
};
