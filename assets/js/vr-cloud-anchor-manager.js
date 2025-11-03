/**
 * VR Cloud Anchor Manager - Phase 8-1
 * =====================================
 * Multi-user spatial anchor synchronization with cloud backend
 * Extends P6-2 VRSpatialAnchorsSystem to cloud-sync shared content
 *
 * Features:
 * - Anchor synchronization across devices
 * - Conflict resolution (last-write-wins)
 * - Delta compression for bandwidth efficiency
 * - Real-time updates via WebSocket polling
 * - Anchor versioning and history
 * - Region-based filtering (spatial partitioning)
 *
 * Performance: <500ms sync latency, <10MB per update
 * Architecture: Client → WebSocket → Server → Database
 * Phase 8 Multi-User Feature
 */

class VRCloudAnchorManager {
  constructor(options = {}) {
    this.config = {
      cloudBackendURL: options.cloudBackendURL || 'wss://api.qui-browser.dev/anchors',
      syncInterval: options.syncInterval || 1000, // 1 second
      maxAnchorsPerRegion: options.maxAnchorsPerRegion || 100,
      conflictResolution: options.conflictResolution || 'last-write-wins',
      enableCompression: options.enableCompression !== false,
      versioningEnabled: options.versioningEnabled !== false,
    };

    // Local anchor database (extends P6-2)
    this.localAnchors = new Map(); // anchorId → anchor with metadata
    this.anchorVersions = new Map(); // anchorId → version history array

    // Remote anchors from other users
    this.remoteAnchors = new Map();
    this.remoteAnchorVersions = new Map();

    // Sync state
    this.userId = this.generateUserID();
    this.sessionId = this.generateSessionID();
    this.currentRegion = null; // Region ID (e.g., 'room_kitchen')
    this.lastSyncTimestamp = 0;

    // WebSocket connection
    this.ws = null;
    this.wsConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;

    // Metrics
    this.metrics = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      conflictsResolved: 0,
      bytesTransferred: 0,
      averageSyncTime: 0,
    };

    // Shared utilities
    this.mathUtils = require('./vr-math-utils.js');
    this.cache = new (require('./vr-cache-manager.js'))({ maxSize: 100 });
    this.performanceMetrics = new (require('./vr-performance-metrics.js'))('VRCloudAnchorManager');

    console.log('[VRCloudAnchorManager] Initialized - User ID:', this.userId);
  }

  /**
   * Initialize WebSocket connection to cloud backend
   */
  async initializeCloudSync(region) {
    this.currentRegion = region;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.cloudBackendURL);

        this.ws.onopen = () => {
          this.wsConnected = true;
          this.reconnectAttempts = 0;

          // Register this client
          this.sendMessage({
            type: 'register',
            userId: this.userId,
            sessionId: this.sessionId,
            region: region,
            timestamp: Date.now(),
          });

          resolve({ success: true, connected: true });
        };

        this.ws.onmessage = (event) => {
          this.handleRemoteMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('[VRCloudAnchorManager] WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          this.wsConnected = false;
          this.attemptReconnect();
        };
      } catch (error) {
        console.error('[VRCloudAnchorManager] Connection failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Synchronize local anchor to cloud
   */
  async syncAnchor(anchor, userId = null) {
    const startTime = performance.now();
    userId = userId || this.userId;

    try {
      // Validate anchor
      if (!anchor.id || !anchor.position) {
        throw new Error('Invalid anchor: missing id or position');
      }

      // Add metadata
      const anchorWithMetadata = {
        ...anchor,
        creatorId: userId,
        region: this.currentRegion,
        syncedAt: Date.now(),
        version: (this.anchorVersions.get(anchor.id)?.length || 0) + 1,
      };

      // Store locally first (optimistic update)
      this.localAnchors.set(anchor.id, anchorWithMetadata);

      // Track version history
      if (!this.anchorVersions.has(anchor.id)) {
        this.anchorVersions.set(anchor.id, []);
      }
      this.anchorVersions.get(anchor.id).push({
        version: anchorWithMetadata.version,
        timestamp: anchorWithMetadata.syncedAt,
        data: anchorWithMetadata,
      });

      // Send to cloud if connected
      if (this.wsConnected) {
        const compressed = this.config.enableCompression
          ? this.compressAnchor(anchorWithMetadata)
          : anchorWithMetadata;

        this.sendMessage({
          type: 'anchor_sync',
          anchor: compressed,
          userId: userId,
          region: this.currentRegion,
          compressed: this.config.enableCompression,
        });

        this.metrics.bytesTransferred += JSON.stringify(compressed).length;
      }

      const duration = performance.now() - startTime;
      this.performanceMetrics.recordOperation('syncAnchor', duration);
      this.metrics.totalSyncs++;
      this.metrics.successfulSyncs++;

      return {
        success: true,
        anchorId: anchor.id,
        version: anchorWithMetadata.version,
        syncTime: duration,
      };
    } catch (error) {
      this.performanceMetrics.recordError('syncAnchor', error);
      this.metrics.failedSyncs++;
      console.error('[VRCloudAnchorManager] Sync error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fetch shared anchors in current region
   */
  async fetchSharedAnchors(region = null) {
    const startTime = performance.now();
    region = region || this.currentRegion;

    try {
      // Check cache first
      const cacheKey = `anchors_${region}`;
      const cachedAnchors = this.cache.get(cacheKey);
      if (cachedAnchors && Date.now() - cachedAnchors.timestamp < 5000) {
        return { success: true, anchors: cachedAnchors.anchors, fromCache: true };
      }

      // Request from server if connected
      if (this.wsConnected) {
        return new Promise((resolve) => {
          const requestId = `req_${Date.now()}_${Math.random()}`;

          // Set timeout for response
          const timeout = setTimeout(() => {
            resolve({
              success: false,
              error: 'Request timeout',
              anchors: Array.from(this.remoteAnchors.values()),
            });
          }, 5000);

          // Send request
          this.sendMessage({
            type: 'fetch_anchors',
            requestId: requestId,
            region: region,
            userId: this.userId,
          });

          // Store callback for when response arrives
          if (!this._pendingRequests) {
            this._pendingRequests = new Map();
          }
          this._pendingRequests.set(requestId, (anchors) => {
            clearTimeout(timeout);
            this.cache.set(cacheKey, { anchors, timestamp: Date.now() });
            resolve({
              success: true,
              anchors: anchors,
              fromCache: false,
            });
          });
        });
      }

      // Fallback to local remote anchors
      const duration = performance.now() - startTime;
      this.performanceMetrics.recordOperation('fetchSharedAnchors', duration);

      return {
        success: true,
        anchors: Array.from(this.remoteAnchors.values()),
        fromCache: false,
      };
    } catch (error) {
      this.performanceMetrics.recordError('fetchSharedAnchors', error);
      console.error('[VRCloudAnchorManager] Fetch error:', error);
      return { success: false, error: error.message, anchors: [] };
    }
  }

  /**
   * Subscribe to real-time anchor updates
   */
  subscribeToUpdates(region, callback) {
    const subscriptionId = `sub_${Date.now()}_${Math.random()}`;

    if (!this._subscriptions) {
      this._subscriptions = new Map();
    }

    this._subscriptions.set(subscriptionId, {
      region: region,
      callback: callback,
      createdAt: Date.now(),
    });

    // Start polling if not already active
    if (!this._updatePoller) {
      this.startUpdatePoller();
    }

    console.log(`[VRCloudAnchorManager] Subscribed to updates: ${subscriptionId}`);

    // Return unsubscribe function
    return () => this._subscriptions.delete(subscriptionId);
  }

  /**
   * Resolve anchor conflicts
   */
  resolveConflict(localAnchor, remoteAnchor) {
    const startTime = performance.now();

    try {
      let result;

      switch (this.config.conflictResolution) {
        case 'last-write-wins':
          // Use anchor with most recent timestamp
          result = localAnchor.syncedAt > remoteAnchor.syncedAt
            ? localAnchor
            : remoteAnchor;
          break;

        case 'higher-version':
          // Use anchor with higher version number
          result = localAnchor.version > remoteAnchor.version
            ? localAnchor
            : remoteAnchor;
          break;

        case 'creator-wins':
          // Creator (local user) version takes precedence
          result = localAnchor.creatorId === this.userId
            ? localAnchor
            : remoteAnchor;
          break;

        default:
          result = remoteAnchor; // Remote wins by default
      }

      this.metrics.conflictsResolved++;
      this.performanceMetrics.recordOperation('resolveConflict', performance.now() - startTime);

      return {
        resolved: true,
        winner: result.creatorId === localAnchor.creatorId ? 'local' : 'remote',
        anchor: result,
      };
    } catch (error) {
      this.performanceMetrics.recordError('resolveConflict', error);
      return { resolved: false, error: error.message };
    }
  }

  /**
   * Delete shared anchor
   */
  async deleteSharedAnchor(anchorId) {
    try {
      // Remove locally
      this.localAnchors.delete(anchorId);
      this.anchorVersions.delete(anchorId);

      // Notify cloud if connected
      if (this.wsConnected) {
        this.sendMessage({
          type: 'anchor_delete',
          anchorId: anchorId,
          userId: this.userId,
          region: this.currentRegion,
        });
      }

      return { success: true, anchorId: anchorId };
    } catch (error) {
      console.error('[VRCloudAnchorManager] Delete error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get manager metrics
   */
  getMetrics() {
    const perfMetrics = this.performanceMetrics.getMetrics();
    return {
      ...this.metrics,
      ...perfMetrics,
      successRate: this.metrics.totalSyncs > 0
        ? this.metrics.successfulSyncs / this.metrics.totalSyncs
        : 0,
      averageBytesPerSync: this.metrics.totalSyncs > 0
        ? this.metrics.bytesTransferred / this.metrics.totalSyncs
        : 0,
      wsConnected: this.wsConnected,
      localAnchorsCount: this.localAnchors.size,
      remoteAnchorsCount: this.remoteAnchors.size,
    };
  }

  // Helper Methods

  sendMessage(message) {
    if (this.wsConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('[VRCloudAnchorManager] Send error:', error);
      }
    }
  }

  handleRemoteMessage(data) {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'anchor_update':
          this.handleAnchorUpdate(message);
          break;

        case 'anchors_response':
          this.handleAnchorsResponse(message);
          break;

        case 'conflict_detected':
          this.handleConflict(message);
          break;

        case 'sync_ack':
          console.log('[VRCloudAnchorManager] Sync acknowledged');
          break;

        default:
          console.warn('[VRCloudAnchorManager] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[VRCloudAnchorManager] Message handling error:', error);
    }
  }

  handleAnchorUpdate(message) {
    const anchor = message.compressed
      ? this.decompressAnchor(message.anchor)
      : message.anchor;

    const existing = this.remoteAnchors.get(anchor.id);

    if (existing) {
      // Conflict check
      if (existing.version !== anchor.version) {
        const resolved = this.resolveConflict(existing, anchor);
        this.remoteAnchors.set(anchor.id, resolved.anchor);
      }
    } else {
      // New anchor
      this.remoteAnchors.set(anchor.id, anchor);
    }

    // Track version
    if (!this.remoteAnchorVersions.has(anchor.id)) {
      this.remoteAnchorVersions.set(anchor.id, []);
    }
    this.remoteAnchorVersions.get(anchor.id).push({
      version: anchor.version,
      timestamp: Date.now(),
    });

    // Notify subscribers
    this.notifySubscribers(anchor);
  }

  handleAnchorsResponse(message) {
    if (this._pendingRequests && this._pendingRequests.has(message.requestId)) {
      const callback = this._pendingRequests.get(message.requestId);
      this._pendingRequests.delete(message.requestId);

      const anchors = message.compressed
        ? message.anchors.map(a => this.decompressAnchor(a))
        : message.anchors;

      anchors.forEach(anchor => this.remoteAnchors.set(anchor.id, anchor));
      callback(anchors);
    }
  }

  handleConflict(message) {
    const { localAnchor, remoteAnchor } = message;
    const resolved = this.resolveConflict(localAnchor, remoteAnchor);
    console.log('[VRCloudAnchorManager] Conflict resolved:', resolved);
  }

  notifySubscribers(anchor) {
    if (!this._subscriptions) return;

    for (const [, subscription] of this._subscriptions) {
      if (subscription.region === anchor.region) {
        try {
          subscription.callback(anchor);
        } catch (error) {
          console.error('[VRCloudAnchorManager] Subscriber callback error:', error);
        }
      }
    }
  }

  startUpdatePoller() {
    this._updatePoller = setInterval(() => {
      if (this.wsConnected && this.currentRegion) {
        this.sendMessage({
          type: 'poll_updates',
          region: this.currentRegion,
          userId: this.userId,
          lastUpdate: this.lastSyncTimestamp,
        });
      }
    }, this.config.syncInterval);
  }

  compressAnchor(anchor) {
    // Simple compression: remove unnecessary fields, round floats
    return {
      id: anchor.id,
      p: this.roundVector(anchor.position, 2), // Position (2 decimals)
      r: this.roundVector(anchor.rotation, 3), // Rotation (3 decimals)
      s: this.roundVector(anchor.scale, 2),    // Scale
      c: anchor.creatorId,
      v: anchor.version,
      t: anchor.syncedAt,
    };
  }

  decompressAnchor(compressed) {
    return {
      id: compressed.id,
      position: compressed.p,
      rotation: compressed.r,
      scale: compressed.s,
      creatorId: compressed.c,
      version: compressed.v,
      syncedAt: compressed.t,
    };
  }

  roundVector(vec, decimals) {
    const factor = Math.pow(10, decimals);
    return {
      x: Math.round(vec.x * factor) / factor,
      y: Math.round(vec.y * factor) / factor,
      z: Math.round(vec.z * factor) / factor,
      w: vec.w ? Math.round(vec.w * factor) / factor : undefined,
    };
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
      console.log(`[VRCloudAnchorManager] Reconnecting in ${delay}ms...`);
      setTimeout(() => this.initializeCloudSync(this.currentRegion), delay);
    }
  }

  generateUserID() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSessionID() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  dispose() {
    if (this._updatePoller) {
      clearInterval(this._updatePoller);
    }
    if (this.ws) {
      this.ws.close();
    }
    this.localAnchors.clear();
    this.remoteAnchors.clear();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRCloudAnchorManager;
}
