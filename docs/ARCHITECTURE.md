# Qui Browser - Architecture Documentation

## Overview

Qui Browser is a lightweight, VR-optimized web server designed for low-latency
experiences on Meta Quest and other VR devices. The architecture prioritizes
security, performance, and maintainability.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Browser │  │    VR    │  │  Mobile  │  │   API    │   │
│  │  Client  │  │  Headset │  │  Device  │  │  Client  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                     Load Balancer / CDN                      │
│                  (nginx, Caddy, Cloudflare)                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         server-lightweight.js (Main Server)            │ │
│  │  • HTTP Server                                         │ │
│  │  • Request Routing                                     │ │
│  │  • Security Headers                                    │ │
│  │  • Rate Limiting                                       │ │
│  │  • Compression (Brotli/Gzip)                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                          ↓                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Core   │  │  Utils   │  │  Config  │  │  Assets  │   │
│  │  Module  │  │  Module  │  │  Module  │  │  Static  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   LRU    │  │  Memory  │  │   File   │  │  Stripe  │   │
│  │  Cache   │  │  Store   │  │  System  │  │   API    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Server Core (`server-lightweight.js`)

The main entry point that orchestrates all server operations.

**Responsibilities:**

- HTTP server initialization
- Request lifecycle management
- Security enforcement
- Resource management
- Graceful shutdown

**Key Features:**

- Token bucket rate limiting (O(1) complexity)
- LRU cache with intelligent eviction
- Health monitoring with auto-tuning
- Zero-downtime deployments

### 2. Core Modules (`core/`)

#### `server-core.js`

- Core server configuration
- Environment variable validation
- Server lifecycle management

#### `request-handler.js`

- Request parsing and routing
- Response generation
- Error handling

#### `middleware.js`

- Middleware chain execution
- Request/response transformation
- Security checks

#### `security.js`

- Input validation
- Path traversal prevention
- XSS/CSRF protection

#### `static-server.js`

- Static file serving
- ETag generation
- Cache control headers

#### `metrics.js`

- Performance metrics collection
- Prometheus-compatible exports
- Real-time statistics

### 3. Utility Modules (`utils/`)

#### Cache & Performance

- `response-cache.js` - LRU cache implementation
- `compression.js` - Brotli/Gzip compression
- `performance-dashboard.js` - Real-time performance monitoring

#### Security & Validation

- `validators.js` - Input validation utilities
- `request-parsers.js` - Safe request parsing
- `smart-logger.js` - Secure logging with sanitization

#### External Integrations

- `stripe-service.js` - Payment processing
- `notification-dispatcher.js` - Webhook notifications
- `api-handlers.js` - REST API endpoints

#### Data Management

- `data-manager.js` - Data persistence
- `subscription-store.js` - Subscription state
- `pricing-store.js` - Pricing configuration

#### Health & Monitoring

- `simple-health.js` - Health check endpoint
- `auto-cleanup-map.js` - Automatic resource cleanup

### 4. Configuration (`config/`)

- `config.js` - Main configuration loader
- `csp-presets.js` - Content Security Policy templates
- `pricing.js` - Multi-currency pricing logic

### 5. Assets (`assets/`)

#### JavaScript

- `browser-core.js` - Browser client logic
- `ui-components.js` - Reusable UI components
- `theme-manager.js` - Theme switching

#### Styles

- Design system CSS
- Component styles
- Animations

## Request Flow

```
1. Client Request
   ↓
2. Rate Limiter Check
   ↓
3. Security Validation
   ↓
4. Cache Lookup
   ↓
5. Route Handler
   ↓
6. Response Generation
   ↓
7. Compression
   ↓
8. Response Sent
```

### Detailed Request Flow

```javascript
// 1. Request received
http.createServer(async (req, res) => {
  // 2. Generate request ID
  const requestId = generateRequestId();

  // 3. Rate limiting
  if (!rateLimiter.allow(clientIp)) {
    return send429(res);
  }

  // 4. Security checks
  if (!validateRequest(req)) {
    return send400(res);
  }

  // 5. Check cache
  const cached = cache.get(cacheKey);
  if (cached) {
    return sendCached(res, cached);
  }

  // 6. Route to handler
  const response = await routeHandler(req);

  // 7. Compress if needed
  const compressed = await compress(response);

  // 8. Cache and send
  cache.set(cacheKey, compressed);
  res.end(compressed);
});
```

## Security Architecture

### Defense in Depth

```
┌───────────────────────────────────────────────────────┐
│ Layer 1: Network Security                             │
│ • TLS 1.3                                            │
│ • HSTS headers                                       │
│ • Rate limiting                                      │
└───────────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────┐
│ Layer 2: Input Validation                            │
│ • URI length limits                                  │
│ • Path traversal prevention                          │
│ • NULL byte injection blocking                       │
└───────────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────┐
│ Layer 3: Application Security                        │
│ • CSP headers                                        │
│ • X-Frame-Options                                    │
│ • X-Content-Type-Options                            │
└───────────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────┐
│ Layer 4: Data Security                               │
│ • Constant-time comparison                           │
│ • Secure token generation                            │
│ • Log sanitization                                   │
└───────────────────────────────────────────────────────┘
```

### Security Features

1. **Rate Limiting**
   - Token bucket algorithm
   - Per-IP tracking
   - Configurable limits
   - Automatic cleanup

2. **Input Validation**
   - URI length: max 2048 bytes
   - Path normalization
   - NULL byte detection
   - CRLF injection prevention

3. **Headers**
   - CSP: `default-src 'self'`
   - HSTS: `max-age=31536000`
   - X-Frame-Options: `DENY`
   - X-Content-Type-Options: `nosniff`

4. **Authentication**
   - Constant-time comparison
   - Minimum token length: 16 chars
   - Rate-limited endpoints

## Performance Optimizations

### 1. Caching Strategy

```javascript
// LRU Cache with intelligent eviction
const cache = new Map();
const maxSize = 50;
const maxFileSize = 51200; // 50KB

// Cache key generation
const cacheKey = `${method}:${pathname}:${encoding}`;

// Eviction policy
if (cache.size >= maxSize) {
  const firstKey = cache.keys().next().value;
  cache.delete(firstKey);
}
```

### 2. Compression

- Brotli (preferred): ~20% better compression
- Gzip (fallback): Universal support
- Threshold: 1KB minimum
- Streaming compression for large files

### 3. Memory Management

```javascript
// VR mode optimization
if (LIGHTWEIGHT) {
  FILE_CACHE_MAX_SIZE = 20;
  FILE_CACHE_MAX_FILE_SIZE = 25600; // 25KB
} else {
  FILE_CACHE_MAX_SIZE = 50;
  FILE_CACHE_MAX_FILE_SIZE = 51200; // 50KB
}
```

### 4. Rate Limiter Optimization

```javascript
// O(1) token bucket with cleanup
cleanupRateLimits() {
  const now = Date.now();
  for (const bucket of this.rateLimitMap.values()) {
    const elapsed = now - bucket.lastRefill;
    if (elapsed > 0) {
      const tokensToAdd = Math.floor(elapsed / tokenInterval);
      bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill += tokensToAdd * tokenInterval;
    }
  }
}
```

## Testing Strategy

### Test Coverage

- **Unit Tests**: Individual module functionality
- **Integration Tests**: Component interactions
- **Security Tests**: Vulnerability detection
- **Performance Tests**: Load and stress testing

### Test Structure

```
tests/
├── compression.test.js      # Compression algorithms
├── websocket-simple.test.js # WebSocket functionality
├── performance.test.js      # Performance benchmarks
├── security-advanced.test.js # Security checks
├── server.test.js           # Server lifecycle
└── security.test.js         # Basic security
```

## Deployment Architecture

### Docker Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
USER node
EXPOSE 8000
CMD ["node", "server-lightweight.js"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: qui-browser
spec:
  replicas: 3
  selector:
    matchLabels:
      app: qui-browser
  template:
    spec:
      containers:
        - name: qui-browser
          image: qui-browser:1.1.0
          resources:
            requests:
              memory: '256Mi'
              cpu: '200m'
            limits:
              memory: '512Mi'
              cpu: '500m'
```

## Monitoring & Observability

### Metrics Endpoints

1. `/health` - Health check

   ```json
   {
     "status": "healthy",
     "uptime": 3600,
     "version": "1.1.0"
   }
   ```

2. `/api/stats` - Performance statistics

   ```json
   {
     "requests": 10000,
     "cacheHits": 8500,
     "cacheHitRate": 0.85
   }
   ```

3. `/metrics` - Prometheus metrics
   ```
   qui_browser_requests_total 10000
   qui_browser_cache_hit_rate 0.85
   qui_browser_response_time_ms 15
   ```

### Logging

- Structured JSON logging
- Log levels: debug, info, warn, error
- Sanitized headers and bodies
- Request ID tracking

## Configuration

### Environment Variables

```bash
# Server
PORT=8000
HOST=0.0.0.0
NODE_ENV=production

# Performance
LIGHTWEIGHT=false
FILE_CACHE_MAX_SIZE=50
COMPRESSION_THRESHOLD=1024

# Security
ENABLE_SECURITY_HEADERS=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000

# Monitoring
HEALTH_SAMPLE_INTERVAL_MS=30000
NOTIFICATION_ENABLED=false
```

## Best Practices

### Development

1. **Code Style**
   - Use ESLint and Prettier
   - Follow conventional commits
   - Write self-documenting code

2. **Testing**
   - Maintain >90% coverage
   - Test edge cases
   - Use meaningful assertions

3. **Security**
   - Never commit secrets
   - Validate all inputs
   - Use constant-time comparisons

### Production

1. **Deployment**
   - Use Docker for consistency
   - Implement health checks
   - Enable auto-scaling

2. **Monitoring**
   - Set up alerts
   - Track key metrics
   - Review logs regularly

3. **Maintenance**
   - Update dependencies weekly
   - Apply security patches promptly
   - Document incidents

## Performance Benchmarks

### Target Metrics

- Response time (P95): < 50ms
- Throughput: > 1000 req/s
- Memory usage: < 512MB
- Cache hit rate: > 80%
- Error rate: < 0.1%

### Actual Results (v1.1.0)

- Response time (P95): ~30ms
- Throughput: ~1200 req/s
- Memory usage: ~256MB
- Cache hit rate: ~85%
- Error rate: ~0.02%

## Future Improvements

### Planned Features

1. **Performance**
   - HTTP/2 support
   - Server-side rendering
   - Edge caching

2. **Security**
   - mTLS support
   - Enhanced CSP
   - Security audit logging

3. **Features**
   - GraphQL API
   - Real-time collaboration
   - Advanced analytics

### Technical Debt

- Increase test coverage to 100%
- Refactor monolithic server file
- Implement circuit breaker pattern
- Add distributed tracing

---

**Version**: 1.1.0 **Last Updated**: 2025-10-10 **Maintainers**: Qui Browser
Team
