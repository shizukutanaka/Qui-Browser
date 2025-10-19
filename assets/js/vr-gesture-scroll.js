/**
 * VR Gesture-Based Page Scrolling
 * Natural hand gesture scrolling for VR browsing
 * @version 2.0.0
 */

class VRGestureScroll {
    constructor() {
        this.isEnabled = true;
        this.scrollSpeed = 2.0;
        this.smoothness = 0.15;
        this.deadzone = 0.05;

        // Scroll state
        this.isScrolling = false;
        this.scrollVelocity = { x: 0, y: 0 };
        this.targetScroll = { x: 0, y: 0 };
        this.currentScroll = { x: 0, y: 0 };

        // Hand tracking
        this.handTracking = null;
        this.lastHandPosition = { left: null, right: null };
        this.scrollHand = 'right'; // 'left' or 'right'

        // Gesture detection
        this.gestures = {
            grab: false,
            swipe: false,
            pinch: false
        };

        // Scroll modes
        this.scrollMode = 'grab'; // 'grab', 'swipe', 'point'

        // Animation
        this.animationId = null;

        // Haptic feedback
        this.hapticEnabled = true;
        this.lastHapticTime = 0;
        this.hapticInterval = 100; // ms
    }

    /**
     * Initialize gesture scroll system
     */
    init(handTracking) {
        if (!handTracking) {
            console.warn('[VR Gesture Scroll] Hand tracking not provided');
            return false;
        }

        this.handTracking = handTracking;

        // Setup gesture listeners
        this.setupGestureListeners();

        // Start update loop
        this.startUpdateLoop();

        console.log('[VR Gesture Scroll] Initialized');
        return true;
    }

    /**
     * Setup gesture event listeners
     */
    setupGestureListeners() {
        if (!this.handTracking) return;

        // Grab gesture for scrolling
        this.handTracking.on('grabStart', (e) => {
            if (e.handedness === this.scrollHand) {
                this.onGrabStart(e);
            }
        });

        this.handTracking.on('grabHold', (e) => {
            if (e.handedness === this.scrollHand) {
                this.onGrabHold(e);
            }
        });

        this.handTracking.on('grabEnd', (e) => {
            if (e.handedness === this.scrollHand) {
                this.onGrabEnd(e);
            }
        });

        // Swipe gesture
        this.handTracking.on('swipe', (e) => {
            this.onSwipe(e);
        });

        // Point gesture for precise scrolling
        this.handTracking.on('pointHold', (e) => {
            if (e.handedness === this.scrollHand) {
                this.onPointHold(e);
            }
        });
    }

    /**
     * Handle grab start
     */
    onGrabStart(event) {
        if (this.scrollMode !== 'grab') return;

        this.isScrolling = true;
        this.gestures.grab = true;

        const position = this.handTracking.getHandPosition(event.handedness);
        this.lastHandPosition[event.handedness] = position;

        // Play haptic feedback
        this.triggerHaptic(event.handedness, 50);

        // Play audio feedback
        if (window.vrSpatialAudio) {
            window.vrSpatialAudio.playClick();
        }
    }

    /**
     * Handle grab hold (continuous scrolling)
     */
    onGrabHold(event) {
        if (this.scrollMode !== 'grab' || !this.gestures.grab) return;

        const position = this.handTracking.getHandPosition(event.handedness);
        const lastPos = this.lastHandPosition[event.handedness];

        if (!lastPos || !position) return;

        // Calculate movement delta
        const deltaX = position.x - lastPos.x;
        const deltaY = position.y - lastPos.y;

        // Apply deadzone
        if (Math.abs(deltaX) < this.deadzone && Math.abs(deltaY) < this.deadzone) {
            return;
        }

        // Update scroll velocity
        this.scrollVelocity.x = -deltaX * this.scrollSpeed * 100;
        this.scrollVelocity.y = deltaY * this.scrollSpeed * 100;

        // Update last position
        this.lastHandPosition[event.handedness] = position;

        // Scroll page
        this.scrollPage(this.scrollVelocity.x, this.scrollVelocity.y);

        // Haptic feedback
        const now = Date.now();
        if (now - this.lastHapticTime > this.hapticInterval) {
            this.triggerHaptic(event.handedness, 30);
            this.lastHapticTime = now;
        }
    }

    /**
     * Handle grab end
     */
    onGrabEnd(event) {
        if (this.scrollMode !== 'grab') return;

        this.isScrolling = false;
        this.gestures.grab = false;
        this.lastHandPosition[event.handedness] = null;

        // Apply momentum
        this.applyMomentum();

        // Play haptic feedback
        this.triggerHaptic(event.handedness, 40);
    }

    /**
     * Handle swipe gesture
     */
    onSwipe(event) {
        if (this.scrollMode !== 'swipe') return;

        const direction = event.direction; // 'up', 'down', 'left', 'right'
        const strength = event.strength || 1.0;

        let scrollX = 0;
        let scrollY = 0;

        switch (direction) {
            case 'up':
                scrollY = -500 * strength;
                break;
            case 'down':
                scrollY = 500 * strength;
                break;
            case 'left':
                scrollX = -500 * strength;
                break;
            case 'right':
                scrollX = 500 * strength;
                break;
        }

        this.scrollPage(scrollX, scrollY);

        // Haptic feedback
        this.triggerHaptic(event.handedness, 60);

        // Audio feedback
        if (window.vrSpatialAudio) {
            window.vrSpatialAudio.playSwipe?.();
        }
    }

    /**
     * Handle point hold (precise scrolling)
     */
    onPointHold(event) {
        if (this.scrollMode !== 'point') return;

        const position = this.handTracking.getHandPosition(event.handedness);
        if (!position) return;

        // Map hand position to scroll velocity
        // Center = no scroll, edges = faster scroll
        const scrollX = this.mapToScrollVelocity(position.x, -0.5, 0.5);
        const scrollY = this.mapToScrollVelocity(position.y, 1.2, 2.0);

        if (Math.abs(scrollX) > 1 || Math.abs(scrollY) > 1) {
            this.scrollPage(scrollX, scrollY);

            // Subtle haptic feedback
            const now = Date.now();
            if (now - this.lastHapticTime > this.hapticInterval * 2) {
                this.triggerHaptic(event.handedness, 20);
                this.lastHapticTime = now;
            }
        }
    }

    /**
     * Map position to scroll velocity
     */
    mapToScrollVelocity(value, min, max) {
        if (value < min) {
            return (value - min) * this.scrollSpeed * 20;
        } else if (value > max) {
            return (value - max) * this.scrollSpeed * 20;
        }
        return 0;
    }

    /**
     * Scroll the page
     */
    scrollPage(deltaX, deltaY) {
        if (!this.isEnabled) return;

        // Get scroll target (iframe or window)
        const scrollTarget = this.getScrollTarget();

        if (scrollTarget === window) {
            window.scrollBy(deltaX, deltaY);
        } else if (scrollTarget) {
            scrollTarget.scrollBy(deltaX, deltaY);
        }

        // Update current scroll position
        this.currentScroll.x = this.getScrollX();
        this.currentScroll.y = this.getScrollY();
    }

    /**
     * Get scroll target element
     */
    getScrollTarget() {
        // Check for iframe
        const iframe = document.querySelector('iframe.page-frame');
        if (iframe && iframe.contentWindow) {
            return iframe.contentWindow;
        }

        return window;
    }

    /**
     * Get current scroll X position
     */
    getScrollX() {
        const target = this.getScrollTarget();
        if (target === window) {
            return window.scrollX || window.pageXOffset;
        }
        return target.scrollX || 0;
    }

    /**
     * Get current scroll Y position
     */
    getScrollY() {
        const target = this.getScrollTarget();
        if (target === window) {
            return window.scrollY || window.pageYOffset;
        }
        return target.scrollY || 0;
    }

    /**
     * Apply momentum after gesture ends
     */
    applyMomentum() {
        const momentumDuration = 30; // frames
        let frame = 0;

        const animate = () => {
            if (frame >= momentumDuration) return;

            const progress = frame / momentumDuration;
            const easing = 1 - Math.pow(progress, 2); // Quadratic ease-out

            const deltaX = this.scrollVelocity.x * easing;
            const deltaY = this.scrollVelocity.y * easing;

            this.scrollPage(deltaX, deltaY);

            frame++;
            requestAnimationFrame(animate);
        };

        animate();
    }

    /**
     * Trigger haptic feedback
     */
    triggerHaptic(handedness, intensity = 50) {
        if (!this.hapticEnabled) return;

        // Get gamepad for haptic feedback
        const gamepads = navigator.getGamepads();
        for (const gamepad of gamepads) {
            if (gamepad && gamepad.hand === handedness && gamepad.hapticActuators) {
                gamepad.hapticActuators[0].pulse(intensity / 100, 50);
                break;
            }
        }
    }

    /**
     * Start update loop
     */
    startUpdateLoop() {
        const update = () => {
            this.animationId = requestAnimationFrame(update);

            // Smooth scroll interpolation
            if (!this.isScrolling) {
                this.scrollVelocity.x *= 0.9;
                this.scrollVelocity.y *= 0.9;
            }
        };

        update();
    }

    /**
     * Set scroll mode
     */
    setScrollMode(mode) {
        if (['grab', 'swipe', 'point'].includes(mode)) {
            this.scrollMode = mode;
            console.log(`[VR Gesture Scroll] Mode set to: ${mode}`);
        }
    }

    /**
     * Set scroll hand
     */
    setScrollHand(hand) {
        if (['left', 'right'].includes(hand)) {
            this.scrollHand = hand;
            console.log(`[VR Gesture Scroll] Scroll hand set to: ${hand}`);
        }
    }

    /**
     * Set scroll speed
     */
    setScrollSpeed(speed) {
        this.scrollSpeed = Math.max(0.1, Math.min(5.0, speed));
    }

    /**
     * Enable/disable gesture scrolling
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
    }

    /**
     * Enable/disable haptic feedback
     */
    setHapticEnabled(enabled) {
        this.hapticEnabled = enabled;
    }

    /**
     * Scroll to top
     */
    scrollToTop() {
        const target = this.getScrollTarget();
        if (target === window) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            target.scrollTo?.({ top: 0, behavior: 'smooth' });
        }
    }

    /**
     * Scroll to bottom
     */
    scrollToBottom() {
        const target = this.getScrollTarget();
        if (target === window) {
            window.scrollTo({
                top: document.documentElement.scrollHeight,
                behavior: 'smooth'
            });
        } else {
            target.scrollTo?.({
                top: target.document?.documentElement?.scrollHeight || 10000,
                behavior: 'smooth'
            });
        }
    }

    /**
     * Scroll by pages
     */
    scrollByPage(pages = 1) {
        const viewportHeight = window.innerHeight;
        const scrollAmount = viewportHeight * pages;

        this.scrollPage(0, scrollAmount);
    }

    /**
     * Stop scrolling
     */
    stop() {
        this.isScrolling = false;
        this.scrollVelocity = { x: 0, y: 0 };
        this.gestures = { grab: false, swipe: false, pinch: false };
    }

    /**
     * Dispose and cleanup
     */
    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        this.stop();
        this.handTracking = null;
    }
}

// Auto-initialize when hand tracking is available
let vrGestureScroll = null;

window.addEventListener('vr-hand-tracking-ready', (event) => {
    vrGestureScroll = new VRGestureScroll();
    vrGestureScroll.init(event.detail.handTracking);
});

// Export for global access
if (typeof window !== 'undefined') {
    window.VRGestureScroll = VRGestureScroll;
    Object.defineProperty(window, 'vrGestureScroll', {
        get: () => vrGestureScroll
    });
}
