/**
 * VR Eye Tracking System
 * 視線追跡システム（将来のWebXR Eye Tracking API対応）
 *
 * Use Cases:
 * - Foveated rendering optimization
 * - Gaze-based interaction
 * - Attention analytics
 * - UI adaptation
 * - Performance optimization
 *
 * Based on WebXR Eye Tracking Proposal
 * @see https://github.com/immersive-web/webxr-eye-tracking
 * @version 1.0.0 (準備版)
 */

class VREyeTrackingSystem {
  constructor() {
    this.enabled = false;
    this.supported = false;
    this.session = null;

    this.config = {
      enableGazeInteraction: true,
      enableFoveation: true, // 視線ベースfoveation
      gazeTimeout: 800, // ms (dwell time)
      minFixationTime: 100, // ms
      smoothingFactor: 0.3,
      enableAnalytics: true,
      privacyMode: true // プライバシー保護モード
    };

    // Eye tracking data
    this.eyeData = {
      left: {
        gazeDirection: null,
        gazeOrigin: null,
        pupilDiameter: 0,
        isTracking: false
      },
      right: {
        gazeDirection: null,
        gazeOrigin: null,
        pupilDiameter: 0,
        isTracking: false
      },
      combined: {
        gazePoint: null, // World space point
        gazeTarget: null, // Hit object
        confidence: 0
      }
    };

    // Gaze interaction state
    this.gazeState = {
      currentTarget: null,
      gazeStartTime: 0,
      dwellProgress: 0,
      fixationPoint: null,
      fixationStartTime: 0
    };

    // Analytics data
    this.analytics = {
      heatmap: new Map(), // Gaze heatmap
      dwellTimes: [],
      scanPath: [],
      blinkRate: 0,
      lastBlinkTime: 0
    };

    // Performance metrics
    this.metrics = {
      trackingFPS: 0,
      lostTrackingCount: 0,
      averageConfidence: 0,
      gazeInteractions: 0
    };

    // Event listeners
    this.eventListeners = new Map();

    console.info('[EyeTracking] Eye Tracking System initialized (準備版)');
  }

  /**
   * Check if eye tracking is supported
   * @param {XRSession} session - XR session
   * @returns {Promise<boolean>}
   */
  async checkSupport(session) {
    if (!session) {
      return false;
    }

    try {
      // Check for eye-tracking feature (future API)
      // Currently this is a proposal, not yet standardized
      this.supported = session.enabledFeatures?.includes('eye-tracking') || false;

      if (this.supported) {
        console.info('[EyeTracking] Eye tracking is supported');
      } else {
        console.warn('[EyeTracking] Eye tracking not available. This is a preparation module.');
        console.info('[EyeTracking] Eye tracking requires "eye-tracking" feature in session.');
      }

      return this.supported;

    } catch (error) {
      console.error('[EyeTracking] Support check failed:', error);
      return false;
    }
  }

  /**
   * Initialize eye tracking
   * @param {XRSession} session - XR session
   * @returns {Promise<boolean>}
   */
  async initialize(session) {
    if (!session) {
      console.warn('[EyeTracking] No session provided');
      return false;
    }

    this.session = session;

    const supported = await this.checkSupport(session);
    if (!supported) {
      console.warn('[EyeTracking] Eye tracking not supported - using fallback mode');
      // Fallback: simulate eye tracking with head pose
      this.enabled = true; // Enable fallback mode
      return true;
    }

    try {
      this.enabled = true;
      console.info('[EyeTracking] Eye tracking initialized');
      return true;

    } catch (error) {
      console.error('[EyeTracking] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Update eye tracking data
   * @param {XRFrame} frame - Current XR frame
   * @param {XRReferenceSpace} referenceSpace - Reference space
   */
  update(frame, referenceSpace) {
    if (!this.enabled || !frame || !referenceSpace) {
      return;
    }

    const startTime = performance.now();

    try {
      if (this.supported && this.session.inputSources) {
        // Real eye tracking (future API)
        this.updateRealEyeTracking(frame, referenceSpace);
      } else {
        // Fallback: use head pose as gaze direction
        this.updateFallbackEyeTracking(frame, referenceSpace);
      }

      // Update gaze interaction
      if (this.config.enableGazeInteraction) {
        this.updateGazeInteraction();
      }

      // Update analytics
      if (this.config.enableAnalytics) {
        this.updateAnalytics();
      }

      // Update metrics
      const elapsed = performance.now() - startTime;
      this.metrics.trackingFPS = elapsed > 0 ? 1000 / elapsed : 0;

    } catch (error) {
      console.error('[EyeTracking] Update failed:', error);
    }
  }

  /**
   * Update real eye tracking (future API)
   * @param {XRFrame} frame - XR frame
   * @param {XRReferenceSpace} referenceSpace - Reference space
   */
  updateRealEyeTracking(frame, referenceSpace) {
    // Future implementation when WebXR Eye Tracking API is standardized
    // This is a placeholder for the upcoming API

    /*
    // Hypothetical future API usage:
    const eyePose = frame.getEyePose(referenceSpace);
    if (eyePose) {
      this.eyeData.left.gazeDirection = eyePose.leftEye.gazeDirection;
      this.eyeData.left.gazeOrigin = eyePose.leftEye.gazeOrigin;
      this.eyeData.right.gazeDirection = eyePose.rightEye.gazeDirection;
      this.eyeData.right.gazeOrigin = eyePose.rightEye.gazeOrigin;

      // Combined gaze
      this.eyeData.combined.gazePoint = eyePose.gazePoint;
      this.eyeData.combined.confidence = eyePose.confidence;
    }
    */

    console.warn('[EyeTracking] Real eye tracking not yet available');
  }

  /**
   * Update fallback eye tracking (head pose)
   * @param {XRFrame} frame - XR frame
   * @param {XRReferenceSpace} referenceSpace - Reference space
   */
  updateFallbackEyeTracking(frame, referenceSpace) {
    // Use head pose as gaze direction (reasonable approximation)
    const pose = frame.getViewerPose(referenceSpace);
    if (!pose) {
      return;
    }

    const transform = pose.transform;
    const position = transform.position;
    const orientation = transform.orientation;

    // Calculate gaze direction from head orientation
    const forward = this.quaternionToForward(orientation);

    // Store as combined gaze
    this.eyeData.combined.gazePoint = {
      x: position.x + forward.x,
      y: position.y + forward.y,
      z: position.z + forward.z
    };

    this.eyeData.combined.confidence = 0.8; // Lower confidence for fallback

    this.eyeData.left.isTracking = true;
    this.eyeData.right.isTracking = true;
  }

  /**
   * Convert quaternion to forward vector
   * @param {DOMPointReadOnly} q - Quaternion
   * @returns {Object} Forward vector
   */
  quaternionToForward(q) {
    return {
      x: 2 * (q.x * q.z + q.w * q.y),
      y: 2 * (q.y * q.z - q.w * q.x),
      z: 1 - 2 * (q.x * q.x + q.y * q.y)
    };
  }

  /**
   * Update gaze interaction
   */
  updateGazeInteraction() {
    const gazePoint = this.eyeData.combined.gazePoint;
    if (!gazePoint) {
      return;
    }

    // Raycast to find gaze target (would need scene reference)
    // This is a simplified version
    const target = this.findGazeTarget(gazePoint);

    if (target !== this.gazeState.currentTarget) {
      // Target changed
      if (this.gazeState.currentTarget) {
        this.emitEvent('gazeExit', {
          target: this.gazeState.currentTarget,
          dwellTime: Date.now() - this.gazeState.gazeStartTime
        });
      }

      this.gazeState.currentTarget = target;
      this.gazeState.gazeStartTime = Date.now();
      this.gazeState.dwellProgress = 0;

      if (target) {
        this.emitEvent('gazeEnter', { target });
      }
    } else if (target) {
      // Same target - update dwell progress
      const elapsed = Date.now() - this.gazeState.gazeStartTime;
      this.gazeState.dwellProgress = Math.min(elapsed / this.config.gazeTimeout, 1.0);

      // Emit dwell event
      if (this.gazeState.dwellProgress >= 1.0 && this.gazeState.dwellProgress < 1.1) {
        this.emitEvent('gazeDwell', {
          target,
          dwellTime: elapsed
        });
        this.metrics.gazeInteractions++;
      }
    }
  }

  /**
   * Find gaze target (placeholder)
   * @param {Object} gazePoint - Gaze point in world space
   * @returns {Object|null} Target object
   */
  findGazeTarget(gazePoint) {
    // This would perform raycasting in the actual implementation
    // For now, return null
    return null;
  }

  /**
   * Update analytics
   */
  updateAnalytics() {
    const gazePoint = this.eyeData.combined.gazePoint;
    if (!gazePoint) {
      return;
    }

    // Update heatmap
    const key = `${Math.floor(gazePoint.x * 10)},${Math.floor(gazePoint.y * 10)},${Math.floor(gazePoint.z * 10)}`;
    const count = (this.analytics.heatmap.get(key) || 0) + 1;
    this.analytics.heatmap.set(key, count);

    // Update scan path (limited to last 100 points)
    this.analytics.scanPath.push({
      point: { ...gazePoint },
      timestamp: Date.now()
    });

    if (this.analytics.scanPath.length > 100) {
      this.analytics.scanPath.shift();
    }
  }

  /**
   * Get gaze point
   * @returns {Object|null} Gaze point in world space
   */
  getGazePoint() {
    return this.eyeData.combined.gazePoint;
  }

  /**
   * Get gaze target
   * @returns {Object|null} Current gaze target
   */
  getGazeTarget() {
    return this.gazeState.currentTarget;
  }

  /**
   * Get dwell progress
   * @returns {number} Progress (0-1)
   */
  getDwellProgress() {
    return this.gazeState.dwellProgress;
  }

  /**
   * Get confidence
   * @returns {number} Tracking confidence (0-1)
   */
  getConfidence() {
    return this.eyeData.combined.confidence;
  }

  /**
   * Get analytics data
   * @returns {Object} Analytics data
   */
  getAnalytics() {
    if (!this.config.enableAnalytics || this.config.privacyMode) {
      return null; // Privacy protection
    }

    return {
      heatmapSize: this.analytics.heatmap.size,
      scanPathLength: this.analytics.scanPath.length,
      averageDwellTime: this.calculateAverageDwellTime(),
      gazeInteractions: this.metrics.gazeInteractions
    };
  }

  /**
   * Calculate average dwell time
   * @returns {number} Average dwell time in ms
   */
  calculateAverageDwellTime() {
    if (this.analytics.dwellTimes.length === 0) {
      return 0;
    }

    const sum = this.analytics.dwellTimes.reduce((a, b) => a + b, 0);
    return sum / this.analytics.dwellTimes.length;
  }

  /**
   * Get metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      trackingFPS: this.metrics.trackingFPS.toFixed(1),
      isTracking: this.eyeData.left.isTracking || this.eyeData.right.isTracking,
      fallbackMode: !this.supported
    };
  }

  /**
   * Enable eye tracking
   */
  enable() {
    this.enabled = true;
    console.info('[EyeTracking] Enabled');
  }

  /**
   * Disable eye tracking
   */
  disable() {
    this.enabled = false;
    console.info('[EyeTracking] Disabled');
  }

  /**
   * Add event listener
   * @param {string} eventName - Event name
   * @param {Function} callback - Callback function
   */
  addEventListener(eventName, callback) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName).push(callback);
  }

  /**
   * Emit event
   * @param {string} eventName - Event name
   * @param {Object} detail - Event detail
   */
  emitEvent(eventName, detail) {
    const event = new CustomEvent(`eyetracking:${eventName}`, { detail });
    window.dispatchEvent(event);

    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      for (const listener of listeners) {
        listener(detail);
      }
    }
  }

  /**
   * Dispose and clean up
   */
  dispose() {
    this.enabled = false;
    this.session = null;
    this.eventListeners.clear();
    this.analytics.heatmap.clear();
    this.analytics.scanPath = [];

    console.info('[EyeTracking] Disposed');
  }

  /**
   * Get usage example
   * @returns {string} Code example
   */
  static getUsageExample() {
    return `
// Request session with eye-tracking (future API)
const session = await navigator.xr.requestSession('immersive-vr', {
  requiredFeatures: ['local-floor'],
  optionalFeatures: ['eye-tracking'] // Future feature
});

// Initialize eye tracking
const eyeTracking = new VREyeTrackingSystem();
await eyeTracking.initialize(session);

// Listen for gaze events
eyeTracking.addEventListener('gazeEnter', (detail) => {
  console.log('Gazing at:', detail.target);
});

eyeTracking.addEventListener('gazeDwell', (detail) => {
  console.log('Dwell completed:', detail.target);
  // Trigger action
});

eyeTracking.addEventListener('gazeExit', (detail) => {
  console.log('Gaze exited:', detail.target);
});

// Update loop
function onXRFrame(time, frame) {
  eyeTracking.update(frame, referenceSpace);

  // Get gaze point
  const gazePoint = eyeTracking.getGazePoint();
  if (gazePoint) {
    console.log('Gaze:', gazePoint);
  }

  // Get dwell progress
  const progress = eyeTracking.getDwellProgress();
  // Update UI indicator

  session.requestAnimationFrame(onXRFrame);
}

// Get analytics
const analytics = eyeTracking.getAnalytics();
console.log('Gaze interactions:', analytics.gazeInteractions);
`;
  }

  /**
   * Get best practices
   * @returns {Array} Recommendations
   */
  static getBestPractices() {
    return [
      {
        title: 'Privacy First',
        description: 'Always respect user privacy. Get explicit consent for eye tracking.',
        priority: 'critical'
      },
      {
        title: 'Fallback to Head Pose',
        description: 'Use head pose as fallback when eye tracking unavailable.',
        priority: 'high'
      },
      {
        title: 'Dwell Time 800ms',
        description: 'Use 800ms dwell time for comfortable gaze interaction.',
        priority: 'high'
      },
      {
        title: 'Visual Feedback',
        description: 'Provide clear visual feedback for gaze interaction progress.',
        priority: 'high'
      },
      {
        title: 'Smooth Transitions',
        description: 'Apply smoothing to reduce jitter in gaze point.',
        priority: 'medium'
      },
      {
        title: 'Future API準備',
        description: 'This module is preparation for future WebXR Eye Tracking API.',
        priority: 'info'
      }
    ];
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VREyeTrackingSystem;
}

// Global instance
window.VREyeTrackingSystem = VREyeTrackingSystem;

console.info('[EyeTracking] VR Eye Tracking System loaded (準備版)');
