# FAQ

## General

**What is Qui Browser VR?**
A WebXR web browser you run inside a VR headset. It renders pages on curved panels in
3D space, and is built around accessibility: in-VR captions, gaze-dwell selection,
haptics, high-contrast and reduced-motion modes.

**Which headsets are supported?**
Meta Quest 2 / Quest 3 and Pico 4 are the primary targets. Any WebXR-capable browser
works; features are capability-detected and degrade individually when unsupported.

**Is it a full browser engine?**
No. It is a WebXR application built on Three.js that presents web content in VR —
it does not ship its own rendering engine.

## Installation & running

**How do I run it locally?**
```bash
npm install
npm run dev        # Vite dev server
npm run build      # production build to dist/
npm run preview    # serve the built output
```
See [QUICK_START.md](QUICK_START.md).

**Why does WebXR not start over `http://`?**
WebXR requires a secure context. Use `https://` or `localhost`. For headset testing on
your LAN, tunnel it (e.g. via a dev-server HTTPS cert) or use ADB port forwarding.

**Do I need the backend server?**
Only for billing. `npm run start:server` runs the Express app; without Stripe
credentials the billing routes deliberately answer `503` and everything else works.

## Accessibility

**Can I use it without controllers?**
Yes. Enable **Gaze Select** in settings: look at a target for the dwell duration
(500–3000 ms, adjustable) and it activates. Grace time (0–600 ms) forgives tremor and
nystagmus.

**Is the UI available in Japanese?**
Yes — the catalog in `src/i18n/i18n.js` carries `en` and `ja`, including VR status and
error messages. Language is auto-detected and can be switched at runtime.

**Does it respect OS accessibility settings?**
`prefers-reduced-motion` and `prefers-contrast` are read at startup; reduced motion
replaces the animated dwell pulse with a static highlight, and high contrast raises the
reticle to full opacity with solid caption backing (WCAG 1.4.11).

**I get motion sick. What should I change?**
Turn on snap turn, raise the comfort vignette strength, use teleport instead of smooth
locomotion, and increase window distance — all in the settings panel.

## Troubleshooting

**Text looks blurry.**
Your runtime may not support WebXR quad layers. Try increasing panel resolution, or
move panels closer. Foveated rendering level also trades edge sharpness for frames.

**Haptics / spatial audio do nothing.**
They are optional subsystems. If initialization fails you get a warning toast and the
session continues without them — usually a missing Gamepad or AudioContext permission.

**Frame rate drops in multi-window sessions.**
Close unused windows, lower the FFR level, and check the DevTools overlay
(`src/dev/DevTools.js`) for the per-frame budget.

**ESLint reports thousands of `linebreak-style` errors on Windows.**
Your checkout has CRLF endings. The repo pins LF via `.gitattributes`; run
`git add --renormalize .` or re-clone with `core.autocrlf=false`.

**Tests fail right after `npm install` on Windows.**
Optional native bindings (e.g. `@rollup/rollup-win32-x64-msvc`) can be skipped by npm.
Reinstall them explicitly, or delete `node_modules` and reinstall.

## Contributing

**How do I add a feature?**
Read [ARCHITECTURE.md](ARCHITECTURE.md) and [CONTRIBUTING.md](../CONTRIBUTING.md). Keep
logic in a pure module where possible, wire it into `VRApp` through callbacks, and add
both a logic test and an accessibility (caption + haptic) test — see
[TESTING.md](TESTING.md).

**Where are known gaps tracked?**
[OUTSTANDING_ISSUES.md](OUTSTANDING_ISSUES.md).
