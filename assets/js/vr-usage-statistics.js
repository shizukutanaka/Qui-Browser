/**
 * Qui Browser VR Usage Statistics
 * VRデバイス使用統計収集と分析機能
 *
 * 機能:
 * - VRセッション統計の収集
 * - パフォーマンス指標の追跡
 * - エラー発生状況の記録
 * - 機能使用状況の分析
 * - プライバシー保護
 * - 統計データの保存とレポート
 */

class VRUsageStatistics {
  constructor() {
    this.statsKey = 'qui-vr-usage-stats';
    this.privacyKey = 'qui-vr-privacy-settings';
    this.isCollecting = false;
    this.currentSession = null;
    this.privacySettings = {
      collectUsage: true,
      collectPerformance: true,
      collectErrors: true,
      collectFeatures: true,
      allowAnonymized: true,
      retentionDays: 30
    };

    // 統計データ
    this.stats = {
      totalSessions: 0,
      totalUsageTime: 0,
      averageSessionTime: 0,
      peakConcurrentUsers: 0,
      featureUsage: new Map(),
      performanceMetrics: [],
      errorCounts: new Map(),
      networkStats: [],
      deviceStats: new Map(),
      lastUpdated: Date.now()
    };

    this.init();
  }

  init() {
    // プライバシー設定の読み込み
    this.loadPrivacySettings();

    // 統計データの読み込み
    this.loadStats();

    // 統計収集の開始
    if (this.privacySettings.collectUsage) {
      this.startCollection();
    }

    // 定期的な統計更新
    this.setupPeriodicUpdates();

    console.log('[VR Stats] VR Usage Statistics initialized');
  }

  /**
   * プライバシー設定の読み込み
   */
  loadPrivacySettings() {
    try {
      const saved = localStorage.getItem(this.privacyKey);
      if (saved) {
        this.privacySettings = { ...this.privacySettings, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('[VR Stats] Failed to load privacy settings:', error);
    }
  }

  /**
   * プライバシー設定の保存
   */
  savePrivacySettings() {
    try {
      localStorage.setItem(this.privacyKey, JSON.stringify(this.privacySettings));
    } catch (error) {
      console.warn('[VR Stats] Failed to save privacy settings:', error);
    }
  }

  /**
   * 統計データの読み込み
   */
  loadStats() {
    try {
      const saved = localStorage.getItem(this.statsKey);
      if (saved) {
        const parsedStats = JSON.parse(saved);

        // Mapオブジェクトの復元
        this.stats = {
          ...parsedStats,
          featureUsage: new Map(parsedStats.featureUsage || []),
          errorCounts: new Map(parsedStats.errorCounts || []),
          deviceStats: new Map(parsedStats.deviceStats || [])
        };

        // 古いデータのクリーンアップ
        this.cleanupOldData();

      }
    } catch (error) {
      console.warn('[VR Stats] Failed to load statistics:', error);
    }
  }

  /**
   * 統計データの保存
   */
  saveStats() {
    try {
      // Mapを配列に変換して保存
      const statsToSave = {
        ...this.stats,
        featureUsage: Array.from(this.stats.featureUsage.entries()),
        errorCounts: Array.from(this.stats.errorCounts.entries()),
        deviceStats: Array.from(this.stats.deviceStats.entries()),
        performanceMetrics: this.stats.performanceMetrics.slice(-100), // 最新100件のみ
        networkStats: this.stats.networkStats.slice(-50) // 最新50件のみ
      };

      localStorage.setItem(this.statsKey, JSON.stringify(statsToSave));
    } catch (error) {
      console.warn('[VR Stats] Failed to save statistics:', error);
    }
  }

  /**
   * 統計収集の開始
   */
  startCollection() {
    if (this.isCollecting) return;

    this.isCollecting = true;

    // VRセッション監視
    this.setupVRSessionTracking();

    // パフォーマンス監視
    this.setupPerformanceTracking();

    // エラー監視
    this.setupErrorTracking();

    // 機能使用監視
    this.setupFeatureTracking();

    console.log('[VR Stats] Statistics collection started');
  }

  /**
   * 統計収集の停止
   */
  stopCollection() {
    this.isCollecting = false;
    console.log('[VR Stats] Statistics collection stopped');
  }

  /**
   * VRセッション追跡の設定
   */
  setupVRSessionTracking() {
    if (window.WebXRManager) {
      window.WebXRManager.addEventListener('sessionstart', () => {
        this.onVRSessionStart();
      });

      window.WebXRManager.addEventListener('sessionend', () => {
        this.onVRSessionEnd();
      });
    }
  }

  /**
   * VRセッション開始時の処理
   */
  onVRSessionStart() {
    this.currentSession = {
      id: this.generateSessionId(),
      startTime: Date.now(),
      deviceInfo: this.getDeviceInfo(),
      initialSettings: this.getCurrentSettings()
    };

    // デバイス統計の更新
    this.updateDeviceStats(this.currentSession.deviceInfo);

    console.log(`[VR Stats] Session started: ${this.currentSession.id}`);
  }

  /**
   * VRセッション終了時の処理
   */
  onVRSessionEnd() {
    if (!this.currentSession) return;

    const sessionDuration = Date.now() - this.currentSession.startTime;
    const sessionData = {
      ...this.currentSession,
      endTime: Date.now(),
      duration: sessionDuration,
      finalSettings: this.getCurrentSettings()
    };

    // セッション統計の更新
    this.updateSessionStats(sessionData);

    // セッション終了イベントの記録
    this.recordEvent('session_end', sessionData);

    console.log(`[VR Stats] Session ended: ${this.currentSession.id} (${sessionDuration}ms)`);

    this.currentSession = null;
  }

  /**
   * パフォーマンス追跡の設定
   */
  setupPerformanceTracking() {
    if (window.vrPerformanceMonitor) {
      // パフォーマンスレポートの定期受信
      setInterval(() => {
        const performanceStats = window.vrPerformanceMonitor.getStats();
        this.recordPerformanceStats(performanceStats);
      }, 30000); // 30秒ごと
    }
  }

  /**
   * エラー追跡の設定
   */
  setupErrorTracking() {
    if (window.vrErrorHandler) {
      // エラーレポートの定期受信
      setInterval(() => {
        const errorStats = window.vrErrorHandler.getStats();
        this.recordErrorStats(errorStats);
      }, 60000); // 1分ごと
    }

    // グローバルエラー監視
    window.addEventListener('error', (event) => {
      this.recordError('javascript_error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.recordError('promise_rejection', {
        reason: event.reason?.toString()
      });
    });
  }

  /**
   * 機能追跡の設定
   */
  setupFeatureTracking() {
    // 各VR機能の使用状況を追跡
    this.trackFeatureUsage('webxr-integration');
    this.trackFeatureUsage('gesture-controls');
    this.trackFeatureUsage('spatial-navigation');
    this.trackFeatureUsage('battery-monitor');
    this.trackFeatureUsage('network-monitor');
    this.trackFeatureUsage('offline-storage');
    this.trackFeatureUsage('accessibility-system');
  }

  /**
   * 定期的な統計更新の設定
   */
  setupPeriodicUpdates() {
    // 統計データの定期保存
    setInterval(() => {
      if (this.isCollecting) {
        this.saveStats();
      }
    }, 120000); // 2分ごと

    // 古いデータのクリーンアップ
    setInterval(() => {
      this.cleanupOldData();
    }, 3600000); // 1時間ごと
  }

  /**
   * セッション統計の更新
   */
  updateSessionStats(sessionData) {
    this.stats.totalSessions++;
    this.stats.totalUsageTime += sessionData.duration;

    // 平均セッション時間の計算
    this.stats.averageSessionTime = this.stats.totalUsageTime / this.stats.totalSessions;

    // ピーク同時ユーザー数の更新（簡易）
    this.stats.peakConcurrentUsers = Math.max(this.stats.peakConcurrentUsers, 1);
  }

  /**
   * デバイス統計の更新
   */
  updateDeviceStats(deviceInfo) {
    const deviceKey = `${deviceInfo.vendor || 'unknown'}-${deviceInfo.renderer || 'unknown'}`;
    const currentCount = this.stats.deviceStats.get(deviceKey) || 0;
    this.stats.deviceStats.set(deviceKey, currentCount + 1);
  }

  /**
   * パフォーマンス統計の記録
   */
  recordPerformanceStats(performanceStats) {
    if (!this.privacySettings.collectPerformance) return;

    const record = {
      timestamp: Date.now(),
      fps: performanceStats.fps,
      averageFps: performanceStats.averageFps,
      frameTime: performanceStats.frameTime,
      memoryUsage: performanceStats.memoryUsage
    };

    this.stats.performanceMetrics.push(record);

    // 最新100件のみ保持
    if (this.stats.performanceMetrics.length > 100) {
      this.stats.performanceMetrics.shift();
    }
  }

  /**
   * エラー統計の記録
   */
  recordErrorStats(errorStats) {
    if (!this.privacySettings.collectErrors) return;

    // エラーカウントの更新
    Object.entries(errorStats).forEach(([errorType, count]) => {
      if (typeof count === 'number') {
        const currentCount = this.stats.errorCounts.get(errorType) || 0;
        this.stats.errorCounts.set(errorType, currentCount + count);
      }
    });
  }

  /**
   * エラーの記録
   */
  recordError(errorType, errorData) {
    if (!this.privacySettings.collectErrors) return;

    const errorRecord = {
      type: errorType,
      timestamp: Date.now(),
      data: errorData,
      sessionId: this.currentSession?.id
    };

    const currentCount = this.stats.errorCounts.get(errorType) || 0;
    this.stats.errorCounts.set(errorType, currentCount + 1);

    // エラーイベントの記録
    this.recordEvent('error', errorRecord);
  }

  /**
   * 機能使用状況の追跡
   */
  trackFeatureUsage(featureName) {
    if (!this.privacySettings.collectFeatures) return;

    // 機能が使用されたことを記録
    const currentCount = this.stats.featureUsage.get(featureName) || 0;
    this.stats.featureUsage.set(featureName, currentCount + 1);
  }

  /**
   * イベントの記録
   */
  recordEvent(eventType, eventData) {
    const event = {
      type: eventType,
      timestamp: Date.now(),
      data: eventData,
      sessionId: this.currentSession?.id
    };

    // イベントは別途保存（オプション）
    this.saveEvent(event);
  }

  /**
   * イベントの保存
   */
  saveEvent(event) {
    try {
      const events = JSON.parse(localStorage.getItem('vr_events') || '[]');
      events.push(event);

      // 最新200件のみ保存
      if (events.length > 200) {
        events.splice(0, events.length - 200);
      }

      localStorage.setItem('vr_events', JSON.stringify(events));
    } catch (error) {
      console.warn('[VR Stats] Failed to save event:', error);
    }
  }

  /**
   * 古いデータのクリーンアップ
   */
  cleanupOldData() {
    const retentionMs = this.privacySettings.retentionDays * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - retentionMs;

    // パフォーマンスメトリクスのクリーンアップ
    this.stats.performanceMetrics = this.stats.performanceMetrics.filter(
      metric => metric.timestamp > cutoffTime
    );

    // ネットワーク統計のクリーンアップ
    this.stats.networkStats = this.stats.networkStats.filter(
      stat => stat.timestamp > cutoffTime
    );

    // イベントのクリーンアップ
    try {
      const events = JSON.parse(localStorage.getItem('vr_events') || '[]');
      const filteredEvents = events.filter(event => event.timestamp > cutoffTime);
      localStorage.setItem('vr_events', JSON.stringify(filteredEvents));
    } catch (error) {
      // エラーが発生しても無視
    }

    console.log('[VR Stats] Old data cleaned up');
  }

  /**
   * デバイス情報の取得
   */
  getDeviceInfo() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    let gpuInfo = {};
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        gpuInfo = {
          vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
          renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        };
      }
    }

    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory,
      ...gpuInfo
    };
  }

  /**
   * 現在の設定の取得
   */
  getCurrentSettings() {
    const settings = {};

    // 各サブシステムから設定を取得
    if (window.vrSettingsUI) {
      settings.userSettings = window.vrSettingsUI.getSettings();
    }

    return settings;
  }

  /**
   * 統計レポートの生成
   */
  generateReport(type = 'summary') {
    const report = {
      generatedAt: Date.now(),
      type: type,
      privacySettings: { ...this.privacySettings },
      collectionActive: this.isCollecting
    };

    switch (type) {
      case 'summary':
        report.data = this.generateSummaryReport();
        break;
      case 'performance':
        report.data = this.generatePerformanceReport();
        break;
      case 'usage':
        report.data = this.generateUsageReport();
        break;
      case 'errors':
        report.data = this.generateErrorReport();
        break;
      default:
        report.data = this.stats;
    }

    return report;
  }

  /**
   * サマリーレポートの生成
   */
  generateSummaryReport() {
    return {
      totalSessions: this.stats.totalSessions,
      totalUsageTime: this.stats.totalUsageTime,
      averageSessionTime: this.stats.averageSessionTime,
      peakConcurrentUsers: this.stats.peakConcurrentUsers,
      topUsedFeatures: Array.from(this.stats.featureUsage.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      mostCommonErrors: Array.from(this.stats.errorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      deviceDistribution: Object.fromEntries(this.stats.deviceStats.entries())
    };
  }

  /**
   * パフォーマンスレポートの生成
   */
  generatePerformanceReport() {
    if (this.stats.performanceMetrics.length === 0) {
      return { message: 'No performance data available' };
    }

    const metrics = this.stats.performanceMetrics;
    const latest = metrics[metrics.length - 1];

    return {
      currentFps: latest.fps,
      averageFps: metrics.reduce((sum, m) => sum + m.fps, 0) / metrics.length,
      minFps: Math.min(...metrics.map(m => m.fps)),
      maxFps: Math.max(...metrics.map(m => m.fps)),
      averageFrameTime: metrics.reduce((sum, m) => sum + m.frameTime, 0) / metrics.length,
      dataPoints: metrics.length
    };
  }

  /**
   * 使用状況レポートの生成
   */
  generateUsageReport() {
    return {
      featureUsage: Object.fromEntries(this.stats.featureUsage.entries()),
      sessionPatterns: {
        totalSessions: this.stats.totalSessions,
        averageDuration: this.stats.averageSessionTime,
        totalDuration: this.stats.totalUsageTime
      },
      deviceStats: Object.fromEntries(this.stats.deviceStats.entries())
    };
  }

  /**
   * エラーレポートの生成
   */
  generateErrorReport() {
    return {
      errorCounts: Object.fromEntries(this.stats.errorCounts.entries()),
      totalErrors: Array.from(this.stats.errorCounts.values()).reduce((sum, count) => sum + count, 0),
      mostCommonErrors: Array.from(this.stats.errorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    };
  }

  /**
   * 統計データのエクスポート
   */
  exportData() {
    const data = {
      stats: this.stats,
      privacySettings: this.privacySettings,
      events: this.getEvents(),
      exportedAt: Date.now()
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * イベントデータの取得
   */
  getEvents(limit = 100) {
    try {
      const events = JSON.parse(localStorage.getItem('vr_events') || '[]');
      return events.slice(-limit);
    } catch (error) {
      console.warn('[VR Stats] Failed to get events:', error);
      return [];
    }
  }

  /**
   * プライバシー設定の更新
   */
  updatePrivacySettings(newSettings) {
    this.privacySettings = { ...this.privacySettings, ...newSettings };
    this.savePrivacySettings();

    // 設定変更に応じた処理
    if (!this.privacySettings.collectUsage && this.isCollecting) {
      this.stopCollection();
    } else if (this.privacySettings.collectUsage && !this.isCollecting) {
      this.startCollection();
    }

    console.log('[VR Stats] Privacy settings updated');
  }

  /**
   * データの完全削除
   */
  clearAllData() {
    // 統計データのクリア
    this.stats = {
      totalSessions: 0,
      totalUsageTime: 0,
      averageSessionTime: 0,
      peakConcurrentUsers: 0,
      featureUsage: new Map(),
      performanceMetrics: [],
      errorCounts: new Map(),
      networkStats: [],
      deviceStats: new Map(),
      lastUpdated: Date.now()
    };

    // localStorageのクリア
    try {
      localStorage.removeItem(this.statsKey);
      localStorage.removeItem('vr_events');
      localStorage.removeItem('vr_performance_reports');
      localStorage.removeItem('vr_network_reports');
    } catch (error) {
      console.warn('[VR Stats] Failed to clear localStorage:', error);
    }

    console.log('[VR Stats] All data cleared');
  }

  /**
   * セッションIDの生成
   */
  generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 統計データの取得
   */
  getStats() {
    return {
      ...this.stats,
      isCollecting: this.isCollecting,
      currentSession: this.currentSession,
      privacySettings: { ...this.privacySettings }
    };
  }

  /**
   * プライバシー設定の取得
   */
  getPrivacySettings() {
    return { ...this.privacySettings };
  }

  /**
   * 匿名化データの生成（オプション）
   */
  generateAnonymizedData() {
    if (!this.privacySettings.allowAnonymized) {
      return null;
    }

    // 個人情報を除去した匿名データ
    return {
      sessionCount: this.stats.totalSessions,
      averageSessionTime: Math.round(this.stats.averageSessionTime / 1000), // 秒単位
      featureUsage: Object.fromEntries(
        Array.from(this.stats.featureUsage.entries()).map(([feature, count]) => [
          this.hashString(feature),
          count
        ])
      ),
      errorTypes: Array.from(this.stats.errorCounts.keys()).map(type => this.hashString(type)),
      deviceTypes: Array.from(this.stats.deviceStats.keys()).map(device => this.hashString(device))
    };
  }

  /**
   * 文字列のハッシュ化
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return Math.abs(hash).toString(36);
  }
}

// グローバルインスタンス作成
const vrUsageStatistics = new VRUsageStatistics();

// グローバルアクセス用
window.vrUsageStatistics = vrUsageStatistics;

// 初期化完了通知
document.addEventListener('DOMContentLoaded', () => {
  console.log('[VR Stats] VR Usage Statistics initialized');
});
