/**
 * Adverb-prefix & intent-frame atoms — JA hedge/adverb openers
 * (さあ/ほら/やっぱり/できれば/よかったら), suggestion frames
 * (てはどう/たらどうかな), intent reports (ようと思って), request tails
 * (ておくれ/たりして/ちゃおうかな), EN 'how about X-ing'/
 * 'it down for me'/'if you would'/'whenever' tails (pass LIV).
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function makeTabs(titles) {
  const tabs = titles.map((t, i) => ({
    currentTitle: t, currentUrl: `https://ex/${i}`, pinned: false, muted: false
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

describe('JA adverb/hedge openers', () => {
  const { vc } = boot(['A', 'B']);
  const cases = [
    ['さあ閉じて', 'close-tab'], ['ほら閉じて', 'close-tab'], ['やっぱり閉じて', 'close-tab'],
    ['やっぱ閉じて', 'close-tab'], ['できれば閉じて', 'close-tab'], ['可能なら閉じて', 'close-tab'],
    ['よかったら閉じて', 'close-tab'], ['もしよければ閉じて', 'close-tab'],
    ['よろしければ閉じて', 'close-tab'], ['良ければ閉じて', 'close-tab'],
    ['さあ読んで', 'read-aloud'], ['ほら戻って', 'back'], ['やっぱり戻って', 'back'],
    ['できれば読んで', 'read-aloud'], ['よかったら進んで', 'navigate']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    expect(c && c.key).toBe(k);
  });
});

describe('suggestion frames — てはどう/たらどうかな', () => {
  const { vc } = boot(['A']);
  const cases = [
    ['閉じてはどう', 'close-tab'], ['閉じてはいかが', 'close-tab'],
    ['読んでみてはどう', 'read-aloud'], ['戻ってはどう', 'back'],
    ['閉じたらどうかな', 'close-tab'], ['閉じたらいかが', 'close-tab'],
    ['読んだらどう', 'read-aloud'], ['戻ったらどうです', 'back'],
    ['閉じたらいいか', 'close-tab']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    expect(c && c.key).toBe(k);
  });
});

describe('intent reports & dialect requests', () => {
  const { vc } = boot(['A', 'B']);
  const cases = [
    ['閉じようと思って', 'close-tab'], ['読もうと思って', 'read-aloud'],
    ['戻ろうと思って', 'back'], ['閉じようと思う', 'close-tab'],
    ['閉じておくれ', 'close-tab'], ['閉じておくれよ', 'close-tab'],
    ['読んでおくれ', 'read-aloud'], ['戻っておくれ', 'back'],
    ['閉じちゃおうかな', 'close-tab'], ['読んじゃおうかな', 'read-aloud'],
    ['閉じちゃおう', 'close-tab'],
    ['閉じたり', 'close-tab'], ['読んだり', 'read-aloud'], ['戻ったり', 'back'],
    ['閉じたりして', 'close-tab'], ['閉じたりする', 'close-tab']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    expect(c && c.key).toBe(k);
  });
});

describe('EN permission/gerund/tail frames', () => {
  const { vc, calls } = boot(['A', 'B', 'C']);
  const cases = [
    ['would you mind closing it', 'close-tab'],
    ['how about closing it', 'close-tab'], ['how about going back', 'back'],
    ['how about reading it', 'read-aloud'],
    ['close it down for me', 'close-tab'], ['close it down', 'close-tab'],
    ['shut it down for me', 'close-tab'],
    ['close it if you would', 'close-tab'], ['close it if you could', 'close-tab'],
    ['go back if you would', 'back'],
    ['close it whenever', 'close-tab'], ['go back whenever', 'back'],
    ['read it whenever', 'read-aloud']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    expect(c && c.key).toBe(k);
  });
  test('"close it down for me" actually closes', () => {
    const before = calls.closeTab.length;
    run(vc, 'close it down for me');
    expect(calls.closeTab.length).toBe(before + 1);
  });
});

describe('remaining-page queries', () => {
  const { vc } = boot(['A']);
  const cases = [
    ['あと何枚', 'reader-progress'], ['あと何ページ', 'reader-progress'],
    ['残り何ページ', 'reader-progress'], ['残り何枚', 'reader-progress'],
    ['how many pages left', 'reader-progress'], ['how many pages are left', 'reader-progress'],
    ['how many pages remain', 'reader-progress']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    expect(c && c.key).toBe(k);
  });
});

describe('coexistence — established routes preserved', () => {
  const { vc } = boot(['A', 'B', 'C']);
  const cases = [
    ['思って', null], ['とりあえず閉じて', 'close-tab'], ['閉じよう', 'close-tab'],
    ['読んでみて', 'read-aloud'], ['close it up', 'close-tab'],
    ['close it out', 'close-tab'], ['how about we close it', 'close-tab'],
    ['do it later', 'defer'], ['save it for later', 'bookmark-page'],
    ['いいです', 'negate'], ['そのままにして', 'negate'],
    ['この次のタブ', 'tab-relative'], ['one tab over', 'tab-relative']
  ];
  test.each(cases)('"%s" → %s', (p, k) => {
    const c = run(vc, p);
    if (k === null) {
      expect(c && c.key).not.toBe('close-tab');
    } else {
      expect(c && c.key).toBe(k);
    }
  });
});
