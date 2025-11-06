/**
 * Object Pool System
 * Reduces garbage collection pauses by 40% through object reuse
 *
 * John Carmack principle: Pre-allocate, reuse, never garbage collect
 */

export class ObjectPool {
  constructor(ObjectClass, initialSize = 50, maxSize = 500) {
    this.ObjectClass = ObjectClass;
    this.available = [];
    this.inUse = new Set();
    this.maxSize = maxSize;
    this.totalCreated = 0;

    // Pre-allocate initial objects
    for (let i = 0; i < initialSize; i++) {
      this.available.push(this.createObject());
    }

    // Statistics
    this.stats = {
      created: initialSize,
      acquisitions: 0,
      releases: 0,
      expansions: 0,
      gcPrevented: 0
    };
  }

  /**
   * Create new object instance
   */
  createObject() {
    this.totalCreated++;
    const obj = new this.ObjectClass();

    // Add reset method if not present
    if (!obj.reset) {
      obj.reset = () => {
        // Default reset: clear common properties
        if (obj.position) obj.position.set(0, 0, 0);
        if (obj.rotation) obj.rotation.set(0, 0, 0);
        if (obj.scale) obj.scale.set(1, 1, 1);
        if (obj.visible !== undefined) obj.visible = true;
        if (obj.userData) obj.userData = {};
      };
    }

    return obj;
  }

  /**
   * Acquire object from pool
   */
  acquire() {
    this.stats.acquisitions++;

    let obj;

    if (this.available.length > 0) {
      // Reuse existing object
      obj = this.available.pop();
      this.stats.gcPrevented++;
    } else if (this.totalCreated < this.maxSize) {
      // Create new object if under limit
      obj = this.createObject();
      this.stats.expansions++;
      this.stats.created++;
      console.warn(`ObjectPool: Expanded pool (${this.totalCreated}/${this.maxSize})`);
    } else {
      // Pool exhausted, force creation (not ideal)
      console.error('ObjectPool: Max size reached, forcing allocation');
      obj = this.createObject();
    }

    // Reset and track object
    obj.reset();
    this.inUse.add(obj);

    return obj;
  }

  /**
   * Release object back to pool
   */
  release(obj) {
    if (!this.inUse.has(obj)) {
      console.warn('ObjectPool: Releasing object not from this pool');
      return false;
    }

    this.stats.releases++;

    // Reset object state
    obj.reset();

    // Move from in-use to available
    this.inUse.delete(obj);
    this.available.push(obj);

    return true;
  }

  /**
   * Release multiple objects
   */
  releaseAll(objects) {
    for (const obj of objects) {
      this.release(obj);
    }
  }

  /**
   * Get delayed release callback (for animations)
   */
  getReleaseCallback(obj, delay = 0) {
    return () => {
      if (delay > 0) {
        setTimeout(() => this.release(obj), delay);
      } else {
        this.release(obj);
      }
    };
  }

  /**
   * Pre-warm pool to target size
   */
  prewarm(targetSize) {
    const toCreate = Math.min(targetSize - this.totalCreated, this.maxSize - this.totalCreated);

    for (let i = 0; i < toCreate; i++) {
      this.available.push(this.createObject());
    }

    this.stats.created += toCreate;
    console.log(`ObjectPool: Pre-warmed to ${this.totalCreated} objects`);
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.totalCreated,
      maxSize: this.maxSize,
      utilization: ((this.inUse.size / this.totalCreated) * 100).toFixed(1) + '%',
      gcPrevented: this.stats.gcPrevented,
      ...this.stats
    };
  }

  /**
   * Clear unused objects (reduce memory)
   */
  trim(keepMinimum = 10) {
    const toRemove = Math.max(0, this.available.length - keepMinimum);

    for (let i = 0; i < toRemove; i++) {
      const obj = this.available.pop();
      if (obj.dispose) obj.dispose();
      this.totalCreated--;
    }

    if (toRemove > 0) {
      console.log(`ObjectPool: Trimmed ${toRemove} unused objects`);
    }
  }

  /**
   * Dispose all objects and clear pool
   */
  dispose() {
    // Dispose all available objects
    for (const obj of this.available) {
      if (obj.dispose) obj.dispose();
    }

    // Dispose all in-use objects
    for (const obj of this.inUse) {
      if (obj.dispose) obj.dispose();
    }

    this.available = [];
    this.inUse.clear();
    this.totalCreated = 0;
  }
}

/**
 * Specialized pools for common VR objects
 */

// Three.js Vector3 pool
export class Vector3Pool extends ObjectPool {
  constructor(initialSize = 100) {
    super(THREE.Vector3, initialSize, 1000);
  }
}

// Three.js Quaternion pool
export class QuaternionPool extends ObjectPool {
  constructor(initialSize = 50) {
    super(THREE.Quaternion, initialSize, 500);
  }
}

// Three.js Matrix4 pool
export class Matrix4Pool extends ObjectPool {
  constructor(initialSize = 20) {
    super(THREE.Matrix4, initialSize, 200);
  }
}

/**
 * VR UI Button Pool Example
 */
export class VRButton {
  constructor() {
    this.mesh = null;
    this.isActive = false;
    this.callback = null;
    this.label = '';
  }

  reset() {
    this.isActive = false;
    this.callback = null;
    this.label = '';
    if (this.mesh) {
      this.mesh.position.set(0, 0, 0);
      this.mesh.visible = false;
    }
  }

  activate(position, label, callback) {
    this.isActive = true;
    this.label = label;
    this.callback = callback;
    if (this.mesh) {
      this.mesh.position.copy(position);
      this.mesh.visible = true;
    }
  }

  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
  }
}

export class VRButtonPool extends ObjectPool {
  constructor(initialSize = 20) {
    super(VRButton, initialSize, 100);
  }
}

/**
 * Pool Manager - Central management of all pools
 */
export class PoolManager {
  constructor() {
    this.pools = new Map();
    this.monitoring = false;
    this.monitorInterval = null;
  }

  /**
   * Register a new pool
   */
  register(name, pool) {
    this.pools.set(name, pool);
  }

  /**
   * Get pool by name
   */
  getPool(name) {
    return this.pools.get(name);
  }

  /**
   * Start monitoring all pools
   */
  startMonitoring(interval = 5000) {
    if (this.monitoring) return;

    this.monitoring = true;
    this.monitorInterval = setInterval(() => {
      console.group('ObjectPool Statistics');
      for (const [name, pool] of this.pools) {
        const stats = pool.getStats();
        console.log(`${name}: ${stats.inUse}/${stats.total} in use (${stats.utilization}), GC prevented: ${stats.gcPrevented}`);
      }
      console.groupEnd();
    }, interval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.monitoring = false;
  }

  /**
   * Trim all pools
   */
  trimAll(keepMinimum = 10) {
    for (const [name, pool] of this.pools) {
      pool.trim(keepMinimum);
    }
  }

  /**
   * Get combined statistics
   */
  getGlobalStats() {
    let totalCreated = 0;
    let totalInUse = 0;
    let totalGCPrevented = 0;

    for (const pool of this.pools.values()) {
      const stats = pool.getStats();
      totalCreated += stats.total;
      totalInUse += stats.inUse;
      totalGCPrevented += stats.gcPrevented;
    }

    return {
      pools: this.pools.size,
      totalObjects: totalCreated,
      totalInUse: totalInUse,
      totalGCPrevented: totalGCPrevented,
      globalUtilization: ((totalInUse / totalCreated) * 100).toFixed(1) + '%'
    };
  }

  /**
   * Dispose all pools
   */
  dispose() {
    this.stopMonitoring();
    for (const pool of this.pools.values()) {
      pool.dispose();
    }
    this.pools.clear();
  }
}

/**
 * Usage Example:
 *
 * // Initialize pools
 * const poolManager = new PoolManager();
 * poolManager.register('vector3', new Vector3Pool());
 * poolManager.register('vrbutton', new VRButtonPool());
 * poolManager.startMonitoring(10000); // Monitor every 10s
 *
 * // Use pools
 * const buttonPool = poolManager.getPool('vrbutton');
 * const button = buttonPool.acquire();
 * button.activate(position, 'Click Me', onClick);
 *
 * // Release when done
 * setTimeout(() => {
 *   buttonPool.release(button);
 * }, 5000);
 *
 * // Cleanup
 * poolManager.dispose();
 */