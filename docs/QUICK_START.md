# Qui Browser VR — Quick Start

Get the WebXR VR browser running locally, or open the hosted build on your
headset. Version 2.0.0.

---

## Requirements

- **Node.js** 20+ and npm (for local development / building)
- **A WebXR headset browser**: Meta Quest 2/3/Pro (Meta Quest Browser),
  Pico 4, or any WebXR-compatible browser
- **HTTPS** — WebXR only runs over a secure context. `localhost` counts as
  secure; to reach a dev server from a headset on your LAN, front it with an
  HTTPS tunnel (e.g. `ngrok http 5173`).

## Try it online

Open the hosted build on your headset browser:

- **GitHub Pages**: https://shizukutanaka.github.io/Qui-Browser/

Tap **Enter VR** on the landing page to start an immersive session.

## Run locally

```bash
git clone https://github.com/shizukutanaka/qui-browser.git
cd qui-browser
npm install
npm run dev          # Vite dev server on http://localhost:5173
```

Open `http://localhost:5173` in a WebXR browser. On a headset, expose the dev
server over HTTPS first (WebXR requires it):

```bash
npx ngrok http 5173  # then open the https://… URL on the headset
```

## Production build

```bash
npm run build        # outputs the static site to dist/
npm run preview      # serve the built dist/ on http://localhost:8080
```

The build is base-path aware: it defaults to root (`/`). To build for a
subpath deployment (e.g. GitHub Pages under `/Qui-Browser/`):

```bash
BASE_PATH=/Qui-Browser/ npm run build
```

## Verify

```bash
npm test             # full Jest suite
npm run lint         # ESLint (0 errors expected)
```

## Next steps

- **[Usage Guide](USAGE_GUIDE.md)** — in-VR controls, gaze-dwell, captions,
  comfort, and the settings panel
- **[Setup](SETUP.md)** — deeper environment/deployment notes
- **[Specification](SPEC.md)** — the FR/NFR feature map and status
- **[API Reference](API.md)** — module-level reference

---

Licensed under the MIT License — see [LICENSE](../LICENSE).
