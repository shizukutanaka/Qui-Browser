/**
 * Lightweight accessibility preferences for the 2D landing page.
 *
 * - High-contrast and large-text modes, persisted in localStorage.
 * - Honors OS signals: prefers-reduced-motion and prefers-contrast/forced-colors
 *   are applied automatically (in addition to the user's explicit choices).
 * - applyAccessibility() toggles body classes that main.css styles.
 */

const STORAGE_KEY = 'qui-browser:a11y';

function load() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) || {};
      }
    }
  } catch (e) { /* ignore */ }
  return {};
}

const prefs = Object.assign({ highContrast: false, largeText: false }, load());

function media(query) {
  return typeof matchMedia !== 'undefined' && matchMedia(query).matches;
}
export function osReducedMotion() {
  return media('(prefers-reduced-motion: reduce)');
}
export function osHighContrast() {
  return media('(prefers-contrast: more)') || media('(forced-colors: active)');
}

export function getPrefs() {
  return { ...prefs };
}

/**
 * The effective high-contrast decision: true when the user has explicitly
 * enabled high-contrast OR the OS requests it (prefers-contrast / forced-colors).
 *
 * Single source of truth — the VR canvas surfaces (settings panel, bookmark
 * panel, toasts) all derive their high-contrast palette from this one call so
 * the precedence (explicit user choice OR OS signal) stays coordinated.
 * Previously each call site repeated `getPrefs().highContrast || osHighContrast()`,
 * which risked drifting if the precedence ever changed.
 *
 * @returns {boolean}
 */
export function prefersHighContrast() {
  return !!prefs.highContrast || osHighContrast();
}

/**
 * The standard multiplier applied to VR UI element sizes when the large-text
 * preference is on. Single source of truth — VR panels, the keyboard, toasts,
 * and captions all derive their scale from this so the factor stays coordinated
 * (previously each call site hard-coded its own literal, which drifted).
 */
export const LARGE_TEXT_SCALE = 1.3;

/**
 * Resolve a size multiplier for the large-text preference.
 *
 * Returns `base` when large-text is on, otherwise 1.0 (no scaling). Most
 * surfaces use the default `base` (LARGE_TEXT_SCALE); a surface that needs a
 * deliberately different factor — e.g. transient captions, which warrant a
 * larger boost — passes its own `base` so the intent is explicit rather than a
 * bare literal.
 *
 * @param {boolean} largeText  - the large-text preference (getPrefs().largeText)
 * @param {number}  [base=LARGE_TEXT_SCALE] - multiplier to use when on
 * @returns {number} a size multiplier (1.0 when large-text is off)
 */
export function largeTextScale(largeText, base = LARGE_TEXT_SCALE) {
  return largeText ? base : 1.0;
}

/** Apply current preferences (plus OS signals) as body classes. */
export function applyAccessibility() {
  if (typeof document === 'undefined' || !document.body) {
    return;
  }
  const b = document.body;
  b.classList.toggle('a11y-high-contrast', prefersHighContrast());
  b.classList.toggle('a11y-large-text', !!prefs.largeText);
  b.classList.toggle('a11y-reduced-motion', osReducedMotion());
}

/** Set a preference, persist it, and re-apply. Returns the new value. */
export function setPref(key, value) {
  prefs[key] = value;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    }
  } catch (e) { /* ignore */ }
  applyAccessibility();
  return value;
}

/** Flip a boolean preference. */
export function togglePref(key) {
  return setPref(key, !prefs[key]);
}
