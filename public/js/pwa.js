/**
 * Qui Browser PWA Support
 *
 * Handles PWA installation, service worker registration, and offline functionality
 */

class QuiPWA {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.isOnline = navigator.onLine;
    this.registration = null;

    this.init();
  }

  async init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });

        console.log('Service Worker registered:', this.registration);

        // Handle updates
        this.registration.addEventListener('updatefound', () => {
          const newWorker = this.registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.showUpdateNotification();
            }
          });
        });

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          this.handleServiceWorkerMessage(event);
        });

      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }

    // Handle install prompt
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt = event;
      this.showInstallPrompt();
    });

    // Handle app installed
    window.addEventListener('appinstalled', (event) => {
      console.log('PWA was installed');
      this.isInstalled = true;
      this.deferredPrompt = null;
      this.hideInstallPrompt();

      // Track installation
      this.trackEvent('pwa_installed');
    });

    // Handle online/offline status
    window.addEventListener('online', () => {
      this.handleOnlineStatus(true);
    });

    window.addEventListener('offline', () => {
      this.handleOnlineStatus(false);
    });

    // Check if already installed
    this.checkInstallStatus();

    // Set up periodic sync if supported
    this.setupBackgroundSync();

    // Set up push notifications if supported
    this.setupPushNotifications();
  }

  /**
   * Check if PWA is already installed
   */
  checkInstallStatus() {
    // Check for standalone mode (installed PWA)
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) {
      this.isInstalled = true;
    }

    // Check for iOS Safari
    if (window.navigator.standalone !== undefined) {
      this.isInstalled = window.navigator.standalone;
    }
  }

  /**
   * Show install prompt
   */
  showInstallPrompt() {
    if (!this.deferredPrompt || this.isInstalled) return;

    // Create install banner
    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML = `
      <div class="pwa-banner-content">
        <div class="pwa-banner-text">
          <strong>Install Qui Browser</strong>
          <p>Get the full app experience with offline access and more features.</p>
        </div>
        <div class="pwa-banner-actions">
          <button id="pwa-install-btn" class="pwa-btn-primary">Install</button>
          <button id="pwa-dismiss-btn" class="pwa-btn-secondary">Not now</button>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #pwa-install-banner {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: white;
        border-top: 1px solid #e5e7eb;
        box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        padding: 1rem;
      }
      .pwa-banner-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        max-width: 1200px;
        margin: 0 auto;
      }
      .pwa-banner-text strong {
        display: block;
        color: #111827;
        font-size: 1.1rem;
      }
      .pwa-banner-text p {
        margin: 0.25rem 0 0 0;
        color: #6b7280;
        font-size: 0.9rem;
      }
      .pwa-banner-actions {
        display: flex;
        gap: 0.75rem;
        margin-left: 1rem;
      }
      .pwa-btn-primary {
        background: #2563eb;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        font-weight: 500;
        cursor: pointer;
      }
      .pwa-btn-primary:hover {
        background: #1d4ed8;
      }
      .pwa-btn-secondary {
        background: transparent;
        color: #6b7280;
        border: 1px solid #d1d5db;
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        cursor: pointer;
      }
      .pwa-btn-secondary:hover {
        background: #f9fafb;
      }
      @media (max-width: 640px) {
        .pwa-banner-content {
          flex-direction: column;
          gap: 1rem;
        }
        .pwa-banner-actions {
          margin-left: 0;
          width: 100%;
          justify-content: flex-end;
        }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(banner);

    // Handle install button
    document.getElementById('pwa-install-btn').addEventListener('click', () => {
      this.installPWA();
    });

    // Handle dismiss button
    document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
      this.hideInstallPrompt();
      // Remember dismissal for 7 days
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    });
  }

  /**
   * Hide install prompt
   */
  hideInstallPrompt() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) {
      banner.remove();
    }
  }

  /**
   * Install PWA
   */
  async installPWA() {
    if (!this.deferredPrompt) return;

    this.deferredPrompt.prompt();

    const { outcome } = await this.deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted PWA installation');
      this.trackEvent('pwa_install_accepted');
    } else {
      console.log('User dismissed PWA installation');
      this.trackEvent('pwa_install_dismissed');
    }

    this.deferredPrompt = null;
    this.hideInstallPrompt();
  }

  /**
   * Show update notification
   */
  showUpdateNotification() {
    const notification = document.createElement('div');
    notification.id = 'pwa-update-notification';
    notification.innerHTML = `
      <div class="pwa-update-content">
        <div class="pwa-update-text">
          <strong>Update Available</strong>
          <p>A new version of Qui Browser is available.</p>
        </div>
        <div class="pwa-update-actions">
          <button id="pwa-update-btn" class="pwa-btn-primary">Update</button>
          <button id="pwa-update-dismiss-btn" class="pwa-btn-secondary">Later</button>
        </div>
      </div>
    `;

    // Add styles (similar to install banner)
    const style = document.createElement('style');
    style.textContent = `
      #pwa-update-notification {
        position: fixed;
        top: 1rem;
        right: 1rem;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 1001;
        max-width: 400px;
      }
      .pwa-update-content {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
      }
      .pwa-update-text strong {
        display: block;
        color: #111827;
        font-size: 1rem;
      }
      .pwa-update-text p {
        margin: 0.25rem 0 0 0;
        color: #6b7280;
        font-size: 0.9rem;
      }
      .pwa-update-actions {
        display: flex;
        gap: 0.5rem;
      }
      @media (max-width: 480px) {
        #pwa-update-notification {
          left: 1rem;
          right: 1rem;
          top: 1rem;
        }
        .pwa-update-content {
          flex-direction: column;
          gap: 0.75rem;
        }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(notification);

    // Handle update button
    document.getElementById('pwa-update-btn').addEventListener('click', () => {
      this.updatePWA();
    });

    // Handle dismiss button
    document.getElementById('pwa-update-dismiss-btn').addEventListener('click', () => {
      notification.remove();
    });
  }

  /**
   * Update PWA
   */
  async updatePWA() {
    if (!this.registration) return;

    // Skip waiting and reload
    const newWorker = this.registration.waiting;
    if (newWorker) {
      newWorker.postMessage({ type: 'SKIP_WAITING' });
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated') {
          window.location.reload();
        }
      });
    }

    // Hide notification
    const notification = document.getElementById('pwa-update-notification');
    if (notification) {
      notification.remove();
    }

    this.trackEvent('pwa_updated');
  }

  /**
   * Handle online/offline status
   */
  handleOnlineStatus(isOnline) {
    this.isOnline = isOnline;

    // Update document class
    document.documentElement.classList.toggle('offline', !isOnline);

    // Show offline notification
    if (!isOnline) {
      this.showOfflineNotification();
    } else {
      this.hideOfflineNotification();
      this.syncPendingData();
    }

    // Emit custom event
    window.dispatchEvent(new CustomEvent('onlinestatuschange', {
      detail: { online: isOnline }
    }));

    this.trackEvent(isOnline ? 'came_online' : 'went_offline');
  }

  /**
   * Show offline notification
   */
  showOfflineNotification() {
    const notification = document.createElement('div');
    notification.id = 'pwa-offline-notification';
    notification.innerHTML = `
      <div class="pwa-offline-content">
        <div class="pwa-offline-icon">📡</div>
        <div class="pwa-offline-text">
          <strong>You're offline</strong>
          <p>Some features may be limited</p>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #pwa-offline-notification {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #fef3c7;
        border-bottom: 1px solid #f59e0b;
        padding: 0.5rem;
        z-index: 1000;
      }
      .pwa-offline-content {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        max-width: 1200px;
        margin: 0 auto;
      }
      .pwa-offline-icon {
        font-size: 1.25rem;
      }
      .pwa-offline-text strong {
        color: #92400e;
      }
      .pwa-offline-text p {
        margin: 0;
        color: #78350f;
        font-size: 0.9rem;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(notification);
  }

  /**
   * Hide offline notification
   */
  hideOfflineNotification() {
    const notification = document.getElementById('pwa-offline-notification');
    if (notification) {
      notification.remove();
    }
  }

  /**
   * Set up background sync
   */
  async setupBackgroundSync() {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        await this.registration.sync.register('background-sync');
        console.log('Background sync registered');
      } catch (error) {
        console.log('Background sync not supported');
      }
    }
  }

  /**
   * Set up push notifications
   */
  async setupPushNotifications() {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      // Request permission
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        console.log('Push notifications enabled');

        // Subscribe to push notifications
        try {
          const subscription = await this.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: this.urlBase64ToUint8Array(
              'BYourPublicVAPIDKeyHere' // Replace with actual VAPID key
            )
          });

          // Send subscription to server
          this.sendPushSubscription(subscription);

        } catch (error) {
          console.error('Push subscription failed:', error);
        }
      }
    }
  }

  /**
   * Send push subscription to server
   */
  async sendPushSubscription(subscription) {
    try {
      await fetch('/api/push-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription: subscription.toJSON()
        })
      });
    } catch (error) {
      console.error('Failed to send push subscription:', error);
    }
  }

  /**
   * Sync pending data when coming online
   */
  async syncPendingData() {
    if (!this.registration) return;

    try {
      await this.registration.sync.register('background-sync');
    } catch (error) {
      console.log('Background sync not available');
    }
  }

  /**
   * Handle messages from service worker
   */
  handleServiceWorkerMessage(event) {
    const { type, data } = event.data;

    switch (type) {
      case 'SYNC_COMPLETE':
        console.log('Background sync completed');
        this.showSyncNotification();
        break;

      case 'CACHE_CLEARED':
        console.log('Cache cleared');
        break;

      default:
        // Emit custom event for other components to handle
        window.dispatchEvent(new CustomEvent('sw-message', {
          detail: { type, data }
        }));
    }
  }

  /**
   * Show sync completion notification
   */
  showSyncNotification() {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.innerHTML = 'Data synchronized successfully';
    notification.style.cssText = `
      position: fixed;
      top: 1rem;
      right: 1rem;
      background: #10b981;
      color: white;
      padding: 0.75rem 1rem;
      border-radius: 0.375rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      z-index: 1001;
      font-size: 0.9rem;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  /**
   * Track PWA events
   */
  trackEvent(eventName, data = {}) {
    // Send to analytics if available
    if (window.gtag) {
      window.gtag('event', eventName, {
        event_category: 'pwa',
        ...data
      });
    }

    // Also send via WebSocket if connected
    if (window.QuiWebSocket && window.QuiWebSocket.send) {
      window.QuiWebSocket.send({
        type: 'analytics_event',
        event: eventName,
        data: data
      });
    }

    console.log('PWA Event:', eventName, data);
  }

  /**
   * Check if PWA features are supported
   */
  static isSupported() {
    return (
      'serviceWorker' in navigator &&
      'fetch' in window &&
      'caches' in window
    );
  }

  /**
   * Utility function to convert VAPID key
   */
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

// Initialize PWA when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (QuiPWA.isSupported()) {
      window.QuiPWA = new QuiPWA();
    }
  });
} else {
  if (QuiPWA.isSupported()) {
    window.QuiPWA = new QuiPWA();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QuiPWA;
}
