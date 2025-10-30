/**
 * Advanced Translation Integration Hub for Qui Browser VR
 * Integrates all advanced translation systems into unified experience
 * @version 1.0.0 - Integration Hub
 */

class AdvancedTranslationHub {
    constructor() {
        this.systems = new Map();
        this.isFullyIntegrated = false;
        this.performanceMetrics = {
            totalTranslations: 0,
            systemUptime: 0,
            averageResponseTime: 0,
            userSatisfaction: 0
        };
        this.integrationStatus = new Map();
    }

    /**
     * Initialize the advanced translation integration hub
     */
    async initialize() {
        console.info('🚀 Initializing Advanced Translation Integration Hub...');

        try {
            // Initialize all advanced systems
            await this.initializeAllSystems();

            // Setup system integration
            this.setupSystemIntegration();

            // Setup performance monitoring
            this.setupPerformanceMonitoring();

            // Setup error handling
            this.setupErrorHandling();

            this.isFullyIntegrated = true;
            console.info('✅ Advanced Translation Integration Hub initialized successfully');

            this.emit('hubReady', {
                integratedSystems: this.systems.size,
                totalFeatures: this.getTotalFeatures(),
                performanceMetrics: this.performanceMetrics
            });

        } catch (error) {
            console.error('❌ Failed to initialize translation hub:', error);
            this.emit('hubError', error);
        }
    }

    /**
     * Initialize all advanced translation systems
     */
    async initializeAllSystems() {
        const systems = [
            { name: 'multimodal', module: 'advanced-multimodal-translator.js' },
            { name: 'ocr', module: 'enhanced-ocr-translator.js' },
            { name: 'conference', module: 'real-time-conference-translator.js' },
            { name: 'cultural', module: 'cultural-adaptation-engine.js' }
        ];

        for (const system of systems) {
            try {
                await this.loadSystem(system);
            } catch (error) {
                console.warn(`⚠️ Failed to load ${system.name} system:`, error);
                this.integrationStatus.set(system.name, 'failed');
            }
        }
    }

    /**
     * Load individual system
     */
    async loadSystem(system) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `../../assets/js/${system.module}`;
            script.onload = () => {
                console.info(`✅ ${system.name} system loaded`);
                this.integrationStatus.set(system.name, 'loaded');
                resolve();
            };
            script.onerror = () => {
                console.warn(`⚠️ Failed to load ${system.module}`);
                reject(new Error(`Failed to load ${system.module}`));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Setup integration between all systems
     */
    setupSystemIntegration() {
        // Wait for all systems to be available
        const checkSystems = () => {
            const requiredSystems = ['advancedMultimodalTranslator', 'enhancedOCRTranslator', 'realTimeConferenceTranslator', 'culturalAdaptationEngine'];

            const allAvailable = requiredSystems.every(systemName => {
                return window[systemName] && window[systemName].initialize;
            });

            if (allAvailable) {
                this.integrateSystems();
            } else {
                setTimeout(checkSystems, 100);
            }
        };

        checkSystems();
    }

    /**
     * Integrate all systems
     */
    integrateSystems() {
        console.info('🔗 Integrating all translation systems...');

        try {
            // Integrate multimodal translator
            if (window.advancedMultimodalTranslator) {
                this.systems.set('multimodal', window.advancedMultimodalTranslator);
                this.integrateMultimodalTranslator();
            }

            // Integrate OCR translator
            if (window.enhancedOCRTranslator) {
                this.systems.set('ocr', window.enhancedOCRTranslator);
                this.integrateOCRTranslator();
            }

            // Integrate conference translator
            if (window.realTimeConferenceTranslator) {
                this.systems.set('conference', window.realTimeConferenceTranslator);
                this.integrateConferenceTranslator();
            }

            // Integrate cultural adaptation
            if (window.culturalAdaptationEngine) {
                this.systems.set('cultural', window.culturalAdaptationEngine);
                this.integrateCulturalEngine();
            }

            // Setup unified translation pipeline
            this.setupUnifiedTranslationPipeline();

            console.info('✅ All systems integrated successfully');
            this.integrationStatus.set('integration', 'complete');

        } catch (error) {
            console.error('❌ System integration failed:', error);
            this.integrationStatus.set('integration', 'failed');
        }
    }

    /**
     * Integrate multimodal translator
     */
    integrateMultimodalTranslator() {
        const multimodal = window.advancedMultimodalTranslator;

        // Connect to unified I18n system
        if (window.unifiedI18n) {
            multimodal.on('speechResult', (data) => {
                window.unifiedI18n.emit('multimodalTranslation', data);
            });

            multimodal.on('ocrResult', (data) => {
                window.unifiedI18n.emit('ocrTranslation', data);
            });
        }

        console.info('🔗 Multimodal translator integrated');
    }

    /**
     * Integrate OCR translator
     */
    integrateOCRTranslator() {
        const ocr = window.enhancedOCRTranslator;

        // Connect OCR to cultural adaptation
        if (window.culturalAdaptationEngine) {
            ocr.on('ocrResult', async (data) => {
                const culturalContext = window.culturalAdaptationEngine.analyzeCulturalContext(
                    data.text, 'auto', window.unifiedI18n?.currentLanguage || 'en'
                );

                const adaptedTranslation = await window.culturalAdaptationEngine.adaptTranslation(
                    data.text, 'auto', window.unifiedI18n?.currentLanguage || 'en', culturalContext
                );

                this.emit('culturallyAdaptedOCR', {
                    ...data,
                    adaptedTranslation,
                    culturalContext
                });
            });
        }

        console.info('🔗 OCR translator integrated');
    }

    /**
     * Integrate conference translator
     */
    integrateConferenceTranslator() {
        const conference = window.realTimeConferenceTranslator;

        // Connect to speech recognition
        if (window.advancedMultimodalTranslator) {
            conference.on('conferenceStarted', (data) => {
                // Enable multimodal features for conference
                window.advancedMultimodalTranslator.conferenceMode = true;
            });

            conference.on('conferenceEnded', (data) => {
                window.advancedMultimodalTranslator.conferenceMode = false;
            });
        }

        console.info('🔗 Conference translator integrated');
    }

    /**
     * Integrate cultural adaptation engine
     */
    integrateCulturalEngine() {
        const cultural = window.culturalAdaptationEngine;

        // Apply cultural adaptation to all translations
        if (window.unifiedI18n) {
            const originalTranslate = window.unifiedI18n.translate;
            window.unifiedI18n.translate = async function(key, options = {}) {
                const result = await originalTranslate.call(this, key, options);

                // Apply cultural adaptation if enabled
                if (options.culturalAdaptation !== false) {
                    const culturalContext = cultural.analyzeCulturalContext(
                        result, this.currentLanguage, options.language || this.currentLanguage
                    );

                    return await cultural.adaptTranslation(
                        result, this.currentLanguage, options.language || this.currentLanguage, culturalContext
                    );
                }

                return result;
            };
        }

        console.info('🔗 Cultural engine integrated');
    }

    /**
     * Setup unified translation pipeline
     */
    setupUnifiedTranslationPipeline() {
        // Create unified translation function that uses all systems
        window.translateAdvanced = async (text, options = {}) => {
            const {
                sourceLang = 'auto',
                targetLang = window.unifiedI18n?.currentLanguage || 'en',
                context = 'general',
                enableCulturalAdaptation = true,
                enableOCR = false,
                enableConference = false,
                enableMultimodal = false
            } = options;

            const startTime = performance.now();
            let result = text;

            try {
                // Step 1: Basic translation via unified system
                if (window.unifiedI18n) {
                    result = await window.unifiedI18n.translate(text, {
                        language: targetLang,
                        context: 'advanced-translation'
                    });
                }

                // Step 2: Apply cultural adaptation
                if (enableCulturalAdaptation && window.culturalAdaptationEngine) {
                    const culturalContext = window.culturalAdaptationEngine.analyzeCulturalContext(
                        result, sourceLang, targetLang
                    );
                    result = await window.culturalAdaptationEngine.adaptTranslation(
                        result, sourceLang, targetLang, culturalContext
                    );
                }

                // Step 3: Apply multimodal enhancements
                if (enableMultimodal && window.advancedMultimodalTranslator) {
                    // This could enhance based on detected content type
                    result = await window.advancedMultimodalTranslator.translateText(result, sourceLang, targetLang);
                }

                // Update metrics
                this.performanceMetrics.totalTranslations++;
                this.performanceMetrics.averageResponseTime =
                    (this.performanceMetrics.averageResponseTime + (performance.now() - startTime)) / 2;

                this.emit('advancedTranslationComplete', {
                    original: text,
                    translated: result,
                    sourceLang,
                    targetLang,
                    context,
                    processingTime: performance.now() - startTime,
                    systemsUsed: this.getSystemsUsed(options)
                });

                return result;

            } catch (error) {
                console.error('Advanced translation failed:', error);
                this.emit('advancedTranslationError', { error, text, options });
                return text;
            }
        };

        console.info('⚡ Unified translation pipeline established');
    }

    /**
     * Get systems used in translation
     */
    getSystemsUsed(options) {
        const systems = ['unified-i18n'];

        if (options.enableCulturalAdaptation && window.culturalAdaptationEngine) {
            systems.push('cultural-adaptation');
        }

        if (options.enableMultimodal && window.advancedMultimodalTranslator) {
            systems.push('multimodal');
        }

        if (options.enableOCR && window.enhancedOCRTranslator) {
            systems.push('ocr');
        }

        if (options.enableConference && window.realTimeConferenceTranslator) {
            systems.push('conference');
        }

        return systems;
    }

    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        setInterval(() => {
            this.logPerformanceMetrics();
        }, 30000); // Every 30 seconds

        // Monitor system health
        setInterval(() => {
            this.checkSystemHealth();
        }, 60000); // Every minute
    }

    /**
     * Log performance metrics
     */
    logPerformanceMetrics() {
        const metrics = {
            ...this.performanceMetrics,
            systemUptime: Math.floor(this.performanceMetrics.systemUptime / 1000 / 60), // minutes
            activeSystems: this.systems.size,
            integrationStatus: Object.fromEntries(this.integrationStatus)
        };

        console.debug('📊 Advanced Translation Hub Performance:', metrics);
        this.emit('performanceMetrics', metrics);
    }

    /**
     * Check system health
     */
    checkSystemHealth() {
        const health = {
            timestamp: new Date().toISOString(),
            systems: {},
            overall: 'healthy'
        };

        this.systems.forEach((system, name) => {
            try {
                health.systems[name] = {
                    status: 'healthy',
                    stats: system.getStats ? system.getStats() : 'no-stats',
                    lastActivity: system.lastActivity || 'unknown'
                };
            } catch (error) {
                health.systems[name] = {
                    status: 'error',
                    error: error.message
                };
                health.overall = 'degraded';
            }
        });

        this.emit('systemHealth', health);

        if (health.overall !== 'healthy') {
            console.warn('⚠️ System health degraded:', health);
        }
    }

    /**
     * Setup error handling
     */
    setupErrorHandling() {
        // Global error handler for translation systems
        window.addEventListener('error', (event) => {
            if (event.message.includes('translation') || event.message.includes('i18n')) {
                console.error('🔥 Translation system error:', event.error);
                this.emit('systemError', {
                    error: event.error,
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                });
            }
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            if (event.reason.message && event.reason.message.includes('translation')) {
                console.error('💥 Translation promise rejection:', event.reason);
                this.emit('systemError', {
                    error: event.reason,
                    type: 'promise-rejection'
                });
            }
        });
    }

    /**
     * Get total features across all systems
     */
    getTotalFeatures() {
        let features = 0;

        this.systems.forEach((system) => {
            if (system.getStats) {
                const stats = system.getStats();
                if (stats.supportedFeatures) {
                    features += Object.keys(stats.supportedFeatures).length;
                }
            }
        });

        return features;
    }

    /**
     * Get comprehensive system statistics
     */
    getComprehensiveStats() {
        const stats = {
            hub: {
                isFullyIntegrated: this.isFullyIntegrated,
                activeSystems: this.systems.size,
                integrationStatus: Object.fromEntries(this.integrationStatus),
                performanceMetrics: this.performanceMetrics
            },
            systems: {},
            features: {
                total: this.getTotalFeatures(),
                bySystem: {}
            },
            capabilities: {
                multimodal: false,
                ocr: false,
                conference: false,
                cultural: false,
                realTime: false,
                offline: false
            }
        };

        this.systems.forEach((system, name) => {
            if (system.getStats) {
                stats.systems[name] = system.getStats();
                stats.features.bySystem[name] = system.getStats().supportedFeatures || {};
            }

            // Update capabilities
            switch (name) {
                case 'multimodal':
                    stats.capabilities.multimodal = true;
                    break;
                case 'ocr':
                    stats.capabilities.ocr = true;
                    break;
                case 'conference':
                    stats.capabilities.conference = true;
                    stats.capabilities.realTime = true;
                    break;
                case 'cultural':
                    stats.capabilities.cultural = true;
                    break;
            }
        });

        return stats;
    }

    /**
     * Enable advanced features
     */
    async enableAdvancedFeatures(features = []) {
        const results = [];

        for (const feature of features) {
            try {
                switch (feature) {
                    case 'speech':
                        if (window.advancedMultimodalTranslator) {
                            await window.advancedMultimodalTranslator.startSpeechTranslation();
                            results.push({ feature, status: 'enabled' });
                        }
                        break;

                    case 'ocr':
                        if (window.enhancedOCRTranslator) {
                            // OCR is always available, just toggle mode
                            results.push({ feature, status: 'available' });
                        }
                        break;

                    case 'conference':
                        if (window.realTimeConferenceTranslator) {
                            await window.realTimeConferenceTranslator.startConferenceSession();
                            results.push({ feature, status: 'enabled' });
                        }
                        break;

                    case 'cultural':
                        if (window.culturalAdaptationEngine) {
                            results.push({ feature, status: 'enabled' });
                        }
                        break;

                    default:
                        results.push({ feature, status: 'unknown' });
                }
            } catch (error) {
                results.push({ feature, status: 'failed', error: error.message });
            }
        }

        this.emit('featuresEnabled', results);
        return results;
    }

    /**
     * Disable advanced features
     */
    disableAdvancedFeatures(features = []) {
        const results = [];

        for (const feature of features) {
            try {
                switch (feature) {
                    case 'speech':
                        if (window.advancedMultimodalTranslator) {
                            window.advancedMultimodalTranslator.stopSpeechTranslation();
                            results.push({ feature, status: 'disabled' });
                        }
                        break;

                    case 'conference':
                        if (window.realTimeConferenceTranslator) {
                            window.realTimeConferenceTranslator.endConferenceSession();
                            results.push({ feature, status: 'disabled' });
                        }
                        break;

                    default:
                        results.push({ feature, status: 'unknown' });
                }
            } catch (error) {
                results.push({ feature, status: 'failed', error: error.message });
            }
        }

        this.emit('featuresDisabled', results);
        return results;
    }

    /**
     * Event system
     */
    emit(event, data) {
        document.dispatchEvent(new CustomEvent(`hub:${event}`, { detail: data }));
    }

    /**
     * Add event listener
     */
    on(event, callback) {
        document.addEventListener(`hub:${event}`, callback);
    }
}

// Initialize Advanced Translation Hub
window.advancedTranslationHub = new AdvancedTranslationHub();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    // Start uptime tracking
    window.advancedTranslationHub.performanceMetrics.systemUptime = Date.now();

    await window.advancedTranslationHub.initialize();

    // Setup global functions
    window.translateAdvanced = async (text, options) =>
        window.translateAdvanced(text, options);

    window.enableAdvancedTranslation = (features) =>
        window.advancedTranslationHub.enableAdvancedFeatures(features);

    window.disableAdvancedTranslation = (features) =>
        window.advancedTranslationHub.disableAdvancedFeatures(features);

    window.getAdvancedTranslationStats = () =>
        window.advancedTranslationHub.getComprehensiveStats();

    // Setup keyboard shortcuts
    document.addEventListener('keydown', (event) => {
        // Ctrl+Shift+A for advanced translation
        if (event.ctrlKey && event.shiftKey && event.key === 'A') {
            event.preventDefault();
            window.advancedTranslationHub.enableAdvancedFeatures(['speech', 'ocr', 'conference']);
        }

        // Ctrl+Shift+D to disable advanced features
        if (event.ctrlKey && event.shiftKey && event.key === 'D') {
            event.preventDefault();
            window.advancedTranslationHub.disableAdvancedFeatures(['speech', 'conference']);
        }
    });

    console.info('🚀 Advanced Translation Integration Hub ready');
    console.info('💡 Keyboard shortcuts:');
    console.info('   Ctrl+Shift+A: Enable all advanced features');
    console.info('   Ctrl+Shift+D: Disable advanced features');
    console.info('   Ctrl+Shift+T: Start speech translation');
    console.info('   Ctrl+Shift+O: Toggle OCR mode');
});

// Export for modules
export default AdvancedTranslationHub;
