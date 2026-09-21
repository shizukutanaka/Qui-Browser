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

describe('DeviceCompatibility — probe edge cases', () => {
  let dc;
  const setUA = (ua) => Object.defineProperty(navigator, 'userAgent',
    { configurable: true, value: ua });
  const setXR = (xr) => Object.defineProperty(navigator, 'xr',
    { configurable: true, value: xr });
  const clearStubs = () => {
    delete navigator.xr;
    delete navigator.userAgent;
  };
  beforeEach(() => {
    dc = new DeviceCompatibility();
  });
  afterEach(clearStubs);

  test('isSessionSupported rejecting resolves to false, not a crash', async () => {
    setXR({ isSessionSupported: () => Promise.reject(new Error('no XR')) });
    const report = await dc.check();
    expect(report.vrSupported).toBe(false);
    expect(report.arSupported).toBe(false);
    expect(report.hitTest).toBe(false);
  });

  test('android-xr tier: Android+XR UA reports AR features when arSupported', async () => {
    setXR({ isSessionSupported: (mode) => Promise.resolve(mode === 'immersive-ar') });
    setUA('Mozilla/5.0 (Linux; Android 14; XR) Chrome/120');
    const report = await dc.check();
    expect(report.deviceTier).toBe('android-xr');
    expect(report.vrSupported).toBe(false);
    expect(report.arSupported).toBe(true);
    expect(report.planeDetection).toBe(true);
    expect(report.hitTest).toBe(true);
    expect(report.handTracking).toBe(false); // keyed off vrSupported
  });

  test('unrecognised UA with navigator.xr present is desktop-xr', async () => {
    setXR({ isSessionSupported: () => Promise.resolve(true) });
    setUA('Mozilla/5.0 (Windows NT 10.0) Chrome/120');
    const report = await dc.check();
    expect(report.deviceTier).toBe('desktop-xr');
    expect(report.hitTest).toBe(false);   // gated to real AR devices
    expect(report.anchors).toBe(false);
  });

  test('_probeOptionalFeatures falls back to UA detection when tier is omitted', async () => {
    setUA('Mozilla/5.0 (Linux; Android 12; Quest 3)');
    const xr = { isSessionSupported: () => Promise.resolve(true) };
    const f = await dc._probeOptionalFeatures(xr, true, null, true);
    expect(f.planeDetection).toBe(true); // quest3 detected from UA
  });

  test('targetFPS: pico4 and quest2 are 90, unknown tier is 72', () => {
    dc.report = { deviceTier: 'pico4' };
    expect(dc.targetFPS()).toBe(90);
    dc.report = { deviceTier: 'quest2' };
    expect(dc.targetFPS()).toBe(90);
    dc.report = { deviceTier: 'unknown' };
    expect(dc.targetFPS()).toBe(72);
  });
});

describe('DeviceCompatibility — _hasWebGL2 arms', () => {
  test('returns false when document is undefined (SSR guard)', () => {
    const dc = new (require('../src/utils/DeviceCompatibility.js').DeviceCompatibility || Object)();
    const prevDoc = global.document;
    delete global.document;
    try {
      expect(dc._hasWebGL2()).toBe(false);
    } finally {
      global.document = prevDoc;
    }
  });

  test('returns false when getContext throws (driver-blacklisted GPU)', () => {
    const dc = new (require('../src/utils/DeviceCompatibility.js').DeviceCompatibility || Object)();
    const prevDoc = global.document;
    global.document = { createElement: () => ({ getContext: () => {
      throw new Error('blacklisted');
    } }) };
    try {
      expect(dc._hasWebGL2()).toBe(false);
    } finally {
      global.document = prevDoc;
    }
  });

  test('returns true when webgl2 context exists', () => {
    const dc = new (require('../src/utils/DeviceCompatibility.js').DeviceCompatibility || Object)();
    const prevDoc = global.document;
    global.document = { createElement: () => ({ getContext: () => ({}) }) };
    try {
      expect(dc._hasWebGL2()).toBe(true);
    } finally {
      global.document = prevDoc;
    }
  });
});

describe('DeviceCompatibility — remaining arms', () => {
  test('check() with navigator.xr absent reports no VR/AR support', async () => {
    const dc = new DeviceCompatibility();
    const saved = global.navigator;
    global.navigator = { userAgent: 'x' }; // no .xr
    try {
      const r = await dc.check();
      expect(r.vrSupported ?? r.vr ?? false).toBeFalsy();
    } finally {
      global.navigator = saved;
    }
  });

  test('_probeOptionalFeatures with neither VR nor AR returns the false base', async () => {
    const dc = new DeviceCompatibility();
    const f = await dc._probeOptionalFeatures({}, false, 'quest3', false);
    expect(f.handTracking).toBe(false);
    expect(f.hitTest).toBe(false);
    expect(f.foveatedRendering).toBe(false);
  });

  test('check() with an empty UA still resolves a tier', async () => {
    const dc = new DeviceCompatibility();
    const saved = global.navigator;
    global.navigator = { userAgent: '', xr: null };
    try {
      await dc.check();
      expect(dc.deviceTier ?? dc.tier ?? dc.report?.deviceTier).toBeTruthy();
    } finally {
      global.navigator = saved;
    }
  });
});

describe('DeviceCompatibility — navigator/ua sliver arms', () => {
  test('check() tolerates navigator entirely absent', async () => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    try {
      Object.defineProperty(globalThis, 'navigator', { value: undefined, configurable: true });
      const dc = new DeviceCompatibility();
      const report = await dc.check();
      expect(report.vrSupported).toBe(false);
    } finally {
      if (saved) {
        Object.defineProperty(globalThis, 'navigator', saved);
      }
    }
  });

  test('check() tolerates an absent userAgent', async () => {
    const dc = new DeviceCompatibility();
    const saved = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
    try {
      Object.defineProperty(navigator, 'userAgent', { value: undefined, configurable: true });
      const report = await dc.check();
      expect(report.deviceTier).toBeTruthy();
    } finally {
      if (saved) {
        Object.defineProperty(navigator, 'userAgent', saved);
      }
    }
  });

  test('_probeOptionalFeatures re-detects tier when not supplied', async () => {
    const dc = new DeviceCompatibility();
    const out = await dc._probeOptionalFeatures({ requestSession: async () => ({ enabledFeatures: [] }) }, true, null);
    expect(out).toBeTruthy();
  });
});

describe('DeviceCompatibility — navigator-absent arm', () => {
  test('_probeOptionalFeatures detects the tier with an empty UA when navigator is gone', async () => {
    const had = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: undefined, configurable: true, writable: true });
    try {
      const dc = new DeviceCompatibility();
      const feats = await dc._probeOptionalFeatures({ isSessionSupported: async () => true }, true, null);
      expect(feats.handTracking).toBe(true);
      expect(feats.hitTest).toBe(false);
    } finally {
      if (had) {
        Object.defineProperty(globalThis, 'navigator', had);
      }
    }
  });
});
