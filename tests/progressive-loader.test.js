/**
 * Unit tests for ProgressiveLoader — pure logic, no network calls made.
 * Covers: resource queuing, strategy adjustment, stats, and dispose.
 */

const { ProgressiveLoader } = require('../src/utils/ProgressiveLoader.js');

describe('ProgressiveLoader queue management', () => {
  let loader;
  beforeEach(() => { loader = new ProgressiveLoader(); });
  afterEach(() => { loader.dispose(); });

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
  beforeEach(() => { loader = new ProgressiveLoader(); });
  afterEach(() => { loader.dispose(); });

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
  beforeEach(() => { loader = new ProgressiveLoader(); });
  afterEach(() => { loader.dispose(); });

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
      if (++calls === 1) { throw new Error('flaky'); }
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
  afterEach(() => { loader.dispose(); jest.restoreAllMocks(); });

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
