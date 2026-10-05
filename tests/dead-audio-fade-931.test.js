/**
 * Class-pinning test (round 931): `SpatialAudio.fadeVolume` is dead public
 * surface — zero call sites in src/, tools/, or index.html (the only
 * references are its own JSDoc usage line and the round-837 "live surface"
 * pin list, which now documents a method nothing calls).
 *
 * Same diff class as #1124 (dead public surface in this module): a method
 * whose only consumer is a JSDoc example is a promise of a capability that
 * does not exist. Removing it keeps the public surface honest.
 *
 * Invariants pinned:
 *   1. `SpatialAudio.prototype.fadeVolume` is gone.
 *   2. `fadeVolume(` appears nowhere in the shipped source corpus — a removal
 *      that accidentally leaves a dangling call site would blow up loudly
 *      here rather than at runtime.
 */

const fs = require('fs');
const path = require('path');

const { SpatialAudio } = require('../src/vr/audio/SpatialAudio.js');

const root = path.join(__dirname, '..');

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') {
      continue;
    }
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(p);
    } else if (/\.(js|mjs|cjs|html)$/.test(entry.name)) {
      yield p;
    }
  }
}

function corpus() {
  let text = '';
  for (const dir of ['src', 'public', 'tools', 'proxy']) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) {
      continue;
    }
    for (const file of walk(abs)) {
      text += fs.readFileSync(file, 'utf8') + '\n';
    }
  }
  text += fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  // Strip comments so doc examples ('audio.fadeVolume(...)' inside JSDoc)
  // can't masquerade as call sites.
  text = text.replace(/\/\*[\s\S]*?\*\//g, '');
  text = text
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  return text;
}

describe('SpatialAudio.fadeVolume dead surface', () => {
  test('the method is gone from the public surface', () => {
    const audio = new SpatialAudio();
    expect(audio.fadeVolume).toBeUndefined();
  });

  test('no call site or declaration of fadeVolume survives in the corpus', () => {
    const leaks = [];
    const body = corpus();
    if (/fadeVolume\s*\(/.test(body)) {
      leaks.push('a fadeVolume( reference survives');
    }
    expect(leaks).toEqual([]);
  });
});
