/**
 * Round 982 pins: VRApp.dispose() must fully tear down pending toast meshes.
 *
 * showVRToast() parents a canvas-textured mesh to the camera and tracks its
 * auto-dismiss timer. dispose() previously only clearTimeout()ed the timers —
 * which cancelled the *only* code path that detached the mesh and freed the
 * CanvasTexture (Material.dispose() does not dispose material.map; the
 * scene.traverse sweep reaches geometry/material but never the texture).
 * Result: every toast still pending at teardown leaked its texture and stayed
 * parented to the camera.
 *
 * These tests bind the real prototype methods to a hand-built `this` (same
 * technique as vr-app-wiring.test.js — `new VRApp()` needs a real GPU context).
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

// 2D canvas stub — showVRToast() draws the toast label into a CanvasTexture.
const ctx2d = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  font: '',
  textAlign: '',
  textBaseline: '',
  fillRect: jest.fn(),
  strokeRect: jest.fn(),
  fillText: jest.fn()
};
global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') {
      return { width: 0, height: 0, getContext: () => ctx2d };
    }
    return { style: {}, appendChild: jest.fn() };
  }
};

const THREE = require('three');
const { VRApp } = require('../src/vr/VRApp.js');

function makeApp() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  scene.add(camera); // toasts are parented to the camera, which lives in the scene
  return {
    isVREnabled: true,
    scene,
    camera,
    renderer: { setAnimationLoop: jest.fn(), dispose: jest.fn() },
    hapticFeedback: { playPatternBothHands: jest.fn() },
    captionSystem: { show: jest.fn(), dispose: jest.fn() },
    semanticDOM: { announceAlert: jest.fn(), dispose: jest.fn() },
    // Post-fix production builds this as a Map<timer, mesh>.
    _toastTimers: new Map()
  };
}

function pendingToast(app) {
  VRApp.prototype.showVRToast.call(app, 'test toast');
  return app.camera.children[0];
}

describe('VRApp.dispose — pending toast teardown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('dispose() detaches a still-pending toast from the camera', () => {
    const app = makeApp();
    const mesh = pendingToast(app);
    expect(mesh).toBeDefined();
    VRApp.prototype.dispose.call(app);
    expect(app.camera.children).toHaveLength(0);
  });

  test('dispose() frees the pending toast texture, geometry and material', () => {
    const app = makeApp();
    const mesh = pendingToast(app);
    const texDispose = jest.spyOn(mesh.material.map, 'dispose');
    const matDispose = jest.spyOn(mesh.material, 'dispose');
    const geoDispose = jest.spyOn(mesh.geometry, 'dispose');
    VRApp.prototype.dispose.call(app);
    expect(texDispose).toHaveBeenCalled();
    expect(matDispose).toHaveBeenCalled();
    expect(geoDispose).toHaveBeenCalled();
  });

  test('dispose() frees every pending toast, not just the first', () => {
    const app = makeApp();
    const mesh1 = pendingToast(app);
    const mesh2 = pendingToast(app);
    const spy1 = jest.spyOn(mesh1.material.map, 'dispose');
    const spy2 = jest.spyOn(mesh2.material.map, 'dispose');
    VRApp.prototype.dispose.call(app);
    expect(spy1).toHaveBeenCalled();
    expect(spy2).toHaveBeenCalled();
    expect(app.camera.children).toHaveLength(0);
  });

  test('dispose() leaves no toast timers or bookkeeping behind', () => {
    const app = makeApp();
    pendingToast(app);
    VRApp.prototype.dispose.call(app);
    expect(jest.getTimerCount()).toBe(0);
    expect(app._toastTimers.size).toBe(0);
  });

  test('normal auto-dismiss still frees the toast resources', () => {
    const app = makeApp();
    const mesh = pendingToast(app);
    const texDispose = jest.spyOn(mesh.material.map, 'dispose');
    const geoDispose = jest.spyOn(mesh.geometry, 'dispose');
    jest.advanceTimersByTime(5000);
    expect(app.camera.children).toHaveLength(0);
    expect(texDispose).toHaveBeenCalled();
    expect(geoDispose).toHaveBeenCalled();
    expect(app._toastTimers.size).toBe(0);
  });

  test('toast timers map each timer to its mesh so teardown can release it', () => {
    const app = makeApp();
    const mesh = pendingToast(app);
    const tracked = [...app._toastTimers.values()];
    expect(tracked).toContain(mesh);
  });
});
