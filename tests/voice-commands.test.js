/**
 * Unit tests for VoiceCommands cross-modal feedback (FR-13.1).
 * Spoken responses must also reach the onSpeak callback so the host can mirror
 * them to captions — a user who can speak but not hear still needs to see
 * whether a command was understood. No SpeechRecognition/Synthesis is needed:
 * the command-matching and speak() paths are exercised directly.
 */

const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

describe('VoiceCommands — spoken feedback is mirrored for captions', () => {
  let vc, spoken;
  beforeEach(() => {
    vc = new VoiceCommands();        // synthesis stays null (not initialized)
    spoken = [];
    vc.callbacks.onSpeak = (t) => spoken.push(t);
  });

  test('speak() invokes onSpeak even when TTS is unavailable', () => {
    expect(vc.synthesis).toBeNull();
    vc.speak('はい、聞いています');
    expect(spoken).toEqual(['はい、聞いています']);
  });

  test('a matched command mirrors its confirmation text', () => {
    vc.registerCommand('greet', {
      patterns: ['hello'],
      action: () => ({ ok: true }),
      confirmationText: 'hi there'
    });
    vc.processCommand('hello', 0.9);
    expect(spoken).toContain('hi there');
  });

  test('an unrecognized command mirrors the "not recognized" feedback', () => {
    vc.processCommand('zzzz nonsense zzzz', 0.9);
    expect(spoken).toContain('コマンドが認識できませんでした');
  });

  test('a failing command action mirrors the failure feedback', () => {
    vc.registerCommand('boom', {
      patterns: ['boom'],
      action: () => { throw new Error('kaboom'); },
      confirmationText: 'should not appear'
    });
    vc.processCommand('boom', 0.9);
    expect(spoken).toContain('コマンドの実行に失敗しました');
    expect(spoken).not.toContain('should not appear');
  });

  test('no throw when onSpeak is not wired', () => {
    vc.callbacks.onSpeak = null;
    expect(() => vc.speak('テスト')).not.toThrow();
  });
});
