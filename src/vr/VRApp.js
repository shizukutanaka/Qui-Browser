/**
 * VR Application Main Controller
 * Integrates all Tier 1 optimizations for production-ready performance
 *
 * John Carmack principle: Systems integration is where performance lives or dies
 */

import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';

// Tier 1 Optimizations
import { FFRSystem } from './rendering/FFRSystem.js';
import { ComfortSystem } from './comfort/ComfortSystem.js';
import { ObjectPool, PoolManager } from '../utils/ObjectPool.js';
import { TextureManager } from '../utils/TextureManager.js';

// Tier 2 Features
import { JapaneseIME, VRJapaneseKeyboard } from './input/JapaneseIME.js';
import { HandTracking } from './interaction/HandTracking.js';
import { SpatialAudio } from './audio/SpatialAudio.js';
import { MixedReality } from './ar/MixedReality.js';
import { ProgressiveLoader } from '../utils/ProgressiveLoader.js';

export class VRApp {
  constructor(container) {
    this.container = container || document.body;
    this.isVREnabled = false;
    this.frameCount = 0;

    // Core Three.js components
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // Tier 1 systems
    this.ffrSystem = null;
    this.comfortSystem = null;
    this.poolManager = null;
    this.textureManager = null;

    // Tier 2 systems
    this.japaneseIME = null;
    this.vrKeyboard = null;
    this.handTracking = null;
    this.spatialAudio = null;
    this.mixedReality = null;
    this.progressiveLoader = null;

    // Performance monitoring
    this.performanceMonitor = {
      fps: 90,
      frameTime: 0,
      memoryUsed: 0,
      drawCalls: 0
    };

    // Settings
    this.settings = {
      targetFPS: 90,        // Quest 2 target
      maxFPS: 120,          // Quest 3 capability
      motionSensitivity: 'moderate',
      enableFFR: true,
      enableComfort: true,
      enableObjectPooling: true,
      enableTextureCompression: true
    };

    this.initialize();
  }

  /**
   * Initialize VR application
   */
  async initialize() {
    console.log('VRApp: Initializing Qui Browser VR v2.0.0');

    // Setup Three.js
    this.setupRenderer();
    this.setupScene();
    this.setupCamera();

    // Initialize Tier 1 optimizations
    await this.initializeSystems();

    // Setup VR
    this.setupVR();

    // Register service worker
    this.registerServiceWorker();

    // Start render loop
    this.renderer.setAnimationLoop(this.render.bind(this));

    console.log('VRApp: Initialization complete');
  }

  /**
   * Setup WebGL renderer
   */
  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,  // Disabled for performance (use FXAA/TAA instead)
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
      stencil: false  // Disabled if not needed
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = false; // Expensive, disable by default
    this.renderer.xr.enabled = true;

    // Optimization: Use logarithmic depth buffer for better precision
    this.renderer.logarithmicDepthBuffer = true;

    this.container.appendChild(this.renderer.domElement);

    console.log('VRApp: Renderer initialized');
  }

  /**
   * Setup scene
   */
  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111111); // Dark for battery savings

    // Simple ambient light (cheap)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Single directional light (for basic shading)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(5, 10, 5);
    this.scene.add(directionalLight);

    console.log('VRApp: Scene created');
  }

  /**
   * Setup camera
   */
  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      90,  // FOV - will be adjusted by comfort system
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 1.6, 3); // Average eye height
  }

  /**
   * Initialize all optimization systems
   */
  async initializeSystems() {
    const startTime = performance.now();

    // Use progressive loader for efficient initialization
    this.progressiveLoader = new ProgressiveLoader();
    this.progressiveLoader.callbacks.onProgress = (data) => {
      console.log(`VRApp: Loading ${data.item.name} (${data.progress * 100}%)`);
    };

    // === TIER 1 SYSTEMS ===

    // 1. Fixed Foveated Rendering
    if (this.settings.enableFFR) {
      this.ffrSystem = new FFRSystem();
      console.log('VRApp: FFR system ready');
    }

    // 2. Comfort System
    if (this.settings.enableComfort) {
      this.comfortSystem = new ComfortSystem(
        this.scene,
        this.camera,
        this.renderer
      );
      this.comfortSystem.setPreset(this.settings.motionSensitivity);
      console.log('VRApp: Comfort system initialized');
    }

    // 3. Object Pooling
    if (this.settings.enableObjectPooling) {
      this.poolManager = new PoolManager();

      // Register common pools
      this.poolManager.register('vector3', new ObjectPool(THREE.Vector3, 100, 1000));
      this.poolManager.register('quaternion', new ObjectPool(THREE.Quaternion, 50, 500));
      this.poolManager.register('matrix4', new ObjectPool(THREE.Matrix4, 20, 200));

      console.log('VRApp: Object pools initialized');
    }

    // 4. Texture Manager with KTX2 support
    if (this.settings.enableTextureCompression) {
      this.textureManager = new TextureManager(this.renderer);
      await this.textureManager.initializeKTX2();
      console.log('VRApp: Texture manager ready with KTX2 support');
    }

    // === TIER 2 SYSTEMS ===

    // 5. Japanese IME
    this.japaneseIME = new JapaneseIME();
    this.vrKeyboard = new VRJapaneseKeyboard(this.scene, this.japaneseIME);
    console.log('VRApp: Japanese IME ready');

    // 6. Hand Tracking
    this.handTracking = new HandTracking(this.renderer, this.scene);
    console.log('VRApp: Hand tracking ready');

    // 7. Spatial Audio
    this.spatialAudio = new SpatialAudio();
    await this.loadAudioAssets();
    console.log('VRApp: Spatial audio initialized');

    // 8. Mixed Reality
    this.mixedReality = new MixedReality(this.renderer, this.scene);
    const mrSupport = await this.mixedReality.checkSupport();
    console.log('VRApp: Mixed reality support:', mrSupport);

    const loadTime = performance.now() - startTime;
    console.log(`VRApp: All systems initialized in ${loadTime.toFixed(1)}ms`);
  }

  /**
   * Load audio assets progressively
   */
  async loadAudioAssets() {
    // Add audio files to progressive loader
    const audioFiles = [
      { url: '/assets/sounds/click.mp3', name: 'click', type: 'audio', priority: 'primary' },
      { url: '/assets/sounds/hover.mp3', name: 'hover', type: 'audio', priority: 'secondary' },
      { url: '/assets/sounds/success.mp3', name: 'success', type: 'audio', priority: 'secondary' },
      { url: '/assets/sounds/error.mp3', name: 'error', type: 'audio', priority: 'secondary' }
    ];

    for (const file of audioFiles) {
      this.progressiveLoader.addResource(file, file.priority);
    }

    // Start progressive loading
    await this.progressiveLoader.start();

    // Load into spatial audio system
    for (const file of audioFiles) {
      const audio = this.progressiveLoader.get(file.name);
      if (audio) {
        await this.spatialAudio.loadAudio(file.url, file.name);
      }
    }
  }

  /**
   * Setup WebXR
   */
  setupVR() {
    // Add VR button to page
    const vrButton = VRButton.createButton(this.renderer);
    document.body.appendChild(vrButton);

    // Listen for VR session events
    this.renderer.xr.addEventListener('sessionstart', () => {
      this.onVRSessionStart();
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      this.onVRSessionEnd();
    });
  }

  /**
   * Handle VR session start
   */
  async onVRSessionStart() {
    console.log('VRApp: VR session started');
    this.isVREnabled = true;

    // Get XR session
    const session = this.renderer.xr.getSession();

    // Initialize FFR for this session
    if (this.ffrSystem && session) {
      const gl = this.renderer.getContext();
      await this.ffrSystem.initialize(session, gl);
      this.ffrSystem.setEnabled(true);
      console.log('VRApp: FFR enabled for session');
    }

    // Update comfort system for VR
    if (this.comfortSystem) {
      this.comfortSystem.enterVR();
    }

    // Initialize hand tracking
    if (this.handTracking && session) {
      await this.handTracking.initialize(session);

      // Register gesture callbacks
      this.handTracking.onGesture('pinch', (hand, gesture) => {
        console.log(`${hand} hand pinch detected`);
        // Play spatial sound at pinch position
        if (this.spatialAudio) {
          const pos = this.handTracking.getPinchPosition(hand);
          if (pos) {
            this.spatialAudio.play('click', 'click', pos);
          }
        }
      });

      this.handTracking.onGesture('point', (hand, gesture) => {
        console.log(`${hand} hand pointing`);
      });
    }

    // Adjust render settings for VR
    this.renderer.setPixelRatio(1); // Don't use device pixel ratio in VR
  }

  /**
   * Handle VR session end
   */
  onVRSessionEnd() {
    console.log('VRApp: VR session ended');
    this.isVREnabled = false;

    // Disable FFR
    if (this.ffrSystem) {
      this.ffrSystem.setEnabled(false);
    }

    // Update comfort system
    if (this.comfortSystem) {
      this.comfortSystem.exitVR();
    }

    // Restore render settings
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  /**
   * Register service worker for offline support
   */
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('VRApp: Service Worker registered:', registration);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute
      } catch (error) {
        console.error('VRApp: Service Worker registration failed:', error);
      }
    }
  }

  /**
   * Main render loop
   */
  render(timestamp, xrFrame) {
    this.frameCount++;

    // Start performance timing
    const frameStart = performance.now();

    // Update systems
    this.updateSystems(timestamp, xrFrame);

    // Render scene
    this.renderer.render(this.scene, this.camera);

    // Track performance
    const frameTime = performance.now() - frameStart;
    this.updatePerformanceMonitor(frameTime);

    // Dynamic quality adjustment (every 60 frames)
    if (this.frameCount % 60 === 0) {
      this.adjustQuality();
    }
  }

  /**
   * Update all systems
   */
  updateSystems(timestamp, xrFrame) {
    // Update comfort system (vignette, FOV)
    if (this.comfortSystem) {
      const isMoving = this.detectMotion();
      this.comfortSystem.update(isMoving);
    }

    // Update FFR based on performance
    if (this.ffrSystem && this.isVREnabled) {
      const targetFrameTime = 1000 / this.settings.targetFPS;
      if (this.performanceMonitor.frameTime > targetFrameTime) {
        this.ffrSystem.adjustIntensity(0.01);
      } else {
        this.ffrSystem.adjustIntensity(-0.01);
      }
    }

    // Update hand tracking
    if (this.handTracking && xrFrame) {
      const referenceSpace = this.renderer.xr.getReferenceSpace();
      this.handTracking.update(xrFrame, referenceSpace);
    }

    // Update spatial audio listener position
    if (this.spatialAudio) {
      this.spatialAudio.updateListenerFromCamera(this.camera);
    }

    // Update mixed reality
    if (this.mixedReality && this.mixedReality.enabled && xrFrame) {
      this.mixedReality.update(xrFrame);
    }

    // Update scene objects using pools
    this.updateSceneWithPools();
  }

  /**
   * Detect user motion (simplified)
   */
  detectMotion() {
    if (!this.renderer.xr.isPresenting) return false;

    const session = this.renderer.xr.getSession();
    if (!session) return false;

    // In production, check controller velocity
    // For now, return false (stationary)
    return false;
  }

  /**
   * Example: Update scene using object pools
   */
  updateSceneWithPools() {
    if (!this.poolManager) return;

    // Example: Get temporary vectors from pool
    const vectorPool = this.poolManager.getPool('vector3');
    if (vectorPool) {
      const tempVector = vectorPool.acquire();

      // Use vector for calculations
      tempVector.set(
        Math.sin(this.frameCount * 0.01),
        0,
        Math.cos(this.frameCount * 0.01)
      );

      // Release back to pool when done
      vectorPool.release(tempVector);
    }
  }

  /**
   * Update performance monitor
   */
  updatePerformanceMonitor(frameTime) {
    // Exponential moving average for smooth values
    const alpha = 0.1;
    this.performanceMonitor.frameTime =
      this.performanceMonitor.frameTime * (1 - alpha) + frameTime * alpha;

    this.performanceMonitor.fps = 1000 / this.performanceMonitor.frameTime;

    // Track memory usage
    if (performance.memory) {
      this.performanceMonitor.memoryUsed =
        performance.memory.usedJSHeapSize / 1024 / 1024; // MB
    }

    // Track draw calls (simplified)
    this.performanceMonitor.drawCalls = this.renderer.info.render.calls;
  }

  /**
   * Dynamic quality adjustment
   */
  adjustQuality() {
    const targetFrameTime = 1000 / this.settings.targetFPS;
    const currentFrameTime = this.performanceMonitor.frameTime;

    if (currentFrameTime > targetFrameTime * 1.2) {
      // Performance is poor, reduce quality
      this.reduceQuality();
    } else if (currentFrameTime < targetFrameTime * 0.8) {
      // Performance is good, increase quality
      this.increaseQuality();
    }
  }

  /**
   * Reduce rendering quality for better performance
   */
  reduceQuality() {
    // Increase FFR intensity
    if (this.ffrSystem) {
      this.ffrSystem.adjustIntensity(0.1);
    }

    // Reduce render scale (if implemented)
    // this.renderer.setPixelRatio(0.8);

    console.log('VRApp: Quality reduced for performance');
  }

  /**
   * Increase rendering quality when performance allows
   */
  increaseQuality() {
    // Decrease FFR intensity
    if (this.ffrSystem) {
      this.ffrSystem.adjustIntensity(-0.1);
    }

    // Increase render scale (if implemented)
    // this.renderer.setPixelRatio(1.0);

    console.log('VRApp: Quality increased');
  }

  /**
   * Load texture using optimized texture manager
   */
  async loadTexture(url, options = {}) {
    if (this.textureManager) {
      return await this.textureManager.loadTexture(url, options);
    } else {
      // Fallback to standard Three.js loader
      const loader = new THREE.TextureLoader();
      return await loader.loadAsync(url);
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const stats = {
      fps: Math.round(this.performanceMonitor.fps),
      frameTime: this.performanceMonitor.frameTime.toFixed(2) + 'ms',
      memory: this.performanceMonitor.memoryUsed.toFixed(1) + 'MB',
      drawCalls: this.performanceMonitor.drawCalls
    };

    // Add system-specific stats
    if (this.ffrSystem) {
      stats.ffrIntensity = (this.ffrSystem.intensity * 100).toFixed(0) + '%';
    }

    if (this.textureManager) {
      const memStats = this.textureManager.getMemoryStats();
      stats.textureMemory = memStats.usedMB + '/' + memStats.maxMB + 'MB';
      stats.textureCompression = memStats.compressionRatio;
    }

    if (this.poolManager) {
      const poolStats = this.poolManager.getGlobalStats();
      stats.pooledObjects = poolStats.totalObjects;
      stats.gcPrevented = poolStats.totalGCPrevented;
    }

    return stats;
  }

  /**
   * Cleanup and disposal
   */
  dispose() {
    console.log('VRApp: Disposing...');

    // Stop render loop
    this.renderer.setAnimationLoop(null);

    // Dispose systems
    if (this.comfortSystem) this.comfortSystem.dispose();
    if (this.ffrSystem) this.ffrSystem.dispose();
    if (this.textureManager) this.textureManager.dispose();
    if (this.poolManager) this.poolManager.dispose();

    // Dispose Three.js
    this.renderer.dispose();
    this.scene.traverse(object => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });

    console.log('VRApp: Disposed');
  }
}

/**
 * Usage Example:
 *
 * const app = new VRApp(document.getElementById('vr-container'));
 *
 * // Load optimized texture
 * const texture = await app.loadTexture('assets/wood.ktx2', {
 *   preferKTX2: true
 * });
 *
 * // Get performance stats
 * setInterval(() => {
 *   const stats = app.getPerformanceStats();
 *   console.log('FPS:', stats.fps, 'Memory:', stats.memory);
 * }, 1000);
 *
 * // Cleanup on page unload
 * window.addEventListener('beforeunload', () => {
 *   app.dispose();
 * });
 */