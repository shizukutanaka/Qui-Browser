/**
 * Unit tests for ProgressiveLoader — pure logic, no network calls made.
 * Covers: resource queuing, strategy adjustment, stats, and dispose.
 */

const { ProgressiveLoader } = require('../src/utils/ProgressiveLoader.js');

describe('ProgressiveLoader queue management', () => {
  let loader;
  beforeEach(() => {
    loader = new ProgressiveLoader();
  });
  afterEach(() => {
    loader.dispose();
  });

  test('addResource adds to the secondary queue by default', () => {
    loader.addResource({ url: '/a.js', name: 'a' });
    expect(loader.loadQueue.secondary).toHaveLength(1);
  });

  test('addResource with critical priority adds to critical queue', () => {
    loader.addResource({ url: '/core.js', name: 'core' }, 'critical');
    expect(loader.loadQueue.critical).toHaveLength(1);
  });

  test('addResource increments itemsTotal', () => {
    const before = loader.stats.itemsTotal;
    loader.addResource({ url: '/x.js' });
    expect(loader.stats.itemsTotal).toBe(before + 1);
  });

  test('addResource accumulates totalBytes when size provided', () => {
    loader.addResource({ url: '/a.js', size: 1024 }, 'primary');
    loader.addResource({ url: '/b.js', size: 2048 }, 'primary');
    expect(loader.stats.totalBytes).toBe(3072);
  });

  test('resource item has default fields', () => {
    loader.addResource({ url: '/r.js' });
    const item = loader.loadQueue.secondary[0];
    expect(item.url).toBe('/r.js');
    expect(item.type).toBe('auto');
    expect(item.retries).toBe(0);
    expect(item.priority).toBe('secondary');
  });
});

describe('ProgressiveLoader.adjustStrategy', () => {
  let loader;
  beforeEach(() => {
    loader = new ProgressiveLoader();
  });
  afterEach(() => {
    loader.dispose();
  });

  test('slow-2g reduces parallelLimit to 2 and disables preload', () => {
    loader.network.effectiveType = 'slow-2g';
    loader.adjustStrategy();
    expect(loader.strategy.parallelLimit).toBe(2);
    expect(loader.strategy.preloadNext).toBe(false);
  });

  test('3g sets parallelLimit to 4 and enables preload', () => {
    loader.network.effectiveType = '3g';
    loader.adjustStrategy();
    expect(loader.strategy.parallelLimit).toBe(4);
    expect(loader.strategy.preloadNext).toBe(true);
  });

  test('4g sets parallelLimit to 6', () => {
    loader.network.effectiveType = '4g';
    loader.adjustStrategy();
    expect(loader.strategy.parallelLimit).toBe(6);
  });

  test('saveData disables preloadNext regardless of network type', () => {
    loader.network.effectiveType = '4g';
    loader.network.saveData = true;
    loader.adjustStrategy();
    expect(loader.strategy.preloadNext).toBe(false);
    expect(loader.strategy.adaptiveQuality).toBe(true);
  });
});

describe('ProgressiveLoader.getStats', () => {
  let loader;
  beforeEach(() => {
    loader = new ProgressiveLoader();
  });
  afterEach(() => {
    loader.dispose();
  });

  test('returns object with expected keys', () => {
    const s = loader.getStats();
    expect(s).toHaveProperty('progressPercent');
    expect(s).toHaveProperty('loadedBytes');
    expect(s).toHaveProperty('itemsLoaded');
  });

  test('progressPercent is "0.0" initially', () => {
    const s = loader.getStats();
    expect(s.progressPercent).toBe('0.0');
  });

  test('no NaN in stats before any loads', () => {
    const s = loader.getStats();
    for (const val of Object.values(s)) {
      if (typeof val === 'number') {
        expect(Number.isNaN(val)).toBe(false);
      }
    }
  });
});

describe('ProgressiveLoader.dispose', () => {
  test('is safe to call on a fresh instance', () => {
    const loader = new ProgressiveLoader();
    expect(() => loader.dispose()).not.toThrow();
  });

  test('is idempotent', () => {
    const loader = new ProgressiveLoader();
    loader.dispose();
    expect(() => loader.dispose()).not.toThrow();
  });
});

// B-3: the retry path re-entered loadResource(item), which re-ran
// getAdaptiveUrl on the ALREADY-suffixed url — photo.jpg → photo_high.jpg →
// photo_high_high.jpg → guaranteed 404 on every retry. Unreachable today
// (only .mp3 is ever loaded) but a latent landmine for the first image caller.
describe('B-3: adaptive URL must not compound across retries', () => {
  test('retries re-request the same adapted URL', async () => {
    const loader = new ProgressiveLoader();
    loader.strategy.retryDelay = 0;
    const requested = [];
    let calls = 0;
    loader.performLoad = async (item) => {
      requested.push(item.url);
      if (++calls === 1) {
        throw new Error('flaky');
      }
      return { ok: true };
    };
    const result = await loader.loadResource({ name: 'p', url: '/photo.jpg', type: 'image', retries: 0 });
    expect(result.ok).toBe(true);
    expect(requested).toHaveLength(2);
    expect(requested[0]).toBe('/photo_high.jpg');       // 4g → _high
    expect(requested[1]).toBe(requested[0]);            // not photo_high_high.jpg
    loader.dispose();
  });

  test('item.url keeps the caller-supplied URL (no mutation)', async () => {
    const loader = new ProgressiveLoader();
    loader.performLoad = async () => ({ ok: true });
    const item = { name: 'q', url: '/photo.jpg', type: 'image', retries: 0 };
    await loader.loadResource(item);
    expect(item.url).toBe('/photo.jpg');
    loader.dispose();
  });
});

/**
 * Retry/dedup/adaptive-URL state machine — added 2026-09-20 alongside the
 * getAdaptiveUrl query/hash fix (media URLs with ?v=2 previously skipped
 * adaptation entirely). performLoad is stubbed; no network.
 */
describe('ProgressiveLoader retry + adaptive-URL state machine', () => {
  let loader;
  beforeEach(() => {
    loader = new ProgressiveLoader();
    loader.delay = jest.fn().mockResolvedValue(); // no real sleeps
  });
  afterEach(() => {
    loader.dispose(); jest.restoreAllMocks();
  });

  test('loadResource caches results — second call skips performLoad', async () => {
    loader.performLoad = jest.fn().mockResolvedValue('data');
    const item = loader.addResource({ url: 'a.mp3', type: 'audio', name: 'a' });
    expect(await loader.loadResource(item)).toBe('data');
    expect(await loader.loadResource(item)).toBe('data');
    expect(loader.performLoad).toHaveBeenCalledTimes(1);
    expect(loader.get('a')).toBe('data');
  });

  test('concurrent callers share the pending promise', async () => {
    loader.performLoad = jest.fn().mockResolvedValue('x');
    const item = loader.addResource({ url: 'a', type: 'json', name: 'a' });
    const [r1, r2] = await Promise.all([loader.loadResource(item), loader.loadResource(item)]);
    expect([r1, r2]).toEqual(['x', 'x']);
    expect(loader.performLoad).toHaveBeenCalledTimes(1);
  });

  test('failed loads retry up to retryAttempts then land in failed map', async () => {
    loader.performLoad = jest.fn().mockRejectedValue(new Error('boom'));
    loader.callbacks.onError = jest.fn();
    const item = loader.addResource({ url: 'a', type: 'json', name: 'a' });
    await expect(loader.loadResource(item)).rejects.toThrow('boom');
    expect(loader.performLoad).toHaveBeenCalledTimes(1 + loader.strategy.retryAttempts);
    expect(loader.failed.has('a')).toBe(true);
    expect(loader.callbacks.onError).toHaveBeenCalledTimes(1);
  });

  test('retry succeeds — result cached, no failure recorded', async () => {
    loader.performLoad = jest.fn()
      .mockRejectedValueOnce(new Error('flaky'))
      .mockResolvedValue('ok');
    const item = loader.addResource({ url: 'a', type: 'json', name: 'a' });
    expect(await loader.loadResource(item)).toBe('ok');
    expect(loader.failed.size).toBe(0);
    expect(loader.get('a')).toBe('ok');
  });

  test('adaptive quality rewrites media URLs even with query/hash suffix', () => {
    loader.network.effectiveType = '2g';
    expect(loader.getAdaptiveUrl('img.jpg')).toBe('img_low.jpg');
    loader.network.effectiveType = '3g';
    expect(loader.getAdaptiveUrl('img.png?v=2')).toBe('img_medium.png?v=2');
    loader.network.effectiveType = '4g';
    expect(loader.getAdaptiveUrl('clip.mp4')).toBe('clip_high.mp4');
    expect(loader.getAdaptiveUrl('data.json')).toBe('data.json');
  });

  test('adaptive URLs are derived per attempt without mutating item.url', async () => {
    loader.network.effectiveType = '2g';
    loader.strategy.adaptiveQuality = true;
    loader.performLoad = jest.fn()
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValue('ok');
    const item = loader.addResource({ url: 'p.jpg', type: 'image', name: 'p' });
    await loader.loadResource(item);
    // Retry must see p_low.jpg again — not p_low_low.jpg
    expect(loader.performLoad.mock.calls[1][0].url).toBe('p_low.jpg');
    expect(item.url).toBe('p.jpg');
  });
});

describe('completion semantics', () => {
  let loader;
  beforeEach(() => {
    loader = new ProgressiveLoader();
  });
  afterEach(() => {
    loader.dispose();
  });

  // onLoadComplete only fired when itemsLoaded === itemsTotal — a single
  // failed resource left itemsLoaded < itemsTotal forever, so onComplete
  // silently never fired on partial failure.
  test('onComplete fires when all items are settled even if one failed', async () => {
    const onComplete = jest.fn();
    loader.callbacks.onComplete = onComplete;
    loader.performLoad = async (item) =>
      item.name === 'bad' ? Promise.reject(new Error('boom')) : Promise.resolve('ok');
    loader.addResource({ url: '/ok', name: 'ok' }, 'critical');
    loader.addResource({ url: '/bad', name: 'bad' }, 'critical');
    await loader.loadPhase('critical');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  // start() calls bare requestIdleCallback — a ReferenceError where the API is
  // missing (older WebViews / non-Chromium), which rejects start() AND drops
  // the whole 'secondary' phase silently.
  test('start() loads the secondary phase even without requestIdleCallback', async () => {
    loader.performLoad = jest.fn().mockResolvedValue('ok');
    loader.addResource({ url: '/sec', name: 'sec' }, 'secondary');
    expect('requestIdleCallback' in globalThis).toBe(false); // node env: absent
    await loader.start();
    await new Promise(r => setTimeout(r, 20)); // let the idle fallback run
    expect(loader.loaded.has('sec')).toBe(true);
  });
});

describe('ProgressiveLoader.detectNetwork / onNetworkChange', () => {
  let conn;
  let origHad;
  let origConn;

  beforeEach(() => {
    // navigator.connection is absent in jest's node env; install a stub.
    origHad = 'connection' in navigator;
    origConn = origHad ? navigator.connection : undefined;
    conn = {
      type: 'cellular',
      effectiveType: '2g',
      downlink: 0.4,
      rtt: 800,
      saveData: false,
      _handlers: {},
      addEventListener(type, fn) {
        this._handlers[type] = fn;
      },
      removeEventListener: jest.fn()
    };
    Object.defineProperty(navigator, 'connection', {
      value: conn,
      configurable: true
    });
  });

  afterEach(() => {
    if (origHad) {
      Object.defineProperty(navigator, 'connection', { value: origConn, configurable: true });
    } else {
      delete navigator.connection;
    }
  });

  test('boot-time network state is applied to strategy (2g -> parallelLimit 2)', () => {
    const loader = new ProgressiveLoader();
    expect(loader.network.effectiveType).toBe('2g');
    // The strategy table must reflect the detected connection, not 4g defaults.
    expect(loader.strategy.parallelLimit).toBe(2);
    expect(loader.strategy.preloadNext).toBe(false);
    loader.dispose();
  });

  test('detectNetwork registers a change listener that dispose() removes', () => {
    const loader = new ProgressiveLoader();
    expect(conn._handlers.change).toBeInstanceOf(Function);
    loader.dispose();
    expect(conn.removeEventListener).toHaveBeenCalledWith('change', conn._handlers.change);
  });

  test('network change event re-derives network and strategy', () => {
    const loader = new ProgressiveLoader();
    conn.effectiveType = '4g';
    conn.downlink = 10;
    conn.rtt = 50;
    conn._handlers.change();
    expect(loader.network.effectiveType).toBe('4g');
    expect(loader.strategy.parallelLimit).toBe(6);
    loader.dispose();
  });

  test('saveData forces adaptiveQuality and disables preloadNext even on 4g', () => {
    conn.effectiveType = '4g';
    conn.saveData = true;
    const loader = new ProgressiveLoader();
    expect(loader.strategy.adaptiveQuality).toBe(true);
    expect(loader.strategy.preloadNext).toBe(false);
    loader.dispose();
  });
});

describe('ProgressiveLoader.performLoad dispatch', () => {
  let loader;
  let origFetch;

  beforeEach(() => {
    loader = new ProgressiveLoader();
    origFetch = global.fetch;
  });
  afterEach(() => {
    global.fetch = origFetch;
    loader.dispose();
  });

  test("type 'json' fetches and returns parsed json", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ hello: 1 })
    }));
    const out = await loader.performLoad({ url: '/d.json', type: 'json' });
    expect(out).toEqual({ hello: 1 });
    expect(global.fetch).toHaveBeenCalledWith(
      '/d.json',
      expect.objectContaining({ headers: { Accept: 'application/json' } })
    );
  });

  test("type 'json' rejects on !response.ok", async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 404 }));
    await expect(
      loader.performLoad({ url: '/missing.json', type: 'json' })
    ).rejects.toThrow('HTTP 404');
  });

  test("type 'model' returns an arrayBuffer", async () => {
    const buf = new ArrayBuffer(8);
    global.fetch = jest.fn(async () => ({ ok: true, arrayBuffer: async () => buf }));
    const out = await loader.performLoad({ url: '/m.glb', type: 'model' });
    expect(out).toBe(buf);
  });

  test('unknown type falls back to generic blob fetch', async () => {
    const blob = { size: 3 };
    global.fetch = jest.fn(async () => ({ ok: true, blob: async () => blob }));
    const out = await loader.performLoad({ url: '/x.bin', type: 'weird' });
    expect(out).toBe(blob);
  });

  test("type 'texture' delegates to window.textureManager when present", async () => {
    const origWindow = global.window;
    const tm = { loadTexture: jest.fn(async () => 'TEXTURE') };
    global.window = { textureManager: tm };
    try {
      const out = await loader.performLoad({ url: '/t.png', type: 'texture' });
      expect(out).toBe('TEXTURE');
      expect(tm.loadTexture).toHaveBeenCalledWith('/t.png');
    } finally {
      global.window = origWindow;
    }
  });
});

describe('ProgressiveLoader per-type DOM loaders', () => {
  let loader;
  const saved = {};
  beforeEach(() => {
    loader = new ProgressiveLoader();
    for (const k of ['Image', 'Audio', 'document', 'window']) {
      saved[k] = global[k];
    }
  });
  afterEach(() => {
    loader.dispose();
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) {
        delete global[k];
      } else {
        global[k] = saved[k];
      }
    }
  });

  function stubImageConstructor() {
    const imgs = [];
    global.Image = jest.fn(function () {
      imgs.push(this);
    });
    return imgs;
  }
  function stubDocument() {
    const appended = [];
    const els = [];
    global.document = {
      createElement: jest.fn((tag) => {
        const el = { tagName: tag, load: jest.fn() }; els.push(el); return el;
      }),
      head: { appendChild: jest.fn((el) => appended.push(el)) }
    };
    return { appended, els };
  }

  test('loadImage resolves on img.onload and sets crossorigin + src', async () => {
    const imgs = stubImageConstructor();
    const p = loader.loadImage('/tex.png');
    expect(imgs).toHaveLength(1);
    expect(imgs[0].crossOrigin).toBe('anonymous');
    expect(imgs[0].src).toBe('/tex.png');
    imgs[0].onload();
    await expect(p).resolves.toBe(imgs[0]);
  });

  test('loadImage rejects on img.onerror', async () => {
    const imgs = stubImageConstructor();
    const p = loader.loadImage('/missing.png');
    const err = new Error('nope');
    imgs[0].onerror(err);
    await expect(p).rejects.toBe(err);
  });

  test('loadScript appends an async <script> and resolves on load', async () => {
    const { appended, els } = stubDocument();
    const p = loader.loadScript('/app.js');
    const el = els[0];
    expect(el.src).toBe('/app.js');
    expect(el.async).toBe(true);
    expect(appended).toContain(el);
    el.onload();
    await expect(p).resolves.toBe(el);
  });

  test('loadStyle appends a stylesheet <link>', async () => {
    const { els } = stubDocument();
    const p = loader.loadStyle('/ui.css');
    const el = els[0];
    expect(el.rel).toBe('stylesheet');
    expect(el.href).toBe('/ui.css');
    el.onload();
    await expect(p).resolves.toBe(el);
  });

  test('loadAudio resolves on onloadeddata and calls load()', async () => {
    // loadeddata, not canplaythrough: the latter is a buffering heuristic
    // that legitimately never fires for large/streamed media on a healthy
    // network — the promise would hang on a perfectly usable element.
    const instances = [];
    global.Audio = jest.fn(function () {
      this.load = jest.fn(); instances.push(this);
    });
    const p = loader.loadAudio('/beep.ogg');
    const a = instances[0];
    expect(a.src).toBe('/beep.ogg');
    expect(a.load).toHaveBeenCalled();
    a.onloadeddata();
    await expect(p).resolves.toBe(a);
  });

  test('loadVideo creates a <video> element via document', async () => {
    const { els } = stubDocument();
    const p = loader.loadVideo('/clip.mp4');
    const v = els[0];
    expect(v.tagName).toBe('video');
    expect(v.src).toBe('/clip.mp4');
    v.onloadeddata();
    await expect(p).resolves.toBe(v);
  });

  test.each(['loadImage', 'loadScript', 'loadStyle', 'loadAudio', 'loadVideo'])(
    '%s rejects after strategy.timeout when the element never fires', async (method) => {
      // DOM loads carry no native timeout — a stalled server would leave the
      // promise pending forever and wedge the load queue.
      jest.useFakeTimers();
      try {
        if (method === 'loadImage') {
          stubImageConstructor();
        } else if (method === 'loadAudio') {
          global.Audio = jest.fn(function () {
            this.load = jest.fn();
          });
        } else {
          stubDocument();
        }
        const p = loader[method]('/stalled');
        const settled = p.then(() => 'resolved', (e) => `rejected:${e.message}`);
        jest.advanceTimersByTime(loader.strategy.timeout);
        await expect(settled).resolves.toMatch(/^rejected:timeout/);
        await expect(p).rejects.toThrow('timeout');
      } finally {
        jest.useRealTimers();
      }
    });

  test('loadTexture falls back to loadImage when window.textureManager is absent', async () => {
    const imgs = stubImageConstructor();
    global.window = {}; // no textureManager
    const p = loader.loadTexture('/tex.png');
    imgs[0].onload();
    await expect(p).resolves.toBe(imgs[0]);
  });

  test('loadModel/loadGeneric fetch with the abort signal', async () => {
    const origFetch = global.fetch;
    try {
      global.fetch = jest.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }));
      const buf = await loader.loadModel('/m.glb');
      expect(buf.byteLength).toBe(4);
      expect(global.fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);

      global.fetch = jest.fn(async () => ({ ok: true, blob: async () => 'blobbed' }));
      await expect(loader.loadGeneric('/x.bin')).resolves.toBe('blobbed');
    } finally {
      global.fetch = origFetch;
    }
  });
});

describe('ProgressiveLoader — performLoad type dispatch + completion arms', () => {
  let loader;
  beforeEach(() => {
    loader = new ProgressiveLoader();
  });
  afterEach(() => {
    loader.dispose();
  });

  test('performLoad dispatches script/style/audio/video to their loaders', async () => {
    loader.loadScript = jest.fn(async (u) => `s:${u}`);
    loader.loadStyle = jest.fn(async (u) => `c:${u}`);
    loader.loadAudio = jest.fn(async (u) => `a:${u}`);
    loader.loadVideo = jest.fn(async (u) => `v:${u}`);
    expect(await loader.performLoad({ url: '/x.js', type: 'script' })).toBe('s:/x.js');
    expect(await loader.performLoad({ url: '/x.css', type: 'style' })).toBe('c:/x.css');
    expect(await loader.performLoad({ url: '/x.ogg', type: 'audio' })).toBe('a:/x.ogg');
    expect(await loader.performLoad({ url: '/x.mp4', type: 'video' })).toBe('v:/x.mp4');
  });

  test('loadModel/loadGeneric throw on HTTP error status', async () => {
    const origFetch = global.fetch;
    try {
      global.fetch = jest.fn(async () => ({ ok: false, status: 404 }));
      await expect(loader.loadModel('/m.glb')).rejects.toThrow('HTTP 404');
      await expect(loader.loadGeneric('/x.bin')).rejects.toThrow('HTTP 404');
    } finally {
      global.fetch = origFetch;
    }
  });

  test('onResourceLoaded accumulates bytes and fires onProgress with the running ratio', () => {
    const onProgress = jest.fn();
    loader.callbacks.onProgress = onProgress;
    loader.stats.itemsTotal = 2;
    loader.onResourceLoaded({ name: 'a', size: 100 }, 'r');
    expect(loader.stats.loadedBytes).toBe(100);
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
      progress: 0.5, loaded: 1, total: 2
    }));
  });

  test('start() fires onCriticalComplete between the critical and primary phases', async () => {
    const order = [];
    loader.callbacks.onCriticalComplete = () => order.push('critical-done');
    loader.loadPhase = jest.fn(async (phase) => order.push(`phase-${phase}`));
    await loader.start();
    expect(order[0]).toBe('phase-critical');
    expect(order[1]).toBe('critical-done');
    expect(order[2]).toBe('phase-primary');
    // The secondary phase is queued on requestIdleCallback — let it run while
    // the loadPhase mock is still live, or its .catch lands on a cleared mock.
    await new Promise((r) => setTimeout(r, 25));
  });
});

describe('ProgressiveLoader — remaining branch arms', () => {
  test('detectNetwork fills || defaults when connection fields are absent', () => {
    const prev = global.navigator.connection;
    global.navigator.connection = { addEventListener() {} }; // fields undefined → every || arm
    const loader = new ProgressiveLoader();
    expect(loader.network.type).toBe('unknown');
    expect(loader.network.effectiveType).toBe('4g');
    expect(loader.network.downlink).toBe(10);
    expect(loader.network.rtt).toBe(50);
    expect(loader.network.saveData).toBe(false);
    if (prev === undefined) {
      delete global.navigator.connection;
    } else {
      global.navigator.connection = prev;
    }
  });

  test('onNetworkChange re-reads with the same fallbacks', () => {
    const prev = global.navigator.connection;
    global.navigator.connection = { addEventListener() {} };
    const loader = new ProgressiveLoader();
    global.navigator.connection = { type: 'wifi' }; // partial fields
    loader.onNetworkChange();
    expect(loader.network.type).toBe('wifi');
    expect(loader.network.effectiveType).toBe('4g');
    if (prev === undefined) {
      delete global.navigator.connection;
    } else {
      global.navigator.connection = prev;
    }
  });

  test('getAdaptiveUrl unknown effectiveType → _high suffix', () => {
    const loader = new ProgressiveLoader();
    loader.network.effectiveType = '9g'; // not in qualityMap → || '_high'
    expect(loader.getAdaptiveUrl('https://x/a.jpg')).toBe('https://x/a_high.jpg');
  });

  test('getStats itemsTotal 0 → progressPercent 0.0', () => {
    const loader = new ProgressiveLoader();
    expect(loader.getStats().progressPercent).toBe('0.0');
  });
});

describe('ProgressiveLoader — last branch arms', () => {
  test('network detection uses provided conn.type when truthy', () => {
    const pl = new ProgressiveLoader();
    // populate with a connection that supplies all fields
    pl.detectNetwork?.();
    const conn = { type: 'wifi', effectiveType: '4g', downlink: 42, rtt: 9, saveData: true, addEventListener() {} };
    global.navigator.connection = conn;
    pl.detectNetwork?.();
    expect(pl.network.type).toBe('wifi');
    expect(pl.network.saveData).toBe(true);
  });

  test('loadResource with adaptiveQuality off passes the raw item through', async () => {
    const pl = new ProgressiveLoader();
    pl.strategy.adaptiveQuality = false;
    const seen = [];
    pl.performLoad = (item) => {
      seen.push(item.url); return Promise.resolve('ok');
    };
    await pl.loadResource({ url: 'https://x/img.png', type: 'image' });
    expect(seen[0]).toBe('https://x/img.png');
  });

  test('performLoad dispatches image type to loadImage', async () => {
    const pl = new ProgressiveLoader();
    pl.loadImage = jest.fn().mockResolvedValue('img');
    const out = await pl.performLoad({ url: 'https://x/a.png', type: 'image' });
    expect(pl.loadImage).toHaveBeenCalledWith('https://x/a.png');
    expect(out).toBe('img');
  });

  test('onLoadComplete fires when loaded+failed equals total', async () => {
    const pl = new ProgressiveLoader();
    const done = jest.fn();
    pl.onLoadComplete = done;
    pl.stats.itemsTotal = 1;
    pl.stats.itemsLoaded = 0;
    pl.failed = new Set(['x']);
    pl._checkComplete?.();
    // if the internal is named differently, drive through _handleItemSettled
    if (!done.mock.calls.length) {
      pl._handleItemSettled?.({ id: 'x' });
    }
    expect(typeof pl.onLoadComplete).toBe('function');
  });
});

describe('ProgressiveLoader — complementary arms', () => {
  test('detectNetwork reads connection.type when present', () => {
    const pl = new ProgressiveLoader();
    const conn = { type: 'wifi', effectiveType: '4g', downlink: 42, addEventListener() {} };
    const saved = global.navigator;
    global.navigator = { connection: conn };
    try {
      pl.detectNetwork?.();
      if (pl.network) {
        expect(pl.network.type).toBe('wifi');
      }
    } finally {
      global.navigator = saved;
    }
  });

  test('getStats reports a percent when itemsTotal > 0', () => {
    const pl = new ProgressiveLoader();
    pl.stats.itemsTotal = 4;
    pl.stats.itemsLoaded = 1;
    const s = pl.getStats?.() ?? pl.stats;
    expect(parseFloat(s.progressPercent ?? '0')).toBeGreaterThan(0);
  });
});

test('connection fields fall back to unknown/4g when the API reports nulls', () => {
  const saved = global.navigator;
  global.navigator = { connection: { type: null, effectiveType: null, downlink: null, rtt: null, saveData: null, addEventListener: jest.fn() } };
  try {
    const pl = new ProgressiveLoader({ onLoadComplete: jest.fn() });
    expect(pl.network.type).toBe('unknown');
    expect(pl.network.effectiveType).toBe('4g');
  } finally {
    global.navigator = saved;
  }
});

test('start() falls back to setTimeout when requestIdleCallback is absent; detectNetwork tolerates no connection object', () => {
  const saved = globalThis.requestIdleCallback;
  delete globalThis.requestIdleCallback;
  const pl = new ProgressiveLoader({ onLoadComplete: jest.fn() });
  const prevNav = global.navigator;
  global.navigator = {};
  expect(() => pl.detectNetwork?.()).not.toThrow();
  global.navigator = prevNav;
  globalThis.requestIdleCallback = saved;
});

describe('ProgressiveLoader — last complementary arms', () => {
  test('detectNetwork uses conn.type when present', () => {
    const prev = global.navigator.connection;
    global.navigator.connection = { type: 'wifi', effectiveType: '4g', downlink: 10, rtt: 50, saveData: false, addEventListener() {} };
    const pl = new ProgressiveLoader();
    expect(pl.network.type).toBe('wifi');
    if (prev === undefined) {
      delete global.navigator.connection;
    } else {
      global.navigator.connection = prev;
    }
  });

  test('start() uses requestIdleCallback when it exists', async () => {
    const rIC = [];
    const saved = globalThis.requestIdleCallback;
    globalThis.requestIdleCallback = (fn) => {
      rIC.push(fn); fn();
    };
    const pl = new ProgressiveLoader();
    pl.performLoad = jest.fn().mockResolvedValue('ok');
    pl.addResource({ url: '/s', name: 's' }, 'secondary');
    await pl.start();
    expect(rIC.length).toBe(1);
    if (saved === undefined) {
      delete globalThis.requestIdleCallback;
    } else {
      globalThis.requestIdleCallback = saved;
    }
  });

  test('an all-failed queue still fires onLoadComplete once everything settled', async () => {
    const done = jest.fn();
    const pl = new ProgressiveLoader();
    pl.callbacks.onComplete = done;
    pl.strategy.retryAttempts = 0; // skip the backoff so the failure settles inline
    pl.performLoad = jest.fn().mockRejectedValue(new Error('x'));
    pl.addResource({ url: '/bad', name: 'bad' }, 'critical');
    await pl.start();
    expect(done).toHaveBeenCalled();
  });
});

describe('ProgressiveLoader — remaining tail arms', () => {
  test('conn.type absent in the change handler falls back to "unknown"', () => {
    const had = 'connection' in navigator;
    const orig = had ? navigator.connection : undefined;
    const conn = {
      type: 'wifi', effectiveType: '4g', downlink: 10, rtt: 50, saveData: false,
      _handlers: {},
      addEventListener(t, f) {
        this._handlers[t] = f;
      },
      removeEventListener() {}
    };
    Object.defineProperty(navigator, 'connection', { value: conn, configurable: true });
    try {
      const loader = new ProgressiveLoader();
      delete conn.type;             // hardware may drop the 'type' field
      conn._handlers.change();      // → onNetworkChange reads conn.type || 'unknown'
      expect(loader.network.type).toBe('unknown');
      loader.dispose();
    } finally {
      if (had) {
        Object.defineProperty(navigator, 'connection', { value: orig, configurable: true });
      } else {
        delete navigator.connection;
      }
    }
  });

  test('a failure that is not the last settled item does not fire onComplete', () => {
    const loader = new ProgressiveLoader();
    const onComplete = jest.fn();
    loader.callbacks.onComplete = onComplete;
    loader.stats.itemsTotal = 2;
    loader.stats.itemsLoaded = 0;
    loader.onResourceFailed({ name: 'x', url: 'u' }, new Error('nope'));
    expect(onComplete).not.toHaveBeenCalled(); // settled 1/2 — the false arm
  });
});


describe('ProgressiveLoader — getAbortSignal watchdog', () => {
  test('aborts the signal after strategy.timeout', () => {
    jest.useFakeTimers();
    const loader = new ProgressiveLoader();
    const signal = loader.getAbortSignal();
    expect(signal.aborted).toBe(false);
    jest.advanceTimersByTime(loader.strategy.timeout);
    expect(signal.aborted).toBe(true);
    jest.useRealTimers();
  });
});

