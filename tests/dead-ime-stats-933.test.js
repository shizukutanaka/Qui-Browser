const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JapaneseIME, VRJapaneseKeyboard } = require('../src/vr/input/JapaneseIME.js');

/**
 * Dead diagnostics surface — round 933.
 *
 * `VRJapaneseKeyboard.getStats()` delegated to `JapaneseIME.getState().stats`;
 * both had ZERO call sites anywhere in src/, tests/, tools/, or index.html —
 * an introspection surface nothing ever invoked (same class as
 * VoiceCommands.getStats / HandTracking.getStats in round 840 and
 * SpatialAudio.fadeVolume in round 931). `getState()` was only consumed by the
 * dead getStats wrapper, so the whole read surface goes together. The
 * write-side stats bookkeeping stays — accumulating counters is harmless
 * (dead-store removal is a different, rejected class).
 */
describe('IME diagnostics surface removed (round 933)', () => {
  test('VRJapaneseKeyboard.getStats is gone', () => {
    expect(VRJapaneseKeyboard.prototype.getStats).toBeUndefined();
  });
  test('JapaneseIME.getState is gone', () => {
    expect(JapaneseIME.prototype.getState).toBeUndefined();
  });
});

describe('corpus references no IME stats surface (round 933)', () => {
  const SKIP = new Set(['node_modules', '.git', 'dist', 'scripts']);
  const EXT = /\.(js|mjs|cjs|html)$/;
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(e.name)) {
        continue;
      }
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(p);
      } else if (EXT.test(e.name)) {
        files.push(p);
      }
    }
  };
  walk(ROOT);
  const corpus = files
    .filter((f) => !f.includes(path.sep + 'tests' + path.sep) && !f.endsWith('JapaneseIME.js'))
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  test('no getState/getStats call sites survive outside JapaneseIME.js', () => {
    const failures = [];
    for (const m of ['getState', 'getStats']) {
      for (const recv of ['ime', 'japaneseIME', 'vrKeyboard', 'keyboard', 'japaneseKeyboard']) {
        if (new RegExp(`${recv}(\\?\\.)?\\.${m}\\s*\\(`).test(corpus)) {
          failures.push(`corpus still calls ${recv}.${m}()`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
