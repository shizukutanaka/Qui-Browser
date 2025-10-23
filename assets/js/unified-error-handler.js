/**
 * Unified Error Handler System
 * 統合エラーハンドリングシステム
 *
 * 統合対象：
 * - error-handler.js (基本エラー処理)
 * - core/error-handler.js (重複)
 * - vr-error-handler.js (VR特化エラー処理)
 *
 * @version 3.2.0
 */

class UnifiedErrorHandler {
  constructor() {
    this.initialized = false;

    // エラー設定
    this.config = {
      maxErrors: 100,
      maxStackTraceLength: 10,
      enableVRMode: 'xr' in navigator,
      enableRemoteLogging: false,
      enableUserNotification: true,
      enableAutoRecovery: true,
      suppressDuplicates: true,
      duplicateThreshold: 5000, // 5秒以内の重複を抑制
      criticalErrorThreshold: 10, // 10個以上のエラーで緊急モード
      logToConsole: true,
      detailedLogging: !this.isProduction()
    };

    // エラー履歴
    this.errorHistory = [];
    this.errorCounts = new Map();
    this.lastErrors = new Map();

    // VR特有のエラーコード
    this.vrErrorCodes = {
      VR_INIT_FAILED: 'VR initialization failed',
      VR_SESSION_LOST: 'VR session was lost',
      VR_DEVICE_DISCONNECTED: 'VR device disconnected',
      VR_TRACKING_LOST: 'VR tracking lost',
      VR_PERFORMANCE_DEGRADED: 'VR performance degraded',
      VR_MEMORY_EXCEEDED: 'VR memory limit exceeded',
      VR_GESTURE_FAILED: 'VR gesture recognition failed',
      VR_AUDIO_FAILED: 'VR spatial audio failed'
    };

    // エラー重要度レベル
    this.severityLevels = {
      DEBUG: 0,
      INFO: 1,
      WARNING: 2,
      ERROR: 3,
      CRITICAL: 4,
      FATAL: 5
    };

    // エラーカテゴリ
    this.errorCategories = {
      NETWORK: 'network',
      RENDERING: 'rendering',
      SCRIPT: 'script',
      RESOURCE: 'resource',
      SECURITY: 'security',
      VR: 'vr',
      PERFORMANCE: 'performance',
      USER_INPUT: 'user_input',
      SYSTEM: 'system',
      UNKNOWN: 'unknown'
    };

    // リカバリー戦略
    this.recoveryStrategies = new Map();

    // エラー通知UI要素
    this.notificationElement = null;

    // エラー統計
    this.statistics = {
      totalErrors: 0,
      errorsByCategory: {},
      errorsBySeverity: {},
      recoveryAttempts: 0,
      successfulRecoveries: 0
    };
  }

  /**
   * エラーハンドラーの初期化
   */
  async initialize() {
    if (this.initialized) {
      console.warn('UnifiedErrorHandler: Already initialized');
      return this;
    }

    try {
      console.info('Initializing Unified Error Handler...');

      // グローバルエラーハンドラーの設定
      this.setupGlobalErrorHandlers();

      // Promise rejection ハンドラー
      this.setupPromiseRejectionHandler();

      // VRエラーハンドラー（VR環境の場合）
      if (this.config.enableVRMode) {
        this.setupVRErrorHandlers();
      }

      // エラー通知UIの初期化
      if (this.config.enableUserNotification) {
        this.initializeNotificationUI();
      }

      // リカバリー戦略の登録
      this.registerRecoveryStrategies();

      // エラー統計の初期化
      this.initializeStatistics();

      this.initialized = true;
      console.info('Unified Error Handler initialized successfully');

      return this;
    } catch (error) {
      console.error('Failed to initialize Unified Error Handler:', error);
      throw error;
    }
  }

  /**
   * グローバルエラーハンドラーの設定
   */
  setupGlobalErrorHandlers() {
    // window.onerror ハンドラー
    window.onerror = (message, source, lineno, colno, error) => {
      this.handleError({
        message,
        source,
        lineno,
        colno,
        error: error || new Error(message),
        category: this.errorCategories.SCRIPT,
        severity: this.severityLevels.ERROR,
        timestamp: Date.now()
      });

      // デフォルトのエラー処理を抑制
      return true;
    };

    // エラーイベントリスナー
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        // リソース読み込みエラー
        this.handleResourceError(event);
      }
    }, true);

    // カスタムエラーイベント
    window.addEventListener('custom-error', (event) => {
      this.handleError(event.detail);
    });
  }

  /**
   * Promise rejection ハンドラーの設定
   */
  setupPromiseRejectionHandler() {
    window.addEventListener('unhandledrejection', (event) => {
      const error = {
        message: event.reason?.message || 'Unhandled promise rejection',
        error: event.reason,
        stack: event.reason?.stack,
        category: this.errorCategories.SCRIPT,
        severity: this.severityLevels.ERROR,
        promise: event.promise,
        timestamp: Date.now()
      };

      this.handleError(error);

      // デフォルトの処理を防ぐ
      event.preventDefault();
    });

    window.addEventListener('rejectionhandled', (event) => {
      console.info('Previously unhandled promise rejection was handled:', event.promise);
    });
  }

  /**
   * VRエラーハンドラーの設定
   */
  setupVRErrorHandlers() {
    if (!navigator.xr) return;

    // XRSession エラー
    document.addEventListener('xrsessionerror', (event) => {
      this.handleVRError({
        code: 'VR_SESSION_ERROR',
        message: 'XR session error occurred',
        session: event.session,
        timestamp: Date.now()
      });
    });

    // XRSystem エラー
    navigator.xr.addEventListener('devicechange', () => {
      console.info('XR device change detected');
    });

    // VRパフォーマンスモニタリング
    this.monitorVRPerformance();
  }

  /**
   * VRパフォーマンスモニタリング
   */
  monitorVRPerformance() {
    if (!window.unifiedPerformance) return;

    window.unifiedPerformance.on('performance:critical', (data) => {
      this.handleVRError({
        code: 'VR_PERFORMANCE_DEGRADED',
        message: `VR performance critical: ${data.fps} FPS`,
        severity: this.severityLevels.WARNING,
        data
      });
    });
  }

  /**
   * エラー通知UIの初期化
   */
  initializeNotificationUI() {
    // 既存の通知要素があれば削除
    const existing = document.getElementById('error-notification');
    if (existing) {
      existing.remove();
    }

    // 通知要素の作成
    this.notificationElement = document.createElement('div');
    this.notificationElement.id = 'error-notification';
    this.notificationElement.className = 'error-notification hidden';
    this.notificationElement.setAttribute('role', 'alert');
    this.notificationElement.innerHTML = `
      <div class="error-notification-content">
        <span class="error-icon">⚠️</span>
        <span class="error-message"></span>
        <button class="error-dismiss" aria-label="Dismiss error">✕</button>
      </div>
      <div class="error-details hidden">
        <pre class="error-stack"></pre>
        <div class="error-actions">
          <button class="error-report">Report Issue</button>
          <button class="error-reload">Reload Page</button>
        </div>
      </div>
    `;

    // スタイルの追加
    this.addNotificationStyles();

    document.body.appendChild(this.notificationElement);

    // イベントリスナーの設定
    this.setupNotificationEventListeners();
  }

  /**
   * 通知スタイルの追加
   */
  addNotificationStyles() {
    const styleId = 'error-notification-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .error-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 400px;
        background: linear-gradient(135deg, #ff6b6b, #ff4757);
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 10000;
        transition: all 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }

      .error-notification.hidden {
        transform: translateX(450px);
        opacity: 0;
      }

      .error-notification-content {
        padding: 15px;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .error-icon {
        font-size: 24px;
        flex-shrink: 0;
      }

      .error-message {
        flex: 1;
        font-size: 14px;
        line-height: 1.4;
      }

      .error-dismiss {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        opacity: 0.8;
        transition: opacity 0.2s;
      }

      .error-dismiss:hover {
        opacity: 1;
      }

      .error-details {
        padding: 0 15px 15px;
        border-top: 1px solid rgba(255,255,255,0.2);
      }

      .error-stack {
        margin: 10px 0;
        padding: 10px;
        background: rgba(0,0,0,0.2);
        border-radius: 4px;
        font-size: 12px;
        max-height: 200px;
        overflow-y: auto;
      }

      .error-actions {
        display: flex;
        gap: 10px;
      }

      .error-actions button {
        flex: 1;
        padding: 8px 15px;
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.3);
        color: white;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .error-actions button:hover {
        background: rgba(255,255,255,0.3);
      }

      /* VRモード用スタイル */
      .vr-error-panel {
        position: absolute;
        transform: translate3d(0, 0, -2m);
        width: 2m;
        height: 1m;
        background: rgba(255, 0, 0, 0.9);
        border-radius: 0.1m;
        padding: 0.1m;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * 通知イベントリスナーの設定
   */
  setupNotificationEventListeners() {
    const dismissBtn = this.notificationElement.querySelector('.error-dismiss');
    const reportBtn = this.notificationElement.querySelector('.error-report');
    const reloadBtn = this.notificationElement.querySelector('.error-reload');
    const content = this.notificationElement.querySelector('.error-notification-content');

    dismissBtn?.addEventListener('click', () => {
      this.hideNotification();
    });

    reportBtn?.addEventListener('click', () => {
      this.reportError();
    });

    reloadBtn?.addEventListener('click', () => {
      window.location.reload();
    });

    content?.addEventListener('click', () => {
      const details = this.notificationElement.querySelector('.error-details');
      details?.classList.toggle('hidden');
    });
  }

  /**
   * リカバリー戦略の登録
   */
  registerRecoveryStrategies() {
    // ネットワークエラーのリカバリー
    this.recoveryStrategies.set(this.errorCategories.NETWORK, async (error) => {
      console.info('Attempting network error recovery...');

      // オフラインチェック
      if (!navigator.onLine) {
        await this.waitForConnection();
      }

      // リトライ
      if (error.url) {
        return await this.retryRequest(error.url, error.options);
      }

      return false;
    });

    // レンダリングエラーのリカバリー
    this.recoveryStrategies.set(this.errorCategories.RENDERING, async (error) => {
      console.info('Attempting rendering error recovery...');

      // WebGLコンテキストのリセット
      if (window.renderer?.gl) {
        const ext = window.renderer.gl.getExtension('WEBGL_lose_context');
        if (ext) {
          ext.loseContext();
          setTimeout(() => ext.restoreContext(), 100);
        }
      }

      // 品質設定を下げる
      if (window.unifiedPerformance) {
        window.unifiedPerformance.setQualityLevel('low');
      }

      return true;
    });

    // VRエラーのリカバリー
    this.recoveryStrategies.set(this.errorCategories.VR, async (error) => {
      console.info('Attempting VR error recovery...');

      if (error.code === 'VR_SESSION_LOST') {
        // VRセッションの再開を試みる
        return await this.restoreVRSession();
      }

      if (error.code === 'VR_TRACKING_LOST') {
        // トラッキングのリセット
        return await this.resetVRTracking();
      }

      return false;
    });

    // メモリエラーのリカバリー
    this.recoveryStrategies.set(this.errorCategories.PERFORMANCE, async (error) => {
      console.info('Attempting performance error recovery...');

      // メモリクリーンアップ
      this.performMemoryCleanup();

      // 不要なリソースの解放
      if (window.THREE?.Cache) {
        window.THREE.Cache.clear();
      }

      // ガベージコレクションの強制（可能な場合）
      if (window.gc) {
        window.gc();
      }

      return true;
    });
  }

  /**
   * 統計の初期化
   */
  initializeStatistics() {
    // カテゴリ別統計の初期化
    Object.values(this.errorCategories).forEach(category => {
      this.statistics.errorsByCategory[category] = 0;
    });

    // 重要度別統計の初期化
    Object.keys(this.severityLevels).forEach(severity => {
      this.statistics.errorsBySeverity[severity] = 0;
    });
  }

  /**
   * エラーの処理
   */
  handleError(errorInfo) {
    try {
      // エラー情報の正規化
      const error = this.normalizeError(errorInfo);

      // 重複チェック
      if (this.config.suppressDuplicates && this.isDuplicateError(error)) {
        return;
      }

      // エラーの記録
      this.recordError(error);

      // 統計の更新
      this.updateStatistics(error);

      // コンソールへのログ
      if (this.config.logToConsole) {
        this.logToConsole(error);
      }

      // ユーザーへの通知
      if (this.config.enableUserNotification && error.severity >= this.severityLevels.ERROR) {
        this.showNotification(error);
      }

      // 自動リカバリー
      if (this.config.enableAutoRecovery && error.severity < this.severityLevels.FATAL) {
        this.attemptRecovery(error);
      }

      // リモートログ
      if (this.config.enableRemoteLogging) {
        this.sendToRemote(error);
      }

      // 緊急モードチェック
      this.checkCriticalErrorThreshold();

    } catch (handlingError) {
      console.error('Error in error handler:', handlingError);
    }
  }

  /**
   * リソースエラーの処理
   */
  handleResourceError(event) {
    const target = event.target;
    const error = {
      message: `Failed to load resource: ${target.tagName}`,
      source: target.src || target.href,
      category: this.errorCategories.RESOURCE,
      severity: this.severityLevels.WARNING,
      element: target.tagName,
      timestamp: Date.now()
    };

    this.handleError(error);
  }

  /**
   * VRエラーの処理
   */
  handleVRError(vrError) {
    const error = {
      message: this.vrErrorCodes[vrError.code] || vrError.message,
      code: vrError.code,
      category: this.errorCategories.VR,
      severity: vrError.severity || this.severityLevels.ERROR,
      data: vrError.data,
      timestamp: vrError.timestamp || Date.now()
    };

    this.handleError(error);

    // VR固有の処理
    if (this.config.enableVRMode) {
      this.showVRErrorNotification(error);
    }
  }

  /**
   * エラー情報の正規化
   */
  normalizeError(errorInfo) {
    const normalized = {
      message: '',
      stack: '',
      category: this.errorCategories.UNKNOWN,
      severity: this.severityLevels.ERROR,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...errorInfo
    };

    // メッセージの抽出
    if (errorInfo.error) {
      normalized.message = errorInfo.error.message || errorInfo.message;
      normalized.stack = this.extractStackTrace(errorInfo.error);
    } else if (typeof errorInfo === 'string') {
      normalized.message = errorInfo;
    } else {
      normalized.message = errorInfo.message || 'Unknown error';
    }

    // カテゴリの自動判定
    if (normalized.category === this.errorCategories.UNKNOWN) {
      normalized.category = this.categorizeError(normalized);
    }

    return normalized;
  }

  /**
   * スタックトレースの抽出
   */
  extractStackTrace(error) {
    if (!error.stack) return '';

    const lines = error.stack.split('\n');
    return lines.slice(0, this.config.maxStackTraceLength).join('\n');
  }

  /**
   * エラーのカテゴリ分類
   */
  categorizeError(error) {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch') || message.includes('xhr')) {
      return this.errorCategories.NETWORK;
    }
    if (message.includes('webgl') || message.includes('render') || message.includes('canvas')) {
      return this.errorCategories.RENDERING;
    }
    if (message.includes('security') || message.includes('cors') || message.includes('csp')) {
      return this.errorCategories.SECURITY;
    }
    if (message.includes('memory') || message.includes('performance') || message.includes('fps')) {
      return this.errorCategories.PERFORMANCE;
    }
    if (message.includes('xr') || message.includes('vr') || message.includes('ar')) {
      return this.errorCategories.VR;
    }

    return this.errorCategories.UNKNOWN;
  }

  /**
   * 重複エラーのチェック
   */
  isDuplicateError(error) {
    const key = `${error.message}_${error.source}_${error.lineno}`;
    const lastError = this.lastErrors.get(key);

    if (lastError && (error.timestamp - lastError.timestamp) < this.config.duplicateThreshold) {
      // カウントを増やす
      const count = this.errorCounts.get(key) || 0;
      this.errorCounts.set(key, count + 1);
      return true;
    }

    this.lastErrors.set(key, error);
    return false;
  }

  /**
   * エラーの記録
   */
  recordError(error) {
    this.errorHistory.push(error);

    // 最大保存数を超えた場合は古いものを削除
    if (this.errorHistory.length > this.config.maxErrors) {
      this.errorHistory.shift();
    }

    // LocalStorageに保存（クラッシュ時の復旧用）
    try {
      const recentErrors = this.errorHistory.slice(-10);
      localStorage.setItem('error_history', JSON.stringify(recentErrors));
    } catch (e) {
      console.warn('Failed to save error history to localStorage');
    }
  }

  /**
   * 統計の更新
   */
  updateStatistics(error) {
    this.statistics.totalErrors++;
    this.statistics.errorsByCategory[error.category] = (this.statistics.errorsByCategory[error.category] || 0) + 1;

    const severityKey = Object.keys(this.severityLevels).find(key =>
      this.severityLevels[key] === error.severity
    );
    if (severityKey) {
      this.statistics.errorsBySeverity[severityKey] = (this.statistics.errorsBySeverity[severityKey] || 0) + 1;
    }
  }

  /**
   * コンソールへのログ出力
   */
  logToConsole(error) {
    const method = error.severity <= this.severityLevels.INFO ? 'info' :
                   error.severity === this.severityLevels.WARNING ? 'warn' : 'error';

    const prefix = `[${this.getSeverityName(error.severity)}] [${error.category}]`;

    console[method](prefix, error.message);

    if (this.config.detailedLogging && error.stack) {
      console[method]('Stack trace:', error.stack);
    }
  }

  /**
   * 重要度名の取得
   */
  getSeverityName(severity) {
    return Object.keys(this.severityLevels).find(key =>
      this.severityLevels[key] === severity
    ) || 'UNKNOWN';
  }

  /**
   * 通知の表示
   */
  showNotification(error) {
    if (!this.notificationElement) return;

    const messageEl = this.notificationElement.querySelector('.error-message');
    const stackEl = this.notificationElement.querySelector('.error-stack');

    if (messageEl) {
      messageEl.textContent = error.message;
    }

    if (stackEl && error.stack) {
      stackEl.textContent = error.stack;
    }

    this.notificationElement.classList.remove('hidden');

    // 自動的に隠す（重要度が低い場合）
    if (error.severity <= this.severityLevels.WARNING) {
      setTimeout(() => this.hideNotification(), 5000);
    }
  }

  /**
   * VRエラー通知の表示
   */
  showVRErrorNotification(error) {
    // VR空間内にエラーパネルを表示
    if (window.scene && window.THREE) {
      const panel = this.createVRErrorPanel(error);
      window.scene.add(panel);

      // 5秒後に削除
      setTimeout(() => {
        window.scene.remove(panel);
      }, 5000);
    }
  }

  /**
   * VRエラーパネルの作成
   */
  createVRErrorPanel(error) {
    if (!window.THREE) return null;

    const geometry = new window.THREE.PlaneGeometry(2, 1);
    const material = new window.THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.9
    });

    const panel = new window.THREE.Mesh(geometry, material);
    panel.position.set(0, 1.6, -2);

    // テキストの追加（Canvas texture）
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.fillText('⚠️ ' + error.message, 20, 100);

    const texture = new window.THREE.CanvasTexture(canvas);
    panel.material.map = texture;

    return panel;
  }

  /**
   * 通知を隠す
   */
  hideNotification() {
    if (this.notificationElement) {
      this.notificationElement.classList.add('hidden');
    }
  }

  /**
   * エラーレポートの送信
   */
  async reportError() {
    const recentErrors = this.errorHistory.slice(-5);
    const report = {
      errors: recentErrors,
      statistics: this.statistics,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: Date.now()
    };

    // クリップボードにコピー
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      alert('Error report copied to clipboard. Please paste it in the issue tracker.');
    } catch (e) {
      console.error('Failed to copy report to clipboard');
    }

    // 実装: サーバーへの送信
    // await fetch('/api/errors/report', { method: 'POST', body: JSON.stringify(report) });
  }

  /**
   * リカバリーの試行
   */
  async attemptRecovery(error) {
    const strategy = this.recoveryStrategies.get(error.category);
    if (!strategy) {
      console.info('No recovery strategy for category:', error.category);
      return false;
    }

    this.statistics.recoveryAttempts++;

    try {
      const success = await strategy(error);
      if (success) {
        this.statistics.successfulRecoveries++;
        console.info('Recovery successful for error:', error.message);
      }
      return success;
    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError);
      return false;
    }
  }

  /**
   * ネットワーク接続を待つ
   */
  async waitForConnection(timeout = 30000) {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const check = () => {
        if (navigator.onLine) {
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Connection timeout'));
        } else {
          setTimeout(check, 1000);
        }
      };

      check();
    });
  }

  /**
   * リクエストのリトライ
   */
  async retryRequest(url, options, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) {
          return response;
        }
      } catch (e) {
        if (i === maxRetries - 1) {
          throw e;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
  }

  /**
   * VRセッションの復元
   */
  async restoreVRSession() {
    if (!navigator.xr) return false;

    try {
      // 既存セッションを終了
      if (window.xrSession) {
        await window.xrSession.end();
      }

      // 新しいセッションを開始
      const sessionInit = {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['bounded-floor', 'hand-tracking']
      };

      window.xrSession = await navigator.xr.requestSession('immersive-vr', sessionInit);
      console.info('VR session restored');
      return true;
    } catch (e) {
      console.error('Failed to restore VR session:', e);
      return false;
    }
  }

  /**
   * VRトラッキングのリセット
   */
  async resetVRTracking() {
    if (!window.xrSession) return false;

    try {
      // リファレンススペースのリセット
      const referenceSpace = await window.xrSession.requestReferenceSpace('local-floor');
      window.xrReferenceSpace = referenceSpace;
      console.info('VR tracking reset');
      return true;
    } catch (e) {
      console.error('Failed to reset VR tracking:', e);
      return false;
    }
  }

  /**
   * メモリクリーンアップ
   */
  performMemoryCleanup() {
    // エラー履歴の削減
    if (this.errorHistory.length > 50) {
      this.errorHistory = this.errorHistory.slice(-50);
    }

    // 重複エラー情報のクリア
    this.lastErrors.clear();
    this.errorCounts.clear();

    console.info('Memory cleanup performed');
  }

  /**
   * 緊急エラーしきい値のチェック
   */
  checkCriticalErrorThreshold() {
    const recentErrors = this.errorHistory.filter(e =>
      Date.now() - e.timestamp < 60000 // 1分以内
    );

    if (recentErrors.length >= this.config.criticalErrorThreshold) {
      this.enterEmergencyMode();
    }
  }

  /**
   * 緊急モードへの移行
   */
  enterEmergencyMode() {
    console.error('EMERGENCY MODE: Too many errors detected');

    // 品質を最低に
    if (window.unifiedPerformance) {
      window.unifiedPerformance.setQualityLevel('low');
    }

    // 非必須機能の無効化
    this.disableNonEssentialFeatures();

    // ユーザーに通知
    this.showEmergencyNotification();
  }

  /**
   * 非必須機能の無効化
   */
  disableNonEssentialFeatures() {
    // アニメーションの停止
    if (window.cancelAnimationFrame && window.rafId) {
      window.cancelAnimationFrame(window.rafId);
    }

    // パーティクルエフェクトの無効化
    if (window.particleSystem) {
      window.particleSystem.enabled = false;
    }

    console.info('Non-essential features disabled');
  }

  /**
   * 緊急通知の表示
   */
  showEmergencyNotification() {
    const notification = document.createElement('div');
    notification.className = 'emergency-notification';
    notification.innerHTML = `
      <h2>⚠️ Performance Issues Detected</h2>
      <p>The application is experiencing problems. Some features have been disabled.</p>
      <button onclick="window.location.reload()">Reload Page</button>
    `;

    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ff4757;
      color: white;
      padding: 30px;
      border-radius: 10px;
      z-index: 100000;
      text-align: center;
    `;

    document.body.appendChild(notification);
  }

  /**
   * リモートサーバーへの送信
   */
  async sendToRemote(error) {
    // 実装: エラーログをサーバーに送信
    // try {
    //   await fetch('/api/errors/log', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(error)
    //   });
    // } catch (e) {
    //   console.warn('Failed to send error to remote server');
    // }
  }

  /**
   * 本番環境かどうかの判定
   */
  isProduction() {
    return window.location.hostname !== 'localhost' &&
           !window.location.hostname.startsWith('127.') &&
           !window.location.hostname.includes('dev');
  }

  /**
   * エラー統計の取得
   */
  getStatistics() {
    return {
      ...this.statistics,
      recentErrors: this.errorHistory.slice(-10),
      errorRate: this.calculateErrorRate(),
      recoveryRate: this.statistics.recoveryAttempts > 0 ?
        (this.statistics.successfulRecoveries / this.statistics.recoveryAttempts * 100).toFixed(2) + '%' : '0%'
    };
  }

  /**
   * エラーレートの計算
   */
  calculateErrorRate() {
    const oneHourAgo = Date.now() - 3600000;
    const recentErrors = this.errorHistory.filter(e => e.timestamp > oneHourAgo);
    return (recentErrors.length / 60).toFixed(2) + ' errors/min';
  }

  /**
   * エラーのエクスポート
   */
  exportErrors() {
    const data = {
      errors: this.errorHistory,
      statistics: this.getStatistics(),
      timestamp: Date.now()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * エラーハンドラーの破棄
   */
  destroy() {
    // イベントリスナーの削除
    window.onerror = null;

    // 通知UIの削除
    if (this.notificationElement) {
      this.notificationElement.remove();
    }

    // データのクリア
    this.errorHistory = [];
    this.errorCounts.clear();
    this.lastErrors.clear();
    this.recoveryStrategies.clear();

    this.initialized = false;

    console.info('Unified Error Handler destroyed');
  }
}

// シングルトンインスタンスの作成
const unifiedErrorHandler = new UnifiedErrorHandler();

// DOMContentLoaded時に自動初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    unifiedErrorHandler.initialize();
  });
} else {
  unifiedErrorHandler.initialize();
}

// グローバルに公開
window.UnifiedErrorHandler = UnifiedErrorHandler;
window.errorHandler = unifiedErrorHandler;

// 後方互換性のためのエイリアス
window.VRErrorHandler = unifiedErrorHandler;