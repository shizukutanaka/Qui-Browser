/**
 * VR Gesture Macro System
 * Record and playback custom gesture macros
 * @version 2.0.0
 */

class VRGestureMacro {
    constructor() {
        // Macro storage
        this.macros = new Map();

        // Recording state
        this.isRecording = false;
        this.recordingMacro = null;
        this.recordingStartTime = 0;

        // Playback state
        this.isPlaying = false;
        this.playbackMacro = null;
        this.playbackStartTime = 0;
        this.playbackIndex = 0;

            // Extended gesture patterns for advanced interactions
            doubleTap: { type: 'doubletap', threshold: 0.5, interval: 300 },
            longPress: { type: 'longpress', duration: 1000, threshold: 0.8 },
            multiSwipe: { type: 'multiswipe', directions: ['up', 'down', 'left', 'right'], threshold: 0.4 },
            spiral: { type: 'spiral', radius: 0.3, turns: 1.5, tolerance: 0.15 },
            zigzag: { type: 'zigzag', segments: 3, amplitude: 0.2, threshold: 0.3 },
            heart: { type: 'heart', symmetry: 0.9, size: 0.25 },
            cross: { type: 'cross', vertical: 0.2, horizontal: 0.2, tolerance: 0.1 },
            star: { type: 'star', points: 5, radius: 0.2, tolerance: 0.2 },
            triangle: { type: 'triangle', sides: 3, size: 0.3, tolerance: 0.15 },
            square: { type: 'square', sideLength: 0.3, tolerance: 0.1 }

        // Pre-defined macro templates
        this.templates = {
            quickNav: {
                name: 'クイックナビゲーション',
                description: '右スワイプで戻る、左スワイプで進む',
                gestures: [
                    { pattern: 'swipeRight', action: 'goBack' },
                    { pattern: 'swipeLeft', action: 'goForward' }
                ]
            },
            tabControl: {
                name: 'タブコントロール',
                description: '上スワイプで新規タブ、下スワイプで閉じる',
                gestures: [
                    { pattern: 'swipeUp', action: 'newTab' },
                    { pattern: 'swipeDown', action: 'closeTab' }
                ]
            },
            advancedNav: {
                name: '高度ナビゲーション',
                description: 'スパイラルでブックマーク、ダブルタップでズーム',
                gestures: [
                    { pattern: 'spiral', action: 'openBookmarks' },
                    { pattern: 'doubleTap', action: 'zoomIn' },
                    { pattern: 'longPress', action: 'showContextMenu' }
                ]
            },
            mediaControl: {
                name: 'メディアコントロール',
                description: 'ハートでいいね、クロスで閉じる、トライアングルで再生/停止',
                gestures: [
                    { pattern: 'heart', action: 'likeMedia' },
                    { pattern: 'cross', action: 'closeMedia' },
                    { pattern: 'triangle', action: 'togglePlayPause' }
                ]
            },
            productivitySuite: {
                name: '生産性スイート',
                description: 'スターで新規タブ、スクエアで設定、ジグザグでマルチタスク',
                gestures: [
                    { pattern: 'star', action: 'newTab' },
                    { pattern: 'square', action: 'openSettings' },
                    { pattern: 'zigzag', action: 'switchTask' }
                ]
            },
            creativeTools: {
                name: 'クリエイティブツール',
                description: 'マルチスワイプでツール選択、ロングプレスでクイックアクセス',
                gestures: [
                    { pattern: 'multiSwipe', action: 'selectTool' },
                    { pattern: 'longPress', action: 'quickAccess' }
                ]
            },
            bookmarkQuick: {
                name: 'クイックブックマーク',
                description: 'サムズアップでブックマーク追加',
                gestures: [
                    { pattern: 'thumbsUp', action: 'bookmark' }
                ]
            },
            voiceToggle: {
                name: '音声コントロール切替',
                description: 'ピースサインで音声認識ON/OFF',
                gestures: [
                    { pattern: 'peace', action: 'toggleVoice' }
                ]
            }
        };

        // Hand tracking data
        this.handTracking = null;
        this.handHistory = {
            left: [],
            right: []
        };
        this.historyMaxLength = 60; // 1 second at 60fps

        // Gesture detection state
        this.lastGesture = null;
        this.gestureTimeout = null;
        this.gestureCooldown = 500; // ms

        // Callbacks
        this.callbacks = {
            onGestureDetected: [],
            onMacroStart: [],
            onMacroComplete: []
        };
    }

    /**
     * Initialize gesture macro system
     * @param {Object} handTracking - Hand tracking system
     */
    init(handTracking) {
        this.handTracking = handTracking;

        // Load saved macros
        this.loadMacros();

        // Load templates as default macros
        this.loadTemplates();

        // Setup gesture detection
        this.startGestureDetection();

        console.log('[VR Gesture Macro] Initialized');
        return this;
    }

    /**
     * Start recording new macro
     * @param {string} name - Macro name
     * @param {string} description - Macro description
     */
    startRecording(name, description = '') {
        if (this.isRecording) {
            console.warn('[VR Gesture Macro] Already recording');
            return;
        }

        this.isRecording = true;
        this.recordingStartTime = Date.now();
        this.recordingMacro = {
            name,
            description,
            gestures: [],
            duration: 0
        };

        console.log(`[VR Gesture Macro] Recording started: ${name}`);

        // Provide feedback
        if (window.vrSpatialAudio) {
            window.vrSpatialAudio.playSuccess();
        }
    }

    /**
     * Stop recording macro
     * @returns {Object} Recorded macro
     */
    stopRecording() {
        if (!this.isRecording) {
            console.warn('[VR Gesture Macro] Not recording');
            return null;
        }

        this.isRecording = false;
        this.recordingMacro.duration = Date.now() - this.recordingStartTime;

        // Save macro
        const macroId = `macro_${Date.now()}`;
        this.macros.set(macroId, this.recordingMacro);
        this.saveMacros();

        console.log(`[VR Gesture Macro] Recording stopped: ${this.recordingMacro.name}`);

        // Provide feedback
        if (window.vrSpatialAudio) {
            window.vrSpatialAudio.playSuccess();
        }

        const macro = this.recordingMacro;
        this.recordingMacro = null;

        return macro;
    }

    /**
     * Record gesture event
     * @param {Object} gesture - Gesture data
     */
    recordGesture(gesture) {
        if (!this.isRecording || !this.recordingMacro) return;

        const timestamp = Date.now() - this.recordingStartTime;

        this.recordingMacro.gestures.push({
            ...gesture,
            timestamp
        });

        console.log(`[VR Gesture Macro] Gesture recorded:`, gesture.pattern);
    }

    /**
     * Play macro
     * @param {string} macroId - Macro ID
     */
    playMacro(macroId) {
        const macro = this.macros.get(macroId);
        if (!macro) {
            console.warn(`[VR Gesture Macro] Macro not found: ${macroId}`);
            return;
        }

        if (this.isPlaying) {
            console.warn('[VR Gesture Macro] Already playing macro');
            return;
        }

        this.isPlaying = true;
        this.playbackMacro = macro;
        this.playbackStartTime = Date.now();
        this.playbackIndex = 0;

        console.log(`[VR Gesture Macro] Playing macro: ${macro.name}`);

        // Trigger callback
        this.triggerCallback('onMacroStart', { macro });

        // Start playback loop
        this.playbackLoop();
    }

    /**
     * Playback loop
     */
    playbackLoop() {
        if (!this.isPlaying || !this.playbackMacro) return;

        const currentTime = Date.now() - this.playbackStartTime;
        const gestures = this.playbackMacro.gestures;

        while (this.playbackIndex < gestures.length) {
            const gesture = gestures[this.playbackIndex];

            if (gesture.timestamp <= currentTime) {
                // Execute gesture action
                this.executeGestureAction(gesture);
                this.playbackIndex++;
            } else {
                break;
            }
        }

        // Check if playback complete
        if (this.playbackIndex >= gestures.length) {
            this.stopPlayback();
            return;
        }

        // Continue playback
        requestAnimationFrame(() => this.playbackLoop());
    }

    /**
     * Stop macro playback
     */
    stopPlayback() {
        if (!this.isPlaying) return;

        this.isPlaying = false;

        console.log(`[VR Gesture Macro] Playback stopped: ${this.playbackMacro.name}`);

        // Trigger callback
        this.triggerCallback('onMacroComplete', { macro: this.playbackMacro });

        this.playbackMacro = null;
        this.playbackIndex = 0;
    }

    /**
     * Execute gesture action
     * @param {Object} gesture - Gesture data
     */
    executeGestureAction(gesture) {
        const action = gesture.action;

        const actions = {
            goBack: () => window.browser?.goBack(),
            goForward: () => window.browser?.goForward(),
            refresh: () => window.browser?.refresh(),
            newTab: () => window.browser?.createNewTab(),
            closeTab: () => window.browser?.closeCurrentTab(),
            bookmark: () => window.browser?.bookmark(),
            toggleVoice: () => this.toggleVoiceControl(),
            home: () => window.browser?.goHome()
        };

        if (actions[action]) {
            actions[action]();
            console.log(`[VR Gesture Macro] Executed action: ${action}`);
        } else {
            console.warn(`[VR Gesture Macro] Unknown action: ${action}`);
        }
    }

    /**
     * Start gesture detection
     */
    startGestureDetection() {
        const detect = () => {
            if (this.handTracking) {
                this.updateHandHistory();
                this.detectGestures();
            }

            requestAnimationFrame(detect);
        };

        detect();
    }

    /**
     * Update hand position history
     */
    updateHandHistory() {
        if (!this.handTracking?.hands) return;

        ['left', 'right'].forEach(handedness => {
            const hand = this.handTracking.hands[handedness];
            if (!hand) return;

            // Get wrist position
            const position = hand.wrist?.position || { x: 0, y: 0, z: 0 };

            // Add to history
            this.handHistory[handedness].push({
                position,
                timestamp: Date.now()
            });

            // Limit history length
            if (this.handHistory[handedness].length > this.historyMaxLength) {
                this.handHistory[handedness].shift();
            }
        });
    }

    /**
     * Detect gestures from hand history
     */
    detectGestures() {
        // Check cooldown
        if (this.lastGesture && Date.now() - this.lastGesture.timestamp < this.gestureCooldown) {
            return;
        }

        // Detect each gesture pattern
        for (const [patternName, pattern] of Object.entries(this.gesturePatterns)) {
            const detected = this.detectPattern(pattern);

            if (detected) {
                this.onGestureDetected(patternName, detected);
                break; // Only detect one gesture at a time
            }
        }
    }

    /**
     * Detect specific gesture pattern
     * @param {Object} pattern - Pattern configuration
     * @returns {Object|null} Detection result
     */
    detectPattern(pattern) {
        switch (pattern.type) {
            case 'swipe':
                return this.detectSwipe(pattern);
            case 'circle':
                return this.detectCircle(pattern);
            case 'pinch':
                return this.detectPinch(pattern);
            case 'grab':
                return this.detectGrab(pattern);
            case 'point':
                return this.detectPoint(pattern);
            case 'wave':
                return this.detectWave(pattern);
            default:
                return this.detectStaticPose(pattern);
        }
    }

    /**
     * Detect swipe gesture
     * @param {Object} pattern - Pattern configuration
     * @returns {Object|null}
     */
    detectSwipe(pattern) {
        const history = this.handHistory.right;
        if (history.length < 10) return null;

        const start = history[0].position;
        const end = history[history.length - 1].position;

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const dz = end.z - start.z;

        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance < pattern.threshold) return null;

        // Determine direction
        let detectedDirection = null;

        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > Math.abs(dz)) {
            detectedDirection = dx > 0 ? 'right' : 'left';
        } else if (Math.abs(dy) > Math.abs(dz)) {
            detectedDirection = dy > 0 ? 'up' : 'down';
        }

        if (detectedDirection === pattern.direction) {
            return {
                type: 'swipe',
                direction: detectedDirection,
                distance,
                handedness: 'right'
            };
        }

        return null;
    }

    /**
     * Detect circle gesture
     * @param {Object} pattern - Pattern configuration
     * @returns {Object|null}
     */
    detectCircle(pattern) {
        // Simplified circle detection
        // Real implementation would check if points form a circular path
        return null;
    }

    /**
     * Detect pinch gesture
     * @param {Object} pattern - Pattern configuration
     * @returns {Object|null}
     */
    detectPinch(pattern) {
        if (!this.handTracking?.hands) return null;

        const hand = this.handTracking.hands.right;
        if (!hand || !hand.pinchStrength) return null;

        if (hand.pinchStrength > pattern.threshold) {
            return {
                type: 'pinch',
                strength: hand.pinchStrength,
                handedness: 'right'
            };
        }

        return null;
    }

    /**
     * Detect grab gesture
     * @param {Object} pattern - Pattern configuration
     * @returns {Object|null}
     */
    detectGrab(pattern) {
        if (!this.handTracking?.hands) return null;

        const hand = this.handTracking.hands.right;
        if (!hand || !hand.grabStrength) return null;

        if (hand.grabStrength > pattern.threshold) {
            return {
                type: 'grab',
                strength: hand.grabStrength,
                handedness: 'right'
            };
        }

        return null;
    }

    /**
     * Detect pointing gesture
     * @param {Object} pattern - Pattern configuration
     * @returns {Object|null}
     */
    detectPoint(pattern) {
        if (!this.handTracking?.hands) return null;

        const hand = this.handTracking.hands.right;
        if (!hand || !hand.pointStrength) return null;

        if (hand.pointStrength > pattern.threshold) {
            return {
                type: 'point',
                strength: hand.pointStrength,
                handedness: 'right'
            };
        }

        return null;
    }

    /**
     * Detect wave gesture
     * @param {Object} pattern - Pattern configuration
     * @returns {Object|null}
     */
    detectWave(pattern) {
        // Simplified wave detection
        // Real implementation would check for oscillating motion
        return null;
    }

    /**
     * Detect static pose
     * @param {Object} pattern - Pattern configuration
     * @returns {Object|null}
     */
    detectStaticPose(pattern) {
        // Detect static hand poses (thumbs up, peace sign, etc.)
        // This would require finger joint analysis
        return null;
    }

    /**
     * Handle gesture detection
     * @param {string} patternName - Pattern name
     * @param {Object} data - Detection data
     */
    onGestureDetected(patternName, data) {
        this.lastGesture = {
            pattern: patternName,
            data,
            timestamp: Date.now()
        };

        console.log(`[VR Gesture Macro] Gesture detected: ${patternName}`);

        // Trigger callback
        this.triggerCallback('onGestureDetected', { pattern: patternName, data });

        // If recording, record the gesture
        if (this.isRecording) {
            this.recordGesture({ pattern: patternName, ...data });
        }

        // Check if gesture matches macro trigger
        this.checkMacroTriggers(patternName, data);

        // Provide haptic feedback
        if (this.handTracking) {
            this.triggerHaptic(data.handedness || 'right', 0.3, 50);
        }
    }

    /**
     * Check if gesture triggers a macro
     * @param {string} patternName - Pattern name
     * @param {Object} data - Gesture data
     */
    checkMacroTriggers(patternName, data) {
        this.macros.forEach((macro, macroId) => {
            if (!macro.gestures || macro.gestures.length === 0) return;

            // Check if first gesture matches
            const firstGesture = macro.gestures[0];
            if (firstGesture.pattern === patternName) {
                // If macro has only one gesture, execute it
                if (macro.gestures.length === 1 && firstGesture.action) {
                    this.executeGestureAction(firstGesture);
                }
                // For multi-gesture macros, would need sequence detection
            }
        });
    }

    /**
     * Toggle voice control
     */
    toggleVoiceControl() {
        if (window.vrAccessibility) {
            if (window.vrAccessibility.isListening) {
                window.vrAccessibility.stopVoiceControl();
            } else {
                window.vrAccessibility.startVoiceControl();
            }
        }
    }

    /**
     * Trigger haptic feedback
     * @param {string} handedness - Hand side
     * @param {number} intensity - Intensity 0-1
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
     * Load templates as default macros
     */
    loadTemplates() {
        Object.entries(this.templates).forEach(([id, template]) => {
            if (!this.macros.has(id)) {
                this.macros.set(id, template);
            }
        });
    }

    /**
     * Get all macros
     * @returns {Array} List of macros
     */
    getMacros() {
        return Array.from(this.macros.entries()).map(([id, macro]) => ({
            id,
            ...macro
        }));
    }

    /**
     * Delete macro
     * @param {string} macroId - Macro ID
     */
    deleteMacro(macroId) {
        this.macros.delete(macroId);
        this.saveMacros();
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
     * Save macros to localStorage
     */
    saveMacros() {
        try {
            const data = Array.from(this.macros.entries());
            localStorage.setItem('vr-gesture-macros', JSON.stringify(data));
        } catch (error) {
            console.error('[VR Gesture Macro] Failed to save macros:', error);
        }
    }

    /**
     * Load macros from localStorage
     */
    loadMacros() {
        try {
            const saved = localStorage.getItem('vr-gesture-macros');
            if (saved) {
                const data = JSON.parse(saved);
                this.macros = new Map(data);
            }
        } catch (error) {
            console.error('[VR Gesture Macro] Failed to load macros:', error);
        }
    }

    /**
     * Recognize advanced gesture patterns
     * @param {Object} handData - Hand tracking data
     * @param {string} hand - 'left' or 'right'
     * @returns {string|null} Recognized gesture pattern
     */
    recognizeAdvancedGestures(handData, hand) {
        const history = this.handHistory[hand];
        if (history.length < 10) return null;

        // Double tap detection
        if (this.isDoubleTap(history)) return 'doubleTap';

        // Long press detection
        if (this.isLongPress(handData, hand)) return 'longPress';

        // Spiral detection
        if (this.isSpiral(history)) return 'spiral';

        // Zigzag detection
        if (this.isZigzag(history)) return 'zigzag';

        // Heart shape detection
        if (this.isHeart(history)) return 'heart';

        // Cross detection
        if (this.isCross(history)) return 'cross';

        // Star detection
        if (this.isStar(history)) return 'star';

        // Triangle detection
        if (this.isTriangle(history)) return 'triangle';

        // Square detection
        if (this.isSquare(history)) return 'square';

        // Multi-swipe detection
        if (this.isMultiSwipe(history)) return 'multiSwipe';

        return null;
    }

    /**
     * Check if gesture is double tap
     * @param {Array} history - Hand position history
     * @returns {boolean}
     */
    isDoubleTap(history) {
        const pattern = this.gesturePatterns.doubleTap;
        const recent = history.slice(-10);

        let taps = 0;
        let lastTapTime = 0;

        for (let i = 1; i < recent.length; i++) {
            const dist = this.calculateDistance(recent[i-1].position, recent[i].position);
            if (dist < pattern.threshold) {
                const currentTime = recent[i].timestamp;
                if (currentTime - lastTapTime <= pattern.interval) {
                    taps++;
                }
                lastTapTime = currentTime;
            }
        }

        return taps >= 2;
    }

    /**
     * Check if gesture is long press
     * @param {Object} handData - Current hand data
     * @param {string} hand - Hand side
     * @returns {boolean}
     */
    isLongPress(handData, hand) {
        const pattern = this.gesturePatterns.longPress;
        const history = this.handHistory[hand];
        const recent = history.slice(-20);

        if (recent.length < 10) return false;

        // Check if hand has been relatively static
        let staticCount = 0;
        for (let i = 1; i < recent.length; i++) {
            const dist = this.calculateDistance(recent[i-1].position, recent[i].position);
            if (dist < pattern.threshold) staticCount++;
        }

        const staticRatio = staticCount / recent.length;
        const duration = recent[recent.length - 1].timestamp - recent[0].timestamp;

        return staticRatio > 0.8 && duration >= pattern.duration;
    }

    /**
     * Check if gesture is spiral
     * @param {Array} history - Hand position history
     * @returns {boolean}
     */
    isSpiral(history) {
        const pattern = this.gesturePatterns.spiral;
        const recent = history.slice(-30);

        if (recent.length < 15) return false;

        // Calculate spiral characteristics
        const center = this.calculateCenter(recent);
        const radii = recent.map(point => this.calculateDistance(center, point.position));

        // Check for increasing then stable radius pattern
        let increasing = 0;
        let stable = 0;

        for (let i = 1; i < radii.length; i++) {
            if (radii[i] > radii[i-1] * 0.95) increasing++;
            else if (Math.abs(radii[i] - radii[i-1]) < pattern.tolerance) stable++;
        }

        const total = radii.length - 1;
        return (increasing / total > 0.4 && stable / total > 0.3);
    }

    /**
     * Check if gesture is zigzag
     * @param {Array} history - Hand position history
     * @returns {boolean}
     */
    isZigzag(history) {
        const pattern = this.gesturePatterns.zigzag;
        const recent = history.slice(-20);

        if (recent.length < 10) return false;

        // Detect alternating directions
        let directionChanges = 0;
        let lastDirection = null;

        for (let i = 2; i < recent.length; i++) {
            const dir1 = this.getDirection(recent[i-1].position, recent[i].position);
            const dir2 = this.getDirection(recent[i-2].position, recent[i-1].position);

            if (dir1 !== dir2 && lastDirection !== dir1) {
                directionChanges++;
                lastDirection = dir1;
            }
        }

        return directionChanges >= pattern.segments;
    }

    /**
     * Helper: Calculate center of points
     * @param {Array} points - Array of points
     * @returns {Object} Center point
     */
    calculateCenter(points) {
        const sum = points.reduce((acc, point) => {
            acc.x += point.position.x;
            acc.y += point.position.y;
            acc.z += point.position.z;
            return acc;
        }, { x: 0, y: 0, z: 0 });

        return {
            x: sum.x / points.length,
            y: sum.y / points.length,
            z: sum.z / points.length
        };
    }

    /**
     * Helper: Get direction between two points
     * @param {Object} from - Start point
     * @param {Object} to - End point
     * @returns {string} Direction
     */
    getDirection(from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dz = to.z - from.z;

        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        const absZ = Math.abs(dz);

        if (absX > absY && absX > absZ) return dx > 0 ? 'right' : 'left';
        if (absY > absX && absY > absZ) return dy > 0 ? 'up' : 'down';
        if (absZ > absX && absZ > absY) return dz > 0 ? 'forward' : 'back';

        return 'unknown';
    }
}

// Export for global access
if (typeof window !== 'undefined') {
    window.VRGestureMacro = VRGestureMacro;
}
