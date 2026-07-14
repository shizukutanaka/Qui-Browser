# Qui-Browser VR: Specification & Accessibility Audit

**Last Updated**: 2026-07-04  
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

**Status**: Fixed Sessions 41 + 43 (`tests/vr-app-wiring.test.js`) — hit-test dispatch, haptic click, grab-to-move begin/end, hover enter/exit, recenter(), and gaze-dwell's activation glue (haptic + spatial audio + caption aging) are all now covered by binding VRApp's real prototype methods to a hand-built `this` (constructing a full `new VRApp()` isn't practical: `setupRenderer()` needs a real GPU context).

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

3. ~~**VRApp Integration Tests**~~ — **Done (Sessions 41, 43)**
   - Error paths → toast + caption + haptic ✅
   - Interactable registry + hit-test dispatch → onSelect + haptic click ✅
   - Grab-to-move begin/end (Session 36 feature) → windowManager wiring ✅
   - Hover enter/exit dispatch, recenter() ✅
   - Gaze-dwell activation → haptic + spatial audio, caption aging (Session 43) ✅
   - **Files**: `tests/vr-app-wiring.test.js` (new)

4. ~~**Semantic DOM Overlay**~~ — **Done (Session 30)**
   - Render hidden ARIA landmarks in the DOM that mirror VR state
   - Caption text → `aria-live="polite"` ✅
   - Toast messages → `role="alert"` ✅
   - Settings panel state → `aria-expanded` ✅
   - **Files**: `src/vr/accessibility/SemanticDOM.js` (new), `src/vr/accessibility/CaptionSystem.js`, `src/vr/VRApp.js`

### Phase 3: Medium-Priority Refactoring (Future)
**Goal**: Improve maintainability and discoverability.

5. ~~**AccessibilityCoordinator**~~ — **Done (Sessions 44, 45, 47)**
   - Move captionSystem ✅ (Session 44), hapticFeedback ✅ (Session 45), gazeInteraction ✅ (Session 47) — all via getter/setter delegation, zero call sites changed across all three slices.
   - **Files**: `src/vr/accessibility/AccessibilityCoordinator.js` (Sessions 44, 45, 47); see `docs/OUTSTANDING_ISSUES.md` item C-1 for the full extraction history

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
| VR UI strings hard-coded English | WCAG 3.1.1 violation (Japanese users) | Settings labels fixed Session 2; status-message/toast call sites fixed Session 27 |
| Optional subsystem init failures silent | WCAG 4.1.3 (no status message) | Fixed Session 2 (toasts wired); translated Session 27 |
| WebPanel load errors only if onLoadError wired | Low (errors silently skipped) | **To fix Phase 1** |
| No VRApp integration tests | Regression risk | Fixed Sessions 41 + 43 (interactables/haptic/grab-to-move/hover/recenter/gaze-dwell) |
| No semantic DOM for screen readers | 2D screen reader support missing | Fixed Session 30 (captions/toasts/settings-panel state mirrored via SemanticDOM) |
| Settings panel no grouping/help | UX discoverability | **To fix Phase 3** |
| VRApp monolith 2700+ lines | Maintainability debt | **To fix Phase 3** |
| `enableWebPanel` defaulted false with no way to enable it — WebPanel/TabManager/BookmarkPanel/WindowManager (FR-1.1–1.7) unreachable by any real user | Critical (entire browsing feature area, ~25 sessions of work, never reached) | Discoverable toggle added Session 51 (`docs/OUTSTANDING_ISSUES.md` C-5); default intentionally left `false` pending user direction |

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

### Session 51: Multi-Agent Sweep (Ultracode) — enableWebPanel Was Unreachable Since Day One, Plus 3 Verified Bug Fixes
User opted into orchestrated multi-agent work ("ultracode"). Rather than a single Explore pass, ran a Workflow: 8 parallel auditors (`ImmersiveVideo`, `AIRecommendation`, `accessibility.js`, `LayersSystem`, `BookmarkPanel`/`urlResolver.js`, `server`/`utils`/`monitoring.js`, `VoiceCommands`/`WindowManager`/`SemanticDOM`, teleport/controller-disconnect) each instructed to check `CLAUDE.md`/`docs/OUTSTANDING_ISSUES.md` first and require an independently-traced real call chain before reporting a finding — then piped every `hasFinding:true` candidate into a second, adversarial verification agent (effort: high) whose job was specifically to try to refute reachability. 6 of 8 areas came back empty or already-covered; the surviving candidates were independently re-verified by hand before any code changed, since one of them turned out to invalidate two of the others.
- 🔍 **Major finding (not a code bug, a reachability gap)**: the WindowManager-grab-race verifier, while tracing construction, discovered that `settings.enableWebPanel` — the single flag gating `tabManager`/`webPanel`/`bookmarkPanel`/`windowManager`/Layers-attachment construction in `initializeSystems()` (called once, from the constructor) — has defaulted `false` since the very first commit that introduced `WebPanel` (`3897963e`), and **no code path anywhere in the repo (settings-panel button, voice command, persisted setting) ever sets it to `true`**. `docs/SPEC.md` marks FR-1.2 through FR-1.7 (URL bar, tabs, bookmarks/history, WebXR Layers, window management, curved panel) all ✅ "fully implemented," yet every one of them sits behind this same never-reachable flag — meaning roughly 25 sessions of feature work (grab-to-move Session 36, blocked-URL toast Session 50, keyboard suggestions Session 48, bookmark autocomplete, etc.) had never once been reached by a real user in the shipped default configuration. This also **retroactively invalidated two other "verified reachable" findings from the same sweep** (a `BookmarkPanel.scrollOffset` unclamped-after-external-removal bug, and a `LayersSystem` `XRQuadLayer` leak on tab-close) — both are real bugs in that subsystem, but only reachable once a user can actually turn the feature on, which nobody could. Recorded in full (including the two still-real, ready-to-implement sub-bugs) as `docs/OUTSTANDING_ISSUES.md` C-5.
- ✨ **feat (a11y, partial fix)**: rather than unilaterally flipping a day-one default that changes every user's first-launch VR experience (a product decision, not a pure bug fix, and one I'm not positioned to make silently on the user's behalf), added a discoverable settings-panel toggle for `enableWebPanel` (`vr.settings.webPanel`, en/ja) — construction is one-shot per page load, so the toggle's `apply` callback (`_onWebPanelToggleChanged()`) is honest that persisting the setting only takes effect on the next reload (`vr.msg.webPanelReloadRequired`, fired via the existing cross-modal `showVRToast` for free), rather than silently appearing to do nothing (WCAG 4.1.3). The default itself is left unchanged pending explicit user direction.
- 🐛 **fix (a11y — WCAG 2.3.3)**: `osReducedMotion()`/`prefersHighContrast()` (`src/a11y/accessibility.js`) were only ever read once, at each subsystem's construction time inside `initializeSystems()` — an OS-level "Reduce Motion"/contrast preference toggled from the headset's system Quick Settings *after* the page already loaded (a completely ordinary action, and often exactly when a user starts feeling sick) never reached the already-constructed `comfortSystem`/`gazeInteraction`/`captionSystem` for the rest of the page's lifetime, including across VR session enter/exit cycles (verified: neither subsystem is reconstructed by `onVRSessionStart()`/`onVRSessionEnd()`). Added `ComfortSystem.setReducedMotion()`/`GazeInteraction.setReducedMotion()` (mirroring the existing `setHighContrast()` pattern) and a new `VRApp._setupOSAccessibilityListeners()` subscribing to the three relevant `matchMedia` `'change'` events, propagating live to all three subsystems; listeners detached in `dispose()` (same teardown-leak discipline as every prior session's timer/listener fixes).
- 🐛 **fix (media — WCAG 4.1.3)**: `ImmersiveVideo._reportError()` (`src/vr/media/ImmersiveVideo.js`) only ever called `onError()` on a video-element `'error'` event — a mid-stream failure (network drop, decode error) firing *after* `'playing'` had already set `this.playing = true` left the HUD Pause/Play label and `this.playing` permanently desynced from reality forever, unlike `stop()`/`togglePause()`, which both correctly keep all three (`playing`, HUD label, `onPlaybackChange`) in lockstep. `_reportError()` now mirrors that same reset (guarded so a load error *before* playback ever starts, the pre-existing tested case, stays an unchanged no-op).
- 🐛 **fix (locomotion — stuck reticle)**: a controller `'disconnected'` event (headset removed, VR session ends, or a hand-tracking handoff) only ever fires `'disconnected'` — never `'squeezeend'` — for whatever buttons happen to be held (confirmed against `three.js`'s own `WebXRManager`/`WebXRController` source). A mid-aim teleport (squeeze held, never released) left `this.teleport.active` stuck `true` and the marker frozen at its last raycast position indefinitely, since `updateTeleport()` has no input-source guard of its own (unlike `updateLocomotion()`/`updateButtonInput()`, which both skip a disconnected controller). Extracted the existing `onTeleportEnd()` tail into a shared `_resetTeleportAim()` (cancel-state-only, no move/haptic — completing a stale-aim teleport on disconnect would be wrong, since the user never intentionally released) and a new `_cancelTeleportIfAimedBy(controller)` wired into the `'disconnected'` handler.
- 22 new tests across `tests/vr-app-wiring.test.js`, `tests/gaze-interaction.test.js`, `tests/comfort-system.test.js`, `tests/immersive-video.test.js`, and `tests/i18n.test.js`, every one verified failing against pre-fix code via `git stash` before being restored.
- Total 997 tests (46 suites); 0 lint errors (unchanged 84 pre-existing warnings); build verified green.

### Session 50: 長所短所改善点 — Silent Navigation Failures on Blocked/Unresolvable URLs
Dispatched an Explore agent for a fresh audit pass (rendering/FFR/Layers session-lifecycle parity with Session 49's HandTracking fix, ImmersiveVideo, MixedReality, accessibility.js, browser/utils files). It surfaced `MixedReality` (963 lines, fully built AR/passthrough subsystem) as completely unwired — `startSession()` has zero callers anywhere in the repo, so `enabled` never becomes `true` and the entire feature is permanently inert. Unlike Session 39's `AvatarSystem` finding (a fully redundant duplicate, safely deleted), this is the *only* AR implementation and a real feature gap, not dead code — but wiring it needs real AR hardware to verify and an unresolved WebXR session-coexistence design question (can't run `immersive-ar` and `immersive-vr` simultaneously). Recorded as `docs/OUTSTANDING_ISSUES.md` C-4 for a dedicated future session with Plan-agent scoping, rather than attempting a large, unverifiable change in one pass.
- Continued auditing myself and found a smaller, safely-fixable, verifiable bug in the same spirit as Session 27's TabManager max-tabs fix: `WebPanel.navigate(url)` calls `resolveInput()` (blocks `javascript:`/`data:`/`file:`/`blob:`/`vbscript:` schemes, and any non-http(s) scheme with a `://`, e.g. `ftp://`) and, on a null result, just `return`s — **completely silently**. A user typing such text into the VR URL bar (the real, reachable path: chrome-bar tap → `onUrlInputRequested` → VR keyboard confirm → `navigate(url)`) got zero feedback on any channel, violating this project's own standing WCAG 4.1.3 cross-modal principle (every user-visible state change/error routes through caption+haptic+toast).
- 🐛 **fix (a11y — WCAG 4.1.3)**: added an `onBlockedNavigation(rawInput)` callback to `WebPanel` (fires exactly where `navigate()` previously returned silently), threaded through `TabManager` (plain passthrough, matching the existing `onLoadError` pattern) and wired in `VRApp.js` to `showVRToast(t('vr.error.blockedUrl'), {type:'warn'})` — reaching caption + haptic + semantic-DOM mirror for free via the existing cross-modal helper. New i18n key `vr.error.blockedUrl` (en/ja). Backward-compatible: omitting the callback preserves the old silent no-op (verified by a dedicated test) so no other caller needed changes.
- 4 new tests in `tests/webpanel-states.test.js` (blocked scheme fires the callback and doesn't navigate; a non-http(s) `://` scheme also fires it; a normal URL doesn't; no-callback-configured stays a silent no-op), verified failing against pre-fix code (2 of 4 failed — the negative-case tests correctly passed either way).
- Total 975 tests (46 suites); 0 lint errors (unchanged 84 pre-existing warnings); build verified green.

### Session 49: 長所短所改善点 — Ghost Hand Models Leaked on Every VR Session Re-Entry
Dispatched an Explore agent to audit subsystems not yet covered by 48 prior sessions of review (rendering/FFR/Layers, HandTracking, ImmersiveVideo, AIRecommendation, accessibility.js, browser/utils files, server/, WebXR session lifecycle). Confirmed one concrete, clearly-reachable bug rather than a shallow list of maybes — the same reachability-first standard that ruled out B-1..B-4 in `docs/OUTSTANDING_ISSUES.md` as unfixed.
- 🐛 **fix (VR session lifecycle — memory/visual leak)**: `HandTracking.initialize()` unconditionally calls `createHandModels()`, which builds fresh `leftHand`/`rightHand` `THREE.Group`s (25 joint spheres each) and adds them to the scene — but `VRApp.onVRSessionEnd()` never called `handTracking.dispose()`, unlike its sibling `layersSystem`/`immersiveVideo` teardown in the very same method. Every real-world VR re-entry (headset removed then put back on, system menu, an app the user backgrounds and resumes) is a normal `sessionend` → `sessionstart` cycle: `onVRSessionStart()` reruns `handTracking.initialize(session)`, and the previous session's 50 joint meshes — still live scene children — were simply overwritten by new `THREE.Group()` assignments, never `scene.remove()`d or disposed. Each cycle compounded: N re-entries left N-1 sets of frozen "ghost hands" permanently visible at their last-tracked pose, plus unbounded GPU geometry/material growth. `HandTracking.dispose()` already existed and does the correct teardown (detaches the session listener, removes+disposes both hand groups, clears joint/gesture maps) — it just wasn't being called per-session, only from VRApp's own top-level `dispose()`. Added the missing call in `onVRSessionEnd()`; the object is fully reusable afterward since `onVRSessionStart()` already unconditionally re-registers gesture callbacks on every session start regardless of prior state.
- 3 new tests in `tests/vr-app-wiring.test.js` (disposes handTracking on session end; no-ops safely when handTracking was never initialized; disposes alongside the existing layersSystem/immersiveVideo teardown), verified failing against pre-fix code (2 of 3 failed; the no-op case correctly passed either way).
- Total 971 tests (46 suites); 0 lint errors (unchanged 84 pre-existing warnings); build verified green.

### Session 48: 長所短所改善点 — Keyboard URL Suggestions (BookmarkStore.search Finally Gets a UI)
Strengths/weaknesses audit against the standing backlog picked `docs/OUTSTANDING_ISSUES.md` D-4 as the highest-value implementable deficiency: `BookmarkStore.search()` (built in Session 18 *explicitly for autocomplete*) had **zero visual surface** — only the voice go-to command used it, while gaze-dwell typing (~8-10 WPM, arXiv:2503.11357) remained this browser's slowest interaction. The same "data layer exists, UI never wired" class of deficiency as Session 28's grab-to-move finding.
- ✨ **feat (a11y/input)**: `VRJapaneseKeyboard` gains a frecency URL-suggestion row. New `suggestionProvider` constructor option; `_updateSuggestions()` runs on every keystroke (from `updateDisplay()`), queries at ≥ 2 composed chars, and renders up to 4 buttons via `showSuggestions()` — modeled directly on the existing kanji-candidate row (`candidateStyle` colours, numbered order cue, canvas-texture buttons, hover repaint) and **sharing its strip zone** (mutually exclusive: `showCandidates()` clears suggestions and vice versa). Selecting a button confirms the URL through the normal `onTextConfirmed` path (hides keyboard, fires the one-shot confirm → navigation). Hover announces the **full URL**, not the truncated label (WCAG 1.3.3). Provider exceptions degrade to "no suggestions" without breaking typing. Teardown follows the `_clearCandidates()` pattern (unregister + dispose geometry/material/texture) and is invoked from `hide()`/`esc`/`dispose()`.
- Key correctness note: `JapaneseIME.compositionBuffer` stays **raw romaji** (conversion to kana happens only in the returned display value), so ASCII URL queries like "github" match history/bookmarks correctly.
- Pure `suggestionLabel(entry)` helper exported (title → hostname → raw fallback, code-point-aware truncation reusing `bookmarkLayout.truncate`).
- VRApp wiring is one line: `suggestionProvider: (q) => this.bookmarks.search(q, 4, Date.now())`.
- 15 new tests (`tests/vr-keyboard-suggestions.test.js`), all verified failing against pre-fix code. Total 968 tests (46 suites); 0 lint errors (unchanged 84 pre-existing warnings); build verified green.

### Session 47: Phase 3 Roadmap — AccessibilityCoordinator Extraction, Third Slice (Complete)
Direct continuation of Sessions 44/45, closing out the AccessibilityCoordinator extraction.
- ✨ **feat (refactor, Phase 3)**: moved `gazeInteraction` into `AccessibilityCoordinator`, completing all three planned slices. Confirmed the same shape as the prior two: a field-decl `null` and a real `new GazeInteraction(...)` construction, no dispose-time reassignment. Every read/method-call site (`updateSystems()`'s per-frame gaze-dwell poll, the settings-panel `dwellTime`/`graceTime`/`enableGazeDwell`/`highContrast` closures, dispose) needed **zero changes**, since none of them reassign `this.gazeInteraction` itself — they call methods on or set properties of the object it currently points to, which a getter handles transparently.
- Confirmed behavior-preserving the same way as Sessions 44/45: full suite (953 tests) passes unchanged, plus 6 new tests (2 for the coordinator, 3 for the delegation contract, 1 confirming all three fields — captionSystem/hapticFeedback/gazeInteraction — delegate independently).
- Total 953 tests (45 suites); 0 lint errors (unchanged 84 pre-existing warnings); build verified green.
- **This closes `docs/OUTSTANDING_ISSUES.md` item C-1 in full.** `highContrast`/`motionSensitivity`/`windowDistance` syncing was deliberately kept out of scope (feeds ComfortSystem/WindowManager, not the three accessibility subsystems this coordinator owns).

### Session 46: Research-Driven Improvements — Adaptive Vignette + Caption Height (XAUR)
Web-researched recent papers/platform news (W3C XAUR, VR cybersickness mitigation 2025, WebXR 2026 platform direction, VR text entry, VR caption studies) and cross-checked against the implementation. **Most existing features already align with the research** (e.g. `FFRSystem`'s head-motion-based adaptive FFR matches arXiv:2502.03419; head-locked captions match the 82.5%-preference finding in arXiv:2210.15072). Two research-supported gaps were implemented; the rest are recorded in `docs/OUTSTANDING_ISSUES.md` section D.
- ✨ **feat (comfort, research)**: speed-proportional adaptive vignette. `ComfortSystem.updateVignette()` previously snapped to full vignette intensity for any smooth-locomotion motion (binary `externalMotion`). Research on adaptive FOV restriction (VRST '22; adaptive FFR+FoV, arXiv:2502.03419) shows over-restricting the FOV beyond the actual optical flow is itself a comfort cost. Added `externalMotionLevel` (0..1, default 1 for backward compat); the target now scales with the normalized stick deflection fed per-frame by `VRApp.updateLocomotion()`. Head movement/rotation still count as full-strength. 6 new tests (4 fail against pre-fix); existing 40 pass unchanged.
- ✨ **feat (a11y, XAUR)**: user-adjustable caption height. W3C XAUR requires caption position customization and VR eye-tracking studies show wide per-user variation in comfortable height, but the caption panel was hardcoded at y=-0.55. Added `CaptionSystem.setVerticalOffset()` + `verticalOffset` constructor option + exported `clampCaptionOffset()` (range [-0.85,-0.25] m), a "Caption Height" settings-panel stepper next to the existing caption controls, `captionHeight` setting (persisted), and the `vr.settings.captionHeight` i18n key (en+ja). Head-lock behavior itself unchanged. 9 new tests (8 fail against pre-fix).
- Total 949 tests (45 suites); 0 lint errors (unchanged 84 pre-existing warnings); build verified green.
- **Recorded as researched-but-deferred** (`docs/OUTSTANDING_ISSUES.md` D): caption lag option (low value — 82.5% prefer plain head-lock), WebXR-WebGPU Binding (large), Quest 40.4 Depth-API hit-testing (needs hardware), keyboard predictive-suggestion UI (reuses `BookmarkStore.search()`, good next candidate), rest-frame research (already satisfied by the home environment).

### Session 45: Phase 3 Roadmap — AccessibilityCoordinator Extraction, Second Slice
Direct continuation of Session 44 (user re-issued the same "commercial quality front-to-back" request; interpreted as continuing the standing quality-improvement effort, not as authorization for the still-pending deletion/dependency items in `docs/OUTSTANDING_ISSUES.md`).
- ✨ **feat (refactor, Phase 3)**: moved `hapticFeedback` into `AccessibilityCoordinator` alongside `captionSystem`, using the identical getter/setter delegation pattern from Session 44. Found and verified all 4 of `hapticFeedback`'s assignment sites (field-decl `null`, `new HapticFeedback()` construction, init-failure fallback to `null`, dispose-time `null`) are transparently handled by a plain setter — no special-casing needed. Every one of the ~15 call sites that read `this.hapticFeedback.playPattern(...)` across locomotion/teleport/grab/voice handling needed **zero changes**.
- Confirmed behavior-preserving the same two ways as Session 44: full suite (934 tests) passes unchanged, plus 5 new tests (2 for `AccessibilityCoordinator` itself, 3 for the VRApp delegation contract, including one confirming `captionSystem` and `hapticFeedback` delegate independently).
- Total 934 tests (45 suites); 0 lint errors (unchanged 84 pre-existing warnings); build verified green.
- **Remaining**: `gazeInteraction` only — deferred because it's tightly coupled to `updateSystems()`'s per-frame gaze-dwell block (unlike captionSystem/hapticFeedback, which both have a simple, self-contained try/catch construction path). See `docs/OUTSTANDING_ISSUES.md` item C-1.

### Session 44: Phase 3 Roadmap — AccessibilityCoordinator Extraction, First Slice
Dispatched an Explore agent first (per this project's own guidance for Phase 3 refactors) to inventory every accessibility-related field/method in VRApp, confirm no other file reaches into `captionSystem`/`hapticFeedback`/`gazeInteraction` directly, and assess risk to `tests/vr-app-wiring.test.js`.
- ✨ **feat (refactor, Phase 3)**: added `src/vr/accessibility/AccessibilityCoordinator.js`, homing `captionSystem` as the first of three planned slices (recommended by the investigation as lowest-risk: fewest construction dependencies, smallest settings-panel surface, and `notifyCrossModal`/`fireTeleportFeedback`/etc. already take captionSystem as a plain parameter rather than reading it off VRApp). `VRApp` gained a `captionSystem` getter/setter delegating to `this.a11y.captionSystem` — every existing read/write call site (construction, ~15 settings-panel/interaction closures, dispose, cross-modal helper calls) needed **zero changes**, since `this.captionSystem` continues to resolve exactly as before.
- Confirmed behavior-preserving two ways: the full suite (929 tests) passes unchanged, and a dedicated test verifies the getter/setter actually delegates (`tests/vr-app-wiring.test.js`'s flat-object-literal tests are structurally blind to VRApp's own accessors, so a real accessor check needed `Object.create(VRApp.prototype)` instead). 4 new tests (2 for `AccessibilityCoordinator` itself, 2 for the delegation contract).
- **Deferred, not done**: `hapticFeedback` (~15 call sites, higher mechanical-edit risk) and `gazeInteraction` (tightly coupled to `updateSystems()`'s per-frame gaze-dwell block) — recommended order and land-mines (camera-construction ordering, the `_handTrackingTimers` closure that reads `captionSystem` from ~60 lines away, the `highContrast` toggle's multi-system closure) are recorded in `docs/OUTSTANDING_ISSUES.md` item C-1 for whichever session picks this up next.
- Total 929 tests (45 suites); 0 lint errors (unchanged 84 pre-existing warnings); build verified green.

### Session 43: Phase 2 Roadmap — Gaze-Dwell VRApp-Side Glue (Closes Session 41's Deferral)
Picked up the one piece Session 41 explicitly left open: VRApp's own per-frame gaze-dwell glue in `updateSystems()` (dwell timer/grace-time logic itself was already covered by `gaze-interaction.test.js`).
- ✨ **test (VRApp wiring, Phase 2)**: added 7 tests to `tests/vr-app-wiring.test.js` covering `updateSystems()`'s gaze-dwell activation path — a `gazeInteraction.update()` return value fires a both-hands haptic click and a spatial "click" sound at the activated object's world position; no activation/disabled/uninitialized `gazeInteraction` all correctly no-op; null-safe without haptic or spatial audio wired. Also covers the adjacent caption-aging call (`captionSystem.update(dt*1000)`), gated on `enabled`. Isolated the gaze-dwell/caption glue from locomotion/button-input/teleport/hover (each already tested on its own) by stubbing those four sibling per-frame methods.
- 🐛 **fix (test infra, found while writing this)**: the shared `hapticFeedback`/`captionSystem` mocks in `vr-app-wiring.test.js` were missing `update()` methods that `updateSystems()`'s gamepad-refresh and caption-aging calls need — added, harmless to the existing 32 tests since none previously exercised `updateSystems()`.
- Total 925 tests (44 suites); 0 lint errors (unchanged 84 pre-existing warnings); build verified green. This closes the Phase 2 roadmap item in full — no remaining gap in VRApp's accessibility/interaction wiring coverage.

### Session 42: Cleanup — Non-Existent Placeholder Domains Presented as Real
User asked to remove non-existent/unspecified address domains.
- 🧹 **cleanup**: `.env.stripe` and `api/stripe-payment.js` (both already marked superseded, Session 38) hardcoded `qui-browser.com` / `qui-browser.example.com` as if they were real, registered production domains. Replaced with `your-domain.example` (RFC 2606 reserved TLD — guaranteed to never resolve to a real, possibly unrelated site) plus a comment explaining it's a placeholder to replace.
- 🧹 **cleanup**: README's Support section listed `support@qui-browser.example.com` / `security@qui-browser.example.com` — non-existent email addresses that would bounce. Removed; the section already has working GitHub Issues/Discussions links.
- Verified via full suite (918 tests, unchanged) + lint (0 errors) + build, all green — text/config-only change.

### Session 41: Phase 2 Roadmap — VRApp Integration Tests (Deferred Since Session 2)
Picked up the standing Phase 2 gap ("no test verifies VRApp wiring end-to-end") rather than another audit sweep, since it's been flagged and deferred every session since the original Session 2 audit.
- 🔧 **infra**: restored `babel.config.js` (root-wide Babel config), lost earlier this session in an unrelated branch-recovery accident. `.babelrc` is file-relative and does not apply across the `node_modules` boundary, so the real `three/examples/jsm/webxr/VRButton.js` (an unmocked, transitive import of `VRApp.js`) failed to transpile with "Unexpected token 'export'" — the same class of gap this file previously fixed for `KTX2Loader.js`.
- ✨ **test (VRApp wiring, Phase 2)**: added `tests/vr-app-wiring.test.js`. Constructing a full `new VRApp(container)` isn't practical — `setupRenderer()` creates a real `THREE.WebGLRenderer`, which needs a real GPU/canvas context unavailable in Jest — so these tests bind VRApp's real (unmodified) prototype methods to a hand-built `this` carrying just the state each method reads, using the *real* `three` package (only the two WebXR-session-touching `examples/jsm` modules VRApp imports are mocked, since their top-level code assumes a live `navigator.xr` and neither is exercised by the methods under test). 32 tests covering: `showVRToast`'s cross-modal dispatch (semantic-DOM mirror fires even outside a VR session; 3D toast mesh only inside one; haptic+caption via `notifyCrossModal`; caption gating; toast-timer tracking), `registerInteractable`/`unregisterInteractable` (dedup, removal), `onControllerSelect` press (hit-test dispatch, haptic click, handedness fallback, `qui-select` DOM event) and release (Session 36/37's grab-to-move end-of-drag logic, including the same-controller guard), `_onPanelGrabRequested` (Session 36's stale-target re-sync fix), `updateHover` (enter/exit/unchanged), and `recenter()`.
- Total 918 tests (44 suites); 0 lint errors (unchanged 84 pre-existing warnings); build verified green.
- **Deferred, not done**: gaze-dwell activation → reticle + haptic + `onSelect` is still uncovered on the VRApp side (`GazeInteraction` itself is already unit-tested independently) — the remaining piece of the original Phase 2 scope, left for a future session.

### Session 40: 長所短所改善点 — TextureManager Re-Derived Compression State From the URL, Corrupting Memory Accounting
Continued the sweep of never-audited utility files (`DevTools.js`, `PerformanceMonitor.js` came back clean earlier this session):
- 🐛 **fix (perf/memory)**: `TextureManager.cacheTexture(url, texture, isCompressed)` correctly recorded whether a texture was loaded compressed, but `unloadTexture()` — called by `pruneCache()`, the mechanism protecting the 512MB Quest 2 budget — re-derived compression state from `url.endsWith('.ktx2')` instead of using the real flag. The class's own documented usage example loads a normal map via `loadTexture('wood_normal.png', { preferKTX2: true })` — a **non**-`.ktx2` URL that still sets `isCompressed=true` at cache time. On eviction, the URL-suffix guess said `false`, so `estimateTextureMemory` used the uncompressed formula (8x larger than what was actually added), permanently corrupting `memoryUsage.estimatedBytes` on every such eviction and defeating the memory-budget check that depends on it. Now stores `isCompressed` alongside the texture in the cache entry (`{texture, isCompressed}`) instead of re-guessing it later. 2 new tests, verified failing against the pre-fix code (one asserts the exact byte count round-trips to zero after unload; one covers mixed compressed/uncompressed entries unloading independently). Total 886; 0 lint errors (unchanged 84 pre-existing warnings).

### Session 39: Socratic 過不足 (continued) — A Second, Fully Redundant Avatar System
Continued the audit; delegated a fresh sweep of the remaining never-audited files.
- 🧹 **cleanup (multiplayer, excess)**: `AvatarSystem` (FR-7.2) was constructed and disposed by `VRApp` but otherwise completely unwired — a repo-wide grep confirmed `addPeer`/`removePeer`/`updatePeerPose`/`setPeerVoiceStream` are never called from anywhere outside the class's own file. `MultiplayerSystem` already has its own complete, working avatar pipeline (`createAvatar`/`updatePlayerInfo`/`updateAvatarPosition`, fixed end-to-end in Session 31) driven by real `player-info` data-channel messages, making `AvatarSystem` a fully redundant duplicate that never rendered anything. Its voice-streaming half (`setPeerVoiceStream`) was doubly dead: it needs a WebRTC `ontrack` handler that doesn't exist anywhere in this codebase (no `ontrack`/`getUserMedia`/`addTransceiver` calls at all), so even if wired up, no peer's microphone audio was ever going to reach it. Removed the dead `import`/construction/dispose call from `VRApp.js`; left the `AvatarSystem` class and its 14-test suite in place (not deleted — kept as a tested, standalone building block for a possible future feature) with a doc comment explaining it isn't part of the running app. `MultiplayerSystem.handlePeerLeft()`'s `removeVoiceSource(peerId)` cleanup call — also for a voice source that can never exist today — was deliberately left alone: it's a pre-existing, intentionally-tested no-op, not a bug, and correctly forward-compatible if voice streaming is ever built.
- Verified via full suite (884 tests, unchanged) + lint (0 errors, 84 pre-existing warnings) + build, all green after the removal.

### Session 38: Commercial-Quality Pass — Broken Production Build, Backend Wiring, Billing Footguns
User asked to bring the project to commercial/production quality "front-end to back-end." A repo-wide survey (see docs/MODEL_GUIDE.md for how it was scoped) found the production build itself was broken, and that "backend" barely existed as anything more than two unwired reference files.
- 🐛 **fix (build — critical)**: `npm run build` failed outright — `web-vitals` was declared in `package.json` but missing from the installed `node_modules`/lockfile state, so Rollup couldn't resolve the import in `src/monitoring.js`. This directly contradicted every archived "100% PRODUCTION READY, build successful" report. Reinstalling brought the lockfile back in sync; build now succeeds.
- 🐛 **fix (monitoring)**: found while in the same file — `MONITORING_CONFIG.performance.thresholds` still had a `fid` key from before the web-vitals v3 migration from FID to INP (`initWebVitals` already correctly subscribes to `onINP`, not the removed `onFID`). `onVitalReport`'s `thresholds[name.toLowerCase()]` lookup resolved to `undefined` for every INP report, so the Sentry "Performance issue" escalation could never fire for INP regardless of how bad the value was. Renamed the key to `inp: 200` (INP's official "good" boundary, matching the convention already used by the other four thresholds in the same object). 1 new test, confirmed to fail against the pre-fix code.
- ✨ **feat (backend — feature completion)**: `server/stripe-billing.js` (622 lines, a real JPY-tiered subscription billing router) had zero wiring — no `server.listen()`, not required anywhere, never linted. Added `server/index.js` as an actual entrypoint (`npm run start:server`): CORS, a `/health` endpoint, and — the classic Express+Stripe gotcha — routes the webhook path around the global JSON body parser so `stripe.webhooks.constructEvent()` still gets the raw byte buffer it needs to verify signatures, instead of an already-parsed object that breaks verification. Billing routes return 503 (not a confusing deep Stripe SDK error) when `STRIPE_SECRET_KEY` isn't configured.
- 🐛 **fix (billing — security footgun)**: three spots in `stripe-billing.js` fabricated a successful/paid response instead of failing safely, all because no database is wired up yet: `GET /subscription/:userId` always returned a fake `'active premium_monthly'` regardless of the real user; `POST /create-portal-session` used a hardcoded fake Stripe customer id (`cus_example`); and — the most dangerous one — `checkFeatureAccess()` middleware hardcoded `planId = 'premium_monthly'` for *every* request, which would have silently granted every authenticated user every paid feature the instant real auth middleware started setting `req.user`, regardless of whether they ever paid. All three now fail closed to `'free'`/a clear validation error, matching the "safe empty result beats a fake one" principle already used for the AI recommendation placeholders (Session 33).
- 🧹 **cleanup**: `api/stripe-payment.js` described a second, contradictory pricing model (a "Chrome extension" license at $0.50/mo or $1.50 lifetime) that doesn't match the product's real VR subscription plans — marked clearly as superseded/not-mounted rather than silently left as a second source of truth. Extended `npm run lint`/`lint:fix` to also cover `server/**/*.js` (was `src/`-only) and fixed the ~350 mechanical indentation/case-block errors those files had never been linted against — 0 new errors.
- 📋 **docs**: wrote `docs/MODEL_GUIDE.md`, a model/tool selection reference for this specific product based on the full session history (which model for which class of task, and why, based on what actually worked).
- 15 new tests (server/index.js integration tests via Node's built-in `fetch` — no new test dependency; stripe-billing.js's three fail-safe fixes). Total 884 tests, 0 lint errors across `src/` + `server/` (84 pre-existing warnings, unchanged in kind). `npm run build` verified green.
- **Deferred, not done**: a confirmed-dead legacy codebase (`assets/js/`, 3.8MB/184 files, zero references from the active test suite) and 10 stale archived test files (`tests/archive/`, already excluded from test runs) were identified as safe to delete, but the deletion was blocked by the permission system since it requires the user to directly name specific deletion targets — a plan document listing them isn't sufficient authorization. Left in place pending explicit user confirmation.

### Session 37: 長所短所改善点 — Stale WebRTC Handlers Could Clobber a Reconnected Peer's Data Channel
Continued the Session 25 sweep's deferred "lower severity" candidates ("data-channel listeners not nulled on reconnect") rather than starting an unrelated audit:
- 🐛 **fix (multiplayer)**: `reconnectPeer()` and `handlePeerLeft()` both called `pc.close()` / `channel.close()` without first detaching the closing object's event handlers. RTCDataChannel/RTCPeerConnection dispatch their close/statechange events asynchronously (not synchronously inside `close()`), so a delayed `onclose` from an *old*, already-closed channel can still fire after a *new* channel for the same `peerId` has already been registered (a flapping connection can trigger `reconnectPeer()` again, or the peer can genuinely rejoin) — silently deleting the new, live channel's `dataChannels` map entry via the stale handler's closure and breaking that peer's messaging until another reconnect happens to fix it. `disconnect()` had the identical gap (closed every `pc` without detaching, and never explicitly closed data channels at all — relying only on `.clear()`-ing the map) despite already nulling `signalingServer`'s handlers for the exact same reason one function above.
- Added a shared `_detachPeerHandlers(pc, channel)` (nulls `onicecandidate`/`onconnectionstatechange`/`ondatachannel` and `onopen`/`onmessage`/`onerror`/`onclose`) called before every close site; `disconnect()` now also explicitly closes each data channel instead of only clearing the map.
- 6 new tests, including two that simulate the actual race (register a new channel under the same `peerId`, then fire the *old* channel's now-detached `onclose` and assert the new entry survives) — verified failing against the pre-fix code before confirming they pass after. Total 868; 0 lint errors (unchanged 62 pre-existing warnings).

### Session 36: Feature Completion — Wired Up Grab-to-Move (Deferred Since Session 28)
Session 28 investigated WindowManager's documented "grab-to-move" panel feature and found it fully implemented/tested but with **zero UI wiring** — `beginGrab`/`endGrab` were never called from VRApp or any input handler — and deferred it as a feature-completion task. Picked that up rather than starting another audit pass:
- ✨ **feat (browser — feature completion)**: added a `moveBarMesh` grab handle strip below every `WebPanel` (Wolvic-style move bar), registered through the existing `registerInteractable` mechanism with hover tinting matching the chrome bar. Selecting it calls a new `onGrabRequested(controller)` callback threaded through `TabManager` → `WebPanel`; `VRApp._onPanelGrabRequested()` wires this to `WindowManager.beginGrab()`. The trigger (select), not squeeze, drives the grab — squeeze is already fully committed to teleport aim/release, so overloading it would have collided with an existing gesture. Releasing the trigger (`onControllerSelect(controller, false)`, previously a no-op) now ends the grab via `WindowManager.endGrab()` if the releasing controller is the one that started it (tracked in a new `this._grabController`), so the other hand's independent trigger presses don't interfere.
- 🐛 **fix (found while wiring)**: `windowManager.target` is only re-synced to the active tab inside the per-frame render-loop block, and only while `followMode || isGrabbing` is *already* true — so a tab switch that happened while both were off would have left a freshly-requested `beginGrab()` computing distance from a stale, possibly-hidden panel. `_onPanelGrabRequested()` now re-syncs the attachment itself before calling `beginGrab()`, independent of that render-loop guard.
- ✨ **feat (a11y, cross-modal)**: added `firePanelGrabFeedback()` / `firePanelReleaseFeedback()` to `WindowManager.js`, mirroring `fireTeleportFeedback`'s shape (haptic + caption) — 'click' + "Panel grabbed" on grab-start, heavier 'impact' + "Panel moved" on release, both gated on `captions.enabled` like every other cross-modal path. New i18n keys `vr.msg.moveBarLabel` / `panelGrabbed` / `panelMoved` (en+ja), and a hover caption on the move bar itself (WCAG 1.3.3) matching the tab-strip/chrome-bar hover pattern.
- 19 new tests (WebPanel move-bar construction/hover/select/dispose, WindowManager feedback helpers incl. i18n translation, TabManager passthrough, i18n keys). Total 862; 0 lint errors (unchanged 62 pre-existing warnings, all `no-console`).

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

### Session 35: Socratic 過不足 (continued) — Passthrough Opacity No-op + Broad Clean Sweep
Delegated a wider audit (HapticFeedback, ImmersiveVideo, FFRSystem/LayersSystem, HandTracking/GazeInteraction, ComfortSystem presets) — came back clean: all documented haptic patterns exist, video controls and error paths are real, no docstring/implementation mismatches, all advertised gestures are wired, and the one flagged ComfortSystem preset "inconsistency" (`'disabled'` omitting `smoothing`/`duration`) turned out not to be a live bug on direct trace — `updateVignette`/`updateFOV` (the only readers of those fields) are already gated behind the same `enabled` flag the preset does set, so the stale value is never read. No action taken there; a good outcome after 5 sessions of the same search.
- 🧹 **cleanup (AR, excess)**: `setPassthroughOpacity()` (noted but deferred earlier this session) clamped and stored its value correctly, but the "apply to render" branch was an empty `if (scene.background instanceof THREE.Color) { /* would need custom shader */ }` — conceptually confused besides being empty, since `THREE.Color` has no alpha channel to blend in the first place. Removed the dead branch, documented the real limitation (a continuous compositor pass doesn't exist; `togglePassthrough()`'s `environmentBlendMode` switch is binary, not continuous) instead of a branch pretending to handle it. 4 new tests. Total 843.

### Session 34: Socratic 過不足 (continued) — Orphaned PoolManager Wiring
Direct follow-on from Session 32: also checked `WebGPURenderer` (honestly documented experimental/opt-in, no fix needed) and the settings-panel toggle wiring (`enableTeleport`/`enableSnapTurn`/`enableComfort` all correctly re-checked live per frame — no bugs found there).
- 🧹 **cleanup (VRApp, excess)**: after Session 32 removed the only real consumer of `poolManager` (the fake per-frame demo), the entire `PoolManager`/`ObjectPool` wiring in VRApp became provably dead — pre-allocating 170 Vector3/Quaternion/Matrix4 objects and reporting `stats.pooledObjects`/`stats.gcPrevented` with nothing anywhere calling `getPool()`/`acquire()` again. `enableObjectPooling` had no settings-panel toggle at all (verified), so this was a purely internal, always-on flag with zero user-facing effect. Removed the settings key, registration block, stats reporting, dispose call, and the now-unused import. `ObjectPool`/`PoolManager` classes themselves are untouched — the app's real hot paths already use the established manual lazy-init scratch-field pattern instead. Verified via grep (no test coverage referenced it) + full suite. Total 839.

### Session 33: Socratic 過不足 (continued) — AI Recommendations Were 100% Fictional Placeholder Content
Continued the same audit; widened the "would...in production" grep and followed the `getCollaborativeRecommendations()` stub found earlier all the way through:
- 🐛 **fix (AI, deficiency + excess)**: every recommendation source in `AIRecommendation.js` — content-based, collaborative, trending, contextual, time-based — generates simulated demo entries with `url: '#'`. Not "simplified" (as the comment claimed): 100% fictional across all five sources, since the browser has no real content catalog or social graph. `getRecommendations()` has no live UI consumer today (VRApp only feeds `trackVisit()` in; nothing calls it out), so this currently misleads no one — but the first future "Recommended for you" panel to wire this up would present dead links as real suggestions. Added `isNavigableUrl()` (pure, exported) as a single-choke-point filter in `rankRecommendations()`, so no placeholder entry can ever reach a caller regardless of source — the demo content stays as internal scoring scaffolding, only the final output is filtered. Matches the "safe empty result beats a fake one" principle already used for the extrapolation-branch removal (Session 31). 7 new tests. Total 839.

### Session 32: Socratic 過不足 (continued) — Dead VRApp Code + False-Positive Passthrough Detection
Continued the same audit style, widening the stub-comment search beyond MultiplayerSystem.js:
- 🧹 **cleanup (VRApp, excess)**: `VRApp.detectMotion()` always returned `false` ("For now, return false (stationary)") and was **never called anywhere** — the real, working motion detection used by the comfort/vignette system is `ComfortSystem`'s own separate `detectMotion()`. VRApp's copy was 100% dead, confusingly-named duplicate code. Removed.
- 🧹 **cleanup (VRApp, excess)**: adjacent `updateSceneWithPools()` (explicitly commented "Example:") ran every frame, acquiring a `Vector3` from `poolManager`, setting it to a `sin`/`cos` value nobody read, then releasing it — the *only* caller of `poolManager.getPool()` anywhere in VRApp. Every acquire incremented `ObjectPool`'s `gcPrevented` counter, which feeds `stats.gcPrevented` in the perf/debug overlay — a real-looking number that was pure self-referential busywork, not evidence of any real allocation avoided elsewhere. Removed rather than kept as decoration.
- 🐛 **fix (AR, excess/false-positive)**: `MixedReality.hasPassthroughExtension()`'s fallback checked whether `navigator.xr.isSessionSupported` merely *existed* — true on virtually any WebXR browser, VR-only headsets included — so `checkSupport()`'s `passthrough` flag was always `true` regardless of actual camera-passthrough hardware. Currently low-impact (only reaches a `console.debug`, no UI/feature gate consumes it yet) but objectively wrong; now only trusts the genuine `window.OculusBrowserExt` vendor global since there's no standard way to detect passthrough beyond the `'immersive-ar'` session type already checked. 6 new tests. Total 831.

### Session 31: Socratic 過不足 (Excess/Deficiency) — Multiplayer Avatar Sync Was Fully Non-Functional
Socratic framing: where does "excess" (code that runs but does nothing) or "deficiency" (missing pieces) hide? Grepped for `"would ... in production"` stub comments across `src/` and found three candidates in `MultiplayerSystem.js`; investigated all three.
- 🐛 **fix (multiplayer — critical, deficiency)**: `handleDataMessage`'s `'player-info'` case called `this.updatePlayerInfo(peerId, data)` — a method that **did not exist anywhere in the file**. Every real peer connection sends a `'player-info'` message the instant its data channel opens (see `setupDataChannel`'s `onopen`), so this threw a `TypeError` on the very first message from every peer. Worse: `createAvatar()` — which builds the visible avatar mesh — was **never called from the live message-handling path at all**, only from unit tests that call it directly. `updateAvatarPosition`/`Rotation`/`HandPose` all early-return on a missing `this.avatars.get(peerId)`, so with no avatar ever created, **avatar sync was completely non-functional in any real multiplayer session** — Session 25's ghost-avatar fix was correct but protected a feature that never actually ran end-to-end. Added `updatePlayerInfo(peerId, info)`: creates the avatar on first contact, refreshes stored info without recreating on subsequent messages.
- ✨ **feat (multiplayer, deficiency)**: found alongside — the "Add name label" stub ("Would create 3D text in production") meant every remote avatar was an anonymous colored blob despite `info.name` already being tracked and transmitted. Added `_buildNameLabel()` using the same CanvasTexture-on-a-plane pattern as every other in-VR UI surface (`THREE.Sprite` auto-billboards). Extended `_disposeAvatar()` to also dispose `material.map` — the label's texture, which `.dispose()` on the material alone would not free (same leak class as WebPanel/TabManager/BookmarkPanel).
- 🧹 **cleanup (multiplayer, excess)**: the third candidate, an avatar-extrapolation branch, computed `timeSinceUpdate` and then did nothing with it — a config flag (`interpolation.extrapolation`) implying a working feature that was dead code. Removed rather than half-implemented: a static freeze (interpolation already holds the last known position once `progress` reaches 1) is a safe fallback, and inventing unverified velocity-prediction math risked a worse visual artifact for a case that already degrades gracefully.
- 13 new tests (updatePlayerInfo definition/creation/no-recreate/info-refresh/no-throw, exercised via both direct calls and the real `handleDataMessage('player-info')` path; name-label attachment, peerId fallback, texture disposal). Total 825.

### Session 30: Phase 2 Roadmap — Semantic DOM Overlay
Picked up the next standing roadmap item (Phase 2 #4, previously deferred) rather than another audit pass:
- ✨ **feat (a11y — Phase 2)**: every accessibility surface so far (captions, haptics, toasts) lived entirely inside the Three.js/WebXR scene — invisible to anything outside the render, most importantly a screen reader. Added `SemanticDOM` (`src/vr/accessibility/SemanticDOM.js`): a visually-hidden ("sr-only" — clipped, not `display:none`, which would also hide it from assistive tech) region with a caption mirror (`role="status"`, `aria-live="polite"`), a toast/alert mirror (`role="alert"`, `aria-live="assertive"`), and a settings-panel state region (`aria-expanded`). Pure DOM manipulation, no Three.js dependency, safely no-ops without a `document`.
- Wired via two choke points instead of touching every call site: `CaptionSystem` gained an `onShow` callback (mirrors `VoiceCommands`' existing `onSpeak` pattern) firing from its single `show()` method; `showVRToast()` mirrors to the alert region *before* its `isVREnabled`/camera guard — several subsystem-failure toasts (haptics, spatial audio, AI) fire during `initializeSystems()`, before the user has entered VR at all, so gating the mirror the same way as the 3D mesh would have silently dropped those exact messages a second time.
- 🐛 **fix (i18n, found while wiring)**: the settings-panel toggle caption was still a hard-coded `Settings: open/closed` literal; added `vr.msg.settingsOpen`/`vr.msg.settingsClosed` catalog entries and wired `t()`.
- 23 new tests (SemanticDOM construction/regions/methods/dispose/no-DOM fallback, CaptionSystem `onShow` wiring, new i18n keys). Total 817.

### Session 29: Socratic New Perspective — Voice "Help" Command Announced a Count, Not the Commands
Socratic reasoning (who most needs voice commands? → users for whom gaze/controller input is difficult → voice is their primary input → what stops them using more commands? → not knowing what to say → does a help mechanism exist? → yes → does it solve discoverability? → **no**):
- 🐛 **fix (voice — WCAG 4.1.3)**: the `help` voice command built a full phrase list internally but only ever spoke `"使用可能なコマンドは、N個です"` (there are N commands) — the count, never the list. The list it discarded was also keyed by internal English identifiers (`navigate: Navigate to next page`), which wouldn't have taught the Japanese trigger phrase even if spoken. Rewrote `help` to announce each command's actual literal phrase via the existing `speak()`/`onSpeak` cross-modal path (reaches TTS + captions for free). Two free-form commands (`search`, `go-to`) have only RegExp patterns with no fixed phrase; added an optional `example` field (`registerCommand`) as a fallback so help never reads a raw RegExp source aloud. 7 new tests; total 797.

### Session 28: 長所短所改善点 — History Panel Could Never Scroll Past Page 1
Continued the audit; also investigated WindowManager's documented "grab-to-move" panel feature and found it fully implemented/tested but with **zero UI wiring** (`beginGrab`/`endGrab` are never called from VRApp or any input handler) — a real gap, but scoped as a feature-completion task (new draggable "move bar" UI + input wiring) rather than a same-session bug fix; deferred, not fixed.
- 🐛 **fix (bookmarks/history)**: `BookmarkPanel._rows()` called `store.getHistory(VISIBLE_ROWS)`, capping the fetch at exactly one page. Since `_draw()`'s scrollable check is `allRows.length > VISIBLE_ROWS` and `allRows` was already capped at `VISIBLE_ROWS` by the fetch itself, that condition could **never be true** — the scroll arrows never appeared and `scrollDown` was always a no-op, regardless of actual history size. Only the newest ~9 entries were ever visible or reachable; bookmarks mode was unaffected (`getBookmarks()` has no limit). Exported `BookmarkStore.MAX_HISTORY` (200, the real storage cap) and pass that instead. 1 new test — built a store whose `getHistory()` mock actually respects its limit arg (the existing test helper ignores it, which is exactly why this regression wasn't caught earlier); verified it fails against the pre-fix code. Total 790.

### Session 27: 長所短所改善点 — 26 Dead i18n Catalog Keys + Silent Max-Tabs Failure
Continued the audit sweep; this pass targeted the Phase 1 i18n claim directly instead of trusting the session log:
- 🐛 **fix (i18n — critical)**: `i18n.CATALOG` had 21 `vr.msg.*` + 5 `vr.error.*` fully translated (English + Japanese) entries that **VRApp.js never called** — `captionSystem.show()`/`showVRToast()` sites still used raw hard-coded English literals (`'Tab closed'`, `'Bookmarked'`, `'Recentered'`, `'Player joined'`, `'Foveation unavailable'`, etc.). A Japanese user saw English captions for every tab/bookmark/video/multiplayer/subsystem status message despite the translations already existing — the Session 2 "Phase 1 Complete" i18n claim was only true for settings-panel labels, not status messages. Replaced all matching literals with `t('vr.msg.*')`/`t('vr.error.*')` calls across ~15 call sites.
- 🐛 **fix (tabs — WCAG 4.1.3)**: found while auditing the same file — `TabManager.newTab()` blocked at `MAX_TABS` (8) with only a `console.warn`; the "+" button silently did nothing for a user who kept tapping it past the limit. Added an `onMaxTabsReached` callback wired to a new `vr.msg.maxTabsReached` catalog entry via `showVRToast(type:'warn')`.
- 4 new tests (TabManager callback ×2, i18n key ×1); total 789.

### Session 26: 長所短所改善点 — Stale iframe Handlers on WebPanel Teardown
Follow-up audit pass on the remaining candidates from Session 25's multiplayer/window/video/tab sweep:
- 🐛 **fix (browser)**: `WebPanel.dispose()` removed the `<iframe>` from the DOM but never cleared its `onload`/`onerror` handlers. Closing a panel/tab while a page was still loading left the in-flight navigation free to fire its load/error event afterward — the stale handler would redraw `chromeCanvas` onto an already-`.dispose()`'d `chromeTex` and call `onNavigate()`/`onLoadError()` against a torn-down VRApp. Same teardown-leak class as the toast timers (Session 4), hand-tracking timers (Session 21), and queued TTS utterances (Session 20) — `dispose()` now nulls both handlers before detaching the element. 3 new tests; total 786.

### Session 25: 長所短所改善点 — Ghost Avatars on Permanent WebRTC Peer Failure
Strengths/weaknesses audit of under-explored subsystems (multiplayer, window management, video, tab management), focused on genuine bugs rather than style:
- 🐛 **fix (multiplayer)**: `pc.onconnectionstatechange` reacted to `'failed'` by calling `reconnectPeer()` exactly once, with no retry cap and no fallback. The *only* code path that removed an avatar and decremented `stats.connectedPeers` was `handlePeerLeft()`, fired solely by an explicit `'peer-left'` signaling message — which never arrives when a peer's connection dies independently of the signaling socket (crash, network partition). Result: a permanently-gone peer left a **ghost avatar frozen in the scene forever** and the connected-peer gauge drifted upward with no recovery. Added a capped per-peer reconnect-attempt counter (`_peerReconnectAttempts`, `MAX_PEER_RECONNECT_ATTEMPTS=3`); once exceeded, `handlePeerLeft()` runs the same graceful-departure teardown (avatar dispose, stats decrement, spatial-audio release) instead of retrying forever. Counter resets on successful reconnect, cleared in `handlePeerLeft()`/`disconnect()`. 5 new tests; total 783.
- Other candidates surfaced (iframe onload/onerror handler races in WebPanel, tab-strip hover-color not reset on dispose, data-channel listeners not nulled on reconnect) are lower severity/cosmetic — deferred, not yet fixed.

### Session 24: Community Research — Sokuon cc/tch Edge Cases & Locomotion GC Pressure
Qiita sokuon follow-up (empirical test after Session 23 ん fix) + GitHub/Qiita "avoid new in render loop" audit:
- 🐛 **fix (IME — sokuon)**: `ecchi`→えcchi, `matcha`→まtcha, `kocchi`→こcchi — three broken common words. Root causes: (a) `c` was absent from the doubled-consonant set so `cc` wasn't recognized as っ; (b) `tch` (different first consonant) can't be caught by the `buf[0]===buf[1]` check. Added `c` to the set and an explicit `buf==='tc' && next==='h'` guard that emits っ and leaves `c` for the normal `cha/chi/cho` resolution. 3 new tests; total 778.
- ⚡ **perf (smooth locomotion)**: `updateLocomotion()` allocated `new THREE.Quaternion()` + 3 `new THREE.Vector3()` per active controller per frame — up to 720 allocs/sec at 90 Hz during movement. Replaced with lazy-init `_locoQ/Fwd/Right/Move` scratch fields mutated in place (same pattern as raycaster, Session 4).
- ⚡ **perf (gesture detection)**: `isThumbUp()` called per-frame from `recognizeGestures()` allocated `new THREE.Vector3()` per tracked hand. Added `_tmpThumbVec` lazy scratch. Both verified by inspection; full suite stays at 778 / 0 lint errors.

### Session 23: Community Research — Syllabic ん (the romaji-IME "n" ambiguity)
Researched Qiita romaji-kana conversion posts (the perennial 撥音「ん」problem: a lone `n` is itself a kana (ん) but is also the onset of the な-row and にゃ-row, so naive greedy matching mangles it). Traced `JapaneseIME.convertRomajiToHiragana` empirically and found it **fundamentally broken** for the most common Japanese input:
- 🐛 **fix (IME — core input)**: a lone `n` was matched to ん *immediately*, before its vowel could form な. Reproduced: `na`→`んあ`, `ni`→`んい`, the whole な-row, plus `nya`→`んや` (にゃ-row), `nn`→`んん`, and `konnichiha`→`こんんいちは`. Only な-row-free words (e.g. `sankaku`→さんかく, `n`-before-consonant) happened to work — so the headline "Japanese IME unlocks 100M+ market" feature silently produced garbage for the most basic words. Rewrote the converter with proper syllabic-`n` look-ahead (`n`+vowel/y → defer to form な/にゃ; `nn`+vowel → ん + な-row so `nna`→んな; plain `nn` → single ん; `n`+consonant/end → ん) plus a general prefix-deferral driven by a precomputed `_romajiPrefixes` Set (so multi-char onsets `ny`/`sh`/`ch`/`ts` wait for their longest form instead of an early short match). Verified against 25 words including `ganbatte`→がんばって (ん + sokuon together) and the incremental-composition path (`n`→ん mid-compose, re-resolving to `な` once the vowel arrives). 12 tests (な-row, にゃ-row, nn, nn+vowel, n+consonant, trailing n, konnichiha, ganbatte, incremental, katakana carry-through). `npm run lint` stays at 0 errors. Total: 775 tests.

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
**Last Revision**: 2026-07-04 (Session 51)
