/**
 * VR Content Optimizer
 * Optimize 360° video, images, and WebXR content for VR
 * @version 2.0.0
 */

class VRContentOptimizer {
    constructor() {
        // Optimization settings
        this.settings = {
            video: {
                maxResolution: 4096, // 4K
                preferredFormat: 'h264',
                bufferSize: 30, // seconds
                adaptiveBitrate: true,
                spatialAudio: true
            },
            image: {
                maxResolution: 8192, // 8K for 360 images
                compression: 0.85,
                progressiveLoad: true,
                mipmaps: true
            },
            webxr: {
                refreshRate: 90, // Hz
                foveatedRendering: true,
                dynamicResolution: true,
                antialiasing: 'msaa-4x'
            },
            performance: {
                targetFPS: 90,
                minFPS: 72,
                gpuBudget: 11, // ms (for 90fps)
                memoryLimit: 2048 // MB
            }
        };

        // Content types
        this.contentTypes = {
            VIDEO_360: 'video-360',
            VIDEO_180: 'video-180',
            IMAGE_360: 'image-360',
            IMAGE_EQUIRECTANGULAR: 'image-equirect',
            WEBXR_SCENE: 'webxr-scene',
            STANDARD: 'standard'
        };

        // Active optimizations
        this.activeOptimizations = new Map();

        // Performance monitoring
        this.performanceData = {
            fps: 90,
            frameTime: 11.1,
            gpuTime: 0,
            memoryUsage: 0,
            drawCalls: 0,
            triangles: 0
        };

        // Cache
        this.textureCache = new Map();
        this.maxCacheSize = 512; // MB
    }

    /**
     * Initialize content optimizer
     */
    init() {
        this.setupPerformanceMonitoring();
        console.log('[VR Content Optimizer] Initialized');
        return this;
    }

    /**
     * Detect content type
     * @param {HTMLElement|string} content - Content element or URL
     * @returns {string} Content type
     */
    detectContentType(content) {
        if (typeof content === 'string') {
            // URL-based detection
            if (content.includes('360') || content.includes('equirectangular')) {
                return this.contentTypes.VIDEO_360;
            }
            if (content.includes('180')) {
                return this.contentTypes.VIDEO_180;
            }
        } else if (content instanceof HTMLVideoElement) {
            // Check video metadata
            const width = content.videoWidth;
            const height = content.videoHeight;

            if (width / height >= 1.9) {
                return this.contentTypes.VIDEO_360;
            } else if (width / height >= 1.4) {
                return this.contentTypes.VIDEO_180;
            }
        } else if (content instanceof HTMLImageElement) {
            const width = content.naturalWidth;
            const height = content.naturalHeight;

            if (width / height >= 1.9) {
                return this.contentTypes.IMAGE_360;
            }
        }

        return this.contentTypes.STANDARD;
    }

    /**
     * Optimize 360° video
     * @param {HTMLVideoElement} video - Video element
     * @param {Object} options - Optimization options
     * @returns {Object} Optimized configuration
     */
    optimizeVideo360(video, options = {}) {
        const config = { ...this.settings.video, ...options };

        // Set video attributes for VR
        video.crossOrigin = 'anonymous';
        video.playsInline = true;
        video.loop = options.loop !== false;

        // Optimize resolution
        if (video.videoWidth > config.maxResolution) {
            console.warn('[VR Optimizer] Video resolution exceeds maximum, may impact performance');
        }

        // Setup adaptive bitrate if available
        if (config.adaptiveBitrate && video.textTracks) {
            this.setupAdaptiveBitrate(video);
        }

        // Setup spatial audio
        if (config.spatialAudio) {
            this.setupSpatialAudio(video);
        }

        // Monitor performance
        const optimizationId = `video_${Date.now()}`;
        this.activeOptimizations.set(optimizationId, {
            type: 'video-360',
            element: video,
            startTime: Date.now()
        });

        return {
            id: optimizationId,
            type: this.contentTypes.VIDEO_360,
            resolution: { width: video.videoWidth, height: video.videoHeight },
            optimizations: ['resolution', 'spatial-audio', 'adaptive-bitrate']
        };
    }

    /**
     * Optimize 360° image
     * @param {HTMLImageElement|string} image - Image element or URL
     * @param {Object} options - Optimization options
     * @returns {Promise<THREE.Texture>}
     */
    async optimizeImage360(image, options = {}) {
        const config = { ...this.settings.image, ...options };

        // Load image if URL provided
        let imgElement = image;
        if (typeof image === 'string') {
            imgElement = await this.loadImage(image);
        }

        // Check cache
        const cacheKey = typeof image === 'string' ? image : imgElement.src;
        if (this.textureCache.has(cacheKey)) {
            console.log('[VR Optimizer] Using cached texture');
            return this.textureCache.get(cacheKey);
        }

        // Create texture
        const texture = new THREE.Texture(imgElement);
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.format = THREE.RGBFormat;

        // Generate mipmaps for better performance
        if (config.mipmaps) {
            texture.generateMipmaps = true;
        }

        // Progressive enhancement
        if (config.progressiveLoad) {
            this.setupProgressiveLoad(texture, imgElement);
        }

        texture.needsUpdate = true;

        // Cache texture
        this.cacheTexture(cacheKey, texture);

        return texture;
    }

    /**
     * Optimize WebXR scene
     * @param {THREE.Scene} scene - Three.js scene
     * @param {Object} options - Optimization options
     * @returns {Object} Optimization report
     */
    optimizeWebXRScene(scene, options = {}) {
        const config = { ...this.settings.webxr, ...options };
        const optimizations = [];

        // Optimize materials
        scene.traverse(object => {
            if (object.isMesh && object.material) {
                this.optimizeMaterial(object.material);
                optimizations.push('material-optimization');
            }
        });

        // Optimize geometry
        scene.traverse(object => {
            if (object.geometry) {
                this.optimizeGeometry(object.geometry);
                optimizations.push('geometry-optimization');
            }
        });

        // Enable frustum culling
        scene.traverse(object => {
            object.frustumCulled = true;
        });
        optimizations.push('frustum-culling');

        // Setup LOD if needed
        if (config.dynamicResolution) {
            this.setupLOD(scene);
            optimizations.push('lod-system');
        }

        return {
            type: this.contentTypes.WEBXR_SCENE,
            optimizations: [...new Set(optimizations)],
            objectCount: this.countObjects(scene),
            triangleCount: this.countTriangles(scene)
        };
    }

    /**
     * Setup adaptive bitrate for video
     * @param {HTMLVideoElement} video - Video element
     */
    setupAdaptiveBitrate(video) {
        // Monitor network and adjust quality
        if ('connection' in navigator) {
            const connection = navigator.connection;

            const adjustQuality = () => {
                const effectiveType = connection.effectiveType;

                if (effectiveType === '4g') {
                    // High quality
                    console.log('[VR Optimizer] Network: 4G - High quality');
                } else if (effectiveType === '3g') {
                    // Medium quality
                    console.log('[VR Optimizer] Network: 3G - Medium quality');
                } else {
                    // Low quality
                    console.log('[VR Optimizer] Network: Slow - Low quality');
                }
            };

            connection.addEventListener('change', adjustQuality);
            adjustQuality();
        }
    }

    /**
     * Setup spatial audio for video
     * @param {HTMLVideoElement} video - Video element
     */
    setupSpatialAudio(video) {
        if (!window.vrSpatialAudio || !video) return;

        const audioContext = window.vrSpatialAudio.audioContext;
        if (!audioContext) return;

        try {
            const source = audioContext.createMediaElementSource(video);
            const panner = audioContext.createPanner();

            panner.panningModel = 'HRTF';
            panner.distanceModel = 'inverse';

            source.connect(panner);
            panner.connect(audioContext.destination);

            console.log('[VR Optimizer] Spatial audio enabled');
        } catch (error) {
            console.warn('[VR Optimizer] Failed to setup spatial audio:', error);
        }
    }

    /**
     * Setup progressive image loading
     * @param {THREE.Texture} texture - Texture
     * @param {HTMLImageElement} image - Image element
     */
    setupProgressiveLoad(texture, image) {
        // Load low-res version first
        const lowResUrl = this.generateLowResUrl(image.src);

        if (lowResUrl) {
            const lowResImage = new Image();
            lowResImage.crossOrigin = 'anonymous';
            lowResImage.onload = () => {
                texture.image = lowResImage;
                texture.needsUpdate = true;

                // Then load full resolution
                setTimeout(() => {
                    texture.image = image;
                    texture.needsUpdate = true;
                }, 100);
            };
            lowResImage.src = lowResUrl;
        }
    }

    /**
     * Generate low-resolution URL
     * @param {string} url - Original URL
     * @returns {string|null} Low-res URL
     */
    generateLowResUrl(url) {
        // This would connect to an image resizing service
        // For now, return null
        return null;
    }

    /**
     * Optimize material
     * @param {THREE.Material} material - Material to optimize
     */
    optimizeMaterial(material) {
        // Reduce texture size if too large
        if (material.map && material.map.image) {
            const img = material.map.image;
            if (img.width > 2048 || img.height > 2048) {
                material.map.minFilter = THREE.LinearMipmapLinearFilter;
                material.map.generateMipmaps = true;
            }
        }

        // Disable unnecessary features
        if (!material.transparent) {
            material.depthWrite = true;
            material.alphaTest = 0;
        }

        material.needsUpdate = true;
    }

    /**
     * Optimize geometry
     * @param {THREE.BufferGeometry} geometry - Geometry to optimize
     */
    optimizeGeometry(geometry) {
        // Compute bounding sphere for frustum culling
        if (!geometry.boundingSphere) {
            geometry.computeBoundingSphere();
        }

        // Merge vertices if possible
        if (geometry.attributes.position && !geometry.index) {
            // Could implement vertex merging here
        }
    }

    /**
     * Setup LOD (Level of Detail) system
     * @param {THREE.Scene} scene - Scene
     */
    setupLOD(scene) {
        // Find meshes that could benefit from LOD
        scene.traverse(object => {
            if (object.isMesh && !object.isLOD) {
                const triangles = this.countTrianglesForObject(object);

                if (triangles > 10000) {
                    // Create LOD versions
                    const lod = new THREE.LOD();
                    lod.addLevel(object, 0);
                    // Would add lower detail versions here

                    if (object.parent) {
                        object.parent.add(lod);
                        object.parent.remove(object);
                    }
                }
            }
        });
    }

    /**
     * Load image
     * @param {string} url - Image URL
     * @returns {Promise<HTMLImageElement>}
     */
    loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    /**
     * Cache texture
     * @param {string} key - Cache key
     * @param {THREE.Texture} texture - Texture
     */
    cacheTexture(key, texture) {
        // Check cache size
        const currentSize = this.calculateCacheSize();
        if (currentSize > this.maxCacheSize) {
            this.clearOldestCache();
        }

        this.textureCache.set(key, texture);
    }

    /**
     * Calculate cache size in MB
     * @returns {number} Size in MB
     */
    calculateCacheSize() {
        let totalSize = 0;

        this.textureCache.forEach(texture => {
            if (texture.image) {
                const width = texture.image.width || 1024;
                const height = texture.image.height || 1024;
                const bytes = width * height * 4; // RGBA
                totalSize += bytes / (1024 * 1024); // Convert to MB
            }
        });

        return totalSize;
    }

    /**
     * Clear oldest cache entry
     */
    clearOldestCache() {
        const firstKey = this.textureCache.keys().next().value;
        if (firstKey) {
            const texture = this.textureCache.get(firstKey);
            if (texture) {
                texture.dispose();
            }
            this.textureCache.delete(firstKey);
        }
    }

    /**
     * Count objects in scene
     * @param {THREE.Scene} scene - Scene
     * @returns {number} Object count
     */
    countObjects(scene) {
        let count = 0;
        scene.traverse(() => count++);
        return count;
    }

    /**
     * Count triangles in scene
     * @param {THREE.Scene} scene - Scene
     * @returns {number} Triangle count
     */
    countTriangles(scene) {
        let triangles = 0;
        scene.traverse(object => {
            triangles += this.countTrianglesForObject(object);
        });
        return triangles;
    }

    /**
     * Count triangles for object
     * @param {THREE.Object3D} object - Object
     * @returns {number} Triangle count
     */
    countTrianglesForObject(object) {
        if (object.geometry) {
            if (object.geometry.index) {
                return object.geometry.index.count / 3;
            } else if (object.geometry.attributes.position) {
                return object.geometry.attributes.position.count / 3;
            }
        }
        return 0;
    }

    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        setInterval(() => {
            this.updatePerformanceData();
            this.checkPerformance();
        }, 1000);
    }

    /**
     * Update performance data
     */
    updatePerformanceData() {
        // Would integrate with actual WebXR performance APIs
        if (performance.memory) {
            this.performanceData.memoryUsage =
                performance.memory.usedJSHeapSize / (1024 * 1024);
        }
    }

    /**
     * Check performance and adjust settings
     */
    checkPerformance() {
        const fps = this.performanceData.fps;

        if (fps < this.settings.performance.minFPS) {
            console.warn('[VR Optimizer] Low FPS detected, reducing quality');
            this.reduceQuality();
        } else if (fps > this.settings.performance.targetFPS * 1.1) {
            console.log('[VR Optimizer] High FPS, increasing quality');
            this.increaseQuality();
        }
    }

    /**
     * Reduce rendering quality
     */
    reduceQuality() {
        // Reduce texture resolution
        this.textureCache.forEach(texture => {
            if (texture.minFilter !== THREE.NearestFilter) {
                texture.minFilter = THREE.NearestFilter;
                texture.needsUpdate = true;
            }
        });

        console.log('[VR Optimizer] Quality reduced');
    }

    /**
     * Increase rendering quality
     */
    increaseQuality() {
        // Increase texture resolution
        this.textureCache.forEach(texture => {
            if (texture.minFilter !== THREE.LinearMipmapLinearFilter) {
                texture.minFilter = THREE.LinearMipmapLinearFilter;
                texture.needsUpdate = true;
            }
        });

        console.log('[VR Optimizer] Quality increased');
    }

    /**
     * Get optimization report
     * @returns {Object} Report
     */
    getOptimizationReport() {
        return {
            activeOptimizations: this.activeOptimizations.size,
            cacheSize: this.calculateCacheSize(),
            performance: { ...this.performanceData },
            settings: { ...this.settings }
        };
    }

    /**
     * Dispose and cleanup
     */
    dispose() {
        // Clear cache
        this.textureCache.forEach(texture => texture.dispose());
        this.textureCache.clear();

        this.activeOptimizations.clear();
    }
}

// Export for global access
if (typeof window !== 'undefined') {
    window.VRContentOptimizer = VRContentOptimizer;
}
