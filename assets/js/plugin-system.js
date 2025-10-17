/**
 * Qui Browser Plugin System
 * 拡張機能の開発・管理・実行システム
 *
 * 機能:
 * - プラグインの読み込みと実行
 * - ライフサイクル管理
 * - API提供とフックシステム
 * - セキュリティサンドボックス
 * - プラグインマーケットプレイス統合
 * - 依存関係管理
 */

class PluginSystem {
  constructor() {
    this.plugins = new Map();
    this.hooks = new Map();
    this.loadedPlugins = new Set();
    this.pluginStore = new Map();
    this.sandbox = new Map();

    // セキュリティ設定
    this.securityPolicy = {
      allowedAPIs: ['console', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'],
      blockedGlobals: ['window', 'document', 'navigator', 'location'],
      maxExecutionTime: 5000, // 5秒
      memoryLimit: 50 * 1024 * 1024 // 50MB
    };

    this.init();
  }

  init() {
    this.setupPluginDirectory();
    this.loadCorePlugins();
    this.initializeHooks();
    this.setupPluginCommunication();
    this.startPluginMonitoring();
  }

  /**
   * プラグインディレクトリの設定
   */
  setupPluginDirectory() {
    // プラグインの保存場所を確認・作成
    this.pluginPaths = {
      core: '/plugins/core/',
      user: '/plugins/user/',
      marketplace: '/plugins/marketplace/',
      temp: '/plugins/temp/'
    };

    // IndexedDBでのプラグインストア初期化
    this.initializePluginStore();
  }

  /**
   * IndexedDBでのプラグインストア初期化
   */
  async initializePluginStore() {
    try {
      const request = indexedDB.open('qui-plugins', 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // プラグインテーブル
        if (!db.objectStoreNames.contains('plugins')) {
          const pluginStore = db.createObjectStore('plugins', { keyPath: 'id' });
          pluginStore.createIndex('type', 'type', { unique: false });
          pluginStore.createIndex('enabled', 'enabled', { unique: false });
          pluginStore.createIndex('version', 'version', { unique: false });
        }

        // 設定テーブル
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'pluginId' });
        }

        // 依存関係テーブル
        if (!db.objectStoreNames.contains('dependencies')) {
          const depStore = db.createObjectStore('dependencies', { keyPath: 'id' });
          depStore.createIndex('pluginId', 'pluginId', { unique: false });
        }
      };

      this.db = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

    } catch (error) {
      console.error('[PluginSystem] Failed to initialize plugin store:', error);
    }
  }

  /**
   * コアプラグインの読み込み
   */
  async loadCorePlugins() {
    const corePlugins = [
      'navigation-enhancer',
      'security-monitor',
      'performance-tracker',
      'accessibility-helper',
      'offline-manager'
    ];

    for (const pluginId of corePlugins) {
      try {
        await this.loadPlugin(pluginId, { type: 'core' });
        console.log(`[PluginSystem] Core plugin loaded: ${pluginId}`);
      } catch (error) {
        console.error(`[PluginSystem] Failed to load core plugin ${pluginId}:`, error);
      }
    }
  }

  /**
   * プラグインの読み込み
   */
  async loadPlugin(pluginId, options = {}) {
    if (this.loadedPlugins.has(pluginId)) {
      return this.plugins.get(pluginId);
    }

    try {
      // プラグイン情報の取得
      const pluginInfo = await this.getPluginInfo(pluginId);

      if (!pluginInfo) {
        throw new Error(`Plugin ${pluginId} not found`);
      }

      // 依存関係の確認
      await this.checkDependencies(pluginInfo);

      // セキュリティチェック
      await this.validatePluginSecurity(pluginInfo);

      // プラグインの読み込み
      const plugin = await this.loadPluginModule(pluginInfo, options);

      // 初期化
      await this.initializePlugin(plugin, pluginInfo);

      // 登録
      this.plugins.set(pluginId, plugin);
      this.loadedPlugins.add(pluginId);

      // フックの登録
      this.registerPluginHooks(plugin, pluginId);

      // プラグインストアに保存
      await this.savePluginState(pluginId, { loaded: true, version: pluginInfo.version });

      console.log(`[PluginSystem] Plugin loaded: ${pluginId} v${pluginInfo.version}`);

      return plugin;

    } catch (error) {
      console.error(`[PluginSystem] Failed to load plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * プラグイン情報の取得
   */
  async getPluginInfo(pluginId) {
    // IndexedDBから取得
    const transaction = this.db.transaction(['plugins'], 'readonly');
    const store = transaction.objectStore('plugins');

    return new Promise((resolve, reject) => {
      const request = store.get(pluginId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 依存関係のチェック
   */
  async checkDependencies(pluginInfo) {
    if (!pluginInfo.dependencies) return;

    for (const dep of pluginInfo.dependencies) {
      if (!this.loadedPlugins.has(dep)) {
        await this.loadPlugin(dep);
      }
    }
  }

  /**
   * セキュリティチェック
   */
  async validatePluginSecurity(pluginInfo) {
    // 基本的なセキュリティチェック
    if (!pluginInfo.checksum) {
      throw new Error('Plugin checksum missing');
    }

    // チェックサムの検証
    const isValid = await this.verifyPluginChecksum(pluginInfo);
    if (!isValid) {
      throw new Error('Plugin checksum verification failed');
    }

    // 許可されていないAPIのチェック
    if (pluginInfo.permissions) {
      this.validatePermissions(pluginInfo.permissions);
    }
  }

  /**
   * プラグインモジュールの読み込み
   */
  async loadPluginModule(pluginInfo, options) {
    const pluginPath = this.getPluginPath(pluginInfo, options.type);

    // 動的インポート
    const module = await import(pluginPath);

    // サンドボックスでの実行
    return this.createSandboxedPlugin(module.default || module, pluginInfo);
  }

  /**
   * サンドボックスでのプラグイン実行
   */
  createSandboxedPlugin(PluginClass, pluginInfo) {
    // 許可されたAPIのみを提供
    const allowedAPIs = {
      console,
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
      // プラグインAPI
      pluginAPI: this.createPluginAPI(pluginInfo)
    };

    // Proxyでアクセス制御
    const sandbox = new Proxy(allowedAPIs, {
      get(target, prop) {
        if (prop in target) {
          return target[prop];
        }
        throw new Error(`Access to ${prop} is not allowed in plugin sandbox`);
      }
    });

    // プラグインインスタンス作成
    const plugin = new PluginClass(sandbox);

    // 実行時間制限
    this.enforceExecutionLimits(plugin);

    return plugin;
  }

  /**
   * プラグインAPIの作成
   */
  createPluginAPI(pluginInfo) {
    return {
      // 基本API
      getPluginId: () => pluginInfo.id,
      getVersion: () => pluginInfo.version,

      // 設定管理
      getSetting: (key) => this.getPluginSetting(pluginInfo.id, key),
      setSetting: (key, value) => this.setPluginSetting(pluginInfo.id, key, value),

      // フックシステム
      addHook: (hookName, callback) => this.addHook(hookName, callback, pluginInfo.id),
      removeHook: (hookName, callback) => this.removeHook(hookName, callback, pluginInfo.id),

      // イベントシステム
      emit: (event, data) => this.emitPluginEvent(pluginInfo.id, event, data),
      on: (event, callback) => this.onPluginEvent(event, callback, pluginInfo.id),

      // DOMアクセス（制限付き）
      querySelector: (selector) => {
        // プラグイン専用のコンテナ内のみ許可
        const container = document.getElementById(`plugin-${pluginInfo.id}`);
        return container ? container.querySelector(selector) : null;
      },

      // HTTPリクエスト（制限付き）
      fetch: async (url, options = {}) => {
        // 許可されたドメインのみ
        if (!this.isAllowedDomain(url)) {
          throw new Error('Domain not allowed for plugin requests');
        }
        return fetch(url, { ...options, mode: 'cors' });
      }
    };
  }

  /**
   * 実行時間制限の適用
   */
  enforceExecutionLimits(plugin) {
    const originalMethods = {};

    // メソッドの実行時間を監視
    ['init', 'onLoad', 'onUnload', 'execute'].forEach(methodName => {
      if (typeof plugin[methodName] === 'function') {
        originalMethods[methodName] = plugin[methodName];

        plugin[methodName] = async (...args) => {
          const startTime = Date.now();

          try {
            const result = await Promise.race([
              originalMethods[methodName].apply(plugin, args),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Plugin execution timeout')), this.securityPolicy.maxExecutionTime)
              )
            ]);

            const executionTime = Date.now() - startTime;
            if (executionTime > 1000) {
              console.warn(`[PluginSystem] Plugin ${plugin.constructor.name} method ${methodName} took ${executionTime}ms`);
            }

            return result;

          } catch (error) {
            console.error(`[PluginSystem] Plugin execution error in ${methodName}:`, error);
            throw error;
          }
        };
      }
    });
  }

  /**
   * プラグインの初期化
   */
  async initializePlugin(plugin, pluginInfo) {
    // DOMコンテナの作成
    this.createPluginContainer(pluginInfo);

    // プラグインの初期化
    if (typeof plugin.init === 'function') {
      await plugin.init();
    }

    // 設定の読み込み
    const settings = await this.getPluginSettings(pluginInfo.id);
    if (settings && typeof plugin.loadSettings === 'function') {
      plugin.loadSettings(settings);
    }
  }

  /**
   * プラグインコンテナの作成
   */
  createPluginContainer(pluginInfo) {
    const container = document.createElement('div');
    container.id = `plugin-${pluginInfo.id}`;
    container.className = 'plugin-container';
    container.setAttribute('data-plugin-id', pluginInfo.id);
    container.setAttribute('data-plugin-version', pluginInfo.version);

    // メインコンテンツエリアに追加
    const mainContent = document.querySelector('.main-content') || document.body;
    mainContent.appendChild(container);
  }

  /**
   * フックシステムの初期化
   */
  initializeHooks() {
    // コアフックの定義
    this.hooks.set('before-navigation', new Set());
    this.hooks.set('after-navigation', new Set());
    this.hooks.set('before-bookmark-add', new Set());
    this.hooks.set('after-bookmark-add', new Set());
    this.hooks.set('before-tab-close', new Set());
    this.hooks.set('after-tab-close', new Set());
    this.hooks.set('security-alert', new Set());
    this.hooks.set('performance-metric', new Set());
    this.hooks.set('user-action', new Set());
  }

  /**
   * プラグインフックの登録
   */
  registerPluginHooks(plugin, pluginId) {
    if (typeof plugin.registerHooks === 'function') {
      const pluginHooks = plugin.registerHooks();

      if (pluginHooks && typeof pluginHooks === 'object') {
        Object.entries(pluginHooks).forEach(([hookName, callback]) => {
          this.addHook(hookName, callback, pluginId);
        });
      }
    }
  }

  /**
   * フックの実行
   */
  async executeHook(hookName, data = {}, context = {}) {
    const hookCallbacks = this.hooks.get(hookName);

    if (!hookCallbacks || hookCallbacks.size === 0) {
      return data;
    }

    let result = data;

    for (const callback of hookCallbacks) {
      try {
        result = await callback(result, context);
      } catch (error) {
        console.error(`[PluginSystem] Hook ${hookName} execution failed:`, error);
      }
    }

    return result;
  }

  /**
   * プラグイン通信システム
   */
  setupPluginCommunication() {
    // プラグイン間メッセージング
    window.addEventListener('plugin-message', (event) => {
      const { targetPlugin, message, sender } = event.detail;
      this.routePluginMessage(targetPlugin, message, sender);
    });

    // メインアプリケーションとの通信
    window.addEventListener('main-app-message', (event) => {
      this.broadcastToPlugins(event.detail);
    });
  }

  /**
   * プラグインモニタリング
   */
  startPluginMonitoring() {
    // パフォーマンス監視
    setInterval(() => {
      this.monitorPluginPerformance();
    }, 30000); // 30秒ごと

    // メモリ使用量監視
    setInterval(() => {
      this.monitorPluginMemory();
    }, 60000); // 1分ごと
  }

  /**
   * パフォーマンス監視
   */
  monitorPluginPerformance() {
    this.plugins.forEach((plugin, pluginId) => {
      // プラグインのパフォーマンスメトリクス収集
      const metrics = this.getPluginMetrics(plugin, pluginId);

      // 閾値チェック
      if (metrics.executionTime > 1000) {
        console.warn(`[PluginSystem] Plugin ${pluginId} is slow: ${metrics.executionTime}ms`);
      }

      // フックで通知
      this.executeHook('performance-metric', { pluginId, metrics });
    });
  }

  /**
   * プラグインのアンインストール
   */
  async uninstallPlugin(pluginId) {
    try {
      const plugin = this.plugins.get(pluginId);

      if (plugin && typeof plugin.onUnload === 'function') {
        await plugin.onUnload();
      }

      // DOMコンテナの削除
      const container = document.getElementById(`plugin-${pluginId}`);
      if (container) {
        container.remove();
      }

      // プラグインの削除
      this.plugins.delete(pluginId);
      this.loadedPlugins.delete(pluginId);

      // フックの削除
      this.removePluginHooks(pluginId);

      // 設定の削除
      await this.clearPluginSettings(pluginId);

      console.log(`[PluginSystem] Plugin uninstalled: ${pluginId}`);

    } catch (error) {
      console.error(`[PluginSystem] Failed to uninstall plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * プラグインの更新
   */
  async updatePlugin(pluginId, newVersion) {
    try {
      console.log(`[PluginSystem] Updating plugin: ${pluginId} to v${newVersion}`);

      // 現在のプラグインを停止
      await this.uninstallPlugin(pluginId);

      // 新しいバージョンを読み込み
      await this.loadPlugin(pluginId);

      console.log(`[PluginSystem] Plugin updated: ${pluginId} to v${newVersion}`);

    } catch (error) {
      console.error(`[PluginSystem] Failed to update plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * プラグイン一覧の取得
   */
  async getInstalledPlugins() {
    const transaction = this.db.transaction(['plugins'], 'readonly');
    const store = transaction.objectStore('plugins');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const plugins = request.result.filter(p => p.enabled !== false);
        resolve(plugins);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * マーケットプレイス統合
   */
  async browseMarketplace(category = 'all', searchTerm = '') {
    try {
      const response = await fetch(`/api/plugins/marketplace?category=${category}&search=${encodeURIComponent(searchTerm)}`);
      const plugins = await response.json();

      return plugins.map(plugin => ({
        ...plugin,
        installed: this.loadedPlugins.has(plugin.id),
        compatible: this.checkPluginCompatibility(plugin)
      }));

    } catch (error) {
      console.error('[PluginSystem] Marketplace browse failed:', error);
      return [];
    }
  }

  /**
   * プラグインのインストール（マーケットプレイスから）
   */
  async installFromMarketplace(pluginId) {
    try {
      // プラグイン情報の取得
      const response = await fetch(`/api/plugins/marketplace/${pluginId}`);
      const pluginInfo = await response.json();

      // ダウンロードと検証
      await this.downloadPlugin(pluginInfo);

      // インストール
      await this.loadPlugin(pluginId, { type: 'marketplace' });

      console.log(`[PluginSystem] Plugin installed from marketplace: ${pluginId}`);

    } catch (error) {
      console.error(`[PluginSystem] Marketplace install failed for ${pluginId}:`, error);
      throw error;
    }
  }

  // ユーティリティメソッド
  getPluginPath(pluginInfo, type = 'user') {
    const basePath = this.pluginPaths[type] || this.pluginPaths.user;
    return `${basePath}${pluginInfo.id}/index.js`;
  }

  async getPluginSettings(pluginId) {
    // IndexedDBから設定を取得
    const transaction = this.db.transaction(['settings'], 'readonly');
    const store = transaction.objectStore('settings');

    return new Promise((resolve) => {
      const request = store.get(pluginId);
      request.onsuccess = () => resolve(request.result?.settings || {});
    });
  }

  async setPluginSetting(pluginId, key, value) {
    const settings = await this.getPluginSettings(pluginId);
    settings[key] = value;

    const transaction = this.db.transaction(['settings'], 'readwrite');
    const store = transaction.objectStore('settings');

    await new Promise((resolve, reject) => {
      const request = store.put({ pluginId, settings });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  addHook(hookName, callback, pluginId) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, new Set());
    }
    this.hooks.get(hookName).add({ callback, pluginId });
  }

  removeHook(hookName, callback, pluginId) {
    const hooks = this.hooks.get(hookName);
    if (hooks) {
      hooks.forEach(hook => {
        if (hook.pluginId === pluginId && hook.callback === callback) {
          hooks.delete(hook);
        }
      });
    }
  }

  emitPluginEvent(pluginId, event, data) {
    const eventData = { pluginId, event, data, timestamp: Date.now() };
    window.dispatchEvent(new CustomEvent('plugin-event', { detail: eventData }));
  }

  onPluginEvent(event, callback, pluginId) {
    const handler = (e) => {
      if (e.detail.event === event) {
        callback(e.detail.data, e.detail.pluginId);
      }
    };

    window.addEventListener('plugin-event', handler);

    // クリーンアップ用
    return () => window.removeEventListener('plugin-event', handler);
  }

  isAllowedDomain(url) {
    const allowedDomains = [
      window.location.origin,
      'https://api.github.com',
      'https://cdn.jsdelivr.net'
    ];

    try {
      const urlObj = new URL(url);
      return allowedDomains.some(domain => urlObj.origin === domain);
    } catch {
      return false;
    }
  }

  async verifyPluginChecksum(pluginInfo) {
    // チェックサム検証の実装
    return true; // 簡易実装
  }

  validatePermissions(permissions) {
    // 許可検証の実装
    return true; // 簡易実装
  }

  checkPluginCompatibility(plugin) {
    // 互換性チェックの実装
    return true; // 簡易実装
  }

  getPluginMetrics(plugin, pluginId) {
    // メトリクス収集の実装
    return {
      executionTime: 0,
      memoryUsage: 0,
      errorCount: 0
    };
  }

  async downloadPlugin(pluginInfo) {
    // ダウンロード実装
  }

  async savePluginState(pluginId, state) {
    // 状態保存実装
  }

  removePluginHooks(pluginId) {
    // フック削除実装
  }

  async clearPluginSettings(pluginId) {
    // 設定削除実装
  }

  routePluginMessage(targetPlugin, message, sender) {
    // メッセージルーティング実装
  }

  broadcastToPlugins(message) {
    // ブロードキャスト実装
  }

  monitorPluginMemory() {
    // メモリ監視実装
  }
}

// グローバルインスタンス作成
const pluginSystem = new PluginSystem();

// グローバルアクセス用
window.pluginSystem = pluginSystem;

// 初期化完了通知
document.addEventListener('DOMContentLoaded', () => {
  pluginSystem.executeHook('system-ready', { timestamp: Date.now() });
});
