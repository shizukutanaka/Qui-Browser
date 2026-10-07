/**
 * Round 974 — pinned defect: the Comfort effects never restore rest state
 * when switched off.
 *
 * Three faces of one class:
 *   1. ComfortSystem.update() skips updateFOV() entirely when
 *      settings.fov.enabled is false, so setPreset('disabled') leaves
 *      camera.fov stuck at the last reduced value (vignette already got the
 *      else-restore branch for exactly this stale-state class; FOV missed it).
 *   2. The settings-panel Comfort toggle passes a null handler, so the panel
 *      flips the persisted flag only — updateSystems then stops calling
 *      comfortSystem.update(), freezing a mid-fade vignette on screen and the
 *      FOV mid-reduction.
 *   3. Voice 'comfort off' reaches _applyToggle('enableComfort', v), which
 *      falls into the default no-op case — same freeze.
 *
 * These tests assert the honest behaviour: disabling restores base FOV and
 * hides the vignette immediately, from every entry path.
 */
const THREE = require('three');
const { ComfortSystem } = require('../src/vr/comfort/ComfortSystem.js');
const { VRApp } = require('../src/vr/VRApp.js');

function makeCamera(fov = 90) {
  return {
    fov,
    position: new THREE.Vector3(0, 1.6, 0),
    rotation: { y: 0 },
    quaternion: new THREE.Quaternion(),
    add: jest.fn(),
    remove: jest.fn(),
    updateProjectionMatrix: jest.fn()
  };
}

/** Drive the system until the FOV has visibly narrowed. */
function engageEffects(system) {
  system.externalMotion = true;
  system.externalMotionLevel = 1;
  for (let i = 0; i < 80; i++) {
    system.update(0.016);
  }
}

describe('Comfort disable restores rest state (round 974)', () => {
  test("preset 'disabled' hands the camera its base FOV back", () => {
    const camera = makeCamera(90);
    const system = new ComfortSystem(camera);
    system.setPreset('sensitive'); // fov.enabled, reduction 35
    engageEffects(system);
    expect(camera.fov).toBeLessThan(80); // tunnel engaged

    system.setPreset('disabled');
    system.update(0.016);

    expect(camera.fov).toBe(system.settings.fov.baseFOV);
    expect(system.vignetteMesh.visible).toBe(false);
  });

  test('setEnabled(false) restores immediately, without another update tick', () => {
    const camera = makeCamera(90);
    const system = new ComfortSystem(camera);
    engageEffects(system);
    expect(system.vignetteMesh.visible).toBe(true);
    expect(camera.fov).toBeLessThan(90);

    system.setEnabled(false);

    expect(system.vignetteMesh.visible).toBe(false);
    expect(system.vignetteMaterial.uniforms.intensity.value).toBe(0);
    expect(camera.fov).toBe(90);
  });

  test('setEnabled(false) on an idle system is a safe no-op', () => {
    const camera = makeCamera(90);
    const system = new ComfortSystem(camera);
    system.setEnabled(false);
    expect(camera.fov).toBe(90);
    expect(system.vignetteMesh.visible).toBe(false);
  });

  test('re-enabling preserves the preset and re-engages the effects', () => {
    const camera = makeCamera(90);
    const system = new ComfortSystem(camera);
    system.setEnabled(false);
    system.setEnabled(true);
    engageEffects(system);
    expect(system.settings.vignette.enabled).toBe(true);
    expect(system.vignetteMesh.visible).toBe(true);
  });

  test('VRApp._applyToggle routes enableComfort to comfortSystem.setEnabled', () => {
    const setEnabled = jest.fn();
    const ctx = {
      comfortSystem: { setEnabled },
      captionSystem: null,
      gazeInteraction: null,
      hapticFeedback: null,
      tabManager: null,
      webPanel: null,
      windowManager: null,
      ffrSystem: null,
      showVRToast: jest.fn()
    };
    VRApp.prototype._applyToggle.call(ctx, 'enableComfort', false);
    expect(setEnabled).toHaveBeenCalledWith(false);

    VRApp.prototype._applyToggle.call(ctx, 'enableComfort', true);
    expect(setEnabled).toHaveBeenLastCalledWith(true);
  });

  test('the settings-panel Comfort item wires a live handler like its siblings', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../src/vr/VRApp.js'), 'utf8');
    // Sibling toggles all route through _applyToggle; the Comfort item must
    // not keep the do-nothing `null` handler.
    expect(src).toMatch(/t\('vr\.settings\.comfort'\),\s*'enableComfort',\s*\(v\)\s*=>/);
  });
});
