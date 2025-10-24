/**
 * VR Spatial Audio System with HRTF
 * Web Audio APIのPannerNodeを使用した高品質3D音響システム
 *
 * HRTF (Head-Related Transfer Function) は、人間の頭部を考慮した
 * 3D音響を実現し、特に後方の音源認識で優れたパフォーマンスを発揮します。
 *
 * Based on W3C Web Audio API and WebXR research (2025)
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Web_audio_spatialization_basics
 * @see https://ieeexplore.ieee.org/document/10289525/
 * @version 2.0.0
 */

class VRSpatialAudioHRTF {
  constructor() {
    this.audioContext = null;
    this.listener = null;
    this.sources = new Map(); // Audio sources with PannerNode
    this.buffers = new Map(); // Audio buffers
    this.enabled = false;

    this.config = {
      panningModel: 'HRTF', // 'HRTF' or 'equalpower'
      distanceModel: 'inverse', // 'linear', 'inverse', 'exponential'
      refDistance: 1, // Reference distance for volume calculation
      maxDistance: 100, // Maximum distance for audio
      rolloffFactor: 1, // How quickly audio fades with distance
      coneInnerAngle: 360, // Inner cone angle (degrees)
      coneOuterAngle: 360, // Outer cone angle (degrees)
      coneOuterGain: 0, // Gain outside cone
      enableReverb: true,
      enableOcclusion: false,
      updateFrequency: 60 // Hz (updates per second)
    };

    // Sound effect presets
    this.presets = {
      ambient: {
        refDistance: 10,
        rolloffFactor: 0.5,
        maxDistance: 1000
      },
      nearField: {
        refDistance: 0.5,
        rolloffFactor: 2,
        maxDistance: 10
      },
      voice: {
        refDistance: 1,
        rolloffFactor: 1,
        maxDistance: 50,
        coneInnerAngle: 45,
        coneOuterAngle: 90,
        coneOuterGain: 0.3
      },
      music: {
        refDistance: 2,
        rolloffFactor: 0.8,
        maxDistance: 100
      }
    };

    // Reverb settings for different environments
    this.reverbPresets = {
      room: {
        decay: 1.5,
        delay: 0.02,
        wet: 0.3,
        dry: 0.7
      },
      hall: {
        decay: 3.0,
        delay: 0.05,
        wet: 0.5,
        dry: 0.5
      },
      cathedral: {
        decay: 5.0,
        delay: 0.1,
        wet: 0.6,
        dry: 0.4
      },
      outdoor: {
        decay: 0.5,
        delay: 0.01,
        wet: 0.1,
        dry: 0.9
      }
    };

    this.currentReverb = 'room';
    this.reverbNode = null;

    // Performance metrics
    this.metrics = {
      activeSourcesCount: 0,
      updateTime: 0,
      listenerUpdateCount: 0,
      sourceUpdateCount: 0
    };

    console.info('[SpatialAudio] HRTF Spatial Audio System initialized');
  }

  /**
   * Initialize audio context
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      // Create audio context
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();

      // Get audio listener (represents user's head position)
      this.listener = this.audioContext.listener;

      // Setup reverb if enabled
      if (this.config.enableReverb) {
        await this.setupReverb();
      }

      this.enabled = true;
      console.info('[SpatialAudio] Initialized with HRTF panning model');

      return true;

    } catch (error) {
      console.error('[SpatialAudio] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Setup reverb (convolution reverb for realistic room acoustics)
   * @returns {Promise<void>}
   */
  async setupReverb() {
    try {
      this.reverbNode = this.audioContext.createConvolver();

      // Generate impulse response (simplified - in production, load actual IR files)
      const preset = this.reverbPresets[this.currentReverb];
      const sampleRate = this.audioContext.sampleRate;
      const length = sampleRate * preset.decay;
      const impulse = this.audioContext.createBuffer(2, length, sampleRate);

      for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          // Exponential decay
          channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
        }
      }

      this.reverbNode.buffer = impulse;

      console.info('[SpatialAudio] Reverb setup complete');

    } catch (error) {
      console.error('[SpatialAudio] Reverb setup failed:', error);
    }
  }

  /**
   * Create audio source from URL or buffer
   * @param {string} id - Unique source ID
   * @param {string|ArrayBuffer} source - Audio source (URL or buffer)
   * @param {Object} options - Source options
   * @returns {Promise<Object>} Audio source object
   */
  async createSource(id, source, options = {}) {
    if (!this.enabled) {
      console.warn('[SpatialAudio] Not initialized');
      return null;
    }

    try {
      // Load audio buffer
      let buffer;
      if (typeof source === 'string') {
        buffer = await this.loadAudioBuffer(source);
      } else {
        buffer = await this.audioContext.decodeAudioData(source);
      }

      // Create source node
      const sourceNode = this.audioContext.createBufferSource();
      sourceNode.buffer = buffer;

      // Create panner node (3D audio positioning)
      const pannerNode = this.audioContext.createPanner();

      // Configure panner with HRTF
      pannerNode.panningModel = this.config.panningModel;
      pannerNode.distanceModel = this.config.distanceModel;
      pannerNode.refDistance = options.refDistance || this.config.refDistance;
      pannerNode.maxDistance = options.maxDistance || this.config.maxDistance;
      pannerNode.rolloffFactor = options.rolloffFactor || this.config.rolloffFactor;
      pannerNode.coneInnerAngle = options.coneInnerAngle || this.config.coneInnerAngle;
      pannerNode.coneOuterAngle = options.coneOuterAngle || this.config.coneOuterAngle;
      pannerNode.coneOuterGain = options.coneOuterGain || this.config.coneOuterGain;

      // Create gain node (volume control)
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = options.volume || 1.0;

      // Connect audio graph
      sourceNode.connect(pannerNode);
      pannerNode.connect(gainNode);

      if (this.config.enableReverb && this.reverbNode) {
        // Dry/wet mix for reverb
        const dryGain = this.audioContext.createGain();
        const wetGain = this.audioContext.createGain();

        const preset = this.reverbPresets[this.currentReverb];
        dryGain.gain.value = preset.dry;
        wetGain.gain.value = preset.wet;

        gainNode.connect(dryGain);
        gainNode.connect(this.reverbNode);
        this.reverbNode.connect(wetGain);

        dryGain.connect(this.audioContext.destination);
        wetGain.connect(this.audioContext.destination);
      } else {
        gainNode.connect(this.audioContext.destination);
      }

      // Store source
      const audioSource = {
        id,
        sourceNode,
        pannerNode,
        gainNode,
        buffer,
        playing: false,
        loop: options.loop || false,
        position: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: -1 },
        options
      };

      this.sources.set(id, audioSource);

      console.info(`[SpatialAudio] Source created: ${id}`);
      return audioSource;

    } catch (error) {
      console.error(`[SpatialAudio] Failed to create source ${id}:`, error);
      return null;
    }
  }

  /**
   * Load audio buffer from URL
   * @param {string} url - Audio file URL
   * @returns {Promise<AudioBuffer>}
   */
  async loadAudioBuffer(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await this.audioContext.decodeAudioData(arrayBuffer);
  }

  /**
   * Play audio source
   * @param {string} id - Source ID
   * @param {number} delay - Delay before playing (seconds)
   */
  play(id, delay = 0) {
    const source = this.sources.get(id);
    if (!source) {
      console.warn(`[SpatialAudio] Source not found: ${id}`);
      return;
    }

    if (source.playing) {
      console.warn(`[SpatialAudio] Source already playing: ${id}`);
      return;
    }

    source.sourceNode.loop = source.loop;
    source.sourceNode.start(this.audioContext.currentTime + delay);
    source.playing = true;

    this.metrics.activeSourcesCount++;

    console.info(`[SpatialAudio] Playing: ${id}`);
  }

  /**
   * Stop audio source
   * @param {string} id - Source ID
   */
  stop(id) {
    const source = this.sources.get(id);
    if (!source || !source.playing) {
      return;
    }

    source.sourceNode.stop();
    source.playing = false;

    this.metrics.activeSourcesCount--;

    console.info(`[SpatialAudio] Stopped: ${id}`);
  }

  /**
   * Update listener position (camera/head position)
   * @param {Object} position - {x, y, z}
   * @param {Object} orientation - {forward: {x, y, z}, up: {x, y, z}}
   */
  updateListener(position, orientation) {
    if (!this.enabled || !this.listener) {
      return;
    }

    try {
      // Update position
      if (this.listener.positionX) {
        // New API (AudioListener with AudioParam)
        this.listener.positionX.value = position.x;
        this.listener.positionY.value = position.y;
        this.listener.positionZ.value = position.z;

        if (orientation) {
          this.listener.forwardX.value = orientation.forward.x;
          this.listener.forwardY.value = orientation.forward.y;
          this.listener.forwardZ.value = orientation.forward.z;
          this.listener.upX.value = orientation.up.x;
          this.listener.upY.value = orientation.up.y;
          this.listener.upZ.value = orientation.up.z;
        }
      } else {
        // Legacy API
        this.listener.setPosition(position.x, position.y, position.z);

        if (orientation) {
          this.listener.setOrientation(
            orientation.forward.x,
            orientation.forward.y,
            orientation.forward.z,
            orientation.up.x,
            orientation.up.y,
            orientation.up.z
          );
        }
      }

      this.metrics.listenerUpdateCount++;

    } catch (error) {
      console.error('[SpatialAudio] Failed to update listener:', error);
    }
  }

  /**
   * Update source position
   * @param {string} id - Source ID
   * @param {Object} position - {x, y, z}
   * @param {Object} orientation - {x, y, z} (optional, for directional sounds)
   */
  updateSourcePosition(id, position, orientation = null) {
    const source = this.sources.get(id);
    if (!source) {
      return;
    }

    try {
      const panner = source.pannerNode;

      // Update position
      if (panner.positionX) {
        // New API
        panner.positionX.value = position.x;
        panner.positionY.value = position.y;
        panner.positionZ.value = position.z;

        if (orientation) {
          panner.orientationX.value = orientation.x;
          panner.orientationY.value = orientation.y;
          panner.orientationZ.value = orientation.z;
        }
      } else {
        // Legacy API
        panner.setPosition(position.x, position.y, position.z);

        if (orientation) {
          panner.setOrientation(orientation.x, orientation.y, orientation.z);
        }
      }

      source.position = position;
      if (orientation) {
        source.orientation = orientation;
      }

      this.metrics.sourceUpdateCount++;

    } catch (error) {
      console.error(`[SpatialAudio] Failed to update source ${id}:`, error);
    }
  }

  /**
   * Set source volume
   * @param {string} id - Source ID
   * @param {number} volume - Volume (0-1)
   * @param {number} rampTime - Ramp time in seconds
   */
  setVolume(id, volume, rampTime = 0) {
    const source = this.sources.get(id);
    if (!source) {
      return;
    }

    if (rampTime > 0) {
      source.gainNode.gain.linearRampToValueAtTime(
        volume,
        this.audioContext.currentTime + rampTime
      );
    } else {
      source.gainNode.gain.value = volume;
    }
  }

  /**
   * Apply preset configuration to source
   * @param {string} id - Source ID
   * @param {string} presetName - Preset name
   */
  applyPreset(id, presetName) {
    const source = this.sources.get(id);
    const preset = this.presets[presetName];

    if (!source || !preset) {
      console.warn(`[SpatialAudio] Invalid source or preset: ${id}, ${presetName}`);
      return;
    }

    const panner = source.pannerNode;
    panner.refDistance = preset.refDistance;
    panner.rolloffFactor = preset.rolloffFactor;
    panner.maxDistance = preset.maxDistance;

    if (preset.coneInnerAngle !== undefined) {
      panner.coneInnerAngle = preset.coneInnerAngle;
      panner.coneOuterAngle = preset.coneOuterAngle;
      panner.coneOuterGain = preset.coneOuterGain;
    }

    console.info(`[SpatialAudio] Applied preset "${presetName}" to ${id}`);
  }

  /**
   * Change reverb environment
   * @param {string} environment - Environment name
   */
  async setReverbEnvironment(environment) {
    if (!this.reverbPresets[environment]) {
      console.warn(`[SpatialAudio] Unknown environment: ${environment}`);
      return;
    }

    this.currentReverb = environment;
    await this.setupReverb();

    console.info(`[SpatialAudio] Reverb environment changed to: ${environment}`);
  }

  /**
   * Enable or disable reverb
   * @param {boolean} enabled - Enable state
   */
  setReverbEnabled(enabled) {
    this.config.enableReverb = enabled;

    if (enabled && !this.reverbNode) {
      this.setupReverb();
    }

    console.info(`[SpatialAudio] Reverb ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Resume audio context (required after user interaction)
   * @returns {Promise<void>}
   */
  async resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      console.info('[SpatialAudio] Audio context resumed');
    }
  }

  /**
   * Get metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      contextState: this.audioContext?.state || 'not initialized',
      currentTime: this.audioContext?.currentTime?.toFixed(2) || 0
    };
  }

  /**
   * Get source info
   * @param {string} id - Source ID
   * @returns {Object} Source information
   */
  getSourceInfo(id) {
    const source = this.sources.get(id);
    if (!source) {
      return null;
    }

    return {
      id: source.id,
      playing: source.playing,
      loop: source.loop,
      position: source.position,
      orientation: source.orientation,
      volume: source.gainNode.gain.value,
      panningModel: source.pannerNode.panningModel,
      distanceModel: source.pannerNode.distanceModel
    };
  }

  /**
   * Remove source
   * @param {string} id - Source ID
   */
  removeSource(id) {
    const source = this.sources.get(id);
    if (!source) {
      return;
    }

    if (source.playing) {
      this.stop(id);
    }

    // Disconnect nodes
    source.sourceNode.disconnect();
    source.pannerNode.disconnect();
    source.gainNode.disconnect();

    this.sources.delete(id);

    console.info(`[SpatialAudio] Source removed: ${id}`);
  }

  /**
   * Dispose and clean up
   */
  dispose() {
    // Stop all sources
    for (const [id] of this.sources) {
      this.removeSource(id);
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.enabled = false;
    console.info('[SpatialAudio] Disposed');
  }

  /**
   * Get usage example
   * @returns {string} Code example
   */
  static getUsageExample() {
    return `
// Initialize spatial audio
const spatialAudio = new VRSpatialAudioHRTF();
await spatialAudio.initialize();

// Resume context (required after user interaction)
await spatialAudio.resume();

// Create audio source
const source = await spatialAudio.createSource(
  'ambient-music',
  '/audio/ambient.mp3',
  {
    loop: true,
    volume: 0.5,
    refDistance: 10,
    rolloffFactor: 0.5
  }
);

// Or apply preset
spatialAudio.applyPreset('ambient-music', 'ambient');

// Play audio
spatialAudio.play('ambient-music');

// In animation loop - update listener (camera) position
function onXRFrame(time, frame) {
  const pose = frame.getViewerPose(referenceSpace);
  if (pose) {
    const position = pose.transform.position;
    const orientation = pose.transform.orientation;

    // Convert orientation to forward/up vectors
    const forward = { x: 0, y: 0, z: -1 }; // Calculate from orientation
    const up = { x: 0, y: 1, z: 0 };

    spatialAudio.updateListener(
      { x: position.x, y: position.y, z: position.z },
      { forward, up }
    );
  }

  // Update sound source position
  spatialAudio.updateSourcePosition(
    'ambient-music',
    { x: 5, y: 0, z: 0 }
  );
}

// Change reverb environment
spatialAudio.setReverbEnvironment('cathedral');
`;
  }

  /**
   * Get best practices
   * @returns {Array} List of recommendations
   */
  static getBestPractices() {
    return [
      {
        title: 'Use HRTF Panning Model',
        description: 'HRTF provides superior 3D audio, especially for back-positioned sources.',
        priority: 'high'
      },
      {
        title: 'Update Listener Frequently',
        description: 'Update listener position/orientation at high frequency (60+ Hz) for smooth audio.',
        priority: 'high'
      },
      {
        title: 'Resume Context After User Interaction',
        description: 'AudioContext starts suspended. Call resume() after user gesture.',
        priority: 'high'
      },
      {
        title: 'Use Appropriate Distance Models',
        description: 'Choose distance model based on content: inverse for realistic, linear for controlled fade.',
        priority: 'medium'
      },
      {
        title: 'Add Reverb for Realism',
        description: 'Convolution reverb adds environmental realism. Match reverb to virtual environment.',
        priority: 'medium'
      },
      {
        title: 'Optimize Source Count',
        description: 'Limit simultaneous sources. Use object pooling for frequently created/destroyed sounds.',
        priority: 'medium'
      }
    ];
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRSpatialAudioHRTF;
}

// Global instance
window.VRSpatialAudioHRTF = VRSpatialAudioHRTF;

console.info('[SpatialAudio] VR Spatial Audio with HRTF System loaded');
