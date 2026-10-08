/**
 * Round-991 pins: ComfortSystem vignette/FOV smoothing must be Hz-invariant.
 *
 * Defect: `updateVignette(_deltaTime)` / `updateFOV(_deltaTime)` receive the
 * frame delta and ignore it — the `current += (target - current) * smoothing`
 * step runs per FRAME, so the comfort tunnel's fade rate scales with render
 * Hz. Authored at 60 fps-equivalent (smoothing = 0.1 of remaining distance),
 * it runs ~1.5× faster on a 90 Hz Quest 3 and ~2× faster at 120 Hz — the
 * signature literally promises time-awareness it doesn't deliver. The sibling
 * WindowManager already normalises (`Math.min(1, lerp * (dtMs / 16.6667))`);
 * ComfortSystem is the outlier.
 */

const { ComfortSystem } = require('../src/vr/comfort/ComfortSystem.js');
const THREE = require('three');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'vr', 'comfort', 'ComfortSystem.js'), 'utf8');

function makeSystem() {
  const sys = new ComfortSystem(new THREE.PerspectiveCamera(90, 1, 0.1, 100));
  sys.isRotating = true; // → motionLevel 1 → vignette target = intensity
  sys.isMoving = true; // → FOV target = baseFOV - reductionAmount
  return sys;
}

describe('ComfortSystem Hz-invariant smoothing (round 991)', () => {
  test('structural: vignette/FOV updates actually use the delta they are handed', () => {
    const vignStart = SRC.indexOf('updateVignette(deltaTime) {');
    const fovStart = SRC.indexOf('updateFOV(deltaTime) {');
    const vign = SRC.slice(vignStart, fovStart);
    const fov = SRC.slice(fovStart, fovStart + 2200);
    // The delta must participate in the smoothing step — an ignored
    // `_deltaTime` parameter is the old lie.
    expect(vign).not.toContain('updateVignette(_deltaTime)');
    expect(fov).not.toContain('updateFOV(_deltaTime)');
    expect(vign).toMatch(/deltaTime\s*[*\/]/);
    expect(fov).toMatch(/deltaTime\s*[*\/]/);
  });

  test('vignette: two 120 Hz steps converge like one 60 Hz step, not twice as far', () => {
    const sys = makeSystem();
    // One 60 Hz-equivalent frame.
    sys.currentVignette = 0;
    sys.updateVignette(1 / 60);
    const oneSixtieth = sys.currentVignette;

    // Two 120 Hz-equivalent frames on a fresh run must land near the same
    // place — same elapsed time, same approach.
    sys.currentVignette = 0;
    sys.updateVignette(1 / 120);
    sys.updateVignette(1 / 120);
    const twoOneTwentieths = sys.currentVignette;

    expect(twoOneTwentieths).toBeCloseTo(oneSixtieth, 2);
    // And the 60 Hz step itself still matches the authored constant
    // (smoothing = 0.1 of remaining distance, intensity = 0.4).
    expect(oneSixtieth).toBeCloseTo(0.4 * 0.1, 4);
  });

  test('vignette: the rate is not proportional to frame count anymore', () => {
    const sys = makeSystem();
    sys.currentVignette = 0;
    sys.updateVignette(1 / 60);
    const at60 = sys.currentVignette;
    sys.currentVignette = 0;
    sys.updateVignette(1 / 120);
    const at120 = sys.currentVignette;
    // Faster Hz ⇒ SMALLER per-frame step; the old code stepped identically.
    expect(at120).toBeLessThan(at60);
  });

  test('FOV: two 120 Hz steps converge like one 60 Hz step, not twice as far', () => {
    const sys = makeSystem();
    const target = sys.settings.fov.baseFOV - sys.settings.fov.reductionAmount;

    sys.currentFOV = sys.settings.fov.baseFOV;
    sys.updateFOV(1 / 60);
    const oneSixtieth = sys.currentFOV;

    sys.currentFOV = sys.settings.fov.baseFOV;
    sys.updateFOV(1 / 120);
    sys.updateFOV(1 / 120);
    const twoOneTwentieths = sys.currentFOV;

    expect(twoOneTwentieths).toBeCloseTo(oneSixtieth, 1);
    // 60 Hz calibration preserved: base 90 → target 65, step = 25 * 0.1 = 2.5
    expect(oneSixtieth).toBeCloseTo(90 - 2.5, 2);
    expect(target).toBe(65);
  });
});
