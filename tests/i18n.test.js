/**
 * Unit tests for the lightweight i18n module.
 */
const { t, setLanguage, getLanguage, availableLanguages } = require('../src/i18n/i18n.js');

describe('src/i18n/i18n', () => {
  test('exposes en and ja catalogs', () => {
    expect(availableLanguages()).toEqual(expect.arrayContaining(['en', 'ja']));
  });

  test('translates a key in the selected language', () => {
    setLanguage('en');
    expect(t('cta.enterVR')).toBe('Enter VR Mode');
    setLanguage('ja');
    expect(getLanguage()).toBe('ja');
    expect(t('cta.enterVR')).toBe('VRモードに入る');
  });

  test('translates vr.msg.maxTabsReached (WCAG 4.1.3 status message)', () => {
    setLanguage('en');
    expect(t('vr.msg.maxTabsReached')).toBe('Maximum tabs reached');
    setLanguage('ja');
    expect(t('vr.msg.maxTabsReached')).toBe('タブ上限に達しました');
    setLanguage('en');
  });

  test('translates vr.msg.settingsOpen / settingsClosed (settings panel toggle)', () => {
    setLanguage('en');
    expect(t('vr.msg.settingsOpen')).toBe('Settings: open');
    expect(t('vr.msg.settingsClosed')).toBe('Settings: closed');
    setLanguage('ja');
    expect(t('vr.msg.settingsOpen')).toBe('設定: 開く');
    expect(t('vr.msg.settingsClosed')).toBe('設定: 閉じる');
    setLanguage('en');
  });

  test('translates vr.msg.moveBarLabel / panelGrabbed / panelMoved (grab-to-move)', () => {
    setLanguage('en');
    expect(t('vr.msg.moveBarLabel')).toBe('Move bar');
    expect(t('vr.msg.panelGrabbed')).toBe('Panel grabbed');
    expect(t('vr.msg.panelMoved')).toBe('Panel moved');
    setLanguage('ja');
    expect(t('vr.msg.moveBarLabel')).toBe('移動バー');
    expect(t('vr.msg.panelGrabbed')).toBe('パネルをつかみました');
    expect(t('vr.msg.panelMoved')).toBe('パネル移動完了');
    setLanguage('en');
  });

  test('translates vr.settings.captionHeight (XAUR caption position setting)', () => {
    setLanguage('en');
    expect(t('vr.settings.captionHeight')).toBe('Caption Height');
    setLanguage('ja');
    expect(t('vr.settings.captionHeight')).toBe('字幕の高さ');
    setLanguage('en');
  });

  test('translates vr.settings.clearHistory / vr.msg.historyCleared (privacy action)', () => {
    setLanguage('en');
    expect(t('vr.settings.clearHistory')).toBe('Clear History');
    expect(t('vr.msg.historyCleared')).toBe('History cleared');
    setLanguage('ja');
    expect(t('vr.settings.clearHistory')).toBe('履歴を消去');
    expect(t('vr.msg.historyCleared')).toBe('履歴を消去しました');
    setLanguage('en');
  });

  test('translates vr.settings.haptics (haptics enable toggle)', () => {
    setLanguage('en');
    expect(t('vr.settings.haptics')).toBe('Haptics');
    setLanguage('ja');
    expect(t('vr.settings.haptics')).toBe('触覚フィードバック');
    setLanguage('en');
  });

  test('translates vr.settings.soundVolume (master-volume stepper)', () => {
    setLanguage('en');
    expect(t('vr.settings.soundVolume')).toBe('Sound Volume');
    setLanguage('ja');
    expect(t('vr.settings.soundVolume')).toBe('音量');
    setLanguage('en');
  });

  test('translates vr.settings.webPanel and its on/off status messages', () => {
    // The toggle used to say "reload the page"; it now applies immediately, so
    // the messages describe what actually happened.
    setLanguage('en');
    expect(t('vr.settings.webPanel')).toBe('Web Browser Panel');
    expect(t('vr.msg.webPanelOn')).toBe('Browsing panel enabled');
    expect(t('vr.msg.webPanelOff')).toBe('Browsing panel closed');
    setLanguage('ja');
    expect(t('vr.settings.webPanel')).toBe('ブラウザパネル');
    expect(t('vr.msg.webPanelOn')).toBe('ブラウジングパネルを有効にしました');
    expect(t('vr.msg.webPanelOff')).toBe('ブラウジングパネルを閉じました');
    setLanguage('en');
  });

  test('unknown key falls back to the key itself', () => {
    setLanguage('en');
    expect(t('does.not.exist')).toBe('does.not.exist');
  });

  test('unknown language is ignored', () => {
    setLanguage('en');
    setLanguage('xx');
    expect(getLanguage()).toBe('en');
  });

  describe('detectLanguage() in a navigator-less environment (SSR / worker)', () => {
    const hadNavigator = 'navigator' in globalThis;
    const originalNavigator = globalThis.navigator;

    afterEach(() => {
      if (hadNavigator) {
        Object.defineProperty(globalThis, 'navigator', {
          value: originalNavigator,
          configurable: true,
          writable: true
        });
      }
      jest.resetModules();
    });

    test('module import does not throw when navigator is undefined', () => {
      // Earlier tests persist a language choice via setLanguage(); detectLanguage()
      // returns early on a saved value and would never reach the navigator branch,
      // making this regression test pass even against the unfixed source.
      localStorage.removeItem('qui-browser:lang');
      delete globalThis.navigator;
      expect('navigator' in globalThis).toBe(false);
      jest.resetModules();
      let mod;
      // Regression: `(typeof navigator !== 'undefined' && ...)` evaluates to the
      // BOOLEAN false here, and `false.toLowerCase()` threw a TypeError at
      // module-evaluation time, taking down every importer of the i18n module.
      expect(() => {
        mod = require('../src/i18n/i18n.js');
      }).not.toThrow();
      expect(mod.getLanguage()).toBe('en');
    });

    test('falls back to ja when navigator.language is Japanese', () => {
      // Earlier tests persist a language choice; detectLanguage() prefers it
      // over navigator, so clear it to exercise the navigator branch.
      localStorage.removeItem('qui-browser:lang');
      Object.defineProperty(globalThis, 'navigator', {
        value: { language: 'ja-JP' },
        configurable: true,
        writable: true
      });
      jest.resetModules();
      const mod = require('../src/i18n/i18n.js');
      expect(mod.getLanguage()).toBe('ja');
    });
  });
});

// ── Surfaces the earlier i18n passes missed (Session 74) ────────────────────
// Session 2 recorded "Phase 1 Complete (i18n wired)" and Session 27 "toast call
// sites fixed", but both covered toasts and settings labels. Captions, voice
// errors and screen-reader region labels were still English literals — and
// CLAUDE.md had itself listed the voice errors as an unfixed Phase 1 gap.
describe('captions, voice errors and screen-reader labels are translated', () => {
  const KEYS = [
    'vr.error.voiceMicDenied', 'vr.error.voiceUnavailable',
    'vr.a11y.captionsRegion', 'vr.a11y.alertsRegion', 'vr.a11y.settingsRegion',
    'vr.msg.teleported', 'vr.msg.recenterLabel', 'vr.msg.noTopSites', 'vr.msg.vrReady',
    'vr.msg.primaryHandLeft', 'vr.msg.primaryHandRight',
    'vr.msg.leftHandTracked', 'vr.msg.leftHandLost',
    'vr.msg.rightHandTracked', 'vr.msg.rightHandLost',
    'app.error.loadFailed', 'app.error.unknown', 'app.error.reload',
    'app.error.initFailed', 'app.error.noVRSupport', 'app.error.noWebXR',
    'app.error.enterVRFailed'
  ];

  test.each(KEYS)('%s exists in both catalogues and differs between them', (key) => {
    setLanguage('en');
    const en = t(key);
    setLanguage('ja');
    const ja = t(key);
    setLanguage('en');
    // t() falls back to the key itself when missing, so this catches a key
    // that was added to one catalogue only.
    expect(en).not.toBe(key);
    expect(ja).not.toBe(key);
    expect(ja).not.toBe(en);
  });

  test('voiceErrorNotification returns translated text, not a literal', () => {
    // Earlier tests in this file call jest.resetModules(), so the file-level
    // `setLanguage` binding points at a STALE i18n instance while a fresh
    // require() gets a new one. Both modules must come from the same registry
    // generation or the language switch silently does nothing — this test
    // passed alone and failed in-file until they were required together.
    const { voiceErrorNotification } = require('../src/vr/accessibility/crossModal.js');
    const i18n = require('../src/i18n/i18n.js');
    i18n.setLanguage('ja');
    const denied = voiceErrorNotification('not-allowed');
    const other = voiceErrorNotification('network');
    i18n.setLanguage('en');
    expect(denied.type).toBe('error');
    expect(other.type).toBe('warn');
    // Japanese output must not be the English literal it used to hardcode.
    expect(denied.message).not.toMatch(/microphone access denied/);
    expect(denied.message).toMatch(/マイク/);
  });

  test('hand-tracking captions use four explicit keys, not composed fragments', () => {
    // Composing "<hand> hand <state>" cannot produce correct Japanese: word
    // order and particles differ, so each combination gets its own key.
    setLanguage('ja');
    const all = [
      t('vr.msg.leftHandTracked'), t('vr.msg.leftHandLost'),
      t('vr.msg.rightHandTracked'), t('vr.msg.rightHandLost')
    ];
    setLanguage('en');
    expect(new Set(all).size).toBe(4);          // all distinct
    expect(all.every((s) => /[^\x00-\x7F]/.test(s))).toBe(true); // actually Japanese
  });
});
