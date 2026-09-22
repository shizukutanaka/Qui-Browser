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
 * Usage: npm run build && npm run verify:vr-boot
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { findChrome } from './chrome-path.mjs';

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);
const DIST = join(REPO_ROOT, 'dist');


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


function serveDistWithStub() {
  return new Promise((resolveServer) => {
    const server = createServer((req, res) => {
      if (req.method !== 'GET') {
        res.writeHead(405).end();
        return;
      }
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
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

    // Interaction phase — construction alone never exercised the cross-modal
    // wiring (showVRToast → SemanticDOM alert mirror, captionSystem.show →
    // onShow → caption live region). That exact path produced several recent
    // fixes (announce suppression, duplicate-announce, enabled-gate), so drive
    // it here end-to-end: the ARIA mirrors are unconditional surfaces, so the
    // check holds regardless of caption/settings state.
    const ir = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const app = QuiBrowser.getApp();
        const dom = document.querySelector('[data-qui-semantic-dom]');
        const alertEl = dom && dom.querySelector('[role="alert"]');
        const statusEl = dom && dom.querySelector('[role="status"]');
        const out = { dom: !!dom, afterToast: '', afterDupe: '', statusText: statusEl ? statusEl.textContent : '' };
        if (!app) return out;
        app.showVRToast('harness-toast-check', { type: 'info' });
        out.afterToast = alertEl ? alertEl.textContent : '';
        if (app.captionSystem) app.captionSystem.show('harness-caption-check');
        out.statusText = statusEl ? statusEl.textContent : '';
        // Duplicate-announce: a repeated identical alert must still mutate the
        // region (zero-width marker) — SRs only announce live-region mutations.
        app.showVRToast('harness-dupe-check', { type: 'info' });
        app.showVRToast('harness-dupe-check', { type: 'info' });
        out.afterDupe = alertEl ? alertEl.textContent : '';
        // History recording: app.navigate() writes BookmarkStore history into
        // REAL localStorage (jest mocks it — this is the first e2e write-path
        // coverage). Frecency search must then surface the entry.
        if (app.bookmarks && typeof app.navigate === 'function') {
          app.navigate('https://harness-nav.example/', 'Harness Nav Page');
          out.historyHit = app.bookmarks.search('harness-nav.example', 5, Date.now())
            .some((s) => s.url === 'https://harness-nav.example/');
          // Private mode: the same call must write nothing — the privacy
          // contract (VRApp.navigate gates addHistory on settings.privateMode).
          app.updateSetting('privateMode', true);
          app.navigate('https://harness-private.example/', 'Private Page');
          out.privateLeak = app.bookmarks.search('harness-private.example', 5, Date.now()).length > 0;
          app.updateSetting('privateMode', false);
          // IME autocomplete chain: the navigate() write above must surface
          // through the same suggestionProvider the VR keyboard consults
          // (BookmarkStore.search → frecency → suggestion buttons).
          if (app.vrKeyboard && app.vrKeyboard.suggestionProvider) {
            const sugg = app.vrKeyboard.suggestionProvider('harness-nav') || [];
            out.imeSuggest = sugg.some((s) => s.url === 'https://harness-nav.example/');
          }
          // Settings persistence: updateSetting must write SETTINGS_KEY into
          // real localStorage — the contract _loadSettings reads back on boot.
          const prev = app.settings.snapTurnAngle;
          app.updateSetting('snapTurnAngle', 45);
          try {
            const stored = JSON.parse(localStorage.getItem('qui-browser:settings'));
            out.settingsPersisted = stored && stored.snapTurnAngle === 45;
          } catch {
            out.settingsPersisted = false;
          }
          app.updateSetting('snapTurnAngle', prev);
          // Clear-history contract: recorded entries wipe AND the alert
          // mirror announces the destructive action (WCAG 4.1.3 feedback).
          if (typeof app._clearBrowsingHistory === 'function') {
            app._clearBrowsingHistory();
            out.historyCleared = app.bookmarks.search('harness-nav.example', 5).length === 0;
            out.alertAfterClear = alertEl ? alertEl.textContent : '';
          }
          // Bookmark-only suggestion: a bookmark with NO history entry still
          // surfaces via its virtual-visit score — and must survive the wipe.
          app.bookmarks.toggleBookmark('https://harness-bm.example/', 'BM Page');
          out.bmSuggest = app.bookmarks.search('harness-bm.example', 5, Date.now())
            .some((s) => s.url === 'https://harness-bm.example/');
          // Tab-session persistence: panel navigate sets currentUrl →
          // serialize() → localStorage[TAB_SESSION_KEY]; private mode
          // neither writes nor restores — an incognito session stays
          // ephemeral like history recording.
          const tab = app.tabManager && app.tabManager.getActiveTab();
          if (tab && typeof tab.navigate === 'function') {
            tab.navigate('https://harness-tab.example/');
            app._saveTabSession();
            let sdata = null;
            try { sdata = JSON.parse(localStorage.getItem('qui.tabSession.v1')); } catch {
              sdata = null;
            }
            out.tabPersisted = !!(sdata && Array.isArray(sdata.tabs)
              && sdata.tabs.some((t) => t && t.url === 'https://harness-tab.example/'));
            app.updateSetting('privateMode', true);
            localStorage.removeItem('qui.tabSession.v1');
            app._saveTabSession();
            out.tabPrivateSaved = localStorage.getItem('qui.tabSession.v1') !== null;
            out.tabPrivateRestore = app._restoreTabSession();
            app.updateSetting('privateMode', false);
          }
          // Announce paths — every user-visible status must reach an ARIA
          // live region (WCAG 4.1.3): dangerous-scheme block (warn toast),
          // tab close (caption), and the 9th-tab limit (warn toast).
          if (tab) {
            tab.navigate('javascript:alert(1)'); // resolves to null → blocked
            out.alertBlocked = alertEl ? alertEl.textContent : '';
          }
          while (app.tabManager.count < 8) {
            app.tabManager.newTab();
          }
          app.tabManager.newTab(); // 9th → MAX_TABS → onMaxTabsReached
          out.alertMaxTabs = alertEl ? alertEl.textContent : '';
          if (app.captionSystem) {
            app.captionSystem.setEnabled(true);
          }
          app.tabManager.closeTab(0);
          out.closeCaption = statusEl ? statusEl.textContent : '';
          while (app.tabManager.count > 1) {
            app.tabManager.closeTab(0); // restore a single open tab
          }
        }
        return out;
      })()`,
      returnByValue: true
    }, sessionId);
    const iout = ir.result?.result?.value || {};
    if (process.env.VR_BOOT_DEBUG) {
      console.info('interact:', JSON.stringify(iout));
    }
    const inter = {
      dom: !!iout.dom,
      alertHas: (iout.afterToast || '').includes('harness-toast-check'),
      // The second identical toast must leave the marker appended — the
      // text ends with U+200B only when _announce() fired its
      // duplicate-mutation branch; a verbatim rewrite means the repeat
      // would never be announced by screen readers.
      dupMarked: (iout.afterDupe || '').endsWith('\u200B'),
      statusHas: (iout.statusText || '').includes('harness-caption-check'),
      historyHit: !!iout.historyHit,
      privateClean: iout.privateLeak === false,
      imeSuggest: !!iout.imeSuggest,
      settingsPersisted: !!iout.settingsPersisted,
      historyCleared: !!iout.historyCleared,
      clearAnnounced: (iout.alertAfterClear || '').includes('History cleared'),
      bmSuggest: !!iout.bmSuggest,
      tabPersisted: !!iout.tabPersisted,
      tabPrivateClean: iout.tabPrivateSaved === false && iout.tabPrivateRestore === 0,
      blockedAnnounced: (iout.alertBlocked || '').includes('Cannot open that address'),
      maxTabsAnnounced: (iout.alertMaxTabs || '').includes('Maximum tabs reached'),
      closeAnnounced: (iout.closeCaption || '').includes('Tab closed')
    };

    // Uncaught exceptions and console.error events collected during boot.
    const errors = [];
    for (const ev of cdp.events) {
      if (ev.method === 'Runtime.exceptionThrown') {
        const d = ev.params.exceptionDetails;
        errors.push('exception: ' + (d.exception?.description || d.text || '').split('\n')[0]);
      }
      if (ev.method === 'Runtime.consoleAPICalled' && ev.params.type === 'error') {
        const text = (ev.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
        // Missing optional sound assets degrade gracefully by design.
        if (!/assets\/sounds/.test(text)) {
          errors.push('console.error: ' + text.slice(0, 200));
        }
      }
    }

    const checks = [
      ['VRApp constructed (QuiBrowser.getApp() non-null)', !!state.app],
      ['renderer canvas attached under #app-container', !!state.canvas],
      ['browsing systems constructed (tabManager — default ON)', !!state.tabManager],
      ['settings panel constructed', !!state.settingsPanel],
      ['caption system constructed', !!state.captionSystem],
      ['semantic DOM mirror mounted', !!inter.dom],
      ['toast reached alert live region (cross-modal wiring)', !!inter.alertHas],
      ['identical repeat toast re-announced (ZWSP marker)', !!inter.dupMarked],
      ['caption reached status live region (cross-modal wiring)', !!inter.statusHas],
      ['navigate() recorded history into real localStorage', !!inter.historyHit],
      ['private mode wrote no history', !!inter.privateClean],
      ['history feeds IME suggestions (frecency → keyboard chain)', !!inter.imeSuggest],
      ['updateSetting persisted to real localStorage', !!inter.settingsPersisted],
      ['clear-history wiped recorded entries', !!inter.historyCleared],
      ['history-clear announced via alert region', !!inter.clearAnnounced],
      ['bookmark-only URL suggested after wipe', !!inter.bmSuggest],
      ['tab session persisted to real localStorage', !!inter.tabPersisted],
      ['private mode wrote + restored no tab session', !!inter.tabPrivateClean],
      ['blocked scheme announced via warn toast', !!inter.blockedAnnounced],
      ['tab close announced via caption status', !!inter.closeAnnounced],
      ['max tabs announced via warn toast', !!inter.maxTabsAnnounced],
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
