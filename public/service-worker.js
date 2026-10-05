/**
 * Service Worker for Qui Browser VR
 * Implements offline caching for repeat visits
 *
 * John Carmack principle: Cache aggressively, invalidate carefully
 */

const CACHE_VERSION = 'qui-browser-v2.0.0';
const RUNTIME_CACHE = 'qui-browser-runtime';

// App base path, derived from where this worker is served. When the app is at
// the domain root this is '/'; under a subpath (GitHub Pages
// /Qui-Browser/service-worker.js) it is '/Qui-Browser/'. Everything the worker
// precaches or falls back to is resolved against it so caching/offline work
// regardless of where the app is deployed.
const BASE = ((self.location && self.location.pathname) || '/service-worker.js').replace(/service-worker\.js$/, '');

// Critical assets that must be cached for offline support. Kept to the app
// shell only: the hashed JS/CSS bundles Vite emits are picked up at runtime by
// the fetch handler (their names aren't known here), and the previous list's
// '/src/*.js' entries never existed in the production build (Vite bundles them)
// while the CDN Three.js URLs are unused (Three is bundled locally).
const CRITICAL_ASSETS = [BASE, `${BASE}index.html`, `${BASE}manifest.json`, `${BASE}offline.html`];

// URL patterns routed away from the default stale-while-revalidate strategy.
// Only classes of requests that can actually occur belong here — everything
// else falls through to stale-while-revalidate.
const CACHE_PATTERNS = {
  // Network first - freshness matters more than speed
  networkFirst: [
    /\.json$/ // manifest.json and other JSON
  ]
};

// Maximum entries held in the unversioned runtime cache.
const RUNTIME_CACHE_LIMIT = 200;

/**
 * Install event - cache critical assets
 */
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing version:', CACHE_VERSION);

  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => {
        console.log('[ServiceWorker] Pre-caching critical assets');
        // Cache all critical assets in parallel for speed
        return Promise.all(
          CRITICAL_ASSETS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn(`[ServiceWorker] Failed to cache ${url}:`, err);
            })
          )
        );
      })
      .then(() => {
        console.log('[ServiceWorker] Installation complete');
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
  );
});

/**
 * Activate event - cleanup old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating version:', CACHE_VERSION);

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_VERSION && cacheName !== RUNTIME_CACHE) {
              console.log('[ServiceWorker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[ServiceWorker] Activation complete');
        // Take control of all clients immediately
        return self.clients.claim();
      })
  );
});

/**
 * Fetch event - implement caching strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // Skip cross-origin requests entirely — let them go straight to the network.
  //
  // Without this, ANY cross-origin GET fell through to the default
  // stale-while-revalidate strategy and was written into the versioned
  // app-shell cache, which has no size limit (enforceCacheLimit only runs in
  // the networkFirst path). Since the reader viewport now fetches
  // arbitrary page HTML, that would grow the cache without bound and serve
  // users stale article text. Caching third-party responses in the app shell
  // was never intended regardless.
  const selfOrigin = (self.location && self.location.origin) || null;
  if (selfOrigin && url.origin !== selfOrigin) {
    return;
  }

  // Determine caching strategy
  const strategy = getCacheStrategy(url.pathname);

  event.respondWith(executeStrategy(strategy, request));
});

/**
 * Determine caching strategy based on URL pattern
 */
function getCacheStrategy(pathname) {
  for (const pattern of CACHE_PATTERNS.networkFirst) {
    if (pattern.test(pathname)) {
      return 'network-first';
    }
  }

  // Default to stale-while-revalidate
  return 'stale-while-revalidate';
}

/**
 * Execute the appropriate caching strategy
 */
async function executeStrategy(strategy, request) {
  switch (strategy) {
    case 'network-first':
      return networkFirst(request);

    case 'stale-while-revalidate':
      return staleWhileRevalidate(request);

    default:
      return fetch(request);
  }
}

/**
 * Network-first strategy - ideal for dynamic content
 */
async function networkFirst(request) {
  try {
    // Try network first with timeout
    const response = await fetchWithTimeout(request, 3000);

    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
      // Bound the runtime cache. RUNTIME_CACHE is never versioned and never
      // cleared by the activate handler, so without this it grows without limit
      // across every app version — the documented "Service Worker cache eats
      // all your storage" failure. FIFO-evict the oldest entries past the limit.
      await enforceCacheLimit(cache);
    }

    return response;
  } catch (error) {
    // Network failed - try cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Both failed - return offline fallback
    return getOfflineFallback(request);
  }
}

/**
 * Stale-while-revalidate strategy - balance speed and freshness
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);

  // Return cached version immediately if available
  const cached = await cache.match(request);

  // Fetch fresh version in background
  const fetchPromise = fetch(request)
    .then((response) => {
      // Update cache with fresh version
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch((error) => {
      console.warn('[ServiceWorker] Background fetch failed:', error);
      return cached; // Return cached version on error
    });

  // Return cached immediately if available, otherwise wait for network
  if (cached) {
    return cached;
  }
  return fetchPromise;
}

/**
 * Fetch with timeout
 */
function fetchWithTimeout(request, timeout = 5000) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), timeout))
  ]);
}

/**
 * Get offline fallback response
 */
async function getOfflineFallback(request) {
  const url = new URL(request.url);

  // Return offline page for navigation requests
  if (request.mode === 'navigate') {
    const cache = await caches.open(CACHE_VERSION);
    return (
      cache.match(`${BASE}offline.html`) ||
      new Response('Offline - Please check your connection', {
        status: 503,
        statusText: 'Service Unavailable'
      })
    );
  }

  // Return placeholder for images
  if (/\.(jpg|jpeg|png|gif|webp)$/i.test(url.pathname)) {
    return new Response('', {
      status: 204,
      statusText: 'No Content'
    });
  }

  // Return empty response for other assets
  return new Response('', {
    status: 503,
    statusText: 'Service Unavailable'
  });
}

/**
 * Enforce the runtime cache's entry limit (FIFO eviction)
 */
async function enforceCacheLimit(cache) {
  const keys = await cache.keys();

  if (keys.length > RUNTIME_CACHE_LIMIT) {
    // Remove oldest entries (FIFO)
    const toDelete = keys.length - RUNTIME_CACHE_LIMIT;
    for (let i = 0; i < toDelete; i++) {
      await cache.delete(keys[i]);
    }
  }
}

// Test-only export hook: in a CommonJS (Jest) context the internals are exposed
// so the cache-eviction logic can be unit-tested headlessly. In the real worker
// `module` is undefined and this is skipped.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    enforceCacheLimit,
    networkFirst,
    RUNTIME_CACHE_LIMIT,
    RUNTIME_CACHE,
    BASE,
    CRITICAL_ASSETS
  };
}

console.log('[ServiceWorker] Script loaded, version:', CACHE_VERSION);
