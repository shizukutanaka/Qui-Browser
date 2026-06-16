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

const { ComfortSystem } = require('../src/vr/comfort/ComfortSystem.js');

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
  test('reduceMotion=true: FOV never modified even while moving', () => {
    const cam = makeCamera(90);
    const cs = new ComfortSystem(makeScene(), cam, makeRenderer(), { reduceMotion: true });
    cs.isMoving = true;
    cs.currentFOV = 90;
    cs.updateFOV(0.016);
    expect(cam.fov).toBe(90);
    expect(cam.updateProjectionMatrix).not.toHaveBeenCalled();
  });

  test('reduceMotion=true: FOV not modified when stationary either', () => {
    const cam = makeCamera(90);
    const cs = new ComfortSystem(makeScene(), cam, makeRenderer(), { reduceMotion: true });
    cs.isMoving = false;
    cs.updateFOV(0.016);
    expect(cam.fov).toBe(90);
    expect(cam.updateProjectionMatrix).not.toHaveBeenCalled();
  });
});
