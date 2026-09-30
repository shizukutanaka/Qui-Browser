/**
 * Round-20 tab-history & position atoms:
 *   - voice '戻る'/'進む' announce the per-tab result honestly — goBack/
 *     goForward's bool (controller faceB/faceA parity) instead of a static
 *     confirmationText that claims success at the earliest/latest entry
 *   - reader-scroll-lines — 'N行進む'/'N行戻る' relative scrolling
 *   - reader-progress — '進捗' percent-read announce
 */

global.SpeechSynthesisUtterance = function (text) { this.text = text; };

const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');
const { visibleLinesFor } = require('../src/vr/browser/readerLayout.js');

function makeSpeakingVC(extra = {}) {
  const vc = new VoiceCommands();
  vc.callbacks.onSpeak = () => {};
  vc.connectBrowser(extra);
  const spoken = [];
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: jest.fn() };
  vc._spoken = spoken;
  return vc;
}

// ── per-tab back/forward ──────────────────────────────────────────────────────
describe('VoiceCommands per-tab back/forward', () => {
  const tm = (tab) => ({ getActiveTab: () => tab });

  test('\'戻る\' calls goBack and confirms', () => {
    const goBack = jest.fn(() => true);
    const vc = makeSpeakingVC({ tabManager: tm({ goBack }) });
    vc.processCommand('戻る');
    expect(goBack).toHaveBeenCalled();
    expect(vc._spoken.pop()).toBe('戻ります');
  });

  test('\'戻る\' at the earliest entry announces honestly', () => {
    const vc = makeSpeakingVC({ tabManager: tm({ goBack: () => false }) });
    vc.processCommand('戻る');
    expect(vc._spoken.pop()).toBe('戻れません');
  });

  test('\'進む\' calls goForward and confirms', () => {
    const goForward = jest.fn(() => true);
    const vc = makeSpeakingVC({ tabManager: tm({ goForward }) });
    vc.processCommand('進む');
    expect(goForward).toHaveBeenCalled();
    expect(vc._spoken.pop()).toBe('進みます');
  });

  test('\'進む\' at the latest entry announces honestly', () => {
    const vc = makeSpeakingVC({ tabManager: tm({ goForward: () => false }) });
    vc.processCommand('進む');
    expect(vc._spoken.pop()).toBe('進めません');
  });
});

// ── reader-scroll-lines ───────────────────────────────────────────────────────
describe('VoiceCommands reader-scroll-lines', () => {
  test('\'30行進む\' scrolls forward and confirms', () => {
    const onReaderScroll = jest.fn(() => true);
    const vc = makeSpeakingVC({ onReaderScroll });
    vc.processCommand('30行進む');
    expect(onReaderScroll).toHaveBeenCalledWith(30);
    expect(vc._spoken.pop()).toBe('30行進みました');
  });

  test('\'10行戻る\' scrolls backward and confirms', () => {
    const onReaderScroll = jest.fn(() => true);
    const vc = makeSpeakingVC({ onReaderScroll });
    vc.processCommand('10行戻る');
    expect(onReaderScroll).toHaveBeenCalledWith(-10);
    expect(vc._spoken.pop()).toBe('10行戻りました');
  });

  test('\'scroll down 5 lines\' routes in English', () => {
    const onReaderScroll = jest.fn(() => true);
    const vc = makeSpeakingVC({ onReaderScroll });
    vc.processCommand('scroll down 5 lines');
    expect(onReaderScroll).toHaveBeenCalledWith(5);
  });

  test('no more room announces honestly', () => {
    const vc = makeSpeakingVC({ onReaderScroll: () => false });
    vc.processCommand('30行進む');
    expect(vc._spoken.pop()).toBe('これ以上進めません');
  });

  test('\'30行目へ\' still routes to reader-goto-line', () => {
    const onReaderScroll = jest.fn();
    const vc = makeSpeakingVC({ onReaderScroll, onReaderLine: () => 29 });
    vc.processCommand('30行目へ');
    expect(onReaderScroll).not.toHaveBeenCalled();
  });

  test('\'10秒戻る\' still routes to video-seek, not scroll-lines', () => {
    const onReaderScroll = jest.fn();
    const onVideoSeek = jest.fn(() => 5);
    const vc = makeSpeakingVC({ onReaderScroll, onVideoSeek });
    vc.processCommand('10秒戻る');
    expect(onReaderScroll).not.toHaveBeenCalled();
    expect(onVideoSeek).toHaveBeenCalledWith(-10);
  });
});

// ── reader-progress ───────────────────────────────────────────────────────────
describe('VoiceCommands reader-progress', () => {
  test('\'進捗\' announces the percent read', () => {
    const vc = makeSpeakingVC({ onReaderProgress: () => 42 });
    vc.processCommand('進捗');
    expect(vc._spoken.pop()).toBe('記事の42%を読みました');
  });

  test('\'reading progress\' routes in English', () => {
    const vc = makeSpeakingVC({ onReaderProgress: () => 7 });
    vc.processCommand('reading progress');
    expect(vc._spoken.pop()).toBe('記事の7%を読みました');
  });

  test('no article announces honestly', () => {
    const vc = makeSpeakingVC({ onReaderProgress: () => null });
    vc.processCommand('進捗');
    expect(vc._spoken.pop()).toBe('記事を開いていません');
  });
});

// ── WebPanel.readerProgress (bound to a hand-built state) ────────────────────
describe('WebPanel.readerProgress', () => {
  const RealWebPanel = jest.requireActual('../src/vr/browser/WebPanel.js').WebPanel;

  const call = (state) => RealWebPanel.prototype.readerProgress.call(state);

  test('null outside the reader state', () => {
    expect(call({ _contentState: 'web', _readerLines: [1], _readerScroll: 0, _readerScale: 1 }))
      .toBeNull();
  });

  test('bottom edge over total, capped at 100', () => {
    const lines = new Array(100).fill({ text: 'x' });
    const visible = visibleLinesFor(100, 1);
    const mid = call({ _contentState: 'reader', _readerLines: lines, _readerScroll: 40, _readerScale: 1 });
    expect(mid).toBe(Math.min(100, Math.round(((40 + visible) / 100) * 100)));
    const end = call({ _contentState: 'reader', _readerLines: lines, _readerScroll: 96, _readerScale: 1 });
    expect(end).toBe(100);
  });
});
