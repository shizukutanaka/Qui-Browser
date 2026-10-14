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
// Simple in-memory map. jest's clearMocks/resetMocks only reset jest.fn()
// state, so isolation is provided explicitly via beforeEach below.
if (typeof localStorage === 'undefined') {
  const store = new Map();
  global.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (i) => [...store.keys()][i] ?? null
  };
  beforeEach(() => store.clear());
}

// ── navigator stub ────────────────────────────────────────────────────────────
// Ensures `navigator` exists so feature checks don't throw. The `xr` key is
// deliberately absent: `('xr' in navigator)` and `navigator.xr` truthiness
// both correctly report XR as unavailable (assigning `xr = undefined` would
// make the `in` check true and send `in`-guarding modules down the XR path).
if (typeof navigator === 'undefined') {
  global.navigator = {};
}

// ── console.debug sink ────────────────────────────────────────────────────────
// src/ logs one console.debug per voice-command registration and dispatch.
// Without --silent (CI runs `npm test -- --coverage`), Jest buffers every call
// with a stack trace: ~1.2 GB of output and 16/518 suites in 15 min, so the
// Unit Tests job always hit timeout-minutes. Tests that assert on debug output
// still work via jest.spyOn(console, 'debug').
console.debug = () => {};
