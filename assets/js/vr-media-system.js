/**
 * VR Media System - Unified media playback and rendering for VR
 * Consolidates: vr-spatial-audio.js, vr-spatial-audio-enhanced.js, vr-video-player.js, vr-webgpu-renderer.js
 * @version 3.2.0
 */

class VRMediaSystem {
    constructor() {
        this.initialized = false;

        // Audio system
        this.audioContext = null;
        this.spatialSources = new Map();
        this.masterGain = null;
        this.masterVolume = 0.8;

        // Video player
        this.videoPlayers = new Map();
        this.activePlayer = null;
        this.supportedFormats = ['mp4', 'webm', 'ogg'];

        // Renderer
        this.rendererType = 'webgl2'; // 'webgl2' | 'webgpu'
        this.renderer = null;
        this.webGPUSupported = false;

        // Performance
        this.audioNodes = new Map();
        this.textureCache = new Map();
        this.maxCachedTextures = 20;

        this.init();
    }

    async init() {
        await this.setupAudioContext();
        this.setupVideoSystem();
        await this.detectRendererCapabilities();

        this.initialized = true;
        console.info('✅ VR Media System initialized');

        window.dispatchEvent(new CustomEvent('vr-media-ready'));
    }

    // ========== Spatial Audio System ==========

    async setupAudioContext() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();

            // Create master gain node
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = this.masterVolume;
            this.masterGain.connect(this.audioContext.destination);

            console.info('✅ Spatial audio initialized');
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
        }
    }

    createSpatialSound(url, options = {}) {
        if (!this.audioContext) {
            console.warn('Audio context not initialized');
            return null;
        }

        const {
            position = { x: 0, y: 0, z: 0 },
            loop = false,
            volume = 1.0,
            maxDistance = 10,
            refDistance = 1,
            rolloffFactor = 1,
            coneInnerAngle = 360,
            coneOuterAngle = 360,
            coneOuterGain = 0
        } = options;

        const soundId = `sound-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Create audio element
        const audio = new Audio(url);
        audio.loop = loop;
        audio.crossOrigin = 'anonymous';

        // Create nodes
        const source = this.audioContext.createMediaElementSource(audio);
        const panner = this.audioContext.createPanner();
        const gainNode = this.audioContext.createGain();

        // Configure panner (3D spatial audio)
        panner.panningModel = 'HRTF'; // Head-Related Transfer Function
        panner.distanceModel = 'inverse';
        panner.maxDistance = maxDistance;
        panner.refDistance = refDistance;
        panner.rolloffFactor = rolloffFactor;
        panner.coneInnerAngle = coneInnerAngle;
        panner.coneOuterAngle = coneOuterAngle;
        panner.coneOuterGain = coneOuterGain;

        // Set position
        panner.positionX.value = position.x;
        panner.positionY.value = position.y;
        panner.positionZ.value = position.z;

        // Set volume
        gainNode.gain.value = volume;

        // Connect nodes
        source.connect(gainNode);
        gainNode.connect(panner);
        panner.connect(this.masterGain);

        const spatialSound = {
            id: soundId,
            audio: audio,
            source: source,
            panner: panner,
            gain: gainNode,
            playing: false,
            position: { ...position }
        };

        this.spatialSources.set(soundId, spatialSound);
        this.audioNodes.set(soundId, [source, panner, gainNode]);

        return soundId;
    }

    playSpatialSound(soundId) {
        const sound = this.spatialSources.get(soundId);
        if (!sound) return;

        // Resume audio context if suspended (mobile requirement)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        sound.audio.play();
        sound.playing = true;
    }

    pauseSpatialSound(soundId) {
        const sound = this.spatialSources.get(soundId);
        if (!sound) return;

        sound.audio.pause();
        sound.playing = false;
    }

    stopSpatialSound(soundId) {
        const sound = this.spatialSources.get(soundId);
        if (!sound) return;

        sound.audio.pause();
        sound.audio.currentTime = 0;
        sound.playing = false;
    }

    setSpatialSoundPosition(soundId, position) {
        const sound = this.spatialSources.get(soundId);
        if (!sound) return;

        sound.panner.positionX.value = position.x;
        sound.panner.positionY.value = position.y;
        sound.panner.positionZ.value = position.z;

        sound.position = { ...position };
    }

    setSpatialSoundVolume(soundId, volume) {
        const sound = this.spatialSources.get(soundId);
        if (!sound) return;

        sound.gain.gain.value = Math.max(0, Math.min(1, volume));
    }

    updateListenerPosition(position, orientation) {
        if (!this.audioContext || !this.audioContext.listener) return;

        const listener = this.audioContext.listener;

        // Set position
        if (listener.positionX) {
            listener.positionX.value = position.x;
            listener.positionY.value = position.y;
            listener.positionZ.value = position.z;
        }

        // Set orientation
        if (listener.forwardX && orientation) {
            listener.forwardX.value = orientation.forward.x;
            listener.forwardY.value = orientation.forward.y;
            listener.forwardZ.value = orientation.forward.z;
            listener.upX.value = orientation.up.x;
            listener.upY.value = orientation.up.y;
            listener.upZ.value = orientation.up.z;
        }
    }

    setMasterVolume(volume) {
        if (!this.masterGain) return;

        this.masterVolume = Math.max(0, Math.min(1, volume));
        this.masterGain.gain.value = this.masterVolume;
    }

    // ========== Video Player System ==========

    setupVideoSystem() {
        console.info('Video system ready');
    }

    createVideoPlayer(url, options = {}) {
        const {
            width = 1920,
            height = 1080,
            autoplay = false,
            loop = false,
            muted = false,
            controls = true,
            spatial = true,
            position = { x: 0, y: 1.5, z: -2 }
        } = options;

        const playerId = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Create video element
        const video = document.createElement('video');
        video.src = url;
        video.width = width;
        video.height = height;
        video.autoplay = autoplay;
        video.loop = loop;
        video.muted = muted;
        video.crossOrigin = 'anonymous';

        if (controls) {
            video.controls = true;
        }

        // Create THREE.js components
        const texture = new THREE.VideoTexture(video);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.format = THREE.RGBFormat;

        const aspectRatio = width / height;
        const screenWidth = 3.0;
        const screenHeight = screenWidth / aspectRatio;

        const geometry = new THREE.PlaneGeometry(screenWidth, screenHeight);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide
        });

        const screen = new THREE.Mesh(geometry, material);
        screen.position.set(position.x, position.y, position.z);

        // Add spatial audio if requested
        let audioId = null;
        if (spatial && !muted) {
            audioId = this.createSpatialSound(url, {
                position: position,
                loop: loop
            });
        }

        const player = {
            id: playerId,
            video: video,
            texture: texture,
            screen: screen,
            audioId: audioId,
            playing: false,
            metadata: {
                width: width,
                height: height,
                duration: 0,
                currentTime: 0
            }
        };

        // Event listeners
        video.addEventListener('loadedmetadata', () => {
            player.metadata.duration = video.duration;
            player.metadata.width = video.videoWidth;
            player.metadata.height = video.videoHeight;
        });

        video.addEventListener('timeupdate', () => {
            player.metadata.currentTime = video.currentTime;
        });

        this.videoPlayers.set(playerId, player);

        return { playerId, screen };
    }

    playVideo(playerId) {
        const player = this.videoPlayers.get(playerId);
        if (!player) return;

        player.video.play();
        player.playing = true;

        if (player.audioId) {
            this.playSpatialSound(player.audioId);
        }

        this.activePlayer = playerId;
    }

    pauseVideo(playerId) {
        const player = this.videoPlayers.get(playerId);
        if (!player) return;

        player.video.pause();
        player.playing = false;

        if (player.audioId) {
            this.pauseSpatialSound(player.audioId);
        }
    }

    stopVideo(playerId) {
        const player = this.videoPlayers.get(playerId);
        if (!player) return;

        player.video.pause();
        player.video.currentTime = 0;
        player.playing = false;

        if (player.audioId) {
            this.stopSpatialSound(player.audioId);
        }
    }

    seekVideo(playerId, time) {
        const player = this.videoPlayers.get(playerId);
        if (!player) return;

        player.video.currentTime = Math.max(0, Math.min(player.metadata.duration, time));
    }

    setVideoVolume(playerId, volume) {
        const player = this.videoPlayers.get(playerId);
        if (!player) return;

        if (player.audioId) {
            this.setSpatialSoundVolume(player.audioId, volume);
        } else {
            player.video.volume = Math.max(0, Math.min(1, volume));
        }
    }

    // ========== 360° Video Support ==========

    create360Video(url, options = {}) {
        const {
            stereoMode = 'mono', // 'mono' | 'top-bottom' | 'left-right'
            projection = 'equirectangular', // 'equirectangular' | 'cubemap'
            autoplay = false,
            loop = false
        } = options;

        const playerId = `360-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Create video element
        const video = document.createElement('video');
        video.src = url;
        video.autoplay = autoplay;
        video.loop = loop;
        video.crossOrigin = 'anonymous';

        // Create texture
        const texture = new THREE.VideoTexture(video);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        // Create sphere geometry (inside-out)
        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1); // Flip inside out

        // Adjust UVs for stereo mode
        if (stereoMode === 'top-bottom') {
            this.adjustUVsTopBottom(geometry);
        } else if (stereoMode === 'left-right') {
            this.adjustUVsLeftRight(geometry);
        }

        const material = new THREE.MeshBasicMaterial({
            map: texture
        });

        const sphere = new THREE.Mesh(geometry, material);

        const player = {
            id: playerId,
            type: '360',
            video: video,
            texture: texture,
            sphere: sphere,
            stereoMode: stereoMode,
            playing: false
        };

        this.videoPlayers.set(playerId, player);

        return { playerId, sphere };
    }

    adjustUVsTopBottom(geometry) {
        const uvs = geometry.attributes.uv.array;
        for (let i = 1; i < uvs.length; i += 2) {
            uvs[i] = uvs[i] * 0.5 + 0.5; // Map to top half
        }
        geometry.attributes.uv.needsUpdate = true;
    }

    adjustUVsLeftRight(geometry) {
        const uvs = geometry.attributes.uv.array;
        for (let i = 0; i < uvs.length; i += 2) {
            uvs[i] = uvs[i] * 0.5; // Map to left half
        }
        geometry.attributes.uv.needsUpdate = true;
    }

    // ========== WebGPU Renderer ==========

    async detectRendererCapabilities() {
        // Check WebGPU support
        if ('gpu' in navigator) {
            try {
                const adapter = await navigator.gpu.requestAdapter();
                if (adapter) {
                    this.webGPUSupported = true;
                    console.info('✅ WebGPU supported');
                }
            } catch (error) {
                console.warn('WebGPU not available:', error);
            }
        }

        // Fallback to WebGL2
        if (!this.webGPUSupported) {
            this.rendererType = 'webgl2';
            console.info('Using WebGL2 renderer');
        }
    }

    async initializeWebGPURenderer(canvas) {
        if (!this.webGPUSupported) {
            console.warn('WebGPU not supported');
            return false;
        }

        try {
            const adapter = await navigator.gpu.requestAdapter();
            const device = await adapter.requestDevice();

            const context = canvas.getContext('webgpu');
            const format = navigator.gpu.getPreferredCanvasFormat();

            context.configure({
                device: device,
                format: format,
                alphaMode: 'opaque'
            });

            this.renderer = {
                type: 'webgpu',
                device: device,
                context: context,
                format: format
            };

            console.info('✅ WebGPU renderer initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize WebGPU:', error);
            return false;
        }
    }

    // ========== Texture Cache ==========

    cacheTexture(key, texture) {
        // Limit cache size
        if (this.textureCache.size >= this.maxCachedTextures) {
            // Remove oldest entry (FIFO)
            const firstKey = this.textureCache.keys().next().value;
            const oldTexture = this.textureCache.get(firstKey);
            if (oldTexture) {
                oldTexture.dispose();
            }
            this.textureCache.delete(firstKey);
        }

        this.textureCache.set(key, texture);
    }

    getC achedTexture(key) {
        return this.textureCache.get(key);
    }

    clearTextureCache() {
        this.textureCache.forEach(texture => {
            if (texture && texture.dispose) {
                texture.dispose();
            }
        });
        this.textureCache.clear();
    }

    // ========== Cleanup ==========

    removeSpatialSound(soundId) {
        const sound = this.spatialSources.get(soundId);
        if (!sound) return;

        this.stopSpatialSound(soundId);

        // Disconnect and dispose
        const nodes = this.audioNodes.get(soundId);
        if (nodes) {
            nodes.forEach(node => {
                try {
                    node.disconnect();
                } catch (e) {
                    // Already disconnected
                }
            });
        }

        this.spatialSources.delete(soundId);
        this.audioNodes.delete(soundId);
    }

    removeVideoPlayer(playerId) {
        const player = this.videoPlayers.get(playerId);
        if (!player) return;

        this.stopVideo(playerId);

        // Remove audio if exists
        if (player.audioId) {
            this.removeSpatialSound(player.audioId);
        }

        // Dispose resources
        if (player.texture) player.texture.dispose();
        if (player.screen) {
            if (player.screen.geometry) player.screen.geometry.dispose();
            if (player.screen.material) player.screen.material.dispose();
        }
        if (player.sphere) {
            if (player.sphere.geometry) player.sphere.geometry.dispose();
            if (player.sphere.material) player.sphere.material.dispose();
        }

        this.videoPlayers.delete(playerId);
    }

    cleanup() {
        // Stop all sounds
        this.spatialSources.forEach((sound, id) => {
            this.removeSpatialSound(id);
        });

        // Remove all video players
        this.videoPlayers.forEach((player, id) => {
            this.removeVideoPlayer(id);
        });

        // Clear texture cache
        this.clearTextureCache();

        // Close audio context
        if (this.audioContext) {
            this.audioContext.close();
        }

        console.info('VR Media System cleaned up');
    }
}

// Initialize and export
window.VRMediaSystem = new VRMediaSystem();

console.log('✅ VR Media System loaded');