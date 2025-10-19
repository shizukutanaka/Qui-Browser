/**
 * VR Bookmark 3D Visualization
 * Display bookmarks in immersive 3D space
 * @version 2.0.0
 */

class VRBookmark3D {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.bookmarks = [];
        this.bookmarkMeshes = [];
        this.container = null;
        this.isActive = false;
        this.selectedBookmark = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Layout settings
        this.layout = 'grid'; // 'grid', 'sphere', 'wall', 'carousel'
        this.spacing = 2.5;
        this.radius = 5;
        this.itemsPerRow = 5;

        // Animation
        this.animationId = null;
        this.clock = new THREE.Clock();
    }

    /**
     * Initialize 3D bookmark system
     */
    async init(containerElement) {
        this.container = containerElement || document.body;

        // Create Three.js scene
        await this.setupScene();

        // Load bookmarks
        this.loadBookmarks();

        // Create bookmark visualizations
        this.createBookmarkMeshes();

        // Setup interaction
        this.setupInteraction();

        // Start render loop
        this.startRenderLoop();

        this.isActive = true;
        console.log('[VR Bookmark 3D] Initialized');

        return this;
    }

    /**
     * Setup Three.js scene
     */
    async setupScene() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 1.6, 5); // VR eye height

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.xr.enabled = true;

        this.container.appendChild(this.renderer.domElement);

        // Lighting
        this.setupLighting();

        // Environment
        this.createEnvironment();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    /**
     * Setup lighting
     */
    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        // Directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(5, 10, 5);
        this.scene.add(directionalLight);

        // Point lights for accent
        const pointLight1 = new THREE.PointLight(0x00ffff, 0.5, 10);
        pointLight1.position.set(-3, 2, 0);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0xff00ff, 0.5, 10);
        pointLight2.position.set(3, 2, 0);
        this.scene.add(pointLight2);
    }

    /**
     * Create environment
     */
    createEnvironment() {
        // Grid floor
        const gridHelper = new THREE.GridHelper(20, 20, 0x00ffff, 0x444444);
        gridHelper.position.y = -0.5;
        this.scene.add(gridHelper);

        // Background particles
        this.createParticles();
    }

    /**
     * Create particle background
     */
    createParticles() {
        const particleCount = 1000;
        const particles = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 50;
            positions[i + 1] = (Math.random() - 0.5) * 50;
            positions[i + 2] = (Math.random() - 0.5) * 50;
        }

        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const particleMaterial = new THREE.PointsMaterial({
            color: 0x00ffff,
            size: 0.05,
            transparent: true,
            opacity: 0.6
        });

        const particleSystem = new THREE.Points(particles, particleMaterial);
        this.scene.add(particleSystem);
    }

    /**
     * Load bookmarks from storage
     */
    loadBookmarks() {
        try {
            const saved = localStorage.getItem('vr-browser-bookmarks');
            if (saved) {
                this.bookmarks = JSON.parse(saved);
            } else {
                // Demo bookmarks
                this.bookmarks = [
                    { title: 'GitHub', url: 'https://github.com', favicon: '🐙' },
                    { title: 'YouTube', url: 'https://youtube.com', favicon: '▶️' },
                    { title: 'Wikipedia', url: 'https://wikipedia.org', favicon: '📚' },
                    { title: 'Reddit', url: 'https://reddit.com', favicon: '👽' },
                    { title: 'Twitter', url: 'https://twitter.com', favicon: '🐦' }
                ];
            }
        } catch (error) {
            console.error('[VR Bookmark 3D] Failed to load bookmarks:', error);
            this.bookmarks = [];
        }
    }

    /**
     * Create 3D bookmark meshes
     */
    createBookmarkMeshes() {
        // Clear existing meshes
        this.bookmarkMeshes.forEach(mesh => {
            this.scene.remove(mesh);
        });
        this.bookmarkMeshes = [];

        // Create meshes based on layout
        switch (this.layout) {
            case 'grid':
                this.createGridLayout();
                break;
            case 'sphere':
                this.createSphereLayout();
                break;
            case 'wall':
                this.createWallLayout();
                break;
            case 'carousel':
                this.createCarouselLayout();
                break;
            default:
                this.createGridLayout();
        }
    }

    /**
     * Create grid layout
     */
    createGridLayout() {
        this.bookmarks.forEach((bookmark, index) => {
            const row = Math.floor(index / this.itemsPerRow);
            const col = index % this.itemsPerRow;

            const x = (col - this.itemsPerRow / 2) * this.spacing;
            const y = 1.6 - row * this.spacing;
            const z = -5;

            const mesh = this.createBookmarkMesh(bookmark, index);
            mesh.position.set(x, y, z);

            this.scene.add(mesh);
            this.bookmarkMeshes.push(mesh);
        });
    }

    /**
     * Create sphere layout
     */
    createSphereLayout() {
        const count = this.bookmarks.length;
        const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

        this.bookmarks.forEach((bookmark, index) => {
            const y = 1 - (index / (count - 1)) * 2;
            const radiusAtY = Math.sqrt(1 - y * y);
            const theta = phi * index;

            const x = Math.cos(theta) * radiusAtY * this.radius;
            const z = Math.sin(theta) * radiusAtY * this.radius - 5;
            const yPos = y * this.radius + 1.6;

            const mesh = this.createBookmarkMesh(bookmark, index);
            mesh.position.set(x, yPos, z);
            mesh.lookAt(this.camera.position);

            this.scene.add(mesh);
            this.bookmarkMeshes.push(mesh);
        });
    }

    /**
     * Create wall layout
     */
    createWallLayout() {
        this.createGridLayout(); // Similar to grid but aligned to wall
    }

    /**
     * Create carousel layout
     */
    createCarouselLayout() {
        const count = this.bookmarks.length;
        const angleStep = (Math.PI * 2) / count;

        this.bookmarks.forEach((bookmark, index) => {
            const angle = angleStep * index;
            const x = Math.cos(angle) * this.radius;
            const z = Math.sin(angle) * this.radius - 5;
            const y = 1.6;

            const mesh = this.createBookmarkMesh(bookmark, index);
            mesh.position.set(x, y, z);
            mesh.lookAt(new THREE.Vector3(0, y, -5));

            this.scene.add(mesh);
            this.bookmarkMeshes.push(mesh);
        });
    }

    /**
     * Create individual bookmark mesh
     */
    createBookmarkMesh(bookmark, index) {
        // Create group for bookmark
        const group = new THREE.Group();
        group.userData = { bookmark, index };

        // Card background
        const cardGeometry = new THREE.PlaneGeometry(2, 1.5);
        const cardMaterial = new THREE.MeshPhongMaterial({
            color: 0x1a1a2e,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const card = new THREE.Mesh(cardGeometry, cardMaterial);
        group.add(card);

        // Border
        const borderGeometry = new THREE.EdgesGeometry(cardGeometry);
        const borderMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff });
        const border = new THREE.LineSegments(borderGeometry, borderMaterial);
        group.add(border);

        // Favicon (using text)
        const faviconSprite = this.createTextSprite(bookmark.favicon || '🔖', 0.5);
        faviconSprite.position.set(0, 0.3, 0.1);
        group.add(faviconSprite);

        // Title
        const titleSprite = this.createTextSprite(bookmark.title, 0.15);
        titleSprite.position.set(0, -0.2, 0.1);
        group.add(titleSprite);

        // URL
        const urlSprite = this.createTextSprite(this.shortenUrl(bookmark.url), 0.1);
        urlSprite.position.set(0, -0.5, 0.1);
        group.add(urlSprite);

        // Glow effect
        const glowGeometry = new THREE.PlaneGeometry(2.2, 1.7);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.z = -0.01;
        glow.name = 'glow';
        group.add(glow);

        return group;
    }

    /**
     * Create text sprite
     */
    createTextSprite(text, size = 0.2) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;

        context.fillStyle = 'rgba(255, 255, 255, 0)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.font = 'Bold 48px Arial';
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
     * Setup interaction
     */
    setupInteraction() {
        // Mouse move for raycasting
        this.renderer.domElement.addEventListener('mousemove', (e) => {
            this.onMouseMove(e);
        });

        // Click to open bookmark
        this.renderer.domElement.addEventListener('click', (e) => {
            this.onMouseClick(e);
        });
    }

    /**
     * Handle mouse move
     */
    onMouseMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.checkIntersections();
    }

    /**
     * Handle mouse click
     */
    onMouseClick(event) {
        if (this.selectedBookmark) {
            const bookmark = this.selectedBookmark.userData.bookmark;
            if (window.vrNavigation) {
                window.vrNavigation.navigateTo(bookmark.url);
                if (window.vrSpatialAudio) {
                    window.vrSpatialAudio.playNavigate(this.selectedBookmark.position);
                }
            }
        }
    }

    /**
     * Check raycaster intersections
     */
    checkIntersections() {
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObjects(this.bookmarkMeshes, true);

        // Reset all glows
        this.bookmarkMeshes.forEach(mesh => {
            const glow = mesh.getObjectByName('glow');
            if (glow) {
                glow.material.opacity = 0;
            }
        });

        this.selectedBookmark = null;

        if (intersects.length > 0) {
            const intersectedObject = intersects[0].object;
            let parent = intersectedObject;

            // Find parent group
            while (parent && !parent.userData.bookmark) {
                parent = parent.parent;
            }

            if (parent && parent.userData.bookmark) {
                this.selectedBookmark = parent;

                // Highlight
                const glow = parent.getObjectByName('glow');
                if (glow) {
                    glow.material.opacity = 0.3;
                }

                // Play hover sound
                if (window.vrSpatialAudio) {
                    window.vrSpatialAudio.playHover(parent.position);
                }

                // Change cursor
                this.renderer.domElement.style.cursor = 'pointer';
            }
        } else {
            this.renderer.domElement.style.cursor = 'default';
        }
    }

    /**
     * Shorten URL for display
     */
    shortenUrl(url, maxLength = 30) {
        if (url.length <= maxLength) return url;
        return url.substring(0, maxLength - 3) + '...';
    }

    /**
     * Change layout
     */
    setLayout(layout) {
        this.layout = layout;
        this.createBookmarkMeshes();

        if (window.vrSpatialAudio) {
            window.vrSpatialAudio.playMenuOpen();
        }
    }

    /**
     * Add bookmark
     */
    addBookmark(bookmark) {
        this.bookmarks.push(bookmark);
        this.saveBookmarks();
        this.createBookmarkMeshes();
    }

    /**
     * Remove bookmark
     */
    removeBookmark(index) {
        this.bookmarks.splice(index, 1);
        this.saveBookmarks();
        this.createBookmarkMeshes();
    }

    /**
     * Save bookmarks to storage
     */
    saveBookmarks() {
        try {
            localStorage.setItem('vr-browser-bookmarks', JSON.stringify(this.bookmarks));
        } catch (error) {
            console.error('[VR Bookmark 3D] Failed to save bookmarks:', error);
        }
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

        // Animate bookmarks
        this.bookmarkMeshes.forEach((mesh, index) => {
            // Gentle floating animation
            mesh.position.y += Math.sin(Date.now() * 0.001 + index) * 0.0005;

            // Gentle rotation
            mesh.rotation.y = Math.sin(Date.now() * 0.0005 + index * 0.5) * 0.05;
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
     * Show bookmark view
     */
    show() {
        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.style.display = 'block';
        }
        this.isActive = true;
    }

    /**
     * Hide bookmark view
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

        this.bookmarkMeshes.forEach(mesh => {
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
    window.VRBookmark3D = VRBookmark3D;
}
