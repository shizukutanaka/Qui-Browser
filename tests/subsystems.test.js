/**
 * Unit tests for dependency-free src/ subsystems of the live v2.0.0 app.
 * These exercise real conversion/clamping/queue logic (not just construction).
 */
const { JapaneseIME } = require('../src/vr/input/JapaneseIME.js');
const { FFRSystem } = require('../src/vr/rendering/FFRSystem.js');
const { ProgressiveLoader } = require('../src/utils/ProgressiveLoader.js');

describe('src/vr/input/JapaneseIME', () => {
  const ime = new JapaneseIME();

  test('converts basic romaji vowels to hiragana', () => {
    expect(ime.convertRomajiToHiragana('aiueo')).toBe('あいうえお');
  });

  test('converts multi-mora romaji to hiragana', () => {
    expect(ime.convertRomajiToHiragana('sakura')).toBe('さくら');
  });

  test('handles sokuon (double consonant) as っ', () => {
    expect(ime.convertRomajiToHiragana('kka')).toBe('っか');
  });

  test('converts hiragana to katakana', () => {
    expect(ime.convertHiraganaToKatakana('あいうえお')).toBe('アイウエオ');
  });
});

describe('src/vr/rendering/FFRSystem', () => {
  test('enable() before initialization is a safe no-op (does not throw)', () => {
    const ffr = new FFRSystem();
    expect(() => ffr.enable(0.8)).not.toThrow();
    expect(ffr.projectionLayer).toBeFalsy();
  });

  test('enable() clamps intensity into [0, 1] and writes fixedFoveation', () => {
    const ffr = new FFRSystem();
    // Simulate a ready WebXR projection layer.
    ffr.enabled = true;
    ffr.projectionLayer = { fixedFoveation: 0 };

    ffr.enable(2.0);
    expect(ffr.intensity).toBe(1);
    expect(ffr.projectionLayer.fixedFoveation).toBe(1);

    ffr.enable(-1);
    expect(ffr.intensity).toBe(0);
    expect(ffr.projectionLayer.fixedFoveation).toBe(0);

    ffr.enable(0.5);
    expect(ffr.projectionLayer.fixedFoveation).toBeCloseTo(0.5);
  });

  test('disable() sets fixedFoveation to 0', () => {
    const ffr = new FFRSystem();
    ffr.enabled = true;
    ffr.projectionLayer = { fixedFoveation: 0.7 };
    ffr.disable();
    expect(ffr.projectionLayer.fixedFoveation).toBe(0);
  });

  test('adjustIntensity() nudges intensity and clamps to [0,1]', () => {
    const ffr = new FFRSystem();
    ffr.enabled = true;
    ffr.projectionLayer = { fixedFoveation: 0 };
    ffr.intensity = 0.5;

    ffr.adjustIntensity(0.2);
    expect(ffr.intensity).toBeCloseTo(0.7);

    ffr.adjustIntensity(0.5); // would overshoot to 1.2
    expect(ffr.intensity).toBe(1);

    ffr.adjustIntensity(-2); // would undershoot
    expect(ffr.intensity).toBe(0);
  });

  test('trackHeadPose() → updatePredictedGazeFoveation() adjusts intensity', () => {
    const ffr = new FFRSystem();
    ffr.enabled = true;
    ffr.projectionLayer = { fixedFoveation: 0.5 };
    ffr.intensity = 0.5;

    const identity = { x: 0, y: 0, z: 0, w: 1 };

    // Two identical quaternions → angular velocity 0 → still head → high FFR.
    ffr.trackHeadPose(identity, 0.016);
    ffr.trackHeadPose(identity, 0.016);
    ffr.updatePredictedGazeFoveation();
    // intensity should drift toward 0.8 (still head).
    expect(ffr.intensity).toBeGreaterThan(0.5);
  });

  test('trackHeadPose() reuses the prev-quaternion object (no per-frame alloc)', () => {
    const ffr = new FFRSystem();
    ffr.trackHeadPose({ x: 0, y: 0, z: 0, w: 1 }, 0.016);
    const ref = ffr._prevHeadQuat;
    ffr.trackHeadPose({ x: 0, y: 0.1, z: 0, w: 0.99 }, 0.016);
    // Same object instance, mutated in place rather than reallocated.
    expect(ffr._prevHeadQuat).toBe(ref);
    expect(ffr._prevHeadQuat.y).toBeCloseTo(0.1, 5);
  });
});

describe('src/utils/ProgressiveLoader', () => {
  test('addResource routes to the requested priority queue and updates stats', () => {
    const loader = new ProgressiveLoader();
    const item = loader.addResource({ url: 'a.png', size: 100 }, 'critical');

    expect(item.priority).toBe('critical');
    expect(loader.loadQueue.critical).toHaveLength(1);
    expect(loader.stats.itemsTotal).toBe(1);
    expect(loader.stats.totalBytes).toBe(100);
  });

  test('addResource defaults to the secondary queue', () => {
    const loader = new ProgressiveLoader();
    loader.addResource({ url: 'b.js' });
    expect(loader.loadQueue.secondary).toHaveLength(1);
    expect(loader.loadQueue.critical).toHaveLength(0);
  });
});
