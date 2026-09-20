/**
 * Dead-API pin: public methods with zero PRODUCTION call sites — no
 * `x.name(`, `x['name'](`, destructure, or callback wiring anywhere in
 * src/ (a full rescan including dynamic dispatch, 2026-09-20). Three of
 * them (WebPanel.goBack/goForward, WindowManager.setBillboard,
 * BookmarkStore.removeHistory) were exercised only by their own tests —
 * the tests were repointed at the live equivalents (back()/forward())
 * or deleted with the dead feature (billboard mode: `this.billboard`
 * was never set true by any caller). Public surface = a promise; an
 * unkept promise is worse than no promise.
 *
 * Measured 2026-09-20: 27 methods / ~400 lines across 13 files.
 */
const fs = require('fs');
const path = require('path');

const DEAD = {
  'src/utils/BookmarkStore.js': ['removeHistory'],
  'src/utils/PerformanceMonitor.js': ['reset'],
  'src/utils/ProgressiveLoader.js': ['loadOnDemand', 'preload'],
  'src/vr/VRApp.js': ['makeToggleButton'],
  'src/vr/audio/SpatialAudio.js': ['setSourceOrientation', 'setSourceVelocity', 'setSourceVolume', 'createReverb'],
  'src/vr/browser/WebPanel.js': ['goBack', 'goForward', 'onDomOverlayStart', 'onDomOverlayEnd'],
  'src/vr/browser/WindowManager.js': ['setBillboard', 'nudgeDistance'],
  'src/vr/comfort/ComfortSystem.js': ['getStatus', 'resize'],
  'src/vr/input/JapaneseIME.js': ['deactivate'],
  'src/vr/input/VoiceCommands.js': ['unregisterCommand', 'setLanguage'],
  'src/vr/interaction/HapticFeedback.js': ['simulateForce', 'directionalPulse', 'playRhythm', 'getPatterns', 'resetStats'],
  'src/vr/rendering/FFRSystem.js': ['setThresholds'],
  'src/vr/rendering/LayersSystem.js': ['getLayer'],
};

for (const [file, names] of Object.entries(DEAD)) {
  const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  test.each(names)(`${file} — %s() stays deleted`, (name) => {
    const defRe = new RegExp(`^  (?:async\\s+)?${name}\\s*\\(`, 'm');
    expect(src).not.toMatch(defRe);
  });
}
