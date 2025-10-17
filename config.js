/**
 * Qui Browser - Lightweight Configuration
 */

const { URL } = require('url');

const DEFAULT_HEALTH_THRESHOLDS = {
  memoryWarning: 0.8,
  memoryCritical: 0.9,
  heapWarning: 0.85,
  heapCritical: 0.95,
  cpuWarning: 0.7,
  cpuCritical: 0.9,
  eventLoopLagWarningMs: 200,
  eventLoopLagCriticalMs: 500
};

const DEFAULT_HEALTH_INTERVALS = {
  sampleIntervalMs: 30000,
  eventLoopSampleMs: 200
};

const DEFAULT_BACKUP_EXCLUDE_PATTERNS = ['.env', '.env.local', 'node_modules/**', '.git/**', 'logs/**', 'tmp/**'];

const DEFAULT_LOG_SANITIZED_HEADERS = ['authorization', 'cookie', 'set-cookie', 'x-api-key', 'x-access-token'];

const DEFAULT_LOG_SANITIZED_BODY_FIELDS = ['password', 'token', 'secret', 'accesstoken', 'refreshtoken'];

const DEFAULT_LOG_SANITIZED_QUERY_FIELDS = [
  'password',
  'token',
  'secret',
  'accesstoken',
  'refreshtoken',
  'auth',
  'apikey'
];

function parseJsonEnv(envKey, defaultValue) {
  const raw = process.env[envKey];
  if (!raw) {
    return defaultValue;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
    return defaultValue;
  } catch (error) {
    console.warn(`[config] Failed to parse JSON from ${envKey}: ${error.message}`);
    return defaultValue;
  }
}

function parseNumberEnv(envKey, defaultValue, min = -Infinity, max = Infinity) {
  const raw = process.env[envKey];
  if (raw === undefined) {
    return defaultValue;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return defaultValue;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function parsePercentEnv(envKey, defaultValue) {
  const value = parseNumberEnv(envKey, defaultValue);
  if (!Number.isFinite(value)) {
    return defaultValue;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function parseListEnv(envKey, defaultValue = []) {
  const jsonValue = parseJsonEnv(envKey, null);
  if (Array.isArray(jsonValue)) {
    return jsonValue;
  }
  const raw = process.env[envKey];
  if (!raw) {
    return Array.isArray(defaultValue) ? defaultValue : [];
  }
  return raw
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
}

function filterWebhookUrls(candidates) {
  if (!Array.isArray(candidates)) {
    return [];
  }

  const unique = new Set();
  for (const hook of candidates) {
    if (typeof hook !== 'string') {
      continue;
    }
    const trimmed = hook.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed = new URL(trimmed);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        console.warn(`[config] Skipping webhook due to unsupported scheme: ${trimmed}`);
        continue;
      }
      unique.add(trimmed);
    } catch (error) {
      console.warn(`[config] Skipping invalid webhook URL (${trimmed}): ${error.message}`);
    }
  }

  return Array.from(unique);
}

class Config {
  constructor() {
    this.config = {
      server: {
        port: parseNumberEnv('PORT', 8000, 1, 65535),
        host: process.env.HOST || '0.0.0.0',
        nodeEnv: process.env.NODE_ENV || 'development',
        trustProxy: process.env.TRUST_PROXY === 'true'
      },
      performance: {
        cacheMaxSize: 100,
        cacheTTL: 60000,
        rateLimitMax: 60,
        rateLimitWindow: 60000,
        rateLimitBurst: parseNumberEnv('RATE_LIMIT_BURST', 0),
        rateLimitMaxEntries: parseNumberEnv('RATE_LIMIT_MAX_ENTRIES', 1000),
        compressionThreshold: parseNumberEnv('COMPRESSION_THRESHOLD', 1024),
        staticCache: {
          defaultMaxAge: parseNumberEnv('STATIC_DEFAULT_MAX_AGE', 60),
          immutableTypes: parseListEnv('STATIC_IMMUTABLE_TYPES', ['.js', '.css', '.png', '.jpg', '.jpeg', '.svg']),
          immutableMaxAge: parseNumberEnv('STATIC_IMMUTABLE_MAX_AGE', 86400)
        }
      },
      security: {
        enableHeaders: process.env.ENABLE_SECURITY_HEADERS === 'true',
        cspPreset: (process.env.CSP_PRESET || 'standard').toLowerCase(),
        cspReportUri: process.env.CSP_REPORT_URI || null,
        cspReportOnly: process.env.CSP_REPORT_ONLY === 'true',
        cspCustomDirectives: parseJsonEnv('CSP_CUSTOM_DIRECTIVES', {}),
        cspAdditionalDirectives: parseJsonEnv('CSP_ADDITIONAL_DIRECTIVES', {}),
        cors: {
          enabled: process.env.CORS_ENABLED === 'true',
          allowedOrigins: parseListEnv('CORS_ALLOWED_ORIGINS', ['*']),
          allowedMethods: parseListEnv('CORS_ALLOWED_METHODS', ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS']),
          allowedHeaders: parseListEnv('CORS_ALLOWED_HEADERS', ['Content-Type', 'Authorization', 'X-Requested-With']),
          exposedHeaders: parseListEnv('CORS_EXPOSED_HEADERS', []),
          allowCredentials: process.env.CORS_ALLOW_CREDENTIALS === 'true',
          maxAge: parseNumberEnv('CORS_MAX_AGE', 600)
        },
        hsts: {
          maxAgeSeconds: parseNumberEnv('HSTS_MAX_AGE_SECONDS', 31536000),
          includeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS !== 'false',
          preload: process.env.HSTS_PRELOAD === 'true',
          forceOnHttp: process.env.HSTS_FORCE_ON_HTTP === 'true'
        }
      },
      logging: {
        sanitizeHeaders: process.env.LOG_SANITIZED_HEADERS === 'true',
        sanitizeBody: process.env.LOG_SANITIZED_BODY === 'true',
        sanitizedHeaderFields: Array.from(
          new Set(
            [...DEFAULT_LOG_SANITIZED_HEADERS, ...parseListEnv('LOG_SANITIZED_HEADER_FIELDS', [])]
              .filter(Boolean)
              .map(field => field.toLowerCase())
          )
        ),
        sanitizedBodyFields: Array.from(
          new Set(
            [...DEFAULT_LOG_SANITIZED_BODY_FIELDS, ...parseListEnv('LOG_SANITIZED_BODY_FIELDS', [])]
              .filter(Boolean)
              .map(field => field.toLowerCase())
          )
        ),
        sanitizedQueryFields: Array.from(
          new Set(
            [...DEFAULT_LOG_SANITIZED_QUERY_FIELDS, ...parseListEnv('LOG_SANITIZED_QUERY_FIELDS', [])]
              .filter(Boolean)
              .map(field => field.toLowerCase())
          )
        )
      },
      health: {
        sampleIntervalMs: Math.max(
          5000,
          parseNumberEnv('HEALTH_SAMPLE_INTERVAL_MS', DEFAULT_HEALTH_INTERVALS.sampleIntervalMs)
        ),
        eventLoopSampleMs: Math.max(
          50,
          parseNumberEnv('HEALTH_EVENT_LOOP_SAMPLE_MS', DEFAULT_HEALTH_INTERVALS.eventLoopSampleMs)
        ),
        memoryWarning: parsePercentEnv('HEALTH_MEMORY_WARNING', DEFAULT_HEALTH_THRESHOLDS.memoryWarning),
        memoryCritical: parsePercentEnv('HEALTH_MEMORY_CRITICAL', DEFAULT_HEALTH_THRESHOLDS.memoryCritical),
        heapWarning: parsePercentEnv('HEALTH_HEAP_WARNING', DEFAULT_HEALTH_THRESHOLDS.heapWarning),
        heapCritical: parsePercentEnv('HEALTH_HEAP_CRITICAL', DEFAULT_HEALTH_THRESHOLDS.heapCritical),
        cpuWarning: parsePercentEnv('HEALTH_CPU_WARNING', DEFAULT_HEALTH_THRESHOLDS.cpuWarning),
        cpuCritical: parsePercentEnv('HEALTH_CPU_CRITICAL', DEFAULT_HEALTH_THRESHOLDS.cpuCritical),
        eventLoopLagWarningMs: Math.max(
          0,
          parseNumberEnv('HEALTH_EVENT_LOOP_WARNING_MS', DEFAULT_HEALTH_THRESHOLDS.eventLoopLagWarningMs)
        ),
        eventLoopLagCriticalMs: Math.max(
          0,
          parseNumberEnv('HEALTH_EVENT_LOOP_CRITICAL_MS', DEFAULT_HEALTH_THRESHOLDS.eventLoopLagCriticalMs)
        )
      },
      notifications: {
        enabled: process.env.NOTIFICATION_ENABLED === 'true',
        webhooks: filterWebhookUrls(parseListEnv('NOTIFICATION_WEBHOOKS', [])),
        minLevel: (process.env.NOTIFICATION_MIN_LEVEL || 'error').toLowerCase(),
        timeoutMs: Number(process.env.NOTIFICATION_TIMEOUT_MS) || 5000,
        batchWindowMs: Number(process.env.NOTIFICATION_BATCH_WINDOW_MS) || 0
      },
      backup: {
        enabled: process.env.BACKUP_ENABLED === 'true',
        cron: process.env.BACKUP_CRON || null,
        intervalMs: Number(process.env.BACKUP_INTERVAL_MS) || 6 * 60 * 60 * 1000,
        retention: Number(process.env.BACKUP_RETENTION) || 10,
        retentionMaxAgeDays: Number(process.env.BACKUP_RETENTION_MAX_AGE_DAYS) || null,
        directories: parseListEnv('BACKUP_DIRECTORIES', ['data']),
        excludePatterns: Array.from(
          new Set([...DEFAULT_BACKUP_EXCLUDE_PATTERNS, ...parseListEnv('BACKUP_EXCLUDE_PATTERNS', [])])
        ),
        destination: process.env.BACKUP_DESTINATION || 'backups',
        compress: process.env.BACKUP_COMPRESS === 'true',
        verifyAfterCreate: process.env.BACKUP_VERIFY === 'true'
      }
    };
  }

  get(path, defaultValue) {
    const keys = path.split('.');
    let value = this.config;
    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) {
        return defaultValue;
      }
    }
    return value;
  }
}
