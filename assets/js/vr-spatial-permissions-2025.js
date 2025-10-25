/**
 * VR Spatial Permissions Manager (2025)
 *
 * WebXR Spatial Permission API integration for streamlined XR permissions
 * Consolidates "Depth", "Planes", and other spatial features into unified "Spatial" permission
 *
 * New in 2025:
 * - Unified Spatial permission (replaces separate Depth/Planes permissions)
 * - Simplified user experience
 * - Better privacy controls
 * - Android XR support
 * - Meta Quest 3 Mesh API support
 *
 * @author Qui Browser Team
 * @version 5.0.0
 * @license MIT
 */

class VRSpatialPermissionsManager {
  constructor(options = {}) {
    this.version = '5.0.0';
    this.debug = options.debug || false;

    // Permission states
    this.permissions = {
      spatial: null,          // Unified spatial permission (2025)
      handTracking: null,     // Hand tracking permission
      camera: null,           // Camera access permission (Quest 3)
      worldSensing: null      // World sensing permission (Android XR)
    };

    // Feature support detection
    this.features = {
      spatialPermission: false,    // New unified spatial permission
      depthSensing: false,         // Depth sensing
      planeDetection: false,       // Plane detection
      meshDetection: false,        // Mesh detection (Quest 3)
      handTracking: false,         // Hand tracking
      cameraAccess: false,         // Camera access (Quest 3)
      androidXR: false             // Android XR platform
    };

    // Cached session features
    this.sessionFeatures = {
      required: [],
      optional: []
    };

    this.initialized = false;
    this.permissionStatus = null;
  }

  /**
   * Initialize spatial permissions manager
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    this.log('Initializing Spatial Permissions Manager v5.0.0...');

    try {
      // Check WebXR support
      if (!navigator.xr) {
        throw new Error('WebXR not supported');
      }

      // Detect platform
      await this.detectPlatform();

      // Check feature support
      await this.checkFeatureSupport();

      // Initialize permissions API if available
      if (navigator.permissions) {
        await this.initializePermissionsAPI();
      }

      this.initialized = true;
      this.log('Spatial Permissions Manager initialized successfully');
      this.log('Supported features:', this.features);

      return true;

    } catch (error) {
      this.error('Initialization failed:', error);
      return false;
    }
  }

  /**
   * Detect XR platform (Quest 3, Android XR, Vision Pro, etc.)
   */
  async detectPlatform() {
    const userAgent = navigator.userAgent.toLowerCase();

    // Android XR detection
    if (userAgent.includes('android xr') || userAgent.includes('androidxr')) {
      this.platform = 'android-xr';
      this.features.androidXR = true;
      this.log('Platform detected: Android XR');
    }
    // Meta Quest detection
    else if (userAgent.includes('quest') || userAgent.includes('oculus')) {
      this.platform = 'meta-quest';
      this.log('Platform detected: Meta Quest');
    }
    // Vision Pro detection
    else if (userAgent.includes('visionos')) {
      this.platform = 'vision-pro';
      this.log('Platform detected: Apple Vision Pro');
    }
    // Generic WebXR
    else {
      this.platform = 'generic-webxr';
      this.log('Platform detected: Generic WebXR');
    }
  }

  /**
   * Check feature support for spatial APIs
   */
  async checkFeatureSupport() {
    try {
      // Check unified spatial permission (2025)
      const spatialSupported = await navigator.xr.isSessionSupported('immersive-vr', {
        requiredFeatures: ['spatial']
      }).catch(() => false);

      this.features.spatialPermission = spatialSupported;

      // Check depth sensing
      const depthSupported = await navigator.xr.isSessionSupported('immersive-vr', {
        requiredFeatures: ['depth-sensing']
      }).catch(() => false);

      this.features.depthSensing = depthSupported;

      // Check plane detection
      const planeSupported = await navigator.xr.isSessionSupported('immersive-vr', {
        requiredFeatures: ['plane-detection']
      }).catch(() => false);

      this.features.planeDetection = planeSupported;

      // Check mesh detection (Quest 3)
      const meshSupported = await navigator.xr.isSessionSupported('immersive-vr', {
        requiredFeatures: ['mesh-detection']
      }).catch(() => false);

      this.features.meshDetection = meshSupported;

      // Check hand tracking
      const handTrackingSupported = await navigator.xr.isSessionSupported('immersive-vr', {
        requiredFeatures: ['hand-tracking']
      }).catch(() => false);

      this.features.handTracking = handTrackingSupported;

      // Check camera access (Quest 3)
      if (this.platform === 'meta-quest') {
        this.features.cameraAccess = typeof navigator.mediaDevices !== 'undefined';
      }

    } catch (error) {
      this.error('Feature support check failed:', error);
    }
  }

  /**
   * Initialize Permissions API
   */
  async initializePermissionsAPI() {
    try {
      // Query spatial permission (2025 unified permission)
      if (this.features.spatialPermission) {
        const spatialPermission = await navigator.permissions.query({ name: 'xr-spatial' }).catch(() => null);
        if (spatialPermission) {
          this.permissions.spatial = spatialPermission.state;

          // Listen for permission changes
          spatialPermission.addEventListener('change', () => {
            this.permissions.spatial = spatialPermission.state;
            this.log('Spatial permission changed:', spatialPermission.state);
          });
        }
      }

      // Query hand tracking permission
      if (this.features.handTracking) {
        const handPermission = await navigator.permissions.query({ name: 'xr-hand-tracking' }).catch(() => null);
        if (handPermission) {
          this.permissions.handTracking = handPermission.state;
        }
      }

    } catch (error) {
      this.warn('Permissions API not fully supported:', error);
    }
  }

  /**
   * Request XR session with optimal spatial features
   * @param {string} mode - Session mode ('immersive-vr' or 'immersive-ar')
   * @param {Object} options - Custom session options
   * @returns {Promise<XRSession>} XR session
   */
  async requestSession(mode = 'immersive-vr', options = {}) {
    this.log(`Requesting ${mode} session with spatial features...`);

    try {
      // Build feature list based on support
      const requiredFeatures = options.requiredFeatures || ['local-floor'];
      const optionalFeatures = options.optionalFeatures || [];

      // Add spatial features if supported
      if (this.features.spatialPermission) {
        // Use unified spatial permission (2025)
        optionalFeatures.push('spatial');
        this.log('Added unified spatial permission');
      } else {
        // Fallback to individual features
        if (this.features.depthSensing) {
          optionalFeatures.push('depth-sensing');
        }
        if (this.features.planeDetection) {
          optionalFeatures.push('plane-detection');
        }
      }

      // Add mesh detection (Quest 3)
      if (this.features.meshDetection) {
        optionalFeatures.push('mesh-detection');
        this.log('Added mesh detection (Quest 3)');
      }

      // Add hand tracking
      if (this.features.handTracking) {
        optionalFeatures.push('hand-tracking');
      }

      // Add hit-test
      optionalFeatures.push('hit-test');

      // Request session
      const session = await navigator.xr.requestSession(mode, {
        requiredFeatures,
        optionalFeatures: [...new Set(optionalFeatures)] // Remove duplicates
      });

      this.log('Session created with features:', session.enabledFeatures);

      // Store enabled features
      this.sessionFeatures.enabled = session.enabledFeatures || [];

      return session;

    } catch (error) {
      this.error('Failed to request session:', error);
      throw error;
    }
  }

  /**
   * Request specific spatial permission
   * @param {string} permissionType - 'spatial', 'hand-tracking', 'camera'
   * @returns {Promise<string>} Permission state ('granted', 'denied', 'prompt')
   */
  async requestPermission(permissionType) {
    this.log(`Requesting ${permissionType} permission...`);

    try {
      if (!navigator.permissions) {
        throw new Error('Permissions API not supported');
      }

      let permissionName;
      switch (permissionType) {
        case 'spatial':
          permissionName = 'xr-spatial';
          break;
        case 'hand-tracking':
          permissionName = 'xr-hand-tracking';
          break;
        case 'camera':
          permissionName = 'camera';
          break;
        default:
          throw new Error(`Unknown permission type: ${permissionType}`);
      }

      const result = await navigator.permissions.query({ name: permissionName });
      this.permissions[permissionType] = result.state;

      this.log(`${permissionType} permission:`, result.state);
      return result.state;

    } catch (error) {
      this.warn(`Failed to request ${permissionType} permission:`, error);
      return 'unknown';
    }
  }

  /**
   * Get permission status for all spatial features
   * @returns {Object} Permission states
   */
  getPermissionStatus() {
    return {
      spatial: this.permissions.spatial || 'unknown',
      handTracking: this.permissions.handTracking || 'unknown',
      camera: this.permissions.camera || 'unknown',
      worldSensing: this.permissions.worldSensing || 'unknown'
    };
  }

  /**
   * Get supported spatial features
   * @returns {Object} Feature support
   */
  getSupportedFeatures() {
    return { ...this.features };
  }

  /**
   * Check if spatial features are available
   * @returns {boolean} Spatial features available
   */
  hasSpatialFeatures() {
    return this.features.spatialPermission ||
           this.features.depthSensing ||
           this.features.planeDetection ||
           this.features.meshDetection;
  }

  /**
   * Get recommended session configuration
   * @param {string} mode - Session mode
   * @returns {Object} Session configuration
   */
  getRecommendedConfig(mode = 'immersive-vr') {
    const config = {
      mode,
      requiredFeatures: ['local-floor'],
      optionalFeatures: []
    };

    // Add spatial features based on platform
    if (this.platform === 'meta-quest') {
      // Meta Quest: Prioritize mesh detection and depth sensing
      if (this.features.meshDetection) config.optionalFeatures.push('mesh-detection');
      if (this.features.depthSensing) config.optionalFeatures.push('depth-sensing');
    } else if (this.platform === 'android-xr') {
      // Android XR: Use unified spatial permission
      if (this.features.spatialPermission) config.optionalFeatures.push('spatial');
    } else if (this.platform === 'vision-pro') {
      // Vision Pro: Prioritize hand tracking and plane detection
      if (this.features.handTracking) config.optionalFeatures.push('hand-tracking');
      if (this.features.planeDetection) config.optionalFeatures.push('plane-detection');
    } else {
      // Generic: Request all available features
      if (this.features.spatialPermission) {
        config.optionalFeatures.push('spatial');
      } else {
        if (this.features.depthSensing) config.optionalFeatures.push('depth-sensing');
        if (this.features.planeDetection) config.optionalFeatures.push('plane-detection');
      }
    }

    // Always add hand tracking and hit-test if available
    if (this.features.handTracking) config.optionalFeatures.push('hand-tracking');
    config.optionalFeatures.push('hit-test');

    return config;
  }

  /**
   * Log debug message
   */
  log(...args) {
    if (this.debug) {
      console.log('[VRSpatialPermissions]', ...args);
    }
  }

  /**
   * Log warning message
   */
  warn(...args) {
    console.warn('[VRSpatialPermissions]', ...args);
  }

  /**
   * Log error message
   */
  error(...args) {
    console.error('[VRSpatialPermissions]', ...args);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRSpatialPermissionsManager;
}
