/**
 * Pure helpers for numeric in-VR settings steppers.
 *
 * Kept free of Three.js so the value-stepping and hit-region maths can be
 * unit-tested headlessly. A stepper mesh is laid out as three regions across
 * its width:  [ −  |  value  |  + ].
 */

// Fractional x boundaries of the minus / value / plus regions.
export const MINUS_MAX_U = 0.25; // u < 0.25  → decrement
export const PLUS_MIN_U = 0.75;  // u > 0.75  → increment

/**
 * Step a numeric value by `delta` steps, clamped to [min, max] and snapped to
 * the step grid. Floating-point dust is rounded away.
 *
 * @param {number} current
 * @param {number} delta   +1 or -1 (or any integer count of steps)
 * @param {object} opts    { min, max, step }
 * @returns {number} the new value
 */
export function stepValue(current, delta, { min, max, step }) {
  const raw = current + delta * step;
  const clamped = Math.min(max, Math.max(min, raw));
  // Snap to the step grid relative to min, then round to kill FP error.
  const snapped = min + Math.round((clamped - min) / step) * step;
  const decimals = decimalsFor(step);
  return Number(snapped.toFixed(decimals));
}

/** Number of decimal places implied by a step (e.g. 0.5 → 1, 15 → 0). */
export function decimalsFor(step) {
  if (Number.isInteger(step)) {
    return 0;
  }
  const s = String(step);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

/**
 * Map a normalized horizontal position u∈[0,1] on the stepper mesh to an action.
 * @returns {'decrement'|'increment'|'none'}
 */
export function stepperRegion(u) {
  if (u < MINUS_MAX_U) {
    return 'decrement';
  }
  if (u > PLUS_MIN_U) {
    return 'increment';
  }
  return 'none';
}

/**
 * Format a value for display, with an optional unit suffix.
 */
export function formatValue(value, { step = 1, unit = '' } = {}) {
  const decimals = decimalsFor(step);
  return `${Number(value).toFixed(decimals)}${unit}`;
}

/**
 * Build the caption text announced when a settings button is hovered during
 * gaze-dwell navigation, so users relying on gaze select can identify which
 * control they are dwelling on without reading the canvas label (WCAG 1.3.3
 * Sensory Characteristics, 4.1.3 Status Messages).
 *
 * Pure so the announcement format is unit-testable.
 *
 * @param {'toggle'|'stepper'|'cycle'|'action'} type
 * @param {string} label   the button's visible label
 * @param {*}      value   the current setting value (boolean for toggle,
 *                         number for stepper, string for cycle; ignored for action)
 * @param {object} [opts]  stepper formatting options forwarded to formatValue
 * @returns {string}
 */
export function settingsButtonCaption(type, label, value, opts = {}) {
  if (type === 'toggle') {
    return `${label}: ${value ? 'ON' : 'OFF'}`;
  }
  if (type === 'stepper') {
    return `${label}: ${formatValue(value, opts)}`;
  }
  if (type === 'cycle') {
    return `${label}: ${value}`;
  }
  return label; // action button
}

/**
 * Decide whether a settings-button caption should be spoken.
 *
 * Captions must be enabled at all. Beyond that there are two contexts:
 *  - hover (force=false): only announce while gaze-dwell is active, so a
 *    controller user sweeping the ray across the panel isn't flooded.
 *  - select (force=true): a deliberate activation always warrants the
 *    confirmation, even for controller users, because a gaze user's ray stays
 *    on the button after it fires and the hover handler does not re-run.
 *
 * Pure so the gate is unit-testable without VRApp / a caption subsystem.
 *
 * @param {object} state
 * @param {boolean} state.captionsEnabled
 * @param {boolean} state.gazeDwell
 * @param {boolean} [state.force=false]
 * @returns {boolean}
 */
export function shouldAnnounceSettingsButton({ captionsEnabled, gazeDwell, force = false }) {
  if (!captionsEnabled) {
    return false;
  }
  return force || !!gazeDwell;
}
