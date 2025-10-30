/**
 * Machine Translation Integration
 * Integrates Google Translate API and other translation services
 */

class MachineTranslationService {
  constructor() {
    this.apiKey = null;
    this.baseUrl = 'https://translation.googleapis.com/language/translate/v2';
    this.cache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
    this.fallbackServices = ['libretranslate', 'deepl'];
  }

  /**
   * Initialize translation service with API key
   */
  async initialize(apiKey = null) {
    this.apiKey = apiKey || localStorage.getItem('googleTranslateApiKey');

    if (this.apiKey) {
      console.info('🈯 Machine translation service initialized');
      return true;
    } else {
      console.warn('⚠️ Machine translation API key not provided');
      return false;
    }
  }

  /**
   * Translate text using Google Translate API
   */
  async translate(text, targetLang, sourceLang = 'auto') {
    if (!text || !targetLang) return text;

    const cacheKey = `${sourceLang}-${targetLang}-${text}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          target: targetLang,
          source: sourceLang,
          format: 'text'
        })
      });

      if (response.ok) {
        const data = await response.json();
        const translation = data.data.translations[0].translatedText;

        this.saveToCache(cacheKey, translation);
        return translation;
      } else {
        console.error('Translation API error:', response.status);
        return this.fallbackTranslate(text, targetLang, sourceLang);
      }
    } catch (error) {
      console.error('Translation service error:', error);
      return this.fallbackTranslate(text, targetLang, sourceLang);
    }
  }

  /**
   * Fallback translation using alternative services
   */
  async fallbackTranslate(text, targetLang, sourceLang) {
    console.info('🔄 Using fallback translation service');

    try {
      // Try LibreTranslate (free alternative)
      const libreResponse = await fetch('https://translate.argosopentech.com/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          source: sourceLang === 'auto' ? 'en' : sourceLang,
          target: targetLang,
          format: 'text'
        })
      });

      if (libreResponse.ok) {
        const data = await libreResponse.json();
        return data.translatedText;
      }
    } catch (error) {
      console.error('Fallback translation error:', error);
    }

    return text; // Return original text if all services fail
  }

  /**
   * Detect language of given text
   */
  async detectLanguage(text) {
    if (!this.apiKey) return 'en';

    try {
      const response = await fetch(`${this.baseUrl}/detect?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.data.detections[0][0].language;
      }
    } catch (error) {
      console.error('Language detection error:', error);
    }

    return 'en';
  }

  /**
   * Get supported languages
   */
  async getSupportedLanguages() {
    if (!this.apiKey) return this.getFallbackLanguages();

    try {
      const response = await fetch(`${this.baseUrl}/languages?key=${this.apiKey}`);

      if (response.ok) {
        const data = await response.json();
        return data.data.languages;
      }
    } catch (error) {
      console.error('Get languages error:', error);
    }

    return this.getFallbackLanguages();
  }

  /**
   * Fallback language list when API is not available
   */
  getFallbackLanguages() {
    return [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ar', name: 'Arabic' },
      { code: 'hi', name: 'Hindi' }
    ];
  }

  /**
   * Cache management
   */
  saveToCache(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });

    // Clean old cache entries
    if (this.cache.size > 1000) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.value;
    }
    if (cached) {
      this.cache.delete(key); // Remove expired cache
    }
    return null;
  }
}

// Language Learning System
class LanguageLearningSystem {
  constructor() {
    this.userProgress = this.loadUserProgress();
    this.dailyGoals = this.getDailyGoals();
    this.vocabulary = new Map();
    this.achievements = [];
  }

  /**
   * Initialize language learning system
   */
  async initialize() {
    console.info('📚 Language learning system initialized');
    await this.loadVocabulary();
    this.setupDailyReminders();
    return true;
  }

  /**
   * Translate and learn new words
   */
  async translateAndLearn(text, sourceLang, targetLang) {
    const translation = await window.machineTranslation.translate(text, targetLang, sourceLang);

    // Add to vocabulary if it's a new word
    await this.addToVocabulary(text, translation, sourceLang, targetLang);

    // Update learning progress
    this.updateProgress(targetLang, 'vocabulary', 1);

    return {
      original: text,
      translation,
      pronunciation: await this.getPronunciation(text, sourceLang),
      examples: await this.getExamples(text, sourceLang, targetLang)
    };
  }

  /**
   * Add word to user's vocabulary
   */
  async addToVocabulary(word, translation, sourceLang, targetLang) {
    const key = `${sourceLang}-${targetLang}-${word.toLowerCase()}`;

    if (!this.vocabulary.has(key)) {
      this.vocabulary.set(key, {
        word,
        translation,
        sourceLang,
        targetLang,
        addedDate: new Date().toISOString(),
        reviewCount: 0,
        lastReviewed: null,
        difficulty: this.calculateDifficulty(word),
        category: this.categorizeWord(word, translation)
      });

      this.saveVocabulary();
    }
  }

  /**
   * Get pronunciation for a word
   */
  async getPronunciation(word, language) {
    // This would integrate with text-to-speech APIs
    return {
      phonetic: await this.getPhonetic(word, language),
      audioUrl: null // Would generate TTS audio
    };
  }

  /**
   * Get example sentences
   */
  async getExamples(word, sourceLang, targetLang) {
    // This would fetch examples from translation APIs or databases
    return [
      {
        source: `${word} example sentence`,
        target: `例の文 ${word}`
      }
    ];
  }

  /**
   * Calculate word difficulty
   */
  calculateDifficulty(word) {
    const length = word.length;
    if (length <= 4) return 'easy';
    if (length <= 8) return 'medium';
    return 'hard';
  }

  /**
   * Categorize word by context
   */
  categorizeWord(word, translation) {
    // Simple categorization based on word content
    if (word.includes('http') || word.includes('www')) return 'technology';
    if (/^\d/.test(word)) return 'numbers';
    return 'general';
  }

  /**
   * Update learning progress
   */
  updateProgress(language, skill, points) {
    if (!this.userProgress[language]) {
      this.userProgress[language] = {
        level: 1,
        xp: 0,
        skills: {},
        achievements: []
      };
    }

    this.userProgress[language].xp += points;

    // Level up calculation
    const xpForNextLevel = this.userProgress[language].level * 100;
    if (this.userProgress[language].xp >= xpForNextLevel) {
      this.userProgress[language].level++;
      this.unlockAchievement(language, 'level_up');
    }

    this.saveUserProgress();
  }

  /**
   * Unlock achievements
   */
  unlockAchievement(language, achievementType) {
    const achievement = {
      type: achievementType,
      language,
      date: new Date().toISOString()
    };

    this.achievements.push(achievement);
    this.userProgress[language].achievements.push(achievement);
  }

  /**
   * Get daily learning goals
   */
  getDailyGoals() {
    return {
      wordsToLearn: 10,
      timeToStudy: 30, // minutes
      skillsToPractice: ['vocabulary', 'pronunciation', 'grammar']
    };
  }

  /**
   * Load user progress from localStorage
   */
  loadUserProgress() {
    const saved = localStorage.getItem('languageLearningProgress');
    return saved ? JSON.parse(saved) : {};
  }

  /**
   * Save user progress to localStorage
   */
  saveUserProgress() {
    localStorage.setItem('languageLearningProgress', JSON.stringify(this.userProgress));
  }

  /**
   * Load vocabulary from storage
   */
  async loadVocabulary() {
    const saved = localStorage.getItem('userVocabulary');
    if (saved) {
      const vocabData = JSON.parse(saved);
      this.vocabulary = new Map(Object.entries(vocabData));
    }
  }

  /**
   * Save vocabulary to storage
   */
  saveVocabulary() {
    const vocabObj = Object.fromEntries(this.vocabulary);
    localStorage.setItem('userVocabulary', JSON.stringify(vocabObj));
  }

  /**
   * Setup daily reminders
   */
  setupDailyReminders() {
    // Check if user wants daily reminders
    const remindersEnabled = localStorage.getItem('dailyReminders') === 'true';

    if (remindersEnabled) {
      this.scheduleDailyReminder();
    }
  }

  /**
   * Schedule daily learning reminder
   */
  scheduleDailyReminder() {
    // This would integrate with browser notification API
    const now = new Date();
    const reminderTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next day

    setTimeout(() => {
      this.showLearningReminder();
      this.scheduleDailyReminder(); // Reschedule
    }, reminderTime - now);
  }

  /**
   * Show learning reminder notification
   */
  showLearningReminder() {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🌟 Time to Learn!', {
        body: `Practice ${this.dailyGoals.wordsToLearn} new words today!`,
        icon: '/assets/icons/learn-icon.png'
      });
    }
  }

  /**
   * Get learning statistics
   */
  getLearningStats(language = null) {
    if (language) {
      return this.userProgress[language] || { level: 1, xp: 0, skills: {} };
    }

    return {
      totalLanguages: Object.keys(this.userProgress).length,
      totalWords: this.vocabulary.size,
      totalAchievements: this.achievements.length,
      averageLevel: this.calculateAverageLevel()
    };
  }

  /**
   * Calculate average level across all languages
   */
  calculateAverageLevel() {
    const languages = Object.keys(this.userProgress);
    if (languages.length === 0) return 1;

    const totalLevel = languages.reduce((sum, lang) =>
      sum + (this.userProgress[lang].level || 1), 0
    );

    return (totalLevel / languages.length).toFixed(1);
  }
}

// Initialize services globally
window.machineTranslation = new MachineTranslationService();
window.languageLearning = new LanguageLearningSystem();

// Auto-initialize when i18n is ready
document.addEventListener('languageChanged', async (event) => {
  const { language } = event.detail;

  // Initialize machine translation if API key is available
  await window.machineTranslation.initialize();

  // Update learning system for new language
  window.languageLearning.updateProgress(language, 'language_switch', 1);
});

// Export for use in other modules
export { MachineTranslationService, LanguageLearningSystem };
