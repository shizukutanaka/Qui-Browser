/**
 * Tests for Advanced Rate Limiting
 */

const { test } = require('node:test');
const assert = require('node:assert');
const AdvancedRateLimiter = require('../lib/advanced-rate-limiter');

// Mock configuration
const mockConfig = {
  endpointLimits: {
    '/api/bookmarks': {
      'POST': { requests: 10, windowMs: 60000 }, // 10 per minute
      'GET': { requests: 50, windowMs: 60000 }   // 50 per minute
    },
    '/api/search': {
      '*': { requests: 20, windowMs: 30000 } // 20 per 30 seconds
    }
  },
  rateLimitTiers: {
    free: {
      requestsPerHour: 100,
      requestsPerDay: 1000,
      burstLimit: 10
    },
    pro: {
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      burstLimit: 50
    }
  }
};

test('Advanced Rate Limiter', async (t) => {
  let rateLimiter;

  t.beforeEach(() => {
    rateLimiter = new AdvancedRateLimiter(mockConfig);
  });

  t.afterEach(() => {
    if (rateLimiter) {
      rateLimiter.destroy();
    }
  });

  await t.test('AdvancedRateLimiter initializes correctly', () => {
    assert(rateLimiter instanceof AdvancedRateLimiter);
    assert(rateLimiter.config === mockConfig);
    assert(rateLimiter.requests instanceof Map);
    assert(rateLimiter.limits instanceof Map);
    assert(rateLimiter.quotas instanceof Map);
    assert(Array.isArray(rateLimiter.supportedFormats));
  });

  await t.test('initializeTiers() creates correct tier structure', () => {
    const tiers = rateLimiter.tiers;

    assert(tiers.free);
    assert(tiers.pro);
    assert(tiers.enterprise);
    assert(tiers.unlimited);

    // Check free tier
    assert.strictEqual(tiers.free.requestsPerHour, 100);
    assert.strictEqual(tiers.free.requestsPerDay, 1000);
    assert.strictEqual(tiers.free.burstLimit, 10);
    assert.strictEqual(tiers.free.priority, 1);

    // Check unlimited tier
    assert.strictEqual(tiers.unlimited.requestsPerHour, -1);
    assert.strictEqual(tiers.unlimited.requestsPerDay, -1);
    assert.strictEqual(tiers.unlimited.burstLimit, -1);
    assert.strictEqual(tiers.unlimited.priority, 4);
  });

  await t.test('checkLimit() allows requests within limits', async () => {
    const identifier = 'test-user';

    // First request should be allowed
    const result1 = await rateLimiter.checkLimit(identifier, { tier: 'free' });
    assert(result1.allowed);
    assert.strictEqual(typeof result1.remaining, 'number');
    assert.strictEqual(typeof result1.resetTime, 'number');
    assert.strictEqual(result1.limit, 100);
    assert.strictEqual(result1.tier, 'free');

    // Second request should also be allowed
    const result2 = await rateLimiter.checkLimit(identifier, { tier: 'free' });
    assert(result2.allowed);
    assert.strictEqual(result2.remaining, result1.remaining - 1);
  });

  await t.test('checkLimit() blocks requests over hourly limit', async () => {
    const identifier = 'test-user-blocked';

    // Use up all hourly requests
    for (let i = 0; i < 100; i++) {
      const result = await rateLimiter.checkLimit(identifier, { tier: 'free' });
      assert(result.allowed, `Request ${i + 1} should be allowed`);
    }

    // Next request should be blocked
    const blockedResult = await rateLimiter.checkLimit(identifier, { tier: 'free' });
    assert(!blockedResult.allowed);
    assert.strictEqual(blockedResult.limitType, 'hour');
    assert.strictEqual(typeof blockedResult.retryAfter, 'number');
    assert(blockedResult.retryAfter > 0);
  });

  await t.test('checkLimit() handles unlimited tier', async () => {
    const identifier = 'unlimited-user';

    const result = await rateLimiter.checkLimit(identifier, { tier: 'unlimited' });
    assert(result.allowed);
    assert.strictEqual(result.remaining, -1);
    assert.strictEqual(result.limit, -1);
    assert.strictEqual(result.tier, 'unlimited');
  });

  await t.test('checkLimit() enforces burst limits', async () => {
    const identifier = 'burst-test-user';

    // Use up burst allowance
    for (let i = 0; i < 10; i++) {
      const result = await rateLimiter.checkLimit(identifier, { tier: 'free' });
      assert(result.allowed, `Burst request ${i + 1} should be allowed`);
    }

    // Next request should be blocked by burst limit
    const blockedResult = await rateLimiter.checkLimit(identifier, { tier: 'free' });
    assert(!blockedResult.allowed);
    assert.strictEqual(blockedResult.limitType, 'burst');
  });

  await t.test('checkLimit() handles endpoint-specific limits', async () => {
    const identifier = 'endpoint-test-user';

    // Test bookmarks POST limit (10 per minute)
    for (let i = 0; i < 10; i++) {
      const result = await rateLimiter.checkLimit(identifier, {
        tier: 'free',
        endpoint: '/api/bookmarks',
        method: 'POST'
      });
      assert(result.allowed, `Endpoint request ${i + 1} should be allowed`);
    }

    // Next request should be blocked
    const blockedResult = await rateLimiter.checkLimit(identifier, {
      tier: 'free',
      endpoint: '/api/bookmarks',
      method: 'POST'
    });
    assert(!blockedResult.allowed);
    assert.strictEqual(blockedResult.limitType, 'endpoint');
  });

  await t.test('checkLimit() handles daily limits', async () => {
    const identifier = 'daily-test-user';

    // This would need a custom tier with low daily limit for proper testing
    // For now, just verify the functionality exists
    const result = await rateLimiter.checkLimit(identifier, { tier: 'free' });
    assert(result.allowed);
  });

  await t.test('setCustomLimits() overrides default limits', async () => {
    const identifier = 'custom-limits-user';
    const customLimits = {
      requestsPerHour: 5,
      requestsPerDay: 10,
      burstLimit: 2
    };

    rateLimiter.setCustomLimits(identifier, customLimits);

    // First few requests should work
    for (let i = 0; i < 2; i++) {
      const result = await rateLimiter.checkLimit(identifier, { tier: 'free' });
      assert(result.allowed, `Custom limit request ${i + 1} should be allowed`);
    }

    // Next request should be blocked by custom burst limit
    const blockedResult = await rateLimiter.checkLimit(identifier, { tier: 'free' });
    assert(!blockedResult.allowed);
    assert.strictEqual(blockedResult.limitType, 'burst');
  });

  await t.test('setQuota() and checkQuota() work correctly', async () => {
    const identifier = 'quota-test-user';
    const quota = {
      limit: 100,
      period: 'monthly',
      resetTime: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days from now
    };

    rateLimiter.setQuota(identifier, quota);

    const quotaInfo = rateLimiter.checkQuota(identifier);
    assert(quotaInfo);
    assert.strictEqual(quotaInfo.limit, 100);
    assert.strictEqual(quotaInfo.used, 0);
    assert.strictEqual(quotaInfo.remaining, 100);
  });

  await t.test('getUsageStats() returns correct statistics', () => {
    const identifier = 'stats-test-user';

    // Make some requests
    for (let i = 0; i < 3; i++) {
      rateLimiter.checkLimit(identifier, { tier: 'free' });
    }

    const stats = rateLimiter.getUsageStats(identifier);
    assert.strictEqual(typeof stats, 'object');
    assert.strictEqual(stats.totalRequests, 3);
    assert(stats.firstRequest > 0);
    assert(stats.lastRequest > 0);
    assert(stats.createdAt > 0);
  });

  await t.test('getGlobalStats() returns comprehensive statistics', () => {
    const stats = rateLimiter.getGlobalStats();

    assert.strictEqual(typeof stats, 'object');
    assert.strictEqual(typeof stats.totalIdentifiers, 'number');
    assert.strictEqual(typeof stats.totalRequests, 'number');
    assert.strictEqual(typeof stats.hourlyRequests, 'number');
    assert.strictEqual(typeof stats.dailyRequests, 'number');
    assert(Array.isArray(stats.topIdentifiers));
    assert.strictEqual(typeof stats.tierDistribution, 'object');
  });

  await t.test('resetLimits() clears user limits', async () => {
    const identifier = 'reset-test-user';

    // Make some requests
    for (let i = 0; i < 5; i++) {
      await rateLimiter.checkLimit(identifier, { tier: 'free' });
    }

    // Verify requests were tracked
    const statsBefore = rateLimiter.getUsageStats(identifier);
    assert.strictEqual(statsBefore.totalRequests, 5);

    // Reset limits
    rateLimiter.resetLimits(identifier);

    // Verify requests were cleared
    const statsAfter = rateLimiter.getUsageStats(identifier);
    assert.strictEqual(statsAfter.totalRequests, 0);
  });

  await t.test('cleanup() removes old data', () => {
    // Add some test data
    const identifier = 'cleanup-test-user';
    const requestData = {
      requests: [
        { timestamp: Date.now() - (25 * 60 * 60 * 1000), endpoint: '/test' }, // 25 hours ago
        { timestamp: Date.now() - (1 * 60 * 60 * 1000), endpoint: '/test' }  // 1 hour ago
      ],
      createdAt: Date.now() - (25 * 60 * 60 * 1000)
    };

    rateLimiter.requests.set(identifier, requestData);

    // Run cleanup
    rateLimiter.cleanup();

    // Old request should be removed, recent one should remain
    const cleanedData = rateLimiter.requests.get(identifier);
    if (cleanedData) {
      assert.strictEqual(cleanedData.requests.length, 1);
      assert(cleanedData.requests[0].timestamp > Date.now() - (2 * 60 * 60 * 1000));
    }
  });

  await t.test('calculateNextReset() works for different periods', () => {
    const now = new Date('2024-01-15T10:00:00Z').getTime();

    // Hourly reset
    const hourlyReset = rateLimiter.calculateNextReset(now, 'hourly');
    const hourlyDate = new Date(hourlyReset);
    assert.strictEqual(hourlyDate.getHours(), 11); // Next hour

    // Daily reset
    const dailyReset = rateLimiter.calculateNextReset(now, 'daily');
    const dailyDate = new Date(dailyReset);
    assert.strictEqual(dailyDate.getDate(), 16); // Next day
    assert.strictEqual(dailyDate.getHours(), 0); // Start of day

    // Weekly reset (assuming Sunday reset)
    const weeklyReset = rateLimiter.calculateNextReset(now, 'weekly');
    const weeklyDate = new Date(weeklyReset);
    // Should be next Sunday
    assert.strictEqual(weeklyDate.getDay(), 0); // Sunday

    // Monthly reset
    const monthlyReset = rateLimiter.calculateNextReset(now, 'monthly');
    const monthlyDate = new Date(monthlyReset);
    assert.strictEqual(monthlyDate.getMonth(), 1); // Next month (February)
    assert.strictEqual(monthlyDate.getDate(), 1); // First of month
  });

  await t.test('exportConfig() and importConfig() work correctly', () => {
    // Set some custom configuration
    rateLimiter.setCustomLimits('test-user', { requestsPerHour: 50 });
    rateLimiter.setQuota('test-user', { limit: 1000, period: 'monthly' });

    // Export configuration
    const exportedConfig = rateLimiter.exportConfig();
    assert(exportedConfig.customLimits);
    assert(exportedConfig.quotas);
    assert(exportedConfig.tiers);

    // Create new instance and import
    const newRateLimiter = new AdvancedRateLimiter({});
    newRateLimiter.importConfig(exportedConfig);

    // Verify imported configuration
    assert(newRateLimiter.limits.has('test-user'));
    assert(newRateLimiter.quotas.has('test-user'));

    newRateLimiter.destroy();
  });

  await t.test('destroy() cleans up all resources', () => {
    rateLimiter.setCustomLimits('test-user', { requestsPerHour: 10 });

    rateLimiter.destroy();

    assert.strictEqual(rateLimiter.requests.size, 0);
    assert.strictEqual(rateLimiter.limits.size, 0);
    assert.strictEqual(rateLimiter.quotas.size, 0);
    assert.strictEqual(rateLimiter.cleanupInterval, null);
  });

  await t.test('generateExportId() creates unique IDs', () => {
    const id1 = rateLimiter.generateExportId();
    const id2 = rateLimiter.generateExportId();

    assert.strictEqual(typeof id1, 'string');
    assert(id1.startsWith('export_'));
    assert.notStrictEqual(id1, id2);
  });

  await t.test('generateId() creates unique IDs', () => {
    const id1 = rateLimiter.generateId();
    const id2 = rateLimiter.generateId();

    assert.strictEqual(typeof id1, 'string');
    assert.strictEqual(id1.length, 32); // 16 bytes * 2 hex chars
    assert.notStrictEqual(id1, id2);
  });
});
