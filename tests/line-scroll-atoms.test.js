/**
 * Round-31 atoms (Session 105) — external parity:
 *   next/prev-line      NVDA/VoiceOver Down/Up-arrow line reading
 *   half-page           Vim Ctrl+D/Ctrl+U half-page scroll
 *   reader-percent      Kindle "go to N%" absolute position
 *   web-search          omnibox 'Xを検索して'/'search for X' intent
 */
import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';
import { WebPanel } from '../src/vr/browser/WebPanel.js';

beforeEach(() => {
  global.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) {
    this.text = text;
  };
});

function makeSpeakingVC(opts = {}) {
  const vc = new VoiceCommands();
  const spoken = [];
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: () => {} };
  vc.connectBrowser(opts);
  vc._spoken = spoken;
  return vc;
}

// ── next-line / prev-line (NVDA arrow parity) ──────────────────────────────
describe('VoiceCommands next-line / prev-line', () => {
  test("'次の行' scrolls one line and speaks it", () => {
    const scrollContent = jest.fn(() => true);
    const currentLine = jest.fn(() => '二行目です');
    const vc = makeSpeakingVC({
      tabManager: { getActiveTab: () => ({ scrollContent, currentLine }) }
    });
    vc.processCommand('次の行');
    expect(scrollContent).toHaveBeenCalledWith(1);
    expect(vc._spoken.pop()).toBe('二行目です');
  });

  test("'前の行' scrolls back one line", () => {
    const scrollContent = jest.fn(() => true);
    const vc = makeSpeakingVC({
      tabManager: { getActiveTab: () => ({ scrollContent, currentLine: () => 'L' }) }
    });
    vc.processCommand('前の行');
    expect(scrollContent).toHaveBeenCalledWith(-1);
  });

  test('end of article announces honestly', () => {
    const vc = makeSpeakingVC({
      tabManager: { getActiveTab: () => ({ scrollContent: () => false }) }
    });
    vc.processCommand('次の行');
    expect(vc._spoken.pop()).toBe('これ以上進めません');
  });

  test("'next line' routes in English", () => {
    const scrollContent = jest.fn(() => true);
    const vc = makeSpeakingVC({
      tabManager: { getActiveTab: () => ({ scrollContent, currentLine: () => 'L2' }) }
    });
    vc.processCommand('next line');
    expect(scrollContent).toHaveBeenCalledWith(1);
  });
});

// ── half-page (Vim Ctrl+D/U) ───────────────────────────────────────────────
describe('WebPanel scrollHalfPage + voice half-page', () => {
  function readerPanel(total = 100) {
    const p = Object.create(WebPanel.prototype);
    p._contentState = 'reader';
    p._readerLines = Array.from({ length: total }, (_, i) => ({ text: `l${i}` }));
    p._readerScroll = 0;
    p._readerScale = 1;
    p._scrollMark = null;
    p._drawContent = jest.fn();
    return p;
  }

  test('scrollHalfPage(1) moves ~half the visible page', () => {
    const p = readerPanel(100);
    const moved = p.scrollHalfPage(1);
    expect(moved).toBe(true);
    expect(p._readerScroll).toBeGreaterThan(5);
    expect(p._readerScroll).toBeLessThan(24);
  });

  test('scrollHalfPage(-1) returns to the top edge', () => {
    const p = readerPanel(100);
    p.scrollHalfPage(1);
    p.scrollHalfPage(-1);
    expect(p._readerScroll).toBe(0);
  });

  test("'半ページ進む' routes with honest end announce", () => {
    const onHalfPage = jest.fn(() => true);
    const vc = makeSpeakingVC({ onHalfPage });
    vc.processCommand('半ページ進む');
    expect(onHalfPage).toHaveBeenCalledWith(1);
    expect(vc._spoken.pop()).toBe('半ページ進みました');
  });

  test("'半ページ戻る' announces honestly at the top", () => {
    const vc = makeSpeakingVC({ onHalfPage: () => false });
    vc.processCommand('半ページ戻る');
    expect(vc._spoken.pop()).toBe('これ以上戻れません');
  });
});

// ── reader-percent (Kindle go-to-N%) ───────────────────────────────────────
describe('WebPanel scrollToPercent + voice reader-percent', () => {
  function readerPanel(total = 100) {
    const p = Object.create(WebPanel.prototype);
    p._contentState = 'reader';
    p._readerLines = Array.from({ length: total }, (_, i) => ({ text: `l${i}` }));
    p._readerScroll = 0;
    p._readerScale = 1;
    p._scrollMark = null;
    p._drawContent = jest.fn();
    return p;
  }

  test('scrollToPercent(50) lands at the midpoint', () => {
    const p = readerPanel(100);
    expect(p.scrollToPercent(50)).toBe(true);
    expect(p._readerScroll).toBe(50);
  });

  test('out-of-range percent returns out', () => {
    const p = readerPanel(100);
    expect(p.scrollToPercent(150)).toBe('out');
  });

  test("'50%地点' jumps and announces", () => {
    const scrollToPercent = jest.fn(() => true);
    const vc = makeSpeakingVC({
      tabManager: { getActiveTab: () => ({ scrollToPercent }) }
    });
    vc.processCommand('50%地点');
    expect(scrollToPercent).toHaveBeenCalledWith(50);
    expect(vc._spoken.pop()).toBe('50%地点に移動しました');
  });

  test('no article announces honestly', () => {
    const vc = makeSpeakingVC({
      tabManager: { getActiveTab: () => ({}) }
    });
    vc.processCommand('30%地点');
    expect(vc._spoken.pop()).toBe('記事を開いていません');
  });
});

// ── web-search (omnibox intent) ────────────────────────────────────────────
describe('VoiceCommands web-search', () => {
  test("'猫を検索して' navigates via onGoTo", () => {
    const onGoTo = jest.fn();
    const vc = makeSpeakingVC({ onGoTo });
    vc.processCommand('猫を検索して');
    expect(onGoTo).toHaveBeenCalledWith('猫');
    expect(vc._spoken.pop()).toBe('「猫」を検索します');
  });

  test("'search for cats' routes in English", () => {
    const onGoTo = jest.fn();
    const vc = makeSpeakingVC({ onGoTo });
    vc.processCommand('search for cats');
    expect(onGoTo).toHaveBeenCalledWith('cats');
  });

  test("'履歴からXを検索' still routes to history-search", () => {
    const onHistorySearch = jest.fn(() => ({ count: 1, title: 'X' }));
    const onGoTo = jest.fn();
    const vc = makeSpeakingVC({ onHistorySearch, onGoTo });
    vc.processCommand('履歴からネコを検索');
    expect(onHistorySearch).toHaveBeenCalled();
    expect(onGoTo).not.toHaveBeenCalled();
  });
});
