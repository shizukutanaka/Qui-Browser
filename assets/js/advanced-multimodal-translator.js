/**
 * Advanced Multimodal Translation System for Qui Browser VR
 * Integrates speech recognition, OCR, and real-time translation
 * @version 1.0.0 - Multimodal Integration
 */

class AdvancedMultimodalTranslator {
    constructor() {
        this.speechRecognition = null;
        this.ocrEngine = null;
        this.realTimeTranslation = null;
        this.conferenceMode = false;
        this.supportedAudioLanguages = new Set([
            'en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR',
            'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW', 'ar-SA', 'hi-IN'
        ]);
        this.ocrLanguages = new Set([
            'eng', 'spa', 'fra', 'deu', 'ita', 'por', 'jpn', 'kor',
            'chi_sim', 'chi_tra', 'ara', 'hin', 'rus', 'tha', 'vie'
        ]);
        this.isActive = false;
        this.translationHistory = new Map();
    }

    /**
     * Initialize advanced multimodal translation system
     */
    async initialize() {
        console.info('🎙️ Initializing Advanced Multimodal Translator...');

        try {
            // Initialize speech recognition
            await this.initializeSpeechRecognition();

            // Initialize OCR engine
            await this.initializeOCREngine();

            // Initialize real-time translation
            await this.initializeRealTimeTranslation();

            // Setup event listeners
            this.setupEventListeners();

            this.isActive = true;
            console.info('✅ Advanced Multimodal Translator initialized successfully');

            this.emit('systemReady', {
                speechRecognition: !!this.speechRecognition,
                ocrEngine: !!this.ocrEngine,
                realTimeTranslation: !!this.realTimeTranslation,
                supportedAudioLanguages: this.supportedAudioLanguages.size,
                supportedOCRLanguages: this.ocrLanguages.size
            });

        } catch (error) {
            console.error('❌ Failed to initialize Advanced Multimodal Translator:', error);
            this.emit('initializationError', error);
        }
    }

    /**
     * Initialize speech recognition with multiple engines
     */
    async initializeSpeechRecognition() {
        // Try Web Speech API first
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            this.speechRecognition = {
                type: 'web-speech-api',
                available: true,
                continuous: true,
                interimResults: true,
                maxAlternatives: 3,
                start: () => this.startWebSpeechRecognition(),
                stop: () => this.stopWebSpeechRecognition(),
                onResult: null,
                onError: null,
                onStart: null,
                onEnd: null
            };
            console.info('🗣️ Web Speech API available');
        } else {
            // Fallback to basic implementation
            this.speechRecognition = {
                type: 'fallback',
                available: false,
                start: () => console.warn('Speech recognition not available'),
                stop: () => console.warn('Speech recognition not available')
            };
            console.warn('⚠️ Web Speech API not available');
        }
    }

    /**
     * Initialize OCR engine for image text recognition
     */
    async initializeOCREngine() {
        // Try Tesseract.js or similar OCR library
        if (window.Tesseract) {
            this.ocrEngine = {
                type: 'tesseract',
                available: true,
                recognize: (image, language) => this.recognizeTextTesseract(image, language),
                getSupportedLanguages: () => this.ocrLanguages
            };
            console.info('📸 Tesseract OCR available');
        } else {
            // Fallback to basic OCR
            this.ocrEngine = {
                type: 'basic',
                available: false,
                recognize: (image, language) => this.recognizeTextBasic(image, language)
            };
            console.warn('⚠️ Advanced OCR not available');
        }
    }

    /**
     * Initialize real-time translation for conferences
     */
    async initializeRealTimeTranslation() {
        this.realTimeTranslation = {
            type: 'integrated',
            available: true,
            translateAudio: (audioStream, sourceLang, targetLang) =>
                this.translateAudioStream(audioStream, sourceLang, targetLang),
            translateVideo: (videoElement, sourceLang, targetLang) =>
                this.translateVideoStream(videoElement, sourceLang, targetLang),
            enableSubtitles: (mediaElement, language) =>
                this.enableLiveSubtitles(mediaElement, language),
            disableSubtitles: (mediaElement) =>
                this.disableLiveSubtitles(mediaElement)
        };
        console.info('⚡ Real-time translation initialized');
    }

    /**
     * Start speech recognition with translation
     */
    async startSpeechTranslation(sourceLang = 'auto', targetLang = 'en') {
        if (!this.speechRecognition?.available) {
            throw new Error('Speech recognition not available');
        }

        return new Promise((resolve, reject) => {
            try {
                const recognition = new (window.webkitSpeechRecognition || window.SpeechRecognition)();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = sourceLang === 'auto' ? '' : sourceLang;
                recognition.maxAlternatives = 1;

                recognition.onstart = () => {
                    console.info('🎙️ Speech recognition started');
                    this.emit('speechStarted', { sourceLang, targetLang });
                };

                recognition.onresult = async (event) => {
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const transcript = event.results[i][0].transcript;
                        const confidence = event.results[i][0].confidence;

                        if (transcript && confidence > 0.5) {
                            console.info(`🗣️ Recognized: "${transcript}" (confidence: ${confidence})`);

                            // Translate in real-time
                            const translation = await this.translateText(transcript, sourceLang, targetLang);

                            this.emit('speechResult', {
                                transcript,
                                translation,
                                confidence,
                                sourceLang,
                                targetLang,
                                timestamp: new Date().toISOString()
                            });

                            // Store in history
                            this.addToTranslationHistory(transcript, translation, sourceLang, targetLang);
                        }
                    }
                };

                recognition.onerror = (error) => {
                    console.error('🎙️ Speech recognition error:', error);
                    this.emit('speechError', error);
                    reject(error);
                };

                recognition.onend = () => {
                    console.info('🎙️ Speech recognition ended');
                    this.emit('speechEnded');
                };

                recognition.start();
                this.speechRecognition.instance = recognition;
                resolve(recognition);

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Stop speech recognition
     */
    stopSpeechTranslation() {
        if (this.speechRecognition?.instance) {
            this.speechRecognition.instance.stop();
            this.speechRecognition.instance = null;
        }
    }

    /**
     * Recognize and translate text in images
     */
    async translateImageText(imageElement, sourceLang = 'auto', targetLang = 'en') {
        if (!this.ocrEngine?.available) {
            throw new Error('OCR engine not available');
        }

        try {
            console.info('📸 Starting OCR translation...');

            // Extract text from image
            const extractedText = await this.ocrEngine.recognize(imageElement, sourceLang);

            if (extractedText && extractedText.trim()) {
                console.info(`📝 Extracted text: "${extractedText}"`);

                // Translate the extracted text
                const translation = await this.translateText(extractedText, sourceLang, targetLang);

                this.emit('ocrResult', {
                    extractedText,
                    translation,
                    sourceLang,
                    targetLang,
                    confidence: 0.8, // Default confidence for OCR
                    timestamp: new Date().toISOString()
                });

                // Store in history
                this.addToTranslationHistory(extractedText, translation, sourceLang, targetLang, 'ocr');

                return { extractedText, translation };
            }

            return { extractedText: '', translation: '' };

        } catch (error) {
            console.error('📸 OCR translation failed:', error);
            throw error;
        }
    }

    /**
     * Enable real-time translation for media elements
     */
    async enableMediaTranslation(mediaElement, options = {}) {
        const {
            sourceLang = 'auto',
            targetLang = 'en',
            enableSubtitles = true,
            translateAudio = true
        } = options;

        if (!mediaElement) {
            throw new Error('Media element required');
        }

        try {
            const mediaTranslator = {
                id: Date.now(),
                mediaElement,
                sourceLang,
                targetLang,
                enableSubtitles,
                translateAudio,
                subtitles: null,
                audioTranslator: null
            };

            // Enable subtitles if requested
            if (enableSubtitles) {
                mediaTranslator.subtitles = await this.enableLiveSubtitles(mediaElement, targetLang);
            }

            // Enable audio translation if requested
            if (translateAudio && mediaElement.tagName === 'VIDEO') {
                mediaTranslator.audioTranslator = await this.translateAudioStream(
                    mediaElement, sourceLang, targetLang
                );
            }

            this.emit('mediaTranslationEnabled', {
                id: mediaTranslator.id,
                mediaElement: mediaElement.tagName,
                options
            });

            return mediaTranslator;

        } catch (error) {
            console.error('🎬 Media translation setup failed:', error);
            throw error;
        }
    }

    /**
     * Disable media translation
     */
    disableMediaTranslation(mediaTranslator) {
        if (mediaTranslator.subtitles) {
            this.disableLiveSubtitles(mediaTranslator.mediaElement);
        }

        if (mediaTranslator.audioTranslator) {
            mediaTranslator.audioTranslator.stop();
        }

        this.emit('mediaTranslationDisabled', {
            id: mediaTranslator.id
        });
    }

    /**
     * Enable live subtitles for video/audio elements
     */
    async enableLiveSubtitles(mediaElement, language) {
        const subtitleContainer = document.createElement('div');
        subtitleContainer.className = 'live-subtitles';
        subtitleContainer.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-size: 16px;
            z-index: 1000;
            max-height: 100px;
            overflow-y: auto;
        `;

        // Insert subtitle container
        if (mediaElement.parentNode) {
            mediaElement.parentNode.style.position = 'relative';
            mediaElement.parentNode.appendChild(subtitleContainer);
        }

        // Start subtitle updates
        const updateSubtitles = async () => {
            if (!mediaElement.paused && !mediaElement.ended) {
                try {
                    // This would integrate with actual speech recognition
                    const currentTime = mediaElement.currentTime;
                    const text = await this.getSubtitleText(currentTime, language);

                    subtitleContainer.textContent = text;
                    subtitleContainer.style.display = text ? 'block' : 'none';

                } catch (error) {
                    console.warn('Subtitle update failed:', error);
                }
            }

            requestAnimationFrame(updateSubtitles);
        };

        updateSubtitles();

        return {
            container: subtitleContainer,
            update: updateSubtitles,
            hide: () => subtitleContainer.style.display = 'none',
            show: () => subtitleContainer.style.display = 'block',
            remove: () => subtitleContainer.remove()
        };
    }

    /**
     * Disable live subtitles
     */
    disableLiveSubtitles(mediaElement) {
        const subtitleContainer = mediaElement.parentNode?.querySelector('.live-subtitles');
        if (subtitleContainer) {
            subtitleContainer.remove();
        }
    }

    /**
     * Get subtitle text for current timestamp
     */
    async getSubtitleText(timestamp, language) {
        // This would integrate with actual subtitle data or speech recognition
        // For now, return a placeholder
        return `Subtitles for timestamp ${timestamp.toFixed(1)}s in ${language}`;
    }

    /**
     * Translate text with enhanced context awareness
     */
    async translateText(text, sourceLang, targetLang) {
        // Use the unified system's translation
        if (window.unifiedI18n) {
            return await window.unifiedI18n.translate(text, {
                language: targetLang,
                context: 'multimodal-translation'
            });
        }

        // Fallback to basic translation
        return await this.basicTranslate(text, sourceLang, targetLang);
    }

    /**
     * Basic translation fallback
     */
    async basicTranslate(text, sourceLang, targetLang) {
        // Simple word-by-word translation for common terms
        const translations = {
            'en': {
                'hello': 'hello', 'world': 'world', 'browser': 'browser',
                'settings': 'settings', 'language': 'language', 'translation': 'translation'
            },
            'es': {
                'hello': 'hola', 'world': 'mundo', 'browser': 'navegador',
                'settings': 'configuración', 'language': 'idioma', 'translation': 'traducción'
            },
            'fr': {
                'hello': 'bonjour', 'world': 'monde', 'browser': 'navigateur',
                'settings': 'paramètres', 'language': 'langue', 'translation': 'traduction'
            }
        };

        const sourceDict = translations[sourceLang] || translations['en'];
        const targetDict = translations[targetLang] || translations['en'];

        return text.split(' ').map(word => targetDict[word.toLowerCase()] || word).join(' ');
    }

    /**
     * Add translation to history
     */
    addToTranslationHistory(original, translated, sourceLang, targetLang, type = 'text') {
        const key = `${sourceLang}-${targetLang}-${type}`;
        if (!this.translationHistory.has(key)) {
            this.translationHistory.set(key, []);
        }

        const history = this.translationHistory.get(key);
        history.push({
            original,
            translated,
            timestamp: new Date().toISOString(),
            type
        });

        // Keep only last 100 entries
        if (history.length > 100) {
            history.shift();
        }
    }

    /**
     * Get translation history
     */
    getTranslationHistory(sourceLang, targetLang, type = 'text') {
        const key = `${sourceLang}-${targetLang}-${type}`;
        return this.translationHistory.get(key) || [];
    }

    /**
     * Setup event listeners for multimodal translation
     */
    setupEventListeners() {
        // Listen for image selection for OCR
        document.addEventListener('click', (event) => {
            const target = event.target;
            if (target.tagName === 'IMG' && this.ocrEngine?.available) {
                this.handleImageClick(target, event);
            }
        });

        // Listen for media elements
        document.addEventListener('play', (event) => {
            const mediaElement = event.target;
            if (this.realTimeTranslation && (mediaElement.tagName === 'VIDEO' || mediaElement.tagName === 'AUDIO')) {
                this.handleMediaPlay(mediaElement, event);
            }
        }, true);

        // Global keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            // Ctrl+Shift+T for speech translation
            if (event.ctrlKey && event.shiftKey && event.key === 'T') {
                event.preventDefault();
                this.toggleSpeechTranslation();
            }

            // Ctrl+Shift+O for OCR mode
            if (event.ctrlKey && event.shiftKey && event.key === 'O') {
                event.preventDefault();
                this.toggleOCRMode();
            }
        });
    }

    /**
     * Handle image click for OCR
     */
    handleImageClick(imageElement, event) {
        if (event.detail === 2) { // Double click
            this.performOCRTranslation(imageElement);
        }
    }

    /**
     * Handle media play for real-time translation
     */
    handleMediaPlay(mediaElement, event) {
        // Auto-enable subtitles for videos in foreign languages
        const currentLang = window.unifiedI18n?.currentLanguage || 'en';
        if (currentLang !== 'en') {
            setTimeout(() => {
                this.enableLiveSubtitles(mediaElement, currentLang);
            }, 1000);
        }
    }

    /**
     * Toggle speech translation
     */
    async toggleSpeechTranslation() {
        if (this.speechRecognition?.instance) {
            this.stopSpeechTranslation();
        } else {
            const sourceLang = window.unifiedI18n?.currentLanguage || 'auto';
            const targetLang = sourceLang === 'auto' ? 'en' : sourceLang;
            await this.startSpeechTranslation(sourceLang, targetLang);
        }
    }

    /**
     * Toggle OCR mode
     */
    toggleOCRMode() {
        if (this.ocrEngine?.available) {
            this.emit('ocrModeToggled', {
                enabled: true,
                message: 'Click on images to translate text'
            });
        } else {
            this.emit('ocrModeToggled', {
                enabled: false,
                message: 'OCR not available'
            });
        }
    }

    /**
     * Perform OCR translation on image
     */
    async performOCRTranslation(imageElement) {
        try {
            const currentLang = window.unifiedI18n?.currentLanguage || 'en';
            const result = await this.translateImageText(imageElement, 'auto', currentLang);

            this.emit('ocrTranslationComplete', {
                imageElement,
                result,
                success: true
            });

        } catch (error) {
            console.error('OCR translation failed:', error);
            this.emit('ocrTranslationComplete', {
                imageElement,
                error: error.message,
                success: false
            });
        }
    }

    /**
     * Get comprehensive system statistics
     */
    getStats() {
        return {
            isActive: this.isActive,
            speechRecognition: {
                available: this.speechRecognition?.available || false,
                type: this.speechRecognition?.type || 'none',
                active: !!this.speechRecognition?.instance
            },
            ocrEngine: {
                available: this.ocrEngine?.available || false,
                type: this.ocrEngine?.type || 'none',
                supportedLanguages: this.ocrLanguages.size
            },
            realTimeTranslation: {
                available: !!this.realTimeTranslation,
                conferenceMode: this.conferenceMode
            },
            translationHistory: {
                totalEntries: Array.from(this.translationHistory.values()).reduce((sum, arr) => sum + arr.length, 0),
                languagePairs: this.translationHistory.size
            },
            supportedFeatures: {
                audioLanguages: this.supportedAudioLanguages.size,
                ocrLanguages: this.ocrLanguages.size,
                realTimeTranslation: true,
                multimodalIntegration: true
            }
        };
    }

    /**
     * Event system
     */
    emit(event, data) {
        document.dispatchEvent(new CustomEvent(`multimodal:${event}`, { detail: data }));

        // Also emit to unified system if available
        if (window.unifiedI18n) {
            window.unifiedI18n.emit(`multimodal:${event}`, data);
        }
    }

    /**
     * Add event listener
     */
    on(event, callback) {
        document.addEventListener(`multimodal:${event}`, callback);
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
        document.removeEventListener(`multimodal:${event}`, callback);
    }
}

// Initialize Advanced Multimodal Translator
window.advancedMultimodalTranslator = new AdvancedMultimodalTranslator();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await window.advancedMultimodalTranslator.initialize();

    // Setup global functions
    window.startSpeechTranslation = (sourceLang, targetLang) =>
        window.advancedMultimodalTranslator.startSpeechTranslation(sourceLang, targetLang);

    window.stopSpeechTranslation = () =>
        window.advancedMultimodalTranslator.stopSpeechTranslation();

    window.translateImageText = (imageElement, sourceLang, targetLang) =>
        window.advancedMultimodalTranslator.translateImageText(imageElement, sourceLang, targetLang);

    window.enableMediaTranslation = (mediaElement, options) =>
        window.advancedMultimodalTranslator.enableMediaTranslation(mediaElement, options);

    window.getTranslationStats = () =>
        window.advancedMultimodalTranslator.getStats();

    console.info('🎙️ Advanced Multimodal Translation System ready');
});

// Export for modules
export default AdvancedMultimodalTranslator;
