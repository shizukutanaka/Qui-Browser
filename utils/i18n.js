/**
 * Internationalization utilities for Qui Browser
 * Supports 50+ languages with automatic detection and user preferences
 */

const SUPPORTED_LANGUAGES = {
  // East Asia
  'ja': { name: '日本語', nativeName: '日本語', flag: '🇯🇵', rtl: false },
  'ko': { name: '한국어', nativeName: '한국어', flag: '🇰🇷', rtl: false },
  'zh-CN': { name: '简体中文', nativeName: '简体中文', flag: '🇨🇳', rtl: false },
  'zh-TW': { name: '繁體中文', nativeName: '繁體中文', flag: '🇹🇼', rtl: false },
  'th': { name: 'ไทย', nativeName: 'ไทย', flag: '🇹🇭', rtl: false },
  'vi': { name: 'Tiếng Việt', nativeName: 'Tiếng Việt', flag: '🇻🇳', rtl: false },

  // South Asia
  'hi': { name: 'हिन्दी', nativeName: 'हिन्दी', flag: '🇮🇳', rtl: false },
  'bn': { name: 'বাংলা', nativeName: 'বাংলা', flag: '🇧🇩', rtl: false },
  'ta': { name: 'தமிழ்', nativeName: 'தமிழ்', flag: '🇮🇳', rtl: false },
  'te': { name: 'తెలుగు', nativeName: 'తెలుగు', flag: '🇮🇳', rtl: false },
  'mr': { name: 'मराठी', nativeName: 'मराठी', flag: '🇮🇳', rtl: false },
  'ur': { name: 'اردو', nativeName: 'اردو', flag: '🇵🇰', rtl: true },

  // Southeast Asia
  'id': { name: 'Bahasa Indonesia', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', rtl: false },
  'ms': { name: 'Bahasa Melayu', nativeName: 'Bahasa Melayu', flag: '🇲🇾', rtl: false },
  'tl': { name: 'Filipino', nativeName: 'Filipino', flag: '🇵🇭', rtl: false },

  // Middle East & Central Asia
  'ar': { name: 'العربية', nativeName: 'العربية', flag: '🇸🇦', rtl: true },
  'fa': { name: 'فارسی', nativeName: 'فارسی', flag: '🇮🇷', rtl: true },
  'he': { name: 'עברית', nativeName: 'עברית', flag: '🇮🇱', rtl: true },
  'tr': { name: 'Türkçe', nativeName: 'Türkçe', flag: '🇹🇷', rtl: false },
  'az': { name: 'Azərbaycan dili', nativeName: 'Azərbaycan dili', flag: '🇦🇿', rtl: false },
  'kk': { name: 'Қазақ тілі', nativeName: 'Қазақ тілі', flag: '🇰🇿', rtl: false },
  'uz': { name: 'O\'zbekcha', nativeName: 'O\'zbekcha', flag: '🇺🇿', rtl: false },

  // Europe
  'en': { name: 'English', nativeName: 'English', flag: '🇺🇸', rtl: false },
  'es': { name: 'Español', nativeName: 'Español', flag: '🇪🇸', rtl: false },
  'fr': { name: 'Français', nativeName: 'Français', flag: '🇫🇷', rtl: false },
  'de': { name: 'Deutsch', nativeName: 'Deutsch', flag: '🇩🇪', rtl: false },
  'it': { name: 'Italiano', nativeName: 'Italiano', flag: '🇮🇹', rtl: false },
  'pt': { name: 'Português', nativeName: 'Português', flag: '🇵🇹', rtl: false },
  'ru': { name: 'Русский', nativeName: 'Русский', flag: '🇷🇺', rtl: false },
  'pl': { name: 'Polski', nativeName: 'Polski', flag: '🇵🇱', rtl: false },
  'nl': { name: 'Nederlands', nativeName: 'Nederlands', flag: '🇳🇱', rtl: false },
  'sv': { name: 'Svenska', nativeName: 'Svenska', flag: '🇸🇪', rtl: false },
  'da': { name: 'Dansk', nativeName: 'Dansk', flag: '🇩🇰', rtl: false },
  'no': { name: 'Norsk', nativeName: 'Norsk', flag: '🇳🇴', rtl: false },
  'fi': { name: 'Suomi', nativeName: 'Suomi', flag: '🇫🇮', rtl: false },
  'cs': { name: 'Čeština', nativeName: 'Čeština', flag: '🇨🇿', rtl: false },
  'sk': { name: 'Slovenčina', nativeName: 'Slovenčina', flag: '🇸🇰', rtl: false },
  'hu': { name: 'Magyar', nativeName: 'Magyar', flag: '🇭🇺', rtl: false },
  'ro': { name: 'Română', nativeName: 'Română', flag: '🇷🇴', rtl: false },
  'bg': { name: 'Български', nativeName: 'Български', flag: '🇧🇬', rtl: false },
  'hr': { name: 'Hrvatski', nativeName: 'Hrvatski', flag: '🇭🇷', rtl: false },
  'sl': { name: 'Slovenščina', nativeName: 'Slovenščina', flag: '🇸🇮', rtl: false },
  'et': { name: 'Eesti', nativeName: 'Eesti', flag: '🇪🇪', rtl: false },
  'lv': { name: 'Latviešu', nativeName: 'Latviešu', flag: '🇱🇻', rtl: false },
  'lt': { name: 'Lietuvių', nativeName: 'Lietuvių', flag: '🇱🇹', rtl: false },
  'el': { name: 'Ελληνικά', nativeName: 'Ελληνικά', flag: '🇬🇷', rtl: false },

  // Americas
  'pt-BR': { name: 'Português (Brasil)', nativeName: 'Português (Brasil)', flag: '🇧🇷', rtl: false },

  // Africa
  'sw': { name: 'Kiswahili', nativeName: 'Kiswahili', flag: '🇹🇿', rtl: false },
  'am': { name: 'አማርኛ', nativeName: 'አማርኛ', flag: '🇪🇹', rtl: false },
  'ha': { name: 'Hausa', nativeName: 'Hausa', flag: '🇳🇬', rtl: false },
  'yo': { name: 'Yorùbá', nativeName: 'Yorùbá', flag: '🇳🇬', rtl: false },
  'zu': { name: 'isiZulu', nativeName: 'isiZulu', flag: '🇿🇦', rtl: false },
  'af': { name: 'Afrikaans', nativeName: 'Afrikaans', flag: '🇿🇦', rtl: false }
};

const DEFAULT_LANGUAGE = 'en';
const FALLBACK_LANGUAGE = 'en';

/**
 * Detect language from request headers
 * @param {import('http').IncomingMessage} req
 * @returns {string}
 */
function detectLanguageFromHeaders(req) {
  if (!req || !req.headers) {
    return DEFAULT_LANGUAGE;
  }

  // Check Accept-Language header
  const acceptLanguage = req.headers['accept-language'];
  if (typeof acceptLanguage === 'string') {
    const languages = parseAcceptLanguage(acceptLanguage);
    for (const lang of languages) {
      if (SUPPORTED_LANGUAGES[lang]) {
        return lang;
      }
      // Try language prefix (e.g., 'zh' for 'zh-CN')
      const prefix = lang.split('-')[0];
      if (SUPPORTED_LANGUAGES[prefix]) {
        return prefix;
      }
    }
  }

  return DEFAULT_LANGUAGE;
}

/**
 * Parse Accept-Language header
 * @param {string} header
 * @returns {string[]}
 */
function parseAcceptLanguage(header) {
  return header
    .split(',')
    .map(item => {
      const [lang, q] = item.trim().split(';q=');
      return {
        lang: lang.toLowerCase(),
        q: q ? parseFloat(q) : 1.0
      };
    })
    .sort((a, b) => b.q - a.q)
    .map(item => item.lang);
}

/**
 * Normalize language code
 * @param {string} lang
 * @returns {string}
 */
function normalizeLanguage(lang) {
  if (!lang || typeof lang !== 'string') {
    return DEFAULT_LANGUAGE;
  }

  const normalized = lang.toLowerCase().trim();

  // Check exact match
  if (SUPPORTED_LANGUAGES[normalized]) {
    return normalized;
  }

  // Check prefix match
  const prefix = normalized.split('-')[0];
  if (SUPPORTED_LANGUAGES[prefix]) {
    return prefix;
  }

  return DEFAULT_LANGUAGE;
}

/**
 * Get language info
 * @param {string} lang
 * @returns {Object}
 */
function getLanguageInfo(lang) {
  const normalized = normalizeLanguage(lang);
  return SUPPORTED_LANGUAGES[normalized] || SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE];
}

/**
 * Check if language is RTL
 * @param {string} lang
 * @returns {boolean}
 */
function isRTLLanguage(lang) {
  const info = getLanguageInfo(lang);
  return info.rtl || false;
}

module.exports = {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  detectLanguageFromHeaders,
  parseAcceptLanguage,
  normalizeLanguage,
  getLanguageInfo,
  isRTLLanguage
};
