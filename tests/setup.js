/**
 * Jest global test setup (setupFilesAfterEnv).
 * Provides minimal browser-API stubs so src/ modules that guard against
 * missing globals (localStorage, navigator.xr) behave consistently across
 * the Node test environment without needing per-file boilerplate.
 *
 * Heavier module-specific mocks (AudioContext, THREE, WebXR frame objects)
 * remain in the individual test files where the context makes them clear.
 */

// ── localStorage shim ─────────────────────────────────────────────────────────
// Simple in-memory map; cleared automatically between tests by jest's
// clearMocks / resetMocks / restoreMocks flags in jest.config.js.
if (typeof localStorage === 'undefined') {
  const store = new Map();
  global.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i) => [...store.keys()][i] ?? null
  };
}

// ── navigator.xr stub ─────────────────────────────────────────────────────────
// Prevents "Cannot read properties of undefined (reading 'xr')" in modules
// that do a feature check (if ('xr' in navigator)) at import time.
if (typeof navigator === 'undefined') {
  global.navigator = {};
}
if (!('xr' in navigator)) {
  navigator.xr = undefined;
}
