/**
 * VRApp accessibility/interaction wiring integration tests.
 *
 * CLAUDE.md has flagged since Session 2 that no test exercises VRApp's own
 * wiring end-to-end (only pure helpers and individual subsystems are
 * covered elsewhere). Constructing a full `new VRApp(container)` is not
 * practical — setupRenderer() creates a real THREE.WebGLRenderer, which
 * needs a real GPU/canvas context — so these tests instead bind VRApp's
 * real prototype methods to a hand-built `this` with just the state each
 * method reads/writes, verifying the actual production method bodies
 * (cross-modal dispatch, interactable registry, grab-to-move, hover) rather
 * than a reimplementation of them.
 *
 * Real 'three' is used (not mocked) so THREE.Mesh/CanvasTexture/etc. behave
 * exactly as in production; only the two WebXR-session-touching examples/jsm
 * modules VRApp imports at the top of the file are mocked, since their
 * top-level code assumes a real navigator.xr and isn't needed by any method
 * under test here (they back setupVR()/setupControllers(), never called).
 */

jest.mock('three/examples/jsm/webxr/VRButton.js', () => ({
  VRButton: { createButton: () => ({}) }
}));
jest.mock('three/examples/jsm/webxr/XRControllerModelFactory.js', () => ({
  XRControllerModelFactory: class { createControllerModel() { return {}; } }
}));

// ── canvas/document stub (showVRToast draws a 2D toast texture) ──────────────
const ctx2d = {
  fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '', textBaseline: '',
  fillRect: jest.fn(), strokeRect: jest.fn(), fillText: jest.fn()
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

function makeGroup() {
  return { position: { set: jest.fn() }, quaternion: { identity: jest.fn() } };
}

function makeController(handedness) {
  return {
    userData: handedness ? { inputSource: { handedness } } : {},
    matrixWorld: new THREE.Matrix4()
  };
}

/** Bare `this` with just the fields the methods under test touch. */
function makeVRAppLike(overrides = {}) {
  return {
    interactables: [],
    controllers: [],
    isVREnabled: false,
    camera: null,
    hapticFeedback: { playPattern: jest.fn(), playPatternBothHands: jest.fn() },
    captionSystem: { enabled: true, show: jest.fn() },
    semanticDOM: { announceAlert: jest.fn(), announceCaption: jest.fn() },
    windowManager: null,
    tabManager: null,
    webPanel: null,
    _grabController: null,
    _toastTimers: new Set(),
    playerRig: null,
    ...overrides
  };
}

describe('VRApp.showVRToast — cross-modal dispatch', () => {
  // showVRToast() schedules a real setTimeout auto-dismiss; fake timers keep
  // it from leaking past the test run (Jest warns about open handles otherwise).
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('mirrors to the semantic DOM alert region unconditionally, even outside a VR session', () => {
    const app = makeVRAppLike({ isVREnabled: false, camera: null });
    VRApp.prototype.showVRToast.call(app, 'Something failed', { type: 'error' });
    expect(app.semanticDOM.announceAlert).toHaveBeenCalledTimes(1);
    expect(app.semanticDOM.announceAlert.mock.calls[0][0]).toMatch(/Something failed/);
  });

  test('does not create a 3D toast mesh outside an active VR session', () => {
    const app = makeVRAppLike({ isVREnabled: false, camera: null });
    expect(() => VRApp.prototype.showVRToast.call(app, 'msg')).not.toThrow();
    // No camera to add a mesh to — nothing should have been touched.
    expect(app.camera).toBeNull();
  });

  test('creates and attaches a 3D toast mesh to the camera during an active VR session', () => {
    const camera = { add: jest.fn(), remove: jest.fn() };
    const app = makeVRAppLike({ isVREnabled: true, camera });
    VRApp.prototype.showVRToast.call(app, 'Loaded', { type: 'info' });
    expect(camera.add).toHaveBeenCalledTimes(1);
    const mesh = camera.add.mock.calls[0][0];
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });

  test('fires haptic + caption via notifyCrossModal when captions are enabled', () => {
    const camera = { add: jest.fn(), remove: jest.fn() };
    const app = makeVRAppLike({ isVREnabled: true, camera });
    VRApp.prototype.showVRToast.call(app, 'Player joined', { type: 'info' });
    expect(app.hapticFeedback.playPatternBothHands).toHaveBeenCalledTimes(1);
    expect(app.captionSystem.show).toHaveBeenCalledTimes(1);
    expect(app.captionSystem.show.mock.calls[0][0]).toMatch(/Player joined/);
  });

  test('skips the caption channel when captions are disabled, but haptic still fires', () => {
    const camera = { add: jest.fn(), remove: jest.fn() };
    const app = makeVRAppLike({ isVREnabled: true, camera, captionSystem: { enabled: false, show: jest.fn() } });
    VRApp.prototype.showVRToast.call(app, 'msg', { type: 'warn' });
    expect(app.hapticFeedback.playPatternBothHands).toHaveBeenCalledTimes(1);
    expect(app.captionSystem.show).not.toHaveBeenCalled();
  });

  test('tracks the auto-dismiss timer so it can be cleared on teardown', () => {
    const camera = { add: jest.fn(), remove: jest.fn() };
    const app = makeVRAppLike({ isVREnabled: true, camera });
    expect(app._toastTimers.size).toBe(0);
    VRApp.prototype.showVRToast.call(app, 'msg');
    expect(app._toastTimers.size).toBe(1);
  });
});

describe('VRApp.registerInteractable / unregisterInteractable', () => {
  test('registers a mesh with handlers and stores them on userData', () => {
    const app = makeVRAppLike();
    const mesh = { userData: {} };
    const handlers = { onSelect: jest.fn() };
    const returned = VRApp.prototype.registerInteractable.call(app, mesh, handlers);
    expect(returned).toBe(mesh);
    expect(app.interactables).toContain(mesh);
    expect(mesh.userData.interactable).toBe(handlers);
  });

  test('does not register the same object twice', () => {
    const app = makeVRAppLike();
    const mesh = { userData: {} };
    VRApp.prototype.registerInteractable.call(app, mesh, {});
    VRApp.prototype.registerInteractable.call(app, mesh, {});
    expect(app.interactables.filter(o => o === mesh)).toHaveLength(1);
  });

  test('unregisterInteractable removes a previously registered object', () => {
    const app = makeVRAppLike();
    const mesh = { userData: {} };
    VRApp.prototype.registerInteractable.call(app, mesh, {});
    VRApp.prototype.unregisterInteractable.call(app, mesh);
    expect(app.interactables).not.toContain(mesh);
  });

  test('unregisterInteractable on an object never registered is a no-op', () => {
    const app = makeVRAppLike();
    expect(() => VRApp.prototype.unregisterInteractable.call(app, { userData: {} })).not.toThrow();
  });
});

describe('VRApp.onControllerSelect — press (hit-test dispatch)', () => {
  function withHitApp(hit) {
    const app = makeVRAppLike({ interactables: [{}] });
    app.raycasterFromController = jest.fn(() => ({
      intersectObjects: jest.fn(() => (hit ? [hit] : []))
    }));
    return app;
  }

  test('fires the hit object\'s onSelect handler with the intersection and controller', () => {
    const onSelect = jest.fn();
    const target = { userData: { interactable: { onSelect } }, dispatchEvent: jest.fn() };
    const hit = { object: target };
    const app = withHitApp(hit);
    const controller = makeController('right');

    VRApp.prototype.onControllerSelect.call(app, controller, true);

    expect(onSelect).toHaveBeenCalledWith({ intersection: hit, controller });
  });

  test('plays a haptic click on the selecting hand after a successful hit', () => {
    const target = { userData: { interactable: {} }, dispatchEvent: jest.fn() };
    const hit = { object: target };
    const app = withHitApp(hit);
    const controller = makeController('left');

    VRApp.prototype.onControllerSelect.call(app, controller, true);

    expect(app.hapticFeedback.playPattern).toHaveBeenCalledWith('left', 'click');
  });

  test('defaults to the right hand when the controller reports no handedness', () => {
    const target = { userData: { interactable: {} }, dispatchEvent: jest.fn() };
    const hit = { object: target };
    const app = withHitApp(hit);
    const controller = makeController(null);

    VRApp.prototype.onControllerSelect.call(app, controller, true);

    expect(app.hapticFeedback.playPattern).toHaveBeenCalledWith('right', 'click');
  });

  test('dispatches a qui-select DOM-style event on the hit object', () => {
    const target = { userData: { interactable: {} }, dispatchEvent: jest.fn() };
    const hit = { object: target };
    const app = withHitApp(hit);
    const controller = makeController('right');

    VRApp.prototype.onControllerSelect.call(app, controller, true);

    expect(target.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'qui-select', intersection: hit, controller })
    );
  });

  test('does nothing when there are no interactables', () => {
    const app = makeVRAppLike({ interactables: [] });
    app.raycasterFromController = jest.fn();
    VRApp.prototype.onControllerSelect.call(app, makeController('right'), true);
    expect(app.raycasterFromController).not.toHaveBeenCalled();
  });

  test('does nothing when the ray hits no interactable', () => {
    const app = withHitApp(null);
    expect(() => VRApp.prototype.onControllerSelect.call(app, makeController('right'), true)).not.toThrow();
    expect(app.hapticFeedback.playPattern).not.toHaveBeenCalled();
  });
});

describe('VRApp.onControllerSelect — release (grab-to-move end)', () => {
  test('ends the grab and fires release feedback when the releasing controller started it', () => {
    const controller = makeController('right');
    const windowManager = { isGrabbing: true, endGrab: jest.fn() };
    const app = makeVRAppLike({ windowManager, _grabController: controller });

    VRApp.prototype.onControllerSelect.call(app, controller, false);

    expect(windowManager.endGrab).toHaveBeenCalledTimes(1);
    expect(app._grabController).toBeNull();
    expect(app.hapticFeedback.playPattern).toHaveBeenCalledWith('right', 'impact');
    expect(app.captionSystem.show).toHaveBeenCalled();
  });

  test('does not end the grab when a different controller releases its own (unrelated) trigger', () => {
    const grabbingController = makeController('right');
    const otherController = makeController('left');
    const windowManager = { isGrabbing: true, endGrab: jest.fn() };
    const app = makeVRAppLike({ windowManager, _grabController: grabbingController });

    VRApp.prototype.onControllerSelect.call(app, otherController, false);

    expect(windowManager.endGrab).not.toHaveBeenCalled();
    expect(app._grabController).toBe(grabbingController);
  });

  test('is a no-op when nothing is being grabbed', () => {
    const app = makeVRAppLike({ windowManager: { isGrabbing: false, endGrab: jest.fn() } });
    expect(() => VRApp.prototype.onControllerSelect.call(app, makeController('right'), false)).not.toThrow();
    expect(app.windowManager.endGrab).not.toHaveBeenCalled();
  });
});

describe('VRApp._onPanelGrabRequested', () => {
  test('begins a grab and fires grab feedback', () => {
    const controller = makeController('left');
    const windowManager = { target: null, attach: jest.fn(), beginGrab: jest.fn() };
    const app = makeVRAppLike({ windowManager });

    VRApp.prototype._onPanelGrabRequested.call(app, controller);

    expect(windowManager.beginGrab).toHaveBeenCalledWith(controller);
    expect(app._grabController).toBe(controller);
    expect(app.hapticFeedback.playPattern).toHaveBeenCalledWith('left', 'click');
  });

  test('re-syncs the window manager to the active tab before beginning the grab (stale-target fix)', () => {
    const controller = makeController('right');
    const activeGroup = makeGroup();
    const windowManager = { target: null, attach: jest.fn(), beginGrab: jest.fn() };
    const tabManager = { getActiveTab: jest.fn(() => ({ group: activeGroup })) };
    const app = makeVRAppLike({ windowManager, tabManager });

    VRApp.prototype._onPanelGrabRequested.call(app, controller);

    expect(windowManager.attach).toHaveBeenCalledWith(activeGroup);
  });

  test('does not re-attach when the window manager already targets the active tab', () => {
    const controller = makeController('right');
    const activeGroup = makeGroup();
    const windowManager = { target: activeGroup, attach: jest.fn(), beginGrab: jest.fn() };
    const tabManager = { getActiveTab: jest.fn(() => ({ group: activeGroup })) };
    const app = makeVRAppLike({ windowManager, tabManager });

    VRApp.prototype._onPanelGrabRequested.call(app, controller);

    expect(windowManager.attach).not.toHaveBeenCalled();
  });

  test('is a no-op without a windowManager', () => {
    const app = makeVRAppLike({ windowManager: null });
    expect(() => VRApp.prototype._onPanelGrabRequested.call(app, makeController('right'))).not.toThrow();
  });

  test('is a no-op without a controller', () => {
    const app = makeVRAppLike({ windowManager: { beginGrab: jest.fn() } });
    VRApp.prototype._onPanelGrabRequested.call(app, null);
    expect(app.windowManager.beginGrab).not.toHaveBeenCalled();
  });
});

describe('VRApp.updateHover', () => {
  function makeInteractable(handlers) {
    return { userData: { interactable: handlers } };
  }

  test('fires onHover when a controller starts hovering a new object', () => {
    const onHover = jest.fn();
    const target = makeInteractable({ onHover });
    const controller = { userData: {} };
    const app = makeVRAppLike({ interactables: [target], controllers: [controller] });
    app.raycasterFromController = jest.fn(() => ({ intersectObjects: jest.fn(() => [{ object: target }]) }));

    VRApp.prototype.updateHover.call(app);

    expect(onHover).toHaveBeenCalledTimes(1);
    expect(controller.userData.hovered).toBe(target);
  });

  test('fires onHoverEnd when the ray moves off a previously hovered object', () => {
    const onHover = jest.fn();
    const onHoverEnd = jest.fn();
    const target = makeInteractable({ onHover, onHoverEnd });
    const controller = { userData: { hovered: target } };
    const app = makeVRAppLike({ interactables: [target], controllers: [controller] });
    // Ray now hits nothing.
    app.raycasterFromController = jest.fn(() => ({ intersectObjects: jest.fn(() => []) }));

    VRApp.prototype.updateHover.call(app);

    expect(onHoverEnd).toHaveBeenCalledTimes(1);
    expect(controller.userData.hovered).toBeNull();
  });

  test('does not re-fire onHover while the ray stays on the same object', () => {
    const onHover = jest.fn();
    const target = makeInteractable({ onHover });
    const controller = { userData: { hovered: target } };
    const app = makeVRAppLike({ interactables: [target], controllers: [controller] });
    app.raycasterFromController = jest.fn(() => ({ intersectObjects: jest.fn(() => [{ object: target }]) }));

    VRApp.prototype.updateHover.call(app);

    expect(onHover).not.toHaveBeenCalled();
  });

  test('does nothing when there are no interactables', () => {
    const app = makeVRAppLike({ interactables: [], controllers: [{ userData: {} }] });
    app.raycasterFromController = jest.fn();
    VRApp.prototype.updateHover.call(app);
    expect(app.raycasterFromController).not.toHaveBeenCalled();
  });
});

describe('VRApp.recenter', () => {
  test('resets the player rig position and orientation', () => {
    const playerRig = makeGroup();
    const app = makeVRAppLike({ playerRig });
    VRApp.prototype.recenter.call(app);
    expect(playerRig.position.set).toHaveBeenCalledWith(0, 0, 0);
    expect(playerRig.quaternion.identity).toHaveBeenCalledTimes(1);
  });

  test('announces a caption when captions are enabled', () => {
    const app = makeVRAppLike({ playerRig: makeGroup() });
    VRApp.prototype.recenter.call(app);
    expect(app.captionSystem.show).toHaveBeenCalledTimes(1);
  });

  test('does not announce a caption when captions are disabled', () => {
    const app = makeVRAppLike({
      playerRig: makeGroup(),
      captionSystem: { enabled: false, show: jest.fn() }
    });
    VRApp.prototype.recenter.call(app);
    expect(app.captionSystem.show).not.toHaveBeenCalled();
  });

  test('is a no-op without a playerRig', () => {
    const app = makeVRAppLike({ playerRig: null });
    expect(() => VRApp.prototype.recenter.call(app)).not.toThrow();
  });
});
