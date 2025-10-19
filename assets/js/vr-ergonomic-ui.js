/**
 * VR Ergonomic UI Positioning System
 * Optimal UI placement for comfort and accessibility in VR
 * @version 2.0.0
 */

class VRErgonom icUI {
    constructor() {
        // Comfortable viewing zones (based on research)
        this.viewingZones = {
            primary: {
                horizontal: { min: -30, max: 30 }, // degrees from center
                vertical: { min: -15, max: 15 },
                distance: { min: 0.5, max: 3.0 } // meters
            },
            secondary: {
                horizontal: { min: -45, max: 45 },
                vertical: { min: -30, max: 20 },
                distance: { min: 0.5, max: 5.0 }
            },
            peripheral: {
                horizontal: { min: -60, max: 60 },
                vertical: { min: -45, max: 30 },
                distance: { min: 0.5, max: 10.0 }
            }
        };

        // Ergonomic constants
        this.OPTIMAL_VIEW_DISTANCE = 2.0; // meters
        this.COMFORTABLE_HEIGHT = 1.6; // meters (eye level for average person)
        this.MIN_BUTTON_SIZE = 0.08; // meters (minimum interactive element)
        this.RECOMMENDED_BUTTON_SIZE = 0.12; // meters
        this.MIN_SPACING = 0.02; // meters between elements

        // UI anchoring modes
        this.anchorModes = {
            WORLD: 'world', // Fixed in world space
            HEAD: 'head', // Follows head (use sparingly)
            SMOOTH_FOLLOW: 'smooth-follow', // Smoothly follows head
            LAZY_FOLLOW: 'lazy-follow' // Follows only after threshold
        };

        // Current anchor mode
        this.defaultAnchorMode = this.anchorModes.LAZY_FOLLOW;

        // Smooth follow settings
        this.smoothFollow = {
            enabled: true,
            smoothing: 0.1, // Lower = smoother
            threshold: 15, // degrees before following starts
            maxSpeed: 2.0 // max angular velocity
        };

        // UI elements tracking
        this.uiElements = new Map();
        this.camera = null;
        this.scene = null;

        // Performance optimization
        this.updateInterval = 1000 / 60; // 60 FPS
        this.lastUpdate = 0;
    }

    /**
     * Initialize ergonomic UI system
     * @param {THREE.Camera} camera - VR camera
     * @param {THREE.Scene} scene - Three.js scene
     */
    init(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        console.log('[VR Ergonomic UI] Initialized');
        return this;
    }

    /**
     * Position UI element in optimal viewing zone
     * @param {THREE.Object3D} element - UI element to position
     * @param {Object} options - Positioning options
     * @returns {THREE.Vector3} Final position
     */
    positionInViewingZone(element, options = {}) {
        const {
            zone = 'primary',
            distance = this.OPTIMAL_VIEW_DISTANCE,
            horizontalAngle = 0, // degrees from center
            verticalAngle = -10, // degrees from center (slight down is comfortable)
            anchorMode = this.defaultAnchorMode
        } = options;

        // Validate zone
        const zoneConfig = this.viewingZones[zone];
        if (!zoneConfig) {
            console.warn(`Invalid zone: ${zone}, using primary`);
            return this.positionInViewingZone(element, { ...options, zone: 'primary' });
        }

        // Calculate position based on angles and distance
        const position = this.calculatePositionFromAngles(
            horizontalAngle,
            verticalAngle,
            distance
        );

        element.position.copy(position);

        // Set up anchoring
        this.setupAnchoring(element, anchorMode, options);

        // Track element
        this.uiElements.set(element.uuid, {
            element,
            anchorMode,
            originalPosition: position.clone(),
            options
        });

        return position;
    }

    /**
     * Calculate 3D position from horizontal/vertical angles
     * @param {number} horizontalAngle - Horizontal angle in degrees
     * @param {number} verticalAngle - Vertical angle in degrees
     * @param {number} distance - Distance from camera
     * @returns {THREE.Vector3} 3D position
     */
    calculatePositionFromAngles(horizontalAngle, verticalAngle, distance) {
        const hRad = (horizontalAngle * Math.PI) / 180;
        const vRad = (verticalAngle * Math.PI) / 180;

        const x = distance * Math.sin(hRad) * Math.cos(vRad);
        const y = this.COMFORTABLE_HEIGHT + distance * Math.sin(vRad);
        const z = -distance * Math.cos(hRad) * Math.cos(vRad);

        return new THREE.Vector3(x, y, z);
    }

    /**
     * Create UI panel with optimal sizing
     * @param {number} width - Panel width in meters
     * @param {number} height - Panel height in meters
     * @param {Object} options - Panel options
     * @returns {THREE.Mesh}
     */
    createPanel(width, height, options = {}) {
        const {
            color = 0x1a1a2e,
            opacity = 0.95,
            borderRadius = 0.02,
            borderColor = 0x00ffff,
            borderWidth = 0.005
        } = options;

        const group = new THREE.Group();

        // Main panel
        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
            side: THREE.DoubleSide
        });
        const panel = new THREE.Mesh(geometry, material);
        group.add(panel);

        // Border
        if (borderWidth > 0) {
            const borderGeometry = new THREE.EdgesGeometry(geometry);
            const borderMaterial = new THREE.LineBasicMaterial({
                color: borderColor,
                linewidth: borderWidth * 1000
            });
            const border = new THREE.LineSegments(borderGeometry, borderMaterial);
            group.add(border);
        }

        return group;
    }

    /**
     * Create ergonomic button
     * @param {string} text - Button text
     * @param {Object} options - Button options
     * @returns {THREE.Group}
     */
    createButton(text, options = {}) {
        const {
            width = this.RECOMMENDED_BUTTON_SIZE * 3,
            height = this.RECOMMENDED_BUTTON_SIZE,
            onClick = null,
            color = 0x00ffff,
            hoverColor = 0x00ffff,
            textColor = '#000000'
        } = options;

        const group = new THREE.Group();

        // Button background
        const bgGeometry = new THREE.PlaneGeometry(width, height);
        const bgMaterial = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.9
        });
        const background = new THREE.Mesh(bgGeometry, bgMaterial);
        group.add(background);

        // Button text
        if (window.VRTextRenderer) {
            const textRenderer = new VRTextRenderer();
            const textSprite = textRenderer.createTextSprite(text, {
                fontSize: 48,
                color: textColor,
                backgroundColor: 'transparent'
            });
            textSprite.position.z = 0.01;
            group.add(textSprite);
        }

        // Interaction setup
        group.userData.isButton = true;
        group.userData.onClick = onClick;
        group.userData.defaultColor = color;
        group.userData.hoverColor = hoverColor;
        group.userData.background = background;

        return group;
    }

    /**
     * Setup UI element anchoring
     * @param {THREE.Object3D} element - UI element
     * @param {string} mode - Anchor mode
     * @param {Object} options - Anchor options
     */
    setupAnchoring(element, mode, options = {}) {
        element.userData.anchorMode = mode;
        element.userData.anchorOptions = options;

        if (mode === this.anchorModes.WORLD) {
            // No special setup needed
            return;
        }

        if (mode === this.anchorModes.HEAD) {
            // Directly parent to camera (use sparingly!)
            console.warn('HEAD anchor mode can cause discomfort, use LAZY_FOLLOW instead');
            return;
        }

        // For smooth/lazy follow, store initial offset
        if (this.camera) {
            const offset = new THREE.Vector3();
            offset.copy(element.position).sub(this.camera.position);
            element.userData.anchorOffset = offset;
            element.userData.lastCameraRotation = this.camera.rotation.clone();
        }
    }

    /**
     * Update UI element positions (call in render loop)
     * @param {number} deltaTime - Time since last update
     */
    update(deltaTime) {
        if (!this.camera) return;

        const now = Date.now();
        if (now - this.lastUpdate < this.updateInterval) return;
        this.lastUpdate = now;

        this.uiElements.forEach((data, uuid) => {
            const { element, anchorMode } = data;

            if (anchorMode === this.anchorModes.SMOOTH_FOLLOW) {
                this.updateSmoothFollow(element, deltaTime);
            } else if (anchorMode === this.anchorModes.LAZY_FOLLOW) {
                this.updateLazyFollow(element, deltaTime);
            }
        });
    }

    /**
     * Update element with smooth follow behavior
     * @param {THREE.Object3D} element - UI element
     * @param {number} deltaTime - Delta time
     */
    updateSmoothFollow(element, deltaTime) {
        if (!element.userData.anchorOffset) return;

        // Calculate target position based on camera
        const targetPosition = new THREE.Vector3();
        targetPosition.copy(this.camera.position);

        // Apply offset rotated by camera direction
        const rotatedOffset = element.userData.anchorOffset.clone();
        rotatedOffset.applyQuaternion(this.camera.quaternion);
        targetPosition.add(rotatedOffset);

        // Smooth interpolation
        element.position.lerp(targetPosition, this.smoothFollow.smoothing);

        // Look at camera
        element.lookAt(this.camera.position);
    }

    /**
     * Update element with lazy follow behavior
     * @param {THREE.Object3D} element - UI element
     * @param {number} deltaTime - Delta time
     */
    updateLazyFollow(element, deltaTime) {
        if (!element.userData.lastCameraRotation) return;

        // Calculate camera rotation delta
        const currentRotation = this.camera.rotation;
        const lastRotation = element.userData.lastCameraRotation;

        const deltaY = Math.abs(currentRotation.y - lastRotation.y) * (180 / Math.PI);

        // Only follow if threshold exceeded
        if (deltaY > this.smoothFollow.threshold) {
            this.updateSmoothFollow(element, deltaTime);
            element.userData.lastCameraRotation = currentRotation.clone();
        }
    }

    /**
     * Create comfortable UI layout
     * @param {Array} elements - UI elements to layout
     * @param {Object} options - Layout options
     * @returns {THREE.Group}
     */
    createLayout(elements, options = {}) {
        const {
            type = 'vertical', // 'vertical', 'horizontal', 'grid'
            spacing = this.MIN_SPACING,
            distance = this.OPTIMAL_VIEW_DISTANCE,
            centered = true
        } = options;

        const group = new THREE.Group();

        if (type === 'vertical') {
            this.layoutVertical(elements, group, spacing, centered);
        } else if (type === 'horizontal') {
            this.layoutHorizontal(elements, group, spacing, centered);
        } else if (type === 'grid') {
            this.layoutGrid(elements, group, spacing, options);
        }

        // Position group in viewing zone
        this.positionInViewingZone(group, { distance });

        return group;
    }

    /**
     * Layout elements vertically
     * @param {Array} elements - Elements to layout
     * @param {THREE.Group} group - Parent group
     * @param {number} spacing - Spacing between elements
     * @param {boolean} centered - Center alignment
     */
    layoutVertical(elements, group, spacing, centered) {
        let totalHeight = 0;

        // Calculate total height
        elements.forEach(el => {
            const box = new THREE.Box3().setFromObject(el);
            totalHeight += box.max.y - box.min.y;
        });
        totalHeight += spacing * (elements.length - 1);

        let currentY = centered ? totalHeight / 2 : 0;

        elements.forEach(el => {
            const box = new THREE.Box3().setFromObject(el);
            const height = box.max.y - box.min.y;

            el.position.y = currentY - height / 2;
            currentY -= height + spacing;

            group.add(el);
        });
    }

    /**
     * Layout elements horizontally
     * @param {Array} elements - Elements to layout
     * @param {THREE.Group} group - Parent group
     * @param {number} spacing - Spacing between elements
     * @param {boolean} centered - Center alignment
     */
    layoutHorizontal(elements, group, spacing, centered) {
        let totalWidth = 0;

        // Calculate total width
        elements.forEach(el => {
            const box = new THREE.Box3().setFromObject(el);
            totalWidth += box.max.x - box.min.x;
        });
        totalWidth += spacing * (elements.length - 1);

        let currentX = centered ? -totalWidth / 2 : 0;

        elements.forEach(el => {
            const box = new THREE.Box3().setFromObject(el);
            const width = box.max.x - box.min.x;

            el.position.x = currentX + width / 2;
            currentX += width + spacing;

            group.add(el);
        });
    }

    /**
     * Layout elements in grid
     * @param {Array} elements - Elements to layout
     * @param {THREE.Group} group - Parent group
     * @param {number} spacing - Spacing between elements
     * @param {Object} options - Grid options
     */
    layoutGrid(elements, group, spacing, options) {
        const { columns = 3 } = options;

        let currentX = 0;
        let currentY = 0;
        let rowHeight = 0;
        let columnIndex = 0;

        elements.forEach((el, index) => {
            const box = new THREE.Box3().setFromObject(el);
            const width = box.max.x - box.min.x;
            const height = box.max.y - box.min.y;

            el.position.x = currentX;
            el.position.y = currentY;

            rowHeight = Math.max(rowHeight, height);

            currentX += width + spacing;
            columnIndex++;

            if (columnIndex >= columns) {
                currentX = 0;
                currentY -= rowHeight + spacing;
                rowHeight = 0;
                columnIndex = 0;
            }

            group.add(el);
        });
    }

    /**
     * Check if position is in comfortable zone
     * @param {THREE.Vector3} position - Position to check
     * @param {string} zone - Zone name
     * @returns {boolean}
     */
    isInComfortableZone(position, zone = 'primary') {
        const zoneConfig = this.viewingZones[zone];
        if (!zoneConfig || !this.camera) return false;

        // Calculate angles from camera
        const direction = new THREE.Vector3().subVectors(position, this.camera.position);
        const distance = direction.length();

        // Check distance
        if (distance < zoneConfig.distance.min || distance > zoneConfig.distance.max) {
            return false;
        }

        // Calculate horizontal angle
        const hAngle = Math.atan2(direction.x, -direction.z) * (180 / Math.PI);
        if (hAngle < zoneConfig.horizontal.min || hAngle > zoneConfig.horizontal.max) {
            return false;
        }

        // Calculate vertical angle
        const vAngle = Math.atan2(direction.y, Math.sqrt(direction.x ** 2 + direction.z ** 2)) * (180 / Math.PI);
        if (vAngle < zoneConfig.vertical.min || vAngle > zoneConfig.vertical.max) {
            return false;
        }

        return true;
    }

    /**
     * Get comfort score for position (0-1)
     * @param {THREE.Vector3} position - Position to check
     * @returns {number} Comfort score
     */
    getComfortScore(position) {
        if (this.isInComfortableZone(position, 'primary')) return 1.0;
        if (this.isInComfortableZone(position, 'secondary')) return 0.7;
        if (this.isInComfortableZone(position, 'peripheral')) return 0.4;
        return 0.1;
    }

    /**
     * Remove UI element from tracking
     * @param {THREE.Object3D} element - Element to remove
     */
    removeElement(element) {
        this.uiElements.delete(element.uuid);
    }

    /**
     * Dispose and cleanup
     */
    dispose() {
        this.uiElements.clear();
        this.camera = null;
        this.scene = null;
    }
}

// Export for global access
if (typeof window !== 'undefined') {
    window.VRErgonomicUI = VRErgonomicUI;
}
