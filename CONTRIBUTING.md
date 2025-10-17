# Contributing to Qui Browser

First off, thank you for considering contributing to Qui Browser! It's people
like you that make Qui Browser such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our Code of
Conduct. By participating, you are expected to uphold this code. Please report
unacceptable behavior to the project maintainers.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find
out that you don't need to create one. When you are creating a bug report,
please include as many details as possible:

- **Use a clear and descriptive title** for the issue to identify the problem.
- **Describe the exact steps which reproduce the problem** in as many details as
  possible.
- **Provide specific examples to demonstrate the steps**.
- **Describe the behavior you observed after following the steps** and point out
  what exactly is the problem with that behavior.
- **Explain which behavior you expected to see instead and why.**
- **Include screenshots and animated GIFs** if possible.
- **Include your environment details**: Node.js version, OS, etc.

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an
enhancement suggestion, please include:

- **Use a clear and descriptive title** for the issue to identify the
  suggestion.
- **Provide a step-by-step description of the suggested enhancement** in as many
  details as possible.
- **Provide specific examples to demonstrate the steps** or provide code
  examples.
- **Describe the current behavior** and **explain which behavior you expected to
  see instead**.
- **Explain why this enhancement would be useful** to most Qui Browser users.

### Pull Requests

- Fill in the required template
- Do not include issue numbers in the PR title
- Follow the JavaScript styleguide
- Include thoughtfully-worded, well-structured tests
- Document new code
- End all files with a newline

## Development Process

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Setup

```bash
# Fork and clone the repository
git clone https://github.com/your-username/qui-browser.git
cd qui-browser

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Run tests
npm test
```

### Development Workflow

1. **Create a branch** from `main`:

   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Make your changes** following our coding standards

3. **Write or update tests** for your changes

4. **Run the test suite**:

   ```bash
   npm test
   npm run lint
   npm run format:check
   ```

5. **Commit your changes** using clear commit messages:

   ```bash
   git commit -m "feat: add amazing new feature"
   ```

6. **Push to your fork**:

   ```bash
   git push origin feature/my-new-feature
   ```

7. **Open a Pull Request**

### Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/)
specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that don't affect code meaning (formatting, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Changes to build process or auxiliary tools

**Examples:**

```
feat(cache): add LRU cache auto-tuning
fix(security): prevent path traversal in static file serving
docs(readme): update installation instructions
perf(compression): optimize brotli compression level
```

## Styleguides

### JavaScript Styleguide

We use ESLint and Prettier to maintain code quality:

```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors
npm run lint:fix

# Check code formatting
npm run format:check

# Auto-format code
npm run format
```

**Key principles:**

- Use `const` by default, `let` when necessary, never `var`
- Use strict equality (`===`) instead of loose equality (`==`)
- Prefer async/await over callbacks
- Use descriptive variable names
- Add JSDoc comments for functions
- Keep functions small and focused
- Handle errors explicitly

### Documentation Styleguide

- Use Markdown for documentation
- Reference code with backticks: \`code\`
- Use fenced code blocks with language identifiers
- Keep line length under 80 characters for readability
- Update documentation when changing behavior

### Testing Guidelines

- Write tests for all new features
- Maintain or increase code coverage
- Use descriptive test names
- Follow the AAA pattern: Arrange, Act, Assert
- Mock external dependencies

```javascript
// Good test example
test('rate limiter blocks requests after limit', async () => {
  // Arrange
  const limiter = new RateLimiter({ max: 3, window: 1000 });
  const clientIP = '192.168.1.1';

  // Act
  limiter.check(clientIP);
  limiter.check(clientIP);
  limiter.check(clientIP);
  const result = limiter.check(clientIP);

  // Assert
  assert.strictEqual(result.allowed, false);
});
```

## Project Structure

```
qui-browser/
├── assets/              # Frontend assets
├── config/              # Configuration files
├── core/                # Core server modules
├── docs/                # Documentation (13 languages)
├── k8s/                 # Kubernetes manifests
├── scripts/             # Utility scripts
├── tests/               # Test files
├── types/               # TypeScript definitions
└── utils/               # Utility modules
```

## Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:security
npm run test:performance
npm run test:compression

# Run tests with coverage
npm run test:coverage
```

## Security

- **Never commit secrets** or credentials
- Use environment variables for sensitive data
- Follow OWASP security best practices
- Report security vulnerabilities privately to maintainers

## Performance

- Profile code before optimizing
- Use benchmarks to validate improvements
- Consider memory usage in VR environments
- Optimize for latency over throughput

## Documentation

- Update docs for all user-facing changes
- Keep README.md up to date
- Document breaking changes clearly
- Add examples for new features

## Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create release tag
4. GitHub Actions will build and publish

## Getting Help

- Check existing documentation
- Search existing issues
- Join our community discussions
- Ask questions in issues (label: question)

## Recognition

Contributors will be recognized in:

- CHANGELOG.md
- Release notes
- Contributors page

## License

By contributing, you agree that your contributions will be licensed under the
MIT License.

---

Thank you for contributing to Qui Browser! 🚀
