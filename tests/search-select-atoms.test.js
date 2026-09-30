/**
 * Round-21 search & select atoms:
 *   - bookmark-search — history-search's pair over the saved list
 *   - find-match-select — findNextMatch's indexed sibling ('N番目のヒット')
 *   - remaining-time — getReadingTimeMinutes scaled by readerProgress
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

// ── bookmark-search ───────────────────────────────────────────────────────────
describe('VoiceCommands bookmark-search', () => {
  test('\'ブックマークからCookを検索\' passes the term and announces hits', () => {
    const onBookmarkSearch = jest.fn(() => ({ count: 2, title: 'Cookbook' }));
    const vc = makeSpeakingVC({ onBookmarkSearch });
    vc.processCommand('ブックマークからCookを検索');
    expect(onBookmarkSearch).toHaveBeenCalledWith('Cook');
    expect(vc._spoken.pop()).toBe('2件見つかりました。最初: Cookbook');
  });

  test('\'search bookmarks for recipe\' routes in English', () => {
    const onBookmarkSearch = jest.fn(() => ({ count: 1, title: 'Recipe' }));
    const vc = makeSpeakingVC({ onBookmarkSearch });
    vc.processCommand('search bookmarks for recipe');
    expect(onBookmarkSearch).toHaveBeenCalledWith('recipe');
  });

  test('no match announces honestly', () => {
    const vc = makeSpeakingVC({ onBookmarkSearch: () => null });
    vc.processCommand('ブックマークからzzzを検索');
    expect(vc._spoken.pop()).toBe('zzzはブックマークにありません');
  });

  test('\'ブックマーク一覧\' still routes to bookmarks-list', () => {
    const onBookmarkSearch = jest.fn();
    const vc = makeSpeakingVC({ onBookmarkSearch, onBookmarkList: () => ['A'] });
    vc.processCommand('ブックマーク一覧');
    expect(onBookmarkSearch).not.toHaveBeenCalled();
  });
});

// ── find-match-select ─────────────────────────────────────────────────────────
describe('VoiceCommands find-match-select', () => {
  test('\'3番目のヒット\' jumps via the hook', () => {
    const onFindMatch = jest.fn(() => ({ index: 3, total: 5 }));
    const vc = makeSpeakingVC({ onFindMatch });
    vc.processCommand('3番目のヒット');
    expect(onFindMatch).toHaveBeenCalledWith(3);
    expect(vc._spoken.pop()).toBe('3件目に移動しました');
  });

  test('\'ヒット2\' phrasing also routes', () => {
    const onFindMatch = jest.fn(() => ({ index: 2, total: 4 }));
    const vc = makeSpeakingVC({ onFindMatch });
    vc.processCommand('ヒット2');
    expect(onFindMatch).toHaveBeenCalledWith(2);
  });

  test('\'match 4\' routes in English', () => {
    const onFindMatch = jest.fn(() => ({ index: 4, total: 4 }));
    const vc = makeSpeakingVC({ onFindMatch });
    vc.processCommand('match 4');
    expect(onFindMatch).toHaveBeenCalledWith(4);
  });

  test('out of range announces honestly', () => {
    const vc = makeSpeakingVC({ onFindMatch: () => 'out' });
    vc.processCommand('9番目のヒット');
    expect(vc._spoken.pop()).toBe('ヒット9はありません');
  });

  test('no active search announces honestly', () => {
    const vc = makeSpeakingVC({ onFindMatch: () => null });
    vc.processCommand('2番目のヒット');
    expect(vc._spoken.pop()).toBe('検索をしていません');
  });

  test('\'履歴2番目\' still routes to history-select', () => {
    const onFindMatch = jest.fn();
    const vc = makeSpeakingVC({ onFindMatch, onHistoryOpen: () => 'T' });
    vc.processCommand('履歴2番目');
    expect(onFindMatch).not.toHaveBeenCalled();
  });
});

// ── remaining-time ────────────────────────────────────────────────────────────
describe('VoiceCommands remaining-time', () => {
  test('\'あと何分\' announces the estimate', () => {
    const vc = makeSpeakingVC({ onRemainingTime: () => 4 });
    vc.processCommand('あと何分');
    expect(vc._spoken.pop()).toBe('残り約4分です');
  });

  test('\'how much longer\' routes in English', () => {
    const vc = makeSpeakingVC({ onRemainingTime: () => 0 });
    vc.processCommand('how much longer');
    expect(vc._spoken.pop()).toBe('残り約0分です');
  });

  test('no article announces honestly', () => {
    const vc = makeSpeakingVC({ onRemainingTime: () => null });
    vc.processCommand('あと何分');
    expect(vc._spoken.pop()).toBe('記事を開いていません');
  });
});

// ── WebPanel.getRemainingMinutes / findMatchAt (bound to hand-built state) ────
describe('WebPanel remaining time & findMatchAt', () => {
  const RealWebPanel = jest.requireActual('../src/vr/browser/WebPanel.js').WebPanel;

  test('getRemainingMinutes scales reading time by unread fraction', () => {
    const panel = Object.create(RealWebPanel.prototype);
    panel.getReadingTimeMinutes = () => 10;
    panel.readerProgress = () => 40;
    expect(RealWebPanel.prototype.getRemainingMinutes.call(panel)).toBe(6);
  });

  test('getRemainingMinutes is null outside the reader', () => {
    const panel = Object.create(RealWebPanel.prototype);
    panel.getReadingTimeMinutes = () => null;
    expect(RealWebPanel.prototype.getRemainingMinutes.call(panel)).toBeNull();
  });

  test('findMatchAt jumps, reports out-of-range, and nulls without a search', () => {
    const panel = Object.create(RealWebPanel.prototype);
    panel._findMatches = [];
    expect(panel.findMatchAt(1)).toBeNull();
    panel._findMatches = [10, 20, 30];
    panel._findIndex = 0;
    panel._markFindHits = jest.fn();
    panel.scrollContentTo = jest.fn();
    expect(panel.findMatchAt(2)).toEqual({ index: 2, total: 3 });
    expect(panel.scrollContentTo).toHaveBeenCalledWith(20);
    expect(panel.findMatchAt(9)).toBe('out');
  });
});
