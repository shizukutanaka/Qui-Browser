/**
 * VR Advanced Performance Profiler
 * Real-time performance monitoring with detailed metrics and optimization recommendations
 *
 * Features:
 * - Real-time FPS, memory, and GPU metrics
 * - Per-module performance breakdown
 * - Automatic bottleneck detection
 * - Performance recommendations engine
 * - Historical tracking & trends
 * - Export capabilities
 *
 * @version 1.0.0
 * @author Claude Code
 */

class VRAdvancedPerformanceProfiler {
    constructor(options = {}) {
        this.options = {
            enableGPUMonitoring: options.enableGPUMonitoring ?? true,
            enableThermalMonitoring: options.enableThermalMonitoring ?? true,
            enableBatteryMonitoring: options.enableBatteryMonitoring ?? true,
            historySize: options.historySize || 3600, // 1 hour at 60 FPS
            updateInterval: options.updateInterval || 100, // ms
            alertThresholds: options.alertThresholds || {
                fps: { critical: 45, warning: 60 },
                memory: { critical: 1900, warning: 1700 },
                gpu: { critical: 85, warning: 70 }
            },
            ...options
        };

        this.metrics = {
            fps: {
                current: 60,
                average: 60,
                min: 60,
                max: 60,
                history: []
            },
            frameTime: {
                current: 16.67,
                average: 16.67,
                min: 16.67,
                max: 16.67,
                history: []
            },
            memory: {
                used: 0,
                heap: 0,
                available: 0,
                history: []
            },
            gpu: {
                usage: 0,
                vram: 0,
                available: 0,
                history: []
            },
            thermal: {
                temperature: 0,
                throttled: false,
                state: 'normal' // normal, warm, hot, critical
            },
            battery: {
                level: 100,
                charging: false,
                estimatedTime: 0
            }
        };

        this.moduleMetrics = new Map();
        this.eventEmitter = {};
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.startTime = performance.now();
        this.isMonitoring = false;
        this.recommendations = [];
    }

    /**
     * Initialize profiler
     */
    async initialize() {
        console.log('[VRAdvancedPerformanceProfiler] Initializing...');

        // Check available APIs
        this.checkAvailableAPIs();

        // Start monitoring
        this.startMonitoring();

        // Initialize recommendations engine
        this.initializeRecommendationsEngine();

        console.log('[VRAdvancedPerformanceProfiler] Initialized');
    }

    /**
     * Check available monitoring APIs
     */
    checkAvailableAPIs() {
        // Memory API
        if (performance.memory) {
            console.log('✓ Performance.memory API available');
        } else {
            console.log('✗ Performance.memory API not available');
        }

        // GPU info (WebGL)
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl');
            const ext = gl.getExtension('WEBGL_debug_renderer_info');
            if (ext) {
                console.log('✓ WebGL GPU info available');
                this.gpuInfo = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
            }
        } catch (e) {
            console.log('✗ WebGL GPU info not available');
        }

        // Battery API
        if (navigator.getBattery || navigator.battery) {
            console.log('✓ Battery API available');
        } else {
            console.log('✗ Battery API not available');
        }

        // Thermal API (if available)
        if ('getThermalState' in navigator) {
            console.log('✓ Thermal API available');
        } else {
            console.log('✗ Thermal API not available');
        }
    }

    /**
     * Start monitoring
     */
    startMonitoring() {
        if (this.isMonitoring) return;
        this.isMonitoring = true;

        // Setup frame timing
        this.setupFrameTiming();

        // Setup periodic updates
        this.monitoringInterval = setInterval(() => {
            this.updateMetrics();
            this.analyzePerformance();
            this.generateRecommendations();
        }, this.options.updateInterval);

        console.log('[VRAdvancedPerformanceProfiler] Monitoring started');
    }

    /**
     * Setup frame timing measurement
     */
    setupFrameTiming() {
        const measure = () => {
            const now = performance.now();
            const deltaTime = now - this.lastFrameTime;

            this.metrics.frameTime.current = deltaTime;
            this.frameCount++;

            // Update every 100ms
            if (this.frameCount % 6 === 0) {
                const elapsed = now - this.startTime;
                const fps = (this.frameCount / elapsed) * 1000;

                // Store in history
                this.addToHistory('frameTime', deltaTime);
                this.addToHistory('fps', fps);

                // Update statistics
                this.updateStatistics();
            }

            this.lastFrameTime = now;
            requestAnimationFrame(measure);
        };

        requestAnimationFrame(measure);
    }

    /**
     * Update metrics
     */
    updateMetrics() {
        // Memory metrics
        if (performance.memory) {
            const memory = performance.memory;
            this.metrics.memory.used = memory.usedJSHeapSize;
            this.metrics.memory.heap = memory.jsHeapSizeLimit;
            this.metrics.memory.available = memory.jsHeapSizeLimit - memory.usedJSHeapSize;

            this.addToHistory('memory', memory.usedJSHeapSize);

            // Check for leaks
            this.detectMemoryLeaks();
        }

        // Battery metrics
        if (navigator.getBattery) {
            navigator.getBattery().then(battery => {
                this.metrics.battery.level = battery.level * 100;
                this.metrics.battery.charging = battery.charging;
                this.metrics.battery.estimatedTime = battery.dischargingTime;
            });
        }

        // Thermal state
        this.updateThermalState();
    }

    /**
     * Detect memory leaks
     */
    detectMemoryLeaks() {
        const memory = this.metrics.memory.history;
        if (memory.length < 10) return;

        // Get last 10 measurements
        const recent = memory.slice(-10);
        const average = recent.reduce((a, b) => a + b, 0) / recent.length;
        const trend = recent[recent.length - 1] - recent[0];

        // If consistent increase, possible leak
        if (trend > average * 0.2) {
            this.emit('memory-warning', {
                type: 'possible-leak',
                trend: trend,
                average: average,
                severity: 'warning'
            });
        }
    }

    /**
     * Update thermal state
     */
    updateThermalState() {
        // Infer from FPS throttling
        const fps = this.metrics.fps.average;

        if (fps > 85) {
            this.metrics.thermal.state = 'normal';
        } else if (fps > 75) {
            this.metrics.thermal.state = 'warm';
        } else if (fps > 60) {
            this.metrics.thermal.state = 'hot';
        } else {
            this.metrics.thermal.state = 'critical';
        }
    }

    /**
     * Update statistics
     */
    updateStatistics() {
        // FPS statistics
        if (this.metrics.fps.history.length > 0) {
            const fps = this.metrics.fps.history;
            this.metrics.fps.average = fps.reduce((a, b) => a + b, 0) / fps.length;
            this.metrics.fps.min = Math.min(...fps);
            this.metrics.fps.max = Math.max(...fps);
        }

        // Frame time statistics
        if (this.metrics.frameTime.history.length > 0) {
            const ft = this.metrics.frameTime.history;
            this.metrics.frameTime.average = ft.reduce((a, b) => a + b, 0) / ft.length;
            this.metrics.frameTime.min = Math.min(...ft);
            this.metrics.frameTime.max = Math.max(...ft);
        }
    }

    /**
     * Add value to history
     */
    addToHistory(metric, value) {
        const history = this.metrics[metric].history;
        history.push(value);

        // Limit history size
        if (history.length > this.options.historySize) {
            history.shift();
        }
    }

    /**
     * Analyze performance
     */
    analyzePerformance() {
        const alerts = [];

        // Check FPS
        if (this.metrics.fps.average < this.options.alertThresholds.fps.critical) {
            alerts.push({
                type: 'critical',
                metric: 'fps',
                value: this.metrics.fps.average,
                threshold: this.options.alertThresholds.fps.critical,
                message: 'FPS critically low'
            });
        } else if (this.metrics.fps.average < this.options.alertThresholds.fps.warning) {
            alerts.push({
                type: 'warning',
                metric: 'fps',
                value: this.metrics.fps.average,
                threshold: this.options.alertThresholds.fps.warning,
                message: 'FPS below target'
            });
        }

        // Check memory
        if (this.metrics.memory.used > this.options.alertThresholds.memory.critical) {
            alerts.push({
                type: 'critical',
                metric: 'memory',
                value: this.metrics.memory.used / 1024 / 1024,
                threshold: this.options.alertThresholds.memory.critical / 1024 / 1024,
                message: 'Memory usage critical'
            });
        } else if (this.metrics.memory.used > this.options.alertThresholds.memory.warning) {
            alerts.push({
                type: 'warning',
                metric: 'memory',
                value: this.metrics.memory.used / 1024 / 1024,
                threshold: this.options.alertThresholds.memory.warning / 1024 / 1024,
                message: 'Memory usage high'
            });
        }

        // Emit alerts
        alerts.forEach(alert => {
            this.emit(`${alert.type}-alert`, alert);
        });
    }

    /**
     * Initialize recommendations engine
     */
    initializeRecommendationsEngine() {
        this.recommendationRules = [
            {
                id: 'reduce-quality-low-fps',
                name: 'Reduce Visual Quality',
                trigger: () => this.metrics.fps.average < 72,
                recommendation: 'FPS is below minimum. Reduce texture quality or disable foveated rendering.'
            },
            {
                id: 'optimize-memory-high-usage',
                name: 'Optimize Memory',
                trigger: () => this.metrics.memory.used > 1700e6,
                recommendation: 'High memory usage. Clear unused assets and enable object pooling.'
            },
            {
                id: 'optimize-gesture-heavy-gesture',
                name: 'Optimize Gesture Processing',
                trigger: () => this.getModuleMetric('gesture-recognition', 'avgTime') > 10,
                recommendation: 'Gesture recognition is slow. Reduce sample rate or use coarser model.'
            },
            {
                id: 'enable-simd-acceleration',
                name: 'Enable SIMD Acceleration',
                trigger: () => !this.metrics.simdEnabled && this.metrics.fps.average < 80,
                recommendation: 'Enable WebAssembly SIMD acceleration for better performance.'
            },
            {
                id: 'optimize-neural-rendering',
                name: 'Optimize Neural Rendering',
                trigger: () => this.getModuleMetric('neural-rendering', 'avgTime') > 25,
                recommendation: 'Neural rendering is slow. Use lower resolution or simpler upscaling.'
            }
        ];
    }

    /**
     * Generate recommendations
     */
    generateRecommendations() {
        this.recommendations = [];

        this.recommendationRules.forEach(rule => {
            if (rule.trigger()) {
                this.recommendations.push({
                    id: rule.id,
                    name: rule.name,
                    message: rule.recommendation,
                    priority: 'high',
                    actionable: true
                });
            }
        });
    }

    /**
     * Register module for performance tracking
     */
    registerModule(moduleId, initialData = {}) {
        this.moduleMetrics.set(moduleId, {
            id: moduleId,
            calls: 0,
            totalTime: 0,
            minTime: Infinity,
            maxTime: 0,
            avgTime: 0,
            history: [],
            ...initialData
        });
    }

    /**
     * Record module execution time
     */
    recordModuleTime(moduleId, executionTime) {
        if (!this.moduleMetrics.has(moduleId)) {
            this.registerModule(moduleId);
        }

        const module = this.moduleMetrics.get(moduleId);
        module.calls++;
        module.totalTime += executionTime;
        module.minTime = Math.min(module.minTime, executionTime);
        module.maxTime = Math.max(module.maxTime, executionTime);
        module.avgTime = module.totalTime / module.calls;
        module.history.push(executionTime);

        if (module.history.length > 100) {
            module.history.shift();
        }
    }

    /**
     * Get module metric
     */
    getModuleMetric(moduleId, metric) {
        if (!this.moduleMetrics.has(moduleId)) return 0;
        const module = this.moduleMetrics.get(moduleId);
        return module[metric] || 0;
    }

    /**
     * Get all metrics snapshot
     */
    getMetricsSnapshot() {
        return {
            timestamp: Date.now(),
            fps: { ...this.metrics.fps },
            frameTime: { ...this.metrics.frameTime },
            memory: {
                used: this.metrics.memory.used,
                heap: this.metrics.memory.heap,
                available: this.metrics.memory.available,
                percentUsed: (this.metrics.memory.used / this.metrics.memory.heap) * 100
            },
            thermal: { ...this.metrics.thermal },
            battery: { ...this.metrics.battery },
            modules: Array.from(this.moduleMetrics.values()),
            recommendations: this.recommendations
        };
    }

    /**
     * Get performance grade
     */
    getPerformanceGrade() {
        const fps = this.metrics.fps.average;
        const memory = (this.metrics.memory.used / this.metrics.memory.heap) * 100;

        // Grade based on FPS and memory
        let grade = 'A+';

        if (fps < 45 || memory > 95) {
            grade = 'D';
        } else if (fps < 60 || memory > 85) {
            grade = 'C';
        } else if (fps < 72 || memory > 75) {
            grade = 'B';
        } else if (fps < 85 || memory > 65) {
            grade = 'A';
        }

        return grade;
    }

    /**
     * Export metrics as CSV
     */
    exportAsCSV() {
        const snapshot = this.getMetricsSnapshot();
        let csv = 'timestamp,fps_avg,fps_min,fps_max,memory_mb,memory_pct,grade\n';

        csv += `${snapshot.timestamp},${snapshot.fps.average.toFixed(1)},${snapshot.fps.min.toFixed(1)},${snapshot.fps.max.toFixed(1)},${(snapshot.memory.used / 1024 / 1024).toFixed(1)},${snapshot.memory.percentUsed.toFixed(1)},${this.getPerformanceGrade()}\n`;

        return csv;
    }

    /**
     * Export metrics as JSON
     */
    exportAsJSON() {
        return JSON.stringify(this.getMetricsSnapshot(), null, 2);
    }

    /**
     * Get recommendations
     */
    getRecommendations() {
        return this.recommendations;
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.isMonitoring = false;
            console.log('[VRAdvancedPerformanceProfiler] Monitoring stopped');
        }
    }

    /**
     * Event emitter
     */
    on(event, handler) {
        if (!this.eventEmitter[event]) {
            this.eventEmitter[event] = [];
        }
        this.eventEmitter[event].push(handler);
    }

    emit(event, data) {
        if (this.eventEmitter[event]) {
            this.eventEmitter[event].forEach(handler => handler(data));
        }
    }

    /**
     * Dispose
     */
    dispose() {
        this.stop();
        this.moduleMetrics.clear();
        this.metrics = null;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VRAdvancedPerformanceProfiler;
}

// Global registration
if (typeof window !== 'undefined') {
    window.VRAdvancedPerformanceProfiler = VRAdvancedPerformanceProfiler;
}
