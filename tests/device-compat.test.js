/**
 * Unit tests for DeviceCompatibility (NFR-2).
 * The report is intentionally minimal: only deviceTier is consumed
 * (VRApp targetFPS + telemetry). Session-support probing lives in the
 * entry layer (main.js/app.js) which calls navigator.xr directly.
 */
const { DeviceCompatibility } = require('../src/utils/DeviceCompatibility.js');

describe('DeviceCompatibility', () => {
  let dc;

  beforeEach(() => {
    dc = new DeviceCompatibility();
  });

  test('check() resolves to a report with a deviceTier string', async () => {
    const report = await dc.check();
    expect(report).toBeDefined();
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
    expect(dc._detectTier('... PicoNeo4 ...')).toBe('pico4');
    expect(dc._detectTier('... Pico Neo 4 ...')).toBe('pico4');
  });

  test('_detectTier covers Quest Pro / PICO 4 Ultra / Pico Neo 3', () => {
    // Real-device UA spellings: Quest Pro is a distinct 'Quest Pro' token,
    // Pico 4 Ultra reports all-caps 'PICO 4 Ultra' in PicoBrowser, and Pico
    // Neo 3 is 'Pico Neo 3'. All previously fell to 'unknown' → 72fps even
    // though each device supports 90Hz.
    expect(dc._detectTier('Mozilla/5.0 (X11; Linux x86_64; Quest Pro) OculusBrowser/34.0')).toBe('quest-pro');
    expect(dc._detectTier('Mozilla/5.0 (X11; Linux x86_64; PICO 4 Ultra) PicoBrowser/6.0')).toBe('pico4');
    expect(dc._detectTier('Mozilla/5.0 (X11; Linux x86_64; Pico Neo 3) PicoBrowser/4.0')).toBe('pico-neo3');
    // Quest 3S still resolves through the Quest 3 rule.
    expect(dc._detectTier('Mozilla/5.0 (X11; Linux x86_64; Quest 3S) OculusBrowser/37.5')).toBe('quest3');
  });

  test('_detectTier identifies Android XR devices', () => {
    expect(dc._detectTier('Mozilla/5.0 (Linux; Android 14; XR) Chrome/120')).toBe('android-xr');
  });

  test('_detectTier returns unknown for unrecognised UA', () => {
    expect(dc._detectTier('Mozilla/5.0 (Windows NT 10.0) ...')).toBe('unknown');
  });

  test('targetFPS() returns 72 when report is not yet available', () => {
    expect(dc.targetFPS()).toBe(72);
  });

  test('targetFPS() returns 120 for quest3 tier', () => {
    dc.report = { deviceTier: 'quest3' };
    expect(dc.targetFPS()).toBe(120);
  });

  test('targetFPS() returns 90 for quest2 tier', () => {
    dc.report = { deviceTier: 'quest2' };
    expect(dc.targetFPS()).toBe(90);
  });

  test('targetFPS: pico4 is 90, unknown tier is 72', () => {
    dc.report = { deviceTier: 'pico4' };
    expect(dc.targetFPS()).toBe(90);
    dc.report = { deviceTier: 'unknown' };
    expect(dc.targetFPS()).toBe(72);
  });

  test('targetFPS: quest-pro and pico-neo3 are 90Hz tiers', () => {
    // Both devices support 90Hz; previously they detected as 'unknown' and
    // fell back to the 72fps floor.
    dc.report = { deviceTier: 'quest-pro' };
    expect(dc.targetFPS()).toBe(90);
    dc.report = { deviceTier: 'pico-neo3' };
    expect(dc.targetFPS()).toBe(90);
  });
});

describe('DeviceCompatibility — navigator/ua edge cases', () => {
  test('unrecognised UA with navigator.xr present is desktop-xr', async () => {
    const dc = new DeviceCompatibility();
    Object.defineProperty(navigator, 'xr',
      { configurable: true, value: { isSessionSupported: async () => true } });
    Object.defineProperty(navigator, 'userAgent',
      { configurable: true, value: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120' });
    try {
      const report = await dc.check();
      expect(report.deviceTier).toBe('desktop-xr');
    } finally {
      delete navigator.xr;
      delete navigator.userAgent;
    }
  });

  test('check() tolerates navigator entirely absent', async () => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    try {
      Object.defineProperty(globalThis, 'navigator', { value: undefined, configurable: true });
      const dc = new DeviceCompatibility();
      const report = await dc.check();
      expect(report.deviceTier).toBe('unknown');
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
});
