/**
 * VR Input System - Unified input management for VR experience
 * Consolidates: vr-gesture-controls.js, vr-gesture-macro.js, vr-gesture-scroll.js,
 *              vr-hand-tracking.js, vr-input-optimizer.js, vr-keyboard.js
 * @version 3.2.0
 */

class VRInputSystem {
    constructor() {
        this.initialized = false;

        // Input modes
        this.INPUT_MODES = {
            CONTROLLER: 'controller',
            HAND_TRACKING: 'hand-tracking',
            GAZE: 'gaze',
            VOICE: 'voice',
            KEYBOARD: 'keyboard'
        };

        this.currentMode = this.INPUT_MODES.CONTROLLER;
        this.availableModes = new Set([this.INPUT_MODES.CONTROLLER]);

        // Gesture recognition
        this.gestures = new Map();
        this.gestureHistory = [];
        this.maxGestureHistory = 50;

        // Gesture macros
        this.macros = new Map();
        this.recordingMacro = false;
        this.currentMacro = [];

        // Hand tracking
        this.hands = {
            left: null,
            right: null
        };
        this.handJoints = new Map();

        // Gaze input
        this.gazeTarget = null;
        this.gazeDwellTime = 800; // ms
        this.gazeStartTime = 0;

        // Virtual keyboard
        this.keyboard = null;
        this.keyboardVisible = false;

        // Input optimization
        this.inputQueue = [];
        this.processingInput = false;
        this.lastProcessedTime = 0;
        this.targetInputRate = 90; // Hz

        // Event handlers
        this.handlers = new Map();

        this.init();
    }

    init() {
        this.setupGestureRecognition();
        this.setupHandTracking();
        this.setupGazeInput();
        this.setupVirtualKeyboard();
        this.detectAvailableInputModes();

        this.initialized = true;
        console.info('✅ VR Input System initialized');

        window.dispatchEvent(new CustomEvent('vr-input-ready'));
    }

    // ========== Input Mode Management ==========

    async detectAvailableInputModes() {
        if (!('xr' in navigator)) return;

        try {
            // Check for hand tracking
            const handSupported = await navigator.xr.isSessionSupported('immersive-vr');
            if (handSupported) {
                this.availableModes.add(this.INPUT_MODES.HAND_TRACKING);
            }

            // Gaze is always available in VR
            this.availableModes.add(this.INPUT_MODES.GAZE);

            // Check for voice (Web Speech API)
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                this.availableModes.add(this.INPUT_MODES.VOICE);
            }

            console.info('Available input modes:', Array.from(this.availableModes));
        } catch (error) {
            console.warn('Error detecting input modes:', error);
        }
    }

    setInputMode(mode) {
        if (!this.availableModes.has(mode)) {
            console.warn(`Input mode ${mode} not available`);
            return false;
        }

        const oldMode = this.currentMode;
        this.currentMode = mode;

        this.emit('input-mode-changed', { oldMode, newMode: mode });

        console.info(`Input mode changed: ${oldMode} → ${mode}`);
        return true;
    }

    // ========== Gesture Recognition ==========

    setupGestureRecognition() {
        // Predefined gestures
        this.registerGesture('swipe-right', {
            pattern: (history) => this.detectSwipe(history, 'right'),
            action: () => this.emit('gesture-swipe-right')
        });

        this.registerGesture('swipe-left', {
            pattern: (history) => this.detectSwipe(history, 'left'),
            action: () => this.emit('gesture-swipe-left')
        });

        this.registerGesture('swipe-up', {
            pattern: (history) => this.detectSwipe(history, 'up'),
            action: () => this.emit('gesture-swipe-up')
        });

        this.registerGesture('swipe-down', {
            pattern: (history) => this.detectSwipe(history, 'down'),
            action: () => this.emit('gesture-swipe-down')
        });

        this.registerGesture('pinch', {
            pattern: (history) => this.detectPinch(history),
            action: (data) => this.emit('gesture-pinch', data)
        });

        this.registerGesture('grab', {
            pattern: (history) => this.detectGrab(history),
            action: () => this.emit('gesture-grab')
        });

        this.registerGesture('point', {
            pattern: (history) => this.detectPoint(history),
            action: (data) => this.emit('gesture-point', data)
        });

        this.registerGesture('thumbs-up', {
            pattern: (history) => this.detectThumbsUp(history),
            action: () => this.emit('gesture-thumbs-up')
        });
    }

    registerGesture(name, config) {
        this.gestures.set(name, config);
    }

    recordGestureData(hand, joints) {
        const data = {
            hand: hand,
            joints: joints,
            timestamp: performance.now()
        };

        this.gestureHistory.push(data);

        // Keep history limited
        if (this.gestureHistory.length > this.maxGestureHistory) {
            this.gestureHistory.shift();
        }

        // Check for gesture matches
        this.recognizeGestures();
    }

    recognizeGestures() {
        for (const [name, gesture] of this.gestures) {
            const result = gesture.pattern(this.gestureHistory);
            if (result) {
                gesture.action(result);
            }
        }
    }

    detectSwipe(history, direction) {
        if (history.length < 5) return false;

        const recent = history.slice(-10);
        const first = recent[0].joints?.['index-finger-tip'];
        const last = recent[recent.length - 1].joints?.['index-finger-tip'];

        if (!first || !last) return false;

        const dx = last.position.x - first.position.x;
        const dy = last.position.y - first.position.y;
        const threshold = 0.2; // meters

        switch (direction) {
            case 'right': return dx > threshold && Math.abs(dy) < threshold / 2;
            case 'left': return dx < -threshold && Math.abs(dy) < threshold / 2;
            case 'up': return dy > threshold && Math.abs(dx) < threshold / 2;
            case 'down': return dy < -threshold && Math.abs(dx) < threshold / 2;
            default: return false;
        }
    }

    detectPinch(history) {
        if (history.length < 2) return false;

        const latest = history[history.length - 1];
        const thumb = latest.joints?.['thumb-tip'];
        const index = latest.joints?.['index-finger-tip'];

        if (!thumb || !index) return false;

        const distance = Math.sqrt(
            Math.pow(thumb.position.x - index.position.x, 2) +
            Math.pow(thumb.position.y - index.position.y, 2) +
            Math.pow(thumb.position.z - index.position.z, 2)
        );

        // Pinch threshold: < 2cm
        if (distance < 0.02) {
            return { distance, strength: 1 - (distance / 0.02) };
        }

        return false;
    }

    detectGrab(history) {
        if (history.length < 2) return false;

        const latest = history[history.length - 1];
        const fingers = ['index', 'middle', 'ring', 'pinky'];

        let closedCount = 0;
        for (const finger of fingers) {
            const tip = latest.joints?.[`${finger}-finger-tip`];
            const base = latest.joints?.[`${finger}-finger-base`];

            if (!tip || !base) continue;

            // Check if finger is curled
            const distance = Math.sqrt(
                Math.pow(tip.position.x - base.position.x, 2) +
                Math.pow(tip.position.y - base.position.y, 2) +
                Math.pow(tip.position.z - base.position.z, 2)
            );

            if (distance < 0.05) closedCount++;
        }

        return closedCount >= 3; // At least 3 fingers closed
    }

    detectPoint(history) {
        if (history.length < 2) return false;

        const latest = history[history.length - 1];
        const indexTip = latest.joints?.['index-finger-tip'];
        const wrist = latest.joints?.['wrist'];

        if (!indexTip || !wrist) return false;

        // Calculate pointing direction
        const direction = {
            x: indexTip.position.x - wrist.position.x,
            y: indexTip.position.y - wrist.position.y,
            z: indexTip.position.z - wrist.position.z
        };

        // Normalize
        const length = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2);
        direction.x /= length;
        direction.y /= length;
        direction.z /= length;

        return { direction, origin: wrist.position };
    }

    detectThumbsUp(history) {
        if (history.length < 2) return false;

        const latest = history[history.length - 1];
        const thumbTip = latest.joints?.['thumb-tip'];
        const thumbBase = latest.joints?.['thumb-base'];

        if (!thumbTip || !thumbBase) return false;

        // Thumb should be extended upward
        const dy = thumbTip.position.y - thumbBase.position.y;
        return dy > 0.05; // 5cm upward
    }

    // ========== Gesture Macros ==========

    startRecordingMacro(name) {
        this.recordingMacro = true;
        this.currentMacro = [];
        this.currentMacroName = name;
        console.info(`Recording macro: ${name}`);
    }

    stopRecordingMacro() {
        if (this.currentMacro.length > 0) {
            this.macros.set(this.currentMacroName, [...this.currentMacro]);
            console.info(`Macro saved: ${this.currentMacroName} (${this.currentMacro.length} actions)`);
        }

        this.recordingMacro = false;
        this.currentMacro = [];
        this.currentMacroName = null;
    }

    recordMacroAction(action) {
        if (this.recordingMacro) {
            this.currentMacro.push({
                action: action,
                timestamp: performance.now()
            });
        }
    }

    async playMacro(name) {
        const macro = this.macros.get(name);
        if (!macro) {
            console.warn(`Macro not found: ${name}`);
            return;
        }

        console.info(`Playing macro: ${name}`);

        for (let i = 0; i < macro.length; i++) {
            const action = macro[i];

            // Execute action
            this.emit('macro-action', action.action);

            // Wait for next action
            if (i < macro.length - 1) {
                const delay = macro[i + 1].timestamp - action.timestamp;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        console.info(`Macro completed: ${name}`);
    }

    // ========== Hand Tracking ==========

    setupHandTracking() {
        if (this.availableModes.has(this.INPUT_MODES.HAND_TRACKING)) {
            console.info('Hand tracking available');
        }
    }

    updateHandTracking(frame, referenceSpace) {
        if (!frame || !referenceSpace) return;

        // XR Hand tracking API
        for (const inputSource of frame.session.inputSources) {
            if (inputSource.hand) {
                const hand = inputSource.hand;
                const handedness = inputSource.handedness; // 'left' or 'right'

                const joints = {};

                // Iterate through hand joints
                for (const joint of hand.values()) {
                    const jointPose = frame.getJointPose(joint, referenceSpace);

                    if (jointPose) {
                        joints[joint.jointName] = {
                            position: jointPose.transform.position,
                            orientation: jointPose.transform.orientation,
                            radius: jointPose.radius
                        };
                    }
                }

                this.hands[handedness] = joints;
                this.recordGestureData(handedness, joints);
            }
        }
    }

    // ========== Gaze Input ==========

    setupGazeInput() {
        this.gazeRaycaster = new THREE.Raycaster();
    }

    updateGazeInput(camera, interactiveObjects) {
        if (!camera || !interactiveObjects) return;

        // Cast ray from camera forward
        this.gazeRaycaster.setFromCamera({ x: 0, y: 0 }, camera);

        const intersects = this.gazeRaycaster.intersectObjects(interactiveObjects, true);

        if (intersects.length > 0) {
            const target = intersects[0].object;

            if (this.gazeTarget === target) {
                // Continue gazing at same object
                const elapsed = performance.now() - this.gazeStartTime;

                if (elapsed >= this.gazeDwellTime) {
                    // Trigger gaze selection
                    this.emit('gaze-select', { object: target, point: intersects[0].point });
                    this.gazeTarget = null;
                }
            } else {
                // New gaze target
                this.gazeTarget = target;
                this.gazeStartTime = performance.now();
                this.emit('gaze-enter', { object: target });
            }
        } else {
            if (this.gazeTarget) {
                this.emit('gaze-exit', { object: this.gazeTarget });
            }
            this.gazeTarget = null;
        }
    }

    // ========== Virtual Keyboard ==========

    setupVirtualKeyboard() {
        this.keyboardLayout = {
            rows: [
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
                ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
                ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
                ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
                ['Space', 'Backspace', 'Enter']
            ]
        };

        this.keyboardGroup = new THREE.Group();
        this.keyboardVisible = false;
    }

    createVirtualKeyboard() {
        if (!window.VRUISystem) {
            console.warn('VR UI System not available');
            return;
        }

        const keyWidth = 0.08;
        const keyHeight = 0.08;
        const keySpacing = 0.01;

        let yOffset = 0;

        this.keyboardLayout.rows.forEach((row, rowIndex) => {
            let xOffset = -(row.length * (keyWidth + keySpacing)) / 2;

            row.forEach(key => {
                const width = key === 'Space' ? keyWidth * 3 : keyWidth;

                const button = window.VRUISystem.createButton({
                    width: width,
                    height: keyHeight,
                    text: key,
                    position: { x: xOffset + width / 2, y: yOffset, z: 0 },
                    onClick: () => this.handleKeyPress(key)
                });

                this.keyboardGroup.add(button);
                xOffset += width + keySpacing;
            });

            yOffset -= keyHeight + keySpacing;
        });

        this.keyboard = this.keyboardGroup;
    }

    showKeyboard(position) {
        if (!this.keyboard) {
            this.createVirtualKeyboard();
        }

        this.keyboard.position.set(
            position.x || 0,
            position.y || 1.2,
            position.z || -1.5
        );

        this.keyboard.visible = true;
        this.keyboardVisible = true;

        this.emit('keyboard-shown');
    }

    hideKeyboard() {
        if (this.keyboard) {
            this.keyboard.visible = false;
        }
        this.keyboardVisible = false;

        this.emit('keyboard-hidden');
    }

    handleKeyPress(key) {
        this.emit('key-press', { key });
    }

    // ========== Input Optimization ==========

    queueInput(input) {
        this.inputQueue.push({
            ...input,
            timestamp: performance.now()
        });

        if (!this.processingInput) {
            this.processInputQueue();
        }
    }

    processInputQueue() {
        this.processingInput = true;

        const now = performance.now();
        const targetInterval = 1000 / this.targetInputRate;

        if (now - this.lastProcessedTime >= targetInterval) {
            // Process inputs
            while (this.inputQueue.length > 0) {
                const input = this.inputQueue.shift();
                this.emit(input.type, input.data);
            }

            this.lastProcessedTime = now;
        }

        if (this.inputQueue.length > 0) {
            requestAnimationFrame(() => this.processInputQueue());
        } else {
            this.processingInput = false;
        }
    }

    // ========== Event System ==========

    on(event, handler) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, []);
        }
        this.handlers.get(event).push(handler);

        return () => this.off(event, handler);
    }

    off(event, handler) {
        const handlers = this.handlers.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        const handlers = this.handlers.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in ${event} handler:`, error);
                }
            });
        }
    }

    // ========== Cleanup ==========

    cleanup() {
        this.gestureHistory = [];
        this.inputQueue = [];
        this.handlers.clear();
        this.gestures.clear();
        this.macros.clear();

        if (this.keyboard) {
            this.keyboard.children.forEach(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }

        console.info('VR Input System cleaned up');
    }
}

// Initialize and export
window.VRInputSystem = new VRInputSystem();

console.log('✅ VR Input System loaded');