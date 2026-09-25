/**
 * Unit tests for VoiceCommands cross-modal feedback (FR-13.1).
 * Spoken responses must also reach the onSpeak callback so the host can mirror
 * them to captions — a user who can speak but not hear still needs to see
 * whether a command was understood. No SpeechRecognition/Synthesis is needed:
 * the command-matching and speak() paths are exercised directly.
 */

const { VoiceCommands, bcp47ForLanguage } = require('../src/vr/input/VoiceCommands.js');
const { setLanguage, getLanguage, t: translate } = require('../src/i18n/i18n.js');
const { VRJapaneseKeyboard } = require('../src/vr/input/JapaneseIME.js');

// A keyboard stub on the REAL prototype, so `visible` and toggle() are the
// class's own. Hand-rolled stubs with a `visible: false` field are how the
// "keyboard can open but never close" bug hid: they modeled a property the
// class never had. Only the GPU/canvas-touching internals are faked.
function stubKeyboard({ visible = false, mode = 'hiragana', built = true } = {}) {
  const kb = Object.create(VRJapaneseKeyboard.prototype);
  kb.group = built ? { visible } : null;
  kb.ime = { inputMode: mode };
  kb.createKeyboard = () => { kb.group = { visible: false }; };
  kb._refreshDisplay = () => {};
  kb._clearSuggestions = () => {};
  jest.spyOn(kb, 'show');
  jest.spyOn(kb, 'hide');
  kb.onKeyPress = jest.fn((key) => {
    if (key === 'shift') {
      kb.ime.inputMode = kb.ime.inputMode === 'katakana' ? 'hiragana' : 'katakana';
    }
    return Promise.resolve();
  });
  return kb;
}

// This whole file's fixtures (patterns, confirmationText/expected spoken
// output) were written assuming a Japanese-speaking VoiceCommands — true by
// hardcoded default until this session. Now that confirmations/help/error
// text resolve dynamically via t(), pin the UI language for this file
// explicitly instead of relying on Jest's env (no navigator.language / empty
// localStorage in testEnvironment:'node' resolves to 'en' by accident, which
// would silently break every hardcoded-Japanese assertion below). The new
// language-following behavior itself is covered by its own describe block,
// which switches languages explicitly.
const ORIGINAL_LANG = getLanguage();
beforeAll(() => setLanguage('ja'));
afterAll(() => setLanguage(ORIGINAL_LANG));

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
    const kb = stubKeyboard();
    vc.connectBrowser({ onGoTo, vrKeyboard: kb });
    vc.processCommand('キーボードを開く', 0.9);
    expect(vc.lastCommand.key).toBe('keyboard');
    expect(kb.visible).toBe(true);
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

// ── Stopping a hung load by voice ────────────────────────────────────────────
// The chrome bar's reload slot already swaps to a stop control while loading
// (WebPanel), reachable by gaze dwell or a controller ray. Voice had no path
// to it at all — the same "a control exists, but nothing lets a voice-primary
// user reach it" shape found repeatedly in this codebase (enableVoice,
// readerScale, link-following by number).
describe('VoiceCommands — stopping a hung load', () => {
  let vc;
  beforeEach(() => {
    vc = new VoiceCommands();
    vc.callbacks.onSpeak = () => {};
  });

  const tabWith = (props) => ({ getActiveTab: () => ({ stop: jest.fn(), reload: jest.fn(), ...props }) });

  test('「読み込みを停止」 calls stop() on the active tab', () => {
    const tab = { stop: jest.fn(), reload: jest.fn() };
    vc.connectBrowser({ tabManager: { getActiveTab: () => tab } });
    vc.processCommand('読み込みを停止', 0.9);
    expect(tab.stop).toHaveBeenCalledTimes(1);
    expect(tab.reload).not.toHaveBeenCalled();
    expect(vc.lastCommand.key).toBe('stop-load');
  });

  test('「読み込みを中止」 and "stop loading" (English) also work', () => {
    const tab = { stop: jest.fn(), reload: jest.fn() };
    vc.connectBrowser({ tabManager: { getActiveTab: () => tab } });
    vc.processCommand('読み込みを中止', 0.9);
    vc.processCommand('stop loading', 0.9);
    expect(tab.stop).toHaveBeenCalledTimes(2);
  });

  test('does NOT collide with the top-level "stop" (voice recognition itself)', () => {
    // Bare '停止' is an exact-string match for the mic-stop command
    // registered at construction time; only a longer phrase reaches
    // stop-load. Confirms the two keys stay distinct in the same Map.
    const tab = { stop: jest.fn(), reload: jest.fn() };
    vc.connectBrowser({ tabManager: { getActiveTab: () => tab } });
    vc.processCommand('停止', 0.9);
    expect(vc.lastCommand.key).toBe('stop');
    expect(tab.stop).not.toHaveBeenCalled();
  });

  test('no active tab or no tabManager does not throw', () => {
    vc.connectBrowser({});
    expect(() => vc.processCommand('読み込みを停止', 0.9)).not.toThrow();
    vc.connectBrowser({ tabManager: { getActiveTab: () => null } });
    expect(() => vc.processCommand('読み込みを停止', 0.9)).not.toThrow();
  });

  test('「更新」 while loading stops instead of restarting an identical fetch', () => {
    // The exact bug the chrome-bar reload button had: pressing it mid-load
    // just called reload() again, with its own fresh 5s timer, so a user
    // could never escape a hung page any faster than waiting it out. Voice
    // had the identical bug — this is that same fix, on the same tab object.
    const tab = tabWith({ loading: true });
    vc.connectBrowser({ tabManager: { getActiveTab: () => tab.getActiveTab() } });
    const activeTab = tab.getActiveTab();
    vc.connectBrowser({ tabManager: { getActiveTab: () => activeTab } });
    vc.processCommand('更新', 0.9);
    expect(activeTab.stop).toHaveBeenCalledTimes(1);
    expect(activeTab.reload).not.toHaveBeenCalled();
  });

  test('「更新」 while idle still reloads as before', () => {
    const activeTab = { loading: false, stop: jest.fn(), reload: jest.fn() };
    vc.connectBrowser({ tabManager: { getActiveTab: () => activeTab } });
    vc.processCommand('更新', 0.9);
    expect(activeTab.reload).toHaveBeenCalledTimes(1);
    expect(activeTab.stop).not.toHaveBeenCalled();
  });
});

describe('VoiceCommands — English recognition patterns (input side of the i18n fix)', () => {
  // The language fix above covers spoken OUTPUT (confirmations/errors/TTS
  // language). Most built-in commands' recognition PATTERNS were still
  // Japanese-only, which would have left an English-UI voice user unable to
  // trigger the very commands whose confirmations now correctly speak
  // English to them. Adding English patterns closes that gap for the
  // commands that had none; a handful of commands (find-in-page, open-link,
  // go-to, stop-load, clear-history) already had English patterns from
  // earlier sessions and are not re-tested here.
  let vc;
  beforeEach(() => {
    vc = new VoiceCommands();
    vc.callbacks.onSpeak = () => {};
  });

  // navigate/back/refresh/search's registerDefaultCommands() actions call
  // bare window.history.*()/window.open() — meaningless (and undefined) in
  // this window-less test env, and superseded in the real app anyway as soon
  // as connectBrowser() runs (always, right after initialize()). Route
  // through connectBrowser()'s tabManager-based versions instead, the same
  // way every other command in this file that reads tab state does.
  function stubTab() {
    return { goForward: jest.fn(), goBack: jest.fn(), loading: false, reload: jest.fn(), stop: jest.fn() };
  }

  test('"forward"/"go forward" and "back"/"go back" trigger navigation', () => {
    const tab = stubTab();
    vc.connectBrowser({ tabManager: { getActiveTab: () => tab } });
    vc.processCommand('forward', 0.9);
    expect(vc.lastCommand.key).toBe('navigate');
    vc.processCommand('go forward', 0.9);
    expect(vc.lastCommand.key).toBe('navigate');
    vc.processCommand('back', 0.9);
    expect(vc.lastCommand.key).toBe('back');
    vc.processCommand('go back', 0.9);
    expect(vc.lastCommand.key).toBe('back');
    expect(tab.goForward).toHaveBeenCalledTimes(2);
    expect(tab.goBack).toHaveBeenCalledTimes(2);
  });

  test('"go back" does NOT fall through to the go-to catch-all', () => {
    // go-to's English pattern requires the literal "go to"/"open"/"navigate
    // to" prefix; "go back" must not match it even though both start with
    // "go ". onGoTo is deliberately left unwired, so a false match would be
    // visible as a no-op key rather than silently "working" by coincidence.
    const tab = stubTab();
    const onGoTo = jest.fn();
    vc.connectBrowser({ tabManager: { getActiveTab: () => tab }, onGoTo });
    vc.processCommand('go back', 0.9);
    expect(vc.lastCommand.key).toBe('back');
    expect(onGoTo).not.toHaveBeenCalled();
  });

  test('"refresh"/"reload" trigger the refresh command', () => {
    const tab = stubTab();
    vc.connectBrowser({ tabManager: { getActiveTab: () => tab } });
    vc.processCommand('refresh', 0.9);
    expect(vc.lastCommand.key).toBe('refresh');
    vc.processCommand('reload', 0.9);
    expect(vc.lastCommand.key).toBe('refresh');
    expect(tab.reload).toHaveBeenCalledTimes(2);
  });

  test('"search: query" (English colon syntax) fires a web search', () => {
    const onSearch = jest.fn();
    vc.connectBrowser({ onSearch });
    vc.processCommand('search: weather', 0.9);
    expect(vc.lastCommand.key).toBe('search');
    expect(onSearch).toHaveBeenCalledWith('weather');
  });

  test('"enter vr"/"exit vr" trigger vr-enter/vr-exit', () => {
    vc.processCommand('enter vr', 0.9);
    expect(vc.lastCommand.key).toBe('vr-enter');
    vc.processCommand('exit vr', 0.9);
    expect(vc.lastCommand.key).toBe('vr-exit');
  });

  test('"volume up"/"volume down" trigger the volume commands', () => {
    vc.processCommand('volume up', 0.9);
    expect(vc.lastCommand.key).toBe('volume-up');
    vc.processCommand('volume down', 0.9);
    expect(vc.lastCommand.key).toBe('volume-down');
  });

  test('"help" and "what can i say" trigger the help command', () => {
    vc.processCommand('help', 0.9);
    expect(vc.lastCommand.key).toBe('help');
    vc.processCommand('what can i say', 0.9);
    expect(vc.lastCommand.key).toBe('help');
  });

  test('bare "stop" stops voice recognition, and onend does NOT restart it', () => {
    // This used to assert isEnabled===false on a never-initialized instance,
    // where it is false from the start — so it could never fail, and missed
    // that onend's continuous restart resumed listening 100 ms after "stop".
    jest.useFakeTimers();
    try {
      vc.isEnabled = true;
      vc.isListening = true;
      vc.recognition = { stop: jest.fn() };
      vc.setupRecognitionHandlers();
      const restart = jest.spyOn(vc, 'start').mockImplementation(() => true);
      vc.processCommand('stop', 0.9);
      expect(vc.lastCommand.key).toBe('stop');
      expect(vc.isEnabled).toBe(false);
      expect(vc.recognition.stop).toHaveBeenCalled();
      vc.recognition.onend();
      jest.advanceTimersByTime(500);
      expect(restart).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  test('"stop" does NOT collide with stop-load\'s "stop loading" phrase', () => {
    const tab = { stop: jest.fn(), loading: true };
    vc.connectBrowser({ tabManager: { getActiveTab: () => tab } });
    vc.processCommand('stop loading', 0.9);
    expect(vc.lastCommand.key).toBe('stop-load');
    expect(tab.stop).toHaveBeenCalledTimes(1);
  });

  describe('once connectBrowser() has run', () => {
    beforeEach(() => vc.connectBrowser({}));

    test('"top sites"/"most visited" trigger top-sites', () => {
      vc.processCommand('top sites', 0.9);
      expect(vc.lastCommand.key).toBe('top-sites');
      vc.processCommand('most visited', 0.9);
      expect(vc.lastCommand.key).toBe('top-sites');
    });

    test('"scroll down"/"down" and "scroll up"/"up" trigger scrolling', () => {
      vc.processCommand('scroll down', 0.9);
      expect(vc.lastCommand.key).toBe('scroll-down');
      vc.processCommand('down', 0.9);
      expect(vc.lastCommand.key).toBe('scroll-down');
      vc.processCommand('scroll up', 0.9);
      expect(vc.lastCommand.key).toBe('scroll-up');
      vc.processCommand('up', 0.9);
      expect(vc.lastCommand.key).toBe('scroll-up');
    });

    test('"bookmarks"/"favorites"/"history" toggle the bookmarks panel', () => {
      vc.processCommand('bookmarks', 0.9);
      expect(vc.lastCommand.key).toBe('bookmarks');
      vc.processCommand('favorites', 0.9);
      expect(vc.lastCommand.key).toBe('bookmarks');
      vc.processCommand('history', 0.9);
      expect(vc.lastCommand.key).toBe('bookmarks');
    });

    test('bare "history" does NOT collide with clear-history', () => {
      const onClearHistory = jest.fn();
      vc.connectBrowser({ onClearHistory });
      vc.processCommand('history', 0.9);
      expect(vc.lastCommand.key).toBe('bookmarks');
      expect(onClearHistory).not.toHaveBeenCalled();
    });

    test('"keyboard"/"open keyboard"/"close keyboard" toggle the VR keyboard, not go-to', () => {
      const onGoTo = jest.fn();
      const kb = stubKeyboard();
      vc.connectBrowser({ onGoTo, vrKeyboard: kb });
      vc.processCommand('open keyboard', 0.9);
      expect(vc.lastCommand.key).toBe('keyboard');
      expect(kb.visible).toBe(true);
      expect(onGoTo).not.toHaveBeenCalled();
    });
  });

  test('help still announces a Japanese phrase first (unaffected by the English additions)', () => {
    // English patterns were appended, never prepended, to every patterns
    // array. _spokenExample() reads the FIRST plain-string pattern, so this
    // pins that the addition didn't silently change what existing
    // (Japanese-primary) users hear from "help".
    const spoken = [];
    vc.callbacks.onSpeak = (text) => spoken.push(text);
    vc.processCommand('ヘルプ', 0.9);
    expect(spoken[0]).toContain('戻る');
  });
});

describe('VoiceCommands — voice output follows the UI language, not a hardcoded default', () => {
  // Until now this whole file (VoiceCommands.js) had zero i18n awareness:
  // `this.language` was hardcoded 'ja-JP' at construction, `setLanguage()`
  // had no callers, and all 25 confirmationText fields were bare Japanese
  // literals. An English-UI user with enableVoice on — someone who finds
  // gaze/controller input difficult, exactly who the feature exists for —
  // got Japanese recognition/TTS regardless of their chosen language.
  afterEach(() => setLanguage(ORIGINAL_LANG));

  test('bcp47ForLanguage maps the app\'s 2-letter codes to BCP-47 tags', () => {
    expect(bcp47ForLanguage('en')).toBe('en-US');
    expect(bcp47ForLanguage('ja')).toBe('ja-JP');
  });

  test('bcp47ForLanguage defaults an unrecognized/undefined code to ja-JP', () => {
    // Matches this app's own detectLanguage() fallback bias and the
    // pre-existing hardcoded default, rather than silently picking English.
    expect(bcp47ForLanguage('fr')).toBe('ja-JP');
    expect(bcp47ForLanguage(undefined)).toBe('ja-JP');
  });

  test('a new instance samples the current UI language at construction', () => {
    setLanguage('en');
    expect(new VoiceCommands().language).toBe('en-US');

    setLanguage('ja');
    expect(new VoiceCommands().language).toBe('ja-JP');
  });

  test('a built-in command\'s spoken confirmation changes with the UI language', () => {
    // 'vr-exit' rather than 'navigate'/'back': registerDefaultCommands'
    // versions of those call window.history.forward()/back(), which throws
    // in this jsdom-less test env and would speak the failure fallback
    // instead of the confirmation being tested here. (Not 'volume-up' any
    // more: its default is now a silent no-op until connectBrowser wires it.)
    setLanguage('en');
    const enVc = new VoiceCommands();
    const enSpoken = [];
    enVc.callbacks.onSpeak = (text) => enSpoken.push(text);
    enVc.processCommand('VR終了', 0.9);
    expect(enSpoken).toContain(translate('vr.voice.confirm.vrExit'));
    expect(enSpoken).toContain('Exiting VR mode');

    setLanguage('ja');
    const jaVc = new VoiceCommands();
    const jaSpoken = [];
    jaVc.callbacks.onSpeak = (text) => jaSpoken.push(text);
    jaVc.processCommand('VR終了', 0.9);
    expect(jaSpoken).toContain(translate('vr.voice.confirm.vrExit'));
    expect(jaSpoken).toContain('VRモードを終了します');
  });

  test('the "not recognized" and "execution failed" fallbacks also follow the language', () => {
    setLanguage('en');
    const vc = new VoiceCommands();
    const spoken = [];
    vc.callbacks.onSpeak = (text) => spoken.push(text);

    vc.processCommand('zzzz nonsense zzzz', 0.9);
    expect(spoken).toContain('Command not recognized');

    vc.registerCommand('boom', {
      patterns: ['boom'],
      action: () => { throw new Error('kaboom'); }
    });
    vc.processCommand('boom', 0.9);
    expect(spoken).toContain('Command execution failed');
  });

  test('a custom command\'s literal confirmationText is spoken as-is, NOT translated', () => {
    // The public registerCommand() extensibility point (documented at the
    // bottom of VoiceCommands.js) lets external callers pass an arbitrary
    // confirmationText literal with no catalog entry. That contract must
    // survive this change: only confirmationKey resolves through t().
    setLanguage('en');
    const vc = new VoiceCommands();
    const spoken = [];
    vc.callbacks.onSpeak = (text) => spoken.push(text);
    vc.registerCommand('custom-thing', {
      patterns: ['do the custom thing'],
      action: () => ({ ok: true }),
      confirmationText: 'カスタムコマンドを実行します'
    });
    vc.processCommand('do the custom thing', 0.9);
    expect(spoken).toContain('カスタムコマンドを実行します');
  });

  test('recognition.lang follows the sampled language when initialize() runs', async () => {
    setLanguage('en');
    const vc = new VoiceCommands();
    const FakeRecognition = function () {};
    FakeRecognition.prototype.start = jest.fn();
    global.window = global.window || {};
    window.SpeechRecognition = FakeRecognition;
    window.speechSynthesis = {};
    await vc.initialize();
    expect(vc.recognition.lang).toBe('en-US');
    delete window.SpeechRecognition;
    delete window.speechSynthesis;
  });
});

describe('VoiceCommands — "vr-enter"/"vr-exit" (WebXR user-activation constraint)', () => {
  // 'vr-enter' used to speak "Starting VR mode" and then do nothing — the
  // action was a stub ("Would trigger VR mode"). WebXR requires the
  // requestSession() call behind it to run inside a real user gesture, and a
  // SpeechRecognition result event never grants one, so wiring it up "for
  // real" would just move the false promise one layer deeper (a synthetic
  // click that silently fails). 'vr-exit', by contrast, calls
  // XRSession.end(), which has no such restriction, so it CAN be wired for
  // real via connectBrowser()'s onExitVR.
  let vc, spoken;
  beforeEach(() => {
    vc = new VoiceCommands();
    spoken = [];
    vc.callbacks.onSpeak = (text) => spoken.push(text);
  });

  test('"enter vr" speaks the honest redirect, not a false "starting" claim', () => {
    vc.processCommand('enter vr', 0.9);
    expect(vc.lastCommand.key).toBe('vr-enter');
    expect(spoken).toContain(translate('vr.voice.vrEnterUnavailable'));
    expect(spoken.join(' ')).not.toMatch(/starting vr|vrモードを開始/i);
  });

  test('"exit vr" calls onExitVR when connectBrowser wired it', () => {
    const onExitVR = jest.fn();
    vc.connectBrowser({ onExitVR });
    vc.processCommand('exit vr', 0.9);
    expect(vc.lastCommand.key).toBe('vr-exit');
    expect(onExitVR).toHaveBeenCalledTimes(1);
  });

  test('"exit vr" with no onExitVR wired is a silent no-op, not a throw', () => {
    vc.connectBrowser({});
    expect(() => vc.processCommand('exit vr', 0.9)).not.toThrow();
    expect(vc.lastCommand.key).toBe('vr-exit');
  });

  test('"exit vr" before connectBrowser() has run does not throw', () => {
    expect(() => vc.processCommand('exit vr', 0.9)).not.toThrow();
    expect(vc.lastCommand.key).toBe('vr-exit');
  });
});

describe('VoiceCommands — volume and IME mode do what they announce', () => {
  // All three used to be `// Would …` stubs that spoke "Increasing volume" /
  // "Japanese input mode" and changed nothing. They now act for real once
  // connectBrowser() wires them, and speak what actually happened.
  let vc, spoken;
  beforeEach(() => {
    vc = new VoiceCommands();
    spoken = [];
    vc.callbacks.onSpeak = (text) => spoken.push(text);
  });

  test('"volume up" steps by +10 and announces the resulting level', () => {
    const onVolumeChange = jest.fn(() => ({ value: 80, changed: true }));
    vc.connectBrowser({ onVolumeChange });
    vc.processCommand('volume up', 0.9);
    expect(onVolumeChange).toHaveBeenCalledWith(10);
    expect(spoken).toContain(`${translate('vr.voice.volumeLevel')} 80%`);
  });

  test('"音量下げる" steps by -10', () => {
    const onVolumeChange = jest.fn(() => ({ value: 60, changed: true }));
    vc.connectBrowser({ onVolumeChange });
    vc.processCommand('音量下げる', 0.9);
    expect(onVolumeChange).toHaveBeenCalledWith(-10);
    expect(spoken).toContain(`${translate('vr.voice.volumeLevel')} 60%`);
  });

  test('at the clamp it says "already at max/min", never a level change', () => {
    vc.connectBrowser({ onVolumeChange: () => ({ value: 100, changed: false }) });
    vc.processCommand('volume up', 0.9);
    expect(spoken).toEqual([translate('vr.voice.volumeMax')]);

    spoken.length = 0;
    vc.connectBrowser({ onVolumeChange: () => ({ value: 0, changed: false }) });
    vc.processCommand('volume down', 0.9);
    expect(spoken).toEqual([translate('vr.voice.volumeMin')]);
  });

  test('volume without onVolumeChange (or before connectBrowser) says nothing', () => {
    vc.processCommand('volume up', 0.9);
    vc.connectBrowser({});
    vc.processCommand('volume down', 0.9);
    expect(spoken).toEqual([]);
  });


  test('"日本語入力" shows a hidden keyboard, presses shift, announces the new mode', () => {
    const kb = stubKeyboard({ visible: false, mode: 'hiragana' });
    vc.connectBrowser({ vrKeyboard: kb });
    vc.processCommand('日本語入力', 0.9);
    expect(kb.show).toHaveBeenCalledTimes(1);
    expect(kb.onKeyPress).toHaveBeenCalledWith('shift');
    expect(spoken).toEqual([translate('vr.voice.imeKatakana')]);
  });

  test('a visible keyboard is not re-shown, and katakana switches back to hiragana', () => {
    const kb = stubKeyboard({ visible: true, mode: 'katakana' });
    vc.connectBrowser({ vrKeyboard: kb });
    vc.processCommand('toggle ime', 0.9);
    expect(kb.show).not.toHaveBeenCalled();
    expect(spoken).toEqual([translate('vr.voice.imeHiragana')]);
  });

  test('ime-toggle with no keyboard wired is a silent no-op', () => {
    vc.connectBrowser({});
    expect(() => vc.processCommand('日本語入力', 0.9)).not.toThrow();
    expect(spoken).toEqual([]);
  });

  test('"keyboard" hides a visible keyboard (it used to only ever show)', () => {
    const kb = stubKeyboard({ visible: true });
    vc.connectBrowser({ vrKeyboard: kb });
    vc.processCommand('keyboard', 0.9);
    expect(kb.hide).toHaveBeenCalledTimes(1);
    expect(kb.show).not.toHaveBeenCalled();
  });

  test('"停止" after connectBrowser turns voice off via onStopListening, and still confirms', () => {
    const onStopListening = jest.fn();
    vc.isEnabled = true;
    vc.connectBrowser({ onStopListening });
    vc.processCommand('停止', 0.9);
    expect(onStopListening).toHaveBeenCalledTimes(1);
    expect(vc.isEnabled).toBe(false);
    expect(spoken).toContain(translate('vr.voice.confirm.stopListening'));
  });

  test('dispose({keepSpeech}) lets a queued confirmation finish; plain dispose() cancels', () => {
    const synth = { cancel: jest.fn() };
    vc.synthesis = synth;
    vc.dispose({ keepSpeech: true });
    expect(synth.cancel).not.toHaveBeenCalled();

    const other = new VoiceCommands();
    const synth2 = { cancel: jest.fn() };
    other.synthesis = synth2;
    other.dispose();
    expect(synth2.cancel).toHaveBeenCalledTimes(1);
  });

  test('"keyboard" shows a hidden or not-yet-built keyboard', () => {
    const kb = stubKeyboard({ visible: false });
    vc.connectBrowser({ vrKeyboard: kb });
    vc.processCommand('keyboard', 0.9);
    expect(kb.show).toHaveBeenCalledTimes(1);

    const unbuilt = stubKeyboard({ built: false });
    vc.connectBrowser({ vrKeyboard: unbuilt });
    vc.processCommand('keyboard', 0.9);
    expect(unbuilt.show).toHaveBeenCalledTimes(1);
    expect(unbuilt.hide).not.toHaveBeenCalled();
  });
});

describe('VoiceCommands — confirmations say what actually happened', () => {
  // The spoken line is all a blind voice user gets. These commands used to
  // speak a fixed confirmation after the action whatever it did: 「戻ります」
  // at the first page, 「読み込みを停止します」 with nothing loading,
  // 「ブックマークパネルを開きます」 as it closed the panel.
  let vc, spoken;
  beforeEach(() => {
    vc = new VoiceCommands();
    spoken = [];
    vc.callbacks.onSpeak = (text) => spoken.push(text);
  });
  const say = (utterance) => { spoken.length = 0; vc.processCommand(utterance, 0.9); return spoken; };
  const withTab = (tab) => vc.connectBrowser({ tabManager: { getActiveTab: () => tab } });

  test('back / forward at the history edge say there is nowhere to go', () => {
    withTab({ goBack: () => false, goForward: () => false });
    expect(say('戻る')).toEqual([translate('vr.voice.noPreviousPage')]);
    expect(say('進む')).toEqual([translate('vr.voice.noNextPage')]);
  });

  test('back / forward with history confirm the move', () => {
    withTab({ goBack: () => true, goForward: () => true });
    expect(say('戻る')).toEqual([translate('vr.voice.confirm.back')]);
    expect(say('進む')).toEqual([translate('vr.voice.confirm.navigate')]);
  });

  test('"stop loading" with nothing loading says so', () => {
    withTab({ stop: () => false });
    expect(say('読み込みを停止')).toEqual([translate('vr.voice.nothingLoading')]);
    withTab({ stop: () => true });
    expect(say('読み込みを停止')).toEqual([translate('vr.voice.confirm.stopLoad')]);
  });

  test('"refresh" while loading says it stopped, not that it is refreshing', () => {
    const tab = { loading: true, stop: jest.fn(() => true), reload: jest.fn() };
    withTab(tab);
    expect(say('更新')).toEqual([translate('vr.voice.confirm.stopLoad')]);
    expect(tab.reload).not.toHaveBeenCalled();
  });

  test('"refresh" confirms a reload, and says there is no page when there is none', () => {
    withTab({ loading: false, reload: () => true });
    expect(say('更新')).toEqual([translate('vr.voice.confirm.refresh')]);
    withTab({ loading: false, reload: () => false });
    expect(say('更新')).toEqual([translate('vr.voice.noPage')]);
  });

  test('with no tab open, tab commands say no page is open', () => {
    vc.connectBrowser({ tabManager: { getActiveTab: () => null } });
    for (const u of ['戻る', '進む', '更新', '読み込みを停止']) {
      expect(say(u)).toEqual([translate('vr.voice.noPage')]);
    }
  });

  test('with browsing off, tab and bookmark commands say browsing is off', () => {
    vc.connectBrowser({});
    for (const u of ['戻る', '進む', '更新', '読み込みを停止', 'ブックマーク']) {
      expect(say(u)).toEqual([translate('vr.voice.browsingOff')]);
    }
  });

  test('"bookmarks" says opening or closing according to what the toggle did', () => {
    const panel = { visible: false, toggle() { this.visible = !this.visible; } };
    vc.connectBrowser({ bookmarkPanel: panel });
    expect(say('ブックマーク')).toEqual([translate('vr.voice.confirm.bookmarks')]);
    expect(say('ブックマーク')).toEqual([translate('vr.voice.confirm.bookmarksClose')]);
    expect(panel.visible).toBe(false);
  });

  test('"keyboard" says opening or closing according to what the toggle did', () => {
    const kb = stubKeyboard({ visible: false });
    vc.connectBrowser({ vrKeyboard: kb });
    expect(say('キーボード')).toEqual([translate('vr.voice.confirm.keyboardOpen')]);
    expect(say('キーボード')).toEqual([translate('vr.voice.confirm.keyboardClose')]);
    expect(kb.visible).toBe(false);
  });

  test('"keyboard" with no keyboard wired says nothing', () => {
    vc.connectBrowser({});
    expect(say('キーボード')).toEqual([]);
  });
});

describe('VoiceCommands — host callbacks report the outcome to speak', () => {
  // Only the host knows whether a find matched or a link exists; a returned
  // string replaces the optimistic confirmation, nothing keeps it.
  let vc, spoken;
  beforeEach(() => {
    vc = new VoiceCommands();
    spoken = [];
    vc.callbacks.onSpeak = (text) => spoken.push(text);
  });
  const say = (u) => { spoken.length = 0; vc.processCommand(u, 0.9); return spoken; };

  const cases = [
    ['onFindInPage', 'ページ内検索：てんき', 'vr.voice.confirm.findInPage'],
    ['onFindNext', '次の検索結果', 'vr.voice.confirm.findNext'],
    ['onFollowLink', 'リンク3を開く', 'vr.voice.confirm.openLink'],
    ['onTopSites', 'トップサイト', 'vr.voice.confirm.topSites'],
    ['onSearch', '検索：てんき', 'vr.voice.confirm.search'],
    ['onGoTo', 'githubを開く', 'vr.voice.confirm.goTo']
  ];

  test.each(cases)('%s returning a string is spoken instead of the confirmation', (cb, utterance) => {
    vc.connectBrowser({ [cb]: () => 'OUTCOME' });
    expect(say(utterance)).toEqual(['OUTCOME']);
  });

  test.each(cases)('%s returning nothing keeps the confirmation', (cb, utterance, key) => {
    vc.connectBrowser({ [cb]: () => undefined });
    expect(say(utterance)).toEqual([translate(key)]);
  });

  test('with no callback wired, nothing is claimed', () => {
    vc.connectBrowser({});
    for (const u of ['ページ内検索：てんき', '次の検索結果', 'リンク3を開く', 'トップサイト', 'githubを開く']) {
      expect(say(u)).toEqual([]);
    }
  });
});

describe('VoiceCommands — scrolling reports only when it could not scroll', () => {
  let vc, spoken;
  beforeEach(() => {
    vc = new VoiceCommands();
    spoken = [];
    vc.callbacks.onSpeak = (text) => spoken.push(text);
  });

  test('a returned line is spoken, with the direction passed through', () => {
    const onScrollContent = jest.fn(() => 'STUCK');
    vc.connectBrowser({ onScrollContent });
    vc.processCommand('下にスクロール', 0.9);
    vc.processCommand('上にスクロール', 0.9);
    expect(onScrollContent).toHaveBeenNthCalledWith(1, 8);
    expect(onScrollContent).toHaveBeenNthCalledWith(2, -8);
    expect(spoken).toEqual(['STUCK', 'STUCK']);
  });

  test('a scroll that moved says nothing; unwired says nothing', () => {
    vc.connectBrowser({ onScrollContent: () => undefined });
    vc.processCommand('下にスクロール', 0.9);
    vc.connectBrowser({});
    vc.processCommand('上にスクロール', 0.9);
    expect(spoken).toEqual([]);
  });
});
