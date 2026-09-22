/**
 * Dead-API pin: public methods with zero PRODUCTION call sites — no
 * `x.name(`, `x['name'](`, destructure, or callback wiring anywhere in
 * src/ (a full rescan including dynamic dispatch, 2026-09-20). Three of
 * them (WebPanel.goBack/goForward, WindowManager.setBillboard) were
 * exercised only by their own tests — the tests were repointed at the
 * live equivalents (back()/forward()) or deleted with the dead feature
 * (billboard mode: `this.billboard` was never set true by any caller).
 * BookmarkStore.removeHistory has since re-landed WITH a production call
 * site (BookmarkPanel's per-row delete zone in history mode), so it left
 * this registry. Public surface = a promise; an unkept promise is worse
 * than no promise.
 *
 * Measured 2026-09-20: 44 methods / ~1,400 lines across 12 files,
 * plus the whole ProgressiveLoader subsystem (~700 lines + suite).
 */
const fs = require('fs');
const path = require('path');

const DEAD = {
  'src/utils/PerformanceMonitor.js': ['reset', 'getReport', 'exportCSV'],
  'src/utils/TextureManager.js': ['loadTextures'],
  'src/vr/VRApp.js': ['makeToggleButton'],
  'src/vr/audio/SpatialAudio.js': ['setSourceOrientation', 'setSourceVelocity', 'setSourceVolume', 'createReverb', 'simulateDoppler', 'fadeVolume'],
  'src/vr/browser/WebPanel.js': ['goBack', 'goForward', 'onDomOverlayStart', 'onDomOverlayEnd'],
  'src/vr/browser/WindowManager.js': ['setBillboard', 'nudgeDistance'],
  'src/vr/comfort/ComfortSystem.js': ['getStatus', 'resize', 'render', 'handleSnapTurn', 'animateSnapTurn', 'updateFOV', 'setReducedMotion'],
  'src/vr/input/JapaneseIME.js': ['deactivate'],
  'src/vr/input/VoiceCommands.js': ['unregisterCommand', 'setLanguage'],
  'src/dev/DevTools.js': ['executeCode'],
  'src/vr/interaction/HapticFeedback.js': ['simulateForce', 'directionalPulse', 'playRhythm', 'getPatterns', 'resetStats', 'createCustomPattern', 'simulateTexture', 'simulateImpact', 'proximityFeedback', 'alert', 'playCustomSequence', 'test', 'getStats'],
  'src/vr/rendering/FFRSystem.js': ['setThresholds', 'setDynamicFFR', 'getStatus'],
  'src/vr/rendering/LayersSystem.js': ['getLayer']
};

for (const [file, names] of Object.entries(DEAD)) {
  const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  test.each(names)(`${file} — %s() stays deleted`, (name) => {
    const defRe = new RegExp(`^  (?:async\\s+)?${name}\\s*\\(`, 'm');
    expect(src).not.toMatch(defRe);
  });
}

/**
 * Dead-CALLER pin: deleting the definition isn't enough — callers that
 * invoked the deleted names through optional chaining (x.goBack?.())
 * degrade to silent no-ops and fool the DEAD registry, which only checks
 * that definitions stay gone. Exactly that escape happened with WebPanel's
 * browser-nav duplicates: four production call sites (VRApp face buttons,
 * VoiceCommands 進む/戻る) still said goBack/goForward, so every press
 * announced "no previous/next page" while doing nothing. Scan all of src/
 * for these tokens — a legit use of either name does not exist.
 */
function* walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      yield* walk(p);
    } else if (ent.name.endsWith('.js')) {
      yield p;
    }
  }
}

const SRC_DIR = path.join(__dirname, '..', 'src');
const srcFiles = [...walk(SRC_DIR)].map(f => path.relative(SRC_DIR, f));

test.each(srcFiles)('no src file references deleted nav names goBack/goForward — %s', (file) => {
  const src = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
  expect(src).not.toMatch(/\bgoBack\b|\bgoForward\b/);
});
