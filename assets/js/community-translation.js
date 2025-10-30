/**
 * Community Translation System
 * Allows users to contribute translation improvements and vote on quality
 */

class CommunityTranslationSystem {
  constructor() {
    this.suggestions = new Map();
    this.votes = new Map();
    this.userContributions = new Map();
    this.translationHistory = new Map();
  }

  /**
   * Initialize community translation system
   */
  async initialize() {
    console.info('🌐 Community Translation System initialized');
    await this.loadCommunityData();
    this.setupContributionInterface();
    return true;
  }

  /**
   * Submit translation suggestion
   */
  async submitSuggestion(originalText, currentTranslation, suggestedTranslation, sourceLang, targetLang, userId = 'anonymous') {
    const suggestionId = Date.now() + Math.random().toString(36).substr(2, 9);

    const suggestion = {
      id: suggestionId,
      originalText,
      currentTranslation,
      suggestedTranslation,
      sourceLang,
      targetLang,
      userId,
      timestamp: new Date().toISOString(),
      status: 'pending', // pending, approved, rejected
      votes: {
        up: 0,
        down: 0,
        total: 0
      },
      comments: [],
      metadata: {
        context: window.location.href,
        userAgent: navigator.userAgent,
        textLength: originalText.length,
        difficulty: this.assessDifficulty(originalText, suggestedTranslation)
      }
    };

    const key = `${sourceLang}-${targetLang}-${this.hashText(originalText)}`;
    if (!this.suggestions.has(key)) {
      this.suggestions.set(key, []);
    }
    this.suggestions.get(key).push(suggestion);

    // Track user contribution
    this.trackUserContribution(userId, 'suggestion');

    // Store locally
    this.saveCommunityData();

    // Send to server (in real implementation)
    await this.submitToServer(suggestion);

    return suggestionId;
  }

  /**
   * Vote on translation suggestion
   */
  async voteOnSuggestion(suggestionId, voteType, userId = 'anonymous') {
    // Find suggestion
    let targetSuggestion = null;
    let suggestionKey = null;

    for (const [key, suggestions] of this.suggestions) {
      const suggestion = suggestions.find(s => s.id === suggestionId);
      if (suggestion) {
        targetSuggestion = suggestion;
        suggestionKey = key;
        break;
      }
    }

    if (!targetSuggestion) {
      throw new Error('Suggestion not found');
    }

    // Check if user already voted
    const userVoteKey = `${suggestionId}-${userId}`;
    if (this.votes.has(userVoteKey)) {
      throw new Error('User already voted on this suggestion');
    }

    // Record vote
    targetSuggestion.votes[voteType]++;
    targetSuggestion.votes.total++;

    // Calculate score
    const upVotes = targetSuggestion.votes.up;
    const downVotes = targetSuggestion.votes.down;
    targetSuggestion.score = upVotes - downVotes;

    // Auto-approve high-quality suggestions
    if (targetSuggestion.score >= 10 && targetSuggestion.votes.total >= 5) {
      await this.approveSuggestion(suggestionId);
    }

    // Track user contribution
    this.trackUserContribution(userId, 'vote');

    // Store vote
    this.votes.set(userVoteKey, {
      suggestionId,
      userId,
      voteType,
      timestamp: new Date().toISOString()
    });

    this.saveCommunityData();
    return true;
  }

  /**
   * Approve suggestion and update translation
   */
  async approveSuggestion(suggestionId) {
    let targetSuggestion = null;

    for (const [key, suggestions] of this.suggestions) {
      const suggestion = suggestions.find(s => s.id === suggestionId);
      if (suggestion) {
        targetSuggestion = suggestion;
        break;
      }
    }

    if (!targetSuggestion) {
      throw new Error('Suggestion not found');
    }

    targetSuggestion.status = 'approved';

    // Update translation in memory
    await this.updateTranslationFile(targetSuggestion);

    // Notify contributors
    this.notifyContributors(targetSuggestion);

    return true;
  }

  /**
   * Update translation file with approved suggestion
   */
  async updateTranslationFile(suggestion) {
    try {
      // In a real implementation, this would update the translation files
      // For now, we'll store it in localStorage for demonstration
      const key = `${suggestion.sourceLang}-${suggestion.targetLang}-${this.hashText(suggestion.originalText)}`;

      const translationUpdates = JSON.parse(localStorage.getItem('translationUpdates') || '{}');
      translationUpdates[key] = {
        original: suggestion.originalText,
        improved: suggestion.suggestedTranslation,
        approvedAt: new Date().toISOString(),
        approvedBy: 'community'
      };

      localStorage.setItem('translationUpdates', JSON.stringify(translationUpdates));

      console.info(`✅ Translation updated: ${suggestion.originalText} → ${suggestion.suggestedTranslation}`);
    } catch (error) {
      console.error('Failed to update translation file:', error);
    }
  }

  /**
   * Get suggestions for text
   */
  getSuggestionsForText(originalText, sourceLang, targetLang) {
    const key = `${sourceLang}-${targetLang}-${this.hashText(originalText)}`;
    return this.suggestions.get(key) || [];
  }

  /**
   * Get community statistics
   */
  getCommunityStats() {
    const stats = {
      totalSuggestions: 0,
      totalVotes: this.votes.size,
      totalContributors: this.userContributions.size,
      approvedSuggestions: 0,
      languages: {},
      trends: {}
    };

    this.suggestions.forEach((suggestionList, key) => {
      const [sourceLang, targetLang] = key.split('-').slice(0, 2);
      const langKey = `${sourceLang}-${targetLang}`;

      if (!stats.languages[langKey]) {
        stats.languages[langKey] = {
          suggestions: 0,
          approved: 0
        };
      }

      stats.languages[langKey].suggestions += suggestionList.length;
      stats.languages[langKey].approved += suggestionList.filter(s => s.status === 'approved').length;
      stats.totalSuggestions += suggestionList.length;
      stats.approvedSuggestions += suggestionList.filter(s => s.status === 'approved').length;
    });

    return stats;
  }

  /**
   * Setup user interface for contributions
   */
  setupContributionInterface() {
    // Add translation improvement buttons to translated content
    this.injectContributionButtons();

    // Setup keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        this.toggleTranslationMode();
      }
    });
  }

  /**
   * Inject contribution buttons into translated elements
   */
  injectContributionButtons() {
    // This would be called after translations are applied
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const originalText = element.dataset.originalText || element.textContent;
      const translatedText = element.textContent;

      if (originalText && translatedText && originalText !== translatedText) {
        this.addContributionButton(element, originalText, translatedText);
      }
    });
  }

  /**
   * Add contribution button to element
   */
  addContributionButton(element, originalText, translatedText) {
    const button = document.createElement('button');
    button.className = 'translation-improve-btn';
    button.innerHTML = '✏️';
    button.title = '翻訳を改善する';

    button.addEventListener('click', () => {
      this.showTranslationEditor(originalText, translatedText);
    });

    element.appendChild(button);
  }

  /**
   * Show translation editor modal
   */
  showTranslationEditor(originalText, currentTranslation) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'translation-editor-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>翻訳を改善する</h3>
        <div class="original-text">
          <strong>原文:</strong>
          <div class="text-content">${originalText}</div>
        </div>
        <div class="current-translation">
          <strong>現在の翻訳:</strong>
          <div class="text-content">${currentTranslation}</div>
        </div>
        <div class="suggestion-input">
          <label>改善提案:</label>
          <textarea placeholder="より良い翻訳を提案してください...">${currentTranslation}</textarea>
        </div>
        <div class="modal-actions">
          <button class="submit-suggestion">提案を送信</button>
          <button class="cancel">キャンセル</button>
        </div>
      </div>
    `;

    // Add styles
    this.addModalStyles();

    // Event listeners
    const textarea = modal.querySelector('textarea');
    const submitBtn = modal.querySelector('.submit-suggestion');
    const cancelBtn = modal.querySelector('.cancel');

    submitBtn.addEventListener('click', async () => {
      const suggestion = textarea.value.trim();
      if (suggestion && suggestion !== currentTranslation) {
        await this.submitSuggestion(
          originalText,
          currentTranslation,
          suggestion,
          'auto', // Will be detected
          i18next.language
        );
        this.showSuccessMessage('翻訳提案が送信されました！');
        modal.remove();
      }
    });

    cancelBtn.addEventListener('click', () => {
      modal.remove();
    });

    document.body.appendChild(modal);
  }

  /**
   * Add modal styles
   */
  addModalStyles() {
    if (document.getElementById('translation-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'translation-modal-styles';
    style.textContent = `
      .translation-editor-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
      }
      .modal-content {
        background: white;
        padding: 20px;
        border-radius: 8px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
      }
      .text-content {
        background: #f5f5f5;
        padding: 10px;
        border-radius: 4px;
        margin: 5px 0;
        font-family: monospace;
      }
      .suggestion-input textarea {
        width: 100%;
        min-height: 100px;
        margin: 10px 0;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      .modal-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 15px;
      }
      .modal-actions button {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .submit-suggestion {
        background: #007bff;
        color: white;
      }
      .cancel {
        background: #6c757d;
        color: white;
      }
      .translation-improve-btn {
        margin-left: 5px;
        background: none;
        border: none;
        cursor: pointer;
        opacity: 0.6;
        transition: opacity 0.2s;
      }
      .translation-improve-btn:hover {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Show success message
   */
  showSuccessMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'success-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #28a745;
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      z-index: 10001;
    `;

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  /**
   * Assess translation difficulty
   */
  assessDifficulty(originalText, translation) {
    const factors = {
      lengthRatio: Math.abs(originalText.length - translation.length) / originalText.length,
      technicalTerms: /\b(function|variable|class|object|method|api)\b/i.test(originalText),
      culturalReferences: /\b(festival|holiday|custom|tradition)\b/i.test(originalText),
      formality: this.assessFormality(originalText, translation)
    };

    let difficulty = 'easy';
    if (factors.technicalTerms || factors.culturalReferences || factors.formality > 0.5) {
      difficulty = 'hard';
    } else if (factors.lengthRatio > 0.3) {
      difficulty = 'medium';
    }

    return difficulty;
  }

  /**
   * Assess formality level
   */
  assessFormality(original, translation) {
    const formalWords = /\b(therefore|however|furthermore|consequently|moreover)\b/i;
    const informalWords = /\b(like|kinda|sorta|gonna|wanna)\b/i;

    const originalFormal = formalWords.test(original) ? 1 : 0;
    const translationFormal = formalWords.test(translation) ? 1 : 0;
    const informalPenalty = informalWords.test(translation) ? 0.5 : 0;

    return Math.abs(originalFormal - translationFormal) + informalPenalty;
  }

  /**
   * Hash text for indexing
   */
  hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Track user contributions
   */
  trackUserContribution(userId, type) {
    if (!this.userContributions.has(userId)) {
      this.userContributions.set(userId, {
        suggestions: 0,
        votes: 0,
        approvals: 0,
        joinDate: new Date().toISOString()
      });
    }

    this.userContributions.get(userId)[type + 's']++;
    this.saveCommunityData();
  }

  /**
   * Load community data from storage
   */
  async loadCommunityData() {
    try {
      const saved = localStorage.getItem('communityTranslationData');
      if (saved) {
        const data = JSON.parse(saved);
        this.suggestions = new Map(Object.entries(data.suggestions || {}));
        this.votes = new Map(Object.entries(data.votes || {}));
        this.userContributions = new Map(Object.entries(data.userContributions || {}));
      }
    } catch (error) {
      console.warn('Failed to load community data:', error);
    }
  }

  /**
   * Save community data to storage
   */
  saveCommunityData() {
    try {
      const data = {
        suggestions: Object.fromEntries(this.suggestions),
        votes: Object.fromEntries(this.votes),
        userContributions: Object.fromEntries(this.userContributions),
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem('communityTranslationData', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save community data:', error);
    }
  }

  /**
   * Submit suggestion to server
   */
  async submitToServer(suggestion) {
    // In real implementation, send to backend API
    console.info('📤 Submitting suggestion to server:', suggestion.id);
  }

  /**
   * Notify contributors about approvals
   */
  notifyContributors(suggestion) {
    // In real implementation, send notifications
    console.info(`🎉 Suggestion approved: ${suggestion.id}`);
  }

  /**
   * Toggle translation contribution mode
   */
  toggleTranslationMode() {
    const isActive = document.body.classList.toggle('translation-mode');
    console.info(isActive ? '✏️ Translation mode enabled' : '✏️ Translation mode disabled');
  }

  /**
   * Get leaderboard
   */
  getLeaderboard() {
    const leaderboard = [];

    this.userContributions.forEach((stats, userId) => {
      const score = stats.suggestions * 10 + stats.votes * 2 + stats.approvals * 50;
      leaderboard.push({
        userId,
        score,
        ...stats
      });
    });

    return leaderboard.sort((a, b) => b.score - a.score).slice(0, 10);
  }
}

// Initialize community translation system
window.communityTranslation = new CommunityTranslationSystem();

// Export for use in other modules
export { CommunityTranslationSystem };
