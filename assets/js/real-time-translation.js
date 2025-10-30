/**
 * Real-Time Translation Enhancement System
 * Provides instant translation capabilities with context awareness
 */

class RealTimeTranslationSystem {
  constructor() {
    this.translationCache = new Map();
    this.contextHistory = [];
    this.isEnabled = false;
    this.observers = [];
    this.translationQueue = [];
    this.processingQueue = false;
  }

  /**
   * Initialize real-time translation system
   */
  async initialize() {
    console.info('⚡ Real-Time Translation System initialized');
    this.setupTextSelection();
    this.setupAutoTranslation();
    this.startQueueProcessor();
    return true;
  }

  /**
   * Setup text selection translation
   */
  setupTextSelection() {
    let selectionTimeout;

    document.addEventListener('selectionchange', () => {
      clearTimeout(selectionTimeout);

      selectionTimeout = setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText && selectedText.length > 3) {
          this.showTranslationForSelection(selectedText, selection);
        }
      }, 300);
    });
  }

  /**
   * Setup automatic translation for dynamic content
   */
  setupAutoTranslation() {
    // Monitor for new content
    this.observeContentChanges();

    // Auto-translate specific content types
    this.setupAutoTranslationRules();
  }

  /**
   * Observe content changes for automatic translation
   */
  observeContentChanges() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.processNewContent(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Process new content for potential translation
   */
  processNewContent(element) {
    // Auto-translate specific content types
    const translatableElements = element.querySelectorAll('[data-auto-translate], .news-article, .blog-post, .comment');

    translatableElements.forEach(el => {
      if (!el.hasAttribute('data-translated')) {
        this.autoTranslateElement(el);
      }
    });
  }

  /**
   * Setup auto-translation rules
   */
  setupAutoTranslationRules() {
    // Define content types that should be auto-translated
    this.autoTranslateRules = [
      {
        selector: '[data-auto-translate]',
        priority: 'high'
      },
      {
        selector: '.news-article h1, .news-article h2, .news-article p',
        priority: 'medium'
      },
      {
        selector: '.blog-post .content p',
        priority: 'medium'
      },
      {
        selector: '.comment .text',
        priority: 'low'
      }
    ];
  }

  /**
   * Show translation for selected text
   */
  async showTranslationForSelection(text, selection) {
    const rect = this.getSelectionRect(selection);
    if (!rect) return;

    // Check cache first
    const cacheKey = `${i18next.language}-${text}`;
    if (this.translationCache.has(cacheKey)) {
      this.displayTranslationBubble(this.translationCache.get(cacheKey), rect, text);
      return;
    }

    // Queue translation request
    this.translationQueue.push({
      text,
      rect,
      selection,
      type: 'selection'
    });

    // Process queue if not already processing
    if (!this.processingQueue) {
      this.processTranslationQueue();
    }
  }

  /**
   * Process translation queue
   */
  async processTranslationQueue() {
    if (this.translationQueue.length === 0 || this.processingQueue) return;

    this.processingQueue = true;

    while (this.translationQueue.length > 0) {
      const item = this.translationQueue.shift();

      try {
        const translation = await window.machineTranslation.translate(
          item.text,
          i18next.language,
          'auto'
        );

        // Cache translation
        const cacheKey = `${i18next.language}-${item.text}`;
        this.translationCache.set(cacheKey, translation);

        // Display translation
        this.displayTranslationBubble(translation, item.rect, item.text);

        // Add to context history
        this.addToContextHistory(item.text, translation);

      } catch (error) {
        console.error('Translation failed:', error);
      }
    }

    this.processingQueue = false;
  }

  /**
   * Display translation in a floating bubble
   */
  displayTranslationBubble(translation, rect, originalText) {
    // Remove existing bubble
    this.removeExistingBubble();

    const bubble = document.createElement('div');
    bubble.className = 'translation-bubble';
    bubble.innerHTML = `
      <div class="translation-header">
        <span class="original-text">${originalText}</span>
        <button class="close-bubble">×</button>
      </div>
      <div class="translation-content">
        <div class="translated-text">${translation}</div>
        <div class="translation-actions">
          <button class="copy-translation">コピー</button>
          <button class="improve-translation">改善</button>
          <button class="add-to-vocabulary">語彙に追加</button>
        </div>
      </div>
    `;

    // Position bubble
    bubble.style.cssText = `
      position: fixed;
      top: ${rect.bottom + 5}px;
      left: ${rect.left}px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 10000;
      min-width: 200px;
      max-width: 400px;
      font-size: 14px;
    `;

    this.addBubbleStyles();

    // Event listeners
    bubble.querySelector('.close-bubble').addEventListener('click', () => {
      bubble.remove();
    });

    bubble.querySelector('.copy-translation').addEventListener('click', () => {
      navigator.clipboard.writeText(translation);
      this.showToast('翻訳がクリップボードにコピーされました');
    });

    bubble.querySelector('.improve-translation').addEventListener('click', () => {
      this.showImprovementDialog(originalText, translation);
    });

    bubble.querySelector('.add-to-vocabulary').addEventListener('click', () => {
      window.languageLearning.addToVocabulary(originalText, translation, 'auto', i18next.language);
      this.showToast('語彙に追加されました');
      bubble.remove();
    });

    document.body.appendChild(bubble);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (bubble.parentNode) {
        bubble.remove();
      }
    }, 10000);
  }

  /**
   * Remove existing translation bubble
   */
  removeExistingBubble() {
    const existing = document.querySelector('.translation-bubble');
    if (existing) {
      existing.remove();
    }
  }

  /**
   * Get selection rectangle
   */
  getSelectionRect(selection) {
    if (selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    return range.getBoundingClientRect();
  }

  /**
   * Auto-translate element content
   */
  async autoTranslateElement(element) {
    const textContent = element.textContent.trim();

    if (textContent.length < 10 || textContent.length > 1000) return;

    try {
      const translation = await window.machineTranslation.translate(
        textContent,
        i18next.language,
        'auto'
      );

      // Add translated content
      const translatedDiv = document.createElement('div');
      translatedDiv.className = 'auto-translated';
      translatedDiv.innerHTML = `
        <div class="original-content" style="opacity: 0.7; font-size: 0.9em;">
          ${textContent}
        </div>
        <div class="translated-content" style="margin-top: 5px;">
          ${translation}
        </div>
      `;

      element.innerHTML = '';
      element.appendChild(translatedDiv);
      element.setAttribute('data-translated', 'true');

      // Add improvement button
      const improveBtn = document.createElement('button');
      improveBtn.className = 'content-improve-btn';
      improveBtn.textContent = '✏️';
      improveBtn.title = '翻訳を改善';

      improveBtn.addEventListener('click', () => {
        this.showImprovementDialog(textContent, translation);
      });

      element.appendChild(improveBtn);

    } catch (error) {
      console.error('Auto-translation failed:', error);
    }
  }

  /**
   * Show improvement dialog for translation
   */
  showImprovementDialog(originalText, currentTranslation) {
    const modal = document.createElement('div');
    modal.className = 'improvement-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>翻訳を改善する</h3>
        <div class="improvement-form">
          <div class="form-group">
            <label>原文:</label>
            <div class="text-display">${originalText}</div>
          </div>
          <div class="form-group">
            <label>現在の翻訳:</label>
            <div class="text-display">${currentTranslation}</div>
          </div>
          <div class="form-group">
            <label>改善提案:</label>
            <textarea placeholder="より良い翻訳を提案してください...">${currentTranslation}</textarea>
          </div>
          <div class="form-actions">
            <button class="submit-improvement">提案を送信</button>
            <button class="cancel-improvement">キャンセル</button>
          </div>
        </div>
      </div>
    `;

    this.addImprovementStyles();
    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.submit-improvement').addEventListener('click', async () => {
      const suggestion = modal.querySelector('textarea').value.trim();

      if (suggestion && suggestion !== currentTranslation) {
        await window.communityTranslation.submitSuggestion(
          originalText,
          currentTranslation,
          suggestion,
          'auto',
          i18next.language
        );

        this.showToast('改善提案が送信されました！');
        modal.remove();
      }
    });

    modal.querySelector('.cancel-improvement').addEventListener('click', () => {
      modal.remove();
    });
  }

  /**
   * Add context to history for better translations
   */
  addToContextHistory(original, translated) {
    this.contextHistory.push({
      original,
      translated,
      timestamp: Date.now(),
      language: i18next.language
    });

    // Keep only last 50 items
    if (this.contextHistory.length > 50) {
      this.contextHistory.shift();
    }
  }

  /**
   * Get translation context for improved accuracy
   */
  getTranslationContext() {
    const recentContext = this.contextHistory.slice(-3);

    return {
      recentTranslations: recentContext,
      currentTopic: this.detectTopic(recentContext),
      formality: this.detectFormality(recentContext),
      technicalLevel: this.detectTechnicalLevel(recentContext)
    };
  }

  /**
   * Detect topic from context
   */
  detectTopic(context) {
    // Simple topic detection based on keywords
    const allText = context.map(c => `${c.original} ${c.translated}`).join(' ');

    if (/\b(function|variable|code|program|software|api)\b/i.test(allText)) {
      return 'technical';
    }
    if (/\b(news|article|report|study|research)\b/i.test(allText)) {
      return 'academic';
    }
    if (/\b(movie|music|game|entertainment|fun)\b/i.test(allText)) {
      return 'entertainment';
    }

    return 'general';
  }

  /**
   * Detect formality level
   */
  detectFormality(context) {
    const formalWords = /\b(therefore|however|furthermore|consequently|moreover|thus|hence)\b/i;
    const informalWords = /\b(like|kinda|sorta|gonna|wanna|awesome|crazy)\b/i;

    const allText = context.map(c => c.original).join(' ');
    const formalCount = (allText.match(formalWords) || []).length;
    const informalCount = (allText.match(informalWords) || []).length;

    if (formalCount > informalCount) return 'formal';
    if (informalCount > formalCount) return 'informal';
    return 'neutral';
  }

  /**
   * Detect technical level
   */
  detectTechnicalLevel(context) {
    const allText = context.map(c => c.original).join(' ');
    const technicalTerms = /\b(algorithm|database|framework|interface|protocol|system)\b/i;

    const technicalCount = (allText.match(technicalTerms) || []).length;
    const totalWords = allText.split(/\s+/).length;

    const technicalRatio = technicalCount / totalWords;

    if (technicalRatio > 0.1) return 'high';
    if (technicalRatio > 0.05) return 'medium';
    return 'low';
  }

  /**
   * Start queue processor
   */
  startQueueProcessor() {
    setInterval(() => {
      if (this.translationQueue.length > 0 && !this.processingQueue) {
        this.processTranslationQueue();
      }
    }, 100);
  }

  /**
   * Show toast notification
   */
  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'translation-toast';
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
   * Add bubble styles
   */
  addBubbleStyles() {
    if (document.getElementById('translation-bubble-styles')) return;

    const style = document.createElement('style');
    style.id = 'translation-bubble-styles';
    style.textContent = `
      .translation-bubble {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: slideIn 0.2s ease-out;
      }

      .translation-header {
        background: #f8f9fa;
        padding: 8px 12px;
        border-bottom: 1px solid #dee2e6;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .original-text {
        font-size: 12px;
        color: #6c757d;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .close-bubble {
        background: none;
        border: none;
        font-size: 16px;
        cursor: pointer;
        color: #6c757d;
        padding: 0;
        width: 20px;
        height: 20px;
      }

      .translation-content {
        padding: 12px;
      }

      .translated-text {
        margin-bottom: 10px;
        line-height: 1.4;
      }

      .translation-actions {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }

      .translation-actions button {
        background: #007bff;
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
      }

      .translation-actions button:hover {
        background: #0056b3;
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Add improvement modal styles
   */
  addImprovementStyles() {
    if (document.getElementById('improvement-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'improvement-modal-styles';
    style.textContent = `
      .improvement-modal {
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

      .form-group {
        margin-bottom: 15px;
      }

      .form-group label {
        display: block;
        margin-bottom: 5px;
        font-weight: bold;
      }

      .text-display {
        background: #f8f9fa;
        padding: 10px;
        border-radius: 4px;
        border: 1px solid #dee2e6;
        font-family: monospace;
        white-space: pre-wrap;
      }

      .form-group textarea {
        width: 100%;
        min-height: 100px;
        padding: 8px;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        resize: vertical;
      }

      .form-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      }

      .form-actions button {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }

      .submit-improvement {
        background: #007bff;
        color: white;
      }

      .cancel-improvement {
        background: #6c757d;
        color: white;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Enable/disable real-time translation
   */
  toggleRealTimeTranslation() {
    this.isEnabled = !this.isEnabled;

    if (this.isEnabled) {
      this.showToast('リアルタイム翻訳が有効になりました');
    } else {
      this.showToast('リアルタイム翻訳が無効になりました');
    }

    return this.isEnabled;
  }

  /**
   * Get real-time translation statistics
   */
  getRealTimeStats() {
    return {
      isEnabled: this.isEnabled,
      cacheSize: this.translationCache.size,
      contextHistoryLength: this.contextHistory.length,
      queueLength: this.translationQueue.length,
      processingQueue: this.processingQueue
    };
  }
}

// Initialize real-time translation system
window.realTimeTranslation = new RealTimeTranslationSystem();

// Export for use in other modules
export { RealTimeTranslationSystem };
