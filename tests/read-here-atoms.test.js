/**
 * Round-19 narration & open atoms:
 *   - narrationFromLine / getReaderNarrationFrom — NVDA "read from current
 *     position": chunks resume at the block under the scroll offset
 *   - read-here voice command — 'ここから読み上げ'
 *   - top-site-select — the new-tab tile grid, voice-reachable by number
 *   - history-search — announce the hit count plus the most recent match
 */

global.SpeechSynthesisUtterance = function (text) { this.text = text; };

const { layoutReaderLines } = require('../src/vr/browser/readerLayout.js');
const { narrationFromLine, narrationChunks } = require('../src/vr/browser/readerNarration.js');
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

const BLOCKS = [
  { type: 'p', text: 'First paragraph.' },
  { type: 'h', text: 'Mid heading' },
  { type: 'p', text: 'Last paragraph.' }
];

// ── layoutReaderLines block mapping ───────────────────────────────────────────
describe('layoutReaderLines block index', () => {
  test('content lines carry their source block index; title lines do not', () => {
    const lines = layoutReaderLines(BLOCKS, { title: 'T' });
    expect(lines[0].block).toBeUndefined(); // title row
    const byBlock = {};
    for (const l of lines) {
      if (Number.isFinite(l.block)) {
        byBlock[l.block] = (byBlock[l.block] || 0) + 1;
      }
    }
    expect(Object.keys(byBlock).sort()).toEqual(['0', '1', '2']);
  });
});

// ── narrationFromLine ─────────────────────────────────────────────────────────
describe('narrationFromLine', () => {
  const lines = layoutReaderLines(BLOCKS, { title: 'Article Title' });
  const firstBlockLine = lines.findIndex((l) => l.block === 0);
  const lastBlockLine = lines.findIndex((l) => l.block === 2);

  test('at the title line it equals a full read-aloud', () => {
    const full = narrationChunks('Article Title', BLOCKS);
    expect(narrationFromLine(lines, 0, 'Article Title', BLOCKS)).toEqual(full);
  });

  test('at a block line it resumes there and drops the title', () => {
    const chunks = narrationFromLine(lines, lastBlockLine, 'Article Title', BLOCKS);
    expect(chunks.join(' ')).toContain('Last paragraph');
    expect(chunks.join(' ')).not.toContain('Article Title');
    expect(chunks.join(' ')).not.toContain('First paragraph');
  });

  test('at a blank spacer line it resumes at the following block', () => {
    const blankIdx = lines.findIndex((l) => l.style === 'blank' && l.block === 2);
    const chunks = narrationFromLine(lines, blankIdx, 'Article Title', BLOCKS);
    expect(chunks.join(' ')).toContain('Last paragraph');
  });

  test('out-of-range scroll clamps to the last line', () => {
    const chunks = narrationFromLine(lines, 9999, 'Article Title', BLOCKS);
    expect(chunks.join(' ')).toContain('Last paragraph');
  });
});

// ── read-here ─────────────────────────────────────────────────────────────────
describe('VoiceCommands read-here', () => {
  test('\'ここから読み上げ\' hands the hook chunks to readAloud', () => {
    const onReadHere = jest.fn(() => ['chunk one', 'chunk two']);
    const vc = makeSpeakingVC({ onReadHere });
    vc.processCommand('ここから読み上げ');
    expect(onReadHere).toHaveBeenCalled();
    expect(vc._spoken).toContain('読み上げを開始します');
    expect(vc._spoken).toContain('chunk two');
  });

  test('\'read from here\' routes in English', () => {
    const vc = makeSpeakingVC({ onReadHere: () => ['x'] });
    vc.processCommand('read from here');
    expect(vc._spoken).toContain('x');
  });

  test('no reader announces honestly', () => {
    const vc = makeSpeakingVC({ onReadHere: () => null });
    vc.processCommand('ここから読み上げ');
    expect(vc._spoken.pop()).toBe('読み上げられる文章がありません');
  });
});

// ── top-site-select ───────────────────────────────────────────────────────────
describe('VoiceCommands top-site-select', () => {
  test('\'トップサイト2\' opens via the hook and announces the title', () => {
    const onTopSiteOpen = jest.fn(() => 'Example Site');
    const vc = makeSpeakingVC({ onTopSiteOpen });
    vc.processCommand('トップサイト2');
    expect(onTopSiteOpen).toHaveBeenCalledWith(2);
    expect(vc._spoken.pop()).toBe('Example Site');
  });

  test('\'top site 3\' routes in English', () => {
    const onTopSiteOpen = jest.fn(() => 'Third');
    const vc = makeSpeakingVC({ onTopSiteOpen });
    vc.processCommand('top site 3');
    expect(onTopSiteOpen).toHaveBeenCalledWith(3);
  });

  test('out of range announces honestly', () => {
    const vc = makeSpeakingVC({ onTopSiteOpen: () => null });
    vc.processCommand('トップサイト9');
    expect(vc._spoken.pop()).toBe('トップサイト9はありません');
  });
});

// ── history-search ────────────────────────────────────────────────────────────
describe('VoiceCommands history-search', () => {
  test('\'履歴からGoogleを検索\' passes the term and announces hits', () => {
    const onHistorySearch = jest.fn(() => ({ count: 2, title: 'Google' }));
    const vc = makeSpeakingVC({ onHistorySearch });
    vc.processCommand('履歴からGoogleを検索');
    expect(onHistorySearch).toHaveBeenCalledWith('Google');
    expect(vc._spoken.pop()).toBe('2件見つかりました。最近: Google');
  });

  test('\'履歴からXを探して\' stays with find-in-page (it owns that phrasing)', () => {
    const onHistorySearch = jest.fn();
    const vc = makeSpeakingVC({ onHistorySearch });
    vc.processCommand('履歴からGoogleを探して');
    expect(onHistorySearch).not.toHaveBeenCalled();
  });

  test('\'history search apple\' routes in English', () => {
    const onHistorySearch = jest.fn(() => ({ count: 1, title: 'Apple' }));
    const vc = makeSpeakingVC({ onHistorySearch });
    vc.processCommand('history search apple');
    expect(onHistorySearch).toHaveBeenCalledWith('apple');
  });

  test('no match announces honestly', () => {
    const vc = makeSpeakingVC({ onHistorySearch: () => null });
    vc.processCommand('履歴からunknownを検索');
    expect(vc._spoken.pop()).toBe('unknownは履歴にありません');
  });

  test('\'履歴2番目\' still routes to history-select, not history-search', () => {
    const onHistorySearch = jest.fn();
    const vc = makeSpeakingVC({ onHistorySearch, onHistoryOpen: () => 'T' });
    vc.processCommand('履歴2番目');
    expect(onHistorySearch).not.toHaveBeenCalled();
  });
});
