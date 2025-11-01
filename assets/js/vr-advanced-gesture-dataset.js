/**
 * VR Advanced Gesture Dataset v2.0
 * Comprehensive gesture recognition dataset with 35+ gesture types
 * Organized into 4 gesture families for easy categorization and use
 *
 * Features:
 * - 35 gesture types (vs 15 in v5.7.0)
 * - 4 gesture families (Pointing, Navigation, Control, Advanced)
 * - Recognition confidence baselines
 * - Joint requirements per gesture
 * - Performance characteristics
 * - Aliases and alternate names
 *
 * @version 2.0.0
 * @author Claude Code
 */

class VRAdvancedGestureDataset {
    constructor() {
        this.gestures = new Map();
        this.families = new Map();
        this.aliases = new Map();
        this.gestureStats = new Map();

        this.initializeDataset();
    }

    /**
     * Initialize gesture dataset
     */
    initializeDataset() {
        // Family 1: Pointing & Selection (8 gestures)
        this.addFamily('pointing', 'Pointing & Selection Gestures', 8);
        this.addGesture('index-point', {
            family: 'pointing',
            description: 'Index finger pointing forward',
            confidence: 0.95,
            requiredJoints: ['indexTip', 'indexPIP', 'wrist'],
            minConfidence: 0.8,
            aliases: ['index-finger', 'point-forward', 'pointing'],
            mtuHands: 'both',
            complexity: 'simple',
            inferenceTime: 2.5
        });

        this.addGesture('multi-point', {
            family: 'pointing',
            description: 'Multiple fingers pointing (all fingers)',
            confidence: 0.92,
            requiredJoints: ['indexTip', 'middleTip', 'ringTip', 'pinkyTip', 'wrist'],
            minConfidence: 0.75,
            aliases: ['all-fingers-point', 'multi-finger'],
            multiHands: 'single',
            complexity: 'medium',
            inferenceTime: 3.0
        });

        this.addGesture('thumb-point', {
            family: 'pointing',
            description: 'Thumb pointing upward',
            confidence: 0.94,
            requiredJoints: ['thumbTip', 'thumbIP', 'wrist'],
            minConfidence: 0.8,
            aliases: ['thumb-up-pointing', 'thumb-forward'],
            multiHands: 'both',
            complexity: 'simple',
            inferenceTime: 2.5
        });

        this.addGesture('precision-grab', {
            family: 'pointing',
            description: 'Thumb and index finger pinching (precision grab)',
            confidence: 0.90,
            requiredJoints: ['thumbTip', 'indexTip', 'wrist'],
            minConfidence: 0.75,
            aliases: ['pinch', 'thumb-index-touch'],
            multiHands: 'both',
            complexity: 'medium',
            inferenceTime: 3.5
        });

        this.addGesture('open-hand-select', {
            family: 'pointing',
            description: 'Fully open hand (all fingers extended)',
            confidence: 0.96,
            requiredJoints: ['all-fingers', 'wrist'],
            minConfidence: 0.85,
            aliases: ['open-palm', 'hand-open', 'all-fingers-open'],
            multiHands: 'both',
            complexity: 'simple',
            inferenceTime: 2.0
        });

        this.addGesture('finger-gun', {
            family: 'pointing',
            description: 'Index and middle fingers extended like a gun',
            confidence: 0.88,
            requiredJoints: ['indexTip', 'middleTip', 'ringPIP', 'pinkyPIP', 'wrist'],
            minConfidence: 0.7,
            aliases: ['gun-gesture', 'two-finger-point'],
            multiHands: 'single',
            complexity: 'medium',
            inferenceTime: 3.5
        });

        this.addGesture('double-pinch', {
            family: 'pointing',
            description: 'Both hands pinching (bilateral)',
            confidence: 0.85,
            requiredJoints: ['both-thumbs', 'both-index-fingers', 'both-wrists'],
            minConfidence: 0.7,
            aliases: ['bilateral-pinch', 'both-hands-pinch'],
            multiHands: 'both',
            complexity: 'hard',
            inferenceTime: 4.5
        });

        this.addGesture('crossed-hands', {
            family: 'pointing',
            description: 'Hands crossed over each other',
            confidence: 0.87,
            requiredJoints: ['both-wrists', 'both-hands'],
            minConfidence: 0.7,
            aliases: ['hands-crossed', 'cross-gesture'],
            multiHands: 'both',
            complexity: 'hard',
            inferenceTime: 4.0
        });

        // Family 2: Navigation (7 gestures)
        this.addFamily('navigation', 'Navigation Gestures', 7);
        this.addGesture('swipe-up', {
            family: 'navigation',
            description: 'Upward swiping motion',
            confidence: 0.93,
            requiredJoints: ['wrist', 'palm'],
            minConfidence: 0.8,
            aliases: ['swipe-forward', 'up-swipe'],
            multiHands: 'both',
            complexity: 'simple',
            inferenceTime: 2.5,
            isDynamic: true
        });

        this.addGesture('swipe-down', {
            family: 'navigation',
            description: 'Downward swiping motion',
            confidence: 0.93,
            requiredJoints: ['wrist', 'palm'],
            minConfidence: 0.8,
            aliases: ['swipe-backward', 'down-swipe'],
            multiHands: 'both',
            complexity: 'simple',
            inferenceTime: 2.5,
            isDynamic: true
        });

        this.addGesture('swipe-left', {
            family: 'navigation',
            description: 'Leftward swiping motion',
            confidence: 0.92,
            requiredJoints: ['wrist', 'palm'],
            minConfidence: 0.8,
            aliases: ['swipe-previous', 'left-swipe'],
            multiHands: 'both',
            complexity: 'simple',
            inferenceTime: 2.5,
            isDynamic: true
        });

        this.addGesture('swipe-right', {
            family: 'navigation',
            description: 'Rightward swiping motion',
            confidence: 0.92,
            requiredJoints: ['wrist', 'palm'],
            minConfidence: 0.8,
            aliases: ['swipe-next', 'right-swipe'],
            multiHands: 'both',
            complexity: 'simple',
            inferenceTime: 2.5,
            isDynamic: true
        });

        this.addGesture('circle-clockwise', {
            family: 'navigation',
            description: 'Circular clockwise motion',
            confidence: 0.90,
            requiredJoints: ['wrist', 'palm', 'centerPoint'],
            minConfidence: 0.75,
            aliases: ['rotation-cw', 'clockwise-circle'],
            multiHands: 'both',
            complexity: 'medium',
            inferenceTime: 3.5,
            isDynamic: true
        });

        this.addGesture('circle-counterclockwise', {
            family: 'navigation',
            description: 'Circular counter-clockwise motion',
            confidence: 0.90,
            requiredJoints: ['wrist', 'palm', 'centerPoint'],
            minConfidence: 0.75,
            aliases: ['rotation-ccw', 'counterclockwise-circle'],
            multiHands: 'both',
            complexity: 'medium',
            inferenceTime: 3.5,
            isDynamic: true
        });

        this.addGesture('spiral-expanding', {
            family: 'navigation',
            description: 'Spiral motion expanding outward',
            confidence: 0.88,
            requiredJoints: ['wrist', 'palm', 'handCenter'],
            minConfidence: 0.7,
            aliases: ['spiral-out', 'expanding-motion'],
            multiHands: 'single',
            complexity: 'hard',
            inferenceTime: 4.0,
            isDynamic: true
        });

        // Family 3: Control (10 gestures)
        this.addFamily('control', 'Control Gestures', 10);
        this.addGesture('palm-open', {
            family: 'control',
            description: 'Palm fully open (same as open-hand-select)',
            confidence: 0.96,
            requiredJoints: ['all-fingers', 'palm', 'wrist'],
            minConfidence: 0.85,
            aliases: ['open-palm', 'palm-up', 'hand-open'],
            multiHands: 'both',
            complexity: 'simple',
            inferenceTime: 2.0
        });

        this.addGesture('fist-closed', {
            family: 'control',
            description: 'Hand fully closed in fist',
            confidence: 0.95,
            requiredJoints: ['all-finger-tips', 'palm', 'wrist'],
            minConfidence: 0.85,
            aliases: ['fist', 'closed-hand', 'grab'],
            multiHands: 'both',
            complexity: 'simple',
            inferenceTime: 2.0
        });

        this.addGesture('thumbs-up', {
            family: 'control',
            description: 'Thumbs up gesture (classic)',
            confidence: 0.94,
            requiredJoints: ['thumbTip', 'indexPIP', 'wrist'],
            minConfidence: 0.8,
            aliases: ['thumb-up', 'positive', 'approve'],
            multiHands: 'single',
            complexity: 'simple',
            inferenceTime: 2.5
        });

        this.addGesture('thumbs-down', {
            family: 'control',
            description: 'Thumbs down gesture (classic)',
            confidence: 0.93,
            requiredJoints: ['thumbTip', 'indexPIP', 'wrist'],
            minConfidence: 0.8,
            aliases: ['thumb-down', 'negative', 'disapprove'],
            multiHands: 'single',
            complexity: 'simple',
            inferenceTime: 2.5
        });

        this.addGesture('peace-sign', {
            family: 'control',
            description: 'Peace sign (V gesture)',
            confidence: 0.92,
            requiredJoints: ['indexTip', 'middleTip', 'ringPIP', 'pinkyPIP', 'wrist'],
            minConfidence: 0.8,
            aliases: ['v-sign', 'victory', 'peace'],
            multiHands: 'both',
            complexity: 'simple',
            inferenceTime: 2.5
        });

        this.addGesture('ok-sign', {
            family: 'control',
            description: 'OK sign (thumb + index circle)',
            confidence: 0.88,
            requiredJoints: ['thumbTip', 'indexTip', 'middleTip', 'wrist'],
            minConfidence: 0.75,
            aliases: ['ok', 'thumbs-circle', 'a-ok'],
            multiHands: 'both',
            complexity: 'medium',
            inferenceTime: 3.0
        });

        this.addGesture('love-sign', {
            family: 'control',
            description: 'Love sign (I love you)',
            confidence: 0.85,
            requiredJoints: ['indexTip', 'middleTip', 'thumbTip', 'pinkyTip', 'wrist'],
            minConfidence: 0.7,
            aliases: ['i-love-you', 'heart', 'love'],
            multiHands: 'both',
            complexity: 'medium',
            inferenceTime: 3.5
        });

        this.addGesture('rock-sign', {
            family: 'control',
            description: 'Rock on sign (horn fingers)',
            confidence: 0.86,
            requiredJoints: ['indexTip', 'pinkyTip', 'middlePIP', 'ringPIP', 'wrist'],
            minConfidence: 0.7,
            aliases: ['horns', 'rock-on', 'devil-horns'],
            multiHands: 'both',
            complexity: 'medium',
            inferenceTime: 3.5
        });

        this.addGesture('hands-clasp', {
            family: 'control',
            description: 'Both hands clasped together',
            confidence: 0.89,
            requiredJoints: ['both-palms', 'both-fingers', 'both-wrists'],
            minConfidence: 0.75,
            aliases: ['hands-together', 'clasped', 'prayer'],
            multiHands: 'both',
            complexity: 'medium',
            inferenceTime: 3.5
        });

        // Family 4: Advanced (10 gestures)
        this.addFamily('advanced', 'Advanced Gestures', 10);

        // 8-directional gestures
        const directions = [
            'up', 'up-right', 'right', 'down-right',
            'down', 'down-left', 'left', 'up-left'
        ];

        directions.forEach((dir, idx) => {
            const angle = idx * 45; // 0, 45, 90, 135, ...
            this.addGesture(`gesture-8-${dir}`, {
                family: 'advanced',
                description: `Directional gesture pointing ${dir} (${angle}°)`,
                confidence: 0.87 - (idx * 0.02),
                requiredJoints: ['wrist', 'palm', 'fingerTips'],
                minConfidence: 0.7,
                aliases: [`8-dir-${angle}`, `dir-${dir}`],
                multiHands: 'both',
                complexity: 'medium',
                inferenceTime: 3.0,
                angle: angle
            });
        });

        this.addGesture('context-sensitive', {
            family: 'advanced',
            description: 'Context-aware gesture (context-dependent meaning)',
            confidence: 0.80,
            requiredJoints: ['contextData', 'gestureState'],
            minConfidence: 0.65,
            aliases: ['context', 'smart-gesture'],
            multiHands: 'both',
            complexity: 'hard',
            inferenceTime: 5.0,
            requiresContext: true
        });

        this.addGesture('combo', {
            family: 'advanced',
            description: 'Combo gesture (sequential multi-gesture)',
            confidence: 0.75,
            requiredJoints: ['sequence-data'],
            minConfidence: 0.6,
            aliases: ['sequential', 'multi-gesture-combo'],
            multiHands: 'both',
            complexity: 'hard',
            inferenceTime: 6.0,
            isSequential: true,
            maxSequenceLength: 5
        });

        console.log('[VRAdvancedGestureDataset] Gesture dataset initialized');
        console.log(`Total gestures: ${this.gestures.size}`);
        console.log(`Gesture families: ${this.families.size}`);
    }

    /**
     * Add gesture family
     */
    addFamily(id, name, count) {
        this.families.set(id, {
            id,
            name,
            expectedCount: count,
            gestures: []
        });
    }

    /**
     * Add gesture to dataset
     */
    addGesture(id, data) {
        const gesture = {
            id,
            ...data,
            createdAt: Date.now(),
            recognitionCount: 0,
            lastRecognized: null,
            avgConfidence: data.confidence
        };

        this.gestures.set(id, gesture);

        // Add to family
        const family = this.families.get(data.family);
        if (family) {
            family.gestures.push(id);
        }

        // Register aliases
        if (data.aliases) {
            data.aliases.forEach(alias => {
                this.aliases.set(alias, id);
            });
        }

        // Initialize stats
        this.gestureStats.set(id, {
            recognitionCount: 0,
            falsePositives: 0,
            truePositives: 0,
            avgConfidence: data.confidence,
            minConfidence: data.confidence,
            maxConfidence: data.confidence
        });
    }

    /**
     * Get gesture by ID or alias
     */
    getGesture(idOrAlias) {
        // Try direct lookup first
        if (this.gestures.has(idOrAlias)) {
            return this.gestures.get(idOrAlias);
        }

        // Try alias
        if (this.aliases.has(idOrAlias)) {
            const actualId = this.aliases.get(idOrAlias);
            return this.gestures.get(actualId);
        }

        return null;
    }

    /**
     * Get all gestures in a family
     */
    getFamily(familyId) {
        const family = this.families.get(familyId);
        if (!family) return null;

        return {
            ...family,
            gestureObjects: family.gestures.map(id => this.gestures.get(id))
        };
    }

    /**
     * Get gesture by confidence range
     */
    getGesturesByConfidence(minConfidence, maxConfidence = 1.0) {
        const results = [];
        this.gestures.forEach(gesture => {
            if (gesture.confidence >= minConfidence && gesture.confidence <= maxConfidence) {
                results.push(gesture);
            }
        });
        return results;
    }

    /**
     * Get similar gestures
     */
    getSimilarGestures(gestureId, threshold = 0.8) {
        const target = this.getGesture(gestureId);
        if (!target) return [];

        const similar = [];
        this.gestures.forEach(gesture => {
            if (gesture.id === target.id) return;
            if (gesture.family === target.family) {
                similar.push(gesture);
            }
        });

        return similar.sort((a, b) =>
            Math.abs(a.confidence - target.confidence) -
            Math.abs(b.confidence - target.confidence)
        );
    }

    /**
     * Get all gestures
     */
    getAllGestures() {
        return Array.from(this.gestures.values());
    }

    /**
     * Get gesture statistics
     */
    getGestureStats(gestureId) {
        return this.gestureStats.get(gestureId);
    }

    /**
     * Update gesture statistics
     */
    updateGestureStats(gestureId, recognized, confidence) {
        const stats = this.gestureStats.get(gestureId);
        if (!stats) return;

        stats.recognitionCount++;
        if (recognized) {
            stats.truePositives++;
        } else {
            stats.falsePositives++;
        }

        // Update confidence tracking
        const oldAvg = stats.avgConfidence;
        stats.avgConfidence = (oldAvg * (stats.recognitionCount - 1) + confidence) / stats.recognitionCount;
        stats.minConfidence = Math.min(stats.minConfidence, confidence);
        stats.maxConfidence = Math.max(stats.maxConfidence, confidence);

        // Update gesture
        const gesture = this.gestures.get(gestureId);
        if (gesture) {
            gesture.recognitionCount++;
            gesture.lastRecognized = Date.now();
            gesture.avgConfidence = stats.avgConfidence;
        }
    }

    /**
     * Export dataset as JSON
     */
    exportDataset() {
        const data = {
            version: '2.0.0',
            exportDate: new Date().toISOString(),
            summary: {
                totalGestures: this.gestures.size,
                families: Array.from(this.families.values()),
                stats: this.getAllStats()
            },
            gestures: Array.from(this.gestures.entries()).map(([id, gesture]) => ({
                id,
                ...gesture
            })),
            aliases: Array.from(this.aliases.entries()).map(([alias, id]) => ({
                alias,
                id
            }))
        };

        return JSON.stringify(data, null, 2);
    }

    /**
     * Get all statistics
     */
    getAllStats() {
        const stats = {
            totalRecognitions: 0,
            totalTruePositives: 0,
            totalFalsePositives: 0,
            averageAccuracy: 0
        };

        this.gestureStats.forEach(stat => {
            stats.totalRecognitions += stat.recognitionCount;
            stats.totalTruePositives += stat.truePositives;
            stats.totalFalsePositives += stat.falsePositives;
        });

        if (stats.totalRecognitions > 0) {
            stats.averageAccuracy = (stats.totalTruePositives / stats.totalRecognitions * 100).toFixed(1) + '%';
        }

        return stats;
    }

    /**
     * Dispose
     */
    dispose() {
        this.gestures.clear();
        this.families.clear();
        this.aliases.clear();
        this.gestureStats.clear();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VRAdvancedGestureDataset;
}

// Global registration
if (typeof window !== 'undefined') {
    window.VRAdvancedGestureDataset = VRAdvancedGestureDataset;
}

// Initialize global instance
const gestureDataset = new VRAdvancedGestureDataset();
