/**
 * Translation System Integration Manager for Qui Browser VR
 * Manages initialization and coordination of all translation systems
 * @version 1.0.0 - System Integration
 */

class TranslationSystemManager {
    constructor() {
        this.initializationQueue = [];
        this.systemsStatus = new Map();
        this.integrationComplete = false;
        this.initializationStartTime = null;
        this.translationStats = {
            totalTranslations: 0,
            activeSystems: 0,
            averageResponseTime: 0,
            errorCount: 0
        };
    }

    /**
     * Initialize all translation systems
     */
    async initialize() {
        console.info('🚀 Starting Translation System Integration...');
        this.initializationStartTime = performance.now();

        try {
            // Phase 1: Core systems
            await this.initializeCoreSystems();

            // Phase 2: Advanced systems
            await this.initializeAdvancedSystems();

            // Phase 3: Integration and coordination
            await this.establishSystemIntegration();

            // Phase 4: Performance optimization
            this.optimizePerformance();

            // Phase 5: User interface setup
            this.setupUserInterface();

            this.integrationComplete = true;
            const initializationTime = performance.now() - this.initializationStartTime;

            console.info(`🎉 Translation System Integration Complete! (${initializationTime.toFixed(2)}ms)`);
            this.announceSystemReady();

        } catch (error) {
            console.error('💥 Translation System Integration Failed:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * Initialize core translation systems
     */
    async initializeCoreSystems() {
        console.info('📚 Initializing core translation systems...');

        const coreSystems = [
            { name: 'unified-i18n', check: () => window.unifiedI18n, priority: 1 },
            { name: 'ai-improver', check: () => window.enhancedAITranslationImprover, priority: 2 },
            { name: 'i18n', check: () => window.i18n, priority: 3 }
        ];

        await this.initializeSystems(coreSystems, 'core');
    }

    /**
     * Initialize advanced translation systems
     */
    async initializeAdvancedSystems() {
        console.info('🚀 Initializing advanced translation systems...');

        const advancedSystems = [
            { name: 'multimodal', check: () => window.advancedMultimodalTranslator, priority: 1 },
            { name: 'ocr', check: () => window.enhancedOCRTranslator, priority: 2 },
            { name: 'conference', check: () => window.realTimeConferenceTranslator, priority: 3 },
            { name: 'cultural', check: () => window.culturalAdaptationEngine, priority: 4 },
            { name: 'hub', check: () => window.advancedTranslationHub, priority: 5 },
            { name: 'ultimate', check: () => window.ultimateTranslationSystem, priority: 6 },
            { name: 'language-panel', check: () => window.enhancedLanguagePanel, priority: 7 }
        ];

        await this.initializeSystems(advancedSystems, 'advanced');
    }

    /**
     * Initialize systems by category
     */
    async initializeSystems(systems, category) {
        console.info(`🔧 Initializing ${category} systems...`);

        // Sort by priority
        systems.sort((a, b) => a.priority - b.priority);

        for (const system of systems) {
            try {
                await this.initializeSystem(system, category);
            } catch (error) {
                console.warn(`⚠️ Failed to initialize ${system.name}:`, error);
                this.systemsStatus.set(system.name, { status: 'failed', error: error.message });
            }
        }
    }

    /**
     * Initialize individual system
     */
    async initializeSystem(system, category) {
        console.info(`🔄 Initializing ${system.name}...`);

        // Check if system is available
        if (!system.check()) {
            console.warn(`⚠️ ${system.name} system not loaded`);
            this.systemsStatus.set(system.name, { status: 'not-loaded', category });
            return;
        }

        const systemInstance = system.check();

        // Check if system has initialize method
        if (typeof systemInstance.initialize === 'function') {
            await systemInstance.initialize();
        }

        this.systemsStatus.set(system.name, { status: 'ready', category });
        console.info(`✅ ${system.name} initialized successfully`);
    }

    /**
     * Establish integration between systems
     */
    async establishSystemIntegration() {
        console.info('🔗 Establishing system integrations...');

        try {
            // Setup cross-system event coordination
            this.setupEventCoordination();

            // Setup unified translation pipeline
            this.setupUnifiedTranslation();

            // Setup performance monitoring
            this.setupPerformanceMonitoring();

            // Setup error handling
            this.setupErrorHandling();

            console.info('✅ System integrations established');

        } catch (error) {
            console.error('❌ System integration failed:', error);
            throw error;
        }
    }

    /**
     * Setup event coordination between systems
     */
    setupEventCoordination() {
        // Language change coordination
        if (window.unifiedI18n) {
            window.unifiedI18n.on('languageChanged', (data) => {
                console.info('🌍 Broadcasting language change:', data.current);

                // Notify all systems of language change
                this.broadcastToSystems('languageChanged', data);

                // Update translation stats
                this.translationStats.activeSystems = this.getActiveSystemsCount();
            });
        }

        // Translation completion coordination
        document.addEventListener('ultimateTranslationComplete', (event) => {
            this.translationStats.totalTranslations++;
            this.translationStats.averageResponseTime =
                (this.translationStats.averageResponseTime + event.detail.processingTime) / 2;
        });

        console.info('📡 Event coordination established');
    }

    /**
     * Setup unified translation pipeline
     */
    setupUnifiedTranslation() {
        // Ensure all translation functions are available globally
        window.translate = async (text, options = {}) => {
            if (window.translateUltimate) {
                return await window.translateUltimate(text, options);
            } else if (window.unifiedI18n) {
                return await window.unifiedI18n.translate(text, options);
            } else if (window.i18n) {
                return window.i18n.t(text);
            }
            return text;
        };

        window.translateAdvanced = window.translateUltimate || window.translate;
        window.detectLanguage = (text) => {
            if (window.advancedMultimodalTranslator?.languageDetector) {
                return window.advancedMultimodalTranslator.languageDetector.detect(text);
            }
            return { language: 'en', confidence: 0.5 };
        };

        console.info('⚡ Unified translation pipeline established');
    }

    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        // Monitor system performance
        setInterval(() => {
            this.monitorSystemPerformance();
        }, 30000); // Every 30 seconds

        // Monitor memory usage
        setInterval(() => {
            this.monitorMemoryUsage();
        }, 60000); // Every minute

        // Update translation statistics
        setInterval(() => {
            this.updateTranslationStats();
        }, 10000); // Every 10 seconds

        console.info('📊 Performance monitoring established');
    }

    /**
     * Monitor system performance
     */
    monitorSystemPerformance() {
        const performance = performance.getEntriesByType('measure');
        const navigation = performance.getEntriesByType('navigation')[0];

        if (navigation) {
            console.debug('📈 Navigation Performance:', {
                domComplete: navigation.domComplete,
                loadComplete: navigation.loadEventEnd,
                totalTime: navigation.loadEventEnd - navigation.navigationStart
            });
        }

        // Check system health
        this.checkSystemHealth();

        // Log performance metrics
        this.logPerformanceMetrics();
    }

    /**
     * Monitor memory usage
     */
    monitorMemoryUsage() {
        if (performance.memory) {
            const memory = performance.memory;
            const usage = {
                used: Math.round(memory.usedJSHeapSize / 1048576), // MB
                total: Math.round(memory.totalJSHeapSize / 1048576), // MB
                limit: Math.round(memory.jsHeapSizeLimit / 1048576) // MB
            };

            console.debug('💾 Memory Usage:', usage);

            // Warn if memory usage is high
            if (usage.used > usage.limit * 0.8) {
                console.warn('⚠️ High memory usage detected:', usage);
            }
        }
    }

    /**
     * Check system health
     */
    checkSystemHealth() {
        let healthySystems = 0;
        let totalSystems = 0;

        this.systemsStatus.forEach((status, name) => {
            totalSystems++;
            if (status.status === 'ready') {
                healthySystems++;
            }
        });

        const healthPercentage = totalSystems > 0 ? (healthySystems / totalSystems) * 100 : 0;

        console.debug('🏥 System Health:', {
            totalSystems,
            healthySystems,
            healthPercentage: `${healthPercentage.toFixed(1)}%`
        });

        // Update global health status
        window.translationSystemHealth = {
            percentage: healthPercentage,
            status: healthPercentage > 80 ? 'healthy' : healthPercentage > 50 ? 'degraded' : 'unhealthy',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Setup error handling
     */
    setupErrorHandling() {
        // Global translation error handler
        window.addEventListener('error', (event) => {
            if (event.message.includes('translation') || event.message.includes('i18n')) {
                this.translationStats.errorCount++;
                console.error('🔥 Translation System Error:', event.error);
                this.handleSystemError(event.error, event.message);
            }
        });

        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            if (event.reason.message && event.reason.message.includes('translation')) {
                this.translationStats.errorCount++;
                console.error('💥 Translation Promise Rejection:', event.reason);
                this.handleSystemError(event.reason, 'Promise rejection');
            }
        });

        console.info('🛡️ Error handling established');
    }

    /**
     * Handle system errors
     */
    handleSystemError(error, context) {
        console.error('🚨 Translation system error:', { error, context });

        // Attempt recovery
        this.attemptErrorRecovery(error, context);

        // Notify user if critical error
        if (this.isCriticalError(error)) {
            this.notifyUserOfError(error, context);
        }
    }

    /**
     * Attempt error recovery
     */
    attemptErrorRecovery(error, context) {
        // Try to reinitialize failed systems
        this.systemsStatus.forEach(async (status, name) => {
            if (status.status === 'failed') {
                console.info(`🔄 Attempting recovery for ${name}...`);
                // Recovery logic would go here
            }
        });
    }

    /**
     * Check if error is critical
     */
    isCriticalError(error) {
        const criticalErrors = [
            'unifiedI18n',
            'translation pipeline',
            'language system'
        ];

        return criticalErrors.some(critical => error.message?.includes(critical));
    }

    /**
     * Notify user of critical errors
     */
    notifyUserOfError(error, context) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #de350b;
            color: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10001;
            max-width: 300px;
        `;

        notification.innerHTML = `
            <strong>Translation System Error</strong><br>
            <small>${context}</small><br>
            <button onclick="this.parentElement.remove()" style="margin-top: 10px; padding: 5px 10px; background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 4px; cursor: pointer;">Dismiss</button>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 10 seconds
        setTimeout(() => notification.remove(), 10000);
    }

    /**
     * Optimize performance
     */
    optimizePerformance() {
        console.info('⚡ Optimizing translation system performance...');

        // Setup lazy loading for heavy features
        this.setupLazyLoading();

        // Setup caching strategies
        this.setupCachingStrategies();

        // Setup memory management
        this.setupMemoryManagement();

        console.info('✅ Performance optimizations applied');
    }

    /**
     * Setup lazy loading
     */
    setupLazyLoading() {
        // Load OCR and speech features only when needed
        const lazyFeatures = ['ocr', 'speech', 'conference'];

        lazyFeatures.forEach(feature => {
            const button = document.querySelector(`[data-feature="${feature}"]`);
            if (button) {
                button.addEventListener('click', () => {
                    this.loadFeatureOnDemand(feature);
                });
            }
        });
    }

    /**
     * Load feature on demand
     */
    async loadFeatureOnDemand(feature) {
        console.info(`📦 Loading ${feature} on demand...`);

        try {
            switch (feature) {
                case 'ocr':
                    if (!window.enhancedOCRTranslator) {
                        await window.moduleLoader.load(['enhanced-ocr-translator']);
                    }
                    break;
                case 'speech':
                    if (!window.advancedMultimodalTranslator) {
                        await window.moduleLoader.load(['advanced-multimodal-translator']);
                    }
                    break;
                case 'conference':
                    if (!window.realTimeConferenceTranslator) {
                        await window.moduleLoader.load(['real-time-conference-translator']);
                    }
                    break;
            }

            console.info(`✅ ${feature} loaded on demand`);
        } catch (error) {
            console.error(`❌ Failed to load ${feature}:`, error);
        }
    }

    /**
     * Setup caching strategies
     */
    setupCachingStrategies() {
        // Translation result caching
        if (window.unifiedI18n) {
            // Caching is already handled by unified system
            console.info('💾 Translation caching active');
        }
    }

    /**
     * Setup memory management
     */
    setupMemoryManagement() {
        // Periodic cleanup
        setInterval(() => {
            this.performMemoryCleanup();
        }, 300000); // Every 5 minutes

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            this.performMemoryCleanup();
        });
    }

    /**
     * Perform memory cleanup
     */
    performMemoryCleanup() {
        // Clear translation caches if they're too large
        if (window.unifiedI18n?.translationCache?.size > 1000) {
            window.unifiedI18n.translationCache.clear();
            console.info('🧹 Translation cache cleared');
        }

        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
    }

    /**
     * Setup user interface
     */
    setupUserInterface() {
        console.info('🖥️ Setting up translation user interface...');

        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Setup context menus
        this.setupContextMenus();

        // Setup notifications
        this.setupNotifications();

        console.info('✅ User interface setup complete');
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
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

            // Ctrl+Shift+C for conference mode
            if (event.ctrlKey && event.shiftKey && event.key === 'C') {
                event.preventDefault();
                this.toggleConferenceMode();
            }

            // Ctrl+Shift+L for language panel
            if (event.ctrlKey && event.shiftKey && event.key === 'L') {
                event.preventDefault();
                window.enhancedLanguagePanel?.show();
            }

            // Ctrl+Shift+D for dashboard
            if (event.ctrlKey && event.shiftKey && event.key === 'D') {
                event.preventDefault();
                window.showTranslationDashboard?.();
            }
        });

        console.info('⌨️ Keyboard shortcuts configured');
    }

    /**
     * Setup context menus
     */
    setupContextMenus() {
        // Right-click context menu for translation
        document.addEventListener('contextmenu', (event) => {
            const selectedText = window.getSelection().toString();
            if (selectedText && selectedText.length > 0) {
                this.showTranslationContextMenu(event, selectedText);
            }
        });
    }

    /**
     * Show translation context menu
     */
    showTranslationContextMenu(event, selectedText) {
        // Remove existing context menu
        const existing = document.querySelector('.translation-context-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.className = 'translation-context-menu';
        menu.style.cssText = `
            position: fixed;
            top: ${event.pageY}px;
            left: ${event.pageX}px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            min-width: 200px;
        `;

        menu.innerHTML = `
            <div style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: bold;">Translate</div>
            <div style="padding: 8px 12px; cursor: pointer;" class="translate-selection">Translate Selection</div>
            <div style="padding: 8px 12px; cursor: pointer;" class="translate-page">Translate Page</div>
            <div style="padding: 8px 12px; cursor: pointer; border-top: 1px solid #eee;" class="copy-translation">Copy Translation</div>
        `;

        // Setup menu actions
        menu.querySelector('.translate-selection').addEventListener('click', async () => {
            const translation = await window.translate(selectedText);
            this.showTranslationPopup(event.pageX, event.pageY, selectedText, translation);
            menu.remove();
        });

        menu.querySelector('.translate-page').addEventListener('click', () => {
            this.translateEntirePage();
            menu.remove();
        });

        menu.querySelector('.copy-translation').addEventListener('click', async () => {
            const translation = await window.translate(selectedText);
            navigator.clipboard.writeText(translation);
            menu.remove();
        });

        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', () => menu.remove(), { once: true });
        }, 100);

        document.body.appendChild(menu);
    }

    /**
     * Show translation popup
     */
    showTranslationPopup(x, y, original, translation) {
        const popup = document.createElement('div');
        popup.style.cssText = `
            position: fixed;
            top: ${y + 10}px;
            left: ${x}px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10001;
            max-width: 300px;
            padding: 12px;
        `;

        popup.innerHTML = `
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">Original:</div>
            <div style="font-size: 14px; margin-bottom: 12px;">${original}</div>
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">Translation:</div>
            <div style="font-size: 14px; font-weight: bold;">${translation}</div>
        `;

        document.body.appendChild(popup);

        setTimeout(() => popup.remove(), 5000);
    }

    /**
     * Translate entire page
     */
    async translateEntirePage() {
        console.info('🌐 Translating entire page...');

        const elements = document.querySelectorAll('[data-i18n], .translateable');
        let translatedCount = 0;

        for (const element of elements) {
            const text = element.textContent?.trim();
            if (text && text.length > 0) {
                try {
                    const translation = await window.translate(text);
                    if (translation !== text) {
                        element.textContent = translation;
                        translatedCount++;
                    }
                } catch (error) {
                    console.warn('Page translation failed for element:', error);
                }
            }
        }

        console.info(`✅ Page translation complete: ${translatedCount} elements translated`);
    }

    /**
     * Setup notifications
     */
    setupNotifications() {
        // Create notification container
        const notificationContainer = document.createElement('div');
        notificationContainer.id = 'translation-notifications';
        notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10002;
            pointer-events: none;
        `;
        document.body.appendChild(notificationContainer);

        console.info('🔔 Notification system setup complete');
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            background: ${type === 'error' ? '#de350b' : type === 'success' ? '#00875a' : '#0065ff'};
            color: white;
            padding: 12px 16px;
            border-radius: 4px;
            margin-bottom: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            pointer-events: auto;
            cursor: pointer;
        `;

        notification.textContent = message;

        const container = document.getElementById('translation-notifications');
        if (container) {
            container.appendChild(notification);

            // Auto-remove
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 300);
            }, duration);

            // Click to dismiss
            notification.addEventListener('click', () => {
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 300);
            });
        }
    }

    /**
     * Toggle speech translation
     */
    async toggleSpeechTranslation() {
        if (window.advancedMultimodalTranslator) {
            await window.advancedMultimodalTranslator.toggleSpeechTranslation();
        } else {
            this.showNotification('Speech translation not available', 'warning');
        }
    }

    /**
     * Toggle OCR mode
     */
    toggleOCRMode() {
        if (window.enhancedOCRTranslator) {
            window.enhancedOCRTranslator.toggleOCRMode();
        } else {
            this.showNotification('OCR translation not available', 'warning');
        }
    }

    /**
     * Toggle conference mode
     */
    async toggleConferenceMode() {
        if (window.realTimeConferenceTranslator) {
            if (window.realTimeConferenceTranslator.isConferenceActive) {
                window.realTimeConferenceTranslator.endConferenceSession();
            } else {
                await window.realTimeConferenceTranslator.startConferenceSession();
            }
        } else {
            this.showNotification('Conference translation not available', 'warning');
        }
    }

    /**
     * Update translation statistics
     */
    updateTranslationStats() {
        // Update from various systems
        if (window.advancedTranslationHub) {
            const stats = window.advancedTranslationHub.getComprehensiveStats();
            this.translationStats.totalTranslations = stats.performance?.totalTranslations || 0;
            this.translationStats.averageResponseTime = stats.performance?.averageResponseTime || 0;
        }

        if (window.enhancedAITranslationImprover) {
            const aiStats = window.enhancedAITranslationImprover.getQualityStats();
            this.translationStats.aiQuality = aiStats.averageQuality || 0;
        }
    }

    /**
     * Get active systems count
     */
    getActiveSystemsCount() {
        let count = 0;
        this.systemsStatus.forEach((status) => {
            if (status.status === 'ready') count++;
        });
        return count;
    }

    /**
     * Broadcast event to all systems
     */
    broadcastToSystems(event, data) {
        this.systemsStatus.forEach((status, name) => {
            if (status.status === 'ready') {
                const system = this.getSystemInstance(name);
                if (system && system.emit) {
                    system.emit(event, data);
                }
            }
        });
    }

    /**
     * Get system instance by name
     */
    getSystemInstance(name) {
        switch (name) {
            case 'unified-i18n': return window.unifiedI18n;
            case 'ai-improver': return window.enhancedAITranslationImprover;
            case 'i18n': return window.i18n;
            case 'multimodal': return window.advancedMultimodalTranslator;
            case 'ocr': return window.enhancedOCRTranslator;
            case 'conference': return window.realTimeConferenceTranslator;
            case 'cultural': return window.culturalAdaptationEngine;
            case 'hub': return window.advancedTranslationHub;
            case 'ultimate': return window.ultimateTranslationSystem;
            case 'language-panel': return window.enhancedLanguagePanel;
            default: return null;
        }
    }

    /**
     * Log performance metrics
     */
    logPerformanceMetrics() {
        const metrics = {
            ...this.translationStats,
            systemHealth: window.translationSystemHealth || {},
            initializationTime: this.initializationStartTime ? performance.now() - this.initializationStartTime : 0,
            activeSystems: this.getActiveSystemsCount(),
            totalSystems: this.systemsStatus.size
        };

        console.debug('📊 Translation System Metrics:', metrics);
    }

    /**
     * Announce system ready
     */
    announceSystemReady() {
        const stats = this.getSystemOverview();

        console.info('🎉 🌟 TRANSLATION SYSTEM FULLY OPERATIONAL! 🌟 🎉');
        console.info(`📚 Systems Ready: ${stats.readySystems}/${stats.totalSystems}`);
        console.info(`🌍 Languages: ${stats.languageCount}`);
        console.info(`⚡ Features: ${stats.featureCount}`);
        console.info(`🎯 Integration: ${this.integrationComplete ? 'Complete' : 'In Progress'}`);

        // Show user notification
        this.showNotification('Translation system ready! Press Ctrl+Shift+L for language options', 'success', 5000);

        // Emit ready event
        document.dispatchEvent(new CustomEvent('translationSystemReady', {
            detail: {
                stats,
                integrationComplete: this.integrationComplete,
                timestamp: new Date().toISOString()
            }
        }));
    }

    /**
     * Get system overview
     */
    getSystemOverview() {
        return {
            readySystems: this.getActiveSystemsCount(),
            totalSystems: this.systemsStatus.size,
            languageCount: window.unifiedI18n?.getTranslationStats?.()?.total || 0,
            featureCount: this.getTotalFeatures(),
            integrationComplete: this.integrationComplete,
            performance: this.translationStats
        };
    }

    /**
     * Get total features count
     */
    getTotalFeatures() {
        let count = 0;

        this.systemsStatus.forEach((status, name) => {
            if (status.status === 'ready') {
                const system = this.getSystemInstance(name);
                if (system && system.getStats) {
                    const stats = system.getStats();
                    if (stats.supportedFeatures) {
                        count += Object.keys(stats.supportedFeatures).length;
                    }
                }
            }
        });

        return count;
    }

    /**
     * Handle initialization error
     */
    handleInitializationError(error) {
        console.error('💥 Critical initialization error:', error);

        // Show error notification
        this.showNotification('Translation system initialization failed', 'error', 10000);

        // Attempt recovery
        setTimeout(() => {
            this.attemptFullRecovery();
        }, 5000);
    }

    /**
     * Attempt full system recovery
     */
    async attemptFullRecovery() {
        console.info('🔄 Attempting system recovery...');

        try {
            // Clear failed systems
            this.systemsStatus.clear();

            // Reinitialize core systems
            await this.initializeCoreSystems();

            // Show recovery notification
            this.showNotification('Translation system partially recovered', 'success', 3000);

        } catch (error) {
            console.error('❌ Recovery failed:', error);
            this.showNotification('System recovery failed. Some features may not work.', 'error', 10000);
        }
    }
}

// Initialize Translation System Manager
window.translationSystemManager = new TranslationSystemManager();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    // Wait a bit for other systems to load
    setTimeout(async () => {
        await window.translationSystemManager.initialize();
        console.info('🌟 Translation System Manager operational');
    }, 100);
});

// Export for modules
export default TranslationSystemManager;
