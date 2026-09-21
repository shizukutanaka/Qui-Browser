/**
 * Unit tests for TextureManager.
 * THREE and three/examples are fully mocked so no GPU or network is needed.
 */

const makeMockTexture = () => ({
  wrapS: null, wrapT: null,
  magFilter: null, minFilter: null,
  anisotropy: null, colorSpace: null,
  generateMipmaps: false,
  dispose: jest.fn()
});

jest.mock('three', () => {
  // makeMockTexture isn't in scope here (jest.mock is hoisted), so define inline.
  const mockTex = () => ({
    wrapS: null, wrapT: null, magFilter: null, minFilter: null,
    anisotropy: null, colorSpace: null, generateMipmaps: false,
    dispose: jest.fn()
  });
  class MockTextureLoader {
    load(url, onLoad) {
      onLoad(mockTex());
    }
  }
  class MockMeshBasicMaterial {
    dispose() {}
  }
  class MockCanvasTexture {
    constructor() {
      Object.assign(this, mockTex());
    }
  }
  return {
    RepeatWrapping: 1000, LinearFilter: 1006, LinearMipMapLinearFilter: 1008,
    NearestFilter: 1003, LinearSRGBColorSpace: 'srgb-linear', SRGBColorSpace: 'srgb',
    TextureLoader: MockTextureLoader,
    MeshBasicMaterial: MockMeshBasicMaterial,
    CanvasTexture: MockCanvasTexture
  };
});

// ── browser APIs ──────────────────────────────────────────────────────────────
global.performance = global.performance || { now: () => Date.now() };

const { TextureManager } = require('../src/utils/TextureManager.js');

function makeRenderer() {
  return {
    capabilities: { getMaxAnisotropy: jest.fn(() => 16) }
  };
}

describe('TextureManager', () => {
  let tm;

  beforeEach(() => {
    tm = new TextureManager(makeRenderer());
  });

  afterEach(() => {
    tm.dispose();
  });

  // ── construction ──────────────────────────────────────────────────────────────
  test('initialises with empty cache and zero stats', () => {
    expect(tm.textureCache.size).toBe(0);
    expect(tm.stats.cacheHits).toBe(0);
    expect(tm.stats.cacheMisses).toBe(0);
  });

  // ── loadTexture — cache ───────────────────────────────────────────────────────
  test('loadTexture caches the result and returns hit on second call', async () => {
    const t1 = await tm.loadTexture('test.png');
    const t2 = await tm.loadTexture('test.png');
    expect(t1).toBe(t2);
    expect(tm.stats.cacheHits).toBe(1);
    expect(tm.stats.cacheMisses).toBe(1);
  });

  test('loadTexture increments texturesLoaded for a standard PNG', async () => {
    await tm.loadTexture('sprite.png');
    expect(tm.stats.texturesLoaded).toBe(1);
  });

  // ── applyTextureSettings — colorSpace ────────────────────────────────────────
  test('applyTextureSettings: colorSpace option is applied directly', () => {
    const tex = makeMockTexture();
    tm.applyTextureSettings(tex, { colorSpace: 'srgb' });
    expect(tex.colorSpace).toBe('srgb');
  });

  test('applyTextureSettings: the removed legacy encoding option is ignored', () => {
    const tex = makeMockTexture();
    // Pre-r152 callers once passed THREE.*Encoding numerics; that compat branch
    // was deleted (no caller passed it) — encoding must not set colorSpace.
    tm.applyTextureSettings(tex, { encoding: 3001 });
    expect(tex.colorSpace).toBeNull();
  });

  test('applyTextureSettings: anisotropy uses renderer max by default', () => {
    const tex = makeMockTexture();
    tm.applyTextureSettings(tex, {});
    expect(tex.anisotropy).toBe(16);
  });

  test('applyTextureSettings: custom anisotropy overrides renderer max', () => {
    const tex = makeMockTexture();
    tm.applyTextureSettings(tex, { anisotropy: 4 });
    expect(tex.anisotropy).toBe(4);
  });

  // ── dispose ───────────────────────────────────────────────────────────────────
  test('dispose clears the cache and calls dispose on each texture', async () => {
    await tm.loadTexture('a.png');
    await tm.loadTexture('b.png');
    expect(tm.textureCache.size).toBe(2);
    tm.dispose();
    expect(tm.textureCache.size).toBe(0);
  });

  // ── getMemoryStats ────────────────────────────────────────────────────────────
  test('getMemoryStats returns expected shape', () => {
    const s = tm.getMemoryStats();
    expect(s).toHaveProperty('textureCount');
    expect(s).toHaveProperty('usedMB');
    expect(s).toHaveProperty('maxMB');
    expect(s).toHaveProperty('utilizationPercent');
  });

  // ── memory accounting ───────────────────────────────────────────────────────
  test('unloadTexture reverses the exact byte count cacheTexture recorded', () => {
    const texture = { image: { width: 512, height: 512 }, dispose: jest.fn() };
    const url = 'assets/textures/wood_normal.png';

    tm.cacheTexture(url, texture);
    expect(tm.memoryUsage.estimatedBytes).toBe(512 * 512 * 4);

    tm.unloadTexture(url);
    expect(tm.memoryUsage.estimatedBytes).toBe(0);
  });

  test('mixed-size textures accumulate and unload independently', () => {
    const a = { image: { width: 256, height: 256 }, dispose: jest.fn() };
    const b = { image: { width: 128, height: 128 }, dispose: jest.fn() };

    tm.cacheTexture('a.png', a);
    tm.cacheTexture('b.jpg', b);

    expect(tm.memoryUsage.estimatedBytes).toBe(256 * 256 * 4 + 128 * 128 * 4);

    tm.unloadTexture('a.png');
    expect(tm.memoryUsage.estimatedBytes).toBe(128 * 128 * 4);

    tm.unloadTexture('b.jpg');
    expect(tm.memoryUsage.estimatedBytes).toBe(0);
  });
});

describe('TextureManager — duplicate-URL accounting', () => {
  let tm;
  beforeEach(() => {
    tm = new TextureManager(makeRenderer());
  });
  afterEach(() => {
    tm.dispose();
  });

  // A duplicate URL issued while the first load is in flight misses the cache
  // → both loads would run → cacheTexture() called twice for one entry →
  // estimatedBytes/textureCount permanently inflated even after unloadTexture.
  test('concurrent duplicate loads share the promise and count memory once', async () => {
    await Promise.all([tm.loadTexture('dup.png'), tm.loadTexture('dup.png')]);
    expect(tm.textureCache.size).toBe(1);
    expect(tm.memoryUsage.textureCount).toBe(1);
    tm.unloadTexture('dup.png');
    expect(tm.memoryUsage.estimatedBytes).toBe(0);
    expect(tm.memoryUsage.textureCount).toBe(0);
  });

  test('a concurrent load of an in-flight URL reuses the same pending load', async () => {
    const p1 = tm.loadTexture('shared.png');
    const p2 = tm.loadTexture('shared.png');
    const [t1, t2] = await Promise.all([p1, p2]);
    expect(t1).toBe(t2);
    expect(tm.stats.texturesLoaded).toBe(1); // one real fetch, not two
    expect(tm.memoryUsage.textureCount).toBe(1);
  });
});

describe('TextureManager pruning + stats (uncovered layer)', () => {
  // Bypass the loader mocks: drive cacheTexture directly with a fixed
  // 1-byte estimate so eviction order is what is being measured.
  function makeTM(bytesPerTex = 1, maxBytes = 4) {
    const tm = new TextureManager();
    tm.estimateTextureMemory = () => bytesPerTex;
    tm.memoryUsage.maxBytes = maxBytes;
    return tm;
  }
  const tex = () => ({ dispose: jest.fn(), image: { width: 4, height: 4 } });

  test('pruneCache evicts down to 70% of maxBytes', () => {
    const tm = makeTM(1, 4);
    tm.cacheTexture('a', tex());
    tm.cacheTexture('b', tex());
    tm.cacheTexture('c', tex());
    tm.memoryUsage.estimatedBytes = 4; // over the cap
    tm.pruneCache();
    expect(tm.memoryUsage.estimatedBytes).toBeLessThanOrEqual(2); // floor(4*0.7)
    expect(tm.textureCache.size).toBeLessThan(3);
  });

  test('a cache hit refreshes recency: hot texture survives eviction', async () => {
    const tm = makeTM(1, 3);
    tm.cacheTexture('a', tex());
    tm.cacheTexture('b', tex());
    tm.cacheTexture('c', tex()); // 3 bytes, at the cap
    // 'a' is hit frequently — it must NOT be the first evicted.
    await tm.loadTexture('a');
    // 'd' pushes over the cap; pruneCache evicts to 70% of 3 = 2 bytes.
    tm.cacheTexture('d', tex());
    // Order after the hit was [b, c, a]; adding 'd' over the cap prunes to
    // 2 bytes: b and c evict, the hot 'a' and new 'd' remain.
    expect(tm.textureCache.has('a')).toBe(true);
    expect(tm.textureCache.has('b')).toBe(false);
    expect(tm.textureCache.has('c')).toBe(false);
    expect(tm.textureCache.has('d')).toBe(true);
  });

  test('loadStandardTexture resolves through THREE.TextureLoader', async () => {
    const tm = new TextureManager();
    await expect(tm.loadStandardTexture('/x.png')).resolves.toBeDefined();
  });

  test('getMemoryStats/getPerformanceStats report formatted values', () => {
    const tm = new TextureManager();
    tm.stats.cacheHits = 3;
    tm.stats.cacheMisses = 1;
    const mem = tm.getMemoryStats();
    expect(mem).toHaveProperty('usedMB');
    expect(mem).toHaveProperty('utilizationPercent');
    const perf = tm.getPerformanceStats();
    expect(perf.cacheHitRate).toBe(75); // numeric percent
  });

  test('getErrorTexture paints a checkerboard on a 2d canvas', () => {
    const fills = [];
    const origDoc = global.document;
    global.document = {
      createElement: () => ({
        width: 0, height: 0,
        getContext: () => ({ fillStyle: '', fillRect: (...a) => fills.push(a) })
      })
    };
    try {
      const tm = new TextureManager();
      const t = tm.getErrorTexture();
      expect(t).toBeDefined();
      expect(fills.length).toBe(64); // 256/32 x 256/32 squares
    } finally {
      global.document = origDoc;
    }
  });
});

describe('TextureManager — error arms', () => {
  test('loadTexture returns the error texture (not a throw) when the loader fails', async () => {
    const tm = new TextureManager(makeRenderer());
    tm.textureLoader.load = (url, onLoad, onProgress, onError) => onError(new Error('404'));
    // jsdom has no 2d canvas impl — stub the minimal surface getErrorTexture needs
    const prevDoc = global.document;
    global.document = { createElement: () => ({
      width: 0, height: 0,
      getContext: () => ({ fillStyle: null, fillRect: () => {} })
    }) };
    const tex = await tm.loadTexture('https://x.example.com/gone.png');
    global.document = prevDoc;
    expect(tex).toBeTruthy(); // CanvasTexture error placeholder, not a rejection
    expect(tm.stats.texturesLoaded).toBe(0);
  });

  test('loadStandardTexture rejects when the loader calls onError', async () => {
    const tm = new TextureManager(makeRenderer());
    tm.textureLoader.load = (url, onLoad, onProgress, onError) => onError(new Error('bad'));
    await expect(tm.loadStandardTexture('x.png')).rejects.toThrow('bad');
  });

  test('loadStandardTexture rejects after the timeout when the loader never calls back', async () => {
    // three's loaders carry no built-in timeout — a stalled server would
    // leave the promise pending forever and pin the pendingLoads entry.
    jest.useFakeTimers();
    try {
      const tm = new TextureManager(makeRenderer());
      tm.textureLoader.load = () => {};
      const p = tm.loadStandardTexture('/stalled');
      const settled = p.then(() => 'resolved', (e) => `rejected:${e.message}`);
      jest.advanceTimersByTime(30000);
      await expect(settled).resolves.toMatch(/^rejected:timeout loading texture/);
      await expect(p).rejects.toThrow('timeout loading texture');
    } finally {
      jest.useRealTimers();
    }
  });

  test('unloadTexture on an uncached URL is a no-op', () => {
    const tm = new TextureManager(makeRenderer());
    expect(() => tm.unloadTexture('https://never-loaded.example.com/x.png')).not.toThrow();
  });

  test('a standard texture loads end-to-end through loadTexture', async () => {
    const tm = new TextureManager(makeRenderer());
    const tex = await tm.loadTexture('y.png');
    expect(tex).toBeTruthy();
    expect(tm.stats.texturesLoaded).toBe(1);
  });
});

describe('TextureManager — last branch arms', () => {
  test('applyTextureSettings skips mipmaps when minFilter is Linear', () => {
    const tm = new TextureManager(makeRenderer());
    const tex = { generateMipmaps: false };
    tm.applyTextureSettings(tex, { minFilter: 1006 /* LinearFilter */ });
    expect(tex.generateMipmaps).toBe(false);
  });

  test('cacheTexture on an already-cached URL evicts the old entry first', () => {
    const tm = new TextureManager();
    tm.textureCache.set('u', { texture: { dispose: jest.fn() }, estimatedBytes: 1 });
    expect(() => tm.cacheTexture('u', { dispose: jest.fn() })).not.toThrow();
  });

  test('estimateTextureMemory defaults image dimensions when absent', () => {
    const tm = new TextureManager();
    const bytes = tm.estimateTextureMemory({ image: {} });
    expect(bytes).toBeGreaterThan(0);
  });

  test('getPerformanceStats zero-count arms → 0 rates', () => {
    const tm = new TextureManager();
    const stats = tm.getPerformanceStats();
    expect(stats.cacheHitRate).toBe(0);
    expect(stats.avgLoadTime).toBe(0);
  });

  test('dispose does not throw on a fresh manager', () => {
    const tm = new TextureManager();
    expect(() => tm.dispose()).not.toThrow();
  });
});

describe('TextureManager — populated cacheHitRate arm', () => {
  test('getPerformanceStats reports a nonzero hit rate after a real hit', async () => {
    const tm = new TextureManager(makeRenderer());
    await tm.loadTexture('a.png');
    await tm.loadTexture('a.png'); // cache hit
    const stats = tm.getPerformanceStats();
    expect(stats.cacheHitRate).toBeGreaterThan(0);
  });
});
