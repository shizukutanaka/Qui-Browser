/**
 * localStorage persistence for VR user settings.
 *
 * The VR session reads persisted overrides at startup (whitelisted against the
 * defaults so a stale key can't inject a field) and writes on every change.
 * Pure module — the caller owns the settings object.
 */

const SETTINGS_KEY = 'qui-browser:settings';

export function loadPersistedSettings(defaults) {
  try {
    if (typeof localStorage === 'undefined') {
      return {};
    }
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    const allowed = {};
    for (const key of Object.keys(defaults)) {
      if (key in parsed) {
        allowed[key] = parsed[key];
      }
    }
    return allowed;
  } catch (e) {
    console.warn('VRApp: failed to load persisted settings', e);
    return {};
  }
}

/**
 * Persist the current settings to localStorage. Safe to call from setting
 * toggles/UI; no-ops when storage is unavailable.
 */
export function saveSettings(settings) {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('VRApp: failed to persist settings', e);
  }
}

/**
 * Update a single setting and persist. Returns the new value.
 */
export function updateSetting(settings, key, value) {
  settings[key] = value;
  saveSettings(settings);
  return value;
}
