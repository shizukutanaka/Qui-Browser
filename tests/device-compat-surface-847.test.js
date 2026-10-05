/**
 * Round 847: DeviceCompatibility.report pins the consumed surface only.
 * VRApp reads compat.deviceTier (debug log) and deviceCompat.targetFPS();
 * every other probed field (arSupported, hitTest, anchors, planeDetection,
 * eyeTracking, foveatedRendering, webgpu, webgl2, timestamp) had zero
 * consumers and was heuristic guesswork — removed, not wired.
 */
const { DeviceCompatibility } = require('../src/utils/DeviceCompatibility.js');

describe('DeviceCompatibility consumed surface', () => {
  test('check() report contains only the consumed keys', async () => {
    const dc = new DeviceCompatibility();
    const report = await dc.check();
    expect(Object.keys(report).sort()).toEqual(['deviceTier', 'vrSupported']);
  });

  test('no speculative feature probes are exposed on the instance', () => {
    const dc = new DeviceCompatibility();
    expect(typeof dc._probeOptionalFeatures).toBe('undefined');
    expect(typeof dc._hasWebGL2).toBe('undefined');
  });

  test('_detectTier identifies an Android XR headset UA', () => {
    const dc = new DeviceCompatibility();
    expect(dc._detectTier('Mozilla/5.0 (Linux; Android 14; XR Device)')).toBe('android-xr');
  });

  test('targetFPS() falls back to 72 for non-headset tiers', () => {
    const dc = new DeviceCompatibility();
    dc.report = { deviceTier: 'android-xr' };
    expect(dc.targetFPS()).toBe(72);
    dc.report = { deviceTier: 'desktop-xr' };
    expect(dc.targetFPS()).toBe(72);
    dc.report = { deviceTier: 'unknown' };
    expect(dc.targetFPS()).toBe(72);
  });
});
