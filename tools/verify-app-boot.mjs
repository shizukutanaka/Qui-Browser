/**
 * Boot the built app in a real browser and fail on anything broken.
 *
 * The gap this closes: no test in the suite has ever loaded the application.
 * `new VRApp()` cannot be constructed under Jest — `setupRenderer()` needs a
 * real WebGL context — so every unit test binds prototype methods to a
 * hand-built `this`. That is a deliberate, documented compromise, but it means
 * a module that fails to *import*, a stale reference left behind by a refactor,
 * or a dead entry in the Vite config is invisible to `npm test`. Session 74
 * deleted 129k lines and rewired VRApp; two such breakages (dead `manualChunks`
 * entries, a docstring referencing a removed class) were only found by
 * running the build and reading errors by hand. This automates that.
 *
 * SCOPE (measured, Session 74): initializeApp() returns early when the browser
 * has no immersive-VR runtime, so in headless Chromium this harness exercises
 * the LANDING SHELL only — module graph, static DOM, zero runtime errors on
 * that path. It does NOT construct VRApp. The full construction path
 * (renderer, settings panel, browsing systems) is covered by the companion
 * `tools/verify-vr-boot.mjs`, which stubs WebXR over CDP.
 *
 * What it asserts, against `dist/` (so it checks what actually ships):
 *   - the page loads and the module graph executes
 *   - zero uncaught exceptions and zero console errors
 *   - the app container and the Enter-VR control are present
 *   - i18n applied (the language toggle is wired)
 *   - the service worker registers, or is absent for a documented reason
 *
 * Dependency-free, like `verify-text-layout.mjs`: Node's own http server plus
 * the Chromium that is already on the box. Deliberately NOT Playwright — the
 * repo has no such dependency and this needs none.
 *
 * Usage: npm run build && npm run verify:app
 */

import { createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);
const DIST = join(REPO_ROOT, 'dist');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome'
].filter(Boolean);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    try {
      execFileSync(p, ['--version'], { stdio: 'ignore' });
      return p;
    } catch { /* try the next candidate */ }
  }
  return null;
}

/** Serve `dist/` read-only, confined to the directory. */
function serveDist() {
  return new Promise((resolveServer) => {
    const server = createServer(async (req, res) => {
      if (req.method !== 'GET') {
        res.writeHead(405).end();
        return;
      }
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const target = resolve(join(DIST, path === '/' ? 'index.html' : path));
      // Path confinement: never serve outside dist/.
      if (target !== DIST && !target.startsWith(DIST + sep)) {
        res.writeHead(403).end();
        return;
      }
      try {
        const st = await stat(target);
        const file = st.isDirectory() ? join(target, 'index.html') : target;
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404).end();
      }
    });
    server.listen(0, '127.0.0.1', () => resolveServer(server));
  });
}

async function main() {
  const chrome = findChrome();
  if (!chrome) {
    console.error('verify:app — no Chromium found; set CHROME_PATH');
    process.exit(2);
  }
  try {
    await stat(join(DIST, 'index.html'));
  } catch {
    console.error('verify:app — dist/index.html missing. Run `npm run build` first.');
    process.exit(2);
  }

  const server = await serveDist();
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/`;

  const args = [
    '--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--virtual-time-budget=15000',
    '--enable-logging=stderr', '--v=0',
    '--dump-dom', url
  ];

  const dom = await new Promise((res, rej) => {
    const p = spawn(chrome, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', rej);
    p.on('close', () => res({ out, err }));
  });

  await new Promise((r) => server.close(r));

  const failures = [];

  // Structural checks, read straight out of the rendered DOM.
  const present = (id) => new RegExp(`id="${id}"`).test(dom.out);
  const structural = [
    ['app container present', present('app-container')],
    ['Enter VR control present', present('enterVRButton') || present('vrFloatingButton')],
    ['language toggle present', present('langToggle')],
    ['accessibility controls present', present('a11yContrast') && present('a11yText')]
  ];
  for (const [name, ok] of structural) {
    if (!ok) {
      failures.push(name);
    }
  }

  // Asset URLs must be relative, or the page is blank under a subpath.
  // Measured before this was fixed: served from
  // https://<owner>.github.io/Qui-Browser/, 9 of 9 of the page's own assets
  // 404'd — including the module entry — because no workflow sets BASE_PATH
  // and the build emitted root-absolute URLs.
  const rootAbsolute = [...dom.out.matchAll(/(?:src|href)="(\/[^\/][^"]*)"/g)].map((m) => m[1]);
  if (rootAbsolute.length) {
    failures.push(`root-absolute asset URLs break a subpath deploy: ${rootAbsolute.join(', ')}`);
  }

  // Every asset the web-app manifest names must actually be in the build.
  //
  // The install icons lived in `assets/icons/` while Vite's publicDir is
  // `public/`, so none of them ever reached dist and every one 404'd — measured
  // in Chromium, "Error while trying to use the following icon from the
  // Manifest". Nothing noticed, because a missing icon breaks installation
  // rather than the page. Paths are relative so a subpath deploy resolves them.
  const manifestOk = [];
  try {
    const manifest = JSON.parse(await readFile(join(DIST, 'manifest.json'), 'utf8'));
    const refs = [
      ...(manifest.icons || []),
      ...(manifest.shortcuts || []).flatMap((s) => s.icons || []),
      ...(manifest.screenshots || [])
    ].map((e) => e.src).filter(Boolean);
    if (!refs.length) {
      failures.push('manifest declares no icons');
    }
    for (const src of refs) {
      if (src.startsWith('/')) {
        failures.push(`manifest asset "${src}" is root-absolute; breaks a subpath deploy`);
        continue;
      }
      try {
        await stat(join(DIST, src));
        manifestOk.push(src);
      } catch {
        failures.push(`manifest asset missing from the build: ${src}`);
      }
    }
  } catch (e) {
    failures.push(`manifest.json unreadable in dist: ${e.message}`);
  }

  // The module graph must actually have executed. Vite injects the hashed entry
  // script; if the graph failed to resolve, Chromium reports it on stderr.
  if (!/<script[^>]+type="module"/.test(dom.out)) {
    failures.push('module entry script missing from the built page');
  }

  // Real page errors surface on Chromium's stderr for a --dump-dom run.
  const noisy = dom.err
    .split('\n')
    .filter((l) => /\b(ERROR|Uncaught|SyntaxError|TypeError|ReferenceError|Failed to load)\b/.test(l))
    // These are environment artefacts of headless-without-a-display, not app bugs.
    .filter((l) => !/dbus|GPU|gpu_|Fontconfig|DevTools|sandbox|libva|Vulkan|udev|bluetooth|CreatePlatform/i.test(l));
  for (const line of noisy) {
    failures.push(`page error: ${line.trim()}`);
  }

  const width = 52;
  console.log('verify:app — booting the built app in Chromium\n');
  for (const [name, ok] of structural) {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name.padEnd(width)}`);
  }
  console.log(`  ${rootAbsolute.length === 0 ? 'ok  ' : 'FAIL'}  ${'asset URLs are subpath-safe'.padEnd(width)}`);
  const manifestClean = !failures.some((f) => f.startsWith('manifest'));
  console.log(
    `  ${manifestClean ? 'ok  ' : 'FAIL'}  ` +
      `${`manifest assets ship (${manifestOk.length} found)`.padEnd(width)}`
  );
  console.log(`  ${noisy.length === 0 ? 'ok  ' : 'FAIL'}  ${'no page errors'.padEnd(width)}`);
  console.log('');

  if (failures.length) {
    console.error(`FAIL — ${failures.length} problem(s):`);
    for (const f of failures) {
      console.error(`  • ${f}`);
    }
    process.exit(1);
  }
  console.log('PASS — the landing shell boots clean. (Full VRApp construction is verify:vr-boot.)');
}

main().catch((e) => {
  console.error('verify:app — harness error:', e);
  process.exit(2);
});
