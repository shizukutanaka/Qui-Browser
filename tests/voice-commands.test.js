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

describe('VoiceCommands — connectBrowser clear-history command', () => {
  let vc;
  beforeEach(() => {
    vc = new VoiceCommands();
    vc.callbacks.onSpeak = () => {};
  });

  test('"履歴を消去" fires onClearHistory', () => {
    const onClearHistory = jest.fn();
    vc.connectBrowser({ onClearHistory });
    vc.processCommand('履歴を消去', 0.9);
    expect(onClearHistory).toHaveBeenCalledTimes(1);
    expect(vc.lastCommand.key).toBe('clear-history');
    expect(vc.lastCommand.result).toEqual({ action: 'clear-history' });
  });

  test('"clear history" (English) also triggers it', () => {
    const onClearHistory = jest.fn();
    vc.connectBrowser({ onClearHistory });
    vc.processCommand('clear history', 0.9);
    expect(onClearHistory).toHaveBeenCalledTimes(1);
  });

  test('resolves to clear-history, NOT the greedy go-to catch-all', () => {
    // "履歴を削除" contains no "を開く", but confirm specific-before-catch-all
    // registration order still routes it to clear-history and never onGoTo.
    const onClearHistory = jest.fn();
    const onGoTo = jest.fn();
    vc.connectBrowser({ onClearHistory, onGoTo });
    vc.processCommand('履歴を削除', 0.9);
    expect(vc.lastCommand.key).toBe('clear-history');
    expect(onGoTo).not.toHaveBeenCalled();
  });

  test('does not throw when onClearHistory is not wired', () => {
    vc.connectBrowser({});
    expect(() => vc.processCommand('履歴を消去', 0.9)).not.toThrow();
  });
});

describe('VoiceCommands — help command announces actual phrases (WCAG 4.1.3 discoverability)', () => {
  // Socratic finding: a voice-command user (often relying on voice because
  // gaze/controller input is difficult) has no other way to learn the
  // available phrases — the 'help' action computed a full phrase list but
  // only ever spoke a bare count ("N commands available"), never the list
  // itself. Fixed to actually announce the phrases.
  let vc, spoken;
  beforeEach(() => {
    vc = new VoiceCommands();
    spoken = [];
    vc.callbacks.onSpeak = (t) => spoken.push(t);
  });

  test('announces more than just a bare count', () => {
    vc.processCommand('ヘルプ', 0.9);
    expect(spoken).toHaveLength(1);
    // A literal phrase like "戻る" (a real command trigger) must appear —
    // the old bug spoke only "使用可能なコマンドは、N個です" with nothing after it.
    expect(spoken[0]).toContain('戻る');
  });

  test('the announced text starts with the command count, followed by the list', () => {
    vc.processCommand('ヘルプ', 0.9);
    expect(spoken[0]).toMatch(/^使用可能なコマンドは、\d+個です。/);
  });

  test('every command with a literal string pattern appears in the list', () => {
    vc.processCommand('ヘルプ', 0.9);
    for (const cmd of vc.commands.values()) {
      const literal = cmd.patterns.find((p) => typeof p === 'string');
      if (literal) {
        expect(spoken[0]).toContain(literal);
      }
    }
  });

  test('regex-only commands (search, go-to) use their example instead of a raw RegExp', () => {
    vc.connectBrowser({}); // registers 'go-to', whose patterns are all RegExp
    spoken.length = 0;
    vc.processCommand('ヘルプ', 0.9);
    expect(spoken[0]).toContain('検索：てんき');
    expect(spoken[0]).toContain('githubを開く');
    expect(spoken[0]).not.toMatch(/\/.*\(\.\+\)\//); // no raw regex source leaked
  });

  test('_spokenExample() prefers a literal string pattern over example', () => {
    const cmd = { patterns: ['戻る', /戻[るれ]/], example: 'should not be used' };
    expect(vc._spokenExample(cmd)).toBe('戻る');
  });

  test('_spokenExample() falls back to example when every pattern is a RegExp', () => {
    const cmd = { patterns: [/foo/], example: '例文' };
    expect(vc._spokenExample(cmd)).toBe('例文');
  });

  test('_spokenExample() returns null when there is neither a string pattern nor an example', () => {
    const cmd = { patterns: [/foo/], example: null };
    expect(vc._spokenExample(cmd)).toBeNull();
  });
});

describe('VoiceCommands — confidence filtering (Web Speech API / Android quirk)', () => {
  let vc;
  beforeEach(() => {
    vc = new VoiceCommands();
    vc.callbacks.onSpeak = () => {};
  });

  // Build the SpeechRecognition result-event shape handleRecognitionResult reads.
  function makeEvent(transcript, confidence, isFinal = true) {
    const result = { 0: { transcript, confidence }, isFinal, length: 1 };
    return { results: { 0: result, length: 1 } };
  }

  test('a FINAL result with confidence=0 still fires the command (Quest/Android)', () => {
    // Android Chrome — the Quest browser engine — reports confidence=0 even for
    // correctly recognized ja-JP commands; a 0.7 cutoff must not drop them.
    let fired = false;
    vc.connectBrowser({ onTopSites: () => { fired = true; } });
    vc.handleRecognitionResult(makeEvent('トップサイト', 0, true));
    expect(fired).toBe(true);
    expect(vc.lastCommand.key).toBe('top-sites');
  });

  test('a genuinely low non-zero confidence is still filtered out', () => {
    // 0 means "no score"; a real low score (e.g. 0.3 < 0.7) is still rejected.
    let fired = false;
    vc.connectBrowser({ onTopSites: () => { fired = true; } });
    vc.handleRecognitionResult(makeEvent('トップサイト', 0.3, true));
    expect(fired).toBe(false);
  });

  test('a high-confidence result fires normally', () => {
    let fired = false;
    vc.connectBrowser({ onTopSites: () => { fired = true; } });
    vc.handleRecognitionResult(makeEvent('トップサイト', 0.95, true));
    expect(fired).toBe(true);
  });
});

describe('VoiceCommands — SpeechSynthesis teardown & error resilience', () => {
  test('dispose() calls synthesis.cancel() before nulling to stop orphaned utterances', () => {
    const vc = new VoiceCommands();
    const cancel = jest.fn();
    // Inject a fake synthesis object so we can observe the cancel() call.
    vc.synthesis = { cancel, speak: jest.fn() };
    vc.dispose();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(vc.synthesis).toBeNull();
  });

  test('dispose() does not throw when synthesis is already null', () => {
    const vc = new VoiceCommands();
    // synthesis stays null (never initialized)
    expect(() => vc.dispose()).not.toThrow();
  });

  test('utterance.onerror is wired: a TTS error does not throw or propagate', () => {
    // jsdom has no SpeechSynthesisUtterance; provide a minimal stub so the
    // speak() path runs and we can assert the onerror handler is attached.
    const origSSU = global.SpeechSynthesisUtterance;
    global.SpeechSynthesisUtterance = function(text) { this.text = text; };
    try {
      const vc = new VoiceCommands();
      vc.callbacks.onSpeak = () => {};
      const utterances = [];
      vc.synthesis = {
        speak: (utt) => { utterances.push(utt); },
        cancel: jest.fn()
      };
      vc.speak('テスト');
      expect(utterances).toHaveLength(1);
      expect(typeof utterances[0].onerror).toBe('function');
      // Simulate the browser firing onerror (Android "network" error).
      expect(() => utterances[0].onerror({ error: 'network' })).not.toThrow();
    } finally {
      global.SpeechSynthesisUtterance = origSSU;
    }
  });
});

describe('VoiceCommands — find-in-page commands', () => {
  let vc;
  beforeEach(() => {
    vc = new VoiceCommands();
    vc.callbacks.onSpeak = () => {};
  });

  test('「ページ内検索：てんき」 fires onFindInPage with the query', () => {
    const onFindInPage = jest.fn();
    vc.connectBrowser({ onFindInPage });
    vc.processCommand('ページ内検索：てんき', 0.9);
    expect(onFindInPage).toHaveBeenCalledWith('てんき');
    expect(vc.lastCommand.key).toBe('find-in-page');
  });

  test('"find on page weather" (English) works too', () => {
    const onFindInPage = jest.fn();
    vc.connectBrowser({ onFindInPage });
    vc.processCommand('find on page weather', 0.9);
    expect(onFindInPage).toHaveBeenCalledWith('weather');
  });

  test('resolves to find-in-page, NOT web search — the registration-order trap', () => {
    // search's /検索[：:]/ pattern is unanchored, so it also matches
    // 「ページ内検索：X」. Only registration order keeps these apart; this
    // pins that order (the same trap the go-to catch-all documented).
    const onFindInPage = jest.fn();
    const onSearch = jest.fn();
    vc.connectBrowser({ onFindInPage, onSearch });
    vc.processCommand('ページ内検索：りんご', 0.9);
    expect(onFindInPage).toHaveBeenCalledWith('りんご');
    expect(onSearch).not.toHaveBeenCalled();
  });

  test('a plain web search still reaches onSearch', () => {
    const onFindInPage = jest.fn();
    const onSearch = jest.fn();
    vc.connectBrowser({ onFindInPage, onSearch });
    vc.processCommand('検索：りんご', 0.9);
    expect(onSearch).toHaveBeenCalledWith('りんご');
    expect(onFindInPage).not.toHaveBeenCalled();
  });

  test('「次の検索結果」 fires onFindNext, and 「次へ」 still means forward', () => {
    const onFindNext = jest.fn();
    vc.connectBrowser({ onFindNext });
    vc.processCommand('次の検索結果', 0.9);
    expect(onFindNext).toHaveBeenCalledTimes(1);
    vc.processCommand('次へ', 0.9);          // forward-navigation phrase
    expect(onFindNext).toHaveBeenCalledTimes(1); // unchanged
    expect(vc.lastCommand.key).not.toBe('find-next');
  });

  test('unwired callbacks do not throw', () => {
    vc.connectBrowser({});
    expect(() => vc.processCommand('ページ内検索：x', 0.9)).not.toThrow();
    expect(() => vc.processCommand('次の検索結果', 0.9)).not.toThrow();
  });
});

describe('VoiceCommands — open-link (follow a numbered link by voice)', () => {
  let vc;
  beforeEach(() => {
    vc = new VoiceCommands();
    vc.callbacks.onSpeak = () => {};
  });

  test('「リンク3を開く」 fires onFollowLink with 3', () => {
    const onFollowLink = jest.fn();
    vc.connectBrowser({ onFollowLink });
    vc.processCommand('リンク3を開く', 0.9);
    expect(onFollowLink).toHaveBeenCalledWith(3);
    expect(vc.lastCommand.key).toBe('open-link');
  });

  test('「1番を開く」 and 「リンク2」 work too', () => {
    const onFollowLink = jest.fn();
    vc.connectBrowser({ onFollowLink });
    vc.processCommand('1番を開く', 0.9);
    vc.processCommand('リンク2', 0.9);
    expect(onFollowLink).toHaveBeenNthCalledWith(1, 1);
    expect(onFollowLink).toHaveBeenNthCalledWith(2, 2);
  });

  test('"open link 4" (English) works', () => {
    const onFollowLink = jest.fn();
    vc.connectBrowser({ onFollowLink });
    vc.processCommand('open link 4', 0.9);
    expect(onFollowLink).toHaveBeenCalledWith(4);
  });

  test('full-width digits are normalised — Japanese ASR emits them routinely', () => {
    const onFollowLink = jest.fn();
    vc.connectBrowser({ onFollowLink });
    vc.processCommand('リンク１２を開く', 0.9);
    expect(onFollowLink).toHaveBeenCalledWith(12);
  });

  test('open-link beats the greedy go-to catch-all — the registration-order trap', () => {
    // go-to's /^(.+)を開く?/ matches 「1番を開く」 and its
    // /^(?:open|go to)\s+(.+)/i matches "open link 3" (both measured), and
    // processCommand stops at the first hit. Only ordering separates them.
    const onFollowLink = jest.fn();
    const onGoTo = jest.fn();
    vc.connectBrowser({ onFollowLink, onGoTo });
    vc.processCommand('1番を開く', 0.9);
    vc.processCommand('open link 3', 0.9);
    expect(onFollowLink).toHaveBeenCalledTimes(2);
    expect(onGoTo).not.toHaveBeenCalled();
  });

  test('a real go-to still reaches onGoTo — the catch-all is not shadowed', () => {
    const onFollowLink = jest.fn();
    const onGoTo = jest.fn();
    vc.connectBrowser({ onFollowLink, onGoTo });
    vc.processCommand('githubを開く', 0.9);
    expect(onGoTo).toHaveBeenCalledWith('github');
    expect(onFollowLink).not.toHaveBeenCalled();
  });

  test('「キーボードを開く」 still opens the keyboard, not a link', () => {
    const onFollowLink = jest.fn();
    vc.connectBrowser({ onFollowLink });
    vc.processCommand('キーボードを開く', 0.9);
    expect(vc.lastCommand.key).toBe('keyboard');
    expect(onFollowLink).not.toHaveBeenCalled();
  });

  test('an unwired callback does not throw', () => {
    vc.connectBrowser({});
    expect(() => vc.processCommand('リンク1を開く', 0.9)).not.toThrow();
  });
});
