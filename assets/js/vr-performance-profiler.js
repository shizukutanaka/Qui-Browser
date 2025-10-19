/**
 * VR Performance Profiler
 * Comprehensive performance profiling and optimization for VR
 * @version 2.0.0
 */

class VRPerformanceProfiler {
    constructor() {
        // Performance metrics
        this.metrics = {
            fps: {
                current: 90,
                average: 90,
                min: 90,
                max: 90,
                history: []
            },
            frameTime: {
                current: 11.1,
                average: 11.1,
                min: 11.1,
                max: 11.1,
                history: []
            },
            cpu: {
                usage: 0,
                time: 0,
                history: []
            },
            gpu: {
                usage: 0,
                time: 0,
                memory: 0,
                history: []
            },
            memory: {
                used: 0,
                total: 0,
                limit: 0,
                heap: 0,
                history: []
            },
            network: {
                bandwidth: 0,
                latency: 0,
                type: 'unknown',
                history: []
            },
            rendering: {
                drawCalls: 0,
                triangles: 0,
                textures: 0,
                shaders: 0
            },
            thermal: {
                temperature: 0,
                throttled: false
            }
        };

        // Performance targets
        this.targets = {
            fps: {
                optimal: 90,
                acceptable: 72,
                critical: 60
            },
            frameTime: {
                optimal: 11.1,
                acceptable: 13.9,
                critical: 16.7
            },
            memory: {
                warning: 1536, // MB
                critical: 2048
            }
        };

        // Profiling state
        this.isProfiling = false;
        this.profilingData = [];
        this.startTime = 0;

        // History settings
        this.historyLength = 300; // 5 seconds at 60fps
        this.sampleInterval = 16; // ms (~60fps)
        this.lastSampleTime = 0;

        // Performance issues
        this.issues = [];
        this.recommendations = [];

        // Optimization state
        this.optimizationLevel = 'balanced'; // 'performance', 'balanced', 'quality'

        // Bottleneck detection
        this.bottlenecks = {
            cpu: false,
            gpu: false,
            memory: false,
            network: false
        };
    }

    /**
     * Initialize performance profiler
     */
    init() {
        this.setupPerformanceObserver();
        this.startMonitoring();

        console.log('[VR Performance Profiler] Initialized');
        return this;
    }

    /**
     * Setup Performance Observer API
     */
    setupPerformanceObserver() {
        if (!window.PerformanceObserver) return;

        try {
            // Observe long tasks
            const longTaskObserver = new PerformanceObserver(list => {
                for (const entry of list.getEntries()) {
                    if (entry.duration > 50) {
                        this.recordIssue('long-task', {
                            duration: entry.duration,
                            name: entry.name
                        });
                    }
                }
            });

            longTaskObserver.observe({ entryTypes: ['longtask'] });

            // Observe resource timing
            const resourceObserver = new PerformanceObserver(list => {
                for (const entry of list.getEntries()) {
                    this.analyzeResourceTiming(entry);
                }
            });

            resourceObserver.observe({ entryTypes: ['resource'] });
        } catch (error) {
            console.warn('[VR Profiler] Performance Observer not fully supported');
        }
    }

    /**
     * Start performance monitoring
     */
    startMonitoring() {
        const monitor = () => {
            const now = performance.now();

            if (now - this.lastSampleTime >= this.sampleInterval) {
                this.sampleMetrics();
                this.lastSampleTime = now;
            }

            requestAnimationFrame(monitor);
        };

        monitor();
    }

    /**
     * Sample all performance metrics
     */
    sampleMetrics() {
        this.sampleFPS();
        this.sampleMemory();
        this.sampleNetwork();
        this.sampleRendering();
        this.detectBottlenecks();
        this.generateRecommendations();
    }

    /**
     * Sample FPS and frame time
     */
    sampleFPS() {
        const now = performance.now();
        const deltaTime = now - (this.lastFrameTime || now);
        this.lastFrameTime = now;

        const fps = 1000 / deltaTime;
        const frameTime = deltaTime;

        // Update metrics
        this.updateMetric('fps', fps);
        this.updateMetric('frameTime', frameTime);

        // Check for issues
        if (fps < this.targets.fps.critical) {
            this.recordIssue('critical-fps', { fps, frameTime });
        } else if (fps < this.targets.fps.acceptable) {
            this.recordIssue('low-fps', { fps, frameTime });
        }
    }

    /**
     * Sample memory usage
     */
    sampleMemory() {
        if (!performance.memory) return;

        const used = performance.memory.usedJSHeapSize / (1024 * 1024);
        const total = performance.memory.totalJSHeapSize / (1024 * 1024);
        const limit = performance.memory.jsHeapSizeLimit / (1024 * 1024);

        this.metrics.memory.used = used;
        this.metrics.memory.total = total;
        this.metrics.memory.limit = limit;
        this.metrics.memory.heap = (used / total) * 100;

        this.addToHistory('memory', { used, total, heap: this.metrics.memory.heap });

        // Check for issues
        if (used > this.targets.memory.critical) {
            this.recordIssue('critical-memory', { used, limit });
        } else if (used > this.targets.memory.warning) {
            this.recordIssue('high-memory', { used, limit });
        }
    }

    /**
     * Sample network performance
     */
    sampleNetwork() {
        if (!navigator.connection) return;

        const connection = navigator.connection;

        this.metrics.network.bandwidth = connection.downlink || 0;
        this.metrics.network.latency = connection.rtt || 0;
        this.metrics.network.type = connection.effectiveType || 'unknown';

        this.addToHistory('network', {
            bandwidth: this.metrics.network.bandwidth,
            latency: this.metrics.network.latency
        });

        // Check for slow network
        if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
            this.recordIssue('slow-network', {
                type: connection.effectiveType,
                bandwidth: this.metrics.network.bandwidth
            });
        }
    }

    /**
     * Sample rendering metrics
     */
    sampleRendering() {
        // Would integrate with WebGL/Three.js renderer
        // For now, placeholder values
        if (window.renderer && window.renderer.info) {
            const info = window.renderer.info;

            this.metrics.rendering.drawCalls = info.render?.calls || 0;
            this.metrics.rendering.triangles = info.render?.triangles || 0;
            this.metrics.rendering.textures = info.memory?.textures || 0;

            // Check for high draw calls
            if (this.metrics.rendering.drawCalls > 1000) {
                this.recordIssue('high-draw-calls', {
                    calls: this.metrics.rendering.drawCalls
                });
            }

            // Check for high triangle count
            if (this.metrics.rendering.triangles > 1000000) {
                this.recordIssue('high-triangle-count', {
                    triangles: this.metrics.rendering.triangles
                });
            }
        }
    }

    /**
     * Detect performance bottlenecks
     */
    detectBottlenecks() {
        // CPU bottleneck: Low FPS with low draw calls
        if (this.metrics.fps.current < 72 && this.metrics.rendering.drawCalls < 500) {
            this.bottlenecks.cpu = true;
        } else {
            this.bottlenecks.cpu = false;
        }

        // GPU bottleneck: Low FPS with high draw calls/triangles
        if (this.metrics.fps.current < 72 &&
            (this.metrics.rendering.drawCalls > 800 || this.metrics.rendering.triangles > 500000)) {
            this.bottlenecks.gpu = true;
        } else {
            this.bottlenecks.gpu = false;
        }

        // Memory bottleneck
        if (this.metrics.memory.heap > 80) {
            this.bottlenecks.memory = true;
        } else {
            this.bottlenecks.memory = false;
        }

        // Network bottleneck
        if (this.metrics.network.bandwidth < 1 || this.metrics.network.latency > 200) {
            this.bottlenecks.network = true;
        } else {
            this.bottlenecks.network = false;
        }
    }

    /**
     * Generate optimization recommendations
     */
    generateRecommendations() {
        this.recommendations = [];

        // CPU recommendations
        if (this.bottlenecks.cpu) {
            this.recommendations.push({
                type: 'cpu',
                priority: 'high',
                message: 'CPU負荷が高いです。JavaScriptの最適化を推奨します。',
                actions: ['reduce-logic-complexity', 'use-web-workers']
            });
        }

        // GPU recommendations
        if (this.bottlenecks.gpu) {
            this.recommendations.push({
                type: 'gpu',
                priority: 'high',
                message: 'GPU負荷が高いです。描画の最適化を推奨します。',
                actions: ['reduce-draw-calls', 'reduce-triangles', 'optimize-shaders']
            });
        }

        // Memory recommendations
        if (this.bottlenecks.memory) {
            this.recommendations.push({
                type: 'memory',
                priority: 'high',
                message: 'メモリ使用量が高いです。リソースの解放を推奨します。',
                actions: ['clear-cache', 'dispose-unused-textures', 'reduce-texture-size']
            });
        }

        // Network recommendations
        if (this.bottlenecks.network) {
            this.recommendations.push({
                type: 'network',
                priority: 'medium',
                message: 'ネットワークが遅いです。圧縮と最適化を推奨します。',
                actions: ['enable-compression', 'reduce-asset-size', 'use-cdn']
            });
        }

        // General recommendations based on metrics
        if (this.metrics.fps.average < this.targets.fps.acceptable) {
            this.recommendations.push({
                type: 'performance',
                priority: 'high',
                message: '平均FPSが低いです。全体的な最適化が必要です。',
                actions: ['reduce-quality', 'enable-foveated-rendering', 'reduce-resolution']
            });
        }
    }

    /**
     * Start profiling session
     */
    startProfiling() {
        if (this.isProfiling) {
            console.warn('[VR Profiler] Already profiling');
            return;
        }

        this.isProfiling = true;
        this.startTime = performance.now();
        this.profilingData = [];

        console.log('[VR Profiler] Profiling started');
    }

    /**
     * Stop profiling session
     * @returns {Object} Profiling report
     */
    stopProfiling() {
        if (!this.isProfiling) {
            console.warn('[VR Profiler] Not profiling');
            return null;
        }

        this.isProfiling = false;
        const duration = performance.now() - this.startTime;

        const report = this.generateProfilingReport(duration);

        console.log('[VR Profiler] Profiling stopped');
        console.log('Report:', report);

        return report;
    }

    /**
     * Generate profiling report
     * @param {number} duration - Profiling duration
     * @returns {Object} Report
     */
    generateProfilingReport(duration) {
        return {
            duration,
            metrics: {
                fps: {
                    average: this.calculateAverage(this.metrics.fps.history),
                    min: this.metrics.fps.min,
                    max: this.metrics.fps.max
                },
                frameTime: {
                    average: this.calculateAverage(this.metrics.frameTime.history),
                    min: this.metrics.frameTime.min,
                    max: this.metrics.frameTime.max
                },
                memory: {
                    average: this.calculateAverage(this.metrics.memory.history.map(h => h.used)),
                    peak: Math.max(...this.metrics.memory.history.map(h => h.used))
                }
            },
            bottlenecks: { ...this.bottlenecks },
            issues: [...this.issues],
            recommendations: [...this.recommendations],
            timestamp: Date.now()
        };
    }

    /**
     * Update metric
     * @param {string} metricName - Metric name
     * @param {number} value - New value
     */
    updateMetric(metricName, value) {
        const metric = this.metrics[metricName];
        if (!metric) return;

        metric.current = value;
        metric.min = Math.min(metric.min, value);
        metric.max = Math.max(metric.max, value);

        this.addToHistory(metricName, value);

        // Calculate average
        if (metric.history.length > 0) {
            metric.average = this.calculateAverage(metric.history);
        }
    }

    /**
     * Add value to history
     * @param {string} metricName - Metric name
     * @param {any} value - Value
     */
    addToHistory(metricName, value) {
        const metric = this.metrics[metricName];
        if (!metric || !metric.history) return;

        metric.history.push(value);

        if (metric.history.length > this.historyLength) {
            metric.history.shift();
        }
    }

    /**
     * Calculate average
     * @param {Array} values - Values
     * @returns {number} Average
     */
    calculateAverage(values) {
        if (values.length === 0) return 0;
        const sum = values.reduce((a, b) => a + b, 0);
        return sum / values.length;
    }

    /**
     * Record performance issue
     * @param {string} type - Issue type
     * @param {Object} data - Issue data
     */
    recordIssue(type, data) {
        const issue = {
            type,
            data,
            timestamp: Date.now()
        };

        this.issues.push(issue);

        // Limit issues array
        if (this.issues.length > 100) {
            this.issues.shift();
        }

        console.warn(`[VR Profiler] Issue detected: ${type}`, data);
    }

    /**
     * Analyze resource timing
     * @param {PerformanceEntry} entry - Performance entry
     */
    analyzeResourceTiming(entry) {
        const duration = entry.duration;
        const size = entry.transferSize || 0;

        // Check for slow resources
        if (duration > 1000) {
            this.recordIssue('slow-resource', {
                name: entry.name,
                duration,
                size
            });
        }

        // Check for large resources
        if (size > 5 * 1024 * 1024) { // 5MB
            this.recordIssue('large-resource', {
                name: entry.name,
                size: size / (1024 * 1024) // Convert to MB
            });
        }
    }

    /**
     * Get current metrics snapshot
     * @returns {Object} Current metrics
     */
    getMetrics() {
        return {
            fps: this.metrics.fps.current,
            frameTime: this.metrics.frameTime.current,
            memory: {
                used: this.metrics.memory.used,
                heap: this.metrics.memory.heap
            },
            rendering: { ...this.metrics.rendering },
            network: { ...this.metrics.network }
        };
    }

    /**
     * Get recommendations
     * @returns {Array} Recommendations
     */
    getRecommendations() {
        return [...this.recommendations];
    }

    /**
     * Get bottlenecks
     * @returns {Object} Bottlenecks
     */
    getBottlenecks() {
        return { ...this.bottlenecks };
    }

    /**
     * Export profiling data
     * @returns {string} JSON data
     */
    exportData() {
        const data = {
            metrics: this.metrics,
            issues: this.issues,
            recommendations: this.recommendations,
            bottlenecks: this.bottlenecks,
            timestamp: Date.now()
        };

        return JSON.stringify(data, null, 2);
    }

    /**
     * Clear profiling data
     */
    clearData() {
        this.issues = [];
        this.recommendations = [];

        Object.values(this.metrics).forEach(metric => {
            if (metric.history) {
                metric.history = [];
            }
        });

        console.log('[VR Profiler] Data cleared');
    }

    /**
     * Dispose and cleanup
     */
    dispose() {
        this.stopProfiling();
        this.clearData();
    }
}

// Export for global access
if (typeof window !== 'undefined') {
    window.VRPerformanceProfiler = VRPerformanceProfiler;
}
