/**
 * Request timeout utility
 * Automatically abort requests that take too long
 * @module utils/request-timeout
 */

/**
 * Creates a timeout handler for HTTP requests
 * @param {http.IncomingMessage} req - Request object
 * @param {http.ServerResponse} res - Response object
 * @param {number} timeoutMs - Timeout in milliseconds (default: 30000)
 * @param {Function} onTimeout - Optional callback when timeout occurs
 * @returns {Function} Cleanup function
 */
function createRequestTimeout(req, res, timeoutMs = 30000, onTimeout) {
  if (!req || !res) {
    return () => {};
  }

  if (res.writableEnded || res.headersSent) {
    return () => {};
  }

  const timeoutId = setTimeout(() => {
    if (res.writableEnded || res.headersSent) {
      return;
    }

    if (typeof onTimeout === 'function') {
      try {
        onTimeout(req, res);
      } catch (err) {
        console.error('[RequestTimeout] Error in onTimeout callback:', err);
      }
    }

    try {
      res.writeHead(408, {
        'Content-Type': 'application/json; charset=utf-8',
        Connection: 'close'
      });
      res.end(
        JSON.stringify({
          error: 'Request timeout',
          code: 'REQUEST_TIMEOUT',
          timeout: timeoutMs
        })
      );
    } catch (err) {
      // Response already sent or socket closed
      console.error('[RequestTimeout] Failed to send timeout response:', err);
    }

    if (req.socket && !req.socket.destroyed) {
      req.socket.destroy();
    }
  }, timeoutMs);

  // Cleanup function
  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };

  // Auto-cleanup when response finishes
  res.once('finish', cleanup);
  res.once('close', cleanup);

  return cleanup;
}

/**
 * Middleware to apply request timeout
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Function} Middleware function
 */
function requestTimeoutMiddleware(timeoutMs = 30000) {
  return async (req, res, next) => {
    const cleanup = createRequestTimeout(req, res, timeoutMs);
    req._timeoutCleanup = cleanup;
    await next();
  };
}

module.exports = {
  createRequestTimeout,
  requestTimeoutMiddleware
};
