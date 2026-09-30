'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('pleasure-inclination atoms', () => {
  const vc = mk();
const cases = [
    // JA — てほしい 欲求残置
    ['閉じてほしいんですが','close-tab'],
    ['閉じてほしいと切に願う','close-tab'],
    ['閉じてほしいと強く望む','close-tab'],
    ['閉じてほしいと願い出ます','close-tab'],
    ['閉じてほしいばかりに','close-tab'],
    ['閉じてほしいところで','close-tab'],
    ['閉じてほしく思います','close-tab'],
    // JA — てちょうだい 俗残置
    ['閉じてちょうだいね','close-tab'],
    ['閉じてちょうだいよ','close-tab'],
    ['閉じてちょうだいな','close-tab'],
    ['閉じてちょうだいませ','close-tab'],
    ['閉じてちょうだいませんか','close-tab'],
    ['閉じてちょうだいなさい','close-tab'],
    // JA — dict 手配/段取尾
    ['閉じる段取りで','close-tab'],
    ['閉じる手はずで','close-tab'],
    ['閉じる手配を頼む','close-tab'],
    ['閉じる段取りをとる','close-tab'],
    ['閉じるという段取り','close-tab'],
    ['閉じるのが筋だと考えます','close-tab'],
    // EN XXXIX — "see fit/if you see fit" + inclination frames
    ['if you see fit, close it','close-tab'],
    ['as you see fit, close it','close-tab'],
    ['if you deem it appropriate, close it','close-tab'],
    ['if you deem it necessary, close it','close-tab'],
    ['should you feel so inclined, close it','close-tab'],
    ['if you are so inclined, close it','close-tab'],
    ['if you feel up to it, close it','close-tab'],
    ['if you are of a mind to, close it','close-tab'],
    ['if it pleases you, close it','close-tab'],
    ['at your pleasure, close it','close-tab'],
    ['at your convenience, close it','close-tab'],
    ['at your earliest convenience, close it','close-tab'],
    // pins
    ['閉じるべきかな','help'],
    ['閉じるものかな','negate'],
    ['閉じたはず','trouble'],
    ['閉じるっけ','describe-tab'],
    ['閉じなくていい','negate'],
    ['閉じるところです','describe-tab'],
  ];
  it.each(cases)('%s -> %s', (p, want) => {
    vc.lastCommand = null;
    vc.processCommand(p, 0.9);
    expect(vc.lastCommand ? vc.lastCommand.key : 'null').toBe(want);
  });
});
