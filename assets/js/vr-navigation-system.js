/**
 * VR Navigation System - Unified navigation management for VR browsing
 * Consolidates: vr-bookmark-3d.js, vr-navigation.js, vr-spatial-navigation.js, vr-tab-manager-3d.js
 * @version 3.2.0
 */

class VRNavigationSystem {
    constructor() {
        this.initialized = false;

        // Tab management
        this.tabs = new Map();
        this.activeTabId = null;
        this.maxTabs = 10;
        this.tabArrangement = 'carousel'; // 'carousel' | 'grid' | 'stack'

        // Bookmarks
        this.bookmarks = [];
        this.bookmarkGroups = new Map();
        this.bookmarkLayout = 'sphere'; // 'sphere' | 'grid' | 'wall' | 'carousel'

        // Spatial navigation
        this.navigationMode = 'teleport'; // 'teleport' | 'smooth' | 'snap'
        this.navigationMarker = null;
        this.validNavigationArea = null;

        // History
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 100;

        // 3D objects
        this.tabContainer = null;
        this.bookmarkContainer = null;
        this.navigationContainer = null;

        this.init();
    }

    init() {
        if (typeof THREE === 'undefined') {
            console.warn('VR Navigation System: THREE.js not loaded');
            window.addEventListener('three-loaded', () => this.init());
            return;
        }

        this.setupTabManager();
        this.setupBookmarkSystem();
        this.setupSpatialNavigation();
        this.loadSavedData();

        this.initialized = true;
        console.info('✅ VR Navigation System initialized');

        window.dispatchEvent(new CustomEvent('vr-navigation-ready'));
    }

    // ========== Tab Management ==========

    setupTabManager() {
        this.tabContainer = new THREE.Group();
        this.tabContainer.name = 'VR-Tab-Container';

        // Create initial tab
        this.createTab('about:blank', 'New Tab');
    }

    createTab(url, title = 'New Tab') {
        if (this.tabs.size >= this.maxTabs) {
            console.warn('Maximum tabs reached');
            return null;
        }

        const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const tab = {
            id: tabId,
            url: url,
            title: title,
            created: Date.now(),
            lastAccessed: Date.now(),
            thumbnail: null,
            mesh: null,
            iframe: null
        };

        // Create 3D representation
        tab.mesh = this.createTabMesh(tab);

        this.tabs.set(tabId, tab);

        // Update layout
        this.updateTabLayout();

        // Activate if first tab
        if (this.tabs.size === 1) {
            this.activateTab(tabId);
        }

        console.info(`Tab created: ${tabId} - ${title}`);

        return tabId;
    }

    createTabMesh(tab) {
        const width = 1.6; // 16:10 aspect ratio
        const height = 1.0;

        const group = new THREE.Group();
        group.name = `tab-${tab.id}`;

        // Tab background
        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            transparent: true,
            opacity: 0.95
        });

        const plane = new THREE.Mesh(geometry, material);
        group.add(plane);

        // Tab border
        const borderGeometry = new THREE.EdgesGeometry(geometry);
        const borderMaterial = new THREE.LineBasicMaterial({
            color: 0x4a9eff,
            linewidth: 2
        });
        const border = new THREE.LineSegments(borderGeometry, borderMaterial);
        group.add(border);

        // Tab title
        if (window.VRUISystem) {
            const titleText = window.VRUISystem.createCanvasText(tab.title, {
                fontSize: 32,
                color: '#ffffff',
                maxWidth: 512
            });

            titleText.mesh.position.set(0, height / 2 + 0.1, 0.01);
            titleText.mesh.scale.set(0.5, 0.5, 0.5);
            group.add(titleText.mesh);
        }

        // Tab close button
        const closeButton = this.createCloseButton();
        closeButton.position.set(width / 2 - 0.1, height / 2 - 0.1, 0.01);
        closeButton.userData = { tabId: tab.id, isCloseButton: true };
        group.add(closeButton);

        // Add to container
        this.tabContainer.add(group);

        return group;
    }

    createCloseButton() {
        const size = 0.08;
        const geometry = new THREE.CircleGeometry(size / 2, 16);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            transparent: true,
            opacity: 0.8
        });

        const button = new THREE.Mesh(geometry, material);

        // X mark
        const xGeometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            -size / 3, -size / 3, 0.01,
            size / 3, size / 3, 0.01,
            -size / 3, size / 3, 0.01,
            size / 3, -size / 3, 0.01
        ]);
        xGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

        const xMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
        const xMark = new THREE.LineSegments(xGeometry, xMaterial);
        button.add(xMark);

        return button;
    }

    updateTabLayout() {
        const tabs = Array.from(this.tabs.values());

        switch (this.tabArrangement) {
            case 'carousel':
                this.layoutTabsCarousel(tabs);
                break;
            case 'grid':
                this.layoutTabsGrid(tabs);
                break;
            case 'stack':
                this.layoutTabsStack(tabs);
                break;
        }
    }

    layoutTabsCarousel(tabs) {
        const radius = 3;
        const angleStep = Math.PI / Math.max(tabs.length, 3);

        tabs.forEach((tab, index) => {
            const angle = -Math.PI / 2 + angleStep * index;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            tab.mesh.position.set(x, 1.5, z);
            tab.mesh.lookAt(0, 1.5, 0);

            // Scale inactive tabs
            const scale = tab.id === this.activeTabId ? 1.0 : 0.8;
            tab.mesh.scale.set(scale, scale, scale);
        });
    }

    layoutTabsGrid(tabs) {
        const cols = Math.ceil(Math.sqrt(tabs.length));
        const spacing = 1.8;

        tabs.forEach((tab, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;

            const x = (col - cols / 2) * spacing;
            const y = 1.5 - row * spacing;
            const z = -3;

            tab.mesh.position.set(x, y, z);
            tab.mesh.rotation.set(0, 0, 0);

            const scale = tab.id === this.activeTabId ? 1.0 : 0.8;
            tab.mesh.scale.set(scale, scale, scale);
        });
    }

    layoutTabsStack(tabs) {
        tabs.forEach((tab, index) => {
            const offset = index * 0.05;
            tab.mesh.position.set(offset, 1.5, -2 - offset);
            tab.mesh.rotation.set(0, 0, 0);

            const scale = tab.id === this.activeTabId ? 1.0 : 0.8;
            tab.mesh.scale.set(scale, scale, scale);

            // Bring active tab to front
            if (tab.id === this.activeTabId) {
                tab.mesh.position.z = -1.5;
            }
        });
    }

    activateTab(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab) return;

        this.activeTabId = tabId;
        tab.lastAccessed = Date.now();

        // Update visual state
        this.updateTabLayout();

        // Load content
        this.loadTabContent(tabId);

        console.info(`Tab activated: ${tabId}`);
    }

    closeTab(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab) return;

        // Remove 3D mesh
        if (tab.mesh) {
            this.tabContainer.remove(tab.mesh);
            tab.mesh.children.forEach(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }

        this.tabs.delete(tabId);

        // Activate another tab if this was active
        if (this.activeTabId === tabId) {
            const remaining = Array.from(this.tabs.keys());
            if (remaining.length > 0) {
                this.activateTab(remaining[0]);
            } else {
                this.createTab('about:blank', 'New Tab');
            }
        }

        this.updateTabLayout();

        console.info(`Tab closed: ${tabId}`);
    }

    loadTabContent(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab) return;

        // Placeholder for content loading
        console.info(`Loading content for tab: ${tabId} - ${tab.url}`);

        // In real implementation, this would load the URL into an iframe or WebGL texture
    }

    // ========== Bookmark System ==========

    setupBookmarkSystem() {
        this.bookmarkContainer = new THREE.Group();
        this.bookmarkContainer.name = 'VR-Bookmark-Container';
        this.bookmarkContainer.visible = false;
    }

    addBookmark(url, title, tags = []) {
        const bookmark = {
            id: `bookmark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            url: url,
            title: title,
            tags: tags,
            created: Date.now(),
            lastAccessed: 0,
            thumbnail: null,
            mesh: null
        };

        this.bookmarks.push(bookmark);
        this.saveBookmarks();

        // Create 3D representation
        bookmark.mesh = this.createBookmarkMesh(bookmark);
        this.updateBookmarkLayout();

        console.info(`Bookmark added: ${title}`);

        return bookmark.id;
    }

    createBookmarkMesh(bookmark) {
        const size = 0.3;

        const group = new THREE.Group();
        group.name = `bookmark-${bookmark.id}`;

        // Bookmark icon (star shape)
        const starShape = new THREE.Shape();
        const points = 5;
        const outerRadius = size / 2;
        const innerRadius = size / 4;

        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / points;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            if (i === 0) {
                starShape.moveTo(x, y);
            } else {
                starShape.lineTo(x, y);
            }
        }
        starShape.closePath();

        const geometry = new THREE.ShapeGeometry(starShape);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0xffd700,
            emissiveIntensity: 0.3
        });

        const star = new THREE.Mesh(geometry, material);
        group.add(star);

        // Bookmark title
        if (window.VRUISystem) {
            const titleText = window.VRUISystem.createCanvasText(bookmark.title, {
                fontSize: 24,
                color: '#ffffff',
                maxWidth: 256
            });

            titleText.mesh.position.set(0, -size, 0);
            titleText.mesh.scale.set(0.3, 0.3, 0.3);
            group.add(titleText.mesh);
        }

        group.userData = { bookmarkId: bookmark.id };

        this.bookmarkContainer.add(group);

        return group;
    }

    updateBookmarkLayout() {
        switch (this.bookmarkLayout) {
            case 'sphere':
                this.layoutBookmarksSphere();
                break;
            case 'grid':
                this.layoutBookmarksGrid();
                break;
            case 'wall':
                this.layoutBookmarksWall();
                break;
            case 'carousel':
                this.layoutBookmarksCarousel();
                break;
        }
    }

    layoutBookmarksSphere() {
        const radius = 2;
        const count = this.bookmarks.length;

        // Fibonacci sphere distribution
        const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

        this.bookmarks.forEach((bookmark, index) => {
            const y = 1 - (index / (count - 1)) * 2;
            const radiusAtY = Math.sqrt(1 - y * y);

            const theta = phi * index;

            const x = Math.cos(theta) * radiusAtY * radius;
            const z = Math.sin(theta) * radiusAtY * radius;
            const yPos = y * radius + 1.5;

            bookmark.mesh.position.set(x, yPos, z);
            bookmark.mesh.lookAt(0, 1.5, 0);
        });
    }

    layoutBookmarksGrid() {
        const cols = Math.ceil(Math.sqrt(this.bookmarks.length));
        const spacing = 0.5;

        this.bookmarks.forEach((bookmark, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;

            const x = (col - cols / 2) * spacing;
            const y = 1.5 - row * spacing;
            const z = -2;

            bookmark.mesh.position.set(x, y, z);
            bookmark.mesh.rotation.set(0, 0, 0);
        });
    }

    layoutBookmarksWall() {
        const cols = 5;
        const spacing = 0.4;

        this.bookmarks.forEach((bookmark, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;

            const x = (col - cols / 2) * spacing;
            const y = 2.0 - row * spacing;
            const z = -1.5;

            bookmark.mesh.position.set(x, y, z);
            bookmark.mesh.rotation.set(0, 0, 0);
        });
    }

    layoutBookmarksCarousel() {
        const radius = 2.5;
        const count = this.bookmarks.length;
        const angleStep = (Math.PI * 2) / count;

        this.bookmarks.forEach((bookmark, index) => {
            const angle = angleStep * index;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            bookmark.mesh.position.set(x, 1.5, z);
            bookmark.mesh.lookAt(0, 1.5, 0);
        });
    }

    showBookmarks() {
        this.bookmarkContainer.visible = true;
        console.info('Bookmarks shown');
    }

    hideBookmarks() {
        this.bookmarkContainer.visible = false;
        console.info('Bookmarks hidden');
    }

    removeBookmark(bookmarkId) {
        const index = this.bookmarks.findIndex(b => b.id === bookmarkId);
        if (index === -1) return;

        const bookmark = this.bookmarks[index];

        // Remove mesh
        if (bookmark.mesh) {
            this.bookmarkContainer.remove(bookmark.mesh);
            bookmark.mesh.children.forEach(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }

        this.bookmarks.splice(index, 1);
        this.saveBookmarks();
        this.updateBookmarkLayout();

        console.info(`Bookmark removed: ${bookmarkId}`);
    }

    // ========== Spatial Navigation ==========

    setupSpatialNavigation() {
        this.navigationContainer = new THREE.Group();
        this.navigationContainer.name = 'VR-Navigation-Container';

        // Create teleport marker
        this.createTeleportMarker();
    }

    createTeleportMarker() {
        const geometry = new THREE.CylinderGeometry(0.3, 0.3, 0.05, 32);
        const material = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.7
        });

        this.navigationMarker = new THREE.Mesh(geometry, material);
        this.navigationMarker.visible = false;

        this.navigationContainer.add(this.navigationMarker);
    }

    showTeleportMarker(position) {
        if (!this.navigationMarker) return;

        this.navigationMarker.position.copy(position);
        this.navigationMarker.visible = true;
    }

    hideTeleportMarker() {
        if (this.navigationMarker) {
            this.navigationMarker.visible = false;
        }
    }

    teleportTo(position) {
        if (!this.isValidTeleportPosition(position)) {
            console.warn('Invalid teleport position');
            return false;
        }

        // In real implementation, this would move the camera/player
        console.info('Teleporting to:', position);

        this.hideTeleportMarker();
        return true;
    }

    isValidTeleportPosition(position) {
        // Check if position is within valid navigation area
        if (this.validNavigationArea) {
            // Implement boundary checking
        }

        // Check if not too close to walls or obstacles
        // This would require collision detection

        return true; // Simplified
    }

    // ========== History Management ==========

    addToHistory(url) {
        // Remove forward history if navigating from middle
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        this.history.push(url);
        this.historyIndex = this.history.length - 1;

        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.historyIndex--;
        }

        this.saveHistory();
    }

    navigateBack() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const url = this.history[this.historyIndex];
            console.info('Navigating back to:', url);
            return url;
        }
        return null;
    }

    navigateForward() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const url = this.history[this.historyIndex];
            console.info('Navigating forward to:', url);
            return url;
        }
        return null;
    }

    // ========== Data Persistence ==========

    saveBookmarks() {
        try {
            const data = this.bookmarks.map(b => ({
                id: b.id,
                url: b.url,
                title: b.title,
                tags: b.tags,
                created: b.created,
                lastAccessed: b.lastAccessed
            }));

            localStorage.setItem('vr-bookmarks', JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save bookmarks:', error);
        }
    }

    saveHistory() {
        try {
            const data = {
                history: this.history,
                index: this.historyIndex
            };

            localStorage.setItem('vr-history', JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save history:', error);
        }
    }

    loadSavedData() {
        // Load bookmarks
        try {
            const saved = localStorage.getItem('vr-bookmarks');
            if (saved) {
                const data = JSON.parse(saved);
                data.forEach(b => {
                    this.addBookmark(b.url, b.title, b.tags);
                });
            }
        } catch (error) {
            console.error('Failed to load bookmarks:', error);
        }

        // Load history
        try {
            const saved = localStorage.getItem('vr-history');
            if (saved) {
                const data = JSON.parse(saved);
                this.history = data.history || [];
                this.historyIndex = data.index || -1;
            }
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    }

    // ========== Cleanup ==========

    cleanup() {
        // Cleanup tabs
        this.tabs.forEach(tab => {
            if (tab.mesh) {
                tab.mesh.children.forEach(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
            }
        });
        this.tabs.clear();

        // Cleanup bookmarks
        this.bookmarks.forEach(bookmark => {
            if (bookmark.mesh) {
                bookmark.mesh.children.forEach(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
            }
        });
        this.bookmarks = [];

        console.info('VR Navigation System cleaned up');
    }
}

// Initialize and export
window.VRNavigationSystem = new VRNavigationSystem();

console.log('✅ VR Navigation System loaded');