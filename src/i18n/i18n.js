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
    'a11y.enterVR': 'Enter VR mode',
    // VR Settings Panel Labels (Accessibility)
    'vr.settings.highContrast': 'High Contrast',
    'vr.settings.captions': 'Captions',
    'vr.settings.gazeSelect': 'Gaze Select',
    'vr.settings.haptics': 'Haptics',
    'vr.settings.captionHold': 'Caption Hold',
    'vr.settings.captionSize': 'Caption Size',
    'vr.settings.captionHeight': 'Caption Height',
    'vr.settings.soundVolume': 'Sound Volume',
    // VR Settings Panel Labels (Locomotion)
    'vr.settings.teleport': 'Teleport',
    'vr.settings.snapTurn': 'Snap Turn',
    'vr.settings.smoothMove': 'Smooth Move',
    'vr.settings.snapAngle': 'Snap Angle',
    'vr.settings.moveSpeed': 'Move Speed',
    'vr.settings.gazeTime': 'Gaze Time',
    'vr.settings.graceTime': 'Grace Time',
    'vr.settings.panelDist': 'Panel Dist',
    // VR Settings Panel Labels (UI)
    'vr.settings.webPanel': 'Web Browser Panel',
    'vr.settings.followView': 'Follow View',
    'vr.settings.curved': 'Curved',
    'vr.settings.comfort': 'Comfort',
    'vr.settings.foveation': 'Foveation',
    'vr.settings.southpaw': 'Southpaw',
    'vr.settings.search': 'Search',
    // VR Settings Panel Labels (Optional)
    'vr.settings.video360': '360° Video',
    'vr.settings.clearHistory': 'Clear History',
    'vr.settings.bookmarks': 'Bookmarks',
    // VR Settings Panel Values
    'vr.value.on': 'ON',
    'vr.value.off': 'OFF',
    'vr.value.left': 'Left',
    'vr.value.right': 'Right',
    // VR Status Messages
    'vr.msg.captionsEnabled': 'Captions enabled',
    'vr.msg.keyboardCancelled': 'Keyboard cancelled',
    'vr.msg.recentered': 'Recentered',
    'vr.msg.bookmarked': 'Bookmarked',
    'vr.msg.bookmarkRemoved': 'Bookmark removed',
    'vr.msg.bookmarkDeleted': 'Bookmark deleted',
    'vr.msg.bookmarksOpen': 'Bookmarks: open',
    'vr.msg.bookmarksClosed': 'Bookmarks: closed',
    'vr.msg.bookmarksPanel': 'Bookmarks panel',
    'vr.msg.historyCleared': 'History cleared',
    'vr.msg.browserControls': 'Browser controls',
    'vr.msg.tabStripLabel': 'Tab strip',
    'vr.msg.tabClosed': 'Tab closed',
    'vr.msg.videoPlaying': 'Video: playing',
    'vr.msg.videoPaused': 'Video: paused',
    'vr.msg.videoStopped': 'Video: stopped',
    'vr.msg.playerJoined': 'Player joined',
    'vr.msg.playerLeft': 'Player left',
    'vr.msg.noNextPage': 'No next page',
    'vr.msg.noPreviousPage': 'No previous page',
    'vr.msg.goingBack': 'Going back',
    'vr.msg.goingForward': 'Going forward',
    'vr.msg.newTab': 'New Tab',
    'vr.msg.maxTabsReached': 'Maximum tabs reached',
    'vr.msg.settingsOpen': 'Settings: open',
    'vr.msg.settingsClosed': 'Settings: closed',
    'vr.msg.moveBarLabel': 'Move bar',
    'vr.msg.panelGrabbed': 'Panel grabbed',
    'vr.msg.panelMoved': 'Panel moved',
    'vr.msg.webPanelReloadRequired': 'Reload the page to apply this setting',
    // VR Error Messages
    'vr.error.spatialAudioUnavailable': 'Spatial audio unavailable',
    'vr.error.foveationUnavailable': 'Foveation unavailable',
    'vr.error.hapticUnavailable': 'Haptic feedback unavailable',
    'vr.error.layersUnavailable': 'Sharp text rendering unavailable',
    'vr.error.aiUnavailable': 'AI recommendations unavailable',
    'vr.error.blockedUrl': 'Cannot open that address'
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
    'a11y.enterVR': 'VRモードに入る',
    // VR Settings Panel Labels (Accessibility)
    'vr.settings.highContrast': 'ハイコントラスト',
    'vr.settings.captions': 'キャプション',
    'vr.settings.gazeSelect': 'ゲーズ選択',
    'vr.settings.haptics': '触覚フィードバック',
    'vr.settings.captionHold': 'キャプション保持時間',
    'vr.settings.captionSize': 'キャプションサイズ',
    'vr.settings.captionHeight': '字幕の高さ',
    'vr.settings.soundVolume': '音量',
    // VR Settings Panel Labels (Locomotion)
    'vr.settings.teleport': 'テレポート',
    'vr.settings.snapTurn': 'スナップターン',
    'vr.settings.smoothMove': 'スムーズ移動',
    'vr.settings.snapAngle': 'スナップ角度',
    'vr.settings.moveSpeed': '移動速度',
    'vr.settings.gazeTime': 'ゲーズ時間',
    'vr.settings.graceTime': 'グレース時間',
    'vr.settings.panelDist': 'パネル距離',
    // VR Settings Panel Labels (UI)
    'vr.settings.webPanel': 'ブラウザパネル',
    'vr.settings.followView': 'ビューフォロー',
    'vr.settings.curved': 'カーブド',
    'vr.settings.comfort': 'コンフォート',
    'vr.settings.foveation': 'フォベーション',
    'vr.settings.southpaw': 'サウスポー',
    'vr.settings.search': '検索',
    // VR Settings Panel Labels (Optional)
    'vr.settings.video360': '360°ビデオ',
    'vr.settings.clearHistory': '履歴を消去',
    'vr.settings.bookmarks': 'ブックマーク',
    // VR Settings Panel Values
    'vr.value.on': 'オン',
    'vr.value.off': 'オフ',
    'vr.value.left': '左',
    'vr.value.right': '右',
    // VR Status Messages
    'vr.msg.captionsEnabled': 'キャプション有効',
    'vr.msg.keyboardCancelled': 'キーボードキャンセル',
    'vr.msg.recentered': 'リセンター完了',
    'vr.msg.bookmarked': 'ブックマーク追加',
    'vr.msg.bookmarkRemoved': 'ブックマーク削除',
    'vr.msg.bookmarkDeleted': 'ブックマーク削除',
    'vr.msg.bookmarksOpen': 'ブックマーク: 開く',
    'vr.msg.bookmarksClosed': 'ブックマーク: 閉じる',
    'vr.msg.historyCleared': '履歴を消去しました',
    'vr.msg.bookmarksPanel': 'ブックマークパネル',
    'vr.msg.browserControls': 'ブラウザコントロール',
    'vr.msg.tabStripLabel': 'タブストリップ',
    'vr.msg.tabClosed': 'タブ閉じる',
    'vr.msg.videoPlaying': 'ビデオ: 再生中',
    'vr.msg.videoPaused': 'ビデオ: 一時停止',
    'vr.msg.videoStopped': 'ビデオ: 停止',
    'vr.msg.playerJoined': 'プレイヤー参加',
    'vr.msg.playerLeft': 'プレイヤー退出',
    'vr.msg.noNextPage': '次ページなし',
    'vr.msg.noPreviousPage': '前ページなし',
    'vr.msg.goingBack': '戻る',
    'vr.msg.goingForward': '進む',
    'vr.msg.newTab': '新規タブ',
    'vr.msg.maxTabsReached': 'タブ上限に達しました',
    'vr.msg.settingsOpen': '設定: 開く',
    'vr.msg.settingsClosed': '設定: 閉じる',
    'vr.msg.moveBarLabel': '移動バー',
    'vr.msg.panelGrabbed': 'パネルをつかみました',
    'vr.msg.panelMoved': 'パネル移動完了',
    'vr.msg.webPanelReloadRequired': 'この設定を反映するにはページを再読み込みしてください',
    // VR Error Messages
    'vr.error.spatialAudioUnavailable': '空間オーディオ利用不可',
    'vr.error.foveationUnavailable': 'フォベーション利用不可',
    'vr.error.hapticUnavailable': 'ハプティックフィードバック利用不可',
    'vr.error.layersUnavailable': 'シャープテキストレンダリング利用不可',
    'vr.error.aiUnavailable': 'AIレコメンド利用不可',
    'vr.error.blockedUrl': 'このアドレスは開けません'
  }
};

function detectLanguage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && CATALOG[saved]) {
        return saved;
      }
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
  if (key in c) {
    return c[key];
  }
  if (key in CATALOG.en) {
    return CATALOG.en[key];
  }
  return key;
}

/** Set the active language, persist it, and re-apply translations to `root`. */
export function setLanguage(lang, root) {
  if (!CATALOG[lang]) {
    return;
  }
  currentLang = lang;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  } catch (e) { /* ignore */ }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }
  if (root) {
    applyTranslations(root);
  }
}

/**
 * Replace the text of [data-i18n] elements and the attributes named in
 * [data-i18n-attr="attr:key;attr2:key2"] using the current catalog.
 */
export function applyTranslations(root) {
  const scope = root || (typeof document !== 'undefined' ? document : null);
  if (!scope || !scope.querySelectorAll) {
    return;
  }
  scope.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  scope.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.getAttribute('data-i18n-attr').split(';').forEach((pair) => {
      const [attr, key] = pair.split(':').map((s) => (s ? s.trim() : s));
      if (attr && key) {
        el.setAttribute(attr, t(key));
      }
    });
  });
  if (typeof document !== 'undefined') {
    document.documentElement.lang = currentLang;
  }
}
