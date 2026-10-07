const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// Defect class: dead bindings — variables declared/assigned and never read
// (the same class eslint's no-unused-vars flags, cleaned in #1239).
// Pin the repo at zero so the class cannot regress in these files.
describe('dead bindings stay removed', () => {
  it('i18n.js uses optional catch bindings — no unused catch params', () => {
    const src = read('src/i18n/i18n.js');
    expect(src).not.toMatch(/catch\s*\(\s*\w+\s*\)/);
  });

  it('verify-documentation.js declares no write-only locals', () => {
    const src = read('tools/verify-documentation.js');
    expect(src).not.toContain('linkText');
    expect(src).not.toContain('criticalFilesFound');
  });

  it('pages-url-honesty-944 iterates docs without an unused file binding', () => {
    const src = read('tests/pages-url-honesty-944.test.js');
    expect(src).not.toMatch(/\[\s*file\s*,\s*doc\s*\]/);
  });
});
