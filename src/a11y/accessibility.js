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
function osReducedMotion() {
  return media('(prefers-reduced-motion: reduce)');
}
function osHighContrast() {
  return media('(prefers-contrast: more)') || media('(forced-colors: active)');
}

export function getPrefs() {
  return { ...prefs };
}

/** Apply current preferences (plus OS signals) as body classes. */
export function applyAccessibility() {
  if (typeof document === 'undefined' || !document.body) {
    return;
  }
  const b = document.body;
  b.classList.toggle('a11y-high-contrast', !!prefs.highContrast || osHighContrast());
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
