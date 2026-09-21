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

test('manifest.json URLs stay relative (verbatim copy → root-absolute 404s under a subpath base)', () => {
  // Same hazard as the html refs: start_url/scope/icons/shortcuts served from
  // /Qui-Browser/manifest.json must resolve relative to the manifest, not /.
  const m = JSON.parse(fs.readFileSync(path.join(PUB, 'manifest.json'), 'utf8'));
  const urls = [
    m.start_url, m.scope,
    ...(m.icons ?? []).map((i) => i.src),
    ...(m.shortcuts ?? []).map((s) => s.url)
  ].filter(Boolean);
  expect(urls.filter((u) => u.startsWith('/'))).toEqual([]);
});

test('offline.html never auto-reloads on polled navigator.onLine', () => {
  // navigator.onLine reflects OS connectivity, not server reachability — while
  // the site is down it stays true, so auto-reloading on it loops forever
  // (reload → SW serves offline.html again → reload…). Only a real `online`
  // event transition may trigger reload().
  const html = fs.readFileSync(path.join(PUB, 'offline.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  // Inside the script, reload() is allowed exactly once: the 'online'
  // listener. (The Try Again button's reload lives in its onclick attribute.)
  const reloadCalls = [...script.matchAll(/location\.reload\(\)/g)];
  expect(reloadCalls.length).toBe(1);
  const onlineListener = script.match(/addEventListener\('online',[\s\S]*?\}\)/);
  expect(onlineListener[0]).toContain('reload');
  // The polled check must not reload.
  const check = script.match(/function checkOnlineStatus\(\) \{([\s\S]*?)\n {8}\}/)[1];
  expect(check).not.toContain('reload(');
});

test('manifest shortcuts point at real routes (no router exists — only ./ works)', () => {
  // The app is a single-page shell with no client-side router: /bookmarks or
  // /?action=new-tab have no handler and only ever 404.
  const m = JSON.parse(fs.readFileSync(path.join(PUB, 'manifest.json'), 'utf8'));
  for (const s of m.shortcuts ?? []) {
    expect(s.url.startsWith('./')).toBe(true);
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
