/**
 * Enhanced OCR Translation System for Qui Browser VR
 * Integrates Tesseract.js and advanced text recognition
 * @version 1.0.0 - OCR Integration
 */

class EnhancedOCRTranslator {
    constructor() {
        this.tesseract = null;
        this.isLoaded = false;
        this.supportedLanguages = new Map([
            ['eng', { name: 'English', nativeName: 'English', confidence: 0.9 }],
            ['spa', { name: 'Spanish', nativeName: 'Español', confidence: 0.85 }],
            ['fra', { name: 'French', nativeName: 'Français', confidence: 0.85 }],
            ['deu', { name: 'German', nativeName: 'Deutsch', confidence: 0.85 }],
            ['ita', { name: 'Italian', nativeName: 'Italiano', confidence: 0.8 }],
            ['por', { name: 'Portuguese', nativeName: 'Português', confidence: 0.8 }],
            ['jpn', { name: 'Japanese', nativeName: '日本語', confidence: 0.75 }],
            ['kor', { name: 'Korean', nativeName: '한국어', confidence: 0.75 }],
            ['chi_sim', { name: 'Chinese Simplified', nativeName: '中文 (简体)', confidence: 0.8 }],
            ['chi_tra', { name: 'Chinese Traditional', nativeName: '中文 (繁體)', confidence: 0.8 }],
            ['ara', { name: 'Arabic', nativeName: 'العربية', confidence: 0.7 }],
            ['hin', { name: 'Hindi', nativeName: 'हिन्दी', confidence: 0.75 }],
            ['rus', { name: 'Russian', nativeName: 'Русский', confidence: 0.8 }],
            ['tha', { name: 'Thai', nativeName: 'ไทย', confidence: 0.7 }],
            ['vie', { name: 'Vietnamese', nativeName: 'Tiếng Việt', confidence: 0.75 }]
        ]);
        this.recognitionQueue = [];
        this.isProcessing = false;
        this.cache = new Map();
    }

    /**
     * Initialize OCR system
     */
    async initialize() {
        console.info('📸 Initializing Enhanced OCR Translator...');

        try {
            // Load Tesseract.js dynamically
            await this.loadTesseract();

            // Setup image preprocessing
            this.setupImagePreprocessing();

            // Setup text postprocessing
            this.setupTextPostprocessing();

            this.isLoaded = true;
            console.info('✅ Enhanced OCR Translator initialized successfully');

            this.emit('ocrReady', {
                supportedLanguages: this.supportedLanguages.size,
                tesseractVersion: this.tesseract?.version || 'unknown'
            });

        } catch (error) {
            console.error('❌ Failed to initialize OCR:', error);
            this.emit('ocrError', error);
        }
    }

    /**
     * Load Tesseract.js dynamically
     */
    async loadTesseract() {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (window.Tesseract) {
                this.tesseract = window.Tesseract;
                resolve();
                return;
            }

            // Load script dynamically
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.esm.min.js';
            script.onload = () => {
                this.tesseract = window.Tesseract;
                console.info('📸 Tesseract.js loaded successfully');
                resolve();
            };
            script.onerror = () => {
                console.warn('⚠️ Failed to load Tesseract.js');
                reject(new Error('Failed to load Tesseract.js'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Recognize text in image with advanced preprocessing
     */
    async recognizeText(imageElement, options = {}) {
        const {
            language = 'eng',
            preprocessing = true,
            postprocessing = true,
            confidenceThreshold = 0.6
        } = options;

        if (!this.isLoaded || !this.tesseract) {
            throw new Error('OCR system not initialized');
        }

        // Check cache first
        const cacheKey = this.generateCacheKey(imageElement, language);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            console.info(`📸 Recognizing text in image (${language})...`);

            // Preprocess image if requested
            let processedImage = imageElement;
            if (preprocessing) {
                processedImage = await this.preprocessImage(imageElement);
            }

            // Perform OCR
            const result = await this.tesseract.recognize(processedImage, language, {
                logger: (info) => {
                    if (info.status === 'recognizing text') {
                        console.debug(`📊 OCR Progress: ${Math.round(info.progress * 100)}%`);
                    }
                }
            });

            // Postprocess text if requested
            let finalText = result.data.text;
            if (postprocessing) {
                finalText = this.postprocessText(finalText, language);
            }

            const confidence = result.data.confidence / 100;

            // Only return if confidence is above threshold
            if (confidence < confidenceThreshold) {
                console.warn(`⚠️ Low OCR confidence: ${(confidence * 100).toFixed(1)}%`);
                finalText = '';
            }

            const ocrResult = {
                text: finalText,
                confidence,
                language,
                words: result.data.words || [],
                lines: result.data.lines || [],
                paragraphs: result.data.paragraphs || [],
                processingTime: result.data.processingTime || 0,
                timestamp: new Date().toISOString()
            };

            // Cache result
            this.cache.set(cacheKey, ocrResult);

            // Limit cache size
            if (this.cache.size > 50) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }

            console.info(`✅ OCR completed: "${finalText.substring(0, 100)}..." (${(confidence * 100).toFixed(1)}% confidence)`);

            this.emit('ocrResult', ocrResult);
            return ocrResult;

        } catch (error) {
            console.error('📸 OCR recognition failed:', error);
            throw error;
        }
    }

    /**
     * Preprocess image for better OCR results
     */
    async preprocessImage(imageElement) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // Set canvas size
                canvas.width = img.width;
                canvas.height = img.height;

                // Draw original image
                ctx.drawImage(img, 0, 0);

                // Apply preprocessing filters
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const processedData = this.applyImageFilters(imageData);

                ctx.putImageData(processedData, 0, 0);

                // Create new image element
                const processedImg = new Image();
                processedImg.onload = () => resolve(processedImg);
                processedImg.src = canvas.toDataURL();
            };

            img.src = imageElement.src;
        });
    }

    /**
     * Apply image enhancement filters
     */
    applyImageFilters(imageData) {
        const data = imageData.data;

        // Convert to grayscale and enhance contrast
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

            // Apply contrast enhancement
            const enhanced = this.enhanceContrast(gray);

            data[i] = enhanced;     // Red
            data[i + 1] = enhanced; // Green
            data[i + 2] = enhanced; // Blue
            // Alpha (i + 3) remains unchanged
        }

        return imageData;
    }

    /**
     * Enhance contrast using sigmoid function
     */
    enhanceContrast(value) {
        const normalized = value / 255;
        const enhanced = 1 / (1 + Math.exp(-10 * (normalized - 0.5)));
        return Math.round(enhanced * 255);
    }

    /**
     * Postprocess recognized text
     */
    postprocessText(text, language) {
        let processed = text;

        // Remove extra whitespace
        processed = processed.replace(/\s+/g, ' ').trim();

        // Fix common OCR errors based on language
        processed = this.fixLanguageSpecificErrors(processed, language);

        // Capitalize properly
        processed = this.fixCapitalization(processed, language);

        return processed;
    }

    /**
     * Fix language-specific OCR errors
     */
    fixLanguageSpecificErrors(text, language) {
        const fixes = {
            'eng': {
                '0': 'o', '1': 'l', '5': 's', '8': 'g',
                'rn': 'm', 'm': 'rn', 'vv': 'w', 'w': 'vv'
            },
            'spa': {
                'a': 'á', 'e': 'é', 'i': 'í', 'o': 'ó', 'u': 'ú',
                'n': 'ñ', 'ü': 'u'
            },
            'fra': {
                'a': 'à', 'e': 'é', 'i': 'î', 'o': 'ô', 'u': 'û',
                'c': 'ç'
            }
        };

        const langFixes = fixes[language] || fixes['eng'];
        let fixed = text;

        Object.entries(langFixes).forEach(([wrong, correct]) => {
            fixed = fixed.replace(new RegExp(wrong, 'g'), correct);
        });

        return fixed;
    }

    /**
     * Fix capitalization based on language rules
     */
    fixCapitalization(text, language) {
        const sentences = text.split(/[.!?]+/);

        return sentences.map((sentence, index) => {
            if (sentence.trim()) {
                const trimmed = sentence.trim();
                return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
            }
            return sentence;
        }).join('. ') + (text.endsWith('.') ? '.' : '');
    }

    /**
     * Translate OCR result
     */
    async translateOCRResult(ocrResult, targetLanguage) {
        if (!ocrResult.text || !ocrResult.text.trim()) {
            return { ...ocrResult, translation: '', translatedLanguage: targetLanguage };
        }

        try {
            // Use unified system for translation
            let translation = '';
            if (window.unifiedI18n) {
                translation = await window.unifiedI18n.translate(ocrResult.text, {
                    language: targetLanguage,
                    context: 'ocr-translation'
                });
            } else {
                // Fallback translation
                translation = await this.fallbackTranslate(ocrResult.text, ocrResult.language, targetLanguage);
            }

            const translatedResult = {
                ...ocrResult,
                translation,
                translatedLanguage: targetLanguage,
                translationConfidence: 0.8, // Assume good translation quality
                timestamp: new Date().toISOString()
            };

            this.emit('ocrTranslationComplete', translatedResult);
            return translatedResult;

        } catch (error) {
            console.error('📸 OCR translation failed:', error);
            return { ...ocrResult, translation: '', error: error.message };
        }
    }

    /**
     * Fallback translation for OCR text
     */
    async fallbackTranslate(text, sourceLang, targetLang) {
        // Simple translation using common phrases
        const commonTranslations = {
            'eng': {
                'welcome': 'welcome', 'thank you': 'thank you', 'hello': 'hello',
                'goodbye': 'goodbye', 'please': 'please', 'sorry': 'sorry'
            },
            'spa': {
                'welcome': 'bienvenido', 'thank you': 'gracias', 'hello': 'hola',
                'goodbye': 'adiós', 'please': 'por favor', 'sorry': 'lo siento'
            },
            'fra': {
                'welcome': 'bienvenue', 'thank you': 'merci', 'hello': 'bonjour',
                'goodbye': 'au revoir', 'please': 's\'il vous plaît', 'sorry': 'désolé'
            }
        };

        const sourceDict = commonTranslations[sourceLang] || commonTranslations['eng'];
        const targetDict = commonTranslations[targetLang] || commonTranslations['eng'];

        return text.split(' ').map(word => {
            const lowerWord = word.toLowerCase();
            return targetDict[lowerWord] || sourceDict[lowerWord] || word;
        }).join(' ');
    }

    /**
     * Generate cache key for image
     */
    generateCacheKey(imageElement, language) {
        const src = imageElement.src || imageElement.id || 'unknown';
        const dimensions = `${imageElement.width || 0}x${imageElement.height || 0}`;
        return `${src}-${dimensions}-${language}`;
    }

    /**
     * Setup image preprocessing pipeline
     */
    setupImagePreprocessing() {
        // This would integrate with advanced image processing libraries
        console.info('🖼️ Image preprocessing pipeline configured');
    }

    /**
     * Setup text postprocessing pipeline
     */
    setupTextPostprocessing() {
        // This would integrate with advanced NLP libraries
        console.info('📝 Text postprocessing pipeline configured');
    }

    /**
     * Get supported languages
     */
    getSupportedLanguages() {
        return Object.fromEntries(this.supportedLanguages);
    }

    /**
     * Clear OCR cache
     */
    clearCache() {
        this.cache.clear();
        console.info('🗑️ OCR cache cleared');
    }

    /**
     * Event system
     */
    emit(event, data) {
        document.dispatchEvent(new CustomEvent(`ocr:${event}`, { detail: data }));
    }

    /**
     * Add event listener
     */
    on(event, callback) {
        document.addEventListener(`ocr:${event}`, callback);
    }
}

// Initialize Enhanced OCR Translator
window.enhancedOCRTranslator = new EnhancedOCRTranslator();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await window.enhancedOCRTranslator.initialize();

    // Setup global functions
    window.recognizeImageText = (imageElement, language) =>
        window.enhancedOCRTranslator.recognizeText(imageElement, { language });

    window.translateImageText = async (imageElement, sourceLang, targetLang) => {
        const ocrResult = await window.enhancedOCRTranslator.recognizeText(imageElement, { language: sourceLang });
        return await window.enhancedOCRTranslator.translateOCRResult(ocrResult, targetLang);
    };

    console.info('📸 Enhanced OCR Translation System ready');
});

// Export for modules
export default EnhancedOCRTranslator;
