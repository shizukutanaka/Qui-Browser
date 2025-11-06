/**
 * Mixed Reality (Passthrough) System
 * Enables AR mode with real-world overlay for Quest 2/3
 *
 * John Carmack principle: AR is the future, VR is the present
 */

import * as THREE from 'three';

export class MixedReality {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.enabled = false;
    this.mode = 'vr'; // 'vr', 'ar', 'passthrough'

    // AR session
    this.xrSession = null;
    this.referenceSpace = null;

    // Plane detection
    this.detectedPlanes = new Map();
    this.planeVisualizers = new Map();

    // Anchors for persistent content
    this.anchors = new Map();

    // Hit testing
    this.hitTestSource = null;
    this.hitTestResults = [];

    // Settings
    this.settings = {
      planeDetection: true,
      lightEstimation: true,
      depthSensing: false,
      environmentBlendMode: 'opaque', // 'opaque', 'additive', 'alpha-blend'
      passthroughOpacity: 0.3
    };

    // Statistics
    this.stats = {
      planesDetected: 0,
      anchorsCreated: 0,
      hitTests: 0,
      sessionTime: 0
    };
  }

  /**
   * Check AR/MR support
   */
  async checkSupport() {
    if (!navigator.xr) {
      console.warn('MixedReality: WebXR not supported');
      return false;
    }

    const isARSupported = await navigator.xr.isSessionSupported('immersive-ar');
    const isVRSupported = await navigator.xr.isSessionSupported('immersive-vr');

    console.log('MixedReality: Support check:', {
      ar: isARSupported,
      vr: isVRSupported
    });

    return {
      ar: isARSupported,
      vr: isVRSupported,
      passthrough: isARSupported || this.hasPassthroughExtension()
    };
  }

  /**
   * Check for passthrough extension (Quest specific)
   */
  hasPassthroughExtension() {
    // Check for Oculus/Meta passthrough extensions
    if (window.OculusBrowserExt) {
      return true;
    }

    // Check WebXR extensions
    if (navigator.xr && navigator.xr.isSessionSupported) {
      // Quest browsers may support passthrough as an extension
      return true; // Simplified - would check specific extensions
    }

    return false;
  }

  /**
   * Start AR/MR session
   */
  async startSession(mode = 'ar') {
    this.mode = mode;

    try {
      // Session options based on mode
      const sessionOptions = this.getSessionOptions(mode);

      // Request session
      this.xrSession = await navigator.xr.requestSession(
        mode === 'vr' ? 'immersive-vr' : 'immersive-ar',
        sessionOptions
      );

      // Setup session
      await this.setupSession();

      this.enabled = true;
      this.stats.sessionStartTime = performance.now();

      console.log(`MixedReality: ${mode.toUpperCase()} session started`);
      return true;

    } catch (error) {
      console.error('MixedReality: Failed to start session', error);
      return false;
    }
  }

  /**
   * Get session options based on mode
   */
  getSessionOptions(mode) {
    const baseOptions = {
      requiredFeatures: ['local-floor'],
      optionalFeatures: []
    };

    if (mode === 'ar' || mode === 'passthrough') {
      // AR-specific features
      baseOptions.requiredFeatures.push('hit-test');
      baseOptions.optionalFeatures.push(
        'plane-detection',
        'anchors',
        'light-estimation',
        'depth-sensing',
        'camera-access',
        'dom-overlay'
      );

      // DOM overlay for UI elements
      if (document.body) {
        baseOptions.domOverlay = { root: document.body };
      }
    }

    if (mode === 'passthrough') {
      // Quest-specific passthrough
      baseOptions.optionalFeatures.push(
        'passthrough',
        'bounded-floor'
      );
    }

    return baseOptions;
  }

  /**
   * Setup AR/MR session
   */
  async setupSession() {
    if (!this.xrSession) return;

    // Setup reference space
    this.referenceSpace = await this.xrSession.requestReferenceSpace('local-floor');

    // Setup plane detection
    if (this.settings.planeDetection && this.mode !== 'vr') {
      this.setupPlaneDetection();
    }

    // Setup hit testing
    if (this.mode === 'ar') {
      await this.setupHitTesting();
    }

    // Setup light estimation
    if (this.settings.lightEstimation) {
      this.setupLightEstimation();
    }

    // Handle session end
    this.xrSession.addEventListener('end', () => {
      this.onSessionEnd();
    });

    // Update renderer
    this.renderer.xr.setSession(this.xrSession);
  }

  /**
   * Setup plane detection
   */
  setupPlaneDetection() {
    if (!this.xrSession.updateWorldTrackingState) return;

    // Enable plane detection
    this.xrSession.updateWorldTrackingState({
      planeDetectionState: {
        enabled: true
      }
    });

    console.log('MixedReality: Plane detection enabled');
  }

  /**
   * Setup hit testing
   */
  async setupHitTesting() {
    if (!this.xrSession) return;

    try {
      // Request hit test source
      const viewerSpace = await this.xrSession.requestReferenceSpace('viewer');
      this.hitTestSource = await this.xrSession.requestHitTestSource({
        space: viewerSpace,
        entityTypes: ['plane', 'mesh'],
        offsetRay: {
          origin: { x: 0, y: 0, z: 0 },
          direction: { x: 0, y: 0, z: -1 }
        }
      });

      console.log('MixedReality: Hit testing enabled');
    } catch (error) {
      console.warn('MixedReality: Hit testing not available', error);
    }
  }

  /**
   * Setup light estimation
   */
  setupLightEstimation() {
    // Light estimation provides real-world lighting for virtual objects
    if (this.xrSession.requestLightProbe) {
      this.xrSession.requestLightProbe({
        reflectionFormat: 'srgba8'
      }).then(lightProbe => {
        console.log('MixedReality: Light estimation enabled');
        this.lightProbe = lightProbe;
      }).catch(error => {
        console.warn('MixedReality: Light estimation not available', error);
      });
    }
  }

  /**
   * Update mixed reality frame
   */
  update(frame) {
    if (!this.enabled || !frame) return;

    // Update plane detection
    if (this.settings.planeDetection) {
      this.updatePlanes(frame);
    }

    // Update hit testing
    if (this.hitTestSource && frame.getHitTestResults) {
      this.updateHitTest(frame);
    }

    // Update light estimation
    if (this.lightProbe && frame.getLightEstimate) {
      this.updateLighting(frame);
    }

    // Update anchors
    this.updateAnchors(frame);
  }

  /**
   * Update detected planes
   */
  updatePlanes(frame) {
    if (!frame.detectedPlanes) return;

    frame.detectedPlanes.forEach(plane => {
      if (!this.detectedPlanes.has(plane)) {
        // New plane detected
        this.onPlaneDetected(plane);
      }

      // Update plane visualizer
      this.updatePlaneVisualizer(plane);
    });

    // Remove planes that are no longer detected
    this.detectedPlanes.forEach((planeData, plane) => {
      if (!frame.detectedPlanes.has(plane)) {
        this.onPlaneRemoved(plane);
      }
    });
  }

  /**
   * Handle new plane detection
   */
  onPlaneDetected(plane) {
    console.log('MixedReality: New plane detected', plane);

    // Store plane data
    this.detectedPlanes.set(plane, {
      id: `plane_${this.stats.planesDetected++}`,
      vertices: plane.polygon,
      orientation: plane.orientation || 'horizontal',
      timestamp: performance.now()
    });

    // Create visual representation
    this.createPlaneVisualizer(plane);
  }

  /**
   * Create plane visualizer
   */
  createPlaneVisualizer(plane) {
    const planeData = this.detectedPlanes.get(plane);
    if (!planeData || !planeData.vertices) return;

    // Create geometry from vertices
    const geometry = new THREE.BufferGeometry();
    const vertices = [];

    planeData.vertices.forEach(vertex => {
      vertices.push(vertex.x, vertex.y, vertex.z);
    });

    geometry.setAttribute('position',
      new THREE.Float32BufferAttribute(vertices, 3));

    // Create material
    const material = new THREE.MeshBasicMaterial({
      color: planeData.orientation === 'horizontal' ? 0x00ff00 : 0x0000ff,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    });

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = planeData.id;

    // Add wireframe
    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0xffffff })
    );
    mesh.add(line);

    // Add to scene
    this.scene.add(mesh);
    this.planeVisualizers.set(plane, mesh);
  }

  /**
   * Update plane visualizer
   */
  updatePlaneVisualizer(plane) {
    const mesh = this.planeVisualizers.get(plane);
    if (!mesh) return;

    // Update position/orientation if plane moved
    const planeData = this.detectedPlanes.get(plane);
    if (planeData && planeData.vertices) {
      // Update geometry if vertices changed
      const vertices = [];
      planeData.vertices.forEach(vertex => {
        vertices.push(vertex.x, vertex.y, vertex.z);
      });

      mesh.geometry.setAttribute('position',
        new THREE.Float32BufferAttribute(vertices, 3));
    }
  }

  /**
   * Handle plane removal
   */
  onPlaneRemoved(plane) {
    console.log('MixedReality: Plane removed');

    // Remove visualizer
    const mesh = this.planeVisualizers.get(plane);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }

    // Clean up
    this.detectedPlanes.delete(plane);
    this.planeVisualizers.delete(plane);
  }

  /**
   * Update hit testing
   */
  updateHitTest(frame) {
    if (!this.hitTestSource) return;

    const results = frame.getHitTestResults(this.hitTestSource);
    if (results.length > 0) {
      this.hitTestResults = results;
      this.stats.hitTests++;

      // Get first hit
      const hit = results[0];
      const pose = hit.getPose(this.referenceSpace);

      if (pose) {
        this.onHitTestResult(pose);
      }
    }
  }

  /**
   * Handle hit test result
   */
  onHitTestResult(pose) {
    // Override in application to handle hit results
    // For example, show placement preview
  }

  /**
   * Place object at hit position
   */
  async placeObject(object, hitResult) {
    if (!hitResult) return;

    const pose = hitResult.getPose(this.referenceSpace);
    if (!pose) return;

    // Set object position
    const position = pose.transform.position;
    object.position.set(position.x, position.y, position.z);

    // Create anchor for persistence
    if (hitResult.createAnchor) {
      try {
        const anchor = await hitResult.createAnchor();
        this.anchors.set(object, anchor);
        this.stats.anchorsCreated++;
        console.log('MixedReality: Anchor created');
      } catch (error) {
        console.warn('MixedReality: Failed to create anchor', error);
      }
    }

    // Add to scene
    this.scene.add(object);
  }

  /**
   * Update anchors
   */
  updateAnchors(frame) {
    this.anchors.forEach((anchor, object) => {
      if (anchor.anchorSpace) {
        const pose = frame.getPose(anchor.anchorSpace, this.referenceSpace);
        if (pose) {
          const position = pose.transform.position;
          object.position.set(position.x, position.y, position.z);

          const orientation = pose.transform.orientation;
          object.quaternion.set(
            orientation.x,
            orientation.y,
            orientation.z,
            orientation.w
          );
        }
      }
    });
  }

  /**
   * Update lighting from real world
   */
  updateLighting(frame) {
    if (!this.lightProbe) return;

    const lightEstimate = frame.getLightEstimate(this.lightProbe);
    if (!lightEstimate) return;

    // Update scene lighting based on real-world light
    if (lightEstimate.sphericalHarmonicsCoefficients) {
      // Apply spherical harmonics to scene lighting
      // This would update environment map for PBR materials
    }

    // Update primary light direction and intensity
    if (lightEstimate.primaryLightDirection) {
      const dir = lightEstimate.primaryLightDirection;
      const intensity = lightEstimate.primaryLightIntensity || 1;

      // Find or create directional light
      let light = this.scene.getObjectByName('AR_DirectionalLight');
      if (!light) {
        light = new THREE.DirectionalLight(0xffffff, 1);
        light.name = 'AR_DirectionalLight';
        this.scene.add(light);
      }

      light.position.set(dir.x * 10, dir.y * 10, dir.z * 10);
      light.intensity = intensity;
    }
  }

  /**
   * Toggle passthrough mode (Quest specific)
   */
  togglePassthrough() {
    if (!this.xrSession) return;

    // Toggle between opaque and alpha-blend
    const newMode = this.settings.environmentBlendMode === 'opaque'
      ? 'alpha-blend'
      : 'opaque';

    this.settings.environmentBlendMode = newMode;

    // Apply to session if supported
    if (this.xrSession.updateRenderState) {
      this.xrSession.updateRenderState({
        environmentBlendMode: newMode
      });
    }

    console.log(`MixedReality: Passthrough mode: ${newMode}`);
  }

  /**
   * Set passthrough opacity
   */
  setPassthroughOpacity(opacity) {
    this.settings.passthroughOpacity = Math.max(0, Math.min(1, opacity));

    // Update background opacity
    if (this.scene.background) {
      // Adjust scene background alpha for passthrough effect
      if (this.scene.background instanceof THREE.Color) {
        // Would need custom shader for true passthrough
      }
    }
  }

  /**
   * Handle session end
   */
  onSessionEnd() {
    this.enabled = false;

    // Calculate session time
    if (this.stats.sessionStartTime) {
      this.stats.sessionTime = performance.now() - this.stats.sessionStartTime;
    }

    // Clean up visualizers
    this.planeVisualizers.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    });

    // Clear data
    this.detectedPlanes.clear();
    this.planeVisualizers.clear();
    this.anchors.clear();
    this.hitTestSource = null;

    console.log('MixedReality: Session ended');
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      mode: this.mode,
      enabled: this.enabled,
      planesDetected: this.detectedPlanes.size,
      anchorsActive: this.anchors.size
    };
  }

  /**
   * Dispose
   */
  dispose() {
    if (this.xrSession) {
      this.xrSession.end();
    }

    this.onSessionEnd();
  }
}

/**
 * Usage Example:
 *
 * const mr = new MixedReality(renderer, scene);
 *
 * // Check support
 * const support = await mr.checkSupport();
 * if (support.ar) {
 *   // Start AR session
 *   await mr.startSession('ar');
 * }
 *
 * // In render loop
 * function render(timestamp, frame) {
 *   mr.update(frame);
 *
 *   // Place object on tap
 *   if (userTapped && mr.hitTestResults.length > 0) {
 *     const cube = new THREE.Mesh(
 *       new THREE.BoxGeometry(0.1, 0.1, 0.1),
 *       new THREE.MeshPhongMaterial({ color: 0xff0000 })
 *     );
 *     mr.placeObject(cube, mr.hitTestResults[0]);
 *   }
 * }
 *
 * // Toggle passthrough
 * mr.togglePassthrough();
 */