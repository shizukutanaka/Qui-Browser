/**
 * Round-22 reader select atoms:
 *   - heading-select — nextHeading's indexed sibling ('3番目の見出し')
 *   - find-status — announce find position without moving
 *   - find-first / find-last — tail siblings of find-match-select
 *   - read-line — VoiceOver "read current line" parity
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

// ── heading-select ────────────────────────────────────────────────────────────
describe('VoiceCommands heading-select', () => {
  test('\'3番目の見出し\' jumps via the hook', () => {
    const onHeadingSelect = jest.fn(() => ({ index: 3, total: 6 }));
    const vc = makeSpeakingVC({ onHeadingSelect });
    vc.processCommand('3番目の見出し');
    expect(onHeadingSelect).toHaveBeenCalledWith(3);
    expect(vc._spoken.pop()).toBe('3番目の見出し（全6）');
  });

  test('\'見出し2\' phrasing also routes', () => {
    const onHeadingSelect = jest.fn(() => ({ index: 2, total: 4 }));
    const vc = makeSpeakingVC({ onHeadingSelect });
    vc.processCommand('見出し2');
    expect(onHeadingSelect).toHaveBeenCalledWith(2);
  });

  test('\'heading 5\' routes in English', () => {
    const onHeadingSelect = jest.fn(() => ({ index: 5, total: 5 }));
    const vc = makeSpeakingVC({ onHeadingSelect });
    vc.processCommand('heading 5');
    expect(onHeadingSelect).toHaveBeenCalledWith(5);
  });

  test('out of range announces honestly', () => {
    const vc = makeSpeakingVC({ onHeadingSelect: () => 'out' });
    vc.processCommand('9番目の見出し');
    expect(vc._spoken.pop()).toBe('見出し9はありません');
  });

  test('no headings announces honestly', () => {
    const vc = makeSpeakingVC({ onHeadingSelect: () => null });
    vc.processCommand('2番目の見出し');
    expect(vc._spoken.pop()).toBe('見出しがありません');
  });

  test('\'次の見出し\' still routes to next-heading', () => {
    const onHeadingSelect = jest.fn();
    const vc = makeSpeakingVC({
      onHeadingSelect,
      tabManager: { getActiveTab: () => ({ nextHeading: () => ({ index: 1, total: 2 }) }) }
    });
    vc.processCommand('次の見出し');
    expect(onHeadingSelect).not.toHaveBeenCalled();
  });
});

// ── find-status ───────────────────────────────────────────────────────────────
describe('VoiceCommands find-status', () => {
  test('\'何件目\' announces the position without moving', () => {
    const vc = makeSpeakingVC({ onFindStatus: () => ({ index: 2, total: 5 }) });
    vc.processCommand('何件目');
    expect(vc._spoken.pop()).toBe('5件中2件目');
  });

  test('\'how many matches\' routes in English', () => {
    const vc = makeSpeakingVC({ onFindStatus: () => ({ index: 1, total: 3 }) });
    vc.processCommand('how many matches');
    expect(vc._spoken.pop()).toBe('3件中1件目');
  });

  test('\'find status\' stays with find-in-page (term "status" is searchable)', () => {
    const findInReader = jest.fn(() => 2);
    const vc = makeSpeakingVC({
      onFindStatus: () => ({ index: 1, total: 3 }),
      tabManager: { getActiveTab: () => ({ findInReader }) }
    });
    vc.processCommand('find status');
    expect(findInReader).toHaveBeenCalledWith('status');
  });

  test('no active search announces honestly', () => {
    const vc = makeSpeakingVC({ onFindStatus: () => null });
    vc.processCommand('何件目');
    expect(vc._spoken.pop()).toBe('検索をしていません');
  });
});

// ── find-first / find-last ────────────────────────────────────────────────────
describe('VoiceCommands find-first / find-last', () => {
  test('\'最初のヒット\' jumps to index 1', () => {
    const onFindMatch = jest.fn(() => ({ index: 1, total: 4 }));
    const vc = makeSpeakingVC({ onFindMatch });
    vc.processCommand('最初のヒット');
    expect(onFindMatch).toHaveBeenCalledWith(1);
    expect(vc._spoken.pop()).toBe('1件目に移動しました');
  });

  test('\'最後のヒット\' jumps via the last hook', () => {
    const onFindLast = jest.fn(() => ({ index: 4, total: 4 }));
    const vc = makeSpeakingVC({ onFindLast });
    vc.processCommand('最後のヒット');
    expect(vc._spoken.pop()).toBe('4件目に移動しました');
  });

  test('\'last match\' routes in English', () => {
    const onFindLast = jest.fn(() => ({ index: 7, total: 7 }));
    const vc = makeSpeakingVC({ onFindLast });
    vc.processCommand('last match');
    expect(vc._spoken.pop()).toBe('7件目に移動しました');
  });

  test('no search announces honestly for both', () => {
    const vc = makeSpeakingVC({ onFindMatch: () => null, onFindLast: () => null });
    vc.processCommand('最初のヒット');
    expect(vc._spoken.pop()).toBe('検索をしていません');
    vc.processCommand('最後のヒット');
    expect(vc._spoken.pop()).toBe('検索をしていません');
  });
});

// ── read-line ─────────────────────────────────────────────────────────────────
describe('VoiceCommands read-line', () => {
  test('\'この行を読んで\' speaks the current line', () => {
    const vc = makeSpeakingVC({ onReadLine: () => '段落の最初の行です' });
    vc.processCommand('この行を読んで');
    expect(vc._spoken.pop()).toBe('段落の最初の行です');
  });

  test('\'read the current line\' routes in English', () => {
    const vc = makeSpeakingVC({ onReadLine: () => 'current line text' });
    vc.processCommand('read the current line');
    expect(vc._spoken.pop()).toBe('current line text');
  });

  test('no article announces honestly', () => {
    const vc = makeSpeakingVC({ onReadLine: () => null });
    vc.processCommand('この行を読んで');
    expect(vc._spoken.pop()).toBe('記事を開いていません');
  });
});

// ── WebPanel methods (bound to hand-built state) ──────────────────────────────
describe('WebPanel headingAt / findStatus / findLastMatch / currentLine', () => {
  const RealWebPanel = jest.requireActual('../src/vr/browser/WebPanel.js').WebPanel;

  test('headingAt jumps, reports out-of-range, and nulls outside reader', () => {
    const panel = Object.create(RealWebPanel.prototype);
    panel._contentState = 'idle';
    expect(panel.headingAt(1)).toBeNull();
    panel._contentState = 'reader';
    panel._readerLines = [
      { text: 't', style: 'title' }, { text: 'p', style: 'p' }, { text: 'h', style: 'h' }
    ];
    panel._readerScroll = 0;
    panel.scrollContentTo = jest.fn();
    expect(panel.headingAt(2)).toEqual({ index: 2, total: 2 });
    expect(panel.scrollContentTo).toHaveBeenCalledWith(2);
    expect(panel.headingAt(9)).toBe('out');
  });

  test('findStatus reports position or null', () => {
    const panel = Object.create(RealWebPanel.prototype);
    panel._findMatches = [];
    expect(panel.findStatus()).toBeNull();
    panel._findMatches = [3, 8];
    panel._findIndex = 1;
    expect(panel.findStatus()).toEqual({ index: 2, total: 2 });
  });

  test('findLastMatch lands on the last hit', () => {
    const panel = Object.create(RealWebPanel.prototype);
    panel._findMatches = [3, 8, 12];
    panel._findIndex = 0;
    panel._markFindHits = jest.fn();
    panel.scrollContentTo = jest.fn();
    expect(panel.findLastMatch()).toEqual({ index: 3, total: 3 });
    expect(panel.scrollContentTo).toHaveBeenCalledWith(12);
  });

  test('currentLine returns the line under the scroll or null', () => {
    const panel = Object.create(RealWebPanel.prototype);
    panel._contentState = 'idle';
    expect(panel.currentLine()).toBeNull();
    panel._contentState = 'reader';
    panel._readerLines = [{ text: 'a' }, { text: 'b' }, { text: 'c' }];
    panel._readerScroll = 1;
    expect(panel.currentLine()).toBe('b');
    panel._readerScroll = 99;
    expect(panel.currentLine()).toBe('c');
  });
});
