# Qui Browser VR - Project Status

**Version:** 2.0.0 · **License:** MIT

**Note:** this file is a point-in-time snapshot; `docs/ARCHITECTURE.md` +
`docs/TESTING.md` carry the living descriptions, `CLAUDE.md` the session history,
`docs/OUTSTANDING_ISSUES.md` the known gaps.

## 📊 Project Overview

An accessibility-first WebXR VR browser for Meta Quest 2/3 and Pico 4 — spatial
browsing, reader view, and Japanese input, built on Three.js + WebXR.

| Metric | Value (measured) |
|--------|------------------|
| Source | 50 files, ~20,000 lines (`src/`) |
| Tests | 72 suites / 3,006 tests (~32,000 lines) |
| Coverage | Jest floor ratcheted to 95/96/97/96 (branches/functions/lines/statements) — regressions fail `ci:test` |
| Build | Vite 5 + esbuild → `dist/` ≈ 1.0 MB |
| Docs | 24 files under `docs/` (+ `docs/archive/` ×110, `docs/patches/` ×9 pending) |

## 🎯 Development Goals Achievement

- Core VR session, browsing surfaces, reader view, Japanese IME, gaze/hand/voice
  input, captions and cross-modal notifications: **shipped and covered**
- Phase-3+ items that were nominal-only (multiplayer, AR passthrough, AI recs,
  WebGPU backend, Stripe server, object pooling) were **deleted** — Session 74+
  excess/deficiency sweep; ledger in `docs/OUTSTANDING_ISSUES.md` A

## 🚀 Feature Completion Status

What actually exists in `src/` today:

- **Core:** `VRApp` session controller, WebGL renderer, XR loop, interactable registry
- **Browsing:** `WebPanel`, `WindowManager`, `TabManager`, `BookmarkPanel`,
  new-tab Top Sites, reader view (proxied fetch + canvas pagination)
- **Input:** `VRControllerInput`, `JapaneseIME` (romaji→kana/kanji), `VoiceCommands`,
  `HandTracking`, `GazeInteraction` (dwell + grace), `HapticFeedback`
- **Rendering/perf:** `FFRSystem`, `LayersSystem` (quad layers), `TextureManager`
  (LRU), `ProgressiveLoader`, `PerformanceMonitor`
- **Comfort/a11y:** `ComfortSystem` (motion-activated vignette), `CaptionSystem`,
  `SemanticDOM`, `crossModal` routing, `AccessibilityCoordinator`
- **Media/dev:** `ImmersiveVideo` (equirect/180/360), `DevTools` (console/scene/network)
- **Shell:** `main.js`, `app.js` landing, `i18n` (en/ja), `monitoring`
  (Sentry/GA4/Web Vitals, production-gated), service worker, optional `proxy/`
  reader proxy (SSRF-guarded)

## 📈 Performance Metrics

- Verified on the built bundle: `verify:layout` (55 text surfaces, none
  overflowing), `verify:app` + `verify:vr-boot` (full `VRApp` construction in
  headless Chromium under a WebXR stub, no uncaught exceptions)
- Device targets: Quest 2 72–90 fps, Quest 3 90–120 fps, Pico 4 90 fps
- The legacy "before/after" marketing table was unverifiable and removed

## 🛠️ Technical Stack

Three.js 0.181 · Vite 5 · Jest 29 · ESLint 9 flat config · Prettier ·
Service Worker + `proxy/` companion (Node http). Runtime deps: `three`, `web-vitals`.

## 🚢 Deployment Options

| Platform | Configuration | Notes |
|----------|---------------|-------|
| GitHub Pages | `.github/workflows/cd.yml` | builds and ships `dist/` |
| Netlify | `netlify.toml` / `npm run deploy:netlify` | builds `dist/` |
| Vercel | `vercel.json` / `npm run deploy:vercel` | builds `dist/` |
| Docker | `Dockerfile` + `docker-compose.yml` | multi-stage build → nginx serves `dist/` |

## 🧪 Testing Infrastructure

- 72 suites / 3,006 tests headless in Node (72 test files under `tests/`)
- `test:integration` = `vr-app-wiring` + `app-smoke`; `test:coverage` enforces
  the ratcheted floor; `ci:verify` runs the three real-browser harnesses
  (`CHROME_PATH` needed off Linux)
- CI (`ci.yml`): lint, unit, integration, build, lighthouse, docker, security,
  summary — ⚠️ `test-integration`/`test-performance` still reference deleted
  suites in the workflow; verified fix ships as `docs/patches/0002-ci-fix-dead-jobs.patch`
  pending application (K-1)

## 📚 Documentation

- `docs/ARCHITECTURE.md` — module map + design rules (synced to the tree)
- `docs/SPEC.md` — FR/NFR table incl. audit record of deleted components
- `docs/TESTING.md` — test layout, conventions, coverage policy
- `docs/QUICK_START.md`, `docs/USAGE_GUIDE.md`, `docs/API.md`, `docs/FAQ.md`
- `docs/DEPLOYMENT_GUIDE.md`, `docs/PROXY.md`, `docs/BUILD_OPTIMIZATION_GUIDE.md`
- `docs/OUTSTANDING_ISSUES.md` — gap ledger with owner-decision items
  (M-1 format:check · K-1 workflow patches 0001–0009 · N-2 monitoring verbs ·
  N-3 IME semantics · O-1 stale onboarding doc · CODECOV_TOKEN)
- `CHANGELOG.md` — release history
