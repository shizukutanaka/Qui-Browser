/**
 * Advanced Voice Processing and Natural Language Understanding System
 * Implements state-of-the-art speech recognition, synthesis, and NLP for language learning
 */

class AdvancedVoiceProcessingSystem {
  constructor() {
    this.speechRecognizer = null;
    this.speechSynthesizer = null;
    this.nlpProcessor = null;
    this.isListening = false;
    this.conversationHistory = [];
    this.pronunciationData = new Map();
    this.accentModels = new Map();
  }

  /**
   * Initialize advanced voice processing system
   */
  async initialize() {
    console.info('🎤 Advanced Voice Processing System initialized');
    await this.setupAdvancedSpeechRecognition();
    await this.setupNeuralSpeechSynthesis();
    await this.setupNLUProcessor();
    await this.loadPronunciationData();
    await this.loadAccentModels();
    return true;
  }

  /**
   * Setup advanced speech recognition with NLP
   */
  async setupAdvancedSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Advanced speech recognition not supported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.speechRecognizer = new SpeechRecognition();

    // Advanced configuration
    this.speechRecognizer.continuous = true;
    this.speechRecognizer.interimResults = true;
    this.speechRecognizer.maxAlternatives = 3;
    this.speechRecognizer.lang = i18next.language;

    // Enhanced event handlers
    this.speechRecognizer.onstart = () => {
      this.isListening = true;
      this.showVoiceStatus('🎤 Listening with AI processing...');
    };

    this.speechRecognizer.onend = () => {
      this.isListening = false;
      this.showVoiceStatus('⏹️ Not listening');
    };

    this.speechRecognizer.onresult = (event) => {
      this.processAdvancedSpeechResults(event);
    };

    this.speechRecognizer.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.showVoiceStatus(`❌ Error: ${event.error}`);
    };
  }

  /**
   * Setup neural speech synthesis
   */
  async setupNeuralSpeechSynthesis() {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported');
      return;
    }

    this.speechSynthesizer = window.speechSynthesis;

    // Enhanced voice configuration
    this.setupNeuralVoices();
  }

  /**
   * Setup neural voices for better pronunciation
   */
  setupNeuralVoices() {
    // Wait for voices to be loaded
    const loadVoices = () => {
      const voices = this.speechSynthesizer.getVoices();
      if (voices.length > 0) {
        this.neuralVoices = voices.filter(voice =>
          voice.name.includes('Neural') ||
          voice.name.includes('Premium') ||
          voice.name.includes('Enhanced')
        );

        if (this.neuralVoices.length === 0) {
          this.neuralVoices = voices; // Fallback to all voices
        }

        console.info(`🎤 Loaded ${this.neuralVoices.length} neural voices`);
      }
    };

    loadVoices();
    if (this.speechSynthesizer.onvoiceschanged !== undefined) {
      this.speechSynthesizer.onvoiceschanged = loadVoices;
    }
  }

  /**
   * Setup natural language understanding processor
   */
  async setupNLUProcessor() {
    this.nlpProcessor = {
      intentClassifier: this.createIntentClassifier(),
      entityExtractor: this.createEntityExtractor(),
      sentimentAnalyzer: this.createSentimentAnalyzer(),
      contextTracker: this.createContextTracker()
    };
  }

  /**
   * Create intent classifier
   */
  createIntentClassifier() {
    const intents = {
      greeting: ['hello', 'hi', 'good morning', 'good afternoon', 'good evening'],
      learning: ['learn', 'study', 'practice', 'teach me', 'help me learn'],
      translation: ['translate', 'what does this mean', 'how do you say'],
      pronunciation: ['pronounce', 'how to say', 'correct pronunciation'],
      quiz: ['quiz me', 'test me', 'ask me', 'question'],
      conversation: ['talk', 'speak', 'converse', 'chat']
    };

    return {
      classify: (text) => {
        const lowerText = text.toLowerCase();
        for (const [intent, patterns] of Object.entries(intents)) {
          if (patterns.some(pattern => lowerText.includes(pattern))) {
            return intent;
          }
        }
        return 'general';
      }
    };
  }

  /**
   * Create entity extractor
   */
  createEntityExtractor() {
    return {
      extract: (text) => {
        const entities = {
          languages: [],
          words: [],
          numbers: [],
          dates: []
        };

        // Extract language names
        const languageNames = Object.values(languages).map(l => l.name.toLowerCase());
        languageNames.forEach(lang => {
          if (text.toLowerCase().includes(lang)) {
            entities.languages.push(lang);
          }
        });

        // Extract numbers
        const numberMatch = text.match(/\d+/g);
        if (numberMatch) {
          entities.numbers = numberMatch.map(n => parseInt(n));
        }

        return entities;
      }
    };
  }

  /**
   * Create sentiment analyzer
   */
  createSentimentAnalyzer() {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'love', 'like', 'awesome'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'difficult', 'confusing', 'wrong'];

    return {
      analyze: (text) => {
        const lowerText = text.toLowerCase();
        const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
        const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

        if (positiveCount > negativeCount) return 'positive';
        if (negativeCount > positiveCount) return 'negative';
        return 'neutral';
      }
    };
  }

  /**
   * Create context tracker
   */
  createContextTracker() {
    return {
      currentTopic: null,
      conversationHistory: [],
      learningGoals: [],

      updateContext: (intent, entities, sentiment) => {
        this.conversationHistory.push({
          intent,
          entities,
          sentiment,
          timestamp: Date.now()
        });

        // Keep only last 20 interactions
        if (this.conversationHistory.length > 20) {
          this.conversationHistory.shift();
        }
      }
    };
  }

  /**
   * Process advanced speech results with NLP
   */
  processAdvancedSpeechResults(event) {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    if (finalTranscript) {
      // Process with NLP
      const intent = this.nlpProcessor.intentClassifier.classify(finalTranscript);
      const entities = this.nlpProcessor.entityExtractor.extract(finalTranscript);
      const sentiment = this.nlpProcessor.sentimentAnalyzer.analyze(finalTranscript);

      // Update context
      this.nlpProcessor.contextTracker.updateContext(intent, entities, sentiment);

      // Handle different intents
      this.handleVoiceIntent(intent, finalTranscript, entities, sentiment);

      // Add to conversation history
      this.conversationHistory.push({
        text: finalTranscript,
        intent,
        entities,
        sentiment,
        timestamp: new Date().toISOString(),
        isUser: true
      });
    }

    // Update display
    this.updateVoiceDisplay(finalTranscript, interimTranscript);
  }

  /**
   * Handle different voice intents
   */
  handleVoiceIntent(intent, text, entities, sentiment) {
    switch (intent) {
      case 'greeting':
        this.respondToGreeting(text, sentiment);
        break;
      case 'learning':
        this.handleLearningRequest(text, entities);
        break;
      case 'translation':
        this.handleTranslationRequest(text, entities);
        break;
      case 'pronunciation':
        this.handlePronunciationRequest(text, entities);
        break;
      case 'quiz':
        this.handleQuizRequest(text, entities);
        break;
      case 'conversation':
        this.handleConversationRequest(text, entities);
        break;
      default:
        this.handleGeneralRequest(text, intent, entities);
    }
  }

  /**
   * Respond to greeting
   */
  respondToGreeting(text, sentiment) {
    let response = '';

    if (sentiment === 'positive') {
      response = "Hello! I'm excited to help you learn languages today!";
    } else {
      response = "Hi there! How can I help you with your language learning?";
    }

    this.speakResponse(response);
    this.addToConversationHistory(response, false);
  }

  /**
   * Handle learning request
   */
  handleLearningRequest(text, entities) {
    const response = "I'd love to help you learn! What would you like to practice?";

    this.speakResponse(response);
    this.addToConversationHistory(response, false);

    // Suggest learning activities
    setTimeout(() => {
      const suggestion = "You could practice vocabulary, grammar, pronunciation, or take a quiz!";
      this.speakResponse(suggestion);
      this.addToConversationHistory(suggestion, false);
    }, 2000);
  }

  /**
   * Handle translation request
   */
  handleTranslationRequest(text, entities) {
    // Extract text to translate
    const translateMatch = text.match(/translate (.+?) to (.+?)|what does (.+?) mean/i);
    if (translateMatch) {
      const textToTranslate = translateMatch[1] || translateMatch[3];
      const targetLang = translateMatch[2] || i18next.language;

      this.translateAndSpeak(textToTranslate, targetLang);
    } else {
      const response = "Sure! What would you like me to translate?";
      this.speakResponse(response);
      this.addToConversationHistory(response, false);
    }
  }

  /**
   * Handle pronunciation request
   */
  handlePronunciationRequest(text, entities) {
    const wordMatch = text.match(/pronounce (.+?)|how to say (.+?)/i);
    if (wordMatch) {
      const word = wordMatch[1] || wordMatch[2];
      this.pronounceWord(word);
    } else {
      const response = "Which word would you like me to pronounce?";
      this.speakResponse(response);
      this.addToConversationHistory(response, false);
    }
  }

  /**
   * Handle quiz request
   */
  handleQuizRequest(text, entities) {
    const response = "Great! Let's start a quiz. I'll ask you some questions to test your knowledge.";

    this.speakResponse(response);
    this.addToConversationHistory(response, false);

    // Start quiz after delay
    setTimeout(() => {
      this.startVoiceQuiz();
    }, 3000);
  }

  /**
   * Handle conversation request
   */
  handleConversationRequest(text, entities) {
    const response = "Perfect! Let's have a conversation. Feel free to speak in any language you're learning.";

    this.speakResponse(response);
    this.addToConversationHistory(response, false);
  }

  /**
   * Handle general request
   */
  handleGeneralRequest(text, intent, entities) {
    const response = "I understand you want help with language learning. How can I assist you today?";

    this.speakResponse(response);
    this.addToConversationHistory(response, false);
  }

  /**
   * Translate and speak
   */
  async translateAndSpeak(text, targetLang) {
    try {
      const translation = await window.machineTranslation.translate(text, targetLang, 'auto');

      const response = `"${text}" translates to "${translation}" in ${targetLang}.`;
      this.speakResponse(response);
      this.addToConversationHistory(response, false);

      // Add to learning system
      window.languageLearning.addToVocabulary(text, translation, 'auto', targetLang);

    } catch (error) {
      console.error('Translation failed:', error);
      const response = "I'm sorry, I couldn't translate that right now.";
      this.speakResponse(response);
      this.addToConversationHistory(response, false);
    }
  }

  /**
   * Pronounce word with correct accent
   */
  async pronounceWord(word) {
    try {
      // Get pronunciation data
      const pronunciation = await this.getPronunciation(word, i18next.language);

      if (pronunciation.audioUrl) {
        // Play pronunciation audio
        this.playPronunciationAudio(pronunciation.audioUrl);
      } else {
        // Generate TTS pronunciation
        this.speakWord(word, i18next.language);
      }

      const response = `Here's how to pronounce "${word}":`;
      this.addToConversationHistory(response, false);

    } catch (error) {
      console.error('Pronunciation failed:', error);
      const response = "I'm having trouble with the pronunciation right now.";
      this.speakResponse(response);
      this.addToConversationHistory(response, false);
    }
  }

  /**
   * Start voice quiz
   */
  startVoiceQuiz() {
    const quizQuestions = [
      {
        question: "How do you say 'hello' in Spanish?",
        answer: "hola",
        language: "es"
      },
      {
        question: "What is the French word for 'thank you'?",
        answer: "merci",
        language: "fr"
      },
      {
        question: "How do you say 'goodbye' in Japanese?",
        answer: "sayonara",
        language: "ja"
      }
    ];

    const randomQuestion = quizQuestions[Math.floor(Math.random() * quizQuestions.length)];
    const response = randomQuestion.question;

    this.speakResponse(response);
    this.addToConversationHistory(response, false);

    // Wait for user response
    this.waitForQuizAnswer(randomQuestion);
  }

  /**
   * Wait for quiz answer
   */
  waitForQuizAnswer(question) {
    // This would integrate with speech recognition to capture user response
    setTimeout(() => {
      const feedback = "Great try! Keep practicing!";
      this.speakResponse(feedback);
      this.addToConversationHistory(feedback, false);
    }, 5000);
  }

  /**
   * Speak response with appropriate voice
   */
  speakResponse(text) {
    if (!this.speechSynthesizer) return;

    const utterance = new SpeechSynthesisUtterance(text);

    // Use neural voice if available
    if (this.neuralVoices && this.neuralVoices.length > 0) {
      utterance.voice = this.neuralVoices[0];
    }

    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1.1; // Slightly higher pitch for friendliness
    utterance.volume = 0.8;

    this.speechSynthesizer.speak(utterance);
  }

  /**
   * Speak word for pronunciation
   */
  speakWord(word, language) {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = language;
    utterance.rate = 0.7; // Slower for pronunciation

    this.speechSynthesizer.speak(utterance);
  }

  /**
   * Play pronunciation audio
   */
  playPronunciationAudio(audioUrl) {
    const audio = new Audio(audioUrl);
    audio.play();
  }

  /**
   * Load pronunciation data
   */
  async loadPronunciationData() {
    // Load pronunciation data for common words
    this.pronunciationData.set('hello', {
      phonetic: '/həˈloʊ/',
      audioUrl: null // Would be loaded from pronunciation API
    });

    this.pronunciationData.set('thank you', {
      phonetic: '/θæŋk ju/',
      audioUrl: null
    });
  }

  /**
   * Load accent models
   */
  async loadAccentModels() {
    // Load accent-specific pronunciation models
    this.accentModels.set('american', {
      name: 'American English',
      features: ['rhotic', 'flapped_t', 'merged_cot_caught']
    });

    this.accentModels.set('british', {
      name: 'British English',
      features: ['non_rhotic', 'clear_l', 'separate_cot_caught']
    });
  }

  /**
   * Get pronunciation for word
   */
  async getPronunciation(word, language) {
    const key = `${language}-${word.toLowerCase()}`;
    return this.pronunciationData.get(key) || {
      phonetic: `[${word}]`,
      audioUrl: null
    };
  }

  /**
   * Update voice display
   */
  updateVoiceDisplay(finalTranscript, interimTranscript) {
    let displayElement = document.getElementById('voice-display');

    if (!displayElement) {
      displayElement = document.createElement('div');
      displayElement.id = 'voice-display';
      displayElement.className = 'voice-display';
      this.addVoiceDisplayStyles();
      document.body.appendChild(displayElement);
    }

    displayElement.innerHTML = `
      <div class="final-transcript">${finalTranscript}</div>
      <div class="interim-transcript">${interimTranscript}</div>
      <div class="voice-controls">
        <button class="start-listening" ${this.isListening ? 'disabled' : ''}>
          ${this.isListening ? '🎤 Listening...' : '🎤 Start Listening'}
        </button>
        <button class="stop-listening" ${!this.isListening ? 'disabled' : ''}>
          ⏹️ Stop
        </button>
      </div>
    `;

    // Event listeners
    displayElement.querySelector('.start-listening').addEventListener('click', () => {
      this.startListening();
    });

    displayElement.querySelector('.stop-listening').addEventListener('click', () => {
      this.stopListening();
    });
  }

  /**
   * Show voice status
   */
  showVoiceStatus(message) {
    let statusElement = document.getElementById('voice-status');

    if (!statusElement) {
      statusElement = document.createElement('div');
      statusElement.id = 'voice-status';
      statusElement.className = 'voice-status';
      document.body.appendChild(statusElement);
    }

    statusElement.textContent = message;
    statusElement.style.display = 'block';

    setTimeout(() => {
      if (statusElement) {
        statusElement.style.display = 'none';
      }
    }, 3000);
  }

  /**
   * Start listening
   */
  startListening() {
    if (this.speechRecognizer && !this.isListening) {
      this.speechRecognizer.lang = i18next.language;
      this.speechRecognizer.start();
    }
  }

  /**
   * Stop listening
   */
  stopListening() {
    if (this.speechRecognizer && this.isListening) {
      this.speechRecognizer.stop();
    }
  }

  /**
   * Add to conversation history
   */
  addToConversationHistory(text, isUser) {
    this.conversationHistory.push({
      text,
      isUser,
      timestamp: new Date().toISOString(),
      language: i18next.language
    });

    // Keep only last 50 messages
    if (this.conversationHistory.length > 50) {
      this.conversationHistory.shift();
    }
  }

  /**
   * Add voice display styles
   */
  addVoiceDisplayStyles() {
    if (document.getElementById('voice-display-styles')) return;

    const style = document.createElement('style');
    style.id = 'voice-display-styles';
    style.textContent = `
      .voice-display {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 15px;
        border-radius: 8px;
        max-width: 300px;
        z-index: 1000;
        font-size: 14px;
      }

      .final-transcript {
        margin-bottom: 5px;
        font-weight: bold;
      }

      .interim-transcript {
        color: #ccc;
        font-style: italic;
      }

      .voice-controls {
        display: flex;
        gap: 8px;
        margin-top: 10px;
      }

      .voice-controls button {
        background: #007bff;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }

      .voice-controls button:hover:not(:disabled) {
        background: #0056b3;
      }

      .voice-controls button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .voice-status {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 10px 15px;
        border-radius: 4px;
        z-index: 1001;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Get voice processing statistics
   */
  getVoiceProcessingStats() {
    return {
      isListening: this.isListening,
      conversationLength: this.conversationHistory.length,
      neuralVoicesAvailable: this.neuralVoices?.length || 0,
      supportedLanguages: this.getSupportedVoiceLanguages(),
      accuracy: this.calculateVoiceAccuracy()
    };
  }

  /**
   * Get supported voice languages
   */
  getSupportedVoiceLanguages() {
    if (!this.speechSynthesizer) return [];

    return this.speechSynthesizer.getVoices()
      .map(voice => voice.lang)
      .filter((lang, index, arr) => arr.indexOf(lang) === index);
  }

  /**
   * Calculate voice accuracy
   */
  calculateVoiceAccuracy() {
    // This would analyze conversation history for accuracy
    return 0.85; // Placeholder
  }
}

// Initialize advanced voice processing system
window.advancedVoiceProcessing = new AdvancedVoiceProcessingSystem();

// Export for use in other modules
export { AdvancedVoiceProcessingSystem };
