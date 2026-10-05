import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const doc = readFileSync(join(__dirname, '../docs/IMPLEMENTATION.md'), 'utf8');
const workflows = '.github/workflows';

describe('IMPLEMENTATION.md references real surfaces', () => {
  test('every **File**: path in the doc exists in the repo (or is marked unshipped)', () => {
    const fileRefs = [...doc.matchAll(/\*\*File\*\*: `([^`]+)`/g)].map((m) => m[1]);
    expect(fileRefs.length).toBeGreaterThan(0);
    const missing = fileRefs.filter((p) => !existsSync(join(__dirname, '..', p)));
    // Sections may prescribe files that were never shipped or were deleted;
    // those must be flagged rather than presented as live code.
    const unshipped = missing.filter((p) => {
      const idx = doc.indexOf(p);
      const section = doc.slice(Math.max(0, idx - 800), idx);
      return /not shipped|deleted/i.test(section);
    });
    expect(missing).toEqual(unshipped);
  });

  test('moved paths point at src/vr/', () => {
    expect(doc).toContain('src/vr/input/JapaneseIME.js');
    expect(doc).toContain('src/vr/interaction/HandTracking.js');
    expect(doc).toContain('src/vr/audio/SpatialAudio.js');
    expect(doc).not.toContain('`src/input/JapaneseIME.js`');
    expect(doc).not.toContain('`src/input/HandTracking.js`');
    expect(doc).not.toContain('`src/audio/SpatialAudio.js`');
  });

  test('deleted code recipes are marked unshipped, not silent prescriptions', () => {
    for (const heading of ['### 3. Object Pooling', '### 4. KTX2 Texture Compression']) {
      const idx = doc.indexOf(heading);
      expect(doc.slice(idx, idx + 400)).toMatch(/not shipped|deleted/i);
    }
  });

  test('live recipe files still resolve', () => {
    for (const p of ['src/vr/rendering/FFRSystem.js', 'src/vr/comfort/ComfortSystem.js', 'public/service-worker.js']) {
      expect(existsSync(join(__dirname, '..', p))).toBe(true);
      expect(doc).toContain(p);
    }
  });
});
