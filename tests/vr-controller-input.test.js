/**
 * Unit tests for VRControllerInput — pure logic, no DOM or Three.js.
 * Covers: profile detection, device naming, axis dead-zone, button state
 * diffing (justPressed / justReleased), southpaw no-op, and forget().
 */

const { VRControllerInput, PROFILE_MAP, BUTTON_MAPS, AXES_MAPS, applyRadialDeadZone } = require('../src/vr/input/VRControllerInput.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSource(profiles = [], handedness = 'right', buttons = [], axes = []) {
  return {
    profiles,
    handedness,
    gamepad: { buttons, axes },
  };
}

function makeButtons(count, pressed = []) {
  return Array.from({ length: count }, (_, i) => ({
    pressed: pressed.includes(i),
    value:   pressed.includes(i) ? 1 : 0,
  }));
}

// ---------------------------------------------------------------------------
// PROFILE_MAP / detectFamily
// ---------------------------------------------------------------------------

describe('VRControllerInput.detectFamily', () => {
  let ci;
  beforeEach(() => { ci = new VRControllerInput(); });

  test('detects meta-quest from oculus-touch-v3', () => {
    const src = makeSource(['oculus-touch-v3'], 'right');
    expect(ci.detectFamily(src)).toBe('meta-quest');
  });

  test('detects meta-quest from oculus-touch-v2', () => {
    expect(ci.detectFamily(makeSource(['oculus-touch-v2']))).toBe('meta-quest');
  });

  test('detects pico from pico-4', () => {
    expect(ci.detectFamily(makeSource(['pico-4']))).toBe('pico');
  });

  test('detects pico from pico-neo3', () => {
    expect(ci.detectFamily(makeSource(['pico-neo3']))).toBe('pico');
  });

  test('detects valve-index', () => {
    expect(ci.detectFamily(makeSource(['valve-index']))).toBe('valve-index');
  });

  test('detects htc-vive', () => {
    expect(ci.detectFamily(makeSource(['htc-vive']))).toBe('htc-vive');
  });

  test('detects wmr from microsoft-mixed-reality', () => {
    expect(ci.detectFamily(makeSource(['microsoft-mixed-reality']))).toBe('wmr');
  });

  test('first matching profile wins (meta preferred over generic)', () => {
    expect(ci.detectFamily(makeSource(['oculus-touch-v3', 'generic-trigger']))).toBe('meta-quest');
  });

  test('unknown profile falls back to generic', () => {
    expect(ci.detectFamily(makeSource(['future-headset-v99']))).toBe('generic');
  });

  test('empty profiles falls back to generic', () => {
    expect(ci.detectFamily(makeSource([]))).toBe('generic');
  });

  test('null input source falls back to generic', () => {
    expect(ci.detectFamily(null)).toBe('generic');
  });
});

// ---------------------------------------------------------------------------
// getDeviceName
// ---------------------------------------------------------------------------

describe('VRControllerInput.getDeviceName', () => {
  let ci;
  beforeEach(() => { ci = new VRControllerInput(); });

  test('returns Meta Quest label with handedness', () => {
    const src = makeSource(['oculus-touch-v3'], 'right');
    expect(ci.getDeviceName(src)).toBe('Meta Quest Controller (right)');
  });

  test('returns Pico label', () => {
    expect(ci.getDeviceName(makeSource(['pico-4'], 'left'))).toBe('Pico Controller (left)');
  });

  test('returns generic label for unknown device', () => {
    expect(ci.getDeviceName(makeSource(['future-headset'], 'right'))).toBe('Controller (right)');
  });

  test('handles null gracefully', () => {
    expect(ci.getDeviceName(null)).toContain('Controller');
  });
});

// ---------------------------------------------------------------------------
// read — axes + dead-zone
// ---------------------------------------------------------------------------

describe('VRControllerInput.read — axes', () => {
  let ci;
  beforeEach(() => { ci = new VRControllerInput({ deadZone: 0.15 }); });

  test('returns stickX and stickY for meta-quest (axes 2,3)', () => {
    const src = makeSource(['oculus-touch-v3'], 'right', makeButtons(7), [0, 0, 0.8, -0.6]);
    const snap = ci.read(src);
    expect(snap.axes.stickX).toBeCloseTo(0.8);
    expect(snap.axes.stickY).toBeCloseTo(-0.6);
  });

  test('dead-zone zeroes small axis values', () => {
    const src = makeSource(['oculus-touch-v3'], 'right', makeButtons(7), [0, 0, 0.10, 0.05]);
    const snap = ci.read(src);
    expect(snap.axes.stickX).toBe(0);
    expect(snap.axes.stickY).toBe(0);
  });

  test('axis exactly at dead-zone threshold is zeroed', () => {
    const src = makeSource(['oculus-touch-v3'], 'right', makeButtons(7), [0, 0, 0.15, 0]);
    const snap = ci.read(src);
    expect(snap.axes.stickX).toBe(0);
  });

  test('axis just above dead-zone eases in from ~0 (smooth onset, no cliff)', () => {
    // Scaled radial dead zone: at 0.16 (just past the 0.15 edge) the output is
    // re-normalised to ((0.16-0.15)/(1-0.15)) ≈ 0.012, NOT the raw 0.16. This
    // removes the jump-to-0.15 cliff the old per-axis clamp produced.
    const src = makeSource(['oculus-touch-v3'], 'right', makeButtons(7), [0, 0, 0.16, 0]);
    const snap = ci.read(src);
    expect(snap.axes.stickX).toBeGreaterThan(0);
    expect(snap.axes.stickX).toBeLessThan(0.05); // eased, far below the raw 0.16
  });

  test('full deflection still yields full magnitude (no max-speed regression)', () => {
    // (0.8, -0.6) has magnitude 1.0, so re-normalisation leaves it unchanged.
    const src = makeSource(['oculus-touch-v3'], 'right', makeButtons(7), [0, 0, 0.8, -0.6]);
    const snap = ci.read(src);
    expect(Math.hypot(snap.axes.stickX, snap.axes.stickY)).toBeCloseTo(1.0, 3);
  });

  test('generic profile reads stickX from axes[0]', () => {
    const src = makeSource(['generic-trigger'], 'right', makeButtons(2), [0.9, 0.4]);
    const snap = ci.read(src);
    expect(snap.axes.stickX).toBeCloseTo(0.9);
    expect(snap.axes.stickY).toBeCloseTo(0.4);
  });

  test('valve-index exposes both trackpad and stick pairs (dead-zoned independently)', () => {
    // Both X/Y pairs are present and dead-zoned as separate 2D vectors. The
    // re-normalised magnitudes are slightly below the raw inputs, but each pair
    // keeps its own direction — the point of this test is the exposed key set.
    const src = makeSource(['valve-index'], 'right', makeButtons(7), [0.5, -0.5, 0.8, 0.3]);
    const snap = ci.read(src);
    expect(snap.axes).toHaveProperty('trackpadX');
    expect(snap.axes).toHaveProperty('trackpadY');
    expect(snap.axes).toHaveProperty('stickX');
    expect(snap.axes).toHaveProperty('stickY');
    // Trackpad pushed down-right: x>0, y<0 direction preserved.
    expect(snap.axes.trackpadX).toBeGreaterThan(0);
    expect(snap.axes.trackpadY).toBeLessThan(0);
    // Stick pushed up-right: x>0, y>0 direction preserved.
    expect(snap.axes.stickX).toBeGreaterThan(0);
    expect(snap.axes.stickY).toBeGreaterThan(0);
  });

  test('missing axes default to 0', () => {
    const src = makeSource(['oculus-touch-v3'], 'right', makeButtons(7), []);
    const snap = ci.read(src);
    expect(snap.axes.stickX).toBe(0);
    expect(snap.axes.stickY).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// read — button state and edge-triggers
// ---------------------------------------------------------------------------

describe('VRControllerInput.read — buttons', () => {
  let ci;
  beforeEach(() => { ci = new VRControllerInput(); });

  test('pressed is true when button held', () => {
    // faceA = buttons[4] for meta-quest
    const src = makeSource(['oculus-touch-v3'], 'right', makeButtons(7, [4]), [0,0,0,0]);
    const snap = ci.read(src);
    expect(snap.buttons.faceA.pressed).toBe(true);
  });

  test('justPressed is true on first frame button is held', () => {
    const src = makeSource(['oculus-touch-v3'], 'right', makeButtons(7, [4]), [0,0,0,0]);
    const snap = ci.read(src);
    expect(snap.buttons.faceA.justPressed).toBe(true);
  });

  test('justPressed is false on subsequent frames with button still held', () => {
    const src = makeSource(['oculus-touch-v3'], 'right', makeButtons(7, [4]), [0,0,0,0]);
    ci.read(src); // frame 1 — justPressed
    const snap2 = ci.read(src); // frame 2 — held
    expect(snap2.buttons.faceA.justPressed).toBe(false);
    expect(snap2.buttons.faceA.pressed).toBe(true);
  });

  test('justReleased is true on the frame button is released', () => {
    const srcPressed  = makeSource(['oculus-touch-v3'], 'right', makeButtons(7, [4]), [0,0,0,0]);
    const srcReleased = { ...srcPressed, gamepad: { buttons: makeButtons(7, []), axes: [0,0,0,0] } };

    // Need same object reference for WeakMap.
    ci.read(srcPressed);                // frame 1: justPressed
    ci.read(srcPressed);                // frame 2: held
    // swap button state on same object
    srcPressed.gamepad.buttons = makeButtons(7, []);
    const snap3 = ci.read(srcPressed);  // frame 3: justReleased
    expect(snap3.buttons.faceA.justReleased).toBe(true);
    expect(snap3.buttons.faceA.pressed).toBe(false);
  });

  test('all buttons released on first read have justPressed=false', () => {
    const src = makeSource(['oculus-touch-v3'], 'right', makeButtons(7, []), [0,0,0,0]);
    const snap = ci.read(src);
    for (const b of Object.values(snap.buttons)) {
      expect(b.justPressed).toBe(false);
    }
  });

  test('trigger button index 0 is mapped', () => {
    const src = makeSource(['oculus-touch-v3'], 'right', makeButtons(7, [0]), [0,0,0,0]);
    const snap = ci.read(src);
    expect(snap.buttons.trigger?.pressed).toBe(true);
  });

  test('menu button index 6 is mapped for meta-quest', () => {
    const src = makeSource(['oculus-touch-v3'], 'left', makeButtons(7, [6]), [0,0,0,0]);
    const snap = ci.read(src);
    expect(snap.buttons.menu?.pressed).toBe(true);
  });

  test('htc-vive has no faceA mapping', () => {
    const src = makeSource(['htc-vive'], 'right', makeButtons(5, []), [0,0,0,0]);
    const snap = ci.read(src);
    expect(snap.buttons.faceA).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// read — family / hand in snapshot
// ---------------------------------------------------------------------------

describe('VRControllerInput.read — family and hand', () => {
  let ci;
  beforeEach(() => { ci = new VRControllerInput(); });

  test('snapshot includes correct family', () => {
    const src = makeSource(['pico-4'], 'left', makeButtons(7), [0,0,0,0]);
    expect(ci.read(src).family).toBe('pico');
  });

  test('snapshot includes correct hand', () => {
    const src = makeSource(['oculus-touch-v3'], 'right', makeButtons(7), [0,0,0,0]);
    expect(ci.read(src).hand).toBe('right');
  });

  test('no-gamepad source returns empty snapshot', () => {
    const src = { profiles: ['oculus-touch-v3'], handedness: 'left' }; // no .gamepad
    const snap = ci.read(src);
    expect(snap.axes.stickX).toBe(0);
    expect(Object.keys(snap.buttons)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// forget
// ---------------------------------------------------------------------------

describe('VRControllerInput.forget', () => {
  let ci;
  beforeEach(() => { ci = new VRControllerInput(); });

  test('after forget, next read has justPressed=true again for held button', () => {
    const src = makeSource(['oculus-touch-v3'], 'right', makeButtons(7, [4]), [0,0,0,0]);
    ci.read(src);       // frame 1 — justPressed captured
    ci.forget(src);     // wipe state
    const snap = ci.read(src); // new "first" frame
    expect(snap.buttons.faceA.justPressed).toBe(true);
  });

  test('forget on null does not throw', () => {
    expect(() => ci.forget(null)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// southpaw (constructor option forwarded from VRControllerInput)
// ---------------------------------------------------------------------------

describe('VRControllerInput southpaw option', () => {
  test('southpaw flag is stored', () => {
    const ci = new VRControllerInput({ southpaw: true });
    expect(ci.southpaw).toBe(true);
  });

  test('southpaw false by default', () => {
    const ci = new VRControllerInput();
    expect(ci.southpaw).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyRadialDeadZone — pure scaled-radial dead-zone curve
// ---------------------------------------------------------------------------

describe('applyRadialDeadZone', () => {
  const DZ = 0.15;

  test('zeroes a vector whose magnitude is within the dead zone', () => {
    const r = applyRadialDeadZone(0.1, 0.0, DZ);
    expect(r).toEqual({ x: 0, y: 0 });
  });

  test('zeroes exactly at the dead-zone edge', () => {
    expect(applyRadialDeadZone(0.15, 0, DZ)).toEqual({ x: 0, y: 0 });
  });

  test('circular region: a diagonal push past the radius registers even when each axis is below it', () => {
    // (0.12, 0.12): each axis < 0.15 (an axial clamp would zero it), but the
    // magnitude is ~0.17 > 0.15, so a radial dead zone correctly passes it.
    const r = applyRadialDeadZone(0.12, 0.12, DZ);
    expect(Math.hypot(r.x, r.y)).toBeGreaterThan(0);
    expect(r.x).toBeCloseTo(r.y, 6); // 45° direction preserved
  });

  test('circular region: diagonal drift inside the radius is rejected', () => {
    // (0.1, 0.1) has magnitude ~0.141 < 0.15 → zeroed.
    expect(applyRadialDeadZone(0.1, 0.1, DZ)).toEqual({ x: 0, y: 0 });
  });

  test('smooth onset: just past the edge eases in from ~0 (no cliff)', () => {
    const r = applyRadialDeadZone(0.16, 0, DZ);
    expect(r.x).toBeGreaterThan(0);
    expect(r.x).toBeLessThan(0.05); // far below the raw 0.16
  });

  test('full deflection passes through at full magnitude', () => {
    const r = applyRadialDeadZone(0.8, -0.6, DZ); // magnitude 1.0
    expect(Math.hypot(r.x, r.y)).toBeCloseTo(1.0, 6);
    expect(r.x).toBeCloseTo(0.8, 6);
    expect(r.y).toBeCloseTo(-0.6, 6);
  });

  test('preserves direction (output is parallel to input)', () => {
    const x = 0.6, y = 0.45;
    const r = applyRadialDeadZone(x, y, DZ);
    // Cross product ≈ 0 ⇒ collinear.
    expect(r.x * y - r.y * x).toBeCloseTo(0, 6);
  });

  test('output magnitude never exceeds 1 even past full deflection', () => {
    const r = applyRadialDeadZone(1, 1, DZ); // magnitude √2 > 1
    expect(Math.hypot(r.x, r.y)).toBeLessThanOrEqual(1.0000001);
  });
});

// ---------------------------------------------------------------------------
// PROFILE_MAP / BUTTON_MAPS / AXES_MAPS exports
// ---------------------------------------------------------------------------

describe('Exported constants', () => {
  test('PROFILE_MAP contains known Quest profiles', () => {
    expect(PROFILE_MAP['oculus-touch-v3']).toBe('meta-quest');
    expect(PROFILE_MAP['oculus-touch-v2']).toBe('meta-quest');
  });

  test('BUTTON_MAPS has entries for every supported family', () => {
    for (const family of ['meta-quest', 'pico', 'valve-index', 'htc-vive', 'wmr', 'generic']) {
      expect(BUTTON_MAPS[family]).toBeDefined();
    }
  });

  test('AXES_MAPS has entries for every supported family', () => {
    for (const family of ['meta-quest', 'pico', 'valve-index', 'htc-vive', 'wmr', 'generic']) {
      expect(AXES_MAPS[family]).toBeDefined();
    }
  });

  test('meta-quest stickX is axis index 2', () => {
    expect(AXES_MAPS['meta-quest'].stickX).toBe(2);
  });

  test('pico stickX is axis index 2', () => {
    expect(AXES_MAPS['pico'].stickX).toBe(2);
  });

  test('generic stickX is axis index 0', () => {
    expect(AXES_MAPS['generic'].stickX).toBe(0);
  });
});
