# Qui Browser VR — Usage Guide

How to operate the VR browser once you're in an immersive session. Qui Browser
is built around **accessibility equity**: every status change is announced
across multiple channels (caption + haptic + toast) so it's perceivable
whether you rely on sight, sound, or touch.

Version 2.0.0.

---

## Entering VR

From the landing page, tap **Enter VR**. On a PWA install (standalone display
mode) the session can auto-start shortly after launch; otherwise use the
button. A "VR Ready" caption confirms the session started.

## Input methods

You can drive every UI element with any of these — pick whichever suits you:

- **Controller ray** — point and pull the trigger to select.
- **Hand tracking** — pinch to select; point/grab/open/fist/peace/thumbs-up
  gestures are recognized. Pinch uses hysteresis so a slightly unsteady hand
  doesn't chatter between select/release.
- **Gaze-dwell (hands-free)** — enable **Gaze Select** in settings, then rest
  your gaze on a target. A reticle fills as the dwell timer charges and
  activates the element — the same action a controller trigger performs. A
  **grace time** forgives brief involuntary gaze slips (tremor/nystagmus).

## Locomotion

- **Teleport** — hold the grip (squeeze) to aim a marker on the floor, release
  to jump there.
- **Snap turn** — flick the turn thumbstick to rotate in fixed steps.
- **Smooth move** (opt-in) — the move thumbstick glides you continuously; a
  speed-proportional comfort vignette narrows your field of view in step with
  how fast you're actually moving, to reduce motion sickness.

## Accessibility features

- **Captions** — an in-VR caption panel mirrors every status message, voice
  transcript, and page title. Adjustable hold time (2–60 s), text scale
  (0.5–3×), and vertical height.
- **Cross-modal feedback** — errors and state changes fire a caption, a haptic
  pulse on both hands, and a visual toast at once. Severity is shown by glyph
  (✕ / ⚠ / ℹ), not colour alone.
- **High Contrast** — switches panels to solid-black backing, full-opacity
  reticle, and higher-contrast text (WCAG 1.4.11). Also follows the OS
  `prefers-contrast` / forced-colors signal, live — toggling it in the
  headset's system Quick Settings mid-session takes effect immediately.
- **Reduced motion** — follows the OS `prefers-reduced-motion` signal, live.
  Snap-turn animation becomes an instant orientation change; the gaze reticle
  uses a static highlight instead of an animated pulse.
- **Japanese IME** — the VR keyboard converts romaji to hiragana/katakana/kanji
  with proper syllabic-ん handling and candidate selection.
- **Voice commands** — enable Voice in settings. Say a command (e.g. navigate,
  back, search, top sites, "go to <site>", or "help" to hear the phrase list).
  Recognized speech is captioned; confirmations are spoken and captioned.

## The settings panel

Open the settings panel to live-tune 20+ preferences — all persisted across
reloads (localStorage):

- **Locomotion**: Teleport, Snap Turn, Snap Angle, Smooth Move, Move Speed,
  Southpaw (swap hands).
- **Accessibility**: High Contrast, Captions (+ Caption Hold / Size / Height),
  Gaze Select (+ Gaze Time / Grace Time).
- **Rendering / comfort**: Comfort preset, Foveation (FFR).
- **Browsing**: **Web Browser Panel** (see below), Follow View, Curved panel,
  Search engine.

Most toggles apply instantly. Hovering a setting announces it as a caption for
gaze users.

## Web browsing panel (opt-in)

The in-VR web browsing surface — URL bar, tabs, bookmarks/history, WebXR Layers
for sharp text, grab-to-move windows — is gated behind the **Web Browser
Panel** setting, which is **off by default**. Turn it on in the settings panel;
because these subsystems are constructed once at load, the panel announces that
a **page reload is required** for the change to take effect. After reloading
with it enabled you get:

- **URL bar** — tap to open the VR keyboard; frecency-ranked suggestions from
  your history/bookmarks appear as you type, so you can jump to a known
  destination in a couple of characters. Blocked/unsupported addresses (e.g.
  `javascript:`, `ftp://`) surface a "cannot open that address" status message.
- **Tabs** — a tab strip lets you open (up to 8), switch, and close tabs.
- **Bookmarks & history** — a scrollable panel; the chrome-bar ★ toggles a
  bookmark for the current page.
- **Grab-to-move** — a move bar below each panel lets you reposition it; grab
  and release are confirmed cross-modally.

> Note: pages are shown in a reader view — the text is fetched, extracted and
> laid out in VR, not rendered as authored. A WebXR web app cannot composite a
> cross-origin page's pixels into a 3D texture; this is a platform limitation,
> documented honestly rather than hidden. Sites that do not send CORS headers
> need the optional companion proxy (see `docs/PROXY.md`); the viewport says so
> when it hits one.

## Recentering

Use the recenter action (the welcome panel doubles as a recenter button) to
bring the world back in front of you if your play space has drifted.

---

For the full feature/status map see **[SPEC.md](SPEC.md)**; for setup and
deployment see **[QUICK_START.md](QUICK_START.md)** and **[SETUP.md](SETUP.md)**.
Licensed under the MIT License — see [LICENSE](../LICENSE).
