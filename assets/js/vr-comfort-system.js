/**
 * VR Comfort System
 * Motion sickness prevention and comfort features
 * Based on VR comfort research and best practices
 * @version 2.0.0
 */

class VRComfortSystem {
    constructor() {
        // Comfort settings
        this.settings = {
            vignette: {
                enabled: true,
                intensity: 0.5, // 0-1
                color: '#000000',
                smoothness: 0.5
            },
            locomotion: {
                mode: 'teleport', // 'teleport', 'smooth', 'dash'
                smoothSpeed: 2.0, // m/s
                snapTurn: true,
                snapAngle: 30, // degrees
                smoothTurn: false,
                turnSpeed: 45 // degrees/s
            },
            frameRate: {
                target: 90, // Hz (Meta Quest 2/3 standard)
                min: 72, // Minimum acceptable
                monitoring: true
            },
            fov: {
                reduction: false,
                reductionAmount: 0.2 // 0-1
            },
            staticReference: {
                enabled: true,
                type: 'grid', // 'grid', 'horizon', 'nose', 'cockpit'
                opacity: 0.3
            },
            comfort: {
                reducedMotion: false,
                restFrames: true, // Show static frame during high motion
                gradualAcceleration: true,
                maxAcceleration: 5.0 // m/s²
            }
        };

        // Performance monitoring
        this.performance = {
            fps: 90,
            frameTime: 11.1, // ms
            droppedFrames: 0,
            lastFrameTime: performance.now()
        };

        // Motion tracking
        this.motion = {
            velocity: new THREE.Vector3(),
            acceleration: new THREE.Vector3(),
            lastPosition: new THREE.Vector3(),
            lastVelocity: new THREE.Vector3(),
            isMoving: false
        };

        // Vignette effect
        this.vignetteElement = null;
        this.staticReferenceElement = null;

        // Teleport visualization
        this.teleportMarker = null;
        this.teleportCurve = null;

        // Session time tracking
        this.sessionStartTime = Date.now();
        this.sessionDuration = 0;
        this.breakReminder = {
            enabled: true,
            interval: 30 * 60 * 1000, // 30 minutes
            lastReminder: Date.now()
        };
    }

    /**
     * Initialize comfort system
     * @param {THREE.Scene} scene - Three.js scene
     * @param {THREE.Camera} camera - VR camera
     */
    init(scene, camera) {
        this.scene = scene;
        this.camera = camera;

        // Setup comfort features
        this.setupVignette();
        this.setupStaticReference();
        this.setupTeleport();
        this.startPerformanceMonitoring();

        console.log('[VR Comfort] Initialized');
        return this;
    }

    /**
     * Setup vignette effect for motion comfort
     */
    setupVignette() {
        if (!this.settings.vignette.enabled) return;

        // Create vignette overlay
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        const ctx = canvas.getContext('2d');

        // Create radial gradient
        const gradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, canvas.width * 0.3,
            canvas.width / 2, canvas.height / 2, canvas.width * 0.6
        );

        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, `rgba(0, 0, 0, ${this.settings.vignette.intensity})`);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        canvas.style.backgroundImage = `url(${canvas.toDataURL()})`;
        canvas.style.backgroundSize = 'cover';

        document.body.appendChild(canvas);
        this.vignetteElement = canvas;
    }

    /**
     * Setup static visual reference
     */
    setupStaticReference() {
        if (!this.settings.staticReference.enabled) return;

        const type = this.settings.staticReference.type;

        if (type === 'grid') {
            this.createGridReference();
        } else if (type === 'horizon') {
            this.createHorizonReference();
        } else if (type === 'nose') {
            this.createNoseReference();
        }
    }

    /**
     * Create grid floor reference
     */
    createGridReference() {
        const gridHelper = new THREE.GridHelper(
            20, // size
            20, // divisions
            0x00ffff, // center line color
            0x444444  // grid color
        );
        gridHelper.material.transparent = true;
        gridHelper.material.opacity = this.settings.staticReference.opacity;
        gridHelper.position.y = -0.1; // Slightly below floor
        gridHelper.name = 'staticReference';

        this.scene.add(gridHelper);
        this.staticReferenceElement = gridHelper;
    }

    /**
     * Create horizon line reference
     */
    createHorizonReference() {
        const geometry = new THREE.BufferGeometry();
        const points = [];

        for (let i = 0; i <= 360; i += 10) {
            const angle = (i * Math.PI) / 180;
            const radius = 50;
            points.push(new THREE.Vector3(
                Math.cos(angle) * radius,
                this.camera.position.y,
                Math.sin(angle) * radius
            ));
        }

        geometry.setFromPoints(points);

        const material = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: this.settings.staticReference.opacity
        });

        const horizon = new THREE.Line(geometry, material);
        horizon.name = 'staticReference';

        this.scene.add(horizon);
        this.staticReferenceElement = horizon;
    }

    /**
     * Create virtual nose reference
     */
    createNoseReference() {
        const geometry = new THREE.ConeGeometry(0.01, 0.05, 8);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffcc99,
            transparent: true,
            opacity: this.settings.staticReference.opacity
        });

        const nose = new THREE.Mesh(geometry, material);
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, -0.05, -0.1);
        nose.name = 'staticReference';

        // Attach to camera
        this.camera.add(nose);
        this.staticReferenceElement = nose;
    }

    /**
     * Setup teleport system
     */
    setupTeleport() {
        if (this.settings.locomotion.mode !== 'teleport') return;

        // Create teleport marker
        const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.7
        });

        this.teleportMarker = new THREE.Mesh(geometry, material);
        this.teleportMarker.visible = false;
        this.scene.add(this.teleportMarker);
    }

    /**
     * Update comfort system (call in render loop)
     * @param {number} deltaTime - Time since last update
     */
    update(deltaTime) {
        this.updatePerformanceMetrics(deltaTime);
        this.updateMotionTracking(deltaTime);
        this.updateVignette(deltaTime);
        this.checkBreakReminder();
    }

    /**
     * Update performance metrics
     * @param {number} deltaTime - Delta time
     */
    updatePerformanceMetrics(deltaTime) {
        const now = performance.now();
        const frameTime = now - this.performance.lastFrameTime;

        this.performance.frameTime = frameTime;
        this.performance.fps = 1000 / frameTime;
        this.performance.lastFrameTime = now;

        // Check for dropped frames
        if (this.performance.fps < this.settings.frameRate.min) {
            this.performance.droppedFrames++;

            // Reduce quality if too many drops
            if (this.performance.droppedFrames > 10) {
                this.reduceQuality();
                this.performance.droppedFrames = 0;
            }
        }
    }

    /**
     * Update motion tracking
     * @param {number} deltaTime - Delta time
     */
    updateMotionTracking(deltaTime) {
        if (!this.camera || deltaTime === 0) return;

        const currentPosition = this.camera.position.clone();

        // Calculate velocity
        const velocity = new THREE.Vector3()
            .subVectors(currentPosition, this.motion.lastPosition)
            .divideScalar(deltaTime);

        // Calculate acceleration
        const acceleration = new THREE.Vector3()
            .subVectors(velocity, this.motion.lastVelocity)
            .divideScalar(deltaTime);

        this.motion.velocity.copy(velocity);
        this.motion.acceleration.copy(acceleration);
        this.motion.lastPosition.copy(currentPosition);
        this.motion.lastVelocity.copy(velocity);

        // Check if moving
        this.motion.isMoving = velocity.length() > 0.01;
    }

    /**
     * Update vignette effect based on motion
     * @param {number} deltaTime - Delta time
     */
    updateVignette(deltaTime) {
        if (!this.vignetteElement || !this.settings.vignette.enabled) return;

        const speed = this.motion.velocity.length();
        const acceleration = this.motion.acceleration.length();

        // Increase vignette during movement
        let targetOpacity = 0;

        if (this.motion.isMoving) {
            // More vignette for faster movement or acceleration
            targetOpacity = Math.min(
                this.settings.vignette.intensity,
                (speed / 5.0) * 0.5 + (acceleration / 10.0) * 0.3
            );
        }

        // Smooth transition
        const currentOpacity = parseFloat(this.vignetteElement.style.opacity) || 0;
        const newOpacity = currentOpacity + (targetOpacity - currentOpacity) * 0.1;

        this.vignetteElement.style.opacity = newOpacity.toString();
    }

    /**
     * Show teleport target
     * @param {THREE.Vector3} position - Target position
     */
    showTeleportTarget(position) {
        if (!this.teleportMarker) return;

        this.teleportMarker.position.copy(position);
        this.teleportMarker.position.y = 0.025; // Slightly above ground
        this.teleportMarker.visible = true;

        // Pulse animation
        const scale = 1 + Math.sin(Date.now() * 0.005) * 0.1;
        this.teleportMarker.scale.set(scale, 1, scale);
    }

    /**
     * Hide teleport target
     */
    hideTeleportTarget() {
        if (this.teleportMarker) {
            this.teleportMarker.visible = false;
        }
    }

    /**
     * Teleport to position
     * @param {THREE.Vector3} position - Target position
     * @param {Function} callback - Completion callback
     */
    teleportTo(position, callback) {
        if (!this.camera) return;

        // Fade out
        this.fadeScreen(0, 1, 200, () => {
            // Move camera
            this.camera.position.x = position.x;
            this.camera.position.z = position.z;

            // Fade in
            this.fadeScreen(1, 0, 200, callback);
        });

        this.hideTeleportTarget();
    }

    /**
     * Fade screen for teleport
     * @param {number} from - Start opacity
     * @param {number} to - End opacity
     * @param {number} duration - Duration in ms
     * @param {Function} callback - Completion callback
     */
    fadeScreen(from, to, duration, callback) {
        const fadeElement = document.createElement('div');
        fadeElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: black;
            opacity: ${from};
            pointer-events: none;
            z-index: 10000;
            transition: opacity ${duration}ms ease;
        `;

        document.body.appendChild(fadeElement);

        requestAnimationFrame(() => {
            fadeElement.style.opacity = to.toString();
        });

        setTimeout(() => {
            fadeElement.remove();
            if (callback) callback();
        }, duration);
    }

    /**
     * Snap turn camera
     * @param {number} direction - Direction (1 or -1)
     */
    snapTurn(direction) {
        if (!this.camera || !this.settings.locomotion.snapTurn) return;

        const angle = this.settings.locomotion.snapAngle * direction;
        const radians = (angle * Math.PI) / 180;

        // Fade for comfort
        this.fadeScreen(0, 0.3, 100, () => {
            this.camera.rotation.y += radians;
            this.fadeScreen(0.3, 0, 100);
        });
    }

    /**
     * Check if break reminder needed
     */
    checkBreakReminder() {
        if (!this.breakReminder.enabled) return;

        const now = Date.now();
        const timeSinceReminder = now - this.breakReminder.lastReminder;

        if (timeSinceReminder >= this.breakReminder.interval) {
            this.showBreakReminder();
            this.breakReminder.lastReminder = now;
        }
    }

    /**
     * Show break reminder notification
     */
    showBreakReminder() {
        console.log('[VR Comfort] Time for a break!');

        if (window.vrUtils) {
            window.vrUtils.showNotification(
                '休憩時間です',
                '30分経過しました。短い休憩を取ることをお勧めします。',
                'info',
                10000
            );
        }

        // Could also trigger haptic feedback
        this.triggerBreakHaptic();
    }

    /**
     * Trigger haptic feedback for break reminder
     */
    triggerBreakHaptic() {
        const gamepads = navigator.getGamepads();
        for (const gamepad of gamepads) {
            if (gamepad && gamepad.hapticActuators) {
                gamepad.hapticActuators[0].pulse(0.3, 500);
            }
        }
    }

    /**
     * Reduce rendering quality for performance
     */
    reduceQuality() {
        console.warn('[VR Comfort] Reducing quality due to performance issues');

        // Could reduce texture quality, polygon count, etc.
        if (this.scene) {
            this.scene.traverse(obj => {
                if (obj.material) {
                    obj.material.needsUpdate = true;
                }
            });
        }
    }

    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        if (!this.settings.frameRate.monitoring) return;

        setInterval(() => {
            console.log(`[VR Comfort] FPS: ${this.performance.fps.toFixed(1)}, Frame Time: ${this.performance.frameTime.toFixed(2)}ms`);

            // Emit event for monitoring
            window.dispatchEvent(new CustomEvent('vr-performance', {
                detail: {
                    fps: this.performance.fps,
                    frameTime: this.performance.frameTime,
                    droppedFrames: this.performance.droppedFrames
                }
            }));
        }, 5000); // Every 5 seconds
    }

    /**
     * Get comfort settings
     * @returns {Object} Current comfort settings
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Update comfort settings
     * @param {Object} newSettings - New settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };

        // Re-apply settings
        if (newSettings.vignette) {
            this.setupVignette();
        }
        if (newSettings.staticReference) {
            this.setupStaticReference();
        }

        console.log('[VR Comfort] Settings updated');
    }

    /**
     * Get comfort recommendations based on session
     * @returns {Array} Recommendations
     */
    getComfortRecommendations() {
        const recommendations = [];

        // Check session duration
        const sessionMinutes = (Date.now() - this.sessionStartTime) / 60000;
        if (sessionMinutes > 30) {
            recommendations.push({
                type: 'break',
                priority: 'high',
                message: '長時間の使用です。休憩を取ることをお勧めします。'
            });
        }

        // Check performance
        if (this.performance.fps < this.settings.frameRate.min) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                message: 'フレームレートが低下しています。設定を調整してください。'
            });
        }

        return recommendations;
    }

    /**
     * Dispose and cleanup
     */
    dispose() {
        if (this.vignetteElement) {
            this.vignetteElement.remove();
        }

        if (this.staticReferenceElement) {
            if (this.staticReferenceElement.parent) {
                this.staticReferenceElement.parent.remove(this.staticReferenceElement);
            }
        }

        if (this.teleportMarker) {
            this.scene.remove(this.teleportMarker);
        }

        this.scene = null;
        this.camera = null;
    }
}

// Export for global access
if (typeof window !== 'undefined') {
    window.VRComfortSystem = VRComfortSystem;
}
