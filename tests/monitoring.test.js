/**
 * Unit tests for monitoring.js.
 * import.meta.env is stubbed via babel-plugin-transform-import-meta so the
 * module compiles under Jest/Node.  Sentry, GA, and web-vitals are optional
 * external deps — all mocked here so they are absent during tests.
 */

// ── browser API stubs (missing in Node) ──────────────────────────────────────
global.window = global.window || {};
global.window.addEventListener    = jest.fn();
global.window.removeEventListener = jest.fn();
global.document = global.document || {};
global.document.addEventListener    = jest.fn();
global.document.removeEventListener = jest.fn();
global.document.hidden = false;

// ── Optional external deps — all missing in test env ─────────────────────────
jest.mock('@sentry/browser', () => {
  throw new Error('not installed');
}, { virtual: true });
jest.mock('@sentry/tracing', () => {
  throw new Error('not installed');
}, { virtual: true });
jest.mock('web-vitals', () => ({
  onCLS: jest.fn(),
  onFCP: jest.fn(),
  onLCP: jest.fn(),
  onTTFB: jest.fn(),
  onINP: jest.fn()
}), { virtual: true });

const {
  initializeMonitoring,
  disposeMonitoring,
  initWebVitals,
  trackEvent,
  captureError,
  captureMessage,
  trackFPS,
  trackMemory,
  trackInteraction,
  trackVRSession,
  trackVRError,
  reportPerformanceSummary
} = require('../src/monitoring.js');
const { onINP } = require('web-vitals');

describe('monitoring.js', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    disposeMonitoring(); // ensure clean module state
  });

  afterEach(() => {
    disposeMonitoring();
    jest.useRealTimers();
  });

  // ── initializeMonitoring / disposeMonitoring ──────────────────────────────────
  test('initializeMonitoring registers visibilitychange and beforeunload', async () => {
    await initializeMonitoring();
    expect(document.addEventListener).toHaveBeenCalledWith(
      'visibilitychange', expect.any(Function)
    );
    expect(window.addEventListener).toHaveBeenCalledWith(
      'beforeunload', expect.any(Function)
    );
  });

  test('initializeMonitoring is idempotent (double-init cleans up first)', async () => {
    await initializeMonitoring();
    await initializeMonitoring();
    // disposeMonitoring called at start of second init; listeners re-registered once
    const addCalls = document.addEventListener.mock.calls.filter(
      c => c[0] === 'visibilitychange'
    ).length;
    expect(addCalls).toBe(2); // one per initializeMonitoring call
  });

  test('disposeMonitoring removes listeners and clears interval', async () => {
    await initializeMonitoring();
    disposeMonitoring();
    expect(document.removeEventListener).toHaveBeenCalledWith(
      'visibilitychange', expect.any(Function)
    );
    expect(window.removeEventListener).toHaveBeenCalledWith(
      'beforeunload', expect.any(Function)
    );
  });

  test('disposeMonitoring is safe to call multiple times', () => {
    expect(() => {
      disposeMonitoring();
      disposeMonitoring();
    }).not.toThrow();
  });

  test('initializeMonitoring starts the performance-report interval', async () => {
    await initializeMonitoring();
    // Advance by one report interval (60 000ms)
    jest.advanceTimersByTime(60000);
    // reportPerformanceSummary fires — no crash
  });

  // ── trackEvent ────────────────────────────────────────────────────────────────
  test('trackEvent does not throw without GA configured', () => {
    expect(() => trackEvent('test_event', { foo: 'bar' })).not.toThrow();
  });

  test('trackEvent does not throw with no payload', () => {
    expect(() => trackEvent('no_payload')).not.toThrow();
  });

  // ── captureError ──────────────────────────────────────────────────────────────
  test('captureError accepts Error objects', () => {
    expect(() => captureError(new Error('oops'), { context: 'test' })).not.toThrow();
  });

  test('captureError accepts string messages', () => {
    expect(() => captureError('something went wrong')).not.toThrow();
  });

  // ── captureMessage ────────────────────────────────────────────────────────────
  test('captureMessage does not throw', () => {
    expect(() => captureMessage('hello', { level: 'info' })).not.toThrow();
  });

  // ── metric trackers ───────────────────────────────────────────────────────────
  test('trackFPS does not throw', () => {
    expect(() => trackFPS(90)).not.toThrow();
  });

  test('trackMemory does not throw', () => {
    expect(() => trackMemory(256)).not.toThrow();
  });

  test('trackInteraction does not throw', () => {
    expect(() => trackInteraction('click', 12)).not.toThrow();
  });

  // ── VR helpers ────────────────────────────────────────────────────────────────
  test('trackVRSession does not throw', () => {
    expect(() => trackVRSession('start', { device: 'Quest 3' })).not.toThrow();
  });

  test('trackVRError accepts Error and context', () => {
    expect(() => trackVRError(new Error('vr fail'), { step: 'init' })).not.toThrow();
  });

  // ── reportPerformanceSummary ──────────────────────────────────────────────────
  // Note: in the test environment MONITORING_CONFIG.enabled = false (not PROD),
  // so reportPerformanceSummary() returns undefined early.  We verify it at least
  // does not throw and behaves consistently with the disabled guard.
  test('reportPerformanceSummary does not throw when disabled', () => {
    expect(() => reportPerformanceSummary()).not.toThrow();
  });

  // ── Web Vitals INP threshold ──────────────────────────────────────────────────
  // web-vitals v3+ replaced FID with INP (initWebVitals already subscribes to
  // onINP, not the removed onFID), but MONITORING_CONFIG.performance.thresholds
  // still had a "fid" key, not "inp". onVitalReport looks the threshold up via
  // thresholds[name.toLowerCase()] — for an INP report that's thresholds.inp,
  // which was undefined, so the Sentry escalation path could never fire for INP
  // regardless of how bad the value was. Verified via the dev-mode console.debug
  // log (reachable in tests since MONITORING_CONFIG.enabled is false here), which
  // logs the same thresholds[name.toLowerCase()] lookup onVitalReport uses.
  describe('Web Vitals INP threshold (regression: config key was still "fid")', () => {
    test('resolves a real threshold value for an INP report, not undefined', async () => {
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
      await initWebVitals();
      const onVitalReport = onINP.mock.calls[0][0];

      onVitalReport({ name: 'INP', value: 250, rating: 'needs-improvement', delta: 250 });

      const call = debugSpy.mock.calls.find(c => c[0] === 'Web Vital - INP:');
      expect(call).toBeTruthy();
      expect(call[1].threshold).toBe(200);

      debugSpy.mockRestore();
    });
  });
});
