/**
 * Performance Monitoring Dashboard
 * Real-time metrics with historical data and alerts
 *
 * John Carmack principle: You can't optimize what you don't measure
 */

import * as THREE from 'three';

export class PerformanceMonitor {
  constructor() {
    this.enabled = true;
    this.visible = false;

    // Metrics
    this.metrics = {
      fps: { current: 0, min: 999, max: 0, avg: 0, history: [] },
      frameTime: { current: 0, min: 999, max: 0, avg: 0, history: [] },
      memory: { current: 0, min: 999, max: 0, avg: 0, history: [] },
      gpu: { current: 0, min: 999, max: 0, avg: 0, history: [] },
      drawCalls: { current: 0, min: 999, max: 0, avg: 0, history: [] },
      triangles: { current: 0, min: 999, max: 0, avg: 0, history: [] },
      textures: { current: 0, min: 999, max: 0, avg: 0, history: [] },
      shaders: { current: 0, min: 999, max: 0, avg: 0, history: [] }
    };

    // Sampling
    this.sampleRate = 60; // Samples per second
    this.historyLength = 300; // Keep 5 seconds at 60fps
    this.lastSampleTime = 0;

    // Frame timing
    this.frameStartTime = 0;
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.fpsUpdateInterval = 1000; // Update FPS every second
    this.lastFpsUpdate = 0;

    // Thresholds for alerts
    this.thresholds = {
      fps: { warning: 80, critical: 60 },
      frameTime: { warning: 12, critical: 16 }, // ms
      memory: { warning: 1500, critical: 1800 }, // MB
      gpu: { warning: 80, critical: 90 } // %
    };

    // Alerts
    this.alerts = [];
    this.maxAlerts = 50;

    // UI Elements
    this.container = null;
    this.graphCanvas = null;
    this.graphCtx = null;

    // Statistics
    this.stats = {
      totalFrames: 0,
      totalTime: 0,
      alertsGenerated: 0,
      worstFrame: { time: 0, timestamp: 0 },
      bestFrame: { time: 999, timestamp: 0 }
    };
  }

  /**
   * Initialize performance monitor
   */
  initialize() {
    // Create UI
    this.createUI();

    // Start monitoring
    this.startMonitoring();

    console.log('PerformanceMonitor: Initialized');
  }

  /**
   * Create monitoring UI
   */
  createUI() {
    // Main container
    this.container = document.createElement('div');
    this.container.id = 'performance-monitor';
    this.container.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 400px;
      background: rgba(0, 0, 0, 0.9);
      color: #00ff00;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      padding: 15px;
      border-radius: 8px;
      z-index: 10000;
      display: ${this.visible ? 'block' : 'none'};
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid #00ff00;
    `;
    header.innerHTML = `
      <span style="font-weight: bold; font-size: 14px;">⚡ Performance Monitor</span>
      <button id="perf-close" style="
        background: transparent;
        border: 1px solid #00ff00;
        color: #00ff00;
        padding: 2px 8px;
        cursor: pointer;
        border-radius: 3px;
      ">✕</button>
    `;
    this.container.appendChild(header);

    // Metrics display
    const metricsDiv = document.createElement('div');
    metricsDiv.id = 'perf-metrics';
    metricsDiv.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 10px;
    `;
    this.container.appendChild(metricsDiv);

    // Graph canvas
    this.graphCanvas = document.createElement('canvas');
    this.graphCanvas.width = 370;
    this.graphCanvas.height = 150;
    this.graphCanvas.style.cssText = `
      width: 100%;
      border: 1px solid #00ff00;
      border-radius: 4px;
      margin-bottom: 10px;
    `;
    this.container.appendChild(this.graphCanvas);
    this.graphCtx = this.graphCanvas.getContext('2d');

    // Alerts section
    const alertsDiv = document.createElement('div');
    alertsDiv.id = 'perf-alerts';
    alertsDiv.style.cssText = `
      max-height: 100px;
      overflow-y: auto;
      font-size: 10px;
      border-top: 1px solid #00ff00;
      padding-top: 10px;
    `;
    this.container.appendChild(alertsDiv);

    // Add to document
    document.body.appendChild(this.container);

    // Event listeners
    document.getElementById('perf-close').addEventListener('click', () => {
      this.hide();
    });
  }

  /**
   * Start monitoring loop
   */
  startMonitoring() {
    // Monitor memory if available
    if (performance.memory) {
      setInterval(() => {
        this.updateMemoryMetrics();
      }, 1000);
    }
  }

  /**
   * Begin frame measurement
   */
  beginFrame() {
    this.frameStartTime = performance.now();
  }

  /**
   * End frame measurement
   */
  endFrame(renderer) {
    const frameTime = performance.now() - this.frameStartTime;
    this.lastFrameTime = frameTime;

    // Update frame count
    this.frameCount++;
    this.stats.totalFrames++;
    this.stats.totalTime += frameTime;

    // Track best/worst frames
    if (frameTime < this.stats.bestFrame.time) {
      this.stats.bestFrame = { time: frameTime, timestamp: performance.now() };
    }
    if (frameTime > this.stats.worstFrame.time) {
      this.stats.worstFrame = { time: frameTime, timestamp: performance.now() };
    }

    // Update FPS
    const now = performance.now();
    if (now - this.lastFpsUpdate >= this.fpsUpdateInterval) {
      const fps = (this.frameCount / (now - this.lastFpsUpdate)) * 1000;
      this.updateMetric('fps', fps);
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    // Update frame time
    this.updateMetric('frameTime', frameTime);

    // Update renderer metrics
    if (renderer && renderer.info) {
      this.updateMetric('drawCalls', renderer.info.render.calls);
      this.updateMetric('triangles', renderer.info.render.triangles);
      this.updateMetric('textures', renderer.info.memory.textures);
      this.updateMetric('shaders', renderer.info.programs?.length || 0);
    }

    // Sample for history
    if (now - this.lastSampleTime >= 1000 / this.sampleRate) {
      this.sampleMetrics();
      this.lastSampleTime = now;
    }

    // Update UI
    if (this.visible) {
      this.updateUI();
    }

    // Check thresholds
    this.checkThresholds();
  }

  /**
   * Update specific metric
   */
  updateMetric(name, value) {
    const metric = this.metrics[name];
    if (!metric) return;

    metric.current = value;
    metric.min = Math.min(metric.min, value);
    metric.max = Math.max(metric.max, value);

    // Calculate running average
    const historyLength = metric.history.length;
    if (historyLength > 0) {
      const sum = metric.history.reduce((a, b) => a + b, 0) + value;
      metric.avg = sum / (historyLength + 1);
    } else {
      metric.avg = value;
    }
  }

  /**
   * Update memory metrics
   */
  updateMemoryMetrics() {
    if (performance.memory) {
      const memoryMB = performance.memory.usedJSHeapSize / 1024 / 1024;
      this.updateMetric('memory', memoryMB);
    }
  }

  /**
   * Sample metrics for history
   */
  sampleMetrics() {
    Object.values(this.metrics).forEach(metric => {
      metric.history.push(metric.current);

      // Keep history length limited
      if (metric.history.length > this.historyLength) {
        metric.history.shift();
      }
    });
  }

  /**
   * Check performance thresholds
   */
  checkThresholds() {
    // FPS check
    if (this.metrics.fps.current < this.thresholds.fps.critical) {
      this.addAlert('critical', `FPS dropped to ${this.metrics.fps.current.toFixed(1)}`);
    } else if (this.metrics.fps.current < this.thresholds.fps.warning) {
      this.addAlert('warning', `FPS below ${this.thresholds.fps.warning}`);
    }

    // Frame time check
    if (this.metrics.frameTime.current > this.thresholds.frameTime.critical) {
      this.addAlert('critical', `Frame time: ${this.metrics.frameTime.current.toFixed(2)}ms`);
    }

    // Memory check
    if (this.metrics.memory.current > this.thresholds.memory.critical) {
      this.addAlert('critical', `Memory usage: ${this.metrics.memory.current.toFixed(0)}MB`);
    } else if (this.metrics.memory.current > this.thresholds.memory.warning) {
      this.addAlert('warning', `Memory usage: ${this.metrics.memory.current.toFixed(0)}MB`);
    }
  }

  /**
   * Add performance alert
   */
  addAlert(level, message) {
    const alert = {
      level,
      message,
      timestamp: new Date().toLocaleTimeString(),
      count: 1
    };

    // Check if same alert exists recently
    const recent = this.alerts.find(a =>
      a.message === message &&
      performance.now() - a.time < 5000
    );

    if (recent) {
      recent.count++;
      return;
    }

    alert.time = performance.now();
    this.alerts.unshift(alert);

    // Keep alerts limited
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.pop();
    }

    this.stats.alertsGenerated++;

    console.warn(`[${level.toUpperCase()}] ${message}`);
  }

  /**
   * Update UI display
   */
  updateUI() {
    // Update metrics
    const metricsDiv = document.getElementById('perf-metrics');
    if (metricsDiv) {
      metricsDiv.innerHTML = `
        <div style="color: ${this.getColorForFPS(this.metrics.fps.current)}">
          FPS: ${this.metrics.fps.current.toFixed(1)}<br>
          <small>min: ${this.metrics.fps.min.toFixed(1)} max: ${this.metrics.fps.max.toFixed(1)}</small>
        </div>
        <div style="color: ${this.getColorForFrameTime(this.metrics.frameTime.current)}">
          Frame: ${this.metrics.frameTime.current.toFixed(2)}ms<br>
          <small>avg: ${this.metrics.frameTime.avg.toFixed(2)}ms</small>
        </div>
        <div style="color: ${this.getColorForMemory(this.metrics.memory.current)}">
          Memory: ${this.metrics.memory.current.toFixed(0)}MB<br>
          <small>max: ${this.metrics.memory.max.toFixed(0)}MB</small>
        </div>
        <div>
          Draw Calls: ${this.metrics.drawCalls.current}<br>
          <small>avg: ${this.metrics.drawCalls.avg.toFixed(0)}</small>
        </div>
        <div>
          Triangles: ${(this.metrics.triangles.current / 1000).toFixed(1)}K<br>
          <small>max: ${(this.metrics.triangles.max / 1000).toFixed(1)}K</small>
        </div>
        <div>
          Textures: ${this.metrics.textures.current}<br>
          Shaders: ${this.metrics.shaders.current}
        </div>
      `;
    }

    // Update graph
    this.drawGraph();

    // Update alerts
    this.updateAlerts();
  }

  /**
   * Draw performance graph
   */
  drawGraph() {
    const ctx = this.graphCtx;
    const width = this.graphCanvas.width;
    const height = this.graphCanvas.height;

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    // Horizontal lines
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw FPS graph
    this.drawMetricGraph(this.metrics.fps.history, '#00ff00', 0, 120);

    // Draw frame time graph
    this.drawMetricGraph(this.metrics.frameTime.history, '#ff00ff', 0, 20);

    // Draw target lines
    ctx.strokeStyle = '#ffff00';
    ctx.setLineDash([5, 5]);

    // 90 FPS line
    const targetY = height - (90 / 120) * height;
    ctx.beginPath();
    ctx.moveTo(0, targetY);
    ctx.lineTo(width, targetY);
    ctx.stroke();

    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = '#00ff00';
    ctx.font = '10px Courier New';
    ctx.fillText('FPS', 5, 15);
    ctx.fillStyle = '#ff00ff';
    ctx.fillText('Frame Time', 5, 30);
  }

  /**
   * Draw metric graph on canvas
   */
  drawMetricGraph(history, color, min, max) {
    if (history.length < 2) return;

    const ctx = this.graphCtx;
    const width = this.graphCanvas.width;
    const height = this.graphCanvas.height;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const pointSpacing = width / this.historyLength;

    history.forEach((value, index) => {
      const x = (history.length - index - 1) * pointSpacing;
      const normalizedValue = (value - min) / (max - min);
      const y = height - (normalizedValue * height);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  }

  /**
   * Update alerts display
   */
  updateAlerts() {
    const alertsDiv = document.getElementById('perf-alerts');
    if (!alertsDiv) return;

    if (this.alerts.length === 0) {
      alertsDiv.innerHTML = '<div style="color: #888;">No alerts</div>';
      return;
    }

    alertsDiv.innerHTML = this.alerts.slice(0, 5).map(alert => {
      const color = alert.level === 'critical' ? '#ff0000' : '#ffaa00';
      const countText = alert.count > 1 ? ` (×${alert.count})` : '';
      return `
        <div style="color: ${color}; margin: 2px 0;">
          [${alert.timestamp}] ${alert.message}${countText}
        </div>
      `;
    }).join('');
  }

  /**
   * Get color for FPS value
   */
  getColorForFPS(fps) {
    if (fps >= 90) return '#00ff00';
    if (fps >= 72) return '#ffaa00';
    return '#ff0000';
  }

  /**
   * Get color for frame time value
   */
  getColorForFrameTime(ms) {
    if (ms <= 11.1) return '#00ff00';
    if (ms <= 13.9) return '#ffaa00';
    return '#ff0000';
  }

  /**
   * Get color for memory value
   */
  getColorForMemory(mb) {
    if (mb <= 1000) return '#00ff00';
    if (mb <= 1500) return '#ffaa00';
    return '#ff0000';
  }

  /**
   * Show monitor
   */
  show() {
    this.visible = true;
    if (this.container) {
      this.container.style.display = 'block';
    }
  }

  /**
   * Hide monitor
   */
  hide() {
    this.visible = false;
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  /**
   * Toggle visibility
   */
  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Get performance report
   */
  getReport() {
    return {
      summary: {
        totalFrames: this.stats.totalFrames,
        averageFrameTime: this.stats.totalTime / this.stats.totalFrames,
        bestFrame: this.stats.bestFrame,
        worstFrame: this.stats.worstFrame,
        alertsGenerated: this.stats.alertsGenerated
      },
      current: {
        fps: this.metrics.fps.current,
        frameTime: this.metrics.frameTime.current,
        memory: this.metrics.memory.current,
        drawCalls: this.metrics.drawCalls.current,
        triangles: this.metrics.triangles.current
      },
      metrics: Object.fromEntries(
        Object.entries(this.metrics).map(([name, metric]) => [
          name,
          {
            current: metric.current,
            min: metric.min,
            max: metric.max,
            avg: metric.avg
          }
        ])
      )
    };
  }

  /**
   * Export metrics to CSV
   */
  exportCSV() {
    const headers = Object.keys(this.metrics);
    const rows = [headers.join(',')];

    // Get max history length
    const maxLength = Math.max(...Object.values(this.metrics).map(m => m.history.length));

    // Build rows
    for (let i = 0; i < maxLength; i++) {
      const row = headers.map(name => {
        const history = this.metrics[name].history;
        return history[i] !== undefined ? history[i].toFixed(2) : '';
      });
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Reset statistics
   */
  reset() {
    this.stats = {
      totalFrames: 0,
      totalTime: 0,
      alertsGenerated: 0,
      worstFrame: { time: 0, timestamp: 0 },
      bestFrame: { time: 999, timestamp: 0 }
    };

    this.alerts = [];

    Object.values(this.metrics).forEach(metric => {
      metric.min = 999;
      metric.max = 0;
      metric.avg = 0;
      metric.history = [];
    });

    console.log('PerformanceMonitor: Statistics reset');
  }
}

/**
 * Usage:
 *
 * const perfMon = new PerformanceMonitor();
 * perfMon.initialize();
 *
 * // In render loop
 * function render() {
 *   perfMon.beginFrame();
 *
 *   // ... rendering code ...
 *
 *   perfMon.endFrame(renderer);
 * }
 *
 * // Toggle display
 * perfMon.toggle();
 *
 * // Get report
 * const report = perfMon.getReport();
 * console.log(report);
 *
 * // Export data
 * const csv = perfMon.exportCSV();
 */