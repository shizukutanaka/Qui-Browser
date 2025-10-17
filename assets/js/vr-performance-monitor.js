/**
 * Qui Browser VR Performance Monitor
 * VRデバイス専用パフォーマンス監視機能
 *
 * 機能:
 * - リアルタイムフレームレート監視
 * - GPUパフォーマンス測定
 * - メモリ使用量監視
 * - 自動品質調整推奨
 * - パフォーマンス警告の発行
 * - VRセッション最適化
 */

class VRPerformanceMonitor {
  constructor() {
    this.isMonitoring = false;
    this.frameCount = 0;
    this.lastTime = 0;
    this.fps = 0;
    this.frameTimes = [];
    this.maxFrameHistory = 60; // 1秒分のフレーム履歴
    this.performanceMetrics = {
      fps: 0,
      averageFps: 0,
      minFps: 0,
      maxFps: 0,
      frameTime: 0,
      jitter: 0,
      gpuMemory: 0,
      cpuUsage: 0
    };

    // パフォーマンスしきい値
    this.thresholds = {
      targetFps: 72, // VR推奨72fps以上
      warningFps: 60,
      criticalFps: 45,
      maxFrameTime: 13.89, // 72fps時の最大フレーム時間
      maxJitter: 5.0
    };

    // 品質調整推奨
    this.qualityRecommendations = {
      high: { fps: 90, quality: 1.0, resolution: 1.0 },
      medium: { fps: 72, quality: 0.8, resolution: 0.9 },
      low: { fps: 60, quality: 0.6, resolution: 0.8 },
      critical: { fps: 45, quality: 0.4, resolution: 0.7 }
    };

    this.init();
  }

  init() {
    // パフォーマンス監視の設定
    this.setupPerformanceMonitoring();

    // VRセッション監視
    this.setupVRSessionMonitoring();

    // メモリ監視
    this.setupMemoryMonitoring();

    console.log('[VR Performance] VR Performance Monitor initialized');
  }

  /**
   * パフォーマンス監視の設定
   */
  setupPerformanceMonitoring() {
    // requestAnimationFrameを使用したフレーム監視
    this.startFrameMonitoring();

    // パフォーマンスオブザーバーの設定
    this.setupPerformanceObserver();

    // GPU情報取得（可能であれば）
    this.detectGPUCapabilities();
  }

  /**
   * フレーム監視の開始
   */
  startFrameMonitoring() {
    const monitorFrame = (currentTime) => {
      if (this.lastTime > 0) {
        const deltaTime = currentTime - this.lastTime;
        const currentFps = 1000 / deltaTime;

        // フレーム時間を記録
        this.frameTimes.push(deltaTime);
        if (this.frameTimes.length > this.maxFrameHistory) {
          this.frameTimes.shift();
        }

        // FPS計算
        this.calculateFPS(currentFps);

        // パフォーマンスチェック
        this.checkPerformanceThresholds();
      }

      this.lastTime = currentTime;
      this.frameCount++;

      if (this.isMonitoring) {
        requestAnimationFrame(monitorFrame);
      }
    };

    this.isMonitoring = true;
    requestAnimationFrame(monitorFrame);
  }

  /**
   * FPS計算
   */
  calculateFPS(currentFps) {
    this.fps = Math.round(currentFps);

    // 平均FPS計算
    if (this.frameTimes.length > 0) {
      const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      this.performanceMetrics.averageFps = Math.round(1000 / avgFrameTime);
      this.performanceMetrics.frameTime = avgFrameTime;

      // ジッター計算（フレーム時間の変動）
      const variance = this.frameTimes.reduce((acc, time) => {
        return acc + Math.pow(time - avgFrameTime, 2);
      }, 0) / this.frameTimes.length;
      this.performanceMetrics.jitter = Math.sqrt(variance);
    }

    // 最小/最大FPS
    if (this.frameTimes.length > 0) {
      const fpsValues = this.frameTimes.map(time => 1000 / time);
      this.performanceMetrics.minFps = Math.min(...fpsValues);
      this.performanceMetrics.maxFps = Math.max(...fpsValues);
    }

    this.performanceMetrics.fps = this.fps;
  }

  /**
   * パフォーマンスしきい値チェック
   */
  checkPerformanceThresholds() {
    const currentFps = this.performanceMetrics.fps;
    const jitter = this.performanceMetrics.jitter;

    // FPS警告
    if (currentFps < this.thresholds.criticalFps) {
      this.issuePerformanceWarning('critical', `FPSが極端に低下しています: ${currentFps}fps`);
      this.recommendQualityAdjustment('critical');
    } else if (currentFps < this.thresholds.warningFps) {
      this.issuePerformanceWarning('warning', `FPSが低下しています: ${currentFps}fps`);
      this.recommendQualityAdjustment('low');
    } else if (currentFps >= this.thresholds.targetFps) {
      // 良好なパフォーマンス
      this.clearPerformanceWarnings();
    }

    // ジッター警告
    if (jitter > this.thresholds.maxJitter) {
      this.issuePerformanceWarning('warning', `フレームレートの変動が大きいです: ${jitter.toFixed(1)}ms`);
    }
  }

  /**
   * パフォーマンスオブザーバーの設定
   */
  setupPerformanceObserver() {
    if ('PerformanceObserver' in window) {
      try {
        // レイアウトシフト監視
        const layoutShiftObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.value > 0.1) { // 顕著なレイアウトシフト
              this.issuePerformanceWarning('warning', `レイアウトシフト検出: ${entry.value.toFixed(3)}`);
            }
          }
        });
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });

        // 長いタスク監視
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) { // 50ms以上の長いタスク
              this.issuePerformanceWarning('warning', `長いタスク検出: ${entry.duration.toFixed(1)}ms`);
            }
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });

      } catch (error) {
        console.warn('[VR Performance] Performance Observer setup failed:', error);
      }
    }
  }

  /**
   * GPU能力検出
   */
  async detectGPUCapabilities() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);

          console.log(`[VR Performance] GPU: ${vendor} ${renderer}`);

          // GPU情報を保存
          this.gpuInfo = {
            vendor: vendor,
            renderer: renderer,
            isVRReady: this.isVRReadyGPU(renderer)
          };
        }

        // WebGL拡張機能チェック
        this.checkWebGLExtensions(gl);
      }
    } catch (error) {
      console.warn('[VR Performance] GPU detection failed:', error);
    }
  }

  /**
   * VR対応GPUチェック
   */
  isVRReadyGPU(renderer) {
    const vrReadyGPUs = [
      'nvidia', 'geforce', 'rtx', 'gtx', 'quadro',
      'amd', 'radeon', 'rx', 'vega',
      'intel', 'iris', 'uhd'
    ];

    const lowerRenderer = renderer.toLowerCase();
    return vrReadyGPUs.some(gpu => lowerRenderer.includes(gpu));
  }

  /**
   * WebGL拡張機能チェック
   */
  checkWebGLExtensions(gl) {
    const requiredExtensions = [
      'OES_texture_float',
      'OES_standard_derivatives',
      'EXT_shader_texture_lod'
    ];

    const supportedExtensions = gl.getSupportedExtensions() || [];
    const missingExtensions = requiredExtensions.filter(ext =>
      !supportedExtensions.includes(ext)
    );

    if (missingExtensions.length > 0) {
      console.warn('[VR Performance] Missing WebGL extensions:', missingExtensions);
      this.issuePerformanceWarning('warning', `一部のWebGL拡張が利用できません: ${missingExtensions.join(', ')}`);
    }
  }

  /**
   * VRセッション監視の設定
   */
  setupVRSessionMonitoring() {
    // WebXRマネージャーの監視
    if (window.WebXRManager) {
      window.WebXRManager.addEventListener('sessionstart', () => {
        console.log('[VR Performance] VR session started - monitoring intensified');
        this.onVRSessionStart();
      });

      window.WebXRManager.addEventListener('sessionend', () => {
        console.log('[VR Performance] VR session ended');
        this.onVRSessionEnd();
      });
    }
  }

  /**
   * VRセッション開始時の処理
   */
  onVRSessionStart() {
    // VRセッション中の高頻度監視
    this.vrSessionActive = true;
    this.resetPerformanceMetrics();

    // 初期パフォーマンスチェック
    setTimeout(() => {
      this.performInitialVRCheck();
    }, 1000);
  }

  /**
   * VRセッション終了時の処理
   */
  onVRSessionEnd() {
    this.vrSessionActive = false;

    // 最終パフォーマンスレポート
    this.generatePerformanceReport();
  }

  /**
   * メモリ監視の設定
   */
  setupMemoryMonitoring() {
    if ('memory' in performance) {
      setInterval(() => {
        const memoryInfo = performance.memory;
        const usedPercent = (memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize) * 100;

        // メモリ使用率が80%を超えた場合
        if (usedPercent > 80) {
          this.issuePerformanceWarning('warning', `メモリ使用率が高いです: ${usedPercent.toFixed(1)}%`);
          this.recommendMemoryOptimization();
        }

        this.performanceMetrics.memoryUsage = usedPercent;
      }, 10000); // 10秒ごと
    }
  }

  /**
   * 初期VRパフォーマンスチェック
   */
  performInitialVRCheck() {
    const initialFps = this.performanceMetrics.averageFps;

    if (initialFps < this.thresholds.targetFps) {
      this.issuePerformanceWarning('info',
        `VRセッション開始時のFPS: ${initialFps}fps (推奨: ${this.thresholds.targetFps}fps以上)`
      );
    } else {
      console.log(`[VR Performance] Initial VR performance good: ${initialFps}fps`);
    }
  }

  /**
   * パフォーマンス警告の発行
   */
  issuePerformanceWarning(level, message) {
    // 重複警告を防ぐ
    const warningKey = `${level}:${message}`;
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
      const toastLevel = level === 'critical' ? 'error' : level === 'warning' ? 'warning' : 'info';

      toast.show({
        type: toastLevel,
        title: 'パフォーマンス警告',
        message: message,
        duration: level === 'critical' ? 0 : 8000
      });
    }

    console.warn(`[VR Performance ${level.toUpperCase()}] ${message}`);

    // 警告の自動クリア（5分後）
    setTimeout(() => {
      this.activeWarnings.delete(warningKey);
    }, 300000);
  }

  /**
   * パフォーマンス警告のクリア
   */
  clearPerformanceWarnings() {
    if (this.activeWarnings) {
      this.activeWarnings.clear();
    }
  }

  /**
   * 品質調整の推奨
   */
  recommendQualityAdjustment(level) {
    const recommendation = this.qualityRecommendations[level];

    if (window.WebXRManager && window.WebXRManager.adjustQuality) {
      window.WebXRManager.adjustQuality(recommendation);
      console.log(`[VR Performance] Quality adjusted to ${level} level`);
    }
  }

  /**
   * メモリ最適化の推奨
   */
  recommendMemoryOptimization() {
    // コンテンツプリローダーにメモリ最適化を指示
    if (window.vrContentPreloader) {
      window.vrContentPreloader.cleanupOldContent();
      console.log('[VR Performance] Memory optimization triggered');
    }
  }

  /**
   * パフォーマンスメトリクスのリセット
   */
  resetPerformanceMetrics() {
    this.frameTimes.length = 0;
    this.frameCount = 0;
    this.lastTime = 0;
    this.clearPerformanceWarnings();
  }

  /**
   * パフォーマンスレポートの生成
   */
  generatePerformanceReport() {
    const report = {
      sessionDuration: Date.now() - this.sessionStartTime,
      averageFps: this.performanceMetrics.averageFps,
      minFps: this.performanceMetrics.minFps,
      maxFps: this.performanceMetrics.maxFps,
      averageFrameTime: this.performanceMetrics.frameTime,
      averageJitter: this.performanceMetrics.jitter,
      totalFrames: this.frameCount,
      gpuInfo: this.gpuInfo,
      warningsCount: this.activeWarnings?.size || 0
    };

    console.log('[VR Performance] Session performance report:', report);

    // レポートの保存（オプション）
    this.savePerformanceReport(report);

    return report;
  }

  /**
   * パフォーマンスレポートの保存
   */
  savePerformanceReport(report) {
    try {
      const reports = JSON.parse(localStorage.getItem('vr_performance_reports') || '[]');
      reports.push({
        timestamp: Date.now(),
        ...report
      });

      // 最新10件のみ保存
      if (reports.length > 10) {
        reports.shift();
      }

      localStorage.setItem('vr_performance_reports', JSON.stringify(reports));
    } catch (error) {
      console.warn('[VR Performance] Failed to save performance report:', error);
    }
  }

  /**
   * パフォーマンス統計の取得
   */
  getStats() {
    return {
      ...this.performanceMetrics,
      isMonitoring: this.isMonitoring,
      vrSessionActive: this.vrSessionActive,
      gpuInfo: this.gpuInfo,
      activeWarnings: this.activeWarnings ? Array.from(this.activeWarnings) : [],
      thresholds: this.thresholds
    };
  }

  /**
   * パフォーマンスレポート履歴の取得
   */
  getPerformanceHistory() {
    try {
      return JSON.parse(localStorage.getItem('vr_performance_reports') || '[]');
    } catch (error) {
      console.warn('[VR Performance] Failed to load performance history:', error);
      return [];
    }
  }

  /**
   * 監視の一時停止/再開
   */
  pauseMonitoring() {
    this.isMonitoring = false;
  }

  resumeMonitoring() {
    if (!this.isMonitoring) {
      this.isMonitoring = true;
      this.lastTime = 0;
      this.startFrameMonitoring();
    }
  }

  /**
   * 監視の停止
   */
  stopMonitoring() {
    this.isMonitoring = false;
    this.clearPerformanceWarnings();
  }
}

// グローバルインスタンス作成
const vrPerformanceMonitor = new VRPerformanceMonitor();

// グローバルアクセス用
window.vrPerformanceMonitor = vrPerformanceMonitor;

// 初期化完了通知
document.addEventListener('DOMContentLoaded', () => {
  console.log('[VR Performance] VR Performance Monitor initialized');
});
