import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';

const mk = () => {
  const vc = new VoiceCommands({ enabled: true });
  const tm = {
    activeTabId: 't1',
    tabs: [
      { id: 't1', currentTitle: 'A', currentUrl: 'https://a' },
      { id: 't2', currentTitle: 'B', currentUrl: 'https://b' },
      { id: 't3', currentTitle: 'C', currentUrl: 'https://c' },
    ],
    getActiveTab() { return this.tabs.find((t) => t.id === this.activeTabId); },
    closeAllTabs() { return 3; },
    closeTab() {}, pinTab() {}, closeOtherTabs() {},
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
};
const key = (vc, p) => { vc.processCommand(p, 0.9); return vc.lastCommand ? vc.lastCommand.key : null; };

describe('obsidian atom sweep — pass CCXXXIX', () => {
  test.each([
    'pull the pin', 'let it bleed', 'let it rot',
    'board it up', 'board the tab up', 'brick it up',
    'shutter it', 'shutter the tab', 'curtains for it',
    'drop the hammer', 'bring the hammer down',
    'swat it', 'swat the tab',
    'flush the tab', 'flush it away', 'flush it down',
    'down the drain', 'send it down the drain', 'down the toilet',
    'bury at sea', 'burial at sea',
    'cast it into the void', 'into the void with it', 'nullify it',
    'neutralize it', 'neutralize the tab',
    'knock it down', 'knock the tab down',
    'sweep the tab away', 'brush it aside', 'brush it away',
    'wipe it off the map', 'wipe it off the face of the earth',
    'mince it', 'dice it', 'grind it up', 'grate it',
    'mulch it', 'compost it', 'recycle it', 'recycle the tab',
    'round file it', 'file thirteen', 'file 13', 'circular file',
    'dumpster it', 'concrete boots',
    'hang the tab', 'drawn and quartered',
    'garrote it', 'strangle it', 'choke it', 'choke it off',
    'suffocate it', 'smother it', 'asphyxiate it', 'stifle it',
    'amputate it', 'decapitate it', 'behead it', 'behead the tab',
    'disembowel it', 'flay it', 'skin it', 'skin the tab',
    'scalp it', 'eviscerate it',
    'melt it', 'liquefy it', 'evaporate it', 'evaporate the tab',
    'eradicate it', 'extirpate it', 'uproot it', 'uproot the tab',
    'root it out', 'weed it out', 'weed the tab out',
    'clip the tab', 'crop it', 'pare it', 'shave the tab',
    'mow it down', 'mow the tab down', 'scythe it',
    'reap it', 'reap the tab', 'harvest it', 'thin it out',
    'slaughter it', 'slaughter the tab', 'butcher it', 'butcher the tab',
    'massacre it', 'euthanise it', 'put it down humanely',
    'send it to a farm upstate', 'farm upstate',
    'rainbow bridge', 'send it to valhalla', 'davy jones locker',
    'feed it to the sharks', 'feed it to the fishes',
    'feed it to the lions', 'to the lions', 'chum it', 'shark bait',
    'take it for a swim', 'give it a swim',
    'catapult it', 'catapult the tab', 'trebuchet it',
    'yeet it into the sun', 'into the sun', 'send it to the sun',
    'irradiate it', 'microwave it', 'microwave the tab',
    'pressure cook it', 'tenderize it',
    'pound the tab', 'pummel it', 'bludgeon it',
    'club it', 'club the tab', 'bonk it',
    'smack it', 'smack the tab', 'slap it silly',
    'spank it', 'spank the tab', 'paddle it',
    'mercy kill it', 'mercy killing', 'coup de grace', 'coup de grace it',
    'finishing blow', 'final blow', 'kill shot', 'kill stroke',
    'death blow', 'death knell',
    'nail in the coffin', 'final nail', 'last nail in the coffin',
    'coffin nail', 'drive a stake through it', 'stake through the heart',
    'silver bullet it', 'wooden stake it',
    'play taps for it', 'viking funeral', 'viking sendoff', 'sky burial',
    '閉じるっつってんの', '閉じとくや', '閉じとこかい',
    '閉じちまうんだ', '閉じちまうべ',
    '閉じきれ', '閉じきれよ', '閉じきってよ',
    '閉じきっちゃえ', '閉じきっちまえ',
    '閉じこい', '閉じこいや', '閉じこや',
    '閉じろこら', '閉じろおら', '閉じろこのやろう',
    '閉じろってことだ', '閉じろってことです', '閉じろということだ',
    '閉じるということだ', '閉じるという話だ',
    '閉じると決まった', '閉じると決まりました',
    '閉じるにした', '閉じるにしたよ',
    '閉じるに決定', '閉じるに決定した', '閉じると決定',
    '閉じることに決定', '閉じると採決', '閉じると決議',
    '閉じると議決', '閉じると可決', '閉じるが可決', '閉じることが可決',
    '閉じる命令', '閉じる指令', '閉じる指示', '閉じる布告', '閉じる宣言',
    '閉じる決意', '閉じる覚悟', '閉じる判決', '閉じる裁定', '閉じる見解',
    '閉じる所存', '閉じる意向', '閉じる意志', '閉じる意思',
    '閉じる腹', '閉じる心', '閉じる気しかない',
    '閉じるしかかたん', '閉じるしか勝たん', '閉じるしか勝たんのよ',
    '閉じる一択や', '閉じる一択なんだが', '閉じる一択なんよ',
    '閉じるが無難や', '閉じるがセオリー', '閉じるが筋',
    '閉じるが常識', '閉じるが仕様', '閉じるが仕様だ', '閉じるが仕様です',
  ])('%s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  test.each([
    '閉じてもうた', '閉じてもたわ', '閉じてもうたわ',
    '閉じちゃったー', '閉じちまったよ',
    '閉じまった', '閉じきった', '閉じきったよ',
    '閉じたで', '閉じたわい', '閉じたばい', '閉じたっちゃ',
    '閉じてるやん', '閉じてるやんけ',
    '閉じてるんだから', '閉じてあるんだから',
    '閉じてあるで', '閉じてあるぞ', '閉じてあるわい',
    '閉じてあるけん', '閉じてあるがな', '閉じてあるんよ',
    '閉じてあるんですが', '閉じてあるんだけど',
    '閉じとるがな', '閉じとるけど', '閉じとるけん',
    '閉じとるんよ', '閉じとるんだけど', '閉じとるばい', '閉じとるわい',
  ])('JA %s -> describe-tab', (p) => {
    expect(key(mk(), p)).toBe('describe-tab');
  });
});
