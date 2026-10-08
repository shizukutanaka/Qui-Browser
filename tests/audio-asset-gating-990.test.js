/**
 * Round-990 pins: loadAudioAssets must actually wait for the mp3s it consumes.
 *
 * Defect: the four audio files are registered at 'primary'/'secondary'
 * priority, but ProgressiveLoader.start() only awaits the 'critical' phase —
 * primary is fire-and-forget and secondary is deferred to requestIdleCallback.
 * `get()` reads `loaded`, so immediately after `await start()` every entry is
 * still undefined → the `if (audio)` gate skips `spatialAudio.loadAudio()` for
 * all four → the shipped .mp3 files are never decoded and only procedural
 * tones ever play, while the loader's own fetch is discarded.
 *
 * These tests use the real ProgressiveLoader (performLoad is the only thing
 * mocked, deferred so the race is deterministic) bound to the real
 * VRApp.prototype.loadAudioAssets.
 */

jest.mock('three/examples/jsm/webxr/VRButton.js', () => ({
  VRButton: { createButton: () => ({}) }
}));
jest.mock('three/examples/jsm/webxr/XRControllerModelFactory.js', () => ({
  XRControllerModelFactory: class {
    createControllerModel() {
      return {};
    }
  }
}));

const fs = require('fs');
const path = require('path');
const { ProgressiveLoader } = require('../src/utils/ProgressiveLoader.js');
const { VRApp } = require('../src/vr/VRApp.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'vr', 'VRApp.js'), 'utf8');

function makeSpatialAudio() {
  return {
    buffers: new Map(),
    sources: new Map(),
    loadAudio: jest.fn(async (url, name) => {
      const buf = { url, name, duration: 0.05 };
      return buf;
    }),
    registerProceduralBuffer(name, spec) {
      // Real SpatialAudio: no-ops when a buffer for the name already exists.
      if (!this.buffers.has(name)) {
        this.buffers.set(name, { name, procedural: true, spec });
      }
      return this.buffers.get(name);
    },
    createSource(name, opts) {
      this.sources.set(name, { name, opts });
    }
  };
}

describe('loadAudioAssets gating (round 990)', () => {
  beforeEach(() => {
    // Secondary phase is scheduled via requestIdleCallback — absent in node.
    global.requestIdleCallback = jest.fn();
  });

  test('structural: the four consumed files are registered as critical (blocking)', () => {
    const block = SRC.slice(SRC.indexOf('async loadAudioAssets'), SRC.indexOf('async loadAudioAssets') + 3000);
    const priorities = [...block.matchAll(/priority:\s*'(\w+)'/g)].map((m) => m[1]);
    expect(priorities.length).toBe(4);
    expect(priorities).toEqual(['critical', 'critical', 'critical', 'critical']);
  });

  test('structural: no stale claim that the mp3s are not committed', () => {
    const block = SRC.slice(SRC.indexOf('async loadAudioAssets'), SRC.indexOf('async loadAudioAssets') + 4000);
    expect(block).not.toContain('not committed');
  });

  test('behavioral: real loader phasing must not race the consumer — loadAudio runs for all 4', async () => {
    const loader = new ProgressiveLoader();
    // Defer every fetch so the primary/secondary phases cannot win the race
    // accidentally; critical is awaited by start(), the others are not.
    jest
      .spyOn(loader, 'performLoad')
      .mockImplementation((item) => new Promise((resolve) => setTimeout(() => resolve({ name: item.name }), 5)));

    const spatialAudio = makeSpatialAudio();
    const ctx = { progressiveLoader: loader, spatialAudio };

    await VRApp.prototype.loadAudioAssets.call(ctx);

    expect(spatialAudio.loadAudio).toHaveBeenCalledTimes(4);
    for (const name of ['click', 'hover', 'success', 'error']) {
      expect(spatialAudio.loadAudio).toHaveBeenCalledWith(`/assets/sounds/${name}.mp3`, name);
    }
  });

  test('behavioral: shipped buffers beat procedural fallback (real files win)', async () => {
    const loader = new ProgressiveLoader();
    jest
      .spyOn(loader, 'performLoad')
      .mockImplementation((item) => new Promise((resolve) => setTimeout(() => resolve({ name: item.name }), 5)));

    const spatialAudio = makeSpatialAudio();
    // Simulate the real loadAudio contract: a successful fetch sets a buffer.
    spatialAudio.loadAudio.mockImplementation(async (url, name) => {
      const buf = { url, name, real: true };
      spatialAudio.buffers.set(name, buf);
      return buf;
    });

    const ctx = { progressiveLoader: loader, spatialAudio };
    await VRApp.prototype.loadAudioAssets.call(ctx);

    for (const name of ['click', 'hover', 'success', 'error']) {
      expect(spatialAudio.buffers.get(name)).toEqual(expect.objectContaining({ name, real: true }));
      expect(spatialAudio.buffers.get(name).procedural).toBeUndefined();
      expect(spatialAudio.sources.has(name)).toBe(true);
    }
  });

  test('behavioral: a name whose fetch failed still gets the procedural buffer + source', async () => {
    const loader = new ProgressiveLoader();
    jest
      .spyOn(loader, 'performLoad')
      .mockImplementation((item) =>
        item.name === 'error'
          ? new Promise((resolve, reject) => setTimeout(() => reject(new Error('404')), 5))
          : new Promise((resolve) => setTimeout(() => resolve({ name: item.name }), 5))
      );
    loader.strategy.retryAttempts = 0; // fail fast for the 404

    const spatialAudio = makeSpatialAudio();
    spatialAudio.loadAudio.mockImplementation(async (url, name) => {
      if (name === 'error') {
        return null; // mirrors SpatialAudio.loadAudio's catch→null
      }
      const buf = { url, name, real: true };
      spatialAudio.buffers.set(name, buf);
      return buf;
    });

    const ctx = { progressiveLoader: loader, spatialAudio };
    await VRApp.prototype.loadAudioAssets.call(ctx);

    // 'error' had no real buffer → procedural must cover it; source must exist.
    expect(spatialAudio.buffers.get('error')).toEqual(expect.objectContaining({ procedural: true }));
    expect(spatialAudio.sources.has('error')).toBe(true);
    expect(spatialAudio.sources.has('click')).toBe(true);
  });
});
