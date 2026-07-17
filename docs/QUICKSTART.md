# Qui Browser VR — Quick Start

> This page previously documented a `QuiVRSDK` JavaScript SDK (CDN/npm package)
> that does not exist in this repository. Qui Browser is a **WebXR web app built
> with Vite**, not a distributable SDK, so that content was inaccurate and has
> been replaced with the real getting-started steps below.
>
> The canonical guides are **[QUICK_START.md](QUICK_START.md)** (setup/build)
> and **[USAGE_GUIDE.md](USAGE_GUIDE.md)** (in-VR controls). This page is a
> short pointer kept for existing links.

Version 2.0.0.

---

## Run it

```bash
git clone https://github.com/shizukutanaka/qui-browser.git
cd qui-browser
npm install
npm run dev          # Vite dev server on http://localhost:5173
```

Open `http://localhost:5173` in a WebXR browser (Meta Quest Browser, Pico 4,
or a WebXR-capable desktop browser) and tap **Enter VR**. WebXR requires a
secure context — `localhost` qualifies; to reach a dev server from a headset on
your LAN, front it with HTTPS (e.g. `npx ngrok http 5173`).

## Build

```bash
npm run build        # static site → dist/  (base '/')
npm run preview      # serve the build on http://localhost:8080
```

For a GitHub Pages subpath deployment:

```bash
BASE_PATH=/Qui-Browser/ npm run build
```

## Verify

```bash
npm test             # Jest suite
npm run lint         # ESLint (0 errors expected)
```

## Learn more

- **[QUICK_START.md](QUICK_START.md)** — full setup and build reference
- **[USAGE_GUIDE.md](USAGE_GUIDE.md)** — gaze-dwell, captions, comfort, the
  settings panel, and the opt-in web browsing panel
- **[SPEC.md](SPEC.md)** — feature/requirement status map
- **[PUBLISHING.md](PUBLISHING.md)** — releasing and deploying

Licensed under the MIT License — see [LICENSE](../LICENSE).
