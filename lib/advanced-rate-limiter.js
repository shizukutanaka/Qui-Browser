/**
 * Advanced Rate Limiting System
 *
 * Per-user and per-API key rate limiting with quotas and tiered limits
 */

const crypto = require('crypto');

class AdvancedRateLimiter {
  constructor(config) {
    this.config = config;
    this.limits = new Map(); // userId/apiKey -> limit data
    this.requests = new Map(); // userId/apiKey -> request history
    this.quotas = new Map(); // userId/apiKey -> quota data
    this.tiers = this.initializeTiers();

    // Cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Clean up every minute
  }

  /**
   * Initialize predefined tiers
   */
  initializeTiers() {
    return {
      free: {
        name: 'Free',
        requestsPerHour: 100,
        requestsPerDay: 1000,
        burstLimit: 10,
        priority: 1
      },
      pro: {
        name: 'Professional',
        requestsPerHour: 1000,
        requestsPerDay: 10000,
        burstLimit: 50,
        priority: 2
      },
      enterprise: {
        name: 'Enterprise',
        requestsPerHour: 10000,
        requestsPerDay: 100000,
        burstLimit: 200,
        priority: 3
      },
      unlimited: {
        name: 'Unlimited',
        requestsPerHour: -1, // No limit
        requestsPerDay: -1,
        burstLimit: -1,
        priority: 4
      }
    };
  }

  /**
   * Check rate limit for a user/API key
   */
  async checkLimit(identifier, options = {}) {
    const {
      tier = 'free',
      customLimits = null,
      endpoint = null,
      method = 'GET'
    } = options;

    // Get limits for this identifier
    const limits = customLimits || this.getTierLimits(tier);

    // Skip rate limiting for unlimited tier
    if (limits.requestsPerHour === -1) {
      return {
        allowed: true,
        remaining: -1,
        resetTime: null,
        limit: -1,
        tier: tier
      };
    }

    // Get current request data
    const requestData = this.getRequestData(identifier);
    const now = Date.now();

    // Clean old requests
    this.cleanOldRequests(requestData, now);

    // Check hourly limit
    const hourlyRequests = this.getRequestsInWindow(requestData.requests, now, 60 * 60 * 1000);
    if (hourlyRequests >= limits.requestsPerHour) {
      return this.createLimitExceededResponse(requestData, limits, 'hour');
    }

    // Check daily limit
    const dailyRequests = this.getRequestsInWindow(requestData.requests, now, 24 * 60 * 60 * 1000);
    if (dailyRequests >= limits.requestsPerDay) {
      return this.createLimitExceededResponse(requestData, limits, 'day');
    }

    // Check burst limit (requests in last minute)
    const burstRequests = this.getRequestsInWindow(requestData.requests, now, 60 * 1000);
    if (burstRequests >= limits.burstLimit) {
      return this.createLimitExceededResponse(requestData, limits, 'burst');
    }

    // Check endpoint-specific limits if configured
    if (endpoint && this.config.endpointLimits) {
      const endpointLimit = this.getEndpointLimit(endpoint, method, tier);
      if (endpointLimit) {
        const endpointRequests = this.getEndpointRequests(requestData, endpoint, now, endpointLimit.windowMs);
        if (endpointRequests >= endpointLimit.requests) {
          return this.createLimitExceededResponse(requestData, endpointLimit, 'endpoint');
        }
      }
    }

    // Record this request
    requestData.requests.push({
      timestamp: now,
      endpoint: endpoint,
      method: method
    });

    // Update stored data
    this.requests.set(identifier, requestData);

    // Calculate remaining requests
    const remainingHourly = Math.max(0, limits.requestsPerHour - hourlyRequests - 1);
    const remainingDaily = Math.max(0, limits.requestsPerDay - dailyRequests - 1);

    return {
      allowed: true,
      remaining: Math.min(remainingHourly, remainingDaily),
      resetTime: this.getResetTime(now, requestData.requests, limits),
      limit: Math.min(limits.requestsPerHour, limits.requestsPerDay),
      tier: tier
    };
  }

  /**
   * Set custom limits for a user/API key
   */
  setCustomLimits(identifier, limits) {
    this.limits.set(identifier, {
      ...limits,
      custom: true,
      setAt: Date.now()
    });
  }

  /**
   * Get tier limits
   */
  getTierLimits(tier) {
    return this.tiers[tier] || this.tiers.free;
  }

  /**
   * Get endpoint-specific limits
   */
  getEndpointLimit(endpoint, method, tier) {
    const endpointConfig = this.config.endpointLimits?.[endpoint];
    if (!endpointConfig) return null;

    const methodLimits = endpointConfig[method] || endpointConfig['*'];
    if (!methodLimits) return null;

    // Check if tier has specific limits
    if (methodLimits[tier]) {
      return methodLimits[tier];
    }

    // Fall back to default
    return methodLimits.default || methodLimits;
  }

  /**
   * Get request data for identifier
   */
  getRequestData(identifier) {
    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, {
        requests: [],
        createdAt: Date.now()
      });
    }
    return this.requests.get(identifier);
  }

  /**
   * Clean old requests outside the retention window
   */
  cleanOldRequests(requestData, now) {
    const retentionMs = 24 * 60 * 60 * 1000; // 24 hours
    requestData.requests = requestData.requests.filter(
      req => (now - req.timestamp) < retentionMs
    );
  }

  /**
   * Get requests in a time window
   */
  getRequestsInWindow(requests, now, windowMs) {
    const windowStart = now - windowMs;
    return requests.filter(req => req.timestamp >= windowStart).length;
  }

  /**
   * Get endpoint-specific requests
   */
  getEndpointRequests(requestData, endpoint, now, windowMs) {
    const windowStart = now - windowMs;
    return requestData.requests.filter(req =>
      req.timestamp >= windowStart &&
      req.endpoint === endpoint
    ).length;
  }

  /**
   * Create limit exceeded response
   */
  createLimitExceededResponse(requestData, limits, type) {
    const now = Date.now();
    const resetTime = this.getResetTime(now, requestData.requests, limits);

    return {
      allowed: false,
      remaining: 0,
      resetTime: resetTime,
      limit: limits.requests || limits.requestsPerHour || limits.requestsPerDay,
      retryAfter: Math.ceil((resetTime - now) / 1000),
      tier: limits.name || 'unknown',
      limitType: type
    };
  }

  /**
   * Calculate reset time
   */
  getResetTime(now, requests, limits) {
    if (requests.length === 0) return now;

    // Find the oldest request in the current window
    const sortedRequests = requests
      .map(req => req.timestamp)
      .sort((a, b) => a - b);

    // Reset time is when the oldest request expires
    const windowMs = Math.min(
      limits.requestsPerHour ? 60 * 60 * 1000 : Infinity,
      limits.requestsPerDay ? 24 * 60 * 60 * 1000 : Infinity,
      limits.windowMs || Infinity
    );

    return sortedRequests[0] + windowMs;
  }

  /**
   * Get usage statistics
   */
  getUsageStats(identifier) {
    const requestData = this.requests.get(identifier);
    if (!requestData) {
      return {
        totalRequests: 0,
        hourlyRequests: 0,
        dailyRequests: 0,
        firstRequest: null,
        lastRequest: null
      };
    }

    const now = Date.now();
    const requests = requestData.requests;

    return {
      totalRequests: requests.length,
      hourlyRequests: this.getRequestsInWindow(requests, now, 60 * 60 * 1000),
      dailyRequests: this.getRequestsInWindow(requests, now, 24 * 60 * 60 * 1000),
      firstRequest: requests.length > 0 ? Math.min(...requests.map(r => r.timestamp)) : null,
      lastRequest: requests.length > 0 ? Math.max(...requests.map(r => r.timestamp)) : null,
      createdAt: requestData.createdAt
    };
  }

  /**
   * Get global statistics
   */
  getGlobalStats() {
    const now = Date.now();
    const stats = {
      totalIdentifiers: this.requests.size,
      totalRequests: 0,
      hourlyRequests: 0,
      dailyRequests: 0,
      tierDistribution: {},
      topIdentifiers: []
    };

    // Calculate totals
    for (const [identifier, requestData] of this.requests) {
      const identifierStats = this.getUsageStats(identifier);
      stats.totalRequests += identifierStats.totalRequests;
      stats.hourlyRequests += identifierStats.hourlyRequests;
      stats.dailyRequests += identifierStats.dailyRequests;

      // Track tier distribution (this would need to be enhanced)
      const tier = this.getIdentifierTier(identifier);
      stats.tierDistribution[tier] = (stats.tierDistribution[tier] || 0) + 1;
    }

    // Get top identifiers by request count
    const identifierStats = Array.from(this.requests.entries())
      .map(([id, data]) => ({
        identifier: id,
        requests: data.requests.length,
        tier: this.getIdentifierTier(id)
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    stats.topIdentifiers = identifierStats;

    return stats;
  }

  /**
   * Get tier for identifier (simplified)
   */
  getIdentifierTier(identifier) {
    // In a real implementation, this would look up the user's tier
    // from a database or configuration
    return 'free'; // Default fallback
  }

  /**
   * Reset limits for identifier
   */
  resetLimits(identifier) {
    this.requests.delete(identifier);
    this.limits.delete(identifier);
  }

  /**
   * Set quota for identifier
   */
  setQuota(identifier, quota) {
    this.quotas.set(identifier, {
      ...quota,
      setAt: Date.now(),
      used: 0
    });
  }

  /**
   * Check quota for identifier
   */
  checkQuota(identifier) {
    const quota = this.quotas.get(identifier);
    if (!quota) return null;

    const usage = this.getUsageStats(identifier);

    return {
      limit: quota.limit,
      used: usage.totalRequests,
      remaining: Math.max(0, quota.limit - usage.totalRequests),
      resetTime: quota.resetTime,
      period: quota.period
    };
  }

  /**
   * Cleanup old data
   */
  cleanup() {
    const now = Date.now();
    const retentionMs = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up old request data
    for (const [identifier, requestData] of this.requests) {
      this.cleanOldRequests(requestData, now);

      // Remove completely if no recent requests
      if (requestData.requests.length === 0 &&
          (now - requestData.createdAt) > retentionMs) {
        this.requests.delete(identifier);
      }
    }

    // Clean up expired custom limits
    for (const [identifier, limitData] of this.limits) {
      if (limitData.expiresAt && now > limitData.expiresAt) {
        this.limits.delete(identifier);
      }
    }

    // Clean up expired quotas
    for (const [identifier, quotaData] of this.quotas) {
      if (quotaData.resetTime && now > quotaData.resetTime) {
        quotaData.used = 0;
        quotaData.resetTime = this.calculateNextReset(now, quotaData.period);
      }
    }
  }

  /**
   * Calculate next reset time
   */
  calculateNextReset(now, period) {
    const date = new Date(now);

    switch (period) {
      case 'hourly':
        date.setHours(date.getHours() + 1, 0, 0, 0);
        break;
      case 'daily':
        date.setDate(date.getDate() + 1);
        date.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        date.setDate(date.getDate() + (7 - date.getDay()));
        date.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1, 1);
        date.setHours(0, 0, 0, 0);
        break;
      default:
        return null;
    }

    return date.getTime();
  }

  /**
   * Export configuration and state
   */
  exportConfig() {
    return {
      tiers: this.tiers,
      customLimits: Object.fromEntries(this.limits),
      quotas: Object.fromEntries(this.quotas),
      config: this.config
    };
  }

  /**
   * Import configuration and state
   */
  importConfig(data) {
    if (data.tiers) {
      this.tiers = { ...this.tiers, ...data.tiers };
    }
    if (data.customLimits) {
      this.limits = new Map(Object.entries(data.customLimits));
    }
    if (data.quotas) {
      this.quotas = new Map(Object.entries(data.quotas));
    }
  }

  /**
   * Destroy rate limiter
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.limits.clear();
    this.requests.clear();
    this.quotas.clear();
  }
}

module.exports = AdvancedRateLimiter;
