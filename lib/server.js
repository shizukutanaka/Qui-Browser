/**
 * Qui Browser - Core Server Module
 *
 * Main server implementation with modular architecture
 */

const http = require('http');
const path = require('path');
const crypto = require('crypto');

// Import modular components
const config = require('./config');
const security = require('./security');
const caching = require('./caching');
const { MonitoringManager: BasicMonitoringManager } = require('./monitoring');
const ObservabilityManager = require('./monitoring/manager');
const Logger = require('./monitoring/logger');
const Tracer = require('./monitoring/tracer');
const apiHandlers = require('./api-handlers');
const middlewareUtils = require('./middleware');
const { MiddlewareManager } = require('../core/middleware');
const apiDocumentation = require('./api-documentation');
const WebSocketManager = require('./websocket');
const PluginManager = require('./plugins/manager');
const PWAIntegration = require('./pwa');
const AnalyticsEngine = require('./analytics/engine');
const { RealTimeProcessor, BatchProcessor, PredictiveAnalytics } = require('./analytics/processors');
const AuthenticationManager = require('./auth/manager');
const AuthMiddleware = require('./auth/middleware');
const GraphQLServer = require('./graphql/server');
const NotificationManager = require('./notifications/manager');
const NotificationService = require('./notifications/service');
const AdvancedRateLimiter = require('./advanced-rate-limiter');

function createFallbackRateLimiter() {
  return {
    async checkLimit() {
      return {
        allowed: true,
        remaining: -1,
        resetTime: null,
        retryAfter: 0,
        limit: -1,
        tier: 'unlimited'
      };
    },
    async getQuotaUsage() {
      return null;
    }
  };
}

class LightweightBrowserServer {
  constructor() {
    // Initialize configuration
    this.config = config.loadConfig();

    // Core server properties
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
    this.totalResponseTime = 0;
    this.rateLimitedCount = 0;
    this.activeConnections = 0;
    this.peakConnections = 0;

    // VR/WebXR telemetry state
    this.vrAssetRequests = 0;
    this.vrAssetBytesServed = 0n;
    this.vrRequestTimestamps = [];

    // Initialize components
    this.security = new security.SecurityManager(this.config);
    this.caching = new caching.CacheManager(this.config);
    this.monitoring = new BasicMonitoringManager(this.config);
    this.apiHandlers = new apiHandlers.APIHandlers(this.config);
    this.middleware = new MiddlewareManager({ enableErrorHandling: true });
    this.apiDocumentation = new apiDocumentation(this.config);
    this.websocketManager = new WebSocketManager(this.config);
    this.pluginManager = new PluginManager(this.config);
    this.pwaIntegration = new PWAIntegration(this.config);
    this.analyticsEngine = new AnalyticsEngine(this.config);
    this.realTimeProcessor = new RealTimeProcessor(this.analyticsEngine);
    this.batchProcessor = new BatchProcessor(this.analyticsEngine);
    this.predictiveAnalytics = new PredictiveAnalytics(this.analyticsEngine);
    this.notificationManager = new NotificationManager(this.config, null); // Database will be set later
    this.notificationService = new NotificationService(this.notificationManager, this.config);
    this.authManager = new AuthenticationManager(this.config, null, this.notificationService); // Database will be set later
    this.authMiddleware = new AuthMiddleware(this.authManager);
    // Initialize monitoring system
    this.monitoringManager = new ObservabilityManager(this.config, null); // Database will be set later
    this.logger = new Logger(this.config);
    this.tracer = new Tracer(this.monitoringManager);
    this.rateLimiter = createFallbackRateLimiter();
    this.initialized = false;

    console.log(`Qui Browser Server initialized (${this.config.environment} mode)`);
  }

  /**
   * Initialize all server components
   */
  async initializeComponents() {
    // Initialize security components
    if (this.initialized) {
      return;
    }

    this.security.initialize();
    if (this.security.advancedRateLimiter) {
      this.rateLimiter = this.security.advancedRateLimiter;
    }

    // Initialize caching
    this.caching.initialize();

    // Initialize monitoring
    this.monitoring.initialize();

    // Initialize API handlers
    this.apiHandlers.initialize();

    // Initialize API documentation
    this.apiDocumentation.initialize();

    // Initialize PWA integration
    this.pwaIntegration.initialize();

    // Plugins will be loaded in start() method
    this.pluginsLoaded = false;

    // Initialize GraphQL server
    if (!this.graphqlServer) {
      this.graphqlServer = new GraphQLServer(
        this.config,
        this.authManager,
        null, // Database will be set later
        this.analyticsEngine,
        this.rateLimiter
      );
    } else {
      this.graphqlServer.rateLimiter = this.rateLimiter;
      if (this.graphqlServer.resolvers) {
        this.graphqlServer.resolvers.rateLimiter = this.rateLimiter;
      }
    }

    await this.graphqlServer.initialize();

    // Validate startup configuration
    this.validateStartupConfiguration();

    this.initialized = true;
  }

  /**
   * Validate startup configuration
   */
  validateStartupConfiguration() {
    const warnings = [];
    const errors = [];

    // Configuration validation logic
    if (this.config.environment === 'production') {
      if (!this.config.security.enabled) {
        warnings.push('Security headers disabled in production');
      }
    }

    // Log validation results
    if (warnings.length > 0) {
      console.warn('Configuration warnings:', warnings);
    }

    if (errors.length > 0) {
      console.error('Configuration errors:', errors);
      throw new Error('Configuration validation failed');
    }
  }

  /**
   * Handle incoming HTTP requests
   */
  async handleRequest(req, res) {
    const startTime = Date.now();
    const clientIP = this.getClientIP(req);
    req.__clientIP = clientIP;
    const requestId = crypto.randomUUID();
    res.setHeader('X-Request-ID', requestId);

    try {
      // Track request analytics
      await this.trackRequestAnalytics(req);

      // Handle the request
      const result = await this.routeRequest(req, res);

      // Track response analytics
      const responseTime = Date.now() - startTime;

      await this.trackResponseAnalytics(req, res, responseTime, result);

    } catch (error) {
      this.errorCount++;

      // Track error analytics
      await this.trackErrorAnalytics(req, error);

      // Handle error
      this.handleError(error, req, res);
    } finally {
      // Record metrics
      await this.recordMetrics(req, res, startTime);
    }
  }

  /**
   * Route incoming requests
   */
  async routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Health check
    if (pathname === '/health') {
      return this.monitoring.handleHealthCheck(req, res);
    }

    // Metrics endpoint
    if (pathname === '/metrics') {
      return this.monitoring.handleMetrics(req, res);
    }

    // API routes
    if (pathname.startsWith('/api/')) {
      // Check for PWA API routes first
      if (await this.pwaIntegration.handlePWAApiRequest(req, res, pathname, url.searchParams)) {
        return;
      }

      // Check for API documentation routes
      if (await this.apiDocumentation.handleDocsRequest(req, res, pathname)) {
        return;
      }

      // Handle other API routes
      return this.apiHandlers.handleAPIRoutes(req, res, pathname, url.searchParams);
    }

    // Check for PWA static files
    if (await this.pwaIntegration.handlePWARequest(req, res, pathname)) {
      return;
    }

    // Static file serving
    return this.caching.handleStaticFile(req, res, pathname);
  }

  /**
   * Handle errors
   */
  async handleError(error, req, res) {
    this.errorCount++;

    const err = middlewareUtils.toError(error, 'Request handling failed');

    // Log error
    console.error('Request error:', {
      requestId: res.getHeader('X-Request-ID'),
      method: req.method,
      url: req.url,
      error: err.message,
      stack: this.config.environment === 'development' ? err.stack : undefined
    });

    // Send error response
    if (!res.headersSent) {
      middlewareUtils.sendJsonError(req, res, 500, err.message);
    }
  }

  /**
   * Record request metrics
   */
  async recordMetrics(req, res, startTime) {
    const duration = Date.now() - startTime;
    this.totalResponseTime += duration;
    this.requestCount++;

    // Update monitoring
    this.monitoring.recordRequestMetrics(req, res, duration);
  }

  /**
   * Get client IP address
   */
  getClientIP(req) {
    // Implementation for getting client IP
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded && this.config.trustProxy) {
      return forwarded.split(',')[0].trim();
    }
    return req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
  }

  /**
   * Start the server
   */
  async start() {
    await this.initializeComponents();

    const express = require('express');
    const app = express();

    // Apply GraphQL middleware
    this.graphqlServer.applyMiddleware(app, '/graphql');

    const server = require('http').createServer(app);

    // Server configuration
    server.maxHeaderSize = 16384;
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    // Set up request handling for non-GraphQL routes
    app.use((req, res, next) => {
      // Skip GraphQL routes
      if (req.path.startsWith('/graphql')) {
        return next();
      }
      // Handle other routes with our custom logic
      this.handleRequest(req, res);
    });

    // Set up GraphQL subscriptions
    this.graphqlServer.setupSubscriptions(server, '/graphql');

    // Load plugins asynchronously
    this.pluginManager.loadPlugins().then(() => {
      this.pluginManager.setServer(this);
      this.pluginsLoaded = true;
      console.log('All plugins loaded successfully');
    }).catch(error => {
      console.error('Failed to load plugins:', error);
    });

    // Connection tracking
    server.on('connection', (socket) => {
      this.activeConnections++;
      this.peakConnections = Math.max(this.peakConnections, this.activeConnections);

      socket.on('close', () => {
        this.activeConnections--;
      });
    });

    return new Promise((resolve, reject) => {
      server.listen(this.config.port, this.config.host, (error) => {
        if (error) {
          reject(error);
        } else {
          this.serverInstance = server;
          console.log(`Qui Browser Server running on http://${this.config.host}:${this.config.port}`);
          console.log(`WebSocket endpoint: ws://${this.config.host}:${this.config.port}/ws`);
          console.log(`Health check: http://${this.config.host}:${this.config.port}/health`);
          resolve(server);
        }
      });
    });
  }

  /**
   * Stop the server
   */
  async stop() {
    // Cleanup WebSocket connections
    if (this.websocketManager) {
      this.websocketManager.stop();
    }

    // Cleanup other components
    this.caching.cleanup();
    this.monitoring.cleanup();
    console.log('Server stopped');
  }

  // Analytics tracking methods

  async trackRequestAnalytics(req) {
    if (!this.analyticsEngine) return;

    const event = {
      type: 'page_view',
      url: req.url,
      method: req.method,
      userAgent: req.headers['user-agent'],
      ip: req.__clientIP || this.getClientIP(req),
      referer: req.headers.referer,
      timestamp: new Date(),
      userId: req.headers['x-user-id'] || null,
      sessionId: req.headers['x-session-id'] || null
    };

    await this.analyticsEngine.trackEvent(event);
    await this.realTimeProcessor.process(event);
  }

  async trackResponseAnalytics(req, res, responseTime, result) {
    if (!this.analyticsEngine) return;

    const event = {
      type: 'api_call',
      url: req.url,
      method: req.method,
      statusCode: res.statusCode,
      responseTime: responseTime,
      userAgent: req.headers['user-agent'],
      ip: req.__clientIP || this.getClientIP(req),
      timestamp: new Date(),
      userId: req.headers['x-user-id'] || null,
      sessionId: req.headers['x-session-id'] || null,
      success: res.statusCode < 400
    };

    await this.analyticsEngine.trackEvent(event);
    await this.realTimeProcessor.process(event);
  }

  async trackErrorAnalytics(req, error) {
    if (!this.analyticsEngine) return;

    const event = {
      type: 'error',
      url: req.url,
      method: req.method,
      error: error.message,
      stack: error.stack,
      userAgent: req.headers['user-agent'],
      ip: req.__clientIP || this.getClientIP(req),
      timestamp: new Date(),
      userId: req.headers['x-user-id'] || null,
      sessionId: req.headers['x-session-id'] || null
    };

    await this.analyticsEngine.trackEvent(event);
    await this.realTimeProcessor.process(event);
  }

  /**
   * Get analytics data
   */
  getAnalytics(options = {}) {
    if (!this.analyticsEngine) return null;
    return this.analyticsEngine.getAnalytics(options);
  }

  /**
   * Get analytics dashboard data
   */
  getAnalyticsDashboard(dashboardId) {
    if (!this.analyticsEngine) return null;
    return this.analyticsEngine.getDashboardData(dashboardId);
  }
}

module.exports = LightweightBrowserServer;
