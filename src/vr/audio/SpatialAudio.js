/**
 * Spatial Audio System for VR
 * 3D positioned audio with HRTF (Head-Related Transfer Function)
 *
 * John Carmack principle: Audio is half of immersion
 */

import * as THREE from 'three';

export class SpatialAudio {
  constructor() {
    this.context = null;
    this.listener = null;
    this.sources = new Map();
    this.buffers = new Map();

    // Audio settings
    this.settings = {
      masterVolume: 1.0,
      distanceModel: 'exponential', // linear, inverse, exponential
      refDistance: 1,
      maxDistance: 100,
      rolloffFactor: 1,
      coneInnerAngle: 360,
      coneOuterAngle: 360,
      coneOuterGain: 0,
      enableHRTF: true,
      // Perceptual audio LOD: sources farther than this (metres) use
      // equalpower panning instead of full HRTF convolution.
      hrtfThreshold: 15
    };

    // Cached listener world position for LOD distance tests
    this._listenerPos = { x: 0, y: 1.6, z: 0 };

    // Statistics
    this.stats = {
      sourcesActive: 0,
      buffersLoaded: 0,
      totalPlayTime: 0,
      cpuLoad: 0,
      hrtfSources: 0,
      equalPowerSources: 0
    };

    this.initialize();
  }

  /**
   * Initialize Web Audio API context
   */
  async initialize() {
    try {
      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioContext();

      // Create listener (represents the user's head position)
      this.listener = this.context.listener;

      // Set default listener position
      this.setListenerPosition(0, 1.6, 0); // Eye height
      this.setListenerOrientation(0, 0, -1, 0, 1, 0); // Looking forward

      // Resume context if suspended (browser autoplay policy)
      if (this.context.state === 'suspended') {
        document.addEventListener('click', async () => {
          await this.context.resume();
          console.debug('SpatialAudio: Context resumed');
        }, { once: true });
      }

      console.debug('SpatialAudio: Initialized successfully');
      console.debug('SpatialAudio: Sample rate:', this.context.sampleRate, 'Hz');

    } catch (error) {
      console.error('SpatialAudio: Initialization failed', error);
    }
  }

  /**
   * Load audio buffer from URL
   */
  async loadAudio(url, name) {
    if (this.buffers.has(name)) {
      return this.buffers.get(name);
    }

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

      this.buffers.set(name, audioBuffer);
      this.stats.buffersLoaded++;

      console.debug(`SpatialAudio: Loaded '${name}' (${audioBuffer.duration.toFixed(2)}s)`);
      return audioBuffer;

    } catch (error) {
      console.error(`SpatialAudio: Failed to load ${url}`, error);
      return null;
    }
  }

  /**
   * Create spatial audio source
   */
  createSource(name, options = {}) {
    const source = {
      name: name,
      node: null,
      panner: null,
      gain: null,
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      loop: options.loop || false,
      volume: options.volume || 1.0,
      playbackRate: options.playbackRate || 1.0,
      startTime: 0,
      isPlaying: false
    };

    // Create panner node for 3D positioning
    source.panner = this.context.createPanner();
    source.panner.panningModel = this.settings.enableHRTF ? 'HRTF' : 'equalpower';
    source.panner.distanceModel = this.settings.distanceModel;
    source.panner.refDistance = options.refDistance || this.settings.refDistance;
    source.panner.maxDistance = options.maxDistance || this.settings.maxDistance;
    source.panner.rolloffFactor = options.rolloffFactor || this.settings.rolloffFactor;

    // Set cone parameters (directional sound)
    if (options.directional) {
      source.panner.coneInnerAngle = options.coneInnerAngle || 60;
      source.panner.coneOuterAngle = options.coneOuterAngle || 120;
      source.panner.coneOuterGain = options.coneOuterGain || 0.3;
    }

    // Create gain node for volume control
    source.gain = this.context.createGain();
    source.gain.gain.value = source.volume * this.settings.masterVolume;

    // Connect nodes: source -> panner -> gain -> destination
    source.panner.connect(source.gain);
    source.gain.connect(this.context.destination);

    this.sources.set(name, source);
    return source;
  }

  /**
   * Play spatial audio
   */
  play(sourceName, bufferName, position = null) {
    const source = this.sources.get(sourceName);
    const buffer = this.buffers.get(bufferName);

    if (!source) {
      console.error(`SpatialAudio: Source '${sourceName}' not found`);
      return;
    }

    if (!buffer) {
      console.error(`SpatialAudio: Buffer '${bufferName}' not found`);
      return;
    }

    // Stop if already playing
    if (source.isPlaying) {
      this.stop(sourceName);
    }

    // Create buffer source node
    source.node = this.context.createBufferSource();
    source.node.buffer = buffer;
    source.node.loop = source.loop;
    source.node.playbackRate.value = source.playbackRate;

    // Connect to panner
    source.node.connect(source.panner);

    // Set position if provided
    if (position) {
      this.setSourcePosition(sourceName, position.x, position.y, position.z);
    }

    // Track end of playback
    source.node.onended = () => {
      source.isPlaying = false;
      this.stats.sourcesActive--;
    };

    // Start playback
    source.node.start(0);
    source.startTime = this.context.currentTime;
    source.isPlaying = true;
    this.stats.sourcesActive++;

    console.debug(`SpatialAudio: Playing '${bufferName}' from source '${sourceName}'`);
  }

  /**
   * Stop audio source
   */
  stop(sourceName) {
    const source = this.sources.get(sourceName);
    if (!source || !source.node) return;

    // Voice sources wrap a MediaStreamAudioSourceNode, which has no start/stop;
    // they are torn down via removeVoiceSource(), not stop().
    if (source.isVoice) {
      this.removeVoiceSource(sourceName.replace(/^voice:/, ''));
      return;
    }

    try {
      source.node.stop();
      source.node.disconnect();
      source.node = null;
      source.isPlaying = false;

      // Update play time statistics
      if (source.startTime) {
        this.stats.totalPlayTime += this.context.currentTime - source.startTime;
      }
    } catch (error) {
      console.warn(`SpatialAudio: Error stopping source '${sourceName}'`, error);
    }
  }

  /**
   * Set source position in 3D space
   */
  setSourcePosition(sourceName, x, y, z) {
    const source = this.sources.get(sourceName);
    if (!source || !source.panner) return;

    source.position = { x, y, z };

    if (source.panner.positionX) {
      // Chrome 52+ supports AudioParam automation
      source.panner.positionX.value = x;
      source.panner.positionY.value = y;
      source.panner.positionZ.value = z;
    } else {
      // Fallback for older browsers
      source.panner.setPosition(x, y, z);
    }

    // Re-evaluate LOD tier after position change.
    this.updateSourceLOD(sourceName);
  }

  /**
   * Set source orientation (for directional sounds)
   */
  setSourceOrientation(sourceName, x, y, z) {
    const source = this.sources.get(sourceName);
    if (!source || !source.panner) return;

    if (source.panner.orientationX) {
      source.panner.orientationX.value = x;
      source.panner.orientationY.value = y;
      source.panner.orientationZ.value = z;
    } else {
      source.panner.setOrientation(x, y, z);
    }
  }

  /**
   * Set source velocity (for doppler effect)
   */
  setSourceVelocity(sourceName, x, y, z) {
    const source = this.sources.get(sourceName);
    if (!source || !source.panner) return;

    source.velocity = { x, y, z };

    if (source.panner.positionX) {
      // Modern API doesn't directly support velocity
      // Doppler effect needs to be simulated
      this.simulateDoppler(source);
    } else if (source.panner.setVelocity) {
      // Deprecated but might still work
      source.panner.setVelocity(x, y, z);
    }
  }

  /**
   * Simulate doppler effect
   */
  simulateDoppler(source) {
    if (!source.velocity) return;

    // Calculate relative velocity
    const speedOfSound = 343.3; // m/s at 20°C
    const velocity = Math.sqrt(
      source.velocity.x ** 2 +
      source.velocity.y ** 2 +
      source.velocity.z ** 2
    );

    // Apply pitch shift based on velocity
    const dopplerFactor = 1 + (velocity / speedOfSound);
    if (source.node) {
      source.node.playbackRate.value = source.playbackRate * dopplerFactor;
    }
  }

  /**
   * Set listener (user) position
   */
  setListenerPosition(x, y, z) {
    if (!this.listener) return;

    this._listenerPos = { x, y, z };

    if (this.listener.positionX) {
      this.listener.positionX.value = x;
      this.listener.positionY.value = y;
      this.listener.positionZ.value = z;
    } else {
      this.listener.setPosition(x, y, z);
    }
  }

  /**
   * Set listener orientation
   */
  setListenerOrientation(forwardX, forwardY, forwardZ, upX, upY, upZ) {
    if (!this.listener) return;

    if (this.listener.forwardX) {
      this.listener.forwardX.value = forwardX;
      this.listener.forwardY.value = forwardY;
      this.listener.forwardZ.value = forwardZ;
      this.listener.upX.value = upX;
      this.listener.upY.value = upY;
      this.listener.upZ.value = upZ;
    } else {
      this.listener.setOrientation(forwardX, forwardY, forwardZ, upX, upY, upZ);
    }
  }

  /**
   * Update listener from camera
   */
  updateListenerFromCamera(camera) {
    if (!camera) return;

    // Reuse scratch objects to avoid per-frame allocation in the render loop.
    if (!this._camPos) {
      this._camPos = new THREE.Vector3();
      this._camQuat = new THREE.Quaternion();
      this._fwd = new THREE.Vector3();
      this._up = new THREE.Vector3();
    }

    // Get camera world position
    const position = this._camPos;
    camera.getWorldPosition(position);
    this.setListenerPosition(position.x, position.y, position.z);

    // Get camera orientation
    const quaternion = this._camQuat;
    camera.getWorldQuaternion(quaternion);

    // Convert quaternion to forward and up vectors
    const forward = this._fwd.set(0, 0, -1).applyQuaternion(quaternion);
    const up = this._up.set(0, 1, 0).applyQuaternion(quaternion);

    this.setListenerOrientation(
      forward.x, forward.y, forward.z,
      up.x, up.y, up.z
    );

    // Re-evaluate perceptual LOD tier for all sources now that the
    // listener has moved.
    this.updateAllLOD();
  }

  /**
   * Return Euclidean distance between a source and the listener.
   */
  _sourceDistance(source) {
    const dx = source.position.x - this._listenerPos.x;
    const dy = source.position.y - this._listenerPos.y;
    const dz = source.position.z - this._listenerPos.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Apply perceptual audio LOD to a single source.
   * Sources within hrtfThreshold metres use HRTF convolution for full
   * spatialization; beyond that we fall back to the cheaper equalpower
   * panning model, which is perceptually sufficient at distance.
   */
  updateSourceLOD(sourceName) {
    const source = this.sources.get(sourceName);
    if (!source || !source.panner) return;

    const useHRTF = this.settings.enableHRTF &&
      this._sourceDistance(source) <= this.settings.hrtfThreshold;
    const targetModel = useHRTF ? 'HRTF' : 'equalpower';

    if (source.panner.panningModel !== targetModel) {
      source.panner.panningModel = targetModel;
    }
  }

  /**
   * Update LOD tier for every registered source.
   * Called automatically from updateListenerFromCamera; can also be called
   * after bulk position updates (e.g. scene teleport).
   */
  updateAllLOD() {
    let hrtf = 0;
    let eq = 0;
    this.sources.forEach((_, name) => {
      this.updateSourceLOD(name);
      const src = this.sources.get(name);
      if (src && src.panner) {
        if (src.panner.panningModel === 'HRTF') hrtf++;
        else eq++;
      }
    });
    this.stats.hrtfSources = hrtf;
    this.stats.equalPowerSources = eq;
  }

  // ── FR-7.2: Spatial voice — WebRTC peer audio → spatialized panner ─────────

  /**
   * Attach a remote peer's audio stream to a spatialized panner node.
   * Call this once when the WebRTC audio track for `peerId` becomes available
   * (typically inside MultiplayerSystem's `ontrack` handler).
   *
   * The source is stored under the key `voice:${peerId}` so it participates in
   * the normal LOD pipeline and can be positioned via setSourcePosition.
   *
   * @param {string}      peerId      — unique peer identifier
   * @param {MediaStream} mediaStream — the remote peer's audio MediaStream
   * @param {{x,y,z}}     [position]  — initial 3D position (default origin)
   * @returns {object|null} the created source record, or null on failure
   */
  createVoiceSource(peerId, mediaStream, position = { x: 0, y: 0, z: 0 }) {
    if (!this.context || !mediaStream) return null;

    const sourceName = `voice:${peerId}`;
    // Avoid duplicate sources for the same peer.
    if (this.sources.has(sourceName)) return this.sources.get(sourceName);

    try {
      const streamNode = this.context.createMediaStreamSource(mediaStream);

      const panner = this.context.createPanner();
      panner.panningModel = this.settings.enableHRTF ? 'HRTF' : 'equalpower';
      panner.distanceModel = this.settings.distanceModel;
      panner.refDistance   = this.settings.refDistance;
      panner.maxDistance   = this.settings.maxDistance;
      panner.rolloffFactor = this.settings.rolloffFactor;

      const gain = this.context.createGain();
      gain.gain.value = this.settings.masterVolume;

      streamNode.connect(panner);
      panner.connect(gain);
      gain.connect(this.context.destination);

      const source = {
        name  : sourceName,
        node  : streamNode, // MediaStreamAudioSourceNode — no start/stop needed
        panner,
        gain,
        position : { ...position },
        velocity : { x: 0, y: 0, z: 0 },
        isVoice  : true,
        volume   : 1.0,
        isPlaying: true
      };

      if (panner.positionX) {
        panner.positionX.value = position.x;
        panner.positionY.value = position.y;
        panner.positionZ.value = position.z;
      } else if (panner.setPosition) {
        panner.setPosition(position.x, position.y, position.z);
      }

      this.sources.set(sourceName, source);
      this.stats.sourcesActive++;
      this.updateSourceLOD(sourceName);
      console.debug(`SpatialAudio: Voice source created for peer '${peerId}'`);
      return source;
    } catch (e) {
      console.warn(`SpatialAudio: createVoiceSource failed for '${peerId}'`, e);
      return null;
    }
  }

  /**
   * Remove and disconnect the spatial voice source for a peer.
   * Call when the peer disconnects or leaves the multiplayer session.
   *
   * @param {string} peerId
   */
  removeVoiceSource(peerId) {
    const sourceName = `voice:${peerId}`;
    const source = this.sources.get(sourceName);
    if (!source) return;

    try {
      if (source.node) source.node.disconnect();
      if (source.panner) source.panner.disconnect();
      if (source.gain) source.gain.disconnect();
    } catch (e) { /* ignore disconnect errors */ }

    this.sources.delete(sourceName);
    this.stats.sourcesActive = Math.max(0, this.stats.sourcesActive - 1);
    console.debug(`SpatialAudio: Voice source removed for peer '${peerId}'`);
  }

  /**
   * Update the spatial position of a peer's voice source.
   * A thin wrapper around setSourcePosition using the voice: naming convention.
   *
   * @param {string} peerId
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  updateVoicePosition(peerId, x, y, z) {
    this.setSourcePosition(`voice:${peerId}`, x, y, z);
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume) {
    this.settings.masterVolume = Math.max(0, Math.min(1, volume));

    // Update all active sources
    this.sources.forEach(source => {
      if (source.gain) {
        source.gain.gain.value = source.volume * this.settings.masterVolume;
      }
    });
  }

  /**
   * Set source volume
   */
  setSourceVolume(sourceName, volume) {
    const source = this.sources.get(sourceName);
    if (!source || !source.gain) return;

    source.volume = Math.max(0, Math.min(1, volume));
    source.gain.gain.value = source.volume * this.settings.masterVolume;
  }

  /**
   * Fade volume over time
   */
  fadeVolume(sourceName, targetVolume, duration) {
    const source = this.sources.get(sourceName);
    if (!source || !source.gain) return;

    const startTime = this.context.currentTime;
    const endTime = startTime + duration;

    source.gain.gain.cancelScheduledValues(startTime);
    source.gain.gain.setValueAtTime(source.gain.gain.value, startTime);
    source.gain.gain.linearRampToValueAtTime(
      targetVolume * this.settings.masterVolume,
      endTime
    );

    source.volume = targetVolume;
  }

  /**
   * Create reverb effect
   */
  async createReverb(name, options = {}) {
    const convolver = this.context.createConvolver();

    // Generate impulse response
    const length = options.duration || 2;
    const decay = options.decay || 2;
    const sampleRate = this.context.sampleRate;
    const impulseLength = sampleRate * length;
    const impulse = this.context.createBuffer(2, impulseLength, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < impulseLength; i++) {
        channelData[i] = (Math.random() * 2 - 1) *
                         Math.pow(1 - i / impulseLength, decay);
      }
    }

    convolver.buffer = impulse;
    return convolver;
  }

  /**
   * Get audio statistics
   */
  getStats() {
    return {
      ...this.stats,
      contextState: this.context ? this.context.state : 'uninitialized',
      currentTime: this.context ? this.context.currentTime : 0,
      sampleRate: this.context ? this.context.sampleRate : 0,
      latency: this.context ? this.context.baseLatency || this.context.outputLatency || 0 : 0,
      hrtfThreshold: this.settings.hrtfThreshold
    };
  }

  /**
   * Dispose audio system
   */
  dispose() {
    // Stop/tear down all sources. Snapshot the names first because stopping a
    // voice source removes it from the map mid-iteration.
    for (const name of [...this.sources.keys()]) {
      this.stop(name);
    }

    // Clear maps
    this.sources.clear();
    this.buffers.clear();

    // Reset LOD counters.
    this.stats.hrtfSources = 0;
    this.stats.equalPowerSources = 0;

    // Close context
    if (this.context) {
      this.context.close();
    }

    console.debug('SpatialAudio: Disposed');
  }
}

/**
 * Usage Example:
 *
 * const audio = new SpatialAudio();
 *
 * // Load audio files
 * await audio.loadAudio('assets/sounds/click.mp3', 'click');
 * await audio.loadAudio('assets/sounds/ambient.mp3', 'ambient');
 *
 * // Create spatial sources
 * audio.createSource('button', { volume: 0.5 });
 * audio.createSource('environment', { loop: true, volume: 0.3 });
 *
 * // Play sounds at specific positions
 * audio.play('button', 'click', { x: 1, y: 1.5, z: -2 });
 * audio.play('environment', 'ambient', { x: 0, y: 2, z: 0 });
 *
 * // Update listener position from camera
 * function render() {
 *   audio.updateListenerFromCamera(camera);
 * }
 *
 * // Fade out
 * audio.fadeVolume('environment', 0, 2); // Fade out over 2 seconds
 */