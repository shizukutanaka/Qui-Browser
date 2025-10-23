/**
 * Advanced Error Handling System
 * エンタープライズレベルのエラー処理とレポートシステム
 * @version 2.0.1
 */

class ErrorHandler {
  constructor() {
    this.errorQueue = [];
    this.maxQueueSize = 100;
    this.errorReports = new Map();
    this.retryAttempts = new Map();
    this.maxRetryAttempts = 3;

    this.setupGlobalErrorHandlers();
    this.setupUnhandledRejectionHandler();
    this.setupResourceErrorHandler();
  }

  /**
   * グローバルエラーハンドラー設定
   */
  setupGlobalErrorHandlers() {
    window.addEventListener('error', (event) => {
      this.handleError('JavaScript Error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        stack: event.error?.stack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        vrMode: this.isVRMode()
      });
    });
  }

  /**
   * Promise rejectionハンドラー設定
   */
  setupUnhandledRejectionHandler() {
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError('Unhandled Promise Rejection', {
        reason: event.reason,
        promise: event.promise,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        vrMode: this.isVRMode()
      });
    });
  }

  /**
   * リソースエラーハンドラー設定
   */
  setupResourceErrorHandler() {
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        this.handleError('Resource Error', {
          target: event.target.tagName,
          src: event.target.src || event.target.href,
          type: event.type,
          timestamp: new Date().toISOString()
        });
      }
    }, true);
  }

  /**
   * エラー処理
   */
  handleError(type, errorData) {
    const errorId = this.generateErrorId();
    const errorReport = {
      id: errorId,
      type,
      severity: this.determineSeverity(type),
      data: errorData,
      timestamp: new Date().toISOString(),
      handled: false,
      retryCount: 0
    };

    this.addToQueue(errorReport);
    this.logError(errorReport);
    this.attemptRecovery(errorReport);
    this.reportToServer(errorReport);
  }

  /**
   * エラーID生成
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 深刻度判定
   */
  determineSeverity(type) {
    const criticalTypes = ['JavaScript Error', 'Unhandled Promise Rejection'];
    const warningTypes = ['Resource Error'];

    if (criticalTypes.includes(type)) return 'critical';
    if (warningTypes.includes(type)) return 'warning';
    return 'info';
  }

  /**
   * キューに追加
   */
  addToQueue(errorReport) {
    this.errorQueue.push(errorReport);

    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift(); // 古いエラーを削除
    }
  }

  /**
   * エラーログ出力
   */
  logError(errorReport) {
    const logMethod = this.getLogMethod(errorReport.severity);
    const logMessage = `[${errorReport.type}] ${errorReport.data.message || 'No message'}`;

    logMethod(logMessage, errorReport);

    if (errorReport.data.stack) {
      console.error('Stack trace:', errorReport.data.stack);
    }
  }

  /**
   * ログメソッド取得
   */
  getLogMethod(severity) {
    switch (severity) {
      case 'critical': return console.error;
      case 'warning': return console.warn;
      default: return console.info;
    }
  }

  /**
   * VRモード判定
   */
  isVRMode() {
    return window.navigator.xr !== undefined &&
           window.location.href.includes('vr=true');
  }

  /**
   * リカバリー試行
   */
  attemptRecovery(errorReport) {
    const recoveryStrategy = this.getRecoveryStrategy(errorReport.type);

    if (recoveryStrategy) {
      setTimeout(() => {
        this.executeRecoveryStrategy(errorReport, recoveryStrategy);
      }, 1000);
    }
  }

  /**
   * リカバリー戦略取得
   */
  getRecoveryStrategy(type) {
    const strategies = {
      'Resource Error': 'reloadResource',
      'Network Error': 'retryNetworkRequest',
      'JavaScript Error': 'restartModule'
    };

    return strategies[type];
  }

  /**
   * リカバリー戦略実行
   */
  async executeRecoveryStrategy(errorReport, strategy) {
    try {
      switch (strategy) {
        case 'reloadResource':
          await this.reloadResource(errorReport.data.src);
          break;
        case 'retryNetworkRequest':
          await this.retryNetworkRequest(errorReport);
          break;
        case 'restartModule':
          await this.restartModule(errorReport);
          break;
      }

      errorReport.handled = true;
      console.log(`[ErrorHandler] Recovery successful for ${errorReport.id}`);
    } catch (recoveryError) {
      console.error(`[ErrorHandler] Recovery failed for ${errorReport.id}:`, recoveryError);
      this.escalateError(errorReport);
    }
  }

  /**
   * リソース再読み込み
   */
  async reloadResource(src) {
    if (!src) return;

    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = src;
      link.as = src.endsWith('.js') ? 'script' : 'style';
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

  /**
   * ネットワークリクエスト再試行
   */
  async retryNetworkRequest(errorReport) {
    const retryKey = `${errorReport.data.url}_${errorReport.data.method}`;

    if (!this.retryAttempts.has(retryKey)) {
      this.retryAttempts.set(retryKey, 0);
    }

    const attempts = this.retryAttempts.get(retryKey);

    if (attempts < this.maxRetryAttempts) {
      this.retryAttempts.set(retryKey, attempts + 1);

      // 指数バックオフで再試行
      const delay = Math.pow(2, attempts) * 1000;

      setTimeout(async () => {
        try {
          const response = await fetch(errorReport.data.url, {
            method: errorReport.data.method || 'GET'
          });

          if (response.ok) {
            console.log(`[ErrorHandler] Network retry successful for ${retryKey}`);
          }
        } catch (retryError) {
          console.error(`[ErrorHandler] Network retry failed for ${retryKey}:`, retryError);
        }
      }, delay);
    }
  }

  /**
   * モジュール再起動
   */
  async restartModule(errorReport) {
    const moduleName = this.extractModuleName(errorReport.data.filename);

    if (moduleName && window.moduleRestarter) {
      await window.moduleRestarter.restart(moduleName);
    }
  }

  /**
   * モジュール名抽出
   */
  extractModuleName(filename) {
    if (!filename) return null;
    const match = filename.match(/\/([^\/]+)\.js$/);
    return match ? match[1] : null;
  }

  /**
   * エスカレーション
   */
  escalateError(errorReport) {
    if (errorReport.severity === 'critical') {
      this.showUserNotification(errorReport);
    }
  }

  /**
   * ユーザーに通知
   */
  showUserNotification(errorReport) {
    // VR環境では視覚的な通知を避け、音声や触覚通知を使用
    if (this.isVRMode()) {
      this.showVRNotification(errorReport);
    } else {
      this.showWebNotification(errorReport);
    }
  }

  /**
   * VR通知
   */
  showVRNotification(errorReport) {
    // VR空間にエラー通知を表示
    console.warn(`[VR Error] ${errorReport.type}: ${errorReport.data.message}`);

    // 触覚フィードバック（利用可能な場合）
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  }

  /**
   * Web通知
   */
  showWebNotification(errorReport) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Qui Browser Error`, {
        body: `${errorReport.type}: ${errorReport.data.message}`,
        icon: '/assets/icon.svg',
        tag: errorReport.id
      });
    }
  }

  /**
   * サーバーへのレポート
   */
  async reportToServer(errorReport) {
    try {
      // オフライン時はキューに保存
      if (!navigator.onLine) {
        this.saveErrorForLaterReporting(errorReport);
        return;
      }

      const response = await fetch('/api/errors/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorReport)
      });

      if (response.ok) {
        console.log(`[ErrorHandler] Error reported to server: ${errorReport.id}`);
      } else {
        console.warn(`[ErrorHandler] Failed to report error: ${response.status}`);
        this.saveErrorForLaterReporting(errorReport);
      }
    } catch (error) {
      console.error('[ErrorHandler] Error reporting failed:', error);
      this.saveErrorForLaterReporting(errorReport);
    }
  }

  /**
   * 後でレポートするための保存
   */
  saveErrorForLaterReporting(errorReport) {
    const pendingReports = JSON.parse(localStorage.getItem('pending_error_reports') || '[]');
    pendingReports.push(errorReport);

    // 最大保存数を制限
    if (pendingReports.length > 50) {
      pendingReports.splice(0, pendingReports.length - 50);
    }

    localStorage.setItem('pending_error_reports', JSON.stringify(pendingReports));
  }

  /**
   * 保留中のレポートを送信
   */
  async flushPendingReports() {
    const pendingReports = JSON.parse(localStorage.getItem('pending_error_reports') || '[]');

    for (const report of pendingReports) {
      await this.reportToServer(report);
    }

    if (pendingReports.length > 0) {
      localStorage.removeItem('pending_error_reports');
    }
  }

  /**
   * エラー統計取得
   */
  getErrorStats() {
    const stats = {
      total: this.errorQueue.length,
      byType: {},
      bySeverity: { critical: 0, warning: 0, info: 0 },
      recent: this.errorQueue.slice(-10)
    };

    this.errorQueue.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      stats.bySeverity[error.severity]++;
    });

    return stats;
  }
}

// グローバルインスタンス
window.ErrorHandler = new ErrorHandler();

// オンライン復帰時の処理
window.addEventListener('online', () => {
  console.log('[ErrorHandler] Connection restored, flushing pending reports');
  window.ErrorHandler.flushPendingReports();
});
