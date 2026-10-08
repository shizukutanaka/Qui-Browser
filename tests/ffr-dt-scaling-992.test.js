/**
 * Round 992 — FFRSystem smoothing must be Hz-invariant.
 *
 * The render loop calls trackHeadPose(quat, dt) / updatePredictedGazeFoveation()
 * / adjustIntensity(±0.01) once per frame. The smoothers inside are per-frame
 * constants — 0.8/0.2 EMA, 0.1 lerp, ±0.01 nudge — so on a 120 Hz headset the
 * velocity estimate decays and the foveation intensity hunts ~2x faster than
 * the authored 60 fps rate, and the frame-budget pressure loop walks at 2x the
 * intended per-second rate. Same defect class as the ComfortSystem fix.
 */
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'vr', 'rendering', 'FFRSystem.js'), 'utf8');
const VRAPP = fs.readFileSync(path.join(__dirname, '..', 'src', 'vr', 'VRApp.js'), 'utf8');

jest.mock('three/examples/jsm/webxr/VRButton.js', () => ({ VRButton: { createButton: () => ({}) } }));
jest.mock('three/examples/jsm/webxr/XRControllerModelFactory.js', () => ({
  XRControllerModelFactory: function () {
    return { createControllerModel: () => ({}) };
  }
}));
const { FFRSystem } = require('../src/vr/rendering/FFRSystem.js');

// Two poses a fixed 90°/s apart per second of dt — drive the EMA with a
// constant angular velocity by stepping the quaternion each call.
function stepHeadTrack(sys, dt, frames) {
  const rate = Math.PI / 2; // rad/s
  for (let i = 0; i < frames; i += 1) {
    const angle = rate * dt * (i + 1);
    sys.trackHeadPose({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) }, dt);
  }
  return sys._headVelocity;
}

describe('FFRSystem Hz-invariant smoothing (round 992)', () => {
  test('structural: smoothers consume dt; the per-frame nudge is scaled by the caller', () => {
    // Anchor on the definition (`name(args) {`) — the bare name also matches
    // earlier JSDoc references and call sites.
    const t0 = SRC.indexOf('trackHeadPose(quat, dtSeconds) {');
    const u0 = SRC.indexOf('updatePredictedGazeFoveation(dtSeconds', t0);
    const track = SRC.slice(t0, u0);
    const upd = SRC.slice(u0, SRC.indexOf('dispose()', u0));
    // The EMA weight must derive from dtSeconds — a bare `* 0.8 + ... * 0.2`
    // pair is the old Hz-coupled form.
    expect(track).not.toMatch(/_headVelocity\s*=\s*this\._headVelocity\s*\*\s*0\.8\s*\+/);
    expect(track).toMatch(/dtSeconds\s*\*\s*60|Math\.pow/);
    // updatePredictedGazeFoveation must take and use dt.
    expect(upd).not.toContain('updatePredictedGazeFoveation()');
    expect(upd).toMatch(/deltaTime|dtSeconds/);
    // The caller must scale the ±0.01/frame budget nudge by the real delta,
    // or the pressure loop's per-second rate doubles at 120 Hz.
    expect(VRAPP).toMatch(/updatePredictedGazeFoveation\(dt\)/);
    expect(VRAPP).toMatch(/adjustIntensity\(0\.01\s*\*\s*dt\s*\*\s*60\)/);
    expect(VRAPP).toMatch(/adjustIntensity\(-0\.01\s*\*\s*dt\s*\*\s*60\)/);
  });

  test('head-velocity EMA: the same elapsed time converges identically at any Hz', () => {
    // First call only stores the pose (no EMA step), so frames−1 EMA updates
    // happen. 4 calls at 60 Hz = 3 EMA steps over 3/60 s; the same duration at
    // 120 Hz is 6 EMA steps = 7 calls.
    const a = new FFRSystem();
    const b = new FFRSystem();
    const at60 = stepHeadTrack(a, 1 / 60, 4);
    const at120 = stepHeadTrack(b, 1 / 120, 7);
    expect(at120).toBeCloseTo(at60, 2);
  });

  test('gaze foveation lerp: two 120 Hz steps equal one 60 Hz step', () => {
    const mk = () => {
      const s = new FFRSystem();
      s.projectionLayer = { set fixedFoveation(v) {} };
      s.predictedGazeEnabled = true;
      s._headVelocity = 0; // still head → target 0.8
      s.intensity = 0.2;
      return s;
    };
    const a = mk();
    a.updatePredictedGazeFoveation(1 / 60);
    const at60 = a.intensity;
    const b = mk();
    b.updatePredictedGazeFoveation(1 / 120);
    b.updatePredictedGazeFoveation(1 / 120);
    expect(b.intensity).toBeCloseTo(at60, 2);
    // 60 Hz calibration preserved: 0.2 + (0.8-0.2)*0.1 = 0.26
    expect(at60).toBeCloseTo(0.26, 5);
  });

  test('budget nudge: the caller rate is per-second, not per-frame', () => {
    // What the VRApp call site passes to adjustIntensity must depend on dt —
    // a literal `adjustIntensity(0.01)` per frame walks twice as fast at 120 Hz.
    expect(VRAPP).not.toMatch(/adjustIntensity\(0\.01\);/);
    expect(VRAPP).not.toMatch(/adjustIntensity\(-0\.01\);/);
  });
});
