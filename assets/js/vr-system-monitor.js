/**
 * VR System Monitor - Unified system monitoring and statistics
 * Consolidates: vr-battery-monitor.js, vr-network-monitor.js, vr-usage-statistics.js
 * @version 3.2.0
 */

class VRSystemMonitor {
    constructor() {
        this.initialized = false;

        // Battery monitoring
        this.battery = null;
        this.batteryLevel = 1.0;
        this.batteryCharging = false;
        this.batteryCallbacks = new Set();

        // Network monitoring
        this.networkStatus = 'online';
        this.connectionType = 'unknown';
        this.effectiveType = 'unknown';
        this.downlink = 0;
        this.rtt = 0;
        this.saveData = false;
        this.networkCallbacks = new Set();

        // Usage statistics
        this.stats = {
            sessionStart: Date.now(),
            totalTime: 0,
            vrTime: 0,
            pagesVisited: 0,
            gesturesUsed: 0,
            bookmarksAdded: 0,
            tabsOpened: 0,
            voiceCommands: 0
        };

        // Performance monitoring
        this.performanceMetrics = {
            fps: 0,
            frameTime: 0,
            memory: {
                used: 0,
                total: 0,
                limit: 0
            },
            renderTime: 0,
            cpuUsage: 0
        };

        // Monitoring intervals
        this.batteryCheckInterval = null;
        this.networkCheckInterval = null;
        this.statsInterval = null;

        this.init();
    }

    async init() {
        await this.setupBatteryMonitoring();
        this.setupNetworkMonitoring();
        this.setupUsageTracking();
        this.startMonitoring();

        this.initialized = true;
        console.info('✅ VR System Monitor initialized');

        window.dispatchEvent(new CustomEvent('vr-monitor-ready'));
    }

    // ========== Battery Monitoring ==========

    async setupBatteryMonitoring() {
        if ('getBattery' in navigator) {
            try {
                this.battery = await navigator.getBattery();

                // Initial values
                this.batteryLevel = this.battery.level;
                this.batteryCharging = this.battery.charging;

                // Event listeners
                this.battery.addEventListener('levelchange', () => {
                    this.batteryLevel = this.battery.level;
                    this.notifyBatteryChange();
                });

                this.battery.addEventListener('chargingchange', () => {
                    this.batteryCharging = this.battery.charging;
                    this.notifyBatteryChange();
                });

                console.info('✅ Battery monitoring enabled');
            } catch (error) {
                console.warn('Battery API not available:', error);
            }
        } else {
            console.warn('Battery API not supported');
        }
    }

    getBatteryLevel() {
        return this.batteryLevel;
    }

    getBatteryPercentage() {
        return Math.round(this.batteryLevel * 100);
    }

    isBatteryCharging() {
        return this.batteryCharging;
    }

    getBatteryStatus() {
        const percentage = this.getBatteryPercentage();
        let status = 'good';

        if (percentage < 20) {
            status = 'critical';
        } else if (percentage < 40) {
            status = 'low';
        } else if (percentage < 60) {
            status = 'medium';
        }

        return {
            level: this.batteryLevel,
            percentage: percentage,
            charging: this.batteryCharging,
            status: status,
            timeRemaining: this.battery ? this.battery.dischargingTime : Infinity
        };
    }

    onBatteryChange(callback) {
        this.batteryCallbacks.add(callback);
        return () => this.batteryCallbacks.delete(callback);
    }

    notifyBatteryChange() {
        const status = this.getBatteryStatus();

        this.batteryCallbacks.forEach(callback => {
            try {
                callback(status);
            } catch (error) {
                console.error('Battery callback error:', error);
            }
        });

        // Show warning at critical level
        if (status.percentage < 10 && !this.batteryCharging) {
            this.showBatteryWarning(status.percentage);
        }
    }

    showBatteryWarning(percentage) {
        console.warn(`⚠️ Battery critically low: ${percentage}%`);

        window.dispatchEvent(new CustomEvent('battery-warning', {
            detail: { percentage }
        }));
    }

    // ========== Network Monitoring ==========

    setupNetworkMonitoring() {
        // Online/offline events
        window.addEventListener('online', () => {
            this.networkStatus = 'online';
            this.notifyNetworkChange();
        });

        window.addEventListener('offline', () => {
            this.networkStatus = 'offline';
            this.notifyNetworkChange();
        });

        // Network Information API
        if ('connection' in navigator || 'mozConnection' in navigator || 'webkitConnection' in navigator) {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

            this.updateNetworkInfo(connection);

            connection.addEventListener('change', () => {
                this.updateNetworkInfo(connection);
                this.notifyNetworkChange();
            });

            console.info('✅ Network monitoring enabled');
        } else {
            console.warn('Network Information API not supported');
        }

        // Initial status
        this.networkStatus = navigator.onLine ? 'online' : 'offline';
    }

    updateNetworkInfo(connection) {
        this.connectionType = connection.type || 'unknown';
        this.effectiveType = connection.effectiveType || 'unknown';
        this.downlink = connection.downlink || 0;
        this.rtt = connection.rtt || 0;
        this.saveData = connection.saveData || false;
    }

    getNetworkStatus() {
        return {
            online: this.networkStatus === 'online',
            type: this.connectionType,
            effectiveType: this.effectiveType,
            downlink: this.downlink,
            rtt: this.rtt,
            saveData: this.saveData,
            quality: this.getNetworkQuality()
        };
    }

    getNetworkQuality() {
        if (this.networkStatus === 'offline') return 'offline';

        switch (this.effectiveType) {
            case '4g':
                return 'excellent';
            case '3g':
                return 'good';
            case '2g':
                return 'poor';
            case 'slow-2g':
                return 'very-poor';
            default:
                if (this.downlink > 5) return 'excellent';
                if (this.downlink > 1.5) return 'good';
                if (this.downlink > 0.5) return 'fair';
                return 'poor';
        }
    }

    isHighQualityNetwork() {
        const quality = this.getNetworkQuality();
        return quality === 'excellent' || quality === 'good';
    }

    onNetworkChange(callback) {
        this.networkCallbacks.add(callback);
        return () => this.networkCallbacks.delete(callback);
    }

    notifyNetworkChange() {
        const status = this.getNetworkStatus();

        this.networkCallbacks.forEach(callback => {
            try {
                callback(status);
            } catch (error) {
                console.error('Network callback error:', error);
            }
        });
    }

    // ========== Usage Statistics ==========

    setupUsageTracking() {
        // Load previous stats
        this.loadStats();

        // Track page visibility
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.saveStats();
            }
        });

        // Track VR sessions
        window.addEventListener('vr-session-started', () => {
            this.stats.vrTime = Date.now();
        });

        window.addEventListener('vr-session-ended', () => {
            if (this.stats.vrTime > 0) {
                const duration = Date.now() - this.stats.vrTime;
                this.stats.totalTime += duration;
                this.stats.vrTime = 0;
            }
        });

        // Track gestures
        if (window.VRInputSystem) {
            window.VRInputSystem.on('gesture-*', () => {
                this.trackGesture();
            });
        }

        console.info('✅ Usage tracking enabled');
    }

    trackPageVisit(url) {
        this.stats.pagesVisited++;
        this.saveStats();
    }

    trackGesture(gestureName) {
        this.stats.gesturesUsed++;
        this.saveStats();
    }

    trackBookmark() {
        this.stats.bookmarksAdded++;
        this.saveStats();
    }

    trackTab() {
        this.stats.tabsOpened++;
        this.saveStats();
    }

    trackVoiceCommand() {
        this.stats.voiceCommands++;
        this.saveStats();
    }

    getUsageStats() {
        const now = Date.now();
        const sessionDuration = now - this.stats.sessionStart;

        return {
            sessionDuration: sessionDuration,
            sessionDurationFormatted: this.formatDuration(sessionDuration),
            totalVRTime: this.stats.totalTime,
            totalVRTimeFormatted: this.formatDuration(this.stats.totalTime),
            pagesVisited: this.stats.pagesVisited,
            gesturesUsed: this.stats.gesturesUsed,
            bookmarksAdded: this.stats.bookmarksAdded,
            tabsOpened: this.stats.tabsOpened,
            voiceCommands: this.stats.voiceCommands
        };
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    saveStats() {
        try {
            localStorage.setItem('vr-usage-stats', JSON.stringify(this.stats));
        } catch (error) {
            console.error('Failed to save stats:', error);
        }
    }

    loadStats() {
        try {
            const saved = localStorage.getItem('vr-usage-stats');
            if (saved) {
                const data = JSON.parse(saved);
                this.stats = { ...this.stats, ...data };
                this.stats.sessionStart = Date.now(); // Reset session start
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    resetStats() {
        this.stats = {
            sessionStart: Date.now(),
            totalTime: 0,
            vrTime: 0,
            pagesVisited: 0,
            gesturesUsed: 0,
            bookmarksAdded: 0,
            tabsOpened: 0,
            voiceCommands: 0
        };
        this.saveStats();
    }

    // ========== Performance Monitoring ==========

    updatePerformanceMetrics(metrics) {
        this.performanceMetrics = { ...this.performanceMetrics, ...metrics };
    }

    getPerformanceMetrics() {
        // Update memory info
        if (performance.memory) {
            this.performanceMetrics.memory = {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }

        return {
            ...this.performanceMetrics,
            memoryUsagePercentage: this.getMemoryUsagePercentage()
        };
    }

    getMemoryUsagePercentage() {
        if (performance.memory) {
            return (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100;
        }
        return 0;
    }

    // ========== System Health ==========

    getSystemHealth() {
        const battery = this.getBatteryStatus();
        const network = this.getNetworkStatus();
        const performance = this.getPerformanceMetrics();

        let health = 'good';
        const issues = [];

        // Check battery
        if (battery.percentage < 20 && !battery.charging) {
            health = 'warning';
            issues.push(`Low battery: ${battery.percentage}%`);
        }

        // Check network
        if (network.quality === 'poor' || network.quality === 'very-poor') {
            health = 'warning';
            issues.push(`Poor network: ${network.effectiveType}`);
        }

        // Check memory
        const memoryUsage = this.getMemoryUsagePercentage();
        if (memoryUsage > 90) {
            health = 'critical';
            issues.push(`High memory usage: ${memoryUsage.toFixed(0)}%`);
        } else if (memoryUsage > 75) {
            if (health !== 'critical') health = 'warning';
            issues.push(`Memory usage: ${memoryUsage.toFixed(0)}%`);
        }

        // Check FPS
        if (performance.fps > 0 && performance.fps < 60) {
            if (health !== 'critical') health = 'warning';
            issues.push(`Low FPS: ${performance.fps}`);
        }

        return {
            status: health,
            issues: issues,
            battery: battery,
            network: network,
            performance: performance
        };
    }

    // ========== Monitoring Control ==========

    startMonitoring() {
        // Battery check (every 30 seconds)
        if (this.battery) {
            this.batteryCheckInterval = setInterval(() => {
                this.notifyBatteryChange();
            }, 30000);
        }

        // Network check (every 10 seconds)
        this.networkCheckInterval = setInterval(() => {
            this.notifyNetworkChange();
        }, 10000);

        // Stats save (every 60 seconds)
        this.statsInterval = setInterval(() => {
            this.saveStats();
        }, 60000);

        console.info('Monitoring started');
    }

    stopMonitoring() {
        if (this.batteryCheckInterval) {
            clearInterval(this.batteryCheckInterval);
            this.batteryCheckInterval = null;
        }

        if (this.networkCheckInterval) {
            clearInterval(this.networkCheckInterval);
            this.networkCheckInterval = null;
        }

        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }

        console.info('Monitoring stopped');
    }

    // ========== Cleanup ==========

    cleanup() {
        this.stopMonitoring();
        this.saveStats();

        this.batteryCallbacks.clear();
        this.networkCallbacks.clear();

        console.info('VR System Monitor cleaned up');
    }
}

// Initialize and export
window.VRSystemMonitor = new VRSystemMonitor();

console.log('✅ VR System Monitor loaded');