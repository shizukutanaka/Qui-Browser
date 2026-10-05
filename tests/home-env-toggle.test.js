/**
 * `settings.enableHomeEnvironment` is a persisted boolean (default true) that
 * gates the sky/floor/grid home-environment Group built by
 * createHomeEnvironment(). Until now the key had no write path — no
 * settings-panel row, no voice command, no URL parameter — so a real user
 * could only change it by hand-editing localStorage. Same unreachable-setting
 * shape as enableWebPanel (Session 74) and enableVoice: this test covers the
 * settings row + `_onHomeEnvToggleChanged` live toggle that fixes it.
 *
 * The environment group also carries `this.floorMesh` — the teleport raycast
 * target — so the env must be *built* unconditionally and only *added* under
 * the flag; otherwise disabling it would silently kill teleport.
 *
 * Tests bind the real prototype methods to a bare `this` (the same approach
 * as tests/vr-app-wiring.test.js) — a full `new VRApp()` needs a real GPU.
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

const ctx2d = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  font: '',
  textAlign: '',
  textBaseline: '',
  fillRect: jest.fn(),
  strokeRect: jest.fn(),
  fillText: jest.fn(),
  clearRect: jest.fn()
};
global.document = {
  documentElement: { lang: 'en' },
  createElement: (tag) => {
    if (tag === 'canvas') {
      return { width: 0, height: 0, getContext: () => ctx2d };
    }
    return { style: {}, appendChild: jest.fn() };
  }
};

const fs = require('fs');
const path = require('path');
const THREE = require('three');
const { VRApp } = require('../src/vr/VRApp.js');
const { t, setLanguage } = require('../src/i18n/i18n.js');

const VRAPP_SRC = fs.readFileSync(path.join(__dirname, '../src/vr/VRApp.js'), 'utf8');

function makeEnvApp(overrides = {}) {
  const app = {
    settings: { enableHomeEnvironment: true },
    scene: { add: jest.fn(), remove: jest.fn() },
    homeEnvironment: new THREE.Group(),
    floorMesh: new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial()),
    showVRToast: jest.fn()
  };
  app.createHomeEnvironment = jest.fn(() => {
    const env = new THREE.Group();
    app.floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial());
    env.add(app.floorMesh);
    return env;
  });
  return Object.assign(app, overrides);
}

describe('VRApp._onHomeEnvToggleChanged', () => {
  it('removes the environment group from the scene when toggled off', () => {
    const app = makeEnvApp();
    const env = app.homeEnvironment;
    VRApp.prototype._onHomeEnvToggleChanged.call(app, false);
    expect(app.scene.remove).toHaveBeenCalledWith(env);
    expect(app.scene.add).not.toHaveBeenCalled();
    expect(app.showVRToast).toHaveBeenCalledWith(t('vr.msg.homeEnvOff'), { type: 'info' });
  });

  it('re-adds the environment group when toggled back on', () => {
    const app = makeEnvApp();
    const env = app.homeEnvironment;
    VRApp.prototype._onHomeEnvToggleChanged.call(app, true);
    expect(app.scene.add).toHaveBeenCalledWith(env);
    expect(app.showVRToast).toHaveBeenCalledWith(t('vr.msg.homeEnvOn'), { type: 'info' });
  });

  it('builds the environment lazily when none exists yet', () => {
    const app = makeEnvApp({ homeEnvironment: null });
    VRApp.prototype._onHomeEnvToggleChanged.call(app, true);
    expect(app.createHomeEnvironment).toHaveBeenCalled();
    expect(app.scene.add).toHaveBeenCalledWith(app.homeEnvironment);
  });

  it('keeps floorMesh after disabling — it is the teleport raycast target', () => {
    const app = makeEnvApp();
    const floor = app.floorMesh;
    VRApp.prototype._onHomeEnvToggleChanged.call(app, false);
    expect(app.floorMesh).toBe(floor);
  });

  it('defaults to the persisted setting when called without a value', () => {
    const app = makeEnvApp({ settings: { enableHomeEnvironment: false } });
    VRApp.prototype._onHomeEnvToggleChanged.call(app);
    expect(app.scene.remove).toHaveBeenCalledWith(app.homeEnvironment);
    expect(app.showVRToast).toHaveBeenCalledWith(t('vr.msg.homeEnvOff'), { type: 'info' });
  });
});

describe('VRApp.setupScene home-environment gating', () => {
  function makeSceneApp(enableHomeEnvironment) {
    const app = {
      settings: {
        enableHomeEnvironment,
        enableWebPanel: false,
        enableSettingsPanel: false,
        enableGazeDwell: false
      },
      camera: null,
      renderer: null,
      isVREnabled: false,
      captionSystem: null,
      homeEnvironment: null,
      floorMesh: null,
      registerInteractable: jest.fn(),
      unregisterInteractable: jest.fn()
    };
    app.createHomeEnvironment = jest.fn(() => {
      const env = new THREE.Group();
      const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshBasicMaterial());
      app.floorMesh = floor;
      env.add(floor);
      return env;
    });
    app.createSettingsPanel = jest.fn(() => new THREE.Group());
    return app;
  }

  it('adds the environment to the scene when the setting is enabled', () => {
    const app = makeSceneApp(true);
    VRApp.prototype.setupScene.call(app);
    expect(app.createHomeEnvironment).toHaveBeenCalled();
    expect(app.scene.children).toContain(app.homeEnvironment);
    expect(app.floorMesh).not.toBeNull();
  });

  it('still builds the environment when disabled so the teleport floor exists', () => {
    const app = makeSceneApp(false);
    VRApp.prototype.setupScene.call(app);
    expect(app.createHomeEnvironment).toHaveBeenCalled();
    expect(app.scene.children).not.toContain(app.homeEnvironment);
    expect(app.floorMesh).not.toBeNull();
  });
});

describe('enableHomeEnvironment reachability', () => {
  it('has a settings-panel row wired to the toggle handler', () => {
    expect(VRAPP_SRC).toMatch(/'enableHomeEnvironment',\s*\(v\)\s*=>\s*this\._onHomeEnvToggleChanged\(v\)/);
  });

  it('is placed inside the display section', () => {
    const displaySection = VRAPP_SRC.match(/byKey\(items, \[([^\]]*enableFFR[^\]]*)\]\)/);
    expect(displaySection).not.toBeNull();
    expect(displaySection[1]).toContain("'enableHomeEnvironment'");
  });
});

describe('home-environment i18n keys', () => {
  afterEach(() => setLanguage('en'));

  it('resolve to real strings in both locales', () => {
    for (const key of ['vr.settings.homeEnv', 'vr.msg.homeEnvOn', 'vr.msg.homeEnvOff']) {
      setLanguage('en');
      expect(t(key)).not.toBe(key);
      setLanguage('ja');
      expect(t(key)).not.toBe(key);
    }
  });
});
