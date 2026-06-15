/**
 * Unit tests for GazeInteraction (FR-13.1).
 * THREE is mocked so the dwell-timer logic can be exercised headlessly.
 * The raycast is stubbed via a controllable `nextHit` so tests drive exactly
 * which interactable the gaze rests on each frame.
 */

// ── controllable raycast result ───────────────────────────────────────────────
let nextHit = null; // { object } or null

class MockVec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  applyQuaternion() { return this; }
  normalize() { return this; }
}
class MockQuat {}
class MockRaycaster {
  set() {}
  intersectObjects() { return nextHit ? [nextHit] : []; }
}
class MockGeometry { dispose() {} }
class MockMaterial { dispose() {} }
class MockMesh {
  constructor() {
    this.renderOrder = 0;
    this.scale = { _s: 1, setScalar(s) { this._s = s; } };
    this.geometry = new MockGeometry();
    this.material = new MockMaterial();
  }
}
class MockGroup {
  constructor() {
    this.name = '';
    this.visible = true;
    this.position = { set: jest.fn() };
    this._objects = [];
  }
  add(o) { this._objects.push(o); }
  traverse(fn) { this._objects.forEach(fn); fn(this); }
}

jest.mock('three', () => ({
  Vector3: MockVec3,
  Quaternion: MockQuat,
  Raycaster: MockRaycaster,
  Group: MockGroup,
  Mesh: MockMesh,
  RingGeometry: MockGeometry,
  CircleGeometry: MockGeometry,
  MeshBasicMaterial: MockMaterial
}));

const { GazeInteraction } = require('../src/vr/interaction/GazeInteraction.js');

function makeCamera() {
  return {
    add: jest.fn(),
    remove: jest.fn(),
    getWorldPosition: (v) => v,
    getWorldQuaternion: (q) => q
  };
}

function makeInteractable(handlers = {}) {
  return { userData: { interactable: handlers } };
}

describe('GazeInteraction (FR-13.1)', () => {
  beforeEach(() => { nextHit = null; });

  test('starts disabled with a hidden reticle', () => {
    const gi = new GazeInteraction(makeCamera());
    expect(gi.enabled).toBe(false);
    expect(gi.reticle.visible).toBe(false);
  });

  test('setEnabled(true) shows the reticle', () => {
    const gi = new GazeInteraction(makeCamera());
    gi.setEnabled(true);
    expect(gi.enabled).toBe(true);
    expect(gi.reticle.visible).toBe(true);
  });

  test('update() no-ops while disabled', () => {
    const gi = new GazeInteraction(makeCamera());
    const onSelect = jest.fn();
    const obj = makeInteractable({ onSelect });
    nextHit = { object: obj };
    const result = gi.update([obj], 5000);
    expect(result).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });

  test('fires onSelect after the dwell time elapses', () => {
    const gi = new GazeInteraction(makeCamera(), { dwellTime: 1000 });
    gi.setEnabled(true);
    const onSelect = jest.fn();
    const obj = makeInteractable({ onSelect });
    nextHit = { object: obj };

    gi.update([obj], 500);          // 0.5s — not yet
    expect(onSelect).not.toHaveBeenCalled();
    const fired = gi.update([obj], 600); // 1.1s — crosses threshold
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(fired).toBe(obj);
    expect(onSelect.mock.calls[0][0].gaze).toBe(true);
  });

  test('fires onSelect only once per continuous dwell', () => {
    const gi = new GazeInteraction(makeCamera(), { dwellTime: 1000 });
    gi.setEnabled(true);
    const onSelect = jest.fn();
    const obj = makeInteractable({ onSelect });
    nextHit = { object: obj };

    gi.update([obj], 1200); // fires
    gi.update([obj], 1200); // still gazing — must NOT refire
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test('looking away before dwell completes cancels activation', () => {
    const gi = new GazeInteraction(makeCamera(), { dwellTime: 1000 });
    gi.setEnabled(true);
    const onSelect = jest.fn();
    const obj = makeInteractable({ onSelect });

    nextHit = { object: obj };
    gi.update([obj], 700);    // partway
    nextHit = null;           // look away
    gi.update([obj], 700);    // timer resets
    nextHit = { object: obj };
    gi.update([obj], 700);    // only 0.7s again — still under threshold
    expect(onSelect).not.toHaveBeenCalled();
  });

  test('fires hover enter/leave as the gaze target changes', () => {
    const gi = new GazeInteraction(makeCamera(), { dwellTime: 1000 });
    gi.setEnabled(true);
    const aHover = jest.fn(), aEnd = jest.fn(), bHover = jest.fn();
    const a = makeInteractable({ onHover: aHover, onHoverEnd: aEnd });
    const b = makeInteractable({ onHover: bHover });

    nextHit = { object: a };
    gi.update([a, b], 100);   // enter a
    nextHit = { object: b };
    gi.update([a, b], 100);   // leave a, enter b
    expect(aHover).toHaveBeenCalledTimes(1);
    expect(aEnd).toHaveBeenCalledTimes(1);
    expect(bHover).toHaveBeenCalledTimes(1);
  });

  test('the progress fill grows with dwell and resets once grace is exhausted', () => {
    const gi = new GazeInteraction(makeCamera(), { dwellTime: 1000, graceTime: 300 });
    gi.setEnabled(true);
    const obj = makeInteractable({ onSelect: jest.fn() });
    nextHit = { object: obj };
    gi.update([obj], 500);
    expect(gi._fill.scale._s).toBeCloseTo(0.5, 2);
    nextHit = null;
    gi.update([obj], 400); // look away beyond grace → reset
    expect(gi._fill.scale._s).toBeCloseTo(0.001, 3);
  });

  test('forgives a brief off-target slip and resumes the dwell (tremor)', () => {
    const gi = new GazeInteraction(makeCamera(), { dwellTime: 1000, graceTime: 300 });
    gi.setEnabled(true);
    const onSelect = jest.fn();
    const obj = makeInteractable({ onSelect });
    nextHit = { object: obj };

    gi.update([obj], 800);   // 0.8s charged
    nextHit = null;
    gi.update([obj], 200);   // slip off-target for 0.2s (< grace) — held, no charge
    expect(onSelect).not.toHaveBeenCalled();
    expect(gi._fill.scale._s).toBeCloseTo(0.8, 2); // progress preserved, not reset
    nextHit = { object: obj };
    const fired = gi.update([obj], 300); // back on target: 0.8 + 0.3 ≥ 1.0 → fires
    expect(fired).toBe(obj);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test('a slip longer than grace discards the accumulated dwell', () => {
    const gi = new GazeInteraction(makeCamera(), { dwellTime: 1000, graceTime: 300 });
    gi.setEnabled(true);
    const onSelect = jest.fn();
    const obj = makeInteractable({ onSelect });
    nextHit = { object: obj };

    gi.update([obj], 800);   // 0.8s charged
    nextHit = null;
    gi.update([obj], 400);   // off-target beyond grace → released
    expect(gi._target).toBeNull();
    nextHit = { object: obj };
    gi.update([obj], 300);   // restart from zero → only 0.3s, no fire
    expect(onSelect).not.toHaveBeenCalled();
    expect(gi._fill.scale._s).toBeCloseTo(0.3, 2);
  });

  test('moving to a different interactable restarts immediately (no grace carry-over)', () => {
    const gi = new GazeInteraction(makeCamera(), { dwellTime: 1000, graceTime: 300 });
    gi.setEnabled(true);
    const aSel = jest.fn(), bSel = jest.fn();
    const a = makeInteractable({ onSelect: aSel });
    const b = makeInteractable({ onSelect: bSel });

    nextHit = { object: a };
    gi.update([a, b], 900);  // a nearly charged
    nextHit = { object: b };
    gi.update([a, b], 300);  // switch to b → b starts at zero, not 0.9 + 0.3
    expect(aSel).not.toHaveBeenCalled();
    expect(bSel).not.toHaveBeenCalled();
    expect(gi._target).toBe(b);
    expect(gi._fill.scale._s).toBeCloseTo(0.3, 2);
  });

  test('flashes the reticle ring on activation, then decays back', () => {
    const gi = new GazeInteraction(makeCamera(), { dwellTime: 1000 });
    gi.setEnabled(true);
    const obj = makeInteractable({ onSelect: jest.fn() });
    nextHit = { object: obj };

    gi.update([obj], 1200);                         // crosses threshold → fires
    expect(gi._confirmMs).toBeGreaterThan(0);       // flash armed
    expect(gi._ring.material.opacity).toBeCloseTo(1, 3); // full-bright pulse

    gi.update([obj], 100);                          // still gazing — flash decays
    expect(gi._confirmMs).toBeLessThan(250);
    expect(gi._ring.material.opacity).toBeGreaterThan(0.35);
    expect(gi._ring.material.opacity).toBeLessThan(1);
  });

  test('the confirmation flash finishes after its duration elapses', () => {
    const gi = new GazeInteraction(makeCamera(), { dwellTime: 1000 });
    gi.setEnabled(true);
    const obj = makeInteractable({ onSelect: jest.fn() });
    nextHit = { object: obj };

    gi.update([obj], 1200);          // fires, flash armed
    gi.update([obj], 300);           // > CONFIRM_MS later → flash done
    expect(gi._confirmMs).toBe(0);
    expect(gi._ring.material.opacity).toBeCloseTo(0.35, 3);
  });

  test('an empty interactable list resets the flash with the dwell state', () => {
    const gi = new GazeInteraction(makeCamera(), { dwellTime: 1000 });
    gi.setEnabled(true);
    const obj = makeInteractable({ onSelect: jest.fn() });
    nextHit = { object: obj };

    gi.update([obj], 1200);          // fires, flash armed
    expect(gi._confirmMs).toBeGreaterThan(0);
    gi.update([], 50);               // nothing to gaze at → _reset()
    expect(gi._confirmMs).toBe(0);
    expect(gi._ring.material.opacity).toBeCloseTo(0.35, 3);
  });

  test('setEnabled(false) resets dwell state', () => {
    const gi = new GazeInteraction(makeCamera(), { dwellTime: 1000 });
    gi.setEnabled(true);
    const obj = makeInteractable({ onSelect: jest.fn() });
    nextHit = { object: obj };
    gi.update([obj], 500);
    gi.setEnabled(false);
    expect(gi._target).toBeNull();
    expect(gi._elapsed).toBe(0);
  });

  test('dispose() detaches the reticle from the camera', () => {
    const camera = makeCamera();
    const gi = new GazeInteraction(camera);
    gi.dispose();
    expect(camera.remove).toHaveBeenCalled();
    expect(gi.reticle).toBeNull();
  });
});
