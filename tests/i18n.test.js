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

  test('unknown key falls back to the key itself', () => {
    setLanguage('en');
    expect(t('does.not.exist')).toBe('does.not.exist');
  });

  test('unknown language is ignored', () => {
    setLanguage('en');
    setLanguage('xx');
    expect(getLanguage()).toBe('en');
  });
});
