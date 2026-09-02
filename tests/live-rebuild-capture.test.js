/**
 * No subsystem may be captured by value across a live rebuild.
 *
 * The defect class, found in Session 75 続き16: connectBrowser({ tabManager,
 * bookmarkPanel }) captured those instances by value, while the enableWebPanel
 * toggle disposes them and builds new ones live. A user who turned browsing
 * off and on left 戻る / 進む / 更新 / ブックマーク addressing a disposed
 * TabManager — and the callbacks that read `this.tabManager` lazily used the
 * new one, so one voice command set drove two different browsers.
 *
 * A scan of VRApp.js found exactly one such capture. It now lives in a
 * designated rebind function that every rebuild path calls. This test keeps
 * it that way, and it derives the rebuildable set from the source rather than
 * a hardcoded list, so a subsystem that becomes live-rebuildable later is
 * covered automatically.
 *
 * Three invariants, in increasing order of how much they encode of that fix:
 *   1. which fields are rebuildable (built with `new`, nulled outside dispose)
 *   2. a rebuildable field is passed by value only inside a rebind function
 *   3. every function that rebuilds such a field CALLS the rebind function —
 *      because a rebind that nothing invokes is what my own first tests
 *      failed to notice, passing whether or not the call existed.
 */

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'vr', 'VRApp.js'), 'utf8');

/** Functions allowed to hold a by-value capture, because rebuilds re-run them. */
const REBIND_FUNCTIONS = ['_connectVoiceToBrowsing'];

/** Class-body method headers at 2-space indent: `  name(` or `  async name(`. */
const METHODS = [...SRC.matchAll(/\n  (?:async )?(_?[a-zA-Z]\w*)\s*\([^)]*\)\s*\{/g)]
  .map((m) => ({ name: m[1], start: m.index }));

function enclosingMethod(idx) {
  let best = null;
  for (const m of METHODS) {
    if (m.start < idx) {
      best = m.name;
    } else {
      break;
    }
  }
  return best;
}

function methodBody(name) {
  const i = METHODS.findIndex((m) => m.name === name);
  if (i === -1) {
    return '';
  }
  const end = i + 1 < METHODS.length ? METHODS[i + 1].start : SRC.length;
  return SRC.slice(METHODS[i].start, end);
}

/** Fields assigned `new X(` somewhere. */
const constructed = new Set(
  [...SRC.matchAll(/this\.(\w+)\s*=\s*new [A-Z]/g)].map((m) => m[1])
);

/** Fields assigned null in a function that is NOT dispose (i.e. a live teardown). */
const nulledLive = new Set(
  [...SRC.matchAll(/this\.(\w+)\s*=\s*null\b/g)]
    .filter((m) => {
      const fn = enclosingMethod(m.index);
      return fn && fn !== 'dispose' && fn !== 'constructor';
    })
    .map((m) => m[1])
);

const rebuildable = [...constructed].filter((f) => nulledLive.has(f)).sort();

/** `key: this.<rebuildable>,` — an instance handed to something else by value. */
const captures = [...SRC.matchAll(/\n\s+\w+\s*:\s*this\.(\w+)\s*,/g)]
  .filter((m) => rebuildable.includes(m[1]))
  .map((m) => ({ field: m[1], fn: enclosingMethod(m.index) }));

describe('live-rebuildable subsystems (derived from VRApp.js)', () => {
  test('the derivation finds the systems the browsing and voice toggles rebuild', () => {
    // Pinned so a silent parser regression (e.g. an indent change) cannot make
    // the rest of this file vacuously pass on an empty set.
    expect(rebuildable).toEqual(expect.arrayContaining(['tabManager', 'bookmarkPanel', 'voiceCommands']));
  });

  test('a field only nulled in dispose() is NOT rebuildable — dispose is terminal', () => {
    // vrKeyboard is built once and released only on dispose; passing it by
    // value is safe, and flagging it would be noise that gets ignored.
    expect(rebuildable).not.toContain('vrKeyboard');
  });
});

describe('by-value captures of rebuildable subsystems', () => {
  test('exist only inside a designated rebind function', () => {
    const stray = captures.filter((c) => !REBIND_FUNCTIONS.includes(c.fn));
    expect(stray).toEqual([]);
    // If this fails: `this.<field>` was handed to another object as a plain
    // value from `<fn>`. When the toggle that rebuilds <field> runs, that
    // object keeps the DISPOSED instance. Move the hand-off into a rebind
    // function that every rebuild path calls, or read the field lazily.
  });

  test('the rebind function really captures something (not vacuous)', () => {
    expect(captures.some((c) => REBIND_FUNCTIONS.includes(c.fn))).toBe(true);
  });
});

describe('every rebuild path calls the rebind function', () => {
  for (const rebind of REBIND_FUNCTIONS) {
    const fields = [...new Set(captures.filter((c) => c.fn === rebind).map((c) => c.field))];

    // Functions that build or tear down any of those fields, other than the
    // terminal dispose, the constructor, and the rebind function itself.
    const rebuilders = [...new Set(
      [...SRC.matchAll(/this\.(\w+)\s*=\s*(?:null\b|new [A-Z])/g)]
        .filter((m) => fields.includes(m[1]))
        .map((m) => enclosingMethod(m.index))
        .filter((fn) => fn && !['dispose', 'constructor', rebind].includes(fn))
    )].sort();

    test(`${rebind} captures ${fields.join(', ')} — rebuilt by ${rebuilders.join(', ')}`, () => {
      expect(rebuilders.length).toBeGreaterThan(0);
      for (const fn of rebuilders) {
        const body = methodBody(fn);
        // The call, not the method: a rebind nobody invokes is no rebind.
        expect({ fn, calls: body.includes(`this.${rebind}(`) }).toEqual({ fn, calls: true });
      }
    });
  }
});
