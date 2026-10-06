/**
 * Round 940 — repo-meta honesty.
 *
 * Three stale-metadata defects of the same class:
 *  - tests/examples-surface-861.test.js keeps an IN_FLIGHT exemption set
 *    whose every entry's owning PR has merged (.github/CODEOWNERS -> #1147,
 *    .github/workflows/wasm-build.yml -> #1139, netlify.toml -> #1143).
 *    Exemptions must expire with their PR or coverage silently rots.
 *  - .github/CODEOWNERS carries an empty `# Examples` scaffold section —
 *    a section header followed by zero owner entries.
 *  - LICENSE claims `Copyright (c) 2024-2025` while the project is under
 *    active development in the current year.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('stale IN_FLIGHT exemptions', () => {
  test('examples-surface pin has no exemptions whose PRs merged', () => {
    const src = read('tests/examples-surface-861.test.js');
    // The merged-PR exemptions are gone; no IN_FLIGHT carve-out remains.
    expect(src).not.toMatch(/IN_FLIGHT/);
  });
});

describe('CODEOWNERS section headers', () => {
  test('no comment-only section after the first ownership entry', () => {
    // Split into blank-line-separated blocks. The leading block may be a
    // comment-only preamble; any later block that contains only comments
    // is a dead scaffold section (e.g. '# Examples' with zero entries).
    const blocks = read('.github/CODEOWNERS')
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean);
    const entryFree = (block) => block.split('\n').every((l) => l.trim() === '' || l.trim().startsWith('#'));
    for (let i = 1; i < blocks.length; i++) {
      expect(entryFree(blocks[i])).toBe(false);
    }
  });
});

describe('LICENSE copyright range', () => {
  test('copyright covers the current development year', () => {
    const year = new Date().getFullYear();
    const m = read('LICENSE').match(/Copyright \(c\) (\d{4})-(\d{4})/);
    expect(m).not.toBeNull();
    expect(Number(m[2])).toBeGreaterThanOrEqual(year);
  });
});
