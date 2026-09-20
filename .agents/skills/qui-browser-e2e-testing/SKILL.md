---
name: qui-browser-e2e-testing
description: How to run real-Chrome end-to-end tests for Qui-Browser on this macOS machine — launching an attachable Chrome, driving CDP by hand when browser_console/read_dom can't attach, and pitfalls of vite preview's SPA fallback when verifying deleted files.
---

# Qui-Browser E2E testing on macOS

Repo: `~/repos/Qui-Browser` (Vite static app; `npm run build` → `dist/`, `npm run preview` → http://localhost:8080).

## Launching a Chrome the tools can see

- Chrome binary: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
- On this machine `browser_console` and `read_dom` may fail with "Chrome is not in the foreground" even when Chrome IS frontmost — they only attach to Chrome launched with remote debugging. Launch it yourself:
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --no-first-run --no-default-browser-check --user-data-dir=/tmp/chrome-<tag>-profile --new-window <url> &`
  (separate `--user-data-dir` = clean localStorage = deterministic a11y/language state).
- To read DOM/assert state, drive CDP directly with Node's built-in WebSocket — copy the pattern from `tools/verify-vr-boot.mjs` (`/json` list → `webSocketDebuggerUrl` → `Runtime.evaluate` with `returnByValue: true, awaitPromise: true`). A reusable evaluator was written at `/tmp/cdp-eval.mjs` (eval mode + `--errors` mode that reloads and collects exceptions/console/network-failures).
- Window management: real display is 1600×1200 px (tool coordinate space is scaled 1024×768). Maximize via AppleScript, not wmctrl/xdotool:
  `osascript -e 'tell application "System Events" to tell process "Google Chrome" to set position of front window to {0, 25}' -e 'tell application "System Events" to tell process "Google Chrome" to set size of front window to {1600, 1175}'`

## Pitfalls

- **`vite preview` SPA-fallbacks every missing path to `index.html`** (HTTP 200, `text/html`) — including file-like paths (`/sw.js`, `/foo.png`). A deleted file "serves" 200. Verify deletions via `ls dist/` or `Content-Type`, never status code alone. Same trap applies when checking what a service-worker `register()` call resolves to.
- The built bundle strips all `console.*` (`esbuild.drop: ['console']`) — never assert on log text in production builds; assert DOM/object state (see `tools/verify-vr-boot.mjs` header).
- Desktop Chrome has a real `navigator.xr` accessor → plain assignment stubs are silently ignored; use `Object.defineProperty(navigator, 'xr', ...)` (verify-vr-boot does this).
- macOS notification banners can linger over the top-right toolbar area — dismiss before asserting on the a11y toolbar.

## Verify harnesses (zero-dep, real Chrome via CDP)

Run after `npm run build`, with `CHROME_PATH` set:
```
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run verify:app      # landing shell
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run verify:vr-boot  # full VRApp construction w/ WebXR stub
```
`verify:vr-boot` asserts `QuiBrowser.getApp()`, canvas under `#app-container`, `tabManager`, `settingsPanel`, `captionSystem`, zero uncaught errors — the closest thing to a headset boot on this machine.

## Landing-page expected state

- 4 feature cards: High Performance, Hand Tracking, Spatial Audio, Japanese IME.
- Toolbar top-right: `◐` high-contrast, `A+` large-text (both toggle `body.a11y-*` classes, persist in `localStorage qui-browser:a11y`), language toggle (persists `qui-browser:lang`, swaps `data-i18n` text + `documentElement.lang`).
- "Enter VR Mode" with no headset → red `#vr-error-toast` (`role=alert`): "WebXR VR is not supported on this device. Please use a VR headset."
- SW: `main.js` registers `${BASE_URL}service-worker.js`; verify via `navigator.serviceWorker.getRegistration()` or `chrome://serviceworker-internals`.
