# Architecture

System design of Qui Browser VR — a WebXR VR browser for Meta Quest 2/3 and Pico 4,
built on Three.js with an accessibility-first interaction model.

## High-level view

```
index.html
   └── src/main.js          # bootstrap: feature detect → mount app
        └── src/app.js      # 2D landing / launcher, i18n, monitoring hookup
             └── src/vr/VRApp.js
                            # the VR session controller (renderer, XR loop,
                            # subsystem init, settings panel, interactable registry)
```

`VRApp` owns the `THREE.WebGLRenderer`, the XR session, the animation loop, and a
registry of *interactables*. Every subsystem below is constructed by `VRApp` and
communicates back through callbacks (`onSelect`, `onHover`, `onHoverEnd`,
`onHoverCaption`, `onError`), never by reaching into `VRApp` internals. That is why
most subsystems are unit-testable in Node with no GPU context.

## Module map (`src/`)

| Directory | Responsibility |
|---|---|
| `vr/rendering/` | `FFRSystem` (fixed foveated rendering), `LayersSystem` (WebXR quad layers for sharp text) |
| `vr/browser/` | `WebPanel`, `WindowManager`, `TabManager`, `BookmarkPanel`, `urlDisplay`, `urlResolver`, `newTabPage`, plus pure layout helpers (`curvedGeometry`, `readableText`, `readerLayout`, `bookmarkLayout`, `panelGeometry`, `chromeColors`) |
| `vr/input/` | `VRControllerInput`, `JapaneseIME` (in-VR kana/kanji keyboard), `VoiceCommands`, `keyboardLayout` |
| `vr/interaction/` | `GazeInteraction` (dwell selection with grace time), `HandTracking`, `HapticFeedback` |
| `vr/accessibility/` | `CaptionSystem`, `SemanticDOM` (ARIA mirror of VR state), `crossModal` (`notifyCrossModal`), `AccessibilityCoordinator` |
| `vr/audio/` | `SpatialAudio` — procedurally synthesized UI cues, positional audio |
| `vr/comfort/` | `ComfortSystem` — motion-activated vignette for vestibular comfort |
| `vr/media/` | `ImmersiveVideo`, `videoProjection` (equirect / 180 / 360 mapping) |
| `dev/` | `DevTools` — floating console/scene/network inspector |
| `vr/ui/` | `canvasTexture`, `buttonStyle`, `textWrap`, `settingsStepper` — pure canvas/text primitives |
| `utils/` | `TextureManager`, `ProgressiveLoader`, `PerformanceMonitor`, `DeviceCompatibility`, `BookmarkStore`, `debounce` |
| `i18n/` | `i18n.js` — `CATALOG` (en/ja), `t()`, `setLanguage()`, `detectLanguage()` |
| `a11y/`, `monitoring.js` | DOM-side accessibility helpers and production telemetry |

## Design rules

1. **Pure core, thin shell.** Geometry, layout, text wrapping, URL resolution and
   dwell-timing logic are pure functions with no Three.js/DOM dependency, so they are
   covered by fast Node tests. Only the shell touches WebGL.
2. **Cross-modal by default.** Every status or error is routed through
   `notifyCrossModal()` → haptic pulse + caption line + visual toast, with severity
   carried by glyphs (`✕ ⚠ ℹ`) rather than colour alone (WCAG 1.4.1, 4.1.3).
3. **Optional subsystems must degrade.** FFR, quad layers, hand tracking, haptics
   and spatial audio are all capability-detected; failure emits a warning toast and
   the session continues.
4. **Everything tunable is tunable at runtime.** Caption hold/scale, dwell time, grace
   time, snap-turn angle, window distance and 15+ other parameters are live steppers in
   the settings panel and persist to `localStorage`.

## Rendering pipeline

1. `setupRenderer()` creates the WebGL renderer, enables `xr`, and attaches the
   `VRButton`.
2. On session start, `FFRSystem` applies a foveation level and `LayersSystem` promotes
   text-heavy panels to quad layers when the runtime supports them.
3. The XR frame loop: poll input sources → hit-test the interactable registry →
   dispatch hover/select → update captions and comfort vignette → render.
4. `PerformanceMonitor` samples frame timing and `TextureManager` keeps per-frame
   allocation near zero to hold 72–90 fps on standalone headsets.

## Build & bundling

Vite (`vite.config.js`) produces manual chunks for cache granularity:
`vendor-three`, `app`, `tier1` (FFR, comfort, textures), and `tier2-*`
(`tier2-input`, `tier2-interaction`, `tier2-audio`, `tier2-loading`). All chunks
are eagerly imported at boot — the tier2 split affects cache lifetime, not
load laziness; the only real lazy boundary is `import('./app.js')` in main.js.
See [BUILD_OPTIMIZATION_GUIDE.md](BUILD_OPTIMIZATION_GUIDE.md).

## Related documents

- [SPEC.md](SPEC.md) — functional requirements (FR-*)
- [IMPLEMENTATION.md](IMPLEMENTATION.md) — implementation notes per subsystem
- [TESTING.md](TESTING.md) — test strategy
- [OUTSTANDING_ISSUES.md](OUTSTANDING_ISSUES.md) — known gaps
