/**
 * Retry Handler with Circuit Breaker Pattern
 *
 * Implements automatic retry logic with exponential backoff
 * and circuit breaker pattern for resilience
 * Improvements #324-325: Retry mechanism and circuit breaker
 */

const EventEmitter = require('events');

/**
 * Circuit breaker states
 */
const CircuitState = {
  CLOSED: 'CLOSED', // Normal operation
  OPEN: 'OPEN', // Failing, reject requests immediately
  HALF_OPEN: 'HALF_OPEN' // Testing if service recovered
};

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 100, // ms
  maxDelay: 5000, // ms
  backoffMultiplier: 2,
  jitter: true, // Add randomness to prevent thundering herd
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED']
};

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CIRCUIT_CONFIG = {
  failureThreshold: 5, // Number of failures before opening circuit
  successThreshold: 2, // Number of successes to close circuit from half-open
  timeout: 60000, // Time to wait before attempting half-open (ms)
  monitoringPeriod: 10000 // Time window for counting failures (ms)
};

/**
 * Circuit Breaker implementation
 */
class CircuitBreaker extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
    this.state = CircuitState.CLOSED;
    this.failures = [];
    this.successes = 0;
    this.nextAttempt = Date.now();
  }

  /**
   * Check if circuit allows requests
   */
  canAttempt() {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      if (Date.now() >= this.nextAttempt) {
        this.state = CircuitState.HALF_OPEN;
        this.successes = 0;
        this.emit('half-open');
        return true;
      }
      return false;
    }

    // HALF_OPEN state
    return true;
  }

  /**
   * Record successful request
   */
  recordSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.failures = [];
        this.successes = 0;
        this.emit('closed');
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Clean up old failures
      const now = Date.now();
      this.failures = this.failures.filter((time) => now - time < this.config.monitoringPeriod);
    }
  }

  /**
   * Record failed request
   */
  recordFailure() {
    const now = Date.now();
    this.failures.push(now);

    // Clean up old failures
    this.failures = this.failures.filter((time) => now - time < this.config.monitoringPeriod);

    if (this.state === CircuitState.HALF_OPEN) {
      this.open();
    } else if (this.state === CircuitState.CLOSED) {
      if (this.failures.length >= this.config.failureThreshold) {
        this.open();
      }
    }
  }

  /**
   * Open circuit (stop allowing requests)
   */
  open() {
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.config.timeout;
    this.successes = 0;
    this.emit('open', { nextAttempt: this.nextAttempt });
  }

  /**
   * Reset circuit to closed state
   */
  reset() {
    this.state = CircuitState.CLOSED;
    this.failures = [];
    this.successes = 0;
    this.nextAttempt = Date.now();
    this.emit('reset');
  }

  /**
   * Get circuit status
   */
  getStatus() {
    return {
      state: this.state,
      failures: this.failures.length,
      successes: this.successes,
      nextAttempt: this.nextAttempt
    };
  }
}

/**
 * Retry handler with exponential backoff
 */
class RetryHandler {
  constructor(config = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
    this.circuitBreakers = new Map();
  }

  /**
   * Get or create circuit breaker for a key
   */
  getCircuitBreaker(key) {
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, new CircuitBreaker());
    }
    return this.circuitBreakers.get(key);
  }

  /**
   * Calculate delay for retry attempt
   */
  calculateDelay(attempt) {
    const delay = Math.min(
      this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attempt),
      this.config.maxDelay
    );

    if (this.config.jitter) {
      // Add random jitter (±25%)
      const jitterRange = delay * 0.25;
      return delay + (Math.random() * jitterRange * 2 - jitterRange);
    }

    return delay;
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    if (!error) {
      return false;
    }

    // Check error code
    if (error.code && this.config.retryableErrors.includes(error.code)) {
      return true;
    }

    // Check HTTP status codes
    if (error.statusCode) {
      const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
      return retryableStatusCodes.includes(error.statusCode);
    }

    // Check error message
    if (error.message) {
      const retryablePatterns = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'timeout', 'network error'];
      return retryablePatterns.some((pattern) => error.message.toLowerCase().includes(pattern.toLowerCase()));
    }

    return false;
  }

  /**
   * Execute function with retry logic
   *
   * @param {Function} fn - Async function to execute
   * @param {Object} options - Retry options
   * @returns {Promise} Result or error
   */
  async executeWithRetry(fn, options = {}) {
    const { maxRetries = this.config.maxRetries, circuitBreakerKey = null, context = null } = options;

    let lastError;
    let attempt = 0;

    while (attempt <= maxRetries) {
      // Check circuit breaker if key provided
      if (circuitBreakerKey) {
        const circuit = this.getCircuitBreaker(circuitBreakerKey);
        if (!circuit.canAttempt()) {
          const error = new Error('Circuit breaker is open');
          error.code = 'CIRCUIT_OPEN';
          error.circuitState = circuit.getStatus();
          throw error;
        }
      }

      try {
        const result = await fn(context);

        // Record success in circuit breaker
        if (circuitBreakerKey) {
          const circuit = this.getCircuitBreaker(circuitBreakerKey);
          circuit.recordSuccess();
        }

        return result;
      } catch (error) {
        lastError = error;

        // Record failure in circuit breaker
        if (circuitBreakerKey) {
          const circuit = this.getCircuitBreaker(circuitBreakerKey);
          circuit.recordFailure();
        }

        // Don't retry if error is not retryable
        if (!this.isRetryableError(error)) {
          throw error;
        }

        // Don't retry if we've exhausted attempts
        if (attempt >= maxRetries) {
          break;
        }

        // Calculate delay and wait
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);

        attempt++;
      }
    }

    // All retries exhausted
    const error = new Error(`Failed after ${attempt} retries: ${lastError.message}`);
    error.code = 'MAX_RETRIES_EXCEEDED';
    error.attempts = attempt;
    error.originalError = lastError;
    throw error;
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Wrap a function with retry logic
   *
   * @param {Function} fn - Function to wrap
   * @param {Object} options - Retry options
   * @returns {Function} Wrapped function
   */
  wrap(fn, options = {}) {
    return async (...args) => {
      return this.executeWithRetry(() => fn(...args), options);
    };
  }

  /**
   * Reset all circuit breakers
   */
  resetCircuitBreakers() {
    for (const circuit of this.circuitBreakers.values()) {
      circuit.reset();
    }
  }

  /**
   * Get status of all circuit breakers
   */
  getCircuitBreakerStatus() {
    const status = {};
    for (const [key, circuit] of this.circuitBreakers.entries()) {
      status[key] = circuit.getStatus();
    }
    return status;
  }
}

/**
 * Create a retry handler instance
 */
function createRetryHandler(config = {}) {
  return new RetryHandler(config);
}

/**
 * Execute with retry (convenience function)
 */
async function withRetry(fn, options = {}) {
  const handler = new RetryHandler(options);
  return handler.executeWithRetry(fn, options);
}

module.exports = {
  RetryHandler,
  CircuitBreaker,
  createRetryHandler,
  withRetry,
  CircuitState,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_CIRCUIT_CONFIG
};
