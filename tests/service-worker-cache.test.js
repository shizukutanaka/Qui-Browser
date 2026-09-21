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
  addEventListener: (type, fn) => {
    swHandlers[type] = fn;
  },
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
    put: async (req, res) => {
      entries.push([req, res]);
    },
    match: async (req) => {
      const hit = entries.find((e) => e[0].url === (req.url || req));
      return hit ? hit[1] : undefined;
    },
    delete: async (key) => {
      const idx = entries.findIndex((e) => e[0] === key);
      if (idx >= 0) {
        entries.splice(idx, 1); return true;
      }
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

describe('networkFirst — a failed cache write must not eat the fresh response', () => {
  let cache;

  beforeEach(() => {
    jest.useFakeTimers();
    cache = makeMockCache();
    // A full-quota rejection on cache.put must degrade to "not cached", never
    // to losing the response the network already delivered.
    cache.put = async () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };
    global.caches = { open: async () => cache, match: async () => undefined };
    global.fetch = async () => ({
      ok: true,
      marker: 'fresh',
      clone() {
        return this;
      }
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.caches;
    delete global.fetch;
  });

  test('quota rejection still returns the fetched response', async () => {
    const res = await networkFirst({ url: 'https://x/new' });
    expect(res.marker).toBe('fresh');
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
      '/', '/index.html', '/manifest.json', '/offline.html', '/offline.js'
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

  function fire(url, method = 'GET', headers = {}) {
    let responded = false;
    swHandlers.fetch({
      request: {
        url,
        method,
        headers: { get: (name) => headers[name.toLowerCase()] || null },
        clone() {
          return { ...this, headers: this.headers };
        }
      },
      // Swallow the strategy promise so an async rejection can't fail the run.
      respondWith: (p) => {
        responded = true; Promise.resolve(p).catch(() => {});
      }
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

  test('Range requests bypass the handler — 206 responses cannot be cached', () => {
    // cache.put rejects a 206 Partial Content; intercepting a byte-range
    // fetch would turn media seeking into a strategy failure.
    expect(fire('https://app.example/media/clip.mp4', 'GET', { range: 'bytes=0-1023' })).toBe(false);
    expect(fire('https://app.example/js/app.js', 'GET', { range: '' })).toBe(true);
  });
});

describe('fetch handler — floated writes stay inside waitUntil', () => {
  // A floated cache.put after respondWith resolves races with the browser
  // killing the worker — the revalidation can be silently lost. The event's
  // waitUntil must wrap every background write.
  const { staleWhileRevalidate, cacheFirst } = require('../public/service-worker.js');

  function makeEvent() {
    const pending = [];
    return {
      waitUntil: (p) => pending.push(p),
      pending
    };
  }
  const request = {
    url: 'https://app.example/js/app.js',
    method: 'GET',
    headers: { get: () => null },
    clone() {
      return { ...this, headers: this.headers };
    }
  };

  beforeEach(() => {
    global.caches = { open: async () => makeMockCache(), match: async () => undefined };
  });
  afterEach(() => {
    delete global.caches; delete global.fetch;
  });

  test('staleWhileRevalidate puts the revalidation under waitUntil on a cached hit', async () => {
    const cache = makeMockCache();
    cache.entries.push([request, { ok: true, body: 'stale', clone() {
      return this;
    } }]);
    global.caches = { open: async () => cache };
    let putDone = false;
    cache.put = async () => {
      putDone = true;
    };
    global.fetch = async () => ({ ok: true, clone() {
      return this;
    }, body: 'fresh' });

    const event = makeEvent();
    const res = await staleWhileRevalidate(request, event);
    expect(res.body).toBe('stale'); // cached copy served immediately
    expect(event.pending.length).toBe(1); // background write is tracked
    await Promise.allSettled(event.pending);
    expect(putDone).toBe(true);
  });

  test('cacheFirst puts the miss-write under waitUntil', async () => {
    const cache = makeMockCache();
    global.caches = { open: async () => cache };
    let putDone = false;
    cache.put = async () => {
      putDone = true;
    };
    global.fetch = async () => ({ ok: true, clone() {
      return this;
    } });

    const event = makeEvent();
    await cacheFirst(request, event);
    expect(event.pending.length).toBe(1);
    await Promise.allSettled(event.pending);
    expect(putDone).toBe(true);
  });
});

// ── Install/activate/fetch lifecycle ─────────────────────────────────────────
// The remaining arms were previously exercised only in a real browser. The
// handlers recorded in swHandlers drive them headlessly.
describe('install — precaches the app shell and activates immediately', () => {
  test('waitUntil resolves after all CRITICAL_ASSETS are added and skipWaiting runs', async () => {
    const added = [];
    const cache = { add: async (u) => {
      added.push(u);
    } };
    global.caches = { open: async (name) => (name === 'qui-browser-v2.0.0' ? cache : makeMockCache()) };
    self.skipWaiting = jest.fn(async () => {});
    let done;
    swHandlers.install({ waitUntil: (p) => {
      done = p;
    } });
    await done;
    expect(added).toEqual(['/', '/index.html', '/manifest.json', '/offline.html', '/offline.js']);
    expect(self.skipWaiting).toHaveBeenCalled();
    delete global.caches;
    delete self.skipWaiting;
  });
});

describe('activate — evicts every cache that is not the current pair', () => {
  test('deletes stale versions but keeps CACHE_VERSION + RUNTIME_CACHE, then claims clients', async () => {
    const deleted = [];
    global.caches = {
      keys: async () => ['qui-browser-v1.0.0', 'qui-browser-v2.0.0', 'qui-browser-runtime', 'junk'],
      delete: async (name) => {
        deleted.push(name); return true;
      }
    };
    self.clients = { claim: jest.fn(async () => {}) };
    let done;
    swHandlers.activate({ waitUntil: (p) => {
      done = p;
    } });
    await done;
    expect(deleted.sort()).toEqual(['junk', 'qui-browser-v1.0.0']);
    expect(self.clients.claim).toHaveBeenCalled();
    delete global.caches;
    delete self.clients;
  });
});

describe('fetch strategies — cache-first and stale-while-revalidate', () => {
  beforeEach(() => {
    global.caches = { open: async () => makeMockCache(), match: async () => undefined };
  });
  afterEach(() => {
    delete global.caches; delete global.fetch;
  });

  function fireAndWait(url) {
    return new Promise((resolve) => {
      swHandlers.fetch({
        request: {
          url,
          method: 'GET',
          headers: { get: () => null },
          clone() {
            return { ...this, headers: this.headers };
          }
        },
        respondWith: (p) => resolve(Promise.resolve(p))
      });
    });
  }

  test('.wasm goes cache-first: cached hit returns without any network call', async () => {
    const cached = { ok: true, body: 'old' };
    const cache = makeMockCache();
    cache.entries.push([{ url: 'https://app.example/mod.wasm' }, cached]);
    global.caches = { open: async () => cache };
    global.fetch = jest.fn();
    const res = await fireAndWait('https://app.example/mod.wasm');
    expect(res.body).toBe('old');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('.ktx2 is no longer cache-first — the KTX2 pipeline was removed (stale-while-revalidate)', async () => {
    const cache = makeMockCache();
    global.caches = { open: async () => cache };
    global.fetch = jest.fn(async () => ({ ok: true, body: 'fresh', clone() {
      return this;
    } }));
    const res = await fireAndWait('https://app.example/tex.ktx2');
    // Falls to the default SWR path: network fetch happens, result returned.
    expect(global.fetch).toHaveBeenCalled();
    expect(res.body).toBe('fresh');
  });

  test('.js goes stale-while-revalidate: cached body returned, fresh fetch updates cache', async () => {
    const cached = { ok: true, body: 'stale', clone: () => ({ body: 'stale' }) };
    const cache = makeMockCache();
    cache.entries.push([{ url: 'https://app.example/app.js' }, cached]);
    global.caches = { open: async () => cache };
    global.fetch = jest.fn(async () => ({ ok: true, clone: () => ({ body: 'fresh' }) }));
    const res = await fireAndWait('https://app.example/app.js');
    expect(res.body).toBe('stale');           // immediate cached response
    await Promise.resolve();                  // let the background revalidate land
    expect(global.fetch).toHaveBeenCalled();  // but the network update ran
  });

  test('navigating while offline falls back to the cached offline.html shell', async () => {
    const resRef = {};
    const shell = { body: 'offline-page' };
    const cache = makeMockCache();
    cache.entries.push([{ url: '/offline.html' }, shell]);
    // makeMockCache.match compares req.url; the SW passes the literal path.
    cache.match = async (key) => (key === '/offline.html' ? shell : undefined);
    global.caches = { open: async () => cache, match: async () => undefined };
    global.fetch = async () => {
      throw new Error('offline');
    };
    // request.mode 'navigate' → getOfflineFallback serves the cached shell
    let p;
    swHandlers.fetch({
      request: {
        url: 'https://app.example/some/page',
        method: 'GET',
        mode: 'navigate',
        headers: { get: () => null },
        clone() {
          return { ...this, headers: this.headers };
        }
      },
      respondWith: (r) => {
        p = r;
      }
    });
    const res = await p;
    expect(res.body).toBe('offline-page');
  });
});

describe('settleWithin — a wedged strategy still settles the request', () => {
  // Real-browser run found fetch() hanging forever after the worker was
  // idle-terminated and cold-started — the respondWith promise wedged with
  // no error and Chrome never times it out. Every request must resolve.
  const { settleWithin, FETCH_HARD_TIMEOUT_MS } = sw;
  const wedged = () => new Promise(() => {}); // never settles

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    delete global.fetch;
    delete global.caches;
  });

  test('passes through a strategy that resolves in time', async () => {
    await expect(settleWithin(Promise.resolve('fast'), { clone: () => ({}) }))
      .resolves.toBe('fast');
  });

  test('times out a wedged strategy and falls back to a bare network fetch', async () => {
    const request = { clone: jest.fn(() => 'cloned-req') };
    global.fetch = jest.fn(async () => 'network-response');
    const p = settleWithin(wedged(), request);
    jest.advanceTimersByTime(FETCH_HARD_TIMEOUT_MS);
    await expect(p).resolves.toBe('network-response');
    expect(global.fetch).toHaveBeenCalledWith('cloned-req');
  });

  test('on timeout AND network failure, still resolves (offline fallback)', async () => {
    const request = { clone: () => ({}), url: 'https://app.example/x.png', mode: 'navigate' };
    global.fetch = jest.fn(async () => {
      throw new Error('down');
    });
    global.caches = { open: async () => makeMockCache() };
    const p = settleWithin(wedged(), request);
    jest.advanceTimersByTime(FETCH_HARD_TIMEOUT_MS);
    await expect(p).resolves.toBeTruthy();
  });

  test('a rejecting strategy resolves to the offline fallback, not a rejection', async () => {
    const request = { clone: () => ({}), url: 'https://app.example/x.png', mode: 'basic' };
    global.caches = { open: async () => makeMockCache() };
    await expect(settleWithin(Promise.reject(new Error('boom')), request))
      .resolves.toBeTruthy();
  });
});
