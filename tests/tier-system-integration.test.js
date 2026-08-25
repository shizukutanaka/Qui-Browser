/**
 * Tier-system integration: the build's chunk tiers and the device tiers.
 *
 * `ci.yml` runs this file by name in its own job. The file did not exist, so
 * that job failed on every run — a red check that said nothing about the code.
 * Rather than add a stub to silence it, this covers the two things "tier
 * system" actually means here, and one of them has already broken the build
 * once.
 *
 * 1. **Build tiers.** `vite.config.js` splits the bundle with `manualChunks`,
 *    naming modules by path. Nothing verifies those paths resolve. When
 *    Session 74 deleted `ObjectPool` and `MixedReality`, their entries stayed
 *    behind and `npm run build` failed outright — invisible to `npm test`,
 *    because the unit suite never touches the build config. Session 75 removed
 *    three more modules and had to remember to edit the same list by hand.
 *
 * 2. **Device tiers.** `DeviceCompatibility._detectTier()` classifies the
 *    headset and `targetFPS()` turns that into a frame budget the whole render
 *    loop is paced by. A tier that falls through to the default silently ships
 *    a 72 FPS budget to a 120 Hz headset.
 */

const { readFileSync } = require('fs');
const { existsSync } = require('fs');
const { join } = require('path');

const ROOT = join(__dirname, '..');
const VITE_CONFIG = readFileSync(join(ROOT, 'vite.config.js'), 'utf8');

/** Parse the `manualChunks` map out of the config as {chunk: [paths]}. */
function manualChunks() {
  const block = VITE_CONFIG.match(/manualChunks:\s*\{([\s\S]*?)\n {8}\}/);
  if (!block) {
    throw new Error('could not locate manualChunks in vite.config.js');
  }
  const out = {};
  // Keys may be quoted or bare — Prettier drops the quotes from identifiers
  // like `tier1` but keeps them on hyphenated ones. Matching only the quoted
  // form silently skipped tier1 and made the checks below vacuous for it.
  for (const m of block[1].matchAll(/(?:'([\w-]+)'|([A-Za-z_$][\w$]*)):\s*\[([^\]]*)\]/g)) {
    out[m[1] || m[2]] = [...m[3].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  }
  return out;
}

describe('build tiers (vite manualChunks)', () => {
  const chunks = manualChunks();

  test('the config actually declares tiers', () => {
    // Guards the parser: a regex that matched nothing would make the rest of
    // this describe vacuously pass.
    expect(Object.keys(chunks).length).toBeGreaterThan(2);
    expect(chunks['vendor-three']).toEqual(['three']);
    // Named explicitly: tier1 is the chunk that actually regressed, and a
    // parser change that stopped seeing it would otherwise go unnoticed.
    expect(chunks.tier1).toBeDefined();
    expect(chunks.tier1.length).toBeGreaterThan(0);
  });

  test('every module named in a chunk exists on disk', () => {
    // This is the check that was missing when the build broke: a deleted
    // module left behind here fails `npm run build`, which `npm test` cannot
    // see because it never reads the build config.
    const missing = [];
    for (const [chunk, mods] of Object.entries(chunks)) {
      for (const mod of mods) {
        if (!mod.startsWith('/')) {
          continue; // a bare specifier such as 'three' resolves from node_modules
        }
        if (!existsSync(join(ROOT, mod))) {
          missing.push(`${chunk} -> ${mod}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  test('bare specifiers in chunks are real dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const mods of Object.values(chunks)) {
      for (const mod of mods.filter((m) => !m.startsWith('/'))) {
        expect(Object.keys(deps)).toContain(mod);
      }
    }
  });

  test('no module is assigned to two chunks at once', () => {
    const seen = new Map();
    for (const [chunk, mods] of Object.entries(chunks)) {
      for (const mod of mods) {
        expect(seen.has(mod) ? `${mod} in ${seen.get(mod)} and ${chunk}` : mod).toBe(mod);
        seen.set(mod, chunk);
      }
    }
  });

  test('every tiered module is actually imported by the app', () => {
    // A chunk entry for something nothing imports produces an empty chunk and
    // signals the module is dead — the shape that justified deleting three
    // subsystems in Session 75.
    const src = readFileSync(join(ROOT, 'src', 'vr', 'VRApp.js'), 'utf8')
      + readFileSync(join(ROOT, 'src', 'app.js'), 'utf8')
      + readFileSync(join(ROOT, 'src', 'main.js'), 'utf8');
    for (const mods of Object.values(chunks)) {
      for (const mod of mods.filter((m) => m.startsWith('/'))) {
        const base = mod.split('/').pop().replace(/\.js$/, '');
        expect(src.includes(base)).toBe(true);
      }
    }
  });
});

describe('device tiers (DeviceCompatibility)', () => {
  const { DeviceCompatibility } = require('../src/utils/DeviceCompatibility.js');

  /** User agents that must classify, and the tier each must reach. */
  const AGENTS = [
    ['Mozilla/5.0 (X11; Linux x86_64) OculusBrowser/33.0 Quest 3', 'quest3'],
    ['Mozilla/5.0 (X11; Linux x86_64) OculusBrowser/33.0 Quest/3', 'quest3'],
    ['Mozilla/5.0 (X11; Linux x86_64) OculusBrowser/28.0 Quest 2', 'quest2'],
    ['Mozilla/5.0 (X11; Linux x86_64) OculusBrowser/28.0 Quest/2', 'quest2'],
    ['Mozilla/5.0 (Linux; Android 12; Pico 4) PicoBrowser', 'pico4'],
    ['Mozilla/5.0 (Linux; Android 12; Pico Neo 4) PicoBrowser', 'pico4'],
    ['Mozilla/5.0 (Linux; Android 14; XR) Chrome', 'android-xr']
  ];

  test('every supported headset classifies to its own tier', () => {
    const dc = new DeviceCompatibility();
    for (const [ua, tier] of AGENTS) {
      expect(dc._detectTier(ua)).toBe(tier);
    }
  });

  test('an unknown agent does not masquerade as a headset', () => {
    const dc = new DeviceCompatibility();
    // No navigator.xr in the Jest environment, so this falls through.
    expect(['unknown', 'desktop-xr']).toContain(dc._detectTier('Some Random Bot/1.0'));
  });

  test('each tier maps to a frame budget its hardware can hold', () => {
    const expected = { quest3: 120, quest2: 90, pico4: 90 };
    for (const [tier, fps] of Object.entries(expected)) {
      const dc = new DeviceCompatibility();
      dc.report = { deviceTier: tier };
      expect(dc.targetFPS()).toBe(fps);
    }
  });

  test('an unclassified device gets the conservative budget, never the highest', () => {
    for (const tier of ['unknown', 'desktop-xr', 'android-xr', undefined]) {
      const dc = new DeviceCompatibility();
      dc.report = { deviceTier: tier };
      expect(dc.targetFPS()).toBe(72);
    }
    // No report at all (detect() never ran) must also be safe.
    expect(new DeviceCompatibility().targetFPS()).toBe(72);
  });

  test('every tier _detectTier can return has a targetFPS branch', () => {
    // A tier added to detection but forgotten in the FPS switch would silently
    // pace a 120 Hz headset at 72.
    const src = readFileSync(join(ROOT, 'src', 'utils', 'DeviceCompatibility.js'), 'utf8');
    const detected = new Set(
      [...src.matchAll(/return '([\w-]+)';/g)].map((m) => m[1])
        .filter((t) => /quest|pico|xr|unknown/.test(t))
    );
    for (const tier of detected) {
      const dc = new DeviceCompatibility();
      dc.report = { deviceTier: tier };
      expect(typeof dc.targetFPS()).toBe('number');
      expect(dc.targetFPS()).toBeGreaterThanOrEqual(72);
    }
  });
});
