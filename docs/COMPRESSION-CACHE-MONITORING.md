# Compression Cache Monitoring Guide

## Overview

This guide covers monitoring and optimizing Qui Browser's compression cache performance to ensure optimal bandwidth usage and response times.

## Key Metrics

### Compression Cache Statistics

The compression cache provides real-time statistics through multiple endpoints:

- **`/health`** - Overall health with compression cache summary
- **`/metrics`** - Detailed JSON metrics
- **`/prometheus`** - Prometheus-compatible metrics format

### Available Metrics

| Metric | Type | Description | Prometheus Name |
|--------|------|-------------|-----------------|
| Hits | Counter | Total successful cache hits | `compression_cache_hits_total` |
| Misses | Counter | Total cache misses | `compression_cache_misses_total` |
| Bypasses | Counter | Total cache bypasses | `compression_cache_bypasses_total` |
| Hit Rate | Gauge | Cache efficiency (0-1) | `compression_cache_hit_ratio` |
| Bytes Saved | Counter | Total bytes saved through compression | `compression_cache_bytes_saved_total` |

## Monitoring Commands

### Real-time Health Check

```bash
curl http://localhost:8000/health | jq '.compressionCache'
```

**Example Output:**
```json
{
  "hits": 15420,
  "misses": 3260,
  "bypasses": 180,
  "total": 18860,
  "hitRate": 0.817,
  "hitRatePercent": 81.7,
  "bytesSaved": 5242880,
  "bytesSavedFormatted": "5 MB"
}
```

### Prometheus Metrics

```bash
curl http://localhost:8000/prometheus | grep compression_cache
```

**Output:**
```
# HELP compression_cache_hits_total Total compression cache hits
# TYPE compression_cache_hits_total counter
compression_cache_hits_total 15420

# HELP compression_cache_misses_total Total compression cache misses
# TYPE compression_cache_misses_total counter
compression_cache_misses_total 3260

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

## Alert Configuration

### Prometheus Alert Rules

Add these rules to your Prometheus alert configuration:

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
          description: "Compression cache hit ratio is {{ $value | printf \"%.2f\" }} (threshold: 0.5). Consider increasing STATIC_COMPRESSION_CACHE_MAX_SIZE."

      - alert: CriticalCompressionCacheHitRatio
        expr: compression_cache_hit_ratio < 0.3
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Compression cache hit ratio critically low"
          description: "Compression cache hit ratio is {{ $value | printf \"%.2f\" }} (threshold: 0.3). Immediate cache size increase required."

      - alert: CompressionCacheBytesSavedStagnant
        expr: rate(compression_cache_bytes_saved_total[1h]) < 1000
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Compression cache bytes saved rate is low"
          description: "Compression cache is saving less than 1KB/s. Check if compression is working properly."
```

### Grafana Dashboard

#### Compression Cache Panel

Create a new panel with these metrics:

**Queries:**
```
A: compression_cache_hit_ratio * 100
B: compression_cache_hits_total
C: compression_cache_misses_total
D: compression_cache_bypasses_total
E: rate(compression_cache_bytes_saved_total[5m]) / 1024
```

**Visualizations:**
- Hit Ratio: Gauge (0-100%)
- Hits/Misses/Bypasses: Time series stacked bar chart
- Bytes Saved Rate: Time series line chart (KB/s)

## Performance Optimization

### Cache Size Tuning

Monitor hit ratio and adjust cache size:

```bash
# Check current hit ratio
curl http://localhost:8000/health | jq '.compressionCache.hitRatePercent'

# Increase cache size if hit ratio < 70%
STATIC_COMPRESSION_CACHE_MAX_SIZE=1000
STATIC_COMPRESSION_CACHE_TTL_MS=1800000  # 30 minutes
```

### TTL Optimization

Adjust TTL based on content update frequency:

```bash
# For frequently updated content
STATIC_COMPRESSION_CACHE_TTL_MS=300000   # 5 minutes

# For static content
STATIC_COMPRESSION_CACHE_TTL_MS=3600000  # 1 hour
```

## Troubleshooting

### Common Issues

#### Low Hit Ratio
**Symptoms:** Hit ratio consistently below 50%

**Solutions:**
1. Increase `STATIC_COMPRESSION_CACHE_MAX_SIZE`
2. Check if content is being compressed
3. Verify cache key generation is consistent

#### Memory Usage High
**Symptoms:** Compression cache consuming excessive memory

**Solutions:**
1. Reduce `STATIC_COMPRESSION_CACHE_MAX_SIZE`
2. Decrease `STATIC_COMPRESSION_CACHE_TTL_MS`
3. Monitor cache size vs. hit ratio trade-off

#### No Bytes Saved
**Symptoms:** `compression_cache_bytes_saved_total` not increasing

**Solutions:**
1. Verify compression is enabled
2. Check if responses are compressible content types
3. Confirm cache is being populated

### Diagnostic Commands

```bash
# Check compression cache status
curl http://localhost:8000/health | jq '.compressionCache'

# Monitor cache growth
watch -n 5 'curl -s http://localhost:8000/health | jq ".compressionCache | {hits, misses, bypasses, hitRatePercent, bytesSavedFormatted}"'

# Check Prometheus metrics
curl http://localhost:8000/prometheus | grep -A 2 -B 2 compression_cache
```

## Best Practices

### Monitoring Strategy

1. **Baseline Establishment**
   - Monitor hit ratio during normal operation
   - Establish baseline bytes saved per hour/day

2. **Alert Thresholds**
   - Warning: Hit ratio < 50%
   - Critical: Hit ratio < 30%
   - Warning: Bytes saved rate < 1KB/s for 30 minutes

3. **Regular Review**
   - Monthly cache size optimization
   - Quarterly performance baseline updates
   - Annual compression algorithm evaluation

### Performance Targets

- **Hit Ratio:** > 70% for optimal performance
- **Bytes Saved:** > 10MB/hour depending on traffic
- **Memory Usage:** < 20% of available RAM for cache

### Scaling Considerations

For high-traffic deployments:
- Consider Redis for distributed compression cache
- Implement cache warming strategies
- Monitor memory usage across multiple instances

## Related Documentation

- [Performance Optimization Guide](PERFORMANCE.md)
- [Prometheus Metrics Reference](PROMETHEUS-METRICS.md)
- [Production Deployment](PRODUCTION-DEPLOYMENT.md)
