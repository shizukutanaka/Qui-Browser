const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({
    getActiveTab: () => ({ id: 1 }),
    closeTab: () => {},
    tabs: () => [],
  });
  return vc;
}
const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

const closeTab = [
  // yard/garage sale wrap
  'yard sale done', 'garage sale done', 'yard sale over',
  'sold everything off', 'everything sold yard',
  'unsold donated', 'donated the leftovers',
  'leftovers hauled', 'cash box emptied',
  'made a killing yard', 'haggled the last',
  'last bargain sold', 'tables cleared sale',
  'lawn cleared sale', 'signs taken down sale',
  // flea market
  'flea market done', 'flea market packed',
  'booth closed market', 'stall packed up',
  'market day done', 'sold out my table',
  'early birds gone', 'last customer left sale',
  'prices slashed last', 'everything must go went',
  'free box emptied', 'curb picked clean',
  'driveway cleared sale',
  // stand / fair
  'lemonade stand closed', 'baked goods sold out',
  'craft fair done', 'farmers market done',
  'sold the last tomato', 'stall rent paid',
];
const closeTabJa = [
  'フリーマーケット終了', 'フリマを畳んで',
  'ガレージセール終了', '売り切りました',
  '売れ残りを寄付して', '売れ残りを回収して',
  '看板をしまって', 'テーブルを畳んでフリマ',
  'ブースを畳んでフリマ', '値下げをして売り切って',
  '値札を剥がして', '収支を締めて',
  'レジ箱を閉めて', '売上を数えて',
  '軒先を畳んで', '出店を終えて',
  '露店を畳んで', '朝市を畳んで',
  '青空市場終了', '骨董市終了',
  '手作り市終了', 'ワークショップ出店終了',
  '焼き菓子を売り切って', 'パンを売り切って',
  '野菜を売り切って',
];
const negate = [
  'still selling yard', 'まだフリマ中',
];
const nullPins = [
  'about to yard sale', 'mid sale', 'cash box',
  'price tags', 'for sale sign', 'lemonade stand',
  'フリマの途中', 'これからフリマ', '値札', 'レジ箱',
];
const establishedPins = [
  ['bake sale done', 'close-tab'],
  ['sale tomorrow yard', 'date'],
  ['フリマ終了', 'close-tab'], ['全部売れて', 'close-tab'],
  ['最後の客が帰って', 'close-tab'],
  ['朝市終了', 'close-tab'],
  ['明日フリマ', 'defer'],
];

describe('pass CCCLXVI: yard-sale & flea-market end idioms (fig)', () => {
  let vc;
  beforeEach(() => { vc = makeVC(); });

  test.each(closeTab)('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(closeTabJa)('"%s" -> close-tab (ja)', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(negate)('"%s" -> negate', (p) => {
    expect(key(vc, p)).toBe('negate');
  });
  test.each(nullPins)('"%s" -> null', (p) => {
    expect(key(vc, p)).toBeNull();
  });
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected);
  });
});
