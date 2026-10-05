/**
 * The settings panel must always be built in setupScene.
 *
 * settings.enableSettingsPanel was declared in the defaults (so it was
 * whitelisted for persistence) and read exactly once — the boot gate in
 * setupScene — but nothing in the product could ever write it: no settings
 * row, no voice toggle, no URL param. A real user could never turn the panel
 * off; the only path to `false` was hand-editing localStorage. A persisted
 * setting no one can set is dead configuration, so the key and its gate were
 * removed: the panel is a core feature and is built unconditionally.
 *
 * These tests pin the surviving contract: a stale persisted
 * enableSettingsPanel=false can no longer suppress the panel.
 */
import * as THREE from 'three';

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

import { VRApp } from '../src/vr/VRApp.js';

function makeApp(overrides = {}) {
  const app = Object.create(VRApp.prototype);
  app.settings = {
    enableHomeEnvironment: true,
    enableWebPanel: false,
    enableGazeDwell: false,
    ...overrides
  };
  app.camera = null;
  app.renderer = null;
  app.createHomeEnvironment = jest.fn(() => new THREE.Group());
  app.createSettingsPanel = jest.fn(() => new THREE.Group());
  app._buildBrowsingSystems = jest.fn();
  app.registerInteractable = jest.fn();
  app.unregisterInteractable = jest.fn();
  app.showVRToast = jest.fn();
  return app;
}

describe('setupScene — settings panel is unconditional', () => {
  test('builds the panel when the flag is absent (normal boot)', () => {
    const app = makeApp();
    VRApp.prototype.setupScene.call(app);
    expect(app.createSettingsPanel).toHaveBeenCalledTimes(1);
    expect(app.settingsPanel).toBeInstanceOf(THREE.Group);
    expect(app.settingsPanel.parent).toBe(app.scene);
  });

  test('a stale persisted enableSettingsPanel=false cannot suppress the panel', () => {
    const app = makeApp({ enableSettingsPanel: false });
    VRApp.prototype.setupScene.call(app);
    expect(app.createSettingsPanel).toHaveBeenCalledTimes(1);
    expect(app.settingsPanel).toBeInstanceOf(THREE.Group);
    expect(app.settingsPanel.parent).toBe(app.scene);
  });
});
