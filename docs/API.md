# Qui Browser API Documentation

## Overview

Qui Browser provides a comprehensive RESTful API and WebSocket endpoints for managing the browser server, monitoring performance, handling subscriptions, and automating browser operations.

## Base URL

```
http://localhost:8000
```

For production, use HTTPS:

```
https://your-domain.com
```

## Authentication

### Admin Endpoints

Admin endpoints require Bearer token authentication:

```http
Authorization: Bearer YOUR_ADMIN_TOKEN
```

Configure the admin token in `.env`:

```bash
BILLING_ADMIN_TOKEN=your-secure-random-token-here
```

**Security Requirements:**

- Minimum token length: 16 characters
- Use cryptographically secure random strings
- Never commit tokens to version control
- Rotate tokens regularly

## HTTP Endpoints

### Core Endpoints

#### Health Check

Get server health status.

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-13T10:53:00.000Z",
  "uptime": 3600,
  "system": {
    "memory": {
      "used": 123456789,
      "total": 1073741824,
      "percentage": 11.5
    },
    "cpu": {
      "usage": 25.5
    },
    "eventLoop": {
      "lag": 2.3
    }
  },
  "dependencies": {
    "filesystem": true,
    "cache": true
  }
}
```

#### Metrics

Get performance metrics.

**Endpoint:** `GET /metrics`

**Response:**
```json
{
  "cache": {
    "hits": 1000,
    "misses": 100,
    "hitRate": 0.909
  },
  "ddos": {
    "blockedRequests": 50
  },
  "sessions": {
    "activeSessions": 150
  }
}
```

### Automation Endpoints

#### Bookmark Automation

##### Analyze and Auto-Bookmark

Automatically analyze page visits and suggest bookmarks.

**Endpoint:** `POST /api/automation/bookmarks/analyze`

**Request Body:**
```json
{
  "url": "https://example.com",
  "title": "Example Page",
  "dwellTime": 300000,
  "visitCount": 5,
  "referrer": "https://google.com"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "id": 123,
    "url": "https://example.com",
    "title": "[自動] Example Page",
    "folder": "auto-generated",
    "tags": ["検索", "情報"],
    "confidence": 0.85
  }
}
```

##### Cleanup Bookmarks

Remove duplicate bookmarks and optimize bookmark storage.

**Endpoint:** `POST /api/automation/bookmarks/cleanup`

**Response:**
```json
{
  "success": true,
  "deduplicatedCount": 5
}
```

#### History Automation

##### Cleanup History

Automatically clean up old browsing history.

**Endpoint:** `POST /api/automation/history/cleanup`

**Response:**
```json
{
  "success": true,
  "result": {
    "cleaned": true,
    "initialCount": 1500,
    "finalCount": 1200,
    "cleanedCount": 300
  }
}
```

##### Get History Stats

Get browsing history statistics.

**Endpoint:** `GET /api/automation/history/stats`

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalEntries": 1200,
    "oldestEntry": "2024-10-01T00:00:00.000Z",
    "newestEntry": "2025-10-13T10:53:00.000Z",
    "averageVisitsPerDay": 25.5,
    "topDomains": [
      {"domain": "github.com", "count": 150},
      {"domain": "google.com", "count": 120}
    ],
    "storageSize": 15360
  }
}
```

#### Tab Automation

##### Optimize Tabs

Automatically optimize tab management (suspend inactive tabs, group related tabs).

**Endpoint:** `POST /api/automation/tabs/optimize`

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalTabs": 25,
    "activeTabs": 15,
    "suspendedTabs": 10,
    "groupedTabs": 8,
    "groups": 3
  }
}
```

##### Get Tab Stats

Get tab management statistics.

**Endpoint:** `GET /api/automation/tabs/stats`

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalTabs": 25,
    "activeTabs": 15,
    "suspendedTabs": 10,
    "groupedTabs": 8,
    "groups": 3,
    "memoryUsage": 52428800,
    "averageTabAge": 3600000
  }
}
```

#### Automation Settings

##### Get Settings

Get current automation settings.

**Endpoint:** `GET /api/automation/settings`

**Response:**
```json
{
  "success": true,
  "settings": {
    "bookmarks": {
      "autoBookmarkEnabled": true,
      "visitCountThreshold": 5,
      "dwellTimeThreshold": 300000,
      "maxAutoBookmarks": 50
    },
    "history": {
      "maxHistoryAge": 7776000000,
      "maxHistoryEntries": 10000,
      "privacyMode": false
    },
    "tabs": {
      "maxTabsPerWindow": 20,
      "autoSuspendThreshold": 1800000,
      "autoGroupEnabled": true,
      "suspendEnabled": true
    }
  }
}
```

##### Update Settings

Update automation settings.

**Endpoint:** `PUT /api/automation/settings`

**Request Body:**
```json
{
  "bookmarks": {
    "maxAutoBookmarks": 100
  },
  "history": {
    "privacyMode": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Settings updated"
}
```

### Browser Management Endpoints

#### Bookmarks

##### Get Bookmarks

**Endpoint:** `GET /api/bookmarks`

**Response:**
```json
[
  {
    "id": 1,
    "url": "https://example.com",
    "title": "Example Site",
    "folder": "default",
    "createdAt": 1634088000000
  }
]
```

##### Add Bookmark

**Endpoint:** `POST /api/bookmarks`

**Request Body:**
```json
{
  "url": "https://example.com",
  "title": "Example Site",
  "folder": "default"
}
```

##### Delete Bookmark

**Endpoint:** `DELETE /api/bookmarks/{id}`

#### History

##### Get History

**Endpoint:** `GET /api/history`

**Query Parameters:**
- `limit`: Maximum number of entries (default: 50)
- `offset`: Pagination offset (default: 0)
- `domain`: Filter by domain

**Response:**
```json
[
  {
    "url": "https://example.com",
    "title": "Example Page",
    "visitedAt": 1634088000000
  }
]
```

##### Add History Entry

**Endpoint:** `POST /api/history`

##### Clear History

**Endpoint:** `DELETE /api/history`

#### Tabs

##### Get Tabs

**Endpoint:** `GET /api/tabs`

**Response:**
```json
[
  {
    "id": 1,
    "url": "https://example.com",
    "title": "Example Site",
    "createdAt": 1634088000000,
    "isSuspended": false
  }
]
```

##### Add Tab

**Endpoint:** `POST /api/tabs`

##### Delete Tab

**Endpoint:** `DELETE /api/tabs/{id}`

##### Set Active Tab

**Endpoint:** `PUT /api/tabs/active`

### Settings

##### Get Settings

**Endpoint:** `GET /api/settings`

##### Update Settings

**Endpoint:** `PUT /api/settings`

### File Management

##### Upload File

**Endpoint:** `POST /api/upload`

**Content-Type:** `multipart/form-data`

##### Download File

**Endpoint:** `GET /api/files/{filename}`

##### List Files

**Endpoint:** `GET /api/files`

##### Delete File

**Endpoint:** `DELETE /api/files/{filename}`

### Billing & Subscription

#### Preview Pricing

**Endpoint:** `GET /api/billing/preview`

**Response:**
```json
{
  "price": {
    "locale": "ja",
    "currency": "JPY",
    "unitAmount": 980,
    "interval": "month",
    "priceId": "price_xxx",
    "productName": "Qui Browser Premium"
  }
}
```

#### Create Checkout Session

**Endpoint:** `POST /api/billing/checkout`

**Request Body:**
```json
{
  "email": "user@example.com",
  "priceId": "price_xxx"
}
```

#### Admin Pricing Management

**Endpoint:** `GET /api/billing/pricing` (Admin only)

**Endpoint:** `POST /api/billing/pricing` (Admin only)

**Endpoint:** `DELETE /api/billing/pricing/{locale}` (Admin only)

### Monitoring & Admin

#### Insights

**Endpoint:** `GET /api/admin/insights` (Admin only)

**Response:**
```json
{
  "server": {
    "uptimeSeconds": 3600,
    "requestCount": 1000,
    "errorCount": 5,
    "version": "1.2.0"
  },
  "rateLimiting": {
    "global": {
      "limit": 100,
      "trackedClients": 50
    }
  },
  "monitoring": {
    "counters": {},
    "gauges": {}
  }
}
```

## WebSocket Endpoints

### Real-time Updates

**Endpoint:** `ws://localhost:8000`

**Supported Events:**

#### Client → Server
```json
{
  "type": "subscribe",
  "channels": ["metrics", "health"]
}
```

#### Server → Client
```json
{
  "type": "metrics_update",
  "data": {
    "cpu": 45.2,
    "memory": 67.8
  }
}
```

## Error Handling

All API endpoints return standard HTTP status codes:

- `200`: Success
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Too Many Requests
- `500`: Internal Server Error

Error responses include:

```json
{
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": {}
}
```

## Rate Limiting

API endpoints are protected by rate limiting:

- General endpoints: 100 requests per minute
- Admin endpoints: 30 requests per minute
- File upload: 10 requests per minute

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1634088060
```

## SDKs and Libraries

### JavaScript SDK

```javascript
import { QuiBrowser } from '@qui/browser-sdk';

// Initialize
const browser = new QuiBrowser({
  baseURL: 'https://your-domain.com',
  apiKey: 'your-api-key'
});

// Use automation features
await browser.automation.bookmarks.analyze({
  url: 'https://example.com',
  dwellTime: 300000
});

await browser.automation.tabs.optimize();
```

### Python SDK

```python
from qui_browser import QuiBrowser

browser = QuiBrowser(
    base_url='https://your-domain.com',
    api_key='your-api-key'
)

# Get automation settings
settings = browser.automation.get_settings()

# Optimize tabs
browser.automation.tabs.optimize()
```

## Changelog

### v1.2.0
- Added automation API endpoints
- Enhanced PWA support
- Improved cross-platform compatibility
- Added advanced security features

### v1.1.0
- Added billing and subscription management
- Enhanced monitoring and metrics
- Improved WebSocket support

### v1.0.0
- Initial release with core browser functionality

**Response:**

```json
{
  "status": "healthy",
  "uptime": 3600,
  "version": "1.1.0",
  "memory": {
    "used": 45000000,
    "total": 268435456
  },
  "cache": {
    "size": 42,
    "maxSize": 50
  }
}
```

**Status Codes:**

- `200 OK` - Server is healthy
- `503 Service Unavailable` - Server is unhealthy

---

### Performance Stats

Get real-time performance statistics.

**Endpoint:** `GET /api/stats`

**Response:**

```json
{
  "requests": {
    "total": 10000,
    "successful": 9800,
    "failed": 200,
    "errorRate": 0.02
  },
  "cache": {
    "hits": 8500,
    "misses": 1500,
    "hitRate": 0.85,
    "size": 45,
    "maxSize": 50
  },
  "performance": {
    "avgResponseTime": 25,
    "p95ResponseTime": 45,
    "p99ResponseTime": 78
  },
  "memory": {
    "heapUsed": 45000000,
    "heapTotal": 89000000,
    "rss": 156000000
  },
  "uptime": 3600
}
```

**Status Codes:**

- `200 OK` - Stats retrieved successfully

---

### Prometheus Metrics

Get Prometheus-compatible metrics.

**Endpoint:** `GET /metrics`

**Response:**

```
# HELP qui_browser_requests_total Total number of requests
# TYPE qui_browser_requests_total counter
qui_browser_requests_total 10000

# HELP qui_browser_cache_hit_rate Cache hit rate
# TYPE qui_browser_cache_hit_rate gauge
qui_browser_cache_hit_rate 0.85

# HELP qui_browser_response_time_ms Response time in milliseconds
# TYPE qui_browser_response_time_ms gauge
qui_browser_response_time_ms 25

# HELP qui_browser_memory_usage_bytes Memory usage in bytes
# TYPE qui_browser_memory_usage_bytes gauge
qui_browser_memory_usage_bytes 45000000
```

**Status Codes:**

- `200 OK` - Metrics retrieved successfully

---

### Billing - Create Checkout Session

Create a Stripe checkout session for subscription.

**Endpoint:** `POST /api/billing/create-checkout-session`

**Headers:**

```http
Content-Type: application/json
```

**Request Body:**

```json
{
  "locale": "ja-jp",
  "planType": "standard"
}
```

**Parameters:**

- `locale` (string, optional): Billing locale (default: `"default"`)
  - Supported: `default`, `en`, `ja-jp`, `es`, `zh`, `fr`, `de-de`, `ko`, `ar`,
    `hi`, `id`, `ru`, `pt-br`
- `planType` (string, optional): Plan type (default: `"standard"`)
  - Supported: `standard`, `premium`, `enterprise`

**Response:**

```json
{
  "sessionId": "cs_test_a1b2c3d4e5f6g7h8i9j0",
  "url": "https://checkout.stripe.com/pay/cs_test_a1b2c3d4e5f6g7h8i9j0"
}
```

**Status Codes:**

- `200 OK` - Session created successfully
- `400 Bad Request` - Invalid request body
- `500 Internal Server Error` - Stripe API error

---

### Billing - Webhook

Handle Stripe webhook events.

**Endpoint:** `POST /api/billing/webhook`

**Headers:**

```http
Content-Type: application/json
Stripe-Signature: t=1234567890,v1=abcdef123456...
```

**Events Handled:**

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

**Response:**

```json
{
  "received": true
}
```

**Status Codes:**

- `200 OK` - Webhook processed successfully
- `400 Bad Request` - Invalid signature or payload
- `500 Internal Server Error` - Processing error

---

### Billing - List Subscriptions (Admin)

List all active subscriptions.

**Endpoint:** `GET /api/billing/subscriptions`

**Headers:**

```http
Authorization: Bearer YOUR_ADMIN_TOKEN
```

**Response:**

```json
{
  "subscriptions": [
    {
      "sessionId": "cs_test_a1b2c3d4e5f6g7h8i9j0",
      "customerId": "cus_abc123",
      "subscriptionId": "sub_xyz789",
      "status": "active",
      "locale": "ja-jp",
      "planType": "standard",
      "createdAt": "2025-10-10T00:00:00.000Z"
    }
  ],
  "total": 1
}
```

**Status Codes:**

- `200 OK` - Subscriptions retrieved successfully
- `401 Unauthorized` - Missing or invalid admin token
- `429 Too Many Requests` - Rate limit exceeded

---

### Billing - Get Subscription (Admin)

Get subscription details by session ID.

**Endpoint:** `GET /api/billing/subscriptions/:sessionId`

**Headers:**

```http
Authorization: Bearer YOUR_ADMIN_TOKEN
```

**Response:**

```json
{
  "sessionId": "cs_test_a1b2c3d4e5f6g7h8i9j0",
  "customerId": "cus_abc123",
  "subscriptionId": "sub_xyz789",
  "status": "active",
  "locale": "ja-jp",
  "planType": "standard",
  "createdAt": "2025-10-10T00:00:00.000Z",
  "metadata": {
    "plan": "standard",
    "locale": "ja-jp"
  }
}
```

**Status Codes:**

- `200 OK` - Subscription retrieved successfully
- `401 Unauthorized` - Missing or invalid admin token
- `404 Not Found` - Subscription not found
- `429 Too Many Requests` - Rate limit exceeded

---

### Pricing Information

Get available pricing plans and localized prices.

**Endpoint:** `GET /api/pricing`

**Query Parameters:**

- `locale` (string, optional): Locale for pricing (e.g., `ja-jp`, `en`, `de-de`)

**Response:**

```json
{
  "locale": "ja-jp",
  "plans": {
    "standard": {
      "name": "Standard Plan",
      "priceId": "price_standard_jpy",
      "amount": 980,
      "currency": "JPY",
      "interval": "month"
    },
    "premium": {
      "name": "Premium Plan",
      "priceId": "price_premium_jpy",
      "amount": 1980,
      "currency": "JPY",
      "interval": "month"
    },
    "enterprise": {
      "name": "Enterprise Plan",
      "priceId": "price_enterprise_jpy",
      "amount": 9800,
      "currency": "JPY",
      "interval": "month"
    }
  }
}
```

**Status Codes:**

- `200 OK` - Pricing retrieved successfully

---

## WebSocket API

### Connection

Connect to the WebSocket server.

**Endpoint:** `ws://localhost:8000` (or configured port)

**Example (JavaScript):**

```javascript
const ws = new WebSocket('ws://localhost:8000');

ws.on('open', () => {
  console.log('Connected to WebSocket server');
});

ws.on('message', data => {
  const message = JSON.parse(data);
  console.log('Received:', message);
});
```

---

### Subscribe to Channel

Subscribe to a specific channel to receive updates.

**Message Type:** `subscribe`

**Payload:**

```json
{
  "type": "subscribe",
  "channel": "notifications"
}
```

**Response:**

```json
{
  "type": "subscribed",
  "channel": "notifications",
  "clientId": "client-abc123"
}
```

**Available Channels:**

- `notifications` - System notifications
- `metrics` - Real-time metrics updates
- `health` - Health status updates

---

### Unsubscribe from Channel

Unsubscribe from a channel.

**Message Type:** `unsubscribe`

**Payload:**

```json
{
  "type": "unsubscribe",
  "channel": "notifications"
}
```

**Response:**

```json
{
  "type": "unsubscribed",
  "channel": "notifications"
}
```

---

### Broadcast Message

Send a message to all subscribers of a channel.

**Message Type:** `broadcast`

**Payload:**

```json
{
  "type": "broadcast",
  "channel": "notifications",
  "data": {
    "message": "System maintenance in 5 minutes",
    "severity": "warning"
  }
}
```

---

### WebSocket Events

#### Connection Established

```json
{
  "type": "connected",
  "clientId": "client-abc123",
  "timestamp": "2025-10-10T00:00:00.000Z"
}
```

#### Error Event

```json
{
  "type": "error",
  "message": "Invalid message format",
  "code": "INVALID_MESSAGE"
}
```

#### Rate Limit Exceeded

```json
{
  "type": "error",
  "message": "Rate limit exceeded",
  "code": "RATE_LIMIT"
}
```

---

## Rate Limiting

### HTTP Endpoints

**Default Limits:**

- Rate: 100 requests per 60 seconds per IP
- Window: 60,000 ms (1 minute)

**Admin Endpoints:**

- Rate: 30 requests per 60 seconds per IP
- Window: 60,000 ms (1 minute)

**Response when rate limited:**

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60

{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

### WebSocket

**Default Limits:**

- Messages: 10 per second per client
- Connections: 100 concurrent connections

**Configuration:**

```bash
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
```

---

## Error Codes

### HTTP Error Codes

| Code | Message               | Description                          |
| ---- | --------------------- | ------------------------------------ |
| 400  | Bad Request           | Invalid request format or parameters |
| 401  | Unauthorized          | Missing or invalid authentication    |
| 404  | Not Found             | Resource not found                   |
| 405  | Method Not Allowed    | HTTP method not supported            |
| 414  | URI Too Long          | Request URI exceeds 2048 bytes       |
| 429  | Too Many Requests     | Rate limit exceeded                  |
| 500  | Internal Server Error | Server error                         |
| 503  | Service Unavailable   | Server unhealthy or overloaded       |

### WebSocket Error Codes

| Code | Message          | Description                        |
| ---- | ---------------- | ---------------------------------- |
| 1000 | Normal Closure   | Connection closed normally         |
| 1008 | Policy Violation | Server at capacity or rate limited |
| 1011 | Internal Error   | Server encountered an error        |

---

## Examples

### cURL Examples

#### Health Check

```bash
curl -X GET http://localhost:8000/health
```

#### Get Stats

```bash
curl -X GET http://localhost:8000/api/stats
```

#### Create Checkout Session

```bash
curl -X POST http://localhost:8000/api/billing/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{"locale":"ja-jp","planType":"standard"}'
```

#### List Subscriptions (Admin)

```bash
curl -X GET http://localhost:8000/api/billing/subscriptions \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

### JavaScript Examples

#### Fetch Stats

```javascript
async function getStats() {
  const response = await fetch('http://localhost:8000/api/stats');
  const stats = await response.json();
  console.log('Cache hit rate:', stats.cache.hitRate);
}
```

#### Create Checkout Session

```javascript
async function createCheckout(locale = 'ja-jp', planType = 'standard') {
  const response = await fetch('/api/billing/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ locale, planType })
  });

  const { url } = await response.json();
  window.location.href = url; // Redirect to Stripe checkout
}
```

#### WebSocket Connection

```javascript
const ws = new WebSocket('ws://localhost:8000');

ws.addEventListener('open', () => {
  // Subscribe to notifications
  ws.send(
    JSON.stringify({
      type: 'subscribe',
      channel: 'notifications'
    })
  );
});

ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);

  if (message.type === 'notification') {
    console.log('Notification:', message.data);
  }
});
```

---

### Python Examples

#### Get Health Status

```python
import requests

response = requests.get('http://localhost:8000/health')
health = response.json()
print(f"Status: {health['status']}, Uptime: {health['uptime']}s")
```

#### List Subscriptions (Admin)

```python
import requests

headers = {
    'Authorization': 'Bearer YOUR_ADMIN_TOKEN'
}

response = requests.get(
    'http://localhost:8000/api/billing/subscriptions',
    headers=headers
)

subscriptions = response.json()
print(f"Total subscriptions: {subscriptions['total']}")
```

---

## Best Practices

### API Usage

1. **Authentication**
   - Store admin tokens securely (environment variables, secrets manager)
   - Use HTTPS in production
   - Rotate tokens regularly

2. **Rate Limiting**
   - Implement exponential backoff for 429 responses
   - Cache responses when possible
   - Use WebSocket for real-time updates instead of polling

3. **Error Handling**
   - Always check response status codes
   - Implement retry logic with backoff
   - Log errors for debugging

4. **Performance**
   - Use compression (gzip/brotli) for large payloads
   - Implement client-side caching
   - Batch requests when possible

### WebSocket Best Practices

1. **Connection Management**
   - Implement reconnection logic
   - Handle connection errors gracefully
   - Close connections when not needed

2. **Message Format**
   - Always validate message format
   - Use JSON for structured data
   - Include message IDs for tracking

3. **Security**
   - Validate all incoming messages
   - Sanitize data before broadcasting
   - Implement authentication for sensitive channels

---

## Versioning

Current API version: **v1**

The API follows semantic versioning. Breaking changes will be introduced in new
major versions.

**Version Header:**

```http
X-API-Version: 1
```

---

## Support

For API support:

- GitHub Issues: https://github.com/qui-browser/qui-browser/issues
- Documentation: https://github.com/qui-browser/qui-browser/docs
- Security: security@qui-browser.example.com

---

**Last Updated**: 2025-10-10 **Version**: 1.1.0
