/**
 * Round 39 atoms — read-heading text, indexed/edge sentences, caret
 * positions, private count, last-command echo.
 * Assertions target the announce text or the panel call — nothing
 * coincidentally shared with another command.
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

global.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(t) {
  this.text = t;
};

function makePanel(extra = {}) {
  return {
    currentTitle: 'n', currentUrl: 'https://x.jp',
    headingHere: jest.fn(() => ({ index: 2, total: 4, text: '第二章' })),
    sentenceAt: jest.fn((n) => (n > 5 ? 'out' : { sentence: '文の内容', index: n, total: 5 })),
    firstSentence: jest.fn(() => ({ sentence: '一文目', index: 1, total: 5 })),
    lastSentence: jest.fn(() => ({ sentence: '最終文', index: 5, total: 5 })),
    charStatus: jest.fn(() => ({ index: 3, total: 20 })),
    wordStatus: jest.fn(() => ({ index: 2, total: 8 })),
    ...extra
  };
}

function makeVC(opts = {}) {
  const vc = new VoiceCommands();
  const spoken = [];
  vc.synthesis = { speak: (u) => spoken.push(u.text), cancel: () => {}, speaking: false };
  const panel = makePanel(opts.panel);
  const tabManager = opts.tabManager === undefined ? {
    tabs: opts.tabs || [panel],
    activeIndex: 0,
    setActive: jest.fn(),
    getActiveTab: () => panel,
    nextTab: jest.fn(),
    previousActiveIndex: () => 0
  } : opts.tabManager;
  vc.connectBrowser({ tabManager, ...opts });
  return { vc, spoken, tabManager, panel };
}

describe('read-heading', () => {
  test('"この見出しを読み上げ" speaks the heading text + position', () => {
    const { vc, spoken, panel } = makeVC();
    vc.processCommand('この見出しを読み上げ');
    expect(panel.headingHere).toHaveBeenCalled();
    expect(spoken[0]).toContain('第二章');
    expect(spoken[0]).toContain('2番目/全4');
  });
  test('honest when no heading', () => {
    const { vc, spoken } = makeVC({ panel: { headingHere: jest.fn(() => null) } });
    vc.processCommand('read the heading');
    expect(spoken).toContain('見出しがありません');
  });
});

describe('sentence select/ends', () => {
  test('"3番目の文" jumps and speaks the sentence', () => {
    const { vc, spoken, panel } = makeVC();
    vc.processCommand('3番目の文');
    expect(panel.sentenceAt).toHaveBeenCalledWith(3);
    expect(spoken[0]).toContain('3番目の文（全5）。文の内容');
  });
  test('"sentence 4" works in English', () => {
    const { vc, panel } = makeVC();
    vc.processCommand('sentence 4');
    expect(panel.sentenceAt).toHaveBeenCalledWith(4);
  });
  test('out of range announces honestly', () => {
    const { vc, spoken, panel } = makeVC();
    vc.processCommand('9番目の文');
    expect(panel.sentenceAt).toHaveBeenCalledWith(9);
    expect(spoken).toContain('文9はありません');
  });
  test('"最初の文" and "最後の文" hit the ends', () => {
    const { vc, spoken, panel } = makeVC();
    vc.processCommand('最初の文');
    expect(panel.firstSentence).toHaveBeenCalled();
    vc.processCommand('最後の文');
    expect(panel.lastSentence).toHaveBeenCalled();
    expect(spoken[1]).toContain('5番目の文（全5）。最終文');
  });
});

describe('caret status twins', () => {
  test('"何文字目" reports the char position', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('何文字目');
    expect(spoken).toContain('この行の3文字目（全20文字）');
  });
  test('"何単語目" reports the word position', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('何単語目');
    expect(spoken).toContain('この行の2単語目（全8単語）');
  });
  test('honest when the caret has not moved', () => {
    const { vc, spoken } = makeVC({ panel: { charStatus: jest.fn(() => null) } });
    vc.processCommand('char position');
    expect(spoken).toContain('文字カーソルはまだ動いていません');
  });
});

describe('private-count / last-command', () => {
  test('"プライベートタブは何個" counts private tabs', () => {
    const tabs = [
      makePanel(), makePanel({ isPrivate: true }),
      makePanel({ isPrivate: true }), makePanel()
    ];
    const { vc, spoken } = makeVC({ tabs });
    vc.processCommand('プライベートタブは何個');
    expect(spoken).toContain('2個のプライベートタブがあります');
  });
  test('zero private tabs announces none', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('private tabs count');
    expect(spoken).toContain('プライベートタブはありません');
  });
  test('"最後のコマンド" echoes the last executed transcript', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('オンラインか'); // seeds _repeatableTranscript
    vc.processCommand('最後のコマンド');
    expect(spoken[1]).toContain('「オンラインか」');
  });
  test('last-command before anything ran is honest', () => {
    const { vc, spoken } = makeVC();
    vc.processCommand('last command');
    expect(spoken).toContain('まだコマンドを実行していません');
  });
});

// ── Real WebPanel sentence/char/word surfaces ──────────────────────────────
const RealWebPanel = jest.requireActual('../src/vr/browser/WebPanel.js').WebPanel;

function sentencePanel() {
  const p = Object.create(RealWebPanel.prototype);
  p._contentState = 'reader';
  // block 0: 30 sentences; block 1: 5 sentences — enough rows that the
  // viewport (22 at scale 1) can't show all, so scrollContentTo moves.
  const text0 = Array.from({ length: 30 }, (_, i) => `s${i + 1}文。`).join('');
  const text1 = Array.from({ length: 5 }, (_, i) => `t${i + 1}文。`).join('');
  p._readerBlocks = [{ type: 'p', text: text0 }, { type: 'p', text: text1 }];
  p._readerLines = [
    ...Array.from({ length: 30 }, (_, i) => ({ text: `s${i + 1}文。`, style: 'p', block: 0 })),
    ...Array.from({ length: 5 }, (_, i) => ({ text: `t${i + 1}文。`, style: 'p', block: 1 }))
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

describe('WebPanel sentenceAt / firstSentence / lastSentence', () => {
  test('sentenceAt(3) lands mid-block with index/total', () => {
    const p = sentencePanel();
    const r = p.sentenceAt(3);
    expect(r).toEqual({ sentence: 's3文。', index: 3, total: 35 });
    expect(p._sentenceCaret).toEqual({ block: 0, idx: 2 });
    expect(p._readerScroll).toBe(2);
  });
  test('sentenceAt crosses into the next block', () => {
    const p = sentencePanel();
    const r = p.sentenceAt(32);
    expect(r.index).toBe(32);
    expect(r.sentence).toBe('t2文。');
    expect(p._readerScroll).toBeGreaterThan(0);
  });
  test('out-of-range returns out; first/last hit the edges', () => {
    const p = sentencePanel();
    expect(p.sentenceAt(0)).toBe('out');
    expect(p.sentenceAt(36)).toBe('out');
    expect(p.firstSentence().index).toBe(1);
    expect(p.lastSentence()).toEqual({ sentence: 't5文。', index: 35, total: 35 });
  });
  test('outside the reader returns null', () => {
    const p = sentencePanel();
    p._contentState = 'idle';
    expect(p.sentenceAt(1)).toBeNull();
    expect(p.firstSentence()).toBeNull();
    expect(p.lastSentence()).toBeNull();
  });
});

describe('WebPanel charStatus / wordStatus', () => {
  test('null until the caret exists; then index/total', () => {
    const p = sentencePanel();
    expect(p.charStatus()).toBeNull();
    expect(p.wordStatus()).toBeNull();
    p._charCaret = { line: 0, idx: 2 };
    p._wordCaret = { line: 0, idx: 1 };
    const c = p.charStatus();
    expect(c.index).toBe(3);
    expect(p.wordStatus().index).toBe(2);
  });
});
