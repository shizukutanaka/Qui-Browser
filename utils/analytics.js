const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * Analytics Event
 */
class AnalyticsEvent {
  constructor(name, properties = {}, options = {}) {
    this.id = options.id || crypto.randomUUID();
    this.name = name;
    this.properties = properties;
    this.timestamp = options.timestamp || Date.now();
    this.sessionId = options.sessionId || null;
    this.userId = options.userId || null;
    this.deviceId = options.deviceId || null;
    this.context = options.context || {};
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      properties: this.properties,
      timestamp: this.timestamp,
      sessionId: this.sessionId,
      userId: this.userId,
      deviceId: this.deviceId,
      context: this.context
    };
  }
}

/**
 * User Session
 */
class UserSession {
  constructor(sessionId, options = {}) {
    this.sessionId = sessionId;
    this.userId = options.userId || null;
    this.deviceId = options.deviceId || null;
    this.startTime = options.startTime || Date.now();
    this.lastActivityTime = this.startTime;
    this.events = [];
    this.pageViews = [];
    this.properties = options.properties || {};
    this.active = true;
  }

  /**
   * Add event to session
   */
  addEvent(event) {
    this.events.push(event);
    this.lastActivityTime = event.timestamp;
  }

  /**
   * Add page view
   */
  addPageView(url, title, referrer = null) {
    const pageView = {
      url,
      title,
      referrer,
      timestamp: Date.now()
    };
    this.pageViews.push(pageView);
    this.lastActivityTime = pageView.timestamp;
  }

  /**
   * Get session duration in milliseconds
   */
  getDuration() {
    return this.lastActivityTime - this.startTime;
  }

  /**
   * Check if session is expired
   */
  isExpired(timeout = 1800000) {
    // Default 30 minutes
    return Date.now() - this.lastActivityTime > timeout;
  }

  /**
   * End session
   */
  end() {
    this.active = false;
    this.endTime = Date.now();
  }

  /**
   * Get session statistics
   */
  getStats() {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      deviceId: this.deviceId,
      duration: this.getDuration(),
      eventCount: this.events.length,
      pageViewCount: this.pageViews.length,
      active: this.active,
      startTime: this.startTime,
      lastActivityTime: this.lastActivityTime,
      endTime: this.endTime || null
    };
  }
}

/**
 * Analytics Funnel
 */
class AnalyticsFunnel {
  constructor(name, steps, options = {}) {
    this.name = name;
    this.steps = steps; // Array of step names
    this.data = new Map(); // sessionId -> step progress
    this.completions = [];
    this.dropoffs = new Map(); // step -> count
    this.options = options;

    // Initialize dropoff tracking
    this.steps.forEach((step) => {
      this.dropoffs.set(step, 0);
    });
  }

  /**
   * Track step completion
   */
  trackStep(sessionId, stepName, timestamp = Date.now()) {
    if (!this.steps.includes(stepName)) {
      throw new Error(`Invalid step: ${stepName}`);
    }

    if (!this.data.has(sessionId)) {
      this.data.set(sessionId, {
        sessionId,
        steps: [],
        startTime: timestamp,
        completed: false
      });
    }

    const progress = this.data.get(sessionId);

    // Add step if not already completed
    if (!progress.steps.some((s) => s.name === stepName)) {
      progress.steps.push({
        name: stepName,
        timestamp,
        index: this.steps.indexOf(stepName)
      });

      // Check if funnel completed
      if (progress.steps.length === this.steps.length) {
        progress.completed = true;
        progress.endTime = timestamp;
        this.completions.push({
          sessionId,
          duration: timestamp - progress.startTime,
          timestamp
        });
      }
    }
  }

  /**
   * Calculate conversion rate
   */
  getConversionRate() {
    const total = this.data.size;
    const completed = this.completions.length;
    return total > 0 ? completed / total : 0;
  }

  /**
   * Get step-by-step conversion
   */
  getStepConversion() {
    const conversion = [];
    let previous = this.data.size;

    this.steps.forEach((step, index) => {
      const reached = Array.from(this.data.values()).filter((progress) =>
        progress.steps.some((s) => s.name === step)
      ).length;

      const rate = previous > 0 ? reached / previous : 0;

      conversion.push({
        step,
        index,
        reached,
        rate,
        dropoff: previous - reached
      });

      previous = reached;
    });

    return conversion;
  }

  /**
   * Get average completion time
   */
  getAverageCompletionTime() {
    if (this.completions.length === 0) return 0;

    const total = this.completions.reduce((sum, c) => sum + c.duration, 0);
    return total / this.completions.length;
  }

  /**
   * Get funnel statistics
   */
  getStats() {
    return {
      name: this.name,
      steps: this.steps,
      totalSessions: this.data.size,
      completions: this.completions.length,
      conversionRate: this.getConversionRate(),
      averageCompletionTime: this.getAverageCompletionTime(),
      stepConversion: this.getStepConversion()
    };
  }
}

/**
 * A/B Test
 */
class ABTest {
  constructor(name, variants, options = {}) {
    this.name = name;
    this.variants = variants; // Array of variant names
    this.assignments = new Map(); // userId -> variant
    this.results = new Map(); // variant -> {conversions, total}
    this.options = {
      algorithm: 'random', // 'random' or 'weighted'
      weights: options.weights || {}, // variant -> weight
      ...options
    };

    // Initialize results tracking
    this.variants.forEach((variant) => {
      this.results.set(variant, {
        variant,
        conversions: 0,
        total: 0,
        revenue: 0
      });
    });
  }

  /**
   * Assign user to variant
   */
  assignVariant(userId) {
    // Check if already assigned
    if (this.assignments.has(userId)) {
      return this.assignments.get(userId);
    }

    let variant;

    if (this.options.algorithm === 'weighted' && Object.keys(this.options.weights).length > 0) {
      variant = this.weightedRandom();
    } else {
      // Random assignment
      const index = Math.floor(Math.random() * this.variants.length);
      variant = this.variants[index];
    }

    this.assignments.set(userId, variant);

    // Increment total for this variant
    const result = this.results.get(variant);
    result.total++;

    return variant;
  }

  /**
   * Weighted random selection
   */
  weightedRandom() {
    const totalWeight = this.variants.reduce((sum, variant) => {
      return sum + (this.options.weights[variant] || 1);
    }, 0);

    let random = Math.random() * totalWeight;

    for (const variant of this.variants) {
      const weight = this.options.weights[variant] || 1;
      if (random < weight) {
        return variant;
      }
      random -= weight;
    }

    return this.variants[0];
  }

  /**
   * Track conversion
   */
  trackConversion(userId, revenue = 0) {
    const variant = this.assignments.get(userId);
    if (!variant) {
      throw new Error(`User ${userId} not assigned to test`);
    }

    const result = this.results.get(variant);
    result.conversions++;
    result.revenue += revenue;
  }

  /**
   * Get variant performance
   */
  getVariantStats(variant) {
    const result = this.results.get(variant);
    if (!result) {
      throw new Error(`Invalid variant: ${variant}`);
    }

    const conversionRate = result.total > 0 ? result.conversions / result.total : 0;
    const avgRevenue = result.conversions > 0 ? result.revenue / result.conversions : 0;

    return {
      variant: result.variant,
      total: result.total,
      conversions: result.conversions,
      conversionRate,
      revenue: result.revenue,
      avgRevenue
    };
  }

  /**
   * Get all results
   */
  getResults() {
    return this.variants.map((variant) => this.getVariantStats(variant));
  }

  /**
   * Get winning variant
   */
  getWinner() {
    const results = this.getResults();
    return results.reduce((winner, current) => {
      return current.conversionRate > winner.conversionRate ? current : winner;
    });
  }
}

/**
 * Analytics Tracker
 */
class AnalyticsTracker extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      sessionTimeout: 1800000, // 30 minutes
      batchSize: 50,
      flushInterval: 30000, // 30 seconds
      enableAutoTrack: true,
      ...options
    };

    this.events = [];
    this.sessions = new Map();
    this.funnels = new Map();
    this.abTests = new Map();
    this.metrics = {
      eventsTracked: 0,
      sessionsCreated: 0,
      pageViews: 0,
      errors: 0
    };

    // Auto-flush timer
    if (this.config.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }
  }

  /**
   * Track event
   */
  track(eventName, properties = {}, options = {}) {
    const event = new AnalyticsEvent(eventName, properties, options);

    this.events.push(event);
    this.metrics.eventsTracked++;

    // Add to session if sessionId provided
    if (event.sessionId && this.sessions.has(event.sessionId)) {
      const session = this.sessions.get(event.sessionId);
      session.addEvent(event);
    }

    this.emit('event', event);

    // Auto-flush if batch size reached
    if (this.events.length >= this.config.batchSize) {
      this.flush();
    }

    return event;
  }

  /**
   * Track page view
   */
  trackPageView(url, title, options = {}) {
    const properties = {
      url,
      title,
      referrer: options.referrer || null,
      ...options.properties
    };

    const event = this.track('pageview', properties, options);

    this.metrics.pageViews++;

    // Add to session
    if (options.sessionId && this.sessions.has(options.sessionId)) {
      const session = this.sessions.get(options.sessionId);
      session.addPageView(url, title, options.referrer);
    }

    return event;
  }

  /**
   * Create or get session
   */
  getSession(sessionId, options = {}) {
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId);

      // Check if expired
      if (session.isExpired(this.config.sessionTimeout)) {
        session.end();
        this.emit('session-end', session);

        // Create new session
        const newSession = new UserSession(sessionId, options);
        this.sessions.set(sessionId, newSession);
        this.metrics.sessionsCreated++;
        this.emit('session-start', newSession);
        return newSession;
      }

      return session;
    }

    // Create new session
    const session = new UserSession(sessionId, options);
    this.sessions.set(sessionId, session);
    this.metrics.sessionsCreated++;
    this.emit('session-start', session);
    return session;
  }

  /**
   * End session
   */
  endSession(sessionId) {
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId);
      session.end();
      this.emit('session-end', session);
      return session;
    }
    return null;
  }

  /**
   * Create funnel
   */
  createFunnel(name, steps, options = {}) {
    const funnel = new AnalyticsFunnel(name, steps, options);
    this.funnels.set(name, funnel);
    return funnel;
  }

  /**
   * Get funnel
   */
  getFunnel(name) {
    return this.funnels.get(name);
  }

  /**
   * Create A/B test
   */
  createABTest(name, variants, options = {}) {
    const test = new ABTest(name, variants, options);
    this.abTests.set(name, test);
    return test;
  }

  /**
   * Get A/B test
   */
  getABTest(name) {
    return this.abTests.get(name);
  }

  /**
   * Flush events
   */
  flush() {
    if (this.events.length === 0) return [];

    const batch = [...this.events];
    this.events = [];

    this.emit('flush', batch);

    return batch;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.metrics,
      queuedEvents: this.events.length,
      activeSessions: Array.from(this.sessions.values()).filter((s) => s.active).length,
      funnels: this.funnels.size,
      abTests: this.abTests.size
    };
  }

  /**
   * Cleanup expired sessions
   */
  cleanupSessions() {
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions) {
      if (session.isExpired(this.config.sessionTimeout) && !session.active) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Destroy tracker
   */
  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flush();
    this.removeAllListeners();
  }
}

module.exports = {
  AnalyticsEvent,
  UserSession,
  AnalyticsFunnel,
  ABTest,
  AnalyticsTracker
};
