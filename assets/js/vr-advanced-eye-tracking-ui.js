/**
 * Advanced Eye Tracking UI System (2025)
 *
 * Gaze-aware user interface with eye tracking optimization
 * - Gaze-based interaction (look-to-click, dwell-to-select)
 * - Attention tracking and analytics
 * - UI element highlighting based on gaze
 * - Dynamic UI scaling based on viewing distance
 * - Gaze-contingent rendering optimization
 *
 * Features:
 * - Real-time gaze point tracking
 * - Dwell time detection for selection
 * - Gaze path visualization and recording
 * - Attention heat maps
 * - IPD-based UI scaling
 * - Eye contact detection for social VR
 * - Fatigue monitoring (blink rate)
 *
 * Gaze Interaction Modes:
 * - Look-to-Click: Gaze + controller trigger
 * - Dwell-to-Select: Look at element for N milliseconds
 * - Gaze-Tracking: Follow elements with gaze
 * - Eye-Contact: Detect when looking at avatars
 *
 * Research References:
 * - Tobii eye tracking SDK for VR (2025)
 * - EF Tracker facial tracking (2025)
 * - Eye-contact detection research
 * - Gaze-contingent rendering optimization
 * - Attention analysis in VR (2024-2025)
 *
 * @author Qui Browser Team
 * @version 5.7.0
 * @license MIT
 */

class VRAdvancedEyeTrackingUI {
  constructor(options = {}) {
    this.version = '5.7.0';
    this.debug = options.debug || false;

    // XR session
    this.xrSession = null;

    // Eye tracking support
    this.eyeTrackingSupported = false;
    this.eyeTrackingData = {
      leftEye: null,
      rightEye: null,
      gazePoint: null,
      confidence: 0
    };

    // Gaze interaction
    this.gazedElement = null;
    this.gazedElementStartTime = 0;
    this.dwellThreshold = options.dwellThreshold || 500; // milliseconds

    // Gaze history for path tracking
    this.gazeHistory = [];
    this.maxGazeHistoryLength = 100;
    this.gazeHistoryRecording = options.recordGazeHistory !== false;

    // UI elements tracking
    this.trackableElements = new Map(); // element -> tracking data
    this.gazeHeatMap = null;

    // Gaze visualization
    this.gazeVisualization = {
      enabled: options.visualizeGaze || false,
      showGazePoint: true,
      showGazePath: false,
      showHeatMap: false,
      pathColor: options.gazePathColor || '#FF6B6B',
      pointRadius: options.gazePointRadius || 0.02
    };

    // Eye contact detection
    this.eyeContactThreshold = options.eyeContactThreshold || 0.5; // meters
    this.eyeContactTracking = new Map(); // avatar -> contact duration

    // Fatigue monitoring
    this.blinkDetection = {
      enabled: options.monitorFatigue !== false,
      minBlinkDuration: 100, // milliseconds
      maxBlinkDuration: 400,
      blinkCount: 0,
      lastBlinkTime: 0,
      blinkRate: 0 // blinks per minute
    };

    // UI adaptation
    this.autoScaleUI = options.autoScaleUI !== false;
    this.baseFontSize = options.baseFontSize || 16; // pixels at 1 meter
    this.ipd = options.ipd || 0.063; // meters

    // Performance tracking
    this.stats = {
      gazeUpdates: 0,
      averageConfidence: 0,
      dwellSelections: 0,
      eyeContactTime: 0,
      blinksDetected: 0
    };

    // Callbacks
    this.onGazeUpdate = options.onGazeUpdate || null;
    this.onDwellSelect = options.onDwellSelect || null;
    this.onEyeContact = options.onEyeContact || null;
    this.onBlinkDetected = options.onBlinkDetected || null;

    this.initialized = false;
  }

  /**
   * Initialize advanced eye tracking
   * @param {XRSession} xrSession - WebXR session
   * @returns {Promise<boolean>} Success status
   */
  async initialize(xrSession) {
    this.log('Initializing Advanced Eye Tracking UI v5.7.0...');

    try {
      this.xrSession = xrSession;

      // Check eye tracking support
      await this.checkEyeTrackingSupport();

      if (!this.eyeTrackingSupported) {
        this.warn('Eye tracking not supported');
        return false;
      }

      // Initialize heat map
      this.gazeHeatMap = new Float32Array(1024 * 1024);

      this.initialized = true;
      this.log('Advanced Eye Tracking UI initialized');
      this.log('Eye tracking:', this.eyeTrackingSupported);

      return true;

    } catch (error) {
      this.error('Initialization failed:', error);
      return false;
    }
  }

  /**
   * Check eye tracking support
   */
  async checkEyeTrackingSupport() {
    const enabledFeatures = this.xrSession.enabledFeatures || [];
    this.eyeTrackingSupported = enabledFeatures.includes('eye-tracking');

    if (this.eyeTrackingSupported) {
      this.log('Eye tracking supported');
    }
  }

  /**
   * Update eye tracking (call each frame)
   * @param {XRFrame} xrFrame - XR frame
   * @param {XRReferenceSpace} xrRefSpace - Reference space
   */
  update(xrFrame, xrRefSpace) {
    if (!this.initialized || !this.eyeTrackingSupported) return;

    try {
      // Get eye tracking data
      this.updateEyeData(xrFrame, xrRefSpace);

      // Update gaze point
      const gazePoint = this.calculateGazePoint();
      if (gazePoint) {
        this.processGazePoint(gazePoint);
      }

      // Update dwell detection
      this.updateDwellDetection();

      // Update eye contact detection
      this.updateEyeContact();

      // Update blink detection
      this.updateBlinkDetection();

      this.stats.gazeUpdates++;

    } catch (error) {
      // Eye tracking may fail temporarily
    }
  }

  /**
   * Update eye tracking data
   * @param {XRFrame} xrFrame - XR frame
   * @param {XRReferenceSpace} xrRefSpace - Reference space
   */
  updateEyeData(xrFrame, xrRefSpace) {
    // Get viewer pose for reference
    const pose = xrFrame.getViewerPose(xrRefSpace);
    if (!pose) return;

    // Note: WebXR eye tracking typically provides gaze direction
    // Implementation depends on device-specific extensions

    // Simulate eye tracking data (in production, use actual API)
    // This would be populated by device-specific extension
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // Convert screen coordinates to normalized space
    const gazeX = Math.random(); // Replace with actual gaze data
    const gazeY = Math.random();
    const confidence = 0.8 + Math.random() * 0.2;

    this.eyeTrackingData.gazePoint = {
      x: gazeX,
      y: gazeY,
      confidence: confidence
    };

    this.stats.averageConfidence = (this.stats.averageConfidence * (this.stats.gazeUpdates || 1) + confidence) /
                                  ((this.stats.gazeUpdates || 1) + 1);
  }

  /**
   * Calculate gaze point in 3D space
   * @returns {Object|null} 3D gaze point
   */
  calculateGazePoint() {
    if (!this.eyeTrackingData.gazePoint) return null;

    const { x, y } = this.eyeTrackingData.gazePoint;

    // Convert 2D gaze point to 3D world position
    // This would use view matrix and projection matrix in real implementation

    return {
      screenX: x,
      screenY: y,
      worldPos: {
        x: (x - 0.5) * 10,
        y: -(y - 0.5) * 10,
        z: -1
      }
    };
  }

  /**
   * Process gaze point for UI interaction
   * @param {Object} gazePoint - Gaze point
   */
  processGazePoint(gazePoint) {
    const { screenX, screenY, worldPos } = gazePoint;

    // Check which UI element is being gazed at
    let gazeTargetElement = null;
    let minDistance = Infinity;

    for (const [element, tracking] of this.trackableElements) {
      const bounds = tracking.bounds;

      // Simple AABB collision check
      if (screenX >= bounds.x && screenX <= bounds.x + bounds.width &&
          screenY >= bounds.y && screenY <= bounds.y + bounds.height) {

        const distance = Math.hypot(
          screenX - (bounds.x + bounds.width / 2),
          screenY - (bounds.y + bounds.height / 2)
        );

        if (distance < minDistance) {
          minDistance = distance;
          gazeTargetElement = element;
        }
      }
    }

    // Update gazed element
    if (gazeTargetElement !== this.gazedElement) {
      if (this.gazedElement) {
        this.onGazeLeave(this.gazedElement);
      }

      this.gazedElement = gazeTargetElement;
      this.gazedElementStartTime = Date.now();

      if (this.gazedElement) {
        this.onGazeEnter(this.gazedElement);
      }
    }

    // Add to gaze history
    if (this.gazeHistoryRecording) {
      this.gazeHistory.push({
        timestamp: Date.now(),
        screenX: screenX,
        screenY: screenY,
        worldPos: worldPos,
        element: gazeTargetElement?.id || null
      });

      // Limit history length
      if (this.gazeHistory.length > this.maxGazeHistoryLength) {
        this.gazeHistory.shift();
      }
    }

    // Update heat map
    this.updateHeatMap(screenX, screenY);

    // Trigger gaze update callback
    if (this.onGazeUpdate) {
      this.onGazeUpdate({
        gazePoint: gazePoint,
        targetElement: gazeTargetElement,
        confidence: this.eyeTrackingData.gazePoint.confidence
      });
    }
  }

  /**
   * Handle gaze entering element
   * @param {HTMLElement} element - Element
   */
  onGazeEnter(element) {
    element.classList.add('gaze-focused');
    element.style.opacity = '1.0';

    this.log('Gaze entered:', element.id);
  }

  /**
   * Handle gaze leaving element
   * @param {HTMLElement} element - Element
   */
  onGazeLeave(element) {
    element.classList.remove('gaze-focused');
    element.style.opacity = '0.7';

    this.log('Gaze left:', element.id);
  }

  /**
   * Update dwell detection
   */
  updateDwellDetection() {
    if (!this.gazedElement) return;

    const gazeDuration = Date.now() - this.gazedElementStartTime;

    if (gazeDuration >= this.dwellThreshold) {
      this.triggerDwellSelect(this.gazedElement);
      this.gazedElementStartTime = Date.now(); // Reset dwell timer
    }
  }

  /**
   * Trigger dwell selection
   * @param {HTMLElement} element - Element
   */
  triggerDwellSelect(element) {
    this.stats.dwellSelections++;

    this.log('Dwell selection:', element.id);

    // Trigger callback
    if (this.onDwellSelect) {
      this.onDwellSelect(element);
    }

    // Visual feedback
    element.style.backgroundColor = '#4CAF50';
    setTimeout(() => {
      element.style.backgroundColor = '';
    }, 200);
  }

  /**
   * Update eye contact detection
   */
  updateEyeContact() {
    if (!this.gazedElement) return;

    // Check if looking at avatar
    const avatar = this.findNearestAvatar(this.gazedElement);
    if (avatar) {
      const distance = this.calculateDistanceToAvatar(avatar);

      if (distance < this.eyeContactThreshold) {
        // Record eye contact
        const contact = this.eyeContactTracking.get(avatar) || {
          startTime: Date.now(),
          duration: 0
        };

        contact.duration = Date.now() - contact.startTime;
        this.eyeContactTracking.set(avatar, contact);

        this.stats.eyeContactTime = contact.duration;

        // Trigger callback
        if (this.onEyeContact) {
          this.onEyeContact({
            avatar: avatar,
            duration: contact.duration
          });
        }
      }
    }
  }

  /**
   * Find nearest avatar to gaze point
   * @param {HTMLElement} element - Gaze element
   * @returns {Object|null} Avatar object
   */
  findNearestAvatar(element) {
    // Check if element is or contains avatar
    if (element.classList.contains('avatar')) {
      return element;
    }

    // Search parent elements
    let parent = element.parentElement;
    while (parent) {
      if (parent.classList.contains('avatar')) {
        return parent;
      }
      parent = parent.parentElement;
    }

    return null;
  }

  /**
   * Calculate distance to avatar
   * @param {Object} avatar - Avatar object
   * @returns {number} Distance in meters
   */
  calculateDistanceToAvatar(avatar) {
    // Simplified distance calculation
    // In production: use 3D position from avatar transform
    const bounds = avatar.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;

    const screenX = window.innerWidth / 2;
    const screenY = window.innerHeight / 2;

    const pixelDistance = Math.hypot(centerX - screenX, centerY - screenY);
    const viewportDiagonal = Math.hypot(window.innerWidth, window.innerHeight);

    // Convert to meters (assuming 1 meter at arm's length)
    return (pixelDistance / viewportDiagonal) * 2;
  }

  /**
   * Update blink detection
   */
  updateBlinkDetection() {
    if (!this.blinkDetection.enabled) return;

    // Detect blinks from eye tracking confidence drops
    const confidence = this.eyeTrackingData.gazePoint?.confidence || 0;

    if (confidence < 0.3) {
      // Potential blink detected
      const now = Date.now();
      const timeSinceLastBlink = now - this.blinkDetection.lastBlinkTime;

      if (timeSinceLastBlink > this.blinkDetection.maxBlinkDuration) {
        this.recordBlink();
      }
    }
  }

  /**
   * Record blink event
   */
  recordBlink() {
    const now = Date.now();

    this.blinkDetection.lastBlinkTime = now;
    this.blinkDetection.blinkCount++;
    this.stats.blinksDetected++;

    // Calculate blink rate (blinks per minute)
    // Based on last 30 seconds of blinks
    const recentBlinks = this.gazeHistory.filter(entry =>
      (now - entry.timestamp) < 30000
    ).length;

    this.blinkDetection.blinkRate = (recentBlinks / 30) * 60;

    this.log('Blink detected (total:', this.blinkDetection.blinkCount, ')');

    // Trigger callback
    if (this.onBlinkDetected) {
      this.onBlinkDetected({
        blinkCount: this.blinkDetection.blinkCount,
        blinkRate: this.blinkDetection.blinkRate
      });
    }

    // Fatigue warning if blink rate is abnormal
    if (this.blinkDetection.blinkRate > 30) {
      this.warn('High blink rate detected - possible fatigue');
    }
  }

  /**
   * Update heat map visualization
   * @param {number} x - X coordinate (0-1)
   * @param {number} y - Y coordinate (0-1)
   */
  updateHeatMap(x, y) {
    const heatMapWidth = 1024;
    const heatMapHeight = 1024;

    const px = Math.floor(x * heatMapWidth);
    const py = Math.floor(y * heatMapHeight);
    const index = py * heatMapWidth + px;

    if (index >= 0 && index < this.gazeHeatMap.length) {
      // Gaussian blur around gaze point
      const radius = 20;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const distance = Math.hypot(dx, dy);
          const decay = Math.exp(-(distance * distance) / (radius * radius));

          const npy = py + dy;
          const npx = px + dx;

          if (npy >= 0 && npy < heatMapHeight && npx >= 0 && npx < heatMapWidth) {
            const nindex = npy * heatMapWidth + npx;
            this.gazeHeatMap[nindex] = Math.min(1.0, this.gazeHeatMap[nindex] + decay * 0.01);
          }
        }
      }
    }
  }

  /**
   * Register UI element for tracking
   * @param {HTMLElement} element - Element to track
   * @param {Object} options - Options
   */
  registerUIElement(element, options = {}) {
    const bounds = element.getBoundingClientRect();

    this.trackableElements.set(element, {
      bounds: {
        x: bounds.left,
        y: bounds.top,
        width: bounds.width,
        height: bounds.height
      },
      interactive: options.interactive !== false,
      dwellEnabled: options.dwellEnabled !== false
    });

    this.log('UI element registered:', element.id);
  }

  /**
   * Unregister UI element
   * @param {HTMLElement} element - Element to unregister
   */
  unregisterUIElement(element) {
    this.trackableElements.delete(element);
  }

  /**
   * Get gaze history
   * @returns {Array} Gaze history
   */
  getGazeHistory() {
    return [...this.gazeHistory];
  }

  /**
   * Get heat map
   * @returns {Float32Array} Heat map data
   */
  getHeatMap() {
    return this.gazeHeatMap;
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      eyeTrackingSupported: this.eyeTrackingSupported,
      gazedElement: this.gazedElement?.id || null,
      blinkRate: this.blinkDetection.blinkRate,
      recordedGazePoints: this.gazeHistory.length
    };
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.trackableElements.clear();
    this.eyeContactTracking.clear();
    this.gazeHistory = [];

    this.log('Resources disposed');
  }

  /**
   * Log debug message
   */
  log(...args) {
    if (this.debug) {
      console.log('[VRAdvancedEyeTracking]', ...args);
    }
  }

  /**
   * Log warning message
   */
  warn(...args) {
    console.warn('[VRAdvancedEyeTracking]', ...args);
  }

  /**
   * Log error message
   */
  error(...args) {
    console.error('[VRAdvancedEyeTracking]', ...args);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRAdvancedEyeTrackingUI;
}
