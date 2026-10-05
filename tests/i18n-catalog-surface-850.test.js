/**
 * i18n catalog surface integrity (round 850).
 *
 * `vr.msg.sectionClosed` was defined in both catalogs but is unreachable by
 * design: `_toggleSettingsSection` uses tab semantics — re-selecting the open
 * tab is a no-op and selecting another replaces it, so no code path can ever
 * announce a section *closing*. A catalog key no code path can produce is
 * dead surface: it suggests a feature that does not exist.
 *
 * The remaining assertions pin the live neighbors so the deletion can't
 * widen accidentally.
 */
const { readFileSync } = require('fs');
const { join } = require('path');
const { t, setLanguage } = require('../src/i18n/i18n.js');

const catalogSrc = readFileSync(join(__dirname, '../src/i18n/i18n.js'), 'utf8');

describe('i18n catalog surface', () => {
  test('the unreachable section-closed key is gone from both catalogs', () => {
    expect(catalogSrc).not.toContain("'vr.msg.sectionClosed'");
  });

  test('the live section-open announce still resolves in both languages', () => {
    setLanguage('en');
    expect(t('vr.msg.sectionOpen')).toBe('expanded');
    setLanguage('ja');
    expect(t('vr.msg.sectionOpen')).toBe('展開');
    setLanguage('en');
  });

  test('the sibling state-pair keys that ARE reachable stay defined', () => {
    // settingsOpen/Closed and voiceOn/Off fire through real toggle paths —
    // unlike sectionClosed they correspond to actions that exist.
    setLanguage('en');
    expect(t('vr.msg.settingsClosed')).toBe('Settings: closed');
    expect(t('vr.msg.voiceOn')).toBe('Voice commands on');
    setLanguage('en');
  });
});
