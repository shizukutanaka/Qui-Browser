/**
 * Module-boundary honesty for the three last unaudited leaf modules:
 * readerNarration.js, readableText.js and settingsStepper.js.
 *
 * Every named export must be referenced by at least one other src/ file —
 * an `export` keyword on a symbol nothing imports is dead public surface
 * (#1165–#1170 swept the same class). Only these three files are checked
 * here; tabSession.js's exports are a deliberately documented test seam,
 * and other leaf modules are owned by open PRs.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MODULES = [
  'src/vr/browser/readerNarration.js',
  'src/vr/browser/readableText.js',
  'src/vr/settingsStepper.js'
];

function srcFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...srcFiles(p));
    } else if (/\.(js|mjs|cjs)$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

const ALL_SRC = srcFiles(path.join(ROOT, 'src'));

for (const mod of MODULES) {
  const abs = path.join(ROOT, mod);
  const code = fs.readFileSync(abs, 'utf8');
  const others = ALL_SRC.filter((f) => f !== abs).map((f) => fs.readFileSync(f, 'utf8'));
  const names = [...code.matchAll(/export\s+(?:const|function|class)\s+(\w+)/g)].map((m) => m[1]);

  describe(`module boundary — ${mod}`, () => {
    test('module exports at least one symbol', () => {
      expect(names.length).toBeGreaterThan(0);
    });

    test('every named export has a consumer in another src/ file', () => {
      for (const name of names) {
        const used = others.some((src) => new RegExp(`\\b${name}\\b`).test(src));
        expect(used).toBe(true);
      }
    });
  });
}

describe('module boundary — layout/internal constants stay module-private', () => {
  test('test-only helpers are not exported', () => {
    const narration = fs.readFileSync(path.join(ROOT, MODULES[0]), 'utf8');
    const readable = fs.readFileSync(path.join(ROOT, MODULES[1]), 'utf8');
    const stepper = fs.readFileSync(path.join(ROOT, MODULES[2]), 'utf8');
    for (const [src, name] of [
      [narration, 'NARRATION_CHUNK_MAX'],
      [readable, 'decodeEntities'],
      [readable, 'extractTitle'],
      [stepper, 'MINUS_MAX_U'],
      [stepper, 'PLUS_MIN_U'],
      [stepper, 'decimalsFor']
    ]) {
      expect(src).not.toMatch(new RegExp(`export\\s+(?:const|function|class)\\s+${name}\\b`));
    }
  });
});
