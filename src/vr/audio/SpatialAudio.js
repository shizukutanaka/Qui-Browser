/**
 * Spatial Audio System for VR
 * 3D positioned audio with HRTF (Head-Related Transfer Function)
 *
 * John Carmack principle: Audio is half of immersion
 */

import * as THREE from 'three';

/**
 * Synthesize PCM samples for a short procedural UI tone (a decaying, optionally
 * gliding sine). THREE/DOM-free and deterministic so it is unit-testable; used
 * as a fallback when the packaged sound files are absent, so interaction audio
 * (click/hover/success/error) still plays instead of being silent.
 *
 * @param {object} spec
 * @param {number} [spec.freq=440]      start frequency (Hz)
 * @param {number} [spec.endFreq]       end frequency for a linear glide (defaults to freq)
 * @param {number} [spec.duration=0.08] length in seconds
 * @param {number} [spec.decay=30]      exponential amplitude decay rate (higher = faster fade)
 * @param {number} [spec.gain=1]        peak amplitude scale (0..1)
 * @param {number} [sampleRate=48000]
 * @returns {Float32Array} mono samples in [-1, 1]
 */
export function synthesizeToneSamples(spec = {}, sampleRate = 48000) {
  const { freq = 440, endFreq = null, duration = 0.08, decay = 30, gain = 1 } = spec;
  const sr = sampleRate > 0 ? sampleRate : 48000;
  const n = Math.max(1, Math.floor(sr * Math.max(0, duration)));
  const out = new Float32Array(n);
  const f2 = endFreq === null || endFreq === undefined ? freq : endFreq;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const p = n > 1 ? i / (n - 1) : 0;        // 0..1 progress
    const f = freq + (f2 - freq) * p;          // linear frequency glide
    phase += (2 * Math.PI * f) / sr;
    const env = Math.exp(-decay * t);          // exponential decay envelope
    out[i] = Math.sin(phase) * env * gain;
  }
  return out;
}

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

      // Resume context if suspended (browser autoplay policy).
      // The first user gesture is not always a mouse click: on touch devices
      // (e.g. the Quest browser in 2D) it is `touchstart`, and keyboard-only
      // users produce `keydown`. Listening for click alone leaves audio
      // suspended for those users, so we arm all three and tear every listener
      // down as soon as any one of them fires (or on dispose if none do).
      if (this.context.state === 'suspended') {
        this._resumeEvents = ['click', 'touchstart', 'keydown'];
        this._resumeOnGesture = () => {
          this._removeResumeListeners();
          this.context.resume().then(() => {
            console.debug('SpatialAudio: Context resumed');
          }).catch((e) => {
            console.warn('SpatialAudio: Context resume failed', e);
          });
        };
        for (const evt of this._resumeEvents) {
          document.addEventListener(evt, this._resumeOnGesture, { once: true });
        }
      }

      console.debug('SpatialAudio: Initialized successfully');
      console.debug('SpatialAudio: Sample rate:', this.context.sampleRate, 'Hz');

    } catch (error) {
      console.error('SpatialAudio: Initialization failed', error);
    }
  }

  /**
   * Remove any armed autoplay-resume gesture listeners. Idempotent: safe to
   * call whether or not the listeners are still attached (the gesture handler
   * calls it, and so does dispose()).
   */
  _removeResumeListeners() {
    if (this._resumeOnGesture && this._resumeEvents) {
      for (const evt of this._resumeEvents) {
        document.removeEventListener(evt, this._resumeOnGesture);
      }
    }
    this._resumeOnGesture = null;
    this._resumeEvents = null;
  }

  /**
   * Load audio buffer from URL
   */
  async loadAudio(url, name) {
    if (this.buffers.has(name)) {
      return this.buffers.get(name);
    }

    try {
      // Bound the fetch: an absent signal means a stalled server leaves the
      // promise pending forever — no buffer, no error state, no retry.
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
      let response;
      try {
        response = await fetch(url, controller ? { signal: controller.signal } : undefined);
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching audio: ${url}`);
      }
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
   * Register a synthesized fallback buffer under `name` (see
   * synthesizeToneSamples). No-op if a buffer for that name is already loaded
   * (real files take precedence) or if there is no AudioContext.
   * @param {string} name
   * @param {object} spec — passed to synthesizeToneSamples
   * @returns {AudioBuffer|null}
   */
  registerProceduralBuffer(name, spec) {
    if (!this.context || this.buffers.has(name)) {
      return this.buffers.get(name) || null;
    }
    const sampleRate = this.context.sampleRate || 48000;
    const samples = synthesizeToneSamples(spec, sampleRate);
    const buffer = this.context.createBuffer(1, samples.length, sampleRate);
    if (typeof buffer.getChannelData === 'function') {
      buffer.getChannelData(0).set(samples);
    }
    this.buffers.set(name, buffer);
    this.stats.buffersLoaded++;
    console.debug(`SpatialAudio: Registered procedural buffer '${name}' (${samples.length} samples)`);
    return buffer;
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

    // Track end of playback. Capture the node and only apply state when it
    // is still the source's current node — after a restart the OLD node's
    // late onended must not clobber the new playback's isPlaying / counts.
    const node = source.node;
    node.onended = () => {
      if (source.node === node) {
        source.isPlaying = false;
        this.stats.sourcesActive--;
      }
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
    if (!source || !source.node) {
      return;
    }

    try {
      source.node.stop();
      source.node.disconnect();
      source.node = null;
      // Decrement only when we counted this source as playing — after a
      // natural end onended already decremented, and stop() must not
      // double-count. The stopped node's late onended also sees
      // source.node !== node and skips, so the count fires exactly once.
      if (source.isPlaying) {
        source.isPlaying = false;
        this.stats.sourcesActive--;
      }

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
    if (!source || !source.panner) {
      return;
    }

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
   * Set listener (user) position
   */
  setListenerPosition(x, y, z) {
    if (!this.listener) {
      return;
    }

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
    if (!this.listener) {
      return;
    }

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
    if (!camera) {
      return;
    }

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
    if (!source || !source.panner) {
      return;
    }

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
        if (src.panner.panningModel === 'HRTF') {
          hrtf++;
        } else {
          eq++;
        }
      }
    });
    this.stats.hrtfSources = hrtf;
    this.stats.equalPowerSources = eq;
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
   * Dispose audio system
   */
  dispose() {
    // Stop all sources. Snapshot the names first because stopping removes
    // each entry from the map mid-iteration.
    for (const name of [...this.sources.keys()]) {
      this.stop(name);
    }

    // Clear maps
    this.sources.clear();
    this.buffers.clear();

    // Reset LOD counters.
    this.stats.hrtfSources = 0;
    this.stats.equalPowerSources = 0;

    // Remove the autoplay-resume gesture listeners if they never fired.
    this._removeResumeListeners();

    // Close context
    if (this.context) {
      this.context.close();
      this.context = null;
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
 */
