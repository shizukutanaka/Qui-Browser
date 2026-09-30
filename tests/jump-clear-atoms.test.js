/**
 * Round-25 atoms:
 *   - jump-back — Vim `` mark: scrollContentTo records the pre-jump scroll
 *   - clear-find — Chrome's Esc: dismiss the find highlights
 *   - paste-go — Chrome "Paste and go": clipboard URL → navigate (async)
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

// ── jump-back ─────────────────────────────────────────────────────────────────
describe('VoiceCommands jump-back', () => {
  test('\'さっきの場所\' toggles via the hook', () => {
    const vc = makeSpeakingVC({ onJumpBack: () => true });
    vc.processCommand('さっきの場所');
    expect(vc._spoken.pop()).toBe('元の場所に戻りました');
  });

  test('\'jump back\' routes in English', () => {
    const vc = makeSpeakingVC({ onJumpBack: () => true });
    vc.processCommand('jump back');
    expect(vc._spoken.pop()).toBe('元の場所に戻りました');
  });

  test('no mark announces honestly', () => {
    const vc = makeSpeakingVC({ onJumpBack: () => false });
    vc.processCommand('さっきの場所');
    expect(vc._spoken.pop()).toBe('戻る場所がありません');
  });

  test('\'戻る\' still routes to go-back (go-back owns 戻)', () => {
    const onJumpBack = jest.fn();
    const goBack = jest.fn(() => true);
    const vc = makeSpeakingVC({
      onJumpBack,
      tabManager: { getActiveTab: () => ({ goBack }) }
    });
    vc.processCommand('戻る');
    expect(onJumpBack).not.toHaveBeenCalled();
  });
});

// ── clear-find ────────────────────────────────────────────────────────────────
describe('VoiceCommands clear-find', () => {
  test('\'検索を解除\' clears via the hook', () => {
    const vc = makeSpeakingVC({ onClearFind: () => true });
    vc.processCommand('検索を解除');
    expect(vc._spoken.pop()).toBe('ハイライトを消しました');
  });

  test('\'clear search\' routes in English', () => {
    const vc = makeSpeakingVC({ onClearFind: () => true });
    vc.processCommand('clear search');
    expect(vc._spoken.pop()).toBe('ハイライトを消しました');
  });

  test('no active search announces honestly', () => {
    const vc = makeSpeakingVC({ onClearFind: () => false });
    vc.processCommand('検索を解除');
    expect(vc._spoken.pop()).toBe('検索をしていません');
  });
});

// ── paste-go ──────────────────────────────────────────────────────────────────
describe('VoiceCommands paste-go', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));

  test('\'ペーストして開く\' navigates via the async hook', async () => {
    const vc = makeSpeakingVC({ onPasteGo: () => Promise.resolve('貼り付けて開きました') });
    vc.processCommand('ペーストして開く');
    await flush();
    expect(vc._spoken.pop()).toBe('貼り付けて開きました');
  });

  test('\'paste and go\' routes in English', async () => {
    const vc = makeSpeakingVC({ onPasteGo: () => Promise.resolve('貼り付けて開きました') });
    vc.processCommand('paste and go');
    await flush();
    expect(vc._spoken.pop()).toBe('貼り付けて開きました');
  });

  test('non-URL clipboard announces honestly', async () => {
    const vc = makeSpeakingVC({ onPasteGo: () => Promise.resolve('URLがコピーされていません') });
    vc.processCommand('ペーストして開く');
    await flush();
    expect(vc._spoken.pop()).toBe('URLがコピーされていません');
  });

  test('no hook announces honestly', async () => {
    const vc = makeSpeakingVC();
    vc.processCommand('ペーストして開く');
    await flush();
    expect(vc._spoken.pop()).toBe('URLがコピーされていません');
  });
});

// ── WebPanel methods (bound to hand-built state) ──────────────────────────────
describe('WebPanel jumpBack / clearFind / scroll mark', () => {
  const RealWebPanel = jest.requireActual('../src/vr/browser/WebPanel.js').WebPanel;

  function readerPanel(scroll = 0, lines = 50) {
    const panel = Object.create(RealWebPanel.prototype);
    panel._contentState = 'reader';
    panel._readerLines = Array.from({ length: lines }, (_, i) => ({ text: `l${i}` }));
    panel._readerScroll = scroll;
    panel._readerScale = 1;
    panel._scrollMark = null;
    panel._findMatches = [];
    panel._findIndex = -1;
    panel._drawContent = jest.fn();
    return panel;
  }

  test('jumpBack returns to the pre-jump line and toggles', () => {
    const panel = readerPanel(10);
    panel.scrollContentTo(30);              // clamps to max scroll (50−22=28)
    const landed = panel._readerScroll;
    expect(panel._scrollMark).toBe(10);
    expect(panel.jumpBack()).toBe(true);    // back → mark = landed
    expect(panel._readerScroll).toBe(10);
    expect(panel._scrollMark).toBe(landed);
    expect(panel.jumpBack()).toBe(true);    // forward again
    expect(panel._readerScroll).toBe(landed);
  });

  test('jumpBack is false without a mark or outside reader', () => {
    const panel = readerPanel(10);
    expect(panel.jumpBack()).toBe(false);   // never jumped
    panel._contentState = 'idle';
    panel._scrollMark = 5;
    expect(panel.jumpBack()).toBe(false);
  });

  test('incremental scrollContent does not mark', () => {
    const panel = readerPanel(10);
    panel.scrollContent(5);
    expect(panel._scrollMark).toBeNull();
  });

  test('clearFind wipes matches, tags and reports whether there was a search', () => {
    const panel = readerPanel();
    panel._findMatches = [];
    expect(panel.clearFind()).toBe(false);  // nothing active
    panel._findMatches = [3, 8];
    panel._findIndex = 1;
    panel._markFindHits = jest.fn();
    expect(panel.clearFind()).toBe(true);
    expect(panel._findMatches).toEqual([]);
    expect(panel._findIndex).toBe(-1);
    expect(panel._markFindHits).toHaveBeenCalled();
  });
});
