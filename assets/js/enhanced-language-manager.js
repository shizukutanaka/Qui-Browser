/**
 * Enhanced Language Selection and Management System for Qui Browser VR
 * Advanced language filtering, categorization, and selection with ultra-fast search
 * @version 1.0.0 - Advanced Language Management
 */

class EnhancedLanguageManager {
    constructor() {
        this.languageCategories = new Map();
        this.languageSearchIndex = new Map();
        this.recentLanguages = [];
        this.favoriteLanguages = new Set();
        this.languageUsageStats = new Map();
        this.ultraFastSearch = null;
        this.isInitialized = false;
    }

    /**
     * Initialize enhanced language manager
     */
    async initialize() {
        console.info('🌍 Initializing Enhanced Language Manager...');

        try {
            // Setup language categories
            this.setupLanguageCategories();

            // Build search index
            await this.buildSearchIndex();

            // Load user preferences
            await this.loadUserPreferences();

            // Setup ultra-fast search
            this.setupUltraFastSearch();

            // Initialize usage tracking
            this.initializeUsageTracking();

            this.isInitialized = true;

            console.info('✅ Enhanced Language Manager initialized successfully');

            this.emit('languageManagerReady', {
                categories: this.languageCategories.size,
                searchIndex: this.languageSearchIndex.size,
                favorites: this.favoriteLanguages.size,
                recents: this.recentLanguages.length
            });

        } catch (error) {
            console.error('❌ Language manager initialization failed:', error);
            this.emit('languageManagerError', error);
        }
    }

    /**
     * Setup language categories for better organization
     */
    setupLanguageCategories() {
        this.languageCategories.set('primary', {
            name: '主要言語',
            description: '最も使用される主要言語',
            languages: ['en', 'ja', 'ko', 'zh', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ar', 'hi'],
            priority: 1
        });

        this.languageCategories.set('regional', {
            name: '地域バリエーション',
            description: '主要言語の地域差異',
            languages: ['en-US', 'en-GB', 'zh-CN', 'zh-TW', 'es-ES', 'es-MX', 'fr-CA', 'pt-BR', 'de-DE', 'de-AT', 'ru-RU'],
            priority: 2
        });

        this.languageCategories.set('asian', {
            name: 'アジア言語',
            description: 'アジア地域の言語',
            languages: ['th', 'vi', 'id', 'ms', 'ta', 'te', 'kn', 'ml', 'pa', 'bn', 'ur', 'fa', 'he', 'tr', 'my', 'km', 'lo', 'mn', 'kk', 'uz'],
            priority: 3
        });

        this.languageCategories.set('european', {
            name: 'ヨーロッパ言語',
            description: 'ヨーロッパ地域の言語',
            languages: ['nl', 'sv', 'da', 'no', 'fi', 'pl', 'cs', 'sk', 'hu', 'ro', 'bg', 'hr', 'sr', 'sl', 'et', 'lv', 'lt', 'mt', 'ga', 'cy', 'is', 'eu', 'gl', 'ca'],
            priority: 4
        });

        this.languageCategories.set('emerging', {
            name: '新興言語',
            description: '発展途上地域の言語',
            languages: ['sw', 'am', 'ha', 'yo', 'zu', 'af', 'xh', 'pcm', 'ff', 'so', 'mg', 'ig', 'om', 'ak', 'tw', 'ee', 'gaa', 'dag', 'ceb', 'ilo', 'war', 'pam', 'bik', 'min', 'bug', 'mad', 'su', 'bal', 'tet', 'pap'],
            priority: 5
        });

        this.languageCategories.set('indigenous', {
            name: '先住民言語',
            description: '先住民・少数民族の言語',
            languages: ['qu', 'ay', 'gn', 'na', 'sm', 'to', 'mi', 'haw', 'ht', 'srn', 'jam', 'gon', 'sat', 'mni', 'bho', 'mai', 'awa', 'mag', 'bgc', 'hne', 'doi'],
            priority: 6
        });

        this.languageCategories.set('constructed', {
            name: '人工言語',
            description: '人工的に作成された言語',
            languages: ['eo', 'ia', 'vo', 'tok', 'ldn'],
            priority: 7
        });

        this.languageCategories.set('ultra-emerging', {
            name: '超新興言語',
            description: '極めて新しい・希少な言語',
            languages: ['tpi', 'bi', 'ch', 'mh', 'pal'],
            priority: 8
        });

        console.info(`📚 Setup ${this.languageCategories.size} language categories`);
    }

    /**
     * Build ultra-fast search index
     */
    async buildSearchIndex() {
        console.info('🔍 Building ultra-fast search index...');

        if (window.unifiedI18n) {
            const languages = window.unifiedI18n.supportedLanguages;

            for (const [code, info] of Object.entries(languages)) {
                // Create searchable terms
                const searchTerms = [
                    info.name.toLowerCase(),
                    info.nativeName.toLowerCase(),
                    code.toLowerCase(),
                    info.region.toLowerCase(),
                    ...this.extractKeywordsFromName(info.name),
                    ...this.extractKeywordsFromName(info.nativeName)
                ];

                // Add to search index
                searchTerms.forEach(term => {
                    if (!this.languageSearchIndex.has(term)) {
                        this.languageSearchIndex.set(term, new Set());
                    }
                    this.languageSearchIndex.get(term).add(code);
                });

                // Store language metadata
                this.languageMetadata.set(code, {
                    ...info,
                    searchTerms,
                    category: this.getLanguageCategory(code),
                    popularity: this.calculatePopularity(code),
                    lastUsed: null,
                    useCount: 0
                });
            }
        }

        console.info(`🔍 Search index built for ${this.languageSearchIndex.size} terms`);
    }

    /**
     * Extract keywords from language name
     */
    extractKeywordsFromName(name) {
        return name.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2);
    }

    /**
     * Get language category
     */
    getLanguageCategory(languageCode) {
        for (const [categoryName, category] of this.languageCategories) {
            if (category.languages.includes(languageCode)) {
                return categoryName;
            }
        }
        return 'other';
    }

    /**
     * Calculate language popularity
     */
    calculatePopularity(languageCode) {
        const popularityMap = {
            'en': 100, 'en-US': 95, 'en-GB': 85,
            'zh': 90, 'zh-CN': 85, 'zh-TW': 75,
            'es': 85, 'es-ES': 80, 'es-MX': 75,
            'ja': 80, 'ko': 75, 'fr': 70, 'de': 70,
            'hi': 65, 'ar': 60, 'pt': 55, 'ru': 55,
            'it': 50, 'th': 45, 'vi': 40, 'id': 35
        };

        return popularityMap[languageCode] || 20;
    }

    /**
     * Ultra-fast language search
     */
    searchLanguages(query, options = {}) {
        const {
            category = null,
            limit = 20,
            includeNativeNames = true,
            sortBy = 'popularity'
        } = options;

        if (!query || query.length < 1) {
            return this.getLanguagesByCategory(category, limit, sortBy);
        }

        const startTime = performance.now();
        const results = new Map();

        // Ultra-fast search using index
        const searchTerms = query.toLowerCase().split(/\s+/);

        searchTerms.forEach(term => {
            if (this.languageSearchIndex.has(term)) {
                this.languageSearchIndex.get(term).forEach(langCode => {
                    if (!results.has(langCode)) {
                        results.set(langCode, {
                            code: langCode,
                            score: 0,
                            matches: []
                        });
                    }

                    const result = results.get(langCode);
                    result.score += 10; // Base score for match
                    result.matches.push(term);
                });
            }
        });

        // Apply category filter
        if (category) {
            const categoryLanguages = this.languageCategories.get(category)?.languages || [];
            for (const langCode of results.keys()) {
                if (!categoryLanguages.includes(langCode)) {
                    results.delete(langCode);
                }
            }
        }

        // Sort and limit results
        const sortedResults = Array.from(results.values())
            .sort((a, b) => {
                switch (sortBy) {
                    case 'popularity':
                        const popA = this.calculatePopularity(a.code);
                        const popB = this.calculatePopularity(b.code);
                        return popB - popA;
                    case 'alphabetical':
                        return a.code.localeCompare(b.code);
                    case 'relevance':
                        return b.score - a.score;
                    default:
                        return b.score - a.score;
                }
            })
            .slice(0, limit);

        const endTime = performance.now();
        console.info(`⚡ Ultra-fast search completed in ${(endTime - startTime).toFixed(3)}ms`);

        return sortedResults.map(result => ({
            ...result,
            metadata: this.languageMetadata.get(result.code),
            searchTime: endTime - startTime
        }));
    }

    /**
     * Get languages by category
     */
    getLanguagesByCategory(category, limit = 50, sortBy = 'popularity') {
        if (!category || !this.languageCategories.has(category)) {
            return this.getAllLanguages(limit, sortBy);
        }

        const categoryData = this.languageCategories.get(category);
        const languages = categoryData.languages.slice(0, limit);

        return languages.map(code => ({
            code,
            metadata: this.languageMetadata.get(code),
            category: category,
            popularity: this.calculatePopularity(code)
        })).sort((a, b) => {
            switch (sortBy) {
                case 'popularity':
                    return b.popularity - a.popularity;
                case 'alphabetical':
                    return a.code.localeCompare(b.code);
                default:
                    return b.popularity - a.popularity;
            }
        });
    }

    /**
     * Get all languages with metadata
     */
    getAllLanguages(limit = 100, sortBy = 'popularity') {
        if (!window.unifiedI18n) return [];

        const languages = Object.keys(window.unifiedI18n.supportedLanguages)
            .slice(0, limit)
            .map(code => ({
                code,
                metadata: window.unifiedI18n.supportedLanguages[code],
                category: this.getLanguageCategory(code),
                popularity: this.calculatePopularity(code),
                lastUsed: this.languageUsageStats.get(code)?.lastUsed || null,
                useCount: this.languageUsageStats.get(code)?.count || 0
            }));

        return languages.sort((a, b) => {
            switch (sortBy) {
                case 'popularity':
                    return b.popularity - a.popularity;
                case 'alphabetical':
                    return a.code.localeCompare(b.code);
                case 'recent':
                    if (a.lastUsed && b.lastUsed) return b.lastUsed - a.lastUsed;
                    return a.lastUsed ? -1 : 1;
                case 'usage':
                    return b.useCount - a.useCount;
                default:
                    return b.popularity - a.popularity;
            }
        });
    }

    /**
     * Add language to favorites
     */
    addToFavorites(languageCode) {
        this.favoriteLanguages.add(languageCode);
        this.saveFavorites();
        this.emit('languageFavorited', { languageCode });
    }

    /**
     * Remove language from favorites
     */
    removeFromFavorites(languageCode) {
        this.favoriteLanguages.delete(languageCode);
        this.saveFavorites();
        this.emit('languageUnfavorited', { languageCode });
    }

    /**
     * Track language usage
     */
    trackLanguageUsage(languageCode) {
        const now = Date.now();

        if (!this.languageUsageStats.has(languageCode)) {
            this.languageUsageStats.set(languageCode, {
                firstUsed: now,
                lastUsed: now,
                count: 0
            });
        }

        const stats = this.languageUsageStats.get(languageCode);
        stats.lastUsed = now;
        stats.count++;

        // Update recent languages
        this.updateRecentLanguages(languageCode);

        // Save to localStorage
        this.saveUsageStats();

        this.emit('languageUsed', {
            languageCode,
            stats: stats,
            timestamp: now
        });
    }

    /**
     * Update recent languages
     */
    updateRecentLanguages(languageCode) {
        // Remove if already exists
        this.recentLanguages = this.recentLanguages.filter(lang => lang !== languageCode);

        // Add to beginning
        this.recentLanguages.unshift(languageCode);

        // Limit to 10 recent languages
        if (this.recentLanguages.length > 10) {
            this.recentLanguages = this.recentLanguages.slice(0, 10);
        }

        localStorage.setItem('recent_languages', JSON.stringify(this.recentLanguages));
    }

    /**
     * Setup ultra-fast search with advanced algorithms
     */
    setupUltraFastSearch() {
        this.ultraFastSearch = {
            enabled: true,
            algorithms: ['exact', 'fuzzy', 'phonetic', 'semantic'],
            cache: new Map(),
            search: async (query, options) => {
                return await this.ultraFastSearchImplementation(query, options);
            }
        };

        console.info('🔍 Ultra-fast search algorithms setup');
    }

    /**
     * Ultra-fast search implementation
     */
    async ultraFastSearchImplementation(query, options) {
        const cacheKey = `${query}-${JSON.stringify(options)}`;

        // Check cache first
        if (this.ultraFastSearch.cache.has(cacheKey)) {
            return this.ultraFastSearch.cache.get(cacheKey);
        }

        const startTime = performance.now();
        let results = [];

        // Try different search algorithms
        for (const algorithm of this.ultraFastSearch.algorithms) {
            const algorithmResults = await this.applySearchAlgorithm(query, algorithm, options);
            results = results.concat(algorithmResults);
        }

        // Remove duplicates and sort
        const uniqueResults = this.deduplicateResults(results);
        const sortedResults = this.sortSearchResults(uniqueResults, options);

        const endTime = performance.now();
        const searchTime = endTime - startTime;

        const finalResults = {
            results: sortedResults.slice(0, options.limit || 20),
            searchTime,
            algorithms: this.ultraFastSearch.algorithms,
            totalMatches: uniqueResults.length
        };

        // Cache results
        this.ultraFastSearch.cache.set(cacheKey, finalResults);

        // Limit cache size
        if (this.ultraFastSearch.cache.size > 100) {
            const firstKey = this.ultraFastSearch.cache.keys().next().value;
            this.ultraFastSearch.cache.delete(firstKey);
        }

        return finalResults;
    }

    /**
     * Apply search algorithm
     */
    async applySearchAlgorithm(query, algorithm, options) {
        switch (algorithm) {
            case 'exact':
                return this.exactSearch(query, options);
            case 'fuzzy':
                return this.fuzzySearch(query, options);
            case 'phonetic':
                return this.phoneticSearch(query, options);
            case 'semantic':
                return this.semanticSearch(query, options);
            default:
                return [];
        }
    }

    /**
     * Exact search implementation
     */
    exactSearch(query, options) {
        const results = [];
        const queryLower = query.toLowerCase();

        this.languageSearchIndex.forEach((languages, term) => {
            if (term.includes(queryLower) || queryLower.includes(term)) {
                languages.forEach(langCode => {
                    if (this.matchesFilters(langCode, options)) {
                        results.push({
                            code: langCode,
                            algorithm: 'exact',
                            score: 100,
                            match: term
                        });
                    }
                });
            }
        });

        return results;
    }

    /**
     * Fuzzy search implementation
     */
    fuzzySearch(query, options) {
        const results = [];
        const queryLower = query.toLowerCase();

        this.languageSearchIndex.forEach((languages, term) => {
            const similarity = this.calculateStringSimilarity(queryLower, term);
            if (similarity > 0.6) { // 60% similarity threshold
                languages.forEach(langCode => {
                    if (this.matchesFilters(langCode, options)) {
                        results.push({
                            code: langCode,
                            algorithm: 'fuzzy',
                            score: similarity * 100,
                            match: term
                        });
                    }
                });
            }
        });

        return results;
    }

    /**
     * Phonetic search implementation
     */
    phoneticSearch(query, options) {
        const results = [];
        const phoneticQuery = this.getPhoneticRepresentation(query);

        this.languageSearchIndex.forEach((languages, term) => {
            const phoneticTerm = this.getPhoneticRepresentation(term);
            const similarity = this.calculateStringSimilarity(phoneticQuery, phoneticTerm);

            if (similarity > 0.7) {
                languages.forEach(langCode => {
                    if (this.matchesFilters(langCode, options)) {
                        results.push({
                            code: langCode,
                            algorithm: 'phonetic',
                            score: similarity * 100,
                            match: term
                        });
                    }
                });
            }
        });

        return results;
    }

    /**
     * Semantic search implementation
     */
    semanticSearch(query, options) {
        const results = [];
        const semanticTerms = this.getSemanticTerms(query);

        semanticTerms.forEach(semanticTerm => {
            if (this.languageSearchIndex.has(semanticTerm)) {
                this.languageSearchIndex.get(semanticTerm).forEach(langCode => {
                    if (this.matchesFilters(langCode, options)) {
                        results.push({
                            code: langCode,
                            algorithm: 'semantic',
                            score: 90,
                            match: semanticTerm
                        });
                    }
                });
            }
        });

        return results;
    }

    /**
     * Calculate string similarity
     */
    calculateStringSimilarity(str1, str2) {
        if (str1 === str2) return 1;

        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) return 1;

        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Levenshtein distance calculation
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * Get phonetic representation
     */
    getPhoneticRepresentation(text) {
        // Simple phonetic representation
        return text.toLowerCase()
            .replace(/ph/g, 'f')
            .replace(/ck/g, 'k')
            .replace(/qu/g, 'kw')
            .replace(/x/g, 'ks')
            .replace(/[^a-z]/g, '');
    }

    /**
     * Get semantic terms
     */
    getSemanticTerms(query) {
        const semanticMap = {
            'asian': ['asia', 'oriental', 'eastern'],
            'european': ['europe', 'western'],
            'african': ['africa', 'subsaharan'],
            'american': ['americas', 'north america', 'south america'],
            'pacific': ['oceania', 'pacific islands'],
            'middle east': ['middle east', 'west asia'],
            'formal': ['formal', 'business', 'official'],
            'casual': ['casual', 'informal', 'colloquial'],
            'technical': ['technical', 'scientific', 'academic'],
            'common': ['common', 'popular', 'widely used']
        };

        const terms = [query.toLowerCase()];

        Object.entries(semanticMap).forEach(([key, synonyms]) => {
            if (query.toLowerCase().includes(key)) {
                terms.push(...synonyms);
            }
        });

        return terms;
    }

    /**
     * Check if language matches filters
     */
    matchesFilters(languageCode, options) {
        if (options.category) {
            const category = this.languageCategories.get(options.category);
            if (category && !category.languages.includes(languageCode)) {
                return false;
            }
        }

        if (options.region) {
            const metadata = this.languageMetadata.get(languageCode);
            if (metadata && metadata.region !== options.region) {
                return false;
            }
        }

        return true;
    }

    /**
     * Deduplicate search results
     */
    deduplicateResults(results) {
        const unique = new Map();

        results.forEach(result => {
            if (unique.has(result.code)) {
                // Keep the result with higher score
                if (result.score > unique.get(result.code).score) {
                    unique.set(result.code, result);
                }
            } else {
                unique.set(result.code, result);
            }
        });

        return Array.from(unique.values());
    }

    /**
     * Sort search results
     */
    sortSearchResults(results, options) {
        return results.sort((a, b) => {
            // Primary sort by score
            if (b.score !== a.score) {
                return b.score - a.score;
            }

            // Secondary sort by popularity
            const popA = this.calculatePopularity(a.code);
            const popB = this.calculatePopularity(b.code);
            return popB - popA;
        });
    }

    /**
     * Load user preferences
     */
    async loadUserPreferences() {
        try {
            // Load favorites
            const favorites = localStorage.getItem('favorite_languages');
            if (favorites) {
                this.favoriteLanguages = new Set(JSON.parse(favorites));
            }

            // Load recent languages
            const recents = localStorage.getItem('recent_languages');
            if (recents) {
                this.recentLanguages = JSON.parse(recents);
            }

            // Load usage stats
            const usageStats = localStorage.getItem('language_usage_stats');
            if (usageStats) {
                this.languageUsageStats = new Map(JSON.parse(usageStats));
            }

            console.info('📚 User preferences loaded');

        } catch (error) {
            console.warn('⚠️ Failed to load user preferences:', error);
        }
    }

    /**
     * Save favorites to localStorage
     */
    saveFavorites() {
        localStorage.setItem('favorite_languages', JSON.stringify(Array.from(this.favoriteLanguages)));
    }

    /**
     * Save usage statistics
     */
    saveUsageStats() {
        localStorage.setItem('language_usage_stats', JSON.stringify(Array.from(this.languageUsageStats.entries())));
    }

    /**
     * Initialize usage tracking
     */
    initializeUsageTracking() {
        // Track language changes
        if (window.unifiedI18n) {
            window.unifiedI18n.on('languageChanged', (data) => {
                this.trackLanguageUsage(data.current);
            });
        }

        // Track translation requests
        document.addEventListener('translationRequest', (event) => {
            const { sourceLang, targetLang } = event.detail;
            if (sourceLang) this.trackLanguageUsage(sourceLang);
            if (targetLang) this.trackLanguageUsage(targetLang);
        });

        console.info('📊 Usage tracking initialized');
    }

    /**
     * Get comprehensive language statistics
     */
    getStats() {
        return {
            isInitialized: this.isInitialized,
            categories: this.languageCategories.size,
            searchIndex: this.languageSearchIndex.size,
            totalLanguages: this.languageMetadata?.size || 0,
            favorites: this.favoriteLanguages.size,
            recent: this.recentLanguages.length,
            usageStats: this.languageUsageStats.size,
            ultraFastSearch: this.ultraFastSearch?.enabled || false,
            performance: this.getPerformanceStats()
        };
    }

    /**
     * Get performance statistics
     */
    getPerformanceStats() {
        const totalUsage = Array.from(this.languageUsageStats.values()).reduce((sum, stat) => sum + stat.count, 0);
        const averageUsage = this.languageUsageStats.size > 0 ? totalUsage / this.languageUsageStats.size : 0;

        return {
            totalUsage,
            uniqueLanguages: this.languageUsageStats.size,
            averageUsagePerLanguage: averageUsage,
            mostUsed: this.getMostUsedLanguage(),
            leastUsed: this.getLeastUsedLanguage()
        };
    }

    /**
     * Get most used language
     */
    getMostUsedLanguage() {
        let mostUsed = null;
        let maxCount = 0;

        this.languageUsageStats.forEach((stats, code) => {
            if (stats.count > maxCount) {
                maxCount = stats.count;
                mostUsed = { code, count: stats.count };
            }
        });

        return mostUsed;
    }

    /**
     * Get least used language
     */
    getLeastUsedLanguage() {
        let leastUsed = null;
        let minCount = Infinity;

        this.languageUsageStats.forEach((stats, code) => {
            if (stats.count < minCount) {
                minCount = stats.count;
                leastUsed = { code, count: stats.count };
            }
        });

        return leastUsed;
    }

    /**
     * Event system
     */
    emit(event, data) {
        document.dispatchEvent(new CustomEvent(`languageManager:${event}`, { detail: data }));
    }

    /**
     * Add event listener
     */
    on(event, callback) {
        document.addEventListener(`languageManager:${event}`, callback);
    }
}

// Initialize Enhanced Language Manager
window.enhancedLanguageManager = new EnhancedLanguageManager();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await window.enhancedLanguageManager.initialize();

    // Setup global functions
    window.searchLanguages = (query, options) =>
        window.enhancedLanguageManager.searchLanguages(query, options);

    window.getLanguageCategories = () =>
        Array.from(window.enhancedLanguageManager.languageCategories.entries());

    window.addLanguageToFavorites = (code) =>
        window.enhancedLanguageManager.addToFavorites(code);

    window.getLanguageStats = () =>
        window.enhancedLanguageManager.getStats();

    console.info('🌍 Enhanced Language Manager ready');
});

// Export for modules
export default EnhancedLanguageManager;
