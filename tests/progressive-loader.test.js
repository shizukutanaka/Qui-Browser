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
