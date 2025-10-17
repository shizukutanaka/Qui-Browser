/**
 * Error Boundary System
 *
 * Implements stability improvements (#321-323):
 * - Error boundaries for graceful error handling
 * - Fallback UI for error states
 * - Graceful degradation of features
 */

const { EventEmitter } = require('events');

/**
 * Error boundary configuration
 */
const DEFAULT_ERROR_BOUNDARY_CONFIG = {
  // Error handling
  catchErrors: true,
  logErrors: true,
  reportErrors: false,
  errorReportingEndpoint: null,

  // Recovery
  maxRetries: 3,
  retryDelay: 1000,
  resetOnSuccess: true,

  // Fallback
  fallbackEnabled: true,
  fallbackTimeout: 5000,

  // Degradation
  degradationEnabled: true,
  featureLevels: ['full', 'limited', 'minimal', 'disabled']
};

/**
 * Error boundary
 */
class ErrorBoundary extends EventEmitter {
  constructor(name, config = {}) {
    super();
    this.name = name;
    this.config = { ...DEFAULT_ERROR_BOUNDARY_CONFIG, ...config };

    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
      lastError: null,
      retryCount: 0
    };

    this.fallbackFn = null;
    this.componentFn = null;
  }

  /**
   * Set component function
   */
  setComponent(fn) {
    this.componentFn = fn;
  }

  /**
   * Set fallback function
   */
  setFallback(fn) {
    this.fallbackFn = fn;
  }

  /**
   * Execute component with error handling
   */
  async execute(...args) {
    if (!this.config.catchErrors) {
      return await this.componentFn(...args);
    }

    try {
      const result = await this.componentFn(...args);

      // Reset on success
      if (this.config.resetOnSuccess && this.state.hasError) {
        this.reset();
      }

      return result;
    } catch (error) {
      return await this.handleError(error, args);
    }
  }

  /**
   * Handle error
   */
  async handleError(error, args = []) {
    this.state.hasError = true;
    this.state.error = error;
    this.state.errorCount++;
    this.state.lastError = Date.now();

    // Log error
    if (this.config.logErrors) {
      console.error(`[ErrorBoundary:${this.name}]`, error);
    }

    // Report error
    if (this.config.reportErrors && this.config.errorReportingEndpoint) {
      await this.reportError(error);
    }

    // Emit error event
    this.emit('error', {
      name: this.name,
      error,
      errorCount: this.state.errorCount,
      retryCount: this.state.retryCount
    });

    // Try recovery
    if (this.state.retryCount < this.config.maxRetries) {
      return await this.retry(args);
    }

    // Use fallback
    if (this.config.fallbackEnabled && this.fallbackFn) {
      return await this.useFallback(error, args);
    }

    // Re-throw if no fallback
    throw error;
  }

  /**
   * Retry execution
   */
  async retry(args) {
    this.state.retryCount++;
    this.emit('retry', {
      name: this.name,
      retryCount: this.state.retryCount,
      maxRetries: this.config.maxRetries
    });

    // Wait before retry
    await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));

    return await this.execute(...args);
  }

  /**
   * Use fallback
   */
  async useFallback(error, args) {
    this.emit('fallback', {
      name: this.name,
      error,
      args
    });

    try {
      return await this.fallbackFn(error, ...args);
    } catch (fallbackError) {
      console.error(`[ErrorBoundary:${this.name}] Fallback failed:`, fallbackError);
      throw error; // Throw original error
    }
  }

  /**
   * Report error to endpoint
   */
  async reportError(error) {
    try {
      const report = {
        boundary: this.name,
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code
        },
        timestamp: Date.now(),
        errorCount: this.state.errorCount,
        retryCount: this.state.retryCount
      };

      // This would typically send to an error reporting service
      // For now, just log it
      if (this.config.logErrors) {
        console.log('[ErrorReport]', JSON.stringify(report, null, 2));
      }
    } catch (reportError) {
      console.error('[ErrorBoundary] Failed to report error:', reportError);
    }
  }

  /**
   * Reset boundary state
   */
  reset() {
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
      lastError: null,
      retryCount: 0
    };

    this.emit('reset', { name: this.name });
  }

  /**
   * Get state
   */
  getState() {
    return { ...this.state };
  }
}

/**
 * Fallback UI generator
 */
class FallbackUIGenerator {
  constructor() {
    this.templates = new Map();
    this.initializeDefaultTemplates();
  }

  /**
   * Initialize default templates
   */
  initializeDefaultTemplates() {
    this.templates.set('default', (error) => ({
      html: `
        <div class="error-fallback">
          <h2>Something went wrong</h2>
          <p>We encountered an unexpected error. Please try again.</p>
          <button onclick="location.reload()">Reload Page</button>
        </div>
      `,
      css: `
        .error-fallback {
          padding: 2rem;
          text-align: center;
          background: #fee;
          border: 1px solid #fcc;
          border-radius: 8px;
          margin: 1rem;
        }
        .error-fallback h2 {
          color: #c00;
          margin-bottom: 1rem;
        }
        .error-fallback button {
          padding: 0.5rem 1rem;
          background: #c00;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
      `
    }));

    this.templates.set('minimal', (error) => ({
      html: `
        <div class="error-minimal">
          <p>⚠️ An error occurred</p>
        </div>
      `,
      css: `
        .error-minimal {
          padding: 0.5rem;
          background: #fee;
          border-left: 4px solid #c00;
          margin: 0.5rem 0;
        }
      `
    }));

    this.templates.set('detailed', (error) => ({
      html: `
        <div class="error-detailed">
          <h2>Error Details</h2>
          <p class="error-message">${this.escapeHTML(error.message)}</p>
          <details>
            <summary>Technical Information</summary>
            <pre class="error-stack">${this.escapeHTML(error.stack || '')}</pre>
          </details>
          <button onclick="location.reload()">Reload</button>
        </div>
      `,
      css: `
        .error-detailed {
          padding: 1.5rem;
          background: #fff5f5;
          border: 1px solid #feb2b2;
          border-radius: 8px;
          margin: 1rem;
        }
        .error-message {
          font-weight: bold;
          color: #c00;
        }
        .error-stack {
          background: #f7f7f7;
          padding: 1rem;
          overflow-x: auto;
          font-size: 0.875rem;
        }
      `
    }));
  }

  /**
   * Escape HTML
   */
  escapeHTML(str) {
    const div = { textContent: str };
    return div.textContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Register template
   */
  registerTemplate(name, template) {
    this.templates.set(name, template);
  }

  /**
   * Generate fallback UI
   */
  generate(error, templateName = 'default') {
    const template = this.templates.get(templateName);
    if (!template) {
      return this.templates.get('default')(error);
    }

    return template(error);
  }
}

/**
 * Graceful degradation manager
 */
class GracefulDegradationManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULT_ERROR_BOUNDARY_CONFIG, ...config };

    this.features = new Map();
    this.currentLevel = 'full';
  }

  /**
   * Register feature
   */
  registerFeature(name, levels) {
    this.features.set(name, {
      name,
      levels,
      currentLevel: 'full',
      fallbackCount: 0
    });
  }

  /**
   * Degrade feature
   */
  degradeFeature(featureName) {
    const feature = this.features.get(featureName);
    if (!feature) {
      throw new Error(`Feature ${featureName} not registered`);
    }

    const currentIndex = this.config.featureLevels.indexOf(feature.currentLevel);
    if (currentIndex >= this.config.featureLevels.length - 1) {
      // Already at lowest level
      return feature.currentLevel;
    }

    const newLevel = this.config.featureLevels[currentIndex + 1];
    feature.currentLevel = newLevel;
    feature.fallbackCount++;

    this.emit('feature-degraded', {
      feature: featureName,
      oldLevel: this.config.featureLevels[currentIndex],
      newLevel,
      fallbackCount: feature.fallbackCount
    });

    return newLevel;
  }

  /**
   * Restore feature
   */
  restoreFeature(featureName) {
    const feature = this.features.get(featureName);
    if (!feature) {
      throw new Error(`Feature ${featureName} not registered`);
    }

    const currentIndex = this.config.featureLevels.indexOf(feature.currentLevel);
    if (currentIndex === 0) {
      // Already at highest level
      return feature.currentLevel;
    }

    const newLevel = this.config.featureLevels[currentIndex - 1];
    feature.currentLevel = newLevel;

    this.emit('feature-restored', {
      feature: featureName,
      oldLevel: this.config.featureLevels[currentIndex],
      newLevel
    });

    return newLevel;
  }

  /**
   * Get feature level
   */
  getFeatureLevel(featureName) {
    const feature = this.features.get(featureName);
    if (!feature) return null;
    return feature.currentLevel;
  }

  /**
   * Check if feature is available
   */
  isFeatureAvailable(featureName, requiredLevel = 'full') {
    const feature = this.features.get(featureName);
    if (!feature) return false;

    const currentIndex = this.config.featureLevels.indexOf(feature.currentLevel);
    const requiredIndex = this.config.featureLevels.indexOf(requiredLevel);

    return currentIndex <= requiredIndex;
  }

  /**
   * Degrade all features
   */
  degradeAll() {
    for (const [featureName] of this.features) {
      this.degradeFeature(featureName);
    }

    const currentIndex = this.config.featureLevels.indexOf(this.currentLevel);
    if (currentIndex < this.config.featureLevels.length - 1) {
      this.currentLevel = this.config.featureLevels[currentIndex + 1];
    }

    this.emit('global-degradation', { level: this.currentLevel });
  }

  /**
   * Restore all features
   */
  restoreAll() {
    for (const [featureName] of this.features) {
      this.restoreFeature(featureName);
    }

    const currentIndex = this.config.featureLevels.indexOf(this.currentLevel);
    if (currentIndex > 0) {
      this.currentLevel = this.config.featureLevels[currentIndex - 1];
    }

    this.emit('global-restoration', { level: this.currentLevel });
  }

  /**
   * Get all features status
   */
  getAllFeatures() {
    const features = [];
    for (const [name, data] of this.features) {
      features.push({
        name,
        level: data.currentLevel,
        fallbackCount: data.fallbackCount
      });
    }
    return features;
  }
}

/**
 * Error boundary manager
 */
class ErrorBoundaryManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULT_ERROR_BOUNDARY_CONFIG, ...config };

    this.boundaries = new Map();
    this.fallbackUI = new FallbackUIGenerator();
    this.degradation = new GracefulDegradationManager(config);

    // Forward events
    this.degradation.on('feature-degraded', (data) =>
      this.emit('feature-degraded', data)
    );
    this.degradation.on('feature-restored', (data) =>
      this.emit('feature-restored', data)
    );
  }

  /**
   * Create error boundary
   */
  createBoundary(name, component, fallback, config = {}) {
    const boundary = new ErrorBoundary(name, { ...this.config, ...config });

    boundary.setComponent(component);
    if (fallback) {
      boundary.setFallback(fallback);
    }

    // Forward events
    boundary.on('error', (data) => this.emit('boundary-error', data));
    boundary.on('retry', (data) => this.emit('boundary-retry', data));
    boundary.on('fallback', (data) => this.emit('boundary-fallback', data));
    boundary.on('reset', (data) => this.emit('boundary-reset', data));

    this.boundaries.set(name, boundary);
    return boundary;
  }

  /**
   * Get boundary
   */
  getBoundary(name) {
    return this.boundaries.get(name);
  }

  /**
   * Execute boundary
   */
  async execute(name, ...args) {
    const boundary = this.boundaries.get(name);
    if (!boundary) {
      throw new Error(`Boundary ${name} not found`);
    }

    return await boundary.execute(...args);
  }

  /**
   * Reset boundary
   */
  resetBoundary(name) {
    const boundary = this.boundaries.get(name);
    if (boundary) {
      boundary.reset();
    }
  }

  /**
   * Reset all boundaries
   */
  resetAll() {
    for (const [name, boundary] of this.boundaries) {
      boundary.reset();
    }
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const stats = {
      totalBoundaries: this.boundaries.size,
      boundariesWithErrors: 0,
      totalErrors: 0,
      totalRetries: 0
    };

    for (const [name, boundary] of this.boundaries) {
      const state = boundary.getState();
      if (state.hasError) {
        stats.boundariesWithErrors++;
      }
      stats.totalErrors += state.errorCount;
      stats.totalRetries += state.retryCount;
    }

    return stats;
  }
}

/**
 * Create error boundary system
 */
function createErrorBoundarySystem(config = {}) {
  const manager = new ErrorBoundaryManager(config);

  // Log errors
  manager.on('boundary-error', (data) => {
    console.error(
      `[ErrorBoundary:${data.name}] Error #${data.errorCount}:`,
      data.error.message
    );
  });

  manager.on('boundary-retry', (data) => {
    console.log(
      `[ErrorBoundary:${data.name}] Retry ${data.retryCount}/${data.maxRetries}`
    );
  });

  manager.on('boundary-fallback', (data) => {
    console.warn(`[ErrorBoundary:${data.name}] Using fallback`);
  });

  return manager;
}

module.exports = {
  ErrorBoundary,
  ErrorBoundaryManager,
  FallbackUIGenerator,
  GracefulDegradationManager,
  createErrorBoundarySystem,
  DEFAULT_ERROR_BOUNDARY_CONFIG
};
