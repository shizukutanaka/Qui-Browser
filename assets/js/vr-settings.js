/**
 * VR Settings - Configuration and preferences management for VR experience
 * Handles user preferences, device settings, and configuration persistence
 * @version 3.2.0
 */

class VRSettings {
    constructor() {
        this.STORAGE_KEY = 'vr-settings-v3';

        // Default settings
        this.defaults = {
            // Display settings
            display: {
                ipd: 63,                    // Inter-pupillary distance in mm
                brightness: 1.0,            // 0.5 to 1.5
                contrast: 1.0,              // 0.5 to 1.5
                renderScale: 1.0,           // 0.5 to 1.5 (affects resolution)
                foveatedRendering: true,    // Optimize peripheral rendering
                antialiasing: 'medium'      // 'off' | 'low' | 'medium' | 'high'
            },

            // Comfort settings
            comfort: {
                tunnelVision: false,        // Reduce motion sickness
                snapRotation: true,         // Discrete rotation instead of smooth
                snapRotationAngle: 30,      // Degrees per snap
                teleportMovement: false,    // Teleport instead of smooth movement
                comfortVignette: false,     // Add vignette during movement
                reducedMotion: false        // Minimize animations
            },

            // Control settings
            controls: {
                handedness: 'right',        // 'left' | 'right' | 'both'
                pointerColor: '#00ff00',    // Laser pointer color
                pointerThickness: 2,        // Pointer line thickness
                hapticFeedback: true,       // Controller vibration
                hapticIntensity: 0.5,       // 0 to 1
                gestureRecognition: true,   // Enable hand gestures
                voiceCommands: false        // Enable voice control
            },

            // Performance settings
            performance: {
                targetFPS: 90,              // Target frame rate
                dynamicResolution: true,    // Auto-adjust resolution
                shadowQuality: 'medium',    // 'off' | 'low' | 'medium' | 'high'
                textureQuality: 'high',     // 'low' | 'medium' | 'high' | 'ultra'
                particleEffects: true,      // Enable particle systems
                postProcessing: true,       // Enable post-processing effects
                maxDrawDistance: 100        // Maximum render distance in meters
            },

            // Audio settings
            audio: {
                masterVolume: 0.8,          // 0 to 1
                spatialAudio: true,         // 3D positional audio
                voiceVolume: 1.0,           // Voice chat volume
                effectsVolume: 0.7,         // Sound effects volume
                musicVolume: 0.5,           // Background music volume
                audioDevice: 'default'      // Audio output device
            },

            // UI settings
            ui: {
                theme: 'dark',              // 'light' | 'dark' | 'auto'
                curvedUI: true,             // Curved UI panels
                uiDistance: 2.0,            // UI distance in meters
                uiScale: 1.0,               // UI scale factor
                fontSize: 'medium',         // 'small' | 'medium' | 'large' | 'xlarge'
                showFPS: false,             // Show FPS counter
                showStats: false,           // Show performance stats
                language: 'ja'              // Interface language
            },

            // Accessibility settings
            accessibility: {
                colorBlindMode: 'none',     // 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia'
                subtitles: false,           // Show subtitles
                subtitleSize: 'medium',     // 'small' | 'medium' | 'large'
                highContrast: false,        // High contrast mode
                screenReader: false,        // Screen reader support
                reducedTransparency: false, // Reduce transparent effects
                motionSensitivity: 'normal' // 'low' | 'normal' | 'high'
            },

            // Privacy settings
            privacy: {
                telemetry: false,           // Send usage analytics
                crashReports: true,         // Send crash reports
                sharePlayspace: false,      // Share play area data
                recordSession: false,       // Allow session recording
                socialFeatures: true        // Enable social features
            },

            // Experimental features
            experimental: {
                eyeTracking: false,         // Use eye tracking if available
                brainInterface: false,      // BCI support (future)
                neuralRendering: false,     // AI-enhanced rendering
                handPhysics: false,         // Physics-based hand interactions
                fullBodyTracking: false     // Full body tracking support
            }
        };

        this.settings = this.loadSettings();
        this.callbacks = new Map();
        this.init();
    }

    init() {
        // Set up save debouncing
        this.saveDebounced = this.debounce(() => this.saveSettings(), 1000);

        // Listen for device changes
        this.detectDeviceCapabilities();

        // Set up settings UI
        this.createSettingsUI();

        console.info('✅ VR Settings initialized');
    }

    loadSettings() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Deep merge with defaults to handle new settings
                return this.deepMerge(this.defaults, parsed);
            }
        } catch (error) {
            console.warn('Failed to load VR settings:', error);
        }
        return JSON.parse(JSON.stringify(this.defaults));
    }

    saveSettings() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
            console.info('VR Settings saved');
            this.notifyCallbacks('save');
        } catch (error) {
            console.error('Failed to save VR settings:', error);
        }
    }

    get(path) {
        const keys = path.split('.');
        let value = this.settings;

        for (const key of keys) {
            value = value?.[key];
            if (value === undefined) {
                // Return from defaults if not found
                let defaultValue = this.defaults;
                for (const key of keys) {
                    defaultValue = defaultValue?.[key];
                }
                return defaultValue;
            }
        }

        return value;
    }

    set(path, value) {
        const keys = path.split('.');
        let target = this.settings;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!target[key] || typeof target[key] !== 'object') {
                target[key] = {};
            }
            target = target[key];
        }

        const lastKey = keys[keys.length - 1];
        const oldValue = target[lastKey];
        target[lastKey] = value;

        // Validate and apply constraints
        this.validateSetting(path, value);

        // Notify listeners
        this.notifyCallbacks('change', { path, value, oldValue });

        // Save (debounced)
        this.saveDebounced();

        return true;
    }

    validateSetting(path, value) {
        // Apply constraints based on setting type
        switch (path) {
            case 'display.ipd':
                this.settings.display.ipd = Math.max(50, Math.min(75, value));
                break;
            case 'display.brightness':
            case 'display.contrast':
                const displayKey = path.split('.')[1];
                this.settings.display[displayKey] = Math.max(0.5, Math.min(1.5, value));
                break;
            case 'performance.targetFPS':
                this.settings.performance.targetFPS = [60, 72, 80, 90, 120].includes(value) ? value : 90;
                break;
            case 'controls.hapticIntensity':
            case 'audio.masterVolume':
                const [category, key] = path.split('.');
                this.settings[category][key] = Math.max(0, Math.min(1, value));
                break;
        }
    }

    reset(category = null) {
        if (category) {
            if (this.defaults[category]) {
                this.settings[category] = JSON.parse(JSON.stringify(this.defaults[category]));
                this.notifyCallbacks('reset', { category });
            }
        } else {
            this.settings = JSON.parse(JSON.stringify(this.defaults));
            this.notifyCallbacks('reset', { category: 'all' });
        }
        this.saveSettings();
    }

    detectDeviceCapabilities() {
        // Detect and adjust settings based on device capabilities
        if ('xr' in navigator) {
            navigator.xr.isSessionSupported('immersive-vr').then(supported => {
                if (supported) {
                    // Check for specific features
                    this.checkFeatureSupport();
                }
            });
        }
    }

    async checkFeatureSupport() {
        try {
            // Test for hand tracking
            const testSession = await navigator.xr.requestSession('immersive-vr', {
                optionalFeatures: ['hand-tracking']
            });
            this.settings.controls.gestureRecognition = true;
            await testSession.end();
        } catch (e) {
            this.settings.controls.gestureRecognition = false;
        }

        // Check for eye tracking (future)
        // this.settings.experimental.eyeTracking = await this.checkEyeTracking();
    }

    createSettingsUI() {
        // Create settings panel (will be rendered in VR)
        const panel = document.createElement('div');
        panel.id = 'vr-settings-panel';
        panel.className = 'vr-settings-panel';
        panel.style.display = 'none';

        // This will be populated when settings UI is opened
        panel.innerHTML = `
            <div class="vr-settings-header">
                <h2>VR Settings</h2>
                <button class="vr-settings-close">✕</button>
            </div>
            <div class="vr-settings-tabs">
                <button class="vr-settings-tab active" data-tab="display">Display</button>
                <button class="vr-settings-tab" data-tab="comfort">Comfort</button>
                <button class="vr-settings-tab" data-tab="controls">Controls</button>
                <button class="vr-settings-tab" data-tab="performance">Performance</button>
                <button class="vr-settings-tab" data-tab="audio">Audio</button>
                <button class="vr-settings-tab" data-tab="accessibility">Accessibility</button>
            </div>
            <div class="vr-settings-content" id="vr-settings-content">
                <!-- Settings will be dynamically generated here -->
            </div>
            <div class="vr-settings-footer">
                <button class="vr-settings-reset">Reset to Defaults</button>
                <button class="vr-settings-apply">Apply Changes</button>
            </div>
        `;

        document.body.appendChild(panel);
    }

    showSettings() {
        const panel = document.getElementById('vr-settings-panel');
        if (panel) {
            panel.style.display = 'block';
            this.renderSettingsTab('display');
        }
    }

    hideSettings() {
        const panel = document.getElementById('vr-settings-panel');
        if (panel) {
            panel.style.display = 'none';
        }
    }

    renderSettingsTab(tabName) {
        const content = document.getElementById('vr-settings-content');
        if (!content) return;

        const settings = this.settings[tabName];
        if (!settings) return;

        let html = '';

        for (const [key, value] of Object.entries(settings)) {
            const settingPath = `${tabName}.${key}`;
            const inputId = `setting-${tabName}-${key}`;

            html += `<div class="vr-setting-item">`;
            html += `<label for="${inputId}">${this.formatLabel(key)}</label>`;

            if (typeof value === 'boolean') {
                html += `<input type="checkbox" id="${inputId}"
                    ${value ? 'checked' : ''}
                    data-path="${settingPath}">`;
            } else if (typeof value === 'number') {
                html += `<input type="range" id="${inputId}"
                    value="${value}"
                    min="0" max="2" step="0.1"
                    data-path="${settingPath}">
                    <span>${value}</span>`;
            } else if (typeof value === 'string') {
                if (key.includes('Color')) {
                    html += `<input type="color" id="${inputId}"
                        value="${value}"
                        data-path="${settingPath}">`;
                } else {
                    html += `<select id="${inputId}" data-path="${settingPath}">
                        <option value="${value}">${value}</option>
                    </select>`;
                }
            }

            html += `</div>`;
        }

        content.innerHTML = html;
    }

    formatLabel(key) {
        // Convert camelCase to readable format
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }

    onChange(callback) {
        const id = Date.now();
        this.callbacks.set(id, callback);
        return () => this.callbacks.delete(id);
    }

    notifyCallbacks(event, data) {
        for (const callback of this.callbacks.values()) {
            try {
                callback(event, data);
            } catch (error) {
                console.error('Settings callback error:', error);
            }
        }
    }

    deepMerge(target, source) {
        const output = { ...target };

        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (key in target) {
                    output[key] = this.deepMerge(target[key], source[key]);
                } else {
                    output[key] = source[key];
                }
            } else {
                output[key] = source[key];
            }
        }

        return output;
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Export/Import settings
    exportSettings() {
        return JSON.stringify(this.settings, null, 2);
    }

    importSettings(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            this.settings = this.deepMerge(this.defaults, imported);
            this.saveSettings();
            this.notifyCallbacks('import');
            return true;
        } catch (error) {
            console.error('Failed to import settings:', error);
            return false;
        }
    }

    // Quick access methods
    getIPD() {
        return this.get('display.ipd');
    }

    setIPD(value) {
        return this.set('display.ipd', value);
    }

    getPerformanceMode() {
        const fps = this.get('performance.targetFPS');
        if (fps >= 90) return 'quality';
        if (fps >= 72) return 'balanced';
        return 'performance';
    }

    isComfortModeEnabled() {
        return this.get('comfort.tunnelVision') ||
               this.get('comfort.teleportMovement') ||
               this.get('comfort.comfortVignette');
    }
}

// Add styles
const style = document.createElement('style');
style.textContent = `
    .vr-settings-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 600px;
        max-height: 80vh;
        background: #1a1a1a;
        color: white;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        z-index: 10000;
        overflow: hidden;
    }

    .vr-settings-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        background: #2a2a2a;
        border-bottom: 1px solid #444;
    }

    .vr-settings-tabs {
        display: flex;
        gap: 10px;
        padding: 10px 20px;
        background: #222;
        overflow-x: auto;
    }

    .vr-settings-tab {
        padding: 8px 16px;
        background: #333;
        color: #aaa;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .vr-settings-tab.active {
        background: #4a9eff;
        color: white;
    }

    .vr-settings-content {
        padding: 20px;
        max-height: 400px;
        overflow-y: auto;
    }

    .vr-setting-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid #333;
    }

    .vr-settings-footer {
        display: flex;
        justify-content: space-between;
        padding: 20px;
        background: #2a2a2a;
        border-top: 1px solid #444;
    }
`;
document.head.appendChild(style);

// Initialize and export
window.VRSettings = new VRSettings();

console.log('✅ VR Settings loaded');