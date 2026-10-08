/**
 * Volume boundary honesty (WCAG 4.1.3 / honest feedback).
 *
 * 'volume up' at the 100% ceiling and 'volume down' at the 0% floor must
 * announce that nothing changed — the host handler reports "no change" via
 * its return value, so the announce can reflect what actually happened.
 * Sibling steppers (caption-size-up/down) already do this via null = at limit.
 * No SpeechRecognition/Synthesis needed: command dispatch is driven directly.
 */

const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

describe('voice volume boundary — announce reflects the applied result', () => {
  let vc, spoken;
  beforeEach(() => {
    vc = new VoiceCommands(); // synthesis stays null; onSpeak mirrors to captions
    spoken = [];
    vc.callbacks.onSpeak = (t) => spoken.push(t);
  });

  test("'volume up' at the ceiling does not claim the volume was raised", () => {
    vc._onVolume = () => null; // host: clamped to the ceiling, nothing applied
    vc.processCommand('volume up', 0.9);
    expect(spoken).not.toContain('音量を上げます');
    expect(spoken.some((s) => /上げられません/.test(s))).toBe(true);
  });

  test("'volume down' at the floor does not claim the volume was lowered", () => {
    vc._onVolume = () => null;
    vc.processCommand('volume down', 0.9);
    expect(spoken).not.toContain('音量を下げます');
    expect(spoken.some((s) => /下げられません/.test(s))).toBe(true);
  });

  test("'volume up' with headroom announces the level actually applied", () => {
    vc._onVolume = () => 70;
    vc.processCommand('volume up', 0.9);
    expect(spoken.some((s) => /70%/.test(s))).toBe(true);
  });

  test("'volume down' with headroom announces the level actually applied", () => {
    vc._onVolume = () => 30;
    vc.processCommand('volume down', 0.9);
    expect(spoken.some((s) => /30%/.test(s))).toBe(true);
  });

  test('an unwired host lands on the boundary path, not a false confirmation', () => {
    vc._onVolume = null;
    vc.processCommand('volume up', 0.9);
    expect(spoken).not.toContain('音量を上げます');
    expect(spoken.some((s) => /上げられません/.test(s))).toBe(true);
  });
});
