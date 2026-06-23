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

describe('VoiceCommands — onCommandFailed callback', () => {
  let vc, failures;
  beforeEach(() => {
    vc = new VoiceCommands();
    failures = [];
    vc.callbacks.onCommandFailed = (info) => failures.push(info);
    vc.callbacks.onSpeak = () => {}; // suppress speak() side-effects in tests
  });

  test('fires with reason "no_match" when no command matches', () => {
    vc.processCommand('xyzzy nothing happens', 0.9);
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toBe('no_match');
    expect(failures[0].transcript).toBe('xyzzy nothing happens');
  });

  test('fires with reason "execution_error" when the action throws', () => {
    vc.registerCommand('broken', {
      patterns: ['broken'],
      action: () => { throw new Error('test error'); }
    });
    vc.processCommand('broken', 0.9);
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toBe('execution_error');
  });

  test('does NOT fire when a command executes successfully', () => {
    vc.registerCommand('ok', {
      patterns: ['ok'],
      action: () => ({ done: true })
    });
    vc.processCommand('ok', 0.9);
    expect(failures).toHaveLength(0);
  });

  test('no throw when onCommandFailed is not wired', () => {
    vc.callbacks.onCommandFailed = null;
    expect(() => vc.processCommand('unknown stuff', 0.9)).not.toThrow();
  });
});

describe('VoiceCommands — connectBrowser top-sites command', () => {
  let vc;
  beforeEach(() => {
    vc = new VoiceCommands();
    vc.callbacks.onSpeak = () => {}; // suppress TTS side-effects
  });

  test('a "トップサイト" utterance fires the onTopSites callback', () => {
    const onTopSites = jest.fn();
    vc.connectBrowser({ onTopSites });
    vc.processCommand('トップサイト', 0.9);
    expect(onTopSites).toHaveBeenCalledTimes(1);
    // The action's result is recorded on lastCommand (processCommand itself
    // returns void).
    expect(vc.lastCommand.key).toBe('top-sites');
    expect(vc.lastCommand.result).toEqual({ action: 'top-sites' });
  });

  test('"よく使うサイト" also triggers it', () => {
    const onTopSites = jest.fn();
    vc.connectBrowser({ onTopSites });
    vc.processCommand('よく使うサイト', 0.9);
    expect(onTopSites).toHaveBeenCalledTimes(1);
  });

  test('does not throw when onTopSites is not wired', () => {
    vc.connectBrowser({});
    expect(() => vc.processCommand('トップサイト', 0.9)).not.toThrow();
  });
});

describe('VoiceCommands — connectBrowser go-to command', () => {
  let vc;
  beforeEach(() => {
    vc = new VoiceCommands();
    vc.callbacks.onSpeak = () => {};
  });

  test('"githubを開く" fires onGoTo with the extracted site name', () => {
    const onGoTo = jest.fn();
    vc.connectBrowser({ onGoTo });
    vc.processCommand('githubを開く', 0.9);
    expect(onGoTo).toHaveBeenCalledWith('github');
    expect(vc.lastCommand.key).toBe('go-to');
    expect(vc.lastCommand.result.query).toBe('github');
  });

  test('"go to github" fires onGoTo with the extracted site name', () => {
    const onGoTo = jest.fn();
    vc.connectBrowser({ onGoTo });
    vc.processCommand('go to github', 0.9);
    expect(onGoTo).toHaveBeenCalledWith('github');
  });

  test('"open github.com" fires onGoTo with the full domain', () => {
    const onGoTo = jest.fn();
    vc.connectBrowser({ onGoTo });
    vc.processCommand('open github.com', 0.9);
    expect(onGoTo).toHaveBeenCalledWith('github.com');
  });

  test('"githubに行く" fires onGoTo correctly', () => {
    const onGoTo = jest.fn();
    vc.connectBrowser({ onGoTo });
    vc.processCommand('githubに行く', 0.9);
    expect(onGoTo).toHaveBeenCalledWith('github');
  });

  test('does not throw when onGoTo is not wired', () => {
    vc.connectBrowser({});
    expect(() => vc.processCommand('githubを開く', 0.9)).not.toThrow();
  });

  test('mirrors a spoken "understood" confirmation to onSpeak (cross-modal)', () => {
    // Blind users hear the TTS cue; deaf/HoH users see it mirrored to captions.
    const spoken = [];
    vc.callbacks.onSpeak = (t) => spoken.push(t);
    vc.connectBrowser({ onGoTo: jest.fn() });
    vc.processCommand('githubを開く', 0.9);
    expect(spoken).toContain('開きます');
  });

  test('"キーボードを開く" toggles the keyboard, not go-to (specific wins over catch-all)', () => {
    // go-to's "を開く" capture is greedy; it must be registered last so the
    // specific keyboard command claims this utterance first.
    const onGoTo = jest.fn();
    let toggled = false;
    vc.connectBrowser({
      onGoTo,
      vrKeyboard: { visible: false, show() { toggled = true; }, hide() { toggled = true; } }
    });
    vc.processCommand('キーボードを開く', 0.9);
    expect(vc.lastCommand.key).toBe('keyboard');
    expect(toggled).toBe(true);
    expect(onGoTo).not.toHaveBeenCalled();
  });
});
