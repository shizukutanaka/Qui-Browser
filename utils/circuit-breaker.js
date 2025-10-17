/**
 * Circuit Breaker Pattern Implementation
 * Production-grade resilience pattern for fault tolerance
 *
 * @module utils/circuit-breaker
 */

/**
 * Circuit breaker states
 * @enum {string}
 */
const CircuitState = {
  CLOSED: 'CLOSED', // Normal operation
  OPEN: 'OPEN', // Circuit tripped, rejecting requests
  HALF_OPEN: 'HALF_OPEN' // Testing if service recovered
};

/**
 * Circuit Breaker for protecting against cascading failures
 *
 * @class CircuitBreaker
 * @description Implements the circuit breaker pattern to prevent cascading failures.
 * When failures exceed threshold, circuit opens and rejects requests immediately.
 * After timeout, circuit enters half-open state to test if service recovered.
 */
class CircuitBreaker {
  /**
   * Create a circuit breaker
   * @param {Object} options - Configuration options
   * @param {string} options.name - Circuit breaker name
   * @param {number} [options.failureThreshold=5] - Failures before opening
   * @param {number} [options.successThreshold=2] - Successes in half-open to close
   * @param {number} [options.timeout=60000] - Time before half-open (ms)
   * @param {number} [options.monitoringPeriod=10000] - Rolling window for failures (ms)
   * @param {Function} [options.onStateChange] - State change callback
   * @param {Function} [options.onFailure] - Failure callback
   * @param {Function} [options.onSuccess] - Success callback
   */
  constructor(options = {}) {
    this.name = options.name || 'default';
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 60000;
    this.monitoringPeriod = options.monitoringPeriod || 10000;

    this.state = CircuitState.CLOSED;
    this.failures = [];
    this.successes = 0;
    this.nextAttempt = Date.now();
    this.lastStateChange = Date.now();

    this.onStateChange = options.onStateChange || (() => {});
    this.onFailure = options.onFailure || (() => {});
    this.onSuccess = options.onSuccess || (() => {});

    // Statistics
    this.stats = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      totalRejections: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      stateChanges: 0
    };
  }

  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn - Async function to execute
   * @param {*} args - Arguments to pass to function
   * @returns {Promise<*>} - Function result
   * @throws {Error} - If circuit is open or function fails
   */
  async execute(fn, ...args) {
    this.stats.totalRequests++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      if (now < this.nextAttempt) {
        this.stats.totalRejections++;
        const error = new Error(`Circuit breaker '${this.name}' is OPEN`);
        error.circuitState = this.state;
        error.nextAttempt = this.nextAttempt;
        throw error;
      }

      // Move to half-open state
      this.changeState(CircuitState.HALF_OPEN);
    }

    try {
      const result = await fn(...args);
      this.onCallSuccess();
      return result;
    } catch (error) {
      this.onCallFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful call
   * @private
   */
  onCallSuccess() {
    this.stats.totalSuccesses++;
    this.stats.lastSuccessTime = Date.now();
    this.onSuccess();

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.changeState(CircuitState.CLOSED);
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Clear old failures in monitoring period
      this.cleanupFailures();
    }
  }

  /**
   * Handle failed call
   * @private
   * @param {Error} error - Error from failed call
   */
  onCallFailure(error) {
    this.stats.totalFailures++;
    this.stats.lastFailureTime = Date.now();
    this.failures.push(Date.now());
    this.onFailure(error);

    // Clean up old failures
    this.cleanupFailures();

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open state opens the circuit
      this.changeState(CircuitState.OPEN);
    } else if (this.state === CircuitState.CLOSED) {
      // Check if failures exceed threshold
      if (this.failures.length >= this.failureThreshold) {
        this.changeState(CircuitState.OPEN);
      }
    }
  }

  /**
   * Change circuit state
   * @private
   * @param {CircuitState} newState - New state
   */
  changeState(newState) {
    const oldState = this.state;

    if (oldState === newState) {
      return;
    }

    this.state = newState;
    this.lastStateChange = Date.now();
    this.stats.stateChanges++;

    if (newState === CircuitState.OPEN) {
      this.nextAttempt = Date.now() + this.timeout;
      this.successes = 0;
    } else if (newState === CircuitState.CLOSED) {
      this.failures = [];
      this.successes = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successes = 0;
    }

    this.onStateChange(oldState, newState);
  }

  /**
   * Clean up old failures outside monitoring period
   * @private
   */
  cleanupFailures() {
    const now = Date.now();
    const cutoff = now - this.monitoringPeriod;
    this.failures = this.failures.filter(time => time > cutoff);
  }

  /**
   * Get current circuit state
   * @returns {CircuitState} - Current state
   */
  getState() {
    return this.state;
  }

  /**
   * Check if circuit is open
   * @returns {boolean} - True if open
   */
  isOpen() {
    return this.state === CircuitState.OPEN;
  }

  /**
   * Check if circuit is closed
   * @returns {boolean} - True if closed
   */
  isClosed() {
    return this.state === CircuitState.CLOSED;
  }

  /**
   * Check if circuit is half-open
   * @returns {boolean} - True if half-open
   */
  isHalfOpen() {
    return this.state === CircuitState.HALF_OPEN;
  }

  /**
   * Get circuit breaker statistics
   * @returns {Object} - Statistics object
   */
  getStats() {
    return {
      name: this.name,
      state: this.state,
      ...this.stats,
      currentFailures: this.failures.length,
      currentSuccesses: this.successes,
      nextAttempt: this.nextAttempt,
      lastStateChange: this.lastStateChange
    };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset() {
    this.changeState(CircuitState.CLOSED);
    this.failures = [];
    this.successes = 0;
    this.nextAttempt = Date.now();
  }

  /**
   * Force open the circuit
   */
  forceOpen() {
    this.changeState(CircuitState.OPEN);
  }

  /**
   * Force close the circuit
   */
  forceClose() {
    this.changeState(CircuitState.CLOSED);
  }
}

/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers for different services
 *
 * @class CircuitBreakerManager
 */
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
    this.defaultOptions = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
      monitoringPeriod: 10000
    };
  }

  /**
   * Get or create a circuit breaker
   * @param {string} name - Circuit breaker name
   * @param {Object} options - Configuration options
   * @returns {CircuitBreaker} - Circuit breaker instance
   */
  getBreaker(name, options = {}) {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker({
        name,
        ...this.defaultOptions,
        ...options
      });
      this.breakers.set(name, breaker);
    }

    return this.breakers.get(name);
  }

  /**
   * Execute function with named circuit breaker
   * @param {string} name - Circuit breaker name
   * @param {Function} fn - Function to execute
   * @param {*} args - Function arguments
   * @returns {Promise<*>} - Function result
   */
  async execute(name, fn, ...args) {
    const breaker = this.getBreaker(name);
    return breaker.execute(fn, ...args);
  }

  /**
   * Get all circuit breaker statistics
   * @returns {Array<Object>} - Array of statistics
   */
  getAllStats() {
    return Array.from(this.breakers.values()).map(breaker => breaker.getStats());
  }

  /**
   * Get statistics for specific circuit breaker
   * @param {string} name - Circuit breaker name
   * @returns {Object|null} - Statistics or null if not found
   */
  getStats(name) {
    const breaker = this.breakers.get(name);
    return breaker ? breaker.getStats() : null;
  }

  /**
   * Reset specific circuit breaker
   * @param {string} name - Circuit breaker name
   * @returns {boolean} - True if reset successfully
   */
  reset(name) {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.reset();
      return true;
    }
    return false;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Remove circuit breaker
   * @param {string} name - Circuit breaker name
   * @returns {boolean} - True if removed
   */
  remove(name) {
    return this.breakers.delete(name);
  }

  /**
   * Remove all circuit breakers
   */
  clear() {
    this.breakers.clear();
  }

  /**
   * Get number of managed circuit breakers
   * @returns {number} - Count
   */
  size() {
    return this.breakers.size;
  }
}

module.exports = {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitState
};
