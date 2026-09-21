/**
 * Texture Manager — LRU cache + memory accounting for THREE textures.
 *
 * John Carmack principle: Optimize where it matters - textures are biggest memory consumers
 */

import * as THREE from 'three';

export class TextureManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.textureCache = new Map();
    this.pendingLoads = new Map(); // url → in-flight loadTexture promise
    this.textureLoader = new THREE.TextureLoader();

    // Memory tracking
    this.memoryUsage = {
      textureCount: 0,
      estimatedBytes: 0,
      maxBytes: 512 * 1024 * 1024 // 512MB limit for Quest 2
    };

    // Statistics
    this.stats = {
      texturesLoaded: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalLoadTime: 0
    };
  }

  /**
   * Load a texture (PNG/JPG/…) with caching and memory accounting.
   */
  async loadTexture(url, options = {}) {
    // Check cache first
    if (this.textureCache.has(url)) {
      this.stats.cacheHits++;
      const entry = this.textureCache.get(url);
      // Refresh recency: re-insert so pruneCache's LRU eviction order
      // (Map insertion order) reflects the hit.
      this.textureCache.delete(url);
      this.textureCache.set(url, entry);
      return entry.texture;
    }

    // A concurrent load of the same URL must share the in-flight promise:
    // loadTextures() maps URLs synchronously, so a duplicate URL misses the
    // cache above and would otherwise fetch twice — and cacheTexture() would
    // then double-count estimatedBytes/textureCount for a single entry.
    if (this.pendingLoads.has(url)) {
      return this.pendingLoads.get(url);
    }

    const pending = this._loadTexture(url, options)
      .finally(() => {
        this.pendingLoads.delete(url);
      });
    this.pendingLoads.set(url, pending);
    return pending;
  }

  async _loadTexture(url, options) {
    const startTime = performance.now();

    this.stats.cacheMisses++;

    let texture;

    try {
      texture = await this.loadStandardTexture(url);
      this.stats.texturesLoaded++;

      // Apply texture settings
      this.applyTextureSettings(texture, options);

      // Cache the texture
      this.cacheTexture(url, texture);

      // Track load time
      this.stats.totalLoadTime += performance.now() - startTime;

      return texture;
    } catch (error) {
      console.error(`TextureManager: Failed to load ${url}`, error);

      // Return error texture
      return this.getErrorTexture();
    }
  }

  /**
   * Load standard texture (PNG/JPG)
   */
  async loadStandardTexture(url) {
    return this._withTimeout(new Promise((resolve, reject) => {
      this.textureLoader.load(
        url,
        (texture) => resolve(texture),
        undefined,
        (error) => reject(error)
      );
    }), url);
  }

  /**
   * Bound a loader promise: three's loaders carry no built-in timeout, so a
   * stalled server leaves the promise pending forever — the texture never
   * resolves AND the pendingLoads dedupe entry is never released. The
   * underlying request still runs to completion harmlessly when it loses
   * the race; the caller gets an error path either way.
   */
  _withTimeout(promise, url) {
    let timer;
    const watchdog = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timeout loading texture: ${url}`)), 30000);
    });
    return Promise.race([promise, watchdog]).finally(() => clearTimeout(timer));
  }

  /**
   * Apply texture settings
   */
  applyTextureSettings(texture, options) {
    // Wrapping
    texture.wrapS = options.wrapS || THREE.RepeatWrapping;
    texture.wrapT = options.wrapT || THREE.RepeatWrapping;

    // Filtering
    texture.magFilter = options.magFilter || THREE.LinearFilter;
    texture.minFilter = options.minFilter || THREE.LinearMipMapLinearFilter;

    // Anisotropy (improves quality at angles)
    texture.anisotropy = options.anisotropy ||
                         this.renderer.capabilities.getMaxAnisotropy();

    // Color space (replaces the deprecated .encoding API in THREE r152+)
    if (options.colorSpace) {
      texture.colorSpace = options.colorSpace;
    } else if (options.encoding) {
      // Legacy callers: map old LinearEncoding/sRGBEncoding constants to the
      // new colorSpace strings so existing call-sites keep working.
      texture.colorSpace = options.encoding === 3001  // THREE.sRGBEncoding
        ? 'srgb'
        : 'srgb-linear';
    }

    // Generate mipmaps for better quality
    if (texture.minFilter !== THREE.NearestFilter &&
        texture.minFilter !== THREE.LinearFilter) {
      texture.generateMipmaps = true;
    }
  }

  /**
   * Cache texture and update memory tracking
   */
  cacheTexture(url, texture) {
    // Replacing an already-cached URL would double-count memory usage —
    // evict the old entry first so estimatedBytes/textureCount stay exact.
    if (this.textureCache.has(url)) {
      this.unloadTexture(url);
    }

    this.textureCache.set(url, { texture });

    // Estimate memory usage
    const bytes = this.estimateTextureMemory(texture);
    this.memoryUsage.estimatedBytes += bytes;
    this.memoryUsage.textureCount++;

    // Check memory limit
    if (this.memoryUsage.estimatedBytes > this.memoryUsage.maxBytes) {
      console.warn('TextureManager: Memory limit exceeded, pruning cache');
      this.pruneCache();
    }
  }

  /**
   * Estimate texture memory usage (uncompressed RGBA).
   */
  estimateTextureMemory(texture) {
    if (!texture.image) {
      return 0;
    }

    const width = texture.image.width || 512;
    const height = texture.image.height || 512;

    return width * height * 4;
  }

  /**
   * Prune least recently used textures
   */
  pruneCache() {
    const targetSize = Math.floor(this.memoryUsage.maxBytes * 0.7);
    const entries = Array.from(this.textureCache.entries());

    while (this.memoryUsage.estimatedBytes > targetSize && entries.length > 0) {
      const [url] = entries.shift();
      this.unloadTexture(url);
    }
  }

  /**
   * Unload texture from cache
   */
  unloadTexture(url) {
    const cached = this.textureCache.get(url);
    if (!cached) {
      return;
    }
    const { texture } = cached;

    // Estimate memory BEFORE disposing — dispose() may clear texture.image,
    // which would make the size estimate wrong (and skew tracking).
    const bytes = this.estimateTextureMemory(texture);

    // Dispose texture
    texture.dispose();

    // Update memory tracking
    this.memoryUsage.estimatedBytes -= bytes;
    this.memoryUsage.textureCount--;

    // Remove from cache
    this.textureCache.delete(url);
  }

  /**
   * Unload all textures
   */
  unloadAll() {
    for (const { texture } of this.textureCache.values()) {
      texture.dispose();
    }

    this.textureCache.clear();
    this.memoryUsage.estimatedBytes = 0;
    this.memoryUsage.textureCount = 0;
  }

  /**
   * Get error texture (checkerboard pattern)
   */
  getErrorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;

    const context = canvas.getContext('2d');
    const size = 32;

    // Create checkerboard pattern
    for (let y = 0; y < canvas.height; y += size) {
      for (let x = 0; x < canvas.width; x += size) {
        const isEven = ((x / size) + (y / size)) % 2 === 0;
        context.fillStyle = isEven ? '#FF00FF' : '#000000';
        context.fillRect(x, y, size, size);
      }
    }

    return new THREE.CanvasTexture(canvas);
  }

  /**
   * Batch load textures
   */
  async loadTextures(urls, options = {}) {
    const promises = urls.map(url => this.loadTexture(url, options));
    return Promise.all(promises);
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats() {
    return {
      textureCount: this.memoryUsage.textureCount,
      usedMB: (this.memoryUsage.estimatedBytes / 1024 / 1024).toFixed(2),
      maxMB: (this.memoryUsage.maxBytes / 1024 / 1024).toFixed(2),
      utilizationPercent: ((this.memoryUsage.estimatedBytes / this.memoryUsage.maxBytes) * 100).toFixed(1)
    };
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      texturesLoaded: this.stats.texturesLoaded,
      cacheHitRate: (this.stats.cacheHits + this.stats.cacheMisses) > 0
        ? this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100
        : 0,
      avgLoadTime: this.stats.texturesLoaded > 0
        ? this.stats.totalLoadTime / this.stats.texturesLoaded
        : 0
    };
  }

  /**
   * Dispose texture manager
   */
  dispose() {
    this.unloadAll();
    this.pendingLoads.clear();
  }
}

/**
 * Usage Example:
 *
 * const textureManager = new TextureManager(renderer);
 *
 * // Load single texture
 * const texture = await textureManager.loadTexture('assets/textures/wood.png');
 *
 * // Load with options
 * const normalMap = await textureManager.loadTexture('assets/textures/wood_normal.png', {
 *   colorSpace: THREE.LinearSRGBColorSpace
 * });
 *
 * // Batch load
 * const textures = await textureManager.loadTextures([
 *   'assets/textures/diffuse.png',
 *   'assets/textures/normal.png',
 *   'assets/textures/roughness.png'
 * ]);
 *
 * // Check memory usage
 * const memStats = textureManager.getMemoryStats();
 * console.debug(`Texture memory: ${memStats.usedMB}/${memStats.maxMB} MB`);
 *
 * // Cleanup
 * textureManager.dispose();
 */
