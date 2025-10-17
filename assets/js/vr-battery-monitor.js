/**
 * Qui Browser VR Battery Monitor
 * VRデバイス専用バッテリー監視機能
 *
 * 機能:
 * - バッテリー残量のリアルタイム監視
 * - バッテリー残量による自動品質調整
 * - 低バッテリー時の警告表示
 * - バッテリー消費の最適化
 * - VRセッションの自動調整
 */

class VRBatteryMonitor {
  constructor() {
    this.battery = null;
    this.isMonitoring = false;
    this.lastLevel = null;
    this.warnings = new Set();
    this.qualityAdjustments = {
      high: { fps: 90, quality: 1.0 },
      medium: { fps: 72, quality: 0.8 },
      low: { fps: 60, quality: 0.6 },
      critical: { fps: 45, quality: 0.4 }
    };

    this.init();
  }

  async init() {
    // Battery APIのサポート確認（navigator.battery または navigator.getBattery()）
    if ('battery' in navigator) {
      this.battery = navigator.battery;
      this.setupBatteryMonitoring();
      console.log('[VR Battery] Battery monitoring initialized');
    } else if ('getBattery' in navigator) {
      try {
        this.battery = await navigator.getBattery();
        this.setupBatteryMonitoring();
        console.log('[VR Battery] Battery monitoring initialized');
      } catch (error) {
        console.warn('[VR Battery] Failed to access battery API:', error);
        this.fallbackMonitoring();
      }
    } else {
      console.warn('[VR Battery] Battery API not supported, using fallback');
      this.fallbackMonitoring();
    }
  }

  /**
   * バッテリー監視の設定
   */
  setupBatteryMonitoring() {
    // バッテリー状態の変更を監視
    this.battery.addEventListener('levelchange', () => this.onBatteryLevelChange());
    this.battery.addEventListener('chargingchange', () => this.onChargingChange());
    this.battery.addEventListener('dischargingtimechange', () => this.onDischargingTimeChange());

    // 初期状態のチェック
    this.checkBatteryStatus();
    this.isMonitoring = true;

    // 定期的なチェック（Battery APIが更新されない場合のフォールバック）
    setInterval(() => this.checkBatteryStatus(), 30000); // 30秒ごと
  }

  /**
   * バッテリー残量変更時の処理
   */
  onBatteryLevelChange() {
    const level = this.battery.level;
    const levelPercent = Math.round(level * 100);

    console.log(`[VR Battery] Battery level changed: ${levelPercent}%`);

    // 品質調整の実行
    this.adjustQualityForBattery(level);

    // 警告の表示
    this.showBatteryWarnings(level);

    // UI更新
    this.updateBatteryUI(level, this.battery.charging);

    this.lastLevel = level;
  }

  /**
   * 充電状態変更時の処理
   */
  onChargingChange() {
    const isCharging = this.battery.charging;
    console.log(`[VR Battery] Charging status changed: ${isCharging ? 'charging' : 'discharging'}`);

    // 充電状態に応じた処理
    if (isCharging) {
      this.clearBatteryWarnings();
      this.restoreQuality();
    } else {
      // 放電開始時のチェック
      this.checkBatteryStatus();
    }

    this.updateBatteryUI(this.battery.level, isCharging);
  }

  /**
   * 放電時間変更時の処理
   */
  onDischargingTimeChange() {
    const timeLeft = this.battery.dischargingTime;
    console.log(`[VR Battery] Discharging time changed: ${timeLeft} seconds`);

    if (timeLeft !== Infinity && timeLeft < 1800) { // 30分未満
      this.showTimeWarning(timeLeft);
    }
  }

  /**
   * バッテリー残量に応じた品質調整
   */
  adjustQualityForBattery(level) {
    let qualityLevel;

    if (level > 0.5) {
      qualityLevel = 'high';
    } else if (level > 0.3) {
      qualityLevel = 'medium';
    } else if (level > 0.15) {
      qualityLevel = 'low';
    } else {
      qualityLevel = 'critical';
    }

    // WebXRレンダリング品質の調整
    if (window.WebXRManager) {
      window.WebXRManager.adjustQuality(this.qualityAdjustments[qualityLevel]);
    }

    // 通知
    this.notifyQualityAdjustment(qualityLevel, level);
  }

  /**
   * バッテリー警告の表示
   */
  showBatteryWarnings(level) {
    const levelPercent = Math.round(level * 100);

    if (levelPercent <= 20 && !this.warnings.has('low')) {
      this.showWarning('バッテリー残量が20%を下回りました。充電を推奨します。', 'low');
      this.warnings.add('low');
    }

    if (levelPercent <= 10 && !this.warnings.has('critical')) {
      this.showWarning('バッテリー残量が10%を下回りました。直ちに充電してください。', 'critical');
      this.warnings.add('critical');
    }

    if (levelPercent <= 5 && !this.warnings.has('emergency')) {
      this.showWarning('バッテリー残量が危険なレベルです。即座に充電してください。', 'emergency');
      this.warnings.add('emergency');
    }
  }

  /**
   * 残り時間警告の表示
   */
  showTimeWarning(timeLeft) {
    const minutes = Math.round(timeLeft / 60);
    if (minutes <= 30 && !this.warnings.has('time')) {
      this.showWarning(`バッテリー残量で約${minutes}分使用可能です。充電を検討してください。`, 'time');
      this.warnings.add('time');
    }
  }

  /**
   * 警告のクリア
   */
  clearBatteryWarnings() {
    this.warnings.clear();
    this.hideWarnings();
  }

  /**
   * 品質の復元
   */
  restoreQuality() {
    if (window.WebXRManager) {
      window.WebXRManager.adjustQuality(this.qualityAdjustments.high);
    }
    console.log('[VR Battery] Quality restored to high');
  }

  /**
   * バッテリー状態のチェック
   */
  checkBatteryStatus() {
    if (!this.battery) return;

    const level = this.battery.level;
    const isCharging = this.battery.charging;
    const timeLeft = this.battery.dischargingTime;

    console.log(`[VR Battery] Status check - Level: ${Math.round(level * 100)}%, Charging: ${isCharging}, Time left: ${timeLeft}s`);

    this.updateBatteryUI(level, isCharging);

    // 定期的な品質調整
    if (this.lastLevel !== level) {
      this.adjustQualityForBattery(level);
      this.lastLevel = level;
    }
  }

  /**
   * バッテリーUIの更新
   */
  updateBatteryUI(level, isCharging) {
    // バッテリーインジケーターの更新
    const batteryIndicator = document.getElementById('battery-indicator');
    if (batteryIndicator) {
      const levelPercent = Math.round(level * 100);
      batteryIndicator.textContent = `${levelPercent}%`;
      batteryIndicator.className = `battery-indicator ${this.getBatteryClass(level, isCharging)}`;

      // 充電アイコンの表示
      if (isCharging) {
        batteryIndicator.classList.add('charging');
      }
    }

    // バッテリー詳細情報の更新
    this.updateBatteryDetails(level, isCharging);
  }

  /**
   * バッテリー詳細情報の更新
   */
  updateBatteryDetails(level, isCharging) {
    const details = document.getElementById('battery-details');
    if (details) {
      const levelPercent = Math.round(level * 100);
      const timeLeft = this.battery ? this.battery.dischargingTime : null;

      let timeText = '';
      if (timeLeft && timeLeft !== Infinity && !isCharging) {
        const hours = Math.floor(timeLeft / 3600);
        const minutes = Math.floor((timeLeft % 3600) / 60);
        timeText = ` (${hours}時間${minutes}分)`;
      }

      details.innerHTML = `
        <div class="battery-level">残量: ${levelPercent}%${timeText}</div>
        <div class="battery-status">${isCharging ? '充電中' : '放電中'}</div>
      `;
    }
  }

  /**
   * バッテリー残量クラスを取得
   */
  getBatteryClass(level, isCharging) {
    if (isCharging) return 'charging';

    if (level > 0.5) return 'high';
    if (level > 0.3) return 'medium';
    if (level > 0.15) return 'low';
    return 'critical';
  }

  /**
   * 警告表示
   */
  showWarning(message, type) {
    // Toast通知を使用
    if (window.UIComponents && window.UIComponents.Toast) {
      const toast = new window.UIComponents.Toast();
      toast.show({
        type: type === 'emergency' ? 'error' : 'warning',
        title: 'バッテリー警告',
        message: message,
        duration: type === 'emergency' ? 0 : 10000 // 緊急時は永続
      });
    } else {
      // フォールバック: consoleとalert
      console.warn(`[VR Battery Warning] ${message}`);
      if (type === 'emergency') {
        alert(`緊急: ${message}`);
      }
    }
  }

  /**
   * 警告非表示
   */
  hideWarnings() {
    // 既存の警告を非表示にする処理
    console.log('[VR Battery] Warnings cleared');
  }

  /**
   * 品質調整の通知
   */
  notifyQualityAdjustment(qualityLevel, batteryLevel) {
    const levelPercent = Math.round(batteryLevel * 100);
    console.log(`[VR Battery] Quality adjusted to ${qualityLevel} (${levelPercent}% battery)`);

    // ユーザーに通知
    if (window.UIComponents && window.UIComponents.Toast) {
      const toast = new window.UIComponents.Toast();
      toast.show({
        type: 'info',
        title: '品質調整',
        message: `バッテリー残量${levelPercent}%のため、VR品質を${qualityLevel}に調整しました`,
        duration: 5000
      });
    }
  }

  /**
   * フォールバック監視（Battery API未対応時）
   */
  fallbackMonitoring() {
    // 定期的な疑似バッテリー監視
    setInterval(() => {
      // VR使用時間に基づく推定
      const estimatedLevel = this.estimateBatteryLevel();
      this.updateBatteryUI(estimatedLevel, false);

      if (estimatedLevel < 0.2) {
        this.showWarning('バッテリー残量が低下している可能性があります。充電を確認してください。', 'estimated');
      }
    }, 60000); // 1分ごと

    console.log('[VR Battery] Using fallback battery monitoring');
  }

  /**
   * バッテリー残量の推定
   */
  estimateBatteryLevel() {
    // 簡易的な推定ロジック
    const sessionStart = sessionStorage.getItem('vr_session_start');
    if (!sessionStart) {
      sessionStorage.setItem('vr_session_start', Date.now());
      return 0.8; // セッション開始時は80%と仮定
    }

    const sessionTime = (Date.now() - parseInt(sessionStart)) / 1000 / 3600; // 時間
    const estimatedDrain = sessionTime * 0.1; // 1時間あたり10%消費と仮定

    return Math.max(0.1, 0.8 - estimatedDrain); // 最低10%
  }

  /**
   * 監視状態の取得
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      batterySupported: !!this.battery,
      level: this.battery ? this.battery.level : null,
      charging: this.battery ? this.battery.charging : null,
      timeLeft: this.battery ? this.battery.dischargingTime : null,
      qualityLevel: this.getCurrentQualityLevel(),
      warnings: Array.from(this.warnings)
    };
  }

  /**
   * 現在の品質レベルを取得
   */
  getCurrentQualityLevel() {
    if (!this.battery) return 'unknown';

    const level = this.battery.level;
    if (level > 0.5) return 'high';
    if (level > 0.3) return 'medium';
    if (level > 0.15) return 'low';
    return 'critical';
  }
}

// グローバルインスタンス作成
const vrBatteryMonitor = new VRBatteryMonitor();

// グローバルアクセス用
window.vrBatteryMonitor = vrBatteryMonitor;

// 初期化完了通知
document.addEventListener('DOMContentLoaded', () => {
  console.log('[VR Battery] VR Battery Monitor initialized');
});
