/**
 * Unified VR Extension System
 * 統合VR拡張機能システム
 *
 * 統合対象：
 * - vr-extension-loader.js (v1)
 * - vr-extension-loader-v2.js (v2)
 * - vr-extension-system.js (コアシステム)
 * - vr-extension-manager-ui.js (UI管理)
 * - vr-extension-store-3d.js (3Dストア)
 * - vr-extension-ai-recommender.js (AI推薦)
 * - vr-extension-gesture-control.js (ジェスチャー制御)
 * - vr-extension-voice-control.js (音声制御)
 * - vr-extension-sync-analytics.js (同期・分析)
 *
 * @version 3.2.0
 */

class UnifiedVRExtensionSystem {
  constructor() {
    this.initialized = false;
    this.version = '3.2.0';

    // 設定
    this.config = {
      enableAIRecommender: true,
      enableGestureControl: true,
      enableVoiceControl: true,
      enable3DStore: true,
      enableAnalytics: true,
      enableAutoUpdate: true,
      enableSandbox: true,
      maxExtensions: 50,
      cacheEnabled: true,
      syncInterval: 30000 // 30秒
    };

    // 拡張機能レジストリ
    this.extensions = new Map();
    this.activeExtensions = new Set();
    this.pendingExtensions = new Map();

    // サブシステム
    this.subsystems = {
      loader: null,
      ui: null,
      store: null,
      ai: null,
      gesture: null,
      voice: null,
      analytics: null
    };

    // 拡張機能メタデータ
    this.metadata = new Map();

    // イベントエミッター
    this.eventListeners = new Map();

    // サンドボックス環境
    this.sandboxes = new Map();

    // 分析データ
    this.analyticsData = {
      loadTimes: new Map(),
      usageStats: new Map(),
      errorCounts: new Map(),
      performanceMetrics: new Map()
    };

    // AI推薦モデル
    this.aiModel = null;

    // ジェスチャーパターン
    this.gesturePatterns = new Map();

    // 音声コマンド
    this.voiceCommands = new Map();
  }

  /**
   * システムの初期化
   */
  async initialize() {
    if (this.initialized) {
      console.warn('UnifiedVRExtensionSystem: Already initialized');
      return this;
    }

    try {
      console.info('Initializing Unified VR Extension System...');

      // サブシステムの初期化
      await this.initializeLoader();
      await this.initializeUI();

      if (this.config.enable3DStore) {
        await this.initializeStore();
      }

      if (this.config.enableAIRecommender) {
        await this.initializeAIRecommender();
      }

      if (this.config.enableGestureControl) {
        await this.initializeGestureControl();
      }

      if (this.config.enableVoiceControl) {
        await this.initializeVoiceControl();
      }

      if (this.config.enableAnalytics) {
        await this.initializeAnalytics();
      }

      // デフォルト拡張機能の読み込み
      await this.loadDefaultExtensions();

      // 自動更新の設定
      if (this.config.enableAutoUpdate) {
        this.setupAutoUpdate();
      }

      this.initialized = true;
      console.info('Unified VR Extension System initialized successfully');

      this.emit('initialized', { version: this.version });

      return this;
    } catch (error) {
      console.error('Failed to initialize Unified VR Extension System:', error);
      throw error;
    }
  }

  /**
   * ローダーの初期化
   */
  async initializeLoader() {
    this.subsystems.loader = new ExtensionLoader(this);

    // 拡張機能のマニフェスト検証
    this.subsystems.loader.validateManifest = (manifest) => {
      const required = ['id', 'name', 'version', 'main'];
      for (const field of required) {
        if (!manifest[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // バージョン互換性チェック
      if (manifest.minVersion && !this.isVersionCompatible(manifest.minVersion)) {
        throw new Error(`Extension requires version ${manifest.minVersion} or higher`);
      }

      return true;
    };
  }

  /**
   * UIの初期化
   */
  async initializeUI() {
    this.subsystems.ui = new ExtensionUI(this);

    // UIパネルの作成
    this.subsystems.ui.createPanel = () => {
      const panel = document.createElement('div');
      panel.id = 'vr-extension-panel';
      panel.className = 'vr-extension-panel';
      panel.innerHTML = `
        <div class="extension-panel-header">
          <h3>VR Extensions</h3>
          <button class="panel-close">×</button>
        </div>
        <div class="extension-panel-tabs">
          <button class="tab-btn active" data-tab="installed">Installed</button>
          <button class="tab-btn" data-tab="store">Store</button>
          <button class="tab-btn" data-tab="settings">Settings</button>
        </div>
        <div class="extension-panel-content">
          <div class="tab-content active" id="installed-tab">
            <div class="extension-list" id="installed-extensions"></div>
          </div>
          <div class="tab-content" id="store-tab">
            <div class="extension-search">
              <input type="text" placeholder="Search extensions..." id="extension-search">
            </div>
            <div class="extension-list" id="store-extensions"></div>
          </div>
          <div class="tab-content" id="settings-tab">
            <div class="extension-settings"></div>
          </div>
        </div>
      `;

      this.addPanelStyles();
      document.body.appendChild(panel);
      this.setupPanelEventListeners(panel);

      return panel;
    };
  }

  /**
   * ストアの初期化
   */
  async initializeStore() {
    this.subsystems.store = new Extension3DStore(this);

    // 3Dストア環境の構築
    if (window.THREE && window.scene) {
      this.subsystems.store.create3DEnvironment = () => {
        const storeGroup = new window.THREE.Group();
        storeGroup.name = 'ExtensionStore';

        // ストア空間の作成
        const geometry = new window.THREE.BoxGeometry(10, 5, 10);
        const material = new window.THREE.MeshBasicMaterial({
          color: 0x2c3e50,
          transparent: true,
          opacity: 0.8,
          side: window.THREE.BackSide
        });

        const storeRoom = new window.THREE.Mesh(geometry, material);
        storeGroup.add(storeRoom);

        // 拡張機能の3D表示
        this.createExtensionDisplays(storeGroup);

        return storeGroup;
      };
    }

    // ストアカタログの読み込み
    await this.loadStoreCatalog();
  }

  /**
   * AI推薦システムの初期化
   */
  async initializeAIRecommender() {
    this.subsystems.ai = new AIRecommender(this);

    // 簡易推薦アルゴリズム
    this.subsystems.ai.recommend = () => {
      const recommendations = [];
      const userPreferences = this.getUserPreferences();
      const usageHistory = this.getUsageHistory();

      // 使用頻度ベースの推薦
      for (const [extensionId, usage] of usageHistory) {
        const extension = this.extensions.get(extensionId);
        if (extension && !this.activeExtensions.has(extensionId)) {
          recommendations.push({
            extension,
            score: usage.frequency * 0.5 + usage.rating * 0.3 + usage.recency * 0.2
          });
        }
      }

      // カテゴリベースの推薦
      for (const category of userPreferences.categories) {
        const categoryExtensions = this.getExtensionsByCategory(category);
        for (const extension of categoryExtensions) {
          if (!recommendations.find(r => r.extension.id === extension.id)) {
            recommendations.push({
              extension,
              score: 0.5
            });
          }
        }
      }

      // スコアでソート
      recommendations.sort((a, b) => b.score - a.score);

      return recommendations.slice(0, 5);
    };

    // 機械学習モデル（簡易版）
    this.trainAIModel();
  }

  /**
   * ジェスチャーコントロールの初期化
   */
  async initializeGestureControl() {
    this.subsystems.gesture = new GestureControl(this);

    // 基本ジェスチャーパターンの登録
    this.registerGesturePatterns();

    // ジェスチャー認識の開始
    if (window.handTracking) {
      this.subsystems.gesture.startRecognition = () => {
        window.handTracking.on('gesture', (gesture) => {
          this.handleGesture(gesture);
        });
      };
    }
  }

  /**
   * 音声コントロールの初期化
   */
  async initializeVoiceControl() {
    this.subsystems.voice = new VoiceControl(this);

    // 音声認識の設定
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.subsystems.voice.recognition = new SpeechRecognition();
      this.subsystems.voice.recognition.continuous = true;
      this.subsystems.voice.recognition.interimResults = true;
      this.subsystems.voice.recognition.lang = 'en-US';

      // 音声コマンドの登録
      this.registerVoiceCommands();

      this.subsystems.voice.recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        this.handleVoiceCommand(transcript);
      };
    }
  }

  /**
   * 分析システムの初期化
   */
  async initializeAnalytics() {
    this.subsystems.analytics = new ExtensionAnalytics(this);

    // 分析データ収集の開始
    this.subsystems.analytics.startCollection = () => {
      // パフォーマンスメトリクス
      this.trackPerformanceMetrics();

      // 使用統計
      this.trackUsageStatistics();

      // エラー追跡
      this.trackErrors();

      // 定期レポート
      setInterval(() => {
        this.generateAnalyticsReport();
      }, this.config.syncInterval);
    };

    this.subsystems.analytics.startCollection();
  }

  /**
   * 拡張機能の読み込み
   */
  async loadExtension(manifest, options = {}) {
    const startTime = performance.now();

    try {
      // マニフェストの検証
      this.subsystems.loader.validateManifest(manifest);

      // 既存チェック
      if (this.extensions.has(manifest.id)) {
        console.warn(`Extension ${manifest.id} is already loaded`);
        return this.extensions.get(manifest.id);
      }

      // 依存関係の解決
      await this.resolveDependencies(manifest);

      // サンドボックスの作成（必要な場合）
      let sandbox = null;
      if (this.config.enableSandbox && manifest.permissions?.includes('sandbox')) {
        sandbox = this.createSandbox(manifest.id);
      }

      // 拡張機能のロード
      const extension = await this.loadExtensionCode(manifest, sandbox);

      // メタデータの保存
      this.metadata.set(manifest.id, {
        manifest,
        loadTime: performance.now() - startTime,
        loadedAt: Date.now(),
        sandbox,
        status: 'loaded'
      });

      // 拡張機能の登録
      this.extensions.set(manifest.id, extension);

      // 初期化
      if (extension.initialize) {
        await extension.initialize();
      }

      // イベント発火
      this.emit('extension:loaded', { id: manifest.id, extension });

      // 分析データの記録
      this.recordLoadMetrics(manifest.id, performance.now() - startTime);

      console.info(`Extension ${manifest.name} loaded successfully`);

      return extension;
    } catch (error) {
      console.error(`Failed to load extension ${manifest.id}:`, error);
      this.recordError(manifest.id, error);
      throw error;
    }
  }

  /**
   * 拡張機能コードの読み込み
   */
  async loadExtensionCode(manifest, sandbox) {
    if (manifest.type === 'script') {
      // スクリプトタイプ
      return await this.loadScriptExtension(manifest, sandbox);
    } else if (manifest.type === 'module') {
      // モジュールタイプ
      return await this.loadModuleExtension(manifest, sandbox);
    } else if (manifest.type === 'webassembly') {
      // WebAssemblyタイプ
      return await this.loadWasmExtension(manifest);
    } else {
      throw new Error(`Unknown extension type: ${manifest.type}`);
    }
  }

  /**
   * スクリプト拡張機能の読み込み
   */
  async loadScriptExtension(manifest, sandbox) {
    const response = await fetch(manifest.main);
    const code = await response.text();

    if (sandbox) {
      // サンドボックス内で実行
      return sandbox.execute(code);
    } else {
      // グローバルスコープで実行
      const func = new Function('exports', 'require', 'module', code);
      const exports = {};
      const module = { exports };
      func(exports, this.createRequire(manifest), module);
      return module.exports;
    }
  }

  /**
   * モジュール拡張機能の読み込み
   */
  async loadModuleExtension(manifest, sandbox) {
    if (sandbox) {
      // サンドボックス内でのモジュールロード
      return sandbox.import(manifest.main);
    } else {
      // Dynamic import
      return await import(manifest.main);
    }
  }

  /**
   * WebAssembly拡張機能の読み込み
   */
  async loadWasmExtension(manifest) {
    const response = await fetch(manifest.main);
    const buffer = await response.arrayBuffer();
    const module = await WebAssembly.compile(buffer);
    const instance = await WebAssembly.instantiate(module, manifest.imports || {});
    return instance.exports;
  }

  /**
   * 依存関係の解決
   */
  async resolveDependencies(manifest) {
    if (!manifest.dependencies) return;

    for (const dep of manifest.dependencies) {
      if (!this.extensions.has(dep.id)) {
        // 依存拡張機能を読み込む
        await this.installExtension(dep.id, dep.version);
      }
    }
  }

  /**
   * サンドボックスの作成
   */
  createSandbox(extensionId) {
    const sandbox = {
      id: extensionId,
      context: {},
      permissions: new Set(),

      execute: (code) => {
        // 制限された環境での実行
        const sandboxFunction = new Function(
          'console', 'fetch', 'setTimeout', 'setInterval',
          `
          'use strict';
          ${code}
          `
        );

        // 制限されたAPIを提供
        return sandboxFunction(
          this.createSafeConsole(extensionId),
          this.createSafeFetch(extensionId),
          this.createSafeTimeout(extensionId),
          this.createSafeInterval(extensionId)
        );
      },

      import: async (path) => {
        // サンドボックス化されたモジュールインポート
        const module = await import(path);
        return this.wrapModule(module, extensionId);
      }
    };

    this.sandboxes.set(extensionId, sandbox);
    return sandbox;
  }

  /**
   * 安全なconsoleの作成
   */
  createSafeConsole(extensionId) {
    return {
      log: (...args) => console.log(`[${extensionId}]`, ...args),
      info: (...args) => console.info(`[${extensionId}]`, ...args),
      warn: (...args) => console.warn(`[${extensionId}]`, ...args),
      error: (...args) => console.error(`[${extensionId}]`, ...args)
    };
  }

  /**
   * 安全なfetchの作成
   */
  createSafeFetch(extensionId) {
    return async (url, options) => {
      // URLの検証
      if (!this.isAllowedURL(url, extensionId)) {
        throw new Error('URL not allowed for this extension');
      }

      // リクエストのログ
      console.info(`[${extensionId}] Fetching:`, url);

      return fetch(url, options);
    };
  }

  /**
   * 安全なsetTimeoutの作成
   */
  createSafeTimeout(extensionId) {
    const timeouts = new Set();

    return (fn, delay) => {
      const id = setTimeout(() => {
        timeouts.delete(id);
        fn();
      }, delay);

      timeouts.add(id);

      // 最大実行時間の制限
      if (delay > 60000) {
        console.warn(`[${extensionId}] Long timeout detected:`, delay);
      }

      return id;
    };
  }

  /**
   * 安全なsetIntervalの作成
   */
  createSafeInterval(extensionId) {
    const intervals = new Set();

    return (fn, delay) => {
      // 最小間隔の制限
      const safeDelay = Math.max(delay, 100);

      const id = setInterval(() => {
        fn();
      }, safeDelay);

      intervals.add(id);

      // 警告
      if (intervals.size > 10) {
        console.warn(`[${extensionId}] Too many intervals:`, intervals.size);
      }

      return id;
    };
  }

  /**
   * requireの作成
   */
  createRequire(manifest) {
    return (moduleId) => {
      // 許可されたモジュールのみ
      const allowed = manifest.permissions?.includes(moduleId);
      if (!allowed) {
        throw new Error(`Module ${moduleId} not allowed for this extension`);
      }

      // ビルトインモジュール
      const builtins = {
        'three': window.THREE,
        'vr-api': this.createExtensionAPI(manifest.id)
      };

      return builtins[moduleId];
    };
  }

  /**
   * 拡張機能APIの作成
   */
  createExtensionAPI(extensionId) {
    return {
      version: this.version,

      // イベントAPI
      on: (event, handler) => this.on(`${extensionId}:${event}`, handler),
      off: (event, handler) => this.off(`${extensionId}:${event}`, handler),
      emit: (event, data) => this.emit(`${extensionId}:${event}`, data),

      // ストレージAPI
      storage: {
        get: (key) => this.getExtensionData(extensionId, key),
        set: (key, value) => this.setExtensionData(extensionId, key, value),
        remove: (key) => this.removeExtensionData(extensionId, key)
      },

      // UI API
      ui: {
        showPanel: () => this.showExtensionPanel(extensionId),
        hidePanel: () => this.hideExtensionPanel(extensionId),
        createButton: (options) => this.createExtensionButton(extensionId, options),
        showNotification: (message) => this.showExtensionNotification(extensionId, message)
      },

      // VR API
      vr: {
        getSession: () => window.xrSession,
        getController: (index) => window.xrControllers?.[index],
        vibrate: (intensity, duration) => this.vibrateController(intensity, duration)
      }
    };
  }

  /**
   * 拡張機能のアクティベート
   */
  async activateExtension(extensionId) {
    const extension = this.extensions.get(extensionId);
    if (!extension) {
      throw new Error(`Extension ${extensionId} not found`);
    }

    if (this.activeExtensions.has(extensionId)) {
      console.warn(`Extension ${extensionId} is already active`);
      return;
    }

    // アクティベート
    if (extension.activate) {
      await extension.activate();
    }

    this.activeExtensions.add(extensionId);

    // メタデータ更新
    const metadata = this.metadata.get(extensionId);
    if (metadata) {
      metadata.status = 'active';
    }

    this.emit('extension:activated', { id: extensionId });

    console.info(`Extension ${extensionId} activated`);
  }

  /**
   * 拡張機能の無効化
   */
  async deactivateExtension(extensionId) {
    const extension = this.extensions.get(extensionId);
    if (!extension) {
      throw new Error(`Extension ${extensionId} not found`);
    }

    if (!this.activeExtensions.has(extensionId)) {
      console.warn(`Extension ${extensionId} is not active`);
      return;
    }

    // 無効化
    if (extension.deactivate) {
      await extension.deactivate();
    }

    this.activeExtensions.delete(extensionId);

    // メタデータ更新
    const metadata = this.metadata.get(extensionId);
    if (metadata) {
      metadata.status = 'inactive';
    }

    this.emit('extension:deactivated', { id: extensionId });

    console.info(`Extension ${extensionId} deactivated`);
  }

  /**
   * 拡張機能のアンインストール
   */
  async uninstallExtension(extensionId) {
    // 無効化
    if (this.activeExtensions.has(extensionId)) {
      await this.deactivateExtension(extensionId);
    }

    const extension = this.extensions.get(extensionId);
    if (extension) {
      // クリーンアップ
      if (extension.uninstall) {
        await extension.uninstall();
      }

      // サンドボックスの削除
      const sandbox = this.sandboxes.get(extensionId);
      if (sandbox) {
        // サンドボックスのクリーンアップ
        this.sandboxes.delete(extensionId);
      }
    }

    // 登録解除
    this.extensions.delete(extensionId);
    this.metadata.delete(extensionId);

    // ストレージクリア
    this.clearExtensionData(extensionId);

    this.emit('extension:uninstalled', { id: extensionId });

    console.info(`Extension ${extensionId} uninstalled`);
  }

  /**
   * デフォルト拡張機能の読み込み
   */
  async loadDefaultExtensions() {
    const defaultExtensions = [
      {
        id: 'vr-navigation',
        name: 'VR Navigation',
        version: '1.0.0',
        type: 'builtin',
        main: '/assets/js/extensions/vr-navigation.js'
      },
      {
        id: 'gesture-shortcuts',
        name: 'Gesture Shortcuts',
        version: '1.0.0',
        type: 'builtin',
        main: '/assets/js/extensions/gesture-shortcuts.js'
      }
    ];

    for (const manifest of defaultExtensions) {
      try {
        await this.loadExtension(manifest);
        await this.activateExtension(manifest.id);
      } catch (error) {
        console.warn(`Failed to load default extension ${manifest.id}:`, error);
      }
    }
  }

  /**
   * ストアカタログの読み込み
   */
  async loadStoreCatalog() {
    try {
      // 実装: ストアカタログの取得
      // const response = await fetch('/api/extensions/catalog');
      // const catalog = await response.json();

      // ダミーカタログ
      const catalog = [
        {
          id: 'vr-paint',
          name: 'VR Paint',
          description: '3D painting in VR',
          version: '2.0.0',
          author: 'VR Labs',
          rating: 4.5,
          downloads: 1000
        },
        {
          id: 'social-vr',
          name: 'Social VR',
          description: 'Multiplayer VR browsing',
          version: '1.5.0',
          author: 'Social Team',
          rating: 4.8,
          downloads: 5000
        }
      ];

      this.subsystems.store.catalog = catalog;

      return catalog;
    } catch (error) {
      console.error('Failed to load store catalog:', error);
      return [];
    }
  }

  /**
   * ジェスチャーパターンの登録
   */
  registerGesturePatterns() {
    // 基本ジェスチャー
    this.gesturePatterns.set('swipe_right', {
      pattern: ['hand_open', 'move_right', 'hand_open'],
      action: () => this.navigateNext()
    });

    this.gesturePatterns.set('swipe_left', {
      pattern: ['hand_open', 'move_left', 'hand_open'],
      action: () => this.navigatePrevious()
    });

    this.gesturePatterns.set('pinch', {
      pattern: ['fingers_together'],
      action: () => this.zoomIn()
    });

    this.gesturePatterns.set('spread', {
      pattern: ['fingers_apart'],
      action: () => this.zoomOut()
    });

    this.gesturePatterns.set('grab', {
      pattern: ['hand_closed'],
      action: () => this.grabObject()
    });

    this.gesturePatterns.set('point', {
      pattern: ['index_extended'],
      action: () => this.selectObject()
    });
  }

  /**
   * 音声コマンドの登録
   */
  registerVoiceCommands() {
    // 基本コマンド
    this.voiceCommands.set('open extensions', () => {
      this.showExtensionPanel();
    });

    this.voiceCommands.set('close extensions', () => {
      this.hideExtensionPanel();
    });

    this.voiceCommands.set('install', (args) => {
      const extensionName = args.join(' ');
      this.searchAndInstall(extensionName);
    });

    this.voiceCommands.set('activate', (args) => {
      const extensionName = args.join(' ');
      this.activateByName(extensionName);
    });

    this.voiceCommands.set('deactivate', (args) => {
      const extensionName = args.join(' ');
      this.deactivateByName(extensionName);
    });
  }

  /**
   * ジェスチャーの処理
   */
  handleGesture(gesture) {
    const pattern = this.gesturePatterns.get(gesture.type);
    if (pattern && pattern.action) {
      pattern.action();
      this.recordGestureUsage(gesture.type);
    }
  }

  /**
   * 音声コマンドの処理
   */
  handleVoiceCommand(transcript) {
    const words = transcript.toLowerCase().trim().split(' ');

    for (const [command, action] of this.voiceCommands) {
      const commandWords = command.split(' ');
      if (words.slice(0, commandWords.length).join(' ') === command) {
        const args = words.slice(commandWords.length);
        action(args);
        this.recordVoiceUsage(command);
        break;
      }
    }
  }

  /**
   * パネルスタイルの追加
   */
  addPanelStyles() {
    const styleId = 'vr-extension-panel-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .vr-extension-panel {
        position: fixed;
        right: 20px;
        top: 20px;
        width: 400px;
        max-height: 600px;
        background: rgba(30, 30, 40, 0.95);
        border-radius: 10px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        z-index: 9999;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        transform: translateX(450px);
        transition: transform 0.3s ease;
      }

      .vr-extension-panel.visible {
        transform: translateX(0);
      }

      .extension-panel-header {
        padding: 20px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .extension-panel-tabs {
        display: flex;
        border-bottom: 1px solid rgba(255,255,255,0.1);
      }

      .tab-btn {
        flex: 1;
        padding: 15px;
        background: none;
        border: none;
        color: rgba(255,255,255,0.6);
        cursor: pointer;
        transition: all 0.3s;
      }

      .tab-btn.active {
        color: white;
        border-bottom: 2px solid #4a9eff;
      }

      .extension-panel-content {
        max-height: 400px;
        overflow-y: auto;
      }

      .tab-content {
        display: none;
        padding: 20px;
      }

      .tab-content.active {
        display: block;
      }

      .extension-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .extension-item {
        padding: 15px;
        background: rgba(255,255,255,0.05);
        border-radius: 8px;
        transition: background 0.3s;
      }

      .extension-item:hover {
        background: rgba(255,255,255,0.1);
      }

      .extension-search {
        margin-bottom: 20px;
      }

      .extension-search input {
        width: 100%;
        padding: 10px 15px;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 5px;
        color: white;
        outline: none;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * パネルイベントリスナーの設定
   */
  setupPanelEventListeners(panel) {
    // タブ切り替え
    const tabBtns = panel.querySelectorAll('.tab-btn');
    const tabContents = panel.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;

        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(`${targetTab}-tab`)?.classList.add('active');
      });
    });

    // 閉じるボタン
    panel.querySelector('.panel-close')?.addEventListener('click', () => {
      this.hideExtensionPanel();
    });

    // 検索
    const searchInput = panel.querySelector('#extension-search');
    searchInput?.addEventListener('input', (e) => {
      this.searchExtensions(e.target.value);
    });
  }

  /**
   * 拡張機能パネルの表示
   */
  showExtensionPanel() {
    let panel = document.getElementById('vr-extension-panel');
    if (!panel) {
      panel = this.subsystems.ui.createPanel();
    }
    panel.classList.add('visible');
    this.updateExtensionList();
  }

  /**
   * 拡張機能パネルを隠す
   */
  hideExtensionPanel() {
    const panel = document.getElementById('vr-extension-panel');
    if (panel) {
      panel.classList.remove('visible');
    }
  }

  /**
   * 拡張機能リストの更新
   */
  updateExtensionList() {
    const installedList = document.getElementById('installed-extensions');
    if (!installedList) return;

    installedList.innerHTML = '';

    for (const [id, extension] of this.extensions) {
      const metadata = this.metadata.get(id);
      const item = document.createElement('div');
      item.className = 'extension-item';
      item.innerHTML = `
        <h4>${metadata?.manifest?.name || id}</h4>
        <p>${metadata?.manifest?.description || 'No description'}</p>
        <div class="extension-controls">
          <button onclick="unifiedVRExtensions.toggleExtension('${id}')">
            ${this.activeExtensions.has(id) ? 'Deactivate' : 'Activate'}
          </button>
          <button onclick="unifiedVRExtensions.uninstallExtension('${id}')">
            Uninstall
          </button>
        </div>
      `;
      installedList.appendChild(item);
    }
  }

  /**
   * 拡張機能の切り替え
   */
  async toggleExtension(extensionId) {
    if (this.activeExtensions.has(extensionId)) {
      await this.deactivateExtension(extensionId);
    } else {
      await this.activateExtension(extensionId);
    }
    this.updateExtensionList();
  }

  /**
   * 拡張機能の検索
   */
  searchExtensions(query) {
    if (!this.subsystems.store?.catalog) return;

    const results = this.subsystems.store.catalog.filter(ext =>
      ext.name.toLowerCase().includes(query.toLowerCase()) ||
      ext.description.toLowerCase().includes(query.toLowerCase())
    );

    this.displaySearchResults(results);
  }

  /**
   * 検索結果の表示
   */
  displaySearchResults(results) {
    const storeList = document.getElementById('store-extensions');
    if (!storeList) return;

    storeList.innerHTML = '';

    for (const ext of results) {
      const item = document.createElement('div');
      item.className = 'extension-item';
      item.innerHTML = `
        <h4>${ext.name}</h4>
        <p>${ext.description}</p>
        <p>⭐ ${ext.rating} | 📥 ${ext.downloads}</p>
        <button onclick="unifiedVRExtensions.installFromStore('${ext.id}')">
          Install
        </button>
      `;
      storeList.appendChild(item);
    }
  }

  /**
   * ストアから拡張機能をインストール
   */
  async installFromStore(extensionId) {
    try {
      // 実装: ストアからマニフェストを取得
      // const response = await fetch(`/api/extensions/${extensionId}/manifest`);
      // const manifest = await response.json();

      // ダミーマニフェスト
      const manifest = {
        id: extensionId,
        name: 'Downloaded Extension',
        version: '1.0.0',
        type: 'script',
        main: `/assets/js/extensions/${extensionId}.js`
      };

      await this.loadExtension(manifest);
      await this.activateExtension(extensionId);

      this.updateExtensionList();

      console.info(`Extension ${extensionId} installed from store`);
    } catch (error) {
      console.error(`Failed to install extension ${extensionId}:`, error);
    }
  }

  /**
   * パフォーマンスメトリクスの追跡
   */
  trackPerformanceMetrics() {
    for (const [id, extension] of this.extensions) {
      if (this.activeExtensions.has(id)) {
        const metrics = {
          memoryUsage: performance.memory?.usedJSHeapSize || 0,
          cpuTime: performance.now()
        };

        this.analyticsData.performanceMetrics.set(id, metrics);
      }
    }
  }

  /**
   * 使用統計の追跡
   */
  trackUsageStatistics() {
    for (const extensionId of this.activeExtensions) {
      const stats = this.analyticsData.usageStats.get(extensionId) || {
        activations: 0,
        totalTime: 0,
        lastUsed: Date.now()
      };

      stats.totalTime += this.config.syncInterval;
      this.analyticsData.usageStats.set(extensionId, stats);
    }
  }

  /**
   * エラーの追跡
   */
  trackErrors() {
    // エラーハンドラーとの統合
    if (window.errorHandler) {
      const errors = window.errorHandler.errorHistory.filter(e =>
        e.category === 'extension' && e.timestamp > Date.now() - this.config.syncInterval
      );

      for (const error of errors) {
        const extensionId = error.extensionId;
        if (extensionId) {
          const count = this.analyticsData.errorCounts.get(extensionId) || 0;
          this.analyticsData.errorCounts.set(extensionId, count + 1);
        }
      }
    }
  }

  /**
   * 分析レポートの生成
   */
  generateAnalyticsReport() {
    const report = {
      timestamp: Date.now(),
      activeExtensions: Array.from(this.activeExtensions),
      performanceMetrics: Object.fromEntries(this.analyticsData.performanceMetrics),
      usageStats: Object.fromEntries(this.analyticsData.usageStats),
      errorCounts: Object.fromEntries(this.analyticsData.errorCounts),
      recommendations: this.subsystems.ai?.recommend() || []
    };

    this.emit('analytics:report', report);

    return report;
  }

  /**
   * 自動更新の設定
   */
  setupAutoUpdate() {
    setInterval(async () => {
      for (const [id, extension] of this.extensions) {
        const metadata = this.metadata.get(id);
        if (metadata?.manifest?.updateUrl) {
          try {
            await this.checkForUpdate(id, metadata.manifest.updateUrl);
          } catch (error) {
            console.warn(`Failed to check update for ${id}:`, error);
          }
        }
      }
    }, 3600000); // 1時間ごと
  }

  /**
   * 更新チェック
   */
  async checkForUpdate(extensionId, updateUrl) {
    // 実装: 更新チェック
    // const response = await fetch(updateUrl);
    // const latestManifest = await response.json();
    // if (latestManifest.version > currentVersion) {
    //   await this.updateExtension(extensionId, latestManifest);
    // }
  }

  /**
   * AIモデルの訓練
   */
  trainAIModel() {
    // 簡易的な協調フィルタリング
    // 実際の実装では機械学習ライブラリを使用
  }

  /**
   * ユーザー設定の取得
   */
  getUserPreferences() {
    return JSON.parse(localStorage.getItem('extension_preferences') || '{}');
  }

  /**
   * 使用履歴の取得
   */
  getUsageHistory() {
    return this.analyticsData.usageStats;
  }

  /**
   * カテゴリ別拡張機能の取得
   */
  getExtensionsByCategory(category) {
    const results = [];
    for (const [id, extension] of this.extensions) {
      const metadata = this.metadata.get(id);
      if (metadata?.manifest?.category === category) {
        results.push(extension);
      }
    }
    return results;
  }

  /**
   * バージョン互換性チェック
   */
  isVersionCompatible(minVersion) {
    const current = this.version.split('.').map(Number);
    const required = minVersion.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (current[i] < required[i]) return false;
      if (current[i] > required[i]) return true;
    }
    return true;
  }

  /**
   * URL許可チェック
   */
  isAllowedURL(url, extensionId) {
    const metadata = this.metadata.get(extensionId);
    const permissions = metadata?.manifest?.permissions || [];

    // URLパターンマッチング
    for (const pattern of permissions) {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        if (regex.test(url)) return true;
      } else if (url.startsWith(pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 拡張機能データの取得
   */
  getExtensionData(extensionId, key) {
    const storageKey = `ext_${extensionId}_${key}`;
    return JSON.parse(localStorage.getItem(storageKey) || 'null');
  }

  /**
   * 拡張機能データの設定
   */
  setExtensionData(extensionId, key, value) {
    const storageKey = `ext_${extensionId}_${key}`;
    localStorage.setItem(storageKey, JSON.stringify(value));
  }

  /**
   * 拡張機能データの削除
   */
  removeExtensionData(extensionId, key) {
    const storageKey = `ext_${extensionId}_${key}`;
    localStorage.removeItem(storageKey);
  }

  /**
   * 拡張機能データのクリア
   */
  clearExtensionData(extensionId) {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`ext_${extensionId}_`)) {
        keys.push(key);
      }
    }
    keys.forEach(key => localStorage.removeItem(key));
  }

  /**
   * ロードメトリクスの記録
   */
  recordLoadMetrics(extensionId, loadTime) {
    this.analyticsData.loadTimes.set(extensionId, {
      time: loadTime,
      timestamp: Date.now()
    });
  }

  /**
   * エラーの記録
   */
  recordError(extensionId, error) {
    const count = this.analyticsData.errorCounts.get(extensionId) || 0;
    this.analyticsData.errorCounts.set(extensionId, count + 1);

    if (window.errorHandler) {
      window.errorHandler.handleError({
        category: 'extension',
        extensionId,
        message: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * ジェスチャー使用の記録
   */
  recordGestureUsage(gestureType) {
    // 実装: ジェスチャー使用統計
  }

  /**
   * 音声使用の記録
   */
  recordVoiceUsage(command) {
    // 実装: 音声コマンド使用統計
  }

  /**
   * イベントエミッター - emit
   */
  emit(event, data) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * イベントエミッター - on
   */
  on(event, listener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(listener);
    return this;
  }

  /**
   * イベントエミッター - off
   */
  off(event, listener) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
    return this;
  }

  /**
   * システムの破棄
   */
  destroy() {
    // サンドボックスのクリーンアップ
    for (const sandbox of this.sandboxes.values()) {
      // クリーンアップ処理
    }

    // 拡張機能の無効化
    for (const extensionId of this.activeExtensions) {
      this.deactivateExtension(extensionId);
    }

    // データのクリア
    this.extensions.clear();
    this.activeExtensions.clear();
    this.pendingExtensions.clear();
    this.metadata.clear();
    this.sandboxes.clear();
    this.eventListeners.clear();

    this.initialized = false;

    console.info('Unified VR Extension System destroyed');
  }
}

// サブシステムクラス
class ExtensionLoader {
  constructor(system) {
    this.system = system;
  }
}

class ExtensionUI {
  constructor(system) {
    this.system = system;
  }
}

class Extension3DStore {
  constructor(system) {
    this.system = system;
    this.catalog = [];
  }
}

class AIRecommender {
  constructor(system) {
    this.system = system;
  }
}

class GestureControl {
  constructor(system) {
    this.system = system;
  }
}

class VoiceControl {
  constructor(system) {
    this.system = system;
    this.recognition = null;
  }
}

class ExtensionAnalytics {
  constructor(system) {
    this.system = system;
  }
}

// シングルトンインスタンスの作成
const unifiedVRExtensions = new UnifiedVRExtensionSystem();

// DOMContentLoaded時に自動初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    unifiedVRExtensions.initialize();
  });
} else {
  unifiedVRExtensions.initialize();
}

// グローバルに公開
window.UnifiedVRExtensionSystem = UnifiedVRExtensionSystem;
window.unifiedVRExtensions = unifiedVRExtensions;

// 後方互換性のためのエイリアス
window.VRExtensionLoader = unifiedVRExtensions;
window.VRExtensionSystem = unifiedVRExtensions;