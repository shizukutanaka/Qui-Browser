const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DOCS = [path.join(ROOT, 'docs', 'INSTRUCTIONS_OPUS.md'), path.join(ROOT, 'docs', 'INSTRUCTIONS_SONNET.md')];
const PKG = path.join(ROOT, 'package.json');

const read = (p) => fs.readFileSync(p, 'utf8');

// Standing-instruction docs prescribe the release gate for future sessions.
// The gate line must describe checks that exist and must not freeze numeric
// snapshots of the day it was written (they rot silently).
describe('INSTRUCTIONS_* gate line stays runnable and unsnapshotted', () => {
  const scripts = Object.keys(JSON.parse(read(PKG)).scripts || {});

  it.each(DOCS.map((d) => [path.basename(d), d]))(
    '%s names only gate commands that exist in package.json',
    (_name, doc) => {
      const gateLine = read(doc)
        .split('\n')
        .find((l) => l.includes('フルゲート'));
      expect(gateLine).toBeDefined();
      const missing = [...gateLine.matchAll(/npm (?:run )?([a-z][a-z0-9:-]*)/g)]
        .map((m) => m[1])
        .filter((name) => name !== 'test' && !scripts.includes(name));
      expect(missing).toEqual([]);
    }
  );

  it.each(DOCS.map((d) => [path.basename(d), d]))(
    '%s does not pin absolute lint-error or test-count baselines',
    (_name, doc) => {
      const gateLine = read(doc)
        .split('\n')
        .find((l) => l.includes('フルゲート'));
      expect(gateLine).toBeDefined();
      expect(gateLine).not.toMatch(/\d+\s*errors?/);
      expect(gateLine).not.toMatch(/\d+件\/\d+スイート|\d+件/);
    }
  );
});
