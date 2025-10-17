/**
 * Qui Browser - Feature Flags & Experimentation System
 *
 * Advanced feature flag management with A/B testing and gradual rollouts
 */

const crypto = require('crypto');

class FeatureFlagManager {
  constructor(config, databaseManager, analyticsEngine) {
    this.config = config;
    this.databaseManager = databaseManager;
    this.analyticsEngine = analyticsEngine;

    // Feature flag storage
    this.flags = new Map();
    this.experiments = new Map();
    this.userAssignments = new Map();

    // Configuration
    this.refreshInterval = config.featureFlags?.refreshInterval || 300000; // 5 minutes
    this.cacheTTL = config.featureFlags?.cacheTTL || 60000; // 1 minute

    // Cache
    this.cache = new Map();

    this.initialize();
  }

  async initialize() {
    // Load feature flags from configuration or database
    await this.loadFeatureFlags();

    // Set up periodic refresh
    setInterval(() => {
      this.refreshFeatureFlags();
    }, this.refreshInterval);

    console.log('Feature flag manager initialized');
  }

  async loadFeatureFlags() {
    // Load from database or configuration
    // For now, load default flags
    this.flags.set('new_dashboard', {
      id: 'new_dashboard',
      name: 'New Dashboard UI',
      description: 'Enhanced dashboard with new widgets',
      enabled: true,
      rolloutPercentage: 100,
      conditions: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.flags.set('graphql_api', {
      id: 'graphql_api',
      name: 'GraphQL API',
      description: 'Flexible GraphQL API for advanced queries',
      enabled: true,
      rolloutPercentage: 100,
      conditions: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.flags.set('advanced_analytics', {
      id: 'advanced_analytics',
      name: 'Advanced Analytics',
      description: 'Real-time analytics with predictive insights',
      enabled: true,
      rolloutPercentage: 75,
      conditions: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * Check if feature is enabled for user
   */
  async isEnabled(featureId, userId = null, context = {}) {
    const flag = this.flags.get(featureId);
    if (!flag) return false;

    if (!flag.enabled) return false;

    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const userHash = this.getUserHash(userId || context.ip || 'anonymous');
      const userPercentage = (parseInt(userHash.substring(0, 8), 16) % 100) + 1;

      if (userPercentage > flag.rolloutPercentage) {
        return false;
      }
    }

    // Check conditions
    if (flag.conditions && flag.conditions.length > 0) {
      for (const condition of flag.conditions) {
        if (!this.evaluateCondition(condition, userId, context)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get all enabled features for user
   */
  async getEnabledFeatures(userId = null, context = {}) {
    const enabledFeatures = [];

    for (const [featureId, flag] of this.flags) {
      if (await this.isEnabled(featureId, userId, context)) {
        enabledFeatures.push({
          id: featureId,
          name: flag.name,
          description: flag.description
        });
      }
    }

    return enabledFeatures;
  }

  /**
   * Create or update feature flag
   */
  async setFeatureFlag(featureId, config) {
    const flag = {
      id: featureId,
      name: config.name || featureId,
      description: config.description || '',
      enabled: config.enabled !== false,
      rolloutPercentage: config.rolloutPercentage || 100,
      conditions: config.conditions || [],
      updatedAt: new Date(),
      createdAt: this.flags.get(featureId)?.createdAt || new Date()
    };

    this.flags.set(featureId, flag);

    // Track feature flag change
    await this.analyticsEngine.trackEvent({
      type: 'feature_flag_updated',
      data: {
        featureId,
        enabled: flag.enabled,
        rolloutPercentage: flag.rolloutPercentage
      }
    });

    return flag;
  }

  /**
   * Delete feature flag
   */
  async deleteFeatureFlag(featureId) {
    const deleted = this.flags.delete(featureId);

    if (deleted) {
      await this.analyticsEngine.trackEvent({
        type: 'feature_flag_deleted',
        data: { featureId }
      });
    }

    return deleted;
  }

  /**
   * Create A/B test experiment
   */
  async createExperiment(experimentId, config) {
    const experiment = {
      id: experimentId,
      name: config.name,
      description: config.description,
      variants: config.variants || ['control', 'treatment'],
      trafficAllocation: config.trafficAllocation || { control: 50, treatment: 50 },
      conditions: config.conditions || [],
      metrics: config.metrics || [],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.experiments.set(experimentId, experiment);

    // Track experiment creation
    await this.analyticsEngine.trackEvent({
      type: 'experiment_created',
      data: { experimentId, variants: experiment.variants }
    });

    return experiment;
  }

  /**
   * Get experiment variant for user
   */
  async getExperimentVariant(experimentId, userId = null, context = {}) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'active') {
      return null;
    }

    // Check conditions
    if (experiment.conditions && experiment.conditions.length > 0) {
      for (const condition of experiment.conditions) {
        if (!this.evaluateCondition(condition, userId, context)) {
          return null;
        }
      }
    }

    // Assign variant based on traffic allocation
    const userHash = this.getUserHash(userId || context.ip || 'anonymous');
    const userBucket = parseInt(userHash.substring(0, 8), 16) % 100;

    let cumulativePercentage = 0;
    for (const [variant, percentage] of Object.entries(experiment.trafficAllocation)) {
      cumulativePercentage += percentage;
      if (userBucket < cumulativePercentage) {
        // Track assignment
        await this.trackExperimentAssignment(experimentId, userId, variant);
        return variant;
      }
    }

    return experiment.variants[0]; // Default to first variant
  }

  /**
   * Track experiment metrics
   */
  async trackExperimentMetric(experimentId, userId, variant, metric, value) {
    await this.analyticsEngine.trackEvent({
      type: 'experiment_metric',
      userId,
      data: {
        experimentId,
        variant,
        metric,
        value
      }
    });
  }

  /**
   * Get experiment results
   */
  async getExperimentResults(experimentId) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return null;

    // Aggregate metrics from analytics
    const metrics = {};
    for (const metric of experiment.metrics) {
      const metricData = await this.analyticsEngine.getExperimentMetrics(experimentId, metric);
      metrics[metric] = metricData;
    }

    return {
      experimentId,
      name: experiment.name,
      status: experiment.status,
      variants: experiment.variants,
      trafficAllocation: experiment.trafficAllocation,
      metrics,
      createdAt: experiment.createdAt,
      updatedAt: experiment.updatedAt
    };
  }

  /**
   * Update experiment status
   */
  async updateExperimentStatus(experimentId, status) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return false;

    experiment.status = status;
    experiment.updatedAt = new Date();

    await this.analyticsEngine.trackEvent({
      type: 'experiment_status_changed',
      data: { experimentId, status }
    });

    return true;
  }

  /**
   * Evaluate condition
   */
  evaluateCondition(condition, userId, context) {
    switch (condition.type) {
      case 'user_id':
        return userId && condition.values.includes(userId);

      case 'email_domain':
        return context.email && condition.domains.some(domain =>
          context.email.endsWith(`@${domain}`)
        );

      case 'country':
        return context.country && condition.countries.includes(context.country);

      case 'user_agent':
        return context.userAgent && context.userAgent.includes(condition.pattern);

      case 'date_range':
        const now = new Date();
        const start = new Date(condition.startDate);
        const end = new Date(condition.endDate);
        return now >= start && now <= end;

      case 'percentage':
        const userHash = this.getUserHash(userId || context.ip || 'anonymous');
        const userPercentage = (parseInt(userHash.substring(0, 8), 16) % 100) + 1;
        return userPercentage <= condition.percentage;

      default:
        return false;
    }
  }

  /**
   * Get user hash for consistent bucketing
   */
  getUserHash(identifier) {
    return crypto.createHash('md5')
      .update(identifier + 'qui-browser-salt')
      .digest('hex');
  }

  /**
   * Track experiment assignment
   */
  async trackExperimentAssignment(experimentId, userId, variant) {
    const assignmentKey = `${experimentId}:${userId}`;
    this.userAssignments.set(assignmentKey, {
      experimentId,
      userId,
      variant,
      assignedAt: new Date()
    });

    await this.analyticsEngine.trackEvent({
      type: 'experiment_assigned',
      userId,
      data: {
        experimentId,
        variant
      }
    });
  }

  /**
   * Refresh feature flags from database/configuration
   */
  async refreshFeatureFlags() {
    try {
      await this.loadFeatureFlags();
    } catch (error) {
      console.error('Failed to refresh feature flags:', error);
    }
  }

  /**
   * Get all feature flags
   */
  getAllFeatureFlags() {
    const flags = {};
    for (const [id, flag] of this.flags) {
      flags[id] = flag;
    }
    return flags;
  }

  /**
   * Get all experiments
   */
  getAllExperiments() {
    const experiments = {};
    for (const [id, experiment] of this.experiments) {
      experiments[id] = experiment;
    }
    return experiments;
  }

  /**
   * Export feature flag configuration
   */
  exportConfiguration() {
    return {
      featureFlags: this.getAllFeatureFlags(),
      experiments: this.getAllExperiments(),
      exportedAt: new Date(),
      version: '1.0.0'
    };
  }

  /**
   * Import feature flag configuration
   */
  importConfiguration(config) {
    if (config.featureFlags) {
      for (const [id, flag] of Object.entries(config.featureFlags)) {
        this.flags.set(id, flag);
      }
    }

    if (config.experiments) {
      for (const [id, experiment] of Object.entries(config.experiments)) {
        this.experiments.set(id, experiment);
      }
    }
  }
}

module.exports = FeatureFlagManager;
