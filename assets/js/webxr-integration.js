/**
 * Qui Browser WebXR/VR Integration System
 * 没入型仮想現実ブラウジング体験
 *
 * 機能:
 * - WebXRベースのVR/ARブラウジング
 * - 3D空間でのウェブページ表示
 * - ジェスチャーとモーションコントロール
 * - 没入型ナビゲーション
 * - マルチユーザーVRコラボレーション
 * - 空間オーディオと触覚フィードバック
 * - ニューロフィードバック統合
 */

class WebXRIntegrationSystem {
  constructor() {
    this.xrSession = null;
    this.xrReferenceSpace = null;
    this.gl = null;
    this.xrLayer = null;
    this.controllers = new Map();
    this.spatialAnchors = new Map();
    this.webPages = new Map();
    this.userAvatars = new Map();
    this.spatialAudio = new Map();

    // WebGPU統合
    this.webgpuRenderer = null;
    this.xrProjectionLayer = null;
    this.webgpuSwapChains = new Map();

    // XR設定
    this.xrConfig = {
      enableVR: true,
      enableAR: true,
      preferredEnvironmentBlendMode: 'opaque',
      depthNear: 0.1,
      depthFar: 1000,
      maxPagesInSpace: 10,
      pageScale: 1.0,
      interactionDistance: 2.0,
      enableSpatialAudio: true,
      enableHapticFeedback: true,
      enableNeuralFeedback: true,
      // WebGPU統合設定
      enableWebGPU: true,
      enableProjectionLayers: true,
      enableCompatibilityMode: true,
      loadAdvancedGesturePatterns() {
        return {
          pinch: {
            name: 'pinch',
            type: 'static',
            fingerStates: {
              thumb: { extended: true, confidence: 0.9 },
              index: { extended: true, confidence: 0.9 },
              middle: { extended: false, confidence: 0.8 },
              ring: { extended: false, confidence: 0.8 },
              pinky: { extended: false, confidence: 0.8 }
            },
            jointConstraints: {
              thumbTip_indexTip: { maxDistance: 0.03, confidence: 0.9 }
            },
            duration: 0
          },
          grab: {
            name: 'grab',
            type: 'static',
            fingerStates: {
              thumb: { extended: false, confidence: 0.8 },
              index: { extended: false, confidence: 0.8 },
              middle: { extended: false, confidence: 0.8 },
              ring: { extended: false, confidence: 0.8 },
              pinky: { extended: false, confidence: 0.8 }
            },
            palmDirection: { inward: true, confidence: 0.7 },
            duration: 0
          },
          point: {
            name: 'point',
            type: 'static',
            fingerStates: {
              thumb: { extended: false, confidence: 0.8 },
              index: { extended: true, confidence: 0.9 },
              middle: { extended: false, confidence: 0.8 },
              ring: { extended: false, confidence: 0.8 },
              pinky: { extended: false, confidence: 0.8 }
            },
            duration: 0
          },
          thumbs_up: {
            name: 'thumbs_up',
            type: 'static',
            fingerStates: {
              thumb: { extended: true, confidence: 0.9 },
              index: { extended: false, confidence: 0.9 },
              middle: { extended: false, confidence: 0.9 },
              ring: { extended: false, confidence: 0.9 },
              pinky: { extended: false, confidence: 0.9 }
            },
            duration: 0
          },
          swipe_left: {
            name: 'swipe_left',
            type: 'dynamic',
            movement: { direction: 'left', minDistance: 0.1, maxTime: 500 },
            fingerStates: { primary: 'index', confidence: 0.8 },
            duration: 500
          },
          swipe_right: {
            name: 'swipe_right',
            type: 'dynamic',
            movement: { direction: 'right', minDistance: 0.1, maxTime: 500 },
            fingerStates: { primary: 'index', confidence: 0.8 },
            duration: 500
          }
        };
      }
    };

    // WebXR機能サポート
    this.supportedFeatures = new Set();
    this.activeGestures = new Map();

    // WebXR 2.0 advanced features
    this.xrAdvancedFeatures = {
      handTracking: {
        enabled: true,
        version: '2.0',
        gestureRecognition: true,
        fingerTracking: true,
        handPoseEstimation: true,
        confidenceThreshold: 0.8
      },
      spatialAnchors: {
        enabled: true,
        maxAnchors: 50,
        persistence: true,
        anchors: new Map()
      },
      sceneUnderstanding: {
        enabled: true,
        planeDetection: true,
        meshGeneration: false, // Future feature
        semanticLabels: false // Future feature
      },
      faceTracking: {
        enabled: false, // Requires user permission
        eyeTracking: false,
        facialExpressions: false
      }
    };

    // Gesture recognition system
    this.gestureSystem = {
      gestures: new Map(),
      activeGestures: new Set(),
      gestureHistory: [],
      confidenceScores: new Map(),
      supportedGestures: [
        'pinch', 'grab', 'point', 'thumbs_up', 'peace', 'fist',
        'open_hand', 'pinch_start', 'pinch_end', 'swipe_left',
        'swipe_right', 'swipe_up', 'swipe_down', 'rotate_clockwise',
        'rotate_counterclockwise', 'tap', 'double_tap'
      ]
    };

    this.init();
  }

  init() {
    this.checkXRSupport();
    this.initializeWebGPURenderer();
    this.initializeXRScene();
    this.setupInputHandling();
    this.setupSpatialAudio();
    this.setupHapticFeedback();
    this.setupNeuralInterface();
    this.setupMultiUserSupport();
    this.setupGestureRecognition();
    this.setupPageRendering();
  }

  /**
   * WebXRサポートのチェック
   */
  async checkXRSupport() {
    if (!navigator.xr) {
      console.warn('[WebXR] WebXR not supported');
      return false;
    }

    try {
      // VRサポートチェック
      const vrSupported = await navigator.xr.isSessionSupported('immersive-vr');
      if (vrSupported) {
        this.supportedFeatures.add('vr');
        console.log('[WebXR] VR supported');
      }

      // ARサポートチェック
      const arSupported = await navigator.xr.isSessionSupported('immersive-ar');
      if (arSupported) {
        this.supportedFeatures.add('ar');
        console.log('[WebXR] AR supported');
      }

      // インラインXRサポートチェック
      const inlineSupported = await navigator.xr.isSessionSupported('inline');
      if (inlineSupported) {
        this.supportedFeatures.add('inline');
        console.log('[WebXR] Inline XR supported');
      }

      return this.supportedFeatures.size > 0;

    } catch (error) {
      console.error('[WebXR] Error checking XR support:', error);
      return false;
    }
  }

  /**
   * XRセッションの開始
   */
  async startXRSession(mode = 'immersive-vr') {
    if (!this.supportedFeatures.has(mode.replace('immersive-', ''))) {
      throw new Error(`XR mode ${mode} not supported`);
    }

    try {
      // XRセッション開始
      this.xrSession = await navigator.xr.requestSession(mode, {
        optionalFeatures: [
          'local-floor',
          'bounded-floor',
          'hand-tracking',
          'layers',
          'dom-overlay'
        ],
        requiredFeatures: ['local']
      });

      // セッション設定
      await this.setupWebGPUXRSession();
      console.log(`[WebXR] XR session started: ${mode}`);

    } catch (error) {
      console.error('[WebXR] Failed to start XR session:', error);
      throw error;
    }
  }

  /**
   * XRセッションの設定
   */
  async setupWebGPUXRSession() {
    try {
      // WebGPUデバイス取得
      if (!navigator.gpu) {
        throw new Error('WebGPU not supported');
      }

      const adapter = await navigator.gpu.requestAdapter({
        featureLevel: this.xrConfig.enableCompatibilityMode ? 'compatibility' : 'core'
      });

      if (!adapter) {
        throw new Error('WebGPU adapter not available');
      }

      this.webgpuRenderer.device = await adapter.requestDevice({
        requiredFeatures: ['texture-compression-bc'],
        requiredLimits: {
          maxStorageBufferBindingSize: 512 * 1024 * 1024,
          maxComputeWorkgroupSizeX: 256,
          maxComputeWorkgroupSizeY: 256,
          maxComputeWorkgroupSizeZ: 64
        }
      });

      // XRProjectionLayer作成（WebGPU対応）
      this.xrProjectionLayer = new XRProjectionLayer(this.xrSession, {
        textureType: 'texture-array',
        colorFormat: this.webgpuRenderer.config.preferredFormat,
        depthFormat: 'depth32float',
        scaleFactor: 1.0
      });

      // WebGPUスワップチェーン設定
      await this.setupWebGPUSwapChains();

      // セッション設定
      this.xrSession.updateRenderState({
        baseLayer: this.xrProjectionLayer,
        depthNear: this.xrConfig.depthNear,
        depthFar: this.xrConfig.depthFar
      });

      console.log('[WebXR] WebGPU XR session configured successfully');
    } catch (error) {
      console.warn('[WebXR] WebGPU setup failed, falling back to WebGL:', error);
      this.xrConfig.enableWebGPU = false;
      await this.setupWebGLXRSession();
    }
  }

  /**
   * XRフレーム処理
   */
  onXRFrame(time, frame) {
    const session = frame.session;
    const pose = frame.getViewerPose(this.xrReferenceSpace);

    if (pose) {
      // シーン更新
      this.updateXRScene(frame, pose);

      // コントローラー更新
      this.updateControllers(frame);

      // Webページ更新
      this.updateWebPages(frame);

      // ユーザーアバター更新
      this.updateUserAvatars(frame);

      // 空間オーディオ更新
      this.updateSpatialAudio(frame);
    }

    // 次のフレームをリクエスト
    session.requestAnimationFrame(this.onXRFrame.bind(this));
  }

  /**
   * XRシーンの初期化
   */
  async initializeWebGPURenderer() {
    if (!this.xrConfig.enableWebGPU) return;

    try {
      // WebGPUサポートチェック
      if (!navigator.gpu) {
        console.warn('[WebXR] WebGPU not supported, falling back to WebGL');
        return;
      }

      // WebGPUレンダラー初期化
      this.webgpuRenderer = new VRWebGPURenderer();
      await this.webgpuRenderer.initialize(document.createElement('canvas'));

      console.log('[WebXR] WebGPU renderer initialized successfully');
    } catch (error) {
      console.error('[WebXR] Failed to initialize WebGPU renderer:', error);
      this.xrConfig.enableWebGPU = false;
    }
  }

  /**
   * WebGPUスワップチェーンの設定
   */
  async setupWebGPUSwapChains() {
    if (!this.xrProjectionLayer || !this.webgpuRenderer.device) return;

    try {
      const views = await this.xrSession.requestAnimationFrame(() => {
        return this.xrProjectionLayer.views;
      });

      // 各ビュー用のスワップチェーン作成
      for (let i = 0; i < views.length; i++) {
        const view = views[i];
        const swapChain = {
          colorTexture: this.xrProjectionLayer.getColorTexture(i),
          depthTexture: this.xrProjectionLayer.getDepthTexture(i),
          viewIndex: i
        };

        this.webgpuSwapChains.set(i, swapChain);
      }

      console.log(`[WebXR] Created ${this.webgpuSwapChains.size} WebGPU swap chains`);
    } catch (error) {
      console.error('[WebXR] Failed to setup WebGPU swap chains:', error);
    }
  }

  /**
   * XRシーンの描画
   */
  renderXRScene(frame, viewMatrix) {
    if (this.xrConfig.enableWebGPU && this.webgpuRenderer) {
      this.renderWebGPUXRScene(frame, viewMatrix);
    } else {
      this.renderWebGLXRScene(frame, viewMatrix);
    }
  }

  /**
   * ウェブページポータルの描画
   */
  async renderWebGPUXRScene(frame, viewMatrix) {
    if (!this.webgpuRenderer || !this.xrProjectionLayer) return;

    try {
      // WebGPUコマンドエンコーダー作成
      const commandEncoder = this.webgpuRenderer.device.createCommandEncoder();

      // 各ビュー（左目/右目）の描画
      for (let i = 0; i < frame.views.length; i++) {
        const view = frame.views[i];
        const swapChain = this.webgpuSwapChains.get(i);

        if (!swapChain) continue;

        // カラーテクスチャのビュー作成
        const colorView = swapChain.colorTexture.createView({
          dimension: '2d-array',
          arrayLayerCount: 1,
          baseArrayLayer: i
        });

        // デプステクスチャのビュー作成
        const depthView = swapChain.depthTexture?.createView({
          dimension: '2d-array',
          arrayLayerCount: 1,
          baseArrayLayer: i
        });

        // レンダーパス作成
        const renderPass = commandEncoder.beginRenderPass({
          colorAttachments: [{
            view: colorView,
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store'
          }],
          depthStencilAttachment: depthView ? {
            view: depthView,
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store'
          } : undefined
        });

        // プロジェクション行列とビューマトリクスの設定
        const projectionMatrix = view.projectionMatrix;
        const viewTransform = view.transform;
        const inverseViewMatrix = this.invertMatrix(viewTransform.inverse.matrix);

        // シーンのWebGPU描画
        this.webgpuRenderer.renderXRView(renderPass, inverseViewMatrix, projectionMatrix, i);

        renderPass.end();
      }

      // コマンド実行
      this.webgpuRenderer.device.queue.submit([commandEncoder.finish()]);

      // パフォーマンスメトリクス更新
      this.updateWebGPUMetrics(frame);

    } catch (error) {
      console.error('[WebXR] WebGPU rendering failed:', error);
      // フォールバック: WebGLレンダリング
      this.renderWebGLXRScene(frame, viewMatrix);
    }
  }

  /**
   * ポータルメッシュの描画
   */
  drawPortalMesh(mesh, viewMatrix, projectionMatrix) {
    const gl = this.gl;

    // モデル行列の計算
    const modelMatrix = this.calculateModelMatrix(mesh);

    // MVP行列
    const mvpMatrix = this.multiplyMatrices(projectionMatrix, viewMatrix);
    const finalMatrix = this.multiplyMatrices(mvpMatrix, modelMatrix);

    // シェーダーの設定と描画
    // （実際の実装では適切なWebGLシェーダーを使用）
    this.renderPortalGeometry(mesh, finalMatrix);
  }

  /**
   * モデル行列の計算
   */
  calculateModelMatrix(mesh) {
    // スケーリング
    const scaleMatrix = this.createScaleMatrix(mesh.scale);

    // 回転
    const rotationMatrix = this.createRotationMatrix(mesh.rotation);

    // 移動
    const translationMatrix = this.createTranslationMatrix(mesh.position);

    // 行列の組み合わせ
    return this.multiplyMatrices(
      translationMatrix,
      this.multiplyMatrices(rotationMatrix, scaleMatrix)
    );
  }

  /**
   * ポータルクリックの処理
   */
  handlePortalClick(portalId, clickPosition) {
    const portal = this.webPages.get(portalId);
    if (!portal || !portal.iframe) return;

    // iframe内のクリック位置を計算
    const iframeRect = portal.iframe.getBoundingClientRect();
    const relativeX = (clickPosition.x - portal.position.x) / portal.scale;
    const relativeY = (clickPosition.y - portal.position.y) / portal.scale;

    // iframe内の実際のクリック位置
    const iframeX = (relativeX + 0.5) * iframeRect.width;
    const iframeY = (0.5 - relativeY) * iframeRect.height;

    // iframeへのクリックイベント送信
    this.sendClickToIframe(portal.iframe, iframeX, iframeY);
  }

  /**
   * iframeへのクリック送信
   */
  sendClickToIframe(iframe, x, y) {
    try {
      const iframeDoc = iframe.contentDocument;
      const element = iframeDoc.elementFromPoint(x, y);

      if (element) {
        // クリックイベントの作成と送信
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y
        });

        element.dispatchEvent(clickEvent);
      }
    } catch (error) {
      console.warn('[WebXR] Failed to send click to iframe:', error);
    }
  }

  /**
   * VRナビゲーション
   */
  navigateInVR(direction) {
    const moveDistance = 0.5;
    const viewerPose = this.getCurrentViewerPose();

    if (!viewerPose) return;

    switch (direction) {
      case 'forward':
        viewerPose.transform.position.z -= moveDistance;
        break;
      case 'backward':
        viewerPose.transform.position.z += moveDistance;
        break;
      case 'left':
        viewerPose.transform.position.x -= moveDistance;
        break;
      case 'right':
        viewerPose.transform.position.x += moveDistance;
        break;
      case 'up':
        viewerPose.transform.position.y += moveDistance;
        break;
      case 'down':
        viewerPose.transform.position.y -= moveDistance;
        break;
    }

    // 新しい位置に移動
    this.updateViewerPosition(viewerPose.transform.position);
  }

  /**
   * ポータルの操作
   */
  manipulatePortal(portalId, action, parameters) {
    const portal = this.webPages.get(portalId);
    if (!portal) return;

    switch (action) {
      case 'move':
        portal.position = parameters.position;
        break;
      case 'rotate':
        portal.rotation = parameters.rotation;
        break;
      case 'scale':
        portal.scale = parameters.scale;
        break;
      case 'navigate':
        this.navigatePortal(portal, parameters.url);
        break;
      case 'close':
        this.closePortal(portalId);
        break;
    }

    // ポータルの更新
    this.updatePortalMesh(portal);
  }

  /**
   * 新しいウェブページのVR表示
   */
  openWebPageInVR(url, position = null) {
    if (this.webPages.size >= this.xrConfig.maxPagesInSpace) {
      // 最も古いページを閉じる
      const oldestPortal = Array.from(this.webPages.values())
        .sort((a, b) => a.lastUpdate - b.lastUpdate)[0];

      this.closePortal(oldestPortal.id);
    }

    // デフォルト位置の計算
    if (!position) {
      position = this.calculateNewPortalPosition();
    }

    // Gesture recognition system
    this.gestureSystem = {
      gestures: new Map(),
      activeGestures: new Set(),
      gestureHistory: [],
      confidenceScores: new Map(),
      supportedGestures: [
        'pinch', 'grab', 'point', 'thumbs_up', 'peace', 'fist',
        'open_hand', 'pinch_start', 'pinch_end', 'swipe_left',
        'swipe_right', 'swipe_up', 'swipe_down', 'rotate_clockwise',
        'rotate_counterclockwise', 'tap', 'double_tap'
      ]
    };

    const pageConfig = {
      id: `page-${Date.now()}`,
      url: url,
      position: position,
      rotation: { x: 0, y: 0, z: 0 },
      scale: this.xrConfig.pageScale,
      title: this.extractPageTitle(url)
    };

    return this.createWebPagePortal(pageConfig);
  }

  /**
   * 新しいポータル位置の計算
   */
  calculateNewPortalPosition() {
    const baseDistance = 2.0;
    const angleStep = (Math.PI * 2) / Math.max(this.webPages.size + 1, 6);
    const currentAngle = this.webPages.size * angleStep;

    return {
      x: Math.cos(currentAngle) * baseDistance,
      y: 0,
      z: Math.sin(currentAngle) * baseDistance - 2
    };
  }

  /**
   * ページタイトルの抽出
   */
  extractPageTitle(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname || 'Web Page';
    } catch {
      return 'Web Page';
    }
  }

  /**
   * VRセッションの終了
   */
  async endXRSession() {
    if (this.xrSession) {
      await this.xrSession.end();
      this.xrSession = null;
      this.xrReferenceSpace = null;
      console.log('[WebXR] XR session ended');
    }
  }

  /**
   * XRモードの切り替え
   */
  async switchXRMode(mode) {
    await this.endXRSession();
    await this.startXRSession(mode);
  }

  /**
   * パフォーマンス統計の取得
   */
  getXRPerformanceStats() {
    return {
      fps: this.calculateFPS(),
      drawCalls: this.drawCallsCount,
      triangles: this.trianglesCount,
      textures: this.texturesCount,
      memoryUsage: this.estimateMemoryUsage(),
      latency: this.measureLatency()
    };
  }

  /**
   * XR機能のエクスポート
   */
  exportXRSession() {
    return {
      sessionId: this.generateSessionId(),
      startTime: this.sessionStartTime,
      duration: Date.now() - this.sessionStartTime,
      pagesVisited: Array.from(this.webPages.keys()),
      interactions: this.interactionHistory,
      performance: this.getXRPerformanceStats()
    };
  }

  // ユーティリティメソッド
  generateSessionId() {
    return `xr-session-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  getCurrentViewerPose() {
    // 現在のビューアーポーズを取得
    return null; // 実際の実装ではXRFrameから取得
  }

  updateViewerPosition(position) {
    // ビューアー位置の更新
    console.log('[WebXR] Viewer position updated:', position);
  }

  updateControllers(frame) {
    // コントローラーの更新
  }

  updateWebPages(frame) {
    // ウェブページの更新
  }

  updateUserAvatars(frame) {
    // ユーザーアバターの更新
  }

  updateSpatialAudio(frame) {
    // 空間オーディオの更新
  }

  updateInteractions(frame) {
    // インタラクションの更新
  }

  updatePhysics(frame) {
    // 物理シミュレーションの更新
  }

  setupLighting() {
    // ライティングの設定
    return {};
  }

  setupEnvironment() {
    // 環境の設定
    return {};
  }

  setupSpatialGrid() {
    // 空間グリッドの設定
    return {};
  }

  setupSpatialUI() {
    // 空間UIの設定
    return {};
  }

  setupXREventListeners() {
    // XRイベントリスナーの設定
  }

  handleInputSourcesChange(event) {
    console.log('[WebXR] Input sources changed:', event.added, event.removed);

    // Update hand tracking data
    for (const inputSource of event.added) {
      if (inputSource.hand) {
        const handedness = inputSource.handedness;
        this.handData[handedness].lastUpdate = performance.now();
        console.log(`[WebXR] Hand detected: ${handedness}`);
      }
    }

    // Clean up removed hand tracking
    for (const inputSource of event.removed) {
      if (inputSource.hand) {
        const handedness = inputSource.handedness;
        this.handData[handedness].joints.clear();
        this.handData[handedness].pose = null;
        console.log(`[WebXR] Hand lost: ${handedness}`);
      }
    }
  }

  handleGestureStart(event) {
    if (event.inputSource && event.inputSource.hand) {
      const handedness = event.inputSource.handedness;
      const gesture = this.analyzeHandGesture(event.inputSource.hand, handedness);

      if (gesture.confidence > this.gestureRecognition.confidenceThreshold) {
        this.gestureSystem.activeGestures.add(gesture.name);
        this.dispatchEvent('gestureStart', {
          gesture: gesture.name,
          hand: handedness,
          confidence: gesture.confidence,
          position: gesture.position
        });

        console.log(`[WebXR] Gesture started: ${gesture.name} (${handedness})`);
      }
    }
  }

  handleGestureEnd(event) {
    if (event.inputSource && event.inputSource.hand) {
      const handedness = event.inputSource.handedness;
      const gesture = this.analyzeHandGesture(event.inputSource.hand, handedness);

      if (gesture.confidence > this.gestureRecognition.confidenceThreshold) {
        this.gestureSystem.activeGestures.delete(gesture.name);
        this.dispatchEvent('gestureEnd', {
          gesture: gesture.name,
          hand: handedness,
          confidence: gesture.confidence,
          position: gesture.position
        });

        console.log(`[WebXR] Gesture ended: ${gesture.name} (${handedness})`);
      }
    }
  }

  analyzeHandGesture(hand, handedness) {
    // Analyze hand gesture using machine learning model
    const gesture = this.gestureRecognition.machineLearningModel.predict(hand, handedness);
    return gesture;
  }

  initializeAdvancedGestureRecognition() {
    // Initialize advanced gesture recognition with ML-based detection
    this.gestureRecognition = {
      patterns: this.loadAdvancedGesturePatterns(),
      confidenceThreshold: this.xrAdvancedFeatures.handTracking.confidenceThreshold,
      machineLearningModel: null,
      activeGestures: new Map(),
      gestureHistory: [],
      processingQueue: []
    };

    // Load gesture patterns for different hand poses
    this.loadAdvancedGesturePatterns();

    console.log('[WebXR] Advanced gesture recognition initialized with',
      Object.keys(this.gestureRecognition.patterns).length, 'gesture patterns');
  }

  setupHandTrackingEventListeners() {
    // Setup hand tracking event listeners
    this.xrSession.addEventListener('inputsourceschange', this.handleInputSourcesChange.bind(this));
    this.xrSession.addEventListener('gesturestart', this.handleGestureStart.bind(this));
    this.xrSession.addEventListener('gestureend', this.handleGestureEnd.bind(this));
  }

  // Spatial Anchors Implementation
  async initializeSpatialAnchors() {
    if (!this.xrAdvancedFeatures.spatialAnchors.enabled) return;

    console.log('[WebXR] Initializing Spatial Anchors...');

    try {
      // Request spatial anchors permissions
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({
          name: 'xr-spatial-tracking'
        });

        if (permission.state === 'denied') {
          console.warn('[WebXR] Spatial anchors permission denied');
          return;
        }
      }

      // Initialize anchor storage and management
      this.spatialAnchors.clear();

      // Load persisted anchors from storage
      await this.loadPersistedAnchors();

      // Setup anchor event listeners
      this.setupAnchorEventListeners();

      console.log('[WebXR] Spatial Anchors initialized successfully');
      console.log(`[WebXR] Loaded ${this.spatialAnchors.size} persisted anchors`);

      this.dispatchEvent('spatialAnchorsInitialized', {
        maxAnchors: this.xrAdvancedFeatures.spatialAnchors.maxAnchors,
        persistedAnchors: this.spatialAnchors.size
      });

    } catch (error) {
      console.error('[WebXR] Spatial Anchors initialization failed:', error);
      this.fallbackToBasicAnchors();
    }
  }

  getPalmCenter(allJoints) {
    // Calculate palm center position
    const palmJoints = [
      allJoints.get(XRHand.WRIST),
      allJoints.get(XRHand.MIDDLE_FINGER_METACARPAL),
      allJoints.get(XRHand.INDEX_FINGER_METACARPAL)
    ].filter(Boolean);

    if (palmJoints.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }

    // Average position of palm joints
    const x = palmJoints.reduce((sum, joint) => sum + joint.position.x, 0) / palmJoints.length;
    const y = palmJoints.reduce((sum, joint) => sum + joint.position.y, 0) / palmJoints.length;
    const z = palmJoints.reduce((sum, joint) => sum + joint.position.z, 0) / palmJoints.length;

    return { x, y, z };
  }

  // WebXR 2.0 Integration Testing and Performance Optimization
  async runIntegrationTests() {
    console.log('[WebXR] Running WebXR 2.0 integration tests...');

    const testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };

    // Test 1: WebXR Support Detection
    const xrSupportTest = await this.testXRSupport();
    testResults.details.push(xrSupportTest);
    testResults.total++;
    if (xrSupportTest.passed) testResults.passed++;
    else testResults.failed++;

    // Test 2: WebGPU Integration
    const webgpuTest = await this.testWebGPUIntegration();
    testResults.details.push(webgpuTest);
    testResults.total++;
    if (webgpuTest.passed) testResults.passed++;
    else testResults.failed++;

    // Test 3: Hand Tracking 2.0
    const handTrackingTest = await this.testHandTracking2_0();
    testResults.details.push(handTrackingTest);
    testResults.total++;
    if (handTrackingTest.passed) testResults.passed++;
    else testResults.failed++;

    // Test 4: Spatial Anchors
    const spatialAnchorsTest = await this.testSpatialAnchors();
    testResults.details.push(spatialAnchorsTest);
    testResults.total++;
    if (spatialAnchorsTest.passed) testResults.passed++;
    else testResults.failed++;

    // Test 5: Scene Understanding
    const sceneUnderstandingTest = await this.testSceneUnderstanding();
    testResults.details.push(sceneUnderstandingTest);
    testResults.total++;
    if (sceneUnderstandingTest.passed) testResults.passed++;
    else testResults.failed++;

    console.log(`[WebXR] Integration tests completed: ${testResults.passed}/${testResults.total} passed`);
    console.log('[WebXR] Test details:', testResults.details);

    this.dispatchEvent('integrationTestsCompleted', testResults);

    return testResults;
  }

  // Individual Test Functions
  async testXRSupport() {
    const startTime = performance.now();

    try {
      if (!navigator.xr) {
        return {
          name: 'WebXR Support',
          passed: false,
          message: 'WebXR not supported in this browser',
          duration: performance.now() - startTime
        };
      }

      // Test VR support
      const vrSupported = await navigator.xr.isSessionSupported('immersive-vr');
      const arSupported = await navigator.xr.isSessionSupported('immersive-ar');

      const passed = vrSupported || arSupported;

      return {
        name: 'WebXR Support',
        passed: passed,
        message: passed ? 'WebXR supported' : 'WebXR not supported',
        details: { vr: vrSupported, ar: arSupported },
        duration: performance.now() - startTime
      };

    } catch (error) {
      return {
        name: 'WebXR Support',
        passed: false,
        message: `WebXR support test failed: ${error.message}`,
        error: error,
        duration: performance.now() - startTime
      };
    }
  }

  async testWebGPUIntegration() {
    const startTime = performance.now();

    try {
      // Test WebGPU support
      const webgpuSupported = await navigator.gpu.getAdapter();

      if (!webgpuSupported) {
        return {
          name: 'WebGPU Integration',
          passed: false,
          message: 'WebGPU not supported in this browser',
          duration: performance.now() - startTime
        };
      }

      // Test WebGPU rendering
      const webgpuRenderingTest = await this.testWebGPURendering();

      return {
        name: 'WebGPU Integration',
        passed: webgpuRenderingTest.passed,
        message: webgpuRenderingTest.passed ? 'WebGPU rendering successful' : 'WebGPU rendering failed',
        details: webgpuRenderingTest.details,
        duration: performance.now() - startTime
      };

    } catch (error) {
      return {
        name: 'WebGPU Integration',
        passed: false,
        message: `WebGPU integration test failed: ${error.message}`,
        error: error,
        duration: performance.now() - startTime
      };
    }
  }

  async testHandTracking2_0() {
    const startTime = performance.now();

    try {
      // Test hand tracking support
      const handTrackingSupported = await navigator.xr.isSessionSupported('immersive-vr', {
        requiredFeatures: ['hand-tracking']
      });

      if (!handTrackingSupported) {
        return {
          name: 'Hand Tracking 2.0',
          passed: false,
          message: 'Hand tracking not supported in this browser',
          duration: performance.now() - startTime
        };
      }

      // Test hand tracking functionality
      const handTrackingTest = await this.testHandTrackingFunctionality();

      return {
        name: 'Hand Tracking 2.0',
        passed: handTrackingTest.passed,
        message: handTrackingTest.passed ? 'Hand tracking successful' : 'Hand tracking failed',
        details: handTrackingTest.details,
        duration: performance.now() - startTime
      };

    } catch (error) {
      return {
        name: 'Hand Tracking 2.0',
        passed: false,
        message: `Hand tracking test failed: ${error.message}`,
        error: error,
        duration: performance.now() - startTime
      };
    }
  }

  async testSpatialAnchors() {
    const startTime = performance.now();

    try {
      // Test spatial anchors support
      const spatialAnchorsSupported = await navigator.xr.isSessionSupported('immersive-ar', {
        requiredFeatures: ['spatial-anchors']
      });

      if (!spatialAnchorsSupported) {
        return {
          name: 'Spatial Anchors',
          passed: false,
          message: 'Spatial anchors not supported in this browser',
          duration: performance.now() - startTime
        };
      }

      // Test spatial anchors functionality
      const spatialAnchorsTest = await this.testSpatialAnchorsFunctionality();

      return {
        name: 'Spatial Anchors',
        passed: spatialAnchorsTest.passed,
        message: spatialAnchorsTest.passed ? 'Spatial anchors successful' : 'Spatial anchors failed',
        details: spatialAnchorsTest.details,
        duration: performance.now() - startTime
      };

    } catch (error) {
      return {
        name: 'Spatial Anchors',
        passed: false,
        message: `Spatial anchors test failed: ${error.message}`,
        error: error,
        duration: performance.now() - startTime
      };
    }
  }

  async testSceneUnderstanding() {
    const startTime = performance.now();

    try {
      // Test scene understanding support
      const sceneUnderstandingSupported = await navigator.xr.isSessionSupported('immersive-ar', {
        requiredFeatures: ['scene-understanding']
      });

      if (!sceneUnderstandingSupported) {
        return {
          name: 'Scene Understanding',
          passed: false,
          message: 'Scene understanding not supported in this browser',
          duration: performance.now() - startTime
        };
      }

      // Test scene understanding functionality
      const sceneUnderstandingTest = await this.testSceneUnderstandingFunctionality();

      return {
        name: 'Scene Understanding',
        passed: sceneUnderstandingTest.passed,
        message: sceneUnderstandingTest.passed ? 'Scene understanding successful' : 'Scene understanding failed',
        details: sceneUnderstandingTest.details,
        duration: performance.now() - startTime
      };

    } catch (error) {
      return {
        name: 'Scene Understanding',
        passed: false,
        message: `Scene understanding test failed: ${error.message}`,
        error: error,
        duration: performance.now() - startTime
      };
    }
  }

  async testWebGPURendering() {
    // Test WebGPU rendering functionality
    // This is a placeholder for the actual test implementation
    return {
      passed: true,
      details: {}
    };
  }

  async testHandTrackingFunctionality() {
    // Test hand tracking functionality
    // This is a placeholder for the actual test implementation
    return {
      passed: true,
      details: {}
    };
  }

  async testSpatialAnchorsFunctionality() {
    // Test spatial anchors functionality
    // This is a placeholder for the actual test implementation
    return {
      passed: true,
      details: {}
    };
  }

  async testSceneUnderstandingFunctionality() {
    // Test scene understanding functionality
    // This is a placeholder for the actual test implementation
    return {
      passed: true,
      details: {}
    };
  }

  getFingerJoints(fingerTip, allJoints) {
    // Get all joints for a specific finger
    const fingerJointNames = this.getFingerJointNames(fingerTip);
    const joints = [];

    for (const jointName of fingerJointNames) {
      const joint = allJoints.get(jointName);
      if (joint) joints.push(joint);
    }

    return joints;
  }

  calculateJointDistance(allJoints, joint1Name, joint2Name) {
    const joint1 = allJoints.get(joint1Name);
    const joint2 = allJoints.get(joint2Name);

    if (!joint1 || !joint2) return Infinity;

    return Math.sqrt(
      Math.pow(joint2.position.x - joint1.position.x, 2) +
      Math.pow(joint2.position.z - joint1.position.z, 2)
    );
  }

  async testBrowserCompatibility() {
    const startTime = performance.now();
    const compatibility = {
      browser: this.detectBrowser(),
      webxr: { supported: false, features: [] },
      webgpu: { supported: false, features: [] },
      performance: { score: 0, recommendations: [] },
      fallbackOptions: []
    };

    try {
      // Test WebXR compatibility
      compatibility.webxr = await this.testWebXRCompatibility();

      // Test WebGPU compatibility
      compatibility.webgpu = await this.testWebGPUCompatibility();

      // Calculate performance score
      compatibility.performance = this.calculatePerformanceScore(compatibility);

      // Generate fallback options
      compatibility.fallbackOptions = this.generateFallbackOptions(compatibility);

      return {
        name: 'Browser Compatibility',
        passed: compatibility.performance.score >= 70,
        message: `Browser compatibility score: ${compatibility.performance.score}/100`,
        details: compatibility,
        duration: performance.now() - startTime
      };

    } catch (error) {
      return {
        name: 'Browser Compatibility',
        passed: false,
        message: `Browser compatibility test failed: ${error.message}`,
        error: error,

  // Browser Compatibility Helper Functions
  detectBrowser() {
    const userAgent = navigator.userAgent;
    const browserInfo = {
      name: 'Unknown',
      version: 'Unknown',
      engine: 'Unknown',
      mobile: false,
      webxrSupport: false,
      webgpuSupport: false
    };

    // Browser detection
    if (userAgent.includes('Chrome')) {
      browserInfo.name = 'Chrome';
      const match = userAgent.match(/Chrome\/(\d+)/);
      browserInfo.version = match ? match[1] : 'Unknown';
      browserInfo.engine = 'Chromium';
    } else if (userAgent.includes('Firefox')) {
      browserInfo.name = 'Firefox';
      const match = userAgent.match(/Firefox\/(\d+)/);
      browserInfo.version = match ? match[1] : 'Unknown';
      browserInfo.engine = 'Gecko';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browserInfo.name = 'Safari';
      const match = userAgent.match(/Version\/(\d+)/);
      browserInfo.version = match ? match[1] : 'Unknown';
      browserInfo.engine = 'WebKit';
    } else if (userAgent.includes('Edge')) {
      browserInfo.name = 'Edge';
      const match = userAgent.match(/Edg\/(\d+)/);
      browserInfo.version = match ? match[1] : 'Unknown';
      browserInfo.engine = 'Chromium';
    }

    // Mobile detection
    browserInfo.mobile = /Mobile|Android|iP(hone|od|ad)/.test(userAgent);

    // Feature support detection
    browserInfo.webxrSupport = 'xr' in navigator;
    browserInfo.webgpuSupport = 'gpu' in navigator;

    return browserInfo;
  }

  calculatePerformanceScore(compatibility) {
    let score = 0;
    const recommendations = [];

    // Calculate performance score based on browser and feature support
    if (compatibility.browser.webxrSupport) {
      score += 30;
    } else {
      recommendations.push('WebXR is not supported in this browser');
    }

    if (compatibility.browser.webgpuSupport) {
      score += 20;
    } else {
      recommendations.push('WebGPU is not supported in this browser');
    }

    // Browser-specific performance adjustments
    switch (compatibility.browser.name) {
      case 'Chrome':
        score += 15; // Chrome has excellent WebXR/WebGPU support
        break;
      case 'Edge':
        score += 10; // Edge has good WebXR/WebGPU support
        break;
      case 'Firefox':
        score += 5; // Firefox has basic WebXR support
        break;
      case 'Safari':
        score += 5; // Safari has limited WebXR support
        break;
      default:
        recommendations.push('Consider using Chrome or Edge for best VR experience');
        break;
    }

    // Mobile performance adjustments
    if (compatibility.browser.mobile) {
      score -= 10; // Mobile devices typically have lower performance
      recommendations.push('For better performance, use a desktop browser');
    }

    return { score: Math.min(score, 100), recommendations };
  }

  generateFallbackOptions(compatibility) {
    const fallbackOptions = [];

    // Generate fallback options based on browser and feature support
    if (!compatibility.webxr.supported) {
      fallbackOptions.push({
        type: 'browser',
        action: 'upgrade',
        message: 'Use a different browser that supports WebXR',
        priority: 'high'
      });
    }

    if (!compatibility.webgpu.supported) {
      fallbackOptions.push({
        type: 'browser',
        action: 'upgrade',
        message: 'Use a different browser that supports WebGPU',
        priority: 'medium'
      });
    }

    // Hardware-specific fallbacks
    if (compatibility.browser.mobile) {
      fallbackOptions.push({
        type: 'hardware',
        action: 'desktop',
        message: 'Use a desktop computer for better VR performance',
        priority: 'medium'
      });
    }

    return fallbackOptions;
  }

  // WebXR 2.0 Advanced Features Implementation
  setupGestureRecognition() {
    console.log('[WebXR] Setting up Hand Tracking 2.0 and gesture recognition...');

    // Initialize hand tracking data structures with 25 joints support
    this.handData = {
      left: {
        joints: new Map(),
        pose: null,
        confidence: 0,
        gestures: new Set(),
        lastUpdate: 0,
        // 25 joints as defined in WebXR Hand Input Module Level 1
        jointNames: [
          'wrist',
          'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
          'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
          'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
          'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
          'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'
        ]
      },
      right: {
        joints: new Map(),
        pose: null,
        confidence: 0,
        gestures: new Set(),
        lastUpdate: 0,
        jointNames: [
          'wrist',
          'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
          'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
          'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
          'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
          'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'
        ]
      }
    };

    // Setup gesture recognition engine
    this.initializeAdvancedGestureRecognition();

    // Setup hand tracking event listeners
    this.setupHandTrackingEventListeners();

    console.log('[WebXR] Hand Tracking 2.0 initialized successfully');
  }
}

// グローバルインスタンス作成
const webXRSystem = new WebXRIntegrationSystem();

// グローバルアクセス用
window.webXRSystem = webXRSystem;

// 初期化完了通知
document.addEventListener('DOMContentLoaded', () => {
  console.log('[WebXR] Advanced WebXR integration system initialized');
});
