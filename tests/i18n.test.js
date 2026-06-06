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
