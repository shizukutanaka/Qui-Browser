/**
 * Round-97 atoms: EN ordinal tab addressing (select/close/pin/move), the
 * 'mute tab N' honest route, window nouns, polite/dialect tails, and the
 * 'do i/we' question regression fix.
 *
 * Sources: Voice Access 'open the third link' ordinal parity; Chrome
 * Ctrl+1..8 strip addressing; Alexa/Google Assistant 'close tab number
 * two' phrasing; JA dialectal negation (まへん/んぞ/んねん/へん) and
 * honorific request tails (お〜なさい/いただけますか/くれはる).
 */

const VC = require('../src/vr/input/VoiceCommands').VoiceCommands;

function makeTM(extra = {}) {
  return {
    tabs: [
      { currentTitle: 'News', currentUrl: 'https://news.example', pinned: false },
      { currentTitle: 'Mail', currentUrl: 'https://mail.example', pinned: false },
      { currentTitle: 'Music', currentUrl: 'https://music.example', pinned: true },
    ],
    activeIndex: 0,
    closed: [],
    pinned: [],
    moved: [],
    setActive(i) { this.activeIndex = i; },
    closeTab(i) { this.closed.push(i); return !this.tabs[i].pinned; },
    closeAllTabs() { this.closed.push('all'); },
    togglePin(i) {
      this.pinned.push(i);
      this.tabs[i].pinned = !this.tabs[i].pinned;
      return this.tabs[i].pinned ? 'pinned' : 'unpinned';
    },
    moveTab(cur, delta) { this.moved.push([cur, delta]); return true; },
    moveTabToStart() {}, moveTabToEnd() {},
    getActiveTab() { return this.tabs[this.activeIndex]; },
    nextTab() {}, prevTab() {},
    ...extra,
  };
}

function dispatch(vc, tm, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase);
  return vc.lastCommand ? vc.lastCommand.key : 'NONE';
}

describe('ordinal-window atoms (round 97)', () => {
  let vc;
  let tm;
  beforeEach(() => {
    vc = new VC({ enabled: true });
    tm = makeTM();
    vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
    vc.speak = jest.fn();
  });

  describe('EN ordinal select/close/pin/move', () => {
    it.each([
      ['switch to the third tab', 'tab-select'],
      ['switch to tab number two', 'tab-select'],
      ['select the fifth tab', 'tab-select'],
      ['open the last tab', 'tab-select'],
      ['show the first tab', 'tab-select'],
      ['go to the second tab', 'tab-select'],
      ['jump to the last tab', 'tab-select'],
    ])('"%s" → %s', (p, key) => {
      expect(dispatch(vc, tm, p)).toBe(key);
    });

    it('switch to the third tab lands on index 2', () => {
      dispatch(vc, tm, 'switch to the third tab');
      expect(tm.activeIndex).toBe(2);
    });

    it.each([
      ['close the third tab', 'close-tab-ordinal'],
      ['close tab number two', 'close-tab-ordinal'],
      ['close tab 2', 'close-tab-ordinal'],
      ['close the 2nd tab', 'close-tab-ordinal'],
      ['close the last tab', 'close-tab-ordinal'],
      ['close the one tab', 'close-tab-ordinal'],
    ])('"%s" → %s', (p, key) => {
      expect(dispatch(vc, tm, p)).toBe(key);
    });

    it('close the third tab closes index 2 honestly (pinned → refused)', () => {
      dispatch(vc, tm, 'close the third tab');
      expect(vc.speak).toHaveBeenCalledWith('ピン留めされたタブは閉じられません');
    });

    it('close the last tab resolves to tabs.length', () => {
      tm.tabs[2].pinned = false;
      dispatch(vc, tm, 'close the last tab');
      expect(tm.closed).toContain(2);
    });

    it.each([
      ['pin the second tab', 1],
      ['unpin the third tab', 2],
      ['unpin the last tab', 2],
    ])('"%s" → tab-pin-n index %d', (p, idx) => {
      expect(dispatch(vc, tm, p)).toBe('tab-pin-n');
    });

    it('unpin on an unpinned tab is honest, no toggle', () => {
      const before = [...tm.pinned];
      expect(dispatch(vc, tm, 'unpin the first tab')).toBe('tab-pin-n');
      expect(tm.pinned.length).toBe(before.length);
      expect(vc.speak).toHaveBeenCalledWith('タブ1はピン留めされていません');
    });

    it.each([
      ['move the tab to position two', 'move-tab-to-n'],
      ['move the tab to number 3', 'move-tab-to-n'],
      ['move this tab to position 1', 'move-tab-to-n'],
    ])('"%s" → %s', (p, key) => {
      expect(dispatch(vc, tm, p)).toBe(key);
    });

    it('named tabs still route to by-name owners', () => {
      expect(dispatch(vc, tm, 'switch to the news tab')).toBe('tab-by-name');
      expect(dispatch(vc, tm, 'open the news tab')).toBe('tab-by-name');
      expect(dispatch(vc, tm, 'close the news tab')).toBe('close-tab-by-name');
      expect(dispatch(vc, tm, 'pin the news tab')).toBe('pin-tab-by-name');
    });
  });

  describe('per-tab mute is honestly absent', () => {
    it.each([
      'mute the third tab', 'mute the second tab', 'mute tab 2',
      'unmute tab 1', 'mute the last tab',
    ])('"%s" → tab-audio', (p) => {
      expect(dispatch(vc, tm, p)).toBe('tab-audio');
      expect(vc.speak).toHaveBeenCalledWith(
        'タブごとの音声は検出できません。「ミュート」で全体を消音できます');
    });

    it('bare mute still toggles the master', () => {
      expect(dispatch(vc, tm, 'mute it')).toBe('mute-toggle');
    });
  });

  describe('window nouns', () => {
    it.each([
      ['open a guest window', 'window-state'],
      ['a guest window', 'window-state'],
      ['open a window', 'window-state'],
      ['another window', 'new-tab'],
      ['one more window', 'new-tab'],
      ['open another window', 'new-tab'],
      ['a new window', 'new-tab'],
      ['open a private window', 'private-new-tab'],
      ['incognito window', 'private-new-tab'],
      ['new incognito window', 'private-new-tab'],
    ])('"%s" → %s', (p, key) => {
      expect(dispatch(vc, tm, p)).toBe(key);
    });

    it('open windows update still navigates (mid-phrase window)', () => {
      expect(dispatch(vc, tm, 'open windows update')).toBe('go-to');
    });
  });

  describe('tab-count questions land on status', () => {
    it.each([
      'whats the tab count', 'count my tabs', 'number of tabs',
      'tab count', 'the tab count', 'count tabs',
    ])('"%s" → tab-status', (p) => {
      expect(dispatch(vc, tm, p)).toBe('tab-status');
    });
  });

  describe('question-form regressions (do i/we, mind if)', () => {
    it.each([
      'do i close it', 'do we go back', 'mind if i close it',
    ])('"%s" → help (no execution)', (p) => {
      expect(dispatch(vc, tm, p)).toBe('help');
      expect(tm.closed).toEqual([]);
    });

    it.each([
      'do you mind closing this', 'mind closing this', 'do close it',
    ])('"%s" → close-tab (request forms still work)', (p) => {
      expect(dispatch(vc, tm, p)).toBe('close-tab');
    });
  });

  describe('JA dialect/honorific tails', () => {
    it.each([
      ['読むぞい', 'read-aloud'],
      ['閉じろぞ', 'close-tab'],
      ['閉じるぜ', 'close-tab'],
      ['読むねん', 'read-aloud'],
      ['閉じませう', 'close-tab'],
      ['閉じますんやで', 'close-tab'],
      ['読みますんで', 'read-aloud'],
      ['読みますだわ', 'read-aloud'],
      ['閉じんといいかも', 'close-tab'],
      ['閉じてもらっといて', 'close-tab'],
      ['閉じてくれはる', 'close-tab'],
      ['読んでくれはるか', 'read-aloud'],
      ['閉じちゃいな', 'close-tab'],
      ['読んじゃいな', 'read-aloud'],
      ['閉じさせていただきたい', 'close-tab'],
      ['読ませていただきます', 'read-aloud'],
      ['閉じさせてもらえますか', 'close-tab'],
      ['お読みいただけますか', 'read-aloud'],
      ['お読みなさい', 'read-aloud'],
      ['読んであげるね', 'read-aloud'],
      ['読んでくれちゃう', 'read-aloud'],
      ['読んどいてね', 'read-aloud'],
    ])('"%s" → %s', (p, key) => {
      expect(dispatch(vc, tm, p)).toBe(key);
    });

    it.each([
      '閉じまへん', '閉じんぞ', '閉じんねん',
    ])('"%s" → negate', (p) => {
      expect(dispatch(vc, tm, p)).toBe('negate');
      expect(tm.closed).toEqual([]);
    });

    it.each([
      '閉じちゃったで', '閉じちゃったんで', '消えちゃったで', '閉じちゃったもん',
    ])('"%s" → reopen-tab', (p) => {
      expect(dispatch(vc, tm, p)).toBe('reopen-tab');
    });

    it('"ご覧になりますか" → describe-tab', () => {
      expect(dispatch(vc, tm, 'ご覧になりますか')).toBe('describe-tab');
    });

    it('"お戻りください" still → back', () => {
      expect(dispatch(vc, tm, 'お戻りください')).toBe('back');
    });
  });

  describe('reading/window literals', () => {
    it.each([
      '途中で止めて', '途中でとめて',
    ])('"%s" → pause-reading', (p) => {
      expect(dispatch(vc, tm, p)).toBe('pause-reading');
    });

    it('"止まってくれ" → stop-reading', () => {
      expect(dispatch(vc, tm, '止まってくれ')).toBe('stop-reading');
    });

    it.each([
      '最後まで行って', '最後まで行け', '末尾に行って',
      'bottom of the page', 'the bottom of the page',
    ])('"%s" → scroll-bottom', (p) => {
      expect(dispatch(vc, tm, p)).toBe('scroll-bottom');
    });

    it.each([
      '最後まで読め', '最後まで読んでくれ', '読み終わりたい', '読み終えたい', '読み切りたい',
    ])('"%s" → read-aloud', (p) => {
      expect(dispatch(vc, tm, p)).toBe('read-aloud');
    });

    it.each([
      'at the bottom yet', 'did i reach the end', 'how far down are we',
      'whats my position',
    ])('"%s" → reader-progress', (p) => {
      expect(dispatch(vc, tm, p)).toBe('reader-progress');
    });
  });

  describe('EN volume/rate/trouble/recenter literals', () => {
    it.each([
      ['how loud is it', 'volume-status'],
      ['how much volume', 'volume-status'],
      ['more volume', 'volume-up'],
      ['up the volume', 'volume-up'],
      ['much louder', 'volume-up'],
      ['lower your voice', 'volume-down'],
      ['turn it down a notch', 'volume-down'],
      ['a bit quieter', 'volume-down'],
      ['way faster', 'speech-faster'],
      ['much faster', 'speech-faster'],
      ['slightly slower', 'speech-slower'],
      ['a bit slower', 'speech-slower'],
      ['way slower', 'speech-slower'],
      ['turn around', 'recenter'],
      ['look behind', 'recenter'],
      ['face the other way', 'recenter'],
      ['cant reach it', 'trouble'],
      ['cant reach that', 'trouble'],
      ['開けん', 'trouble'],
      ['開かん', 'trouble'],
      ['あかん', 'trouble'],
    ])('"%s" → %s', (p, key) => {
      expect(dispatch(vc, tm, p)).toBe(key);
    });
  });
});
