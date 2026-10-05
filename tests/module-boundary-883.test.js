/**
 * Module-boundary invariant (round 883): every named export of
 * src/vr/browser/topSitesLayout.js must have a consumer elsewhere in src/.
 * An export whose only reference is inside its own file looks like public
 * API but is dead surface — same class swept in PRs #1165-#1169.
 *
 * Scope note: only topSitesLayout.js is checked here — tabSession.js's
 * exports are a deliberately documented test seam, and other leaf modules
 * are owned by open PRs.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'src/vr/browser/topSitesLayout.js');

function srcFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...srcFiles(p));
    } else if (e.name.endsWith('.js')) {
      out.push(p);
    }
  }
  return out;
}

const EXPORT_RE = /export\s+(?:const|function|class)\s+([A-Za-z_$][\w$]*)/g;

describe('topSitesLayout module boundary', () => {
  const src = fs.readFileSync(FILE, 'utf8');
  const exported = [...src.matchAll(EXPORT_RE)].map((m) => m[1]);

  test('the module exports at least one symbol', () => {
    expect(exported.length).toBeGreaterThan(0);
  });

  test('every named export has a consumer elsewhere in src/', () => {
    const others = srcFiles(path.join(ROOT, 'src')).filter((f) => f !== FILE);
    const corpus = others.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    for (const name of exported) {
      expect(new RegExp(`\\b${name}\\b`).test(corpus)).toBe(true);
    }
  });

  test('layout-only constants stay module-private', () => {
    for (const name of ['TOP_SITE_COLS', 'TOP_SITE_MAX', 'TILE_H', 'TILE_GAP']) {
      expect(new RegExp(`export\\s+(?:const|function|class)\\s+${name}\\b`).test(src)).toBe(false);
    }
  });
});
