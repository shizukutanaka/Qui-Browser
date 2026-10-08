/**
 * Optional-subsystem constructor boundary pins.
 *
 * CLAUDE.md's known-issues table marks "optional subsystem init failures
 * silent" as fixed (toasts wired). In reality the try/catch + warn-toast +
 * null-degradation pattern only covers FFR, HapticFeedback, SemanticDOM,
 * SpatialAudio and LayersSystem. Seven sibling constructions still run
 * unguarded inside initializeSystems()/setupScene(): if any constructor
 * throws, the whole async initializeSystems() rejects, the fire-and-forget
 * this.initialize() call in the constructor drops the rejection, and the
 * render loop is never armed — a black screen with zero status message
 * (WCAG 4.1.3 Status Messages).
 *
 * Invariants:
 *  1. Every optional-subsystem construction sits inside a try block.
 *  2. The enclosing catch degrades to `this.<field> = null` (consumers all
 *     null-guard, so a failed subsystem must not leave a live-but-broken
 *     half-initialized instance behind).
 *  3. The catch reports the failure via showVRToast() with an i18n key —
 *     silent swallowing was the original defect class.
 *  4. Every `vr.error.*` key those catches reference exists in BOTH the en
 *     and ja catalogs (a miss renders an untranslated key string).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VRAPP = fs.readFileSync(path.join(ROOT, 'src/vr/VRApp.js'), 'utf8');
const I18N = fs.readFileSync(path.join(ROOT, 'src/i18n/i18n.js'), 'utf8');

// The subsystem constructions that must sit behind an error boundary.
// field: the instance property that the catch must null on failure.
const GUARDED = [
  { ctor: 'ComfortSystem', field: 'comfortSystem' },
  { ctor: 'JapaneseIME', field: 'japaneseIME' },
  { ctor: 'VRJapaneseKeyboard', field: 'vrKeyboard' },
  { ctor: 'HandTracking', field: 'handTracking' },
  { ctor: 'GazeInteraction', field: 'gazeInteraction' },
  { ctor: 'CaptionSystem', field: 'captionSystem' },
  { ctor: 'VoiceCommands', field: 'voiceCommands' },
  { ctor: 'ImmersiveVideo', field: 'immersiveVideo' }
];

/**
 * Minimal brace scanner: walks the source once and records, for every
 * `try {` block, its [openBraceIndex, closeBraceIndex] span plus the span of
 * its `catch` clause (from `catch` keyword to the end of its block).
 * Returns a list of { tryStart, tryEnd, catchStart, catchEnd }.
 */
function tryBlocks(source) {
  const blocks = [];
  const stack = []; // {isTry, index}
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    // skip line comments, block comments, and string literals so braces
    // inside them cannot corrupt the depth count
    if (ch === '/' && source[i + 1] === '/') {
      while (i < n && source[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch;
      i++;
      while (i < n && source[i] !== q) {
        if (source[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }
    if (ch === '{') {
      // is this brace directly preceded by the `try` keyword?
      let j = i - 1;
      while (j >= 0 && /\s/.test(source[j])) j--;
      const isTry = j >= 2 && source.slice(j - 2, j + 1) === 'try' && !/[A-Za-z0-9_$]/.test(source[j - 3] || '');
      stack.push({ isTry, index: i });
      i++;
      continue;
    }
    if (ch === '}') {
      const top = stack.pop();
      if (top && top.isTry) {
        // find the matching catch clause immediately after
        let j = i + 1;
        while (j < n && /\s/.test(source[j])) j++;
        let catchStart = -1,
          catchEnd = -1;
        if (source.slice(j, j + 5) === 'catch') {
          catchStart = j;
          // skip `catch (...) {` to the opening brace
          let k = j + 5;
          while (k < n && /\s/.test(source[k])) k++;
          if (source[k] === '(') {
            let depth = 0;
            while (k < n && (source[k] !== ')' || --depth > 0)) {
              if (source[k] === '(') depth++;
              k++;
            }
            k++;
          }
          while (k < n && /\s/.test(source[k])) k++;
          if (source[k] === '{') {
            let depth = 1;
            k++;
            while (k < n && depth > 0) {
              if (source[k] === '{') depth++;
              else if (source[k] === '}') depth--;
              k++;
            }
            catchEnd = k;
          }
        }
        blocks.push({ tryStart: top.index, tryEnd: i, catchStart, catchEnd });
      }
      i++;
      continue;
    }
    i++;
  }
  return blocks;
}

const BLOCKS = tryBlocks(VRAPP);

function enclosingTry(index) {
  return BLOCKS.find((b) => index > b.tryStart && index < b.tryEnd);
}

describe.each(GUARDED)('subsystem boundary: $ctor', ({ ctor, field }) => {
  const re = new RegExp(`new ${ctor}\\s*\\(`, 'g');
  const sites = [];
  let m;
  while ((m = re.exec(VRAPP))) sites.push(m.index);

  test('construction sites exist', () => {
    expect(sites.length).toBeGreaterThan(0);
  });

  test('every construction site sits inside a try block', () => {
    for (const idx of sites) {
      const blk = enclosingTry(idx);
      expect(blk).toBeDefined();
      expect(blk.catchStart).toBeGreaterThan(-1);
    }
  });

  test(`enclosing catch degrades ${ctor} to this.${field} = null`, () => {
    for (const idx of sites) {
      const blk = enclosingTry(idx);
      if (!blk || blk.catchStart < 0) continue;
      const catchText = VRAPP.slice(blk.catchStart, blk.catchEnd);
      expect(catchText).toContain(`this.${field} = null`);
    }
  });

  test('enclosing catch reports the failure via showVRToast()', () => {
    for (const idx of sites) {
      const blk = enclosingTry(idx);
      if (!blk || blk.catchStart < 0) continue;
      const catchText = VRAPP.slice(blk.catchStart, blk.catchEnd);
      expect(catchText).toMatch(/showVRToast\(/);
    }
  });
});

describe('error keys used by the boundary catches exist in both catalogs', () => {
  const keys = new Set();
  for (const { ctor } of GUARDED) {
    const re = new RegExp(`new ${ctor}\\s*\\(`, 'g');
    let m;
    while ((m = re.exec(VRAPP))) {
      const blk = enclosingTry(m.index);
      if (!blk || blk.catchStart < 0) continue;
      const catchText = VRAPP.slice(blk.catchStart, blk.catchEnd);
      for (const km of catchText.matchAll(/t\('(vr\.error\.[A-Za-z]+)'\)/g)) {
        keys.add(km[1]);
      }
    }
  }

  test('at least one boundary catch key is referenced', () => {
    expect(keys.size).toBeGreaterThan(0);
  });

  test.each([...keys])('"%s" is defined in both en and ja catalogs', (key) => {
    const occurrences = I18N.split(`'${key}':`).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });
});
