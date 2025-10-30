/**
 * WebXR Spatial Anchors System (2025)
 *
 * Persistent spatial anchor tracking for mixed reality experiences
 * - XRSpace-based coordinate system tracking
 * - Persistent anchors across sessions (Meta Quest)
 * - Real-time anchor updates (pose changes)
 * - Anchor lifetime management
 * - Spatial relationship tracking
 *
 * Features:
 * - Create anchors at specific 3D poses
 * - Track anchor pose changes over time
 * - Persist anchors across sessions (8 max on Quest)
 * - Delete and restore anchors
 * - Query anchors by ID or proximity
 * - Anchor-to-anchor spatial relationships
 *
 * WebXR Anchors Module (W3C):
 * - XRAnchor interface
 * - XRFrame.createAnchor() method
 * - Anchor pose tracking per frame
 * - Persistent anchor support (device-specific)
 *
 * Use Cases:
 * - Place virtual objects in real world
 * - Multi-user shared reference points
 * - Persistent AR content placement
 * - Spatial UI anchoring
 * - Environment-aware applications
 *
 * Research References:
 * - WebXR Anchors Module (W3C, 2025)
 * - Meta Quest persistent anchors
 * - Babylon.js WebXR anchors
 * - Spatial tracking explainer (immersive-web)
 *
 * @author Qui Browser Team
 * @version 5.7.0
 * @license MIT
 */

class VRSpatialAnchorsSystem {
  constructor(options = {}) {
    this.version = '5.7.0';
    this.debug = options.debug || false;

    // XR session and reference space
    this.xrSession = null;
    this.xrRefSpace = null;

    // Anchor support
    this.anchorsSupported = false;
    this.persistentAnchorsSupported = false;

    // Active anchors
    this.anchors = new Map(); // anchorId -> anchor data
    this.persistentAnchors = new Set(); // Set of persistent anchor UUIDs

    // Anchor limits (Meta Quest: 8 persistent anchors)
    this.maxPersistentAnchors = options.maxPersistentAnchors || 8;

    // Anchor metadata
    this.anchorMetadata = new Map(); // anchorId -> metadata

    // Callbacks
    this.onAnchorCreated = options.onAnchorCreated || null;
    this.onAnchorUpdated = options.onAnchorUpdated || null;
    this.onAnchorDeleted = options.onAnchorDeleted || null;

    // Statistics
    this.stats = {
      totalAnchors: 0,
      persistentAnchors: 0,
      frameUpdates: 0,
      averageUpdateTime: 0
    };

    this.initialized = false;
  }

  /**
   * Initialize spatial anchors system
   * @param {XRSession} xrSession - WebXR session
   * @param {XRReferenceSpace} xrRefSpace - Reference space
   * @returns {Promise<boolean>} Success status
   */
  async initialize(xrSession, xrRefSpace) {
    this.log('Initializing Spatial Anchors System v5.7.0...');

    try {
      this.xrSession = xrSession;
      this.xrRefSpace = xrRefSpace;

      // Check anchors support
      await this.checkAnchorsSupport();

      if (!this.anchorsSupported) {
        this.warn('Anchors not supported');
        return false;
      }

      // Restore persistent anchors if available
      if (this.persistentAnchorsSupported) {
        await this.restorePersistentAnchors();
      }

      this.initialized = true;
      this.log('Spatial Anchors System initialized');
      this.log('Anchors supported:', this.anchorsSupported);
      this.log('Persistent anchors supported:', this.persistentAnchorsSupported);
      this.log('Max persistent anchors:', this.maxPersistentAnchors);

      return true;

    } catch (error) {
      this.error('Initialization failed:', error);
      return false;
    }
  }

  /**
   * Check anchors support
   */
  async checkAnchorsSupport() {
    const enabledFeatures = this.xrSession.enabledFeatures || [];

    // Check basic anchors support
    this.anchorsSupported = enabledFeatures.includes('anchors');

    // Check persistent anchors support (Meta Quest specific)
    // Note: Persistent anchors require special permission
    this.persistentAnchorsSupported = this.anchorsSupported &&
                                       typeof this.xrSession.restorePersistentAnchor === 'function';

    if (this.anchorsSupported) {
      this.log('Anchors API available');
    }

    if (this.persistentAnchorsSupported) {
      this.log('Persistent anchors available');
    }
  }

  /**
   * Create anchor at pose
   * @param {XRRigidTransform} pose - Pose for anchor
   * @param {XRSpace} space - Optional space (defaults to reference space)
   * @param {boolean} persistent - Make anchor persistent
   * @param {Object} metadata - Optional metadata
   * @returns {Promise<string|null>} Anchor ID
   */
  async createAnchor(pose, space = null, persistent = false, metadata = {}) {
    if (!this.initialized || !this.anchorsSupported) {
      this.warn('Anchors not available');
      return null;
    }

    try {
      const anchorSpace = space || this.xrRefSpace;

      // Check persistent anchor limit
      if (persistent && this.persistentAnchors.size >= this.maxPersistentAnchors) {
        this.warn('Maximum persistent anchors reached:', this.maxPersistentAnchors);
        return null;
      }

      // Create anchor (note: createAnchor returns a Promise<XRAnchor>)
      const anchor = await this.xrSession.requestAnimationFrame((time, frame) => {
        return frame.createAnchor(pose, anchorSpace);
      });

      if (!anchor) {
        this.error('Failed to create anchor');
        return null;
      }

      // Generate anchor ID
      const anchorId = this.generateAnchorId();

      // Store anchor
      this.anchors.set(anchorId, {
        anchor: anchor,
        pose: pose,
        space: anchorSpace,
        persistent: persistent,
        createdAt: Date.now(),
        lastUpdated: Date.now()
      });

      // Store metadata
      if (Object.keys(metadata).length > 0) {
        this.anchorMetadata.set(anchorId, metadata);
      }

      // Track as persistent if requested
      if (persistent) {
        this.persistentAnchors.add(anchorId);
        this.stats.persistentAnchors++;

        // Save to persistent storage
        await this.savePersistentAnchor(anchorId, anchor);
      }

      this.stats.totalAnchors++;

      this.log('Anchor created:', anchorId, persistent ? '(persistent)' : '');

      // Trigger callback
      if (this.onAnchorCreated) {
        this.onAnchorCreated(anchorId, pose, metadata);
      }

      return anchorId;

    } catch (error) {
      this.error('Failed to create anchor:', error);
      return null;
    }
  }

  /**
   * Create anchor at position
   * @param {Object} position - Position {x, y, z}
   * @param {Object} orientation - Optional orientation {x, y, z, w}
   * @param {boolean} persistent - Make anchor persistent
   * @param {Object} metadata - Optional metadata
   * @returns {Promise<string|null>} Anchor ID
   */
  async createAnchorAtPosition(position, orientation = null, persistent = false, metadata = {}) {
    // Create rigid transform
    const pos = new DOMPointReadOnly(position.x, position.y, position.z, 1);
    const orient = orientation ?
                   new DOMPointReadOnly(orientation.x, orientation.y, orientation.z, orientation.w) :
                   new DOMPointReadOnly(0, 0, 0, 1);

    const pose = new XRRigidTransform(pos, orient);

    return await this.createAnchor(pose, null, persistent, metadata);
  }

  /**
   * Update anchors (call each frame)
   * @param {XRFrame} xrFrame - XR frame
   */
  update(xrFrame) {
    if (!this.initialized || !this.anchorsSupported) return;

    const startTime = performance.now();

    try {
      // Update all anchors
      for (const [anchorId, anchorData] of this.anchors.entries()) {
        const { anchor } = anchorData;

        // Get anchor pose
        const anchorPose = xrFrame.getPose(anchor.anchorSpace, this.xrRefSpace);

        if (anchorPose) {
          // Update stored pose
          anchorData.pose = anchorPose.transform;
          anchorData.lastUpdated = Date.now();

          // Trigger callback if pose changed significantly
          if (this.onAnchorUpdated) {
            this.onAnchorUpdated(anchorId, anchorPose.transform);
          }
        }
      }

      // Update stats
      const updateTime = performance.now() - startTime;
      this.stats.frameUpdates++;
      this.stats.averageUpdateTime = (this.stats.averageUpdateTime * (this.stats.frameUpdates - 1) + updateTime) / this.stats.frameUpdates;

    } catch (error) {
      // Anchor updates may fail temporarily
    }
  }

  /**
   * Delete anchor
   * @param {string} anchorId - Anchor ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteAnchor(anchorId) {
    if (!this.anchors.has(anchorId)) {
      this.warn('Anchor not found:', anchorId);
      return false;
    }

    try {
      const anchorData = this.anchors.get(anchorId);
      const { anchor, persistent } = anchorData;

      // Delete anchor
      anchor.delete();

      // Remove from maps
      this.anchors.delete(anchorId);
      this.anchorMetadata.delete(anchorId);

      // Remove from persistent storage if persistent
      if (persistent) {
        this.persistentAnchors.delete(anchorId);
        this.stats.persistentAnchors--;
        await this.deletePersistentAnchor(anchorId);
      }

      this.stats.totalAnchors--;

      this.log('Anchor deleted:', anchorId);

      // Trigger callback
      if (this.onAnchorDeleted) {
        this.onAnchorDeleted(anchorId);
      }

      return true;

    } catch (error) {
      this.error('Failed to delete anchor:', error);
      return false;
    }
  }

  /**
   * Get anchor by ID
   * @param {string} anchorId - Anchor ID
   * @returns {Object|null} Anchor data
   */
  getAnchor(anchorId) {
    return this.anchors.get(anchorId) || null;
  }

  /**
   * Get anchor metadata
   * @param {string} anchorId - Anchor ID
   * @returns {Object|null} Metadata
   */
  getAnchorMetadata(anchorId) {
    return this.anchorMetadata.get(anchorId) || null;
  }

  /**
   * Get all anchors
   * @returns {Map} All anchors
   */
  getAllAnchors() {
    return this.anchors;
  }

  /**
   * Get anchors near position
   * @param {Object} position - Position {x, y, z}
   * @param {number} radius - Search radius in meters
   * @returns {Array} Nearby anchors [{id, distance, data}]
   */
  getAnchorsNear(position, radius) {
    const nearby = [];

    for (const [anchorId, anchorData] of this.anchors.entries()) {
      const anchorPos = anchorData.pose.position;

      const dx = anchorPos.x - position.x;
      const dy = anchorPos.y - position.y;
      const dz = anchorPos.z - position.z;

      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance <= radius) {
        nearby.push({
          id: anchorId,
          distance: distance,
          data: anchorData
        });
      }
    }

    // Sort by distance
    nearby.sort((a, b) => a.distance - b.distance);

    return nearby;
  }

  /**
   * Get distance between two anchors
   * @param {string} anchorId1 - First anchor ID
   * @param {string} anchorId2 - Second anchor ID
   * @returns {number|null} Distance in meters
   */
  getDistanceBetweenAnchors(anchorId1, anchorId2) {
    const anchor1 = this.anchors.get(anchorId1);
    const anchor2 = this.anchors.get(anchorId2);

    if (!anchor1 || !anchor2) return null;

    const pos1 = anchor1.pose.position;
    const pos2 = anchor2.pose.position;

    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Save persistent anchor to storage
   * @param {string} anchorId - Anchor ID
   * @param {XRAnchor} anchor - XR anchor
   */
  async savePersistentAnchor(anchorId, anchor) {
    if (!this.persistentAnchorsSupported) return;

    try {
      // Get anchor UUID (device-specific persistent ID)
      const anchorUUID = anchor.anchorUUID || anchorId;

      // Save to localStorage (as fallback)
      const persistentData = {
        id: anchorId,
        uuid: anchorUUID,
        createdAt: Date.now(),
        metadata: this.anchorMetadata.get(anchorId) || {}
      };

      const savedAnchors = this.getSavedAnchors();
      savedAnchors[anchorUUID] = persistentData;

      localStorage.setItem('vr-persistent-anchors', JSON.stringify(savedAnchors));

      this.log('Persistent anchor saved:', anchorId);

    } catch (error) {
      this.error('Failed to save persistent anchor:', error);
    }
  }

  /**
   * Delete persistent anchor from storage
   * @param {string} anchorId - Anchor ID
   */
  async deletePersistentAnchor(anchorId) {
    try {
      const savedAnchors = this.getSavedAnchors();

      // Find and delete by ID
      for (const [uuid, data] of Object.entries(savedAnchors)) {
        if (data.id === anchorId) {
          delete savedAnchors[uuid];
          break;
        }
      }

      localStorage.setItem('vr-persistent-anchors', JSON.stringify(savedAnchors));

      this.log('Persistent anchor deleted from storage:', anchorId);

    } catch (error) {
      this.error('Failed to delete persistent anchor:', error);
    }
  }

  /**
   * Restore persistent anchors from previous session
   */
  async restorePersistentAnchors() {
    if (!this.persistentAnchorsSupported) return;

    try {
      const savedAnchors = this.getSavedAnchors();

      for (const [uuid, data] of Object.entries(savedAnchors)) {
        // Attempt to restore anchor using device API
        if (typeof this.xrSession.restorePersistentAnchor === 'function') {
          try {
            const anchor = await this.xrSession.restorePersistentAnchor(uuid);

            if (anchor) {
              // Restore to active anchors
              this.anchors.set(data.id, {
                anchor: anchor,
                pose: null, // Will be updated in next frame
                space: this.xrRefSpace,
                persistent: true,
                createdAt: data.createdAt,
                lastUpdated: Date.now()
              });

              // Restore metadata
              if (data.metadata) {
                this.anchorMetadata.set(data.id, data.metadata);
              }

              this.persistentAnchors.add(data.id);
              this.stats.totalAnchors++;
              this.stats.persistentAnchors++;

              this.log('Persistent anchor restored:', data.id);
            }
          } catch (restoreError) {
            this.warn('Failed to restore anchor:', uuid, restoreError);
          }
        }
      }

      this.log('Persistent anchors restoration complete');

    } catch (error) {
      this.error('Failed to restore persistent anchors:', error);
    }
  }

  /**
   * Get saved anchors from storage
   * @returns {Object} Saved anchors
   */
  getSavedAnchors() {
    try {
      const saved = localStorage.getItem('vr-persistent-anchors');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Clear all persistent anchors
   */
  async clearPersistentAnchors() {
    try {
      // Delete all persistent anchors
      const persistentIds = Array.from(this.persistentAnchors);

      for (const anchorId of persistentIds) {
        await this.deleteAnchor(anchorId);
      }

      // Clear storage
      localStorage.removeItem('vr-persistent-anchors');

      this.log('All persistent anchors cleared');

    } catch (error) {
      this.error('Failed to clear persistent anchors:', error);
    }
  }

  /**
   * Generate anchor ID
   * @returns {string} Unique anchor ID
   */
  generateAnchorId() {
    return 'anchor-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      anchorsSupported: this.anchorsSupported,
      persistentAnchorsSupported: this.persistentAnchorsSupported,
      maxPersistentAnchors: this.maxPersistentAnchors,
      activeAnchors: this.anchors.size,
      activePersistentAnchors: this.persistentAnchors.size
    };
  }

  /**
   * Cleanup resources
   */
  dispose() {
    // Delete all non-persistent anchors
    for (const [anchorId, anchorData] of this.anchors.entries()) {
      if (!anchorData.persistent) {
        anchorData.anchor.delete();
      }
    }

    this.anchors.clear();
    this.anchorMetadata.clear();

    this.log('Resources disposed (persistent anchors retained)');
  }

  /**
   * Log debug message
   */
  log(...args) {
    if (this.debug) {
      console.log('[VRSpatialAnchors]', ...args);
    }
  }

  /**
   * Log warning message
   */
  warn(...args) {
    console.warn('[VRSpatialAnchors]', ...args);
  }

  /**
   * Log error message
   */
  error(...args) {
    console.error('[VRSpatialAnchors]', ...args);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRSpatialAnchorsSystem;
}
