/**
 * Qui Browser VR Network Monitor
 * VRデバイス専用ネットワーク品質監視機能
 *
 * 機能:
 * - リアルタイムネットワーク品質監視
 * - 接続速度とレイテンシの測定
 * - VRコンテンツ品質の自動調整
 * - ネットワーク警告の発行
 * - ストリーミング最適化
 * - オフライン検出と回復
 */

class VRNetworkMonitor {
  constructor() {
    this.connection = null;
    this.isMonitoring = false;
    this.networkStats = {
      downlink: 0,
      uplink: 0,
      rtt: 0,
      effectiveType: 'unknown',
      type: 'unknown',
      saveData: false
    };

    this.qualityThresholds = {
      excellent: { downlink: 50, rtt: 20 },    // 50Mbps, 20ms
      good: { downlink: 25, rtt: 50 },         // 25Mbps, 50ms
      fair: { downlink: 10, rtt: 100 },        // 10Mbps, 100ms
      poor: { downlink: 5, rtt: 200 },         // 5Mbps, 200ms
      critical: { downlink: 1, rtt: 500 }      // 1Mbps, 500ms
    };

    this.vrQualityAdjustments = {
      excellent: { resolution: 1.0, bitrate: 1.0, fps: 90 },
      good: { resolution: 0.9, bitrate: 0.8, fps: 72 },
      fair: { resolution: 0.8, bitrate: 0.6, fps: 60 },
      poor: { resolution: 0.7, bitrate: 0.4, fps: 45 },
      critical: { resolution: 0.6, bitrate: 0.2, fps: 30 }
    };

    this.offlineMode = false;
    this.connectionHistory = [];
    this.maxHistorySize = 100;

    this.init();
  }

  init() {
    // Network Information APIのサポート確認
    this.checkNetworkAPISupport();

    // ネットワーク監視の開始
    this.startNetworkMonitoring();

    // オフライン/オンラインイベントの監視
    this.setupOnlineOfflineEvents();

    // VRセッション監視
    this.setupVRSessionMonitoring();

    console.log('[VR Network] VR Network Monitor initialized');
  }

  /**
   * Network Information APIのサポート確認
   */
  checkNetworkAPISupport() {
    if ('connection' in navigator) {
      this.connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

      if (this.connection) {
        console.log('[VR Network] Network Information API supported');
        this.updateNetworkStats();

        // 接続変更イベントの監視
        this.connection.addEventListener('change', () => this.onNetworkChange());
      } else {
        console.warn('[VR Network] Network Information API not fully supported');
        this.fallbackMonitoring();
      }
    } else {
      console.warn('[VR Network] Network Information API not supported');
      this.fallbackMonitoring();
    }
  }

  /**
   * ネットワーク監視の開始
   */
  startNetworkMonitoring() {
    this.isMonitoring = true;

    // 定期的なネットワーク品質チェック
    setInterval(() => {
      if (this.isMonitoring) {
        this.updateNetworkStats();
        this.checkNetworkQuality();
        this.performLatencyTest();
      }
    }, 5000); // 5秒ごと

    // リアルタイム監視（高頻度）
    setInterval(() => {
      if (this.isMonitoring) {
        this.updateConnectionHistory();
      }
    }, 1000); // 1秒ごと

    console.log('[VR Network] Network monitoring started');
  }

  /**
   * オフライン/オンラインイベントの設定
   */
  setupOnlineOfflineEvents() {
    window.addEventListener('online', () => {
      console.log('[VR Network] Connection restored');
      this.offlineMode = false;
      this.onNetworkRestored();
    });

    window.addEventListener('offline', () => {
      console.log('[VR Network] Connection lost');
      this.offlineMode = true;
      this.onNetworkLost();
    });

    // 初期状態の確認
    this.offlineMode = !navigator.onLine;
  }

  /**
   * VRセッション監視の設定
   */
  setupVRSessionMonitoring() {
    if (window.WebXRManager) {
      window.WebXRManager.addEventListener('sessionstart', () => {
        console.log('[VR Network] VR session started - network monitoring intensified');
        this.onVRSessionStart();
      });

      window.WebXRManager.addEventListener('sessionend', () => {
        console.log('[VR Network] VR session ended');
        this.onVRSessionEnd();
      });
    }
  }

  /**
   * ネットワーク統計の更新
   */
  updateNetworkStats() {
    if (!this.connection) return;

    try {
      this.networkStats = {
        downlink: this.connection.downlink || 0,
        uplink: this.connection.uplink || 0,
        rtt: this.connection.rtt || 0,
        effectiveType: this.connection.effectiveType || 'unknown',
        type: this.connection.type || 'unknown',
        saveData: this.connection.saveData || false
      };

      console.log('[VR Network] Network stats updated:', this.networkStats);
    } catch (error) {
      console.warn('[VR Network] Failed to update network stats:', error);
    }
  }

  /**
   * ネットワーク変更時の処理
   */
  onNetworkChange() {
    console.log('[VR Network] Network connection changed');
    this.updateNetworkStats();
    this.checkNetworkQuality();
    this.notifyNetworkChange();
  }

  /**
   * ネットワーク品質チェック
   */
  checkNetworkQuality() {
    const quality = this.assessNetworkQuality();
    const previousQuality = this.currentQuality;

    this.currentQuality = quality;

    // 品質が変化した場合
    if (previousQuality !== quality) {
      console.log(`[VR Network] Network quality changed: ${previousQuality} -> ${quality}`);
      this.onNetworkQualityChange(quality, previousQuality);
    }

    // 品質に基づく警告
    this.checkNetworkWarnings(quality);
  }

  /**
   * ネットワーク品質評価
   */
  assessNetworkQuality() {
    const { downlink, rtt } = this.networkStats;

    if (this.offlineMode) return 'offline';

    if (downlink >= this.qualityThresholds.excellent.downlink &&
        rtt <= this.qualityThresholds.excellent.rtt) {
      return 'excellent';
    } else if (downlink >= this.qualityThresholds.good.downlink &&
               rtt <= this.qualityThresholds.good.rtt) {
      return 'good';
    } else if (downlink >= this.qualityThresholds.fair.downlink &&
               rtt <= this.qualityThresholds.fair.rtt) {
      return 'fair';
    } else if (downlink >= this.qualityThresholds.poor.downlink &&
               rtt <= this.qualityThresholds.poor.rtt) {
      return 'poor';
    } else {
      return 'critical';
    }
  }

  /**
   * ネットワーク品質変更時の処理
   */
  onNetworkQualityChange(newQuality, oldQuality) {
    // VR品質調整
    this.adjustVRQualityForNetwork(newQuality);

    // 通知
    this.notifyQualityChange(newQuality, oldQuality);

    // 履歴保存
    this.saveQualityChangeEvent(newQuality, oldQuality);
  }

  /**
   * VR品質のネットワーク適応調整
   */
  adjustVRQualityForNetwork(quality) {
    const adjustment = this.vrQualityAdjustments[quality];

    if (adjustment && window.WebXRManager) {
      window.WebXRManager.adjustNetworkQuality(adjustment);
      console.log(`[VR Network] VR quality adjusted for ${quality} network:`, adjustment);
    }

    // コンテンツプリローダーへの通知
    if (window.vrContentPreloader) {
      window.vrContentPreloader.adjustForNetworkQuality(quality);
    }
  }

  /**
   * レイテンシテスト
   */
  async performLatencyTest() {
    if (this.offlineMode) return;

    try {
      const startTime = performance.now();

      // 小さなリクエストでレイテンシを測定
      const response = await fetch('/ping', {
        method: 'HEAD',
        cache: 'no-cache'
      });

      const endTime = performance.now();
      const measuredRTT = endTime - startTime;

      // 測定結果を反映（スムージング）
      this.networkStats.measuredRTT = this.networkStats.measuredRTT || measuredRTT;
      this.networkStats.measuredRTT = this.networkStats.measuredRTT * 0.7 + measuredRTT * 0.3;

      console.log(`[VR Network] Latency test: ${measuredRTT.toFixed(1)}ms`);

    } catch (error) {
      console.warn('[VR Network] Latency test failed:', error);
    }
  }

  /**
   * ネットワーク警告チェック
   */
  checkNetworkWarnings(quality) {
    const { downlink, rtt } = this.networkStats;

    if (quality === 'critical' || quality === 'poor') {
      this.issueNetworkWarning(
        'ネットワーク品質が低下しています。VR体験が影響を受ける可能性があります。',
        quality
      );
    }

    if (rtt > 200) {
      this.issueNetworkWarning(
        `ネットワーク遅延が高くなっています: ${rtt}ms`,
        'latency'
      );
    }

    if (downlink < 5) {
      this.issueNetworkWarning(
        `ダウンロード速度が低下しています: ${downlink}Mbps`,
        'bandwidth'
      );
    }
  }

  /**
   * ネットワーク警告の発行
   */
  issueNetworkWarning(message, type) {
    // 重複警告を防ぐ
    const warningKey = `network-${type}`;
    if (this.activeWarnings?.has(warningKey)) {
      return;
    }

    if (!this.activeWarnings) {
      this.activeWarnings = new Set();
    }
    this.activeWarnings.add(warningKey);

    // UI通知
    if (window.UIComponents && window.UIComponents.Toast) {
      const toast = new window.UIComponents.Toast();
      toast.show({
        type: 'warning',
        title: 'ネットワーク警告',
        message: message,
        duration: 10000
      });
    }

    console.warn(`[VR Network Warning] ${message}`);

    // 警告の自動クリア（30秒後）
    setTimeout(() => {
      this.activeWarnings.delete(warningKey);
    }, 30000);
  }

  /**
   * ネットワーク切断時の処理
   */
  onNetworkLost() {
    console.log('[VR Network] Network lost - switching to offline mode');

    // オフラインモードの有効化
    this.enableOfflineMode();

    // 緊急通知
    if (window.UIComponents && window.UIComponents.Toast) {
      const toast = new window.UIComponents.Toast();
      toast.show({
        type: 'error',
        title: 'ネットワーク切断',
        message: 'オフラインモードに切り替わりました。一部の機能が制限されます。',
        duration: 0 // 永続表示
      });
    }
  }

  /**
   * ネットワーク回復時の処理
   */
  onNetworkRestored() {
    console.log('[VR Network] Network restored');

    // オフラインモードの無効化
    this.disableOfflineMode();

    // ネットワーク品質チェック
    setTimeout(() => {
      this.updateNetworkStats();
      this.checkNetworkQuality();
    }, 1000);

    // 通知
    if (window.UIComponents && window.UIComponents.Toast) {
      const toast = new window.UIComponents.Toast();
      toast.show({
        type: 'success',
        title: 'ネットワーク回復',
        message: 'ネットワーク接続が回復しました。',
        duration: 5000
      });
    }
  }

  /**
   * VRセッション開始時の処理
   */
  onVRSessionStart() {
    // VRセッション中のネットワーク監視強化
    this.vrSessionActive = true;

    // 初期ネットワークチェック
    this.performInitialVRNetworkCheck();
  }

  /**
   * VRセッション終了時の処理
   */
  onVRSessionEnd() {
    this.vrSessionActive = false;

    // ネットワークレポート生成
    this.generateNetworkReport();
  }

  /**
   * 初期VRネットワークチェック
   */
  performInitialVRNetworkCheck() {
    const quality = this.assessNetworkQuality();

    if (quality === 'excellent' || quality === 'good') {
      console.log(`[VR Network] Good network conditions for VR: ${quality}`);
    } else {
      this.issueNetworkWarning(
        `VRセッション開始時のネットワーク品質が低下しています: ${quality}`,
        'vr-session-start'
      );
    }
  }

  /**
   * オフラインモード有効化
   */
  enableOfflineMode() {
    this.offlineMode = true;

    // オフライン対応機能の有効化
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'ENABLE_OFFLINE_MODE'
      });
    }

    console.log('[VR Network] Offline mode enabled');
  }

  /**
   * オフラインモード無効化
   */
  disableOfflineMode() {
    this.offlineMode = false;

    // オンライン機能の復元
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'DISABLE_OFFLINE_MODE'
      });
    }

    console.log('[VR Network] Offline mode disabled');
  }

  /**
   * 接続履歴の更新
   */
  updateConnectionHistory() {
    const entry = {
      timestamp: Date.now(),
      quality: this.currentQuality,
      stats: { ...this.networkStats },
      offline: this.offlineMode
    };

    this.connectionHistory.push(entry);

    // 履歴サイズ制限
    if (this.connectionHistory.length > this.maxHistorySize) {
      this.connectionHistory.shift();
    }
  }

  /**
   * 品質変更イベントの保存
   */
  saveQualityChangeEvent(newQuality, oldQuality) {
    const event = {
      type: 'quality_change',
      timestamp: Date.now(),
      from: oldQuality,
      to: newQuality,
      stats: { ...this.networkStats }
    };

    // localStorageに保存（オプション）
    try {
      const events = JSON.parse(localStorage.getItem('vr_network_events') || '[]');
      events.push(event);

      // 最新50件のみ保存
      if (events.length > 50) {
        events.splice(0, events.length - 50);
      }

      localStorage.setItem('vr_network_events', JSON.stringify(events));
    } catch (error) {
      console.warn('[VR Network] Failed to save quality change event:', error);
    }
  }

  /**
   * ネットワーク変更通知
   */
  notifyNetworkChange() {
    // 他のコンポーネントへの通知
    const event = new CustomEvent('vrnetworkchange', {
      detail: {
        stats: this.networkStats,
        quality: this.currentQuality,
        offline: this.offlineMode
      }
    });

    document.dispatchEvent(event);
  }

  /**
   * 品質変更通知
   */
  notifyQualityChange(newQuality, oldQuality) {
    const event = new CustomEvent('vrnetworkqualitychange', {
      detail: {
        newQuality,
        oldQuality,
        stats: this.networkStats
      }
    });

    document.dispatchEvent(event);
  }

  /**
   * フォールバック監視（Network Information API未対応時）
   */
  fallbackMonitoring() {
    console.log('[VR Network] Using fallback network monitoring');

    // 定期的な接続テスト
    setInterval(() => {
      this.performFallbackConnectionTest();
    }, 10000); // 10秒ごと
  }

  /**
   * フォールバック接続テスト
   */
  async performFallbackConnectionTest() {
    try {
      const startTime = performance.now();

      // 小さなリクエストで接続テスト
      const response = await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000) // 5秒タイムアウト
      });

      const endTime = performance.now();
      const rtt = endTime - startTime;

      // 推定品質評価
      let estimatedQuality = 'good';
      if (rtt > 500) estimatedQuality = 'critical';
      else if (rtt > 200) estimatedQuality = 'poor';
      else if (rtt > 100) estimatedQuality = 'fair';

      this.networkStats.fallbackRTT = rtt;
      this.networkStats.effectiveType = 'fallback';
      this.networkStats.type = navigator.onLine ? 'online' : 'offline';

      // 品質更新
      if (this.currentQuality !== estimatedQuality) {
        this.onNetworkQualityChange(estimatedQuality, this.currentQuality);
      }

    } catch (error) {
      // 接続失敗
      if (this.currentQuality !== 'offline') {
        this.onNetworkQualityChange('offline', this.currentQuality);
      }
    }
  }

  /**
   * ネットワークレポート生成
   */
  generateNetworkReport() {
    const report = {
      sessionDuration: Date.now() - (this.sessionStartTime || Date.now()),
      averageQuality: this.calculateAverageQuality(),
      connectionStability: this.calculateConnectionStability(),
      qualityChanges: this.countQualityChanges(),
      offlineTime: this.calculateOfflineTime(),
      peakLatency: this.findPeakLatency(),
      averageLatency: this.calculateAverageLatency()
    };

    console.log('[VR Network] Session network report:', report);

    // レポート保存（オプション）
    this.saveNetworkReport(report);

    return report;
  }

  /**
   * 平均品質計算
   */
  calculateAverageQuality() {
    if (this.connectionHistory.length === 0) return 'unknown';

    const qualities = ['excellent', 'good', 'fair', 'poor', 'critical', 'offline'];
    const qualityScores = {};

    this.connectionHistory.forEach(entry => {
      const quality = entry.quality || 'unknown';
      qualityScores[quality] = (qualityScores[quality] || 0) + 1;
    });

    let maxCount = 0;
    let averageQuality = 'unknown';

    Object.entries(qualityScores).forEach(([quality, count]) => {
      if (count > maxCount) {
        maxCount = count;
        averageQuality = quality;
      }
    });

    return averageQuality;
  }

  /**
   * 接続安定性計算
   */
  calculateConnectionStability() {
    if (this.connectionHistory.length < 2) return 1.0;

    let changes = 0;
    let previousQuality = this.connectionHistory[0].quality;

    this.connectionHistory.forEach(entry => {
      if (entry.quality !== previousQuality) {
        changes++;
        previousQuality = entry.quality;
      }
    });

    return 1.0 - (changes / this.connectionHistory.length);
  }

  /**
   * 品質変更回数カウント
   */
  countQualityChanges() {
    let changes = 0;
    let previousQuality = null;

    this.connectionHistory.forEach(entry => {
      if (previousQuality && entry.quality !== previousQuality) {
        changes++;
      }
      previousQuality = entry.quality;
    });

    return changes;
  }

  /**
   * オフライン時間計算
   */
  calculateOfflineTime() {
    let offlineTime = 0;
    let lastTimestamp = null;

    this.connectionHistory.forEach(entry => {
      if (lastTimestamp && entry.offline) {
        offlineTime += entry.timestamp - lastTimestamp;
      }
      lastTimestamp = entry.timestamp;
    });

    return offlineTime;
  }

  /**
   * ピークレイテンシ検索
   */
  findPeakLatency() {
    let peak = 0;

    this.connectionHistory.forEach(entry => {
      const latency = entry.stats.rtt || entry.stats.measuredRTT || 0;
      if (latency > peak) {
        peak = latency;
      }
    });

    return peak;
  }

  /**
   * 平均レイテンシ計算
   */
  calculateAverageLatency() {
    const latencies = this.connectionHistory
      .map(entry => entry.stats.rtt || entry.stats.measuredRTT || 0)
      .filter(latency => latency > 0);

    if (latencies.length === 0) return 0;

    return latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length;
  }

  /**
   * ネットワークレポート保存
   */
  saveNetworkReport(report) {
    try {
      const reports = JSON.parse(localStorage.getItem('vr_network_reports') || '[]');
      reports.push({
        timestamp: Date.now(),
        ...report
      });

      // 最新10件のみ保存
      if (reports.length > 10) {
        reports.shift();
      }

      localStorage.setItem('vr_network_reports', JSON.stringify(reports));
    } catch (error) {
      console.warn('[VR Network] Failed to save network report:', error);
    }
  }

  /**
   * ネットワーク統計取得
   */
  getStats() {
    return {
      currentQuality: this.currentQuality,
      networkStats: { ...this.networkStats },
      offlineMode: this.offlineMode,
      isMonitoring: this.isMonitoring,
      vrSessionActive: this.vrSessionActive,
      connectionHistory: this.connectionHistory.length,
      activeWarnings: this.activeWarnings ? Array.from(this.activeWarnings) : []
    };
  }

  /**
   * 接続履歴取得
   */
  getConnectionHistory(limit = 20) {
    return this.connectionHistory.slice(-limit);
  }

  /**
   * ネットワークレポート履歴取得
   */
  getNetworkReports() {
    try {
      return JSON.parse(localStorage.getItem('vr_network_reports') || '[]');
    } catch (error) {
      console.warn('[VR Network] Failed to load network reports:', error);
      return [];
    }
  }

  /**
   * 監視停止
   */
  stopMonitoring() {
    this.isMonitoring = false;
    console.log('[VR Network] Network monitoring stopped');
  }

  /**
   * 監視再開
   */
  resumeMonitoring() {
    if (!this.isMonitoring) {
      this.isMonitoring = true;
      this.startNetworkMonitoring();
      console.log('[VR Network] Network monitoring resumed');
    }
  }
}

// グローバルインスタンス作成
const vrNetworkMonitor = new VRNetworkMonitor();

// グローバルアクセス用
window.vrNetworkMonitor = vrNetworkMonitor;

// 初期化完了通知
document.addEventListener('DOMContentLoaded', () => {
  console.log('[VR Network] VR Network Monitor initialized');
});
