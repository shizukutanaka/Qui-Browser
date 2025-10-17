/**
 * Qui Browser Mobile PWA Enhancements
 * モバイルPWA機能の強化とユーザー体験の向上
 *
 * 機能:
 * - PWAインストールプロンプト
 * - プッシュ通知管理
 * - バックグラウンド同期
 * - ネットワーク状態監視
 * - モバイルジェスチャー対応
 * - オフライン検知
 */

class MobilePWAManager {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.networkStatus = 'online';
    this.installPromptShown = false;

    this.init();
  }

  init() {
    this.setupInstallPrompt();
    this.setupNetworkMonitoring();
    this.setupPushNotifications();
    this.setupBackgroundSync();
    this.setupGestureSupport();
    this.setupOfflineDetection();
    this.updateViewportMeta();
  }

  // PWAインストールプロンプト
  setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;

      // インストール可能状態になったことを通知
      this.showInstallPrompt();

      // 自動インストールの条件チェック
      setTimeout(() => {
        if (!this.installPromptShown && this.shouldAutoPrompt()) {
          this.showInstallPrompt();
        }
      }, 30000); // 30秒後に自動表示
    });

    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.hideInstallPrompt();
      this.trackEvent('pwa_installed');

      // インストール完了通知
      this.showNotification('Qui Browserがインストールされました！', {
        body: 'ホーム画面から簡単にアクセスできます',
        icon: '/assets/icons/icon-192.png'
      });
    });
  }

  shouldAutoPrompt() {
    // 自動プロンプト表示の条件
    const visitCount = parseInt(localStorage.getItem('visit_count') || '0');
    const lastPrompt = parseInt(localStorage.getItem('last_install_prompt') || '0');
    const now = Date.now();

    return visitCount >= 3 && (now - lastPrompt) > (7 * 24 * 60 * 60 * 1000); // 7日以上経過
  }

  showInstallPrompt() {
    if (this.installPromptShown || this.isInstalled) return;

    const prompt = document.createElement('div');
    prompt.className = 'install-prompt';
    prompt.innerHTML = `
      <div class="install-prompt-content">
        <img src="/assets/icons/icon-192.png" alt="Qui Browser" width="48" height="48">
        <div class="install-prompt-text">
          <h3 class="install-prompt-title">Qui Browserをインストール</h3>
          <p class="install-prompt-description">ホーム画面に追加して、より快適にブラウジングしましょう</p>
        </div>
        <div class="btn-group">
          <button class="btn btn-secondary btn-sm" onclick="mobilePWA.hideInstallPrompt()">後で</button>
          <button class="btn btn-primary btn-sm" onclick="mobilePWA.installPWA()">インストール</button>
        </div>
      </div>
    `;

    document.body.appendChild(prompt);
    this.installPromptShown = true;
    localStorage.setItem('last_install_prompt', Date.now().toString());

    // アニメーションで表示
    setTimeout(() => prompt.classList.add('visible'), 100);
  }

  hideInstallPrompt() {
    const prompt = document.querySelector('.install-prompt');
    if (prompt) {
      prompt.classList.remove('visible');
      setTimeout(() => prompt.remove(), 300);
    }
    this.installPromptShown = false;
  }

  async installPWA() {
    if (!this.deferredPrompt) return;

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;

    this.trackEvent('pwa_install_attempt', { outcome });
    this.deferredPrompt = null;
    this.hideInstallPrompt();
  }

  // ネットワーク状態監視
  setupNetworkMonitoring() {
    window.addEventListener('online', () => {
      this.networkStatus = 'online';
      this.handleNetworkChange(true);
    });

    window.addEventListener('offline', () => {
      this.networkStatus = 'offline';
      this.handleNetworkChange(false);
    });

    // 接続品質監視
    if ('connection' in navigator) {
      const connection = navigator.connection;
      connection.addEventListener('change', () => {
        this.handleConnectionChange(connection);
      });
    }
  }

  handleNetworkChange(isOnline) {
    const statusElement = document.querySelector('.network-status');
    if (statusElement) {
      statusElement.textContent = isOnline ? 'オンライン' : 'オフライン';
      statusElement.className = `network-status ${isOnline ? 'online' : 'offline'}`;
    }

    if (isOnline) {
      // オンライン復帰時の処理
      this.syncPendingData();
      this.showNotification('ネットワーク接続が復帰しました', {
        body: 'データを同期しています...',
        icon: '/assets/icons/icon-192.png'
      });
    } else {
      // オフライン時の処理
      this.enableOfflineMode();
    }
  }

  handleConnectionChange(connection) {
    const quality = this.getConnectionQuality(connection);
    document.documentElement.setAttribute('data-connection', quality);

    // 接続品質に応じた最適化
    this.optimizeForConnection(quality);
  }

  getConnectionQuality(connection) {
    if (!connection) return 'unknown';

    const downlink = connection.downlink;
    if (downlink >= 10) return 'fast';
    if (downlink >= 5) return 'good';
    if (downlink >= 2) return 'slow';
    return 'very-slow';
  }

  optimizeForConnection(quality) {
    const body = document.body;

    // 接続品質に応じたクラス適用
    body.className = body.className.replace(/connection-\w+/g, '');
    body.classList.add(`connection-${quality}`);

    // 低品質接続時の最適化
    if (quality === 'slow' || quality === 'very-slow') {
      this.enableLowBandwidthMode();
    } else {
      this.disableLowBandwidthMode();
    }
  }

  enableLowBandwidthMode() {
    // 画像の遅延読み込み強化
    const images = document.querySelectorAll('img[data-src]');
    images.forEach(img => {
      if (!img.src) {
        img.src = img.dataset.src;
      }
    });

    // アニメーション軽減
    document.documentElement.style.setProperty('--transition-duration-fast', '0.1s');
  }

  disableLowBandwidthMode() {
    document.documentElement.style.removeProperty('--transition-duration-fast');
  }

  // プッシュ通知管理
  setupPushNotifications() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        this.checkNotificationPermission();
      });
    }
  }

  async checkNotificationPermission() {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      this.registerPushSubscription();
    }
  }

  async registerPushSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      // サーバーにサブスクリプションを送信
      await this.sendSubscriptionToServer(subscription);
    } catch (error) {
      console.error('Push subscription failed:', error);
    }
  }

  async sendSubscriptionToServer(subscription) {
    // 実際のサーバーAPIに送信
    const response = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription })
    });

    if (!response.ok) {
      throw new Error('Subscription registration failed');
    }
  }

  // バックグラウンド同期
  setupBackgroundSync() {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then(registration => {
        // データ同期の登録
        if ('sync' in registration) {
          registration.sync.register('data-sync');
        }
      });
    }
  }

  async syncPendingData() {
    const pendingData = this.getPendingData();
    if (pendingData.length === 0) return;

    try {
      for (const data of pendingData) {
        await this.sendDataToServer(data);
      }
      this.clearPendingData();
    } catch (error) {
      console.error('Data sync failed:', error);
    }
  }

  getPendingData() {
    return JSON.parse(localStorage.getItem('pending_data') || '[]');
  }

  addPendingData(data) {
    const pending = this.getPendingData();
    pending.push({ ...data, timestamp: Date.now() });
    localStorage.setItem('pending_data', JSON.stringify(pending));
  }

  clearPendingData() {
    localStorage.removeItem('pending_data');
  }

  async sendDataToServer(data) {
    // 実際のAPIエンドポイントに送信
    const response = await fetch(data.endpoint, {
      method: data.method || 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data.payload)
    });

    if (!response.ok) {
      throw new Error(`Data send failed: ${response.status}`);
    }
  }

  // ジェスチャー対応
  setupGestureSupport() {
    this.setupSwipeGestures();
    this.setupPullToRefresh();
    this.setupPinchZoom();
  }

  setupSwipeGestures() {
    let startX = 0;
    let startY = 0;

    document.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      if (!startX || !startY) return;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const diffX = startX - endX;
      const diffY = startY - endY;

      const minSwipeDistance = 50;

      if (Math.abs(diffX) > Math.abs(diffY)) {
        // 水平スワイプ
        if (Math.abs(diffX) > minSwipeDistance) {
          if (diffX > 0) {
            this.handleSwipeLeft();
          } else {
            this.handleSwipeRight();
          }
        }
      } else {
        // 垂直スワイプ
        if (Math.abs(diffY) > minSwipeDistance) {
          if (diffY > 0) {
            this.handleSwipeUp();
          } else {
            this.handleSwipeDown();
          }
        }
      }

      startX = 0;
      startY = 0;
    }, { passive: true });
  }

  setupPullToRefresh() {
    let startY = 0;
    let isPulling = false;

    document.addEventListener('touchstart', (e) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
      }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!startY || window.scrollY > 0) return;

      const currentY = e.touches[0].clientY;
      const pullDistance = currentY - startY;

      if (pullDistance > 50) {
        isPulling = true;
        this.showPullIndicator(pullDistance);
      }
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (isPulling && startY) {
        const pullDistance = window.scrollY - startY;
        if (pullDistance > 100) {
          this.handlePullToRefresh();
        }
      }
      this.hidePullIndicator();
      startY = 0;
      isPulling = false;
    });
  }

  setupPinchZoom() {
    let initialDistance = 0;

    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        initialDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
      }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && initialDistance > 0) {
        const currentDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
        const scale = currentDistance / initialDistance;

        if (scale > 1.2) {
          this.handlePinchZoomIn();
        } else if (scale < 0.8) {
          this.handlePinchZoomOut();
        }
      }
    }, { passive: true });

    document.addEventListener('touchend', () => {
      initialDistance = 0;
    });
  }

  getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ジェスチャーハンドラー
  handleSwipeLeft() {
    // 次のタブへ
    this.dispatchEvent('swipe-left');
  }

  handleSwipeRight() {
    // 前のタブへ
    this.dispatchEvent('swipe-right');
  }

  handleSwipeUp() {
    // メニュー非表示
    this.dispatchEvent('swipe-up');
  }

  handleSwipeDown() {
    // メニュー表示
    this.dispatchEvent('swipe-down');
  }

  handlePullToRefresh() {
    window.location.reload();
  }

  handlePinchZoomIn() {
    this.dispatchEvent('pinch-zoom-in');
  }

  handlePinchZoomOut() {
    this.dispatchEvent('pinch-zoom-out');
  }

  showPullIndicator(distance) {
    let indicator = document.querySelector('.pull-to-refresh-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'pull-to-refresh-indicator';
      indicator.innerHTML = '<i class="icon-refresh"></i> 引っ張って更新';
      document.body.appendChild(indicator);
    }

    const progress = Math.min(distance / 100, 1);
    indicator.style.transform = `translateX(-50%) translateY(${20 + progress * 30}px)`;
    indicator.style.opacity = progress;
  }

  hidePullIndicator() {
    const indicator = document.querySelector('.pull-to-refresh-indicator');
    if (indicator) {
      indicator.style.opacity = '0';
      setTimeout(() => indicator.remove(), 300);
    }
  }

  // オフライン検知
  setupOfflineDetection() {
    window.addEventListener('load', () => {
      if (!navigator.onLine) {
        this.enableOfflineMode();
      }
    });
  }

  enableOfflineMode() {
    document.documentElement.classList.add('offline');
    this.showOfflineIndicator();

    // オフラインページの表示
    const offlineContent = `
      <div class="offline-banner">
        <h2>オフラインモード</h2>
        <p>インターネット接続がありません。一部の機能が制限されます。</p>
        <button onclick="mobilePWA.retryConnection()" class="btn btn-primary">再接続</button>
      </div>
    `;

    const banner = document.createElement('div');
    banner.innerHTML = offlineContent;
    banner.className = 'offline-banner-container';
    document.body.insertBefore(banner, document.body.firstChild);
  }

  disableOfflineMode() {
    document.documentElement.classList.remove('offline');
    this.hideOfflineIndicator();

    const banner = document.querySelector('.offline-banner-container');
    if (banner) {
      banner.remove();
    }
  }

  showOfflineIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'offline-indicator';
    indicator.innerHTML = '<i class="icon-offline"></i> オフライン';
    document.body.appendChild(indicator);
  }

  hideOfflineIndicator() {
    const indicator = document.querySelector('.offline-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  retryConnection() {
    if (navigator.onLine) {
      this.disableOfflineMode();
      window.location.reload();
    } else {
      this.showNotification('まだオフラインです', {
        body: 'インターネット接続を確認してください'
      });
    }
  }

  // ビューポート最適化
  updateViewportMeta() {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      // モバイルデバイスに最適化
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        viewport.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no';
      }
    }
  }

  // 通知表示
  showNotification(title, options = {}) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/assets/icons/icon-192.png',
        badge: '/assets/icons/icon-96.png',
        ...options
      });
    }
  }

  // イベントディスパッチ
  dispatchEvent(eventName, detail = {}) {
    const event = new CustomEvent(`mobile-pwa:${eventName}`, { detail });
    document.dispatchEvent(event);
  }

  // 分析イベント追跡
  trackEvent(eventName, properties = {}) {
    // 実際の分析サービスに送信
    console.log('Track event:', eventName, properties);

    // localStorageに保存（オフライン対応）
    const events = JSON.parse(localStorage.getItem('tracked_events') || '[]');
    events.push({
      event: eventName,
      properties,
      timestamp: Date.now()
    });
    localStorage.setItem('tracked_events', JSON.stringify(events.slice(-100))); // 最新100件保持
  }

  // 訪問カウント
  incrementVisitCount() {
    const count = parseInt(localStorage.getItem('visit_count') || '0') + 1;
    localStorage.setItem('visit_count', count.toString());
    return count;
  }
}

// VAPID公開キー（実際の環境では設定ファイルから読み込み）
const VAPID_PUBLIC_KEY = 'BKxQG8nT6Q2n6HH9kqFZ6j3q3q3q3q3q3q3q3q3q3q3q3q3q3q3q3q3q3q3q3q3q3q3q3q3q3q3q3q3q3q3q3q3';

// グローバルインスタンス作成
const mobilePWA = new MobilePWAManager();

// グローバルアクセス用
window.mobilePWA = mobilePWA;

// 初期化完了を通知
document.addEventListener('DOMContentLoaded', () => {
  mobilePWA.incrementVisitCount();
  mobilePWA.dispatchEvent('initialized');
});
