/**
 * Every path that discards the current page's in-flight fetch must actually
 * cancel it, not just make its result a no-op.
 *
 * The defect class, found three times in Session 75 続き22/23/24, each time by
 * missing the previous instance: `_loadReaderText` guards against a stale
 * fetch landing by bumping `_readerSeq` and comparing it on arrival, but that
 * guard only discards the RESULT. Left alone, the request itself kept running
 * — up to 5s of bandwidth on a mobile SoC headset — for a page nobody could
 * ever see the outcome of. `_loadUrl()` (a new navigation supersedes the old
 * one) and `dispose()` (the panel is gone) were fixed first; `_restorePage()`
 * (Back/Forward restoring a cached page) was missed in the same pass and only
 * found afterward — the same "found it three times before automating" pattern
 * as `tests/live-rebuild-capture.test.js` and `tests/i18n-coverage.test.js`.
 *
 * The invariant: every method that reassigns `this.currentUrl` to a new page
 * (making the previous page's fetch, if any, obsolete) — or is `dispose()`,
 * where the panel itself becomes obsolete — must abort `this._loadAbort`
 * before doing so. The target set is derived from the source rather than
 * hardcoded, the same discipline as the stale-capture scanner, so a future
 * method that starts reassigning `currentUrl` is covered automatically
 * instead of needing someone to remember to add it here.
 */

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'vr', 'browser', 'WebPanel.js'), 'utf8');

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

// Methods that make a page (or the whole panel) obsolete: every reassignment
// of `this.currentUrl` past its constructor initialisation, plus the one
// teardown method that doesn't touch currentUrl but ends the panel outright.
//
// The RHS is captured and filtered in JS rather than excluded with a regex
// lookahead: `this\.currentUrl\s*=\s*(?!'')` looks right but has a
// backtracking hole — `\s*` can give back the space between `=` and `''`,
// landing the lookahead on ` '` instead of `''` and letting the constructor's
// own `this.currentUrl  = '';` slip through as a false "reassigner". Caught
// by the very next test below, which is exactly why it asserts the derived
// set by name instead of only checking it's non-empty.
const CURRENT_URL_REASSIGNERS = [...new Set(
  [...SRC.matchAll(/this\.currentUrl\s*=\s*(\S.*?);/g)]
    .filter((m) => m[1] !== "''")
    .map((m) => enclosingMethod(m.index))
    .filter(Boolean)
)];
const OBSOLETING_METHODS = [...new Set([...CURRENT_URL_REASSIGNERS, 'dispose'])];

describe('methods that obsolete the current page/panel (derived from WebPanel.js)', () => {
  test('the derivation is non-vacuous — a parser regression must not pass silently', () => {
    expect(OBSOLETING_METHODS.length).toBeGreaterThan(0);
  });

  test('finds the three known reassigners: _loadUrl, _restorePage, and dispose', () => {
    // Pinned so a regex/indent change that silently narrows the scan is
    // caught here rather than by a fourth missed abort.
    expect(OBSOLETING_METHODS.sort()).toEqual(['_loadUrl', '_restorePage', 'dispose'].sort());
  });
});

describe('every obsoleting method aborts _loadAbort before proceeding', () => {
  for (const name of OBSOLETING_METHODS) {
    test(`${name}() checks and aborts this._loadAbort`, () => {
      const body = methodBody(name);
      const checksIt = /this\._loadAbort/.test(body);
      const abortsIt = /this\._loadAbort\.abort\(\)/.test(body);
      // Both conditions named separately: a method that reads _loadAbort but
      // never calls .abort() on it (e.g. only nulling the field) would pass a
      // bare "mentions it somewhere" check while still leaking the request —
      // exactly the shape this scanner exists to rule out.
      expect({ method: name, checksIt, abortsIt }).toEqual({ method: name, checksIt: true, abortsIt: true });
    });
  }
});
