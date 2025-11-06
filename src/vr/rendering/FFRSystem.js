/**
 * Fixed Foveated Rendering (FFR) System
 * Reduces GPU load by 25-40% by lowering resolution at screen edges
 *
 * John Carmack principle: Simple, effective, necessary
 */

export class FFRSystem {
  constructor() {
    this.enabled = false;
    this.intensity = 0.5; // 0-1 range
    this.projectionLayer = null;
    this.glBinding = null;
    this.gpuLoadThresholds = {
      high: 0.85,    // >85% GPU = aggressive foveation
      medium: 0.75,  // >75% GPU = medium foveation
      low: 0.5       // <50% GPU = light foveation
    };
  }

  /**
   * Initialize FFR with WebXR session
   * @param {XRSession} session - Active WebXR session
   * @param {WebGLRenderingContext} gl - WebGL context
   */
  async initialize(session, gl) {
    if (!session || !gl) {
      console.warn('FFRSystem: Invalid session or GL context');
      return false;
    }

    try {
      // Create XR WebGL binding
      this.glBinding = new XRWebGLBinding(session, gl);

      // Get projection layer for FFR control
      this.projectionLayer = this.glBinding.getProjectionLayer();

      if (!this.projectionLayer) {
        console.warn('FFRSystem: No projection layer available');
        return false;
      }

      // Check if FFR is supported
      if (typeof this.projectionLayer.fixedFoveation === 'undefined') {
        console.warn('FFRSystem: Fixed foveation not supported on this device');
        return false;
      }

      this.enabled = true;
      console.log('FFRSystem: Initialized successfully');
      return true;
    } catch (error) {
      console.error('FFRSystem: Initialization error', error);
      return false;
    }
  }

  /**
   * Enable FFR with specified intensity
   * @param {number} intensity - Foveation level (0-1)
   */
  enable(intensity = 0.5) {
    if (!this.enabled || !this.projectionLayer) {
      console.warn('FFRSystem: Not initialized');
      return;
    }

    // Clamp intensity between 0 and 1
    this.intensity = Math.max(0, Math.min(1, intensity));
    this.projectionLayer.fixedFoveation = this.intensity;

    console.log(`FFRSystem: Enabled with intensity ${this.intensity}`);
  }

  /**
   * Disable FFR (set to no foveation)
   */
  disable() {
    if (!this.enabled || !this.projectionLayer) {
      return;
    }

    this.projectionLayer.fixedFoveation = 0;
    console.log('FFRSystem: Disabled');
  }

  /**
   * Dynamically adjust FFR based on GPU load
   * @param {number} gpuLoad - Current GPU load (0-1)
   */
  setDynamicFFR(gpuLoad) {
    if (!this.enabled || !this.projectionLayer) {
      return;
    }

    let targetIntensity;

    if (gpuLoad > this.gpuLoadThresholds.high) {
      // High GPU load: aggressive foveation
      targetIntensity = 0.8;
    } else if (gpuLoad > this.gpuLoadThresholds.medium) {
      // Medium GPU load: moderate foveation
      targetIntensity = 0.5;
    } else if (gpuLoad > this.gpuLoadThresholds.low) {
      // Low-medium GPU load: light foveation
      targetIntensity = 0.2;
    } else {
      // Very low GPU load: minimal foveation
      targetIntensity = 0.1;
    }

    // Smooth transition to avoid jarring changes
    this.intensity += (targetIntensity - this.intensity) * 0.1;
    this.projectionLayer.fixedFoveation = this.intensity;
  }

  /**
   * Get current FFR status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      intensity: this.intensity,
      supported: this.projectionLayer !== null
    };
  }

  /**
   * Set GPU load thresholds for dynamic adjustment
   */
  setThresholds(high = 0.85, medium = 0.75, low = 0.5) {
    this.gpuLoadThresholds = { high, medium, low };
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.disable();
    this.projectionLayer = null;
    this.glBinding = null;
    this.enabled = false;
  }
}

/**
 * Usage Example:
 *
 * const ffrSystem = new FFRSystem();
 *
 * // In XR session start
 * await ffrSystem.initialize(xrSession, gl);
 * ffrSystem.enable(0.5); // Medium foveation
 *
 * // In render loop
 * const gpuLoad = performanceMonitor.getGPULoad();
 * ffrSystem.setDynamicFFR(gpuLoad);
 *
 * // Cleanup
 * ffrSystem.dispose();
 */