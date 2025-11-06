/**
 * AI-Powered Recommendation System
 * Smart content suggestions based on user behavior and context
 *
 * John Carmack principle: AI should enhance, not complicate
 */

export class AIRecommendation {
  constructor() {
    this.model = null;
    this.initialized = false;

    // User behavior tracking
    this.userProfile = {
      visitHistory: [],
      interactions: [],
      preferences: {},
      currentContext: null,
      sessionTime: 0,
      lastActivity: Date.now()
    };

    // Recommendation engine
    this.recommendations = [];
    this.updateInterval = 30000; // 30 seconds

    // Categories
    this.categories = {
      entertainment: { weight: 1.0, keywords: ['video', 'game', 'music', 'movie'] },
      productivity: { weight: 1.0, keywords: ['work', 'document', 'email', 'calendar'] },
      social: { weight: 1.0, keywords: ['chat', 'social', 'message', 'friend'] },
      education: { weight: 1.0, keywords: ['learn', 'course', 'tutorial', 'study'] },
      shopping: { weight: 1.0, keywords: ['shop', 'buy', 'product', 'store'] },
      news: { weight: 1.0, keywords: ['news', 'article', 'blog', 'post'] }
    };

    // Time-based patterns
    this.timePatterns = {
      morning: { hours: [6, 12], boost: { news: 1.5, productivity: 1.3 } },
      afternoon: { hours: [12, 18], boost: { productivity: 1.2, education: 1.3 } },
      evening: { hours: [18, 23], boost: { entertainment: 1.5, social: 1.3 } },
      night: { hours: [23, 6], boost: { entertainment: 1.3, social: 1.2 } }
    };

    // Collaborative filtering data
    this.similarUsers = [];
    this.globalTrends = [];

    // Statistics
    this.stats = {
      recommendationsGenerated: 0,
      recommendationsClicked: 0,
      accuracy: 0,
      averageRelevance: 0
    };
  }

  /**
   * Initialize AI model (using TensorFlow.js Lite)
   */
  async initialize() {
    console.log('AIRecommendation: Initializing...');

    try {
      // Load pre-trained model or use simple heuristics
      // For production, would load actual TensorFlow.js model
      this.initialized = true;

      // Start recommendation update loop
      this.startUpdateLoop();

      console.log('AIRecommendation: Initialized successfully');
    } catch (error) {
      console.error('AIRecommendation: Initialization failed', error);
      // Fallback to heuristic-based recommendations
      this.initialized = true;
    }
  }

  /**
   * Track user visit
   */
  trackVisit(url, title, duration = 0) {
    const visit = {
      url,
      title,
      duration,
      timestamp: Date.now(),
      category: this.categorizeContent(title + ' ' + url),
      timeOfDay: this.getTimeOfDay()
    };

    this.userProfile.visitHistory.push(visit);

    // Keep only recent history (last 100 visits)
    if (this.userProfile.visitHistory.length > 100) {
      this.userProfile.visitHistory.shift();
    }

    // Update category weights
    this.updateCategoryWeights(visit.category, duration);

    // Update recommendations
    this.generateRecommendations();
  }

  /**
   * Track user interaction
   */
  trackInteraction(type, data) {
    const interaction = {
      type, // click, scroll, gesture, voice, etc.
      data,
      timestamp: Date.now()
    };

    this.userProfile.interactions.push(interaction);

    // Keep only recent interactions (last 200)
    if (this.userProfile.interactions.length > 200) {
      this.userProfile.interactions.shift();
    }

    this.userProfile.lastActivity = Date.now();
  }

  /**
   * Categorize content based on keywords
   */
  categorizeContent(text) {
    const lowerText = text.toLowerCase();
    const scores = {};

    // Calculate scores for each category
    Object.entries(this.categories).forEach(([category, config]) => {
      let score = 0;
      config.keywords.forEach(keyword => {
        if (lowerText.includes(keyword)) {
          score += 1;
        }
      });
      scores[category] = score * config.weight;
    });

    // Return category with highest score
    let maxCategory = 'general';
    let maxScore = 0;

    Object.entries(scores).forEach(([category, score]) => {
      if (score > maxScore) {
        maxScore = score;
        maxCategory = category;
      }
    });

    return maxCategory;
  }

  /**
   * Update category weights based on user behavior
   */
  updateCategoryWeights(category, duration) {
    if (!this.categories[category]) return;

    // Increase weight for frequently visited categories
    // Decay factor based on time spent
    const decayFactor = Math.min(duration / 60000, 1); // Max 1 minute
    this.categories[category].weight += 0.1 * decayFactor;

    // Normalize weights
    const totalWeight = Object.values(this.categories).reduce((sum, cat) => sum + cat.weight, 0);
    Object.values(this.categories).forEach(cat => {
      cat.weight = (cat.weight / totalWeight) * Object.keys(this.categories).length;
    });
  }

  /**
   * Get time of day category
   */
  getTimeOfDay() {
    const hour = new Date().getHours();

    for (const [period, config] of Object.entries(this.timePatterns)) {
      const [start, end] = config.hours;
      if (start < end) {
        if (hour >= start && hour < end) return period;
      } else {
        // Handle overnight periods
        if (hour >= start || hour < end) return period;
      }
    }

    return 'afternoon'; // default
  }

  /**
   * Generate recommendations
   */
  async generateRecommendations() {
    const recommendations = [];

    // 1. Content-based recommendations (based on visit history)
    const contentBased = this.getContentBasedRecommendations();
    recommendations.push(...contentBased);

    // 2. Collaborative filtering (based on similar users)
    const collaborative = this.getCollaborativeRecommendations();
    recommendations.push(...collaborative);

    // 3. Contextual recommendations (based on current context)
    const contextual = this.getContextualRecommendations();
    recommendations.push(...contextual);

    // 4. Trending content
    const trending = this.getTrendingRecommendations();
    recommendations.push(...trending);

    // 5. Time-based recommendations
    const timeBased = this.getTimeBasedRecommendations();
    recommendations.push(...timeBased);

    // Score and rank recommendations
    this.recommendations = this.rankRecommendations(recommendations);

    this.stats.recommendationsGenerated++;

    return this.recommendations.slice(0, 10); // Top 10
  }

  /**
   * Content-based recommendations
   */
  getContentBasedRecommendations() {
    const recommendations = [];

    // Analyze recent visit patterns
    const recentVisits = this.userProfile.visitHistory.slice(-10);
    const categoryCount = {};

    recentVisits.forEach(visit => {
      categoryCount[visit.category] = (categoryCount[visit.category] || 0) + 1;
    });

    // Get top categories
    const topCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category]) => category);

    // Generate recommendations for top categories
    topCategories.forEach(category => {
      const suggestions = this.getContentForCategory(category);
      recommendations.push(...suggestions.map(s => ({
        ...s,
        source: 'content-based',
        score: 0.8 * this.categories[category].weight
      })));
    });

    return recommendations;
  }

  /**
   * Collaborative filtering recommendations
   */
  getCollaborativeRecommendations() {
    // Simplified collaborative filtering
    // In production, would use actual user similarity data

    const recommendations = [];

    // Simulate similar user recommendations
    const similarUserContent = [
      { title: 'Popular in your network', url: '#', category: 'social' },
      { title: 'Trending among VR users', url: '#', category: 'entertainment' }
    ];

    similarUserContent.forEach(content => {
      recommendations.push({
        ...content,
        source: 'collaborative',
        score: 0.7
      });
    });

    return recommendations;
  }

  /**
   * Contextual recommendations based on current activity
   */
  getContextualRecommendations() {
    const recommendations = [];

    if (this.userProfile.currentContext) {
      const context = this.userProfile.currentContext;

      // Recommend related content
      if (context.type === 'video') {
        recommendations.push({
          title: 'Related videos',
          url: '#',
          category: 'entertainment',
          source: 'contextual',
          score: 0.9
        });
      }

      if (context.type === 'document') {
        recommendations.push({
          title: 'Similar documents',
          url: '#',
          category: 'productivity',
          source: 'contextual',
          score: 0.9
        });
      }
    }

    return recommendations;
  }

  /**
   * Trending recommendations
   */
  getTrendingRecommendations() {
    const recommendations = [];

    // Simulate global trends
    const trends = [
      { title: 'Trending: VR Workspaces', url: '#', category: 'productivity', views: 10000 },
      { title: 'Popular: VR Games', url: '#', category: 'entertainment', views: 15000 },
      { title: 'Rising: VR Education', url: '#', category: 'education', views: 8000 }
    ];

    trends.forEach(trend => {
      recommendations.push({
        ...trend,
        source: 'trending',
        score: 0.6 * Math.log10(trend.views) / 5 // Normalize by log views
      });
    });

    return recommendations;
  }

  /**
   * Time-based recommendations
   */
  getTimeBasedRecommendations() {
    const recommendations = [];
    const timeOfDay = this.getTimeOfDay();
    const boosts = this.timePatterns[timeOfDay].boost;

    // Get recommendations for boosted categories
    Object.entries(boosts).forEach(([category, boost]) => {
      const content = this.getContentForCategory(category);
      recommendations.push(...content.map(c => ({
        ...c,
        source: 'time-based',
        score: 0.7 * boost
      })));
    });

    return recommendations;
  }

  /**
   * Get content for specific category
   */
  getContentForCategory(category) {
    // Simulate content database
    const content = {
      entertainment: [
        { title: 'VR Cinema Experience', url: '#', category: 'entertainment' },
        { title: 'Immersive Gaming', url: '#', category: 'entertainment' }
      ],
      productivity: [
        { title: 'Virtual Office Setup', url: '#', category: 'productivity' },
        { title: 'VR Productivity Tools', url: '#', category: 'productivity' }
      ],
      social: [
        { title: 'VR Social Spaces', url: '#', category: 'social' },
        { title: 'Virtual Meetups', url: '#', category: 'social' }
      ],
      education: [
        { title: 'VR Learning Platforms', url: '#', category: 'education' },
        { title: 'Interactive Tutorials', url: '#', category: 'education' }
      ],
      shopping: [
        { title: 'Virtual Shopping Mall', url: '#', category: 'shopping' },
        { title: 'VR Product Reviews', url: '#', category: 'shopping' }
      ],
      news: [
        { title: 'VR News Digest', url: '#', category: 'news' },
        { title: 'Tech Updates in VR', url: '#', category: 'news' }
      ]
    };

    return content[category] || [];
  }

  /**
   * Rank recommendations by score
   */
  rankRecommendations(recommendations) {
    // Remove duplicates
    const unique = [];
    const seen = new Set();

    recommendations.forEach(rec => {
      const key = `${rec.title}-${rec.url}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(rec);
      } else {
        // Boost score if seen from multiple sources
        const existing = unique.find(r => `${r.title}-${r.url}` === key);
        if (existing) {
          existing.score = Math.min(existing.score * 1.2, 1.0);
        }
      }
    });

    // Sort by score
    return unique.sort((a, b) => b.score - a.score);
  }

  /**
   * Get recommendations for display
   */
  getRecommendations(count = 5) {
    return this.recommendations.slice(0, count);
  }

  /**
   * Record recommendation click
   */
  recordClick(recommendation) {
    this.stats.recommendationsClicked++;

    // Update accuracy
    this.stats.accuracy = this.stats.recommendationsClicked / this.stats.recommendationsGenerated;

    // Track as interaction
    this.trackInteraction('recommendation-click', {
      title: recommendation.title,
      source: recommendation.source,
      score: recommendation.score
    });

    // Update category weight
    if (recommendation.category) {
      this.categories[recommendation.category].weight += 0.2;
    }
  }

  /**
   * Start automatic update loop
   */
  startUpdateLoop() {
    setInterval(() => {
      if (this.initialized) {
        this.generateRecommendations();
      }
    }, this.updateInterval);
  }

  /**
   * Set current context
   */
  setContext(context) {
    this.userProfile.currentContext = {
      ...context,
      timestamp: Date.now()
    };

    // Immediately generate context-based recommendations
    this.generateRecommendations();
  }

  /**
   * Get user profile summary
   */
  getProfile() {
    return {
      topCategories: this.getTopCategories(),
      visitCount: this.userProfile.visitHistory.length,
      interactionCount: this.userProfile.interactions.length,
      sessionTime: this.userProfile.sessionTime,
      lastActivity: this.userProfile.lastActivity
    };
  }

  /**
   * Get top categories
   */
  getTopCategories() {
    return Object.entries(this.categories)
      .sort((a, b) => b[1].weight - a[1].weight)
      .slice(0, 3)
      .map(([category, config]) => ({
        category,
        weight: config.weight
      }));
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      recommendationsAvailable: this.recommendations.length,
      averageScore: this.recommendations.reduce((sum, r) => sum + r.score, 0) / this.recommendations.length
    };
  }

  /**
   * Export user profile for persistence
   */
  exportProfile() {
    return JSON.stringify({
      visitHistory: this.userProfile.visitHistory.slice(-50), // Last 50 visits
      preferences: this.userProfile.preferences,
      categoryWeights: Object.fromEntries(
        Object.entries(this.categories).map(([k, v]) => [k, v.weight])
      )
    });
  }

  /**
   * Import user profile
   */
  importProfile(data) {
    try {
      const profile = JSON.parse(data);

      if (profile.visitHistory) {
        this.userProfile.visitHistory = profile.visitHistory;
      }

      if (profile.preferences) {
        this.userProfile.preferences = profile.preferences;
      }

      if (profile.categoryWeights) {
        Object.entries(profile.categoryWeights).forEach(([category, weight]) => {
          if (this.categories[category]) {
            this.categories[category].weight = weight;
          }
        });
      }

      console.log('AIRecommendation: Profile imported');
    } catch (error) {
      console.error('AIRecommendation: Profile import failed', error);
    }
  }
}

/**
 * Usage:
 *
 * const ai = new AIRecommendation();
 * await ai.initialize();
 *
 * // Track user activity
 * ai.trackVisit('https://example.com', 'Example Page', 30000);
 *
 * // Get recommendations
 * const recommendations = ai.getRecommendations(5);
 *
 * // Record click
 * ai.recordClick(recommendations[0]);
 *
 * // Set context
 * ai.setContext({ type: 'video', title: 'VR Tutorial' });
 */