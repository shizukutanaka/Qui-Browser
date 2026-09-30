'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('favor-service atoms', () => {
  const vc = mk();
const cases = [
    // JA — てください 命令句残置
    ['閉じてくださいまし','close-tab'],
    ['閉じてくださいませませ','close-tab'],
    ['閉じてくださいますの','close-tab'],
    ['閉じてくださいますようにと','close-tab'],
    ['閉じてくださいなさい','close-tab'],
    ['閉じてくださいなね','close-tab'],
    // JA — てちゃいけない→実行(shouldn't NOT), てはいけない similar
    ['閉じないでちょうだい','negate'],
    ['閉じないでいただきたい','negate'],
    ['閉じなさいってば','close-tab'],
    ['閉じなさんな','close-tab'],
    ['閉じなされよ','close-tab'],
    ['閉じなされい','close-tab'],
    // JA — dict 効率/利得名詞尾
    ['閉じるのが効率的だ','close-tab'],
    ['閉じるほうが効率的','close-tab'],
    ['閉じるのが合理的だ','close-tab'],
    ['閉じるのが賢いやり方','close-tab'],
    ['閉じるのがスマートだ','close-tab'],
    ['閉じるのが得だ','close-tab'],
    // EN XLII — "kindness/goodness of your heart" inversion + "duty calls"
    ['be a dear and close it','close-tab'],
    ['be a dear and do close it','close-tab'],
    ['be an angel and do close it','close-tab'],
    ['do me the kindness of closing it','close-tab'],
    ['do me the honor of closing it','close-tab'],
    ['do me the service of closing it','close-tab'],
    ['do me the favor of closing it','close-tab'],
    ['do me the courtesy of closing it','close-tab'],
    ['oblige me with a closing','close-tab'],
    ['do oblige me with a closing','close-tab'],
    ['one small favor: close it','close-tab'],
    ['one tiny favor, close it','close-tab'],
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
