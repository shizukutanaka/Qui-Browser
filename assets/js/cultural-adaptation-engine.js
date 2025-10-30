/**
 * Cultural Adaptation Engine for Qui Browser VR
 * Provides culturally aware translations and regional customization
 * @version 1.0.0 - Cultural Integration
 */

class CulturalAdaptationEngine {
    constructor() {
        this.culturalProfiles = new Map();
        this.regionalPreferences = new Map();
        this.translationMemories = new Map();
        this.culturalRules = new Map();
        this.formalityLevels = new Map();
        this.dateTimeFormats = new Map();
        this.numberFormats = new Map();
        this.addressFormats = new Map();
        this.isInitialized = false;
    }

    /**
     * Initialize cultural adaptation engine
     */
    async initialize() {
        console.info('🌍 Initializing Cultural Adaptation Engine...');

        try {
            // Load cultural profiles
            await this.loadCulturalProfiles();

            // Load regional preferences
            await this.loadRegionalPreferences();

            // Setup cultural rules
            this.setupCulturalRules();

            // Initialize translation memories
            this.initializeTranslationMemories();

            this.isInitialized = true;
            console.info('✅ Cultural Adaptation Engine initialized successfully');

            this.emit('culturalEngineReady', {
                profilesLoaded: this.culturalProfiles.size,
                regionsSupported: this.regionalPreferences.size,
                translationMemories: this.translationMemories.size
            });

        } catch (error) {
            console.error('❌ Failed to initialize cultural adaptation engine:', error);
            this.emit('culturalEngineError', error);
        }
    }

    /**
     * Load cultural profiles for different regions
     */
    async loadCulturalProfiles() {
        this.culturalProfiles.set('en-US', {
            formality: 'informal',
            directness: 'high',
            context: 'low',
            individualism: 'high',
            timeOrientation: 'monochronic',
            uncertaintyAvoidance: 'low',
            powerDistance: 'low',
            communicationStyle: 'direct',
            greetingStyle: 'casual',
            businessStyle: 'informal'
        });

        this.culturalProfiles.set('en-GB', {
            formality: 'semi-formal',
            directness: 'medium',
            context: 'medium',
            individualism: 'high',
            timeOrientation: 'monochronic',
            uncertaintyAvoidance: 'medium',
            powerDistance: 'medium',
            communicationStyle: 'diplomatic',
            greetingStyle: 'polite',
            businessStyle: 'formal'
        });

        this.culturalProfiles.set('ja', {
            formality: 'high',
            directness: 'low',
            context: 'high',
            individualism: 'low',
            timeOrientation: 'polychronic',
            uncertaintyAvoidance: 'high',
            powerDistance: 'high',
            communicationStyle: 'indirect',
            greetingStyle: 'honorific',
            businessStyle: 'very_formal'
        });

        this.culturalProfiles.set('ko', {
            formality: 'high',
            directness: 'medium',
            context: 'high',
            individualism: 'low',
            timeOrientation: 'polychronic',
            uncertaintyAvoidance: 'high',
            powerDistance: 'high',
            communicationStyle: 'hierarchical',
            greetingStyle: 'honorific',
            businessStyle: 'formal'
        });

        this.culturalProfiles.set('zh-CN', {
            formality: 'semi-formal',
            directness: 'medium',
            context: 'high',
            individualism: 'low',
            timeOrientation: 'polychronic',
            uncertaintyAvoidance: 'medium',
            powerDistance: 'high',
            communicationStyle: 'contextual',
            greetingStyle: 'polite',
            businessStyle: 'formal'
        });

        this.culturalProfiles.set('ar', {
            formality: 'high',
            directness: 'medium',
            context: 'high',
            individualism: 'low',
            timeOrientation: 'polychronic',
            uncertaintyAvoidance: 'high',
            powerDistance: 'high',
            communicationStyle: 'indirect',
            greetingStyle: 'ceremonial',
            businessStyle: 'formal'
        });

        this.culturalProfiles.set('hi', {
            formality: 'semi-formal',
            directness: 'medium',
            context: 'high',
            individualism: 'low',
            timeOrientation: 'polychronic',
            uncertaintyAvoidance: 'medium',
            powerDistance: 'high',
            communicationStyle: 'respectful',
            greetingStyle: 'traditional',
            businessStyle: 'formal'
        });

        console.info(`📚 Loaded ${this.culturalProfiles.size} cultural profiles`);
    }

    /**
     * Load regional preferences and customs
     */
    async loadRegionalPreferences() {
        // Date and time formats
        this.dateTimeFormats.set('en-US', {
            dateFormat: 'MM/DD/YYYY',
            timeFormat: '12h',
            firstDayOfWeek: 'sunday',
            calendar: 'gregorian'
        });

        this.dateTimeFormats.set('en-GB', {
            dateFormat: 'DD/MM/YYYY',
            timeFormat: '24h',
            firstDayOfWeek: 'monday',
            calendar: 'gregorian'
        });

        this.dateTimeFormats.set('ja', {
            dateFormat: 'YYYY年MM月DD日',
            timeFormat: '24h',
            firstDayOfWeek: 'sunday',
            calendar: 'gregorian'
        });

        this.dateTimeFormats.set('ar', {
            dateFormat: 'DD/MM/YYYY',
            timeFormat: '12h',
            firstDayOfWeek: 'saturday',
            calendar: 'islamic'
        });

        // Number formats
        this.numberFormats.set('en-US', {
            decimalSeparator: '.',
            thousandsSeparator: ',',
            currencySymbol: '$',
            currencyPosition: 'before'
        });

        this.numberFormats.set('de', {
            decimalSeparator: ',',
            thousandsSeparator: '.',
            currencySymbol: '€',
            currencyPosition: 'after'
        });

        this.numberFormats.set('fr', {
            decimalSeparator: ',',
            thousandsSeparator: ' ',
            currencySymbol: '€',
            currencyPosition: 'after'
        });

        // Address formats
        this.addressFormats.set('en-US', {
            order: ['name', 'street', 'city', 'state', 'zip', 'country'],
            format: '{name}\n{street}\n{city}, {state} {zip}\n{country}'
        });

        this.addressFormats.set('ja', {
            order: ['zip', 'prefecture', 'city', 'area', 'street', 'building', 'name'],
            format: '〒{zip}\n{prefecture}{city}{area}\n{street}{building}\n{name}'
        });

        console.info(`🌍 Loaded regional preferences for ${this.dateTimeFormats.size} regions`);
    }

    /**
     * Setup cultural translation rules
     */
    setupCulturalRules() {
        // Formality adjustments
        this.formalityLevels.set('very_formal', {
            greeting: 'Good day, sir/madam',
            closing: 'Best regards',
            title: 'Mr./Ms./Dr.'
        });

        this.formalityLevels.set('formal', {
            greeting: 'Hello',
            closing: 'Regards',
            title: 'Mr./Ms.'
        });

        this.formalityLevels.set('semi-formal', {
            greeting: 'Hi',
            closing: 'Best',
            title: 'First name'
        });

        this.formalityLevels.set('informal', {
            greeting: 'Hey',
            closing: 'Cheers',
            title: 'First name'
        });

        // Cultural translation rules
        this.culturalRules.set('time', {
            'en-US': (text) => text.replace('now', 'right now'),
            'ja': (text) => text.replace('now', 'ただいま'),
            'ar': (text) => text.replace('now', 'الآن')
        });

        this.culturalRules.set('space', {
            'en-US': (text) => text.replace('personal space', 'personal space'),
            'ja': (text) => text.replace('personal space', 'パーソナルスペース'),
            'ar': (text) => text.replace('personal space', 'المساحة الشخصية')
        });

        console.info('📋 Cultural rules configured');
    }

    /**
     * Apply cultural adaptation to translation
     */
    async adaptTranslation(text, sourceLang, targetLang, context = {}) {
        if (!this.isInitialized) {
            return text;
        }

        try {
            let adaptedText = text;

            // Get cultural profile
            const sourceProfile = this.culturalProfiles.get(sourceLang);
            const targetProfile = this.culturalProfiles.get(targetLang);

            if (!sourceProfile || !targetProfile) {
                return adaptedText;
            }

            // Apply formality adjustments
            adaptedText = this.adjustFormality(adaptedText, sourceProfile, targetProfile, context);

            // Apply cultural context adjustments
            adaptedText = this.adjustCulturalContext(adaptedText, sourceProfile, targetProfile, context);

            // Apply regional formatting
            adaptedText = this.applyRegionalFormatting(adaptedText, targetLang, context);

            // Apply translation memory
            adaptedText = this.applyTranslationMemory(adaptedText, sourceLang, targetLang, context);

            console.info(`🌍 Cultural adaptation applied: ${sourceLang} → ${targetLang}`);
            return adaptedText;

        } catch (error) {
            console.warn('Cultural adaptation failed:', error);
            return text;
        }
    }

    /**
     * Adjust formality based on cultural profiles
     */
    adjustFormality(text, sourceProfile, targetProfile, context) {
        let adjusted = text;

        // Adjust greeting formality
        if (context.type === 'greeting') {
            const sourceFormality = this.getFormalityLevel(sourceProfile.formality);
            const targetFormality = this.getFormalityLevel(targetProfile.formality);

            if (targetFormality.level > sourceFormality.level) {
                adjusted = this.makeMoreFormal(adjusted, targetFormality);
            } else if (targetFormality.level < sourceFormality.level) {
                adjusted = this.makeLessFormal(adjusted, targetFormality);
            }
        }

        // Adjust business communication
        if (context.type === 'business') {
            if (targetProfile.businessStyle === 'very_formal') {
                adjusted = this.makeBusinessFormal(adjusted);
            }
        }

        return adjusted;
    }

    /**
     * Get formality level object
     */
    getFormalityLevel(formality) {
        const levels = {
            'very_formal': { level: 4, description: 'Very formal' },
            'formal': { level: 3, description: 'Formal' },
            'semi-formal': { level: 2, description: 'Semi-formal' },
            'informal': { level: 1, description: 'Informal' }
        };

        return levels[formality] || levels['semi-formal'];
    }

    /**
     * Make text more formal
     */
    makeMoreFormal(text, targetFormality) {
        const formalPhrases = this.formalityLevels.get(targetFormality.description.toLowerCase().replace(' ', '_'));
        if (!formalPhrases) return text;

        // Replace casual greetings
        return text
            .replace(/^hey/i, formalPhrases.greeting)
            .replace(/^hi/i, formalPhrases.greeting)
            .replace(/cheers$/i, formalPhrases.closing)
            .replace(/best$/i, formalPhrases.closing);
    }

    /**
     * Make text less formal
     */
    makeLessFormal(text, targetFormality) {
        const informalPhrases = this.formalityLevels.get('informal');

        return text
            .replace(/^good day/i, informalPhrases.greeting)
            .replace(/^hello/i, informalPhrases.greeting)
            .replace(/regards$/i, informalPhrases.closing)
            .replace(/best regards$/i, informalPhrases.closing);
    }

    /**
     * Make business text more formal
     */
    makeBusinessFormal(text) {
        return text
            .replace(/hey/i, 'Hello')
            .replace(/thanks/i, 'Thank you')
            .replace(/sorry/i, 'I apologize')
            .replace(/ok/i, 'acceptable')
            .replace(/cool/i, 'excellent');
    }

    /**
     * Adjust cultural context
     */
    adjustCulturalContext(text, sourceProfile, targetProfile, context) {
        let adjusted = text;

        // Adjust directness
        if (sourceProfile.directness === 'high' && targetProfile.directness === 'low') {
            adjusted = this.makeLessDirect(adjusted, context);
        } else if (sourceProfile.directness === 'low' && targetProfile.directness === 'high') {
            adjusted = this.makeMoreDirect(adjusted, context);
        }

        // Adjust context dependency
        if (sourceProfile.context === 'low' && targetProfile.context === 'high') {
            adjusted = this.addCulturalContext(adjusted, targetProfile, context);
        }

        return adjusted;
    }

    /**
     * Make text less direct (more polite/contextual)
     */
    makeLessDirect(text, context) {
        if (context.type === 'request') {
            return text
                .replace(/^do /i, 'Could you please ')
                .replace(/^please /i, '')
                .replace(/$/i, ' please?');
        }

        if (context.type === 'opinion') {
            return text
                .replace(/^i think/i, 'In my opinion,')
                .replace(/^i believe/i, 'I tend to believe that');
        }

        return text;
    }

    /**
     * Make text more direct
     */
    makeMoreDirect(text, context) {
        return text
            .replace(/^could you please /i, 'Please ')
            .replace(/^in my opinion,/i, 'I think')
            .replace(/^i tend to believe that /i, 'I believe');
    }

    /**
     * Add cultural context
     */
    addCulturalContext(text, targetProfile, context) {
        // Add appropriate honorifics for high-context cultures
        if (targetProfile.communicationStyle === 'hierarchical') {
            if (context.speakerRole === 'junior') {
                return text.replace(/you are/i, 'you, senior, are');
            }
        }

        return text;
    }

    /**
     * Apply regional formatting
     */
    applyRegionalFormatting(text, targetLang, context) {
        let formatted = text;

        // Apply date formatting
        if (context.containsDate) {
            formatted = this.formatDates(formatted, targetLang);
        }

        // Apply number formatting
        if (context.containsNumbers) {
            formatted = this.formatNumbers(formatted, targetLang);
        }

        // Apply currency formatting
        if (context.containsCurrency) {
            formatted = this.formatCurrency(formatted, targetLang);
        }

        return formatted;
    }

    /**
     * Format dates according to regional preferences
     */
    formatDates(text, language) {
        const format = this.dateTimeFormats.get(language);
        if (!format) return text;

        // This would implement actual date parsing and formatting
        // For now, return placeholder
        return text.replace(/\d{1,2}\/\d{1,2}\/\d{4}/g, `[${format.dateFormat}]`);
    }

    /**
     * Format numbers according to regional preferences
     */
    formatNumbers(text, language) {
        const format = this.numberFormats.get(language);
        if (!format) return text;

        // Simple number formatting
        return text.replace(/(\d+),(\d+)/g, `$1${format.decimalSeparator}$2`);
    }

    /**
     * Format currency according to regional preferences
     */
    formatCurrency(text, language) {
        const format = this.numberFormats.get(language);
        if (!format) return text;

        const symbol = format.currencySymbol;
        const position = format.currencyPosition;

        if (position === 'before') {
            return text.replace(/\$(\d+)/g, `${symbol}$1`);
        } else {
            return text.replace(/(\d+)\$/g, `$1 ${symbol}`);
        }
    }

    /**
     * Apply translation memory for consistency
     */
    applyTranslationMemory(text, sourceLang, targetLang, context) {
        const memoryKey = `${sourceLang}-${targetLang}-${context.type || 'general'}`;

        if (this.translationMemories.has(memoryKey)) {
            const memories = this.translationMemories.get(memoryKey);

            // Look for similar phrases in memory
            for (const memory of memories) {
                if (this.calculateSimilarity(text, memory.source) > 0.8) {
                    console.info(`📚 Translation memory hit: ${memory.source} → ${memory.target}`);
                    return memory.target;
                }
            }
        }

        // Store new translation in memory
        this.addToTranslationMemory(text, text, sourceLang, targetLang, context);

        return text;
    }

    /**
     * Add translation to memory
     */
    addToTranslationMemory(source, target, sourceLang, targetLang, context) {
        const memoryKey = `${sourceLang}-${targetLang}-${context.type || 'general'}`;

        if (!this.translationMemories.has(memoryKey)) {
            this.translationMemories.set(memoryKey, []);
        }

        const memories = this.translationMemories.get(memoryKey);
        memories.push({
            source,
            target,
            context,
            timestamp: new Date().toISOString(),
            frequency: 1
        });

        // Keep only recent 1000 entries
        if (memories.length > 1000) {
            memories.shift();
        }
    }

    /**
     * Calculate text similarity
     */
    calculateSimilarity(text1, text2) {
        const words1 = text1.toLowerCase().split(/\s+/);
        const words2 = text2.toLowerCase().split(/\s+/);

        const intersection = words1.filter(word => words2.includes(word)).length;
        const union = new Set([...words1, ...words2]).size;

        return intersection / union;
    }

    /**
     * Initialize translation memories
     */
    initializeTranslationMemories() {
        // Common business phrases
        this.addToTranslationMemory(
            'How are you?',
            'How are you?',
            'en',
            'ja',
            { type: 'greeting', formality: 'formal' }
        );

        this.addToTranslationMemory(
            'Thank you for your time',
            'Thank you for your time',
            'en',
            'ja',
            { type: 'business', formality: 'formal' }
        );

        console.info(`🧠 Translation memories initialized with ${this.translationMemories.size} categories`);
    }

    /**
     * Get cultural profile for language
     */
    getCulturalProfile(language) {
        return this.culturalProfiles.get(language) || this.culturalProfiles.get('en');
    }

    /**
     * Get regional preferences for language
     */
    getRegionalPreferences(language) {
        return {
            dateTime: this.dateTimeFormats.get(language),
            numbers: this.numberFormats.get(language),
            address: this.addressFormats.get(language)
        };
    }

    /**
     * Analyze text for cultural adaptation needs
     */
    analyzeCulturalContext(text, sourceLang, targetLang) {
        const context = {
            containsDate: /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(text),
            containsNumbers: /\d+/.test(text),
            containsCurrency: /[$€£¥₹₽₩₦₨₪₫₡₵₮₯₰₱₲₳₴₵₶₷₸₹₺₻₼₽₾₿]/.test(text),
            containsTime: /\d{1,2}:\d{2}/.test(text),
            type: this.detectTextType(text),
            formality: this.detectFormality(text),
            urgency: this.detectUrgency(text)
        };

        return context;
    }

    /**
     * Detect text type
     */
    detectTextType(text) {
        if (text.includes('please') || text.includes('thank you') || text.includes('sorry')) {
            return 'polite';
        }
        if (text.includes('urgent') || text.includes('asap') || text.includes('!')) {
            return 'urgent';
        }
        if (text.includes('meeting') || text.includes('conference') || text.includes('call')) {
            return 'business';
        }
        return 'general';
    }

    /**
     * Detect formality level
     */
    detectFormality(text) {
        const formalIndicators = ['please', 'thank you', 'regards', 'sir', 'madam', 'mr.', 'ms.', 'dr.'];
        const informalIndicators = ['hey', 'hi', 'thanks', 'cheers', 'mate', 'dude'];

        const formalCount = formalIndicators.filter(indicator => text.toLowerCase().includes(indicator)).length;
        const informalCount = informalIndicators.filter(indicator => text.toLowerCase().includes(indicator)).length;

        if (formalCount > informalCount) return 'formal';
        if (informalCount > formalCount) return 'informal';
        return 'neutral';
    }

    /**
     * Detect urgency level
     */
    detectUrgency(text) {
        const urgentWords = ['urgent', 'asap', 'immediately', 'now', 'quickly', 'rush'];
        return urgentWords.some(word => text.toLowerCase().includes(word)) ? 'high' : 'normal';
    }

    /**
     * Get cultural adaptation statistics
     */
    getCulturalStats() {
        return {
            isInitialized: this.isInitialized,
            culturalProfiles: this.culturalProfiles.size,
            regionalPreferences: this.regionalPreferences.size,
            translationMemories: this.translationMemories.size,
            formalityLevels: this.formalityLevels.size,
            culturalRules: this.culturalRules.size,
            supportedRegions: [
                ...new Set([...this.dateTimeFormats.keys(), ...this.numberFormats.keys()])
            ].length
        };
    }

    /**
     * Event system
     */
    emit(event, data) {
        document.dispatchEvent(new CustomEvent(`cultural:${event}`, { detail: data }));
    }

    /**
     * Add event listener
     */
    on(event, callback) {
        document.addEventListener(`cultural:${event}`, callback);
    }
}

// Initialize Cultural Adaptation Engine
window.culturalAdaptationEngine = new CulturalAdaptationEngine();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await window.culturalAdaptationEngine.initialize();

    // Setup global functions
    window.adaptTranslationCulturally = (text, sourceLang, targetLang, context) =>
        window.culturalAdaptationEngine.adaptTranslation(text, sourceLang, targetLang, context);

    window.getCulturalProfile = (language) =>
        window.culturalAdaptationEngine.getCulturalProfile(language);

    window.getCulturalStats = () =>
        window.culturalAdaptationEngine.getCulturalStats();

    console.info('🌍 Cultural Adaptation Engine ready');
});

// Export for modules
export default CulturalAdaptationEngine;
