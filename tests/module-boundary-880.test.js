// Class pin (urlResolver surface): every `export` in urlResolver.js must name a
// symbol with at least one consumer outside the defining file AND outside
// tests/. An export reachable only from its own test file is dead public
// surface (#1135 precedent) — the keyword promises a consumer that does not
// exist, so neither the export nor a test-only method may carry it.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FILE = 'src/vr/browser/urlResolver.js';

function srcConsumers() {
  const out = execSync('git ls-files "src/**/*.js" "*.js" "*.mjs" "*.html"', {
    cwd: ROOT,
    encoding: 'utf8'
  });
  return out
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !p.startsWith('node_modules/') && !p.startsWith('dist/'))
    .filter((p) => !p.startsWith('tests/') && p !== FILE);
}

function exportedNames(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  return [...src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)].map(
    (m) => m[1]
  );
}

describe('urlResolver module boundary honesty', () => {
  test('every exported symbol has a production (non-test) consumer', () => {
    const names = exportedNames(FILE);
    expect(names.length).toBeGreaterThan(0);
    const consumers = srcConsumers().map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'));
    const dead = names.filter((name) => !consumers.some((c) => new RegExp(`\\b${name}\\b`).test(c)));
    expect(dead).toEqual([]);
  });

  test('no test-only helper functions remain on the module surface', () => {
    const src = fs.readFileSync(path.join(ROOT, FILE), 'utf8');
    // isSearchQuery existed only to serve a UI-hint use case that was never
    // built — a dead public method must not come back under another name.
    expect(src).not.toMatch(/isSearchQuery/);
  });
});
