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

describe('walnut atom sweep — pass CCXXXIV', () => {
  it.each([
    // EN never-happened + exile/expel + throw II + power
    'like it never happened', 'make it like it never happened',
    'as if it never was', 'screw the tab',
    'burn the tab', 'torch the tab',
    'torch it', 'expel the tab', 'expel it',
    'banish the tab', 'banish it', 'exile the tab', 'exile it',
    'oust the tab', 'oust it', 'evict the tab', 'evict it',
    'purge it', 'cull the tab', 'cull it',
    'prune the tab', 'prune it', 'trim the tabs',
    'break the tab', 'break it', 'smash the tab',
    'guillotine the tab', 'defenestrate the tab', 'defenestrate it',
    'yeet that',
    'hurl the tab', 'hurl it', 'fling the tab', 'fling it',
    'heave the tab', 'heave it', 'heave it out',
    'chuck it out the window', 'out the window',
    'punt the tab', 'punt it',
    'nix the tab', 'scrap the tab', 'scrap that',
    'junk the tab', 'junk that',
    'trash the tab', 'trash that',
    'deep six the tab', 'deep six that',
    'put the tab out', 'put it out', 'put out the tab',
    'turn the tab off', 'turn off the tab', 'switch the tab off',
    'power the tab down', 'power it down', 'power down the tab',
    'finish it', 'end it',
    'on the qt', 'on the down low', 'on the dl',
  ])('EN %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA dialect residue V + insistence III
    '閉じで', '閉じでよ', '閉じでば', '閉じてでば',
    '閉じりゃー', '閉じんぜ', '閉じんせん', '閉じんけい',
    '閉じるしね', '閉じるしな',
    '閉じてくれるんちゃ', '閉じてくれるんちゃう',
    '閉じてくれるんか', '閉じりょう', '閉じりょうか',
    '閉じてしろ', '閉じしろ', '閉じてよわ', '閉じてよわよ',
    '閉じよと', '閉じよな', '閉じてくれやんか', '閉じてやんか',
    '閉じでみい', '閉じっけ', '閉じてっけ', '閉じっすよ',
    '閉じりゃーええ', '閉じたらええんちゃう', '閉じちゃいなよ',
    '閉じておくべきだった',
  ])('JA %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA state/progressive reports -> describe-tab
    '閉じておるんか', '閉じとるんちゃう', '閉じておったら',
    '閉じておった', '閉じてあるわ',
    '閉じてあるんだ', '閉じてたけど',
    '閉じていた', '閉じてんとこや',
  ])('JA %s -> describe-tab', (p) => {
    expect(key(mk(), p)).toBe('describe-tab');
  });

  it.each([
    // JA state+contrast complaints -> trouble
    '閉じてねんのに', '閉じてあるのに', '閉じてあるけど',
  ])('JA %s -> trouble', (p) => {
    expect(key(mk(), p)).toBe('trouble');
  });
});
