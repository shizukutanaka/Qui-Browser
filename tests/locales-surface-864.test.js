/**
 * locales/ directory honesty (round 864).
 *
 * The repo shipped 105 i18next-style JSON catalogs under `locales/` (~1 MB),
 * but no loader ever read them — the runtime catalog is the inline `CATALOG`
 * in `src/i18n/i18n.js` (en + ja only). Dead-on-arrival deliverables, same
 * defect class as `examples/` removed in #1148: files that exist but no code
 * path can ever reach. These tests pin the removal.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'locales');

/** Collect every file under a tracked surface directory (recursive). */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'archive') continue;
      walk(p, out);
    } else {
      out.push(p);
    }
  }
  return out;
}

const LIVE_SURFACES = ['src', 'tools', 'public', 'docs'];

describe('dead locales/ catalog removal', () => {
  test('no locales/ directory exists at repo root', () => {
    expect(fs.existsSync(LOCALES_DIR)).toBe(false);
  });

  test('nothing in the live source references locales/', () => {
    const offenders = [];
    for (const dir of LIVE_SURFACES) {
      for (const file of walk(path.join(ROOT, dir))) {
        const src = fs.readFileSync(file, 'utf8');
        if (/locales\//.test(src)) offenders.push(path.relative(ROOT, file));
      }
    }
    for (const rootFile of ['index.html', 'vite.config.js', 'netlify.toml', 'manifest.json']) {
      const f = path.join(ROOT, rootFile);
      if (fs.existsSync(f) && /locales\//.test(fs.readFileSync(f, 'utf8'))) {
        offenders.push(rootFile);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('the real i18n catalog is the inline module, not a JSON directory', () => {
    const i18n = fs.readFileSync(path.join(ROOT, 'src/i18n/i18n.js'), 'utf8');
    expect(i18n).toContain('CATALOG');
    // The module must not defer to on-disk locale files.
    expect(i18n).not.toMatch(/import\.meta\.glob|fetch\([^)]*locales/);
  });

  test('no stray top-level translation catalog directories go unwired', () => {
    // Class pin: a directory holding only per-language *.json catalogs must
    // either be consumed by code or not exist. locales/ was the only one;
    // assert it stays gone and nothing equivalent reappears under common names.
    for (const candidate of ['locales', 'locale', 'i18n', 'translations', 'lang']) {
      const p = path.join(ROOT, candidate);
      expect(fs.existsSync(p)).toBe(false);
    }
  });
});
