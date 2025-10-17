# API Reference

**Version**: 1.1.0
**Last Updated**: 2025-10-12

This document provides a comprehensive reference for all API endpoints in Qui Browser.

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URL](#base-url)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Endpoints](#endpoints)
  - [Health & Monitoring](#health--monitoring)
  - [Cache Management](#cache-management)
  - [Session Management](#session-management)
  - [Security](#security)
  - [Performance](#performance)
  - [Billing](#billing)
  - [AI Copilot](#ai-copilot)
  - [Privacy](#privacy)
  - [VR/WebXR](#vrwebxr)
- [WebSocket API](#websocket-api)
- [Event Streaming](#event-streaming)

---

## Overview

Qui Browser provides RESTful APIs for server management, monitoring, and advanced features. All APIs follow REST conventions and return JSON responses.

### API Principles

- **RESTful Design**: Resource-based URLs with HTTP verbs
- **JSON Format**: All requests and responses use JSON
- **Idempotent**: GET, PUT, DELETE operations are idempotent
- **Versioned**: API version in URL path (future-proof)
- **Consistent**: Standard response formats across all endpoints

---

## Authentication

### Admin Endpoints

Admin endpoints require bearer token authentication:

```http
Authorization: Bearer <ADMIN_TOKEN>
```

**Example:**

```bash
curl -H "Authorization: Bearer your-admin-token" \
  http://localhost:8000/admin/cache/clear
```

### Session Endpoints

Session endpoints use encrypted session cookies:

```http
Cookie: session=<encrypted-session-id>
```

---

## Base URL

### Development

```
http://localhost:8000
```

### Production

```
https://your-domain.com
```

---

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { /* Response data */ },
  "timestamp": "2025-10-12T10:00:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { /* Additional error context */ }
  },
  "timestamp": "2025-10-12T10:00:00.000Z"
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Description | Usage |
|------|-------------|-------|
| `200` | OK | Successful GET, PUT, DELETE |
| `201` | Created | Successful POST creating resource |
| `204` | No Content | Successful DELETE with no response |
| `400` | Bad Request | Invalid request parameters |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | Valid auth but insufficient permissions |
| `404` | Not Found | Resource not found |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server error |
| `503` | Service Unavailable | Server overloaded or maintenance |

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_INPUT` | Request validation failed |
| `AUTH_REQUIRED` | Authentication required |
| `AUTH_INVALID` | Invalid credentials |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `INTERNAL_ERROR` | Internal server error |
| `SERVICE_UNAVAILABLE` | Service temporarily unavailable |

---

## Rate Limiting

### Global Limits

- **Default**: 100 requests/minute per IP
- **Burst**: 20 requests/second

### Endpoint-Specific Limits

| Endpoint | Limit |
|----------|-------|
| `/health` | 300/min |
| `/metrics` | 60/min |
| `/api/*` | 100/min |
| `/admin/*` | 30/min |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1634567890
```

### Rate Limit Exceeded Response

```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60,
  "limit": 100,
  "window": 60000
}
```

---

## Endpoints

### Health & Monitoring

#### GET /health

Check system health status.

**Authentication**: None

**Response**:

```json
{
  "status": "healthy",
  "timestamp": "2025-10-12T10:00:00.000Z",
  "uptime": 86400,
  "version": "1.1.0",
  "system": {
    "memory": {
      "used": 134217728,
      "total": 1073741824,
      "percentage": 12.5
    },
    "cpu": {
      "usage": 15.5,
      "cores": 4
    },
    "eventLoop": {
      "lag": 2.3
    }
  },
  "dependencies": {
    "filesystem": true,
    "cache": true,
    "database": true
  }
}
```

**Status Values**:
- `healthy`: All systems operational
- `degraded`: Some non-critical issues
- `unhealthy`: Critical issues detected

---

#### GET /metrics

Get performance metrics.

**Authentication**: None (public metrics)

**Response**:

```json
{
  "timestamp": "2025-10-12T10:00:00.000Z",
  "uptime": 86400,
  "cache": {
    "hits": 10000,
    "misses": 1000,
    "hitRate": 0.909,
    "size": 5000,
    "maxSize": 10000,
    "memoryUsage": 52428800,
    "evictions": 150
  },
  "requests": {
    "total": 50000,
    "rate": 8.33,
    "errors": 50,
    "errorRate": 0.001
  },
  "sessions": {
    "active": 150,
    "activeUsers": 120,
    "created": 500,
    "destroyed": 350
  },
  "security": {
    "blockedRequests": 50,
    "blacklistedIps": 5,
    "rateLimitHits": 200
  }
}
```

---

#### GET /performance

Get detailed performance profiling data.

**Authentication**: None

**Requirements**: `ENABLE_PROFILING=true`

**Response**:

```json
{
  "uptime": 86400,
  "timings": [
    {
      "name": "request-processing",
      "count": 50000,
      "min": 0.5,
      "max": 250.0,
      "mean": 12.5,
      "median": 10.0,
      "p95": 35.0,
      "p99": 85.0,
      "stdDev": 15.2
    }
  ],
  "bottlenecks": [
    {
      "name": "database-query",
      "p95": 150.0,
      "mean": 85.0,
      "count": 5000,
      "recommendation": "Add database index"
    }
  ],
  "memory": {
    "heapUsed": {
      "current": 134217728,
      "min": 100000000,
      "max": 200000000,
      "mean": 150000000
    },
    "external": {
      "current": 5242880,
      "mean": 5000000
    }
  },
  "gc": {
    "collections": 150,
    "pauseTime": 250.5,
    "avgPauseTime": 1.67
  }
}
```

---

#### GET /metrics/prometheus

Get Prometheus-formatted metrics.

**Authentication**: None

**Response** (text/plain):

```prometheus
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 45000
http_requests_total{method="GET",status="404"} 500
http_requests_total{method="POST",status="201"} 2500

# HELP http_request_duration_seconds HTTP request latency
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.01"} 30000
http_request_duration_seconds_bucket{le="0.05"} 45000
http_request_duration_seconds_bucket{le="0.1"} 48000
http_request_duration_seconds_bucket{le="0.5"} 49500
http_request_duration_seconds_bucket{le="1"} 50000
http_request_duration_seconds_count 50000
http_request_duration_seconds_sum 625.0

# HELP cache_hit_rate Cache hit rate
# TYPE cache_hit_rate gauge
cache_hit_rate 0.909

# HELP memory_usage_bytes Memory usage in bytes
# TYPE memory_usage_bytes gauge
memory_usage_bytes{type="heap"} 134217728
memory_usage_bytes{type="external"} 5242880
```

---

### Cache Management

#### POST /admin/cache/clear

Clear all cached data.

**Authentication**: Required (Admin)

**Request**:

```bash
curl -X POST \
  -H "Authorization: Bearer admin-token" \
  http://localhost:8000/admin/cache/clear
```

**Response**:

```json
{
  "success": true,
  "data": {
    "itemsCleared": 5000,
    "memoryFreed": 52428800
  }
}
```

---

#### GET /admin/cache/stats

Get detailed cache statistics.

**Authentication**: Required (Admin)

**Response**:

```json
{
  "size": 5000,
  "maxSize": 10000,
  "memoryUsage": 52428800,
  "hits": 10000,
  "misses": 1000,
  "hitRate": 0.909,
  "evictions": 150,
  "strategy": "adaptive",
  "ttl": 300000,
  "items": [
    {
      "key": "user:123",
      "size": 1024,
      "accessCount": 50,
      "lastAccess": "2025-10-12T09:55:00.000Z",
      "expiresAt": "2025-10-12T10:05:00.000Z"
    }
  ]
}
```

---

### Session Management

#### POST /api/session/create

Create a new session.

**Authentication**: None

**Request**:

```json
{
  "userId": "user123",
  "metadata": {
    "device": "desktop",
    "browser": "Chrome"
  }
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "sessionId": "sess_abc123",
    "expiresAt": "2025-10-12T11:00:00.000Z",
    "maxAge": 3600000
  }
}
```

**Headers**:

```http
Set-Cookie: session=<encrypted-session-id>; HttpOnly; Secure; SameSite=Strict
```

---

#### DELETE /api/session/destroy

Destroy current session.

**Authentication**: Session cookie

**Response**:

```json
{
  "success": true,
  "message": "Session destroyed"
}
```

---

#### GET /api/session/validate

Validate current session.

**Authentication**: Session cookie

**Response**:

```json
{
  "valid": true,
  "sessionId": "sess_abc123",
  "userId": "user123",
  "createdAt": "2025-10-12T10:00:00.000Z",
  "expiresAt": "2025-10-12T11:00:00.000Z",
  "timeRemaining": 3600000
}
```

---

### Security

#### POST /admin/security/blacklist

Add IP to blacklist.

**Authentication**: Required (Admin)

**Request**:

```json
{
  "ip": "192.168.1.100",
  "reason": "Suspicious activity",
  "duration": 3600000
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "ip": "192.168.1.100",
    "blacklistedAt": "2025-10-12T10:00:00.000Z",
    "expiresAt": "2025-10-12T11:00:00.000Z"
  }
}
```

---

#### DELETE /admin/security/blacklist/:ip

Remove IP from blacklist.

**Authentication**: Required (Admin)

**Response**:

```json
{
  "success": true,
  "message": "IP removed from blacklist"
}
```

---

#### GET /admin/audit/logs

Query audit logs.

**Authentication**: Required (Admin)

**Query Parameters**:

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `category` | string | Filter by category | all |
| `startDate` | ISO8601 | Start date | 30 days ago |
| `endDate` | ISO8601 | End date | now |
| `limit` | number | Max results | 100 |
| `offset` | number | Pagination offset | 0 |

**Example**:

```bash
curl -H "Authorization: Bearer admin-token" \
  "http://localhost:8000/admin/audit/logs?category=security_violation&limit=50"
```

**Response**:

```json
{
  "success": true,
  "data": {
    "total": 1500,
    "limit": 50,
    "offset": 0,
    "logs": [
      {
        "id": "log_abc123",
        "timestamp": "2025-10-12T09:30:00.000Z",
        "category": "security_violation",
        "action": "rate_limit_exceeded",
        "userId": "user123",
        "ip": "192.168.1.100",
        "metadata": {
          "endpoint": "/api/data",
          "requestCount": 150
        },
        "signature": "a1b2c3d4..."
      }
    ]
  }
}
```

---

### Performance

#### POST /admin/performance/profile

Start/stop performance profiling.

**Authentication**: Required (Admin)

**Request**:

```json
{
  "action": "start",
  "duration": 60000,
  "metrics": ["cpu", "memory", "requests"]
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "profileId": "prof_abc123",
    "status": "running",
    "startedAt": "2025-10-12T10:00:00.000Z",
    "estimatedCompletionAt": "2025-10-12T10:01:00.000Z"
  }
}
```

---

#### GET /admin/performance/profile/:id

Get profiling results.

**Authentication**: Required (Admin)

**Response**:

```json
{
  "success": true,
  "data": {
    "profileId": "prof_abc123",
    "status": "completed",
    "duration": 60000,
    "metrics": {
      "cpu": {
        "avg": 35.5,
        "max": 85.2,
        "min": 5.1
      },
      "memory": {
        "avg": 150000000,
        "max": 200000000,
        "min": 120000000
      },
      "requests": {
        "total": 5000,
        "rate": 83.33,
        "avgDuration": 12.5
      }
    }
  }
}
```

---

### Billing

#### POST /api/billing/create-checkout

Create Stripe checkout session.

**Authentication**: Session cookie

**Request**:

```json
{
  "priceId": "price_1234",
  "quantity": 1,
  "successUrl": "https://yourdomain.com/success",
  "cancelUrl": "https://yourdomain.com/cancel"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "sessionId": "cs_test_abc123",
    "url": "https://checkout.stripe.com/pay/cs_test_abc123"
  }
}
```

---

#### POST /api/billing/webhook

Stripe webhook endpoint.

**Authentication**: Stripe signature verification

**Headers**:

```http
Stripe-Signature: t=1634567890,v1=abc123...
```

**Response**:

```json
{
  "received": true
}
```

---

### AI Copilot

#### POST /api/ai/summarize

Summarize web page content.

**Authentication**: Session cookie

**Request**:

```json
{
  "content": "Long web page content...",
  "maxLength": 3
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "summary": "Three-sentence summary of the content.",
    "wordCount": 50,
    "compressionRatio": 0.95
  }
}
```

---

#### POST /api/ai/question

Ask question about page content.

**Authentication**: Session cookie

**Request**:

```json
{
  "question": "What is the main topic?",
  "context": "Page content for context..."
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "answer": "The main topic is...",
    "confidence": 0.92,
    "sources": ["paragraph 1", "paragraph 3"]
  }
}
```

---

### Privacy

#### GET /api/privacy/score

Get privacy protection score.

**Authentication**: None

**Response**:

```json
{
  "score": 85,
  "maxScore": 100,
  "grade": "A",
  "protections": {
    "canvasRandomization": true,
    "webglRandomization": true,
    "thirdPartyCookiesBlocked": true,
    "trackersBlocked": true,
    "userAgentRandomized": false
  },
  "recommendations": [
    {
      "issue": "User agent not randomized",
      "recommendation": "Enable user agent randomization",
      "impact": "Medium"
    }
  ]
}
```

---

#### GET /api/privacy/statistics

Get privacy protection statistics.

**Authentication**: None

**Response**:

```json
{
  "trackersBlocked": 150,
  "cookiesBlocked": 75,
  "fingerprintAttemptsBlocked": 25,
  "canvasRandomizations": 50,
  "webglRandomizations": 30,
  "protectionLevel": "standard"
}
```

---

### VR/WebXR

#### GET /api/vr/capabilities

Check VR device capabilities.

**Authentication**: None

**Response**:

```json
{
  "webxrSupported": true,
  "vrSupported": true,
  "arSupported": false,
  "features": {
    "handTracking": true,
    "eyeTracking": false,
    "layers": true,
    "depthSensing": true
  },
  "recommendedSettings": {
    "foveationLevel": 1,
    "targetFrameRate": 90,
    "renderScale": 1.0
  }
}
```

---

#### POST /api/vr/session/start

Start VR session.

**Authentication**: Session cookie

**Request**:

```json
{
  "sessionMode": "immersive-vr",
  "features": ["hand-tracking", "layers"]
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "sessionId": "vr_sess_abc123",
    "mode": "immersive-vr",
    "targetFrameRate": 90,
    "features": ["hand-tracking", "layers"],
    "recommendedSettings": {
      "foveationLevel": 1,
      "renderScale": 1.0
    }
  }
}
```

---

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('ws://localhost:8000');

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### Authentication

Send authentication message after connection:

```json
{
  "type": "auth",
  "token": "your-session-token"
}
```

### Message Types

#### Subscribe to Events

```json
{
  "type": "subscribe",
  "channel": "metrics"
}
```

**Response**:

```json
{
  "type": "subscribed",
  "channel": "metrics"
}
```

#### Real-time Metrics

Server sends periodic updates:

```json
{
  "type": "metrics",
  "data": {
    "timestamp": "2025-10-12T10:00:00.000Z",
    "requests": 8.33,
    "errors": 0.001,
    "cacheHitRate": 0.909
  }
}
```

#### Ping/Pong

Client sends ping to keep connection alive:

```json
{
  "type": "ping"
}
```

Server responds:

```json
{
  "type": "pong",
  "timestamp": "2025-10-12T10:00:00.000Z"
}
```

---

## Event Streaming

### Server-Sent Events (SSE)

#### GET /api/events/stream

Real-time event stream.

**Authentication**: Session cookie

**Headers**:

```http
Accept: text/event-stream
```

**Response**:

```
event: metrics
data: {"requests":8.33,"errors":0.001}

event: alert
data: {"level":"warning","message":"High memory usage"}

event: heartbeat
data: {"timestamp":"2025-10-12T10:00:00.000Z"}
```

**Client Example**:

```javascript
const eventSource = new EventSource('/api/events/stream');

eventSource.addEventListener('metrics', (e) => {
  const data = JSON.parse(e.data);
  console.log('Metrics:', data);
});

eventSource.addEventListener('alert', (e) => {
  const data = JSON.parse(e.data);
  console.log('Alert:', data);
});
```

---

## OpenAPI Specification

Full OpenAPI 3.1 specification available at:

```
/api/openapi.json
```

Use with Swagger UI for interactive documentation:

```
/api/docs
```

---

## Best Practices

### Request Optimization

1. **Use caching headers**: Set `If-None-Match` with ETag
2. **Compress requests**: Use gzip/brotli compression
3. **Batch requests**: Combine multiple operations when possible
4. **Use WebSocket**: For real-time updates instead of polling

### Error Handling

```javascript
try {
  const response = await fetch('/api/endpoint');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message);
  }

  const data = await response.json();
  return data;
} catch (error) {
  console.error('API Error:', error.message);
  // Handle error appropriately
}
```

### Retry Logic

```javascript
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = response.headers.get('Retry-After') || 60;
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}
```

---

## SDK Examples

### Node.js

```javascript
const QuiBrowserClient = require('qui-browser-client');

const client = new QuiBrowserClient({
  baseURL: 'http://localhost:8000',
  apiKey: 'your-api-key'
});

// Health check
const health = await client.health.check();

// Get metrics
const metrics = await client.metrics.get();

// Create session
const session = await client.session.create({
  userId: 'user123'
});
```

### Python

```python
from qui_browser import QuiBrowserClient

client = QuiBrowserClient(
    base_url='http://localhost:8000',
    api_key='your-api-key'
)

# Health check
health = client.health.check()

# Get metrics
metrics = client.metrics.get()

# Create session
session = client.session.create(user_id='user123')
```

---

## Support

For API support:

- **Documentation**: https://docs.qui-browser.com
- **GitHub Issues**: https://github.com/your-org/qui-browser/issues
- **Email**: api-support@qui-browser.com

---

**Last Updated**: 2025-10-12
**API Version**: 1.1.0
