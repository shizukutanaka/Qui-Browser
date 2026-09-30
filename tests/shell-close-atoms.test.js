/**
 * Round-26 atoms:
 *   - read-clipboard — NVDA read-clipboard: speak the clipboard text
 *   - close-private-tabs — Chrome "Close incognito tabs" bulk close
 *   - first-tab — land on the strip's first slot (last-tab's pair)
 *   - bookmark-status — honest query for the active page's bookmark state
 */

global.SpeechSynthesisUtterance = function (text) { this.text = text; };

const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeSpeakingVC(extra = {}) {
  const vc = new VoiceCommands();
  vc.callbacks.onSpeak = () => {};
  vc.connectBrowser(extra);
  const spoken = [];
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: jest.fn() };
  vc._spoken = spoken;
  return vc;
}

// ── read-clipboard ────────────────────────────────────────────────────────────
describe('VoiceCommands read-clipboard', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));

  test('\'クリップボードを読み上げ\' speaks the hook\'s text', async () => {
    const vc = makeSpeakingVC({ onReadClipboard: () => Promise.resolve('コピー済みテキスト') });
    vc.processCommand('クリップボードを読み上げ');
    await flush();
    expect(vc._spoken.pop()).toBe('コピー済みテキスト');
  });

  test('\'read clipboard\' routes in English', async () => {
    const vc = makeSpeakingVC({ onReadClipboard: () => Promise.resolve('hi') });
    vc.processCommand('read clipboard');
    await flush();
    expect(vc._spoken.pop()).toBe('hi');
  });

  test('no hook announces honestly', async () => {
    const vc = makeSpeakingVC();
    vc.processCommand('クリップボードを読み上げ');
    await flush();
    expect(vc._spoken.pop()).toBe('コピーされていません');
  });
});

// ── close-private-tabs ────────────────────────────────────────────────────────
describe('VoiceCommands close-private-tabs', () => {
  test('\'プライベートタブを閉じて\' closes via tabManager', () => {
    const vc = makeSpeakingVC({ tabManager: { closePrivateTabs: () => 2 } });
    vc.processCommand('プライベートタブを閉じて');
    expect(vc._spoken.pop()).toBe('2個のプライベートタブを閉じました');
  });

  test('\'close private tabs\' routes in English', () => {
    const vc = makeSpeakingVC({ tabManager: { closePrivateTabs: () => 1 } });
    vc.processCommand('close private tabs');
    expect(vc._spoken.pop()).toBe('1個のプライベートタブを閉じました');
  });

  test('none open announces honestly', () => {
    const vc = makeSpeakingVC({ tabManager: { closePrivateTabs: () => 0 } });
    vc.processCommand('プライベートタブを閉じて');
    expect(vc._spoken.pop()).toBe('プライベートタブがありません');
  });

  test('bare \'プライベートタブ\' still routes to private-new-tab', () => {
    const newPrivateTab = jest.fn(() => ({}));
    const vc = makeSpeakingVC({ tabManager: { newPrivateTab } });
    vc.processCommand('プライベートタブ');
    expect(newPrivateTab).toHaveBeenCalled();
  });
});

// ── first-tab ─────────────────────────────────────────────────────────────────
describe('VoiceCommands first-tab', () => {
  test('\'最初のタブ\' activates index 0', () => {
    const setActive = jest.fn();
    const tabs = [
      { currentTitle: 'A' },
      { currentTitle: 'B' },
      { currentTitle: 'C' }
    ];
    const vc = makeSpeakingVC({ tabManager: { tabs, setActive } });
    vc.processCommand('最初のタブ');
    expect(setActive).toHaveBeenCalledWith(0);
    expect(vc._spoken.pop()).toBe('A');
  });

  test('\'first tab\' routes in English', () => {
    const setActive = jest.fn();
    const vc = makeSpeakingVC({ tabManager: { tabs: [{ currentTitle: 'T' }], setActive } });
    vc.processCommand('first tab');
    expect(setActive).toHaveBeenCalledWith(0);
  });

  test('no tabs announces honestly', () => {
    const vc = makeSpeakingVC({ tabManager: { tabs: [] } });
    vc.processCommand('最初のタブ');
    expect(vc._spoken.pop()).toBe('タブがありません');
  });
});

// ── bookmark-status ───────────────────────────────────────────────────────────
describe('VoiceCommands bookmark-status', () => {
  test('\'ブックマーク済みですか\' answers honestly when bookmarked', () => {
    const vc = makeSpeakingVC({
      tabManager: {
        getActiveTab: () => ({
          currentUrl: 'https://a.example/',
          isBookmarked: (u) => u === 'https://a.example/'
        })
      }
    });
    vc.processCommand('ブックマーク済みですか');
    expect(vc._spoken.pop()).toBe('ブックマークされています');
  });

  test('\'is it bookmarked\' answers honestly when not bookmarked', () => {
    const vc = makeSpeakingVC({
      tabManager: {
        getActiveTab: () => ({ currentUrl: 'https://b.example/', isBookmarked: () => false })
      }
    });
    vc.processCommand('is it bookmarked');
    expect(vc._spoken.pop()).toBe('ブックマークされていません');
  });

  test('no page announces honestly', () => {
    const vc = makeSpeakingVC({ tabManager: { getActiveTab: () => null } });
    vc.processCommand('ブックマーク済みですか');
    expect(vc._spoken.pop()).toBe('ページを開いていません');
  });
});

// ── TabManager.closePrivateTabs (bound to hand-built state) ──────────────────
describe('TabManager closePrivateTabs', () => {
  const RealTabManager = jest.requireActual('../src/vr/browser/TabManager.js').TabManager;

  function mgr(tabSpecs) {
    const m = Object.create(RealTabManager.prototype);
    m.tabs = tabSpecs.map((s) => ({ isPrivate: s === 'p', pinned: s === 'x' }));
    m.closeTab = jest.fn((i) => !m.tabs[i].pinned);
    return m;
  }

  test('closes only private tabs, backwards', () => {
    const m = mgr(['n', 'p', 'n', 'p']);
    expect(m.closePrivateTabs()).toBe(2);
    expect(m.closeTab.mock.calls.map((c) => c[0])).toEqual([3, 1]);
  });

  test('pinned private tabs survive via closeTab refusal', () => {
    const m = mgr(['p', 'x']);
    m.tabs[1].isPrivate = true;
    expect(m.closePrivateTabs()).toBe(1);
  });

  test('no private tabs closes nothing', () => {
    const m = mgr(['n', 'n']);
    expect(m.closePrivateTabs()).toBe(0);
    expect(m.closeTab).not.toHaveBeenCalled();
  });
});
