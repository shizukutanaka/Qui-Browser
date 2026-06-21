/**
 * Unit tests for the service worker's runtime-cache eviction.
 *
 * The SW is a classic worker script (top-level `self.addEventListener`), so we
 * stub `self` before requiring it and use the guarded CommonJS export hook to
 * reach the internals. The Cache API is mocked in-memory.
 */

// Stub the worker globals the module touches at require time.
global.self = { addEventListener: () => {} };

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
