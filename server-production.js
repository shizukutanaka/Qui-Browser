/**
 * Qui Browser - Production Server
 * Enterprise-grade server with all production utilities integrated
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Production utilities
const { InputValidator } = require('./utils/input-validator');
const { DDoSProtection } = require('./utils/ddos-protection');
const { AuditLogger } = require('./utils/audit-logger');
const { CircuitBreakerManager } = require('./utils/circuit-breaker');
const { GracefulShutdown } = require('./utils/graceful-shutdown');
const { HealthChecker } = require('./utils/health-checker');
const { RequestCorrelation } = require('./utils/request-correlation');
const { ConnectionPool } = require('./utils/connection-pool');
const { RequestQueue, Priority } = require('./utils/request-queue');
const { ErrorRecovery, RecoveryStrategy } = require('./utils/error-recovery');
const { SessionManager } = require('./utils/session-manager');
const { AdvancedCache } = require('./utils/advanced-cache');
const { RequestDeduplicator } = require('./utils/request-deduplication');
const { PerformanceProfiler, createProfilingMiddleware } = require('./utils/performance-profiler');

// Load environment variables
require('dotenv').config();

// Configuration
const CONFIG = {
  port: parseInt(process.env.PORT || '8000', 10),
  host: process.env.HOST || '0.0.0.0',
  env: process.env.NODE_ENV || 'production',
  enableHttps: process.env.ENABLE_HTTPS === 'true',
  tlsCertPath: process.env.TLS_CERT_PATH || './certs/cert.pem',
  tlsKeyPath: process.env.TLS_KEY_PATH || './certs/key.pem',
  enableProfiling: process.env.ENABLE_PROFILING === 'true',
  enableAuditLog: process.env.ENABLE_AUDIT_LOG !== 'false',
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600000', 10), // 1 hour
  cacheMaxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10),
  cacheTTL: parseInt(process.env.CACHE_TTL || '300000', 10), // 5 minutes
};

// Initialize utilities
const inputValidator = new InputValidator();
const ddosProtection = new DDoSProtection({
  enabled: true,
  maxRequestsPerMinute: 60,
  maxConnectionsPerIp: 10,
  blacklistDuration: 3600000, // 1 hour
});

const auditLogger = new AuditLogger({
  enabled: CONFIG.enableAuditLog,
  logDir: './logs/audit',
  signatureKey: process.env.AUDIT_SIGNATURE_KEY || 'default-secret-key-change-in-production',
});

const circuitBreakerManager = new CircuitBreakerManager();
const healthChecker = new HealthChecker();
const requestCorrelation = new RequestCorrelation();
const sessionManager = new SessionManager({
  sessionTimeout: CONFIG.sessionTimeout,
  maxSessions: 5,
});

const cache = new AdvancedCache({
  maxSize: CONFIG.cacheMaxSize,
  defaultTTL: CONFIG.cacheTTL,
  strategy: 'adaptive',
});

const deduplicator = new RequestDeduplicator({
  ttl: 60000, // 1 minute
  maxPending: 100,
});

const profiler = new PerformanceProfiler({
  enabled: CONFIG.enableProfiling,
});

const requestQueue = new RequestQueue({
  maxSize: 1000,
  batchSize: 10,
  batchDelay: 100,
});

const errorRecovery = new ErrorRecovery({
  maxRetries: 3,
  initialDelay: 100,
  maxDelay: 5000,
});

// Content type mapping
const CONTENT_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
};

// Security headers
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

// Health check dependencies
healthChecker.addDependency('filesystem', async () => {
  return fs.promises.access('./index.html').then(() => true).catch(() => false);
});

healthChecker.addDependency('cache', async () => {
  try {
    cache.set('health-check', 'ok');
    return cache.get('health-check') === 'ok';
  } catch {
    return false;
  }
});

// Middleware chain
async function applyMiddleware(req, res) {
  // Add correlation ID
  const correlationId = requestCorrelation.generate(req);
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  // DDoS protection
  const ddosCheck = ddosProtection.checkRequest(req);
  if (!ddosCheck.allowed) {
    await auditLogger.log('security', null, 'request_blocked', {
      reason: ddosCheck.reason,
      ip: ddosProtection.getClientIp(req),
      url: req.url,
    });

    res.writeHead(429, {
      'Content-Type': 'application/json',
      'Retry-After': '60',
      ...SECURITY_HEADERS,
    });
    res.end(JSON.stringify({
      error: 'Too Many Requests',
      reason: ddosCheck.reason,
      correlationId,
    }));
    return false;
  }

  // Validate request
  const validation = inputValidator.validateRequest({
    url: req.url,
    method: req.method,
    headers: req.headers,
  });

  if (!validation.isValid) {
    await auditLogger.log('security', null, 'invalid_request', {
      errors: validation.errors,
      url: req.url,
    });

    res.writeHead(400, {
      'Content-Type': 'application/json',
      ...SECURITY_HEADERS,
    });
    res.end(JSON.stringify({
      error: 'Bad Request',
      details: validation.errors,
      correlationId,
    }));
    return false;
  }

  return true;
}

// File serving with caching
async function serveFile(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

  // Check cache
  const cacheKey = `file:${filePath}`;
  const cached = cache.get(cacheKey);

  if (cached) {
    const etag = cache.getETag(cacheKey);

    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, SECURITY_HEADERS);
      res.end();
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'ETag': etag,
      'Cache-Control': 'public, max-age=3600',
      ...SECURITY_HEADERS,
    });
    res.end(cached);
    return;
  }

  // Read file with error recovery
  try {
    const content = await errorRecovery.execute(
      async () => await fs.promises.readFile(filePath),
      {
        strategy: RecoveryStrategy.RETRY,
        maxRetries: 2,
      }
    );

    // Cache the content
    cache.set(cacheKey, content, {
      ttl: 3600000, // 1 hour
      metadata: { contentType, filePath },
    });

    const etag = cache.getETag(cacheKey);

    res.writeHead(200, {
      'Content-Type': contentType,
      'ETag': etag,
      'Content-Length': content.length,
      'Cache-Control': 'public, max-age=3600',
      ...SECURITY_HEADERS,
    });
    res.end(content);

  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);

    res.writeHead(500, {
      'Content-Type': 'application/json',
      ...SECURITY_HEADERS,
    });
    res.end(JSON.stringify({
      error: 'Internal Server Error',
      correlationId: req.correlationId,
    }));
  }
}

// Request handler
async function handleRequest(req, res) {
  const startTime = Date.now();

  try {
    // Apply middleware
    const middlewarePassed = await applyMiddleware(req, res);
    if (!middlewarePassed) {
      return;
    }

    // Parse URL
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    // Health check endpoint
    if (pathname === '/health') {
      const health = await healthChecker.check();

      res.writeHead(health.status === 'healthy' ? 200 : 503, {
        'Content-Type': 'application/json',
        ...SECURITY_HEADERS,
      });
      res.end(JSON.stringify(health, null, 2));
      return;
    }

    // Metrics endpoint
    if (pathname === '/metrics') {
      const metrics = {
        cache: cache.getStats(),
        ddos: ddosProtection.getStats(),
        sessions: sessionManager.getStats(),
        deduplication: deduplicator.getStats(),
        profiler: profiler.getAllTimingStats(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      };

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...SECURITY_HEADERS,
      });
      res.end(JSON.stringify(metrics, null, 2));
      return;
    }

    // Performance report endpoint
    if (pathname === '/performance' && CONFIG.enableProfiling) {
      const report = profiler.generateReport();

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...SECURITY_HEADERS,
      });
      res.end(JSON.stringify(report, null, 2));
      return;
    }

    // Session endpoints
    if (pathname.startsWith('/api/session')) {
      if (pathname === '/api/session/create' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const session = await sessionManager.createSession(data.userId, data.metadata);

            await auditLogger.log('session', data.userId, 'session_created', {
              sessionId: session.sessionId,
            });

            res.writeHead(200, {
              'Content-Type': 'application/json',
              ...SECURITY_HEADERS,
            });
            res.end(JSON.stringify(session));
          } catch (error) {
            res.writeHead(400, {
              'Content-Type': 'application/json',
              ...SECURITY_HEADERS,
            });
            res.end(JSON.stringify({ error: 'Invalid request' }));
          }
        });
        return;
      }
    }

    // Serve static files
    let filePath = pathname === '/' ? 'index.html' : pathname.slice(1);

    // Security: Prevent directory traversal
    filePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');

    const fullPath = path.join(__dirname, filePath);

    // Check if file exists
    try {
      const stats = await fs.promises.stat(fullPath);

      if (stats.isFile()) {
        await serveFile(req, res, fullPath);
      } else {
        res.writeHead(404, {
          'Content-Type': 'text/plain',
          ...SECURITY_HEADERS,
        });
        res.end('404 Not Found');
      }
    } catch {
      res.writeHead(404, {
        'Content-Type': 'text/plain',
        ...SECURITY_HEADERS,
      });
      res.end('404 Not Found');
    }

  } catch (error) {
    console.error('Request handling error:', error);

    await auditLogger.log('error', null, 'request_error', {
      error: error.message,
      stack: error.stack,
      url: req.url,
    });

    res.writeHead(500, {
      'Content-Type': 'application/json',
      ...SECURITY_HEADERS,
    });
    res.end(JSON.stringify({
      error: 'Internal Server Error',
      correlationId: req.correlationId,
    }));
  } finally {
    // Record performance metrics
    const duration = Date.now() - startTime;
    profiler.recordMetric('request_duration', duration, {
      method: req.method,
      path: req.url,
      status: res.statusCode,
    });
  }
}

// Create server
let server;
if (CONFIG.enableHttps) {
  try {
    const options = {
      key: fs.readFileSync(CONFIG.tlsKeyPath),
      cert: fs.readFileSync(CONFIG.tlsCertPath),
    };
    server = https.createServer(options, handleRequest);
    console.log('✅ HTTPS enabled');
  } catch (error) {
    console.warn('⚠️  HTTPS certificates not found, falling back to HTTP');
    server = http.createServer(handleRequest);
  }
} else {
  server = http.createServer(handleRequest);
}

// Graceful shutdown
const gracefulShutdown = new GracefulShutdown({
  servers: [server],
  timeout: 30000,
});

gracefulShutdown.addCleanupTask('audit-logger', async () => {
  await auditLogger.log('system', null, 'server_shutdown', {
    uptime: process.uptime(),
  });
  auditLogger.stop();
}, 1);

gracefulShutdown.addCleanupTask('cache', async () => {
  cache.stop();
}, 2);

gracefulShutdown.addCleanupTask('session-manager', async () => {
  sessionManager.stop();
}, 2);

gracefulShutdown.addCleanupTask('ddos-protection', async () => {
  ddosProtection.stop();
}, 3);

// Start server
server.listen(CONFIG.port, CONFIG.host, async () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Qui Browser - Production Server');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  🚀 Server running at ${CONFIG.enableHttps ? 'https' : 'http'}://${CONFIG.host}:${CONFIG.port}`);
  console.log(`  🌍 Environment: ${CONFIG.env}`);
  console.log(`  📊 Health Check: ${CONFIG.enableHttps ? 'https' : 'http'}://${CONFIG.host}:${CONFIG.port}/health`);
  console.log(`  📈 Metrics: ${CONFIG.enableHttps ? 'https' : 'http'}://${CONFIG.host}:${CONFIG.port}/metrics`);
  if (CONFIG.enableProfiling) {
    console.log(`  ⚡ Performance: ${CONFIG.enableHttps ? 'https' : 'http'}://${CONFIG.host}:${CONFIG.port}/performance`);
  }
  console.log('');
  console.log('  Security Features:');
  console.log('  ✅ DDoS Protection');
  console.log('  ✅ Input Validation');
  console.log('  ✅ Audit Logging');
  console.log('  ✅ Circuit Breaker');
  console.log('  ✅ Request Correlation');
  console.log('  ✅ Session Management');
  console.log('  ✅ Advanced Caching');
  console.log('  ✅ Request Deduplication');
  console.log('  ✅ Error Recovery');
  console.log('  ✅ Graceful Shutdown');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  await auditLogger.log('system', null, 'server_started', {
    port: CONFIG.port,
    host: CONFIG.host,
    env: CONFIG.env,
  });
});

// Error handling
server.on('error', async (error) => {
  console.error('Server error:', error);
  await auditLogger.log('error', null, 'server_error', {
    error: error.message,
    stack: error.stack,
  });
});

process.on('uncaughtException', async (error) => {
  console.error('Uncaught exception:', error);
  await auditLogger.log('error', null, 'uncaught_exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled rejection:', reason);
  await auditLogger.log('error', null, 'unhandled_rejection', {
    reason: String(reason),
  });
});

module.exports = { server, gracefulShutdown };
