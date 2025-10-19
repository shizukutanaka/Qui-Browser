/**
 * VR Tab Manager with 3D Spatial Layout
 * Manage browser tabs in immersive 3D space
 * @version 2.0.0
 */

class VRTabManager3D {
    constructor() {
        this.tabs = [];
        this.activeTabIndex = 0;
        this.maxTabs = 10;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.tabMeshes = [];
        this.container = null;
        this.isActive = false;

        // Layout settings
        this.layout = 'arc'; // 'arc', 'stack', 'grid', 'cylinder'
        this.tabWidth = 3;
        this.tabHeight = 2;
        this.spacing = 0.5;
        this.arcRadius = 8;

        // Animation
        this.animationId = null;
        this.clock = new THREE.Clock();
        this.targetPosition = new THREE.Vector3();
        this.currentPosition = new THREE.Vector3();
    }

    /**
     * Initialize VR tab manager
     */
    async init(containerElement) {
        this.container = containerElement || document.body;

        // Setup Three.js scene
        await this.setupScene();

        // Create default tab
        this.createTab('New Tab', 'about:blank');

        // Setup controls
        this.setupControls();

        // Start render loop
        this.startRenderLoop();

        this.isActive = true;
        console.log('[VR Tab Manager 3D] Initialized');

        return this;
    }

    /**
     * Setup Three.js scene
     */
    async setupScene() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);
        this.scene.fog = new THREE.Fog(0x0a0a0a, 10, 50);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 1.6, 0);
        this.currentPosition.copy(this.camera.position);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.xr.enabled = true;

        this.container.appendChild(this.renderer.domElement);

        // Lighting
        this.setupLighting();

        // Handle resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    /**
     * Setup lighting
     */
    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        // Directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
        directionalLight.position.set(0, 10, 5);
        this.scene.add(directionalLight);

        // Rim lights
        const rimLight1 = new THREE.PointLight(0x00ffff, 0.6, 20);
        rimLight1.position.set(-5, 2, -5);
        this.scene.add(rimLight1);

        const rimLight2 = new THREE.PointLight(0xff00ff, 0.6, 20);
        rimLight2.position.set(5, 2, -5);
        this.scene.add(rimLight2);
    }

    /**
     * Create new tab
     */
    createTab(title = 'New Tab', url = 'about:blank', thumbnail = null) {
        if (this.tabs.length >= this.maxTabs) {
            console.warn('[VR Tab Manager] Maximum tabs reached');
            return null;
        }

        const tab = {
            id: Date.now() + Math.random(),
            title,
            url,
            thumbnail,
            favicon: '🌐',
            createdAt: Date.now()
        };

        this.tabs.push(tab);
        this.updateTabMeshes();

        if (window.vrSpatialAudio) {
            window.vrSpatialAudio.playTabSwitch();
        }

        return tab;
    }

    /**
     * Close tab
     */
    closeTab(index) {
        if (this.tabs.length <= 1) {
            console.warn('[VR Tab Manager] Cannot close last tab');
            return;
        }

        this.tabs.splice(index, 1);

        // Adjust active tab index
        if (this.activeTabIndex >= this.tabs.length) {
            this.activeTabIndex = this.tabs.length - 1;
        }

        this.updateTabMeshes();

        if (window.vrSpatialAudio) {
            window.vrSpatialAudio.playClick();
        }
    }

    /**
     * Switch to tab
     */
    switchToTab(index) {
        if (index < 0 || index >= this.tabs.length) return;

        this.activeTabIndex = index;
        this.updateTabMeshes();

        // Animate camera to tab
        this.animateCameraToTab(index);

        if (window.vrSpatialAudio) {
            window.vrSpatialAudio.playTabSwitch();
        }

        // Emit event
        this.dispatchEvent('tabSwitch', { index, tab: this.tabs[index] });
    }

    /**
     * Update tab meshes
     */
    updateTabMeshes() {
        // Clear existing meshes
        this.tabMeshes.forEach(mesh => {
            this.scene.remove(mesh);
        });
        this.tabMeshes = [];

        // Create meshes based on layout
        switch (this.layout) {
            case 'arc':
                this.createArcLayout();
                break;
            case 'stack':
                this.createStackLayout();
                break;
            case 'grid':
                this.createGridLayout();
                break;
            case 'cylinder':
                this.createCylinderLayout();
                break;
            default:
                this.createArcLayout();
        }
    }

    /**
     * Create arc layout
     */
    createArcLayout() {
        const count = this.tabs.length;
        const angleStep = Math.PI / Math.max(count, 3);
        const startAngle = -Math.PI / 2 + angleStep * (count - 1) / 2;

        this.tabs.forEach((tab, index) => {
            const angle = startAngle - angleStep * index;
            const x = Math.sin(angle) * this.arcRadius;
            const z = -Math.cos(angle) * this.arcRadius;
            const y = 1.6;

            const mesh = this.createTabMesh(tab, index);
            mesh.position.set(x, y, z);
            mesh.lookAt(0, y, 0);

            this.scene.add(mesh);
            this.tabMeshes.push(mesh);
        });
    }

    /**
     * Create stack layout
     */
    createStackLayout() {
        this.tabs.forEach((tab, index) => {
            const offset = (index - this.activeTabIndex) * 0.3;
            const x = offset;
            const y = 1.6 - Math.abs(offset) * 0.1;
            const z = -5 - Math.abs(offset) * 0.5;

            const mesh = this.createTabMesh(tab, index);
            mesh.position.set(x, y, z);

            const scale = 1 - Math.abs(offset) * 0.1;
            mesh.scale.setScalar(scale);

            this.scene.add(mesh);
            this.tabMeshes.push(mesh);
        });
    }

    /**
     * Create grid layout
     */
    createGridLayout() {
        const cols = Math.ceil(Math.sqrt(this.tabs.length));

        this.tabs.forEach((tab, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;

            const x = (col - cols / 2) * (this.tabWidth + this.spacing);
            const y = 1.6 - row * (this.tabHeight + this.spacing);
            const z = -8;

            const mesh = this.createTabMesh(tab, index);
            mesh.position.set(x, y, z);

            this.scene.add(mesh);
            this.tabMeshes.push(mesh);
        });
    }

    /**
     * Create cylinder layout
     */
    createCylinderLayout() {
        const count = this.tabs.length;
        const angleStep = (Math.PI * 2) / count;

        this.tabs.forEach((tab, index) => {
            const angle = angleStep * index;
            const x = Math.sin(angle) * this.arcRadius;
            const z = -Math.cos(angle) * this.arcRadius;
            const y = 1.6;

            const mesh = this.createTabMesh(tab, index);
            mesh.position.set(x, y, z);
            mesh.lookAt(0, y, 0);

            this.scene.add(mesh);
            this.tabMeshes.push(mesh);
        });
    }

    /**
     * Create individual tab mesh
     */
    createTabMesh(tab, index) {
        const group = new THREE.Group();
        group.userData = { tab, index };

        const isActive = index === this.activeTabIndex;

        // Tab card
        const cardGeometry = new THREE.PlaneGeometry(this.tabWidth, this.tabHeight);
        const cardMaterial = new THREE.MeshPhongMaterial({
            color: isActive ? 0x00ffff : 0x1a1a2e,
            transparent: true,
            opacity: isActive ? 1.0 : 0.7,
            side: THREE.DoubleSide,
            emissive: isActive ? 0x00ffff : 0x000000,
            emissiveIntensity: isActive ? 0.3 : 0
        });
        const card = new THREE.Mesh(cardGeometry, cardMaterial);
        group.add(card);

        // Border
        const borderGeometry = new THREE.EdgesGeometry(cardGeometry);
        const borderMaterial = new THREE.LineBasicMaterial({
            color: isActive ? 0x00ffff : 0x444444,
            linewidth: isActive ? 2 : 1
        });
        const border = new THREE.LineSegments(borderGeometry, borderMaterial);
        group.add(border);

        // Thumbnail placeholder
        if (tab.thumbnail) {
            // TODO: Load actual thumbnail texture
        } else {
            const thumbnailGeometry = new THREE.PlaneGeometry(2.5, 1.5);
            const thumbnailMaterial = new THREE.MeshBasicMaterial({
                color: 0x2a2a3e,
                transparent: true,
                opacity: 0.5
            });
            const thumbnail = new THREE.Mesh(thumbnailGeometry, thumbnailMaterial);
            thumbnail.position.set(0, 0.2, 0.01);
            group.add(thumbnail);
        }

        // Favicon
        const faviconSprite = this.createTextSprite(tab.favicon, 0.3);
        faviconSprite.position.set(-1.2, -0.6, 0.1);
        group.add(faviconSprite);

        // Title
        const titleSprite = this.createTextSprite(
            this.truncateText(tab.title, 20),
            0.15
        );
        titleSprite.position.set(0, -0.6, 0.1);
        group.add(titleSprite);

        // Close button
        const closeButton = this.createCloseButton();
        closeButton.position.set(1.3, 0.8, 0.1);
        closeButton.name = 'closeButton';
        group.add(closeButton);

        return group;
    }

    /**
     * Create text sprite
     */
    createTextSprite(text, size = 0.2) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 1024;
        canvas.height = 256;

        context.fillStyle = 'rgba(0, 0, 0, 0)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.font = 'Bold 64px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(size * 4, size, 1);

        return sprite;
    }

    /**
     * Create close button
     */
    createCloseButton() {
        const group = new THREE.Group();

        const circleGeometry = new THREE.CircleGeometry(0.15, 16);
        const circleMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.8
        });
        const circle = new THREE.Mesh(circleGeometry, circleMaterial);
        group.add(circle);

        const xSprite = this.createTextSprite('×', 0.2);
        xSprite.position.z = 0.01;
        group.add(xSprite);

        return group;
    }

    /**
     * Truncate text
     */
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    /**
     * Animate camera to tab
     */
    animateCameraToTab(index) {
        if (index < 0 || index >= this.tabMeshes.length) return;

        const tabMesh = this.tabMeshes[index];
        const tabPos = tabMesh.position;

        // Calculate camera position to view tab
        const direction = new THREE.Vector3().subVectors(
            new THREE.Vector3(0, 1.6, 0),
            tabPos
        ).normalize();

        this.targetPosition.copy(tabPos).add(
            direction.multiplyScalar(5)
        );
    }

    /**
     * Setup controls
     */
    setupControls() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const nextIndex = (this.activeTabIndex + 1) % this.tabs.length;
                    this.switchToTab(nextIndex);
                }
                if (e.key === 't') {
                    e.preventDefault();
                    this.createTab();
                }
                if (e.key === 'w') {
                    e.preventDefault();
                    this.closeTab(this.activeTabIndex);
                }
            }

            // Number keys for quick tab switch
            if (e.key >= '1' && e.key <= '9') {
                const index = parseInt(e.key) - 1;
                if (index < this.tabs.length) {
                    this.switchToTab(index);
                }
            }
        });
    }

    /**
     * Start render loop
     */
    startRenderLoop() {
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            this.render();
        };
        animate();
    }

    /**
     * Render scene
     */
    render() {
        const delta = this.clock.getDelta();

        // Smooth camera movement
        this.currentPosition.lerp(this.targetPosition, delta * 2);
        this.camera.position.copy(this.currentPosition);

        // Animate tabs
        this.tabMeshes.forEach((mesh, index) => {
            const isActive = index === this.activeTabIndex;

            // Pulse active tab
            if (isActive) {
                const pulse = Math.sin(Date.now() * 0.002) * 0.02 + 1;
                mesh.scale.setScalar(pulse);
            } else {
                mesh.scale.lerp(new THREE.Vector3(1, 1, 1), delta * 5);
            }

            // Gentle float
            mesh.position.y += Math.sin(Date.now() * 0.001 + index) * 0.0003;
        });

        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Handle window resize
     */
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    /**
     * Set layout
     */
    setLayout(layout) {
        this.layout = layout;
        this.updateTabMeshes();
    }

    /**
     * Dispatch custom event
     */
    dispatchEvent(eventName, data) {
        const event = new CustomEvent(`vr-tab-${eventName}`, { detail: data });
        window.dispatchEvent(event);
    }

    /**
     * Show tab manager
     */
    show() {
        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.style.display = 'block';
        }
        this.isActive = true;
    }

    /**
     * Hide tab manager
     */
    hide() {
        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.style.display = 'none';
        }
        this.isActive = false;
    }

    /**
     * Dispose and cleanup
     */
    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        this.tabMeshes.forEach(mesh => {
            this.scene.remove(mesh);
        });

        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }

        this.scene = null;
        this.camera = null;
        this.renderer = null;
    }
}

// Export for global access
if (typeof window !== 'undefined') {
    window.VRTabManager3D = VRTabManager3D;
}
