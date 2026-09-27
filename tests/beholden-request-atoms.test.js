'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('beholden & report atoms (XCIV)', () => {
  const vc = mk();
  const cases = [
    // JA 受益 XXXII — residual compound tails
    ['閉じてくれと頼む','close-tab'],
    ['閉じてくれと言ってる','close-tab'],
    ['閉じてくれとお願いしてる','close-tab'],
    ['閉じてくれたらいいね','close-tab'],
    ['閉じてくれたらありがたいな','close-tab'],
    ['閉じてくれたらそれでいい','close-tab'],
    ['閉じてもらおうかい','close-tab'],
    ['閉じてもらおうかねえ','close-tab'],
    ['閉じてもらおうということで','close-tab'],
    ['閉じてもらう方向で行こう','close-tab'],
    ['閉じてもらう方向で','close-tab'],
    ['閉じてもらうことになった','close-tab'],
    ['閉じてもらうことにしよう','close-tab'],
    ['閉じてもらわないと困る','close-tab'],
    ['閉じてもらわなきゃ困る','close-tab'],
    ['閉じていただく方向で','close-tab'],
    ['閉じていただくことになります','close-tab'],
    ['閉じていただかないと','close-tab'],
    ['閉じていただけないと困ります','close-tab'],
    ['閉じてほしいという話だ','close-tab'],
    ['閉じてほしいというわけだ','close-tab'],
    ['閉じてほしいくらいだ','close-tab'],
    ['閉じてほしいほどだ','close-tab'],
    // JA dict residue XXIII — quotative + ために/べく frames
    ['閉じると言いました','close-tab'],
    ['閉じると頼みました','close-tab'],
    ['閉じるとお願いしました','close-tab'],
    ['閉じるよう言われた','close-tab'],
    ['閉じるよう頼まれた','close-tab'],
    ['閉じるためです','close-tab'],
    ['閉じるために','close-tab'],
    ['閉じるべくお願いする','close-tab'],
    ['閉じるが順序だ','close-tab'],
    ['閉じるが定石だ','close-tab'],
    ['閉じるが本筋だ','close-tab'],
    ['閉じるがベストだ','close-tab'],
    ['閉じるのがベスト','close-tab'],
    ['閉じるのが道理だ','close-tab'],
    ['閉じるのが無難では','close-tab'],
    ['閉じるのが望ましいです','close-tab'],
    ['閉じるのが好ましいです','close-tab'],
    ['閉じることが望ましいです','close-tab'],
    ['閉じることが肝要です','close-tab'],
    ['閉じることが必要です','close-tab'],
    ['閉じることが前提だ','close-tab'],
    // EN frames XXIII
    ['i cordially invite you to close it','close-tab'],
    ['i solicit you to close it','close-tab'],
    ['i solicit your closing of it','close-tab'],
    ['i would be beholden if you closed it','close-tab'],
    ['i would be indebted if you closed it','close-tab'],
    ['i should be grateful if you closed it','close-tab'],
    ['i should be obliged if you closed it','close-tab'],
    ['would it inconvenience you to close it','close-tab'],
    ['would it trouble you to close it','close-tab'],
    ['close it, i would be ever so grateful','close-tab'],
    ['close it, you would do me a kindness','close-tab'],
    ['close it, much obliged if you do','close-tab'],
    ['close it, forever grateful','close-tab'],
    ['close it, if it be so','close-tab'],
    ['close it, henceforth','close-tab'],
    ['close it posthaste, if you please','close-tab'],
    // pins
    ['閉じるべきかな','help'],
    ['閉じるものかな','negate'],
    ['閉じたはず','trouble'],
    ['閉じるっけ','describe-tab'],
    ['閉じなくていい','negate'],
    ['閉じるところです','describe-tab'],
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
