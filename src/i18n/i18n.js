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
    'settings.section.a11y': 'Accessibility',
    'settings.section.locomotion': 'Movement & Comfort',
    'settings.section.display': 'Display',
    'settings.section.browsing': 'Browsing',
    'settings.section.audio': 'Audio & Media',
    'settings.section.other': 'Other',
    'vr.msg.sectionOpen': 'expanded',
    'vr.msg.sectionClosed': 'collapsed',
    'vr.content.loading': 'Loading…',
    'vr.content.failed': 'Failed to load',
    'vr.content.empty': 'Enter a URL to navigate',
    'vr.content.noCorsTitle': 'This site does not allow direct reading',
    'vr.content.noCorsDetail': 'sends no CORS header — run a reader proxy (docs/PROXY.md)',
    'vr.content.noCorsDetailBare': 'Site sends no CORS header — run a reader proxy (docs/PROXY.md)',
    'vr.content.proxyFailedTitle': 'Could not read this page',
    'vr.content.proxyFailedDetail': 'the reader proxy could not fetch it',
    'vr.content.proxyFailedBare': 'The reader proxy could not fetch this page',
    'vr.bookmarks.tabBookmarks': 'Bookmarks',
    'vr.bookmarks.tabHistory': 'History',
    'vr.bookmarks.emptyBookmarks': 'No bookmarks yet',
    'vr.bookmarks.emptyHistory': 'No history yet',
    'vr.tabs.newTab': 'New Tab',
    'vr.error.voiceMicDenied': 'Voice commands: microphone access denied',
    'vr.error.voiceUnavailable': 'Voice commands temporarily unavailable',
    'vr.a11y.captionsRegion': 'VR captions',
    'vr.a11y.alertsRegion': 'VR notifications',
    'vr.a11y.settingsRegion': 'VR settings panel',
    'vr.msg.teleported': 'Teleported',
    'vr.msg.recenterLabel': 'Recenter',
    'vr.msg.noTopSites': 'No top sites yet',
    'vr.msg.vrReady': 'VR Ready',
    'vr.msg.primaryHandLeft': 'Primary hand: left',
    'vr.msg.primaryHandRight': 'Primary hand: right',
    'vr.msg.leftHandTracked': 'Left hand tracked',
    'vr.msg.leftHandLost': 'Left hand lost',
    'vr.msg.rightHandTracked': 'Right hand tracked',
    'vr.msg.rightHandLost': 'Right hand lost',
    'app.error.loadFailed': 'Failed to load application',
    'app.error.unknown': 'Unknown error',
    'app.error.reload': 'Reload',
    'app.error.initFailed': 'Failed to initialize VR application. Check console for details.',
    'app.error.noVRSupport': 'WebXR VR is not supported on this device. Please use a VR headset.',
    'app.error.noWebXR': 'WebXR is not available. Please use a WebXR-compatible browser.',
    'app.error.enterVRFailed': 'Failed to enter VR mode. Check the browser console for details.',
    'vr.msg.toggleOn': 'ON',
    'vr.msg.toggleOff': 'OFF',
    'vr.settings.readerProxy': 'Reader Proxy',
    'vr.msg.proxySet': 'Reader proxy set',
    'vr.msg.proxyCleared': 'Reader proxy cleared — direct fetch only',
    'vr.error.proxyInvalid': 'Invalid proxy URL — use http(s), no credentials',
    'vr.prompt.proxyUrl': 'Reader proxy URL (empty to clear)',
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
    'vr.msg.webPanelOn': 'Browsing panel enabled',
    'vr.msg.webPanelOff': 'Browsing panel closed',
    // VR Error Messages
    'vr.error.spatialAudioUnavailable': 'Spatial audio unavailable',
    'vr.error.foveationUnavailable': 'Foveation unavailable',
    'vr.error.hapticUnavailable': 'Haptic feedback unavailable',
    'vr.error.layersUnavailable': 'Sharp text rendering unavailable',
    'vr.error.blockedUrl': 'Cannot open that address',
    'vr.error.loadFailed': 'Failed to load',
    'vr.msg.loadingPage': 'Loading',
    'vr.reader.links': 'Links on this page',
    'vr.reader.startPage': 'Your most-visited sites',
    'vr.msg.followingLink': 'Following link',
    'vr.settings.voice': 'Voice',
    'vr.msg.voiceOn': 'Voice commands on',
    'vr.msg.voiceOff': 'Voice commands off',
    'vr.error.voiceStartFailed': 'Voice commands could not start (microphone or browser support)'
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
    'settings.section.a11y': 'アクセシビリティ',
    'settings.section.locomotion': '移動と快適性',
    'settings.section.display': '表示',
    'settings.section.browsing': 'ブラウジング',
    'settings.section.audio': '音声とメディア',
    'settings.section.other': 'その他',
    'vr.msg.sectionOpen': '展開',
    'vr.msg.sectionClosed': '折りたたみ',
    'vr.content.loading': '読み込み中…',
    'vr.content.failed': '読み込みに失敗しました',
    'vr.content.empty': 'URL を入力してください',
    'vr.content.noCorsTitle': 'このサイトは直接読み取れません',
    'vr.content.noCorsDetail': 'は CORS ヘッダ非対応 — reader proxy が必要 (docs/PROXY.md)',
    'vr.content.noCorsDetailBare': 'CORS ヘッダ非対応 — reader proxy が必要 (docs/PROXY.md)',
    'vr.content.proxyFailedTitle': 'ページを読み取れませんでした',
    'vr.content.proxyFailedDetail': 'reader proxy が取得できませんでした',
    'vr.content.proxyFailedBare': 'reader proxy がこのページを取得できませんでした',
    'vr.bookmarks.tabBookmarks': 'ブックマーク',
    'vr.bookmarks.tabHistory': '履歴',
    'vr.bookmarks.emptyBookmarks': 'ブックマークはありません',
    'vr.bookmarks.emptyHistory': '履歴はありません',
    'vr.tabs.newTab': '新しいタブ',
    'vr.error.voiceMicDenied': '音声コマンド: マイクへのアクセスが拒否されました',
    'vr.error.voiceUnavailable': '音声コマンドは一時的に利用できません',
    'vr.a11y.captionsRegion': 'VR 字幕',
    'vr.a11y.alertsRegion': 'VR 通知',
    'vr.a11y.settingsRegion': 'VR 設定パネル',
    'vr.msg.teleported': 'テレポートしました',
    'vr.msg.recenterLabel': 'リセンター',
    'vr.msg.noTopSites': 'よく使うサイトはまだありません',
    'vr.msg.vrReady': 'VR 準備完了',
    'vr.msg.primaryHandLeft': '利き手: 左',
    'vr.msg.primaryHandRight': '利き手: 右',
    'vr.msg.leftHandTracked': '左手を検出しました',
    'vr.msg.leftHandLost': '左手を見失いました',
    'vr.msg.rightHandTracked': '右手を検出しました',
    'vr.msg.rightHandLost': '右手を見失いました',
    'app.error.loadFailed': 'アプリケーションの読み込みに失敗しました',
    'app.error.unknown': '不明なエラー',
    'app.error.reload': '再読み込み',
    'app.error.initFailed': 'VR アプリケーションの初期化に失敗しました。コンソールを確認してください。',
    'app.error.noVRSupport': 'このデバイスは WebXR VR に対応していません。VR ヘッドセットをご利用ください。',
    'app.error.noWebXR': 'WebXR を利用できません。WebXR 対応ブラウザをご利用ください。',
    'app.error.enterVRFailed': 'VR モードに入れませんでした。ブラウザのコンソールを確認してください。',
    'vr.msg.toggleOn': 'オン',
    'vr.msg.toggleOff': 'オフ',
    'vr.settings.readerProxy': 'リーダープロキシ',
    'vr.msg.proxySet': 'リーダープロキシを設定しました',
    'vr.msg.proxyCleared': 'リーダープロキシを解除しました — 直接取得のみ',
    'vr.error.proxyInvalid': 'プロキシ URL が不正です — http(s)・認証情報なしで指定してください',
    'vr.prompt.proxyUrl': 'リーダープロキシの URL（空で解除）',
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
    'vr.msg.webPanelOn': 'ブラウジングパネルを有効にしました',
    'vr.msg.webPanelOff': 'ブラウジングパネルを閉じました',
    // VR Error Messages
    'vr.error.spatialAudioUnavailable': '空間オーディオ利用不可',
    'vr.error.foveationUnavailable': 'フォベーション利用不可',
    'vr.error.hapticUnavailable': 'ハプティックフィードバック利用不可',
    'vr.error.layersUnavailable': 'シャープテキストレンダリング利用不可',
    'vr.error.blockedUrl': 'このアドレスは開けません',
    'vr.error.loadFailed': '読み込みに失敗しました',
    'vr.msg.loadingPage': '読み込み中',
    'vr.reader.links': 'このページのリンク',
    'vr.reader.startPage': 'よく見るサイト',
    'vr.msg.followingLink': 'リンクを開きます',
    'vr.settings.voice': '音声コマンド',
    'vr.msg.voiceOn': '音声コマンドをオンにしました',
    'vr.msg.voiceOff': '音声コマンドをオフにしました',
    'vr.error.voiceStartFailed': '音声コマンドを開始できません（マイクまたはブラウザ非対応）'
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
  // NOTE: the `&&` chain yields `false` (a boolean) when navigator is absent —
  // calling .toLowerCase() on it throws at module-evaluation time. Normalize
  // to a string first so SSR / worker imports stay safe.
  const nav = String(
    (typeof navigator !== 'undefined' && navigator && navigator.language) || ''
  ).toLowerCase();
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
