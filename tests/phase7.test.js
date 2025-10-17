/**
 * Phase 7 Improvements Tests
 *
 * Tests for:
 * - Production Security Middleware (#3-10)
 * - UX Enhancements (#251-260)
 * - Error Boundary System (#321-323)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Import Phase 7 utilities
const {
  ProductionSecurityManager,
  CORSPolicyManager,
  HTTPSRedirectManager,
  SecurityHeadersEnforcer,
  SessionSecretValidator,
  WebhookSignatureValidator,
  APIKeyProtector
} = require('../utils/production-security');

const {
  LoadingStateManager,
  ErrorMessageConverter,
  FormValidator,
  AutocompleteManager,
  BookmarkManager,
  KeyboardShortcutsManager
} = require('../utils/ux-enhancements');

const {
  ErrorBoundary,
  ErrorBoundaryManager,
  FallbackUIGenerator,
  GracefulDegradationManager
} = require('../utils/error-boundary');

// ==================== Production Security Tests ====================

describe('Production Security', () => {
  it('should create CORS policy manager', () => {
    const manager = new CORSPolicyManager({
      origins: ['https://example.com']
    });

    assert.ok(manager);
    assert.strictEqual(manager.isOriginAllowed('https://example.com'), true);
    assert.strictEqual(manager.isOriginAllowed('https://evil.com'), false);
  });

  it('should never allow wildcard in production', () => {
    const manager = new CORSPolicyManager({
      allowWildcard: false,
      origins: []
    });

    assert.strictEqual(manager.isOriginAllowed('*'), false);
  });

  it('should match origin patterns', () => {
    const manager = new CORSPolicyManager({
      origins: ['https://*.example.com']
    });

    assert.strictEqual(manager.isOriginAllowed('https://app.example.com'), true);
    assert.strictEqual(manager.isOriginAllowed('https://api.example.com'), true);
    assert.strictEqual(manager.isOriginAllowed('https://example.com'), false);
  });

  it('should get CORS headers for allowed origin', () => {
    const manager = new CORSPolicyManager({
      origins: ['https://example.com'],
      credentials: true
    });

    const headers = manager.getHeaders('https://example.com');

    assert.strictEqual(headers['Access-Control-Allow-Origin'], 'https://example.com');
    assert.strictEqual(headers['Access-Control-Allow-Credentials'], 'true');
  });

  it('should create HTTPS redirect manager', () => {
    const manager = new HTTPSRedirectManager();
    assert.ok(manager);
  });

  it('should detect HTTPS connections', () => {
    const manager = new HTTPSRedirectManager({ trustProxy: true });

    const httpsReq = {
      protocol: 'https',
      headers: {}
    };

    const proxyReq = {
      protocol: 'http',
      headers: { 'x-forwarded-proto': 'https' }
    };

    assert.strictEqual(manager.isHTTPS(httpsReq), true);
    assert.strictEqual(manager.isHTTPS(proxyReq), true);
  });

  it('should generate HTTPS redirect URL', () => {
    const manager = new HTTPSRedirectManager();

    const req = {
      headers: { host: 'example.com' },
      url: '/path?query=1'
    };

    const redirectURL = manager.getRedirectURL(req);
    assert.strictEqual(redirectURL, 'https://example.com/path?query=1');
  });

  it('should create security headers enforcer', () => {
    const enforcer = new SecurityHeadersEnforcer();
    assert.ok(enforcer);
  });

  it('should validate session secret', () => {
    const validator = new SessionSecretValidator({ minSecretLength: 32 });

    const weak = validator.validate('short');
    assert.strictEqual(weak.valid, false);

    const good = validator.validate('a'.repeat(32));
    assert.strictEqual(good.valid, true);

    const defaultSecret = validator.validate('secret');
    assert.strictEqual(defaultSecret.valid, false);
  });

  it('should generate strong session secret', () => {
    const validator = new SessionSecretValidator();
    const secret = validator.generateSecret(64);

    assert.ok(secret);
    assert.strictEqual(secret.length, 128); // Hex encoding doubles length
  });

  it('should validate webhook signatures', () => {
    const validator = new WebhookSignatureValidator({
      requireTimestamp: false
    });

    const payload = 'test payload';
    const secret = 'whsec_test_secret';

    const crypto = require('crypto');
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const result = validator.validateHMACSignature(payload, signature, secret);
    assert.strictEqual(result.valid, true);
  });

  it('should reject invalid webhook signatures', () => {
    const validator = new WebhookSignatureValidator();

    const payload = 'test payload';
    const secret = 'whsec_test_secret';
    const wrongSignature = 'invalid_signature';

    const result = validator.validateHMACSignature(payload, wrongSignature, secret);
    assert.strictEqual(result.valid, false);
  });

  it('should detect API keys in text', () => {
    const protector = new APIKeyProtector();

    const text = 'Your API key is sk_live_abc123def456ghi789xyz';
    const detected = protector.detectKeys(text);

    assert.ok(detected.length > 0);
  });

  it('should mask API keys', () => {
    const protector = new APIKeyProtector({ maskLength: 4 });

    const key = 'sk_live_1234567890';
    const masked = protector.maskKey(key);

    assert.ok(masked.includes('****'));
    assert.ok(masked.endsWith('7890'));
  });

  it('should sanitize error messages', () => {
    const protector = new APIKeyProtector();

    const error = new Error('Connection failed with API key: sk_live_abc123def456ghi789xyz');
    const sanitized = protector.sanitizeError(error);

    assert.ok(!sanitized.message.includes('sk_live_abc123def456ghi789xyz'));
    assert.strictEqual(sanitized.keysDetected, true);
  });

  it('should create production security manager', () => {
    const manager = new ProductionSecurityManager({
      cors: { origins: ['https://example.com'] },
      https: { enabled: true }
    });

    assert.ok(manager);
    assert.ok(manager.cors);
    assert.ok(manager.https);
  });

  it('should validate startup configuration', () => {
    const manager = new ProductionSecurityManager({
      session: { requireSecret: true }
    });

    const invalid = manager.validateStartup({ sessionSecret: 'weak' });
    assert.strictEqual(invalid.valid, false);
    assert.ok(invalid.errors.length > 0);

    const valid = manager.validateStartup({
      sessionSecret: 'a'.repeat(64)
    });
    assert.strictEqual(valid.valid, true);
  });
});

// ==================== UX Enhancements Tests ====================

describe('UX Enhancements', () => {
  it('should create loading state manager', () => {
    const manager = new LoadingStateManager();
    assert.ok(manager);
  });

  it('should start and stop loading states', async () => {
    const manager = new LoadingStateManager({ minDisplayTime: 100 });

    const state = manager.start('test-loader');
    assert.ok(state);
    assert.strictEqual(state.id, 'test-loader');

    const active = manager.getActiveLoaders();
    assert.strictEqual(active.length, 1);

    await manager.stop('test-loader');

    const afterStop = manager.getActiveLoaders();
    assert.strictEqual(afterStop.length, 0);
  });

  it('should generate skeleton HTML', () => {
    const manager = new LoadingStateManager();

    const defaultSkeleton = manager.generateSkeletonHTML('default');
    const cardSkeleton = manager.generateSkeletonHTML('card');

    assert.ok(defaultSkeleton.includes('skeleton-loader'));
    assert.ok(cardSkeleton.includes('skeleton-card'));
  });

  it('should create error message converter', () => {
    const converter = new ErrorMessageConverter();
    assert.ok(converter);
  });

  it('should convert technical errors to user-friendly messages', () => {
    const converter = new ErrorMessageConverter();

    const error = { code: 'ECONNREFUSED', message: 'Connection refused' };
    const friendly = converter.convert(error);

    assert.strictEqual(friendly.title, 'Connection Failed');
    assert.ok(friendly.message.includes('Unable to connect'));
    assert.strictEqual(friendly.action, 'Retry');
  });

  it('should convert HTTP status codes', () => {
    const converter = new ErrorMessageConverter();

    const error404 = { statusCode: 404 };
    const friendly = converter.convert(error404);

    assert.strictEqual(friendly.title, 'Not Found');
  });

  it('should create form validator', () => {
    const validator = new FormValidator();
    assert.ok(validator);
  });

  it('should validate required fields', async () => {
    const validator = new FormValidator();
    validator.registerValidator('email', FormValidator.validators.required);

    const emptyResult = await validator.validate('email', '');
    assert.strictEqual(emptyResult.valid, false);

    const validResult = await validator.validate('email', 'test@example.com');
    assert.strictEqual(validResult.valid, true);
  });

  it('should validate email format', async () => {
    const validator = new FormValidator();
    validator.registerValidator('email', FormValidator.validators.email);

    const invalid = await validator.validate('email', 'not-an-email');
    assert.strictEqual(invalid.valid, false);

    const valid = await validator.validate('email', 'test@example.com');
    assert.strictEqual(valid.valid, true);
  });

  it('should validate URLs', async () => {
    const validator = new FormValidator();
    validator.registerValidator('url', FormValidator.validators.url);

    const invalid = await validator.validate('url', 'not a url');
    assert.strictEqual(invalid.valid, false);

    const valid = await validator.validate('url', 'https://example.com');
    assert.strictEqual(valid.valid, true);
  });

  it('should create autocomplete manager', () => {
    const manager = new AutocompleteManager();
    assert.ok(manager);
  });

  it('should get autocomplete suggestions', async () => {
    const manager = new AutocompleteManager({ minChars: 2 });

    manager.registerProvider('test', async (query) => {
      return [
        { type: 'url', value: 'https://example.com', label: 'Example' }
      ];
    });

    const suggestions = await manager.getSuggestions('ex', 'test');
    assert.strictEqual(suggestions.length, 1);
    assert.strictEqual(suggestions[0].value, 'https://example.com');
  });

  it('should limit autocomplete suggestions', async () => {
    const manager = new AutocompleteManager({ maxSuggestions: 3 });

    manager.registerProvider('test', async (query) => {
      return Array.from({ length: 10 }, (_, i) => ({
        type: 'url',
        value: `https://example${i}.com`,
        label: `Example ${i}`
      }));
    });

    const suggestions = await manager.getSuggestions('example', 'test');
    assert.strictEqual(suggestions.length, 3);
  });

  it('should create bookmark manager', () => {
    const manager = new BookmarkManager();
    assert.ok(manager);
  });

  it('should add and remove bookmarks', () => {
    const manager = new BookmarkManager();

    const bookmark = manager.addBookmark({
      title: 'Example',
      url: 'https://example.com',
      tags: ['test']
    });

    assert.ok(bookmark.id);
    assert.strictEqual(bookmark.title, 'Example');

    const removed = manager.removeBookmark(bookmark.id);
    assert.strictEqual(removed, true);
  });

  it('should create folders', () => {
    const manager = new BookmarkManager();

    const folder = manager.createFolder('Work');
    assert.ok(folder.id);
    assert.strictEqual(folder.name, 'Work');
  });

  it('should search bookmarks', () => {
    const manager = new BookmarkManager();

    manager.addBookmark({
      title: 'Example Site',
      url: 'https://example.com',
      tags: ['test']
    });

    manager.addBookmark({
      title: 'Test Site',
      url: 'https://test.com',
      tags: ['example']
    });

    const results = manager.search('example');
    assert.ok(results.length >= 1);
  });

  it('should get bookmarks by tag', () => {
    const manager = new BookmarkManager();

    manager.addBookmark({
      title: 'Site 1',
      url: 'https://example1.com',
      tags: ['important']
    });

    manager.addBookmark({
      title: 'Site 2',
      url: 'https://example2.com',
      tags: ['important', 'work']
    });

    const important = manager.getByTag('important');
    assert.strictEqual(important.length, 2);
  });

  it('should create keyboard shortcuts manager', () => {
    const manager = new KeyboardShortcutsManager();
    assert.ok(manager);
  });

  it('should register and trigger shortcuts', () => {
    const manager = new KeyboardShortcutsManager();

    let triggered = false;
    manager.register('ctrl+k', 'search', 'Open search');

    manager.on('shortcut-triggered', (data) => {
      if (data.action === 'search') {
        triggered = true;
      }
    });

    const event = {
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      key: 'k'
    };

    manager.handleKeyEvent(event);
    assert.strictEqual(triggered, true);
  });

  it('should normalize key combinations', () => {
    const manager = new KeyboardShortcutsManager();

    const normalized1 = manager.normalizeKeys('Ctrl+Shift+K');
    const normalized2 = manager.normalizeKeys('shift+ctrl+K');

    assert.strictEqual(normalized1, normalized2);
  });
});

// ==================== Error Boundary Tests ====================

describe('Error Boundary System', () => {
  it('should create error boundary', () => {
    const boundary = new ErrorBoundary('test');
    assert.ok(boundary);
    assert.strictEqual(boundary.name, 'test');
  });

  it('should catch and handle errors', async () => {
    const boundary = new ErrorBoundary('test', { maxRetries: 0 });

    // Add error listener to prevent unhandled error
    boundary.on('error', () => {});

    boundary.setComponent(async () => {
      throw new Error('Test error');
    });

    boundary.setFallback(async (error) => {
      return 'Fallback result';
    });

    const result = await boundary.execute();
    assert.strictEqual(result, 'Fallback result');
    assert.strictEqual(boundary.state.hasError, true);
  });

  it('should retry on error', async () => {
    const boundary = new ErrorBoundary('test', { maxRetries: 2, retryDelay: 10 });

    // Add error listener to prevent unhandled error
    boundary.on('error', () => {});

    let attempts = 0;
    boundary.setComponent(async () => {
      attempts++;
      if (attempts < 2) {
        throw new Error('Retry me');
      }
      return 'Success';
    });

    const result = await boundary.execute();
    assert.strictEqual(result, 'Success');
    assert.strictEqual(attempts, 2);
  });

  it('should reset boundary state', () => {
    const boundary = new ErrorBoundary('test');
    boundary.state.hasError = true;
    boundary.state.errorCount = 5;

    boundary.reset();

    assert.strictEqual(boundary.state.hasError, false);
    assert.strictEqual(boundary.state.errorCount, 0);
  });

  it('should create fallback UI generator', () => {
    const generator = new FallbackUIGenerator();
    assert.ok(generator);
  });

  it('should generate fallback UI', () => {
    const generator = new FallbackUIGenerator();

    const error = new Error('Test error');
    const ui = generator.generate(error, 'default');

    assert.ok(ui.html);
    assert.ok(ui.css);
    assert.ok(ui.html.includes('Something went wrong'));
  });

  it('should create graceful degradation manager', () => {
    const manager = new GracefulDegradationManager();
    assert.ok(manager);
  });

  it('should register and degrade features', () => {
    const manager = new GracefulDegradationManager();

    manager.registerFeature('search', {
      full: 'Full-text search',
      limited: 'Simple search',
      minimal: 'No search',
      disabled: 'Disabled'
    });

    const initialLevel = manager.getFeatureLevel('search');
    assert.strictEqual(initialLevel, 'full');

    const degradedLevel = manager.degradeFeature('search');
    assert.strictEqual(degradedLevel, 'limited');

    const available = manager.isFeatureAvailable('search', 'full');
    assert.strictEqual(available, false);
  });

  it('should restore degraded features', () => {
    const manager = new GracefulDegradationManager();

    manager.registerFeature('analytics', {});
    manager.degradeFeature('analytics');
    manager.degradeFeature('analytics');

    const beforeRestore = manager.getFeatureLevel('analytics');
    assert.strictEqual(beforeRestore, 'minimal');

    manager.restoreFeature('analytics');

    const afterRestore = manager.getFeatureLevel('analytics');
    assert.strictEqual(afterRestore, 'limited');
  });

  it('should create error boundary manager', () => {
    const manager = new ErrorBoundaryManager();
    assert.ok(manager);
  });

  it('should create and manage multiple boundaries', async () => {
    const manager = new ErrorBoundaryManager({ maxRetries: 0 });

    const boundary1 = manager.createBoundary(
      'boundary1',
      async () => 'Success 1',
      null
    );

    const boundary2 = manager.createBoundary(
      'boundary2',
      async () => {
        throw new Error('Error 2');
      },
      async () => 'Fallback 2'
    );

    const result1 = await manager.execute('boundary1');
    const result2 = await manager.execute('boundary2');

    assert.strictEqual(result1, 'Success 1');
    assert.strictEqual(result2, 'Fallback 2');
  });

  it('should get boundary statistics', async () => {
    const manager = new ErrorBoundaryManager({ maxRetries: 0 });

    manager.createBoundary(
      'test1',
      async () => {
        throw new Error('Test');
      },
      async () => 'Fallback'
    );

    await manager.execute('test1');

    const stats = manager.getStatistics();
    assert.strictEqual(stats.totalBoundaries, 1);
    assert.strictEqual(stats.boundariesWithErrors, 1);
    assert.strictEqual(stats.totalErrors, 1);
  });

  it('should reset all boundaries', async () => {
    const manager = new ErrorBoundaryManager({ maxRetries: 0 });

    manager.createBoundary(
      'test1',
      async () => {
        throw new Error('Test');
      },
      async () => 'Fallback'
    );

    await manager.execute('test1');
    manager.resetAll();

    const stats = manager.getStatistics();
    assert.strictEqual(stats.boundariesWithErrors, 0);
  });
});

console.log('All Phase 7 tests completed!');
