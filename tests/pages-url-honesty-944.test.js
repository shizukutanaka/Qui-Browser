const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// GitHub Pages is a configured deploy target (cd.yml deploy-github-pages),
// but no CD run has ever published it — every documented URL 404s today.
// Live docs must not claim the site is visitable ("live demo", "Live site").
const DOCS = {
  'README.md': fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8'),
  'docs/QUICK_START.md': fs.readFileSync(path.join(ROOT, 'docs/QUICK_START.md'), 'utf8'),
  'docs/DEPLOYMENT_GUIDE.md': fs.readFileSync(path.join(ROOT, 'docs/DEPLOYMENT_GUIDE.md'), 'utf8'),
  'docs/CI_CD_MONITORING_GUIDE.md': fs.readFileSync(path.join(ROOT, 'docs/CI_CD_MONITORING_GUIDE.md'), 'utf8')
};

const PAGES_URL = /shizukutanaka\.github\.io\/(Qui-Browser|qui-browser)\/?/;

describe('GitHub Pages URL is documented as a deploy target, not a live site', () => {
  it('no live claim remains near the Pages URL', () => {
    for (const [, doc] of Object.entries(DOCS)) {
      const lines = doc.split('\n');
      const hits = lines.filter((l) => PAGES_URL.test(l));
      expect(hits.length).toBeGreaterThan(0);
      for (const line of hits) {
        expect(line).toMatch(/target|configured|not live|404|planned/i);
      }
    }
  });

  it.each(Object.keys(DOCS))('%s has no adjacent "live" framing', (file) => {
    const doc = DOCS[file];
    expect(doc).not.toMatch(/live demo/i);
    expect(doc).not.toMatch(/live site/i);
    expect(doc).not.toMatch(/visit the (hosted|live)/i);
    expect(doc).not.toMatch(/try it online/i);
  });
});
