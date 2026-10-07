/**
 * Quick-start docs honesty — the getting-started docs must not contradict the
 * shipped config surface they describe:
 *
 *  1. docs/QUICK_START.md must not claim a Node.js floor higher than
 *     package.json `engines.node` (a stricter doc makes Node-18 users believe
 *     they cannot run the app — engines says >=18.0.0 and CI tests on 18).
 *  2. Both quick-start docs must point `npm run preview` at the port Vite
 *     actually serves (vite.config.js preview.port), not Vite's default 4173 —
 *     following the doc today hits connection refused.
 *  3. Every `npm run <script>` the doc prescribes must exist in package.json.
 */

const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const quickStart = fs.readFileSync(path.join(__dirname, '..', 'docs', 'QUICK_START.md'), 'utf8');
const quickstart = fs.readFileSync(path.join(__dirname, '..', 'docs', 'QUICKSTART.md'), 'utf8');
const viteConfig = fs.readFileSync(path.join(__dirname, '..', 'vite.config.js'), 'utf8');

function enginesFloor() {
  const m = /"node"\s*:\s*"[^0-9]*(\d+)/.exec(JSON.stringify(pkg.engines || {}));
  expect(m).not.toBeNull();
  return Number(m[1]);
}

function configuredPreviewPort() {
  const m = /preview\s*:\s*\{[^}]*?port\s*:\s*(\d+)/s.exec(viteConfig);
  expect(m).not.toBeNull();
  return Number(m[1]);
}

describe('quick-start docs honesty', () => {
  it('QUICK_START.md Node floor does not exceed package.json engines', () => {
    const claimed = /Node\.js[^\d]*(\d+)\+/i.exec(quickStart);
    expect(claimed).not.toBeNull();
    expect(Number(claimed[1])).toBeLessThanOrEqual(enginesFloor());
  });

  it.each([
    ['docs/QUICK_START.md', quickStart],
    ['docs/QUICKSTART.md', quickstart]
  ])('%s documents the configured preview port', (_name, doc) => {
    const line = /npm run preview[^\n]*/.exec(doc);
    expect(line).not.toBeNull();
    expect(line[0]).toContain(`:${configuredPreviewPort()}`);
  });

  it('every documented `npm run` script exists in package.json', () => {
    const documented = [...quickStart.matchAll(/npm run ([a-z:_-]+)/g)].map((m) => m[1]);
    expect(documented.length).toBeGreaterThan(0);
    for (const script of documented) {
      expect(pkg.scripts).toHaveProperty(script);
    }
  });
});
