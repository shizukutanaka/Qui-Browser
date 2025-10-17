/**
 * Qui Browser Service Worker
 *
 * Provides offline functionality, caching, and background sync for PWA
 */

const CACHE_NAME = 'qui-browser-v1.1.0';
const STATIC_CACHE = 'qui-browser-static-v1.1.0';
const DYNAMIC_CACHE = 'qui-browser-dynamic-v1.1.0';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/css/app.css',
  '/js/app.js',
  '/js/pwa.js'
];

// API endpoints that should be cached
const API_CACHE_PATTERNS = [
  /\/api\/bookmarks$/,
  /\/api\/settings$/,
  /\/api\/health$/
];

// Files that should not be cached
const EXCLUDE_PATTERNS = [
  /\/api\//,  // API calls (except cached ones above)
  /\/metrics$/,  // Metrics endpoint
  /\/logs/,  // Log files
  /\.(mp4|avi|mov|wmv|flv|webm|mkv)$/,  // Video files
  /\.(mp3|wav|flac|aac|ogg)$/,  // Audio files
  /\.(zip|rar|7z|tar|gz)$/,  // Archives
  /\/uploads\//  // User uploads
];

self.addEventListener('install', (event) => {
  console.log('[SW] Install event');

  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),

      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');

  event.waitUntil(
    Promise.all([
      // Clean up old caches
      cleanupOldCaches(),

      // Take control of all clients immediately
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip excluded patterns
  if (EXCLUDE_PATTERNS.some(pattern => pattern.test(request.url))) {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Handle other requests
  event.respondWith(handleResourceRequest(request));
});

self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_NAME });
      break;

    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;

    case 'BACKGROUND_SYNC':
      handleBackgroundSync(data);
      break;

    default:
      console.log('[SW] Unknown message type:', type);
  }
});

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);

  if (event.tag === 'background-sync') {
    event.waitUntil(handleBackgroundSync());
  }
});

self.addEventListener('push', (event) => {
  console.log('[SW] Push event received');

  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event.action);

  event.notification.close();

  const action = event.action || 'default';
  const data = event.notification.data || {};

  switch (action) {
    case 'view':
      event.waitUntil(
        clients.openWindow(data.url || '/')
      );
      break;

    case 'dismiss':
      // Just close the notification
      break;

    default:
      event.waitUntil(
        clients.openWindow('/')
      );
  }
});

self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
  // Handle notification dismissal analytics here
});

/**
 * Handle API requests with caching strategies
 */
async function handleApiRequest(request) {
  const url = new URL(request.url);

  // Check if this API endpoint should be cached
  const shouldCache = API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname));

  if (shouldCache) {
    // Cache-first strategy for important API data
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Update cache in background
      fetch(request).then(response => {
        if (response.ok) {
          const cacheResponse = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(request, cacheResponse);
          });
        }
      });
      return cachedResponse;
    }
  }

  // Network-first strategy
  try {
    const response = await fetch(request);

    if (response.ok && shouldCache) {
      const cacheResponse = response.clone();
      caches.open(DYNAMIC_CACHE).then(cache => {
        cache.put(request, cacheResponse);
      });
    }

    return response;
  } catch (error) {
    // Return cached version if available
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline response for API calls
    return new Response(JSON.stringify({
      error: 'Offline',
      message: 'This feature requires an internet connection'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle navigation requests (page loads)
 */
async function handleNavigationRequest(request) {
  try {
    // Try network first
    const response = await fetch(request);

    if (response.ok) {
      return response;
    }

    throw new Error('Network response not ok');
  } catch (error) {
    // Fall back to offline page
    const offlineResponse = await caches.match('/offline.html');
    if (offlineResponse) {
      return offlineResponse;
    }

    // Ultimate fallback
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Qui Browser - Offline</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #2563eb; }
          p { color: #666; }
        </style>
      </head>
      <body>
        <h1>Qui Browser</h1>
        <p>You are currently offline. Please check your internet connection and try again.</p>
        <button onclick="window.location.reload()">Retry</button>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

/**
 * Handle resource requests (CSS, JS, images, etc.)
 */
async function handleResourceRequest(request) {
  // Try cache first, then network
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);

    if (response.ok) {
      // Cache successful responses
      const cacheResponse = response.clone();
      caches.open(DYNAMIC_CACHE).then(cache => {
        cache.put(request, cacheResponse);
      });
    }

    return response;
  } catch (error) {
    // Return offline placeholder for images
    if (request.destination === 'image') {
      return new Response('', {
        status: 404,
        headers: { 'Content-Type': 'image/svg+xml' }
      });
    }

    throw error;
  }
}

/**
 * Clean up old caches
 */
async function cleanupOldCaches() {
  const cacheNames = await caches.keys();

  return Promise.all(
    cacheNames.map(cacheName => {
      if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
        console.log('[SW] Deleting old cache:', cacheName);
        return caches.delete(cacheName);
      }
    })
  );
}

/**
 * Clear all caches
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys();

  return Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
}

/**
 * Handle background sync
 */
async function handleBackgroundSync(data) {
  console.log('[SW] Handling background sync:', data);

  // Implement background sync logic here
  // This could sync bookmarks, settings, etc. when online

  try {
    // Example: Sync pending bookmarks
    const pendingBookmarks = await getPendingBookmarks();

    for (const bookmark of pendingBookmarks) {
      await syncBookmark(bookmark);
    }

    // Notify clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        success: true
      });
    });

  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

/**
 * Get pending bookmarks for sync
 */
async function getPendingBookmarks() {
  // This would retrieve bookmarks from IndexedDB or similar
  // For now, return empty array
  return [];
}

/**
 * Sync a bookmark
 */
async function syncBookmark(bookmark) {
  // This would send the bookmark to the server
  // Implementation depends on your API
  console.log('[SW] Syncing bookmark:', bookmark);
}

/**
 * Update service worker
 */
async function updateServiceWorker() {
  const registration = await navigator.serviceWorker.ready;
  registration.update();
}

// Export for Node.js compatibility (when used in build process)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CACHE_NAME,
    STATIC_CACHE,
    DYNAMIC_CACHE
  };
}
