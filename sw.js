/**
 * Qui Browser VR - Service Worker
 * Optimized for VR devices with offline support and efficient caching
 */

const VERSION = '2.0.0';
const CACHE_NAME = `qui-vr-${VERSION}`;
const STATIC_CACHE = `qui-vr-static-${VERSION}`;
const DYNAMIC_CACHE = `qui-vr-dynamic-${VERSION}`;
const VR_ASSETS_CACHE = `qui-vr-assets-${VERSION}`;

// Critical assets for VR browser
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/vr-launcher.js',
  '/public/vr-browser.html',
  '/public/vr-video.html',
  '/public/offline.html',
  '/assets/icon.svg'
];

// VR-specific JavaScript modules
const VR_MODULES = [
  '/assets/js/browser-core.js',
  '/assets/js/webxr-integration.js',
  '/assets/js/vr-gesture-controls.js',
  '/assets/js/vr-spatial-navigation.js',
  '/assets/js/vr-performance-monitor.js'
];

// Maximum cache sizes (optimized for VR devices)
const MAX_DYNAMIC_CACHE_SIZE = 50; // Limit dynamic cache
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  console.log(`[SW v${VERSION}] Installing...`);

  event.waitUntil(
    Promise.all([
      // Cache critical assets
      caches.open(STATIC_CACHE).then(cache => {
        console.log('[SW] Caching critical assets');
        return cache.addAll(CRITICAL_ASSETS);
      }),

      // Cache VR modules separately for better organization
      caches.open(VR_ASSETS_CACHE).then(cache => {
        console.log('[SW] Caching VR modules');
        return cache.addAll(VR_MODULES).catch(err => {
          console.warn('[SW] Some VR modules failed to cache:', err);
          // Non-critical, continue anyway
        });
      })
    ]).then(() => {
      console.log('[SW] Installation complete');
      // Force activation
      return self.skipWaiting();
    })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log(`[SW v${VERSION}] Activating...`);

  event.waitUntil(
    Promise.all([
      // Remove old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => {
              return name.startsWith('qui-vr-') &&
                     name !== CACHE_NAME &&
                     name !== STATIC_CACHE &&
                     name !== DYNAMIC_CACHE &&
                     name !== VR_ASSETS_CACHE;
            })
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      }),

      // Take control immediately
      self.clients.claim()
    ]).then(() => {
      console.log('[SW] Activation complete');
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (except for common CDNs)
  if (url.origin !== location.origin && !isTrustedOrigin(url.origin)) {
    return;
  }

  // Choose strategy based on request type
  if (isCriticalAsset(request.url)) {
    // Critical assets: Cache first, fallback to network
    event.respondWith(cacheFirst(request));
  } else if (isVRAsset(request.url)) {
    // VR assets: Cache first for performance
    event.respondWith(cacheFirst(request));
  } else if (request.mode === 'navigate') {
    // Navigation: Network first, fallback to cache
    event.respondWith(networkFirst(request));
  } else {
    // Other resources: Stale while revalidate
    event.respondWith(staleWhileRevalidate(request));
  }
});

// Cache-first strategy
async function cacheFirst(request) {
  try {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;

  } catch (error) {
    console.error('[SW] Cache-first failed:', error);
    return getOfflineFallback(request);
  }
}

// Network-first strategy
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
      trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_SIZE);
    }
    return response;

  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return getOfflineFallback(request);
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      const cache = caches.open(DYNAMIC_CACHE);
      cache.then(c => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// Helper: Check if asset is critical
function isCriticalAsset(url) {
  return CRITICAL_ASSETS.some(asset => url.endsWith(asset));
}

// Helper: Check if asset is VR-specific
function isVRAsset(url) {
  return url.includes('/vr-') ||
         url.includes('/webxr-') ||
         VR_MODULES.some(module => url.endsWith(module));
}

// Helper: Check if origin is trusted
function isTrustedOrigin(origin) {
  const trusted = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://cdn.jsdelivr.net'
  ];
  return trusted.includes(origin);
}

// Helper: Get offline fallback
async function getOfflineFallback(request) {
  if (request.mode === 'navigate') {
    return caches.match('/public/offline.html');
  }

  // Return a simple offline response
  return new Response('Offline', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain' }
  });
}

// Helper: Trim cache to size limit
async function trimCache(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length > maxSize) {
    const deleteCount = keys.length - maxSize;
    for (let i = 0; i < deleteCount; i++) {
      await cache.delete(keys[i]);
    }
    console.log(`[SW] Trimmed ${deleteCount} items from ${cacheName}`);
  }
}

// Message handler for manual cache updates
self.addEventListener('message', (event) => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }

  if (event.data.action === 'clearCache') {
    event.waitUntil(
      caches.keys().then(names => {
        return Promise.all(names.map(name => caches.delete(name)));
      }).then(() => {
        return self.clients.matchAll();
      }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ action: 'cacheCleared' });
        });
      })
    );
  }

  if (event.data.action === 'getCacheSize') {
    event.waitUntil(
      getCacheSize().then(size => {
        return self.clients.matchAll();
      }).then(clients => {
        clients.forEach(client => {
          client.postMessage({
            action: 'cacheSize',
            size: size
          });
        });
      })
    );
  }
});

// Helper: Calculate total cache size
async function getCacheSize() {
  const cacheNames = await caches.keys();
  let totalSize = 0;

  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const requests = await cache.keys();

    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
  }

  return totalSize;
}

console.log(`[SW v${VERSION}] Service Worker loaded`);
