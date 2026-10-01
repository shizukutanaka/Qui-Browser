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

describe('violet atom sweep — pass CCXXXIII', () => {
  it.each([
    // EN demise-declaratives + speed/relief + chuck II
    'on the double', 'close it on the double', 'at the double',
    'in double time', 'the tab has served its time',
    'its time has passed', 'the tab is past its prime',
    'the tab is a goner', 'its a goner',
    'can the tab', 'can it already',
    'thats a wrap for the tab', 'send the tab packing',
    'the tab is history', 'chuck the tab', 'chuck it',
    'chuck it away', 'chuck it out', 'chuck that',
    'flick the tab off', 'flick it off',
    'nuke the tab', 'zap the tab',
    'wipe the tab out', 'wipe it out',
    'erase the tab', 'delete the tab',
    'demolish the tab', 'raze the tab', 'raze it',
    'one less tab', 'one less',
    'lose it for me', 'lose the tab',
    'make it go poof',
    'the tab is over', 'the tab is through', 'the tab is toast',
    'the tab is kaput', 'its kaput',
    'the tab is finito', 'finito', 'the tab is finished',
    'the tab is no more', 'the tab is dead',
    'the tab has kicked the bucket', 'kicked the bucket',
    'the tab bought the farm', 'bought the farm',
    'the tab is six feet under',
    'spare me the tab', 'spare me it',
    'relieve me of the tab', 'relieve me of it',
    'id like the tab gone', 'id like it gone', 'id like it closed',
    'i like it closed',
    'end of the road', 'the end of the road',
    'the tab had a good run', 'its been a good run',
    'the tab is going down', 'down it goes', 'down the tab goes',
    'off goes the tab', 'off it goes',
    'time to die', 'the tabs time to die', 'its closing oclock',
    'its tab oclock',
  ])('EN %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA dialect residue IV
    '閉じてこんかい', '閉じてんさかい', '閉じゃい', '閉じゃあ',
    '閉じるど', '閉じるどお', '閉じるかい', '閉じるぜい',
    '閉じろら', '閉じろらあ', '閉じてなんさい', '閉じてなんなさい',
    '閉じてこら', '閉じさせといて', '閉じさせておいて',
    '閉じとけば', '閉じとけばええ', '閉じとこい',
    '閉じとかな', '閉じとかなきゃ', '閉じとかないと',
    '閉じとけ', '閉じといてはどうだ', '閉じといてどう',
    '閉じるほうだ', '閉じるほうがいい', '閉じるほうがいいけどな',
    '閉じるっぺす', '閉じるっぺすよ', '閉じるずら',
    '閉じるずらね', '閉じてねね', '閉じてねえ',
    '閉じてなも', '閉じてなもり', '閉じてぇ', '閉じてぇや',
    '閉じておくが宜しい', '閉じておくが吉',
    '閉じるようになってる', '閉じるようになった',
    '閉じてみな',
  ])('JA %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA progressive reports -> describe-tab
    '閉じておるから', '閉じておるんで', '閉じておるぜ',
    '閉じております', '閉じてぃ',
    '閉じっからな', '閉じっから', '閉じっからね', '閉じっからよ',
  ])('JA %s -> describe-tab', (p) => {
    expect(key(mk(), p)).toBe('describe-tab');
  });
});
