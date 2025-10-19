/**
 * VR Spatial Audio System
 * Provides immersive 3D audio for VR browsing experience
 * @version 2.0.0
 */

class VRSpatialAudio {
    constructor() {
        this.audioContext = null;
        this.listener = null;
        this.sources = new Map();
        this.isInitialized = false;
        this.masterVolume = 0.7;
        this.spatialEnabled = true;

        // Sound effects library
        this.sounds = {
            click: null,
            hover: null,
            navigate: null,
            notification: null,
            error: null,
            success: null,
            tabSwitch: null,
            menuOpen: null,
            menuClose: null,
            typing: null
        };

        this.soundUrls = {
            click: '/assets/sounds/click.mp3',
            hover: '/assets/sounds/hover.mp3',
            navigate: '/assets/sounds/navigate.mp3',
            notification: '/assets/sounds/notification.mp3',
            error: '/assets/sounds/error.mp3',
            success: '/assets/sounds/success.mp3',
            tabSwitch: '/assets/sounds/tab-switch.mp3',
            menuOpen: '/assets/sounds/menu-open.mp3',
            menuClose: '/assets/sounds/menu-close.mp3',
            typing: '/assets/sounds/typing.mp3'
        };
    }

    /**
     * Initialize spatial audio system
     */
    async init() {
        if (this.isInitialized) return;

        try {
            // Create audio context
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();

            // Create listener (user's position in 3D space)
            this.listener = this.audioContext.listener;

            // Set initial listener position
            this.setListenerPosition(0, 0, 0);
            this.setListenerOrientation(0, 0, -1, 0, 1, 0);

            // Load sound effects
            await this.loadSounds();

            this.isInitialized = true;
            console.log('[VR Spatial Audio] Initialized successfully');

            return true;
        } catch (error) {
            console.error('[VR Spatial Audio] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Load all sound effects
     */
    async loadSounds() {
        const loadPromises = Object.entries(this.soundUrls).map(async ([name, url]) => {
            try {
                const buffer = await this.loadSound(url);
                this.sounds[name] = buffer;
                console.log(`[VR Audio] Loaded sound: ${name}`);
            } catch (error) {
                console.warn(`[VR Audio] Failed to load sound ${name}:`, error);
                // Create silent buffer as fallback
                this.sounds[name] = this.createSilentBuffer();
            }
        });

        await Promise.all(loadPromises);
    }

    /**
     * Load a single sound file
     */
    async loadSound(url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            return audioBuffer;
        } catch (error) {
            // If file doesn't exist, create a procedural sound
            return this.createProceduralSound(url);
        }
    }

    /**
     * Create procedural sound when audio file is missing
     */
    createProceduralSound(type) {
        const duration = 0.1;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);

        // Generate simple beep sound
        const frequency = 440;
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            data[i] = Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t * 10);
        }

        return buffer;
    }

    /**
     * Create silent buffer
     */
    createSilentBuffer() {
        const buffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.1, this.audioContext.sampleRate);
        return buffer;
    }

    /**
     * Play sound effect at position
     */
    playSound(soundName, position = null, volume = 1.0) {
        if (!this.isInitialized) {
            console.warn('[VR Audio] Audio system not initialized');
            return null;
        }

        const soundBuffer = this.sounds[soundName];
        if (!soundBuffer) {
            console.warn(`[VR Audio] Sound not found: ${soundName}`);
            return null;
        }

        // Resume audio context if suspended (browser autoplay policy)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Create source
        const source = this.audioContext.createBufferSource();
        source.buffer = soundBuffer;

        // Create gain node for volume control
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume * this.masterVolume;

        // Connect nodes
        if (position && this.spatialEnabled) {
            // Create panner for 3D spatial audio
            const panner = this.createPanner(position);
            source.connect(gainNode);
            gainNode.connect(panner);
            panner.connect(this.audioContext.destination);
        } else {
            // Non-spatial audio
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
        }

        // Play sound
        source.start(0);

        // Store source for tracking
        const sourceId = Date.now() + Math.random();
        this.sources.set(sourceId, { source, gainNode });

        // Remove from tracking when finished
        source.onended = () => {
            this.sources.delete(sourceId);
        };

        return sourceId;
    }

    /**
     * Create panner node for spatial audio
     */
    createPanner(position) {
        const panner = this.audioContext.createPanner();

        // Set panner properties
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.maxDistance = 10000;
        panner.rolloffFactor = 1;
        panner.coneInnerAngle = 360;
        panner.coneOuterAngle = 0;
        panner.coneOuterGain = 0;

        // Set position
        if (panner.positionX) {
            panner.positionX.value = position.x || 0;
            panner.positionY.value = position.y || 0;
            panner.positionZ.value = position.z || 0;
        } else {
            panner.setPosition(position.x || 0, position.y || 0, position.z || 0);
        }

        return panner;
    }

    /**
     * Set listener position (camera/user position)
     */
    setListenerPosition(x, y, z) {
        if (!this.listener) return;

        if (this.listener.positionX) {
            this.listener.positionX.value = x;
            this.listener.positionY.value = y;
            this.listener.positionZ.value = z;
        } else {
            this.listener.setPosition(x, y, z);
        }
    }

    /**
     * Set listener orientation (camera/user direction)
     */
    setListenerOrientation(fx, fy, fz, ux, uy, uz) {
        if (!this.listener) return;

        if (this.listener.forwardX) {
            this.listener.forwardX.value = fx;
            this.listener.forwardY.value = fy;
            this.listener.forwardZ.value = fz;
            this.listener.upX.value = ux;
            this.listener.upY.value = uy;
            this.listener.upZ.value = uz;
        } else {
            this.listener.setOrientation(fx, fy, fz, ux, uy, uz);
        }
    }

    /**
     * Update listener from VR camera
     */
    updateFromCamera(camera) {
        if (!camera || !this.listener) return;

        const position = camera.position;
        const quaternion = camera.quaternion;

        // Set listener position
        this.setListenerPosition(position.x, position.y, position.z);

        // Calculate forward and up vectors from quaternion
        const forward = new THREE.Vector3(0, 0, -1);
        const up = new THREE.Vector3(0, 1, 0);
        forward.applyQuaternion(quaternion);
        up.applyQuaternion(quaternion);

        // Set listener orientation
        this.setListenerOrientation(
            forward.x, forward.y, forward.z,
            up.x, up.y, up.z
        );
    }

    /**
     * Play UI sound effects
     */
    playClick(position = null) {
        return this.playSound('click', position, 0.3);
    }

    playHover(position = null) {
        return this.playSound('hover', position, 0.2);
    }

    playNavigate(position = null) {
        return this.playSound('navigate', position, 0.4);
    }

    playNotification(position = null) {
        return this.playSound('notification', position, 0.5);
    }

    playError(position = null) {
        return this.playSound('error', position, 0.6);
    }

    playSuccess(position = null) {
        return this.playSound('success', position, 0.5);
    }

    playTabSwitch(position = null) {
        return this.playSound('tabSwitch', position, 0.3);
    }

    playMenuOpen(position = null) {
        return this.playSound('menuOpen', position, 0.4);
    }

    playMenuClose(position = null) {
        return this.playSound('menuClose', position, 0.4);
    }

    playTyping(position = null) {
        return this.playSound('typing', position, 0.2);
    }

    /**
     * Set master volume
     */
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));

        // Update all active sources
        this.sources.forEach(({ gainNode }) => {
            gainNode.gain.value *= this.masterVolume;
        });
    }

    /**
     * Enable/disable spatial audio
     */
    setSpatialEnabled(enabled) {
        this.spatialEnabled = enabled;
    }

    /**
     * Stop all sounds
     */
    stopAll() {
        this.sources.forEach(({ source }) => {
            try {
                source.stop();
            } catch (error) {
                // Already stopped
            }
        });
        this.sources.clear();
    }

    /**
     * Stop specific sound
     */
    stopSound(sourceId) {
        const sourceData = this.sources.get(sourceId);
        if (sourceData) {
            try {
                sourceData.source.stop();
            } catch (error) {
                // Already stopped
            }
            this.sources.delete(sourceId);
        }
    }

    /**
     * Create ambient background sound
     */
    createAmbientSound(frequency = 100, volume = 0.05) {
        if (!this.isInitialized) return null;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gainNode.gain.value = volume * this.masterVolume;

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.start();

        return { oscillator, gainNode };
    }

    /**
     * Suspend audio context (save battery)
     */
    suspend() {
        if (this.audioContext && this.audioContext.state === 'running') {
            this.audioContext.suspend();
        }
    }

    /**
     * Resume audio context
     */
    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    /**
     * Cleanup and dispose
     */
    dispose() {
        this.stopAll();

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.sounds = {};
        this.sources.clear();
        this.isInitialized = false;
    }
}

// Auto-initialize on load
let vrSpatialAudio = null;

document.addEventListener('DOMContentLoaded', async () => {
    vrSpatialAudio = new VRSpatialAudio();

    // Initialize on first user interaction (browser autoplay policy)
    const initOnInteraction = async () => {
        await vrSpatialAudio.init();
        document.removeEventListener('click', initOnInteraction);
        document.removeEventListener('keydown', initOnInteraction);
    };

    document.addEventListener('click', initOnInteraction);
    document.addEventListener('keydown', initOnInteraction);
});

// Export for global access
if (typeof window !== 'undefined') {
    window.VRSpatialAudio = VRSpatialAudio;
    Object.defineProperty(window, 'vrSpatialAudio', {
        get: () => vrSpatialAudio
    });
}
