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
            say('停止');
            out.voiceStopped = vc.isListening === false;
            out.voiceStopCap = statusEl ? statusEl.textContent : '';
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
              selObj.rotation.set(0, 0, 0);
              selObj.scale.set(0.05, 0.05, 0.05);
              selObj.position.set(0, 1.4, -0.4);
              selObj.updateMatrixWorld(true);
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
              } finally {
                const ix = app.interactables.indexOf(selObj);
                if (ix >= 0) {
                  app.interactables.splice(ix, 1);
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
              // One metre dead ahead of the camera's actual gaze ray.
              app.camera.updateWorldMatrix(true, false);
              const camPos = app.camera.getWorldPosition(gzObj.position.clone());
              const camDir = app.camera.getWorldDirection(camPos.clone());
              gzObj.position.copy(camPos).add(camDir.multiplyScalar(1.5));
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
              app.camera.updateWorldMatrix(true, false);
              const rayPos = app.camera.getWorldPosition(gA.position.clone())
                .add(app.camera.getWorldDirection(gA.position.clone()).multiplyScalar(1.5));
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
                leftSrc.gamepad.buttons[5].pressed = true;
                app.updateSystems(0, fakeXrFrame, 0.016);
                const visAfter = !!(app.settingsPanel && app.settingsPanel.visible);
                out.faceBToggles = visAfter === !visBefore
                  && locoCaps.some((t) => t.includes(visAfter ? 'Settings: open' : 'Settings: closed'));
                leftSrc.gamepad.buttons[5].pressed = false;
                rightSrc.gamepad.buttons[4].pressed = false;
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
                  const restarted = iv.active === true;
                  iv.stop();
                  out.vidCycleClean = restarted
                    && iv.active === false
                    && iv._eyeTextures.length === 0;
                } finally {
                  if (iv.active) { iv.stop(); }
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
            if (iv && origToggle && origStop) {
              iv.togglePause = origToggle;
              iv.stop = origStop;
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
      aimLands: iout.aimLands === true,
      teleportLands: iout.teleportLands === true,
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
      snapTurns: iout.snapTurns === true,
      snapLatch: iout.snapLatch === true,
      faceAAnnounces: iout.faceAAnnounces === true,
      faceBToggles: iout.faceBToggles === true,
      smoothMoves: iout.smoothMoves === true,
      smoothStops: iout.smoothStops === true,
      stickRecenters: iout.stickRecenters === true,
      stickKeyboard: iout.stickKeyboard === true,
      southpawSwaps: iout.southpawSwaps === true,
      slipHolds: iout.slipHolds === true,
      slipRetargets: iout.slipRetargets === true,
      slipResumes: iout.slipResumes === true,
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
      vidCycleClean: iout.vidCycleClean === true,
      stripProbe: iout.stripProbe === true,
      stripNewTab: iout.stripNewTab === true,
      stripActivate: iout.stripActivate === true,
      stripClose: iout.stripClose === true,
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
      stripHoverCaption: iout.stripHoverCaption === true,
      moveBarHoverCaption: iout.moveBarHoverCaption === true,
      chromeHoverCaption: iout.chromeHoverCaption === true,
      hoverGatedByGaze: iout.hoverGatedByGaze === true,
      handTracked: iout.handTracked === true,
      docPaused: iout.docPaused === true,
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
      ['voice stop ended listening + announced', !!inter.voiceStop],
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
      ['aiming away fires onHoverEnd', !!inter.hoverExit],
      ['selectstart on a miss fires nothing', !!inter.selectMissQuiet],
      ['squeeze aim raycasts the floor target', !!inter.aimLands],
      ['squeezeend lands the rig with Teleported', !!inter.teleportLands],
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
      ['right stick snaps -30° + Right caption + click', !!inter.snapTurns],
      ['held stick latches; re-push snaps again', !!inter.snapLatch],
      ['faceA with no forward history says so', !!inter.faceAAnnounces],
      ['utility faceB toggles settings + announces', !!inter.faceBToggles],
      ['left stick glides + feeds comfort vignette', !!inter.smoothMoves],
      ['stick release disengages external motion', !!inter.smoothStops],
      ['thumbstick click recenters the rig', !!inter.stickRecenters],
      ['utility stick toggles the VR keyboard', !!inter.stickKeyboard],
      ['southpaw swaps turn hand to the left stick', !!inter.southpawSwaps],
      ['brief slip onto a different object holds the dwell', !!inter.slipHolds],
      ['persistent new object wins only after graceTime', !!inter.slipRetargets],
      ['return to held target resumes and completes', !!inter.slipResumes],
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
      ['second play/stop cycle stays clean', !!inter.vidCycleClean],
      ['tab strip registers as an interactable', !!inter.stripProbe],
      ['+ zone opens a new tab and announces', !!inter.stripNewTab],
      ['tab body activates and announces', !!inter.stripActivate],
      ['close zone closes the tab and announces', !!inter.stripClose],
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
      ['tab strip hover announces its label', !!inter.stripHoverCaption],
      ['move bar hover announces its label', !!inter.moveBarHoverCaption],
      ['chrome hover announces page title + tints', !!inter.chromeHoverCaption],
      ['hover captions gate on gaze dwell', !!inter.hoverGatedByGaze],
      ['hand input source announces Right hand tracked', !!inter.handTracked],
      ['document-hidden pause arms outside XR too', !!inter.docPaused],
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
