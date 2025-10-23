# Qui Browser VR

A lightweight, optimized WebXR browser for VR devices with unified performance and security systems.

## 🚀 Features

- **VR-Optimized**: Built specifically for Meta Quest and Pico devices
- **High Performance**: 90 FPS target with dynamic quality adjustment
- **Unified Systems**: Integrated performance, security, error handling, and extension management
- **Progressive Loading**: Smart module loading for fast initialization
- **Enterprise Security**: Web Crypto API, CSP, and session management

## 📦 Installation

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Start development server
npm run dev
```

## 🏗️ Architecture

### Unified Systems

- **Performance**: `unified-performance-system.js` - FPS monitoring, dynamic optimization, WASM support
- **Security**: `unified-security-system.js` - Encryption, CSP, XSS protection, session management
- **Error Handling**: `unified-error-handler.js` - Auto-recovery, VR error support, detailed logging
- **VR Extensions**: `unified-vr-extension-system.js` - Plugin management, sandboxing, AI recommendations

### Project Structure

```
Qui Browser/
├── assets/
│   ├── js/
│   │   ├── unified-*.js      # Core unified systems
│   │   ├── vr-*.js          # VR-specific modules
│   │   └── *.js             # Core functionality
│   └── styles/
├── dist/                     # Production build
├── tests/                    # Test suites
├── index-optimized.html      # Optimized entry point
├── sw-optimized.js          # Service Worker
├── webpack.config.js        # Build configuration
└── tsconfig.json            # TypeScript configuration
```

## 🎮 VR Support

- Meta Quest 2/3/Pro
- Pico 4/Neo 3
- WebXR-compatible devices

## 📊 Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| FPS | 90 (Quest 3) | ✅ |
| Frame Time | 11.1ms | ✅ |
| Memory | <2GB | ✅ |
| Load Time | <3s | ✅ |

## 🔧 Development

```bash
# Run tests
npm test

# Check bundle size
npm run build:analyze

# Lint code
npm run lint

# Format code
npm run format
```

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📞 Support

For issues and questions, please use GitHub Issues.

---

**Version**: 3.2.0 | **Status**: Production Ready