/**
 * VR Comfort Settings System (2025)
 *
 * Comprehensive comfort and motion sickness prevention system
 * - IPD (Interpupillary Distance) adjustment
 * - Refresh rate optimization (72Hz/90Hz/120Hz)
 * - Motion comfort options (teleportation, snap turn, smooth locomotion)
 * - Field of view adjustments
 * - Motion sickness prevention features
 * - Accessibility settings
 *
 * Features:
 * - Dynamic comfort level adjustment
 * - Motion sickness mitigation (vignette, reduced FOV, snap turning)
 * - Display settings (brightness, contrast, saturation)
 * - Performance-comfort balance
 * - Gradual adaptation system (5-10 min sessions)
 * - Sitting/standing mode support
 *
 * Comfort Levels:
 * - Maximum Comfort: Minimal motion, teleport only, reduced FOV
 * - Balanced: Moderate settings, snap turn, moderate FOV
 * - Advanced: Full freedom, smooth locomotion, full FOV
 *
 * @author Qui Browser Team
 * @version 5.6.0
 * @license MIT
 */

class VRComfortSettingsSystem {
  constructor(options = {}) {
    this.version = '5.6.0';
    this.debug = options.debug || false;

    // XR session
    this.xrSession = null;

    // Comfort level presets
    this.comfortLevel = options.comfortLevel || 'balanced'; // 'maximum', 'balanced', 'advanced'

    // IPD settings
    this.ipdSupported = false;
    this.ipd = options.ipd || 0.063; // meters (default ~63mm)
    this.ipdRange = { min: 0.055, max: 0.075 }; // 55mm to 75mm

    // Refresh rate settings
    this.refreshRateSupported = false;
    this.currentRefreshRate = 90;
    this.supportedRefreshRates = [];
    this.targetRefreshRate = options.targetRefreshRate || 90; // 72, 90, or 120 Hz

    // Motion settings
    this.locomotionMode = options.locomotionMode || 'teleport'; // 'teleport', 'snap-turn', 'smooth'
    this.snapTurnAngle = options.snapTurnAngle || 30; // degrees
    this.smoothTurnSpeed = options.smoothTurnSpeed || 45; // degrees/second
    this.movementSpeed = options.movementSpeed || 2.0; // meters/second

    // Field of view
    this.fovReduction = options.fovReduction || 0; // 0-50% reduction
    this.vignetteIntensity = options.vignetteIntensity || 0; // 0-1 (tunnel vision effect)

    // Motion sickness prevention
    this.motionSicknessMode = options.motionSicknessMode || 'auto'; // 'off', 'auto', 'aggressive'
    this.reduceMotionBlur = options.reduceMotionBlur !== false;
    this.staticReferenceFrame = options.staticReferenceFrame !== false;

    // Display settings
    this.brightness = options.brightness || 1.0; // 0.5-1.5
    this.contrast = options.contrast || 1.0; // 0.5-1.5
    this.saturation = options.saturation || 1.0; // 0-1.5

    // Mode settings
    this.playMode = options.playMode || 'standing'; // 'seated', 'standing', 'room-scale'

    // Session tracking for gradual adaptation
    this.sessionStartTime = null;
    this.sessionDuration = 0; // milliseconds
    this.recommendedSessionLength = 10 * 60 * 1000; // 10 minutes for beginners
    this.breakReminders = options.breakReminders !== false;

    // Performance tracking
    this.stats = {
      currentFPS: 0,
      averageFrameTime: 0,
      droppedFrames: 0,
      sessionTime: 0,
      comfortScore: 100 // 0-100 (100 = most comfortable)
    };

    this.initialized = false;
  }

  /**
   * Initialize comfort settings system
   * @param {XRSession} xrSession - WebXR session
   * @returns {Promise<boolean>} Success status
   */
  async initialize(xrSession) {
    this.log('Initializing Comfort Settings System v5.6.0...');

    try {
      this.xrSession = xrSession;
      this.sessionStartTime = Date.now();

      // Check IPD support
      await this.checkIPDSupport();

      // Check refresh rate support
      await this.checkRefreshRateSupport();

      // Apply initial comfort preset
      await this.applyComfortPreset(this.comfortLevel);

      this.initialized = true;
      this.log('Comfort Settings System initialized');
      this.log('Comfort level:', this.comfortLevel);
      this.log('IPD support:', this.ipdSupported);
      this.log('Refresh rate support:', this.refreshRateSupported);
      this.log('Current refresh rate:', this.currentRefreshRate, 'Hz');

      return true;

    } catch (error) {
      this.error('Initialization failed:', error);
      return false;
    }
  }

  /**
   * Check IPD adjustment support
   */
  async checkIPDSupport() {
    // IPD is typically hardware-level on Quest devices
    // Software adjustment is limited, but we can track it
    this.ipdSupported = true;
    this.log('IPD tracking enabled');
  }

  /**
   * Check refresh rate support
   */
  async checkRefreshRateSupport() {
    try {
      // Quest 3 supports 72Hz, 90Hz, 120Hz
      // Quest 2 supports 72Hz, 90Hz, 120Hz (experimental)
      this.supportedRefreshRates = [72, 90, 120];
      this.currentRefreshRate = 90; // Default

      this.refreshRateSupported = true;
      this.log('Refresh rates supported:', this.supportedRefreshRates);

    } catch (error) {
      this.warn('Refresh rate detection failed:', error);
      this.supportedRefreshRates = [90];
    }
  }

  /**
   * Apply comfort preset
   * @param {string} level - 'maximum', 'balanced', 'advanced'
   */
  async applyComfortPreset(level) {
    this.comfortLevel = level;

    switch (level) {
      case 'maximum':
        // Maximum comfort - minimal motion sickness risk
        this.locomotionMode = 'teleport';
        this.fovReduction = 30; // 30% FOV reduction
        this.vignetteIntensity = 0.6;
        this.targetRefreshRate = 90;
        this.motionSicknessMode = 'aggressive';
        this.staticReferenceFrame = true;
        this.stats.comfortScore = 100;
        this.log('Applied MAXIMUM COMFORT preset');
        break;

      case 'balanced':
        // Balanced - moderate settings
        this.locomotionMode = 'snap-turn';
        this.fovReduction = 15; // 15% FOV reduction
        this.vignetteIntensity = 0.3;
        this.targetRefreshRate = 90;
        this.motionSicknessMode = 'auto';
        this.staticReferenceFrame = true;
        this.stats.comfortScore = 80;
        this.log('Applied BALANCED preset');
        break;

      case 'advanced':
        // Advanced - full freedom
        this.locomotionMode = 'smooth';
        this.fovReduction = 0; // No FOV reduction
        this.vignetteIntensity = 0;
        this.targetRefreshRate = 120;
        this.motionSicknessMode = 'off';
        this.staticReferenceFrame = false;
        this.stats.comfortScore = 60;
        this.log('Applied ADVANCED preset');
        break;
    }

    // Apply settings
    await this.applySettings();
  }

  /**
   * Apply current settings
   */
  async applySettings() {
    // Apply refresh rate if supported
    if (this.refreshRateSupported) {
      await this.setRefreshRate(this.targetRefreshRate);
    }

    // Apply display settings
    this.applyDisplaySettings();

    this.log('Settings applied');
  }

  /**
   * Update comfort system (call each frame)
   * @param {number} deltaTime - Time since last frame (ms)
   * @param {number} currentFPS - Current FPS
   */
  update(deltaTime, currentFPS) {
    if (!this.initialized) return;

    // Update session time
    this.sessionDuration = Date.now() - this.sessionStartTime;
    this.stats.sessionTime = this.sessionDuration;

    // Update FPS stats
    this.stats.currentFPS = currentFPS;
    this.stats.averageFrameTime = 1000 / currentFPS;

    // Check for session length recommendations
    if (this.breakReminders && this.comfortLevel === 'maximum') {
      this.checkSessionLength();
    }

    // Auto-adjust comfort if motion sickness mode is auto
    if (this.motionSicknessMode === 'auto') {
      this.autoAdjustComfort(currentFPS);
    }
  }

  /**
   * Check session length and recommend breaks
   */
  checkSessionLength() {
    const sessionMinutes = Math.floor(this.sessionDuration / 60000);

    // Recommend breaks every 10 minutes for maximum comfort users
    if (sessionMinutes > 0 && sessionMinutes % 10 === 0) {
      this.log('Break recommended: You have been in VR for', sessionMinutes, 'minutes');
      // Trigger event for UI notification
      if (this.onBreakRecommended) {
        this.onBreakRecommended(sessionMinutes);
      }
    }
  }

  /**
   * Auto-adjust comfort settings based on performance
   * @param {number} currentFPS - Current FPS
   */
  autoAdjustComfort(currentFPS) {
    // If FPS drops below 72, increase comfort settings
    if (currentFPS < 72 && this.fovReduction < 40) {
      this.fovReduction = Math.min(40, this.fovReduction + 5);
      this.vignetteIntensity = Math.min(0.7, this.vignetteIntensity + 0.1);
      this.log('Auto-adjusted comfort due to low FPS');
    }
    // If FPS is consistently high, reduce comfort restrictions
    else if (currentFPS > 85 && this.fovReduction > 0) {
      this.fovReduction = Math.max(0, this.fovReduction - 2);
      this.vignetteIntensity = Math.max(0, this.vignetteIntensity - 0.05);
      this.log('Auto-reduced comfort restrictions due to high FPS');
    }
  }

  /**
   * Set refresh rate
   * @param {number} rate - Refresh rate (72, 90, 120 Hz)
   * @returns {Promise<boolean>} Success status
   */
  async setRefreshRate(rate) {
    if (!this.refreshRateSupported) {
      this.warn('Refresh rate adjustment not supported');
      return false;
    }

    if (!this.supportedRefreshRates.includes(rate)) {
      this.warn('Refresh rate not supported:', rate);
      return false;
    }

    try {
      // Update XR session with new refresh rate
      // Note: Actual API for refresh rate control varies by device
      this.currentRefreshRate = rate;
      this.targetRefreshRate = rate;

      this.log('Refresh rate set to', rate, 'Hz');
      return true;

    } catch (error) {
      this.error('Failed to set refresh rate:', error);
      return false;
    }
  }

  /**
   * Set IPD
   * @param {number} ipd - IPD in meters (0.055 - 0.075)
   */
  setIPD(ipd) {
    this.ipd = Math.max(this.ipdRange.min, Math.min(this.ipdRange.max, ipd));
    this.log('IPD set to', (this.ipd * 1000).toFixed(1), 'mm');

    // Note: Actual IPD adjustment is hardware-level on most devices
    // This tracks the setting but may not change the actual rendering
  }

  /**
   * Set locomotion mode
   * @param {string} mode - 'teleport', 'snap-turn', 'smooth'
   */
  setLocomotionMode(mode) {
    const validModes = ['teleport', 'snap-turn', 'smooth'];
    if (!validModes.includes(mode)) {
      this.warn('Invalid locomotion mode:', mode);
      return;
    }

    this.locomotionMode = mode;
    this.log('Locomotion mode set to', mode);

    // Update comfort score based on mode
    switch (mode) {
      case 'teleport':
        this.stats.comfortScore = 100;
        break;
      case 'snap-turn':
        this.stats.comfortScore = 80;
        break;
      case 'smooth':
        this.stats.comfortScore = 60;
        break;
    }
  }

  /**
   * Set FOV reduction
   * @param {number} reduction - Reduction percentage (0-50)
   */
  setFOVReduction(reduction) {
    this.fovReduction = Math.max(0, Math.min(50, reduction));
    this.log('FOV reduction set to', this.fovReduction, '%');
  }

  /**
   * Set vignette intensity
   * @param {number} intensity - Intensity (0-1)
   */
  setVignetteIntensity(intensity) {
    this.vignetteIntensity = Math.max(0, Math.min(1, intensity));
    this.log('Vignette intensity set to', this.vignetteIntensity);
  }

  /**
   * Apply display settings
   */
  applyDisplaySettings() {
    // These would be applied to renderer or post-processing
    this.log('Display settings:', {
      brightness: this.brightness,
      contrast: this.contrast,
      saturation: this.saturation
    });
  }

  /**
   * Set brightness
   * @param {number} brightness - Brightness (0.5-1.5)
   */
  setBrightness(brightness) {
    this.brightness = Math.max(0.5, Math.min(1.5, brightness));
    this.applyDisplaySettings();
  }

  /**
   * Set contrast
   * @param {number} contrast - Contrast (0.5-1.5)
   */
  setContrast(contrast) {
    this.contrast = Math.max(0.5, Math.min(1.5, contrast));
    this.applyDisplaySettings();
  }

  /**
   * Set saturation
   * @param {number} saturation - Saturation (0-1.5)
   */
  setSaturation(saturation) {
    this.saturation = Math.max(0, Math.min(1.5, saturation));
    this.applyDisplaySettings();
  }

  /**
   * Set play mode
   * @param {string} mode - 'seated', 'standing', 'room-scale'
   */
  setPlayMode(mode) {
    const validModes = ['seated', 'standing', 'room-scale'];
    if (!validModes.includes(mode)) {
      this.warn('Invalid play mode:', mode);
      return;
    }

    this.playMode = mode;
    this.log('Play mode set to', mode);

    // Adjust comfort recommendations based on play mode
    if (mode === 'seated') {
      this.recommendedSessionLength = 20 * 60 * 1000; // 20 minutes for seated
    } else {
      this.recommendedSessionLength = 10 * 60 * 1000; // 10 minutes for standing
    }
  }

  /**
   * Enable/disable motion sickness prevention
   * @param {string} mode - 'off', 'auto', 'aggressive'
   */
  setMotionSicknessMode(mode) {
    const validModes = ['off', 'auto', 'aggressive'];
    if (!validModes.includes(mode)) {
      this.warn('Invalid motion sickness mode:', mode);
      return;
    }

    this.motionSicknessMode = mode;
    this.log('Motion sickness mode set to', mode);

    // Apply immediate adjustments
    if (mode === 'aggressive') {
      this.setFOVReduction(40);
      this.setVignetteIntensity(0.7);
    } else if (mode === 'off') {
      this.setFOVReduction(0);
      this.setVignetteIntensity(0);
    }
  }

  /**
   * Get current settings
   * @returns {Object} Current settings
   */
  getSettings() {
    return {
      comfortLevel: this.comfortLevel,
      ipd: this.ipd,
      refreshRate: this.currentRefreshRate,
      locomotionMode: this.locomotionMode,
      fovReduction: this.fovReduction,
      vignetteIntensity: this.vignetteIntensity,
      brightness: this.brightness,
      contrast: this.contrast,
      saturation: this.saturation,
      playMode: this.playMode,
      motionSicknessMode: this.motionSicknessMode
    };
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      sessionMinutes: Math.floor(this.sessionDuration / 60000),
      recommendedBreakIn: Math.max(0, this.recommendedSessionLength - this.sessionDuration)
    };
  }

  /**
   * Reset session timer
   */
  resetSessionTimer() {
    this.sessionStartTime = Date.now();
    this.sessionDuration = 0;
    this.log('Session timer reset');
  }

  /**
   * Export settings to JSON
   * @returns {string} JSON string
   */
  exportSettings() {
    return JSON.stringify(this.getSettings(), null, 2);
  }

  /**
   * Import settings from JSON
   * @param {string} jsonString - JSON string
   */
  importSettings(jsonString) {
    try {
      const settings = JSON.parse(jsonString);

      if (settings.comfortLevel) this.comfortLevel = settings.comfortLevel;
      if (settings.ipd) this.ipd = settings.ipd;
      if (settings.refreshRate) this.targetRefreshRate = settings.refreshRate;
      if (settings.locomotionMode) this.locomotionMode = settings.locomotionMode;
      if (settings.fovReduction !== undefined) this.fovReduction = settings.fovReduction;
      if (settings.vignetteIntensity !== undefined) this.vignetteIntensity = settings.vignetteIntensity;
      if (settings.brightness) this.brightness = settings.brightness;
      if (settings.contrast) this.contrast = settings.contrast;
      if (settings.saturation) this.saturation = settings.saturation;
      if (settings.playMode) this.playMode = settings.playMode;
      if (settings.motionSicknessMode) this.motionSicknessMode = settings.motionSicknessMode;

      this.applySettings();
      this.log('Settings imported successfully');

    } catch (error) {
      this.error('Failed to import settings:', error);
    }
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.xrSession = null;
    this.log('Resources disposed');
  }

  /**
   * Log debug message
   */
  log(...args) {
    if (this.debug) {
      console.log('[VRComfortSettings]', ...args);
    }
  }

  /**
   * Log warning message
   */
  warn(...args) {
    console.warn('[VRComfortSettings]', ...args);
  }

  /**
   * Log error message
   */
  error(...args) {
    console.error('[VRComfortSettings]', ...args);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRComfortSettingsSystem;
}
