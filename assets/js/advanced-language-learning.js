/**
 * Advanced Language Learning Gamification System
 * Implements research-backed gamification strategies for optimal learning outcomes
 */

class AdvancedLanguageLearningSystem extends LanguageLearningSystem {
  constructor() {
    super();
    this.gamification = {
      points: 0,
      level: 1,
      streak: 0,
      achievements: [],
      badges: [],
      leaderboard: [],
      dailyChallenges: [],
      learningPath: [],
      adaptiveDifficulty: 'medium'
    };
    this.researchInsights = this.loadResearchInsights();
  }

  /**
   * Initialize advanced language learning system
   */
  async initialize() {
    await super.initialize();
    console.info('🎮 Advanced Language Learning System initialized');
    this.setupGamificationEngine();
    this.setupAdaptiveLearning();
    this.generateDailyChallenges();
    return true;
  }

  /**
   * Setup gamification engine based on research findings
   */
  setupGamificationEngine() {
    // Research-backed gamification strategies
    this.gamificationStrategies = {
      // Points and rewards system
      pointsSystem: {
        vocabulary: { base: 10, bonus: 5, streak: 2 },
        grammar: { base: 15, bonus: 3, streak: 1 },
        listening: { base: 20, bonus: 8, streak: 3 },
        speaking: { base: 25, bonus: 10, streak: 4 },
        reading: { base: 12, bonus: 4, streak: 2 },
        writing: { base: 18, bonus: 6, streak: 3 }
      },

      // Achievement system
      achievements: [
        { id: 'first_word', name: 'First Steps', description: 'Learn your first word', points: 50, icon: '🌱' },
        { id: 'word_streak', name: 'On Fire', description: 'Learn 7 words in a row', points: 100, icon: '🔥' },
        { id: 'grammar_master', name: 'Grammar Guru', description: 'Complete 10 grammar exercises', points: 150, icon: '📚' },
        { id: 'conversation_starter', name: 'Chatty', description: 'Practice speaking 5 times', points: 200, icon: '💬' },
        { id: 'polyglot', name: 'Polyglot', description: 'Study 3 different languages', points: 300, icon: '🌍' },
        { id: 'perfectionist', name: 'Perfect Score', description: 'Get 100% on 5 quizzes', points: 250, icon: '⭐' }
      ],

      // Adaptive difficulty based on performance
      difficultyAdjustment: {
        threshold: 0.8, // 80% success rate
        increaseFactor: 1.2,
        decreaseFactor: 0.8
      }
    };

    this.loadUserGamificationData();
  }

  /**
   * Setup adaptive learning based on user performance
   */
  setupAdaptiveLearning() {
    this.performanceMetrics = {
      vocabulary: { correct: 0, total: 0, streak: 0 },
      grammar: { correct: 0, total: 0, streak: 0 },
      listening: { correct: 0, total: 0, streak: 0 },
      speaking: { correct: 0, total: 0, streak: 0 },
      reading: { correct: 0, total: 0, streak: 0 },
      writing: { correct: 0, total: 0, streak: 0 }
    };

    // Monitor performance and adjust difficulty
    setInterval(() => {
      this.adjustDifficulty();
    }, 30000); // Every 30 seconds
  }

  /**
   * Generate daily challenges based on user profile
   */
  generateDailyChallenges() {
    const challenges = [
      {
        id: 'vocabulary_challenge',
        title: 'Word Explorer',
        description: 'Learn 10 new words today',
        type: 'vocabulary',
        target: 10,
        points: 50,
        icon: '📖'
      },
      {
        id: 'grammar_challenge',
        title: 'Grammar Master',
        description: 'Complete 5 grammar exercises',
        type: 'grammar',
        target: 5,
        points: 75,
        icon: '✏️'
      },
      {
        id: 'streak_challenge',
        title: 'Consistency King',
        description: 'Maintain a 7-day learning streak',
        type: 'streak',
        target: 7,
        points: 100,
        icon: '🔥'
      }
    ];

    // Select 2-3 challenges based on user performance
    this.gamification.dailyChallenges = this.selectOptimalChallenges(challenges);
  }

  /**
   * Select optimal challenges based on user performance
   */
  selectOptimalChallenges(availableChallenges) {
    const userWeaknesses = this.identifyWeakAreas();
    const selected = [];

    // Prioritize weak areas
    userWeaknesses.forEach(weakness => {
      const challenge = availableChallenges.find(c => c.type === weakness);
      if (challenge) {
        selected.push(challenge);
      }
    });

    // Fill remaining slots with random challenges
    const remaining = availableChallenges.filter(c => !selected.includes(c));
    while (selected.length < 3 && remaining.length > 0) {
      const randomIndex = Math.floor(Math.random() * remaining.length);
      selected.push(remaining[randomIndex]);
      remaining.splice(randomIndex, 1);
    }

    return selected;
  }

  /**
   * Identify weak learning areas
   */
  identifyWeakAreas() {
    const weaknesses = [];
    const threshold = 0.7; // 70% success rate

    Object.entries(this.performanceMetrics).forEach(([skill, metrics]) => {
      if (metrics.total > 0) {
        const accuracy = metrics.correct / metrics.total;
        if (accuracy < threshold) {
          weaknesses.push(skill);
        }
      }
    });

    return weaknesses.length > 0 ? weaknesses : ['vocabulary']; // Default to vocabulary
  }

  /**
   * Process learning activity with gamification
   */
  async processLearningActivity(activityType, success, metadata = {}) {
    // Update performance metrics
    if (this.performanceMetrics[activityType]) {
      this.performanceMetrics[activityType].total++;
      if (success) {
        this.performanceMetrics[activityType].correct++;
        this.performanceMetrics[activityType].streak++;
      } else {
        this.performanceMetrics[activityType].streak = 0;
      }
    }

    // Award points based on research-backed system
    const points = this.calculatePoints(activityType, success, metadata);
    this.gamification.points += points;

    // Check for level up
    const newLevel = Math.floor(this.gamification.points / 500) + 1;
    if (newLevel > this.gamification.level) {
      this.levelUp(newLevel);
    }

    // Check for achievements
    this.checkAchievements(activityType, success, metadata);

    // Update streak
    if (success) {
      this.gamification.streak++;
    } else {
      this.gamification.streak = 0;
    }

    // Save progress
    this.saveUserGamificationData();
  }

  /**
   * Calculate points based on activity and success
   */
  calculatePoints(activityType, success, metadata) {
    const basePoints = this.gamificationStrategies.pointsSystem[activityType]?.base || 10;
    let points = basePoints;

    // Success bonus
    if (success) {
      points += this.gamificationStrategies.pointsSystem[activityType]?.bonus || 5;
    }

    // Streak bonus
    if (this.performanceMetrics[activityType]?.streak > 0) {
      points += this.performanceMetrics[activityType].streak *
                (this.gamificationStrategies.pointsSystem[activityType]?.streak || 1);
    }

    // Difficulty bonus
    if (metadata.difficulty === 'hard') {
      points *= 1.5;
    }

    return Math.round(points);
  }

  /**
   * Level up user
   */
  levelUp(newLevel) {
    const levelDiff = newLevel - this.gamification.level;
    this.gamification.level = newLevel;

    // Award level up bonus
    const bonusPoints = levelDiff * 100;
    this.gamification.points += bonusPoints;

    // Unlock new challenges
    this.unlockLevelChallenges(newLevel);

    // Show celebration
    this.showLevelUpCelebration(newLevel, bonusPoints);
  }

  /**
   * Check for achievements
   */
  checkAchievements(activityType, success, metadata) {
    this.gamificationStrategies.achievements.forEach(achievement => {
      if (!this.gamification.achievements.includes(achievement.id)) {
        if (this.checkAchievementCriteria(achievement, activityType, success, metadata)) {
          this.unlockAchievement(achievement);
        }
      }
    });
  }

  /**
   * Check if achievement criteria is met
   */
  checkAchievementCriteria(achievement, activityType, success, metadata) {
    switch (achievement.id) {
      case 'first_word':
        return this.getTotalWordsLearned() >= 1;
      case 'word_streak':
        return this.gamification.streak >= 7;
      case 'grammar_master':
        return this.performanceMetrics.grammar.correct >= 10;
      case 'conversation_starter':
        return this.performanceMetrics.speaking.correct >= 5;
      case 'polyglot':
        return Object.keys(this.userProgress).length >= 3;
      case 'perfectionist':
        return this.getPerfectQuizCount() >= 5;
      default:
        return false;
    }
  }

  /**
   * Unlock achievement
   */
  unlockAchievement(achievement) {
    this.gamification.achievements.push(achievement.id);
    this.gamification.points += achievement.points;

    // Show achievement notification
    this.showAchievementNotification(achievement);

    // Save progress
    this.saveUserGamificationData();
  }

  /**
   * Show achievement notification
   */
  showAchievementNotification(achievement) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
      <div class="achievement-icon">${achievement.icon}</div>
      <div class="achievement-content">
        <h3>🏆 ${achievement.name}</h3>
        <p>${achievement.description}</p>
        <small>+${achievement.points} points</small>
      </div>
    `;

    this.addAchievementStyles();
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('show');
    }, 100);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Adjust difficulty based on performance
   */
  adjustDifficulty() {
    const overallAccuracy = this.calculateOverallAccuracy();

    if (overallAccuracy > this.gamificationStrategies.difficultyAdjustment.threshold) {
      // Increase difficulty
      this.increaseDifficulty();
    } else if (overallAccuracy < 0.5) {
      // Decrease difficulty
      this.decreaseDifficulty();
    }
  }

  /**
   * Calculate overall accuracy
   */
  calculateOverallAccuracy() {
    let totalCorrect = 0;
    let totalAttempts = 0;

    Object.values(this.performanceMetrics).forEach(metrics => {
      totalCorrect += metrics.correct;
      totalAttempts += metrics.total;
    });

    return totalAttempts > 0 ? totalCorrect / totalAttempts : 0;
  }

  /**
   * Increase difficulty
   */
  increaseDifficulty() {
    const difficulties = ['easy', 'medium', 'hard'];
    const currentIndex = difficulties.indexOf(this.gamification.adaptiveDifficulty);

    if (currentIndex < difficulties.length - 1) {
      this.gamification.adaptiveDifficulty = difficulties[currentIndex + 1];
      console.info(`📈 Difficulty increased to: ${this.gamification.adaptiveDifficulty}`);
    }
  }

  /**
   * Decrease difficulty
   */
  decreaseDifficulty() {
    const difficulties = ['easy', 'medium', 'hard'];
    const currentIndex = difficulties.indexOf(this.gamification.adaptiveDifficulty);

    if (currentIndex > 0) {
      this.gamification.adaptiveDifficulty = difficulties[currentIndex - 1];
      console.info(`📉 Difficulty decreased to: ${this.gamification.adaptiveDifficulty}`);
    }
  }

  /**
   * Load research insights
   */
  loadResearchInsights() {
    return {
      optimalSessionLength: 25, // minutes (Pomodoro technique)
      optimalRepetitionInterval: [1, 3, 7, 14, 30], // days
      effectiveGamificationElements: ['points', 'badges', 'leaderboards', 'progress_bars'],
      motivationFactors: ['autonomy', 'mastery', 'purpose', 'social_connection']
    };
  }

  /**
   * Get personalized learning recommendations
   */
  getPersonalizedRecommendations() {
    const recommendations = [];
    const weakAreas = this.identifyWeakAreas();

    weakAreas.forEach(area => {
      recommendations.push({
        type: 'focus_area',
        skill: area,
        reason: 'Performance below 70% accuracy',
        suggestion: `Practice ${area} for 15 minutes daily`,
        priority: 'high'
      });
    });

    // Add streak maintenance recommendation
    if (this.gamification.streak > 0) {
      recommendations.push({
        type: 'streak_maintenance',
        suggestion: 'Keep your learning streak alive!',
        priority: 'medium'
      });
    }

    return recommendations;
  }

  /**
   * Add achievement styles
   */
  addAchievementStyles() {
    if (document.getElementById('achievement-styles')) return;

    const style = document.createElement('style');
    style.id = 'achievement-styles';
    style.textContent = `
      .achievement-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        z-index: 10001;
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 250px;
        transform: translateX(100%);
        transition: transform 0.3s ease;
      }

      .achievement-notification.show {
        transform: translateX(0);
      }

      .achievement-icon {
        font-size: 24px;
      }

      .achievement-content h3 {
        margin: 0 0 5px 0;
        font-size: 16px;
      }

      .achievement-content p {
        margin: 0 0 5px 0;
        font-size: 12px;
        opacity: 0.9;
      }

      .achievement-content small {
        font-size: 10px;
        opacity: 0.8;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Show level up celebration
   */
  showLevelUpCelebration(newLevel, bonusPoints) {
    const celebration = document.createElement('div');
    celebration.className = 'level-up-celebration';
    celebration.innerHTML = `
      <div class="celebration-content">
        <h2>🎉 Level Up!</h2>
        <p>You reached level ${newLevel}!</p>
        <small>+${bonusPoints} bonus points</small>
      </div>
    `;

    this.addCelebrationStyles();
    document.body.appendChild(celebration);

    setTimeout(() => {
      celebration.classList.add('show');
    }, 100);

    setTimeout(() => {
      celebration.classList.remove('show');
      setTimeout(() => celebration.remove(), 300);
    }, 4000);
  }

  /**
   * Add celebration styles
   */
  addCelebrationStyles() {
    if (document.getElementById('celebration-styles')) return;

    const style = document.createElement('style');
    style.id = 'celebration-styles';
    style.textContent = `
      .level-up-celebration {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%);
        color: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        z-index: 10002;
        text-align: center;
        opacity: 0;
        transition: opacity 0.4s ease;
      }

      .level-up-celebration.show {
        opacity: 1;
      }

      .celebration-content h2 {
        margin: 0 0 10px 0;
        font-size: 24px;
      }

      .celebration-content p {
        margin: 0 0 5px 0;
        font-size: 16px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Load user gamification data
   */
  loadUserGamificationData() {
    try {
      const saved = localStorage.getItem('userGamificationData');
      if (saved) {
        const data = JSON.parse(saved);
        this.gamification = { ...this.gamification, ...data };
      }
    } catch (error) {
      console.warn('Failed to load gamification data:', error);
    }
  }

  /**
   * Save user gamification data
   */
  saveUserGamificationData() {
    try {
      localStorage.setItem('userGamificationData', JSON.stringify(this.gamification));
    } catch (error) {
      console.warn('Failed to save gamification data:', error);
    }
  }

  /**
   * Get total words learned
   */
  getTotalWordsLearned() {
    return Object.values(this.userProgress).reduce((total, lang) => {
      return total + (lang.vocabulary?.learned || 0);
    }, 0);
  }

  /**
   * Get perfect quiz count
   */
  getPerfectQuizCount() {
    return Object.values(this.userProgress).reduce((total, lang) => {
      return total + (lang.perfectQuizzes || 0);
    }, 0);
  }

  /**
   * Get gamification statistics
   */
  getGamificationStats() {
    return {
      ...this.gamification,
      performanceMetrics: this.performanceMetrics,
      recommendations: this.getPersonalizedRecommendations(),
      researchInsights: this.researchInsights
    };
  }

  /**
   * Export gamification data
   */
  exportGamificationData() {
    const exportData = {
      gamification: this.gamification,
      performanceMetrics: this.performanceMetrics,
      researchInsights: this.researchInsights,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qui-browser-gamification-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Replace the basic language learning system with the advanced one
window.languageLearning = new AdvancedLanguageLearningSystem();

// Export for use in other modules
export { AdvancedLanguageLearningSystem };
