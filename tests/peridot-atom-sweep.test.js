// pass CCLXXIII: still-present reports -> describe-tab, reiteration rebukes ->
// close-tab, failed-expectation reports -> trouble; interrogative close queries
// stay status (no execute). Fixes まだここにいる -> go-to misroute via goToJp
// lookahead (normalizer rewrites にいる->にいって which goToJp caught).
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

describe('pass CCLXXIII: still-here / reiteration / failed-expectation routing', () => {
  const tabManager = mk();
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser(tabManager);

  const cases = [
    // EN still-present reports -> describe-tab
    ['its still here', 'describe-tab'], ['its still sitting there', 'describe-tab'],
    ['its still up there', 'describe-tab'], ['its not gone', 'describe-tab'],
    ['it hasnt gone away', 'describe-tab'], ['it didnt go away', 'describe-tab'],
    ['how is it still open', 'describe-tab'],
    // EN interrogative status queries -> describe-tab (no execute)
    ['wont it close', 'describe-tab'], ['didnt it close', 'describe-tab'],
    ['did you not close it', 'describe-tab'], ['did you close it or not', 'describe-tab'],
    ['did you close it yet', 'describe-tab'],
    // EN reiteration rebukes / violated-expectation -> close-tab
    ['told you to close it', 'close-tab'], ['asked you to close it', 'close-tab'],
    ['been asking you', 'close-tab'], ['supposed to be closed', 'close-tab'],
    ['should already be closed', 'close-tab'], ['close it whenever youre ready', 'close-tab'],
    // EN vocatives -> close-tab
    ['man close it', 'close-tab'], ['fellas close it', 'close-tab'], ['folks close it', 'close-tab'],
    // JA status queries / still-present -> describe-tab
    ['なんで開いてる', 'describe-tab'], ['なんでまだ開いてる', 'describe-tab'],
    ['いつ閉じるの', 'describe-tab'], ['開いたままだ', 'describe-tab'],
    ['おいまだか', 'describe-tab'], ['まだ残ってる', 'describe-tab'],
    ['まだいる', 'describe-tab'], ['まだある', 'describe-tab'],
    ['まだここにいる', 'describe-tab'], ['まだそこにいる', 'describe-tab'],
    // JA reiteration rebukes / urgency -> close-tab
    ['頼んだのに', 'close-tab'], ['言ったのに', 'close-tab'],
    ['ついさっき言った', 'close-tab'], ['さっき言った通り', 'close-tab'],
    ['閉じてよ早く', 'close-tab'], ['至急閉じろ', 'close-tab'],
    ['閉じろよお前', 'close-tab'], ['閉じろよぉ', 'close-tab'], ['閉じてよおい', 'close-tab'],
    // failed-expectation reports -> trouble
    ['nothing happened', 'trouble'], ['you still didnt close it', 'trouble'],
    ['閉じてたのに', 'trouble'], ['閉じてるはず', 'trouble'], ['閉じてるはずだ', 'trouble'],
    ['閉じてないの', 'trouble'], ['まだ閉じてない', null],
    // coexistence: established pins unchanged
    ['closed it yet', 'close-tab'], ['did i close it', 'describe-tab'],
    ['まだ開いてる', 'describe-tab'], ['まだ開いたまま', 'describe-tab'],
    ['開きっぱなしだ', 'describe-tab'], ['閉じたはずなのに', 'trouble'],
    ['閉じてないじゃん', 'trouble'], ['閉じてないよ', 'trouble'],
    ['早く閉じて', 'close-tab'], ['早く閉じろ', 'close-tab'],
    ['まだか', 'working-status'], ['早くしろ', 'speech-faster'],
    ['you still havent closed it', 'trouble'], ['you didnt close it', 'trouble'],
  ];
  for (const [p, k] of cases) test(`${JSON.stringify(p)} -> ${k}`, () => expect(key(vc, p)).toBe(k));
});
