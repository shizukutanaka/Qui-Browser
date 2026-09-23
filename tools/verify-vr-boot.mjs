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
// SpeechRecognition stub — VoiceCommands.initialize() gates on
// window.SpeechRecognition, so without this enableVoice constructs nothing
// and the whole voice-command surface stays undrivable end-to-end.
function __StubSpeechRecognition() {}
__StubSpeechRecognition.prototype.start = function () {
  if (this.onstart) this.onstart();
};
__StubSpeechRecognition.prototype.stop = function () {
  if (this.onend) this.onend();
};
__StubSpeechRecognition.prototype.abort = function () {};
if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
  window.SpeechRecognition = __StubSpeechRecognition;
}
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
      expression: `(async () => {
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
          // Tab-session restore edges — corrupt payloads return 0, malformed
          // entries are skipped, the list clamps at MAX_TABS and a stale
          // 'active' index clamps to the last restored tab. A fresh manager
          // parked at y=-100 keeps its panels out of every later leg's ray.
          if (app.tabManager) {
            const TM = app.tabManager.constructor;
            const mkTM = () => new TM({
              scene: app.scene,
              registerInteractable: () => {},
              unregisterInteractable: () => {},
              position: { x: 0, y: -100, z: 0 }
            });
            const tmA = mkTM();
            out.tmRestoreCorrupt = tmA.restoreSession(null) === 0
              && tmA.restoreSession({}) === 0
              && tmA.restoreSession({ tabs: 'nope' }) === 0
              && tmA.count === 0
              && tmA.restoreSession({ v: 1, tabs: [
                { url: 'https://rest-ok.example/' }] }) === 1
              && tmA.count === 1;
            const tmB = mkTM();
            const nB = tmB.restoreSession({ v: 1, active: 0, tabs: [
              { url: 'https://rest-a.example/' },
              { nope: true }, 'raw', null, { url: '' },
              { url: 'https://rest-b.example/' }] });
            out.tmRestoreSkip = nB === 2 && tmB.count === 2
              && tmB.tabs[0].currentUrl === 'https://rest-a.example/'
              && tmB.tabs[1].currentUrl === 'https://rest-b.example/';
            const tmC = mkTM();
            const big = { v: 1, active: 0, tabs: [] };
            for (let bi = 0; bi < 10; bi++) {
              big.tabs.push({ url: 'https://rest-' + bi + '.example/' });
            }
            out.tmRestoreClamp = tmC.restoreSession(big) === 8
              && tmC.count === 8;
            const tmD = mkTM();
            tmD.restoreSession({ v: 1, active: 99, tabs: [
              { url: 'https://rest-a.example/' },
              { url: 'https://rest-b.example/' }] });
            const tmE = mkTM();
            tmE.restoreSession({ v: 1, active: 0, tabs: [
              { url: 'https://rest-a.example/' },
              { url: 'https://rest-b.example/' }] });
            out.tmRestoreActive = tmD.activeIndex === 1
              && tmE.activeIndex === 0;
            // serialize() is the restore source's mirror — only navigated
            // tabs persist and 'active' is re-indexed into the filtered
            // list. A blank active tab falls back to index 0; an all-blank
            // session serializes empty.
            const tmS = mkTM();
            tmS.newTab('https://ser-a.example/');
            tmS.newTab(); // blank — must be dropped
            tmS.newTab('https://ser-b.example/');
            tmS.setActive(2);
            const serS = tmS.serialize();
            out.tmSerializeReindex = serS.v === 1
              && serS.tabs.length === 2
              && serS.tabs[0].url === 'https://ser-a.example/'
              && serS.tabs[1].url === 'https://ser-b.example/'
              && serS.active === 1; // active tab re-indexed 2 → 1
            const tmB2 = mkTM();
            tmB2.newTab(); // blank tab at index 0
            tmB2.newTab('https://ser-c.example/');
            tmB2.setActive(0);
            const serB = tmB2.serialize();
            out.tmSerializeBlankActive = serB.active === 0
              && serB.tabs.length === 1
              && serB.tabs[0].url === 'https://ser-c.example/';
            const tmN = mkTM();
            tmN.newTab();
            const serN = tmN.serialize();
            out.tmSerializeEmpty = serN.v === 1
              && serN.active === 0
              && serN.tabs.length === 0;
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
            // The UV -> action dispatch every select path funnels through —
            // controller ray and gaze-dwell both land in _onSelect. Drive it
            // with world points computed from the zone layout (hitTest +
            // uvToPixels in bookmarkLayout.js): header tab/scroll zones,
            // row hit -> onSelect(url) -> the wired tab navigation + panel
            // hides, delete-zone hit -> store removal + caption mirror, and
            // the close corner -> hide + onClose caption.
            const bpPanel = app.bookmarkPanel;
            if (app.bookmarks && app.scene && bpPanel.mesh) {
              const rowsSeeded = [];
              for (let k = 0; k < 12; k++) {
                const u2 = 'https://bp-row-' + k + '.example/';
                app.bookmarks.addHistory(u2, 'Row ' + k);
                rowsSeeded.push(u2);
              }
              const modeWas = bpPanel.mode;
              const scrollWas = bpPanel.scrollOffset;
              const visWas = bpPanel.visible;
              try {
                bpPanel.show();
                bpPanel.setMode('bookmarks');
                const hitPx = (px, py) => {
                  const u = px / 1024;
                  const v = 1 - py / 768;
                  const lp = bpPanel.mesh.position.clone().set(
                    (u - 0.5) * bpPanel.panelW,
                    (v - 0.5) * bpPanel.panelH, 0);
                  return bpPanel.mesh.localToWorld(lp);
                };
                // Header 'history' tab -> setMode + onTabChange caption.
                bpPanel._onSelect(hitPx(330, 40));
                const tabSwap = bpPanel.mode === 'history'
                  && statusEl && /履歴|history/i.test(statusEl.textContent || '');
                // Scroll zones live only when rows exceed the 9-row window.
                const rowsNow = bpPanel._rows().length;
                bpPanel._onSelect(hitPx(740, 40));
                const dnOk = bpPanel.scrollOffset === 1;
                bpPanel._onSelect(hitPx(560, 40));
                out.bpPanelZones = tabSwap && rowsNow >= 10
                  && dnOk && bpPanel.scrollOffset === 0;
                // Row hit -> onSelect(url) -> the real navigate + hide.
                const activeTab = app.tabManager && app.tabManager.getActiveTab();
                const urlBefore = activeTab && activeTab.currentUrl;
                bpPanel._onSelect(hitPx(400, 96 + 36));
                out.bpRowNavigates = bpPanel.visible === false
                  && !!activeTab && activeTab.currentUrl !== urlBefore
                  && (activeTab.currentUrl || '').indexOf('bp-row-') >= 0
                  && (activeTab.currentUrl || '').indexOf('.example') >= 0;
                // Delete-zone hit in history mode -> removeHistory + clamp.
                bpPanel.show();
                bpPanel.setMode('history');
                const beforeDel = bpPanel._rows().length;
                bpPanel._onSelect(hitPx(990, 96 + 36));
                out.bpRowDeletes = bpPanel._rows().length === beforeDel - 1
                  && statusEl && statusEl.textContent !== ''
                  && bpPanel.visible === true;
                // Close corner -> hide + onClose caption.
                bpPanel._onSelect(hitPx(970, 40));
                out.bpCloseZone = bpPanel.visible === false
                  && !!statusEl && statusEl.textContent !== '';
                // Bookmarks-mode arms: _rows() switches to getBookmarks(),
                // the delete zone routes to removeBookmark + onDeleteBookmark
                // (not history's), scrollOffset never passes the last full
                // window, and a shrinking list clamps it back so the window
                // never shows a blank page. XR controllers also deliver the
                // intersection record ({intersection:{point}}) rather than a
                // bare Vector3 — the ?? arm accepts either form.
                const bmSeeded = [];
                for (let k = 0; k < 11; k++) {
                  const bu = 'https://bp-bm-' + k + '.example/';
                  app.bookmarks.addBookmark(bu, 'Bm ' + k);
                  bmSeeded.push(bu);
                }
                const delBmCalls = [];
                const origDelBmCb = bpPanel.onDeleteBookmark;
                bpPanel.onDeleteBookmark = (u) => {
                  delBmCalls.push(u);
                  if (origDelBmCb) { origDelBmCb(u); }
                };
                try {
                  bpPanel.show();
                  bpPanel.setMode('bookmarks');
                  bpPanel._onSelect({ intersection: { point: hitPx(330, 40) } });
                  out.bpIntersectionArm = bpPanel.mode === 'history';
                  bpPanel.setMode('bookmarks');
                  const bmCount = bpPanel._rows()
                    .filter((r) => (r.url || '').indexOf('bp-bm-') >= 0).length;
                  const cur3 = app.tabManager.getActiveTab()
                    && app.tabManager.getActiveTab().currentUrl;
                  bpPanel._onSelect(hitPx(400, 96 + 36));
                  const act3 = app.tabManager.getActiveTab();
                  out.bpBookmarkRows = bmCount === 11
                    && bpPanel.visible === false
                    && !!act3 && act3.currentUrl !== cur3
                    && (act3.currentUrl || '').indexOf('bp-bm-') >= 0;
                  bpPanel.show();
                  bpPanel.setMode('bookmarks');
                  const bmBefore = bpPanel._rows().length;
                  bpPanel._onSelect(hitPx(990, 96 + 36));
                  out.bpDeleteBookmarkArm = bpPanel._rows().length === bmBefore - 1
                    && delBmCalls.length === 1
                    && (delBmCalls[0] || '').indexOf('bp-bm-') >= 0;
                  bpPanel.setMode('history');
                  for (let k = 0; k < 6; k++) { bpPanel._onSelect(hitPx(740, 40)); }
                  out.bpScrollMaxClamp = bpPanel.scrollOffset
                    === Math.max(0, bpPanel._rows().length - 9);
                  for (let k = 0; k < 20
                    && bpPanel.scrollOffset > 0
                    && bpPanel._rows().length > 2; k++) {
                    bpPanel._onSelect(hitPx(990, 96 + 36));
                  }
                  out.bpClampOnDelete = bpPanel.scrollOffset === 0
                    && bpPanel._rows().length <= 9;
                } finally {
                  bpPanel.onDeleteBookmark = origDelBmCb;
                  bmSeeded.forEach((u2) => app.bookmarks.removeBookmark(u2));
                }
              } finally {
                bpPanel.setMode(modeWas);
                bpPanel.scrollOffset = scrollWas;
                if (visWas) { bpPanel.show(); } else { bpPanel.hide(); }
                rowsSeeded.forEach((u2) => app.bookmarks.removeHistory(u2));
              }
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
          // Batch 4 — voice-command round-trips. enableVoice is opt-in: flip
          // it and lazy-init here (the SpeechRecognition stub above lets
          // initialize() succeed), then feed synthetic FINAL results through
          // handleRecognitionResult — the real confidence gate, transcript
          // caption, and processCommand pattern→action→speak→caption chain
          // through the connectBrowser wiring VRApp bound.
          try {
          app.settings.enableVoice = true;
          if (!app.voiceCommands && typeof app._initVoiceCommands === 'function') {
            await app._initVoiceCommands();
          }
          const vc = app.voiceCommands;
          if (vc) {
            const say = (text) => vc.handleRecognitionResult({
              results: [{ 0: { transcript: text, confidence: 0.9 }, isFinal: true, length: 1 }]
            });
            say('検索：voice-search.example');
            // urlResolver stores bare-host input without a trailing slash —
            // the contract tab.currentUrl records.
            out.voiceSearchNav = tab2 && tab2.currentUrl === 'https://voice-search.example';
            out.voiceSearchCap = statusEl ? statusEl.textContent : '';
            say('トップサイト');
            out.voiceTopNav = tab2 && tab2.currentUrl === 'https://harness-top.example/';
            out.voiceTopCap = statusEl ? statusEl.textContent : '';
            say('履歴を消去');
            out.voiceCleared = app.bookmarks.search('harness-top.example', 5).length === 0;
            out.voiceClearCap = statusEl ? statusEl.textContent : '';
            const volBefore = (app.settings.masterVolume ?? 100);
            say('音量上げる');
            let sv = null;
            try { sv = JSON.parse(localStorage.getItem('qui-browser:settings')); } catch { /* noop */ }
            out.voiceVolUp = !!(sv && sv.masterVolume === Math.min(100, volBefore + 10));
            out.voiceVolCap = statusEl ? statusEl.textContent : '';
            // Voice nav — the live back()/forward() names (dead goBack/
            // goForward callers were repointed): 戻る must actually move and
            // 進む must return — each spoken confirmation lands on the status
            // region via the onSpeak→caption mirror.
            say('戻る');
            out.voiceBackUrl = tab2 ? tab2.currentUrl : null;
            out.voiceBackCap = statusEl ? statusEl.textContent : '';
            say('進む');
            out.voiceFwdUrl = tab2 ? tab2.currentUrl : null;
            out.voiceFwdCap = statusEl ? statusEl.textContent : '';
            say('ブックマーク');
            out.voiceBmCap = statusEl ? statusEl.textContent : '';
            say('日本語入力');
            out.voiceImeShown = app.vrKeyboard && app.vrKeyboard.visible === true;
            say('zzz認識不能');
            out.voiceNoMatch = vc.stats.commandsFailed > 0
              && !!(statusEl && statusEl.textContent.includes('認識'));
            // Batch 5 — the remaining registered commands.
            say('音量下げる');
            try { sv = JSON.parse(localStorage.getItem('qui-browser:settings')); } catch { /* noop */ }
            out.voiceVolDown = !!(sv && sv.masterVolume === 90)
              && (statusEl ? statusEl.textContent : '').includes('音量 90%');
            say('更新');
            out.voiceRefresh = tab2 && tab2.currentUrl === 'https://harness-top.example/'
              && (statusEl ? statusEl.textContent : '').includes('更新します');
            // go-to has two arms: a frecency hit (seeded bookmark) navigates
            // to the hit URL; a miss falls through to navigate(query), which
            // the resolver routes to the configured search engine. History was
            // wiped by '履歴を消去' above, so the bookmark seed makes the hit
            // arm deterministic.
            app.bookmarks.addBookmark('https://voicegoto.example', 'Goto Target');
            say('voicegotoを開く');
            out.voiceGoToUrl = tab2 ? tab2.currentUrl : null;
            out.voiceGoToCap = statusEl ? statusEl.textContent : '';
            say('nohitwordを開く');
            out.voiceGoToFbUrl = tab2 ? tab2.currentUrl : null;
            out.voiceGoToFbCap = statusEl ? statusEl.textContent : '';
            say('ヘルプ');
            out.voiceHelpCap = statusEl ? statusEl.textContent : '';
            say('キーボードを閉じる');
            out.voiceKbHidden = app.vrKeyboard && app.vrKeyboard.visible === false;
            out.voiceKbCap = statusEl ? statusEl.textContent : '';
            // Reader scroll — scrollContent only moves while the panel is in
            // 'reader' state; seed a long article so ±8 lines actually travel.
            if (tab2) {
              tab2._contentState = 'reader';
              tab2._readerLines = Array.from({ length: 200 }, () => ({ text: 'l', style: 'body' }));
              tab2._readerScroll = 0;
              tab2._readerScale = 1;
              tab2._drawContent = () => {};
            }
            say('下にスクロール');
            out.voiceScrollDn = tab2 ? tab2._readerScroll : null;
            say('上にスクロール');
            out.voiceScrollUp = tab2 ? tab2._readerScroll : null;
            // Session commands: 'VRモード' routes onEnterVR → vrButton.click
            // (the same guarded enter path the 2D shell uses — spy on click,
            // do NOT call through: the real handler would fire the rejecting
            // requestSession stub). 'VR終了' routes onExitVR →
            // renderer.xr.getSession().end() — stub getSession to count the
            // call; the fake session's own end is a no-op so nothing tears
            // down here.
            let enterClicks = 0;
            let endCalls2 = 0;
            const vrbClickWas = app.vrButton ? app.vrButton.click : null;
            const gsWas = app.renderer && app.renderer.xr
              ? app.renderer.xr.getSession : null;
            try {
              if (app.vrButton) {
                app.vrButton.click = () => { enterClicks++; };
              }
              say('VRモード');
              out.voiceVrEnter = enterClicks === 1
                && (statusEl ? statusEl.textContent : '')
                  .includes('VRモードを開始します');
              if (app.renderer && app.renderer.xr) {
                app.renderer.xr.getSession = () => ({
                  end: () => { endCalls2++; return Promise.resolve(); }
                });
              }
              say('VR終了');
              out.voiceVrExit = endCalls2 === 1
                && (statusEl ? statusEl.textContent : '')
                  .includes('VRモードを終了します');
            } finally {
              if (app.vrButton && vrbClickWas) {
                app.vrButton.click = vrbClickWas;
              }
              if (app.renderer && app.renderer.xr && gsWas) {
                app.renderer.xr.getSession = gsWas;
              }
            }
            // Voice internals — the gating arms under the patterns: the
            // confidence gate (0 < c < sensitivity drops, BUT a literal 0
            // means "no score" and must pass — the Quest/Android arm the
            // code comments warn about), interim results are ignored, the
            // wake-word gate holds commands until awake, speak() forwards
            // volume/pitch with ?? (0 honored, || would drop it), and the
            // stats/callback surface (commandsExecuted, averageConfidence,
            // onCommand/onCommandFailed) is observable.
            const say2 = (text, conf, interim) => vc.handleRecognitionResult({
              results: [{
                0: { transcript: text, confidence: conf },
                isFinal: !interim, length: 1
              }]
            });
            // 'ヘルプ' is the counting pin's probe: a matched command that
            // mutates no browsing state (unlike 戻る/進む, which moved the
            // tab history under an earlier draft and killed the sibling
            // 'no forward history' pin).
            const recWas = vc.stats.commandsRecognized;
            say2('ヘルプ', 0.05, false);
            out.voiceConfGate = vc.stats.commandsRecognized === recWas;
            say2('ヘルプ', 0, false);
            out.voiceConfZero = vc.stats.commandsRecognized === recWas + 1;
            say2('ヘルプ', 0.9, true);
            out.voiceInterim = vc.stats.commandsRecognized === recWas + 1;
            // Wake-word gate: while armed every transcript is consumed by
            // the gate until the wake word lands (→ isAwake + a spoken
            // acknowledgment mirrored to the status region).
            const wakeWas = vc.settings.requireWakeWord;
            const wakeWordWas = vc.settings.wakeWord;
            try {
              vc.settings.requireWakeWord = true;
              vc.settings.wakeWord = 'コンピュータ';
              vc.isAwake = false;
              const recW0 = vc.stats.commandsRecognized;
              say2('ヘルプ', 0.9, false);
              const dropped = vc.stats.commandsRecognized === recW0;
              say2('コンピュータ', 0.9, false);
              say2('ヘルプ', 0.9, false);
              out.voiceWakeGate = dropped === true
                && vc.isAwake === true
                && vc.stats.commandsRecognized === recW0 + 1;
            } finally {
              vc.settings.requireWakeWord = wakeWas;
              vc.settings.wakeWord = wakeWordWas;
              vc.isAwake = true;
            }
            // speak() — utterance params: ?? honors 0 (mute/lowest pitch),
            // || still swaps a bogus rate for 1.0.
            const utts = [];
            const synthWas = vc.synthesis;
            try {
              vc.synthesis = { speak: (u) => { utts.push(u); } };
              vc.speak('テスト', { volume: 0, pitch: 0, rate: 2 });
              out.voiceSpeakParams = utts.length === 1
                && utts[0].volume === 0
                && utts[0].pitch === 0
                && utts[0].rate === 2
                && typeof utts[0].lang === 'string';
            } finally {
              vc.synthesis = synthWas;
            }
            // Stats + callback surface: a matched command bumps
            // commandsExecuted and folds confidence into the average, and
            // records lastCommand; a miss routes onCommandFailed(no_match).
            const execWas = vc.stats.commandsExecuted;
            const recWas3 = vc.stats.commandsRecognized;
            const avgWas = vc.stats.averageConfidence;
            const cmdWas = vc.callbacks.onCommand;
            const failWas = vc.callbacks.onCommandFailed;
            const cmdSeen = [];
            const failSeen = [];
            try {
              vc.callbacks.onCommand = (k, r) => { cmdSeen.push(k); };
              vc.callbacks.onCommandFailed = (e) => { failSeen.push(e.reason); };
              say('ヘルプ');
              const avgExpected =
                (avgWas * recWas3 + 0.9) / (recWas3 + 1);
              out.voiceExecStats = vc.stats.commandsExecuted === execWas + 1
                && Math.abs(vc.stats.averageConfidence - avgExpected) < 1e-9
                && vc.lastCommand && vc.lastCommand.key === 'help'
                && cmdSeen.includes('help');
              say('zzz未登録2');
              out.voiceFailedCb = failSeen.includes('no_match');
            } finally {
              vc.callbacks.onCommand = cmdWas;
              vc.callbacks.onCommandFailed = failWas;
            }
            say('停止');
            out.voiceStopped = vc.isListening === false;
            out.voiceStopCap = statusEl ? statusEl.textContent : '';
          }
          // VoiceCommands lifecycle — a fresh instance: the app's own one is
          // still enabled after '停止' (its continuous onend restart refires
          // isListening ~100ms later), so lifecycle arms must not touch it.
          if (app.voiceCommands) {
            const VC = app.voiceCommands.constructor;
            const vc2 = new VC();
            // Seed a deterministic engine: headless exposes a real
            // webkitSpeechRecognition whose start() never fires onstart, and
            // the page stub only installs when both globals are absent — so
            // lifecycle arms own their engine instead of initialize()'s.
            vc2.recognition = {
              start() { if (this.onstart) this.onstart(); },
              stop() { if (this.onend) this.onend(); },
              abort() {}
            };
            vc2.setupRecognitionHandlers();
            vc2.isEnabled = true;
            const starts2 = [];
            const ends2 = [];
            vc2.callbacks.onStart = () => starts2.push(1);
            vc2.callbacks.onEnd = () => ends2.push(1);
            // start(): enabled gate passes, recognition.start fires onstart
            // which flips isListening + onStart; a second start() while
            // already listening is an early true without a double onstart.
            const startRet = vc2.start();
            const alreadyRet = vc2.start();
            out.voiceLifecycle = startRet === true
              && alreadyRet === true
              && vc2.isListening === true
              && starts2.length === 1;
            // onend while continuous+enabled schedules a restart (100ms) —
            // the hands-free keep-alive loop. Disabling first makes the same
            // onend a dead end (fatal-error / dispose ordering relies on it).
            vc2.recognition.onend();
            const restarted = await new Promise((r) => {
              setTimeout(() => r(vc2.isListening === true
                && starts2.length === 2), 200);
            });
            vc2.isEnabled = false;
            vc2.recognition.onend();
            const staysStopped = await new Promise((r) => {
              setTimeout(() => r(vc2.isListening === false
                && starts2.length === 2), 200);
            });
            out.voiceRestart = restarted === true && staysStopped === true
              && ends2.length === 2;
            // dispose(): isEnabled=false lands BEFORE stop() so the pending
            // onend can never reschedule, synthesis is cancelled, and both
            // engine refs are nulled. (A post-dispose start() returns false
            // via the enabled gate but also console.errors — unverifiable
            // under the 'no console errors' check, same class as the
            // loadAudio !response.ok arm.)
            const vc3 = new VC();
            vc3.recognition = {
              start() { if (this.onstart) this.onstart(); },
              stop() { if (this.onend) this.onend(); },
              abort() {}
            };
            vc3.setupRecognitionHandlers();
            vc3.isEnabled = true;
            vc3.synthesis = window.speechSynthesis || null;
            vc3.start();
            const cancelSeen = [];
            const synth3 = vc3.synthesis;
            const cancelWas = synth3 && synth3.cancel;
            if (synth3) { synth3.cancel = () => { cancelSeen.push(1); }; }
            vc3.dispose();
            if (synth3) { synth3.cancel = cancelWas; }
            out.voiceDispose = vc3.isEnabled === false
              && vc3.isListening === false
              && vc3.recognition === null
              && vc3.synthesis === null
              && cancelSeen.length === (synth3 ? 1 : 0);
          }
          // BookmarkStore internals — the dedupe/title/aggregate arms the
          // panel legs never reach: revisits bump visits and move to front,
          // the title refreshes only on a real title, removeHistory filters
          // a corrupted duplicate, getTopSites folds www + aggregates hosts
          // + honours exclude, and the 200-entry bound trims on write. Real
          // localStorage, snapshotted and restored in finally.
          const histKey2 = 'quiBrowser_history';
          const histWas = localStorage.getItem(histKey2);
          try {
            const bm = app.bookmarks;
            localStorage.setItem(histKey2, '[]');
            bm.addHistory('https://bm-a.example/', 'A');
            bm.addHistory('https://bm-b.example/', 'B');
            bm.addHistory('https://bm-a.example/');
            const h1 = bm.getHistory(10);
            out.bmDedupeVisits = h1.length === 2
              && h1[0].url === 'https://bm-a.example/'
              && h1[0].visits === 2;
            // A bare-URL revisit (title defaults to url) must not clobber
            // the recorded title; a real title still updates.
            localStorage.setItem(histKey2, '[]');
            bm.addHistory('https://bm-t.example/', 'Real Title');
            bm.addHistory('https://bm-t.example/');
            const t1 = bm.getHistory(1)[0];
            bm.addHistory('https://bm-t.example/', 'Better Title');
            const t2 = bm.getHistory(1)[0];
            out.bmTitleGuard = t1.title === 'Real Title'
              && t1.visits === 2 && t2.title === 'Better Title';
            // removeHistory filters rather than splices-one: a corrupted
            // store holding the same URL twice loses both; absent → false.
            localStorage.setItem(histKey2, JSON.stringify([
              { url: 'https://bm-d.example/', title: 'd', visits: 1, visitedAt: 1 },
              { url: 'https://bm-d.example/', title: 'd2', visits: 1, visitedAt: 2 },
              { url: 'https://bm-k.example/', title: 'k', visits: 1, visitedAt: 3 }
            ]));
            const remOk = bm.removeHistory('https://bm-d.example/');
            const remMiss = bm.removeHistory('https://bm-absent.example/');
            const h2 = bm.getHistory(10);
            out.bmRemoveFilter = remOk === true && remMiss === false
              && h2.length === 1 && h2[0].url === 'https://bm-k.example/';
            // getTopSites: host-aggregate frecency (visits + scores sum,
            // best page as representative), www-fold, exclude drops a host.
            localStorage.setItem(histKey2, JSON.stringify([
              { url: 'https://www.bm-h.example/p1', title: 'p1', visits: 3, visitedAt: Date.now() },
              { url: 'https://bm-h.example/p2', title: 'p2', visits: 2, visitedAt: Date.now() },
              { url: 'https://bm-x.example/', title: 'x', visits: 1, visitedAt: Date.now() },
              { url: 'https://duckduckgo.com/', title: 'ddg', visits: 9, visitedAt: Date.now() }
            ]));
            const ts2 = bm.getTopSites(8, Date.now(), ['duckduckgo.com']);
            const h3 = ts2.find((s) => s.host === 'bm-h.example');
            out.bmTopSites = ts2.length === 2
              && !!h3 && h3.visits === 5
              && h3.url === 'https://www.bm-h.example/p1'
              && ts2.every((s) => s.host !== 'duckduckgo.com');
            // The 200-entry bound trims on write — seed past the cap and
            // one addHistory must shed the overflow.
            const over = [];
            for (let oi = 0; oi < 205; oi++) {
              over.push({ url: 'https://bm-o.example/' + oi,
                title: 'o' + oi, visits: 1, visitedAt: oi });
            }
            localStorage.setItem(histKey2, JSON.stringify(over));
            bm.addHistory('https://bm-new.example/', 'new');
            const h4 = bm.getHistory(500);
            out.bmTrim = h4.length === 200
              && h4[0].url === 'https://bm-new.example/';
          } finally {
            if (histWas === null) {
              localStorage.removeItem(histKey2);
            } else {
              localStorage.setItem(histKey2, histWas);
            }
          }
          } catch (e) {
            out.b4Error = String(e && e.stack ? e.stack : e).split('\\n').slice(0, 3).join(' | ');
          }
        }
        // Post-enter leg — everything after a *granted* requestSession has
        // never run on the real app (the stub always rejects). onVRSessionStart
        // wires the session's visibility/framerate/refspace-reset listeners,
        // re-bases the frame budget on the real refresh rate, re-initializes
        // hand tracking, and announces 'VR Ready'; onVRSessionEnd must hand
        // every piece back — ghost-hands dispose, fps restore, layers dispose.
        // A fake session object drives the wiring; the runtime feature gaps
        // (no XRWebGLBinding) exercise the graceful-degradation arms.
        if (app.renderer && app.renderer.xr) {
          const sesListeners = new Map();
          const fakeSession = {
            inputSources: [],
            visibilityState: 'visible',
            renderState: {},
            refreshRate: 90,
            supportedFrameRates: [90, 120],
            updateTargetFrameRate: async () => {},
            addEventListener: (type, fn) => {
              const a = sesListeners.get(type) || [];
              a.push(fn);
              sesListeners.set(type, a);
            },
            removeEventListener: () => {},
            fire: (type, extra) => (sesListeners.get(type) || [])
              .forEach((fn) => fn({ type, ...(extra || {}) })),
            end: async () => {}
          };
          const rsListeners = new Map();
          const fakeRefSpace = {
            addEventListener: (type, fn) => {
              const a = rsListeners.get(type) || [];
              a.push(fn);
              rsListeners.set(type, a);
            },
            fire: (type) => (rsListeners.get(type) || []).forEach((fn) => fn({ type }))
          };
          const xr = app.renderer.xr;
          const origGetSession = typeof xr.getSession === 'function'
            ? xr.getSession.bind(xr) : null;
          const origGetRef = typeof xr.getReferenceSpace === 'function'
            ? xr.getReferenceSpace.bind(xr) : null;
          xr.getSession = () => fakeSession;
          xr.getReferenceSpace = () => fakeRefSpace;
          const tfpsBefore = app.settings.targetFPS;
          const capWrites = [];
          const sd = app.semanticDOM;
          const origAnnounceCap = sd && typeof sd.announceCaption === 'function'
            ? sd.announceCaption.bind(sd) : null;
          if (origAnnounceCap) {
            sd.announceCaption = (text) => {
              capWrites.push(text);
              return origAnnounceCap(text);
            };
          }
          let recenterCalls = 0;
          const origRecenter = typeof app.recenter === 'function'
            ? app.recenter.bind(app) : null;
          if (origRecenter) {
            app.recenter = () => {
              recenterCalls++;
              return origRecenter();
            };
          }
          const iv = app.immersiveVideo;
          let pauseCalls = 0;
          let stopCalls = 0;
          const origToggle = iv && typeof iv.togglePause === 'function'
            ? iv.togglePause.bind(iv) : null;
          const origStop = iv && typeof iv.stop === 'function'
            ? iv.stop.bind(iv) : null;
          if (iv && origToggle && origStop) {
            iv.togglePause = () => {
              pauseCalls++;
              iv.playing = !iv.playing;
            };
            iv.stop = () => {
              stopCalls++;
              return origStop();
            };
          }
          try {
            try {
            // Drive the REAL event bridge (renderer.xr 'sessionstart' →
            // onVRSessionStart), not the method — a cut listener fails the
            // start checks the same way a cut method would.
            app.renderer.xr.dispatchEvent({ type: 'sessionstart' });
            // onVRSessionStart is async; syncBudget also runs inside
            // updateTargetFrameRate().then — give microtasks a beat.
            await new Promise((r) => setTimeout(r, 60));
            out.sessStart = app.isVREnabled === true;
            // Toasts also flow through captionSystem.show (notifyCrossModal),
            // so a toast re-firing during start can overwrite the status
            // region — pin the write *sequence*, not the final text.
            out.sessReadyCap = capWrites.includes('VR Ready');
            out.sessFps = app.settings.targetFPS;
            out.sessHand = !!(app.handTracking && app.handTracking.enabled === true);
            out.sessFfrOff = !!(app.ffrSystem && app.ffrSystem.enabled === false);
            // Hand groups must start hidden — born-visible groups read as a
            // phantom tracked→lost transition on the first frame. Then an
            // input-source removal mid-session must announce the loss
            // (debounced 600 ms), and a repeat removal while already hidden
            // must not re-announce.
            out.handBornHidden = !!(app.handTracking && app.handTracking.leftHand
              && app.handTracking.rightHand
              && !app.handTracking.leftHand.visible
              && !app.handTracking.rightHand.visible);
            if (app.handTracking && app.handTracking.leftHand) {
              app.handTracking.leftHand.visible = true; // simulate "was tracked"
              fakeSession.fire('inputsourceschange', {
                added: [],
                removed: [{ handedness: 'left' }]
              });
              out.handHiddenOnRemove = app.handTracking.leftHand.visible === false;
              await new Promise((r) => setTimeout(r, 700)); // 600 ms debounce
              const lostCount = () => capWrites
                .filter((t) => t.includes('Left hand lost')).length;
              out.handLostCap = lostCount() >= 1;
              fakeSession.fire('inputsourceschange', {
                added: [],
                removed: [{ handedness: 'left' }]
              });
              await new Promise((r) => setTimeout(r, 700));
              out.handLostOnce = lostCount() === 1;
            }
            // Headset blur while video plays must pause it (DOM
            // visibilitychange does not fire during immersive presentation).
            if (iv) {
              iv.playing = true;
            }
            fakeSession.visibilityState = 'visible-blurred';
            fakeSession.fire('visibilitychange');
            out.sessVisPaused = iv ? (pauseCalls >= 1 && iv.playing === false) : null;
            fakeSession.visibilityState = 'visible';
            fakeSession.fire('visibilitychange');
            out.sessVisNoDouble = pauseCalls === 1;
            // OS-level recenter arrives as 'reset' on the reference space.
            fakeRefSpace.fire('reset');
            out.sessReset = recenterCalls >= 1;
            // A runtime-driven rate change re-syncs the budget, not resets it.
            fakeSession.fire('frameratechange');
            await new Promise((r) => setTimeout(r, 30));
            out.sessFpsKept = app.settings.targetFPS === 90;
            // Sustained overload: the budget-miss ladder must try viewport
            // scaling FIRST (same Hz, fewer pixels — Meta's ordering) and only
            // step the session rate once the scale ladder is exhausted. A user
            // rate pin (_fpsOverridden) suppresses the whole ladder.
            const scaleCalls = [];
            const rateCalls = [];
            const fakeView = {
              requestViewportScale: (s) => {
                scaleCalls.push(s);
              }
            };
            const fakeXrFrame = {
              session: fakeSession,
              getViewerPose: () => ({ views: [fakeView] })
            };
            fakeSession.updateTargetFrameRate = (r) => {
              rateCalls.push(r);
              fakeSession.refreshRate = r;
              return Promise.resolve();
            };
            // A healthy frame resets the miss counter, so the ladder only
            // sees misses when frameTime actually exceeds the budget.
            app.performanceMonitor.frameTime = 999;
            app._overBudgetFrames = 241;
            app.updateSystems(0, fakeXrFrame, 0.016);
            out.sessScaleFirst = scaleCalls.length === 1
              && scaleCalls[0] === 0.85 && rateCalls.length === 0;
            app._overBudgetFrames = 241;
            app.updateSystems(0, fakeXrFrame, 0.016);
            out.sessScaleSecond = scaleCalls.length === 2
              && scaleCalls[1] === 0.7 && rateCalls.length === 0;
            app._overBudgetFrames = 241;
            app.updateSystems(0, fakeXrFrame, 0.016);
            await new Promise((r) => setTimeout(r, 30));
            out.sessRateDrop = rateCalls.length === 1 && rateCalls[0] === 90
              && app.settings.targetFPS === 90;
            app.settings._fpsOverridden = true;
            app._overBudgetFrames = 300;
            app.updateSystems(0, fakeXrFrame, 0.016);
            out.sessOverrideSkips = rateCalls.length === 1
              && scaleCalls.length === 2;
            app.settings._fpsOverridden = false;
            app.performanceMonitor.frameTime = 0;
            // Controller event bridges — the real THREE controllers accept
            // dispatched events, so the app-level wiring runs headless:
            // mid-session disconnect toasts + forgets the input source, a
            // reconnect announces (the WCAG 4.1.3 loop-closer), and a
            // disconnect mid-squeeze cancels the aim instead of completing
            // a teleport to a stale target.
            const ctrl = app.controllers && app.controllers[0];
            if (ctrl) {
              const capsBefore = capWrites.length;
              ctrl.dispatchEvent({ type: 'connected', data: { handedness: 'right' } });
              // Initial connect is normal — no announce. (wasDisconnected
              // only fires after inputSource was nulled by a disconnect.)
              out.ctrlFirstQuiet = !capWrites.slice(capsBefore)
                .some((t) => t.includes('reconnected'));
              ctrl.dispatchEvent({ type: 'squeezestart' });
              const aimStarted = app.teleport && app.teleport.active === true;
              ctrl.dispatchEvent({ type: 'disconnected' });
              out.ctrlDiscCap = capWrites.some((t) => t.includes('Right controller disconnected'));
              out.squeezeCancelled = aimStarted
                && app.teleport.active === false
                && app.teleport.controller === null;
              ctrl.dispatchEvent({ type: 'connected', data: { handedness: 'right' } });
              out.ctrlReconnCap = capWrites.some((t) => t.includes('Right controller reconnected'));
            }
            // Select/hover/teleport arms: a controller ray hitting a
            // registered interactable runs onSelect + haptic click + the
            // qui-select DOM event; a ray missing fires none. Squeeze aimed
            // at the floor marks the teleport target per-frame and release
            // lands the rig there with the 'Teleported' caption.
            if (ctrl && app.floorMesh && app.interactables && app.hapticFeedback) {
              const selObj = app.floorMesh.clone();
              selObj.userData = {};
              let selFires = 0;
              let quiFires = 0;
              let hoverEnters = 0;
              let hoverExits = 0;
              selObj.userData.interactable = {
                onSelect: () => { selFires += 1; },
                onHover: () => { hoverEnters += 1; },
                onHoverEnd: () => { hoverExits += 1; }
              };
              selObj.addEventListener('qui-select', () => { quiFires += 1; });
              app.interactables.push(selObj);
              // Stand the cloned plane up facing the controller, ~0.4 m away.
              // floorMesh's CircleGeometry(30) cloned at 0.05 spans a 1.5 m
              // radius — down to y ≈ -0.1 — so the second (unused) controller
              // parked at the origin also hits it and fires onHover a second
              // time. At 0.01 it is a 0.3 m disc centred on the driven ray:
              // unreachable by the y=0 ray regardless of matrix staleness.
              selObj.rotation.set(0, 0, 0);
              selObj.scale.set(0.01, 0.01, 0.01);
              selObj.position.set(0, 1.4, -0.4);
              selObj.updateMatrixWorld(true);
              let selObj2 = null;
              const hapticPats = [];
              const origPlay = app.hapticFeedback.playPattern;
              app.hapticFeedback.playPattern = (h, p) => { hapticPats.push(p); };
              // XR controller objects are runtime-driven: matrixAutoUpdate is
              // false, so position/rotation writes never reach the ray —
              // matrixWorld is written directly instead.
              const origMW = ctrl.matrixWorld.clone();
              try {
                ctrl.matrixWorld.identity();
                ctrl.matrixWorld.setPosition(0, 1.4, 0);
                app.updateSystems(0, fakeXrFrame, 0.016); // hover pass
                out.hoverEnter = hoverEnters === 1
                  && ctrl.userData.hovered === selObj;
                ctrl.dispatchEvent({ type: 'selectstart' });
                out.selectHit = selFires === 1 && quiFires === 1
                  && hapticPats.includes('click');
                // Aim behind the user — hover ends, select hits nothing.
                ctrl.matrixWorld.makeRotationY(Math.PI);
                ctrl.matrixWorld.setPosition(0, 1.4, 0);
                app.updateSystems(0, fakeXrFrame, 0.016);
                out.hoverExit = hoverExits === 1 && !ctrl.userData.hovered;
                ctrl.dispatchEvent({ type: 'selectstart' });
                out.selectMissQuiet = selFires === 1 && quiFires === 1;
                // Hit priority: the nearest VISIBLE interactable on the ray
                // wins — a second disc parked between the controller and
                // selObj must claim the select, and hiding it must hand the
                // hit to the visible one behind (isWorldVisible skips a
                // shadowed panel's mesh, which THREE's raycast still hits).
                selObj2 = app.floorMesh.clone();
                selObj2.userData = {};
                let sel2Fires = 0;
                let hov2 = 0;
                selObj2.userData.interactable = {
                  onSelect: () => { sel2Fires += 1; },
                  onHover: () => { hov2 += 1; }
                };
                selObj2.rotation.set(0, 0, 0);
                selObj2.scale.set(0.01, 0.01, 0.01);
                selObj2.position.set(0, 1.4, -0.2);
                selObj2.updateMatrixWorld(true);
                app.interactables.push(selObj2);
                ctrl.matrixWorld.identity();
                ctrl.matrixWorld.setPosition(0, 1.4, 0);
                app.updateSystems(0, fakeXrFrame, 0.016);
                ctrl.dispatchEvent({ type: 'selectstart' });
                out.hitNearest = sel2Fires === 1 && selFires === 1;
                // Same-hover dedup: re-running the hover pass over an
                // unchanged nearest object must NOT refire onHover — the
                // prev === obj guard is what stops per-frame hover spam.
                app.updateSystems(0, fakeXrFrame, 0.016);
                app.updateSystems(0, fakeXrFrame, 0.016);
                out.hoverStableNoRefire = hov2 === 1;
                selObj2.visible = false;
                ctrl.dispatchEvent({ type: 'selectstart' });
                out.hitSkipsHidden = selFires === 2 && sel2Fires === 1;
                // Teleport: squeeze aims the ray at the floor (the per-frame
                // updateTeleport raycast marks target + marker), release
                // moves the rig and captions the landing.
                ctrl.matrixWorld.makeRotationX(-Math.PI / 3);
                ctrl.matrixWorld.setPosition(0, 1.4, 0);
                const rigX0 = app.playerRig.position.x;
                const rigZ0 = app.playerRig.position.z;
                ctrl.dispatchEvent({ type: 'squeezestart' });
                app.updateSystems(0, fakeXrFrame, 0.016);
                out.aimLands = app.teleport.active === true
                  && app.teleport.valid === true
                  && !!app.teleport.target
                  && !!(app.teleport.marker && app.teleport.marker.visible === true);
                ctrl.dispatchEvent({ type: 'squeezeend' });
                out.teleportLands = out.aimLands === true
                  && Math.abs(app.playerRig.position.x - rigX0)
                    + Math.abs(app.playerRig.position.z - rigZ0) > 0.01
                  && capWrites.some((t) => t.includes('Teleported'));
                // fireTeleportFeedback: the landing also pulses 'impact' on
                // the landing hand — the haptic arm the caption conjunct
                // never saw (hapticPats already spies playPattern).
                out.teleportHaptic = hapticPats.includes('impact');
                // Invalid aim: a ray that misses the floor leaves
                // teleport.valid=false + marker hidden, so squeezeend resets
                // aim WITHOUT moving the rig — no 'Teleported', no 'impact'.
                const patsTp0 = hapticPats.length;
                const capsTp0 = capWrites.length;
                const rigMx0 = app.playerRig.position.x;
                const rigMz0 = app.playerRig.position.z;
                ctrl.matrixWorld.makeRotationX(Math.PI / 3);
                ctrl.matrixWorld.setPosition(0, 1.4, 0);
                ctrl.dispatchEvent({ type: 'squeezestart' });
                app.updateSystems(0, fakeXrFrame, 0.016);
                const missOk = app.teleport.active === true
                  && app.teleport.valid === false
                  && !(app.teleport.marker && app.teleport.marker.visible === true);
                ctrl.dispatchEvent({ type: 'squeezeend' });
                out.teleportMiss = missOk
                  && Math.abs(app.playerRig.position.x - rigMx0) < 1e-9
                  && Math.abs(app.playerRig.position.z - rigMz0) < 1e-9
                  && !capWrites.slice(capsTp0).some((t) => t.includes('Teleported'))
                  && !hapticPats.slice(patsTp0).includes('impact');
                // A 'disconnected' event mid-aim runs
                // _cancelTeleportIfAimedBy: the aim is reset WITHOUT a move —
                // a headset-removal disconnect must never complete a
                // teleport the user never released intentionally.
                const rigDx0 = app.playerRig.position.x;
                const rigDz0 = app.playerRig.position.z;
                ctrl.matrixWorld.makeRotationX(-Math.PI / 3);
                ctrl.matrixWorld.setPosition(0, 1.4, 0);
                ctrl.dispatchEvent({ type: 'squeezestart' });
                app.updateSystems(0, fakeXrFrame, 0.016);
                const aimDisc = app.teleport.active === true
                  && app.teleport.valid === true;
                ctrl.dispatchEvent({ type: 'disconnected' });
                out.teleportCancelDisc = aimDisc
                  && app.teleport.active === false
                  && app.teleport.valid === false
                  && !(app.teleport.marker && app.teleport.marker.visible === true)
                  && Math.abs(app.playerRig.position.x - rigDx0) < 1e-9
                  && Math.abs(app.playerRig.position.z - rigDz0) < 1e-9;
                // Sibling disconnect does NOT cancel: only the controller
                // currently aiming gets its aim torn down.
                const other = app.controllers && app.controllers[1];
                ctrl.dispatchEvent({ type: 'connected', data: { handedness: 'right' } });
                ctrl.matrixWorld.makeRotationX(-Math.PI / 3);
                ctrl.matrixWorld.setPosition(0, 1.4, 0);
                ctrl.dispatchEvent({ type: 'squeezestart' });
                app.updateSystems(0, fakeXrFrame, 0.016);
                const aimSib = app.teleport.active === true
                  && app.teleport.valid === true;
                if (other) {
                  other.dispatchEvent({ type: 'disconnected' });
                }
                out.teleportSurvivesDisc = !!other && aimSib
                  && app.teleport.active === true
                  && app.teleport.valid === true
                  && !!(app.teleport.marker && app.teleport.marker.visible === true);
                ctrl.dispatchEvent({ type: 'squeezeend' });
                if (other) {
                  other.dispatchEvent({ type: 'connected', data: { handedness: 'left' } });
                }
              } finally {
                for (const o of [selObj, selObj2]) {
                  if (!o) continue;
                  const ix = app.interactables.indexOf(o);
                  if (ix >= 0) {
                    app.interactables.splice(ix, 1);
                  }
                }
                app.hapticFeedback.playPattern = origPlay;
                ctrl.matrixWorld.copy(origMW);
              }
            }
            // Render-loop fan-out: updateSystems must invoke every live
            // subsystem's per-frame hook exactly once — a dropped line here
            // kills the feature silently (captions never age, video never
            // recenters, listener never follows the head).
            {
              const fan = {
                comfort: 0, ffrHead: 0, hand: 0, haptic: 0, audio: 0,
                video: 0, loco: 0, buttons: 0, gaze: 0, captions: 0, win: 0
              };
              const fanSpies = [];
              const fanSpy = (obj, key, bucket) => {
                if (!obj || typeof obj[key] !== 'function') {
                  return;
                }
                const orig = obj[key];
                obj[key] = (...a) => { fan[bucket] += 1; return orig.apply(obj, a); };
                fanSpies.push([obj, key, orig]);
              };
              try {
                fanSpy(app.comfortSystem, 'update', 'comfort');
                fanSpy(app.ffrSystem, 'trackHeadPose', 'ffrHead');
                fanSpy(app.handTracking, 'update', 'hand');
                fanSpy(app.hapticFeedback, 'update', 'haptic');
                fanSpy(app.spatialAudio, 'updateListenerFromCamera', 'audio');
                fanSpy(app.immersiveVideo, 'update', 'video');
                fanSpy(app, 'updateLocomotion', 'loco');
                fanSpy(app, 'updateButtonInput', 'buttons');
                fanSpy(app.gazeInteraction, 'update', 'gaze');
                fanSpy(app.captionSystem, 'update', 'captions');
                fanSpy(app.windowManager, 'update', 'win');
                const winHadFollow = !!(app.windowManager
                  && app.windowManager.followMode);
                if (app.windowManager) {
                  app.windowManager.followMode = true;
                }
                app.updateSystems(0, fakeXrFrame, 0.016);
                out.fanCore = fan.comfort === 1 && fan.ffrHead === 1
                  && fan.hand === 1 && fan.haptic === 1
                  && fan.audio === 1 && fan.video === 1;
                out.fanUI = fan.loco === 1 && fan.buttons === 1;
                out.fanA11y = (app.gazeInteraction && app.gazeInteraction.enabled
                  ? fan.gaze === 1 : true) && fan.captions === 1;
                out.fanWin = fan.win === 1;
                // A null xrFrame must skip hand tracking but keep the rest.
                app.updateSystems(0, null, 0.016);
                out.fanNullFrame = fan.hand === 1 && fan.video === 2;
                if (app.windowManager) {
                  app.windowManager.followMode = winHadFollow;
                }
              } finally {
                for (const [o, k, fn] of fanSpies) {
                  o[k] = fn;
                }
              }
            }
            // Gaze-dwell (FR-13.1): a dwell completing on an interactable
            // must fire its onSelect once ({gaze:true}) and fan out to
            // haptic + spatial click through the updateSystems branch.
            if (app.gazeInteraction && app.floorMesh && app.camera) {
              const gzObj = app.floorMesh.clone();
              gzObj.userData = {};
              let gazeFires = 0;
              let gazeFlag = false;
              gzObj.userData.interactable = {
                onSelect: (a) => { gazeFires += 1; gazeFlag = !!(a && a.gaze); }
              };
              gzObj.rotation.set(0, 0, 0);
              gzObj.scale.set(0.05, 0.05, 0.05);
              // Well inside every real UI plane (~1.4 m+) on the gaze ray —
              // stale vs fresh matrixWorld states move real meshes around, so
              // the synthetic target must always be the nearest visible hit.
              app.camera.updateWorldMatrix(true, false);
              const camPos = app.camera.getWorldPosition(gzObj.position.clone());
              const camDir = app.camera.getWorldDirection(camPos.clone());
              gzObj.position.copy(camPos).add(camDir.multiplyScalar(0.8));
              gzObj.updateMatrixWorld(true);
              app.interactables.push(gzObj);
              const gzHaptic = [];
              const gzAudio = [];
              const origHP = app.hapticFeedback && app.hapticFeedback.playPattern;
              const origHB = app.hapticFeedback && app.hapticFeedback.playPatternBothHands;
              const origSP = app.spatialAudio && app.spatialAudio.play;
              if (origHP) {
                app.hapticFeedback.playPattern = (h, p) => { gzHaptic.push(p); };
              }
              if (origHB) {
                app.hapticFeedback.playPatternBothHands = (p) => { gzHaptic.push('both:' + p); };
              }
              if (origSP) {
                app.spatialAudio.play = (a, b, c) => { gzAudio.push(a); };
              }
              const gazeWasEnabled = app.gazeInteraction.enabled;
              app.gazeInteraction.enabled = true;
              try {
                // One frame at dwellTime × ~1.1 completes the dwell.
                app.updateSystems(0, fakeXrFrame, 1.7);
                out.gazeSelect = gazeFires === 1 && gazeFlag === true;
                out.gazeCross = gzHaptic.length >= 1 && gzAudio.length >= 1;
                // The _fired guard: a second dwell frame must not re-fire.
                app.updateSystems(0, fakeXrFrame, 1.7);
                out.gazeOnce = gazeFires === 1;
                // Disabled gaze must leave the interactable untouched.
                app.gazeInteraction.enabled = false;
                app.updateSystems(0, fakeXrFrame, 1.7);
                out.gazeDisabledQuiet = gazeFires === 1;
              } finally {
                app.gazeInteraction.enabled = gazeWasEnabled;
                const ix = app.interactables.indexOf(gzObj);
                if (ix >= 0) {
                  app.interactables.splice(ix, 1);
                }
                if (origHP) {
                  app.hapticFeedback.playPattern = origHP;
                }
                if (origHB) {
                  app.hapticFeedback.playPatternBothHands = origHB;
                }
                if (origSP) {
                  app.spatialAudio.play = origSP;
                }
              }
            }
            // Grace-slip pin (R220): a brief slip onto a DIFFERENT
            // interactable must hold the charge — tremor jitter grazing a
            // neighbour button must not reset the dwell. A persistent new
            // target wins only by outlasting graceTime; a return to the
            // held target resumes the charge.
            if (app.gazeInteraction && app.floorMesh && app.camera) {
              const gz = app.gazeInteraction;
              const gA = app.floorMesh.clone();
              const gB = app.floorMesh.clone();
              gA.userData = {};
              gB.userData = {};
              let aFires = 0;
              let bFires = 0;
              gA.userData.interactable = { onSelect: () => { aFires += 1; } };
              gB.userData.interactable = { onSelect: () => { bFires += 1; } };
              gA.rotation.set(0, 0, 0);
              gA.scale.set(0.05, 0.05, 0.05);
              gB.rotation.set(0, 0, 0);
              gB.scale.set(0.05, 0.05, 0.05);
              // See the gaze-dwell leg above: stay inside every real UI
              // plane so the synthetic target is always the nearest hit.
              app.camera.updateWorldMatrix(true, false);
              const rayPos = app.camera.getWorldPosition(gA.position.clone())
                .add(app.camera.getWorldDirection(gA.position.clone()).multiplyScalar(0.8));
              const offPos = rayPos.clone();
              offPos.x += 4;
              const placeA = () => {
                gA.position.copy(rayPos);
                gB.position.copy(offPos);
                gA.updateMatrixWorld(true);
                gB.updateMatrixWorld(true);
              };
              const placeB = () => {
                gA.position.copy(offPos);
                gB.position.copy(rayPos);
                gA.updateMatrixWorld(true);
                gB.updateMatrixWorld(true);
              };
              placeA();
              app.interactables.push(gA, gB);
              const gzEnWas = gz.enabled;
              const gzDtWas = gz.dwellTime;
              const gzGraceWas = gz.graceTime;
              gz.enabled = true;
              gz.dwellTime = 1500;
              gz.graceTime = 300;
              try {
                // 1.0 s on A — charging but not yet fired.
                app.updateSystems(0, fakeXrFrame, 1.0);
                const elAfterCharge = gz._elapsed;
                // 0.1 s slip onto B — inside grace. Defect: instant retarget.
                placeB();
                app.updateSystems(0, fakeXrFrame, 0.1);
                out.slipHolds = gz._target === gA
                  && gz._elapsed === elAfterCharge
                  && bFires === 0;
                // Stay on B past graceTime — the persistent new target wins
                // only after outlasting the grace window.
                app.updateSystems(0, fakeXrFrame, 0.25);
                out.slipRetargets = gz._target === gB;
                // Resume path: reset, charge A again, brief slip to B, return
                // — the held charge must resume and complete on A.
                gz._reset();
                placeA();
                app.updateSystems(0, fakeXrFrame, 1.0);
                placeB();
                app.updateSystems(0, fakeXrFrame, 0.1);
                placeA();
                app.updateSystems(0, fakeXrFrame, 0.6);
                out.slipResumes = aFires === 1;
                // Fill disc + confirm flash internals: _updateFill scales
                // the reticle progress disc with the charge, activation
                // sets _confirmMs (ring opacity 1), _tickConfirm decays it
                // — held flat under reduced motion (WCAG 2.3.3).
                const rmWas = gz.reduceMotion;
                try {
                  gz._reset(); placeA(); aFires = 0;
                  app.updateSystems(0, fakeXrFrame, 1.0);   // 2/3 charge
                  const fillMid = gz._fill.scale.x;
                  app.updateSystems(0, fakeXrFrame, 0.6);   // completes
                  const fillDone = gz._fill.scale.x;
                  const flashStart = gz._ring.material.opacity;
                  gz._reset();
                  out.gazeFillProgress = Math.abs(fillMid - 2 / 3) < 0.02
                    && fillDone === 1 && aFires === 1
                    && flashStart === 1
                    && gz._fill.scale.x === 0.001
                    && gz._ring.material.opacity === gz._ringOpacity;
                  // Flash decay: normal mode eases back to resting opacity
                  // across CONFIRM_MS (250ms); both targets off-ray so the
                  // dwell clears while _tickConfirm still ticks.
                  aFires = 0; placeA();
                  app.updateSystems(0, fakeXrFrame, 1.6);   // fire
                  const opFired = gz._ring.material.opacity;
                  gA.position.copy(offPos); gB.position.copy(offPos);
                  gA.updateMatrixWorld(true); gB.updateMatrixWorld(true);
                  app.updateSystems(0, fakeXrFrame, 0.1);
                  const opMidDecay = gz._ring.material.opacity;
                  app.updateSystems(0, fakeXrFrame, 0.2);   // past 250ms
                  const opRest = gz._ring.material.opacity;
                  gz._reset(); aFires = 0; gz.setReducedMotion(true); placeA();
                  app.updateSystems(0, fakeXrFrame, 1.6);   // fire
                  app.updateSystems(0, fakeXrFrame, 0.1);   // inside hold
                  const opRmHold = gz._ring.material.opacity;
                  app.updateSystems(0, fakeXrFrame, 0.3);   // past CONFIRM_MS
                  const opRmRest = gz._ring.material.opacity;
                  out.gazeConfirmFlash = opFired === 1
                    && opMidDecay < 1 && opMidDecay > gz._ringOpacity
                    && opRest === gz._ringOpacity
                    && opRmHold === 1
                    && opRmRest === gz._ringOpacity;
                } finally {
                  gz.setReducedMotion(rmWas);
                }
              } finally {
                gz._reset();
                gz.enabled = gzEnWas;
                gz.dwellTime = gzDtWas;
                gz.graceTime = gzGraceWas;
                for (const o of [gA, gB]) {
                  const ix = app.interactables.indexOf(o);
                  if (ix >= 0) {
                    app.interactables.splice(ix, 1);
                  }
                }
              }
            }
            // Grab-to-move: selectstart on the real move bar runs
            // onGrabRequested -> beginGrab; updateSystems then tracks the
            // controller; selectend runs endGrab + release feedback.
            const barObj = app.tabManager && app.tabManager.tabs
              && app.tabManager.tabs[0] && app.tabManager.tabs[0].moveBarMesh;
            if (ctrl && barObj && app.windowManager && app.camera) {
              const wm = app.windowManager;
              const grabHaptic = [];
              const origGPlay = app.hapticFeedback && app.hapticFeedback.playPattern;
              if (origGPlay) {
                app.hapticFeedback.playPattern = (h, p) => { grabHaptic.push(p); };
              }
              const origMW2 = ctrl.matrixWorld.clone();
              try {
                // Aim the controller ray at the bar's real world position.
                const barPos = barObj.getWorldPosition(barObj.position.clone());
                const camPos = app.camera.getWorldPosition(barPos.clone());
                const toCam = camPos.sub(barPos).normalize();
                const cp = barPos.clone().add(toCam.clone().multiplyScalar(0.35));
                const up = ctrl.up.clone();
                ctrl.matrixWorld.lookAt(cp, barPos, up);
                ctrl.matrixWorld.setPosition(cp);
                app.updateSystems(0, fakeXrFrame, 0.016); // let hover see it
                ctrl.dispatchEvent({ type: 'selectstart' });
                out.grabStarts = wm.isGrabbing === true
                  && capWrites.some((t) => t.includes('Panel grabbed'))
                  && grabHaptic.includes('click');
                // Drag: move the controller laterally — the managed window
                // root must follow (updateSystems -> windowManager.update).
                const target = wm.target;
                const t0 = target ? target.getWorldPosition(target.position.clone()) : null;
                ctrl.matrixWorld.setPosition(cp.clone().add(new camPos.constructor(0.3, 0.1, 0)));
                app.updateSystems(0, fakeXrFrame, 0.016);
                const t1 = target ? target.getWorldPosition(target.position.clone()) : null;
                out.grabDrags = !!(t0 && t1
                  && Math.abs(t1.x - t0.x) + Math.abs(t1.z - t0.z) > 0.001);
                ctrl.dispatchEvent({ type: 'selectend' });
                out.grabEnds = wm.isGrabbing === false
                  && capWrites.some((t) => t.includes('Panel moved'))
                  && grabHaptic.includes('impact');
                // selectend on the OTHER controller must not end the grab:
                // onControllerSelect guards with controller === _grabController,
                // so a stray release from the non-grabbing hand can't drop the
                // window mid-drag.
                const capsGrab0 = capWrites.length;
                // Re-aim at the bar — the drag moved the controller away.
                ctrl.matrixWorld.lookAt(cp, barPos, up);
                ctrl.matrixWorld.setPosition(cp);
                app.updateSystems(0, fakeXrFrame, 0.016);
                ctrl.dispatchEvent({ type: 'selectstart' });
                const regrabOk = wm.isGrabbing === true;
                const otherG = app.controllers && app.controllers[1];
                if (otherG) {
                  otherG.dispatchEvent({ type: 'selectend' });
                }
                out.grabHeldWrongRelease = !!otherG && regrabOk
                  && wm.isGrabbing === true
                  && !capWrites.slice(capsGrab0).some((t) => t.includes('Panel moved'));
                ctrl.dispatchEvent({ type: 'selectend' });
              } finally {
                app.windowManager && wm.isGrabbing && wm.endGrab();
                if (origGPlay) {
                  app.hapticFeedback.playPattern = origGPlay;
                }
                ctrl.matrixWorld.copy(origMW2);
              }
            }
            // Locomotion + face-button input path: gamepad state on a
            // connected XRInputSource drives snap turn (right thumbstick,
            // latch release) and face-button actions through the REAL
            // updateLocomotion/updateButtonInput — the input-to-effect
            // wiring (dead zone, family maps, edge-triggered buttons)
            // that only exists end-to-end here.
            const ctrlL = app.controllers && app.controllers[1];
            if (ctrl && ctrlL && app.controllerInput && app.playerRig) {
              const mkSrc = (handedness) => ({
                handedness,
                profiles: ['meta-quest-touch-pro'],
                gamepad: {
                  axes: [0, 0, 0, 0],
                  buttons: [0, 0, 0, 0, 0, 0, 0].map(() => ({ pressed: false, value: 0 }))
                }
              });
              const rightSrc = mkSrc('right');
              const leftSrc = mkSrc('left');
              const locoCaps = [];
              const origLShow = app.captionSystem && app.captionSystem.show;
              if (origLShow) {
                app.captionSystem.show = (m) => { locoCaps.push(String(m)); };
              }
              const locoHaptic = [];
              const origLPlay = app.hapticFeedback && app.hapticFeedback.playPattern;
              if (origLPlay) {
                app.hapticFeedback.playPattern = (h, p) => { locoHaptic.push(h + ':' + p); };
              }
              const origYaw = app.playerRig.rotation.y;
              try {
                ctrl.dispatchEvent({ type: 'connected', data: rightSrc });
                ctrlL.dispatchEvent({ type: 'connected', data: leftSrc });
                // Stick right → clockwise snap (-30° about +Y) + caption +
                // haptic on the right hand. Snap direction convention:
                // x > 0 calls snapTurn(-1) → angle -30° → facing swings
                // from -Z toward +X = turn RIGHT; the caption must agree.
                rightSrc.gamepad.axes[2] = 0.8;
                app.updateSystems(0, fakeXrFrame, 0.016);
                const yawAfter = app.playerRig.rotation.y;
                out.snapTurns = Math.abs(yawAfter - origYaw - (-Math.PI / 6)) < 0.01
                  && locoCaps.some((t) => t.includes('Right 30'))
                  && locoHaptic.includes('right:click');
                // Held stick is edge-latched: a second frame does not snap
                // again until the stick re-centres past the release band.
                app.updateSystems(0, fakeXrFrame, 0.016);
                const yawHeld = app.playerRig.rotation.y;
                rightSrc.gamepad.axes[2] = 0;
                app.updateSystems(0, fakeXrFrame, 0.016);
                rightSrc.gamepad.axes[2] = 0.8;
                app.updateSystems(0, fakeXrFrame, 0.016);
                out.snapLatch = Math.abs(yawHeld - yawAfter) < 0.001
                  && Math.abs(app.playerRig.rotation.y - yawAfter - (-Math.PI / 6)) < 0.01;
                // Pointer-hand faceA with no forward history → the honest
                // 'No next page' caption (not silence, not a fake success).
                rightSrc.gamepad.buttons[4].pressed = true;
                app.updateSystems(0, fakeXrFrame, 0.016);
                out.faceAAnnounces = locoCaps.some((t) => t.includes('No next page'));
                // Utility-hand faceB toggles the settings panel + announces.
                const visBefore = !!(app.settingsPanel && app.settingsPanel.visible);
                // Earlier legs force settingsPanel.visible directly, which
                // legitimately skips the utility-hand mirror — re-sync the
                // landmark first so the pin isolates this branch's write.
                if (app.semanticDOM) {
                  app.semanticDOM.setSettingsExpanded(visBefore);
                }
                const ariaBefore = app.semanticDOM && app.semanticDOM.settingsRegion
                  ? app.semanticDOM.settingsRegion.getAttribute('aria-expanded') : null;
                leftSrc.gamepad.buttons[5].pressed = true;
                app.updateSystems(0, fakeXrFrame, 0.016);
                const visAfter = !!(app.settingsPanel && app.settingsPanel.visible);
                out.faceBToggles = visAfter === !visBefore
                  && locoCaps.some((t) => t.includes(visAfter ? 'Settings: open' : 'Settings: closed'));
                // The same branch mirrors to the DOM landmark — the
                // aria-expanded write must track the panel's new state.
                const ariaAfter = app.semanticDOM && app.semanticDOM.settingsRegion
                  ? app.semanticDOM.settingsRegion.getAttribute('aria-expanded') : null;
                out.semExpanded = ariaAfter === String(visAfter)
                  && ariaAfter !== ariaBefore;
                leftSrc.gamepad.buttons[5].pressed = false;
                rightSrc.gamepad.buttons[4].pressed = false;
                // Utility-hand menu button — the second settings-panel route
                // (faceB || menu). Toggles + announces exactly like faceB.
                const visM0 = !!(app.settingsPanel && app.settingsPanel.visible);
                leftSrc.gamepad.buttons[6].pressed = true;
                app.updateSystems(0, fakeXrFrame, 0.016);
                leftSrc.gamepad.buttons[6].pressed = false;
                app.updateSystems(0, fakeXrFrame, 0.016);
                const visM1 = !!(app.settingsPanel && app.settingsPanel.visible);
                out.menuToggles = visM1 === !visM0
                  && locoCaps.some((t) => t.includes(visM1 ? 'Settings: open' : 'Settings: closed'));
                if (visM1) { // restore: second press closes it again
                  leftSrc.gamepad.buttons[6].pressed = true;
                  app.updateSystems(0, fakeXrFrame, 0.016);
                  leftSrc.gamepad.buttons[6].pressed = false;
                  app.updateSystems(0, fakeXrFrame, 0.016);
                }
                // SemanticDOM teardown + unbuilt arms — a fresh instance
                // (never the app's own) detaches its container, nulls all
                // three regions, stays safe on a second dispose and on
                // announce-after-dispose; a rootless instance never builds
                // and announces no-op.
                {
                  const SD = app.semanticDOM.constructor;
                  const sd2 = new SD({ root: document.body });
                  const c2 = sd2.container;
                  sd2.dispose();
                  let threw2 = false;
                  try { sd2.announceCaption('x'); sd2.dispose(); } catch (e2) { threw2 = true; }
                  const sdN = new SD({ root: null });
                  let threwN = false;
                  try {
                    sdN.announceCaption('x'); sdN.announceAlert('y'); sdN.dispose();
                  } catch (e3) { threwN = true; }
                  out.semDispose = sd2.container === null && sd2.captionRegion === null
                    && sd2.alertRegion === null && sd2.settingsRegion === null
                    && c2.parentNode === null && !threw2
                    && sdN.container === null && !threwN;
                }
                // scrollContent guards on the 'reader' content state — a
                // non-reader panel must refuse the scroll and keep its
                // offset even when reader lines exist.
                {
                  const wp3 = app.tabManager.getActiveTab();
                  const stateWas3 = wp3._contentState;
                  const linesWas3 = wp3._readerLines;
                  const scrWas3 = wp3._readerScroll;
                  if (!linesWas3 || !linesWas3.length) {
                    wp3._readerLines = new Array(60).fill('x');
                  }
                  wp3._contentState = 'loaded';
                  const retNR = wp3.scrollContent(5);
                  const scrNR = wp3._readerScroll;
                  wp3._contentState = stateWas3;
                  wp3._readerLines = linesWas3;
                  out.wpScrollNonReader = retNR === false && scrNR === scrWas3;
                }
                // VRControllerInput family maps + edge arms — drive read()
                // on fake sources across device families: the button map is
                // per-family (Vive wands have no faceA/faceB, generic only
                // trigger+squeeze), profiles[] order wins, and the radial
                // dead-zone renormalises magnitude past the threshold.
                {
                  const ci = app.controllerInput;
                  const mkSrc = (profiles, buttons, axes, handedness) => ({
                    handedness: handedness || 'right',
                    profiles: profiles || [],
                    gamepad: buttons === null ? null : {
                      buttons: (buttons || []).map((b) => ({
                        pressed: !!b, value: b ? 1 : 0
                      })),
                      axes: axes || [0, 0, 0, 0]
                    }
                  });
                  const vive = ci.read(mkSrc(['htc-vive'],
                    [1, 1, 0, 0, 1, 0, 0], [0.5, -0.5, 0, 0]));
                  const gen = ci.read(mkSrc(['mystery-pad'],
                    [1, 1, 1, 1, 1, 1, 1]));
                  out.ctrlFamilies = vive.family === 'htc-vive'
                    && vive.buttons.menu && vive.buttons.menu.pressed === true
                    && vive.buttons.faceA === undefined
                    && vive.buttons.faceB === undefined
                    && vive.axes.trackpadX !== 0 && vive.axes.trackpadY !== 0
                    && gen.family === 'generic'
                    && gen.buttons.trigger.pressed === true
                    && gen.buttons.squeeze.pressed === true
                    && gen.buttons.faceA === undefined;
                  // A mid-sequence family change rebuilds the snapshot shape
                  // and resets edge state — prior pressed buttons can't leak
                  // justPressed into the new map.
                  const mutSrc = mkSrc(['oculus-touch-v2'],
                    [1, 0, 0, 0, 1, 0, 0]);
                  ci.read(mutSrc);
                  mutSrc.profiles = ['generic-trigger'];
                  const mut2 = ci.read(mutSrc);
                  // The snapshot object is reused per source — read edges
                  // into scalars between frames or later reads overwrite them.
                  const mut2Jp = mut2.buttons.trigger.justPressed;
                  const mut2NoFaceA = mut2.buttons.faceA === undefined;
                  mutSrc.gamepad.buttons[0].pressed = false;
                  const mut3Rel = ci.read(mutSrc).buttons.trigger.justReleased;
                  mutSrc.gamepad.buttons[0].pressed = true;
                  const mut4Jp = ci.read(mutSrc).buttons.trigger.justPressed;
                  out.ctrlFamRebuild = mut2.family === 'generic'
                    && mut2NoFaceA === true
                    && mut2Jp === true
                    && mut3Rel === true
                    && mut4Jp === true;
                  // Radial dead-zone: a diagonal (0.10, 0.10) has magnitude
                  // 0.141 < 0.15 and must read zero (the square-clamp fix);
                  // 0.2 deflection renormalises to (0.2-dz)/(1-dz).
                  const dz = ci.deadZone;
                  const stillSrc = mkSrc(['oculus-touch-v2'], [], [0, 0, 0.10, 0.10]);
                  const still = ci.read(stillSrc);
                  const pushSrc = mkSrc(['oculus-touch-v2'], [], [0, 0, 0.2, 0]);
                  const push = ci.read(pushSrc);
                  const expect = (0.2 - dz) / (1 - dz);
                  out.ctrlDeadZoneRad = still.axes.stickX === 0
                    && still.axes.stickY === 0
                    && Math.abs(push.axes.stickX - expect) < 1e-9
                    && push.axes.stickY === 0;
                  // Gamepad-less / null sources yield the empty snapshot.
                  const noGp = ci.read(mkSrc(['oculus-touch-v2'], null, null, 'left'));
                  const noSrc = ci.read(null);
                  out.ctrlEmptySnap = noGp.family === 'meta-quest'
                    && noGp.hand === 'left'
                    && Object.keys(noGp.buttons).length === 0
                    && noSrc.family === 'generic' && noSrc.hand === 'unknown'
                    && Object.isFrozen(noSrc.buttons)
                    && ci.getDeviceName(mkSrc(['pico-4'], [], null, 'left'))
                      === 'Pico Controller (left)';
                }
                // LayersSystem — the whole WebXR Layers lifecycle over
                // injected fakes (headless has no XRWebGLBinding): the
                // unsupported + throwing-constructor init paths, createQuad-
                // Layer's real args + registry + transform, the per-view
                // blit's GL call sequence + finally unbind, render-state
                // ordering (baseLayer first then quads) and dispose teardown.
                // Fresh instances only — the app's own stays untouched.
                {
                  const LS = app.layersSystem.constructor;
                  const ls = new LS();
                  const xrWas = globalThis.XRWebGLBinding;
                  try {
                    delete globalThis.XRWebGLBinding;
                    const made = [];
                    globalThis.XRWebGLBinding = class FakeBinding {
                      constructor(session, gl) {
                        this.session = session; this.gl = gl;
                        this.quads = [];
                        made.push(this);
                      }
                      createQuadLayer(opts) {
                        const q = { opts, transform: null };
                        this.quads.push(q);
                        return q;
                      }
                      getViewSubImage(layer, view) {
                        return { framebuffer: 'fb-' + view.eye,
                          viewport: { x: 0, y: 0, width: 10, height: 10 },
                          colorTexture: 'tex-' + view.eye };
                      }
                    };
                    out.layerInit = ls.initialize({ s: 1 }, { g: 1 }) === true
                      && ls.supported === true && ls.glBinding === made[0];
                    class ThrowB { constructor() { throw new Error('no layers'); } }
                    const xrCls = globalThis.XRWebGLBinding;
                    globalThis.XRWebGLBinding = ThrowB;
                    const lsT = new LS();
                    out.layerInit = out.layerInit
                      && lsT.initialize({ s: 1 }, { g: 1 }) === false
                      && lsT.supported === false;
                    globalThis.XRWebGLBinding = xrCls;
                    // createQuadLayer: unsupported rejects; supported real
                    // args + registry + transform; binding failure → null.
                    const ls2 = new LS();
                    out.layerCreate = ls2.createQuadLayer({ id: 'n' }) === null
                      && ls2.count === 0;
                    const t9 = { fakeTransform: true };
                    const q = ls.createQuadLayer({ id: 'quad-a', space: 'sp',
                      transform: t9, width: 1.2, height: 0.7,
                      pixelWidth: 1024, pixelHeight: 640 });
                    const qo = q && q.opts;
                    out.layerCreate = out.layerCreate && !!q
                      && qo.space === 'sp' && qo.colorFormat === 0x8058
                      && qo.width === 1.2 && qo.height === 0.7
                      && qo.viewPixelWidth === 1024
                      && qo.viewPixelHeight === 640
                      && qo.layout === 'mono' && qo.isStatic === false
                      && q.transform === t9 && ls.count === 1;
                    made[0].createQuadLayer = () => { throw new Error('no'); };
                    out.layerCreate = out.layerCreate
                      && ls.createQuadLayer({ id: 'bad', space: 's',
                        width: 1, height: 1 }) === null
                      && ls.count === 1;
                    // renderCanvasToLayer: per-view subimage blit + finally
                    // unbind; empty views → no GL work; dead sub → skipped.
                    const calls = [];
                    ls._gl = {
                      FRAMEBUFFER: 1, TEXTURE_2D: 2, RGBA: 3, UNSIGNED_BYTE: 4,
                      bindFramebuffer: (tg, f) => calls.push('bindFb:' + f),
                      viewport: (x, y, w, h) => calls.push('vp:' + w + 'x' + h),
                      bindTexture: (tg, tx) => calls.push('bindTex:' + tx),
                      texSubImage2D: (...a) => calls.push('tex:' + a[6])
                    };
                    ls.renderCanvasToLayer(q, 'SRC', {}, []);
                    const noCalls = calls.length === 0;
                    ls.renderCanvasToLayer(q, 'SRC', {},
                      [{ eye: 'left' }, { eye: 'right' }]);
                    out.layerRender = noCalls === true
                      && calls.filter((c) => c === 'vp:10x10').length === 2
                      && calls.filter((c) => c === 'tex:SRC').length === 2
                      && calls.includes('bindFb:fb-left')
                      && calls.includes('bindTex:tex-left')
                      && calls.filter((c) => c === 'bindFb:null').length === 1;
                    made[0].getViewSubImage = () => null;
                    calls.length = 0;
                    ls.renderCanvasToLayer(q, 'SRC', {}, [{ eye: 'left' }]);
                    out.layerRender = out.layerRender
                      && calls.length === 1 && calls[0] === 'bindFb:null';
                    // updateRenderState commits baseLayer + quads in order;
                    // removeLayer shrinks the stack and recommits.
                    const stateCalls = [];
                    const sess2 = { updateRenderState: (s) => stateCalls.push(s.layers) };
                    ls._layers.set('b2', 'qB');
                    ls._layers.set('c2', 'qC');
                    ls.updateRenderState(sess2, 'BASE');
                    ls.removeLayer('c2', sess2, 'BASE');
                    out.layerRenderState = stateCalls.length === 2
                      && stateCalls[0].length === 4
                      && stateCalls[0][0] === 'BASE'
                      && stateCalls[0][1] === q
                      && stateCalls[0][2] === 'qB'
                      && stateCalls[0][3] === 'qC'
                      && stateCalls[1].length === 3
                      && stateCalls[1][0] === 'BASE'
                      && stateCalls[1][1] === q
                      && stateCalls[1][2] === 'qB';
                    ls.dispose();
                    out.layerDispose = ls.count === 0 && ls.supported === false
                      && ls.glBinding === null && ls._gl === null;
                  } finally {
                    if (xrWas === undefined) {
                      delete globalThis.XRWebGLBinding;
                    } else {
                      globalThis.XRWebGLBinding = xrWas;
                    }
                  }
                }
                // Utility-hand faceA toggles the bookmark/history panel +
                // announces the new state (WCAG 4.1.3).
                const bmWas = !!(app.bookmarkPanel && app.bookmarkPanel.visible);
                leftSrc.gamepad.buttons[4].pressed = true;
                app.updateSystems(0, fakeXrFrame, 0.016);
                leftSrc.gamepad.buttons[4].pressed = false;
                app.updateSystems(0, fakeXrFrame, 0.016);
                const bmNow = !!(app.bookmarkPanel && app.bookmarkPanel.visible);
                out.utilFaceAToggles = bmNow === !bmWas
                  && locoCaps.some((t) => t.includes(bmNow ? 'Bookmarks: open' : 'Bookmarks: closed'));
                if (bmNow && !bmWas) { // leave it as we found it
                  leftSrc.gamepad.buttons[4].pressed = true;
                  app.updateSystems(0, fakeXrFrame, 0.016);
                  leftSrc.gamepad.buttons[4].pressed = false;
                  app.updateSystems(0, fakeXrFrame, 0.016);
                }
                // Pointer-hand faceB/faceA navigate the active tab's history:
                // with entries below, back() moves + 'Going back', then
                // forward() returns + 'Going forward' — the success arms the
                // earlier 'No next page' pin never reached.
                const tabB = app.tabManager
                  && (app.tabManager.getActiveTab
                    ? app.tabManager.getActiveTab()
                    : app.tabManager.tabs[app.tabManager.activeIndex]);
                const idxB = tabB ? tabB.historyIdx : -1;
                rightSrc.gamepad.buttons[5].pressed = true;
                app.updateSystems(0, fakeXrFrame, 0.016);
                rightSrc.gamepad.buttons[5].pressed = false;
                app.updateSystems(0, fakeXrFrame, 0.016);
                out.ptrFaceBBack = !!tabB && tabB.historyIdx === idxB - 1
                  && locoCaps.some((t) => t.includes('Going back'));
                rightSrc.gamepad.buttons[4].pressed = true;
                app.updateSystems(0, fakeXrFrame, 0.016);
                rightSrc.gamepad.buttons[4].pressed = false;
                app.updateSystems(0, fakeXrFrame, 0.016);
                out.ptrFaceAFwd = !!tabB && tabB.historyIdx === idxB
                  && locoCaps.some((t) => t.includes('Going forward'));
                // Smooth locomotion (opt-in): move-hand stick drives the rig
                // along the head-facing plane and feeds the comfort vignette
                // (externalMotion + level), then disengages on release.
                const origSmooth = app.settings.enableSmoothMove;
                app.settings.enableSmoothMove = true;
                const p0 = app.playerRig.position.clone();
                leftSrc.gamepad.axes[3] = -0.8; // stick up = forward
                app.updateSystems(0, fakeXrFrame, 0.016);
                const cs = app.comfortSystem;
                out.smoothMoves = app.playerRig.position.distanceTo(p0) > 0.001
                  && cs && cs.externalMotion === true
                  && cs.externalMotionLevel > 0;
                leftSrc.gamepad.axes[3] = 0;
                app.updateSystems(0, fakeXrFrame, 0.016);
                out.smoothStops = cs && cs.externalMotion === false
                  && cs.externalMotionLevel === 0;
                app.settings.enableSmoothMove = origSmooth;
                // Comfort vignette internals — the quad, detectMotion and the
                // externalMotionLevel scaling were never e2e-driven (only the
                // setPreset live-apply and the externalMotion flags above).
                if (cs) {
                  const presetWas = cs.settings.preset;
                  const camPosWas = app.camera.position.clone();
                  const camRotWas = app.camera.rotation.y;
                  try {
                    cs.setPreset('moderate');
                    // The glide pin above already ran real update() frames —
                    // start from a known-zero vignette or the chase
                    // arithmetic below is off by that residue.
                    cs.currentVignette = 0;
                    // Head motion past the 1mm threshold → full-strength
                    // target: currentVignette chases intensity*1*smoothing.
                    app.camera.position.x += 0.05;
                    cs.update(0.016);
                    out.comfortHeadMotion = cs._headMoving === true
                      && cs.isMoving === true
                      && Math.abs(cs.currentVignette
                        - cs.settings.vignette.intensity
                          * cs.settings.vignette.smoothing) < 1e-9
                      && cs.vignetteMaterial.opacity === cs.currentVignette
                      && cs.vignetteMesh.visible === true;
                    // Settle at rest, then a 0.5-strength locomotion signal
                    // must produce HALF the full-strength target — adaptive
                    // FOV restriction (arXiv:2502.03419).
                    app.camera.position.copy(camPosWas);
                    app.camera.rotation.y = camRotWas;
                    cs.update(0.016); // re-detect at rest
                    cs.externalMotion = true;
                    cs.externalMotionLevel = 0.5;
                    const vBefore = cs.currentVignette;
                    cs.update(0.016);
                    const expected = cs.settings.vignette.intensity * 0.5;
                    out.comfortExternalLevel = cs.isMoving === true
                      && Math.abs(cs.currentVignette
                        - (vBefore + (expected - vBefore)
                          * cs.settings.vignette.smoothing)) < 1e-9;
                    // Rotation alone is full-strength motion: the
                    // (headMoving || isRotating) disjunct must chase the
                    // vignette to full intensity on a pure yaw turn, while
                    // isMoving stays false (rotation is not locomotion).
                    cs.externalMotion = false;
                    cs.externalMotionLevel = 1;
                    app.camera.rotation.y = camRotWas;
                    cs.update(0.016); // re-detect at rest
                    const vRotBefore = cs.currentVignette;
                    app.camera.rotation.y = camRotWas + 0.01;
                    cs.update(0.016);
                    const rotExpected = cs.settings.vignette.intensity;
                    out.comfortRotation = cs.isRotating === true
                      && cs.isMoving === false
                      && Math.abs(cs.currentVignette
                        - (vRotBefore + (rotExpected - vRotBefore)
                          * cs.settings.vignette.smoothing)) < 1e-9;
                    app.camera.rotation.y = camRotWas;
                    cs.update(0.016); // settle rest
                    // The 'disabled' preset drops the vignette gate — motion
                    // still detects but the effect never engages; switching
                    // back out MUST re-enable (the Object.assign merge arm —
                    // omitting 'enabled' in a preset would strand a user who
                    // went disabled -> sensitive with zero mitigation).
                    cs.setPreset('disabled');
                    const vDis = cs.currentVignette;
                    app.camera.position.x = camPosWas.x + 0.05;
                    cs.update(0.016);
                    const disHeld = cs.currentVignette === vDis
                      && cs.vignetteMaterial.opacity === vDis;
                    app.camera.position.x = camPosWas.x;
                    cs.update(0.016);
                    cs.setPreset('sensitive');
                    out.comfortDisabledGate = disHeld === true
                      && cs.settings.vignette.enabled === true
                      && cs.settings.vignette.intensity === 0.8
                      && cs.settings.preset === 'sensitive';
                    // dispose() tears the quad out of its camera parent and
                    // releases the GL texture/material — fresh instance on a
                    // stub camera so the app's own vignette survives.
                    const CS2 = app.comfortSystem.constructor;
                    const camStub = {
                      children: [],
                      add(c) { this.children.push(c); c.parent = this; },
                      remove(c) {
                        const ci = this.children.indexOf(c);
                        if (ci >= 0) { this.children.splice(ci, 1); c.parent = null; }
                      }
                    };
                    const cs2 = new CS2(camStub);
                    const vm2 = cs2.vignetteMesh;
                    cs2.dispose();
                    out.comfortDispose = camStub.children.length === 0
                      && vm2.parent === null;
                  } finally {
                    cs.externalMotion = false;
                    cs.externalMotionLevel = 1;
                    app.camera.position.copy(camPosWas);
                    app.camera.rotation.y = camRotWas;
                    cs.setPreset(presetWas);
                    cs.currentVignette = 0;
                    cs.vignetteMaterial.opacity = 0;
                    cs.vignetteMesh.visible = false;
                  }
                }
                // FFR internals — initialize() can't run headless (no
                // XRWebGLBinding), so the settings pin above only spied
                // enable/disable calls. Stand in a projection-layer sink
                // and drive the clamp/write path, the head-velocity EMA,
                // and the predicted-gaze chase for real (FR-4.2).
                const ffr = app.ffrSystem;
                if (ffr) {
                  const ffrProjWas = ffr.projectionLayer;
                  const ffrBaseWas = ffr._baseFoveation;
                  const ffrEnabledWas = ffr.enabled;
                  const ffrPredWas = ffr.predictedGazeEnabled;
                  try {
                    ffr.projectionLayer = { fixedFoveation: -1 };
                    ffr._baseFoveation = false;
                    ffr.enabled = true;
                    // enable + adjustIntensity clamp the intensity and the
                    // value reaches the layer; disable writes 0.
                    ffr.enable(1.7);
                    const enOk = ffr.intensity === 1
                      && ffr.projectionLayer.fixedFoveation === 1;
                    ffr.adjustIntensity(-2);
                    const adjOk = ffr.intensity === 0
                      && ffr.projectionLayer.fixedFoveation === 0;
                    ffr.enable(0.5);
                    ffr.disable();
                    out.ffrWritesClamp = enOk && adjOk
                      && ffr.projectionLayer.fixedFoveation === 0;
                    // Head-motion EMA → predicted foveation: a ~90°/frame
                    // head turn is FAST (scanning → low intensity), then a
                    // still head decays the EMA below SLOW (fixating →
                    // chase up toward 0.8).
                    const s4 = Math.sin(Math.PI / 4);
                    const c4 = Math.cos(Math.PI / 4);
                    ffr._prevHeadQuat = { x: 0, y: 0, z: 0, w: 1 };
                    ffr._headVelocity = 0;
                    ffr.intensity = 0.8;
                    ffr.trackHeadPose({ x: 0, y: s4, z: 0, w: c4 }, 0.016);
                    const velFast = ffr._headVelocity;
                    ffr.updatePredictedGazeFoveation();
                    const fastFov = ffr.projectionLayer.fixedFoveation;
                    for (let i = 0; i < 80; i++) {
                      ffr.trackHeadPose(
                        { x: 0, y: s4, z: 0, w: c4 }, 0.016);
                      ffr.updatePredictedGazeFoveation();
                    }
                    out.ffrHeadAdaptive = ffr.predictedGazeEnabled === true
                      && velFast > 0.5
                      && fastFov < 0.8
                      && ffr._headVelocity < 0.05
                      && ffr.projectionLayer.fixedFoveation > 0.6
                      && ffr.projectionLayer.fixedFoveation > fastFov;
                  } finally {
                    ffr.projectionLayer = ffrProjWas;
                    ffr._baseFoveation = ffrBaseWas;
                    ffr.enabled = ffrEnabledWas;
                    ffr.predictedGazeEnabled = ffrPredWas;
                    ffr._headVelocity = 0;
                    ffr._prevHeadQuat = null;
                  }
                }
                // FPS-adaptive quality governor — render() calls
                // adjustQuality every 60 frames: the EMA'd frameTime vs
                // 1000/targetFPS decides reduce (>1.2× → +0.1 intensity) /
                // increase (<0.8× → −0.1) / deadband (unchanged) so a slow
                // session self-lowers foveation while a fast one restores it.
                const ffrQ = app.ffrSystem;
                if (ffrQ && app.performanceMonitor
                  && typeof app.settings.targetFPS === 'number'
                  && app.settings.targetFPS > 0) {
                  const qProjWas = ffrQ.projectionLayer;
                  const qEnWas = ffrQ.enabled;
                  const qIntWas = ffrQ.intensity;
                  const ftWas = app.performanceMonitor.frameTime;
                  const tgt = 1000 / app.settings.targetFPS;
                  try {
                    ffrQ.projectionLayer = { fixedFoveation: -1 };
                    ffrQ.enabled = true;
                    ffrQ.intensity = 0.5;
                    app.performanceMonitor.frameTime = tgt * 1.5;
                    app.adjustQuality();          // slow → reduceQuality
                    const govUp = ffrQ.intensity === 0.6
                      && ffrQ.projectionLayer.fixedFoveation === 0.6;
                    app.performanceMonitor.frameTime = tgt * 0.5;
                    app.adjustQuality();          // fast → increaseQuality
                    const govDown = ffrQ.intensity === 0.5;
                    app.performanceMonitor.frameTime = tgt;
                    app.adjustQuality();          // deadband → no nudge
                    out.qualityGovernor = govUp && govDown
                      && ffrQ.intensity === 0.5;
                  } finally {
                    ffrQ.projectionLayer = qProjWas;
                    ffrQ.enabled = qEnWas;
                    ffrQ.intensity = qIntWas;
                    app.performanceMonitor.frameTime = ftWas;
                  }
                }
                // Pointer thumbstickClick → recenter: rig pose reset + caption.
                app.playerRig.position.set(0.5, 0, 0.25);
                rightSrc.gamepad.buttons[3].pressed = true;
                app.updateSystems(0, fakeXrFrame, 0.016);
                out.stickRecenters = app.playerRig.position.lengthSq() < 0.001
                  && locoCaps.some((t) => t.includes('Recentered'));
                rightSrc.gamepad.buttons[3].pressed = false;
                // Utility thumbstickClick → VR keyboard toggle + caption.
                const kbBefore = !!(app.vrKeyboard && app.vrKeyboard.visible);
                leftSrc.gamepad.buttons[3].pressed = true;
                app.updateSystems(0, fakeXrFrame, 0.016);
                const kbAfter = !!(app.vrKeyboard && app.vrKeyboard.visible);
                out.stickKeyboard = kbAfter === !kbBefore
                  && locoCaps.some((t) => t.includes(kbAfter ? 'Keyboard: open' : 'Keyboard: closed'));
                leftSrc.gamepad.buttons[3].pressed = false;
                // Southpaw swaps roles: the left stick becomes the snap-turn hand.
                const yawBeforeSp = app.playerRig.rotation.y;
                app.settings.southpaw = true;
                leftSrc.gamepad.axes[2] = 0.8;
                app.updateSystems(0, fakeXrFrame, 0.016);
                out.southpawSwaps = Math.abs(
                  app.playerRig.rotation.y - yawBeforeSp - (-Math.PI / 6)) < 0.01;
                leftSrc.gamepad.axes[2] = 0;
                app.settings.southpaw = false;
                // Settings stepper select → live apply chain (deepest wiring):
            // hover identify by announced label → +region select →
            // updateSetting + apply → the new value drives the very next real
            // snap turn. Also pins the section-tab select → panel rebuild
            // path (old interactables unregistered, new meshes raycastable).
            if (app.settingsPanel && app.captionSystem) {
              const visWas2 = !!app.settingsPanel.visible;
              if (app.settingsPanel.visible !== true) {
                app.settingsPanel.visible = true;
              }
              const gazeWas2 = app.settings.enableGazeDwell;
              app.settings.enableGazeDwell = true;
              // The loco leg's show() is a swallow-stub call log (locoCaps),
              // so the probe identifies buttons by the announce CALL, not by
              // the semantic-DOM write.
              app.updateSetting('enableCaptions', true);
              app.captionSystem.enabled = true;
              const secsWas = (app.settings.openSettingsSections || []).slice();
              const durWas = app.settings.captionDuration;
              const snapWas = app.settings.snapTurnAngle;
              const origMW4 = ctrl.matrixWorld.clone();
              const aimAt = (pt) => {
                const camP = app.camera.getWorldPosition(pt.clone());
                const toC = camP.sub(pt).normalize();
                const cp = pt.clone().add(toC.multiplyScalar(0.35));
                ctrl.matrixWorld.lookAt(cp, pt, ctrl.up.clone());
                ctrl.matrixWorld.setPosition(cp);
              };
              const probeLabel = (text) => {
                const objs = app.interactables.filter((o) => {
                  for (let p = o; p; p = p.parent) {
                    if (p === app.settingsPanel) { return true; }
                  }
                  return false;
                });
                for (const obj of objs) {
                  const before = locoCaps.length;
                  aimAt(obj.getWorldPosition(obj.position.clone()));
                  app.updateSystems(0, fakeXrFrame, 0.016);
                  if (locoCaps.slice(before).join(' ').includes(text)) {
                    return obj;
                  }
                }
                return null;
              };
              const selectPlus = (btn) => {
                // +region hit: local x≈+0.34 on the 0.9 m stepper → u≈0.88.
                aimAt(btn.localToWorld(btn.position.clone().set(0.34, 0, 0)));
                app.updateSystems(0, fakeXrFrame, 0.016);
                ctrl.dispatchEvent({ type: 'selectstart' });
                ctrl.dispatchEvent({ type: 'selectend' });
              };
              const selectCenter = (btn) => {
                aimAt(btn.getWorldPosition(btn.position.clone()));
                app.updateSystems(0, fakeXrFrame, 0.016);
                ctrl.dispatchEvent({ type: 'selectstart' });
                ctrl.dispatchEvent({ type: 'selectend' });
              };
              try {
                const durBtn = probeLabel('Caption Hold');
                out.stepperProbe = !!durBtn;
                if (durBtn) {
                  selectPlus(durBtn);
                  out.stepperApplied = app.settings.captionDuration !== durWas
                    && app.captionSystem.lineDuration === app.settings.captionDuration * 1000;
                }
                const tabBtn = probeLabel('Movement');
                out.tabProbe = !!tabBtn;
                if (tabBtn) {
                  selectCenter(tabBtn);
                  out.tabSelect = (app.settings.openSettingsSections || [])
                    .includes('settings.section.locomotion');
                  // Rebuilt meshes need fresh world matrices before raycast.
                  app.scene.updateMatrixWorld(true);
                }
                if (out.tabSelect) {
                  const snapBtn = probeLabel('Snap Angle');
                  out.snapProbe = !!snapBtn;
                  if (snapBtn) {
                    const yawBase = app.playerRig.rotation.y;
                    rightSrc.gamepad.axes[2] = 0;
                    leftSrc.gamepad.axes[2] = 0;
                    app.updateSystems(0, fakeXrFrame, 0.016);
                    selectPlus(snapBtn);
                    const newAngle = app.settings.snapTurnAngle;
                    out.snapBumped = newAngle !== snapWas;
                    rightSrc.gamepad.axes[2] = 0.8;
                    app.updateSystems(0, fakeXrFrame, 0.016);
                    rightSrc.gamepad.axes[2] = 0;
                    out.snapApplies = Math.abs(
                      app.playerRig.rotation.y - yawBase - (-newAngle * Math.PI / 180)) < 0.01
                      && locoCaps.some((t) => t.includes('Right ' + newAngle));
                  }
                }
              } finally {
                ctrl.matrixWorld.copy(origMW4);
                rightSrc.gamepad.axes[2] = 0;
                leftSrc.gamepad.axes[2] = 0;
                app.updateSetting('captionDuration', durWas);
                app.captionSystem.setLineDuration(durWas * 1000);
                app.updateSetting('snapTurnAngle', snapWas);
                app.updateSetting('openSettingsSections', secsWas);
                app.settings.enableGazeDwell = gazeWas2;
                if (app.settings.enableCaptions !== true) {
                  app.updateSetting('enableCaptions', true);
                }
                if (app.captionSystem.enabled !== true) {
                  app.captionSystem.enabled = true;
                }
                app._rebuildSettingsPanel();
                app.settingsPanel.visible = visWas2;
              }
            }
            // Settings cycle + action buttons (browsing section): the last
            // undriven settings surface — a cycle's select advances the
            // option and live-applies (tabManager.setSearchEngine), and the
            // action buttons run their destructive/utility paths. Same
            // announce-probe identification via the stubbed show() → locoCaps.
            if (app.settingsPanel && app.captionSystem && app.tabManager && app.bookmarks) {
              const visWas3 = !!app.settingsPanel.visible;
              if (app.settingsPanel.visible !== true) {
                app.settingsPanel.visible = true;
              }
              const gazeWas3 = app.settings.enableGazeDwell;
              app.settings.enableGazeDwell = true;
              app.updateSetting('enableCaptions', true);
              app.captionSystem.enabled = true;
              const secsWas3 = (app.settings.openSettingsSections || []).slice();
              const engWas = app.settings.searchEngine;
              const bmWas = !!(app.bookmarkPanel && app.bookmarkPanel.visible);
              const origMW5 = ctrl.matrixWorld.clone();
              const aimAt5 = (pt) => {
                const camP = app.camera.getWorldPosition(pt.clone());
                const toC = camP.sub(pt).normalize();
                const cp = pt.clone().add(toC.multiplyScalar(0.35));
                ctrl.matrixWorld.lookAt(cp, pt, ctrl.up.clone());
                ctrl.matrixWorld.setPosition(cp);
              };
              const probeLabel5 = (text) => {
                const objs = app.interactables.filter((o) => {
                  for (let p = o; p; p = p.parent) {
                    if (p === app.settingsPanel) { return true; }
                  }
                  return false;
                });
                for (const obj of objs) {
                  const before = locoCaps.length;
                  aimAt5(obj.getWorldPosition(obj.position.clone()));
                  app.updateSystems(0, fakeXrFrame, 0.016);
                  if (locoCaps.slice(before).join(' ').includes(text)) {
                    return obj;
                  }
                }
                return null;
              };
              const selectCenter5 = (btn) => {
                aimAt5(btn.getWorldPosition(btn.position.clone()));
                app.updateSystems(0, fakeXrFrame, 0.016);
                ctrl.dispatchEvent({ type: 'selectstart' });
                ctrl.dispatchEvent({ type: 'selectend' });
              };
              try {
                const browseTab = probeLabel5('Browsing');
                out.browseProbe = !!browseTab;
                if (browseTab) {
                  selectCenter5(browseTab);
                  out.browseSelect = (app.settings.openSettingsSections || [])
                    .includes('settings.section.browsing');
                  // Rebuilt meshes need fresh world matrices before raycast.
                  app.scene.updateMatrixWorld(true);
                }
                if (out.browseSelect) {
                  const engBtn = probeLabel5('Search');
                  out.cycleProbe = !!engBtn;
                  if (engBtn) {
                    selectCenter5(engBtn);
                    out.cycleApplied = app.settings.searchEngine !== engWas
                      && app.tabManager.opts.searchEngine === app.settings.searchEngine
                      && locoCaps.some((s) => s.includes('Search: ' + app.settings.searchEngine));
                  }
                  // Destructive action: seed a real history entry, then the
                  // button must wipe the store AND announce via the toast
                  // path (cross-modal: the caption lands in the stub log).
                  app.bookmarks.addHistory('https://harness-seed.example/', 'seed');
                  const seeded = JSON.parse(localStorage.getItem('quiBrowser_history') || '[]').length;
                  const clrBtn = probeLabel5('Clear History');
                  out.actionProbe = !!clrBtn && seeded > 0;
                  if (clrBtn) {
                    selectCenter5(clrBtn);
                    const left = JSON.parse(localStorage.getItem('quiBrowser_history') || '[]');
                    out.actionApplied = left.length === 0
                      && locoCaps.some((s) => s.includes('History cleared'));
                  }
                  const bmBtn = probeLabel5('Bookmarks');
                  out.bookmarkProbe = !!bmBtn;
                  if (bmBtn && app.bookmarkPanel) {
                    selectCenter5(bmBtn);
                    out.bookmarkToggled = !!app.bookmarkPanel.visible === !bmWas
                      && locoCaps.some((s) => s.includes(!bmWas ? 'Bookmarks: open' : 'Bookmarks: closed'));
                  }
                }
              } finally {
                ctrl.matrixWorld.copy(origMW5);
                app.updateSetting('searchEngine', engWas);
                if (engWas) {
                  app.tabManager.setSearchEngine(engWas);
                }
                app.updateSetting('openSettingsSections', secsWas3);
                app.settings.enableGazeDwell = gazeWas3;
                if (app.bookmarkPanel && !!app.bookmarkPanel.visible !== bmWas) {
                  app.bookmarkPanel.toggle();
                }
                app._rebuildSettingsPanel();
                app.settingsPanel.visible = visWas3;
              }
            }
            // Live-gate toggles (locomotion section): enableSnapTurn and
            // enableTeleport have NO apply callback — their whole effect is
            // being read each frame by the locomotion/teleport paths. Pin
            // the gate both directions through the already-pinned motions:
            // select → setting flips → the next stick push / squeeze either
            // runs or is suppressed. Plus the 'Comfort' preset cycle →
            // comfortSystem.setPreset live apply.
            if (app.settingsPanel && app.captionSystem) {
              const visWas4 = !!app.settingsPanel.visible;
              if (app.settingsPanel.visible !== true) {
                app.settingsPanel.visible = true;
              }
              const gazeWas4 = app.settings.enableGazeDwell;
              app.settings.enableGazeDwell = true;
              app.updateSetting('enableCaptions', true);
              app.captionSystem.enabled = true;
              const secsWas4 = (app.settings.openSettingsSections || []).slice();
              const snapWas4 = app.settings.enableSnapTurn;
              const telWas = app.settings.enableTeleport;
              const msWas = app.settings.motionSensitivity;
              const comfWas = app.settings.enableComfort;
              const origMW6 = ctrl.matrixWorld.clone();
              const aimAt6 = (pt) => {
                const camP = app.camera.getWorldPosition(pt.clone());
                const toC = camP.sub(pt).normalize();
                const cp = pt.clone().add(toC.multiplyScalar(0.35));
                ctrl.matrixWorld.lookAt(cp, pt, ctrl.up.clone());
                ctrl.matrixWorld.setPosition(cp);
              };
              const probeLabel6 = (text) => {
                const objs = app.interactables.filter((o) => {
                  for (let p = o; p; p = p.parent) {
                    if (p === app.settingsPanel) { return true; }
                  }
                  return false;
                });
                for (const obj of objs) {
                  const before = locoCaps.length;
                  aimAt6(obj.getWorldPosition(obj.position.clone()));
                  app.updateSystems(0, fakeXrFrame, 0.016);
                  if (locoCaps.slice(before).join(' ').includes(text)) {
                    return obj;
                  }
                }
                return null;
              };
              const selectCenter6 = (btn) => {
                aimAt6(btn.getWorldPosition(btn.position.clone()));
                app.updateSystems(0, fakeXrFrame, 0.016);
                ctrl.dispatchEvent({ type: 'selectstart' });
                ctrl.dispatchEvent({ type: 'selectend' });
              };
              try {
                const locoTab = probeLabel6('Movement');
                out.locoTabProbe = !!locoTab;
                if (locoTab) {
                  selectCenter6(locoTab);
                  out.locoTabOpen = (app.settings.openSettingsSections || [])
                    .includes('settings.section.locomotion');
                  // Rebuilt meshes need fresh world matrices before raycast.
                  app.scene.updateMatrixWorld(true);
                }
                if (out.locoTabOpen) {
                  const snapBtn = probeLabel6('Snap Turn');
                  out.snapToggleProbe = !!snapBtn;
                  if (snapBtn) {
                    selectCenter6(snapBtn);
                    const offOk = app.settings.enableSnapTurn === false;
                    // rotation.y flips to the (π, θ, π) Euler branch once the
                    // rig yaw crosses ±90° — read yaw from the quaternion.
                    const yawOf = () => {
                      const q = app.playerRig.quaternion;
                      return Math.atan2(2 * (q.w * q.y + q.x * q.z),
                        1 - 2 * (q.y * q.y + q.x * q.x));
                    };
                    rightSrc.gamepad.axes[2] = 0.8;
                    const yawOff = yawOf();
                    app.updateSystems(0, fakeXrFrame, 0.016);
                    rightSrc.gamepad.axes[2] = 0;
                    app.updateSystems(0, fakeXrFrame, 0.016);
                    const gated = Math.abs(yawOf() - yawOff) < 0.001;
                    selectCenter6(snapBtn);
                    const yawBase2 = yawOf();
                    rightSrc.gamepad.axes[2] = 0.8;
                    app.updateSystems(0, fakeXrFrame, 0.016);
                    const latched = ctrl.userData.snapLatched === true;
                    rightSrc.gamepad.axes[2] = 0;
                    const restored = app.settings.enableSnapTurn === true && latched
                      && Math.abs(yawOf() - yawBase2 - (-Math.PI / 6)) < 0.01;
                    out.snapGate = offOk && gated && restored;
                  }
                  const telBtn = probeLabel6('Teleport');
                  out.teleportProbe = !!telBtn;
                  if (telBtn) {
                    selectCenter6(telBtn);
                    ctrl.dispatchEvent({ type: 'squeezestart' });
                    const gatedOff = app.settings.enableTeleport === false
                      && app.teleport.active === false;
                    ctrl.dispatchEvent({ type: 'squeezeend' });
                    selectCenter6(telBtn);
                    ctrl.dispatchEvent({ type: 'squeezestart' });
                    const armedOn = app.settings.enableTeleport === true
                      && app.teleport.active === true;
                    ctrl.dispatchEvent({ type: 'squeezeend' });
                    out.teleportGate = gatedOff && armedOn;
                  }
                  // 'Comfort:' (with the colon) disambiguates the cycle's
                  // 'Comfort: <preset>' caption from the 'Movement & Comfort'
                  // section tab announce, which has no colon.
                  // The enableComfort toggle announces 'Comfort: ON/OFF' —
                  // a plain 'Comfort:' probe matches it before the cycle
                  // (toggles render first). The current preset VALUE only
                  // ever appears in the cycle's 'Comfort: <preset>' caption.
                  const comfBtn = probeLabel6('Comfort: ' + app.settings.motionSensitivity);
                  out.comfortProbe = !!comfBtn;
                  if (comfBtn && app.comfortSystem) {
                    selectCenter6(comfBtn);
                    out.comfortCycles = app.settings.motionSensitivity !== msWas
                      && app.comfortSystem.settings.preset === app.settings.motionSensitivity
                      && locoCaps.some((s) => s.includes('Comfort: ' + app.comfortSystem.settings.preset));
                  }
                  // smoothMoveWarning: enabling smooth locomotion while the
                  // OS prefers-reduced-motion signal is set fires a 'warn'
                  // toast — the only settings path consulting the OS signal
                  // at select time. Stub matchMedia so the real onSelect
                  // sees reduced-motion; the OFF select warns nothing.
                  app.settings.enableSmoothMove = false;
                  const smBtn = probeLabel6('Smooth Move');
                  const origMM = window.matchMedia;
                  const capsSM0 = locoCaps.length;
                  window.matchMedia = (q) =>
                    (q === '(prefers-reduced-motion: reduce)'
                      ? { matches: true } : origMM(q));
                  try {
                    if (smBtn) {
                      selectCenter6(smBtn); // ON under reduced-motion -> warn
                    }
                    const onWarn = locoCaps.slice(capsSM0)
                      .some((s) => s.includes('motion sickness'));
                    const capsSM1 = locoCaps.length;
                    if (smBtn && app.settings.enableSmoothMove === true) {
                      selectCenter6(smBtn); // OFF -> no warning
                    }
                    const offQuiet = !locoCaps.slice(capsSM1)
                      .some((s) => s.includes('motion sickness'));
                    out.smoothWarn = !!smBtn && onWarn && offQuiet
                      && app.settings.enableSmoothMove === false;
                  } finally {
                    window.matchMedia = origMM;
                    if (app.settings.enableSmoothMove !== false) {
                      app.settings.enableSmoothMove = false;
                    }
                  }
                }
                // enableComfort OFF clears a LIVE vignette (mid-glide disable
                // can't leave the FOV restricted) and gates the per-frame
                // update — a seeded vignette must stay untouched while off.
                const csLoco = app.comfortSystem;
                const comfortToggle = probeLabel6(
                  'Comfort: ' + (app.settings.enableComfort ? 'ON' : 'OFF'));
                if (comfortToggle && csLoco) {
                  csLoco.currentVignette = 0.5;
                  csLoco.vignetteMaterial.opacity = 0.5;
                  csLoco.vignetteMesh.visible = true;
                  selectCenter6(comfortToggle); // OFF
                  const clearedOff = app.settings.enableComfort === false
                    && csLoco.currentVignette === 0
                    && csLoco.vignetteMaterial.opacity === 0
                    && csLoco.vignetteMesh.visible === false;
                  // Gate: with enableComfort false, updateSystems skips
                  // comfortSystem.update entirely — a re-seeded vignette is
                  // left exactly as-is, head motion or not.
                  csLoco.currentVignette = 0.5;
                  csLoco.vignetteMaterial.opacity = 0.5;
                  const camXw = app.camera.position.x;
                  app.camera.position.x = camXw + 0.05;
                  app.updateSystems(0, fakeXrFrame, 0.016);
                  app.camera.position.x = camXw;
                  const gated = csLoco.currentVignette === 0.5;
                  csLoco.currentVignette = 0;
                  csLoco.vignetteMaterial.opacity = 0;
                  csLoco.vignetteMesh.visible = false;
                  selectCenter6(comfortToggle); // back ON
                  out.comfortOffClears = clearedOff && gated
                    && app.settings.enableComfort === true;
                } else {
                  out.comfortOffClears = false;
                }
                // The southpaw toggle's apply arm announces the new primary
                // hand — a plain flip persist would leave hand-dominant users
                // guessing which stick does what (WCAG 4.1.3).
                const spBtn = probeLabel6('Southpaw');
                const capsSp0 = locoCaps.length;
                if (spBtn) {
                  selectCenter6(spBtn); // ON -> 'Primary hand: left'
                  const onAnn = locoCaps.slice(capsSp0)
                    .some((s) => s.includes('Primary hand'));
                  const capsSp1 = locoCaps.length;
                  selectCenter6(spBtn); // OFF -> 'Primary hand: right'
                  const offAnn = locoCaps.slice(capsSp1)
                    .some((s) => s.includes('Primary hand'));
                  out.southpawCaption = onAnn && offAnn
                    && app.settings.southpaw === false;
                } else {
                  out.southpawCaption = false;
                }
                // OS accessibility listeners — the boot registered 'change'
                // handlers on three real MediaQueryLists; a mid-session OS
                // preference flip must re-apply live (WCAG 2.3.3 motion,
                // 1.4.11 contrast) instead of staying frozen at the boot
                // value. A synthetic 'change' carrying .matches dispatched
                // on the real MQL runs the registered listener end-to-end.
                if (app._osMotionMQ && app._osContrastMQ
                  && app._osForcedColorsMQ && app.gazeInteraction
                  && app.captionSystem) {
                  const gz = app.gazeInteraction;
                  const mmWas = window.matchMedia;
                  const rmWas = gz.reduceMotion;
                  const hcWas = gz._ringOpacity;
                  const ccHcWas = app.captionSystem.highContrast;
                  const mkChg = (m) =>
                    Object.assign(new Event('change'), { matches: m });
                  try {
                    app._osMotionMQ.dispatchEvent(mkChg(true));
                    const rmOn = gz.reduceMotion === true;
                    app._osMotionMQ.dispatchEvent(mkChg(false));
                    out.osMotionLiveSync = rmOn
                      && gz.reduceMotion === false;
                    // prefers-contrast flip → handler re-reads
                    // prefersHighContrast() → both the reticle ring and the
                    // caption backing take the high-contrast form live.
                    window.matchMedia = (q) =>
                      (q === '(prefers-contrast: more)'
                        ? { matches: true } : mmWas(q));
                    app._osContrastMQ.dispatchEvent(mkChg(true));
                    out.osContrastLiveSync = gz._ringOpacity === 1.0
                      && gz._ring.material.opacity === 1.0
                      && app.captionSystem.highContrast === true;
                    // forced-colors shares the same handler — the decision
                    // is an OR, so a flip on EITHER query applies it.
                    window.matchMedia = (q) =>
                      (q === '(forced-colors: active)'
                        ? { matches: true } : mmWas(q));
                    app._osForcedColorsMQ.dispatchEvent(mkChg(true));
                    out.osForcedColorsSync = gz._ringOpacity === 1.0
                      && app.captionSystem.highContrast === true;
                  } finally {
                    window.matchMedia = mmWas;
                    gz.setReducedMotion(rmWas);
                    gz.setHighContrast(hcWas === 1.0);
                    app.captionSystem.setHighContrast(ccHcWas);
                  }
                }
                // Accessibility section: the WCAG live-apply chain — stepper
                // +region selects must reach gazeInteraction/captionSystem
                // fields and toggles must reach their engines, not just flip
                // the persisted setting. 'Gaze Select' runs last: its OFF
                // state silences hover announces for every later probe.
                const selectPlus6 = (btn) => {
                  aimAt6(btn.localToWorld(btn.position.clone().set(0.34, 0, 0)));
                  app.updateSystems(0, fakeXrFrame, 0.016);
                  ctrl.dispatchEvent({ type: 'selectstart' });
                  ctrl.dispatchEvent({ type: 'selectend' });
                };
                const a11yWas = {
                  gazeDwellTime: app.settings.gazeDwellTime,
                  gazeGraceTime: app.settings.gazeGraceTime,
                  captionScale: app.settings.captionScale,
                  captionHeight: app.settings.captionHeight,
                  highContrast: app.settings.highContrast,
                  enableHaptics: app.settings.enableHaptics,
                  enableGazeDwell: app.settings.enableGazeDwell,
                };
                try {
                  const a11yTab = probeLabel6('Accessibility');
                  out.a11yTabProbe = !!a11yTab;
                  if (a11yTab) {
                    selectCenter6(a11yTab);
                    app.scene.updateMatrixWorld(true);
                    out.a11yTabOpen = !!probeLabel6('Gaze Time:');
                  }
                  if (app.gazeInteraction) {
                    const gtBtn = probeLabel6('Gaze Time:');
                    const dw0 = app.settings.gazeDwellTime;
                    if (gtBtn) {
                      selectPlus6(gtBtn);
                    }
                    out.gazeTimeApplied = !!gtBtn
                      && app.settings.gazeDwellTime !== dw0
                      && app.gazeInteraction.dwellTime === app.settings.gazeDwellTime;
                    const grBtn = probeLabel6('Grace Time:');
                    const gr0 = app.settings.gazeGraceTime;
                    if (grBtn) {
                      selectPlus6(grBtn);
                    }
                    out.graceTimeApplied = !!grBtn
                      && app.settings.gazeGraceTime !== gr0
                      && app.gazeInteraction.graceTime === app.settings.gazeGraceTime;
                  }
                  if (app.captionSystem) {
                    const csBtn = probeLabel6('Caption Size:');
                    const cs0 = app.settings.captionScale;
                    if (csBtn) {
                      selectPlus6(csBtn);
                    }
                    out.captionSizeApplied = !!csBtn
                      && app.settings.captionScale !== cs0
                      && app.captionSystem.scale === app.settings.captionScale;
                    const chBtn = probeLabel6('Caption Height:');
                    const ch0 = app.settings.captionHeight;
                    if (chBtn) {
                      selectPlus6(chBtn);
                    }
                    out.captionHeightApplied = !!chBtn
                      && app.settings.captionHeight !== ch0
                      && app.captionSystem.verticalOffset === app.settings.captionHeight;
                  }
                  const hcBtn = probeLabel6('High Contrast:');
                  if (hcBtn) {
                    selectCenter6(hcBtn);
                  }
                  out.hcApplied = !!hcBtn
                    && app.settings.highContrast === true
                    && (!app.captionSystem || app.captionSystem.highContrast === true)
                    && (!app.gazeInteraction || app.gazeInteraction._ringOpacity === 1.0);
                  const hpBtn = probeLabel6('Haptics:');
                  if (hpBtn) {
                    selectCenter6(hpBtn);
                  }
                  out.hapticsApplied = !!hpBtn
                    && app.settings.enableHaptics === false
                    && (!app.hapticFeedback || app.hapticFeedback.enabled === false);
                  const gzBtn = probeLabel6('Gaze Select:');
                  if (gzBtn) {
                    selectCenter6(gzBtn);
                  }
                  out.gazeToggleApplied = !!gzBtn
                    && app.settings.enableGazeDwell === false
                    && (!app.gazeInteraction || app.gazeInteraction.enabled === false);
                } finally {
                  for (const [k, v] of Object.entries(a11yWas)) {
                    app.updateSetting(k, v);
                  }
                  // updateSetting is persist-only — the engine flag the
                  // toggle flipped via its mesh onSelect needs restoring
                  // too or every later real-path pulse silently no-ops.
                  if (app.hapticFeedback) {
                    app.hapticFeedback.setEnabled(a11yWas.enableHaptics);
                  }
                }
                // Display + Audio & Media sections: the remaining live-apply
                // reaches — toggles must hit their engines (ffrSystem/tabManager/
                // windowManager/perfMonitorUI/textureManager), the Panel Dist
                // stepper windowManager.distance, Sound Volume spatialAudio's
                // master gain, and '360° Video' must open the keyboard and
                // route its one-shot confirm into immersiveVideo.play.
                const dispWas = {
                  enableFFR: app.settings.enableFFR,
                  enableCurvedPanel: app.settings.enableCurvedPanel,
                  enableWindowFollow: app.settings.enableWindowFollow,
                  enableHomeEnvironment: app.settings.enableHomeEnvironment,
                  enablePerfMonitorUI: app.settings.enablePerfMonitorUI,
                  enableTextureManager: app.settings.enableTextureManager,
                  windowDistance: app.settings.windowDistance,
                  masterVolume: app.settings.masterVolume,
                };
                const hadTexMgr = !!app.textureManager;
                const origVideoPlay = app.immersiveVideo && app.immersiveVideo.play;
                const videoCalls = [];
                try {
                  const dispTab = probeLabel6('Display');
                  out.displayTabProbe = !!dispTab;
                  if (dispTab) {
                    selectCenter6(dispTab);
                    app.scene.updateMatrixWorld(true);
                    out.displayTabOpen = !!probeLabel6('Panel Dist:');
                  }
                  const ffrBtn = probeLabel6('Foveation:');
                  let ffrCalls = 0;
                  if (ffrBtn && app.ffrSystem) {
                    const en0 = app.ffrSystem.enable;
                    const dis0 = app.ffrSystem.disable;
                    app.ffrSystem.enable = (...a) => { ffrCalls++; return en0.call(app.ffrSystem, ...a); };
                    app.ffrSystem.disable = (...a) => { ffrCalls++; return dis0.call(app.ffrSystem, ...a); };
                    selectCenter6(ffrBtn);
                    selectCenter6(ffrBtn);
                    app.ffrSystem.enable = en0;
                    app.ffrSystem.disable = dis0;
                  }
                  out.ffrApplied = !!ffrBtn && ffrCalls === 2
                    && app.settings.enableFFR === dispWas.enableFFR;
                  const curBtn = probeLabel6('Curved:');
                  if (curBtn) {
                    selectCenter6(curBtn);
                  }
                  out.curvedApplied = !!curBtn && app.tabManager
                    && app.tabManager._curved === app.settings.enableCurvedPanel;
                  const folBtn = probeLabel6('Follow View:');
                  if (folBtn) {
                    selectCenter6(folBtn);
                  }
                  out.followApplied = !!folBtn && app.windowManager
                    && app.windowManager.followMode === app.settings.enableWindowFollow;
                  const envBtn = probeLabel6('Home Environment:');
                  const env0 = app.settings.enableHomeEnvironment;
                  let envDir1 = false;
                  let envDir2 = false;
                  if (envBtn) {
                    selectCenter6(envBtn);
                    envDir1 = app.settings.enableHomeEnvironment
                      ? (app.homeEnvironment && app.homeEnvironment.parent === app.scene)
                      : (!app.homeEnvironment || app.homeEnvironment.parent !== app.scene);
                    selectCenter6(envBtn);
                    envDir2 = app.settings.enableHomeEnvironment
                      ? (app.homeEnvironment && app.homeEnvironment.parent === app.scene)
                      : (!app.homeEnvironment || app.homeEnvironment.parent !== app.scene);
                  }
                  out.homeEnvApplied = !!envBtn
                    && app.settings.enableHomeEnvironment === env0
                    && envDir1 && envDir2;
                  const perfBtn = probeLabel6('Perf Monitor:');
                  if (perfBtn) {
                    selectCenter6(perfBtn);
                  }
                  out.perfUIApplied = !!perfBtn
                    && app.settings.enablePerfMonitorUI === true
                    && !!app.perfMonitorUI && app.perfMonitorUI.visible === true;
                  const texBtn = probeLabel6('Texture Cache:');
                  if (texBtn) {
                    selectCenter6(texBtn);
                  }
                  out.texMgrApplied = !!texBtn
                    && app.settings.enableTextureManager === false
                    && app.textureManager === null;
                  if (app.windowManager) {
                    const pdBtn = probeLabel6('Panel Dist:');
                    const pd0 = app.settings.windowDistance;
                    if (pdBtn) {
                      selectPlus6(pdBtn);
                    }
                    out.panelDistApplied = !!pdBtn
                      && app.settings.windowDistance !== pd0
                      && app.windowManager.distance === app.settings.windowDistance;
                  }
                  const audTab = probeLabel6('Audio & Media');
                  out.audioTabProbe = !!audTab;
                  if (audTab) {
                    selectCenter6(audTab);
                    app.scene.updateMatrixWorld(true);
                    out.audioTabOpen = !!probeLabel6('Sound Volume:');
                  }
                  if (app.spatialAudio) {
                    const volBtn = probeLabel6('Sound Volume:');
                    const v0 = app.settings.masterVolume;
                    if (volBtn) {
                      selectPlus6(volBtn);
                    }
                    out.volumeApplied = !!volBtn
                      && app.settings.masterVolume !== v0
                      && Math.abs(app.spatialAudio.settings.masterVolume - app.settings.masterVolume / 100) < 1e-9;
                  }
                  const vidBtn = probeLabel6('360° Video');
                  out.video360Probe = !!vidBtn;
                  if (vidBtn && app.vrKeyboard && app.immersiveVideo) {
                    app.immersiveVideo.play = (u, f) => { videoCalls.push(u + '|' + f); };
                    selectCenter6(vidBtn);
                    const kbShown = app.vrKeyboard.visible === true
                      && !!app.vrKeyboard._onConfirmCallback;
                    if (app.vrKeyboard._onConfirmCallback) {
                      app.vrKeyboard.onTextConfirmed('https://v.example/clip.mp4');
                    }
                    out.video360Applied = kbShown;
                  }
                  out.video360Applied = !!vidBtn
                    && out.video360Applied === true
                    && videoCalls.length === 1
                    && videoCalls[0].startsWith('https://v.example/clip.mp4|');
                } finally {
                  for (const [k, v] of Object.entries(dispWas)) {
                    app.updateSetting(k, v);
                  }
                  if (!hadTexMgr && app.textureManager) {
                    app.textureManager.dispose();
                    app.textureManager = null;
                  }
                  if (app.immersiveVideo && origVideoPlay) {
                    app.immersiveVideo.play = origVideoPlay;
                  }
                  if (app.vrKeyboard) {
                    app.vrKeyboard.hide();
                  }
                  if (app.vrKeyboard) {
                    app.vrKeyboard._onConfirmCallback = null;
                  }
                }
              // TextureManager internals leg — the display leg left
              // app.textureManager null, so re-enable the real toggle to
              // mint fresh instances off its class: cache-hit LRU recency,
              // in-flight pendingLoads dedup, re-cache accounting, prune
              // eviction order, pre-dispose size estimate, the shared
              // error-texture placeholder, and dispose() teardown.
              if (ctrl) {
                const openSecs3 = app.settings.openSettingsSections || [];
                if (!openSecs3.includes('settings.section.display')) {
                  const dTab3 = probeLabel6('Display');
                  if (dTab3) {
                    selectCenter6(dTab3);
                    app.scene.updateMatrixWorld(true);
                  }
                }
                const texBtn3 = probeLabel6('Texture Cache:');
                const texWas = app.settings.enableTextureManager;
                if (texBtn3 && !app.textureManager) {
                  // The display leg's updateSetting restore persists
                  // enableTextureManager=true but never re-applies, so the
                  // app sits at "setting on + manager null". A select would
                  // toggle ON→OFF; call the button's onSelect directly and
                  // repeat until parity restores the manager.
                  texBtn3.userData.interactable.onSelect({});
                  if (!app.textureManager) {
                    texBtn3.userData.interactable.onSelect({});
                  }
                }
                const TMC = app.textureManager && app.textureManager.constructor;
                if (TMC) {
                  const fakeR = { capabilities: { getMaxAnisotropy: () => 8 } };
                  const mkTex = (w, h) => ({
                    image: { width: w, height: h },
                    dispose() { this.disposed = (this.disposed || 0) + 1; }
                  });
                  try {
                    // Hit path: identical texture returned, one loader call,
                    // and the hit re-inserts at the LRU tail.
                    const tmA = new TMC(fakeR);
                    const texA = mkTex(10, 10);
                    let loaderCalls = 0;
                    tmA.textureLoader.load =
                      (u, onLoad) => { loaderCalls++; onLoad(texA); };
                    const l1 = await tmA.loadTexture('u1');
                    const l2 = await tmA.loadTexture('u1');
                    out.texCacheHit = l1 === texA && l2 === texA
                      && tmA.stats.cacheMisses === 1
                      && tmA.stats.cacheHits === 1
                      && loaderCalls === 1;
                    tmA.dispose();
                    // Concurrent same-URL loads share one in-flight promise —
                    // a second caller neither refetches nor double-counts.
                    const tmB = new TMC(fakeR);
                    let releaseLoad;
                    let loadCallsB = 0;
                    tmB.textureLoader.load = (u, onLoad) => {
                      loadCallsB++;
                      releaseLoad = () => onLoad(texA);
                    };
                    const p1 = tmB.loadTexture('u2');
                    const p2 = tmB.loadTexture('u2');
                    // Async fn wrappers re-wrap, so promise identity can't be
                    // observed — the dedup contract is one pending entry and
                    // one underlying load for two concurrent callers.
                    const sharedInflight = tmB.pendingLoads.size === 1
                      && loadCallsB === 1;
                    releaseLoad();
                    const [r1, r2] = await Promise.all([p1, p2]);
                    out.texPendingDedup = sharedInflight
                      && r1 === texA && r2 === texA
                      && tmB.stats.cacheMisses === 1
                      && tmB.pendingLoads.size === 0;
                    tmB.dispose();
                    // Re-caching a live URL evicts the old texture first so
                    // textureCount/estimatedBytes stay exact.
                    const tmC = new TMC(fakeR);
                    const t1 = mkTex(10, 10);
                    const t2 = mkTex(10, 10);
                    tmC.cacheTexture('x', t1);
                    tmC.cacheTexture('x', t2);
                    out.texRecacheExact = t1.disposed === 1
                      && tmC.memoryUsage.textureCount === 1
                      && tmC.memoryUsage.estimatedBytes === 400;
                    tmC.dispose();
                    // LRU: a hit moves the entry to the tail — on prune the
                    // refreshed entry survives while older ones evict first.
                    const tmL = new TMC(fakeR);
                    tmL.memoryUsage.maxBytes = 1400;
                    const a = mkTex(10, 10), b = mkTex(10, 10);
                    const c = mkTex(10, 10), d = mkTex(10, 10);
                    tmL.cacheTexture('a', a);
                    tmL.cacheTexture('b', b);
                    tmL.cacheTexture('c', c);
                    tmL.textureLoader.load = (u, onLoad) => onLoad(a);
                    await tmL.loadTexture('a'); // hit → order [b,c,a]
                    tmL.cacheTexture('d', d);   // over cap → prune b,c
                    out.texLruOrder = !a.disposed
                      && b.disposed === 1 && c.disposed === 1
                      && tmL.textureCache.size === 2
                      && tmL.textureCache.has('a')
                      && tmL.textureCache.has('d');
                    tmL.dispose();
                    // unloadTexture must estimate BEFORE dispose() — a
                    // dispose that clears texture.image would under-count.
                    const tmU = new TMC(fakeR);
                    const wipe = { image: { width: 10, height: 10 },
                      dispose() { this.image = null; } };
                    tmU.cacheTexture('w', wipe);
                    tmU.unloadTexture('w');
                    out.texUnloadPreDispose =
                      tmU.memoryUsage.estimatedBytes === 0
                      && tmU.memoryUsage.textureCount === 0;
                    tmU.dispose();
                    // Failed loads share ONE placeholder texture — a fresh
                    // CanvasTexture per failure would leak GPU memory (the
                    // texture never enters the countable cache).
                    const tmE = new TMC(fakeR);
                    const origErr2 = console.error;
                    console.error = () => {};
                    let e1, e2;
                    try {
                      tmE.textureLoader.load =
                        (u, ok, p, err) => err(new Error('bad'));
                      e1 = await tmE.loadTexture('bad1');
                      e2 = await tmE.loadTexture('bad2');
                    } finally {
                      console.error = origErr2;
                    }
                    tmE.dispose();
                    out.texErrorShared = !!e1 && e1 === e2
                      && tmE._errorTexture === null;
                    // unloadAll disposes every cached texture and zeroes
                    // the accounting.
                    const tmD = new TMC(fakeR);
                    const d1 = mkTex(10, 10), d2 = mkTex(10, 10);
                    tmD.cacheTexture('d1', d1);
                    tmD.cacheTexture('d2', d2);
                    tmD.unloadAll();
                    out.texDisposeAll = d1.disposed === 1 && d2.disposed === 1
                      && tmD.textureCache.size === 0
                      && tmD.memoryUsage.textureCount === 0
                      && tmD.memoryUsage.estimatedBytes === 0;
                  } finally {
                    // Restore the stale pre-leg state: persisted setting
                    // value with no live manager instance.
                    if (app.textureManager) {
                      app.textureManager.dispose();
                      app.textureManager = null;
                    }
                    app.updateSetting('enableTextureManager', texWas);
                  }
                }
              }
              // VR keyboard real-key leg — the 3D keyboard's key meshes are
              // real registered interactables: a controller-ray select routes
              // to onKeyPress(label) → ime.processInput / deleteLast /
              // confirmSelection → onTextConfirmed → _onConfirmCallback.
              // The whole URL-entry path a headset user actually takes; only
              // the programmatic onTextConfirmed arm had been pinned.
              if (ctrl && app.settingsPanel && app.vrKeyboard
                && app.japaneseIME && app.immersiveVideo) {
                const origPlay3 = app.immersiveVideo.play;
                const videoCalls3 = [];
                const kbVisWas = app.vrKeyboard.visible;
                try {
                  // The audio section is still open from the display leg —
                  // re-selecting its tab would close it. Only select when
                  // closed.
                  if (!(app.settings.openSettingsSections || [])
                    .includes('settings.section.audio')) {
                    const audTab2 = probeLabel6('Audio & Media');
                    if (audTab2) {
                      selectCenter6(audTab2);
                      app.scene.updateMatrixWorld(true);
                    }
                  }
                  out.kbTabProbe = (app.settings.openSettingsSections || [])
                    .includes('settings.section.audio');
                  const vidBtn3 = probeLabel6('360° Video');
                  out.kbActionProbe = !!vidBtn3;
                  app.immersiveVideo.play = (u, f) => {
                    videoCalls3.push(u + '|' + f);
                  };
                  if (vidBtn3) {
                    selectCenter6(vidBtn3);
                  }
                  out.kbOpens = app.vrKeyboard.visible === true
                    && typeof app.vrKeyboard._onConfirmCallback === 'function';
                  app.scene.updateMatrixWorld(true);
                  const pressKey6 = async (label) => {
                    const km = (app.vrKeyboard.keyMeshes || [])
                      .find((k) => k.label === label);
                    if (!km) { return false; }
                    selectCenter6(km.mesh);
                    await new Promise((r) => setTimeout(r, 30));
                    return true;
                  };
                  const ime2 = app.japaneseIME;
                  const uOk = await pressKey6('u');
                  const rOk = await pressKey6('r');
                  const lOk = await pressKey6('l');
                  out.kbTypes = uOk && rOk && lOk
                    && ime2.compositionBuffer === 'url';
                  const backOk = await pressKey6('back');
                  out.kbBackspaces = backOk
                    && ime2.compositionBuffer === 'ur';
                  const enterOk = await pressKey6('enter');
                  out.kbConfirms = enterOk
                    && app.vrKeyboard.visible === false
                    && app.vrKeyboard._onConfirmCallback === null
                    && videoCalls3.length === 1
                    && videoCalls3[0].startsWith('ur|');
                  // Second open → 'esc' dismiss: hides, cancels with a
                  // caption (WCAG 4.1.3), and never reaches the callback.
                  if (vidBtn3) {
                    selectCenter6(vidBtn3);
                    app.scene.updateMatrixWorld(true);
                  }
                  const capsBefore = locoCaps.length;
                  const escOk = app.vrKeyboard.visible === true
                    && await pressKey6('esc');
                  out.kbEscDismisses = escOk
                    && app.vrKeyboard.visible === false
                    && videoCalls3.length === 1
                    && locoCaps.slice(capsBefore)
                      .some((t2) => t2.includes('Keyboard cancelled'));
                } finally {
                  app.immersiveVideo.play = origPlay3;
                  if (app.vrKeyboard) {
                    app.vrKeyboard.hide();
                    app.vrKeyboard._onConfirmCallback = null;
                  }
                  if (kbVisWas) {
                    app.vrKeyboard.show();
                  }
                }
              }
              // IME hiragana leg — the flagship Japanese input chain, never
              // driven e2e: 'かな' key → hiragana mode, romaji keystrokes
              // convert for display, '変換' converts + builds the candidate
              // row (real registered interactables), and a candidate ray
              // select commits straight to onTextConfirmed. The candidate
              // fetch is pointed at the offline dictionary so the leg is
              // deterministic headless; the converted-hiragana ARGUMENT the
              // app hands the lookup is what gets asserted.
              if (ctrl && app.settingsPanel && app.vrKeyboard
                && app.japaneseIME && app.immersiveVideo) {
                const origPlay4 = app.immersiveVideo.play;
                const videoCalls4 = [];
                const kbVisWas2 = app.vrKeyboard.visible;
                const origGetK = app.japaneseIME.getKanjiCandidates;
                const convArgs = [];
                try {
                  if (!(app.settings.openSettingsSections || [])
                    .includes('settings.section.audio')) {
                    const audTab3 = probeLabel6('Audio & Media');
                    if (audTab3) {
                      selectCenter6(audTab3);
                      app.scene.updateMatrixWorld(true);
                    }
                  }
                  const vidBtn4 = probeLabel6('360° Video');
                  app.immersiveVideo.play = (u, f) => {
                    videoCalls4.push(u + '|' + f);
                  };
                  if (vidBtn4) {
                    selectCenter6(vidBtn4);
                  }
                  app.scene.updateMatrixWorld(true);
                  const pressKey7 = async (label) => {
                    const km = (app.vrKeyboard.keyMeshes || [])
                      .find((k) => k.label === label);
                    if (!km) { return false; }
                    selectCenter6(km.mesh);
                    await new Promise((r) => setTimeout(r, 30));
                    return true;
                  };
                  const ime3 = app.japaneseIME;
                  const kanaOk = await pressKey7('かな');
                  out.imeHiraganaMode = kanaOk
                    && ime3.inputMode === 'hiragana';
                  let typeOk = true;
                  for (const ch of ['k', 'o', 'n', 'n', 'i', 't', 'i', 'h', 'a']) {
                    typeOk = await pressKey7(ch) && typeOk;
                  }
                  out.imeRomajiTypes = typeOk
                    && ime3.compositionBuffer === 'konnitiha'
                    && ime3.inputMode === 'hiragana';
                  ime3.getKanjiCandidates = async (h) => {
                    convArgs.push(h);
                    return ime3.getOfflineKanjiCandidates(h);
                  };
                  const henkanOk = await pressKey7('変換');
                  out.imeHenkanArgs = henkanOk
                    && convArgs.length === 1
                    && convArgs[0] === 'こんにちは';
                  out.imeCandidateRow = henkanOk
                    && (ime3.candidates || []).length > 0
                    && (app.vrKeyboard._candidateMeshes || []).length
                      === ime3.candidates.length
                    && app.vrKeyboard._candidatesGroup
                    && app.vrKeyboard._candidatesGroup.visible === true;
                  const cm = (app.vrKeyboard._candidateMeshes || [])[0];
                  if (cm) {
                    selectCenter6(cm.mesh);
                    await new Promise((r) => setTimeout(r, 30));
                  }
                  out.imeCandidateConfirm = !!cm
                    && videoCalls4.length === 1
                    && videoCalls4[0].startsWith('今日は|')
                    && app.vrKeyboard.visible === false
                    && (app.vrKeyboard._candidateMeshes || []).length === 0;
                } finally {
                  app.japaneseIME.getKanjiCandidates = origGetK;
                  app.immersiveVideo.play = origPlay4;
                  if (app.vrKeyboard) {
                    app.vrKeyboard.hide();
                    app.vrKeyboard._onConfirmCallback = null;
                  }
                  if (kbVisWas2) {
                    app.vrKeyboard.show();
                  }
                }
              }
              // IME internals leg — the defensive arms never reached by key
              // presses: switchMode rejects unknown names, selectCandidate
              // clamps out-of-range indexes, the stale-buffer guard discards
              // kanji results that outlived further typing, deleteLast is a
              // no-op on an empty buffer, and confirmSelection falls back to
              // the raw buffer when no candidates exist.
              if (app.japaneseIME) {
                const ime4 = app.japaneseIME;
                const getK4 = ime4.getKanjiCandidates;
                ime4.clear();
                try {
                  out.imeModeReject = ime4.switchMode('bogus') === false
                    && ime4.inputMode === 'hiragana'
                    && ime4.switchMode('ascii') === true
                    && ime4.inputMode === 'ascii'
                    && ime4.switchMode('hiragana') === true;
                  // Controlled candidates for the boundary arm.
                  ime4.getKanjiCandidates = async () => ['甲', '乙', '丙'];
                  ime4.compositionBuffer = 'kou';
                  await ime4.convertToKanji();
                  const selOk = ime4.selectCandidate(-1) === null
                    && ime4.selectCandidate(99) === null
                    && ime4.selectedIndex === 0
                    && ime4.selectCandidate(2) === '丙'
                    && ime4.selectedIndex === 2;
                  out.imeSelectBounds = selOk === true;
                  // Stale-buffer guard: while the async conversion is in
                  // flight the user keeps typing — the late result must be
                  // discarded rather than commit a kanji for a buffer that
                  // no longer exists.
                  ime4.clear();
                  // Set the mode directly — the && chain above short-
                  // circuits under a red-verify cut, so the mode the chain
                  // would restore cannot be relied on here.
                  ime4.inputMode = 'hiragana';
                  ime4.compositionBuffer = 'ka';
                  const pending = ime4.convertToKanji();
                  ime4.compositionBuffer = 'kanji';
                  const staleRes = await pending;
                  out.imeStaleKanji = staleRes === null
                    && (ime4.candidates || []).length === 0
                    && ime4.compositionBuffer === 'kanji';
                  // Empty-buffer delete is a no-op; after typing it removes
                  // one raw char; clear() resets every field.
                  ime4.clear();
                  const emptyDel = ime4.deleteLast();
                  ime4.compositionBuffer = 'ka';
                  const midDel = ime4.deleteLast();
                  ime4.clear();
                  out.imeDeleteClear = emptyDel.raw === ''
                    && midDel.raw === 'k'
                    && ime4.compositionBuffer === ''
                    && (ime4.candidates || []).length === 0
                    && ime4.selectedIndex === 0;
                  // No candidates → confirm returns the raw buffer itself.
                  ime4.clear();
                  ime4.compositionBuffer = 'xyz';
                  const fb = ime4.confirmSelection();
                  out.imeConfirmFallback = fb === 'xyz'
                    && ime4.compositionBuffer === ''
                    && ime4.selectedIndex === 0;
                } finally {
                  ime4.getKanjiCandidates = getK4;
                  ime4.clear();
                  ime4.inputMode = 'hiragana';
                }
              }
              // URL suggestion leg — every keystroke runs _updateSuggestions
              // → bookmarks.search (frecency) → showSuggestions builds real
              // interactable _suggestionMeshes; hover announces the FULL
              // destination URL (WCAG 1.3.3); a ray select clears the buffer
              // and routes onTextConfirmed(entry.url). Deterministic via a
              // seeded BookmarkStore history entry.
              if (ctrl && app.settingsPanel && app.vrKeyboard
                && app.japaneseIME && app.immersiveVideo && app.bookmarks) {
                const origPlay5 = app.immersiveVideo.play;
                const videoCalls5 = [];
                const kbVisWas3 = app.vrKeyboard.visible;
                const gazeWas5 = app.settings.enableGazeDwell;
                const SUG_URL = 'https://suggest-seed.example/clip';
                try {
                  app.settings.enableGazeDwell = true;
                  app.bookmarks.addHistory(SUG_URL, 'suggest seed');
                  if (!(app.settings.openSettingsSections || [])
                    .includes('settings.section.audio')) {
                    const audTab4 = probeLabel6('Audio & Media');
                    if (audTab4) {
                      selectCenter6(audTab4);
                      app.scene.updateMatrixWorld(true);
                    }
                  }
                  const vidBtn5 = probeLabel6('360° Video');
                  out.sugActionProbe = !!vidBtn5;
                  app.immersiveVideo.play = (u, f) => {
                    videoCalls5.push(u + '|' + f);
                  };
                  if (vidBtn5) {
                    selectCenter6(vidBtn5);
                  }
                  app.scene.updateMatrixWorld(true);
                  const pressKey8 = async (label) => {
                    const km = (app.vrKeyboard.keyMeshes || [])
                      .find((k) => k.label === label);
                    if (!km) { return false; }
                    selectCenter6(km.mesh);
                    await new Promise((r) => setTimeout(r, 30));
                    return true;
                  };
                  // Under-2-char gate: a single keystroke builds no row.
                  const s1 = await pressKey8('s');
                  out.sugMinChars = s1
                    && (app.vrKeyboard._suggestionMeshes || []).length === 0;
                  const s2 = await pressKey8('u');
                  out.sugRowBuilds = s2
                    && (app.vrKeyboard._suggestionMeshes || []).length > 0
                    && app.vrKeyboard._suggestionsGroup
                    && app.vrKeyboard._suggestionsGroup.visible === true;
                  // Hover announces the full destination URL (WCAG 1.3.3).
                  const capsBefore3 = locoCaps.length;
                  const sm = (app.vrKeyboard._suggestionMeshes || [])[0];
                  if (sm) {
                    aimAt6(sm.mesh.getWorldPosition(sm.mesh.position.clone()));
                    app.updateSystems(0, fakeXrFrame, 0.016);
                  }
                  out.sugHoverUrl = !!sm
                    && locoCaps.slice(capsBefore3)
                      .some((t3) => t3.includes('suggest-seed.example'));
                  // Ray select clears the composition and routes the URL.
                  if (sm) {
                    selectCenter6(sm.mesh);
                    await new Promise((r) => setTimeout(r, 30));
                  }
                  out.sugSelectConfirms = !!sm
                    && videoCalls5.length === 1
                    && videoCalls5[0].startsWith(SUG_URL + '|')
                    && app.vrKeyboard.visible === false
                    && app.japaneseIME.compositionBuffer === '';
                } finally {
                  if (app.bookmarks && app.bookmarks.removeHistory) {
                    try { app.bookmarks.removeHistory(SUG_URL); } catch (e) { /* cleanup */ }
                  }
                  app.settings.enableGazeDwell = gazeWas5;
                  app.immersiveVideo.play = origPlay5;
                  if (app.vrKeyboard) {
                    app.vrKeyboard.hide();
                    app.vrKeyboard._onConfirmCallback = null;
                  }
                  if (kbVisWas3) {
                    app.vrKeyboard.show();
                  }
                }
              }
              // Browsing toggles leg — the remaining browsing-section
              // controls: 'Private Mode' flips settings.privateMode which
              // VRApp.navigate() reads live (a private session writes no
              // history); 'Web Browser Panel' runs _onWebPanelToggleChanged
              // → _teardownBrowsingSystems (tabManager/webPanel disposed)
              // → _buildBrowsingSystems on re-enable; 'Voice Commands'
              // lazily _initVoiceCommands — the SpeechRecognition-absent
              // branch is forced deterministically by blanking the globals.
              if (ctrl && app.settingsPanel && app.bookmarks) {
                const privWas = app.settings.privateMode;
                const webWas = app.settings.enableWebPanel;
                const voiceWas = app.settings.enableVoice;
                const voiceCmdWas = app.voiceCommands;
                const srWas = window.SpeechRecognition;
                const wsrWas = window.webkitSpeechRecognition;
                const capsBefore4 = locoCaps.length;
                try {
                  if (!(app.settings.openSettingsSections || [])
                    .includes('settings.section.browsing')) {
                    const brTab = probeLabel6('Browsing');
                    if (brTab) {
                      selectCenter6(brTab);
                      app.scene.updateMatrixWorld(true);
                    }
                  }
                  const privBtn = probeLabel6('Private Mode');
                  const webBtn = probeLabel6('Web Browser Panel');
                  const voiceBtn = probeLabel6('Voice Commands');
                  out.brwProbe = !!(privBtn && webBtn && voiceBtn);
                  // Private mode — navigate() records nothing while on.
                  if (privBtn) {
                    selectCenter6(privBtn);
                    app.navigate('https://priv-leg.example/', 'priv');
                    const leaked = app.bookmarks
                      .search('priv-leg.example', 5, Date.now());
                    out.privateBlocks = app.settings.privateMode === true
                      && leaked.length === 0;
                    selectCenter6(privBtn);
                    app.navigate('https://priv-leg.example/', 'priv');
                    const recorded = app.bookmarks
                      .search('priv-leg.example', 5, Date.now());
                    out.privateRestores = app.settings.privateMode === false
                      && recorded.length > 0;
                    app.bookmarks.removeHistory('https://priv-leg.example/');
                  }
                  // Web panel — off tears down, on rebuilds browsing systems.
                  if (webBtn) {
                    selectCenter6(webBtn);
                    const offToast = locoCaps.slice(capsBefore4)
                      .some((t3) => t3.includes('Browsing panel closed'));
                    out.webPanelTearsDown = app.settings.enableWebPanel === false
                      && app.tabManager === null
                      && app.webPanel === null
                      && offToast;
                    selectCenter6(webBtn);
                    out.webPanelRebuilds = app.settings.enableWebPanel === true
                      && !!app.tabManager && !!app.webPanel
                      && locoCaps.slice(capsBefore4)
                        .some((t3) => t3.includes('Browsing panel enabled'));
                    app.scene.updateMatrixWorld(true);
                  }
                  // Voice — blank the globals to force the warn branch.
                  // Normalize the flag first: an earlier leg leaves
                  // enableVoice=true (+ a live recognizer), so the first
                  // select would toggle OFF instead of ON.
                  app.settings.enableVoice = false;
                  window.SpeechRecognition = undefined;
                  window.webkitSpeechRecognition = undefined;
                  if (voiceBtn) {
                    const capsBefore5 = locoCaps.length;
                    selectCenter6(voiceBtn);
                    await new Promise((r) => setTimeout(r, 150));
                    out.voiceWarn = app.settings.enableVoice === true
                      && app.voiceCommands === null
                      && locoCaps.slice(capsBefore5)
                        .some((t3) => t3
                          .includes('Voice commands temporarily unavailable'));
                    selectCenter6(voiceBtn);
                    await new Promise((r) => setTimeout(r, 30));
                    out.voiceTogglesOff = app.settings.enableVoice === false
                      && app.voiceCommands === null
                      && locoCaps.slice(capsBefore5)
                        .some((t3) => t3.includes('Voice commands disabled'));
                  }
                } finally {
                  window.SpeechRecognition = srWas;
                  window.webkitSpeechRecognition = wsrWas;
                  if (app.settings.privateMode !== privWas) {
                    app.settings.privateMode = privWas;
                  }
                  if (app.settings.enableVoice !== voiceWas) {
                    app.settings.enableVoice = voiceWas;
                  }
                  if (voiceWas && voiceCmdWas && !app.voiceCommands
                    && typeof app._initVoiceCommands === 'function') {
                    try { await app._initVoiceCommands(); } catch (e) { /* restore */ }
                  }
                  if (app.settings.enableWebPanel !== webWas) {
                    if (webWas) {
                      app._onWebPanelToggleChanged(true);
                    } else {
                      app._teardownBrowsingSystems();
                    }
                    app.settings.enableWebPanel = webWas;
                  } else if (webWas && !app.tabManager) {
                    app._onWebPanelToggleChanged(true);
                  }
                  app.scene.updateMatrixWorld(true);
                }
              }
              // BookmarkPanel leg — the panel is ONE canvas interactable:
              // _onSelect maps the ray∩plane point through UV→pixel geometry
              // (bookmarkLayout hitTest) into close / tab / scroll / row /
              // deleteRow actions. selectPx aims the controller ray through
              // the world-space point for a target canvas pixel.
              if (ctrl && app.bookmarkPanel && app.bookmarks && app.scene) {
                const bm = app.bookmarkPanel;
                const bmModeWas = bm.mode;
                const bmVisWas = bm.visible;
                const BM_URL = 'https://bm-seed.example/page';
                const selectPx = async (px, py) => {
                  // No THREE in eval scope — clone an existing Vector3.
                  const local = bm.mesh.position.clone().set(
                    (px / 1024 - 0.5) * bm.panelW,
                    (0.5 - py / 768) * bm.panelH, 0);
                  const pt = bm.mesh.localToWorld(local);
                  aimAt6(pt);
                  app.updateSystems(0, fakeXrFrame, 0.016);
                  ctrl.dispatchEvent({ type: 'selectstart' });
                  ctrl.dispatchEvent({ type: 'selectend' });
                  await new Promise((r) => setTimeout(r, 20));
                };
                try {
                  app.bookmarks.addBookmark(BM_URL, 'bm seed');
                  for (let i = 0; i < 12; i++) {
                    app.bookmarks.addHistory(
                      'https://bmh-seed.example/h' + i, 'h' + i);
                  }
                  bm.show();
                  app.scene.updateMatrixWorld(true);
                  out.bmPanelProbe = bm.visible === true
                    && bm.mesh.visible === true;
                  // History tab (header px 220..440) — mode + tab caption.
                  const capsBefore6 = locoCaps.length;
                  await selectPx(330, 48);
                  out.bmTabSwitch = bm.mode === 'history'
                    && locoCaps.slice(capsBefore6)
                      .some((t3) => t3.includes('History'));
                  // Delete zone (px > 1024-64) on row 0 → removeHistory +
                  // 'History entry deleted' + haptic.
                  const delTarget = bm._rows()[0];
                  const capsBefore7 = locoCaps.length;
                  await selectPx(990, 96 + 36);
                  out.bmRowDelete = !!delTarget
                    && app.bookmarks.search(delTarget.url, 5).length === 0
                    && locoCaps.slice(capsBefore7)
                      .some((t3) => t3.includes('History entry deleted'));
                  // Scroll zone (header px 660..820) — 11+ rows remain.
                  await selectPx(740, 48);
                  out.bmScrolls = bm.scrollOffset === 1;
                  // Back to bookmarks tab — mode + caption.
                  await selectPx(110, 48);
                  out.bmTabBack = bm.mode === 'bookmarks'
                    && locoCaps.some((t3) => t3.includes('Bookmarks'));
                  // Row select is pick-and-close: it routes the URL through
                  // onSelect → active.navigate + 'Loading' caption, then the
                  // panel hides — so it runs LAST of the row interactions.
                  const row0 = bm._rows()[0];
                  const active0 = app.tabManager
                    ? app.tabManager.getActiveTab() : null;
                  const capsBefore8 = locoCaps.length;
                  await selectPx(300, 96 + 36);
                  out.bmRowNavigates = !!row0 && !!active0
                    && active0.currentUrl === row0.url
                    && bm.visible === false
                    && locoCaps.slice(capsBefore8)
                      .some((t3) => t3.includes('Loading'));
                  // Close button (header right 96px) — hide + caption.
                  bm.show();
                  app.scene.updateMatrixWorld(true);
                  const capsBefore9 = locoCaps.length;
                  await selectPx(990, 48);
                  out.bmClose = bm.visible === false
                    && locoCaps.slice(capsBefore9)
                      .some((t3) => t3.includes('Bookmarks: closed'));
                } finally {
                  if (app.bookmarks.removeBookmark) {
                    try { app.bookmarks.removeBookmark(BM_URL); } catch (e) { /* cleanup */ }
                  }
                  if (app.bookmarks.removeHistory) {
                    for (let i = 0; i < 12; i++) {
                      try {
                        app.bookmarks.removeHistory(
                          'https://bmh-seed.example/h' + i);
                      } catch (e) { /* cleanup */ }
                    }
                  }
                  if (bm) {
                    if (bmModeWas && bm.setMode) { bm.setMode(bmModeWas); }
                    if (!bmVisWas && bm.visible) { bm.hide(); }
                  }
                  app.scene.updateMatrixWorld(true);
                }
              }
              // CaptionSystem internals — show() queues, update() sweeps
              // expired lines, _durationFor scales hold by reading time
              // (WCAG 2.2.1: 4 CPS fullwidth / 17 CPS halfwidth, 3x cap),
              // and the disabled gate never queues (#231).
              const capSys = app.captionSystem;
              if (capSys && capSys.mesh) {
                const capEnabledWas = capSys.enabled;
                const capDurWas = capSys.lineDuration;
                try {
                  // Earlier legs stub captionSystem.show into a caption-log
                  // spy (never queues _lines) — bind the prototype method
                  // directly so the queue/sweep logic runs for real.
                  const capShow = (t2) =>
                    Object.getPrototypeOf(capSys).show.call(capSys, t2);
                  capSys.clear(); capSys.setEnabled(true);
                  // Aging sweep: line holds, partial dt subtracts, expiry
                  // removes and flips mesh.visible off when queue empties.
                  capShow('__cap_aging');
                  const rem0 = capSys._lines[0].remaining;
                  capSys.update(10);
                  const remMid = capSys._lines[0] && capSys._lines[0].remaining;
                  capSys.update(rem0);
                  out.capAgingSweep = rem0 > 0 && remMid === rem0 - 10
                    && capSys._lines.length === 0
                    && capSys.mesh.visible === false;
                  // Reading-time floor: 40 fullwidth chars needs ~10 s at
                  // 4 CPS, far above a 2000ms floor but under the 3x cap.
                  capSys.setLineDuration(2000);
                  capShow('これはキャプションキューの読書時間を検証するための長い全角文字列です');
                  const remJa = capSys._lines[0].remaining;
                  capShow('ok');
                  const remLat = capSys._lines[1].remaining;
                  out.capReadingFloor = remJa > 2000 && remJa <= 6000
                    && remLat === 2000;
                  // Queue rules: maxLines shift drops oldest, disabled
                  // show() queues nothing (#231), NFD normalises to NFC.
                  capSys.setEnabled(true);
                  ['q1','q2','q3','q4'].forEach((t2) => capShow(t2));
                  const shiftOk = capSys._lines.length === capSys.maxLines
                    && capSys._lines[0].text === 'q2';
                  capSys.setEnabled(false);
                  capShow('__hidden');
                  const noQueue = capSys._lines.every((l) => l.text !== '__hidden');
                  capSys.setEnabled(true);
                  capShow('が'.normalize('NFD'));
                  const nfc = capSys._lines[capSys._lines.length - 1].text
                    === 'が'.normalize('NFC');
                  out.capQueueRules = shiftOk && noQueue && nfc;
                } finally {
                  capSys.setLineDuration(capDurWas);
                  capSys.setEnabled(capEnabledWas);
                  capSys.clear();
                }
              }
              // ImmersiveVideo HUD leg — play() builds sphere meshes plus a
              // camera-parented HUD whose two canvas buttons are registered
              // interactables; the exit button's onSelect routes stop() which
              // unregisters + disposes every HUD mesh, removes the spheres,
              // and clears _eyeTextures — the full teardown contract.
              if (ctrl && app.immersiveVideo && app.scene && app.interactables) {
                const iv = app.immersiveVideo;
                try {
                  iv.play('https://vid-seed.example/clip.mp4',
                    { projection: '360', layout: 'mono' });
                  app.scene.updateMatrixWorld(true);
                  const btns = iv.controlPanel
                    ? iv.controlPanel.children.slice() : [];
                  out.vidHudProbe = iv.active === true
                    && btns.length === 2
                    && btns.every((b) => app.interactables.includes(b));
                  // Aim at the exit button (x=+0.3 in the HUD group).
                  const exitBtn = btns.find(
                    (b) => b.position && b.position.x > 0);
                  const meshCount = iv.meshes.length;
                  if (exitBtn) {
                    selectCenter6(exitBtn);
                    await new Promise((r) => setTimeout(r, 20));
                  }
                  out.vidExitStops = !!exitBtn
                    && iv.active === false
                    && iv.meshes.length === 0
                    && iv.controlPanel === null
                    && btns.every((b) => !app.interactables.includes(b))
                    && meshCount > 0
                    && iv.meshes.every((m) => !m.parent);
                  // stop() must also detach the video element listeners it
                  // set up — a second play/stop cycle stays clean.
                  iv.play('https://vid-seed.example/clip2.mp4',
                    { projection: '180', layout: 'mono' });
                  app.scene.updateMatrixWorld(true);
                  const restarted = iv.active === true;
                  // Pause arm — the real Pause HUD button (x=-0.3) routes
                  // onSelect → togglePause → video.pause() + playing=false +
                  // onPlaybackChange('paused'). this.video is a plain field:
                  // swap in a stub element so the else arm is deterministic
                  // (headless media state is unreliable — the real element's
                  // paused flag does not reflect the DOM path here).
                  const pauseBtn = iv.controlPanel
                    ? iv.controlPanel.children.find(
                      (b) => b.position && b.position.x < 0) : null;
                  let pbcState = null;
                  const origPbc = iv.onPlaybackChange;
                  const vidWas = iv.video;
                  let pauseCalls = 0;
                  let tpWas = null;
                  try {
                    iv.video = {
                      paused: false,
                      pause: () => { pauseCalls++; },
                      play: () => Promise.resolve()
                    };
                    iv.playing = true;
                    iv.onPlaybackChange = (st) => { pbcState = st; };
                    // This leg runs inside the session-leg's togglePause/stop
                    // stub window — point at the real method for the pin and
                    // put the stub back in finally so later checks in the
                    // window still see their counter.
                    tpWas = iv.togglePause;
                    iv.togglePause = Object.getPrototypeOf(iv).togglePause;
                    if (pauseBtn) {
                      selectCenter6(pauseBtn);
                      await new Promise((r) => setTimeout(r, 20));
                    }
                  } finally {
                    iv.togglePause = tpWas;
                    iv.video = vidWas;
                    iv.onPlaybackChange = origPbc;
                  }
                  out.vidPauseToggles = !!pauseBtn
                    && pauseCalls === 1
                    && iv.playing === false
                    && pbcState === 'paused';
                  // 'playing' listener arm: the real bound listener flips
                  // playing=true, rewrites the HUD label to 'Pause', and
                  // notifies onPlaybackChange — the resume path's entire
                  // state contract (togglePause deliberately does none of
                  // this eagerly).
                  const lbCalls = [];
                  const lbWas = iv._playPauseBtn
                    ? iv._playPauseBtn.userData.setLabel : null;
                  try {
                    if (iv._playPauseBtn) {
                      iv._playPauseBtn.userData.setLabel =
                        (l) => { lbCalls.push(l); };
                    }
                    pbcState = null;
                    iv.onPlaybackChange = (st) => { pbcState = st; };
                    iv.playing = false;
                    iv._onVideoPlaying();
                    out.vidPlayingListener = iv.playing === true
                      && lbCalls.length === 1
                      && pbcState === 'playing';
                  } finally {
                    iv.onPlaybackChange = origPbc;
                    if (iv._playPauseBtn && lbWas) {
                      iv._playPauseBtn.userData.setLabel = lbWas;
                    }
                  }
                  // update() head-follow arm: the per-frame call (wired in
                  // updateSystems) copies the camera world position into
                  // every video mesh — the fan pin only counted the call,
                  // the actual head-tracking copy was never observed. Move
                  // the rig, run one real update(), compare world positions.
                  const rigWas2 = app.camera.parent
                    ? app.camera.parent.position.clone() : null;
                  try {
                    if (app.camera.parent) {
                      app.camera.parent.position.set(7.25, 1.6, -3.5);
                      app.scene.updateMatrixWorld(true);
                    }
                    iv.update();
                    // update() leaves the camera world position in _tmpVec.
                    const camW2 = iv._tmpVec;
                    out.vidHeadFollow = iv.meshes.length > 0
                      && iv.meshes.every((m) =>
                        Math.abs(m.position.x - camW2.x) < 1e-9
                        && Math.abs(m.position.y - camW2.y) < 1e-9
                        && Math.abs(m.position.z - camW2.z) < 1e-9);
                  } finally {
                    if (app.camera.parent && rigWas2) {
                      app.camera.parent.position.copy(rigWas2);
                      app.scene.updateMatrixWorld(true);
                    }
                  }
                  // togglePause resume arm: video.paused → video.play() is
                  // invoked and (deliberately) nothing else mutates — the
                  // 'playing' listener owns the state flip.
                  let playCalls2 = 0;
                  try {
                    iv.video = {
                      paused: true,
                      pause: () => {},
                      play: () => { playCalls2++; return Promise.resolve(); }
                    };
                    iv.playing = false;
                    pbcState = null;
                    iv.onPlaybackChange = (st) => { pbcState = st; };
                    const tpWas3 = iv.togglePause;
                    iv.togglePause = Object.getPrototypeOf(iv).togglePause;
                    try {
                      if (pauseBtn) {
                        selectCenter6(pauseBtn);
                        await new Promise((r) => setTimeout(r, 20));
                      }
                    } finally {
                      iv.togglePause = tpWas3;
                    }
                    out.vidResumePlays = !!pauseBtn
                      && playCalls2 === 1
                      && pbcState === null
                      && iv.playing === false;
                  } finally {
                    iv.video = vidWas;
                    iv.onPlaybackChange = origPbc;
                  }
                  // _reportError arms: a mid-stream error while playing must
                  // reset playing=false, rewrite the HUD label to 'Play',
                  // notify 'stopped', and fire onError (→ error toast) — and
                  // an error BEFORE playback starts must stay a no-op
                  // (onError fires, but nothing else moves).
                  const errMsgs = [];
                  const errWas = iv.onError;
                  const lbCalls2 = [];
                  const lbWas2 = iv._playPauseBtn
                    ? iv._playPauseBtn.userData.setLabel : null;
                  try {
                    iv.onError = (m) => { errMsgs.push(m); };
                    iv.onPlaybackChange = (st) => { pbcState = st; };
                    if (iv._playPauseBtn) {
                      iv._playPauseBtn.userData.setLabel =
                        (l) => { lbCalls2.push(l); };
                    }
                    pbcState = null;
                    iv.playing = true;
                    iv._onVideoError();
                    out.vidErrorResets = iv.playing === false
                      && lbCalls2.length === 1
                      && pbcState === 'stopped'
                      && errMsgs.length === 1;
                    // Pre-playback error: onError still surfaces, but the
                    // playing-state contract stays untouched (no label
                    // write, no 'stopped' notify — that would lie).
                    lbCalls2.length = 0;
                    errMsgs.length = 0;
                    pbcState = null;
                    iv.playing = false;
                    iv._onVideoError();
                    out.vidErrorQuiet = iv.playing === false
                      && lbCalls2.length === 0
                      && pbcState === null
                      && errMsgs.length === 1;
                  } finally {
                    iv.onError = errWas;
                    iv.onPlaybackChange = origPbc;
                    if (iv._playPauseBtn && lbWas2) {
                      iv._playPauseBtn.userData.setLabel = lbWas2;
                    }
                  }
                  iv.stop();
                  out.vidCycleClean = restarted
                    && iv.active === false
                    && iv._eyeTextures.length === 0;
                  // Stereo arm: only mono layouts were ever played. A
                  // '_180_tb' URL exercises detectVideoFormat's tb arm, the
                  // per-eye sphere build (layers 1/2), the eyeUVTransform
                  // texture crops, and _enableStereoLayers' camera.layers
                  // mutation — plus the _disableStereoLayers restore on
                  // stop() that hands the borrowed mask back.
                  const camMaskWas = app.camera.layers.mask;
                  iv.play('https://vid-seed.example/clip_180_tb.mp4');
                  app.scene.updateMatrixWorld(true);
                  const mL = iv.meshes[0];
                  const mR = iv.meshes[1];
                  const texL = mL && mL.material && mL.material.map;
                  const texR = mR && mR.material && mR.material.map;
                  out.vidStereoEyes = iv._layout === 'stereo-tb'
                    && iv._projection === '180'
                    && iv.meshes.length === 2
                    && !!texL && !!texR
                    && texL.offset.y === 0.5 && texL.repeat.y === 0.5
                    && texL.repeat.x === 1
                    && texR.offset.y === 0 && texR.repeat.y === 0.5
                    && (mL.layers.mask & 2) !== 0
                    && (mR.layers.mask & 4) !== 0
                    && (app.camera.layers.mask & 6) === 6;
                  iv.stop();
                  out.vidStereoRestore = out.vidStereoEyes === true
                    && app.camera.layers.mask === camMaskWas
                    && iv.meshes.length === 0
                    && iv._eyeTextures.length === 0;
                  // Real-wiring arms: the HUD button's registered onHover
                  // routes draw(true) + onHoverCaption(label) — the gaze
                  // user's only label announcement (every earlier HUD pin
                  // drove the select arm only) — and stop() must detach the
                  // video-element listeners play() bound plus hand 'stopped'
                  // to the REAL onPlaybackChange → captionSystem.show. This
                  // leg sits inside the locoCaps stub window, so observe
                  // show() writes by wrapping it (chain through to whatever
                  // is installed — stub or real — then restore).
                  const vidCaps = [];
                  const vidShowWas = app.captionSystem && app.captionSystem.show;
                  try {
                    if (app.captionSystem && vidShowWas) {
                      app.captionSystem.show = (m) => {
                        vidCaps.push(String(m));
                        return vidShowWas(m);
                      };
                    }
                    iv.play('https://vid-seed.example/cap.mp4',
                      { projection: '360', layout: 'mono' });
                    const hb = iv.controlPanel
                      ? iv.controlPanel.children.find(
                        (b) => b.position && b.position.x > 0) : null;
                    app.settings.enableGazeDwell = true;
                    if (hb && hb.userData.interactable) {
                      hb.userData.interactable.onHover();
                    }
                    out.vidHoverCap = vidCaps.some(
                      (t) => t.indexOf('Exit') >= 0);
                    app.settings.enableGazeDwell = false;
                    if (hb && hb.userData.interactable
                      && hb.userData.interactable.onHoverEnd) {
                      hb.userData.interactable.onHoverEnd();
                    }
                    iv.stop();
                    out.vidStopCaption = iv.active === false
                      && iv._onVideoError === null
                      && iv._onVideoPlaying === null
                      && iv.video === null
                      && iv.playing === false
                      && vidCaps.some(
                        (t) => t.indexOf('Video: stopped') >= 0);
                  } finally {
                    if (app.captionSystem && vidShowWas) {
                      app.captionSystem.show = vidShowWas;
                    }
                    app.settings.enableGazeDwell = false;
                    if (iv.active) { iv.stop(); }
                  }
                } finally {
                  if (iv.active) { iv.stop(); }
                }
              }
              // Dispose-teardown leg — every dispose() contract was undriven:
              // closeTab → panel.dispose() unregisters the three interactables,
              // pulls the group out of its parent, fires a real geometry
              // 'dispose' event on every mesh, and aborts any in-flight reader
              // fetch (_readerController → abort + null + _readerSeq++). A
              // second WebPanel is minted via the manager so the teardown path
              // driven is the real user one, not a direct call.
              if (app.tabManager && app.scene && app.interactables) {
                const tm = app.tabManager;
                if (tm.tabs.length < 8) {
                  const wp = tm.newTab('https://wp-dispose.example/');
                  const idx = tm.tabs.indexOf(wp);
                  const meshes = wp
                    ? [wp.chromeMesh, wp.moveBarMesh, wp.contentMesh] : [];
                  const regWas = meshes.filter(
                    (m) => app.interactables.includes(m)).length;
                  let geoDisposed = false;
                  if (wp && wp.chromeMesh && wp.chromeMesh.geometry) {
                    wp.chromeMesh.geometry.addEventListener(
                      'dispose', () => { geoDisposed = true; });
                  }
                  // An in-flight reader fetch must be aborted so its
                  // resolution cannot call back into a torn-down panel.
                  const seqWas = wp ? wp._readerSeq : 0;
                  const ac = new AbortController();
                  if (wp) { wp._readerController = ac; }
                  const tabsWas = tm.tabs.length;
                  if (idx >= 0) { tm.closeTab(idx); }
                  out.wpDisposeTeardown = !!wp && regWas === 3
                    && meshes.every(
                      (m) => !app.interactables.includes(m))
                    && wp.group.parent === null
                    && geoDisposed === true
                    && tm.tabs.length === tabsWas - 1;
                  out.wpDisposeAborts = !!wp
                    && ac.signal.aborted === true
                    && wp._readerController === null
                    && wp._readerSeq === seqWas + 1;
                }
              }
              // BookmarkPanel.dispose — fresh instance so the app's panel
              // stays live for later legs: unregister the mesh, remove the
              // group from the scene, dispose geometry + material + the
              // CanvasTexture, and drop the canvas reference.
              if (app.bookmarkPanel && app.scene) {
                const BPCtor = app.bookmarkPanel.constructor;
                const bp2 = new BPCtor({
                  scene: app.scene,
                  registerInteractable: (m, h) =>
                    app.registerInteractable(m, h),
                  unregisterInteractable: (m) =>
                    app.unregisterInteractable(m),
                  store: app.bookmarks
                });
                const geoDis = { mesh: false, tex: false };
                if (bp2.mesh && bp2.mesh.geometry) {
                  bp2.mesh.geometry.addEventListener(
                    'dispose', () => { geoDis.mesh = true; });
                }
                if (bp2.tex) {
                  bp2.tex.addEventListener(
                    'dispose', () => { geoDis.tex = true; });
                }
                // Registration + scene attachment happen in addToScene
                // (constructor only draws), so drive it before teardown.
                bp2.addToScene();
                const wasRegistered = app.interactables.includes(bp2.mesh);
                bp2.dispose();
                out.bpDisposeTeardown = wasRegistered === true
                  && geoDis.mesh === true
                  && geoDis.tex === true
                  && !app.interactables.includes(bp2.mesh)
                  && (!bp2.group || bp2.group.parent === null)
                  && bp2.canvas === null;
              }
              // SpatialAudio.dispose — fresh instance (the app's stays live
              // for the 3800-line audio legs): stops every source, clears
              // sources + buffers maps, resets LOD counters, removes the
              // resume listeners, and closes the AudioContext.
              if (app.spatialAudio) {
                const SACtor = app.spatialAudio.constructor;
                const sa3 = new SACtor();
                if (sa3.context && sa3.context.createPanner) {
                  sa3.createSource('__dsp', { volume: 0.01 });
                  sa3.stats.hrtfSources = 2;
                  sa3.stats.equalPowerSources = 1;
                  sa3.buffers.set('__b', { fake: true });
                  sa3.dispose();
                  out.audioDispose = sa3.sources.size === 0
                    && sa3.buffers.size === 0
                    && sa3.stats.hrtfSources === 0
                    && sa3.stats.equalPowerSources === 0
                    && sa3.context === null;
                }
              }
              // Tab-strip leg — stripMesh is a single canvas interactable
              // (same UV→pixel pattern as BookmarkPanel): _onStripSelect
              // resolves the right-90px "+" zone → newTab, a tab body →
              // setActive (→ 'Tab: <host>' caption), and each tab's right
              // 36px → closeTab (→ 'Tab closed'). A saturated strip routes
              // '+' → the 'Maximum tabs reached' warn.
              if (ctrl && app.tabManager && app.tabManager.stripMesh
                && app.scene) {
                const tm = app.tabManager;
                const selectStrip = async (px) => {
                  // Drive _onStripSelect with the world-space point for the
                  // canvas pixel — the strip's front face points away from
                  // the controller ray in this layout, so the ray leg is
                  // exercised via stripProbe's registration instead; the
                  // UV→action path here is the contract under test.
                  const local = tm.stripMesh.position.clone().set(
                    (px / 1024 - 0.5) * 1.6, 0, 0);
                  const pt = tm.stripMesh.localToWorld(local);
                  tm._onStripSelect(pt);
                  await new Promise((r) => setTimeout(r, 20));
                };
                const tabW = () => Math.min(220, (1024 - 90) / tm.tabs.length);
                const tabsWas = tm.tabs.length;
                const activeWas = tm.activeIndex;
                try {
                  app.scene.updateMatrixWorld(true);
                  out.stripProbe = tm.stripMesh.visible === true
                    && app.interactables.includes(tm.stripMesh);
                  // '+' zone → a new tab + 'Tab: New Tab' caption.
                  const capsBefore10 = locoCaps.length;
                  const nWas = tm.tabs.length;
                  await selectStrip(980);
                  out.stripNewTab = tm.tabs.length === nWas + 1
                    && locoCaps.slice(capsBefore10)
                      .some((t3) => t3.includes('Tab:'));
                  // Tab body → activate + 'Tab: <host-or-NewTab>' caption.
                  const capsBefore11 = locoCaps.length;
                  await selectStrip(20);
                  out.stripActivate = tm.activeIndex === 0
                    && locoCaps.slice(capsBefore11)
                      .some((t3) => t3.includes('Tab:'));
                  // Close zone (right 36px of tab 0) → close + caption.
                  const capsBefore12 = locoCaps.length;
                  const nBefore = tm.tabs.length;
                  await selectStrip(tabW() - 8);
                  out.stripClose = tm.tabs.length === nBefore - 1
                    && locoCaps.slice(capsBefore12)
                      .some((t3) => t3.includes('Tab closed'));
                  // #221 — newTab(url) must announce the destination host,
                  // not 'New Tab': activating before navigate() announces
                  // the still-empty currentUrl.
                  const capsBefore14 = locoCaps.length;
                  tm.newTab('https://restore.example/x');
                  const restoreIdx = tm.tabs.length - 1;
                  const restoreCaps = locoCaps.slice(capsBefore14);
                  out.tabRestoreAnnounce = restoreCaps
                    .some((t3) => t3.includes('restore.example'))
                    && !restoreCaps.some((t3) => t3.includes('New Tab'));
                  // #221 — closing an earlier INACTIVE tab keeps the same
                  // tab active; re-running setActive() announces 'Tab: X'
                  // again for a tab that never changed (spurious WCAG 4.1.3
                  // status message). Only this leg's own panels are
                  // opened/closed so earlier state survives for later legs.
                  tm.newTab('');                    // focus moves to the new tab
                  const capsBefore15 = locoCaps.length;
                  tm.closeTab(restoreIdx);          // inactive + earlier index
                  const quietCaps = locoCaps.slice(capsBefore15);
                  out.tabCloseQuiet = tm.activeIndex === tm.tabs.length - 1
                    && quietCaps.some((t3) => t3.includes('Tab closed'))
                    && !quietCaps.some((t3) => t3.includes('Tab:'));
                  // Saturate to MAX_TABS (8), then '+' warns instead.
                  while (tm.tabs.length < 8 && tm.newTab()) { /* fill */ }
                  const capsBefore13 = locoCaps.length;
                  await selectStrip(980);
                  out.stripMaxWarn = tm.tabs.length === 8
                    && locoCaps.slice(capsBefore13)
                      .some((t3) => t3.includes('Maximum tabs reached'));
                } finally {
                  while (tm.tabs.length > tabsWas) {
                    tm.closeTab(tm.tabs.length - 1);
                  }
                  if (tm.tabs.length) {
                    tm.setActive(
                      Math.min(activeWas, tm.tabs.length - 1));
                  }
                  app.scene.updateMatrixWorld(true);
                }
              }
              // Shift-mode leg — 'shift' toggles hiragana↔katakana via
              // ime.switchMode, latches userData.keyActive on the shift
              // keyMesh, and subsequent romaji input converts through the
              // katakana arm of processInput ('k','a' → カ). The pin reads
              // the converted string the app hands updateDisplay.
              if (ctrl && app.vrKeyboard && app.japaneseIME) {
                const kb = app.vrKeyboard;
                const ime4 = app.japaneseIME;
                const kbVisWas3 = kb.visible;
                const modeWas = ime4.inputMode;
                const origUD = kb.updateDisplay;
                const convs = [];
                try {
                  kb.show();
                  app.scene.updateMatrixWorld(true);
                  kb.updateDisplay = (r) => {
                    convs.push(r && r.converted);
                    return origUD.call(kb, r);
                  };
                  ime4.switchMode('hiragana');
                  ime4.clear();
                  const shiftKey = (kb.keyMeshes || [])
                    .find((k) => k.label === 'shift');
                  const pressKey7 = async (label) => {
                    const km = (kb.keyMeshes || [])
                      .find((k) => k.label === label);
                    if (!km) { return false; }
                    selectCenter6(km.mesh);
                    await new Promise((r) => setTimeout(r, 30));
                    return true;
                  };
                  out.shiftProbe = !!shiftKey && kb.visible === true;
                  const shiftOk = await pressKey7('shift');
                  out.shiftToggles = shiftOk
                    && ime4.inputMode === 'katakana'
                    && shiftKey.mesh.userData.keyActive === true;
                  const kOk = await pressKey7('k');
                  const aOk = await pressKey7('a');
                  out.shiftTypesKatakana = kOk && aOk
                    && convs.includes('カ');
                  const shiftOk2 = await pressKey7('shift');
                  out.shiftBack = shiftOk2
                    && ime4.inputMode === 'hiragana'
                    && shiftKey.mesh.userData.keyActive === false;
                } finally {
                  kb.updateDisplay = origUD;
                  ime4.clear();
                  ime4.switchMode(modeWas);
                  if (kbVisWas3) {
                    kb.show();
                  } else {
                    kb.hide();
                  }
                }
              }
              // Reader leg — navigate → fetch → extractReadableText →
              // layoutReaderLines → 'reader' content state, then the content
              // mesh's scroll arrows route through _onContentSelect's
              // UV→pixel hit zones (down ▲ scrolls the article, up ▼ clamps
              // back to the top). Every prior navigation leg landed on the
              // 'unavailable' arm because headless fetches fail; stubbing
              // fetch here is the first time the success path runs e2e.
              if (ctrl && app.tabManager && app.tabManager.tabs
                && app.tabManager.tabs.length && app.scene) {
                const wp = app.tabManager.tabs[app.tabManager.activeIndex];
                const origFetch = globalThis.fetch;
                const paras = Array.from({ length: 80 },
                  (_v, i) => '<p>Reader paragraph ' + i
                    + ' — enough prose to overflow the reader viewport.</p>')
                  .join('');
                const html = '<html><head><title>Harness Article</title></head>'
                  + '<body><article><h1>Heading</h1>' + paras
                  + '</article></body></html>';
                try {
                  globalThis.fetch = () => Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve(html)
                  });
                  app.scene.updateMatrixWorld(true);
                  out.readerProbe = !!wp
                    && app.interactables.includes(wp.contentMesh);
                  // navigate() kicks the load but drops its promise — wait
                  // for the reader fetch to settle before asserting.
                  wp.navigate('https://reader-harness.example/');
                  for (let i = 0; i < 60 && wp.loading; i++) {
                    await new Promise((r) => setTimeout(r, 50));
                  }
                  out.readerLoads = wp._contentState === 'reader'
                    && wp._readerLines.length > 0
                    && wp.currentTitle === 'Harness Article'
                    && wp._readerScroll === 0;
                  const selContent = (px, py) => {
                    const local = wp.contentMesh.position.clone().set(
                      (px / 1024 - 0.5) * 1.6,
                      (0.5 - py / 942) * 0.92, 0);
                    wp._onContentSelect(wp.contentMesh.localToWorld(local));
                  };
                  // ▼ zone: px 912–1008, py 854–926.
                  selContent(960, 890);
                  out.readerScrollsDown = wp._readerScroll > 0;
                  // ▲ zone: px 804–900 — clamps back to the top.
                  selContent(850, 890);
                  out.readerScrollsUp = wp._readerScroll === 0;
                } finally {
                  globalThis.fetch = origFetch;
                }
              }
              // Chrome-bar leg — chromeMesh's pixel zones drive real panel
              // actions: <68 back, <136 forward, <204 reload/stop, >w-60
              // hide, w-128..w-72 bookmark star (→ onToggleBookmark), else
              // URL bar (→ onUrlInputRequested opens the keyboard). Same
              // UV→pixel contract as the reader content zones.
              if (ctrl && app.tabManager && app.tabManager.tabs
                && app.tabManager.tabs.length && app.scene && app.vrKeyboard
                && app.bookmarks) {
                const wp = app.tabManager.tabs[app.tabManager.activeIndex];
                const origFetch2 = globalThis.fetch;
                // Defensive: if the primary onUrlInputRequested path ever
                // broke, WebPanel falls back to a synchronous window.prompt,
                // which would hang headless. Stub it so the leg reports a
                // clean FAIL instead of stalling the whole harness.
                const origPrompt = window.prompt;
                window.prompt = () => null;
                let fetchCalls = 0;
                try {
                  globalThis.fetch = () => {
                    fetchCalls++;
                    return Promise.resolve({
                      ok: true,
                      text: () => Promise.resolve(
                        '<html><head><title>P</title></head><body><article>'
                        + '<p>chrome leg paragraph one two three four five'
                        + ' six seven eight nine ten eleven twelve thirteen'
                        + ' fourteen fifteen sixteen seventeen eighteen'
                        + '</p></article></body></html>')
                    });
                  };
                  app.scene.updateMatrixWorld(true);
                  out.chromeProbe = !!wp
                    && app.interactables.includes(wp.chromeMesh);
                  const selChrome = (px) => {
                    const local = wp.chromeMesh.position.clone().set(
                      (px / 1024 - 0.5) * 1.6, 0, 0);
                    wp._onChromeSelect(wp.chromeMesh.localToWorld(local));
                  };
                  const settle = async () => {
                    for (let i = 0; i < 60 && wp.loading; i++) {
                      await new Promise((r) => setTimeout(r, 50));
                    }
                  };
                  // Two loads → back()/forward() move through real history.
                  wp.navigate('https://chrome-a.example/');
                  await settle();
                  wp.navigate('https://chrome-b.example/');
                  await settle();
                  const idxTop = wp.historyIdx; // N-1 — earlier legs leave entries
                  selChrome(30);               // back zone
                  await settle();
                  const backOk = wp.historyIdx === idxTop - 1
                    && wp.currentUrl === 'https://chrome-a.example/';
                  selChrome(100);              // forward zone
                  await settle();
                  out.chromeBackForward = backOk
                    && wp.historyIdx === idxTop
                    && wp.currentUrl === 'https://chrome-b.example/';
                  // Reload zone re-issues the reader fetch.
                  const fBefore = fetchCalls;
                  selChrome(170);
                  await settle();
                  out.chromeReload = fetchCalls === fBefore + 1;
                  // Star zone → onToggleBookmark round-trips the store.
                  const urlB = wp.currentUrl;
                  const capsBefore14 = locoCaps.length;
                  selChrome(920);
                  out.chromeStar = !!app.bookmarks.isBookmarked(urlB)
                    && locoCaps.slice(capsBefore14)
                      .some((t3) => t3.includes('Bookmark'));
                  if (app.bookmarks.isBookmarked(urlB)) {
                    selChrome(920);            // untoggle → restore
                  }
                  // URL bar → onUrlInputRequested opens the keyboard.
                  selChrome(500);
                  await new Promise((r) => setTimeout(r, 30));
                  out.chromeUrlBar = app.vrKeyboard.visible === true
                    && app.japaneseIME.compositionBuffer === urlB;
                  app.vrKeyboard.hide();
                  app.vrKeyboard._onConfirmCallback = null;
                  // Close zone hides the panel group.
                  selChrome(1000);
                  out.chromeClose = wp.group.visible === false;
                } finally {
                  globalThis.fetch = origFetch2;
                  window.prompt = origPrompt;
                  if (wp) {
                    wp.setVisible(true);
                  }
                  if (app.vrKeyboard) {
                    app.vrKeyboard.hide();
                    app.vrKeyboard._onConfirmCallback = null;
                  }
                }
              }
              // Top-sites leg — a fresh tab lands on 'empty' state where
              // getTopSites seeds the tile grid; a tile-rect select routes
              // tileAt → navigate, dead space is a no-op, and the reload
              // zone while a fetch is in flight becomes stop() (aborts the
              // load, returns content state without corrupting the panel).
              if (ctrl && app.tabManager && app.scene) {
                const tm2 = app.tabManager;
                const origFetch3 = globalThis.fetch;
                const activeWas2 = tm2.activeIndex;
                const tabsWas2 = tm2.tabs.length;
                try {
                  globalThis.fetch = () => Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve(
                      '<html><head><title>Tile Page</title></head><body>'
                      + '<article><p>tile paragraph one two three four five'
                      + ' six seven eight nine ten</p></article></body>')
                  });
                  tm2.newTab();
                  const wp2 = tm2.tabs[tm2.activeIndex];
                  app.scene.updateMatrixWorld(true);
                  out.tilesProbe = !!wp2
                    && wp2._contentState === 'empty'
                    && (wp2._topTiles || []).length > 0;
                  const selContent2 = (px, py) => {
                    const local = wp2.contentMesh.position.clone().set(
                      (px / 1024 - 0.5) * 1.6,
                      (0.5 - py / 942) * 0.92, 0);
                    wp2._onContentSelect(wp2.contentMesh.localToWorld(local));
                  };
                  const selChrome2 = (px) => {
                    const local = wp2.chromeMesh.position.clone().set(
                      (px / 1024 - 0.5) * 1.6, 0, 0);
                    wp2._onChromeSelect(wp2.chromeMesh.localToWorld(local));
                  };
                  const settle2 = async () => {
                    for (let i = 0; i < 60 && wp2.loading; i++) {
                      await new Promise((r) => setTimeout(r, 50));
                    }
                  };
                  // Header dead space (py < HEADER_PX=110): no tile hit.
                  selContent2(500, 30);
                  out.tileMissNoop = wp2._contentState === 'empty'
                    && !wp2.currentUrl;
                  // Tile rect → navigate → reader state on the tiled URL.
                  const tile = wp2._topTiles[0];
                  if (tile) {
                    selContent2(tile.x + 5, tile.y + 5);
                    await settle2();
                  }
                  out.tileNavigates = !!tile
                    && wp2.currentUrl === tile.url
                    && wp2._contentState === 'reader';
                  // Reload zone during an in-flight load → stop() clears it.
                  wp2.navigate('https://tile-stop.example/');
                  const wasLoading = wp2.loading === true;
                  selChrome2(170);
                  out.stopArmClears = wasLoading
                    && wp2.loading === false;
                } finally {
                  globalThis.fetch = origFetch3;
                  while (tm2.tabs.length > tabsWas2) {
                    tm2.closeTab(tm2.tabs.length - 1);
                  }
                  if (tm2.tabs.length) {
                    tm2.setActive(
                      Math.min(activeWas2, tm2.tabs.length - 1));
                  }
                  app.scene.updateMatrixWorld(true);
                }
              }
              // Quad-layer leg — enableLayerMode hands the chrome bar to
              // the XR compositor: chromeMesh hides, the first updateLayer
              // poses the layer from the mesh's world transform AND blits
              // the dirty canvas; a clean frame still re-syncs the pose
              // (transform rewrite on panel move) but skips the blit;
              // hiding the panel skips both; disableLayerMode restores
              // the mesh and fires the detach callback (no GPU ghost).
              if (ctrl && app.tabManager && app.scene) {
                const tm3 = app.tabManager;
                const tabsWas3 = tm3.tabs.length;
                const activeWas3 = tm3.activeIndex;
                try {
                  const wp3 = tm3.newTab();
                  app.scene.updateMatrixWorld(true);
                  const blits = [];
                  const fakeLS3 = { renderCanvasToLayer:
                    (l, c) => blits.push([l, c]) };
                  const q3 = { transform: null };
                  let detach3 = 0;
                  wp3.enableLayerMode(q3, fakeLS3, 'lyr-h',
                    () => { detach3++; });
                  const enOk3 = wp3.quadLayer === q3
                    && wp3._layerDirty === true
                    && wp3.chromeMesh.visible === false;
                  wp3.updateLayer({}, []);
                  const t1o = q3.transform;
                  const t1x = t1o && t1o.position ? t1o.position.x : null;
                  out.wpLayerBlits = enOk3
                    && blits.length === 1 && blits[0][0] === q3
                    && wp3._layerDirty === false
                    && typeof t1x === 'number';
                  // Clean frame: pose re-sync only — the panel move rewrites
                  // transform while the clean canvas skips the blit.
                  wp3.group.position.x += 0.5;
                  wp3.group.updateMatrixWorld(true);
                  wp3.updateLayer({}, []);
                  const t2x = q3.transform && q3.transform.position
                    ? q3.transform.position.x : null;
                  out.wpLayerResyncs = blits.length === 1
                    && q3.transform !== t1o
                    && typeof t2x === 'number' && t2x !== t1x;
                  // Hidden panel: early return — no re-pose, no blit.
                  wp3.group.visible = false;
                  wp3.group.position.x += 0.5;
                  wp3.group.updateMatrixWorld(true);
                  const t2o = q3.transform;
                  wp3.updateLayer({}, []);
                  out.wpLayerHiddenSkips = q3.transform === t2o
                    && blits.length === 1;
                  wp3.group.visible = true;
                  // Release: mesh restored + detach callback fires once.
                  wp3.disableLayerMode(true);
                  out.wpLayerRelease = detach3 === 1
                    && wp3.quadLayer === null
                    && wp3.chromeMesh.visible === true;
                } finally {
                  while (tm3.tabs.length > tabsWas3) {
                    tm3.closeTab(tm3.tabs.length - 1);
                  }
                  if (tm3.tabs.length) {
                    tm3.setActive(
                      Math.min(activeWas3, tm3.tabs.length - 1));
                  }
                  app.scene.updateMatrixWorld(true);
                }
              }
              // Panel-layer reconciler — _syncPanelLayers runs after every
              // tab-set mutation so a mid-session tab gets a quad layer too
              // (attach used to run ONLY at session start). A hidden panel
              // must be skipped — quad layers composite through the runtime
              // regardless of mesh visibility (ghost chrome) — and an
              // already-layered panel must not re-attach. _detachPanelLayer
              // drops exactly one id back through removeLayer with the live
              // session + base layer so the render state re-commits clean.
              if (app.layersSystem && app.renderer && app.renderer.xr
                && app.tabManager && app.tabManager.tabs) {
                const xr2 = app.renderer.xr;
                const ls2 = app.layersSystem;
                const gsWas = xr2.getSession;
                const grsWas = xr2.getReferenceSpace;
                const gblWas = xr2.getBaseLayer;
                const cqlWas = ls2.createQuadLayer;
                const ursWas = ls2.updateRenderState;
                const rlWas = ls2.removeLayer;
                const mkPanel2 = (vis) => ({
                  quadLayer: null,
                  group: { visible: vis },
                  enableLayerMode(q, l, id, cb) {
                    this.quadLayer = q;
                    this._layerId = id;
                    this._detach = cb;
                  }
                });
                const made2 = [];
                const states2 = [];
                const removed2 = [];
                const fakeSess = {};
                const pV2 = mkPanel2(true);
                const pH2 = mkPanel2(false);
                const pL2 = mkPanel2(true);
                pL2.quadLayer = { already: true };
                const tabsWas4 = app.tabManager.tabs.slice();
                try {
                  xr2.getSession = () => fakeSess;
                  xr2.getReferenceSpace = () => 'fakeRef';
                  xr2.getBaseLayer = () => 'fakeBase';
                  ls2.createQuadLayer =
                    (a2) => (made2.push(a2), { id: a2.id });
                  ls2.updateRenderState = (s, b) => states2.push([s, b]);
                  ls2.removeLayer = (id, s, b) => removed2.push([id, s, b]);
                  app.tabManager.tabs.push(pV2, pH2, pL2);
                  app._syncPanelLayers();
                  // Real tabs are unlayered headless too — the pass also
                  // attaches them; pin what pV2 received, not the count.
                  const madeAtFirst = made2.length;
                  const hidAtFirst = !pH2.quadLayer;
                  out.panelLayerAttach = !!pV2.quadLayer
                    && typeof pV2._layerId === 'string'
                    && pV2._layerId.startsWith('panel_chrome_')
                    && made2.some((a2) => a2.id === pV2._layerId)
                    && made2.some((a2) => a2.space === 'fakeRef')
                    && typeof pV2._detach === 'function'
                    && states2.length === 1
                    && states2[0][0] === fakeSess
                    && states2[0][1] === 'fakeBase';
                  out.panelLayerIdempotent = !pL2._layerId;
                  // Hidden → skipped on the first pass; shown → attaches
                  // on the next sync (no missed layer for a revealed tab).
                  pH2.group.visible = true;
                  app._syncPanelLayers();
                  out.panelLayerHiddenSkip = hidAtFirst
                    && !!pH2.quadLayer
                    && made2.length === madeAtFirst + 1
                    && states2.length === 2;
                  // Third run with every panel layered: no attach, no
                  // re-commit — a plain navigation save stays cheap.
                  app._syncPanelLayers();
                  out.panelLayerStable =
                    made2.length === madeAtFirst + 1
                    && states2.length === 2;
                  // Detach callback routes the exact id to removeLayer
                  // with the live session + base layer. Guarded: under a
                  // red-verify cut the callback is never installed.
                  if (typeof pV2._detach === 'function') {
                    pV2._detach(pV2._layerId);
                  }
                  out.panelLayerDetach = removed2.length === 1
                    && removed2[0][0] === pV2._layerId
                    && removed2[0][1] === fakeSess
                    && removed2[0][2] === 'fakeBase';
                } finally {
                  app.tabManager.tabs = tabsWas4;
                  xr2.getSession = gsWas;
                  xr2.getReferenceSpace = grsWas;
                  xr2.getBaseLayer = gblWas;
                  ls2.createQuadLayer = cqlWas;
                  ls2.updateRenderState = ursWas;
                  ls2.removeLayer = rlWas;
                }
              }
              // Loop-arming + grab-request contract — _syncAnimationLoop
              // arms the RAF loop while the canvas is on-screen OR while
              // XR is presenting (headset frames come from the runtime,
              // not window RAF), disarms when neither holds, and does not
              // re-call setAnimationLoop when the state is unchanged.
              // _onPanelGrabRequested re-attaches a stale managed target
              // BEFORE beginGrab so the grab offset measures from the
              // live rootGroup world position, not a dead parent.
              if (app.renderer && app.renderer.xr && app._renderBound
                && app.windowManager && app.tabManager
                && app.tabManager.rootGroup
                && app.controllers && app.controllers[0]) {
                const xr3 = app.renderer.xr;
                const wm2 = app.windowManager;
                const salWas = app.renderer.setAnimationLoop;
                const ipWas = xr3.isPresenting;
                const offWas = app._canvasOffscreen;
                const armedWas = app._loopArmed;
                const tgtWas = wm2.target;
                const gcWas = app._grabController;
                const calls = [];
                try {
                  app.renderer.setAnimationLoop =
                    (cb) => calls.push(cb);
                  // Armed + offscreen + not presenting → disarm once.
                  app._canvasOffscreen = true;
                  xr3.isPresenting = false;
                  app._loopArmed = true;
                  app._syncAnimationLoop();
                  out.loopPausesOffscreen = calls.length === 1
                    && calls[0] === null && app._loopArmed === false;
                  // Still offscreen, still unarmed → no call at all.
                  app._syncAnimationLoop();
                  out.loopStaysPaused = calls.length === 1;
                  // Presenting overrides offscreen — XR frames come from
                  // the runtime so an offscreen tab still gets frames.
                  xr3.isPresenting = true;
                  app._syncAnimationLoop();
                  out.loopRunsWhilePresenting = calls.length === 2
                    && calls[1] === app._renderBound
                    && app._loopArmed === true;
                  // Already armed → no re-arm call.
                  app._syncAnimationLoop();
                  out.loopArmIdempotent = calls.length === 2;
                  // Visible canvas, not presenting → arms the RAF loop.
                  xr3.isPresenting = false;
                  app._loopArmed = false;
                  app._canvasOffscreen = false;
                  app._syncAnimationLoop();
                  out.loopArmsVisible = calls.length === 3
                    && calls[2] === app._renderBound
                    && app._loopArmed === true;
                  // Stale managed target → re-attach fires before the
                  // grab so beginGrab measures against the real group.
                  const ctrl3 = app.controllers[0];
                  const attachCalls = [];
                  wm2.attach = (o) => {
                    attachCalls.push(o);
                    wm2.target = o;
                    return wm2;
                  };
                  wm2.target = app.tabManager.rootGroup.clone();
                  app._onPanelGrabRequested(ctrl3);
                  out.grabReattaches = attachCalls.length === 1
                    && attachCalls[0] === app.tabManager.rootGroup
                    && wm2.target === app.tabManager.rootGroup
                    && !!wm2._grab && wm2._grab.controller === ctrl3
                    && wm2._grab.distance > 0
                    && app._grabController === ctrl3;
                  // Fresh target → attach skipped; grab still lands.
                  wm2.endGrab();
                  app._grabController = null;
                  attachCalls.length = 0;
                  app._onPanelGrabRequested(ctrl3);
                  out.grabAttachSkipped = attachCalls.length === 0
                    && wm2.isGrabbing
                    && app._grabController === ctrl3;
                  wm2.endGrab();
                } finally {
                  app.renderer.setAnimationLoop = salWas;
                  xr3.isPresenting = ipWas;
                  app._canvasOffscreen = offWas;
                  app._loopArmed = armedWas;
                  if (app.windowManager === wm2) {
                    delete wm2.attach;
                    wm2.target = tgtWas;
                    wm2._grab = null;
                  }
                  app._grabController = gcWas;
                  app._syncAnimationLoop();
                }
              }
              // GL context + debounced-resize + perf-stats contract —
              // dispatching webglcontextlost/-restored on the renderer's
              // domElement runs BOTH Three's own handlers (which toggle
              // its _isContextLost flag, so the two events go as a pair,
              // and which log console.error, so stderr is stubbed) and
              // ours (pause/resume the RAF loop + cross-modal notify).
              // The window-resize listener is debounced ~150 ms: outside
              // presentation it relays size+aspect once per burst; while
              // presenting WebXR owns the framebuffer so it skips.
              // getPerformanceStats formats live monitor + renderer.info
              // fields and returns null when there is no renderer.
              if (app.renderer && app.renderer.domElement
                && app.captionSystem && app.hapticFeedback
                && app.camera && app.performanceMonitor
                && app._renderBound) {
                const r2 = app.renderer;
                const salWas2 = r2.setAnimationLoop;
                const showWas2 = app.captionSystem.show;
                const patWas2 = app.hapticFeedback.playPatternBothHands;
                const ceWas = console.error;
                const armedWas2 = app._loopArmed;
                const offWas3 = app._canvasOffscreen;
                const ipWas2 = r2.xr.isPresenting;
                const ssWas = r2.setSize;
                const upmWas = app.camera.updateProjectionMatrix;
                const pmWas = Object.assign({}, app.performanceMonitor);
                try {
                  const calls2 = [];
                  const caps2 = [];
                  const pats2 = [];
                  console.error = () => {};
                  r2.setAnimationLoop = (cb) => calls2.push(cb);
                  app.captionSystem.show = (m) => caps2.push(String(m));
                  app.hapticFeedback.playPatternBothHands =
                    (p) => pats2.push(p);
                  // Headless the canvas may sit off-screen — force the
                  // visible state so 'restored' exercises the re-arm arm.
                  app._canvasOffscreen = false;
                  // Lost → real listener: preventDefault + disarm + warn.
                  const lost = new Event('webglcontextlost',
                    { cancelable: true });
                  r2.domElement.dispatchEvent(lost);
                  out.glLostPausesLoop = lost.defaultPrevented === true
                    && calls2.length === 1 && calls2[0] === null
                    && app._loopArmed === false;
                  out.glLostNotifies = caps2.length === 1
                    && caps2[0].length > 0 && pats2.length === 1;
                  // Restored → real listener: re-arms + 'info' routed.
                  r2.domElement.dispatchEvent(
                    new Event('webglcontextrestored'));
                  out.glRestoredResumes = calls2.length === 2
                    && calls2[1] === app._renderBound
                    && app._loopArmed === true
                    && caps2.length === 2;
                  // Debounced resize → size + aspect + projection matrix.
                  const sizes = [];
                  let upm = 0;
                  r2.setSize = (w2, h2) => sizes.push([w2, h2]);
                  app.camera.updateProjectionMatrix = () => { upm++; };
                  window.dispatchEvent(new Event('resize'));
                  await new Promise((rs) => setTimeout(rs, 250));
                  // Ambient trailing calls may piggyback in the window —
                  // pin the relay itself: at least one call, latest args
                  // matching, projection matrix updated.
                  out.resizeRelays = sizes.length >= 1
                    && sizes[sizes.length - 1][0] === window.innerWidth
                    && sizes[sizes.length - 1][1] === window.innerHeight
                    && upm >= 1
                    && app.camera.aspect
                      === window.innerWidth / window.innerHeight;
                  // While presenting, WebXR owns the framebuffer: skip.
                  r2.xr.isPresenting = true;
                  sizes.length = 0;
                  window.dispatchEvent(new Event('resize'));
                  await new Promise((rs) => setTimeout(rs, 250));
                  r2.xr.isPresenting = ipWas2;
                  out.resizeSkipsWhilePresenting = sizes.length === 0;
                  r2.setSize = ssWas;
                  app.camera.updateProjectionMatrix = upmWas;
                  // getPerformanceStats formats the live fields and adds
                  // conditional subsystem keys.
                  const pm2 = app.performanceMonitor;
                  pm2.fps = 59.6;
                  pm2.frameTime = 16.777;
                  pm2.memoryUsed = 12.345;
                  pm2.drawCalls = 7;
                  pm2.triangles = 901;
                  const ffrExp = app.ffrSystem
                    ? (app.ffrSystem.intensity * 100).toFixed(0) + '%'
                    : undefined;
                  const texExp = app.textureManager
                    ? (() => { const ms = app.textureManager
                        .getMemoryStats();
                        return ms.usedMB + '/' + ms.maxMB + 'MB'; })()
                    : undefined;
                  const st = app.getPerformanceStats();
                  out.perfStatsShape = !!st
                    && st.fps === 60 && st.frameTime === '16.78ms'
                    && st.memory === '12.3MB'
                    && st.drawCalls === 7 && st.triangles === 901
                    && typeof st.geometries === 'number'
                    && typeof st.textures === 'number'
                    && st.ffrIntensity === ffrExp
                    && st.textureMemory === texExp;
                  app.renderer = null;
                  out.perfStatsNullRenderer =
                    app.getPerformanceStats() === null;
                  app.renderer = r2;
                } finally {
                  app.renderer = r2;
                  r2.setAnimationLoop = salWas2;
                  r2.setSize = ssWas;
                  app.camera.updateProjectionMatrix = upmWas;
                  app.captionSystem.show = showWas2;
                  app.hapticFeedback.playPatternBothHands = patWas2;
                  console.error = ceWas;
                  r2.xr.isPresenting = ipWas2;
                  app._canvasOffscreen = offWas3;
                  app._loopArmed = armedWas2;
                  Object.assign(app.performanceMonitor, pmWas);
                  app._syncAnimationLoop();
                }
              }
              // Follow-mode leg — the 'Follow' toggle applies
              // windowManager.setFollow, after which updateSystems' per-frame
              // windowManager.update lerps the managed root toward
              // camera.position + cameraForward*distance (head-lock) and
              // _faceUser re-orients it; the distance stepper applies
              // wm.setDistance. Camera pose is scripted then restored.
              if (ctrl && app.windowManager && app.camera && app.scene) {
                const wm = app.windowManager;
                const cam = app.camera;
                const posWas = cam.position.clone();
                const quatWas = cam.quaternion.clone();
                const followWas = app.settings.enableWindowFollow;
                const distWas = app.settings.windowDistance;
                try {
                  app.updateSetting('enableWindowFollow', true);
                  out.followEnabled = wm.followMode === true
                    && !!wm.target;
                  cam.position.set(0, 1.6, 0);
                  cam.quaternion.set(0, 0, 0, 1); // forward = -z
                  cam.updateMatrixWorld(true);
                  for (let k = 0; k < 40; k++) {
                    app.updateSystems(0, fakeXrFrame, 100);
                  }
                  // World pose: the camera lives under the head rig, so its
                  // local position isn't the world point follow targets.
                  const camPos = cam.position.clone();
                  cam.getWorldPosition(camPos);
                  const camQuat = cam.quaternion.clone();
                  cam.getWorldQuaternion(camQuat);
                  const fwd = camPos.clone().set(0, 0, -1)
                    .applyQuaternion(camQuat);
                  const want = camPos.clone()
                    .addScaledVector(fwd, wm.distance);
                  out.followConverges = wm.target.position
                    .distanceTo(want) < 0.35;
                  app.updateSetting('enableWindowFollow', false);
                  const held = wm.target.position.clone();
                  app.updateSystems(0, fakeXrFrame, 100);
                  out.followOffHolds = wm.target.position
                    .distanceTo(held) < 0.001;
                } finally {
                  cam.position.copy(posWas);
                  cam.quaternion.copy(quatWas);
                  cam.updateMatrixWorld(true);
                  app.updateSetting('windowDistance', distWas);
                  app.updateSetting('enableWindowFollow', followWas);
                  app.scene.updateMatrixWorld(true);
                }
              }
              // Constant-visual-angle scaling: _applyAngularScale grows the
              // managed root proportional to its distance from the eye, so
              // every gaze target keeps its subtended size at any
              // windowDistance (see angularSize.js / target-size tests —
              // unscaled, controls fall below the 1.5deg gaze minimum at 6m).
              // Pin the real update() -> scale contract incl. the clamps.
              if (app.windowManager && app.windowManager.target && app.camera) {
                const wm5 = app.windowManager;
                const tgt = wm5.target;
                const followWas5 = wm5.followMode;
                const tPosWas = tgt.position.clone();
                const tSclWas = tgt.scale.x;
                try {
                  wm5.setFollow(false);
                  const cPos5 = app.camera.position.clone();
                  app.camera.getWorldPosition(cPos5);
                  const cQuat5 = app.camera.quaternion.clone();
                  app.camera.getWorldQuaternion(cQuat5);
                  const cFwd5 = cPos5.clone().set(0, 0, -1)
                    .applyQuaternion(cQuat5);
                  const ref = wm5.referenceDistance;
                  const lo = wm5.minDistance / ref;
                  const hi = wm5.maxDistance / ref;
                  const place5 = (dist) => {
                    tgt.position.copy(cPos5).addScaledVector(cFwd5, dist);
                    tgt.updateMatrixWorld(true);
                    wm5.update(16);
                    return tgt.scale.x;
                  };
                  const sFar = place5(4);
                  const sNear = place5(0.4);
                  const sMax = place5(7);
                  out.wmAngularScale = Math.abs(sFar - 4 / ref) < 0.01
                    && Math.abs(sNear - lo) < 0.001
                    && Math.abs(sMax - hi) < 0.001
                    && sFar > sNear;
                } finally {
                  wm5.setFollow(followWas5);
                  tgt.position.copy(tPosWas);
                  tgt.scale.setScalar(tSclWas);
                  tgt.updateMatrixWorld(true);
                }
              }
              // Hover-caption leg — every managed surface announces itself on
              // hover (WCAG 1.3.3), gaze-gated: strip → 'Tab strip', move bar
              // → 'Move bar', chrome → the page title/host, and entering tints
              // the material. Invoking the registered userData handlers
              // drives the same code the ray hover path fires.
              if (ctrl && app.tabManager && app.tabManager.stripMesh
                && app.tabManager.tabs && app.tabManager.tabs.length
                && app.scene) {
                const tm3 = app.tabManager;
                const wp3 = tm3.tabs[tm3.activeIndex];
                const gazeWas = app.settings.enableGazeDwell;
                try {
                  app.updateSetting('enableGazeDwell', true);
                  const stripH = tm3.stripMesh.userData
                    && tm3.stripMesh.userData.interactable;
                  const capsBefore15 = locoCaps.length;
                  if (stripH && stripH.onHover) { stripH.onHover(); }
                  out.stripHoverCaption = locoCaps.slice(capsBefore15)
                    .some((t3) => t3.includes('Tab strip'));
                  const mb = wp3 && wp3.moveBarMesh;
                  const chrome = wp3 && wp3.chromeMesh;
                  const mbH = mb && mb.userData && mb.userData.interactable;
                  const chH = chrome && chrome.userData
                    && chrome.userData.interactable;
                  const capsBefore16 = locoCaps.length;
                  if (mbH && mbH.onHover) { mbH.onHover(); }
                  out.moveBarHoverCaption = locoCaps.slice(capsBefore16)
                    .some((t3) => t3.includes('Move bar'));
                  // Chrome hover announces the loaded page's title, and
                  // entering tints the bar 0xaaaaff (restored on hoverEnd).
                  const titleWas = wp3.currentTitle;
                  const capsBefore17 = locoCaps.length;
                  if (chH && chH.onHover) { chH.onHover(); }
                  const chromeLabel = !!titleWas
                    && locoCaps.slice(capsBefore17)
                      .some((t3) => t3 === titleWas);
                  const tinted = chrome.material.color.getHex() === 0xaaaaff;
                  if (chH && chH.onHoverEnd) { chH.onHoverEnd(); }
                  out.chromeHoverCaption = chromeLabel && tinted
                    && chrome.material.color.getHex() === 0xffffff;
                  // Gaze gate: with gaze dwell off, hover announces nothing.
                  app.updateSetting('enableGazeDwell', false);
                  const capsBefore18 = locoCaps.length;
                  if (stripH && stripH.onHover) { stripH.onHover(); }
                  out.hoverGatedByGaze = locoCaps.slice(capsBefore18)
                    .every((t3) => !t3.includes('Tab strip'));
                } finally {
                  app.updateSetting('enableGazeDwell', gazeWas);
                }
              }
              } finally {
                ctrl.matrixWorld.copy(origMW6);
                rightSrc.gamepad.axes[2] = 0;
                app.updateSetting('enableSnapTurn', snapWas4);
                app.updateSetting('enableTeleport', telWas);
                app.updateSetting('motionSensitivity', msWas);
                app.updateSetting('enableComfort', comfWas);
                if (app.comfortSystem && msWas) {
                  app.comfortSystem.setPreset(msWas);
                }
                app.updateSetting('openSettingsSections', secsWas4);
                app.settings.enableGazeDwell = gazeWas4;
                if (app.teleport) {
                  app.teleport.active = false;
                  app.teleport.valid = false;
                }
                app._rebuildSettingsPanel();
                app.settingsPanel.visible = visWas4;
              }
            }
              } finally {
                rightSrc.gamepad.axes[2] = 0;
                ctrl.dispatchEvent({ type: 'disconnected' });
                ctrlL.dispatchEvent({ type: 'disconnected' });
                if (origLShow) {
                  app.captionSystem.show = origLShow;
                }
                if (origLPlay) {
                  app.hapticFeedback.playPattern = origLPlay;
                }
                app.settings.enableSmoothMove = false;
                app.settings.southpaw = false;
                app.playerRig.rotation.y = origYaw;
              }
            }
            // Settings panel real-button select: a toggle's onHover announces
            // its own label (force=true through _announceSettingsButton), so
            // the controller ray can FIND the 'Captions' toggle by caption —
            // then selectstart flips enableCaptions live (settings +
            // captionSystem.enabled) and a second select restores it. The
            // restore-select lands on captions-OFF, so its announce is
            // correctly silent (there is nothing to render it with) — only
            // state restoration is asserted there.
            if (ctrl && app.settingsPanel && app.captionSystem && app.settings) {
              const visWas = !!app.settingsPanel.visible;
              if (app.settingsPanel.visible !== true) {
                app.settingsPanel.visible = true;
                app.settingsPanel.mesh && (app.settingsPanel.mesh.visible = true);
              }
              // Hover announces are gaze-gated (shouldAnnounceSettingsButton:
              // captionsEnabled AND (force OR gazeDwell)) — enable the real
              // setting for the probe, restored in finally.
              const gazeWas = app.settings.enableGazeDwell;
              app.settings.enableGazeDwell = true;
              const panelObjs = app.interactables.filter((o) => {
                for (let p = o; p; p = p.parent) {
                  if (p === app.settingsPanel) { return true; }
                }
                return false;
              });
              const origMW3 = ctrl.matrixWorld.clone();
              const aimAt = (obj) => {
                const bp = obj.getWorldPosition(obj.position.clone());
                const camP = app.camera.getWorldPosition(bp.clone());
                const toC = camP.sub(bp).normalize();
                const cp = bp.clone().add(toC.multiplyScalar(0.35));
                ctrl.matrixWorld.lookAt(cp, bp, ctrl.up.clone());
                ctrl.matrixWorld.setPosition(cp);
              };
              try {
                const en0 = app.settings.enableCaptions;
                let capBtn = null;
                for (const obj of panelObjs) {
                  const before = capWrites.length;
                  aimAt(obj);
                  app.updateSystems(0, fakeXrFrame, 0.016);
                  if (capWrites.slice(before).join(' ').includes('Captions')) {
                    capBtn = obj;
                    break;
                  }
                }
                out.settingsProbe = !!capBtn;
                if (capBtn) {
                  ctrl.dispatchEvent({ type: 'selectstart' });
                  ctrl.dispatchEvent({ type: 'selectend' });
                  out.settingsOffLive = app.settings.enableCaptions === !en0
                    && app.captionSystem.enabled === !en0;
                  app.updateSystems(0, fakeXrFrame, 0.016);
                  const b2 = capWrites.length;
                  ctrl.dispatchEvent({ type: 'selectstart' });
                  ctrl.dispatchEvent({ type: 'selectend' });
                  out.settingsOnLive = app.settings.enableCaptions === en0
                    && app.captionSystem.enabled === en0;
                }
              } finally {
                ctrl.matrixWorld.copy(origMW3);
                if (app.settings.enableCaptions !== true) {
                  app.updateSetting('enableCaptions', true);
                }
                if (app.captionSystem.enabled !== true) {
                  app.captionSystem.enabled = true;
                }
                app.settingsPanel.visible = visWas;
                app.settingsPanel.mesh && (app.settingsPanel.mesh.visible = visWas);
                app.settings.enableGazeDwell = gazeWas;
              }
            }
            // Hand-input tracked arm: an inputSource with a truthy 'hand'
            // flips the hand group visible through update()'s seen-detector
            // and fires the debounced 'Right hand tracked' announce — the
            // counterpart of the inputsourceschange removal pin.
            if (app.handTracking && fakeSession.inputSources) {
              const handSrc = { handedness: 'right', hand: new Map(), profiles: [] };
              fakeSession.inputSources.push(handSrc);
              app.updateSystems(0, fakeXrFrame, 0.016);
              await new Promise((r) => setTimeout(r, 700));
              const rh = app.handTracking.rightHand;
              out.handTracked = rh && rh.visible === true
                && capWrites.some((t) => t.includes('Right hand tracked'));
              const li = fakeSession.inputSources.indexOf(handSrc);
              if (li >= 0) {
                fakeSession.inputSources.splice(li, 1);
              }
              app.updateSystems(0, fakeXrFrame, 0.016);
              await new Promise((r) => setTimeout(r, 700));
            }
            // The 2D-arm pause: DOM visibilitychange only fires when NOT
            // presenting — drive the document-level listener directly with
            // document.hidden shadowed true (getter-only on the prototype).
            if (iv) {
              iv.playing = true;
              const pcBeforeDoc = pauseCalls;
              Object.defineProperty(document, 'hidden',
                { get: () => true, configurable: true });
              document.dispatchEvent(new Event('visibilitychange'));
              delete document.hidden;
              out.docPaused = pauseCalls === pcBeforeDoc + 1
                && iv.playing === false;
            }
            // Pinch onset -> gestureCallbacks -> haptic tick. The callback
            // registration happens in onVRSessionStart; driving real joints
            // through updateHand needs XRHand pose faking, so seed the joint
            // records updateHand writes and drive recognizeGestures() — the
            // same seam the real pipeline feeds.
            const ht = app.handTracking;
            if (ht && app.hapticFeedback) {
              const hCalls = [];
              const origPlay = app.hapticFeedback.playPattern;
              app.hapticFeedback.playPattern = (h, p) => { hCalls.push(h + ':' + p); };
              const joints = ht.joints.right;
              const V3 = (x, y, z) => app.camera.position.clone().set(x, y, z);
              joints.set('wrist', { position: V3(0, 0, 0) });
              // Four fingers curled (tip < 1.6×metacarpal distance) so the
              // release state resolves 'none', not 'fist'; the middle finger
              // is extended only during the release step.
              for (const f of ['index-finger', 'middle-finger',
                'ring-finger', 'pinky-finger']) {
                joints.set(f + '-metacarpal', { position: V3(0.06, 0, 0) });
                joints.set(f + '-tip', { position: V3(0.089, 0, 0) });
              }
              joints.set('thumb-phalanx-proximal', { position: V3(0.05, 0, 0) });
              joints.set('thumb-tip', { position: V3(0.080, 0, 0) });
              const thumbTip = joints.get('thumb-tip').position;
              // Gesture state persists across legs — start from 'none' so
              // the first seeded pinch is a real onset.
              ht.gestures.right = 'none';
              const gBefore = ht.stats.gesturesRecognized;
              try {
                ht.recognizeGestures();
                out.pinchHapticOnset = hCalls.length === 1
                  && hCalls[0] === 'right:click'
                  && ht.gestures.right === 'pinch';
                // Held pinch is one onset, not one-per-frame.
                ht.recognizeGestures();
                out.pinchHeldOnce = hCalls.length === 1;
                // Hysteresis: gap between pinch (2cm) and release (3.5cm)
                // while wasPinching keeps the gesture.
                thumbTip.set(0.059, 0, 0);
                ht.recognizeGestures();
                out.pinchHysteresis = ht.gestures.right === 'pinch'
                  && hCalls.length === 1;
                // Release: gap > 3.5cm + a finger extended -> 'none'.
                thumbTip.set(0.04, 0, 0);
                joints.get('middle-finger-tip').position.set(0.15, 0, 0);
                ht.recognizeGestures();
                const released = ht.gestures.right === 'none';
                thumbTip.set(0.080, 0, 0);
                ht.recognizeGestures();
                out.pinchRefires = released
                  && hCalls.length === 2
                  && ht.stats.gesturesRecognized === gBefore + 2;
                // Fist (all curled, thumb not up) -> 'fist' -> impact haptic.
                // From a pinch state the release band is 3.5cm, so park the
                // thumb farther than that before curling to fist.
                thumbTip.set(0.14, 0, 0);
                joints.get('middle-finger-tip').position.set(0.089, 0, 0);
                ht.recognizeGestures();
                out.fistHaptic = ht.gestures.right === 'fist'
                  && hCalls[2] === 'right:impact';
                // Remaining detectGesture arms. Shape grammar: curled =
                // tip dist < 1.6x metacarpal dist; extended = far tip.
                const curled = (f) => joints.get(f + '-tip').position.set(0.089, 0, 0);
                const out0 = (f) => joints.get(f + '-tip').position.set(0.15, 0, 0);
                // point: only index extended, thumb down and clear of the
                // index tip (the pinch check runs first).
                thumbTip.set(0.10, -0.06, 0);
                out0('index-finger');
                ['middle-finger', 'ring-finger', 'pinky-finger'].forEach(curled);
                ht.recognizeGestures();
                out.shapePoint = ht.gestures.right === 'point';
                // open: all four extended.
                ['index-finger', 'middle-finger', 'ring-finger', 'pinky-finger']
                  .forEach(out0);
                ht.recognizeGestures();
                out.shapeOpen = ht.gestures.right === 'open';
                // thumbsup: four curled, thumb vector +Y — must beat 'fist'
                // (checked first on purpose: a curled fist shape with the
                // thumb up is the canonical thumbs-up).
                ['index-finger', 'middle-finger', 'ring-finger', 'pinky-finger']
                  .forEach(curled);
                joints.get('thumb-phalanx-proximal').position.set(0.05, 0, 0);
                thumbTip.set(0.05, 0.09, 0);
                ht.recognizeGestures();
                out.shapeThumbsUp = ht.gestures.right === 'thumbsup';
                // peace: index + middle extended.
                thumbTip.set(0.10, -0.06, 0);
                out0('index-finger');
                out0('middle-finger');
                ht.recognizeGestures();
                out.shapePeace = ht.gestures.right === 'peace';
              } finally {
                app.hapticFeedback.playPattern = origPlay;
                joints.clear();
                ht.gestures.right = 'none';
              }
            }
            // Full pipeline: a fake XRHand input source + fillPoses batch →
            // updateHand writes the joint records → hand visible →
            // recognizeGestures fires the pinch haptic — the same chain the
            // runtime drives at 90 Hz.
            if (ht && app.hapticFeedback && ht.rightHand) {
              const hpCalls = [];
              const origPlay2 = app.hapticFeedback.playPattern;
              app.hapticFeedback.playPattern = (h, p) => { hpCalls.push(h + ':' + p); };
              const spaceFor = {};
              const fakeHand = { get: (n) => spaceFor[n] };
              ht.jointNames.forEach((n) => { spaceFor[n] = { j: n }; });
              const handSrc = { handedness: 'right', hand: fakeHand };
              const poseFor = {};
              const origFill = fakeXrFrame.fillPoses;
              const origRadii = fakeXrFrame.fillJointRadii;
              fakeXrFrame.fillPoses = (spaces, _rs, poses) => {
                spaces.forEach((s, i) => {
                  const p = poseFor[s.j] || [0, 0, 0];
                  poses[i * 16 + 12] = p[0];
                  poses[i * 16 + 13] = p[1];
                  poses[i * 16 + 14] = p[2];
                });
                return true;
              };
              fakeXrFrame.fillJointRadii = (spaces, radii) => {
                radii.fill(0.008);
                return true;
              };
              try {
                // Curled fingers + near thumb/index tips → pinch via the
                // real batch path. Joint records were cleared by the
                // previous leg's finally — updateHand only writes into
                // records that exist, so reseed them at a NON-pinch default
                // (coincident joints resolve 'pinch' even if the batch
                // write never ran — the fillPoses write is load-bearing).
                const V3h = (x, y, z) => app.camera.position.clone().set(x, y, z);
                ht.jointNames.forEach((n) => {
                  ht.joints.right.set(n, {
                    position: app.camera.position.clone().set(0.5, 0.5, 0.5) });
                });
                // All-coincident resolves 'pinch' (dist 0) — park the index
                // tip so the default reads 'fist', not the target gesture.
                ht.joints.right.get('index-finger-tip')
                  .position.set(0.6, 0.5, 0.5);
                for (const f of ['index-finger', 'middle-finger',
                  'ring-finger', 'pinky-finger']) {
                  poseFor[f + '-metacarpal'] = [0.06, 0, 0];
                  poseFor[f + '-tip'] = [0.089, 0, 0];
                }
                poseFor['thumb-phalanx-proximal'] = [0.05, 0, 0];
                poseFor['thumb-tip'] = [0.080, 0, 0];
                poseFor.wrist = [0, 0, 0];
                fakeSession.inputSources.push(handSrc);
                ht.gestures.right = 'none';
                ht.update(fakeXrFrame, fakeRefSpace);
                out.handPoseDrives = ht.gestures.right === 'pinch'
                  && ht.rightHand.visible === true
                  && hpCalls.length === 1
                  && hpCalls[0] === 'right:click';
                // Source disappears mid-stream → seen-detector hides the
                // group and fires tracking-change (the update() arm, not
                // the inputsourceschange arm pinned earlier).
                fakeSession.inputSources.length = 0;
                ht.update(fakeXrFrame, fakeRefSpace);
                out.handLostViaUpdate = ht.rightHand.visible === false;

                // Per-joint fallback arm: fillPoses=false routes updateHand
                // to frame.getJointPose per joint (the low-level path real
                // runtimes take when batch pose fill is undeterminable).
                fakeXrFrame.fillPoses = () => false;
                fakeXrFrame.getJointPose = (space) => {
                  const p2 = space && poseFor[space.j];
                  return p2 ? { transform: { position: { x: p2[0], y: p2[1], z: p2[2] } }, radius: 0.012 } : null;
                };
                ht.jointNames.forEach((n) => {
                  ht.joints.right.set(n, {
                    position: app.camera.position.clone().set(0.5, 0.5, 0.5) });
                });
                ht.joints.right.get('index-finger-tip')
                  .position.set(0.6, 0.5, 0.5);
                ht.gestures.right = 'none';
                fakeSession.inputSources.push(handSrc);
                const fbCalls0 = hpCalls.length;
                ht.update(fakeXrFrame, fakeRefSpace);
                out.handFallbackDrives = ht.gestures.right === 'pinch'
                  && ht.rightHand.visible === true
                  && hpCalls.length - fbCalls0 === 1
                  && hpCalls[fbCalls0] === 'right:click';
                // null joint poses leave records untouched — the recognize
                // still runs (gesture + haptic route through) on the seeds.
                // Seed the fist grammar: metacarpals +0.06 / tips +0.089 off
                // the wrist (curled: tipDist < metaDist*1.6), thumb parked at
                // +0.14 so thumb-index gap clears the 3.5cm release band.
                fakeXrFrame.getJointPose = () => null;
                ht.jointNames.forEach((n) => {
                  ht.joints.right.set(n, {
                    position: app.camera.position.clone().set(0.5, 0.5, 0.5) });
                });
                ht.joints.right.get('wrist').position.set(0, 0, 0);
                for (const f2 of ['index-finger', 'middle-finger',
                  'ring-finger', 'pinky-finger']) {
                  ht.joints.right.get(f2 + '-metacarpal').position.set(0.06, 0, 0);
                  ht.joints.right.get(f2 + '-tip').position.set(0.089, 0, 0);
                }
                ht.joints.right.get('thumb-phalanx-proximal')
                  .position.set(0.05, 0, 0);
                ht.joints.right.get('thumb-tip').position.set(0.14, 0, 0);
                ht.gestures.right = 'none';
                const npCalls0 = hpCalls.length;
                ht.update(fakeXrFrame, fakeRefSpace);
                out.handNullPose = Math.abs(
                  ht.joints.right.get('thumb-tip').position.x - 0.14) < 1e-9
                  && ht.gestures.right === 'fist'
                  && hpCalls.length - npCalls0 === 1
                  && hpCalls[npCalls0] === 'right:impact';

                // Haptic actuator path: update(inputSources) registers
                // haptic-bearing gamepads so playPattern pulses reach
                // actuator.pulse — every earlier fake gamepad lacked
                // hapticActuators, so pulses silently no-oped until now.
                const hf = app.hapticFeedback;
                const actPulses = [];
                const hapSrc = {
                  handedness: 'right',
                  gamepad: {
                    hapticActuators: [{
                      pulse: (i2, d2) => {
                        actPulses.push(i2 + '/' + d2);
                        return Promise.resolve();
                      }
                    }]
                  }
                };
                hf.update([hapSrc]);
                await origPlay2.call(hf, 'right', 'click');
                out.hapticActuator = actPulses.length === 1
                  && actPulses[0] === '0.3/10';
                // Source leaving the stream drops its gamepad — the next
                // pulse is a no-op (the stale-registry leak the seen-prune
                // exists to prevent).
                hf.update([]);
                await origPlay2.call(hf, 'right', 'click');
                out.hapticSourceGone = actPulses.length === 1;
                // Complex-pattern sequence: 'notification' is
                // pulse(30,0.5) → pause(30) → pulse(30,0.5) — drives the
                // array-pattern for-loop and the pause-step wait() arm that
                // no pin ever reached (all earlier plays used the scalar
                // 'click'/'impact' arm).
                actPulses.length = 0;
                hf.update([hapSrc]);
                await origPlay2.call(hf, 'right', 'notification');
                out.hapticSequence = actPulses.length === 2
                  && actPulses.every(p => p === '0.5/30');
                // playPatternBothHands dedup: with a single registered
                // gamepad both hands resolve to the SAME gamepad via the
                // first-available fallback, so the pattern must fire once —
                // not twice — on that actuator.
                actPulses.length = 0;
                const spyPlay = hf.playPattern;
                hf.playPattern = origPlay2;
                await hf.playPatternBothHands('click');
                hf.playPattern = spyPlay;
                out.hapticBothHandsDedup = actPulses.length === 1;
                // playEffect fallback arm: an actuator exposing ONLY the
                // WebXR Gamepads Module API (playEffect, no pulse) takes the
                // 'dual-rumble' branch with strongMagnitude=intensity and
                // weakMagnitude=intensity*0.5 — never driven before.
                const fxCalls = [];
                const fxSrc = {
                  handedness: 'left',
                  gamepad: {
                    hapticActuators: [{
                      playEffect: (type, opts) => {
                        fxCalls.push(type + '/' + opts.duration + '/' +
                          opts.strongMagnitude + '/' + opts.weakMagnitude);
                        return Promise.resolve();
                      }
                    }]
                  }
                };
                hf.update([fxSrc]);
                await hf.pulse('left', 20, 0.5);
                out.hapticPlayEffect = fxCalls.length === 1
                  && fxCalls[0] === 'dual-rumble/20/0.5/0.25';
                // pulse() clamps duration to 1-5000ms and intensity to 0-1
                // before the actuator sees them.
                fxCalls.length = 0;
                await hf.pulse('left', 99999, 2.5);
                out.hapticClamps = fxCalls.length === 1
                  && fxCalls[0] === 'dual-rumble/5000/1/0.5';
                hf.update([]);

                // Listener pose + LOD tier path: updateListenerFromCamera
                // runs per frame off updateSystems, but no leg ever placed
                // a source across hrtfThreshold — the panner's positionX
                // writes and the HRTF<->equalpower switch were undriven.
                const sa = app.spatialAudio;
                if (sa && sa.context && sa.context.createPanner) {
                  if (!sa.sources.has('__lod')) {
                    sa.createSource('__lod', { volume: 0.01 });
                  }
                  const lod = sa.sources.get('__lod');
                  // Positions are listener-relative: earlier legs teleported
                  // the rig, so world-space constants land on either side of
                  // the threshold nondeterministically.
                  // Positions are listener-relative: earlier legs teleported
                  // the rig, so world-space constants land on either side of
                  // the threshold nondeterministically. A real PannerNode on
                  // the suspended context silently drops 'equalpower' writes
                  // (measured: dist-30 updateSourceLOD leaves 'HRTF'), so the
                  // tier DECISION is probed on a plain-object panner — the
                  // distance->targetModel contract is what the app owns; the
                  // node write self-heals per frame once the context resumes.
                  // Positions are listener-relative: earlier legs teleported
                  // the rig, so world-space constants land on either side of
                  // the threshold nondeterministically.
                  const lp = sa._listenerPos;
                  sa.setSourcePosition('__lod', lp.x, lp.y, lp.z - 30);
                  sa.updateListenerFromCamera(app.camera);
                  const far = lod.panner.panningModel;
                  sa.setSourcePosition('__lod', lp.x, lp.y, lp.z - 1);
                  sa.updateListenerFromCamera(app.camera);
                  out.audioLodSwitch = sa.settings.enableHRTF === true
                    && far === 'equalpower'
                    && lod.panner.panningModel === 'HRTF';
                  const cw = V3h(0, 0, 0);
                  app.camera.getWorldPosition(cw);
                  out.audioListenerPose = Math.abs(sa._listenerPos.x - cw.x) < 1e-9
                    && Math.abs(sa._listenerPos.y - cw.y) < 1e-9
                    && Math.abs(sa._listenerPos.z - cw.z) < 1e-9
                    && (sa.listener.positionX === undefined
                      || Math.abs(sa.listener.positionX.value - cw.x) < 1e-6);
                  // setMasterVolume forEach arm: the settings pin only
                  // watches settings.masterVolume — the write it makes into
                  // every live source's real GainNode was never observed.
                  const masterWas = sa.settings.masterVolume;
                  sa.setMasterVolume(0.4);
                  const gainSeen = lod.gain ? lod.gain.gain.value : null;
                  sa.setMasterVolume(masterWas);
                  out.audioMasterGain = !!lod.gain
                    && Math.abs(gainSeen - lod.volume * 0.4) < 1e-9;
                  // updateAllLOD aggregates per-tier source counts into
                  // stats — the bookkeeping itself was never observed
                  // (only the panner-model flip was pinned above).
                  const h0 = sa.stats.hrtfSources;
                  const e0 = sa.stats.equalPowerSources;
                  sa.setSourcePosition('__lod', lp.x, lp.y, lp.z - 30);
                  sa.updateAllLOD();
                  const farStats = sa.stats.hrtfSources === h0 - 1
                    && sa.stats.equalPowerSources === e0 + 1;
                  sa.setSourcePosition('__lod', lp.x, lp.y, lp.z - 1);
                  sa.updateAllLOD();
                  out.audioLodStats = farStats
                    && sa.stats.hrtfSources === h0
                    && sa.stats.equalPowerSources === e0;
                  // setListenerOrientation: the forward/up AudioParam writes
                  // were undriven — audioListenerPose only pins positionX.
                  // Rotate the camera to a fresh orientation first: with the
                  // pose unchanged a dropped param write leaves a matching
                  // stale value and the pin can't detect it.
                  const rotYWas = app.camera.rotation.y;
                  app.camera.rotation.y = rotYWas + Math.PI / 3;
                  app.camera.updateMatrixWorld(true);
                  sa.updateListenerFromCamera(app.camera);
                  const ef = V3h(0, 0, -1).applyQuaternion(sa._camQuat);
                  const eu = V3h(0, 1, 0).applyQuaternion(sa._camQuat);
                  out.audioListenerOrient = sa.listener.forwardX === undefined
                    || (Math.abs(sa.listener.forwardX.value - ef.x) < 1e-6
                      && Math.abs(sa.listener.forwardZ.value - ef.z) < 1e-6
                      && Math.abs(sa.listener.upY.value - eu.y) < 1e-6);
                  app.camera.rotation.y = rotYWas;
                  app.camera.updateMatrixWorld(true);
                  // setSourcePosition also writes the real PannerNode's
                  // positionX/Y/Z AudioParams — the pins above only saw the
                  // recorded {x,y,z} field and the LOD side effect.
                  out.audioSourcePosWrite = lod.panner.positionX === undefined
                    || (Math.abs(lod.panner.positionX.value - lp.x) < 1e-6
                      && Math.abs(lod.panner.positionY.value - lp.y) < 1e-6
                      && Math.abs(lod.panner.positionZ.value - (lp.z - 1)) < 1e-6);
                  sa.sources.delete('__lod');
                }

                // Real playback path: earlier legs spy'd play() calls, so
                // BufferSource creation, panner connect, isPlaying and the
                // sourcesActive count + restart onended clobber guard were
                // undriven. Real AudioContext nodes back every assertion.
                const sa2 = app.spatialAudio;
                if (sa2 && sa2.buffers && sa2.buffers.has('click')) {
                  // 'click' may still be flagged playing from earlier real
                  // play() calls on the suspended context (onended never
                  // fires while suspended). Normalize the baseline first.
                  sa2.stop('click');
                  const act0 = sa2.stats.sourcesActive;
                  sa2.play('click', 'click', { x: 0, y: 1, z: -1 });
                  const clickSrc = sa2.sources.get('click');
                  const n1 = clickSrc.node;
                  out.audioPlayDrives = sa2.stats.sourcesActive === act0 + 1
                    && clickSrc.isPlaying === true
                    && clickSrc.position.z === -1
                    && !!n1 && n1.buffer === sa2.buffers.get('click');
                  // Restart: the old node's late onended must not clobber the
                  // new playback's state or double-count sourcesActive.
                  sa2.play('click', 'click');
                  const n2 = clickSrc.node;
                  if (n1 && typeof n1.onended === 'function') {
                    n1.onended();
                  }
                  out.audioRestartGuard = sa2.stats.sourcesActive === act0 + 1
                    && clickSrc.isPlaying === true
                    && clickSrc.node === n2;
                  sa2.stop('click');
                  out.audioStopBooks = clickSrc.isPlaying === false
                    && sa2.stats.sourcesActive === act0
                    && clickSrc.node === null;
                  // loadAudio: fetch → decodeAudioData → buffers.set +
                  // buffersLoaded bookkeeping, plus the buffers.has early-
                  // return cache arm (second load must not re-fetch/decode).
                  const fetchWas9 = globalThis.fetch;
                  const decCalls = [];
                  const origDec = sa2.context.decodeAudioData;
                  const buf0 = sa2.stats.buffersLoaded;
                  try {
                    globalThis.fetch = () => Promise.resolve({
                      ok: true,
                      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
                    });
                    sa2.context.decodeAudioData = (ab) => {
                      decCalls.push(ab.byteLength);
                      return Promise.resolve({ _fake: true, duration: 1 });
                    };
                    const loaded = await sa2.loadAudio(
                      'https://audio-seed.example/clip.ogg', '__fetchbuf');
                    const again = await sa2.loadAudio(
                      'https://audio-seed.example/clip.ogg', '__fetchbuf');
                    out.audioLoadFetch = !!loaded
                      && decCalls.length === 1
                      && decCalls[0] === 8
                      && sa2.buffers.get('__fetchbuf') === loaded
                      && sa2.stats.buffersLoaded === buf0 + 1
                      && again === loaded;
                  } finally {
                    globalThis.fetch = fetchWas9;
                    sa2.context.decodeAudioData = origDec;
                    sa2.buffers.delete('__fetchbuf');
                  }
                  // loop + playbackRate options reach the real BufferSource
                  // node on play() — only 'click'-style scalar options were
                  // ever exercised before.
                  sa2.createSource('__loop', { loop: true, playbackRate: 1.5, volume: 0.01 });
                  sa2.play('__loop', 'click');
                  const loopSrc = sa2.sources.get('__loop');
                  out.audioLoopSource = !!loopSrc && !!loopSrc.node
                    && loopSrc.node.loop === true
                    && Math.abs(loopSrc.node.playbackRate.value - 1.5) < 1e-9;
                  sa2.stop('__loop');
                  sa2.sources.delete('__loop');
                  // createSource option writes onto the real PannerNode:
                  // distance params always apply; the directional arm
                  // writes the cone params (coneOuterGain 0 must survive —
                  // a || fallback would leak 0.3).
                  sa2.createSource('__dir', {
                    directional: true, coneInnerAngle: 45, coneOuterGain: 0,
                    refDistance: 2, rolloffFactor: 2
                  });
                  const dirP = sa2.sources.get('__dir').panner;
                  out.audioSourceParams = !!dirP
                    && dirP.coneInnerAngle === 45
                    && dirP.coneOuterAngle === 120
                    && dirP.coneOuterGain === 0
                    && dirP.refDistance === 2
                    && dirP.rolloffFactor === 2;
                  sa2.sources.delete('__dir');
                }
              } finally {
                app.hapticFeedback.playPattern = origPlay2;
                fakeXrFrame.fillPoses = origFill;
                fakeXrFrame.fillJointRadii = origRadii;
                ht.gestures.right = 'none';
                ht.joints.right.clear();
              }
            }
            // Hand-tracking transitions + internals: a lost hand regained
            // fires _onTrackingChange (the debounced WCAG 4.1.3 announce
            // path — update()'s arm, not inputsourceschange's), a swapped
            // XRHand object rebuilds the fillPoses batch, joint radii scale
            // the instance matrix, and tracking quality tints the material.
            if (ht && ht.rightHand) {
              const trCalls = [];
              const ocb = ht._onTrackingChange;
              const oFP2 = fakeXrFrame.fillPoses;
              const oFR2 = fakeXrFrame.fillJointRadii;
              ht._onTrackingChange = (h2, t2) => {
                trCalls.push(h2 + ':' + t2);
                if (ocb) { ocb(h2, t2); }
              };
              try {
                const spaceFor2 = {};
                ht.jointNames.forEach((n) => { spaceFor2[n] = { j: n }; });
                const handA = { get: (n) => spaceFor2[n] };
                const poseFor2 = {};
                ht.jointNames.forEach((n) => { poseFor2[n] = [0.5, 0.5, 0.5]; });
                poseFor2.wrist = [0, 0, 0];
                poseFor2['thumb-tip'] = [0.14, 0, 0];
                poseFor2['thumb-phalanx-proximal'] = [0.05, 0, 0];
                for (const f3 of ['index-finger', 'middle-finger',
                  'ring-finger', 'pinky-finger']) {
                  poseFor2[f3 + '-metacarpal'] = [0.06, 0, 0];
                  poseFor2[f3 + '-tip'] = [0.089, 0, 0];
                }
                fakeXrFrame.fillPoses = (spaces, _rs, poses) => {
                  spaces.forEach((s, i) => {
                    const p = poseFor2[s.j] || [0, 0, 0];
                    poses[i * 16 + 12] = p[0];
                    poses[i * 16 + 13] = p[1];
                    poses[i * 16 + 14] = p[2];
                  });
                  return true;
                };
                fakeXrFrame.fillJointRadii = (spaces, radii) => {
                  spaces.forEach((s, i) => {
                    radii[i] = s.j === 'wrist' ? 0.016 : 0.008;
                  });
                  return true;
                };
                // updateHand only writes into records that exist — reseed
                // them far away so a real batch write is observable.
                ht.jointNames.forEach((n) => {
                  ht.joints.right.set(n, {
                    position: app.camera.position.clone().set(0.9, 0.9, 0.9) });
                });
                fakeSession.inputSources.length = 0;
                ht.rightHand.visible = false;
                fakeSession.inputSources.push({ handedness: 'right', hand: handA });
                ht.update(fakeXrFrame, fakeRefSpace);
                out.htRegain = trCalls.includes('right:true')
                  && ht.rightHand.visible === true;
                // A NEW XRHand object (reconnect / fresh input source) must
                // rebuild the fillPoses batch — batch.hand !== .hand reseeds.
                const handB = { get: (n) => spaceFor2[n] };
                fakeSession.inputSources[0] = { handedness: 'right', hand: handB };
                ht.update(fakeXrFrame, fakeRefSpace);
                out.htBatchRebuild = !!ht._batch.right
                  && ht._batch.right.hand === handB
                  && Math.abs(ht.joints.right.get('wrist').position.x) < 1e-9;
                // radii>0 scales the instance matrix (wrist 0.016 -> 2.0x at
                // index 0, m[0]) and full-quality tracking tints opacity 0.8.
                const im = ht._jointMesh.right.instanceMatrix.array;
                out.htJointScale = Math.abs(im[0] - 2) < 1e-6
                  && Math.abs(ht._jointMesh.right.material.opacity - 0.8) < 1e-6;
                // radii<=0 falls back to the 8mm default + half-quality tint.
                fakeXrFrame.fillJointRadii = (spaces, radii) => {
                  radii.fill(0);
                  return true;
                };
                ht.update(fakeXrFrame, fakeRefSpace);
                out.htJointTint = Math.abs(im[0] - 1) < 1e-6
                  && Math.abs(ht._jointMesh.right.material.opacity - 0.6) < 1e-6;
                // Per-joint fallback: a frame without fillPoses takes the
                // getJointPose loop — XRHand.get per name, jointPose.radius
                // || 8mm instance scale, and truthy-radius quality (1.0).
                fakeXrFrame.fillPoses = undefined;
                fakeXrFrame.fillJointRadii = undefined;
                fakeXrFrame.getJointPose = (joint, space) => ({
                  transform: { position: { x: 0.11, y: 0.22, z: 0.33 } },
                  radius: 0.012
                });
                ht.jointNames.forEach((n) => {
                  ht.joints.right.set(n, {
                    position: app.camera.position.clone().set(0.9, 0.9, 0.9) });
                });
                ht.update(fakeXrFrame, fakeRefSpace);
                out.htFallbackPose =
                  Math.abs(ht.joints.right.get('wrist').position.x - 0.11) < 1e-9
                  && Math.abs(ht.joints.right.get('wrist').position.y - 0.22) < 1e-9
                  && Math.abs(im[0] - 1.5) < 1e-6
                  && Math.abs(ht._jointMesh.right.material.opacity - 0.8) < 1e-6;
                // Zero/absent radius -> 8mm scale + half-quality tint; a null
                // jointPose skips the joint — record and 'seen' untouched.
                fakeXrFrame.getJointPose = (joint, space) =>
                  (joint && joint.j === 'wrist' ? null
                    : { transform: { position: { x: 0.4, y: 0.4, z: 0.4 } },
                      radius: 0 });
                ht.joints.right.get('wrist').position.set(0.7, 0.7, 0.7);
                ht.update(fakeXrFrame, fakeRefSpace);
                out.htFallbackSkips =
                  Math.abs(ht.joints.right.get('wrist').position.x - 0.7) < 1e-9
                  && Math.abs(im[16] - 1) < 1e-6
                  && Math.abs(ht._jointMesh.right.material.opacity - 0.6) < 1e-6;
                fakeXrFrame.getJointPose = undefined;
                // dispose(): detach the inputsourceschange listener from its
                // session, scene.remove both hand groups, clear joint/gesture
                // maps and the fillPoses batch cache, enabled=false.
                const HT2 = ht.constructor;
                const sessCalls = { l: null, removed: [] };
                const ht2 = new HT2(app.renderer, app.scene);
                await ht2.initialize({
                  inputSources: [],
                  addEventListener(t, cb) { sessCalls.l = cb; },
                  removeEventListener(t, cb) { sessCalls.removed.push(cb); }
                });
                const lh2 = ht2.leftHand;
                ht2.dispose();
                out.htDispose = ht2.enabled === false
                  && sessCalls.removed.length === 1
                  && sessCalls.removed[0] === sessCalls.l
                  && ht2.session === null
                  && ht2._onInputSourcesChange === null
                  && lh2 && lh2.parent === null
                  && ht2.joints.left.size === 0
                  && ht2.joints.right.size === 0
                  && ht2.gestureCallbacks.size === 0
                  && ht2._batch.left === null
                  && ht2._batch.right === null;
                // Gesture heuristics: seed joints.right records and run
                // recognizeGestures directly — the finger-extension ratio
                // (tip > metacarpal x1.6), the thumb-up vector, and the arm
                // ORDERING (thumbsup before fist, extension masks for
                // point/peace) need no XRFrame plumbing.
                const seedGesture = (ext, thumbProx, thumbTip) => {
                  ht.jointNames.forEach((n) => {
                    ht.joints.right.set(n, {
                    position: app.camera.position.clone().set(0.5, 0.5, 0.5) });
                  });
                  ht.joints.right.get('wrist').position.set(0, 0, 0);
                  for (const f of ['index-finger', 'middle-finger',
                    'ring-finger', 'pinky-finger']) {
                    ht.joints.right.get(f + '-metacarpal')
                      .position.set(0.06, 0, 0);
                    ht.joints.right.get(f + '-tip')
                      .position.set(ext.includes(f) ? 0.15 : 0.089, 0, 0);
                  }
                  ht.joints.right.get('thumb-phalanx-proximal')
                    .position.set(thumbProx[0], thumbProx[1], thumbProx[2]);
                  ht.joints.right.get('thumb-tip')
                    .position.set(thumbTip[0], thumbTip[1], thumbTip[2]);
                  ht.gestures.right = 'none';
                };
                // peace: index+middle extended — and the gestureCallbacks
                // dispatch arm fires the registered callback once with
                // (handedness, gesture).
                const peaceCalls = [];
                ht.gestureCallbacks.set('peace', (hand, g) => {
                  peaceCalls.push(hand + ':' + g);
                });
                seedGesture(['index-finger', 'middle-finger'], [0.05, 0, 0],
                  [0.14, -0.05, 0]);
                ht.recognizeGestures();
                out.htGesturePeace = ht.gestures.right === 'peace'
                  && peaceCalls.length === 1
                  && peaceCalls[0] === 'right:peace';
                ht.gestureCallbacks.delete('peace');
                // mask: index+ring extended matches no grammar arm — the
                // point/peace masks demand specific others stay curled.
                seedGesture(['index-finger', 'ring-finger'], [0.05, 0, 0],
                  [0.14, -0.05, 0]);
                ht.recognizeGestures();
                out.htGestureMask = ht.gestures.right === 'none';
              } finally {
                ht._onTrackingChange = ocb;
                ht._batch.right = null;
                ht.joints.right.clear();
                ht.gestures.right = 'none';
                ht.rightHand.visible = false;
                fakeSession.inputSources.length = 0;
                fakeXrFrame.fillPoses = oFP2;
                fakeXrFrame.fillJointRadii = oFR2;
              }
            }
            // End through the real 'sessionend' listener too.
            app.renderer.xr.dispatchEvent({ type: 'sessionend' });
            out.sessEnded = app.isVREnabled === false;
            out.sessIvStopped = stopCalls >= 1;
            out.sessHandOff = !(app.handTracking && app.handTracking.enabled === true);
            out.sessLayersGone = app.layersSystem === null;
            out.sessLaddersNull = app._rateLadder === null
              && app._viewScaleLadder === null;
            out.sessFpsBack = app.settings.targetFPS === tfpsBefore;
            out.capWrites = capWrites;
            } catch (e) {
              out.sessError = String(e && e.stack ? e.stack : e).split('\\n').slice(0, 3).join(' | ');
            }
          } finally {
            if (origAnnounceCap) {
              sd.announceCaption = origAnnounceCap;
            }
            if (origRecenter) {
              app.recenter = origRecenter;
            }
            if (iv) {
              // Own-prop delete restores the prototype method — assigning a
              // captured bound function leaves a stale own-prop behind when
              // the capture was skipped (which is exactly what made
              // iv.togglePause an old stub in a later leg).
              delete iv.togglePause;
              delete iv.stop;
            }
            if (origGetSession) {
              xr.getSession = origGetSession;
            }
            if (origGetRef) {
              xr.getReferenceSpace = origGetRef;
            }
          }
        }
        // JA locale leg — every announce path above ran under the EN catalog.
        // t() reads currentLang live, so flipping the language must flip
        // producer output on the ARIA mirrors too: the WCAG 3.1.2 contract
        // the whole i18n work exists for, and the only way 'English literal
        // under JA' defects (the loadFailedPrefix class) are visible.
        // Restores EN before returning.
        if (window.QuiBrowser && typeof window.QuiBrowser.setLanguage === 'function') {
          const jaTab = app.tabManager && app.tabManager.getActiveTab();
          window.QuiBrowser.setLanguage('ja');
          out.jaHtmlLang = document.documentElement.lang === 'ja';
          if (jaTab && typeof jaTab.onToggleBookmark === 'function') {
            // A real producer under JA: star-toggle → 'vr.msg.bookmarked'
            // through the caption status mirror.
            jaTab.onToggleBookmark('https://ja-leg.example/', 'JA leg');
            out.jaToggleCap = statusEl ? statusEl.textContent : '';
            jaTab.onToggleBookmark('https://ja-leg.example/', 'JA leg');
          }
          if (jaTab && typeof jaTab.onLoadError === 'function') {
            // The loadFailedPrefix composition under JA — the exact site the
            // last English-literal fix landed on.
            jaTab.onLoadError('https://ja-err.example/');
            out.jaErrToast = alertEl ? alertEl.textContent : '';
          }
          window.QuiBrowser.setLanguage('en');
          if (jaTab && typeof jaTab.onLoadError === 'function') {
            jaTab.onLoadError('https://en-err.example/');
            out.enErrToast = alertEl ? alertEl.textContent : '';
          }
        }
        // ==== batch 47: dispose() teardown contract — runs LAST inside the
        // eval. Every check below observes state/spies captured BEFORE
        // app.dispose() because the app cannot be used afterwards. ====
        {
          const xr3 = app.renderer && app.renderer.xr;
          let sessionEnded3 = false;
          const gsWas3 = xr3 && xr3.getSession;
          if (xr3) {
            xr3.getSession = () => ({ end: () => { sessionEnded3 = true; return Promise.resolve(); } });
          }
          const calls3 = [];
          const salWas3 = app.renderer && app.renderer.setAnimationLoop;
          if (app.renderer) {
            app.renderer.setAnimationLoop = (cb) => { calls3.push(cb); if (salWas3) salWas3.call(app.renderer, cb); };
          }
          const dispCounts = {};
          const spyDisp = (obj, name) => {
            if (obj && typeof obj.dispose === 'function') {
              const was = obj.dispose;
              obj.dispose = () => { dispCounts[name] = (dispCounts[name] || 0) + 1; return was.call(obj); };
            }
          };
          ['comfortSystem', 'ffrSystem', 'textureManager', 'spatialAudio',
            'gazeInteraction', 'captionSystem', 'semanticDOM', 'handTracking',
            'windowManager', 'tabManager', 'immersiveVideo', 'voiceCommands',
            'layersSystem'].forEach((n) => spyDisp(app[n], n));
          const sizes3 = [];
          const ssWas3 = app.renderer && app.renderer.setSize;
          if (app.renderer) {
            app.renderer.setSize = (w, h) => { sizes3.push([w, h]); if (ssWas3) ssWas3.call(app.renderer, w, h); };
          }
          const caps3 = [];
          const capShowWas3 = app.captionSystem && app.captionSystem.show;
          if (app.captionSystem) {
            app.captionSystem.show = (m) => { caps3.push(m); };
          }
          const motionMQ3 = app._osMotionMQ;
          const gazeRM3 = [];
          if (app.gazeInteraction && typeof app.gazeInteraction.setReducedMotion === 'function') {
            const srmWas3 = app.gazeInteraction.setReducedMotion;
            app.gazeInteraction.setReducedMotion = (v) => { gazeRM3.push(v); return srmWas3.call(app.gazeInteraction, v); };
          }
          let toastCb3 = false;
          if (app._toastTimers && typeof app._toastTimers.add === 'function') {
            app._toastTimers.add(setTimeout(() => { toastCb3 = true; }, 60));
          }
          let enterClicked3 = false;
          const btn3 = app.vrButton;
          if (btn3) {
            btn3.click = () => { enterClicked3 = true; };
          }
          const hfWas3 = app.hapticFeedback;
          let rendererDisposed3 = 0;
          const rdWas3 = app.renderer && app.renderer.dispose;
          if (app.renderer) {
            app.renderer.dispose = () => { rendererDisposed3++; if (rdWas3) rdWas3.call(app.renderer); };
          }
          let travCalls3 = 0;
          const stWas3 = app.scene && app.scene.traverse;
          if (app.scene) {
            app.scene.traverse = (cb) => { travCalls3++; return stWas3.call(app.scene, cb); };
          }
          const domEl3 = app.renderer && app.renderer.domElement;
          const ceWas3 = console.error;
          console.error = () => {};
          const btnConnectedWas3 = !!(btn3 && btn3.isConnected);
          try {
            // Arm the debounce before teardown so dispose()'s cancel() is the
            // only thing standing between this resize and a post-mortem
            // setSize on a freed renderer.
            window.dispatchEvent(new Event('resize'));
            app.dispose();
            out.disposeEndsSession = sessionEnded3 === true;
            out.disposeStopsLoop = calls3.length === 1 && calls3[0] === null && app._loopArmed === false;
            const calls3AtDispose = calls3.length;
            if (domEl3) domEl3.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
            out.disposeDetachesContext = calls3.length === calls3AtDispose && caps3.length === 0;
            window.dispatchEvent(new Event('resize'));
            await new Promise((r) => setTimeout(r, 250));
            out.disposeDetachesResize = sizes3.length === 0;
            if (motionMQ3) {
              motionMQ3.dispatchEvent(Object.assign(new Event('change'), { matches: true }));
            }
            out.disposeDetachesMQL = gazeRM3.length === 0;
            window.dispatchEvent(new Event('enter-vr'));
            out.disposeDetachesEnterVR = enterClicked3 === false;
            await new Promise((r) => setTimeout(r, 90));
            out.disposeClearsToastTimers = app._toastTimers.size === 0 && toastCb3 === false;
            // textureManager/layersSystem are already null here — earlier legs
            // disposed them (their own dispose pins cover that path), so the
            // contract is only asserted on subsystems still live at teardown.
            out.disposeTearsDownSystems = ['comfortSystem', 'ffrSystem',
              'spatialAudio', 'gazeInteraction', 'captionSystem', 'semanticDOM',
              'handTracking', 'windowManager', 'tabManager', 'immersiveVideo',
              'voiceCommands']
              .every((n) => dispCounts[n] === 1);
            out.disposeNullsFields = app.vrKeyboard === null && app.hapticFeedback === null
              && app.layersSystem === null && app.immersiveVideo === null
              && app.bookmarkPanel === null && app._renderBound === null
              && app._osMotionMQ === null && app._onWindowResize === null
              && app._canvasObserver === null && btnConnectedWas3 === true
              && !!(app.vrButton) && app.vrButton.isConnected === false
              && hfWas3 && hfWas3.enabled === false;
            out.disposeGpuTeardown = rendererDisposed3 === 1 && travCalls3 === 1
              && !!app._sharedGeometries && app._sharedGeometries.size === 0;
          } finally {
            console.error = ceWas3;
            if (xr3) {
              if (gsWas3) { xr3.getSession = gsWas3; } else { delete xr3.getSession; }
            }
          }
        }
        return out;
      })()`,
      awaitPromise: true,
      returnByValue: true
    }, sessionId);
    const iout = ir.result?.result?.value || {};
    if (!iout.dom) {
      console.warn('eval problem:', JSON.stringify(ir.result?.exceptionDetails || ir.error || ir).slice(0, 600));
    }
    if (iout.b3Error) {
      console.warn('batch3 threw:', iout.b3Error);
    }
    if (iout.b4Error) {
      console.warn('batch4 threw:', iout.b4Error);
    }
    if (iout.sessError) {
      console.warn('session leg threw:', iout.sessError);
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
      tmRestoreCorrupt: iout.tmRestoreCorrupt === true,
      tmRestoreSkip: iout.tmRestoreSkip === true,
      tmRestoreClamp: iout.tmRestoreClamp === true,
      tmRestoreActive: iout.tmRestoreActive === true,
      tmSerializeReindex: iout.tmSerializeReindex === true,
      tmSerializeBlankActive: iout.tmSerializeBlankActive === true,
      tmSerializeEmpty: iout.tmSerializeEmpty === true,
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
      bpPanelZones: iout.bpPanelZones === true,
      bpRowNavigates: iout.bpRowNavigates === true,
      bpRowDeletes: iout.bpRowDeletes === true,
      bpCloseZone: iout.bpCloseZone === true,
      bpIntersectionArm: iout.bpIntersectionArm === true,
      bpBookmarkRows: iout.bpBookmarkRows === true,
      bpDeleteBookmarkArm: iout.bpDeleteBookmarkArm === true,
      bpScrollMaxClamp: iout.bpScrollMaxClamp === true,
      bpClampOnDelete: iout.bpClampOnDelete === true,
      bpHoverCap: (iout.bpHoverCap || '').includes('Bookmarks panel'),
      videoPrompt: (iout.videoPrompt || '').includes('Enter video URL'),
      videoActive: iout.videoActive === true,
      videoStopped: iout.videoStopped === true,
      voiceSearch: iout.voiceSearchNav === true
        && (iout.voiceSearchCap || '').includes('検索'),
      voiceTop: iout.voiceTopNav === true
        && (iout.voiceTopCap || '').includes('よく使うサイト'),
      voiceClear: iout.voiceCleared === true
        && (iout.voiceClearCap || '').includes('履歴を消去'),
      voiceVol: iout.voiceVolUp === true
        && (iout.voiceVolCap || '').includes('音量'),
      voiceBack: iout.voiceBackUrl === 'https://voice-search.example'
        && (iout.voiceBackCap || '').includes('戻り'),
      voiceFwd: iout.voiceFwdUrl === 'https://harness-top.example/'
        && iout.voiceFwdUrl !== iout.voiceBackUrl
        && (iout.voiceFwdCap || '').includes('進み'),
      voiceBm: (iout.voiceBmCap || '').includes('ブックマークパネル'),
      voiceIme: iout.voiceImeShown === true,
      voiceNoMatch: iout.voiceNoMatch === true,
      voiceVolDown: iout.voiceVolDown === true,
      voiceRefresh: iout.voiceRefresh === true,
      voiceGoTo: iout.voiceGoToUrl === 'https://voicegoto.example'
        && (iout.voiceGoToCap || '').includes('開き'),
      voiceGoToFb: (iout.voiceGoToFbUrl || '').includes('duckduckgo.com')
        && (iout.voiceGoToFbCap || '').includes('開き'),
      voiceHelp: (iout.voiceHelpCap || '').includes('コマンド'),
      voiceKb: iout.voiceKbHidden === true
        && (iout.voiceKbCap || '').includes('キーボード'),
      voiceScroll: iout.voiceScrollDn === 8 && iout.voiceScrollUp === 0,
      voiceVrEnter: iout.voiceVrEnter === true,
      voiceVrExit: iout.voiceVrExit === true,
      voiceLifecycle: iout.voiceLifecycle === true,
      voiceRestart: iout.voiceRestart === true,
      voiceDispose: iout.voiceDispose === true,
      vidHoverCap: iout.vidHoverCap === true,
      vidStopCaption: iout.vidStopCaption === true,
      wpDisposeTeardown: iout.wpDisposeTeardown === true,
      wpDisposeAborts: iout.wpDisposeAborts === true,
      bpDisposeTeardown: iout.bpDisposeTeardown === true,
      audioDispose: iout.audioDispose === true,
      voiceConfGate: iout.voiceConfGate === true,
      voiceConfZero: iout.voiceConfZero === true,
      voiceInterim: iout.voiceInterim === true,
      voiceWakeGate: iout.voiceWakeGate === true,
      voiceSpeakParams: iout.voiceSpeakParams === true,
      voiceExecStats: iout.voiceExecStats === true,
      voiceFailedCb: iout.voiceFailedCb === true,
      bmDedupeVisits: iout.bmDedupeVisits === true,
      bmTitleGuard: iout.bmTitleGuard === true,
      bmRemoveFilter: iout.bmRemoveFilter === true,
      bmTopSites: iout.bmTopSites === true,
      bmTrim: iout.bmTrim === true,
      voiceStop: iout.voiceStopped === true
        && (iout.voiceStopCap || '').includes('停止'),
      sessStart: iout.sessStart === true && iout.sessReadyCap === true,
      sessFps: iout.sessFps === 90,
      sessHand: iout.sessHand === true,
      sessFfrOff: iout.sessFfrOff === true,
      handBornHidden: iout.handBornHidden === true,
      handHiddenOnRemove: iout.handHiddenOnRemove === true,
      handLostCap: iout.handLostCap === true,
      handLostOnce: iout.handLostOnce === true,
      sessVisPaused: iout.sessVisPaused === true,
      sessVisNoDouble: iout.sessVisNoDouble === true,
      sessReset: iout.sessReset === true,
      sessFpsKept: iout.sessFpsKept === true,
      sessScaleFirst: iout.sessScaleFirst === true,
      sessScaleSecond: iout.sessScaleSecond === true,
      sessRateDrop: iout.sessRateDrop === true,
      sessOverrideSkips: iout.sessOverrideSkips === true,
      ctrlFirstQuiet: iout.ctrlFirstQuiet === true,
      ctrlDisc: iout.ctrlDiscCap === true,
      ctrlReconn: iout.ctrlReconnCap === true,
      squeezeCancelled: iout.squeezeCancelled === true,
      hoverEnter: iout.hoverEnter === true,
      selectHit: iout.selectHit === true,
      hoverExit: iout.hoverExit === true,
      selectMissQuiet: iout.selectMissQuiet === true,
      hitNearest: iout.hitNearest === true,
      hitSkipsHidden: iout.hitSkipsHidden === true,
      hoverStableNoRefire: iout.hoverStableNoRefire === true,
      aimLands: iout.aimLands === true,
      teleportLands: iout.teleportLands === true,
      teleportHaptic: iout.teleportHaptic === true,
      teleportMiss: iout.teleportMiss === true,
      teleportCancelDisc: iout.teleportCancelDisc === true,
      teleportSurvivesDisc: iout.teleportSurvivesDisc === true,
      fanCore: iout.fanCore === true,
      fanUI: iout.fanUI === true,
      fanA11y: iout.fanA11y === true,
      fanWin: iout.fanWin === true,
      fanNullFrame: iout.fanNullFrame === true,
      gazeSelect: iout.gazeSelect === true,
      gazeCross: iout.gazeCross === true,
      gazeOnce: iout.gazeOnce === true,
      gazeDisabledQuiet: iout.gazeDisabledQuiet === true,
      grabStarts: iout.grabStarts === true,
      grabDrags: iout.grabDrags === true,
      grabEnds: iout.grabEnds === true,
      grabHeldWrongRelease: iout.grabHeldWrongRelease === true,
      snapTurns: iout.snapTurns === true,
      snapLatch: iout.snapLatch === true,
      faceAAnnounces: iout.faceAAnnounces === true,
      faceBToggles: iout.faceBToggles === true,
      menuToggles: iout.menuToggles === true,
      semExpanded: iout.semExpanded === true,
      semDispose: iout.semDispose === true,
      wpScrollNonReader: iout.wpScrollNonReader === true,
      ctrlFamilies: iout.ctrlFamilies === true,
      ctrlFamRebuild: iout.ctrlFamRebuild === true,
      ctrlDeadZoneRad: iout.ctrlDeadZoneRad === true,
      ctrlEmptySnap: iout.ctrlEmptySnap === true,
      layerInit: iout.layerInit === true,
      layerCreate: iout.layerCreate === true,
      layerRender: iout.layerRender === true,
      layerRenderState: iout.layerRenderState === true,
      layerDispose: iout.layerDispose === true,
      wpLayerBlits: iout.wpLayerBlits === true,
      wpLayerResyncs: iout.wpLayerResyncs === true,
      wpLayerHiddenSkips: iout.wpLayerHiddenSkips === true,
      wpLayerRelease: iout.wpLayerRelease === true,
      panelLayerAttach: iout.panelLayerAttach === true,
      panelLayerIdempotent: iout.panelLayerIdempotent === true,
      panelLayerHiddenSkip: iout.panelLayerHiddenSkip === true,
      panelLayerStable: iout.panelLayerStable === true,
      panelLayerDetach: iout.panelLayerDetach === true,
      loopPausesOffscreen: iout.loopPausesOffscreen === true,
      loopStaysPaused: iout.loopStaysPaused === true,
      loopRunsWhilePresenting: iout.loopRunsWhilePresenting === true,
      loopArmIdempotent: iout.loopArmIdempotent === true,
      loopArmsVisible: iout.loopArmsVisible === true,
      grabReattaches: iout.grabReattaches === true,
      grabAttachSkipped: iout.grabAttachSkipped === true,
      glLostPausesLoop: iout.glLostPausesLoop === true,
      glLostNotifies: iout.glLostNotifies === true,
      glRestoredResumes: iout.glRestoredResumes === true,
      resizeRelays: iout.resizeRelays === true,
      resizeSkipsWhilePresenting: iout.resizeSkipsWhilePresenting === true,
      perfStatsShape: iout.perfStatsShape === true,
      perfStatsNullRenderer: iout.perfStatsNullRenderer === true,
      disposeEndsSession: iout.disposeEndsSession === true,
      disposeStopsLoop: iout.disposeStopsLoop === true,
      disposeDetachesContext: iout.disposeDetachesContext === true,
      disposeDetachesResize: iout.disposeDetachesResize === true,
      disposeDetachesMQL: iout.disposeDetachesMQL === true,
      disposeDetachesEnterVR: iout.disposeDetachesEnterVR === true,
      disposeClearsToastTimers: iout.disposeClearsToastTimers === true,
      disposeTearsDownSystems: iout.disposeTearsDownSystems === true,
      disposeNullsFields: iout.disposeNullsFields === true,
      disposeGpuTeardown: iout.disposeGpuTeardown === true,
      texCacheHit: iout.texCacheHit === true,
      texPendingDedup: iout.texPendingDedup === true,
      texRecacheExact: iout.texRecacheExact === true,
      texLruOrder: iout.texLruOrder === true,
      texUnloadPreDispose: iout.texUnloadPreDispose === true,
      texErrorShared: iout.texErrorShared === true,
      texDisposeAll: iout.texDisposeAll === true,
      utilFaceAToggles: iout.utilFaceAToggles === true,
      ptrFaceBBack: iout.ptrFaceBBack === true,
      ptrFaceAFwd: iout.ptrFaceAFwd === true,
      smoothMoves: iout.smoothMoves === true,
      smoothWarn: iout.smoothWarn === true,
      smoothStops: iout.smoothStops === true,
      stickRecenters: iout.stickRecenters === true,
      stickKeyboard: iout.stickKeyboard === true,
      southpawSwaps: iout.southpawSwaps === true,
      slipHolds: iout.slipHolds === true,
      slipRetargets: iout.slipRetargets === true,
      slipResumes: iout.slipResumes === true,
      gazeFillProgress: iout.gazeFillProgress === true,
      gazeConfirmFlash: iout.gazeConfirmFlash === true,
      settingsProbe: iout.settingsProbe === true,
      settingsOffLive: iout.settingsOffLive === true,
      settingsOnLive: iout.settingsOnLive === true,
      stepperProbe: iout.stepperProbe === true,
      stepperApplied: iout.stepperApplied === true,
      tabProbe: iout.tabProbe === true,
      tabSelect: iout.tabSelect === true,
      snapProbe: iout.snapProbe === true,
      snapBumped: iout.snapBumped === true,
      snapApplies: iout.snapApplies === true,
      browseProbe: iout.browseProbe === true,
      browseSelect: iout.browseSelect === true,
      cycleProbe: iout.cycleProbe === true,
      cycleApplied: iout.cycleApplied === true,
      actionProbe: iout.actionProbe === true,
      actionApplied: iout.actionApplied === true,
      bookmarkProbe: iout.bookmarkProbe === true,
      bookmarkToggled: iout.bookmarkToggled === true,
      locoTabProbe: iout.locoTabProbe === true,
      locoTabOpen: iout.locoTabOpen === true,
      snapToggleProbe: iout.snapToggleProbe === true,
      snapGate: iout.snapGate === true,
      teleportProbe: iout.teleportProbe === true,
      teleportGate: iout.teleportGate === true,
      comfortProbe: iout.comfortProbe === true,
      comfortCycles: iout.comfortCycles === true,
      comfortHeadMotion: iout.comfortHeadMotion === true,
      comfortExternalLevel: iout.comfortExternalLevel === true,
      comfortRotation: iout.comfortRotation === true,
      comfortDisabledGate: iout.comfortDisabledGate === true,
      comfortOffClears: iout.comfortOffClears === true,
      southpawCaption: iout.southpawCaption === true,
      osMotionLiveSync: iout.osMotionLiveSync === true,
      osContrastLiveSync: iout.osContrastLiveSync === true,
      osForcedColorsSync: iout.osForcedColorsSync === true,
      comfortDispose: iout.comfortDispose === true,
      ffrWritesClamp: iout.ffrWritesClamp === true,
      ffrHeadAdaptive: iout.ffrHeadAdaptive === true,
      qualityGovernor: iout.qualityGovernor === true,
      capAgingSweep: iout.capAgingSweep === true,
      capReadingFloor: iout.capReadingFloor === true,
      capQueueRules: iout.capQueueRules === true,
      a11yTabProbe: iout.a11yTabProbe === true,
      a11yTabOpen: iout.a11yTabOpen === true,
      gazeTimeApplied: iout.gazeTimeApplied === true,
      graceTimeApplied: iout.graceTimeApplied === true,
      captionSizeApplied: iout.captionSizeApplied === true,
      captionHeightApplied: iout.captionHeightApplied === true,
      hcApplied: iout.hcApplied === true,
      hapticsApplied: iout.hapticsApplied === true,
      gazeToggleApplied: iout.gazeToggleApplied === true,
      displayTabProbe: iout.displayTabProbe === true,
      displayTabOpen: iout.displayTabOpen === true,
      ffrApplied: iout.ffrApplied === true,
      curvedApplied: iout.curvedApplied === true,
      followApplied: iout.followApplied === true,
      homeEnvApplied: iout.homeEnvApplied === true,
      perfUIApplied: iout.perfUIApplied === true,
      texMgrApplied: iout.texMgrApplied === true,
      panelDistApplied: iout.panelDistApplied === true,
      audioTabProbe: iout.audioTabProbe === true,
      audioTabOpen: iout.audioTabOpen === true,
      volumeApplied: iout.volumeApplied === true,
      video360Probe: iout.video360Probe === true,
      video360Applied: iout.video360Applied === true,
      kbTabProbe: iout.kbTabProbe === true,
      kbActionProbe: iout.kbActionProbe === true,
      kbOpens: iout.kbOpens === true,
      kbTypes: iout.kbTypes === true,
      kbBackspaces: iout.kbBackspaces === true,
      kbConfirms: iout.kbConfirms === true,
      kbEscDismisses: iout.kbEscDismisses === true,
      imeHiraganaMode: iout.imeHiraganaMode === true,
      imeRomajiTypes: iout.imeRomajiTypes === true,
      imeHenkanArgs: iout.imeHenkanArgs === true,
      imeCandidateRow: iout.imeCandidateRow === true,
      imeCandidateConfirm: iout.imeCandidateConfirm === true,
      imeModeReject: iout.imeModeReject === true,
      imeSelectBounds: iout.imeSelectBounds === true,
      imeStaleKanji: iout.imeStaleKanji === true,
      imeDeleteClear: iout.imeDeleteClear === true,
      imeConfirmFallback: iout.imeConfirmFallback === true,
      sugActionProbe: iout.sugActionProbe === true,
      sugMinChars: iout.sugMinChars === true,
      sugRowBuilds: iout.sugRowBuilds === true,
      sugHoverUrl: iout.sugHoverUrl === true,
      sugSelectConfirms: iout.sugSelectConfirms === true,
      brwProbe: iout.brwProbe === true,
      privateBlocks: iout.privateBlocks === true,
      privateRestores: iout.privateRestores === true,
      webPanelTearsDown: iout.webPanelTearsDown === true,
      webPanelRebuilds: iout.webPanelRebuilds === true,
      voiceWarn: iout.voiceWarn === true,
      voiceTogglesOff: iout.voiceTogglesOff === true,
      bmPanelProbe: iout.bmPanelProbe === true,
      bmTabSwitch: iout.bmTabSwitch === true,
      bmRowNavigates: iout.bmRowNavigates === true,
      bmRowDelete: iout.bmRowDelete === true,
      bmScrolls: iout.bmScrolls === true,
      bmTabBack: iout.bmTabBack === true,
      bmClose: iout.bmClose === true,
      vidHudProbe: iout.vidHudProbe === true,
      vidExitStops: iout.vidExitStops === true,
      vidPauseToggles: iout.vidPauseToggles === true,
      vidCycleClean: iout.vidCycleClean === true,
      stripProbe: iout.stripProbe === true,
      stripNewTab: iout.stripNewTab === true,
      stripActivate: iout.stripActivate === true,
      stripClose: iout.stripClose === true,
      tabRestoreAnnounce: iout.tabRestoreAnnounce === true,
      tabCloseQuiet: iout.tabCloseQuiet === true,
      stripMaxWarn: iout.stripMaxWarn === true,
      shiftProbe: iout.shiftProbe === true,
      shiftToggles: iout.shiftToggles === true,
      shiftTypesKatakana: iout.shiftTypesKatakana === true,
      shiftBack: iout.shiftBack === true,
      readerProbe: iout.readerProbe === true,
      readerLoads: iout.readerLoads === true,
      readerScrollsDown: iout.readerScrollsDown === true,
      readerScrollsUp: iout.readerScrollsUp === true,
      chromeProbe: iout.chromeProbe === true,
      chromeBackForward: iout.chromeBackForward === true,
      chromeReload: iout.chromeReload === true,
      chromeStar: iout.chromeStar === true,
      chromeUrlBar: iout.chromeUrlBar === true,
      chromeClose: iout.chromeClose === true,
      tilesProbe: iout.tilesProbe === true,
      tileMissNoop: iout.tileMissNoop === true,
      tileNavigates: iout.tileNavigates === true,
      stopArmClears: iout.stopArmClears === true,
      followEnabled: iout.followEnabled === true,
      followConverges: iout.followConverges === true,
      followOffHolds: iout.followOffHolds === true,
      wmAngularScale: iout.wmAngularScale === true,
      stripHoverCaption: iout.stripHoverCaption === true,
      moveBarHoverCaption: iout.moveBarHoverCaption === true,
      chromeHoverCaption: iout.chromeHoverCaption === true,
      hoverGatedByGaze: iout.hoverGatedByGaze === true,
      handTracked: iout.handTracked === true,
      docPaused: iout.docPaused === true,
      pinchHapticOnset: iout.pinchHapticOnset === true,
      pinchHeldOnce: iout.pinchHeldOnce === true,
      pinchHysteresis: iout.pinchHysteresis === true,
      pinchRefires: iout.pinchRefires === true,
      fistHaptic: iout.fistHaptic === true,
      shapePoint: iout.shapePoint === true,
      shapeOpen: iout.shapeOpen === true,
      shapeThumbsUp: iout.shapeThumbsUp === true,
      shapePeace: iout.shapePeace === true,
      handPoseDrives: iout.handPoseDrives === true,
      handLostViaUpdate: iout.handLostViaUpdate === true,
      handFallbackDrives: iout.handFallbackDrives === true,
      handNullPose: iout.handNullPose === true,
      htRegain: iout.htRegain === true,
      htBatchRebuild: iout.htBatchRebuild === true,
      htJointScale: iout.htJointScale === true,
      htJointTint: iout.htJointTint === true,
      htFallbackPose: iout.htFallbackPose === true,
      htFallbackSkips: iout.htFallbackSkips === true,
      htDispose: iout.htDispose === true,
      htGesturePeace: iout.htGesturePeace === true,
      htGestureMask: iout.htGestureMask === true,
      hapticActuator: iout.hapticActuator === true,
      hapticSourceGone: iout.hapticSourceGone === true,
      hapticSequence: iout.hapticSequence === true,
      hapticBothHandsDedup: iout.hapticBothHandsDedup === true,
      hapticPlayEffect: iout.hapticPlayEffect === true,
      hapticClamps: iout.hapticClamps === true,
      vidPlayingListener: iout.vidPlayingListener === true,
      vidStereoEyes: iout.vidStereoEyes === true,
      vidStereoRestore: iout.vidStereoRestore === true,
      vidHeadFollow: iout.vidHeadFollow === true,
      vidResumePlays: iout.vidResumePlays === true,
      vidErrorResets: iout.vidErrorResets === true,
      vidErrorQuiet: iout.vidErrorQuiet === true,
      audioMasterGain: iout.audioMasterGain === true,
      audioLodStats: iout.audioLodStats === true,
      audioListenerOrient: iout.audioListenerOrient === true,
      audioSourcePosWrite: iout.audioSourcePosWrite === true,
      audioSourceParams: iout.audioSourceParams === true,
      audioLoadFetch: iout.audioLoadFetch === true,
      audioLoopSource: iout.audioLoopSource === true,
      audioLodSwitch: iout.audioLodSwitch === true,
      audioListenerPose: iout.audioListenerPose === true,
      audioPlayDrives: iout.audioPlayDrives === true,
      audioRestartGuard: iout.audioRestartGuard === true,
      audioStopBooks: iout.audioStopBooks === true,
      sessEnd: iout.sessEnded === true
        && iout.sessIvStopped === true
        && iout.sessHandOff === true
        && iout.sessLayersGone === true
        && iout.sessLaddersNull === true
        && iout.sessFpsBack === true
        && (iout.voiceStopCap || '').includes('停止')
        && (iout.voiceStopCap || '').includes('停止'),
      jaLang: iout.jaHtmlLang === true,
      jaBookmark: (iout.jaToggleCap || '').includes('ブックマーク追加'),
      jaError: (iout.jaErrToast || '').includes('読み込みに失敗しました'),
      enRestored: (iout.enErrToast || '').includes('Failed to load')
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
        const src = ev.params.entry.url || '';
        // 'Failed to load resource' entries whose target URL is outside our
        // served origin are the harness's own test traffic (navigations to
        // nonexistent .example hosts, or pages routed through the dead
        // reader-proxy the proxy test sets). They are expected load failures,
        // not page errors — and Log delivery timing is racy, so gating on
        // them flakes. Errors on our own origin (missing assets, CSP
        // violations like the frame-ancestors case) keep gating.
        const externalResourceMiss = text.startsWith('Failed to load resource')
          && src && !src.startsWith(url);
        if (!externalResourceMiss) {
          errors.push('log error: ' + text.slice(0, 200) + (src ? ' [' + src + ']' : ''));
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
      ['corrupt session payload restores 0 tabs', !!inter.tmRestoreCorrupt],
      ['malformed session entries skipped', !!inter.tmRestoreSkip],
      ['session restore clamps at MAX_TABS', !!inter.tmRestoreClamp],
      ['stale active index clamps to last tab', !!inter.tmRestoreActive],
      ['serialize re-indexes active past blank tabs', !!inter.tmSerializeReindex],
      ['blank active tab falls back to index 0', !!inter.tmSerializeBlankActive],
      ['all-blank session serializes empty', !!inter.tmSerializeEmpty],
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
      ['panel tab+scroll zones dispatch', !!inter.bpPanelZones],
      ['panel row select navigates + hides', !!inter.bpRowNavigates],
      ['panel delete zone removes the entry', !!inter.bpRowDeletes],
      ['panel close zone hides + announces', !!inter.bpCloseZone],
      ['panel accepts {intersection:{point}} events', !!inter.bpIntersectionArm],
      ['panel bookmarks-mode rows navigate', !!inter.bpBookmarkRows],
      ['panel bookmarks delete routes removeBookmark', !!inter.bpDeleteBookmarkArm],
      ['panel scroll clamps at last full window', !!inter.bpScrollMaxClamp],
      ['panel delete shrinks list clamps offset', !!inter.bpClampOnDelete],
      ['panel hover announced via caption (gaze gate)', !!inter.bpHoverCap],
      ['video prompt announced via caption', !!inter.videoPrompt],
      ['immersive video built spheres + HUD', !!inter.videoActive],
      ['immersive video stop tore down scene', !!inter.videoStopped],
      ['voice search navigated + announced', !!inter.voiceSearch],
      ['voice top-sites announced via caption', !!inter.voiceTop],
      ['voice clear-history wiped + announced', !!inter.voiceClear],
      ['voice volume-up persisted + announced', !!inter.voiceVol],
      ['voice back moved + announced', !!inter.voiceBack],
      ['voice forward moved + announced', !!inter.voiceFwd],
      ['voice bookmarks toggle announced', !!inter.voiceBm],
      ['voice ime-toggle showed keyboard', !!inter.voiceIme],
      ['voice no-match announced + counted', !!inter.voiceNoMatch],
      ['voice volume-down persisted + announced', !!inter.voiceVolDown],
      ['voice refresh reloaded + announced', !!inter.voiceRefresh],
      ['voice go-to hit navigated + announced', !!inter.voiceGoTo],
      ['voice go-to miss fell back to search', !!inter.voiceGoToFb],
      ['voice help listed commands via caption', !!inter.voiceHelp],
      ['voice keyboard-toggle hid keyboard', !!inter.voiceKb],
      ['voice scroll moved reader viewport', !!inter.voiceScroll],
      ['voice VR-enter routed + announced', !!inter.voiceVrEnter],
      ['voice VR-exit reached session.end', !!inter.voiceVrExit],
      ['video HUD hover announced via caption', !!inter.vidHoverCap],
      ['video stop detached listeners + captioned', !!inter.vidStopCaption],
      ['tab close disposed panel meshes + registry', !!inter.wpDisposeTeardown],
      ['tab close aborted in-flight reader fetch', !!inter.wpDisposeAborts],
      ['bookmarks panel disposed meshes + canvas', !!inter.bpDisposeTeardown],
      ['spatial audio disposed sources + context', !!inter.audioDispose],
      ['voice drops low-confidence transcripts', !!inter.voiceConfGate],
      ['voice accepts zero-confidence (Android)', !!inter.voiceConfZero],
      ['voice ignores interim results', !!inter.voiceInterim],
      ['voice wake-word gate holds commands', !!inter.voiceWakeGate],
      ['voice speak params honor zero volume/pitch', !!inter.voiceSpeakParams],
      ['voice stats + onCommand surface live', !!inter.voiceExecStats],
      ['voice no-match routes onCommandFailed', !!inter.voiceFailedCb],
      ['revisit bumps visits + moves to front', !!inter.bmDedupeVisits],
      ['bare revisit keeps the recorded title', !!inter.bmTitleGuard],
      ['removeHistory filters corrupted dupes', !!inter.bmRemoveFilter],
      ['top-sites aggregates hosts + excludes', !!inter.bmTopSites],
      ['history bound trims at 200 entries', !!inter.bmTrim],
      ['voice stop ended listening + announced', !!inter.voiceStop],
      ['voice start lifecycle + already-listening', !!inter.voiceLifecycle],
      ['continuous onend restarts only while enabled', !!inter.voiceRestart],
      ['voice dispose cancels + nulls engines', !!inter.voiceDispose],
      ['session start enabled VR + announced VR Ready', !!inter.sessStart],
      ['session start re-based fps budget on real rate', !!inter.sessFps],
      ['session start re-initialized hand tracking', !!inter.sessHand],
      ['FFR degraded gracefully without XRWebGLBinding', !!inter.sessFfrOff],
      ['hand groups start hidden (no phantom lost)', !!inter.handBornHidden],
      ['input-source removal hides the hand', !!inter.handHiddenOnRemove],
      ['input-source removal announces hand lost', !!inter.handLostCap],
      ['repeat removal does not re-announce', !!inter.handLostOnce],
      ['headset blur paused the playing video', !!inter.sessVisPaused],
      ['restore to visible did not double-pause', !!inter.sessVisNoDouble],
      ['reference-space reset re-centered the rig', !!inter.sessReset],
      ['runtime framerate change kept the budget in sync', !!inter.sessFpsKept],
      ['overload tried viewport scale before rate drop', !!inter.sessScaleFirst],
      ['second overload step scaled deeper, still no rate', !!inter.sessScaleSecond],
      ['ladder exhausted dropped session rate to next rung', !!inter.sessRateDrop],
      ['user-pinned fps suppresses the whole ladder', !!inter.sessOverrideSkips],
      ['initial controller connect stays quiet', !!inter.ctrlFirstQuiet],
      ['mid-session disconnect toasts + forgets source', !!inter.ctrlDisc],
      ['controller reconnect announces', !!inter.ctrlReconn],
      ['disconnect mid-squeeze cancels the aim', !!inter.squeezeCancelled],
      ['controller ray hover fires onHover once', !!inter.hoverEnter],
      ['selectstart on a hit runs select+haptic+qui-select', !!inter.selectHit],
      ['nearest visible interactable wins the ray', !!inter.hitNearest],
      ['hidden panel shadow does not block select', !!inter.hitSkipsHidden],
      ['unchanged hover never refires onHover', !!inter.hoverStableNoRefire],
      ['aiming away fires onHoverEnd', !!inter.hoverExit],
      ['selectstart on a miss fires nothing', !!inter.selectMissQuiet],
      ['squeeze aim raycasts the floor target', !!inter.aimLands],
      ['squeezeend lands the rig with Teleported', !!inter.teleportLands],
      ['teleport landing pulses haptic impact', !!inter.teleportHaptic],
      ['invalid aim leaves rig unmoved + silent', !!inter.teleportMiss],
      ['aiming-controller disconnect cancels teleport', !!inter.teleportCancelDisc],
      ['sibling disconnect leaves teleport aim intact', !!inter.teleportSurvivesDisc],
      ['frame fan-out hits every live subsystem once', !!inter.fanCore],
      ['frame fan-out hits locomotion + buttons once', !!inter.fanUI],
      ['frame fan-out hits gaze + captions once', !!inter.fanA11y],
      ['windowManager.update runs when following', !!inter.fanWin],
      ['null xrFrame skips hands but keeps the rest', !!inter.fanNullFrame],
      ['completed gaze-dwell fires onSelect(gaze) once', !!inter.gazeSelect],
      ['gaze activation fans out to haptic + audio', !!inter.gazeCross],
      ['a second dwell frame does not re-fire', !!inter.gazeOnce],
      ['disabled gaze leaves the target untouched', !!inter.gazeDisabledQuiet],
      ['select on move bar begins grab + announces', !!inter.grabStarts],
      ['grab drag tracks the controller ray', !!inter.grabDrags],
      ['selectend ends grab + announces moved', !!inter.grabEnds],
      ['non-grabbing hand release cannot drop window', !!inter.grabHeldWrongRelease],
      ['right stick snaps -30° + Right caption + click', !!inter.snapTurns],
      ['held stick latches; re-push snaps again', !!inter.snapLatch],
      ['faceA with no forward history says so', !!inter.faceAAnnounces],
      ['utility faceB toggles settings + announces', !!inter.faceBToggles],
      ['utility menu button toggles settings too', !!inter.menuToggles],
      ['settings toggle mirrors aria-expanded', !!inter.semExpanded],
      ['semantic DOM dispose detaches + no-ops', !!inter.semDispose],
      ['scrollContent refuses non-reader state', !!inter.wpScrollNonReader],
      ['vive/generic family maps differ per profile', !!inter.ctrlFamilies],
      ['family change rebuilds snapshot + edges', !!inter.ctrlFamRebuild],
      ['radial dead-zone renormalises magnitude', !!inter.ctrlDeadZoneRad],
      ['gamepad-less source yields empty snapshot', !!inter.ctrlEmptySnap],
      ['XRWebGLBinding init: inject + throw paths', !!inter.layerInit],
      ['createQuadLayer args + registry + transform', !!inter.layerCreate],
      ['per-view subimage blit + finally unbind', !!inter.layerRender],
      ['render-state orders baseLayer then quads', !!inter.layerRenderState],
      ['layers dispose clears maps + flags', !!inter.layerDispose],
      ['layer mode poses quad layer + blits dirty canvas', !!inter.wpLayerBlits],
      ['clean frame re-poses layer without re-blit', !!inter.wpLayerResyncs],
      ['hidden panel skips layer pose + blit', !!inter.wpLayerHiddenSkips],
      ['layer release restores mesh + detaches', !!inter.wpLayerRelease],
      ['mid-session tab gains a quad layer', !!inter.panelLayerAttach],
      ['layered panel is not re-attached', !!inter.panelLayerIdempotent],
      ['hidden panel skips layer until shown', !!inter.panelLayerHiddenSkip],
      ['reconciler no-ops once all panels layered', !!inter.panelLayerStable],
      ['panel layer detach drops exactly its id', !!inter.panelLayerDetach],
      ['offscreen non-presenting disarms the loop', !!inter.loopPausesOffscreen],
      ['paused loop stays paused without a call', !!inter.loopStaysPaused],
      ['presenting keeps frames on offscreen tab', !!inter.loopRunsWhilePresenting],
      ['armed loop does not re-arm', !!inter.loopArmIdempotent],
      ['visible canvas arms the RAF loop', !!inter.loopArmsVisible],
      ['panel grab re-attaches a stale target', !!inter.grabReattaches],
      ['grab on live target skips re-attach', !!inter.grabAttachSkipped],
      ['context lost disarms the loop', !!inter.glLostPausesLoop],
      ['context lost notifies warn cross-modally', !!inter.glLostNotifies],
      ['context restored re-arms the loop', !!inter.glRestoredResumes],
      ['debounced resize relays size + aspect', !!inter.resizeRelays],
      ['presenting skips the resize relay', !!inter.resizeSkipsWhilePresenting],
      ['performance stats format live fields', !!inter.perfStatsShape],
      ['null renderer reports null stats', !!inter.perfStatsNullRenderer],
      ['dispose ends live session', !!inter.disposeEndsSession],
      ['dispose stops the loop', !!inter.disposeStopsLoop],
      ['dispose detaches context listeners', !!inter.disposeDetachesContext],
      ['dispose detaches resize relay', !!inter.disposeDetachesResize],
      ['dispose detaches OS signal listeners', !!inter.disposeDetachesMQL],
      ['dispose detaches enter-VR wiring', !!inter.disposeDetachesEnterVR],
      ['dispose clears toast timers', !!inter.disposeClearsToastTimers],
      ['dispose runs subsystem teardown', !!inter.disposeTearsDownSystems],
      ['dispose nulls teardown fields', !!inter.disposeNullsFields],
      ['dispose disposes GPU resources', !!inter.disposeGpuTeardown],
      ['texture cache hit reuses texture + bumps hits', !!inter.texCacheHit],
      ['in-flight texture loads share one promise', !!inter.texPendingDedup],
      ['re-caching a URL keeps accounting exact', !!inter.texRecacheExact],
      ['texture LRU evicts oldest past the cap', !!inter.texLruOrder],
      ['unload estimates bytes before dispose', !!inter.texUnloadPreDispose],
      ['failed loads share one placeholder texture', !!inter.texErrorShared],
      ['unloadAll disposes every cached texture', !!inter.texDisposeAll],
      ['utility faceA toggles bookmarks + announces', !!inter.utilFaceAToggles],
      ['pointer faceB navigates back + announces', !!inter.ptrFaceBBack],
      ['pointer faceA navigates forward + announces', !!inter.ptrFaceAFwd],
      ['left stick glides + feeds comfort vignette', !!inter.smoothMoves],
      ['smooth move under reduced-motion warns', !!inter.smoothWarn],
      ['stick release disengages external motion', !!inter.smoothStops],
      ['head motion fades the vignette quad in', !!inter.comfortHeadMotion],
      ['locomotion level scales the vignette target', !!inter.comfortExternalLevel],
      ['yaw rotation alone chases full intensity', !!inter.comfortRotation],
      ['disabled preset gates + re-enable merges', !!inter.comfortDisabledGate],
      ['comfort OFF clears vignette + gates update', !!inter.comfortOffClears],
      ['southpaw toggle announces the new primary hand', !!inter.southpawCaption],
      ['OS reduced-motion change re-applies live', !!inter.osMotionLiveSync],
      ['OS prefers-contrast change re-applies live', !!inter.osContrastLiveSync],
      ['OS forced-colors flip applies high contrast', !!inter.osForcedColorsSync],
      ['dispose() unparents the vignette quad', !!inter.comfortDispose],
      ['FFR enable/adjust clamp and reach the layer', !!inter.ffrWritesClamp],
      ['FFR head-velocity EMA adapts foveation', !!inter.ffrHeadAdaptive],
      ['FPS governor nudges FFR intensity by deadband', !!inter.qualityGovernor],
      ['caption update() ages and removes lines', !!inter.capAgingSweep],
      ['caption hold follows per-script reading time', !!inter.capReadingFloor],
      ['caption queue trims, skips while off, NFC', !!inter.capQueueRules],
      ['thumbstick click recenters the rig', !!inter.stickRecenters],
      ['utility stick toggles the VR keyboard', !!inter.stickKeyboard],
      ['southpaw swaps turn hand to the left stick', !!inter.southpawSwaps],
      ['brief slip onto a different object holds the dwell', !!inter.slipHolds],
      ['persistent new object wins only after graceTime', !!inter.slipRetargets],
      ['return to held target resumes and completes', !!inter.slipResumes],
      ['gaze fill disc scales with dwell charge', !!inter.gazeFillProgress],
      ['confirm flash decays or holds per RM', !!inter.gazeConfirmFlash],
      ['hover announce identifies the Captions toggle', !!inter.settingsProbe],
      ['ray select flips enableCaptions live', !!inter.settingsOffLive],
      ['re-select restores the captions toggle state', !!inter.settingsOnLive],
      ['hover announce identifies the Caption Hold stepper', !!inter.stepperProbe],
      ['+region select steps the value + live apply', !!inter.stepperApplied],
      ['hover announce identifies the Movement tab', !!inter.tabProbe],
      ['tab select opens the locomotion section', !!inter.tabSelect],
      ['hover announce identifies the Snap Angle stepper', !!inter.snapProbe],
      ['+region select bumps snapTurnAngle live', !!inter.snapBumped],
      ['next real snap turn uses the new angle', !!inter.snapApplies],
      ['hover announce identifies the Browsing section tab', !!inter.browseProbe],
      ['section tab select rebuilds the browsing section', !!inter.browseSelect],
      ['hover announce identifies the Search cycle', !!inter.cycleProbe],
      ['cycle select advances + live-applies the search engine', !!inter.cycleApplied],
      ['hover announce identifies the Clear History action', !!inter.actionProbe],
      ['Clear History wipes the store + announces', !!inter.actionApplied],
      ['hover announce identifies the Bookmarks action', !!inter.bookmarkProbe],
      ['Bookmarks action toggles the panel + announces state', !!inter.bookmarkToggled],
      ['hover announce identifies the locomotion tab', !!inter.locoTabProbe],
      ['tab select opens the locomotion section', !!inter.locoTabOpen],
      ['hover announce identifies the Snap Turn toggle', !!inter.snapToggleProbe],
      ['Snap Turn toggle gates + restores real stick snaps', !!inter.snapGate],
      ['hover announce identifies the Teleport toggle', !!inter.teleportProbe],
      ['Teleport toggle gates + re-arms squeeze aim', !!inter.teleportGate],
      ['hover announce identifies the Comfort cycle', !!inter.comfortProbe],
      ['Comfort cycle advances + live-applies the preset', !!inter.comfortCycles],
      ['hover announce identifies the Accessibility tab', !!inter.a11yTabProbe],
      ['tab select opens the Accessibility section', !!inter.a11yTabOpen],
      ['Gaze Time stepper live-applies to gaze dwell', !!inter.gazeTimeApplied],
      ['Grace Time stepper live-applies to gaze grace', !!inter.graceTimeApplied],
      ['Caption Size stepper live-applies to caption scale', !!inter.captionSizeApplied],
      ['Caption Height stepper live-applies to caption offset', !!inter.captionHeightApplied],
      ['High Contrast toggle live-applies captions + reticle', !!inter.hcApplied],
      ['Haptics toggle live-applies to the haptic engine', !!inter.hapticsApplied],
      ['Gaze Select toggle live-applies to the gaze engine', !!inter.gazeToggleApplied],
      ['hover announce identifies the Display tab', !!inter.displayTabProbe],
      ['tab select opens the Display section', !!inter.displayTabOpen],
      ['Foveation toggle routes enable/disable to FFRSystem', !!inter.ffrApplied],
      ['Curved toggle live-applies to the tab manager', !!inter.curvedApplied],
      ['Follow View toggle live-applies to window manager', !!inter.followApplied],
      ['Home Environment toggle adds/removes the scene subtree', !!inter.homeEnvApplied],
      ['Perf Monitor toggle builds + shows the overlay', !!inter.perfUIApplied],
      ['Texture Cache toggle disposes the manager live', !!inter.texMgrApplied],
      ['Panel Dist stepper live-applies to window distance', !!inter.panelDistApplied],
      ['hover announce identifies the Audio & Media tab', !!inter.audioTabProbe],
      ['tab select opens the Audio & Media section', !!inter.audioTabOpen],
      ['Sound Volume stepper live-applies master gain', !!inter.volumeApplied],
      ['hover announce identifies the 360° Video action', !!inter.video360Probe],
      ['360° Video opens keyboard + confirm routes to play', !!inter.video360Applied],
      ['audio section still open for keyboard entry', !!inter.kbTabProbe],
      ['hover announce identifies the 360° Video action again', !!inter.kbActionProbe],
      ['360° Video opens keyboard with confirm armed', !!inter.kbOpens],
      ['real key-mesh selects type into the IME buffer', !!inter.kbTypes],
      ['back key-mesh select deletes the last char', !!inter.kbBackspaces],
      ['enter key-mesh select confirms to the armed callback', !!inter.kbConfirms],
      ['esc key-mesh select dismisses with cancel caption', !!inter.kbEscDismisses],
      ['kana key-mesh select switches IME to hiragana', !!inter.imeHiraganaMode],
      ['romaji key selects accumulate the raw buffer', !!inter.imeRomajiTypes],
      ['henkan converts the buffer to hiragana for lookup', !!inter.imeHenkanArgs],
      ['henkan builds the candidate button row', !!inter.imeCandidateRow],
      ['candidate ray select commits through onTextConfirmed', !!inter.imeCandidateConfirm],
      ['ime rejects unknown mode names', !!inter.imeModeReject],
      ['ime candidate index bounds checked', !!inter.imeSelectBounds],
      ['ime stale kanji result discarded', !!inter.imeStaleKanji],
      ['ime delete empty + clear resets all', !!inter.imeDeleteClear],
      ['ime confirm falls back to raw buffer', !!inter.imeConfirmFallback],
      ['360° Video opens keyboard for suggestions', !!inter.sugActionProbe],
      ['single keystroke builds no suggestion row', !!inter.sugMinChars],
      ['two-keystroke query builds the suggestion row', !!inter.sugRowBuilds],
      ['suggestion hover announces the full URL', !!inter.sugHoverUrl],
      ['suggestion ray select commits the seeded URL', !!inter.sugSelectConfirms],
      ['browsing toggles section probes present', !!inter.brwProbe],
      ['private mode writes no history while on', !!inter.privateBlocks],
      ['private mode off restores history recording', !!inter.privateRestores],
      ['web panel off tears down browsing systems', !!inter.webPanelTearsDown],
      ['web panel on rebuilds browsing systems', !!inter.webPanelRebuilds],
      ['voice enable warns when recognition absent', !!inter.voiceWarn],
      ['voice off tears down and announces', !!inter.voiceTogglesOff],
      ['bookmark panel opens raycastable', !!inter.bmPanelProbe],
      ['history tab switches the panel mode', !!inter.bmTabSwitch],
      ['history row select navigates the tab', !!inter.bmRowNavigates],
      ['delete zone removes the history entry', !!inter.bmRowDelete],
      ['header scroll zone advances the offset', !!inter.bmScrolls],
      ['bookmarks tab returns the panel mode', !!inter.bmTabBack],
      ['close button hides the panel', !!inter.bmClose],
      ['video HUD buttons register as interactables', !!inter.vidHudProbe],
      ['exit button stops and unregisters the HUD', !!inter.vidExitStops],
      ['pause button toggles playback + notifies', !!inter.vidPauseToggles],
      ['second play/stop cycle stays clean', !!inter.vidCycleClean],
      ['tab strip registers as an interactable', !!inter.stripProbe],
      ['+ zone opens a new tab and announces', !!inter.stripNewTab],
      ['tab body activates and announces', !!inter.stripActivate],
      ['close zone closes the tab and announces', !!inter.stripClose],
      ['newTab(url) announces the destination host', !!inter.tabRestoreAnnounce],
      ['closing an inactive tab does not re-announce', !!inter.tabCloseQuiet],
      ['saturated strip warns on + select', !!inter.stripMaxWarn],
      ['shift key mesh is present and visible', !!inter.shiftProbe],
      ['shift key toggles katakana mode', !!inter.shiftToggles],
      ['katakana mode converts romaji input', !!inter.shiftTypesKatakana],
      ['shift toggles back to hiragana', !!inter.shiftBack],
      ['reader pipeline lands on reader state', !!inter.readerLoads],
      ['reader down-arrow scrolls the article', !!inter.readerScrollsDown],
      ['reader up-arrow clamps back to top', !!inter.readerScrollsUp],
      ['chrome bar registers as an interactable', !!inter.chromeProbe],
      ['back/forward zones move through tab history', !!inter.chromeBackForward],
      ['reload zone re-issues the reader fetch', !!inter.chromeReload],
      ['bookmark star zone toggles + announces', !!inter.chromeStar],
      ['URL bar zone opens the keyboard', !!inter.chromeUrlBar],
      ['close zone hides the panel', !!inter.chromeClose],
      ['fresh tab shows the top-sites grid', !!inter.tilesProbe],
      ['dead space between tiles is a no-op', !!inter.tileMissNoop],
      ['tile select navigates the tab', !!inter.tileNavigates],
      ['reload zone during load stops the fetch', !!inter.stopArmClears],
      ['follow toggle applies windowManager.setFollow', !!inter.followEnabled],
      ['head-lock follow converges the panel', !!inter.followConverges],
      ['follow off leaves the panel in place', !!inter.followOffHolds],
      ['angular scale keeps constant visual size', !!inter.wmAngularScale],
      ['tab strip hover announces its label', !!inter.stripHoverCaption],
      ['move bar hover announces its label', !!inter.moveBarHoverCaption],
      ['chrome hover announces page title + tints', !!inter.chromeHoverCaption],
      ['hover captions gate on gaze dwell', !!inter.hoverGatedByGaze],
      ['hand input source announces Right hand tracked', !!inter.handTracked],
      ['document-hidden pause arms outside XR too', !!inter.docPaused],
      ['pinch onset routes to haptic click', !!inter.pinchHapticOnset],
      ['held pinch fires once, not per frame', !!inter.pinchHeldOnce],
      ['pinch hysteresis holds through the gap band', !!inter.pinchHysteresis],
      ['release + re-pinch refires and counts onsets', !!inter.pinchRefires],
      ['fist gesture routes to haptic impact', !!inter.fistHaptic],
      ['point shape detected (index only extended)', !!inter.shapePoint],
      ['open shape detected (all extended)', !!inter.shapeOpen],
      ['thumbsup beats fist with thumb vector up', !!inter.shapeThumbsUp],
      ['peace shape detected (index+middle)', !!inter.shapePeace],
      ['fake XRHand poses drive joints -> pinch haptic', !!inter.handPoseDrives],
      ['hand source leaving the stream hides the group', !!inter.handLostViaUpdate],
      ['getJointPose fallback drives joints -> pinch', !!inter.handFallbackDrives],
      ['null joint poses leave records + recognize runs', !!inter.handNullPose],
      ['lost hand regained fires tracking change', !!inter.htRegain],
      ['new XRHand object rebuilds the batch', !!inter.htBatchRebuild],
      ['joint radii scale instances + full tint', !!inter.htJointScale],
      ['dead radii default scale + half tint', !!inter.htJointTint],
      ['getJointPose fallback poses + scales joints', !!inter.htFallbackPose],
      ['fallback skips null poses, zero radius tints', !!inter.htFallbackSkips],
      ['hand tracking dispose detaches + clears', !!inter.htDispose],
      ['peace seed classifies + callback fires', !!inter.htGesturePeace],
      ['index+ring extended matches no gesture', !!inter.htGestureMask],
      ['haptic playPattern reaches the actuator', !!inter.hapticActuator],
      ['source removal prunes the haptic gamepad', !!inter.hapticSourceGone],
      ['haptic sequence pattern runs pause+multi-pulse', !!inter.hapticSequence],
      ['single-gamepad both-hands pattern dedups', !!inter.hapticBothHandsDedup],
      ['playEffect-only actuator takes dual-rumble arm', !!inter.hapticPlayEffect],
      ['pulse clamps duration and intensity', !!inter.hapticClamps],
      ["video 'playing' listener flips HUD state", !!inter.vidPlayingListener],
      ['stereo video builds per-eye cropped spheres', !!inter.vidStereoEyes],
      ['stereo stop restores the camera layer mask', !!inter.vidStereoRestore],
      ['video spheres track the head per frame', !!inter.vidHeadFollow],
      ['paused HUD select calls video.play only', !!inter.vidResumePlays],
      ['mid-stream video error resets HUD state', !!inter.vidErrorResets],
      ['pre-playback video error stays quiet', !!inter.vidErrorQuiet],
      ['master volume writes into live gain nodes', !!inter.audioMasterGain],
      ['LOD tier counts aggregate into stats', !!inter.audioLodStats],
      ['listener orientation reaches the AudioListener', !!inter.audioListenerOrient],
      ['source position writes reach the PannerNode params', !!inter.audioSourcePosWrite],
      ['directional and distance options reach the PannerNode', !!inter.audioSourceParams],
      ['loadAudio fetches decodes and caches the buffer', !!inter.audioLoadFetch],
      ['loop and playbackRate reach the buffer source', !!inter.audioLoopSource],
      ['listener move re-tiers source panning model', !!inter.audioLodSwitch],
      ['camera pose reaches the audio listener', !!inter.audioListenerPose],
      ['real play() drives source + position + counts', !!inter.audioPlayDrives],
      ['stale onended cannot clobber a restarted play', !!inter.audioRestartGuard],
      ['stop() books keep sourcesActive consistent', !!inter.audioStopBooks],
      ['session end handed back video/hands/layers/fps', !!inter.sessEnd],
      ['live language switch set html lang=ja', !!inter.jaLang],
      ['JA bookmark-toggle announced in Japanese', !!inter.jaBookmark],
      ['JA load-error toast composed in Japanese', !!inter.jaError],
      ['EN catalog restored after JA leg', !!inter.enRestored],
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
