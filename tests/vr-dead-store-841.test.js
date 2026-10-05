/**
 * Dead-store audit (round 841): fields and constructor options that were
 * assigned but never read. Removal is behaviour-preserving — nothing could
 * have depended on a value nothing consumed.
 *
 *  - VRControllerInput.southpaw: the option claimed to "swap left/right stick
 *    roles" but no code path ever read the stored flag; the live swap is
 *    implemented by VRApp's own hand mapping (settings.southpaw).
 *  - VRApp._settingsSections / _settingsBg: stored panel references never read
 *    back (teardown traverses the panel group's children instead).
 *
 * (VoiceCommands.fallbackLanguage and VRJapaneseKeyboard.candidatePanel were
 * the same class, removed in round 905 — tests/vr-dead-store-905.test.js.)
 */

import { VRControllerInput } from '../src/vr/input/VRControllerInput.js';

describe('VRControllerInput option surface', () => {
  test('deadZone remains the only tuning option', () => {
    const ci = new VRControllerInput({ deadZone: 0.2, southpaw: true });
    expect(ci.deadZone).toBe(0.2);
    // southpaw was a stored-but-never-read option; passing it is ignored.
    expect('southpaw' in ci).toBe(false);
  });

  test('live input surface intact (detectFamily/getDeviceName/read/forget)', () => {
    const ci = new VRControllerInput();
    for (const m of ['detectFamily', 'getDeviceName', 'read', 'forget']) {
      expect(typeof ci[m]).toBe('function');
    }
  });
});
