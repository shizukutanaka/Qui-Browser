/**
 * QuiBrowserSDK - WebXR Development SDK
 *
 * Simplify WebXR development with pre-built components and utilities.
 * Makes building VR experiences as easy as traditional web development.
 *
 * Features:
 * - One-line VR initialization
 * - Pre-built 3D UI components
 * - Content components (360° video, image gallery, web pages)
 * - Interaction systems (hand tracking, voice, gaze)
 * - Developer tools (profiler, debugger, scene inspector)
 * - Full integration with Qui Browser features
 *
 * Research-driven design based on:
 * - Immersive Web SDK best practices
 * - A-Frame component architecture
 * - Three.js ecosystem patterns
 * - Meta Interaction SDK
 *
 * @version 3.8.0
 * @author Qui Browser Team
 * @license MIT
 */

class QuiBrowserSDK {
  constructor() {
    this.version = '3.8.0';
    this.initialized = false;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.xrSession = null;
    this.components = new Map();
    this.devTools = null;

    console.log('[QuiBrowserSDK] SDK loaded, version:', this.version);
  }

  /**
   * Initialize WebXR with one line of code
   *
   * @param {Object} options - Configuration options
   * @returns {Promise<Object>} Initialized scene, camera, renderer
   *
   * @example
   * const { scene, camera, renderer } = await SDK.initVR({
   *   enableHandTracking: true,
   *   enableVoiceCommands: true,
   *   environment: 'space'
   * });
   */
  async initVR(options = {}) {
    const config = {
      // Display
      canvas: options.canvas || document.getElementById('vr-canvas'),
      antialias: options.antialias !== false,

      // Features
      enableHandTracking: options.enableHandTracking !== false,
      enableVoiceCommands: options.enableVoiceCommands !== false,
      enableGazeTracking: options.enableGazeTracking !== false,

      // Performance
      useWebGPU: options.useWebGPU !== false,
      useFoveatedRendering: options.useFoveatedRendering !== false,
      fpsTarget: options.fpsTarget || 90,

      // Accessibility
      enableAccessibility: options.enableAccessibility !== false,
      wcagLevel: options.wcagLevel || 'AAA',

      // Internationalization
      language: options.language || 'en',
      enableI18n: options.enableI18n !== false,

      // Environment
      environment: options.environment || 'space',
      skybox: options.skybox,

      // Memory
      memoryLimit: options.memoryLimit || 2048,
      enableMemoryManager: options.enableMemoryManager !== false,

      // Security
      enableSecurity: options.enableSecurity !== false,
      cspLevel: options.cspLevel || 3,
      gdprCompliant: options.gdprCompliant !== false
    };

    console.log('[QuiBrowserSDK] Initializing VR with config:', config);

    try {
      // Check WebXR support
      if (!navigator.xr) {
        throw new Error('WebXR not supported in this browser');
      }

      // Create scene
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x000000);

      // Create camera
      this.camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      this.camera.position.set(0, 1.6, 0); // Eye level

      // Create renderer
      if (config.useWebGPU && window.VRWebGPURenderer) {
        this.renderer = new VRWebGPURenderer();
        await this.renderer.initialize(config.canvas);
        console.log('[QuiBrowserSDK] WebGPU renderer initialized');
      } else {
        this.renderer = new THREE.WebGLRenderer({
          canvas: config.canvas,
          antialias: config.antialias,
          powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.xr.enabled = true;
        console.log('[QuiBrowserSDK] WebGL renderer initialized');
      }

      // Initialize VR session
      const sessionInit = {
        requiredFeatures: ['local-floor'],
        optionalFeatures: []
      };

      if (config.enableHandTracking) {
        sessionInit.optionalFeatures.push('hand-tracking');
      }

      if (config.enableGazeTracking) {
        sessionInit.optionalFeatures.push('eye-tracking');
      }

      // Request VR session
      this.xrSession = await navigator.xr.requestSession('immersive-vr', sessionInit);
      await this.renderer.xr.setSession(this.xrSession);
      console.log('[QuiBrowserSDK] VR session started');

      // Initialize foveated rendering
      if (config.useFoveatedRendering && window.VRFoveatedRenderingSystem) {
        this.foveatedRendering = new VRFoveatedRenderingSystem();
        await this.foveatedRendering.initialize(this.xrSession);
        console.log('[QuiBrowserSDK] Foveated rendering initialized');
      }

      // Initialize memory manager
      if (config.enableMemoryManager && window.VRMemoryManager) {
        this.memoryManager = new VRMemoryManager({
          maxMemoryMB: config.memoryLimit,
          aggressiveCleanup: true
        });
        await this.memoryManager.initialize();
        console.log('[QuiBrowserSDK] Memory manager initialized');
      }

      // Initialize accessibility
      if (config.enableAccessibility && window.VRAccessibilityWCAG) {
        this.accessibility = new VRAccessibilityWCAG({
          wcagLevel: config.wcagLevel
        });
        await this.accessibility.initialize();
        console.log('[QuiBrowserSDK] Accessibility initialized');
      }

      // Initialize i18n
      if (config.enableI18n && window.VRI18nSystem) {
        this.i18n = new VRI18nSystem();
        await this.i18n.initialize();
        await this.i18n.setLanguage(config.language);
        console.log('[QuiBrowserSDK] I18n initialized');
      }

      // Initialize security
      if (config.enableSecurity && window.VRSecurityManager) {
        this.security = new VRSecurityManager({
          cspLevel: config.cspLevel,
          gdprCompliant: config.gdprCompliant
        });
        await this.security.initialize();
        console.log('[QuiBrowserSDK] Security initialized');
      }

      // Load environment
      if (config.environment) {
        await this.loadEnvironment(config.environment, config.skybox);
      }

      // Add lighting
      this.addDefaultLighting();

      // Handle window resize
      window.addEventListener('resize', () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      });

      this.initialized = true;
      console.log('[QuiBrowserSDK] VR initialization complete');

      return {
        scene: this.scene,
        camera: this.camera,
        renderer: this.renderer,
        session: this.xrSession,
        sdk: this
      };

    } catch (error) {
      console.error('[QuiBrowserSDK] VR initialization failed:', error);
      throw error;
    }
  }

  /**
   * Load environment preset
   */
  async loadEnvironment(preset, customSkybox) {
    console.log('[QuiBrowserSDK] Loading environment:', preset);

    if (customSkybox) {
      // Load custom skybox
      const loader = new THREE.TextureLoader();
      const texture = await loader.loadAsync(customSkybox);
      this.scene.background = texture;
      return;
    }

    // Load preset environment
    switch (preset) {
      case 'space':
        this.scene.background = new THREE.Color(0x000011);
        this.addStars();
        break;

      case 'office':
        this.scene.background = new THREE.Color(0xcccccc);
        this.addOfficeEnvironment();
        break;

      case 'nature':
        this.scene.background = new THREE.Color(0x87ceeb);
        this.addNatureEnvironment();
        break;

      case 'minimal':
        this.scene.background = new THREE.Color(0x222222);
        break;

      default:
        this.scene.background = new THREE.Color(0x000000);
    }
  }

  /**
   * Add default lighting
   */
  addDefaultLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    this.scene.add(directionalLight);

    // Hemisphere light
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
    this.scene.add(hemisphereLight);
  }

  /**
   * Add stars to space environment
   */
  addStars() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.02,
      sizeAttenuation: true
    });

    const starsVertices = [];
    for (let i = 0; i < 10000; i++) {
      const x = (Math.random() - 0.5) * 2000;
      const y = (Math.random() - 0.5) * 2000;
      const z = (Math.random() - 0.5) * 2000;
      starsVertices.push(x, y, z);
    }

    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    this.scene.add(stars);
  }

  /**
   * Add office environment
   */
  addOfficeEnvironment() {
    // Floor
    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.8,
      metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Desk
    const deskGeometry = new THREE.BoxGeometry(2, 0.1, 1);
    const deskMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const desk = new THREE.Mesh(deskGeometry, deskMaterial);
    desk.position.set(0, 0.75, -1.5);
    this.scene.add(desk);
  }

  /**
   * Add nature environment
   */
  addNatureEnvironment() {
    // Ground
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x228b22,
      roughness: 0.9
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    // Trees (simple cylinders + cones)
    for (let i = 0; i < 20; i++) {
      const x = (Math.random() - 0.5) * 50;
      const z = (Math.random() - 0.5) * 50;
      if (Math.abs(x) < 5 && Math.abs(z) < 5) continue; // Keep center clear

      const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
      const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.set(x, 1, z);

      const leavesGeometry = new THREE.ConeGeometry(1, 2, 8);
      const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 });
      const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
      leaves.position.set(x, 3, z);

      this.scene.add(trunk);
      this.scene.add(leaves);
    }
  }

  /**
   * Start animation loop
   */
  startAnimationLoop(callback) {
    if (!this.initialized) {
      console.error('[QuiBrowserSDK] SDK not initialized. Call initVR() first.');
      return;
    }

    this.renderer.setAnimationLoop((time, frame) => {
      // Update foveated rendering
      if (this.foveatedRendering && frame) {
        this.foveatedRendering.update(frame);
      }

      // Update memory manager
      if (this.memoryManager) {
        this.memoryManager.update();
      }

      // User callback
      if (callback) {
        callback(time, frame);
      }

      // Render scene
      this.renderer.render(this.scene, this.camera);
    });

    console.log('[QuiBrowserSDK] Animation loop started');
  }

  /**
   * Stop animation loop
   */
  stopAnimationLoop() {
    this.renderer.setAnimationLoop(null);
    console.log('[QuiBrowserSDK] Animation loop stopped');
  }

  /**
   * End VR session
   */
  async endVR() {
    if (this.xrSession) {
      await this.xrSession.end();
      this.xrSession = null;
      console.log('[QuiBrowserSDK] VR session ended');
    }
  }

  /**
   * Create 3D button component
   */
  createButton3D(options = {}) {
    const config = {
      text: options.text || 'Button',
      width: options.width || 0.4,
      height: options.height || 0.1,
      depth: options.depth || 0.02,
      position: options.position || { x: 0, y: 1.5, z: -1 },
      color: options.color || 0x0052cc,
      hoverColor: options.hoverColor || 0x0066ff,
      textColor: options.textColor || 0xffffff,
      fontSize: options.fontSize || 0.06,
      onClick: options.onClick || null,
      onHover: options.onHover || null
    };

    const button = new THREE.Group();

    // Button background
    const geometry = new THREE.BoxGeometry(config.width, config.height, config.depth);
    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.7,
      metalness: 0.3
    });
    const mesh = new THREE.Mesh(geometry, material);
    button.add(mesh);

    // Button text
    if (window.VRTextRenderer) {
      const textRenderer = new VRTextRenderer();
      const textMesh = textRenderer.createText({
        text: config.text,
        fontSize: config.fontSize,
        color: config.textColor,
        maxWidth: config.width * 0.9
      });
      textMesh.position.z = config.depth / 2 + 0.001;
      button.add(textMesh);
    }

    // Position
    button.position.set(config.position.x, config.position.y, config.position.z);

    // Interaction
    button.userData.interactive = true;
    button.userData.originalColor = config.color;
    button.userData.hoverColor = config.hoverColor;
    button.userData.onClick = config.onClick;
    button.userData.onHover = config.onHover;

    // Add to scene
    if (this.scene) {
      this.scene.add(button);
    }

    console.log('[QuiBrowserSDK] Button3D created:', config.text);
    return button;
  }

  /**
   * Create 3D panel component
   */
  createPanel3D(options = {}) {
    const config = {
      width: options.width || 1.0,
      height: options.height || 0.6,
      position: options.position || { x: 0, y: 1.5, z: -1.5 },
      color: options.color || 0x222222,
      opacity: options.opacity || 0.9,
      borderRadius: options.borderRadius || 0.02,
      title: options.title || null,
      content: options.content || []
    };

    const panel = new THREE.Group();

    // Panel background
    const geometry = new THREE.PlaneGeometry(config.width, config.height);
    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      transparent: true,
      opacity: config.opacity,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    panel.add(mesh);

    // Panel border
    const borderGeometry = new THREE.EdgesGeometry(geometry);
    const borderMaterial = new THREE.LineBasicMaterial({ color: 0x0052cc });
    const border = new THREE.LineSegments(borderGeometry, borderMaterial);
    panel.add(border);

    // Title
    if (config.title && window.VRTextRenderer) {
      const textRenderer = new VRTextRenderer();
      const titleMesh = textRenderer.createText({
        text: config.title,
        fontSize: 0.08,
        color: 0xffffff,
        maxWidth: config.width * 0.9
      });
      titleMesh.position.set(0, config.height / 2 - 0.1, 0.001);
      panel.add(titleMesh);
    }

    // Content
    if (config.content.length > 0 && window.VRTextRenderer) {
      const textRenderer = new VRTextRenderer();
      let yOffset = config.height / 2 - 0.25;

      config.content.forEach((text, index) => {
        const contentMesh = textRenderer.createText({
          text: text,
          fontSize: 0.05,
          color: 0xcccccc,
          maxWidth: config.width * 0.9
        });
        contentMesh.position.set(0, yOffset, 0.001);
        panel.add(contentMesh);
        yOffset -= 0.08;
      });
    }

    // Position
    panel.position.set(config.position.x, config.position.y, config.position.z);

    // Add to scene
    if (this.scene) {
      this.scene.add(panel);
    }

    console.log('[QuiBrowserSDK] Panel3D created');
    return panel;
  }

  /**
   * Create 360° video player
   */
  createVideoPlayer360(options = {}) {
    const config = {
      videoUrl: options.videoUrl,
      videoElement: options.videoElement,
      radius: options.radius || 500,
      resolution: options.resolution || { width: 4096, height: 2048 },
      autoplay: options.autoplay !== false,
      loop: options.loop !== false,
      controls: options.controls !== false,
      stereoMode: options.stereoMode || 'mono' // mono, top-bottom, side-by-side
    };

    const player = new THREE.Group();

    // Create video element
    let video;
    if (config.videoElement) {
      video = config.videoElement;
    } else if (config.videoUrl) {
      video = document.createElement('video');
      video.src = config.videoUrl;
      video.crossOrigin = 'anonymous';
      video.loop = config.loop;
      video.muted = true; // Required for autoplay
      if (config.autoplay) {
        video.play().catch(e => console.warn('[QuiBrowserSDK] Autoplay prevented:', e));
      }
    } else {
      console.error('[QuiBrowserSDK] No video source provided');
      return null;
    }

    // Create video texture
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBAFormat;

    // Create sphere geometry
    const geometry = new THREE.SphereGeometry(config.radius, 60, 40);
    geometry.scale(-1, 1, 1); // Invert for inside viewing

    // Create material
    const material = new THREE.MeshBasicMaterial({
      map: videoTexture,
      side: THREE.DoubleSide
    });

    // Handle stereo modes
    if (config.stereoMode === 'top-bottom') {
      // Top half for left eye, bottom half for right eye
      material.map.repeat.set(1, 0.5);
      material.map.offset.set(0, 0.5);
    } else if (config.stereoMode === 'side-by-side') {
      // Left half for left eye, right half for right eye
      material.map.repeat.set(0.5, 1);
      material.map.offset.set(0, 0);
    }

    const sphere = new THREE.Mesh(geometry, material);
    player.add(sphere);

    // Controls
    if (config.controls) {
      const controlPanel = this.createPanel3D({
        width: 0.6,
        height: 0.2,
        position: { x: 0, y: 1.2, z: -1.5 },
        title: 'Video Controls'
      });

      const playButton = this.createButton3D({
        text: 'Play/Pause',
        position: { x: -0.25, y: 1.15, z: -1.5 },
        onClick: () => {
          if (video.paused) {
            video.play();
          } else {
            video.pause();
          }
        }
      });

      const resetButton = this.createButton3D({
        text: 'Reset',
        position: { x: 0.25, y: 1.15, z: -1.5 },
        onClick: () => {
          video.currentTime = 0;
        }
      });

      player.add(controlPanel);
      player.add(playButton);
      player.add(resetButton);
    }

    // Store video reference
    player.userData.video = video;
    player.userData.videoTexture = videoTexture;
    player.userData.type = 'videoPlayer360';

    // Add to scene
    if (this.scene) {
      this.scene.add(player);
    }

    console.log('[QuiBrowserSDK] VideoPlayer360 created');
    return player;
  }

  /**
   * Create 3D image gallery
   */
  createImageGallery3D(options = {}) {
    const config = {
      images: options.images || [],
      columns: options.columns || 3,
      spacing: options.spacing || 0.5,
      imageWidth: options.imageWidth || 0.8,
      imageHeight: options.imageHeight || 0.6,
      position: options.position || { x: 0, y: 1.5, z: -3 },
      onClick: options.onClick || null
    };

    const gallery = new THREE.Group();
    const loader = new THREE.TextureLoader();

    config.images.forEach((imageUrl, index) => {
      const row = Math.floor(index / config.columns);
      const col = index % config.columns;

      const x = col * (config.imageWidth + config.spacing) - (config.columns - 1) * (config.imageWidth + config.spacing) / 2;
      const y = -row * (config.imageHeight + config.spacing);

      // Create image plane
      const geometry = new THREE.PlaneGeometry(config.imageWidth, config.imageHeight);

      loader.load(imageUrl, (texture) => {
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, 0);

        // Interaction
        mesh.userData.interactive = true;
        mesh.userData.imageUrl = imageUrl;
        mesh.userData.onClick = config.onClick;

        gallery.add(mesh);
      });
    });

    // Position
    gallery.position.set(config.position.x, config.position.y, config.position.z);

    // Add to scene
    if (this.scene) {
      this.scene.add(gallery);
    }

    console.log('[QuiBrowserSDK] ImageGallery3D created with', config.images.length, 'images');
    return gallery;
  }

  /**
   * Get translation
   */
  t(key, params = {}) {
    if (this.i18n) {
      return this.i18n.t(key, params);
    }
    return key;
  }

  /**
   * Enable developer tools
   */
  enableDevTools(options = {}) {
    if (!this.devTools) {
      this.devTools = new QuiBrowserDevTools(this, options);
      this.devTools.enable();
      console.log('[QuiBrowserSDK] Developer tools enabled');
    }
    return this.devTools;
  }

  /**
   * Disable developer tools
   */
  disableDevTools() {
    if (this.devTools) {
      this.devTools.disable();
      this.devTools = null;
      console.log('[QuiBrowserSDK] Developer tools disabled');
    }
  }

  /**
   * Get SDK statistics
   */
  getStats() {
    const stats = {
      version: this.version,
      initialized: this.initialized,
      componentsCount: this.components.size,
      sceneObjects: this.scene ? this.scene.children.length : 0
    };

    if (this.memoryManager) {
      stats.memory = this.memoryManager.getStats();
    }

    if (this.foveatedRendering) {
      stats.foveatedRendering = this.foveatedRendering.getStats();
    }

    return stats;
  }
}

/**
 * QuiBrowser Developer Tools
 */
class QuiBrowserDevTools {
  constructor(sdk, options = {}) {
    this.sdk = sdk;
    this.enabled = false;
    this.panel = null;
    this.stats = {
      fps: 0,
      frameTime: 0,
      memory: 0,
      drawCalls: 0
    };

    this.options = {
      showFPS: options.showFPS !== false,
      showMemory: options.showMemory !== false,
      showSceneGraph: options.showSceneGraph !== false,
      showProfiler: options.showProfiler !== false,
      position: options.position || 'top-right'
    };
  }

  enable() {
    if (this.enabled) return;

    // Create dev tools panel
    this.createPanel();

    // Start monitoring
    this.startMonitoring();

    this.enabled = true;
    console.log('[QuiBrowserDevTools] Enabled');
  }

  disable() {
    if (!this.enabled) return;

    // Remove panel
    if (this.panel) {
      this.panel.parentNode.removeChild(this.panel);
      this.panel = null;
    }

    // Stop monitoring
    this.stopMonitoring();

    this.enabled = false;
    console.log('[QuiBrowserDevTools] Disabled');
  }

  createPanel() {
    this.panel = document.createElement('div');
    this.panel.style.position = 'fixed';
    this.panel.style.zIndex = '10000';
    this.panel.style.padding = '10px';
    this.panel.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    this.panel.style.color = '#00ff00';
    this.panel.style.fontFamily = 'monospace';
    this.panel.style.fontSize = '12px';
    this.panel.style.borderRadius = '5px';
    this.panel.style.pointerEvents = 'none';

    // Position
    switch (this.options.position) {
      case 'top-left':
        this.panel.style.top = '10px';
        this.panel.style.left = '10px';
        break;
      case 'top-right':
        this.panel.style.top = '10px';
        this.panel.style.right = '10px';
        break;
      case 'bottom-left':
        this.panel.style.bottom = '10px';
        this.panel.style.left = '10px';
        break;
      case 'bottom-right':
        this.panel.style.bottom = '10px';
        this.panel.style.right = '10px';
        break;
    }

    document.body.appendChild(this.panel);
  }

  startMonitoring() {
    let frameCount = 0;
    let lastTime = performance.now();
    let lastFPSUpdate = lastTime;

    const monitor = () => {
      if (!this.enabled) return;

      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      frameCount++;

      // Update FPS every 500ms
      if (currentTime - lastFPSUpdate >= 500) {
        this.stats.fps = Math.round((frameCount * 1000) / (currentTime - lastFPSUpdate));
        this.stats.frameTime = deltaTime.toFixed(2);
        frameCount = 0;
        lastFPSUpdate = currentTime;

        // Update memory
        if (performance.memory) {
          this.stats.memory = (performance.memory.usedJSHeapSize / 1048576).toFixed(2);
        }

        // Update panel
        this.updatePanel();
      }

      requestAnimationFrame(monitor);
    };

    monitor();
  }

  stopMonitoring() {
    // Monitoring stops automatically when enabled = false
  }

  updatePanel() {
    if (!this.panel) return;

    let html = '<div><strong>QuiBrowser DevTools</strong></div>';

    if (this.options.showFPS) {
      html += `<div>FPS: ${this.stats.fps}</div>`;
      html += `<div>Frame Time: ${this.stats.frameTime}ms</div>`;
    }

    if (this.options.showMemory && performance.memory) {
      html += `<div>Memory: ${this.stats.memory} MB</div>`;
    }

    if (this.options.showSceneGraph && this.sdk.scene) {
      html += `<div>Scene Objects: ${this.sdk.scene.children.length}</div>`;
    }

    if (this.sdk.memoryManager) {
      const memStats = this.sdk.memoryManager.getStats();
      html += `<div>Textures: ${memStats.textures.count} (${(memStats.textures.size / 1048576).toFixed(2)} MB)</div>`;
      html += `<div>Geometries: ${memStats.geometries.count} (${(memStats.geometries.size / 1048576).toFixed(2)} MB)</div>`;
    }

    this.panel.innerHTML = html;
  }

  inspectObject(object) {
    console.group('[QuiBrowserDevTools] Object Inspector');
    console.log('Name:', object.name);
    console.log('Type:', object.type);
    console.log('Position:', object.position);
    console.log('Rotation:', object.rotation);
    console.log('Scale:', object.scale);
    console.log('Visible:', object.visible);
    console.log('userData:', object.userData);
    console.log('Children:', object.children.length);
    console.groupEnd();
  }

  logSceneGraph() {
    console.group('[QuiBrowserDevTools] Scene Graph');
    this.logObject(this.sdk.scene, 0);
    console.groupEnd();
  }

  logObject(object, level) {
    const indent = '  '.repeat(level);
    console.log(`${indent}- ${object.name || object.type} (${object.children.length} children)`);
    object.children.forEach(child => this.logObject(child, level + 1));
  }
}

// Export SDK
if (typeof window !== 'undefined') {
  window.QuiBrowserSDK = QuiBrowserSDK;
  window.SDK = new QuiBrowserSDK(); // Global instance for convenience
  console.log('[QuiBrowserSDK] SDK available globally as window.SDK');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = QuiBrowserSDK;
}
