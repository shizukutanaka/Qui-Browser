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

describe('oath atom sweep — pass CCXXVI', () => {
  it.each([
    // EN speed / resignation / reason tails / reference prefixes
    'close it in a bit', 'close it super quick', 'close it lightning fast',
    'close it im done with it', 'close it im through with it',
    'close it im over it', 'close it im finished with it',
    'close it i dont need it', 'close it i no longer need it',
    'close it its useless', 'close it its pointless',
    'close it it serves no purpose', 'close it theres no point',
    'close it no point keeping it', 'close it why bother keeping it',
    'close it its eating ram', 'close it its slowing me down',
    'close it you heard me', 'close it you heard',
    'close it once more with feeling', 'close it step on it',
    'close it shake a leg', 'close it move it', 'close it go go go',
    'close it vamos', 'close it andale', 'close it dale',
    'close it lets go', 'close it whatever',
    'close it i dont care anymore', 'close it im done asking',
    'close it or dont bother', 'about that tab close it',
    'regarding the tab close it', 'as for the tab close it',
  ])('EN %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA stem imperatives III + negate-fix literal
    '閉じろお', '閉じろォ', '閉じんしゃれ', '閉じんされ',
    '閉じなすってよ', '閉じてやすな',
    // JA ru-form dialect declaratives
    '閉じるんだってばよ', '閉じるのさ', '閉じるのさね',
    '閉じるしか', '閉じるしかや', '閉じるがもんだ',
    '閉じるんだわさ', '閉じるのよさ', '閉じるにゃ', '閉じるど',
    '閉じるがね', '閉じるがや', '閉じるだがや', '閉じるみゃあ',
    '閉じるでかんわ', '閉じるわいや', '閉じるさけ',
    '閉じるさかい', '閉じるじゃん', '閉じるじゃんね',
    '閉じるじゃんけ', '閉じるばい', '閉じるたい', '閉じるけん',
    '閉じるっちゃ', '閉じるごたる', '閉じるんじゃけど',
    '閉じるじゃろ', '閉じるんよ', '閉じるのん', '閉じるだっぺ',
    '閉じるんだな', '閉じるなの', '閉じるにぇ', '閉じるさぁ',
    '閉じるさあ', '閉じるさー', '閉じるよぉ', '閉じるよお',
    // JA て-tail dialect pushes III
    '閉じてクレメンス', '閉じてくれめんす', '閉じてくんろ',
    '閉じてはんな', '閉じてみや', '閉じてけれ', '閉じてしぇ',
    '閉じてねん', '閉じてしょ', '閉じてしょー', '閉じてなんしょ',
    '閉じてやれよ', '閉じてくれやで', '閉じてくれやな',
    '閉じてくれなはれ', '閉じてくれまへんやろか',
    '閉じてくれまへんかね', '閉じてもらわんと',
    '閉じてもらわんと困る', '閉じてくれりゃあええ',
    '閉じてええんで', '閉じてええやん', '閉じてええわ',
    '閉じてええかも', '閉じておいてええ',
    '閉じといといて', '閉じときゃいいんだ',
  ])('JA %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });
});
