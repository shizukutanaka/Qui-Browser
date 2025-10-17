/**
 * Service Worker Manager
 *
 * Implements offline support and caching improvements (#163):
 * - Service Worker registration and lifecycle management
 * - Offline-first caching strategies
 * - Background sync
 * - Push notifications
 * - Cache versioning and cleanup
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');

/**
 * Service Worker configuration
 */
const DEFAULT_SERVICE_WORKER_CONFIG = {
  // Registration
  registration: {
    scope: '/',
    updateViaCache: 'none'
  },

  // Caching strategies
  caching: {
    strategy: 'network-first', // 'cache-first' | 'network-first' | 'stale-while-revalidate'
    cacheName: 'qui-browser-v1',
    maxAge: 86400 * 7, // 7 days
    maxEntries: 100
  },

  // Resources to precache
  precache: [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json'
  ],

  // Background sync
  backgroundSync: {
    enabled: true,
    tagPrefix: 'sync-'
  },

  // Push notifications
  pushNotifications: {
    enabled: false,
    vapidPublicKey: null
  },

  // Update checking
  updateCheck: {
    enabled: true,
    interval: 3600000 // 1 hour
  }
};

/**
 * Cache strategy implementations
 */
class CacheStrategies {
  /**
   * Cache-first strategy
   */
  static async cacheFirst(request, cacheName, options = {}) {
    const cache = await caches.open(cacheName);

    // Try cache first
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    // Network fallback
    try {
      const response = await fetch(request);
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      // Return offline fallback if available
      if (options.offlineFallback) {
        return cache.match(options.offlineFallback);
      }
      throw error;
    }
  }

  /**
   * Network-first strategy
   */
  static async networkFirst(request, cacheName, options = {}) {
    const cache = await caches.open(cacheName);

    try {
      const response = await fetch(request, {
        signal: options.timeout
          ? AbortSignal.timeout(options.timeout)
          : undefined
      });

      if (response.ok) {
        cache.put(request, response.clone());
      }

      return response;
    } catch (error) {
      // Cache fallback
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }

      // Offline fallback
      if (options.offlineFallback) {
        return cache.match(options.offlineFallback);
      }

      throw error;
    }
  }

  /**
   * Stale-while-revalidate strategy
   */
  static async staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);

    // Return cached response immediately
    const cachedPromise = cache.match(request);

    // Fetch fresh response in background
    const fetchPromise = fetch(request)
      .then((response) => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      })
      .catch(() => null);

    // Return cached or wait for network
    const cached = await cachedPromise;
    return cached || (await fetchPromise);
  }

  /**
   * Network-only strategy
   */
  static async networkOnly(request) {
    return await fetch(request);
  }

  /**
   * Cache-only strategy
   */
  static async cacheOnly(request, cacheName) {
    const cache = await caches.open(cacheName);
    return await cache.match(request);
  }
}

/**
 * Service Worker manager (client-side)
 */
class ServiceWorkerManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = this.mergeConfig(DEFAULT_SERVICE_WORKER_CONFIG, config);
    this.registration = null;
    this.updateCheckInterval = null;
  }

  /**
   * Merge configurations
   */
  mergeConfig(defaults, custom) {
    const merged = { ...defaults };
    for (const key in custom) {
      if (custom[key] && typeof custom[key] === 'object' && !Array.isArray(custom[key])) {
        merged[key] = { ...defaults[key], ...custom[key] };
      } else {
        merged[key] = custom[key];
      }
    }
    return merged;
  }

  /**
   * Register service worker
   */
  async register(scriptURL) {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker not supported in this browser');
    }

    try {
      this.registration = await navigator.serviceWorker.register(scriptURL, {
        scope: this.config.registration.scope,
        updateViaCache: this.config.registration.updateViaCache
      });

      this.emit('registered', this.registration);

      // Setup event listeners
      this.setupEventListeners();

      // Start update checking
      if (this.config.updateCheck.enabled) {
        this.startUpdateChecking();
      }

      return this.registration;
    } catch (error) {
      this.emit('registration-error', error);
      throw error;
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    if (!this.registration) return;

    // State change
    this.registration.onupdatefound = () => {
      const newWorker = this.registration.installing;
      this.emit('update-found', newWorker);

      newWorker.onstatechange = () => {
        this.emit('state-change', {
          state: newWorker.state,
          worker: newWorker
        });

        if (newWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // Update available
            this.emit('update-available');
          } else {
            // First install
            this.emit('installed');
          }
        }

        if (newWorker.state === 'activated') {
          this.emit('activated');
        }
      };
    };

    // Controller change
    navigator.serviceWorker.oncontrollerchange = () => {
      this.emit('controller-change');
    };

    // Message from service worker
    navigator.serviceWorker.onmessage = (event) => {
      this.emit('message', event.data);
    };
  }

  /**
   * Start periodic update checking
   */
  startUpdateChecking() {
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates();
    }, this.config.updateCheck.interval);
  }

  /**
   * Stop update checking
   */
  stopUpdateChecking() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
  }

  /**
   * Check for service worker updates
   */
  async checkForUpdates() {
    if (!this.registration) return;

    try {
      await this.registration.update();
      this.emit('update-checked');
    } catch (error) {
      this.emit('update-check-error', error);
    }
  }

  /**
   * Skip waiting and activate new service worker
   */
  async skipWaiting() {
    if (!this.registration || !this.registration.waiting) {
      return;
    }

    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    this.emit('skip-waiting');
  }

  /**
   * Unregister service worker
   */
  async unregister() {
    if (!this.registration) return false;

    this.stopUpdateChecking();

    try {
      const success = await this.registration.unregister();
      if (success) {
        this.registration = null;
        this.emit('unregistered');
      }
      return success;
    } catch (error) {
      this.emit('unregister-error', error);
      throw error;
    }
  }

  /**
   * Send message to service worker
   */
  sendMessage(message) {
    if (!this.registration || !this.registration.active) {
      throw new Error('No active service worker');
    }

    this.registration.active.postMessage(message);
  }

  /**
   * Request background sync
   */
  async requestBackgroundSync(tag) {
    if (!this.registration || !this.registration.sync) {
      throw new Error('Background Sync not supported');
    }

    try {
      await this.registration.sync.register(tag);
      this.emit('sync-registered', tag);
    } catch (error) {
      this.emit('sync-error', { tag, error });
      throw error;
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribePush() {
    if (!this.config.pushNotifications.enabled) {
      throw new Error('Push notifications not enabled');
    }

    if (!this.registration || !this.registration.pushManager) {
      throw new Error('Push API not supported');
    }

    try {
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          this.config.pushNotifications.vapidPublicKey
        )
      });

      this.emit('push-subscribed', subscription);
      return subscription;
    } catch (error) {
      this.emit('push-subscription-error', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribePush() {
    if (!this.registration || !this.registration.pushManager) {
      return false;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        this.emit('push-unsubscribed');
        return true;
      }
      return false;
    } catch (error) {
      this.emit('push-unsubscription-error', error);
      throw error;
    }
  }

  /**
   * Convert URL-safe base64 to Uint8Array
   */
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }
}

/**
 * Service Worker generator (for creating SW script)
 */
class ServiceWorkerGenerator {
  constructor(config = {}) {
    this.config = { ...DEFAULT_SERVICE_WORKER_CONFIG, ...config };
  }

  /**
   * Generate service worker script
   */
  generateScript() {
    const { cacheName, precache, caching, backgroundSync } = this.config;

    return `
// Service Worker for Qui Browser
// Generated on ${new Date().toISOString()}

const CACHE_NAME = '${cacheName}';
const PRECACHE_URLS = ${JSON.stringify(precache, null, 2)};

// Install event - precache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    handleFetch(request)
  );
});

// Fetch handler with ${caching.strategy} strategy
async function handleFetch(request) {
  const strategy = '${caching.strategy}';

  switch (strategy) {
    case 'cache-first':
      return cacheFirst(request);
    case 'network-first':
      return networkFirst(request);
    case 'stale-while-revalidate':
      return staleWhileRevalidate(request);
    default:
      return fetch(request);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedPromise = cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  const cached = await cachedPromise;
  return cached || await fetchPromise;
}

${backgroundSync.enabled ? this.generateBackgroundSyncCode() : ''}

// Message handler
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
`.trim();
  }

  /**
   * Generate background sync code
   */
  generateBackgroundSyncCode() {
    return `
// Background Sync
self.addEventListener('sync', (event) => {
  if (event.tag.startsWith('${this.config.backgroundSync.tagPrefix}')) {
    event.waitUntil(handleSync(event.tag));
  }
});

async function handleSync(tag) {
  try {
    // Handle background sync
    await fetch('/sync', {
      method: 'POST',
      body: JSON.stringify({ tag }),
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Background sync failed:', error);
    throw error; // Retry later
  }
}
`;
  }

  /**
   * Generate manifest with cache hash
   */
  generateManifest() {
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(this.config.precache))
      .digest('hex')
      .substring(0, 8);

    return {
      version: this.config.caching.cacheName,
      hash,
      timestamp: Date.now(),
      precache: this.config.precache,
      strategy: this.config.caching.strategy
    };
  }
}

/**
 * Cache manager for service worker
 */
class ServiceWorkerCacheManager {
  constructor(cacheName) {
    this.cacheName = cacheName;
  }

  /**
   * Get all cached URLs
   */
  async getCachedURLs() {
    const cache = await caches.open(this.cacheName);
    const requests = await cache.keys();
    return requests.map((req) => req.url);
  }

  /**
   * Clear cache
   */
  async clearCache() {
    return await caches.delete(this.cacheName);
  }

  /**
   * Get cache size
   */
  async getCacheSize() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage,
        quota: estimate.quota,
        percentage: ((estimate.usage / estimate.quota) * 100).toFixed(2) + '%'
      };
    }
    return null;
  }

  /**
   * Delete specific URL from cache
   */
  async deleteCachedURL(url) {
    const cache = await caches.open(this.cacheName);
    return await cache.delete(url);
  }
}

/**
 * Create service worker manager
 */
function createServiceWorkerManager(config = {}) {
  const manager = new ServiceWorkerManager(config);

  // Log events
  manager.on('registered', () => {
    console.log('[ServiceWorker] Registered successfully');
  });

  manager.on('update-available', () => {
    console.log('[ServiceWorker] Update available - reload to activate');
  });

  manager.on('activated', () => {
    console.log('[ServiceWorker] Activated');
  });

  return manager;
}

module.exports = {
  ServiceWorkerManager,
  ServiceWorkerGenerator,
  ServiceWorkerCacheManager,
  CacheStrategies,
  createServiceWorkerManager,
  DEFAULT_SERVICE_WORKER_CONFIG
};
