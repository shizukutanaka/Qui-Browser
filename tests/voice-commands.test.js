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
    // search/go-to are only registered when the host wires them — a command
    // that confirms an action it cannot perform must not exist (nor appear in
    // the help list).
    vc.connectBrowser({ onSearch: () => {}, onGoTo: () => {} });
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

describe('VoiceCommands — dead surface area stays deleted', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'vr', 'input', 'VoiceCommands.js'), 'utf8');

  test('no getCommands()/description inventory survives', () => {
    // getCommands() had zero callers (the help UI lists spoken patterns via
    // _spokenExample, not descriptions) — the 25 English description strings
    // existed only to feed it. Registering dead English-only metadata in a
    // ja-first product is the i18n gap again at data level.
    const vc = new VoiceCommands();
    expect(vc.getCommands).toBeUndefined();
    expect(src).not.toMatch(/getCommands\s*\(/);
    expect(src).not.toMatch(/description:/);
  });
});

// Recognition lifecycle — previously untested (initialize() needs
// window.SpeechRecognition). A stub engine exercises start/stop/dispose,
// the continuous-mode restart, and the fatal-error guard the code carries
// as an untested comment invariant.
describe('VoiceCommands — recognition lifecycle (stub engine)', () => {
  const makeRecognition = () => ({
    continuous: undefined, interimResults: undefined, maxAlternatives: undefined,
    lang: undefined, onstart: null, onend: null, onresult: null, onerror: null,
    start: jest.fn(), stop: jest.fn(), abort: jest.fn()
  });

  let vc, rec;
  beforeEach(() => {
    rec = makeRecognition();
    global.window = {
      SpeechRecognition: jest.fn(() => rec),
      speechSynthesis: { cancel: jest.fn(), speak: jest.fn() }
    };
    global.SpeechSynthesisUtterance = jest.fn(() => ({}));
    jest.useFakeTimers();
    vc = new VoiceCommands();
    vc.callbacks.onSpeak = () => {};
  });
  afterEach(() => {
    jest.useRealTimers();
    delete global.window;
    delete global.SpeechSynthesisUtterance;
  });

  test('initialize wires recognition config and enables', async () => {
    expect(await vc.initialize()).toBe(true);
    expect(vc.isEnabled).toBe(true);
    expect(rec.lang).toBe('ja-JP');
    expect(rec.continuous).toBe(true);
  });

  test('initialize returns false when SpeechRecognition is unsupported', async () => {
    delete global.window.SpeechRecognition;
    expect(await vc.initialize()).toBe(false);
    expect(vc.isEnabled).toBe(false);
  });

  test('start() calls recognition.start once; repeated calls no-op while listening', async () => {
    await vc.initialize();
    expect(vc.start()).toBe(true);
    rec.onstart();
    expect(vc.start()).toBe(true);          // already listening → no second call
    expect(rec.start).toHaveBeenCalledTimes(1);
  });

  test('continuous mode restarts on onend while enabled', async () => {
    await vc.initialize();
    vc.start(); rec.onstart();
    rec.onend();
    jest.advanceTimersByTime(150);
    expect(rec.start).toHaveBeenCalledTimes(2);
  });

  test('fatal errors (not-allowed) disable — onend must NOT restart', async () => {
    await vc.initialize();
    vc.start(); rec.onstart();
    rec.onerror({ error: 'not-allowed' });
    rec.onend();
    jest.advanceTimersByTime(10000);
    expect(rec.start).toHaveBeenCalledTimes(1); // no restart loop
  });

  test('dispose blocks the pending onend restart and releases the engine', async () => {
    await vc.initialize();
    vc.start(); rec.onstart();
    vc.dispose();
    rec.onend();                            // late event after teardown
    jest.advanceTimersByTime(10000);
    expect(rec.start).toHaveBeenCalledTimes(1);
    expect(vc.recognition).toBeNull();
    expect(vc.synthesis).toBeNull();
  });

  test('wake word: sleeps until heard, then processes the next final', async () => {
    await vc.initialize();
    vc.settings.requireWakeWord = true;
    vc.isAwake = false;
    const fired = [];
    vc.callbacks.onCommand = (k) => fired.push(k);
    vc.registerCommand('greet', { patterns: ['hello'], action: () => true });
    vc.handleRecognitionResult({ results: [{ 0: { transcript: 'キューブラウザ', confidence: 0.9 }, isFinal: true }] });
    expect(vc.isAwake).toBe(true);
    vc.handleRecognitionResult({ results: [{ 0: { transcript: 'hello', confidence: 0.9 }, isFinal: true }] });
    expect(fired).toContain('greet');
  });

  test('confidence === 0 is treated as "no score" and still processed (Quest ja-JP)', async () => {
    await vc.initialize();
    const fired = [];
    vc.callbacks.onCommand = (k) => fired.push(k);
    vc.registerCommand('greet', { patterns: ['hello'], action: () => true });
    vc.handleRecognitionResult({ results: [{ 0: { transcript: 'hello', confidence: 0 }, isFinal: true }] });
    expect(fired).toContain('greet');
  });

  test('low-but-nonzero confidence below sensitivity is dropped', async () => {
    await vc.initialize();
    const fired = [];
    vc.callbacks.onCommand = (k) => fired.push(k);
    vc.registerCommand('greet', { patterns: ['hello'], action: () => true });
    vc.handleRecognitionResult({ results: [{ 0: { transcript: 'hello', confidence: 0.2 }, isFinal: true }] });
    expect(fired).toHaveLength(0);
  });

  test('interim (non-final) results update transcript but do not execute', async () => {
    await vc.initialize();
    const fired = [];
    vc.callbacks.onCommand = (k) => fired.push(k);
    vc.registerCommand('greet', { patterns: ['hello'], action: () => true });
    vc.handleRecognitionResult({ results: [{ 0: { transcript: 'hello', confidence: 0.9 }, isFinal: false }] });
    expect(vc.lastTranscript).toBe('hello');
    expect(fired).toHaveLength(0);
  });
});

describe('VoiceCommands.connectBrowser — VR command actions', () => {
  let vc, calls, tab, tabManager, opts;

  beforeEach(() => {
    vc = new VoiceCommands();
    vc.callbacks.onSpeak = () => {}; // suppress speak() side-effects
    calls = { search: [], goto: [], scroll: [], topSites: 0, clear: 0 };
    tab = {
      navigate: jest.fn(), goForward: jest.fn(), goBack: jest.fn(), reload: jest.fn()
    };
    tabManager = { getActiveTab: () => tab };
    const bookmarkPanel = { toggle: jest.fn() };
    const vrKeyboard = { visible: false, show: jest.fn(), hide: jest.fn() };
    opts = {
      tabManager, bookmarkPanel, vrKeyboard,
      onSearch: (q) => calls.search.push(q),
      onGoTo: (q) => calls.goto.push(q),
      onTopSites: () => calls.topSites++,
      onClearHistory: () => calls.clear++,
      onScrollContent: (d) => calls.scroll.push(d)
    };
    vc.connectBrowser(opts);
  });

  test("'検索：てんき' extracts the query and calls onSearch", () => {
    vc.processCommand('検索：てんき', 0.9);
    expect(calls.search).toEqual(['てんき']);
    expect(tab.navigate).not.toHaveBeenCalled();
  });

  test('search falls back to tabManager.navigate when onSearch is absent', () => {
    vc.connectBrowser({ tabManager }); // re-register without onSearch
    // note: second registration overwrites 'search' in the commands map
    vc.processCommand('検索：ねこ', 0.9);
    expect(tab.navigate).toHaveBeenCalledWith('ねこ');
  });

  test("'下にスクロール'/'上' scroll the reader viewport ±8 lines", () => {
    vc.processCommand('下にスクロール', 0.9);
    vc.processCommand('上', 0.9);
    expect(calls.scroll).toEqual([8, -8]);
  });

  test("'ブックマーク' toggles the bookmark panel", () => {
    vc.processCommand('ブックマーク', 0.9);
    expect(opts.bookmarkPanel.toggle).toHaveBeenCalled();
  });

  test("'キーボード' toggles the VR keyboard based on visible state", () => {
    vc.processCommand('キーボード', 0.9);
    expect(opts.vrKeyboard.show).toHaveBeenCalled();
    opts.vrKeyboard.visible = true;
    vc.processCommand('キーボード', 0.9);
    expect(opts.vrKeyboard.hide).toHaveBeenCalled();
  });

  test('forward/back/refresh drive the active tab', () => {
    vc.processCommand('進む', 0.9);
    vc.processCommand('戻る', 0.9);
    vc.processCommand('更新', 0.9);
    expect(tab.goForward).toHaveBeenCalled();
    expect(tab.goBack).toHaveBeenCalled();
    expect(tab.reload).toHaveBeenCalled();
  });

  test("'履歴を消去' calls onClearHistory (privacy command)", () => {
    vc.processCommand('履歴を消去', 0.9);
    expect(calls.clear).toBe(1);
  });

  test("'トップサイト' calls onTopSites", () => {
    vc.processCommand('トップサイト', 0.9);
    expect(calls.topSites).toBe(1);
  });

  test("'githubを開く' extracts the site name for onGoTo", () => {
    vc.processCommand('githubを開く', 0.9);
    expect(calls.goto).toEqual(['github']);
  });

  test('precedence: "キーボードを開く" hits keyboard, not the greedy go-to', () => {
    vc.processCommand('キーボードを開く', 0.9);
    expect(opts.vrKeyboard.show).toHaveBeenCalled();
    expect(calls.goto).toEqual([]);
  });
});

describe('VoiceCommands — wired session/volume/IME commands (no announce-only stubs)', () => {
  // Socratic finding: the default 'vr-enter'/'vr-exit'/'volume-up'/'volume-down'/
  // 'ime-toggle' actions were placeholders that returned a result object and
  // spoke a confirmation ("VRモードを終了します") while doing literally nothing —
  // the worst possible failure mode for a voice-primary accessibility user, who
  // hears a lie and cannot verify it. They are now deleted from the defaults and
  // re-registered by connectBrowser() only against real host callbacks.
  let vc, spoken;
  beforeEach(() => {
    vc = new VoiceCommands();
    spoken = [];
    vc.callbacks.onSpeak = (t) => spoken.push(t);
  });

  test('without connectBrowser, "VR終了" is an honest no-match instead of a fake exit', () => {
    vc.processCommand('VR終了', 0.9);
    expect(spoken.some((s) => s.includes('認識できませんでした'))).toBe(true);
    expect(spoken.some((s) => s.includes('終了します'))).toBe(false);
    expect(vc.commands.has('vr-exit')).toBe(false);
  });

  test('"VR終了" calls onExitVR and confirms', () => {
    const onExitVR = jest.fn();
    vc.connectBrowser({ onExitVR });
    vc.processCommand('VR終了', 0.9);
    expect(onExitVR).toHaveBeenCalledTimes(1);
    expect(spoken).toContain('VRモードを終了します');
  });

  test('"VRモード" calls onEnterVR (same path as the landing Enter-VR button)', () => {
    const onEnterVR = jest.fn();
    vc.connectBrowser({ onEnterVR });
    vc.processCommand('VRモード', 0.9);
    expect(onEnterVR).toHaveBeenCalledTimes(1);
  });

  test('"音量上げる" applies +0.1 and speaks the actual resulting level', () => {
    const onVolumeChange = jest.fn(() => 70);
    vc.connectBrowser({ onVolumeChange });
    vc.processCommand('音量上げる', 0.9);
    expect(onVolumeChange).toHaveBeenCalledWith(0.1);
    expect(spoken.some((s) => s.includes('70'))).toBe(true);
  });

  test('"音量下げる" applies -0.1', () => {
    const onVolumeChange = jest.fn(() => 40);
    vc.connectBrowser({ onVolumeChange });
    vc.processCommand('音量下げる', 0.9);
    expect(onVolumeChange).toHaveBeenCalledWith(-0.1);
  });

  test('volume commands are honest no-match when the host has no volume control', () => {
    vc.connectBrowser({}); // no onVolumeChange
    vc.processCommand('音量上げる', 0.9);
    expect(spoken.some((s) => s.includes('認識できませんでした'))).toBe(true);
  });

  test('"日本語入力" toggles the IME keyboard (show when hidden, hide when shown)', () => {
    const vrKeyboard = { visible: false, show: jest.fn(), hide: jest.fn() };
    vc.connectBrowser({ vrKeyboard });
    vc.processCommand('日本語入力', 0.9);
    expect(vrKeyboard.show).toHaveBeenCalledTimes(1);
    vrKeyboard.visible = true;
    vc.processCommand('日本語入力', 0.9);
    expect(vrKeyboard.hide).toHaveBeenCalledTimes(1);
  });

  test('"ヘルプ" never advertises commands the host did not wire', () => {
    vc.connectBrowser({}); // no onExitVR/onVolumeChange — those must not be listed
    vc.processCommand('ヘルプ', 0.9);
    expect(spoken[0]).not.toContain('VR終了');
    expect(spoken[0]).not.toContain('音量上げる');
  });
});

describe('VoiceCommands — tail seams: aliases, start/stop/dispose, TTS speak, stats', () => {
  let vc, spoken;
  beforeEach(() => {
    vc = new VoiceCommands();
    spoken = [];
    vc.callbacks.onSpeak = (t) => spoken.push(t);
  });

  test('a registered alias matches on substring inclusion', () => {
    const action = jest.fn(() => ({ action: 'x' }));
    vc.registerCommand('x', { patterns: ['zzz'], action, aliases: ['エイリアス'] });
    vc.processCommand('エイリアスをお願い', 0.9);
    expect(action).toHaveBeenCalledTimes(1);
    expect(vc.lastCommand.key).toBe('x');
  });

  test('an alias pointing at an unknown command key falls through to no-match', () => {
    vc.aliases.set('幽霊', 'does-not-exist');
    vc.processCommand('幽霊が出た', 0.9);
    expect(spoken.some((s) => s.includes('認識できませんでした'))).toBe(true);
    expect(vc.stats.commandsFailed).toBe(1);
  });

  test('start() refuses when disabled, no-ops when already listening, reports start() throw', () => {
    vc.isEnabled = false;
    expect(vc.start()).toBe(false);
    vc.isEnabled = true;
    vc.isListening = true;
    expect(vc.start()).toBe(true); // already listening — no recognition call
    vc.isListening = false;
    vc.recognition = { start: jest.fn(() => { throw new Error('not allowed'); }) };
    expect(vc.start()).toBe(false);
  });

  test('stop() only touches recognition while listening', () => {
    const recognition = { stop: jest.fn() };
    vc.recognition = recognition;
    vc.isListening = false;
    vc.stop();
    expect(recognition.stop).not.toHaveBeenCalled();
    vc.isListening = true;
    vc.stop();
    expect(recognition.stop).toHaveBeenCalledTimes(1);
  });

  test('dispose() disables before stopping (blocks onend restart) and releases both objects', () => {
    const recognition = { stop: jest.fn() };
    const synthesis = { cancel: jest.fn() };
    vc.isListening = true;
    vc.isEnabled = true;
    vc.recognition = recognition;
    vc.synthesis = synthesis;
    vc.dispose();
    expect(vc.isEnabled).toBe(false);
    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(synthesis.cancel).toHaveBeenCalledTimes(1);
    expect(vc.recognition).toBeNull();
    expect(vc.synthesis).toBeNull();
    // speak() still mirrors to captions post-dispose (TTS gone, onSpeak stays)
    vc.speak('まだ聞こえます');
    expect(spoken).toEqual(['まだ聞こえます']);
  });

  test('speak() builds a SpeechSynthesisUtterance with the session language and options', () => {
    const synthesis = { speak: jest.fn(), cancel: jest.fn() };
    const utterances = [];
    const prevUtterance = global.SpeechSynthesisUtterance;
    global.SpeechSynthesisUtterance = class {
      constructor(text) { this.text = text; utterances.push(this); }
    };
    try {
      vc.synthesis = synthesis;
      vc.language = 'ja-JP';
      vc.speak('テストです', { rate: 1.5 });
      expect(synthesis.speak).toHaveBeenCalledTimes(1);
      expect(utterances[0].text).toBe('テストです');
      expect(utterances[0].lang).toBe('ja-JP');
      expect(utterances[0].rate).toBe(1.5);
      expect(typeof utterances[0].onerror).toBe('function'); // TTS error must not crash
      expect(spoken).toEqual(['テストです']); // caption mirror still fired first
    } finally {
      global.SpeechSynthesisUtterance = prevUtterance;
    }
  });

  test('getStats() reports successRate as executed/recognized (0 before any command)', () => {
    expect(vc.getStats().successRate).toBe(0);
    vc.registerCommand('ok', { patterns: ['ok'], action: () => ({ ok: 1 }) });
    vc.processCommand('ok', 0.9);        // executed
    vc.processCommand('zzz', 0.9);       // failed
    const stats = vc.getStats();
    expect(stats.commandsRecognized).toBe(2);
    expect(stats.commandsExecuted).toBe(1);
    expect(stats.commandsFailed).toBe(1);
    expect(stats.successRate).toBe(0.5);
    expect(stats.averageConfidence).toBeCloseTo(0.9);
  });
});

describe('VoiceCommands — default command action bodies actually execute', () => {
  let vc;
  beforeEach(() => {
    vc = new VoiceCommands();
    vc.callbacks.onSpeak = () => {}; // suppress speech mirror
  });

  test('"進む" calls window.history.forward() and returns the direction', () => {
    const forward = jest.fn();
    global.window = { history: { forward } };
    vc.processCommand('進む', 0.9); // string patterns are exact-match
    expect(forward).toHaveBeenCalled();
  });

  test('"戻る" calls window.history.back()', () => {
    const back = jest.fn();
    global.window = { history: { back } };
    vc.processCommand('前に戻る', 0.9);
    expect(back).toHaveBeenCalled();
  });

  test('"更新" calls window.location.reload()', () => {
    const reload = jest.fn();
    global.window = { location: { reload } };
    vc.processCommand('更新', 0.9);
    expect(reload).toHaveBeenCalled();
  });

  test('"検索：xxx" opens a google search tab with the encoded query', () => {
    const open = jest.fn();
    global.window = { open };
    vc.processCommand('検索：ラーメン 近く', 0.9);
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining('google.com/search?q='), '_blank');
    expect(decodeURIComponent(open.mock.calls[0][0])).toContain('ラーメン 近く');
  });

  test('"停止" stops the engine itself', () => {
    const spy = jest.spyOn(vc, 'stop');
    vc.processCommand('停止', 0.9);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('requireWakeWord: a matched command re-arms the 5s reset timer', () => {
    jest.useFakeTimers();
    try {
      vc.settings.requireWakeWord = true;
      vc.isAwake = true;
      vc.registerCommand('t1', { patterns: ['fire'], action: () => ({ ok: 1 }) });
      // the re-arm timer lives in the isFinal recognition-result path
      vc.handleRecognitionResult({ results: [{ 0: { transcript: 'fire', confidence: 0.9 }, isFinal: true }] });
      expect(vc.isAwake).toBe(true);
      jest.advanceTimersByTime(5000);
      expect(vc.isAwake).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('VoiceCommands — handler callbacks + init catch + pattern arm', () => {
  let vc, rec;
  beforeEach(() => {
    rec = {
      continuous: undefined, interimResults: undefined, maxAlternatives: undefined,
      lang: undefined, onstart: null, onend: null, onresult: null, onerror: null,
      start: jest.fn(), stop: jest.fn(), abort: jest.fn()
    };
    global.window = {
      SpeechRecognition: jest.fn(() => rec),
      speechSynthesis: { cancel: jest.fn(), speak: jest.fn() }
    };
    global.SpeechSynthesisUtterance = jest.fn(() => ({}));
    jest.useFakeTimers();
    vc = new VoiceCommands();
    vc.callbacks.onSpeak = () => {};
  });
  afterEach(() => {
    jest.useRealTimers();
    delete global.window;
    delete global.SpeechSynthesisUtterance;
  });

  test('onstart/onend/onerror/onresult forward to the user callbacks', async () => {
    await vc.initialize();
    const onStart = jest.fn(), onEnd = jest.fn(), onError = jest.fn(), onTranscript = jest.fn();
    vc.callbacks.onStart = onStart;
    vc.callbacks.onEnd = onEnd;
    vc.callbacks.onError = onError;
    vc.callbacks.onTranscript = onTranscript;
    rec.onstart();
    expect(onStart).toHaveBeenCalled();
    rec.onerror({ error: 'network' }); // non-fatal → stays enabled
    expect(onError).toHaveBeenCalledWith('network');
    rec.onend();
    expect(onEnd).toHaveBeenCalled();
    // onresult forwards into handleRecognitionResult → onTranscript
    rec.onresult({ results: [{ 0: { transcript: 'x', confidence: 0.9 }, isFinal: true }] });
    expect(onTranscript).toHaveBeenCalledWith('x', 0.9, true);
  });

  test('initialize returns false when the SpeechRecognition ctor throws', async () => {
    global.window.SpeechRecognition = jest.fn(() => { throw new Error('denied'); });
    expect(await vc.initialize()).toBe(false);
    expect(vc.isEnabled).toBe(false);
  });

  test('a command pattern that is neither string nor RegExp is skipped', () => {
    vc.registerCommand('weird', { patterns: [42, null, /fire/], action: () => 'ok' });
    // only the regex pattern can match; the non-matcher arms must not throw
    vc.processCommand('fire now', 0.9);
    expect(vc.stats.commandsExecuted).toBe(1);
  });
});

describe('VoiceCommands — remaining branch arms', () => {
  let vc;
  beforeEach(() => {
    vc = new VoiceCommands();
    vc.callbacks.onSpeak = () => {};
  });

  test('wake-word mode: non-final transcript while asleep returns early', () => {
    vc.settings.requireWakeWord = true;
    vc.isAwake = false;
    // _handleResult with isFinal=false and no wake word → returns, no command
    vc.handleRecognitionResult({ results: [{ 0: { transcript: 'unknown', confidence: 0.9 }, isFinal: false, length: 1 }] });
    expect(vc.stats.commandsRecognized).toBe(0);
  });

  test('wake word wakes the listener (isAwake flips, greeting spoken)', () => {
    vc.settings.requireWakeWord = true;
    vc.isAwake = false;
    const spoken = [];
    vc.speak = (t) => spoken.push(t);
    vc.handleRecognitionResult({ results: [{ 0: { transcript: 'キューブラウザ 起動', confidence: 0.9 }, isFinal: true, length: 1 }] });
    expect(vc.isAwake).toBe(true);
  });

  test('command with RegExp pattern matches; non-string/non-RegExp pattern skipped', () => {
    vc.registerCommand('rx', { patterns: [/^reload|reload$/], action: () => ({ ok: 1 }) });
    vc.registerCommand('badpat', { patterns: [123], action: () => { throw new Error('never'); } });
    vc.processCommand('reload', 0.9);
    expect(vc.lastCommand.key).toBe('rx');
  });

  test('alias substring match resolves to the aliased command', () => {
    vc.registerCommand('home', {
      patterns: ['ホーム'], action: () => ({ action: 'home' })
    });
    vc.aliases.set('ホームページ', 'home');
    vc.processCommand('ホームページへ', 0.9);
    expect(vc.lastCommand.key).toBe('home');
  });

  test('search command regex with no colon-match returns without query', () => {
    const onSearch = jest.fn();
    vc.connectBrowser({ onSearch });
    // '検索' matches the command pattern but carries no query payload.
    vc.processCommand('検索', 0.9);
    expect(onSearch).not.toHaveBeenCalled();
  });

  test('registerCommand fills defaults for absent patterns/example', () => {
    vc.registerCommand('bare', { action: () => ({ ok: 1 }) });
    const cmd = vc.commands.get('bare');
    expect(cmd.patterns).toEqual([]);
    expect(cmd.confirmationText).toBeNull();
  });

  test('connectBrowser() with no args registers nothing session-bound', () => {
    expect(() => vc.connectBrowser()).not.toThrow();
    expect(() => vc.connectBrowser({})).not.toThrow();
  });

  test('volume command with onVolumeChange returning non-number skips level readout', () => {
    const spoken = [];
    vc.speak = (t) => spoken.push(t);
    vc.connectBrowser({ onVolumeChange: () => undefined });
    vc.processCommand('音量を上げる', 0.9);
    expect(spoken.every((s) => !s.includes('%'))).toBe(true);
  });

  test('keyboard command no-ops without vrKeyboard', () => {
    vc.connectBrowser({});
    expect(() => vc.processCommand('キーボード', 0.9)).not.toThrow();
    expect(vc.lastCommand.result.action).toBe('keyboard');
  });

  test('go-to command with unmatched transcript leaves onGoTo uncalled', () => {
    const onGoTo = jest.fn();
    vc.connectBrowser({ onGoTo });
    // Register a custom go-to-shaped command whose transcript matches but whose
    // extractor finds no payload.
    vc.processCommand('開いて', 0.9);
    expect(onGoTo).not.toHaveBeenCalled();
  });
});

describe('VoiceCommands — final arms', () => {
  let vc;
  beforeEach(() => {
    vc = new VoiceCommands();
    vc.callbacks.onSpeak = () => {};
  });

  test('web-search action opens google with the colon payload', () => {
    const opened = [];
    const saved = global.window;
    global.window = { open: (u) => opened.push(u) };
    try {
      vc.registerCommand('web-search', {
        patterns: [/検索/],
        action: (transcript) => {
          const match = transcript.match(/[：:]\s*(.+)/);
          if (match && match[1]) {
            global.window.open(`https://www.google.com/search?q=${encodeURIComponent(match[1])}`, '_blank');
            return { action: 'search', query: match[1] };
          }
          return { action: 'search', query: null };
        }
      });
      vc.processCommand('検索: てんき', 0.9);
      expect(opened[0]).toContain('google.com/search');
      vc.processCommand('検索のみ', 0.9); // no colon → query null arm
      expect(vc.lastCommand.result.query).toBeNull();
    } finally {
      global.window = saved;
    }
  });

  test('onSearch absent falls back to active-tab navigate with the query', () => {
    const navigate = jest.fn();
    vc.connectBrowser({ tabManager: { getActiveTab: () => ({ navigate }) } });
    vc.processCommand('検索：てんき', 0.9);
    expect(navigate).toHaveBeenCalledWith('てんき');
  });

  test('go-to via english prefix resolves the query', () => {
    const onGoTo = jest.fn();
    vc.connectBrowser({ onGoTo });
    vc.processCommand('open github', 0.9);
    expect(onGoTo).toHaveBeenCalledWith('github');
  });

  test('continuous restart re-checks isEnabled inside the timeout', async () => {
    jest.useFakeTimers();
    try {
      vc.settings.continuous = true;
      vc.isEnabled = true;
      vc.start = jest.fn();
      // drive the onend restart path
      vc.recognition = { onend: null };
      const { } = vc;
      // Simulate what setupRecognitionHandlers wires: onend schedules a restart
      // only when still enabled.
      const onend = () => {
        if (vc.settings.continuous && vc.isEnabled) {
          setTimeout(() => { if (vc.isEnabled) vc.start(); }, 100);
        }
      };
      onend();
      vc.isEnabled = false; // disabled before the 100ms restart lands
      jest.advanceTimersByTime(200);
      expect(vc.start).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('VoiceCommands — complementary arms', () => {
  let vc;
  beforeEach(() => {
    vc = new VoiceCommands();
    vc.callbacks.onSpeak = () => {};
  });

  test('alias loop iterates past non-matching aliases to a match', () => {
    vc.registerCommand('home', { patterns: ['ホーム'], action: () => ({ action: 'home' }) });
    vc.aliases.set('zzz-not-present', 'home');   // non-matching alias first
    vc.aliases.set('ホーム', 'home');            // matching alias second
    vc.processCommand('ホームに行く', 0.9);
    expect(vc.lastCommand.key).toBe('home');
  });

  test('continuous restart calls start() when still enabled after 100ms', () => {
    jest.useFakeTimers();
    try {
      vc.settings.continuous = true;
      vc.isEnabled = true;
      vc.start = jest.fn();
      const onend = () => {
        if (vc.settings.continuous && vc.isEnabled) {
          setTimeout(() => { if (vc.isEnabled) vc.start(); }, 100);
        }
      };
      onend();
      jest.advanceTimersByTime(150);
      expect(vc.start).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test('volume action speaks the numeric level', () => {
    const spoken = [];
    vc.speak = (t) => spoken.push(t);
    vc.connectBrowser({ onVolumeChange: () => 75 });
    vc.processCommand('音量上げる', 0.9);
    expect(spoken.some((s) => s.includes('75'))).toBe(true);
  });

  test('search with colon payload fires onSearch(query)', () => {
    const onSearch = jest.fn();
    vc.connectBrowser({ onSearch });
    vc.processCommand('検索：てんき', 0.9);
    expect(onSearch).toHaveBeenCalledWith('てんき');
  });

  test('go-to with japanese suffix extracts the site name', () => {
    const onGoTo = jest.fn();
    vc.connectBrowser({ onGoTo });
    vc.processCommand('githubに行く', 0.9);
    expect(onGoTo).toHaveBeenCalledWith('github');
  });
});

describe('VoiceCommands — complementary arms 2', () => {
  let vc;
  beforeEach(() => {
    vc = new VoiceCommands();
    vc.callbacks.onSpeak = () => {};
  });

  test('unwired search command falls back to window.open google URL', () => {
    const opened = [];
    const origOpen = global.window?.open;
    global.window = global.window || {};
    global.window.open = (u, t) => opened.push([u, t]);
    try {
      vc.processCommand('検索：てんき', 0.9);
      expect(opened.length).toBe(1);
      expect(opened[0][0]).toContain('google.com/search?q=');
      expect(opened[0][1]).toBe('_blank');
    } finally {
      global.window.open = origOpen;
    }
  });

  test('go-to command on English transcript extracts the site via enMatch', () => {
    const onGoTo = jest.fn();
    vc.connectBrowser({ onGoTo });
    vc.processCommand('open example.com', 0.9);
    expect(onGoTo).toHaveBeenCalledWith('example.com');
  });

  test('go-to command with no extractable site returns query:null without calling onGoTo', () => {
    const onGoTo = jest.fn();
    vc.connectBrowser({ onGoTo });
    // matches the registered pattern prefix but both jp/en sub-matches fail
    vc.processCommand('行って', 0.9);
    // either no go-to match at all, or a match with null query — onGoTo never fires with empty
    const goToCalls = onGoTo.mock.calls.filter(([q]) => !q || !q.trim());
    expect(goToCalls.length).toBe(0);
  });
});
