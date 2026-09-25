/**
 * Round-35 atoms (Session 109) — external parity:
 *   tab-title-n      VoiceOver 'tab N name' (reporting twin of tab-select)
 *   pin-select       jump to the first pinned tab (read twin of pin/unpin)
 *   reload-all       Chrome 'Reload all' extension parity
 *   volume-set       'volume to N' numeric twin of volume-up/down
 *   voice-list       NVDA voice list (list twin of select-voice)
 *   count twins      'how many bookmarks/history' — list commands' count surface
 *   scoped-help      Voice Access 'what can I say about X'
 */
import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';

beforeEach(() => {
  global.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) {
    this.text = text;
  };
});

function makeSpeakingVC(opts = {}) {
  const vc = new VoiceCommands();
  const spoken = [];
  vc.synthesis = {
    speak: (u) => spoken.push(u.text),
    cancel: () => {},
    getVoices: opts._voices || (() => [])
  };
  delete opts._voices;
  vc.connectBrowser(opts);
  vc._spoken = spoken;
  return vc;
}

function makeTabManager() {
  return {
    tabs: [
      { currentTitle: 'ニュース', currentUrl: 'https://a.b', pinned: true, reload: jest.fn() },
      { currentTitle: '', currentUrl: 'https://c.d', pinned: false, reload: jest.fn() }
    ],
    setActive: jest.fn()
  };
}

// ── tab-title-n (reporting twin — no switch) ───────────────────────────────
describe('VoiceCommands tab-title-n', () => {
  test("'タブ2のタイトル' reports without switching", () => {
    const tm = makeTabManager();
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('タブ2のタイトル');
    expect(vc._spoken.pop()).toBe('タブ2のタイトルは「https://c.d」です');
    expect(tm.setActive).not.toHaveBeenCalled();
  });

  test("'title of tab 1' reports without switching; OOR is honest", () => {
    const tm = makeTabManager();
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('title of tab 1');
    expect(vc._spoken.pop()).toBe('タブ1のタイトルは「ニュース」です');
    expect(tm.setActive).not.toHaveBeenCalled();
    vc.processCommand('title of tab 3');
    expect(vc._spoken.pop()).toBe('タブ3はありません');
  });

  test("plain 'タブ2' still selects (coexistence guard)", () => {
    const tm = makeTabManager();
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('タブ2');
    expect(tm.setActive).toHaveBeenCalledWith(1);
  });
});

// ── pin-select / reload-all ────────────────────────────────────────────────
describe('VoiceCommands pin-select / reload-all', () => {
  test("'ピン留めのタブ' jumps to the first pinned tab", () => {
    const tm = makeTabManager();
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('ピン留めのタブ');
    expect(tm.setActive).toHaveBeenCalledWith(0);
    expect(vc._spoken.pop()).toBe('タブ1に切り替えました');
  });

  test("'pinned tab' is honest with no pins", () => {
    const tm = makeTabManager();
    tm.tabs[0].pinned = false;
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('pinned tab');
    expect(vc._spoken.pop()).toBe('ピン留めされたタブがありません');
  });

  test("'すべて再読み込み' reloads every tab", () => {
    const tm = makeTabManager();
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('すべて再読み込み');
    expect(tm.tabs[0].reload).toHaveBeenCalled();
    expect(tm.tabs[1].reload).toHaveBeenCalled();
    expect(vc._spoken.pop()).toBe('2個のタブを再読み込みしました');
  });
});

// ── volume-set (numeric twin) ──────────────────────────────────────────
describe('VoiceCommands volume-set', () => {
  test("'音量を50%に' steps the hook by the exact delta", () => {
    const onVolume = jest.fn();
    const vc = makeSpeakingVC({ onVolume, onVolumeStatus: () => 80 });
    vc.processCommand('音量を50%に');
    expect(onVolume).toHaveBeenCalledWith(-0.3);
    expect(vc._spoken.pop()).toBe('音量を50%にしました');
  });

  test("'volume to 30' routes in English; honest without a hook", () => {
    const onVolume = jest.fn();
    const vc = makeSpeakingVC({ onVolume, onVolumeStatus: () => 10 });
    vc.processCommand('volume to 30');
    expect(onVolume).toHaveBeenCalledWith(0.2);
    const vc2 = makeSpeakingVC();
    vc2.processCommand('volume to 30');
    expect(vc2._spoken.pop()).toBe('音量を変更できません');
  });
});

// ── voice-list (list twin) ─────────────────────────────────────────────────
describe('VoiceCommands voice-list', () => {
  test("'声一覧' reads the engine voices", () => {
    const vc = makeSpeakingVC({
      _voices: () => [{ name: 'Kyoko' }, { name: 'Samantha' }]
    });
    vc.processCommand('声一覧');
    expect(vc._spoken.pop()).toBe('2個の声。Kyoko、Samantha');
  });

  test("'voice list' caps at five and is honest with none", () => {
    const vc = makeSpeakingVC({
      _voices: () => Array.from({ length: 7 }, (_, i) => ({ name: `v${i}` }))
    });
    vc.processCommand('voice list');
    expect(vc._spoken.pop()).toBe('7個の声。v0、v1、v2、v3、v4、他2件');
    const vc2 = makeSpeakingVC();
    vc2.processCommand('voice list');
    expect(vc2._spoken.pop()).toBe('読み上げ音声が利用できません');
  });
});

// ── count twins ────────────────────────────────────────────────────────────
describe('VoiceCommands count twins', () => {
  test("'ブックマークは何個' counts without reading the list", () => {
    const vc = makeSpeakingVC({ onBookmarkList: () => ['a', 'b', 'c'] });
    vc.processCommand('ブックマークは何個');
    expect(vc._spoken.pop()).toBe('3個のブックマークがあります');
  });

  test("'履歴は何件' + 'how many bookmarks' + empty honest", () => {
    const vc = makeSpeakingVC({ onHistoryList: () => ['h1'] });
    vc.processCommand('履歴は何件');
    expect(vc._spoken.pop()).toBe('1件の履歴があります');
    const vc2 = makeSpeakingVC({ onBookmarkList: () => [] });
    vc2.processCommand('how many bookmarks');
    expect(vc2._spoken.pop()).toBe('ブックマークがありません');
  });
});

// ── scoped-help ────────────────────────────────────────────────────────────
describe('VoiceCommands scoped-help', () => {
  test("'スクロールについて教えて' lists matching phrases", () => {
    const vc = makeSpeakingVC();
    vc.processCommand('スクロールについて教えて');
    const out = vc._spoken.pop();
    expect(out).toContain('「スクロール」のコマンドは');
    expect(out).toContain('下にスクロール');
    expect(out).toContain('上にスクロール');
  });

  test("'help tab' routes in English; honest with no matches", () => {
    const vc = makeSpeakingVC();
    vc.processCommand('help tab');
    expect(vc._spoken.pop()).toContain('「tab」のコマンドは');
    vc.processCommand('help zzznothing');
    expect(vc._spoken.pop()).toBe('「zzznothing」のコマンドはありません');
  });
});
