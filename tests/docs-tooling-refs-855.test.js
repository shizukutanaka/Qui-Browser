const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const scripts = require(path.join(ROOT, 'package.json')).scripts;

const AUDITED = [
  'CONTRIBUTING.md',
  'docs/DEVELOPER_ONBOARDING.md',
  'docs/IMPLEMENTATION.md',
  'docs/BUILD_OPTIMIZATION_GUIDE.md',
  'docs/CI_CD_MONITORING_GUIDE.md'
];

describe('dead tooling references in live docs (round 855)', () => {
  test.each(AUDITED)('%s only prescribes npm scripts that exist', (doc) => {
    const body = read(doc);
    for (const m of body.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)) {
      expect(scripts).toHaveProperty(m[1]);
    }
  });

  test.each(AUDITED)('%s references no deleted files or commands', (doc) => {
    const body = read(doc);
    const dead = [
      'webpack.config.js',
      'unified-systems.test.js',
      'vr-modules.test.js',
      'comprehensive.test.js',
      'tier-system-integration.test.js',
      'tools/README.md',
      'check-performance-regression.js',
      'assets/js/',
      'build:analyze',
      'benchmark.yml',
      'test.yml',
      'build:production',
      'npm run benchmark',
      'npm run lighthouse',
      'npm run test:size',
      'npm run check-budgets',
      'npm run start\n',
      '├── sw.js'
    ];
    for (const d of dead) {
      expect(body).not.toContain(d);
    }
  });

  test.each(AUDITED)('%s never prescribes the removed bundler', (doc) => {
    expect(read(doc)).not.toMatch(/webpack/i);
  });

  test('root-level files named by docs directory trees exist', () => {
    const body = read('docs/DEVELOPER_ONBOARDING.md');
    for (const m of body.matchAll(/^(?:├──|└──)\s+([a-zA-Z0-9_-]+\.(?:js|json|yml|cjs|mjs))\s+#/gm)) {
      expect(
        exists(m[1]) ||
          exists(path.join('dist', m[1])) ||
          exists(path.join('src', m[1])) ||
          exists(path.join('.github', 'workflows', m[1]))
      ).toBe(true);
    }
  });
});
