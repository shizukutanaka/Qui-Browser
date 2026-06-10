/**
 * Lightweight i18n for Qui Browser VR.
 *
 * - Message catalogs for English and Japanese.
 * - Language is resolved from a persisted choice, else navigator.language,
 *   else English.
 * - applyTranslations() swaps text/attributes of elements tagged with
 *   data-i18n / data-i18n-attr. No framework, no build step.
 */

const STORAGE_KEY = 'qui-browser:lang';

const CATALOG = {
  en: {
    'hero.title': 'Experience the Future of VR Browsing',
    'hero.subtitle':
      'WebXR browser with Japanese IME, hand tracking, spatial audio, and comfort system. ' +
      'Targets Meta Quest 2/3 and Pico 4. Tier 3 features are experimental.',
    'cta.enterVR': 'Enter VR Mode',
    'feat.perf.title': 'High Performance',
    'feat.perf.desc': 'Targets 90-120 FPS on Quest 3 via FFR, KTX2 textures, and object pooling',
    'feat.hand.title': 'Hand Tracking',
    'feat.hand.desc': 'Controller-free interaction with 12 gesture patterns',
    'feat.audio.title': 'Spatial Audio',
    'feat.audio.desc': '3D HRTF-based positional sound for immersive experience',
    'feat.ime.title': 'Japanese IME',
    'feat.ime.desc': 'Native Japanese text input with Hiragana/Katakana/Kanji',
    'feat.mp.title': 'Multiplayer',
    'feat.mp.desc': 'Real-time collaboration in shared VR spaces',
    'feat.ai.title': 'AI Recommendations',
    'feat.ai.desc': 'Personalized content suggestions with machine learning',
    'a11y.enterVR': 'Enter VR mode'
  },
  ja: {
    'hero.title': 'VRブラウジングの未来を体験',
    'hero.subtitle':
      '日本語IME・ハンドトラッキング・空間オーディオ・コンフォートシステムを搭載した WebXR ブラウザ。' +
      'Meta Quest 2/3 と Pico 4 に対応。Tier 3 機能は実験的です。',
    'cta.enterVR': 'VRモードに入る',
    'feat.perf.title': 'ハイパフォーマンス',
    'feat.perf.desc': 'FFR・KTX2・オブジェクトプール で Quest 3 90〜120FPS を目標',
    'feat.hand.title': 'ハンドトラッキング',
    'feat.hand.desc': 'コントローラ不要・12種のジェスチャ操作',
    'feat.audio.title': '空間オーディオ',
    'feat.audio.desc': 'HRTF ベースの3D定位サウンドで没入体験',
    'feat.ime.title': '日本語IME',
    'feat.ime.desc': 'ひらがな/カタカナ/漢字のネイティブ日本語入力',
    'feat.mp.title': 'マルチプレイヤー',
    'feat.mp.desc': '共有VR空間でのリアルタイム協調',
    'feat.ai.title': 'AIレコメンド',
    'feat.ai.desc': '機械学習によるパーソナライズされたコンテンツ提案',
    'a11y.enterVR': 'VRモードに入る'
  }
};

function detectLanguage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && CATALOG[saved]) return saved;
    }
  } catch (e) { /* ignore */ }
  const nav = (typeof navigator !== 'undefined' && (navigator.language || '')).toLowerCase();
  return nav.startsWith('ja') ? 'ja' : 'en';
}

let currentLang = detectLanguage();

export function getLanguage() {
  return currentLang;
}

export function availableLanguages() {
  return Object.keys(CATALOG);
}

/** Translate a key in the current language (falls back to English, then the key). */
export function t(key) {
  const c = CATALOG[currentLang] || CATALOG.en;
  if (key in c) return c[key];
  if (key in CATALOG.en) return CATALOG.en[key];
  return key;
}

/** Set the active language, persist it, and re-apply translations to `root`. */
export function setLanguage(lang, root) {
  if (!CATALOG[lang]) return;
  currentLang = lang;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, lang);
  } catch (e) { /* ignore */ }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  if (root) applyTranslations(root);
}

/**
 * Replace the text of [data-i18n] elements and the attributes named in
 * [data-i18n-attr="attr:key;attr2:key2"] using the current catalog.
 */
export function applyTranslations(root) {
  const scope = root || (typeof document !== 'undefined' ? document : null);
  if (!scope || !scope.querySelectorAll) return;
  scope.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  scope.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.getAttribute('data-i18n-attr').split(';').forEach((pair) => {
      const [attr, key] = pair.split(':').map((s) => (s ? s.trim() : s));
      if (attr && key) el.setAttribute(attr, t(key));
    });
  });
  if (typeof document !== 'undefined') document.documentElement.lang = currentLang;
}
