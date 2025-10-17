/**
 * Memory Pressure Monitor
 *
 * Monitors system memory pressure and adjusts application behavior.
 * Implements memory leak detection and automatic garbage collection.
 *
 * Features:
 * - Real-time memory monitoring
 * - Memory pressure detection
 * - Automatic cache trimming
 * - Memory leak detection
 * - Garbage collection hints
 * - Performance Memory API integration
 *
 * Performance Benefits:
 * - Prevents out-of-memory crashes
 * - Optimizes cache usage
 * - Improves stability
 * - Better resource management
 *
 * @module MemoryPressureMonitor
 * @version 1.0.0
 */

const { EventEmitter } = require('events');

class MemoryPressureMonitor extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      // Monitoring configuration
      enabled: options.enabled !== false,
      interval: options.interval || 5000, // 5 seconds

      // Memory thresholds (MB)
      thresholds: {
        low: options.lowThreshold || 512,      // Start warnings
        medium: options.mediumThreshold || 256, // Aggressive cleanup
        high: options.highThreshold || 128,     // Critical - emergency cleanup
        ...options.thresholds
      },

      // Heap thresholds (percentage)
      heapThresholds: {
        warning: options.heapWarning || 0.8,   // 80%
        critical: options.heapCritical || 0.9  // 90%
      },

      // Leak detection
      enableLeakDetection: options.enableLeakDetection !== false,
      leakCheckInterval: options.leakCheckInterval || 60000, // 1 minute
      leakThreshold: options.leakThreshold || 1.5, // 50% growth

      // Actions
      autoTrimCaches: options.autoTrimCaches !== false,
      autoGarbageCollect: options.autoGarbageCollect !== false,

      // Callbacks
      onLowMemory: options.onLowMemory || null,
      onMediumMemory: options.onMediumMemory || null,
      onHighMemory: options.onHighMemory || null,
      onMemoryLeak: options.onMemoryLeak || null,

      ...options
    };

    this.monitorTimer = null;
    this.leakDetectionTimer = null;
    this.memorySnapshots = [];
    this.maxSnapshotSize = 20;

    this.stats = {
      currentUsage: 0,
      peakUsage: 0,
      averageUsage: 0,
      totalSamples: 0,
      pressureLevel: 'normal', // normal, low, medium, high
      leaksDetected: 0,
      gcSuggestions: 0,
      cacheTrimCount: 0
    };

    this.pressureListeners = [];
  }

  /**
   * Initialize monitoring
   */
  initialize() {
    if (!this.options.enabled) {
      return;
    }

    // Check if Performance Memory API is available
    if (this.isMemoryAPIAvailable()) {
      this.startMonitoring();
    } else {
      this.emit('warning', { message: 'Performance Memory API not available' });
    }

    // Start leak detection
    if (this.options.enableLeakDetection) {
      this.startLeakDetection();
    }

    // Set up browser memory pressure observer if available
    this.setupPressureObserver();

    this.emit('initialized');
  }

  /**
   * Check if Performance Memory API is available
   */
  isMemoryAPIAvailable() {
    if (typeof performance === 'undefined') {
      return false;
    }

    // Browser
    if (typeof performance.memory !== 'undefined') {
      return true;
    }

    // Node.js
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return true;
    }

    return false;
  }

  /**
   * Start memory monitoring
   */
  startMonitoring() {
    this.monitorTimer = setInterval(() => {
      this.checkMemory();
    }, this.options.interval);
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring() {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
  }

  /**
   * Check current memory usage
   */
  checkMemory() {
    const memoryInfo = this.getMemoryInfo();

    if (!memoryInfo) {
      return;
    }

    // Update statistics
    this.stats.currentUsage = memoryInfo.usedMB;
    this.stats.peakUsage = Math.max(this.stats.peakUsage, memoryInfo.usedMB);
    this.stats.totalSamples++;
    this.stats.averageUsage = (this.stats.averageUsage * (this.stats.totalSamples - 1) + memoryInfo.usedMB) / this.stats.totalSamples;

    // Store snapshot
    this.addSnapshot(memoryInfo);

    // Determine pressure level
    const pressureLevel = this.determinePressureLevel(memoryInfo);
    const previousLevel = this.stats.pressureLevel;
    this.stats.pressureLevel = pressureLevel;

    // Emit events if pressure level changed
    if (pressureLevel !== previousLevel) {
      this.emit('pressureChange', {
        level: pressureLevel,
        previousLevel,
        memoryInfo
      });
    }

    // Take action based on pressure level
    this.handleMemoryPressure(pressureLevel, memoryInfo);

    // Emit periodic update
    this.emit('memoryUpdate', {
      memoryInfo,
      pressureLevel,
      stats: this.getStatistics()
    });
  }

  /**
   * Get current memory information
   */
  getMemoryInfo() {
    // Browser environment
    if (typeof performance !== 'undefined' && performance.memory) {
      const memory = performance.memory;
      return {
        usedMB: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        totalMB: Math.round(memory.totalJSHeapSize / 1024 / 1024),
        limitMB: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
        heapPercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
        availableMB: Math.round((memory.jsHeapSizeLimit - memory.usedJSHeapSize) / 1024 / 1024)
      };
    }

    // Node.js environment
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memory = process.memoryUsage();
      return {
        usedMB: Math.round(memory.heapUsed / 1024 / 1024),
        totalMB: Math.round(memory.heapTotal / 1024 / 1024),
        limitMB: Math.round(memory.rss / 1024 / 1024),
        heapPercentage: (memory.heapUsed / memory.heapTotal) * 100,
        availableMB: Math.round((memory.heapTotal - memory.heapUsed) / 1024 / 1024),
        external: Math.round(memory.external / 1024 / 1024)
      };
    }

    return null;
  }

  /**
   * Determine pressure level based on memory info
   */
  determinePressureLevel(memoryInfo) {
    const availableMB = memoryInfo.availableMB;
    const heapPercentage = memoryInfo.heapPercentage / 100;

    // Check heap percentage first (more critical)
    if (heapPercentage >= this.options.heapThresholds.critical) {
      return 'high';
    } else if (heapPercentage >= this.options.heapThresholds.warning) {
      return 'medium';
    }

    // Check available memory
    if (availableMB <= this.options.thresholds.high) {
      return 'high';
    } else if (availableMB <= this.options.thresholds.medium) {
      return 'medium';
    } else if (availableMB <= this.options.thresholds.low) {
      return 'low';
    }

    return 'normal';
  }

  /**
   * Handle memory pressure
   */
  handleMemoryPressure(level, memoryInfo) {
    switch (level) {
      case 'low':
        this.handleLowMemory(memoryInfo);
        break;
      case 'medium':
        this.handleMediumMemory(memoryInfo);
        break;
      case 'high':
        this.handleHighMemory(memoryInfo);
        break;
    }
  }

  /**
   * Handle low memory pressure
   */
  handleLowMemory(memoryInfo) {
    this.emit('lowMemory', memoryInfo);

    if (this.options.onLowMemory) {
      this.options.onLowMemory(memoryInfo);
    }

    // Suggest garbage collection
    if (this.options.autoGarbageCollect) {
      this.suggestGarbageCollection();
    }
  }

  /**
   * Handle medium memory pressure
   */
  handleMediumMemory(memoryInfo) {
    this.emit('mediumMemory', memoryInfo);

    if (this.options.onMediumMemory) {
      this.options.onMediumMemory(memoryInfo);
    }

    // Trim caches
    if (this.options.autoTrimCaches) {
      this.trimCaches('aggressive');
    }

    // Suggest garbage collection
    if (this.options.autoGarbageCollect) {
      this.suggestGarbageCollection();
    }
  }

  /**
   * Handle high memory pressure (critical)
   */
  handleHighMemory(memoryInfo) {
    this.emit('highMemory', memoryInfo);

    if (this.options.onHighMemory) {
      this.options.onHighMemory(memoryInfo);
    }

    // Emergency cache clearing
    if (this.options.autoTrimCaches) {
      this.trimCaches('emergency');
    }

    // Force garbage collection if possible
    if (this.options.autoGarbageCollect) {
      this.forceGarbageCollection();
    }
  }

  /**
   * Trim caches to free memory
   */
  trimCaches(level = 'normal') {
    const event = {
      level,
      timestamp: Date.now()
    };

    this.emit('trimCaches', event);
    this.stats.cacheTrimCount++;

    // Listeners can respond to this event
    return event;
  }

  /**
   * Suggest garbage collection
   */
  suggestGarbageCollection() {
    this.stats.gcSuggestions++;

    // Emit suggestion event
    this.emit('gcSuggestion', {
      reason: 'memory pressure',
      timestamp: Date.now()
    });

    // Try to force GC if available (Node.js with --expose-gc flag)
    if (typeof global !== 'undefined' && global.gc) {
      try {
        global.gc();
        this.emit('gcExecuted', { forced: true });
      } catch (error) {
        // GC not available
      }
    }
  }

  /**
   * Force garbage collection (if available)
   */
  forceGarbageCollection() {
    this.suggestGarbageCollection();
  }

  /**
   * Add memory snapshot
   */
  addSnapshot(memoryInfo) {
    this.memorySnapshots.push({
      timestamp: Date.now(),
      ...memoryInfo
    });

    // Keep only recent snapshots
    if (this.memorySnapshots.length > this.maxSnapshotSize) {
      this.memorySnapshots.shift();
    }
  }

  /**
   * Start leak detection
   */
  startLeakDetection() {
    this.leakDetectionTimer = setInterval(() => {
      this.detectMemoryLeaks();
    }, this.options.leakCheckInterval);
  }

  /**
   * Detect memory leaks
   */
  detectMemoryLeaks() {
    if (this.memorySnapshots.length < 5) {
      return; // Not enough data
    }

    const recentSnapshots = this.memorySnapshots.slice(-5);
    const oldestUsage = recentSnapshots[0].usedMB;
    const newestUsage = recentSnapshots[recentSnapshots.length - 1].usedMB;

    const growthRatio = newestUsage / oldestUsage;

    // Check for sustained growth
    if (growthRatio >= this.options.leakThreshold) {
      const leak = {
        oldUsage: oldestUsage,
        newUsage: newestUsage,
        growthRatio,
        growthMB: newestUsage - oldestUsage,
        timeSpan: recentSnapshots[recentSnapshots.length - 1].timestamp - recentSnapshots[0].timestamp
      };

      this.stats.leaksDetected++;

      this.emit('memoryLeak', leak);

      if (this.options.onMemoryLeak) {
        this.options.onMemoryLeak(leak);
      }
    }
  }

  /**
   * Setup browser pressure observer (if available)
   */
  setupPressureObserver() {
    // Check if Compute Pressure API is available (experimental)
    if (typeof PressureObserver === 'undefined') {
      return;
    }

    try {
      const observer = new PressureObserver((records) => {
        records.forEach(record => {
          this.emit('browserPressure', {
            source: record.source, // 'cpu' or 'memory'
            state: record.state    // 'nominal', 'fair', 'serious', 'critical'
          });
        });
      });

      observer.observe('memory');
      this.pressureObserver = observer;
    } catch (error) {
      // API not supported
    }
  }

  /**
   * Get memory trend
   */
  getMemoryTrend() {
    if (this.memorySnapshots.length < 2) {
      return 'unknown';
    }

    const recent = this.memorySnapshots.slice(-5);
    const increasing = recent.every((snapshot, i) => {
      if (i === 0) return true;
      return snapshot.usedMB > recent[i - 1].usedMB;
    });

    const decreasing = recent.every((snapshot, i) => {
      if (i === 0) return true;
      return snapshot.usedMB < recent[i - 1].usedMB;
    });

    if (increasing) return 'increasing';
    if (decreasing) return 'decreasing';
    return 'stable';
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      trend: this.getMemoryTrend(),
      snapshotCount: this.memorySnapshots.length
    };
  }

  /**
   * Get memory snapshots
   */
  getSnapshots(count = 10) {
    return this.memorySnapshots.slice(-count);
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.stats = {
      currentUsage: this.stats.currentUsage,
      peakUsage: 0,
      averageUsage: 0,
      totalSamples: 0,
      pressureLevel: this.stats.pressureLevel,
      leaksDetected: 0,
      gcSuggestions: 0,
      cacheTrimCount: 0
    };
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.stopMonitoring();

    if (this.leakDetectionTimer) {
      clearInterval(this.leakDetectionTimer);
      this.leakDetectionTimer = null;
    }

    if (this.pressureObserver) {
      this.pressureObserver.disconnect();
      this.pressureObserver = null;
    }

    this.memorySnapshots = [];

    this.emit('cleanup');
  }
}

module.exports = MemoryPressureMonitor;
