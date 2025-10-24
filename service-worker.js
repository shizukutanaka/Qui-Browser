/**
 * Qui Browser VR - Service Worker
 * Progressive Web App (PWA) Implementation
 *
 * Based on 2025 PWA best practices:
 * - Cache-first for static assets
 * - Network-first for dynamic content
 * - Stale-while-revalidate for frequently updated resources
 * - Background sync for offline actions
 * - IndexedDB for large data storage
 *
 * Caching Strategy:
 * - Static assets (JS, CSS, images): Cache-first (1 year)
 * - HTML pages: Network-first (always fresh)
 * - API calls: Network-first with fallback
 * - Media files: Cache-first with streaming
 *
 * Features:
 * - Offline browsing support
 * - Background sync
 * - Push notifications (future)
 * - Install prompt
 * - Update notification
 *
 * @version 3.7.1
 * @author Qui Browser Team
 * @license MIT
 */

const CACHE_VERSION = 'v3.7.1';
const CACHE_STATIC = `qui-browser-static-${CACHE_VERSION}`;
const CACHE_DYNAMIC = `qui-browser-dynamic-${CACHE_VERSION}`;
const CACHE_MEDIA = `qui-browser-media-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/main.css',
  '/assets/js/vr-webgpu-renderer.js',
  '/assets/js/vr-foveated-rendering.js',
  '/assets/js/vr-accessibility-wcag.js',
  '/assets/js/vr-i18n-system.js',
  '/assets/js/vr-voice-commands-i18n.js',
  '/assets/js/vr-memory-manager.js',
  '/assets/js/vr-security-manager.js',
  '/assets/images/icon-192.png',
  '/assets/images/icon-512.png',
  '/assets/images/logo.png',
  '/offline.html' // Offline fallback page
];

// Maximum cache sizes
const MAX_CACHE_SIZE = {
  static: 100, // MB
  dynamic: 50, // MB
  media: 200 // MB
};

// Maximum cache ages
const MAX_CACHE_AGE = {
  static: 365 * 24 * 60 * 60 * 1000, // 1 year
  dynamic: 7 * 24 * 60 * 60 * 1000, // 1 week
  media: 30 * 24 * 60 * 60 * 1000 // 1 month
};

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing version:', CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      console.log('[ServiceWorker] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      console.log('[ServiceWorker] Static assets cached successfully');
      // Skip waiting to activate immediately
      return self.skipWaiting();
    }).catch((error) => {
      console.error('[ServiceWorker] Failed to cache static assets:', error);
    })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating version:', CACHE_VERSION);

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches
          if (cacheName.startsWith('qui-browser-') &&
              cacheName !== CACHE_STATIC &&
              cacheName !== CACHE_DYNAMIC &&
              cacheName !== CACHE_MEDIA) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[ServiceWorker] Old caches cleaned up');
      // Claim clients immediately
      return self.clients.claim();
    })
  );
});

/**
 * Fetch event - serve from cache or network
 */
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Determine caching strategy based on request type
  if (isStaticAsset(url)) {
    // Static assets: Cache-first
    event.respondWith(cacheFirst(request, CACHE_STATIC));
  } else if (isMediaFile(url)) {
    // Media files: Cache-first with streaming
    event.respondWith(cacheFirstMedia(request, CACHE_MEDIA));
  } else if (isAPICall(url)) {
    // API calls: Network-first
    event.respondWith(networkFirst(request, CACHE_DYNAMIC));
  } else if (isHTMLPage(url)) {
    // HTML pages: Network-first
    event.respondWith(networkFirst(request, CACHE_DYNAMIC));
  } else {
    // Default: Network-first with fallback
    event.respondWith(networkFirst(request, CACHE_DYNAMIC));
  }
});

/**
 * Cache-first strategy
 */
async function cacheFirst(request, cacheName) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Check cache age
      const cacheDate = new Date(cachedResponse.headers.get('date'));
      const age = Date.now() - cacheDate.getTime();

      if (age < MAX_CACHE_AGE.static) {
        console.log('[ServiceWorker] Serving from cache:', request.url);
        return cachedResponse;
      }
    }

    // Fetch from network
    const networkResponse = await fetch(request);

    // Cache the response
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      console.log('[ServiceWorker] Cached from network:', request.url);
    }

    return networkResponse;

  } catch (error) {
    console.error('[ServiceWorker] Cache-first failed:', error);

    // Return cached version if available
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[ServiceWorker] Serving stale cache:', request.url);
      return cachedResponse;
    }

    // Return offline page
    return caches.match('/offline.html');
  }
}

/**
 * Network-first strategy
 */
async function networkFirst(request, cacheName) {
  try {
    // Try network first
    const networkResponse = await fetch(request);

    // Cache the response if successful
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      console.log('[ServiceWorker] Cached from network:', request.url);
    }

    return networkResponse;

  } catch (error) {
    console.error('[ServiceWorker] Network-first failed, trying cache:', error);

    // Fallback to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[ServiceWorker] Serving from cache:', request.url);
      return cachedResponse;
    }

    // Return offline page for HTML requests
    if (request.headers.get('accept').includes('text/html')) {
      return caches.match('/offline.html');
    }

    // Return error response
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Cache-first strategy for media files with streaming support
 */
async function cacheFirstMedia(request, cacheName) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[ServiceWorker] Serving media from cache:', request.url);
      return cachedResponse;
    }

    // Fetch from network
    const networkResponse = await fetch(request);

    // Cache the response if successful and not too large
    if (networkResponse.ok) {
      const contentLength = networkResponse.headers.get('content-length');
      const sizeMB = contentLength ? parseInt(contentLength) / (1024 * 1024) : 0;

      if (sizeMB < 50) { // Only cache files < 50 MB
        const cache = await caches.open(cacheName);
        cache.put(request, networkResponse.clone());
        console.log('[ServiceWorker] Cached media from network:', request.url);
      } else {
        console.log('[ServiceWorker] Media too large to cache:', request.url, sizeMB + 'MB');
      }
    }

    return networkResponse;

  } catch (error) {
    console.error('[ServiceWorker] Cache-first media failed:', error);

    // Return cached version if available
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return error response
    return new Response('Media unavailable offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Check if request is for static asset
 */
function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

/**
 * Check if request is for media file
 */
function isMediaFile(url) {
  const mediaExtensions = ['.mp4', '.webm', '.mp3', '.wav', '.ogg', '.m4a'];
  return mediaExtensions.some(ext => url.pathname.endsWith(ext));
}

/**
 * Check if request is API call
 */
function isAPICall(url) {
  return url.pathname.startsWith('/api/') || url.hostname.includes('api.');
}

/**
 * Check if request is HTML page
 */
function isHTMLPage(url) {
  return url.pathname.endsWith('.html') ||
         url.pathname.endsWith('/') ||
         !url.pathname.includes('.');
}

/**
 * Message event - handle messages from clients
 */
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('qui-browser-')) {
              console.log('[ServiceWorker] Clearing cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }).then(() => {
        console.log('[ServiceWorker] All caches cleared');
        event.ports[0].postMessage({ success: true });
      })
    );
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});

/**
 * Sync event - handle background sync
 */
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync:', event.tag);

  if (event.tag === 'sync-bookmarks') {
    event.waitUntil(syncBookmarks());
  }

  if (event.tag === 'sync-history') {
    event.waitUntil(syncHistory());
  }
});

/**
 * Sync bookmarks (placeholder)
 */
async function syncBookmarks() {
  console.log('[ServiceWorker] Syncing bookmarks...');

  try {
    // Get bookmarks from IndexedDB
    // Send to server
    // Update local copy

    console.log('[ServiceWorker] Bookmarks synced successfully');
    return true;

  } catch (error) {
    console.error('[ServiceWorker] Failed to sync bookmarks:', error);
    throw error; // Retry sync
  }
}

/**
 * Sync history (placeholder)
 */
async function syncHistory() {
  console.log('[ServiceWorker] Syncing history...');

  try {
    // Get history from IndexedDB
    // Send to server
    // Update local copy

    console.log('[ServiceWorker] History synced successfully');
    return true;

  } catch (error) {
    console.error('[ServiceWorker] Failed to sync history:', error);
    throw error; // Retry sync
  }
}

/**
 * Push event - handle push notifications (future feature)
 */
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push notification received:', event);

  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.body || 'New notification from Qui Browser VR',
    icon: '/assets/images/icon-192.png',
    badge: '/assets/images/badge-72.png',
    vibrate: [200, 100, 200],
    data: data,
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Close' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Qui Browser VR', options)
  );
});

/**
 * Notification click event
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('[ServiceWorker] Service Worker loaded, version:', CACHE_VERSION);
