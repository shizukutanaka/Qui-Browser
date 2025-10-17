/**
 * Qui Browser - TypeScript Type Definitions
 * @module types
 * @version 1.1.0
 */

declare module 'qui-browser' {
  /**
   * Server configuration options
   */
  export interface ServerConfig {
    port?: number;
    host?: string;
    maxRequestsPerMinute?: number;
    cacheMaxSize?: number;
    cacheTTL?: number;
    compressionThreshold?: number;
    secureHeaders?: boolean;
  }

  export interface NotificationStats {
    dispatched: number;
    failed: number;
    lastDispatchAt: number | null;
  }

  export interface NotificationDispatcherConfig {
    enabled?: boolean;
    webhooks?: string[];
    minLevel?: 'info' | 'warning' | 'error';
    timeoutMs?: number;
    batchWindowMs?: number;
    retryLimit?: number;
    retryBackoffMs?: number;
  }

  export interface NotificationEvent {
    level?: 'info' | 'warning' | 'error';
    type?: string;
    title?: string;
    data?: unknown;
  }

  /**
   * Cache entry structure
   */
  export interface CacheEntry {
    data: Buffer | string;
    headers: Record<string, string>;
    timestamp: number;
  }

  /**
   * Health check status
   */
  export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    memory: MemoryInfo;
    cpu: CPUInfo;
    eventLoop: EventLoopInfo;
    timestamp: number;
  }

  export interface MemoryInfo {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
    heapPercentage: number;
  }

  export interface CPUInfo {
    usage: number;
    loadAverage: number[];
  }

  export interface EventLoopInfo {
    lag: number;
    status: 'good' | 'warning' | 'critical';
  }

  /**
   * Server statistics
   */
  export interface ServerStats {
    uptime: number;
    requestCount: number;
    cacheHitRate: number;
    cache: {
      size: number;
      maxSize: number;
      hitRate: number;
    };
    health: HealthStatus;
    performance?: PerformanceMetrics;
  }

  export interface PerformanceMetrics {
    responseTime: {
      avg: number;
      p50: number;
      p95: number;
      p99: number;
    };
    cache: {
      hitRate: number;
      size: number;
    };
  }

  /**
   * Rate limiter configuration
   */
  export interface RateLimiterConfig {
    maxRequests?: number;
    windowMs?: number;
  }

  /**
   * Rate limit result
   */
  export interface RateLimitResult {
    allowed: boolean;
    retryAfterSeconds?: number;
  }

  /**
   * Compression options
   */
  export interface CompressionOptions {
    threshold?: number;
    level?: number;
    preferBrotli?: boolean;
  }

  /**
   * Security headers configuration
   */
  export interface SecurityHeadersConfig {
    csp?: string;
    hsts?: boolean;
    xssProtection?: boolean;
    frameOptions?: 'DENY' | 'SAMEORIGIN';
    contentTypeNosniff?: boolean;
  }

  /**
   * WebSocket server configuration
   */
  export interface WebSocketConfig {
    maxConnections?: number;
    heartbeatInterval?: number;
    messageRateLimit?: number;
    maxMessageSize?: number;
  }

  /**
   * WebSocket message structure
   */
  export interface WebSocketMessage {
    type: string;
    channel?: string;
    data?: unknown;
    timestamp?: number;
  }

  /**
   * Cache manager interface
   */
  export class CacheManager {
    constructor(config?: { maxSize?: number; ttl?: number });
    get(key: string): CacheEntry | null;
    set(key: string, data: Buffer | string, headers: Record<string, string>): void;
    cleanup(): void;
    autoTune(): void;
    getStats(): {
      size: number;
      maxSize: number;
      hitRate: number;
      totalHits: number;
      totalMisses: number;
    };
  }

  /**
   * Rate limiter interface
   */
  export class RateLimiter {
    constructor(config?: RateLimiterConfig);
    check(clientIP: string, traceId?: string | null): RateLimitResult;
    cleanup(): void;
    getStats(): {
      totalClients: number;
      totalRequests: number;
    };
  }

  /**
   * Lightweight browser server
   */
  export class LightweightBrowserServer {
    constructor(config?: ServerConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
    getStats(): ServerStats;
    getHealth(): HealthStatus;
    getNotificationStats(): NotificationStats;
  }

  /**
   * WebSocket server
   */
  export class WebSocketServer {
    constructor(config?: WebSocketConfig);
    start(httpServer: import('http').Server): void;
    broadcast(message: WebSocketMessage): void;
    getStats(): {
      activeConnections: number;
      totalMessages: number;
      channels: number;
    };
  }

  /**
   * Utility functions
   */
  export namespace Utils {
    /**
     * Compress response data
     */
    export function compressResponse(
      data: Buffer | string,
      acceptEncoding: string,
      options?: CompressionOptions
    ): Promise<{
      data: Buffer;
      encoding: string;
      originalSize: number;
      compressedSize: number;
    }>;

    /**
     * Generate ETag for content
     */
    export function generateETag(content: Buffer | string): string;

    /**
     * Validate security headers
     */
    export function validateSecurityHeaders(
      headers: Record<string, string>
    ): boolean;
  }

  export class NotificationDispatcher {
    constructor(config?: NotificationDispatcherConfig);
    dispatch(event: NotificationEvent): Promise<void>;
    isEnabled(): boolean;
    getStats(): NotificationStats;
  }

  /**
   * Stripe billing service
   */
  export namespace Billing {
    export interface CheckoutSession {
      sessionId: string;
      url: string;
    }

    export interface Subscription {
      sessionId: string;
      customerId: string;
      subscriptionId: string;
      status: string;
      locale: string;
      planType: string;
      createdAt: Date;
    }

    export interface CreateCheckoutRequest {
      locale?: string;
      planType?: string;
    }

    export function createCheckoutSession(
      request: CreateCheckoutRequest
    ): Promise<CheckoutSession>;

    export function getSubscription(sessionId: string): Promise<Subscription | null>;

    export function listSubscriptions(): Promise<Subscription[]>;
  }

  /**
   * API request types
   */
  export namespace API {
    export interface StatsResponse {
      requests: {
        total: number;
        successful: number;
        failed: number;
        errorRate: number;
      };
      cache: {
        hits: number;
        misses: number;
        hitRate: number;
        size: number;
        maxSize: number;
      };
      performance: {
        avgResponseTime: number;
        p95ResponseTime: number;
        p99ResponseTime: number;
      };
      memory: {
        heapUsed: number;
        heapTotal: number;
        rss: number;
      };
      uptime: number;
    }

    export interface HealthResponse {
      status: 'healthy' | 'degraded' | 'unhealthy';
      uptime: number;
      version: string;
      memory: MemoryInfo;
      cache: {
        size: number;
        maxSize: number;
      };
      environment?: {
        nodeVersion: string;
        platform: string;
      };
    }
  }

  /**
   * Logger interface
   */
  export class SmartLogger {
    constructor(options?: {
      isDevelopment?: boolean;
      minLevel?: 'debug' | 'info' | 'warn' | 'error';
    });
    debug(message: string, data?: unknown): void;
    info(message: string, data?: unknown): void;
    warn(message: string, data?: unknown): void;
    error(message: string, data?: unknown): void;
    getStats(): {
      debug: number;
      info: number;
      warn: number;
      error: number;
    };
    reset(): void;
  }

  /**
   * Data manager for persistence
   */
  export class DataManager {
    constructor(dataPath?: string);
    read(): Promise<unknown>;
    write(data: unknown): Promise<void>;
    backup(): Promise<string>;
    restore(backupPath: string): Promise<void>;
  }

  /**
   * Response cache with LRU eviction
   */
  export class ResponseCache {
    constructor(options?: {
      maxSize?: number;
      maxFileSize?: number;
    });
    get(key: string): Buffer | null;
    set(key: string, data: Buffer): void;
    clear(): void;
    size(): number;
    getStats(): {
      hits: number;
      misses: number;
      hitRate: number;
      size: number;
      maxSize: number;
    };
  }

  /**
   * Custom Error Classes
   */
  export class QuiBrowserError extends Error {
    statusCode: number;
    details: Record<string, unknown>;
    timestamp: string;
    constructor(message: string, statusCode?: number, details?: Record<string, unknown>);
    toJSON(): {
      name: string;
      message: string;
      statusCode: number;
      details: Record<string, unknown>;
      timestamp: string;
    };
  }

  export class AuthenticationError extends QuiBrowserError {
    constructor(message?: string, details?: Record<string, unknown>);
  }

  export class AuthorizationError extends QuiBrowserError {
    constructor(message?: string, details?: Record<string, unknown>);
  }

  export class ValidationError extends QuiBrowserError {
    constructor(message?: string, details?: Record<string, unknown>);
  }

  export class RateLimitError extends QuiBrowserError {
    constructor(message?: string, details?: Record<string, unknown>);
  }

  export class NotFoundError extends QuiBrowserError {
    constructor(message?: string, details?: Record<string, unknown>);
  }

  export class ConfigurationError extends QuiBrowserError {
    constructor(message?: string, details?: Record<string, unknown>);
  }

  export class PaymentError extends QuiBrowserError {
    constructor(message?: string, details?: Record<string, unknown>);
  }

  export class ServiceUnavailableError extends QuiBrowserError {
    constructor(message?: string, details?: Record<string, unknown>);
  }

  export class TimeoutError extends QuiBrowserError {
    constructor(message?: string, details?: Record<string, unknown>);
  }

  export class SecurityError extends QuiBrowserError {
    constructor(message?: string, details?: Record<string, unknown>);
  }

  /**
   * Endpoint Rate Limiter
   */
  export class EndpointRateLimiter {
    constructor(options?: {
      defaultWindow?: number;
      defaultMaxRequests?: number;
      maxEntries?: number;
    });
    setEndpointConfig(
      endpoint: string,
      config: {
        window?: number;
        maxRequests?: number;
        message?: string;
      }
    ): void;
    checkLimit(
      endpoint: string,
      clientIP: string
    ): {
      allowed: boolean;
      limit: number;
      remaining: number;
      reset: number;
      message?: string;
    };
    middleware(options?: {
      keyGenerator?: (req: unknown) => string;
      skip?: (req: unknown) => boolean;
    }): Function;
    getStats(): {
      requests: number;
      blocked: number;
      endpoints: Record<string, { requests: number; blocked: number }>;
      mapSize: number;
      maxEntries: number;
      blockRate: number;
    };
    clear(): void;
    destroy(): void;
  }

  /**
   * Advanced Monitoring
   */
  export class AdvancedMonitoring {
    constructor(options?: {
      metricsRetention?: number;
      alertThresholds?: Record<string, { warning?: number; critical?: number }>;
      enableTracing?: boolean;
      enableProfiling?: boolean;
    });
    incrementCounter(name: string, value?: number, labels?: Record<string, string>): void;
    setGauge(name: string, value: number, labels?: Record<string, string>): void;
    recordHistogram(name: string, value: number, labels?: Record<string, string>): void;
    recordTimeseries(name: string, value: number, labels?: Record<string, string>): void;
    startTrace(requestId: string, metadata?: Record<string, unknown>): unknown;
    addSpan(trace: unknown, name: string, duration: number, metadata?: Record<string, unknown>): void;
    endTrace(trace: unknown): void;
    triggerAlert(name: string, severity: string, message: string, metadata?: Record<string, unknown>): unknown;
    getMetrics(): {
      counters: Record<string, number>;
      gauges: Record<string, { value: number; timestamp: number; labels: Record<string, string> }>;
      histograms: Record<
        string,
        { count: number; min: number; max: number; mean: number; p50: number; p95: number; p99: number }
      >;
      timeseries: Record<string, { datapoints: Array<{ value: number; timestamp: number }> }>;
    };
    getAlerts(): Array<{
      id: string;
      name: string;
      severity: string;
      message: string;
      timestamp: number;
      metadata?: Record<string, unknown>;
    }>;
    getTraces(limit?: number): unknown[];
    exportPrometheus(): string;
    reset(): void;
    destroy(): void;
  }

  /**
   * Smart Cache
   */
  export class SmartCache {
    constructor(options?: {
      maxSize?: number;
      maxMemory?: number;
      strategy?: 'lru' | 'lfu' | 'ttl' | 'adaptive';
      defaultTTL?: number;
      cleanupInterval?: number;
    });
    get(key: string): unknown;
    set(key: string, value: unknown, options?: { ttl?: number; size?: number }): boolean;
    delete(key: string): boolean;
    has(key: string): boolean;
    clear(): void;
    size(): number;
    keys(): string[];
    values(): unknown[];
    entries(): Array<[string, unknown]>;
    getStats(): {
      hits: number;
      misses: number;
      sets: number;
      evictions: number;
      expirations: number;
      totalSize: number;
      totalMemory: number;
      hitRate: number;
      size: number;
      maxSize: number;
      memoryUsage: number;
      maxMemory?: number;
      memoryUsagePercent: number;
      strategy: string;
    };
    destroy(): void;
  }

  /**
   * Request Logger
   */
  export class RequestLogger {
    constructor(options?: {
      logHeaders?: boolean;
      logBody?: boolean;
      logQuery?: boolean;
      maxBodyLength?: number;
      sensitiveHeaders?: string[];
      sensitiveFields?: string[];
      shouldLog?: (req: unknown) => boolean;
      maxLogs?: number;
    });
    middleware(): Function;
    getLogs(filter?: {
      requestId?: string;
      method?: string;
      status?: number;
      path?: string;
      minDuration?: number;
      errorsOnly?: boolean;
      limit?: number;
    }): Array<{
      requestId: string;
      timestamp: string;
      method: string;
      url: string;
      path: string;
      ip: string;
      headers?: Record<string, string>;
      query?: Record<string, unknown>;
      body?: unknown;
      status: number;
      duration: number;
      responseBody?: unknown;
      error?: { statusCode: number; statusMessage: string };
    }>;
    getStats(): {
      total: number;
      byMethod: Record<string, number>;
      byStatus: Record<string, number>;
      avgDuration: number;
      errorRate: number;
    };
    clear(): void;
    export(filter?: unknown): string;
  }
}

declare module 'http' {
  interface IncomingMessage {
    __clientIP?: string;
    query?: Record<string, unknown>;
    requestId?: string;
  }
}
