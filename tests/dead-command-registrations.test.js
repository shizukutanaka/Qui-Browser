/**
 * Pin tests for the duplicate-command-registration defect (round 999).
 *
 * registerDefaultCommands() still carried the legacy pre-TabManager versions of
 * 'navigate'/'back'/'refresh'/'search' — window.history.forward/back(),
 * window.location.reload(), and a raw window.open google search. connectBrowser
 * later re-registers the same four keys with the real tabManager-driven
 * actions, and `commands` is a Map keyed by name, so the earlier entries are
 * clobbered before anything can reach them: dead code whose actions were also
 * wrong (window.history cannot drive the virtual tab stack).
 *
 * These pins assert each key is registered exactly once (the connectBrowser
 * version) and that the legacy window.* actions are gone from the file.
 */

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'vr', 'input', 'VoiceCommands.js'), 'utf8');

describe.each(['navigate', 'back', 'refresh', 'search'])("command '%s' is registered exactly once", (name) => {
  it('has a single registerCommand call', () => {
    const hits = SRC.split(`registerCommand('${name}'`).length - 1;
    expect(hits).toBe(1);
  });
});

describe('legacy window-level navigation actions are gone', () => {
  it.each(['window.history.back()', 'window.history.forward()', 'window.location.reload()'])(
    'no %s call remains',
    (call) => {
      expect(SRC).not.toContain(call);
    }
  );
});
