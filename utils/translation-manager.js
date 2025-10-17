/**
 * Translation manager for Qui Browser internationalization
 */

const fs = require('fs');
const path = require('path');
const { normalizeLanguage, DEFAULT_LANGUAGE, FALLBACK_LANGUAGE } = require('./i18n');

class TranslationManager {
  constructor(translationsDir = path.join(__dirname, '..', 'translations')) {
    this.translationsDir = translationsDir;
    this.translations = new Map();
    this.loadedLanguages = new Set();
    this.loadCoreTranslations();
  }

  /**
   * Load core translations (English and Japanese)
   */
  loadCoreTranslations() {
    const coreLanguages = ['en', 'ja'];

    for (const lang of coreLanguages) {
      try {
        this.loadLanguage(lang);
      } catch (error) {
        console.warn(`Failed to load core translation for ${lang}:`, error.message);
      }
    }
  }

  /**
   * Load translation for a specific language
   * @param {string} lang
   */
  loadLanguage(lang) {
    const normalizedLang = normalizeLanguage(lang);
    if (this.loadedLanguages.has(normalizedLang)) {
      return;
    }

    try {
      const translationPath = path.join(this.translationsDir, `${normalizedLang}.json`);
      if (fs.existsSync(translationPath)) {
        const translationData = require(translationPath);
        this.translations.set(normalizedLang, translationData);
        this.loadedLanguages.add(normalizedLang);
      } else {
        console.warn(`Translation file not found: ${translationPath}`);
      }
    } catch (error) {
      console.error(`Failed to load translation for ${normalizedLang}:`, error.message);
    }
  }

  /**
   * Get translation for a key
   * @param {string} key - Dot notation key (e.g., 'bookmarks.title')
   * @param {string} lang - Language code
   * @param {Object} [variables] - Variables to interpolate
   * @returns {string}
   */
  getTranslation(key, lang = DEFAULT_LANGUAGE, variables = {}) {
    const normalizedLang = normalizeLanguage(lang);
    let translation = this.getTranslationFromLanguage(key, normalizedLang);

    if (!translation && normalizedLang !== FALLBACK_LANGUAGE) {
      translation = this.getTranslationFromLanguage(key, FALLBACK_LANGUAGE);
    }

    if (!translation) {
      return key; // Return key as fallback
    }

    // Interpolate variables
    return this.interpolateVariables(translation, variables);
  }

  /**
   * Get translation from specific language
   * @param {string} key
   * @param {string} lang
   * @returns {string|null}
   */
  getTranslationFromLanguage(key, lang) {
    const translations = this.translations.get(lang);
    if (!translations) {
      return null;
    }

    const keys = key.split('.');
    let value = translations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return null;
      }
    }

    return typeof value === 'string' ? value : null;
  }

  /**
   * Interpolate variables in translation string
   * @param {string} text
   * @param {Object} variables
   * @returns {string}
   */
  interpolateVariables(text, variables) {
    return text.replace(/\{(\w+)\}/g, (match, key) => {
      return variables[key] !== undefined ? String(variables[key]) : match;
    });
  }

  /**
   * Get all translations for a language
   * @param {string} lang
   * @returns {Object}
   */
  getAllTranslations(lang) {
    const normalizedLang = normalizeLanguage(lang);
    return this.translations.get(normalizedLang) || this.translations.get(FALLBACK_LANGUAGE) || {};
  }

  /**
   * Check if language is loaded
   * @param {string} lang
   * @returns {boolean}
   */
  isLanguageLoaded(lang) {
    return this.loadedLanguages.has(normalizeLanguage(lang));
  }

  /**
   * Get list of loaded languages
   * @returns {string[]}
   */
  getLoadedLanguages() {
    return Array.from(this.loadedLanguages);
  }

  /**
   * Translate an object recursively
   * @param {Object} obj
   * @param {string} lang
   * @returns {Object}
   */
  translateObject(obj, lang = DEFAULT_LANGUAGE) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const result = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Try to translate if it looks like a translation key
        if (value.startsWith('translation:') || /^[a-z]+\.[a-z_\.]+$/.test(value)) {
          const translationKey = value.startsWith('translation:') ? value.slice(12) : value;
          result[key] = this.getTranslation(translationKey, lang);
        } else {
          result[key] = value;
        }
      } else if (typeof value === 'object') {
        result[key] = this.translateObject(value, lang);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Create translation helper function
   * @param {string} lang
   * @returns {Function}
   */
  createTranslator(lang) {
    return (key, variables) => this.getTranslation(key, lang, variables);
  }
}

module.exports = TranslationManager;
