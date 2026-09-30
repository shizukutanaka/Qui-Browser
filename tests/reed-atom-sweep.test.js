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

describe('reed atom sweep — pass CCXXIX', () => {
  it.each([
    // EN need/causative/get-closed + favor + do-away + finish-off
    'it needs closing', 'needs closing', 'needs shutting',
    'needs closing up', 'that needs closed', 'it wants closing',
    'it could use closing', 'it could do with closing',
    'have it closed', 'have it shut', 'have it gone',
    'get it closed', 'get it shut', 'get it gone',
    'get that closed', 'got it closed',
    'give it the axe', 'give it the chop', 'give it the boot',
    'give it the flick', 'the tab needs a close', 'needs a close',
    'do the needful', 'kindly do the needful',
    'oblige me by closing it',
    'if you know whats good for you', 'for your own sake',
    'pretty please with sugar', 'pretty please with a cherry',
    'with a cherry on top', 'cherries on top', 'sugar and a cherry',
    'tab outro', 'tab curtain', 'swan song', 'tab swan song',
    'wrap that tab', 'wrap this tab up', 'button the tab',
    'button this up', 'tie that tab off', 'tie it off',
    'do the tab in', 'do it in', 'do away with the tab',
    'do away with it', 'finish the tab off', 'finish it off',
    'finish the tab', 'polish the tab off', 'polish it off',
    'take the tab down', 'take the tab out',
    'close it all the way', 'close it up tight',
    'close it down for good', 'close it up for good',
    'status closed', 'set tab to closed', 'tab status closed',
  ])('EN %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA hostile/old imperatives + causative + たら評価 + がいい
    '閉じやがれ', '閉じやがって', '閉じやがった',
    '閉じ申せ', '閉じ申せぞ', '閉じろこそすれ', '閉じこそすれ',
    '閉じたらいかが', '閉じたらどうか', '閉じたらどうでしょう',
    '閉じたらよかろう', '閉じたらよかろ', '閉じたらええやろ',
    '閉じたらええやろか',
    '閉じるがいいぞ', '閉じるがいいよ', '閉じるがいいわ',
    '閉じるがいいと思う', '閉じることを許せ',
    '閉じさせろ', '閉じさせて', '閉じされ', '閉じるたまえよ',
    // JA ちまう/ておこ pushes
    '閉じちまえ', '閉じちまったら', '閉じちまいたい',
    '閉じちまうぞ', '閉じちまうよ', '閉じちまうわ',
    '閉じておこ', '閉じとこうぜ',
  ])('JA %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA negate literals (not-closing declarations)
    '閉じないまま', '閉じさせんな', '閉じんでおく',
  ])('JA %s -> negate', (p) => {
    expect(key(mk(), p)).toBe('negate');
  });
});
