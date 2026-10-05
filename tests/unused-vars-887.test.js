/**
 * Invariant: eslint reports zero `no-unused-vars` findings on the files this
 * round owns. Dead bindings (unused catch params, destructured-but-unread
 * constants, callback args kept only for arity) are dead surface — they read
 * as live surface while carrying no meaning. Signature-required parameters
 * must carry the `_`-prefix the eslint rule honours.
 */
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const OWNED = [
  'src/a11y/accessibility.js',
  'tests/caption-system.test.js',
  'tests/bookmark-layout.test.js',
  'tests/keyboard-layout.test.js',
  'tests/layers-system.test.js',
  'tests/find-comfort-atoms.test.js',
  'tests/nav-depth-atoms.test.js',
  'tests/ordinal-status-atoms.test.js',
  'tests/ordinal-window-atoms.test.js',
  'tests/pin-move-atoms.test.js',
  'tests/read-here-atoms.test.js',
  'tests/strip-position-atoms.test.js',
  'tests/apps-positional-atoms.test.js',
  'tests/list-readout-atoms.test.js',
  'tests/mic-session-atoms.test.js'
];

function unusedVarFindings() {
  let stdout;
  try {
    stdout = execSync(`npx eslint ${OWNED.join(' ')} --format json`, {
      cwd: ROOT,
      env: { ...process.env, ESLINT_USE_FLAT_CONFIG: 'false' },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (err) {
    // eslint exits 1 when findings exist — findings still land on stdout.
    stdout = err.stdout || '';
    if (err.status !== 1 && err.status !== 0) {
      throw new Error(`eslint did not run: ${err.stderr || err.message}`);
    }
  }
  const results = JSON.parse(stdout);
  const findings = [];
  for (const file of results) {
    for (const m of file.messages || []) {
      if (m.ruleId === 'no-unused-vars') {
        findings.push(`${file.filePath}:${m.line} ${m.message}`);
      }
    }
  }
  return findings;
}

describe('no-unused-vars class seal', () => {
  test('every owned file is free of unused bindings', () => {
    expect(unusedVarFindings()).toEqual([]);
  }, 60000);
});
