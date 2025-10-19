/**
 * VR Hand Tracking and Gesture Controls
 * Supports hand tracking and gesture recognition for VR interactions
 * @version 2.0.0
 */

class VRHandTracking {
    constructor() {
        this.session = null;
        this.handTracking = {
            left: null,
            right: null
        };
        this.gestures = {
            pinch: { left: false, right: false },
            grab: { left: false, right: false },
            point: { left: false, right: false },
            thumbsUp: { left: false, right: false }
        };
        this.gestureCallbacks = new Map();
        this.handModels = {
            left: null,
            right: null
        };
        this.raycastEnabled = true;
        this.raycastDistance = 10;
        this.isTracking = false;
    }

    /**
     * Initialize hand tracking
     */
    async init(xrSession) {
        if (!xrSession) {
            throw new Error('XR session is required');
        }

        this.session = xrSession;

        // Check if hand tracking is supported
        const supported = await this.isHandTrackingSupported();
        if (!supported) {
            console.warn('Hand tracking not supported on this device');
            return false;
        }

        await this.setupHandTracking();
        this.startTracking();

        VRUtils.showNotification('Hand tracking enabled', 'success');
        return true;
    }

    /**
     * Check if hand tracking is supported
     */
    async isHandTrackingSupported() {
        if (!navigator.xr) return false;

        try {
            const supported = await navigator.xr.isSessionSupported('immersive-vr');
            if (!supported) return false;

            // Check for hand tracking feature
            return true; // Simplified check - actual implementation would check XR features
        } catch (error) {
            console.error('Hand tracking support check failed:', error);
            return false;
        }
    }

    /**
     * Setup hand tracking
     */
    async setupHandTracking() {
        // Request hand tracking input sources
        this.session.addEventListener('inputsourceschange', (event) => {
            this.handleInputSourcesChange(event);
        });

        // Initialize hand models
        this.createHandModels();
    }

    /**
     * Create visual hand models
     */
    createHandModels() {
        // Simple sphere models for hand joints
        const jointGeometry = new THREE.SphereGeometry(0.01, 8, 8);
        const leftMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const rightMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });

        this.handModels.left = {
            joints: [],
            material: leftMaterial
        };

        this.handModels.right = {
            joints: [],
            material: rightMaterial
        };

        // Create joint meshes (25 joints per hand)
        for (let i = 0; i < 25; i++) {
            const leftJoint = new THREE.Mesh(jointGeometry, leftMaterial);
            const rightJoint = new THREE.Mesh(jointGeometry, rightMaterial);

            leftJoint.visible = false;
            rightJoint.visible = false;

            this.handModels.left.joints.push(leftJoint);
            this.handModels.right.joints.push(rightJoint);
        }
    }

    /**
     * Handle input sources change
     */
    handleInputSourcesChange(event) {
        event.added.forEach(source => {
            if (source.hand) {
                const handedness = source.handedness; // 'left' or 'right'
                this.handTracking[handedness] = source.hand;
                console.log(`${handedness} hand tracking enabled`);
            }
        });

        event.removed.forEach(source => {
            if (source.hand) {
                const handedness = source.handedness;
                this.handTracking[handedness] = null;
                console.log(`${handedness} hand tracking disabled`);
            }
        });
    }

    /**
     * Start tracking loop
     */
    startTracking() {
        this.isTracking = true;
        this.trackingLoop();
    }

    /**
     * Stop tracking
     */
    stopTracking() {
        this.isTracking = false;
    }

    /**
     * Main tracking loop
     */
    trackingLoop() {
        if (!this.isTracking) return;

        // Update hand positions and detect gestures
        this.updateHandPositions();
        this.detectGestures();

        // Continue loop
        requestAnimationFrame(() => this.trackingLoop());
    }

    /**
     * Update hand positions
     */
    updateHandPositions() {
        ['left', 'right'].forEach(handedness => {
            const hand = this.handTracking[handedness];
            if (!hand) return;

            // Update joint positions (simplified)
            // In real implementation, would use XRFrame.getJointPose()
            this.updateHandModel(handedness);
        });
    }

    /**
     * Update hand model visualization
     */
    updateHandModel(handedness) {
        const model = this.handModels[handedness];
        if (!model) return;

        // Show/hide joints based on tracking state
        const isTracked = this.handTracking[handedness] !== null;
        model.joints.forEach(joint => {
            joint.visible = isTracked;
        });
    }

    /**
     * Detect gestures
     */
    detectGestures() {
        ['left', 'right'].forEach(handedness => {
            const hand = this.handTracking[handedness];
            if (!hand) return;

            // Detect pinch gesture
            const pinch = this.detectPinch(handedness);
            this.updateGesture('pinch', handedness, pinch);

            // Detect grab gesture
            const grab = this.detectGrab(handedness);
            this.updateGesture('grab', handedness, grab);

            // Detect point gesture
            const point = this.detectPoint(handedness);
            this.updateGesture('point', handedness, point);

            // Detect thumbs up
            const thumbsUp = this.detectThumbsUp(handedness);
            this.updateGesture('thumbsUp', handedness, thumbsUp);
        });
    }

    /**
     * Detect pinch gesture (thumb + index finger)
     */
    detectPinch(handedness) {
        // Simplified detection - real implementation would calculate
        // distance between thumb tip and index finger tip
        // Return true if distance < threshold
        return Math.random() > 0.95; // Placeholder
    }

    /**
     * Detect grab gesture (all fingers closed)
     */
    detectGrab(handedness) {
        // Simplified detection - real implementation would check
        // if all finger joints are curled
        return Math.random() > 0.95; // Placeholder
    }

    /**
     * Detect point gesture (index finger extended)
     */
    detectPoint(handedness) {
        // Simplified detection - real implementation would check
        // if index finger is extended and others are curled
        return Math.random() > 0.95; // Placeholder
    }

    /**
     * Detect thumbs up gesture
     */
    detectThumbsUp(handedness) {
        // Simplified detection - real implementation would check
        // if thumb is extended upward and other fingers are curled
        return Math.random() > 0.98; // Placeholder
    }

    /**
     * Update gesture state and trigger callbacks
     */
    updateGesture(gestureName, handedness, isActive) {
        const wasActive = this.gestures[gestureName][handedness];

        if (isActive && !wasActive) {
            // Gesture started
            this.gestures[gestureName][handedness] = true;
            this.triggerGestureCallback(`${gestureName}Start`, handedness);
        } else if (!isActive && wasActive) {
            // Gesture ended
            this.gestures[gestureName][handedness] = false;
            this.triggerGestureCallback(`${gestureName}End`, handedness);
        } else if (isActive && wasActive) {
            // Gesture continuing
            this.triggerGestureCallback(`${gestureName}Hold`, handedness);
        }
    }

    /**
     * Trigger gesture callback
     */
    triggerGestureCallback(eventName, handedness) {
        const callbacks = this.gestureCallbacks.get(eventName);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback({ handedness, gesture: eventName });
                } catch (error) {
                    console.error(`Gesture callback error (${eventName}):`, error);
                }
            });
        }
    }

    /**
     * Register gesture callback
     */
    on(eventName, callback) {
        if (!this.gestureCallbacks.has(eventName)) {
            this.gestureCallbacks.set(eventName, []);
        }
        this.gestureCallbacks.get(eventName).push(callback);
    }

    /**
     * Unregister gesture callback
     */
    off(eventName, callback) {
        const callbacks = this.gestureCallbacks.get(eventName);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Get hand position
     */
    getHandPosition(handedness) {
        const hand = this.handTracking[handedness];
        if (!hand) return null;

        // Return wrist position (simplified)
        return { x: 0, y: 0, z: 0 }; // Placeholder
    }

    /**
     * Get pointer ray from hand
     */
    getPointerRay(handedness) {
        const position = this.getHandPosition(handedness);
        if (!position) return null;

        // Calculate ray direction from index finger (simplified)
        return {
            origin: position,
            direction: { x: 0, y: 0, z: -1 } // Placeholder
        };
    }

    /**
     * Perform raycast from hand
     */
    raycast(handedness, objects) {
        if (!this.raycastEnabled) return null;

        const ray = this.getPointerRay(handedness);
        if (!ray) return null;

        // Perform raycast against objects (simplified)
        // Real implementation would use Three.js Raycaster
        return null;
    }

    /**
     * Enable/disable raycast
     */
    setRaycastEnabled(enabled) {
        this.raycastEnabled = enabled;
    }

    /**
     * Set raycast distance
     */
    setRaycastDistance(distance) {
        this.raycastDistance = distance;
    }

    /**
     * Get gesture state
     */
    isGestureActive(gestureName, handedness) {
        if (!this.gestures[gestureName]) return false;
        return this.gestures[gestureName][handedness] || false;
    }

    /**
     * Destroy hand tracking
     */
    destroy() {
        this.stopTracking();

        // Clean up hand models
        ['left', 'right'].forEach(handedness => {
            const model = this.handModels[handedness];
            if (model && model.joints) {
                model.joints.forEach(joint => {
                    if (joint.geometry) joint.geometry.dispose();
                    if (joint.material) joint.material.dispose();
                });
            }
        });

        this.handTracking = { left: null, right: null };
        this.gestureCallbacks.clear();
        this.session = null;
    }
}

/**
 * VR Gesture Controls
 * High-level gesture-based interactions
 */
class VRGestureControls {
    constructor(handTracking) {
        this.handTracking = handTracking;
        this.actions = new Map();
        this.cooldowns = new Map();
        this.setupDefaultActions();
    }

    /**
     * Setup default gesture actions
     */
    setupDefaultActions() {
        // Pinch to select
        this.registerAction('pinchStart', 'left', () => {
            this.handleSelect('left');
        });

        this.registerAction('pinchStart', 'right', () => {
            this.handleSelect('right');
        });

        // Grab to scroll
        this.registerAction('grabHold', 'left', () => {
            this.handleScroll('left');
        });

        this.registerAction('grabHold', 'right', () => {
            this.handleScroll('right');
        });

        // Point to navigate
        this.registerAction('pointStart', 'left', () => {
            this.handlePointerActivate('left');
        });

        this.registerAction('pointStart', 'right', () => {
            this.handlePointerActivate('right');
        });

        // Thumbs up for like/favorite
        this.registerAction('thumbsUpStart', 'left', () => {
            VRUtils.showNotification('Thumbs up!', 'success');
        });

        this.registerAction('thumbsUpStart', 'right', () => {
            VRUtils.showNotification('Thumbs up!', 'success');
        });
    }

    /**
     * Register gesture action
     */
    registerAction(gesture, handedness, callback) {
        const key = `${gesture}_${handedness}`;
        if (!this.actions.has(key)) {
            this.actions.set(key, []);
        }
        this.actions.get(key).push(callback);

        // Register with hand tracking
        this.handTracking.on(gesture, (event) => {
            if (event.handedness === handedness) {
                this.executeAction(gesture, handedness);
            }
        });
    }

    /**
     * Execute action with cooldown
     */
    executeAction(gesture, handedness) {
        const key = `${gesture}_${handedness}`;
        const now = Date.now();

        // Check cooldown
        const lastExecution = this.cooldowns.get(key) || 0;
        if (now - lastExecution < 300) { // 300ms cooldown
            return;
        }

        this.cooldowns.set(key, now);

        // Execute callbacks
        const callbacks = this.actions.get(key);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback({ gesture, handedness });
                } catch (error) {
                    console.error('Gesture action error:', error);
                }
            });
        }
    }

    /**
     * Handle select action
     */
    handleSelect(handedness) {
        // Raycast and click on element
        const ray = this.handTracking.getPointerRay(handedness);
        if (!ray) return;

        // Find element under pointer
        const element = document.elementFromPoint(
            window.innerWidth / 2,
            window.innerHeight / 2
        );

        if (element) {
            element.click();
            this.vibrate(handedness, 100);
        }
    }

    /**
     * Handle scroll action
     */
    handleScroll(handedness) {
        const position = this.handTracking.getHandPosition(handedness);
        if (!position) return;

        // Scroll based on hand position
        const scrollAmount = position.y * 10;
        window.scrollBy(0, scrollAmount);
    }

    /**
     * Handle pointer activate
     */
    handlePointerActivate(handedness) {
        VRUtils.showNotification(`${handedness} pointer activated`, 'info');
        this.vibrate(handedness, 50);
    }

    /**
     * Vibrate controller (if available)
     */
    vibrate(handedness, duration = 100) {
        if (!navigator.xr) return;

        // Get gamepad for haptic feedback
        const gamepads = navigator.getGamepads();
        for (const gamepad of gamepads) {
            if (gamepad && gamepad.hand === handedness && gamepad.hapticActuators) {
                gamepad.hapticActuators[0].pulse(0.5, duration);
                break;
            }
        }
    }

    /**
     * Clear all actions
     */
    clearActions() {
        this.actions.clear();
        this.cooldowns.clear();
    }
}

// Export for global access
if (typeof window !== 'undefined') {
    window.VRHandTracking = VRHandTracking;
    window.VRGestureControls = VRGestureControls;
}
