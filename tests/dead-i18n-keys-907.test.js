import fs from 'fs';
import path from 'path';
import { t, setLanguage, availableLanguages } from '../src/i18n/i18n.js';
const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'src', 'i18n', 'i18n.js'), 'utf8');
const LOCALES = availableLanguages();

describe('dead i18n key surface', () => {
  test('vr.value.on is removed — toggle state renders via vr.msg.toggleOn', () => {
    for (const lang of LOCALES) {
      setLanguage(lang);
      expect(t('vr.value.on')).toBe('vr.value.on');
    }
  });
  test('vr.value.off is removed — toggle state renders via vr.msg.toggleOff', () => {
    for (const lang of LOCALES) {
      setLanguage(lang);
      expect(t('vr.value.off')).toBe('vr.value.off');
    }
  });
  test('source defines neither vr.value.on nor vr.value.off', () => {
    expect(SRC).not.toMatch(/'vr\.value\.(on|off)'\s*:/);
  });
  test('every remaining vr.value.* key is reachable — literal refs or the motionSensitivity cycle path', () => {
    const live = [
      'vr.value.left',
      'vr.value.right',
      'vr.value.sensitive',
      'vr.value.moderate',
      'vr.value.tolerant',
      'vr.value.disabled'
    ];
    expect([...new Set([...SRC.matchAll(/'(vr\.value\.[^']+)'\s*:/g)].map((m) => m[1]))].sort()).toEqual(live.sort());
  });
});
