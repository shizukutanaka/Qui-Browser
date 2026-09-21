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
  Vector3: class {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; }
    clone() { return new this.constructor(this.x, this.y, this.z); }
    addVectors(a, b) { this.x = a.x + b.x; this.y = a.y + b.y; this.z = a.z + b.z; return this; }
    subVectors(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; }
    multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
    normalize() { const l = Math.hypot(this.x, this.y, this.z) || 1; return this.multiplyScalar(1 / l); }
    distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  },
  Ray: class { constructor(o, d) { this.origin = o; this.direction = d; } },
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

// Spatial query helpers + gesture callback dispatch — previously uncovered
// (getPinchPosition / getPointingRay / onGesture fan-out / getStats).
// Joint positions need real vector math (production calls position.distanceTo),
// so use a local real-math vector, not the mocked Vector3.
class V {
  constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
  clone() { return new V(this.x, this.y, this.z); }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
}
const jointsAt = (entries) => {
  const m = new Map();
  for (const [name, [x, y, z]] of entries) m.set(name, { position: new V(x, y, z) });
  return m;
};

describe('HandTracking — spatial queries + gesture dispatch', () => {
  let ht;
  beforeEach(() => {
    // renderer/scene unused by the query paths — pass minimal stubs
    ht = new HandTracking(null, { remove: jest.fn() });
  });

  test('getPinchPosition returns thumb↔index midpoint', () => {
    ht.joints.left = jointsAt([
      ['thumb-tip', [0, 0, 0]],
      ['index-finger-tip', [0.04, 0.02, 0]]
    ]);
    const p = ht.getPinchPosition('left');
    expect(p.x).toBeCloseTo(0.02);
    expect(p.y).toBeCloseTo(0.01);
    expect(p.z).toBeCloseTo(0);
  });

  test('getPinchPosition is null when a joint is missing', () => {
    ht.joints.right = jointsAt([['thumb-tip', [0, 0, 0]]]);
    expect(ht.getPinchPosition('right')).toBeNull();
  });

  test('getPointingRay points from proximal toward tip', () => {
    ht.joints.right = jointsAt([
      ['index-finger-phalanx-proximal', [0, 0, 0]],
      ['index-finger-tip', [0, 0, -1]]
    ]);
    const ray = ht.getPointingRay('right');
    expect(ray.direction.z).toBeCloseTo(-1);
    expect(ray.direction.x).toBeCloseTo(0);
    expect(ray.origin.x).toBeCloseTo(0);
  });

  test('getPointingRay is null without both joints', () => {
    ht.joints.left = jointsAt([['index-finger-tip', [0, 0, -1]]]);
    expect(ht.getPointingRay('left')).toBeNull();
  });

  test('onGesture callback fires on transition only, with (handedness, gesture)', () => {
    const calls = [];
    ht.onGesture('point', (h, g) => calls.push([h, g]));
    ht.joints.left = jointsAt([
      ['thumb-tip', [0, 0.05, -0.1]],
      ['index-finger-tip', [0, 0.09, -0.15]],
      ['wrist', [0, 0, 0]],
      ['index-finger-metacarpal', [0, 0.03, -0.05]],
      ['middle-finger-metacarpal', [0.01, 0.03, -0.05]],
      ['middle-finger-tip', [0.01, 0.02, -0.04]],   // curled
      ['ring-finger-metacarpal', [0.02, 0.03, -0.05]],
      ['ring-finger-tip', [0.02, 0.02, -0.04]],
      ['pinky-finger-metacarpal', [0.03, 0.03, -0.05]],
      ['pinky-finger-tip', [0.03, 0.02, -0.04]]
    ]);
    ht.recognizeGestures();
    expect(calls).toEqual([['left', 'point']]);
    ht.recognizeGestures(); // same pose again — no re-fire
    expect(calls).toHaveLength(1);
  });

  test('getStats reflects per-hand gesture + tracking flag', () => {
    ht.gestures.left = 'fist';
    ht.gestures.right = 'none';
    const s = ht.getStats();
    expect(s.leftGesture).toBe('fist');
    expect(s.rightGesture).toBe('none');
  });
});

describe('HandTracking.updateHand — joint pose application', () => {
  function makeHand(jointMap) {
    return {
      handedness: 'left',
      hand: { get: (name) => jointMap.get(name) }
    };
  }
  function poseFrame(pose) {
    return { getJointPose: jest.fn(() => pose) };
  }
  function jointMeshStub() {
    return {
      position: { set: jest.fn() },
      quaternion: { set: jest.fn() },
      scale: { setScalar: jest.fn() },
      material: { opacity: 0 }
    };
  }

  test('applies joint pose position/quaternion/scale and confidence opacity', () => {
    const ht = new HandTracking({}, new MockObj());
    ht.leftHand = new MockObj(); // updateHand sets handGroup.visible
    const mesh = jointMeshStub();
    ht.joints.left.set('index-finger-tip', mesh);
    const hand = new Map([['index-finger-tip', {}]]); // joint object exists
    const frame = poseFrame({
      transform: {
        position: { x: 1, y: 2, z: 3 },
        orientation: { x: 0, y: 0, z: 0, w: 1 }
      },
      radius: 0.016 // double the nominal 0.008
    });
    ht.updateHand(frame, makeHand(hand), {});

    expect(mesh.position.set).toHaveBeenCalledWith(1, 2, 3);
    expect(mesh.quaternion.set).toHaveBeenCalledWith(0, 0, 0, 1);
    expect(mesh.scale.setScalar).toHaveBeenCalledWith(2);
    expect(mesh.material.opacity).toBeCloseTo(0.8); // 0.4 + 1.0*0.4
  });

  test('skips joints the hand does not report and joints without a pose', () => {
    const ht = new HandTracking({}, new MockObj());
    ht.leftHand = new MockObj();
    const mesh = jointMeshStub();
    ht.joints.left.set('wrist', mesh);
    // hand returns undefined for every joint -> all skipped
    ht.updateHand(poseFrame(null), makeHand(new Map()), {});
    expect(mesh.position.set).not.toHaveBeenCalled();

    // Joint exists but getJointPose returns null -> skipped too
    const hand = new Map([['wrist', {}]]);
    ht.updateHand(poseFrame(null), makeHand(hand), {});
    expect(mesh.position.set).not.toHaveBeenCalled();
  });
});

describe('HandTracking gesture tail — fist / peace / thumbsup', () => {
  function jointsMap() {
    const far = { position: { distanceTo: () => 1 } };
    return new Map([
      ['thumb-tip', far],
      ['index-finger-tip', far],
      ['wrist', far]
    ]);
  }

  test('all fingers curled -> fist', () => {
    const ht = new HandTracking({}, new MockObj());
    ht.isFingerExtended = () => false;
    expect(ht.detectGesture(jointsMap())).toBe('fist');
  });

  test('index + middle extended only -> peace', () => {
    const ht = new HandTracking({}, new MockObj());
    ht.isFingerExtended = (_j, f) => f === 'index-finger' || f === 'middle-finger';
    ht.isThumbUp = () => false;
    expect(ht.detectGesture(jointsMap())).toBe('peace');
  });

  test('gesture precedence: fist wins over thumbsup when all fingers are curled', () => {
    const ht = new HandTracking({}, new MockObj());
    ht.isFingerExtended = () => false;
    ht.isThumbUp = () => true;
    // Fist is checked before thumbsup — pin the precedence order.
    expect(ht.detectGesture(jointsMap())).toBe('fist');
  });

  test('thumbsup fires when a finger extension defeats the fist check', () => {
    const ht = new HandTracking({}, new MockObj());
    ht.isFingerExtended = (_j, f) => f === 'pinky-finger'; // breaks fist+peace+point+open
    ht.isThumbUp = () => true;
    expect(ht.detectGesture(jointsMap())).toBe('thumbsup');
  });

  test('isThumbUp uses the real thumb vector math (y > 0.7)', () => {
    const ht = new HandTracking({}, new MockObj());
    const V = require('three').Vector3;
    const joints = new Map([
      ['thumb-tip', { position: new V(0, 2, 0) }],
      ['thumb-phalanx-proximal', { position: new V(0, 1, 0) }],
      ['wrist', { position: new V(0, 0, 0) }]
    ]);
    expect(ht.isThumbUp(joints)).toBe(true);

    joints.set('thumb-tip', { position: new V(0, 0.2, 0) }); // pointing down
    expect(ht.isThumbUp(joints)).toBe(false);
  });

  test('isThumbUp returns false when a required joint is missing', () => {
    const ht = new HandTracking({}, new MockObj());
    expect(ht.isThumbUp(new Map())).toBe(false);
  });
});

describe('HandTracking.onInputSourcesChange', () => {
  test('hides the hand group for each removed input source', () => {
    const ht = new HandTracking({}, new MockObj());
    ht.leftHand = new MockObj();
    ht.rightHand = new MockObj();
    ht.onInputSourcesChange({
      added: [],
      removed: [{ handedness: 'left' }, { handedness: 'right' }]
    });
    expect(ht.leftHand.visible).toBe(false);
    expect(ht.rightHand.visible).toBe(false);
  });

  test('ignores removed sources with unknown handedness', () => {
    const ht = new HandTracking({}, new MockObj());
    ht.leftHand = new MockObj();
    ht.onInputSourcesChange({ added: [], removed: [{ handedness: 'none' }] });
    expect(ht.leftHand.visible).toBe(true);
  });
});

describe('HandTracking — remaining guard arms', () => {
  test('initialize returns false when session lacks inputSources', async () => {
    const ht = new HandTracking({}, new MockObj());
    expect(await ht.initialize({})).toBe(false); // no inputSources member
  });

  test('update() returns early when disabled or frame is missing', () => {
    const ht = new HandTracking({}, new MockObj());
    ht.enabled = false;
    expect(() => ht.update({ session: {} }, {})).not.toThrow();
    ht.enabled = true;
    expect(() => ht.update(null, {})).not.toThrow();
    expect(() => ht.update({}, {})).not.toThrow(); // frame without session
  });

  test('updateHand skips inputSources without a valid handedness', () => {
    const ht = new HandTracking({}, new MockObj());
    ht.enabled = true;
    expect(() => ht.updateHand({}, { handedness: 'none' }, {})).not.toThrow();
    expect(() => ht.updateHand({}, { handedness: null }, {})).not.toThrow();
  });
});

describe('HandTracking — remaining branch arms', () => {
  test('update() skips inputSources without .hand (controller sources)', () => {
    const scene = new MockObj();
    const ht = new HandTracking({}, scene);
    ht.leftHand = { visible: false };
    ht.rightHand = { visible: false };
    const frame = {
      session: { inputSources: [{ handedness: 'left' }] }, // no .hand
      getJointPose: () => null
    };
    expect(() => ht.update(frame, null)).not.toThrow();
    expect(ht.leftHand.visible).toBe(false); // never tracked → hidden
  });

  test('update() with no hand groups tolerates absent leftHand/rightHand', () => {
    const ht = new HandTracking({}, new MockObj());
    ht.leftHand = null;
    ht.rightHand = null;
    const frame = { session: { inputSources: [] }, getJointPose: () => null };
    expect(() => ht.update(frame, null)).not.toThrow();
  });

  test('updateHand: jointMesh absent + jointPose.radius falsy arms', () => {
    const scene = new MockObj();
    const ht = new HandTracking({}, scene);
    const jointMesh = { position: { set: jest.fn() }, quaternion: { set: jest.fn() }, scale: { setScalar: jest.fn() }, material: { color: { setHex: jest.fn() } } };
    const hand = { get: (name) => name === 'wrist' ? {} : null };
    const frame = {
      session: { inputSources: [] },
      getJointPose: (src, space) => ({ transform: { position: { x: 0, y: 0, z: 0 }, orientation: {} }, radius: 0 })
    };
    ht.joints.left = new Map([['wrist', jointMesh]]);
    ht.leftHand = { visible: false }; // updateHand marks it visible
    expect(() => ht.updateHand(frame, { handedness: 'left', hand }, null)).not.toThrow();
    expect(jointMesh.scale.setScalar).toHaveBeenCalledWith(1); // radius 0 → ||0.008 → 1
  });

  test('detectGesture with no matching gesture returns null', () => {
    const ht = new HandTracking({}, new MockObj());
    const joints = new Map(); // empty → all checks fail
    expect(ht.detectGesture(joints)).toBe('none');
  });

  test('dispose with session/hands absent: guards all skip', () => {
    const ht = new HandTracking({}, new MockObj());
    ht.session = null; ht._onInputSourcesChange = null;
    ht.leftHand = null; ht.rightHand = null;
    expect(() => ht.dispose()).not.toThrow();
  });

  test('dispose detaches inputsourceschange when session + listener exist', () => {
    const session = makeSession();
    const ht = new HandTracking({}, new MockObj());
    ht.session = session;
    const listener = () => {};
    ht._onInputSourcesChange = listener;
    session.addEventListener('inputsourceschange', listener);
    ht.leftHand = null; ht.rightHand = null;
    ht.dispose();
    expect(session.removeEventListener).toHaveBeenCalledWith('inputsourceschange', listener);
    expect(ht.session).toBeNull();
  });
});

describe('HandTracking — last branch arms', () => {
  function makeFrame(inputSources) {
    return { session: { inputSources }, getJointPose: () => null };
  }

  test('update() with handGroup absent skips visibility write', () => {
    const ht = new HandTracking();
    ht.leftHand = null;
    ht.rightHand = null;
    expect(() => ht.update(makeFrame([]), null)).not.toThrow();
  });

  test('updateHand skips joints whose hand.get() returns nothing', () => {
    const ht = new HandTracking();
    ht.joints.left = new Map([['wrist', { position: { set() {} }, quaternion: { set() {} }, material: null }]]);
    ht.leftHand = { visible: false };
    const src = { hand: { get: () => null }, handedness: 'left' };
    const frame = { getJointPose: () => ({ transform: { position: { x: 0, y: 0, z: 0 }, orientation: null }, radius: 0 }) };
    expect(() => ht.updateHand(frame, src, null)).not.toThrow();
  });

  test('isThumbUp true arm returns thumbsup after earlier gestures fail', () => {
    const ht = new HandTracking();
    // Joints needed past the early 'none' exit; pinch distance kept large so
    // the pinch check fails before the finger-pose predicates run.
    const far = () => ({ position: { distanceTo: () => 99 } });
    const joints = new Map([['thumb-tip', far()], ['index-finger-tip', far()], ['wrist', far()]]);
    // Pose that defeats point/open/fist/peace so dispatch reaches thumbs-up:
    // middle extended only (index, ring, pinky curled).
    ht.isFingerExtended = (j, f) => f === 'middle-finger';
    ht.isThumbUp = () => true;
    expect(ht.detectGesture(joints)).toBe('thumbsup');
  });
});

describe('HandTracking — complementary present-side arms', () => {
  test('update() calls updateHand for sources with .hand and fires tracking-change', async () => {
    const scene = new MockObj();
    const ht = new HandTracking({}, scene);
    const session = makeSession();
    await ht.initialize(session);
    const calls = [];
    ht._onTrackingChange = (h, t) => calls.push([h, t]);
    ht.updateHand = jest.fn(function () { this.leftHand.visible = true; });
    const src = { hand: { get: () => null }, handedness: 'left' };
    ht.update({ session: { inputSources: [src] } }, null);
    expect(ht.updateHand).toHaveBeenCalled();
  });

  test('updateHand writes position, orientation and opacity when all present', async () => {
    const scene = new MockObj();
    const ht = new HandTracking({}, scene);
    const session = makeSession();
    await ht.initialize(session);
    const mesh = {
      position: { set: jest.fn() },
      quaternion: { set: jest.fn() },
      scale: { setScalar: jest.fn() },
      material: { opacity: 0, color: { setHex() {} } }
    };
    ht.joints.left = new Map([['wrist', mesh]]);
    ht.leftHand = { visible: false };
    const src = { hand: { get: () => ({}) }, handedness: 'left' };
    const frame = {
      getJointPose: () => ({
        transform: { position: { x: 1, y: 2, z: 3 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
        radius: 0.02
      })
    };
    ht.updateHand(frame, src, null);
    expect(mesh.position.set).toHaveBeenCalledWith(1, 2, 3);
    expect(mesh.quaternion.set).toHaveBeenCalled();
    expect(mesh.material.opacity).toBeGreaterThan(0.4);
  });
});

describe('HandTracking — false-side arms', () => {
  test('update() with no hand groups built tolerates absent left/right hands', async () => {
    const scene = new MockObj();
    const ht = new HandTracking({}, scene);
    const session = makeSession();
    await ht.initialize(session);
    delete ht.leftHand;
    delete ht.rightHand;
    const src = { handedness: 'left' }; // no .hand
    expect(() => ht.update({ session: { inputSources: [src] } }, null)).not.toThrow();
  });

  test('updateHand tolerates poses without orientation and meshes without material', async () => {
    const scene = new MockObj();
    const ht = new HandTracking({}, scene);
    const session = makeSession();
    await ht.initialize(session);
    const mesh = {
      position: { set: jest.fn() },
      quaternion: { set: jest.fn() },
      scale: { setScalar: jest.fn() }
      // no material
    };
    ht.joints.left = new Map([['wrist', mesh]]);
    ht.leftHand = { visible: false };
    const src = { hand: { get: () => ({}) }, handedness: 'left' };
    const frame = { getJointPose: () => ({ transform: { position: { x: 0, y: 0, z: 0 } }, radius: 0.01 }) };
    expect(() => ht.updateHand(frame, src, null)).not.toThrow();
  });

  test('detectGesture returns none when thumb is not up', async () => {
    const scene = new MockObj();
    const ht = new HandTracking({}, scene);
    const joints = new Map([
      ['thumb-tip', { position: { distanceTo: () => 0.2 } }],
      ['index-finger-tip', { position: { distanceTo: () => 0.2 } }],
      ['wrist', { position: { distanceTo: () => 0 } }]
    ]);
    const g = ht.detectGesture(joints, false);
    expect(g).toBeDefined();
  });
});

test('thumbsup wins when no other gesture matches; none when isThumbUp false', () => {
  const ht = new HandTracking({}, {});
  const joints = new Map([
    ['thumb-tip', { position: { distanceTo: () => 99 } }],
    ['index-finger-tip', { position: { distanceTo: () => 99 } }],
    ['wrist', { position: { distanceTo: () => 99 } }]
  ]);
  ht.isFingerExtended = (_j, f) => f === 'pinky-finger';
  ht.isThumbUp = () => true;
  expect(ht.detectGesture(joints)).toBe('thumbsup');
  ht.isThumbUp = () => false;
  expect(ht.detectGesture(joints)).toBe('none');
});
