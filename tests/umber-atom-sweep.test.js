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
    closeTab() {},
    pinTab() {},
    closeOtherTabs() {},
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
};

const key = (vc, p) => {
  vc.lastCommand = null;
  vc.processCommand(p, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
};

describe('umber atom sweep — pass CCXXXII', () => {
  it.each([
    // EN kill-verbs II + sweep/vanish/pack + cast-off
    'kill the tab for me', 'kill it for me', 'kill the tab would you',
    'kill it dead', 'the tab must die', 'the tab dies today',
    'the tab dies now', 'die tab die', 'bury the tab', 'bury it',
    'lay it to rest', 'put it in the ground', 'euthanize the tab',
    'euthanize it', 'put it out of its misery', 'out of its misery',
    'the tab shall be no more', 'it shall be no more',
    'commit tabicide', 'tabicide', 'murder the tab',
    'make the tab history', 'make it history',
    'give the tab the sack', 'give it the sack', 'give it the elbow',
    'give it the bullet',
    'sweep the tab', 'sweep it away', 'sweep it off',
    'clear the tab', 'clear it', 'clear that tab', 'clear it out',
    'wash it away', 'wash it out', 'bin that', 'bin it',
    'get that outta here', 'get this outta here', 'get it outta here',
    'vanish the tab', 'make the tab vanish', 'make it vanish',
    'tab vanish', 'tab disappear', 'make the tab disappear',
    'make it disappear', 'disappear the tab', 'disappear it',
    'pack it up', 'pack the tab up', 'pack the tab in',
    'fold the tab', 'fold it', 'fold it up', 'fold up the tab',
    'quit the tab', 'forsake the tab', 'abandon the tab',
    'abandon it', 'desert the tab', 'dump the tab', 'dump it',
    'toss the tab', 'toss it', 'toss it aside', 'cast it aside',
    'cast the tab aside', 'cast it away', 'cast the tab away',
    'cast it off', 'shed the tab', 'shed it', 'slough it off',
    'shake it off', 'shake the tab off',
    'closing it would be nice', 'would be nice to close it',
    'nice if you close it', 'itd be nice if you close it',
    'mind doing it', 'could i get you to close it',
    'can i get you to close it', 'how bout you do it',
  ])('EN %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA eval/dialect imperatives III
    '閉じるが吉', '閉じるが宜しい', '閉じるが上策', '閉じるが得策',
    '閉じるが賢い', '閉じてぬ', '閉じるすか', '閉じるすかい',
    '閉じるなりよ', '閉じるなりな', '閉じてかまへん',
    '閉じてかまへんよ', '閉じてもかまわへん',
    '閉じてほしゅう', '閉じてほしゅうござる',
    '閉じてほしゅうございます', '閉じやっちゃ', '閉じやっちゃな',
    '閉じてはどうです', '閉じてはどうだ', '閉じてはいかがだ',
    '閉じといたって', '閉じといたってよ', '閉じとけって',
    '閉じときなはれ', '閉じてなはれ',
    '閉じてはったら', '閉じてはって', '閉じてはった',
    '閉じてちゃんと', '閉じてちゃん', 'ちゃんと閉じて',
    '閉じてなのよ', '閉じてなの', '閉じてんだろうが',
    '閉じてんだから', '閉じてって言うた', '閉じてって言うてん',
    '閉じてって言うとる', '閉じてもらうさ', '閉じてもらうわ',
    '閉じてもらうぞ', '閉じてけれ', '閉じてければ',
    '閉じろおい', '閉じろい', '閉じろやあ',
    '閉じっつ', '閉じっつう', '閉じべ', '閉じるべ',
    '閉じべよ', '閉じべな', '閉じべっぺ', '閉じっぺ',
    '閉じっちゃ', '閉じっちゃな', '閉じっちゃよ',
    '閉じなん', '閉じなんよ', '閉じてええん', '閉じてええんや',
    '閉じてええけど', '閉じてほちぃ', '閉じてみな',
    '閉じてもう', '閉じてぺ', '閉じてなんせ', '閉じてなんせよ',
  ])('JA %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });
});
