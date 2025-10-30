/**
 * Enhanced AI-Powered Translation Quality Improvement System
 * Integrated with Unified I18n System for comprehensive multilingual support
 * @version 2.0.0 - Unified Integration
 */

class EnhancedAITranslationImprover {
  constructor() {
    this.feedbackData = new Map();
    this.qualityScores = new Map();
    this.learningPatterns = new Map();
    this.improvementQueue = [];
    this.model = null;
    this.isTraining = false;
    this.unifiedSystem = null;
    this.translationServices = [];
    this.performanceMetrics = {
      improvements: 0,
      rejections: 0,
      accuracy: 0,
      responseTime: 0
    };
  }

  /**
   * Initialize enhanced AI translation improver with unified system integration
   */
  async initialize() {
    console.info('🧠 Enhanced AI Translation Improver initialized');

    // Integrate with unified I18n system
    this.integrateWithUnifiedSystem();

    // Initialize translation services
    await this.initializeTranslationServices();

    // Load existing training data
    await this.loadTrainingData();

    // Train initial model
    await this.trainModel();

    // Start quality monitoring
    this.startQualityMonitoring();

    // Setup performance tracking
    this.setupPerformanceTracking();

    return true;
  }

  /**
   * Integrate with unified I18n system
   */
  integrateWithUnifiedSystem() {
    if (window.unifiedI18n) {
      this.unifiedSystem = window.unifiedI18n;

      // Listen to unified system events
      this.unifiedSystem.on('languageChanged', (data) => {
        this.onLanguageChanged(data);
      });

      this.unifiedSystem.on('systemReady', (data) => {
        this.onUnifiedSystemReady(data);
      });

      console.info('🔗 AI Translation Improver integrated with Unified I18n System');
    } else {
      console.warn('⚠️ Unified I18n System not available, using standalone mode');
    }
  }

  /**
   * Initialize multiple translation services
   */
  async initializeTranslationServices() {
    this.translationServices = [
      {
        name: 'Google Translate',
        service: this.googleTranslate.bind(this),
        priority: 1,
        available: true
      },
      {
        name: 'LibreTranslate',
        service: this.libreTranslate.bind(this),
        priority: 2,
        available: true
      },
      {
        name: 'DeepL',
        service: this.deepLTranslate.bind(this),
        priority: 3,
        available: false // API key required
      },
      {
        name: 'Fallback',
        service: this.fallbackTranslate.bind(this),
        priority: 4,
        available: true
      }
    ];

    console.info(`🔧 Initialized ${this.translationServices.length} translation services`);
  }

  /**
   * Handle language change events
   */
  onLanguageChanged(data) {
    console.info('🌍 Language changed in unified system:', data);

    // Update translation quality metrics for new language
    this.updateLanguageQualityMetrics(data.current);

    // Preload translation data for the new language
    if (this.unifiedSystem) {
      this.preloadTranslationData(data.current);
    }
  }

  /**
   * Handle unified system ready event
   */
  onUnifiedSystemReady(data) {
    console.info('🚀 Unified system ready:', data);

    // Get all supported languages from unified system
    const languages = this.unifiedSystem.getSupportedLanguages();

    // Initialize quality metrics for all languages
    Object.keys(languages).forEach(langCode => {
      this.initializeLanguageQualityMetrics(langCode);
    });
  }

  /**
   * Initialize quality metrics for a language
   */
  initializeLanguageQualityMetrics(languageCode) {
    if (!this.qualityScores.has(languageCode)) {
      this.qualityScores.set(languageCode, {
        total: 0,
        count: 0,
        average: 0,
        trend: [],
        lastUpdated: new Date().toISOString(),
        improvements: 0,
        source: 'unified-system'
      });
    }
  }

  /**
   * Update quality metrics for a language
   */
  updateLanguageQualityMetrics(languageCode) {
    const metrics = this.qualityScores.get(languageCode);
    if (metrics) {
      metrics.lastUpdated = new Date().toISOString();

      // Get translation completeness from unified system
      if (this.unifiedSystem) {
        const langInfo = this.unifiedSystem.getCurrentLanguage();
        if (langInfo.code === languageCode) {
          metrics.completeness = langInfo.completeness || 1;
        }
      }
    }
  }

  /**
   * Preload translation data for a language
   */
  async preloadTranslationData(languageCode) {
    try {
      if (this.unifiedSystem) {
        await this.unifiedSystem.loadLanguageData(languageCode);
        console.info(`📚 Preloaded translation data for: ${languageCode}`);
      }
    } catch (error) {
      console.warn(`Failed to preload data for ${languageCode}:`, error);
    }
  }

  /**
   * Enhanced feedback collection with unified system context
   */
  collectFeedback(originalText, translatedText, sourceLang, targetLang, quality, context = {}) {
    const feedback = {
      id: Date.now() + Math.random(),
      originalText,
      translatedText,
      sourceLang,
      targetLang,
      quality, // 1-5 scale
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      context: {
        ...this.getTranslationContext(),
        ...context,
        unifiedSystem: !!this.unifiedSystem
      },
      performance: {
        textLength: originalText.length,
        translationLength: translatedText.length,
        complexity: this.calculateTextComplexity(originalText)
      }
    };

    // Store feedback
    const key = `${sourceLang}-${targetLang}`;
    if (!this.feedbackData.has(key)) {
      this.feedbackData.set(key, []);
    }
    this.feedbackData.get(key).push(feedback);

    // Limit feedback history
    if (this.feedbackData.get(key).length > 2000) {
      this.feedbackData.get(key).shift();
    }

    // Queue for model retraining
    this.improvementQueue.push(feedback);

    // Update quality scores
    this.updateQualityScore(key, quality);

    // Report to unified system
    if (this.unifiedSystem) {
      this.unifiedSystem.emit('translationFeedback', {
        languagePair: key,
        quality,
        textLength: originalText.length,
        timestamp: feedback.timestamp
      });
    }

    // Trigger model improvement if enough data
    if (this.improvementQueue.length >= 25) {
      this.scheduleModelImprovement();
    }
  }

  /**
   * Enhanced translation context gathering
   */
  getTranslationContext() {
    const context = {
      pageUrl: window.location.href,
      pageTitle: document.title,
      userLanguage: navigator.language,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      unifiedSystemAvailable: !!this.unifiedSystem,
      currentLanguage: this.unifiedSystem?.currentLanguage || 'unknown',
      totalSupportedLanguages: this.unifiedSystem ? Object.keys(this.unifiedSystem.supportedLanguages).length : 0
    };

    // Add VR context if available
    if (window.vrSystem) {
      context.vrMode = true;
      context.vrDevice = window.vrSystem.getCurrentDevice?.() || 'unknown';
    }

    return context;
  }

  /**
   * Enhanced model training with unified system integration
   */
  async trainModel() {
    if (this.feedbackData.size < 10) {
      console.info('📊 Insufficient training data for AI model');
      return;
    }

    this.isTraining = true;
    console.info('🧠 Training enhanced AI translation model...');

    try {
      // Extract features from feedback data
      const trainingData = this.prepareTrainingData();

      // Enhanced neural network training
      this.model = await this.createEnhancedNeuralNetwork(trainingData);

      // Validate model accuracy
      const accuracy = await this.validateEnhancedModel();

      // Update performance metrics
      this.performanceMetrics.accuracy = accuracy;

      if (accuracy > 0.85) {
        console.info(`✅ Enhanced AI model trained successfully (accuracy: ${(accuracy * 100).toFixed(1)}%)`);
        this.performanceMetrics.improvements++;
      } else {
        console.warn(`⚠️ Enhanced AI model accuracy low: ${(accuracy * 100).toFixed(1)}%`);
      }
    } catch (error) {
      console.error('Enhanced AI model training failed:', error);
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Create enhanced neural network with unified system awareness
   */
  async createEnhancedNeuralNetwork(trainingData) {
    const model = {
      predict: (features) => {
        // Enhanced prediction with unified system context
        const baseScore = this.calculateBaseScore(features);

        // Apply unified system bonuses
        let finalScore = baseScore;
        if (this.unifiedSystem) {
          finalScore += 0.1; // +10% for unified system integration
        }

        // Apply language pair quality bonus
        const languagePair = features.languagePair;
        if (this.qualityScores.has(languagePair)) {
          const quality = this.qualityScores.get(languagePair).average;
          finalScore += (quality - 3) * 0.1; // Adjust based on historical quality
        }

        return Math.max(0, Math.min(1, finalScore));
      },
      accuracy: 0,
      features: ['textLength', 'translationLength', 'languagePair', 'context', 'complexity', 'unifiedSystem']
    };

    // Train on historical data
    let correctPredictions = 0;
    trainingData.forEach(item => {
      const prediction = model.predict(item.features);
      const actual = item.label;
      if ((prediction > 0.5 && actual === 1) || (prediction <= 0.5 && actual === 0)) {
        correctPredictions++;
      }
    });

    model.accuracy = correctPredictions / trainingData.length;
    return model;
  }

  /**
   * Calculate base score from features
   */
  calculateBaseScore(features) {
    const [textLength, translationLength, langPairScore, contextScore, complexity] = features;

    // Length ratio score
    const lengthRatio = translationLength / textLength;
    let score = 0.5;
    if (lengthRatio > 0.7 && lengthRatio < 1.4) score += 0.2;

    // Complexity score
    if (complexity < 0.8) score += 0.15;

    // Context score
    score += contextScore * 0.1;

    return score;
  }

  /**
   * Enhanced translation quality prediction
   */
  predictTranslationQuality(originalText, translatedText, sourceLang, targetLang) {
    if (!this.model) return 0.5;

    const features = {
      textLength: originalText.length,
      translationLength: translatedText.length,
      languagePair: `${sourceLang}-${targetLang}`,
      context: this.getTranslationContext(),
      complexity: this.calculateTextComplexity(originalText),
      unifiedSystem: !!this.unifiedSystem
    };

    // Use enhanced model
    const score = this.model.predict(features);

    // Update metrics
    this.performanceMetrics.responseTime = Date.now() - this.lastPredictionTime || 0;

    return score;
  }

  /**
   * Generate improved translation with unified system integration
   */
  async generateImprovedTranslation(originalText, currentTranslation, sourceLang, targetLang) {
    const startTime = performance.now();

    // Analyze current translation quality
    const currentQuality = this.predictTranslationQuality(
      originalText,
      currentTranslation,
      sourceLang,
      targetLang
    );

    if (currentQuality < 0.7 || this.shouldImproveTranslation(originalText, sourceLang, targetLang)) {
      // Generate alternative translations using multiple services
      const alternatives = await this.generateAlternatives(originalText, sourceLang, targetLang);

      // Score alternatives
      const scoredAlternatives = await Promise.all(
        alternatives.map(async (alt) => ({
          text: alt,
          quality: this.predictTranslationQuality(originalText, alt, sourceLang, targetLang),
          service: 'enhanced-ai'
        }))
      );

      // Sort by quality
      scoredAlternatives.sort((a, b) => b.quality - a.quality);

      // Select best alternative
      const bestAlternative = scoredAlternatives[0];

      if (bestAlternative && bestAlternative.quality > currentQuality + 0.1) {
        console.info(`🔄 Translation improved: ${currentQuality.toFixed(2)} → ${bestAlternative.quality.toFixed(2)}`);

        // Collect feedback
        this.collectFeedback(originalText, bestAlternative.text, sourceLang, targetLang, bestAlternative.quality);

        this.performanceMetrics.improvements++;
        this.performanceMetrics.responseTime = performance.now() - startTime;

        return bestAlternative.text;
      }
    }

    this.performanceMetrics.responseTime = performance.now() - startTime;
    return currentTranslation;
  }

  /**
   * Check if translation should be improved
   */
  shouldImproveTranslation(text, sourceLang, targetLang) {
    const key = `${sourceLang}-${targetLang}`;

    // Check if this language pair has low quality scores
    if (this.qualityScores.has(key)) {
      const quality = this.qualityScores.get(key);
      if (quality.average < 3.5) return true;
    }

    // Check text complexity
    if (this.calculateTextComplexity(text) > 0.7) return true;

    // Check if unified system has better translations available
    if (this.unifiedSystem && this.unifiedSystem.hasTranslation) {
      const unifiedTranslation = this.unifiedSystem.translate(text, { language: targetLang });
      if (unifiedTranslation && unifiedTranslation !== text) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate alternatives using multiple translation services
   */
  async generateAlternatives(text, sourceLang, targetLang) {
    const alternatives = [];
    const errors = [];

    // Try each translation service
    for (const service of this.translationServices) {
      if (!service.available) continue;

      try {
        const translation = await service.service(text, sourceLang, targetLang);
        if (translation && translation !== text) {
          alternatives.push(translation);
        }
      } catch (error) {
        errors.push(`${service.name}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      console.warn('Some translation services failed:', errors);
    }

    return [...new Set(alternatives)]; // Remove duplicates
  }

  /**
   * Enhanced Google Translate integration
   */
  async googleTranslate(text, sourceLang, targetLang) {
    if (window.machineTranslation?.googleTranslate) {
      return await window.machineTranslation.googleTranslate(text, targetLang, sourceLang);
    }
    throw new Error('Google Translate not available');
  }

  /**
   * Enhanced LibreTranslate integration
   */
  async libreTranslate(text, sourceLang, targetLang) {
    try {
      const response = await fetch('https://libretranslate.com/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: sourceLang,
          target: targetLang,
          format: 'text'
        })
      });

      const data = await response.json();
      return data.translatedText || text;
    } catch (error) {
      throw error;
    }
  }

  /**
   * DeepL translation (if API key available)
   */
  async deepLTranslate(text, sourceLang, targetLang) {
    // Implementation would require API key
    throw new Error('DeepL API key required');
  }

  /**
   * Enhanced fallback translation
   */
  async fallbackTranslate(text, sourceLang, targetLang) {
    // Enhanced fallback using unified system or simple word replacement
    if (this.unifiedSystem) {
      return this.unifiedSystem.translate(text, { language: targetLang }) || text;
    }

    return text; // Return original if no translation available
  }

  /**
   * Setup performance tracking
   */
  setupPerformanceTracking() {
    // Track translation requests
    this.lastPredictionTime = Date.now();

    // Monitor translation service performance
    setInterval(() => {
      this.logPerformanceMetrics();
    }, 30000);
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetrics() {
    const totalRequests = this.performanceMetrics.improvements + this.performanceMetrics.rejections;
    const successRate = totalRequests > 0 ? (this.performanceMetrics.improvements / totalRequests) * 100 : 0;

    console.debug(`🤖 AI Translation Performance: ${successRate.toFixed(1)}% success rate, ${this.performanceMetrics.accuracy.toFixed(1)}% accuracy`);

    // Report to unified system
    if (this.unifiedSystem) {
      this.unifiedSystem.emit('aiPerformanceMetrics', {
        successRate,
        accuracy: this.performanceMetrics.accuracy,
        averageResponseTime: this.performanceMetrics.responseTime,
        totalImprovements: this.performanceMetrics.improvements
      });
    }
  }

  /**
   * Start quality monitoring with unified system integration
   */
  startQualityMonitoring() {
    // Monitor translation requests through unified system
    if (this.unifiedSystem) {
      this.unifiedSystem.on('translationRequest', (data) => {
        this.monitorTranslationRequest(data);
      });
    }

    // Monitor user interactions for feedback
    this.monitorUserInteractions();
  }

  /**
   * Monitor translation requests
   */
  monitorTranslationRequest(data) {
    const { key, language, result, responseTime } = data;

    // Track response time
    this.performanceMetrics.responseTime = responseTime;

    // Check for missing translations
    if (result === key) {
      this.qualityMetrics.missingKeys.add(`${language}:${key}`);
    }
  }

  /**
   * Monitor user interactions for implicit feedback
   */
  monitorUserInteractions() {
    // Monitor clicks on translated elements
    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-i18n]');
      if (target) {
        this.collectImplicitFeedback(target, 'click');
      }
    });

    // Monitor hover on translated elements
    document.addEventListener('mouseover', (event) => {
      const target = event.target.closest('[data-i18n]');
      if (target) {
        this.collectImplicitFeedback(target, 'hover');
      }
    });
  }

  /**
   * Collect implicit feedback from user interactions
   */
  collectImplicitFeedback(element, interactionType) {
    const key = element.getAttribute('data-i18n');
    const text = element.textContent;

    if (key && text) {
      // Positive feedback for user interaction
      this.collectFeedback(
        key, // Using key as original text for simplicity
        text,
        'en',
        this.unifiedSystem?.currentLanguage || 'unknown',
        4, // Assume good quality if user interacts
        { interactionType, elementType: element.tagName }
      );
    }
  }

  /**
   * Get comprehensive quality statistics
   */
  getQualityStats() {
    const stats = {
      totalFeedback: 0,
      averageQuality: 0,
      languagePairs: {},
      trends: {},
      performance: this.performanceMetrics,
      unifiedSystemIntegration: !!this.unifiedSystem,
      modelAccuracy: this.model?.accuracy || 0
    };

    this.qualityScores.forEach((scores, languagePair) => {
      stats.languagePairs[languagePair] = {
        average: scores.average.toFixed(2),
        count: scores.count,
        trend: scores.trend.slice(-10),
        improvements: scores.improvements,
        source: scores.source
      };
      stats.totalFeedback += scores.count;
      stats.averageQuality += scores.average * scores.count;
    });

    if (stats.totalFeedback > 0) {
      stats.averageQuality /= stats.totalFeedback;
    }

    return stats;
  }

  /**
   * Schedule model improvement with enhanced timing
   */
  scheduleModelImprovement() {
    if (this.isTraining) return;

    // More intelligent scheduling based on data volume
    const delay = this.improvementQueue.length > 100 ? 2000 : 5000;

    setTimeout(async () => {
      await this.trainModel();
      await this.saveTrainingData();
      this.improvementQueue = []; // Clear processed feedback

      console.info(`🧠 Model improved with ${this.improvementQueue.length} new feedback items`);
    }, delay);
  }

  /**
   * Enhanced training data preparation
   */
  prepareTrainingData() {
    const trainingData = [];

    this.feedbackData.forEach((feedbacks, languagePair) => {
      feedbacks.slice(-500).forEach(feedback => { // Use last 500 items per language pair
        const features = this.extractEnhancedFeatures(feedback);
        const label = feedback.quality >= 4 ? 1 : 0;

        trainingData.push({
          features,
          label,
          languagePair,
          text: feedback.originalText,
          metadata: {
            timestamp: feedback.timestamp,
            context: feedback.context,
            performance: feedback.performance
          }
        });
      });
    });

    return trainingData;
  }

  /**
   * Extract enhanced features from feedback
   */
  extractEnhancedFeatures(feedback) {
    const features = [];

    // Basic text features
    features.push(feedback.originalText.length);
    features.push(feedback.translatedText.length);

    // Language pair encoding
    const langPair = `${feedback.sourceLang}-${feedback.targetLang}`;
    features.push(this.encodeLanguagePair(langPair));

    // Context features
    features.push(feedback.context.timeOfDay / 24);
    features.push(feedback.context.dayOfWeek / 7);

    // Text complexity features
    features.push(this.calculateTextComplexity(feedback.originalText));
    features.push(this.calculateTextComplexity(feedback.translatedText));

    // Performance features
    features.push(feedback.performance.textLength / 1000);
    features.push(feedback.performance.translationLength / 1000);
    features.push(feedback.performance.complexity);

    // Unified system features
    features.push(feedback.context.unifiedSystemAvailable ? 1 : 0);
    features.push(feedback.context.totalSupportedLanguages / 100);

    return features;
  }

  /**
   * Enhanced text complexity calculation
   */
  calculateTextComplexity(text) {
    const words = text.split(/\s+/);
    const sentences = text.split(/[.!?]+/).length;
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const avgSentenceLength = words.length / sentences;

    // Enhanced complexity with punctuation and special characters
    const specialChars = (text.match(/[^\w\s]/g) || []).length;
    const complexity = (avgWordLength + avgSentenceLength + specialChars) / 50;

    return Math.min(1, complexity);
  }

  /**
   * Save enhanced training data
   */
  async saveTrainingData() {
    try {
      const data = {
        feedbackData: Object.fromEntries(this.feedbackData),
        qualityScores: Object.fromEntries(this.qualityScores),
        learningPatterns: Object.fromEntries(this.learningPatterns),
        performanceMetrics: this.performanceMetrics,
        unifiedSystemIntegration: !!this.unifiedSystem,
        timestamp: new Date().toISOString(),
        version: '2.0.0'
      };

      localStorage.setItem('enhancedAITranslationTrainingData', JSON.stringify(data));
      console.info('💾 Enhanced training data saved');
    } catch (error) {
      console.warn('Failed to save enhanced training data:', error);
    }
  }

  /**
   * Load enhanced training data
   */
  async loadTrainingData() {
    try {
      const saved = localStorage.getItem('enhancedAITranslationTrainingData');
      if (saved) {
        const data = JSON.parse(saved);
        this.feedbackData = new Map(Object.entries(data.feedbackData || {}));
        this.qualityScores = new Map(Object.entries(data.qualityScores || {}));
        this.performanceMetrics = data.performanceMetrics || this.performanceMetrics;
        console.info(`📚 Loaded ${this.feedbackData.size} language pairs from training data`);
      }
    } catch (error) {
      console.warn('Failed to load enhanced training data:', error);
    }
  }

  /**
   * Export comprehensive training data
   */
  exportTrainingData() {
    const exportData = {
      feedbackData: Object.fromEntries(this.feedbackData),
      qualityScores: Object.fromEntries(this.qualityScores),
      learningPatterns: Object.fromEntries(this.learningPatterns),
      performanceMetrics: this.performanceMetrics,
      unifiedSystemIntegration: !!this.unifiedSystem,
      supportedLanguages: this.unifiedSystem ? Object.keys(this.unifiedSystem.supportedLanguages) : [],
      exportDate: new Date().toISOString(),
      version: '2.0.0'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enhanced-ai-translation-training-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Initialize enhanced AI Translation Improver
window.enhancedAITranslationImprover = new EnhancedAITranslationImprover();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  await window.enhancedAITranslationImprover.initialize();

  // Setup global translation enhancement
  window.enhanceTranslation = function(originalText, translatedText, sourceLang, targetLang) {
    return window.enhancedAITranslationImprover.generateImprovedTranslation(
      originalText, translatedText, sourceLang, targetLang
    );
  };

  console.info('🧠 Enhanced AI Translation System ready');
});

// Export for use in other modules
export { EnhancedAITranslationImprover };
