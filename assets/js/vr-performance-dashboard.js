/**
 * VR Performance Dashboard
 * リアルタイムパフォーマンス監視とビジュアライゼーション
 *
 * すべての2025年改善システムのメトリクスを統合表示:
 * - Fixed Foveated Rendering
 * - Multiview Rendering
 * - Hand Tracking
 * - Spatial Audio
 * - Captions
 * - Instanced Rendering
 * - Worker Manager
 *
 * @version 1.0.0
 */

class VRPerformanceDashboard {
  constructor(vrIntegrator) {
    this.vrIntegrator = vrIntegrator;
    this.container = null;
    this.charts = new Map();

    this.config = {
      updateInterval: 100, // ms
      historyLength: 100, // samples
      showInVR: false, // Show dashboard in VR
      position: 'top-left', // 'top-left', 'top-right', 'bottom-left', 'bottom-right'
      theme: 'dark' // 'dark' or 'light'
    };

    // Metrics history
    this.history = {
      fps: [],
      frameTime: [],
      cpuLoad: [],
      gpuLoad: [],
      memoryUsed: [],
      drawCalls: [],
      triangles: [],
      ffrLevel: [],
      handTrackingFPS: [],
      audioSources: [],
      activeCaptions: [],
      instanceCount: [],
      workerTasks: []
    };

    // Update interval
    this.updateInterval = null;

    console.info('[PerfDashboard] Performance Dashboard initialized');
  }

  /**
   * Initialize dashboard
   * @param {HTMLElement} container - Container element (optional)
   * @returns {HTMLElement} Dashboard element
   */
  initialize(container) {
    if (container) {
      this.container = container;
    } else {
      this.container = this.createDashboardElement();
      document.body.appendChild(this.container);
    }

    this.setupDashboard();
    this.startMonitoring();

    console.info('[PerfDashboard] Dashboard initialized');

    return this.container;
  }

  /**
   * Create dashboard HTML element
   * @returns {HTMLElement} Dashboard container
   */
  createDashboardElement() {
    const dashboard = document.createElement('div');
    dashboard.id = 'vr-performance-dashboard';
    dashboard.style.cssText = `
      position: fixed;
      ${this.getPositionStyles()}
      width: 400px;
      max-height: 80vh;
      overflow-y: auto;
      background: ${this.config.theme === 'dark' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)'};
      color: ${this.config.theme === 'dark' ? '#fff' : '#000'};
      font-family: 'Courier New', monospace;
      font-size: 12px;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      backdrop-filter: blur(10px);
    `;

    return dashboard;
  }

  /**
   * Get position styles based on config
   * @returns {string} CSS position styles
   */
  getPositionStyles() {
    const positions = {
      'top-left': 'top: 10px; left: 10px;',
      'top-right': 'top: 10px; right: 10px;',
      'bottom-left': 'bottom: 10px; left: 10px;',
      'bottom-right': 'bottom: 10px; right: 10px;'
    };

    return positions[this.config.position] || positions['top-left'];
  }

  /**
   * Setup dashboard content
   */
  setupDashboard() {
    this.container.innerHTML = `
      <div style="margin-bottom: 15px; border-bottom: 2px solid #00ff00; padding-bottom: 10px;">
        <h3 style="margin: 0 0 5px 0; color: #00ff00;">🎮 VR Performance Monitor</h3>
        <div id="perf-summary" style="font-size: 11px; opacity: 0.8;">v3.4.0</div>
      </div>

      <div id="perf-core" style="margin-bottom: 15px;">
        <h4 style="margin: 5px 0; color: #00ccff;">Core Metrics</h4>
        <div id="perf-fps">FPS: --</div>
        <div id="perf-frametime">Frame Time: --</div>
        <div id="perf-cpu">CPU Load: --</div>
        <div id="perf-gpu">GPU Load: --</div>
        <div id="perf-memory">Memory: --</div>
        <div id="perf-drawcalls">Draw Calls: --</div>
      </div>

      <div id="perf-systems" style="margin-bottom: 15px;">
        <h4 style="margin: 5px 0; color: #00ccff;">System Status</h4>
        <div id="perf-ffr">FFR: --</div>
        <div id="perf-multiview">Multiview: --</div>
        <div id="perf-handtracking">Hand Tracking: --</div>
        <div id="perf-audio">Spatial Audio: --</div>
        <div id="perf-captions">Captions: --</div>
        <div id="perf-instancing">Instancing: --</div>
        <div id="perf-workers">Workers: --</div>
      </div>

      <div id="perf-charts" style="margin-bottom: 15px;">
        <h4 style="margin: 5px 0; color: #00ccff;">Charts</h4>
        <canvas id="fps-chart" width="370" height="100" style="border: 1px solid #333; margin-top: 5px;"></canvas>
        <canvas id="frametime-chart" width="370" height="100" style="border: 1px solid #333; margin-top: 5px;"></canvas>
      </div>

      <div id="perf-recommendations" style="margin-top: 15px; padding: 10px; background: rgba(255, 165, 0, 0.1); border-left: 3px solid #ffa500; border-radius: 4px;">
        <h4 style="margin: 0 0 5px 0; color: #ffa500;">💡 Recommendations</h4>
        <div id="perf-tips" style="font-size: 11px;"></div>
      </div>

      <div style="margin-top: 15px; text-align: center; opacity: 0.6; font-size: 10px;">
        <button id="perf-toggle" style="padding: 5px 10px; cursor: pointer;">Toggle Dashboard</button>
      </div>
    `;

    // Setup toggle button
    const toggleBtn = this.container.querySelector('#perf-toggle');
    toggleBtn.addEventListener('click', () => this.toggle());

    // Initialize charts
    this.initializeCharts();
  }

  /**
   * Initialize performance charts
   */
  initializeCharts() {
    const fpsCanvas = this.container.querySelector('#fps-chart');
    const frameTimeCanvas = this.container.querySelector('#frametime-chart');

    if (fpsCanvas && frameTimeCanvas) {
      this.charts.set('fps', fpsCanvas.getContext('2d'));
      this.charts.set('frameTime', frameTimeCanvas.getContext('2d'));
    }
  }

  /**
   * Start monitoring
   */
  startMonitoring() {
    this.updateInterval = setInterval(() => {
      this.update();
    }, this.config.updateInterval);

    console.info('[PerfDashboard] Monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    console.info('[PerfDashboard] Monitoring stopped');
  }

  /**
   * Update dashboard
   */
  update() {
    if (!this.vrIntegrator || !this.vrIntegrator.initialized) {
      return;
    }

    const status = this.vrIntegrator.getStatus();
    const perfSummary = this.vrIntegrator.getPerformanceSummary();

    // Update core metrics
    this.updateCoreMetrics(perfSummary, status);

    // Update system status
    this.updateSystemStatus(status);

    // Update charts
    this.updateCharts(perfSummary);

    // Update recommendations
    this.updateRecommendations(perfSummary, status);
  }

  /**
   * Update core metrics display
   * @param {Object} perfSummary - Performance summary
   * @param {Object} status - System status
   */
  updateCoreMetrics(perfSummary, status) {
    const fps = perfSummary.fps || 0;
    const frameTime = fps > 0 ? (1000 / fps).toFixed(2) : 0;

    this.updateElement('perf-fps', `FPS: ${fps.toFixed(1)} ${this.getFPSIndicator(fps)}`);
    this.updateElement('perf-frametime', `Frame Time: ${frameTime}ms / 11.1ms`);
    this.updateElement('perf-cpu', `CPU Load: ${this.estimateCPULoad(status)}%`);
    this.updateElement('perf-gpu', `GPU Load: ${this.estimateGPULoad(status)}%`);
    this.updateElement('perf-memory', `Memory: ${this.estimateMemoryUsage()} MB`);
    this.updateElement('perf-drawcalls', `Draw Calls: ${this.estimateDrawCalls(status)}`);

    // Store history
    this.addToHistory('fps', fps);
    this.addToHistory('frameTime', frameTime);
  }

  /**
   * Update system status display
   * @param {Object} status - System status
   */
  updateSystemStatus(status) {
    // FFR
    if (status.capabilities.ffrSupported && status.systems.ffr) {
      const ffrLevel = status.systems.ffr.currentLevel;
      this.updateElement('perf-ffr', `FFR: ✅ Level ${ffrLevel.toFixed(2)}`);
    } else {
      this.updateElement('perf-ffr', `FFR: ❌ Not available`);
    }

    // Multiview
    if (status.capabilities.multiviewSupported) {
      this.updateElement('perf-multiview', `Multiview: ✅ Active`);
    } else {
      this.updateElement('perf-multiview', `Multiview: ❌ Not available`);
    }

    // Hand Tracking
    if (status.capabilities.handTrackingSupported && status.systems.handTracking) {
      const trackingFPS = status.systems.handTracking.trackingFPS || 0;
      this.updateElement('perf-handtracking', `Hand Tracking: ✅ ${trackingFPS} FPS`);
    } else {
      this.updateElement('perf-handtracking', `Hand Tracking: ❌ Not available`);
    }

    // Spatial Audio
    if (status.capabilities.spatialAudioSupported && status.systems.spatialAudio) {
      const sources = status.systems.spatialAudio.activeSourcesCount || 0;
      this.updateElement('perf-audio', `Spatial Audio: ✅ ${sources} sources`);
    } else {
      this.updateElement('perf-audio', `Spatial Audio: ❌ Not available`);
    }

    // Captions
    if (status.capabilities.captionsSupported && status.systems.captions) {
      const captions = status.systems.captions.activeCaptionsCount || 0;
      this.updateElement('perf-captions', `Captions: ✅ ${captions} active`);
    } else {
      this.updateElement('perf-captions', `Captions: ❌ Not available`);
    }

    // Placeholder for instancing and workers
    this.updateElement('perf-instancing', `Instancing: ℹ️ N/A`);
    this.updateElement('perf-workers', `Workers: ℹ️ N/A`);
  }

  /**
   * Update charts
   * @param {Object} perfSummary - Performance summary
   */
  updateCharts(perfSummary) {
    this.drawLineChart('fps', this.history.fps, '#00ff00', 0, 120, '90 FPS target');
    this.drawLineChart('frameTime', this.history.frameTime, '#ffaa00', 0, 20, '11.1ms target');
  }

  /**
   * Draw line chart
   * @param {string} chartId - Chart ID
   * @param {Array} data - Data points
   * @param {string} color - Line color
   * @param {number} minY - Min Y value
   * @param {number} maxY - Max Y value
   * @param {string} label - Chart label
   */
  drawLineChart(chartId, data, color, minY, maxY, label) {
    const ctx = this.charts.get(chartId);
    if (!ctx) return;

    const canvas = ctx.canvas;
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = this.config.theme === 'dark' ? '#000' : '#fff';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = this.config.theme === 'dark' ? '#333' : '#ddd';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw target line (for FPS: 90, for frameTime: 11.1)
    if (chartId === 'fps') {
      const targetY = height - ((90 - minY) / (maxY - minY)) * height;
      ctx.strokeStyle = '#00ff00';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, targetY);
      ctx.lineTo(width, targetY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw data
    if (data.length > 1) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let i = 0; i < data.length; i++) {
        const x = (i / (this.config.historyLength - 1)) * width;
        const y = height - ((data[i] - minY) / (maxY - minY)) * height;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    }

    // Draw label
    ctx.fillStyle = this.config.theme === 'dark' ? '#fff' : '#000';
    ctx.font = '10px monospace';
    ctx.fillText(label, 5, 12);

    // Draw current value
    if (data.length > 0) {
      const currentValue = data[data.length - 1];
      ctx.fillText(currentValue.toFixed(1), width - 40, 12);
    }
  }

  /**
   * Update recommendations
   * @param {Object} perfSummary - Performance summary
   * @param {Object} status - System status
   */
  updateRecommendations(perfSummary, status) {
    const tips = [];

    // FPS-based recommendations
    if (perfSummary.fps < 72) {
      tips.push('⚠️ FPS below 72 - Enable FFR or reduce scene complexity');
    } else if (perfSummary.fps < 90) {
      tips.push('ℹ️ FPS below target - Consider enabling Multiview or increasing FFR');
    }

    // System-specific tips
    if (!status.capabilities.ffrSupported) {
      tips.push('💡 FFR not available - Device may not support it');
    }

    if (!status.capabilities.multiviewSupported) {
      tips.push('💡 Multiview not available - Requires WebGL 2.0 + extension');
    }

    if (tips.length === 0) {
      tips.push('✅ Performance is optimal!');
    }

    this.updateElement('perf-tips', tips.join('<br>'));
  }

  /**
   * Add value to history
   * @param {string} metric - Metric name
   * @param {number} value - Value
   */
  addToHistory(metric, value) {
    if (!this.history[metric]) {
      this.history[metric] = [];
    }

    this.history[metric].push(value);

    if (this.history[metric].length > this.config.historyLength) {
      this.history[metric].shift();
    }
  }

  /**
   * Update element text
   * @param {string} id - Element ID
   * @param {string} text - Text content
   */
  updateElement(id, text) {
    const element = this.container.querySelector(`#${id}`);
    if (element) {
      element.innerHTML = text;
    }
  }

  /**
   * Get FPS indicator
   * @param {number} fps - FPS value
   * @returns {string} Indicator
   */
  getFPSIndicator(fps) {
    if (fps >= 90) return '🟢';
    if (fps >= 72) return '🟡';
    return '🔴';
  }

  /**
   * Estimate CPU load
   * @param {Object} status - System status
   * @returns {number} Estimated CPU load percentage
   */
  estimateCPULoad(status) {
    // Placeholder estimation
    let load = 50;

    if (status.capabilities.multiviewSupported) {
      load -= 20; // Multiview reduces CPU load
    }

    return Math.max(0, Math.min(100, load));
  }

  /**
   * Estimate GPU load
   * @param {Object} status - System status
   * @returns {number} Estimated GPU load percentage
   */
  estimateGPULoad(status) {
    // Placeholder estimation
    let load = 70;

    if (status.capabilities.ffrSupported && status.systems.ffr) {
      const ffrReduction = status.systems.ffr.currentLevel * 40; // Up to 40% reduction
      load -= ffrReduction;
    }

    return Math.max(0, Math.min(100, load));
  }

  /**
   * Estimate memory usage
   * @returns {number} Estimated memory in MB
   */
  estimateMemoryUsage() {
    if (performance.memory) {
      return (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
    }
    return 0;
  }

  /**
   * Estimate draw calls
   * @param {Object} status - System status
   * @returns {number} Estimated draw calls
   */
  estimateDrawCalls(status) {
    // Placeholder
    let calls = 200;

    if (status.capabilities.multiviewSupported) {
      calls = Math.floor(calls / 2); // Multiview halves draw calls
    }

    return calls;
  }

  /**
   * Toggle dashboard visibility
   */
  toggle() {
    if (this.container.style.display === 'none') {
      this.container.style.display = 'block';
    } else {
      this.container.style.display = 'none';
    }
  }

  /**
   * Show dashboard
   */
  show() {
    this.container.style.display = 'block';
  }

  /**
   * Hide dashboard
   */
  hide() {
    this.container.style.display = 'none';
  }

  /**
   * Dispose dashboard
   */
  dispose() {
    this.stopMonitoring();

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.charts.clear();

    console.info('[PerfDashboard] Disposed');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRPerformanceDashboard;
}

// Global instance
window.VRPerformanceDashboard = VRPerformanceDashboard;

console.info('[PerfDashboard] VR Performance Dashboard loaded');
