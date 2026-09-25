/**
 * Round-24 status atoms:
 *   - read-paragraph — NVDA "read current paragraph" parity
 *   - line-status — announce line position without moving
 *   - tab-status — announce strip position
 *   - privacy-status / pin-status — honest answers to state questions
 *     (phrasings stay unambiguous: 'ピン留め' / 'プライベートタブ' /
 *     'プライベートモード' belong to pin-tab / private-tab / private-mode)
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

// ── read-paragraph ────────────────────────────────────────────────────────────
describe('VoiceCommands read-paragraph', () => {
  test('\'この段落を読み上げ\' reads via the hook', () => {
    const onReadParagraph = jest.fn(() => ['段落の文。', '続きの文。']);
    const vc = makeSpeakingVC({ onReadParagraph });
    vc.processCommand('この段落を読み上げ');
    expect(onReadParagraph).toHaveBeenCalled();
    expect(vc._spoken).toContain('読み上げを開始します');
  });

  test('\'read the current paragraph\' routes in English', () => {
    const onReadParagraph = jest.fn(() => ['A sentence.']);
    const vc = makeSpeakingVC({ onReadParagraph });
    vc.processCommand('read the current paragraph');
    expect(vc._spoken).toContain('読み上げを開始します');
  });

  test('no chunks announces nothing-to-read (title region / no article)', () => {
    const vc = makeSpeakingVC({ onReadParagraph: () => [] });
    vc.processCommand('この段落を読み上げ');
    expect(vc._spoken.pop()).toBe('読み上げられる文章がありません');
  });
});

// ── line-status ───────────────────────────────────────────────────────────────
describe('VoiceCommands line-status', () => {
  test('\'何行目\' announces the position without moving', () => {
    const vc = makeSpeakingVC({ onLineStatus: () => ({ index: 31, total: 100 }) });
    vc.processCommand('何行目');
    expect(vc._spoken.pop()).toBe('現在31行目（全100行）');
  });

  test('\'line number\' routes in English', () => {
    const vc = makeSpeakingVC({ onLineStatus: () => ({ index: 5, total: 40 }) });
    vc.processCommand('line number');
    expect(vc._spoken.pop()).toBe('現在5行目（全40行）');
  });

  test('no article announces honestly', () => {
    const vc = makeSpeakingVC({ onLineStatus: () => null });
    vc.processCommand('何行目');
    expect(vc._spoken.pop()).toBe('記事を開いていません');
  });
});

// ── tab-status ────────────────────────────────────────────────────────────────
describe('VoiceCommands tab-status', () => {
  test('\'タブは何個\' announces the strip position', () => {
    const vc = makeSpeakingVC({ onTabStatus: () => ({ index: 2, total: 3 }) });
    vc.processCommand('タブは何個');
    expect(vc._spoken.pop()).toBe('3個のタブの2枚目を表示中');
  });

  test('\'which tab\' routes in English', () => {
    const vc = makeSpeakingVC({ onTabStatus: () => ({ index: 1, total: 4 }) });
    vc.processCommand('which tab');
    expect(vc._spoken.pop()).toBe('4個のタブの1枚目を表示中');
  });

  test('no tabs announces honestly', () => {
    const vc = makeSpeakingVC({ onTabStatus: () => null });
    vc.processCommand('タブは何個');
    expect(vc._spoken.pop()).toBe('タブがありません');
  });
});

// ── privacy-status / pin-status ───────────────────────────────────────────────
describe('VoiceCommands privacy-status / pin-status', () => {
  test('\'プライベートかどうか\' announces private state', () => {
    const vc = makeSpeakingVC({ onPrivacyStatus: () => true });
    vc.processCommand('プライベートかどうか');
    expect(vc._spoken.pop()).toBe('プライベートタブです');
  });

  test('\'is it private\' announces normal state in English', () => {
    const vc = makeSpeakingVC({ onPrivacyStatus: () => false });
    vc.processCommand('is it private');
    expect(vc._spoken.pop()).toBe('通常のタブです');
  });

  test('\'ピンがありますか\' announces pinned state', () => {
    const vc = makeSpeakingVC({ onPinStatus: () => true });
    vc.processCommand('ピンがありますか');
    expect(vc._spoken.pop()).toBe('ピン留めされています');
  });

  test('\'is it pinned\' announces unpinned in English', () => {
    const vc = makeSpeakingVC({ onPinStatus: () => false });
    vc.processCommand('is it pinned');
    expect(vc._spoken.pop()).toBe('ピン留めされていません');
  });

  test('no tab announces honestly', () => {
    const vc = makeSpeakingVC({ onPrivacyStatus: () => null, onPinStatus: () => null });
    vc.processCommand('プライベートかどうか');
    expect(vc._spoken.pop()).toBe('タブがありません');
    vc.processCommand('ピンがありますか');
    expect(vc._spoken.pop()).toBe('タブがありません');
  });

  test('\'ピン留め\' still toggles (pin-tab owns the bare phrase)', () => {
    const onPinStatus = jest.fn();
    const togglePin = jest.fn(() => 'pinned');
    const vc = makeSpeakingVC({
      onPinStatus,
      tabManager: { togglePin, activeIndex: 0 }
    });
    vc.processCommand('ピン留め');
    expect(onPinStatus).not.toHaveBeenCalled();
    expect(togglePin).toHaveBeenCalledWith(0);
  });

  test('\'プライベートタブ\' still opens a private tab', () => {
    const onPrivacyStatus = jest.fn();
    const newPrivateTab = jest.fn(() => ({}));
    const vc = makeSpeakingVC({
      onPrivacyStatus,
      tabManager: { newPrivateTab }
    });
    vc.processCommand('プライベートタブ');
    expect(onPrivacyStatus).not.toHaveBeenCalled();
    expect(newPrivateTab).toHaveBeenCalled();
  });
});

// ── WebPanel methods (bound to hand-built state) ──────────────────────────────
describe('WebPanel lineStatus & getParagraphNarration', () => {
  const RealWebPanel = jest.requireActual('../src/vr/browser/WebPanel.js').WebPanel;

  test('lineStatus reports position or null', () => {
    const panel = Object.create(RealWebPanel.prototype);
    panel._contentState = 'idle';
    expect(panel.lineStatus()).toBeNull();
    panel._contentState = 'reader';
    panel._readerLines = [{ text: 'a' }, { text: 'b' }, { text: 'c' }];
    panel._readerScroll = 1;
    expect(panel.lineStatus()).toEqual({ index: 2, total: 3 });
    panel._readerScroll = 99;
    expect(panel.lineStatus()).toEqual({ index: 3, total: 3 });
  });

  test('getParagraphNarration chunks the block under the scroll', () => {
    const panel = Object.create(RealWebPanel.prototype);
    panel._contentState = 'reader';
    panel._readerLines = [
      { text: 'T' },                          // title, no block
      { text: 'first sentence.', block: 0 },
      { text: 'second para.', block: 1 }
    ];
    panel._readerBlocks = [
      { text: 'first sentence.' },
      { text: 'second para.' }
    ];
    panel._readerScroll = 0;
    expect(panel.getParagraphNarration()).toEqual([]);   // title region
    panel._readerScroll = 2;
    expect(panel.getParagraphNarration()).toEqual(['second para.']);
    panel._contentState = 'idle';
    expect(panel.getParagraphNarration()).toEqual([]);
  });
});
