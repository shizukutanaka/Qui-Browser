/**
 * public/ liveness: every top-level asset Vite copies verbatim into dist/
 * must be reachable — referenced by index.html, the service worker's
 * precache, src/, or be a standard entry (manifest.json / sw / offline
 * fallback). Measured 2026-09-20: vr-browser.html, vr-video.html,
 * vr-browser.js, css-containment-optimizer.js, lazy-loading-observer.js,
 * view-transitions-manager.js (2,505 lines) had zero references — dead
 * payload shipped to every install.
 */
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', 'public');
const REFS = [
  fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'),
  fs.readFileSync(path.join(PUB, 'service-worker.js'), 'utf8'),
  ...fs.readdirSync(path.join(__dirname, '..', 'src'), { recursive: true })
    .filter((f) => f.endsWith('.js') || f.endsWith('.html'))
    .map((f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'))
].join('\n');

// Standard entry points that need no inbound reference.
const ENTRY = new Set(['manifest.json', 'service-worker.js', 'offline.html']);

const topFiles = fs.readdirSync(PUB, { withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => d.name);

test.each(topFiles)('public/%s is referenced (or a known entry point)', (name) => {
  if (ENTRY.has(name)) {
    return;
  }
  expect(REFS).toContain(name);
});

test('public/*.html has no root-absolute asset refs (vite copies public/ verbatim — they 404 under a subpath base)', () => {
  // offline.html ships to dist/ untouched, so '/icons/x.png' breaks under
  // BASE_PATH=/Qui-Browser/ even after the cd.yml Pages fix. Relative refs
  // resolve under whatever base the file is served from.
  for (const name of topFiles.filter((n) => n.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(PUB, name), 'utf8');
    const bad = [...html.matchAll(/(?:href|src)="\/[^"]*"/g)].map((m) => m[0]);
    expect(bad).toEqual([]);
  }
});

test('known dead cluster stays deleted', () => {
  for (const name of [
    'vr-browser.html', 'vr-video.html', 'vr-browser.js',
    'css-containment-optimizer.js', 'lazy-loading-observer.js',
    'view-transitions-manager.js', 'sw.js'
  ]) {
    expect(fs.existsSync(path.join(PUB, name))).toBe(false);
  }
});
