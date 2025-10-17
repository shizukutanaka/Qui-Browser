# Performance Optimization Guide

## Overview

This guide provides detailed performance optimization strategies for Qui
Browser, including caching, compression, memory management, and benchmarking.

## Performance Metrics

### Target Performance Goals

| Metric              | Target       | Current (v1.1.0) |
| ------------------- | ------------ | ---------------- |
| Response Time (P50) | < 20ms       | ~15ms            |
| Response Time (P95) | < 50ms       | ~30ms            |
| Response Time (P99) | < 100ms      | ~78ms            |
| Throughput          | > 1000 req/s | ~1200 req/s      |
| Memory Usage        | < 512MB      | ~256MB           |
| Cache Hit Rate      | > 80%        | ~85%             |
| CPU Usage           | < 70%        | ~45%             |

## Caching Strategy

### 1. LRU Cache Configuration

```javascript
// Optimal cache settings for different environments
const cacheConfig = {
  // Production (high traffic)
  production: {
    maxSize: 100,
    maxFileSize: 102400, // 100KB
    ttl: 3600000 // 1 hour
  },

  // VR Mode (resource constrained)
  vr: {
    maxSize: 20,
    maxFileSize: 25600, // 25KB
    ttl: 1800000 // 30 minutes
  },

  // Development
  development: {
    maxSize: 50,
    maxFileSize: 51200, // 50KB
    ttl: 300000 // 5 minutes
  }
};
```

### 2. Cache Key Strategy

```javascript
// Effective cache key generation
const cacheKey = `${method}:${pathname}:${encoding}:${etag}`;

// Example keys:
// "GET:/index.html:br:abc123"
// "GET:/api/stats:identity:xyz789"
```

### 3. Cache Auto-Tuning

The server automatically adjusts cache size based on hit rate:

```javascript
autoTune() {
  const hitRate = this.cacheHits / (this.cacheHits + this.cacheMisses);

  if (hitRate < 0.7 && this.maxSize < 200) {
    this.maxSize += 10; // Increase cache size
  } else if (hitRate > 0.95 && this.maxSize > 20) {
    this.maxSize -= 5; // Decrease cache size
  }
}
```

## Compression Optimization

### 1. Compression Algorithms

**Brotli** (preferred):

- ~20% better compression than gzip
- Higher CPU cost
- Best for static assets

**Gzip** (fallback):

- Universal browser support
- Lower CPU cost
- Good for dynamic content

### 2. Compression Thresholds

```javascript
const compressionConfig = {
  minSize: 1024, // 1KB - don't compress smaller files
  level: {
    brotli: 4, // Balance compression vs speed
    gzip: 6 // Default gzip level
  }
};
```

### 3. Content Type Filtering

```javascript
const COMPRESSIBLE_TYPES = [
  'text/html',
  'text/css',
  'text/javascript',
  'application/javascript',
  'application/json',
  'text/xml',
  'application/xml',
  'image/svg+xml'
];

// Don't compress:
// - Images (already compressed)
// - Videos (already compressed)
// - Binary files
```

## Memory Management

### 1. Memory Optimization for VR

```javascript
// VR mode uses minimal memory footprint
if (process.env.LIGHTWEIGHT === 'true') {
  FILE_CACHE_MAX_SIZE = 20;
  FILE_CACHE_MAX_FILE_SIZE = 25600; // 25KB
  RATE_LIMIT_MAX_ENTRIES = 100;
} else {
  FILE_CACHE_MAX_SIZE = 50;
  FILE_CACHE_MAX_FILE_SIZE = 51200; // 50KB
  RATE_LIMIT_MAX_ENTRIES = 1000;
}
```

### 2. Garbage Collection Tuning

```bash
# Start with exposed GC for manual tuning
node --expose-gc --max-old-space-size=512 server-lightweight.js

# Monitor memory usage
node --perf-basic-prof server-lightweight.js
```

### 3. Memory Leak Prevention

```javascript
// Automatic cleanup of rate limit entries
cleanupRateLimits() {
  const now = Date.now();
  for (const bucket of this.rateLimitMap.values()) {
    const elapsed = now - bucket.lastRefill;
    if (elapsed > 0) {
      const tokensToAdd = Math.floor(elapsed / this.tokenInterval);
      if (tokensToAdd > 0) {
        bucket.tokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
        bucket.lastRefill += tokensToAdd * this.tokenInterval;
      }
    }
  }
}
```

## Rate Limiting

### 1. Token Bucket Algorithm

```javascript
class RateLimiter {
  constructor(maxTokens = 100, tokenInterval = 600) {
    this.maxTokens = maxTokens;
    this.tokenInterval = tokenInterval; // ms per token
    this.rateLimitMap = new Map();
  }

  allow(clientIP) {
    let bucket = this.rateLimitMap.get(clientIP);

    if (!bucket) {
      bucket = {
        tokens: this.maxTokens,
        lastRefill: Date.now()
      };
      this.rateLimitMap.set(clientIP, bucket);
    }

    // Refill tokens based on elapsed time
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(elapsed / this.tokenInterval);

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    // Check if request is allowed
    if (bucket.tokens > 0) {
      bucket.tokens--;
      return true;
    }

    return false;
  }
}
```

### 2. Rate Limit Configuration

```bash
# Standard limits
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000  # 60 seconds

# Admin endpoints (stricter)
ADMIN_RATE_LIMIT_MAX=30
ADMIN_RATE_LIMIT_WINDOW=60000
```

## Database & Storage Optimization

### 1. File System Caching

```javascript
// Use OS-level caching
const fs = require('fs');

// Async file reads with caching
async function readFileCached(path) {
  const cached = fileCache.get(path);
  if (cached) return cached;

  const data = await fs.promises.readFile(path);
  fileCache.set(path, data);
  return data;
}
```

### 2. JSON Data Persistence

```javascript
// Efficient JSON serialization
class DataManager {
  async write(data) {
    const json = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(this.dataPath, json, 'utf8');
  }

  async read() {
    const json = await fs.promises.readFile(this.dataPath, 'utf8');
    return JSON.parse(json);
  }
}
```

## Network Optimization

### 1. HTTP/2 Support (Future)

```javascript
// Planned for v1.2.0
const http2 = require('http2');

const server = http2.createSecureServer({
  key: fs.readFileSync('server-key.pem'),
  cert: fs.readFileSync('server-cert.pem')
});
```

### 2. Keep-Alive Connections

```javascript
// Already enabled by default in Node.js
server.keepAliveTimeout = 5000; // 5 seconds
server.headersTimeout = 60000; // 60 seconds
```

### 3. Response Streaming

```javascript
// Stream large files instead of loading into memory
const stream = fs.createReadStream(filePath);
stream.pipe(res);
```

## Benchmarking

### 1. Built-in Benchmark Tool

```bash
# Run comprehensive benchmark
npm run benchmark

# Memory benchmark only
npm run benchmark:memory

# Load benchmark only
npm run benchmark:load

# Full benchmark suite
npm run benchmark:full
```

### 2. External Benchmarking Tools

**autocannon** (recommended):

```bash
npx autocannon -c 100 -d 30 http://localhost:8000/
```

**ab** (Apache Bench):

```bash
ab -n 10000 -c 100 http://localhost:8000/
```

**wrk**:

```bash
wrk -t4 -c100 -d30s http://localhost:8000/
```

### 3. Interpreting Results

```bash
# Good performance indicators:
✅ Latency P95 < 50ms
✅ Throughput > 1000 req/s
✅ Error rate < 0.1%
✅ Memory growth < 10MB/hour

# Warning signs:
⚠️ Latency P95 > 100ms
⚠️ Throughput < 500 req/s
⚠️ Error rate > 1%
⚠️ Memory growth > 50MB/hour
```

## Monitoring

### 1. Real-time Metrics

```bash
# Access performance dashboard
curl http://localhost:8000/dashboard

# Get Prometheus metrics
curl http://localhost:8000/metrics

# Health check
curl http://localhost:8000/health
```

### 2. Performance Monitoring

```javascript
// Track response times
const startTime = Date.now();
// ... handle request ...
const duration = Date.now() - startTime;

performanceMetrics.responseTime.push(duration);

// Calculate percentiles
function calculatePercentile(values, percentile) {
  const sorted = values.sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

const p95 = calculatePercentile(responseTimes, 95);
const p99 = calculatePercentile(responseTimes, 99);
```

## Optimization Checklist

### Pre-Production

- [ ] Enable production mode (`NODE_ENV=production`)
- [ ] Configure cache size appropriately
- [ ] Enable compression
- [ ] Set up rate limiting
- [ ] Configure security headers
- [ ] Enable monitoring
- [ ] Run load tests

### Production

- [ ] Monitor cache hit rate (target > 80%)
- [ ] Monitor response times (target P95 < 50ms)
- [ ] Monitor memory usage (target < 512MB)
- [ ] Monitor error rates (target < 0.1%)
- [ ] Set up alerts for anomalies
- [ ] Regular performance reviews

### VR Optimization

- [ ] Enable lightweight mode
- [ ] Reduce cache size
- [ ] Optimize asset sizes
- [ ] Use aggressive compression
- [ ] Minimize JavaScript bundle
- [ ] Implement lazy loading

## Advanced Optimization

### 1. Worker Threads (Future)

```javascript
// Offload CPU-intensive tasks
const { Worker } = require('worker_threads');

function compressInWorker(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./compress-worker.js');
    worker.postMessage(data);
    worker.on('message', resolve);
    worker.on('error', reject);
  });
}
```

### 2. Cluster Mode

```javascript
// Utilize all CPU cores
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  // Start server
  require('./server-lightweight.js');
}
```

### 3. Edge Caching

```nginx
# Use nginx as reverse proxy with caching
location / {
  proxy_pass http://localhost:8000;
  proxy_cache my_cache;
  proxy_cache_valid 200 1h;
  proxy_cache_use_stale error timeout updating;
}
```

## Troubleshooting

### High Memory Usage

```bash
# Enable heap snapshot
node --inspect server-lightweight.js

# Take heap snapshot
# Chrome DevTools > Memory > Take snapshot
```

### Slow Response Times

```bash
# Enable profiling
node --prof server-lightweight.js

# Process prof output
node --prof-process isolate-*.log
```

### Low Cache Hit Rate

```javascript
// Analyze cache misses
console.log('Cache Stats:', {
  hits: cacheHits,
  misses: cacheMisses,
  hitRate: cacheHits / (cacheHits + cacheMisses),
  size: cache.size,
  maxSize: cacheMaxSize
});
```

## Best Practices

1. **Cache Static Assets Aggressively**
   - Set long TTLs for immutable assets
   - Use content hashing for cache busting

2. **Compress Everything Over 1KB**
   - Except pre-compressed formats (images, videos)
   - Use Brotli when possible

3. **Monitor Continuously**
   - Set up alerts for degradation
   - Review metrics weekly

4. **Optimize for VR**
   - Minimize asset sizes
   - Use lightweight mode
   - Optimize for low latency

5. **Test Under Load**
   - Regular load testing
   - Simulate real-world scenarios
   - Test failure modes

## Resources

- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Web Performance Working Group](https://www.w3.org/webperf/)
- [Chrome DevTools Performance](https://developers.google.com/web/tools/chrome-devtools/performance)

---

**Last Updated**: 2025-10-10 **Version**: 1.1.0
