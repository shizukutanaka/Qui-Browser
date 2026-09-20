# How to Contribute

Thank you for your interest in contributing to Qui Browser VR!

## 🚀 Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR-USERNAME/qui-browser-vr.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature`

## 📝 Development Process

### Code Style
- Use 2 spaces for indentation
- Follow ESLint rules
- Run `npm run format` before committing

### Testing
- Write tests for new features
- Ensure all tests pass: `npm test`
- Maintain >80% code coverage

### Commit Messages
Follow conventional commits:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test changes
- `chore:` Build/tool changes

## 🔄 Pull Request Process

1. Update documentation if needed
2. Ensure all tests pass
3. Update CHANGELOG.md
4. Submit PR with clear description
5. Wait for review

## 🏗️ Project Structure

### Key Directories
- `assets/js/unified-*.js` - Core unified systems (DO NOT duplicate functionality)
- `assets/js/vr-*.js` - VR-specific modules
- `tests/` - Test files
- `dist/` - Build output (auto-generated)

### Important Files
- `index-optimized.html` - Main entry point
- `webpack.config.js` - Build configuration
- `tsconfig.json` - TypeScript configuration

## ⚡ Performance Guidelines

- Target 90 FPS for Quest 3, 72 FPS minimum
- Keep bundle size under 2MB
- Use dynamic imports for non-critical modules
- Profile performance with Chrome DevTools

## 🔒 Security Requirements

- Never store sensitive data in localStorage
- Use Web Crypto API for encryption
- Implement proper CSP headers
- Sanitize all user inputs

## 🧪 Testing Requirements

### Unit Tests
```bash
npm test
```

### Performance Tests
```bash
npm run benchmark
```


## 📚 Documentation

Update relevant documentation:
- README.md for major features
- CHANGELOG.md for all changes
- Code comments for complex logic

## ❓ Questions?

Open an issue for:
- Bug reports
- Feature requests
- Questions about the codebase

## Code of Conduct

This project adheres to the Contributor Covenant Code of Conduct. By participating in this project you agree to abide by its terms. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for details.

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.