/**
 * Unit tests for the service worker's runtime-cache eviction.
 *
 * The SW is a classic worker script (top-level `self.addEventListener`), so we
 * stub `self` before requiring it and use the guarded CommonJS export hook to
 * reach the internals. The Cache API is mocked in-memory.
 */

// Stub the worker globals the module touches at require time. Handlers are
// recorded so the fetch listener itself can be exercised (see the cross-origin
// suite at the bottom).
const swHandlers = {};
global.self = {
  addEventListener: (type, fn) => { swHandlers[type] = fn; },
  location: { origin: 'https://app.example', pathname: '/service-worker.js' }
};

const sw = require('../public/service-worker.js');
const { enforceCacheLimit, networkFirst, CACHE_LIMITS } = sw;

// ── In-memory Cache API mock ──────────────────────────────────────────────────
function makeMockCache() {
  const entries = []; // [{ url }, response] in insertion order
  return {
    entries,
    keys: async () => entries.map((e) => e[0]),
    put: async (req, res) => { entries.push([req, res]); },
    match: async (req) => {
      const hit = entries.find((e) => e[0].url === (req.url || req));
      return hit ? hit[1] : undefined;
    },
    delete: async (key) => {
      const idx = entries.findIndex((e) => e[0] === key);
      if (idx >= 0) { entries.splice(idx, 1); return true; }
      return false;
    }
  };
}

function seed(cache, n) {
  for (let i = 0; i < n; i++) {
    cache.entries.push([{ url: `https://x/${i}` }, { id: i }]);
  }
}

describe('enforceCacheLimit — FIFO bound on a cache', () => {
  test('no-op when entry count is at or below the limit', async () => {
    const cache = makeMockCache();
    seed(cache, CACHE_LIMITS.runtime); // exactly at the limit
    await enforceCacheLimit(cache, 'runtime');
    expect(cache.entries).toHaveLength(CACHE_LIMITS.runtime);
  });

  test('trims the oldest entries when over the limit (FIFO)', async () => {
    const cache = makeMockCache();
    seed(cache, CACHE_LIMITS.runtime + 5);
    await enforceCacheLimit(cache, 'runtime');
    expect(cache.entries).toHaveLength(CACHE_LIMITS.runtime);
    // The five oldest (urls 0..4) were evicted; the newest survive.
    const urls = cache.entries.map((e) => e[0].url);
    expect(urls).not.toContain('https://x/0');
    expect(urls).not.toContain('https://x/4');
    expect(urls).toContain('https://x/5');
    expect(urls[urls.length - 1]).toBe(`https://x/${CACHE_LIMITS.runtime + 4}`);
  });

  test('unknown type falls back to the runtime limit', async () => {
    const cache = makeMockCache();
    seed(cache, CACHE_LIMITS.runtime + 3);
    await enforceCacheLimit(cache, 'no-such-type');
    expect(cache.entries).toHaveLength(CACHE_LIMITS.runtime);
  });
});

describe('networkFirst — bounds RUNTIME_CACHE after caching a response', () => {
  let cache;

  beforeEach(() => {
    jest.useFakeTimers();
    cache = makeMockCache();
    // Pre-fill to exactly the limit so the next put pushes it over.
    seed(cache, CACHE_LIMITS.runtime);
    global.caches = { open: async () => cache };
    global.fetch = async () => ({ ok: true, clone: () => ({ body: 'fresh' }) });
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.caches;
    delete global.fetch;
  });

  test('a fresh cached response keeps the runtime cache at its limit', async () => {
    const res = await networkFirst({ url: 'https://x/new' });
    expect(res.ok).toBe(true);
    // put() added one, enforceCacheLimit() trimmed one → still at the limit.
    expect(cache.entries).toHaveLength(CACHE_LIMITS.runtime);
    // The brand-new entry survived; the oldest was evicted.
    const urls = cache.entries.map((e) => e[0].url);
    expect(urls).toContain('https://x/new');
    expect(urls).not.toContain('https://x/0');
  });
});

// The SW must work whether the app is served at the domain root or under a
// subpath (GitHub Pages /Qui-Browser/). BASE is derived from where the worker
// itself is served, and the precache list is resolved against it. With no
// self.location in the test env, BASE defends to '/'.
describe('BASE-relative precache (subpath deploy support)', () => {
  const { BASE, CRITICAL_ASSETS } = sw;

  test('BASE falls back to "/" without a self.location', () => {
    expect(BASE).toBe('/');
  });

  test('critical assets are the app shell, resolved against BASE', () => {
    expect(CRITICAL_ASSETS).toEqual([
      '/', '/index.html', '/manifest.json', '/offline.html'
    ]);
  });

  test('no dead /src/*.js or CDN entries remain (they never existed in the build)', () => {
    for (const asset of CRITICAL_ASSETS) {
      expect(asset).not.toMatch(/\/src\//);
      expect(asset).not.toMatch(/^https?:\/\//);
    }
  });
});

// ── Cross-origin requests must bypass the service worker entirely ────────────
// Regression: the handler skipped only non-GET and chrome-extension:, so ANY
// cross-origin GET fell through to the default stale-while-revalidate strategy
// and was written into the versioned app-shell cache — which has no size limit
// (enforceCacheLimit runs only in the cacheFirst/networkFirst paths). Now that
// the reader viewport fetches arbitrary page HTML, that would have grown the
// cache without bound and served stale article text.
describe('fetch handler — cross-origin bypass', () => {
  // A handled request runs a real caching strategy, which touches caches/fetch.
  beforeEach(() => {
    global.caches = { open: async () => makeMockCache(), match: async () => undefined };
    global.fetch = async () => ({ ok: true, clone: () => ({ body: 'x' }) });
  });
  afterEach(() => {
    delete global.caches;
    delete global.fetch;
  });

  function fire(url, method = 'GET') {
    let responded = false;
    swHandlers.fetch({
      request: { url, method },
      // Swallow the strategy promise so an async rejection can't fail the run.
      respondWith: (p) => { responded = true; Promise.resolve(p).catch(() => {}); }
    });
    return responded;
  }

  test('is registered', () => {
    expect(typeof swHandlers.fetch).toBe('function');
  });

  test('a cross-origin page fetch is NOT intercepted (no caching)', () => {
    expect(fire('https://en.wikipedia.org/wiki/WebXR')).toBe(false);
  });

  test('same-origin requests are still handled', () => {
    expect(fire('https://app.example/index.html')).toBe(true);
  });

  test('non-GET is still skipped', () => {
    expect(fire('https://app.example/api/x', 'POST')).toBe(false);
  });

  test('chrome-extension: is still skipped', () => {
    expect(fire('chrome-extension://abc/x.js')).toBe(false);
  });
});
