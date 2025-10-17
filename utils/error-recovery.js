/**
 * Error Recovery System
 * Comprehensive error handling and automatic recovery
 *
 * @module utils/error-recovery
 */

/**
 * Error Recovery Strategy
 * @enum {string}
 */
const RecoveryStrategy = {
  RETRY: 'RETRY',
  FALLBACK: 'FALLBACK',
  CIRCUIT_BREAK: 'CIRCUIT_BREAK',
  DEGRADE: 'DEGRADE',
  FAIL: 'FAIL'
};

/**
 * Error Recovery Manager
 * Handles errors with automatic recovery strategies
 *
 * @class ErrorRecovery
 * @description Provides comprehensive error recovery with:
 * - Multiple recovery strategies
 * - Automatic retry with backoff
 * - Fallback mechanisms
 * - Error classification
 * - Recovery history tracking
 */
class ErrorRecovery {
  /**
   * Create error recovery manager
   * @param {Object} options - Configuration options
   * @param {number} [options.maxRetries=3] - Max retry attempts
   * @param {number} [options.initialDelay=1000] - Initial retry delay (ms)
   * @param {number} [options.maxDelay=30000] - Max retry delay (ms)
   * @param {number} [options.backoffMultiplier=2] - Backoff multiplier
   * @param {boolean} [options.enableFallback=true] - Enable fallback
   * @param {Function} [options.logger] - Logger function
   */
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.initialDelay = options.initialDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.enableFallback = options.enableFallback !== false;
    this.logger = options.logger || console.error;

    this.errorHandlers = new Map();
    this.fallbacks = new Map();
    this.recoveryHistory = [];
    this.maxHistorySize = 100;

    this.stats = {
      totalErrors: 0,
      recovered: 0,
      failed: 0,
      retriedCount: 0,
      fallbackUsed: 0
    };
  }

  /**
   * Register error handler for specific error type
   * @param {string|Function} errorType - Error type or matcher function
   * @param {RecoveryStrategy} strategy - Recovery strategy
   * @param {Object} options - Handler options
   */
  registerHandler(errorType, strategy, options = {}) {
    const handler = {
      strategy,
      maxRetries: options.maxRetries || this.maxRetries,
      fallback: options.fallback,
      shouldRetry: options.shouldRetry || (() => true),
      onRecovery: options.onRecovery || (() => {}),
      onFailure: options.onFailure || (() => {})
    };

    if (typeof errorType === 'function') {
      handler.matcher = errorType;
      this.errorHandlers.set('custom_' + Date.now(), handler);
    } else {
      this.errorHandlers.set(errorType, handler);
    }
  }

  /**
   * Register fallback function
   * @param {string} key - Fallback key
   * @param {Function} fallbackFn - Fallback function
   */
  registerFallback(key, fallbackFn) {
    this.fallbacks.set(key, fallbackFn);
  }

  /**
   * Execute function with error recovery
   * @param {Function} fn - Function to execute
   * @param {Object} options - Execution options
   * @returns {Promise<*>} - Result or recovered result
   */
  async execute(fn, options = {}) {
    const context = {
      attempts: 0,
      errors: [],
      startTime: Date.now()
    };

    while (context.attempts < (options.maxRetries || this.maxRetries) + 1) {
      try {
        const result = await fn();

        if (context.attempts > 0) {
          this.recordRecovery(context, true);
        }

        return result;
      } catch (error) {
        context.attempts++;
        context.errors.push(error);
        this.stats.totalErrors++;

        const handler = this.findHandler(error);
        const strategy = handler ? handler.strategy : RecoveryStrategy.RETRY;

        // Try recovery
        const recovered = await this.tryRecover(error, strategy, handler, context, fn, options);

        if (recovered.success) {
          this.stats.recovered++;
          this.recordRecovery(context, true, recovered.result);
          return recovered.result;
        }

        // Last attempt failed
        if (context.attempts >= (options.maxRetries || this.maxRetries) + 1) {
          this.stats.failed++;
          this.recordRecovery(context, false);
          throw this.createRecoveryError(context);
        }

        // Wait before retry
        await this.backoff(context.attempts);
      }
    }
  }

  /**
   * Find error handler
   * @private
   * @param {Error} error - Error
   * @returns {Object|null} - Handler or null
   */
  findHandler(error) {
    // Check exact type match
    if (error.name && this.errorHandlers.has(error.name)) {
      return this.errorHandlers.get(error.name);
    }

    // Check custom matchers
    for (const [key, handler] of this.errorHandlers.entries()) {
      if (handler.matcher && handler.matcher(error)) {
        return handler;
      }
    }

    return null;
  }

  /**
   * Try to recover from error
   * @private
   * @param {Error} error - Error
   * @param {RecoveryStrategy} strategy - Recovery strategy
   * @param {Object} handler - Error handler
   * @param {Object} context - Execution context
   * @param {Function} fn - Original function
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Recovery result
   */
  async tryRecover(error, strategy, handler, context, fn, options) {
    switch (strategy) {
      case RecoveryStrategy.RETRY:
        return this.retryStrategy(error, handler, context);

      case RecoveryStrategy.FALLBACK:
        return this.fallbackStrategy(error, handler, options);

      case RecoveryStrategy.CIRCUIT_BREAK:
        return this.circuitBreakStrategy(error, handler);

      case RecoveryStrategy.DEGRADE:
        return this.degradeStrategy(error, handler);

      case RecoveryStrategy.FAIL:
      default:
        return { success: false };
    }
  }

  /**
   * Retry recovery strategy
   * @private
   */
  async retryStrategy(error, handler, context) {
    if (handler && !handler.shouldRetry(error, context.attempts)) {
      return { success: false };
    }

    this.stats.retriedCount++;
    this.logger('Retrying after error:', error.message, `(attempt ${context.attempts})`);

    return { success: false }; // Will retry in main loop
  }

  /**
   * Fallback recovery strategy
   * @private
   */
  async fallbackStrategy(error, handler, options) {
    if (!this.enableFallback) {
      return { success: false };
    }

    const fallbackKey = options.fallbackKey || handler?.fallback;
    const fallbackFn = this.fallbacks.get(fallbackKey);

    if (!fallbackFn) {
      this.logger('No fallback available for:', error.message);
      return { success: false };
    }

    try {
      this.stats.fallbackUsed++;
      this.logger('Using fallback for:', error.message);
      const result = await fallbackFn();

      if (handler?.onRecovery) {
        handler.onRecovery(error, result);
      }

      return { success: true, result };
    } catch (fallbackError) {
      this.logger('Fallback failed:', fallbackError.message);
      return { success: false };
    }
  }

  /**
   * Circuit breaker recovery strategy
   * @private
   */
  async circuitBreakStrategy(error, handler) {
    this.logger('Circuit breaker opened for:', error.message);

    if (handler?.onFailure) {
      handler.onFailure(error);
    }

    return { success: false };
  }

  /**
   * Degrade recovery strategy
   * @private
   */
  async degradeStrategy(error, handler) {
    this.logger('Degrading service due to:', error.message);

    const degradedResult = {
      degraded: true,
      reason: error.message,
      timestamp: Date.now()
    };

    return { success: true, result: degradedResult };
  }

  /**
   * Calculate backoff delay
   * @private
   * @param {number} attempt - Attempt number
   * @returns {Promise<void>}
   */
  async backoff(attempt) {
    const delay = Math.min(
      this.initialDelay * Math.pow(this.backoffMultiplier, attempt - 1),
      this.maxDelay
    );

    // Add jitter
    const jitter = delay * 0.1 * Math.random();
    await new Promise(resolve => setTimeout(resolve, delay + jitter));
  }

  /**
   * Record recovery attempt
   * @private
   */
  recordRecovery(context, success, result = null) {
    const record = {
      timestamp: Date.now(),
      duration: Date.now() - context.startTime,
      attempts: context.attempts,
      success,
      errors: context.errors.map(e => ({
        name: e.name,
        message: e.message
      })),
      result: success ? 'recovered' : 'failed'
    };

    this.recoveryHistory.push(record);

    if (this.recoveryHistory.length > this.maxHistorySize) {
      this.recoveryHistory.shift();
    }
  }

  /**
   * Create recovery error
   * @private
   * @param {Object} context - Execution context
   * @returns {Error} - Recovery error
   */
  createRecoveryError(context) {
    const error = new Error('Recovery failed after ' + context.attempts + ' attempts');
    error.name = 'RecoveryError';
    error.attempts = context.attempts;
    error.errors = context.errors;
    error.duration = Date.now() - context.startTime;
    return error;
  }

  /**
   * Classify error
   * @param {Error} error - Error to classify
   * @returns {Object} - Error classification
   */
  classifyError(error) {
    const classification = {
      type: error.name || 'UnknownError',
      category: 'unknown',
      severity: 'error',
      recoverable: true
    };

    // Network errors
    if (
      error.message?.includes('fetch') ||
      error.message?.includes('network') ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT'
    ) {
      classification.category = 'network';
      classification.severity = 'warning';
      classification.recoverable = true;
    }

    // Validation errors
    else if (
      error.name === 'ValidationError' ||
      error.message?.includes('invalid')
    ) {
      classification.category = 'validation';
      classification.severity = 'error';
      classification.recoverable = false;
    }

    // Authentication errors
    else if (
      error.message?.includes('unauthorized') ||
      error.message?.includes('forbidden') ||
      error.statusCode === 401 ||
      error.statusCode === 403
    ) {
      classification.category = 'authentication';
      classification.severity = 'error';
      classification.recoverable = false;
    }

    // Rate limit errors
    else if (
      error.message?.includes('rate limit') ||
      error.statusCode === 429
    ) {
      classification.category = 'rate_limit';
      classification.severity = 'warning';
      classification.recoverable = true;
    }

    // Server errors
    else if (error.statusCode >= 500) {
      classification.category = 'server';
      classification.severity = 'critical';
      classification.recoverable = true;
    }

    return classification;
  }

  /**
   * Get recovery statistics
   * @returns {Object} - Statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalErrors > 0
        ? this.stats.recovered / this.stats.totalErrors
        : 1,
      recentRecoveries: this.recoveryHistory.slice(-10)
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalErrors: 0,
      recovered: 0,
      failed: 0,
      retriedCount: 0,
      fallbackUsed: 0
    };
  }

  /**
   * Clear recovery history
   */
  clearHistory() {
    this.recoveryHistory = [];
  }
}

/**
 * Retry helper function
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise<*>} - Result
 */
async function retry(fn, options = {}) {
  const recovery = new ErrorRecovery({
    maxRetries: options.maxRetries || 3,
    initialDelay: options.initialDelay || 1000,
    maxDelay: options.maxDelay || 30000,
    backoffMultiplier: options.backoffMultiplier || 2
  });

  return recovery.execute(fn, options);
}

/**
 * Fallback helper function
 * @param {Function} fn - Primary function
 * @param {Function} fallbackFn - Fallback function
 * @returns {Promise<*>} - Result
 */
async function withFallback(fn, fallbackFn) {
  try {
    return await fn();
  } catch (error) {
    console.warn('Primary function failed, using fallback:', error.message);
    return await fallbackFn();
  }
}

module.exports = {
  ErrorRecovery,
  RecoveryStrategy,
  retry,
  withFallback
};
