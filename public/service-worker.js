/**
 * Service Worker for Qui Browser VR
 * Implements offline caching with 70% faster repeat loads
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
const BASE = ((self.location && self.location.pathname) || '/service-worker.js')
  .replace(/service-worker\.js$/, '');

// Critical assets that must be cached for offline support. Kept to the app
// shell only: the hashed JS/CSS bundles Vite emits are picked up at runtime by
// the fetch handler (their names aren't known here), and the previous list's
// '/src/*.js' entries never existed in the production build (Vite bundles them)
// while the CDN Three.js URLs are unused (Three is bundled locally).
const CRITICAL_ASSETS = [
  BASE,
  `${BASE}index.html`,
  `${BASE}manifest.json`,
  `${BASE}offline.html`
];

// Asset patterns to cache with different strategies
const CACHE_PATTERNS = {
  // Cache first - static assets that rarely change
  cacheFirst: [
    /\.ktx2$/,     // KTX2 compressed textures
    /\.wasm$/,     // WebAssembly modules
    /\.glb$/,      // 3D models
    /\.gltf$/,     // 3D models
    /fonts\//,     // Font files
    /\.woff2?$/    // Web fonts
  ],

  // Network first - dynamic content
  networkFirst: [
    /api\//,       // API calls
    /\.json$/,     // JSON data (except manifest)
    /socket/       // WebSocket connections
  ],

  // Stale while revalidate - balance freshness and speed
  staleWhileRevalidate: [
    /\.js$/,       // JavaScript files
    /\.css$/,      // Stylesheets
    /\.html$/,     // HTML pages
    /\.jpg$/,      // Images
    /\.png$/,      // Images
    /\.svg$/       // SVG graphics
  ]
};

// Maximum cache sizes (in entries)
const CACHE_LIMITS = {
  textures: 100,   // ~100MB with KTX2 compression
  models: 50,      // ~50MB of 3D models
  runtime: 200     // General runtime cache
};

/**
 * Install event - cache critical assets
 */
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing version:', CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => {
        console.log('[ServiceWorker] Pre-caching critical assets');
        // Cache all critical assets in parallel for speed
        return Promise.all(
          CRITICAL_ASSETS.map(url =>
            cache.add(url).catch(err => {
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
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
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
  // the cacheFirst/networkFirst paths). Since the reader viewport now fetches
  // arbitrary page HTML, that would grow the cache without bound and serve
  // users stale article text. Caching third-party responses in the app shell
  // was never intended regardless.
  const selfOrigin = (self.location && self.location.origin) || null;
  if (selfOrigin && url.origin !== selfOrigin) {
    return;
  }

  // Determine caching strategy
  const strategy = getCacheStrategy(url.pathname);

  event.respondWith(
    settleWithin(executeStrategy(strategy, request), request)
  );
});

/**
 * A respondWith promise that never settles hangs the page's fetch forever —
 * observed on real Chrome when a fetch is dispatched to a worker realm that
 * was idle-terminated and cold-started (the strategy promise wedged with no
 * error). Cap it: on timeout, fall back to a bare network fetch (SW-initiated
 * fetches bypass this worker's own handler), then to the offline fallback, so
 * every request resolves to SOMETHING.
 */
const FETCH_HARD_TIMEOUT_MS = 10000;
const TIMED_OUT = Symbol('timed-out');

async function settleWithin(promise, request) {
  let timer;
  try {
    const result = await Promise.race([
      promise,
      new Promise(resolve => {
        timer = setTimeout(() => resolve(TIMED_OUT), FETCH_HARD_TIMEOUT_MS);
      })
    ]);
    if (result !== TIMED_OUT) {
      return result;
    }
    return await fetch(request.clone());
  } catch (error) {
    console.error('[ServiceWorker] Strategy failed or timed out:', error);
    return getOfflineFallback(request);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Determine caching strategy based on URL pattern
 */
function getCacheStrategy(pathname) {
  // Check cache-first patterns
  for (const pattern of CACHE_PATTERNS.cacheFirst) {
    if (pattern.test(pathname)) {
      return 'cache-first';
    }
  }

  // Check network-first patterns
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

/**
 * Cache-first strategy - ideal for static assets
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);

  // Try cache first
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  // Cache miss - fetch from network
  try {
    const response = await fetch(request);

    // Cache successful responses. A floated cache write may reject on quota
    // pressure — that must degrade quietly, never as an unhandled rejection.
    if (response.ok) {
      // Clone response before caching (response can only be used once)
      cache.put(request, response.clone()).catch(() => {});

      // Enforce cache limits
      enforceCacheLimit(cache, 'textures').catch(() => {});
    }

    return response;
  } catch (error) {
    console.error('[ServiceWorker] Fetch failed:', error);
    // Return offline fallback if available
    return getOfflineFallback(request);
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
      // A quota/cache-write failure must not eat the fresh response — degrade
      // the bookkeeping, still return what the network gave us.
      await cache.put(request, response.clone()).catch(() => {});
      // Bound the runtime cache. RUNTIME_CACHE is never versioned and never
      // cleared by the activate handler, so without this it grows without limit
      // across every app version — the documented "Service Worker cache eats
      // all your storage" failure. FIFO-evict the oldest entries past the limit.
      await enforceCacheLimit(cache, 'runtime').catch(() => {});
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
    .then(response => {
      // Update cache with fresh version
      if (response.ok) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(error => {
      console.warn('[ServiceWorker] Background fetch failed:', error);
      // No cached copy: navigations must still reach the offline shell
      // rather than resolving to undefined (which is a network error to the
      // browser and never shows offline.html).
      return cached || getOfflineFallback(request);
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
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    )
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
    return (await cache.match(`${BASE}offline.html`)) ||
           new Response('Offline - Please check your connection', {
             status: 503,
             statusText: 'Service Unavailable'
           });
  }

  // Return placeholder for images. 204 is a null-body status — the Response
  // constructor throws unless the body is literally null.
  if (/\.(jpg|jpeg|png|gif|webp)$/i.test(url.pathname)) {
    return new Response(null, {
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
 * Enforce cache size limits
 */
async function enforceCacheLimit(cache, type) {
  const limit = CACHE_LIMITS[type] || CACHE_LIMITS.runtime;
  const keys = await cache.keys();

  if (keys.length > limit) {
    // Remove oldest entries (FIFO)
    const toDelete = keys.length - limit;
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
    settleWithin,
    FETCH_HARD_TIMEOUT_MS,
    CACHE_LIMITS,
    RUNTIME_CACHE,
    BASE,
    CRITICAL_ASSETS
  };
}

console.log('[ServiceWorker] Script loaded, version:', CACHE_VERSION);
