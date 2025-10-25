/**
 * WebXR Scene Understanding with Semantic Labels (2025)
 *
 * Advanced scene understanding for mixed reality experiences
 * - Semantic classification (floor, wall, ceiling, furniture, etc.)
 * - Real-time mesh detection and plane detection
 * - Scene anchors with persistent tracking
 * - Spatial entity system
 * - Quest 3 Scene API integration
 *
 * Semantic Labels Supported:
 * - FLOOR, CEILING, WALL_FACE, WINDOW_FRAME, DOOR_FRAME
 * - TABLE, COUCH, SCREEN, LAMP, PLANT, BED, STORAGE, DESK
 * - OTHER (fallback for unknown objects)
 *
 * @author Qui Browser Team
 * @version 5.4.0
 * @license MIT
 */

class VRSceneUnderstanding {
  constructor(options = {}) {
    this.version = '5.4.0';
    this.debug = options.debug || false;

    // XR session and reference space
    this.xrSession = null;
    this.xrRefSpace = null;

    // Scene understanding features
    this.meshDetectionSupported = false;
    this.planeDetectionSupported = false;
    this.semanticLabelsSupported = false;

    // Detected scene elements
    this.detectedPlanes = new Map(); // planeId -> PlaneData
    this.detectedMeshes = new Map(); // meshId -> MeshData
    this.sceneAnchors = new Map();   // anchorId -> AnchorData

    // Semantic classification
    this.semanticLabels = {
      FLOOR: 'floor',
      CEILING: 'ceiling',
      WALL_FACE: 'wall',
      WINDOW_FRAME: 'window',
      DOOR_FRAME: 'door',
      TABLE: 'table',
      COUCH: 'couch',
      SCREEN: 'screen',
      LAMP: 'lamp',
      PLANT: 'plant',
      BED: 'bed',
      STORAGE: 'storage',
      DESK: 'desk',
      OTHER: 'other'
    };

    // Statistics
    this.stats = {
      planesCount: 0,
      meshesCount: 0,
      anchorsCount: 0,
      semanticLabelsFound: {}
    };

    // Callbacks
    this.onPlaneDetected = options.onPlaneDetected || null;
    this.onMeshDetected = options.onMeshDetected || null;
    this.onAnchorCreated = options.onAnchorCreated || null;

    this.initialized = false;
  }

  /**
   * Initialize scene understanding
   * @param {XRSession} xrSession - WebXR session
   * @param {XRReferenceSpace} xrRefSpace - Reference space
   * @returns {Promise<boolean>} Success status
   */
  async initialize(xrSession, xrRefSpace) {
    this.log('Initializing Scene Understanding v5.4.0...');

    try {
      this.xrSession = xrSession;
      this.xrRefSpace = xrRefSpace;

      // Check feature support
      await this.checkFeatureSupport();

      this.initialized = true;
      this.log('Scene Understanding initialized');
      this.log('Mesh detection:', this.meshDetectionSupported);
      this.log('Plane detection:', this.planeDetectionSupported);
      this.log('Semantic labels:', this.semanticLabelsSupported);

      return true;

    } catch (error) {
      this.error('Initialization failed:', error);
      return false;
    }
  }

  /**
   * Check feature support
   */
  async checkFeatureSupport() {
    const enabledFeatures = this.xrSession.enabledFeatures || [];

    this.meshDetectionSupported = enabledFeatures.includes('mesh-detection');
    this.planeDetectionSupported = enabledFeatures.includes('plane-detection');

    // Semantic labels are typically available with mesh/plane detection
    this.semanticLabelsSupported = this.meshDetectionSupported || this.planeDetectionSupported;

    this.log('Enabled features:', enabledFeatures);
  }

  /**
   * Update scene understanding (call each frame)
   * @param {XRFrame} xrFrame - XR frame
   */
  update(xrFrame) {
    if (!this.initialized) return;

    // Update detected planes
    if (this.planeDetectionSupported) {
      this.updatePlanes(xrFrame);
    }

    // Update detected meshes
    if (this.meshDetectionSupported) {
      this.updateMeshes(xrFrame);
    }

    // Update statistics
    this.updateStats();
  }

  /**
   * Update detected planes
   * @param {XRFrame} xrFrame - XR frame
   */
  updatePlanes(xrFrame) {
    try {
      const detectedPlanes = xrFrame.detectedPlanes;
      if (!detectedPlanes) return;

      // Process each detected plane
      for (const plane of detectedPlanes) {
        const planeId = this.getPlaneId(plane);

        // Check if this is a new or updated plane
        if (!this.detectedPlanes.has(planeId) ||
            plane.lastChangedTime > this.detectedPlanes.get(planeId).lastUpdate) {

          const planeData = this.processPlane(plane, xrFrame);
          this.detectedPlanes.set(planeId, planeData);

          // Trigger callback
          if (this.onPlaneDetected) {
            this.onPlaneDetected(planeData);
          }

          this.log('Plane detected:', planeData.semanticLabel, planeData.area, 'm²');
        }
      }

      // Remove planes that are no longer detected
      for (const [planeId, planeData] of this.detectedPlanes.entries()) {
        if (!Array.from(detectedPlanes).some(p => this.getPlaneId(p) === planeId)) {
          this.detectedPlanes.delete(planeId);
          this.log('Plane removed:', planeId);
        }
      }

    } catch (error) {
      // Plane detection may not be available every frame
    }
  }

  /**
   * Process detected plane
   * @param {XRPlane} plane - Detected plane
   * @param {XRFrame} xrFrame - XR frame
   * @returns {Object} Plane data
   */
  processPlane(plane, xrFrame) {
    // Get plane pose
    const pose = xrFrame.getPose(plane.planeSpace, this.xrRefSpace);

    // Get plane polygon
    const polygon = plane.polygon || [];

    // Calculate plane area
    const area = this.calculatePolygonArea(polygon);

    // Get semantic label
    const semanticLabel = this.getSemanticLabel(plane);

    // Determine plane orientation
    const orientation = this.determinePlaneOrientation(pose);

    return {
      id: this.getPlaneId(plane),
      pose: pose,
      polygon: Array.from(polygon),
      area: area,
      semanticLabel: semanticLabel,
      orientation: orientation,
      lastUpdate: plane.lastChangedTime || Date.now(),
      planeSpace: plane.planeSpace
    };
  }

  /**
   * Update detected meshes
   * @param {XRFrame} xrFrame - XR frame
   */
  updateMeshes(xrFrame) {
    try {
      const detectedMeshes = xrFrame.detectedMeshes;
      if (!detectedMeshes) return;

      // Process each detected mesh
      for (const mesh of detectedMeshes) {
        const meshId = this.getMeshId(mesh);

        // Check if this is a new or updated mesh
        if (!this.detectedMeshes.has(meshId) ||
            mesh.lastChangedTime > this.detectedMeshes.get(meshId).lastUpdate) {

          const meshData = this.processMesh(mesh, xrFrame);
          this.detectedMeshes.set(meshId, meshData);

          // Trigger callback
          if (this.onMeshDetected) {
            this.onMeshDetected(meshData);
          }

          this.log('Mesh detected:', meshData.semanticLabel, meshData.triangleCount, 'triangles');
        }
      }

      // Remove meshes that are no longer detected
      for (const [meshId, meshData] of this.detectedMeshes.entries()) {
        if (!Array.from(detectedMeshes).some(m => this.getMeshId(m) === meshId)) {
          this.detectedMeshes.delete(meshId);
          this.log('Mesh removed:', meshId);
        }
      }

    } catch (error) {
      // Mesh detection may not be available every frame
    }
  }

  /**
   * Process detected mesh
   * @param {XRMesh} mesh - Detected mesh
   * @param {XRFrame} xrFrame - XR frame
   * @returns {Object} Mesh data
   */
  processMesh(mesh, xrFrame) {
    // Get mesh pose
    const pose = xrFrame.getPose(mesh.meshSpace, this.xrRefSpace);

    // Get mesh geometry
    const vertices = mesh.vertices ? Array.from(mesh.vertices) : [];
    const indices = mesh.indices ? Array.from(mesh.indices) : [];
    const triangleCount = indices.length / 3;

    // Get semantic label
    const semanticLabel = this.getSemanticLabel(mesh);

    return {
      id: this.getMeshId(mesh),
      pose: pose,
      vertices: vertices,
      indices: indices,
      triangleCount: triangleCount,
      semanticLabel: semanticLabel,
      lastUpdate: mesh.lastChangedTime || Date.now(),
      meshSpace: mesh.meshSpace
    };
  }

  /**
   * Get semantic label from plane or mesh
   * @param {XRPlane|XRMesh} sceneObject - Scene object
   * @returns {string} Semantic label
   */
  getSemanticLabel(sceneObject) {
    // Try to get semantic label from object
    if (sceneObject.semanticLabel) {
      return sceneObject.semanticLabel;
    }

    // Try to infer from object properties (fallback)
    if (sceneObject.orientation === 'horizontal' && sceneObject.position?.y < 0.5) {
      return this.semanticLabels.FLOOR;
    }

    if (sceneObject.orientation === 'horizontal' && sceneObject.position?.y > 2.0) {
      return this.semanticLabels.CEILING;
    }

    if (sceneObject.orientation === 'vertical') {
      return this.semanticLabels.WALL_FACE;
    }

    return this.semanticLabels.OTHER;
  }

  /**
   * Calculate polygon area
   * @param {Array} polygon - Polygon vertices
   * @returns {number} Area in square meters
   */
  calculatePolygonArea(polygon) {
    if (polygon.length < 3) return 0;

    let area = 0;
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      area += polygon[i].x * polygon[j].z;
      area -= polygon[j].x * polygon[i].z;
    }

    return Math.abs(area / 2);
  }

  /**
   * Determine plane orientation
   * @param {XRPose} pose - Plane pose
   * @returns {string} Orientation ('horizontal', 'vertical', or 'angled')
   */
  determinePlaneOrientation(pose) {
    if (!pose) return 'unknown';

    // Get normal vector from pose orientation
    const normal = this.quaternionToNormal(pose.transform.orientation);

    // Check angle with up vector (0, 1, 0)
    const dotUp = Math.abs(normal.y);

    if (dotUp > 0.9) {
      return 'horizontal';
    } else if (dotUp < 0.1) {
      return 'vertical';
    } else {
      return 'angled';
    }
  }

  /**
   * Convert quaternion to normal vector
   * @param {DOMPointReadOnly} q - Quaternion
   * @returns {Object} Normal vector {x, y, z}
   */
  quaternionToNormal(q) {
    return {
      x: 2 * (q.x * q.z + q.w * q.y),
      y: 2 * (q.y * q.z - q.w * q.x),
      z: 1 - 2 * (q.x * q.x + q.y * q.y)
    };
  }

  /**
   * Create anchor at position
   * @param {XRFrame} xrFrame - XR frame
   * @param {Object} position - Position {x, y, z}
   * @param {Object} orientation - Orientation quaternion
   * @returns {Promise<XRAnchor>} Created anchor
   */
  async createAnchor(xrFrame, position, orientation) {
    if (!this.xrSession) {
      throw new Error('XR session not initialized');
    }

    try {
      // Create rigid transform
      const transform = new XRRigidTransform(
        { x: position.x, y: position.y, z: position.z },
        orientation || { x: 0, y: 0, z: 0, w: 1 }
      );

      // Create anchor
      const anchor = await xrFrame.createAnchor(transform, this.xrRefSpace);

      if (anchor) {
        const anchorId = this.getAnchorId(anchor);
        this.sceneAnchors.set(anchorId, {
          id: anchorId,
          anchor: anchor,
          position: position,
          createdAt: Date.now()
        });

        // Trigger callback
        if (this.onAnchorCreated) {
          this.onAnchorCreated(anchor);
        }

        this.log('Anchor created:', anchorId);
        return anchor;
      }

    } catch (error) {
      this.error('Failed to create anchor:', error);
      throw error;
    }
  }

  /**
   * Get planes by semantic label
   * @param {string} label - Semantic label
   * @returns {Array} Matching planes
   */
  getPlanesByLabel(label) {
    return Array.from(this.detectedPlanes.values())
      .filter(plane => plane.semanticLabel === label);
  }

  /**
   * Get meshes by semantic label
   * @param {string} label - Semantic label
   * @returns {Array} Matching meshes
   */
  getMeshesByLabel(label) {
    return Array.from(this.detectedMeshes.values())
      .filter(mesh => mesh.semanticLabel === label);
  }

  /**
   * Get all floors
   * @returns {Array} Floor planes
   */
  getFloors() {
    return this.getPlanesByLabel(this.semanticLabels.FLOOR);
  }

  /**
   * Get all walls
   * @returns {Array} Wall planes
   */
  getWalls() {
    return this.getPlanesByLabel(this.semanticLabels.WALL_FACE);
  }

  /**
   * Get all furniture
   * @returns {Array} Furniture meshes/planes
   */
  getFurniture() {
    const furnitureLabels = [
      this.semanticLabels.TABLE,
      this.semanticLabels.COUCH,
      this.semanticLabels.BED,
      this.semanticLabels.DESK
    ];

    return Array.from(this.detectedMeshes.values())
      .concat(Array.from(this.detectedPlanes.values()))
      .filter(obj => furnitureLabels.includes(obj.semanticLabel));
  }

  /**
   * Update statistics
   */
  updateStats() {
    this.stats.planesCount = this.detectedPlanes.size;
    this.stats.meshesCount = this.detectedMeshes.size;
    this.stats.anchorsCount = this.sceneAnchors.size;

    // Count semantic labels
    this.stats.semanticLabelsFound = {};

    for (const plane of this.detectedPlanes.values()) {
      const label = plane.semanticLabel;
      this.stats.semanticLabelsFound[label] = (this.stats.semanticLabelsFound[label] || 0) + 1;
    }

    for (const mesh of this.detectedMeshes.values()) {
      const label = mesh.semanticLabel;
      this.stats.semanticLabelsFound[label] = (this.stats.semanticLabelsFound[label] || 0) + 1;
    }
  }

  /**
   * Get plane ID
   */
  getPlaneId(plane) {
    return `plane-${plane.lastChangedTime || Date.now()}`;
  }

  /**
   * Get mesh ID
   */
  getMeshId(mesh) {
    return `mesh-${mesh.lastChangedTime || Date.now()}`;
  }

  /**
   * Get anchor ID
   */
  getAnchorId(anchor) {
    return `anchor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats
    };
  }

  /**
   * Cleanup resources
   */
  dispose() {
    // Delete all anchors
    for (const anchorData of this.sceneAnchors.values()) {
      if (anchorData.anchor && anchorData.anchor.delete) {
        anchorData.anchor.delete();
      }
    }

    this.detectedPlanes.clear();
    this.detectedMeshes.clear();
    this.sceneAnchors.clear();

    this.log('Resources disposed');
  }

  /**
   * Log debug message
   */
  log(...args) {
    if (this.debug) {
      console.log('[VRSceneUnderstanding]', ...args);
    }
  }

  /**
   * Log warning message
   */
  warn(...args) {
    console.warn('[VRSceneUnderstanding]', ...args);
  }

  /**
   * Log error message
   */
  error(...args) {
    console.error('[VRSceneUnderstanding]', ...args);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRSceneUnderstanding;
}
