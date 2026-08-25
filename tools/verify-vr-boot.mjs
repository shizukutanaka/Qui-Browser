/**
 * Boot the FULL VR application — not just the landing page — in real Chromium.
 *
 * Why `verify:app` is not enough: `initializeApp()` deliberately returns early
 * when the browser has no immersive-VR support ("landing page only"), so in
 * headless Chromium `new VRApp(container)` never runs. That means the code
 * path every real headset user hits at boot — renderer setup, scene, settings
 * panel, and `_buildBrowsingSystems()` (default-ON since Session 74) — had no
 * automated coverage at all. Session 74's PR #55 claimed verify:app covered
 * it; that claim was wrong, and this tool is the correction.
 *
 * How it works:
 *  - serve `dist/` (what actually ships) over a local HTTP server, injecting a
 *    WebXR stub into index.html so the support check passes. The stub MUST use
 *    `Object.defineProperty`: desktop Chromium exposes a real `navigator.xr`
 *    accessor on the prototype, and a plain assignment is silently ignored in
 *    sloppy mode — measured, that left the real (unsupported) runtime in place
 *    and the app on the landing-page path while `!!navigator.xr` still read
 *    true.
 *  - drive Chromium over CDP with Node's built-in WebSocket (zero deps).
 *    `--dump-dom --virtual-time-budget` CANNOT do this job: measured in both
 *    old and new headless modes, it dumps at the load event and never pumps
 *    the dynamic `import('./app.js')` chain, so construction never happens.
 *  - poll the live page: the app instance must exist, the renderer's canvas
 *    must be attached under #app-container, and the browsing systems must be
 *    constructed (tabManager — the default-ON core loop). Assertions read DOM
 *    and object state, never console text: the production build strips every
 *    console call (`esbuild.drop: ['console']`), so log markers do not exist
 *    in what ships.
 *  - fail on any uncaught exception or console.error event.
 *
 * Phase 2 additionally drives a real navigation and asserts the page is
 * actually READ — the core loop, in a real browser, with a real fetch. The
 * target is served by this harness on the same origin, so it needs no network
 * and no CORS header: what is verified is the machinery, not the internet.
 *
 * That check exists because it is the one that was missing. While WebPanel
 * carried a hidden <iframe>, the frame's load event settled the content state
 * independently of the reader — measured, it overwrote a successfully read
 * article ('reader', 9 lines, 0.6 s) with 'unavailable' at 1.2 s, and an
 * injected hang in the reader still passed. The frame is gone and the reader
 * owns the state, so demanding 'reader' here catches both.
 *
 * Usage: npm run build && npm run verify:vr-boot
 */

import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
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
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

/**
 * WebXR stub. defineProperty is load-bearing — see the header comment.
 * requestSession still rejects: this verifies construction, and honestly
 * cannot verify an immersive session without an XR runtime.
 */
const XR_STUB = `<script>
Object.defineProperty(navigator, 'xr', { configurable: true, value: {
  isSessionSupported: async () => true,
  requestSession: () => Promise.reject(new DOMException('no runtime in CI', 'NotSupportedError')),
  addEventListener() {}, removeEventListener() {}
}});
</script>`;

/** Same-origin article for the Phase-2 reader check. */
const ARTICLE_PATH = '/__verify-article';
const ARTICLE_TITLE = 'Verify Reader Article';
const ARTICLE_MARKER = 'quibrowserreadermarker';
const ARTICLE_HTML = `<!doctype html><html><head><title>${ARTICLE_TITLE}</title></head>
<body><nav>navigation junk</nav><script>var junk = 1;</script>
<article><h2>Heading</h2>
<p>${(ARTICLE_MARKER + ' sentence of prose. ').repeat(30)}</p>
<p>${'A second paragraph of prose follows. '.repeat(30)}</p>
<a href="${ARTICLE_PATH}?followed=1">Follow me</a>
</article></body></html>`;

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    try {
      execFileSync(p, ['--version'], { stdio: 'ignore' });
      return p;
    } catch { /* try the next candidate */ }
  }
  return null;
}

function serveDistWithStub() {
  return new Promise((resolveServer) => {
    const server = createServer((req, res) => {
      if (req.method !== 'GET') {
        res.writeHead(405).end();
        return;
      }
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (path === ARTICLE_PATH) {
        // A same-origin page for the reader to actually read. Same origin, so
        // no CORS header and no network are needed — the fetch is real, the
        // extraction is real, only the internet is absent.
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(ARTICLE_HTML);
        return;
      }
      const target = resolve(join(DIST, path === '/' ? 'index.html' : path));
      if (target !== DIST && !target.startsWith(DIST + sep)) {
        res.writeHead(403).end();
        return;
      }
      try {
        const st = statSync(target);
        const file = st.isDirectory() ? join(target, 'index.html') : target;
        let body = readFileSync(file);
        if (file.endsWith('index.html')) {
          body = Buffer.from(body.toString().replace('<head>', '<head>' + XR_STUB));
        }
        res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404).end();
      }
    });
    server.listen(0, '127.0.0.1', () => resolveServer(server));
  });
}

/** Minimal CDP client over Node's built-in WebSocket. */
function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    } else if (m.method) {
      events.push(m);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  return new Promise((res, rej) => {
    ws.onopen = () => res({ send, events, close: () => ws.close() });
    ws.onerror = (e) => rej(new Error('CDP connect failed: ' + e.message));
  });
}

async function main() {
  const chrome = findChrome();
  if (!chrome) {
    console.error('verify:vr-boot — no Chromium found; set CHROME_PATH');
    process.exit(2);
  }
  try {
    statSync(join(DIST, 'index.html'));
  } catch {
    console.error('verify:vr-boot — dist/index.html missing. Run `npm run build` first.');
    process.exit(2);
  }

  const server = await serveDistWithStub();
  const url = `http://127.0.0.1:${server.address().port}/`;

  const proc = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader', '--remote-debugging-port=0', 'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  const cleanup = () => {
    proc.kill();
    server.close();
  };

  try {
    const wsUrl = await new Promise((res, rej) => {
      let err = '';
      const t = setTimeout(() => rej(new Error('DevTools endpoint never appeared: ' + err.slice(0, 300))), 20000);
      proc.stderr.on('data', (d) => {
        err += d;
        const m = err.match(/DevTools listening on (ws:\/\/\S+)/);
        if (m) {
          clearTimeout(t);
          res(m[1]);
        }
      });
    });

    const cdp = await connectCdp(wsUrl);
    const { result: { targetId } } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { result: { sessionId } } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Page.navigate', { url }, sessionId);

    // Poll for full construction. Object/DOM state only — never console text
    // (the production build strips console.*).
    const PROBE = `(() => {
      const app = window.QuiBrowser && window.QuiBrowser.getApp && window.QuiBrowser.getApp();
      return {
        app: !!app,
        canvas: !!document.querySelector('#app-container canvas'),
        tabManager: !!(app && app.tabManager),
        settingsPanel: !!(app && app.settingsPanel),
        captionSystem: !!(app && app.captionSystem)
      };
    })()`;
    const deadline = Date.now() + 20000;
    let state = {};
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 400));
      const r = await cdp.send('Runtime.evaluate', { expression: PROBE, returnByValue: true }, sessionId);
      state = r.result?.result?.value || {};
      if (state.app && state.canvas && state.tabManager) {
        break;
      }
    }

    // ── Phase 2: drive the core loop ──────────────────────────────────────
    // Construction alone does not prove the browser browses. This navigates a
    // real tab to a page this harness serves, exercising WebPanel.navigate ->
    // _loadReaderText -> fetch -> extract -> layout -> content state in an
    // actual browser. No unit test can: `new VRApp()` needs a GPU, and Jest
    // has no fetch stack.
    //
    // Same origin, so no CORS header and no network are required — this stays
    // green offline. The page IS readable, so the panel must end on 'reader'
    // with the prose recovered. Ending anywhere else means the loop is broken:
    // stuck on 'loading' is a hang, and 'unavailable' means something threw
    // away a successful read (exactly what the deleted iframe did).
    //
    // The sample is taken AFTER a settling delay, not at the first terminal
    // state. Polling until "something other than loading" and stopping there
    // is blind to exactly the defect this exists to catch: the iframe reached
    // its verdict ~600 ms after the reader, so an early sample sees 'reader'
    // and never observes the overwrite. Verified — a reproduction of the frame
    // passed the early-sample version of this check and fails this one.
    let loop = {};
    if (state.tabManager) {
      const READ_STATE = `(() => {
        const p = window.QuiBrowser.getApp().tabManager.getActiveTab();
        return { state: p._contentState, url: p.currentUrl, title: p.currentTitle,
                 loading: p.loading, history: p.history.length,
                 lines: p._readerLines.length,
                 prose: p._readerLines.some((l) => (l.text || '')
                   .includes(${JSON.stringify(ARTICLE_MARKER)})),
                 link: (p._readerLines.find((l) => l.href) || {}).href || '' };
      })()`;
      const sample = async () => {
        const r = await cdp.send('Runtime.evaluate',
          { expression: READ_STATE, returnByValue: true }, sessionId);
        return r.result?.result?.value || {};
      };
      await cdp.send('Runtime.evaluate', {
        expression: `window.QuiBrowser.getApp().tabManager.getActiveTab()
          .navigate(${JSON.stringify(url + ARTICLE_PATH.slice(1))})`,
        awaitPromise: false
      }, sessionId);
      const loopDeadline = Date.now() + 15000;
      while (Date.now() < loopDeadline) {
        await new Promise((r) => setTimeout(r, 400));
        loop = await sample();
        if (loop.state && loop.state !== 'loading' && loop.state !== 'empty') {
          break;
        }
      }
      // Settle: give anything else that thinks it owns the state time to speak
      // up, then take the authoritative reading.
      await new Promise((r) => setTimeout(r, 3000));
      loop = await sample();
    }

    // Uncaught exceptions and console.error events collected during boot.
    const errors = [];
    for (const ev of cdp.events) {
      if (ev.method === 'Runtime.exceptionThrown') {
        const d = ev.params.exceptionDetails;
        errors.push('exception: ' + (d.exception?.description || d.text || '').split('\n')[0]);
      }
      if (ev.method === 'Runtime.consoleAPICalled' && ev.params.type === 'error') {
        const text = (ev.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
        errors.push('console.error: ' + text.slice(0, 200));
      }
    }

    const checks = [
      ['VRApp constructed (QuiBrowser.getApp() non-null)', !!state.app],
      ['renderer canvas attached under #app-container', !!state.canvas],
      ['browsing systems constructed (tabManager — default ON)', !!state.tabManager],
      ['settings panel constructed', !!state.settingsPanel],
      ['caption system constructed', !!state.captionSystem],
      ['navigation clears the loading flag (never stuck loading)', loop.loading === false],
      ['the visit is recorded in history', (loop.history || 0) >= 1],
      [`a readable page is READ, not discarded (state=${loop.state || 'none'})`,
        loop.state === 'reader'],
      ['the page prose reaches the viewport', loop.prose === true && loop.lines > 3],
      ['the title comes from the markup', loop.title === ARTICLE_TITLE],
      ['the page\'s links are followable (hypertext, not just text)',
        loop.link === url + ARTICLE_PATH.slice(1) + '?followed=1'],
      ['no uncaught exceptions / console errors', errors.length === 0]
    ];

    console.log('verify:vr-boot — full VRApp construction in Chromium (WebXR stubbed)\n');
    for (const [name, ok] of checks) {
      console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`);
    }
    console.log('');
    const failed = checks.filter(([, ok]) => !ok);
    if (failed.length) {
      console.error(`FAIL — ${failed.length} check(s) failed.`);
      for (const e of errors.slice(0, 10)) {
        console.error('  • ' + e);
      }
      cdp.close();
      cleanup();
      process.exit(1);
    }
    console.log('PASS — the shipped bundle constructs the full VR app, browsing included.');
    cdp.close();
  } finally {
    cleanup();
  }
}

main().catch((e) => {
  console.error('verify:vr-boot — harness error:', e);
  process.exit(2);
});
