/**
 * Doc-reference integrity for LIVE docs (docs/archive is history — excluded):
 *
 *  1. every `npm run <script>` mention must be a real package.json script
 *     (measured 2026-09-20: README/PROJECT_STATUS/TESTING/CI_CD guide all
 *     advertised `test:tier` and `test:e2e`, neither of which existed)
 *  2. every `src/**`, `tests/**`, `tools/**`, `proxy/**`, `docker/**`
 *     path mentioned must exist (stale `src/input/…`, `src/audio/…`,
 *     `src/utils/ObjectPool.js`, `./proxy/nginx.conf` were all dangling)
 *
 * The examples/ directory (12 standalone HTML + guide) was deleted: all of
 * them imported a removed `assets/js/vr-*.js` monolithic SDK — every example
 * 404'd on first load, and no live doc linked in.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pkg = require('../package.json');

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(p);
    } else if (e.name.endsWith('.md')) {
      yield p;
    }
  }
}

const mdFiles = [
  ...[...walk(ROOT)].filter((p) => {
    const rel = path.relative(ROOT, p);
    return !rel.includes('node_modules') && !rel.startsWith('docs/archive') && !rel.startsWith('dist/');
  })
];

// Path mentions: `backticked` or plain src/ tests/ tools/ proxy/ docker/ refs
const PATH_RE = /(?:[\w./-]*)(?:src|tests|tools|proxy|docker|public|examples|assets)\/[\w./-]+\.\w+/g;
const SCRIPT_RE = /npm\s+run\s+([\w:-]+)/g;

const badScripts = [];
const badPaths = [];
for (const p of mdFiles) {
  const rel = path.relative(ROOT, p);
  const body = fs.readFileSync(p, 'utf8');
  // Point-in-time analyses, changelogs, marked-stale guides, the session log,
  // and struck-through notes are history, not promises — skip them like
  // docs/archive.
  if (
    rel === 'CLAUDE.md' ||
    rel === 'CHANGELOG.md' ||
    rel === 'docs/OUTSTANDING_ISSUES.md' ||
    rel === 'docs/INSTRUCTIONS_OPUS.md' ||
    rel === 'docs/CATEGORY_RESEARCH.md' ||
    rel === 'docs/IMPROVEMENT_ANALYSIS.md' ||
    rel === 'docs/BUILD_OPTIMIZATION_GUIDE.md'
  ) {
    continue;
  }
  for (const m of body.matchAll(SCRIPT_RE)) {
    if (!(m[1] in pkg.scripts)) {
      badScripts.push(`${rel}: npm run ${m[1]}`);
    }
  }
  // `three/examples/…` is a node_modules path, not a repo path.
  const live = body.replace(/~~[^~]+~~/g, '');
  for (const m of live.matchAll(PATH_RE)) {
    const ref = m[0].replace(/^\.?\//, '');
    if (ref.startsWith('three/') || ref.includes('...')) {
      continue;
    }
    if (!fs.existsSync(path.join(ROOT, ref))) {
      badPaths.push(`${rel}: ${ref}`);
    }
  }
}

test('no `npm run` mention points at a missing script', () => {
  expect(badScripts).toEqual([]);
});

test('no live doc references a non-existent repo path', () => {
  expect(badPaths).toEqual([]);
});

// Markdown links to relative files — distinct from PATH_RE mentions, which
// only match backticked/plain code-y paths, not `[text](target)` syntax.
const LINK_RE = /\[[^\]]*\]\(([^)\s]+)\)/g;
const badLinks = [];
for (const p of mdFiles) {
  const rel = path.relative(ROOT, p);
  if (
    rel === 'CLAUDE.md' ||
    rel === 'CHANGELOG.md' ||
    rel === 'docs/OUTSTANDING_ISSUES.md' ||
    rel === 'docs/INSTRUCTIONS_OPUS.md' ||
    rel === 'docs/CATEGORY_RESEARCH.md' ||
    rel === 'docs/IMPROVEMENT_ANALYSIS.md' ||
    rel === 'docs/BUILD_OPTIMIZATION_GUIDE.md'
  ) {
    continue;
  }
  const live = fs.readFileSync(p, 'utf8').replace(/~~[^~]+~~/g, '');
  for (const m of live.matchAll(LINK_RE)) {
    const target = m[1].split('#')[0].split('?')[0];
    if (!target || /^(https?|mailto|javascript):/.test(target)) {
      continue;
    }
    if (!fs.existsSync(path.join(path.dirname(p), target))) {
      badLinks.push(`${rel}: ${m[1]}`);
    }
  }
}

test('no live doc markdown link points at a missing file', () => {
  expect(badLinks).toEqual([]);
});
