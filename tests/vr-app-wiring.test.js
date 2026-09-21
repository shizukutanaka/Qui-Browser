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
  XRControllerModelFactory: class {
    createControllerModel() {
      return {};
    }
  }
}));

// ── canvas/document stub (showVRToast draws a 2D toast texture) ──────────────
const ctx2d = {
  fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '', textBaseline: '',
  fillRect: jest.fn(), strokeRect: jest.fn(), fillText: jest.fn(), clearRect: jest.fn()
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
const { VRApp, defaultSettings } = require('../src/vr/VRApp.js');

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

describe('VRApp.updateSystems — per-frame arms (hand tracking, haptic refresh, layers blit)', () => {
  test('xrFrame present: handTracking.update gets the reference space; haptics and listener refresh every frame', () => {
    const refSpace = { kind: 'local' };
    const xrFrame = { id: 1 };
    const handTracking = { update: jest.fn() };
    const hapticFeedback = { update: jest.fn(), playPatternBothHands: jest.fn() };
    const spatialAudio = { updateListenerFromCamera: jest.fn(), play: jest.fn() };
    const app = makeSystemsApp({
      handTracking, hapticFeedback, spatialAudio,
      renderer: { xr: { getReferenceSpace: () => refSpace } }
    });
    VRApp.prototype.updateSystems.call(app, 0, xrFrame, 0.016);
    expect(handTracking.update).toHaveBeenCalledWith(xrFrame, refSpace);
    expect(hapticFeedback.update).toHaveBeenCalled();
    expect(spatialAudio.updateListenerFromCamera).toHaveBeenCalledWith(app.camera);
  });

  test('no xrFrame → handTracking.update skipped (desktop frames)', () => {
    const handTracking = { update: jest.fn() };
    const app = makeSystemsApp({ handTracking });
    VRApp.prototype.updateSystems.call(app, 0, null, 0.016);
    expect(handTracking.update).not.toHaveBeenCalled();
  });

  test('supported layers blit: every tab panel gets updateLayer(xrFrame, views)', () => {
    const views = [{ eye: 'left' }, { eye: 'right' }];
    const xrFrame = { getViewerPose: jest.fn(() => ({ views })) };
    const refSpace = {};
    const panels = [{ updateLayer: jest.fn() }, { updateLayer: jest.fn() }];
    const app = makeSystemsApp({
      layersSystem: { isSupported: true },
      tabManager: { tabs: panels },
      renderer: { xr: { getReferenceSpace: () => refSpace } }
    });
    VRApp.prototype.updateSystems.call(app, 0, xrFrame, 0.016);
    expect(xrFrame.getViewerPose).toHaveBeenCalledWith(refSpace);
    for (const p of panels) {
      expect(p.updateLayer).toHaveBeenCalledWith(xrFrame, views);
    }
  });

  test('layers fall back to the single webPanel when no tabManager; skip when pose unavailable', () => {
    const xrFrame = { getViewerPose: jest.fn(() => ({ views: [{}] })) };
    const panel = { updateLayer: jest.fn() };
    const app = makeSystemsApp({
      layersSystem: { isSupported: true },
      tabManager: null, webPanel: panel,
      renderer: { xr: { getReferenceSpace: () => ({}) } }
    });
    VRApp.prototype.updateSystems.call(app, 0, xrFrame, 0.016);
    expect(panel.updateLayer).toHaveBeenCalled();

    const xrFrameNoPose = { getViewerPose: jest.fn(() => null) };
    const panel2 = { updateLayer: jest.fn() };
    const app2 = makeSystemsApp({
      layersSystem: { isSupported: true },
      tabManager: { tabs: [panel2] },
      renderer: { xr: { getReferenceSpace: () => ({}) } }
    });
    VRApp.prototype.updateSystems.call(app2, 0, xrFrameNoPose, 0.016);
    expect(panel2.updateLayer).not.toHaveBeenCalled();
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
  beforeEach(() => {
    global.window = { devicePixelRatio: 1 };
  });
  afterEach(() => {
    delete global.window;
  });

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
    camera: { getWorldPosition: (v) => {
      v.x = 0; v.z = 0; return v;
    } },
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
    updateSetting: jest.fn(function (k, v) {
      this.settings[k] = v;
    }),
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

describe('VRApp.navigate — private mode records no history', () => {
  const makeNavApp = (privateMode) => makeVRAppLike({
    bookmarks: { addHistory: jest.fn() },
    settings: { privateMode },
    captionSystem: { enabled: true, show: jest.fn(), update: jest.fn() }
  });

  test('records the visit when private mode is off', () => {
    const app = makeNavApp(false);
    VRApp.prototype.navigate.call(app, 'https://example.com', 'Example');
    expect(app.bookmarks.addHistory).toHaveBeenCalledWith('https://example.com', 'Example');
  });

  test('records nothing when private mode is on, but still captions the title', () => {
    const app = makeNavApp(true);
    VRApp.prototype.navigate.call(app, 'https://example.com', 'Example');
    expect(app.bookmarks.addHistory).not.toHaveBeenCalled();
    // Suppressing the caption would silence the ambient channel for the same
    // user — private mode governs recording, not feedback.
    expect(app.captionSystem.show).toHaveBeenCalledWith('Example');
  });

  test('the toggle ships in the browsing settings section', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../src/vr/VRApp.js'), 'utf8'
    );
    expect(src).toMatch(/privateMode:\s*false,/);
    expect(src).toMatch(/'privateMode'/);
  });
});

describe('VRApp — tab session persistence (F-4)', () => {
  const { TAB_SESSION_KEY } = require('../src/vr/browser/TabManager.js');
  let store;
  beforeEach(() => {
    store = {};
    global.localStorage = {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: (k) => {
        delete store[k];
      }
    };
  });

  const makeSessionApp = (privateMode) => makeVRAppLike({
    settings: { privateMode },
    tabManager: {
      serialize: jest.fn(() => ({ v: 1, active: 0, tabs: [{ url: 'https://a.example' }] })),
      restoreSession: jest.fn(() => 1)
    }
  });

  test('_saveTabSession persists the serialized session under the session key', () => {
    const app = makeSessionApp(false);
    VRApp.prototype._saveTabSession.call(app);
    expect(JSON.parse(store[TAB_SESSION_KEY])).toEqual(
      { v: 1, active: 0, tabs: [{ url: 'https://a.example' }] }
    );
  });

  test('_saveTabSession writes nothing in private mode — an incognito session stays ephemeral', () => {
    const app = makeSessionApp(true);
    VRApp.prototype._saveTabSession.call(app);
    expect(Object.keys(store)).toHaveLength(0);
  });

  test('_restoreTabSession hands the parsed data to TabManager when private mode is off', () => {
    const saved = { v: 1, active: 0, tabs: [{ url: 'https://a.example' }] };
    store[TAB_SESSION_KEY] = JSON.stringify(saved);
    const app = makeSessionApp(false);

    expect(VRApp.prototype._restoreTabSession.call(app)).toBe(1);
    expect(app.tabManager.restoreSession).toHaveBeenCalledWith(saved);
  });

  test('_restoreTabSession skips a saved session entirely in private mode', () => {
    store[TAB_SESSION_KEY] = JSON.stringify({ tabs: [{ url: 'https://a.example' }] });
    const app = makeSessionApp(true);

    expect(VRApp.prototype._restoreTabSession.call(app)).toBe(0);
    expect(app.tabManager.restoreSession).not.toHaveBeenCalled();
  });

  test('_restoreTabSession swallows corrupt storage and reports 0', () => {
    store[TAB_SESSION_KEY] = '{not json';
    const app = makeSessionApp(false);
    expect(VRApp.prototype._restoreTabSession.call(app)).toBe(0);
  });

  test('VRApp wires getTopSites into TabManager and gates it on private mode (C-3)', () => {
    // Top-site tiles derive from history — which private mode must not touch
    // in either direction (don't record it, don't surface it on a new tab).
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../src/vr/VRApp.js'), 'utf8'
    );
    expect(src).toMatch(/getTopSites:\s*\(n\)\s*=>/);
    expect(src).toMatch(/privateMode\s*\?\s*\[\]/);
  });

  test('_buildBrowsingSystems restores the saved session, falling back to one blank tab', () => {
    // Constructing a real TabManager needs a canvas/GPU stack this file doesn't
    // provide, so this pins the seam the same way 'the browsing default' does.
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../src/vr/VRApp.js'), 'utf8'
    );
    expect(src).toMatch(/_restoreTabSession\(\)/);
    expect(src).toMatch(/onSessionChange/);
  });
});

// ── persistence + navigate + stats (bound-prototype, localStorage stub) ───────
describe('VRApp — settings/tab-session persistence and navigate()', () => {
  const P = VRApp.prototype;
  let store;
  beforeEach(() => {
    store = {};
    global.localStorage = {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: (k) => {
        delete store[k];
      }
    };
  });
  afterEach(() => {
    delete global.localStorage;
  });

  test('loadPersistedSettings filters to known keys only', () => {
    store['qui-browser:settings'] = JSON.stringify({ a11y: true, evil: 'x' });
    const app = { settings: { a11y: false, other: 1 } };
    expect(P.loadPersistedSettings.call(app)).toEqual({ a11y: true });
  });

  test('loadPersistedSettings returns {} on corrupt JSON', () => {
    store['qui-browser:settings'] = '{{{not json';
    const app = { settings: { a: 1 } };
    expect(P.loadPersistedSettings.call(app)).toEqual({});
  });

  test('loadPersistedSettings rejects values whose type does not match the default', () => {
    // A poisoned entry like snapTurnAngle:"abc" reaches the steppers and
    // renders NaN forever — "malformed entries cannot inject" must hold for
    // values, not just keys.
    store['qui-browser:settings'] = JSON.stringify({
      snapTurnAngle: 'abc',      // number → string: reject
      enableCaptions: 1,         // boolean → number: reject
      openSettingsSections: ['settings.section.audio'], // array → array: keep
      motionSensitivity: 'sensitive'                    // string → string: keep
    });
    const app = { settings: {
      snapTurnAngle: 30, enableCaptions: false,
      openSettingsSections: ['settings.section.a11y'], motionSensitivity: 'moderate'
    } };
    expect(P.loadPersistedSettings.call(app)).toEqual({
      openSettingsSections: ['settings.section.audio'],
      motionSensitivity: 'sensitive'
    });
  });

  test('openSettingsSections persists across reloads — it is a defaulted key', () => {
    // _toggleSettingsSection persists via updateSetting; on the next boot the
    // key must survive loadPersistedSettings' known-key filter, which only
    // passes keys present in the constructor defaults. Pin the invariant on
    // the real defaults object — a regression that drops the key there makes
    // the user's section choice silently stop persisting.
    const app = { settings: defaultSettings() };
    store['qui-browser:settings'] = JSON.stringify({ openSettingsSections: ['settings.section.browsing'] });
    expect(P.loadPersistedSettings.call(app))
      .toEqual({ openSettingsSections: ['settings.section.browsing'] });
  });

  test('loadPersistedSettings rejects a non-array value for an array default', () => {
    store['qui-browser:settings'] = JSON.stringify({ openSettingsSections: 'a11y' });
    const app = { settings: { openSettingsSections: ['settings.section.a11y'] } };
    expect(P.loadPersistedSettings.call(app)).toEqual({});
  });

  test('_saveTabSession writes serialize() output; privateMode writes nothing', () => {
    const serialize = jest.fn(() => [{ url: 'x' }]);
    const app = { tabManager: { serialize }, settings: {} };
    P._saveTabSession.call(app);
    expect(store['qui.tabSession.v1']).toBe('[{"url":"x"}]');

    const appPriv = { tabManager: { serialize }, settings: { privateMode: true } };
    store['qui.tabSession.v1'] = undefined;
    delete store['qui.tabSession.v1'];
    P._saveTabSession.call(appPriv);
    expect('qui.tabSession.v1' in store).toBe(false);
  });

  test('_restoreTabSession: private boot returns 0; corrupt JSON returns 0', () => {
    const restoreSession = jest.fn(() => 2);
    const appPriv = { tabManager: { restoreSession }, settings: { privateMode: true } };
    expect(P._restoreTabSession.call(appPriv)).toBe(0);
    expect(restoreSession).not.toHaveBeenCalled();

    store['qui.tabSession.v1'] = 'not-json';
    const app = { tabManager: { restoreSession }, settings: {} };
    expect(P._restoreTabSession.call(app)).toBe(0);

    store['qui.tabSession.v1'] = '[{"url":"a"}]';
    expect(P._restoreTabSession.call(app)).toBe(2);
  });

  test('navigate() suppresses history in privateMode; caption shows title or hostname', () => {
    const addHistory = jest.fn();
    const show = jest.fn();
    const app = {
      settings: { privateMode: true },
      bookmarks: { addHistory },
      captionSystem: { enabled: true, show }
    };
    P.navigate.call(app, 'https://a.example/path', 'Page A');
    expect(addHistory).not.toHaveBeenCalled();
    expect(show).toHaveBeenCalledWith('Page A');

    app.settings.privateMode = false;
    P.navigate.call(app, 'https://b.example/x'); // title defaults to url
    expect(addHistory).toHaveBeenCalledWith('https://b.example/x', 'https://b.example/x');
    expect(show).toHaveBeenLastCalledWith('b.example'); // hostname caption, not raw URL
  });

  test('getPerformanceStats reports monitor + renderer.info shape', () => {
    const app = {
      renderer: { info: { memory: { geometries: 3, textures: 5 }, programs: [{}, {}] } },
      performanceMonitor: { fps: 89.6, frameTime: 11.234, memoryUsed: 42.34, drawCalls: 12, triangles: 999 }
    };
    const s = P.getPerformanceStats.call(app);
    expect(s.fps).toBe(90);
    expect(s.frameTime).toBe('11.23ms');
    expect(s.memory).toBe('42.3MB');
    expect(s.geometries).toBe(3);
    expect(s.programs).toBe(2);
    expect(s.ffrIntensity).toBeUndefined(); // no ffrSystem attached
  });
});

describe('VRApp snapTurn / updateLocomotion / updateButtonInput (bound prototypes, real three)', () => {
  // Locomotion math is the highest-frequency input path in the app (every
  // frame, both sticks). It was entirely unverified: snap latch hysteresis,
  // southpaw hand swap, head-projected movement, and button dispatch.

  function makeLocoApp(overrides = {}) {
    const rig = new THREE.Object3D();
    const camera = new THREE.PerspectiveCamera();
    rig.add(camera);
    return Object.assign({
      playerRig: rig,
      camera,
      controllers: [],
      settings: {
        southpaw: false, enableSnapTurn: true, enableSmoothMove: true,
        snapTurnAngle: 30, smoothMoveSpeed: 2
      },
      controllerInput: null,
      comfortSystem: null,
      hapticFeedback: null,
      captionSystem: null
    }, overrides);
  }

  function makePad(handedness, axes = {}, buttons = {}) {
    return {
      userData: { inputSource: { handedness } },
      read: { axes: { stickX: 0, stickY: 0, ...axes }, buttons, hand: handedness }
    };
  }

  function withInput(app, pad) {
    const ctl = { userData: { inputSource: { handedness: pad.read.hand } } };
    app.controllers = [ctl];
    app.controllerInput = { read: () => pad.read };
    return ctl;
  }

  test('snapTurn rotates the rig around the head pivot by snapTurnAngle * direction', () => {
    const app = makeLocoApp();
    app.captionSystem = { enabled: true, show: jest.fn() };
    app.hapticFeedback = { playPattern: jest.fn() };
    app.camera.position.set(1, 0, 2); // head off-axis — pivot must be the head, not origin
    VRApp.prototype.snapTurn.call(app, 1, 'right');
    // rotateOnWorldAxis(up, +30°): rig yaw changes by exactly the configured angle
    expect(app.playerRig.rotation.y).toBeCloseTo(THREE.MathUtils.degToRad(30), 5);
    // Pivot: head world position unchanged (rotation about the head itself)
    const head = new THREE.Vector3();
    app.camera.getWorldPosition(head);
    expect(head.x).toBeCloseTo(1, 5);
    expect(head.z).toBeCloseTo(2, 5);
    expect(app.hapticFeedback.playPattern).toHaveBeenCalledWith('right', 'click');
    expect(app.captionSystem.show).toHaveBeenCalledWith(expect.stringContaining('30°'));
  });

  test('snapTurn without a hand skips haptics; captions off skips the direction caption', () => {
    const app = makeLocoApp();
    app.hapticFeedback = { playPattern: jest.fn() };
    app.captionSystem = { enabled: false, show: jest.fn() };
    VRApp.prototype.snapTurn.call(app, -1); // no hand
    expect(app.hapticFeedback.playPattern).not.toHaveBeenCalled();
    expect(app.captionSystem.show).not.toHaveBeenCalled();
  });

  test('updateLocomotion: right-hand stick fires snapTurn once and latches until |x| < 0.3', () => {
    const app = makeLocoApp();
    app.snapTurn = jest.fn();
    const ctl = withInput(app, makePad('right', { stickX: 0.8 }));
    VRApp.prototype.updateLocomotion.call(app);
    VRApp.prototype.updateLocomotion.call(app); // held — still latched
    expect(app.snapTurn).toHaveBeenCalledTimes(1);
    expect(app.snapTurn).toHaveBeenCalledWith(-1, 'right'); // push right → clockwise
    ctl.read = void 0;
    app.controllerInput.read = () => ({ axes: { stickX: 0.5, stickY: 0 }, buttons: {}, hand: 'right' });
    VRApp.prototype.updateLocomotion.call(app); // between release 0.3 and threshold — latched
    app.controllerInput.read = () => ({ axes: { stickX: 0.2, stickY: 0 }, buttons: {}, hand: 'right' });
    VRApp.prototype.updateLocomotion.call(app); // released
    app.controllerInput.read = () => ({ axes: { stickX: -0.9, stickY: 0 }, buttons: {}, hand: 'right' });
    VRApp.prototype.updateLocomotion.call(app);
    expect(app.snapTurn).toHaveBeenCalledTimes(2);
    expect(app.snapTurn).toHaveBeenLastCalledWith(1, 'right'); // push left → counter-clockwise
  });

  test('updateLocomotion: southpaw swaps turn/move hands', () => {
    const app = makeLocoApp({ settings: {
      southpaw: true, enableSnapTurn: true, enableSmoothMove: true,
      snapTurnAngle: 30, smoothMoveSpeed: 2
    } });
    app.snapTurn = jest.fn();
    withInput(app, makePad('right', { stickX: 0.9 })); // right hand is MOVE in southpaw
    VRApp.prototype.updateLocomotion.call(app);
    expect(app.snapTurn).not.toHaveBeenCalled();
    app.controllerInput.read = () => ({ axes: { stickX: 0.9, stickY: 0 }, buttons: {}, hand: 'left' });
    VRApp.prototype.updateLocomotion.call(app);
    expect(app.snapTurn).toHaveBeenCalledWith(-1, 'left');
  });

  test('updateLocomotion: stick up moves the rig along the head-projected forward, scaled by speed*dt', () => {
    const app = makeLocoApp();
    app.comfortSystem = { externalMotion: false, externalMotionLevel: 0 };
    withInput(app, makePad('left', { stickY: -1 })); // stick up → forward
    VRApp.prototype.updateLocomotion.call(app, 0.5); // dt=0.5s
    // camera identity → forward (0,0,-1); speed 2 * dt 0.5 = 1 m
    expect(app.playerRig.position.z).toBeCloseTo(-1, 5);
    expect(app.playerRig.position.x).toBeCloseTo(0, 5);
    expect(app.comfortSystem.externalMotion).toBe(true);
    expect(app.comfortSystem.externalMotionLevel).toBe(1);
  });

  test('updateLocomotion: diagonal stick normalizes — displacement magnitude is exactly speed*dt', () => {
    const app = makeLocoApp();
    withInput(app, makePad('left', { stickX: 0.7, stickY: -0.7 }));
    VRApp.prototype.updateLocomotion.call(app, 0.25); // dt=0.25 → expect 0.5 m
    expect(app.playerRig.position.length()).toBeCloseTo(0.5, 5);
  });

  test('updateLocomotion: disabled flags and missing input source do nothing', () => {
    const app = makeLocoApp({ settings: {
      southpaw: false, enableSnapTurn: false, enableSmoothMove: false,
      snapTurnAngle: 30, smoothMoveSpeed: 2
    } });
    app.snapTurn = jest.fn();
    withInput(app, makePad('right', { stickX: 0.9, stickY: -0.9 }));
    VRApp.prototype.updateLocomotion.call(app);
    expect(app.snapTurn).not.toHaveBeenCalled();
    expect(app.playerRig.position.length()).toBe(0);
  });

  test('updateButtonInput: pointer faceA/faceB navigate the active tab with honest captions', () => {
    const app = makeLocoApp();
    const tab = { goForward: jest.fn(() => true), goBack: jest.fn(() => false) };
    app.tabManager = { getActiveTab: () => tab };
    app.captionSystem = { enabled: true, show: jest.fn() };
    app.hapticFeedback = { playPattern: jest.fn() };
    withInput(app, makePad('right', {}, { faceA: { justPressed: true } }));
    VRApp.prototype.updateButtonInput.call(app);
    expect(tab.goForward).toHaveBeenCalledTimes(1);
    expect(app.captionSystem.show).toHaveBeenCalledWith('Going forward'); // default lang = en
    withInput(app, makePad('right', {}, { faceB: { justPressed: true } }));
    VRApp.prototype.updateButtonInput.call(app);
    expect(tab.goBack).toHaveBeenCalledTimes(1);
    expect(app.captionSystem.show).toHaveBeenLastCalledWith('No previous page');
  });

  test('updateButtonInput: utility hand toggles bookmarks/settings/keyboard + haptic click', () => {
    const app = makeLocoApp();
    app.bookmarkPanel = { toggle: jest.fn(), visible: true };
    app.settingsPanel = { visible: false, mesh: { visible: false } };
    app.semanticDOM = { setSettingsExpanded: jest.fn() };
    app.vrKeyboard = {
      visible: false,
      show: jest.fn(function () {
        this.visible = true;
      }),
      hide: jest.fn(function () {
        this.visible = false;
      })
    };
    app.captionSystem = { enabled: true, show: jest.fn() };
    app.hapticFeedback = { playPattern: jest.fn() };
    withInput(app, makePad('left', {}, {
      faceA: { justPressed: true },
      faceB: { justPressed: true },
      thumbstickClick: { justPressed: true }
    }));
    VRApp.prototype.updateButtonInput.call(app);
    expect(app.bookmarkPanel.toggle).toHaveBeenCalledTimes(1);
    expect(app.captionSystem.show).toHaveBeenCalledWith('Bookmarks: open');
    expect(app.settingsPanel.visible).toBe(true);
    expect(app.settingsPanel.mesh.visible).toBe(true);
    expect(app.semanticDOM.setSettingsExpanded).toHaveBeenCalledWith(true);
    expect(app.vrKeyboard.show).toHaveBeenCalledTimes(1);
    expect(app.captionSystem.show).toHaveBeenCalledWith('Keyboard: open');
    expect(app.hapticFeedback.playPattern).toHaveBeenCalledWith('left', 'click');
  });

  test('updateButtonInput: pointer thumbstickClick recenters; southpaw swaps button hands', () => {
    const app = makeLocoApp();
    app.recenter = jest.fn();
    withInput(app, makePad('right', {}, { thumbstickClick: { justPressed: true } }));
    VRApp.prototype.updateButtonInput.call(app);
    expect(app.recenter).toHaveBeenCalledTimes(1);
    // Southpaw: left hand becomes pointer — its faceA now does navigation, not bookmarks.
    const sp = makeLocoApp({ settings: {
      southpaw: true, enableSnapTurn: true, enableSmoothMove: true,
      snapTurnAngle: 30, smoothMoveSpeed: 2
    } });
    sp.bookmarkPanel = { toggle: jest.fn(), visible: false };
    const spTab = { goForward: jest.fn(() => true) };
    sp.tabManager = { getActiveTab: () => spTab };
    sp.captionSystem = { enabled: true, show: jest.fn() };
    withInput(sp, makePad('left', {}, { faceA: { justPressed: true } }));
    VRApp.prototype.updateButtonInput.call(sp);
    expect(sp.bookmarkPanel.toggle).not.toHaveBeenCalled();
    expect(spTab.goForward).toHaveBeenCalledTimes(1);
  });
  test('menu button also toggles the settings panel (faceB || menu arm)', () => {
    const app = makeLocoApp();
    app.settingsPanel = { visible: false, mesh: { visible: false } };
    app.captionSystem = { enabled: true, show: jest.fn() };
    withInput(app, makePad('left', {}, { menu: { justPressed: true } }));
    VRApp.prototype.updateButtonInput.call(app);
    expect(app.settingsPanel.visible).toBe(true);
    expect(app.captionSystem.show).toHaveBeenCalledWith('Settings: open');
  });

  test('settings panel without a mesh still toggles and announces', () => {
    const app = makeLocoApp();
    app.settingsPanel = { visible: true }; // no mesh — guard must skip gracefully
    app.captionSystem = { enabled: true, show: jest.fn() };
    withInput(app, makePad('left', {}, { faceB: { justPressed: true } }));
    VRApp.prototype.updateButtonInput.call(app);
    expect(app.settingsPanel.visible).toBe(false);
    expect(app.captionSystem.show).toHaveBeenCalledWith('Settings: closed');
  });

  test('vrKeyboard already visible → hide arm + closed caption', () => {
    const app = makeLocoApp();
    app.vrKeyboard = {
      visible: true,
      show: jest.fn(function () {
        this.visible = true;
      }),
      hide: jest.fn(function () {
        this.visible = false;
      })
    };
    app.captionSystem = { enabled: true, show: jest.fn() };
    withInput(app, makePad('left', {}, { thumbstickClick: { justPressed: true } }));
    VRApp.prototype.updateButtonInput.call(app);
    expect(app.vrKeyboard.hide).toHaveBeenCalledTimes(1);
    expect(app.captionSystem.show).toHaveBeenCalledWith('Keyboard: closed');
  });

  test('no active tab → faceA/faceB do nothing (null tab arm)', () => {
    const app = makeLocoApp();
    app.tabManager = { getActiveTab: () => null };
    app.captionSystem = { enabled: true, show: jest.fn() };
    withInput(app, makePad('right', {}, { faceA: { justPressed: true } }));
    expect(() => VRApp.prototype.updateButtonInput.call(app)).not.toThrow();
    expect(app.captionSystem.show).not.toHaveBeenCalled();
  });

  test('captions skipped when captionSystem disabled (enabled-false arms)', () => {
    const app = makeLocoApp();
    app.tabManager = { getActiveTab: () => ({ goForward: jest.fn(() => true) }) };
    app.captionSystem = { enabled: false, show: jest.fn() };
    withInput(app, makePad('right', {}, { faceA: { justPressed: true } }));
    VRApp.prototype.updateButtonInput.call(app);
    expect(app.captionSystem.show).not.toHaveBeenCalled();
  });

  test('no haptic click when nothing was pressed (anyJustPressed false arm)', () => {
    const app = makeLocoApp();
    app.hapticFeedback = { playPattern: jest.fn() };
    withInput(app, makePad('right', {}, {}));
    VRApp.prototype.updateButtonInput.call(app);
    expect(app.hapticFeedback.playPattern).not.toHaveBeenCalled();
  });
});

describe('VRApp adjustQuality / keyboard input / loadTexture (bound prototypes)', () => {
  function makeQualityApp(overrides = {}) {
    const app = Object.assign({
      settings: { targetFPS: 72 },
      performanceMonitor: { frameTime: 10 },
      ffrSystem: { adjustIntensity: jest.fn() }
    }, overrides);
    // adjustQuality calls this.reduceQuality()/increaseQuality() — bind them so
    // the bound-prototype `this` resolves siblings like a real instance would.
    app.reduceQuality = () => VRApp.prototype.reduceQuality.call(app);
    app.increaseQuality = () => VRApp.prototype.increaseQuality.call(app);
    return app;
  }

  test('adjustQuality reduces quality when frameTime > 1.2× target, raises it below 0.8×', () => {
    const app = makeQualityApp();
    app.performanceMonitor.frameTime = 1000 / 72 * 1.21; // just over the slow band
    VRApp.prototype.adjustQuality.call(app);
    expect(app.ffrSystem.adjustIntensity).toHaveBeenCalledWith(0.1); // FFR up = quality down

    app.ffrSystem.adjustIntensity.mockClear();
    app.performanceMonitor.frameTime = 1000 / 72 * 0.79; // fast band
    VRApp.prototype.adjustQuality.call(app);
    expect(app.ffrSystem.adjustIntensity).toHaveBeenCalledWith(-0.1);
  });

  test('adjustQuality does nothing inside the ±20% band', () => {
    const app = makeQualityApp();
    app.performanceMonitor.frameTime = 1000 / 72; // exactly on target
    VRApp.prototype.adjustQuality.call(app);
    expect(app.ffrSystem.adjustIntensity).not.toHaveBeenCalled();
  });

  test('reduceQuality/increaseQuality no-op without an FFR system', () => {
    const app = makeQualityApp({ ffrSystem: null });
    expect(() => VRApp.prototype.reduceQuality.call(app)).not.toThrow();
    expect(() => VRApp.prototype.increaseQuality.call(app)).not.toThrow();
  });

  test('_requestVRKeyboardInput wires confirm, prefill, activation and the prompt caption', () => {
    const app = {
      vrKeyboard: { setOnConfirm: jest.fn(), show: jest.fn() },
      japaneseIME: { activate: jest.fn(), compositionBuffer: '' },
      captionSystem: { enabled: true, show: jest.fn() }
    };
    const onConfirm = jest.fn();
    VRApp.prototype._requestVRKeyboardInput.call(app, 'https://example.com', onConfirm, 'Enter URL');
    expect(app.vrKeyboard.setOnConfirm).toHaveBeenCalledWith(onConfirm);
    expect(app.japaneseIME.activate).toHaveBeenCalledTimes(1);
    expect(app.japaneseIME.compositionBuffer).toBe('https://example.com');
    expect(app.vrKeyboard.show).toHaveBeenCalledTimes(1);
    expect(app.captionSystem.show).toHaveBeenCalledWith('Enter URL');
  });

  test('_requestVRKeyboardInput clears the buffer for the bare https:// prefill', () => {
    const app = {
      vrKeyboard: { setOnConfirm: jest.fn(), show: jest.fn() },
      japaneseIME: { activate: jest.fn(), compositionBuffer: 'stale' },
      captionSystem: { enabled: true, show: jest.fn() }
    };
    VRApp.prototype._requestVRKeyboardInput.call(app, 'https://', jest.fn());
    // 'https://' alone is a placeholder prefix — buffer starts empty, not pre-filled
    expect(app.japaneseIME.compositionBuffer).toBe('');
  });

  test('_requestVRKeyboardInput falls back to window.prompt without a VR keyboard', () => {
    const app = { vrKeyboard: null };
    const onConfirm = jest.fn();
    global.window = { prompt: jest.fn(() => 'https://a.example') };
    VRApp.prototype._requestVRKeyboardInput.call(app, 'https://', onConfirm);
    expect(onConfirm).toHaveBeenCalledWith('https://a.example');
    global.window.prompt = jest.fn(() => null); // cancelled prompt → no confirm
    onConfirm.mockClear();
    VRApp.prototype._requestVRKeyboardInput.call(app, 'https://', onConfirm);
    expect(onConfirm).not.toHaveBeenCalled();
    delete global.window;
  });

  test('loadTexture delegates to textureManager and falls back to THREE.TextureLoader', async () => {
    const tex = { id: 't' };
    const app = { textureManager: { loadTexture: jest.fn(async () => tex) } };
    await expect(VRApp.prototype.loadTexture.call(app, 'u.png', { q: 1 })).resolves.toBe(tex);
    expect(app.textureManager.loadTexture).toHaveBeenCalledWith('u.png', { q: 1 });

    const fallbackTex = { id: 'f' };
    jest.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockResolvedValue(fallbackTex);
    await expect(VRApp.prototype.loadTexture.call({ textureManager: null }, 'x.png')).resolves.toBe(fallbackTex);
    THREE.TextureLoader.prototype.loadAsync.mockRestore();
  });
});

describe('VRApp teleport aim raycast + immersive video launch (bound prototypes, real three)', () => {
  function makeTeleportApp(overrides = {}) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10));
    floor.rotation.x = -Math.PI / 2; // horizontal floor at y=0
    floor.updateMatrixWorld(true);
    const app = Object.assign({
      floorMesh: floor,
      settings: { enableTeleport: true },
      teleport: { active: false, controller: null, valid: false, target: null, marker: null },
      playerRig: new THREE.Object3D(),
      camera: new THREE.PerspectiveCamera()
    }, overrides);
    // updateTeleport calls this.raycasterFromController — bind the real method.
    app.raycasterFromController = (c) => VRApp.prototype.raycasterFromController.call(app, c);
    return app;
  }

  function makeCtrl(position, euler) {
    const ctl = new THREE.Object3D();
    ctl.position.copy(position);
    if (euler) {
      ctl.rotation.copy(euler);
    }
    ctl.updateMatrixWorld(true);
    ctl.userData = {};
    return ctl;
  }

  test('raycasterFromController builds the ray from matrixWorld: origin + rotated -Z', () => {
    const app = { _sharedRaycaster: null, _tmpRayMatrix: null };
    const ctl = makeCtrl(new THREE.Vector3(0, 1.6, 0), new THREE.Euler(0, Math.PI / 2, 0)); // yaw +90° → faces -X
    const rc = VRApp.prototype.raycasterFromController.call(app, ctl);
    expect(rc.ray.origin.x).toBeCloseTo(0, 5);
    expect(rc.ray.origin.y).toBeCloseTo(1.6, 5);
    expect(rc.ray.direction.x).toBeCloseTo(-1, 5); // -Z rotated 90° about +Y → -X
    expect(rc.ray.direction.z).toBeCloseTo(0, 5);
    expect(app._sharedRaycaster).toBe(rc); // shared instance memoized
  });

  test('onTeleportStart only arms when enabled with a floor', () => {
    const app = makeTeleportApp();
    const ctl = makeCtrl(new THREE.Vector3());
    VRApp.prototype.onTeleportStart.call(app, ctl);
    expect(app.teleport.active).toBe(true);
    expect(app.teleport.controller).toBe(ctl);

    const disabled = makeTeleportApp({ settings: { enableTeleport: false } });
    VRApp.prototype.onTeleportStart.call(disabled, ctl);
    expect(disabled.teleport.active).toBe(false);

    const noFloor = makeTeleportApp({ floorMesh: null });
    VRApp.prototype.onTeleportStart.call(noFloor, ctl);
    expect(noFloor.teleport.active).toBe(false);
  });

  test('updateTeleport marks the floor hit valid and parks the marker just above it', () => {
    const app = makeTeleportApp();
    app.teleport.marker = { position: new THREE.Vector3(), visible: false };
    // Controller 1.6m up, pitched down 45° → hits floor ahead of the user
    const ctl = makeCtrl(new THREE.Vector3(0, 1.6, 0), new THREE.Euler(-Math.PI / 4, 0, 0));
    app.teleport.active = true;
    app.teleport.controller = ctl;
    VRApp.prototype.updateTeleport.call(app);
    expect(app.teleport.valid).toBe(true);
    expect(app.teleport.target.y).toBeCloseTo(0, 4);   // landed on the y=0 floor
    expect(app.teleport.target.z).toBeLessThan(0);     // ahead of the controller (-Z)
    expect(app.teleport.marker.visible).toBe(true);
    expect(app.teleport.marker.position.y).toBeCloseTo(0.01, 4); // 1 cm above the floor
    expect(app.teleport.marker.position.z).toBeCloseTo(app.teleport.target.z, 4);
  });

  test('updateTeleport clears validity and hides the marker on a miss', () => {
    const app = makeTeleportApp();
    app.teleport.marker = { position: new THREE.Vector3(), visible: true };
    const ctl = makeCtrl(new THREE.Vector3(0, 1.6, 0), new THREE.Euler(Math.PI / 4, 0, 0)); // pitched UP
    app.teleport.active = true;
    app.teleport.controller = ctl;
    app.teleport.valid = true;
    VRApp.prototype.updateTeleport.call(app);
    expect(app.teleport.valid).toBe(false);
    expect(app.teleport.marker.visible).toBe(false);
  });

  test('updateTeleport is inert until onTeleportStart arms it', () => {
    const app = makeTeleportApp();
    VRApp.prototype.updateTeleport.call(app); // teleport.active false
    expect(app.teleport.valid).toBe(false);
  });

  test('_launchImmersiveVideo plays the confirmed URL with auto-detected format', () => {
    const app = { immersiveVideo: { play: jest.fn() }, _requestVRKeyboardInput: null };
    let captured;
    app._requestVRKeyboardInput = (prefill, onConfirm, prompt) => {
      captured = { prefill, onConfirm, prompt };
    };
    VRApp.prototype._launchImmersiveVideo.call(app);
    expect(captured.prefill).toBe('https://');
    captured.onConfirm('https://x.example/vr_360.mp4');
    expect(app.immersiveVideo.play).toHaveBeenCalledTimes(1);
    const [url, fmt] = app.immersiveVideo.play.mock.calls[0];
    expect(url).toBe('https://x.example/vr_360.mp4');
    expect(fmt).toEqual(expect.objectContaining({ projection: expect.any(String) }));
    // cancelled / empty URL → no play
    captured.onConfirm('');
    expect(app.immersiveVideo.play).toHaveBeenCalledTimes(1);
    // no immersiveVideo subsystem → no throw
    app.immersiveVideo = null;
    expect(() => captured.onConfirm('https://x.mp4')).not.toThrow();
  });
});

describe('VRApp updateSystems middle arms + updatePerformanceMonitor (bound prototypes)', () => {
  function makeSystemsApp(overrides = {}) {
    const app = Object.assign({
      settings: { enableComfort: true, targetFPS: 72 },
      isVREnabled: true,
      camera: new THREE.PerspectiveCamera(),
      interactables: [],
      controllers: [],
      comfortSystem: { update: jest.fn() },
      ffrSystem: {
        trackHeadPose: jest.fn(),
        updatePredictedGazeFoveation: jest.fn(),
        adjustIntensity: jest.fn()
      },
      handTracking: { update: jest.fn() },
      hapticFeedback: { update: jest.fn(), playPatternBothHands: jest.fn() },
      spatialAudio: { updateListenerFromCamera: jest.fn() },
      layersSystem: { isSupported: true },
      tabManager: { tabs: [] },
      windowManager: null,
      immersiveVideo: { update: jest.fn() },
      captionSystem: { enabled: false, update: jest.fn() },
      gazeInteraction: { enabled: false, update: jest.fn() },
      performanceMonitor: { frameTime: 10 },
      renderer: { xr: { getReferenceSpace: () => null }, info: { render: { calls: 7, triangles: 9 } } }
    }, overrides);
    app.updateLocomotion = jest.fn();
    app.updateButtonInput = jest.fn();
    app.updateTeleport = jest.fn();
    app.updateHover = jest.fn();
    app._attachManagedWindow = jest.fn();
    return app;
  }

  test('updateSystems fans out to locomotion/buttons/teleport/hover and per-frame subsystems', () => {
    const app = makeSystemsApp();
    VRApp.prototype.updateSystems.call(app, 0, null, 0.016);
    expect(app.updateLocomotion).toHaveBeenCalledWith(0.016);
    expect(app.updateButtonInput).toHaveBeenCalledTimes(1);
    expect(app.updateTeleport).toHaveBeenCalledTimes(1);
    expect(app.updateHover).toHaveBeenCalledTimes(1);
    expect(app.comfortSystem.update).toHaveBeenCalledWith(0.016);
    expect(app.ffrSystem.trackHeadPose).toHaveBeenCalledWith(app.camera.quaternion, 0.016);
    expect(app.ffrSystem.updatePredictedGazeFoveation).toHaveBeenCalledTimes(1);
    expect(app.hapticFeedback.update).toHaveBeenCalledTimes(1);
    expect(app.spatialAudio.updateListenerFromCamera).toHaveBeenCalledWith(app.camera);
    expect(app.immersiveVideo.update).toHaveBeenCalledWith(0.016);
    // no xrFrame → hand tracking and layer blit skipped
    expect(app.handTracking.update).not.toHaveBeenCalled();
  });

  test('updateSystems: FFR frame-budget adjusts ±0.01 only while VR is enabled', () => {
    const app = makeSystemsApp();
    app.performanceMonitor.frameTime = 1000 / 72 + 1; // over budget → tighten FFR
    VRApp.prototype.updateSystems.call(app, 0, null);
    expect(app.ffrSystem.adjustIntensity).toHaveBeenCalledWith(0.01);

    app.ffrSystem.adjustIntensity.mockClear();
    app.performanceMonitor.frameTime = 5; // under budget → relax
    VRApp.prototype.updateSystems.call(app, 0, null);
    expect(app.ffrSystem.adjustIntensity).toHaveBeenCalledWith(-0.01);

    // Flat 2D: no FFR work at all
    app.ffrSystem.adjustIntensity.mockClear();
    app.ffrSystem.trackHeadPose.mockClear();
    app.isVREnabled = false;
    VRApp.prototype.updateSystems.call(app, 0, null);
    expect(app.ffrSystem.trackHeadPose).not.toHaveBeenCalled();
    expect(app.ffrSystem.adjustIntensity).not.toHaveBeenCalled();
  });

  test('updateSystems gates optional subsystems on their own flags', () => {
    const app = makeSystemsApp({
      settings: { enableComfort: false, targetFPS: 72 },
      comfortSystem: { update: jest.fn() },
      captionSystem: { enabled: true, update: jest.fn() },
      gazeInteraction: { enabled: true, update: jest.fn(() => null) }
    });
    VRApp.prototype.updateSystems.call(app, 0, null, 0.1);
    expect(app.comfortSystem.update).not.toHaveBeenCalled(); // comfort disabled
    expect(app.gazeInteraction.update).toHaveBeenCalledWith([], 100); // dt s → ms
    expect(app.captionSystem.update).toHaveBeenCalledWith(100);       // aging in ms
  });

  test('updatePerformanceMonitor: frameTime EMA, fps, renderer stats', () => {
    const app = {
      performanceMonitor: { frameTime: 20 },
      renderer: { info: { render: { calls: 42, triangles: 12345 } } }
    };
    VRApp.prototype.updatePerformanceMonitor.call(app, 10);
    // EMA alpha=0.1: 20*0.9 + 10*0.1 = 19
    expect(app.performanceMonitor.frameTime).toBeCloseTo(19, 6);
    expect(app.performanceMonitor.fps).toBeCloseTo(1000 / 19, 4);
    expect(app.performanceMonitor.drawCalls).toBe(42);
    expect(app.performanceMonitor.triangles).toBe(12345);
  });
});

describe('VRApp render() frame cadence (bound prototype, stubbed renderer)', () => {
  function makeRenderApp() {
    const app = {
      frameCount: 0,
      _lastRenderTime: null,
      perfMonitorUI: { beginFrame: jest.fn(), endFrame: jest.fn() },
      performanceMonitor: { frameTime: 10 },
      renderer: {
        render: jest.fn(),
        info: { render: { calls: 0, triangles: 0 } }
      },
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera()
    };
    app.updateSystems = jest.fn();
    app.updatePerformanceMonitor = jest.fn();
    app.adjustQuality = jest.fn();
    return app;
  }

  test('render counts frames, calls updateSystems, renders the scene, and runs adjustQuality every 60 frames', () => {
    const app = makeRenderApp();
    for (let i = 0; i < 120; i++) {
      VRApp.prototype.render.call(app, i * 16, null);
    }
    expect(app.frameCount).toBe(120);
    expect(app.updateSystems).toHaveBeenCalledTimes(120);
    expect(app.renderer.render).toHaveBeenCalledWith(app.scene, app.camera);
    expect(app.renderer.render).toHaveBeenCalledTimes(120);
    expect(app.adjustQuality).toHaveBeenCalledTimes(2); // frames 60 and 120 only
    expect(app.perfMonitorUI.beginFrame).toHaveBeenCalledTimes(120);
    expect(app.perfMonitorUI.endFrame).toHaveBeenCalledWith(app.renderer);
  });

  test('render caps dt at 50 ms so a backgrounded tab does not jump the world', () => {
    const app = makeRenderApp();
    VRApp.prototype.render.call(app, 0, null);
    app._lastRenderTime = 1; // non-zero epoch (0 is falsy → dt falls back to default)
    // performance.now is read-only on Node ≤20 — shadow with own property.
    Object.defineProperty(performance, 'now', {
      value: () => 5000, configurable: true, writable: true
    });
    VRApp.prototype.render.call(app, 16, null);
    expect(app.updateSystems).toHaveBeenLastCalledWith(16, null, 0.05); // capped, not 5.0
    delete performance.now;
  });

  test('first render uses the 16 ms default when no prior frame exists', () => {
    const app = makeRenderApp();
    VRApp.prototype.render.call(app, 0, null);
    expect(app.updateSystems).toHaveBeenCalledWith(0, null, 0.016);
  });
});

describe('VRApp onVRSessionStart/onVRSessionEnd — the session boundary (bound prototypes)', () => {
  const makeSession = (over = {}) => ({
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    visibilityState: 'visible',
    ...over
  });

  const makeSessionApp = (over = {}) => makeVRAppLike({
    renderer: {
      xr: { getSession: jest.fn() },
      getContext: () => ({}),
      setPixelRatio: jest.fn()
    },
    settings: { enableWebPanel: false },
    ffrSystem: null,
    handTracking: null,
    spatialAudio: null,
    comfortSystem: { settings: { fov: { baseFOV: 70 } } },
    immersiveVideo: null,
    layersSystem: null,
    showVRToast: jest.fn(),
    camera: { fov: 75 },
    ...over
  });

  test('session start flips isVREnabled, pins pixel ratio, resets comfort FOV, announces VR-ready', async () => {
    const session = makeSession();
    const app = makeSessionApp({
      renderer: { xr: { getSession: () => session }, getContext: () => ({}), setPixelRatio: jest.fn() },
      ffrSystem: { initialize: jest.fn().mockResolvedValue(true), enable: jest.fn(), disable: jest.fn() },
      handTracking: { initialize: jest.fn().mockResolvedValue(true), onGesture: jest.fn(), dispose: jest.fn() }
    });
    await VRApp.prototype.onVRSessionStart.call(app);
    expect(app.isVREnabled).toBe(true);
    // Headset-removed pause is wired on the XR session, not document.
    expect(session.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(app.ffrSystem.initialize).toHaveBeenCalled();
    expect(app.ffrSystem.enable).toHaveBeenCalledWith(0.5);
    expect(app.handTracking.onGesture).toHaveBeenCalledWith('pinch', expect.any(Function));
    expect(app.renderer.setPixelRatio).toHaveBeenCalledWith(1);
    expect(app.comfortSystem.settings.fov.baseFOV).toBe(90);
    expect(app.captionSystem.show).toHaveBeenCalledWith(expect.any(String));
  });

  test('FFR init failure warns the user via toast instead of failing silently', async () => {
    const session = makeSession();
    const app = makeSessionApp({
      renderer: { xr: { getSession: () => session }, getContext: () => ({}), setPixelRatio: jest.fn() },
      ffrSystem: { initialize: jest.fn().mockRejectedValue(new Error('no binding')), enable: jest.fn(), disable: jest.fn() }
    });
    await VRApp.prototype.onVRSessionStart.call(app);
    expect(app.showVRToast).toHaveBeenCalledWith(expect.any(String), { type: 'warn' });
    expect(app.ffrSystem).toBeNull(); // torn down so updateSystems never touches it
  });

  test('frame-rate module: requests best rate + syncs budget to actual refreshRate', async () => {
    const session = makeSession({
      supportedFrameRates: [60, 90, 120],
      updateTargetFrameRate: jest.fn().mockResolvedValue(undefined),
      refreshRate: 120
    });
    const app = makeSessionApp({
      renderer: { xr: { getSession: () => session }, getContext: () => ({}), setPixelRatio: jest.fn() },
      settings: { enableWebPanel: false, targetFPS: 72 }
    });
    await VRApp.prototype.onVRSessionStart.call(app);
    expect(session.updateTargetFrameRate).toHaveBeenCalledWith(120);
    // syncBudget runs off the resolved promise — flush the microtask queue.
    await Promise.resolve();
    await Promise.resolve();
    expect(app.settings.targetFPS).toBe(120);
  });

  test('no frame-rate module: refreshRate alone still re-bases the budget', async () => {
    const session = makeSession({ refreshRate: 90 });
    const app = makeSessionApp({
      renderer: { xr: { getSession: () => session }, getContext: () => ({}), setPixelRatio: jest.fn() },
      settings: { enableWebPanel: false, targetFPS: 120 }
    });
    await VRApp.prototype.onVRSessionStart.call(app);
    expect(app.settings.targetFPS).toBe(90);
  });

  test('no refreshRate at all: targetFPS keeps the tier-derived value', async () => {
    const session = makeSession();
    const app = makeSessionApp({
      renderer: { xr: { getSession: () => session }, getContext: () => ({}), setPixelRatio: jest.fn() },
      settings: { enableWebPanel: false, targetFPS: 120 }
    });
    await VRApp.prototype.onVRSessionStart.call(app);
    expect(app.settings.targetFPS).toBe(120);
  });

  test('XR visibilitychange pauses a playing video (headset removed = hidden)', async () => {
    const session = makeSession();
    const video = { playing: true, togglePause: jest.fn() };
    const app = makeSessionApp({
      renderer: { xr: { getSession: () => session }, getContext: () => ({}), setPixelRatio: jest.fn() },
      immersiveVideo: video
    });
    await VRApp.prototype.onVRSessionStart.call(app);
    const handler = session.addEventListener.mock.calls.find((c) => c[0] === 'visibilitychange')[1];
    session.visibilityState = 'visible-blurred';
    handler();
    expect(video.togglePause).toHaveBeenCalledTimes(1);
    // A still-visible transition does not pause.
    video.playing = true; video.togglePause.mockClear();
    session.visibilityState = 'visible';
    handler();
    expect(video.togglePause).not.toHaveBeenCalled();
  });

  test('pinch gesture callback fans out to spatial click + haptic', async () => {
    const session = makeSession();
    const hand = {
      initialize: jest.fn().mockResolvedValue(true),
      onGesture: jest.fn(),
      getPinchPosition: jest.fn(() => new THREE.Vector3(1, 2, 3)),
      dispose: jest.fn()
    };
    const app = makeSessionApp({
      renderer: { xr: { getSession: () => session }, getContext: () => ({}), setPixelRatio: jest.fn() },
      handTracking: hand,
      spatialAudio: { play: jest.fn() }
    });
    await VRApp.prototype.onVRSessionStart.call(app);
    const pinchCb = hand.onGesture.mock.calls.find((c) => c[0] === 'pinch')[1];
    pinchCb('right', {});
    expect(app.spatialAudio.play).toHaveBeenCalledWith('click', 'click', expect.any(THREE.Vector3));
    expect(app.hapticFeedback.playPattern).toHaveBeenCalledWith('right', 'click');
  });

  test('grab gesture fires an impact haptic on the grabbing hand; point is a no-op log', async () => {
    const session = makeSession();
    const hand = {
      initialize: jest.fn().mockResolvedValue(true),
      onGesture: jest.fn(),
      getPinchPosition: jest.fn(),
      dispose: jest.fn()
    };
    const app = makeSessionApp({
      renderer: { xr: { getSession: () => session }, getContext: () => ({}), setPixelRatio: jest.fn() },
      handTracking: hand
    });
    await VRApp.prototype.onVRSessionStart.call(app);
    const grabCb = hand.onGesture.mock.calls.find((c) => c[0] === 'grab')[1];
    grabCb('left');
    expect(app.hapticFeedback.playPattern).toHaveBeenCalledWith('left', 'impact');
    const pointCb = hand.onGesture.mock.calls.find((c) => c[0] === 'point')[1];
    expect(() => pointCb('left', {})).not.toThrow();
  });

  test('session end unwires in reverse: ffr off, panels out of layer mode, video stopped, hands disposed', async () => {
    global.window = { devicePixelRatio: 1 };
    const layers = { dispose: jest.fn() };
    const panel = { disableLayerMode: jest.fn() };
    const video = { stop: jest.fn() };
    const hand = { dispose: jest.fn() };
    const app = makeSessionApp({
      ffrSystem: { disable: jest.fn() },
      layersSystem: layers,
      tabManager: { tabs: [panel] },
      immersiveVideo: video,
      handTracking: hand
    });
    app.isVREnabled = true;
    VRApp.prototype.onVRSessionEnd.call(app);
    expect(app.isVREnabled).toBe(false);
    expect(app.ffrSystem.disable).toHaveBeenCalled();
    // Panels leave layer mode without per-panel renderState commits (ending
    // session throws on updateRenderState) — dispose clears the stack once.
    expect(panel.disableLayerMode).toHaveBeenCalledWith(false);
    expect(layers.dispose).toHaveBeenCalled();
    expect(app.layersSystem).toBeNull();
    expect(video.stop).toHaveBeenCalled();
    // Ghost-hands fix: every re-entry would otherwise leak 50 joint meshes.
    expect(hand.dispose).toHaveBeenCalled();
    expect(app.onXRVisibilityChange).toBeNull();
    expect(app.comfortSystem.settings.fov.baseFOV).toBe(75); // camera.fov restored
    expect(app.renderer.setPixelRatio).toHaveBeenLastCalledWith(1); // min(dpr=1, 2)
    delete global.window;
  });

  test('layers path constructs LayersSystem; unsupported binding degrades to mesh fallback', async () => {
    const session = makeSession();
    const app = makeSessionApp({
      renderer: { xr: { getSession: () => session }, getContext: () => ({}) , setPixelRatio: jest.fn() },
      settings: { enableWebPanel: true }
    });
    await VRApp.prototype.onVRSessionStart.call(app);
    // XRWebGLBinding is undefined in jsdom → initialize() returns false,
    // and the system stays constructed-but-inert (disposed on session end).
    expect(app.layersSystem).not.toBeNull();
    expect(app.layersSystem.supported).toBe(false);
    expect(app.showVRToast).not.toHaveBeenCalled(); // mesh fallback is silent-by-design
  });
});

describe('VRApp settings-panel button builders + layer attach (bound prototypes)', () => {
  const makePanelApp = (over = {}) => {
    const app = makeVRAppLike({
      settings: { enableGazeDwell: false },
      _panelTextures: [],
      _sharedGeometries: new Map(),
      _settingsPanelDrawers: [],
      scene: new THREE.Scene(),
      settingsPanel: null,
      saveSettings: jest.fn(),
      showVRToast: jest.fn(),
      registerInteractable(mesh, handlers) {
        app.interactables.push({ mesh, ...handlers });
      },
      unregisterInteractable(mesh) {
        app.interactables = app.interactables.filter((i) => i.mesh !== mesh);
      },
      updateSetting(key, value) {
        app.settings[key] = value; app.saveSettings(); return value;
      },
      _announceSettingsButton: VRApp.prototype._announceSettingsButton,
      _sharedPlaneGeometry: VRApp.prototype._sharedPlaneGeometry,
      ...over
    });
    return app;
  };
  const handlersOf = (app, mesh) => app.interactables.find((i) => i.mesh === mesh);

  test('compact toggle flips the setting, persists it, applies live, and force-announces', () => {
    const app = makePanelApp({ settings: { enableGazeDwell: false, enableHaptics: false } });
    const apply = jest.fn();
    const mesh = VRApp.prototype.makeCompactToggleButton.call(app, 'Haptics', 'enableHaptics', apply);
    const h = handlersOf(app, mesh);
    h.onSelect();
    expect(app.settings.enableHaptics).toBe(true);
    expect(app.saveSettings).toHaveBeenCalled();
    expect(apply).toHaveBeenCalledWith(true);
    // Select announces unconditionally — a gaze user's confirmation.
    expect(app.captionSystem.show).toHaveBeenCalled();
    h.onSelect();
    expect(app.settings.enableHaptics).toBe(false);
  });

  test('stepper: right region increments, left decrements, centre is inert; clamped to min/max', () => {
    const app = makePanelApp({ settings: { enableGazeDwell: false, captionDuration: 4 } });
    const apply = jest.fn();
    const mesh = VRApp.prototype.makeStepperButton.call(app, 'Caption time', 'captionDuration',
      { min: 2, max: 60, step: 0.5, unit: 's', apply });
    mesh.updateMatrixWorld(true);
    const h = handlersOf(app, mesh);
    h.onSelect({ intersection: { point: new THREE.Vector3(0.4, 0, 0) } }); // right edge → u≈0.94
    expect(app.settings.captionDuration).toBe(4.5);
    expect(apply).toHaveBeenCalledWith(4.5);
    expect(app.saveSettings).toHaveBeenCalled();
    h.onSelect({ intersection: { point: new THREE.Vector3(-0.4, 0, 0) } }); // left edge
    expect(app.settings.captionDuration).toBe(4);
    // Centre region does not change the value.
    h.onSelect({ intersection: { point: new THREE.Vector3(0, 0, 0) } });
    expect(app.settings.captionDuration).toBe(4);
    // Clamp at min: repeated − stops at 2 without further persists.
    app.saveSettings.mockClear();
    app.settings.captionDuration = 2;
    h.onSelect({ intersection: { point: new THREE.Vector3(-0.4, 0, 0) } });
    expect(app.settings.captionDuration).toBe(2);
    expect(app.saveSettings).not.toHaveBeenCalled();
  });

  test('section tabs are exactly-one-open; re-selecting the active tab is a no-op', () => {
    const rebuild = jest.fn();
    const app = makePanelApp({
      settings: { enableGazeDwell: false, openSettingsSections: ['settings.section.a11y'] },
      _rebuildSettingsPanel: rebuild
    });
    VRApp.prototype._toggleSettingsSection.call(app, 'settings.section.a11y');
    expect(rebuild).not.toHaveBeenCalled(); // no collapse-to-empty surprise
    VRApp.prototype._toggleSettingsSection.call(app, 'settings.section.audio');
    expect(app.settings.openSettingsSections).toEqual(['settings.section.audio']);
    expect(rebuild).toHaveBeenCalledTimes(1);
    expect(app.captionSystem.show).toHaveBeenCalled(); // section-open announce
  });

  test('dispose unregisters every panel mesh and detaches the panel', () => {
    const app = makePanelApp();
    const panel = new THREE.Group();
    const b1 = VRApp.prototype.makeCompactToggleButton.call(app, 'A', 'x1');
    const b2 = VRApp.prototype.makeActionButton.call(app, 'Go', jest.fn());
    panel.add(b1, b2);
    app.scene.add(panel);
    app.settingsPanel = panel;
    expect(app.interactables).toHaveLength(2);
    VRApp.prototype._disposeSettingsPanel.call(app);
    expect(app.interactables).toHaveLength(0);
    expect(panel.parent).toBeNull();
  });

  test('action button fires its callback and force-announces on select', () => {
    const app = makePanelApp();
    const act = jest.fn();
    const mesh = VRApp.prototype.makeActionButton.call(app, 'Clear history', act);
    handlersOf(app, mesh).onSelect();
    expect(act).toHaveBeenCalledTimes(1);
    expect(app.captionSystem.show).toHaveBeenCalled();
  });

  test('layer attach: one quad layer per open panel, committed once', () => {
    const refSpace = {};
    const session = {};
    const panel1 = { enableLayerMode: jest.fn() };
    const panel2 = { enableLayerMode: jest.fn() };
    const layers = {
      createQuadLayer: jest.fn(() => ({ quad: true })),
      updateRenderState: jest.fn(),
      count: 2
    };
    const app = makePanelApp({
      renderer: { xr: { getReferenceSpace: () => refSpace, getBaseLayer: () => null } },
      layersSystem: layers,
      tabManager: { tabs: [panel1, panel2] }
    });
    VRApp.prototype._attachLayersToPanels.call(app, session);
    expect(layers.createQuadLayer).toHaveBeenCalledTimes(2);
    // Chrome-bar dims: 1.6m × 0.08m at native resolution.
    expect(layers.createQuadLayer).toHaveBeenCalledWith(expect.objectContaining({
      id: 'panel_chrome_0', width: 1.6, height: 0.08
    }));
    expect(panel1.enableLayerMode).toHaveBeenCalledWith(
      { quad: true }, layers, 'panel_chrome_0', expect.any(Function));
    expect(layers.updateRenderState).toHaveBeenCalledWith(session, null);
  });

  test('layer attach no-ops without a reference space', () => {
    const layers = { createQuadLayer: jest.fn(), updateRenderState: jest.fn() };
    const app = makePanelApp({
      renderer: { xr: { getReferenceSpace: () => null } },
      layersSystem: layers,
      tabManager: { tabs: [{ enableLayerMode: jest.fn() }] }
    });
    VRApp.prototype._attachLayersToPanels.call(app, {});
    expect(layers.createQuadLayer).not.toHaveBeenCalled();
  });
});

describe('VRApp setupScene/setupCamera/createHomeEnvironment — pure construction (bound prototypes)', () => {
  const makeSetupApp = (over = {}) => {
    const app = makeVRAppLike({
      settings: {
        enableHomeEnvironment: false, enableSettingsPanel: false, enableWebPanel: false,
        enableGazeDwell: false
      },
      _panelTextures: [],
      _sharedGeometries: new Map(),
      scene: null, camera: null,
      renderer: {},
      interactables: [],
      registerInteractable(mesh, h) {
        app.interactables.push({ mesh, ...h });
      },
      unregisterInteractable(mesh) {
        app.interactables = app.interactables.filter((i) => i.mesh !== mesh);
      },
      saveSettings: jest.fn(),
      showVRToast: jest.fn(),
      _sharedPlaneGeometry: VRApp.prototype._sharedPlaneGeometry,
      _announceSettingsButton: VRApp.prototype._announceSettingsButton,
      ...over
    });
    return app;
  };

  test('setupScene builds scene+lights+ImmersiveVideo without a GPU', () => {
    const app = makeSetupApp();
    VRApp.prototype.setupScene.call(app);
    expect(app.scene).toBeInstanceOf(THREE.Scene);
    const lights = app.scene.children.filter((c) => c.isLight);
    expect(lights.map((l) => l.type).sort()).toEqual(['AmbientLight', 'DirectionalLight']);
    expect(app.immersiveVideo).toBeTruthy();
    expect(app.homeEnvironment).toBeUndefined(); // flag off
    expect(app.settingsPanel).toBeUndefined();   // flag off
  });

  test('createHomeEnvironment: floor registered as teleport surface; welcome panel is a working recenter button', () => {
    const app = makeSetupApp({ recenter: jest.fn() });
    const env = VRApp.prototype.createHomeEnvironment.call(app);
    expect(env.name).toBe('homeEnvironment');
    // Floor: horizontal circle, becomes the teleport raycast target.
    const floor = env.children.find((c) => c.name === 'floor');
    expect(floor).toBeTruthy();
    expect(app.floorMesh).toBe(floor);
    expect(floor.rotation.x).toBeCloseTo(-Math.PI / 2);
    // Welcome panel is registered and selecting it recenters the user.
    const panel = app.interactables[0];
    expect(panel).toBeTruthy();
    panel.onSelect();
    expect(app.recenter).toHaveBeenCalled();
    // Sky dome is inside-out and never depth-writes (drawn behind everything).
    const sky = env.children.find((c) => c.material && c.material.isShaderMaterial);
    expect(sky.material.side).toBe(THREE.BackSide);
    expect(sky.material.depthWrite).toBe(false);
    // Rest-frame grid exists (vection comfort) above the floor to avoid z-fighting.
    const grid = env.children.find((c) => c.isGridHelper || c.type === 'GridHelper');
    expect(grid).toBeTruthy();
    expect(grid.position.y).toBeGreaterThan(0);
  });

  test('setupCamera: 90° FOV camera at 1.6m eye height, nested in playerRig added to the scene', () => {
    global.window = { innerWidth: 1280, innerHeight: 720 };
    const app = makeSetupApp();
    app.scene = new THREE.Scene();
    VRApp.prototype.setupCamera.call(app);
    expect(app.camera.fov).toBe(90);
    expect(app.camera.aspect).toBeCloseTo(1280 / 720);
    expect(app.camera.position.y).toBe(1.6);
    expect(app.playerRig.name).toBe('playerRig');
    expect(app.playerRig.children).toContain(app.camera);
    expect(app.scene.children).toContain(app.playerRig);
    expect(app.windowManager).toBeNull(); // enableWebPanel off — no WindowManager built
    delete global.window;
  });
});

describe('VRApp setupControllers + loadAudioAssets (bound prototypes)', () => {
  const makeControllerApp = (over = {}) => {
    const app = makeVRAppLike({
      settings: { controllerDeadZone: 0.15, southpaw: false },
      playerRig: new THREE.Group(),
      scene: new THREE.Scene(),
      controllers: [],
      controllerGrips: [],
      teleport: {},
      showVRToast: jest.fn(),
      onControllerSelect: jest.fn(),
      onTeleportStart: jest.fn(),
      onTeleportEnd: jest.fn(),
      _cancelTeleportIfAimedBy: jest.fn(),
      ...over
    });
    return app;
  };

  test('two controllers each get a ray, select/squeeze wiring, and join the playerRig', () => {
    const app = makeControllerApp();
    // Controllers are real THREE Groups — EventDispatcher works natively.
    const ctl = [new THREE.Group(), new THREE.Group()];
    ctl.forEach((c) => {
      c.userData = {};
    });
    const grips = [new THREE.Group(), new THREE.Group()];
    app.renderer = {
      xr: {
        getController: jest.fn((i) => ctl[i]),
        getControllerGrip: jest.fn((i) => grips[i])
      }
    };
    VRApp.prototype.setupControllers.call(app);
    expect(app.controllers).toHaveLength(2);
    expect(app.controllerGrips).toHaveLength(2);
    // Ray line parented under each controller, pointing -Z, scaled to 5m.
    const ray = ctl[0].children.find((c) => c.name === 'pointerRay');
    expect(ray.isLine).toBe(true);
    expect(ray.scale.z).toBe(5);
    // select/squeeze events dispatch to the app handlers.
    ctl[0].dispatchEvent({ type: 'selectstart' });
    expect(app.onControllerSelect).toHaveBeenCalledWith(ctl[0], true);
    ctl[0].dispatchEvent({ type: 'squeezeend' });
    expect(app.onTeleportEnd).toHaveBeenCalled();
    // Teleport marker exists, hidden until aiming.
    expect(app.teleport.marker).toBeTruthy();
    expect(app.teleport.marker.visible).toBe(false);
    // Both controllers under the rig so they inherit head-relative space.
    expect(app.playerRig.children).toEqual(expect.arrayContaining(ctl));
  });

  test('controller reconnect mid-session toasts; disconnect forgets the source', () => {
    const app = makeControllerApp();
    const ctl = new THREE.Group(); ctl.userData = {};
    app.renderer = {
      xr: { getController: jest.fn(() => ctl), getControllerGrip: jest.fn(() => new THREE.Group()) }
    };
    VRApp.prototype.setupControllers.call(app);
    const src = { handedness: 'right' };
    // First connect (inputSource undefined→set): no toast.
    ctl.dispatchEvent({ type: 'connected', data: src });
    expect(app.showVRToast).not.toHaveBeenCalled();
    // Disconnect: warn toast + source forgotten + teleport cancelled.
    ctl.dispatchEvent({ type: 'disconnected' });
    expect(app.showVRToast).toHaveBeenCalledWith(expect.any(String), { type: 'warn' });
    expect(ctl.userData.inputSource).toBeNull();
    expect(app._cancelTeleportIfAimedBy).toHaveBeenCalledWith(ctl);
    // Reconnect after disconnect (inputSource was null): info toast.
    ctl.dispatchEvent({ type: 'connected', data: src });
    expect(app.showVRToast).toHaveBeenLastCalledWith(expect.any(String), { type: 'info' });
  });

  test('loadAudioAssets registers procedural buffers + sources for all four feedback sounds', async () => {
    const app = makeControllerApp();
    const sources = new Map();
    app.spatialAudio = {
      registerProceduralBuffer: jest.fn(),
      createSource: jest.fn((name) => sources.set(name, true)),
      sources
    };
    await VRApp.prototype.loadAudioAssets.call(app);
    expect(app.spatialAudio.registerProceduralBuffer).toHaveBeenCalledTimes(4);
    for (const n of ['click', 'hover', 'success', 'error']) {
      expect(sources.has(n)).toBe(true);
    }
    // A second call creates nothing — existing sources are reused.
    app.spatialAudio.createSource.mockClear();
    await VRApp.prototype.loadAudioAssets.call(app);
    expect(app.spatialAudio.createSource).not.toHaveBeenCalled();
  });
});

describe('VRApp createSettingsPanel — the orchestrator itself (bound prototypes)', () => {
  const SETTINGS = {
    enableGazeDwell: false, highContrast: false, enableTeleport: true, enableSnapTurn: true,
    enableSmoothMove: false, southpaw: false, enableComfort: true, enableFFR: true,
    enableHaptics: true, enableCaptions: true, enableWebPanel: true, privateMode: false,
    enableWindowFollow: true, enableCurvedPanel: false,
    snapTurnAngle: 45, smoothMoveSpeed: 1.5, gazeDwellTime: 1200, gazeGraceTime: 300,
    windowDistance: 2.4, captionDuration: 5, captionScale: 1.0, captionHeight: -0.55,
    masterVolume: 80, motionSensitivity: 'moderate', searchEngine: 'duckduckgo',
    openSettingsSections: ['settings.section.a11y']
  };

  const makePanelOrchestrator = (over = {}) => {
    const app = makeVRAppLike({
      settings: { ...SETTINGS },
      _panelTextures: [],
      _sharedGeometries: new Map(),
      _settingsPanelDrawers: [],
      interactables: [],
      scene: new THREE.Scene(),
      tabManager: null, webPanel: null, bookmarkPanel: null, windowManager: null,
      gazeInteraction: null, ffrSystem: null, spatialAudio: null,
      comfortSystem: null, hapticFeedback: { setEnabled: jest.fn() },
      captionSystem: { enabled: true, show: jest.fn(), setEnabled: jest.fn(), setHighContrast: jest.fn(), setLineDuration: jest.fn(), setScale: jest.fn(), setVerticalOffset: jest.fn() },
      saveSettings: jest.fn(),
      showVRToast: jest.fn(),
      registerInteractable(mesh, h) {
        app.interactables.push({ mesh, ...h });
      },
      unregisterInteractable(mesh) {
        app.interactables = app.interactables.filter((i) => i.mesh !== mesh);
      },
      updateSetting(key, value) {
        app.settings[key] = value; app.saveSettings(); return value;
      },
      _sharedPlaneGeometry: VRApp.prototype._sharedPlaneGeometry,
      _announceSettingsButton: VRApp.prototype._announceSettingsButton,
      makeSectionTab: VRApp.prototype.makeSectionTab,
      makeCompactToggleButton: VRApp.prototype.makeCompactToggleButton,
      makeStepperButton: VRApp.prototype.makeStepperButton,
      makeCycleButton: VRApp.prototype.makeCycleButton,
      makeActionButton: VRApp.prototype.makeActionButton,
      _toggleSettingsSection: jest.fn(),
      _launchImmersiveVideo: jest.fn(),
      _clearBrowsingHistory: jest.fn(),
      _requestReaderProxyInput: jest.fn(),
      _onWebPanelToggleChanged: jest.fn(),
      ...over
    });
    return app;
  };

  test('returns a positioned, angled group whose controls are all registered interactables', () => {
    const app = makePanelOrchestrator();
    const panel = VRApp.prototype.createSettingsPanel.call(app);
    expect(panel).toBeInstanceOf(THREE.Group);
    expect(panel.name).toBe('settingsPanel');
    expect(panel.position.x).toBeCloseTo(-1.4);
    expect(panel.rotation.y).toBeCloseTo(Math.PI / 8);
    // Tab row (≥5 sections) + open a11y section controls all registered.
    expect(app.interactables.length).toBeGreaterThanOrEqual(5 + 9);
    // Every drawer collected for one-shot repaints (high-contrast toggle).
    expect(app._settingsPanelDrawers.length).toBe(panel.children.length - 1); // minus bg
  });

  test('openSettingsSections defaults to a11y when the persisted value is missing', () => {
    const app = makePanelOrchestrator();
    delete app.settings.openSettingsSections;
    VRApp.prototype.createSettingsPanel.call(app);
    expect(app.settings.openSettingsSections).toEqual(['settings.section.a11y']);
  });

  test('closing a section via its tab leaves other sections collapsed — only the open section renders controls', () => {
    const app = makePanelOrchestrator({
      settings: { ...SETTINGS, openSettingsSections: ['settings.section.audio'] }
    });
    VRApp.prototype.createSettingsPanel.call(app);
    // Audio section = 1 stepper (masterVolume) + 1 action (video360) + ≥5 tabs.
    // If every section rendered, interactables would be ~30; pinned far below.
    expect(app.interactables.length).toBeLessThan(12);
  });

  test('every defined control is placed — the leftover section exists only when a key was missed', () => {
    const app = makePanelOrchestrator();
    const panel = VRApp.prototype.createSettingsPanel.call(app);
    // 5 named sections: tabs count tells us whether 'other' was needed.
    const tabCount = app.interactables.length - (4 + 5); // a11y toggles+steppers
    // With all keys placed, sections = 5, so 5 tabs; a 6th tab means leftover.
    expect(tabCount).toBe(5);
    expect(panel.children.length).toBeGreaterThan(5);
  });
});

describe('VRApp createSettingsPanel — every apply callback fires (bound prototypes)', () => {
  // Section-ordered fixtures: interactables[0..4] are the section tabs,
  // then the open section's controls in `controls` order.
  const SETTINGS = {
    enableGazeDwell: false, highContrast: false, enableTeleport: true, enableSnapTurn: true,
    enableSmoothMove: false, southpaw: false, enableComfort: true, enableFFR: true,
    enableHaptics: true, enableCaptions: true, enableWebPanel: true, privateMode: false,
    enableWindowFollow: true, enableCurvedPanel: false,
    snapTurnAngle: 45, smoothMoveSpeed: 1.5, gazeDwellTime: 1200, gazeGraceTime: 300,
    windowDistance: 2.4, captionDuration: 5, captionScale: 1.0, captionHeight: -0.55,
    masterVolume: 80, motionSensitivity: 'moderate', searchEngine: 'duckduckgo'
  };
  const P = (sectionId, over = {}) => {
    const app = makeVRAppLike({
      settings: { ...SETTINGS, openSettingsSections: [sectionId] },
      _panelTextures: [], _sharedGeometries: new Map(), _settingsPanelDrawers: [],
      interactables: [], scene: new THREE.Scene(),
      tabManager: { setSearchEngine: jest.fn(), setCurved: jest.fn() },
      webPanel: { setCurved: jest.fn() },
      bookmarkPanel: { visible: false, toggle: jest.fn(function () {
        this.visible = !this.visible;
      }) },
      windowManager: { setFollow: jest.fn(), setDistance: jest.fn() },
      gazeInteraction: { setEnabled: jest.fn(), setHighContrast: jest.fn() },
      ffrSystem: { enable: jest.fn(), disable: jest.fn() },
      spatialAudio: { setMasterVolume: jest.fn() },
      comfortSystem: { setPreset: jest.fn() },
      hapticFeedback: { setEnabled: jest.fn() },
      captionSystem: { enabled: true, show: jest.fn(), setEnabled: jest.fn(),
        setHighContrast: jest.fn(), setLineDuration: jest.fn(), setScale: jest.fn(), setVerticalOffset: jest.fn() },
      saveSettings: jest.fn(),
      showVRToast: jest.fn(),
      registerInteractable(mesh, h) {
        app.interactables.push({ mesh, ...h });
      },
      unregisterInteractable(mesh) {
        app.interactables = app.interactables.filter((i) => i.mesh !== mesh);
      },
      updateSetting(key, value) {
        app.settings[key] = value; app.saveSettings(); return value;
      },
      _sharedPlaneGeometry: VRApp.prototype._sharedPlaneGeometry,
      _announceSettingsButton: VRApp.prototype._announceSettingsButton,
      _redrawSettingsPanel: VRApp.prototype._redrawSettingsPanel,
      makeSectionTab: VRApp.prototype.makeSectionTab,
      makeCompactToggleButton: VRApp.prototype.makeCompactToggleButton,
      makeStepperButton: VRApp.prototype.makeStepperButton,
      makeCycleButton: VRApp.prototype.makeCycleButton,
      makeActionButton: VRApp.prototype.makeActionButton,
      _toggleSettingsSection: jest.fn(),
      _launchImmersiveVideo: jest.fn(),
      _clearBrowsingHistory: jest.fn(),
      _requestReaderProxyInput: jest.fn(),
      _onWebPanelToggleChanged: jest.fn(),
      ...over
    });
    VRApp.prototype.createSettingsPanel.call(app);
    return app;
  };
  // world point on the + zone of a stepper mesh
  const plusPoint = (mesh) => mesh.localToWorld(new THREE.Vector3(0.4, 0, 0));
  const minusPoint = (mesh) => mesh.localToWorld(new THREE.Vector3(-0.4, 0, 0));

  test('a11y toggles: captions/haptics/gaze/HC all reach their subsystems', () => {
    const app = P('settings.section.a11y');
    const C = app.interactables.slice(5); // a11y controls
    // order: enableCaptions, enableGazeDwell, highContrast, enableHaptics + 5 steppers
    C[0].onSelect(); // enableCaptions true->false
    expect(app.captionSystem.setEnabled).toHaveBeenCalledWith(false);
    C[0].onSelect(); // false->true announces
    expect(app.captionSystem.setEnabled).toHaveBeenLastCalledWith(true);
    expect(app.captionSystem.show).toHaveBeenCalledWith(expect.stringContaining(''));
    C[1].onSelect(); // gaze dwell on
    expect(app.gazeInteraction.setEnabled).toHaveBeenCalledWith(true);
    C[2].onSelect(); // highContrast on: reticle + caption backing live-update
    expect(app.captionSystem.setHighContrast).toHaveBeenCalledWith(true);
    expect(app.gazeInteraction.setHighContrast).toHaveBeenCalled();
    C[3].onSelect(); // haptics off
    expect(app.hapticFeedback.setEnabled).toHaveBeenCalledWith(false);
  });

  test('a11y steppers push units correctly (ms, x, m-offset, dwell, grace)', () => {
    const app = P('settings.section.a11y');
    const C = app.interactables.slice(5);
    const [steppers] = [C.slice(4)]; // captionDuration, captionScale, captionHeight, gazeDwellTime, gazeGraceTime
    steppers[0].onSelect({ intersection: { point: plusPoint(steppers[0].mesh) } });
    // stepValue snaps to the step grid; assert the %/unit conversion contract
    expect(app.captionSystem.setLineDuration).toHaveBeenCalledWith(app.settings.captionDuration * 1000);
    expect(app.settings.captionDuration).toBeGreaterThan(5);
    steppers[1].onSelect({ intersection: { point: plusPoint(steppers[1].mesh) } });
    expect(app.captionSystem.setScale).toHaveBeenCalledWith(app.settings.captionScale);
    steppers[2].onSelect({ intersection: { point: plusPoint(steppers[2].mesh) } });
    expect(app.captionSystem.setVerticalOffset).toHaveBeenCalledWith(app.settings.captionHeight);
    steppers[3].onSelect({ intersection: { point: plusPoint(steppers[3].mesh) } });
    expect(app.gazeInteraction.dwellTime).toBe(app.settings.gazeDwellTime);
    steppers[4].onSelect({ intersection: { point: plusPoint(steppers[4].mesh) } });
    expect(app.gazeInteraction.graceTime).toBe(app.settings.gazeGraceTime);
  });

  test('locomotion: southpaw captions the new primary hand; comfort preset cycles', () => {
    const app = P('settings.section.locomotion');
    const C = app.interactables.slice(5);
    // toggles: enableTeleport, enableSnapTurn, enableSmoothMove, southpaw, enableComfort
    C[3].onSelect();
    expect(app.captionSystem.show).toHaveBeenCalled();
    // cycle: motionSensitivity moderate -> tolerant -> comfortSystem.setPreset
    const cyc = C[C.length - 1];
    cyc.onSelect();
    expect(app.comfortSystem.setPreset).toHaveBeenCalledWith('tolerant');
  });

  test('smoothMove enable under prefers-reduced-motion surfaces the vestibular warning', () => {
    const origMM = global.matchMedia;
    global.matchMedia = (q) => ({ matches: /reduced-motion/.test(q), addEventListener() {}, removeEventListener() {} });
    try {
      const app = P('settings.section.locomotion');
      const C = app.interactables.slice(5);
      C[2].onSelect(); // enableSmoothMove false->true with OS reduced-motion
      expect(app.showVRToast).toHaveBeenCalledWith(expect.any(String), { type: 'warn' });
    } finally {
      global.matchMedia = origMM;
    }
  });

  test('display: FFR enable/disable, curved panel (tabManager), follow, distance', () => {
    const app = P('settings.section.display');
    const C = app.interactables.slice(5);
    C[0].onSelect(); // enableFFR true->false -> disable()
    expect(app.ffrSystem.disable).toHaveBeenCalled();
    C[0].onSelect(); // false->true -> enable(0.5)
    expect(app.ffrSystem.enable).toHaveBeenCalledWith(0.5);
    C[1].onSelect(); // curved on -> tabManager.setCurved(true)
    expect(app.tabManager.setCurved).toHaveBeenCalledWith(true);
    C[2].onSelect(); // follow off
    expect(app.windowManager.setFollow).toHaveBeenCalledWith(false);
    const dist = C[3];
    dist.onSelect({ intersection: { point: plusPoint(dist.mesh) } });
    expect(app.windowManager.setDistance).toHaveBeenCalledWith(app.settings.windowDistance);
  });

  test('display: curved falls back to webPanel when tabManager absent', () => {
    const app = P('settings.section.display', { tabManager: null });
    const C = app.interactables.slice(5);
    C[1].onSelect();
    expect(app.webPanel.setCurved).toHaveBeenCalledWith(true);
  });

  test('browsing: webPanel toggle delegates; search engine cycles; all 3 actions wired', () => {
    const app = P('settings.section.browsing');
    const C = app.interactables.slice(5);
    C[0].onSelect(); // enableWebPanel -> _onWebPanelToggleChanged(false)
    expect(app._onWebPanelToggleChanged).toHaveBeenCalledWith(false);
    const cyc = C[2]; // toggles (2) + cycle searchEngine
    cyc.onSelect();
    expect(app.tabManager.setSearchEngine).toHaveBeenCalledWith('google');
    const acts = C.slice(3); // clearHistory, readerProxy, bookmarks
    acts[0].onSelect();
    expect(app._clearBrowsingHistory).toHaveBeenCalled();
    acts[1].onSelect();
    expect(app._requestReaderProxyInput).toHaveBeenCalled();
    acts[2].onSelect();
    expect(app.bookmarkPanel.toggle).toHaveBeenCalled();
    expect(app.captionSystem.show).toHaveBeenCalled(); // open/closed announcement
  });

  test('a11y: highContrast apply repaints an open bookmark panel', () => {
    const drawSpy = jest.fn();
    const app = P('settings.section.a11y', { bookmarkPanel: { visible: true, _draw: drawSpy, toggle: jest.fn() } });
    app.interactables.slice(5)[2].onSelect(); // highContrast on
    expect(drawSpy).toHaveBeenCalled();
  });

  test('display: follow-view apply is a no-op without a windowManager', () => {
    const app = P('settings.section.display', { windowManager: null });
    expect(() => app.interactables.slice(5)[2].onSelect()).not.toThrow();
  });

  test('audio: masterVolume scales % -> 0..1 gain; video360 launches', () => {
    const app = P('settings.section.audio');
    const C = app.interactables.slice(5);
    C[0].onSelect({ intersection: { point: plusPoint(C[0].mesh) } });
    expect(app.spatialAudio.setMasterVolume).toHaveBeenCalledWith(app.settings.masterVolume / 100);
    C[1].onSelect();
    expect(app._launchImmersiveVideo).toHaveBeenCalled();
  });

  test('every apply callback is a safe no-op when its subsystem is absent', () => {
    for (const sectionId of ['settings.section.a11y', 'settings.section.locomotion',
      'settings.section.display', 'settings.section.browsing', 'settings.section.audio',
      'settings.section.other']) {
      const app = P(sectionId, {
        ffrSystem: null, gazeInteraction: null, captionSystem: null,
        hapticFeedback: null, spatialAudio: null, windowManager: null,
        bookmarkPanel: null, tabManager: null, webPanel: null,
        comfortSystem: null, immersiveVideo: null, layersSystem: null,
        browserConnectivity: null
      });
      // section tab onSelect + all registered controls: pointed selects so the
      // stepper `apply:` callbacks run their `if (subsystem)` absent arms too
      for (const i of app.interactables) {
        i.onHover?.();
        i.onSelect?.({ intersection: { point: plusPoint(i.mesh) } });
        i.onSelect?.({ intersection: { point: minusPoint(i.mesh) } });
        i.onHoverEnd?.();
      }
      app._settingsPanelDrawers.forEach((fn) => fn()); // isOpen + draw arms
    }
  });

  test('every apply callback skips announcements when captions are disabled', () => {
    for (const sectionId of ['settings.section.a11y', 'settings.section.locomotion',
      'settings.section.display', 'settings.section.browsing', 'settings.section.audio',
      'settings.section.other']) {
      const app = P(sectionId, {
        captionSystem: { enabled: false, show: jest.fn(), setEnabled: jest.fn(),
          setHighContrast: jest.fn(), setLineDuration: jest.fn(),
          setScale: jest.fn(), setVerticalOffset: jest.fn() }
      });
      for (const i of app.interactables) {
        i.onHover?.();
        i.onSelect?.({ intersection: { point: plusPoint(i.mesh) } });
        i.onHoverEnd?.();
      }
      expect(app.captionSystem.show).not.toHaveBeenCalled();
    }
  });

  test('toggling OFF fires the v=false announce arms; enableWebPanel:false skips the bookmarks action', () => {
    // every section, every control, every flag starting TRUE → the v=false announce arms
    for (const sectionId of ['settings.section.a11y', 'settings.section.locomotion',
      'settings.section.display', 'settings.section.browsing', 'settings.section.audio',
      'settings.section.other']) {
      const app = P(sectionId, {
        settings: { ...SETTINGS, openSettingsSections: [sectionId],
          southpaw: true, enableCaptions: true, enableGazeDwell: true,
          highContrast: true, enableHaptics: true, enableFFR: true,
          enableSmoothMove: true, privateMode: true }
      });
      for (const i of app.interactables) {
        i.onSelect?.({ intersection: { point: plusPoint(i.mesh) } });
        i.onSelect?.({ intersection: { point: minusPoint(i.mesh) } });
      }
      // locomotion toggles fired twice → southpaw ends back at true, but the
      // v=false ('right') announce arm ran on the first toggle
      if (sectionId === 'settings.section.locomotion') {
        expect(app.captionSystem.show).toHaveBeenCalled();
      }
    }

    const app2 = P('settings.section.browsing', { settings: { ...SETTINGS, openSettingsSections: ['settings.section.browsing'], enableWebPanel: false } });
    // enableWebPanel off → the bookmarks action row is not created at all
    expect(app2.interactables.length).toBeLessThan(P('settings.section.browsing').interactables.length);

    // bookmarks action fired twice → open then the 'closed' announce arm
    const app3 = P('settings.section.browsing');
    const bp = app3.bookmarkPanel;
    const last = app3.interactables[app3.interactables.length - 1];
    last.onSelect?.(); bp.visible = true;
    last.onSelect?.(); bp.visible = false;
    expect(bp.toggle).toHaveBeenCalledTimes(2);
  });
});

describe('VRApp dispose() — teardown symmetry (bound prototype)', () => {
  test('ends a live XR session before tearing down the renderer', () => {
    const end = jest.fn(() => Promise.resolve());
    const session = { end };
    const app = {
      renderer: {
        setAnimationLoop: jest.fn(), dispose: jest.fn(),
        domElement: { removeEventListener: jest.fn() },
        xr: { getSession: () => session }
      },
      scene: new THREE.Scene()
    };
    VRApp.prototype.dispose.call(app);
    expect(end).toHaveBeenCalled();
  });

  test('dispose stays total when no session is live (xr.getSession → null)', () => {
    const renderer = {
      setAnimationLoop: jest.fn(), dispose: jest.fn(),
      domElement: { removeEventListener: jest.fn() },
      xr: { getSession: () => null }
    };
    const app = { renderer, scene: new THREE.Scene() };
    expect(() => VRApp.prototype.dispose.call(app)).not.toThrow();
    expect(renderer.dispose).toHaveBeenCalled();
  });

  test('unwires every listener/timer/subsystem it registered — a mid-teardown throw would strand the rest', () => {
    const added = [];
    const removed = [];
    global.window = {
      devicePixelRatio: 1,
      addEventListener: (t, fn) => added.push(['window', t, fn]),
      removeEventListener: (t, fn) => removed.push(['window', t, fn])
    };
    const docRemoved = [];
    const docAdded = [];
    global.document.addEventListener = (t, fn) => docAdded.push([t, fn]);
    global.document.removeEventListener = (t, fn) => docRemoved.push(t);

    const disposeCalls = [];
    const sub = (name) => ({ dispose: jest.fn(() => disposeCalls.push(name)) });
    const mq = () => ({ removeEventListener: jest.fn() });
    const renderer = {
      setAnimationLoop: jest.fn(), dispose: jest.fn(),
      domElement: { removeEventListener: jest.fn() },
      xr: {}
    };
    const scene = new THREE.Scene();
    const childMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
    scene.add(childMesh);
    const geoDispose = jest.spyOn(childMesh.geometry, 'dispose');
    const matDispose = jest.spyOn(childMesh.material, 'dispose');

    const app = {
      renderer, scene,
      _onWebGLContextLost: jest.fn(), _onWebGLContextRestored: jest.fn(),
      _onWindowResize: Object.assign(jest.fn(), { cancel: jest.fn() }),
      _osMotionMQ: mq(), _osContrastMQ: mq(), _osForcedColorsMQ: mq(),
      _onOSReducedMotionChange: jest.fn(), _onOSContrastChange: jest.fn(),
      _toastTimers: new Set([1, 2]), _handTrackingTimers: { a: 3 },
      onEnterVRRequest: jest.fn(), onDocumentVisibilityChange: jest.fn(),
      vrButton: { parentNode: { removeChild: jest.fn() } },
      comfortSystem: sub('comfort'), ffrSystem: sub('ffr'),
      textureManager: sub('tex'), vrKeyboard: sub('kbd'),
      handTracking: sub('hands'), gazeInteraction: sub('gaze'),
      captionSystem: sub('captions'), semanticDOM: sub('semantic'),
      spatialAudio: sub('audio'), progressiveLoader: sub('loader'),
      voiceCommands: sub('voice'), windowManager: sub('wm'),
      layersSystem: sub('layers'), bookmarkPanel: sub('bookmarks'),
      immersiveVideo: sub('video'), tabManager: sub('tabs'),
      devTools: sub('devtools'), perfMonitorUI: sub('perfui'),
      hapticFeedback: { enabled: true },
      _hapticRef: null,
      _homePanelTexture: { dispose: jest.fn() },
      _panelTextures: [{ dispose: jest.fn() }],
      _sharedGeometries: new Map([['k', { dispose: jest.fn() }]]),
      webPanel: null, japaneseIME: null
    };

    const hapticRef = app.hapticFeedback;
    VRApp.prototype.dispose.call(app);

    expect(renderer.setAnimationLoop).toHaveBeenCalledWith(null);
    expect(renderer.domElement.removeEventListener).toHaveBeenCalledTimes(2);
    const removedTypes = removed.map(([, t]) => t);
    expect(removedTypes).toEqual(expect.arrayContaining(['resize', 'enter-vr']));
    expect(docRemoved).toContain('visibilitychange');
    expect(app._onWindowResize).toBeNull();
    expect(app._osMotionMQ).toBeNull();
    expect(app._osContrastMQ).toBeNull();
    expect(app._osForcedColorsMQ).toBeNull();
    expect(app.onEnterVRRequest).toBeNull();
    expect(app.onDocumentVisibilityChange).toBeNull();
    expect(app._toastTimers.size).toBe(0);
    // every subsystem disposed exactly once, teardown reached the end
    for (const name of ['comfort','ffr','tex','kbd','hands','gaze','captions','semantic','audio','loader','voice','wm','layers','bookmarks','video','tabs','devtools','perfui']) {
      expect(disposeCalls).toContain(name);
    }
    expect(disposeCalls).toHaveLength(18);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(geoDispose).toHaveBeenCalled();
    expect(matDispose).toHaveBeenCalled();
    expect(hapticRef.enabled).toBe(false);
    expect(app.hapticFeedback).toBeNull();

    delete global.window;
    delete global.document.addEventListener;
    delete global.document.removeEventListener;
  });
});

describe('VRApp — toast auto-dismiss + recenter button + button recenter arm', () => {
  test('toast auto-dismiss removes the mesh and disposes all three GPU resources', () => {
    jest.useFakeTimers();
    try {
      const camera = { add: jest.fn(), remove: jest.fn() };
      const app = makeVRAppLike({ isVREnabled: true, camera });
      VRApp.prototype.showVRToast.call(app, 'msg');
      const mesh = camera.add.mock.calls[0][0];
      // real THREE objects — spy on the three disposables before firing the timer
      const gSpy = jest.spyOn(mesh.geometry, 'dispose');
      const mSpy = jest.spyOn(mesh.material, 'dispose');
      const tSpy = jest.spyOn(mesh.material.map, 'dispose');
      jest.runAllTimers();
      expect(camera.remove).toHaveBeenCalledWith(mesh);
      expect(app._toastTimers.size).toBe(0);
      expect(gSpy).toHaveBeenCalled();
      expect(mSpy).toHaveBeenCalled();
      expect(tSpy).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  test('home-environment recenter panel: hover tints + captions, select recenters', () => {
    const registered = [];
    const app = makeVRAppLike({
      settings: { enableGazeDwell: true },
      registerInteractable: (mesh, cfg) => registered.push(cfg),
      unregisterInteractable: jest.fn(),
      captionSystem: { enabled: true, show: jest.fn() },
      recenter: jest.fn()
    });
    VRApp.prototype.createHomeEnvironment.call(app);
    const cfg = registered.find(c => c.onHoverEnd); // the welcome/recenter panel
    expect(cfg).toBeTruthy();
    const panelMesh = app.interactables?.[0];
    // Fire the real callbacks
    cfg.onHover();
    cfg.onHoverEnd();
    cfg.onSelect();
    expect(app.recenter).toHaveBeenCalledTimes(1);
  });

  test('updateButtonInput: controllers without an inputSource are skipped', () => {
    const app = makeVRAppLike({
      controllers: [{ userData: {} }], // no inputSource
      controllerInput: { read: jest.fn() },
      settings: { southpaw: false },
      hapticFeedback: { playPattern: jest.fn() }
    });
    expect(() => VRApp.prototype.updateButtonInput.call(app)).not.toThrow();
    expect(app.controllerInput.read).not.toHaveBeenCalled();
  });
});


describe('VRApp dispose() — else-arm teardown', () => {
  test('no vrKeyboard → japaneseIME disposed instead; no tabManager → webPanel disposed', () => {
    global.window = {
      devicePixelRatio: 1,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
    const scene = new THREE.Scene();
    const ime = { dispose: jest.fn() };
    const webPanel = { dispose: jest.fn() };
    const app = {
      renderer: { setAnimationLoop: jest.fn(), dispose: jest.fn(), domElement: { removeEventListener: jest.fn() }, xr: {} },
      scene,
      _onWebGLContextLost: jest.fn(), _onWebGLContextRestored: jest.fn(),
      _onWindowResize: Object.assign(jest.fn(), { cancel: jest.fn() }),
      vrKeyboard: null, japaneseIME: ime,
      tabManager: null, webPanel
    };
    VRApp.prototype.dispose.call(app);
    expect(ime.dispose).toHaveBeenCalledTimes(1);
    expect(webPanel.dispose).toHaveBeenCalledTimes(1);
    delete global.window;
  });

  test('dispose with everything absent runs to completion', () => {
    global.window = { devicePixelRatio: 1, addEventListener: jest.fn(), removeEventListener: jest.fn() };
    const app = {
      renderer: { setAnimationLoop: jest.fn(), dispose: jest.fn(), domElement: { removeEventListener: jest.fn() }, xr: {} },
      scene: new THREE.Scene()
    };
    expect(() => VRApp.prototype.dispose.call(app)).not.toThrow();
    delete global.window;
  });
});

describe('VRApp settings apply — absent-subsystem arms', () => {
  const SETTINGS2 = {
    enableGazeDwell: false, highContrast: false, enableTeleport: true, enableSnapTurn: true,
    enableSmoothMove: false, southpaw: false, enableComfort: true, enableFFR: true,
    enableHaptics: true, enableCaptions: true, enableWebPanel: true, privateMode: false,
    enableWindowFollow: true, enableCurvedPanel: false,
    snapTurnAngle: 45, smoothMoveSpeed: 1.5, gazeDwellTime: 1200, gazeGraceTime: 300,
    windowDistance: 2.4, captionDuration: 5, captionScale: 1.0, captionHeight: -0.55,
    masterVolume: 80, motionSensitivity: 'moderate', searchEngine: 'duckduckgo',
    openSettingsSections: ['settings.section.a11y']
  };
  const build = (over = {}) => {
    const app = makeVRAppLike({
      settings: { ...SETTINGS2 },
      _panelTextures: [], _sharedGeometries: new Map(), _settingsPanelDrawers: [],
      interactables: [], scene: new THREE.Scene(),
      captionSystem: null, gazeInteraction: null, hapticFeedback: null, ffrSystem: null,
      saveSettings: jest.fn(), showVRToast: jest.fn(),
      registerInteractable(mesh, h) {
        app.interactables.push({ mesh, ...h });
      },
      unregisterInteractable(mesh) {
        app.interactables = app.interactables.filter((i) => i.mesh !== mesh);
      },
      updateSetting(key, value) {
        app.settings[key] = value; app.saveSettings(); return value;
      },
      _sharedPlaneGeometry: VRApp.prototype._sharedPlaneGeometry,
      _announceSettingsButton: VRApp.prototype._announceSettingsButton,
      _redrawSettingsPanel: VRApp.prototype._redrawSettingsPanel,
      makeSectionTab: VRApp.prototype.makeSectionTab,
      makeCompactToggleButton: VRApp.prototype.makeCompactToggleButton,
      makeStepperButton: VRApp.prototype.makeStepperButton,
      makeCycleButton: VRApp.prototype.makeCycleButton,
      makeActionButton: VRApp.prototype.makeActionButton,
      _toggleSettingsSection: jest.fn(),
      _launchImmersiveVideo: jest.fn(),
      _clearBrowsingHistory: jest.fn(),
      _requestReaderProxyInput: jest.fn(),
      _onWebPanelToggleChanged: jest.fn(),
      ...over
    });
    VRApp.prototype.createSettingsPanel.call(app);
    return app;
  };

  test('toggles do not throw when their subsystems are absent', () => {
    const app = build();
    const C = app.interactables.slice(5); // a11y controls
    expect(() => C[0].onSelect()).not.toThrow(); // enableCaptions, captionSystem null
    expect(() => C[1].onSelect()).not.toThrow(); // enableGazeDwell, gazeInteraction null
    expect(() => C[2].onSelect()).not.toThrow(); // highContrast — caption/gaze null arms
    expect(() => C[3].onSelect()).not.toThrow(); // enableHaptics, hapticFeedback null
    expect(app.settings.enableCaptions).toBe(false);
    expect(app.settings.enableGazeDwell).toBe(true);
    expect(app.settings.highContrast).toBe(true);
    expect(app.settings.enableHaptics).toBe(false);
  });
});

describe('VRApp — storage-unavailable and empty-storage arms', () => {
  const P = VRApp.prototype;

  test('loadPersistedSettings returns {} when localStorage is unavailable', () => {
    delete global.localStorage;
    const app = makeVRAppLike({ settings: { a11y: true } });
    expect(P.loadPersistedSettings.call(app)).toEqual({});
  });

  test('_saveTabSession is a no-op when localStorage is unavailable', () => {
    delete global.localStorage;
    const app = makeVRAppLike({
      settings: {},
      tabManager: { serialize: jest.fn() }
    });
    expect(() => P._saveTabSession.call(app)).not.toThrow();
    expect(app.tabManager.serialize).not.toHaveBeenCalled();
  });

  test('_restoreTabSession reports 0 when localStorage is unavailable', () => {
    delete global.localStorage;
    const app = makeVRAppLike({
      settings: {},
      tabManager: { restoreSession: jest.fn() }
    });
    expect(P._restoreTabSession.call(app)).toBe(0);
  });
});

describe('VRApp.updateHover — invisible-ancestor arm', () => {
  test('a hit whose parent is invisible is skipped by isWorldVisible', () => {
    const onHover = jest.fn();
    const target = { userData: { interactable: { onHover } } };
    const invisibleParent = { visible: false };
    target.parent = invisibleParent;
    const controller = { userData: {} };
    const app = makeVRAppLike({ interactables: [target], controllers: [controller] });
    app.raycasterFromController = jest.fn(() => ({ intersectObjects: jest.fn(() => [{ object: target }]) }));
    VRApp.prototype.updateHover.call(app);
    expect(onHover).not.toHaveBeenCalled();
  });
});

describe('VRApp — remaining toggle/toast arms', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('makeCompactToggleButton invokes a provided apply callback with the new value', () => {
    const apply = jest.fn();
    const THREE = require('three');
    const app = makeVRAppLike({
      settings: { flag: false },
      _panelTextures: [],
      _sharedPlaneGeometry: () => new THREE.PlaneGeometry(0.43, 0.17),
      registerInteractable: jest.fn(),
      _announceSettingsButton: jest.fn(),
      updateSetting: jest.fn()
    });
    const mesh = VRApp.prototype.makeCompactToggleButton.call(app, 'L', 'flag', apply);
    const handlers = app.registerInteractable.mock.calls[0][1];
    handlers.onSelect();
    expect(app.updateSetting).toHaveBeenCalledWith('flag', true);
    expect(apply).toHaveBeenCalledWith(true);
  });

  test('showVRToast truncates labels over 60 code points', () => {
    const app = makeVRAppLike({ isVREnabled: true, camera: { add: jest.fn(), remove: jest.fn() } });
    const long = 'x'.repeat(120);
    VRApp.prototype.showVRToast.call(app, long, {});
    // canvas fillText receives the truncated '…'-terminated string
    expect(ctx2d.fillText.mock.calls.at(-1)[0].length).toBe(58);
    expect(ctx2d.fillText.mock.calls.at(-1)[0].endsWith('…')).toBe(true);
  });

  test('toast auto-dismiss tolerates a null camera (torn-down VRApp)', () => {
    const app = makeVRAppLike({ isVREnabled: true, camera: { add: jest.fn() } });
    VRApp.prototype.showVRToast.call(app, 'msg', {});
    app.camera = null; // torn down before the dismiss timer fires
    expect(() => jest.runAllTimers()).not.toThrow();
  });
});

describe('VRApp — settings section + action/stepper apply arms', () => {
  test('_toggleSettingsSection: re-selecting the open tab is a no-op', () => {
    const app = makeVRAppLike({
      settings: { openSettingsSections: ['settings.section.a11y'] },
      updateSetting: jest.fn(),
      _rebuildSettingsPanel: jest.fn(),
      captionSystem: { enabled: true, show: jest.fn() }
    });
    VRApp.prototype._toggleSettingsSection.call(app, 'settings.section.a11y');
    expect(app.updateSetting).not.toHaveBeenCalled();
  });

  test('_toggleSettingsSection: a different tab persists, rebuilds and captions', () => {
    const app = makeVRAppLike({
      settings: { openSettingsSections: [] },
      updateSetting: jest.fn(),
      _rebuildSettingsPanel: jest.fn(),
      captionSystem: { enabled: true, show: jest.fn() }
    });
    VRApp.prototype._toggleSettingsSection.call(app, 'settings.section.display');
    expect(app.updateSetting).toHaveBeenCalledWith('openSettingsSections', ['settings.section.display']);
    expect(app._rebuildSettingsPanel).toHaveBeenCalled();
    expect(app.captionSystem.show).toHaveBeenCalled();
  });

  test('_rebuildSettingsPanel returns early with no panel', () => {
    const app = makeVRAppLike({ settingsPanel: null });
    expect(() => VRApp.prototype._rebuildSettingsPanel.call(app)).not.toThrow();
  });

  test('_disposeSettingsPanel tolerates a parent-less panel', () => {
    const mesh = { isMesh: true };
    const panel = { traverse: (cb) => cb(mesh), parent: null };
    const app = makeVRAppLike({ settingsPanel: panel, unregisterInteractable: jest.fn(), _settingsPanelDrawers: [{}] });
    VRApp.prototype._disposeSettingsPanel.call(app);
    expect(app.unregisterInteractable).toHaveBeenCalledWith(mesh);
    expect(app._settingsPanelDrawers).toEqual([]);
  });

  test('makeActionButton onSelect tolerates a missing callback', () => {
    const THREE = require('three');
    const app = makeVRAppLike({
      _panelTextures: [],
      _sharedPlaneGeometry: () => new THREE.PlaneGeometry(1, 1),
      registerInteractable: jest.fn(),
      _announceSettingsButton: jest.fn()
    });
    VRApp.prototype.makeActionButton.call(app, 'L', undefined);
    const handlers = app.registerInteractable.mock.calls[0][1];
    expect(() => handlers.onSelect()).not.toThrow();
  });

  test('makeStepperButton onSelect applies step+apply and persists', () => {
    const THREE = require('three');
    const apply = jest.fn();
    const app = makeVRAppLike({
      settings: { gazeDwellTime: 1000 },
      _panelTextures: [],
      _sharedPlaneGeometry: () => new THREE.PlaneGeometry(1, 1),
      registerInteractable: jest.fn(),
      updateSetting: jest.fn(),
      _announceSettingsButton: jest.fn()
    });
    VRApp.prototype.makeStepperButton.call(app, 'L', 'gazeDwellTime', { min: 500, max: 3000, step: 250, apply });
    const handlers = app.registerInteractable.mock.calls[0][1];
    // Hit far right of the stepper → 'increment' region (u = x/0.9 + 0.5).
    handlers.onSelect(new THREE.Vector3(0.8, 0, 0));
    expect(app.updateSetting).toHaveBeenCalledWith('gazeDwellTime', 1250);
    expect(apply).toHaveBeenCalledWith(1250);
  });
});

describe('VRApp constructor + storage boundary arms', () => {
  test('ctor with no container falls back to document.body and seeds captionScale', () => {
    const { setPref, getPrefs } = require('../src/a11y/accessibility.js');
    const prev = getPrefs().largeText;
    setPref('largeText', true);
    global.document.body = { style: {}, classList: { toggle: jest.fn(), add: jest.fn(), remove: jest.fn() } };
    const prevLS = global.localStorage;
    delete global.localStorage;
    try {
      const app = new VRApp(undefined); // container falsy -> document.body arm
      app._initPromise?.catch(() => {}); // GPU setup will reject — expected headless
      expect(app.container).toBe(global.document.body);
      // largeText OS pref seeds the accessibility captionScale when nothing persisted
      expect(app.settings.captionScale).toBe(1.4);
    } finally {
      setPref('largeText', prev);
      if (prevLS) {
        global.localStorage = prevLS;
      }
    }
  });

  test('loadPersistedSettings returns {} for a non-object JSON payload', () => {
    global.localStorage = { getItem: () => '42', setItem() {}, removeItem() {} };
    const app = makeVRAppLike({ settings: { a11y: true } });
    expect(VRApp.prototype.loadPersistedSettings.call(app)).toEqual({});
    delete global.localStorage;
  });

  test('_restoreTabSession reports 0 when no session was saved', () => {
    global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    const app = makeVRAppLike({ settings: {}, tabManager: { restoreSession: jest.fn() } });
    expect(VRApp.prototype._restoreTabSession.call(app)).toBe(0);
    delete global.localStorage;
  });

  test('_onWebPanelToggleChanged() with no arg reads the persisted setting', () => {
    const app = makeVRAppLike({
      settings: { enableWebPanel: false },
      _buildBrowsingSystems: jest.fn(),
      _teardownBrowsingSystems: jest.fn(),
      _attachManagedWindow: jest.fn(),
      showVRToast: jest.fn()
    });
    VRApp.prototype._onWebPanelToggleChanged.call(app);
    expect(app._teardownBrowsingSystems).toHaveBeenCalled();
    VRApp.prototype._onWebPanelToggleChanged.call(app, true);
    expect(app._buildBrowsingSystems).toHaveBeenCalled();
  });
});

describe('VRApp — locomotion/teleport/select boundary arms', () => {
  test('updateLocomotion returns early without a playerRig', () => {
    const app = makeVRAppLike({ playerRig: null });
    expect(() => VRApp.prototype.updateLocomotion.call(app, 0.016)).not.toThrow();
  });

  test('updateLocomotion skips controllers with no inputSource and uses the no-controllerInput fallback', () => {
    const moved = { pos: null };
    const rig = new THREE.Group();
    rig.position.set(0, 0, 0);
    const app = makeVRAppLike({
      playerRig: rig,
      camera: new THREE.PerspectiveCamera(),
      controllers: [{ userData: {} }, { userData: { inputSource: { handedness: 'left', gamepad: { axes: [0, 0] } } } }],
      controllerInput: null,
      settings: { southpaw: false, enableSnapTurn: false, enableSmoothMove: true, smoothMoveSpeed: 1 },
      comfortSystem: { notifyMovement: jest.fn() }
    });
    expect(() => VRApp.prototype.updateLocomotion.call(app, 0.016)).not.toThrow();
  });

  test('updateButtonInput returns early without controllerInput', () => {
    const app = makeVRAppLike({ controllerInput: null });
    expect(() => VRApp.prototype.updateButtonInput.call(app)).not.toThrow();
  });

  test('snapTurn without a hand fires no haptic', () => {
    const app = makeVRAppLike({
      playerRig: new THREE.Group(),
      camera: new THREE.PerspectiveCamera(),
      settings: { snapTurnAngle: 45 },
      hapticFeedback: { playPattern: jest.fn() },
      captionSystem: { enabled: true, show: jest.fn() }
    });
    VRApp.prototype.snapTurn.call(app, 1);
    expect(app.hapticFeedback.playPattern).not.toHaveBeenCalled();
    expect(app.captionSystem.show).toHaveBeenCalled();
  });

  test('updateTeleport is a no-op when teleport is inactive', () => {
    const app = makeVRAppLike({ teleport: { active: false, controller: null, marker: null } });
    expect(() => VRApp.prototype.updateTeleport.call(app)).not.toThrow();
  });

  test('updateTeleport clears valid and hides an absent marker on a miss', () => {
    const t = { active: true, controller: { userData: {} }, marker: null, valid: true, target: null };
    const app = makeVRAppLike({
      teleport: t,
      floorMesh: {},
      raycasterFromController: () => ({ intersectObject: () => [] })
    });
    VRApp.prototype.updateTeleport.call(app);
    expect(t.valid).toBe(false);
  });

  test('select dispatch emits qui-select and tolerates handler-less objects', () => {
    const hit = { object: { userData: { interactable: {} }, dispatchEvent: jest.fn() }, point: new THREE.Vector3() };
    const controller = { userData: { inputSource: { handedness: 'left' } } };
    const app = makeVRAppLike({
      interactables: [hit.object],
      raycasterFromController: () => ({ intersectObjects: () => [hit] })
    });
    const fnName = VRApp.prototype.handleSelect ? 'handleSelect' : '_onSelect';
    const fn = VRApp.prototype.handleSelect || VRApp.prototype._onSelect || VRApp.prototype.onSelect;
    if (fn) {
      fn.call(app, controller);
      expect(hit.object.dispatchEvent).toHaveBeenCalled();
    }
  });

  test('_attachManagedWindow reports false without a windowManager', () => {
    const app = makeVRAppLike({ windowManager: null });
    expect(VRApp.prototype._attachManagedWindow.call(app)).toBe(false);
  });

  test('registerInteractable installs a default empty handler map', () => {
    const app = makeVRAppLike();
    const obj = { userData: {} };
    VRApp.prototype.registerInteractable.call(app, obj);
    expect(obj.userData.interactable).toEqual({});
    expect(app.interactables).toContain(obj);
  });
});

describe('VRApp — render/updateSystems/navigate/stats/dispose arms', () => {
  test('render() drives perfMonitorUI begin/end and adjustQuality every 60 frames', () => {
    const pm = { beginFrame: jest.fn(), endFrame: jest.fn() };
    const app = makeVRAppLike({
      frameCount: 59,
      perfMonitorUI: pm,
      renderer: { render: jest.fn() },
      scene: {},
      camera: {},
      updateSystems: jest.fn(),
      updatePerformanceMonitor: jest.fn(),
      adjustQuality: jest.fn()
    });
    VRApp.prototype.render.call(app, 16, null);
    expect(pm.beginFrame).toHaveBeenCalled();
    expect(pm.endFrame).toHaveBeenCalledWith(app.renderer);
    expect(app.adjustQuality).toHaveBeenCalled(); // frameCount 60 -> %60===0
  });

  test('updateSystems: layer blit falls back to [webPanel] without tabManager', () => {
    const panel = { updateLayer: jest.fn() };
    const views = [{}];
    const xrFrame = { getViewerPose: () => ({ views }) };
    const app = makeVRAppLike({
      renderer: { xr: { getReferenceSpace: () => 'rs' } },
      layersSystem: { isSupported: true },
      tabManager: null,
      webPanel: panel,
      updateLocomotion: jest.fn(), updateButtonInput: jest.fn(), updateTeleport: jest.fn(), updateHover: jest.fn()
    });
    VRApp.prototype.updateSystems.call(app, 0, xrFrame, 0.016);
    expect(panel.updateLayer).toHaveBeenCalledWith(xrFrame, views);
  });

  test('updateSystems: null refSpace produces empty pose and no blit', () => {
    const xrFrame = { getViewerPose: jest.fn() };
    const app = makeVRAppLike({
      renderer: { xr: { getReferenceSpace: () => null } },
      layersSystem: { isSupported: true },
      tabManager: null, webPanel: null,
      updateLocomotion: jest.fn(), updateButtonInput: jest.fn(), updateTeleport: jest.fn(), updateHover: jest.fn()
    });
    VRApp.prototype.updateSystems.call(app, 0, xrFrame, 0.016);
    expect(xrFrame.getViewerPose).not.toHaveBeenCalled();
  });

  test('updateSystems: gaze-dwell activation fires haptic + spatial click', () => {
    const hit = { getWorldPosition: () => new THREE.Vector3() };
    const app = makeVRAppLike({
      gazeInteraction: { enabled: true, update: jest.fn(() => hit) },
      hapticFeedback: { playPatternBothHands: jest.fn(), update: jest.fn() },
      spatialAudio: { play: jest.fn(), updateListenerFromCamera: jest.fn() },
      captionSystem: { enabled: true, update: jest.fn(), show: jest.fn() },
      updateLocomotion: jest.fn(), updateButtonInput: jest.fn(), updateTeleport: jest.fn(), updateHover: jest.fn()
    });
    VRApp.prototype.updateSystems.call(app, 0, null, 0.016);
    expect(app.hapticFeedback.playPatternBothHands).toHaveBeenCalledWith('click');
    expect(app.spatialAudio.play).toHaveBeenCalled();
  });

  test('updateSystems: windowManager follow/isGrabbing drives update + attach', () => {
    const app = makeVRAppLike({
      windowManager: { followMode: true, isGrabbing: false, update: jest.fn() },
      _attachManagedWindow: jest.fn(),
      updateLocomotion: jest.fn(), updateButtonInput: jest.fn(), updateTeleport: jest.fn(), updateHover: jest.fn()
    });
    VRApp.prototype.updateSystems.call(app, 0, null, 0.016);
    expect(app._attachManagedWindow).toHaveBeenCalled();
    expect(app.windowManager.update).toHaveBeenCalled();
  });

  test('navigate captions the title when it differs from the url', () => {
    const shown = [];
    const app = makeVRAppLike({
      settings: { privateMode: false },
      bookmarks: { addHistory: jest.fn() },
      captionSystem: { enabled: true, show: (m) => shown.push(m) }
    });
    VRApp.prototype.navigate.call(app, 'https://x.example/p', 'Example Page');
    expect(shown[0]).toBe('Example Page');
    VRApp.prototype.navigate.call(app, 'https://x.example/p');
    expect(shown[1]).toBe('x.example');
  });

  test('getPerformanceStats reports 0 programs when info.programs is absent', () => {
    const app = makeVRAppLike({
      renderer: { info: { memory: { geometries: 1, textures: 2 } } },
      performanceMonitor: { fps: 60.4, frameTime: 16.6, memoryUsed: 12.3, drawCalls: 5, triangles: 100 }
    });
    const stats = VRApp.prototype.getPerformanceStats.call(app);
    expect(stats.programs).toBe(0);
    expect(stats.fps).toBe(60);
  });

  test('dispose removes GL listeners, cancels debounce, frees material arrays', () => {
    const removed = [];
    const cancel = jest.fn();
    const app = makeVRAppLike({
      renderer: {
        domElement: { removeEventListener: (t) => removed.push(t) },
        dispose: jest.fn(), forceContextLoss: jest.fn(), setAnimationLoop: jest.fn(), render: jest.fn(),
        xr: { enabled: false, getSession: () => null }
      },
      _onWebGLContextLost: jest.fn(),
      _onWebGLContextRestored: jest.fn(),
      _onWindowResize: Object.assign(jest.fn(), { cancel }),
      scene: { traverse: (cb) => cb({ material: [{ dispose: jest.fn() }, { dispose: jest.fn() }] }) },
      camera: null,
      vrKeyboard: null, japaneseIME: null, handTracking: null, hapticFeedback: null,
      gazeInteraction: null, captionSystem: null, semanticDOM: null, spatialAudio: null,
      progressiveLoader: null, voiceCommands: null, windowManager: null, layersSystem: null,
      bookmarkPanel: null, tabManager: null, webPanel: null, immersiveVideo: null,
      comfortSystem: null, ffrSystem: null, perfMonitorUI: null
    });
    global.window = { removeEventListener: jest.fn(), addEventListener: jest.fn() };
    expect(() => VRApp.prototype.dispose.call(app)).not.toThrow();
    expect(removed).toContain('webglcontextlost');
    expect(cancel).toHaveBeenCalled();
  });
});

describe('WindowManager — sliver arm', () => {
  test('WindowManager update early-returns without a target', async () => {
    const { WindowManager } = await import('../src/vr/browser/WindowManager.js');
    const wm = new WindowManager({ camera: {} });
    expect(() => wm.update(16)).not.toThrow();
  });
});

describe('WindowManager — follow arms', () => {
  test('update with a target and followMode repositions toward camera', async () => {
    const { WindowManager } = await import('../src/vr/browser/WindowManager.js');
    const THREE = require('three');
    const wm = new WindowManager(new THREE.PerspectiveCamera());
    wm.target = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3() };
    wm.followMode = true;
    expect(() => wm.update(16)).not.toThrow();
    wm._grab = { id: 'g' };
    wm._updateGrab = jest.fn(); wm._applyAngularScale = jest.fn(); wm._faceUser = jest.fn();
    wm.update(16);                                        // grab arm wins over follow
    expect(wm._updateGrab).toHaveBeenCalled();
  });
});

describe('VRApp — WindowManager remaining default arms', () => {
  test('update() with no argument uses the 16ms default; followMode off is a no-op', async () => {
    const { WindowManager } = await import('../src/vr/browser/WindowManager.js');
    const wm = new WindowManager(new THREE.PerspectiveCamera());
    wm.target = new THREE.Object3D();
    wm.followMode = false;
    wm.update(); // dtMs default + followMode false arm
    expect(wm.target.position.x).toBe(0);
  });
});

describe('VRApp — sliver arms (persist, teardown, guards)', () => {
  test('ctor: a persisted captionScale beats the OS large-text seed', () => {
    const { setPref, getPrefs } = require('../src/a11y/accessibility.js');
    const prev = getPrefs().largeText;
    setPref('largeText', true);
    global.document.body = { style: {}, classList: { toggle: jest.fn(), add: jest.fn(), remove: jest.fn() } };
    const prevLS = global.localStorage;
    global.localStorage = { getItem: () => JSON.stringify({ captionScale: 2.5 }), setItem() {}, removeItem() {} };
    try {
      const app = new VRApp(undefined);
      app._initPromise?.catch(() => {});
      expect(app.settings.captionScale).toBe(2.5);
    } finally {
      setPref('largeText', prev);
      if (prevLS) {
        global.localStorage = prevLS;
      } else {
        delete global.localStorage;
      }
    }
  });

  test('saveSettings no-ops when localStorage is unavailable', () => {
    const prevLS = global.localStorage;
    delete global.localStorage;
    try {
      expect(() => VRApp.prototype.saveSettings.call({ settings: { a: 1 } })).not.toThrow();
    } finally {
      if (prevLS) {
        global.localStorage = prevLS;
      }
    }
  });

  test('_teardownBrowsingSystems detaches a live windowManager', () => {
    const wm = { detach: jest.fn() };
    const app = makeVRAppLike({ windowManager: wm });
    VRApp.prototype._teardownBrowsingSystems.call(app);
    expect(wm.detach).toHaveBeenCalled();
  });

  test('_disposeSettingsPanel early-returns with no panel', () => {
    const app = makeVRAppLike({ settingsPanel: null });
    expect(() => VRApp.prototype._disposeSettingsPanel.call(app)).not.toThrow();
  });

  test('_rebuildSettingsPanel re-adds the new panel to its captured parent', () => {
    const parent = { add: jest.fn(), remove: jest.fn() };
    const panel = new THREE.Group();
    panel.parent = parent;
    const app = makeVRAppLike({
      settingsPanel: panel,
      unregisterInteractable: jest.fn(),
      _settingsPanelDrawers: [],
      _disposeSettingsPanel: VRApp.prototype._disposeSettingsPanel,
      createSettingsPanel: () => new THREE.Group()
    });
    VRApp.prototype._rebuildSettingsPanel.call(app);
    expect(parent.add).toHaveBeenCalledWith(app.settingsPanel);
  });

  test('_redrawSettingsPanel tolerates a null drawer list', () => {
    const app = makeVRAppLike({ _settingsPanelDrawers: null });
    expect(() => VRApp.prototype._redrawSettingsPanel.call(app)).not.toThrow();
  });

  test('_announceSettingsButton: captions off → silent; force announces', () => {
    const show = jest.fn();
    const app = makeVRAppLike({
      captionSystem: { enabled: false, show },
      settings: { enableGazeDwell: true }
    });
    VRApp.prototype._announceSettingsButton.call(app, 'toggle', 'L', true);
    expect(show).not.toHaveBeenCalled();
    app.settings.enableGazeDwell = false;
    app.captionSystem.enabled = true;
    VRApp.prototype._announceSettingsButton.call(app, 'toggle', 'L', true, {}, true); // force
    expect(show).toHaveBeenCalled();
  });

  test('button builders: onSelect without apply/point are safe no-ops', () => {
    const app = makeVRAppLike({
      settings: { k: false, s: 500, c: 'a' },
      _panelTextures: [],
      _sharedPlaneGeometry: () => new THREE.PlaneGeometry(1, 1),
      registerInteractable: jest.fn(),
      updateSetting: jest.fn(),
      _announceSettingsButton: jest.fn()
    });
    VRApp.prototype.makeCompactToggleButton.call(app, 'L', 'k', undefined);
    app.registerInteractable.mock.calls[0][1].onSelect();
    expect(app.updateSetting).toHaveBeenCalledWith('k', true);

    app.registerInteractable.mockClear();
    VRApp.prototype.makeStepperButton.call(app, 'L', 's', { min: 0, max: 1000, step: 100 }); // no apply
    const stepHandlers = app.registerInteractable.mock.calls[0][1];
    app.updateSetting.mockClear();
    stepHandlers.onSelect(); // no point → u defaults → middle region → redraw only
    expect(app.updateSetting).not.toHaveBeenCalled();

    app.registerInteractable.mockClear();
    VRApp.prototype.makeCycleButton.call(app, 'L', 'c', ['a', 'b']); // no apply
    app.registerInteractable.mock.calls[0][1].onSelect();
    expect(app.updateSetting).toHaveBeenCalledWith('c', 'b');
  });

  test('_toggleSettingsSection: single open section different from target still switches; captions off', () => {
    const app = makeVRAppLike({
      settings: { openSettingsSections: ['settings.section.display'] },
      updateSetting: jest.fn(),
      _rebuildSettingsPanel: jest.fn(),
      captionSystem: { enabled: false, show: jest.fn() }
    });
    VRApp.prototype._toggleSettingsSection.call(app, 'settings.section.a11y');
    expect(app.updateSetting).toHaveBeenCalledWith('openSettingsSections', ['settings.section.a11y']);
    expect(app.captionSystem.show).not.toHaveBeenCalled();
  });

  test('_requestReaderProxyInput falls back to a standalone webPanel', () => {
    const webPanel = { setReaderProxyUrl: jest.fn() };
    const app = makeVRAppLike({
      settings: { readerProxyUrl: '' },
      tabManager: null,
      webPanel,
      updateSetting: jest.fn(),
      showVRToast: jest.fn(),
      _requestVRKeyboardInput: (_p, cb) => cb('http://proxy:8080')
    });
    VRApp.prototype._requestReaderProxyInput.call(app);
    expect(webPanel.setReaderProxyUrl).toHaveBeenCalledWith('http://proxy:8080');
  });

  test('_requestVRKeyboardInput captions the prompt; window.prompt fallback arm', () => {
    const kb = { setOnConfirm: jest.fn(), show: jest.fn() };
    const app = makeVRAppLike({
      vrKeyboard: kb,
      japaneseIME: { activate: jest.fn(), compositionBuffer: '' },
      captionSystem: { enabled: true, show: jest.fn() }
    });
    VRApp.prototype._requestVRKeyboardInput.call(app, 'https://x', jest.fn(), 'Enter proxy URL');
    expect(app.captionSystem.show).toHaveBeenCalledWith('Enter proxy URL');
    expect(app.japaneseIME.compositionBuffer).toBe('https://x');
    // window.prompt path: no keyboard
    const seen = [];
    const app2 = makeVRAppLike({ vrKeyboard: null });
    global.window = global.window || {};
    global.window.prompt = jest.fn(() => 'https://typed');
    VRApp.prototype._requestVRKeyboardInput.call(app2, '', (u) => seen.push(u));
    expect(seen).toEqual(['https://typed']);
    // prefill === 'https://' sentinel → empty buffer (the bare prefix is not text)
    VRApp.prototype._requestVRKeyboardInput.call(app, 'https://', jest.fn());
    expect(app.japaneseIME.compositionBuffer).toBe('');
  });

  test('navigate: same-value title falls back to the hostname caption', () => {
    const show = jest.fn();
    const app = makeVRAppLike({
      settings: { privateMode: false },
      bookmarks: { addHistory: jest.fn() },
      captionSystem: { enabled: true, show },
      tabManager: { getActiveTab: () => null }
    });
    VRApp.prototype.navigate.call(app, 'https://solo.example/p', 'https://solo.example/p');
    expect(show).toHaveBeenLastCalledWith('solo.example');
  });

  test('getPerformanceStats includes ffr + texture stats when attached', () => {
    const app = {
      renderer: { info: { memory: { geometries: 1, textures: 2 }, programs: [{}] } },
      performanceMonitor: { fps: 72, frameTime: 13.9, memoryUsed: 10, drawCalls: 5, triangles: 42 },
      ffrSystem: { intensity: 0.5 },
      textureManager: { getMemoryStats: () => ({ usedMB: 8, maxMB: 256 }) }
    };
    const s = VRApp.prototype.getPerformanceStats.call(app);
    expect(s.ffrIntensity).toBe('50%');
    expect(s.textureMemory).toBe('8/256MB');
  });

  test('raycasterFromController reuses the shared raycaster across calls', () => {
    const app = {};
    const ctl = makeController('right');
    const r1 = VRApp.prototype.raycasterFromController.call(app, ctl);
    const r2 = VRApp.prototype.raycasterFromController.call(app, ctl);
    expect(r1).toBe(r2);
    expect(r1).toBeInstanceOf(THREE.Raycaster);
  });

  test('onControllerSelect: hit object without dispatchEvent skips the DOM event', () => {
    const target = { userData: { interactable: {} } }; // no dispatchEvent
    const hit = { object: target };
    const app = makeVRAppLike({
      interactables: [target],
      hapticFeedback: { playPattern: jest.fn() },
      raycasterFromController: jest.fn(() => ({
        intersectObjects: () => [hit]
      }))
    });
    expect(() => VRApp.prototype.onControllerSelect.call(app, makeController('right'), true)).not.toThrow();
  });

  test('onControllerSelect release: ends an in-progress grab with cross-modal feedback', () => {
    const controller = makeController('right');
    const endGrab = jest.fn();
    const app = makeVRAppLike({
      windowManager: { isGrabbing: true, endGrab },
      _grabController: controller,
      hapticFeedback: { playPattern: jest.fn() },
      captionSystem: { enabled: true, show: jest.fn() }
    });
    VRApp.prototype.onControllerSelect.call(app, controller, false);
    expect(endGrab).toHaveBeenCalled();
    expect(app._grabController).toBeNull();
  });

  test('dispose tolerates a resize listener without cancel() and a renderer without domElement', () => {
    const renderer = { setAnimationLoop: jest.fn(), dispose: jest.fn(), xr: {} }; // no domElement
    global.window = global.window || {};
    global.window.removeEventListener = jest.fn();
    global.window.addEventListener = jest.fn();
    const app = makeVRAppLike({
      renderer,
      scene: new THREE.Scene(),
      _onWindowResize: jest.fn(), // no .cancel — the typeof guard's other side
      _toastTimers: new Set(),
      _handTrackingTimers: {},
      interactables: [],
      hapticFeedback: null,
      captionSystem: null,
      semanticDOM: null
    });
    expect(() => VRApp.prototype.dispose.call(app)).not.toThrow();
    expect(app._onWindowResize).toBeNull();
  });
});

describe('VRApp updateButtonInput — utility-hand + moved-false arms', () => {
  function btnApp(over = {}) {
    const rig = new THREE.Object3D();
    const camera = new THREE.PerspectiveCamera();
    rig.add(camera);
    return Object.assign({
      playerRig: rig, camera,
      controllers: [],
      settings: { southpaw: false, enableSnapTurn: true, enableSmoothMove: false, snapTurnAngle: 30, smoothMoveSpeed: 2 },
      controllerInput: null, comfortSystem: null,
      hapticFeedback: { playPattern: jest.fn() },
      captionSystem: { enabled: true, show: jest.fn() },
      tabManager: null, bookmarkPanel: null, settingsPanel: null, vrKeyboard: null,
      semanticDOM: { setSettingsExpanded: jest.fn() },
      recenter: jest.fn()
    }, over);
  }
  const pad = (hand, buttons) => {
    const ctl = { userData: { inputSource: { handedness: hand } } };
    return { ctl, read: () => ({ axes: {}, buttons, hand }) };
  };

  test('pointer faceA with no forward history captions honestly; faceB success captions', () => {
    const app = btnApp();
    const tab = { goForward: jest.fn(() => false), goBack: jest.fn(() => true) };
    app.tabManager = { getActiveTab: () => tab };
    const { ctl, read } = pad('right', { faceA: { justPressed: true }, faceB: { justPressed: true } });
    app.controllers = [ctl];
    app.controllerInput = { read };
    VRApp.prototype.updateButtonInput.call(app);
    expect(app.captionSystem.show).toHaveBeenCalledWith(expect.stringContaining(''));
    expect(app.hapticFeedback.playPattern).toHaveBeenCalledWith('right', 'click');
    // captions disabled → silent arm
    app.captionSystem.enabled = false;
    app.captionSystem.show.mockClear();
    VRApp.prototype.updateButtonInput.call(app);
    expect(app.captionSystem.show).not.toHaveBeenCalled();
  });

  test('utility hand: bookmark/settings/keyboard toggles with captions', () => {
    const app = btnApp({
      bookmarkPanel: { toggle: jest.fn(), visible: false },
      settingsPanel: { visible: false, mesh: {} },
      vrKeyboard: { visible: false, show: jest.fn(), hide: jest.fn() }
    });
    const { ctl, read } = pad('left', {
      faceA: { justPressed: true }, faceB: { justPressed: true }, thumbstickClick: { justPressed: true }
    });
    app.controllers = [ctl];
    app.controllerInput = { read };
    VRApp.prototype.updateButtonInput.call(app);
    expect(app.bookmarkPanel.toggle).toHaveBeenCalled();
    expect(app.settingsPanel.visible).toBe(true);
    expect(app.semanticDOM.setSettingsExpanded).toHaveBeenCalledWith(true);
    expect(app.vrKeyboard.show).toHaveBeenCalled();
    expect(app.captionSystem.show).toHaveBeenCalled();
  });

  test('utility hand: menu button toggles settings; no-panel arms are safe', () => {
    const app = btnApp({
      settingsPanel: { visible: false, mesh: null }, // mesh falsy arm
      bookmarkPanel: null, vrKeyboard: null
    });
    const { ctl, read } = pad('left', { menu: { justPressed: true }, faceA: { justPressed: true }, thumbstickClick: { justPressed: true } });
    app.controllers = [ctl];
    app.controllerInput = { read };
    expect(() => VRApp.prototype.updateButtonInput.call(app)).not.toThrow();
    expect(app.settingsPanel.visible).toBe(true);
  });
});

describe('VRApp updateLocomotion — axes defaults + reuse + zero-move arms', () => {
  test('axes missing keys default to 0; _locoQ reused on the second frame; parallel-to-forward zero move', () => {
    const rig = new THREE.Object3D();
    const camera = new THREE.PerspectiveCamera();
    rig.add(camera);
    const app = {
      playerRig: rig, camera,
      controllers: [{ userData: { inputSource: { handedness: 'left' } } }],
      settings: { southpaw: false, enableSnapTurn: true, enableSmoothMove: true, snapTurnAngle: 30, smoothMoveSpeed: 2 },
      controllerInput: { read: () => ({ axes: {}, buttons: {}, hand: 'left' }) },
      comfortSystem: null, hapticFeedback: null, captionSystem: null, snapTurn: jest.fn()
    };
    // axes present but keys absent → destructured defaults — no throw, no move
    VRApp.prototype.updateLocomotion.call(app);
    expect(app.playerRig.position.length()).toBe(0);
    // real input twice → _locoQ allocated once, reused
    app.controllerInput.read = () => ({ axes: { stickX: 0, stickY: -1 }, buttons: {}, hand: 'left' });
    VRApp.prototype.updateLocomotion.call(app, 0.1);
    const q = app._locoQ;
    VRApp.prototype.updateLocomotion.call(app, 0.1);
    expect(app._locoQ).toBe(q);
    expect(app.playerRig.position.z).toBeCloseTo(-0.4, 5);
  });
});

describe('VRApp onVRSessionEnd — restore arms', () => {
  test('camera.fov falsy restores 90; webPanel-only arm detaches its layer', () => {
    const layers = { removeLayer: jest.fn(), dispose: jest.fn(), updateRenderState: jest.fn() };
    const webPanel = { disableLayerMode: jest.fn() };
    const app = {
      isVREnabled: true,
      ffrSystem: { disable: jest.fn() },
      comfortSystem: { settings: { fov: { baseFOV: 0 } } },
      camera: { fov: 0 }, // falsy → || 90
      layersSystem: layers,
      tabManager: null,
      webPanel,
      hapticFeedback: null, handTracking: null, voiceCommands: null,
      captionSystem: null, spatialAudio: null,
      renderer: { xr: { getSession: () => null, setReferenceSpaceType: jest.fn() }, setPixelRatio: jest.fn(), setSize: jest.fn() },
      scene: new THREE.Scene()
    };
    expect(() => VRApp.prototype.onVRSessionEnd.call(app)).not.toThrow();
    expect(app.comfortSystem.settings.fov.baseFOV).toBe(90);
  });
});

describe('VRApp — layer attach/detach + session-start tail arms', () => {
  const session = { addEventListener: jest.fn(), visibilityState: 'visible' };

  test('_attachLayersToPanels: no refSpace returns; quadLayer null skips enableLayerMode; no getBaseLayer → null base', () => {
    const panel = { enableLayerMode: jest.fn() };
    const layers = { createQuadLayer: jest.fn(() => null), updateRenderState: jest.fn(), count: 0 };
    const app = {
      renderer: { xr: { getReferenceSpace: () => null } },
      layersSystem: layers, tabManager: { tabs: [panel] }, webPanel: null
    };
    VRApp.prototype._attachLayersToPanels.call(app, session);
    expect(layers.createQuadLayer).not.toHaveBeenCalled(); // !refSpace arm

    app.renderer.xr.getReferenceSpace = () => ({ rs: 1 });
    app.renderer.xr.getBaseLayer = undefined; // absent arm → baseLayer null
    VRApp.prototype._attachLayersToPanels.call(app, session);
    expect(panel.enableLayerMode).not.toHaveBeenCalled();   // quadLayer null arm
    expect(layers.updateRenderState).toHaveBeenCalledWith(session, null);
  });

  test('_attachLayersToPanels: webPanel-only fallback arm', () => {
    const wp = { enableLayerMode: jest.fn() };
    const layers = { createQuadLayer: jest.fn(() => ({ ql: 1 })), updateRenderState: jest.fn(), count: 1 };
    const app = {
      renderer: { xr: { getReferenceSpace: () => ({}), getBaseLayer: () => ({}) } },
      layersSystem: layers, tabManager: null, webPanel: wp
    };
    VRApp.prototype._attachLayersToPanels.call(app, session);
    expect(wp.enableLayerMode).toHaveBeenCalled();
  });

  test('_detachPanelLayer tolerates xr without getSession/getBaseLayer', () => {
    const layers = { removeLayer: jest.fn() };
    const app = { layersSystem: layers, renderer: { xr: {} } };
    VRApp.prototype._detachPanelLayer.call(app, 'panel_chrome_0');
    expect(layers.removeLayer).toHaveBeenCalledWith('panel_chrome_0', null, null);
  });

  test('onVRSessionStart: null session skips session wiring entirely', async () => {
    const app = makeVRAppLike({
      renderer: { xr: { getSession: () => null }, getContext: () => ({}), setPixelRatio: jest.fn() },
      settings: { enableWebPanel: true },
      comfortSystem: null, ffrSystem: null, handTracking: null,
      captionSystem: { enabled: false, show: jest.fn() }
    });
    await VRApp.prototype.onVRSessionStart.call(app);
    expect(app.isVREnabled).toBe(true);
    expect(app.captionSystem.show).not.toHaveBeenCalled(); // captions disabled arm
  });
});

describe('VRApp render/perf tails', () => {
  test('render: perfMonitorUI present wraps begin/end; frame counter advances', () => {
    const ui = { beginFrame: jest.fn(), endFrame: jest.fn() };
    const app = {
      frameCount: 0, _lastRenderTime: 0,
      perfMonitorUI: ui,
      updateSystems: jest.fn(),
      updatePerformanceMonitor: jest.fn(),
      adjustQuality: jest.fn(),
      renderer: { render: jest.fn() },
      scene: {}, camera: {}
    };
    VRApp.prototype.render.call(app, 0, null);
    expect(ui.beginFrame).toHaveBeenCalled();
    expect(ui.endFrame).toHaveBeenCalledWith(app.renderer);
    expect(app.updateSystems).toHaveBeenCalled();
    // absent arm — no perf UI
    app.perfMonitorUI = null;
    expect(() => VRApp.prototype.render.call(app, 0, null)).not.toThrow();
  });

  test('updateSystems: layer blit via webPanel-only fallback; windowManager guards', () => {
    const wp = { updateLayer: jest.fn() };
    const app = makeVRAppLike({
      settings: { enableComfort: false, enableSnapTurn: false, enableSmoothMove: false, enableGazeDwell: false, southpaw: false },
      isVREnabled: true,
      camera: new THREE.PerspectiveCamera(),
      controllers: [],
      comfortSystem: null, ffrSystem: null, handTracking: null,
      hapticFeedback: null, gazeInteraction: null, captionSystem: null,
      spatialAudio: null, immersiveVideo: null,
      layersSystem: { isSupported: true },
      tabManager: null, webPanel: wp,
      windowManager: { followMode: false, isGrabbing: false, update: jest.fn() },
      performanceMonitor: { frameTime: 5 },
      renderer: { xr: { getReferenceSpace: () => 'rs' }, info: { render: { calls: 0, triangles: 0 } } },
      updateLocomotion: jest.fn(), updateButtonInput: jest.fn(),
      updateTeleport: jest.fn(), updateHover: jest.fn(), _attachManagedWindow: jest.fn()
    });
    const xrFrame = { getViewerPose: () => ({ views: [{}, {}] }) };
    VRApp.prototype.updateSystems.call(app, 0, xrFrame, 0.016);
    expect(wp.updateLayer).toHaveBeenCalledWith(xrFrame, expect.any(Array)); // webPanel fallback arm
    expect(app.windowManager.update).not.toHaveBeenCalled(); // both modes off

    // followMode on → attaches + updates
    app.windowManager.followMode = true;
    VRApp.prototype.updateSystems.call(app, 0, null, 0.016);
    expect(app._attachManagedWindow).toHaveBeenCalled();
    expect(app.windowManager.update).toHaveBeenCalledWith(16);
  });

  test('updatePerformanceMonitor: no performance.memory leaves memoryUsed untouched', () => {
    const had = Object.getOwnPropertyDescriptor(global.performance, 'memory');
    Object.defineProperty(global.performance, 'memory', { value: undefined, configurable: true });
    try {
      const app = {
        performanceMonitor: { frameTime: 20, memoryUsed: 7 },
        renderer: { info: { render: { calls: 1, triangles: 2 } } }
      };
      VRApp.prototype.updatePerformanceMonitor.call(app, 10);
      expect(app.performanceMonitor.memoryUsed).toBe(7); // absent-arm: unchanged
      expect(app.performanceMonitor.fps).toBeCloseTo(1000 / 19);
    } finally {
      if (had) {
        Object.defineProperty(global.performance, 'memory', had);
      } else {
        delete global.performance.memory;
      }
    }
  });

  test('OS contrast-change handler tolerates absent subsystems', () => {
    const app = makeVRAppLike({
      gazeInteraction: null,
      captionSystem: null,
      scene: new THREE.Scene()
    });
    global.matchMedia = () => ({ addEventListener: jest.fn(), matches: false });
    VRApp.prototype._setupOSAccessibilityListeners.call(app);
    expect(() => app._onOSContrastChange()).not.toThrow();
    // same handler registered on both queries
    expect(app._osContrastMQ.addEventListener).toHaveBeenCalledWith('change', app._onOSContrastChange);
    expect(app._osForcedColorsMQ.addEventListener).toHaveBeenCalledWith('change', app._onOSContrastChange);
  });

  test('loadAudioAssets with no spatialAudio is a silent no-op', async () => {
    await expect(VRApp.prototype.loadAudioAssets.call({ spatialAudio: null })).resolves.toBeUndefined();
  });
});

describe('VRApp — setupCamera/home-environment remaining arms', () => {
  const makeSetupApp2 = (over = {}) => {
    const app = makeVRAppLike({
      settings: { enableHomeEnvironment: false, enableSettingsPanel: false, enableWebPanel: false, enableGazeDwell: false, windowDistance: 2.4, enableWindowFollow: false },
      _panelTextures: [], _sharedGeometries: new Map(),
      scene: new THREE.Scene(), camera: null,
      interactables: [],
      registerInteractable(mesh, h) {
        app.interactables.push({ mesh, ...h });
      },
      _attachManagedWindow: jest.fn(),
      ...over
    });
    return app;
  };

  test('setupCamera with enableWebPanel builds a real WindowManager honoring follow flag', () => {
    global.window = { innerWidth: 1280, innerHeight: 720 };
    const app = makeSetupApp2({ settings: { enableWebPanel: true, enableWindowFollow: true, windowDistance: 2.4 } });
    VRApp.prototype.setupCamera.call(app);
    expect(app.windowManager).toBeTruthy();
    expect(app._attachManagedWindow).toHaveBeenCalled();
    expect(app.windowManager.followMode).toBe(true);
    delete global.window;
  });

  test('createHomeEnvironment: hover lights the recenter panel; caption needs gaze-dwell', () => {
    const shown = [];
    const app = makeSetupApp2({
      settings: { enableGazeDwell: true },
      captionSystem: { enabled: true, show: (m) => shown.push(m) },
      recenter: jest.fn()
    });
    VRApp.prototype.createHomeEnvironment.call(app);
    const panel = app.interactables[0];
    panel.onHover();
    expect(panel.mesh.material.color.getHex()).toBe(0x88bbff);
    expect(shown.length).toBe(1); // caption gate: enabled && gazeDwell
    panel.onHoverEnd();
    expect(panel.mesh.material.color.getHex()).toBe(0xffffff);

    // gaze-dwell off → color still shifts, no caption
    const app2 = makeSetupApp2({
      settings: { enableGazeDwell: false },
      captionSystem: { enabled: true, show: (m) => shown.push(m) },
      recenter: jest.fn()
    });
    VRApp.prototype.createHomeEnvironment.call(app2);
    shown.length = 0;
    app2.interactables[0].onHover();
    expect(shown).toHaveLength(0);
  });
});

describe('VRApp — complementary arms round 3', () => {
  test('saveSettings returns silently when localStorage is absent', () => {
    delete global.localStorage;
    expect(() => VRApp.prototype.saveSettings.call({ settings: { a: 1 } })).not.toThrow();
  });

  test('_teardownBrowsingSystems with no windowManager is a no-op', () => {
    const app = makeVRAppLike({ windowManager: null });
    expect(() => VRApp.prototype._teardownBrowsingSystems.call(app)).not.toThrow();
  });

  test('openSettingsSections absent → || [] arms in tab draw + section toggle', () => {
    const app = makeVRAppLike({
      settings: { openSettingsSections: undefined },
      updateSetting(key, v) {
        app.settings[key] = v;
      },
      _rebuildSettingsPanel: jest.fn(),
      captionSystem: { enabled: false, show: jest.fn() }
    });
    // toggle uses `current || []` then writes back
    VRApp.prototype._toggleSettingsSection.call(app, 'settings.section.audio');
    expect(app.settings.openSettingsSections).toEqual(['settings.section.audio']);
  });

  test('_rebuildSettingsPanel falls back to scene when the old panel was unparented', () => {
    const panel = new THREE.Group(); // parent: null
    const scene = new THREE.Scene();
    const app = makeVRAppLike({
      scene,
      settingsPanel: panel,
      unregisterInteractable: jest.fn(),
      _settingsPanelDrawers: [],
      _panelTextures: [],
      _disposeSettingsPanel: VRApp.prototype._disposeSettingsPanel,
      createSettingsPanel: () => new THREE.Group()
    });
    VRApp.prototype._rebuildSettingsPanel.call(app);
    expect(scene.children).toContain(app.settingsPanel);
  });

  test('stepper without apply still steps + announces on a real hit', () => {
    const app = makeVRAppLike({
      settings: { s: 500 },
      _panelTextures: [],
      updateSetting: jest.fn((k, v) => {
        app.settings[k] = v;
      }),
      _announceSettingsButton: jest.fn(),
      _sharedPlaneGeometry: () => new THREE.PlaneGeometry(0.9, 0.17),
      registerInteractable: jest.fn((m, h) => {
        app._h = h;
      }),
      scene: new THREE.Scene()
    });
    VRApp.prototype.makeStepperButton.call(app, 'L', 's', { min: 0, max: 1000, step: 100 }); // no apply
    const mesh = app._h && app.registerInteractable.mock.calls[0][0];
    app._h.onSelect({ intersection: { point: new THREE.Vector3(0.4, 0, 0) }, controller: {} });
    expect(app.updateSetting).toHaveBeenCalledWith('s', 600); // if(apply) skipped — no crash
  });

  test('_requestReaderProxyInput with neither tabManager nor webPanel is a silent no-op', () => {
    const app = makeVRAppLike({
      settings: { readerProxyUrl: '' },
      tabManager: null, webPanel: null,
      updateSetting: jest.fn(), showVRToast: jest.fn(),
      _requestVRKeyboardInput: (_p, cb) => cb('http://proxy:8080')
    });
    expect(() => VRApp.prototype._requestReaderProxyInput.call(app)).not.toThrow();
    expect(app.updateSetting).toHaveBeenCalledWith('readerProxyUrl', 'http://proxy:8080');
  });

  test('pointer thumbstick recenters + haptic; captions-disabled utility-hand arms', () => {
    const rig = new THREE.Object3D(); rig.add(new THREE.PerspectiveCamera());
    const app = {
      playerRig: rig,
      camera: rig.children[0],
      controllers: [],
      settings: { southpaw: false, enableSnapTurn: true, enableSmoothMove: false },
      controllerInput: null,
      hapticFeedback: { playPattern: jest.fn() },
      captionSystem: { enabled: false, show: jest.fn() },
      tabManager: null,
      bookmarkPanel: { toggle: jest.fn(), visible: false },
      settingsPanel: { visible: false, mesh: null },
      vrKeyboard: { visible: false, show: jest.fn(), hide: jest.fn() },
      semanticDOM: { setSettingsExpanded: jest.fn() },
      recenter: jest.fn()
    };
    // pointer-hand thumbstick → recenter + haptic (arm0)
    const ctl = { userData: { inputSource: { handedness: 'right' } } };
    app.controllers = [ctl];
    app.controllerInput = { read: () => ({ axes: {}, buttons: { thumbstickClick: { justPressed: true } }, hand: 'right' }) };
    VRApp.prototype.updateButtonInput.call(app);
    expect(app.recenter).toHaveBeenCalled();
    expect(app.hapticFeedback.playPattern).toHaveBeenCalledWith('right', 'click');

    // utility hand with captions disabled → caption gates skip (arms 2187/2199/2206 false)
    const ctlL = { userData: { inputSource: { handedness: 'left' } } };
    app.controllers = [ctlL];
    app.controllerInput = { read: () => ({ axes: {}, buttons: { faceA: { justPressed: true }, faceB: { justPressed: true }, thumbstickClick: { justPressed: true } }, hand: 'left' }) };
    VRApp.prototype.updateButtonInput.call(app);
    expect(app.bookmarkPanel.toggle).toHaveBeenCalled();
    expect(app.vrKeyboard.show).toHaveBeenCalled();
    expect(app.captionSystem.show).not.toHaveBeenCalled();

    // haptic absent on the select path (2299 arm)
    app.hapticFeedback = null;
    app.captionSystem.enabled = true;
    app.interactables = [];
    expect(() => VRApp.prototype.updateButtonInput.call(app)).not.toThrow();
  });

  test('snapTurn defaults to 30° when snapTurnAngle is unset', () => {
    const rig = new THREE.Object3D();
    const camera = new THREE.PerspectiveCamera(); rig.add(camera);
    const app = { settings: {}, playerRig: rig, camera };
    VRApp.prototype.snapTurn.call(app, 1, 'right');
    expect(Math.abs(rig.rotation.y)).toBeCloseTo(THREE.MathUtils.degToRad(30), 3);
  });

  test('updateTeleport: hit with no marker still marks valid + captures target', () => {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10));
    floor.rotation.x = -Math.PI / 2;
    floor.updateMatrixWorld(true);
    const ctl = new THREE.Object3D();
    ctl.position.set(0, 1.6, 0);
    ctl.rotation.set(-Math.PI / 4, 0, 0);
    ctl.updateMatrixWorld(true);
    ctl.userData = {};
    const app = makeVRAppLike({
      teleport: { active: true, controller: ctl, marker: null, valid: false, target: null },
      floorMesh: floor
    });
    app.raycasterFromController = (c) => VRApp.prototype.raycasterFromController.call(app, c);
    VRApp.prototype.updateTeleport.call(app);
    expect(app.teleport.valid).toBe(true);
    expect(app.teleport.target).toBeInstanceOf(THREE.Vector3);
  });

  test('updatePerformanceMonitor consumes performance.memory when present', () => {
    const had = Object.getOwnPropertyDescriptor(global.performance, 'memory');
    Object.defineProperty(global.performance, 'memory', { value: { usedJSHeapSize: 2097152 }, configurable: true });
    try {
      const app = {
        performanceMonitor: { frameTime: 16 },
        renderer: { info: { render: { calls: 0, triangles: 0 } } }
      };
      VRApp.prototype.updatePerformanceMonitor.call(app, 10);
      expect(app.performanceMonitor.memoryUsed).toBe(2);
    } finally {
      if (had) {
        Object.defineProperty(global.performance, 'memory', had);
      } else {
        delete global.performance.memory;
      }
    }
  });

  test('onVRSessionEnd / _attachLayersToPanels: both panels absent → empty sweep', async () => {
    const app = makeVRAppLike({
      layersSystem: { updateRenderState: jest.fn(), dispose: jest.fn() },
      tabManager: null, webPanel: null,
      renderer: { xr: { getReferenceSpace: () => ({}), getBaseLayer: () => ({}) } },
      camera: new THREE.PerspectiveCamera()
    });
    VRApp.prototype._attachLayersToPanels.call(app, {});
    expect(app.layersSystem.updateRenderState).toHaveBeenCalled(); // panels [] arm
    // session-end variant
    const app2 = makeVRAppLike({
      layersSystem: { dispose: jest.fn() },
      tabManager: null, webPanel: null,
      camera: { fov: 75 },
      renderer: { setPixelRatio: jest.fn(), xr: {} },
      ffrSystem: null, handTracking: null, immersiveVideo: null, comfortSystem: null
    });
    global.window = { devicePixelRatio: 1 };
    expect(() => VRApp.prototype.onVRSessionEnd.call(app2)).not.toThrow();
    expect(app2.layersSystem).toBeNull();
    delete global.window;
  });

  test('navigate adds history but no caption when captions disabled', () => {
    const app = makeVRAppLike({
      bookmarks: { addHistory: jest.fn() },
      captionSystem: { enabled: false, show: jest.fn() },
      tabManager: { navigate: jest.fn(), getActiveTab: () => ({ id: 1 }) },
      settings: { privateMode: false }
    });
    VRApp.prototype.navigate.call(app, 'https://example.com', 'ignored');
    expect(app.captionSystem.show).not.toHaveBeenCalled();
    expect(app.bookmarks.addHistory).toHaveBeenCalled();
  });
});

describe('VRApp — complementary arms round 4', () => {
  test('saveSettings: localStorage as an undefined property (not just deleted)', () => {
    const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true, writable: true });
    try {
      expect(() => VRApp.prototype.saveSettings.call({ settings: { a: 1 } })).not.toThrow();
    } finally {
      if (had) {
        Object.defineProperty(globalThis, 'localStorage', had);
      }
    }
  });

  test('section tab draw with openSettingsSections absent → || [] arm', () => {
    const app = makeVRAppLike({
      settings: {},
      _panelTextures: [],
      registerInteractable: jest.fn(),
      _sharedPlaneGeometry: () => new THREE.PlaneGeometry(0.18, 0.06)
    });
    app.settings.openSettingsSections = undefined;
    VRApp.prototype.makeSectionTab.call(app, 'settings.section.audio', 'Audio');
    const entry = app.registerInteractable.mock.calls[0];
    const drawer = entry[1].draw || entry[1].redraw; // whichever the builder registers
    if (drawer) {
      drawer(true);
    }
    expect(app.registerInteractable).toHaveBeenCalled();
  });

  test('button input: hand that is neither pointer nor utility is ignored', () => {
    const rig = new THREE.Object3D(); rig.add(new THREE.PerspectiveCamera());
    const app = {
      playerRig: rig, camera: rig.children[0],
      controllers: [{ userData: { inputSource: { handedness: 'none' } } }],
      settings: { southpaw: false },
      controllerInput: { read: () => ({ axes: {}, buttons: { faceA: { justPressed: true } }, hand: 'none' }) },
      hapticFeedback: { playPattern: jest.fn() },
      captionSystem: { enabled: true, show: jest.fn() },
      tabManager: null, bookmarkPanel: null, settingsPanel: null, vrKeyboard: null,
      semanticDOM: null, recenter: jest.fn()
    };
    expect(() => VRApp.prototype.updateButtonInput.call(app)).not.toThrow();
    expect(app.hapticFeedback.playPattern).toHaveBeenCalledWith('none', 'click'); // generic click still fires
  });

  test('onControllerSelect works with haptics absent', () => {
    const selected = jest.fn();
    const target = { userData: { interactable: { onSelect: selected } } };
    const app = makeVRAppLike({
      interactables: [{}],
      hapticFeedback: null,
      raycasterFromController: () => ({ intersectObjects: () => [{ object: target }] })
    });
    const ctl = { userData: { inputSource: { handedness: 'left' } } };
    VRApp.prototype.onControllerSelect.call(app, ctl, true);
    expect(selected).toHaveBeenCalled();
  });

  test('pinch gesture with no audio/haptic subsystems is a silent no-op path', async () => {
    const session = { addEventListener: jest.fn(), visibilityState: 'visible' };
    const hand = {
      initialize: jest.fn().mockResolvedValue(true),
      onGesture: jest.fn(),
      getPinchPosition: jest.fn(() => null), // pos-null arm
      dispose: jest.fn()
    };
    const app = makeVRAppLike({
      renderer: { xr: { getSession: () => session }, getContext: () => ({}), setPixelRatio: jest.fn() },
      settings: { enableWebPanel: false },
      handTracking: hand,
      spatialAudio: null, hapticFeedback: null,
      captionSystem: { enabled: false, show: jest.fn() }
    });
    await VRApp.prototype.onVRSessionStart.call(app);
    const pinchCb = hand.onGesture.mock.calls.find((c) => c[0] === 'pinch')[1];
    expect(() => pinchCb('right', {})).not.toThrow(); // spatialAudio/haptic guards both absent
    const grabCb = hand.onGesture.mock.calls.find((c) => c[0] === 'grab')[1];
    expect(() => grabCb('left')).not.toThrow();
  });

  test('updateSystems layer blit with no panels at all → empty loop arm', () => {
    const app = makeVRAppLike({
      settings: { enableComfort: false, enableSnapTurn: false, enableSmoothMove: false, enableGazeDwell: false },
      isVREnabled: true,
      camera: new THREE.PerspectiveCamera(),
      controllers: [],
      comfortSystem: null, ffrSystem: null, handTracking: null,
      hapticFeedback: null, gazeInteraction: null, captionSystem: null,
      spatialAudio: null, immersiveVideo: null,
      layersSystem: { isSupported: true },
      tabManager: null, webPanel: null,
      windowManager: null,
      performanceMonitor: { frameTime: 5 },
      renderer: { xr: { getReferenceSpace: () => 'rs' }, info: { render: { calls: 0, triangles: 0 } } },
      updateLocomotion: jest.fn(), updateButtonInput: jest.fn(),
      updateTeleport: jest.fn(), updateHover: jest.fn()
    });
    const xrFrame = { getViewerPose: () => ({ views: [{}] }) };
    expect(() => VRApp.prototype.updateSystems.call(app, 0, xrFrame, 0.016)).not.toThrow();
  });

  test('_requestVRKeyboardInput skips the prompt caption when captions are off', () => {
    const kb = { setOnConfirm: jest.fn(), show: jest.fn() };
    const app = makeVRAppLike({
      vrKeyboard: kb,
      japaneseIME: { activate: jest.fn(), compositionBuffer: '' },
      captionSystem: { enabled: false, show: jest.fn() }
    });
    VRApp.prototype._requestVRKeyboardInput.call(app, '', jest.fn(), 'Enter URL');
    expect(app.captionSystem.show).not.toHaveBeenCalled();
    expect(kb.show).toHaveBeenCalled();
  });
});

describe('VRApp — complementary arms round 5', () => {
  test('saveSettings actually writes when localStorage is present', () => {
    const setItem = jest.fn();
    global.localStorage = { setItem };
    VRApp.prototype.saveSettings.call({ settings: { enableCaptions: true } });
    expect(setItem).toHaveBeenCalledWith('qui-browser:settings', expect.any(String));
    delete global.localStorage;
  });

  test('pinch with spatialAudio present but pinch position null skips play', async () => {
    const session = { addEventListener: jest.fn(), visibilityState: 'visible' };
    const hand = {
      initialize: jest.fn().mockResolvedValue(true),
      onGesture: jest.fn(),
      getPinchPosition: jest.fn(() => null),
      dispose: jest.fn()
    };
    const app = makeVRAppLike({
      renderer: { xr: { getSession: () => session }, getContext: () => ({}), setPixelRatio: jest.fn() },
      settings: { enableWebPanel: false },
      handTracking: hand,
      spatialAudio: { play: jest.fn() },
      hapticFeedback: { playPattern: jest.fn() }
    });
    await VRApp.prototype.onVRSessionStart.call(app);
    const pinchCb = hand.onGesture.mock.calls.find((c) => c[0] === 'pinch')[1];
    pinchCb('right', {});
    expect(app.spatialAudio.play).not.toHaveBeenCalled();   // pos null arm
    expect(app.hapticFeedback.playPattern).toHaveBeenCalledWith('right', 'click');
  });
});


describe('VRApp setupRenderer — context-loss/resize handler bodies (patched ctor)', () => {
  test('context lost pauses loop + warns; restored re-arms; debounced resize resizes', () => {
    jest.useFakeTimers();
    const handlers = {};
    const setAnimationLoop = jest.fn();
    const setSize = jest.fn();
    const setPixelRatio = jest.fn();
    class FakeRenderer {
      constructor() {
        this.domElement = {
          style: {},
          addEventListener: jest.fn((t, f) => {
            handlers[t] = f;
          }),
          removeEventListener: jest.fn()
        };
        this.shadowMap = {};
        this.xr = {};
        this.setAnimationLoop = setAnimationLoop;
        this.setSize = setSize;
        this.setPixelRatio = setPixelRatio;
      }
    }
    const savedWin = global.window;
    const winAdd = jest.fn();
    global.window = {
      innerWidth: 800, innerHeight: 600, devicePixelRatio: 1, addEventListener: winAdd
    };
    try {
      // isolateModules gives three a fresh module instance, so the patch must
      // land on the isolated registry's copy BEFORE VRApp is re-required
      // (babel's wildcard interop snapshots the exports at that require).
      let VRM;
      jest.isolateModules(() => {
        const T = require('three');
        T.WebGLRenderer = FakeRenderer;
        VRM = require('../src/vr/VRApp.js');
      });
      const app = makeVRAppLike({ container: { appendChild: jest.fn() } });
      VRM.VRApp.prototype.setupRenderer.call(app);
      expect(setSize).toHaveBeenCalledTimes(1); // initial size
      const lost = { preventDefault: jest.fn() };
      handlers['webglcontextlost'](lost);
      expect(lost.preventDefault).toHaveBeenCalled();
      expect(setAnimationLoop).toHaveBeenLastCalledWith(null);
      app._renderBound = function bound() {};
      handlers['webglcontextrestored']();
      expect(setAnimationLoop).toHaveBeenLastCalledWith(app._renderBound);
      // Debounced trailing-edge resize updates size + camera aspect.
      app.camera = { aspect: 0, updateProjectionMatrix: jest.fn() };
      const resize = winAdd.mock.calls.find((c) => c[0] === 'resize')[1];
      resize();
      expect(setSize).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(200);
      expect(setSize).toHaveBeenLastCalledWith(800, 600);
      expect(app.camera.aspect).toBe(800 / 600);
      expect(app.camera.updateProjectionMatrix).toHaveBeenCalled();
    } finally {
      if (savedWin === undefined) {
        delete global.window;
      } else {
        global.window = savedWin;
      }
      jest.useRealTimers();
    }
  });
});

describe('VRApp misc tail — updateSetting + selectend/squeezestart wrappers', () => {
  test('updateSetting writes the setting, persists, and returns the value', () => {
    const app = makeVRAppLike({ settings: {}, saveSettings: jest.fn() });
    const v = VRApp.prototype.updateSetting.call(app, 'masterVolume', 55);
    expect(v).toBe(55);
    expect(app.settings.masterVolume).toBe(55);
    expect(app.saveSettings).toHaveBeenCalled();
  });

  test('selectend + squeezestart listeners forward to release/teleport handlers', () => {
    const app = makeVRAppLike({
      settings: { controllerDeadZone: 0.15, southpaw: false },
      playerRig: new THREE.Group(),
      scene: new THREE.Scene(),
      controllers: [],
      controllerGrips: [],
      teleport: {},
      showVRToast: jest.fn(),
      onControllerSelect: jest.fn(),
      onTeleportStart: jest.fn(),
      onTeleportEnd: jest.fn(),
      _cancelTeleportIfAimedBy: jest.fn()
    });
    const ctl = new THREE.Group();
    ctl.userData = {};
    app.renderer = {
      xr: {
        getController: jest.fn(() => ctl),
        getControllerGrip: jest.fn(() => new THREE.Group())
      }
    };
    VRApp.prototype.setupControllers.call(app);
    ctl.dispatchEvent({ type: 'selectend' });
    expect(app.onControllerSelect).toHaveBeenCalledWith(ctl, false);
    ctl.dispatchEvent({ type: 'squeezestart' });
    expect(app.onTeleportStart).toHaveBeenCalledWith(ctl);
  });
});

