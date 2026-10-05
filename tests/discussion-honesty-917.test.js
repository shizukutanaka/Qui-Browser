/**
 * Honesty invariants — round 917.
 *
 * .github/DISCUSSION_TEMPLATES.md presented worked examples built on APIs and
 * features that do not exist (phantom-API class, same as deleted docs/API.md):
 * `VRMLGestureRecognition`, `VRGestureProfileManager`, custom gesture
 * recording, spatial anchors, gesture macros, an ML gesture model.
 * The i18n catalog also described removed/never-shipped surface in *live*
 * landing-page strings: the texture-loading pipeline (KTX2, removed in #1121)
 * and "12 gesture patterns" (HandTracking detects 6). `.prettierignore`
 * carried a `build/` entry although nothing in the repo emits a build dir
 * (same class as the `.dockerignore` sweep in #1202).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('.github/DISCUSSION_TEMPLATES.md honesty', () => {
  const doc = read('.github/DISCUSSION_TEMPLATES.md');

  const PHANTOMS = [
    /VRMLGesture/i,
    /VRGestureProfile/i,
    /VRGestureSystem/i,
    /VRSystemMonitor/i,
    /recordCustomGesture/i,
    /spatial\s+anchors?/i,
    /gesture\s+macros?/i,
    /Cannon\.js/i,
    /ML\s+model|machine\s+learning\s+model/i
  ];

  test.each(PHANTOMS)('names no phantom API or feature (%s)', (pattern) => {
    expect(doc).not.toMatch(pattern);
  });

  test('only references real gesture vocabulary', () => {
    // HandTracking.detectGesture emits exactly these names.
    const realGestures = ['pinch', 'point', 'open', 'fist', 'peace', 'thumbsup'];
    const mentioned = doc.match(/gesture[s]?\s*[:=]?\s*['`]([\w-]+)['`]/g) || [];
    for (const m of mentioned) {
      const name = m.match(/['`]([\w-]+)['`]/)[1];
      expect(realGestures).toContain(name);
    }
  });
});

describe('src/i18n/i18n.js catalog honesty', () => {
  const catalog = read('src/i18n/i18n.js');

  test('names no removed pipeline (KTX2/texture loading)', () => {
    expect(catalog).not.toMatch(/KTX2/i);
    expect(catalog).not.toMatch(/texture\s*manager/i);
  });

  test('claims the real gesture count, not 12', () => {
    const feat = catalog.match(/['"]feat\.hand\.desc['"]:\s*['"]([^'"]+)['"]/g) || [];
    for (const line of feat) {
      expect(line).not.toMatch(/\b12\b/);
    }
    expect(catalog).not.toMatch(/12\s*(種|gesture)/i);
  });
});

describe('.prettierignore honesty', () => {
  const ignore = read('.prettierignore');

  test('names no `build/` entry — nothing emits a build dir', () => {
    expect(ignore).not.toMatch(/^build\/?$/m);
  });

  test('every literal dir entry resolves to a real or known-generated path', () => {
    const generated = new Set(['node_modules', 'dist', 'coverage', 'logs', '.cache', '.vscode', '.idea']);
    const entries = ignore
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && /^\.?[\w-]+\/$/.test(l))
      .map((l) => l.replace(/\/$/, ''));
    for (const dir of entries) {
      const onDisk = fs.existsSync(path.join(ROOT, dir));
      expect(onDisk || generated.has(dir)).toBe(true);
    }
  });
});
