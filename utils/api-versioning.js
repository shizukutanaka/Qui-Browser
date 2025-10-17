/**
 * API Versioning System
 *
 * Based on 2025 research: Modern API versioning strategies
 *
 * GraphQL Best Practices (2025):
 * - Avoid versioning by design
 * - Continuous schema evolution
 * - Additive changes are backward compatible
 * - Only return explicitly requested data
 *
 * REST API Best Practices (2025):
 * - Semantic versioning (v1, v2, v3)
 * - Maintain backward compatibility
 * - Deprecate old versions responsibly
 * - Notify users in advance
 *
 * Implementation Options:
 * 1. Path versioning: /api/v1/users, /api/v2/users (Maximum visibility)
 * 2. Query parameters: /api/users?version=2 (Less visible)
 * 3. Headers: Accept: application/vnd.myapi.v2+json (REST principles)
 *
 * 2025 Trends:
 * - Evolution over versioning where possible
 * - Explicit versioning for breaking changes
 * - Security and architectural changes require versions
 *
 * @see https://www.moesif.com/blog/technical/api-design/Best-Practices-for-Versioning-REST-and-GraphQL-APIs/
 * @see https://dev.to/cryptosandy/api-design-best-practices-in-2025-rest-graphql-and-grpc-234h
 */

const EventEmitter = require('events');

class APIVersioning extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      // Versioning strategy
      strategy: options.strategy || 'path', // path, query, header

      // Current version
      currentVersion: options.currentVersion || 'v1',

      // Supported versions
      supportedVersions: options.supportedVersions || ['v1'],

      // Deprecated versions with sunset dates
      deprecatedVersions: options.deprecatedVersions || {},

      // Default version for unspecified requests
      defaultVersion: options.defaultVersion || 'v1',

      // Version format
      versionPrefix: options.versionPrefix || 'v',

      // Header name for header-based versioning
      versionHeader: options.versionHeader || 'Accept-Version',

      // Query parameter name for query-based versioning
      versionParam: options.versionParam || 'version',

      // Strict mode (reject unknown versions)
      strictMode: options.strictMode !== false,

      ...options
    };

    // Version configurations
    this.versions = new Map();

    // Statistics
    this.stats = {
      totalRequests: 0,
      requestsByVersion: {},
      deprecatedVersionRequests: 0,
      unsupportedVersionRequests: 0
    };
  }

  /**
   * Register API version with routes
   */
  registerVersion(version, config) {
    this.versions.set(version, {
      version,
      routes: config.routes || {},
      middleware: config.middleware || [],
      deprecated: config.deprecated || false,
      sunsetDate: config.sunsetDate || null,
      breaking: config.breaking || false,
      changelog: config.changelog || '',
      createdAt: Date.now()
    });

    // Initialize statistics
    this.stats.requestsByVersion[version] = 0;

    this.emit('versionRegistered', { version, config });
  }

  /**
   * Create middleware for version extraction and routing
   */
  createMiddleware() {
    return (req, res, next) => {
      this.stats.totalRequests++;

      // Extract version from request
      const version = this.extractVersion(req);

      // Validate version
      const validationResult = this.validateVersion(version);

      if (!validationResult.valid) {
        return this.handleInvalidVersion(req, res, validationResult);
      }

      // Attach version info to request
      req.apiVersion = version;
      req.apiVersionInfo = this.versions.get(version);

      // Update statistics
      this.stats.requestsByVersion[version]++;

      // Add version headers to response
      res.setHeader('API-Version', version);

      // Check if deprecated
      const versionConfig = this.versions.get(version);
      if (versionConfig && versionConfig.deprecated) {
        this.stats.deprecatedVersionRequests++;
        res.setHeader('Deprecation', 'true');

        if (versionConfig.sunsetDate) {
          res.setHeader('Sunset', new Date(versionConfig.sunsetDate).toUTCString());
        }

        this.emit('deprecatedVersionUsed', { version, path: req.path });
      }

      next();
    };
  }

  /**
   * Extract version from request based on strategy
   */
  extractVersion(req) {
    switch (this.options.strategy) {
      case 'path':
        return this.extractVersionFromPath(req);

      case 'query':
        return this.extractVersionFromQuery(req);

      case 'header':
        return this.extractVersionFromHeader(req);

      default:
        return this.options.defaultVersion;
    }
  }

  /**
   * Extract version from URL path
   */
  extractVersionFromPath(req) {
    // Match /api/v1/users -> v1
    const match = req.path.match(/\/api\/(v\d+)\//);
    return match ? match[1] : this.options.defaultVersion;
  }

  /**
   * Extract version from query parameter
   */
  extractVersionFromQuery(req) {
    return req.query[this.options.versionParam] || this.options.defaultVersion;
  }

  /**
   * Extract version from header
   */
  extractVersionFromHeader(req) {
    // Check custom header
    const customHeader = req.headers[this.options.versionHeader.toLowerCase()];
    if (customHeader) return customHeader;

    // Check Accept header for vendor-specific version
    // Accept: application/vnd.myapi.v2+json
    const accept = req.headers['accept'];
    if (accept) {
      const match = accept.match(/vnd\.[\w-]+\.(v\d+)/);
      if (match) return match[1];
    }

    return this.options.defaultVersion;
  }

  /**
   * Validate version
   */
  validateVersion(version) {
    // Check if version is supported
    if (!this.versions.has(version)) {
      return {
        valid: false,
        error: 'unsupported',
        message: `API version '${version}' is not supported`
      };
    }

    // Check if version is sunset
    const config = this.versions.get(version);
    if (config.sunsetDate && Date.now() > config.sunsetDate) {
      return {
        valid: false,
        error: 'sunset',
        message: `API version '${version}' has been sunset`
      };
    }

    return { valid: true };
  }

  /**
   * Handle invalid version
   */
  handleInvalidVersion(req, res, validationResult) {
    this.stats.unsupportedVersionRequests++;

    this.emit('invalidVersion', {
      requestedVersion: this.extractVersion(req),
      error: validationResult.error,
      path: req.path
    });

    res.status(400).json({
      error: 'Invalid API version',
      message: validationResult.message,
      supportedVersions: Array.from(this.versions.keys()),
      currentVersion: this.options.currentVersion
    });
  }

  /**
   * Deprecate API version
   */
  deprecateVersion(version, sunsetDate = null) {
    const config = this.versions.get(version);

    if (!config) {
      throw new Error(`Version not found: ${version}`);
    }

    config.deprecated = true;
    config.sunsetDate = sunsetDate;

    this.options.deprecatedVersions[version] = sunsetDate;

    this.emit('versionDeprecated', { version, sunsetDate });
  }

  /**
   * Remove (sunset) API version
   */
  sunsetVersion(version) {
    const config = this.versions.get(version);

    if (!config) {
      throw new Error(`Version not found: ${version}`);
    }

    this.versions.delete(version);

    this.emit('versionSunset', { version });
  }

  /**
   * Get version info
   */
  getVersionInfo(version) {
    return this.versions.get(version);
  }

  /**
   * Get all versions
   */
  getAllVersions() {
    return Array.from(this.versions.entries()).map(([version, config]) => ({
      version,
      deprecated: config.deprecated,
      sunsetDate: config.sunsetDate,
      breaking: config.breaking,
      createdAt: config.createdAt
    }));
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      totalVersions: this.versions.size,
      deprecatedVersions: Object.keys(this.options.deprecatedVersions).length,
      versionUsagePercentage: this.calculateVersionUsage()
    };
  }

  /**
   * Calculate version usage percentage
   */
  calculateVersionUsage() {
    const usage = {};
    for (const [version, count] of Object.entries(this.stats.requestsByVersion)) {
      usage[version] = this.stats.totalRequests > 0
        ? (count / this.stats.totalRequests) * 100
        : 0;
    }
    return usage;
  }
}

module.exports = APIVersioning;
