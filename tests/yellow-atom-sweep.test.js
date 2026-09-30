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

describe('yellow atom sweep — pass CCXXXVI', () => {
  test.each([
    'or else', 'or so help me',
    'i swear to god close it', 'i swear on my life close it',
    'pinkie swear close it', 'pinky promise close it',
    'scouts honor close it',
    'i implore thee close it', 'i pray thee close it',
    'good sir close it', 'kind sir close it',
    'o benevolent browser close it', 'sweet merciful browser close it',
    'dear lord close it', 'lord have mercy close it',
    'mother of god close it', 'holy mother close it',
    'for old times sake close it',
    'close it a thousand times over', 'a thousand times over',
    'close it until kingdom come', 'till kingdom come',
    'close it for all time', 'for all time',
    'close it until the end of days', 'until the end of days',
    'close it or else', 'cross my heart close it',
    'i give you my word close it', 'on my honor close it',
    'i beseech thee close it', 'prithee close it',
    'for the love of pete close it', 'for petes sake close it',
    'for cryin out loud close it', 'for pitys sake close it',
  ])('EN %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  test.each([
    'when pigs fly', 'when pigs fly close it',
    'over my dead body', 'over my dead body close it',
    'fat chance', 'when hell freezes over', 'not on your life',
    'like hell i will', 'in your dreams', 'dream on',
    'take a hike',
  ])('EN %s -> negate', (p) => {
    expect(key(mk(), p)).toBe('negate');
  });

  test.each([
    '閉じてなあかん', '閉じずにいられない',
    '閉じんとね', '閉じねばならん',
    '閉じねばならぬのだ', '閉じねばだめ', '閉じぬと',
    '閉じぬとあかん', '閉じぬけば', '閉じなくては',
    '閉じなきゃなんねえ', '閉じなきゃならん',
    '閉じせなあかん', '閉じせな', '閉じせなきゃ',
    '閉じせんと', '閉じせんとね', '閉じとかん',
    '閉じぇ', '閉じぇえ', '閉じばってん',
    '閉じとくばってん', '閉じてなんよね',
    '閉じてくれっぺ', '閉じてくれっぺよ', '閉じもらっぺ',
    '閉じてもらっぺ', '閉じだがや', '閉じてだがや',
    '閉じじだがや', '閉じがいな', '閉じてがいな',
    '閉じすっぞ', '閉じてすっぞ',
    '閉じてやんけ', '閉じじやんけ', '閉じがけ', '閉じてがけ',
    '閉じけぇ', '閉じとよ',
    '閉じでっせ', '閉じてでっせ', '閉じわいな',
    '閉じなのね', '閉じじおう',
    '閉じええんじゃ', '閉じてええんじゃ',
    '閉じておくが筋', '閉じてええさけ', '閉じてええさけえ',
    '閉じるねんな', '閉じじねんな', '閉じてっての',
    '閉じてってのよ', '閉じやつ',
  ])('JA %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });
});
