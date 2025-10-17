/**
 * View Transitions API Manager
 *
 * Implements smooth page transitions using the View Transitions API.
 * Based on 2025 browser specifications for seamless SPA navigation.
 *
 * Features:
 * - Automatic smooth transitions between pages
 * - Custom transition animations
 * - Fallback for unsupported browsers
 * - Cross-document transitions (Chrome 126+)
 * - Animation customization per element
 *
 * Performance Benefits:
 * - Smooth 60fps transitions
 * - Native browser optimization
 * - Reduced layout thrashing
 * - GPU-accelerated animations
 *
 * Browser Support (2025):
 * - Chrome 111+ (same-document)
 * - Chrome 126+ (cross-document)
 * - Edge 111+
 * - Safari (in development)
 * - Firefox (in development)
 *
 * @module ViewTransitionsManager
 * @version 1.0.0
 */

class ViewTransitionsManager {
  constructor(options = {}) {
    this.options = {
      // Enable/disable features
      enabled: options.enabled !== false,
      fallbackEnabled: options.fallbackEnabled !== false,

      // Transition settings
      defaultDuration: options.defaultDuration || 300,
      defaultEasing: options.defaultEasing || 'ease-in-out',

      // Selectors
      transitionElements: options.transitionElements || '[data-transition]',
      skipElements: options.skipElements || ['script', 'style', 'link'],

      // Callbacks
      onStart: options.onStart || null,
      onFinish: options.onFinish || null,
      onError: options.onError || null,

      // Custom transitions
      customTransitions: options.customTransitions || {},

      ...options
    };

    this.isSupported = this.checkSupport();
    this.activeTransition = null;
    this.transitionQueue = [];

    this.stats = {
      transitionsPerformed: 0,
      averageDuration: 0,
      totalDuration: 0,
      errors: 0
    };
  }

  /**
   * Check if View Transitions API is supported
   */
  checkSupport() {
    return (
      typeof document !== 'undefined' &&
      'startViewTransition' in document
    );
  }

  /**
   * Initialize the manager
   */
  initialize() {
    if (!this.options.enabled) {
      return;
    }

    // Add CSS for transitions
    this.injectCSS();

    // Set up event listeners for SPA navigation
    this.setupNavigationListeners();

    // Dispatch event
    this.dispatchEvent('initialized', { isSupported: this.isSupported });
  }

  /**
   * Inject CSS for view transitions
   */
  injectCSS() {
    const style = document.createElement('style');
    style.id = 'view-transitions-styles';
    style.textContent = `
      /* Default view transition animations */
      ::view-transition-old(root) {
        animation: ${this.options.defaultDuration}ms ${this.options.defaultEasing} both fade-out;
      }

      ::view-transition-new(root) {
        animation: ${this.options.defaultDuration}ms ${this.options.defaultEasing} both fade-in;
      }

      @keyframes fade-out {
        from { opacity: 1; }
        to { opacity: 0; }
      }

      @keyframes fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      /* Slide transitions */
      ::view-transition-old(slide-left) {
        animation: ${this.options.defaultDuration}ms ${this.options.defaultEasing} both slide-out-left;
      }

      ::view-transition-new(slide-left) {
        animation: ${this.options.defaultDuration}ms ${this.options.defaultEasing} both slide-in-right;
      }

      @keyframes slide-out-left {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(-100%); opacity: 0; }
      }

      @keyframes slide-in-right {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }

      /* Scale transitions */
      ::view-transition-old(scale) {
        animation: ${this.options.defaultDuration}ms ${this.options.defaultEasing} both scale-out;
      }

      ::view-transition-new(scale) {
        animation: ${this.options.defaultDuration}ms ${this.options.defaultEasing} both scale-in;
      }

      @keyframes scale-out {
        from { transform: scale(1); opacity: 1; }
        to { transform: scale(0.8); opacity: 0; }
      }

      @keyframes scale-in {
        from { transform: scale(1.2); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Set up navigation listeners for SPA
   */
  setupNavigationListeners() {
    // Handle popstate (browser back/forward)
    window.addEventListener('popstate', (event) => {
      if (event.state && event.state.url) {
        this.transitionToPage(event.state.url);
      }
    });

    // Intercept link clicks
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a');

      if (!link || !link.href) {
        return;
      }

      // Only handle same-origin links
      const url = new URL(link.href);
      if (url.origin !== window.location.origin) {
        return;
      }

      // Check if link has data-no-transition
      if (link.hasAttribute('data-no-transition')) {
        return;
      }

      event.preventDefault();
      this.navigateToURL(url.href);
    });
  }

  /**
   * Navigate to a URL with transition
   */
  async navigateToURL(url, options = {}) {
    try {
      // Update browser history
      history.pushState({ url }, '', url);

      // Perform transition
      await this.transitionToPage(url, options);
    } catch (error) {
      this.stats.errors++;
      if (this.options.onError) {
        this.options.onError(error);
      }
      // Fallback to normal navigation
      window.location.href = url;
    }
  }

  /**
   * Transition to a new page
   */
  async transitionToPage(url, options = {}) {
    const startTime = Date.now();

    try {
      // Fetch new page content
      const response = await fetch(url);
      const html = await response.text();

      // Parse HTML
      const parser = new DOMParser();
      const newDocument = parser.parseFromString(html, 'text/html');

      // Perform transition
      await this.performTransition(() => {
        this.updateDOM(newDocument);
      }, options);

      const duration = Date.now() - startTime;
      this.stats.transitionsPerformed++;
      this.stats.totalDuration += duration;
      this.stats.averageDuration = this.stats.totalDuration / this.stats.transitionsPerformed;

      this.dispatchEvent('transitionComplete', { url, duration });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Perform a view transition
   */
  async performTransition(updateCallback, options = {}) {
    if (!this.isSupported) {
      // Fallback for unsupported browsers
      if (this.options.fallbackEnabled) {
        return this.performFallbackTransition(updateCallback, options);
      } else {
        updateCallback();
        return;
      }
    }

    try {
      // Start transition
      const transition = document.startViewTransition(() => {
        updateCallback();
        this.applyTransitionNames(options.transitionNames);
      });

      this.activeTransition = transition;

      if (this.options.onStart) {
        this.options.onStart(transition);
      }

      // Wait for transition to complete
      await transition.finished;

      if (this.options.onFinish) {
        this.options.onFinish(transition);
      }

      this.activeTransition = null;
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Apply transition names to elements
   */
  applyTransitionNames(transitionNames = {}) {
    // Apply custom transition names
    for (const [selector, name] of Object.entries(transitionNames)) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        element.style.viewTransitionName = name;
      });
    }

    // Apply from data attributes
    const transitionElements = document.querySelectorAll(this.options.transitionElements);
    transitionElements.forEach(element => {
      const name = element.getAttribute('data-transition');
      if (name) {
        element.style.viewTransitionName = name;
      }
    });
  }

  /**
   * Update DOM with new content
   */
  updateDOM(newDocument) {
    // Update title
    document.title = newDocument.title;

    // Update meta tags
    this.updateMetaTags(newDocument);

    // Update body content
    const newBody = newDocument.body;
    const currentBody = document.body;

    // Copy classes
    currentBody.className = newBody.className;

    // Copy content
    currentBody.innerHTML = newBody.innerHTML;

    // Re-execute scripts if needed
    this.executeScripts(currentBody);
  }

  /**
   * Update meta tags
   */
  updateMetaTags(newDocument) {
    const newMetas = newDocument.querySelectorAll('meta');
    const currentMetas = document.querySelectorAll('meta');

    // Remove old metas
    currentMetas.forEach(meta => {
      if (meta.name || meta.property) {
        meta.remove();
      }
    });

    // Add new metas
    newMetas.forEach(meta => {
      if (meta.name || meta.property) {
        document.head.appendChild(meta.cloneNode(true));
      }
    });
  }

  /**
   * Execute scripts in new content
   */
  executeScripts(container) {
    const scripts = container.querySelectorAll('script');

    scripts.forEach(oldScript => {
      const newScript = document.createElement('script');

      // Copy attributes
      Array.from(oldScript.attributes).forEach(attr => {
        newScript.setAttribute(attr.name, attr.value);
      });

      // Copy content
      newScript.textContent = oldScript.textContent;

      // Replace old script with new one
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }

  /**
   * Fallback transition for unsupported browsers
   */
  async performFallbackTransition(updateCallback, options = {}) {
    const duration = options.duration || this.options.defaultDuration;

    // Fade out
    document.body.style.transition = `opacity ${duration}ms ${this.options.defaultEasing}`;
    document.body.style.opacity = '0';

    await this.wait(duration);

    // Update content
    updateCallback();

    // Fade in
    document.body.style.opacity = '1';

    await this.wait(duration);

    // Clean up
    document.body.style.transition = '';
  }

  /**
   * Transition a specific element
   */
  async transitionElement(element, updateCallback, transitionName = 'element') {
    if (!this.isSupported) {
      updateCallback(element);
      return;
    }

    // Set transition name
    element.style.viewTransitionName = transitionName;

    try {
      await this.performTransition(() => {
        updateCallback(element);
      });
    } finally {
      // Clean up
      element.style.viewTransitionName = '';
    }
  }

  /**
   * Create a custom transition
   */
  createCustomTransition(name, cssRules) {
    const style = document.createElement('style');
    style.textContent = cssRules;
    document.head.appendChild(style);

    this.options.customTransitions[name] = style;

    return () => {
      style.remove();
      delete this.options.customTransitions[name];
    };
  }

  /**
   * Skip transition and update immediately
   */
  skipTransition(updateCallback) {
    if (this.activeTransition) {
      this.activeTransition.skipTransition();
    }
    updateCallback();
  }

  /**
   * Wait helper
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      isSupported: this.isSupported,
      activeTransition: this.activeTransition !== null
    };
  }

  /**
   * Dispatch custom event
   */
  dispatchEvent(name, detail = {}) {
    const event = new CustomEvent(`viewtransition:${name}`, {
      detail,
      bubbles: true
    });

    document.dispatchEvent(event);
  }

  /**
   * Cleanup
   */
  cleanup() {
    // Remove custom transition styles
    for (const style of Object.values(this.options.customTransitions)) {
      if (style && style.remove) {
        style.remove();
      }
    }

    // Remove injected CSS
    const style = document.getElementById('view-transitions-styles');
    if (style) {
      style.remove();
    }

    this.dispatchEvent('cleanup');
  }
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.ViewTransitionsManager = ViewTransitionsManager;

  // Auto-initialize on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (window.viewTransitionsConfig) {
        const manager = new ViewTransitionsManager(window.viewTransitionsConfig);
        manager.initialize();
        window.viewTransitionsManager = manager;
      }
    });
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ViewTransitionsManager;
}
