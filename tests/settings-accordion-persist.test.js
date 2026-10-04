/**
 * openSettingsSections: the accordion selection must survive a reload.
 *
 * `_toggleSettingsSection` writes the open settings-section tab via
 * `updateSetting('openSettingsSections', [sectionId])`, and the JSDoc on
 * makeSectionTab calls the section id "the persisted identity" — persistence
 * is the intent. But `loadPersistedSettings` only whitelists keys already
 * present in the defaults map, and `openSettingsSections` was never declared
 * there, so the saved array was dropped on every boot and the panel always
 * re-opened on the accessibility tab. Same "persisted preference ignored at
 * boot" defect class as readerTextScale (#1110).
 *
 * VRApp is driven via the established convention: `VRApp.prototype` bound to a
 * hand-built `this` (a real `new VRApp()` needs a GPU).
 */

jest.mock('three/examples/jsm/webxr/VRButton.js', () => ({
  VRButton: { createButton: () => ({}) }
}));
jest.mock('three/examples/jsm/webxr/XRControllerModelFactory.js', () => ({
  XRControllerModelFactory: class {
    createControllerModel() {
      return {};
    }
  }
}));

global.document = {
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => ({
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      fillText: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: ''
    })
  }),
  documentElement: { lang: 'en' }
};

const fs = require('fs');
const path = require('path');
const { VRApp } = require('../src/vr/VRApp.js');

const SRC = fs.readFileSync(path.join(__dirname, '../src/vr/VRApp.js'), 'utf8');
const SETTINGS_KEY = 'qui-browser:settings';

beforeEach(() => localStorage.clear());

describe('persisted-key whitelist completeness', () => {
  test('every key written via updateSetting is declared in the defaults map', () => {
    // loadPersistedSettings copies only keys already present in this.settings,
    // so an updateSetting-written key absent from defaults is silently dropped
    // on every boot — the entire persisted-settings surface must be declared.
    const written = new Set([...SRC.matchAll(/updateSetting\('([A-Za-z]+)'/g)].map((m) => m[1]));
    const defaultsBlock = SRC.match(/this\.settings = \{[\s\S]*?\n {4}\};/)[0];
    const declared = new Set([...defaultsBlock.matchAll(/^ {6}([A-Za-z]+):/gm)].map((m) => m[1]));
    const missing = [...written].filter((k) => !declared.has(k));
    expect(missing).toEqual([]);
  });

  test('loadPersistedSettings drops keys absent from the settings map (the defect mechanism)', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ openSettingsSections: ['settings.section.comfort'] }));
    const reader = { settings: {} }; // key absent — the pre-fix default state
    const restored = VRApp.prototype.loadPersistedSettings.call(reader);
    expect(restored.openSettingsSections).toBeUndefined();
  });
});

describe('_toggleSettingsSection write path', () => {
  test('persists the selected section via updateSetting and rebuilds', () => {
    const app = {
      settings: {},
      saveSettings: jest.fn(),
      _rebuildSettingsPanel: jest.fn()
    };
    app.updateSetting = VRApp.prototype.updateSetting.bind(app);
    VRApp.prototype._toggleSettingsSection.call(app, 'settings.section.locomotion');
    expect(app.settings.openSettingsSections).toEqual(['settings.section.locomotion']);
    expect(app.saveSettings).toHaveBeenCalled();
    expect(app._rebuildSettingsPanel).toHaveBeenCalled();
  });

  test('re-selecting the already-open section neither rebuilds nor rewrites', () => {
    const app = {
      settings: { openSettingsSections: ['settings.section.a11y'] },
      updateSetting: jest.fn(),
      _rebuildSettingsPanel: jest.fn()
    };
    VRApp.prototype._toggleSettingsSection.call(app, 'settings.section.a11y');
    expect(app.updateSetting).not.toHaveBeenCalled();
    expect(app._rebuildSettingsPanel).not.toHaveBeenCalled();
  });
});

describe('save → load round trip', () => {
  test('a saved accordion selection is restored by loadPersistedSettings', () => {
    // Writer side: updateSetting persists the whole settings blob.
    const writer = { settings: { openSettingsSections: ['settings.section.a11y'] } };
    writer.updateSetting = VRApp.prototype.updateSetting.bind(writer);
    writer.saveSettings = VRApp.prototype.saveSettings.bind(writer);
    writer.updateSetting('openSettingsSections', ['settings.section.comfort']);
    expect(localStorage.getItem(SETTINGS_KEY)).toContain('settings.section.comfort');

    // Reader side on the next boot: with the key declared in defaults the
    // whitelist passes it through and the user's last-open tab is restored.
    const reader = { settings: { openSettingsSections: ['settings.section.a11y'] } };
    const restored = VRApp.prototype.loadPersistedSettings.call(reader);
    expect(restored.openSettingsSections).toEqual(['settings.section.comfort']);
  });
});
