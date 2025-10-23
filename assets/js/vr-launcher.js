/**
 * VR Launcher - Core WebXR initialization and session management
 * Manages VR session lifecycle, device detection, and entry/exit
 * @version 3.2.0
 */

class VRLauncher {
    constructor() {
        this.xrSession = null;
        this.xrReferenceSpace = null;
        this.xrDevice = null;
        this.isSupported = false;
        this.isInVR = false;
        this.sessionOptions = {
            requiredFeatures: ['local-floor'],
            optionalFeatures: [
                'bounded-floor',
                'hand-tracking',
                'dom-overlay',
                'hit-test',
                'anchors'
            ]
        };

        this.callbacks = {
            onSessionStarted: null,
            onSessionEnded: null,
            onDeviceChange: null
        };

        this.performanceMode = 'balanced'; // 'performance' | 'balanced' | 'quality'
        this.init();
    }

    async init() {
        try {
            // Check WebXR support
            if ('xr' in navigator) {
                this.isSupported = await navigator.xr.isSessionSupported('immersive-vr');

                if (this.isSupported) {
                    console.info('✅ VR Launcher: WebXR immersive-vr is supported');
                    this.setupEventListeners();
                    this.detectVRDevice();
                } else {
                    console.warn('⚠️ VR Launcher: WebXR immersive-vr not supported on this device');
                }
            } else {
                console.error('❌ VR Launcher: WebXR API not available');
            }
        } catch (error) {
            console.error('VR Launcher initialization error:', error);
            this.isSupported = false;
        }
    }

    setupEventListeners() {
        // Listen for VR display connect/disconnect
        if ('xr' in navigator) {
            navigator.xr.addEventListener('devicechange', () => {
                this.detectVRDevice();
                if (this.callbacks.onDeviceChange) {
                    this.callbacks.onDeviceChange();
                }
            });
        }

        // Add VR button to page if not exists
        this.createVRButton();
    }

    async detectVRDevice() {
        try {
            // Try to detect specific VR devices
            const devices = await navigator.mediaDevices?.enumerateDevices() || [];
            const vrDevices = devices.filter(device =>
                device.label.toLowerCase().includes('oculus') ||
                device.label.toLowerCase().includes('quest') ||
                device.label.toLowerCase().includes('pico') ||
                device.label.toLowerCase().includes('vive')
            );

            if (vrDevices.length > 0) {
                this.xrDevice = vrDevices[0].label;
                console.info(`🥽 VR Device detected: ${this.xrDevice}`);

                // Set performance mode based on device
                if (this.xrDevice.includes('Quest 3')) {
                    this.performanceMode = 'quality';
                } else if (this.xrDevice.includes('Quest 2')) {
                    this.performanceMode = 'balanced';
                } else if (this.xrDevice.includes('Pico')) {
                    this.performanceMode = 'balanced';
                }
            }
        } catch (error) {
            console.warn('Could not detect specific VR device:', error);
        }
    }

    createVRButton() {
        // Check if button already exists
        if (document.getElementById('vr-enter-button')) return;

        const button = document.createElement('button');
        button.id = 'vr-enter-button';
        button.className = 'vr-button';
        button.innerHTML = '🥽 Enter VR';
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 25px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            transition: all 0.3s ease;
            z-index: 10000;
        `;

        button.addEventListener('mouseover', () => {
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
        });

        button.addEventListener('mouseout', () => {
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
        });

        button.addEventListener('click', () => this.toggleVR());

        // Only add button if VR is supported
        if (this.isSupported) {
            document.body.appendChild(button);
        }
    }

    async toggleVR() {
        if (this.isInVR) {
            await this.exitVR();
        } else {
            await this.enterVR();
        }
    }

    async enterVR() {
        if (!this.isSupported) {
            console.error('VR not supported on this device');
            this.showNotification('VR is not supported on this device', 'error');
            return false;
        }

        try {
            // Request XR session
            this.xrSession = await navigator.xr.requestSession('immersive-vr', this.sessionOptions);

            // Setup session
            await this.setupXRSession();

            this.isInVR = true;
            this.updateVRButton();

            console.info('🎮 VR session started successfully');

            // Trigger callback
            if (this.callbacks.onSessionStarted) {
                this.callbacks.onSessionStarted(this.xrSession);
            }

            // Dispatch custom event
            window.dispatchEvent(new CustomEvent('vr-session-started', {
                detail: { session: this.xrSession }
            }));

            return true;
        } catch (error) {
            console.error('Failed to enter VR:', error);
            this.showNotification('Failed to enter VR mode', 'error');
            return false;
        }
    }

    async setupXRSession() {
        // Setup reference space
        this.xrReferenceSpace = await this.xrSession.requestReferenceSpace('local-floor');

        // Configure session
        this.xrSession.addEventListener('end', () => this.onSessionEnd());

        // Setup render loop
        this.xrSession.requestAnimationFrame((time, frame) => this.onXRFrame(time, frame));

        // Apply performance settings
        this.applyPerformanceSettings();
    }

    async exitVR() {
        if (this.xrSession) {
            try {
                await this.xrSession.end();
            } catch (error) {
                console.warn('Error ending XR session:', error);
            }
        }
    }

    onSessionEnd() {
        this.xrSession = null;
        this.xrReferenceSpace = null;
        this.isInVR = false;
        this.updateVRButton();

        console.info('🛑 VR session ended');

        // Trigger callback
        if (this.callbacks.onSessionEnded) {
            this.callbacks.onSessionEnded();
        }

        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('vr-session-ended'));
    }

    onXRFrame(time, frame) {
        if (!this.xrSession) return;

        // Continue render loop
        this.xrSession.requestAnimationFrame((time, frame) => this.onXRFrame(time, frame));

        // Dispatch frame event for other modules
        window.dispatchEvent(new CustomEvent('vr-frame', {
            detail: { time, frame, session: this.xrSession }
        }));
    }

    applyPerformanceSettings() {
        // Notify other modules about performance mode
        window.dispatchEvent(new CustomEvent('vr-performance-mode', {
            detail: { mode: this.performanceMode }
        }));

        // Set frame rate based on mode
        const targetFPS = {
            'performance': 72,
            'balanced': 80,
            'quality': 90
        }[this.performanceMode];

        console.info(`⚡ Performance mode: ${this.performanceMode} (${targetFPS} FPS target)`);
    }

    updateVRButton() {
        const button = document.getElementById('vr-enter-button');
        if (button) {
            button.innerHTML = this.isInVR ? '📺 Exit VR' : '🥽 Enter VR';
            button.style.background = this.isInVR ?
                'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' :
                'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `vr-notification vr-notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'error' ? '#f44336' : '#4CAF50'};
            color: white;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 10001;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Public API methods
    on(event, callback) {
        if (event === 'sessionStarted') {
            this.callbacks.onSessionStarted = callback;
        } else if (event === 'sessionEnded') {
            this.callbacks.onSessionEnded = callback;
        } else if (event === 'deviceChange') {
            this.callbacks.onDeviceChange = callback;
        }
    }

    getSession() {
        return this.xrSession;
    }

    getReferenceSpace() {
        return this.xrReferenceSpace;
    }

    getPerformanceMode() {
        return this.performanceMode;
    }

    setPerformanceMode(mode) {
        if (['performance', 'balanced', 'quality'].includes(mode)) {
            this.performanceMode = mode;
            if (this.isInVR) {
                this.applyPerformanceSettings();
            }
        }
    }

    isVRSupported() {
        return this.isSupported;
    }

    isInVRSession() {
        return this.isInVR;
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize and export
window.VRLauncher = new VRLauncher();

// Auto-initialize VR if query parameter present
if (window.location.search.includes('vr=1')) {
    window.addEventListener('load', () => {
        setTimeout(() => {
            window.VRLauncher.enterVR();
        }, 1000);
    });
}

console.log('✅ VR Launcher loaded');