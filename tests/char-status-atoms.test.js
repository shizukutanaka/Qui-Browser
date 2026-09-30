/**
 * Round-33 atoms (Session 107) — external parity:
 *   next/prev-char        NVDA/JAWS Left/Right single-character review
 *   read-word/spell-word  NVDA numpad-5 (+double) current word + spelling
 *   status queries        'how is X set' twins: speech rate/pitch, voice name,
 *                         language, search engine, every voice stepper
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

function readerPanel() {
  const p = Object.create(WebPanel.prototype);
  p._contentState = 'reader';
  p._readerBlocks = [{ type: 'p', text: 'ab cd ef' }];
  p._readerLines = [
    { text: 'ab cd', style: 'p', block: 0 },
    { text: 'ef', style: 'p', block: 0 }
  ];
  p._readerScroll = 0;
  p._readerScale = 1;
  p._scrollMark = null;
  p._wordCaret = null;
  p._charCaret = null;
  p._sentenceCaret = null;
  p._drawContent = jest.fn();
  return p;
}

// ── nextChar / prevChar (NVDA Left/Right) ──────────────────────────────────
describe('WebPanel nextChar / prevChar', () => {
  test('walks grapheme clusters across a line boundary', () => {
    const p = readerPanel();
    expect(p.nextChar(1).char).toBe('a');
    expect(p.nextChar(1).char).toBe('b');
    // ' ' is a grapheme too — the caret reports every unit.
    expect(p.nextChar(1).char).toBe(' ');
    expect(p.nextChar(1).char).toBe('c');
    expect(p.nextChar(1).char).toBe('d');
    const cross = p.nextChar(1);
    expect(cross.char).toBe('e');
    expect(cross.line).toBe(1);
    expect(p.nextChar(1).char).toBe('f');
    expect(p.nextChar(1)).toBe(null);
  });

  test('walks back across the boundary', () => {
    const p = readerPanel();
    p._readerScroll = 1;
    expect(p.prevChar().char).toBe('f');
    expect(p.prevChar().char).toBe('e');
    expect(p.prevChar().char).toBe('d');
    expect(p.prevChar().char).toBe('c');
    expect(p.prevChar().char).toBe(' ');
    expect(p.prevChar().char).toBe('b');
    expect(p.prevChar().char).toBe('a');
    expect(p.prevChar()).toBe(null);
  });

  test('null outside the reader', () => {
    const p = readerPanel();
    p._contentState = 'page';
    expect(p.nextChar(1)).toBe(null);
    expect(p.currentWord()).toBe(null);
  });
});

// ── currentWord / spellWord (NVDA numpad-5) ────────────────────────────────
describe('WebPanel currentWord / spellWord', () => {
  test('reads the scroll line first word when no caret walked', () => {
    const p = readerPanel();
    expect(p.currentWord().word).toBe('ab');
  });

  test('reads the caret word once word-nav has walked', () => {
    const p = readerPanel();
    p.nextWord(1); // 'ab'
    p.nextWord(1); // 'cd'
    expect(p.currentWord().word).toBe('cd');
  });

  test('spells the current word grapheme-by-grapheme', () => {
    const p = readerPanel();
    expect(p.spellWord().spelled).toBe('a、b');
  });

  test('null on a wordless state', () => {
    const p = readerPanel();
    p._contentState = 'page';
    expect(p.spellWord()).toBe(null);
  });
});

// ── voice: char/word commands ──────────────────────────────────────────
describe('VoiceCommands char/word atoms', () => {
  test("'次の文字' speaks the next char", () => {
    const onCharStep = jest.fn(() => ({ char: 'あ', line: 0 }));
    const vc = makeSpeakingVC({ onCharStep });
    vc.processCommand('次の文字');
    expect(onCharStep).toHaveBeenCalledWith(1);
    expect(vc._spoken.pop()).toBe('あ');
  });

  test("'前の文字' announces honestly at the start", () => {
    const vc = makeSpeakingVC({ onCharStep: () => null });
    vc.processCommand('前の文字');
    expect(vc._spoken.pop()).toBe('これ以上戻れません');
  });

  test("'next character' routes in English", () => {
    const onCharStep = jest.fn(() => ({ char: 'x', line: 0 }));
    const vc = makeSpeakingVC({ onCharStep });
    vc.processCommand('next character');
    expect(vc._spoken.pop()).toBe('x');
  });

  test("'この単語を読んで' speaks the caret word", () => {
    const vc = makeSpeakingVC({ onWord: () => ({ word: 'こんにちは', line: 0 }) });
    vc.processCommand('この単語を読んで');
    expect(vc._spoken.pop()).toBe('こんにちは');
  });

  test("'この単語をスペル' spells it", () => {
    const vc = makeSpeakingVC({
      onSpellWord: () => ({ spelled: 'こ、ん、に、ち、は', word: 'こんにちは' })
    });
    vc.processCommand('この単語をスペル');
    expect(vc._spoken.pop()).toBe('こ、ん、に、ち、は');
  });
});

// ── voice: status queries ──────────────────────────────────────────────────
describe('VoiceCommands status-query atoms', () => {
  test("'読み上げ速度は' reports the current rate", () => {
    const vc = makeSpeakingVC();
    vc.setSpeechRate(1.5);
    vc.processCommand('読み上げ速度は');
    expect(vc._spoken.pop()).toBe('読み上げ速度は1.5倍です');
  });

  test("'ピッチは' reports the current pitch", () => {
    const vc = makeSpeakingVC();
    vc.processCommand('ピッチは');
    expect(vc._spoken.pop()).toBe('声の高さは1倍です');
  });

  test("'どの声' reports honestly when no voice picked", () => {
    const vc = makeSpeakingVC();
    vc.processCommand('どの声');
    expect(vc._spoken.pop()).toBe('声は未選択です');
  });

  test("'言語は' reports the recognition language", () => {
    const vc = makeSpeakingVC();
    vc.processCommand('言語は');
    expect(vc._spoken.pop()).toBe('言語はja-JPです');
  });

  test("'どの検索エンジン' reports via the host hook", () => {
    const vc = makeSpeakingVC({ onSearchEngineStatus: () => 'google' });
    vc.processCommand('どの検索エンジン');
    expect(vc._spoken.pop()).toBe('検索エンジンはgoogleです');
  });

  test("'which search engine' routes in English", () => {
    const vc = makeSpeakingVC({ onSearchEngineStatus: () => 'bing' });
    vc.processCommand('which search engine');
    expect(vc._spoken.pop()).toBe('検索エンジンはbingです');
  });

  test("'グレース時間は' queries the stepper value without stepping", () => {
    const onStepper = jest.fn(() => 250);
    const vc = makeSpeakingVC({ onStepper });
    vc.processCommand('グレース時間は');
    expect(onStepper).toHaveBeenCalledWith('gazeGraceTime', 0);
    expect(vc._spoken.pop()).toBe('グレース時間 250ミリ秒');
  });

  test("'スナップ角は' + '移動速度は' + 'caption height' statuses", () => {
    const vals = { snapTurnAngle: 45, smoothMoveSpeed: 2.0, captionHeight: -0.5 };
    const vc = makeSpeakingVC({ onStepper: (k) => vals[k] ?? null });
    vc.processCommand('スナップ角は');
    expect(vc._spoken.pop()).toBe('スナップ角 45度');
    vc.processCommand('移動速度は');
    expect(vc._spoken.pop()).toBe('移動速度 2メートル毎秒');
    vc.processCommand('caption height');
    expect(vc._spoken.pop()).toBe('キャプション高さ -0.5メートル');
  });
});
