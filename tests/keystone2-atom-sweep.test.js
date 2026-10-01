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

describe('keystone atom sweep — pass CCXVIII', () => {
  it.each([
    // EN retroactive urgency ("needed it yesterday" idioms)
    'needed it closed yesterday', 'i needed it closed yesterday',
    'needed it gone five minutes ago', 'close it last week',
    'should have closed it an hour ago',
    // EN motion disposal + axe/boot
    'out you go', 'out it goes', 'away it goes', 'there it goes',
    'off it goes', 'make it go poof', 'be gone with it',
    'spare me the tab', 'give it the hook', 'give it the old heave-ho',
    // EN movie-threat frames
    'the easy way close it', 'we can do this the easy way',
    'easy way or the hard way', 'close it and no one gets hurt',
    'close it and nobody gets hurt', 'close it while you still can',
    'close it while theres still time', 'close it before i do it myself',
  ])('EN retro/motion/threat %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN finality + tactical
    '3 2 1 close it', 'three two one close it', 'at will close it',
    'close it full stop', 'close it periodt', 'close it no takebacks',
    'close it i mean it this time', 'close it for real this time',
    'close it not kidding', 'close it definitively',
    'last chance close it', 'im not asking im telling close it',
    // EN casual farewells II
    'its been real tab', 'its been fun tab', 'so long tab',
    'farewell tab', 'adieu tab', 'rip tab', 'rest in peace tab',
    'goodnight sweet tab', 'take a bow tab', 'bow out tab',
    'curtains for the tab', 'one less tab', 'minus one tab',
    'you served well tab', 'exit stage left tab',
    // EN speed idioms + misc
    'close it lickety-split', 'close it presto', 'close it toot sweet',
    'close it ahora', 'close it quick-like', 'make it fast',
    'help me out and close it', 'close it for pitys sake',
    'close it for heavens sake', 'id love it if youd close it',
  ])('EN final/farewell/speed %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA negate: keep-open declarations
    '閉じなくて済む', '閉じなくて済むよ', '閉じなくて済むわ',
    '閉じなくてええ', '閉じなくていーよ', '閉じる必要なし',
    '閉じる意味なし', '閉じる意味がない', '閉じる甲斐なし',
    '閉じるだけ無駄', '閉じるまでもない', '閉じるまでもなく',
    '閉じるほどでもない', '閉じるものではない',
  ])('JA keep-open %s -> negate', (p) => {
    expect(key(mk(), p)).toBe('negate');
  });

  it.each([
    // JA Kansai negative requests — these are requests, not refusals
    '閉じてもらえへん', '閉じてもらえへんか', '閉じてもらえまへんか',
    '閉じてくれへん', '閉じてくれへんか', '閉じてくれやへん',
    '閉じてくれまへん', '閉じてくれぬ', '閉じてくれぬか',
    '閉じてくれぬものか', '閉じてもらえぬか', '閉じてくれなくもない',
    '閉じてくれることはない',
  ])('JA neg-request %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA obligation + intent nouns
    '閉じるしかないんだから', '閉じるしかないよな',
    '閉じざるを得ない', '閉じざるをえない', '閉じざるを得ません',
    '閉じないわけにはいかない', '閉じなければならん',
    '閉じなければならんのだ', '閉じならんぞ',
    '閉じならんことはない', '閉じなけりゃダメ',
    '閉じるものだ', '閉じるものとする', '閉じるのみ',
    '閉じるよりなし', '閉じる気満々', '閉じる覚悟だ',
    '閉じる覚悟ができた', '閉じる腹はできてる',
    '閉じる決心がついた', '閉じる勢いだ', '閉じる構えだ',
    '閉じるぞと決めた', '閉じる気でいる',
    '閉じる時が来た', '閉じる時だ', '閉じる時機',
  ])('JA obligation/intent %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA dialect imperatives + volitional variants -> te-form
    '閉じてこ', '閉じてこい', '閉じてけ', '閉じてけりゃ', '閉じてきな',
    '閉じたれよ', '閉じたらん', '閉じたるで',
    '閉じてやん', '閉じてみせる', '閉じてみせるよ', '閉じてみせるぞ',
    '閉じてみせん', '閉じてみりゃ', '閉じてあげるで', '閉じてあげよう',
    '閉じてもらうから', '閉じてもらうで', '閉じてもらうとします',
    '閉じてもらうことにする', '閉じてくれるでしょ', '閉じてくれるよな',
    '閉じてくれるんでしょ', '閉じてくれるわよね',
    '閉じちゃうねん', '閉じちゃうねんで', '閉じちゃうで',
    '閉じしちゃうよ', '閉じしちゃうね', '閉じてもうわ', '閉じてもた',
    '閉じてもええでしょうか',
  ])('JA dialect/variant %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA completion-expectation -> describe-tab
    '閉じてるでしょ', '閉じてあるんでしょ', '閉じてあるはず', '閉じてあるんだよね',
    '閉じたるわ', '閉じたるぞ',  // established describe-tab pin (R239+ test)
  ])('JA confirm %s -> describe-tab', (p) => {
    expect(key(mk(), p)).toBe('describe-tab');
  });

  it.each([
    // established pins
    ['get it over with', 'stop-everything'],
    ['help a guy out close it', 'scoped-help'],
    ['poof', null],                       // ambiguous magic interjection
    ['閉じるのは無駄', null],             // parallels だめ ambiguity pin
    ['閉じるのが惜しい', null],           // reluctance, not refusal
    ['閉じるのがもったいない', null],
  ])('pin %s', (p, expected) => {
    expect(key(mk(), p)).toBe(expected);
  });
});
