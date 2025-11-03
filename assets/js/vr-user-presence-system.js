/**
 * VR User Presence System - Phase 8-1
 * ===================================
 * Multi-user avatar presence tracking and rendering
 * Shows nearby users in shared VR space
 *
 * Features:
 * - User presence registration
 * - Real-time pose synchronization
 * - Simple avatar rendering (cubes with nametags)
 * - View frustum culling (render only visible users)
 * - Interaction history tracking
 * - User activity detection (idle vs active)
 *
 * Performance: <5ms per user, <20MB per 50 users
 * Avatar types: Simple cubes (optimized for 90fps)
 * Phase 8 Multi-User Feature
 */

class VRUserPresenceSystem {
  constructor(options = {}) {
    this.config = {
      maxVisibleUsers: options.maxVisibleUsers || 20,
      viewRadius: options.viewRadius || 10, // Meters
      idleTimeout: options.idleTimeout || 60000, // 1 minute
      avatarSize: options.avatarSize || 0.3, // Meters (cube side length)
      enableNameTags: options.enableNameTags !== false,
      avatarUpdateFrequency: options.avatarUpdateFrequency || 30, // Updates per second
    };

    // User registry
    this.users = new Map(); // userId → userPresence
    this.visibleUsers = new Set(); // userIds currently visible
    this.userInteractionHistory = new Map(); // userId → interaction events

    // Avatar scene objects (Three.js references)
    this.avatarMeshes = new Map(); // userId → Three.Mesh
    this.avatarNameTags = new Map(); // userId → nameTag HTML

    // Metrics
    this.metrics = {
      totalUsersTracked: 0,
      currentActiveUsers: 0,
      positionUpdates: 0,
      culledUsers: 0,
      averageLatency: 0,
    };

    // Shared utilities
    this.mathUtils = require('./vr-math-utils.js');
    this.performanceMetrics = new (require('./vr-performance-metrics.js'))('VRUserPresenceSystem');

    // Avatar colors (for visual distinction)
    this.avatarColors = [
      0xFF5733, 0x33FF57, 0x3357FF, 0xFF33F5, 0xF5FF33,
      0x33FFF5, 0xFF3333, 0x33FF88, 0xFF8833, 0x8833FF,
    ];

    console.log('[VRUserPresenceSystem] Initialized with max', this.config.maxVisibleUsers, 'users');
  }

  /**
   * Register a user in the presence system
   */
  registerUser(userId, userName, deviceId = null, metadata = {}) {
    try {
      const userPresence = {
        userId: userId,
        userName: userName,
        deviceId: deviceId || `device_${userId}`,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        status: 'active',
        lastUpdate: Date.now(),
        lastActivity: Date.now(),
        isVisible: false,
        avatarColor: this.getColorForUser(userId),
        metadata: metadata,
      };

      this.users.set(userId, userPresence);
      this.metrics.totalUsersTracked++;
      this.metrics.currentActiveUsers = this.users.size;

      this.performanceMetrics.recordOperation('registerUser', 0);

      console.log(`[VRUserPresenceSystem] Registered user: ${userName} (${userId})`);

      return {
        success: true,
        userId: userId,
        avatarColor: userPresence.avatarColor,
      };
    } catch (error) {
      this.performanceMetrics.recordError('registerUser', error);
      console.error('[VRUserPresenceSystem] Registration error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update user pose (position and rotation)
   */
  updateUserPose(userId, position, rotation) {
    const startTime = performance.now();

    try {
      const user = this.users.get(userId);
      if (!user) {
        return { success: false, error: `User ${userId} not found` };
      }

      // Calculate movement distance for activity detection
      const prevPos = user.position;
      const distance = this.mathUtils.distance(
        [prevPos.x, prevPos.y, prevPos.z],
        [position.x, position.y, position.y]
      );

      // Update user state
      user.position = { ...position };
      user.rotation = { ...rotation };
      user.lastUpdate = Date.now();

      // Detect activity (movement > 0.1m considered active)
      if (distance > 0.1) {
        user.lastActivity = Date.now();
        user.status = 'active';
      } else {
        // Check if idle
        const idleTime = Date.now() - user.lastActivity;
        user.status = idleTime > this.config.idleTimeout ? 'idle' : 'active';
      }

      this.metrics.positionUpdates++;

      const duration = performance.now() - startTime;
      this.performanceMetrics.recordOperation('updateUserPose', duration);

      return {
        success: true,
        userId: userId,
        status: user.status,
        updateTime: duration,
      };
    } catch (error) {
      this.performanceMetrics.recordError('updateUserPose', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get users visible from camera position
   */
  getVisibleUsers(cameraPosition, viewFrustum = null) {
    const startTime = performance.now();
    const visibleList = [];
    let culledCount = 0;

    try {
      for (const [userId, user] of this.users) {
        // Skip self
        if (user.status === 'self') continue;

        // Distance check
        const distance = this.mathUtils.distance(
          [cameraPosition.x, cameraPosition.y, cameraPosition.z],
          [user.position.x, user.position.y, user.position.z]
        );

        if (distance > this.config.viewRadius) {
          culledCount++;
          user.isVisible = false;
          continue;
        }

        // Frustum culling (if provided)
        if (viewFrustum && !this.isInViewFrustum(user.position, viewFrustum)) {
          culledCount++;
          user.isVisible = false;
          continue;
        }

        // Limit number of visible users
        if (visibleList.length >= this.config.maxVisibleUsers) {
          // Sort by distance and keep closest
          visibleList.sort((a, b) => a.distance - b.distance);
          if (distance > visibleList[visibleList.length - 1].distance) {
            culledCount++;
            user.isVisible = false;
            continue;
          }
          visibleList.pop();
        }

        user.isVisible = true;
        visibleList.push({
          userId: userId,
          user: user,
          distance: distance,
        });
      }

      this.visibleUsers = new Set(visibleList.map(u => u.userId));
      this.metrics.culledUsers = culledCount;

      const duration = performance.now() - startTime;
      this.performanceMetrics.recordOperation('getVisibleUsers', duration);

      return {
        success: true,
        users: visibleList.sort((a, b) => a.distance - b.distance),
        count: visibleList.length,
        culledCount: culledCount,
      };
    } catch (error) {
      this.performanceMetrics.recordError('getVisibleUsers', error);
      return { success: false, error: error.message, users: [] };
    }
  }

  /**
   * Create simple avatar mesh (Three.js)
   */
  createAvatarMesh(userId, scene) {
    try {
      const user = this.users.get(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Import Three.js (should be available in VR environment)
      const THREE = window.THREE;
      if (!THREE) {
        return { success: false, error: 'Three.js not available' };
      }

      // Create cube for avatar
      const geometry = new THREE.BoxGeometry(
        this.config.avatarSize,
        this.config.avatarSize * 2, // Taller for head-to-torso
        this.config.avatarSize
      );

      const material = new THREE.MeshStandardMaterial({
        color: user.avatarColor,
        emissive: user.status === 'idle' ? 0x555555 : 0x000000,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(user.position.x, user.position.y, user.position.z);
      mesh.quaternion.set(
        user.rotation.x,
        user.rotation.y,
        user.rotation.z,
        user.rotation.w
      );

      // Add nametag
      if (this.config.enableNameTags) {
        const nameTag = this.createNameTag(user.userName);
        mesh.userData.nameTag = nameTag;
      }

      scene.add(mesh);
      this.avatarMeshes.set(userId, mesh);

      console.log(`[VRUserPresenceSystem] Avatar created for ${user.userName}`);

      return { success: true, mesh: mesh };
    } catch (error) {
      this.performanceMetrics.recordError('createAvatarMesh', error);
      console.error('[VRUserPresenceSystem] Avatar creation error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update avatar position in Three.js scene
   */
  updateAvatarPose(userId) {
    try {
      const user = this.users.get(userId);
      const mesh = this.avatarMeshes.get(userId);

      if (!user || !mesh) {
        return { success: false, error: 'User or mesh not found' };
      }

      // Update position and rotation
      mesh.position.set(user.position.x, user.position.y, user.position.z);
      mesh.quaternion.set(
        user.rotation.x,
        user.rotation.y,
        user.rotation.z,
        user.rotation.w
      );

      // Update emissive based on idle status
      if (mesh.material) {
        mesh.material.emissive.setHex(
          user.status === 'idle' ? 0x555555 : 0x000000
        );
      }

      return { success: true };
    } catch (error) {
      this.performanceMetrics.recordError('updateAvatarPose', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record user interaction
   */
  recordInteraction(userId, interactionType, data) {
    try {
      if (!this.userInteractionHistory.has(userId)) {
        this.userInteractionHistory.set(userId, []);
      }

      const event = {
        type: interactionType,
        data: data,
        timestamp: Date.now(),
      };

      const history = this.userInteractionHistory.get(userId);
      history.push(event);

      // Keep only last 1000 interactions per user
      if (history.length > 1000) {
        history.shift();
      }

      return { success: true, event: event };
    } catch (error) {
      this.performanceMetrics.recordError('recordInteraction', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get interaction history for a user
   */
  getInteractionHistory(userId, limit = 50) {
    try {
      const history = this.userInteractionHistory.get(userId) || [];
      return {
        success: true,
        interactions: history.slice(-limit),
        total: history.length,
      };
    } catch (error) {
      this.performanceMetrics.recordError('getInteractionHistory', error);
      return { success: false, error: error.message, interactions: [] };
    }
  }

  /**
   * Get system metrics
   */
  getMetrics() {
    const perfMetrics = this.performanceMetrics.getMetrics();
    return {
      ...this.metrics,
      ...perfMetrics,
      visibleUsersCount: this.visibleUsers.size,
      totalUsersCount: this.users.size,
      averageUpdateLatency: this.metrics.positionUpdates > 0
        ? this.metrics.averageLatency
        : 0,
    };
  }

  // Helper Methods

  getColorForUser(userId) {
    const hash = userId.charCodeAt(0) + userId.charCodeAt(userId.length - 1);
    return this.avatarColors[hash % this.avatarColors.length];
  }

  isInViewFrustum(position, frustum) {
    // Simple sphere-frustum collision check
    // Assumes frustum has 6 planes (left, right, top, bottom, near, far)
    if (!frustum || !frustum.containsPoint) {
      return true; // No frustum provided, consider visible
    }

    const point = new window.THREE.Vector3(position.x, position.y, position.z);
    return frustum.containsPoint(point);
  }

  createNameTag(userName) {
    // Create HTML element for nametag
    const div = document.createElement('div');
    div.textContent = userName;
    div.style.cssText = `
      font-size: 12px;
      color: white;
      background: rgba(0,0,0,0.7);
      padding: 4px 8px;
      border-radius: 4px;
      white-space: nowrap;
      position: absolute;
      transform: translateX(-50%);
    `;
    return div;
  }

  /**
   * Remove user from presence system
   */
  removeUser(userId) {
    try {
      const mesh = this.avatarMeshes.get(userId);
      if (mesh && mesh.parent) {
        mesh.parent.remove(mesh);
      }

      this.avatarMeshes.delete(userId);
      this.users.delete(userId);
      this.visibleUsers.delete(userId);
      this.userInteractionHistory.delete(userId);

      this.metrics.currentActiveUsers = this.users.size;

      return { success: true };
    } catch (error) {
      this.performanceMetrics.recordError('removeUser', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cleanup all resources
   */
  dispose() {
    for (const [userId, mesh] of this.avatarMeshes) {
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
      mesh.geometry.dispose();
      mesh.material.dispose();
    }

    this.avatarMeshes.clear();
    this.users.clear();
    this.visibleUsers.clear();
    this.userInteractionHistory.clear();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRUserPresenceSystem;
}
