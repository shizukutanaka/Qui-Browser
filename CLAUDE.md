# Qui-Browser VR: Specification & Accessibility Audit

**Last Updated**: 2026-06-20  
**Model**: Claude Sonnet 4.6  
**Branch**: `claude/loop-improvements-L276b`

---

## Project Overview

Qui-Browser is a **WebXR VR browser** targeting Meta Quest 2/3 and Pico 4, with a focus on **accessibility equity** via cross-modal feedback (captions + haptic + toast notifications). Built with Three.js, featuring gaze-dwell interaction, hand tracking, Japanese IME, spatial audio, and a comfort system for vestibular-sensitive users.

### Key Accessibility Features

- **In-VR Captions (FR-13.1)**: WCAG 2.2.1 Timing Adjustable (2–60s hold, 0.5–3× scale)
- **Gaze-Dwell Selection (FR-13.1)**: Hands-free input with grace-time tremor forgiveness
- **Cross-Modal Notifications**: Every error/status message fires haptic + captions + toast simultaneously
- **High-Contrast Mode**: WCAG 1.4.11 (3:1 contrast minimum), full-opacity reticle, solid-black caption backing
- **Reduced-Motion Support**: WCAG 2.3.3 (animated gaze-dwell pulse becomes static highlight under OS prefers-reduced-motion)
- **Settings Panel**: 20+ live-tunable parameters (caption hold, dwell time, grace time, window distance, etc.)

---

## Audit Results: Strengths & Weaknesses

### ✅ Strengths

1. **Comprehensive Cross-Modal Routing**
   - `notifyCrossModal()` (accessibility/crossModal.js) is pure, dependency-free, and fully tested (12 test cases)
   - All error paths flow through `showVRToast()` → haptic + captions + visual toast
   - Severity conveyed by glyphs (✕/⚠/ℹ) for color-blind users, not colour alone

2. **Caption System Robust**
   - Adjustable duration (WCAG 2.2.1), scaling (WCAG 1.4.4), high-contrast backing (WCAG 1.4.11)
   - Word-wrapping preserves full utterances (critical for deaf/HoH users)
   - Updates expire per-line so new messages don't abruptly cut old ones

3. **Gaze-Dwell Accessibility**
   - Grace-time forgiveness for tremor/nystagmus (WCAG 2.2.1 Timing Adjustable)
   - Runtime-adjustable dwell time (500–3000 ms) and grace time (0–600 ms)
   - High-contrast reticle, reduced-motion support, isWorldVisible() guard prevents hitting hidden UI

4. **Settings Panel Live-Tuning**
   - All accessibility preferences exposed as steppers (caption scale, duration, gaze times)
   - OS signals (prefers-contrast, prefers-reduced-motion) respected at startup
   - Persistent across reloads (localStorage)

### ❌ Critical Gaps (WCAG Violations)

#### 1. **I18n Missing from VR UI (WCAG 3.1.1, 3.1.2)**
- All 40+ VRApp UI strings hard-coded in English: "High Contrast", "Captions", "Snap Turn", "Gaze Select", etc.
- All 30+ system messages in English: "Loading: hostname", "Bookmarks: open", "Player joined", "Controller disconnected"
- Voice error messages only English: "Voice commands: microphone access denied"
- A **Japanese user sees entirely English UI in Japanese VR session** — breaks WCAG Language of Page and Language of Parts

**Impact**: Critical — violates WCAG 3.1.1 and 3.1.2 for Japanese users. Breaks the entire value prop of a browser with Japanese IME.

**Status**: Not started. `i18n.js` has robust infrastructure (CATALOG, t(), setLanguage()) but is **never called by VRApp**. Only used by 2D landing page.

---

#### 2. **Optional Subsystem Init Failures Silent (WCAG 4.1.3)**
- If FFRSystem fails to detect foveation support → console.debug, no toast, user thinks it's working
- If LayersSystem.createQuadLayer() throws → swallowed, no caption/warning
- If HapticFeedback init fails (gamepad API unavailable) → silent, user expects haptic but gets none
- If SpatialAudio fails → silent
- If AIRecommendation init fails → silent

**Impact**: High — violates WCAG 4.1.3 Status Messages. Users are left guessing whether features are working.

**Status**: Partially wired. showVRToast() works for some errors (voice, controller). But optional subsystems have no error boundary.

---

### ⚠️ High-Priority Gaps (Maintainability & Coverage)

#### 3. **No VRApp Accessibility Integration Tests**
- `cross-modal-notify.test.js` tests pure helpers ✓
- `gaze-interaction.test.js` tests dwell logic ✓
- `caption-system.test.js` tests queuing ✓
- **BUT**: No test verifies VRApp wiring end-to-end
  - Enabling captions → CaptionSystem initialized + callbacks wired?
  - Voice command error → onError fires → toast + caption fires?
  - Settings panel button hover → caption fires?
  - Gaze-dwell activation → reticle flashes + haptic fires + onSelect callback?

**Impact**: Medium — coverage gap. Regressions can slip through.

**Status**: Missing. Only 6 test files cover VRApp (app-smoke.test.js is trivial; subsystems.test.js is also minimal).

---

#### 4. **VRApp is 2700+ Line Monolith**
- All accessibility init wired inline: captionSystem, hapticFeedback, gazeInteraction, handTracking, etc.
- Settings panel creation (makeStepperButton, makeCycleButton, etc.) is 300+ lines of methods
- No separation of concerns; hard to test settings logic without mocking the entire VRApp
- Error handling is ad-hoc: some subsystems call showVRToast(); others rely on callbacks

**Impact**: Low-Medium — maintainability debt. Refactoring would make adding features easier.

**Status**: As-is. Not immediately broken, but grows brittle as features accumulate.

---

### 🟡 Medium-Priority Gaps

#### 5. **Settings Panel UX Scattered**
- 20+ settings mixed in single two-column layout; no grouping
- Accessibility settings (Captions, Gaze Select, High Contrast) scattered between FFR, Teleport, Curved Panel
- No descriptive labels or help text (e.g., "Gaze Select: Look at buttons for Xms to activate")
- Users might not discover all tunable parameters

**Impact**: UX/discoverability. Power users can configure, but casual users may miss options.

#### 6. **Controller-User Caption Support Missing**
- Settings buttons only announce captions during gaze-dwell hover (force=false)
- Controller users sweeping the panel get zero feedback; only gaze-dwell users and deliberate activators hear captions
- Spec intent was "don't flood" but could be "only announce to gaze users, or on deliberate select"

**Impact**: Low — gaze users are the target; controller users have visual feedback.

---

## Improvement Roadmap

### Phase 1: Critical WCAG Fixes (Today)
**Goal**: Close WCAG violations preventing Japanese users and error-reporting accessibility.

1. **I18n for VR UI** (4–5 hours)
   - Extract 50+ hard-coded strings from VRApp
   - Add Japanese translations to `i18n.CATALOG`
   - Wire `t()` calls into VRApp settings panel, toast messages, system labels
   - **Files**: `src/i18n/i18n.js`, `src/vr/VRApp.js`, `src/vr/accessibility/crossModal.js`

2. **Error Boundaries for Subsystems** (1.5 hours)
   - Wrap FFRSystem, LayersSystem, HapticFeedback, SpatialAudio, AIRecommendation init in try-catch
   - Emit `showVRToast('X unavailable', {type: 'warn'})` on failure
   - **Files**: `src/vr/VRApp.js` (subsystem init section)

### Phase 2: High-Priority Coverage (Next session)
**Goal**: Test accessibility workflows; add semantic DOM fallback.

3. **VRApp Integration Tests** (3–4 hours)
   - Test captions enable/disable → CaptionSystem wiring
   - Test error paths → toast + caption + haptic
   - Test gaze-dwell activation → reticle + haptic + onSelect
   - **Files**: `tests/vr-app-accessibility.test.js` (new)

4. **Semantic DOM Overlay** (2–3 hours)
   - Render hidden ARIA landmarks in the DOM that mirror VR state
   - Caption text → `aria-live="polite"`
   - Toast messages → `role="alert"`
   - Settings panel state → `aria-expanded`
   - **Files**: `src/vr/VRApp.js` (add DOM rendering)

### Phase 3: Medium-Priority Refactoring (Future)
**Goal**: Improve maintainability and discoverability.

5. **AccessibilityCoordinator** (3–4 hours)
   - Move captionSystem, hapticFeedback, gazeInteraction, high-contrast/large-text syncing into dedicated class
   - VRApp calls `this.a11y.setHighContrast()` instead of inline
   - **Files**: `src/vr/accessibility/AccessibilityCoordinator.js` (new)

6. **Settings Panel Grouping** (2–3 hours)
   - Reorganize settings into collapsible sections: Locomotion, Accessibility, Rendering, Optional
   - Add per-button help text via captions
   - **Files**: `src/vr/VRApp.js` (createSettingsPanel)

---

## Architecture Decisions

### Cross-Modal Pattern
Every user-visible event (error, success, state change) routes through:
```
Event → showVRToast(msg, {type}) → notifyCrossModal(haptic, captions, msg, type)
              ↓
        Visual Toast (Canvas texture, camera-parented, auto-dismiss)
        Haptic feedback (both hands, severity-mapped pattern)
        Caption line (CaptionSystem queue, auto-expiring)
```

**Rationale**: Deaf users see captions. Blind users feel haptics. Low-vision users see toast + severity glyph.

### Gaze-Dwell Forgiveness (Grace-Time)
Gaze-dwell timer maintains a grace window: if the user's gaze slips off-target briefly (< graceTime), the accumulated dwell time is held. If the slip lasts > graceTime, the dwell resets.

**Rationale**: Users with tremor/nystagmus can still activate by dwelling, because involuntary eye jitter won't reset the timer. Precision-focused users can set graceTime = 0 to disable forgiveness.

### I18n Strategy (Future)
1. Extract all VR UI strings to `i18n.CATALOG`
2. VRApp calls `t(key)` at render time, not hard-code English
3. VoiceCommands, ComfortSystem, TabManager respect `getLanguage()` for message generation
4. Toast / caption messages use i18n keys, not literal strings

**Rationale**: Single source of truth. Easy to add new languages. Supports both 2D (landing page) and 3D (VR session) UI.

---

## Testing Strategy

### Unit Tests (Headless)
- **crossModal.test.js**: Pure notification routing (haptic patterns, severity mapping, degradation)
- **caption-system.test.js**: Queue logic, wrapping, scaling, expiry, high-contrast
- **gaze-interaction.test.js**: Dwell timer, grace-time, hit detection, reduced-motion
- **settings-stepper.test.js**: Value stepping, formatting, button captions

### Integration Tests (Mocked Three.js)
- **vr-app-accessibility.test.js** (future): VRApp wiring end-to-end
  - Settings change → subsystem updated + caption announced
  - Error event → toast + haptic + caption fired
  - Gaze-dwell activation → reticle flash + haptic + callback

### Manual Tests (Browser + Headset)
- Enable captions; perform every action; verify captions appear
- Disable haptic; trigger error; verify no haptic, but caption + toast fire
- Set Japanese language; enable VR; verify UI in Japanese
- Enable reduced-motion; dwell to activate button; verify reticle stays static (not animated pulse)

---

## Known Issues & Limitations

| Issue | Impact | Status |
|-------|--------|--------|
| VR UI strings hard-coded English | WCAG 3.1.1 violation (Japanese users) | **To fix Phase 1** |
| Optional subsystem init failures silent | WCAG 4.1.3 (no status message) | **To fix Phase 1** |
| WebPanel load errors only if onLoadError wired | Low (errors silently skipped) | **To fix Phase 1** |
| No VRApp integration tests | Regression risk | **To fix Phase 2** |
| No semantic DOM for screen readers | 2D screen reader support missing | **To fix Phase 2** |
| Settings panel no grouping/help | UX discoverability | **To fix Phase 3** |
| VRApp monolith 2700+ lines | Maintainability debt | **To fix Phase 3** |

---

## Links to Key Files

| Concern | File | Lines |
|---------|------|-------|
| Cross-modal notification routing | `src/vr/accessibility/crossModal.js` | 1–100 |
| Caption system (queue, rendering, timing) | `src/vr/accessibility/CaptionSystem.js` | 1–350 |
| Gaze-dwell interaction (dwell timer, grace) | `src/vr/interaction/GazeInteraction.js` | 1–300 |
| Settings panel creation | `src/vr/VRApp.js` | 537–1200 |
| Subsystem initialization | `src/vr/VRApp.js` | 1800–2000 |
| Error handling | `src/vr/VRApp.js` | 685–735 |
| I18n landing page | `src/i18n/i18n.js` | 1–130 |
| Accessibility prefs (high-contrast, large-text, reduced-motion) | `src/a11y/accessibility.js` | 1–80 |

---

## Session Log

### Session 1: Gaze-Dwell & Caption Accessibility
- ✅ Exposed `gazeGraceTime` as user-adjustable setting (WCAG 2.2.1)
- ✅ Added "Loading:" caption on voice-command navigation (WCAG 4.1.3)
- ✅ Announced current page title on chrome-bar hover (WCAG 1.3.3)
- ✅ Raised caption hold ceiling to 60s (WCAG 2.2.1 Adjust option)
- ✅ BookmarkPanel close-zone now announces "Bookmarks: closed" (WCAG 4.1.3)

### Session 2: Specification & Architecture Audit + Phase 1 Critical Fixes (This Session)
- 🔍 Comprehensive audit of accessibility coverage, cross-modal patterns, settings consistency, error handling, i18n, code organization, test coverage
- 📋 Created this CLAUDE.md specification document
- ✅ **Phase 1 Complete**: Error boundaries + I18n wiring
  - Added error boundaries for optional subsystems (FFRSystem, HapticFeedback, LayersSystem, AIRecommendation) → emit cross-modal toast on failure (WCAG 4.1.3)
  - Extracted 60+ hard-coded VR UI strings to i18n.CATALOG with English + Japanese translations
  - Wired VRApp settings panel to use t() for all labels (Captions, Teleport, Gaze Select, etc.) → settings now render in user's language (WCAG 3.1.1, 3.1.2)
- **Phase 2 (Next)**: VRApp integration tests + semantic DOM overlay (high priority)
- **Phase 3 (Future)**: AccessibilityCoordinator refactoring + settings grouping (medium priority)

### Session 3: Community Research (Qiita / Zenn) Improvements
Researched Japanese dev communities (Qiita Three.js performance/memory, Zenn VR motion-sickness mitigation) and applied two fixes:
- ⚡ **perf**: Share `PlaneGeometry` across all settings-panel buttons via `_sharedPlaneGeometry(w,h)` cache instead of allocating an identical GPU vertex buffer per button (Three.js memory best practice — reuse identical geometries)
- 🐛 **fix (comfort)**: `setPreset('disabled')` then switching to a protective preset left vignette/FOV/snap-turn disabled (stale `enabled:false` from Object.assign merge). Every non-disabled preset now explicitly re-enables all three effects. Critical motion-sickness hazard fixed; 2 regression tests added.

### Session 4: Community Research — Render-Loop Hotspots & Teardown
Researched Qiita/community Three.js perf posts (CanvasTexture, raycaster, "avoid new in the render loop") and SPA teardown patterns:
- ⚡ **perf (raycaster)**: `raycasterFromController()` allocated a fresh `Matrix4` + `Raycaster` each call — at 90 FPS × 2 controllers that's 720+ allocations/sec just for hover. Now lazily caches and mutates in place.
- ⚡ **perf (gaze)**: `GazeInteraction._raycastGaze()` allocated 2 fresh `Vector3`s each frame while dwell was active — 180+ allocations/sec. Now caches origin/dir/quat triplet, resets dir before each ray.
- 🐛 **fix (teardown)**: `showVRToast()` setTimeout was untracked; `dispose()` within a toast's 4-second lifetime left a stale callback that touched a torn-down VRApp (null camera, freed GPU resources). Now tracked in a Set and cleared on dispose. Adds null-guard on `this.camera` for extra safety.

### Session 5: Community Research — Web Audio Autoplay & Stick Dead Zone
Researched Qiita Web Audio autoplay-policy posts and gamepad dead-zone / reaction-curve articles:
- 🐛 **fix (audio)**: AudioContext autoplay-resume listened for `click` only — touch (`touchstart`) and keyboard (`keydown`) users had spatial audio stay suspended. Now arms all three, tears every listener down once any fires (or on dispose). Added a 4-case suspended-context test block; fixed the mock `resume()` to return a Promise like the real API.
- 🐛 **fix (input)**: Thumbstick dead zone was axial (square region) with a pass-through cliff (output jumped 0→0.15 at the edge). Replaced with a **scaled radial dead zone** (`applyRadialDeadZone` pure helper): circular region + magnitude re-normalised (deadZone,1]→(0,1]. Smooth onset is the locomotion analog of gaze-dwell grace-time (tremor-friendly); full deflection preserved. 8 property tests + 2 updated cliff-behavior tests.

### Session 6: Community Research — UI Texture Memory & Frame-Delta Safety
Researched Qiita Three.js texture-memory posts (mipmaps, generateMipmaps) and requestAnimationFrame delta-spike handling:
- ⚡ **perf (textures)**: Every flat UI `CanvasTexture` (settings buttons, captions, keyboard keys, tab strip, browser chrome, bookmarks, avatar labels) defaulted to `generateMipmaps=true` — ~33% wasted GPU memory each, and frequently-updated textures (`needsUpdate=true`) regenerated the whole mip chain on every redraw. Added shared `configureUITexture()` helper (`generateMipmaps=false` + `minFilter=LinearFilter`) applied across 8 modules. Saves memory, removes per-redraw mip regen, keeps text crisp at distance. New 5-case test suite.
- ✅ **verified-OK (frame delta)**: The render-loop already clamps `dt` to 50 ms (`Math.min((now-last)/1000, 0.05)`), so a tab resuming from background can't produce an enormous delta that flings the rig or expires every caption at once. No change needed — confirmed the guard.

### Session 7: Community Research — WebGL Context Loss & Resize Hygiene
Researched Qiita WebGL context-loss recovery patterns and SPA `addEventListener('resize')` debounce/cleanup posts:
- 🐛 **fix (Quest reality)**: The renderer had no `webglcontextlost` / `webglcontextrestored` handlers. On Quest the GPU context is reclaimed in normal situations (system menu, headset sleep, another XR app, memory pressure) — without `event.preventDefault()` on the lost event, Three.js can *never* restore (a documented WebGL contract); without recovery the user sees a frozen scene and a console flooded with per-frame WebGL errors from the still-running animation loop. Now: preventDefault + pause loop + cross-modal "Graphics paused" toast on lost; restart loop with cached `_renderBound` + "Graphics restored" toast on restore. Pure `webglContextLostMessage()` / `webglContextRestoredMessage()` helpers in crossModal.js + 3 tests.
- 🐛 **fix (resize)**: No `window.resize` listener at all — the 2D / desktop preview stretched on resize / orientation / DPI shift because `setSize` and `camera.aspect` were set once. Added a debounced (150 ms) handler that skips while `renderer.xr.isPresenting`, updates pixelRatio + setSize + camera aspect + projection matrix, and is detached + `.cancel()`'d on dispose. Extracted a pure `debounce(fn, wait)` helper (`src/utils/debounce.js`) with `.cancel()` for SPA teardown — 7 unit tests with Jest fake timers.

### Session 8: Community Research — localStorage Quota Resilience
Researched Qiita `QuotaExceededError` handling posts (detect → evict → retry, cross-browser detection):
- 🐛 **fix (store)**: `BookmarkStore.writeJSON()` swallowed every storage error in an empty catch. For history this was a *permanent* silent failure: once the origin's ~5–10 MB budget filled, every subsequent visit's write kept failing and history quietly stopped updating, with no pruning to recover. Now `writeJSON()` returns a success boolean and `addHistory()` runs an evict-and-retry loop — sheds the oldest ~25 % and retries until the payload fits or only the newest entry remains (always preserved). Added pure cross-browser `isQuotaExceededError()` (Chrome `QuotaExceededError`/22, Firefox `NS_ERROR_DOM_QUOTA_REACHED`/1014). 6 tests (detection + eviction with a byte-budget setItem stub).

### Session 9: Community Research — Service Worker Cache Bounds
Researched Qiita PWA cache-control posts (`activate` old-cache deletion, cache-size limits, "SW cache eats all storage"):
- 🐛 **fix (sw)**: `enforceCacheLimit()` and `CACHE_LIMITS` existed but the trim was only wired into `cacheFirst()`. `networkFirst()` wrote every successful API/JSON/socket response into `RUNTIME_CACHE` — never versioned, never purged by `activate` — with **no size bound**, so it grew unbounded across every app version (the classic "SW cache eats all your storage" leak). Now `networkFirst()` awaits the put and calls `enforceCacheLimit(cache, 'runtime')` (FIFO, 200-entry cap). Safe: RUNTIME_CACHE holds only dynamic responses, no pre-cached critical assets. Added a guarded CommonJS export hook so the worker internals are unit-testable; new `service-worker-cache.test.js` (4 cases) stubs `self` + an in-memory Cache API. Canonical worker confirmed via `vite publicDir:'public'` → `public/service-worker.js`; the root-level duplicate is stale/unserved and left untouched.

### Session 10: Community Research — Multibyte / Surrogate-Pair Truncation
Researched Qiita JS string-handling posts (`String.length` counts UTF-16 code units, surrogate pairs, code-point counting):
- 🐛 **fix (i18n mojibake)**: `truncate()` (bookmark titles, history rows, URL bar) measured length and sliced with `String.length` / `String.slice` — UTF-16 code units. A cut at a surrogate-pair boundary severed the character, leaving a broken �. Real bug for a JP browser: CJK Extension kanji in actual names/words (𠮷 U+20BB7 "tsuchiyoshi", 𩸽 U+29E3D "hokke") and emoji are all surrogate pairs. Switched to `Array.from(s)` for both the count and the slice — code-point-aware, ASCII-identical. Applied the same fix to the VR toast truncation (now renders translated/dynamic JP text). 3 new truncate tests (astral-count-as-one, no-split-boundary asserting no �, mixed ASCII+full-width).
- 🐛 **fix (a11y caption mojibake)**: `CaptionSystem._wrap` / `_truncate` had the same UTF-16 bug — and it's the *worst* instance because Japanese has no spaces, so `split(/\s+/)` yields one long word that hits the hard-split path on nearly every JP caption, slicing surrogate pairs mid-character. Captions are the deaf/HoH channel and now carry translated + dynamic text (page titles, voice transcripts). Rewrote `_wrap` to iterate/split/measure by code point (`Array.from`); `_truncate` slices code points too. 4 new tests (spaceless-JP lossless hard-split, no-surrogate-split boundary, code-point `_truncate`).

### Session 11: Community Research — Unicode Normalization (NFC/NFD)
Researched Qiita NFC/NFD posts (macOS 濁点 problem, combining-mark mismatches, `String.prototype.normalize`):
- 🐛 **fix (i18n input)**: `resolveInput()` (the single choke point for all address-bar / search / voice input) trimmed but never canonicalised Unicode form. NFD text (macOS paste, some IMEs, filenames) represents a voiced kana as base + combining mark (が → か + ゙, 2 code points). This degrades search matching (engines expect NFC), lets the combining mark be split from its base by the new code-point wrap/truncate paths, and makes NFD/NFC of the same word compare unequal. Now applies `.normalize('NFC')` before trim; ASCII unaffected. 2 tests with escape-built NFD (U+304B U+3099) → NFC (U+304C) fixtures (asserted 2 vs 1 code points).
- 🐛 **fix (a11y caption NFC)**: captions are fed from sources that bypass `resolveInput` — voice transcripts, iframe page titles, toast mirrors, system messages — any of which can be NFD. The code-point wrap/truncate would then split a combining mark from its base (floating ゙). `CaptionSystem.show()` now normalizes to NFC at the single entry point, protecting every source. 1 test (escape-built NFD → stored as single NFC code point).

---

## Contributing Guidelines

### When Adding Features
1. Does it have a user-visible state change? → Add cross-modal feedback (caption + haptic + toast)
2. Is it time-sensitive (progress, delays, errors)? → Add caption with timing info
3. Does it apply to both controller and gaze users? → Announce on both paths (settings buttons, tab switches)
4. Does it use hard-coded text? → Add to `i18n.CATALOG` instead; call `t()`
5. Can it fail? → Wrap in try-catch; emit `showVRToast('X failed', {type: 'error'})`

### When Adding Tests
- If logic is pure (no Three.js) → headless Jest test, no mocks needed
- If logic touches VRApp state → integration test with mocked Three.js
- If logic touches rendering → mock Canvas 2D context
- All accessibility paths should have corresponding tests (caption fired, haptic fired, etc.)

---

**Maintained by**: Claude Sonnet 4.6  
**Last Revision**: 2026-06-20
