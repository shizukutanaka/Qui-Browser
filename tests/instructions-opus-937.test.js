import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const DOC = fs.readFileSync(path.join(ROOT, 'docs/INSTRUCTIONS_OPUS.md'), 'utf8');

// Split the O-* task list into sections keyed by header: "### O-1. ..." etc.
// A section ends at the next section header of ANY level (## or ###), so a
// trailing "## 6. 完了時" doesn't bleed into the last O-* item.
function sections() {
  const out = new Map();
  const re = /^###\s+(?:~~)?(O-\d+)\.\s*([^\n]+)/gm;
  const bounds = [...DOC.matchAll(/^##+ /gm)].map((m) => m.index);
  let m;
  const heads = [];
  while ((m = re.exec(DOC))) heads.push({ id: m[1], title: m[2], start: m.index });
  for (let i = 0; i < heads.length; i++) {
    const nextSame = i + 1 < heads.length ? heads[i + 1].start : DOC.length;
    const nextAny = bounds.find((b) => b > heads[i].start) ?? DOC.length;
    const end = Math.min(nextSame, nextAny);
    out.set(heads[i].id, { title: heads[i].title, body: DOC.slice(heads[i].start, end) });
  }
  return out;
}

const STRUCK = /~~|削除済み|解決済み|提供済み|出荷済み|完了/;

describe('docs/INSTRUCTIONS_OPUS.md — work queue honesty', () => {
  test('all five O-* sections exist', () => {
    const s = sections();
    for (const id of ['O-1', 'O-2', 'O-3', 'O-4', 'O-5']) {
      expect(s.has(id)).toBe(true);
    }
  });

  test('every src/ path referenced by an UNRESOLVED item exists on disk', () => {
    const s = sections();
    const missing = [];
    for (const [id, { body }] of s) {
      if (STRUCK.test(body.split('\n')[0])) continue; // resolved items may name deleted files
      for (const mm of body.matchAll(/`((?:src|tests|tools)\/[^`\s]+)`/g)) {
        if (!fs.existsSync(path.join(ROOT, mm[1]))) missing.push(`${id}: ${mm[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test.each([
    ['O-1', 'settings-panel accordion grouping shipped (settings.section.* + persisted openSettingsSections)'],
    ['O-4', 'src/vr/ar/MixedReality.js deleted at 1eb7f8d7 — the target no longer exists'],
    ['O-5', 'Top Sites shipped via the WebPanel new-tab tile grid (topSitesLayout.js)']
  ])('%s is marked resolved — %s', (id) => {
    const { body } = sections().get(id);
    expect(STRUCK.test(body)).toBe(true);
  });

  test('genuinely unshipped items stay open — O-2 (test:e2e) and O-3 (VRApp split)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts['test:e2e']).toBeUndefined(); // O-2 deliverable absent → must stay open
    const s = sections();
    expect(STRUCK.test(s.get('O-2').body)).toBe(false);
    expect(STRUCK.test(s.get('O-3').body)).toBe(false);
  });
});
