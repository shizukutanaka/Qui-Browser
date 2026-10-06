/**
 * Round 950 — shipped-surface honesty in the main.js console banner.
 *
 * The build-info banner printed on every load named features the repo no
 * longer ships:
 *  - "KTX2 textures" — the compression pipeline was deleted (#1121);
 *    docs/SPEC.md marks FR-4.3 unreachable and docs-coverage-935 already
 *    pins the name out of babel.config.js, but nobody pinned main.js.
 *  - "17 features" — a hard-coded count with no enumerable source; it
 *    drifted as features were added and removed.
 *  - "shizukutanaka/qui-browser" — works via GitHub's case-insensitive
 *    redirect, but the canonical repo name is Qui-Browser.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MAIN = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');

describe('main.js console banner honesty', () => {
  it('names no deleted pipeline (KTX2 was removed in #1121)', () => {
    expect(MAIN).not.toContain('KTX2');
  });

  it('claims no hard-coded feature count that can drift', () => {
    expect(MAIN).not.toMatch(/\b\d+ features\b/);
  });

  it('links the canonical repo name (Qui-Browser, not qui-browser)', () => {
    expect(MAIN).toContain('shizukutanaka/Qui-Browser');
    expect(MAIN).not.toContain('shizukutanaka/qui-browser');
  });

  it('still claims Service Worker only while the worker ships', () => {
    // Sentinel: if public/service-worker.js is ever removed, this test and
    // the banner's "Service Worker" bullet must be revisited together.
    expect(fs.existsSync(path.join(ROOT, 'public/service-worker.js'))).toBe(true);
    expect(MAIN).toContain('Service Worker');
  });
});
