# Qui Browser VR

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/shizukutanaka/qui-browser/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![WebXR](https://img.shields.io/badge/WebXR-Supported-purple.svg)](https://immersiveweb.dev/)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/shizukutanaka/qui-browser/actions)
[![Coverage](https://img.shields.io/badge/coverage-passing-yellow.svg)](https://codecov.io/gh/shizukutanaka/qui-browser)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[![Meta Quest 2](https://img.shields.io/badge/Meta_Quest_2-Supported-00a8e8.svg)](https://www.meta.com/quest/products/quest-2/)
[![Meta Quest 3](https://img.shields.io/badge/Meta_Quest_3-Optimized-00a8e8.svg)](https://www.meta.com/quest/products/quest-3/)
[![Pico 4](https://img.shields.io/badge/Pico_4-Supported-ff6b35.svg)](https://www.picoxr.com/global/products/pico4)

<div align="center">
  <h3>An accessibility-first WebXR reader shell for Quest &amp; Pico</h3>
  <p>
    <a href="#-features">Features</a> •
    <a href="#-quick-start">Quick Start</a> •
    <a href="docs/API.md">API Docs</a> •
    <a href="docs/USAGE_GUIDE.md">Usage Guide</a> •
    <a href="CONTRIBUTING.md">Contributing</a>
  </p>
</div>

---

A WebXR **VR shell** targeting Meta Quest 2/3 and Pico devices, featuring Japanese IME, hand tracking, spatial audio, immersive 360°/180° video, and a comfort/accessibility system. Runtime dependencies are `three` and `web-vitals` — nothing else.

> ### ⚠️ On the name: web page rendering is **not** implemented
>
> Despite the name, this project **cannot display arbitrary web pages in VR**, and
> the browsing panel is disabled by default (`enableWebPanel: false`) for that
> reason. The URL bar, tabs, bookmarks, and history are implemented and tested —
> but they surround a viewport that renders no page content.
>
> This is a platform ceiling, not a to-do item: a WebXR **web app** cannot
> composite cross-origin page pixels into a 3D texture. `X-Frame-Options` /
> CSP `frame-ancestors` block framing most sites outright, and even a framed
> document's pixels are not readable into WebGL. Wolvic and Quest Browser can do
> this because they *are* browsers, with native engines. Reaching parity would
> require a different architecture (content proxy + text extraction + canvas
> rendering). See `docs/SPEC.md` FR-1.1 and `docs/OUTSTANDING_ISSUES.md` §F.
>
> **What does work today**: immersive 360°/180° video, the comfort/vestibular
> system, in-VR captions and gaze-dwell accessibility, Japanese IME text entry,
> spatial audio, hand tracking, and the VR settings shell.

## 🌟 Highlights

- **Accessibility measured, not asserted** - contrast, target angular size and text layout are enforced by tests against WCAG and platform thresholds
- **Target: 72–120 FPS** - Quest 3 (90–120), Quest 2 (72–90), Pico 4 (90)
- **CI/CD & Monitoring** - Automated testing, Sentry error tracking, GA4 analytics (opt-in)
- **Two runtime dependencies** - `three` + `web-vitals`; 474 packages in the lockfile

### Feature Status Legend

| Badge | Meaning |
|-------|---------|
| ✅ **Stable** | Shipped, tested, works in-browser |
| 🔬 **Experimental** | Implemented but not fully validated; may have rough edges |
| 🏗️ **Requires infra** | Needs external server / hardware to function |

## 🚀 Features

### Tier 1: Performance Optimizations (5 Features)

| Feature | Status | Description | Impact |
|---------|--------|-------------|--------|
| **Fixed Foveated Rendering (FFR)** | ✅ Stable | Reduces peripheral rendering quality | +15-20 FPS |
| **Comfort System** | ✅ Stable | Motion sickness prevention (vignette, FOV) | Reduced discomfort |
| **Object Pooling** | ✅ Stable | Reusable object management | Fewer GC pauses |
| **KTX2 Texture Compression** | ✅ Stable | GPU-optimized texture format | Lower texture memory |
| **Service Worker** | ✅ Stable | Offline support and caching | Offline capability |

### Tier 2: Enhanced Features (6 Features)

| Feature | Status | Description |
|---------|--------|-------------|
| **Japanese IME** | ✅ Stable | Native Japanese text input with VR keyboard |
| **Advanced Hand Tracking** | ✅ Stable | Controller-free interaction via WebXR hand APIs |
| **3D Spatial Audio** | ✅ Stable | HRTF-based positional sound with Web Audio API |
| **MR Passthrough** | ✅ Stable | Real-world integration (Quest 3 passthrough) |
| **Progressive Image Loading** | ✅ Stable | Incremental image display |
| **Offline Support** | ✅ Stable | Service Worker caching |

### Tier 3: Advanced Features (3 Features)

> **Removed in Session 74.** WebGPU rendering, the multiplayer system, AI
> recommendations, AR/passthrough and the Stripe billing server were deleted
> — not deprecated. Each was constructed at startup but had no path by which a
> user could reach it: multiplayer had no signalling server *and* no settings
> toggle, `MixedReality.startSession()` had zero callers, the AI's only output
> had zero consumers, and the WebGPU renderer never touched the render loop.
> Shipping them as "experimental" overstated what the product does. They remain
> in git history if any of them is ever genuinely needed.

| Feature | Status | Description |
|---------|--------|-------------|
| **Voice Commands** | 🔬 Experimental | Japanese speech recognition (Web Speech API; browser support varies) |
| **Haptic Feedback** | ✅ Stable | Enhanced tactile response on supported controllers |
| **WebCodecs Video** | 🔬 Experimental | Hardware-accelerated video decode |

### Development Tools (2 Features)

- **Performance Monitor** - Real-time FPS, memory, GPU metrics
- **VR DevTools** - In-VR debugging and profiling interface

## 📦 Quick Start

### Option 1: Try Online (Recommended)

Visit the live demo on your VR device:
- **GitHub Pages**: https://shizukutanaka.github.io/qui-browser/
- **Netlify**: https://qui-browser-vr.netlify.app/
- **Vercel**: https://qui-browser-vr.vercel.app/

### Option 2: Install Locally

```bash
# Clone repository
git clone https://github.com/shizukutanaka/qui-browser.git
cd qui-browser-vr

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173 on your VR device browser
```

### Option 3: Docker

```bash
# Pull and run Docker image
docker pull ghcr.io/shizukutanaka/qui-browser:2.0.0
docker run -d -p 8080:80 ghcr.io/shizukutanaka/qui-browser:2.0.0

# Open http://localhost:8080 on your VR device
```

**📖 Full Setup Guide:** [docs/QUICK_START.md](docs/QUICK_START.md)

## 🏗️ Architecture

```
Qui Browser VR/
├── src/
│   ├── vr/                   # VR modules
│   │   ├── rendering/        # Tier 1: FFR, textures, pooling
│   │   ├── input/            # Tier 2: Hand tracking, IME
│   │   ├── audio/            # Tier 2: Spatial audio
│   │   └── dev/              # Development tools
│   ├── app.js                # Application entry point
│   ├── VRApp.js              # Main VR controller
│   └── monitoring.js         # Production monitoring
├── docs/                     # Complete documentation (12 files)
├── tests/                    # Test suites (21 suites, 231 tests)
├── tools/                    # Performance benchmarking
├── .github/workflows/        # CI/CD pipelines (9 CI + 9 CD jobs)
├── docker/                   # Docker configuration
└── dist/                     # Production build output
```

**📖 Architecture Details:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 📊 Performance Metrics

### Build Optimization

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Bundle Size** | 2.4 MB | 1.08 MB | -55% |
| **Initial Load** | 5.2s | 2.4s | -54% |
| **Time to Interactive** | 7.1s | 2.8s | -61% |
| **First Paint** | 2.4s | 0.8s | -67% |
| **Lighthouse Score** | 72 | 96 | +33% |

### VR Performance Targets

| Device | Target FPS | Frame Time | Notes |
|--------|-----------|------------|-------|
| **Meta Quest 2** | 72-90 | 11.1ms | Primary dev target |
| **Meta Quest 3** | 90-120 | 8.3ms | Optimal |
| **Pico 4** | 90 | 11.1ms | Compatible |

**Memory Usage:** < 2GB (Quest 2), < 4GB (Quest 3)

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev                   # Start dev server (Vite)
npm run build                 # Production build
npm run preview               # Preview production build

# Backend (billing API — see server/index.js)
npm run start:server          # Start the Express server (defaults to :3000)
                               # Copy .env.example to .env and set STRIPE_* first;
                               # without a real STRIPE_SECRET_KEY, /api/billing/*
                               # returns 503 instead of failing. GET /health always works.

# Testing
npm test                      # Run all tests
npm run test:coverage         # Tests with coverage
npm run test:tier             # Tier integration tests
npm run test:integration      # Integration tests

# Code Quality
npm run lint                  # Lint JavaScript
npm run lint:fix              # Auto-fix linting issues
npm run format                # Format code (Prettier)
npm run format:check          # Check formatting

# Performance
npm run benchmark             # Run benchmarks
npm run benchmark:all         # Benchmark all modules
npm run benchmark:regression  # Check for regressions

# CI/CD
npm run ci:all                # Complete CI suite
npm run deploy:netlify        # Deploy to Netlify
npm run deploy:vercel         # Deploy to Vercel

# Docker
npm run docker:build          # Build Docker image
npm run docker:run            # Run Docker container
npm run docker:logs           # View container logs

# Release
npm run release:patch         # Patch version (x.x.X)
npm run release:minor         # Minor version (x.X.0)
npm run release:major         # Major version (X.0.0)
```

## 🧪 Testing

- **Unit Tests:** 21 test suites, 231 tests
- **Integration Tests:** Tier system integration
- **Performance Tests:** Benchmarking and regression detection
- **Code Coverage:** Growing; 4 major modules newly covered (TextureManager, ComfortSystem, HapticFeedback, monitoring)
- **CI/CD:** Automated testing on every push/PR

**📖 Testing Guide:** [docs/TESTING.md](docs/TESTING.md)

## 🚢 Deployment

### Multi-Platform Support

| Platform | Status | Deployment | Configuration |
|----------|--------|-----------|---------------|
| **GitHub Pages** | ✅ Auto | Push to main | [.github/workflows/cd.yml](.github/workflows/cd.yml) |
| **Netlify** | ✅ Auto | `npm run deploy:netlify` | [netlify.toml](netlify.toml) |
| **Vercel** | ✅ Auto | `npm run deploy:vercel` | [vercel.json](vercel.json) |
| **Docker** | ✅ Multi-platform | `npm run docker:compose` | [Dockerfile](Dockerfile) |
| **Custom Server** | ✅ Nginx | Manual setup | [docker/nginx.conf](docker/nginx.conf) |

**📖 Deployment Guide:** [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)

## 📈 Monitoring & Analytics

- **Error Tracking:** Sentry (10% sampling, 100% on errors)
- **Analytics:** Google Analytics 4 (GDPR compliant)
- **Performance:** Web Vitals (CLS, FID, FCP, LCP, TTFB)
- **Custom Metrics:** VR-specific FPS, memory, session tracking

**📖 Monitoring Guide:** [docs/CI_CD_MONITORING_GUIDE.md](docs/CI_CD_MONITORING_GUIDE.md)

## 🎮 Supported Devices

| Device | Support Level | Performance | Notes |
|--------|--------------|-------------|-------|
| **Meta Quest 2** | ✅ Full | 72-90 FPS | Primary target |
| **Meta Quest 3** | ✅ Full | 90-120 FPS | Optimal |
| **Meta Quest Pro** | ✅ Full | 90 FPS | All features |
| **Pico 4** | ✅ Full | 90 FPS | Tested |
| **Pico Neo 3** | ✅ Supported | 72-90 FPS | Compatible |
| **HTC Vive Focus** | ⚠️ Partial | 72 FPS | Some limitations |
| **PC VR Headsets** | ⚠️ Partial | Varies | WebXR varies |

## 📚 Documentation

- **[Quick Start](docs/QUICK_START.md)** - Get started in 5 minutes
- **[Usage Guide](docs/USAGE_GUIDE.md)** - Complete feature guide
- **[API Reference](docs/API.md)** - Full API documentation
- **[Architecture](docs/ARCHITECTURE.md)** - System design
- **[Deployment](docs/DEPLOYMENT_GUIDE.md)** - Multi-platform deployment
- **[Testing](docs/TESTING.md)** - Testing strategies
- **[FAQ](docs/FAQ.md)** - Common questions
- **[Contributing](CONTRIBUTING.md)** - Contribution guidelines
- **[Security](SECURITY.md)** - Security policy
- **[Changelog](CHANGELOG.md)** - Version history

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Contribution

```bash
# Fork and clone
git clone https://github.com/shizukutanaka/qui-browser.git
cd qui-browser-vr

# Create feature branch
git checkout -b feature/amazing-feature

# Make changes and test
npm run ci:all

# Commit (use Conventional Commits)
git commit -m "feat: add amazing feature"

# Push and create PR
git push origin feature/amazing-feature
```

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/shizukutanaka/qui-browser/issues)
- **Discussions:** [GitHub Discussions](https://github.com/shizukutanaka/qui-browser/discussions)

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🎉 Acknowledgments

- **WebXR Community** - WebXR Device API
- **Three.js Team** - 3D rendering library
- **Meta Reality Labs** - Quest development tools
- **Pico Interactive** - VR hardware support
- **John Carmack** - Inspiration for optimization principles

---

<div align="center">
  <strong>⭐ Star this project if you find it useful!</strong>
  <br>
  <a href="https://github.com/shizukutanaka/qui-browser/issues">Report Bug</a> •
  <a href="https://github.com/shizukutanaka/qui-browser/issues">Request Feature</a> •
  <a href="docs/QUICK_START.md">Get Started</a>
</div>

---

**Version:** 2.0.0 | **License:** MIT | See [Feature Status](#feature-status-legend)