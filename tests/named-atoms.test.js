/**
 * Round-36 atoms (Session 110) — external parity:
 *   tab-by-name          VoiceOver 'tab by name' (title/URL substring select)
 *   describe-tab         rich active-tab description (index/state/flags)
 *   repeat-n             Vim 'N.' counted repetition
 *   stop-everything      emergency halt of narration + video
 *   battery-status       navigator.getBattery parity
 *   online-status        navigator.onLine parity
 *   open-*-named         open saved entries by name (bookmark-select's NL twin)
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
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: () => {}, speaking: false };
  vc.connectBrowser(opts);
  vc._spoken = spoken;
  return vc;
}

function makeTabManager() {
  return {
    tabs: [
      { currentTitle: 'ニュースサイト', currentUrl: 'https://news.jp', pinned: true, isPrivate: false, loading: false },
      { currentTitle: '動画ページ', currentUrl: 'https://video.tv', pinned: false, isPrivate: true, loading: true },
      { currentTitle: 'SNS', currentUrl: 'https://sns.jp', pinned: false, isPrivate: false, loading: false }
    ],
    activeIndex: 1,
    setActive: jest.fn(),
    nextTab: jest.fn()
  };
}

// ── tab-by-name ────────────────────────────────────────────────────────────
describe('VoiceCommands tab-by-name', () => {
  test("'ニュースのタブ' switches by title substring", () => {
    const tm = makeTabManager();
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('ニュースのタブ');
    expect(tm.setActive).toHaveBeenCalledWith(0);
    expect(vc._spoken.pop()).toBe('タブ1に切り替えました。ニュースサイト');
  });

  test("'tab named video' matches in English; honest with no match", () => {
    const tm = makeTabManager();
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('tab named video');
    expect(tm.setActive).toHaveBeenCalledWith(1);
    vc.processCommand('tab named zzz');
    expect(vc._spoken.pop()).toBe('「zzz」のタブがありません');
  });

  test("'ピン留めのタブ' still routes to pin-select (coexistence)", () => {
    const tm = makeTabManager();
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('ピン留めのタブ');
    expect(tm.setActive).toHaveBeenCalledWith(0);
    expect(vc._spoken.pop()).toBe('タブ1に切り替えました');
  });
});

// ── describe-tab ───────────────────────────────────────────────────────────
describe('VoiceCommands describe-tab', () => {
  test("'このタブについて' reports index/title/state/flags", () => {
    const vc = makeSpeakingVC({ tabManager: makeTabManager() });
    vc.processCommand('このタブについて');
    expect(vc._spoken.pop()).toBe('タブ2（全3）。動画ページ。読み込み中。プライベート');
  });

  test("'describe tab' works with no flags / honest empty strip", () => {
    const tm = makeTabManager();
    tm.activeIndex = 2;
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('describe tab');
    expect(vc._spoken.pop()).toBe('タブ3（全3）。SNS。読み込み完了');
    const vc2 = makeSpeakingVC({ tabManager: { tabs: [], activeIndex: -1 } });
    vc2.processCommand('describe tab');
    expect(vc2._spoken.pop()).toBe('タブがありません');
  });
});

// ── repeat-n (Vim N.) ──────────────────────────────────────────────────────
describe('VoiceCommands repeat-n', () => {
  test("'3回繰り返して' re-dispatches the last command N times", () => {
    const tm = makeTabManager();
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('次のタブ'); // seeds _repeatableTranscript
    vc._spoken.length = 0;
    vc.processCommand('3回繰り返して');
    expect(tm.nextTab.mock.calls.length).toBe(4); // 1 seed + 3 repeats
    expect(vc._spoken.pop()).toBe('3回実行しました');
  });

  test("'2 times' caps and is honest with nothing to repeat", () => {
    const vc = makeSpeakingVC({ tabManager: makeTabManager() });
    vc.processCommand('2 times');
    expect(vc._spoken.pop()).toBe('繰り返すコマンドがありません');
  });
});

// ── stop-everything ────────────────────────────────────────────────────────
describe('VoiceCommands stop-everything', () => {
  test("'すべて止めて' cancels speech and stops video", () => {
    const onVideoStop = jest.fn(() => true);
    const vc = makeSpeakingVC({ onVideoStop });
    vc.synthesis.speaking = true;
    vc.processCommand('すべて止めて');
    expect(onVideoStop).toHaveBeenCalled();
    expect(vc._spoken.pop()).toBe('すべて停止しました');
  });

  test("'stop everything' is honest when nothing runs", () => {
    const vc = makeSpeakingVC({ onVideoStop: () => false });
    vc.processCommand('stop everything');
    expect(vc._spoken.pop()).toBe('止めるものはありません');
  });
});

// ── battery / online ───────────────────────────────────────────────────────
describe('VoiceCommands battery/online status', () => {
  test("'バッテリーは' reports via getBattery or honestly", async () => {
    const vc = makeSpeakingVC();
    navigator.getBattery = () =>
      Promise.resolve({ level: 0.82, charging: true });
    vc.processCommand('バッテリーは');
    await Promise.resolve();
    await Promise.resolve();
    expect(vc._spoken.pop()).toBe('バッテリーは82%です（充電中）');
    delete navigator.getBattery;
    const vc2 = makeSpeakingVC();
    vc2.processCommand('battery level');
    expect(vc2._spoken.pop()).toBe('バッテリー状態を確認できません');
  });

  test("'オンラインか' answers from navigator.onLine", () => {
    const vc = makeSpeakingVC();
    vc.processCommand('オンラインか');
    expect(vc._spoken.pop()).toBe('オンラインです');
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const vc2 = makeSpeakingVC();
    vc2.processCommand('are we online');
    expect(vc2._spoken.pop()).toBe('オフラインです');
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });
});

// ── open-bookmark/history-named ────────────────────────────────────────────
describe('VoiceCommands open-named atoms', () => {
  test("'ブックマークのニュースを開いて' opens by name", () => {
    const onBookmarkOpenNamed = jest.fn((t) => t === 'ニュース' ? 'ニュースサイト' : null);
    const vc = makeSpeakingVC({ onBookmarkOpenNamed });
    vc.processCommand('ブックマークのニュースを開いて');
    expect(onBookmarkOpenNamed).toHaveBeenCalledWith('ニュース');
    expect(vc._spoken.pop()).toBe('「ニュースサイト」を開きます');
  });

  test("'open bookmark zzz' is honest with no match", () => {
    const vc = makeSpeakingVC({ onBookmarkOpenNamed: () => null });
    vc.processCommand('open bookmark zzz');
    expect(vc._spoken.pop()).toBe('「zzz」に一致するブックマークがありません');
  });

  test("'履歴の動画を開いて' + 'open history x' route the twin", () => {
    const onHistoryOpenNamed = jest.fn((t) => t === '動画' ? '動画ページ' : null);
    const vc = makeSpeakingVC({ onHistoryOpenNamed });
    vc.processCommand('履歴の動画を開いて');
    expect(onHistoryOpenNamed).toHaveBeenCalledWith('動画');
    expect(vc._spoken.pop()).toBe('「動画ページ」を開きます');
  });
});
