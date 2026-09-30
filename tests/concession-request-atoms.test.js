'use strict';
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');
function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'}], getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}
describe('concession-request atoms (pass XCV)', () => {
  const vc = mk();
  const cases = [
    // phrase, expected command key
    // JA 受益 XXXIII — ちゃ/とく + conditional residue
    ['閉じちゃってくれ','close-tab'],
    ['閉じちゃってもらえますか','close-tab'],
    ['閉じちゃってくれますかね','close-tab'],
    ['閉じちゃうのが吉','close-tab'],
    ['閉じちゃうことにしよう','close-tab'],
    ['閉じちゃうのがいいかも','close-tab'],
    ['閉じちゃうしかないかも','close-tab'],
    ['閉じとくべきかな','close-tab'],
    ['閉じとくのがいい','close-tab'],
    ['閉じとくのもありだ','close-tab'],
    ['閉じとくしかない','close-tab'],
    ['閉じとくのが筋','close-tab'],
    ['閉じとけって','close-tab'],
    ['閉じとけってば','close-tab'],
    ['閉じとくといいよ','close-tab'],
    ['閉じとけばよかった','close-tab'],
    // JA dict residue XXIV — まま/うちに/たところ frames
    ['閉じるままにして','close-tab'],
    ['閉じるままにしよう','close-tab'],
    ['閉じるうちにして','close-tab'],
    ['閉じるうちにしましょう','close-tab'],
    ['閉じるといいところ','close-tab'],
    ['閉じるところだった','describe-tab'],
    ['閉じることにしていた','close-tab'],
    ['閉じることになっている','close-tab'],
    ['閉じることになってる','close-tab'],
    ['閉じることとなります','close-tab'],
    ['閉じることとなる','close-tab'],
    ['閉じることに決定しました','close-tab'],
    ['閉じることを決定した','close-tab'],
    ['閉じるのが定石と思う','close-tab'],
    ['閉じるのが筋と思う','close-tab'],
    ['閉じるのが本筋と思う','close-tab'],
    ['閉じるのが妥当と思う','close-tab'],
    ['閉じるのが適切と思う','close-tab'],
    ['閉じるのが正しいと思う','close-tab'],
    ['閉じるのが正解と思う','close-tab'],
    // EN frames XXIV — don't-suppose + be-ware frames
    ['i dont suppose you could close it','close-tab'],
    ['i dont suppose youd mind closing it','close-tab'],
    ['you dont suppose you could close it','close-tab'],
    ['dont suppose you could close it','close-tab'],
    ['i dont imagine youd mind closing it','close-tab'],
    ['i trust you can close it','close-tab'],
    ['i dare say you can close it','close-tab'],
    ['i take it youll close it','close-tab'],
    ['i take it you can close it','close-tab'],
    ['suppose you close it','close-tab'],
    ['supposing you closed it','close-tab'],
    ['mind closing it real quick','close-tab'],
    ['be so kind and close it','close-tab'],
    ['be a love and close it','close-tab'],
    ['be sweet and close it','close-tab'],
    ['close it, i would be obliged','close-tab'],
    ['close it, i would be most grateful','close-tab'],
    ['close it, as a courtesy to me','close-tab'],
    ['close it, as a personal favor','close-tab'],
    ['close it, out of the kindness of your heart','close-tab'],
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

