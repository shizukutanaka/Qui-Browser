const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const PUBLISHING = read('docs/PUBLISHING.md');
const WORKFLOWS_DIR = path.join(ROOT, '.github/workflows');
const live = fs
  .readdirSync(WORKFLOWS_DIR)
  .filter((f) => f.endsWith('.yml'))
  .map((f) => read(path.join('.github/workflows', f)))
  .join('\n');

describe('PUBLISHING.md matches the real release/deploy pipeline', () => {
  test('does not tell the reader to create or replace deleted workflow files', () => {
    // deploy.yml and release.yml were deleted in #1146 — cd.yml owns both
    // jobs now. No instruction may reference a nonexistent workflow file.
    const filenames = fs.readdirSync(WORKFLOWS_DIR).map((f) => `.github/workflows/${f}`);
    for (const ref of PUBLISHING.match(/\.github\/workflows\/[\w.-]+\.yml/g) || []) {
      expect(filenames).toContain(ref);
    }
  });

  test('points tag pushes at the live release job in cd.yml', () => {
    expect(live).toMatch(/create-release:/);
    expect(live).toMatch(/action-gh-release/);
    expect(PUBLISHING).not.toMatch(/triggers `.github\/workflows\/release\.yml`/);
  });

  test('contains no embedded workflow to paste into the repo', () => {
    // A full yaml job pasted in a doc drifts from the real one; the doc must
    // reference cd.yml, not duplicate it.
    expect(PUBLISHING).not.toMatch(/name: Deploy to GitHub Pages/);
    expect(PUBLISHING).not.toMatch(/name: Create Release/);
    expect(PUBLISHING).not.toMatch(/softprops\/action-gh-release@v2/);
  });

  test('still documents the only owner-gated steps that remain', () => {
    expect(PUBLISHING).toMatch(/Pages/);
    expect(PUBLISHING).toMatch(/git tag|tag/);
  });
});
