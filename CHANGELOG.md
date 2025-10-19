# Changelog

All notable changes to Qui Browser VR will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned for v2.1.0
- AI-driven content recommendations
- Multiplayer browsing (shared sessions)
- Cloud sync (bookmarks, history, settings)
- Extended gesture library
- VR keyboard improvements (predictive input)

### Planned for v2.2.0
- WebGPU support (advanced rendering)
- Extension system
- Custom theme editor
- Advanced spatial audio (Dolby Atmos)
- Avatar system

---

## [2.0.0] - 2025-10-19

### Added

**UI/UX Optimization (5 modules, 3,260 lines)**
- Research-based text rendering (1.33°-3.45° visual angle calculations)
- Ergonomic UI positioning (comfortable viewing zones: ±30° horizontal, ±15° vertical)
- Comfort system (motion sickness prevention, vignette, teleportation, 90 FPS maintenance)
- Multi-modal input optimizer (gaze with 1s dwell, hand tracking, controller, hybrid mode)
- Accessibility system (WCAG AAA compliant, Japanese voice commands, color blindness filters)

**Advanced Features (4 modules, 2,700 lines)**
- Environment customizer (6 presets: space, forest, ocean, minimal, sunset, cyberpunk)
- Gesture macro system (12 gesture patterns, recording/playback functionality)
- Content optimizer (360° video up to 4K, 360° images up to 8K, adaptive bitrate)
- Performance profiler (real-time FPS/CPU/GPU/memory monitoring, bottleneck detection)

**3D Visualization (3 modules, 1,634 lines)**
- 3D bookmarks (4 layouts: grid, sphere, wall, carousel)
- 3D tab manager (max 10 tabs, 4 layouts: arc, stack, grid, cylinder)
- Spatial audio (3D HRTF positional audio, 10 UI sound effects)

**Interaction Systems (4 modules, 2,037 lines)**
- WebXR hand tracking (25 joints per hand, gesture recognition)
- Gesture-based scrolling (3 modes: grab, swipe, point)
- VR keyboard (3 layouts: QWERTY, URL shortcuts, numeric)
- VR navigation (URL bar, history, bookmarks, tab switching)

**Media Handling (1 module, 600 lines)**
- 360°/180° video player with spatial audio integration

**Core Features (4 modules, 1,315 lines)**
- VR launcher (WebXR session management)
- Performance monitor (real-time FPS display)
- Settings manager (6 categories, persistent storage)
- Utility functions (notifications, storage, performance measurement)

**Documentation (6 files, 6,000+ lines)**
- Complete API reference (1,100+ lines)
- Usage guide in Japanese (900+ lines)
- Deployment guide (600+ lines)
- Contribution guidelines (600+ lines)
- Code of conduct (200+ lines)
- Comprehensive README

**Examples & Configuration**
- Basic VR setup demo (interactive 3D scene)
- Advanced features demo (all 35+ modules integrated)
- Performance configuration files (low-spec and high-spec)
- Example README with setup instructions

**CI/CD & Testing**
- GitHub Actions workflows (deploy and test)
- Jest testing framework with 350+ lines of tests
- Automated deployment to GitHub Pages
- Module existence and syntax validation
- Documentation verification

**Deployment Infrastructure**
- Netlify configuration (complete with plugins)
- Vercel configuration (edge network deployment)
- Docker support (multi-stage build, Nginx optimization)
- Docker Compose (orchestration with health checks)
- Production-grade Nginx configuration

**Community**
- Contribution guidelines (Japanese)
- Code of Conduct (Contributor Covenant 2.1)
- Issue templates for bugs and features
- Pull request template

### Changed
- Switched from server-side to pure client-side VR browser
- Optimized for WebXR VR devices (Meta Quest, Pico)
- Removed all server dependencies
- Focused on VR browsing experience only

### Fixed
- Initial VR browser implementation
- WebXR compatibility issues
- Service Worker caching strategies
- Performance optimization for VR devices

### Performance
- Target: 90 FPS optimal, 72 FPS minimum
- Frame time: 11.1ms target
- Memory limit: 2GB
- Resolution scaling: 70-120%
- Gzip/Brotli compression enabled

### Security
- Content Security Policy (CSP)
- HTTPS enforcement (HSTS)
- X-Frame-Options (DENY/SAMEORIGIN)
- X-Content-Type-Options (nosniff)
- Permissions-Policy for WebXR
- No hardcoded secrets
- Attack pattern blocking

### Removed
- All server-side functionality (lib/ directory, 40+ modules)
- Server startup scripts
- Node.js backend
- Database dependencies
- API endpoints
- Authentication system (moved to client-side)

---

## [1.0.0] - 2024-XX-XX

### Added
- Initial server-based browser implementation
- Basic VR support
- Server-side rendering

### Deprecated
- Server-side architecture (replaced by pure client-side in v2.0.0)

---

## Version History Summary

| Version | Date | Description | Files | Lines of Code |
|---------|------|-------------|-------|---------------|
| 2.0.0 | 2025-10-19 | Complete VR browser rewrite | 65+ | ~31,000 |
| 1.0.0 | 2024-XX-XX | Initial server-based version | ~100 | ~10,000 |

---

## Migration Guides

### Migrating from v1.x to v2.0

**Breaking Changes:**
- Server-side functionality completely removed
- All features are now client-side
- WebXR API required for VR functionality
- HTTPS required (except localhost)

**Steps:**
1. Remove all server dependencies
2. Deploy as static site
3. Ensure HTTPS is enabled
4. Update to WebXR-compatible browser
5. Test on VR device

**New Features Available:**
- 35+ VR modules
- Research-based UI/UX optimization
- Comprehensive accessibility (WCAG AAA)
- Multi-platform deployment
- Performance profiling tools

---

## Links

- [Repository](https://github.com/yourusername/qui-browser-vr)
- [Documentation](https://github.com/yourusername/qui-browser-vr/tree/main/docs)
- [Issues](https://github.com/yourusername/qui-browser-vr/issues)
- [Releases](https://github.com/yourusername/qui-browser-vr/releases)

---

## Contributors

Thank you to all contributors who have helped make Qui Browser VR possible!

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute.

---

**Legend:**
- `Added` - New features
- `Changed` - Changes in existing functionality
- `Deprecated` - Soon-to-be removed features
- `Removed` - Removed features
- `Fixed` - Bug fixes
- `Security` - Security improvements
- `Performance` - Performance improvements
