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
    // Browser-emitted errors (ignored CSP directives, deprecations, blocked
    // resource loads) arrive ONLY on the Log domain — Runtime.consoleAPICalled
    // covers page-initiated console.* calls, Runtime.exceptionThrown covers
    // uncaught exceptions, and neither sees Log entries. Measured blind spot:
    // a `frame-ancestors` directive in the <meta> CSP logged an error on every
    // page load for months while both harnesses passed (verify:app's stderr
    // grep cannot see Log entries either — the message never reaches stderr
    // under --enable-logging=stderr --v=0).
    await cdp.send('Log.enable', {}, sessionId);
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
          // Panel-level callbacks — the fns WebPanel stores must reach the
          // real store, not just exist: isBookmarked reads live state, the
          // star toggle flips it AND announces both directions, and
          // getTopSites honours the VRApp-side private gate (a private
          // session must surface no history-derived tiles on a new tab —
          // distinct from the store-level gate, this is the panel callback).
          const tab2 = app.tabManager && app.tabManager.getActiveTab();
          if (tab2) {
            app.navigate('https://harness-top.example/', 'Top Page');
            out.topSitesHit = (tab2.getTopSites(8) || [])
              .some((s) => s.url === 'https://harness-top.example/');
            app.updateSetting('privateMode', true);
            out.topSitesPrivate = (tab2.getTopSites(8) || []).length;
            app.updateSetting('privateMode', false);
            out.isBookmarked = tab2.isBookmarked('https://harness-bm.example/') === true
              && tab2.isBookmarked('https://harness-never.example/') === false;
            tab2.onToggleBookmark('https://harness-toggle.example/', 'Toggle Page');
            out.toggleOn = app.bookmarks.isBookmarked('https://harness-toggle.example/');
            out.toggleCaption = statusEl ? statusEl.textContent : '';
            tab2.onToggleBookmark('https://harness-toggle.example/', 'Toggle Page');
            out.toggleOff = app.bookmarks.isBookmarked('https://harness-toggle.example/');
            out.toggleOffCaption = statusEl ? statusEl.textContent : '';
          }
          // URL-input request drives the whole keyboard wiring: setOnConfirm,
          // IME activate + ascii mode, composition prefill, show(), and the
          // prompt caption. vrKeyboard.visible is a real getter (reads the
          // group) — the undefined-flag defect made toggles always show().
          if (typeof app._requestVRKeyboardInput === 'function' && app.vrKeyboard) {
            app._requestVRKeyboardInput('https://harness-input.example/', () => {});
            out.kbShown = app.vrKeyboard.visible === true;
            out.kbAscii = !!(app.japaneseIME && app.japaneseIME.inputMode === 'ascii'
              && app.japaneseIME.compositionBuffer === 'https://harness-input.example/');
            out.kbPrompt = statusEl ? statusEl.textContent : '';
            app.vrKeyboard.hide();
            // The confirm half of the URL-input flow: the panel's
            // onUrlInputRequested stores a one-shot callback the IME's Enter
            // key commits to — firing it must reach tab.navigate (currentUrl
            // set synchronously) + the 'Loading: host' caption, and leave
            // the keyboard hidden with the callback consumed.
            if (tab2 && typeof tab2.onUrlInputRequested === 'function') {
              tab2.onUrlInputRequested('https://harness-input.example/', (url) => {
                if (url) tab2.navigate(url);
              });
              const hasCb = typeof app.vrKeyboard._onConfirmCallback === 'function';
              app.japaneseIME.compositionBuffer = 'https://harness-confirm.example/';
              app.vrKeyboard.onTextConfirmed('https://harness-confirm.example/');
              out.confirmCbStored = hasCb;
              out.confirmNav = tab2.currentUrl === 'https://harness-confirm.example/';
              out.confirmCleared = app.vrKeyboard._onConfirmCallback === null;
              out.confirmHidden = app.vrKeyboard.visible === false;
              out.confirmCaption = statusEl ? statusEl.textContent : '';
            }
          }
          // Stored-callback batch 2 — paths the panel side can only reach via
          // VRApp wiring (jest can't build TabManager, so these were never
          // driven end-to-end):
          //  * tab2.onLoadError → 'Failed to load: url' on the alert region
          //  * bookmarkPanel.onDeleteHistory / onTabChange → caption mirrors
          //  * _requestReaderProxyInput → proxy prompt + confirm persists
          //    readerProxyUrl + 'Reader proxy set' toast
          if (tab2 && typeof tab2.onLoadError === 'function') {
            tab2.onLoadError('https://harness-fail.example/');
            out.loadErrToast = alertEl ? alertEl.textContent : '';
          }
          if (app.bookmarkPanel) {
            if (typeof app.bookmarkPanel.onDeleteHistory === 'function') {
              app.bookmarkPanel.onDeleteHistory();
              out.bpDelHistCap = statusEl ? statusEl.textContent : '';
            }
            if (typeof app.bookmarkPanel.onTabChange === 'function') {
              app.bookmarkPanel.onTabChange('history');
              out.bpTabCap = statusEl ? statusEl.textContent : '';
            }
          }
          if (typeof app._requestReaderProxyInput === 'function' && app.vrKeyboard) {
            app._requestReaderProxyInput();
            out.proxyPrompt = statusEl ? statusEl.textContent : '';
            app.vrKeyboard.onTextConfirmed('http://localhost:8787');
            let srec = null;
            try { srec = JSON.parse(localStorage.getItem('qui-browser:settings')); } catch { /* noop */ }
            out.proxyPersisted = !!(srec && srec.readerProxyUrl === 'http://localhost:8787');
            out.proxyToast = alertEl ? alertEl.textContent : '';
          }
          // Batch 3 — the remaining never-driven paths:
          //  * bookmarkPanel.onDeleteBookmark / onClose / onHoverCaption
          //    (the last is gated on settings.enableGazeDwell — toggled here)
          //  * _launchImmersiveVideo: video-URL prompt → keyboard confirm →
          //    detectVideoFormat → sphere(s) + HUD in the scene; stop() must
          //    tear every bit of it back down.
          try {
          if (app.bookmarkPanel) {
            if (typeof app.bookmarkPanel.onDeleteBookmark === 'function') {
              app.bookmarkPanel.onDeleteBookmark();
              out.bpDelBmCap = statusEl ? statusEl.textContent : '';
            }
            if (typeof app.bookmarkPanel.onClose === 'function') {
              app.bookmarkPanel.onClose();
              out.bpCloseCap = statusEl ? statusEl.textContent : '';
            }
            if (typeof app.bookmarkPanel.onHoverCaption === 'function') {
              app.settings.enableGazeDwell = true;
              app.bookmarkPanel.onHoverCaption();
              out.bpHoverCap = statusEl ? statusEl.textContent : '';
              app.settings.enableGazeDwell = false;
            }
          }
          if (typeof app._launchImmersiveVideo === 'function' && app.immersiveVideo && app.vrKeyboard) {
            app._launchImmersiveVideo();
            out.videoPrompt = statusEl ? statusEl.textContent : '';
            app.vrKeyboard.onTextConfirmed('https://harness-video.example/v360.mp4');
            const iv = app.immersiveVideo;
            out.videoActive = iv.active === true && iv.meshes.length >= 1 && !!iv.controlPanel;
            iv.stop();
            out.videoStopped = iv.active === false && iv.meshes.length === 0 && !iv.controlPanel;
          }
          } catch (e) {
            out.b3Error = String(e && e.stack ? e.stack : e).split('\\n').slice(0, 3).join(' | ');
          }
        }
        return out;
      })()`,
      returnByValue: true
    }, sessionId);
    const iout = ir.result?.result?.value || {};
    if (!iout.dom) {
      console.warn('eval problem:', JSON.stringify(ir.result?.exceptionDetails || ir.error || ir).slice(0, 600));
    }
    if (iout.b3Error) {
      console.warn('batch3 threw:', iout.b3Error);
    }
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
      closeAnnounced: (iout.closeCaption || '').includes('Tab closed'),
      topSitesHit: !!iout.topSitesHit,
      topSitesPrivateEmpty: iout.topSitesPrivate === 0,
      isBookmarked: !!iout.isBookmarked,
      toggleOn: iout.toggleOn === true
        && (iout.toggleCaption || '').includes('Bookmarked'),
      toggleOff: iout.toggleOff === false
        && (iout.toggleOffCaption || '').includes('Bookmark removed'),
      kbShown: !!iout.kbShown,
      kbAscii: !!iout.kbAscii,
      kbPrompted: (iout.kbPrompt || '').includes('Enter URL'),
      confirmNav: iout.confirmCbStored === true
        && iout.confirmNav === true,
      confirmCleared: iout.confirmCleared === true
        && iout.confirmHidden === true,
      confirmAnnounced: (iout.confirmCaption || '').includes('Loading: harness-confirm.example'),
      loadErrToast: (iout.loadErrToast || '').includes('Failed to load: https://harness-fail.example/'),
      bpDelHistCap: (iout.bpDelHistCap || '').includes('History entry deleted'),
      bpTabCap: (iout.bpTabCap || '').includes('History'),
      proxyPrompt: (iout.proxyPrompt || '').includes('Reader proxy URL'),
      proxyApplied: iout.proxyPersisted === true
        && (iout.proxyToast || '').includes('Reader proxy set'),
      bpDelBmCap: (iout.bpDelBmCap || '').includes('Bookmark deleted'),
      bpCloseCap: (iout.bpCloseCap || '').includes('Bookmarks: closed'),
      bpHoverCap: (iout.bpHoverCap || '').includes('Bookmarks panel'),
      videoPrompt: (iout.videoPrompt || '').includes('Enter video URL'),
      videoActive: iout.videoActive === true,
      videoStopped: iout.videoStopped === true
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
      if (ev.method === 'Log.entryAdded' && ev.params.entry.level === 'error') {
        const text = ev.params.entry.text || '';
        errors.push('log error: ' + text.slice(0, 200));
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
      ['panel getTopSites surfaces a visited URL', !!inter.topSitesHit],
      ['panel getTopSites empties under private mode', !!inter.topSitesPrivateEmpty],
      ['panel isBookmarked reads live store state', !!inter.isBookmarked],
      ['star toggle bookmarks + announces Bookmarked', !!inter.toggleOn],
      ['star re-toggle removes + announces Bookmark removed', !!inter.toggleOff],
      ['URL-input request opened the VR keyboard', !!inter.kbShown],
      ['keyboard opened in ascii mode with URL prefill', !!inter.kbAscii],
      ['keyboard prompt announced via caption', !!inter.kbPrompted],
      ['IME confirm navigated the panel', !!inter.confirmNav],
      ['confirm consumed callback + hid keyboard', !!inter.confirmCleared],
      ['Loading caption announced on confirm', !!inter.confirmAnnounced],
      ['load error reached alert region', !!inter.loadErrToast],
      ['history-delete announced via caption', !!inter.bpDelHistCap],
      ['panel tab-change announced via caption', !!inter.bpTabCap],
      ['proxy prompt announced via caption', !!inter.proxyPrompt],
      ['proxy confirm persisted + toasted', !!inter.proxyApplied],
      ['bookmark-delete announced via caption', !!inter.bpDelBmCap],
      ['panel close announced via caption', !!inter.bpCloseCap],
      ['panel hover announced via caption (gaze gate)', !!inter.bpHoverCap],
      ['video prompt announced via caption', !!inter.videoPrompt],
      ['immersive video built spheres + HUD', !!inter.videoActive],
      ['immersive video stop tore down scene', !!inter.videoStopped],
      ['no uncaught exceptions / console errors / browser log errors', errors.length === 0]
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
