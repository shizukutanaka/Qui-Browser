/**
 * VR Environment Customization System
 * Customizable VR environment, backgrounds, and UI layouts
 * @version 2.0.0
 */

class VREnvironmentCustomizer {
    constructor() {
        // Environment presets
        this.presets = {
            space: {
                name: 'スペース',
                background: 'skybox-space',
                ambientLight: { color: 0x111133, intensity: 0.3 },
                fogColor: 0x000011,
                fogNear: 10,
                fogFar: 100,
                particles: true,
                particleColor: 0xffffff,
                particleCount: 5000
            },
            forest: {
                name: '森林',
                background: 'skybox-forest',
                ambientLight: { color: 0x88ff88, intensity: 0.5 },
                fogColor: 0x88cc88,
                fogNear: 5,
                fogFar: 50,
                particles: false
            },
            ocean: {
                name: '海',
                background: 'gradient-ocean',
                ambientLight: { color: 0x4488ff, intensity: 0.6 },
                fogColor: 0x88ccff,
                fogNear: 8,
                fogFar: 60,
                particles: true,
                particleColor: 0x88ccff,
                particleCount: 1000
            },
            minimal: {
                name: 'ミニマル',
                background: 'solid-dark',
                ambientLight: { color: 0xffffff, intensity: 0.4 },
                fogColor: 0x1a1a2e,
                fogNear: 10,
                fogFar: 100,
                particles: false
            },
            sunset: {
                name: 'サンセット',
                background: 'gradient-sunset',
                ambientLight: { color: 0xff8844, intensity: 0.7 },
                fogColor: 0xff6644,
                fogNear: 10,
                fogFar: 80,
                particles: true,
                particleColor: 0xffaa88,
                particleCount: 2000
            },
            cyberpunk: {
                name: 'サイバーパンク',
                background: 'gradient-cyberpunk',
                ambientLight: { color: 0xff00ff, intensity: 0.5 },
                fogColor: 0x440044,
                fogNear: 5,
                fogFar: 40,
                particles: true,
                particleColor: 0x00ffff,
                particleCount: 3000
            }
        };

        // Current environment
        this.currentEnvironment = 'minimal';

        // UI Layout presets
        this.uiLayouts = {
            default: {
                name: 'デフォルト',
                positions: {
                    navbar: { x: 0, y: 1.6, z: -2.5, rotation: { x: 0, y: 0, z: 0 } },
                    tabs: { x: 0, y: 1.3, z: -2.5, rotation: { x: 0, y: 0, z: 0 } },
                    content: { x: 0, y: 1.0, z: -2.0, rotation: { x: 0, y: 0, z: 0 } }
                }
            },
            comfortable: {
                name: '快適',
                positions: {
                    navbar: { x: 0, y: 1.5, z: -2.0, rotation: { x: -10, y: 0, z: 0 } },
                    tabs: { x: 0, y: 1.2, z: -2.0, rotation: { x: -10, y: 0, z: 0 } },
                    content: { x: 0, y: 0.9, z: -1.8, rotation: { x: -10, y: 0, z: 0 } }
                }
            },
            theater: {
                name: 'シアター',
                positions: {
                    navbar: { x: 0, y: 2.2, z: -4.0, rotation: { x: -15, y: 0, z: 0 } },
                    tabs: { x: 0, y: 1.8, z: -4.0, rotation: { x: -15, y: 0, z: 0 } },
                    content: { x: 0, y: 1.0, z: -3.5, rotation: { x: -15, y: 0, z: 0 } }
                }
            },
            floating: {
                name: 'フローティング',
                positions: {
                    navbar: { x: -1.5, y: 1.7, z: -2.0, rotation: { x: 0, y: 15, z: 0 } },
                    tabs: { x: 1.5, y: 1.7, z: -2.0, rotation: { x: 0, y: -15, z: 0 } },
                    content: { x: 0, y: 1.0, z: -2.5, rotation: { x: 0, y: 0, z: 0 } }
                }
            }
        };

        this.currentLayout = 'default';

        // Customization settings
        this.settings = {
            backgroundEnabled: true,
            particlesEnabled: true,
            fogEnabled: true,
            gridEnabled: true,
            gridColor: 0x00ffff,
            gridOpacity: 0.3,
            uiScale: 1.0,
            uiOpacity: 0.95,
            ambientLightIntensity: 0.4,
            customBackgroundUrl: null,
            customSkybox: null
        };

        // Three.js objects
        this.scene = null;
        this.camera = null;
        this.background = null;
        this.particleSystem = null;
        this.gridHelper = null;
        this.ambientLight = null;
        this.environmentObjects = [];

        // Animation
        this.animationId = null;
        this.clock = new THREE.Clock();
    }

    /**
     * Initialize environment customizer
     * @param {THREE.Scene} scene - Three.js scene
     * @param {THREE.Camera} camera - VR camera
     */
    init(scene, camera) {
        this.scene = scene;
        this.camera = camera;

        // Load saved settings
        this.loadSettings();

        // Apply current environment
        this.applyEnvironment(this.currentEnvironment);

        // Apply UI layout
        this.applyUILayout(this.currentLayout);

        // Start animation
        this.startAnimation();

        console.log('[VR Environment] Initialized');
        return this;
    }

    /**
     * Apply environment preset
     * @param {string} presetName - Preset name
     */
    applyEnvironment(presetName) {
        const preset = this.presets[presetName];
        if (!preset) {
            console.warn(`[VR Environment] Unknown preset: ${presetName}`);
            return;
        }

        this.currentEnvironment = presetName;

        // Clear existing environment
        this.clearEnvironment();

        // Apply background
        this.applyBackground(preset.background);

        // Apply fog
        if (this.settings.fogEnabled) {
            this.applyFog(preset.fogColor, preset.fogNear, preset.fogFar);
        }

        // Apply lighting
        this.applyLighting(preset.ambientLight);

        // Apply particles
        if (this.settings.particlesEnabled && preset.particles) {
            this.createParticles(preset.particleColor, preset.particleCount);
        }

        // Apply grid
        if (this.settings.gridEnabled) {
            this.createGrid();
        }

        // Save settings
        this.saveSettings();

        console.log(`[VR Environment] Applied preset: ${preset.name}`);
    }

    /**
     * Apply background
     * @param {string} backgroundType - Background type
     */
    applyBackground(backgroundType) {
        if (!this.settings.backgroundEnabled) return;

        switch (backgroundType) {
            case 'skybox-space':
                this.createSpaceSkybox();
                break;
            case 'gradient-ocean':
                this.createGradientBackground(0x004488, 0x88ccff);
                break;
            case 'gradient-sunset':
                this.createGradientBackground(0xff4400, 0xff8844);
                break;
            case 'gradient-cyberpunk':
                this.createGradientBackground(0x440044, 0xff00ff);
                break;
            case 'solid-dark':
                this.scene.background = new THREE.Color(0x0a0a0a);
                break;
            default:
                this.scene.background = new THREE.Color(0x0a0a0a);
        }
    }

    /**
     * Create space skybox
     */
    createSpaceSkybox() {
        const geometry = new THREE.SphereGeometry(100, 32, 32);
        geometry.scale(-1, 1, 1); // Inside-out

        // Create starfield texture
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');

        // Black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Random stars
        for (let i = 0; i < 2000; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const radius = Math.random() * 2;
            const brightness = Math.random();

            ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.BackSide
        });

        this.background = new THREE.Mesh(geometry, material);
        this.scene.add(this.background);
        this.environmentObjects.push(this.background);
    }

    /**
     * Create gradient background
     * @param {number} colorTop - Top color
     * @param {number} colorBottom - Bottom color
     */
    createGradientBackground(colorTop, colorBottom) {
        const geometry = new THREE.SphereGeometry(100, 32, 32);
        geometry.scale(-1, 1, 1);

        // Create gradient texture
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        const topColor = new THREE.Color(colorTop);
        const bottomColor = new THREE.Color(colorBottom);

        gradient.addColorStop(0, `#${topColor.getHexString()}`);
        gradient.addColorStop(1, `#${bottomColor.getHexString()}`);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.BackSide
        });

        this.background = new THREE.Mesh(geometry, material);
        this.scene.add(this.background);
        this.environmentObjects.push(this.background);
    }

    /**
     * Apply fog
     * @param {number} color - Fog color
     * @param {number} near - Fog near
     * @param {number} far - Fog far
     */
    applyFog(color, near, far) {
        this.scene.fog = new THREE.Fog(color, near, far);
    }

    /**
     * Apply lighting
     * @param {Object} lightConfig - Light configuration
     */
    applyLighting(lightConfig) {
        // Remove existing ambient light
        if (this.ambientLight) {
            this.scene.remove(this.ambientLight);
        }

        // Create new ambient light
        this.ambientLight = new THREE.AmbientLight(
            lightConfig.color,
            lightConfig.intensity * this.settings.ambientLightIntensity
        );
        this.scene.add(this.ambientLight);
    }

    /**
     * Create particle system
     * @param {number} color - Particle color
     * @param {number} count - Particle count
     */
    createParticles(color, count) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);

        for (let i = 0; i < count * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 100;
            positions[i + 1] = (Math.random() - 0.5) * 100;
            positions[i + 2] = (Math.random() - 0.5) * 100;

            velocities[i] = (Math.random() - 0.5) * 0.02;
            velocities[i + 1] = (Math.random() - 0.5) * 0.02;
            velocities[i + 2] = (Math.random() - 0.5) * 0.02;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.userData.velocities = velocities;

        const material = new THREE.PointsMaterial({
            color,
            size: 0.1,
            transparent: true,
            opacity: 0.6,
            sizeAttenuation: true
        });

        this.particleSystem = new THREE.Points(geometry, material);
        this.scene.add(this.particleSystem);
        this.environmentObjects.push(this.particleSystem);
    }

    /**
     * Create floor grid
     */
    createGrid() {
        this.gridHelper = new THREE.GridHelper(
            50, // size
            50, // divisions
            this.settings.gridColor,
            this.settings.gridColor
        );
        this.gridHelper.material.transparent = true;
        this.gridHelper.material.opacity = this.settings.gridOpacity;
        this.gridHelper.position.y = 0;

        this.scene.add(this.gridHelper);
        this.environmentObjects.push(this.gridHelper);
    }

    /**
     * Apply UI layout preset
     * @param {string} layoutName - Layout name
     */
    applyUILayout(layoutName) {
        const layout = this.uiLayouts[layoutName];
        if (!layout) {
            console.warn(`[VR Environment] Unknown layout: ${layoutName}`);
            return;
        }

        this.currentLayout = layoutName;

        // Apply positions to UI elements
        Object.entries(layout.positions).forEach(([elementName, position]) => {
            this.positionUIElement(elementName, position);
        });

        console.log(`[VR Environment] Applied layout: ${layout.name}`);
    }

    /**
     * Position UI element
     * @param {string} elementName - Element name
     * @param {Object} position - Position configuration
     */
    positionUIElement(elementName, position) {
        const element = this.findUIElement(elementName);
        if (!element) return;

        // Apply position
        element.position.set(position.x, position.y, position.z);

        // Apply rotation
        if (position.rotation) {
            element.rotation.set(
                (position.rotation.x * Math.PI) / 180,
                (position.rotation.y * Math.PI) / 180,
                (position.rotation.z * Math.PI) / 180
            );
        }

        // Apply scale
        const scale = this.settings.uiScale;
        element.scale.set(scale, scale, scale);

        // Apply opacity
        element.traverse(child => {
            if (child.material) {
                child.material.opacity = this.settings.uiOpacity;
                child.material.transparent = true;
            }
        });
    }

    /**
     * Find UI element by name
     * @param {string} name - Element name
     * @returns {THREE.Object3D|null}
     */
    findUIElement(name) {
        return this.scene.getObjectByName(`ui-${name}`);
    }

    /**
     * Update environment (call in render loop)
     * @param {number} deltaTime - Delta time
     */
    update(deltaTime) {
        // Animate particles
        if (this.particleSystem) {
            this.animateParticles(deltaTime);
        }

        // Animate background
        if (this.background && this.background.material.map) {
            this.background.rotation.y += deltaTime * 0.01;
        }
    }

    /**
     * Animate particle system
     * @param {number} deltaTime - Delta time
     */
    animateParticles(deltaTime) {
        const positions = this.particleSystem.geometry.attributes.position.array;
        const velocities = this.particleSystem.geometry.userData.velocities;

        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += velocities[i];
            positions[i + 1] += velocities[i + 1];
            positions[i + 2] += velocities[i + 2];

            // Wrap around
            const bound = 50;
            if (Math.abs(positions[i]) > bound) positions[i] *= -1;
            if (Math.abs(positions[i + 1]) > bound) positions[i + 1] *= -1;
            if (Math.abs(positions[i + 2]) > bound) positions[i + 2] *= -1;
        }

        this.particleSystem.geometry.attributes.position.needsUpdate = true;
    }

    /**
     * Clear environment objects
     */
    clearEnvironment() {
        this.environmentObjects.forEach(obj => {
            this.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (obj.material.map) obj.material.map.dispose();
                obj.material.dispose();
            }
        });

        this.environmentObjects = [];
        this.background = null;
        this.particleSystem = null;
        this.gridHelper = null;

        if (this.scene.fog) {
            this.scene.fog = null;
        }
    }

    /**
     * Start animation loop
     */
    startAnimation() {
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            const deltaTime = this.clock.getDelta();
            this.update(deltaTime);
        };
        animate();
    }

    /**
     * Update settings
     * @param {Object} newSettings - New settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };

        // Reapply environment
        this.applyEnvironment(this.currentEnvironment);
        this.saveSettings();
    }

    /**
     * Get available presets
     * @returns {Object} Available presets
     */
    getPresets() {
        return Object.keys(this.presets).map(key => ({
            id: key,
            name: this.presets[key].name
        }));
    }

    /**
     * Get available layouts
     * @returns {Object} Available layouts
     */
    getLayouts() {
        return Object.keys(this.uiLayouts).map(key => ({
            id: key,
            name: this.uiLayouts[key].name
        }));
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        try {
            const data = {
                currentEnvironment: this.currentEnvironment,
                currentLayout: this.currentLayout,
                settings: this.settings
            };
            localStorage.setItem('vr-environment-settings', JSON.stringify(data));
        } catch (error) {
            console.error('[VR Environment] Failed to save settings:', error);
        }
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('vr-environment-settings');
            if (saved) {
                const data = JSON.parse(saved);
                this.currentEnvironment = data.currentEnvironment || 'minimal';
                this.currentLayout = data.currentLayout || 'default';
                this.settings = { ...this.settings, ...data.settings };
            }
        } catch (error) {
            console.error('[VR Environment] Failed to load settings:', error);
        }
    }

    /**
     * Dispose and cleanup
     */
    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        this.clearEnvironment();

        if (this.ambientLight) {
            this.scene.remove(this.ambientLight);
        }

        this.scene = null;
        this.camera = null;
    }
}

// Export for global access
if (typeof window !== 'undefined') {
    window.VREnvironmentCustomizer = VREnvironmentCustomizer;
}
