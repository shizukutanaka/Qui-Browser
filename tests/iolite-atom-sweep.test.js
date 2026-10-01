// CCLXXXVII pass — iolite sweep: EN finale/departure idioms (whistle/bell/last-call,
// school-out, wheels-up, candle-out) + JA お開き/閉会/散会/撤収 + 暖簾/シャッター/看板下ろし
// + 帳閉じ family. Misroute: 'call the game' no longer hits device-apps.
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function boot() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  const tm = {
    tabs: [
      { id: 1, url: 'https://x.example', title: 'A', loading: false },
      { id: 2, url: 'https://y.example', title: 'B', loading: false },
    ],
    activeIndex: 0,
    activeTabId: 1,
    getActiveTab() { return this.tabs[this.activeIndex]; },
    getTab(i) { return this.tabs[i]; },
    setActive() {},
  };
  vc.connectBrowser(tm);
  return vc;
}

function hit(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase, 0.9);
  return vc.lastCommand && vc.lastCommand.key;
}

describe('EN finale/departure idioms → close-tab', () => {
  const vc = boot();
  const cases = [
    'final whistle', 'blow the whistle', 'blow the whistle on it',
    'call the game', 'call the ballgame', 'mercy rule',
    'thats the whistle', 'full time close it', 'game set match',
    'game set and match', 'class dismissed', 'schools out',
    'school is out', 'thats the bell', 'last call',
    'last call close it', 'its last call', 'bar is closing',
    'the bar is closing', 'wheels up', 'all ashore',
    'weigh anchor', 'boarding complete', 'blow out the candle',
    'blow the candle out', 'put out the light', 'bedtime for it',
    'its bedtime', 'over the rail', 'this one is dismissed',
  ];
  test.each(cases)('%s', (p) => { expect(hit(vc, p)).toBe('close-tab'); });
});

describe('JA お開き/閉会/撤収 + 暖簾/看板/帳閉じ → close-tab', () => {
  const vc = boot();
  const cases = [
    'お開きにして', 'お開きで', 'お開きだ', 'おひらき', 'おひらきにして',
    '閉会して', '閉会にして', '散会して', '散会で', '散会にして',
    '終演して', '終演にして', '閉演して', '退場して', '退場させて',
    '撤収して', '撤収で',
    '暖簾を下ろして', '暖簾おろして', 'のれんを下ろして', 'のれんおろして',
    'シャッター下ろして', 'シャッターを閉めて', 'シャッターを下ろして',
    '看板下ろして', '看板を下ろして', '閉店ガラガラ',
    '帳を閉じて', '帳閉じして', 'シメて', '締めくくり', '締めくくって',
    '閉会式', '閉会の挨拶', '終了のお知らせ',
    'お仕舞いだ', 'お終いだ', '仕舞いにして',
    'お開きにしましょう', '散会にしましょう', '閉会にしましょう',
  ];
  test.each(cases)('%s', (p) => { expect(hit(vc, p)).toBe('close-tab'); });
});

describe('pins + misroute regressions', () => {
  const vc = boot();
  const cases = [
    // null-pinned (no execution semantics)
    ['curtain call', null],
    ['turn the final page', null],
    ['まだ閉じてない', null],
    ['閉じられてなかった', null],
    // established owners must not be stolen
    ['lights out', 'dark-mode'],
    ['lights out for it', 'close-tab'],
    ['lights out close it', 'close-tab'],
    ['stash it away', 'bookmark-page'],
    ['help yourself close it', 'scoped-help'],
    ['last page', 'scroll-bottom'],
    ['畳んで', 'close-all-tabs'],
    ['畳んじゃって', 'close-all-tabs'],
    ['閉じると言ったのに', 'trouble'],
    ['閉じれますか', 'help'],
    ['閉じられますか', 'help'],
    // device-apps 'call X' keeps app nouns but releases 'call the game'
    ['call the game', 'close-tab'],
    ['closing time', 'close-tab'],
    ['end of chapter', 'close-tab'],
  ];
  test.each(cases)('%s → %s', (p, k) => { expect(hit(vc, p)).toBe(k); });
});
