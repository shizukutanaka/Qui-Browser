/**
 * Round-29 atoms:
 *   - say-last-transcript — echo the last ASR transcript (confidence check)
 *   - move-tab-n — Chrome drag-reorder by strip position (indexed moveTab)
 *   - read-from-line — VoiceOver read-from-line (indexed read-here)
 *   - find-query — the Ctrl+F bar's text field, read back
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

// ── say-last-transcript ───────────────────────────────────────────────────────
describe('VoiceCommands say-last-transcript', () => {
  test('\'what did i say\' echoes the previous transcript', () => {
    const vc = makeSpeakingVC();
    vc._prevTranscript = 'open example.com';
    vc.processCommand('what did i say');
    expect(vc._spoken.pop()).toBe('「open example.com」と聞き取りました');
  });

  test('\'何と言った\' echoes in Japanese', () => {
    const vc = makeSpeakingVC();
    vc._prevTranscript = 'タブを閉じて';
    vc.processCommand('何と言った');
    expect(vc._spoken.pop()).toBe('「タブを閉じて」と聞き取りました');
  });

  test('nothing heard announces honestly', () => {
    const vc = makeSpeakingVC();
    vc.processCommand('何と言った');
    expect(vc._spoken.pop()).toBe('まだ何も聞き取っていません');
  });
});

// ── move-tab-n ────────────────────────────────────────────────────────────────
describe('VoiceCommands move-tab-n', () => {
  const tmWith = (n, moveResult = true) => ({
    tabs: Array.from({ length: n }, (_, i) => ({ currentTitle: `T${i}` })),
    moveTab: jest.fn(() => moveResult)
  });

  test('\'タブ3を左に移動\' moves index 2 left', () => {
    const tm = tmWith(4);
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('タブ3を左に移動');
    expect(tm.moveTab).toHaveBeenCalledWith(2, -1);
    expect(vc._spoken.pop()).toBe('タブ3を左に移動しました');
  });

  test('\'move tab 2 right\' moves index 1 right', () => {
    const tm = tmWith(3);
    const vc = makeSpeakingVC({ tabManager: tm });
    vc.processCommand('move tab 2 right');
    expect(tm.moveTab).toHaveBeenCalledWith(1, 1);
    expect(vc._spoken.pop()).toBe('タブ2を右に移動しました');
  });

  test('out-of-range announces honestly', () => {
    const vc = makeSpeakingVC({ tabManager: tmWith(2) });
    vc.processCommand('タブ9を左に移動');
    expect(vc._spoken.pop()).toBe('タブ9はありません');
  });

  test('refused move announces honestly (boundary/pin)', () => {
    const vc = makeSpeakingVC({ tabManager: tmWith(3, false) });
    vc.processCommand('タブ1を左に移動');
    expect(vc._spoken.pop()).toBe('これ以上移動できません');
  });
});

// ── read-from-line ────────────────────────────────────────────────────────────
describe('VoiceCommands read-from-line', () => {
  test('\'30行目から読み上げ\' reads from line 29', () => {
    const onReadFromLine = jest.fn(() => ['chunk1', 'chunk2']);
    const vc = makeSpeakingVC({ onReadFromLine });
    vc.processCommand('30行目から読み上げ');
    expect(onReadFromLine).toHaveBeenCalledWith(29);
    expect(vc._spoken[0]).toBe('30行目から読み上げます');
  });

  test('\'read from line 10\' routes in English', () => {
    const onReadFromLine = jest.fn(() => ['c']);
    const vc = makeSpeakingVC({ onReadFromLine });
    vc.processCommand('read from line 10');
    expect(onReadFromLine).toHaveBeenCalledWith(9);
  });

  test('out-of-range line announces honestly', () => {
    const vc = makeSpeakingVC({ onReadFromLine: () => null });
    vc.processCommand('99行目から読み上げ');
    expect(vc._spoken.pop()).toBe('99行目はありません');
  });

  test('no article announces honestly', () => {
    const vc = makeSpeakingVC({ onReadFromLine: () => [] });
    vc.processCommand('5行目から読み上げ');
    expect(vc._spoken.pop()).toBe('記事を開いていません');
  });

  test('bare \'30行目\' still routes to reader-goto-line', () => {
    const onReaderLine = jest.fn(() => 'ok');
    const vc = makeSpeakingVC({ onReaderLine });
    vc.processCommand('30行目');
    expect(onReaderLine).toHaveBeenCalledWith(30);
  });
});

// ── find-query ────────────────────────────────────────────────────────────────
describe('VoiceCommands find-query', () => {
  test('\'検索語は\' announces the active query', () => {
    const vc = makeSpeakingVC({ onFindQuery: () => 'キーワード' });
    vc.processCommand('検索語は');
    expect(vc._spoken.pop()).toBe('「キーワード」を検索中です');
  });

  test('\'find query\' queries instead of searching for "query"', () => {
    const findInReader = jest.fn(() => 3);
    const vc = makeSpeakingVC({
      onFindQuery: () => 'x',
      tabManager: { getActiveTab: () => ({ findInReader }) }
    });
    vc.processCommand('find query');
    expect(findInReader).not.toHaveBeenCalled();
    expect(vc._spoken.pop()).toBe('「x」を検索中です');
  });

  test('no active search announces honestly', () => {
    const vc = makeSpeakingVC({ onFindQuery: () => null });
    vc.processCommand('何を検索中');
    expect(vc._spoken.pop()).toBe('検索していません');
  });
});

// ── WebPanel.findQuery (bound to hand-built state) ────────────────────────────
describe('WebPanel findQuery', () => {
  const RealWebPanel = jest.requireActual('../src/vr/browser/WebPanel.js').WebPanel;

  function readerPanel() {
    const panel = Object.create(RealWebPanel.prototype);
    panel._contentState = 'reader';
    panel._readerLines = [{ text: 'one two' }, { text: 'three four' }];
    panel._readerScroll = 0;
    panel._readerScale = 1;
    panel._findMatches = [];
    panel._findIndex = -1;
    panel._lastFindQuery = null;
    panel._scrollMark = null;
    panel._drawContent = jest.fn();
    return panel;
  }

  test('findInReader stores the query; clearFind wipes it', () => {
    const panel = readerPanel();
    panel.findInReader('three');
    expect(panel.findQuery()).toBe('three');
    panel.clearFind();
    expect(panel.findQuery()).toBeNull();
  });

  test('empty query clears the stored query', () => {
    const panel = readerPanel();
    panel.findInReader('three');
    panel.findInReader('');
    expect(panel.findQuery()).toBeNull();
  });
});
