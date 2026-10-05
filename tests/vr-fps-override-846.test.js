/**
 * Round-846 defect: user-specified targetFPS is silently clobbered.
 *
 * `initializeSystems()` gates the device-tier FPS override on
 * `settings._fpsOverridden` ("not already user-specified"), but nothing ever
 * sets that flag — so an explicit `updateSetting('targetFPS', n)` choice is
 * reverted by device detection on the next boot even though updateSetting
 * persisted it. Wiring: declare the flag in the settings literal so it
 * round-trips through saveSettings/loadPersistedSettings, mark it in
 * updateSetting when the user explicitly writes 'targetFPS', and read it in
 * the extracted `_applyDetectedTargetFPS`.
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
    getContext: () => ({})
  }),
  documentElement: { lang: 'en' }
};

const fs = require('fs');
const path = require('path');
const { VRApp } = require('../src/vr/VRApp.js');

const SRC = fs.readFileSync(path.join(__dirname, '../src/vr/VRApp.js'), 'utf8');

function makeApp() {
  return {
    settings: { targetFPS: 90 },
    saveSettings: jest.fn(),
    deviceCompat: { targetFPS: () => 72 }
  };
}

describe('targetFPS user-override flag (round 846)', () => {
  test("updateSetting('targetFPS') marks the choice as user-specified", () => {
    const app = makeApp();
    VRApp.prototype.updateSetting.call(app, 'targetFPS', 120);
    expect(app.settings.targetFPS).toBe(120);
    // The flag initializeSystems consults must actually flip — today it never
    // does, so the device tier reverts the user's choice every boot.
    expect(app.settings._fpsOverridden).toBe(true);
    expect(app.saveSettings).toHaveBeenCalled();
  });

  test('updateSetting on unrelated keys does not mark the flag', () => {
    const app = makeApp();
    VRApp.prototype.updateSetting.call(app, 'enableCaptions', true);
    expect(app.settings._fpsOverridden).not.toBe(true);
  });

  test('_fpsOverridden is declared in the settings literal (persist whitelist)', () => {
    // loadPersistedSettings copies only keys present in the literal, so an
    // undeclared flag can never survive a reload — the wiring would be dead
    // on the very next boot.
    const literal = SRC.match(/this\.settings = \{([\s\S]*?)\n\s*\};/);
    expect(literal).not.toBeNull();
    expect(literal[1]).toMatch(/_fpsOverridden:\s*false/);
  });

  test('device detection skips the override once the flag is set', () => {
    const app = makeApp();
    app.settings.targetFPS = 120;
    app.settings._fpsOverridden = true;
    VRApp.prototype._applyDetectedTargetFPS.call(app);
    expect(app.settings.targetFPS).toBe(120);
  });

  test('device detection still applies its tier rate when the flag is unset', () => {
    const app = makeApp();
    VRApp.prototype._applyDetectedTargetFPS.call(app);
    expect(app.settings.targetFPS).toBe(72);
  });
});
