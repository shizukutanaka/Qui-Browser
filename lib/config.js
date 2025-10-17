/**
 * Qui Browser - Configuration Module
 *
 * Centralized configuration management with environment variable parsing
 */

const path = require('path');
const { numberFromEnv, parseBooleanEnv, parseStringListEnv } = require('../utils/env-helpers');

/**
 * Load configuration from environment variables
 * @returns {Object} Configuration object
 */
function loadConfig() {
  const config = {
    // Server configuration
    port: numberFromEnv('PORT', { default: 8000, min: 1024, max: 65535 }),
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'development',
    trustProxy: parseBooleanEnv('TRUST_PROXY', false),

    // Security configuration
    security: {
      enabled: parseBooleanEnv('ENABLE_SECURITY_HEADERS', true),
      cspEnabled: parseBooleanEnv('ENABLE_CSP', true),
      hstsEnabled: parseBooleanEnv('ENABLE_HSTS', true),
      allowedOrigins: parseStringListEnv('ALLOWED_ORIGINS'),
      allowedHosts: parseStringListEnv('ALLOWED_HOSTS'),
      corsEnabled: parseBooleanEnv('ENABLE_CORS', true)
    },

    // Performance configuration
    performance: {
      lightweightMode: parseBooleanEnv('LIGHTWEIGHT', false),
      compressionEnabled: parseBooleanEnv('ENABLE_COMPRESSION', true),
      maxRequestBodyBytes: numberFromEnv('MAX_REQUEST_BODY_BYTES', {
        default: 1048576,
        min: 1024,
        max: 104857600
      })
    },

    // Caching configuration
    caching: {
      fileCacheEnabled: parseBooleanEnv('ENABLE_FILE_CACHE', true),
      fileCacheMaxSize: numberFromEnv('FILE_CACHE_MAX_SIZE', { default: 50, min: 0, max: 500 }),
      fileCacheMaxFileSize: numberFromEnv('FILE_CACHE_MAX_FILE_SIZE', {
        default: 25600,
        min: 1024,
        max: 524288
      }),
      fileCacheTTL: numberFromEnv('FILE_CACHE_TTL_MS', { default: 30000, min: 5000, max: 3600000 }),
      compressionCacheEnabled: parseBooleanEnv('ENABLE_COMPRESSION_CACHE', true),
      compressionCacheMaxSize: numberFromEnv('STATIC_COMPRESSION_CACHE_MAX_SIZE', {
        default: 200,
        min: 0,
        max: 2000
      }),
      compressionCacheTTL: numberFromEnv('STATIC_COMPRESSION_CACHE_TTL_MS', {
        default: 600000,
        min: 60000,
        max: 43200000
      })
    },

    // Rate limiting configuration
    rateLimiting: {
      enabled: parseBooleanEnv('ENABLE_RATE_LIMITING', true),
      maxRequests: numberFromEnv('RATE_LIMIT_MAX', { default: 100, min: 1, max: 10000 }),
      windowMs: numberFromEnv('RATE_LIMIT_WINDOW', { default: 60000, min: 1000, max: 3600000 }),
      burstAllowance: numberFromEnv('RATE_LIMIT_BURST', { default: 0, min: 0, max: 1000 }),
      maxEntries: numberFromEnv('RATE_LIMIT_MAX_ENTRIES', { default: 1000, min: 10, max: 100000 })
    },

    // Monitoring configuration
    monitoring: {
      enabled: parseBooleanEnv('ENABLE_MONITORING', true),
      healthCheckEnabled: parseBooleanEnv('ENABLE_HEALTH_CHECK', true),
      metricsEnabled: parseBooleanEnv('ENABLE_METRICS', true),
      alertingEnabled: parseBooleanEnv('ENABLE_ALERTING', false)
    },

    // API configuration
    api: {
      enabled: parseBooleanEnv('ENABLE_API', true),
      maxConcurrentRequests: numberFromEnv('MAX_CONCURRENT_REQUESTS', { default: 100, min: 1, max: 1000 })
    },

    // File upload configuration
    fileUpload: {
      enabled: parseBooleanEnv('ENABLE_FILE_UPLOAD', true),
      maxFileSize: numberFromEnv('MAX_FILE_SIZE', { default: 10485760, min: 1024, max: 104857600 }),
      allowedTypes: parseStringListEnv('ALLOWED_FILE_TYPES') || [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain', 'application/json'
      ],
      uploadDir: path.resolve(process.env.UPLOAD_DIR || './uploads')
    },

    // Internationalization configuration
    i18n: {
      enabled: parseBooleanEnv('ENABLE_I18N', true),
      defaultLanguage: process.env.DEFAULT_LANGUAGE || 'en',
      supportedLanguages: parseStringListEnv('SUPPORTED_LANGUAGES') || ['en', 'ja']
    },

    // Plugin configuration
    plugins: {
      enabled: parseBooleanEnv('ENABLE_PLUGINS', true),
      paths: parseStringListEnv('PLUGIN_PATHS'),
      autoLoad: parseBooleanEnv('PLUGIN_AUTO_LOAD', true)
    },

    // PWA configuration
    pwa: {
      enabled: parseBooleanEnv('ENABLE_PWA', true),
      manifest: {
        name: process.env.PWA_NAME || 'Qui Browser',
        shortName: process.env.PWA_SHORT_NAME || 'Qui Browser',
        description: process.env.PWA_DESCRIPTION || 'A lightweight, secure web browser with VR/WebXR support',
        themeColor: process.env.PWA_THEME_COLOR || '#2563eb',
        backgroundColor: process.env.PWA_BACKGROUND_COLOR || '#ffffff',
        display: process.env.PWA_DISPLAY || 'standalone',
        startUrl: process.env.PWA_START_URL || '/'
      },
      serviceWorker: {
        enabled: parseBooleanEnv('ENABLE_SERVICE_WORKER', true),
        scope: process.env.SW_SCOPE || '/',
        cacheName: process.env.SW_CACHE_NAME || 'qui-browser-v1.1.0'
      }
    },

    // Database configuration
    database: {
      enabled: parseBooleanEnv('ENABLE_DATABASE', false),
      type: process.env.DATABASE_TYPE || 'sqlite',
      url: process.env.DATABASE_URL,
      host: process.env.DATABASE_HOST || 'localhost',
      port: numberFromEnv('DATABASE_PORT'),
      name: process.env.DATABASE_NAME || 'qui_browser',
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      ssl: parseBooleanEnv('DATABASE_SSL', false),
      maxConnections: numberFromEnv('DATABASE_MAX_CONNECTIONS', { default: 10, min: 1, max: 100 })
    },

    // Static files configuration
    static: {
      root: path.resolve(process.env.STATIC_ROOT || '.'),
      allowedPaths: parseStringListEnv('ALLOWED_STATIC_PATHS') || ['/', '/index.html', '/manifest.json']
    },

    // WebSocket configuration
    websocket: {
      enabled: parseBooleanEnv('ENABLE_WEBSOCKET', true),
      maxPayload: numberFromEnv('WEBSOCKET_MAX_PAYLOAD', { default: 1048576, min: 1024, max: 10485760 }), // 1MB default
      heartbeatInterval: numberFromEnv('WEBSOCKET_HEARTBEAT_INTERVAL', { default: 30000, min: 5000, max: 120000 }),
      clientTimeout: numberFromEnv('WEBSOCKET_CLIENT_TIMEOUT', { default: 60000, min: 10000, max: 300000 })
    },

    // Notification configuration
    notifications: {
      enabled: parseBooleanEnv('NOTIFICATIONS_ENABLED', false),
      webhooks: parseStringListEnv('NOTIFICATION_WEBHOOKS'),
      emailEnabled: parseBooleanEnv('EMAIL_NOTIFICATIONS_ENABLED', false),
      smsEnabled: parseBooleanEnv('SMS_NOTIFICATIONS_ENABLED', false)
    }
  };

  // Validate configuration
  validateConfig(config);

  return config;
}

/**
 * Validate configuration object
 * @param {Object} config - Configuration to validate
 */
function validateConfig(config) {
  const errors = [];
  const warnings = [];

  // Server validation
  if (config.port < 1024 && config.environment === 'production' && process.platform !== 'win32') {
    warnings.push(`Port ${config.port} requires elevated privileges on Unix-like systems`);
  }

  // Security validation
  if (config.environment === 'production') {
    if (!config.security.enabled) {
      errors.push('Security headers must be enabled in production');
    }
    if (config.security.allowedOrigins.length === 0) {
      warnings.push('No allowed origins configured - CORS may not work as expected');
    }
  }

  // Performance validation
  if (config.performance.maxRequestBodyBytes > 100 * 1024 * 1024) {
    warnings.push('Max request body size is very large - consider reducing for better security');
  }

  // Log validation results
  if (warnings.length > 0) {
    console.warn('Configuration warnings:');
    warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    throw new Error('Configuration validation failed');
  }
}

/**
 * Get configuration value by path
 * @param {string} path - Dot notation path (e.g., 'security.enabled')
 * @param {*} defaultValue - Default value if path not found
 * @returns {*} Configuration value
 */
function getConfigValue(config, path, defaultValue = undefined) {
  const keys = path.split('.');
  let value = config;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return defaultValue;
    }
  }

  return value !== undefined ? value : defaultValue;
}

module.exports = {
  loadConfig,
  validateConfig,
  getConfigValue
};
