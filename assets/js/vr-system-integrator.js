/**
 * VR System Integrator
 * すべての2025年改善システムを統合管理
 *
 * 統合システム:
 * 1. Fixed Foveated Rendering (FFR)
 * 2. Multiview Rendering
 * 3. Enhanced Hand Tracking (25-joint)
 * 4. HRTF Spatial Audio
 * 5. VR Caption System
 *
 * @version 1.0.0
 */

class VRSystemIntegrator {
  constructor() {
    this.initialized = false;
    this.systems = {
      ffr: null,
      multiview: null,
      handTracking: null,
      spatialAudio: null,
      captions: null
    };

    this.capabilities = {
      ffrSupported: false,
      multiviewSupported: false,
      handTrackingSupported: false,
      spatialAudioSupported: false,
      captionsSupported: false
    };

    this.config = {
      enableFFR: true,
      enableMultiview: true,
      enableHandTracking: true,
      enableSpatialAudio: true,
      enableCaptions: true,

      // FFR settings
      ffrProfile: 'browsing', // 'text-heavy', 'browsing', 'gaming', 'background'
      ffrDynamicAdjustment: true,

      // Multiview settings
      multiviewMSAA: true,
      multiviewSamples: 4,

      // Hand tracking settings
      handTrackingSmoothing: 0.3,
      handTrackingGestures: true,

      // Spatial audio settings
      audioReverbEnvironment: 'room', // 'room', 'hall', 'cathedral', 'outdoor'
      audioHRTF: true,

      // Caption settings
      captionTheme: 'default', // 'default', 'high-contrast-dark', 'high-contrast-light', 'yellow-black'
      captionSize: 'medium',
      captionPosition: 'bottom',
      captionDistance: 1.0
    };

    // Performance monitoring
    this.metrics = {
      fps: 0,
      cpuLoad: 0,
      gpuLoad: 0,
      drawCalls: 0,
      triangles: 0,
      memoryUsed: 0,
      batteryLevel: 0,
      thermalState: 'nominal'
    };

    // Event handlers
    this.eventHandlers = new Map();

    console.info('[VRIntegrator] VR System Integrator initialized');
  }

  /**
   * Initialize all systems
   * @param {Object} context - Initialization context
   * @param {XRSession} context.session - XR session
   * @param {WebGL2RenderingContext} context.gl - WebGL context
   * @param {THREE.Scene} context.scene - Three.js scene (optional)
   * @param {THREE.Camera} context.camera - Three.js camera (optional)
   * @returns {Promise<Object>} Initialization results
   */
  async initialize(context) {
    if (this.initialized) {
      console.warn('[VRIntegrator] Already initialized');
      return this.getStatus();
    }

    const { session, gl, scene, camera } = context;

    if (!session) {
      throw new Error('[VRIntegrator] XR session is required');
    }

    console.info('[VRIntegrator] Initializing all systems...');

    const results = {
      success: [],
      failed: [],
      warnings: []
    };

    try {
      // 1. Initialize Fixed Foveated Rendering
      if (this.config.enableFFR && typeof VRFoveatedRenderingSystem !== 'undefined') {
        try {
          this.systems.ffr = new VRFoveatedRenderingSystem();
          const ffrSuccess = await this.systems.ffr.initialize(session);

          if (ffrSuccess) {
            this.capabilities.ffrSupported = true;
            this.systems.ffr.setContentProfile(this.config.ffrProfile);

            if (this.config.ffrDynamicAdjustment) {
              this.systems.ffr.startDynamicAdjustment();
            }

            results.success.push('Fixed Foveated Rendering');
            console.info('[VRIntegrator] FFR initialized successfully');
          } else {
            results.warnings.push('FFR not supported on this device');
          }
        } catch (error) {
          results.failed.push({ system: 'FFR', error: error.message });
          console.error('[VRIntegrator] FFR initialization failed:', error);
        }
      }

      // 2. Initialize Multiview Rendering
      if (this.config.enableMultiview && gl && typeof VRMultiviewRenderingSystem !== 'undefined') {
        try {
          this.systems.multiview = new VRMultiviewRenderingSystem();
          this.systems.multiview.updateConfig({
            enableMSAA: this.config.multiviewMSAA,
            samples: this.config.multiviewSamples
          });

          const multiviewSuccess = await this.systems.multiview.initialize(session, gl);

          if (multiviewSuccess) {
            this.capabilities.multiviewSupported = true;
            results.success.push('Multiview Rendering');
            console.info('[VRIntegrator] Multiview initialized successfully');
          } else {
            results.warnings.push('Multiview not supported on this device');
          }
        } catch (error) {
          results.failed.push({ system: 'Multiview', error: error.message });
          console.error('[VRIntegrator] Multiview initialization failed:', error);
        }
      }

      // 3. Initialize Enhanced Hand Tracking
      if (this.config.enableHandTracking && typeof VRHandTrackingEnhanced !== 'undefined') {
        try {
          this.systems.handTracking = new VRHandTrackingEnhanced();
          this.systems.handTracking.config.smoothingFactor = this.config.handTrackingSmoothing;
          this.systems.handTracking.config.enableGestureRecognition = this.config.handTrackingGestures;

          const handTrackingSuccess = await this.systems.handTracking.initialize(session);

          if (handTrackingSuccess) {
            this.capabilities.handTrackingSupported = true;
            this.setupHandTrackingEvents();
            results.success.push('Enhanced Hand Tracking (25-joint)');
            console.info('[VRIntegrator] Hand Tracking initialized successfully');
          } else {
            results.warnings.push('Hand Tracking not supported (request "hand-tracking" feature in session)');
          }
        } catch (error) {
          results.failed.push({ system: 'Hand Tracking', error: error.message });
          console.error('[VRIntegrator] Hand Tracking initialization failed:', error);
        }
      }

      // 4. Initialize HRTF Spatial Audio
      if (this.config.enableSpatialAudio && typeof VRSpatialAudioHRTF !== 'undefined') {
        try {
          this.systems.spatialAudio = new VRSpatialAudioHRTF();
          const audioSuccess = await this.systems.spatialAudio.initialize();

          if (audioSuccess) {
            this.capabilities.spatialAudioSupported = true;

            // Set reverb environment
            await this.systems.spatialAudio.setReverbEnvironment(this.config.audioReverbEnvironment);

            results.success.push('HRTF Spatial Audio');
            console.info('[VRIntegrator] Spatial Audio initialized successfully');

            // Resume context after user interaction
            results.warnings.push('Audio context requires user interaction - call resumeAudio() after user gesture');
          } else {
            results.failed.push({ system: 'Spatial Audio', error: 'Initialization failed' });
          }
        } catch (error) {
          results.failed.push({ system: 'Spatial Audio', error: error.message });
          console.error('[VRIntegrator] Spatial Audio initialization failed:', error);
        }
      }

      // 5. Initialize VR Caption System
      if (this.config.enableCaptions && scene && camera && typeof VRCaptionSystem !== 'undefined') {
        try {
          this.systems.captions = new VRCaptionSystem(scene, camera);
          const captionSuccess = this.systems.captions.initialize();

          if (captionSuccess) {
            this.capabilities.captionsSupported = true;
            this.systems.captions.setTheme(this.config.captionTheme);
            results.success.push('VR Caption System (WCAG AAA)');
            console.info('[VRIntegrator] Caption System initialized successfully');
          } else {
            results.failed.push({ system: 'Captions', error: 'Initialization failed' });
          }
        } catch (error) {
          results.failed.push({ system: 'Captions', error: error.message });
          console.error('[VRIntegrator] Caption System initialization failed:', error);
        }
      }

      this.initialized = true;

      console.info('[VRIntegrator] Initialization complete');
      console.info('  ✅ Success:', results.success.join(', '));
      if (results.warnings.length > 0) {
        console.warn('  ⚠️ Warnings:', results.warnings.join(', '));
      }
      if (results.failed.length > 0) {
        console.error('  ❌ Failed:', results.failed.map(f => `${f.system}: ${f.error}`).join(', '));
      }

      return results;

    } catch (error) {
      console.error('[VRIntegrator] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup hand tracking event handlers
   */
  setupHandTrackingEvents() {
    if (!this.systems.handTracking) return;

    // Pinch events
    this.systems.handTracking.addEventListener('pinchStart', (detail) => {
      this.emitEvent('pinchStart', detail);
    });

    this.systems.handTracking.addEventListener('pinchEnd', (detail) => {
      this.emitEvent('pinchEnd', detail);
    });

    this.systems.handTracking.addEventListener('pinch', (detail) => {
      this.emitEvent('pinch', detail);
    });

    // Gesture events
    this.systems.handTracking.addEventListener('gestureStart', (detail) => {
      this.emitEvent('gestureStart', detail);
    });

    this.systems.handTracking.addEventListener('gestureEnd', (detail) => {
      this.emitEvent('gestureEnd', detail);
    });
  }

  /**
   * Update all systems (call in XR frame loop)
   * @param {XRFrame} frame - Current XR frame
   * @param {XRReferenceSpace} referenceSpace - Reference space
   */
  update(frame, referenceSpace) {
    if (!this.initialized) return;

    const startTime = performance.now();

    try {
      // Update hand tracking
      if (this.systems.handTracking && this.capabilities.handTrackingSupported) {
        this.systems.handTracking.update(frame, referenceSpace);
      }

      // Update spatial audio listener
      if (this.systems.spatialAudio && this.capabilities.spatialAudioSupported) {
        const pose = frame.getViewerPose(referenceSpace);
        if (pose) {
          const position = pose.transform.position;
          const orientation = this.extractOrientation(pose.transform.orientation);

          this.systems.spatialAudio.updateListener(
            { x: position.x, y: position.y, z: position.z },
            orientation
          );
        }
      }

      // Update performance metrics
      this.updateMetrics(performance.now() - startTime);

    } catch (error) {
      console.error('[VRIntegrator] Update failed:', error);
    }
  }

  /**
   * Begin multiview render pass
   * @param {XRFrame} frame - XR frame
   */
  beginRenderPass(frame) {
    if (this.systems.multiview && this.capabilities.multiviewSupported) {
      this.systems.multiview.beginRenderPass(frame);
    }
  }

  /**
   * End multiview render pass
   */
  endRenderPass() {
    if (this.systems.multiview && this.capabilities.multiviewSupported) {
      this.systems.multiview.endRenderPass();
    }
  }

  /**
   * Extract orientation vectors from quaternion
   * @param {DOMPointReadOnly} quaternion - Orientation quaternion
   * @returns {Object} Forward and up vectors
   */
  extractOrientation(quaternion) {
    // Convert quaternion to forward and up vectors
    const q = quaternion;

    // Forward vector (0, 0, -1) rotated by quaternion
    const forward = {
      x: 2 * (q.x * q.z + q.w * q.y),
      y: 2 * (q.y * q.z - q.w * q.x),
      z: 1 - 2 * (q.x * q.x + q.y * q.y)
    };

    // Up vector (0, 1, 0) rotated by quaternion
    const up = {
      x: 2 * (q.x * q.y - q.w * q.z),
      y: 1 - 2 * (q.x * q.x + q.z * q.z),
      z: 2 * (q.y * q.z + q.w * q.x)
    };

    return { forward, up };
  }

  /**
   * Resume audio context (call after user interaction)
   * @returns {Promise<void>}
   */
  async resumeAudio() {
    if (this.systems.spatialAudio && this.capabilities.spatialAudioSupported) {
      await this.systems.spatialAudio.resume();
      console.info('[VRIntegrator] Audio context resumed');
    }
  }

  /**
   * Create caption
   * @param {string} id - Caption ID
   * @param {string} text - Caption text
   * @param {Object} options - Caption options
   */
  createCaption(id, text, options = {}) {
    if (this.systems.captions && this.capabilities.captionsSupported) {
      return this.systems.captions.createCaption(id, text, options);
    }
    return null;
  }

  /**
   * Show caption
   * @param {string} id - Caption ID
   * @param {number} duration - Duration in seconds (0 = infinite)
   */
  showCaption(id, duration = 0) {
    if (this.systems.captions && this.capabilities.captionsSupported) {
      this.systems.captions.show(id, duration);
    }
  }

  /**
   * Hide caption
   * @param {string} id - Caption ID
   */
  hideCaption(id) {
    if (this.systems.captions && this.capabilities.captionsSupported) {
      this.systems.captions.hide(id);
    }
  }

  /**
   * Create spatial audio source
   * @param {string} id - Source ID
   * @param {string|ArrayBuffer} source - Audio source
   * @param {Object} options - Source options
   * @returns {Promise<Object>} Audio source
   */
  async createAudioSource(id, source, options = {}) {
    if (this.systems.spatialAudio && this.capabilities.spatialAudioSupported) {
      return await this.systems.spatialAudio.createSource(id, source, options);
    }
    return null;
  }

  /**
   * Play audio source
   * @param {string} id - Source ID
   * @param {number} delay - Delay in seconds
   */
  playAudio(id, delay = 0) {
    if (this.systems.spatialAudio && this.capabilities.spatialAudioSupported) {
      this.systems.spatialAudio.play(id, delay);
    }
  }

  /**
   * Update audio source position
   * @param {string} id - Source ID
   * @param {Object} position - Position {x, y, z}
   */
  updateAudioPosition(id, position) {
    if (this.systems.spatialAudio && this.capabilities.spatialAudioSupported) {
      this.systems.spatialAudio.updateSourcePosition(id, position);
    }
  }

  /**
   * Get hand tracking data
   * @param {string} handedness - 'left' or 'right'
   * @returns {Object} Hand data
   */
  getHand(handedness) {
    if (this.systems.handTracking && this.capabilities.handTrackingSupported) {
      return this.systems.handTracking.getHand(handedness);
    }
    return null;
  }

  /**
   * Check if hand is pinching
   * @param {string} handedness - Hand
   * @returns {boolean}
   */
  isPinching(handedness) {
    if (this.systems.handTracking && this.capabilities.handTrackingSupported) {
      return this.systems.handTracking.isPinching(handedness);
    }
    return false;
  }

  /**
   * Get joint position
   * @param {string} handedness - Hand
   * @param {string} jointName - Joint name
   * @returns {DOMPointReadOnly|null}
   */
  getJointPosition(handedness, jointName) {
    if (this.systems.handTracking && this.capabilities.handTrackingSupported) {
      return this.systems.handTracking.getJointPosition(handedness, jointName);
    }
    return null;
  }

  /**
   * Update FFR profile
   * @param {string} profile - Profile name
   */
  setFFRProfile(profile) {
    if (this.systems.ffr && this.capabilities.ffrSupported) {
      this.config.ffrProfile = profile;
      this.systems.ffr.setContentProfile(profile);
    }
  }

  /**
   * Update caption theme
   * @param {string} theme - Theme name
   */
  setCaptionTheme(theme) {
    if (this.systems.captions && this.capabilities.captionsSupported) {
      this.config.captionTheme = theme;
      this.systems.captions.setTheme(theme);
    }
  }

  /**
   * Update metrics
   * @param {number} updateTime - Update time in ms
   */
  updateMetrics(updateTime) {
    // Get metrics from all systems
    if (this.systems.ffr && this.capabilities.ffrSupported) {
      const ffrStatus = this.systems.ffr.getStatus();
      this.metrics.fps = ffrStatus.metrics.averageFPS;
    }

    if (this.systems.multiview && this.capabilities.multiviewSupported) {
      const multiviewMetrics = this.systems.multiview.getMetrics();
      // Store multiview metrics
    }

    // Estimate performance
    this.metrics.updateTime = updateTime;
  }

  /**
   * Get status of all systems
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      capabilities: { ...this.capabilities },
      systems: {
        ffr: this.systems.ffr ? this.systems.ffr.getStatus() : null,
        multiview: this.systems.multiview ? this.systems.multiview.getMetrics() : null,
        handTracking: this.systems.handTracking ? this.systems.handTracking.getMetrics() : null,
        spatialAudio: this.systems.spatialAudio ? this.systems.spatialAudio.getMetrics() : null,
        captions: this.systems.captions ? this.systems.captions.getMetrics() : null
      },
      metrics: { ...this.metrics },
      config: { ...this.config }
    };
  }

  /**
   * Get performance summary
   * @returns {Object} Performance summary
   */
  getPerformanceSummary() {
    const status = this.getStatus();

    return {
      fps: this.metrics.fps,
      systemsActive: Object.values(this.capabilities).filter(c => c).length,
      systemsTotal: Object.keys(this.capabilities).length,
      ffrLevel: status.systems.ffr?.currentLevel || 0,
      handTrackingActive: status.systems.handTracking?.trackingFPS > 0,
      audioSourcesActive: status.systems.spatialAudio?.activeSourcesCount || 0,
      captionsActive: status.systems.captions?.activeCaptionsCount || 0
    };
  }

  /**
   * Add event listener
   * @param {string} eventName - Event name
   * @param {Function} callback - Callback function
   */
  addEventListener(eventName, callback) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName).push(callback);
  }

  /**
   * Remove event listener
   * @param {string} eventName - Event name
   * @param {Function} callback - Callback function
   */
  removeEventListener(eventName, callback) {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      const index = handlers.indexOf(callback);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   * @param {string} eventName - Event name
   * @param {Object} detail - Event detail
   */
  emitEvent(eventName, detail) {
    const event = new CustomEvent(`vrintegrator:${eventName}`, { detail });
    window.dispatchEvent(event);

    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      for (const handler of handlers) {
        handler(detail);
      }
    }
  }

  /**
   * Dispose all systems
   */
  dispose() {
    console.info('[VRIntegrator] Disposing all systems...');

    if (this.systems.ffr) {
      this.systems.ffr.dispose();
    }

    if (this.systems.multiview) {
      this.systems.multiview.dispose();
    }

    if (this.systems.handTracking) {
      this.systems.handTracking.dispose();
    }

    if (this.systems.spatialAudio) {
      this.systems.spatialAudio.dispose();
    }

    if (this.systems.captions) {
      this.systems.captions.dispose();
    }

    this.initialized = false;
    this.eventHandlers.clear();

    console.info('[VRIntegrator] All systems disposed');
  }

  /**
   * Get usage example
   * @returns {string} Code example
   */
  static getUsageExample() {
    return `
// Initialize VR session with hand-tracking
const session = await navigator.xr.requestSession('immersive-vr', {
  requiredFeatures: ['local-floor'],
  optionalFeatures: ['hand-tracking']
});

// Create WebGL context
const canvas = document.getElementById('xr-canvas');
const gl = canvas.getContext('webgl2', { xrCompatible: true });

// Create Three.js scene (optional, for captions)
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Initialize integrator
const vrIntegrator = new VRSystemIntegrator();

// Configure (optional - use defaults)
vrIntegrator.config.ffrProfile = 'browsing';
vrIntegrator.config.captionTheme = 'high-contrast-dark';

// Initialize all systems
const results = await vrIntegrator.initialize({
  session,
  gl,
  scene,    // optional (required for captions)
  camera    // optional (required for captions)
});

console.log('Initialized systems:', results.success);
console.log('Warnings:', results.warnings);

// Resume audio after user interaction
document.addEventListener('click', async () => {
  await vrIntegrator.resumeAudio();
}, { once: true });

// Listen for hand tracking events
vrIntegrator.addEventListener('pinchStart', (detail) => {
  console.log('Pinch started:', detail.handedness);
});

vrIntegrator.addEventListener('gestureStart', (detail) => {
  console.log('Gesture detected:', detail.gesture);
});

// Create caption
vrIntegrator.createCaption('welcome', 'Welcome to VR!', {
  type: 'head-locked',
  position: 'bottom',
  size: 'large'
});
vrIntegrator.showCaption('welcome', 5); // Show for 5 seconds

// Create spatial audio
await vrIntegrator.createAudioSource('ambient', '/audio/ambient.mp3', {
  loop: true,
  volume: 0.5
});
vrIntegrator.playAudio('ambient');

// XR frame loop
function onXRFrame(time, frame) {
  const referenceSpace = xrRefSpace;

  // Update all systems
  vrIntegrator.update(frame, referenceSpace);

  // Begin multiview render pass
  vrIntegrator.beginRenderPass(frame);

  // Render your scene
  renderScene();

  // Check hand tracking
  if (vrIntegrator.isPinching('right')) {
    console.log('Right hand pinching!');
  }

  const indexTip = vrIntegrator.getJointPosition('right', 'index-finger-tip');
  if (indexTip) {
    // Use index finger position
  }

  // End multiview render pass
  vrIntegrator.endRenderPass();

  session.requestAnimationFrame(onXRFrame);
}

session.requestAnimationFrame(onXRFrame);

// Get performance summary
const perf = vrIntegrator.getPerformanceSummary();
console.log('FPS:', perf.fps);
console.log('Active systems:', perf.systemsActive, '/', perf.systemsTotal);

// Cleanup when done
// vrIntegrator.dispose();
`;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRSystemIntegrator;
}

// Global instance
window.VRSystemIntegrator = VRSystemIntegrator;

console.info('[VRIntegrator] VR System Integrator loaded');
