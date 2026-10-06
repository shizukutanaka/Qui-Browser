/**
 * Dead-public-surface audit — round 838 (same class as vr-dead-surface.test.js).
 *
 * These public methods were verified to have ZERO call sites anywhere in
 * src/ or tests/ (including optional-chained callers):
 *   - HapticFeedback.getPatterns()   — speculative introspection
 *   - HapticFeedback.test()          — manual debug helper, never invoked
 *   - HapticFeedback.resetStats()    — stats are read via getStats() only
 *   - LayersSystem.getLayer()        — callers hold the layer reference
 *                                      returned by createQuadLayer directly
 *   - JapaneseIME.deactivate()       — VRApp + VRJapaneseKeyboard only ever
 *                                      activate(); teardown goes through
 *                                      dispose()
 *
 * If any of these ever gains a real caller, restore it — until then the
 * surface stays minimal (YAGNI).
 */

import { HapticFeedback } from '../src/vr/interaction/HapticFeedback.js';
import { LayersSystem } from '../src/vr/rendering/LayersSystem.js';
import { JapaneseIME } from '../src/vr/input/JapaneseIME.js';

describe('dead public surface — HapticFeedback', () => {
  test('getPatterns is gone', () => {
    expect(HapticFeedback.prototype.getPatterns).toBeUndefined();
  });
  test('test is gone', () => {
    expect(HapticFeedback.prototype.test).toBeUndefined();
  });
  test('resetStats is gone', () => {
    expect(HapticFeedback.prototype.resetStats).toBeUndefined();
  });
});

describe('dead public surface — LayersSystem', () => {
  test('getLayer is gone', () => {
    expect(LayersSystem.prototype.getLayer).toBeUndefined();
  });
});

describe('dead public surface — JapaneseIME', () => {
  test('deactivate is gone', () => {
    expect(JapaneseIME.prototype.deactivate).toBeUndefined();
  });
  test('getState is gone (round 933 — zero callers after getStats wrapper went)', () => {
    expect(JapaneseIME.prototype.getState).toBeUndefined();
  });
});

describe('live surface pins', () => {
  test('HapticFeedback live methods remain', () => {
    const proto = HapticFeedback.prototype;
    for (const m of ['update', 'createCustomPattern', 'setEnabled', 'getStats']) {
      expect(typeof proto[m]).toBe('function');
    }
  });
  test('LayersSystem live methods remain', () => {
    const proto = LayersSystem.prototype;
    for (const m of [
      'initialize',
      'dispose',
      'createQuadLayer',
      'removeLayer',
      'renderCanvasToLayer',
      'updateRenderState'
    ]) {
      expect(typeof proto[m]).toBe('function');
    }
  });
  test('JapaneseIME live methods remain', () => {
    const proto = JapaneseIME.prototype;
    for (const m of ['activate', 'dispose', 'processInput', 'selectCandidate']) {
      expect(typeof proto[m]).toBe('function');
    }
  });
  test('LayersSystem.isSupported/count getters remain', () => {
    const desc = Object.getOwnPropertyDescriptor(LayersSystem.prototype, 'isSupported');
    expect(typeof desc.get).toBe('function');
    const desc2 = Object.getOwnPropertyDescriptor(LayersSystem.prototype, 'count');
    expect(typeof desc2.get).toBe('function');
  });
});
