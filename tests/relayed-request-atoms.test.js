'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('relayed-request & residue atoms (XCIII)', () => {
  const vc = mk();
  const cases = [
    // JA 受益 residue XXXI — more particles + いただき + 呉れる dialect
    ['閉じてくれんのかい','close-tab'],
    ['閉じてくれんかいな','close-tab'],
    ['閉じてくれとるんか','close-tab'],
    ['閉じてくれてもいいんだよ','close-tab'],
    ['閉じてくれって頼んだろう','close-tab'],
    ['閉じてくれといったはず','close-tab'],
    ['閉じてくれだってば','close-tab'],
    ['閉じてくれという話だ','close-tab'],
    ['閉じてもらうとするよ','close-tab'],
    ['閉じてもらうってことで','close-tab'],
    ['閉じてもらうってことか','close-tab'],
    ['閉じてもらうしかないな','close-tab'],
    ['閉じてもらうに決まってる','close-tab'],
    ['閉じてもらうのが筋だ','close-tab'],
    ['閉じてもらうのが定石','close-tab'],
    ['閉じてもらうよう頼む','close-tab'],
    ['閉じてもらうようお願いします','close-tab'],
    ['閉じていただくことになる','close-tab'],
    ['閉じていただくということで','close-tab'],
    ['閉じていただくよう頼む','close-tab'],
    ['閉じていただきたくお願い申し上げます','close-tab'],
    ['閉じていただきたく思います','close-tab'],
    ['閉じていただきたいのですが','close-tab'],
    ['閉じてもらってもいいんで','close-tab'],
    ['閉じてもらってもよろしいです','close-tab'],
    ['閉じてほしいなあと','close-tab'],
    ['閉じてほしいなんて','close-tab'],
    ['閉じてほしいってば','close-tab'],
    ['閉じてほしいって話','close-tab'],
    ['閉じてほしいところなんですが','close-tab'],
    // JA dict residue XXII — もの/わけ/ところ frames
    ['閉じるものかしら','close-tab'],
    ['閉じるものではある','close-tab'],
    ['閉じるものとなってます','close-tab'],
    ['閉じるわけですわ','close-tab'],
    ['閉じるわけなんです','close-tab'],
    ['閉じるわけよ','close-tab'],
    ['閉じるわけさあ','close-tab'],
    ['閉じるところですが','describe-tab'],
    ['閉じるところなんです','describe-tab'],
    ['閉じるしかないんで','close-tab'],
    ['閉じるしかないでしょう','close-tab'],
    ['閉じるしかないんだよ','close-tab'],
    ['閉じるぞって','close-tab'],
    ['閉じるぞってば','close-tab'],
    ['閉じるんだってさ','close-tab'],
    ['閉じるんだってよ','close-tab'],
    ['閉じるんですって','close-tab'],
    ['閉じるんですかね','close-tab'],
    // EN frames XXII
    ['i beseech you please close it','close-tab'],
    ['i hereby petition you to close it','close-tab'],
    ['i solemnly request that you close it','close-tab'],
    ['i implore you kindly close it','close-tab'],
    ['do me the courtesy of closing it','close-tab'],
    ['do me the favor of closing it','close-tab'],
    ['grant me the favor of closing it','close-tab'],
    ['extend me the courtesy of closing it','close-tab'],
    ['would you be an angel and close it','close-tab'],
    ['would you do the honors and close it','close-tab'],
    ['close it, i beg of you','close-tab'],
    ['close it, pretty please with sprinkles','close-tab'],
    ['close it, if it pleases you','close-tab'],
    ['close it, good sir','close-tab'],
    ['close it, kind soul','close-tab'],
    ['close it, you would make my day','close-tab'],
    ['close it, make me happy','close-tab'],
    // pins
    ['閉じるべきかな','help'],
    ['閉じるものかな','negate'],
    ['閉じてもらうもんか','negate'],
    ['閉じたはず','trouble'],
    ['閉じるっけ','describe-tab'],
    ['閉じなくていい','negate'],
  ];
  for (const [p, want] of cases) {
    it(`${p} → ${want}`, () => {
      vc.lastCommand = null;
      vc.processCommand(p, 0.9);
      const got = vc.lastCommand ? vc.lastCommand.key : 'null';
      expect(got).toBe(want);
    });
  }
});
