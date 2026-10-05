const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const SNAPSHOT_DOCS = ['docs/IMPROVEMENT_ANALYSIS.md', 'docs/CATEGORY_RESEARCH.md'];

describe('pre-implementation analysis docs declare their snapshot status', () => {
  it.each(SNAPSHOT_DOCS)('%s carries a point-in-time banner naming the removal commit', (doc) => {
    const head = read(doc).slice(0, 2500);
    expect(head).toMatch(/スナップショット|point-in-time/i);
    expect(head).toMatch(/1eb7f8d7/);
  });

  it('the code surface they prescribe against is still deleted (else revisit the banner)', () => {
    for (const p of ['src/vr/multiplayer', 'src/ai', 'assets/js', 'src/vr/rendering/WebGPURenderer.js']) {
      expect(fs.existsSync(path.join(ROOT, p))).toBe(false);
    }
  });
});
