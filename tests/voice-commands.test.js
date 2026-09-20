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
