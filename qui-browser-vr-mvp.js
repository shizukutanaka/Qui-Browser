/**
 * Qui Browser VR MVP
 * Chrome拡張互換性を保つVRデバイス用ブラウザ - 最小実装
 *
 * MVP機能:
 * - WebXR統合: 基本VR体験
 * - パフォーマンス監視: 安定動作確保
 * - アクセシビリティ: 基本支援機能
 * - ネットワーク適応: 接続品質調整
 */

class QuiBrowserVR {
  constructor() {
    this.isInitialized = false;
    this.vrSession = null;
    this.performanceMonitor = null;
    this.accessibilitySystem = null;
    this.networkMonitor = null;

    this.init();
  }

  async init() {
    try {
      // WebXR対応チェック
      if (!navigator.xr) {
        console.warn('WebXR not supported');
        return;
      }

      // VRデバイス検出
      const devices = await navigator.xr.enumerateDevices();
      if (devices.length === 0) {
        console.warn('No VR devices found');
        return;
      }

      // 各モジュールの初期化
      this.initializePerformanceMonitor();
      this.initializeAccessibilitySystem();
      this.initializeNetworkMonitor();

      this.isInitialized = true;
      this.dispatchEvent('initialized', { devices: devices.length });

    } catch (error) {
      console.error('Qui Browser VR initialization failed:', error);
    }
  }

  // WebXRセッション開始
  async startVRSession() {
    if (!this.isInitialized) return false;

    try {
      const session = await navigator.xr.requestSession('immersive-vr');
      this.vrSession = session;

      // セッションイベントハンドリング
      session.addEventListener('end', () => {
        this.vrSession = null;
        this.dispatchEvent('sessionEnded');
      });

      this.dispatchEvent('sessionStarted', { session });
      return true;

    } catch (error) {
      console.error('VR session start failed:', error);
      return false;
    }
  }

  // WebXRセッション終了
  endVRSession() {
    if (this.vrSession) {
      this.vrSession.end();
    }
  }

  // パフォーマンス監視モジュール初期化
  initializePerformanceMonitor() {
    this.performanceMonitor = {
      frameCount: 0,
      lastTime: performance.now(),
      fps: 0,

      update: () => {
        const now = performance.now();
        this.performanceMonitor.frameCount++;

        if (now - this.performanceMonitor.lastTime >= 1000) {
          this.performanceMonitor.fps = Math.round(
            (this.performanceMonitor.frameCount * 1000) / (now - this.performanceMonitor.lastTime)
          );
          this.performanceMonitor.frameCount = 0;
          this.performanceMonitor.lastTime = now;

          // FPSが低下したら通知
          if (this.performanceMonitor.fps < 60) {
            this.dispatchEvent('performanceWarning', { fps: this.performanceMonitor.fps });
          }
        }
      }
    };
  }

  // アクセシビリティシステム初期化
  initializeAccessibilitySystem() {
    this.accessibilitySystem = {
      speechSynthesis: window.speechSynthesis,
      audioContext: null,

      initAudio: async () => {
        try {
          this.accessibilitySystem.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
          console.warn('Audio context not available');
        }
      },

      speak: (text) => {
        if (this.accessibilitySystem.speechSynthesis) {
          const utterance = new SpeechSynthesisUtterance(text);
          this.accessibilitySystem.speechSynthesis.speak(utterance);
        }
      },

      playBeep: (frequency = 800, duration = 200) => {
        if (!this.accessibilitySystem.audioContext) return;

        const oscillator = this.accessibilitySystem.audioContext.createOscillator();
        const gainNode = this.accessibilitySystem.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.accessibilitySystem.audioContext.destination);

        oscillator.frequency.setValueAtTime(frequency, this.accessibilitySystem.audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, this.accessibilitySystem.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.accessibilitySystem.audioContext.currentTime + duration / 1000);

        oscillator.start();
        oscillator.stop(this.accessibilitySystem.audioContext.currentTime + duration / 1000);
      }
    };

    this.accessibilitySystem.initAudio();
  }

  // ネットワーク監視モジュール初期化
  initializeNetworkMonitor() {
    this.networkMonitor = {
      connection: navigator.connection || navigator.mozConnection || navigator.webkitConnection,
      lastCheck: Date.now(),
      quality: 'unknown',

      checkConnection: () => {
        const now = Date.now();
        if (now - this.networkMonitor.lastCheck < 5000) return; // 5秒間隔

        this.networkMonitor.lastCheck = now;

        let quality = 'good';
        if (this.networkMonitor.connection) {
          const downlink = this.networkMonitor.connection.downlink;
          const effectiveType = this.networkMonitor.connection.effectiveType;

          if (effectiveType === 'slow-2g' || effectiveType === '2g' || downlink < 1) {
            quality = 'poor';
          } else if (effectiveType === '3g' || downlink < 5) {
            quality = 'fair';
          }
        }

        if (this.networkMonitor.quality !== quality) {
          this.networkMonitor.quality = quality;
          this.dispatchEvent('networkQualityChanged', { quality });
        }
      }
    };

    // 定期的な接続チェック
    setInterval(() => {
      this.networkMonitor.checkConnection();
    }, 1000);
  }

  // VRモード切り替え
  toggleVR() {
    if (this.vrSession) {
      this.endVRSession();
    } else {
      this.startVRSession();
    }
  }

  // イベントディスパッチ
  dispatchEvent(eventName, data = {}) {
    const event = new CustomEvent(`qui-vr-${eventName}`, { detail: data });
    window.dispatchEvent(event);
  }

  // クリーンアップ
  destroy() {
    this.endVRSession();
    this.isInitialized = false;
  }
}

// グローバルインスタンス作成
window.quiBrowserVR = new QuiBrowserVR();

// VRモード切り替え用のグローバル関数
window.toggleVR = () => {
  if (window.quiBrowserVR) {
    window.quiBrowserVR.toggleVR();
  }
};

// DOM準備完了時の初期化
document.addEventListener('DOMContentLoaded', () => {
  // VRボタンの追加（オプション）
  const vrButton = document.createElement('button');
  vrButton.textContent = 'VR';
  vrButton.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 10000;
    padding: 8px 16px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  `;

  vrButton.addEventListener('click', window.toggleVR);
  document.body.appendChild(vrButton);

  // VRイベントリスナー
  window.addEventListener('qui-vr-initialized', (event) => {
    console.log('Qui Browser VR initialized with', event.detail.devices, 'devices');
  });

  window.addEventListener('qui-vr-sessionStarted', () => {
    vrButton.textContent = 'Exit VR';
  });

  window.addEventListener('qui-vr-sessionEnded', () => {
    vrButton.textContent = 'VR';
  });

  window.addEventListener('qui-vr-performanceWarning', (event) => {
    console.warn('Performance warning: FPS dropped to', event.detail.fps);
  });

  window.addEventListener('qui-vr-networkQualityChanged', (event) => {
    console.log('Network quality:', event.detail.quality);
  });
});
