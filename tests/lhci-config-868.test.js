const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LHRC = path.join(ROOT, '.lighthouserc.json');

const read = (p) => fs.readFileSync(p, 'utf8');

// The CD pipeline always collects against a deployed URL (--collect.url).
// A staticDistDir in the config makes lhci serve ./dist locally and rewrite
// the provided URL's port to that local server — the fetch then hits the
// unreachable loopback instead of the deployed site.
describe('.lighthouserc.json collect config cannot shadow deployed URLs', () => {
  it('does not declare staticDistDir', () => {
    const cfg = JSON.parse(read(LHRC));
    expect(cfg.ci?.collect?.staticDistDir).toBeUndefined();
  });
});
