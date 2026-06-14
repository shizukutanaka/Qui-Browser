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

    // Mesh detection (real-world reconstruction; FR-6.4)
    this.detectedMeshes = new Map();
    this.meshVisualizers = new Map();

    // Depth sensing (FR-6.4): latest per-frame CPU depth buffer for occlusion
    // queries. Real depth-tested occlusion needs a shader pass; this exposes
    // the data layer (getDepthInMeters) that such a pass would consume.
    this.latestDepth = null;

    // Anchors for persistent content: object → { nativeAnchor, id }
    this.anchors = new Map();

    // IndexedDB for cross-session anchor persistence (FR-6.3).
    this._db = null;
    this._dbReady = this._openDB();

    // Hit testing
    this.hitTestSource = null;
    this.hitTestResults = [];

    // Settings
    this.settings = {
      planeDetection: true,
      meshDetection: true,
      lightEstimation: true,
      depthSensing: false,
      environmentBlendMode: 'opaque', // 'opaque', 'additive', 'alpha-blend'
      passthroughOpacity: 0.3
    };

    // Statistics
    this.stats = {
      planesDetected: 0,
      meshesDetected: 0,
      anchorsCreated: 0,
      hitTests: 0,
      depthFrames: 0,
      sessionTime: 0
    };
  }

  // ── IndexedDB persistence (FR-6.3) ────────────────────────────────────────

  /**
   * Open (or create) the QuiBrowserMR IndexedDB database.
   * Resolves to the IDBDatabase instance, or null when IndexedDB is unavailable
   * (e.g. in unit tests or private-browsing with blocked storage).
   */
  async _openDB() {
    if (typeof indexedDB === 'undefined') {
      return null;
    }
    return new Promise((resolve) => {
      const req = indexedDB.open('QuiBrowserMR', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('anchors')) {
          db.createObjectStore('anchors', { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => {
        this._db = e.target.result;
        resolve(this._db);
      };
      req.onerror = () => resolve(null); // non-fatal
    });
  }

  /**
   * Persist one anchor record. Non-blocking — errors are logged and swallowed.
   */
  async _saveAnchorRecord(record) {
    await this._dbReady;
    if (!this._db) {
      return;
    }
    try {
      const tx = this._db.transaction('anchors', 'readwrite');
      tx.onerror = () => console.warn('MixedReality: Failed to save anchor', tx.error);
      tx.objectStore('anchors').put(record);
    } catch (e) {
      console.warn('MixedReality: Failed to save anchor', e);
    }
  }

  /**
   * Delete one persisted anchor by id.
   */
  async _deleteAnchorRecord(id) {
    await this._dbReady;
    if (!this._db) {
      return;
    }
    try {
      const tx = this._db.transaction('anchors', 'readwrite');
      tx.onerror = () => console.warn('MixedReality: Failed to delete anchor', tx.error);
      tx.objectStore('anchors').delete(id);
    } catch (e) {
      console.warn('MixedReality: Failed to delete anchor', e);
    }
  }

  /**
   * Return all persisted anchor records from IndexedDB.
   * Each record: { id, label, position:{x,y,z}, quaternion:{x,y,z,w}, timestamp }
   */
  async loadSavedAnchors() {
    await this._dbReady;
    if (!this._db) {
      return [];
    }
    return new Promise((resolve) => {
      try {
        const tx = this._db.transaction('anchors', 'readonly');
        const req = tx.objectStore('anchors').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  /**
   * Remove a persisted anchor by its id and detach it from the current session.
   */
  async deletePersistedAnchor(id) {
    await this._deleteAnchorRecord(id);
    // Also remove from the in-memory map if still active.
    this.anchors.forEach((data, obj) => {
      if (data.id === id) {
        this.anchors.delete(obj);
        this.scene.remove(obj);
      }
    });
  }

  /**
   * Wipe all persisted anchors from IndexedDB.
   */
  async clearSavedAnchors() {
    await this._dbReady;
    if (!this._db) {
      return;
    }
    try {
      const tx = this._db.transaction('anchors', 'readwrite');
      tx.objectStore('anchors').clear();
    } catch (e) {
      console.warn('MixedReality: Failed to clear anchors', e);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────

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

    console.debug('MixedReality: Support check:', {
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

      console.debug(`MixedReality: ${mode.toUpperCase()} session started`);
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
    if (!this.xrSession) {
      return;
    }

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

    // Handle session end — store the callback so dispose() can remove it.
    this._onSessionEndBound = () => this.onSessionEnd();
    this.xrSession.addEventListener('end', this._onSessionEndBound);

    // Update renderer
    this.renderer.xr.setSession(this.xrSession);
  }

  /**
   * Setup plane detection
   */
  setupPlaneDetection() {
    if (!this.xrSession.updateWorldTrackingState) {
      return;
    }

    // Enable plane detection
    this.xrSession.updateWorldTrackingState({
      planeDetectionState: {
        enabled: true
      }
    });

    console.debug('MixedReality: Plane detection enabled');
  }

  /**
   * Setup hit testing
   */
  async setupHitTesting() {
    if (!this.xrSession) {
      return;
    }

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

      console.debug('MixedReality: Hit testing enabled');
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
        console.debug('MixedReality: Light estimation enabled');
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
    if (!this.enabled || !frame) {
      return;
    }

    // Update plane detection
    if (this.settings.planeDetection) {
      this.updatePlanes(frame);
    }

    // Update mesh detection (FR-6.4)
    if (this.settings.meshDetection) {
      this.updateMeshes(frame);
    }

    // Update depth sensing (FR-6.4)
    if (this.settings.depthSensing) {
      this.updateDepth(frame);
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
    if (!frame.detectedPlanes) {
      return;
    }

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
    console.debug('MixedReality: New plane detected', plane);

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
    if (!planeData || !planeData.vertices) {
      return;
    }

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
    if (!mesh) {
      return;
    }

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
    console.debug('MixedReality: Plane removed');

    // Remove visualizer (including the wireframe LineSegments child, whose
    // geometry/material would otherwise leak).
    const mesh = this.planeVisualizers.get(plane);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.traverse(obj => {
        if (obj.geometry) {
          obj.geometry.dispose();
        }
        if (obj.material) {
          obj.material.dispose();
        }
      });
    }

    // Clean up
    this.detectedPlanes.delete(plane);
    this.planeVisualizers.delete(plane);
  }

  // ── Mesh detection (FR-6.4) ───────────────────────────────────────────────

  /**
   * Update real-world mesh reconstruction from frame.detectedMeshes.
   * Like planes, meshes are a live Set: new ones are visualized, vanished ones
   * are torn down.
   */
  updateMeshes(frame) {
    if (!frame.detectedMeshes) {
      return;
    }

    frame.detectedMeshes.forEach(mesh => {
      if (!this.detectedMeshes.has(mesh)) {
        this.onMeshDetected(mesh);
      }
    });

    // Remove meshes no longer reported by the runtime.
    this.detectedMeshes.forEach((meshData, mesh) => {
      if (!frame.detectedMeshes.has(mesh)) {
        this.onMeshRemoved(mesh);
      }
    });
  }

  /**
   * Handle a newly detected real-world mesh.
   */
  onMeshDetected(mesh) {
    this.detectedMeshes.set(mesh, {
      id: `mesh_${this.stats.meshesDetected++}`,
      label: mesh.semanticLabel || 'mesh',
      timestamp: performance.now()
    });
    this.createMeshVisualizer(mesh);
  }

  /**
   * Build a wireframe visualizer for a detected mesh from its vertex/index data.
   */
  createMeshVisualizer(mesh) {
    const meshData = this.detectedMeshes.get(mesh);
    if (!meshData || !mesh.vertices) {
      return;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',
      new THREE.Float32BufferAttribute(mesh.vertices, 3));
    if (mesh.indices) {
      geometry.setIndex(new THREE.Uint32BufferAttribute(mesh.indices, 1));
    }

    const material = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });

    const visual = new THREE.Mesh(geometry, material);
    visual.name = meshData.id;
    this.scene.add(visual);
    this.meshVisualizers.set(mesh, visual);
  }

  /**
   * Handle a mesh that is no longer tracked: dispose its visualizer.
   */
  onMeshRemoved(mesh) {
    const visual = this.meshVisualizers.get(mesh);
    if (visual) {
      this.scene.remove(visual);
      visual.geometry.dispose();
      visual.material.dispose();
    }
    this.detectedMeshes.delete(mesh);
    this.meshVisualizers.delete(mesh);
  }

  // ── Depth sensing (FR-6.4) ────────────────────────────────────────────────

  /**
   * Capture the CPU depth buffer for the current frame (one eye is enough for
   * occlusion sampling). Stored on this.latestDepth; query via getDepthInMeters.
   */
  updateDepth(frame) {
    if (typeof frame.getDepthInformation !== 'function' ||
        typeof frame.getViewerPose !== 'function' ||
        !this.referenceSpace) {
      return;
    }

    const pose = frame.getViewerPose(this.referenceSpace);
    if (!pose || !pose.views) {
      return;
    }

    for (const view of pose.views) {
      const depth = frame.getDepthInformation(view);
      if (depth) {
        this.latestDepth = depth;
        this.stats.depthFrames++;
        return;
      }
    }
  }

  /**
   * Sample the real-world depth (metres) at a normalized view coordinate
   * (0–1, 0–1). Returns null when no depth buffer is available.
   * Useful for occluding virtual objects behind real geometry.
   */
  getDepthInMeters(normX, normY) {
    const d = this.latestDepth;
    if (!d || typeof d.getDepthInMeters !== 'function') {
      return null;
    }
    try {
      return d.getDepthInMeters(normX, normY);
    } catch (e) {
      return null;
    }
  }

  /**
   * Update hit testing
   */
  updateHitTest(frame) {
    if (!this.hitTestSource) {
      return;
    }

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
  onHitTestResult(_pose) {
    // Override in application to handle hit results
    // For example, show placement preview
  }

  /**
   * Place object at hit position
   */
  async placeObject(object, hitResult) {
    if (!hitResult) {
      return;
    }

    const pose = hitResult.getPose(this.referenceSpace);
    if (!pose) {
      return;
    }

    // Set object position
    const position = pose.transform.position;
    const orientation = pose.transform.orientation;
    object.position.set(position.x, position.y, position.z);
    object.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);

    const anchorId = `anchor_${Date.now()}_${this.stats.anchorsCreated}`;

    // Create native XR anchor when available (ties the virtual object to the
    // real-world tracking surface for sub-mm drift correction).
    let nativeAnchor = null;
    if (hitResult.createAnchor) {
      try {
        nativeAnchor = await hitResult.createAnchor();
        console.debug('MixedReality: Native anchor created');
      } catch (error) {
        console.warn('MixedReality: Native anchor not available, using pose only', error);
      }
    }

    this.anchors.set(object, { nativeAnchor, id: anchorId });
    this.stats.anchorsCreated++;

    // Persist pose to IndexedDB so it survives page reload (FR-6.3).
    this._saveAnchorRecord({
      id: anchorId,
      label: object.name || 'object',
      position: { x: position.x, y: position.y, z: position.z },
      quaternion: { x: orientation.x, y: orientation.y, z: orientation.z, w: orientation.w },
      timestamp: Date.now()
    });

    // Add to scene
    this.scene.add(object);
  }

  /**
   * Update anchors
   */
  updateAnchors(frame) {
    this.anchors.forEach(({ nativeAnchor }, object) => {
      if (!nativeAnchor || !nativeAnchor.anchorSpace) {
        return;
      }
      const pose = frame.getPose(nativeAnchor.anchorSpace, this.referenceSpace);
      if (pose) {
        const p = pose.transform.position;
        object.position.set(p.x, p.y, p.z);
        const q = pose.transform.orientation;
        object.quaternion.set(q.x, q.y, q.z, q.w);
      }
    });
  }

  /**
   * Update lighting from real world
   */
  updateLighting(frame) {
    if (!this.lightProbe) {
      return;
    }

    const lightEstimate = frame.getLightEstimate(this.lightProbe);
    if (!lightEstimate) {
      return;
    }

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
    if (!this.xrSession) {
      return;
    }

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

    console.debug(`MixedReality: Passthrough mode: ${newMode}`);
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

    // Clean up plane visualizers
    this.planeVisualizers.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    });

    // Clean up mesh visualizers (FR-6.4)
    this.meshVisualizers.forEach(visual => {
      this.scene.remove(visual);
      visual.geometry.dispose();
      visual.material.dispose();
    });

    // Clear in-memory tracking — persisted records in IndexedDB are kept so
    // they can be restored on the next session (FR-6.3).
    this.detectedPlanes.clear();
    this.planeVisualizers.clear();
    this.detectedMeshes.clear();
    this.meshVisualizers.clear();
    this.latestDepth = null;
    this.anchors.clear();
    this.hitTestSource = null;

    console.debug('MixedReality: Session ended');
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
      meshesDetected: this.detectedMeshes.size,
      depthAvailable: !!this.latestDepth,
      anchorsActive: this.anchors.size
    };
  }

  /**
   * Dispose
   */
  dispose() {
    if (this.xrSession) {
      // Remove the listener first so the async 'end' event doesn't trigger a
      // second onSessionEnd() call after we explicitly invoke it below.
      if (this._onSessionEndBound) {
        this.xrSession.removeEventListener('end', this._onSessionEndBound);
        this._onSessionEndBound = null;
      }
      this.xrSession.end();
      this.xrSession = null;
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
