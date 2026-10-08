/**
 * PROJECT_STATUS.md honesty — the status doc must only claim infrastructure
 * that actually exists. It drifted into prescribing 9 deleted npm scripts
 * (copy-paste fails with "missing script"), claiming 9 CI jobs where ci.yml
 * has 7, a Node 16/18/20 matrix where ci.yml runs 18/20, and ~20 feature rows
 * whose named files (ObjectPoolSystem.js, WebGPURenderer.js,
 * MultiplayerSystem.js, ...) were never shipped or were deleted.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const pkg = require('../package.json');

const ROOT = path.resolve(__dirname, '..');
const statusDoc = fs.readFileSync(path.join(ROOT, 'PROJECT_STATUS.md'), 'utf8');

const liveDocs = execSync('git ls-files docs/*.md *.md', { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((f) => !f.startsWith('docs/archive/'));

function fencedBlocks(doc) {
  return doc.match(/```[\s\S]*?(?:```|$)/g) || [];
}

function workflowJobIds(file) {
  const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  const ids = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\S/.test(lines[i])) {
      break;
    }
    const m = /^ {2}([A-Za-z0-9_-]+):/.exec(lines[i]);
    if (m) {
      ids.push(m[1]);
    }
  }
  return ids;
}

test('every `npm run <script>` inside a fenced code block in a live doc exists in package.json', () => {
  const missing = [];
  for (const f of liveDocs) {
    for (const block of fencedBlocks(fs.readFileSync(path.join(ROOT, f), 'utf8'))) {
      for (const m of block.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)) {
        if (!pkg.scripts[m[1]]) {
          missing.push(`${f} :: npm run ${m[1]}`);
        }
      }
    }
  }
  expect(missing).toEqual([]);
});

test('CI/CD pipeline job-count claims match the workflow files', () => {
  const ci = /CI Pipeline \((\d+) Jobs/.exec(statusDoc);
  const cd = /CD Pipeline \((\d+) Jobs/.exec(statusDoc);
  expect(ci && Number(ci[1])).toBe(workflowJobIds('.github/workflows/ci.yml').length);
  expect(cd && Number(cd[1])).toBe(workflowJobIds('.github/workflows/cd.yml').length);
});

test('the Node version matrix claim matches the ci.yml matrix', () => {
  const claim = /Node \(([\d/]+)\)/.exec(statusDoc);
  const ciSrc = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
  const matrix = /node-version:\s*\[([\d,\s]+)\]/.exec(ciSrc);
  expect(claim).not.toBeNull();
  expect(matrix).not.toBeNull();
  const claimed = claim[1].split('/').map(Number);
  const actual = matrix[1].split(',').map((s) => Number(s.trim()));
  expect(claimed.sort()).toEqual(actual.sort());
});

// Infrastructure the doc must not claim as shipped — fabricated filenames,
// phantom features presented as complete table rows, deleted npm scripts.
// (Unchecked roadmap items stay legitimate; the pins target shipped claims.)
const DEAD_CLAIMS = [
  'ObjectPoolSystem.js',
  'TextureLoader.js',
  'PassthroughManager.js',
  'WebGPURenderer.js',
  'MultiplayerSystem.js',
  'AIRecommendation.js',
  'VideoPlayer.js',
  'OfflineManager.js',
  '| **Object Pooling**',
  '| **KTX2',
  '| **WebGPU',
  '| **Multiplayer',
  '| **AI Recommendations**',
  '| **MR Passthrough**',
  '| **WebCodecs',
  'KTX2 Textures',
  'benchmark',
  'test:tier',
  'test:integration',
  'test:e2e',
  'deploy:gh-pages',
  '17 advanced features',
  'Example implementations',
  'Integration Tests',
  'Performance Tests',
  '34 test suites',
  '9 CI jobs'
];

test.each(DEAD_CLAIMS)('PROJECT_STATUS.md does not claim dead infrastructure "%s"', (claim) => {
  expect(statusDoc).not.toContain(claim);
});

test('per-file documentation line claims do not exceed the real line counts', () => {
  const claims = [...statusDoc.matchAll(/\*\*([A-Z_]+\.md)\*\* \((\d+)\+ lines\)/g)];
  for (const [, name, n] of claims) {
    const p = [path.join(ROOT, name), path.join(ROOT, 'docs', name)].find((c) => fs.existsSync(c));
    expect(p).toBeTruthy();
    const actual = fs.readFileSync(p, 'utf8').split('\n').length;
    expect(actual).toBeGreaterThanOrEqual(Number(n));
  }
});
