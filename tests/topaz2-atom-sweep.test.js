// pass CCLXXVI: scroll/refresh/navigate/describe/working-status fills.
// Fixes: 'move it down/up'→close-tab, 'whats on this tab'→video-status misroutes.
// 'うまくいった/成功した'→ack (celebration reports, やった-family).
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function mk() {
  const t1 = { id: 1, url: 'https://a.example', title: 'Tab A', loading: false };
  const t2 = { id: 2, url: 'https://b.example', title: 'Tab B', loading: false };
  return {
    tabs: [t1, t2],
    activeTab: t2,
    activeTabId: 2,
    getActiveTab() { return this.activeTab; },
    getTab(id) { return this.tabs.find((t) => t.id === id); },
  };
}

function key(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

describe('pass CCLXXVI: scroll/refresh/nav/describe/status fills', () => {
  const tabManager = mk();
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser(tabManager);

  const cases = [
    // scroll-down
    ['scroll it down', 'scroll-down'], ['下に進んで', 'scroll-down'],
    ['下のほうへ', 'scroll-down'], ['下げてスクロール', 'scroll-down'],
    ['slide it down', 'scroll-down'], ['move it down', 'scroll-down'],
    ['down a bit more', 'scroll-down'], ['a bit further down', 'scroll-down'],
    ['keep going down', 'scroll-down'], ['more down', 'scroll-down'],
    ['下を読んで', 'scroll-down'],
    // scroll-up
    ['scroll it up', 'scroll-up'], ['上に戻ってスクロール', 'scroll-up'],
    ['上のほうへ', 'scroll-up'], ['back up a bit', 'scroll-up'],
    ['move it up', 'scroll-up'], ['slide it up', 'scroll-up'],
    ['up a bit more', 'scroll-up'], ['a bit further up', 'scroll-up'],
    ['上を見て', 'scroll-up'], ['more up', 'scroll-up'],
    ['up a little', 'scroll-up'], ['もう少し上のほう', 'scroll-up'],
    // scroll-top / bottom
    ['page top', 'scroll-top'], ['一番上まで', 'scroll-top'],
    ['端まで上げて', 'scroll-top'], ['hit the top', 'scroll-top'],
    ['very top', 'scroll-top'], ['天井まで', 'scroll-top'],
    ['page bottom', 'scroll-bottom'], ['一番下までいって', 'scroll-bottom'],
    ['hit the bottom', 'scroll-bottom'], ['very bottom', 'scroll-bottom'],
    ['どん底まで', 'scroll-bottom'],
    // refresh
    ['give it a refresh', 'refresh'], ['do a refresh', 'refresh'],
    ['refresh it for me', 'refresh'], ['fresh copy', 'refresh'],
    ['get a fresh copy', 'refresh'], ['pull a fresh copy', 'refresh'],
    ['リロード頼む', 'refresh'], ['リロードだ', 'refresh'],
    ['reload this for me', 'refresh'], ['reload it again', 'refresh'],
    ['one more refresh', 'refresh'], ['fresh load', 'refresh'], ['load it fresh', 'refresh'],
    // navigate (forward)
    ['one step forward', 'navigate'], ['advance', 'navigate'],
    ['advance one', 'navigate'], ['press forward', 'navigate'],
    ['move ahead', 'navigate'], ['march forward', 'navigate'],
    ['push forward', 'navigate'], ['move onward', 'navigate'],
    ['onward', 'navigate'], ['proceed', 'navigate'], ['次進んで', 'navigate'],
    // back
    ['さっきのとこ見て', 'back'], ['さっきのとこに戻って', 'back'],
    // resume-reading continuation
    ['そのまま進んで', 'resume-reading'],
    // describe-tab
    ['what have i got open', 'describe-tab'], ['tell me about this tab', 'describe-tab'],
    ['whats the current tab', 'describe-tab'], ['whats on this tab', 'describe-tab'],
    ['このタブは何', 'describe-tab'], ['今のタブって何', 'describe-tab'],
    ['describe what im seeing', 'describe-tab'], ['what do i have open', 'describe-tab'],
    ['今見てるのは', 'describe-tab'],
    // working-status
    ['are you doing it', 'working-status'], ['doing it yet', 'working-status'],
    ['did it go through', 'working-status'], ['できてる', 'working-status'],
    ['やってくれてる', 'working-status'], ['まだやってる', 'working-status'],
    ['処理中', 'working-status'], ['うまくいったか', 'working-status'],
    // ack celebration reports
    ['うまくいった', 'ack'], ['成功した', 'ack'],
    // coexistence pins
    ['もうちょい下', 'scroll-down'], ['keep scrolling', 'scroll-down'],
    ['もうちょい上', 'scroll-up'], ['way up', 'scroll-top'], ['way down', 'scroll-bottom'],
    ['下までいって', 'scroll-bottom'], ['末端まで', 'scroll-bottom'],
    ['最初まで戻って', 'nav-steps'], ['最後まで読んで', 'read-here'],
    ['refresh again', 'refresh'], ['読み直してちょうだい', 'read-aloud'],
    ['go forward one', 'nav-steps'], ['forward one', 'nav-steps'],
    ['次に行って', 'go-to'], ['進んでくれ', 'navigate'], ['先へ進んで', 'navigate'],
    ['どんどん進んで', 'resume-reading'], ['読み進めて', 'resume-reading'],
    ['forward to the next page', 'next-page'],
    ['whats this page', 'where-am-i'], ['ここはどこ', 'where-am-i'],
    ['どこのページ', 'hostname'], ['今どこにいる', 'where-am-i'],
    ['what is this tab', 'describe-tab'], ['何のページ', 'describe-tab'],
    ['今開いてるのは', 'tabs-list'], ['what am i looking at', 'describe-tab'],
    ['still working on it', 'working-status'], ['is it done yet', 'working-status'],
    ['did it work', 'working-status'], ['できたかな', 'working-status'],
  ];
  for (const [p, k] of cases) test(`${JSON.stringify(p)} -> ${k}`, () => expect(key(vc, p)).toBe(k));
});
