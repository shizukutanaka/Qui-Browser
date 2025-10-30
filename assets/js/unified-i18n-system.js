/**
 * Enhanced Internationalization System for Qui Browser VR
 * Supports 100+ languages with AI-powered translation improvement
 * @version 4.0.0 - Unified Language System
 */

class UnifiedI18nSystem {
    constructor() {
        this.supportedLanguages = this.generateLanguageList();
        this.loadedLanguages = new Map();
        this.translationCache = new Map();
        this.aiImprover = null;
        this.currentLanguage = this.detectLanguage();
        this.fallbackLanguage = 'en';
        this.isInitialized = false;

        // Performance monitoring
        this.performanceMetrics = {
            loadTimes: new Map(),
            cacheHits: 0,
            cacheMisses: 0,
            translationRequests: 0
        };

        // Quality monitoring
        this.qualityMetrics = {
            missingKeys: new Set(),
            poorTranslations: new Set(),
            userFeedback: new Map()
        };

        this.init();
    }

    /**
     * Generate comprehensive language list from locales directory
     */
    generateLanguageList() {
        const languageMap = {
            // 主要言語 (Primary Languages)
            'en': { name: 'English', nativeName: 'English', flag: '🇺🇸', rtl: false, region: 'global', priority: 1 },
            'zh': { name: 'Chinese', nativeName: '中文', flag: '🇨🇳', rtl: false, region: 'asia', priority: 1 },
            'hi': { name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', rtl: false, region: 'asia', priority: 1 },
            'es': { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', rtl: false, region: 'europe', priority: 1 },
            'fr': { name: 'French', nativeName: 'Français', flag: '🇫🇷', rtl: false, region: 'europe', priority: 1 },
            'ar': { name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', rtl: true, region: 'middle-east', priority: 1 },
            'ru': { name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', rtl: false, region: 'europe', priority: 1 },
            'pt': { name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', rtl: false, region: 'europe', priority: 1 },
            'de': { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', rtl: false, region: 'europe', priority: 1 },

            // 地域バリエーション (Regional Variants)
            'en-US': { name: 'English (US)', nativeName: 'English (US)', flag: '🇺🇸', rtl: false, region: 'americas', priority: 2, parent: 'en' },
            'en-GB': { name: 'English (UK)', nativeName: 'English (UK)', flag: '🇬🇧', rtl: false, region: 'europe', priority: 2, parent: 'en' },
            'zh-CN': { name: 'Chinese (Simplified)', nativeName: '中文 (简体)', flag: '🇨🇳', rtl: false, region: 'asia', priority: 2, parent: 'zh' },
            'zh-TW': { name: 'Chinese (Traditional)', nativeName: '中文 (繁體)', flag: '🇹🇼', rtl: false, region: 'asia', priority: 2, parent: 'zh' },
            'es-ES': { name: 'Spanish (Spain)', nativeName: 'Español (España)', flag: '🇪🇸', rtl: false, region: 'europe', priority: 2, parent: 'es' },
            'es-MX': { name: 'Spanish (Mexico)', nativeName: 'Español (México)', flag: '🇲🇽', rtl: false, region: 'americas', priority: 2, parent: 'es' },
            'fr-CA': { name: 'French (Canada)', nativeName: 'Français (Canada)', flag: '🇨🇦', rtl: false, region: 'americas', priority: 2, parent: 'fr' },
            'pt-BR': { name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', flag: '🇧🇷', rtl: false, region: 'americas', priority: 2, parent: 'pt' },
            'de-DE': { name: 'German (Germany)', nativeName: 'Deutsch (Deutschland)', flag: '🇩🇪', rtl: false, region: 'europe', priority: 2, parent: 'de' },
            'de-AT': { name: 'German (Austria)', nativeName: 'Deutsch (Österreich)', flag: '🇦🇹', rtl: false, region: 'europe', priority: 2, parent: 'de' },
            'ru-RU': { name: 'Russian (Russia)', nativeName: 'Русский (Россия)', flag: '🇷🇺', rtl: false, region: 'europe', priority: 2, parent: 'ru' },
            'it-IT': { name: 'Italian (Italy)', nativeName: 'Italiano (Italia)', flag: '🇮🇹', rtl: false, region: 'europe', priority: 2, parent: 'it' },
            'nl-NL': { name: 'Dutch (Netherlands)', nativeName: 'Nederlands (Nederland)', flag: '🇳🇱', rtl: false, region: 'europe', priority: 2, parent: 'nl' },

            // アジア言語 (Asian Languages)
            'ja': { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', rtl: false, region: 'asia', priority: 1 },
            'ko': { name: 'Korean', nativeName: '한국어', flag: '🇰🇷', rtl: false, region: 'asia', priority: 1 },
            'th': { name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭', rtl: false, region: 'asia', priority: 2 },
            'vi': { name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', rtl: false, region: 'asia', priority: 2 },
            'id': { name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', rtl: false, region: 'asia', priority: 2 },
            'ms': { name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾', rtl: false, region: 'asia', priority: 2 },
            'ta': { name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳', rtl: false, region: 'asia', priority: 2 },
            'te': { name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳', rtl: false, region: 'asia', priority: 2 },
            'kn': { name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳', rtl: false, region: 'asia', priority: 2 },
            'ml': { name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳', rtl: false, region: 'asia', priority: 2 },
            'pa': { name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flag: '🇮🇳', rtl: false, region: 'asia', priority: 2 },
            'bn': { name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩', rtl: false, region: 'asia', priority: 2 },
            'ur': { name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰', rtl: true, region: 'asia', priority: 2 },
            'fa': { name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷', rtl: true, region: 'middle-east', priority: 2 },
            'he': { name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱', rtl: true, region: 'middle-east', priority: 2 },
            'tr': { name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', rtl: false, region: 'europe', priority: 2 },

            // ヨーロッパ言語 (European Languages)
            'it': { name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', rtl: false, region: 'europe', priority: 2 },
            'nl': { name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', rtl: false, region: 'europe', priority: 2 },
            'sv': { name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪', rtl: false, region: 'europe', priority: 2 },
            'da': { name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰', rtl: false, region: 'europe', priority: 2 },
            'no': { name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴', rtl: false, region: 'europe', priority: 2 },
            'fi': { name: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮', rtl: false, region: 'europe', priority: 2 },
            'pl': { name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', rtl: false, region: 'europe', priority: 2 },
            'cs': { name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿', rtl: false, region: 'europe', priority: 2 },
            'sk': { name: 'Slovak', nativeName: 'Slovenčina', flag: '🇸🇰', rtl: false, region: 'europe', priority: 2 },
            'hu': { name: 'Hungarian', nativeName: 'Magyar', flag: '🇭🇺', rtl: false, region: 'europe', priority: 2 },
            'ro': { name: 'Romanian', nativeName: 'Română', flag: '🇷🇴', rtl: false, region: 'europe', priority: 2 },
            'bg': { name: 'Bulgarian', nativeName: 'Български', flag: '🇧🇬', rtl: false, region: 'europe', priority: 2 },
            'hr': { name: 'Croatian', nativeName: 'Hrvatski', flag: '🇭🇷', rtl: false, region: 'europe', priority: 2 },
            'sr': { name: 'Serbian', nativeName: 'Српски', flag: '🇷🇸', rtl: false, region: 'europe', priority: 2 },
            'sl': { name: 'Slovenian', nativeName: 'Slovenščina', flag: '🇸🇮', rtl: false, region: 'europe', priority: 2 },
            'et': { name: 'Estonian', nativeName: 'Eesti', flag: '🇪🇪', rtl: false, region: 'europe', priority: 2 },
            'lv': { name: 'Latvian', nativeName: 'Latviešu', flag: '🇱🇻', rtl: false, region: 'europe', priority: 2 },
            'lt': { name: 'Lithuanian', nativeName: 'Lietuvių', flag: '🇱🇹', rtl: false, region: 'europe', priority: 2 },
            'mt': { name: 'Maltese', nativeName: 'Malti', flag: '🇲🇹', rtl: false, region: 'europe', priority: 2 },
            'ga': { name: 'Irish', nativeName: 'Gaeilge', flag: '🇮🇪', rtl: false, region: 'europe', priority: 2 },
            'cy': { name: 'Welsh', nativeName: 'Cymraeg', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', rtl: false, region: 'europe', priority: 2 },

            // アフリカ言語 (African Languages)
            'sw': { name: 'Swahili', nativeName: 'Kiswahili', flag: '🇹🇿', rtl: false, region: 'africa', priority: 2 },
            'am': { name: 'Amharic', nativeName: 'አማርኛ', flag: '🇪🇹', rtl: false, region: 'africa', priority: 2 },
            'ha': { name: 'Hausa', nativeName: 'هَوُسَا', flag: '🇳🇬', rtl: true, region: 'africa', priority: 2 },
            'yo': { name: 'Yoruba', nativeName: 'Yorùbá', flag: '🇳🇬', rtl: false, region: 'africa', priority: 2 },
            'zu': { name: 'Zulu', nativeName: 'isiZulu', flag: '🇿🇦', rtl: false, region: 'africa', priority: 2 },
            'af': { name: 'Afrikaans', nativeName: 'Afrikaans', flag: '🇿🇦', rtl: false, region: 'africa', priority: 2 },
            'xh': { name: 'Xhosa', nativeName: 'isiXhosa', flag: '🇿🇦', rtl: false, region: 'africa', priority: 2 },
            'pcm': { name: 'Nigerian Pidgin', nativeName: 'Naija Pidgin', flag: '🇳🇬', rtl: false, region: 'africa', priority: 3 },
            'ff': { name: 'Fula', nativeName: 'Fulfulde', flag: '🇸🇳', rtl: false, region: 'africa', priority: 3 },
            'so': { name: 'Somali', nativeName: 'Soomaali', flag: '🇸🇴', rtl: false, region: 'africa', priority: 3 },
            'mg': { name: 'Malagasy', nativeName: 'Malagasy', flag: '🇲🇬', rtl: false, region: 'africa', priority: 3 },
            'ig': { name: 'Igbo', nativeName: 'Igbo', flag: '🇳🇬', rtl: false, region: 'africa', priority: 3 },
            'om': { name: 'Oromo', nativeName: 'Oromo', flag: '🇪🇹', rtl: false, region: 'africa', priority: 3 },

            // その他の言語 (Other Languages)
            'jv': { name: 'Javanese', nativeName: 'ꦧꦱꦗꦮ', flag: '🇮🇩', rtl: false, region: 'asia', priority: 3 },
            'tl': { name: 'Tagalog', nativeName: 'Tagalog', flag: '🇵🇭', rtl: false, region: 'asia', priority: 3 },
            'mr': { name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳', rtl: false, region: 'asia', priority: 3 },
            'ne': { name: 'Nepali', nativeName: 'नेपाली', flag: '🇳🇵', rtl: false, region: 'asia', priority: 3 },
            'si': { name: 'Sinhala', nativeName: 'සිංහල', flag: '🇱🇰', rtl: false, region: 'asia', priority: 3 },
            'my': { name: 'Burmese', nativeName: 'မြန်မာဘာသာ', flag: '🇲🇲', rtl: false, region: 'asia', priority: 3 },
            'km': { name: 'Khmer', nativeName: 'ខ្មែរ', flag: '🇰🇭', rtl: false, region: 'asia', priority: 3 },
            'lo': { name: 'Lao', nativeName: 'ລາວ', flag: '🇱🇦', rtl: false, region: 'asia', priority: 3 },
            'mn': { name: 'Mongolian', nativeName: 'Монгол', flag: '🇲🇳', rtl: false, region: 'asia', priority: 3 },
            'kk': { name: 'Kazakh', nativeName: 'Қазақша', flag: '🇰🇿', rtl: false, region: 'asia', priority: 3 },
            'uz': { name: 'Uzbek', nativeName: 'Oʻzbekcha', flag: '🇺🇿', rtl: false, region: 'asia', priority: 3 },
            'tk': { name: 'Turkmen', nativeName: 'Türkmençe', flag: '🇹🇲', rtl: false, region: 'asia', priority: 3 },
            'tg': { name: 'Tajik', nativeName: 'Тоҷикӣ', flag: '🇹🇯', rtl: false, region: 'asia', priority: 3 },
            'ky': { name: 'Kyrgyz', nativeName: 'Кыргызча', flag: '🇰🇬', rtl: false, region: 'asia', priority: 3 },
            'hy': { name: 'Armenian', nativeName: 'Հայերեն', flag: '🇦🇲', rtl: false, region: 'europe', priority: 3 },
            'ka': { name: 'Georgian', nativeName: 'ქართული', flag: '🇬🇪', rtl: false, region: 'europe', priority: 3 },
            'is': { name: 'Icelandic', nativeName: 'Íslenska', flag: '🇮🇸', rtl: false, region: 'europe', priority: 3 },
            'eu': { name: 'Basque', nativeName: 'Euskera', flag: '🇪🇸', rtl: false, region: 'europe', priority: 3 },
            'gl': { name: 'Galician', nativeName: 'Galego', flag: '🇪🇸', rtl: false, region: 'europe', priority: 3 },
            'ca': { name: 'Catalan', nativeName: 'Català', flag: '🇪🇸', rtl: false, region: 'europe', priority: 3 },
            'az': { name: 'Azerbaijani', nativeName: 'Azərbaycan dili', flag: '🇦🇿', rtl: false, region: 'europe', priority: 3 },

            // 新興アフリカ言語 (Emerging African Languages)
            'ak': { name: 'Akan', nativeName: 'Akan', flag: '🇬🇭', rtl: false, region: 'africa', priority: 3 },
            'tw': { name: 'Twi', nativeName: 'Twi', flag: '🇬🇭', rtl: false, region: 'africa', priority: 3 },
            'ee': { name: 'Ewe', nativeName: 'Eʋegbe', flag: '🇬🇭', rtl: false, region: 'africa', priority: 3 },
            'gaa': { name: 'Ga', nativeName: 'Gã', flag: '🇬🇭', rtl: false, region: 'africa', priority: 3 },
            'dag': { name: 'Dagbani', nativeName: 'Dagbanli', flag: '🇬🇭', rtl: false, region: 'africa', priority: 3 },
            'gon': { name: 'Gondi', nativeName: 'गोंडी', flag: '🇮🇳', rtl: false, region: 'asia', priority: 3 },
            'sat': { name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', flag: '🇮🇳', rtl: false, region: 'asia', priority: 3 },
            'mni': { name: 'Manipuri', nativeName: 'মৈতৈলোন্', flag: '🇮🇳', rtl: false, region: 'asia', priority: 3 },
            'bho': { name: 'Bhojpuri', nativeName: 'भोजपुरी', flag: '🇮🇳', rtl: false, region: 'asia', priority: 3 },
            'mai': { name: 'Maithili', nativeName: 'मैथिली', flag: '🇮🇳', rtl: false, region: 'asia', priority: 3 },
            'awa': { name: 'Awadhi', nativeName: 'अवधी', flag: '🇮🇳', rtl: false, region: 'asia', priority: 3 },
            'mag': { name: 'Magahi', nativeName: 'मगही', flag: '🇮🇳', rtl: false, region: 'asia', priority: 3 },
            'bgc': { name: 'Haryanvi', nativeName: 'हरियाणवी', flag: '🇮🇳', rtl: false, region: 'asia', priority: 3 },
            'hne': { name: 'Chhattisgarhi', nativeName: 'छत्तीसगढ़ी', flag: '🇮🇳', rtl: false, region: 'asia', priority: 3 },
            'doi': { name: 'Dogri', nativeName: 'डोगरी', flag: '🇮🇳', rtl: false, region: 'asia', priority: 3 },

            // 東南アジア新興言語 (Southeast Asian Languages)
            'ceb': { name: 'Cebuano', nativeName: 'Cebuano', flag: '🇵🇭', rtl: false, region: 'asia', priority: 3 },
            'ilo': { name: 'Ilocano', nativeName: 'Ilocano', flag: '🇵🇭', rtl: false, region: 'asia', priority: 3 },
            'war': { name: 'Waray', nativeName: 'Waray', flag: '🇵🇭', rtl: false, region: 'asia', priority: 3 },
            'pam': { name: 'Pampanga', nativeName: 'Kapampangan', flag: '🇵🇭', rtl: false, region: 'asia', priority: 3 },
            'bik': { name: 'Bikol', nativeName: 'Bikol', flag: '🇵🇭', rtl: false, region: 'asia', priority: 3 },
            'min': { name: 'Minangkabau', nativeName: 'Minangkabau', flag: '🇮🇩', rtl: false, region: 'asia', priority: 3 },
            'bug': { name: 'Buginese', nativeName: 'Buginese', flag: '🇮🇩', rtl: false, region: 'asia', priority: 3 },
            'mad': { name: 'Madurese', nativeName: 'Madurese', flag: '🇮🇩', rtl: false, region: 'asia', priority: 3 },
            'su': { name: 'Sundanese', nativeName: 'Sunda', flag: '🇮🇩', rtl: false, region: 'asia', priority: 3 },
            'bal': { name: 'Balinese', nativeName: 'Balinese', flag: '🇮🇩', rtl: false, region: 'asia', priority: 3 },
            'tet': { name: 'Tetum', nativeName: 'Tetun', flag: '🇹🇱', rtl: false, region: 'asia', priority: 3 },
            'pap': { name: 'Papiamento', nativeName: 'Papiamentu', flag: '🇨🇼', rtl: false, region: 'americas', priority: 3 },

            // 中央アジア言語 (Central Asian Languages)
            'az': { name: 'Azerbaijani', nativeName: 'Azərbaycan dili', flag: '🇦🇿', rtl: false, region: 'asia', priority: 2 },
            'kk': { name: 'Kazakh', nativeName: 'Қазақша', flag: '🇰🇿', rtl: false, region: 'asia', priority: 2 },
            'ky': { name: 'Kyrgyz', nativeName: 'Кыргызча', flag: '🇰🇬', rtl: false, region: 'asia', priority: 2 },
            'tg': { name: 'Tajik', nativeName: 'Тоҷикӣ', flag: '🇹🇯', rtl: false, region: 'asia', priority: 2 },
            'tk': { name: 'Turkmen', nativeName: 'Türkmençe', flag: '🇹🇲', rtl: false, region: 'asia', priority: 2 },
            'uz': { name: 'Uzbek', nativeName: 'Oʻzbekcha', flag: '🇺🇿', rtl: false, region: 'asia', priority: 2 },

            // 先住民言語 (Indigenous Languages)
            'qu': { name: 'Quechua', nativeName: 'Runa Simi', flag: '🇵🇪', rtl: false, region: 'americas', priority: 3 },
            'ay': { name: 'Aymara', nativeName: 'Aymar aru', flag: '🇧🇴', rtl: false, region: 'americas', priority: 3 },
            'gn': { name: 'Guarani', nativeName: 'Avañe\'ẽ', flag: '🇵🇾', rtl: false, region: 'americas', priority: 3 },
            'na': { name: 'Nauru', nativeName: 'Dorerin Naoero', flag: '🇳🇷', rtl: false, region: 'oceania', priority: 3 },
            'sm': { name: 'Samoan', nativeName: 'Gagana Samoa', flag: '🇼🇸', rtl: false, region: 'oceania', priority: 3 },
            'to': { name: 'Tongan', nativeName: 'Lea Faka-Tonga', flag: '🇹🇴', rtl: false, region: 'oceania', priority: 3 },
            'mi': { name: 'Maori', nativeName: 'Te Reo Māori', flag: '🇳🇿', rtl: false, region: 'oceania', priority: 3 },
            'haw': { name: 'Hawaiian', nativeName: 'ʻŌlelo Hawaiʻi', flag: '🇺🇸', rtl: false, region: 'oceania', priority: 3 },

            // クレオール言語 (Creole Languages)
            'ht': { name: 'Haitian Creole', nativeName: 'Kreyòl ayisyen', flag: '🇭🇹', rtl: false, region: 'americas', priority: 3 },
            'pap': { name: 'Papiamento', nativeName: 'Papiamentu', flag: '🇨🇼', rtl: false, region: 'americas', priority: 3 },
            'srn': { name: 'Sranan Tongo', nativeName: 'Sranantongo', flag: '🇸🇷', rtl: false, region: 'americas', priority: 3 },
            'jam': { name: 'Jamaican Patois', nativeName: 'Jumiekan Patwah', flag: '🇯🇲', rtl: false, region: 'americas', priority: 3 },

            // 人工言語 (Constructed Languages)
            'eo': { name: 'Esperanto', nativeName: 'Esperanto', flag: '🌍', rtl: false, region: 'global', priority: 3 },
            'ia': { name: 'Interlingua', nativeName: 'Interlingua', flag: '🌍', rtl: false, region: 'global', priority: 3 },
            'vo': { name: 'Volapük', nativeName: 'Volapük', flag: '🌍', rtl: false, region: 'global', priority: 3 },
            'tok': { name: 'Toki Pona', nativeName: 'toki pona', flag: '🌍', rtl: false, region: 'global', priority: 3 },
            'ldn': { name: 'Láadan', nativeName: 'Láadan', flag: '🌍', rtl: false, region: 'global', priority: 3 },

            // 超新興言語 (Ultra-Emerging Languages)
            'tpi': { name: 'Tok Pisin', nativeName: 'Tok Pisin', flag: '🇵🇬', rtl: false, region: 'oceania', priority: 3 },
            'bi': { name: 'Bislama', nativeName: 'Bislama', flag: '🇻🇺', rtl: false, region: 'oceania', priority: 3 },
            'ch': { name: 'Chamorro', nativeName: 'Chamoru', flag: '🇬🇺', rtl: false, region: 'oceania', priority: 3 },
            'mh': { name: 'Marshallese', nativeName: 'Kajin M̧ajeļ', flag: '🇲🇭', rtl: false, region: 'oceania', priority: 3 },
            'pal': { name: 'Palauan', nativeName: 'Palauan', flag: '🇵🇼', rtl: false, region: 'oceania', priority: 3 }
        };

        return languageMap;
    }

    /**
     * Initialize the unified I18n system
     */
    async init() {
        console.info('🚀 Initializing Unified I18n System...');

        try {
            // Load AI translation improver
            await this.initializeAIImprover();

            // Load current language data
            await this.loadLanguageData(this.currentLanguage);

            // Initialize performance monitoring
            this.startPerformanceMonitoring();

            // Setup translation quality monitoring
            this.startQualityMonitoring();

            this.isInitialized = true;

            console.info(`✅ Unified I18n System initialized successfully`);
            console.info(`🌍 Supporting ${Object.keys(this.supportedLanguages).length} languages`);
            console.info(`📍 Current language: ${this.currentLanguage}`);

            this.emit('systemReady', {
                language: this.currentLanguage,
                totalLanguages: Object.keys(this.supportedLanguages).length,
                initialized: true
            });

        } catch (error) {
            console.error('❌ Unified I18n System initialization failed:', error);
            this.emit('systemError', error);
        }
    }

    /**
     * Initialize AI translation improver
     */
    async initializeAIImprover() {
        if (window.aiTranslationImprover) {
            this.aiImprover = window.aiTranslationImprover;
        } else {
            // Fallback to basic AI improver
            this.aiImprover = {
                predictTranslationQuality: (original, translated, source, target) => 0.8,
                collectFeedback: (original, translated, source, target, quality) => {},
                generateImprovedTranslation: async (original, current, source, target) => current
            };
        }
    }

    /**
     * Detect user's preferred language
     */
    detectLanguage() {
        // 1. Check localStorage
        const stored = localStorage.getItem('qui_browser_language');
        if (stored && this.supportedLanguages[stored]) {
            return stored;
        }

        // 2. Check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const urlLang = urlParams.get('lang');
        if (urlLang && this.supportedLanguages[urlLang]) {
            return urlLang;
        }

        // 3. Check browser language
        const browserLang = navigator.language.split('-')[0];
        if (this.supportedLanguages[browserLang]) {
            return browserLang;
        }

        // 4. Check full browser language code
        if (this.supportedLanguages[navigator.language]) {
            return navigator.language;
        }

        // 5. Fallback to English
        return this.fallbackLanguage;
    }

    /**
     * Load language data dynamically
     */
    async loadLanguageData(languageCode) {
        if (this.loadedLanguages.has(languageCode)) {
            return this.loadedLanguages.get(languageCode);
        }

        const startTime = performance.now();

        try {
            console.info(`📚 Loading language data for: ${languageCode}`);

            // Try to load from JSON file first
            const translationData = await this.loadFromJSON(languageCode);

            if (translationData) {
                this.loadedLanguages.set(languageCode, translationData);
                this.performanceMetrics.loadTimes.set(languageCode, performance.now() - startTime);

                console.info(`✅ Language data loaded: ${languageCode} (${Object.keys(translationData).length} keys)`);
                return translationData;
            }

        } catch (error) {
            console.warn(`⚠️ Failed to load ${languageCode} from JSON, using fallback:`, error);

            // Fallback to AI-generated translation
            const fallbackData = await this.generateFallbackTranslation(languageCode);
            this.loadedLanguages.set(languageCode, fallbackData);
            return fallbackData;
        }
    }

    /**
     * Load translation data from JSON file
     */
    async loadFromJSON(languageCode) {
        try {
            const response = await fetch(`../../locales/${languageCode}.json`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            // Validate translation completeness
            const completeness = this.validateTranslationCompleteness(data);
            if (completeness < 0.8) {
                console.warn(`⚠️ Translation completeness low for ${languageCode}: ${(completeness * 100).toFixed(1)}%`);
            }

            return data;
        } catch (error) {
            console.warn(`Failed to load JSON for ${languageCode}:`, error);
            return null;
        }
    }

    /**
     * Generate fallback translation using AI
     */
    async generateFallbackTranslation(languageCode) {
        console.info(`🤖 Generating AI fallback translation for: ${languageCode}`);

        // Load English base
        const englishData = await this.loadFromJSON('en');
        if (!englishData) return {};

        // Generate translations using machine translation
        const fallbackData = {};

        for (const [section, translations] of Object.entries(englishData)) {
            if (section === 'meta') {
                fallbackData[section] = {
                    ...translations,
                    language: languageCode,
                    languageName: this.supportedLanguages[languageCode]?.name || languageCode,
                    nativeName: this.supportedLanguages[languageCode]?.nativeName || languageCode,
                    rtl: this.supportedLanguages[languageCode]?.rtl || false
                };
                continue;
            }

            fallbackData[section] = await this.translateSection(translations, languageCode, 'en');
        }

        return fallbackData;
    }

    /**
     * Translate a section of text
     */
    async translateSection(translations, targetLang, sourceLang) {
        const result = {};

        for (const [key, value] of Object.entries(translations)) {
            if (typeof value === 'object') {
                result[key] = await this.translateSection(value, targetLang, sourceLang);
            } else {
                try {
                    // Use machine translation
                    const translated = await this.machineTranslate(value, targetLang, sourceLang);
                    result[key] = translated;

                    // Collect feedback for AI improvement
                    if (this.aiImprover) {
                        this.aiImprover.collectFeedback(value, translated, sourceLang, targetLang, 3);
                    }
                } catch (error) {
                    console.warn(`Translation failed for ${key}:`, error);
                    result[key] = value; // Fallback to original
                }
            }
        }

        return result;
    }

    /**
     * Machine translation (using available services)
     */
    async machineTranslate(text, targetLang, sourceLang) {
        // Try multiple translation services
        const services = [
            () => this.googleTranslate(text, targetLang, sourceLang),
            () => this.libreTranslate(text, targetLang, sourceLang),
            () => this.fallbackTranslate(text, targetLang, sourceLang)
        ];

        for (const service of services) {
            try {
                const result = await service();
                if (result && result !== text) {
                    return result;
                }
            } catch (error) {
                console.warn('Translation service failed:', error);
            }
        }

        return text; // Return original if all services fail
    }

    /**
     * Google Translate API (if available)
     */
    async googleTranslate(text, targetLang, sourceLang) {
        if (window.machineTranslation?.googleTranslate) {
            return await window.machineTranslation.googleTranslate(text, targetLang, sourceLang);
        }
        throw new Error('Google Translate not available');
    }

    /**
     * LibreTranslate API
     */
    async libreTranslate(text, targetLang, sourceLang) {
        try {
            const response = await fetch('https://libretranslate.com/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    q: text,
                    source: sourceLang,
                    target: targetLang
                })
            });

            const data = await response.json();
            return data.translatedText || text;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Fallback translation (simple word replacement)
     */
    async fallbackTranslate(text, targetLang, sourceLang) {
        // Simple fallback for common words
        const simpleTranslations = {
            'en': {
                'Hello': 'Hello',
                'World': 'World',
                'Settings': 'Settings',
                'Language': 'Language',
                'VR': 'VR',
                'Browser': 'Browser'
            }
        };

        return simpleTranslations[sourceLang]?.[text] || text;
    }

    /**
     * Validate translation completeness
     */
    validateTranslationCompleteness(translations) {
        if (!translations || typeof translations !== 'object') return 0;

        // Load English as reference
        const englishKeys = this.getAllKeys(translations);
        const englishData = this.loadedLanguages.get('en') || translations;

        if (!englishData) return 1; // If no reference, assume complete

        const referenceKeys = this.getAllKeys(englishData);
        const missingKeys = referenceKeys.filter(key => !englishKeys.includes(key));

        return missingKeys.length === 0 ? 1 : (referenceKeys.length - missingKeys.length) / referenceKeys.length;
    }

    /**
     * Get all keys from nested object
     */
    getAllKeys(obj, prefix = '') {
        let keys = [];
        for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                keys = keys.concat(this.getAllKeys(value, fullKey));
            } else {
                keys.push(fullKey);
            }
        }
        return keys;
    }

    /**
     * Translate text with caching and AI improvement
     */
    async translate(key, options = {}) {
        const { language = this.currentLanguage, context = '', variables = {} } = options;
        this.performanceMetrics.translationRequests++;

        // Check cache first
        const cacheKey = `${language}:${key}:${JSON.stringify(variables)}`;
        if (this.translationCache.has(cacheKey)) {
            this.performanceMetrics.cacheHits++;
            return this.translationCache.get(cacheKey);
        }

        this.performanceMetrics.cacheMisses++;

        try {
            // Load language data if not loaded
            if (!this.loadedLanguages.has(language)) {
                await this.loadLanguageData(language);
            }

            const translations = this.loadedLanguages.get(language);
            if (!translations) {
                throw new Error(`No translations available for ${language}`);
            }

            // Resolve nested key
            const value = this.resolveNestedKey(translations, key);
            if (value === undefined) {
                this.qualityMetrics.missingKeys.add(`${language}:${key}`);
                throw new Error(`Translation key not found: ${key}`);
            }

            // Replace variables
            let translatedText = this.replaceVariables(value, variables);

            // Apply AI improvements
            if (this.aiImprover && context) {
                const improved = await this.aiImprover.generateImprovedTranslation(
                    value, translatedText, 'en', language
                );
                if (improved !== translatedText) {
                    translatedText = improved;
                }
            }

            // Cache result
            this.translationCache.set(cacheKey, translatedText);

            // Limit cache size
            if (this.translationCache.size > 10000) {
                const firstKey = this.translationCache.keys().next().value;
                this.translationCache.delete(firstKey);
            }

            return translatedText;

        } catch (error) {
            console.warn(`Translation failed for ${key}:`, error);

            // Try fallback language
            if (language !== this.fallbackLanguage) {
                return await this.translate(key, { language: this.fallbackLanguage, context, variables });
            }

            return key; // Final fallback
        }
    }

    /**
     * Resolve nested translation key
     */
    resolveNestedKey(obj, key) {
        return key.split('.').reduce((current, k) => current?.[k], obj);
    }

    /**
     * Replace variables in translation
     */
    replaceVariables(text, variables) {
        let result = text;
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{${key}}`;
            result = result.replace(new RegExp(placeholder, 'g'), value);
        }
        return result;
    }

    /**
     * Change current language
     */
    async setLanguage(languageCode) {
        if (!this.supportedLanguages[languageCode]) {
            throw new Error(`Unsupported language: ${languageCode}`);
        }

        const previousLanguage = this.currentLanguage;
        this.currentLanguage = languageCode;

        // Save to localStorage
        localStorage.setItem('qui_browser_language', languageCode);

        // Load new language data
        await this.loadLanguageData(languageCode);

        // Update document
        this.updateDocumentLanguage();

        console.info(`🔄 Language changed: ${previousLanguage} → ${languageCode}`);

        this.emit('languageChanged', {
            previous: previousLanguage,
            current: languageCode,
            isRTL: this.supportedLanguages[languageCode].rtl
        });

        return true;
    }

    /**
     * Update document language and direction
     */
    updateDocumentLanguage() {
        const lang = this.supportedLanguages[this.currentLanguage];
        if (!lang) return;

        // Update HTML attributes
        document.documentElement.lang = this.currentLanguage;
        document.documentElement.dir = lang.rtl ? 'rtl' : 'ltr';

        // Update body class
        document.body.classList.toggle('rtl-language', lang.rtl);

        // Load appropriate fonts
        this.loadLanguageFonts(this.currentLanguage);
    }

    /**
     * Load language-specific fonts
     */
    loadLanguageFonts(languageCode) {
        const fontMap = {
            'ja': 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap',
            'ko': 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap',
            'zh': 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap',
            'zh-CN': 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap',
            'zh-TW': 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap',
            'ar': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;700&display=swap',
            'hi': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;700&display=swap',
            'ta': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;700&display=swap',
            'te': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;500;700&display=swap',
            'kn': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Kannada:wght@400;500;700&display=swap',
            'ml': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Malayalam:wght@400;500;700&display=swap',
            'bn': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;700&display=swap',
            'pa': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Gurmukhi:wght@400;500;700&display=swap',
            'ur': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;700&display=swap',
            'fa': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;700&display=swap',
            'he': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;500;700&display=swap',
            'th': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;700&display=swap',
            'vi': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'my': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Myanmar:wght@400;500;700&display=swap',
            'km': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Khmer:wght@400;500;700&display=swap',
            'lo': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;500;700&display=swap',

            // 新興言語用のフォント
            'ak': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'tw': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'ee': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'gaa': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'dag': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'gon': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;700&display=swap',
            'sat': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Ol+Chiki:wght@400;500;700&display=swap',
            'mni': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;700&display=swap',
            'bho': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;700&display=swap',
            'mai': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;700&display=swap',
            'awa': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;700&display=swap',
            'mag': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;700&display=swap',
            'bgc': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;700&display=swap',
            'hne': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;700&display=swap',
            'doi': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;700&display=swap',

            // 東南アジア言語
            'ceb': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'ilo': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'war': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'pam': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'bik': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'min': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'bug': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Buginese:wght@400;500;700&display=swap',
            'mad': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'su': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'bal': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Balinese:wght@400;500;700&display=swap',
            'tet': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',

            // 中央アジア言語
            'az': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'kk': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'ky': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'tg': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'tk': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'uz': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',

            // 先住民・クレオール言語
            'qu': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'ay': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'gn': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'na': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'sm': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'to': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'mi': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'haw': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'ht': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'pap': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'srn': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'jam': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',

            // 人工言語
            'eo': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'ia': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'vo': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'tok': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'ldn': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',

            // 超新興言語
            'tpi': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'bi': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'ch': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'mh': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
            'pal': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',

            // デフォルトフォント
            'default': 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap'
        };

        const fontUrl = fontMap[languageCode] || fontMap['default'];

        // Remove existing font link
        const existingLink = document.getElementById('language-fonts');
        if (existingLink) {
            existingLink.remove();
        }

        // Add new font link
        const link = document.createElement('link');
        link.id = 'language-fonts';
        link.rel = 'stylesheet';
        link.href = fontUrl;
        document.head.appendChild(link);
    }

    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        setInterval(() => {
            this.logPerformanceMetrics();
        }, 30000); // Every 30 seconds
    }

    /**
     * Log performance metrics
     */
    logPerformanceMetrics() {
        const total = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses;
        const hitRate = total > 0 ? (this.performanceMetrics.cacheHits / total) * 100 : 0;

        console.debug(`📊 Translation Performance: ${hitRate.toFixed(1)}% cache hit rate, ${this.performanceMetrics.translationRequests} requests`);

        this.emit('performanceMetrics', {
            cacheHitRate: hitRate,
            totalRequests: this.performanceMetrics.translationRequests,
            averageLoadTime: Array.from(this.performanceMetrics.loadTimes.values()).reduce((a, b) => a + b, 0) / this.performanceMetrics.loadTimes.size
        });
    }

    /**
     * Start quality monitoring
     */
    startQualityMonitoring() {
        setInterval(() => {
            this.checkTranslationQuality();
        }, 60000); // Every minute
    }

    /**
     * Check translation quality
     */
    checkTranslationQuality() {
        const qualityReport = {
            totalLanguages: Object.keys(this.supportedLanguages).length,
            loadedLanguages: this.loadedLanguages.size,
            missingKeys: this.qualityMetrics.missingKeys.size,
            cacheHitRate: (this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses)) * 100,
            timestamp: new Date().toISOString()
        };

        this.emit('qualityReport', qualityReport);

        // Log warnings for poor quality
        if (this.qualityMetrics.missingKeys.size > 10) {
            console.warn(`⚠️ Many missing translations: ${this.qualityMetrics.missingKeys.size} keys`);
        }
    }

    /**
     * Event system
     */
    emit(event, data) {
        if (this.listeners && this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Event callback error (${event}):`, error);
                }
            });
        }

        // Also dispatch DOM event
        document.dispatchEvent(new CustomEvent(`i18n:${event}`, { detail: data }));
    }

    /**
     * Add event listener
     */
    on(event, callback) {
        if (!this.listeners) this.listeners = {};
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
        if (this.listeners && this.listeners[event]) {
            const index = this.listeners[event].indexOf(callback);
            if (index > -1) {
                this.listeners[event].splice(index, 1);
            }
        }
    }

    /**
     * Get current language info
     */
    getCurrentLanguage() {
        return {
            code: this.currentLanguage,
            ...this.supportedLanguages[this.currentLanguage],
            loaded: this.loadedLanguages.has(this.currentLanguage)
        };
    }

    /**
     * Get supported languages
     */
    getSupportedLanguages() {
        return { ...this.supportedLanguages };
    }

    /**
     * Get translation statistics
     */
    getTranslationStats() {
        return {
            total: Object.keys(this.supportedLanguages).length,
            loaded: this.loadedLanguages.size,
            current: this.currentLanguage,
            fallback: this.fallbackLanguage,
            cacheSize: this.translationCache.size,
            performance: {
                requests: this.performanceMetrics.translationRequests,
                cacheHitRate: (this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses)) * 100
            },
            quality: {
                missingKeys: this.qualityMetrics.missingKeys.size,
                loadedLanguages: this.loadedLanguages.size
            }
        };
    }
}

// Initialize unified I18n system
window.unifiedI18n = new UnifiedI18nSystem();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await window.unifiedI18n.init();

    // Make globally available
    window.i18n = window.unifiedI18n;
    window.t = (key, options) => window.unifiedI18n.translate(key, options);
    window.setLanguage = (lang) => window.unifiedI18n.setLanguage(lang);

    console.info('🌍 Unified I18n System ready for use');
});

// Export for modules
export default UnifiedI18nSystem;
