/**
 * npm-script integrity: every repo file a script references must exist.
 * Measured 2026-09-20: `npm run test:tier` pointed at
 * tests/tier-system-integration.test.js — deleted with the tier system —
 * so the command failed instantly for anyone who ran it. Scripts are
 * user-facing commands; a dead one is a broken promise in package.json.
 * Output-file paths (e.g. benchmark-results.json) are written, not read,
 * so only paths under repo directories that must exist are checked.
 */
const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const ROOT = path.join(__dirname, '..');

const refs = [];
for (const [name, cmd] of Object.entries(pkg.scripts)) {
  const inputs = (cmd.match(/(?:^|\s)(?:node\s+)?(?:tools|tests|src|proxy|bin)\/[\w./-]+/g) || [])
    .map((s) => s.trim().replace(/^node\s+/, ''));
  for (const f of inputs) {
    refs.push([name, f]);
  }
}

test.each(refs.map(([name, f]) => [`${name} → ${f}`, f]))('%s exists', (_label, f) => {
  expect(fs.existsSync(path.join(ROOT, f))).toBe(true);
});

// A --testMatch glob that matches zero files exits "No tests found" — a
// script that can never run anything is theater. `test:integration` pointed
// at `*integration*` while no file carried that name (fixed to the real
// wiring/smoke suites).
const testMatchScripts = [];
for (const [name, cmd] of Object.entries(pkg.scripts)) {
  const m = cmd.match(/--testMatch=['"]([^'"]+)['"]/);
  if (m) {
    testMatchScripts.push([name, m[1]]);
  }
}
for (const [name, glob] of testMatchScripts) {
  test(`${name}'s --testMatch ${glob} matches at least one file`, () => {
    const pat = glob.replace(/^.*\//, '');
    const re = new RegExp('^' + pat.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
    const hits = fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => re.test(f));
    expect(hits.length).toBeGreaterThan(0);
  });
}
