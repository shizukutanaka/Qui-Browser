/**
 * Round 986 pin — doc-link label honesty.
 *
 * Invariant: in live docs (repo root *.md + docs/*.md; docs/archive/ is a
 * frozen point-in-time record and excluded), every markdown link whose label
 * names a file ending in `.md` must name the file it actually points to —
 * either verbatim (`[docs/X.md](docs/X.md)`) or by basename
 * (`[TESTING.md](./TESTING.md)`). A label that asserts a different filename
 * (e.g. `[TEST_COVERAGE_REPORT.md](./TESTING.md)`) lies about what exists on
 * disk even though the link resolves.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const MD_FILES = [
  ...fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(ROOT, f)),
  ...fs
    .readdirSync(path.join(ROOT, 'docs'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(ROOT, 'docs', f))
];

const LINK_RE = /\[([^\]]+\.md)\]\(([^)]+)\)/g;

const violations = [];
for (const file of MD_FILES) {
  const src = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = LINK_RE.exec(src))) {
    const label = m[1].trim().replace(/^\*+|\*+$/g, '');
    const target = m[2].split('#')[0];
    const base = target.split('/').pop();
    const resolves = fs.existsSync(path.resolve(path.dirname(file), target));
    const labelMatches = label === target.replace(/^\.\//, '') || label === base;
    if (!resolves || !labelMatches) {
      violations.push(`${path.relative(ROOT, file)}: label "${label}" -> target "${target}" (resolves=${resolves})`);
    }
  }
}

describe('doc-link label honesty', () => {
  test('every .md link label names the file it points to', () => {
    expect(violations).toEqual([]);
  });
});
