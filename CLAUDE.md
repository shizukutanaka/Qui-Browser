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

### Session 12: Community Research — WebSocket Auto-Reconnect
Researched Qiita WebSocket reconnection posts (`onclose` recreate-instance pattern, ALB ~4000 s idle cap, close codes 1000 vs 1006, backoff):
- 🐛 **fix (multiplayer)**: the signaling `WebSocket` had `onopen`/`onerror`/`onmessage` but **no `onclose`**. A dropped signaling connection (network blip, load-balancer idle timeout) was silent and never recovered — the user stayed nominally "in" the room but stopped receiving new peers. Added an `onclose` handler that reconnects with capped exponential backoff (1→2→4…30 s); `connectSignaling()` re-registers the peer on open. Safety: only reconnects while `this.connected` (set true only post-handshake, so mid-handshake closes still reject); `disconnect()` flips `connected=false`, nulls `onclose` before `close()`, and clears the pending timer so intentional teardown never loops; `_scheduleSignalingReconnect()` is idempotent (guards the pending timer) so a close+error burst can't spawn parallel loops; backoff resets on success. 6 tests with Jest fake timers + mocked `connectSignaling` (no real WebSocket needed).

### Session 13: Community Research — WebRTC Data-Channel Backpressure
Researched WebRTC `bufferedAmount` backpressure (send-buffer growth under congestion, high-water-mark gating):
- 🐛 **fix (multiplayer)**: `sendToPeer()` / `broadcast()` checked only `readyState`, never `bufferedAmount`. Position/rotation broadcast at 30/15 Hz, so on a congested link `channel.send()` keeps queuing into the app→SCTP buffer faster than it drains — `bufferedAmount` grows unbounded toward the ~16 MB channel limit, risking a throw / memory bloat. Added a pure `canSendOnChannel(channel, hwm)` gate (open AND `bufferedAmount ≤ MAX_BUFFERED_BYTES` = 256 KB); both send paths skip when congested and count `stats.messagesDropped`. Correct trade-off: the channel is already unreliable/unordered (`maxRetransmits:0`) and position data is ephemeral — the next interval supersedes a dropped update. 8 tests (gate edge cases + send paths skip/send/no-throw).

### Session 14: Community Research — OS prefers-reduced-motion at First Paint
Researched the CSS `@media (prefers-reduced-motion)` baseline (vs JS-class motion gating; first-paint timing):
- 🐛 **fix (a11y 2D entry)**: `main.css` neutralised motion only under the JS-applied `body.a11y-reduced-motion` class (toggled by `applyAccessibility()` from `osReducedMotion()`). But the loading spinner's `animation: spin … infinite` runs from first paint through the whole load window — before the JS module loads and applies the class — so an OS-reduced-motion user still saw the spin (and got nothing if the script failed to load). Added a pure-CSS `@media (prefers-reduced-motion: reduce)` block mirroring the neutralisation; it applies pre-JS and as a no-JS fallback, suppressing the spin and `:hover` translate/scale lifts (WCAG 2.3.3). The "Loading…" text keeps the busy state legible without rotation. CSS-only (media queries aren't evaluable in jsdom) — verified by inspection + brace balance.

### Session 15: Community Research — WCAG Contrast-Ratio Regression Guard
Researched the WCAG 2.x sRGB relative-luminance / contrast-ratio formula (1.4.3 text, 1.4.11 non-text; large-text threshold):
- ✅ **test (a11y)**: `buttonStyle.js` asserted its high-contrast palette met specific ratios only in prose comments — unverified, so a future colour tweak could silently dim below threshold. Added a contrast-ratio suite implementing the WCAG luminance formula (self-checked: black/white = 21:1, identical = 1:1) that verifies every HC indicator colour clears **3:1** against both the idle (`#000000`) and hover (`#004adf`) backings — the applicable bar for the bold ≥28px large-scale labels (1.4.3) and non-text borders (1.4.11) — and that the label colours clear the stronger **4.5:1** against the idle black backing. Hand-computed margins were tight (`#aaccee` on `#004adf` ≈ 4.1:1, fine for large text but under 4.5), so the precise test resolves the ambiguity and turns the documented claims into enforced invariants. Palette passes; 4 new tests.

### Session 16: Socratic New Feature — Frecency-Ranked "Top Sites"
Socratic reasoning (hardest hands-free task = reaching a destination → dwell-typing/scrolling unranked history is slow → the usage data already exists but isn't ranked → surface most-used sites by frecency) produced a new **Top Sites** quick-access feature:
- ✨ **feat (a11y data)**: pure `frecencyScore(entry, now, halfLifeDays=7)` = `visits × 0.5^(ageDays/halfLife)` (future timestamps clamp to no-decay, null→0, missing/0 visits→1) + `BookmarkStore.getTopSites(limit=8, now)` which ranks history by frecency, dedupes per host (aggregating the host's total visits, keeping its highest-scoring page as the tile), returns `[{url,title,host,visits,score}]`. 12 tests.
- ✨ **feat (hands-free surface)**: `VoiceCommands.connectBrowser` gains an `onTopSites` callback + a `top-sites` command (`トップサイト`/`よく使うサイト`/…), decoupled like `onSearch`; VRApp navigates the active tab to the #1 site with a cross-modal `Top site: <host>` caption (or `No top sites yet`). 3 tests. **Equity framing**: fewest dwells for the highest-probability action. Natural next step: a canvas speed-dial tile surface in BookmarkPanel.

### Session 17: 長所短所改善点 — Hardening the Top Sites Data Foundation
Three iterative strengths/weaknesses/improvements passes on the new feature's data layer:
- 🐛 **fix (visit accuracy)**: `addHistory` only collapsed *consecutive* same-URL visits (checked `all[0]`). Non-consecutive revisits (A→B→A, the common case) appended a duplicate `visits:1` entry — undercounting the visit frequency frecency ranks on and bloating the bounded 200-entry history with dupes. Now dedupes by URL globally (find anywhere → increment, refresh timestamp, move to front; title refreshed only when a real one is supplied). 3 tests.
- 📈 **improve (ranking)**: `getTopSites` aggregated per-host visits but still *sorted* by the single highest-scoring page, so broad multi-page engagement lost to one frequently-hit page. Now ranks by the **sum** of a host's page frecencies (representative URL/title still the best page, via an internal `_bestScore` stripped from output). 2 tests.
- 📈 **improve (quality)**: every search resolves to a search-engine URL, so a frequent searcher's #1 "Top Site" was their search engine. Added `getTopSites(…, exclude=[])` (case-insensitive host skip) + pure `searchEngineHosts()` in urlResolver; VRApp passes the engine hosts so the jump lands on a real destination. 4 tests.
- 📈 **improve (host fold)**: `hostOf` returned the raw host, so `www.example.com` and `example.com` split into two tiles, fragmenting one site's frecency/visits. Now folds a leading `www.` when grouping (and normalises the exclude list the same way, so `www.google.com` still matches the folded `google.com`). 2 tests. The visual speed-dial tile surface remains the open next step (deferred: a 3rd BookmarkPanel tab collides with the scroll-arrow zones and canvas output can't be visually verified here).

### Session 18: Socratic New Perspective — Frecency-Ranked URL Autocomplete
Socratic reasoning (hardest task for a gaze user = address-bar typing → 1500 ms × N chars ≈ 15 s for a 10-char URL → history + bookmarks already hold the data → expose a frecency-ranked search API to power autocomplete):
- ✨ **feat (a11y data)**: `BookmarkStore.search(query, limit=5, now)` — case-insensitive substring search across history URL+title and bookmarks, returns frecency-ranked `[{url, title, score}]`. History entries score by real frecency (visits × recency decay). Bookmark-only URLs score as one virtual visit at `addedAt` so recently-added bookmarks surface immediately; a URL in both history and bookmarks uses the history data (real visit count). 9 tests covering empty store, empty query (returns all), URL/title match, bookmark virtual scoring, history-beats-bookmark dedup, sort order, limit, null-entry robustness, and recency decay ordering. Total: 739 tests.
- 🐛 **fix (search NFC/NFD)**: `search()` called `String(query).toLowerCase()` without NFC normalization — an NFD query (か + combining ゙, emitted by some IMEs and macOS paste) couldn't match an NFC-stored history title even though they're visually identical. Applied `.normalize('NFC')` to both the query and the per-entry title/URL before `includes()`, the same fix applied to `resolveInput()` (Session 11) and `CaptionSystem.show()` (Session 11). 4 tests with escape-sequence NFD fixtures (が / が). Total: 743 tests.
- 🐛 **fix (search robustness)**: 長所短所 pass — the title side of the match was defensively coerced (`String(entry.title || '')`) but the **URL side called `entry.url.normalize()` directly**, assuming a string. Its sibling `getTopSites()` guards URL parsing via `hostOf()`'s try/catch; `search()` didn't. A malformed/legacy entry whose `url` is a number (e.g. `addHistory(123)`) made `entry.url.normalize` throw `TypeError`, breaking **all** autocomplete on every keystroke. Coerced both URL sides with `String()` and factored the duplicated 2-field NFC match into a single `matches(url, title)` closure (also fixed 7 pre-existing `curly`/`comma-dangle` lint errors the method had introduced). 2 tests (no-throw on numeric url, matches a non-string url by coerced form). Total: 745 tests; 0 lint errors.
- ✨ **feat (voice command)**: 長所短所 pass — `search()` was a dead-letter data layer with no user-facing entry point; the feature's entire motivation ("reduce gaze typing for frequent sites") had no voice path. Added `'go-to'` voice command (`"githubを開く"` / `"go to github"` / `"open X"` / `"Xに行く"`): extracts the site name, fires `onGoTo(query)`, which calls `BookmarkStore.search(query, 1)` — if a frecency hit exists the user navigates directly with an "Opening:" caption, otherwise falls back to web search. Follows the `onTopSites`/`onSearch` decoupling pattern. 5 tests. Total: 750 tests.
- 🐛 **fix (voice command collision)**: 長所短所 pass — the new `'go-to'` command was registered *before* the specific commands, and its greedy `を開く` / `open X` capture swallowed `"キーボードを開く"` (keyboard toggle): `processCommand` matches in registration order and stops at the first hit, so go-to fired with query `"キーボード"` and the keyboard never opened. Moved the go-to registration to the **end** of `connectBrowser` so every specific command is checked first and go-to acts only as the catch-all it was meant to be. 1 regression test (`"キーボードを開く"` → `keyboard`, not `go-to`). Total: 751 tests.
- 🐛 **fix (voice cross-modal gap)**: 長所短所 pass — `go-to` was the only major *navigation* command with no `confirmationText`, so a blind user who said `"githubを開く"` got no immediate "command understood" cue on their primary (audio) channel — unlike every sibling (`navigate`/`back`/`search`/`top-sites`). Added `confirmationText: '開きます'`, spoken via TTS and mirrored to captions via `onSpeak` the moment the command matches (before navigation, independent of whether a frecency hit is found) — WCAG 4.1.3. 1 test (spoken confirmation reaches `onSpeak`). Total: 752 tests.
- 🐛 **fix (search robustness — missing bookmark timestamp)**: 長所短所 pass — bookmarks without an `addedAt` timestamp (legacy/corrupted data) silently scored 0 and were dropped from autocomplete suggestions. The `ageMs` fallback in `frecencyScore` treats `undefined` as 0, producing infinite decay and zero score. Now treat missing `addedAt` as "now" so corrupted bookmarks surface immediately; a user revisiting will build real history. 1 test (legacy bookmark without timestamp ranks higher than old one with timestamp). Total: 753 tests.

### Session 19: Community Research — Web Speech API confidence=0 on Quest/Android
Researched Qiita Web Speech API stability posts ([takatama: SpeechRecognitionを安定させるコツ](https://qiita.com/takatama/items/f3c8a692683dcdbe1fe5)) — the documented gotcha: *Android Chrome routinely returns `confidence === 0` even for correctly recognized FINAL results*, particularly with `lang='ja-JP'`.
- 🐛 **fix (voice — Quest device reality)**: `handleRecognitionResult` filtered every result below `sensitivity` (0.7) with a flat `confidence < 0.7` check. The Meta Quest browser is Chromium-on-Android and the app defaults to `ja-JP`, so on the **primary target device** confidence is reported as 0 for legitimately recognized commands — the cutoff `0 < 0.7` then silently dropped *every Japanese voice command*. Reproduced (final "トップサイト" @ confidence 0 → "Low confidence, ignoring" → nothing fired). Changed the guard to `confidence > 0 && confidence < sensitivity`: a literal 0 means "no score provided", not "zero confidence", so it passes through and command-pattern matching (which rejects true garbage) becomes the filter. A real low non-zero score (0.3) is still rejected. 3 tests (confidence=0 fires, 0.3 filtered, 0.95 fires). Total: 756 tests.

### Session 20: Community Research — SpeechSynthesis Teardown & Android Error Resilience
Researched Qiita SpeechSynthesis Android stability patterns (onerror handler, audio-focus teardown):
- 🐛 **fix (voice teardown)**: `dispose()` nulled `this.synthesis` without calling `synthesis.cancel()` first. An utterance queued just before teardown (e.g. the "コマンドが認識できませんでした" feedback on the last command before the user exits VR) continued speaking into a torn-down VRApp — the same class of bug as the `showVRToast` setTimeout leak (Session 4). Now `dispose()` calls `synthesis.cancel()` before nulling. 1 test (cancel called once, synthesis null after).
- 🐛 **fix (voice error resilience)**: `speak()` had no `utterance.onerror` handler. On Android/Quest, SpeechSynthesis can fire `onerror` with `"network"` (TTS engine requires network for ja-JP but is offline) or `"not-allowed"` (audio focus stolen by system notification or another app). Without an `onerror`, unhandled event exceptions can surface as uncaught errors in the browser console and confuse error-monitoring tools. The `onSpeak` callback already fired so captions reached the user; the `onerror` now logs with `console.debug` and does not propagate. 2 tests (dispose no-throw when synthesis null, onerror handler attached and no-throw on simulated "network" error). Total: 759 tests.

### Session 21: Community Research — Debounce-Timer Teardown Leak (Hand Tracking)
Audited the VRApp render-loop / XR-session-lifecycle / teardown paths against the Qiita "always clear pending setTimeout on SPA/component teardown" pattern that already drove Sessions 4 (toast timers) and 20 (TTS cancel):
- 🐛 **fix (teardown)**: the hand-tracking state-change announcement debounces each hand on a 600 ms `setTimeout`, but the timer dict was a closure-local `const _htTimers` invisible to `dispose()`. A hand-tracking flicker in the final 600 ms before the user exits VR therefore fired its "Left/Right hand lost/tracked" caption *after* teardown, against an already-disposed `captionSystem` (the same teardown-leak class as the toast auto-dismiss timers and the queued TTS utterance). Promoted it to `this._handTrackingTimers` and `dispose()` now `clearTimeout`s every pending hand timer alongside the existing toast-timer cleanup. Verified by inspection + lint (VRApp has no unit harness yet — Phase 2 gap); full suite stays green. Total: 759 tests.

### Session 22: Community Research — Internationalized Domain Names (IDN) in the URL Bar
Researched Qiita IDN / punycode posts (the WHATWG `URL` API auto-converts Unicode hosts like 日本語.jp → `xn--wgv71a119e.jp`; ASCII-only host heuristics silently send IDN to search):
- 🐛 **fix (i18n navigation)**: `resolveInput()`'s host-detection regex `LOOKS_LIKE_HOST` was ASCII-only (`[a-z0-9-]`), so a Japanese user typing a Japanese-script domain — `日本語.jp` (ASCII TLD) or the all-Japanese `例え.テスト` (Japanese TLD) — failed the host test and was sent to the **search engine** instead of being navigated to, even though plain `example.com` worked. A real gap for a Japanese-focused VR browser: you literally could not reach a Japanese-named site by typing its name. Made the regex Unicode-aware with property escapes (`/^[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+(:\d+)?(\/.*)?$/u`); the browser/iframe layer converts the Unicode host to punycode on navigation. ASCII behaviour is byte-identical (output stays raw `https://…`, *not* run through `new URL()` which would append a trailing slash and break the existing `example.com` assertion); the "≥2 dot-separated labels, no spaces" shape is unchanged so `東京タワー` (no dot) and `東京　天気` (U+3000 full-width space, matched by `\s`) both stay searches. 6 tests (ASCII-TLD IDN, all-JP IDN, IDN+path, punycode-convertibility, no-dot-is-search, full-width-space-is-search). Total: 765 tests.

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
**Last Revision**: 2026-06-24
