/**
 * Unit tests for ComfortSystem (VR motion-sickness reduction).
 * THREE and document.createElement('canvas') are mocked so the
 * camera-parented vignette logic can be tested headlessly.
 */

class MockVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
  }
  copy(v) {
    this.x = v.x; this.y = v.y; this.z = v.z; return this;
  }
  distanceTo(v) {
    return Math.sqrt(
      (this.x - v.x) ** 2 + (this.y - v.y) ** 2 + (this.z - v.z) ** 2
    );
  }
}

class MockCanvasTexture {
  constructor(canvas) {
    this.image = canvas;
  }
  dispose() {}
}
class MockPlaneGeometry {
  dispose() {}
}
class MockMeshBasicMaterial {
  constructor(opts) {
    Object.assign(this, opts);
    this.dispose = jest.fn();
  }
}
class MockMesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.position = { x: 0, y: 0, z: 0 };
    this.renderOrder = 0;
    this.frustumCulled = true;
    this.visible = true;
  }
}

jest.mock('three', () => ({
  Vector3: MockVector3,
  CanvasTexture: MockCanvasTexture,
  MeshBasicMaterial: MockMeshBasicMaterial,
  Mesh: MockMesh,
  PlaneGeometry: MockPlaneGeometry,
  MathUtils: {
    degToRad: (d) => d * (Math.PI / 180),
    lerp: (a, b, t) => a + (b - a) * t
  }
}));

// Minimal document stub — createElement('canvas') for the vignette gradient;
// documentElement/querySelectorAll because i18n's setLanguage touches them.
global.document = {
  documentElement: { lang: 'en' },
  querySelectorAll: () => [],
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => ({
      createRadialGradient: () => ({ addColorStop: jest.fn() }),
      fillRect: jest.fn(),
      set fillStyle(_v) {}
    })
  })
};

const { ComfortSystem, resolveComfortPreset, COMFORT_PRESET_KEYS, snapTurnLabel, fireTeleportFeedback, smoothMoveWarning } = require('../src/vr/comfort/ComfortSystem.js');

function makeCamera(fov = 90) {
  return {
    fov,
    position: new MockVector3(0, 1.6, 0),
    rotation: { y: 0 },
    add: jest.fn(),
    remove: jest.fn(),
    updateProjectionMatrix: jest.fn()
  };
}

describe('ComfortSystem', () => {
  let system, camera;

  beforeEach(() => {
    camera = makeCamera();
    system = new ComfortSystem(camera);
  });

  afterEach(() => {
    system.dispose?.();
  });

  // ── construction ─────────────────────────────────────────────────────────────
  test('initialises with default moderate preset', () => {
    expect(system.settings.preset).toBe('moderate');
    expect(system.settings.vignette.enabled).toBe(true);
  });

  test('parents the vignette quad to the camera, hidden until motion', () => {
    expect(camera.add).toHaveBeenCalledWith(system.vignetteMesh);
    expect(system.vignetteMesh.visible).toBe(false);
    expect(system.vignetteMaterial.opacity).toBe(0);
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

  test('updateVignette writes opacity to the quad material', () => {
    system.currentVignette = 0.35;
    system.isMoving = true;
    system.updateVignette(0.016);
    expect(system.vignetteMaterial.opacity).toBe(system.currentVignette);
    expect(system.vignetteMesh.visible).toBe(true);
  });

  test('quad hides again once the vignette has fully faded', () => {
    system.currentVignette = 0.005; // below the visible threshold
    system.isMoving = false;
    system.isRotating = false;
    system.updateVignette(0.016);
    expect(system.vignetteMesh.visible).toBe(false);
  });

  // ── speed-proportional (adaptive) vignette ──────────────────────────────────
  // The vignette target scales with actual glide speed (externalMotionLevel)
  // rather than snapping to full strength for any smooth locomotion at all —
  // over-restricting the periphery during slow drift is itself a comfort cost
  // (adaptive FOV restriction, VRST '22; adaptive FFR+FoV, arXiv:2502.03419).
  test('externalMotionLevel=0.5 halves the vignette target vs full deflection', () => {
    system.settings.vignette.smoothing = 1; // snap straight to target
    system.settings.vignette.intensity = 0.4;
    system._headMoving = false;
    system.isRotating = false;
    system.externalMotion = true;
    system.externalMotionLevel = 0.5;
    system.currentVignette = 0;
    system.updateVignette(0.016);
    expect(system.currentVignette).toBeCloseTo(0.2, 5);
  });

  test('backward compatible: externalMotion=true with default level (1) is full intensity', () => {
    system.settings.vignette.smoothing = 1;
    system.settings.vignette.intensity = 0.4;
    system._headMoving = false;
    system.isRotating = false;
    system.externalMotion = true;
    // externalMotionLevel left at its constructor default of 1
    system.currentVignette = 0;
    system.updateVignette(0.016);
    expect(system.currentVignette).toBeCloseTo(0.4, 5);
  });

  test('externalMotionLevel=0 contributes nothing when the head is otherwise still', () => {
    system.settings.vignette.smoothing = 1;
    system._headMoving = false;
    system.isRotating = false;
    system.externalMotion = true;
    system.externalMotionLevel = 0;
    system.currentVignette = 0;
    system.updateVignette(0.016);
    expect(system.currentVignette).toBe(0);
  });

  test('fast head motion applies full vignette regardless of externalMotionLevel', () => {
    system.settings.vignette.smoothing = 1;
    system.settings.vignette.intensity = 0.4;
    system._headLevel = 1; // measured fast head turn (see kinematic tests below)
    system.externalMotion = true;
    system.externalMotionLevel = 0; // even with zero glide speed
    system.currentVignette = 0;
    system.updateVignette(0.016);
    expect(system.currentVignette).toBeCloseTo(0.4, 5);
  });

  test('externalMotionLevel is clamped to [0,1]', () => {
    system.settings.vignette.smoothing = 1;
    system.settings.vignette.intensity = 0.4;
    system._headMoving = false;
    system.isRotating = false;
    system.externalMotion = true;
    system.externalMotionLevel = 5; // absurd → clamps to 1
    system.currentVignette = 0;
    system.updateVignette(0.016);
    expect(system.currentVignette).toBeCloseTo(0.4, 5);
  });

  test('externalMotionLevel defaults to 1 at construction', () => {
    expect(system.externalMotionLevel).toBe(1);
  });

  // ── presets ───────────────────────────────────────────────────────────────────
  test('setPreset("sensitive") increases vignette intensity', () => {
    const before = system.settings.vignette.intensity;
    system.setPreset('sensitive');
    expect(system.settings.vignette.intensity).toBeGreaterThan(before);
  });

  test('setPreset("disabled") disables the vignette', () => {
    system.setPreset('disabled');
    expect(system.settings.vignette.enabled).toBe(false);
  });

  test('setPreset ignores unknown preset', () => {
    const before = system.settings.preset;
    system.setPreset('nonexistent');
    expect(system.settings.preset).toBe(before);
  });

  test('switching from "disabled" back to a protective preset re-enables it', () => {
    // Regression: Object.assign-merged presets that omit `enabled: true` left a
    // user who picked "disabled" then switched to a protective preset with NO
    // comfort mitigation — the opposite of their request.
    system.setPreset('disabled');
    expect(system.settings.vignette.enabled).toBe(false);

    system.setPreset('sensitive');
    expect(system.settings.vignette.enabled).toBe(true);
    // …and the protective value is applied, not just re-enabled.
    expect(system.settings.vignette.intensity).toBeCloseTo(0.8, 5);
  });

  test('every non-disabled preset explicitly enables the vignette', () => {
    for (const preset of ['sensitive', 'moderate', 'tolerant']) {
      system.setPreset('disabled');     // force it off first
      system.setPreset(preset);         // then switch in
      expect(system.settings.vignette.enabled).toBe(true);
    }
  });
});

describe('ComfortSystem update() + dispose()', () => {
  test('update() is a no-op when the camera was cleared', () => {
    const sys = new ComfortSystem(makeCamera());
    sys.camera = null; // e.g. session ended; update must not throw
    sys.settings.vignette.enabled = true;
    expect(() => sys.update(0.016)).not.toThrow();
    sys.dispose?.();
  });

  test('update() drives detectMotion + vignette when enabled', () => {
    const camera = makeCamera();
    const sys = new ComfortSystem(camera);
    sys.settings.vignette.enabled = true;
    const dm = jest.spyOn(sys, 'detectMotion');
    const uv = jest.spyOn(sys, 'updateVignette');
    sys.update(0.016);
    expect(dm).toHaveBeenCalled();
    expect(uv).toHaveBeenCalled();
    sys.dispose?.();
  });

  test('update() skips the vignette stage when its flag is off', () => {
    const camera = makeCamera();
    const sys = new ComfortSystem(camera);
    sys.settings.vignette.enabled = false;
    const uv = jest.spyOn(sys, 'updateVignette');
    sys.update(0.016);
    expect(uv).not.toHaveBeenCalled();
    sys.dispose?.();
  });

  test('updateVignette without vignetteMaterial does not throw', () => {
    const cs = new ComfortSystem(makeCamera());
    cs.vignetteMaterial = null;
    expect(() => cs.updateVignette?.(0.5)).not.toThrow();
    cs.dispose();
  });

  test('dispose frees the quad geometry, material, and texture and detaches it', () => {
    const cam = makeCamera();
    const cs = new ComfortSystem(cam);
    const geo = cs.vignetteMesh.geometry;
    geo.dispose = jest.fn();
    cs.vignetteTexture.dispose = jest.fn();
    cs.dispose();
    expect(cam.remove).toHaveBeenCalledWith(cs.vignetteMesh);
    expect(geo.dispose).toHaveBeenCalled();
    expect(cs.vignetteMaterial.dispose).toHaveBeenCalled();
    expect(cs.vignetteTexture.dispose).toHaveBeenCalled();
  });

  test('dispose tolerates missing resources', () => {
    const cs = new ComfortSystem(makeCamera());
    cs.vignetteMesh = null;
    cs.vignetteMaterial = null;
    cs.vignetteTexture = null;
    expect(() => cs.dispose()).not.toThrow();
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

  test('direction words are localised (vr.value.left/right)', () => {
    const { setLanguage } = require('../src/i18n/i18n.js');
    setLanguage('ja');
    expect(snapTurnLabel(1, 30)).toBe('↻ 右 30°');
    expect(snapTurnLabel(-1, 30)).toBe('↺ 左 30°');
    setLanguage('en');
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

  test('warning is localised (Japanese catalog)', () => {
    const { setLanguage } = require('../src/i18n/i18n.js');
    setLanguage('ja');
    expect(smoothMoveWarning(true, true)).toBe('スムーズ移動は酔いを引き起こすことがあります');
    setLanguage('en');
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


describe('ComfortSystem — kinematic head scaling (arXiv:2502.03419)', () => {
  let system, camera;
  beforeEach(() => {
    camera = makeCamera();
    system = new ComfortSystem(camera);
    system.settings.vignette.smoothing = 1; // snap to target for assertions
    system.settings.vignette.intensity = 0.4;
    system.callbacks = {};
  });
  afterEach(() => {
    system.dispose?.();
  });

  test('a fast head turn measures full level and drives full vignette', () => {
    system.detectMotion(1 / 60);            // baseline
    camera.rotation.y = 0.15;               // ~8.6° in one 60 Hz frame ≈ 515°/s
    system.detectMotion(1 / 60);
    expect(system._headLevel).toBe(1);
    system.currentVignette = 0;
    system.updateVignette(0.016);
    expect(system.currentVignette).toBeCloseTo(0.4, 5);
  });

  test('a slow gaze shift contributes nothing — the old 1 mm flag over-fired', () => {
    system.detectMotion(1 / 60);
    camera.rotation.y = 0.002;              // ~6.9°/s — reading-scan speed
    system.detectMotion(1 / 60);
    expect(system.isRotating).toBe(true);   // flag still reports any motion
    expect(system._headLevel).toBe(0);      // but it must not restrict the view
    system.currentVignette = 0;
    system.updateVignette(0.016);
    expect(system.currentVignette).toBe(0);
  });

  test('mid-range head motion scales the vignette proportionally', () => {
    system.detectMotion(1 / 60);
    camera.rotation.y = 0.026;              // ~90°/s — inside the 45–240°/s ramp
    system.detectMotion(1 / 60);
    const level = system._headLevel;
    expect(level).toBeGreaterThan(0);
    expect(level).toBeLessThan(1);
    system.currentVignette = 0;
    system.updateVignette(0.016);
    expect(system.currentVignette).toBeCloseTo(0.4 * level, 5);
  });

  test('a slow lean stays under the translation ramp', () => {
    system.detectMotion(1 / 60);
    camera.position.x = 0.002;              // ~0.12 m/s — below the 0.15 m/s floor
    system.detectMotion(1 / 60);
    expect(system.isMoving).toBe(true);     // flag still sees the delta
    expect(system._headLevel).toBe(0);
  });

  test('a deliberate step contributes at the translation ramp', () => {
    system.detectMotion(1 / 60);
    camera.position.x = 0.014;              // ~0.84 m/s — past the 0.8 m/s ceiling
    system.detectMotion(1 / 60);
    expect(system._headLevel).toBe(1);
  });

  test('frame dt is honored — the same delta at half the rate halves the speed', () => {
    system.detectMotion(1 / 60);
    camera.rotation.y = 0.026;
    system.detectMotion(1 / 30);            // same Δ over twice the time
    expect(system._headLevel).toBe(0);      // ~45°/s — at the ramp floor
  });

  test('external locomotion still wins when it exceeds the head level', () => {
    system._headLevel = 0.4;
    system.externalMotion = true;
    system.externalMotionLevel = 0.75;
    system.currentVignette = 0;
    system.updateVignette(0.016);
    expect(system.currentVignette).toBeCloseTo(0.4 * 0.75, 5);
  });
});
