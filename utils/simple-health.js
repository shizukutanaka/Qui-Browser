/**
 * Simple Health Monitor
 *
 * 軽量システムヘルスモニタリング
 *
 * 監視項目:
 * - メモリ使用量（RSS、ヒープ）
 * - CPU使用率
 * - イベントループ遅延
 * - システムアップタイム
 *
 * @module simple-health
 * @version 1.0.2
 */

const os = require('os');
const { performance } = require('perf_hooks');

const STATUS_RANK = {
  healthy: 0,
  warning: 1,
  critical: 2
};

function bytesToMB(bytes) {
  return Math.round(bytes / 1024 / 1024);
}

class SimpleHealthMonitor {
  constructor(options = {}) {
    this.sampleIntervalMs = Math.max(5000, options.sampleIntervalMs || 30000);
    this.eventLoopSampleMs = Math.max(50, options.eventLoopSampleMs || 200);

    this.thresholds = {
      memoryWarning: options.memoryWarning ?? 0.8,
      memoryCritical: options.memoryCritical ?? 0.9,
      heapWarning: options.heapWarning ?? 0.85,
      heapCritical: options.heapCritical ?? 0.95,
      cpuWarning: options.cpuWarning ?? 0.7,
      cpuCritical: options.cpuCritical ?? 0.9,
      eventLoopLagWarningMs: options.eventLoopLagWarningMs ?? 200,
      eventLoopLagCriticalMs: options.eventLoopLagCriticalMs ?? 500
    };

    this.coreCount = Math.max(1, os.cpus().length || 1);

    this.lastCpuSample = {
      usage: process.cpuUsage(),
      timestamp: Date.now()
    };

    this.eventLoopLag = {
      current: 0,
      max: 0,
      mean: 0,
      samples: 0
    };

    this.status = this.buildEmptyStatus();

    this.monitorTimer = null;
    this.eventLoopTimer = null;

    this.startMonitoring();
    this.startEventLoopMonitor();
  }

  buildEmptyStatus() {
    return {
      status: 'unknown',
      timestamp: null,
      uptimeSeconds: 0,
      metrics: {
        memory: null,
        heap: null,
        cpu: null,
        eventLoop: null
      },
      thresholds: { ...this.thresholds }
    };
  }

  startMonitoring() {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
    }

    this.updateHealthStatus();

    this.monitorTimer = setInterval(() => {
      try {
        this.updateHealthStatus();
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[health] updateHealthStatus failed', error);
        }
      }
    }, this.sampleIntervalMs);

    if (typeof this.monitorTimer.unref === 'function') {
      this.monitorTimer.unref();
    }
  }

  startEventLoopMonitor() {
    if (this.eventLoopTimer) {
      clearInterval(this.eventLoopTimer);
    }

    const interval = this.eventLoopSampleMs;
    let expected = performance.now() + interval;

    this.eventLoopTimer = setInterval(() => {
      const now = performance.now();
      const lag = Math.max(0, now - expected);
      this.recordEventLoopLag(lag);
      expected = now + interval;
    }, interval);

    if (typeof this.eventLoopTimer.unref === 'function') {
      this.eventLoopTimer.unref();
    }
  }

  stop() {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
    if (this.eventLoopTimer) {
      clearInterval(this.eventLoopTimer);
      this.eventLoopTimer = null;
    }
  }

  recordEventLoopLag(lag) {
    const samples = this.eventLoopLag.samples + 1;
    const mean = this.eventLoopLag.mean + (lag - this.eventLoopLag.mean) / samples;

    this.eventLoopLag = {
      current: lag,
      max: Math.max(this.eventLoopLag.max, lag),
      mean,
      samples
    };
  }

  evaluateStatus(value, warningThreshold, criticalThreshold, invert = false) {
    if (!Number.isFinite(value)) {
      return 'unknown';
    }

    if (!invert) {
      if (value >= criticalThreshold) {
        return 'critical';
      }
      if (value >= warningThreshold) {
        return 'warning';
      }
      return 'healthy';
    }

    if (value <= criticalThreshold) {
      return 'critical';
    }
    if (value <= warningThreshold) {
      return 'warning';
    }
    return 'healthy';
  }

  combineStatuses(statuses) {
    let aggregate = 'healthy';
    for (const status of statuses) {
      const rank = STATUS_RANK[status] ?? -1;
      if (rank > STATUS_RANK[aggregate]) {
        aggregate = status;
      }
    }
    return aggregate;
  }

  sampleCpuLoad() {
    const now = Date.now();
    const currentUsage = process.cpuUsage();
    const elapsedMs = Math.max(1, now - this.lastCpuSample.timestamp);

    const usageDiff = {
      user: currentUsage.user - this.lastCpuSample.usage.user,
      system: currentUsage.system - this.lastCpuSample.usage.system
    };

    this.lastCpuSample = {
      usage: currentUsage,
      timestamp: now
    };

    const totalMicros = Math.max(0, usageDiff.user + usageDiff.system);
    const totalMs = totalMicros / 1000;
    const percentPerCore = Math.min(1, totalMs / (elapsedMs * this.coreCount));

    return {
      percent: percentPerCore,
      elapsedMs,
      totalMicros
    };
  }

  updateHealthStatus() {
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = Math.max(0, totalMemory - freeMemory);
    const memoryPercent = totalMemory === 0 ? 0 : usedMemory / totalMemory;
    const heapPercent = memoryUsage.heapTotal === 0 ? 0 : memoryUsage.heapUsed / memoryUsage.heapTotal;

    const memoryStatus = this.evaluateStatus(
      memoryPercent,
      this.thresholds.memoryWarning,
      this.thresholds.memoryCritical
    );

    const heapStatus = this.evaluateStatus(heapPercent, this.thresholds.heapWarning, this.thresholds.heapCritical);

    const cpuSample = this.sampleCpuLoad();
    const cpuStatus = this.evaluateStatus(cpuSample.percent, this.thresholds.cpuWarning, this.thresholds.cpuCritical);

    const eventLoopStatus = this.evaluateStatus(
      this.eventLoopLag.current,
      this.thresholds.eventLoopLagWarningMs,
      this.thresholds.eventLoopLagCriticalMs,
      true
    );

    const status = this.combineStatuses([memoryStatus, heapStatus, cpuStatus, eventLoopStatus]);

    this.status = {
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      metrics: {
        memory: {
          status: memoryStatus,
          usagePercent: Number(memoryPercent.toFixed(4)),
          usedMB: bytesToMB(usedMemory),
          totalMB: bytesToMB(totalMemory),
          freeMB: bytesToMB(freeMemory)
        },
        heap: {
          status: heapStatus,
          usagePercent: Number(heapPercent.toFixed(4)),
          heapUsedMB: bytesToMB(memoryUsage.heapUsed),
          heapTotalMB: bytesToMB(memoryUsage.heapTotal)
        },
        cpu: {
          status: cpuStatus,
          usagePercentPerCore: Number(cpuSample.percent.toFixed(4)),
          cores: this.coreCount,
          windowMs: cpuSample.elapsedMs
        },
        eventLoop: {
          status: eventLoopStatus,
          currentLagMs: Number(this.eventLoopLag.current.toFixed(2)),
          maxLagMs: Number(this.eventLoopLag.max.toFixed(2)),
          meanLagMs: Number(this.eventLoopLag.mean.toFixed(2)),
          samples: this.eventLoopLag.samples
        }
      },
      thresholds: { ...this.thresholds }
    };

    return this.status;
  }

  getHealth() {
    return this.updateHealthStatus();
  }

  // Simple performance check
  async performanceCheck() {
    const start = Date.now();

    // CPU performance test - calculate sum to prevent optimization
    let sum = 0;
    for (let i = 0; i < 100000; i++) {
      sum += i;
    }
    // Use sum to prevent dead code elimination
    void sum;

    const end = Date.now();
    const duration = end - start;

    return {
      test: 'cpu_performance',
      duration,
      status: duration < 100 ? 'good' : duration < 500 ? 'acceptable' : 'slow',
      eventLoop: this.eventLoopLag
    };
  }

  // Check system resources
  getSystemInfo() {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: this.coreCount,
      memory: {
        total: bytesToMB(os.totalmem()),
        free: bytesToMB(os.freemem())
      },
      uptime: Math.floor(os.uptime()),
      process: {
        version: process.version,
        uptime: Math.floor(process.uptime()),
        pid: process.pid
      }
    };
  }
}

module.exports = SimpleHealthMonitor;
