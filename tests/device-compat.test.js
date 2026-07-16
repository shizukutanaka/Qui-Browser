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
