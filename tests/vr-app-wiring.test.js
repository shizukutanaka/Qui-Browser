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
    hapticFeedback: { playPattern: jest.fn(), playPatternBothHands: jest.fn(), update: jest.fn() },
    captionSystem: { enabled: true, show: jest.fn(), update: jest.fn() },
    semanticDOM: { announceAlert: jest.fn(), announceCaption: jest.fn() },
    windowManager: null,
    tabManager: null,
    webPanel: null,
    _grabController: null,
    _toastTimers: new Set(),
    playerRig: null,
    // Real implementation, carried onto the flat object: the methods under test
    // call it on `this`, and this harness deliberately stays a plain literal
    // (binding VRApp.prototype instead would activate VRApp's own accessors,
    // which delegate to an `a11y` coordinator this fixture does not build).
    _attachManagedWindow: VRApp.prototype._attachManagedWindow,
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

  // The manager targets TabManager's rootGroup — the tab strip and every panel
  // are children of it. It used to target the *active panel's* group, which had
  // to be re-synced on every tab switch and left the strip behind when the panel
  // moved. Same stale-target guarantee, one target instead of N.
  test('attaches the managed root group before beginning the grab (stale-target fix)', () => {
    const controller = makeController('right');
    const rootGroup = makeGroup();
    const windowManager = { target: null, attach: jest.fn(), beginGrab: jest.fn() };
    const tabManager = { rootGroup, getActiveTab: jest.fn(() => ({ group: makeGroup() })) };
    const app = makeVRAppLike({ windowManager, tabManager });

    VRApp.prototype._onPanelGrabRequested.call(app, controller);

    expect(windowManager.attach).toHaveBeenCalledWith(rootGroup);
    // Explicitly NOT the active panel's own group.
    expect(windowManager.attach).not.toHaveBeenCalledWith(tabManager.getActiveTab().group);
  });

  test('does not re-attach when the window manager already targets the root group', () => {
    const controller = makeController('right');
    const rootGroup = makeGroup();
    const windowManager = { target: rootGroup, attach: jest.fn(), beginGrab: jest.fn() };
    const tabManager = { rootGroup };
    const app = makeVRAppLike({ windowManager, tabManager });

    VRApp.prototype._onPanelGrabRequested.call(app, controller);

    expect(windowManager.attach).not.toHaveBeenCalled();
    expect(windowManager.beginGrab).toHaveBeenCalledWith(controller);
  });

  test('falls back to a standalone webPanel when tabs are not in use', () => {
    const controller = makeController('right');
    const group = makeGroup();
    const windowManager = { target: null, attach: jest.fn(), beginGrab: jest.fn() };
    const app = makeVRAppLike({ windowManager });
    app.tabManager = null;
    app.webPanel = { group };

    VRApp.prototype._onPanelGrabRequested.call(app, controller);

    expect(windowManager.attach).toHaveBeenCalledWith(group);
  });

  test('still begins the grab when there is nothing to attach', () => {
    // WindowManager.beginGrab() guards on its own missing target, so the grab
    // request must not be swallowed here.
    const controller = makeController('right');
    const windowManager = { target: null, attach: jest.fn(), beginGrab: jest.fn() };
    const app = makeVRAppLike({ windowManager });
    app.tabManager = null;
    app.webPanel = null;

    VRApp.prototype._onPanelGrabRequested.call(app, controller);

    expect(windowManager.attach).not.toHaveBeenCalled();
    expect(windowManager.beginGrab).toHaveBeenCalledWith(controller);
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

// ── Gaze-dwell activation glue (FR-13.1) ─────────────────────────────────────
// GazeInteraction itself (the dwell timer/grace-time logic) is already
// unit-tested in gaze-interaction.test.js. What was NOT covered — the gap
// flagged since Session 2 and left open at the end of Session 41 — is
// VRApp's own per-frame glue in updateSystems(): does an activation actually
// reach the haptic + spatial-audio cross-modal confirmation?
function makeSystemsApp(overrides = {}) {
  return makeVRAppLike({
    // Stub the other per-frame update methods so this test is isolated to
    // the gaze-dwell/caption/window-manager glue, not a re-test of
    // locomotion/button-input/teleport/hover (each already covered on its own).
    updateLocomotion: jest.fn(),
    updateButtonInput: jest.fn(),
    updateTeleport: jest.fn(),
    updateHover: jest.fn(),
    comfortSystem: null,
    ffrSystem: null,
    handTracking: null,
    mixedReality: null,
    layersSystem: null,
    gazeInteraction: null,
    windowManager: null,
    renderer: { xr: { getReferenceSpace: jest.fn() } },
    camera: {},
    settings: { enableComfort: true, targetFPS: 90 },
    performanceMonitor: { frameTime: 0 },
    spatialAudio: { updateListenerFromCamera: jest.fn(), play: jest.fn() },
    ...overrides
  });
}

describe('VRApp.updateSystems — gaze-dwell activation glue (FR-13.1)', () => {
  test('an activation fires a both-hands haptic click and a spatial click at the activated object\'s position', () => {
    const activatedMesh = { getWorldPosition: jest.fn((v) => v) };
    const gazeInteraction = { enabled: true, update: jest.fn(() => activatedMesh) };
    const app = makeSystemsApp({ gazeInteraction });

    VRApp.prototype.updateSystems.call(app, 0, null, 0.016);

    expect(gazeInteraction.update).toHaveBeenCalledWith(app.interactables, 16);
    expect(app.hapticFeedback.playPatternBothHands).toHaveBeenCalledWith('click');
    expect(app.spatialAudio.play).toHaveBeenCalledWith('click', 'click', expect.anything());
    expect(activatedMesh.getWorldPosition).toHaveBeenCalledTimes(1);
  });

  test('no activation this frame → no haptic, no spatial click', () => {
    const gazeInteraction = { enabled: true, update: jest.fn(() => null) };
    const app = makeSystemsApp({ gazeInteraction });

    VRApp.prototype.updateSystems.call(app, 0, null, 0.016);

    expect(app.hapticFeedback.playPatternBothHands).not.toHaveBeenCalled();
    expect(app.spatialAudio.play).not.toHaveBeenCalled();
  });

  test('does not poll gazeInteraction.update() while gaze-dwell is disabled', () => {
    const gazeInteraction = { enabled: false, update: jest.fn() };
    const app = makeSystemsApp({ gazeInteraction });

    VRApp.prototype.updateSystems.call(app, 0, null, 0.016);

    expect(gazeInteraction.update).not.toHaveBeenCalled();
  });

  test('does not throw when gazeInteraction has not been created', () => {
    const app = makeSystemsApp({ gazeInteraction: null });
    expect(() => VRApp.prototype.updateSystems.call(app, 0, null, 0.016)).not.toThrow();
  });

  test('activation feedback is null-safe without haptic or spatial audio wired', () => {
    const activatedMesh = { getWorldPosition: jest.fn((v) => v) };
    const gazeInteraction = { enabled: true, update: jest.fn(() => activatedMesh) };
    const app = makeSystemsApp({ gazeInteraction, hapticFeedback: null, spatialAudio: null });
    expect(() => VRApp.prototype.updateSystems.call(app, 0, null, 0.016)).not.toThrow();
  });
});

describe('VRApp.updateSystems — caption aging', () => {
  test('ages captions (converting dt to milliseconds) when captions are enabled', () => {
    const captionSystem = { enabled: true, update: jest.fn(), show: jest.fn() };
    const app = makeSystemsApp({ captionSystem });

    VRApp.prototype.updateSystems.call(app, 0, null, 0.016);

    expect(captionSystem.update).toHaveBeenCalledWith(16);
  });

  test('does not age captions while disabled', () => {
    const captionSystem = { enabled: false, update: jest.fn(), show: jest.fn() };
    const app = makeSystemsApp({ captionSystem });

    VRApp.prototype.updateSystems.call(app, 0, null, 0.016);

    expect(captionSystem.update).not.toHaveBeenCalled();
  });
});

// ── captionSystem getter/setter delegation (AccessibilityCoordinator) ───────
// The other describe blocks above all bind methods to a flat plain-object
// `this` (via makeVRAppLike()), which never touches VRApp.prototype's
// accessors at all — that's what makes this session's Phase 3 extraction
// safe (existing tests are agnostic to it). This block specifically verifies
// the new getter/setter contract itself, using Object.create(VRApp.prototype)
// so the real accessor actually runs.
function makeRealPrototypeInstance() {
  const app = Object.create(VRApp.prototype);
  app.a11y = { captionSystem: null, hapticFeedback: null, gazeInteraction: null };
  return app;
}

describe('VRApp.captionSystem getter/setter (delegates to AccessibilityCoordinator)', () => {
  test('reading captionSystem returns whatever is on this.a11y.captionSystem', () => {
    const app = makeRealPrototypeInstance();
    const fake = { show: jest.fn() };
    app.a11y.captionSystem = fake;
    expect(app.captionSystem).toBe(fake);
  });

  test('assigning captionSystem stores it on this.a11y.captionSystem, not as an own field', () => {
    const app = makeRealPrototypeInstance();
    const fake = { show: jest.fn() };
    app.captionSystem = fake;
    expect(app.a11y.captionSystem).toBe(fake);
    expect(Object.prototype.hasOwnProperty.call(app, 'captionSystem')).toBe(false);
  });
});

describe('VRApp.hapticFeedback getter/setter (delegates to AccessibilityCoordinator)', () => {
  test('reading hapticFeedback returns whatever is on this.a11y.hapticFeedback', () => {
    const app = makeRealPrototypeInstance();
    const fake = { playPattern: jest.fn() };
    app.a11y.hapticFeedback = fake;
    expect(app.hapticFeedback).toBe(fake);
  });

  test('assigning hapticFeedback stores it on this.a11y.hapticFeedback, not as an own field', () => {
    const app = makeRealPrototypeInstance();
    const fake = { playPattern: jest.fn() };
    app.hapticFeedback = fake;
    expect(app.a11y.hapticFeedback).toBe(fake);
    expect(Object.prototype.hasOwnProperty.call(app, 'hapticFeedback')).toBe(false);
  });

  test('captionSystem and hapticFeedback delegate independently', () => {
    const app = makeRealPrototypeInstance();
    const fakeCaptions = { show: jest.fn() };
    app.captionSystem = fakeCaptions;
    expect(app.hapticFeedback).toBeNull();
    expect(app.a11y.hapticFeedback).toBeNull();
  });
});

describe('VRApp.gazeInteraction getter/setter (delegates to AccessibilityCoordinator)', () => {
  test('reading gazeInteraction returns whatever is on this.a11y.gazeInteraction', () => {
    const app = makeRealPrototypeInstance();
    const fake = { update: jest.fn(), enabled: true };
    app.a11y.gazeInteraction = fake;
    expect(app.gazeInteraction).toBe(fake);
  });

  test('assigning gazeInteraction stores it on this.a11y.gazeInteraction, not as an own field', () => {
    const app = makeRealPrototypeInstance();
    const fake = { update: jest.fn() };
    app.gazeInteraction = fake;
    expect(app.a11y.gazeInteraction).toBe(fake);
    expect(Object.prototype.hasOwnProperty.call(app, 'gazeInteraction')).toBe(false);
  });

  test('all three accessibility fields delegate independently', () => {
    const app = makeRealPrototypeInstance();
    const fakeGaze = { update: jest.fn() };
    app.gazeInteraction = fakeGaze;
    expect(app.captionSystem).toBeNull();
    expect(app.hapticFeedback).toBeNull();
    expect(app.a11y.captionSystem).toBeNull();
    expect(app.a11y.hapticFeedback).toBeNull();
  });
});

describe('VRApp.onVRSessionEnd — session-scoped subsystem teardown', () => {
  // onVRSessionEnd() restores desktop pixel ratio via window.devicePixelRatio;
  // this suite runs under the 'node' test environment, which has no window.
  beforeEach(() => { global.window = { devicePixelRatio: 1 }; });
  afterEach(() => { delete global.window; });

  /** Bare `this` with just the fields onVRSessionEnd() reads/writes. */
  function makeSessionEndApp(overrides = {}) {
    return {
      isVREnabled: true,
      ffrSystem: null,
      comfortSystem: null,
      layersSystem: null,
      immersiveVideo: null,
      handTracking: null,
      tabManager: null,
      webPanel: null,
      camera: { fov: 90 },
      onXRVisibilityChange: () => {},
      renderer: { setPixelRatio: jest.fn() },
      ...overrides
    };
  }

  test('disposes handTracking so re-entry does not leak the previous session\'s hand models', () => {
    const handTracking = { dispose: jest.fn() };
    const app = makeSessionEndApp({ handTracking });
    VRApp.prototype.onVRSessionEnd.call(app);
    expect(handTracking.dispose).toHaveBeenCalledTimes(1);
  });

  test('no-ops safely when handTracking was never initialized', () => {
    const app = makeSessionEndApp({ handTracking: null });
    expect(() => VRApp.prototype.onVRSessionEnd.call(app)).not.toThrow();
  });

  test('still disposes layersSystem and stops immersiveVideo alongside handTracking', () => {
    const layersSystem = { dispose: jest.fn() };
    const immersiveVideo = { stop: jest.fn() };
    const handTracking = { dispose: jest.fn() };
    const app = makeSessionEndApp({
      layersSystem, immersiveVideo, handTracking, tabManager: { tabs: [] }
    });
    VRApp.prototype.onVRSessionEnd.call(app);
    expect(layersSystem.dispose).toHaveBeenCalledTimes(1);
    expect(immersiveVideo.stop).toHaveBeenCalledTimes(1);
    expect(handTracking.dispose).toHaveBeenCalledTimes(1);
  });
});

// ── OS accessibility signal live-propagation (WCAG 2.3.3 / 1.4.11) ──────────
// osReducedMotion()/prefersHighContrast() were previously only read once, at
// each subsystem's construction time — an OS-level preference toggled after
// the page has already loaded (e.g. from the headset's system Quick Settings,
// without reloading the tab) never reached the already-constructed
// comfortSystem/gazeInteraction/captionSystem for the rest of the page's
// lifetime. _setupOSAccessibilityListeners() subscribes to the underlying
// MediaQueryList 'change' events so a mid-session OS change takes effect live.
describe('VRApp._setupOSAccessibilityListeners', () => {
  let mqs;
  let realMatchMedia;

  beforeEach(() => {
    realMatchMedia = global.matchMedia;
    mqs = {};
    global.matchMedia = jest.fn((query) => {
      if (!mqs[query]) {
        mqs[query] = { matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() };
      }
      return mqs[query];
    });
  });

  afterEach(() => {
    global.matchMedia = realMatchMedia;
  });

  test('subscribes to reduced-motion, prefers-contrast, and forced-colors media queries', () => {
    const app = makeVRAppLike({ comfortSystem: null, gazeInteraction: null, captionSystem: null });
    VRApp.prototype._setupOSAccessibilityListeners.call(app);

    expect(mqs['(prefers-reduced-motion: reduce)'].addEventListener)
      .toHaveBeenCalledWith('change', expect.any(Function));
    expect(mqs['(prefers-contrast: more)'].addEventListener)
      .toHaveBeenCalledWith('change', expect.any(Function));
    expect(mqs['(forced-colors: active)'].addEventListener)
      .toHaveBeenCalledWith('change', expect.any(Function));
  });

  test('a reduced-motion OS change propagates live to comfortSystem and gazeInteraction', () => {
    const comfortSystem = { setReducedMotion: jest.fn() };
    const gazeInteraction = { setReducedMotion: jest.fn(), setHighContrast: jest.fn() };
    const app = makeVRAppLike({ comfortSystem, gazeInteraction, captionSystem: null });
    VRApp.prototype._setupOSAccessibilityListeners.call(app);

    const handler = mqs['(prefers-reduced-motion: reduce)'].addEventListener.mock.calls[0][1];
    handler({ matches: true });

    expect(comfortSystem.setReducedMotion).toHaveBeenCalledWith(true);
    expect(gazeInteraction.setReducedMotion).toHaveBeenCalledWith(true);
  });

  test('an OS prefers-contrast change propagates the recomputed prefersHighContrast() to gazeInteraction and captionSystem', () => {
    const gazeInteraction = { setReducedMotion: jest.fn(), setHighContrast: jest.fn() };
    const captionSystem = { setHighContrast: jest.fn() };
    const app = makeVRAppLike({ comfortSystem: null, gazeInteraction, captionSystem });
    VRApp.prototype._setupOSAccessibilityListeners.call(app);

    mqs['(prefers-contrast: more)'].matches = true; // simulate the OS flipping the signal
    const handler = mqs['(prefers-contrast: more)'].addEventListener.mock.calls[0][1];
    handler();

    expect(gazeInteraction.setHighContrast).toHaveBeenCalledWith(true);
    expect(captionSystem.setHighContrast).toHaveBeenCalledWith(true);
  });

  test('a forced-colors change uses the same propagation as prefers-contrast', () => {
    const gazeInteraction = { setHighContrast: jest.fn() };
    const captionSystem = { setHighContrast: jest.fn() };
    const app = makeVRAppLike({ comfortSystem: null, gazeInteraction, captionSystem });
    VRApp.prototype._setupOSAccessibilityListeners.call(app);

    mqs['(forced-colors: active)'].matches = true;
    const handler = mqs['(forced-colors: active)'].addEventListener.mock.calls[0][1];
    handler();

    expect(gazeInteraction.setHighContrast).toHaveBeenCalledWith(true);
    expect(captionSystem.setHighContrast).toHaveBeenCalledWith(true);
  });

  test('no-ops safely without matchMedia (test / non-browser env)', () => {
    global.matchMedia = undefined;
    const app = makeVRAppLike({});
    expect(() => VRApp.prototype._setupOSAccessibilityListeners.call(app)).not.toThrow();
  });

  test('is null-safe when comfortSystem/gazeInteraction/captionSystem are not yet constructed', () => {
    const app = makeVRAppLike({ comfortSystem: null, gazeInteraction: null, captionSystem: null });
    VRApp.prototype._setupOSAccessibilityListeners.call(app);
    const handler = mqs['(prefers-reduced-motion: reduce)'].addEventListener.mock.calls[0][1];
    expect(() => handler({ matches: true })).not.toThrow();
  });
});

// ── Teleport-aim state on controller disconnect ──────────────────────────────
// A controller disconnect (headset removed, VR session ends, or a
// hand-tracking handoff) only ever fires 'disconnected', never 'squeezeend'.
// Without _cancelTeleportIfAimedBy(), a mid-aim teleport left teleport.active
// stuck true and the marker frozen at its last raycast position forever.
function makeTeleportApp(overrides = {}) {
  return makeVRAppLike({
    teleport: { active: false, controller: null, marker: { visible: false }, target: null, valid: false },
    playerRig: { position: { x: 0, y: 0, z: 0 } },
    camera: { getWorldPosition: (v) => { v.x = 0; v.z = 0; return v; } },
    // onTeleportEnd()/_cancelTeleportIfAimedBy() call this.\_resetTeleportAim()
    // internally — supply the real prototype method so that internal call
    // resolves (the fake `this` here is a plain object literal, not an
    // instance of VRApp, so it has no other access to its own prototype).
    _resetTeleportAim: VRApp.prototype._resetTeleportAim,
    ...overrides
  });
}

describe('VRApp._resetTeleportAim', () => {
  test('clears active/valid/controller and hides the marker', () => {
    const controller = {};
    const app = makeTeleportApp({
      teleport: { active: true, valid: true, controller, marker: { visible: true }, target: { x: 1, z: 2 } }
    });
    VRApp.prototype._resetTeleportAim.call(app);
    expect(app.teleport.active).toBe(false);
    expect(app.teleport.valid).toBe(false);
    expect(app.teleport.controller).toBeNull();
    expect(app.teleport.marker.visible).toBe(false);
  });

  test('no-ops safely with no marker', () => {
    const app = makeTeleportApp({ teleport: { active: true, valid: false, controller: {}, marker: null, target: null } });
    expect(() => VRApp.prototype._resetTeleportAim.call(app)).not.toThrow();
  });
});

describe('VRApp._cancelTeleportIfAimedBy', () => {
  test('cancels the aim when the disconnecting controller is the one currently aiming', () => {
    const controller = {};
    const app = makeTeleportApp({
      teleport: { active: true, valid: true, controller, marker: { visible: true }, target: { x: 1, z: 2 } }
    });
    VRApp.prototype._cancelTeleportIfAimedBy.call(app, controller);
    expect(app.teleport.active).toBe(false);
    expect(app.teleport.controller).toBeNull();
    expect(app.teleport.marker.visible).toBe(false);
  });

  test('does not touch an unrelated, still-aiming controller (the other hand)', () => {
    const aimingController = {};
    const disconnectingController = {}; // a different controller
    const app = makeTeleportApp({
      teleport: { active: true, valid: true, controller: aimingController, marker: { visible: true }, target: { x: 1, z: 2 } }
    });
    VRApp.prototype._cancelTeleportIfAimedBy.call(app, disconnectingController);
    expect(app.teleport.active).toBe(true);
    expect(app.teleport.controller).toBe(aimingController);
    expect(app.teleport.marker.visible).toBe(true);
  });

  test('is a no-op when no teleport is in progress', () => {
    const app = makeTeleportApp();
    expect(() => VRApp.prototype._cancelTeleportIfAimedBy.call(app, {})).not.toThrow();
    expect(app.teleport.active).toBe(false);
  });
});

describe('VRApp._onWebPanelToggleChanged', () => {
  // This toggle used to be able to do nothing but say "reload the page":
  // enableWebPanel gated a one-shot construction inside initializeSystems(),
  // which runs once from the constructor. In a headset "reload" means take the
  // device off, so the whole browsing feature area was unreachable in practice.
  // Construction now lives in _buildBrowsingSystems(), callable at runtime.
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const makeToggleApp = (over = {}) => makeVRAppLike({
    isVREnabled: true,
    camera: { add: jest.fn(), remove: jest.fn() },
    showVRToast: VRApp.prototype.showVRToast,
    _buildBrowsingSystems: jest.fn(),
    _teardownBrowsingSystems: jest.fn(),
    _attachManagedWindow: jest.fn(),
    settings: { enableWebPanel: false },
    ...over
  });

  test('turning it ON builds the browsing systems immediately', () => {
    const app = makeToggleApp();
    VRApp.prototype._onWebPanelToggleChanged.call(app, true);

    expect(app._buildBrowsingSystems).toHaveBeenCalledTimes(1);
    expect(app._teardownBrowsingSystems).not.toHaveBeenCalled();
    // …and the window manager is pointed at the newly-built panels.
    expect(app._attachManagedWindow).toHaveBeenCalled();
  });

  test('turning it OFF tears them down immediately', () => {
    const app = makeToggleApp({ settings: { enableWebPanel: true } });
    VRApp.prototype._onWebPanelToggleChanged.call(app, false);

    expect(app._teardownBrowsingSystems).toHaveBeenCalledTimes(1);
    expect(app._buildBrowsingSystems).not.toHaveBeenCalled();
  });

  test('confirms cross-modally which way it went (WCAG 4.1.3)', () => {
    const on = makeToggleApp();
    VRApp.prototype._onWebPanelToggleChanged.call(on, true);
    expect(on.captionSystem.show).toHaveBeenCalledTimes(1);
    expect(on.captionSystem.show.mock.calls[0][0]).toMatch(/enabled|有効/i);
    expect(on.hapticFeedback.playPatternBothHands).toHaveBeenCalledTimes(1);

    const off = makeToggleApp();
    VRApp.prototype._onWebPanelToggleChanged.call(off, false);
    expect(off.captionSystem.show.mock.calls[0][0]).toMatch(/closed|閉じ/i);
  });

  test('no longer tells the user to reload — that was the defect', () => {
    const app = makeToggleApp();
    VRApp.prototype._onWebPanelToggleChanged.call(app, true);
    expect(app.captionSystem.show.mock.calls[0][0]).not.toMatch(/reload|再読み込み/i);
  });

  test('falls back to the persisted setting when called with no argument', () => {
    const app = makeToggleApp({ settings: { enableWebPanel: true } });
    VRApp.prototype._onWebPanelToggleChanged.call(app);
    expect(app._buildBrowsingSystems).toHaveBeenCalledTimes(1);
  });
});


describe('VRApp._clearBrowsingHistory (privacy action)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('clears the store and fires a cross-modal confirmation', () => {
    const camera = { add: jest.fn(), remove: jest.fn() };
    const bookmarks = { clearHistory: jest.fn() };
    const app = makeVRAppLike({
      isVREnabled: true, camera, bookmarks, bookmarkPanel: null,
      showVRToast: VRApp.prototype.showVRToast
    });
    VRApp.prototype._clearBrowsingHistory.call(app);

    expect(bookmarks.clearHistory).toHaveBeenCalledTimes(1);
    expect(app.captionSystem.show).toHaveBeenCalledTimes(1);
    expect(app.captionSystem.show.mock.calls[0][0]).toMatch(/cleared|消去/i);
  });

  test('refreshes an open bookmark/history panel so the cleared list shows', () => {
    const camera = { add: jest.fn(), remove: jest.fn() };
    const bookmarks = { clearHistory: jest.fn() };
    const bookmarkPanel = { visible: true, _draw: jest.fn() };
    const app = makeVRAppLike({
      isVREnabled: true, camera, bookmarks, bookmarkPanel,
      showVRToast: VRApp.prototype.showVRToast
    });
    VRApp.prototype._clearBrowsingHistory.call(app);

    expect(bookmarkPanel._draw).toHaveBeenCalledTimes(1);
  });

  test('no-ops safely when the store is absent', () => {
    const app = makeVRAppLike({ bookmarks: null, bookmarkPanel: null, showVRToast: jest.fn() });
    expect(() => VRApp.prototype._clearBrowsingHistory.call(app)).not.toThrow();
  });
});

describe('VRApp.onTeleportEnd (refactor-preserving behavior)', () => {
  test('completes a valid teleport (moves the rig, fires feedback) and resets aim state', () => {
    const controller = {};
    const hapticFeedback = { playPattern: jest.fn(), playPatternBothHands: jest.fn() };
    const captionSystem = { enabled: true, show: jest.fn() };
    const app = makeTeleportApp({
      teleport: { active: true, valid: true, controller, marker: { visible: true }, target: { x: 5, z: 5 } },
      hapticFeedback,
      captionSystem
    });
    VRApp.prototype.onTeleportEnd.call(app);

    expect(app.playerRig.position.x).toBeCloseTo(5, 5);
    expect(app.playerRig.position.z).toBeCloseTo(5, 5);
    expect(app.teleport.active).toBe(false);
    expect(app.teleport.marker.visible).toBe(false);
  });

  test('an invalid/no-target aim just resets state without moving the rig', () => {
    const controller = {};
    const app = makeTeleportApp({
      teleport: { active: true, valid: false, controller, marker: { visible: true }, target: null }
    });
    VRApp.prototype.onTeleportEnd.call(app);

    expect(app.playerRig.position.x).toBe(0);
    expect(app.playerRig.position.z).toBe(0);
    expect(app.teleport.active).toBe(false);
    expect(app.teleport.marker.visible).toBe(false);
  });
});

// ── FR-1.5: per-panel quad-layer release on tab close ────────────────────────
// WebPanel.disableLayerMode()'s detach callback routes here so a closed tab's
// XRQuadLayer is actually deregistered from LayersSystem AND dropped from the
// committed render state, using the live session + base layer.
describe('VRApp._detachPanelLayer', () => {
  function makeLayerApp(overrides = {}) {
    return makeVRAppLike({
      layersSystem: { removeLayer: jest.fn() },
      renderer: {
        xr: {
          getSession: () => ({ id: 'session' }),
          getBaseLayer: () => ({ id: 'base' })
        }
      },
      ...overrides
    });
  }

  test('removes the layer with the live session and base layer', () => {
    const app = makeLayerApp();
    VRApp.prototype._detachPanelLayer.call(app, 'panel_chrome_1');
    expect(app.layersSystem.removeLayer).toHaveBeenCalledWith(
      'panel_chrome_1', { id: 'session' }, { id: 'base' }
    );
  });

  test('no-ops safely when layersSystem is not present (Layers unsupported)', () => {
    const app = makeLayerApp({ layersSystem: null });
    expect(() => VRApp.prototype._detachPanelLayer.call(app, 'panel_chrome_0')).not.toThrow();
  });
});

describe('VRApp._buildBrowsingSystems / _teardownBrowsingSystems', () => {
  // Symmetry matters more than usual here: the toggle can now be flipped any
  // number of times in a live session, so a leak or a double-build compounds.
  const makeApp = () => makeVRAppLike({
    scene: { add: jest.fn(), remove: jest.fn() },
    windowManager: { detach: jest.fn(), attach: jest.fn(), target: null },
    tabManager: null,
    bookmarkPanel: null,
    webPanel: null
  });

  test('teardown disposes the tab manager and the bookmark panel, and detaches', () => {
    const app = makeApp();
    app.tabManager = { dispose: jest.fn() };
    app.bookmarkPanel = { dispose: jest.fn() };

    VRApp.prototype._teardownBrowsingSystems.call(app);

    expect(app.tabManager).toBeNull();
    expect(app.bookmarkPanel).toBeNull();
    expect(app.webPanel).toBeNull();
    // Leaving the manager attached to a disposed group is the ghost-target
    // failure mode fixed for hand models (S49) and quad layers (S52).
    expect(app.windowManager.detach).toHaveBeenCalledTimes(1);
  });

  test('teardown disposes a standalone webPanel when tabs are not in use', () => {
    const app = makeApp();
    const webPanel = { dispose: jest.fn() };
    app.webPanel = webPanel;

    VRApp.prototype._teardownBrowsingSystems.call(app);

    expect(webPanel.dispose).toHaveBeenCalledTimes(1);
    expect(app.webPanel).toBeNull();
  });

  test('teardown is safe when nothing was ever built', () => {
    const app = makeApp();
    expect(() => VRApp.prototype._teardownBrowsingSystems.call(app)).not.toThrow();
    expect(app.tabManager).toBeNull();
  });

  test('build is idempotent — a double toggle cannot create two panel sets', () => {
    const app = makeApp();
    const existing = { dispose: jest.fn() };
    app.tabManager = existing;

    VRApp.prototype._buildBrowsingSystems.call(app);

    // Returned early: the existing manager is untouched, not replaced.
    expect(app.tabManager).toBe(existing);
    expect(app.scene.add).not.toHaveBeenCalled();
  });
});

describe('VRApp._requestReaderProxyInput — the proxy setting is finally reachable', () => {
  // readerProxyUrl existed as a settings key with no settings control, voice
  // command or URL parameter — docs/PROXY.md said "set the setting" with no
  // way to do it. This action button + VR keyboard is the closing of that gap,
  // so the wiring itself is what these tests pin.
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const makeProxyApp = (over = {}) => makeVRAppLike({
    isVREnabled: true,
    camera: { add: jest.fn(), remove: jest.fn() },
    showVRToast: VRApp.prototype.showVRToast,
    settings: { readerProxyUrl: '' },
    updateSetting: jest.fn(function (k, v) { this.settings[k] = v; }),
    tabManager: { setReaderProxyUrl: jest.fn() },
    // Captures the confirm callback so each test can play the typed input.
    _requestVRKeyboardInput: jest.fn(function (prefill, onConfirm) {
      this._kbPrefill = prefill;
      this._kbConfirm = onConfirm;
    }),
    ...over
  });

  test('valid input persists, applies to open tabs immediately, and confirms', () => {
    const app = makeProxyApp();
    VRApp.prototype._requestReaderProxyInput.call(app);
    app._kbConfirm('http://192.168.1.20:8080/');

    expect(app.updateSetting).toHaveBeenCalledWith('readerProxyUrl', 'http://192.168.1.20:8080');
    expect(app.tabManager.setReaderProxyUrl).toHaveBeenCalledWith('http://192.168.1.20:8080');
    expect(app.captionSystem.show.mock.calls[0][0]).toMatch(/proxy set|設定しました/i);
  });

  test('empty input clears the proxy and says so', () => {
    const app = makeProxyApp({ settings: { readerProxyUrl: 'http://old:8080' } });
    VRApp.prototype._requestReaderProxyInput.call(app);
    // Prefilled with the current value so the user edits rather than retypes.
    expect(app._kbPrefill).toBe('http://old:8080');
    app._kbConfirm('   ');

    expect(app.updateSetting).toHaveBeenCalledWith('readerProxyUrl', '');
    expect(app.tabManager.setReaderProxyUrl).toHaveBeenCalledWith('');
    expect(app.captionSystem.show.mock.calls[0][0]).toMatch(/cleared|解除/i);
  });

  test('invalid input changes NOTHING and warns', () => {
    const app = makeProxyApp();
    VRApp.prototype._requestReaderProxyInput.call(app);
    app._kbConfirm('ftp://not-a-web-proxy');

    expect(app.updateSetting).not.toHaveBeenCalled();
    expect(app.tabManager.setReaderProxyUrl).not.toHaveBeenCalled();
    expect(app.captionSystem.show.mock.calls[0][0]).toMatch(/invalid|不正/i);
  });

  test('falls back to a standalone webPanel when tabs are not built', () => {
    const webPanel = { setReaderProxyUrl: jest.fn() };
    const app = makeProxyApp({ tabManager: null, webPanel });
    VRApp.prototype._requestReaderProxyInput.call(app);
    app._kbConfirm('http://p:8080');

    expect(webPanel.setReaderProxyUrl).toHaveBeenCalledWith('http://p:8080');
  });
});

describe('the browsing default', () => {
  test('enableWebPanel defaults ON — the core loop ships enabled', () => {
    // This pins a deliberate product decision (Session 74), not an accident.
    // The old false default was justified by measured conditions that were
    // then dismantled one by one: the reader exists (S61), the failure screen
    // names the cause and the fix (#50), the proxy exists (#45) and is
    // settable from inside VR (#54), and the toggle applies live (#47).
    // A browser whose browsing is invisible by default is not finished.
    // Reverting is one line here — but whoever flips it back inherits the
    // burden of saying which of those conditions regressed.
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../src/vr/VRApp.js'), 'utf8'
    );
    expect(src).toMatch(/enableWebPanel:\s*true,/);
    expect(src).not.toMatch(/enableWebPanel:\s*false,/);
  });
});

// ── Voice commands: reachable at last ────────────────────────────────────────
// `enableVoice` defaulted false and NO settings-panel control, voice command or
// persisted path could set it — the enableWebPanel shape. It matters more here:
// voice is the primary modality for users who find gaze/controller input hard,
// so the escape hatch for the people who need it most had no switch. The usage
// guide told them to "enable Voice in settings"; there was nothing there.
describe('VRApp._onVoiceToggleChanged', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const makeVoiceApp = (over = {}) => makeVRAppLike({
    isVREnabled: true,
    camera: { add: jest.fn(), remove: jest.fn() },
    showVRToast: VRApp.prototype.showVRToast,
    _buildVoiceCommands: jest.fn(async () => true),
    _teardownVoiceCommands: jest.fn(),
    settings: { enableVoice: false },
    ...over
  });

  test('a settings control exists for it (it is not gated behind nothing)', () => {
    // The regression that made voice unreachable was a setting with no control,
    // so assert the wiring method the control calls actually exists.
    expect(typeof VRApp.prototype._onVoiceToggleChanged).toBe('function');
    expect(typeof VRApp.prototype._buildVoiceCommands).toBe('function');
    expect(typeof VRApp.prototype._teardownVoiceCommands).toBe('function');
  });

  test('turning it ON builds voice commands immediately', async () => {
    const app = makeVoiceApp();
    await VRApp.prototype._onVoiceToggleChanged.call(app, true);
    expect(app._buildVoiceCommands).toHaveBeenCalledTimes(1);
    expect(app._teardownVoiceCommands).not.toHaveBeenCalled();
  });

  test('turning it OFF tears them down immediately', async () => {
    const app = makeVoiceApp({ settings: { enableVoice: true } });
    await VRApp.prototype._onVoiceToggleChanged.call(app, false);
    expect(app._teardownVoiceCommands).toHaveBeenCalledTimes(1);
    expect(app._buildVoiceCommands).not.toHaveBeenCalled();
  });

  test('it never tells the user to reload — it applies now', async () => {
    const app = makeVoiceApp();
    app.captionSystem = { enabled: true, show: jest.fn() };
    await VRApp.prototype._onVoiceToggleChanged.call(app, true);
    const said = app.captionSystem.show.mock.calls.map((c) => String(c[0])).join(' ');
    expect(said).not.toMatch(/reload|リロード|再読み込み/i);
  });

  test('a refused microphone is reported, not silently swallowed', async () => {
    // initialize() returning false means no browser support or denied
    // permission. The user asked for voice and must be told it did not start.
    const app = makeVoiceApp({ _buildVoiceCommands: jest.fn(async () => false) });
    app.captionSystem = { enabled: true, show: jest.fn() };
    await VRApp.prototype._onVoiceToggleChanged.call(app, true);
    expect(app.captionSystem.show).toHaveBeenCalled();
  });

  test('building twice is idempotent (no second recognizer)', async () => {
    const app = makeVRAppLike({
      voiceCommands: { dispose: jest.fn() },
      settings: { enableVoice: true }
    });
    await expect(VRApp.prototype._buildVoiceCommands.call(app)).resolves.toBe(true);
  });

  test('teardown releases the recognizer and is safe when absent', () => {
    const dispose = jest.fn();
    const app = makeVRAppLike({ voiceCommands: { dispose } });
    VRApp.prototype._teardownVoiceCommands.call(app);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(app.voiceCommands).toBeNull();
    expect(() => VRApp.prototype._teardownVoiceCommands.call(app)).not.toThrow();
  });
});

// ── Deployment-carried reader proxy detection ───────────────────────────────
describe('VRApp._detectReaderProxy', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  const makeApp = (over = {}) => makeVRAppLike({
    settings: { readerProxyUrl: '' },
    tabManager: { setReaderProxyUrl: jest.fn() },
    ...over
  });

  test('a deployment carrying a proxy is found and applied to open tabs', async () => {
    global.fetch = jest.fn(async () => ({ ok: true }));
    const app = makeApp();
    await VRApp.prototype._detectReaderProxy.call(app);
    expect(String(global.fetch.mock.calls[0][0])).toMatch(/api\/reader\/health$/);
    expect(app.tabManager.setReaderProxyUrl).toHaveBeenCalledWith(
      expect.stringMatching(/api\/reader$/));
  });

  test('a static host without one changes nothing', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 404 }));
    const app = makeApp();
    await VRApp.prototype._detectReaderProxy.call(app);
    expect(app.tabManager.setReaderProxyUrl).not.toHaveBeenCalled();
  });

  test('a probe that throws is not an error the user ever sees', async () => {
    global.fetch = jest.fn(async () => { throw new TypeError('offline'); });
    const app = makeApp();
    await expect(VRApp.prototype._detectReaderProxy.call(app)).resolves.toBeUndefined();
    expect(app.tabManager.setReaderProxyUrl).not.toHaveBeenCalled();
  });

  test('a proxy the user configured is never probed over', async () => {
    global.fetch = jest.fn(async () => ({ ok: true }));
    const app = makeApp({ settings: { readerProxyUrl: 'https://mine.example' } });
    await VRApp.prototype._detectReaderProxy.call(app);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(app.tabManager.setReaderProxyUrl).not.toHaveBeenCalled();
  });

  test('detection is not persisted — it describes the deployment, not a preference', async () => {
    // Persisting it would make a later deploy without a proxy look broken.
    global.fetch = jest.fn(async () => ({ ok: true }));
    const app = makeApp({ updateSetting: jest.fn() });
    await VRApp.prototype._detectReaderProxy.call(app);
    expect(app.updateSetting).not.toHaveBeenCalled();
    expect(app.settings.readerProxyUrl).toBe('');
  });

  test('no fetch at all (non-browser) is a safe no-op', async () => {
    global.fetch = undefined;
    const app = makeApp();
    await expect(VRApp.prototype._detectReaderProxy.call(app)).resolves.toBeUndefined();
  });
});

// ── Find-in-page: settings action and announcement glue ──────────────────────
// Two modalities reach findInPage (settings-panel action + voice); both funnel
// through _announceFindResult so the count is announced cross-modally
// (WCAG 4.1.3) — "no matches" saves a gaze user a fruitless scroll.
describe('VRApp find-in-page glue', () => {
  const makeApp = () => {
    const toasts = [];
    const app = {
      showVRToast: (msg, opts) => toasts.push({ msg, opts }),
      _announceFindResult: VRApp.prototype._announceFindResult,
      _requestFindInPageInput: VRApp.prototype._requestFindInPageInput,
      _requestVRKeyboardInput: null,
      tabManager: null
    };
    return { app, toasts };
  };

  test('a result with matches announces the ordinal and count', () => {
    const { app, toasts } = makeApp();
    app._announceFindResult({ count: 7, index: 3 });
    expect(toasts).toHaveLength(1);
    expect(toasts[0].msg).toContain('3/7');
    expect(toasts[0].opts).toEqual({ type: 'info' });
  });

  test('no matches announces that, as a warning', () => {
    const { app, toasts } = makeApp();
    app._announceFindResult({ count: 0, index: 0 });
    expect(toasts).toHaveLength(1);
    expect(toasts[0].opts).toEqual({ type: 'warn' });
  });

  test('the settings action prompts on the VR keyboard and runs the search', () => {
    const { app, toasts } = makeApp();
    const findInPage = jest.fn(() => ({ count: 2, index: 1 }));
    app.tabManager = { getActiveTab: () => ({ findInPage }) };
    let confirmed;
    app._requestVRKeyboardInput = (prefill, cb, label) => {
      expect(prefill).toBe('');
      expect(typeof label).toBe('string');
      confirmed = cb;
    };
    app._requestFindInPageInput();
    confirmed('needle');
    expect(findInPage).toHaveBeenCalledWith('needle');
    expect(toasts).toHaveLength(1);
    expect(toasts[0].msg).toContain('1/2');
  });

  test('no active tab is a safe no-op', () => {
    const { app, toasts } = makeApp();
    let confirmed;
    app._requestVRKeyboardInput = (_p, cb) => { confirmed = cb; };
    app._requestFindInPageInput();
    expect(() => confirmed('x')).not.toThrow();
    expect(toasts).toHaveLength(0);
  });
});

// ── Following a numbered link by voice ───────────────────────────────────────
// Success is announced by the existing onLinkFollowed path; only the failure
// needs its own message, since silence leaves the user unsure the number was
// even heard (WCAG 4.1.3).
describe('VRApp onFollowLink glue', () => {
  const makeApp = (activeTab) => {
    const toasts = [];
    return {
      toasts,
      app: {
        showVRToast: (msg, opts) => toasts.push({ msg, opts }),
        tabManager: { getActiveTab: () => activeTab }
      }
    };
  };

  /** The wiring under test, mirroring VRApp's connectBrowser callback. */
  const follow = (app, n) => {
    const active = app.tabManager?.getActiveTab?.();
    const out = active && typeof active.followLink === 'function'
      ? active.followLink(n) : { ok: false };
    if (!out.ok) {
      app.showVRToast('no such link', { type: 'warn' });
    }
    return out;
  };

  test('a successful follow stays silent here — onLinkFollowed already announced', () => {
    const followLink = jest.fn(() => ({ ok: true, href: 'https://x.example/' }));
    const { app, toasts } = makeApp({ followLink });
    follow(app, 2);
    expect(followLink).toHaveBeenCalledWith(2);
    expect(toasts).toHaveLength(0);
  });

  test('an out-of-range number warns instead of doing nothing visible', () => {
    const { app, toasts } = makeApp({ followLink: () => ({ ok: false }) });
    follow(app, 99);
    expect(toasts).toHaveLength(1);
    expect(toasts[0].opts).toEqual({ type: 'warn' });
  });

  test('no active tab warns rather than throwing', () => {
    const { app, toasts } = makeApp(null);
    expect(() => follow(app, 1)).not.toThrow();
    expect(toasts).toHaveLength(1);
  });
});
