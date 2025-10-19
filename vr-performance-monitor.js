/**
 * VR Performance Monitor
 * Real-time performance monitoring optimized for VR headsets
 */

class VRPerformanceMonitor {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.updateInterval = options.updateInterval || 1000; // 1 second
    this.maxHistorySize = options.maxHistorySize || 60; // 1 minute of data

    // Performance metrics
    this.metrics = {
      fps: [],
      frameTime: [],
      memory: [],
      batteryLevel: [],
      cacheSize: 0,
      networkStatus: 'online'
    };

    // Stats display element
    this.statsElement = null;
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.rafId = null;
    this.updateIntervalId = null;

    if (this.enabled) {
      this.init();
    }
  }

  init() {
    this.createStatsDisplay();
    this.startMonitoring();
    this.setupEventListeners();
  }

  createStatsDisplay() {
    // Create stats overlay
    this.statsElement = document.createElement('div');
    this.statsElement.id = 'vr-performance-stats';
    this.statsElement.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.85);
      color: #0f0;
      padding: 15px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      z-index: 10000;
      min-width: 250px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(5px);
      border: 1px solid rgba(0, 255, 0, 0.3);
      display: none;
    `;

    document.body.appendChild(this.statsElement);
  }

  startMonitoring() {
    // Start FPS counter
    this.rafId = requestAnimationFrame(() => this.measureFPS());

    // Start periodic updates
    this.updateIntervalId = setInterval(() => {
      this.updateMetrics();
      this.updateDisplay();
    }, this.updateInterval);
  }

  measureFPS() {
    const now = performance.now();
    const delta = now - this.lastFrameTime;

    this.frameCount++;

    // Calculate FPS every second
    if (delta >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / delta);
      const frameTime = delta / this.frameCount;

      this.addMetric('fps', fps);
      this.addMetric('frameTime', frameTime);

      this.frameCount = 0;
      this.lastFrameTime = now;
    }

    this.rafId = requestAnimationFrame(() => this.measureFPS());
  }

  async updateMetrics() {
    // Memory usage
    if (performance.memory) {
      const memoryMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
      this.addMetric('memory', memoryMB);
    }

    // Battery status
    if (navigator.getBattery) {
      try {
        const battery = await navigator.getBattery();
        const level = Math.round(battery.level * 100);
        this.addMetric('batteryLevel', level);
      } catch (error) {
        // Battery API not available
      }
    }

    // Cache size
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        this.metrics.cacheSize = estimate.usage;
      } catch (error) {
        // Storage API not available
      }
    }

    // Network status
    this.metrics.networkStatus = navigator.onLine ? 'online' : 'offline';
  }

  addMetric(name, value) {
    if (!this.metrics[name]) {
      this.metrics[name] = [];
    }

    this.metrics[name].push(value);

    // Keep only recent history
    if (this.metrics[name].length > this.maxHistorySize) {
      this.metrics[name].shift();
    }
  }

  getAverageMetric(name) {
    const values = this.metrics[name];
    if (!values || values.length === 0) return 0;

    const sum = values.reduce((a, b) => a + b, 0);
    return Math.round(sum / values.length);
  }

  getCurrentMetric(name) {
    const values = this.metrics[name];
    if (!values || values.length === 0) return 0;
    return values[values.length - 1];
  }

  getMinMetric(name) {
    const values = this.metrics[name];
    if (!values || values.length === 0) return 0;
    return Math.min(...values);
  }

  getMaxMetric(name) {
    const values = this.metrics[name];
    if (!values || values.length === 0) return 0;
    return Math.max(...values);
  }

  updateDisplay() {
    if (!this.statsElement) return;

    const fps = this.getCurrentMetric('fps');
    const avgFps = this.getAverageMetric('fps');
    const minFps = this.getMinMetric('fps');
    const frameTime = this.getCurrentMetric('frameTime');
    const memory = this.getCurrentMetric('memory');
    const battery = this.getCurrentMetric('batteryLevel');
    const cacheSize = this.formatBytes(this.metrics.cacheSize);
    const network = this.metrics.networkStatus;

    // Color code FPS
    let fpsColor = '#0f0'; // Green
    if (fps < 60) fpsColor = '#ff0'; // Yellow
    if (fps < 30) fpsColor = '#f00'; // Red

    // Color code frame time
    let frameTimeColor = '#0f0';
    if (frameTime > 16.67) frameTimeColor = '#ff0'; // > 60 FPS
    if (frameTime > 33.33) frameTimeColor = '#f00'; // > 30 FPS

    this.statsElement.innerHTML = `
      <div style="color: #0ff; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #0ff; padding-bottom: 5px;">
        📊 VR Performance Monitor
      </div>
      <div style="color: ${fpsColor}; font-weight: bold;">
        FPS: ${fps} (avg: ${avgFps}, min: ${minFps})
      </div>
      <div style="color: ${frameTimeColor};">
        Frame Time: ${frameTime.toFixed(2)}ms
      </div>
      <div style="color: #0f0;">
        Memory: ${memory}MB
      </div>
      ${battery > 0 ? `<div style="color: ${this.getBatteryColor(battery)};">Battery: ${battery}%</div>` : ''}
      <div style="color: #0ff;">
        Cache: ${cacheSize}
      </div>
      <div style="color: ${network === 'online' ? '#0f0' : '#f00'};">
        Network: ${network.toUpperCase()}
      </div>
      <div style="color: #888; font-size: 11px; margin-top: 10px; border-top: 1px solid #333; padding-top: 5px;">
        Press 'P' to toggle
      </div>
    `;
  }

  getBatteryColor(level) {
    if (level > 50) return '#0f0';
    if (level > 20) return '#ff0';
    return '#f00';
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  setupEventListeners() {
    // Toggle display with 'P' key
    document.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'p') {
        this.toggle();
      }
    });

    // Update network status
    window.addEventListener('online', () => {
      this.metrics.networkStatus = 'online';
    });

    window.addEventListener('offline', () => {
      this.metrics.networkStatus = 'offline';
    });
  }

  toggle() {
    if (!this.statsElement) return;

    if (this.statsElement.style.display === 'none') {
      this.show();
    } else {
      this.hide();
    }
  }

  show() {
    if (this.statsElement) {
      this.statsElement.style.display = 'block';
    }
  }

  hide() {
    if (this.statsElement) {
      this.statsElement.style.display = 'none';
    }
  }

  getReport() {
    return {
      fps: {
        current: this.getCurrentMetric('fps'),
        average: this.getAverageMetric('fps'),
        min: this.getMinMetric('fps'),
        max: this.getMaxMetric('fps')
      },
      frameTime: {
        current: this.getCurrentMetric('frameTime'),
        average: this.getAverageMetric('frameTime')
      },
      memory: {
        current: this.getCurrentMetric('memory'),
        average: this.getAverageMetric('memory')
      },
      battery: {
        current: this.getCurrentMetric('batteryLevel')
      },
      cache: {
        size: this.metrics.cacheSize,
        formatted: this.formatBytes(this.metrics.cacheSize)
      },
      network: this.metrics.networkStatus
    };
  }

  reset() {
    this.metrics = {
      fps: [],
      frameTime: [],
      memory: [],
      batteryLevel: [],
      cacheSize: 0,
      networkStatus: 'online'
    };
  }

  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }

    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
    }

    if (this.statsElement) {
      this.statsElement.remove();
    }
  }
}

// Auto-initialize
if (typeof window !== 'undefined') {
  window.VRPerformanceMonitor = VRPerformanceMonitor;

  // Auto-start monitor in development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.addEventListener('DOMContentLoaded', () => {
      window.vrPerformanceMonitor = new VRPerformanceMonitor({ enabled: true });
      window.vrPerformanceMonitor.show();
    });
  }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRPerformanceMonitor;
}
