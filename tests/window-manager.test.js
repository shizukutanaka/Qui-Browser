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
  PANEL_DISTANCE_LARGE_TEXT,
  firePanelGrabFeedback,
  firePanelReleaseFeedback
} = require('../src/vr/browser/WindowManager.js');
const { setLanguage } = require('../src/i18n/i18n.js');

// A fake camera/object exposing world transform getters.
// `scale` is real (not a jest.fn) so the angular-constant scaling applied by
// update() can be asserted on the value it actually writes.
function makeNode(pos = [0, 0, 0], quat = [0, 0, 0, 1]) {
  return {
    position: new V3(...pos),
    quaternion: new Quat(...quat),
    scale: {
      x: 1, y: 1, z: 1,
      setScalar(v) { this.x = v; this.y = v; this.z = v; return this; }
    },
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

describe('firePanelGrabFeedback / firePanelReleaseFeedback — grab-to-move cross-modal feedback', () => {
  function makeController(handedness) {
    return { userData: { inputSource: handedness ? { handedness } : undefined } };
  }

  afterEach(() => setLanguage('en'));

  test('grab fires a "click" haptic pattern on the controller handedness', () => {
    const playPattern = jest.fn();
    firePanelGrabFeedback(makeController('left'), { playPattern }, null);
    expect(playPattern).toHaveBeenCalledWith('left', 'click');
  });

  test('release fires an "impact" haptic pattern on the controller handedness', () => {
    const playPattern = jest.fn();
    firePanelReleaseFeedback(makeController('left'), { playPattern }, null);
    expect(playPattern).toHaveBeenCalledWith('left', 'impact');
  });

  test('falls back to "right" handedness when unknown', () => {
    const playPattern = jest.fn();
    firePanelGrabFeedback(makeController(null), { playPattern }, null);
    expect(playPattern).toHaveBeenCalledWith('right', 'click');
    firePanelReleaseFeedback(makeController(null), { playPattern }, null);
    expect(playPattern).toHaveBeenCalledWith('right', 'impact');
  });

  test('shows the localized caption only when captions are enabled', () => {
    const show = jest.fn();
    setLanguage('en');
    firePanelGrabFeedback(makeController('right'), null, { enabled: true, show });
    expect(show).toHaveBeenCalledWith('Panel grabbed');
    firePanelReleaseFeedback(makeController('right'), null, { enabled: true, show });
    expect(show).toHaveBeenCalledWith('Panel moved');
  });

  test('captions are translated when the language is Japanese', () => {
    const show = jest.fn();
    setLanguage('ja');
    firePanelGrabFeedback(makeController('right'), null, { enabled: true, show });
    expect(show).toHaveBeenCalledWith('パネルをつかみました');
    firePanelReleaseFeedback(makeController('right'), null, { enabled: true, show });
    expect(show).toHaveBeenCalledWith('パネル移動完了');
  });

  test('does not show the caption when captions are disabled', () => {
    const show = jest.fn();
    firePanelGrabFeedback(makeController('right'), null, { enabled: false, show });
    firePanelReleaseFeedback(makeController('right'), null, { enabled: false, show });
    expect(show).not.toHaveBeenCalled();
  });

  test('is null-safe with no haptic and no captions', () => {
    expect(() => firePanelGrabFeedback(makeController('left'), null, null)).not.toThrow();
    expect(() => firePanelReleaseFeedback(makeController('left'), null, null)).not.toThrow();
  });
});

// ── Angular-constant scaling (Session 71) ────────────────────────────────────
// Without this the panel's apparent size is inversely proportional to distance
// and the distance stepper spans 0.6–6.0 m, so at its own maximum every browser
// control fell below the 1.5° gaze-selection floor (tests/target-size.test.js).
describe('WindowManager — constant apparent size across the distance range', () => {
  const { angularSizeDeg, GAZE_TARGET_MIN_DEG } = require('../src/vr/ui/angularSize.js');
  const { PANEL_DISTANCE_DEFAULT, PANEL_DISTANCE_MIN, PANEL_DISTANCE_MAX, STRIP_H } =
    require('../src/vr/browser/panelGeometry.js');

  const follow = (distance) => {
    const wm = new WindowManager(makeNode(), { distance });
    const panel = makeNode();
    wm.attach(panel);
    wm.setFollow(true);
    wm.update(1000); // large dt → lerp completes, panel lands at `distance`
    return { wm, panel };
  };

  test('the default distance leaves scale at exactly 1 (shipped behaviour unchanged)', () => {
    const { panel } = follow(PANEL_DISTANCE_DEFAULT);
    expect(panel.scale.x).toBeCloseTo(1, 10);
  });

  test('scale tracks distance, so apparent size is preserved', () => {
    for (const d of [PANEL_DISTANCE_MIN, 1.2, PANEL_DISTANCE_DEFAULT, 4.0, PANEL_DISTANCE_MAX]) {
      const { panel } = follow(d);
      expect(panel.scale.x).toBeCloseTo(d / PANEL_DISTANCE_DEFAULT, 6);
      // The invariant that matters: the tab strip's angular height is the same
      // at every distance as it is at the verified default.
      expect(angularSizeDeg(STRIP_H * panel.scale.x, d))
        .toBeCloseTo(angularSizeDeg(STRIP_H, PANEL_DISTANCE_DEFAULT), 6);
    }
  });

  test('at the stepper maximum the tab strip now clears the gaze floor (it did not before)', () => {
    const { panel } = follow(PANEL_DISTANCE_MAX);
    expect(angularSizeDeg(STRIP_H, PANEL_DISTANCE_MAX)).toBeLessThan(GAZE_TARGET_MIN_DEG);
    expect(angularSizeDeg(STRIP_H * panel.scale.x, PANEL_DISTANCE_MAX))
      .toBeGreaterThanOrEqual(GAZE_TARGET_MIN_DEG);
  });

  test('a grab rescales from the CAMERA distance, not the controller distance', () => {
    // The visual angle is subtended at the eye, so the controller's own hold
    // distance is the wrong measure whenever the hand is off to one side.
    // Camera at the origin; controller 1 m to the right holding the panel which
    // starts 3 m ahead, so beginGrab records |(1,0,0)-(0,0,-3)| = 3.162 m and
    // _updateGrab then places the panel at (1, 0, -3.162) — 3.317 m from the eye.
    const wm = new WindowManager(makeNode());
    const panel = makeNode([0, 0, -3]);
    wm.attach(panel);
    wm.beginGrab(makeNode([1, 0, 0]));
    wm.update(16);

    expect(wm.isGrabbing).toBe(true);
    const eyeDist = Math.hypot(panel.position.x, panel.position.y, panel.position.z);
    expect(panel.scale.x).toBeCloseTo(eyeDist / PANEL_DISTANCE_DEFAULT, 6);
    // Distinguishes the two measures: using the controller distance would give
    // a different (smaller) scale here.
    expect(eyeDist).toBeGreaterThan(wm._grab.distance);
    expect(panel.scale.x).not.toBeCloseTo(wm._grab.distance / PANEL_DISTANCE_DEFAULT, 4);
  });

  test('scale is clamped to the stepper range even if a grab pushes further', () => {
    const wm = new WindowManager(makeNode());
    const panel = makeNode([0, 0, -50]); // far past maxDistance
    wm.attach(panel);
    wm.beginGrab(makeNode());
    wm.update(16);
    expect(panel.scale.x).toBeCloseTo(PANEL_DISTANCE_MAX / PANEL_DISTANCE_DEFAULT, 6);
  });

  test('opting out leaves the scale untouched', () => {
    const wm = new WindowManager(makeNode(), { distance: 6.0, angularConstant: false });
    const panel = makeNode();
    wm.attach(panel);
    wm.setFollow(true);
    wm.update(1000);
    expect(panel.scale.x).toBe(1);
  });

  test('billboard-only mode does not rescale (it never moves the panel)', () => {
    const wm = new WindowManager(makeNode(), { distance: 6.0 });
    const panel = makeNode();
    wm.attach(panel);
    wm.setBillboard(true);
    wm.update(16);
    expect(panel.scale.x).toBe(1);
  });
});
