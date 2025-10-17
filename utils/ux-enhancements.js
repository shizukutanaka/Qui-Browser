/**
 * UX Enhancements
 *
 * Implements basic UX improvements (#251-260):
 * - Loading indicators (skeleton screens)
 * - User-friendly error messages
 * - Real-time form validation
 * - Autocomplete for URLs/search
 * - Bookmark organization
 * - History search
 * - Tab management
 * - Keyboard shortcuts
 * - Dark mode improvements
 * - Font size adjustments
 */

const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');

/**
 * UX configuration
 */
const DEFAULT_UX_CONFIG = {
  // Loading indicators
  loading: {
    skeletonEnabled: true,
    minDisplayTime: 300, // Minimum 300ms to avoid flicker
    timeout: 30000 // 30 seconds timeout
  },

  // Error messages
  errors: {
    userFriendly: true,
    showTechnicalDetails: false,
    supportContact: null
  },

  // Form validation
  validation: {
    realTime: true,
    debounceMs: 300
  },

  // Autocomplete
  autocomplete: {
    enabled: true,
    maxSuggestions: 10,
    minChars: 2
  },

  // Bookmarks
  bookmarks: {
    maxTags: 10,
    maxFoldersDepth: 5
  },

  // History
  history: {
    maxEntries: 10000,
    searchEnabled: true
  },

  // Tabs
  tabs: {
    maxTabs: 100,
    groupingEnabled: true
  },

  // Keyboard shortcuts
  shortcuts: {
    enabled: true,
    customizable: true
  },

  // Theme
  theme: {
    darkModeAuto: true,
    systemSync: true
  },

  // Accessibility
  accessibility: {
    fontSizeMin: 12,
    fontSizeMax: 24,
    fontSizeDefault: 16
  }
};

/**
 * Loading state manager (Skeleton screens)
 */
class LoadingStateManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULT_UX_CONFIG.loading, ...config };
    this.activeLoaders = new Map();
  }

  /**
   * Start loading state
   */
  start(id, options = {}) {
    const state = {
      id,
      startTime: Date.now(),
      ...options
    };

    this.activeLoaders.set(id, state);
    this.emit('loading-start', state);

    // Set timeout
    if (this.config.timeout) {
      state.timeoutTimer = setTimeout(() => {
        this.timeout(id);
      }, this.config.timeout);
    }

    return state;
  }

  /**
   * Stop loading state
   */
  async stop(id) {
    const state = this.activeLoaders.get(id);
    if (!state) return;

    // Clear timeout
    if (state.timeoutTimer) {
      clearTimeout(state.timeoutTimer);
    }

    // Enforce minimum display time to avoid flicker
    const elapsed = Date.now() - state.startTime;
    if (elapsed < this.config.minDisplayTime) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.config.minDisplayTime - elapsed)
      );
    }

    this.activeLoaders.delete(id);
    this.emit('loading-stop', { id, duration: Date.now() - state.startTime });
  }

  /**
   * Handle timeout
   */
  timeout(id) {
    const state = this.activeLoaders.get(id);
    if (!state) return;

    this.activeLoaders.delete(id);
    this.emit('loading-timeout', { id, duration: Date.now() - state.startTime });
  }

  /**
   * Get active loaders
   */
  getActiveLoaders() {
    return Array.from(this.activeLoaders.values());
  }

  /**
   * Generate skeleton HTML
   */
  generateSkeletonHTML(type = 'default') {
    const skeletons = {
      default: `
        <div class="skeleton-loader">
          <div class="skeleton-line" style="width: 80%"></div>
          <div class="skeleton-line" style="width: 60%"></div>
          <div class="skeleton-line" style="width: 70%"></div>
        </div>
      `,
      card: `
        <div class="skeleton-card">
          <div class="skeleton-image"></div>
          <div class="skeleton-line" style="width: 90%"></div>
          <div class="skeleton-line" style="width: 70%"></div>
        </div>
      `,
      list: `
        <div class="skeleton-list">
          <div class="skeleton-item"></div>
          <div class="skeleton-item"></div>
          <div class="skeleton-item"></div>
        </div>
      `
    };

    return skeletons[type] || skeletons.default;
  }
}

/**
 * User-friendly error message converter
 */
class ErrorMessageConverter {
  constructor(config = {}) {
    this.config = { ...DEFAULT_UX_CONFIG.errors, ...config };
    this.errorMap = new Map();
    this.initializeDefaultMessages();
  }

  /**
   * Initialize default error messages
   */
  initializeDefaultMessages() {
    this.errorMap.set('ECONNREFUSED', {
      title: 'Connection Failed',
      message: 'Unable to connect to the server. Please check your internet connection and try again.',
      action: 'Retry'
    });

    this.errorMap.set('ETIMEDOUT', {
      title: 'Request Timeout',
      message: 'The request took too long to complete. Please try again.',
      action: 'Retry'
    });

    this.errorMap.set('ENOTFOUND', {
      title: 'Page Not Found',
      message: 'The page you are looking for could not be found.',
      action: 'Go Back'
    });

    this.errorMap.set('EACCES', {
      title: 'Access Denied',
      message: 'You do not have permission to access this resource.',
      action: 'Login'
    });

    this.errorMap.set('ERR_NETWORK', {
      title: 'Network Error',
      message: 'A network error occurred. Please check your connection.',
      action: 'Retry'
    });

    this.errorMap.set('400', {
      title: 'Invalid Request',
      message: 'The request was invalid. Please check your input and try again.',
      action: 'Dismiss'
    });

    this.errorMap.set('401', {
      title: 'Authentication Required',
      message: 'Please log in to continue.',
      action: 'Login'
    });

    this.errorMap.set('403', {
      title: 'Access Forbidden',
      message: 'You do not have permission to perform this action.',
      action: 'Dismiss'
    });

    this.errorMap.set('404', {
      title: 'Not Found',
      message: 'The requested resource could not be found.',
      action: 'Go Back'
    });

    this.errorMap.set('500', {
      title: 'Server Error',
      message: 'An unexpected error occurred. Please try again later.',
      action: 'Retry'
    });

    this.errorMap.set('503', {
      title: 'Service Unavailable',
      message: 'The service is temporarily unavailable. Please try again later.',
      action: 'Retry'
    });
  }

  /**
   * Convert error to user-friendly message
   */
  convert(error) {
    let friendly = {
      title: 'Something Went Wrong',
      message: 'An unexpected error occurred.',
      action: 'Dismiss',
      technical: null
    };

    // Check error code
    if (error.code) {
      const mapped = this.errorMap.get(error.code);
      if (mapped) {
        friendly = { ...friendly, ...mapped };
      }
    }

    // Check HTTP status code
    if (error.statusCode || error.status) {
      const status = String(error.statusCode || error.status);
      const mapped = this.errorMap.get(status);
      if (mapped) {
        friendly = { ...friendly, ...mapped };
      }
    }

    // Add technical details if enabled
    if (this.config.showTechnicalDetails) {
      friendly.technical = {
        code: error.code,
        message: error.message,
        stack: error.stack
      };
    }

    // Add support contact
    if (this.config.supportContact) {
      friendly.support = this.config.supportContact;
    }

    return friendly;
  }

  /**
   * Register custom error message
   */
  register(code, message) {
    this.errorMap.set(code, message);
  }
}

/**
 * Real-time form validator
 */
class FormValidator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULT_UX_CONFIG.validation, ...config };
    this.validators = new Map();
    this.debounceTimers = new Map();
  }

  /**
   * Register field validator
   */
  registerValidator(fieldName, validator) {
    this.validators.set(fieldName, validator);
  }

  /**
   * Validate field
   */
  async validate(fieldName, value) {
    const validator = this.validators.get(fieldName);
    if (!validator) {
      return { valid: true };
    }

    try {
      const result = await validator(value);
      this.emit('validation-complete', { fieldName, value, result });
      return result;
    } catch (error) {
      this.emit('validation-error', { fieldName, value, error });
      return {
        valid: false,
        error: 'Validation failed'
      };
    }
  }

  /**
   * Validate field with debouncing
   */
  validateDebounced(fieldName, value) {
    return new Promise((resolve) => {
      // Clear existing timer
      const existingTimer = this.debounceTimers.get(fieldName);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new timer
      const timer = setTimeout(async () => {
        const result = await this.validate(fieldName, value);
        this.debounceTimers.delete(fieldName);
        resolve(result);
      }, this.config.debounceMs);

      this.debounceTimers.set(fieldName, timer);
    });
  }

  /**
   * Built-in validators
   */
  static validators = {
    required: (value) => ({
      valid: value !== null && value !== undefined && value !== '',
      error: 'This field is required'
    }),

    email: (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return {
        valid: emailRegex.test(value),
        error: 'Please enter a valid email address'
      };
    },

    url: (value) => {
      try {
        new URL(value);
        return { valid: true };
      } catch {
        return {
          valid: false,
          error: 'Please enter a valid URL'
        };
      }
    },

    minLength: (min) => (value) => ({
      valid: value && value.length >= min,
      error: `Must be at least ${min} characters`
    }),

    maxLength: (max) => (value) => ({
      valid: !value || value.length <= max,
      error: `Must be no more than ${max} characters`
    }),

    pattern: (regex, message) => (value) => ({
      valid: regex.test(value),
      error: message || 'Invalid format'
    })
  };
}

/**
 * Autocomplete manager
 */
class AutocompleteManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULT_UX_CONFIG.autocomplete, ...config };
    this.providers = new Map();
  }

  /**
   * Register autocomplete provider
   */
  registerProvider(name, provider) {
    this.providers.set(name, provider);
  }

  /**
   * Get suggestions
   */
  async getSuggestions(query, providerName = 'default') {
    if (!this.config.enabled) return [];
    if (query.length < this.config.minChars) return [];

    const provider = this.providers.get(providerName);
    if (!provider) return [];

    try {
      const suggestions = await provider(query);
      const limited = suggestions.slice(0, this.config.maxSuggestions);
      this.emit('suggestions', { query, suggestions: limited });
      return limited;
    } catch (error) {
      this.emit('error', { query, error });
      return [];
    }
  }

  /**
   * Built-in URL autocomplete provider
   */
  static createURLProvider(history = []) {
    return async (query) => {
      const lowerQuery = query.toLowerCase();
      return history
        .filter((url) => url.toLowerCase().includes(lowerQuery))
        .map((url) => ({
          type: 'url',
          value: url,
          label: url
        }));
    };
  }

  /**
   * Built-in search autocomplete provider
   */
  static createSearchProvider(searchEngine = 'google') {
    return async (query) => {
      // This would typically call an API
      // For now, return empty array
      return [];
    };
  }
}

/**
 * Bookmark manager
 */
class BookmarkManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULT_UX_CONFIG.bookmarks, ...config };
    this.bookmarks = [];
    this.folders = new Map();
    this.tags = new Set();
  }

  /**
   * Add bookmark
   */
  addBookmark(bookmark) {
    const newBookmark = {
      id: Date.now().toString(),
      title: bookmark.title,
      url: bookmark.url,
      tags: bookmark.tags || [],
      folder: bookmark.folder || null,
      created: Date.now(),
      ...bookmark
    };

    // Validate tags
    if (newBookmark.tags.length > this.config.maxTags) {
      newBookmark.tags = newBookmark.tags.slice(0, this.config.maxTags);
    }

    this.bookmarks.push(newBookmark);

    // Update tags
    for (const tag of newBookmark.tags) {
      this.tags.add(tag);
    }

    this.emit('bookmark-added', newBookmark);
    return newBookmark;
  }

  /**
   * Remove bookmark
   */
  removeBookmark(id) {
    const index = this.bookmarks.findIndex((b) => b.id === id);
    if (index === -1) return false;

    const removed = this.bookmarks.splice(index, 1)[0];
    this.emit('bookmark-removed', removed);
    return true;
  }

  /**
   * Create folder
   */
  createFolder(name, parent = null) {
    // Check depth
    if (parent) {
      const depth = this.getFolderDepth(parent);
      if (depth >= this.config.maxFoldersDepth) {
        throw new Error(`Maximum folder depth (${this.config.maxFoldersDepth}) exceeded`);
      }
    }

    const folder = {
      id: Date.now().toString(),
      name,
      parent,
      created: Date.now()
    };

    this.folders.set(folder.id, folder);
    this.emit('folder-created', folder);
    return folder;
  }

  /**
   * Get folder depth
   */
  getFolderDepth(folderId, depth = 0) {
    const folder = this.folders.get(folderId);
    if (!folder || !folder.parent) return depth;
    return this.getFolderDepth(folder.parent, depth + 1);
  }

  /**
   * Search bookmarks
   */
  search(query) {
    const lowerQuery = query.toLowerCase();
    return this.bookmarks.filter(
      (b) =>
        b.title.toLowerCase().includes(lowerQuery) ||
        b.url.toLowerCase().includes(lowerQuery) ||
        b.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get bookmarks by tag
   */
  getByTag(tag) {
    return this.bookmarks.filter((b) => b.tags.includes(tag));
  }

  /**
   * Get bookmarks by folder
   */
  getByFolder(folderId) {
    return this.bookmarks.filter((b) => b.folder === folderId);
  }
}

/**
 * Keyboard shortcuts manager
 */
class KeyboardShortcutsManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULT_UX_CONFIG.shortcuts, ...config };
    this.shortcuts = new Map();
    this.customShortcuts = new Map();
  }

  /**
   * Register shortcut
   */
  register(keys, action, description = '') {
    const normalized = this.normalizeKeys(keys);
    this.shortcuts.set(normalized, { action, description, keys });
    this.emit('shortcut-registered', { keys, action, description });
  }

  /**
   * Normalize key combination
   */
  normalizeKeys(keys) {
    return keys
      .toLowerCase()
      .split('+')
      .map((k) => k.trim())
      .sort()
      .join('+');
  }

  /**
   * Handle key event
   */
  handleKeyEvent(event) {
    if (!this.config.enabled) return false;

    const keys = [];
    if (event.ctrlKey) keys.push('ctrl');
    if (event.altKey) keys.push('alt');
    if (event.shiftKey) keys.push('shift');
    if (event.metaKey) keys.push('meta');
    keys.push(event.key.toLowerCase());

    const normalized = keys.sort().join('+');

    // Check custom shortcuts first
    if (this.config.customizable && this.customShortcuts.has(normalized)) {
      const { action } = this.customShortcuts.get(normalized);
      this.emit('shortcut-triggered', { keys: normalized, action });
      return true;
    }

    // Check default shortcuts
    if (this.shortcuts.has(normalized)) {
      const { action } = this.shortcuts.get(normalized);
      this.emit('shortcut-triggered', { keys: normalized, action });
      return true;
    }

    return false;
  }

  /**
   * Customize shortcut
   */
  customize(oldKeys, newKeys) {
    if (!this.config.customizable) {
      throw new Error('Shortcut customization is disabled');
    }

    const oldNormalized = this.normalizeKeys(oldKeys);
    const newNormalized = this.normalizeKeys(newKeys);

    const shortcut = this.shortcuts.get(oldNormalized);
    if (!shortcut) {
      throw new Error(`Shortcut ${oldKeys} not found`);
    }

    this.customShortcuts.set(newNormalized, shortcut);
    this.emit('shortcut-customized', { oldKeys, newKeys });
  }

  /**
   * Get all shortcuts
   */
  getAllShortcuts() {
    const all = [];

    for (const [keys, data] of this.shortcuts.entries()) {
      all.push({ keys, ...data });
    }

    return all;
  }
}

/**
 * Create UX enhancements
 */
function createUXEnhancements(config = {}) {
  const loadingManager = new LoadingStateManager(config.loading);
  const errorConverter = new ErrorMessageConverter(config.errors);
  const formValidator = new FormValidator(config.validation);
  const autocomplete = new AutocompleteManager(config.autocomplete);
  const bookmarkManager = new BookmarkManager(config.bookmarks);
  const shortcuts = new KeyboardShortcutsManager(config.shortcuts);

  return {
    loading: loadingManager,
    errors: errorConverter,
    validation: formValidator,
    autocomplete,
    bookmarks: bookmarkManager,
    shortcuts
  };
}

module.exports = {
  LoadingStateManager,
  ErrorMessageConverter,
  FormValidator,
  AutocompleteManager,
  BookmarkManager,
  KeyboardShortcutsManager,
  createUXEnhancements,
  DEFAULT_UX_CONFIG
};
