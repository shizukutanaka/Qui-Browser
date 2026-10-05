/**
 * Round 935 — documentation-coverage honesty invariants.
 *
 * tools/verify-documentation.js claims it "verifies all internal links,
 * file references, and documentation completeness" but only checked a
 * hardcoded list of 16 files — half the live doc corpus sailed past the
 * gate. It also treated regex literals like `(.+?)` inside prose as
 * markdown link targets.
 *
 * Invariants:
 *  1. Every tracked markdown doc at the repo root and directly under
 *     docs/ is either in DOCUMENTATION_FILES or named in EXCLUDED_DOCS
 *     with a non-empty reason (docs/archive stays out — A-1 frozen).
 *  2. Every EXCLUDED_DOCS entry really does fail the link check today
 *     (a file must not sit excluded forever once it is clean).
 *  3. Regex-literal targets — e.g. the `.+?` / `(?:x|y)` patterns that
 *     appear inside pattern documentation — are never link-checked.
 *  4. babel.config.js's header rationale only cites files that exist.
 *  5. That rationale names current jsm importers (VRButton,
 *     XRControllerModelFactory) — not deleted TextureManager/KTX2Loader.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf-8');

const verifier = require('../tools/verify-documentation.js');
const { DOCUMENTATION_FILES, EXCLUDED_DOCS, isPlausibleLinkTarget } = verifier;

function liveDocs() {
  const root = fs.readdirSync(ROOT).filter((f) => f.endsWith('.md'));
  const docs = fs
    .readdirSync(path.join(ROOT, 'docs'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => `docs/${f}`);
  return [...root, ...docs].sort();
}

function brokenLinksIn(file) {
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  const content = read(file);
  const fileDir = path.dirname(path.join(ROOT, file));
  const broken = [];
  let m;
  while ((m = linkPattern.exec(content)) !== null) {
    const target = m[2];
    if (target.startsWith('http://') || target.startsWith('https://')) continue;
    if (target.startsWith('#')) continue;
    if (!isPlausibleLinkTarget(target)) continue;
    const abs = path.resolve(fileDir, target.split('#')[0]);
    if (!fs.existsSync(abs)) broken.push(target);
  }
  return broken;
}

describe('verify-documentation coverage honesty', () => {
  test('every live doc is covered or honestly excluded', () => {
    const covered = new Set(DOCUMENTATION_FILES);
    const excluded = new Set(EXCLUDED_DOCS.keys());
    const uncovered = liveDocs().filter((d) => !covered.has(d) && !excluded.has(d));
    // every doc under verify:docs must be accounted for one way or the other
    expect(uncovered).toEqual([]);
  });

  test('each exclusion carries a reason and a file that still fails', () => {
    const rows = [...EXCLUDED_DOCS.entries()];
    expect(rows.length).toBeGreaterThan(0);
    for (const [file, reason] of rows) {
      // an exclusion without a stated reason hides a file silently
      expect(typeof reason === 'string' && reason.length > 10).toBe(true);
      // and it must genuinely fail today — a clean file may not stay excluded
      expect(fs.existsSync(path.join(ROOT, file))).toBe(true);
      expect(brokenLinksIn(file).length).toBeGreaterThan(0);
    }
  });

  test('regex literals in prose are never treated as link targets', () => {
    for (const t of ['.+?', '(?:x|y)', '?:もらう|いただく|くれ', 'a|b']) {
      expect(isPlausibleLinkTarget(t)).toBe(false);
    }
    for (const t of ['API.md', './SETUP.md', 'docs/PROXY.md', '../x/y.md']) {
      expect(isPlausibleLinkTarget(t)).toBe(true);
    }
  });
});

describe('babel.config.js rationale cites real files', () => {
  const header = read('babel.config.js').match(/^\/\*\*[\s\S]*?\*\//)[0];

  test('header cites only files that exist', () => {
    const cited = header.match(/src\/[\w./-]+\.js|three\/[\w./-]+\.js/g) || [];
    const missing = cited.filter(
      (p) => !fs.existsSync(path.join(ROOT, p)) && !fs.existsSync(path.join(ROOT, 'node_modules', p))
    );
    expect(missing).toEqual([]);
  });

  test('header names current jsm importers, not deleted modules', () => {
    // src/utils/TextureManager.js was deleted (#1121) and KTX2Loader has no
    // importer left; the rationale must cite what actually imports jsm today.
    expect(header).not.toMatch(/TextureManager/);
    expect(header).not.toMatch(/KTX2Loader/);
    expect(header).toMatch(/VRButton\.js/);
    expect(header).toMatch(/XRControllerModelFactory\.js/);
  });
});
