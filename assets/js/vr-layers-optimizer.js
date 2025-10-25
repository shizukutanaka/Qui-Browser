/**
 * WebXR Layers Optimizer (2025)
 *
 * Advanced layer composition for performance and visual quality
 * - Quad layers for UI panels
 * - Cylinder layers for curved displays
 * - Projection layers for main view
 * - Independent resolution per layer
 * - Compositor reprojection
 *
 * Performance benefits:
 * - Static layers rendered once at high resolution
 * - Compositor resamples (smoother than app re-rendering)
 * - Less judder even at lower refresh rates
 * - Per-layer resolution scaling
 *
 * @author Qui Browser Team
 * @version 5.1.0
 * @license MIT
 */

class VRLayersOptimizer {
  constructor(options = {}) {
    this.version = '5.1.0';
    this.debug = options.debug || false;

    // WebXR session and binding
    this.xrSession = null;
    this.xrGLBinding = null;

    // Layers registry
    this.layers = new Map();
    this.layerTypes = {
      projection: null,
      quads: [],
      cylinders: [],
      cubes: []
    };

    // Performance settings
    this.enableReprojection = options.enableReprojection !== false;
    this.enableHighResLayers = options.enableHighResLayers !== false;

    // Default layer configs
    this.defaultQuadConfig = {
      width: 1.0,
      height: 0.75,
      resolution: { width: 1024, height: 768 }
    };

    this.defaultCylinderConfig = {
      radius: 2.0,
      centralAngle: Math.PI / 2,
      aspectRatio: 2.0,
      resolution: { width: 2048, height: 1024 }
    };

    this.initialized = false;
  }

  /**
   * Initialize layers optimizer
   * @param {XRSession} xrSession - WebXR session
   * @param {WebGLRenderingContext} gl - WebGL context
   * @returns {Promise<boolean>} Success status
   */
  async initialize(xrSession, gl) {
    this.log('Initializing WebXR Layers Optimizer v5.1.0...');

    try {
      this.xrSession = xrSession;

      // Check layers API support
      if (!xrSession.renderState.layers) {
        throw new Error('WebXR Layers API not supported');
      }

      // Create XR WebGL binding
      this.xrGLBinding = new XRWebGLBinding(xrSession, gl);

      this.initialized = true;
      this.log('WebXR Layers Optimizer initialized');

      return true;

    } catch (error) {
      this.error('Initialization failed:', error);
      return false;
    }
  }

  /**
   * Create projection layer (main view)
   * @param {Object} config - Layer configuration
   * @returns {XRProjectionLayer} Projection layer
   */
  createProjectionLayer(config = {}) {
    if (!this.initialized) {
      throw new Error('Not initialized');
    }

    try {
      const layerConfig = {
        textureType: config.textureType || 'texture',
        colorFormat: config.colorFormat || 0x1908, // gl.RGBA
        depthFormat: config.depthFormat || 0x88F0, // gl.DEPTH24_STENCIL8
        scaleFactor: config.scaleFactor || 1.0
      };

      const projectionLayer = this.xrGLBinding.createProjectionLayer(layerConfig);

      this.layerTypes.projection = projectionLayer;
      this.layers.set('projection', projectionLayer);

      this.log('Projection layer created:', layerConfig);

      return projectionLayer;

    } catch (error) {
      this.error('Failed to create projection layer:', error);
      throw error;
    }
  }

  /**
   * Create quad layer for UI panel
   * @param {Object} config - Layer configuration
   * @returns {XRQuadLayer} Quad layer
   */
  createQuadLayer(config = {}) {
    if (!this.initialized) {
      throw new Error('Not initialized');
    }

    try {
      const layerConfig = {
        space: config.space || this.xrSession.renderState.baseSpace,
        viewPixelWidth: config.resolution?.width || this.defaultQuadConfig.resolution.width,
        viewPixelHeight: config.resolution?.height || this.defaultQuadConfig.resolution.height,
        layout: config.layout || 'mono',
        isStatic: config.isStatic !== false
      };

      const quadLayer = this.xrGLBinding.createQuadLayer(layerConfig);

      // Set dimensions
      quadLayer.width = config.width || this.defaultQuadConfig.width;
      quadLayer.height = config.height || this.defaultQuadConfig.height;

      // Set transform
      if (config.transform) {
        quadLayer.transform = new XRRigidTransform(
          config.transform.position || { x: 0, y: 0, z: -1 },
          config.transform.orientation || { x: 0, y: 0, z: 0, w: 1 }
        );
      }

      const layerId = `quad-${this.layerTypes.quads.length}`;
      this.layerTypes.quads.push(quadLayer);
      this.layers.set(layerId, quadLayer);

      this.log('Quad layer created:', layerId, layerConfig);

      return quadLayer;

    } catch (error) {
      this.error('Failed to create quad layer:', error);
      throw error;
    }
  }

  /**
   * Create cylinder layer for curved display
   * @param {Object} config - Layer configuration
   * @returns {XRCylinderLayer} Cylinder layer
   */
  createCylinderLayer(config = {}) {
    if (!this.initialized) {
      throw new Error('Not initialized');
    }

    try {
      const layerConfig = {
        space: config.space || this.xrSession.renderState.baseSpace,
        viewPixelWidth: config.resolution?.width || this.defaultCylinderConfig.resolution.width,
        viewPixelHeight: config.resolution?.height || this.defaultCylinderConfig.resolution.height,
        layout: config.layout || 'mono',
        isStatic: config.isStatic !== false
      };

      const cylinderLayer = this.xrGLBinding.createCylinderLayer(layerConfig);

      // Set cylinder properties
      cylinderLayer.radius = config.radius || this.defaultCylinderConfig.radius;
      cylinderLayer.centralAngle = config.centralAngle || this.defaultCylinderConfig.centralAngle;
      cylinderLayer.aspectRatio = config.aspectRatio || this.defaultCylinderConfig.aspectRatio;

      // Set transform
      if (config.transform) {
        cylinderLayer.transform = new XRRigidTransform(
          config.transform.position || { x: 0, y: 0, z: 0 },
          config.transform.orientation || { x: 0, y: 0, z: 0, w: 1 }
        );
      }

      const layerId = `cylinder-${this.layerTypes.cylinders.length}`;
      this.layerTypes.cylinders.push(cylinderLayer);
      this.layers.set(layerId, cylinderLayer);

      this.log('Cylinder layer created:', layerId, layerConfig);

      return cylinderLayer;

    } catch (error) {
      this.error('Failed to create cylinder layer:', error);
      throw error;
    }
  }

  /**
   * Create UI panel (quad layer) with text/image
   * @param {Object} config - Panel configuration
   * @returns {Object} Panel object with layer and texture
   */
  async createUIPanel(config = {}) {
    const quadLayer = this.createQuadLayer({
      width: config.width || 1.0,
      height: config.height || 0.75,
      resolution: config.resolution || { width: 1024, height: 768 },
      transform: config.transform,
      isStatic: config.isStatic !== false
    });

    // Get WebGL framebuffer for the layer
    const framebuffer = this.xrGLBinding.getSubImage(quadLayer, this.xrSession.renderState.baseSpace);

    return {
      layer: quadLayer,
      framebuffer: framebuffer,
      width: config.width || 1.0,
      height: config.height || 0.75,
      resolution: config.resolution || { width: 1024, height: 768 }
    };
  }

  /**
   * Create curved video player (cylinder layer)
   * @param {HTMLVideoElement} videoElement - Video element
   * @param {Object} config - Player configuration
   * @returns {Object} Player object with layer
   */
  async createCurvedVideoPlayer(videoElement, config = {}) {
    const cylinderLayer = this.createCylinderLayer({
      radius: config.radius || 2.0,
      centralAngle: config.centralAngle || Math.PI,
      aspectRatio: videoElement.videoWidth / videoElement.videoHeight,
      resolution: {
        width: config.resolution?.width || 2048,
        height: config.resolution?.height || 1024
      },
      transform: config.transform,
      isStatic: false
    });

    return {
      layer: cylinderLayer,
      videoElement: videoElement,
      radius: config.radius || 2.0
    };
  }

  /**
   * Update session layers
   * @param {Array} layers - Ordered array of layers (back to front)
   */
  async updateSessionLayers(layers) {
    if (!this.xrSession) {
      throw new Error('No active XR session');
    }

    try {
      await this.xrSession.updateRenderState({
        layers: layers
      });

      this.log('Session layers updated:', layers.length, 'layers');

    } catch (error) {
      this.error('Failed to update session layers:', error);
      throw error;
    }
  }

  /**
   * Create optimized layer stack for VR browser
   * @returns {Array} Ordered layers
   */
  async createOptimizedLayerStack() {
    const layers = [];

    // 1. Projection layer (main 3D view) - back
    const projection = this.createProjectionLayer({
      scaleFactor: 0.8  // Reduce resolution for performance
    });
    layers.push(projection);

    // 2. Cylinder layer for 360 content (optional)
    if (this.enableHighResLayers) {
      const cylinder = this.createCylinderLayer({
        radius: 3.0,
        centralAngle: Math.PI * 1.5,
        resolution: { width: 4096, height: 2048 }
      });
      layers.push(cylinder);
    }

    // 3. Quad layers for UI panels - front
    const uiPanel = this.createQuadLayer({
      width: 1.5,
      height: 1.0,
      resolution: { width: 1536, height: 1024 },
      transform: {
        position: { x: 0, y: 1.6, z: -2 }
      }
    });
    layers.push(uiPanel);

    // Update session
    await this.updateSessionLayers(layers);

    this.log('Optimized layer stack created:', layers.length, 'layers');

    return layers;
  }

  /**
   * Get layer by ID
   * @param {string} layerId - Layer ID
   * @returns {XRLayer|null} Layer
   */
  getLayer(layerId) {
    return this.layers.get(layerId) || null;
  }

  /**
   * Remove layer
   * @param {string} layerId - Layer ID
   */
  removeLayer(layerId) {
    const layer = this.layers.get(layerId);
    if (!layer) {
      this.warn('Layer not found:', layerId);
      return;
    }

    // Remove from type arrays
    if (this.layerTypes.projection === layer) {
      this.layerTypes.projection = null;
    }
    this.layerTypes.quads = this.layerTypes.quads.filter(l => l !== layer);
    this.layerTypes.cylinders = this.layerTypes.cylinders.filter(l => l !== layer);

    this.layers.delete(layerId);

    this.log('Layer removed:', layerId);
  }

  /**
   * Get all layers info
   * @returns {Object} Layers info
   */
  getLayersInfo() {
    return {
      total: this.layers.size,
      projection: this.layerTypes.projection ? 1 : 0,
      quads: this.layerTypes.quads.length,
      cylinders: this.layerTypes.cylinders.length,
      cubes: this.layerTypes.cubes.length
    };
  }

  /**
   * Dispose all layers
   */
  dispose() {
    this.layers.clear();
    this.layerTypes = {
      projection: null,
      quads: [],
      cylinders: [],
      cubes: []
    };

    this.log('All layers disposed');
  }

  /**
   * Log debug message
   */
  log(...args) {
    if (this.debug) {
      console.log('[VRLayersOptimizer]', ...args);
    }
  }

  /**
   * Log warning message
   */
  warn(...args) {
    console.warn('[VRLayersOptimizer]', ...args);
  }

  /**
   * Log error message
   */
  error(...args) {
    console.error('[VRLayersOptimizer]', ...args);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRLayersOptimizer;
}
