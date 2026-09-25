/**
 * Round-23 paragraph atoms (NVDA/JAWS Ctrl+Down/Ctrl+Up parity) + char-count:
 *   - next-paragraph / prev-paragraph — wrap-and-announce like next-heading
 *   - paragraph-select — heading-select's paragraph sibling
 *   - paragraph-status — findStatus's paragraph sibling
 *   - char-count — the reading-time numerator as a status atom
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

// ── next / prev paragraph ─────────────────────────────────────────────────────
describe('VoiceCommands paragraph step', () => {
  test('\'次の段落\' steps forward via the hook', () => {
    const onParagraphStep = jest.fn(() => ({ index: 2, total: 5 }));
    const vc = makeSpeakingVC({ onParagraphStep });
    vc.processCommand('次の段落');
    expect(onParagraphStep).toHaveBeenCalledWith(1);
    expect(vc._spoken.pop()).toBe('2番目の段落（全5）');
  });

  test('\'前の段落\' steps back via the hook', () => {
    const onParagraphStep = jest.fn(() => ({ index: 1, total: 5 }));
    const vc = makeSpeakingVC({ onParagraphStep });
    vc.processCommand('前の段落');
    expect(onParagraphStep).toHaveBeenCalledWith(-1);
    expect(vc._spoken.pop()).toBe('1番目の段落（全5）');
  });

  test('\'next paragraph\' routes in English', () => {
    const onParagraphStep = jest.fn(() => ({ index: 3, total: 3 }));
    const vc = makeSpeakingVC({ onParagraphStep });
    vc.processCommand('next paragraph');
    expect(onParagraphStep).toHaveBeenCalledWith(1);
  });

  test('no paragraphs announces honestly', () => {
    const vc = makeSpeakingVC({ onParagraphStep: () => null });
    vc.processCommand('次の段落');
    expect(vc._spoken.pop()).toBe('段落がありません');
  });
});

// ── paragraph-select ──────────────────────────────────────────────────────────
describe('VoiceCommands paragraph-select', () => {
  test('\'3番目の段落\' jumps via the hook', () => {
    const onParagraphSelect = jest.fn(() => ({ index: 3, total: 6 }));
    const vc = makeSpeakingVC({ onParagraphSelect });
    vc.processCommand('3番目の段落');
    expect(onParagraphSelect).toHaveBeenCalledWith(3);
    expect(vc._spoken.pop()).toBe('3番目の段落（全6）');
  });

  test('\'paragraph 4\' routes in English', () => {
    const onParagraphSelect = jest.fn(() => ({ index: 4, total: 4 }));
    const vc = makeSpeakingVC({ onParagraphSelect });
    vc.processCommand('paragraph 4');
    expect(onParagraphSelect).toHaveBeenCalledWith(4);
  });

  test('out of range announces honestly', () => {
    const vc = makeSpeakingVC({ onParagraphSelect: () => 'out' });
    vc.processCommand('9番目の段落');
    expect(vc._spoken.pop()).toBe('段落9はありません');
  });

  test('\'3番目の見出し\' still routes to heading-select', () => {
    const onParagraphSelect = jest.fn();
    const vc = makeSpeakingVC({
      onParagraphSelect, onHeadingSelect: () => ({ index: 3, total: 4 })
    });
    vc.processCommand('3番目の見出し');
    expect(onParagraphSelect).not.toHaveBeenCalled();
  });
});

// ── paragraph-status ──────────────────────────────────────────────────────────
describe('VoiceCommands paragraph-status', () => {
  test('\'何段落\' announces the position without moving', () => {
    const vc = makeSpeakingVC({ onParagraphStatus: () => ({ index: 2, total: 7 }) });
    vc.processCommand('何段落');
    expect(vc._spoken.pop()).toBe('全7段落の2段落目');
  });

  test('\'which paragraph\' routes in English', () => {
    const vc = makeSpeakingVC({ onParagraphStatus: () => ({ index: 5, total: 5 }) });
    vc.processCommand('which paragraph');
    expect(vc._spoken.pop()).toBe('全5段落の5段落目');
  });

  test('no article announces honestly', () => {
    const vc = makeSpeakingVC({ onParagraphStatus: () => null });
    vc.processCommand('何段落');
    expect(vc._spoken.pop()).toBe('記事を開いていません');
  });
});

// ── char-count ────────────────────────────────────────────────────────────────
describe('VoiceCommands char-count', () => {
  test('\'何文字\' announces the total', () => {
    const vc = makeSpeakingVC({ onCharCount: () => 2400 });
    vc.processCommand('何文字');
    expect(vc._spoken.pop()).toBe('記事は2400文字です');
  });

  test('\'how many characters\' routes in English', () => {
    const vc = makeSpeakingVC({ onCharCount: () => 500 });
    vc.processCommand('how many characters');
    expect(vc._spoken.pop()).toBe('記事は500文字です');
  });

  test('no article announces honestly', () => {
    const vc = makeSpeakingVC({ onCharCount: () => null });
    vc.processCommand('文字数');
    expect(vc._spoken.pop()).toBe('記事を開いていません');
  });
});

// ── WebPanel methods (bound to hand-built state) ──────────────────────────────
describe('WebPanel paragraph layer & char count', () => {
  const RealWebPanel = jest.requireActual('../src/vr/browser/WebPanel.js').WebPanel;

  function readerPanel(scroll = 0) {
    const panel = Object.create(RealWebPanel.prototype);
    panel._contentState = 'reader';
    // two title lines (block undefined), para0 = lines 2-3, para1 = line 4,
    // para2 = lines 5-6
    panel._readerLines = [
      { text: 'T1' }, { text: 'T2' },
      { text: 'a', block: 0 }, { text: 'b', block: 0 },
      { text: 'c', block: 1 },
      { text: 'd', block: 2 }, { text: 'e', block: 2 }
    ];
    panel._readerScroll = scroll;
    panel.scrollContentTo = jest.fn((i) => { panel._readerScroll = i; });
    return panel;
  }

  test('nextParagraph wraps and reports index/total', () => {
    const panel = readerPanel(4);
    expect(panel.nextParagraph()).toEqual({ index: 4, total: 4 });
    expect(panel.scrollContentTo).toHaveBeenCalledWith(5);
    // scrollContentTo moved the scroll — the next step wraps to the top.
    expect(panel.nextParagraph()).toEqual({ index: 1, total: 4 });
    expect(panel.scrollContentTo).toHaveBeenCalledWith(0);
    panel.scrollContentTo.mockClear();
    expect(panel.prevParagraph()).toEqual({ index: 4, total: 4 });
    expect(panel.scrollContentTo).toHaveBeenCalledWith(5);
  });

  test('nextParagraph nulls outside the reader', () => {
    const panel = readerPanel();
    panel._contentState = 'idle';
    expect(panel.nextParagraph()).toBeNull();
  });

  test('paragraphAt jumps, reports out-of-range, and nulls outside reader', () => {
    const panel = readerPanel();
    expect(panel.paragraphAt(3)).toEqual({ index: 3, total: 4 });
    expect(panel.scrollContentTo).toHaveBeenCalledWith(4);
    expect(panel.paragraphAt(9)).toBe('out');
    panel._contentState = 'idle';
    expect(panel.paragraphAt(1)).toBeNull();
  });

  test('paragraphStatus reports the holding paragraph', () => {
    expect(readerPanel(0).paragraphStatus()).toEqual({ index: 1, total: 4 });
    expect(readerPanel(3).paragraphStatus()).toEqual({ index: 2, total: 4 });
    expect(readerPanel(6).paragraphStatus()).toEqual({ index: 4, total: 4 });
  });

  test('getCharCount sums line text lengths or nulls outside reader', () => {
    const panel = readerPanel();
    expect(panel.getCharCount()).toBe(9);
    panel._contentState = 'idle';
    expect(panel.getCharCount()).toBeNull();
  });
});
