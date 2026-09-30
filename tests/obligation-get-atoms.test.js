'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('obligation-get atoms (pass CV)', () => {
  const vc = mk();
  const cases = [
    // JA — ていただく/ていただきます residue (deep keigo)
    ['閉じていただきたい','close-tab'],
    ['閉じていただきたいのです','close-tab'],
    ['閉じていただきとうございます','close-tab'],
    ['閉じていただけたら','close-tab'],
    ['閉じていただけましたら','close-tab'],
    ['閉じていただきたいと思っております','close-tab'],
    ['閉じていただきたいと存じております','close-tab'],
    // JA — ておく dict-residue
    ['閉じておくのもありだ','close-tab'],
    ['閉じておくのがいいかも','close-tab'],
    ['閉じておくべきではないか','negate'],
    ['閉じておくことにするよ','close-tab'],
    ['閉じておきなよ','close-tab'],
    // JA — dict 確認/同意尾
    ['閉じるのでいいね','close-tab'],
    ['閉じるのでよいか','close-tab'],
    ['閉じるので構わないか','close-tab'],
    ['閉じるのが良いかと存じます','close-tab'],
    ['閉じるのが宜しいかと','close-tab'],
    ['閉じるのが筋かと','close-tab'],
    // EN XXXIV — passive voice "be/get + participle" reports
    ['it needs to get closed','close-tab'],
    ['it has to get closed','close-tab'],
    ['the tab should get closed','close-tab'],
    ['the tab ought to get closed','close-tab'],
    ['this needs to get shut','close-tab'],
    ['it could use a closing','close-tab'],
    ['the tab could do with a closing','close-tab'],
    ['a closure is required here','close-tab'],
    ['a closing is in order','close-tab'],
    ['closing is whats needed','close-tab'],
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
