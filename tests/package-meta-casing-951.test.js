/**
 * Round 951 invariants: package.json repository metadata must name the
 * canonical repository `shizukutanaka/Qui-Browser`.
 *
 * GitHub URLs resolve case-insensitively, so a lower-cased `qui-browser`
 * still lands on the repo — but the project's own metadata then mislabels
 * the canonical name everywhere the field propagates (npm UI, `npm repo`,
 * tooling that consumes repository.url). The console banner was pinned to
 * canonical casing in #1237 (tests/main-banner-honesty-950.test.js); this
 * extends the same invariant to the package metadata that feeds it.
 */
const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

describe('package.json repository metadata names the canonical repo', () => {
  const urlFields = {
    'repository.url': pkg.repository && pkg.repository.url,
    homepage: pkg.homepage,
    'bugs.url': pkg.bugs && pkg.bugs.url
  };

  for (const [field, url] of Object.entries(urlFields)) {
    test(`${field} uses canonical 'shizukutanaka/Qui-Browser' casing`, () => {
      expect(typeof url).toBe('string');
      expect(url).toContain('shizukutanaka/Qui-Browser');
      expect(url).not.toMatch(/shizukutanaka\/qui-browser/);
    });
  }

  test('no lowercase owner/repo slug survives anywhere in package.json', () => {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8');
    // The canonical name preserves the 'Qui-Browser' capitalisation; a bare
    // lowercase 'shizukutanaka/qui-browser' is always a mislabel.
    expect(raw).not.toMatch(/shizukutanaka\/qui-browser/);
  });
});
