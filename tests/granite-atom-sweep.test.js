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

describe('granite atom sweep — pass CCXXXVIII', () => {
  test.each([
    'dropkick it', 'dropkick the tab', 'torpedo it', 'torpedo the tab',
    'harpoon it', 'harpoon the tab', 'sink it', 'sink the tab',
    'run it aground', 'decommission it', 'decommission the tab',
    'sunset it', 'sunset the tab', 'deprecate it', 'deprecate the tab',
    'archive it', 'archive the tab', 'shelve it', 'shelve the tab',
    'box it up', 'bag it', 'bag the tab',
    'incinerate it', 'cremate it', 'cremate the tab',
    'entomb it', 'embalm it',
    'ban it', 'outlaw it', 'veto it', 'veto the tab',
    'curse it', 'curse the tab', 'exorcise it', 'hex it',
    'doom it', 'condemn it',
    'elvis has left the building', 'execute order 66',
    'ashes to ashes', 'dust to dust',
    'skedaddle it', 'vamoose it',
    'cut it loose', 'cut it adrift', 'set it adrift',
    'drown it', 'drown the tab', 'backspace it', 'backspace the tab',
    'gas it', 'electrocute it', 'fry it', 'fry the tab',
    'char it', 'roast it', 'bump it off', 'bump the tab off',
    'kick it to the curb', 'kick it to the kerb',
    'throw it to the curb', 'throw it to the wolves',
    'feed it to the wolves',
    'make it gone', 'do it gone', 'croak it', 'shovel it',
    'cement shoes', 'put it in cement shoes', 'encase it in concrete',
    'take it out back', 'take it out back and shoot it',
    'behind the shed with it', 'old yeller',
    'put it out of our misery', 'rid myself of it',
    'cleanse it', 'scrub the tab',
    'vaporize it', 'atomize it', 'disintegrate it',
    'melt it down', 'dissolve it',
    'shred it', 'shred the tab', 'pulp it', 'crunch it',
    'crush the tab', 'pulverize it', 'squash it',
    'splat it', 'pancake it', 'steamroll it', 'flatten it',
    'level it', 'bulldoze it', 'wreck the tab',
    'shoot the tab', 'gun it down', 'run it through',
    'skewer it', 'impale it', 'machete it', 'lance it',
    'push it off the cliff',
    '閉じまくり', '閉じろっつってんだ', '閉じろっつってる',
    '閉じろっつってんだよ', '閉じろっちゅうに',
    '閉じとけっち', '閉じとくげな', '閉じとくっちゃ', '閉じとくったら',
    '閉じといちゃ', '閉じといてはん',
    '閉じてもらうこった', '閉じてもらうが', '閉じよろしい',
    '閉じましょね', '閉じちゃいましょ',
    '閉じますよー', '閉じますん', '閉じますばい', '閉じますけん',
    '閉じたまえや', '閉じのだ', '閉じなさーい',
    '閉じなあ', '閉じねえ', '閉じるってんだ',
    '閉じるっちゅう', '閉じるもんや', '閉じるもんだい',
    '閉じるだ', '閉じるやで', '閉じることよ', '閉じるんさ',
    '閉じるっぺ',
  ])('%s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  test.each([
    '閉じてないじゃん', '閉じようがない', '閉じようがないねん',
    '閉じてこない',
    '閉じてくれへんかった', '閉じてくれんかった',
    '閉じられへんねん', '閉じられへんの', '閉じれまへん', '閉じれへんねん',
    '閉じてくれへんねん',
  ])('JA %s -> trouble', (p) => {
    expect(key(mk(), p)).toBe('trouble');
  });

  test.each([
    '閉じんでな', '閉じんでおこ', '閉じんでや', '閉じんでよ',
    '閉じんなー', '閉じんなって', '閉じんなっちゃ', '閉じんとこや',
    '閉じせんどこ', '閉じせんどいと', '閉じまんどこ',
    '閉じまいとく', '閉じまいとこ',
  ])('JA %s -> negate', (p) => {
    expect(key(mk(), p)).toBe('negate');
  });
});
