/**
 * HTTPS Redirect Middleware
 *
 * Automatically redirects HTTP requests to HTTPS in production
 * Improvement #8: Force HTTPS in production environment
 */

/**
 * Create HTTPS redirect middleware
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Enable HTTPS redirect (default: true in production)
 * @param {number} options.statusCode - HTTP status code for redirect (default: 301)
 * @param {Array<string>} options.excludePaths - Paths to exclude from redirect (e.g., health checks)
 * @returns {Function} Express-style middleware
 */
function createHttpsRedirect(options = {}) {
  const {
    enabled = process.env.NODE_ENV === 'production' && process.env.FORCE_HTTPS !== 'false',
    statusCode = 301,
    excludePaths = ['/health', '/healthz', '/.well-known/']
  } = options;

  return function httpsRedirect(req, res, next) {
    // Skip if disabled
    if (!enabled) {
      return next();
    }

    // Check if already secure
    const isSecure =
      req.socket?.encrypted || // Direct HTTPS
      req.headers['x-forwarded-proto'] === 'https' || // Behind proxy (Cloudflare, AWS ELB, etc.)
      req.headers['x-forwarded-ssl'] === 'on' || // Some proxies
      req.headers['x-arr-ssl'] !== undefined || // Azure
      req.connection?.encrypted; // Alternative check

    // Allow if already secure
    if (isSecure) {
      return next();
    }

    // Check excluded paths
    const pathname = req.url ? new URL(req.url, `http://${req.headers.host}`).pathname : req.path;
    for (const excludePath of excludePaths) {
      if (pathname.startsWith(excludePath)) {
        return next();
      }
    }

    // Redirect to HTTPS
    const host = req.headers.host || 'localhost';
    const httpsUrl = `https://${host}${req.url || '/'}`;

    res.writeHead(statusCode, {
      Location: httpsUrl,
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    });
    res.end();
  };
}

/**
 * Check if request is secure
 *
 * @param {Object} req - HTTP request object
 * @returns {boolean} True if request is over HTTPS
 */
function isSecureRequest(req) {
  return Boolean(
    req.socket?.encrypted ||
      req.headers['x-forwarded-proto'] === 'https' ||
      req.headers['x-forwarded-ssl'] === 'on' ||
      req.headers['x-arr-ssl'] !== undefined ||
      req.connection?.encrypted
  );
}

/**
 * Get the protocol of a request
 *
 * @param {Object} req - HTTP request object
 * @returns {string} 'https' or 'http'
 */
function getProtocol(req) {
  return isSecureRequest(req) ? 'https' : 'http';
}

/**
 * Get the full URL of a request
 *
 * @param {Object} req - HTTP request object
 * @returns {string} Full URL
 */
function getFullUrl(req) {
  const protocol = getProtocol(req);
  const host = req.headers.host || 'localhost';
  const url = req.url || '/';
  return `${protocol}://${host}${url}`;
}

module.exports = {
  createHttpsRedirect,
  isSecureRequest,
  getProtocol,
  getFullUrl
};
