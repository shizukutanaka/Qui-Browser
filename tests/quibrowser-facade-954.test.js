/**
 * Round 954 pin: `window.QuiBrowser` exposes only the debug facade that has
 * a real consumer.
 *
 * `getApp` is consumed by tools/verify-vr-boot.mjs:191. `getStats` and
 * `version` had zero callers anywhere in src/, tools/, index.html, or
 * tests/ — write-only debug surface (same class as #1240).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
const BOOT = fs.readFileSync(path.join(ROOT, 'tools', 'verify-vr-boot.mjs'), 'utf8');

describe('window.QuiBrowser facade', () => {
  test('still exposes getApp — verify-vr-boot consumes it', () => {
    expect(SRC).toMatch(/window\.QuiBrowser\s*=\s*\{/);
    expect(SRC).toMatch(/getApp\s*:/);
    expect(BOOT).toMatch(/QuiBrowser\.getApp/);
  });

  test('dead getStats channel is gone', () => {
    expect(SRC).not.toMatch(/getStats\s*:/);
  });

  test('dead version field is gone', () => {
    const facade = SRC.slice(SRC.indexOf('window.QuiBrowser'));
    expect(facade).not.toMatch(/version\s*:/);
  });
});
