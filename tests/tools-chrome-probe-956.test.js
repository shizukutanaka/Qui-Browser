/**
 * Invariants for the headless-Chromium probe shared by the verify/measure
 * tools.
 *
 * The defect: every CHROME_CANDIDATES list probed Linux paths only
 * (/opt/pw-browsers, /usr/bin/*). On macOS — where a stock install puts the
 * browser at /Applications/Google Chrome.app/... — findChrome() always
 * returned null, so `npm run verify:app`, `verify:vr-boot` and
 * measure-text-metrics all exited with "no Chromium found" despite a Chrome
 * being installed. The npm-scripted gates could never run on a Mac checkout.
 *
 * These pins keep the macOS install path in every probe and keep CHROME_PATH
 * first so a manual override still wins.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const MACOS_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const TOOLS = ['tools/verify-app-boot.mjs', 'tools/verify-vr-boot.mjs', 'tools/measure-text-metrics.mjs'];

function candidates(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const m = src.match(/CHROME_CANDIDATES = \[([\s\S]*?)\]/);
  expect(m).not.toBeNull();
  return m[1];
}

describe('tools: chrome probe covers the platform install paths', () => {
  for (const file of TOOLS) {
    test(`${file} probes the macOS Chrome install path`, () => {
      expect(candidates(file)).toContain(MACOS_CHROME);
    });
  }

  test('verify-app-boot.mjs excludes headless display-link noise (macOS has no real display)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'tools/verify-app-boot.mjs'), 'utf8');
    expect(src).toMatch(/DisplayLink|display_link/);
  });

  // verify-text-layout.mjs consumes layout exports via namespace access; a
  // consumer scan limited to *.js reports them dead. Keep .mjs in scope.
  test('module-boundary-878 scans .mjs consumers too', () => {
    const src = fs.readFileSync(path.join(ROOT, 'tests/module-boundary-878.test.js'), 'utf8');
    expect(src).toContain('"*.mjs"');
  });

  for (const file of TOOLS) {
    test(`${file} keeps CHROME_PATH env override first`, () => {
      expect(candidates(file).indexOf('process.env.CHROME_PATH')).toBeLessThan(
        candidates(file).indexOf("'/opt/pw-browsers")
      );
    });
  }
});
