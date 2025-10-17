# Prometheus Metrics Reference

## Overview

Qui Browser exposes comprehensive metrics in Prometheus format via the `/prometheus` endpoint. This document lists all available metrics with descriptions, types, and usage examples.

## Available Metrics

### HTTP Request Metrics

#### `http_requests_total`
- **Type**: Counter
- **Description**: Total number of HTTP requests processed
- **Labels**: None
- **Example**: `http_requests_total 15420`

#### `http_errors_total`
- **Type**: Counter
- **Description**: Total number of HTTP errors (4xx/5xx responses)
- **Labels**: None
- **Example**: `http_errors_total 156`

### Process Metrics

#### `process_uptime_seconds`
- **Type**: Gauge
- **Description**: Process uptime in seconds
- **Labels**: None
- **Example**: `process_uptime_seconds 3600`

### Compression Cache Metrics

#### `compression_cache_hits_total`
- **Type**: Counter
- **Description**: Total number of compression cache hits
- **Labels**: None
- **Example**: `compression_cache_hits_total 12340`

#### `compression_cache_misses_total`
- **Type**: Counter
- **Description**: Total number of compression cache misses
- **Labels**: None
- **Example**: `compression_cache_misses_total 2340`

#### `compression_cache_bypasses_total`
- **Type**: Counter
- **Description**: Total number of compression cache bypasses (uncompressible content)
- **Labels**: None
- **Example**: `compression_cache_bypasses_total 180`

#### `compression_cache_bytes_saved_total`
- **Type**: Counter
- **Description**: Total bytes saved through compression cache
- **Labels**: None
- **Example**: `compression_cache_bytes_saved_total 5242880`

#### `compression_cache_hit_ratio`
- **Type**: Gauge
- **Description**: Compression cache hit ratio (0-1)
- **Labels**: None
- **Example**: `compression_cache_hit_ratio 0.817`

### Rate Limiting Metrics

#### `http_rate_limited_total`
- **Type**: Counter
- **Description**: Total number of rate-limited requests
- **Labels**:
  - `scope`: Request scope (`global`, `endpoint`)
  - `path`: API endpoint path (when scope is `endpoint`)
- **Examples**:
  ```
  http_rate_limited_total{scope="global"} 45
  http_rate_limited_total{scope="endpoint",path="/api/users"} 12
  ```

### Advanced Metrics (when monitoring enabled)

#### `memory_heap_used_bytes`
- **Type**: Gauge
- **Description**: V8 heap memory used in bytes
- **Labels**: None

#### `memory_heap_total_bytes`
- **Type**: Gauge
- **Description**: V8 heap memory total in bytes
- **Labels**: None

#### `memory_external_bytes`
- **Type**: Gauge
- **Description**: V8 external memory in bytes
- **Labels**: None

#### `memory_rss_bytes`
- **Type**: Gauge
- **Description**: Resident Set Size in bytes
- **Labels**: None

#### `cpu_user_seconds_total`
- **Type**: Counter
- **Description**: CPU time spent in user mode
- **Labels**: None

#### `cpu_system_seconds_total`
- **Type**: Counter
- **Description**: CPU time spent in system mode
- **Labels**: None

#### `event_loop_lag_seconds`
- **Type**: Gauge
- **Description**: Node.js event loop lag in seconds
- **Labels**: None

#### `gc_duration_seconds`
- **Type**: Histogram
- **Description**: Garbage collection duration
- **Labels**:
  - `kind`: GC kind (`major`, `minor`, `incremental`, `weakcb`)

#### `active_handles`
- **Type**: Gauge
- **Description**: Number of active libuv handles
- **Labels**: None

#### `active_requests`
- **Type**: Gauge
- **Description**: Number of active libuv requests
- **Labels**: None

## Metric Collection

### Endpoint Access

```bash
# Get all Prometheus metrics
curl http://localhost:8000/prometheus

# Filter compression cache metrics
curl http://localhost:8000/prometheus | grep compression_cache
```

### Sample Output

```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total 15420

# HELP http_errors_total Total HTTP errors
# TYPE http_errors_total counter
http_errors_total 156

# HELP process_uptime_seconds Process uptime
# TYPE process_uptime_seconds gauge
process_uptime_seconds 3600

# HELP compression_cache_hits_total Total compression cache hits
# TYPE compression_cache_hits_total counter
compression_cache_hits_total 12340

# HELP compression_cache_misses_total Total compression cache misses
# TYPE compression_cache_misses_total counter
compression_cache_misses_total 2340

# HELP compression_cache_bypasses_total Total compression cache bypasses
# TYPE compression_cache_bypasses_total counter
compression_cache_bypasses_total 180

# HELP compression_cache_bytes_saved_total Total bytes saved by compression cache
# TYPE compression_cache_bytes_saved_total counter
compression_cache_bytes_saved_total 5242880

# HELP compression_cache_hit_ratio Compression cache hit ratio (0-1)
# TYPE compression_cache_hit_ratio gauge
compression_cache_hit_ratio 0.817
```

## Alert Rules Examples

### Compression Cache Alerts

```yaml
groups:
  - name: qui_browser_compression_cache
    rules:
      - alert: LowCompressionCacheHitRatio
        expr: compression_cache_hit_ratio < 0.5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Compression cache hit ratio is low"
          description: "Compression cache hit ratio is {{ $value | printf \"%.2f\" }} (threshold: 0.5)"

      - alert: CriticalCompressionCacheHitRatio
        expr: compression_cache_hit_ratio < 0.3
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Compression cache hit ratio critically low"
          description: "Compression cache hit ratio is {{ $value | printf \"%.2f\" }} (threshold: 0.3)"
```

### HTTP Error Rate Alert

```yaml
      - alert: HighErrorRate
        expr: rate(http_requests_total[5m]) > 0.1
        for: 5m
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | printf \"%.2f\" }} over last 5 minutes"
```

### Memory Usage Alert

```yaml
      - alert: HighMemoryUsage
        expr: memory_heap_used_bytes / memory_heap_total_bytes > 0.9
        for: 5m
        annotations:
          summary: "High memory usage detected"
          description: "Heap memory usage is {{ $value | printf \"%.2f\" }} of total heap"
```

## Grafana Dashboard Queries

### Compression Cache Panel

```
# Hit Ratio (%)
compression_cache_hit_ratio * 100

# Hits per Second
rate(compression_cache_hits_total[5m])

# Misses per Second
rate(compression_cache_misses_total[5m])

# Bytes Saved per Second (KB)
rate(compression_cache_bytes_saved_total[5m]) / 1024
```

### HTTP Performance Panel

```
# Request Rate
rate(http_requests_total[5m])

# Error Rate (%)
rate(http_errors_total[5m]) / rate(http_requests_total[5m]) * 100

# Rate Limited Requests
rate(http_rate_limited_total[5m])
```

### System Resources Panel

```
# Memory Usage (%)
memory_heap_used_bytes / memory_heap_total_bytes * 100

# CPU Usage (%)
rate(cpu_user_seconds_total[5m]) + rate(cpu_system_seconds_total[5m]) * 100

# Event Loop Lag (ms)
event_loop_lag_seconds * 1000
```

## Metric Scopes

### Global Metrics
- Available in all deployments
- Include basic HTTP, process, and compression cache metrics

### Advanced Metrics
- Require `ENABLE_PROFILING=true` or monitoring enabled
- Include detailed memory, CPU, and garbage collection metrics
- Useful for performance troubleshooting and optimization

### Rate Limiting Metrics
- Include endpoint-specific metrics when rate limiting is active
- Help identify abusive clients and endpoints

## Troubleshooting

### Metrics Not Appearing

1. **Check endpoint accessibility:**
   ```bash
   curl -I http://localhost:8000/prometheus
   ```

2. **Verify server logs:**
   ```bash
   # Check for metric collection errors
   pm2 logs qui-browser-production | grep -i error
   ```

### Incorrect Values

1. **Validate against health endpoint:**
   ```bash
   curl http://localhost:8000/health | jq '.compressionCache'
   curl http://localhost:8000/metrics | jq '.compressionCache'
   ```

2. **Check metric format:**
   ```bash
   curl http://localhost:8000/prometheus | head -20
   ```

## Related Documentation

- [Compression Cache Monitoring Guide](COMPRESSION-CACHE-MONITORING.md)
- [Performance Optimization Guide](PERFORMANCE.md)
- [Production Deployment Guide](PRODUCTION-DEPLOYMENT.md)
