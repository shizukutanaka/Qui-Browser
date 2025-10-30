/**
 * VR Gesture Customization & Macro System
 * Advanced gesture recording, macro creation, and profile management
 *
 * Features:
 * - Record custom gesture sequences (macros)
 * - Create app-specific gesture profiles
 * - Bind gestures to actions
 * - Macro persistence (localStorage/IndexedDB)
 * - Export/import gesture profiles
 * - Macro execution with timing and feedback
 *
 * @version 1.0.0
 * @author Claude Code
 */

class VRGestureCustomization {
    constructor(gestureEngine, options = {}) {
        this.gestureEngine = gestureEngine;
        this.options = {
            storageType: options.storageType || 'localStorage', // localStorage or indexeddb
            maxMacroLength: options.maxMacroLength || 20, // Max gestures in macro
            recordTimeout: options.recordTimeout || 5000, // ms between gestures
            enableAutoSave: options.enableAutoSave ?? true,
            enableVibration: options.enableVibration ?? true,
            enableAudio: options.enableAudio ?? true,
            ...options
        };

        // Macro storage
        this.macros = new Map(); // name -> macro definition
        this.profiles = new Map(); // profile -> gesture bindings
        this.currentProfile = 'default';
        this.recordingState = {
            isRecording: false,
            macroName: null,
            gestures: [],
            startTime: null,
            recordTimer: null
        };

        this.eventEmitter = {};
        this.storageManager = null;
        this.feedbackHandler = null;
        this.initialized = false;

        // Create default profile
        this.profiles.set('default', new Map());
    }

    /**
     * Initialize customization system
     */
    async initialize() {
        console.log('[VRGestureCustomization] Initializing...');

        try {
            // Initialize storage
            await this.initializeStorage();

            // Load saved macros
            await this.loadMacros();

            // Load saved profiles
            await this.loadProfiles();

            // Setup gesture event listeners
            this.setupGestureListeners();

            this.initialized = true;
            this.emit('initialized', { timestamp: Date.now() });
            console.log('[VRGestureCustomization] Initialized');
        } catch (error) {
            console.error('[VRGestureCustomization] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize storage backend
     */
    async initializeStorage() {
        if (this.options.storageType === 'indexeddb') {
            this.storageManager = new IndexedDBStorage('vr-gestures', 'macros');
            await this.storageManager.initialize();
        } else {
            this.storageManager = new LocalStorageManager('vr-gestures');
        }
    }

    /**
     * Setup gesture event listeners
     */
    setupGestureListeners() {
        if (this.gestureEngine && this.gestureEngine.on) {
            this.gestureEngine.on('gesture', (gesture) => {
                this.onGestureDetected(gesture);
            });
        }
    }

    /**
     * Handle detected gesture
     */
    onGestureDetected(gesture) {
        // Record if in recording mode
        if (this.recordingState.isRecording) {
            this.addGestureToMacro(gesture);
        }

        // Execute macro if gesture matches macro trigger
        const macro = this.getMacroByGesture(gesture.type);
        if (macro && macro.trigger === gesture.type) {
            this.executeMacro(macro.name);
        }

        // Execute bound action
        const binding = this.getGestureBinding(gesture.type);
        if (binding) {
            this.executeBinding(binding);
        }
    }

    /**
     * Start recording macro
     */
    startMacroRecording(macroName, options = {}) {
        if (this.recordingState.isRecording) {
            console.warn('[VRGestureCustomization] Already recording macro');
            return false;
        }

        console.log(`[VRGestureCustomization] Starting macro recording: ${macroName}`);

        this.recordingState.isRecording = true;
        this.recordingState.macroName = macroName;
        this.recordingState.gestures = [];
        this.recordingState.startTime = performance.now();

        // Set timeout to auto-stop recording
        this.recordingState.recordTimer = setTimeout(() => {
            this.stopMacroRecording();
        }, options.timeout || this.options.recordTimeout);

        this.provideFeedback('recording-started', { macroName });
        this.emit('macro-recording-started', { macroName, timestamp: Date.now() });

        return true;
    }

    /**
     * Add gesture to macro being recorded
     */
    addGestureToMacro(gesture) {
        if (!this.recordingState.isRecording) return;

        if (this.recordingState.gestures.length >= this.options.maxMacroLength) {
            console.warn('[VRGestureCustomization] Macro length limit reached');
            this.stopMacroRecording();
            return;
        }

        const gestureEntry = {
            type: gesture.type,
            timestamp: performance.now() - this.recordingState.startTime,
            confidence: gesture.confidence,
            hand: gesture.hand,
            data: gesture.data
        };

        this.recordingState.gestures.push(gestureEntry);

        // Provide feedback
        this.provideFeedback('gesture-recorded', {
            gesture: gesture.type,
            count: this.recordingState.gestures.length
        });

        this.emit('gesture-recorded', gestureEntry);

        // Reset timer for next gesture
        clearTimeout(this.recordingState.recordTimer);
        this.recordingState.recordTimer = setTimeout(() => {
            this.stopMacroRecording();
        }, this.options.recordTimeout);
    }

    /**
     * Stop recording macro
     */
    stopMacroRecording() {
        if (!this.recordingState.isRecording) {
            console.warn('[VRGestureCustomization] Not currently recording');
            return null;
        }

        clearTimeout(this.recordingState.recordTimer);

        const macroName = this.recordingState.macroName;
        const gestures = this.recordingState.gestures;

        if (gestures.length === 0) {
            console.warn('[VRGestureCustomization] No gestures recorded');
            this.recordingState.isRecording = false;
            this.provideFeedback('recording-cancelled');
            return null;
        }

        // Create macro definition
        const macro = {
            name: macroName,
            createdAt: Date.now(),
            gestures: gestures,
            duration: gestures[gestures.length - 1].timestamp,
            gestureCount: gestures.length,
            trigger: gestures[0].type, // First gesture triggers macro
            description: `Custom macro with ${gestures.length} gestures`,
            enabled: true,
            execCount: 0,
            lastExecTime: null
        };

        // Save macro
        this.macros.set(macroName, macro);

        // Reset recording state
        this.recordingState.isRecording = false;
        this.recordingState.macroName = null;
        this.recordingState.gestures = [];

        // Auto-save if enabled
        if (this.options.enableAutoSave) {
            this.saveMacros();
        }

        this.provideFeedback('recording-completed', { macroName, gestureCount: gestures.length });
        this.emit('macro-created', macro);

        console.log(`[VRGestureCustomization] Macro recorded: ${macroName} (${gestures.length} gestures)`);

        return macro;
    }

    /**
     * Get current recording status
     */
    getRecordingStatus() {
        if (!this.recordingState.isRecording) {
            return { recording: false };
        }

        return {
            recording: true,
            macroName: this.recordingState.macroName,
            gestureCount: this.recordingState.gestures.length,
            elapsed: performance.now() - this.recordingState.startTime,
            duration: this.recordingState.gestures.length > 0
                ? this.recordingState.gestures[this.recordingState.gestures.length - 1].timestamp
                : 0
        };
    }

    /**
     * Execute macro
     */
    async executeMacro(macroName) {
        const macro = this.macros.get(macroName);
        if (!macro) {
            console.warn(`[VRGestureCustomization] Macro not found: ${macroName}`);
            return false;
        }

        if (!macro.enabled) {
            console.warn(`[VRGestureCustomization] Macro disabled: ${macroName}`);
            return false;
        }

        console.log(`[VRGestureCustomization] Executing macro: ${macroName}`);

        this.provideFeedback('macro-started', { macroName });
        this.emit('macro-execution-started', { macroName, timestamp: Date.now() });

        try {
            // Execute gestures in sequence
            for (let i = 0; i < macro.gestures.length; i++) {
                const gesture = macro.gestures[i];
                const nextGesture = macro.gestures[i + 1];

                // Wait for timing between gestures
                if (nextGesture && i > 0) {
                    const timeDelta = nextGesture.timestamp - gesture.timestamp;
                    await this.sleep(timeDelta);
                }

                // Simulate gesture execution
                this.emit('macro-gesture-executed', {
                    macroName,
                    gestureIndex: i,
                    gesture: gesture.type,
                    timestamp: Date.now()
                });
            }

            // Update macro stats
            macro.execCount++;
            macro.lastExecTime = Date.now();

            this.provideFeedback('macro-completed', { macroName });
            this.emit('macro-execution-completed', {
                macroName,
                gestureCount: macro.gestures.length,
                timestamp: Date.now()
            });

            return true;
        } catch (error) {
            console.error(`[VRGestureCustomization] Macro execution failed: ${macroName}`, error);
            this.provideFeedback('macro-failed', { macroName, error: error.message });
            return false;
        }
    }

    /**
     * Get macro by name
     */
    getMacro(name) {
        return this.macros.get(name) || null;
    }

    /**
     * Get macro by trigger gesture
     */
    getMacroByGesture(gestureType) {
        for (const macro of this.macros.values()) {
            if (macro.trigger === gestureType && macro.enabled) {
                return macro;
            }
        }
        return null;
    }

    /**
     * List all macros
     */
    listMacros() {
        return Array.from(this.macros.values()).map(macro => ({
            name: macro.name,
            gestureCount: macro.gestureCount,
            trigger: macro.trigger,
            enabled: macro.enabled,
            execCount: macro.execCount,
            duration: macro.duration,
            createdAt: new Date(macro.createdAt).toISOString()
        }));
    }

    /**
     * Delete macro
     */
    deleteMacro(name) {
        const deleted = this.macros.delete(name);
        if (deleted && this.options.enableAutoSave) {
            this.saveMacros();
        }
        return deleted;
    }

    /**
     * Create gesture profile (app-specific)
     */
    createProfile(profileName) {
        if (this.profiles.has(profileName)) {
            console.warn(`[VRGestureCustomization] Profile already exists: ${profileName}`);
            return false;
        }

        this.profiles.set(profileName, new Map());
        this.emit('profile-created', { profileName, timestamp: Date.now() });
        return true;
    }

    /**
     * Switch to profile
     */
    switchProfile(profileName) {
        if (!this.profiles.has(profileName)) {
            console.warn(`[VRGestureCustomization] Profile not found: ${profileName}`);
            return false;
        }

        this.currentProfile = profileName;
        this.emit('profile-switched', { profileName, timestamp: Date.now() });
        return true;
    }

    /**
     * Get current profile
     */
    getCurrentProfile() {
        return this.currentProfile;
    }

    /**
     * Bind gesture to action
     */
    bindGestureToAction(gestureType, action, profileName = null) {
        const profile = profileName || this.currentProfile;
        const bindings = this.profiles.get(profile);

        if (!bindings) {
            console.warn(`[VRGestureCustomization] Profile not found: ${profile}`);
            return false;
        }

        bindings.set(gestureType, action);

        this.emit('gesture-bound', {
            gestureType,
            action,
            profileName: profile,
            timestamp: Date.now()
        });

        return true;
    }

    /**
     * Get gesture binding
     */
    getGestureBinding(gestureType) {
        const bindings = this.profiles.get(this.currentProfile);
        return bindings ? bindings.get(gestureType) : null;
    }

    /**
     * Get all bindings for profile
     */
    getProfileBindings(profileName = null) {
        const profile = profileName || this.currentProfile;
        const bindings = this.profiles.get(profile);

        if (!bindings) return [];

        return Array.from(bindings.entries()).map(([gesture, action]) => ({
            gesture,
            action
        }));
    }

    /**
     * Execute gesture binding
     */
    executeBinding(binding) {
        if (typeof binding === 'function') {
            binding();
        } else if (typeof binding === 'string') {
            // Execute as event
            this.emit('binding-action', { action: binding });
        } else if (binding && binding.execute) {
            binding.execute();
        }
    }

    /**
     * Clear all bindings for profile
     */
    clearProfileBindings(profileName = null) {
        const profile = profileName || this.currentProfile;
        const bindings = this.profiles.get(profile);

        if (bindings) {
            bindings.clear();
        }

        return true;
    }

    /**
     * Export macros as JSON
     */
    exportMacros() {
        const macrosArray = Array.from(this.macros.values());
        return JSON.stringify(macrosArray, null, 2);
    }

    /**
     * Import macros from JSON
     */
    importMacros(jsonData) {
        try {
            const macrosArray = typeof jsonData === 'string'
                ? JSON.parse(jsonData)
                : jsonData;

            let imported = 0;
            macrosArray.forEach(macroData => {
                this.macros.set(macroData.name, macroData);
                imported++;
            });

            if (this.options.enableAutoSave) {
                this.saveMacros();
            }

            this.emit('macros-imported', { count: imported, timestamp: Date.now() });
            return imported;
        } catch (error) {
            console.error('[VRGestureCustomization] Import failed:', error);
            return 0;
        }
    }

    /**
     * Export profiles as JSON
     */
    exportProfiles() {
        const profilesObj = {};

        for (const [name, bindings] of this.profiles.entries()) {
            profilesObj[name] = Array.from(bindings.entries()).map(([gesture, action]) => ({
                gesture,
                action: typeof action === 'string' ? action : action.toString()
            }));
        }

        return JSON.stringify(profilesObj, null, 2);
    }

    /**
     * Import profiles from JSON
     */
    importProfiles(jsonData) {
        try {
            const profilesObj = typeof jsonData === 'string'
                ? JSON.parse(jsonData)
                : jsonData;

            let imported = 0;
            for (const [name, bindings] of Object.entries(profilesObj)) {
                this.createProfile(name);
                const profileBindings = this.profiles.get(name);

                bindings.forEach(binding => {
                    profileBindings.set(binding.gesture, binding.action);
                });

                imported++;
            }

            if (this.options.enableAutoSave) {
                this.saveProfiles();
            }

            this.emit('profiles-imported', { count: imported, timestamp: Date.now() });
            return imported;
        } catch (error) {
            console.error('[VRGestureCustomization] Profile import failed:', error);
            return 0;
        }
    }

    /**
     * Save macros to storage
     */
    async saveMacros() {
        try {
            const macrosArray = Array.from(this.macros.values());
            await this.storageManager.save('macros', macrosArray);
            this.emit('macros-saved', { count: macrosArray.length, timestamp: Date.now() });
        } catch (error) {
            console.error('[VRGestureCustomization] Save macros failed:', error);
        }
    }

    /**
     * Load macros from storage
     */
    async loadMacros() {
        try {
            const macrosArray = await this.storageManager.load('macros') || [];
            macrosArray.forEach(macroData => {
                this.macros.set(macroData.name, macroData);
            });
            this.emit('macros-loaded', { count: macrosArray.length, timestamp: Date.now() });
        } catch (error) {
            console.error('[VRGestureCustomization] Load macros failed:', error);
        }
    }

    /**
     * Save profiles to storage
     */
    async saveProfiles() {
        try {
            const profilesObj = {};
            for (const [name, bindings] of this.profiles.entries()) {
                profilesObj[name] = Array.from(bindings.entries());
            }
            await this.storageManager.save('profiles', profilesObj);
            this.emit('profiles-saved', { count: this.profiles.size, timestamp: Date.now() });
        } catch (error) {
            console.error('[VRGestureCustomization] Save profiles failed:', error);
        }
    }

    /**
     * Load profiles from storage
     */
    async loadProfiles() {
        try {
            const profilesObj = await this.storageManager.load('profiles') || {};
            for (const [name, bindings] of Object.entries(profilesObj)) {
                const profileBindings = new Map(bindings);
                this.profiles.set(name, profileBindings);
            }
            this.emit('profiles-loaded', { count: this.profiles.size, timestamp: Date.now() });
        } catch (error) {
            console.error('[VRGestureCustomization] Load profiles failed:', error);
        }
    }

    /**
     * Provide feedback (vibration, audio, visual)
     */
    provideFeedback(feedbackType, data = {}) {
        if (!this.options.enableVibration && !this.options.enableAudio) return;

        const feedbackMap = {
            'recording-started': { vibration: [50, 30, 50], audio: 'beep-high' },
            'gesture-recorded': { vibration: [30], audio: 'beep-low' },
            'recording-completed': { vibration: [100, 50, 100], audio: 'success' },
            'recording-cancelled': { vibration: [200], audio: 'error' },
            'macro-started': { vibration: [100], audio: 'beep-double' },
            'macro-completed': { vibration: [150, 100], audio: 'success' },
            'macro-failed': { vibration: [300, 100, 300], audio: 'error' }
        };

        const feedback = feedbackMap[feedbackType] || {};

        if (this.options.enableVibration && feedback.vibration && navigator.vibrate) {
            navigator.vibrate(feedback.vibration);
        }

        if (this.options.enableAudio && feedback.audio) {
            this.emit('audio-feedback', { type: feedback.audio, ...data });
        }
    }

    /**
     * Get macro statistics
     */
    getMacroStats() {
        const macros = Array.from(this.macros.values());

        return {
            totalMacros: macros.length,
            enabledMacros: macros.filter(m => m.enabled).length,
            totalExecutions: macros.reduce((sum, m) => sum + m.execCount, 0),
            averageGestureCount: macros.length > 0
                ? macros.reduce((sum, m) => sum + m.gestureCount, 0) / macros.length
                : 0,
            averageDuration: macros.length > 0
                ? macros.reduce((sum, m) => sum + m.duration, 0) / macros.length
                : 0,
            profiles: this.profiles.size,
            currentProfile: this.currentProfile
        };
    }

    /**
     * Get system status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            recording: this.recordingState.isRecording,
            recordingMacro: this.recordingState.macroName,
            currentProfile: this.currentProfile,
            macroCount: this.macros.size,
            profileCount: this.profiles.size,
            storageType: this.options.storageType,
            timestamp: Date.now()
        };
    }

    /**
     * Helper: sleep function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Event emitter
     */
    on(event, handler) {
        if (!this.eventEmitter[event]) {
            this.eventEmitter[event] = [];
        }
        this.eventEmitter[event].push(handler);
    }

    emit(event, data) {
        if (this.eventEmitter[event]) {
            this.eventEmitter[event].forEach(handler => handler(data));
        }
    }

    /**
     * Dispose
     */
    async dispose() {
        if (this.recordingState.recordTimer) {
            clearTimeout(this.recordingState.recordTimer);
        }
        if (this.options.enableAutoSave) {
            await this.saveMacros();
            await this.saveProfiles();
        }
    }
}

/**
 * LocalStorage storage manager
 */
class LocalStorageManager {
    constructor(namespace = 'vr') {
        this.namespace = namespace;
    }

    async save(key, data) {
        localStorage.setItem(`${this.namespace}:${key}`, JSON.stringify(data));
    }

    async load(key) {
        const data = localStorage.getItem(`${this.namespace}:${key}`);
        return data ? JSON.parse(data) : null;
    }

    async remove(key) {
        localStorage.removeItem(`${this.namespace}:${key}`);
    }

    async clear() {
        Object.keys(localStorage)
            .filter(k => k.startsWith(this.namespace))
            .forEach(k => localStorage.removeItem(k));
    }
}

/**
 * IndexedDB storage manager
 */
class IndexedDBStorage {
    constructor(dbName = 'vr-gestures', storeName = 'macros') {
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'key' });
                }
            };
        });
    }

    async save(key, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put({ key, data, timestamp: Date.now() });

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async load(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result?.data || null);
        });
    }

    async remove(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async clear() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VRGestureCustomization;
}

// Global registration
if (typeof window !== 'undefined') {
    window.VRGestureCustomization = VRGestureCustomization;
}
