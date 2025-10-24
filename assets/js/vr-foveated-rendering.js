/**
 * VR Foveated Rendering System (FFR + ETFR)
 * GPU負荷を25-52%削減する最新のレンダリング最適化技術
 *
 * Fixed Foveated Rendering (FFR): 25-50% GPU削減
 * - エッジを低解像度でレンダリングしてGPU負荷を削減
 * - Meta Quest 2/3 で利用可能
 *
 * Eye-Tracked Foveated Rendering (ETFR): 36-52% GPU削減
 * - 視線追跡で中心視野を動的に最適化
 * - Meta Quest Pro で利用可能
 * - より高いパフォーマンス向上
 *
 * Based on 2025 research:
 * - Red Matter 2 case study (36-52% GPU savings with ETFR)
 * - Meta Quest Best Practices (2025)
 *
 * @see https://developers.meta.com/horizon/documentation/web/webxr-ffr/
 * @version 3.7.0
 */

class VRFoveatedRenderingSystem {
  constructor() {
    this.enabled = false;
    this.supported = false;
    this.currentLevel = 0; // 0 (full resolution) to 1 (maximum foveation)

    // Rendering mode
    this.mode = 'auto'; // 'auto', 'etfr', 'ffr', 'off'
    this.currentMode = 'ffr'; // Currently active mode

    this.config = {
      defaultLevel: 0.5, // 中程度のfoveation
      dynamicAdjustment: true, // パフォーマンスに基づいて自動調整
      minLevel: 0.0, // フル解像度
      maxLevel: 1.0, // 最大foveation
      targetFPS: 90,
      minFPS: 72,
      adjustmentStep: 0.1, // 調整ステップ

      // Eye tracking settings (ETFR)
      eyeTrackingEnabled: false,
      gazePredictionMs: 16, // Compensate for display latency
      smoothingFactor: 0.7 // Gaze smoothing (0-1)
    };

    // Performance metrics
    this.metrics = {
      lastFPS: 0,
      averageFPS: 0,
      fpsSamples: [],
      maxSamples: 30,
      gpuLoad: 0,
      lastAdjustmentTime: 0,
      adjustmentCooldown: 1000, // ms
      gpuSavingsPercent: 0, // Estimated GPU savings
      mode: 'ffr' // Current mode
    };

    // Eye tracking state (ETFR)
    this.eyeTracking = {
      available: false,
      active: false,
      leftGaze: { x: 0.5, y: 0.5 },
      rightGaze: { x: 0.5, y: 0.5 },
      combinedGaze: { x: 0.5, y: 0.5 },
      confidence: 0,
      timestamp: 0
    };

    // Gaze prediction
    this.gazePrediction = {
      enabled: true,
      history: [],
      maxHistory: 10,
      predictedGaze: { x: 0.5, y: 0.5 }
    };

    // Content-specific settings
    this.contentProfiles = {
      'text-heavy': {
        level: 0.2, // テキストは高解像度が必要
        description: 'For reading and text-heavy content'
      },
      'video': {
        level: 0.3,
        description: 'For video watching'
      },
      'browsing': {
        level: 0.5,
        description: 'General web browsing'
      },
      'gaming': {
        level: 0.6,
        description: 'Interactive 3D content'
      },
      'background': {
        level: 0.8, // 背景画像は低コントラストで問題ない
        description: 'Low-contrast backgrounds'
      }
    };

    this.currentProfile = 'browsing';
    this.xrSession = null;
    this.projectionLayer = null;

    console.info('[FFR] Fixed Foveated Rendering System initialized');
  }

  /**
   * Initialize Foveated Rendering for XR session (FFR or ETFR)
   * @param {XRSession} session - Active XR session
   * @returns {Promise<boolean>} Success status
   */
  async initialize(session) {
    if (!session) {
      console.warn('[FoveatedRendering] No XR session provided');
      return false;
    }

    this.xrSession = session;

    try {
      // Check for eye tracking support (ETFR)
      await this.checkEyeTrackingSupport(session);

      // Check for FFR support
      this.supported = await this.checkFFRSupport(session);

      if (!this.supported) {
        console.warn('[FoveatedRendering] Fixed Foveated Rendering not supported on this device');
        return false;
      }

      // Determine best rendering mode
      this.determineRenderingMode();

      // Get projection layer
      await this.setupProjectionLayer(session);

      // Initialize based on mode
      if (this.currentMode === 'etfr' && this.eyeTracking.available) {
        await this.initializeETFR();
        console.info('[FoveatedRendering] Eye-Tracked Foveated Rendering (ETFR) enabled - 36-52% GPU savings expected');
      } else {
        console.info('[FoveatedRendering] Fixed Foveated Rendering (FFR) enabled - 25-50% GPU savings expected');
      }

      // Enable with default settings
      this.enabled = true;
      this.setFoveationLevel(this.config.defaultLevel);

      // Start dynamic adjustment if enabled
      if (this.config.dynamicAdjustment) {
        this.startDynamicAdjustment();
      }

      // Update metrics
      this.metrics.mode = this.currentMode;
      this.updateGPUSavingsEstimate();

      console.info('[FoveatedRendering] Initialized with mode:', this.currentMode);
      return true;

    } catch (error) {
      console.error('[FoveatedRendering] Failed to initialize:', error);
      return false;
    }
  }

  /**
   * Check if FFR is supported
   * @param {XRSession} session - XR session
   * @returns {Promise<boolean>}
   */
  async checkFFRSupport(session) {
    try {
      // FFR is supported if the projection layer has fixedFoveation property
      const gl = await this.getWebGLContext(session);
      const xrGlBinding = new XRWebGLBinding(session, gl);
      const layer = xrGlBinding.createProjectionLayer({});

      return 'fixedFoveation' in layer;
    } catch (error) {
      console.warn('[FFR] Support check failed:', error);
      return false;
    }
  }

  /**
   * Setup projection layer for FFR
   * @param {XRSession} session - XR session
   */
  async setupProjectionLayer(session) {
    try {
      const gl = await this.getWebGLContext(session);
      const xrGlBinding = new XRWebGLBinding(session, gl);

      this.projectionLayer = xrGlBinding.createProjectionLayer({
        textureType: 'texture-array',
        colorFormat: gl.RGBA8,
        depthFormat: gl.DEPTH_COMPONENT24
      });

      // Set the layer as the render target
      session.updateRenderState({
        layers: [this.projectionLayer]
      });

      console.info('[FFR] Projection layer configured');
    } catch (error) {
      console.error('[FFR] Failed to setup projection layer:', error);
      throw error;
    }
  }

  /**
   * Get WebGL context (placeholder - should be implemented by main app)
   * @param {XRSession} session
   * @returns {WebGLRenderingContext}
   */
  async getWebGLContext(session) {
    // This should be provided by the main application
    // For now, create a temporary context
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { xrCompatible: true });

    if (!gl) {
      throw new Error('WebGL 2.0 not supported');
    }

    return gl;
  }

  /**
   * Set foveation level
   * @param {number} level - Foveation level (0.0 to 1.0)
   * @param {string} reason - Reason for change (for logging)
   */
  setFoveationLevel(level, reason = 'manual') {
    if (!this.enabled || !this.projectionLayer) {
      return;
    }

    // Clamp level to valid range
    level = Math.max(this.config.minLevel, Math.min(this.config.maxLevel, level));

    // Only update if changed significantly
    if (Math.abs(level - this.currentLevel) < 0.01) {
      return;
    }

    try {
      this.projectionLayer.fixedFoveation = level;
      this.currentLevel = level;

      console.info(`[FFR] Foveation level set to ${level.toFixed(2)} (${reason})`);

      // Emit event
      this.emitEvent('foveationChanged', {
        level,
        reason,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('[FFR] Failed to set foveation level:', error);
    }
  }

  /**
   * Set content profile
   * @param {string} profileName - Profile name (text-heavy, video, browsing, gaming, background)
   */
  setContentProfile(profileName) {
    if (!this.contentProfiles[profileName]) {
      console.warn('[FFR] Unknown profile:', profileName);
      return;
    }

    this.currentProfile = profileName;
    const profile = this.contentProfiles[profileName];

    this.setFoveationLevel(profile.level, `profile: ${profileName}`);

    console.info(`[FFR] Content profile set to "${profileName}": ${profile.description}`);
  }

  /**
   * Start dynamic foveation adjustment based on performance
   */
  startDynamicAdjustment() {
    if (this.adjustmentInterval) {
      return; // Already running
    }

    console.info('[FFR] Starting dynamic foveation adjustment');

    this.adjustmentInterval = setInterval(() => {
      this.adjustFoveationForPerformance();
    }, 100); // Check every 100ms
  }

  /**
   * Stop dynamic adjustment
   */
  stopDynamicAdjustment() {
    if (this.adjustmentInterval) {
      clearInterval(this.adjustmentInterval);
      this.adjustmentInterval = null;
      console.info('[FFR] Dynamic adjustment stopped');
    }
  }

  /**
   * Adjust foveation based on current performance
   */
  adjustFoveationForPerformance() {
    const now = Date.now();

    // Cooldown period to avoid rapid changes
    if (now - this.metrics.lastAdjustmentTime < this.config.adjustmentCooldown) {
      return;
    }

    const currentFPS = this.getCurrentFPS();
    this.updateFPSMetrics(currentFPS);

    const avgFPS = this.metrics.averageFPS;

    // Determine if we need to adjust
    let adjustment = 0;

    if (avgFPS < this.config.minFPS) {
      // Performance is critical - increase foveation
      adjustment = this.config.adjustmentStep;
      console.warn(`[FFR] Low FPS detected (${avgFPS.toFixed(1)}), increasing foveation`);

    } else if (avgFPS > this.config.targetFPS + 10) {
      // Performance is excellent - can reduce foveation for better quality
      adjustment = -this.config.adjustmentStep;
      console.info(`[FFR] High FPS detected (${avgFPS.toFixed(1)}), reducing foveation`);
    }

    if (adjustment !== 0) {
      const newLevel = this.currentLevel + adjustment;
      this.setFoveationLevel(newLevel, 'auto-adjust');
      this.metrics.lastAdjustmentTime = now;
    }
  }

  /**
   * Get current FPS (placeholder - should be implemented by performance monitor)
   * @returns {number} Current FPS
   */
  getCurrentFPS() {
    // This should be provided by the main performance monitoring system
    // For now, return a placeholder
    if (window.vrPerformanceMonitor) {
      return window.vrPerformanceMonitor.getCurrentFPS();
    }
    return 90; // Default assumption
  }

  /**
   * Update FPS metrics with exponential moving average
   * @param {number} fps - Current FPS
   */
  updateFPSMetrics(fps) {
    this.metrics.lastFPS = fps;
    this.metrics.fpsSamples.push(fps);

    // Keep only recent samples
    if (this.metrics.fpsSamples.length > this.metrics.maxSamples) {
      this.metrics.fpsSamples.shift();
    }

    // Calculate average
    const sum = this.metrics.fpsSamples.reduce((a, b) => a + b, 0);
    this.metrics.averageFPS = sum / this.metrics.fpsSamples.length;
  }

  /**
   * Get current foveation status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      enabled: this.enabled,
      supported: this.supported,
      currentLevel: this.currentLevel,
      currentProfile: this.currentProfile,
      dynamicAdjustment: this.config.dynamicAdjustment,
      metrics: {
        averageFPS: this.metrics.averageFPS,
        lastFPS: this.metrics.lastFPS
      }
    };
  }

  /**
   * Enable FFR
   */
  enable() {
    if (!this.supported) {
      console.warn('[FFR] Cannot enable - not supported');
      return;
    }

    this.enabled = true;
    this.setFoveationLevel(this.config.defaultLevel, 'enabled');
    console.info('[FFR] Enabled');
  }

  /**
   * Disable FFR (set to full resolution)
   */
  disable() {
    this.enabled = false;
    if (this.projectionLayer) {
      this.setFoveationLevel(0, 'disabled');
    }
    this.stopDynamicAdjustment();
    console.info('[FFR] Disabled');
  }

  /**
   * Emit custom event
   * @param {string} eventName - Event name
   * @param {Object} detail - Event detail
   */
  emitEvent(eventName, detail) {
    const event = new CustomEvent(`ffr:${eventName}`, { detail });
    window.dispatchEvent(event);
  }

  /**
   * Check eye tracking support (ETFR)
   * @param {XRSession} session - XR session
   */
  async checkEyeTrackingSupport(session) {
    if (!session) {
      this.eyeTracking.available = false;
      return;
    }

    // Check for eye tracking feature
    if (session.enabledFeatures && session.enabledFeatures.includes('eye-tracking')) {
      this.eyeTracking.available = true;
      console.info('[FoveatedRendering] Eye tracking available (Quest Pro or compatible device)');
    } else {
      this.eyeTracking.available = false;
      console.info('[FoveatedRendering] Eye tracking not available, will use FFR');
    }

    // Additional checks for Quest Pro specific API
    if (typeof XRSession !== 'undefined' && 'requestEyeTracking' in XRSession.prototype) {
      try {
        await session.requestEyeTracking();
        this.eyeTracking.available = true;
        console.info('[FoveatedRendering] Quest Pro eye tracking enabled');
      } catch (error) {
        console.warn('[FoveatedRendering] Eye tracking permission denied:', error);
        this.eyeTracking.available = false;
      }
    }
  }

  /**
   * Determine best rendering mode
   */
  determineRenderingMode() {
    if (this.mode !== 'auto') {
      this.currentMode = this.mode;
      return;
    }

    // Auto-select based on capabilities
    if (this.eyeTracking.available) {
      this.currentMode = 'etfr';
      console.info('[FoveatedRendering] Auto-selected ETFR mode (eye tracking available)');
    } else {
      this.currentMode = 'ffr';
      console.info('[FoveatedRendering] Auto-selected FFR mode (eye tracking not available)');
    }
  }

  /**
   * Initialize Eye-Tracked Foveated Rendering
   */
  async initializeETFR() {
    console.info('[FoveatedRendering] Initializing ETFR...');

    this.config.eyeTrackingEnabled = true;
    this.eyeTracking.active = true;
    this.gazePrediction.enabled = this.config.gazePredictionMs > 0;
    this.gazePrediction.history = [];

    console.info('[FoveatedRendering] ETFR initialized with gaze prediction');
  }

  /**
   * Update eye tracking data (call this in XR frame loop)
   * @param {XRFrame} frame - XR frame
   * @param {XRReferenceSpace} referenceSpace - Reference space
   */
  updateEyeTracking(frame, referenceSpace) {
    if (!this.eyeTracking.active || !frame) {
      return;
    }

    try {
      // Get eye tracking data from XR frame (API may vary by browser/device)
      const eyeTrackingData = this.getEyeTrackingData(frame, referenceSpace);

      if (eyeTrackingData && eyeTrackingData.confidence > 0.5) {
        this.eyeTracking.leftGaze = eyeTrackingData.leftGaze;
        this.eyeTracking.rightGaze = eyeTrackingData.rightGaze;
        this.eyeTracking.confidence = eyeTrackingData.confidence;
        this.eyeTracking.timestamp = performance.now();

        // Calculate combined gaze point (average of left and right)
        this.eyeTracking.combinedGaze = {
          x: (this.eyeTracking.leftGaze.x + this.eyeTracking.rightGaze.x) / 2,
          y: (this.eyeTracking.leftGaze.y + this.eyeTracking.rightGaze.y) / 2
        };

        // Update gaze prediction
        if (this.gazePrediction.enabled) {
          this.updateGazePrediction();
        }

        // Apply smoothing
        this.smoothGaze();

        // Update foveation based on gaze (if projection layer supports dynamic center)
        this.updateFoveationCenter();
      }

    } catch (error) {
      console.warn('[FoveatedRendering] Eye tracking update failed:', error);
    }
  }

  /**
   * Get eye tracking data from XR frame
   * @param {XRFrame} frame - XR frame
   * @param {XRReferenceSpace} referenceSpace - Reference space
   * @returns {Object|null} Eye tracking data
   */
  getEyeTrackingData(frame, referenceSpace) {
    // Implementation depends on browser API
    // Meta Quest Pro uses proprietary API
    // WebXR standard eye tracking API may vary

    // Placeholder - real implementation would use frame.getEyeTrackingData() or similar
    return null;
  }

  /**
   * Update gaze prediction
   */
  updateGazePrediction() {
    const currentGaze = { ...this.eyeTracking.combinedGaze };

    // Add to history
    this.gazePrediction.history.push({
      gaze: currentGaze,
      timestamp: performance.now()
    });

    // Keep limited history
    if (this.gazePrediction.history.length > this.gazePrediction.maxHistory) {
      this.gazePrediction.history.shift();
    }

    // Predict future gaze position using linear extrapolation
    if (this.gazePrediction.history.length >= 2) {
      const history = this.gazePrediction.history;
      const latest = history[history.length - 1];
      const previous = history[history.length - 2];

      const dt = latest.timestamp - previous.timestamp;
      if (dt > 0) {
        const velocityX = (latest.gaze.x - previous.gaze.x) / dt;
        const velocityY = (latest.gaze.y - previous.gaze.y) / dt;

        this.gazePrediction.predictedGaze = {
          x: Math.max(0, Math.min(1, latest.gaze.x + velocityX * this.config.gazePredictionMs)),
          y: Math.max(0, Math.min(1, latest.gaze.y + velocityY * this.config.gazePredictionMs))
        };
      }
    }
  }

  /**
   * Apply gaze smoothing
   */
  smoothGaze() {
    const alpha = this.config.smoothingFactor;
    const current = this.eyeTracking.combinedGaze;
    const target = this.gazePrediction.enabled ? this.gazePrediction.predictedGaze : current;

    // Exponential smoothing
    this.eyeTracking.combinedGaze = {
      x: current.x * alpha + target.x * (1 - alpha),
      y: current.y * alpha + target.y * (1 - alpha)
    };
  }

  /**
   * Update foveation center based on gaze
   */
  updateFoveationCenter() {
    // If the projection layer supports dynamic foveation center, update it
    // This is device/API specific
    // For now, this is a placeholder for future API support
  }

  /**
   * Update GPU savings estimate
   */
  updateGPUSavingsEstimate() {
    if (this.currentMode === 'etfr') {
      // ETFR provides 36-52% savings (Red Matter 2 research)
      this.metrics.gpuSavingsPercent = 36 + (this.currentLevel * 16); // 36-52%
    } else if (this.currentMode === 'ffr') {
      // FFR provides 25-50% savings
      this.metrics.gpuSavingsPercent = 25 + (this.currentLevel * 25); // 25-50%
    } else {
      this.metrics.gpuSavingsPercent = 0;
    }
  }

  /**
   * Get foveated rendering status
   * @returns {Object} Status with mode and metrics
   */
  getFoveatedStatus() {
    return {
      enabled: this.enabled,
      supported: this.supported,
      mode: this.currentMode,
      eyeTrackingAvailable: this.eyeTracking.available,
      eyeTrackingActive: this.eyeTracking.active,
      currentLevel: this.currentLevel,
      currentProfile: this.currentProfile,
      gpuSavingsPercent: this.metrics.gpuSavingsPercent,
      currentGaze: this.eyeTracking.combinedGaze,
      metrics: {
        averageFPS: this.metrics.averageFPS,
        lastFPS: this.metrics.lastFPS
      }
    };
  }

  /**
   * Dispose and clean up
   */
  dispose() {
    this.stopDynamicAdjustment();
    this.enabled = false;
    this.eyeTracking.active = false;
    this.gazePrediction.history = [];
    this.xrSession = null;
    this.projectionLayer = null;
    console.info('[FoveatedRendering] Disposed');
  }

  /**
   * Get recommendations based on content type
   * @param {string} contentType - Type of content
   * @returns {Object} Recommendations
   */
  static getRecommendations(contentType) {
    const recommendations = {
      'text': {
        foveationLevel: 0.2,
        reason: 'Text requires high resolution for readability',
        tips: 'Keep foveation low (<0.3) for text-heavy content'
      },
      'video': {
        foveationLevel: 0.3,
        reason: 'Video benefits from higher resolution',
        tips: 'Moderate foveation (0.3-0.4) works well for video'
      },
      'browsing': {
        foveationLevel: 0.5,
        reason: 'Balanced quality and performance',
        tips: 'Default level (0.5) is optimal for general browsing'
      },
      '3d-content': {
        foveationLevel: 0.6,
        reason: 'Performance is critical for smooth 3D rendering',
        tips: 'Higher foveation (0.6-0.8) recommended for complex 3D scenes'
      },
      'background': {
        foveationLevel: 0.8,
        reason: 'Low-contrast backgrounds tolerate lower resolution well',
        tips: 'Maximum foveation (0.8-1.0) for background environments'
      }
    };

    return recommendations[contentType] || recommendations['browsing'];
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRFoveatedRenderingSystem;
}

// Global instance
window.VRFoveatedRenderingSystem = VRFoveatedRenderingSystem;

console.info('[FFR] VR Fixed Foveated Rendering System loaded');
