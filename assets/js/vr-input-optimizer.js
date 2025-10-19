/**
 * VR Input Optimizer
 * Optimized input handling for gaze, hand tracking, and controllers
 * @version 2.0.0
 */

class VRInputOptimizer {
    constructor() {
        // Input modes
        this.modes = {
            GAZE: 'gaze',
            HAND: 'hand',
            CONTROLLER: 'controller',
            HYBRID: 'hybrid'
        };

        this.currentMode = this.modes.HYBRID;

        // Gaze settings
        this.gaze = {
            enabled: true,
            dwellTime: 1000, // ms to activate
            cursorSize: 0.02, // meters
            rayLength: 10, // meters
            smoothing: 0.2,
            currentTarget: null,
            dwellStartTime: 0
        };

        // Hand tracking settings
        this.hand = {
            enabled: true,
            pinchThreshold: 0.8, // 0-1
            pointingThreshold: 0.9,
            grabThreshold: 0.7,
            hoverDistance: 0.05, // meters
            hapticFeedback: true
        };

        // Controller settings
        this.controller = {
            enabled: true,
            rayLength: 10,
            triggerThreshold: 0.1,
            gripThreshold: 0.1,
            vibrationIntensity: 0.5,
            vibrationDuration: 50 // ms
        };

        // Interaction settings
        this.interaction = {
            multiSelect: false,
            holdDuration: 500, // ms for long press
            doubleTapInterval: 300, // ms
            lastTapTime: 0,
            tapCount: 0
        };

        // Raycaster for selection
        this.raycaster = new THREE.Raycaster();
        this.gazeCursor = null;
        this.controllerRays = [];

        // Interactive objects
        this.interactiveObjects = new Set();
        this.hoveredObject = null;
        this.selectedObject = null;

        // Performance optimization
        this.updateInterval = 16; // ~60 FPS
        this.lastUpdate = 0;

        // Event callbacks
        this.callbacks = {
            onHover: [],
            onSelect: [],
            onDeselect: [],
            onLongPress: []
        };
    }

    /**
     * Initialize input optimizer
     * @param {THREE.Scene} scene - Three.js scene
     * @param {THREE.Camera} camera - VR camera
     */
    init(scene, camera) {
        this.scene = scene;
        this.camera = camera;

        this.setupGazeCursor();
        this.setupControllerRays();
        this.detectAvailableInputs();

        console.log('[VR Input] Initialized with mode:', this.currentMode);
        return this;
    }

    /**
     * Setup gaze cursor visual
     */
    setupGazeCursor() {
        if (!this.gaze.enabled) return;

        // Create reticle/cursor
        const geometry = new THREE.RingGeometry(
            this.gaze.cursorSize * 0.8,
            this.gaze.cursorSize,
            32
        );

        const material = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });

        this.gazeCursor = new THREE.Mesh(geometry, material);
        this.gazeCursor.name = 'gazeCursor';

        // Add progress ring for dwell
        const progressGeometry = new THREE.RingGeometry(
            this.gaze.cursorSize * 0.6,
            this.gaze.cursorSize * 0.8,
            32,
            1,
            0,
            0
        );

        const progressMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide
        });

        const progressRing = new THREE.Mesh(progressGeometry, progressMaterial);
        progressRing.name = 'progressRing';
        this.gazeCursor.add(progressRing);

        this.scene.add(this.gazeCursor);
        this.gazeCursor.visible = false;
    }

    /**
     * Setup controller ray visuals
     */
    setupControllerRays() {
        if (!this.controller.enabled) return;

        for (let i = 0; i < 2; i++) { // Left and right
            const geometry = new THREE.BufferGeometry();
            const positions = [0, 0, 0, 0, 0, -this.controller.rayLength];
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

            const material = new THREE.LineBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.6,
                linewidth: 2
            });

            const ray = new THREE.Line(geometry, material);
            ray.visible = false;
            ray.name = `controllerRay${i}`;

            this.scene.add(ray);
            this.controllerRays.push(ray);
        }
    }

    /**
     * Detect available input methods
     */
    detectAvailableInputs() {
        // Check for WebXR support
        if (!navigator.xr) {
            this.currentMode = this.modes.GAZE;
            return;
        }

        // Check for hand tracking
        navigator.xr.isSessionSupported('immersive-vr').then(supported => {
            if (supported) {
                this.hand.enabled = true;
            }
        });

        // Check for controllers
        window.addEventListener('gamepadconnected', () => {
            this.controller.enabled = true;
            console.log('[VR Input] Controller detected');
        });
    }

    /**
     * Register interactive object
     * @param {THREE.Object3D} object - Object to make interactive
     * @param {Object} callbacks - Interaction callbacks
     */
    registerInteractive(object, callbacks = {}) {
        object.userData.isInteractive = true;
        object.userData.callbacks = callbacks;
        this.interactiveObjects.add(object);
    }

    /**
     * Unregister interactive object
     * @param {THREE.Object3D} object - Object to remove
     */
    unregisterInteractive(object) {
        object.userData.isInteractive = false;
        this.interactiveObjects.delete(object);
    }

    /**
     * Update input system (call in render loop)
     * @param {number} deltaTime - Delta time
     */
    update(deltaTime) {
        const now = Date.now();
        if (now - this.lastUpdate < this.updateInterval) return;
        this.lastUpdate = now;

        if (this.currentMode === this.modes.GAZE || this.currentMode === this.modes.HYBRID) {
            this.updateGazeInput(deltaTime);
        }

        if (this.currentMode === this.modes.HAND || this.currentMode === this.modes.HYBRID) {
            this.updateHandInput(deltaTime);
        }

        if (this.currentMode === this.modes.CONTROLLER || this.currentMode === this.modes.HYBRID) {
            this.updateControllerInput(deltaTime);
        }
    }

    /**
     * Update gaze-based input
     * @param {number} deltaTime - Delta time
     */
    updateGazeInput(deltaTime) {
        if (!this.camera || !this.gaze.enabled) return;

        // Cast ray from camera center
        const cameraDirection = new THREE.Vector3(0, 0, -1);
        cameraDirection.applyQuaternion(this.camera.quaternion);

        this.raycaster.set(this.camera.position, cameraDirection);
        this.raycaster.far = this.gaze.rayLength;

        // Check intersections with interactive objects
        const intersects = this.raycaster.intersectObjects(
            Array.from(this.interactiveObjects),
            true
        );

        if (intersects.length > 0) {
            const intersection = intersects[0];
            const object = this.findInteractiveParent(intersection.object);

            if (object) {
                this.handleGazeHover(object, intersection);
            }

            // Position cursor at intersection
            this.gazeCursor.position.copy(intersection.point);
            this.gazeCursor.lookAt(this.camera.position);
            this.gazeCursor.visible = true;
        } else {
            this.gazeCursor.visible = false;
            this.handleGazeExit();
        }
    }

    /**
     * Handle gaze hover on object
     * @param {THREE.Object3D} object - Hovered object
     * @param {Object} intersection - Intersection data
     */
    handleGazeHover(object, intersection) {
        if (this.gaze.currentTarget !== object) {
            // New target
            if (this.gaze.currentTarget) {
                this.handleGazeExit();
            }

            this.gaze.currentTarget = object;
            this.gaze.dwellStartTime = Date.now();

            // Trigger hover callback
            this.triggerCallback('onHover', { object, intersection });

            // Visual feedback
            this.highlightObject(object, true);
        } else {
            // Continue hovering - check dwell time
            const dwellTime = Date.now() - this.gaze.dwellStartTime;
            const progress = Math.min(dwellTime / this.gaze.dwellTime, 1);

            // Update progress ring
            const progressRing = this.gazeCursor.getObjectByName('progressRing');
            if (progressRing) {
                progressRing.material.opacity = progress * 0.8;
                progressRing.geometry.dispose();

                const angle = progress * Math.PI * 2;
                progressRing.geometry = new THREE.RingGeometry(
                    this.gaze.cursorSize * 0.6,
                    this.gaze.cursorSize * 0.8,
                    32,
                    1,
                    0,
                    angle
                );
            }

            // Trigger selection on dwell completion
            if (progress >= 1) {
                this.handleGazeSelect(object, intersection);
            }
        }
    }

    /**
     * Handle gaze exit from object
     */
    handleGazeExit() {
        if (this.gaze.currentTarget) {
            this.highlightObject(this.gaze.currentTarget, false);
            this.gaze.currentTarget = null;
            this.gaze.dwellStartTime = 0;

            // Reset progress ring
            const progressRing = this.gazeCursor?.getObjectByName('progressRing');
            if (progressRing) {
                progressRing.material.opacity = 0;
            }
        }
    }

    /**
     * Handle gaze selection
     * @param {THREE.Object3D} object - Selected object
     * @param {Object} intersection - Intersection data
     */
    handleGazeSelect(object, intersection) {
        this.selectedObject = object;

        // Trigger select callback
        this.triggerCallback('onSelect', { object, intersection, method: 'gaze' });

        // Execute object callback
        if (object.userData.callbacks?.onClick) {
            object.userData.callbacks.onClick(object);
        }

        // Visual/audio feedback
        this.provideFeedback('select');

        // Reset dwell
        this.gaze.dwellStartTime = Date.now();
    }

    /**
     * Update hand tracking input
     * @param {number} deltaTime - Delta time
     */
    updateHandInput(deltaTime) {
        // Implementation would use WebXR hand tracking API
        // Detect pinch, point, grab gestures
        // This is a simplified version

        if (window.vrHandTracking?.hands) {
            const hands = window.vrHandTracking.hands;

            ['left', 'right'].forEach(handedness => {
                const hand = hands[handedness];
                if (!hand) return;

                // Check for pinch gesture (index finger + thumb)
                if (this.detectPinch(hand)) {
                    this.handleHandPinch(hand, handedness);
                }

                // Check for point gesture
                if (this.detectPoint(hand)) {
                    this.handleHandPoint(hand, handedness);
                }
            });
        }
    }

    /**
     * Detect pinch gesture
     * @param {Object} hand - Hand tracking data
     * @returns {boolean} Is pinching
     */
    detectPinch(hand) {
        // Simplified - actual implementation would use joint positions
        return hand.pinchStrength > this.hand.pinchThreshold;
    }

    /**
     * Detect pointing gesture
     * @param {Object} hand - Hand tracking data
     * @returns {boolean} Is pointing
     */
    detectPoint(hand) {
        return hand.pointStrength > this.hand.pointingThreshold;
    }

    /**
     * Handle hand pinch interaction
     * @param {Object} hand - Hand data
     * @param {string} handedness - Left or right
     */
    handleHandPinch(hand, handedness) {
        const position = hand.indexTip.position;

        // Check for nearby interactive objects
        this.interactiveObjects.forEach(obj => {
            const distance = position.distanceTo(obj.position);
            if (distance < this.hand.hoverDistance) {
                this.triggerCallback('onSelect', {
                    object: obj,
                    method: 'pinch',
                    handedness
                });

                if (this.hand.hapticFeedback) {
                    this.triggerHaptic(handedness, 0.5, 50);
                }
            }
        });
    }

    /**
     * Handle hand pointing interaction
     * @param {Object} hand - Hand data
     * @param {string} handedness - Left or right
     */
    handleHandPoint(hand, handedness) {
        // Cast ray from finger tip
        const origin = hand.indexTip.position;
        const direction = hand.indexTip.direction;

        this.raycaster.set(origin, direction);
        const intersects = this.raycaster.intersectObjects(
            Array.from(this.interactiveObjects),
            true
        );

        if (intersects.length > 0) {
            const object = this.findInteractiveParent(intersects[0].object);
            if (object) {
                this.handleGazeHover(object, intersects[0]);
            }
        }
    }

    /**
     * Update controller input
     * @param {number} deltaTime - Delta time
     */
    updateControllerInput(deltaTime) {
        const gamepads = navigator.getGamepads();

        gamepads.forEach((gamepad, index) => {
            if (!gamepad || index >= this.controllerRays.length) return;

            const ray = this.controllerRays[index];
            ray.visible = true;

            // Check trigger button
            const trigger = gamepad.buttons[0]; // Standard trigger
            if (trigger && trigger.pressed && trigger.value > this.controller.triggerThreshold) {
                this.handleControllerTrigger(gamepad, index);
            }
        });
    }

    /**
     * Handle controller trigger press
     * @param {Gamepad} gamepad - Gamepad object
     * @param {number} index - Controller index
     */
    handleControllerTrigger(gamepad, index) {
        // Ray cast from controller
        const ray = this.controllerRays[index];
        if (!ray) return;

        const origin = new THREE.Vector3();
        const direction = new THREE.Vector3(0, 0, -1);

        ray.getWorldPosition(origin);
        direction.applyQuaternion(ray.quaternion);

        this.raycaster.set(origin, direction);
        const intersects = this.raycaster.intersectObjects(
            Array.from(this.interactiveObjects),
            true
        );

        if (intersects.length > 0) {
            const object = this.findInteractiveParent(intersects[0].object);
            if (object) {
                this.triggerCallback('onSelect', {
                    object,
                    intersection: intersects[0],
                    method: 'controller',
                    controller: index
                });

                // Vibration feedback
                if (gamepad.hapticActuators && gamepad.hapticActuators[0]) {
                    gamepad.hapticActuators[0].pulse(
                        this.controller.vibrationIntensity,
                        this.controller.vibrationDuration
                    );
                }
            }
        }
    }

    /**
     * Find interactive parent object
     * @param {THREE.Object3D} object - Object to check
     * @returns {THREE.Object3D|null} Interactive parent
     */
    findInteractiveParent(object) {
        let current = object;
        while (current) {
            if (current.userData.isInteractive) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }

    /**
     * Highlight object
     * @param {THREE.Object3D} object - Object to highlight
     * @param {boolean} enabled - Highlight on/off
     */
    highlightObject(object, enabled) {
        if (!object) return;

        object.traverse(child => {
            if (child.material) {
                if (enabled) {
                    child.material.emissive = new THREE.Color(0x00ffff);
                    child.material.emissiveIntensity = 0.3;
                } else {
                    child.material.emissive = new THREE.Color(0x000000);
                    child.material.emissiveIntensity = 0;
                }
            }
        });
    }

    /**
     * Provide feedback for interaction
     * @param {string} type - Feedback type
     */
    provideFeedback(type) {
        // Visual feedback
        if (type === 'select' && this.gazeCursor) {
            const cursor = this.gazeCursor;
            const originalScale = cursor.scale.clone();

            cursor.scale.multiplyScalar(1.5);
            setTimeout(() => {
                cursor.scale.copy(originalScale);
            }, 100);
        }

        // Audio feedback
        if (window.vrSpatialAudio) {
            window.vrSpatialAudio.playClick();
        }
    }

    /**
     * Trigger haptic feedback
     * @param {string} handedness - Left or right
     * @param {number} intensity - 0-1
     * @param {number} duration - Duration in ms
     */
    triggerHaptic(handedness, intensity, duration) {
        const gamepads = navigator.getGamepads();
        for (const gamepad of gamepads) {
            if (gamepad && gamepad.hand === handedness && gamepad.hapticActuators) {
                gamepad.hapticActuators[0].pulse(intensity, duration);
                break;
            }
        }
    }

    /**
     * Add event callback
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
    }

    /**
     * Trigger callback
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    triggerCallback(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => callback(data));
        }
    }

    /**
     * Set input mode
     * @param {string} mode - Input mode
     */
    setMode(mode) {
        if (Object.values(this.modes).includes(mode)) {
            this.currentMode = mode;
            console.log('[VR Input] Mode changed to:', mode);
        }
    }

    /**
     * Dispose and cleanup
     */
    dispose() {
        this.interactiveObjects.clear();

        if (this.gazeCursor) {
            this.scene.remove(this.gazeCursor);
        }

        this.controllerRays.forEach(ray => {
            this.scene.remove(ray);
        });

        this.scene = null;
        this.camera = null;
    }
}

// Export for global access
if (typeof window !== 'undefined') {
    window.VRInputOptimizer = VRInputOptimizer;
}
