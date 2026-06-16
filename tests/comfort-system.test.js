/**
 * Unit tests for ComfortSystem (VR motion-sickness reduction).
 * THREE is mocked so the vignette/FOV logic can be tested headlessly.
 */

class MockVector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  distanceTo(v) {
    return Math.sqrt(
      (this.x - v.x) ** 2 + (this.y - v.y) ** 2 + (this.z - v.z) ** 2
    );
  }
}

class MockWebGLRenderTarget {
  constructor() { this.dispose = jest.fn(); }
}
class MockPlaneGeometry { dispose() {} }
class MockShaderMaterial {
  constructor(opts) { this.uniforms = opts ? opts.uniforms || {} : {}; this.dispose = jest.fn(); }
}
class MockMesh {
  constructor() {
    this.renderOrder = 0;
    this.frustumCulled = false;
    this.geometry = { dispose: jest.fn() };
    this.material = { dispose: jest.fn() };
  }
}
class MockOrthographicCamera {}

jest.mock('three', () => ({
  Vector3: MockVector3,
  PlaneGeometry: MockPlaneGeometry,
  ShaderMaterial: MockShaderMaterial,
  Mesh: MockMesh,
  OrthographicCamera: MockOrthographicCamera,
  WebGLRenderTarget: MockWebGLRenderTarget,
  MathUtils: {
    degToRad: (d) => d * (Math.PI / 180),
    lerp: (a, b, t) => a + (b - a) * t
  }
}));

// Stub requestAnimationFrame so animateSnapTurn doesn't blow up.
global.requestAnimationFrame = jest.fn();

// Stub window.innerWidth / innerHeight used by WebGLRenderTarget.
global.window = global.window || {};
global.window.innerWidth  = 1280;
global.window.innerHeight = 720;

const { ComfortSystem, resolveComfortPreset, COMFORT_PRESET_KEYS, snapTurnLabel, fireTeleportFeedback, smoothMoveWarning } = require('../src/vr/comfort/ComfortSystem.js');

function makeCamera(fov = 90) {
  return {
    fov,
    position: new MockVector3(0, 1.6, 0),
    rotation: { y: 0 },
    updateProjectionMatrix: jest.fn()
  };
}

function makeScene() { return { add: jest.fn(), remove: jest.fn() }; }
function makeRenderer() { return {}; }

describe('ComfortSystem', () => {
  let system, camera;

  beforeEach(() => {
    camera = makeCamera();
    system = new ComfortSystem(makeScene(), camera, makeRenderer());
  });

  afterEach(() => {
    system.dispose?.();
  });

  // ── construction ─────────────────────────────────────────────────────────────
  test('initialises with default moderate preset', () => {
    expect(system.settings.preset).toBe('moderate');
    expect(system.settings.vignette.enabled).toBe(true);
    expect(system.settings.fov.baseFOV).toBe(90);
  });

  // ── motion detection ─────────────────────────────────────────────────────────
  test('detects movement when camera position changes', () => {
    system.detectMotion(); // baseline
    camera.position.x = 0.5; // move 0.5 m
    system.detectMotion();
    expect(system.isMoving).toBe(true);
  });

  test('not moving when camera is stationary', () => {
    system.detectMotion();
    system.detectMotion(); // second call with same position
    expect(system.isMoving).toBe(false);
  });

  test('detects rotation', () => {
    system.detectMotion();
    camera.rotation.y = 0.05;
    system.detectMotion();
    expect(system.isRotating).toBe(true);
  });

  test('externalMotion flag ORs into isMoving', () => {
    system.detectMotion();
    system.externalMotion = true;
    system.detectMotion(); // position unchanged
    expect(system.isMoving).toBe(true);
  });

  // ── vignette update ───────────────────────────────────────────────────────────
  test('vignette intensity approaches target when moving', () => {
    system.detectMotion();
    camera.position.x = 1.0; // definitely moving
    system.detectMotion();
    const before = system.currentVignette;
    system.updateVignette(0.016);
    expect(system.currentVignette).toBeGreaterThan(before);
  });

  test('vignette fades out when still', () => {
    system.currentVignette = 0.4; // simulate residual vignette
    system.isMoving = false;
    system.isRotating = false;
    system.updateVignette(0.016);
    expect(system.currentVignette).toBeLessThan(0.4);
  });

  // ── FOV update ────────────────────────────────────────────────────────────────
  test('FOV narrows when moving', () => {
    system.isMoving = true;
    system.currentFOV = 90;
    system.updateFOV(0.016);
    expect(system.currentFOV).toBeLessThan(90);
  });

  test('camera updateProjectionMatrix called after FOV change', () => {
    system.isMoving = true;
    system.updateFOV(0.016);
    expect(camera.updateProjectionMatrix).toHaveBeenCalled();
  });

  // ── presets ───────────────────────────────────────────────────────────────────
  test('setPreset("sensitive") increases vignette intensity', () => {
    const before = system.settings.vignette.intensity;
    system.setPreset('sensitive');
    expect(system.settings.vignette.intensity).toBeGreaterThan(before);
  });

  test('setPreset("disabled") disables vignette and FOV effects', () => {
    system.setPreset('disabled');
    expect(system.settings.vignette.enabled).toBe(false);
    expect(system.settings.fov.enabled).toBe(false);
  });

  test('setPreset ignores unknown preset', () => {
    const before = system.settings.preset;
    system.setPreset('nonexistent');
    expect(system.settings.preset).toBe(before);
  });

  // ── snap turn ─────────────────────────────────────────────────────────────────
  test('handleSnapTurn triggers requestAnimationFrame', () => {
    system.handleSnapTurn(1);
    expect(global.requestAnimationFrame).toHaveBeenCalled();
  });

  test('smooth turn when snapTurn disabled', () => {
    system.settings.snapTurn.enabled = false;
    const before = camera.rotation.y;
    system.handleSnapTurn(1);
    expect(camera.rotation.y).not.toBe(before);
  });
});

describe('ComfortSystem — prefers-reduced-motion', () => {
  // ── animateSnapTurn ───────────────────────────────────────────────────────────
  test('default: snap-turn animation defers rotation to rAF (not synchronous)', () => {
    const cam = makeCamera();
    const cs = new ComfortSystem(makeScene(), cam, makeRenderer());
    cam.rotation.y = 0;
    global.requestAnimationFrame.mockClear();
    cs.animateSnapTurn(Math.PI / 2);
    // The first rAF tick lerps by t=0, so rotation stays at startRotation.
    expect(cam.rotation.y).toBe(0);
    expect(global.requestAnimationFrame).toHaveBeenCalled();
  });

  test('reduceMotion=true: snap turn applies immediately, no rAF queued', () => {
    const cam = makeCamera();
    const cs = new ComfortSystem(makeScene(), cam, makeRenderer(), { reduceMotion: true });
    cam.rotation.y = 0;
    global.requestAnimationFrame.mockClear();
    cs.animateSnapTurn(Math.PI / 2);
    expect(cam.rotation.y).toBeCloseTo(Math.PI / 2, 10);
    expect(global.requestAnimationFrame).not.toHaveBeenCalled();
  });

  test('reduceMotion=true: negative snap applies immediately', () => {
    const cam = makeCamera();
    const cs = new ComfortSystem(makeScene(), cam, makeRenderer(), { reduceMotion: true });
    cam.rotation.y = Math.PI;
    cs.animateSnapTurn(-Math.PI / 4);
    expect(cam.rotation.y).toBeCloseTo(Math.PI - Math.PI / 4, 10);
  });

  // ── updateFOV ─────────────────────────────────────────────────────────────────
  // FOV reduction (tunnelling) is a comfort aid that LOWERS sickness, so it must
  // stay enabled for reduced-motion users — they benefit most. Only the eased
  // snap-turn rotation is suppressed, never the comfort FOV.
  test('reduceMotion=true: FOV reduction stays ON while moving (comfort aid)', () => {
    const cam = makeCamera(90);
    const cs = new ComfortSystem(makeScene(), cam, makeRenderer(), { reduceMotion: true });
    cs.isMoving = true;
    cs.currentFOV = 90;
    cs.updateFOV(0.016);
    // Tunnelling must still narrow the FOV for the vestibular-sensitive cohort.
    expect(cam.fov).toBeLessThan(90);
    expect(cam.updateProjectionMatrix).toHaveBeenCalled();
  });
});

describe('resolveComfortPreset — OS reduced-motion pre-selects protective preset', () => {
  test('no signal, no persisted choice → moderate default', () => {
    expect(resolveComfortPreset()).toBe('moderate');
    expect(resolveComfortPreset({ reducedMotion: false, persisted: null })).toBe('moderate');
  });

  test('OS prefers-reduced-motion → most protective preset (sensitive)', () => {
    expect(resolveComfortPreset({ reducedMotion: true })).toBe('sensitive');
  });

  test('explicit persisted choice always wins over the OS signal', () => {
    // User deliberately picked a lighter preset despite the OS flag — respect it.
    expect(resolveComfortPreset({ reducedMotion: true, persisted: 'tolerant' })).toBe('tolerant');
    expect(resolveComfortPreset({ reducedMotion: true, persisted: 'disabled' })).toBe('disabled');
    expect(resolveComfortPreset({ reducedMotion: false, persisted: 'sensitive' })).toBe('sensitive');
  });

  test('invalid persisted value is ignored, falling through to the signal/default', () => {
    expect(resolveComfortPreset({ reducedMotion: true, persisted: 'garbage' })).toBe('sensitive');
    expect(resolveComfortPreset({ reducedMotion: false, persisted: 'garbage' })).toBe('moderate');
  });

  test('sensitive is genuinely the most protective key in the ordered list', () => {
    expect(COMFORT_PRESET_KEYS[0]).toBe('sensitive');
    expect(COMFORT_PRESET_KEYS).toContain('moderate');
  });
});

describe('snapTurnLabel — directional caption for reduced-motion orientation cue', () => {
  test('positive direction = clockwise = Right with arrow', () => {
    expect(snapTurnLabel(1, 30)).toBe('↻ Right 30°');
  });

  test('negative direction = counter-clockwise = Left with arrow', () => {
    expect(snapTurnLabel(-1, 30)).toBe('↺ Left 30°');
  });

  test('angle is included verbatim so users know the step size', () => {
    expect(snapTurnLabel(1, 45)).toBe('↻ Right 45°');
    expect(snapTurnLabel(-1, 15)).toBe('↺ Left 15°');
  });

  test('arrows are semantically distinct (not the same glyph)', () => {
    expect(snapTurnLabel(1, 30)[0]).not.toBe(snapTurnLabel(-1, 30)[0]);
  });
});

describe('fireTeleportFeedback — landing haptic + caption', () => {
  function makeHaptic() {
    return { playPattern: jest.fn() };
  }
  function makeCaptions(enabled = true) {
    return { enabled, show: jest.fn() };
  }
  function makeController(handedness = 'left') {
    return { userData: { inputSource: { handedness } } };
  }

  test('fires impact haptic on the controller hand', () => {
    const haptic = makeHaptic();
    fireTeleportFeedback(makeController('left'), haptic, null);
    expect(haptic.playPattern).toHaveBeenCalledWith('left', 'impact');
  });

  test('falls back to "right" when controller has no handedness', () => {
    const haptic = makeHaptic();
    fireTeleportFeedback(null, haptic, null);
    expect(haptic.playPattern).toHaveBeenCalledWith('right', 'impact');
  });

  test('shows "Teleported" caption when captions are enabled', () => {
    const captions = makeCaptions(true);
    fireTeleportFeedback(null, null, captions);
    expect(captions.show).toHaveBeenCalledWith('Teleported');
  });

  test('caption suppressed when captions are disabled', () => {
    const captions = makeCaptions(false);
    fireTeleportFeedback(null, null, captions);
    expect(captions.show).not.toHaveBeenCalled();
  });

  test('no error when both haptic and captions are null (invalid teleport path)', () => {
    expect(() => fireTeleportFeedback(null, null, null)).not.toThrow();
  });

  test('haptic pattern is "impact" not "click" — heavier for a spatial jump', () => {
    const haptic = makeHaptic();
    fireTeleportFeedback(makeController('right'), haptic, null);
    const [, pattern] = haptic.playPattern.mock.calls[0];
    expect(pattern).toBe('impact');
    expect(pattern).not.toBe('click');
  });
});

describe('smoothMoveWarning — caution when enabling under prefers-reduced-motion', () => {
  test('enabling under reduceMotion → returns a non-null warning string', () => {
    const msg = smoothMoveWarning(true, true);
    expect(msg).not.toBeNull();
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  test('warning mentions motion sickness so the user understands the risk', () => {
    expect(smoothMoveWarning(true, true)).toMatch(/motion sickness/i);
  });

  test('disabling under reduceMotion → no warning (turning off is always safe)', () => {
    expect(smoothMoveWarning(false, true)).toBeNull();
  });

  test('enabling without reduceMotion → no warning (non-sensitive user)', () => {
    expect(smoothMoveWarning(true, false)).toBeNull();
  });

  test('disabling without reduceMotion → no warning', () => {
    expect(smoothMoveWarning(false, false)).toBeNull();
  });
});
