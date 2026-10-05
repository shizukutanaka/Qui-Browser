/**
 * Round 851 — dead-script invariant: every npm script that names an explicit
 * test file must point at a file that exists, and TESTING.md must not list
 * commands that no longer exist in package.json.
 *
 * `test:tier` referenced tests/tier-system-integration.test.js, quarantined at
 * commit 1d2d2ef1 — the script could only ever exit non-zero ("0 matches").
 * TESTING.md also listed `test:e2e`, a script removed earlier.
 */
const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

const root = join(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const scripts = pkg.scripts || {};

describe('npm-script file references stay live', () => {
  test('every script referencing an explicit tests/*.test.js path resolves to an existing file', () => {
    const missing = [];
    for (const [name, cmd] of Object.entries(scripts)) {
      const refs = String(cmd).match(/tests\/[\w.\-/]+\.test\.js/g) || [];
      for (const ref of refs) {
        if (!existsSync(join(root, ref))) {
          missing.push(`${name}: ${ref}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  test('test:tier (pointing at the quarantined tier-system suite) is gone', () => {
    expect(scripts['test:tier']).toBeUndefined();
  });

  test('TESTING.md lists no command that is absent from package.json scripts', () => {
    const doc = readFileSync(join(root, 'docs/TESTING.md'), 'utf8');
    const stale = [];
    for (const m of doc.matchAll(/npm run ([\w:-]+)/g)) {
      if (!(m[1] in scripts)) {
        stale.push(m[1]);
      }
    }
    expect(stale).toEqual([]);
  });
});
