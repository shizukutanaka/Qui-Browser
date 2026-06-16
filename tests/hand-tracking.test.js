/**
 * Unit tests for HandTracking session-listener lifecycle.
 * THREE is mocked; a fake XRSession records add/removeEventListener so we can
 * assert the 'inputsourceschange' listener is detached on dispose (it was
 * previously leaked, pinning the instance to the session).
 */

class MockObj {
  constructor() { this.name = ''; this.children = []; this.position = { set: jest.fn() }; this.visible = true; }
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
