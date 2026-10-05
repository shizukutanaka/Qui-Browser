/**
 * Round-914 honesty: the shipped asset/CDN pipeline must only reference
 * resources that exist.
 *
 * `VRApp.loadAudioAssets` progressive-loaded four .mp3 files from
 * `/assets/sounds/` — but no .mp3 was ever committed (the directory shipped
 * a 7.3KB .gitkeep README listing ten "required" files). Every session
 * fired four guaranteed-404 requests through the service worker; the
 * sounds that actually play are synthesized by `registerProceduralBuffer`.
 *
 * `ProgressiveLoader` (651 lines) had exactly one production consumer —
 * that dead audio path. `index.html` preconnected to two CDNs nothing
 * fetches from.
 *
 * These tests pin the class: no phantom asset references, no dead loader
 * module, and the procedural audio path (what users actually hear)
 * survives intact.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VRAPP = fs.readFileSync(path.join(ROOT, 'src/vr/VRApp.js'), 'utf8');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

describe('phantom audio-asset pipeline removed', () => {
  test('VRApp no longer registers .mp3 resources from /assets/sounds/', () => {
    expect(VRAPP).not.toMatch(/assets\/sounds\//);
  });

  test('VRApp does not use ProgressiveLoader anywhere', () => {
    expect(VRAPP).not.toMatch(/[Pp]rogressive[Ll]oader/);
  });

  test('src/utils/ProgressiveLoader.js is gone (zero production consumers)', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/utils/ProgressiveLoader.js'))).toBe(false);
  });

  test('public/assets/sounds/ is gone (only ever held a placeholder doc)', () => {
    expect(fs.existsSync(path.join(ROOT, 'public/assets/sounds'))).toBe(false);
  });
});

describe('procedural audio path preserved', () => {
  test('VRApp still synthesizes the four interaction sounds', () => {
    expect(VRAPP).toMatch(/registerProceduralBuffer/);
    expect(VRAPP).toMatch(/\bclick\s*:/);
    expect(VRAPP).toMatch(/\bhover\s*:/);
    expect(VRAPP).toMatch(/\bsuccess\s*:/);
    expect(VRAPP).toMatch(/\berror\s*:/);
  });
});

describe('dead CDN preconnect hints removed', () => {
  test('index.html preconnects to no CDN hosts', () => {
    expect(INDEX).not.toMatch(/cdn\.jsdelivr\.net/);
    expect(INDEX).not.toMatch(/cdnjs\.cloudflare\.com/);
  });
});

describe('no test keeps the dead loader alive', () => {
  const testFiles = fs
    .readdirSync(path.join(ROOT, 'tests'))
    .filter((f) => f.endsWith('.test.js'))
    .filter((f) => f !== path.basename(__filename));

  test.each(testFiles)('%s neither imports nor requires ProgressiveLoader', (file) => {
    const code = fs.readFileSync(path.join(ROOT, 'tests', file), 'utf8');
    expect(code).not.toMatch(/(?:import|require)[^\n]*ProgressiveLoader/);
    expect(code).not.toMatch(/from\s+['"][^'"]*ProgressiveLoader/);
  });
});
