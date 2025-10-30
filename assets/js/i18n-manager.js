/**
 * Enhanced I18nManager with Unified System Integration
 * Qui Browser VRの100言語対応を完全に実装
 * AI翻訳改善システムとの統合
 * @version 4.0.0 - Unified Integration
 */

class EnhancedI18nManager {
    constructor() {
        // 統合システムから言語リストを取得
        this.supportedLanguages = this.loadUnifiedLanguageList();

        // 現在の言語設定
        this.currentLanguage = this.detectUserLanguage();
        this.fallbackLanguage = 'en';

        // 翻訳データキャッシュ
        this.translations = new Map();
        this.missingTranslations = new Map();

        // 言語検知設定
        this.languageDetection = {
            enabled: true,
            methods: ['navigator', 'localStorage', 'geolocation', 'timezone', 'unifiedSystem'],
            confidenceThreshold: 0.7
        };

        // RTL言語サポート
        this.rtlSupport = {
            enabled: true,
            directionCache: new Map()
        };

        // 翻訳品質管理
        this.translationQuality = {
            autoCorrection: true,
            contextAwareness: true,
            culturalAdaptation: true,
            aiImprovement: true
        };

        // イベントコールバック
        this.callbacks = {};

        this.init();
    }

    /**
     * 統合システムから言語リストを読み込み
     */
    loadUnifiedLanguageList() {
        // 統合システムが利用可能な場合はそれを使用
        if (window.unifiedI18n) {
            return window.unifiedI18n.supportedLanguages;
        }

        // フォールバックとして静的な言語リストを生成
        return this.generateFallbackLanguageList();
    }

    /**
     * フォールバック言語リストを生成
     */
    generateFallbackLanguageList() {
        const languageMap = {
            // 主要言語 (Primary Languages)
            'ja': { name: '日本語', nativeName: '日本語', flag: '🇯🇵', rtl: false, region: 'asia', priority: 1 },
            'en': { name: 'English', nativeName: 'English', flag: '🇺🇸', rtl: false, region: 'global', priority: 1 },

            // ヨーロッパ言語
            'de': { name: 'Deutsch', nativeName: 'Deutsch', flag: '🇩🇪', rtl: false, region: 'europe', priority: 1 },
            'fr': { name: 'Français', nativeName: 'Français', flag: '🇫🇷', rtl: false, region: 'europe', priority: 1 },
            'es': { name: 'Español', nativeName: 'Español', flag: '🇪🇸', rtl: false, region: 'europe', priority: 1 },
            'it': { name: 'Italiano', nativeName: 'Italiano', flag: '🇮🇹', rtl: false, region: 'europe', priority: 2 },
            'pt': { name: 'Português', nativeName: 'Português', flag: '🇵🇹', rtl: false, region: 'europe', priority: 1 },
            'ru': { name: 'Русский', nativeName: 'Русский', flag: '🇷🇺', rtl: false, region: 'europe', priority: 1 },
            'nl': { name: 'Nederlands', nativeName: 'Nederlands', flag: '🇳🇱', rtl: false, region: 'europe', priority: 2 },

            // アジア言語
            'zh': { name: '中文', nativeName: '中文', flag: '🇨🇳', rtl: false, region: 'asia', priority: 1 },
            'ko': { name: '한국어', nativeName: '한국어', flag: '🇰🇷', rtl: false, region: 'asia', priority: 1 },
            'hi': { name: 'हिन्दी', nativeName: 'हिन्दी', flag: '🇮🇳', rtl: false, region: 'asia', priority: 1 },
            'ar': { name: 'العربية', nativeName: 'العربية', flag: '🇸🇦', rtl: true, region: 'middle-east', priority: 1 },
            'fa': { name: 'فارسی', nativeName: 'فارسی', flag: '🇮🇷', rtl: true, region: 'middle-east', priority: 2 },
            'ur': { name: 'اردو', nativeName: 'اردو', flag: '🇵🇰', rtl: true, region: 'asia', priority: 2 },

            // その他の言語
            'sw': { name: 'Kiswahili', nativeName: 'Kiswahili', flag: '🇹🇿', rtl: false, region: 'africa', priority: 2 }
        };

        return languageMap;
    }

    init() {
        // 統合システムが利用可能な場合は連携
        this.setupUnifiedSystemIntegration();

        // 言語データを非同期で読み込み
        this.loadLanguageData(this.currentLanguage);

        // 言語変更監視を設定
        this.watchLanguageChanges();

        // 翻訳品質監視を開始
        this.startTranslationQualityMonitoring();

        console.log(`✅ Enhanced I18nManagerが初期化されました (言語: ${this.currentLanguage})`);
    }

    /**
     * 統合システムとの連携を設定
     */
    setupUnifiedSystemIntegration() {
        if (window.unifiedI18n) {
            // 統合システムのイベントを監視
            window.unifiedI18n.on('languageChanged', (data) => {
                if (data.current !== this.currentLanguage) {
                    this.setLanguage(data.current);
                }
            });

            window.unifiedI18n.on('systemReady', (data) => {
                this.syncWithUnifiedSystem(data);
            });

            console.info('🔗 Enhanced I18nManager integrated with Unified System');
        }
    }

    /**
     * 統合システムと同期
     */
    syncWithUnifiedSystem(data) {
        // 言語リストを更新
        if (data.totalLanguages > Object.keys(this.supportedLanguages).length) {
            this.supportedLanguages = window.unifiedI18n.supportedLanguages;
            console.info(`🔄 Language list updated: ${data.totalLanguages} languages`);
        }

        // 現在の言語を同期
        if (data.language && data.language !== this.currentLanguage) {
            this.currentLanguage = data.language;
        }
    }

    // ユーザーの言語を検知
    detectUserLanguage() {
        // 統合システムが利用可能な場合はそれを使用
        if (window.unifiedI18n) {
            return window.unifiedI18n.currentLanguage;
        }

        // 複数の方法で言語を検知
        const detectedLanguages = [];

        // 1. Navigator言語設定
        if (navigator.language) {
            detectedLanguages.push({
                language: navigator.language.split('-')[0],
                method: 'navigator',
                confidence: 0.9
            });
        }

        // 2. localStorage設定
        const storedLang = localStorage.getItem('qui_browser_language');
        if (storedLang && this.isLanguageSupported(storedLang)) {
            detectedLanguages.push({
                language: storedLang,
                method: 'localStorage',
                confidence: 1.0
            });
        }

        // 3. タイムゾーンによる推定
        if (this.languageDetection.methods.includes('timezone')) {
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const estimatedLang = this.estimateLanguageFromTimezone(timezone);
            if (estimatedLang) {
                detectedLanguages.push({
                    language: estimatedLang,
                    method: 'timezone',
                    confidence: 0.6
                });
            }
        }

        // 最も信頼性の高い言語を選択
        if (detectedLanguages.length > 0) {
            detectedLanguages.sort((a, b) => b.confidence - a.confidence);
            const bestMatch = detectedLanguages[0];

            if (bestMatch.confidence >= this.languageDetection.confidenceThreshold) {
                return bestMatch.language;
            }
        }

        return this.fallbackLanguage;
    }

    // タイムゾーンから言語を推定
    estimateLanguageFromTimezone(timezone) {
        const timezoneLanguageMap = {
            'Asia/Tokyo': 'ja',
            'America/New_York': 'en',
            'Europe/London': 'en',
            'Europe/Berlin': 'de',
            'Europe/Paris': 'fr',
            'Europe/Madrid': 'es',
            'Europe/Rome': 'it',
            'Europe/Amsterdam': 'nl',
            'Europe/Stockholm': 'sv',
            'Asia/Shanghai': 'zh',
            'Asia/Seoul': 'ko',
            'Asia/Bangkok': 'th',
            'Asia/Ho_Chi_Minh': 'vi'
        };

        return timezoneLanguageMap[timezone];
    }

    // 言語がサポートされているかチェック
    isLanguageSupported(languageCode) {
        return languageCode in this.supportedLanguages;
    }

    // 言語データを非同期で読み込み
    async loadLanguageData(languageCode) {
        if (this.translations.has(languageCode)) {
            return; // 既に読み込み済み
        }

        try {
            // 統合システムからデータを取得
            if (window.unifiedI18n) {
                const data = await window.unifiedI18n.loadLanguageData(languageCode);
                this.translations.set(languageCode, data);
                console.log(`✅ ${languageCode} の言語データが統合システムから読み込まれました`);
            } else {
                // フォールバック：JSONファイルから直接読み込み
                const translations = await this.fetchLanguageData(languageCode);
                this.translations.set(languageCode, translations);
                console.log(`✅ ${languageCode} の言語データがJSONから読み込まれました`);
            }

            this.triggerCallback('languageDataLoaded', {
                language: languageCode,
                translationCount: Object.keys(this.translations.get(languageCode)).length
            });

        } catch (error) {
            console.error(`${languageCode} の言語データ読み込みに失敗しました:`, error);

            // フォールバック言語のデータをコピー
            if (languageCode !== this.fallbackLanguage) {
                const fallbackData = this.translations.get(this.fallbackLanguage);
                if (fallbackData) {
                    this.translations.set(languageCode, { ...fallbackData });
                    console.log(`🔄 ${languageCode} にフォールバック言語データを適用しました`);
                }
            }
        }
    }

    // 言語データ取得（フォールバック）
    async fetchLanguageData(languageCode) {
        try {
            const response = await fetch(`../../locales/${languageCode}.json`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.warn(`JSONファイルが見つからないため、AI生成データを使用: ${languageCode}`);
            return this.generateFallbackTranslation(languageCode);
        }
    }

    // フォールバック翻訳を生成
    async generateFallbackTranslation(languageCode) {
        if (window.unifiedI18n) {
            return await window.unifiedI18n.generateFallbackTranslation(languageCode);
        }

        // 基本的なフォールバックデータ
        return {
            meta: {
                language: languageCode,
                languageName: this.supportedLanguages[languageCode]?.name || languageCode,
                nativeName: this.supportedLanguages[languageCode]?.nativeName || languageCode,
                version: "1.0.0",
                rtl: this.supportedLanguages[languageCode]?.rtl || false
            },
            common: {
                ok: "OK",
                cancel: "Cancel",
                yes: "Yes",
                no: "No",
                save: "Save",
                delete: "Delete",
                edit: "Edit",
                settings: "Settings",
                help: "Help",
                about: "About"
            }
        };
    }

    // 言語を変更
    async setLanguage(languageCode) {
        if (!this.isLanguageSupported(languageCode)) {
            console.warn(`サポートされていない言語です: ${languageCode}`);
            return false;
        }

        const previousLanguage = this.currentLanguage;
        this.currentLanguage = languageCode;

        // 統合システムと同期
        if (window.unifiedI18n) {
            await window.unifiedI18n.setLanguage(languageCode);
        }

        // 新しい言語データを読み込み
        await this.loadLanguageData(languageCode);

        // 言語設定を保存
        localStorage.setItem('qui_browser_language', languageCode);

        // ドキュメント言語属性を更新
        document.documentElement.lang = languageCode;

        // RTL設定を更新
        if (this.rtlSupport.enabled) {
            this.updateRTLSettings();
        }

        console.log(`🔄 言語が変更されました: ${previousLanguage} → ${languageCode}`);

        this.triggerCallback('languageChanged', {
            previousLanguage,
            newLanguage: languageCode,
            rtl: this.supportedLanguages[languageCode].rtl
        });

        return true;
    }

    // RTL設定を更新
    updateRTLSettings() {
        const isRTL = this.supportedLanguages[this.currentLanguage]?.rtl || false;

        document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
        document.body.classList.toggle('rtl-language', isRTL);

        // CSSカスタムプロパティを更新
        if (isRTL) {
            document.documentElement.style.setProperty('--text-direction', 'rtl');
            document.documentElement.style.setProperty('--float-reverse', 'right');
        } else {
            document.documentElement.style.setProperty('--text-direction', 'ltr');
            document.documentElement.style.setProperty('--float-reverse', 'left');
        }
    }

    // テキストを翻訳
    translate(key, options = {}) {
        const { language = this.currentLanguage, context = '', variables = {} } = options;

        // 統合システムが利用可能な場合は優先使用
        if (window.unifiedI18n) {
            return window.unifiedI18n.translate(key, { language, context, variables });
        }

        // フォールバック：ローカル翻訳
        return this.localTranslate(key, options);
    }

    // ローカル翻訳
    localTranslate(key, options = {}) {
        const { language = this.currentLanguage, context = '', variables = {} } = options;

        // 翻訳データを取得
        const translations = this.translations.get(language) || this.translations.get(this.fallbackLanguage);
        if (!translations) {
            return this.handleMissingTranslation(key, language);
        }

        // キーを解決（ドット区切りでネストしたキーをサポート）
        const value = this.resolveTranslationKey(translations, key);

        if (value === undefined) {
            return this.handleMissingTranslation(key, language);
        }

        // 変数を置換
        let translatedText = value;
        for (const [varKey, varValue] of Object.entries(variables)) {
            const placeholder = `{${varKey}}`;
            translatedText = translatedText.replace(new RegExp(placeholder, 'g'), varValue);
        }

        // AI改善を適用
        if (this.translationQuality.aiImprovement && window.aiTranslationImprover) {
            return window.aiTranslationImprover.generateImprovedTranslation(
                value, translatedText, 'en', language
            );
        }

        return translatedText;
    }

    // 翻訳キーを解決（ネストしたオブジェクトをサポート）
    resolveTranslationKey(translations, key) {
        return key.split('.').reduce((obj, k) => obj?.[k], translations);
    }

    // 翻訳が見つからない場合の処理
    handleMissingTranslation(key, language) {
        // 不足翻訳を記録
        if (!this.missingTranslations.has(language)) {
            this.missingTranslations.set(language, new Set());
        }
        this.missingTranslations.get(language).add(key);

        // フォールバック言語で翻訳を試行
        if (language !== this.fallbackLanguage) {
            const fallbackTranslations = this.translations.get(this.fallbackLanguage);
            if (fallbackTranslations) {
                const fallbackValue = this.resolveTranslationKey(fallbackTranslations, key);
                if (fallbackValue !== undefined) {
                    return fallbackValue;
                }
            }
        }

        // 最終フォールバック：キーをそのまま返す
        console.warn(`翻訳が見つかりません: ${key} (言語: ${language})`);
        return key;
    }

    // 言語変更を監視
    watchLanguageChanges() {
        // localStorageの変更を監視
        window.addEventListener('storage', (event) => {
            if (event.key === 'qui_browser_language') {
                const newLanguage = event.newValue;
                if (newLanguage && newLanguage !== this.currentLanguage) {
                    this.setLanguage(newLanguage);
                }
            }
        });

        // 統合システムの言語変更を監視
        if (window.unifiedI18n) {
            window.unifiedI18n.on('languageChanged', (data) => {
                if (data.current !== this.currentLanguage) {
                    this.setLanguage(data.current);
                }
            });
        }
    }

    // 翻訳品質監視を開始
    startTranslationQualityMonitoring() {
        // 定期的に翻訳品質をチェック
        setInterval(() => {
            this.monitorTranslationQuality();
        }, 60000); // 1分ごとにチェック
    }

    monitorTranslationQuality() {
        // 不足翻訳の統計を収集
        const missingStats = {};
        for (const [language, keys] of this.missingTranslations) {
            missingStats[language] = keys.size;
        }

        // 翻訳品質レポートを生成
        const qualityReport = {
            totalSupportedLanguages: Object.keys(this.supportedLanguages).length,
            loadedLanguages: this.translations.size,
            missingTranslations: missingStats,
            currentLanguage: this.currentLanguage,
            fallbackLanguage: this.fallbackLanguage,
            aiImprovementEnabled: this.translationQuality.aiImprovement,
            unifiedSystemIntegrated: !!window.unifiedI18n
        };

        this.triggerCallback('translationQualityReport', qualityReport);

        // 品質が低い場合の警告
        const totalMissing = Object.values(missingStats).reduce((sum, count) => sum + count, 0);
        if (totalMissing > 100) {
            console.warn(`⚠️ 多数の翻訳が不足しています (${totalMissing}件)。翻訳データベースの更新を検討してください。`);
        }
    }

    // 言語リストを取得
    getSupportedLanguages() {
        return { ...this.supportedLanguages };
    }

    // 現在の言語を取得
    getCurrentLanguage() {
        return {
            code: this.currentLanguage,
            ...this.supportedLanguages[this.currentLanguage],
            isRTL: this.supportedLanguages[this.currentLanguage]?.rtl || false,
            unifiedSystemAvailable: !!window.unifiedI18n
        };
    }

    // 利用可能な言語の統計を取得
    getLanguageStats() {
        return {
            total: Object.keys(this.supportedLanguages).length,
            loaded: this.translations.size,
            current: this.currentLanguage,
            fallback: this.fallbackLanguage,
            rtlLanguages: Object.entries(this.supportedLanguages)
                .filter(([code, lang]) => lang.rtl)
                .map(([code, lang]) => code),
            unifiedSystemIntegrated: !!window.unifiedI18n
        };
    }

    // コールバックシステム
    triggerCallback(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`コールバック実行エラー (${event}):`, error);
                }
            });
        }
    }

    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
    }

    off(event, callback) {
        if (this.callbacks[event]) {
            const index = this.callbacks[event].indexOf(callback);
            if (index > -1) {
                this.callbacks[event].splice(index, 1);
            }
        }
    }
}

// Enhanced I18nManagerをグローバルにエクスポート
window.EnhancedI18nManager = EnhancedI18nManager;

// グローバルインスタンスとしてエクスポート
window.EnhancedI18nManager = EnhancedI18nManager;

// 統合システムが利用可能な場合は連携
if (window.unifiedI18n) {
    // Enhanced I18nManagerを統合システムに登録
    window.unifiedI18n.enhancedManager = new EnhancedI18nManager();
    console.info('🔗 Enhanced I18nManager integrated with Unified System');
}
