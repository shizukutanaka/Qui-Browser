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

describe('springer atom sweep — pass CCXIX', () => {
  it.each([
    // EN could-do-without + honors + nth-time
    'i could do without it', 'could do without it',
    'we could do without it', 'i can do without it',
    'do the honors close it', 'close it on the count of three',
    'on the count of three close it',
    'close it for the umpteenth time', 'close it for the millionth time',
    'for the nth time close it', 'ive asked a thousand times close it',
    'ive asked a million times',
    // EN vocatives II
    'close it sport', 'close it amigo', 'close it partner',
    'close it compadre', 'close it sunshine', 'close it sweetheart',
    'close it sweetie', 'close it buttercup', 'close it pumpkin',
    'close it princess', 'close it sweet cheeks', 'close it homes',
    'close it homie', 'close it holmes', 'close it big fella',
    'close it little buddy', 'close it skipper', 'close it matey',
    'close it guv', 'close it guvnor', 'close it gaffer',
    'close it sir', 'close it maam', 'close it madam', 'buddy close it',
    // EN tags/softeners
    'close it mkay', 'mkay close it', 'close it aight', 'aight close it',
    'close it yeh', 'close it yup', 'ok fine close it', 'close it sure',
  ])('EN without/honors/vocative %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // EN exasperation prefixes
    'sigh close it', 'smh close it', 'fml close it',
    'oh my god close it', 'sweet jesus close it', 'good lord close it',
    'lordy close it', 'good grief close it',
    'goodness gracious close it', 'great scott close it',
    'great googly moogly close it', 'heavens to betsy close it',
    'holy moly close it', 'holy cow close it', 'holy smokes close it',
    'holy mackerel close it', 'golly close it', 'gee whiz close it',
    'gosh darn close it', 'dagnabbit close it', 'consarn it close it',
    'dadgum close it', 'doggone close it', 'confound it close it',
    'blast it close it', 'drat close it', 'fiddlesticks close it',
    'blimey close it', 'cor blimey close it', 'crikey close it',
    'streuth close it', 'bloody hell close it', 'bloody close it',
    'flipping close it', 'flippin close it', 'freaking close it',
    'fricking close it', 'friggin close it', 'frigging close it',
    'sodding close it', 'chuffing close it', 'ruddy close it',
    'just flipping close it', 'close it for christs sake',
    'close it for gods sake', 'close it for the love of all things holy',
    // EN courtesy frames
    'close it with all due respect', 'with all due respect close it',
    'respectfully close it', 'no disrespect but close it',
    'pardon my french but close it', 'close it if youd be kind enough',
    'close it if youd care to', 'close it when youre ready',
    'close it in due course', 'whenever close it',
    'close it whenever suits', 'close it at your earliest leisure',
    'close it i beg you',
  ])('EN exasperation/courtesy %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA てくれれば+評価
    '閉じてくれれば助かる', '閉じてくれれば有難い', '閉じてくれれば万々歳',
    '閉じてくれれば言うことなし', '閉じてくれれば文句なし',
    '閉じてくれれば申し分ない', '閉じてくれれば十分',
    '閉じてくれればそれで十分', '閉じてくれればそれで',
    '閉じてくれれば良し', '閉じてくれればOK', '閉じてくれればよし',
    '閉じてもらうのが当然',
    // JA くれない-系間接依頼 (negate preemption fixes)
    '閉じてくれないかと思って', '閉じてくれないかと思いまして',
    '閉じてくれないかと', '閉じてくれないものかと',
    '閉じてくれないものでしょうか', '閉じてくれないものかな',
    '閉じてくれないもんで', '閉じてくれないもんでね',
    '閉じてくれないものかね', '閉じてはくれぬ',
    '閉じてはくれないものか', '閉じてはもらえないか',
    '閉じてはもらえぬか', '閉じてはくれないかしら',
  ])('JA kureba/kurenai %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA くださいます+終助詞 IV + 方言残置
    '閉じてくださいますな', '閉じてくださいますぞ', '閉じてくださいますんで',
    '閉じてくださいますよね', '閉じてくださいますから',
    '閉じてくださいますなあ', '閉じてくださいますわ',
    '閉じてくださいますわよ', '閉じてくださいますわね',
    '閉じてくださいますかのう', '閉じてくださいますかの',
    '閉じてくださいますかぞ', '閉じてくださいますかい',
    '閉じてくださいますかいな', '閉じてくださいますこと',
    '閉じてくださいますのね', '閉じてくださいますもの',
    '閉じてなんし', '閉じてなんせ', '閉じてたまえや', '閉じてたもれぞ',
  ])('JA masu-IV/dialect %s -> close-tab', (p) => {
    expect(key(mk(), p)).toBe('close-tab');
  });

  it.each([
    // JA reproach reports -> trouble
    '閉じてくれたのに', '閉じてくれるはずだった',
    '閉じてくれるはずじゃなかった', '閉じてくれなかったのね',
    '閉じてくれてない', '閉じてくれてません', '閉じてくれてないんだ',
    '閉じてくれないじゃん',
  ])('JA reproach %s -> trouble', (p) => {
    expect(key(mk(), p)).toBe('trouble');
  });

  it.each([
    ['閉じてくれないの', null],  // ambiguous: reproach vs request
  ])('pin %s', (p, expected) => {
    expect(key(mk(), p)).toBe(expected);
  });
});
