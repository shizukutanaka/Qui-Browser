/**
 * Unit tests for HandTracking session-listener lifecycle.
 * THREE is mocked; a fake XRSession records add/removeEventListener so we can
 * assert the 'inputsourceschange' listener is detached on dispose (it was
 * previously leaked, pinning the instance to the session).
 */

class MockObj {
  constructor() { this.name = ''; this.children = []; this.position = { set: jest.fn(), distanceTo: () => 1 }; this.visible = true; }
  add(o) { this.children.push(o); }
  remove(o) { this.children = this.children.filter(c => c !== o); }
  traverse(fn) { fn(this); this.children.forEach(c => (c.traverse ? c.traverse(fn) : fn(c))); }
}
class MockMesh extends MockObj {
  constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; }
}

jest.mock('three', () => ({
  Group: MockObj,
  Mesh: MockMesh,
  SphereGeometry: class { dispose() {} },
  CylinderGeometry: class { dispose() {} },
  MeshPhongMaterial: class { clone() { return new this.constructor(); } dispose() {} },
  Vector3: class { constructor() { this.set = () => {}; this.clone = () => this; } },
  Quaternion: class {}
}));

const { HandTracking } = require('../src/vr/interaction/HandTracking.js');

function makeSession() {
  const listeners = {};
  return {
    inputSources: [],
    _listeners: listeners,
    addEventListener: jest.fn((type, fn) => { listeners[type] = fn; }),
    removeEventListener: jest.fn((type, fn) => {
      if (listeners[type] === fn) delete listeners[type];
    })
  };
}

describe('HandTracking session listener lifecycle', () => {
  test('initialize attaches an inputsourceschange listener', async () => {
    const ht = new HandTracking({}, new MockObj());
    const session = makeSession();
    await ht.initialize(session);
    expect(session.addEventListener).toHaveBeenCalledWith('inputsourceschange', expect.any(Function));
    expect(ht.session).toBe(session);
  });

  test('dispose removes the inputsourceschange listener (no leak)', async () => {
    const ht = new HandTracking({}, new MockObj());
    const session = makeSession();
    await ht.initialize(session);
    const handler = session._listeners['inputsourceschange'];

    ht.dispose();

    expect(session.removeEventListener).toHaveBeenCalledWith('inputsourceschange', handler);
    expect(ht.session).toBeNull();
  });

  test('initialize returns false without a session', async () => {
    const ht = new HandTracking({}, new MockObj());
    await expect(ht.initialize(null)).resolves.toBe(false);
  });
});

describe('HandTracking.detectGesture', () => {
  // A joints map whose tips are far apart (no pinch). isFingerExtended is
  // stubbed per-test to drive the finger-pose branches deterministically.
  function makeJoints() {
    const far = { position: { distanceTo: () => 1 } }; // 1 m ≫ pinch threshold
    return new Map([
      ['thumb-tip', far],
      ['index-finger-tip', far],
      ['wrist', far]
    ]);
  }

  test("returns 'none' when required joints are missing", () => {
    const ht = new HandTracking({}, new MockObj());
    expect(ht.detectGesture(new Map())).toBe('none');
  });

  test("'open' hand is detected AND counted in stats (regression)", () => {
    const ht = new HandTracking({}, new MockObj());
    ht.isFingerExtended = () => true; // all fingers extended → open hand
    const before = ht.stats.gesturesRecognized;
    expect(ht.detectGesture(makeJoints())).toBe('open');
    expect(ht.stats.gesturesRecognized).toBe(before + 1);
  });

  test("'point' is detected when only the index is extended", () => {
    const ht = new HandTracking({}, new MockObj());
    ht.isFingerExtended = (_joints, finger) => finger === 'index-finger';
    expect(ht.detectGesture(makeJoints())).toBe('point');
  });

  // Pinch with a controllable thumb↔index gap.
  function pinchJoints(gap) {
    const tip = { position: { distanceTo: () => gap } };
    return new Map([
      ['thumb-tip', tip],
      ['index-finger-tip', tip],
      ['wrist', { position: { distanceTo: () => 1 } }]
    ]);
  }

  test('pinch starts only inside the tight enter threshold', () => {
    const ht = new HandTracking({}, new MockObj());
    expect(ht.detectGesture(pinchJoints(0.015), false)).toBe('pinch'); // < 0.02
    expect(ht.detectGesture(pinchJoints(0.025), false)).not.toBe('pinch'); // in dead-band
  });

  test('hysteresis holds a pinch through tremor near the threshold', () => {
    const ht = new HandTracking({}, new MockObj());
    // Already pinching, gap drifts into the dead-band (0.02–0.035): stays pinched.
    expect(ht.detectGesture(pinchJoints(0.03), true)).toBe('pinch');
    // Only a clearly wider gap releases it.
    expect(ht.detectGesture(pinchJoints(0.04), true)).not.toBe('pinch');
  });
});

// ── Hand visibility / tracking-change (WCAG 4.1.3 + visual correctness) ────────

describe('HandTracking.update() — visibility and onTrackingChange', () => {
  function makeInputSource(handedness) {
    return {
      handedness,
      hand: { get: () => null }  // hand property present; no joint data (poses null)
    };
  }
  function makeFrame(inputSources) {
    return {
      session: { inputSources },
      getJointPose: () => null  // updateHand skips all joint updates, visible=true still set
    };
  }

  async function makeReady() {
    const scene = new MockObj();
    const ht = new HandTracking({}, scene);
    const session = makeSession();
    await ht.initialize(session);
    // After initialize, both hand groups exist and start visible=false (group default).
    ht.leftHand.visible  = false;
    ht.rightHand.visible = false;
    return ht;
  }

  test('hand becomes visible when its input source appears', async () => {
    const ht = await makeReady();
    ht.update(makeFrame([makeInputSource('left')]), null);
    expect(ht.leftHand.visible).toBe(true);
    expect(ht.rightHand.visible).toBe(false); // right untouched
  });

  test('hand is hidden when its input source disappears (no frozen skeleton)', async () => {
    const ht = await makeReady();
    // First frame: both hands visible
    ht.update(makeFrame([makeInputSource('left'), makeInputSource('right')]), null);
    expect(ht.leftHand.visible).toBe(true);
    expect(ht.rightHand.visible).toBe(true);

    // Second frame: right hand disappears
    ht.update(makeFrame([makeInputSource('left')]), null);
    expect(ht.leftHand.visible).toBe(true);
    expect(ht.rightHand.visible).toBe(false);
  });

  test('onTrackingChange fires on loss with (handedness, false)', async () => {
    const ht = await makeReady();
    const onChange = jest.fn();
    ht.onTrackingChange(onChange);

    ht.update(makeFrame([makeInputSource('right')]), null); // right appears
    ht.update(makeFrame([]), null);                         // right disappears

    expect(onChange).toHaveBeenCalledWith('right', false);
  });

  test('onTrackingChange fires on regain with (handedness, true)', async () => {
    const ht = await makeReady();
    const onChange = jest.fn();
    ht.onTrackingChange(onChange);

    ht.update(makeFrame([makeInputSource('left')]), null);  // left appears → tracked
    onChange.mockClear();
    ht.update(makeFrame([]), null);                         // left lost
    ht.update(makeFrame([makeInputSource('left')]), null);  // left regained

    expect(onChange).toHaveBeenLastCalledWith('left', true);
  });

  test('onTrackingChange does NOT fire when visibility is unchanged', async () => {
    const ht = await makeReady();
    const onChange = jest.fn();
    ht.onTrackingChange(onChange);

    // Two consecutive frames with the same hand present
    ht.update(makeFrame([makeInputSource('left')]), null);
    onChange.mockClear();
    ht.update(makeFrame([makeInputSource('left')]), null);

    expect(onChange).not.toHaveBeenCalled();
  });
});
