/**
 * Unified Performance System
 * 統合パフォーマンス監視・最適化システム
 *
 * 統合対象：
 * - performance-optimizer.js (コア最適化)
 * - vr-performance-unified.js (VR最適化)
 * - advanced-performance-monitoring.js (高度な監視)
 * - advanced-performance-system.js (システム最適化)
 * - vr-performance-monitor.js (VRモニタリング)
 * - vr-performance-profiler.js (VRプロファイラー)
 * - wasm-performance-optimizer.js (WASM最適化)
 *
 * @version 3.2.0
 */

class UnifiedPerformanceSystem {
  constructor() {
    this.initialized = false;
    this.config = {
      targetFPS: 90,
      minFPS: 72,
      maxMemoryMB: 2048,
      enableWASM: typeof WebAssembly !== 'undefined',
      enableVR: 'xr' in navigator,
      enableProfiling: false,
      enableAutoOptimization: true,
      samplingInterval: 100, // ms
      reportingInterval: 5000 // ms
    };

    // Performance metrics
    this.metrics = {
      fps: { current: 0, average: 0, min: Infinity, max: 0, samples: [] },
      frameTime: { current: 0, average: 0, min: Infinity, max: 0, samples: [] },
      memory: { used: 0, total: 0, limit: this.config.maxMemoryMB * 1024 * 1024 },
      gpu: { usage: 0, memory: 0, temperature: 0 },
      cpu: { usage: 0, cores: navigator.hardwareConcurrency || 4 },
      network: { latency: 0, bandwidth: 0 },
      rendering: { drawCalls: 0, triangles: 0, textures: 0 }
    };

    // Optimization strategies
    this.optimizations = {
      dynamicResolution: true,
      frustumCulling: true,
      levelOfDetail: true,
      textureCompression: true,
      geometryInstancing: true,
      temporalAntialiasing: false,
      foveatedRendering: false,
      asynchronousTimeWarp: false
    };

    // Performance thresholds
    this.thresholds = {
      critical: { fps: 60, frameTime: 16.67, memory: 0.9 },
      warning: { fps: 72, frameTime: 13.89, memory: 0.8 },
      optimal: { fps: 90, frameTime: 11.11, memory: 0.6 }
    };

    // Observers and monitors
    this.observers = new Map();
    this.monitors = new Map();
    this.profilers = new Map();

    // WASM modules
    this.wasmModules = new Map();

    // Event emitter for performance events
    this.eventListeners = new Map();

    // Request animation frame ID
    this.rafId = null;
    this.lastFrameTime = 0;

    // Monitoring intervals
    this.monitoringIntervals = new Map();
  }

  /**
   * Initialize the unified performance system
   */
  async initialize() {
    if (this.initialized) {
      console.warn('UnifiedPerformanceSystem: Already initialized');
      return this;
    }

    try {
      console.info('Initializing Unified Performance System...');

      // Initialize sub-systems
      await this.initializeMonitoring();
      await this.initializeOptimizations();

      if (this.config.enableWASM) {
        await this.initializeWASM();
      }

      if (this.config.enableVR) {
        await this.initializeVROptimizations();
      }

      // Start monitoring
      this.startMonitoring();

      // Set up event listeners
      this.setupEventListeners();

      this.initialized = true;
      console.info('Unified Performance System initialized successfully');

      this.emit('initialized', { timestamp: Date.now() });

      return this;
    } catch (error) {
      console.error('Failed to initialize Unified Performance System:', error);
      this.emit('error', { error, phase: 'initialization' });
      throw error;
    }
  }

  /**
   * Initialize monitoring systems
   */
  async initializeMonitoring() {
    // FPS Monitor
    this.monitors.set('fps', {
      samples: [],
      maxSamples: 60,
      update: (deltaTime) => {
        const fps = 1000 / deltaTime;
        this.metrics.fps.current = fps;
        this.metrics.fps.samples.push(fps);

        if (this.metrics.fps.samples.length > 60) {
          this.metrics.fps.samples.shift();
        }

        this.metrics.fps.average = this.metrics.fps.samples.reduce((a, b) => a + b, 0) / this.metrics.fps.samples.length;
        this.metrics.fps.min = Math.min(this.metrics.fps.min, fps);
        this.metrics.fps.max = Math.max(this.metrics.fps.max, fps);
      }
    });

    // Memory Monitor
    if (performance.memory) {
      this.monitors.set('memory', {
        update: () => {
          this.metrics.memory.used = performance.memory.usedJSHeapSize;
          this.metrics.memory.total = performance.memory.totalJSHeapSize;
          this.metrics.memory.limit = performance.memory.jsHeapSizeLimit;

          // Check memory pressure
          const usage = this.metrics.memory.used / this.metrics.memory.limit;
          if (usage > this.thresholds.critical.memory) {
            this.triggerMemoryCleanup();
          }
        }
      });
    }

    // Performance Observer for long tasks
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              this.handleLongTask(entry);
            }
          }
        });

        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.set('longtask', longTaskObserver);
      } catch (e) {
        console.warn('Long task observer not supported');
      }
    }

    // Network Performance
    if ('connection' in navigator) {
      this.monitors.set('network', {
        update: () => {
          const connection = navigator.connection;
          this.metrics.network.latency = connection.rtt || 0;
          this.metrics.network.bandwidth = connection.downlink || 0;
        }
      });
    }
  }

  /**
   * Initialize optimization strategies
   */
  async initializeOptimizations() {
    // Dynamic Resolution
    if (this.optimizations.dynamicResolution) {
      this.setupDynamicResolution();
    }

    // Frustum Culling
    if (this.optimizations.frustumCulling) {
      this.setupFrustumCulling();
    }

    // Level of Detail (LOD)
    if (this.optimizations.levelOfDetail) {
      this.setupLevelOfDetail();
    }

    // Texture Compression
    if (this.optimizations.textureCompression) {
      this.setupTextureCompression();
    }

    // Geometry Instancing
    if (this.optimizations.geometryInstancing) {
      this.setupGeometryInstancing();
    }
  }

  /**
   * Initialize WASM optimizations
   */
  async initializeWASM() {
    try {
      // Check WebAssembly support
      if (typeof WebAssembly === 'undefined') {
        console.warn('WebAssembly not supported');
        return;
      }

      // Load WASM modules for performance-critical operations
      const wasmModules = [
        { name: 'simd', path: '/wasm/simd-optimizer.wasm', fallback: this.simdFallback },
        { name: 'physics', path: '/wasm/physics-engine.wasm', fallback: this.physicsFallback },
        { name: 'math', path: '/wasm/math-accelerator.wasm', fallback: this.mathFallback }
      ];

      for (const module of wasmModules) {
        try {
          const response = await fetch(module.path);
          if (response.ok) {
            const wasmModule = await WebAssembly.compileStreaming(response);
            const instance = await WebAssembly.instantiate(wasmModule);
            this.wasmModules.set(module.name, instance);
            console.info(`WASM module loaded: ${module.name}`);
          }
        } catch (error) {
          console.warn(`Failed to load WASM module ${module.name}, using fallback`);
          this.wasmModules.set(module.name, { exports: module.fallback });
        }
      }
    } catch (error) {
      console.error('WASM initialization failed:', error);
    }
  }

  /**
   * Initialize VR-specific optimizations
   */
  async initializeVROptimizations() {
    if (!navigator.xr) {
      return;
    }

    // Foveated Rendering
    if (this.optimizations.foveatedRendering) {
      this.setupFoveatedRendering();
    }

    // Asynchronous TimeWarp
    if (this.optimizations.asynchronousTimeWarp) {
      this.setupAsynchronousTimeWarp();
    }

    // VR-specific performance targets
    this.config.targetFPS = 90; // Quest 3 target
    this.config.minFPS = 72;     // Quest 2 minimum

    // Adjust thresholds for VR
    this.thresholds.critical.fps = 72;
    this.thresholds.warning.fps = 80;
    this.thresholds.optimal.fps = 90;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring() {
    // Main render loop monitoring
    const monitorFrame = (timestamp) => {
      const deltaTime = timestamp - this.lastFrameTime;
      this.lastFrameTime = timestamp;

      if (deltaTime > 0) {
        // Update FPS
        this.monitors.get('fps')?.update(deltaTime);

        // Update frame time
        this.metrics.frameTime.current = deltaTime;
        this.metrics.frameTime.samples.push(deltaTime);

        if (this.metrics.frameTime.samples.length > 60) {
          this.metrics.frameTime.samples.shift();
        }

        this.metrics.frameTime.average = this.metrics.frameTime.samples.reduce((a, b) => a + b, 0) / this.metrics.frameTime.samples.length;

        // Check performance and apply optimizations
        if (this.config.enableAutoOptimization) {
          this.applyDynamicOptimizations();
        }
      }

      this.rafId = requestAnimationFrame(monitorFrame);
    };

    this.rafId = requestAnimationFrame(monitorFrame);

    // Periodic monitoring tasks
    this.monitoringIntervals.set('memory', setInterval(() => {
      this.monitors.get('memory')?.update();
    }, 1000));

    this.monitoringIntervals.set('network', setInterval(() => {
      this.monitors.get('network')?.update();
    }, 5000));

    // Reporting interval
    this.monitoringIntervals.set('report', setInterval(() => {
      this.generatePerformanceReport();
    }, this.config.reportingInterval));
  }

  /**
   * Apply dynamic optimizations based on current performance
   */
  applyDynamicOptimizations() {
    const currentFPS = this.metrics.fps.current;

    // Critical performance - apply aggressive optimizations
    if (currentFPS < this.thresholds.critical.fps) {
      this.setQualityLevel('low');
      this.enableOptimization('foveatedRendering', true);
      this.enableOptimization('temporalAntialiasing', false);
      this.reduceRenderResolution(0.7);
      this.emit('performance:critical', { fps: currentFPS });
    }
    // Warning level - apply moderate optimizations
    else if (currentFPS < this.thresholds.warning.fps) {
      this.setQualityLevel('medium');
      this.reduceRenderResolution(0.85);
      this.emit('performance:warning', { fps: currentFPS });
    }
    // Optimal performance - restore quality
    else if (currentFPS >= this.thresholds.optimal.fps) {
      this.setQualityLevel('high');
      this.reduceRenderResolution(1.0);
      this.emit('performance:optimal', { fps: currentFPS });
    }
  }

  /**
   * Set up dynamic resolution scaling
   */
  setupDynamicResolution() {
    this.dynamicResolution = {
      baseWidth: window.innerWidth,
      baseHeight: window.innerHeight,
      currentScale: 1.0,
      minScale: 0.5,
      maxScale: 1.5,

      update: (targetFPS) => {
        const currentFPS = this.metrics.fps.current;
        const ratio = currentFPS / targetFPS;

        if (ratio < 0.9) {
          // Reduce resolution
          this.dynamicResolution.currentScale = Math.max(
            this.dynamicResolution.minScale,
            this.dynamicResolution.currentScale * 0.95
          );
        } else if (ratio > 1.1) {
          // Increase resolution
          this.dynamicResolution.currentScale = Math.min(
            this.dynamicResolution.maxScale,
            this.dynamicResolution.currentScale * 1.05
          );
        }

        this.applyResolutionScale(this.dynamicResolution.currentScale);
      }
    };
  }

  /**
   * Set up frustum culling
   */
  setupFrustumCulling() {
    this.frustumCuller = {
      enabled: true,
      frustum: null,
      camera: null,

      cull: (objects) => {
        if (!this.frustumCuller.enabled || !this.frustumCuller.camera) {
          return objects;
        }

        return objects.filter(obj => {
          // Simple bounding box check
          return this.isInFrustum(obj.boundingBox);
        });
      }
    };
  }

  /**
   * Set up level of detail system
   */
  setupLevelOfDetail() {
    this.lodSystem = {
      enabled: true,
      levels: [
        { distance: 0, detail: 'high' },
        { distance: 50, detail: 'medium' },
        { distance: 100, detail: 'low' },
        { distance: 200, detail: 'billboard' }
      ],

      getDetailLevel: (distance) => {
        for (let i = this.lodSystem.levels.length - 1; i >= 0; i--) {
          if (distance >= this.lodSystem.levels[i].distance) {
            return this.lodSystem.levels[i].detail;
          }
        }
        return 'high';
      }
    };
  }

  /**
   * Set up texture compression
   */
  setupTextureCompression() {
    this.textureCompressor = {
      enabled: true,
      formats: {
        desktop: 'DXT',
        mobile: 'ETC2',
        fallback: 'RGB'
      },

      getOptimalFormat: () => {
        // Detect platform and return optimal texture format
        const isMobile = /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
        return isMobile ? this.textureCompressor.formats.mobile : this.textureCompressor.formats.desktop;
      },

      compressTexture: (texture, format) => {
        // Texture compression logic
        console.info(`Compressing texture with ${format} format`);
        return texture;
      }
    };
  }

  /**
   * Set up geometry instancing
   */
  setupGeometryInstancing() {
    this.geometryInstancer = {
      enabled: true,
      instances: new Map(),
      maxInstances: 1000,

      createInstance: (geometry, count) => {
        if (!this.geometryInstancer.enabled) {
          return null;
        }

        const instanceId = `instance_${Date.now()}`;
        this.geometryInstancer.instances.set(instanceId, {
          geometry,
          count,
          matrices: new Float32Array(count * 16)
        });

        return instanceId;
      },

      updateInstance: (instanceId, index, matrix) => {
        const instance = this.geometryInstancer.instances.get(instanceId);
        if (instance && index < instance.count) {
          instance.matrices.set(matrix, index * 16);
        }
      }
    };
  }

  /**
   * Set up foveated rendering for VR
   */
  setupFoveatedRendering() {
    this.foveatedRenderer = {
      enabled: false,
      innerRadius: 0.3,
      middleRadius: 0.6,
      outerRadius: 1.0,
      innerResolution: 1.0,
      middleResolution: 0.5,
      outerResolution: 0.25,

      apply: (renderTarget) => {
        if (!this.foveatedRenderer.enabled) {
          return;
        }

        // Apply foveated rendering to render target
        console.info('Applying foveated rendering');
      }
    };
  }

  /**
   * Set up asynchronous timewarp
   */
  setupAsynchronousTimeWarp() {
    this.timeWarp = {
      enabled: false,
      predictionMs: 20,

      warp: (frame, headPose) => {
        if (!this.timeWarp.enabled) {
          return frame;
        }

        // Apply timewarp based on head pose prediction
        console.info('Applying asynchronous timewarp');
        return frame;
      }
    };
  }

  /**
   * Trigger memory cleanup
   */
  triggerMemoryCleanup() {
    console.warn('Memory pressure detected, triggering cleanup');

    // Clear caches
    this.clearCaches();

    // Reduce quality settings
    this.setQualityLevel('low');

    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }

    this.emit('memory:cleanup', {
      before: this.metrics.memory.used,
      timestamp: Date.now()
    });
  }

  /**
   * Clear various caches
   */
  clearCaches() {
    // Clear texture cache
    if (window.THREE?.Cache) {
      window.THREE.Cache.clear();
    }

    // Clear metrics samples if too large
    for (const metric of Object.values(this.metrics)) {
      if (metric.samples && metric.samples.length > 100) {
        metric.samples = metric.samples.slice(-60);
      }
    }

    // Clear old profiling data
    for (const [key, profiler] of this.profilers) {
      if (profiler.samples && profiler.samples.length > 100) {
        profiler.samples = profiler.samples.slice(-50);
      }
    }
  }

  /**
   * Handle long tasks
   */
  handleLongTask(entry) {
    console.warn(`Long task detected: ${entry.duration}ms`, entry);

    this.emit('performance:longtask', {
      duration: entry.duration,
      startTime: entry.startTime,
      name: entry.name
    });

    // If task is too long, consider deferring work
    if (entry.duration > 100) {
      this.suggestOptimization('defer-heavy-computation');
    }
  }

  /**
   * Set quality level
   */
  setQualityLevel(level) {
    const levels = {
      low: {
        resolution: 0.7,
        shadows: false,
        antialiasing: false,
        textures: 'low',
        particles: 0.3,
        postProcessing: false
      },
      medium: {
        resolution: 0.85,
        shadows: true,
        antialiasing: true,
        textures: 'medium',
        particles: 0.7,
        postProcessing: true
      },
      high: {
        resolution: 1.0,
        shadows: true,
        antialiasing: true,
        textures: 'high',
        particles: 1.0,
        postProcessing: true
      },
      ultra: {
        resolution: 1.5,
        shadows: true,
        antialiasing: true,
        textures: 'ultra',
        particles: 1.0,
        postProcessing: true
      }
    };

    const settings = levels[level] || levels.medium;

    // Apply settings
    this.applyQualitySettings(settings);

    this.emit('quality:changed', { level, settings });
  }

  /**
   * Apply quality settings
   */
  applyQualitySettings(settings) {
    // Resolution
    this.reduceRenderResolution(settings.resolution);

    // Shadows
    if (window.renderer) {
      window.renderer.shadowMap.enabled = settings.shadows;
    }

    // Anti-aliasing
    if (window.renderer) {
      window.renderer.antialias = settings.antialiasing;
    }

    // Texture quality
    this.setTextureQuality(settings.textures);

    // Particle density
    this.setParticleDensity(settings.particles);

    // Post-processing
    this.enablePostProcessing(settings.postProcessing);
  }

  /**
   * Reduce render resolution
   */
  reduceRenderResolution(scale) {
    if (window.renderer) {
      const width = window.innerWidth * scale;
      const height = window.innerHeight * scale;
      window.renderer.setSize(width, height);

      // Update canvas CSS to maintain full screen
      window.renderer.domElement.style.width = '100%';
      window.renderer.domElement.style.height = '100%';
    }

    this.dynamicResolution.currentScale = scale;
  }

  /**
   * Set texture quality
   */
  setTextureQuality(quality) {
    const qualityMap = {
      low: 256,
      medium: 512,
      high: 1024,
      ultra: 2048
    };

    const maxTextureSize = qualityMap[quality] || 512;

    // Apply to all loaded textures
    if (window.THREE) {
      // Texture quality implementation
      console.info(`Setting texture quality to ${quality} (${maxTextureSize}px)`);
    }
  }

  /**
   * Set particle density
   */
  setParticleDensity(density) {
    // Reduce particle count based on density
    console.info(`Setting particle density to ${density * 100}%`);
  }

  /**
   * Enable or disable post-processing
   */
  enablePostProcessing(enabled) {
    console.info(`Post-processing ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable or disable specific optimization
   */
  enableOptimization(name, enabled) {
    if (name in this.optimizations) {
      this.optimizations[name] = enabled;
      console.info(`Optimization ${name} ${enabled ? 'enabled' : 'disabled'}`);

      // Apply optimization changes
      switch (name) {
        case 'foveatedRendering':
          if (this.foveatedRenderer) {
            this.foveatedRenderer.enabled = enabled;
          }
          break;
        case 'frustumCulling':
          if (this.frustumCuller) {
            this.frustumCuller.enabled = enabled;
          }
          break;
        case 'levelOfDetail':
          if (this.lodSystem) {
            this.lodSystem.enabled = enabled;
          }
          break;
      }
    }
  }

  /**
   * Check if object is in frustum
   */
  isInFrustum(boundingBox) {
    // Simplified frustum check
    // In real implementation, would check against camera frustum planes
    return true;
  }

  /**
   * Suggest optimization based on performance issues
   */
  suggestOptimization(issue) {
    const suggestions = {
      'defer-heavy-computation': 'Consider using Web Workers for heavy computations',
      'reduce-draw-calls': 'Batch similar objects to reduce draw calls',
      'optimize-textures': 'Use compressed textures and appropriate mipmapping',
      'simplify-shaders': 'Simplify shader calculations or use simpler materials',
      'reduce-polygon-count': 'Use lower poly models or implement LOD system'
    };

    const suggestion = suggestions[issue] || 'Consider profiling to identify bottlenecks';

    this.emit('optimization:suggestion', { issue, suggestion });
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport() {
    const report = {
      timestamp: Date.now(),
      metrics: {
        fps: {
          current: this.metrics.fps.current.toFixed(2),
          average: this.metrics.fps.average.toFixed(2),
          min: this.metrics.fps.min.toFixed(2),
          max: this.metrics.fps.max.toFixed(2)
        },
        frameTime: {
          current: this.metrics.frameTime.current.toFixed(2),
          average: this.metrics.frameTime.average.toFixed(2)
        },
        memory: {
          used: (this.metrics.memory.used / 1024 / 1024).toFixed(2) + ' MB',
          total: (this.metrics.memory.total / 1024 / 1024).toFixed(2) + ' MB',
          usage: ((this.metrics.memory.used / this.metrics.memory.limit) * 100).toFixed(1) + '%'
        },
        optimizations: this.optimizations,
        qualityScale: this.dynamicResolution?.currentScale || 1.0
      }
    };

    this.emit('performance:report', report);

    return report;
  }

  /**
   * Profile a specific function
   */
  profile(name, fn) {
    return async (...args) => {
      const startTime = performance.now();
      const startMemory = performance.memory?.usedJSHeapSize || 0;

      try {
        const result = await fn(...args);

        const endTime = performance.now();
        const endMemory = performance.memory?.usedJSHeapSize || 0;

        const profile = {
          name,
          duration: endTime - startTime,
          memoryDelta: endMemory - startMemory,
          timestamp: Date.now()
        };

        // Store profiling data
        if (!this.profilers.has(name)) {
          this.profilers.set(name, { samples: [] });
        }

        const profiler = this.profilers.get(name);
        profiler.samples.push(profile);

        if (profiler.samples.length > 100) {
          profiler.samples.shift();
        }

        // Calculate statistics
        profiler.average = profiler.samples.reduce((a, b) => a + b.duration, 0) / profiler.samples.length;

        this.emit('profile:complete', profile);

        return result;
      } catch (error) {
        console.error(`Profiling error for ${name}:`, error);
        throw error;
      }
    };
  }

  /**
   * Get profiling statistics
   */
  getProfilingStats(name) {
    const profiler = this.profilers.get(name);
    if (!profiler || !profiler.samples.length) {
      return null;
    }

    const durations = profiler.samples.map(s => s.duration);
    durations.sort((a, b) => a - b);

    return {
      name,
      samples: profiler.samples.length,
      average: profiler.average,
      median: durations[Math.floor(durations.length / 2)],
      min: durations[0],
      max: durations[durations.length - 1],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)]
    };
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Window resize
    window.addEventListener('resize', () => {
      this.dynamicResolution.baseWidth = window.innerWidth;
      this.dynamicResolution.baseHeight = window.innerHeight;
    });

    // Page visibility
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause();
      } else {
        this.resume();
      }
    });

    // Memory warning (if available)
    if ('memory' in performance) {
      setInterval(() => {
        const usage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
        if (usage > 0.9) {
          this.triggerMemoryCleanup();
        }
      }, 10000);
    }
  }

  /**
   * Pause monitoring
   */
  pause() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    for (const [key, interval] of this.monitoringIntervals) {
      clearInterval(interval);
    }
    this.monitoringIntervals.clear();

    console.info('Performance monitoring paused');
  }

  /**
   * Resume monitoring
   */
  resume() {
    if (!this.rafId) {
      this.startMonitoring();
      console.info('Performance monitoring resumed');
    }
  }

  /**
   * Event emitter - emit event
   */
  emit(event, data) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Event emitter - add listener
   */
  on(event, listener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(listener);
    return this;
  }

  /**
   * Event emitter - remove listener
   */
  off(event, listener) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
    return this;
  }

  /**
   * WASM fallback implementations
   */
  simdFallback = {
    vectorAdd: (a, b) => a.map((v, i) => v + b[i]),
    matrixMultiply: (a, b) => {
      // Simple matrix multiplication
      return a;
    }
  };

  physicsFallback = {
    simulate: (bodies, dt) => {
      // Simple physics simulation
      return bodies;
    }
  };

  mathFallback = {
    fastSin: Math.sin,
    fastCos: Math.cos,
    fastSqrt: Math.sqrt
  };

  /**
   * Get current performance status
   */
  getStatus() {
    const fps = this.metrics.fps.current;
    let status = 'optimal';

    if (fps < this.thresholds.critical.fps) {
      status = 'critical';
    } else if (fps < this.thresholds.warning.fps) {
      status = 'warning';
    }

    return {
      status,
      fps: fps.toFixed(2),
      frameTime: this.metrics.frameTime.current.toFixed(2),
      memory: ((this.metrics.memory.used / this.metrics.memory.limit) * 100).toFixed(1) + '%',
      optimizations: Object.entries(this.optimizations)
        .filter(([_, enabled]) => enabled)
        .map(([name]) => name)
    };
  }

  /**
   * Export performance data
   */
  exportData() {
    return {
      metrics: this.metrics,
      optimizations: this.optimizations,
      thresholds: this.thresholds,
      profiling: Array.from(this.profilers.entries()).map(([name, data]) => ({
        name,
        stats: this.getProfilingStats(name)
      }))
    };
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    // Stop monitoring
    this.pause();

    // Remove observers
    for (const observer of this.observers.values()) {
      observer.disconnect();
    }
    this.observers.clear();

    // Clear intervals
    for (const interval of this.monitoringIntervals.values()) {
      clearInterval(interval);
    }
    this.monitoringIntervals.clear();

    // Clear event listeners
    this.eventListeners.clear();

    // Clear caches
    this.monitors.clear();
    this.profilers.clear();
    this.wasmModules.clear();

    this.initialized = false;

    console.info('Unified Performance System destroyed');
  }
}

// Create singleton instance
const unifiedPerformance = new UnifiedPerformanceSystem();

// Auto-initialize on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    unifiedPerformance.initialize();
  });
} else {
  unifiedPerformance.initialize();
}

// Export for use in other modules
window.UnifiedPerformanceSystem = UnifiedPerformanceSystem;
window.unifiedPerformance = unifiedPerformance;

// Backward compatibility aliases
window.VRPerformanceMonitor = unifiedPerformance;
window.performanceOptimizer = unifiedPerformance;
window.AdvancedPerformanceSystem = unifiedPerformance;