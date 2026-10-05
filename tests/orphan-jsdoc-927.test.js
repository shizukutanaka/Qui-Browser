/**
 * Orphan-JSDoc honesty pin (round 927).
 *
 * A `/** ... *\/` block is documentation attached to the code that follows it.
 * When a refactor inserts a new function (or a second doc comment) between a
 * doc and its subject, the doc is left stranded: it describes something that
 * is not there, or duplicates the doc beneath it. Both are dead doc surface —
 * the same honesty class as dead exports (#1165–#1172) and dead params
 * (#1206, #1212).
 *
 * Invariant: in the audited files, every JSDoc block after the file's first
 * doc must be followed by code, never by another `/**`. (The first doc is
 * exempt: a module-description doc may legitimately precede the first item's
 * doc — an established convention in this codebase, e.g. curvedGeometry.js.)
 *
 * Audited files only — VRApp.js owns four of its own stacked docs and is
 * covered by open PRs (#1206/#1207), so it is not scanned here.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const AUDITED = [
  'src/vr/browser/WebPanel.js',
  'src/vr/accessibility/CaptionSystem.js',
  'src/vr/comfort/ComfortSystem.js',
  'src/vr/input/JapaneseIME.js'
];

function orphanDocs(src) {
  const orphans = [];
  const docRe = /\/\*\*[\s\S]*?\*\//g;
  let m;
  let first = true;
  while ((m = docRe.exec(src))) {
    const isFirst = first;
    first = false;
    const after = src.slice(docRe.lastIndex).match(/^\s*/)[0];
    const next = src.slice(docRe.lastIndex + after.length, docRe.lastIndex + after.length + 3);
    if (!isFirst && next.startsWith('/**')) {
      orphans.push(src.slice(0, m.index).split('\n').length);
    }
  }
  return orphans;
}

describe('orphan JSDoc honesty', () => {
  test.each(AUDITED)('%s has no doc block stranded above another doc', (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const orphans = orphanDocs(src);
    expect(orphans).toEqual([]);
  });
});
