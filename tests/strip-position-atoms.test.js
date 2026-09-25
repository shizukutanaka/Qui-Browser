/**
 * Round-27 atoms:
 *   - tab-close-n / tab-pin-n — strip-position actions (Chrome right-click parity)
 *   - url-input — Ctrl+L address-bar focus
 *   - recenter — Quest hold-button parity
 *   - video-status — video-seek's status pair
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

const strip = (titles, extras = {}) => ({
  tabs: titles.map((t) => ({ currentTitle: t, ...extras })),
  closeTab: jest.fn((i) => !strip_tabs[i].pinned),
  togglePin: jest.fn(),
  setActive: jest.fn()
});
let strip_tabs = [];

function mgr(titles, opts = {}) {
  strip_tabs = titles.map((t) => ({ currentTitle: t, pinned: !!opts.pinned?.includes(t) }));
  return {
    tabs: strip_tabs,
    closeTab: jest.fn((i) => !strip_tabs[i].pinned),
    togglePin: jest.fn(() => 'pinned'),
    setActive: jest.fn()
  };
}

// ── tab-close-n ───────────────────────────────────────────────────────────────
describe('VoiceCommands tab-close-n', () => {
  test('\'タブ2を閉じて\' closes index 1 with title announce', () => {
    const m = mgr(['A', 'B', 'C']);
    const vc = makeSpeakingVC({ tabManager: m });
    vc.processCommand('タブ2を閉じて');
    expect(m.closeTab).toHaveBeenCalledWith(1);
    expect(vc._spoken.pop()).toBe('Bを閉じました');
  });

  test('\'close tab 3\' routes in English', () => {
    const m = mgr(['A', 'B', 'C']);
    const vc = makeSpeakingVC({ tabManager: m });
    vc.processCommand('close tab 3');
    expect(m.closeTab).toHaveBeenCalledWith(2);
  });

  test('out of range announces honestly', () => {
    const m = mgr(['A']);
    const vc = makeSpeakingVC({ tabManager: m });
    vc.processCommand('タブ9を閉じて');
    expect(vc._spoken.pop()).toBe('タブ9はありません');
    expect(m.closeTab).not.toHaveBeenCalled();
  });

  test('pinned refusal announces honestly', () => {
    const m = mgr(['A', 'B'], { pinned: ['B'] });
    const vc = makeSpeakingVC({ tabManager: m });
    vc.processCommand('タブ2を閉じて');
    expect(vc._spoken.pop()).toBe('ピン留めされたタブは閉じられません');
  });

  test('bare \'タブ2\' still routes to tab-select', () => {
    const m = mgr(['A', 'B']);
    const vc = makeSpeakingVC({ tabManager: m });
    vc.processCommand('タブ2');
    expect(m.setActive).toHaveBeenCalledWith(1);
    expect(m.closeTab).not.toHaveBeenCalled();
  });
});

// ── tab-pin-n ─────────────────────────────────────────────────────────────────
describe('VoiceCommands tab-pin-n', () => {
  test('\'タブ1をピン留め\' toggles via togglePin', () => {
    const m = mgr(['A', 'B']);
    const vc = makeSpeakingVC({ tabManager: m });
    vc.processCommand('タブ1をピン留め');
    expect(m.togglePin).toHaveBeenCalledWith(0);
    expect(vc._spoken.pop()).toBe('タブ1をピン留めしました');
  });

  test('\'pin tab 2\' routes in English', () => {
    const m = mgr(['A', 'B']);
    const vc = makeSpeakingVC({ tabManager: m });
    vc.processCommand('pin tab 2');
    expect(m.togglePin).toHaveBeenCalledWith(1);
  });

  test('unpin result announces the unpin', () => {
    const m = mgr(['A', 'B']);
    m.togglePin = jest.fn(() => 'unpinned');
    const vc = makeSpeakingVC({ tabManager: m });
    vc.processCommand('タブ2のピンを外す');
    expect(vc._spoken.pop()).toBe('タブ2のピンを外しました');
  });

  test('out of range announces honestly', () => {
    const m = mgr(['A']);
    const vc = makeSpeakingVC({ tabManager: m });
    vc.processCommand('タブ7をピン');
    expect(vc._spoken.pop()).toBe('タブ7はありません');
    expect(m.togglePin).not.toHaveBeenCalled();
  });
});

// ── url-input ─────────────────────────────────────────────────────────────────
describe('VoiceCommands url-input', () => {
  test('\'アドレスバー\' opens the panel\'s URL input prefilled', () => {
    const onUrlInputRequested = jest.fn();
    const vc = makeSpeakingVC({
      tabManager: {
        getActiveTab: () => ({ currentUrl: 'https://a.example/', onUrlInputRequested })
      }
    });
    vc.processCommand('アドレスバー');
    expect(onUrlInputRequested).toHaveBeenCalledWith('https://a.example/', expect.any(Function));
    expect(vc._spoken.pop()).toBe('URLを入力してください');
  });

  test('\'enter url\' routes in English', () => {
    const onUrlInputRequested = jest.fn();
    const vc = makeSpeakingVC({
      tabManager: { getActiveTab: () => ({ currentUrl: null, onUrlInputRequested }) }
    });
    vc.processCommand('enter url');
    expect(onUrlInputRequested).toHaveBeenCalledWith('https://', expect.any(Function));
  });

  test('no panel announces honestly', () => {
    const vc = makeSpeakingVC({ tabManager: { getActiveTab: () => null } });
    vc.processCommand('アドレスバー');
    expect(vc._spoken.pop()).toBe('アドレスバーがありません');
  });

  test('confirm callback navigates the panel', () => {
    const navigate = jest.fn();
    const vc = makeSpeakingVC({
      tabManager: {
        getActiveTab: () => ({
          currentUrl: null,
          navigate,
          onUrlInputRequested: (_p, cb) => cb('https://x.example/')
        })
      }
    });
    vc.processCommand('アドレスバー');
    expect(navigate).toHaveBeenCalledWith('https://x.example/');
  });
});

// ── recenter ──────────────────────────────────────────────────────────────────
describe('VoiceCommands recenter', () => {
  test('\'リセンター\' returns via the hook', () => {
    const vc = makeSpeakingVC({ onRecenter: () => true });
    vc.processCommand('リセンター');
    expect(vc._spoken.pop()).toBe('中央に戻しました');
  });

  test('\'recenter\' routes in English', () => {
    const vc = makeSpeakingVC({ onRecenter: () => true });
    vc.processCommand('recenter');
    expect(vc._spoken.pop()).toBe('中央に戻しました');
  });

  test('no hook announces honestly', () => {
    const vc = makeSpeakingVC({ onRecenter: () => false });
    vc.processCommand('リセンター');
    expect(vc._spoken.pop()).toBe('中央に戻せません');
  });
});

// ── video-status ──────────────────────────────────────────────────────────────
describe('VoiceCommands video-status', () => {
  test('\'動画はどのくらい\' announces position and duration', () => {
    const vc = makeSpeakingVC({ onVideoStatus: () => ({ t: 75, d: 300 }) });
    vc.processCommand('動画はどのくらい');
    expect(vc._spoken.pop()).toBe('1分15秒を再生中（全5分0秒）');
  });

  test('\'video position\' routes in English', () => {
    const vc = makeSpeakingVC({ onVideoStatus: () => ({ t: 30, d: Infinity }) });
    vc.processCommand('video position');
    expect(vc._spoken.pop()).toBe('0分30秒を再生中');
  });

  test('no video announces honestly', () => {
    const vc = makeSpeakingVC({ onVideoStatus: () => null });
    vc.processCommand('動画はどのくらい');
    expect(vc._spoken.pop()).toBe('再生中の動画がありません');
  });
});
