/**
 * Round-34 atoms (Session 108) — external parity:
 *   article-summary     VoiceOver rotor summary ('describe page')
 *   heading-here        NVDA read-current-heading
 *   sentences-left      remaining-content query (reading-progress's sentence twin)
 *   sensitivity         recognition confidence threshold stepper (voice layer)
 *   wake-word-toggle    wake-word requirement flag (voice layer)
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
  p._readerTitle = 'テスト記事';
  p._readerBlocks = [
    { type: 'h', text: 'はじめに' },
    { type: 'p', text: '一文目です。二文目です。三文目です。' },
    { type: 'h', text: 'おわりに' },
    { type: 'p', text: '最後です。' }
  ];
  p._readerLines = [
    { text: 'はじめに', style: 'h', block: 0 },
    { text: '一文目です。二文', style: 'p', block: 1 },
    { text: '目です。三文目です。', style: 'p', block: 1 },
    { text: 'おわりに', style: 'h', block: 2 },
    { text: '最後です。', style: 'p', block: 3 }
  ];
  p._readerScroll = 0;
  p._readerScale = 1;
  p._scrollMark = null;
  p._drawContent = jest.fn();
  return p;
}

// ── headingHere (NVDA read-current-heading) ────────────────────────────────
describe('WebPanel headingHere', () => {
  test('reports the covering heading at each scroll position', () => {
    const p = readerPanel();
    expect(p.headingHere()).toEqual({ index: 1, total: 2, text: 'はじめに' });
    p._readerScroll = 2;
    expect(p.headingHere()).toEqual({ index: 1, total: 2, text: 'はじめに' });
    p._readerScroll = 3;
    expect(p.headingHere()).toEqual({ index: 2, total: 2, text: 'おわりに' });
    p._readerScroll = 4;
    expect(p.headingHere().text).toBe('おわりに');
  });

  test('null outside the reader and with no headings', () => {
    const p = readerPanel();
    p._contentState = 'page';
    expect(p.headingHere()).toBe(null);
    p._contentState = 'reader';
    p._readerLines = p._readerLines.map((l) => ({ ...l, style: 'p' }));
    expect(p.headingHere()).toBe(null);
  });
});

// ── getArticleSummary (VoiceOver rotor summary) ────────────────────────────
describe('WebPanel getArticleSummary', () => {
  test('counts headings, paragraphs and chars', () => {
    const p = readerPanel();
    const s = p.getArticleSummary();
    expect(s.title).toBe('テスト記事');
    expect(s.headings).toBe(2);
    expect(s.paragraphs).toBe(4); // 4 block runs: h, p, h, p
    expect(s.chars).toBe(
      'はじめに'.length + '一文目です。二文'.length + '目です。三文目です。'.length +
      'おわりに'.length + '最後です。'.length);
  });

  test('null outside the reader', () => {
    const p = readerPanel();
    p._contentState = 'page';
    expect(p.getArticleSummary()).toBe(null);
  });
});

// ── voice: article-summary / heading-here / sentences-left ─────────────────
describe('VoiceCommands summary atoms', () => {
  test("'この記事について' describes the structure", () => {
    const vc = makeSpeakingVC({
      onArticleSummary: () => ({ title: '記事X', headings: 3, paragraphs: 7, chars: 1200 })
    });
    vc.processCommand('この記事について');
    expect(vc._spoken.pop()).toBe('タイトル「記事X」。見出し3個、段落7個、1200文字です');
  });

  test("'describe page' routes in English; honest without a reader", () => {
    const vc = makeSpeakingVC({
      onArticleSummary: () => ({ title: '', headings: 0, paragraphs: 2, chars: 30 })
    });
    vc.processCommand('describe page');
    expect(vc._spoken.pop()).toBe('見出し0個、段落2個、30文字です');
    const vc2 = makeSpeakingVC({ onArticleSummary: () => null });
    vc2.processCommand('describe page');
    expect(vc2._spoken.pop()).toBe('記事を開いていません');
  });

  test("'この見出し' reads the covering heading", () => {
    const vc = makeSpeakingVC({
      onHeadingHere: () => ({ index: 2, total: 5, text: '二章' })
    });
    vc.processCommand('この見出し');
    expect(vc._spoken.pop()).toBe('2番目の見出し（全5）。二章');
  });

  test("'current heading' announces honestly with no headings/reader", () => {
    const vc = makeSpeakingVC({
      onHeadingHere: () => ({ index: 1, total: 1, text: null })
    });
    vc.processCommand('current heading');
    expect(vc._spoken.pop()).toBe('見出しがありません');
    const vc2 = makeSpeakingVC({ onHeadingHere: () => null });
    vc2.processCommand('current heading');
    expect(vc2._spoken.pop()).toBe('記事を開いていません');
  });

  test("'あと何文' counts the sentences left", () => {
    const vc = makeSpeakingVC({
      onSentenceStatus: () => ({ sentence: 'x', index: 2, total: 5 })
    });
    vc.processCommand('あと何文');
    expect(vc._spoken.pop()).toBe('あと3文です');
  });

  test("'sentences left' says so at the last sentence / no reader", () => {
    const vc = makeSpeakingVC({
      onSentenceStatus: () => ({ sentence: 'x', index: 5, total: 5 })
    });
    vc.processCommand('sentences left');
    expect(vc._spoken.pop()).toBe('最後の文です');
    const vc2 = makeSpeakingVC({ onSentenceStatus: () => null });
    vc2.processCommand('sentences left');
    expect(vc2._spoken.pop()).toBe('記事を開いていません');
  });
});

// ── voice: sensitivity + wake-word (voice layer settings) ──────────────────
describe('VoiceCommands voice-layer settings', () => {
  test("'感度を上げて'/'下げて' steps the confidence threshold", () => {
    const vc = makeSpeakingVC();
    vc.processCommand('感度を上げて');
    expect(vc.settings.sensitivity).toBe(0.8);
    expect(vc._spoken.pop()).toBe('認識感度は0.8です');
    vc.processCommand('sensitivity down');
    expect(vc.settings.sensitivity).toBe(0.7);
    expect(vc._spoken.pop()).toBe('認識感度は0.7です');
  });

  test('honest at the sensitivity bounds', () => {
    const vc = makeSpeakingVC();
    vc.settings.sensitivity = 1;
    vc.processCommand('感度を上げて');
    expect(vc.settings.sensitivity).toBe(1);
    expect(vc._spoken.pop()).toBe('これ以上上げできません');
    vc.settings.sensitivity = 0;
    vc.processCommand('sensitivity down');
    expect(vc._spoken.pop()).toBe('これ以上下げできません');
  });

  test("'ウェイクワードをオン/オフ' toggles the requirement and wake state", () => {
    const vc = makeSpeakingVC();
    vc.processCommand('ウェイクワードをオン');
    expect(vc.settings.requireWakeWord).toBe(true);
    expect(vc.isAwake).toBe(false);
    expect(vc._spoken.pop()).toBe('ウェイクワードをオンにしました');
    vc.processCommand('wake word off');
    expect(vc.settings.requireWakeWord).toBe(false);
    expect(vc.isAwake).toBe(true);
    expect(vc._spoken.pop()).toBe('ウェイクワードをオフにしました');
  });
});
