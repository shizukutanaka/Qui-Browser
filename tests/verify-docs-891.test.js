/**
 * Round 891 — internal doc links must resolve; `verify:docs` must pass on main.
 *
 * `npm run verify:docs` (tools/verify-documentation.js, wired via `verify:all`) failed on
 * main: README's deploy table linked `[vercel.json](vercel.json)` — the file was deleted
 * in #1143 — and FINAL_RELEASE_SUMMARY_v2.0.0.md's Support & Resources nav linked the
 * API reference doc — deleted in #1149. Two merged dead-surface removals left
 * navigational links behind, so the live doc gate exited 1.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

function relativeLinks(file) {
  const md = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const links = [];
  for (const m of md.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|#)/.test(href)) {
      continue;
    }
    links.push(href.split('#')[0]);
  }
  return links;
}

describe('doc link honesty', () => {
  test.each(['README.md', 'PROJECT_STATUS.md', 'FINAL_RELEASE_SUMMARY_v2.0.0.md'])(
    'every relative markdown link in %s resolves to a real file',
    (file) => {
      const missing = relativeLinks(file).filter((href) => !fs.existsSync(path.join(ROOT, href)));
      expect(missing).toEqual([]);
    }
  );

  test('verify:docs passes — no missing files, sections, or broken links', () => {
    expect(() =>
      execFileSync('node', [path.join(ROOT, 'tools', 'verify-documentation.js')], {
        cwd: ROOT,
        stdio: 'pipe'
      })
    ).not.toThrow();
  });
});
