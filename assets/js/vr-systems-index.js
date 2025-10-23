/**
 * VR Systems Index - Central export point for all unified VR systems
 * @version 3.2.0
 *
 * This file provides a single entry point to access all unified VR systems.
 * Import this file to get access to all VR functionality.
 *
 * Usage:
 *   <script src="/assets/js/vr-systems-index.js"></script>
 *
 * All systems are available globally:
 *   - window.UnifiedPerformanceSystem
 *   - window.UnifiedSecuritySystem
 *   - window.UnifiedErrorHandler
 *   - window.UnifiedVRExtensionSystem
 *   - window.VRUISystem
 *   - window.VRInputSystem
 *   - window.VRNavigationSystem
 *   - window.VRMediaSystem
 *   - window.VRSystemMonitor
 *   - window.VRLauncher
 *   - window.VRUtils
 *   - window.VRSettings
 */

(function() {
    'use strict';

    // VR Systems Registry
    const VRSystems = {
        version: '3.2.0',
        initialized: false,
        systems: {},
        loadQueue: [],
        readyCallbacks: []
    };

    /**
     * System definitions with dependencies
     */
    const SYSTEM_DEFINITIONS = {
        // Core utilities (no dependencies)
        'VRUtils': {
            file: 'vr-utils.js',
            dependencies: [],
            description: 'Vector math, quaternions, utilities'
        },

        // Core VR launcher (depends on utils)
        'VRLauncher': {
            file: 'vr-launcher.js',
            dependencies: ['VRUtils'],
            description: 'WebXR session management'
        },

        // Settings system
        'VRSettings': {
            file: 'vr-settings.js',
            dependencies: [],
            description: 'User preferences and configuration'
        },

        // Unified systems (depend on core)
        'UnifiedPerformanceSystem': {
            file: 'unified-performance-system.js',
            dependencies: ['VRUtils'],
            description: 'FPS monitoring, dynamic quality adjustment'
        },

        'UnifiedSecuritySystem': {
            file: 'unified-security-system.js',
            dependencies: [],
            description: 'Encryption, sanitization, CSP'
        },

        'UnifiedErrorHandler': {
            file: 'unified-error-handler.js',
            dependencies: [],
            description: 'Global error handling and recovery'
        },

        'UnifiedVRExtensionSystem': {
            file: 'unified-vr-extension-system.js',
            dependencies: ['UnifiedSecuritySystem'],
            description: 'Extension management and sandboxing'
        },

        // VR-specific systems (depend on THREE.js)
        'VRUISystem': {
            file: 'vr-ui-system.js',
            dependencies: ['VRUtils'],
            description: 'Text rendering, ergonomic UI, themes',
            requiresTHREE: true
        },

        'VRInputSystem': {
            file: 'vr-input-system.js',
            dependencies: ['VRUtils'],
            description: 'Gestures, hand tracking, keyboard',
            requiresTHREE: true
        },

        'VRNavigationSystem': {
            file: 'vr-navigation-system.js',
            dependencies: ['VRUtils', 'VRUISystem'],
            description: 'Tabs, bookmarks, spatial navigation',
            requiresTHREE: true
        },

        'VRMediaSystem': {
            file: 'vr-media-system.js',
            dependencies: ['VRUtils'],
            description: 'Spatial audio, video player, WebGPU',
            requiresTHREE: true
        },

        'VRSystemMonitor': {
            file: 'vr-system-monitor.js',
            dependencies: [],
            description: 'Battery, network, usage statistics'
        }
    };

    /**
     * Load a system script
     */
    function loadSystem(systemName) {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (window[systemName]) {
                resolve(window[systemName]);
                return;
            }

            const def = SYSTEM_DEFINITIONS[systemName];
            if (!def) {
                reject(new Error(`System ${systemName} not found`));
                return;
            }

            // Check if THREE.js is required but not loaded
            if (def.requiresTHREE && typeof THREE === 'undefined') {
                console.warn(`${systemName} requires THREE.js, deferring load`);
                // Listen for THREE.js load
                window.addEventListener('three-loaded', () => {
                    loadSystem(systemName).then(resolve).catch(reject);
                }, { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = `/assets/js/${def.file}`;
            script.async = true;

            script.onload = () => {
                VRSystems.systems[systemName] = window[systemName];
                console.info(`✅ Loaded: ${systemName} - ${def.description}`);
                resolve(window[systemName]);
            };

            script.onerror = () => {
                reject(new Error(`Failed to load ${systemName}`));
            };

            document.head.appendChild(script);
        });
    }

    /**
     * Load a system with its dependencies
     */
    async function loadSystemWithDeps(systemName) {
        const def = SYSTEM_DEFINITIONS[systemName];
        if (!def) {
            throw new Error(`System ${systemName} not found`);
        }

        // Load dependencies first
        for (const dep of def.dependencies) {
            if (!window[dep]) {
                await loadSystemWithDeps(dep);
            }
        }

        // Load the system itself
        return await loadSystem(systemName);
    }

    /**
     * Initialize all VR systems
     */
    async function initializeAll() {
        if (VRSystems.initialized) {
            console.warn('VR Systems already initialized');
            return;
        }

        console.info('🚀 Initializing VR Systems...');

        const startTime = performance.now();

        // Load systems in dependency order
        const loadOrder = [
            // Core utilities first
            'VRUtils',
            'VRSettings',

            // Core systems
            'UnifiedSecuritySystem',
            'UnifiedErrorHandler',
            'UnifiedPerformanceSystem',

            // VR launcher
            'VRLauncher',

            // Advanced systems (will wait for THREE.js if needed)
            'VRUISystem',
            'VRInputSystem',
            'VRNavigationSystem',
            'VRMediaSystem',
            'VRSystemMonitor',
            'UnifiedVRExtensionSystem'
        ];

        try {
            for (const systemName of loadOrder) {
                await loadSystemWithDeps(systemName);
            }

            const endTime = performance.now();
            const loadTime = (endTime - startTime).toFixed(2);

            VRSystems.initialized = true;

            console.info(`✅ All VR Systems initialized in ${loadTime}ms`);
            console.info(`📊 Loaded ${Object.keys(VRSystems.systems).length} systems`);

            // Trigger ready callbacks
            VRSystems.readyCallbacks.forEach(callback => {
                try {
                    callback(VRSystems);
                } catch (error) {
                    console.error('Error in ready callback:', error);
                }
            });

            // Dispatch global event
            window.dispatchEvent(new CustomEvent('vr-systems-ready', {
                detail: { systems: VRSystems, loadTime }
            }));

        } catch (error) {
            console.error('❌ Failed to initialize VR Systems:', error);
            throw error;
        }
    }

    /**
     * Load specific systems on demand
     */
    async function loadSystems(systemNames) {
        const systems = Array.isArray(systemNames) ? systemNames : [systemNames];
        const loaded = {};

        for (const name of systems) {
            try {
                loaded[name] = await loadSystemWithDeps(name);
            } catch (error) {
                console.error(`Failed to load ${name}:`, error);
                loaded[name] = null;
            }
        }

        return loaded;
    }

    /**
     * Register a callback for when all systems are ready
     */
    function onReady(callback) {
        if (VRSystems.initialized) {
            callback(VRSystems);
        } else {
            VRSystems.readyCallbacks.push(callback);
        }
    }

    /**
     * Get system information
     */
    function getSystemInfo() {
        return {
            version: VRSystems.version,
            initialized: VRSystems.initialized,
            loadedSystems: Object.keys(VRSystems.systems),
            availableSystems: Object.keys(SYSTEM_DEFINITIONS),
            systemDefinitions: SYSTEM_DEFINITIONS
        };
    }

    /**
     * Check if a system is loaded
     */
    function isSystemLoaded(systemName) {
        return !!window[systemName];
    }

    /**
     * Get a loaded system
     */
    function getSystem(systemName) {
        return window[systemName] || null;
    }

    // Export API
    window.VRSystems = {
        version: VRSystems.version,

        // Initialization
        initializeAll,
        loadSystems,
        onReady,

        // System info
        getSystemInfo,
        isSystemLoaded,
        getSystem,

        // System definitions
        definitions: SYSTEM_DEFINITIONS
    };

    // Auto-initialize if data-auto-init attribute is present
    const currentScript = document.currentScript;
    if (currentScript && currentScript.hasAttribute('data-auto-init')) {
        // Defer to ensure DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeAll);
        } else {
            initializeAll();
        }
    }

    console.log('✅ VR Systems Index loaded');
    console.log('📖 Usage: VRSystems.initializeAll() or VRSystems.loadSystems(["VRUISystem"])');
})();
