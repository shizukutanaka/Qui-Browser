/**
 * Round-30 atoms (Session 104) — external parity:
 *   last-tab-switch        Alt+Tab / MRU ping-pong
 *   repeat-command         Vim '.' / Windows Voice Access "repeat" (re-EXECUTE,
 *                          vs say-again which replays the ANNOUNCEMENT)
 *   unbookmark-page        Chrome "Remove bookmark" — one-directional, honest
 *   speaking-status        narration-is-speaking query
 *   first/last-heading     find-first/find-last's heading siblings
 */
import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';
import { TabManager } from '../src/vr/browser/TabManager.js';
import { WebPanel } from '../src/vr/browser/WebPanel.js';

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
    speaking: opts.speakingNow === true
  };
  const { speakingNow: _drop, ...rest } = opts;
  vc.connectBrowser(rest);
  vc._spoken = spoken;
  return vc;
}

// ── last-tab-switch (Alt+Tab / MRU ping-pong) ──────────────────────────────
describe('TabManager previousActiveIndex + voice last-tab-switch', () => {
  function tm() {
    const t = Object.create(TabManager.prototype);
    t.tabs = [];
    t.activeIndex = -1;
    t._prevActiveIndex = -1;
    t._drawStrip = () => {};
    t.opts = {};
    return t;
  }

  test('setActive records the previous index', () => {
    const t = tm();
    t.tabs = [{ setVisible() {} }, { setVisible() {} }];
    t.setActive(0);
    expect(t.previousActiveIndex()).toBe(-1);
    t.setActive(1);
    expect(t.previousActiveIndex()).toBe(0);
    t.setActive(0);
    expect(t.previousActiveIndex()).toBe(1);
  });

  test("'さっきのタブ' switches back and announces", () => {
    const setActive = jest.fn();
    const vc = makeSpeakingVC({
      tabManager: {
        tabs: [{}, {}], activeIndex: 1,
        previousActiveIndex: () => 0, setActive
      }
    });
    vc.processCommand('さっきのタブ');
    expect(setActive).toHaveBeenCalledWith(0);
    expect(vc._spoken.pop()).toBe('タブ1に切り替えました');
  });

  test("'switch back' routes in English", () => {
    const setActive = jest.fn();
    const vc = makeSpeakingVC({
      tabManager: {
        tabs: [{}, {}], activeIndex: 0,
        previousActiveIndex: () => 1, setActive
      }
    });
    vc.processCommand('switch back');
    expect(setActive).toHaveBeenCalledWith(1);
  });

  test('no previous tab announces honestly', () => {
    const vc = makeSpeakingVC({
      tabManager: {
        tabs: [{}], activeIndex: 0,
        previousActiveIndex: () => -1, setActive: () => {}
      }
    });
    vc.processCommand('さっきのタブ');
    expect(vc._spoken.pop()).toBe('前のタブがありません');
  });

  test("bare '前のタブ' still routes to prev-tab (cycle)", () => {
    const prevTab = jest.fn();
    const vc = makeSpeakingVC({ tabManager: { prevTab } });
    vc.processCommand('前のタブ');
    expect(prevTab).toHaveBeenCalled();
  });
});

// ── repeat-command (Vim '.' parity) ────────────────────────────────────────
describe('VoiceCommands repeat-command', () => {
  test("'もう一度実行して' re-dispatches the last command", () => {
    const nextTab = jest.fn();
    const vc = makeSpeakingVC({ tabManager: { nextTab } });
    vc.processCommand('次のタブ');
    vc.processCommand('もう一度実行して');
    expect(nextTab).toHaveBeenCalledTimes(2);
  });

  test('repeat does not record itself — double repeat re-runs, not recurses', () => {
    const nextTab = jest.fn();
    const vc = makeSpeakingVC({ tabManager: { nextTab } });
    vc.processCommand('次のタブ');
    vc.processCommand('もう一度実行して');
    vc.processCommand('同じことをして');
    expect(nextTab).toHaveBeenCalledTimes(3);
  });

  test('nothing to repeat announces honestly', () => {
    const vc = makeSpeakingVC({});
    vc.processCommand('もう一度実行して');
    expect(vc._spoken.pop()).toBe('繰り返すコマンドがありません');
  });

  test("'do it again' routes in English", () => {
    const nextTab = jest.fn();
    const vc = makeSpeakingVC({ tabManager: { nextTab } });
    vc.processCommand('next tab');
    vc.processCommand('do it again');
    expect(nextTab).toHaveBeenCalledTimes(2);
  });
});

// ── unbookmark-page ─────────────────────────────────────────────────────────
describe('VoiceCommands unbookmark-page', () => {
  test("'ブックマークを外して' removes via onToggleBookmark", () => {
    const onToggleBookmark = jest.fn();
    const vc = makeSpeakingVC({
      tabManager: {
        getActiveTab: () => ({
          currentUrl: 'https://x', currentTitle: 'X',
          isBookmarked: () => true, onToggleBookmark
        })
      }
    });
    vc.processCommand('ブックマークを外して');
    expect(onToggleBookmark).toHaveBeenCalledWith('https://x', 'X');
    expect(vc._spoken.pop()).toBe('ブックマークを外しました');
  });

  test('not bookmarked announces honestly', () => {
    const vc = makeSpeakingVC({
      tabManager: {
        getActiveTab: () => ({
          currentUrl: 'https://x', isBookmarked: () => false
        })
      }
    });
    vc.processCommand('ブックマークを外して');
    expect(vc._spoken.pop()).toBe('ブックマークされていません');
  });

  test("'remove bookmark' routes in English", () => {
    const onToggleBookmark = jest.fn();
    const vc = makeSpeakingVC({
      tabManager: {
        getActiveTab: () => ({
          currentUrl: 'u', currentTitle: 't',
          isBookmarked: () => true, onToggleBookmark
        })
      }
    });
    vc.processCommand('remove bookmark');
    expect(onToggleBookmark).toHaveBeenCalled();
  });
});

// ── speaking-status ────────────────────────────────────────────────────────
describe('VoiceCommands speaking-status', () => {
  test('speaking=true announces "読み上げ中です"', () => {
    const vc = makeSpeakingVC({ speakingNow: true });
    vc.processCommand('読み上げ中ですか');
    expect(vc._spoken.pop()).toBe('読み上げ中です');
  });

  test('speaking=false announces "読み上げていません"', () => {
    const vc = makeSpeakingVC({});
    vc.processCommand('読み上げていますか');
    expect(vc._spoken.pop()).toBe('読み上げていません');
  });
});

// ── first/last-heading ─────────────────────────────────────────────────────
describe('WebPanel lastHeading + voice first/last-heading', () => {
  function readerPanel() {
    const p = Object.create(WebPanel.prototype);
    p._contentState = 'reader';
    p._readerLines = [
      { text: 'T', style: 'title' }, { text: 'a' }, { text: 'H1', style: 'h' },
      { text: 'b' }, { text: 'H2', style: 'h' }
    ];
    p.scrollContentTo = jest.fn();
    return p;
  }

  test('lastHeading jumps to the final heading', () => {
    const p = readerPanel();
    expect(p.lastHeading()).toEqual({ index: 3, total: 3 });
    expect(p.scrollContentTo).toHaveBeenCalledWith(4);
  });

  test("'最初の見出し' jumps to heading 1", () => {
    const headingAt = jest.fn(() => ({ index: 1, total: 3 }));
    const vc = makeSpeakingVC({ tabManager: { getActiveTab: () => ({ headingAt }) } });
    vc.processCommand('最初の見出し');
    expect(headingAt).toHaveBeenCalledWith(1);
    expect(vc._spoken.pop()).toBe('1番目の見出し（全3）');
  });

  test("'最後の見出し' routes to lastHeading", () => {
    const lastHeading = jest.fn(() => ({ index: 3, total: 3 }));
    const vc = makeSpeakingVC({ tabManager: { getActiveTab: () => ({ lastHeading }) } });
    vc.processCommand('最後の見出し');
    expect(lastHeading).toHaveBeenCalled();
    expect(vc._spoken.pop()).toBe('最後の見出し（全3）');
  });

  test('no headings announces honestly', () => {
    const vc = makeSpeakingVC({
      tabManager: { getActiveTab: () => ({ headingAt: () => null, lastHeading: () => null }) }
    });
    vc.processCommand('最初の見出し');
    expect(vc._spoken.pop()).toBe('見出しがありません');
  });
});
