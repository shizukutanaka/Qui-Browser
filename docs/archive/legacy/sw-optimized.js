/**
 * Qui Browser VR - Optimized Service Worker
 * Streamlined caching strategy with performance improvements
 * @version 3.2.0
 */

const VERSION = '3.2.0';
const CACHE_PREFIX = 'qui-vr';
const CACHE_NAME = `${CACHE_PREFIX}-${VERSION}`;

// Simplified cache structure
const CACHES = {
  STATIC: `${CACHE_PREFIX}-static-${VERSION}`,
  DYNAMIC: `${CACHE_PREFIX}-dynamic-${VERSION}`,
  ASSETS: `${CACHE_PREFIX}-assets-${VERSION}`
};

// Critical assets only (reduced from 27 to essential files)
const CRITICAL_ASSETS = [
  '/',
  '/index-optimized.html',
  '/manifest.json',
  '/public/offline.html',
  '/assets/js/unified-performance-system.js',
  '/assets/js/unified-security-system.js',
  '/assets/js/unified-error-handler.js'
];

// Cache configuration
const CACHE_CONFIG = {
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  maxDynamicSize: 30, // Reduced from 50
  maxAssetsSize: 50, // Reduced from 200
  networkTimeout: 3000 // 3 seconds timeout for network requests
};

// Cache strategies
const STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

// URL patterns and their strategies
const ROUTE_STRATEGIES = [
  { pattern: /\.(png|jpg|jpeg|svg|gif|webp)$/i, strategy: STRATEGIES.CACHE_FIRST },
  { pattern: /\.(js|css)$/i, strategy: STRATEGIES.STALE_WHILE_REVALIDATE },
  { pattern: /^https:\/\/cdn\./, strategy: STRATEGIES.CACHE_FIRST },
  { pattern: /\/api\//, strategy: STRATEGIES.NETWORK_FIRST },
  { pattern: /\/$/, strategy: STRATEGIES.NETWORK_FIRST }
];

/**
 * Install event - minimal caching
 */
self.addEventListener('install', (event) => {
  console.log(`[SW v${VERSION}] Installing...`);

  event.waitUntil(
    caches.open(CACHES.STATIC)
      .then(cache => cache.addAll(CRITICAL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => {
        console.error('[SW] Installation failed:', err);
      })
  );
});

/**
 * Activate event - cleanup old caches
 */
self.addEventListener('activate', (event) => {
  console.log(`[SW v${VERSION}] Activating...`);

  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith(CACHE_PREFIX) && !Object.values(CACHES).includes(name))
            .map(name => {
              console.log(`[SW] Deleting old cache: ${name}`);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

/**
 * Fetch event - optimized routing
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http protocols
  if (!request.url.startsWith('http')) return;

  // Determine strategy based on URL
  const strategy = getStrategyForRequest(request);

  event.respondWith(
    executeStrategy(strategy, request)
      .catch(() => {
        // Fallback to offline page for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/public/offline.html');
        }
        return new Response('Offline', { status: 503 });
      })
  );
});

/**
 * Get caching strategy for request
 */
function getStrategyForRequest(request) {
  const url = new URL(request.url);

  // Check URL patterns
  for (const route of ROUTE_STRATEGIES) {
    if (route.pattern.test(url.pathname)) {
      return route.strategy;
    }
  }

  // Default strategy
  return STRATEGIES.NETWORK_FIRST;
}

/**
 * Execute caching strategy
 */
async function executeStrategy(strategy, request) {
  switch (strategy) {
    case STRATEGIES.CACHE_FIRST:
      return cacheFirst(request);

    case STRATEGIES.NETWORK_FIRST:
      return networkFirst(request);

    case STRATEGIES.STALE_WHILE_REVALIDATE:
      return staleWhileRevalidate(request);

    default:
      return networkFirst(request);
  }
}

/**
 * Cache-first strategy
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetchWithTimeout(request);

  if (response.ok) {
    const cache = await caches.open(CACHES.ASSETS);
    await cache.put(request, response.clone());
    await trimCache(CACHES.ASSETS, CACHE_CONFIG.maxAssetsSize);
  }

  return response;
}

/**
 * Network-first strategy
 */
async function networkFirst(request) {
  try {
    const response = await fetchWithTimeout(request);

    if (response.ok) {
      const cache = await caches.open(CACHES.DYNAMIC);
      await cache.put(request, response.clone());
      await trimCache(CACHES.DYNAMIC, CACHE_CONFIG.maxDynamicSize);
    }

    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/**
 * Stale-while-revalidate strategy
 */
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetchWithTimeout(request)
    .then(async response => {
      if (response.ok) {
        const cache = await caches.open(CACHES.ASSETS);
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || fetchPromise;
}

/**
 * Fetch with timeout
 */
function fetchWithTimeout(request, timeout = CACHE_CONFIG.networkTimeout) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Network timeout')), timeout)
    )
  ]);
}

/**
 * Trim cache to size limit
 */
async function trimCache(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length > maxSize) {
    const keysToDelete = keys.slice(0, keys.length - maxSize);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

/**
 * Message event handler for cache management
 */
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys()
          .then(names => Promise.all(names.map(name => caches.delete(name))))
          .then(() => event.ports[0].postMessage({ success: true }))
      );
      break;

    case 'CACHE_SIZE':
      event.waitUntil(
        getCacheSize()
          .then(size => event.ports[0].postMessage({ size }))
      );
      break;
  }
});

/**
 * Get total cache size
 */
async function getCacheSize() {
  const cacheNames = await caches.keys();
  let totalSize = 0;

  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    totalSize += keys.length;
  }

  return totalSize;
}

/**
 * Periodic cache cleanup
 */
setInterval(async () => {
  try {
    // Clean expired dynamic cache entries
    const cache = await caches.open(CACHES.DYNAMIC);
    const keys = await cache.keys();
    const now = Date.now();

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const dateHeader = response.headers.get('date');
        if (dateHeader) {
          const responseAge = now - new Date(dateHeader).getTime();
          if (responseAge > CACHE_CONFIG.maxAge) {
            await cache.delete(request);
          }
        }
      }
    }
  } catch (error) {
    console.error('[SW] Cache cleanup error:', error);
  }
}, 60 * 60 * 1000); // Run every hour

console.log(`[SW v${VERSION}] Service Worker loaded`);