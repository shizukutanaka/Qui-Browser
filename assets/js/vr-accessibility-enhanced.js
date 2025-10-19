/**
 * VR Accessibility Enhanced System
 * Comprehensive accessibility features for VR browser
 * @version 2.0.0
 */

class VRAccessibilityEnhanced {
    constructor() {
        // Accessibility settings
        this.settings = {
            textSize: {
                enabled: true,
                scale: 1.0, // 0.5 - 2.0
                minimum: 48 // pixels
            },
            highContrast: {
                enabled: false,
                theme: 'dark', // 'dark', 'light', 'yellow-black'
                ratio: 7.0 // WCAG AAA
            },
            colorBlindness: {
                enabled: false,
                type: 'none', // 'protanopia', 'deuteranopia', 'tritanopia', 'monochromacy'
                filter: null
            },
            reducedMotion: {
                enabled: false,
                disableAnimations: true,
                smoothTransitions: false
            },
            audioDescriptions: {
                enabled: false,
                voiceRate: 1.0,
                voicePitch: 1.0,
                volume: 0.8
            },
            captions: {
                enabled: false,
                size: 'medium', // 'small', 'medium', 'large'
                position: 'bottom', // 'top', 'bottom'
                background: true
            },
            focusIndicator: {
                enabled: true,
                size: 'large',
                color: '#00ffff',
                thickness: 4 // pixels
            },
            voiceControl: {
                enabled: false,
                language: 'ja-JP',
                commands: []
            },
            eyeTracking: {
                enabled: false,
                calibrated: false,
                dwellTime: 800 // ms
            }
        };

        // Voice synthesis
        this.speech = {
            synthesis: window.speechSynthesis,
            utterance: null,
            voices: [],
            currentVoice: null
        };

        // Voice recognition
        this.recognition = null;
        this.isListening = false;

        // Focus management
        this.focusHistory = [];
        this.currentFocus = null;
        this.focusIndicator = null;

        // Screen reader mode
        this.screenReader = {
            enabled: false,
            announcements: [],
            queue: []
        };

        // Gesture alternatives
        this.alternatives = {
            tapInsteadOfPinch: false,
            gazeInsteadOfPoint: true,
            voiceInsteadOfGesture: false
        };
    }

    /**
     * Initialize accessibility system
     */
    init() {
        this.loadSettings();
        this.setupVoiceSynthesis();
        this.setupVoiceRecognition();
        this.setupFocusIndicator();
        this.setupKeyboardNavigation();
        this.applyAccessibilitySettings();

        console.log('[VR Accessibility] Initialized');
        return this;
    }

    /**
     * Setup voice synthesis (text-to-speech)
     */
    setupVoiceSynthesis() {
        if (!this.speech.synthesis) {
            console.warn('[VR Accessibility] Speech synthesis not available');
            return;
        }

        // Load available voices
        const loadVoices = () => {
            this.speech.voices = this.speech.synthesis.getVoices();

            // Find Japanese voice
            const jaVoice = this.speech.voices.find(v =>
                v.lang.startsWith('ja') || v.lang.includes('JP')
            );

            this.speech.currentVoice = jaVoice || this.speech.voices[0];
        };

        loadVoices();
        this.speech.synthesis.addEventListener('voiceschanged', loadVoices);
    }

    /**
     * Setup voice recognition (speech-to-text)
     */
    setupVoiceRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn('[VR Accessibility] Speech recognition not available');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = this.settings.voiceControl.language;
        this.recognition.continuous = true;
        this.recognition.interimResults = false;

        this.recognition.onresult = (event) => {
            const last = event.results.length - 1;
            const command = event.results[last][0].transcript.trim().toLowerCase();

            this.handleVoiceCommand(command);
        };

        this.recognition.onerror = (event) => {
            console.error('[VR Accessibility] Speech recognition error:', event.error);
        };
    }

    /**
     * Setup focus indicator
     */
    setupFocusIndicator() {
        if (!this.settings.focusIndicator.enabled) return;

        const indicator = document.createElement('div');
        indicator.id = 'vr-focus-indicator';
        indicator.style.cssText = `
            position: fixed;
            border: ${this.settings.focusIndicator.thickness}px solid ${this.settings.focusIndicator.color};
            border-radius: 8px;
            pointer-events: none;
            z-index: 9999;
            opacity: 0;
            transition: all 0.2s ease;
            box-shadow: 0 0 10px ${this.settings.focusIndicator.color};
        `;

        document.body.appendChild(indicator);
        this.focusIndicator = indicator;

        // Listen for focus changes
        document.addEventListener('focusin', (e) => {
            this.updateFocusIndicator(e.target);
        });
    }

    /**
     * Setup keyboard navigation
     */
    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Tab navigation
            if (e.key === 'Tab') {
                this.handleTabNavigation(e);
            }

            // Arrow key navigation
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                this.handleArrowNavigation(e);
            }

            // Enter to activate
            if (e.key === 'Enter' && this.currentFocus) {
                this.activateFocused();
            }

            // Escape to cancel
            if (e.key === 'Escape') {
                this.cancelAction();
            }
        });
    }

    /**
     * Speak text using voice synthesis
     * @param {string} text - Text to speak
     * @param {Object} options - Speech options
     */
    speak(text, options = {}) {
        if (!this.settings.audioDescriptions.enabled || !this.speech.synthesis) {
            return;
        }

        // Cancel current speech
        this.speech.synthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = this.speech.currentVoice;
        utterance.rate = options.rate || this.settings.audioDescriptions.voiceRate;
        utterance.pitch = options.pitch || this.settings.audioDescriptions.voicePitch;
        utterance.volume = options.volume || this.settings.audioDescriptions.volume;

        this.speech.utterance = utterance;
        this.speech.synthesis.speak(utterance);
    }

    /**
     * Start voice control listening
     */
    startVoiceControl() {
        if (!this.recognition || this.isListening) return;

        try {
            this.recognition.start();
            this.isListening = true;
            this.speak('音声コントロールを開始しました');
            console.log('[VR Accessibility] Voice control started');
        } catch (error) {
            console.error('[VR Accessibility] Failed to start voice control:', error);
        }
    }

    /**
     * Stop voice control listening
     */
    stopVoiceControl() {
        if (!this.recognition || !this.isListening) return;

        this.recognition.stop();
        this.isListening = false;
        this.speak('音声コントロールを停止しました');
        console.log('[VR Accessibility] Voice control stopped');
    }

    /**
     * Handle voice command
     * @param {string} command - Voice command
     */
    handleVoiceCommand(command) {
        console.log('[VR Accessibility] Voice command:', command);

        const commands = {
            '戻る': () => window.browser?.goBack(),
            '進む': () => window.browser?.goForward(),
            '更新': () => window.browser?.refresh(),
            'ホーム': () => window.browser?.goHome(),
            '新しいタブ': () => window.browser?.createNewTab(),
            'タブを閉じる': () => window.browser?.closeCurrentTab(),
            'ブックマーク': () => window.browser?.bookmark(),
            '読み上げ開始': () => this.startPageReading(),
            '読み上げ停止': () => this.stopPageReading(),
            '音声停止': () => this.stopVoiceControl()
        };

        // Find matching command
        for (const [key, action] of Object.entries(commands)) {
            if (command.includes(key.toLowerCase())) {
                action();
                this.speak(key + 'を実行しました');
                return;
            }
        }

        this.speak('コマンドが認識できませんでした');
    }

    /**
     * Start reading page content
     */
    startPageReading() {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        const text = mainContent.textContent || '';
        this.speak(text, { rate: 1.0 });
    }

    /**
     * Stop reading page content
     */
    stopPageReading() {
        if (this.speech.synthesis) {
            this.speech.synthesis.cancel();
        }
    }

    /**
     * Update focus indicator position
     * @param {HTMLElement} element - Focused element
     */
    updateFocusIndicator(element) {
        if (!this.focusIndicator || !element) return;

        this.currentFocus = element;
        this.focusHistory.push(element);

        const rect = element.getBoundingClientRect();

        this.focusIndicator.style.left = `${rect.left - 4}px`;
        this.focusIndicator.style.top = `${rect.top - 4}px`;
        this.focusIndicator.style.width = `${rect.width + 8}px`;
        this.focusIndicator.style.height = `${rect.height + 8}px`;
        this.focusIndicator.style.opacity = '1';

        // Announce element
        this.announceElement(element);
    }

    /**
     * Announce element to screen reader
     * @param {HTMLElement} element - Element to announce
     */
    announceElement(element) {
        if (!this.settings.audioDescriptions.enabled) return;

        let announcement = '';

        // Get element type
        const type = element.tagName.toLowerCase();
        const role = element.getAttribute('role');

        // Get element label
        const label = element.getAttribute('aria-label') ||
                     element.getAttribute('title') ||
                     element.textContent?.slice(0, 50) ||
                     '';

        // Build announcement
        if (role) {
            announcement = `${role}: ${label}`;
        } else if (type === 'button') {
            announcement = `ボタン: ${label}`;
        } else if (type === 'input') {
            const inputType = element.type || 'text';
            announcement = `入力フィールド ${inputType}: ${label}`;
        } else if (type === 'a') {
            announcement = `リンク: ${label}`;
        } else {
            announcement = label;
        }

        this.speak(announcement);
    }

    /**
     * Handle tab navigation
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleTabNavigation(event) {
        // Let browser handle default tab navigation
        // Just track focus changes
    }

    /**
     * Handle arrow key navigation
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleArrowNavigation(event) {
        if (!this.currentFocus) return;

        event.preventDefault();

        const focusable = this.getFocusableElements();
        const currentIndex = focusable.indexOf(this.currentFocus);

        let nextIndex = currentIndex;

        switch (event.key) {
            case 'ArrowDown':
            case 'ArrowRight':
                nextIndex = (currentIndex + 1) % focusable.length;
                break;
            case 'ArrowUp':
            case 'ArrowLeft':
                nextIndex = (currentIndex - 1 + focusable.length) % focusable.length;
                break;
        }

        if (focusable[nextIndex]) {
            focusable[nextIndex].focus();
        }
    }

    /**
     * Get all focusable elements
     * @returns {Array<HTMLElement>}
     */
    getFocusableElements() {
        const selector = 'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
        return Array.from(document.querySelectorAll(selector)).filter(el => {
            return el.offsetParent !== null; // Visible elements only
        });
    }

    /**
     * Activate focused element
     */
    activateFocused() {
        if (!this.currentFocus) return;

        if (this.currentFocus.tagName === 'BUTTON' || this.currentFocus.tagName === 'A') {
            this.currentFocus.click();
        } else if (this.currentFocus.tagName === 'INPUT') {
            this.currentFocus.focus();
        }
    }

    /**
     * Cancel current action
     */
    cancelAction() {
        if (this.speech.synthesis) {
            this.speech.synthesis.cancel();
        }

        // Close modals, menus, etc.
        const openModals = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
        openModals.forEach(modal => {
            const closeButton = modal.querySelector('[aria-label*="閉じる"], .modal-close');
            if (closeButton) {
                closeButton.click();
            }
        });
    }

    /**
     * Apply text scaling
     */
    applyTextScaling() {
        const scale = this.settings.textSize.scale;

        document.documentElement.style.fontSize = `${16 * scale}px`;

        // Update CSS custom property
        document.documentElement.style.setProperty('--text-scale', scale);
    }

    /**
     * Apply high contrast theme
     */
    applyHighContrast() {
        if (!this.settings.highContrast.enabled) {
            document.body.classList.remove('high-contrast');
            return;
        }

        document.body.classList.add('high-contrast');
        document.body.setAttribute('data-contrast-theme', this.settings.highContrast.theme);
    }

    /**
     * Apply color blindness filter
     */
    applyColorBlindnessFilter() {
        if (!this.settings.colorBlindness.enabled || this.settings.colorBlindness.type === 'none') {
            document.documentElement.style.filter = '';
            return;
        }

        const filters = {
            protanopia: 'url(#protanopia-filter)',
            deuteranopia: 'url(#deuteranopia-filter)',
            tritanopia: 'url(#tritanopia-filter)',
            monochromacy: 'grayscale(100%)'
        };

        const filter = filters[this.settings.colorBlindness.type];
        if (filter) {
            document.documentElement.style.filter = filter;
        }
    }

    /**
     * Apply reduced motion settings
     */
    applyReducedMotion() {
        if (this.settings.reducedMotion.enabled) {
            document.documentElement.classList.add('reduce-motion');
        } else {
            document.documentElement.classList.remove('reduce-motion');
        }
    }

    /**
     * Apply all accessibility settings
     */
    applyAccessibilitySettings() {
        this.applyTextScaling();
        this.applyHighContrast();
        this.applyColorBlindnessFilter();
        this.applyReducedMotion();
    }

    /**
     * Update settings
     * @param {Object} newSettings - New settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.applyAccessibilitySettings();
        this.saveSettings();
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        try {
            localStorage.setItem('vr-accessibility-settings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('[VR Accessibility] Failed to save settings:', error);
        }
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('vr-accessibility-settings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.error('[VR Accessibility] Failed to load settings:', error);
        }
    }

    /**
     * Get current settings
     * @returns {Object} Current settings
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Check accessibility compliance
     * @returns {Object} Compliance report
     */
    checkCompliance() {
        const report = {
            wcagAA: true,
            wcagAAA: true,
            issues: [],
            warnings: []
        };

        // Check contrast ratios
        const elements = document.querySelectorAll('*');
        elements.forEach(el => {
            const style = window.getComputedStyle(el);
            const textColor = style.color;
            const bgColor = style.backgroundColor;

            if (textColor && bgColor) {
                const ratio = this.calculateContrastRatio(textColor, bgColor);
                if (ratio < 4.5) {
                    report.wcagAA = false;
                    report.issues.push(`Low contrast ratio (${ratio.toFixed(2)}) on element`);
                }
                if (ratio < 7.0) {
                    report.wcagAAA = false;
                }
            }
        });

        // Check for alt text on images
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            if (!img.alt) {
                report.wcagAA = false;
                report.issues.push('Image missing alt text');
            }
        });

        return report;
    }

    /**
     * Calculate contrast ratio
     * @param {string} color1 - First color
     * @param {string} color2 - Second color
     * @returns {number} Contrast ratio
     */
    calculateContrastRatio(color1, color2) {
        // Simplified calculation
        // Real implementation would parse RGB and calculate luminance
        return 7.0; // Placeholder
    }

    /**
     * Dispose and cleanup
     */
    dispose() {
        if (this.recognition) {
            this.recognition.stop();
        }

        if (this.speech.synthesis) {
            this.speech.synthesis.cancel();
        }

        if (this.focusIndicator) {
            this.focusIndicator.remove();
        }
    }
}

// Auto-initialize
let vrAccessibility = null;

document.addEventListener('DOMContentLoaded', () => {
    vrAccessibility = new VRAccessibilityEnhanced();
    vrAccessibility.init();
});

// Export for global access
if (typeof window !== 'undefined') {
    window.VRAccessibilityEnhanced = VRAccessibilityEnhanced;
    Object.defineProperty(window, 'vrAccessibility', {
        get: () => vrAccessibility
    });
}
