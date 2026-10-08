/**
 * Wake-word window must slide on continued activity.
 *
 * handleRecognitionResult arms a 5s sleep timer after EVERY processed final
 * result — but never cleared the previous timer. Two commands 4s apart left
 * the first timer to fire at t=5s and put the mic back to sleep while the
 * user was mid-conversation: the third utterance at t=5.5s was treated as
 * asleep and demanded the wake word again.
 */

const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeEvent(transcript, confidence, isFinal = true) {
  const result = { 0: { transcript, confidence }, isFinal, length: 1 };
  return { results: { 0: result, length: 1 } };
}

describe('VoiceCommands — wake-word window slides on continued activity', () => {
  let vc;

  beforeEach(() => {
    jest.useFakeTimers();
    vc = new VoiceCommands();
    vc.callbacks.onSpeak = () => {};
    vc.settings.requireWakeWord = true;
    vc.isAwake = true;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('commands 4s apart keep the session awake past the first 5s mark', () => {
    vc.handleRecognitionResult(makeEvent('X', 0.9, true));
    jest.advanceTimersByTime(4000);
    vc.handleRecognitionResult(makeEvent('X', 0.9, true));
    jest.advanceTimersByTime(1500); // t=5.5s — first stacked timer already fired
    expect(vc.isAwake).toBe(true); // pre-fix: false — wrongly slept mid-conversation
  });

  test('the window still closes 5s after the LAST command, not the first', () => {
    vc.handleRecognitionResult(makeEvent('X', 0.9, true));
    jest.advanceTimersByTime(4000);
    vc.handleRecognitionResult(makeEvent('X', 0.9, true));
    jest.advanceTimersByTime(5001); // t=9.001s
    expect(vc.isAwake).toBe(false);
  });

  test('a lone command still ends the window at 5s', () => {
    vc.handleRecognitionResult(makeEvent('X', 0.9, true));
    jest.advanceTimersByTime(4999);
    expect(vc.isAwake).toBe(true);
    jest.advanceTimersByTime(1);
    expect(vc.isAwake).toBe(false);
  });

  test('re-arming clears the previous timer instead of stacking', () => {
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    vc.handleRecognitionResult(makeEvent('X', 0.9, true));
    vc.handleRecognitionResult(makeEvent('X', 0.9, true));
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
