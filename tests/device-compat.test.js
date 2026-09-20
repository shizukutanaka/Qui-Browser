/**
 * Unit tests for DeviceCompatibility (NFR-2).
 * navigator.xr is stubbed to undefined by tests/setup.js so VR support
 * probes return false — which is fine for testing the pure-logic paths.
 */
const { DeviceCompatibility } = require('../src/utils/DeviceCompatibility.js');

describe('DeviceCompatibility', () => {
  let dc;

  beforeEach(() => {
    dc = new DeviceCompatibility();
  });

  test('check() resolves to a report object', async () => {
    const report = await dc.check();
    expect(report).toBeDefined();
    expect(typeof report.vrSupported).toBe('boolean');
    expect(typeof report.deviceTier).toBe('string');
  });

  test('check() caches the result', async () => {
    const r1 = await dc.check();
    const r2 = await dc.check();
    expect(r1).toBe(r2);
  });

  test('_detectTier identifies Quest 3 from UA', () => {
    expect(dc._detectTier('Mozilla/5.0 (Linux; Android 12; Quest 3) ...')).toBe('quest3');
  });

  test('_detectTier identifies Quest 2 from UA', () => {
    expect(dc._detectTier('Mozilla/5.0 (Linux; Android 10; Quest 2) ...')).toBe('quest2');
  });

  test('_detectTier identifies Pico 4 from UA', () => {
    expect(dc._detectTier('... Pico 4 ...')).toBe('pico4');
  });

  test('_detectTier returns unknown for unrecognised UA', () => {
    expect(dc._detectTier('Mozilla/5.0 (Windows NT 10.0) ...')).toBe('unknown');
  });

  test('targetFPS() returns 72 when report is not yet available', () => {
    expect(dc.targetFPS()).toBe(72);
  });

  test('targetFPS() returns 120 for quest3 tier', async () => {
    // Force the tier in the cached report.
    dc.report = { deviceTier: 'quest3' };
    expect(dc.targetFPS()).toBe(120);
  });

  test('targetFPS() returns 90 for quest2 tier', async () => {
    dc.report = { deviceTier: 'quest2' };
    expect(dc.targetFPS()).toBe(90);
  });
});

// B-1: hitTest/anchors/planeDetection are immersive-ar session features, but the
// probe keyed them off vrSupported — a VR-only device would report AR
// capabilities it cannot have (and vice-versa an AR-capable, VR-less runtime
// would report none).
describe('B-1: AR feature flags key off immersive-ar support', () => {
  let dc;

  beforeEach(() => {
    dc = new DeviceCompatibility();
  });

  test('VR-only device reports no AR features', async () => {
    const feats = await dc._probeOptionalFeatures({}, true, 'quest3', false);
    expect(feats.hitTest).toBe(false);
    expect(feats.anchors).toBe(false);
    expect(feats.planeDetection).toBe(false);
    // VR-keyed features are unaffected by the AR flag.
    expect(feats.handTracking).toBe(true);
    expect(feats.foveatedRendering).toBe(true);
  });

  test('AR-capable device reports AR features', async () => {
    const feats = await dc._probeOptionalFeatures({}, false, 'quest3', true);
    expect(feats.hitTest).toBe(true);
    expect(feats.anchors).toBe(true);
    expect(feats.planeDetection).toBe(true);
    // …and VR-keyed features correctly report the (absent) VR support.
    expect(feats.handTracking).toBe(false);
  });

  test('check() threads the measured arSupported into the probe', async () => {
    const xrStub = { isSessionSupported: async (mode) => mode === 'immersive-vr' };
    Object.defineProperty(navigator, 'xr', { value: xrStub, configurable: true });
    Object.defineProperty(navigator, 'userAgent',
      { value: 'Mozilla/5.0 (Linux; Android 12; Quest 3)', configurable: true });
    try {
      const report = await dc.check();
      expect(report.vrSupported).toBe(true);
      expect(report.arSupported).toBe(false);
      expect(report.deviceTier).toBe('quest3');
      expect(report.hitTest).toBe(false);
      expect(report.planeDetection).toBe(false);
    } finally {
      delete navigator.xr;
      delete navigator.userAgent;
    }
  });
});
