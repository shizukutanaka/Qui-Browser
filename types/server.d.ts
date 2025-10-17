/**
 * Qui Browser Server TypeScript Definitions
 *
 * @module types/server
 * @version 1.0.2
 */

import { Server, IncomingMessage, ServerResponse } from 'http';

export interface SecurityHeaders {
  'X-Content-Type-Options': string;
  'X-Frame-Options': string;
  'X-XSS-Protection': string;
  'Referrer-Policy': string;
  'Content-Security-Policy'?: string;
  'Strict-Transport-Security'?: string;
  'Permissions-Policy'?: string;
  'Cross-Origin-Embedder-Policy'?: string;
  'Cross-Origin-Opener-Policy'?: string;
  'Cross-Origin-Resource-Policy'?: string;
}

export interface ServerConfig {
  port: number;
  environment: 'production' | 'development' | 'test';
  staticRoot: string;
  rateLimitMax: number;
  rateLimitWindow: number;
  rateLimitMaxEntries: number;
  fileCacheMaxSize: number;
  fileCacheMaxFileSize: number;
}

export interface HealthMetrics {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  timestamp: string;
  uptimeSeconds: number;
  requests: number;
  errors: number;
  rateLimited: number;
  avgResponseTimeMs: number;
  memory: NodeJS.MemoryUsage;
  connections: {
    active: number;
    peak: number;
  };
  version: string;
  metrics: {
    server: {
      uptimeMs: number;
      totalRequests: number;
      totalErrors: number;
      rateLimited: number;
      avgResponseTimeMs: number;
      activeConnections: number;
      peakConnections: number;
    };
    system: SystemMetrics | null;
  };
  thresholds?: HealthThresholds;
  environment: {
    nodeVersion: string;
    pid: number;
  };
}

export interface SystemMetrics {
  memory: {
    status: 'healthy' | 'warning' | 'critical';
    usagePercent: number;
    usedMB: number;
    totalMB: number;
    freeMB: number;
  };
  heap: {
    status: 'healthy' | 'warning' | 'critical';
    usagePercent: number;
    heapUsedMB: number;
    heapTotalMB: number;
  };
  cpu: {
    status: 'healthy' | 'warning' | 'critical';
    usagePercentPerCore: number;
    cores: number;
    windowMs: number;
  };
  eventLoop: {
    status: 'healthy' | 'warning' | 'critical';
    currentLagMs: number;
    maxLagMs: number;
    meanLagMs: number;
    samples: number;
  };
}

export interface HealthThresholds {
  memoryWarning: number;
  memoryCritical: number;
  heapWarning: number;
  heapCritical: number;
  cpuWarning: number;
  cpuCritical: number;
  eventLoopLagWarningMs: number;
  eventLoopLagCriticalMs: number;
}

export interface RateLimitInfo {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
}

export interface RequestLogEntry {
  timestamp: string;
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  ip: string;
  userAgent?: string;
  requestId?: string;
  error?: {
    message: string;
    name: string;
  } | null;
}

export declare class LightweightBrowserServer {
  port: number;
  environment: 'production' | 'development' | 'test';
  startTime: number;
  requestCount: number;
  errorCount: number;
  totalResponseTime: number;
  rateLimitedCount: number;
  activeConnections: number;
  peakConnections: number;
  version: string;

  constructor();

  start(): Promise<Server>;
  stop(): Promise<void>;

  checkRateLimit(clientIP: string): boolean;
  getClientIP(req: IncomingMessage): string;

  handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void>;
  handleHealthCheck(req: IncomingMessage, res: ServerResponse): void;
  handleMetrics(req: IncomingMessage, res: ServerResponse): void;

  serveStaticFile(req: IncomingMessage, requestPath: string, res: ServerResponse): Promise<boolean>;

  logRequest(req: IncomingMessage, res: ServerResponse, duration: number, error?: Error | null): void;

  validateStartupConfiguration(): void;
  stopHealthMonitor(): void;
  cleanupRateLimits(): void;
}

export default LightweightBrowserServer;
