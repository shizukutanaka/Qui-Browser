/**
 * Every setting must be reachable by a real user — or be named here as
 * deliberately internal, with a reason.
 *
 * This exists because the same defect has now shipped three times, each found
 * by hand long after the fact:
 *
 *   - `enableWebPanel: false` gated the entire browsing feature area from the
 *     very first commit that introduced WebPanel. No control, no voice command,
 *     no persisted path could set it, so roughly 25 sessions of tabs, bookmarks,
 *     Layers and grab-to-move work were never once reached by a real user.
 *   - `enablePerfMonitorUI: false` gated a 694-line overlay class. Deleted in
 *     Session 75 rather than surfaced — nothing could turn it on and there was
 *     no reason to.
 *   - `enableVoice: false` gated voice commands, the primary modality for users
 *     who find gaze and controller input difficult. The usage guide told them
 *     to "enable Voice in settings"; there was nothing there.
 *
 * A unit test of the toggle's handler cannot catch this: the handler is fine,
 * it is the *absence of a caller* that is the bug. So this reads the source and
 * checks the two lists against each other, which is the only shape that fails
 * when someone adds a setting and forgets the control.
 */

const { readFileSync } = require('fs');
const { join } = require('path');

const SRC = readFileSync(join(__dirname, '..', 'src', 'vr', 'VRApp.js'), 'utf8');

/**
 * Settings a user is not meant to set directly. Each needs a reason: the point
 * of the list is that adding to it is a deliberate, reviewable act rather than
 * the silent default.
 */
const INTERNAL = {
  targetFPS: 'derived from device-tier detection, not a preference',
  enableHomeEnvironment: 'build-level flag; the home environment is the default scene',
  enableSettingsPanel: 'turning the settings panel off would make every other setting unreachable',
  controllerDeadZone: 'tuned per device by DeviceCompatibility; exposing raw axis maths is not a user concern'
};

function declaredSettings() {
  const m = SRC.match(/this\.settings = \{([\s\S]*?)\n {4}\};/);
  if (!m) {
    throw new Error('could not locate the settings object literal in VRApp.js');
  }
  return [...m[1].matchAll(/^ {6}(\w+):/gm)].map((x) => x[1]);
}

/** Keys any settings-panel control or explicit updateSetting call can write. */
function reachableSettings() {
  const keys = new Set();
  // makeToggleButton / makeStepperButton / makeCycleButton take the key second.
  for (const m of SRC.matchAll(/make(?:Compact)?(?:Toggle|Stepper|Cycle)Button\(\s*[^,]+,\s*'(\w+)'/g)) {
    keys.add(m[1]);
  }
  // Control definitions are also written as [label, 'key', …] tuples that the
  // section builder feeds to those factories.
  for (const m of SRC.matchAll(/\[\s*(?:t\([^)]*\)|'[^']*'),\s*'(\w+)',/g)) {
    keys.add(m[1]);
  }
  for (const m of SRC.matchAll(/updateSetting\('(\w+)'/g)) {
    keys.add(m[1]);
  }
  return keys;
}

describe('every setting is reachable by a user', () => {
  const declared = declaredSettings();
  const reachable = reachableSettings();

  test('the scan finds the settings object and some controls', () => {
    // Guards the test itself: a regex that silently matched nothing would make
    // every assertion below vacuously pass.
    expect(declared.length).toBeGreaterThan(20);
    expect(reachable.size).toBeGreaterThan(15);
  });

  test('no setting is gated behind a control that does not exist', () => {
    const orphans = declared.filter((k) => !reachable.has(k) && !INTERNAL[k]);
    expect(orphans).toEqual([]);
  });

  test('voice commands are reachable — the modality users may depend on', () => {
    // Called out by name because of who it affects: if gaze and controller are
    // both hard, voice is the way in, and it was switched off with no switch.
    expect(reachable.has('enableVoice')).toBe(true);
  });

  test('the browsing feature area is reachable', () => {
    expect(reachable.has('enableWebPanel')).toBe(true);
  });

  test('the internal list has not gone stale', () => {
    // A key listed as internal that no longer exists means the list is drifting
    // and will eventually excuse a real orphan by accident.
    // Every exemption must name a setting that actually exists, and must
    // genuinely be unreachable — an exemption for a key that HAS a control is
    // dead weight that would hide a real orphan if the control were removed.
    for (const k of Object.keys(INTERNAL)) {
      expect(declared).toContain(k);
      expect(reachable.has(k)).toBe(false);
    }
  });

  test('every internal exemption carries a reason', () => {
    for (const [k, why] of Object.entries(INTERNAL)) {
      expect(typeof why === 'string' && why.length > 20).toBe(true);
      expect(k).toBeTruthy();
    }
  });
});
