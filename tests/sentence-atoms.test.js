/**
 * Round-32 atoms (Session 106) — external parity:
 *   next/prev-sentence   NVDA/JAWS Alt+Down/Alt+Up sentence caret
 *   read-sentence        sentence under the scroll, spoken whole
 *   sentence-status      article-wide sentence position
 *   first/last-paragraph first-heading/last-heading's paragraph siblings
 *   read-paragraph-at    read-from-line's indexed paragraph sibling
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

// A two-block article whose first block hard-splits across two display lines
// (Japanese has no spaces — wrap chunks a long word mid-sentence), so the
// sentence→line offset math is exercised on real fragmentation.
function readerPanel() {
  const p = Object.create(WebPanel.prototype);
  p._contentState = 'reader';
  p._readerBlocks = [
    { type: 'p', text: '一文目です。二文目です。三文目です。' },
    { type: 'p', text: '次の段落。' }
  ];
  p._readerLines = [
    { text: '一文目です。二文目で', style: 'p', block: 0 },
    { text: 'す。三文目です。', style: 'p', block: 0 },
    { text: '', style: 'blank', block: 1 },
    { text: '次の段落。', style: 'p', block: 1 }
  ];
  p._readerScroll = 0;
  p._readerScale = 1;
  p._scrollMark = null;
  p._sentenceCaret = null;
  p._wordCaret = null;
  p._drawContent = jest.fn();
  return p;
}

// ── nextSentence / prevSentence (NVDA Alt+Down/Up) ─────────────────────────
describe('WebPanel nextSentence / prevSentence', () => {
  test('walks sentences forward, speaking whole sentences across line breaks', () => {
    const p = readerPanel();
    expect(p.nextSentence(1).sentence).toBe('二文目です。');
    // '三文目です。' starts on the second display line — the caret's line
    // is reported (scroll is a no-op: the whole article fits the viewport).
    const s3 = p.nextSentence(1);
    expect(s3.sentence).toBe('三文目です。');
    expect(s3.line).toBe(1);
    expect(p.nextSentence(1).line).toBe(3);
    expect(p.nextSentence(1)).toBe(null);
  });

  test('walks back across the block boundary', () => {
    const p = readerPanel();
    p._readerScroll = 3;
    expect(p.prevSentence().sentence).toBe('三文目です。');
    expect(p.prevSentence().sentence).toBe('二文目です。');
    expect(p.prevSentence().sentence).toBe('一文目です。');
    expect(p.prevSentence()).toBe(null);
  });

  test('null outside the reader', () => {
    const p = readerPanel();
    p._contentState = 'page';
    expect(p.nextSentence(1)).toBe(null);
    expect(p.currentSentence()).toBe(null);
  });
});

// ── currentSentence / sentence-status ──────────────────────────────────────
describe('WebPanel currentSentence', () => {
  test('reports the sentence under the scroll with article-wide index', () => {
    const p = readerPanel();
    // Line 1 starts mid-sentence ('す。' ends 二文目です。) — the sentence
    // containing the line's start is the current one.
    p._readerScroll = 1;
    const r = p.currentSentence();
    expect(r.sentence).toBe('二文目です。');
    expect(r.index).toBe(2);
    expect(r.total).toBe(4);
  });

  test('blank separator resolves to the following block first sentence', () => {
    const p = readerPanel();
    p._readerScroll = 2; // blank line carrying block 1
    expect(p.currentSentence().sentence).toBe('次の段落。');
    expect(p.currentSentence().index).toBe(4);
  });
});

// ── voice: next/prev/read-sentence + status ────────────────────────────────
describe('VoiceCommands sentence atoms', () => {
  test("'次の文' speaks the next sentence", () => {
    const onSentenceStep = jest.fn(() => ({ sentence: '二文目です。', line: 1 }));
    const vc = makeSpeakingVC({ onSentenceStep });
    vc.processCommand('次の文');
    expect(onSentenceStep).toHaveBeenCalledWith(1);
    expect(vc._spoken.pop()).toBe('二文目です。');
  });

  test("'前の文' announces honestly at the article start", () => {
    const vc = makeSpeakingVC({ onSentenceStep: () => null });
    vc.processCommand('前の文');
    expect(vc._spoken.pop()).toBe('これ以上戻れません');
  });

  test("'next sentence' routes in English", () => {
    const onSentenceStep = jest.fn(() => ({ sentence: 'Second.', line: 1 }));
    const vc = makeSpeakingVC({ onSentenceStep });
    vc.processCommand('next sentence');
    expect(vc._spoken.pop()).toBe('Second.');
  });

  test("'この文を読んで' speaks the sentence under the scroll", () => {
    const vc = makeSpeakingVC({
      onSentence: () => ({ sentence: '二文目です。', index: 2, total: 4 })
    });
    vc.processCommand('この文を読んで');
    expect(vc._spoken.pop()).toBe('二文目です。');
  });

  test("'何文目' announces the article-wide position", () => {
    const vc = makeSpeakingVC({ onSentenceStatus: () => ({ index: 3, total: 12 }) });
    vc.processCommand('何文目');
    expect(vc._spoken.pop()).toBe('現在3文目（全12文）');
  });
});

// ── first/last-paragraph ───────────────────────────────────────────────────
describe('VoiceCommands first/last-paragraph', () => {
  test("'最初の段落' jumps to paragraph 1", () => {
    const onParagraphSelect = jest.fn(() => ({ index: 1, total: 5 }));
    const vc = makeSpeakingVC({ onParagraphSelect });
    vc.processCommand('最初の段落');
    expect(onParagraphSelect).toHaveBeenCalledWith(1);
    expect(vc._spoken.pop()).toBe('1番目の段落（全5）');
  });

  test("'最後の段落' announces the last", () => {
    const vc = makeSpeakingVC({ onLastParagraph: () => ({ index: 5, total: 5 }) });
    vc.processCommand('最後の段落');
    expect(vc._spoken.pop()).toBe('最後の段落（全5）');
  });

  test('empty article announces honestly', () => {
    const vc = makeSpeakingVC({ onLastParagraph: () => null });
    vc.processCommand('最後の段落');
    expect(vc._spoken.pop()).toBe('段落がありません');
  });
});

// ── getParagraphNarrationAt + read-paragraph-at ────────────────────────────
describe('WebPanel getParagraphNarrationAt + voice read-paragraph-at', () => {
  test('returns chunks for the Nth paragraph, out-of-range and reader-off', () => {
    const p = readerPanel();
    const chunks = p.getParagraphNarrationAt(2);
    expect(chunks).toEqual(['次の段落。']);
    expect(p.getParagraphNarrationAt(9)).toBe('out');
    p._contentState = 'page';
    expect(p.getParagraphNarrationAt(1)).toEqual([]);
  });

  test("'3番目の段落を読み上げ' beats paragraph-select and narrates", () => {
    const onParagraphSelect = jest.fn();
    const vc = makeSpeakingVC({
      onParagraphSelect,
      onReadParagraphAt: () => ['三文目です。']
    });
    vc.processCommand('3番目の段落を読み上げ');
    expect(onParagraphSelect).not.toHaveBeenCalled();
    expect(vc._spoken).toContain('3番目の段落を読み上げます');
    expect(vc._spoken).toContain('三文目です。');
  });

  test('out-of-range announces honestly', () => {
    const vc = makeSpeakingVC({ onReadParagraphAt: () => 'out' });
    vc.processCommand('9番目の段落を読み上げ');
    expect(vc._spoken.pop()).toBe('段落9はありません');
  });

  test("'read paragraph 2' routes in English", () => {
    const onReadParagraphAt = jest.fn(() => ['p2']);
    const vc = makeSpeakingVC({ onReadParagraphAt });
    vc.processCommand('read paragraph 2');
    expect(onReadParagraphAt).toHaveBeenCalledWith(2);
  });

  test('plain paragraph jumps still route to paragraph-select', () => {
    const onParagraphSelect = jest.fn(() => ({ index: 3, total: 5 }));
    const vc = makeSpeakingVC({ onParagraphSelect });
    vc.processCommand('3番目の段落');
    expect(onParagraphSelect).toHaveBeenCalledWith(3);
  });
});
