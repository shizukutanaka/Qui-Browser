# Qui Browser API Documentation

## Overview

Qui Browser provides a comprehensive REST API for managing bookmarks, browsing history, tabs, sessions, settings, file uploads, and system administration. The API is designed with security, performance, and scalability in mind.

## Base URL
```
http://localhost:8000
```

## Authentication

The API supports two authentication methods:

### Bearer Token Authentication
```http
Authorization: Bearer <your-jwt-token>
```

### API Key Authentication
```http
X-API-Key: <your-api-key>
```

## Response Format

All API responses follow a consistent JSON format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

Error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "requestId": "unique-request-id"
}
```

## API Endpoints

### Health Check

#### GET `/health`
Get system health status and metrics.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptimeSeconds": 3600,
  "requests": 150,
  "errors": 2,
  "memory": {
    "rss": 50000000,
    "heapTotal": 30000000,
    "heapUsed": 20000000
  }
}
```

### System Metrics

#### GET `/metrics`
Get system metrics in Prometheus format.

**Response:** Prometheus-formatted metrics text

---

## Bookmarks API

### Get Bookmarks
```http
GET /api/bookmarks
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "bookmarkId": "bm_123",
    "url": "https://example.com",
    "title": "Example Site",
    "description": "An example website",
    "tags": ["example", "test"],
    "folder": "Favorites",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Add Bookmark
```http
POST /api/bookmarks
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://example.com",
  "title": "Example Site",
  "description": "An example website",
  "tags": ["example"],
  "folder": "Favorites"
}
```

### Update Bookmark
```http
PUT /api/bookmarks/{bookmarkId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title",
  "tags": ["updated", "example"]
}
```

### Delete Bookmark
```http
DELETE /api/bookmarks/{bookmarkId}
Authorization: Bearer <token>
```

---

## History API

### Get History
```http
GET /api/history?limit=50&offset=0
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Maximum items to return (default: 100, max: 1000)
- `offset` (optional): Items to skip (default: 0)

**Response:**
```json
[
  {
    "historyId": "h_123",
    "url": "https://example.com",
    "title": "Example Page",
    "visitCount": 5,
    "lastVisit": "2024-01-01T12:00:00.000Z",
    "createdAt": "2024-01-01T10:00:00.000Z"
  }
]
```

### Clear History
```http
DELETE /api/history
Authorization: Bearer <token>
```

---

## Tabs API

### Get Tabs
```http
GET /api/tabs
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "tabId": "tab_123",
    "url": "https://example.com",
    "title": "Example Page",
    "favicon": "data:image/png;base64,...",
    "loading": false,
    "canGoBack": true,
    "canGoForward": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Create Tab
```http
POST /api/tabs
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://example.com",
  "title": "New Tab"
}
```

### Set Active Tab
```http
PUT /api/tabs/active
Authorization: Bearer <token>
Content-Type: application/json

{
  "tabId": "tab_123"
}
```

### Close Tab
```http
DELETE /api/tabs/{tabId}
Authorization: Bearer <token>
```

---

## Sessions API

### Get Sessions
```http
GET /api/sessions
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "sessionId": "sess_123",
    "name": "Work Session",
    "tabs": [...],
    "windows": [...],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Save Session
```http
POST /api/sessions
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Session",
  "tabs": [...],
  "windows": [...]
}
```

### Restore Session
```http
PUT /api/sessions/{sessionId}/restore
Authorization: Bearer <token>
```

### Delete Session
```http
DELETE /api/sessions/{sessionId}
Authorization: Bearer <token>
```

---

## Settings API

### Get Settings
```http
GET /api/settings
Authorization: Bearer <token>
```

**Response:**
```json
{
  "theme": "dark",
  "language": "en",
  "privacy": {
    "blockTrackers": true,
    "clearHistoryOnExit": false
  },
  "performance": {
    "hardwareAcceleration": true,
    "preloadPages": true
  }
}
```

### Update Settings
```http
PUT /api/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "theme": "light",
  "privacy": {
    "blockTrackers": false
  }
}
```

---

## Search API

### Search
```http
GET /api/search?q=example&type=all&limit=50
Authorization: Bearer <token>
```

**Query Parameters:**
- `q`: Search query (required)
- `type`: Content type - `bookmarks`, `history`, `tabs`, or `all` (default: `all`)
- `limit`: Maximum results (default: 50, max: 100)

**Response:**
```json
{
  "query": "example",
  "total": 15,
  "bookmarks": [...],
  "history": [...],
  "tabs": [...]
}
```

---

## Files API

### Upload Files
```http
POST /api/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

files: [file1, file2, ...]
```

**Response:**
```json
{
  "message": "2 files uploaded successfully",
  "files": [
    {
      "fileId": "file_123",
      "originalName": "document.pdf",
      "secureName": "document_12345_abc.pdf",
      "size": 1024000,
      "mimetype": "application/pdf",
      "extension": ".pdf",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### List Files
```http
GET /api/files?extension=.pdf&limit=100
Authorization: Bearer <token>
```

**Query Parameters:**
- `extension`: Filter by file extension
- `limit`: Maximum files to return

**Response:**
```json
{
  "files": [
    {
      "fileId": "file_123",
      "originalName": "document.pdf",
      "size": 1024000,
      "mimetype": "application/pdf",
      "extension": ".pdf",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Download File
```http
GET /api/files/{fileId}
Authorization: Bearer <token>
```

Returns the file as binary data with appropriate headers.

### Delete File
```http
DELETE /api/files/{fileId}
Authorization: Bearer <token>
```

---

## Billing API

### Get Pricing Preview
```http
GET /api/billing/preview?locale=en&currency=usd
```

**Response:**
```json
{
  "locale": "en",
  "currency": "USD",
  "unitAmount": 999,
  "interval": "month",
  "priceId": "price_123",
  "productName": "Qui Browser Premium"
}
```

### Get Pricing Configuration (Admin)
```http
GET /api/billing/pricing
Authorization: Bearer <admin-token>
```

### Update Pricing (Admin)
```http
POST /api/billing/pricing
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "locale": "en",
  "priceId": "price_123",
  "currency": "USD",
  "unitAmount": 999,
  "interval": "month"
}
```

### Delete Pricing (Admin)
```http
DELETE /api/billing/pricing/{locale}
Authorization: Bearer <admin-token>
```

---

## Admin API

### Admin Insights
```http
GET /api/admin/insights
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "server": {
    "uptimeMs": 3600000,
    "totalRequests": 15000,
    "totalErrors": 15,
    "avgResponseTimeMs": 45
  },
  "rateLimiting": {
    "global": {
      "limit": 100,
      "windowMs": 60000,
      "trackedClients": 50
    }
  },
  "monitoring": { ... },
  "alerts": [ ... ],
  "traces": [ ... ],
  "notifications": {
    "dispatched": 5,
    "failed": 0,
    "lastDispatchAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `BAD_REQUEST` | Invalid request data |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Access denied |
| `NOT_FOUND` | Resource not found |
| `RATE_LIMITED` | Too many requests |
| `VALIDATION_ERROR` | Input validation failed |
| `SERVER_ERROR` | Internal server error |

---

## Rate Limiting

The API implements intelligent rate limiting:

- **Global limits**: 100 requests per minute per IP
- **Endpoint-specific limits**: Vary by endpoint complexity
- **Burst allowance**: Up to 1000 requests in short bursts
- **User-based limits**: Additional limits for authenticated users

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2024-01-01T00:01:00.000Z
```

---

## File Upload Limits

- **Maximum file size**: 10MB per file
- **Allowed file types**: Images, PDFs, text files, archives
- **Maximum files per upload**: 10 files
- **Storage**: Secure file storage with integrity checking

---

## Data Export/Import

### Export Data
```http
GET /api/export?type=all&format=json
Authorization: Bearer <token>
```

### Import Data
```http
POST /api/import
Authorization: Bearer <token>
Content-Type: application/json

{
  "data": { ... },
  "type": "bookmarks"
}
```

---

## WebSocket Support

Qui Browser supports real-time communication via WebSocket:

```javascript
const ws = new WebSocket('ws://localhost:8000/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

// Send a message
ws.send(JSON.stringify({
  type: 'tab_update',
  tabId: 'tab_123',
  url: 'https://example.com'
}));
```

---

## SDKs and Libraries

### JavaScript SDK
```bash
npm install qui-browser-sdk
```

```javascript
import { QuiBrowser } from 'qui-browser-sdk';

const client = new QuiBrowser({
  baseURL: 'http://localhost:8000',
  apiKey: 'your-api-key'
});

// Get bookmarks
const bookmarks = await client.bookmarks.get();

// Add bookmark
await client.bookmarks.add({
  url: 'https://example.com',
  title: 'Example'
});
```

### Python SDK
```bash
pip install qui-browser-py
```

```python
from qui_browser import QuiBrowser

client = QuiBrowser(
    base_url='http://localhost:8000',
    api_key='your-api-key'
)

# Get history
history = client.history.get(limit=50)
```

---

## Changelog

### Version 1.1.0
- Added comprehensive API documentation
- Enhanced security with advanced rate limiting
- Added file upload and management
- Improved error handling and validation
- Added WebSocket support for real-time features

### Version 1.0.0
- Initial release with core bookmark, history, and session management
- Basic authentication and authorization
- Health monitoring and metrics

---

## Support

For API support and questions:
- **Documentation**: https://docs.qui-browser.com
- **API Reference**: https://api.qui-browser.com/docs
- **GitHub Issues**: https://github.com/qui-browser/issues
- **Email**: api-support@qui-browser.com

## License

This API documentation is licensed under the MIT License.
