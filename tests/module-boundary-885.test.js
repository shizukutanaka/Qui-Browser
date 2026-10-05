/**
 * Module-boundary invariants (round 885).
 *
 * Scope: only the files this round owns — curvedGeometry.js, urlDisplay.js,
 * videoProjection.js, settingsLayout.js, buttonStyle.js. angularSize.js keeps
 * its exports deliberately: it is the declared vocabulary of the target-size
 * audit (tests/target-size.test.js), a test seam in the same class as
 * tabSession.js — the helpers are terminal primitives, not composable
 * through any live export.
 *
 * Invariant checked here: a named export claims a cross-module boundary, so
 * every `export const|function|class X` must have at least one importer or
 * textual consumer in another src/ file. Symbols used only inside their own
 * file (helpers the live code calls internally) stay module-private.
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const MODULES = [
  'vr/browser/curvedGeometry.js',
  'vr/browser/urlDisplay.js',
  'vr/media/videoProjection.js',
  'vr/ui/settingsLayout.js',
  'vr/ui/buttonStyle.js'
];

const EXPORT_RE = /export\s+(?:const|function|class)\s+(\w+)/g;

function allSrcFiles(dir = SRC) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...allSrcFiles(p));
    } else if (e.name.endsWith('.js')) {
      out.push(p);
    }
  }
  return out;
}

function exportsOf(file) {
  const src = fs.readFileSync(file, 'utf8');
  const names = [];
  let m;
  while ((m = EXPORT_RE.exec(src)) !== null) {
    names.push(m[1]);
  }
  return names;
}

for (const rel of MODULES) {
  const file = path.join(SRC, rel);
  const others = allSrcFiles()
    .filter((f) => f !== file)
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n');

  describe(rel, () => {
    test('module exports at least one symbol', () => {
      expect(exportsOf(file).length).toBeGreaterThan(0);
    });

    test('every named export has a consumer in another src/ file', () => {
      for (const name of exportsOf(file)) {
        expect(others).toMatch(new RegExp(`\\b${name}\\b`));
      }
    });
  });
}

describe('module boundary — layout/internal constants stay module-private', () => {
  const FILE_FOR = {
    curvedPlaneData: 'vr/browser/curvedGeometry.js',
    parseDisplayUrl: 'vr/browser/urlDisplay.js',
    sphereParams: 'vr/media/videoProjection.js',
    COL_X: 'vr/ui/settingsLayout.js',
    TAB_GAP: 'vr/ui/settingsLayout.js',
    tabWidth: 'vr/ui/settingsLayout.js',
    worstCaseHeight: 'vr/ui/settingsLayout.js',
    BUTTON_BG: 'vr/ui/buttonStyle.js',
    BUTTON_BG_HOVER: 'vr/ui/buttonStyle.js',
    BUTTON_LINE: 'vr/ui/buttonStyle.js',
    BUTTON_LINE_HOVER: 'vr/ui/buttonStyle.js',
    BUTTON_BG_HC: 'vr/ui/buttonStyle.js',
    BUTTON_BG_HOVER_HC: 'vr/ui/buttonStyle.js',
    BUTTON_LINE_HC: 'vr/ui/buttonStyle.js',
    BUTTON_LINE_HOVER_HC: 'vr/ui/buttonStyle.js'
  };

  test('internal helpers are not exported', () => {
    for (const [name, rel] of Object.entries(FILE_FOR)) {
      const src = fs.readFileSync(path.join(SRC, rel), 'utf8');
      expect(src).not.toMatch(new RegExp(`export\\s+(?:const|function|class)\\s+${name}\\b`));
    }
  });

  test('parseDisplayUrl no longer computes a hasUserinfo field nothing reads', () => {
    const src = fs.readFileSync(path.join(SRC, 'vr/browser/urlDisplay.js'), 'utf8');
    expect(src).not.toMatch(/hasUserinfo/);
  });

  test('worstCaseHeight is gone — tests compose it from layoutSettingsPanel', () => {
    const src = fs.readFileSync(path.join(SRC, 'vr/ui/settingsLayout.js'), 'utf8');
    expect(src).not.toMatch(/worstCaseHeight/);
  });
});
