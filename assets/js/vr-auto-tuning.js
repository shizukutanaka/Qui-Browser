/**
 * VR Performance Auto-Tuning System
 * リアルタイムパフォーマンスモニタリングと自動最適化
 *
 * Features:
 * - Real-time FPS monitoring
 * - Automatic quality adjustment
 * - Thermal management
 * - Battery optimization
 * - Adaptive LOD
 * - Dynamic resolution scaling
 *
 * @version 1.0.0
 */

class VRAutoTuningSystem {
  constructor(vrIntegrator) {
    this.vrIntegrator = vrIntegrator;
    this.enabled = false;

    this.config = {
      targetFPS: 90,
      minFPS: 72,
      maxFPS: 120,
      adjustmentInterval: 2000, // ms
      aggressiveness: 0.5, // 0-1 (how quickly to adjust)
      enableThermalManagement: true,
      enableBatteryOptimization: true,
      cooldownPeriod: 5000 // ms (after adjustment)
    };

    // Performance targets
    this.targets = {
      fps: 90,
      frameTime: 11.11, // ms (1000/90)
      cpuLoad: 70, // %
      gpuLoad: 80, // %
      memoryUsage: 80, // %
      temperature: 45, // °C
      batteryDrain: 15 // %/hour
    };

    // Current state
    this.state = {
      currentFPS: 0,
      averageFPS: 0,
      frameTimeHistory: [],
      cpuLoad: 0,
      gpuLoad: 0,
      memoryUsage: 0,
      temperature: 0,
      batteryLevel: 100,
      thermalState: 'nominal', // 'nominal', 'fair', 'serious', 'critical'
      lastAdjustmentTime: 0
    };

    // Adjustment history
    this.adjustmentHistory = [];
    this.maxHistoryLength = 100;

    // Tuning parameters
    this.tuningParams = {
      ffrLevel: 0.5,
      msaa: 4,
      shadowQuality: 'high',
      postProcessing: 'medium',
      lodBias: 1.0,
      textureQuality: 'high',
      particleLimit: 1000,
      drawDistance: 100
    };

    // Update interval
    this.updateInterval = null;

    console.info('[AutoTuning] Auto-Tuning System initialized');
  }

  /**
   * Start auto-tuning
   */
  start() {
    if (this.enabled) {
      console.warn('[AutoTuning] Already running');
      return;
    }

    this.enabled = true;

    // Start monitoring
    this.updateInterval = setInterval(() => {
      this.update();
    }, this.config.adjustmentInterval);

    console.info('[AutoTuning] Auto-tuning started');
  }

  /**
   * Stop auto-tuning
   */
  stop() {
    if (!this.enabled) {
      return;
    }

    this.enabled = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    console.info('[AutoTuning] Auto-tuning stopped');
  }

  /**
   * Update and adjust
   */
  update() {
    if (!this.enabled || !this.vrIntegrator) {
      return;
    }

    // Collect current metrics
    this.collectMetrics();

    // Check if we need to adjust
    const now = Date.now();
    if (now - this.state.lastAdjustmentTime < this.config.cooldownPeriod) {
      // In cooldown period
      return;
    }

    // Analyze performance
    const analysis = this.analyzePerformance();

    // Make adjustments if needed
    if (analysis.needsAdjustment) {
      this.makeAdjustments(analysis);
      this.state.lastAdjustmentTime = now;
    }
  }

  /**
   * Collect current metrics
   */
  collectMetrics() {
    if (!this.vrIntegrator || !this.vrIntegrator.initialized) {
      return;
    }

    const perfSummary = this.vrIntegrator.getPerformanceSummary();
    const status = this.vrIntegrator.getStatus();

    // Update state
    this.state.currentFPS = perfSummary.fps || 0;
    this.state.frameTimeHistory.push(1000 / this.state.currentFPS);

    // Keep last 30 frames
    if (this.state.frameTimeHistory.length > 30) {
      this.state.frameTimeHistory.shift();
    }

    // Calculate average FPS
    if (this.state.frameTimeHistory.length > 0) {
      const avgFrameTime = this.state.frameTimeHistory.reduce((a, b) => a + b) / this.state.frameTimeHistory.length;
      this.state.averageFPS = 1000 / avgFrameTime;
    }

    // Estimate other metrics
    this.state.cpuLoad = this.estimateCPULoad(status);
    this.state.gpuLoad = this.estimateGPULoad(status);
    this.state.memoryUsage = this.estimateMemoryUsage();
    this.state.temperature = this.estimateTemperature();
    this.state.batteryLevel = this.getBatteryLevel();
    this.state.thermalState = this.getThermalState();
  }

  /**
   * Analyze performance
   * @returns {Object} Analysis result
   */
  analyzePerformance() {
    const analysis = {
      needsAdjustment: false,
      direction: 'none', // 'increase', 'decrease'
      urgency: 0, // 0-1
      reasons: []
    };

    const avgFPS = this.state.averageFPS;

    // FPS analysis
    if (avgFPS < this.targets.fps - 5) {
      analysis.needsAdjustment = true;
      analysis.direction = 'decrease';
      const fpsDelta = this.targets.fps - avgFPS;
      analysis.urgency = Math.min(fpsDelta / this.targets.fps, 1.0);
      analysis.reasons.push(`FPS below target (${avgFPS.toFixed(1)} < ${this.targets.fps})`);

      // Critical if below minimum
      if (avgFPS < this.config.minFPS) {
        analysis.urgency = 1.0;
        analysis.reasons.push(`CRITICAL: FPS below minimum (${this.config.minFPS})`);
      }
    } else if (avgFPS > this.targets.fps + 10) {
      // Room for quality improvement
      analysis.needsAdjustment = true;
      analysis.direction = 'increase';
      analysis.urgency = 0.3; // Low urgency for quality improvements
      analysis.reasons.push(`FPS above target, can increase quality`);
    }

    // Thermal management
    if (this.config.enableThermalManagement) {
      if (this.state.thermalState === 'critical') {
        analysis.needsAdjustment = true;
        analysis.direction = 'decrease';
        analysis.urgency = 1.0;
        analysis.reasons.push('CRITICAL: Thermal throttling detected');
      } else if (this.state.thermalState === 'serious') {
        analysis.needsAdjustment = true;
        analysis.direction = 'decrease';
        analysis.urgency = 0.8;
        analysis.reasons.push('WARNING: High temperature');
      }
    }

    // Battery optimization
    if (this.config.enableBatteryOptimization) {
      if (this.state.batteryLevel < 20) {
        analysis.needsAdjustment = true;
        analysis.direction = 'decrease';
        analysis.urgency = Math.max(analysis.urgency, 0.7);
        analysis.reasons.push('Low battery - reducing quality');
      }
    }

    return analysis;
  }

  /**
   * Make adjustments
   * @param {Object} analysis - Analysis result
   */
  makeAdjustments(analysis) {
    console.info(`[AutoTuning] Making adjustments (${analysis.direction}, urgency: ${analysis.urgency.toFixed(2)})`);
    console.info(`[AutoTuning] Reasons: ${analysis.reasons.join(', ')}`);

    const adjustmentAmount = analysis.urgency * this.config.aggressiveness;

    if (analysis.direction === 'decrease') {
      this.decreaseQuality(adjustmentAmount);
    } else if (analysis.direction === 'increase') {
      this.increaseQuality(adjustmentAmount);
    }

    // Record adjustment
    this.recordAdjustment(analysis);
  }

  /**
   * Decrease quality settings
   * @param {number} amount - Adjustment amount (0-1)
   */
  decreaseQuality(amount) {
    const changes = [];

    // Adjust FFR (most effective)
    if (this.vrIntegrator.systems.ffr && this.vrIntegrator.capabilities.ffrSupported) {
      const newFFR = Math.min(1.0, this.tuningParams.ffrLevel + amount * 0.2);
      this.tuningParams.ffrLevel = newFFR;
      this.vrIntegrator.systems.ffr.setFoveationLevel(newFFR, 'auto-tune');
      changes.push(`FFR: ${newFFR.toFixed(2)}`);
    }

    // Reduce MSAA
    if (amount > 0.5) {
      this.tuningParams.msaa = Math.max(0, this.tuningParams.msaa - 2);
      changes.push(`MSAA: ${this.tuningParams.msaa}x`);
    }

    // Reduce shadow quality
    if (amount > 0.7) {
      const shadowLevels = ['off', 'low', 'medium', 'high', 'ultra'];
      const currentIndex = shadowLevels.indexOf(this.tuningParams.shadowQuality);
      if (currentIndex > 0) {
        this.tuningParams.shadowQuality = shadowLevels[currentIndex - 1];
        changes.push(`Shadows: ${this.tuningParams.shadowQuality}`);
      }
    }

    // Reduce LOD bias
    if (amount > 0.4) {
      this.tuningParams.lodBias = Math.max(0.3, this.tuningParams.lodBias - 0.2);
      changes.push(`LOD: ${this.tuningParams.lodBias.toFixed(1)}`);
    }

    console.info(`[AutoTuning] Quality decreased: ${changes.join(', ')}`);
  }

  /**
   * Increase quality settings
   * @param {number} amount - Adjustment amount (0-1)
   */
  increaseQuality(amount) {
    const changes = [];

    // Reduce FFR
    if (this.vrIntegrator.systems.ffr && this.vrIntegrator.capabilities.ffrSupported) {
      const newFFR = Math.max(0.0, this.tuningParams.ffrLevel - amount * 0.1);
      this.tuningParams.ffrLevel = newFFR;
      this.vrIntegrator.systems.ffr.setFoveationLevel(newFFR, 'auto-tune');
      changes.push(`FFR: ${newFFR.toFixed(2)}`);
    }

    // Increase MSAA (cautiously)
    if (amount > 0.5 && this.tuningParams.msaa < 4) {
      this.tuningParams.msaa = Math.min(8, this.tuningParams.msaa + 2);
      changes.push(`MSAA: ${this.tuningParams.msaa}x`);
    }

    // Increase shadow quality
    if (amount > 0.7) {
      const shadowLevels = ['off', 'low', 'medium', 'high', 'ultra'];
      const currentIndex = shadowLevels.indexOf(this.tuningParams.shadowQuality);
      if (currentIndex < shadowLevels.length - 1) {
        this.tuningParams.shadowQuality = shadowLevels[currentIndex + 1];
        changes.push(`Shadows: ${this.tuningParams.shadowQuality}`);
      }
    }

    console.info(`[AutoTuning] Quality increased: ${changes.join(', ')}`);
  }

  /**
   * Record adjustment
   * @param {Object} analysis - Analysis result
   */
  recordAdjustment(analysis) {
    this.adjustmentHistory.push({
      timestamp: Date.now(),
      fps: this.state.averageFPS,
      direction: analysis.direction,
      urgency: analysis.urgency,
      reasons: analysis.reasons,
      settings: { ...this.tuningParams }
    });

    // Keep history limited
    if (this.adjustmentHistory.length > this.maxHistoryLength) {
      this.adjustmentHistory.shift();
    }
  }

  /**
   * Estimate CPU load
   * @param {Object} status - System status
   * @returns {number} Estimated CPU load (0-100)
   */
  estimateCPULoad(status) {
    let load = 50; // Base load

    if (status.capabilities.multiviewSupported) {
      load -= 20;
    }

    return Math.max(0, Math.min(100, load));
  }

  /**
   * Estimate GPU load
   * @param {Object} status - System status
   * @returns {number} Estimated GPU load (0-100)
   */
  estimateGPULoad(status) {
    let load = 70; // Base load

    if (status.capabilities.ffrSupported && status.systems.ffr) {
      const ffrReduction = status.systems.ffr.currentLevel * 40;
      load -= ffrReduction;
    }

    return Math.max(0, Math.min(100, load));
  }

  /**
   * Estimate memory usage
   * @returns {number} Memory usage percentage
   */
  estimateMemoryUsage() {
    if (performance.memory) {
      const used = performance.memory.usedJSHeapSize;
      const limit = performance.memory.jsHeapSizeLimit;
      return (used / limit) * 100;
    }
    return 50; // Default
  }

  /**
   * Estimate temperature
   * @returns {number} Temperature in Celsius
   */
  estimateTemperature() {
    // Placeholder - actual temperature monitoring requires native APIs
    // Estimate based on performance degradation
    if (this.state.averageFPS < this.config.minFPS - 10) {
      return 50; // Likely thermal throttling
    }
    return 40; // Normal
  }

  /**
   * Get battery level
   * @returns {number} Battery percentage
   */
  getBatteryLevel() {
    if (navigator.getBattery) {
      navigator.getBattery().then(battery => {
        return battery.level * 100;
      });
    }
    return 100; // Default (unknown)
  }

  /**
   * Get thermal state
   * @returns {string} Thermal state
   */
  getThermalState() {
    const temp = this.state.temperature;

    if (temp > 50) return 'critical';
    if (temp > 45) return 'serious';
    if (temp > 40) return 'fair';
    return 'nominal';
  }

  /**
   * Get current state
   * @returns {Object} State information
   */
  getState() {
    return {
      ...this.state,
      enabled: this.enabled,
      tuningParams: { ...this.tuningParams },
      adjustmentCount: this.adjustmentHistory.length
    };
  }

  /**
   * Get adjustment history
   * @returns {Array} Adjustment history
   */
  getHistory() {
    return this.adjustmentHistory;
  }

  /**
   * Reset tuning parameters
   */
  reset() {
    this.tuningParams = {
      ffrLevel: 0.5,
      msaa: 4,
      shadowQuality: 'high',
      postProcessing: 'medium',
      lodBias: 1.0,
      textureQuality: 'high',
      particleLimit: 1000,
      drawDistance: 100
    };

    this.adjustmentHistory = [];
    console.info('[AutoTuning] Parameters reset');
  }

  /**
   * Get usage example
   * @returns {string} Code example
   */
  static getUsageExample() {
    return `
// Initialize auto-tuning
const autoTuning = new VRAutoTuningSystem(vrIntegrator);

// Configure
autoTuning.config.targetFPS = 90;
autoTuning.config.aggressiveness = 0.7; // More aggressive tuning
autoTuning.config.enableThermalManagement = true;
autoTuning.config.enableBatteryOptimization = true;

// Start auto-tuning
autoTuning.start();

// Get current state
const state = autoTuning.getState();
console.log('FPS:', state.averageFPS);
console.log('Thermal:', state.thermalState);
console.log('FFR:', state.tuningParams.ffrLevel);

// Get adjustment history
const history = autoTuning.getHistory();
console.log('Adjustments made:', history.length);

// Stop auto-tuning
// autoTuning.stop();

// Reset to defaults
// autoTuning.reset();
`;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRAutoTuningSystem;
}

// Global instance
window.VRAutoTuningSystem = VRAutoTuningSystem;

console.info('[AutoTuning] VR Auto-Tuning System loaded');
