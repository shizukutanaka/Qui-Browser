/**
 * Round-98 atoms: relative/ordinal tab addressing (この次/ひとつめ/N tabs
 * to the left), the 'defer' honest-absence atom (あとで/do it later), Devin
 * Review #383 fixes (んといい negative wish → negate, symmetric pin guard,
 * number-word exclusions require a trailing 'tab'), EN prefix/tag chain
 * tails, adverbial volume/rate fills, and how-to question parity.
 *
 * Sources: Voice Control 'tab to the right' / 'move focus' addressing;
 * NVDA relative object nav; JA っつめ counting forms; EN etiquette
 * ('please and thank you', 'close it would ya kindly', 'care to X').
 */

const VC = require('../src/vr/input/VoiceCommands').VoiceCommands;

function makeTM(extra = {}) {
  return {
    tabs: [
      { currentTitle: 'News', currentUrl: 'https://news.example', pinned: false },
      { currentTitle: 'Mail', currentUrl: 'https://mail.example', pinned: false },
      { currentTitle: 'Music', currentUrl: 'https://music.example', pinned: false },
      { currentTitle: 'One Piece Wiki', currentUrl: 'https://op.example', pinned: false },
    ],
    activeIndex: 1,
    closed: [],
    pinned: [],
    setActive(i) { this.activeIndex = i; },
    closeTab(i) { this.closed.push(i); return !this.tabs[i].pinned; },
    togglePin(i) {
      this.pinned.push(i);
      this.tabs[i].pinned = !this.tabs[i].pinned;
      return this.tabs[i].pinned ? 'pinned' : 'unpinned';
    },
    getActiveTab() { return this.tabs[this.activeIndex]; },
    ...extra,
  };
}

function dispatch(vc, tm, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase);
  return vc.lastCommand ? vc.lastCommand.key : 'NONE';
}

describe('relative-wish atoms (round 98)', () => {
  let vc;
  let tm;
  beforeEach(() => {
    vc = new VC({ enabled: true });
    tm = makeTM();
    vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
    vc.speak = jest.fn();
  });

  describe('JA ordinal/counter select', () => {
    it.each([
      ['二番目のタブ', 'tab-select-ordinal'],
      ['十番目のタブ', 'tab-select-ordinal'],
      ['2番目のタブ', 'tab-select-ordinal'],
      ['三番のタブ', 'tab-select-ordinal'],
      ['一番目', 'tab-select-ordinal'],
      ['二番目', 'tab-select-ordinal'],
      ['ひとつめのタブ', 'tab-select-ordinal'],
      ['ふたつめ', 'tab-select-ordinal'],
      ['みっつめのタブ', 'tab-select-ordinal'],
      ['やっつめ', 'tab-select-ordinal'],
      ['とおつめのタブ', 'tab-select-ordinal'],
    ])('"%s" → %s', (p, key) => {
      expect(dispatch(vc, tm, p)).toBe(key);
    });

    it('ひとつめのタブ lands on index 0', () => {
      dispatch(vc, tm, 'ひとつめのタブ');
      expect(tm.activeIndex).toBe(0);
    });

    it('三番のタブ lands on index 2', () => {
      dispatch(vc, tm, '三番のタブ');
      expect(tm.activeIndex).toBe(2);
    });

    // co-existence: the ordinal close form must not become a select
    it('二番目のタブを閉じて stays close-tab-ordinal', () => {
      expect(dispatch(vc, tm, '二番目のタブを閉じて')).toBe('close-tab-ordinal');
    });

    // 'あとで読む/後で読むリスト' keep their bookmark 'read later' routes
    it.each([
      ['あとで読む', 'bookmark-page'],
      ['後で読む', 'bookmark-page'],
      ['あとで読み返す', 'bookmark-page'],
    ])('"%s" → %s', (p, key) => {
      expect(dispatch(vc, tm, p)).toBe(key);
    });
  });

  describe('relative tab addressing', () => {
    it.each([
      ['この次のタブ', 'tab-relative'],
      ['この前のタブ', 'tab-relative'],
      ['今の次のタブ', 'tab-relative'],
      ['一個右のタブ', 'tab-relative'],
      ['一個左のタブ', 'tab-relative'],
      ['その隣', 'tab-relative'],
      ['two tabs to the left', 'tab-relative'],
      ['three tabs to the right', 'tab-relative'],
      ['tab to the left', 'tab-relative'],
      ['the tab next to this', 'tab-relative'],
      ['the tab after this', 'tab-relative'],
      ['tab beside it', 'tab-relative'],
      ['one tab over', 'tab-relative'],
    ])('"%s" → %s', (p, key) => {
      expect(dispatch(vc, tm, p)).toBe(key);
    });

    it('この次のタブ moves +1 from activeIndex', () => {
      dispatch(vc, tm, 'この次のタブ');
      expect(tm.activeIndex).toBe(2);
    });

    it('一個左のタブ moves -1 from activeIndex', () => {
      dispatch(vc, tm, '一個左のタブ');
      expect(tm.activeIndex).toBe(0);
    });

    it('two tabs to the left moves -2', () => {
      tm.activeIndex = 3;
      dispatch(vc, tm, 'two tabs to the left');
      expect(tm.activeIndex).toBe(1);
    });
  });

  describe('defer — honest absence for scheduled requests', () => {
    it.each([
      ['あとで閉じて', 'defer'],
      ['後で消して', 'defer'],
      ['あとで戻る', 'defer'],
      ['5分後に閉じて', 'defer'],
      ['一時間後に止めて', 'defer'],
      ['のちほど', 'defer'],
      ['do it later', 'defer'],
      ['in a bit', 'defer'],
      ['in a minute', 'defer'],
      ['remind me later', 'defer'],
      ['close it later', 'defer'],
      ['for later', 'defer'],
    ])('"%s" → %s (does not execute the embedded command)', (p, key) => {
      expect(dispatch(vc, tm, p)).toBe(key);
    });

    it('あとで閉じて closes nothing', () => {
      dispatch(vc, tm, 'あとで閉じて');
      expect(tm.closed).toEqual([]);
    });

    it('announces the honest absence', () => {
      dispatch(vc, tm, 'do it later');
      expect(vc.speak).toHaveBeenCalledWith(
        expect.stringContaining('あとでの実行はできません'));
    });
  });

  describe('Devin Review #383: negative-wish & symmetric pin fixes', () => {
    it.each([
      ['閉じんといい', 'negate'],
      ['閉じんといいかも', 'negate'],
      ['閉じんとええ', 'negate'],
      ['閉じんとよいかもね', 'negate'],
      ['読まんといい', 'negate'],
      ['nuh uh', 'negate'],
      ['uh uh', 'negate'],
    ])('"%s" → %s', (p, key) => {
      expect(dispatch(vc, tm, p)).toBe(key);
    });

    it('閉じんといい closes nothing', () => {
      dispatch(vc, tm, '閉じんといい');
      expect(tm.closed).toEqual([]);
    });

    it('pin the second tab on a pinned tab stays pinned (announce only)', () => {
      tm.tabs[1].pinned = true;
      dispatch(vc, tm, 'pin the second tab');
      expect(tm.pinned).toEqual([]); // no toggle
      expect(vc.speak).toHaveBeenCalledWith(
        expect.stringContaining('すでにピン留めされています'));
      expect(tm.tabs[1].pinned).toBe(true);
    });

    it('unpin the second tab on an unpinned tab stays unpinned', () => {
      dispatch(vc, tm, 'unpin the second tab');
      expect(tm.pinned).toEqual([]);
      expect(vc.speak).toHaveBeenCalledWith(
        expect.stringContaining('ピン留めされていません'));
    });

    it('pin the second tab on an unpinned tab still pins', () => {
      dispatch(vc, tm, 'pin the second tab');
      expect(tm.tabs[1].pinned).toBe(true);
    });
  });

  describe('number-word titles need a real tab suffix', () => {
    it.each([
      // 'one piece'/'two bucks' are titles, not ordinals
      ['close the one piece tab', 'close-tab-by-name'],
      ['pin the one piece tab', 'pin-tab-by-name'],
      ['switch to the one piece tab', 'tab-by-name'],
      // but ordinal forms still hit the positional commands
      ['close second tab', 'close-tab-ordinal'],
      ['close fifth tab', 'close-tab-ordinal'],
      ['close 2nd tab', 'close-tab-ordinal'],
      ['pin the third tab', 'tab-pin-n'],
    ])('"%s" → %s', (p, key) => {
      expect(dispatch(vc, tm, p)).toBe(key);
    });

    it('close the one piece tab closes by title match', () => {
      dispatch(vc, tm, 'close the one piece tab');
      expect(tm.closed).toEqual([3]);
    });
  });

  describe('EN politeness/tag chain tails', () => {
    it.each([
      ['care to close it', 'close-tab'],
      ['fancy closing it', 'close-tab'],
      ['might you close it', 'close-tab'],
      ['wont you close it', 'close-tab'],
      ['please and thank you close it', 'close-tab'],
      ['thank you close it', 'close-tab'],
      ['close it would ya', 'close-tab'],
      ['close it will ya', 'close-tab'],
      ['close it would you kindly', 'close-tab'],
      ['uh close it', 'close-tab'],
      ['er go back', 'back'],
      ['um read it', 'read-aloud'],
    ])('"%s" → %s', (p, key) => {
      expect(dispatch(vc, tm, p)).toBe(key);
    });
  });

  describe('JA tail inventory II (obligation/dialect)', () => {
    it.each([
      ['閉じるしかない', 'close-tab'],
      ['閉じるほかない', 'close-tab'],
      ['閉じるっきゃない', 'close-tab'],
      ['閉じるっきゃあ', 'close-tab'],
      ['閉じるしかねえ', 'close-tab'],
      ['閉じるんだってば', 'close-tab'],
      ['閉じるんしゃ', 'close-tab'],
      ['閉じるやい', 'close-tab'],
      ['閉じるがよ', 'close-tab'],
      ['閉じるだす', 'close-tab'],
      ['読むしかない', 'read-aloud'],
      ['閉じておこか', 'close-tab'],
      ['読んどこか', 'read-aloud'],
      ['閉じますねえ', 'close-tab'],
      ['閉じますなあ', 'close-tab'],
      ['読むねえ', 'read-aloud'],
      ['閉じるなあ', 'close-tab'],
    ])('"%s" → %s', (p, key) => {
      expect(dispatch(vc, tm, p)).toBe(key);
    });
  });

  describe('adverbial volume/rate fills', () => {
    it.each([
      ['way louder', 'volume-up'],
      ['a lot louder', 'volume-up'],
      ['too quiet', 'volume-up'],
      ['its too quiet', 'volume-up'],
      ['way too quiet', 'volume-up'],
      ['too soft', 'volume-up'],
      ['pump up the volume', 'volume-up'],
      ['turn it all the way up', 'volume-up'],
      ['speak louder', 'volume-up'],
      ['声をあげて', 'volume-up'],
      ['音をあげて', 'volume-up'],
      ['way too loud', 'volume-down'],
      ['too loud', 'volume-down'],
      ['quiet down', 'volume-down'],
      ['keep it down', 'volume-down'],
      ['not so loud', 'volume-down'],
      ['声をさげて', 'volume-down'],
      ['小さな声で', 'volume-down'],
      ['声をおさえて', 'volume-down'],
      ['too slow', 'speech-faster'],
      ['way too slow', 'speech-faster'],
      ['too fast', 'speech-slower'],
      ['way too fast', 'speech-slower'],
      ['slower still', 'speech-slower'],
      ['faster still', 'speech-faster'],
      ['super fast', 'speech-rate-status'],
      ['kinda fast', 'speech-rate-status'],
      ['really slow', 'trouble'],
      ['super slow', 'trouble'],
    ])('"%s" → %s', (p, key) => {
      expect(dispatch(vc, tm, p)).toBe(key);
    });
  });

  describe('scroll fraction & partway forms', () => {
    it.each([
      ['ほんの少し下', 'scroll-down'],
      ['ほんのちょっと下', 'scroll-down'],
      ['partway down', 'scroll-down'],
      ['ほんの少し上', 'scroll-up'],
      ['partway up', 'scroll-up'],
      ['halfway down', 'half-page-forward'],
      ['half way down', 'half-page-forward'],
      ['halfway up', 'half-page-back'],
      ['half way up', 'half-page-back'],
      ['a third of the way', 'percent-jump'],
      ['a quarter of the way', 'percent-jump'],
      ['half of the way', 'percent-jump'],
      ['three quarters of the way', 'percent-jump'],
      ['半分くらい', 'percent-jump'],
      ['半分ぐらい下', 'percent-jump'],
    ])('"%s" → %s', (p, key) => {
      expect(dispatch(vc, tm, p)).toBe(key);
    });
  });

  describe('help how-to parity', () => {
    it.each([
      ['how do we read this', 'help'],
      ['how do you close it', 'help'],
      ['what do i do', 'help'],
      ['what do i press', 'help'],
      ['which button', 'help'],
      ['どう閉じる', 'help'],
      ['閉じ方は', 'help'],
      ['閉じかたは', 'help'],
      ['戻り方は', 'help'],
      ['進み方', 'help'],
      ['読み方は', 'help'],
      ['使い方は', 'help'],
      ['探し方って', 'help'],
    ])('"%s" → %s', (p, key) => {
      expect(dispatch(vc, tm, p)).toBe(key);
    });
  });

  describe('echo/status/say-again misc', () => {
    it.each([
      ['閉じたっけ', 'describe-tab'],
      ['閉じるっけ', 'describe-tab'],
      ['閉じてたっけ', 'describe-tab'],
      ['閉じてはいる', 'describe-tab'],
      ['閉じてるんやったら', 'describe-tab'],
      ['読んでたっけ', 'speaking-status'],
      ['読んでいたっけ', 'speaking-status'],
      ['喋ってたっけ', 'speaking-status'],
      ['意味がわからない', 'say-again'],
      ['何言ってるかわからない', 'say-again'],
      ['何言ったか忘れた', 'say-again'],
      ['what do you mean', 'say-again'],
      ['what did it say', 'say-again'],
      ['press escape', 'input-methods'],
      ['space bar', 'input-methods'],
      ['hit the enter key', 'input-methods'],
      ['press the tab key', 'input-methods'],
      ['エスケープキー', 'input-methods'],
      ['スペースキー', 'input-methods'],
      ['toggle the mic', 'mic-status'],
      ['mic toggle', 'mic-status'],
      ['flip the mic', 'mic-status'],
      ['okey dokey', 'ack'],
      ['alrighty', 'ack'],
      ['mmkay', 'ack'],
      ['meh', 'ack'],
      ['phew', 'ack'],
      ['whew', 'ack'],
      ['see you later', 'vr-exit'],
      ['see ya later', 'vr-exit'],
    ])('"%s" → %s', (p, key) => {
      expect(dispatch(vc, tm, p)).toBe(key);
    });
  });

  describe('coexistence', () => {
    it.each([
      ['close the third tab', 'close-tab-ordinal'],
      ['close the last tab', 'close-tab-ordinal'],
      ['unpin the last tab', 'tab-pin-n'],
      ['switch to the last tab', 'tab-select'],
      ['pin the news tab', 'pin-tab-by-name'],
      ['close the news tab', 'close-tab-by-name'],
      ['switch to the news tab', 'tab-by-name'],
      ['next tab', 'next-tab'],
      ['later', 'vr-exit'],
      ['閉じて', 'close-tab'],
      ['戻って', 'back'],
      ['読んで', 'read-aloud'],
    ])('"%s" → %s', (p, key) => {
      expect(dispatch(vc, tm, p)).toBe(key);
    });
  });
});
