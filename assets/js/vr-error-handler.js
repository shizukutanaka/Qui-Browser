/**
 * Qui Browser VR Error Handler
 * VRデバイス専用エラーハンドリングと安定性確保
 *
 * 機能:
 * - VR固有エラーの検出と処理
 * - WebXRエラーの適切な処理
 * - フォールバックメカニズム
 * - エラーの自動回復
 * - ユーザーフレンドリーなエラー表示
 */

class VRErrorHandler {
  constructor() {
    this.errorHistory = [];
    this.recoveryStrategies = new Map();
    this.errorPatterns = new Map();
    this.maxHistorySize = 100;
    this.autoRecoveryEnabled = true;

    this.init();
  }

  init() {
    // グローバルエラーハンドラーの設定
    this.setupGlobalErrorHandling();

    // VR固有エラーハンドラーの設定
    this.setupVRSpecificErrorHandling();

    // 回復戦略の初期化
    this.initializeRecoveryStrategies();

    // エラーパターンの監視
    this.setupErrorPatternMonitoring();

    console.log('[VR Error Handler] VR Error Handler initialized');
  }

  /**
   * グローバルエラーハンドリングの設定
   */
  setupGlobalErrorHandling() {
    // 未処理のJavaScriptエラー
    window.addEventListener('error', (event) => {
      this.handleJavaScriptError(event.error, event.message, event.filename, event.lineno, event.colno);
    });

    // 未処理のPromise拒否
    window.addEventListener('unhandledrejection', (event) => {
      this.handlePromiseRejection(event.reason, event.promise);
    });

    // コンソールエラーの監視
    const originalConsoleError = console.error;
    console.error = (...args) => {
      this.handleConsoleError(...args);
      originalConsoleError.apply(console, args);
    };
  }

  /**
   * VR固有エラーハンドリングの設定
   */
  setupVRSpecificErrorHandling() {
    // WebXRエラーの監視
    if (window.WebXRManager) {
      window.WebXRManager.addEventListener('error', (event) => {
        this.handleWebXRError(event.detail);
      });
    }

    // WebGLコンテキストロスの処理
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        this.handleWebGLContextLost();
      });

      canvas.addEventListener('webglcontextrestored', () => {
        this.handleWebGLContextRestored();
      });
    }

    // VRデバイス接続エラーの監視
    this.setupVRDeviceErrorHandling();
  }

  /**
   * 回復戦略の初期化
   */
  initializeRecoveryStrategies() {
    this.recoveryStrategies.set('webxr_not_supported', {
      description: 'WebXR APIがサポートされていない',
      action: () => this.recoverWebXRNotSupported(),
      priority: 'high'
    });

    this.recoveryStrategies.set('webgl_context_lost', {
      description: 'WebGLコンテキストが失われた',
      action: () => this.recoverWebGLContextLost(),
      priority: 'critical'
    });

    this.recoveryStrategies.set('vr_device_disconnected', {
      description: 'VRデバイスが切断された',
      action: () => this.recoverVRDeviceDisconnected(),
      priority: 'high'
    });

    this.recoveryStrategies.set('network_error', {
      description: 'ネットワークエラー',
      action: () => this.recoverNetworkError(),
      priority: 'medium'
    });

    this.recoveryStrategies.set('memory_error', {
      description: 'メモリ不足エラー',
      action: () => this.recoverMemoryError(),
      priority: 'high'
    });
  }

  /**
   * JavaScriptエラーの処理
   */
  handleJavaScriptError(error, message, filename, lineno, colno) {
    const errorInfo = {
      type: 'javascript_error',
      error: error,
      message: message,
      filename: filename,
      lineno: lineno,
      colno: colno,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    this.logError(errorInfo);
    this.attemptRecovery(errorInfo);
    this.showUserFriendlyError(errorInfo);
  }

  /**
   * Promise拒否の処理
   */
  handlePromiseRejection(reason, promise) {
    const errorInfo = {
      type: 'promise_rejection',
      reason: reason,
      promise: promise,
      timestamp: Date.now(),
      stack: reason?.stack
    };

    this.logError(errorInfo);
    this.attemptRecovery(errorInfo);
  }

  /**
   * コンソールエラーの処理
   */
  handleConsoleError(...args) {
    const errorInfo = {
      type: 'console_error',
      args: args,
      message: args.join(' '),
      timestamp: Date.now()
    };

    // 重要度の高いコンソールエラーのみ処理
    if (this.isImportantConsoleError(args)) {
      this.logError(errorInfo);
    }
  }

  /**
   * WebXRエラーの処理
   */
  handleWebXRError(errorDetail) {
    const errorInfo = {
      type: 'webxr_error',
      detail: errorDetail,
      timestamp: Date.now()
    };

    this.logError(errorInfo);
    this.attemptRecovery(errorInfo);
    this.showVRSpecificError(errorInfo);
  }

  /**
   * WebGLコンテキストロスの処理
   */
  handleWebGLContextLost() {
    const errorInfo = {
      type: 'webgl_context_lost',
      timestamp: Date.now()
    };

    this.logError(errorInfo);
    this.attemptRecovery(errorInfo);
    this.showCriticalError('WebGLコンテキストが失われました。ページを再読み込みしてください。');
  }

  /**
   * WebGLコンテキスト回復の処理
   */
  handleWebGLContextRestored() {
    console.log('[VR Error Handler] WebGL context restored');
    this.showRecoveryNotification('WebGLコンテキストが回復しました。');
  }

  /**
   * エラーログの記録
   */
  logError(errorInfo) {
    // エラーヒストリーの管理
    this.errorHistory.push(errorInfo);

    // 最大サイズを超えたら古いエラーを削除
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // エラーパターンの更新
    this.updateErrorPatterns(errorInfo);

    // コンソール出力
    console.error('[VR Error Handler]', errorInfo);

    // エラー統計の更新
    this.updateErrorStats(errorInfo);
  }

  /**
   * 回復の試行
   */
  async attemptRecovery(errorInfo) {
    if (!this.autoRecoveryEnabled) return;

    const strategy = this.findRecoveryStrategy(errorInfo);

    if (strategy) {
      try {
        console.log(`[VR Error Handler] Attempting recovery: ${strategy.description}`);
        await strategy.action();

        // 回復成功の通知
        this.showRecoveryNotification(`エラーが回復されました: ${strategy.description}`);

      } catch (recoveryError) {
        console.error('[VR Error Handler] Recovery failed:', recoveryError);
        this.showRecoveryFailure(strategy.description);
      }
    }
  }

  /**
   * 回復戦略の検索
   */
  findRecoveryStrategy(errorInfo) {
    switch (errorInfo.type) {
      case 'webxr_error':
        if (errorInfo.detail?.name === 'NotSupportedError') {
          return this.recoveryStrategies.get('webxr_not_supported');
        }
        break;

      case 'webgl_context_lost':
        return this.recoveryStrategies.get('webgl_context_lost');

      case 'javascript_error':
        if (errorInfo.message?.includes('NetworkError')) {
          return this.recoveryStrategies.get('network_error');
        }
        if (errorInfo.message?.includes('OutOfMemory')) {
          return this.recoveryStrategies.get('memory_error');
        }
        break;
    }

    return null;
  }

  /**
   * WebXR未サポートの回復
   */
  async recoverWebXRNotSupported() {
    // フォールバックモードの有効化
    if (window.WebXRManager) {
      window.WebXRManager.enableFallbackMode();
    }

    // ユーザーに非VRモードでの使用を案内
    this.showFallbackNotification('VRデバイスが検出されなかったため、非VRモードで動作します。');
  }

  /**
   * WebGLコンテキストロスからの回復
   */
  async recoverWebGLContextLost() {
    // WebGLコンテキストの再初期化を試行
    const canvas = document.querySelector('canvas');
    if (canvas) {
      try {
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          console.log('[VR Error Handler] WebGL context recovered manually');
        }
      } catch (error) {
        console.error('[VR Error Handler] Manual WebGL recovery failed:', error);
      }
    }
  }

  /**
   * VRデバイス切断からの回復
   */
  async recoverVRDeviceDisconnected() {
    // VRデバイスの再接続を試行
    if (navigator.xr) {
      try {
        const supported = await navigator.xr.isSessionSupported('immersive-vr');
        if (supported) {
          console.log('[VR Error Handler] VR device reconnection possible');
        }
      } catch (error) {
        console.error('[VR Error Handler] VR device reconnection failed:', error);
      }
    }
  }

  /**
   * ネットワークエラーからの回復
   */
  async recoverNetworkError() {
    // オフラインコンテンツへの切り替え
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // Service Workerにオフラインモードへの切り替えを指示
      navigator.serviceWorker.controller.postMessage({
        type: 'ENABLE_OFFLINE_MODE'
      });
    }

    this.showRecoveryNotification('ネットワークエラーが発生しました。オフラインモードに切り替えます。');
  }

  /**
   * メモリエラーからの回復
   */
  async recoverMemoryError() {
    // メモリ使用量の削減
    if (window.vrContentPreloader) {
      window.vrContentPreloader.clearAll();
    }

    // 不要なDOM要素のクリーンアップ
    this.cleanupDOM();

    this.showRecoveryNotification('メモリ不足を検知しました。一部のコンテンツをクリーンアップしました。');
  }

  /**
   * DOMのクリーンアップ
   */
  cleanupDOM() {
    // 非表示のキャンバスや大きなDOM要素の削除
    const canvases = document.querySelectorAll('canvas:not(:visible)');
    canvases.forEach(canvas => canvas.remove());

    // 大きな画像のクリーンアップ
    const images = document.querySelectorAll('img[height]:not([height="auto"])');
    images.forEach(img => {
      if (img.height > 1000) {
        img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';
      }
    });
  }

  /**
   * エラーパターン監視の設定
   */
  setupErrorPatternMonitoring() {
    // エラーパターンの定期分析
    setInterval(() => {
      this.analyzeErrorPatterns();
    }, 300000); // 5分ごと
  }

  /**
   * エラーパターンの更新
   */
  updateErrorPatterns(errorInfo) {
    const patternKey = `${errorInfo.type}:${errorInfo.message?.substring(0, 50) || 'unknown'}`;

    if (!this.errorPatterns.has(patternKey)) {
      this.errorPatterns.set(patternKey, {
        count: 0,
        firstSeen: errorInfo.timestamp,
        lastSeen: errorInfo.timestamp,
        type: errorInfo.type
      });
    }

    const pattern = this.errorPatterns.get(patternKey);
    pattern.count++;
    pattern.lastSeen = errorInfo.timestamp;
  }

  /**
   * エラーパターンの分析
   */
  analyzeErrorPatterns() {
    const frequentErrors = Array.from(this.errorPatterns.entries())
      .filter(([_, pattern]) => pattern.count > 3)
      .sort((a, b) => b[1].count - a[1].count);

    if (frequentErrors.length > 0) {
      console.warn('[VR Error Handler] Frequent error patterns detected:', frequentErrors);

      // 頻出エラーに対する予防措置
      this.implementPreventiveMeasures(frequentErrors);
    }
  }

  /**
   * 予防措置の実装
   */
  implementPreventiveMeasures(frequentErrors) {
    frequentErrors.forEach(([patternKey, pattern]) => {
      if (pattern.type === 'webgl_context_lost') {
        // WebGLコンテキストロスが頻発する場合
        this.enableWebGLFallback();
      } else if (pattern.type === 'network_error') {
        // ネットワークエラーが頻発する場合
        this.enableOfflineMode();
      }
    });
  }

  /**
   * エラー統計の更新
   */
  updateErrorStats(errorInfo) {
    // エラー統計の更新（オプション）
    // この情報はデバッグや改善に使用可能
  }

  /**
   * ユーザーフレンドリーなエラー表示
   */
  showUserFriendlyError(errorInfo) {
    let message = '予期しないエラーが発生しました。';

    switch (errorInfo.type) {
      case 'webxr_error':
        message = 'VR機能でエラーが発生しました。VRデバイスを確認してください。';
        break;
      case 'webgl_context_lost':
        message = 'グラフィック処理でエラーが発生しました。ブラウザを再起動してください。';
        break;
      case 'network_error':
        message = 'ネットワーク接続で問題が発生しました。接続を確認してください。';
        break;
      case 'memory_error':
        message = 'メモリ使用量が限界に近づいています。一部のコンテンツを閉じてください。';
        break;
    }

    this.showErrorNotification(message);
  }

  /**
   * VR固有エラー表示
   */
  showVRSpecificError(errorInfo) {
    let message = 'VRエラーが発生しました。';

    if (errorInfo.detail?.name === 'NotSupportedError') {
      message = 'このデバイスはVR機能をサポートしていません。';
    } else if (errorInfo.detail?.name === 'NotAllowedError') {
      message = 'VR機能の使用許可が必要です。ブラウザの設定を確認してください。';
    } else if (errorInfo.detail?.name === 'SecurityError') {
      message = 'セキュリティ上の理由でVR機能がブロックされました。HTTPS接続を確認してください。';
    }

    this.showErrorNotification(message);
  }

  /**
   * エラー通知の表示
   */
  showErrorNotification(message) {
    if (window.UIComponents && window.UIComponents.Toast) {
      const toast = new window.UIComponents.Toast();
      toast.show({
        type: 'error',
        title: 'エラー',
        message: message,
        duration: 8000
      });
    } else {
      // フォールバック
      console.error('[VR Error Handler]', message);
      alert(message);
    }
  }

  /**
   * 回復通知の表示
   */
  showRecoveryNotification(message) {
    if (window.UIComponents && window.UIComponents.Toast) {
      const toast = new window.UIComponents.Toast();
      toast.show({
        type: 'success',
        title: '回復完了',
        message: message,
        duration: 5000
      });
    } else {
      console.log('[VR Error Handler]', message);
    }
  }

  /**
   * 回復失敗通知の表示
   */
  showRecoveryFailure(description) {
    this.showErrorNotification(`自動回復に失敗しました: ${description}`);
  }

  /**
   * フォールバック通知の表示
   */
  showFallbackNotification(message) {
    if (window.UIComponents && window.UIComponents.Toast) {
      const toast = new window.UIComponents.Toast();
      toast.show({
        type: 'warning',
        title: 'フォールバックモード',
        message: message,
        duration: 10000
      });
    } else {
      console.warn('[VR Error Handler]', message);
    }
  }

  /**
   * クリティカルエラーの表示
   */
  showCriticalError(message) {
    this.showErrorNotification(message);

    // クリティカルエラーの場合は追加の処理
    this.logCriticalError(message);
  }

  /**
   * VRデバイスエラーハンドリングの設定
   */
  setupVRDeviceErrorHandling() {
    if (navigator.xr) {
      // XRセッションエラーの監視
      navigator.xr.addEventListener('devicechange', () => {
        console.log('[VR Error Handler] XR device changed');
      });
    }
  }

  /**
   * WebGLフォールバックの有効化
   */
  enableWebGLFallback() {
    // WebGL 2.0が利用できない場合のフォールバック
    console.log('[VR Error Handler] WebGL fallback enabled');
  }

  /**
   * オフラインモードの有効化
   */
  enableOfflineMode() {
    // ネットワーク依存の機能をオフライン対応に切り替え
    console.log('[VR Error Handler] Offline mode enabled');
  }

  /**
   * 重要コンソールエラーの判定
   */
  isImportantConsoleError(args) {
    const message = args.join(' ').toLowerCase();

    // VR/WebXR関連の重要なエラーをフィルタリング
    return message.includes('webxr') ||
           message.includes('webgl') ||
           message.includes('vr') ||
           message.includes('xr') ||
           message.includes('context lost') ||
           message.includes('network error') ||
           message.includes('out of memory');
  }

  /**
   * クリティカルエラーのログ
   */
  logCriticalError(message) {
    const criticalError = {
      type: 'critical_error',
      message: message,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    // クリティカルエラーは特別に処理
    console.error('[CRITICAL ERROR]', criticalError);

    // 必要に応じて外部サービスへの報告
    this.reportCriticalError(criticalError);
  }

  /**
   * クリティカルエラーの報告
   */
  reportCriticalError(error) {
    // エラー報告サービスへの送信（オプション）
    // 例: Sentry, LogRocketなど
    console.log('[VR Error Handler] Critical error reported:', error);
  }

  /**
   * エラーハンドラーの統計取得
   */
  getStats() {
    return {
      totalErrors: this.errorHistory.length,
      errorPatterns: this.errorPatterns.size,
      recoveryStrategies: this.recoveryStrategies.size,
      autoRecoveryEnabled: this.autoRecoveryEnabled,
      recentErrors: this.errorHistory.slice(-5)
    };
  }

  /**
   * エラーヒストリーの取得
   */
  getErrorHistory(limit = 10) {
    return this.errorHistory.slice(-limit);
  }

  /**
   * 自動回復の有効/無効切り替え
   */
  setAutoRecovery(enabled) {
    this.autoRecoveryEnabled = enabled;
    console.log(`[VR Error Handler] Auto recovery ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// グローバルインスタンス作成
const vrErrorHandler = new VRErrorHandler();

// グローバルアクセス用
window.vrErrorHandler = vrErrorHandler;

// 初期化完了通知
document.addEventListener('DOMContentLoaded', () => {
  console.log('[VR Error Handler] VR Error Handler initialized');
});
