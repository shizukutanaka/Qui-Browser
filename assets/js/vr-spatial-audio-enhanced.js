/**
 * VR Spatial Audio Enhanced System
 * Advanced 3D audio with Dolby Atmos support for immersive VR experiences
 * @version 2.0.0
 */

class VRSpatialAudioEnhanced {
    constructor() {
        // Audio context and settings
        this.audioContext = null;
        this.isInitialized = false;

        // Audio sources management
        this.audioSources = new Map();
        this.masterGain = null;
        this.listener = null;

        // HRTF and spatialization
        this.hrtfDatabase = null;
        this.useHRTF = true;

        // Dolby Atmos simulation
        this.atmosChannels = 128; // Maximum channels for Atmos
        this.channelGains = new Map();
        this.objectBasedAudio = true;

        // Environment settings
        this.environment = {
            type: 'neutral',
            reverbTime: 0.5,
            damping: 0.5,
            reflections: 0.3
        };

        // Audio processing nodes
        this.convolver = null;
        this.reverbGain = null;
        this.dryGain = null;

        // Performance settings
        this.maxSources = 32;
        this.updateInterval = 50; // ms

        // Event callbacks
        this.callbacks = {};

        this.init();
    }

    /**
     * Initialize audio system
     */
    async init() {
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Resume context if needed
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Create master gain
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 0.7;
            this.masterGain.connect(this.audioContext.destination);

            // Setup listener (camera position)
            this.listener = this.audioContext.listener;

            // Initialize HRTF
            await this.loadHRTFDatabase();

            // Setup reverb
            this.setupReverb();

            this.isInitialized = true;
            this.triggerCallback('audioInitialized');

        } catch (error) {
            console.error('[VR Spatial Audio] Initialization failed:', error);
            this.triggerCallback('audioInitFailed', error);
        }
    }

    /**
     * Load HRTF database for 3D audio
     */
    async loadHRTFDatabase() {
        try {
            // In production, load actual HRTF data
            // For now, use simplified HRTF simulation
            this.hrtfDatabase = {
                left: new Float32Array(256),
                right: new Float32Array(256)
            };

            // Generate basic HRTF filters
            for (let i = 0; i < 256; i++) {
                const angle = (i / 256) * Math.PI * 2;
                this.hrtfDatabase.left[i] = Math.sin(angle) * 0.5;
                this.hrtfDatabase.right[i] = Math.cos(angle) * 0.5;
            }
        } catch (error) {
            console.error('[VR Spatial Audio] HRTF loading failed:', error);
            this.useHRTF = false;
        }
    }

    /**
     * Setup reverb for environment simulation
     */
    setupReverb() {
        // Create convolver for reverb
        this.convolver = this.audioContext.createConvolver();
        this.reverbGain = this.audioContext.createGain();
        this.dryGain = this.audioContext.createGain();

        // Create simple reverb impulse response
        const impulseLength = this.audioContext.sampleRate * 2; // 2 seconds
        const impulse = this.audioContext.createBuffer(2, impulseLength, this.audioContext.sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < impulseLength; i++) {
                const decay = Math.pow(1 - i / impulseLength, 2);
                channelData[i] = (Math.random() * 2 - 1) * decay * 0.1;
            }
        }

        this.convolver.buffer = impulse;

        // Connect nodes
        this.reverbGain.gain.value = this.environment.reverbTime * 0.1;
        this.dryGain.gain.value = 1 - this.environment.reverbTime * 0.1;

        this.convolver.connect(this.reverbGain);
        this.reverbGain.connect(this.masterGain);
        this.dryGain.connect(this.masterGain);
    }

    /**
     * Create spatial audio source
     * @param {string} sourceId - Unique source ID
     * @param {Object} options - Source options
     * @returns {string} Source ID
     */
    createSource(sourceId, options = {}) {
        if (this.audioSources.size >= this.maxSources) {
            console.warn('[VR Spatial Audio] Maximum sources reached');
            return null;
        }

        const source = {
            id: sourceId,
            position: options.position || { x: 0, y: 0, z: 0 },
            velocity: options.velocity || { x: 0, y: 0, z: 0 },
            orientation: options.orientation || { x: 0, y: 0, z: -1 },
            volume: options.volume !== undefined ? options.volume : 1.0,
            loop: options.loop || false,
            autoplay: options.autoplay || false,
            minDistance: options.minDistance || 1,
            maxDistance: options.maxDistance || 100,
            rolloffFactor: options.rolloffFactor || 1,
            mediaElement: null,
            gainNode: null,
            pannerNode: null,
            filterNode: null
        };

        // Create audio nodes
        source.gainNode = this.audioContext.createGain();
        source.pannerNode = this.audioContext.createPanner();
        source.filterNode = this.audioContext.createBiquadFilter();

        // Configure panner
        source.pannerNode.panningModel = 'HRTF';
        source.pannerNode.distanceModel = 'exponential';
        source.pannerNode.refDistance = source.minDistance;
        source.pannerNode.maxDistance = source.maxDistance;
        source.pannerNode.rolloffFactor = source.rolloffFactor;

        // Connect nodes
        source.filterNode.connect(source.pannerNode);
        source.pannerNode.connect(source.gainNode);

        // Connect to reverb or dry path based on distance
        this.connectToReverb(source);

        this.audioSources.set(sourceId, source);
        this.updateSourcePosition(sourceId);

        this.triggerCallback('sourceCreated', source);
        return sourceId;
    }

    /**
     * Load audio from URL or element
     * @param {string} sourceId - Source ID
     * @param {string|HTMLMediaElement} media - Audio URL or media element
     */
    async loadMedia(sourceId, media) {
        const source = this.audioSources.get(sourceId);
        if (!source) return;

        try {
            if (typeof media === 'string') {
                // Load from URL
                const response = await fetch(media);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

                source.buffer = audioBuffer;
                source.mediaElement = null;
            } else {
                // Use media element
                source.mediaElement = media;
                source.buffer = null;

                // Connect media element to filter
                const mediaSource = this.audioContext.createMediaElementSource(media);
                mediaSource.connect(source.filterNode);
            }

            this.triggerCallback('mediaLoaded', { sourceId, media });
        } catch (error) {
            console.error(`[VR Spatial Audio] Failed to load media for ${sourceId}:`, error);
        }
    }

    /**
     * Play audio source
     * @param {string} sourceId - Source ID
     */
    play(sourceId) {
        const source = this.audioSources.get(sourceId);
        if (!source) return;

        if (source.buffer) {
            // Create buffer source
            const bufferSource = this.audioContext.createBufferSource();
            bufferSource.buffer = source.buffer;
            bufferSource.loop = source.loop;

            bufferSource.connect(source.filterNode);
            bufferSource.start();

            source.activeSource = bufferSource;
        } else if (source.mediaElement) {
            source.mediaElement.play();
        }

        source.isPlaying = true;
        this.triggerCallback('sourcePlayed', sourceId);
    }

    /**
     * Stop audio source
     * @param {string} sourceId - Source ID
     */
    stop(sourceId) {
        const source = this.audioSources.get(sourceId);
        if (!source) return;

        if (source.activeSource) {
            source.activeSource.stop();
            source.activeSource = null;
        } else if (source.mediaElement) {
            source.mediaElement.pause();
        }

        source.isPlaying = false;
        this.triggerCallback('sourceStopped', sourceId);
    }

    /**
     * Update source position and orientation
     * @param {string} sourceId - Source ID
     * @param {Object} position - New position (optional)
     * @param {Object} orientation - New orientation (optional)
     */
    updateSourcePosition(sourceId, position = null, orientation = null) {
        const source = this.audioSources.get(sourceId);
        if (!source) return;

        if (position) {
            source.position = position;
            source.pannerNode.setPosition(position.x, position.y, position.z);
        }

        if (orientation) {
            source.orientation = orientation;
            source.pannerNode.setOrientation(orientation.x, orientation.y, orientation.z);
        }

        // Update volume based on distance
        this.updateSourceVolume(sourceId);
    }

    /**
     * Update source volume based on distance
     * @param {string} sourceId - Source ID
     */
    updateSourceVolume(sourceId) {
        const source = this.audioSources.get(sourceId);
        if (!source) return;

        // Calculate distance from listener
        const dx = source.position.x - this.listener.positionX;
        const dy = source.position.y - this.listener.positionY;
        const dz = source.position.z - this.listener.positionZ;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Calculate volume based on distance model
        let volume = 1.0;
        if (distance > source.minDistance) {
            const range = source.maxDistance - source.minDistance;
            if (range > 0) {
                volume = Math.max(0, 1 - (distance - source.minDistance) / range);
            }
        }

        source.gainNode.gain.value = volume * source.volume;
    }

    /**
     * Connect source to appropriate audio path
     * @param {Object} source - Audio source
     */
    connectToReverb(source) {
        // Simple reverb routing based on distance
        const distance = Math.sqrt(
            source.position.x ** 2 +
            source.position.y ** 2 +
            source.position.z ** 2
        );

        if (distance > 10) {
            // Far sources go through reverb
            source.gainNode.disconnect();
            source.gainNode.connect(this.convolver);
            source.gainNode.connect(this.dryGain);
        } else {
            // Close sources are dry
            source.gainNode.disconnect();
            source.gainNode.connect(this.dryGain);
        }
    }

    /**
     * Set listener position and orientation (VR camera)
     * @param {Object} position - Listener position
     * @param {Object} orientation - Listener orientation
     */
    setListenerTransform(position, orientation) {
        if (!this.listener) return;

        // Set position
        this.listener.positionX.value = position.x;
        this.listener.positionY.value = position.y;
        this.listener.positionZ.value = position.z;

        // Set orientation (forward and up vectors)
        this.listener.forwardX.value = orientation.forward.x;
        this.listener.forwardY.value = orientation.forward.y;
        this.listener.forwardZ.value = orientation.forward.z;

        this.listener.upX.value = orientation.up.x;
        this.listener.upY.value = orientation.up.y;
        this.listener.upZ.value = orientation.up.z;

        // Update all source volumes
        for (const sourceId of this.audioSources.keys()) {
            this.updateSourceVolume(sourceId);
        }
    }

    /**
     * Enable Dolby Atmos mode
     * @param {boolean} enable - Enable Atmos
     */
    enableDolbyAtmos(enable) {
        this.objectBasedAudio = enable;

        if (enable) {
            this.setupAtmosChannels();
        } else {
            this.cleanupAtmosChannels();
        }

        this.triggerCallback('atmosToggled', enable);
    }

    /**
     * Setup Dolby Atmos channel layout
     */
    setupAtmosChannels() {
        // Create gain nodes for each Atmos channel
        for (let i = 0; i < this.atmosChannels; i++) {
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = 1 / this.atmosChannels;
            gainNode.connect(this.masterGain);
            this.channelGains.set(i, gainNode);
        }
    }

    /**
     * Cleanup Atmos channels
     */
    cleanupAtmosChannels() {
        for (const gainNode of this.channelGains.values()) {
            gainNode.disconnect();
        }
        this.channelGains.clear();
    }

    /**
     * Update environment acoustics
     * @param {Object} environment - Environment settings
     */
    updateEnvironment(environment) {
        this.environment = { ...this.environment, ...environment };

        // Update reverb settings
        if (this.reverbGain) {
            this.reverbGain.gain.value = this.environment.reverbTime * 0.1;
        }
        if (this.dryGain) {
            this.dryGain.gain.value = 1 - this.environment.reverbTime * 0.1;
        }

        // Update filter for damping
        if (this.filterNode) {
            this.filterNode.frequency.value = 2000 * (1 - this.environment.damping);
        }

        this.triggerCallback('environmentUpdated', this.environment);
    }

    /**
     * Remove audio source
     * @param {string} sourceId - Source ID
     */
    removeSource(sourceId) {
        const source = this.audioSources.get(sourceId);
        if (!source) return;

        this.stop(sourceId);

        // Disconnect and cleanup nodes
        if (source.gainNode) {
            source.gainNode.disconnect();
        }
        if (source.pannerNode) {
            source.pannerNode.disconnect();
        }
        if (source.filterNode) {
            source.filterNode.disconnect();
        }

        this.audioSources.delete(sourceId);
        this.triggerCallback('sourceRemoved', sourceId);
    }

    /**
     * Get audio statistics
     * @returns {Object} Audio stats
     */
    getStats() {
        return {
            initialized: this.isInitialized,
            totalSources: this.audioSources.size,
            activeSources: Array.from(this.audioSources.values()).filter(s => s.isPlaying).length,
            sampleRate: this.audioContext ? this.audioContext.sampleRate : 0,
            currentTime: this.audioContext ? this.audioContext.currentTime : 0,
            atmosEnabled: this.objectBasedAudio,
            environment: this.environment,
            maxSources: this.maxSources
        };
    }

    /**
     * Set master volume
     * @param {number} volume - Volume 0-1
     */
    setMasterVolume(volume) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    /**
     * Dispose and cleanup
     */
    dispose() {
        // Stop all sources
        for (const sourceId of this.audioSources.keys()) {
            this.stop(sourceId);
        }

        // Close audio context
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }

        // Cleanup Atmos channels
        this.cleanupAtmosChannels();

        this.audioSources.clear();
        this.isInitialized = false;
    }

    /**
     * Add event callback
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
    }

    /**
     * Trigger callback
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    triggerCallback(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => callback(data));
        }
    }
}

// Export for global access
if (typeof window !== 'undefined') {
    window.VRSpatialAudioEnhanced = VRSpatialAudioEnhanced;
}
