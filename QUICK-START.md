# Quick Start Guide

Get started with Qui Browser in 5 minutes.

## Installation

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Install

```bash
# Clone repository
git clone <repository-url>
cd qui-browser

# Install dependencies
npm install
```

## Run

### Development

```bash
# Start server
npm start

# Server will run on http://localhost:8000
```

### Production

```bash
# Set environment
export NODE_ENV=production
export PORT=8000

# Start server
npm start
```

## Test

```bash
# Run main test suite (62 tests, ~11s)
npm test

# Run all tests (108+ tests)
npm run test:all

# Run with coverage
npm run test:coverage
```

## Build

```bash
# Build (lint + format + test)
npm run build

# Build with checks
npm run build:check
```

## Common Commands

### Development

| Command          | Description  |
| ---------------- | ------------ |
| `npm start`      | Start server |
| `npm test`       | Run tests    |
| `npm run lint`   | Lint code    |
| `npm run format` | Format code  |

### Testing

| Command                    | Description       |
| -------------------------- | ----------------- |
| `npm test`                 | Main test suite   |
| `npm run test:all`         | All tests         |
| `npm run test:security`    | Security tests    |
| `npm run test:performance` | Performance tests |
| `npm run test:api`         | API tests         |

### Quality

| Command                 | Description           |
| ----------------------- | --------------------- |
| `npm run lint`          | Lint with ESLint      |
| `npm run format`        | Format with Prettier  |
| `npm audit`             | Check vulnerabilities |
| `npm run security:scan` | Full security scan    |

## Configuration

### Environment Variables

Create `.env` file:

```bash
# Server
NODE_ENV=production
PORT=8000

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000

# Caching
CACHE_SIZE=1000

# Logging
LOG_LEVEL=info
```

### Optional: Billing

```bash
# Stripe (optional)
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
BILLING_ADMIN_TOKEN=...
```

## Docker

### Build

```bash
npm run docker:build
```

### Run

```bash
npm run docker:run
```

### Manual

```bash
# Build
docker build -t qui-browser .

# Run
docker run -p 8000:8000 \
  -e NODE_ENV=production \
  -e PORT=8000 \
  qui-browser
```

## Kubernetes

```bash
# Deploy
kubectl apply -f k8s/

# Check status
kubectl get pods
kubectl get services

# View logs
kubectl logs -f deployment/qui-browser
```

## CLI Usage

```bash
# Install globally
npm install -g .

# Start server
qui-browser serve --port 8000

# Run with options
qui-browser serve \
  --port 8000 \
  --host 0.0.0.0 \
  --env production
```

## Verify Installation

### Check Health

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2025-10-10T...",
  "uptime": 123
}
```

### Check Stats

```bash
curl http://localhost:8000/api/stats
```

### Check Version

```bash
curl http://localhost:8000/api/version
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3000 npm start
```

### Permission Denied

```bash
# Use port > 1024
PORT=8000 npm start

# Or run with sudo (not recommended)
sudo PORT=80 npm start
```

### Module Not Found

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Tests Failing

```bash
# Clean and reinstall
npm run clean
npm install

# Run tests individually
npm run test:compression
npm run test:security
```

## Common Tasks

### Add New Feature

1. Create files in `core/` or `utils/`
2. Add tests in `tests/`
3. Update documentation
4. Run: `npm run build:check`

### Add New Test

1. Create `tests/feature.test.js`
2. Add to package.json scripts (if needed)
3. Run: `npm run test:all`

### Update Dependencies

```bash
# Check outdated
npm outdated

# Update all
npm update

# Update specific package
npm update package-name

# Check for vulnerabilities
npm audit
npm audit fix
```

### Generate Coverage Report

```bash
npm run test:coverage
```

### Run Benchmarks

```bash
# Standard benchmark
npm run benchmark

# Memory benchmark
npm run benchmark:memory

# Load benchmark
npm run benchmark:load

# Full benchmark
npm run benchmark:full

# Utility benchmarks
npm run benchmark:utilities
```

### Performance Profiling

```bash
# CPU profiling
npm run perf

# Heap profiling
npm run perf:heap
```

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/my-feature
```

### 2. Make Changes

```bash
# Edit files
# Add tests
# Update docs
```

### 3. Verify Changes

```bash
# Format code
npm run format

# Lint code
npm run lint

# Run tests
npm test

# Full check
npm run build:check
```

### 4. Commit Changes

```bash
git add .
git commit -m "feat: add my feature"
```

### 5. Push and Create PR

```bash
git push origin feature/my-feature
# Create pull request on GitHub
```

## Monitoring

### Health Check

```bash
# Basic health
curl http://localhost:8000/health

# Detailed stats
curl http://localhost:8000/api/stats

# Prometheus metrics
curl http://localhost:8000/metrics
```

### Log Levels

```bash
# Set log level
LOG_LEVEL=debug npm start

# Available levels: error, warn, info, debug
```

### Enable Tracing

```bash
# Enable distributed tracing
ENABLE_TRACING=true npm start
```

## Security

### Run Security Scan

```bash
# Full security scan
npm run security:scan

# Audit dependencies
npm audit

# Check vulnerabilities
npm run check:vulnerabilities
```

### Update Security

```bash
# Fix vulnerabilities
npm audit fix

# Force update
npm audit fix --force
```

## Production Checklist

Before deploying to production:

- [ ] Run `npm run build:check`
- [ ] Set `NODE_ENV=production`
- [ ] Configure environment variables
- [ ] Run security scan
- [ ] Set up monitoring
- [ ] Configure logging
- [ ] Test health endpoints
- [ ] Set up backup/recovery
- [ ] Review [PRODUCTION-CHECKLIST.md](docs/PRODUCTION-CHECKLIST.md)

## Getting Help

### Documentation

- [README.md](README.md) - Overview
- [PROJECT-SUMMARY.md](PROJECT-SUMMARY.md) - Complete summary
- [API.md](docs/API.md) - API reference
- [API-EXAMPLES.md](docs/API-EXAMPLES.md) - Usage examples
- [TESTING.md](docs/TESTING.md) - Testing guide
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Architecture

### Support

- **Issues:** Report bugs or request features
- **Discussions:** Ask questions
- **Contributing:** See [CONTRIBUTING.md](CONTRIBUTING.md)

## Next Steps

After getting started:

1. Read [ARCHITECTURE.md](docs/ARCHITECTURE.md) to understand the system
2. Review [API-EXAMPLES.md](docs/API-EXAMPLES.md) for usage patterns
3. Check [TESTING.md](docs/TESTING.md) for testing guidelines
4. See [PRODUCTION-CHECKLIST.md](docs/PRODUCTION-CHECKLIST.md) for deployment

## Quick Reference

### Essential Commands

```bash
npm start              # Start server
npm test               # Run tests
npm run lint           # Lint code
npm run format         # Format code
npm run build          # Build for production
npm run security:scan  # Security check
```

### Essential Files

```
server-lightweight.js  # Main server
config.js              # Configuration
.env                   # Environment variables
package.json           # Dependencies & scripts
```

### Essential URLs

```
http://localhost:8000/        # Homepage
http://localhost:8000/health  # Health check
http://localhost:8000/api/stats  # Statistics
```

## Tips

- Use `npm run build:check` before committing
- Keep `.env` file out of version control
- Run tests after every change
- Check logs for errors
- Monitor memory usage in production
- Use rate limiting for public APIs
- Enable caching for static content
- Set up proper logging in production

---

**Ready to build?** 🚀

Start with `npm start` and visit `http://localhost:8000`
