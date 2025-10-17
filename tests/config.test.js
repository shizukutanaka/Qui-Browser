/**
 * Tests for Configuration Module
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadConfig, validateConfig, getConfigValue } = require('../lib/config');

test('Configuration Module', async (t) => {
  await t.test('loadConfig() returns valid configuration object', () => {
    const config = loadConfig();

    assert.strictEqual(typeof config, 'object');
    assert(config !== null);

    // Check required properties
    assert(config.hasOwnProperty('port'));
    assert(config.hasOwnProperty('host'));
    assert(config.hasOwnProperty('environment'));
    assert(config.hasOwnProperty('security'));
    assert(config.hasOwnProperty('caching'));
    assert(config.hasOwnProperty('rateLimiting'));
  });

  await t.test('loadConfig() sets default values', () => {
    const config = loadConfig();

    assert.strictEqual(typeof config.port, 'number');
    assert(config.port > 0);
    assert.strictEqual(typeof config.host, 'string');
    assert.strictEqual(typeof config.environment, 'string');
  });

  await t.test('validateConfig() accepts valid config', () => {
    const validConfig = {
      port: 8000,
      host: 'localhost',
      environment: 'development',
      security: { enabled: true },
      caching: { fileCacheEnabled: true },
      rateLimiting: { enabled: true }
    };

    assert.doesNotThrow(() => validateConfig(validConfig));
  });

  await t.test('validateConfig() rejects invalid config', () => {
    const invalidConfig = {
      port: -1, // Invalid port
      environment: 'invalid'
    };

    assert.throws(() => validateConfig(invalidConfig));
  });

  await t.test('getConfigValue() retrieves nested values', () => {
    const config = {
      security: {
        enabled: true,
        cspEnabled: false
      }
    };

    assert.strictEqual(getConfigValue(config, 'security.enabled'), true);
    assert.strictEqual(getConfigValue(config, 'security.cspEnabled'), false);
    assert.strictEqual(getConfigValue(config, 'nonexistent'), undefined);
    assert.strictEqual(getConfigValue(config, 'nonexistent', 'default'), 'default');
  });

  await t.test('Security configuration validation', () => {
    const config = loadConfig();

    assert.strictEqual(typeof config.security.enabled, 'boolean');
    assert.strictEqual(typeof config.security.cspEnabled, 'boolean');
    assert(Array.isArray(config.security.allowedOrigins));
    assert(Array.isArray(config.security.allowedHosts));
  });

  await t.test('Caching configuration validation', () => {
    const config = loadConfig();

    assert.strictEqual(typeof config.caching.fileCacheEnabled, 'boolean');
    assert.strictEqual(typeof config.caching.fileCacheMaxSize, 'number');
    assert(config.caching.fileCacheMaxSize >= 0);
    assert.strictEqual(typeof config.caching.fileCacheMaxFileSize, 'number');
    assert(config.caching.fileCacheMaxFileSize > 0);
  });

  await t.test('Rate limiting configuration validation', () => {
    const config = loadConfig();

    assert.strictEqual(typeof config.rateLimiting.enabled, 'boolean');
    assert.strictEqual(typeof config.rateLimiting.maxRequests, 'number');
    assert(config.rateLimiting.maxRequests > 0);
    assert.strictEqual(typeof config.rateLimiting.windowMs, 'number');
    assert(config.rateLimiting.windowMs > 0);
  });

  await t.test('API configuration validation', () => {
    const config = loadConfig();

    assert.strictEqual(typeof config.api.enabled, 'boolean');
    assert.strictEqual(typeof config.api.maxConcurrentRequests, 'number');
    assert(config.api.maxConcurrentRequests > 0);
  });

  await t.test('File upload configuration validation', () => {
    const config = loadConfig();

    assert.strictEqual(typeof config.fileUpload.enabled, 'boolean');
    assert.strictEqual(typeof config.fileUpload.maxFileSize, 'number');
    assert(config.fileUpload.maxFileSize > 0);
    assert(Array.isArray(config.fileUpload.allowedTypes));
    assert(config.fileUpload.allowedTypes.length > 0);
  });

  await t.test('Internationalization configuration validation', () => {
    const config = loadConfig();

    assert.strictEqual(typeof config.i18n.enabled, 'boolean');
    assert.strictEqual(typeof config.i18n.defaultLanguage, 'string');
    assert(Array.isArray(config.i18n.supportedLanguages));
  });

  await t.test('Database configuration validation', () => {
    const config = loadConfig();

    assert.strictEqual(typeof config.database.enabled, 'boolean');
    assert.strictEqual(typeof config.database.maxConnections, 'number');
  });

  await t.test('Monitoring configuration validation', () => {
    const config = loadConfig();

    assert.strictEqual(typeof config.monitoring.enabled, 'boolean');
    assert.strictEqual(typeof config.monitoring.healthCheckEnabled, 'boolean');
    assert.strictEqual(typeof config.monitoring.metricsEnabled, 'boolean');
  });

  await t.test('Static files configuration validation', () => {
    const config = loadConfig();

    assert.strictEqual(typeof config.static.root, 'string');
    assert(Array.isArray(config.static.allowedPaths));
  });

  await t.test('Logging configuration validation', () => {
    const config = loadConfig();

    assert.strictEqual(typeof config.logging.level, 'string');
    assert.strictEqual(typeof config.logging.format, 'string');
  });

  await t.test('Notifications configuration validation', () => {
    const config = loadConfig();

    assert.strictEqual(typeof config.notifications.enabled, 'boolean');
    assert(Array.isArray(config.notifications.webhooks));
  });
});
