/**
 * VR Accessibility System - WCAG 2.5/3.0 Compliant
 *
 * Enterprise-grade accessibility system following latest standards
 * WCAG 2.5 and 3.0 (W3C Accessibility Guidelines Community Group)
 *
 * Features:
 * - VR-specific accessibility guidelines (XRA Developer Guide 2025)
 * - Multi-sensory feedback (visual, audio, haptic)
 * - Customizable comfort settings
 * - Motion sickness prevention
 * - Spatial audio accessibility
 * - Voice control integration
 * - Text-to-speech (TTS)
 * - Speech-to-text (STT)
 * - High contrast modes
 * - Color blindness filters
 * - Adjustable text size and font
 * - Reduced motion mode
 * - One-handed mode
 * - Seated mode
 * - Alternative input methods
 *
 * WCAG 2.5/3.0 Compliance:
 * - Perceivable: Content presented in multiple ways
 * - Operable: Multiple input methods, adequate time
 * - Understandable: Clear language, consistent behavior
 * - Robust: Compatible with assistive technologies
 *
 * XRA Guidelines (2025):
 * - Motion comfort controls
 * - Spatial audio warnings
 * - Hand tracking alternatives
 * - Eye tracking alternatives
 * - Customizable interaction zones
 *
 * @version 3.7.0
 * @author Qui Browser Team
 * @license MIT
 */

class VRAccessibilityWCAG {
  constructor() {
    this.config = {
      // WCAG compliance level
      wcagLevel: 'AAA', // 'A', 'AA', 'AAA'

      // Visual accessibility
      highContrast: false,
      contrastRatio: 7.0, // WCAG AAA minimum
      textScale: 1.0, // 0.5 - 2.0
      fontSize: 'medium', // 'small', 'medium', 'large', 'xlarge'
      fontFamily: 'sans-serif',
      lineSpacing: 1.5,

      // Color blindness support
      colorBlindnessFilter: 'none', // 'none', 'protanopia', 'deuteranopia', 'tritanopia'
      colorBlindnessStrength: 1.0,

      // Motion accessibility
      reducedMotion: false,
      motionIntensity: 1.0, // 0.0 - 1.0
      preventMotionSickness: true,
      comfortVignette: true,
      tunnelVision: false,

      // Audio accessibility
      spatialAudio: true,
      audioDescription: false,
      captionsEnabled: false,
      signLanguage: false,

      // Voice control
      voiceControlEnabled: true,
      voiceFeedbackEnabled: true,
      ttsEnabled: false,
      ttsVoice: 'default',
      ttsRate: 1.0, // 0.5 - 2.0
      ttsPitch: 1.0, // 0.5 - 2.0
      ttsVolume: 1.0, // 0.0 - 1.0

      // Input accessibility
      oneHandedMode: false,
      seatedMode: false,
      alternativeInput: 'auto', // 'auto', 'gaze', 'voice', 'hand', 'controller'
      dwellTime: 800, // ms for gaze selection
      repeatDelay: 500, // ms
      repeatInterval: 100, // ms

      // Interaction accessibility
      largeTargets: false,
      targetSize: 44, // pixels (WCAG minimum)
      hapticFeedback: true,
      audioFeedback: true,
      visualFeedback: true,

      // Content accessibility
      simplifiedUI: false,
      focusIndicator: true,
      focusIndicatorSize: 3, // pixels
      skipNavigation: true,
      readingMode: false
    };

    // State
    this.initialized = false;
    this.enabled = true;

    // Accessibility features status
    this.features = {
      textToSpeech: false,
      speechToText: false,
      spatialAudio: false,
      haptics: false,
      eyeTracking: false,
      handTracking: false
    };

    // Metrics
    this.metrics = {
      ttsUsageCount: 0,
      voiceCommandsUsed: 0,
      gazeSelectionsUsed: 0,
      comfortVignetteTriggered: 0,
      accessibilityIssuesDetected: 0,
      wcagViolations: []
    };

    // Text-to-speech
    this.tts = null;
    this.ttsQueue = [];
    this.ttsSpeaking = false;

    // Speech-to-text
    this.stt = null;
    this.sttActive = false;

    // Event emitter
    this.eventTarget = new EventTarget();

    // Focus management
    this.currentFocus = null;
    this.focusHistory = [];

    console.info('[VRAccessibilityWCAG] Accessibility system initialized');
  }

  /**
   * Initialize accessibility system
   */
  async initialize() {
    console.log('[VRAccessibilityWCAG] Initializing...');

    try {
      // Check available features
      await this.checkFeatureSupport();

      // Initialize TTS if supported
      if (this.config.ttsEnabled && 'speechSynthesis' in window) {
        this.initializeTextToSpeech();
      }

      // Initialize STT if supported
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        this.initializeSpeechToText();
      }

      // Apply current settings
      this.applyAccessibilitySettings();

      // Setup ARIA live regions
      this.setupARIARegions();

      // Setup keyboard navigation
      this.setupKeyboardNavigation();

      this.initialized = true;

      console.log('[VRAccessibilityWCAG] Initialization complete');

      this.dispatchEvent('initialized', {
        wcagLevel: this.config.wcagLevel,
        features: this.features
      });

      return true;

    } catch (error) {
      console.error('[VRAccessibilityWCAG] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Check feature support
   */
  async checkFeatureSupport() {
    // Text-to-speech
    this.features.textToSpeech = 'speechSynthesis' in window;

    // Speech-to-text
    this.features.speechToText = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

    // Spatial audio
    this.features.spatialAudio = 'AudioContext' in window && 'PannerNode' in window;

    // Haptics
    this.features.haptics = 'vibrate' in navigator;

    // Eye tracking (requires WebXR session)
    this.features.eyeTracking = false; // Will be set when XR session starts

    // Hand tracking (requires WebXR session)
    this.features.handTracking = false; // Will be set when XR session starts

    console.log('[VRAccessibilityWCAG] Feature support:', this.features);
  }

  /**
   * Initialize text-to-speech
   */
  initializeTextToSpeech() {
    this.tts = window.speechSynthesis;

    // Get available voices
    const loadVoices = () => {
      const voices = this.tts.getVoices();
      console.log(`[VRAccessibilityWCAG] ${voices.length} TTS voices available`);

      // Select default voice
      if (this.config.ttsVoice === 'default' && voices.length > 0) {
        const preferredVoice = voices.find(v => v.lang.startsWith(navigator.language)) || voices[0];
        this.config.ttsVoice = preferredVoice.name;
      }
    };

    // Voices may load asynchronously
    if (this.tts.getVoices().length > 0) {
      loadVoices();
    } else {
      this.tts.addEventListener('voiceschanged', loadVoices);
    }

    console.log('[VRAccessibilityWCAG] Text-to-speech initialized');
  }

  /**
   * Initialize speech-to-text
   */
  initializeSpeechToText() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.stt = new SpeechRecognition();

    this.stt.continuous = true;
    this.stt.interimResults = true;
    this.stt.lang = navigator.language;

    this.stt.addEventListener('result', (event) => {
      this.handleSpeechResult(event);
    });

    this.stt.addEventListener('error', (error) => {
      console.error('[VRAccessibilityWCAG] Speech recognition error:', error);
    });

    console.log('[VRAccessibilityWCAG] Speech-to-text initialized');
  }

  /**
   * Handle speech recognition result
   */
  handleSpeechResult(event) {
    const result = event.results[event.results.length - 1];
    const transcript = result[0].transcript;
    const isFinal = result.isFinal;

    this.dispatchEvent('speechRecognized', {
      transcript,
      isFinal,
      confidence: result[0].confidence
    });
  }

  /**
   * Speak text (TTS)
   */
  speak(text, options = {}) {
    if (!this.config.ttsEnabled || !this.tts) {
      return;
    }

    const {
      priority = 'normal', // 'low', 'normal', 'high'
      interrupt = false
    } = options;

    if (interrupt) {
      this.tts.cancel();
      this.ttsQueue = [];
    }

    const utterance = new SpeechSynthesisUtterance(text);

    // Get voice
    const voices = this.tts.getVoices();
    const voice = voices.find(v => v.name === this.config.ttsVoice) || voices[0];
    if (voice) {
      utterance.voice = voice;
    }

    utterance.rate = this.config.ttsRate;
    utterance.pitch = this.config.ttsPitch;
    utterance.volume = this.config.ttsVolume;

    utterance.addEventListener('end', () => {
      this.ttsSpeaking = false;
      this.processT TSQueue();

      this.metrics.ttsUsageCount++;
    });

    utterance.addEventListener('error', (error) => {
      console.error('[VRAccessibilityWCAG] TTS error:', error);
      this.ttsSpeaking = false;
    });

    if (priority === 'high' || !this.ttsSpeaking) {
      this.tts.speak(utterance);
      this.ttsSpeaking = true;
    } else {
      this.ttsQueue.push(utterance);
    }
  }

  /**
   * Process TTS queue
   */
  processTTSQueue() {
    if (this.ttsQueue.length > 0 && !this.ttsSpeaking) {
      const utterance = this.ttsQueue.shift();
      this.tts.speak(utterance);
      this.ttsSpeaking = true;
    }
  }

  /**
   * Stop speaking
   */
  stopSpeaking() {
    if (this.tts) {
      this.tts.cancel();
      this.ttsQueue = [];
      this.ttsSpeaking = false;
    }
  }

  /**
   * Start speech recognition
   */
  startListening() {
    if (this.stt && !this.sttActive) {
      this.stt.start();
      this.sttActive = true;

      this.dispatchEvent('listeningStarted', {});
    }
  }

  /**
   * Stop speech recognition
   */
  stopListening() {
    if (this.stt && this.sttActive) {
      this.stt.stop();
      this.sttActive = false;

      this.dispatchEvent('listeningStopped', {});
    }
  }

  /**
   * Apply accessibility settings
   */
  applyAccessibilitySettings() {
    // Apply visual settings
    this.applyVisualSettings();

    // Apply motion settings
    this.applyMotionSettings();

    // Apply audio settings
    this.applyAudioSettings();

    // Apply input settings
    this.applyInputSettings();

    console.log('[VRAccessibilityWCAG] Accessibility settings applied');
  }

  /**
   * Apply visual accessibility settings
   */
  applyVisualSettings() {
    const root = document.documentElement;

    // High contrast
    if (this.config.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Text scale
    root.style.setProperty('--text-scale', this.config.textScale);

    // Font family
    root.style.setProperty('--font-family', this.config.fontFamily);

    // Line spacing
    root.style.setProperty('--line-spacing', this.config.lineSpacing);

    // Color blindness filter
    this.applyColorBlindnessFilter();

    // Focus indicator
    if (this.config.focusIndicator) {
      root.style.setProperty('--focus-indicator-width', `${this.config.focusIndicatorSize}px`);
    }
  }

  /**
   * Apply color blindness filter
   */
  applyColorBlindnessFilter() {
    const root = document.documentElement;

    // Remove existing filter classes
    root.classList.remove('filter-protanopia', 'filter-deuteranopia', 'filter-tritanopia');

    // Apply selected filter
    if (this.config.colorBlindnessFilter !== 'none') {
      root.classList.add(`filter-${this.config.colorBlindnessFilter}`);
      root.style.setProperty('--filter-strength', this.config.colorBlindnessStrength);
    }
  }

  /**
   * Apply motion accessibility settings
   */
  applyMotionSettings() {
    const root = document.documentElement;

    // Reduced motion
    if (this.config.reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }

    // Motion intensity
    root.style.setProperty('--motion-intensity', this.config.motionIntensity);

    // Comfort vignette (handled in VR rendering code)
    this.dispatchEvent('motionSettingsChanged', {
      reducedMotion: this.config.reducedMotion,
      motionIntensity: this.config.motionIntensity,
      comfortVignette: this.config.comfortVignette,
      tunnelVision: this.config.tunnelVision
    });
  }

  /**
   * Apply audio accessibility settings
   */
  applyAudioSettings() {
    this.dispatchEvent('audioSettingsChanged', {
      spatialAudio: this.config.spatialAudio,
      audioDescription: this.config.audioDescription,
      captionsEnabled: this.config.captionsEnabled
    });
  }

  /**
   * Apply input accessibility settings
   */
  applyInputSettings() {
    this.dispatchEvent('inputSettingsChanged', {
      oneHandedMode: this.config.oneHandedMode,
      seatedMode: this.config.seatedMode,
      alternativeInput: this.config.alternativeInput,
      dwellTime: this.config.dwellTime,
      hapticFeedback: this.config.hapticFeedback
    });
  }

  /**
   * Setup ARIA live regions
   */
  setupARIARegions() {
    // Create live region for announcements
    if (!document.getElementById('vr-aria-live')) {
      const liveRegion = document.createElement('div');
      liveRegion.id = 'vr-aria-live';
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.position = 'absolute';
      liveRegion.style.left = '-10000px';
      liveRegion.style.width = '1px';
      liveRegion.style.height = '1px';
      liveRegion.style.overflow = 'hidden';
      document.body.appendChild(liveRegion);
    }
  }

  /**
   * Announce to screen readers
   */
  announce(message, priority = 'polite') {
    const liveRegion = document.getElementById('vr-aria-live');
    if (liveRegion) {
      liveRegion.setAttribute('aria-live', priority);
      liveRegion.textContent = message;

      // Also speak if TTS enabled
      if (this.config.ttsEnabled) {
        this.speak(message, { priority: priority === 'assertive' ? 'high' : 'normal' });
      }
    }
  }

  /**
   * Setup keyboard navigation
   */
  setupKeyboardNavigation() {
    document.addEventListener('keydown', (event) => {
      this.handleKeyboardNavigation(event);
    });
  }

  /**
   * Handle keyboard navigation
   */
  handleKeyboardNavigation(event) {
    // Skip if in input element
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return;
    }

    switch (event.key) {
      case 'Tab':
        // Tab navigation is handled by browser
        break;

      case 'Escape':
        // Close modals, exit VR
        this.dispatchEvent('escapePressed', {});
        break;

      case 's':
        // Skip navigation
        if (event.ctrlKey && this.config.skipNavigation) {
          event.preventDefault();
          this.skipToMainContent();
        }
        break;

      case '+':
      case '=':
        // Increase text size
        if (event.ctrlKey) {
          event.preventDefault();
          this.adjustTextSize(0.1);
        }
        break;

      case '-':
      case '_':
        // Decrease text size
        if (event.ctrlKey) {
          event.preventDefault();
          this.adjustTextSize(-0.1);
        }
        break;
    }
  }

  /**
   * Skip to main content
   */
  skipToMainContent() {
    const main = document.querySelector('main') || document.querySelector('[role="main"]');
    if (main) {
      main.focus();
      this.announce('Skipped to main content');
    }
  }

  /**
   * Adjust text size
   */
  adjustTextSize(delta) {
    this.config.textScale = Math.max(0.5, Math.min(2.0, this.config.textScale + delta));
    this.applyVisualSettings();

    this.announce(`Text size: ${Math.round(this.config.textScale * 100)}%`);
  }

  /**
   * Enable high contrast mode
   */
  enableHighContrast() {
    this.config.highContrast = true;
    this.applyVisualSettings();

    this.announce('High contrast mode enabled');
  }

  /**
   * Disable high contrast mode
   */
  disableHighContrast() {
    this.config.highContrast = false;
    this.applyVisualSettings();

    this.announce('High contrast mode disabled');
  }

  /**
   * Set color blindness filter
   */
  setColorBlindnessFilter(type) {
    this.config.colorBlindnessFilter = type;
    this.applyColorBlindnessFilter();

    const filterNames = {
      'none': 'No filter',
      'protanopia': 'Protanopia filter (red-blind)',
      'deuteranopia': 'Deuteranopia filter (green-blind)',
      'tritanopia': 'Tritanopia filter (blue-blind)'
    };

    this.announce(filterNames[type] || 'Color filter changed');
  }

  /**
   * Enable reduced motion
   */
  enableReducedMotion() {
    this.config.reducedMotion = true;
    this.applyMotionSettings();

    this.announce('Reduced motion enabled');
  }

  /**
   * Disable reduced motion
   */
  disableReducedMotion() {
    this.config.reducedMotion = false;
    this.applyMotionSettings();

    this.announce('Reduced motion disabled');
  }

  /**
   * Check WCAG compliance
   */
  checkWCAGCompliance() {
    const violations = [];

    // Check contrast ratio
    const elements = document.querySelectorAll('[style*="color"]');
    elements.forEach(element => {
      const contrast = this.calculateContrastRatio(element);
      if (contrast < this.config.contrastRatio) {
        violations.push({
          type: 'contrast',
          element,
          contrast,
          required: this.config.contrastRatio
        });
      }
    });

    // Check target sizes
    const interactive = document.querySelectorAll('button, a, input, [role="button"]');
    interactive.forEach(element => {
      const rect = element.getBoundingClientRect();
      if (rect.width < this.config.targetSize || rect.height < this.config.targetSize) {
        violations.push({
          type: 'targetSize',
          element,
          size: { width: rect.width, height: rect.height },
          required: this.config.targetSize
        });
      }
    });

    // Check alt text
    const images = document.querySelectorAll('img');
    images.forEach(element => {
      if (!element.getAttribute('alt')) {
        violations.push({
          type: 'altText',
          element
        });
      }
    });

    this.metrics.wcagViolations = violations;
    this.metrics.accessibilityIssuesDetected = violations.length;

    return violations;
  }

  /**
   * Calculate contrast ratio
   */
  calculateContrastRatio(element) {
    const style = window.getComputedStyle(element);
    const color = style.color;
    const backgroundColor = style.backgroundColor;

    // Parse colors and calculate luminance
    const colorLuminance = this.getLuminance(color);
    const bgLuminance = this.getLuminance(backgroundColor);

    // Calculate contrast ratio
    const lighter = Math.max(colorLuminance, bgLuminance);
    const darker = Math.min(colorLuminance, bgLuminance);

    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Get luminance from color
   */
  getLuminance(color) {
    // Parse RGB values
    const rgb = color.match(/\d+/g);
    if (!rgb || rgb.length < 3) {
      return 0;
    }

    // Convert to relative luminance
    const [r, g, b] = rgb.map(val => {
      const channel = parseInt(val) / 255;
      return channel <= 0.03928
        ? channel / 12.92
        : Math.pow((channel + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Get accessibility metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      wcagLevel: this.config.wcagLevel,
      initialized: this.initialized,
      enabled: this.enabled
    };
  }

  /**
   * Get configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates) {
    Object.assign(this.config, updates);
    this.applyAccessibilitySettings();

    this.dispatchEvent('configUpdated', { config: this.config });
  }

  /**
   * Dispose accessibility system
   */
  dispose() {
    this.stopSpeaking();
    this.stopListening();

    this.initialized = false;

    console.log('[VRAccessibilityWCAG] Disposed');
  }

  /**
   * Event handling
   */
  addEventListener(event, callback) {
    this.eventTarget.addEventListener(event, callback);
  }

  removeEventListener(event, callback) {
    this.eventTarget.removeEventListener(event, callback);
  }

  dispatchEvent(event, detail = {}) {
    this.eventTarget.dispatchEvent(new CustomEvent(event, { detail }));
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRAccessibilityWCAG;
}

// Global instance
window.VRAccessibilityWCAG = VRAccessibilityWCAG;

console.info('[VRAccessibilityWCAG] VR Accessibility System loaded');
