/**
 * VR Video Player
 * Supports 360-degree and 180-degree videos in VR mode
 * @version 2.0.0
 */

class VRVideoPlayer {
    constructor() {
        this.video = null;
        this.videoTexture = null;
        this.videoSphere = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.videoMode = '360'; // '360', '180', 'flat'
        this.controlsPanel = null;
        this.progressBar = null;
        this.volumeSlider = null;
    }

    /**
     * Initialize VR video player
     */
    async init(videoElement) {
        if (!videoElement) {
            throw new Error('Video element is required');
        }

        this.video = videoElement;
        await this.setupThreeJS();
        this.createVideoSphere();
        this.createControls();
        this.attachEventListeners();
        this.startRenderLoop();

        return this;
    }

    /**
     * Setup Three.js scene
     */
    async setupThreeJS() {
        // Check if Three.js is available
        if (typeof THREE === 'undefined') {
            // Load Three.js dynamically
            await this.loadThreeJS();
        }

        // Create scene
        this.scene = new THREE.Scene();

        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 0, 0.1);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.xr.enabled = true;

        // Add canvas to DOM
        const container = document.getElementById('vr-video-container') || document.body;
        container.appendChild(this.renderer.domElement);
    }

    /**
     * Load Three.js library
     */
    loadThreeJS() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/three@0.150.0/build/three.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Create video sphere for 360/180 viewing
     */
    createVideoSphere() {
        // Create video texture
        this.videoTexture = new THREE.VideoTexture(this.video);
        this.videoTexture.minFilter = THREE.LinearFilter;
        this.videoTexture.magFilter = THREE.LinearFilter;
        this.videoTexture.format = THREE.RGBFormat;

        // Create material
        const material = new THREE.MeshBasicMaterial({
            map: this.videoTexture,
            side: THREE.BackSide
        });

        // Create geometry based on video mode
        let geometry;
        if (this.videoMode === '360') {
            geometry = new THREE.SphereGeometry(500, 60, 40);
        } else if (this.videoMode === '180') {
            geometry = new THREE.SphereGeometry(500, 60, 40, 0, Math.PI);
        } else {
            geometry = new THREE.PlaneGeometry(16, 9);
            material.side = THREE.FrontSide;
        }

        // Create mesh
        this.videoSphere = new THREE.Mesh(geometry, material);
        this.scene.add(this.videoSphere);
    }

    /**
     * Create video controls UI
     */
    createControls() {
        this.controlsPanel = document.createElement('div');
        this.controlsPanel.className = 'vr-video-controls';
        this.controlsPanel.innerHTML = `
            <div class="vr-video-controls-container">
                <div class="vr-video-info">
                    <span class="vr-video-title">${this.getVideoTitle()}</span>
                    <span class="vr-video-time">
                        <span class="vr-current-time">0:00</span> /
                        <span class="vr-duration-time">0:00</span>
                    </span>
                </div>

                <div class="vr-video-progress-container">
                    <input type="range" class="vr-video-progress" min="0" max="100" value="0" />
                    <div class="vr-video-buffer"></div>
                </div>

                <div class="vr-video-buttons">
                    <button class="vr-video-btn vr-play-pause" aria-label="Play/Pause">▶</button>
                    <button class="vr-video-btn vr-rewind" aria-label="Rewind 10s">⏪</button>
                    <button class="vr-video-btn vr-forward" aria-label="Forward 10s">⏩</button>

                    <div class="vr-volume-control">
                        <button class="vr-video-btn vr-mute" aria-label="Mute">🔊</button>
                        <input type="range" class="vr-volume-slider" min="0" max="100" value="100" />
                    </div>

                    <div class="vr-video-mode">
                        <button class="vr-video-btn vr-mode-360 active" data-mode="360">360°</button>
                        <button class="vr-video-btn vr-mode-180" data-mode="180">180°</button>
                        <button class="vr-video-btn vr-mode-flat" data-mode="flat">Flat</button>
                    </div>

                    <button class="vr-video-btn vr-fullscreen" aria-label="Fullscreen">⛶</button>
                    <button class="vr-video-btn vr-enter-vr" aria-label="Enter VR">🥽</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.controlsPanel);
        this.attachControlsEvents();
    }

    /**
     * Attach event listeners to controls
     */
    attachControlsEvents() {
        const panel = this.controlsPanel;

        // Play/Pause
        const playPauseBtn = panel.querySelector('.vr-play-pause');
        playPauseBtn.addEventListener('click', () => this.togglePlayPause());

        // Rewind
        panel.querySelector('.vr-rewind').addEventListener('click', () => {
            this.video.currentTime = Math.max(0, this.video.currentTime - 10);
        });

        // Forward
        panel.querySelector('.vr-forward').addEventListener('click', () => {
            this.video.currentTime = Math.min(this.video.duration, this.video.currentTime + 10);
        });

        // Progress bar
        this.progressBar = panel.querySelector('.vr-video-progress');
        this.progressBar.addEventListener('input', (e) => {
            const time = (e.target.value / 100) * this.video.duration;
            this.video.currentTime = time;
        });

        // Volume
        const muteBtn = panel.querySelector('.vr-mute');
        this.volumeSlider = panel.querySelector('.vr-volume-slider');

        muteBtn.addEventListener('click', () => this.toggleMute());
        this.volumeSlider.addEventListener('input', (e) => {
            this.video.volume = e.target.value / 100;
            this.updateVolumeIcon();
        });

        // Video mode buttons
        panel.querySelectorAll('[data-mode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.setVideoMode(mode);
            });
        });

        // Fullscreen
        panel.querySelector('.vr-fullscreen').addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // Enter VR
        panel.querySelector('.vr-enter-vr').addEventListener('click', () => {
            this.enterVR();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;

            switch (e.key.toLowerCase()) {
                case ' ':
                    e.preventDefault();
                    this.togglePlayPause();
                    break;
                case 'arrowleft':
                    this.video.currentTime -= 5;
                    break;
                case 'arrowright':
                    this.video.currentTime += 5;
                    break;
                case 'arrowup':
                    this.video.volume = Math.min(1, this.video.volume + 0.1);
                    break;
                case 'arrowdown':
                    this.video.volume = Math.max(0, this.video.volume - 0.1);
                    break;
                case 'm':
                    this.toggleMute();
                    break;
                case 'f':
                    this.toggleFullscreen();
                    break;
            }
        });
    }

    /**
     * Attach video event listeners
     */
    attachEventListeners() {
        // Update progress
        this.video.addEventListener('timeupdate', () => {
            this.updateProgress();
        });

        // Update duration
        this.video.addEventListener('loadedmetadata', () => {
            this.updateDuration();
        });

        // Handle play/pause state
        this.video.addEventListener('play', () => {
            this.isPlaying = true;
            this.isPaused = false;
            this.updatePlayPauseButton();
        });

        this.video.addEventListener('pause', () => {
            this.isPlaying = false;
            this.isPaused = true;
            this.updatePlayPauseButton();
        });

        // Handle buffering
        this.video.addEventListener('progress', () => {
            this.updateBuffer();
        });

        // Handle ended
        this.video.addEventListener('ended', () => {
            this.isPlaying = false;
            this.updatePlayPauseButton();
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.onWindowResize();
        });
    }

    /**
     * Toggle play/pause
     */
    togglePlayPause() {
        if (this.video.paused) {
            this.video.play();
        } else {
            this.video.pause();
        }
    }

    /**
     * Toggle mute
     */
    toggleMute() {
        this.video.muted = !this.video.muted;
        this.updateVolumeIcon();
    }

    /**
     * Toggle fullscreen
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.renderer.domElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    /**
     * Enter VR mode
     */
    async enterVR() {
        if (!navigator.xr) {
            VRUtils.showNotification('WebXR not supported', 'error');
            return;
        }

        try {
            const session = await navigator.xr.requestSession('immersive-vr', {
                requiredFeatures: ['local-floor']
            });

            await this.renderer.xr.setSession(session);
            this.video.play();

            VRUtils.showNotification('Entered VR mode', 'success');
        } catch (error) {
            console.error('VR entry failed:', error);
            VRUtils.showNotification('Failed to enter VR', 'error');
        }
    }

    /**
     * Set video mode (360, 180, flat)
     */
    setVideoMode(mode) {
        this.videoMode = mode;

        // Remove old sphere
        if (this.videoSphere) {
            this.scene.remove(this.videoSphere);
        }

        // Create new sphere with updated mode
        this.createVideoSphere();

        // Update button states
        this.controlsPanel.querySelectorAll('[data-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        VRUtils.showNotification(`${mode} mode activated`, 'info');
    }

    /**
     * Update progress bar
     */
    updateProgress() {
        if (!this.video.duration) return;

        const progress = (this.video.currentTime / this.video.duration) * 100;
        this.progressBar.value = progress;

        // Update time display
        const currentTimeEl = this.controlsPanel.querySelector('.vr-current-time');
        currentTimeEl.textContent = this.formatTime(this.video.currentTime);
    }

    /**
     * Update duration display
     */
    updateDuration() {
        const durationEl = this.controlsPanel.querySelector('.vr-duration-time');
        durationEl.textContent = this.formatTime(this.video.duration);
    }

    /**
     * Update buffer bar
     */
    updateBuffer() {
        if (!this.video.buffered.length) return;

        const buffered = this.video.buffered.end(this.video.buffered.length - 1);
        const duration = this.video.duration;
        const bufferPercent = (buffered / duration) * 100;

        const bufferBar = this.controlsPanel.querySelector('.vr-video-buffer');
        if (bufferBar) {
            bufferBar.style.width = bufferPercent + '%';
        }
    }

    /**
     * Update play/pause button
     */
    updatePlayPauseButton() {
        const btn = this.controlsPanel.querySelector('.vr-play-pause');
        btn.textContent = this.video.paused ? '▶' : '⏸';
    }

    /**
     * Update volume icon
     */
    updateVolumeIcon() {
        const btn = this.controlsPanel.querySelector('.vr-mute');
        if (this.video.muted || this.video.volume === 0) {
            btn.textContent = '🔇';
        } else if (this.video.volume < 0.5) {
            btn.textContent = '🔉';
        } else {
            btn.textContent = '🔊';
        }

        // Update slider
        this.volumeSlider.value = this.video.muted ? 0 : this.video.volume * 100;
    }

    /**
     * Handle window resize
     */
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    /**
     * Start render loop
     */
    startRenderLoop() {
        this.renderer.setAnimationLoop(() => {
            this.render();
        });
    }

    /**
     * Render scene
     */
    render() {
        // Update video texture
        if (this.video.readyState >= this.video.HAVE_CURRENT_DATA) {
            this.videoTexture.needsUpdate = true;
        }

        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Format time in MM:SS
     */
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Get video title
     */
    getVideoTitle() {
        return this.video.title ||
               this.video.getAttribute('data-title') ||
               'VR Video';
    }

    /**
     * Load video from URL
     */
    loadVideo(url) {
        this.video.src = url;
        this.video.load();
    }

    /**
     * Destroy player
     */
    destroy() {
        this.video.pause();
        this.video.src = '';

        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }

        if (this.controlsPanel && this.controlsPanel.parentNode) {
            this.controlsPanel.parentNode.removeChild(this.controlsPanel);
        }

        this.scene = null;
        this.camera = null;
        this.renderer = null;
    }
}

// Auto-detect and initialize VR video players
document.addEventListener('DOMContentLoaded', () => {
    const vrVideos = document.querySelectorAll('video[data-vr="true"], video.vr-video');

    vrVideos.forEach(async (video) => {
        try {
            const player = new VRVideoPlayer();
            await player.init(video);

            // Store player instance on video element
            video.vrPlayer = player;
        } catch (error) {
            console.error('Failed to initialize VR video player:', error);
        }
    });
});

// Export for global access
if (typeof window !== 'undefined') {
    window.VRVideoPlayer = VRVideoPlayer;
}
