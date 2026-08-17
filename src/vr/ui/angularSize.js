/**
 * Angular size of interactive targets — the unit that actually decides whether
 * a control can be hit in VR.
 *
 * Every target in this app is specified in **metres**, and metres say nothing
 * about hittability on their own: a 0.035 m strip is a comfortable grab handle
 * at 0.5 m and an invisible sliver at 6 m. What matters is the angle it
 * subtends at the eye, because that is what both the pointing hardware and the
 * user's motor precision are bounded in. Session 62 established this for
 * *legibility* (text was checked in arcmin against the 16–32 arcmin band);
 * nothing has ever checked it for *targets*.
 *
 * The thresholds below are external, not invented here:
 *
 *  - `HIT_TARGET_MIN_DEG = 3` — Meta Horizon OS accessibility guidance states
 *    comfortably-sized hit targets are a minimum of 22 mm × 22 mm / 48 dp /
 *    "3° FOV at 0.42 m", and that a visual target smaller than the hit target
 *    is fine but should be given invisible **hitslop** out to the full 48 dp.
 *    That hitslop remedy is what `MOVE_BAR_HIT_H` in WebPanel implements.
 *  - `GAZE_TARGET_MIN_DEG = 1.5` and `GAZE_SPACING_MIN_DEG = 1.0` — from the
 *    eye-movement HCI literature summarised in recent gaze-selection work
 *    (CasualGaze, arXiv:2408.12710): for ordinary interactive systems dwell
 *    should be ~500 ms with object size not less than 1.5° and object spacing
 *    not less than 1.0°. This is the harder floor for this project, because
 *    gaze-dwell is the *primary* input path for the users it is built for —
 *    a control below it is not "fiddly", it is unreachable for them.
 *
 * The two are used differently: 1.5° is treated as a hard invariant in
 * tests/target-size.test.js, and 3° as the recommendation to report against.
 * Meeting 3° everywhere would mean resizing panels, not fixing defects.
 *
 * Pure / dependency-free.
 */

/** Meta Horizon OS: comfortable hit target ≈ 3° of field of view. */
export const HIT_TARGET_MIN_DEG = 3;
/** Gaze-dwell literature: interactive object not less than 1.5°. */
export const GAZE_TARGET_MIN_DEG = 1.5;
/** Gaze-dwell literature: spacing between objects not less than 1.0°. */
export const GAZE_SPACING_MIN_DEG = 1.0;

/**
 * Angle subtended by an object of `sizeM` viewed head-on from `distanceM`.
 *
 * Uses the exact `2·atan(size / 2d)` form rather than the small-angle
 * approximation `size / d`: at the close end of this app's range (a 1.6 m
 * panel at 0.6 m) the approximation is off by tens of degrees.
 *
 * @param {number} sizeM      extent in metres
 * @param {number} distanceM  eye-to-target distance in metres
 * @returns {number} degrees; 0 for degenerate input
 */
export function angularSizeDeg(sizeM, distanceM) {
  const s = Number(sizeM);
  const d = Number(distanceM);
  if (!Number.isFinite(s) || !Number.isFinite(d) || s <= 0 || d <= 0) {
    return 0;
  }
  return 2 * Math.atan(s / (2 * d)) * (180 / Math.PI);
}

/**
 * Inverse of `angularSizeDeg`: the metre extent needed to subtend `deg`.
 * Use this to derive a hitslop size from a threshold instead of guessing one.
 *
 * @param {number} deg
 * @param {number} distanceM
 * @returns {number} metres; 0 for degenerate input
 */
export function sizeForAngleM(deg, distanceM) {
  const a = Number(deg);
  const d = Number(distanceM);
  if (!Number.isFinite(a) || !Number.isFinite(d) || a <= 0 || d <= 0 || a >= 180) {
    return 0;
  }
  return 2 * d * Math.tan((a * Math.PI / 180) / 2);
}

/**
 * Metre extent of a canvas-pixel region drawn onto a mesh.
 *
 * Most targets here are not meshes but pixel ranges inside one canvas texture
 * (the chrome bar's buttons, the bookmark rows, the reader arrows), so their
 * real-world size is only derivable through the mesh they are painted on.
 * Computing it by hand at each call site is how the unit gets lost.
 *
 * @param {number} regionPx  extent of the region in canvas pixels
 * @param {number} canvasPx  full canvas extent in the same axis
 * @param {number} meshM     full mesh extent in the same axis, in metres
 * @returns {number} metres; 0 for degenerate input
 */
export function canvasRegionToMetres(regionPx, canvasPx, meshM) {
  const r = Number(regionPx);
  const c = Number(canvasPx);
  const m = Number(meshM);
  if (![r, c, m].every(Number.isFinite) || r <= 0 || c <= 0 || m <= 0) {
    return 0;
  }
  return (r / c) * m;
}

/**
 * Classify a measured angular size against the two thresholds.
 *
 * `'too-small'` means below the gaze-dwell floor — unreachable for the users
 * gaze-dwell exists to serve, not merely awkward. `'usable'` clears that floor
 * but not Meta's comfortable-hit-target recommendation.
 *
 * @param {number} deg
 * @returns {'comfortable'|'usable'|'too-small'}
 */
export function classifyTarget(deg) {
  const a = Number(deg) || 0;
  if (a >= HIT_TARGET_MIN_DEG) {
    return 'comfortable';
  }
  return a >= GAZE_TARGET_MIN_DEG ? 'usable' : 'too-small';
}
