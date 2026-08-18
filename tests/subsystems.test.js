/**
 * Unit tests for dependency-free src/ subsystems of the live v2.0.0 app.
 * These exercise real conversion/clamping/queue logic (not just construction).
 */
const { JapaneseIME, candidateStyle } = require('../src/vr/input/JapaneseIME.js');
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

  // Syllabic ん ('n') — the classic romaji-IME ambiguity. A lone 'n' must not be
  // consumed as ん before a vowel/y that would form the な/にゃ rows.
  test('converts the な-row (n + vowel), not ん + vowel', () => {
    expect(ime.convertRomajiToHiragana('na')).toBe('な');
    expect(ime.convertRomajiToHiragana('ni')).toBe('に');
    expect(ime.convertRomajiToHiragana('nu')).toBe('ぬ');
    expect(ime.convertRomajiToHiragana('ne')).toBe('ね');
    expect(ime.convertRomajiToHiragana('no')).toBe('の');
  });

  test('converts the にゃ-row (n + y + vowel)', () => {
    expect(ime.convertRomajiToHiragana('nya')).toBe('にゃ');
    expect(ime.convertRomajiToHiragana('nyu')).toBe('にゅ');
    expect(ime.convertRomajiToHiragana('nyo')).toBe('にょ');
  });

  test('"nn" collapses to a single ん', () => {
    expect(ime.convertRomajiToHiragana('nn')).toBe('ん');
  });

  test('"nn" + vowel is ん + な-row (nna → んな, nni → んに)', () => {
    expect(ime.convertRomajiToHiragana('nna')).toBe('んな');
    expect(ime.convertRomajiToHiragana('nni')).toBe('んに');
  });

  test('n before a consonant becomes ん (sankaku → さんかく)', () => {
    expect(ime.convertRomajiToHiragana('sankaku')).toBe('さんかく');
  });

  test('a trailing n becomes ん (hon → ほん)', () => {
    expect(ime.convertRomajiToHiragana('hon')).toBe('ほん');
  });

  test('typing "konnichiha" yields こんにちは (was こんんいちは)', () => {
    expect(ime.convertRomajiToHiragana('konnichiha')).toBe('こんにちは');
  });

  test('ん combines with a following sokuon (ganbatte → がんばって)', () => {
    expect(ime.convertRomajiToHiragana('ganbatte')).toBe('がんばって');
  });

  test('incremental composition: lone n shows ん, then resolves to な with the vowel', () => {
    // processInput appends and reconverts the whole buffer each keystroke, so a
    // transient ん after the first 'n' must resolve to な once the vowel arrives.
    expect(ime.convertRomajiToHiragana('n')).toBe('ん');  // mid-composition
    expect(ime.convertRomajiToHiragana('na')).toBe('な'); // after the vowel
  });

  test('converts hiragana to katakana', () => {
    expect(ime.convertHiraganaToKatakana('あいうえお')).toBe('アイウエオ');
  });

  test('な-row fix carries through to katakana (na → ナ)', () => {
    const hira = ime.convertRomajiToHiragana('na');
    expect(ime.convertHiraganaToKatakana(hira)).toBe('ナ');
  });

  // Sokuon edge cases: 'cc' before 'ch', and the 'tch' variant form.
  test('"cc" before ch is sokuon (ecchi → えっち, kocchi → こっち)', () => {
    expect(ime.convertRomajiToHiragana('ecchi')).toBe('えっち');
    expect(ime.convertRomajiToHiragana('kocchi')).toBe('こっち');
  });

  test('"tch" is also a sokuon form (matcha → まっちゃ)', () => {
    expect(ime.convertRomajiToHiragana('matcha')).toBe('まっちゃ');
  });

  test('"tchi" and "tchu" also resolve (dotchi → どっち, itchi → いっち)', () => {
    expect(ime.convertRomajiToHiragana('dotchi')).toBe('どっち');
    expect(ime.convertRomajiToHiragana('itchi')).toBe('いっち');
  });
});

describe('candidateStyle — primary candidate not signalled by colour alone', () => {
  test('every candidate gets a 1-based order number', () => {
    expect(candidateStyle(0).number).toBe('1');
    expect(candidateStyle(1).number).toBe('2');
    expect(candidateStyle(7).number).toBe('8');
  });

  test('primary candidate also carries a heavier border (shape cue, not hue)', () => {
    expect(candidateStyle(0).lineWidth).toBeGreaterThan(candidateStyle(1).lineWidth);
  });

  test('non-primary candidates share one weight so only #1 stands out', () => {
    expect(candidateStyle(1).lineWidth).toBe(candidateStyle(5).lineWidth);
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

  test('getStats() reports 0.0% (not NaN) before any resource is queued', () => {
    const loader = new ProgressiveLoader();
    const stats = loader.getStats();
    expect(stats.progressPercent).toBe('0.0');
    expect(Number.isNaN(parseFloat(stats.progressPercent))).toBe(false);
  });
});
