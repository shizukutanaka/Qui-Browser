# API Examples

Comprehensive examples for using Qui Browser utilities and APIs.

## Table of Contents

- [Endpoint Rate Limiter](#endpoint-rate-limiter)
- [Smart Cache](#smart-cache)
- [Advanced Monitoring](#advanced-monitoring)
- [Request Logger](#request-logger)
- [Complete Integration Example](#complete-integration-example)

## Endpoint Rate Limiter

The `EndpointRateLimiter` provides granular rate limiting per API endpoint with
pattern matching.

### Basic Usage

```javascript
const EndpointRateLimiter = require('./utils/endpoint-rate-limiter');

// Create rate limiter with default settings
const rateLimiter = new EndpointRateLimiter({
  defaultWindow: 60000, // 1 minute window
  defaultMaxRequests: 100 // 100 requests per window
});

// Check if request is allowed
const result = rateLimiter.checkLimit('/api/users', '192.168.1.100');

if (result.allowed) {
  console.log(`Request allowed. ${result.remaining} requests remaining.`);
  // Process request
} else {
  console.log(`Rate limit exceeded. Retry after ${result.retryAfter}ms`);
  // Return 429 Too Many Requests
}
```

### Per-Endpoint Configuration

```javascript
// Configure specific limits for sensitive endpoints
rateLimiter.setEndpointConfig('/api/auth/login', {
  window: 300000, // 5 minutes
  maxRequests: 3, // Only 3 login attempts
  message: 'Too many login attempts. Please try again later.'
});

rateLimiter.setEndpointConfig('/api/search', {
  window: 10000, // 10 seconds
  maxRequests: 10 // 10 searches per 10 seconds
});

// Pattern matching
rateLimiter.setEndpointConfig('/api/admin/*', {
  window: 60000,
  maxRequests: 50 // Stricter limit for admin endpoints
});
```

### Express Middleware

```javascript
const express = require('express');
const app = express();

// Use as middleware
app.use(rateLimiter.middleware());

// Or apply to specific routes
app.post('/api/auth/login', rateLimiter.middleware(), (req, res) => {
  // Login logic
});
```

### Statistics and Monitoring

```javascript
// Get rate limiting statistics
const stats = rateLimiter.getStats();
console.log(`Total requests: ${stats.total}`);
console.log(`Allowed: ${stats.allowed}`);
console.log(`Blocked: ${stats.blocked}`);
console.log(`Rate: ${((stats.allowed / stats.total) * 100).toFixed(2)}%`);

// Get per-endpoint statistics
const endpointStats = rateLimiter.getEndpointStats('/api/users');
console.log(`Requests: ${endpointStats.requestCount}`);
console.log(`Unique clients: ${endpointStats.uniqueClients}`);
```

## Smart Cache

The `SmartCache` provides intelligent caching with multiple eviction strategies.

### Basic Usage

```javascript
const SmartCache = require('./utils/smart-cache');

// Create cache with LRU strategy
const cache = new SmartCache({
  maxSize: 1000, // Maximum 1000 entries
  strategy: 'lru', // Least Recently Used
  defaultTTL: 300000 // 5 minutes TTL
});

// Store data
cache.set('user:123', {
  id: 123,
  name: 'John Doe',
  email: 'john@example.com'
});

// Retrieve data
const user = cache.get('user:123');
if (user) {
  console.log('Cache hit:', user);
} else {
  console.log('Cache miss - fetch from database');
}
```

### Eviction Strategies

```javascript
// LRU (Least Recently Used)
const lruCache = new SmartCache({
  maxSize: 100,
  strategy: 'lru'
});

// LFU (Least Frequently Used)
const lfuCache = new SmartCache({
  maxSize: 100,
  strategy: 'lfu'
});

// TTL (Time To Live) - evict expired entries first
const ttlCache = new SmartCache({
  maxSize: 100,
  strategy: 'ttl',
  defaultTTL: 60000 // 1 minute
});

// Adaptive - switch between LRU and LFU based on access patterns
const adaptiveCache = new SmartCache({
  maxSize: 100,
  strategy: 'adaptive'
});
```

### Custom TTL per Entry

```javascript
// Set with custom TTL
cache.set('session:abc123', sessionData, {
  ttl: 1800000 // 30 minutes
});

// Set without expiration
cache.set('config:app', configData, {
  ttl: null // Never expires (until evicted)
});
```

### Batch Operations

```javascript
// Set multiple entries
cache.setMany([
  ['key1', 'value1'],
  ['key2', 'value2'],
  ['key3', 'value3']
]);

// Get multiple entries
const values = cache.getMany(['key1', 'key2', 'key3']);
console.log(values); // ['value1', 'value2', 'value3']

// Delete multiple entries
cache.deleteMany(['key1', 'key2']);
```

### Cache Statistics

```javascript
const stats = cache.getStats();
console.log(`Hits: ${stats.hits}`);
console.log(`Misses: ${stats.misses}`);
console.log(
  `Hit rate: ${((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2)}%`
);
console.log(`Evictions: ${stats.evictions}`);
console.log(`Current size: ${cache.size()}`);
```

## Advanced Monitoring

The `AdvancedMonitoring` provides comprehensive metrics, traces, and alerts.

### Basic Metrics

```javascript
const AdvancedMonitoring = require('./utils/advanced-monitoring');

const monitoring = new AdvancedMonitoring({
  metricsRetention: 3600000, // 1 hour
  enableTracing: true,
  enableProfiling: true
});

// Counter - monotonically increasing
monitoring.incrementCounter('api_requests_total', 1);
monitoring.incrementCounter('errors_total', 1, {
  type: 'validation',
  endpoint: '/api/users'
});

// Gauge - value that can go up and down
monitoring.setGauge('active_connections', 42);
monitoring.setGauge('cache_size_bytes', 1024 * 1024);

// Histogram - statistical distribution of values
monitoring.recordHistogram('request_duration_ms', 145.3);
monitoring.recordHistogram('response_size_bytes', 2048);

// Timeseries - values over time
monitoring.recordTimeseries('cpu_usage', 0.65);
monitoring.recordTimeseries('memory_usage', 0.78);
```

### Distributed Tracing

```javascript
// Start a trace
const traceId = monitoring.startTrace('api_request', {
  method: 'GET',
  path: '/api/users/123',
  userId: '123'
});

try {
  // Your business logic here
  const user = await fetchUser(123);

  // End trace successfully
  monitoring.endTrace(traceId, {
    statusCode: 200,
    responseSize: JSON.stringify(user).length
  });
} catch (error) {
  // End trace with error
  monitoring.endTrace(traceId, {
    error: error.message,
    statusCode: 500
  });
}
```

### Automatic Alerting

```javascript
// Set custom thresholds
monitoring.setThreshold('error_rate', {
  warning: 0.02, // 2% error rate
  critical: 0.05 // 5% error rate
});

monitoring.setThreshold('response_time_p95', {
  warning: 200, // 200ms
  critical: 500 // 500ms
});

// Listen for alerts
monitoring.on('alert', alert => {
  console.error(`[${alert.severity}] ${alert.name}: ${alert.message}`);

  // Send to external alerting system
  if (alert.severity === 'critical') {
    sendToSlack(alert);
    sendToPagerDuty(alert);
  }
});
```

### Export Metrics

```javascript
// Prometheus format
const prometheusMetrics = monitoring.exportPrometheus();
console.log(prometheusMetrics);

// JSON format
const metrics = monitoring.getMetrics();
console.log(JSON.stringify(metrics, null, 2));

// Get recent traces
const traces = monitoring.getTraces(50); // Last 50 traces
traces.forEach(trace => {
  console.log(`${trace.name}: ${trace.duration}ms`);
});
```

## Request Logger

The `RequestLogger` provides structured logging with sensitive data redaction.

### Basic Usage

```javascript
const RequestLogger = require('./utils/request-logger');

const logger = new RequestLogger({
  maxLogs: 10000, // Keep last 10,000 logs
  sensitiveFields: [
    // Fields to redact
    'password',
    'token',
    'apiKey',
    'creditCard'
  ]
});

// Log a request
logger.addLog({
  method: 'POST',
  url: '/api/users',
  ip: '192.168.1.100',
  status: 201,
  responseTime: 145.3,
  userAgent: 'Mozilla/5.0...',
  headers: {
    'content-type': 'application/json',
    authorization: 'Bearer abc123...' // Will be redacted
  },
  body: {
    username: 'john_doe',
    password: 'secret123', // Will be redacted
    email: 'john@example.com'
  }
});
```

### Filtering Logs

```javascript
// Filter by method
const postRequests = logger.getLogs({ method: 'POST' });

// Filter by status code
const errors = logger.getLogs({ status: 500 });

// Filter by path
const apiLogs = logger.getLogs({ path: '/api' });

// Filter by minimum duration
const slowRequests = logger.getLogs({ minDuration: 1000 }); // > 1 second

// Combined filters
const slowErrors = logger.getLogs({
  status: 500,
  minDuration: 500,
  limit: 100
});
```

### Export and Analysis

```javascript
// Export all logs
const allLogs = logger.getLogs();
fs.writeFileSync('logs.json', JSON.stringify(allLogs, null, 2));

// Get statistics
const stats = logger.getStats();
console.log(`Total requests: ${stats.totalRequests}`);
console.log(`Average response time: ${stats.avgResponseTime}ms`);
console.log(`Error rate: ${(stats.errorRate * 100).toFixed(2)}%`);

// By method
console.log('Requests by method:', stats.byMethod);
// { GET: 1500, POST: 300, PUT: 100, DELETE: 50 }

// By status code
console.log('Responses by status:', stats.byStatus);
// { 200: 1800, 201: 100, 400: 30, 404: 15, 500: 5 }
```

## Complete Integration Example

Here's a complete example showing how to use all utilities together:

```javascript
const express = require('express');
const EndpointRateLimiter = require('./utils/endpoint-rate-limiter');
const SmartCache = require('./utils/smart-cache');
const AdvancedMonitoring = require('./utils/advanced-monitoring');
const RequestLogger = require('./utils/request-logger');

const app = express();

// Initialize utilities
const rateLimiter = new EndpointRateLimiter({
  defaultWindow: 60000,
  defaultMaxRequests: 100
});

const cache = new SmartCache({
  maxSize: 1000,
  strategy: 'adaptive',
  defaultTTL: 300000
});

const monitoring = new AdvancedMonitoring();
const logger = new RequestLogger({ maxLogs: 10000 });

// Configure rate limits
rateLimiter.setEndpointConfig('/api/auth/*', {
  window: 300000,
  maxRequests: 5
});

// Middleware: Start trace
app.use((req, res, next) => {
  req.traceId = monitoring.startTrace('http_request', {
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  req.startTime = Date.now();
  next();
});

// Middleware: Rate limiting
app.use(rateLimiter.middleware());

// API endpoint with caching
app.get('/api/users/:id', async (req, res) => {
  const userId = req.params.id;
  const cacheKey = `user:${userId}`;

  // Check cache
  let user = cache.get(cacheKey);

  if (user) {
    monitoring.incrementCounter('cache_hits', 1);
    monitoring.recordHistogram(
      'request_duration_ms',
      Date.now() - req.startTime
    );

    return res.json(user);
  }

  // Cache miss
  monitoring.incrementCounter('cache_misses', 1);

  try {
    // Fetch from database
    user = await database.getUser(userId);

    if (!user) {
      monitoring.incrementCounter('errors_total', 1, { type: 'not_found' });
      return res.status(404).json({ error: 'User not found' });
    }

    // Store in cache
    cache.set(cacheKey, user, { ttl: 300000 }); // 5 minutes

    monitoring.incrementCounter('requests_success', 1);
    res.json(user);
  } catch (error) {
    monitoring.incrementCounter('errors_total', 1, { type: 'database' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware: Logging and trace completion
app.use((req, res, next) => {
  const responseTime = Date.now() - req.startTime;

  // Record metrics
  monitoring.recordHistogram('request_duration_ms', responseTime);
  monitoring.setGauge('active_requests', --activeRequestCount);

  // End trace
  monitoring.endTrace(req.traceId, {
    statusCode: res.statusCode,
    responseTime
  });

  // Log request
  logger.addLog({
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    status: res.statusCode,
    responseTime,
    userAgent: req.get('user-agent'),
    headers: req.headers
  });

  next();
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const metrics = monitoring.getMetrics();
  const cacheStats = cache.getStats();
  const rateLimitStats = rateLimiter.getStats();
  const logStats = logger.getStats();

  res.json({
    monitoring: metrics,
    cache: cacheStats,
    rateLimit: rateLimitStats,
    logging: logStats
  });
});

// Prometheus metrics endpoint
app.get('/metrics/prometheus', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(monitoring.exportPrometheus());
});

// Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Monitor alerts
  monitoring.on('alert', alert => {
    console.error(`[ALERT] ${alert.severity}: ${alert.message}`);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');

  // Cleanup
  rateLimiter.destroy();
  cache.destroy();
  monitoring.destroy();

  process.exit(0);
});
```

## Best Practices

### 1. Rate Limiting

- Set stricter limits for authentication endpoints
- Use pattern matching for endpoint groups
- Monitor rate limit statistics to adjust limits
- Provide clear error messages to clients

### 2. Caching

- Choose the right eviction strategy for your use case
- Set appropriate TTLs based on data freshness requirements
- Monitor cache hit rates and adjust size accordingly
- Clear cache when underlying data changes

### 3. Monitoring

- Use counters for event counts
- Use gauges for current values
- Use histograms for distributions
- Set appropriate alert thresholds
- Enable tracing for debugging complex issues

### 4. Logging

- Configure sensitive fields to protect user data
- Use filtering to analyze specific issues
- Export logs regularly for long-term storage
- Monitor error rates and response times

### 5. Integration

- Initialize utilities at application startup
- Use middleware for consistent monitoring
- Cleanup resources on shutdown
- Monitor metrics endpoints for operational insights
- Set up alerting for critical thresholds

## Performance Considerations

### Memory Usage

```javascript
// Limit cache size based on available memory
const maxMemoryMB = 100;
const avgEntrySizeBytes = 1024;
const maxEntries = (maxMemoryMB * 1024 * 1024) / avgEntrySizeBytes;

const cache = new SmartCache({
  maxSize: maxEntries,
  strategy: 'lru'
});
```

### Sampling for High-Traffic Endpoints

```javascript
// Sample 10% of requests for detailed logging
app.use((req, res, next) => {
  if (Math.random() < 0.1) {
    req.shouldLog = true;
  }
  next();
});

app.use((req, res, next) => {
  if (req.shouldLog) {
    logger.addLog(/* ... */);
  }
  next();
});
```

### Cleanup Intervals

```javascript
// Adjust cleanup frequency based on load
const cache = new SmartCache({
  maxSize: 1000,
  cleanupInterval: 60000 // 1 minute for low-traffic
  // cleanupInterval: 5000, // 5 seconds for high-traffic
});
```

## Troubleshooting

### High Memory Usage

- Reduce cache size
- Decrease metrics retention period
- Increase cleanup frequency
- Enable sampling for logging

### Poor Cache Hit Rate

- Increase cache size
- Adjust TTL values
- Change eviction strategy
- Analyze access patterns

### Rate Limit False Positives

- Increase window size
- Increase request limit
- Use IP whitelisting for trusted clients
- Implement user-based rate limiting

### Missing Metrics

- Check metric names (case-sensitive)
- Verify monitoring is initialized
- Check metrics retention period
- Ensure traces are being ended

## Additional Resources

- [Architecture Documentation](ARCHITECTURE.md)
- [API Reference](API.md)
- [Performance Guide](PERFORMANCE.md)
- [Production Checklist](PRODUCTION-CHECKLIST.md)
- [Migration Guide](MIGRATION-GUIDE.md)
