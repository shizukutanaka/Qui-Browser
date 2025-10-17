# Migration Guide - Qui Browser v1.1.0

This guide helps you upgrade to Qui Browser v1.1.0 and integrate the new
features introduced in iterations 11-13.

## 🆕 What's New

### Iteration 11: Error Handling & Testing

- Custom error classes
- Integration test suite
- Code coverage reporting
- HTML performance optimization

### Iteration 12: Infrastructure & Observability

- Endpoint-specific rate limiting
- Advanced monitoring with metrics/traces/alerts
- Smart caching with multiple strategies
- Request logger with data sanitization

### Iteration 13: Validation & Benchmarking

- Comprehensive unit tests (30 new tests)
- Performance benchmarks
- Production deployment checklist

## 📦 Installation

### From Previous Version

```bash
# Backup your data
npm run backup:create

# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Run tests
npm test

# Start server
npm start
```

### Fresh Installation

```bash
# Clone repository
git clone https://github.com/qui-browser/qui-browser.git
cd qui-browser

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure environment variables
nano .env

# Run tests
npm test

# Start server
npm start
```

## 🔄 Breaking Changes

### None

Version 1.1.0 is **fully backward compatible** with v1.0.0. All new features are
opt-in.

## ⚙️ Feature Migration

### 1. Custom Error Classes

**Before:**

```javascript
// Generic errors
throw new Error('Authentication failed');

// Response
res.status(401).json({ error: 'Authentication failed' });
```

**After:**

```javascript
const { AuthenticationError } = require('./utils/custom-errors');

// Throw specific error
throw new AuthenticationError('Invalid token', {
  token: 'Bearer xxx...',
  reason: 'expired'
});

// Catch and handle
try {
  await authenticateUser(req);
} catch (error) {
  if (error instanceof AuthenticationError) {
    return res.status(error.statusCode).json(error.toJSON());
  }
  throw error;
}
```

**Benefits:**

- Type-safe error handling
- Consistent error response format
- Better debugging with stack traces
- Easier error monitoring

### 2. Endpoint Rate Limiting

**Before:**

```javascript
// Global rate limiting only
const globalRateLimit = rateLimit({
  windowMs: 60000,
  max: 100
});

app.use(globalRateLimit);
```

**After:**

```javascript
const EndpointRateLimiter = require('./utils/endpoint-rate-limiter');

const rateLimiter = new EndpointRateLimiter({
  defaultWindow: 60000,
  defaultMaxRequests: 100
});

// Configure specific endpoints
rateLimiter.setEndpointConfig('/api/auth/login', {
  window: 300000, // 5 minutes
  maxRequests: 3, // 3 attempts
  message: 'Too many login attempts'
});

rateLimiter.setEndpointConfig('/api/billing/*', {
  window: 300000,
  maxRequests: 5
});

// Apply middleware
app.use(rateLimiter.middleware());
```

**Benefits:**

- Granular control per endpoint
- Pattern matching support
- Better protection for sensitive endpoints
- Detailed statistics per endpoint

### 3. Advanced Monitoring

**Before:**

```javascript
// Basic logging
console.log('Request processed');

// Manual metrics
let requestCount = 0;
requestCount++;
```

**After:**

```javascript
const AdvancedMonitoring = require('./utils/advanced-monitoring');

const monitoring = new AdvancedMonitoring({
  metricsRetention: 3600000,
  alertThresholds: {
    error_rate: { warning: 0.01, critical: 0.05 },
    response_time_p95: { warning: 100, critical: 500 }
  }
});

// Record metrics
monitoring.incrementCounter('http_requests_total', 1, {
  method: req.method,
  status: res.statusCode
});

monitoring.recordHistogram('response_time', duration, {
  endpoint: req.path
});

// Distributed tracing
const trace = monitoring.startTrace(requestId, {
  method: req.method,
  path: req.path
});
monitoring.addSpan(trace, 'database_query', 12.3);
monitoring.endTrace(trace);

// Listen to alerts
monitoring.on('alert', alert => {
  if (alert.severity === 'critical') {
    sendPagerDutyAlert(alert);
  }
});

// Export to Prometheus
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(monitoring.exportPrometheus());
});
```

**Benefits:**

- Comprehensive observability
- Automatic alerting
- Prometheus integration
- Distributed tracing

### 4. Smart Caching

**Before:**

```javascript
// Simple Map-based cache
const cache = new Map();

function get(key) {
  return cache.get(key);
}

function set(key, value) {
  cache.set(key, value);
}
```

**After:**

```javascript
const SmartCache = require('./utils/smart-cache');

const cache = new SmartCache({
  maxSize: 1000,
  maxMemory: 50 * 1024 * 1024, // 50MB
  strategy: 'adaptive', // or 'lru', 'lfu', 'ttl'
  defaultTTL: 3600000 // 1 hour
});

// Set with TTL
cache.set('session:123', sessionData, {
  ttl: 1800000, // 30 minutes
  size: 2048 // 2KB
});

// Get value
const data = cache.get('session:123');

// Monitor performance
const stats = cache.getStats();
console.log(`Hit rate: ${stats.hitRate * 100}%`);

// Automatic eviction based on strategy
// Automatic TTL expiration
// Memory-based limits
```

**Benefits:**

- Multiple eviction strategies
- TTL support per item
- Memory-based limits
- Automatic cleanup
- Performance statistics

### 5. Request Logger

**Before:**

```javascript
// Basic logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
```

**After:**

```javascript
const RequestLogger = require('./utils/request-logger');

const logger = new RequestLogger({
  logHeaders: true,
  logBody: false, // Be careful with PII
  logQuery: true,
  maxBodyLength: 1000,
  sensitiveHeaders: ['authorization', 'cookie'],
  sensitiveFields: ['password', 'creditCard'],
  shouldLog: req => !req.path.startsWith('/assets')
});

app.use(logger.middleware());

// Query logs
const errors = logger.getLogs({
  errorsOnly: true,
  limit: 50
});

const slowRequests = logger.getLogs({
  minDuration: 1000,
  limit: 20
});

// Get statistics
const stats = logger.getStats();
console.log(`Error rate: ${stats.errorRate * 100}%`);

// Export logs
const json = logger.export({ errorsOnly: true });
fs.writeFileSync('errors.json', json);
```

**Benefits:**

- Sensitive data redaction
- Filtering and search
- Statistics and analytics
- Export capabilities
- Unique request IDs

## 📊 Performance Considerations

### Before Migration

Run benchmarks to establish baseline:

```bash
npm run benchmark
```

### After Migration

1. **Enable Monitoring**:

```javascript
const monitoring = new AdvancedMonitoring();
// Monitor for 24 hours
```

2. **Configure Cache**:

```javascript
const cache = new SmartCache({
  maxSize: 1000, // Start conservative
  strategy: 'adaptive'
});

// Monitor hit rate
setInterval(() => {
  const stats = cache.getStats();
  if (stats.hitRate < 0.7) {
    console.warn('Low cache hit rate:', stats.hitRate);
  }
}, 60000);
```

3. **Optimize Rate Limits**:

```javascript
// Start strict, loosen based on metrics
rateLimiter.setEndpointConfig('/api/users', {
  window: 60000,
  maxRequests: 50 // Adjust based on traffic
});

// Monitor block rate
const stats = rateLimiter.getStats();
if (stats.blockRate > 0.05) {
  console.warn('High block rate:', stats.blockRate);
}
```

## 🧪 Testing Migration

### Test New Features

```bash
# Run all tests
npm test

# Run new utility tests
npm run test:utilities

# Run integration tests
npm run test:integration

# Generate coverage report
npm run coverage:report

# Run benchmarks
npm run benchmark:utilities
```

### Gradual Rollout

1. **Enable in Development**:

```bash
NODE_ENV=development npm start
```

2. **Deploy to Staging**:

```bash
kubectl apply -f k8s/staging/
```

3. **Monitor for Issues**:

```bash
kubectl logs -f deployment/qui-browser -n staging
```

4. **Canary Deployment** (10% traffic):

```bash
kubectl set image deployment/qui-browser \
  qui-browser=qui-browser:v1.1.0 \
  --record
```

5. **Full Rollout** (if successful):

```bash
kubectl scale deployment/qui-browser --replicas=3
```

## 🔧 Configuration Examples

### Complete Setup

```javascript
const express = require('express');
const EndpointRateLimiter = require('./utils/endpoint-rate-limiter');
const AdvancedMonitoring = require('./utils/advanced-monitoring');
const SmartCache = require('./utils/smart-cache');
const RequestLogger = require('./utils/request-logger');

const app = express();

// Initialize components
const rateLimiter = new EndpointRateLimiter({
  defaultWindow: 60000,
  defaultMaxRequests: 100
});

const monitoring = new AdvancedMonitoring({
  metricsRetention: 3600000,
  enableTracing: true
});

const cache = new SmartCache({
  maxSize: 1000,
  strategy: 'adaptive'
});

const logger = new RequestLogger({
  logHeaders: true,
  logQuery: true
});

// Apply middlewares
app.use(logger.middleware());
app.use(rateLimiter.middleware());

// Track requests
app.use((req, res, next) => {
  const trace = monitoring.startTrace(req.requestId, {
    method: req.method,
    path: req.path
  });

  req.trace = trace;

  res.on('finish', () => {
    monitoring.endTrace(trace);
    monitoring.incrementCounter('http_requests_total', 1, {
      method: req.method,
      status: res.statusCode
    });
  });

  next();
});

// Endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    monitoring: monitoring.getMetrics(),
    cache: cache.getStats(),
    rateLimiter: rateLimiter.getStats()
  });
});

app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(monitoring.exportPrometheus());
});

app.listen(3000);
```

## 🐛 Troubleshooting

### High Memory Usage

**Symptom**: Memory usage increasing over time

**Solution**:

```javascript
// Adjust cache limits
const cache = new SmartCache({
  maxSize: 500, // Reduce size
  maxMemory: 25 * 1024 * 1024, // 25MB
  cleanupInterval: 30000 // Cleanup more frequently
});

// Monitor memory
monitoring.setThreshold('memory_usage', {
  warning: 0.7,
  critical: 0.85
});
```

### Rate Limiting Too Strict

**Symptom**: Many legitimate requests being blocked

**Solution**:

```javascript
// Increase limits
rateLimiter.setEndpointConfig('/api/users', {
  window: 60000,
  maxRequests: 200 // Doubled
});

// Review block statistics
const stats = rateLimiter.getStats();
console.log('Blocked:', stats.blocked, 'Total:', stats.requests);
```

### Monitoring Overhead

**Symptom**: High CPU usage from monitoring

**Solution**:

```javascript
// Reduce retention
const monitoring = new AdvancedMonitoring({
  metricsRetention: 1800000, // 30 minutes instead of 1 hour
  enableTracing: false // Disable if not needed
});

// Cleanup old traces
setInterval(() => {
  monitoring.traces = monitoring.traces.slice(-1000);
}, 60000);
```

## 📚 Additional Resources

- [Production Checklist](./PRODUCTION-CHECKLIST.md)
- [API Documentation](./API.md)
- [Architecture Guide](./ARCHITECTURE.md)
- [Performance Guide](./PERFORMANCE.md)
- [Security Policy](../SECURITY.md)

## 💬 Support

- **Issues**: https://github.com/qui-browser/qui-browser/issues
- **Discussions**: https://github.com/qui-browser/qui-browser/discussions
- **Email**: support@qui-browser.example.com

---

**Migration Guide Version**: 1.0 **Target Version**: 1.1.0 **Last Updated**:
2025-10-10
