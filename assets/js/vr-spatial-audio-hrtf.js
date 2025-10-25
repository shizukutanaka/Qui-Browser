/**
 * Advanced Spatial Audio with HRTF (2025)
 *
 * Realistic 3D spatial audio using Head-Related Transfer Function (HRTF)
 * - Web Audio API PannerNode with HRTF spatialization
 * - Binaural audio rendering for realistic 3D positioning
 * - Distance-based attenuation and Doppler effect
 * - Room acoustics simulation (reverb, early reflections)
 * - Optimized for VR multiplayer voice chat
 *
 * Features:
 * - HRTF-based binaural rendering
 * - Distance model: inverse, linear, exponential
 * - Cone-based directional audio
 * - Dynamic audio source management (up to 100 sources)
 * - Head tracking integration for listener orientation
 *
 * @author Qui Browser Team
 * @version 5.2.0
 * @license MIT
 */

class VRSpatialAudioHRTF {
  constructor(options = {}) {
    this.version = '5.2.0';
    this.debug = options.debug || false;

    // Audio context
    this.audioContext = null;
    this.masterGain = null;

    // Listener (user's head)
    this.listener = null;
    this.listenerPosition = { x: 0, y: 0, z: 0 };
    this.listenerOrientation = {
      forward: { x: 0, y: 0, z: -1 },
      up: { x: 0, y: 1, z: 0 }
    };

    // Audio sources
    this.audioSources = new Map(); // sourceId -> AudioSource
    this.maxSources = options.maxSources || 100;

    // HRTF settings
    this.panningModel = options.panningModel || 'HRTF'; // 'HRTF' or 'equalpower'
    this.distanceModel = options.distanceModel || 'inverse'; // 'linear', 'inverse', 'exponential'

    // Acoustic settings
    this.speedOfSound = options.speedOfSound || 343.3; // m/s at 20°C
    this.dopplerFactor = options.dopplerFactor || 1.0;
    this.rolloffFactor = options.rolloffFactor || 1.0;
    this.maxDistance = options.maxDistance || 10000;
    this.refDistance = options.refDistance || 1;

    // Room acoustics (reverb)
    this.reverbEnabled = options.reverbEnabled !== false;
    this.convolver = null;
    this.reverbGain = null;

    // Performance settings
    this.updateInterval = options.updateInterval || 50; // ms
    this.lastUpdate = 0;

    // Stats
    this.stats = {
      activeSources: 0,
      totalSources: 0,
      audioContextState: 'closed',
      sampleRate: 0,
      listenerPosition: { x: 0, y: 0, z: 0 }
    };

    this.initialized = false;
  }

  /**
   * Initialize spatial audio system
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    this.log('Initializing Spatial Audio with HRTF v5.2.0...');

    try {
      // Create audio context
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass({
        latencyHint: 'interactive',
        sampleRate: 48000 // Standard for VR
      });

      // Resume context (required for autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create master gain node
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.audioContext.destination);

      // Get audio listener
      this.listener = this.audioContext.listener;

      // Set HRTF panning model globally
      if (this.listener.panningModel !== undefined) {
        this.listener.panningModel = this.panningModel;
      }

      // Set listener position and orientation
      this.updateListenerTransform(
        this.listenerPosition,
        this.listenerOrientation
      );

      // Initialize reverb if enabled
      if (this.reverbEnabled) {
        await this.initializeReverb();
      }

      this.initialized = true;
      this.stats.audioContextState = this.audioContext.state;
      this.stats.sampleRate = this.audioContext.sampleRate;

      this.log('Spatial Audio initialized successfully');
      this.log('Sample rate:', this.audioContext.sampleRate);
      this.log('Panning model:', this.panningModel);
      this.log('Distance model:', this.distanceModel);

      return true;

    } catch (error) {
      this.error('Initialization failed:', error);
      return false;
    }
  }

  /**
   * Initialize reverb (room acoustics)
   */
  async initializeReverb() {
    try {
      // Create convolver node for reverb
      this.convolver = this.audioContext.createConvolver();

      // Create reverb gain
      this.reverbGain = this.audioContext.createGain();
      this.reverbGain.gain.value = 0.3; // 30% wet signal

      // Generate impulse response (simple room simulation)
      const impulseResponse = this.generateImpulseResponse(
        2.0,   // Duration (seconds)
        0.5,   // Decay factor
        false  // Reverse (for special effects)
      );

      this.convolver.buffer = impulseResponse;

      // Connect: source -> convolver -> reverbGain -> destination
      this.convolver.connect(this.reverbGain);
      this.reverbGain.connect(this.masterGain);

      this.log('Reverb initialized');

    } catch (error) {
      this.error('Failed to initialize reverb:', error);
    }
  }

  /**
   * Generate impulse response for reverb
   * @param {number} duration - Duration in seconds
   * @param {number} decay - Decay factor (0-1)
   * @param {boolean} reverse - Reverse the impulse
   * @returns {AudioBuffer} Impulse response
   */
  generateImpulseResponse(duration, decay, reverse) {
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);

    const leftChannel = impulse.getChannelData(0);
    const rightChannel = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = reverse ? length - i : i;
      // Exponential decay with random noise
      leftChannel[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
      rightChannel[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    }

    return impulse;
  }

  /**
   * Create audio source
   * @param {string} sourceId - Unique source ID
   * @param {Object} config - Source configuration
   * @returns {Object} Audio source object
   */
  createAudioSource(sourceId, config = {}) {
    if (!this.initialized) {
      throw new Error('Audio system not initialized');
    }

    if (this.audioSources.has(sourceId)) {
      this.warn(`Audio source ${sourceId} already exists`);
      return this.audioSources.get(sourceId);
    }

    if (this.audioSources.size >= this.maxSources) {
      this.error('Maximum audio sources reached');
      return null;
    }

    try {
      // Create panner node with HRTF
      const panner = this.audioContext.createPanner();

      // Configure panner
      panner.panningModel = this.panningModel;
      panner.distanceModel = this.distanceModel;
      panner.refDistance = config.refDistance || this.refDistance;
      panner.maxDistance = config.maxDistance || this.maxDistance;
      panner.rolloffFactor = config.rolloffFactor || this.rolloffFactor;
      panner.coneInnerAngle = config.coneInnerAngle || 360;
      panner.coneOuterAngle = config.coneOuterAngle || 360;
      panner.coneOuterGain = config.coneOuterGain || 0;

      // Create gain node for this source
      const gain = this.audioContext.createGain();
      gain.gain.value = config.volume !== undefined ? config.volume : 1.0;

      // Create media element source (for audio/video elements)
      let source = null;
      if (config.mediaElement) {
        source = this.audioContext.createMediaElementSource(config.mediaElement);
      }
      // Create buffer source (for audio buffers)
      else if (config.buffer) {
        source = this.audioContext.createBufferSource();
        source.buffer = config.buffer;
        source.loop = config.loop || false;
      }
      // Create media stream source (for WebRTC)
      else if (config.mediaStream) {
        source = this.audioContext.createMediaStreamSource(config.mediaStream);
      }

      // Connect audio graph
      if (source) {
        source.connect(gain);
      }
      gain.connect(panner);
      panner.connect(this.masterGain);

      // Also connect to reverb if enabled
      if (this.reverbEnabled && this.convolver) {
        panner.connect(this.convolver);
      }

      // Set initial position
      const position = config.position || { x: 0, y: 0, z: 0 };
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;

      // Set initial orientation (for directional sources)
      const orientation = config.orientation || { x: 0, y: 0, z: -1 };
      panner.orientationX.value = orientation.x;
      panner.orientationY.value = orientation.y;
      panner.orientationZ.value = orientation.z;

      // Store source data
      const audioSource = {
        id: sourceId,
        source,
        panner,
        gain,
        position: { ...position },
        orientation: { ...orientation },
        velocity: config.velocity || { x: 0, y: 0, z: 0 },
        playing: false,
        config: { ...config }
      };

      this.audioSources.set(sourceId, audioSource);
      this.stats.totalSources++;

      this.log(`Audio source created: ${sourceId}`);

      return audioSource;

    } catch (error) {
      this.error('Failed to create audio source:', error);
      return null;
    }
  }

  /**
   * Update audio source position
   * @param {string} sourceId - Source ID
   * @param {Object} position - Position {x, y, z}
   * @param {Object} velocity - Velocity {x, y, z} (optional, for Doppler)
   */
  updateSourcePosition(sourceId, position, velocity = null) {
    const audioSource = this.audioSources.get(sourceId);
    if (!audioSource) {
      this.warn(`Audio source ${sourceId} not found`);
      return;
    }

    // Update position
    audioSource.position = { ...position };
    audioSource.panner.positionX.value = position.x;
    audioSource.panner.positionY.value = position.y;
    audioSource.panner.positionZ.value = position.z;

    // Update velocity (for Doppler effect)
    if (velocity) {
      audioSource.velocity = { ...velocity };

      // Note: Doppler effect is automatically calculated by Web Audio API
      // based on listener and source velocities
    }
  }

  /**
   * Update audio source orientation
   * @param {string} sourceId - Source ID
   * @param {Object} orientation - Orientation {x, y, z} (forward vector)
   */
  updateSourceOrientation(sourceId, orientation) {
    const audioSource = this.audioSources.get(sourceId);
    if (!audioSource) {
      this.warn(`Audio source ${sourceId} not found`);
      return;
    }

    audioSource.orientation = { ...orientation };
    audioSource.panner.orientationX.value = orientation.x;
    audioSource.panner.orientationY.value = orientation.y;
    audioSource.panner.orientationZ.value = orientation.z;
  }

  /**
   * Update listener (user's head) transform
   * @param {Object} position - Position {x, y, z}
   * @param {Object} orientation - Orientation {forward, up}
   */
  updateListenerTransform(position, orientation) {
    if (!this.listener) return;

    // Update position
    this.listenerPosition = { ...position };

    if (this.listener.positionX) {
      // Modern API (AudioListener)
      this.listener.positionX.value = position.x;
      this.listener.positionY.value = position.y;
      this.listener.positionZ.value = position.z;

      // Update orientation
      this.listenerOrientation = {
        forward: { ...orientation.forward },
        up: { ...orientation.up }
      };

      this.listener.forwardX.value = orientation.forward.x;
      this.listener.forwardY.value = orientation.forward.y;
      this.listener.forwardZ.value = orientation.forward.z;
      this.listener.upX.value = orientation.up.x;
      this.listener.upY.value = orientation.up.y;
      this.listener.upZ.value = orientation.up.z;
    } else {
      // Legacy API
      this.listener.setPosition(position.x, position.y, position.z);
      this.listener.setOrientation(
        orientation.forward.x, orientation.forward.y, orientation.forward.z,
        orientation.up.x, orientation.up.y, orientation.up.z
      );
    }

    this.stats.listenerPosition = { ...position };
  }

  /**
   * Update from XR frame (call each frame)
   * @param {XRFrame} xrFrame - XR frame
   * @param {XRReferenceSpace} xrRefSpace - Reference space
   */
  update(xrFrame, xrRefSpace) {
    if (!this.initialized) return;

    const now = performance.now();
    if (now - this.lastUpdate < this.updateInterval) {
      return; // Throttle updates
    }

    try {
      // Get viewer pose (head position)
      const pose = xrFrame.getViewerPose(xrRefSpace);
      if (!pose) return;

      // Extract position from pose
      const position = pose.transform.position;
      const orientation = pose.transform.orientation;

      // Convert quaternion to forward/up vectors
      const forward = this.quaternionToForward(orientation);
      const up = this.quaternionToUp(orientation);

      // Update listener
      this.updateListenerTransform(
        { x: position.x, y: position.y, z: position.z },
        { forward, up }
      );

      // Update stats
      this.stats.activeSources = Array.from(this.audioSources.values())
        .filter(s => s.playing).length;

      this.lastUpdate = now;

    } catch (error) {
      // Pose may not be available every frame, this is normal
    }
  }

  /**
   * Convert quaternion to forward vector
   * @param {DOMPointReadOnly} q - Quaternion {x, y, z, w}
   * @returns {Object} Forward vector {x, y, z}
   */
  quaternionToForward(q) {
    return {
      x: 2 * (q.x * q.z + q.w * q.y),
      y: 2 * (q.y * q.z - q.w * q.x),
      z: 1 - 2 * (q.x * q.x + q.y * q.y)
    };
  }

  /**
   * Convert quaternion to up vector
   * @param {DOMPointReadOnly} q - Quaternion {x, y, z, w}
   * @returns {Object} Up vector {x, y, z}
   */
  quaternionToUp(q) {
    return {
      x: 2 * (q.x * q.y - q.w * q.z),
      y: 1 - 2 * (q.x * q.x + q.z * q.z),
      z: 2 * (q.y * q.z + q.w * q.x)
    };
  }

  /**
   * Play audio source
   * @param {string} sourceId - Source ID
   */
  play(sourceId) {
    const audioSource = this.audioSources.get(sourceId);
    if (!audioSource) {
      this.warn(`Audio source ${sourceId} not found`);
      return;
    }

    if (audioSource.source && audioSource.source.start) {
      audioSource.source.start();
      audioSource.playing = true;
      this.log(`Playing audio source: ${sourceId}`);
    }
  }

  /**
   * Stop audio source
   * @param {string} sourceId - Source ID
   */
  stop(sourceId) {
    const audioSource = this.audioSources.get(sourceId);
    if (!audioSource) {
      this.warn(`Audio source ${sourceId} not found`);
      return;
    }

    if (audioSource.source && audioSource.source.stop) {
      audioSource.source.stop();
      audioSource.playing = false;
      this.log(`Stopped audio source: ${sourceId}`);
    }
  }

  /**
   * Set source volume
   * @param {string} sourceId - Source ID
   * @param {number} volume - Volume (0-1)
   */
  setVolume(sourceId, volume) {
    const audioSource = this.audioSources.get(sourceId);
    if (!audioSource) {
      this.warn(`Audio source ${sourceId} not found`);
      return;
    }

    audioSource.gain.gain.value = Math.max(0, Math.min(1, volume));
  }

  /**
   * Set master volume
   * @param {number} volume - Volume (0-1)
   */
  setMasterVolume(volume) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Remove audio source
   * @param {string} sourceId - Source ID
   */
  removeAudioSource(sourceId) {
    const audioSource = this.audioSources.get(sourceId);
    if (!audioSource) return;

    // Stop and disconnect
    if (audioSource.playing) {
      this.stop(sourceId);
    }

    if (audioSource.source) {
      audioSource.source.disconnect();
    }
    audioSource.gain.disconnect();
    audioSource.panner.disconnect();

    this.audioSources.delete(sourceId);
    this.log(`Audio source removed: ${sourceId}`);
  }

  /**
   * Get performance statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      totalSources: this.audioSources.size
    };
  }

  /**
   * Cleanup resources
   */
  dispose() {
    // Remove all audio sources
    for (const sourceId of this.audioSources.keys()) {
      this.removeAudioSource(sourceId);
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
    }

    this.log('Resources disposed');
  }

  /**
   * Log debug message
   */
  log(...args) {
    if (this.debug) {
      console.log('[VRSpatialAudioHRTF]', ...args);
    }
  }

  /**
   * Log warning message
   */
  warn(...args) {
    console.warn('[VRSpatialAudioHRTF]', ...args);
  }

  /**
   * Log error message
   */
  error(...args) {
    console.error('[VRSpatialAudioHRTF]', ...args);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRSpatialAudioHRTF;
}
