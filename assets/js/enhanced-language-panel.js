/**
 * Enhanced Language Panel Controller for Qui Browser VR
 * Integrates advanced translation features into the language selection interface
 * @version 1.0.0 - Panel Integration
 */

class EnhancedLanguagePanel {
    constructor() {
        this.panel = null;
        this.currentTab = 'languages';
        this.languageOptions = [];
        this.searchTerm = '';
        // Setup enhanced language manager integration
        this.languageManager = window.enhancedLanguageManager;
        this.searchInput = null;
        this.categoryFilter = null;
        this.sortFilter = null;
        this.languageGrid = null;
        this.currentSearchResults = [];

        if (this.languageManager) {
            this.languageManager.on('languageManagerReady', () => {
                this.updateLanguageList();
                this.setupAdvancedSearch();
                this.setupUltraTab();
            });
        }
        this.isInitialized = false;
        this.systemsReady = new Set();
    }

    /**
     * Initialize enhanced language panel
     */
    async initialize() {
        console.info('🖥️ Initializing Enhanced Language Panel...');

        try {
            // Wait for DOM to be ready
            await this.waitForDOM();

            // Setup panel elements
            this.setupPanelElements();

            // Setup tab system
            this.setupTabSystem();

            // Setup search functionality
            this.setupSearchFunctionality();

            // Setup feature integrations
            this.setupFeatureIntegrations();

            // Setup event listeners
            this.setupEventListeners();

            // Load language options
            await this.loadLanguageOptions();

            this.isInitialized = true;
            console.info('✅ Enhanced Language Panel initialized successfully');

            this.emit('panelReady', {
                tabs: ['languages', 'speech', 'ocr', 'conference', 'cultural', 'advanced'],
                features: this.getAvailableFeatures()
            });

        } catch (error) {
            console.error('❌ Failed to initialize language panel:', error);
            this.emit('panelError', error);
        }
    }

    /**
     * Wait for DOM to be ready
     */
    waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }

    /**
     * Setup panel elements
     */
    setupPanelElements() {
        this.panel = document.getElementById('language-panel');
        if (!this.panel) {
            throw new Error('Language panel not found');
        }

        // Setup language options container
        this.languageOptionsContainer = document.getElementById('language-options');
        if (!this.languageOptionsContainer) {
            throw new Error('Language options container not found');
        }

        // Setup search input
        this.searchInput = document.getElementById('language-search');
        if (!this.searchInput) {
            throw new Error('Language search input not found');
        }
    }

    /**
     * Setup tab system
     */
    setupTabSystem() {
        const tabButtons = this.panel.querySelectorAll('.tab-btn');
        const tabPanes = this.panel.querySelectorAll('.tab-pane');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.switchTab(button.dataset.tab);
            });
        });

        // Setup tab content switching
        this.tabButtons = tabButtons;
        this.tabPanes = tabPanes;
    }

    /**
     * Switch to specific tab
     */
    switchTab(tabName) {
        // Update button states
        this.tabButtons.forEach(button => {
            if (button.dataset.tab === tabName) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });

        // Update pane visibility
        this.tabPanes.forEach(pane => {
            if (pane.id === `${tabName}-tab`) {
                pane.classList.add('active');
            } else {
                pane.classList.remove('active');
            }
        });

        this.currentTab = tabName;
        console.info(`🔄 Switched to ${tabName} tab`);

        this.emit('tabSwitched', {
            tab: tabName,
            previousTab: this.currentTab
        });

        // Update tab-specific content
        this.updateTabContent(tabName);
    }

    /**
     * Setup search functionality
     */
    setupSearchFunctionality() {
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (event) => {
                this.searchTerm = event.target.value.toLowerCase();
                this.filterLanguages();
            });

            this.searchInput.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    this.searchInput.value = '';
                    this.searchTerm = '';
                    this.filterLanguages();
                }
            });
        }
    }

    /**
     * Setup feature integrations
     */
    setupFeatureIntegrations() {
        // Speech translation toggle
        const speechToggle = document.getElementById('speech-toggle');
        if (speechToggle) {
            speechToggle.addEventListener('click', () => {
                this.toggleSpeechTranslation();
            });
        }

        // OCR toggle
        const ocrToggle = document.getElementById('ocr-toggle');
        if (ocrToggle) {
            ocrToggle.addEventListener('click', () => {
                this.toggleOCRMode();
            });
        }

        // Conference start/end
        const conferenceStart = document.getElementById('conference-start');
        const conferenceEnd = document.getElementById('conference-end');
        if (conferenceStart) {
            conferenceStart.addEventListener('click', () => {
                this.startConferenceMode();
            });
        }
        if (conferenceEnd) {
            conferenceEnd.addEventListener('click', () => {
                this.endConferenceMode();
            });
        }

        // Cultural adaptation toggle
        const culturalToggle = document.getElementById('cultural-adaptation-toggle');
        if (culturalToggle) {
            culturalToggle.addEventListener('change', (event) => {
                this.toggleCulturalAdaptation(event.target.checked);
            });
        }

        // Advanced features
        const showDashboard = document.getElementById('show-dashboard');
        const showToggles = document.getElementById('show-toggles');
        const exportData = document.getElementById('export-data');

        if (showDashboard) {
            showDashboard.addEventListener('click', () => {
                this.showTranslationDashboard();
            });
        }

        if (showToggles) {
            showToggles.addEventListener('click', () => {
                this.showFeatureToggles();
            });
        }

        if (exportData) {
            exportData.addEventListener('click', () => {
                this.exportTranslationData();
            });
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for system readiness
        document.addEventListener('DOMContentLoaded', () => {
            this.checkSystemReadiness();
        });

        // Listen for language changes
        if (window.unifiedI18n) {
            window.unifiedI18n.on('languageChanged', (data) => {
                this.updateLanguageSelection(data.current);
            });
        }

        // Listen for advanced system events
        this.setupAdvancedSystemListeners();
    }

    /**
     * Setup advanced system listeners
     */
    setupAdvancedSystemListeners() {
        // Speech recognition status
        document.addEventListener('speechStarted', () => {
            this.updateSpeechStatus('active');
        });

        document.addEventListener('speechEnded', () => {
            this.updateSpeechStatus('inactive');
        });

        document.addEventListener('speechError', (event) => {
            this.updateSpeechStatus('error', event.detail);
        });

        // OCR status
        document.addEventListener('ocrReady', () => {
            this.updateOCRStatus('ready');
        });

        document.addEventListener('ocrModeToggled', (event) => {
            this.updateOCRStatus(event.detail.enabled ? 'enabled' : 'disabled');
        });

        // Conference status
        document.addEventListener('conferenceStarted', (event) => {
            this.updateConferenceStatus('active', event.detail);
        });

        document.addEventListener('conferenceEnded', () => {
            this.updateConferenceStatus('inactive');
        });

        // Cultural adaptation
        document.addEventListener('culturalEngineReady', () => {
            this.updateCulturalStatus('ready');
        });
    }

    /**
     * Check system readiness
     */
    checkSystemReadiness() {
        const systems = [
            { name: 'multimodal', check: () => window.advancedMultimodalTranslator },
            { name: 'ocr', check: () => window.enhancedOCRTranslator },
            { name: 'conference', check: () => window.realTimeConferenceTranslator },
            { name: 'cultural', check: () => window.culturalAdaptationEngine },
            { name: 'hub', check: () => window.advancedTranslationHub }
        ];

        systems.forEach(system => {
            if (system.check()) {
                this.systemsReady.add(system.name);
                console.info(`✅ ${system.name} system ready`);
            }
        });

        this.updateTabAvailability();
        this.updateSystemStats();
    }

    /**
     * Update tab availability based on system readiness
     */
    updateTabAvailability() {
        // Disable tabs for systems that aren't ready
        if (!this.systemsReady.has('multimodal')) {
            const speechTab = document.querySelector('[data-tab="speech"]');
            if (speechTab) {
                speechTab.disabled = true;
                speechTab.style.opacity = '0.5';
            }
        }

        if (!this.systemsReady.has('ocr')) {
            const ocrTab = document.querySelector('[data-tab="ocr"]');
            if (ocrTab) {
                ocrTab.disabled = true;
                ocrTab.style.opacity = '0.5';
            }
        }

        if (!this.systemsReady.has('conference')) {
            const conferenceTab = document.querySelector('[data-tab="conference"]');
            if (conferenceTab) {
                conferenceTab.disabled = true;
                conferenceTab.style.opacity = '0.5';
            }
        }

        if (!this.systemsReady.has('cultural')) {
            const culturalTab = document.querySelector('[data-tab="cultural"]');
            if (culturalTab) {
                culturalTab.disabled = true;
                culturalTab.style.opacity = '0.5';
            }
        }
    }

    /**
     * Load language options
     */
    async loadLanguageOptions() {
        try {
            if (window.unifiedI18n) {
                const languages = window.unifiedI18n.getSupportedLanguages();
                this.languageOptions = Object.entries(languages).map(([code, lang]) => ({
                    code,
                    name: lang.name,
                    nativeName: lang.nativeName,
                    flag: lang.flag,
                    region: lang.region,
                    priority: lang.priority,
                    rtl: lang.rtl
                }));

                this.renderLanguageOptions();
                this.populateFeatureSelects();

                console.info(`🌍 Loaded ${this.languageOptions.length} languages`);
            } else {
                console.warn('⚠️ Unified I18n system not available');
                this.loadFallbackLanguages();
            }
        } catch (error) {
            console.error('❌ Failed to load language options:', error);
            this.loadFallbackLanguages();
        }
    }

    /**
     * Load fallback languages
     */
    loadFallbackLanguages() {
        this.languageOptions = [
            { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', region: 'US', priority: 1 },
            { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', region: 'ES', priority: 2 },
            { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', region: 'FR', priority: 3 },
            { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', region: 'DE', priority: 4 },
            { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', region: 'JP', priority: 5 },
            { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', region: 'KR', priority: 6 },
            { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', region: 'CN', priority: 7 },
            { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', region: 'SA', priority: 8 },
            { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', region: 'IN', priority: 9 },
            { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', region: 'PT', priority: 10 }
        ];

        this.renderLanguageOptions();
        this.populateFeatureSelects();
    }

    /**
     * Render language options
     */
    renderLanguageOptions() {
        if (!this.languageOptionsContainer) return;

        this.languageOptionsContainer.innerHTML = '';

        const filteredLanguages = this.filterLanguages();

        filteredLanguages.forEach(lang => {
            const button = document.createElement('button');
            button.className = 'lang-btn';
            button.innerHTML = `${lang.flag} ${lang.nativeName}<span class="lang-region">${lang.region}</span>`;
            button.dataset.lang = lang.code;
            button.title = `${lang.name} (${lang.region})`;

            if (lang.code === (window.unifiedI18n?.currentLanguage || 'en')) {
                button.classList.add('active');
            }

            button.addEventListener('click', () => {
                this.selectLanguage(lang.code);
            });

            this.languageOptionsContainer.appendChild(button);
        });
    }

    /**
     * Filter languages based on search term
     */
    filterLanguages() {
        if (!this.searchTerm) {
            return this.languageOptions.sort((a, b) => a.priority - b.priority);
        }

        return this.languageOptions.filter(lang =>
            lang.name.toLowerCase().includes(this.searchTerm) ||
            lang.nativeName.toLowerCase().includes(this.searchTerm) ||
            lang.code.toLowerCase().includes(this.searchTerm) ||
            lang.region.toLowerCase().includes(this.searchTerm)
        ).sort((a, b) => a.priority - b.priority);
    }

    /**
     * Populate feature selects with languages
     */
    populateFeatureSelects() {
        const selects = [
            'speech-source-lang',
            'speech-target-lang',
            'ocr-language'
        ];

        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                select.innerHTML = '';

                // Add auto-detect option for source languages
                if (selectId.includes('source')) {
                    const autoOption = document.createElement('option');
                    autoOption.value = 'auto';
                    autoOption.textContent = 'Auto-detect';
                    select.appendChild(autoOption);
                }

                // Add all languages
                this.languageOptions.forEach(lang => {
                    const option = document.createElement('option');
                    option.value = lang.code;
                    option.textContent = `${lang.nativeName} (${lang.region})`;

                    if (selectId === 'speech-target-lang' && lang.code === 'en') {
                        option.selected = true;
                    }

                    if (selectId === 'ocr-language' && lang.code === 'eng') {
                        option.selected = true;
                    }

                    select.appendChild(option);
                });
            }
        });
    }

    /**
     * Select language
     */
    selectLanguage(langCode) {
        if (window.unifiedI18n) {
            window.unifiedI18n.setLanguage(langCode);
        } else if (window.changeLanguage) {
            window.changeLanguage(langCode);
        }

        this.updateLanguageSelection(langCode);
        this.panel.classList.add('hidden');

        console.info(`🌍 Language changed to: ${langCode}`);
    }

    /**
     * Update language selection UI
     */
    updateLanguageSelection(langCode) {
        // Update active state in language options
        const buttons = this.languageOptionsContainer?.querySelectorAll('.lang-btn');
        if (buttons) {
            buttons.forEach(button => {
                if (button.dataset.lang === langCode) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            });
        }

        // Update feature selects
        this.updateFeatureSelects(langCode);
    }

    /**
     * Update feature selects
     */
    updateFeatureSelects(langCode) {
        const selects = ['speech-target-lang', 'ocr-language'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                const option = select.querySelector(`option[value="${langCode}"]`);
                if (option) {
                    option.selected = true;
                }
            }
        });
    }

    /**
     * Update tab-specific content
     */
    updateTabContent(tabName) {
        switch (tabName) {
            case 'languages':
                this.updateLanguagesTab();
                break;
            case 'speech':
                this.updateSpeechTab();
                break;
            case 'ocr':
                this.updateOCRTab();
                break;
            case 'conference':
                this.updateConferenceTab();
                break;
            case 'cultural':
                this.updateCulturalTab();
                break;
            case 'advanced':
                this.updateAdvancedTab();
                break;
        }
    }

    /**
     * Setup advanced search functionality
     */
    setupAdvancedSearch() {
        if (!this.languageManager) return;

        // Get DOM elements
        this.searchInput = document.getElementById('language-search');
        this.categoryFilter = document.getElementById('language-category-filter');
        this.sortFilter = document.getElementById('language-sort');
        this.languageGrid = document.getElementById('language-options');
        this.languageStats = document.getElementById('language-stats');

        // Setup search event listeners
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value;
                this.performSearch();
            });
        }

        if (this.categoryFilter) {
            this.categoryFilter.addEventListener('change', () => {
                this.performSearch();
            });
        }

        if (this.sortFilter) {
            this.sortFilter.addEventListener('change', () => {
                this.performSearch();
            });
        }

        // Initial search
        this.performSearch();

        console.info('🔍 Advanced search functionality setup complete');
    }

    /**
     * Setup Ultra tab functionality
     */
    setupUltraTab() {
        const ultraToggle = document.getElementById('ultra-fast-toggle');
        const ultraQuality = document.getElementById('ultra-quality');

        if (ultraToggle) {
            ultraToggle.addEventListener('change', (e) => {
                this.toggleUltraMode(e.target.checked);
            });
        }

        if (ultraQuality) {
            ultraQuality.addEventListener('change', (e) => {
                this.changeUltraQuality(e.target.value);
            });
        }

        // Update Ultra metrics periodically
        setInterval(() => {
            this.updateUltraMetrics();
        }, 2000);

        console.info('🚀 Ultra tab functionality setup complete');
    }

    /**
     * Perform advanced language search
     */
    performSearch() {
        if (!this.languageManager) return;

        const options = {
            category: this.categoryFilter?.value || '',
            limit: 50,
            sortBy: this.sortFilter?.value || 'popularity'
        };

        let results;
        if (this.searchTerm && this.searchTerm.length > 0) {
            results = this.languageManager.searchLanguages(this.searchTerm, options);
        } else {
            results = this.languageManager.getLanguagesByCategory(options.category, options.limit, options.sortBy);
        }

        this.currentSearchResults = results;
        this.renderLanguageOptions(results);
        this.updateLanguageStats(results);
    }

    /**
     * Render language options with enhanced features
     */
    renderLanguageOptions(languages) {
        if (!this.languageGrid) return;

        this.languageGrid.innerHTML = '';

        if (languages.length === 0) {
            this.languageGrid.innerHTML = '<div class="no-results">No languages found</div>';
            return;
        }

        languages.forEach(lang => {
            const option = this.createLanguageOption(lang);
            this.languageGrid.appendChild(option);
        });

        console.info(`🌍 Rendered ${languages.length} language options`);
    }

    /**
     * Create enhanced language option element
     */
    createLanguageOption(lang) {
        const option = document.createElement('div');
        option.className = 'language-option';
        option.dataset.code = lang.code;

        // Check if favorite
        if (this.languageManager?.favoriteLanguages.has(lang.code)) {
            option.classList.add('favorite');
        }

        // Check if currently selected
        if (window.unifiedI18n?.currentLanguage === lang.code) {
            option.classList.add('selected');
        }

        option.innerHTML = `
            <div class="language-flag">${lang.metadata.flag || '🌐'}</div>
            <div class="language-name">${lang.metadata.name}</div>
            <div class="language-native">${lang.metadata.nativeName}</div>
            <div class="language-code">${lang.code}</div>
        `;

        // Add click handler
        option.addEventListener('click', () => {
            this.selectLanguage(lang.code);
        });

        // Add right-click handler for favorites
        option.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.toggleFavorite(lang.code);
        });

        return option;
    }

    /**
     * Update language statistics
     */
    updateLanguageStats(results) {
        if (!this.languageStats) return;

        const totalCount = results.length;
        const uniqueCategories = new Set(results.map(r => r.category)).size;
        const popularCount = results.filter(r => r.popularity > 50).length;

        // Update stat badges
        const totalElement = this.languageStats.querySelector('#total-languages');
        const activeElement = this.languageStats.querySelector('#active-languages');
        const recentElement = this.languageStats.querySelector('#recent-languages');
        const favoriteElement = this.languageStats.querySelector('#favorite-languages');

        if (totalElement) totalElement.textContent = `${totalCount}+`;
        if (activeElement) activeElement.textContent = this.languageManager ? Object.keys(window.unifiedI18n.supportedLanguages).length : '120';
        if (recentElement) recentElement.textContent = this.languageManager ? this.languageManager.recentLanguages.length : '0';
        if (favoriteElement) favoriteElement.textContent = this.languageManager ? this.languageManager.favoriteLanguages.size : '0';
    }

    /**
     * Toggle Ultra mode
     */
    toggleUltraMode(enabled) {
        if (window.ultraFastTranslator) {
            // Update ultra translator state
            console.info(`🚀 Ultra mode ${enabled ? 'enabled' : 'disabled'}`);

            // Update UI
            const status = enabled ? 'enabled' : 'disabled';
            this.showNotification(`Ultra-fast mode ${status}`, enabled ? 'success' : 'info');
        }
    }

    /**
     * Change Ultra quality setting
     */
    changeUltraQuality(quality) {
        if (window.ultraFastTranslator) {
            console.info(`⚙️ Ultra quality changed to: ${quality}`);

            // Update quality settings
            this.showNotification(`Ultra quality set to ${quality}`, 'info');
        }
    }

    /**
     * Update Ultra metrics display
     */
    updateUltraMetrics() {
        if (!window.ultraFastTranslator) return;

        const stats = window.ultraFastTranslator.getUltraStats();

        // Update response time
        const responseElement = document.getElementById('ultra-response-time');
        if (responseElement) {
            responseElement.textContent = `${stats.responseTime.toFixed(3)}s`;
        }

        // Update accuracy
        const accuracyElement = document.getElementById('ultra-accuracy');
        if (accuracyElement) {
            accuracyElement.textContent = `${(stats.accuracy * 100).toFixed(1)}%`;
        }

        // Update translations count
        const translationsElement = document.getElementById('ultra-translations');
        if (translationsElement) {
            translationsElement.textContent = stats.performance.ultraTranslations.toString();
        }
    }

    /**
     * Select language with enhanced tracking
     */
    async selectLanguage(languageCode) {
        try {
            // Track usage
            if (this.languageManager) {
                this.languageManager.trackLanguageUsage(languageCode);
            }

            // Set language in unified system
            if (window.unifiedI18n) {
                await window.unifiedI18n.setLanguage(languageCode);
            }

            // Update UI
            this.updateSelectedLanguage(languageCode);

            // Close panel after selection
            setTimeout(() => {
                this.close();
            }, 500);

            console.info(`🌍 Language selected: ${languageCode}`);

        } catch (error) {
            console.error('❌ Failed to select language:', error);
            this.showNotification('Failed to change language', 'error');
        }
    }

    /**
     * Toggle favorite language
     */
    toggleFavorite(languageCode) {
        if (!this.languageManager) return;

        const isFavorite = this.languageManager.favoriteLanguages.has(languageCode);

        if (isFavorite) {
            this.languageManager.removeFromFavorites(languageCode);
            this.showNotification('Removed from favorites', 'info');
        } else {
            this.languageManager.addToFavorites(languageCode);
            this.showNotification('Added to favorites', 'info');
        }

        // Update UI
        this.performSearch();
    }

    /**
     * Update selected language in UI
     */
    updateSelectedLanguage(languageCode) {
        // Remove selected class from all options
        const options = this.languageGrid?.querySelectorAll('.language-option');
        if (options) {
            options.forEach(option => option.classList.remove('selected'));
        }

        // Add selected class to current language
        const selectedOption = this.languageGrid?.querySelector(`[data-code="${languageCode}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#de350b' : type === 'success' ? '#00875a' : '#0065ff'};
            color: white;
            padding: 12px 16px;
            border-radius: 4px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Update speech tab
     */
    updateSpeechTab() {
        // Update speech status and options
        this.updateSpeechStatus();
        this.populateFeatureSelects();
    }

    /**
     * Update OCR tab
     */
    updateOCRTab() {
        // Update OCR status and options
        this.updateOCRStatus();
        this.populateFeatureSelects();
    }

    /**
     * Update conference tab
     */
    updateConferenceTab() {
        // Update conference status and platform detection
        this.updateConferenceStatus();
        this.updatePlatformDetection();
    }

    /**
     * Update cultural tab
     */
    updateCulturalTab() {
        // Update cultural adaptation status
        this.updateCulturalStatus();
    }

    /**
     * Update advanced tab
     */
    updateAdvancedTab() {
        // Update system statistics
        this.updateSystemStats();
    }

    /**
     * Toggle speech translation
     */
    async toggleSpeechTranslation() {
        try {
            if (window.advancedMultimodalTranslator) {
                this.updateSpeechStatus('loading');

                if (window.advancedMultimodalTranslator.speechRecognition?.instance) {
                    window.advancedMultimodalTranslator.stopSpeechTranslation();
                } else {
                    const sourceLang = document.getElementById('speech-source-lang')?.value || 'auto';
                    const targetLang = document.getElementById('speech-target-lang')?.value || 'en';
                    await window.advancedMultimodalTranslator.startSpeechTranslation(sourceLang, targetLang);
                }
            } else {
                console.warn('⚠️ Multimodal translator not available');
                this.updateSpeechStatus('unavailable');
            }
        } catch (error) {
            console.error('❌ Speech translation toggle failed:', error);
            this.updateSpeechStatus('error', error);
        }
    }

    /**
     * Toggle OCR mode
     */
    toggleOCRMode() {
        if (window.enhancedOCRTranslator) {
            window.enhancedOCRTranslator.toggleOCRMode();
        } else {
            console.warn('⚠️ OCR translator not available');
            this.updateOCRStatus('unavailable');
        }
    }

    /**
     * Start conference mode
     */
    async startConferenceMode() {
        try {
            if (window.realTimeConferenceTranslator) {
                this.updateConferenceStatus('loading');

                const options = {
                    enableSubtitles: document.getElementById('subtitles-toggle')?.checked || true,
                    enableAudioTranslation: true,
                    enableChatTranslation: true
                };

                await window.realTimeConferenceTranslator.startConferenceSession(options);
            } else {
                console.warn('⚠️ Conference translator not available');
                this.updateConferenceStatus('unavailable');
            }
        } catch (error) {
            console.error('❌ Conference mode start failed:', error);
            this.updateConferenceStatus('error', error);
        }
    }

    /**
     * End conference mode
     */
    endConferenceMode() {
        if (window.realTimeConferenceTranslator) {
            window.realTimeConferenceTranslator.endConferenceSession();
        } else {
            console.warn('⚠️ Conference translator not available');
        }
    }

    /**
     * Toggle cultural adaptation
     */
    toggleCulturalAdaptation(enabled) {
        if (window.culturalAdaptationEngine) {
            console.info(`🌍 Cultural adaptation ${enabled ? 'enabled' : 'disabled'}`);
        } else {
            console.warn('⚠️ Cultural adaptation engine not available');
        }
    }

    /**
     * Update speech status
     */
    updateSpeechStatus(status = 'inactive', error = null) {
        const statusElement = document.getElementById('speech-status');
        if (!statusElement) return;

        statusElement.dataset.status = status;
        statusElement.className = 'feature-status';

        switch (status) {
            case 'active':
                statusElement.textContent = 'Active';
                statusElement.dataset.status = 'active';
                break;
            case 'loading':
                statusElement.textContent = 'Starting...';
                statusElement.dataset.status = 'loading';
                break;
            case 'error':
                statusElement.textContent = `Error: ${error?.message || 'Unknown error'}`;
                break;
            case 'unavailable':
                statusElement.textContent = 'Not available';
                break;
            default:
                statusElement.textContent = 'Not active';
        }

        // Update button text
        const button = document.getElementById('speech-toggle');
        if (button) {
            if (status === 'active') {
                button.textContent = 'Stop Speech Translation';
                button.classList.add('secondary');
            } else {
                button.textContent = 'Start Speech Translation';
                button.classList.remove('secondary');
            }
        }
    }

    /**
     * Update OCR status
     */
    updateOCRStatus(status = 'disabled') {
        const statusElement = document.getElementById('ocr-status');
        if (!statusElement) return;

        statusElement.dataset.status = status;
        statusElement.className = 'feature-status';

        switch (status) {
            case 'ready':
                statusElement.textContent = 'Ready';
                statusElement.dataset.status = 'active';
                break;
            case 'enabled':
                statusElement.textContent = 'Enabled - Click images to translate';
                statusElement.dataset.status = 'active';
                break;
            case 'disabled':
                statusElement.textContent = 'Disabled';
                break;
            case 'unavailable':
                statusElement.textContent = 'Not available';
                break;
            default:
                statusElement.textContent = 'Disabled';
        }

        // Update button text
        const button = document.getElementById('ocr-toggle');
        if (button) {
            if (status === 'enabled') {
                button.textContent = 'Disable OCR Mode';
                button.classList.add('secondary');
            } else {
                button.textContent = 'Enable OCR Mode';
                button.classList.remove('secondary');
            }
        }
    }

    /**
     * Update conference status
     */
    updateConferenceStatus(status = 'inactive', data = null) {
        const statusElement = document.getElementById('conference-status');
        if (!statusElement) return;

        statusElement.dataset.status = status;
        statusElement.className = 'feature-status';

        switch (status) {
            case 'active':
                statusElement.textContent = `Active (${data?.platform || 'generic'})`;
                statusElement.dataset.status = 'active';
                break;
            case 'loading':
                statusElement.textContent = 'Starting...';
                statusElement.dataset.status = 'loading';
                break;
            case 'error':
                statusElement.textContent = `Error: ${data?.message || 'Unknown error'}`;
                break;
            case 'unavailable':
                statusElement.textContent = 'Not available';
                break;
            default:
                statusElement.textContent = 'Not active';
        }

        // Update button visibility
        const startButton = document.getElementById('conference-start');
        const endButton = document.getElementById('conference-end');

        if (startButton && endButton) {
            if (status === 'active') {
                startButton.style.display = 'none';
                endButton.style.display = 'inline-flex';
            } else {
                startButton.style.display = 'inline-flex';
                endButton.style.display = 'none';
            }
        }
    }

    /**
     * Update platform detection
     */
    updatePlatformDetection() {
        const detectionElement = document.getElementById('platform-detection');
        if (!detectionElement) return;

        const currentUrl = window.location.hostname;

        // Detect common conference platforms
        const platforms = {
            'zoom.us': 'Zoom',
            'teams.microsoft.com': 'Microsoft Teams',
            'meet.google.com': 'Google Meet',
            'webex.com': 'Cisco Webex',
            'discord.com': 'Discord',
            'skype.com': 'Skype'
        };

        let detectedPlatform = 'Generic';
        for (const [domain, name] of Object.entries(platforms)) {
            if (currentUrl.includes(domain)) {
                detectedPlatform = name;
                break;
            }
        }

        detectionElement.textContent = detectedPlatform;
    }

    /**
     * Update cultural status
     */
    updateCulturalStatus(status = 'ready') {
        const toggle = document.getElementById('cultural-adaptation-toggle');
        if (toggle) {
            toggle.checked = status === 'ready';
        }
    }

    /**
     * Update system statistics
     */
    updateSystemStats() {
        // Update language count
        const langElement = document.getElementById('stat-languages');
        if (langElement) {
            langElement.textContent = this.languageOptions.length;
        }

        // Update translation count
        const transElement = document.getElementById('stat-translations');
        if (transElement && window.advancedTranslationHub) {
            const stats = window.advancedTranslationHub.getComprehensiveStats();
            transElement.textContent = stats.performance?.totalTranslations || 0;
        }

        // Update response time
        const responseElement = document.getElementById('stat-response');
        if (responseElement && window.advancedTranslationHub) {
            const stats = window.advancedTranslationHub.getComprehensiveStats();
            responseElement.textContent = `${Math.round(stats.performance?.averageResponseTime || 0)}ms`;
        }

        // Update quality indicator
        const qualityFill = document.getElementById('quality-fill');
        const qualityText = document.getElementById('quality-text');
        if (qualityFill && qualityText && window.enhancedAITranslationImprover) {
            const quality = window.enhancedAITranslationImprover.getQualityStats();
            const qualityPercentage = Math.round((quality.averageQuality || 0.5) * 100);
            qualityFill.style.width = `${qualityPercentage}%`;
            qualityText.textContent = `Quality: ${qualityPercentage}%`;
        }
    }

    /**
     * Show translation dashboard
     */
    showTranslationDashboard() {
        if (window.showTranslationDashboard) {
            window.showTranslationDashboard();
        } else {
            console.warn('⚠️ Translation dashboard not available');
        }
    }

    /**
     * Show feature toggles
     */
    showFeatureToggles() {
        if (window.showFeatureToggles) {
            window.showFeatureToggles();
        } else {
            console.warn('⚠️ Feature toggles not available');
        }
    }

    /**
     * Export translation data
     */
    exportTranslationData() {
        try {
            const data = {
                languageOptions: this.languageOptions,
                currentLanguage: window.unifiedI18n?.currentLanguage || 'en',
                systemStats: this.getAvailableFeatures(),
                timestamp: new Date().toISOString()
            };

            if (window.enhancedAITranslationImprover) {
                data.aiStats = window.enhancedAITranslationImprover.getQualityStats();
            }

            if (window.advancedTranslationHub) {
                data.hubStats = window.advancedTranslationHub.getComprehensiveStats();
            }

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `translation-data-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);

            console.info('💾 Translation data exported');
        } catch (error) {
            console.error('❌ Export failed:', error);
        }
    }

    /**
     * Get available features
     */
    getAvailableFeatures() {
        return {
            speech: this.systemsReady.has('multimodal'),
            ocr: this.systemsReady.has('ocr'),
            conference: this.systemsReady.has('conference'),
            cultural: this.systemsReady.has('cultural'),
            advanced: this.systemsReady.has('hub'),
            basic: !!window.unifiedI18n,
            aiImprovement: !!window.enhancedAITranslationImprover
        };
    }

    /**
     * Show panel
     */
    show() {
        if (this.panel) {
            this.panel.classList.remove('hidden');
            this.updateTabContent(this.currentTab);
        }
    }

    /**
     * Hide panel
     */
    hide() {
        if (this.panel) {
            this.panel.classList.add('hidden');
        }
    }

    /**
     * Event system
     */
    emit(event, data) {
        document.dispatchEvent(new CustomEvent(`languagePanel:${event}`, { detail: data }));
    }

    /**
     * Add event listener
     */
    on(event, callback) {
        document.addEventListener(`languagePanel:${event}`, callback);
    }
}

// Initialize Enhanced Language Panel
window.enhancedLanguagePanel = new EnhancedLanguagePanel();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await window.enhancedLanguagePanel.initialize();

    // Override language button to use enhanced panel
    const languageButton = document.getElementById('language-btn');
    if (languageButton) {
        languageButton.addEventListener('click', () => {
            window.enhancedLanguagePanel.show();
        });
    }

    console.info('🖥️ Enhanced Language Panel ready');
});

// Export for modules
export default EnhancedLanguagePanel;
