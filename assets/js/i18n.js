import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import unified I18n system
import UnifiedI18nSystem from './unified-i18n-system.js';

// Import translation files (fallback)
import en from '../../locales/en.json';
import ja from '../../locales/ja.json';
import es from '../../locales/es.json';
import jv from '../../locales/jv.json';
import de from '../../locales/de.json';
import pt from '../../locales/pt.json';
import ru from '../../locales/ru.json';
import ko from '../../locales/ko.json';
import ar from '../../locales/ar.json';
import zh from '../../locales/zh.json';
import hi from '../../locales/hi.json';
import it from '../../locales/it.json';
import bn from '../../locales/bn.json';
import ur from '../../locales/ur.json';
import id from '../../locales/id.json';
import sw from '../../locales/sw.json';
import vi from '../../locales/vi.json';
import tr from '../../locales/tr.json';
import ta from '../../locales/ta.json';
import tl from '../../locales/tl.json';
import te from '../../locales/te.json';

// Import language learning system
import { MachineTranslationService, LanguageLearningSystem } from './language-learning.js';

// Import AI translation improver
import { AITranslationImprover } from './ai-translation-improver.js';

// Import community translation system
import { CommunityTranslationSystem } from './community-translation.js';

// Import multimedia translation system
import { MultimediaTranslationSystem } from './multimedia-translation.js';

// Import real-time translation system
import { RealTimeTranslationSystem } from './real-time-translation.js';

// Import personalized language learning system
import { PersonalizedLanguageLearningSystem } from './personalized-language-learning.js';

// Import cross-platform learning system
import { CrossPlatformLearningSystem } from './cross-platform-learning.js';

// Import advanced voice processing system
import { AdvancedVoiceProcessingSystem } from './advanced-voice-processing.js';

// Initialize unified I18n system first
const unifiedI18n = new UnifiedI18nSystem();

// Language list with native names (generated from unified system)
const languages = Object.entries(unifiedI18n.supportedLanguages).map(([code, lang]) => ({
  code,
  name: lang.name,
  nativeName: lang.nativeName,
  flag: lang.flag,
  rtl: lang.rtl,
  region: lang.region,
  priority: lang.priority
}));

// Initialize i18next with fallback support
i18next
  .use(LanguageDetector)
  .init({
    fallbackLng: 'en',
    debug: true,
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng'
    },
    resources: {
      en: { translation: en },
      ja: { translation: ja },
      es: { translation: es },
      fr: { translation: {} }, // Will be loaded dynamically
      de: { translation: de },
      pt: { translation: pt },
      ru: { translation: ru },
      ko: { translation: ko },
      ar: { translation: ar },
      zh: { translation: zh },
      hi: { translation: hi },
      it: { translation: it },
      bn: { translation: bn },
      ur: { translation: ur },
      id: { translation: id },
      sw: { translation: sw },
      vi: { translation: vi },
      tr: { translation: tr },
      ta: { translation: ta },
      fa: { translation: {} },
      tl: { translation: tl },
      mr: { translation: {} },
      te: { translation: te },
    },
    interpolation: {
      escapeValue: false // React already escapes values
    }
  })
  .then(async () => {
    console.info('i18next initialized successfully');

    // Sync with unified system
    await syncWithUnifiedSystem();

    // Update the page language and direction
    updatePageLanguage();
    // Trigger translation update
    updateContent();
    // Initialize advanced voice processing system
    await window.advancedVoiceProcessing.initialize();
    // Initialize machine translation service
    await window.machineTranslation.initialize();
    // Initialize AI translation improver
    await window.aiTranslationImprover.initialize();
    // Initialize community translation system
    await window.communityTranslation.initialize();
    // Initialize multimedia translation system
    await window.multimediaTranslation.initialize();
    // Initialize real-time translation system
    await window.realTimeTranslation.initialize();
    // Initialize domain-specific translation system
    await window.domainTranslation.initialize();

    // Run quality tests in development mode
    if (process?.env?.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
      setTimeout(() => runQualityTests(), 1000);
    }
  })
  .catch(error => {
    console.error('i18next initialization failed:', error);
  });

/**
 * Sync with unified I18n system
 */
async function syncWithUnifiedSystem() {
  // Listen to unified system events
  unifiedI18n.on('languageChanged', (data) => {
    console.info('Unified system language changed:', data);
    // Sync current language
    if (data.current !== i18next.language) {
      i18next.changeLanguage(data.current);
    }
  });

  unifiedI18n.on('systemReady', (data) => {
    console.info('Unified I18n system ready:', data);
    // Update language options
    updateLanguageOptions();
  });

  // Override i18next translate function to use unified system
  const originalTranslate = i18next.t.bind(i18next);
  i18next.t = function(key, options = {}) {
    // Try unified system first for better quality
    const unifiedResult = unifiedI18n.translate(key, options);
    if (unifiedResult && unifiedResult !== key) {
      return unifiedResult;
    }

    // Fallback to i18next
    return originalTranslate(key, options);
  };
}

/**
 * Update language options in UI
 */
function updateLanguageOptions() {
  const langOptions = document.querySelector('.language-options');
  if (langOptions) {
    langOptions.innerHTML = '';

    // Sort languages by priority and region
    const sortedLanguages = languages.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.region.localeCompare(b.region);
    });

    sortedLanguages.forEach(lang => {
      const button = document.createElement('button');
      button.className = 'lang-btn';
      button.innerHTML = `${lang.flag} ${lang.nativeName}`;
      button.dataset.lang = lang.code;
      button.title = `${lang.name} (${lang.region})`;

      if (lang.code === unifiedI18n.currentLanguage) {
        button.classList.add('active');
      }

      button.addEventListener('click', () => {
        changeLanguage(lang.code);
        document.getElementById('language-panel')?.classList.add('hidden');
      });

      langOptions.appendChild(button);
    });
  }
}

// Function to update page language and direction
function updatePageLanguage() {
  const currentLang = i18next.language;
  document.documentElement.lang = currentLang;

  // Set direction for RTL languages
  const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
  document.documentElement.dir = rtlLanguages.includes(currentLang) ? 'rtl' : 'ltr';

  // Load appropriate fonts for the language
  loadLanguageSpecificFonts(currentLang);
}

// Function to load language-specific fonts
function loadLanguageSpecificFonts(lang) {
  const fontLink = document.getElementById('dynamic-fonts');
  if (fontLink) {
    fontLink.remove();
  }

  const link = document.createElement('link');
  link.id = 'dynamic-fonts';
  link.rel = 'stylesheet';
  link.href = getFontUrl(lang);
  document.head.appendChild(link);
}

// Function to get font URL based on language
function getFontUrl(lang) {
  const fontMap = {
    'ja': 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap',
    'ko': 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap',
    'zh': 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap',
    'ar': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;700&display=swap',
    'ur': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;700&display=swap',
    'ru': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
    'hi': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;700&display=swap',
    'bn': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;700&display=swap',
    'id': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
    'sw': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
    'vi': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
    'tr': 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap',
    'ta': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;700&display=swap',
    'te': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;500;700&display=swap',
    'default': 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap'
  };

  return fontMap[lang] || fontMap['default'];
}

// Function to validate translation completeness
function validateTranslations() {
  const missingKeys = [];
  const incompleteKeys = [];
  const languagesToCheck = Object.keys(i18next.services.resourceStore.data);

  languagesToCheck.forEach(lang => {
    if (lang === 'dev') return;

    const englishKeys = getAllKeys(en.translation);
    const currentKeys = getAllKeys(i18next.getDataByLanguage(lang).translation);

    englishKeys.forEach(key => {
      if (!currentKeys.includes(key)) {
        missingKeys.push(`${lang}: ${key}`);
      } else {
        // Check if translation is not just the key itself
        const translation = i18next.t(key, { lng: lang });
        if (translation === key || translation === '') {
          incompleteKeys.push(`${lang}: ${key}`);
        }
      }
    });
  });

  if (missingKeys.length > 0) {
    console.warn('Missing translations:', missingKeys);
  }

  if (incompleteKeys.length > 0) {
    console.warn('Incomplete translations:', incompleteKeys);
  }

  if (missingKeys.length === 0 && incompleteKeys.length === 0) {
    console.info('All translations are complete and properly filled');
  }

  // Store validation results globally for debugging
  window.translationValidation = {
    missingKeys,
    incompleteKeys,
    totalLanguages: languagesToCheck.length - 1,
    timestamp: new Date().toISOString()
  };
}

// Helper function to get all keys from nested object
function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        keys = keys.concat(getAllKeys(obj[key], newKey));
      } else {
        keys.push(newKey);
      }
    }
  }
  return keys;
}

// Function to update content with translations
export function updateContent() {
  // Update all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translatedText = i18next.t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = translatedText;
    } else {
      el.textContent = translatedText;
    }
  });

  // Update all elements with data-i18n-html
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    el.innerHTML = i18next.t(key);
  });

  // Update aria-labels
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria-label');
    el.setAttribute('aria-label', i18next.t(key));
  });

  // Update language panel with native names
  const langOptions = document.querySelector('.language-options');
  if (langOptions) {
    langOptions.innerHTML = '';
    languages.forEach(lang => {
      const button = document.createElement('button');
      button.className = 'lang-btn';
      button.textContent = lang.nativeName;
      button.dataset.lang = lang.code;
      if (lang.code === i18next.language) {
        button.classList.add('active');
      }
      button.addEventListener('click', () => {
        changeLanguage(lang.code);
        document.getElementById('language-panel').classList.add('hidden');
      });
      langOptions.appendChild(button);
    });
  }

  // Validate translations
  validateTranslations();
}

// Function to change language
export function changeLanguage(lang) {
  i18next.changeLanguage(lang).then(() => {
    updatePageLanguage();
    updateContent();
    // Save to localStorage
    localStorage.setItem('i18nextLng', lang);
    // Trigger custom event for other components
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
  });
}

// Export i18next instance for advanced usage
export default i18next;

// Make available globally
window.i18n = i18next;

// Quality testing function
async function runQualityTests() {
  console.info('Running translation quality tests...');

  try {
    // Load the quality check module dynamically
    await window.moduleLoader.load(['i18n-quality-check']);

    // Run tests if available
    if (window.runTranslationQualityTests) {
      const results = await window.runTranslationQualityTests();
      console.info('Translation quality test completed:', results);
    }
  } catch (error) {
    console.warn('Quality tests could not be run:', error.message);
  }
}
