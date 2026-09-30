/**
 * Processive/quantifier atoms — JA ていく/てくる/てもよい/ちょうだい request
 * tails, quantifier collections ('a few tabs'/'いくつかのタブ'), fraction
 * jumps, keep-moving resume fixes, and honest misroute repairs (pass LIII).
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function makeTabs(titles, opts = {}) {
  const tabs = titles.map((t, i) => ({
    currentTitle: t, currentUrl: `https://ex/${i}`, pinned: (opts.pinned || []).includes(t),
    muted: false
  }));
  const calls = { setActive: [], closeTab: [], closeOtherTabs: 0 };
  const tm = {
    tabs, activeIndex: 0,
    getActiveTab: () => tabs[tm.activeIndex],
    setActive: (i) => { calls.setActive.push(i); tm.activeIndex = i; },
    closeTab: (i) => { calls.closeTab.push(i); tabs.splice(i, 1); return true; },
    closeOtherTabs: () => { calls.closeOtherTabs++; },
    pinTab: () => {}, unpinTab: () => {}, moveTab: () => {}, muteTab: () => {},
    open: () => {}, closeAll: () => {}
  };
  return { tm, calls };
}

function run(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase);
  return vc.lastCommand;
}

function boot(titles) {
  const { tm, calls } = makeTabs(titles);
  const vc = new VoiceCommands({ enabled: true });
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  return { vc, calls };
}

describe('JA processive tails — てきて/ていく/てもよい/ちょうだい', () => {
  const { vc } = boot(['A', 'B']);
  const cases = [
    ['閉じてきて', 'close-tab'], ['閉じてくる', 'close-tab'], ['閉じてこい', 'close-tab'],
    ['戻ってくる', 'back'], ['戻ってきて', 'back'], ['読んでいって', 'read-aloud'],
    ['閉じていって', 'close-tab'], ['読んでいくよ', 'read-aloud'],
    ['閉じてもよい', 'close-tab'], ['閉じてもええ', 'close-tab'], ['戻ってもいいかな', 'back'],
    ['読んでもよか', 'read-aloud'],
    ['閉じてちょうだい', 'close-tab'], ['読んでちょうだい', 'read-aloud'],
    ['閉じなさいませ', 'close-tab'], ['戻りまして', 'back'], ['閉じまして', 'close-tab']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    expect(c && c.key).toBe(k);
  });
});

describe('negate — leave-it/no-intent forms', () => {
  const { vc } = boot(['A', 'B']);
  const cases = [
    ['without closing it', 'negate'], ['on second thought', 'negate'],
    ['second thoughts', 'negate'], ['never mind that', 'negate'],
    ['気がない', 'negate'], ['つもりはない', 'negate'], ['するつもりはない', 'negate'],
    ['いいです', 'negate'], ['いいんです', 'negate'],
    ['そのままお願い', 'negate'], ['そのままにして', 'negate'], ['このままにして', 'negate'],
    ['閉じないで', 'negate'], ['そのまま', 'negate']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    expect(c && c.key).toBe(k);
  });
});

describe('say-again — echo repair forms', () => {
  const { vc } = boot(['A', 'B']);
  const cases = [
    ['say it again', 'say-again'], ['what was that', 'say-again'],
    ['what was it', 'say-again'], ['say what', 'say-again'],
    ['何って', 'say-again'], ['今何て言った', 'say-again'], ['何て言った', 'say-again'],
    ['なんて言った', 'say-last-transcript']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    expect(c && c.key).toBe(k);
  });
});

describe('tab quantifiers — status vs list vs by-name', () => {
  const { vc } = boot(['A', 'B', 'C']);
  const cases = [
    ['いくつかのタブ', 'tab-status'], ['何個かのタブ', 'tab-status'],
    ['a couple of tabs', 'tab-status'], ['a few tabs', 'tab-status'],
    ['several tabs', 'tab-status'],
    ['every tab', 'tabs-list'], ['all of the tabs', 'tabs-list'],
    ['all of my tabs', 'tabs-list'], ['each tab', 'tabs-list'], ['全部タブ', 'tabs-list']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    expect(c && c.key).toBe(k);
  });
});

describe('close-other-tabs — exception phrasing', () => {
  const { vc, calls } = boot(['A', 'B', 'C']);
  const cases = [
    ['except this one', 'close-other-tabs'], ['all but this one', 'close-other-tabs'],
    ['all but one', 'close-other-tabs'], ['close everything except this one', 'close-other-tabs'],
    ['このタブ以外', 'close-other-tabs'], ['これだけ残して', 'close-other-tabs']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    expect(c && c.key).toBe(k);
  });
  test('sweeper actually fires the bulk close', () => {
    const before = calls.closeOtherTabs;
    run(vc, 'except this one');
    expect(calls.closeOtherTabs).toBe(before + 1);
  });
});

describe('percent-jump — fraction & midpoint forms', () => {
  const { vc } = boot(['A']);
  const cases = [
    ['middle of the page', 50], ['middle of it', 50], ['the midpoint', 50],
    ['halfway point', 50], ['ページの中間', 50], ['記事の真ん中', 50],
    ['three quarters down', 75], ['three quarters through', 75], ['四分の三', 75],
    ['a third down', 33], ['三分の一', 33], ['三分の二', 66]
  ];
  test.each(cases)('"%s" → percent-jump %s', (p, pct) => {
    const c = run(vc, p);
    expect(c && c.key).toBe('percent-jump');
    expect(c && c.result && c.result.percent).toBe(pct);
  });
});

describe('tab-select — bare digit ordinals', () => {
  const { vc, calls } = boot(['A', 'B', 'C']);
  const cases = [
    ['2nd tab', 1], ['3rd tab', 2], ['the 1st tab', 0], ['tab number 2', 1]
  ];
  test.each(cases)('"%s" selects index %s', (p, idx) => {
    calls.setActive.length = 0;
    const c = run(vc, p);
    expect(c && c.key).toBe('tab-select');
    expect(c && c.result && c.result.index).toBe(idx);
  });
  test('12th tab answers honestly when the strip is shorter', () => {
    const c = run(vc, '12th tab');
    expect(c && c.key).toBe('tab-select');
    expect(c && c.result && c.result.index).toBe(-1);
  });
});

describe('article/page idioms', () => {
  const { vc } = boot(['A']);
  const cases = [
    ['next article', 'next-page'], ['the next article', 'next-page'],
    ['next post', 'next-page'], ['flip the page', 'next-page'],
    ['turn the page', 'next-page'], ['次の記事', 'next-page'], ['記事をめくって', 'next-page'],
    ['ページ送りして', 'next-page'], ['めくってみて', 'next-page'],
    ['previous article', 'prev-page'], ['the previous article', 'prev-page'],
    ['前の記事', 'prev-page'], ['flip back', 'prev-page'], ['記事を戻して', 'prev-page']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    expect(c && c.key).toBe(k);
  });
});

describe('progress/completion queries', () => {
  const { vc } = boot(['A']);
  const cases = [
    ['どこまで読み終わった', 'reader-progress'], ['読み終えた', 'reader-progress'],
    ['読み終えました', 'reader-progress'], ['読了した', 'reader-progress'],
    ['done reading', 'reader-progress'], ['finished reading', 'reader-progress'],
    ['im done reading', 'reader-progress'], ['finished the article', 'reader-progress']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    expect(c && c.key).toBe(k);
  });
});

describe('char-count — word/remaining forms', () => {
  const { vc } = boot(['A']);
  const cases = [
    ['how many words', 'char-count'], ['文字数は', 'char-count'],
    ['あと何文字', 'char-count'], ['残りの文字数', 'char-count'],
    ['文字数を教えて', 'char-count'], ['単語数', 'char-count'], ['何単語', 'char-count'],
    ['how many words are there', 'char-count'], ['how many words are left', 'char-count']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    expect(c && c.key).toBe(k);
  });
});

describe('pause — wait/away idioms', () => {
  const { vc } = boot(['A']);
  const cases = [
    ['hold on a moment', 'pause-reading'], ['wait for it', 'pause-reading'],
    ['i will be back', 'pause-reading'], ['ill be back', 'pause-reading'],
    ['be back in a sec', 'pause-reading'], ['give me a moment', 'pause-reading'],
    ['hang on a moment', 'pause-reading'], ['途中でやめて', 'pause-reading'],
    ['途中でやめる', 'pause-reading'], ['一旦やめて', 'pause-reading']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    expect(c && c.key).toBe(k);
  });
});

describe('volume — complaint/quiet forms', () => {
  const { vc } = boot(['A']);
  const cases = [
    ['whisper', 'volume-down'], ['deafening', 'volume-down'],
    ['painfully loud', 'volume-down'], ['ear splitting', 'volume-down'],
    ['too loud for me', 'volume-down'],
    ['静かすぎる', 'volume-up'], ['静かすぎ', 'volume-up'], ['speak up a bit', 'volume-up'],
    ['静かにお願い', 'mute-toggle'], ['静かにお願いします', 'mute-toggle']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    expect(c && c.key).toBe(k);
  });
});

describe('resume/continue forms', () => {
  const { vc } = boot(['A']);
  const cases = [
    ['keep on reading', 'resume-reading'], ['keep it moving', 'resume-reading'],
    ['このまま読んで', 'resume-reading'], ['そのまま読んで', 'resume-reading'],
    ['このまま続けて', 'resume-reading'], ['continue as is', 'resume-reading'],
    ['keep it coming', 'resume-reading'], ['keep it up', 'resume-reading']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    expect(c && c.key).toBe(k);
  });
});

describe('read-aloud — together/re-read forms', () => {
  const { vc } = boot(['A']);
  const cases = [
    ['follow along', 'read-aloud'], ['read with me', 'read-aloud'],
    ['一緒に読んで', 'read-aloud'], ['伴って読んで', 'read-aloud'],
    ['keep up with me', 'read-aloud'], ['再読して', 'read-aloud'], ['再読', 'read-aloud'],
    ['読み返して', 'read-aloud']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    expect(c && c.key).toBe(k);
  });
});

describe('EN prefix strips — opportunistic/polite frames', () => {
  const { vc } = boot(['A', 'B']);
  const cases = [
    ['while youre at it close it', 'close-tab'],
    ['while you are at it, go back', 'back'],
    ['since youre here, close it', 'close-tab'],
    ['when you get a sec, close this', 'close-tab'],
    ['if you have a moment, go back', 'back'],
    ['before you go, close it', 'close-tab'],
    ['if its not too much trouble, mute it', 'mute-toggle'],
    ['whenever you can, go back', 'back'],
    ['at your earliest convenience, close it', 'close-tab']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    expect(c && c.key).toBe(k);
  });
});

describe('vr-exit — leaving forms', () => {
  const { vc } = boot(['A']);
  const cases = [
    ['before i go', 'vr-exit'], ['before i leave', 'vr-exit'],
    ['im off', 'vr-exit'], ['gotta go', 'vr-exit'], ['i gotta run', 'vr-exit'],
    ['im heading out', 'vr-exit']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    expect(c && c.key).toBe(k);
  });
});

describe('ack — bare discourse frames', () => {
  const { vc } = boot(['A']);
  const cases = [
    ['そのついでに', 'ack'], ['そのついで', 'ack'],
    ['while you are at it', 'ack'], ['while youre at it', 'ack']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    expect(c && c.key).toBe(k);
  });
});

describe('coexistence — established routes preserved', () => {
  const { vc } = boot(['A', 'B', 'C']);
  const cases = [
    ['あとで読む', 'bookmark-page'], ['あとで閉じて', 'defer'],
    ['keep it', 'negate'], ['ページを送って', 'share-page'],
    ['mute the mic', 'stop'], ['ページをめくって', 'scroll-down'],
    ['もう一回読んで', 'read-aloud'],
    ['読んでいる最中', 'speaking-status'], ['読みつつある', 'speaking-status'],
    ['喋りつつある', 'speaking-status'],
    ['halfway', 'half-page-forward'], ['halfway down', 'half-page-forward'],
    ['the last one', 'last-tab'], ['close the third tab', 'close-tab-ordinal'],
    ['switch to the second tab', 'tab-select'], ['one tab over', 'tab-relative'],
    ['scroll to the top', 'scroll-top'], ['whats the volume', 'volume-status'],
    ['いいね', 'ack'], ['そのまま進めて', 'navigate']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    expect(c && c.key).toBe(k);
  });
});

describe('review #384 regressions', () => {
  test('save-for-later stays a bookmark, not a defer', () => {
    const { vc } = boot(['A', 'B']);
    const c = run(vc, 'save it for later');
    expect(c && c.key).toBe('bookmark-page');
    expect(run(vc, 'do it later').key).toBe('defer');
  });
  test('relative address + trailing を action does not switch tabs', () => {
    const { vc, calls } = boot(['A', 'B', 'C']);
    calls.setActive.length = 0;
    const c = run(vc, 'この次のタブを閉じて');
    expect(c && c.key).not.toBe('tab-relative');
    expect(calls.setActive.length).toBe(0);
    calls.setActive.length = 0;
    const c2 = run(vc, 'その隣のタブを閉じて');
    expect(c2 && c2.key).not.toBe('tab-relative');
    expect(calls.setActive.length).toBe(0);
  });
  test('one-step neighbours wrap at the strip edge like nextTab/prevTab', () => {
    const { vc, calls } = boot(['A', 'B', 'C']);
    run(vc, '三番目のタブ');
    calls.setActive.length = 0;
    const c = run(vc, 'この次のタブ');
    expect(c && c.key).toBe('tab-relative');
    expect(c.result.index).toBe(0);
    run(vc, '1番目のタブ');
    calls.setActive.length = 0;
    const c2 = run(vc, 'この前のタブ');
    expect(c2.result.index).toBe(2);
    run(vc, '三番目のタブ');
    calls.setActive.length = 0;
    const c3 = run(vc, '一個右のタブ');
    expect(c3.result.index).toBe(0);
    const c4 = run(vc, 'the next tab over');
    expect(c4.key).toBe('next-tab');
    expect(calls.setActive[calls.setActive.length - 1]).toBe(0);
  });
  test('counted relative offsets still answer honestly at the edge', () => {
    const { vc } = boot(['A', 'B', 'C']);
    const c = run(vc, '4 tabs to the right');
    expect(c && c.key).toBe('tab-relative');
    expect(c.result.index).toBe(-1);
  });
});
