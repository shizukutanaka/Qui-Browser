/**
 * R83 — Relative-date answers + reference-phrase misroute fixes (pass XXXVII).
 * Probe-driven: 'reopen my last tab' switched to the last tab instead of
 * reopening, 'close the tab i just closed' closed the ACTIVE tab, '今のタブを
 * 閉じて'/'幾つのタブ' fell into by-name term misses, 'help please' asked
 * scoped-help about "please", and ~30 natural phrasings were NO-MATCH.
 */
const VC = require('../src/vr/input/VoiceCommands').VoiceCommands;

function makeVC() {
  const vc = new VC({ enabled: true });
  const tm = {
    tabs: [
      { currentTitle: 'Inbox — mail', currentUrl: 'https://mail.example.com', pinned: false },
      { currentTitle: 'News', currentUrl: 'https://news.example.com', pinned: false }
    ],
    activeIndex: 0,
    getActiveTab() {
      return this.tabs[this.activeIndex];
    },
    setActive(i) {
      this.activeIndex = i;
    },
    nextTab: jest.fn(),
    prevTab: jest.fn(),
    closeTab: jest.fn(() => true),
    reopenClosedTab: jest.fn(() => 'https://closed.example.com')
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.tm = tm;
  vc.said = [];
  vc.speak = (s) => vc.said.push(s);
  return vc;
}
const run = (vc, p) => {
  vc.lastCommand = null;
  vc.processCommand(p);
  return vc.lastCommand ? vc.lastCommand.key : null;
};

describe('reference-phrase misroutes', () => {
  test("'reopen my last tab' → reopen-tab (not last-tab switch)", () => {
    const vc = makeVC();
    expect(run(vc, 'reopen my last tab')).toBe('reopen-tab');
    expect(vc.tm.reopenClosedTab).toHaveBeenCalled();
  });

  test.each(['bring back my tab', 'the tab i closed', 'reopen it', 'reopen that'])(
    '%s → reopen-tab', (p) => {
      const vc = makeVC();
      expect(run(vc, p)).toBe('reopen-tab');
      expect(vc.tm.reopenClosedTab).toHaveBeenCalled();
    }
  );

  test("'close the tab i just closed' → reopen-tab, NOT active close", () => {
    const vc = makeVC();
    expect(run(vc, 'close the tab i just closed')).toBe('reopen-tab');
    expect(vc.tm.closeTab).not.toHaveBeenCalled();
    expect(vc.tm.reopenClosedTab).toHaveBeenCalled();
  });

  test("'ctrl z' / 'ctrl+z' → reopen-tab (undo surface)", () => {
    expect(run(makeVC(), 'ctrl z')).toBe('reopen-tab');
    expect(run(makeVC(), 'ctrl+z')).toBe('reopen-tab');
  });

  test('今のタブを閉じて → close-tab (not by-name miss)', () => {
    const vc = makeVC();
    expect(run(vc, '今のタブを閉じて')).toBe('close-tab');
    expect(vc.tm.closeTab).toHaveBeenCalled();
  });

  test('幾つのタブ → tab-status (not by-name miss)', () => {
    expect(run(makeVC(), '幾つのタブ')).toBe('tab-status');
  });

  test("'help please' → help (not scoped-help 'please' lookup)", () => {
    expect(run(makeVC(), 'help please')).toBe('help');
  });
});

describe('heading level vs ordinal', () => {
  test.each(['level two heading', 'heading level 2', 'h2', 'h3', '見出しレベル'])(
    '%s → heading-level honest atom', (p) => {
      const vc = makeVC();
      expect(run(vc, p)).toBe('heading-level');
      expect(vc.said[0]).toContain('2番目の見出し');
    }
  );

  test.each([
    ['first heading', 1],
    ['second heading', 2],
    ['third heading', 3],
    ['fifth heading', 5]
  ])('%s → heading-select with ordinal index', (p, n) => {
    const vc = makeVC();
    vc._onHeadingSelect = jest.fn(() => ({ index: n, total: 10 }));
    vc.lastCommand = null;
    vc.processCommand(p);
    expect(vc.lastCommand.key).toBe('heading-select');
    expect(vc._onHeadingSelect).toHaveBeenCalledWith(n);
  });

  test('2番目の見出し → heading-select (JA unchanged)', () => {
    const vc = makeVC();
    vc._onHeadingSelect = jest.fn(() => ({ index: 2, total: 10 }));
    expect(run(vc, '2番目の見出し')).toBe('heading-select');
    expect(vc._onHeadingSelect).toHaveBeenCalledWith(2);
  });
});

describe('relative-date answers', () => {
  test.each(['tomorrow', '明日は何日', '明日の日付'])('%s → date announces tomorrow', (p) => {
    const vc = makeVC();
    expect(run(vc, p)).toBe('date');
    const d = new Date();
    d.setDate(d.getDate() + 1);
    expect(vc.said[0]).toContain(`${d.getMonth() + 1}月${d.getDate()}日`);
  });

  test.each(['day after tomorrow', '明後日', 'あさって'])('%s → date announces +2', (p) => {
    const vc = makeVC();
    expect(run(vc, p)).toBe('date');
    const d = new Date();
    d.setDate(d.getDate() + 2);
    expect(vc.said[0]).toContain(`${d.getMonth() + 1}月${d.getDate()}日`);
  });

  test('next week / 来週 → +7', () => {
    const vc = makeVC();
    expect(run(vc, 'next week')).toBe('date');
    const d = new Date();
    d.setDate(d.getDate() + 7);
    expect(vc.said[0]).toContain(`${d.getMonth() + 1}月${d.getDate()}日`);
    const vc2 = makeVC();
    run(vc2, '来週');
    expect(vc2.said[0]).toContain(`${d.getMonth() + 1}月${d.getDate()}日`);
  });

  test('next month / 来月 → month+1', () => {
    const vc = makeVC();
    expect(run(vc, 'next month')).toBe('date');
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    expect(vc.said[0]).toContain(`${d.getMonth() + 1}月`);
    const vc2 = makeVC();
    run(vc2, '来月');
    expect(vc2.said[0]).toContain(`${d.getMonth() + 1}月`);
  });

  test.each(['next year', '来年'])('%s → year+1', (p) => {
    const vc = makeVC();
    expect(run(vc, p)).toBe('date');
    expect(vc.said[0]).toContain(`${new Date().getFullYear() + 1}年`);
  });

  test('今年 → current year', () => {
    const vc = makeVC();
    expect(run(vc, '今年')).toBe('date');
    expect(vc.said[0]).toContain(`${new Date().getFullYear()}年`);
  });

  test.each(['whats the date', "today's date", 'the date', '今日何日', '何日ですか'])(
    '%s → date (today)', (p) => {
      const vc = makeVC();
      expect(run(vc, p)).toBe('date');
      const d = new Date();
      expect(vc.said[0]).toContain(`${d.getMonth() + 1}月${d.getDate()}日`);
    }
  );

  test('今日の日付 unchanged', () => {
    const vc = makeVC();
    expect(run(vc, '今日の日付')).toBe('date');
    const d = new Date();
    expect(vc.said[0]).toContain(`今日は${d.getMonth() + 1}月${d.getDate()}日`);
  });
});

describe('tab switching generic phrasing', () => {
  test.each(['switch tabs', 'change tab', 'swap tabs', 'the other tab', 'other tab'])(
    '%s → next-tab', (p) => {
      const vc = makeVC();
      expect(run(vc, p)).toBe('next-tab');
      expect(vc.tm.nextTab).toHaveBeenCalled();
    }
  );

  test.each(['タブを切り替え', 'タブ切り替え', 'タブを変えて', '違うタブ', 'タブを切り替えて'])(
    '%s → next-tab', (p) => {
      const vc = makeVC();
      expect(run(vc, p)).toBe('next-tab');
      expect(vc.tm.nextTab).toHaveBeenCalled();
    }
  );
});

describe('go-to natural forms', () => {
  test("'go youtube' → go-to (bare go)", () => {
    expect(run(makeVC(), 'go youtube')).toBe('go-to');
  });

  test("'youtube に行って' / 'youtube へ行って' → go-to", () => {
    expect(run(makeVC(), 'youtube に行って')).toBe('go-to');
    expect(run(makeVC(), 'youtube へ行って')).toBe('go-to');
  });

  test.each(['go back', 'go forward', 'go up', 'go down', 'go home'])(
    "'%s' keeps its own owner (not go-to)", (p) => {
      expect(run(makeVC(), p)).not.toBe('go-to');
    }
  );
});

describe('complaint/quiet/help fills', () => {
  test.each(['be quiet', 'shut up', 'be silent', 'quiet please', 'silence'])(
    '%s → mute-toggle', (p) => {
      expect(run(makeVC(), p)).toBe('mute-toggle');
    }
  );

  test.each(['what should i say', 'how do i use this', '使い方がわからない', '操作方法がわからない', 'やり方がわからない'])(
    '%s → help', (p) => {
      expect(run(makeVC(), p)).toBe('help');
    }
  );

  test.each(['cancel all', 'cancel everything', '全部キャンセル', 'すべてキャンセル', '全てやめて'])(
    '%s → stop-everything', (p) => {
      expect(run(makeVC(), p)).toBe('stop-everything');
    }
  );

  test.each(['close app', 'close browser', 'close the browser'])('%s → vr-exit', (p) => {
    expect(run(makeVC(), p)).toBe('vr-exit');
  });

  test.each(['最大化して', '最小化して', '画面を最大化'])('%s → window-state', (p) => {
    expect(run(makeVC(), p)).toBe('window-state');
  });

  test.each(['真っ暗だ', '真っ黒', '画面が真っ暗'])('%s → trouble', (p) => {
    expect(run(makeVC(), p)).toBe('trouble');
  });
});

describe('scroll/rate fills', () => {
  test.each(['move up', 'up a bit', 'go up a bit'])('%s → scroll-up', (p) => {
    expect(run(makeVC(), p)).toBe('scroll-up');
  });

  test.each(['move down', 'down a bit', 'little scroll', 'scroll some', 'scroll a bit'])(
    '%s → scroll-down', (p) => {
      expect(run(makeVC(), p)).toBe('scroll-down');
    }
  );

  test.each(['もっと早く読んで', '早く読んで', '速く読んで', 'もっと速く'])(
    '%s → speech-faster', (p) => {
      expect(run(makeVC(), p)).toBe('speech-faster');
    }
  );

  test('読み続ける → resume-reading', () => {
    expect(run(makeVC(), '読み続ける')).toBe('resume-reading');
  });
});

describe('coexistence guards', () => {
  test('last tab → last-tab (switch to rightmost, unchanged)', () => {
    const vc = makeVC();
    expect(run(vc, 'last tab')).toBe('last-tab');
    expect(vc.tm.reopenClosedTab).not.toHaveBeenCalled();
  });

  test('reopen tab → reopen-tab (bare form unchanged)', () => {
    expect(run(makeVC(), 'reopen tab')).toBe('reopen-tab');
  });

  test('close this tab → close-tab', () => {
    const vc = makeVC();
    expect(run(vc, 'close this tab')).toBe('close-tab');
    expect(vc.tm.closeTab).toHaveBeenCalled();
  });

  test('help me → help (scoped-help me-guard intact)', () => {
    expect(run(makeVC(), 'help me')).toBe('help');
  });

  test('help with volume → scoped-help', () => {
    expect(run(makeVC(), 'help with volume')).toBe('scoped-help');
  });
});
