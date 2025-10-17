/**
 * Custom Error Classes for Qui Browser
 * @module utils/custom-errors
 */

/**
 * Base error class for Qui Browser errors
 */
class QuiBrowserError extends Error {
  constructor(message, statusCode = 500, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

/**
 * Authentication error
 */
class AuthenticationError extends QuiBrowserError {
  constructor(message = 'Authentication failed', details = {}) {
    super(message, 401, details);
  }
}

/**
 * Authorization error
 */
class AuthorizationError extends QuiBrowserError {
  constructor(message = 'Access denied', details = {}) {
    super(message, 403, details);
  }
}

/**
 * Validation error
 */
class ValidationError extends QuiBrowserError {
  constructor(message = 'Validation failed', details = {}) {
    super(message, 400, details);
  }
}

/**
 * Rate limit error
 */
class RateLimitError extends QuiBrowserError {
  constructor(message = 'Rate limit exceeded', details = {}) {
    super(message, 429, details);
  }
}

/**
 * Not found error
 */
class NotFoundError extends QuiBrowserError {
  constructor(message = 'Resource not found', details = {}) {
    super(message, 404, details);
  }
}

/**
 * Configuration error
 */
class ConfigurationError extends QuiBrowserError {
  constructor(message = 'Configuration error', details = {}) {
    super(message, 500, details);
  }
}

/**
 * Payment error
 */
class PaymentError extends QuiBrowserError {
  constructor(message = 'Payment processing failed', details = {}) {
    super(message, 402, details);
  }
}

/**
 * Service unavailable error
 */
class ServiceUnavailableError extends QuiBrowserError {
  constructor(message = 'Service temporarily unavailable', details = {}) {
    super(message, 503, details);
  }
}

/**
 * Timeout error
 */
class TimeoutError extends QuiBrowserError {
  constructor(message = 'Request timeout', details = {}) {
    super(message, 504, details);
  }
}

/**
 * Security error
 */
class SecurityError extends QuiBrowserError {
  constructor(message = 'Security violation detected', details = {}) {
    super(message, 403, details);
  }
}

module.exports = {
  QuiBrowserError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  RateLimitError,
  NotFoundError,
  ConfigurationError,
  PaymentError,
  ServiceUnavailableError,
  TimeoutError,
  SecurityError
};
