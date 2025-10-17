/**
 * Health Monitor TypeScript Definitions
 *
 * @module types/health
 * @version 1.0.2
 */

export interface HealthMonitorOptions {
  sampleIntervalMs?: number;
  eventLoopSampleMs?: number;
  memoryWarning?: number;
  memoryCritical?: number;
  heapWarning?: number;
  heapCritical?: number;
  cpuWarning?: number;
  cpuCritical?: number;
  eventLoopLagWarningMs?: number;
  eventLoopLagCriticalMs?: number;
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

export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface MemoryMetrics {
  status: HealthStatus;
  usagePercent: number;
  usedMB: number;
  totalMB: number;
  freeMB: number;
}

export interface HeapMetrics {
  status: HealthStatus;
  usagePercent: number;
  heapUsedMB: number;
  heapTotalMB: number;
}

export interface CPUMetrics {
  status: HealthStatus;
  usagePercentPerCore: number;
  cores: number;
  windowMs: number;
}

export interface EventLoopMetrics {
  status: HealthStatus;
  currentLagMs: number;
  maxLagMs: number;
  meanLagMs: number;
  samples: number;
}

export interface SystemMetrics {
  memory: MemoryMetrics;
  heap: HeapMetrics;
  cpu: CPUMetrics;
  eventLoop: EventLoopMetrics;
}

export interface HealthSnapshot {
  status: HealthStatus;
  timestamp: string;
  uptimeSeconds: number;
  metrics: SystemMetrics;
  thresholds: HealthThresholds;
}

export interface EventLoopLag {
  current: number;
  max: number;
  mean: number;
  samples: number;
}

export interface CPUSample {
  usage: NodeJS.CpuUsage;
  timestamp: number;
}

export interface CPULoad {
  percent: number;
  elapsedMs: number;
  totalMicros: number;
}

export interface PerformanceCheckResult {
  test: string;
  duration: number;
  status: 'good' | 'acceptable' | 'slow';
  eventLoop: EventLoopLag;
}

export interface SystemInfo {
  hostname: string;
  platform: NodeJS.Platform;
  arch: string;
  cpus: number;
  memory: {
    total: number;
    free: number;
  };
  uptime: number;
  process: {
    version: string;
    uptime: number;
    pid: number;
  };
}

export declare class SimpleHealthMonitor {
  sampleIntervalMs: number;
  eventLoopSampleMs: number;
  thresholds: HealthThresholds;
  coreCount: number;
  lastCpuSample: CPUSample;
  eventLoopLag: EventLoopLag;
  status: HealthSnapshot;
  monitorTimer: NodeJS.Timeout | null;
  eventLoopTimer: NodeJS.Timeout | null;

  constructor(options?: HealthMonitorOptions);

  buildEmptyStatus(): HealthSnapshot;
  startMonitoring(): void;
  startEventLoopMonitor(): void;
  stop(): void;

  recordEventLoopLag(lag: number): void;
  evaluateStatus(value: number, warningThreshold: number, criticalThreshold: number, invert?: boolean): HealthStatus;
  combineStatuses(statuses: HealthStatus[]): HealthStatus;

  sampleCpuLoad(): CPULoad;
  updateHealthStatus(): HealthSnapshot;
  getHealth(): HealthSnapshot;

  performanceCheck(): Promise<PerformanceCheckResult>;
  getSystemInfo(): SystemInfo;
}

export default SimpleHealthMonitor;
