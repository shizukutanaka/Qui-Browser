/**
 * VR Browser MVP - Core Module
 *
 * Minimal viable VR browsing engine
 * - WebXR session management
 * - Three.js 3D rendering
 * - Stereoscopic display
 * - Frame rate management (90fps/72fps)
 *
 * ~400 lines of essential functionality
 */

class VRBrowserCore {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.xrSession = null;
    this.xrReferenceSpace = null;
    this.xrFrameLoop = null;

    this.contentLoader = null;
    this.inputHandler = null;
    this.uiManager = null;
    this.storageManager = null;

    this.isVRMode = false;
    this.targetFPS = 90;
    this.lastFrameTime = performance.now();
  }

  /**
   * Initialize VR browser core
   */
  async initialize() {
    console.log('[VRBrowserCore] Initializing...');

    try {
      // 1. Three.js シーン作成
      this.setupScene();

      // 2. WebXR 対応確認
      await this.checkWebXRSupport();

      // 3. サブモジュール初期化
      this.contentLoader = new VRContentLoader(this.scene);
      this.inputHandler = new VRInputHandler(this);
      this.uiManager = new VRUIManager(this);
      this.storageManager = new VRStorageManager();

      // 4. リスナー登録
      this.setupEventListeners();

      console.log('[VRBrowserCore] Initialization complete');
    } catch (error) {
      console.error('[VRBrowserCore] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup Three.js scene, camera, renderer
   */
  setupScene() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    // Camera (initial non-VR perspective)
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 1.5, 0); // Eye height

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      xrCompatible: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.xr.enabled = true;

    // Lighting (so we can see things)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(5, 10, 5);
    this.scene.add(directionalLight);

    // Add a simple ground plane
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      roughness: 0.8
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    this.scene.add(ground);

    console.log('[VRBrowserCore] Scene setup complete');
  }

  /**
   * Check WebXR support
   */
  async checkWebXRSupport() {
    if (!navigator.xr) {
      throw new Error('WebXR not supported in this browser');
    }

    // Check for immersive VR support
    const supported = await navigator.xr.isSessionSupported('immersive-vr');
    if (!supported) {
      throw new Error('Immersive VR not supported');
    }

    console.log('[VRBrowserCore] WebXR support confirmed');
  }

  /**
   * Enter VR mode
   */
  async enterVRMode() {
    if (this.isVRMode) {
      console.warn('[VRBrowserCore] Already in VR mode');
      return;
    }

    try {
      // Request XR session
      this.xrSession = await navigator.xr.requestSession('immersive-vr', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['hand-tracking']
      });

      // Get reference space
      this.xrReferenceSpace = await this.xrSession.requestReferenceSpace('local-floor');

      // Setup input sources
      this.inputHandler.setupXRInput(this.xrSession);

      // Start render loop
      this.xrFrameLoop = this.xrSession.requestAnimationFrame(
        (time, frame) => this.onXRFrame(time, frame)
      );

      this.isVRMode = true;
      console.log('[VRBrowserCore] Entered VR mode');
    } catch (error) {
      console.error('[VRBrowserCore] Failed to enter VR mode:', error);
      throw error;
    }
  }

  /**
   * Exit VR mode
   */
  async exitVRMode() {
    if (!this.isVRMode) return;

    try {
      if (this.xrSession) {
        await this.xrSession.end();
      }

      this.isVRMode = false;
      console.log('[VRBrowserCore] Exited VR mode');
    } catch (error) {
      console.error('[VRBrowserCore] Failed to exit VR mode:', error);
    }
  }

  /**
   * XR frame loop
   */
  onXRFrame(time, frame) {
    const session = frame.session;
    const pose = frame.getViewerPose(this.xrReferenceSpace);

    if (pose) {
      // Update camera from XR pose
      const gl = this.renderer.getContext();
      gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);

      // Clear
      this.renderer.clear();

      // Render for each view (left eye, right eye)
      for (const view of frame.views) {
        const viewport = session.renderState.baseLayer.getViewport(view);
        gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);

        // Update camera
        this.camera.projectionMatrix.fromArray(view.projectionMatrix);
        const viewMatrix = new THREE.Matrix4().fromArray(pose.transform.inverse.matrix);
        const cameraMatrix = new THREE.Matrix4()
          .multiplyMatrices(viewMatrix, new THREE.Matrix4().setPosition(view.transform.position));
        this.camera.matrix.copy(cameraMatrix);
        this.camera.matrixAutoUpdate = false;

        // Render
        this.renderer.render(this.scene, this.camera);
      }
    }

    // Continue loop
    session.requestAnimationFrame((time, frame) => this.onXRFrame(time, frame));
  }

  /**
   * Update (called from main animation loop)
   */
  update() {
    if (!this.isVRMode) {
      // Non-VR rendering
      this.renderer.render(this.scene, this.camera);
    }

    // Update handlers
    if (this.inputHandler) {
      this.inputHandler.update();
    }

    if (this.uiManager) {
      this.uiManager.update();
    }
  }

  /**
   * Handle window resize
   */
  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Handle session end
    if (this.xrSession) {
      this.xrSession.addEventListener('end', () => {
        this.isVRMode = false;
      });
    }

    // Handle navigation
    this.on('navigate', (url) => {
      this.loadURL(url);
    });
  }

  /**
   * Load URL
   */
  async loadURL(url) {
    try {
      console.log('[VRBrowserCore] Loading URL:', url);

      if (this.contentLoader) {
        await this.contentLoader.loadURL(url);
      }
    } catch (error) {
      console.error('[VRBrowserCore] Failed to load URL:', error);
    }
  }

  /**
   * Simple event system
   */
  on(event, callback) {
    if (!this.listeners) this.listeners = {};
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (!this.listeners || !this.listeners[event]) return;
    this.listeners[event].forEach(callback => callback(data));
  }
}

// Export for browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRBrowserCore;
}
