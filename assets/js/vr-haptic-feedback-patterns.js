/**
 * WebXR Haptic Feedback Patterns System (2025)
 *
 * Advanced haptic feedback patterns for immersive VR experiences
 * - Pre-designed haptic patterns library
 * - Multi-channel haptic support (left/right controllers)
 * - Rhythm-based pattern design
 * - Intensity and duration control
 * - Pattern sequencing and chaining
 *
 * Features:
 * - 20+ pre-designed haptic patterns
 * - Custom pattern creation
 * - Pattern blending and layering
 * - Adaptive intensity based on action
 * - Support for GamepadHapticActuator API
 *
 * Pattern Categories:
 * - UI Feedback (click, hover, select)
 * - Interactions (grab, throw, impact)
 * - Notifications (alert, success, error)
 * - Environmental (rain, wind, texture)
 * - Custom sequences
 *
 * @author Qui Browser Team
 * @version 5.6.0
 * @license MIT
 */

class VRHapticFeedbackPatterns {
  constructor(options = {}) {
    this.version = '5.6.0';
    this.debug = options.debug || false;

    // XR session and input sources
    this.xrSession = null;
    this.inputSources = new Map(); // handedness -> XRInputSource

    // Haptic support
    this.hapticSupported = false;
    this.leftHapticActuator = null;
    this.rightHapticActuator = null;

    // Pattern library
    this.patterns = this.initializePatterns();

    // Active patterns (for sequencing)
    this.activePatterns = [];

    // Global settings
    this.globalIntensity = options.globalIntensity || 1.0; // 0-1
    this.enabled = options.enabled !== false;

    // Statistics
    this.stats = {
      patternsPlayed: 0,
      totalDuration: 0,
      leftActivations: 0,
      rightActivations: 0
    };

    this.initialized = false;
  }

  /**
   * Initialize haptic feedback patterns
   * @param {XRSession} xrSession - WebXR session
   * @returns {Promise<boolean>} Success status
   */
  async initialize(xrSession) {
    this.log('Initializing Haptic Feedback Patterns v5.6.0...');

    try {
      this.xrSession = xrSession;

      // Listen for input source changes
      this.xrSession.addEventListener('inputsourceschange', (event) => {
        this.updateInputSources(event);
      });

      // Check initial input sources
      if (this.xrSession.inputSources) {
        for (const inputSource of this.xrSession.inputSources) {
          this.addInputSource(inputSource);
        }
      }

      this.initialized = true;
      this.log('Haptic Feedback Patterns initialized');
      this.log('Left haptic:', this.leftHapticActuator !== null);
      this.log('Right haptic:', this.rightHapticActuator !== null);
      this.log('Patterns loaded:', Object.keys(this.patterns).length);

      return true;

    } catch (error) {
      this.error('Initialization failed:', error);
      return false;
    }
  }

  /**
   * Initialize pattern library
   * @returns {Object} Pattern definitions
   */
  initializePatterns() {
    return {
      // === UI Feedback Patterns ===

      'ui-click': {
        name: 'Click',
        description: 'Short, sharp click feedback',
        pulses: [
          { duration: 50, intensity: 0.8 }
        ]
      },

      'ui-hover': {
        name: 'Hover',
        description: 'Subtle hover feedback',
        pulses: [
          { duration: 30, intensity: 0.3 }
        ]
      },

      'ui-select': {
        name: 'Select',
        description: 'Confirmation feedback',
        pulses: [
          { duration: 60, intensity: 0.7 },
          { duration: 0, intensity: 0 }, // 20ms gap
          { duration: 40, intensity: 0.5 }
        ]
      },

      'ui-toggle-on': {
        name: 'Toggle On',
        description: 'Rising intensity',
        pulses: [
          { duration: 40, intensity: 0.3 },
          { duration: 40, intensity: 0.6 },
          { duration: 40, intensity: 0.9 }
        ]
      },

      'ui-toggle-off': {
        name: 'Toggle Off',
        description: 'Falling intensity',
        pulses: [
          { duration: 40, intensity: 0.9 },
          { duration: 40, intensity: 0.6 },
          { duration: 40, intensity: 0.3 }
        ]
      },

      // === Interaction Patterns ===

      'grab': {
        name: 'Grab',
        description: 'Object grabbed',
        pulses: [
          { duration: 80, intensity: 0.6 }
        ]
      },

      'release': {
        name: 'Release',
        description: 'Object released',
        pulses: [
          { duration: 50, intensity: 0.4 }
        ]
      },

      'throw': {
        name: 'Throw',
        description: 'Object thrown',
        pulses: [
          { duration: 100, intensity: 0.8 },
          { duration: 50, intensity: 0.4 }
        ]
      },

      'impact-light': {
        name: 'Light Impact',
        description: 'Small collision',
        pulses: [
          { duration: 60, intensity: 0.5 }
        ]
      },

      'impact-medium': {
        name: 'Medium Impact',
        description: 'Medium collision',
        pulses: [
          { duration: 100, intensity: 0.7 }
        ]
      },

      'impact-heavy': {
        name: 'Heavy Impact',
        description: 'Heavy collision',
        pulses: [
          { duration: 150, intensity: 1.0 }
        ]
      },

      // === Notification Patterns ===

      'notification': {
        name: 'Notification',
        description: 'General notification',
        pulses: [
          { duration: 50, intensity: 0.6 },
          { duration: 50, intensity: 0 },
          { duration: 50, intensity: 0.6 }
        ]
      },

      'success': {
        name: 'Success',
        description: 'Action successful',
        pulses: [
          { duration: 40, intensity: 0.5 },
          { duration: 20, intensity: 0 },
          { duration: 40, intensity: 0.7 },
          { duration: 20, intensity: 0 },
          { duration: 60, intensity: 0.9 }
        ]
      },

      'error': {
        name: 'Error',
        description: 'Error occurred',
        pulses: [
          { duration: 80, intensity: 0.8 },
          { duration: 40, intensity: 0 },
          { duration: 80, intensity: 0.8 }
        ]
      },

      'warning': {
        name: 'Warning',
        description: 'Warning alert',
        pulses: [
          { duration: 100, intensity: 0.7 },
          { duration: 50, intensity: 0 },
          { duration: 100, intensity: 0.7 }
        ]
      },

      // === Environmental Patterns ===

      'texture-smooth': {
        name: 'Smooth Texture',
        description: 'Smooth surface',
        pulses: [
          { duration: 200, intensity: 0.2 }
        ]
      },

      'texture-rough': {
        name: 'Rough Texture',
        description: 'Rough surface',
        pulses: [
          { duration: 30, intensity: 0.6 },
          { duration: 30, intensity: 0.3 },
          { duration: 30, intensity: 0.6 },
          { duration: 30, intensity: 0.3 }
        ]
      },

      'heartbeat': {
        name: 'Heartbeat',
        description: 'Rhythmic pulse',
        pulses: [
          { duration: 80, intensity: 0.7 },
          { duration: 120, intensity: 0 },
          { duration: 80, intensity: 0.7 },
          { duration: 520, intensity: 0 }
        ]
      },

      'rain': {
        name: 'Rain',
        description: 'Random rain drops',
        pulses: [
          { duration: 20, intensity: 0.3 },
          { duration: 100, intensity: 0 },
          { duration: 20, intensity: 0.4 },
          { duration: 80, intensity: 0 },
          { duration: 20, intensity: 0.2 }
        ]
      },

      // === Special Patterns ===

      'continuous-low': {
        name: 'Continuous Low',
        description: 'Continuous low intensity',
        pulses: [
          { duration: 1000, intensity: 0.3 }
        ]
      },

      'continuous-medium': {
        name: 'Continuous Medium',
        description: 'Continuous medium intensity',
        pulses: [
          { duration: 1000, intensity: 0.6 }
        ]
      },

      'pulse-slow': {
        name: 'Slow Pulse',
        description: 'Slow rhythmic pulse',
        pulses: [
          { duration: 100, intensity: 0.6 },
          { duration: 400, intensity: 0 }
        ]
      },

      'pulse-fast': {
        name: 'Fast Pulse',
        description: 'Fast rhythmic pulse',
        pulses: [
          { duration: 50, intensity: 0.6 },
          { duration: 100, intensity: 0 }
        ]
      }
    };
  }

  /**
   * Update input sources
   * @param {Event} event - Input sources change event
   */
  updateInputSources(event) {
    // Add new input sources
    if (event.added) {
      for (const inputSource of event.added) {
        this.addInputSource(inputSource);
      }
    }

    // Remove old input sources
    if (event.removed) {
      for (const inputSource of event.removed) {
        this.removeInputSource(inputSource);
      }
    }
  }

  /**
   * Add input source
   * @param {XRInputSource} inputSource - Input source
   */
  addInputSource(inputSource) {
    if (!inputSource.gamepad || !inputSource.gamepad.hapticActuators) {
      return;
    }

    const handedness = inputSource.handedness;
    this.inputSources.set(handedness, inputSource);

    // Get haptic actuator
    const hapticActuator = inputSource.gamepad.hapticActuators[0];

    if (handedness === 'left') {
      this.leftHapticActuator = hapticActuator;
      this.log('Left haptic actuator added');
    } else if (handedness === 'right') {
      this.rightHapticActuator = hapticActuator;
      this.log('Right haptic actuator added');
    }

    this.hapticSupported = this.leftHapticActuator !== null || this.rightHapticActuator !== null;
  }

  /**
   * Remove input source
   * @param {XRInputSource} inputSource - Input source
   */
  removeInputSource(inputSource) {
    const handedness = inputSource.handedness;
    this.inputSources.delete(handedness);

    if (handedness === 'left') {
      this.leftHapticActuator = null;
      this.log('Left haptic actuator removed');
    } else if (handedness === 'right') {
      this.rightHapticActuator = null;
      this.log('Right haptic actuator removed');
    }

    this.hapticSupported = this.leftHapticActuator !== null || this.rightHapticActuator !== null;
  }

  /**
   * Play haptic pattern
   * @param {string} patternName - Pattern name
   * @param {string} hand - 'left', 'right', or 'both'
   * @param {number} intensityMultiplier - Intensity multiplier (0-1)
   * @returns {Promise<boolean>} Success status
   */
  async playPattern(patternName, hand = 'both', intensityMultiplier = 1.0) {
    if (!this.enabled || !this.hapticSupported) {
      return false;
    }

    const pattern = this.patterns[patternName];
    if (!pattern) {
      this.warn('Pattern not found:', patternName);
      return false;
    }

    try {
      // Play on left hand
      if ((hand === 'left' || hand === 'both') && this.leftHapticActuator) {
        await this.playPatternOnHand(pattern, this.leftHapticActuator, intensityMultiplier);
        this.stats.leftActivations++;
      }

      // Play on right hand
      if ((hand === 'right' || hand === 'both') && this.rightHapticActuator) {
        await this.playPatternOnHand(pattern, this.rightHapticActuator, intensityMultiplier);
        this.stats.rightActivations++;
      }

      this.stats.patternsPlayed++;
      this.log('Pattern played:', patternName, 'on', hand);

      return true;

    } catch (error) {
      this.error('Failed to play pattern:', error);
      return false;
    }
  }

  /**
   * Play pattern on specific hand
   * @param {Object} pattern - Pattern definition
   * @param {GamepadHapticActuator} actuator - Haptic actuator
   * @param {number} intensityMultiplier - Intensity multiplier
   */
  async playPatternOnHand(pattern, actuator, intensityMultiplier) {
    for (const pulse of pattern.pulses) {
      const duration = pulse.duration;
      const intensity = Math.min(1.0, pulse.intensity * intensityMultiplier * this.globalIntensity);

      if (duration > 0 && intensity > 0) {
        // Play pulse
        await actuator.pulse(intensity, duration);
        this.stats.totalDuration += duration;
      }

      // Wait for pulse duration before next pulse
      if (duration > 0) {
        await this.sleep(duration);
      }
    }
  }

  /**
   * Play custom pattern
   * @param {Array} pulses - Array of {duration, intensity} objects
   * @param {string} hand - 'left', 'right', or 'both'
   * @returns {Promise<boolean>} Success status
   */
  async playCustomPattern(pulses, hand = 'both') {
    if (!this.enabled || !this.hapticSupported) {
      return false;
    }

    const customPattern = {
      name: 'Custom',
      description: 'Custom pattern',
      pulses: pulses
    };

    try {
      // Play on left hand
      if ((hand === 'left' || hand === 'both') && this.leftHapticActuator) {
        await this.playPatternOnHand(customPattern, this.leftHapticActuator, 1.0);
        this.stats.leftActivations++;
      }

      // Play on right hand
      if ((hand === 'right' || hand === 'both') && this.rightHapticActuator) {
        await this.playPatternOnHand(customPattern, this.rightHapticActuator, 1.0);
        this.stats.rightActivations++;
      }

      this.stats.patternsPlayed++;
      this.log('Custom pattern played on', hand);

      return true;

    } catch (error) {
      this.error('Failed to play custom pattern:', error);
      return false;
    }
  }

  /**
   * Play simple pulse
   * @param {number} duration - Duration in milliseconds
   * @param {number} intensity - Intensity (0-1)
   * @param {string} hand - 'left', 'right', or 'both'
   * @returns {Promise<boolean>} Success status
   */
  async pulse(duration, intensity, hand = 'both') {
    return await this.playCustomPattern(
      [{ duration, intensity }],
      hand
    );
  }

  /**
   * Stop all haptic feedback
   */
  stopAll() {
    // Note: GamepadHapticActuator API doesn't have a stop method
    // Haptic feedback will naturally stop after pulse duration
    this.log('Stop all haptics (pulses will complete naturally)');
  }

  /**
   * Get pattern list
   * @returns {Array} Pattern names
   */
  getPatternNames() {
    return Object.keys(this.patterns);
  }

  /**
   * Get pattern info
   * @param {string} patternName - Pattern name
   * @returns {Object|null} Pattern information
   */
  getPatternInfo(patternName) {
    const pattern = this.patterns[patternName];
    if (!pattern) return null;

    // Calculate total duration
    const totalDuration = pattern.pulses.reduce((sum, pulse) => sum + pulse.duration, 0);

    return {
      name: pattern.name,
      description: pattern.description,
      pulseCount: pattern.pulses.length,
      totalDuration: totalDuration
    };
  }

  /**
   * Set global intensity
   * @param {number} intensity - Global intensity (0-1)
   */
  setGlobalIntensity(intensity) {
    this.globalIntensity = Math.max(0, Math.min(1, intensity));
    this.log('Global intensity set to', this.globalIntensity);
  }

  /**
   * Enable/disable haptic feedback
   * @param {boolean} enabled - Enable haptics
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    this.log('Haptic feedback', enabled ? 'enabled' : 'disabled');
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      hapticSupported: this.hapticSupported,
      leftAvailable: this.leftHapticActuator !== null,
      rightAvailable: this.rightHapticActuator !== null,
      patternsAvailable: Object.keys(this.patterns).length,
      enabled: this.enabled,
      globalIntensity: this.globalIntensity
    };
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.inputSources.clear();
    this.leftHapticActuator = null;
    this.rightHapticActuator = null;
    this.activePatterns = [];

    this.log('Resources disposed');
  }

  /**
   * Log debug message
   */
  log(...args) {
    if (this.debug) {
      console.log('[VRHapticPatterns]', ...args);
    }
  }

  /**
   * Log warning message
   */
  warn(...args) {
    console.warn('[VRHapticPatterns]', ...args);
  }

  /**
   * Log error message
   */
  error(...args) {
    console.error('[VRHapticPatterns]', ...args);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRHapticFeedbackPatterns;
}
