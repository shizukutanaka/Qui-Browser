/**
 * Round 890 — testing-surface honesty: package.json scripts must not wrap jest
 * in a glob that matches zero files, and TESTING.md must not describe a
 * testing surface that does not exist.
 *
 * `test:integration` ran jest with a `tests/*integration*` testMatch glob
 * against a tree with no `*integration*` spec — every invocation exited
 * non-zero ("0 matches"), the third instance of the `test:tier` defect class
 * (#1138). TESTING.md carried the same class in prose: it listed the dead
 * script, named suites that no longer exist (`text-wrap`,
 * `multiplayer-system`, `server.test.js` for the deleted Express backend),
 * claimed lint covers `server/`, attributed `benchmarks` to `ci:all`, and
 * pinned a stale absolute baseline (48 suites / 1156 tests, ESLint "0
 * errors").
 */
const { readFileSync, readdirSync, existsSync } = require('fs');
const { join } = require('path');

const root = join(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const scripts = pkg.scripts || {};
const doc = readFileSync(join(root, 'docs/TESTING.md'), 'utf8');
const specFiles = readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.test.js'));

describe('npm test scripts match real specs', () => {
  test('test:integration (0-match glob, always fails) is gone', () => {
    expect(scripts['test:integration']).toBeUndefined();
  });

  test('no script passes a --testMatch glob that matches zero spec files', () => {
    const zeroMatch = [];
    for (const [name, cmd] of Object.entries(scripts)) {
      const m = String(cmd).match(/--testMatch[=\s]+['"]([^'"]+)['"]/);
      if (!m) {
        continue;
      }
      const glob = m[1];
      const base = glob
        .replace(/^\*\*\/tests\//, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '');
      const hasAny = specFiles.some((f) => f.includes(base.replace('.test.js', '')));
      if (!hasAny) {
        zeroMatch.push(`${name}: ${glob}`);
      }
    }
    expect(zeroMatch).toEqual([]);
  });
});

describe('TESTING.md describes only a live testing surface', () => {
  test('commands block lists no dead script names', () => {
    expect(doc).not.toMatch(/test:integration/);
  });

  test('every suite named in the tier lists exists as tests/<name>.test.js', () => {
    const tiers = doc.match(/Three tiers of test:([\s\S]*?)## Conventions/);
    expect(tiers).not.toBeNull();
    const named = [...tiers[1].matchAll(/`([a-z][a-z0-9]*-[a-z0-9-]+)`/g)].map((m) => m[1]);
    const missing = named.filter((n) => !existsSync(join(root, 'tests', `${n}.test.js`)));
    expect(missing).toEqual([]);
  });

  test('no references to the deleted server/ surface or stale absolute baselines', () => {
    expect(doc).not.toMatch(/server\.test\.js|src\/ and server\//);
    expect(doc).not.toMatch(/\d+ suites?\s*\/\s*[\d,]+ tests/);
    expect(doc).not.toMatch(/benchmarks/);
  });
});
