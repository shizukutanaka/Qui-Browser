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
  for (const f of inputs) refs.push([name, f]);
}

test.each(refs.map(([name, f]) => [`${name} → ${f}`, f]))('%s exists', (_label, f) => {
  expect(fs.existsSync(path.join(ROOT, f))).toBe(true);
});
