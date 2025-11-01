/**
 * VR Module Loader & Integration Framework
 * Unified interface for all VR optimization modules
 *
 * @module vr-module-loader
 * @version 3.0.0
 *
 * Provides:
 * - Centralized module loading
 * - Initialization orchestration
 * - Performance monitoring
 * - Inter-module communication
 * - Graceful fallbacks
 */

class VRModuleLoader {
  constructor(options = {}) {
    this.config = {
      enableAllModules: options.enableAllModules !== false,
      debugMode: options.debugMode || false,
      performanceMonitoring: options.performanceMonitoring !== false,
    };

    // Module registry
    this.modules = new Map();
    this.moduleInstances = new Map();
    this.moduleStatus = new Map();
    this.initializationOrder = [
      'three-culling',
      'wcag-accessibility',
      'webgpu-ml',
      'gnn-gesture',
      'transformer-pose',
      'streaming-360',
      'webrtc-multiplayer',
    ];

    // Metrics
    this.metrics = {
      modulesLoaded: 0,
      modulesInitialized: 0,
      initializationTime: 0,
      moduleErrors: [],
    };

    this.log('VRModuleLoader initialized');
  }

  /**
   * Register module
   */
  registerModule(moduleName, ModuleClass, options = {}) {
    this.modules.set(moduleName, {
      class: ModuleClass,
      options,
      required: options.required || false,
      loadOrder: options.loadOrder || 999,
    });

    this.moduleStatus.set(moduleName, 'registered');
    this.log(`Module registered: ${moduleName}`);
  }

  /**
   * Initialize all registered modules
   */
  async initializeAll(scene, camera, renderer) {
    const startTime = performance.now();

    this.log('Starting module initialization...');

    // Sort by load order
    const sortedModules = Array.from(this.modules.entries())
      .sort((a, b) => a[1].loadOrder - b[1].loadOrder);

    // Initialize each module
    for (const [moduleName, moduleData] of sortedModules) {
      try {
        const instance = await this.initializeModule(
          moduleName,
          moduleData,
          scene,
          camera,
          renderer
        );

        if (instance) {
          this.moduleInstances.set(moduleName, instance);
          this.metrics.modulesInitialized++;
          this.moduleStatus.set(moduleName, 'initialized');
        }
      } catch (error) {
        this.handleModuleError(moduleName, error, moduleData.required);
      }
    }

    this.metrics.initializationTime = performance.now() - startTime;
    this.metrics.modulesLoaded = this.moduleInstances.size;

    this.log(
      `Initialization complete. ${this.metrics.modulesLoaded}/${this.modules.size} modules loaded in ${this.metrics.initializationTime.toFixed(2)}ms`
    );

    return this.getStatus();
  }

  /**
   * Initialize single module
   */
  async initializeModule(moduleName, moduleData, scene, camera, renderer) {
    try {
      this.moduleStatus.set(moduleName, 'initializing');

      const ModuleClass = moduleData.class;
      const options = {
        ...moduleData.options,
        scene,
        camera,
        renderer,
      };

      let instance;

      // Create module instance based on type
      switch (moduleName) {
        case 'three-culling':
          instance = new ModuleClass(scene, camera, renderer, options);
          break;

        case 'wcag-accessibility':
          instance = new ModuleClass(scene, camera, renderer, options);
          break;

        case 'webgpu-ml':
          instance = new ModuleClass(options);
          await instance.initialize();
          break;

        case 'gnn-gesture':
          instance = new ModuleClass(options);
          break;

        case 'transformer-pose':
          instance = new ModuleClass(options);
          await instance.initialize();
          break;

        case 'streaming-360':
          instance = new ModuleClass(options);
          break;

        case 'webrtc-multiplayer':
          instance = new ModuleClass(options);
          await instance.initialize();
          break;

        default:
          instance = new ModuleClass(options);
      }

      this.log(`✓ Module initialized: ${moduleName}`);
      return instance;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle module initialization errors
   */
  handleModuleError(moduleName, error, isRequired) {
    const message = `Module ${moduleName} failed: ${error.message}`;

    if (isRequired) {
      this.log(`✗ CRITICAL: ${message}`);
      this.metrics.moduleErrors.push({
        module: moduleName,
        error: error.message,
        severity: 'critical',
      });
      throw error;
    } else {
      this.log(`⚠ WARNING: ${message}`);
      this.metrics.moduleErrors.push({
        module: moduleName,
        error: error.message,
        severity: 'warning',
      });
      this.moduleStatus.set(moduleName, 'failed');
    }
  }

  /**
   * Get module instance
   */
  getModule(moduleName) {
    return this.moduleInstances.get(moduleName);
  }

  /**
   * Update all modules each frame
   */
  update(deltaTime, camera) {
    this.moduleInstances.forEach((instance, moduleName) => {
      try {
        if (typeof instance.update === 'function') {
          if (moduleName === 'streaming-360' || moduleName === '360-adaptive-streaming') {
            // Pass camera for viewport update
            instance.updateViewport?.(camera);
          } else {
            instance.update?.(deltaTime);
          }
        }
      } catch (error) {
        this.log(`Error updating ${moduleName}: ${error.message}`);
      }
    });
  }

  /**
   * Get combined metrics from all modules
   */
  getMetrics() {
    const allMetrics = {
      loader: { ...this.metrics },
      modules: {},
    };

    this.moduleInstances.forEach((instance, moduleName) => {
      try {
        if (typeof instance.getMetrics === 'function') {
          allMetrics.modules[moduleName] = instance.getMetrics();
        }
      } catch (error) {
        this.log(`Error getting metrics from ${moduleName}: ${error.message}`);
      }
    });

    return allMetrics;
  }

  /**
   * Get status of all modules
   */
  getStatus() {
    const status = {
      loaderReady: this.moduleInstances.size > 0,
      modulesLoaded: this.metrics.modulesLoaded,
      modulesTotal: this.modules.size,
      initializationTime: this.metrics.initializationTime,
      modules: {},
      errors: this.metrics.moduleErrors,
    };

    this.moduleStatus.forEach((moduleStatus, moduleName) => {
      status.modules[moduleName] = moduleStatus;
    });

    return status;
  }

  /**
   * Enable/disable module
   */
  setModuleActive(moduleName, active) {
    const instance = this.moduleInstances.get(moduleName);
    if (!instance) return;

    if (active && typeof instance.enable === 'function') {
      instance.enable();
    } else if (!active && typeof instance.disable === 'function') {
      instance.disable();
    }

    this.log(`Module ${moduleName} ${active ? 'enabled' : 'disabled'}`);
  }

  /**
   * Cleanup all modules
   */
  dispose() {
    this.moduleInstances.forEach((instance, moduleName) => {
      try {
        if (typeof instance.dispose === 'function') {
          instance.dispose();
        }
      } catch (error) {
        this.log(`Error disposing ${moduleName}: ${error.message}`);
      }
    });

    this.moduleInstances.clear();
    this.log('All modules disposed');
  }

  /**
   * Logging utility
   */
  log(message) {
    if (this.config.debugMode || this.config.performanceMonitoring) {
      console.log(`[VRModuleLoader] ${message}`);
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const metrics = this.getMetrics();
    const summary = {
      initializationTime: this.metrics.initializationTime,
      modulesReady: this.metrics.modulesInitialized,
      performance: {},
    };

    // Collect performance data from modules
    if (metrics.modules['three-culling']?.cullingTime) {
      summary.performance.cullingTime = metrics.modules['three-culling'].cullingTime;
    }

    if (metrics.modules['webgpu-ml']?.averageLatency) {
      summary.performance.mlInferenceLatency = metrics.modules['webgpu-ml'].averageLatency;
    }

    if (metrics.modules['transformer-pose']?.averageLatency) {
      summary.performance.poseEstimationLatency = metrics.modules['transformer-pose'].averageLatency;
    }

    if (metrics.modules['streaming-360']?.estimatedBandwidth) {
      summary.performance.bandwidth = metrics.modules['streaming-360'].estimatedBandwidth;
    }

    if (metrics.modules['webrtc-multiplayer']?.averageLatency) {
      summary.performance.networkLatency = metrics.modules['webrtc-multiplayer'].averageLatency;
    }

    return summary;
  }
}

/**
 * Factory function to create and initialize all modules
 */
async function createVRModuleLoader(scene, camera, renderer, options = {}) {
  const loader = new VRModuleLoader(options);

  // Register all modules
  const moduleConfig = [
    {
      name: 'three-culling',
      class: 'VRThreeJSAdvancedCulling',
      required: true,
      options: { performanceMonitoring: true },
    },
    {
      name: 'wcag-accessibility',
      class: 'VRWCAG3Accessibility',
      required: false,
      options: { enableScreenReader: true },
    },
    {
      name: 'webgpu-ml',
      class: 'VRWebGPUMLInference',
      required: false,
      options: { useGPU: true },
    },
    {
      name: 'gnn-gesture',
      class: 'VRGNNGestureRecognition',
      required: false,
      options: { performanceMonitoring: true },
    },
    {
      name: 'transformer-pose',
      class: 'VRTransformerHandPose',
      required: false,
      options: { useGPU: true },
    },
    {
      name: 'streaming-360',
      class: 'VR360AdaptiveStreaming',
      required: false,
      options: { protocol: 'dash' },
    },
    {
      name: 'webrtc-multiplayer',
      class: 'VRWebRTCMultiplayer',
      required: false,
      options: { enableCRDT: true },
    },
  ];

  // Register modules
  for (const config of moduleConfig) {
    try {
      // Dynamically get class from global scope
      const ModuleClass = window[config.class] || globalThis[config.class];

      if (!ModuleClass) {
        console.warn(`Module class not found: ${config.class}`);
        continue;
      }

      loader.registerModule(config.name, ModuleClass, {
        ...config.options,
        required: config.required,
      });
    } catch (error) {
      console.error(`Failed to register module ${config.name}:`, error);
    }
  }

  // Initialize all modules
  await loader.initializeAll(scene, camera, renderer);

  return loader;
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VRModuleLoader, createVRModuleLoader };
}

// Make available globally in browser
if (typeof window !== 'undefined') {
  window.VRModuleLoader = VRModuleLoader;
  window.createVRModuleLoader = createVRModuleLoader;
}
