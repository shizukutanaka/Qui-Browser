/**
 * VR Instanced Rendering System
 * 同一オブジェクトの大量描画を1回のdraw callで実現
 *
 * Instanced rendering は、同じメッシュを複数回描画する際に、
 * 各インスタンスの位置・回転・スケールを個別に指定しながら、
 * 1回のdraw callで全てを描画できる技術です。
 *
 * パフォーマンス効果:
 * - Draw call数: N → 1 (Nはインスタンス数)
 * - CPU負荷: 大幅削減
 * - GPU側で並列処理
 *
 * Based on WebGL 2.0 Instancing and Three.js InstancedMesh
 * @version 1.0.0
 */

class VRInstancedRenderingSystem {
  constructor() {
    this.enabled = false;
    this.instancedMeshes = new Map();

    this.config = {
      maxInstancesPerMesh: 1000, // 1メッシュあたりの最大インスタンス数
      frustumCulling: true, // 視錐台カリング
      sortInstances: false, // 距離ソート (透過時のみ推奨)
      updateFrequency: 60 // Hz
    };

    // Performance metrics
    this.metrics = {
      totalInstances: 0,
      activeMeshes: 0,
      drawCallsSaved: 0,
      cpuTimeSaved: 0,
      renderTime: 0
    };

    // Instance pools for reuse
    this.instancePools = new Map();

    console.info('[InstancedRendering] Instanced Rendering System initialized');
  }

  /**
   * Create instanced mesh
   * @param {string} id - Unique mesh ID
   * @param {THREE.BufferGeometry} geometry - Base geometry
   * @param {THREE.Material} material - Base material
   * @param {number} maxCount - Maximum instance count
   * @returns {THREE.InstancedMesh} Instanced mesh
   */
  createInstancedMesh(id, geometry, material, maxCount = 1000) {
    if (this.instancedMeshes.has(id)) {
      console.warn(`[InstancedRendering] Mesh already exists: ${id}`);
      return this.instancedMeshes.get(id).mesh;
    }

    // Create Three.js InstancedMesh
    const mesh = new THREE.InstancedMesh(geometry, material, maxCount);
    mesh.name = id;

    // Enable frustum culling per instance
    mesh.frustumCulled = this.config.frustumCulling;

    // Store mesh data
    const meshData = {
      id,
      mesh,
      geometry,
      material,
      maxCount,
      activeCount: 0,
      instances: new Map(), // instanceId -> instance data
      needsUpdate: false
    };

    this.instancedMeshes.set(id, meshData);
    this.metrics.activeMeshes++;

    console.info(`[InstancedRendering] Created instanced mesh: ${id} (max: ${maxCount})`);

    return mesh;
  }

  /**
   * Add instance to mesh
   * @param {string} meshId - Mesh ID
   * @param {string} instanceId - Instance ID
   * @param {Object} transform - Transform {position, rotation, scale}
   * @returns {number} Instance index
   */
  addInstance(meshId, instanceId, transform = {}) {
    const meshData = this.instancedMeshes.get(meshId);
    if (!meshData) {
      console.warn(`[InstancedRendering] Mesh not found: ${meshId}`);
      return -1;
    }

    if (meshData.activeCount >= meshData.maxCount) {
      console.warn(`[InstancedRendering] Max instances reached for ${meshId}`);
      return -1;
    }

    const index = meshData.activeCount;
    meshData.activeCount++;

    // Default transform
    const position = transform.position || { x: 0, y: 0, z: 0 };
    const rotation = transform.rotation || { x: 0, y: 0, z: 0 };
    const scale = transform.scale || { x: 1, y: 1, z: 1 };

    // Create matrix
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3(position.x, position.y, position.z);
    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rotation.x, rotation.y, rotation.z)
    );
    const scl = new THREE.Vector3(scale.x, scale.y, scale.z);

    matrix.compose(pos, quat, scl);

    // Set instance matrix
    meshData.mesh.setMatrixAt(index, matrix);
    meshData.mesh.instanceMatrix.needsUpdate = true;

    // Store instance data
    meshData.instances.set(instanceId, {
      index,
      transform: { position, rotation, scale },
      visible: true,
      userData: {}
    });

    this.metrics.totalInstances++;
    this.metrics.drawCallsSaved = Math.max(0, this.metrics.totalInstances - this.metrics.activeMeshes);

    return index;
  }

  /**
   * Update instance transform
   * @param {string} meshId - Mesh ID
   * @param {string} instanceId - Instance ID
   * @param {Object} transform - New transform
   */
  updateInstance(meshId, instanceId, transform) {
    const meshData = this.instancedMeshes.get(meshId);
    if (!meshData) return;

    const instance = meshData.instances.get(instanceId);
    if (!instance) {
      console.warn(`[InstancedRendering] Instance not found: ${instanceId}`);
      return;
    }

    // Update transform data
    if (transform.position) {
      instance.transform.position = { ...instance.transform.position, ...transform.position };
    }
    if (transform.rotation) {
      instance.transform.rotation = { ...instance.transform.rotation, ...transform.rotation };
    }
    if (transform.scale) {
      instance.transform.scale = { ...instance.transform.scale, ...transform.scale };
    }

    // Update matrix
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3(
      instance.transform.position.x,
      instance.transform.position.y,
      instance.transform.position.z
    );
    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        instance.transform.rotation.x,
        instance.transform.rotation.y,
        instance.transform.rotation.z
      )
    );
    const scl = new THREE.Vector3(
      instance.transform.scale.x,
      instance.transform.scale.y,
      instance.transform.scale.z
    );

    matrix.compose(pos, quat, scl);
    meshData.mesh.setMatrixAt(instance.index, matrix);
    meshData.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Update instance position
   * @param {string} meshId - Mesh ID
   * @param {string} instanceId - Instance ID
   * @param {Object} position - New position {x, y, z}
   */
  updateInstancePosition(meshId, instanceId, position) {
    this.updateInstance(meshId, instanceId, { position });
  }

  /**
   * Update instance rotation
   * @param {string} meshId - Mesh ID
   * @param {string} instanceId - Instance ID
   * @param {Object} rotation - New rotation {x, y, z} (Euler angles)
   */
  updateInstanceRotation(meshId, instanceId, rotation) {
    this.updateInstance(meshId, instanceId, { rotation });
  }

  /**
   * Update instance scale
   * @param {string} meshId - Mesh ID
   * @param {string} instanceId - Instance ID
   * @param {Object} scale - New scale {x, y, z}
   */
  updateInstanceScale(meshId, instanceId, scale) {
    this.updateInstance(meshId, instanceId, { scale });
  }

  /**
   * Set instance color
   * @param {string} meshId - Mesh ID
   * @param {string} instanceId - Instance ID
   * @param {THREE.Color} color - Color
   */
  setInstanceColor(meshId, instanceId, color) {
    const meshData = this.instancedMeshes.get(meshId);
    if (!meshData) return;

    const instance = meshData.instances.get(instanceId);
    if (!instance) return;

    // Set color at instance index
    meshData.mesh.setColorAt(instance.index, color);
    meshData.mesh.instanceColor.needsUpdate = true;
  }

  /**
   * Set instance visibility
   * @param {string} meshId - Mesh ID
   * @param {string} instanceId - Instance ID
   * @param {boolean} visible - Visibility
   */
  setInstanceVisibility(meshId, instanceId, visible) {
    const meshData = this.instancedMeshes.get(meshId);
    if (!meshData) return;

    const instance = meshData.instances.get(instanceId);
    if (!instance) return;

    instance.visible = visible;

    // Hide by scaling to 0 (or move far away)
    if (!visible) {
      this.updateInstanceScale(meshId, instanceId, { x: 0, y: 0, z: 0 });
    } else {
      // Restore original scale
      this.updateInstanceScale(meshId, instanceId, instance.transform.scale);
    }
  }

  /**
   * Remove instance
   * @param {string} meshId - Mesh ID
   * @param {string} instanceId - Instance ID
   */
  removeInstance(meshId, instanceId) {
    const meshData = this.instancedMeshes.get(meshId);
    if (!meshData) return;

    const instance = meshData.instances.get(instanceId);
    if (!instance) return;

    // Hide instance by scaling to 0
    this.setInstanceVisibility(meshId, instanceId, false);

    // Remove from map
    meshData.instances.delete(instanceId);
    this.metrics.totalInstances--;
    this.metrics.drawCallsSaved = Math.max(0, this.metrics.totalInstances - this.metrics.activeMeshes);
  }

  /**
   * Remove instanced mesh
   * @param {string} meshId - Mesh ID
   */
  removeInstancedMesh(meshId) {
    const meshData = this.instancedMeshes.get(meshId);
    if (!meshData) return;

    // Dispose geometry and material
    meshData.geometry.dispose();
    meshData.material.dispose();

    // Update metrics
    this.metrics.totalInstances -= meshData.instances.size;
    this.metrics.activeMeshes--;

    this.instancedMeshes.delete(meshId);

    console.info(`[InstancedRendering] Removed instanced mesh: ${meshId}`);
  }

  /**
   * Update all instances (call per frame if needed)
   */
  update() {
    const startTime = performance.now();

    for (const [meshId, meshData] of this.instancedMeshes) {
      // Frustum culling (Three.js handles automatically)
      // Distance sorting (for transparent objects)
      if (this.config.sortInstances && meshData.material.transparent) {
        this.sortInstancesByDistance(meshData);
      }
    }

    this.metrics.renderTime = performance.now() - startTime;
  }

  /**
   * Sort instances by distance from camera (for transparency)
   * @param {Object} meshData - Mesh data
   */
  sortInstancesByDistance(meshData) {
    // Get camera position (would need to be passed in)
    // This is a placeholder for distance-based sorting
    // In practice, you'd pass camera position and sort instances
  }

  /**
   * Batch create instances
   * @param {string} meshId - Mesh ID
   * @param {Array<Object>} instancesData - Array of {id, transform}
   */
  batchAddInstances(meshId, instancesData) {
    const meshData = this.instancedMeshes.get(meshId);
    if (!meshData) {
      console.warn(`[InstancedRendering] Mesh not found: ${meshId}`);
      return;
    }

    const startTime = performance.now();

    for (const data of instancesData) {
      this.addInstance(meshId, data.id, data.transform);
    }

    const elapsed = performance.now() - startTime;
    console.info(`[InstancedRendering] Batch added ${instancesData.length} instances in ${elapsed.toFixed(2)}ms`);
  }

  /**
   * Batch update instances
   * @param {string} meshId - Mesh ID
   * @param {Array<Object>} updates - Array of {id, transform}
   */
  batchUpdateInstances(meshId, updates) {
    const meshData = this.instancedMeshes.get(meshId);
    if (!meshData) return;

    const startTime = performance.now();

    for (const update of updates) {
      this.updateInstance(meshId, update.id, update.transform);
    }

    const elapsed = performance.now() - startTime;
    console.info(`[InstancedRendering] Batch updated ${updates.length} instances in ${elapsed.toFixed(2)}ms`);
  }

  /**
   * Get instance data
   * @param {string} meshId - Mesh ID
   * @param {string} instanceId - Instance ID
   * @returns {Object|null} Instance data
   */
  getInstance(meshId, instanceId) {
    const meshData = this.instancedMeshes.get(meshId);
    if (!meshData) return null;

    return meshData.instances.get(instanceId) || null;
  }

  /**
   * Get all instances for mesh
   * @param {string} meshId - Mesh ID
   * @returns {Map} Instances map
   */
  getInstances(meshId) {
    const meshData = this.instancedMeshes.get(meshId);
    return meshData ? meshData.instances : new Map();
  }

  /**
   * Get metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      efficiency: this.metrics.totalInstances > 0
        ? ((this.metrics.drawCallsSaved / this.metrics.totalInstances) * 100).toFixed(1) + '%'
        : '0%'
    };
  }

  /**
   * Clear all instances from mesh
   * @param {string} meshId - Mesh ID
   */
  clearInstances(meshId) {
    const meshData = this.instancedMeshes.get(meshId);
    if (!meshData) return;

    this.metrics.totalInstances -= meshData.instances.size;
    meshData.instances.clear();
    meshData.activeCount = 0;

    console.info(`[InstancedRendering] Cleared all instances from ${meshId}`);
  }

  /**
   * Enable instanced rendering
   */
  enable() {
    this.enabled = true;
    console.info('[InstancedRendering] Enabled');
  }

  /**
   * Disable instanced rendering
   */
  disable() {
    this.enabled = false;
    console.info('[InstancedRendering] Disabled');
  }

  /**
   * Dispose all resources
   */
  dispose() {
    for (const [meshId] of this.instancedMeshes) {
      this.removeInstancedMesh(meshId);
    }

    this.instancedMeshes.clear();
    this.enabled = false;

    console.info('[InstancedRendering] Disposed');
  }

  /**
   * Get usage example
   * @returns {string} Code example
   */
  static getUsageExample() {
    return `
// Initialize system
const instancing = new VRInstancedRenderingSystem();

// Create base geometry and material
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

// Create instanced mesh (max 1000 instances)
const mesh = instancing.createInstancedMesh(
  'cubes',
  geometry,
  material,
  1000
);

// Add to scene
scene.add(mesh);

// Add individual instances
for (let i = 0; i < 100; i++) {
  instancing.addInstance('cubes', \`cube-\${i}\`, {
    position: {
      x: Math.random() * 20 - 10,
      y: Math.random() * 20 - 10,
      z: Math.random() * 20 - 10
    },
    rotation: {
      x: Math.random() * Math.PI,
      y: Math.random() * Math.PI,
      z: Math.random() * Math.PI
    },
    scale: { x: 1, y: 1, z: 1 }
  });
}

// Or batch add (more efficient)
const instancesData = [];
for (let i = 0; i < 100; i++) {
  instancesData.push({
    id: \`cube-\${i}\`,
    transform: {
      position: {
        x: Math.random() * 20 - 10,
        y: Math.random() * 20 - 10,
        z: Math.random() * 20 - 10
      }
    }
  });
}
instancing.batchAddInstances('cubes', instancesData);

// Update instance position
instancing.updateInstancePosition('cubes', 'cube-0', { x: 5, y: 0, z: 0 });

// Set instance color
instancing.setInstanceColor('cubes', 'cube-0', new THREE.Color(0xff0000));

// Hide instance
instancing.setInstanceVisibility('cubes', 'cube-0', false);

// In animation loop
function animate() {
  instancing.update();
  renderer.render(scene, camera);
}

// Get metrics
const metrics = instancing.getMetrics();
console.log('Draw calls saved:', metrics.drawCallsSaved);
console.log('Efficiency:', metrics.efficiency);

// Cleanup
// instancing.dispose();
`;
  }

  /**
   * Get best practices
   * @returns {Array} Recommendations
   */
  static getBestPractices() {
    return [
      {
        title: 'Use for Repeated Objects',
        description: 'Instancing is ideal for trees, rocks, grass, particles, etc.',
        priority: 'high'
      },
      {
        title: 'Batch Operations',
        description: 'Use batchAddInstances/batchUpdateInstances for better performance.',
        priority: 'high'
      },
      {
        title: 'Limit Instance Count',
        description: 'Keep instances under 10,000 per mesh for best performance.',
        priority: 'medium'
      },
      {
        title: 'Share Geometry & Material',
        description: 'All instances must share the same geometry and material.',
        priority: 'high'
      },
      {
        title: 'Frustum Culling',
        description: 'Enable for automatic performance boost.',
        priority: 'medium'
      },
      {
        title: 'Distance Sorting',
        description: 'Only enable for transparent materials (performance cost).',
        priority: 'low'
      }
    ];
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRInstancedRenderingSystem;
}

// Global instance
window.VRInstancedRenderingSystem = VRInstancedRenderingSystem;

console.info('[InstancedRendering] VR Instanced Rendering System loaded');
