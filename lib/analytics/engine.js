/**
 * Qui Browser - Advanced Analytics Engine
 *
 * Comprehensive analytics and business intelligence system
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class AnalyticsEngine {
  constructor(config) {
    this.config = config;
    this.events = [];
    this.metrics = new Map();
    this.sessions = new Map();
    this.users = new Map();
    this.funnels = new Map();
    this.cohorts = new Map();

    // Analytics storage
    this.analyticsDir = path.join(process.cwd(), 'analytics');
    this.maxEventsInMemory = config.analytics?.maxEventsInMemory || 10000;
    this.retentionDays = config.analytics?.retentionDays || 90;

    // Real-time processing
    this.processors = new Map();
    this.alerts = [];
    this.dashboards = new Map();

    this.initialize();
  }

  async initialize() {
    // Ensure analytics directory exists
    await fs.mkdir(this.analyticsDir, { recursive: true });

    // Initialize default metrics
    this.initializeMetrics();

    // Set up periodic tasks
    this.setupPeriodicTasks();

    // Load existing data
    await this.loadExistingData();

    console.log('Analytics engine initialized');
  }

  initializeMetrics() {
    // Core metrics
    this.metrics.set('pageViews', { value: 0, history: [] });
    this.metrics.set('uniqueUsers', { value: 0, history: [] });
    this.metrics.set('sessions', { value: 0, history: [] });
    this.metrics.set('bounceRate', { value: 0, history: [] });
    this.metrics.set('avgSessionDuration', { value: 0, history: [] });

    // Performance metrics
    this.metrics.set('responseTime', { value: 0, history: [] });
    this.metrics.set('errorRate', { value: 0, history: [] });
    this.metrics.set('cacheHitRate', { value: 0, history: [] });

    // Business metrics
    this.metrics.set('apiCalls', { value: 0, history: [] });
    this.metrics.set('featureUsage', { value: 0, history: [] });
    this.metrics.set('conversions', { value: 0, history: [] });
  }

  setupPeriodicTasks() {
    // Clean up old data daily
    setInterval(() => {
      this.cleanupOldData();
    }, 24 * 60 * 60 * 1000);

    // Update metrics every minute
    setInterval(() => {
      this.updateMetrics();
    }, 60 * 1000);

    // Generate reports hourly
    setInterval(() => {
      this.generateReports();
    }, 60 * 60 * 1000);
  }

  /**
   * Track an analytics event
   */
  async trackEvent(event) {
    const enrichedEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...event,
      // Add metadata
      userAgent: event.userAgent,
      ip: event.ip,
      sessionId: event.sessionId || this.getSessionId(event.userId),
      processed: false
    };

    // Add to in-memory events
    this.events.push(enrichedEvent);

    // Process event immediately
    await this.processEvent(enrichedEvent);

    // Maintain memory limits
    if (this.events.length > this.maxEventsInMemory) {
      // Save oldest events to disk and remove from memory
      await this.persistEvents(this.events.splice(0, 1000));
    }

    // Emit event for real-time processing
    this.emit('event', enrichedEvent);

    return enrichedEvent.id;
  }

  /**
   * Process an individual event
   */
  async processEvent(event) {
    try {
      // Update core metrics
      await this.updateCoreMetrics(event);

      // Update user analytics
      await this.updateUserAnalytics(event);

      // Update session analytics
      await this.updateSessionAnalytics(event);

      // Process custom metrics
      await this.processCustomMetrics(event);

      // Check for alerts
      await this.checkAlerts(event);

      // Mark as processed
      event.processed = true;

    } catch (error) {
      console.error('Error processing analytics event:', error);
    }
  }

  async updateCoreMetrics(event) {
    switch (event.type) {
      case 'page_view':
        this.incrementMetric('pageViews');
        this.trackUniqueUser(event.userId);
        break;

      case 'session_start':
        this.incrementMetric('sessions');
        break;

      case 'api_call':
        this.incrementMetric('apiCalls');
        break;

      case 'error':
        this.incrementMetric('errorRate');
        break;

      case 'conversion':
        this.incrementMetric('conversions');
        break;
    }

    // Update response time if available
    if (event.responseTime) {
      this.updateAverageMetric('responseTime', event.responseTime);
    }
  }

  async updateUserAnalytics(event) {
    const userId = event.userId;
    if (!userId) return;

    if (!this.users.has(userId)) {
      this.users.set(userId, {
        id: userId,
        firstSeen: event.timestamp,
        lastSeen: event.timestamp,
        events: 0,
        sessions: 0,
        pageViews: 0,
        features: new Set(),
        properties: {}
      });
    }

    const user = this.users.get(userId);
    user.lastSeen = event.timestamp;
    user.events++;

    // Update user-specific metrics
    if (event.type === 'page_view') {
      user.pageViews++;
    }

    if (event.type === 'feature_used') {
      user.features.add(event.feature);
    }

    // Update user properties
    if (event.properties) {
      Object.assign(user.properties, event.properties);
    }
  }

  async updateSessionAnalytics(event) {
    const sessionId = event.sessionId;
    if (!sessionId) return;

    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        userId: event.userId,
        startTime: event.timestamp,
        lastActivity: event.timestamp,
        duration: 0,
        pageViews: 0,
        events: [],
        device: event.device,
        browser: event.browser
      });
    }

    const session = this.sessions.get(sessionId);
    session.lastActivity = event.timestamp;
    session.events.push(event);

    if (event.type === 'page_view') {
      session.pageViews++;
    }

    // Calculate session duration
    session.duration = (session.lastActivity - session.startTime) / 1000; // in seconds
  }

  async processCustomMetrics(event) {
    // Process custom metrics based on event data
    if (event.metrics) {
      for (const [key, value] of Object.entries(event.metrics)) {
        if (typeof value === 'number') {
          this.updateAverageMetric(key, value);
        }
      }
    }
  }

  async checkAlerts(event) {
    // Check for alert conditions
    const alerts = this.config.analytics?.alerts || [];

    for (const alert of alerts) {
      if (this.checkAlertCondition(alert, event)) {
        const alertEvent = {
          id: crypto.randomUUID(),
          type: 'alert',
          alertId: alert.id,
          message: alert.message,
          severity: alert.severity,
          event: event,
          timestamp: new Date()
        };

        this.alerts.push(alertEvent);
        this.emit('alert', alertEvent);
      }
    }
  }

  checkAlertCondition(alert, event) {
    // Simple alert conditions (can be extended)
    switch (alert.condition) {
      case 'error_rate_high':
        return event.type === 'error' && this.getMetric('errorRate') > alert.threshold;
      case 'response_time_high':
        return event.responseTime > alert.threshold;
      case 'traffic_spike':
        return this.getMetric('pageViews') > alert.threshold;
      default:
        return false;
    }
  }

  /**
   * Get analytics data
   */
  getAnalytics(options = {}) {
    const {
      startDate,
      endDate,
      userId,
      eventType,
      limit = 100,
      offset = 0
    } = options;

    let filteredEvents = this.events;

    // Apply filters
    if (startDate) {
      filteredEvents = filteredEvents.filter(e => e.timestamp >= startDate);
    }
    if (endDate) {
      filteredEvents = filteredEvents.filter(e => e.timestamp <= endDate);
    }
    if (userId) {
      filteredEvents = filteredEvents.filter(e => e.userId === userId);
    }
    if (eventType) {
      filteredEvents = filteredEvents.filter(e => e.type === eventType);
    }

    // Apply pagination
    const paginatedEvents = filteredEvents.slice(offset, offset + limit);

    return {
      events: paginatedEvents,
      total: filteredEvents.length,
      metrics: this.getAllMetrics(),
      users: this.getTopUsers(),
      sessions: this.getActiveSessions(),
      alerts: this.alerts.slice(-10) // Last 10 alerts
    };
  }

  /**
   * Get real-time dashboard data
   */
  getDashboardData(dashboardId) {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return null;

    const data = {};

    // Generate data for each widget
    for (const widget of dashboard.widgets) {
      data[widget.id] = this.getWidgetData(widget);
    }

    return {
      id: dashboardId,
      title: dashboard.title,
      data: data,
      lastUpdated: new Date()
    };
  }

  getWidgetData(widget) {
    switch (widget.type) {
      case 'metric':
        return {
          value: this.getMetric(widget.metric),
          change: this.getMetricChange(widget.metric, widget.timeframe)
        };

      case 'chart':
        return this.getChartData(widget.metric, widget.timeframe, widget.chartType);

      case 'table':
        return this.getTableData(widget.dataSource, widget.limit);

      case 'funnel':
        return this.getFunnelData(widget.funnelId);

      default:
        return null;
    }
  }

  getChartData(metric, timeframe, chartType) {
    const data = this.getMetricHistory(metric, timeframe);
    return {
      type: chartType,
      data: data,
      labels: data.map(d => d.timestamp),
      values: data.map(d => d.value)
    };
  }

  getTableData(dataSource, limit) {
    switch (dataSource) {
      case 'top_pages':
        return this.getTopPages(limit);
      case 'top_users':
        return this.getTopUsers(limit);
      case 'recent_events':
        return this.events.slice(-limit);
      default:
        return [];
    }
  }

  getFunnelData(funnelId) {
    const funnel = this.funnels.get(funnelId);
    if (!funnel) return null;

    // Calculate funnel conversion rates
    const steps = funnel.steps.map(step => ({
      name: step.name,
      count: this.getEventsCount({ type: step.event }),
      conversion: 0 // Calculate based on previous step
    }));

    // Calculate conversion rates
    for (let i = 1; i < steps.length; i++) {
      const previousCount = steps[i - 1].count;
      steps[i].conversion = previousCount > 0 ? (steps[i].count / previousCount) * 100 : 0;
    }

    return {
      id: funnelId,
      name: funnel.name,
      steps: steps
    };
  }

  /**
   * Utility methods
   */
  incrementMetric(name) {
    const metric = this.metrics.get(name) || { value: 0, history: [] };
    metric.value++;
    this.metrics.set(name, metric);
  }

  updateAverageMetric(name, value) {
    const metric = this.metrics.get(name) || { value: 0, history: [] };
    // Simple moving average calculation
    const history = metric.history.slice(-10); // Last 10 values
    history.push(value);
    metric.value = history.reduce((sum, val) => sum + val, 0) / history.length;
    metric.history = history;
    this.metrics.set(name, metric);
  }

  getMetric(name) {
    return this.metrics.get(name)?.value || 0;
  }

  getMetricHistory(name, timeframe = '1h') {
    const metric = this.metrics.get(name);
    if (!metric) return [];

    const now = Date.now();
    const timeframeMs = this.parseTimeframe(timeframe);

    return metric.history
      .filter(entry => now - entry.timestamp < timeframeMs)
      .map(entry => ({
        timestamp: entry.timestamp,
        value: entry.value
      }));
  }

  getMetricChange(name, timeframe = '1h') {
    const history = this.getMetricHistory(name, timeframe);
    if (history.length < 2) return 0;

    const current = history[history.length - 1].value;
    const previous = history[0].value;

    return previous !== 0 ? ((current - previous) / previous) * 100 : 0;
  }

  trackUniqueUser(userId) {
    // Simple unique user tracking (in production, use HyperLogLog or similar)
    const uniqueUsers = this.metrics.get('uniqueUsers');
    const userSet = uniqueUsers.userSet || new Set();

    if (!userSet.has(userId)) {
      userSet.add(userId);
      uniqueUsers.value = userSet.size;
      uniqueUsers.userSet = userSet;
      this.metrics.set('uniqueUsers', uniqueUsers);
    }
  }

  getAllMetrics() {
    const result = {};
    for (const [key, metric] of this.metrics) {
      result[key] = {
        current: metric.value,
        history: metric.history.slice(-100) // Last 100 data points
      };
    }
    return result;
  }

  getTopUsers(limit = 10) {
    return Array.from(this.users.values())
      .sort((a, b) => b.events - a.events)
      .slice(0, limit)
      .map(user => ({
        id: user.id,
        events: user.events,
        pageViews: user.pageViews,
        lastSeen: user.lastSeen,
        features: Array.from(user.features)
      }));
  }

  getActiveSessions() {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);

    return Array.from(this.sessions.values())
      .filter(session => session.lastActivity > fiveMinutesAgo)
      .map(session => ({
        id: session.id,
        userId: session.userId,
        duration: session.duration,
        pageViews: session.pageViews,
        device: session.device,
        browser: session.browser
      }));
  }

  getTopPages(limit = 10) {
    const pageViews = new Map();

    // Count page views
    this.events
      .filter(e => e.type === 'page_view')
      .forEach(event => {
        const url = event.url || event.page;
        pageViews.set(url, (pageViews.get(url) || 0) + 1);
      });

    return Array.from(pageViews.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([url, views]) => ({ url, views }));
  }

  getEventsCount(filter) {
    return this.events.filter(event => {
      return Object.entries(filter).every(([key, value]) => event[key] === value);
    }).length;
  }

  parseTimeframe(timeframe) {
    const unit = timeframe.slice(-1);
    const value = parseInt(timeframe.slice(0, -1));

    switch (unit) {
      case 'm': return value * 60 * 1000; // minutes
      case 'h': return value * 60 * 60 * 1000; // hours
      case 'd': return value * 24 * 60 * 60 * 1000; // days
      default: return 60 * 60 * 1000; // default to 1 hour
    }
  }

  getSessionId(userId) {
    // Generate or retrieve session ID
    return crypto.randomUUID();
  }

  updateMetrics() {
    // Update derived metrics
    this.updateDerivedMetrics();

    // Emit metrics update event
    this.emit('metrics_updated', this.getAllMetrics());
  }

  updateDerivedMetrics() {
    // Calculate bounce rate
    const sessionsWithMultipleViews = Array.from(this.sessions.values())
      .filter(session => session.pageViews > 1).length;
    const totalSessions = this.sessions.size;

    const bounceRate = totalSessions > 0 ? (1 - (sessionsWithMultipleViews / totalSessions)) * 100 : 0;
    this.metrics.set('bounceRate', { value: bounceRate, history: [] });

    // Calculate average session duration
    const activeSessions = Array.from(this.sessions.values());
    const avgDuration = activeSessions.length > 0
      ? activeSessions.reduce((sum, session) => sum + session.duration, 0) / activeSessions.length
      : 0;

    this.metrics.set('avgSessionDuration', { value: avgDuration, history: [] });
  }

  generateReports() {
    // Generate periodic reports
    const report = {
      timestamp: new Date(),
      period: 'hourly',
      metrics: this.getAllMetrics(),
      topUsers: this.getTopUsers(5),
      topPages: this.getTopPages(5),
      alerts: this.alerts.slice(-5)
    };

    this.emit('report_generated', report);

    // Save report to disk
    this.saveReport(report);
  }

  async saveReport(report) {
    try {
      const reportPath = path.join(this.analyticsDir, `report-${Date.now()}.json`);
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    } catch (error) {
      console.error('Failed to save analytics report:', error);
    }
  }

  async persistEvents(events) {
    try {
      const batchPath = path.join(this.analyticsDir, `events-${Date.now()}.json`);
      await fs.writeFile(batchPath, JSON.stringify(events, null, 2));
    } catch (error) {
      console.error('Failed to persist analytics events:', error);
    }
  }

  async loadExistingData() {
    try {
      const files = await fs.readdir(this.analyticsDir);
      const eventFiles = files.filter(f => f.startsWith('events-'));

      // Load recent event files
      for (const file of eventFiles.slice(-5)) { // Load last 5 batches
        const filePath = path.join(this.analyticsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const events = JSON.parse(content);

        // Re-process events (or just add to memory for analysis)
        this.events.push(...events.slice(-1000)); // Keep last 1000 events in memory
      }
    } catch (error) {
      console.warn('Failed to load existing analytics data:', error.message);
    }
  }

  cleanupOldData() {
    const cutoffDate = new Date(Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000));

    // Clean up old events
    this.events = this.events.filter(event => event.timestamp > cutoffDate);

    // Clean up old sessions
    for (const [sessionId, session] of this.sessions) {
      if (session.lastActivity < cutoffDate) {
        this.sessions.delete(sessionId);
      }
    }

    // Clean up old alerts
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoffDate);
  }

  /**
   * Create a dashboard
   */
  createDashboard(id, config) {
    this.dashboards.set(id, {
      id,
      title: config.title,
      widgets: config.widgets,
      created: new Date()
    });
  }

  /**
   * Create a funnel
   */
  createFunnel(id, config) {
    this.funnels.set(id, {
      id,
      name: config.name,
      steps: config.steps
    });
  }

  /**
   * Create a cohort
   */
  createCohort(id, config) {
    this.cohorts.set(id, {
      id,
      name: config.name,
      definition: config.definition,
      created: new Date()
    });
  }
}

// Add EventEmitter functionality
const EventEmitter = require('events');
Object.setPrototypeOf(AnalyticsEngine.prototype, EventEmitter.prototype);

module.exports = AnalyticsEngine;
