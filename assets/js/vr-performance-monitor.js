/**
 * Lightweight VR Performance Monitor
 *
 * Minimal-overhead performance tracking and diagnostics
 * - Real-time FPS monitoring
 * - Frame time tracking
 * - Memory usage monitoring
 * - Thermal state detection
 * - Battery monitoring
 * - Performance alerts
 *
 * Features:
 * - <1ms overhead per frame
 * - Automatic performance alerts
 * - FPS stability tracking (variance)
 * - Memory trend analysis
 * - Simple API
 *
 * @author Qui Browser Team
 * @version 5.7.0
 * @license MIT
 */

class VRPerformanceMonitor {
  constructor(options = {}) {
    this.version = '5.7.0';
    this.debug = options.debug || false;

    // Sampling configuration
    this.sampleInterval = options.sampleInterval || 60; // frames
    this.historySize = options.historySize || 120; // keep 2 seconds at 60 FPS

    // Current metrics
    this.metrics = {
      fps: 60,
      frameTime: 16.67,
      memory: 0,
      thermalState: 'nominal', // 'nominal', 'warning', 'critical'
      batteryLevel: 100,
      batteryDischarging: false
    };

    // History for trending
    this.history = {
      frameTimes: [],
      fps: [],
      memory: []
    };

    // Performance tracking
    this.frameCount = 0;
    this.lastSampleTime = Date.now();
    this.lastFrameTime = performance.now();

    // Alerts
    this.alerts = {
      lowFPS: options.lowFPSThreshold || 72,
      highFrameTime: options.highFrameTimeThreshold || 20,
      memoryWarning: options.memoryWarning || 1500, // MB
      thermalWarning: options.thermalWarning !== false
    };

    this.callbacks = {
      onPerformanceAlert: options.onPerformanceAlert || null,
      onThermalState: options.onThermalState || null,
      onBatteryLow: options.onBatteryLow || null
    };

    this.initialized = false;
  }

  /**
   * Initialize performance monitor
   */
  initialize() {
    this.log('Initializing Performance Monitor v5.7.0...');

    // Check for Battery API
    this.checkBatteryStatus();

    // Check for memory API
    this.checkMemoryStatus();

    this.initialized = true;
    this.log('Performance Monitor initialized');

    return true;
  }

  /**
   * Update metrics (call each frame)
   */
  update() {
    if (!this.initialized) return;

    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    this.frameCount++;

    // Sample at specified interval
    if (this.frameCount % this.sampleInterval === 0) {
      this.recordSample(frameTime);
      this.checkAlerts();
      this.checkThermalState();
    }
  }

  /**
   * Record performance sample
   * @param {number} frameTime - Frame time in ms
   */
  recordSample(frameTime) {
    // Calculate FPS from frame time
    const fps = 1000 / frameTime;

    // Update current metrics
    this.metrics.frameTime = frameTime;
    this.metrics.fps = fps;

    // Update memory
    this.updateMemory();

    // Add to history (with size limit)
    this.history.frameTimes.push(frameTime);
    this.history.fps.push(fps);
    this.history.memory.push(this.metrics.memory);

    // Keep history under size limit
    if (this.history.frameTimes.length > this.historySize) {
      this.history.frameTimes.shift();
      this.history.fps.shift();
      this.history.memory.shift();
    }
  }

  /**
   * Check for performance alerts
   */
  checkAlerts() {
    const { fps, frameTime, memory } = this.metrics;

    // FPS alert
    if (fps < this.alerts.lowFPS) {
      this.triggerAlert('low_fps', {
        fps: fps.toFixed(1),
        threshold: this.alerts.lowFPS
      });
    }

    // Frame time alert
    if (frameTime > this.alerts.highFrameTime) {
      this.triggerAlert('high_frame_time', {
        frameTime: frameTime.toFixed(1),
        threshold: this.alerts.highFrameTime
      });
    }

    // Memory alert
    if (memory > this.alerts.memoryWarning) {
      this.triggerAlert('memory_warning', {
        memory: memory.toFixed(0),
        threshold: this.alerts.memoryWarning
      });
    }
  }

  /**
   * Trigger performance alert
   * @param {string} type - Alert type
   * @param {Object} data - Alert data
   */
  triggerAlert(type, data) {
    this.log('Performance alert:', type, data);

    if (this.callbacks.onPerformanceAlert) {
      this.callbacks.onPerformanceAlert({ type, ...data });
    }
  }

  /**
   * Check thermal state
   */
  checkThermalState() {
    if (!this.alerts.thermalWarning) return;

    // Infer thermal state from FPS stability
    const avgFPS = this.getAverageFPS();
    const fpsVariance = this.getFPSVariance();

    // High variance and low FPS indicate potential thermal throttling
    if (avgFPS < 80 && fpsVariance > 10) {
      this.setThermalState('warning');
    } else if (avgFPS < 70) {
      this.setThermalState('critical');
    } else {
      this.setThermalState('nominal');
    }
  }

  /**
   * Set thermal state
   * @param {string} state - 'nominal', 'warning', 'critical'
   */
  setThermalState(state) {
    if (state === this.metrics.thermalState) return;

    this.metrics.thermalState = state;
    this.log('Thermal state:', state);

    if (this.callbacks.onThermalState) {
      this.callbacks.onThermalState(state);
    }
  }

  /**
   * Update memory usage
   */
  updateMemory() {
    if (!performance.memory) return;

    // Convert bytes to MB
    const usedMemory = performance.memory.usedJSHeapSize / (1024 * 1024);
    this.metrics.memory = usedMemory;
  }

  /**
   * Check battery status
   */
  checkBatteryStatus() {
    if (!navigator.getBattery) return;

    navigator.getBattery().then((battery) => {
      const updateBatteryStatus = () => {
        this.metrics.batteryLevel = battery.level * 100;
        this.metrics.batteryDischarging = battery.charging === false;

        if (this.metrics.batteryLevel < 20 && this.metrics.batteryDischarging) {
          if (this.callbacks.onBatteryLow) {
            this.callbacks.onBatteryLow(this.metrics.batteryLevel);
          }
        }
      };

      updateBatteryStatus();
      battery.addEventListener('levelchange', updateBatteryStatus);
      battery.addEventListener('chargingchange', updateBatteryStatus);
    });
  }

  /**
   * Get average FPS
   * @returns {number} Average FPS
   */
  getAverageFPS() {
    if (this.history.fps.length === 0) return 0;

    const sum = this.history.fps.reduce((a, b) => a + b, 0);
    return sum / this.history.fps.length;
  }

  /**
   * Get FPS variance
   * @returns {number} FPS variance
   */
  getFPSVariance() {
    if (this.history.fps.length < 2) return 0;

    const avg = this.getAverageFPS();
    const variance = this.history.fps.reduce((sum, fps) => {
      return sum + Math.pow(fps - avg, 2);
    }, 0) / this.history.fps.length;

    return Math.sqrt(variance);
  }

  /**
   * Get memory trend
   * @returns {string} 'stable', 'increasing', 'decreasing'
   */
  getMemoryTrend() {
    if (this.history.memory.length < 10) return 'stable';

    const recent = this.history.memory.slice(-10);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const trend = recent[recent.length - 1] - recent[0];

    if (Math.abs(trend) < 10) {
      return 'stable';
    } else if (trend > 0) {
      return 'increasing';
    } else {
      return 'decreasing';
    }
  }

  /**
   * Get current metrics
   * @returns {Object} Current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      avgFPS: this.getAverageFPS().toFixed(1),
      fpsVariance: this.getFPSVariance().toFixed(1),
      memoryTrend: this.getMemoryTrend(),
      historySize: this.history.frameTimes.length
    };
  }

  /**
   * Get performance grade
   * @returns {string} 'A+', 'A', 'B', 'C', 'D'
   */
  getPerformanceGrade() {
    const avgFPS = this.getAverageFPS();

    if (avgFPS >= 85) {
      return 'A+';
    } else if (avgFPS >= 75) {
      return 'A';
    } else if (avgFPS >= 60) {
      return 'B';
    } else if (avgFPS >= 45) {
      return 'C';
    } else {
      return 'D';
    }
  }

  /**
   * Reset statistics
   */
  reset() {
    this.history = {
      frameTimes: [],
      fps: [],
      memory: []
    };
    this.frameCount = 0;
    this.lastSampleTime = Date.now();

    this.log('Statistics reset');
  }

  /**
   * Log debug message
   */
  log(...args) {
    if (this.debug) {
      console.log('[VRPerformanceMonitor]', ...args);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRPerformanceMonitor;
}
