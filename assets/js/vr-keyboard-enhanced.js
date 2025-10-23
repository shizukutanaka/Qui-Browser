/**
 * VR Keyboard Enhanced System
 * Improved VR keyboard with predictive input and advanced features
 * @version 2.0.0
 */

class VRKeyboardEnhanced {
    constructor() {
        // Keyboard state
        this.isActive = false;
        this.inputText = '';
        this.cursorPosition = 0;
        this.predictions = [];
        this.selectedPrediction = -1;

        // Configuration
        this.maxPredictions = 5;
        this.predictionTimeout = 300; // ms
        this.autoCompleteDelay = 1000; // ms

        // Language model (simplified)
        this.wordFrequency = new Map();
        this.commonWords = [
            'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
            'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there',
            'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time',
            'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than',
            'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work',
            'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'is', 'water', 'long'
        ];

        // Japanese common words for Japanese support
        this.japaneseWords = [
            'の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し', 'れ', 'さ', 'ある', 'いる', 'こと', 'する', 'なる', 'もの', '言う',
            '人', '時', '年', '日', '見る', '行く', '思う', '来る', '出す', '分かる', '同じ', '新しい', '大きい', '小さい', '長い', '短い',
            '高い', '低い', '広い', '狭い', '深い', '浅い', '速い', '遅い', '良い', '悪い', '正しい', '間違った', '簡単な', '難しい', '面白い',
            'つまらない', '美しい', '醜い', '強い', '弱い', '明るい', '暗い', '熱い', '冷たい', '重い', '軽い', '多い', '少ない'
        ];

        // Prediction cache
        this.predictionCache = new Map();

        // Event callbacks
        this.callbacks = {};

        // Auto-complete timer
        this.autoCompleteTimer = null;

        this.loadWordFrequency();
    }

    /**
     * Activate enhanced keyboard
     * @param {HTMLElement} inputElement - Target input element
     * @param {Object} options - Keyboard options
     */
    activate(inputElement, options = {}) {
        this.inputElement = inputElement;
        this.isActive = true;
        this.inputText = inputElement.value || '';
        this.cursorPosition = this.inputText.length;

        this.options = {
            language: options.language || 'en',
            enablePredictions: options.enablePredictions !== false,
            enableAutoComplete: options.enableAutoComplete !== false,
            maxPredictions: options.maxPredictions || this.maxPredictions,
            ...options
        };

        this.setupEventListeners();
        this.generateInitialPredictions();

        this.triggerCallback('keyboardActivated', this.options);
    }

    /**
     * Deactivate enhanced keyboard
     */
    deactivate() {
        this.isActive = false;
        this.clearTimers();
        this.removeEventListeners();

        if (this.inputElement) {
            this.inputElement.value = this.inputText;
        }

        this.triggerCallback('keyboardDeactivated');
    }

    /**
     * Handle key press
     * @param {string} key - Pressed key
     */
    handleKeyPress(key) {
        if (!this.isActive) return;

        switch (key) {
            case 'Backspace':
                this.handleBackspace();
                break;
            case 'Space':
                this.handleSpace();
                break;
            case 'Enter':
                this.handleEnter();
                break;
            default:
                this.handleCharacter(key);
                break;
        }

        this.updateInput();
        this.generatePredictions();
    }

    /**
     * Handle character input
     * @param {string} char - Input character
     */
    handleCharacter(char) {
        this.inputText = this.inputText.slice(0, this.cursorPosition) + char + this.inputText.slice(this.cursorPosition);
        this.cursorPosition += char.length;

        // Update word frequency for learning
        this.updateWordFrequency(char);
    }

    /**
     * Handle backspace
     */
    handleBackspace() {
        if (this.cursorPosition > 0) {
            this.inputText = this.inputText.slice(0, this.cursorPosition - 1) + this.inputText.slice(this.cursorPosition);
            this.cursorPosition = Math.max(0, this.cursorPosition - 1);
        }
    }

    /**
     * Handle space key
     */
    handleSpace() {
        this.inputText += ' ';
        this.cursorPosition++;

        // Auto-complete after space if enabled
        if (this.options.enableAutoComplete) {
            this.scheduleAutoComplete();
        }
    }

    /**
     * Handle enter key
     */
    handleEnter() {
        this.commitInput();
        this.deactivate();
    }

    /**
     * Update input element
     */
    updateInput() {
        if (this.inputElement) {
            this.inputElement.value = this.inputText;
            this.inputElement.setSelectionRange(this.cursorPosition, this.cursorPosition);
        }
    }

    /**
     * Generate predictions based on current input
     */
    generatePredictions() {
        if (!this.options.enablePredictions) return;

        const currentWord = this.getCurrentWord();
        if (currentWord.length < 2) {
            this.predictions = [];
            this.selectedPrediction = -1;
            this.triggerCallback('predictionsUpdated', this.predictions);
            return;
        }

        const cacheKey = `${this.options.language}_${currentWord}`;
        if (this.predictionCache.has(cacheKey)) {
            this.predictions = this.predictionCache.get(cacheKey);
        } else {
            this.predictions = this.generatePredictionsForWord(currentWord);
            this.predictionCache.set(cacheKey, this.predictions);
        }

        this.selectedPrediction = -1;
        this.triggerCallback('predictionsUpdated', this.predictions);
    }

    /**
     * Generate initial predictions
     */
    generateInitialPredictions() {
        if (!this.options.enablePredictions) return;

        const commonWords = this.options.language === 'ja' ? this.japaneseWords : this.commonWords.slice(0, this.maxPredictions);
        this.predictions = commonWords.map(word => ({ text: word, score: 0.5 }));
        this.selectedPrediction = -1;

        this.triggerCallback('predictionsUpdated', this.predictions);
    }

    /**
     * Generate predictions for a word
     * @param {string} word - Partial word
     * @returns {Array} Prediction list
     */
    generatePredictionsForWord(word) {
        const predictions = [];
        const wordList = this.options.language === 'ja' ? this.japaneseWords : this.commonWords;

        for (const candidate of wordList) {
            const similarity = this.calculateSimilarity(word, candidate);
            if (similarity > 0.3) {
                predictions.push({
                    text: candidate,
                    score: similarity + (this.wordFrequency.get(candidate) || 0) * 0.1
                });
            }
        }

        return predictions
            .sort((a, b) => b.score - a.score)
            .slice(0, this.maxPredictions);
    }

    /**
     * Calculate similarity between two words
     * @param {string} word1 - First word
     * @param {string} word2 - Second word
     * @returns {number} Similarity score 0-1
     */
    calculateSimilarity(word1, word2) {
        if (word1 === word2) return 1;

        const len1 = word1.length;
        const len2 = word2.length;
        const maxLen = Math.max(len1, len2);

        if (maxLen === 0) return 0;

        // Simple Levenshtein distance approximation
        let distance = 0;
        for (let i = 0; i < Math.min(len1, len2); i++) {
            if (word1[i] !== word2[i]) distance++;
        }
        distance += Math.abs(len1 - len2);

        return 1 - (distance / maxLen);
    }

    /**
     * Get current word being typed
     * @returns {string} Current word
     */
    getCurrentWord() {
        const words = this.inputText.split(/[\s\n]/);
        const currentWordIndex = words.length - 1;
        return words[currentWordIndex] || '';
    }

    /**
     * Select prediction
     * @param {number} index - Prediction index
     */
    selectPrediction(index) {
        if (index >= 0 && index < this.predictions.length) {
            const prediction = this.predictions[index];
            const currentWord = this.getCurrentWord();

            // Replace current word with prediction
            const beforeWord = this.inputText.slice(0, this.inputText.lastIndexOf(currentWord));
            this.inputText = beforeWord + prediction.text + ' ';
            this.cursorPosition = this.inputText.length;

            this.updateInput();
            this.generatePredictions();

            this.triggerCallback('predictionSelected', prediction);
        }
    }

    /**
     * Schedule auto-complete
     */
    scheduleAutoComplete() {
        this.clearTimers();

        this.autoCompleteTimer = setTimeout(() => {
            if (this.predictions.length > 0 && this.selectedPrediction === -1) {
                this.selectPrediction(0);
            }
        }, this.autoCompleteDelay);
    }

    /**
     * Commit input to target element
     */
    commitInput() {
        if (this.inputElement) {
            this.inputElement.value = this.inputText;
            this.inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            this.inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    /**
     * Update word frequency for learning
     * @param {string} word - Input word
     */
    updateWordFrequency(word) {
        const current = this.wordFrequency.get(word) || 0;
        this.wordFrequency.set(word, current + 1);
        this.saveWordFrequency();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (this.inputElement) {
            this.inputElement.addEventListener('focus', this.handleFocus.bind(this));
            this.inputElement.addEventListener('blur', this.handleBlur.bind(this));
        }
    }

    /**
     * Remove event listeners
     */
    removeEventListeners() {
        if (this.inputElement) {
            this.inputElement.removeEventListener('focus', this.handleFocus.bind(this));
            this.inputElement.removeEventListener('blur', this.handleBlur.bind(this));
        }
    }

    /**
     * Handle input focus
     */
    handleFocus() {
        if (!this.isActive) {
            this.activate(this.inputElement);
        }
    }

    /**
     * Handle input blur
     */
    handleBlur() {
        // Delay deactivation to allow for prediction selection
        setTimeout(() => {
            if (this.isActive && document.activeElement !== this.inputElement) {
                this.deactivate();
            }
        }, 100);
    }

    /**
     * Clear timers
     */
    clearTimers() {
        if (this.autoCompleteTimer) {
            clearTimeout(this.autoCompleteTimer);
            this.autoCompleteTimer = null;
        }
    }

    /**
     * Save word frequency to localStorage
     */
    saveWordFrequency() {
        try {
            const data = Array.from(this.wordFrequency.entries());
            localStorage.setItem('vr-word-frequency', JSON.stringify(data));
        } catch (error) {
            console.error('[VR Keyboard Enhanced] Failed to save word frequency:', error);
        }
    }

    /**
     * Load word frequency from localStorage
     */
    loadWordFrequency() {
        try {
            const saved = localStorage.getItem('vr-word-frequency');
            if (saved) {
                this.wordFrequency = new Map(JSON.parse(saved));
            }
        } catch (error) {
            console.error('[VR Keyboard Enhanced] Failed to load word frequency:', error);
        }
    }

    /**
     * Get keyboard statistics
     * @returns {Object} Usage statistics
     */
    getStats() {
        return {
            inputLength: this.inputText.length,
            predictionCount: this.predictions.length,
            wordFrequencySize: this.wordFrequency.size,
            commonWordsCount: this.options.language === 'ja' ? this.japaneseWords.length : this.commonWords.length,
            isActive: this.isActive
        };
    }

    /**
     * Add event callback
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
    }

    /**
     * Trigger callback
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    triggerCallback(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => callback(data));
        }
    }

    /**
     * Dispose and cleanup
     */
    dispose() {
        this.deactivate();
        this.predictionCache.clear();
    }
}

// Export for global access
if (typeof window !== 'undefined') {
    window.VRKeyboardEnhanced = VRKeyboardEnhanced;
}
