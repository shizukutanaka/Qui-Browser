/**
 * VR UI System - Unified UI management for VR experience
 * Consolidates: vr-ergonomic-ui.js, vr-settings-ui.js, vr-text-renderer.js, vr-theme-editor.js
 * @version 3.2.0
 */

class VRUISystem {
    constructor() {
        this.initialized = false;

        // Ergonomic constants
        this.VIEWING_ZONES = {
            optimal: { minAngle: -15, maxAngle: 15, distance: 2.0 },
            comfortable: { minAngle: -30, maxAngle: 30, distance: 1.5 },
            acceptable: { minAngle: -45, maxAngle: 45, distance: 1.0 }
        };

        this.MIN_BUTTON_SIZE = 44; // mm - based on Fitts's law
        this.PREFERRED_BUTTON_SIZE = 60; // mm

        // Text rendering
        this.MIN_FONT_SIZE = 32; // px in VR
        this.MAX_FONT_SIZE = 128; // px in VR
        this.OPTIMAL_VIEWING_DISTANCE = 2.0; // meters

        // Theme system
        this.themes = {
            dark: {
                background: '#1a1a1a',
                surface: '#2a2a2a',
                primary: '#4a9eff',
                secondary: '#667eea',
                text: '#ffffff',
                textSecondary: '#b0b0b0',
                border: '#404040',
                success: '#00c853',
                warning: '#ff9800',
                error: '#f44336'
            },
            light: {
                background: '#f5f5f5',
                surface: '#ffffff',
                primary: '#2196f3',
                secondary: '#3f51b5',
                text: '#212121',
                textSecondary: '#757575',
                border: '#e0e0e0',
                success: '#4caf50',
                warning: '#ff9800',
                error: '#f44336'
            },
            cyberpunk: {
                background: '#0d0221',
                surface: '#1a0933',
                primary: '#ff006e',
                secondary: '#8338ec',
                text: '#00f5ff',
                textSecondary: '#b967ff',
                border: '#5a189a',
                success: '#06ffa5',
                warning: '#ffbe0b',
                error: '#ff006e'
            },
            nature: {
                background: '#1b4332',
                surface: '#2d6a4f',
                primary: '#52b788',
                secondary: '#74c69d',
                text: '#d8f3dc',
                textSecondary: '#b7e4c7',
                border: '#40916c',
                success: '#95d5b2',
                warning: '#ffd166',
                error: '#e63946'
            }
        };

        this.currentTheme = 'dark';
        this.uiPanels = new Map();
        this.textMeshes = new Map();

        this.init();
    }

    init() {
        if (typeof THREE === 'undefined') {
            console.warn('VR UI System: THREE.js not loaded, deferring initialization');
            window.addEventListener('three-loaded', () => this.init());
            return;
        }

        this.setupTextRenderer();
        this.setupUIComponents();
        this.applyTheme(this.currentTheme);

        this.initialized = true;
        console.info('✅ VR UI System initialized');

        window.dispatchEvent(new CustomEvent('vr-ui-ready'));
    }

    // ========== Text Rendering System ==========

    setupTextRenderer() {
        this.fontLoader = new THREE.FontLoader();
        this.loadedFonts = new Map();

        // Default font (fallback to system)
        this.defaultFont = null;
    }

    async loadFont(name, url) {
        if (this.loadedFonts.has(name)) {
            return this.loadedFonts.get(name);
        }

        return new Promise((resolve, reject) => {
            this.fontLoader.load(
                url,
                (font) => {
                    this.loadedFonts.set(name, font);
                    resolve(font);
                },
                undefined,
                (error) => {
                    console.error(`Failed to load font ${name}:`, error);
                    reject(error);
                }
            );
        });
    }

    calculateFontSize(viewingDistance) {
        // Based on visual angle: optimal ~0.3-0.5 degrees per character
        // fontSize = distance * tan(angle) * pixelsPerMeter
        const angle = 0.004; // ~0.23 degrees in radians
        const pixelsPerMeter = 1000;

        let fontSize = viewingDistance * Math.tan(angle) * pixelsPerMeter;
        fontSize = Math.max(this.MIN_FONT_SIZE, Math.min(this.MAX_FONT_SIZE, fontSize));

        return Math.round(fontSize);
    }

    createTextMesh(text, options = {}) {
        const {
            font = this.defaultFont,
            size = this.calculateFontSize(this.OPTIMAL_VIEWING_DISTANCE),
            height = 0.1,
            curveSegments = 12,
            bevelEnabled = false,
            color = this.getThemeColor('text'),
            position = { x: 0, y: 0, z: 0 },
            maxWidth = null
        } = options;

        if (!font) {
            console.warn('No font loaded, using canvas fallback');
            return this.createCanvasText(text, options);
        }

        // Wrap text if maxWidth specified
        const wrappedText = maxWidth ? this.wrapText(text, font, size, maxWidth) : text;

        const geometry = new THREE.TextGeometry(wrappedText, {
            font: font,
            size: size / 100, // Convert to meters
            height: height,
            curveSegments: curveSegments,
            bevelEnabled: bevelEnabled
        });

        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.2
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(position.x, position.y, position.z);

        // Center the text
        geometry.computeBoundingBox();
        const centerOffset = -0.5 * (geometry.boundingBox.max.x - geometry.boundingBox.min.x);
        mesh.position.x += centerOffset;

        const id = `text-${Date.now()}-${Math.random()}`;
        this.textMeshes.set(id, mesh);

        return { id, mesh };
    }

    createCanvasText(text, options = {}) {
        const {
            fontSize = 64,
            fontFamily = 'Arial, sans-serif',
            color = '#ffffff',
            backgroundColor = 'transparent',
            padding = 20,
            maxWidth = 1024,
            textAlign = 'center'
        } = options;

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        // Set font for measurement
        context.font = `${fontSize}px ${fontFamily}`;

        // Wrap text
        const lines = this.wrapTextCanvas(text, context, maxWidth - padding * 2);

        // Calculate canvas size
        const lineHeight = fontSize * 1.2;
        canvas.width = maxWidth;
        canvas.height = lines.length * lineHeight + padding * 2;

        // Clear and set background
        if (backgroundColor !== 'transparent') {
            context.fillStyle = backgroundColor;
            context.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Draw text
        context.font = `${fontSize}px ${fontFamily}`;
        context.fillStyle = color;
        context.textAlign = textAlign;
        context.textBaseline = 'top';

        const x = textAlign === 'center' ? canvas.width / 2 : padding;
        lines.forEach((line, i) => {
            context.fillText(line, x, padding + i * lineHeight);
        });

        // Create texture
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        // Create material and mesh
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: backgroundColor === 'transparent',
            side: THREE.DoubleSide
        });

        const aspectRatio = canvas.width / canvas.height;
        const height = 1; // meter
        const width = height * aspectRatio;

        const geometry = new THREE.PlaneGeometry(width, height);
        const mesh = new THREE.Mesh(geometry, material);

        const id = `canvas-text-${Date.now()}-${Math.random()}`;
        this.textMeshes.set(id, { mesh, canvas, texture });

        return { id, mesh, canvas, texture };
    }

    wrapTextCanvas(text, context, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = context.measureText(currentLine + ' ' + word).width;

            if (width < maxWidth) {
                currentLine += ' ' + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);

        return lines;
    }

    updateTextMesh(id, newText, options = {}) {
        const existing = this.textMeshes.get(id);
        if (!existing) return null;

        // If it's a canvas-based text
        if (existing.canvas) {
            const context = existing.canvas.getContext('2d');
            const fontSize = options.fontSize || 64;
            const color = options.color || '#ffffff';

            // Clear canvas
            context.clearRect(0, 0, existing.canvas.width, existing.canvas.height);

            // Redraw
            context.font = `${fontSize}px Arial`;
            context.fillStyle = color;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(newText, existing.canvas.width / 2, existing.canvas.height / 2);

            existing.texture.needsUpdate = true;

            return existing.mesh;
        }

        // For TextGeometry, recreate the mesh
        this.removeTextMesh(id);
        return this.createTextMesh(newText, options);
    }

    removeTextMesh(id) {
        const item = this.textMeshes.get(id);
        if (item) {
            const mesh = item.mesh || item;
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
            if (item.texture) item.texture.dispose();
            this.textMeshes.delete(id);
        }
    }

    // ========== Ergonomic UI System ==========

    setupUIComponents() {
        this.uiContainer = new THREE.Group();
        this.uiContainer.name = 'VR-UI-Container';
    }

    createPanel(options = {}) {
        const {
            width = 1.5,
            height = 1.0,
            position = { x: 0, y: 1.5, z: -2 },
            curved = true,
            curveRadius = 2.5,
            title = 'Panel',
            backgroundColor = this.getThemeColor('surface'),
            borderColor = this.getThemeColor('border')
        } = options;

        const panel = new THREE.Group();
        panel.name = `panel-${title}`;

        // Background
        let backgroundGeometry;
        if (curved) {
            const segments = 32;
            const thetaLength = width / curveRadius;
            backgroundGeometry = new THREE.CylinderGeometry(
                curveRadius, curveRadius, height, segments, 1,
                true, -thetaLength / 2, thetaLength
            );
            backgroundGeometry.rotateY(Math.PI);
        } else {
            backgroundGeometry = new THREE.PlaneGeometry(width, height);
        }

        const backgroundMaterial = new THREE.MeshStandardMaterial({
            color: backgroundColor,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide
        });

        const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
        panel.add(background);

        // Border
        const borderMaterial = new THREE.LineBasicMaterial({
            color: borderColor,
            linewidth: 2
        });

        const borderGeometry = new THREE.EdgesGeometry(backgroundGeometry);
        const border = new THREE.LineSegments(borderGeometry, borderMaterial);
        panel.add(border);

        // Title
        if (title) {
            const titleText = this.createCanvasText(title, {
                fontSize: 48,
                color: this.getThemeColor('text'),
                backgroundColor: 'transparent'
            });

            titleText.mesh.position.set(0, height / 2 + 0.15, 0.01);
            titleText.mesh.scale.set(0.5, 0.5, 0.5);
            panel.add(titleText.mesh);
        }

        panel.position.set(position.x, position.y, position.z);

        const id = `panel-${Date.now()}-${Math.random()}`;
        this.uiPanels.set(id, panel);

        return { id, panel };
    }

    createButton(options = {}) {
        const {
            width = 0.3,
            height = 0.1,
            depth = 0.02,
            text = 'Button',
            position = { x: 0, y: 0, z: 0 },
            onClick = null,
            color = this.getThemeColor('primary'),
            textColor = this.getThemeColor('text')
        } = options;

        const button = new THREE.Group();
        button.name = `button-${text}`;

        // Button geometry
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.3,
            roughness: 0.7
        });

        const buttonMesh = new THREE.Mesh(geometry, material);
        button.add(buttonMesh);

        // Button text
        const buttonText = this.createCanvasText(text, {
            fontSize: 32,
            color: textColor,
            backgroundColor: 'transparent',
            maxWidth: 256
        });

        buttonText.mesh.position.set(0, 0, depth / 2 + 0.001);
        buttonText.mesh.scale.set(0.3, 0.3, 0.3);
        button.add(buttonText.mesh);

        button.position.set(position.x, position.y, position.z);

        // Interaction
        button.userData = {
            isButton: true,
            onClick: onClick,
            defaultColor: color,
            hoverColor: this.lightenColor(color, 0.2),
            pressColor: this.darkenColor(color, 0.2)
        };

        return button;
    }

    isInViewingZone(angle, distance, zone = 'comfortable') {
        const zoneData = this.VIEWING_ZONES[zone];
        if (!zoneData) return false;

        const angleInRange = angle >= zoneData.minAngle && angle <= zoneData.maxAngle;
        const distanceOk = Math.abs(distance - zoneData.distance) < 1.0;

        return angleInRange && distanceOk;
    }

    calculateButtonSize(distance) {
        // Fitts's law: size should scale with distance
        // target size in meters = MIN_SIZE_MM / 1000 * (distance / OPTIMAL_DISTANCE)
        const scaleFactor = distance / this.OPTIMAL_VIEWING_DISTANCE;
        const sizeMeters = (this.PREFERRED_BUTTON_SIZE / 1000) * scaleFactor;

        return Math.max(this.MIN_BUTTON_SIZE / 1000, sizeMeters);
    }

    // ========== Theme System ==========

    applyTheme(themeName) {
        if (!this.themes[themeName]) {
            console.warn(`Theme ${themeName} not found`);
            return;
        }

        this.currentTheme = themeName;
        const theme = this.themes[themeName];

        // Apply to all UI panels
        this.uiPanels.forEach(panel => {
            const background = panel.children.find(child => child.type === 'Mesh');
            if (background && background.material) {
                background.material.color.set(theme.surface);
            }
        });

        // Emit theme change event
        window.dispatchEvent(new CustomEvent('vr-theme-changed', {
            detail: { theme: themeName, colors: theme }
        }));

        console.info(`✅ Theme applied: ${themeName}`);
    }

    getThemeColor(colorName) {
        const theme = this.themes[this.currentTheme];
        return theme[colorName] || '#ffffff';
    }

    createCustomTheme(name, colors) {
        this.themes[name] = { ...this.themes.dark, ...colors };
        console.info(`✅ Custom theme created: ${name}`);
    }

    lightenColor(color, amount) {
        const col = new THREE.Color(color);
        col.offsetHSL(0, 0, amount);
        return '#' + col.getHexString();
    }

    darkenColor(color, amount) {
        return this.lightenColor(color, -amount);
    }

    // ========== Utility Methods ==========

    positionAtViewingAngle(object, angle, distance) {
        const rad = angle * (Math.PI / 180);
        const x = Math.sin(rad) * distance;
        const z = -Math.cos(rad) * distance;

        object.position.set(x, 1.5, z);
        object.lookAt(0, 1.5, 0);
    }

    cleanup() {
        // Cleanup text meshes
        this.textMeshes.forEach((item, id) => {
            this.removeTextMesh(id);
        });
        this.textMeshes.clear();

        // Cleanup panels
        this.uiPanels.forEach(panel => {
            panel.children.forEach(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        });
        this.uiPanels.clear();

        console.info('VR UI System cleaned up');
    }
}

// Initialize and export
window.VRUISystem = new VRUISystem();

console.log('✅ VR UI System loaded');