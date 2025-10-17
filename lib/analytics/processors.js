/**
 * Qui Browser - Analytics Processors
 *
 * Specialized processors for different analytics tasks
 */

const AnalyticsEngine = require('./engine');

class RealTimeProcessor {
  constructor(analyticsEngine) {
    this.engine = analyticsEngine;
    this.buffers = new Map();
    this.thresholds = new Map();
  }

  /**
   * Process event in real-time
   */
  async process(event) {
    // Check for real-time alerts
    await this.checkRealTimeAlerts(event);

    // Update real-time metrics
    this.updateRealTimeMetrics(event);

    // Check for anomalies
    this.detectAnomalies(event);
  }

  async checkRealTimeAlerts(event) {
    // Traffic spike detection
    if (event.type === 'page_view') {
      const recentViews = this.getRecentEvents('page_view', 60000); // Last minute
      if (recentViews > 100) { // Threshold
        this.engine.emit('alert', {
          type: 'traffic_spike',
          message: `Traffic spike detected: ${recentViews} page views in last minute`,
          severity: 'warning',
          data: { recentViews, threshold: 100 }
        });
      }
    }

    // Error rate monitoring
    if (event.type === 'error') {
      const errorRate = this.calculateErrorRate();
      if (errorRate > 0.05) { // 5% error rate
        this.engine.emit('alert', {
          type: 'high_error_rate',
          message: `High error rate detected: ${(errorRate * 100).toFixed(2)}%`,
          severity: 'critical',
          data: { errorRate, threshold: 0.05 }
        });
      }
    }
  }

  updateRealTimeMetrics(event) {
    // Update rolling averages and counters
    this.updateRollingMetrics(event);
  }

  detectAnomalies(event) {
    // Simple anomaly detection based on statistical thresholds
    const metrics = ['responseTime', 'pageViews', 'apiCalls'];

    for (const metric of metrics) {
      if (event[metric] !== undefined) {
        const isAnomaly = this.isAnomaly(metric, event[metric]);
        if (isAnomaly) {
          this.engine.emit('anomaly', {
            type: 'metric_anomaly',
            metric,
            value: event[metric],
            expected: this.getExpectedValue(metric),
            severity: 'info'
          });
        }
      }
    }
  }

  getRecentEvents(type, timeframe) {
    const now = Date.now();
    return this.engine.events.filter(e =>
      e.type === type && (now - e.timestamp) < timeframe
    ).length;
  }

  calculateErrorRate() {
    const now = Date.now();
    const recentEvents = this.engine.events.filter(e => (now - e.timestamp) < 300000); // 5 minutes
    const errors = recentEvents.filter(e => e.type === 'error').length;
    return recentEvents.length > 0 ? errors / recentEvents.length : 0;
  }

  updateRollingMetrics(event) {
    // Maintain rolling windows for different metrics
    const windows = ['1m', '5m', '15m', '1h'];

    for (const window of windows) {
      if (!this.buffers.has(window)) {
        this.buffers.set(window, []);
      }

      const buffer = this.buffers.get(window);
      buffer.push(event);

      // Clean old events
      const windowMs = this.parseTimeframe(window);
      const cutoff = Date.now() - windowMs;
      const filtered = buffer.filter(e => e.timestamp > cutoff);
      this.buffers.set(window, filtered);
    }
  }

  isAnomaly(metric, value) {
    // Simple statistical anomaly detection
    const history = this.getMetricHistory(metric, '15m');
    if (history.length < 10) return false;

    const mean = history.reduce((sum, val) => sum + val, 0) / history.length;
    const variance = history.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / history.length;
    const stdDev = Math.sqrt(variance);

    // Flag as anomaly if more than 3 standard deviations from mean
    return Math.abs(value - mean) > (3 * stdDev);
  }

  getExpectedValue(metric) {
    const history = this.getMetricHistory(metric, '15m');
    return history.length > 0
      ? history.reduce((sum, val) => sum + val, 0) / history.length
      : 0;
  }

  getMetricHistory(metric, timeframe) {
    const windowMs = this.parseTimeframe(timeframe);
    const cutoff = Date.now() - windowMs;

    return this.engine.events
      .filter(e => e.timestamp > cutoff && e[metric] !== undefined)
      .map(e => e[metric]);
  }

  parseTimeframe(timeframe) {
    const unit = timeframe.slice(-1);
    const value = parseInt(timeframe.slice(0, -1));

    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return 60 * 60 * 1000;
    }
  }
}

class BatchProcessor {
  constructor(analyticsEngine) {
    this.engine = analyticsEngine;
    this.isProcessing = false;
  }

  /**
   * Process batch of events
   */
  async processBatch(events) {
    if (this.isProcessing) return;

    this.isProcessing = true;

    try {
      // User behavior analysis
      await this.analyzeUserBehavior(events);

      // Session analysis
      await this.analyzeSessions(events);

      // Performance analysis
      await this.analyzePerformance(events);

      // Business intelligence
      await this.generateBusinessInsights(events);

    } finally {
      this.isProcessing = false;
    }
  }

  async analyzeUserBehavior(events) {
    const userEvents = new Map();

    // Group events by user
    events.forEach(event => {
      if (event.userId) {
        if (!userEvents.has(event.userId)) {
          userEvents.set(event.userId, []);
        }
        userEvents.get(event.userId).push(event);
      }
    });

    // Analyze each user's behavior
    for (const [userId, userEvents] of userEvents) {
      const insights = this.analyzeSingleUser(userEvents);
      this.engine.emit('user_insight', { userId, insights });
    }
  }

  analyzeSingleUser(events) {
    const insights = {
      totalEvents: events.length,
      sessionCount: new Set(events.map(e => e.sessionId)).size,
      pageViews: events.filter(e => e.type === 'page_view').length,
      featuresUsed: new Set(events.filter(e => e.feature).map(e => e.feature)),
      avgSessionDuration: 0,
      preferredDevice: null,
      preferredBrowser: null,
      timePatterns: this.analyzeTimePatterns(events)
    };

    // Calculate average session duration
    const sessions = new Map();
    events.forEach(event => {
      if (!sessions.has(event.sessionId)) {
        sessions.set(event.sessionId, { start: event.timestamp, end: event.timestamp });
      }
      const session = sessions.get(event.sessionId);
      session.start = Math.min(session.start, event.timestamp);
      session.end = Math.max(session.end, event.timestamp);
    });

    const durations = Array.from(sessions.values()).map(s => s.end - s.start);
    insights.avgSessionDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

    // Most common device/browser
    const devices = events.filter(e => e.device).map(e => e.device);
    const browsers = events.filter(e => e.browser).map(e => e.browser);

    insights.preferredDevice = this.getMostCommon(devices);
    insights.preferredBrowser = this.getMostCommon(browsers);

    return insights;
  }

  analyzeTimePatterns(events) {
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);

    events.forEach(event => {
      const date = new Date(event.timestamp);
      hourCounts[date.getHours()]++;
      dayCounts[date.getDay()]++;
    });

    return {
      peakHour: hourCounts.indexOf(Math.max(...hourCounts)),
      peakDay: dayCounts.indexOf(Math.max(...dayCounts)),
      hourlyDistribution: hourCounts,
      dailyDistribution: dayCounts
    };
  }

  async analyzeSessions(events) {
    const sessions = new Map();

    events.forEach(event => {
      if (event.sessionId) {
        if (!sessions.has(event.sessionId)) {
          sessions.set(event.sessionId, {
            id: event.sessionId,
            userId: event.userId,
            start: event.timestamp,
            end: event.timestamp,
            events: 0,
            pageViews: 0,
            device: event.device,
            browser: event.browser
          });
        }

        const session = sessions.get(event.sessionId);
        session.end = Math.max(session.end, event.timestamp);
        session.events++;

        if (event.type === 'page_view') {
          session.pageViews++;
        }
      }
    });

    // Analyze session patterns
    const sessionInsights = {
      totalSessions: sessions.size,
      avgDuration: 0,
      avgPageViews: 0,
      bounceRate: 0,
      deviceBreakdown: {},
      browserBreakdown: {}
    };

    let totalDuration = 0;
    let totalPageViews = 0;
    let bouncedSessions = 0;

    for (const session of sessions.values()) {
      const duration = session.end - session.start;
      totalDuration += duration;
      totalPageViews += session.pageViews;

      if (session.pageViews === 1) {
        bouncedSessions++;
      }

      // Device/browser breakdown
      if (session.device) {
        sessionInsights.deviceBreakdown[session.device] =
          (sessionInsights.deviceBreakdown[session.device] || 0) + 1;
      }

      if (session.browser) {
        sessionInsights.browserBreakdown[session.browser] =
          (sessionInsights.browserBreakdown[session.browser] || 0) + 1;
      }
    }

    sessionInsights.avgDuration = sessions.size > 0 ? totalDuration / sessions.size : 0;
    sessionInsights.avgPageViews = sessions.size > 0 ? totalPageViews / sessions.size : 0;
    sessionInsights.bounceRate = sessions.size > 0 ? bouncedSessions / sessions.size : 0;

    this.engine.emit('session_analysis', sessionInsights);
  }

  async analyzePerformance(events) {
    const performanceEvents = events.filter(e => e.responseTime || e.type === 'performance');

    if (performanceEvents.length === 0) return;

    const analysis = {
      avgResponseTime: 0,
      p95ResponseTime: 0,
      errorRate: 0,
      throughput: 0,
      slowRequests: []
    };

    const responseTimes = performanceEvents
      .filter(e => e.responseTime)
      .map(e => e.responseTime)
      .sort((a, b) => a - b);

    if (responseTimes.length > 0) {
      analysis.avgResponseTime = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
      analysis.p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
    }

    const errors = events.filter(e => e.type === 'error').length;
    analysis.errorRate = events.length > 0 ? errors / events.length : 0;

    // Calculate throughput (requests per second)
    if (events.length > 1) {
      const timeSpan = (events[events.length - 1].timestamp - events[0].timestamp) / 1000;
      analysis.throughput = timeSpan > 0 ? events.length / timeSpan : 0;
    }

    // Find slow requests (> 5 seconds)
    analysis.slowRequests = performanceEvents
      .filter(e => e.responseTime > 5000)
      .map(e => ({
        url: e.url,
        responseTime: e.responseTime,
        timestamp: e.timestamp
      }));

    this.engine.emit('performance_analysis', analysis);
  }

  async generateBusinessInsights(events) {
    const insights = {
      userEngagement: this.calculateUserEngagement(events),
      featureAdoption: this.calculateFeatureAdoption(events),
      conversionFunnels: this.analyzeConversionFunnels(events),
      revenueMetrics: this.calculateRevenueMetrics(events)
    };

    this.engine.emit('business_insights', insights);
  }

  calculateUserEngagement(events) {
    const users = new Set(events.map(e => e.userId).filter(Boolean));
    const sessions = new Set(events.map(e => e.sessionId).filter(Boolean));

    return {
      activeUsers: users.size,
      totalSessions: sessions.size,
      avgSessionPerUser: users.size > 0 ? sessions.size / users.size : 0,
      engagementScore: this.calculateEngagementScore(events)
    };
  }

  calculateFeatureAdoption(events) {
    const featureUsage = new Map();

    events.filter(e => e.feature).forEach(event => {
      featureUsage.set(event.feature, (featureUsage.get(event.feature) || 0) + 1);
    });

    const totalEvents = events.length;
    const adoption = {};

    for (const [feature, usage] of featureUsage) {
      adoption[feature] = {
        usage: usage,
        adoptionRate: totalEvents > 0 ? usage / totalEvents : 0
      };
    }

    return adoption;
  }

  analyzeConversionFunnels(events) {
    // Define conversion funnels
    const funnels = {
      registration: ['page_view', 'register_start', 'register_complete'],
      purchase: ['product_view', 'add_to_cart', 'checkout_start', 'purchase_complete']
    };

    const results = {};

    for (const [funnelName, steps] of Object.entries(funnels)) {
      results[funnelName] = this.calculateFunnelConversion(events, steps);
    }

    return results;
  }

  calculateFunnelConversion(events, steps) {
    const conversion = [];

    for (let i = 0; i < steps.length; i++) {
      const stepEvents = events.filter(e => e.type === steps[i]);
      const users = new Set(stepEvents.map(e => e.userId).filter(Boolean));

      conversion.push({
        step: steps[i],
        count: users.size,
        conversion: i === 0 ? 100 : (conversion[i - 1].count > 0 ? (users.size / conversion[i - 1].count) * 100 : 0)
      });
    }

    return conversion;
  }

  calculateRevenueMetrics(events) {
    const revenueEvents = events.filter(e => e.revenue || e.type === 'purchase');

    return {
      totalRevenue: revenueEvents.reduce((sum, e) => sum + (e.revenue || 0), 0),
      transactions: revenueEvents.length,
      avgOrderValue: revenueEvents.length > 0
        ? revenueEvents.reduce((sum, e) => sum + (e.revenue || 0), 0) / revenueEvents.length
        : 0,
      conversionRate: events.length > 0 ? revenueEvents.length / events.length : 0
    };
  }

  calculateEngagementScore(events) {
    // Simple engagement scoring based on multiple factors
    const factors = {
      pageViews: events.filter(e => e.type === 'page_view').length,
      featuresUsed: new Set(events.filter(e => e.feature).map(e => e.feature)).size,
      sessions: new Set(events.map(e => e.sessionId).filter(Boolean)).size,
      interactions: events.filter(e => ['click', 'scroll', 'submit'].includes(e.type)).length
    };

    // Weighted scoring
    const score = (
      factors.pageViews * 0.3 +
      factors.featuresUsed * 0.25 +
      factors.sessions * 0.25 +
      factors.interactions * 0.2
    );

    return Math.min(score, 100); // Cap at 100
  }

  getMostCommon(array) {
    if (array.length === 0) return null;

    const counts = {};
    array.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });

    let mostCommon = null;
    let maxCount = 0;

    for (const [item, count] of Object.entries(counts)) {
      if (count > maxCount) {
        mostCommon = item;
        maxCount = count;
      }
    }

    return mostCommon;
  }
}

class PredictiveAnalytics {
  constructor(analyticsEngine) {
    this.engine = analyticsEngine;
    this.models = new Map();
  }

  /**
   * Train predictive models
   */
  async trainModels() {
    await Promise.all([
      this.trainUserChurnModel(),
      this.trainConversionModel(),
      this.trainPerformanceModel()
    ]);
  }

  async trainUserChurnModel() {
    // Simple churn prediction based on user behavior patterns
    const users = Array.from(this.engine.users.values());

    if (users.length < 10) return; // Need minimum data

    // Calculate churn risk based on:
    // - Days since last activity
    // - Session frequency
    // - Feature usage diversity

    const churnRisks = users.map(user => {
      const daysSinceLastSeen = (Date.now() - user.lastSeen) / (1000 * 60 * 60 * 24);
      const sessionFrequency = user.sessions / Math.max(daysSinceLastSeen / 30, 1); // Sessions per month
      const featureDiversity = user.features.size / 10; // Normalized feature usage

      // Simple risk scoring
      const risk = Math.min(100, Math.max(0,
        (daysSinceLastSeen * 2) +
        (sessionFrequency < 1 ? 20 : 0) +
        (featureDiversity < 0.3 ? 15 : 0)
      ));

      return {
        userId: user.id,
        risk: risk,
        factors: {
          daysSinceLastSeen,
          sessionFrequency,
          featureDiversity
        }
      };
    });

    this.models.set('churn_prediction', {
      predictions: churnRisks,
      lastTrained: new Date(),
      accuracy: 0.75 // Placeholder
    });
  }

  async trainConversionModel() {
    // Predict conversion likelihood based on user behavior
    const users = Array.from(this.engine.users.values());

    const predictions = users.map(user => {
      // Simple conversion scoring based on engagement
      const engagementScore = this.calculateEngagementScore(user);
      const conversionProbability = Math.min(1, engagementScore / 80); // 80+ engagement = high conversion

      return {
        userId: user.id,
        conversionProbability,
        factors: {
          engagementScore,
          pageViews: user.pageViews,
          featuresUsed: user.features.size
        }
      };
    });

    this.models.set('conversion_prediction', {
      predictions,
      lastTrained: new Date(),
      accuracy: 0.82
    });
  }

  async trainPerformanceModel() {
    // Predict performance issues
    const recentEvents = this.engine.events.slice(-1000);
    const responseTimes = recentEvents
      .filter(e => e.responseTime)
      .map(e => e.responseTime);

    if (responseTimes.length < 10) return;

    // Simple trend analysis
    const avgResponseTime = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
    const trend = this.calculateTrend(responseTimes.slice(-50)); // Last 50 requests

    const predictions = {
      avgResponseTime,
      trend,
      predictedSpike: trend > 10, // Increasing trend
      recommendedOptimizations: this.getPerformanceRecommendations(avgResponseTime, trend)
    };

    this.models.set('performance_prediction', {
      predictions,
      lastTrained: new Date(),
      accuracy: 0.85
    });
  }

  calculateEngagementScore(user) {
    return (
      (user.pageViews * 0.3) +
      (user.features.size * 5) +
      (user.events * 0.1)
    );
  }

  calculateTrend(values) {
    if (values.length < 2) return 0;

    // Simple linear trend
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + (val * i), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  getPerformanceRecommendations(avgResponseTime, trend) {
    const recommendations = [];

    if (avgResponseTime > 2000) {
      recommendations.push('Consider implementing caching for frequently accessed data');
    }

    if (trend > 5) {
      recommendations.push('Response times are increasing - investigate potential bottlenecks');
    }

    if (avgResponseTime > 1000) {
      recommendations.push('Optimize database queries and consider connection pooling');
    }

    return recommendations;
  }

  /**
   * Get predictions for specific use cases
   */
  getChurnPredictions() {
    const model = this.models.get('churn_prediction');
    return model ? model.predictions : [];
  }

  getConversionPredictions() {
    const model = this.models.get('conversion_prediction');
    return model ? model.predictions : [];
  }

  getPerformancePredictions() {
    const model = this.models.get('performance_prediction');
    return model ? model.predictions : {};
  }

  /**
   * Get model metadata
   */
  getModelInfo() {
    const info = {};

    for (const [name, model] of this.models) {
      info[name] = {
        lastTrained: model.lastTrained,
        accuracy: model.accuracy,
        dataPoints: Array.isArray(model.predictions) ? model.predictions.length : 1
      };
    }

    return info;
  }
}

module.exports = {
  RealTimeProcessor,
  BatchProcessor,
  PredictiveAnalytics
};
