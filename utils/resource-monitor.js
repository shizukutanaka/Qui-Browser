/**
 * Resource Visualization Dashboard
 * Real-time resource monitoring and visualization
 * Priority: H037 from improvement backlog
 *
 * Features:
 * - CPU, memory, disk, network monitoring
 * - Real-time metrics collection
 * - Historical data tracking
 * - Alert thresholds
 * - Dashboard data generation
 *
 * @module utils/resource-monitor
 */

const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

class ResourceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      environment: options.environment || process.env.NODE_ENV || 'development',
      collectionInterval: options.collectionInterval || 5000, // 5 seconds
      retentionPeriod: options.retentionPeriod || 3600000, // 1 hour
      dataDir: options.dataDir || './data/metrics',
      enableAlerts: options.enableAlerts !== false,
      thresholds: {
        cpu: options.thresholds?.cpu || 80,
        memory: options.thresholds?.memory || 85,
        disk: options.thresholds?.disk || 90,
        ...options.thresholds
      },
      ...options
    };

    this.metrics = {
      cpu: [],
      memory: [],
      disk: [],
      network: [],
      process: []
    };

    this.alerts = [];
    this.collectionTimer = null;
    this.startTime = Date.now();

    this.init();
  }

  /**
   * Initialize resource monitor
   */
  async init() {
    try {
      await fs.mkdir(this.options.dataDir, { recursive: true });
      await this.loadHistoricalData();

      this.startCollection();

      console.log(`[ResourceMonitor] Started (environment: ${this.options.environment})`);
    } catch (error) {
      console.error('[ResourceMonitor] Initialization failed:', error);
    }
  }

  /**
   * Start metrics collection
   */
  startCollection() {
    if (this.collectionTimer) return;

    console.log(`[ResourceMonitor] Collection started (interval: ${this.options.collectionInterval}ms)`);

    this.collectionTimer = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        console.error('[ResourceMonitor] Collection failed:', error);
      }
    }, this.options.collectionInterval);

    // Initial collection
    this.collectMetrics();
  }

  /**
   * Stop metrics collection
   */
  stopCollection() {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
      console.log('[ResourceMonitor] Collection stopped');
    }
  }

  /**
   * Collect all metrics
   */
  async collectMetrics() {
    const timestamp = Date.now();

    // Collect CPU metrics
    const cpuMetrics = this.collectCPUMetrics();
    this.metrics.cpu.push({ timestamp, ...cpuMetrics });

    // Collect memory metrics
    const memoryMetrics = this.collectMemoryMetrics();
    this.metrics.memory.push({ timestamp, ...memoryMetrics });

    // Collect process metrics
    const processMetrics = this.collectProcessMetrics();
    this.metrics.process.push({ timestamp, ...processMetrics });

    // Collect disk metrics (less frequently due to performance)
    if (this.metrics.disk.length === 0 || timestamp - this.metrics.disk[this.metrics.disk.length - 1].timestamp > 60000) {
      const diskMetrics = await this.collectDiskMetrics();
      this.metrics.disk.push({ timestamp, ...diskMetrics });
    }

    // Cleanup old metrics
    this.cleanupOldMetrics();

    // Check thresholds and generate alerts
    if (this.options.enableAlerts) {
      this.checkThresholds(timestamp, cpuMetrics, memoryMetrics);
    }

    this.emit('metricsCollected', { timestamp, cpu: cpuMetrics, memory: memoryMetrics });
  }

  /**
   * Collect CPU metrics
   * @returns {Object} CPU metrics
   */
  collectCPUMetrics() {
    const cpus = os.cpus();
    const numCPUs = cpus.length;

    // Calculate CPU usage
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }

    const idle = totalIdle / numCPUs;
    const total = totalTick / numCPUs;
    const usage = 100 - (100 * idle) / total;

    // Get load average
    const loadAvg = os.loadavg();

    return {
      usage: parseFloat(usage.toFixed(2)),
      numCPUs,
      loadAverage: {
        '1m': loadAvg[0],
        '5m': loadAvg[1],
        '15m': loadAvg[2]
      },
      model: cpus[0]?.model || 'Unknown'
    };
  }

  /**
   * Collect memory metrics
   * @returns {Object} Memory metrics
   */
  collectMemoryMetrics() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const usagePercent = (usedMemory / totalMemory) * 100;

    return {
      total: totalMemory,
      free: freeMemory,
      used: usedMemory,
      usagePercent: parseFloat(usagePercent.toFixed(2)),
      totalFormatted: this.formatBytes(totalMemory),
      freeFormatted: this.formatBytes(freeMemory),
      usedFormatted: this.formatBytes(usedMemory)
    };
  }

  /**
   * Collect process metrics
   * @returns {Object} Process metrics
   */
  collectProcessMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      pid: process.pid,
      uptime: process.uptime(),
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        rssFormatted: this.formatBytes(memUsage.rss),
        heapTotalFormatted: this.formatBytes(memUsage.heapTotal),
        heapUsedFormatted: this.formatBytes(memUsage.heapUsed),
        heapUsagePercent: parseFloat(((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2))
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      }
    };
  }

  /**
   * Collect disk metrics
   * @returns {Promise<Object>} Disk metrics
   */
  async collectDiskMetrics() {
    const metrics = {
      partitions: []
    };

    try {
      // For Node.js, disk metrics are platform-specific
      // This is a simplified implementation
      const cwd = process.cwd();

      // Approximate free space check
      const testFile = path.join(cwd, '.disk-check-' + Date.now());

      try {
        await fs.writeFile(testFile, 'test');
        await fs.unlink(testFile);

        metrics.writable = true;
      } catch (error) {
        metrics.writable = false;
        metrics.error = error.message;
      }

      metrics.cwd = cwd;
    } catch (error) {
      metrics.error = error.message;
    }

    return metrics;
  }

  /**
   * Cleanup old metrics
   */
  cleanupOldMetrics() {
    const cutoff = Date.now() - this.options.retentionPeriod;

    this.metrics.cpu = this.metrics.cpu.filter(m => m.timestamp > cutoff);
    this.metrics.memory = this.metrics.memory.filter(m => m.timestamp > cutoff);
    this.metrics.disk = this.metrics.disk.filter(m => m.timestamp > cutoff);
    this.metrics.network = this.metrics.network.filter(m => m.timestamp > cutoff);
    this.metrics.process = this.metrics.process.filter(m => m.timestamp > cutoff);
  }

  /**
   * Check thresholds and generate alerts
   * @param {number} timestamp - Timestamp
   * @param {Object} cpuMetrics - CPU metrics
   * @param {Object} memoryMetrics - Memory metrics
   */
  checkThresholds(timestamp, cpuMetrics, memoryMetrics) {
    // CPU threshold
    if (cpuMetrics.usage > this.options.thresholds.cpu) {
      this.generateAlert('cpu', 'warning', cpuMetrics.usage, this.options.thresholds.cpu, timestamp);
    }

    // Memory threshold
    if (memoryMetrics.usagePercent > this.options.thresholds.memory) {
      this.generateAlert('memory', 'warning', memoryMetrics.usagePercent, this.options.thresholds.memory, timestamp);
    }

    // Process heap threshold
    const processMetric = this.metrics.process[this.metrics.process.length - 1];
    if (processMetric && processMetric.memory.heapUsagePercent > 90) {
      this.generateAlert('heap', 'critical', processMetric.memory.heapUsagePercent, 90, timestamp);
    }
  }

  /**
   * Generate alert
   * @param {string} type - Alert type
   * @param {string} severity - Severity level
   * @param {number} value - Current value
   * @param {number} threshold - Threshold value
   * @param {number} timestamp - Timestamp
   */
  generateAlert(type, severity, value, threshold, timestamp) {
    const alert = {
      type,
      severity,
      value,
      threshold,
      timestamp,
      datetime: new Date(timestamp).toISOString(),
      message: `${type.toUpperCase()} usage ${value.toFixed(2)}% exceeds threshold of ${threshold}%`
    };

    // Check if similar alert exists recently
    const recentAlert = this.alerts.find(
      a =>
        a.type === type &&
        timestamp - a.timestamp < 300000 // 5 minutes
    );

    if (!recentAlert) {
      this.alerts.push(alert);
      this.emit('alert', alert);

      console.warn(`[ResourceMonitor] ALERT: ${alert.message}`);

      // Send notification if available
      this.sendAlertNotification(alert);
    }
  }

  /**
   * Send alert notification
   * @param {Object} alert - Alert object
   */
  async sendAlertNotification(alert) {
    try {
      const NotificationChannel = require('./notification-channel');
      const notifier = new NotificationChannel();

      const severity = alert.severity === 'critical' ? 'critical' : 'warning';

      await notifier[severity](
        `Resource Alert: ${alert.type.toUpperCase()}`,
        alert.message,
        {
          type: alert.type,
          value: alert.value,
          threshold: alert.threshold,
          environment: this.options.environment
        }
      );
    } catch (error) {
      // Notification system might not be available
    }
  }

  /**
   * Get current metrics snapshot
   * @returns {Object} Current metrics
   */
  getCurrentMetrics() {
    return {
      timestamp: Date.now(),
      cpu: this.metrics.cpu[this.metrics.cpu.length - 1] || null,
      memory: this.metrics.memory[this.metrics.memory.length - 1] || null,
      disk: this.metrics.disk[this.metrics.disk.length - 1] || null,
      process: this.metrics.process[this.metrics.process.length - 1] || null,
      uptime: process.uptime(),
      monitorUptime: (Date.now() - this.startTime) / 1000
    };
  }

  /**
   * Get dashboard data
   * @returns {Object} Dashboard data
   */
  getDashboardData() {
    const current = this.getCurrentMetrics();

    return {
      timestamp: new Date().toISOString(),
      environment: this.options.environment,
      current,
      history: {
        cpu: this.metrics.cpu.slice(-60), // Last 60 samples
        memory: this.metrics.memory.slice(-60),
        process: this.metrics.process.slice(-60)
      },
      alerts: this.alerts.slice(-20), // Last 20 alerts
      summary: {
        avgCPU: this.calculateAverage(this.metrics.cpu, 'usage'),
        avgMemory: this.calculateAverage(this.metrics.memory, 'usagePercent'),
        peakCPU: this.calculatePeak(this.metrics.cpu, 'usage'),
        peakMemory: this.calculatePeak(this.metrics.memory, 'usagePercent'),
        totalAlerts: this.alerts.length
      },
      system: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        uptime: os.uptime(),
        nodeVersion: process.version
      }
    };
  }

  /**
   * Calculate average value
   * @param {Array} metrics - Metrics array
   * @param {string} field - Field name
   * @returns {number} Average
   */
  calculateAverage(metrics, field) {
    if (metrics.length === 0) return 0;

    const sum = metrics.reduce((acc, m) => acc + (m[field] || 0), 0);
    return parseFloat((sum / metrics.length).toFixed(2));
  }

  /**
   * Calculate peak value
   * @param {Array} metrics - Metrics array
   * @param {string} field - Field name
   * @returns {number} Peak value
   */
  calculatePeak(metrics, field) {
    if (metrics.length === 0) return 0;

    return Math.max(...metrics.map(m => m[field] || 0));
  }

  /**
   * Format bytes to human-readable string
   * @param {number} bytes - Bytes
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Load historical data
   */
  async loadHistoricalData() {
    const dataFile = path.join(this.options.dataDir, 'resource-metrics.json');

    try {
      const content = await fs.readFile(dataFile, 'utf8');
      const data = JSON.parse(content);

      // Load recent metrics
      const cutoff = Date.now() - this.options.retentionPeriod;

      this.metrics.cpu = (data.cpu || []).filter(m => m.timestamp > cutoff);
      this.metrics.memory = (data.memory || []).filter(m => m.timestamp > cutoff);
      this.metrics.disk = (data.disk || []).filter(m => m.timestamp > cutoff);
      this.metrics.process = (data.process || []).filter(m => m.timestamp > cutoff);

      console.log('[ResourceMonitor] Loaded historical data');
    } catch (error) {
      console.log('[ResourceMonitor] No historical data found');
    }
  }

  /**
   * Save metrics data
   */
  async saveMetricsData() {
    const dataFile = path.join(this.options.dataDir, 'resource-metrics.json');

    const data = {
      version: '1.0',
      updated: new Date().toISOString(),
      environment: this.options.environment,
      cpu: this.metrics.cpu.slice(-1000), // Keep last 1000 samples
      memory: this.metrics.memory.slice(-1000),
      disk: this.metrics.disk.slice(-100),
      process: this.metrics.process.slice(-1000)
    };

    await fs.writeFile(dataFile, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      environment: this.options.environment,
      uptime: (Date.now() - this.startTime) / 1000,
      dataPoints: {
        cpu: this.metrics.cpu.length,
        memory: this.metrics.memory.length,
        disk: this.metrics.disk.length,
        process: this.metrics.process.length
      },
      alerts: {
        total: this.alerts.length,
        recent: this.alerts.filter(a => Date.now() - a.timestamp < 3600000).length
      }
    };
  }

  /**
   * Shutdown resource monitor
   */
  async shutdown() {
    console.log('[ResourceMonitor] Shutting down...');

    this.stopCollection();
    await this.saveMetricsData();

    console.log('[ResourceMonitor] Shutdown complete');
  }
}

module.exports = ResourceMonitor;
