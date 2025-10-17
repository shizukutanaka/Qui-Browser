/**
 * Error Formatter
 *
 * Provides user-friendly error messages and formatting
 * Improvement #252: User-friendly error messages
 */

/**
 * Error severity levels
 */
const ERROR_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * HTTP status code to user-friendly message mapping
 */
const STATUS_MESSAGES = {
  // 4xx Client Errors
  400: {
    title: 'Bad Request',
    message: 'The request could not be understood. Please check your input and try again.',
    level: ERROR_LEVELS.WARNING
  },
  401: {
    title: 'Authentication Required',
    message: 'You need to sign in to access this resource.',
    level: ERROR_LEVELS.WARNING
  },
  403: {
    title: 'Access Denied',
    message: "You don't have permission to access this resource.",
    level: ERROR_LEVELS.WARNING
  },
  404: {
    title: 'Page Not Found',
    message: 'The page you are looking for could not be found. It may have been moved or deleted.',
    level: ERROR_LEVELS.INFO
  },
  405: {
    title: 'Method Not Allowed',
    message: 'This action is not allowed for this resource.',
    level: ERROR_LEVELS.WARNING
  },
  408: {
    title: 'Request Timeout',
    message: 'The request took too long to process. Please try again.',
    level: ERROR_LEVELS.WARNING
  },
  409: {
    title: 'Conflict',
    message: 'The request conflicts with the current state. Please refresh and try again.',
    level: ERROR_LEVELS.WARNING
  },
  410: {
    title: 'Gone',
    message: 'This resource is no longer available.',
    level: ERROR_LEVELS.INFO
  },
  413: {
    title: 'File Too Large',
    message: 'The file you are trying to upload is too large.',
    level: ERROR_LEVELS.WARNING
  },
  414: {
    title: 'URL Too Long',
    message: 'The requested URL is too long.',
    level: ERROR_LEVELS.WARNING
  },
  415: {
    title: 'Unsupported Media Type',
    message: 'The file type is not supported.',
    level: ERROR_LEVELS.WARNING
  },
  422: {
    title: 'Validation Error',
    message: 'The data you provided could not be validated. Please check your input.',
    level: ERROR_LEVELS.WARNING
  },
  429: {
    title: 'Too Many Requests',
    message: 'You have made too many requests. Please wait a moment and try again.',
    level: ERROR_LEVELS.WARNING
  },

  // 5xx Server Errors
  500: {
    title: 'Internal Server Error',
    message: 'Something went wrong on our end. Please try again later.',
    level: ERROR_LEVELS.ERROR
  },
  501: {
    title: 'Not Implemented',
    message: 'This feature is not yet available.',
    level: ERROR_LEVELS.INFO
  },
  502: {
    title: 'Bad Gateway',
    message: 'There was a problem communicating with the server. Please try again.',
    level: ERROR_LEVELS.ERROR
  },
  503: {
    title: 'Service Unavailable',
    message: 'The service is temporarily unavailable. Please try again in a few moments.',
    level: ERROR_LEVELS.ERROR
  },
  504: {
    title: 'Gateway Timeout',
    message: 'The server took too long to respond. Please try again.',
    level: ERROR_LEVELS.ERROR
  }
};

/**
 * Common error codes and their user-friendly messages
 */
const ERROR_CODES = {
  NETWORK_ERROR: {
    title: 'Network Error',
    message: 'Unable to connect to the server. Please check your internet connection.',
    level: ERROR_LEVELS.ERROR
  },
  TIMEOUT: {
    title: 'Connection Timeout',
    message: 'The connection timed out. Please check your internet connection and try again.',
    level: ERROR_LEVELS.ERROR
  },
  PARSE_ERROR: {
    title: 'Data Error',
    message: 'There was a problem processing the server response.',
    level: ERROR_LEVELS.ERROR
  },
  VALIDATION_ERROR: {
    title: 'Validation Error',
    message: 'Please check your input and make sure all required fields are filled correctly.',
    level: ERROR_LEVELS.WARNING
  },
  PERMISSION_DENIED: {
    title: 'Permission Denied',
    message: "You don't have permission to perform this action.",
    level: ERROR_LEVELS.WARNING
  },
  RATE_LIMITED: {
    title: 'Rate Limit Exceeded',
    message: 'Too many requests. Please wait a moment before trying again.',
    level: ERROR_LEVELS.WARNING
  },
  MAINTENANCE: {
    title: 'Under Maintenance',
    message: 'The system is currently under maintenance. Please try again later.',
    level: ERROR_LEVELS.INFO
  },
  DEPRECATED: {
    title: 'Feature Deprecated',
    message: 'This feature is no longer supported. Please use the alternative method.',
    level: ERROR_LEVELS.INFO
  }
};

/**
 * Format error for display to users
 *
 * @param {Error|Object} error - Error object
 * @param {Object} options - Formatting options
 * @returns {Object} Formatted error
 */
function formatError(error, options = {}) {
  const { includeStack = false, includeDetails = false } = options;

  // Handle HTTP status codes
  if (typeof error === 'number') {
    const statusInfo = STATUS_MESSAGES[error];
    if (statusInfo) {
      return {
        code: error,
        title: statusInfo.title,
        message: statusInfo.message,
        level: statusInfo.level,
        type: 'http_error'
      };
    }
    return {
      code: error,
      title: 'Error',
      message: `An error occurred (${error})`,
      level: ERROR_LEVELS.ERROR,
      type: 'http_error'
    };
  }

  // Handle error objects
  if (error instanceof Error) {
    const formatted = {
      title: error.name || 'Error',
      message: sanitizeErrorMessage(error.message),
      level: ERROR_LEVELS.ERROR,
      type: 'exception'
    };

    if (error.code && ERROR_CODES[error.code]) {
      Object.assign(formatted, ERROR_CODES[error.code]);
    }

    if (includeStack && error.stack) {
      formatted.stack = error.stack;
    }

    if (includeDetails && error.details) {
      formatted.details = error.details;
    }

    return formatted;
  }

  // Handle custom error objects
  if (typeof error === 'object' && error !== null) {
    return {
      title: error.title || 'Error',
      message: sanitizeErrorMessage(error.message || 'An unknown error occurred'),
      level: error.level || ERROR_LEVELS.ERROR,
      type: error.type || 'unknown',
      code: error.code,
      details: includeDetails ? error.details : undefined
    };
  }

  // Fallback
  return {
    title: 'Error',
    message: 'An unknown error occurred',
    level: ERROR_LEVELS.ERROR,
    type: 'unknown'
  };
}

/**
 * Sanitize error message to prevent information leakage
 *
 * @param {string} message - Error message
 * @returns {string} Sanitized message
 */
function sanitizeErrorMessage(message) {
  if (!message) {
    return 'An error occurred';
  }

  // Remove file paths
  let sanitized = message.replace(/(?:\/[^\/\s]+)+\/[^\/\s]+/g, '[path]');

  // Remove IP addresses
  sanitized = sanitized.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[ip]');

  // Remove potential tokens/keys (common patterns - minimum 20 chars to avoid false positives)
  sanitized = sanitized.replace(/[a-zA-Z0-9]{20,}/g, '[token]');

  // Remove email addresses
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]');

  return sanitized;
}

/**
 * Create user-friendly error response
 *
 * @param {Error|number} error - Error or status code
 * @param {Object} options - Options
 * @returns {Object} Error response
 */
function createErrorResponse(error, options = {}) {
  const { includeTimestamp = true, requestId = null } = options;

  const formatted = formatError(error, options);

  const response = {
    success: false,
    error: formatted
  };

  if (includeTimestamp) {
    response.timestamp = new Date().toISOString();
  }

  if (requestId !== null) {
    response.requestId = requestId;
  }

  return response;
}

/**
 * Format validation errors
 *
 * @param {Array|Object} errors - Validation errors
 * @returns {Object} Formatted validation errors
 */
function formatValidationErrors(errors) {
  if (Array.isArray(errors)) {
    return {
      title: 'Validation Error',
      message: 'Please correct the following errors:',
      level: ERROR_LEVELS.WARNING,
      type: 'validation',
      errors: errors.map((err) => ({
        field: err.field || err.path,
        message: err.message,
        code: err.code
      }))
    };
  }

  if (typeof errors === 'object' && errors !== null) {
    return {
      title: 'Validation Error',
      message: 'Please correct the following errors:',
      level: ERROR_LEVELS.WARNING,
      type: 'validation',
      errors: Object.entries(errors).map(([field, message]) => ({
        field,
        message: Array.isArray(message) ? message[0] : message
      }))
    };
  }

  return formatError(errors);
}

/**
 * Get retry advice for error
 *
 * @param {Object} error - Formatted error
 * @returns {string|null} Retry advice
 */
function getRetryAdvice(error) {
  if (error.code === 429 || error.code === 'RATE_LIMITED') {
    return 'Wait a few seconds before trying again';
  }

  if (error.code >= 500 && error.code < 600) {
    return 'Try again in a few moments';
  }

  if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
    return 'Check your internet connection and try again';
  }

  return null;
}

/**
 * Check if error is retryable
 *
 * @param {Object} error - Formatted error
 * @returns {boolean}
 */
function isRetryableError(error) {
  const retryableCodes = [408, 429, 500, 502, 503, 504];
  const retryableErrorCodes = ['NETWORK_ERROR', 'TIMEOUT', 'RATE_LIMITED'];

  if (typeof error.code === 'number' && retryableCodes.includes(error.code)) {
    return true;
  }

  if (typeof error.code === 'string' && retryableErrorCodes.includes(error.code)) {
    return true;
  }

  return false;
}

module.exports = {
  formatError,
  sanitizeErrorMessage,
  createErrorResponse,
  formatValidationErrors,
  getRetryAdvice,
  isRetryableError,
  ERROR_LEVELS,
  STATUS_MESSAGES,
  ERROR_CODES
};
