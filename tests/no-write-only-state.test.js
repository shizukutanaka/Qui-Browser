/**
 * Write-only state sweep: `this._x` fields that are assigned but never read
 * are dead bookkeeping — state maintained for nobody. Measured 2026-09-20:
 *  - VRApp `_settingsBg` / `_settingsSections`: tracked for a disposal path
 *    that actually uses traverse() + _panelTextures — never read back
 *  - CaptionSystem `_dirty`: a skip-redraw flag that nothing ever checked —
 *    _draw() was called unconditionally wherever the flag was set
 * (An earlier version of this class of scan double-counted assignments as
 * reads; the regex below counts occurrences and writes separately.)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(p);
    } else if (e.name.endsWith('.js')) {
      yield p;
    }
  }
}

const bodies = [...walk(SRC)].map((p) => [p, fs.readFileSync(p, 'utf8')]);
const testBodies = fs
  .readdirSync(path.join(ROOT, 'tests'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => fs.readFileSync(path.join(ROOT, 'tests', f), 'utf8'));
const joined = bodies.map(([, s]) => s).join('\n') + '\n' + testBodies.join('\n');

const offenders = [];
for (const [p, src] of bodies) {
  const assigned = new Set();
  for (const m of src.matchAll(/this\.(_[a-zA-Z]\w*)\s*=(?!=)/g)) {
    assigned.add(m[1]);
  }
  for (const f of assigned) {
    // Reads: any `._f` site (this._f, panel._f, …) minus assignment writes.
    const total = (joined.match(new RegExp(`\\.${f}\\b`, 'g')) || []).length;
    const writes = (joined.match(new RegExp(`\\.${f}\\s*(?<![=!<>])=(?!=)`, 'g')) || []).length;
    if (total - writes === 0) {
      offenders.push(`${path.relative(ROOT, p)}: this.${f}`);
    }
  }
}

test('no this._field is written but never read', () => {
  expect(offenders).toEqual([]);
});
