'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('volitional-report atoms (pass XCVII)', () => {
  const vc = mk();
  const cases = [
    // JA — dict XXVI: べきく+conditional / 閉じて+here imperatives
    ['閉じるべきかと思われます','close-tab'],
    ['閉じるべきかと存じます','close-tab'],
    ['閉じるべきではないかと思う','negate'],
    ['閉じるべきかと思いますよ','close-tab'],
    ['閉じるべきなので','close-tab'],
    ['閉じるべきですので','close-tab'],
    // JA — して residue (te+て alternate stem 'して')
    ['閉じしてくれ','close-tab'],
    ['閉じしてもらって','close-tab'],
    ['閉じしといて','close-tab'],
    ['閉じしとこう','close-tab'],
    // JA — masu+conjunctive & まする forms
    ['閉じますれば','close-tab'],
    ['閉じますれば幸い','close-tab'],
    ['閉じまする','close-tab'],
    ['閉じませう','close-tab'],
    ['閉じませうか','close-tab'],
    ['閉じますわよ','close-tab'],
    ['閉じますこと','close-tab'],
    ['閉じますのよ','close-tab'],
    ['閉じますればよろしい','close-tab'],
    // JA — 意向形+compounds
    ['閉じようと思うので','close-tab'],
    ['閉じようとしている','close-tab'],
    ['閉じようと思っている','close-tab'],
    ['閉じようとする','close-tab'],
    ['閉じようかと思っています','close-tab'],
    ['閉じようと思いますので','close-tab'],
    ['閉じようかと考えています','close-tab'],
    ['閉じようと思っております','close-tab'],
    ['閉じようとします','close-tab'],
    ['閉じようとしますので','close-tab'],
    // EN XXVI — informal/hip frames
    ['wanna close it','close-tab'],
    ['whatcha gonna do is close it','close-tab'],
    ['gonna close it','close-tab'],
    ['gotta close it','close-tab'],
    ['hafta close it','close-tab'],
    ['lemme get you to close it','close-tab'],
    ['lemme have you close it','close-tab'],
    ['close it, would ya be a pal','close-tab'],
    ['close it, if ya dont mind','close-tab'],
    ['close it, if you would be so kind','close-tab'],
    ['close it, whenever you get a moment','close-tab'],
    ['close it, whenever you get a sec','close-tab'],
    ['close it, at your convenience','close-tab'],
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
