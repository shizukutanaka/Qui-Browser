---
name: qui-browser-2d-runtime
description: How to drive Qui-Browser VR's 2D landing surface end-to-end in a real headed Chrome on this macOS box (build, vite preview, CDP attach, expected behaviors, pitfalls)
---

# Qui-Browser VR — 2D runtime testing in a real browser

## Serve the production build

```bash
cd /Users/devin/repos/Qui-Browser
npm run build          # vite build + stamps dist/service-worker.js CACHE_VERSION
npx vite preview       # serves dist/ on http://localhost:8080 (config: preview.port=8080)
```

## Attach a real headed Chrome with CDP

`browser_console` and the managed `browser` target do NOT attach to Chrome you launch
yourself — but `computer` actions with `target: browser, cdp_port: 9222` (inspect,
query, act-press, read_dom) DO work on a self-launched instance:

```bash
open -na "Google Chrome" --args --remote-debugging-port=9222 \
  --user-data-dir=/tmp/qui-vr-test-profile --no-first-run --no-default-browser-check \
  "http://localhost:8080/"
```

Chrome ignores `--remote-debugging-port` on the default profile — a `--user-data-dir`
is mandatory (and gives a clean localStorage baseline). Maximize via
`osascript -e 'tell application "System Events" to tell process "Google Chrome" to set position of window 1 to {0,0}' -e '... set size of window 1 to {1600,1165}'`.

For JS-level assertions without DevTools UI, Node ≥22 has a native WebSocket — talk
CDP directly (`/tmp/cdp-eval.mjs` pattern):

```js
const t = (await (await fetch('http://localhost:9222/json')).json())
  .find(t => t.type === 'page' && t.url.startsWith('http://localhost:8080'));
const ws = new WebSocket(t.webSocketDebuggerUrl);  // then Runtime.evaluate
```

Evals racing the page's own timers prove a promise really pends — use
`Promise.race([fetch(u).then(...), new Promise(r=>setTimeout(()=>r('HANG'),8000))])`.
Evals fired mid-reload can return the pre-hydration document (raw `lang="ja"`
attribute, no applied classes) — re-eval after readyState settles before judging.

## Expected 2D behavior (no WebXR hardware)

- `navigator.xr` exists on desktop Chrome but `isSessionSupported('immersive-vr')` →
  false → `app.js` returns early, `VRApp` is never constructed, landing page only.
- `enterVRButton` click → `#vr-error-toast` (role=alert) bottom-center, localized
  (`app.error.noVRSupport`), auto-dismisses ~6 s. Same for `vrFloatingButton`, which
  stays `display:none` without VR support.
- Utility toggles top-right: `#a11yContrast` → `body.a11y-high-contrast` (black bg,
  yellow hero, white card borders); `#a11yText` → `body.a11y-large-text` (hero
  font ≈3.2rem/51.2px). Both write `localStorage['qui-browser:a11y']` and re-apply on
  reload; buttons mirror `aria-pressed`.
- `#langToggle` flips en⇄ja via `data-i18n`/`data-i18n-attr`, sets
  `documentElement.lang`, persists `localStorage['qui-browser:lang']`. Fresh en-US
  profile starts in English with the button reading "日本語"; index.html is authored
  `lang="ja"` so pre-hydration markup reads ja regardless.
- SW registers at `${BASE_URL}service-worker.js`, activates, precaches to
  `qui-browser-<version>-<stamp>`; manifest + `/icons/icon-{72..512}.png` all 200.

## Pitfalls observed (may still be present)

- `esbuild drop:['console']` strips every console.* from the bundle — app-side
  console.debug/console.error will never appear in a prod build; SW logs DO show
  (public/ ships verbatim) but only in the SW's own console/CDP target.
- The service worker idle-terminates within ~30 s of the last request
  (`service_worker` target disappears from /json). Historically, fetches fired
  while it was dead intermittently hung FOREVER (~50% of dead-SW fetches) —
  fixed via `settleWithin()` (10 s hard cap → bare fetch → offline fallback).
  If hangs reappear, that fix regressed. Navigations always render (app shell
  is precached) even with server down.
- To force the dead-SW state on demand, use the `ServiceWorker` CDP domain on
  the PAGE target's session (NOT the browser-level ws — that's `-32601`):
  `ServiceWorker.enable` → collect `workerVersionUpdated` (versionId,
  runningStatus) → `ServiceWorker.stopWorker {versionId}` to kill, or
  `ServiceWorker.startWorker {scopeURL}` to spawn.
- To prove a fetch actually dispatched to a cold SW (vs Chrome bypassing it):
  temporarily instrument `dist/service-worker.js` — e.g.
  `caches.open('sw-dispatch').then(c => c.put(new Request('/dispatch?p='+encodeURIComponent(url.pathname+url.search)), new Response('x')))`
  inside the fetch handler — reload (update check picks up the byte diff,
  skipWaiting+claims activates it), fire dead-SW fetches, then read
  `caches.open('sw-dispatch').keys()` from the page. Rebuild afterwards to
  restore the pristine file. Only the SW can emit its synthetic statuses:
  a `503` on a non-nav/non-image or `204` on an image while the server is
  DOWN proves `getOfflineFallback` ran.
- `Runtime.evaluate` on a `service_worker` CDP target cannot see top-level
  `const`/`let` bindings (ReferenceError even though the script ran) — eval
  `self.*`-reachable state or treat const-globals as unreadable.
- `Network.emulateNetworkConditions {offline:true}` on the page target does NOT
  take the app offline: SW-controlled requests never touch the page's network
  stack, and the SW's own fetch() runs in its own context (emulating the
  service_worker target doesn't reliably stick either). For a TRUE offline test
  kill the preview server (`kill $(lsof -ti:8080)`) — that exercises the same
  fetch-fail → getOfflineFallback path. Expected: never-cached navigation →
  offline.html (purple card, "You're currently offline"); precached routes →
  app shell. offline.html auto-reloads on `navigator.onLine` — when only the
  server is down it shows a "Connection restored! Reloading..." banner that
  can race your next navigation.
- Rebuilding `dist/` while the OLD service worker still controls the page
  produces a transient UNSTYLED render: its precached `index.html` references
  the previous build's hashed CSS/JS (e.g. `index-DPVD57s7.css`), which vite
  deleted → 404s → plain-HTML page. It self-heals once the new SW activates —
  just reload again. Compounds if the preview server is down (CSS fallback
  gives SW-synthetic 503, not a style). Check `curl localhost:8080` first when
  a page comes back unstyled.
- macOS notification banners cover the top-right utility toolbar — drag them off
  screen before clicking toggles.
- `browser_console` reports "Chrome is not in the foreground" for self-launched
  Chrome regardless of focus; collect console errors via the Log/Runtime CDP domains
  or open DevTools (alt+meta+j) for the visual record.

## Devin Secrets Needed

- none — local build only.
