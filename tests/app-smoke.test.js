/**
 * Smoke tests for the live v2.0.0 src/ application modules.
 *
 * These intentionally cover dependency-free core modules of the actual app
 * (the modules reachable from index.html -> src/main.js) and lock in the
 * NaN-guard and teardown fixes made to the runtime code.
 */
const { ObjectPool } = require('../src/utils/ObjectPool.js');
const { AIRecommendation } = require('../src/ai/AIRecommendation.js');
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

describe('src/utils/ObjectPool', () => {
  class Dummy {
    constructor() {
      this.v = 0;
    }
    reset() {
      this.v = 0;
    }
  }

  test('acquire returns instances and release is tracked in stats', () => {
    const pool = new ObjectPool(Dummy, 2, 10);
    const obj = pool.acquire();
    expect(obj).toBeInstanceOf(Dummy);
    pool.release(obj);
    const stats = pool.getStats();
    expect(stats.acquisitions).toBeGreaterThanOrEqual(1);
    expect(stats.releases).toBeGreaterThanOrEqual(1);
  });

  test('expands beyond the initial size without throwing', () => {
    const pool = new ObjectPool(Dummy, 1, 5);
    const objs = [pool.acquire(), pool.acquire(), pool.acquire()];
    expect(objs.every((o) => o instanceof Dummy)).toBe(true);
  });
});

describe('src/ai/AIRecommendation', () => {
  test('getStats().averageScore is 0 (not NaN) with no recommendations', () => {
    const ai = new AIRecommendation();
    const stats = ai.getStats();
    expect(Number.isNaN(stats.averageScore)).toBe(false);
    expect(stats.averageScore).toBe(0);
    ai.dispose();
  });

  test('dispose() is safe with no active update loop', () => {
    const ai = new AIRecommendation();
    expect(() => ai.dispose()).not.toThrow();
  });
});

describe('src/vr/input/VoiceCommands', () => {
  test('constructs in a non-listening state', () => {
    const vc = new VoiceCommands();
    expect(vc.isListening).toBe(false);
  });
});
