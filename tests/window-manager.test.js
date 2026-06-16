/**
 * Unit tests for WindowManager (spatial window management — Wolvic/Quest parity).
 * THREE Vector3/Quaternion are given working implementations so the transform
 * maths (follow placement, billboard orientation, grab) can be asserted.
 */

// Working Vector3/Quaternion stubs, defined inside the mock factory (jest
// forbids referencing out-of-scope vars there) and re-required for the tests.
jest.mock('three', () => {
  class V3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
    normalize() {
      const l = Math.hypot(this.x, this.y, this.z) || 1;
      this.x /= l; this.y /= l; this.z /= l; return this;
    }
    distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
    lerp(v, t) {
      this.x += (v.x - this.x) * t;
      this.y += (v.y - this.y) * t;
      this.z += (v.z - this.z) * t;
      return this;
    }
    applyQuaternion(q) {
      const { x, y, z } = this;
      const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
      const ix =  qw * x + qy * z - qz * y;
      const iy =  qw * y + qz * x - qx * z;
      const iz =  qw * z + qx * y - qy * x;
      const iw = -qx * x - qy * y - qz * z;
      this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
      this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
      this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
      return this;
    }
  }
  class Quat {
    constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
    copy(q) { this.x = q.x; this.y = q.y; this.z = q.z; this.w = q.w; return this; }
    setFromAxisAngle(axis, angle) {
      const h = angle / 2, s = Math.sin(h);
      this.x = axis.x * s; this.y = axis.y * s; this.z = axis.z * s; this.w = Math.cos(h);
      return this;
    }
  }
  return { Vector3: V3, Quaternion: Quat };
});

const THREE = require('three');
const V3 = THREE.Vector3;
const Quat = THREE.Quaternion;
const {
  WindowManager,
  resolveWindowDistance,
  PANEL_DISTANCE_DEFAULT,
  PANEL_DISTANCE_LARGE_TEXT
} = require('../src/vr/browser/WindowManager.js');

// A fake camera/object exposing world transform getters.
function makeNode(pos = [0, 0, 0], quat = [0, 0, 0, 1]) {
  return {
    position: new V3(...pos),
    quaternion: new Quat(...quat),
    getWorldPosition: (v) => { v.set(pos[0], pos[1], pos[2]); return v; },
    getWorldQuaternion: (q) => { q.x = quat[0]; q.y = quat[1]; q.z = quat[2]; q.w = quat[3]; return q; }
  };
}

describe('WindowManager (spatial window management)', () => {
  test('attach/detach manages the target', () => {
    const wm = new WindowManager(makeNode());
    const panel = makeNode();
    wm.attach(panel);
    expect(wm.target).toBe(panel);
    wm.detach();
    expect(wm.target).toBeNull();
  });

  test('setDistance clamps to [min,max]', () => {
    const wm = new WindowManager(makeNode(), { minDistance: 0.6, maxDistance: 6 });
    expect(wm.setDistance(100)).toBe(6);
    expect(wm.setDistance(0)).toBe(0.6);
    expect(wm.setDistance(2)).toBe(2);
  });

  test('nudgeDistance adjusts relative to current', () => {
    const wm = new WindowManager(makeNode(), { distance: 2 });
    wm.nudgeDistance(1);
    expect(wm.distance).toBe(3);
    wm.nudgeDistance(-0.5);
    expect(wm.distance).toBe(2.5);
  });

  test('follow mode places the panel "distance" metres along camera forward', () => {
    // Camera at origin, identity orientation → forward is -Z.
    const wm = new WindowManager(makeNode([0, 0, 0]), { distance: 2, followLerp: 1 });
    const panel = makeNode([0, 0, 0]);
    wm.attach(panel);
    wm.setFollow(true);
    wm.update(16.6667); // lerp factor = 1 → snaps to target

    expect(panel.position.x).toBeCloseTo(0, 5);
    expect(panel.position.y).toBeCloseTo(0, 5);
    expect(panel.position.z).toBeCloseTo(-2, 5); // 2 m in front
  });

  test('follow mode tracks a yawed camera', () => {
    // Camera yawed 90° about Y → forward points toward -X.
    const q = new Quat().setFromAxisAngle(new V3(0, 1, 0), Math.PI / 2);
    const cam = makeNode([1, 1.6, 0], [q.x, q.y, q.z, q.w]);
    const wm = new WindowManager(cam, { distance: 2, followLerp: 1 });
    const panel = makeNode([0, 0, 0]);
    wm.attach(panel);
    wm.setFollow(true);
    wm.update(16.6667);

    // Forward after +90° yaw is approximately (-1, 0, 0); panel = cam + fwd*2.
    expect(panel.position.x).toBeCloseTo(-1, 4);
    expect(panel.position.y).toBeCloseTo(1.6, 4);
    expect(panel.position.z).toBeCloseTo(0, 4);
  });

  test('follow mode copies camera orientation so the panel faces the user', () => {
    const q = new Quat().setFromAxisAngle(new V3(0, 1, 0), Math.PI / 3);
    const cam = makeNode([0, 0, 0], [q.x, q.y, q.z, q.w]);
    const wm = new WindowManager(cam, { followLerp: 1 });
    const panel = makeNode();
    wm.attach(panel);
    wm.setFollow(true);
    wm.update(16.6667);
    expect(panel.quaternion.y).toBeCloseTo(q.y, 5);
    expect(panel.quaternion.w).toBeCloseTo(q.w, 5);
  });

  test('partial lerp moves only fractionally toward the target', () => {
    const wm = new WindowManager(makeNode([0, 0, 0]), { distance: 2, followLerp: 0.5 });
    const panel = makeNode([0, 0, 0]);
    wm.attach(panel);
    wm.setFollow(true);
    wm.update(16.6667); // factor 0.5 → halfway to z=-2
    expect(panel.position.z).toBeCloseTo(-1, 5);
  });

  test('billboard mode orients without repositioning', () => {
    const q = new Quat().setFromAxisAngle(new V3(0, 1, 0), Math.PI / 4);
    const cam = makeNode([0, 0, 0], [q.x, q.y, q.z, q.w]);
    const wm = new WindowManager(cam);
    const panel = makeNode([3, 1, -1]);
    wm.attach(panel);
    wm.setBillboard(true);
    wm.update(16.6667);
    // Position unchanged …
    expect(panel.position.x).toBe(3);
    expect(panel.position.z).toBe(-1);
    // … orientation matches camera.
    expect(panel.quaternion.y).toBeCloseTo(q.y, 5);
  });

  test('update no-ops without a target', () => {
    const wm = new WindowManager(makeNode());
    wm.setFollow(true);
    expect(() => wm.update(16)).not.toThrow();
  });

  test('grab makes the panel ride along the controller ray', () => {
    const wm = new WindowManager(makeNode([0, 0, 0]));
    const panel = makeNode([0, 0, -2]); // 2 m in front initially
    wm.attach(panel);

    // Controller at origin, identity orientation (forward -Z).
    const controller = makeNode([0, 0, 0]);
    wm.beginGrab(controller);
    expect(wm.isGrabbing).toBe(true);

    // Move controller to (1,0,0); panel should stay 2 m along its forward.
    const moved = makeNode([1, 0, 0]);
    wm._grab.controller = moved;
    wm.update(16);
    expect(panel.position.x).toBeCloseTo(1, 4);
    expect(panel.position.z).toBeCloseTo(-2, 4);

    wm.endGrab();
    expect(wm.isGrabbing).toBe(false);
  });

  test('grab takes precedence over follow', () => {
    const wm = new WindowManager(makeNode([0, 0, 0]), { distance: 5, followLerp: 1 });
    const panel = makeNode([0, 0, -1]);
    wm.attach(panel);
    wm.setFollow(true);
    const controller = makeNode([0, 0, 0]);
    wm.beginGrab(controller);
    wm.update(16);
    // Should use grab distance (1 m), not follow distance (5 m).
    expect(panel.position.z).toBeCloseTo(-1, 4);
  });

  test('dispose clears state', () => {
    const wm = new WindowManager(makeNode());
    wm.attach(makeNode());
    wm.beginGrab(makeNode());
    wm.dispose();
    expect(wm.target).toBeNull();
    expect(wm.isGrabbing).toBe(false);
  });
});

describe('resolveWindowDistance — largeText preference pulls panel closer', () => {
  test('no preference, no persisted → default (2.0 m)', () => {
    expect(resolveWindowDistance()).toBe(PANEL_DISTANCE_DEFAULT);
    expect(resolveWindowDistance({ largeText: false, persisted: null })).toBe(PANEL_DISTANCE_DEFAULT);
  });

  test('largeText → closer distance for low-vision legibility', () => {
    expect(resolveWindowDistance({ largeText: true })).toBe(PANEL_DISTANCE_LARGE_TEXT);
  });

  test('large-text distance is strictly closer than default', () => {
    expect(PANEL_DISTANCE_LARGE_TEXT).toBeLessThan(PANEL_DISTANCE_DEFAULT);
  });

  test('persisted valid number always wins over largeText', () => {
    expect(resolveWindowDistance({ largeText: true, persisted: 3.0 })).toBe(3.0);
    expect(resolveWindowDistance({ largeText: false, persisted: 1.0 })).toBe(1.0);
  });

  test('persisted NaN is ignored — falls through to largeText / default', () => {
    expect(resolveWindowDistance({ largeText: true, persisted: NaN })).toBe(PANEL_DISTANCE_LARGE_TEXT);
    expect(resolveWindowDistance({ largeText: false, persisted: NaN })).toBe(PANEL_DISTANCE_DEFAULT);
  });

  test('persisted zero or negative is ignored (physically invalid)', () => {
    expect(resolveWindowDistance({ largeText: false, persisted: 0 })).toBe(PANEL_DISTANCE_DEFAULT);
    expect(resolveWindowDistance({ largeText: true, persisted: -1 })).toBe(PANEL_DISTANCE_LARGE_TEXT);
  });

  test('persisted non-number is ignored', () => {
    expect(resolveWindowDistance({ largeText: false, persisted: 'far' })).toBe(PANEL_DISTANCE_DEFAULT);
  });
});
