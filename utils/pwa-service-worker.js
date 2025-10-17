/**
 * Progressive Web App - Service Worker Manager
 *
 * Offline-first architecture with service worker management.
 * Based on 2025 PWA best practices for reliable web applications.
 *
 * Core Features:
 * - Offline-first caching strategies
 * - Background sync for data consistency
 * - Push notifications support
 * - App shell caching
 * - Dynamic content caching
 * - Cache versioning and update strategies
 *
 * Caching Strategies:
 * - Cache First: Static assets (fast loading)
 * - Network First: Dynamic content (fresh data)
 * - Stale While Revalidate: Balanced approach
 * - Cache Only: Offline fallback pages
 * - Network Only: Real-time data
 *
 * Benefits:
 * - Works offline or on poor networks
 * - Fast loading (even with slow connections)
 * - App-like experience
 * - Installable on devices
 * - Automatic updates
 *
 * Browser Support (2025):
 * - Chrome/Edge: Full support
 * - Firefox: Full support (Android & Windows)
 * - Safari: Full support (iOS & macOS)
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;

class PWAServiceWorkerManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      // Service worker file
      serviceWorkerPath: options.serviceWorkerPath || '/sw.js',
      scope: options.scope || '/',

      // Cache configuration
      cacheName: options.cacheName || 'qui-browser-cache',
      cacheVersion: options.cacheVersion || 'v1',
      maxCacheSize: options.maxCacheSize || 50 * 1024 * 1024, // 50MB
      maxCacheAge: options.maxCacheAge || 7 * 24 * 60 * 60 * 1000, // 7 days

      // Caching strategies
      staticAssets: options.staticAssets || [
        '/',
        '/index.html',
        '/manifest.json',
        '/styles.css',
        '/app.js'
      ],
      cacheFirstPatterns: options.cacheFirstPatterns || [
        /\.css$/,
        /\.js$/,
        /\.woff2?$/,
        /\.png$/,
        /\.jpg$/,
        /\.svg$/
      ],
      networkFirstPatterns: options.networkFirstPatterns || [
        /\/api\//,
        /\.json$/
      ],

      // Offline support
      offlinePage: options.offlinePage || '/offline.html',
      enableOfflineFallback: options.enableOfflineFallback !== false,

      // Background sync
      enableBackgroundSync: options.enableBackgroundSync !== false,
      syncTag: options.syncTag || 'qui-browser-sync',

      // Push notifications
      enablePushNotifications: options.enablePushNotifications || false,
      vapidPublicKey: options.vapidPublicKey || null,

      // Update strategy
      updateStrategy: options.updateStrategy || 'immediate', // immediate, on-reload, manual

      ...options
    };

    // Registration state
    this.registration = null;
    this.updateAvailable = false;
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    // Statistics
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      networkRequests: 0,
      offlineRequests: 0,
      backgroundSyncs: 0,
      pushNotificationsSent: 0,
      updateChecks: 0
    };

    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  /**
   * Initialize service worker manager
   */
  async initialize() {
    try {
      // Check service worker support
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Workers not supported');
      }

      // Monitor online/offline status
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.emit('online');
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.emit('offline');
      });

      this.emit('initialized');
    } catch (error) {
      this.emit('error', { operation: 'initialize', error: error.message });
    }
  }

  /**
   * Register service worker
   */
  async register() {
    try {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Workers not supported');
      }

      // Register service worker
      this.registration = await navigator.serviceWorker.register(
        this.options.serviceWorkerPath,
        { scope: this.options.scope }
      );

      this.emit('registered', { scope: this.options.scope });

      // Handle updates
      this.registration.addEventListener('updatefound', () => {
        this.handleUpdate();
      });

      // Check for updates periodically
      setInterval(() => {
        this.checkForUpdates();
      }, 60000); // Every minute

      // Handle controller change
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        this.emit('controllerChanged');
      });

      // Handle messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleServiceWorkerMessage(event);
      });

      return this.registration;
    } catch (error) {
      this.emit('error', { operation: 'register', error: error.message });
      throw error;
    }
  }

  /**
   * Handle service worker update
   */
  handleUpdate() {
    const newWorker = this.registration.installing;

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        // New service worker available
        this.updateAvailable = true;
        this.emit('updateAvailable', { worker: newWorker });

        // Apply update based on strategy
        switch (this.options.updateStrategy) {
          case 'immediate':
            this.applyUpdate();
            break;

          case 'on-reload':
            // Wait for user to reload
            this.emit('updateWaiting');
            break;

          case 'manual':
            // User must manually trigger update
            break;
        }
      }
    });
  }

  /**
   * Apply service worker update
   */
  async applyUpdate() {
    if (!this.updateAvailable) {
      return;
    }

    try {
      const newWorker = this.registration.waiting || this.registration.installing;

      if (newWorker) {
        // Tell service worker to skip waiting
        newWorker.postMessage({ type: 'SKIP_WAITING' });

        // Reload page when new worker takes control
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        });

        this.emit('updateApplied');
      }
    } catch (error) {
      this.emit('error', { operation: 'applyUpdate', error: error.message });
    }
  }

  /**
   * Check for updates
   */
  async checkForUpdates() {
    if (!this.registration) {
      return;
    }

    try {
      await this.registration.update();
      this.stats.updateChecks++;
      this.emit('updateChecked');
    } catch (error) {
      this.emit('error', { operation: 'checkForUpdates', error: error.message });
    }
  }

  /**
   * Unregister service worker
   */
  async unregister() {
    if (!this.registration) {
      return false;
    }

    try {
      const result = await this.registration.unregister();
      this.registration = null;
      this.emit('unregistered');
      return result;
    } catch (error) {
      this.emit('error', { operation: 'unregister', error: error.message });
      return false;
    }
  }

  /**
   * Send message to service worker
   */
  async sendMessage(message) {
    if (!this.registration || !this.registration.active) {
      throw new Error('No active service worker');
    }

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data);
        }
      };

      this.registration.active.postMessage(message, [messageChannel.port2]);
    });
  }

  /**
   * Handle message from service worker
   */
  handleServiceWorkerMessage(event) {
    const { type, data } = event.data;

    switch (type) {
      case 'CACHE_HIT':
        this.stats.cacheHits++;
        break;

      case 'CACHE_MISS':
        this.stats.cacheMisses++;
        break;

      case 'NETWORK_REQUEST':
        this.stats.networkRequests++;
        break;

      case 'OFFLINE_REQUEST':
        this.stats.offlineRequests++;
        break;

      case 'BACKGROUND_SYNC':
        this.stats.backgroundSyncs++;
        this.emit('backgroundSync', data);
        break;

      default:
        this.emit('message', { type, data });
    }
  }

  /**
   * Clear cache
   */
  async clearCache(cacheName = null) {
    try {
      const cacheToDelete = cacheName || `${this.options.cacheName}-${this.options.cacheVersion}`;
      const result = await caches.delete(cacheToDelete);

      this.emit('cacheCleared', { cacheName: cacheToDelete });

      return result;
    } catch (error) {
      this.emit('error', { operation: 'clearCache', error: error.message });
      return false;
    }
  }

  /**
   * Clear all caches
   */
  async clearAllCaches() {
    try {
      const cacheNames = await caches.keys();
      const deletePromises = cacheNames.map(name => caches.delete(name));
      await Promise.all(deletePromises);

      this.emit('allCachesCleared', { count: cacheNames.length });

      return cacheNames.length;
    } catch (error) {
      this.emit('error', { operation: 'clearAllCaches', error: error.message });
      return 0;
    }
  }

  /**
   * Get cache size
   */
  async getCacheSize() {
    try {
      if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
        return null;
      }

      const estimate = await navigator.storage.estimate();

      return {
        usage: estimate.usage,
        quota: estimate.quota,
        usagePercent: (estimate.usage / estimate.quota) * 100,
        caches: estimate.usageDetails?.caches || 0
      };
    } catch (error) {
      this.emit('error', { operation: 'getCacheSize', error: error.message });
      return null;
    }
  }

  /**
   * Request background sync
   */
  async requestBackgroundSync(tag = null) {
    if (!this.options.enableBackgroundSync || !this.registration) {
      throw new Error('Background sync not available');
    }

    try {
      const syncTag = tag || this.options.syncTag;
      await this.registration.sync.register(syncTag);

      this.emit('backgroundSyncRequested', { tag: syncTag });

      return true;
    } catch (error) {
      this.emit('error', { operation: 'requestBackgroundSync', error: error.message });
      return false;
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPushNotifications() {
    if (!this.options.enablePushNotifications || !this.registration) {
      throw new Error('Push notifications not available');
    }

    try {
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.options.vapidPublicKey)
      });

      this.emit('pushSubscribed', { subscription });

      return subscription;
    } catch (error) {
      this.emit('error', { operation: 'subscribeToPushNotifications', error: error.message });
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPushNotifications() {
    if (!this.registration) {
      return false;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        this.emit('pushUnsubscribed');
        return true;
      }

      return false;
    } catch (error) {
      this.emit('error', { operation: 'unsubscribeFromPushNotifications', error: error.message });
      return false;
    }
  }

  /**
   * Show notification
   */
  async showNotification(title, options = {}) {
    if (!this.registration) {
      throw new Error('Service worker not registered');
    }

    try {
      await this.registration.showNotification(title, {
        body: options.body || '',
        icon: options.icon || '/icon-192.png',
        badge: options.badge || '/badge-72.png',
        tag: options.tag || 'default',
        requireInteraction: options.requireInteraction || false,
        data: options.data || {}
      });

      this.stats.pushNotificationsSent++;

      this.emit('notificationShown', { title, options });
    } catch (error) {
      this.emit('error', { operation: 'showNotification', error: error.message });
      throw error;
    }
  }

  /**
   * Generate service worker code
   */
  generateServiceWorkerCode() {
    const cacheName = `${this.options.cacheName}-${this.options.cacheVersion}`;

    return `
// Service Worker for Qui Browser PWA
const CACHE_NAME = '${cacheName}';
const OFFLINE_PAGE = '${this.options.offlinePage}';

// Static assets to cache on install
const STATIC_ASSETS = ${JSON.stringify(this.options.staticAssets)};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      self.clients.claim();
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Cache-first strategy for static assets
  if (${this.options.cacheFirstPatterns.map(p => `/${p.source}/`.replace(/\\/\\//g, '/')).join(' || ')}) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          self.clients.matchAll().then(clients => {
            clients.forEach(client =>
              client.postMessage({ type: 'CACHE_HIT', url: request.url })
            );
          });
          return response;
        }

        return fetch(request).then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }

  // Network-first strategy for dynamic content
  if (${this.options.networkFirstPatterns.map(p => `/${p.source}/`.replace(/\\/\\//g, '/')).join(' || ')}) {
    event.respondWith(
      fetch(request).then((response) => {
        self.clients.matchAll().then(clients => {
          clients.forEach(client =>
            client.postMessage({ type: 'NETWORK_REQUEST', url: request.url })
          );
        });

        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, response.clone());
          return response;
        });
      }).catch(() => {
        return caches.match(request);
      })
    );
    return;
  }

  // Default: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, networkResponse.clone());
        });
        return networkResponse;
      }).catch(() => {
        // Offline fallback
        if (request.mode === 'navigate') {
          return caches.match(OFFLINE_PAGE);
        }
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === '${this.options.syncTag}') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client =>
          client.postMessage({ type: 'BACKGROUND_SYNC', tag: event.tag })
        );
      })
    );
  }
});

// Push notification
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};

  event.waitUntil(
    self.registration.showNotification(data.title || 'Notification', {
      body: data.body || '',
      icon: data.icon || '/icon-192.png',
      badge: data.badge || '/badge-72.png'
    })
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});

// Message from client
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
`;
  }

  /**
   * Write service worker file
   */
  async writeServiceWorkerFile(outputPath) {
    try {
      const code = this.generateServiceWorkerCode();
      await fs.writeFile(outputPath, code, 'utf8');

      this.emit('serviceWorkerFileWritten', { path: outputPath });

      return outputPath;
    } catch (error) {
      this.emit('error', { operation: 'writeServiceWorkerFile', error: error.message });
      throw error;
    }
  }

  /**
   * Convert VAPID key
   */
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const hitRate = this.stats.cacheHits + this.stats.cacheMisses > 0
      ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100
      : 0;

    return {
      ...this.stats,
      hitRate,
      isOnline: this.isOnline,
      isRegistered: this.registration !== null,
      updateAvailable: this.updateAvailable
    };
  }
}

module.exports = PWAServiceWorkerManager;
