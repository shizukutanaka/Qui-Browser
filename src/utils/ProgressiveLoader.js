/**
 * Progressive Loading System
 * Load critical assets first, secondary assets in background
 *
 * John Carmack principle: Perceived performance matters more than actual
 */

export class ProgressiveLoader {
  constructor() {
    this.loadQueue = {
      critical: [],     // Must load before interaction
      primary: [],      // Load immediately after critical
      secondary: [],    // Load in background
      lazy: []         // Load on demand only
    };

    this.loaded = new Map();
    this.pending = new Map();
    this.failed = new Map();

    // Loading strategy
    this.strategy = {
      parallelLimit: 6,        // Max parallel downloads
      retryAttempts: 3,        // Retry failed loads
      retryDelay: 1000,        // Delay between retries
      timeout: 30000,          // Request timeout
      adaptiveQuality: true,   // Adjust quality based on connection
      preloadNext: true        // Preload anticipated resources
    };

    // Network detection
    this.network = {
      type: 'unknown',
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: false
    };

    // Statistics
    this.stats = {
      totalBytes: 0,
      loadedBytes: 0,
      itemsTotal: 0,
      itemsLoaded: 0,
      loadTime: 0,
      startTime: 0
    };

    // Callbacks
    this.callbacks = {
      onProgress: null,
      onComplete: null,
      onError: null
    };

    this.detectNetwork();
  }

  /**
   * Detect network conditions
   */
  detectNetwork() {
    if ('connection' in navigator) {
      const conn = navigator.connection;
      this.network = {
        type: conn.type || 'unknown',
        effectiveType: conn.effectiveType || '4g',
        downlink: conn.downlink || 10,
        rtt: conn.rtt || 50,
        saveData: conn.saveData || false
      };

      // Listen for network changes
      conn.addEventListener('change', () => {
        this.onNetworkChange();
      });
    }

    console.log('ProgressiveLoader: Network detected', this.network);
  }

  /**
   * Handle network change
   */
  onNetworkChange() {
    const conn = navigator.connection;
    const oldType = this.network.effectiveType;

    this.network = {
      type: conn.type || 'unknown',
      effectiveType: conn.effectiveType || '4g',
      downlink: conn.downlink || 10,
      rtt: conn.rtt || 50,
      saveData: conn.saveData || false
    };

    console.log('ProgressiveLoader: Network changed', {
      from: oldType,
      to: this.network.effectiveType
    });

    // Adjust strategy based on network
    this.adjustStrategy();
  }

  /**
   * Adjust loading strategy based on network
   */
  adjustStrategy() {
    switch (this.network.effectiveType) {
      case 'slow-2g':
      case '2g':
        this.strategy.parallelLimit = 2;
        this.strategy.adaptiveQuality = true;
        this.strategy.preloadNext = false;
        break;

      case '3g':
        this.strategy.parallelLimit = 4;
        this.strategy.adaptiveQuality = true;
        this.strategy.preloadNext = true;
        break;

      case '4g':
      default:
        this.strategy.parallelLimit = 6;
        this.strategy.adaptiveQuality = false;
        this.strategy.preloadNext = true;
        break;
    }

    // Respect save data
    if (this.network.saveData) {
      this.strategy.adaptiveQuality = true;
      this.strategy.preloadNext = false;
      console.log('ProgressiveLoader: Data saver mode enabled');
    }
  }

  /**
   * Add resource to load queue
   */
  addResource(resource, priority = 'secondary') {
    const item = {
      url: resource.url,
      type: resource.type || 'auto',
      name: resource.name || resource.url,
      size: resource.size || 0,
      retries: 0,
      priority: priority,
      options: resource.options || {}
    };

    // Add to appropriate queue
    this.loadQueue[priority].push(item);
    this.stats.itemsTotal++;

    if (item.size) {
      this.stats.totalBytes += item.size;
    }

    return item;
  }

  /**
   * Start progressive loading
   */
  async start() {
    this.stats.startTime = performance.now();
    console.log('ProgressiveLoader: Starting progressive load');

    // Phase 1: Critical resources (blocking)
    await this.loadPhase('critical');

    // Signal critical complete
    if (this.callbacks.onCriticalComplete) {
      this.callbacks.onCriticalComplete();
    }

    // Phase 2: Primary resources (non-blocking)
    this.loadPhase('primary').catch(console.warn);

    // Phase 3: Secondary resources (background)
    requestIdleCallback(() => {
      this.loadPhase('secondary').catch(console.warn);
    });

    // Phase 4: Lazy resources loaded on-demand only

    return true;
  }

  /**
   * Load a phase of resources
   */
  async loadPhase(priority) {
    const queue = this.loadQueue[priority];
    if (queue.length === 0) return;

    console.log(`ProgressiveLoader: Loading ${priority} phase (${queue.length} items)`);

    // Process queue with parallel limit
    const chunks = this.chunkArray(queue, this.strategy.parallelLimit);

    for (const chunk of chunks) {
      const promises = chunk.map(item => this.loadResource(item));
      await Promise.allSettled(promises);
    }
  }

  /**
   * Load individual resource
   */
  async loadResource(item) {
    // Check if already loaded
    if (this.loaded.has(item.name)) {
      return this.loaded.get(item.name);
    }

    // Check if already pending
    if (this.pending.has(item.name)) {
      return this.pending.get(item.name);
    }

    // Adapt quality based on network
    if (this.strategy.adaptiveQuality) {
      item.url = this.getAdaptiveUrl(item.url);
    }

    // Create loading promise
    const loadPromise = this.performLoad(item);
    this.pending.set(item.name, loadPromise);

    try {
      const result = await loadPromise;
      this.loaded.set(item.name, result);
      this.pending.delete(item.name);
      this.onResourceLoaded(item, result);
      return result;

    } catch (error) {
      this.pending.delete(item.name);

      // Retry logic
      if (item.retries < this.strategy.retryAttempts) {
        item.retries++;
        console.warn(`ProgressiveLoader: Retrying ${item.name} (${item.retries}/${this.strategy.retryAttempts})`);
        await this.delay(this.strategy.retryDelay * item.retries);
        return this.loadResource(item);
      }

      // Failed after retries
      this.failed.set(item.name, error);
      this.onResourceFailed(item, error);
      throw error;
    }
  }

  /**
   * Perform actual load based on type
   */
  async performLoad(item) {
    const startTime = performance.now();

    switch (item.type) {
      case 'image':
        return this.loadImage(item.url);

      case 'script':
        return this.loadScript(item.url);

      case 'style':
        return this.loadStyle(item.url);

      case 'json':
        return this.loadJSON(item.url);

      case 'audio':
        return this.loadAudio(item.url);

      case 'video':
        return this.loadVideo(item.url);

      case 'model':
        return this.loadModel(item.url);

      case 'texture':
        return this.loadTexture(item.url);

      default:
        return this.loadGeneric(item.url);
    }
  }

  /**
   * Load image
   */
  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = reject;

      // Set crossorigin for CORS
      img.crossOrigin = 'anonymous';

      img.src = url;
    });
  }

  /**
   * Load script
   */
  loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');

      script.onload = () => resolve(script);
      script.onerror = reject;

      script.src = url;
      script.async = true;

      document.head.appendChild(script);
    });
  }

  /**
   * Load stylesheet
   */
  loadStyle(url) {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');

      link.onload = () => resolve(link);
      link.onerror = reject;

      link.rel = 'stylesheet';
      link.href = url;

      document.head.appendChild(link);
    });
  }

  /**
   * Load JSON
   */
  async loadJSON(url) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: this.getAbortSignal()
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Load audio
   */
  loadAudio(url) {
    return new Promise((resolve, reject) => {
      const audio = new Audio();

      audio.oncanplaythrough = () => resolve(audio);
      audio.onerror = reject;

      audio.src = url;
      audio.load();
    });
  }

  /**
   * Load video
   */
  loadVideo(url) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');

      video.oncanplaythrough = () => resolve(video);
      video.onerror = reject;

      video.src = url;
      video.load();
    });
  }

  /**
   * Load 3D model
   */
  async loadModel(url) {
    // Would use Three.js loaders in production
    const response = await fetch(url, {
      signal: this.getAbortSignal()
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.arrayBuffer();
  }

  /**
   * Load texture
   */
  async loadTexture(url) {
    // Delegate to TextureManager if available
    if (window.textureManager) {
      return window.textureManager.loadTexture(url);
    }

    // Fallback to image load
    return this.loadImage(url);
  }

  /**
   * Load generic resource
   */
  async loadGeneric(url) {
    const response = await fetch(url, {
      signal: this.getAbortSignal()
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.blob();
  }

  /**
   * Get abort signal for timeout
   */
  getAbortSignal() {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), this.strategy.timeout);
    return controller.signal;
  }

  /**
   * Get adaptive URL based on network
   */
  getAdaptiveUrl(url) {
    // Skip if not an image/video
    if (!url.match(/\.(jpg|jpeg|png|webp|mp4|webm)$/i)) {
      return url;
    }

    // Quality suffixes based on network
    const qualityMap = {
      'slow-2g': '_low',
      '2g': '_low',
      '3g': '_medium',
      '4g': '_high'
    };

    const quality = qualityMap[this.network.effectiveType] || '_high';

    // Insert quality suffix before extension
    return url.replace(/(\.[^.]+)$/, `${quality}$1`);
  }

  /**
   * Handle resource loaded
   */
  onResourceLoaded(item, result) {
    this.stats.itemsLoaded++;

    if (item.size) {
      this.stats.loadedBytes += item.size;
    }

    const progress = this.stats.itemsLoaded / this.stats.itemsTotal;

    console.log(`ProgressiveLoader: Loaded ${item.name} (${Math.round(progress * 100)}%)`);

    if (this.callbacks.onProgress) {
      this.callbacks.onProgress({
        item: item,
        progress: progress,
        loaded: this.stats.itemsLoaded,
        total: this.stats.itemsTotal
      });
    }

    // Check if complete
    if (this.stats.itemsLoaded === this.stats.itemsTotal) {
      this.onLoadComplete();
    }
  }

  /**
   * Handle resource failed
   */
  onResourceFailed(item, error) {
    console.error(`ProgressiveLoader: Failed to load ${item.name}`, error);

    if (this.callbacks.onError) {
      this.callbacks.onError({
        item: item,
        error: error
      });
    }
  }

  /**
   * Handle load complete
   */
  onLoadComplete() {
    this.stats.loadTime = performance.now() - this.stats.startTime;

    console.log('ProgressiveLoader: All resources loaded', {
      items: this.stats.itemsLoaded,
      bytes: this.stats.loadedBytes,
      time: `${this.stats.loadTime.toFixed(0)}ms`,
      speed: `${(this.stats.loadedBytes / this.stats.loadTime * 1000 / 1024).toFixed(0)} KB/s`
    });

    if (this.callbacks.onComplete) {
      this.callbacks.onComplete(this.stats);
    }
  }

  /**
   * Get loaded resource
   */
  get(name) {
    return this.loaded.get(name);
  }

  /**
   * Load resource on demand
   */
  async loadOnDemand(resource) {
    const item = this.addResource(resource, 'lazy');
    return this.loadResource(item);
  }

  /**
   * Preload anticipated resources
   */
  preload(resources) {
    if (!this.strategy.preloadNext) return;

    resources.forEach(resource => {
      this.addResource(resource, 'secondary');
    });

    // Load in background
    requestIdleCallback(() => {
      this.loadPhase('secondary').catch(console.warn);
    });
  }

  /**
   * Utility: Chunk array
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Utility: Delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      network: this.network,
      failed: this.failed.size,
      pending: this.pending.size,
      progressPercent: (this.stats.itemsLoaded / this.stats.itemsTotal * 100).toFixed(1)
    };
  }

  /**
   * Dispose
   */
  dispose() {
    this.loadQueue.critical = [];
    this.loadQueue.primary = [];
    this.loadQueue.secondary = [];
    this.loadQueue.lazy = [];

    this.loaded.clear();
    this.pending.clear();
    this.failed.clear();
  }
}

/**
 * Usage Example:
 *
 * const loader = new ProgressiveLoader();
 *
 * // Set callbacks
 * loader.callbacks.onProgress = (data) => {
 *   console.log(`Loading: ${data.loaded}/${data.total}`);
 * };
 *
 * // Add critical resources
 * loader.addResource({
 *   url: '/js/app.js',
 *   type: 'script',
 *   name: 'app'
 * }, 'critical');
 *
 * // Add primary resources
 * loader.addResource({
 *   url: '/models/scene.glb',
 *   type: 'model',
 *   name: 'scene',
 *   size: 1024000
 * }, 'primary');
 *
 * // Add secondary resources
 * loader.addResource({
 *   url: '/textures/environment.hdr',
 *   type: 'texture',
 *   name: 'environment'
 * }, 'secondary');
 *
 * // Start loading
 * await loader.start();
 *
 * // Get loaded resource
 * const app = loader.get('app');
 */