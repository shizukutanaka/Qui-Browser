/**
 * Round-37 atoms (Session 111) — external parity:
 *   security-status / hostname   Chrome lock icon + address-bar readout
 *   back/forward-status          query twins (a question must not navigate)
 *   close-tab-by-name            tab-by-name's destructive sibling
 *   copy-line / copy-article     clipboard twins of read-line / read-aloud
 *   percent-jump                 Kindle 'go to N%'
 *   paragraphs/headings-left     remaining twins of sentences-left
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

function makeTabManager(overrides = {}) {
  const tab = {
    currentTitle: 'ニュースサイト', currentUrl: 'https://news.jp/x',
    history: ['a', 'b'], historyIdx: 0, pinned: false, isPrivate: false,
    loading: false, goBack: jest.fn(() => true), goForward: jest.fn(() => true)
  };
  return {
    tabs: [tab, { currentTitle: '動画', currentUrl: 'http://video.tv', pinned: true,
      isPrivate: false, loading: false, history: [], historyIdx: -1 }],
    activeIndex: 0,
    setActive: jest.fn(),
    closeTab: jest.fn(() => true),
    getActiveTab: () => tab,
    ...overrides
  };
}

// ── security-status / hostname ─────────────────────────────────────────────
describe('VoiceCommands security/hostname', () => {
  test("'このページは安全ですか' reports https honestly", () => {
    const vc = makeSpeakingVC({ tabManager: makeTabManager() });
    vc.processCommand('このページは安全ですか');
    expect(vc._spoken.pop()).toBe('https のため接続は暗号化されています');
  });

  test("'is it secure' reports http plainly + no page honestly", () => {
    const tm = makeTabManager();
    tm.getActiveTab = () => tm.tabs[1];
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('is it secure');
    expect(vc._spoken.pop()).toBe('http のため暗号化されていません');
    const vc2 = makeSpeakingVC({ tabManager: { getActiveTab: () => null } });
    vc2.processCommand('安全ですか');
    expect(vc2._spoken.pop()).toBe('ページがありません');
  });

  test("'ドメインは'/'hostname' answers the bare host", () => {
    const vc = makeSpeakingVC({ tabManager: makeTabManager() });
    vc.processCommand('ドメインは');
    expect(vc._spoken.pop()).toBe('ドメインはnews.jpです');
    vc.processCommand('hostname');
    expect(vc._spoken.pop()).toBe('ドメインはnews.jpです');
  });
});

// ── back/forward-status ────────────────────────────────────────────────────
describe('VoiceCommands back/forward-status', () => {
  test("'戻れますか' answers without navigating", () => {
    const tm = makeTabManager();
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('戻れますか');
    expect(vc._spoken.pop()).toBe('戻れません'); // historyIdx 0
    expect(tm.getActiveTab().goBack).not.toHaveBeenCalled();
  });

  test("'進めますか' answers from historyIdx without navigate", () => {
    const tm = makeTabManager();
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('進めますか');
    expect(vc._spoken.pop()).toBe('進めます'); // 0 < len-1
    expect(tm.getActiveTab().goForward).not.toHaveBeenCalled();
    vc.processCommand('can we go forward');
    expect(vc._spoken.pop()).toBe('進めます');
  });
});

// ── close-tab-by-name ──────────────────────────────────────────────────────
describe('VoiceCommands close-tab-by-name', () => {
  test("'ニュースのタブを閉じて' closes by title", () => {
    const tm = makeTabManager();
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('ニュースのタブを閉じて');
    expect(tm.closeTab).toHaveBeenCalledWith(0);
    expect(vc._spoken.pop()).toBe('タブを閉じました');
  });

  test("'close the video tab' is honest with no match; pinned refuse", () => {
    const tm = makeTabManager();
    tm.closeTab = jest.fn(() => false);
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('close the video tab');
    expect(vc._spoken.pop()).toBe('ピン留めされたタブは閉じられません');
    vc.processCommand('close the zzz tab');
    expect(vc._spoken.pop()).toBe('「zzz」のタブがありません');
  });
});

// ── copy-line / copy-article ───────────────────────────────────────────────
describe('VoiceCommands copy atoms', () => {
  test("'この行をコピー' writes the current line", () => {
    const onCopyLine = jest.fn(() => '現在の行テキスト');
    const vc = makeSpeakingVC({ onCopyLine });
    vc.processCommand('この行をコピー');
    expect(onCopyLine).toHaveBeenCalled();
    expect(vc._spoken.pop()).toBe('行をコピーしました');
  });

  test("'copy this line'/'記事をコピー' honest when empty", () => {
    const vc = makeSpeakingVC({ onCopyLine: () => null, onCopyArticle: () => null });
    vc.processCommand('copy this line');
    expect(vc._spoken.pop()).toBe('コピーする行がありません');
    vc.processCommand('記事をコピー');
    expect(vc._spoken.pop()).toBe('コピーする記事がありません');
  });

  test("'copy article' announces the char count", () => {
    const vc = makeSpeakingVC({ onCopyArticle: () => 1234 });
    vc.processCommand('copy article');
    expect(vc._spoken.pop()).toBe('記事をコピーしました（1234文字）');
  });
});

// ── percent-jump ───────────────────────────────────────────────────────────
describe('VoiceCommands percent-jump', () => {
  test("'50%へ' jumps the reader to N percent", () => {
    const onReaderPercent = jest.fn(() => ({ percent: 50 }));
    const vc = makeSpeakingVC({ onReaderPercent });
    vc.processCommand('50%へ');
    expect(onReaderPercent).toHaveBeenCalledWith(50);
    expect(vc._spoken.pop()).toBe('50%に移動しました');
  });

  test("'go to 30 percent' + honest without reader", () => {
    const vc = makeSpeakingVC({ onReaderPercent: () => null });
    vc.processCommand('go to 30 percent');
    expect(vc._spoken.pop()).toBe('記事を開いていません');
  });
});

// ── paragraphs/headings-left ───────────────────────────────────────────────
describe('VoiceCommands remaining atoms', () => {
  test("'残りの段落' counts down via paragraph-status", () => {
    const vc = makeSpeakingVC({ onParagraphStatus: () => ({ index: 1, total: 5 }) });
    vc.processCommand('残りの段落');
    expect(vc._spoken.pop()).toBe('あと3段落です');
  });

  test("'headings left' + honest empty", () => {
    const vc = makeSpeakingVC({ onHeadingHere: () => ({ index: 2, total: 3, text: 'x' }) });
    vc.processCommand('headings left');
    expect(vc._spoken.pop()).toBe('最後の見出しです');
    const vc2 = makeSpeakingVC({ onHeadingHere: () => null });
    vc2.processCommand('残りの見出し');
    expect(vc2._spoken.pop()).toBe('見出しがありません');
  });
});
