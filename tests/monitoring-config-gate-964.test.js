/**
 * Round 964: MONITORING_CONFIG.analytics.enabled is a write-only config field.
 *
 * The config schema declares per-integration toggles — `performance.enabled`
 * is honoured by initWebVitals — but `analytics.enabled` is never read:
 * initGoogleAnalytics and trackEvent gate on `enabled` + `measurementId` /
 * `window.gtag` only, so flipping the declared GA switch to false would have
 * no effect.  Every leaf of MONITORING_CONFIG must be consumed outside its
 * declaration.
 */
const fs = require('fs');
const path = require('path');

const MON = path.join(__dirname, '..', 'src', 'monitoring.js');
const src = fs.readFileSync(MON, 'utf8');

describe('monitoring.js config-gate honesty', () => {
  test('analytics.enabled is read outside its declaration', () => {
    const occurrences = src.match(/\banalytics\.enabled\b/g) || [];
    // 1 = declared only (dead field); >=2 = also consumed by a gate.
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  test('initGoogleAnalytics honours the analytics.enabled switch', () => {
    const fn = src.match(/export function initGoogleAnalytics\(\) \{[\s\S]*?\n\}/);
    expect(fn).toBeTruthy();
    expect(fn[0]).toContain('analytics.enabled');
  });

  test('trackEvent honours the analytics.enabled switch', () => {
    const fn = src.match(/export function trackEvent\([^)]*\) \{[\s\S]*?\n\}/);
    expect(fn).toBeTruthy();
    expect(fn[0]).toContain('analytics.enabled');
  });
});
