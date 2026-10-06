const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const walk = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const SRC_FILES = walk(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js'));
const srcHas = (token) => SRC_FILES.some((f) => fs.readFileSync(f, 'utf8').includes(token));

describe('docs/INSTRUCTIONS_SONNET.md task queue reflects shipped work', () => {
  const sonnet = read('docs/INSTRUCTIONS_SONNET.md');

  it.each(['S-1', 'S-2'])(
    '%s is marked resolved — its E-* item shipped (Sessions 58/59 per OUTSTANDING_ISSUES E章)',
    (id) => {
      expect(sonnet).toMatch(new RegExp('~~' + id + '\\.'));
    }
  );

  it('S-3 and S-4 stay open — their E-* items are still pending', () => {
    expect(sonnet).not.toMatch(/~~S-[34]\./);
  });
});

describe('docs/SPEC.md conformance notes name only live surface', () => {
  const spec = read('docs/SPEC.md');
  // §3 conformance tables only — §5/§6 legitimately log historical commits
  // (e.g. the commit that added `billboard` mode before its later removal).
  const conformance = spec.split('## 4.')[0];

  it.each(['nudgeDistance', 'billboard', 'TextureManager', 'KTX2Loader', 'AI 連携'])(
    'does not describe absent surface %s as current state',
    (ident) => {
      expect(conformance).not.toContain(ident);
    }
  );

  it('the symbols it stopped naming are still absent from src/ (else revisit the notes)', () => {
    for (const ident of ['nudgeDistance', 'TextureManager', 'KTX2Loader']) {
      expect(srcHas(ident)).toBe(false);
    }
  });
});
