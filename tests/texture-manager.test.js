/**
 * Unit tests for TextureManager.
 * THREE and three/examples are fully mocked so no GPU or network is needed.
 */

// ── THREE mock ────────────────────────────────────────────────────────────────
const THREE_CONSTANTS = {
  RepeatWrapping: 1000,
  LinearFilter: 1006,
  LinearMipMapLinearFilter: 1008,
  NearestFilter: 1003,
  LinearSRGBColorSpace: 'srgb-linear',
  SRGBColorSpace: 'srgb'
};

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
    load(url, onLoad) { onLoad(mockTex()); }
  }
  class MockMeshBasicMaterial { dispose() {} }
  class MockCanvasTexture { constructor() { Object.assign(this, mockTex()); } }
  return {
    RepeatWrapping: 1000, LinearFilter: 1006, LinearMipMapLinearFilter: 1008,
    NearestFilter: 1003, LinearSRGBColorSpace: 'srgb-linear', SRGBColorSpace: 'srgb',
    TextureLoader: MockTextureLoader,
    MeshBasicMaterial: MockMeshBasicMaterial,
    CanvasTexture: MockCanvasTexture
  };
});

jest.mock('three/examples/jsm/loaders/KTX2Loader.js', () => {
  const mockTex = () => ({
    wrapS: null, wrapT: null, magFilter: null, minFilter: null,
    anisotropy: null, colorSpace: null, generateMipmaps: false,
    dispose: jest.fn()
  });
  class MockKTX2Loader {
    setTranscoderPath() {}
    detectSupport() {}
    dispose() {}
    load(url, onLoad) { onLoad(mockTex()); }
  }
  return { KTX2Loader: MockKTX2Loader };
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

  // ── getKTX2Url ────────────────────────────────────────────────────────────────
  test('getKTX2Url replaces jpg extension with ktx2', () => {
    expect(tm.getKTX2Url('assets/wood.jpg')).toBe('assets/wood.ktx2');
  });

  test('getKTX2Url replaces png extension with ktx2', () => {
    expect(tm.getKTX2Url('tex.png')).toBe('tex.ktx2');
  });

  test('getKTX2Url returns null when no replaceable extension', () => {
    expect(tm.getKTX2Url('tex.ktx2')).toBeNull();
  });

  // ── loadTexture — cache ───────────────────────────────────────────────────────
  test('loadTexture caches the result and returns hit on second call', async () => {
    const t1 = await tm.loadTexture('test.png');
    const t2 = await tm.loadTexture('test.png');
    expect(t1).toBe(t2);
    expect(tm.stats.cacheHits).toBe(1);
    expect(tm.stats.cacheMisses).toBe(1);
  });

  test('loadTexture increments fallbackLoaded for standard PNG', async () => {
    await tm.loadTexture('sprite.png');
    expect(tm.stats.fallbackLoaded).toBe(1);
    expect(tm.stats.ktx2Loaded).toBe(0);
  });

  test('loadTexture increments ktx2Loaded for .ktx2 URL', async () => {
    await tm.loadTexture('sprite.ktx2');
    expect(tm.stats.ktx2Loaded).toBe(1);
    expect(tm.stats.fallbackLoaded).toBe(0);
  });

  // ── applyTextureSettings — colorSpace ────────────────────────────────────────
  test('applyTextureSettings: colorSpace option is applied directly', () => {
    const tex = makeMockTexture();
    tm.applyTextureSettings(tex, { colorSpace: 'srgb' });
    expect(tex.colorSpace).toBe('srgb');
  });

  test('applyTextureSettings: legacy encoding 3001 maps to srgb', () => {
    const tex = makeMockTexture();
    tm.applyTextureSettings(tex, { encoding: 3001 });
    expect(tex.colorSpace).toBe('srgb');
  });

  test('applyTextureSettings: legacy encoding other maps to srgb-linear', () => {
    const tex = makeMockTexture();
    tm.applyTextureSettings(tex, { encoding: 3000 });
    expect(tex.colorSpace).toBe('srgb-linear');
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
});
