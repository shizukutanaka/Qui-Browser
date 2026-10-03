const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

const makeVC = () => {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({ getActiveTab: () => ({ id: 1 }), closeTab: () => {}, tabs: () => [] });
  return vc;
};
const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

const closeTab = [
  'policy underwritten', 'annuity started',
];
const closeTabJa = [
  '保険業', '保険会社',
  '生命保険', '第三分野保険',
  '保険募集', '保険募集人',
  '保険代理店', '保険仲立人',
  '保険計理人',
  '責任準備金', '支払備金',
  'ソルベンシーマージン',
  '保険契約', '保険金',
  '保険料', '告知義務',
  '保険約款',
  '保険証券', '利率変動型保険',
  '変額保険',
  '外貨建保険', '個人年金保険',
  '定期保険',
  '養老保険', '収入保障保険',
  '医療保険',
  'がん保険', '介護保険商品',
  '火災保険',
  '自動車保険', '賠償責任保険',
  '海上保険',
  '信用保険', '少額短期保険',
  '共済',
  '都道府県民共済', '全労済',
  'ja共済',
  '生命保険協会', '損害保険協会',
  '保険オンブズマン',
  '保険毎日新聞', '証券投資信託',
  '投資信託',
  '投資信託協会', '投信',
  '投資家保護基金',
  '兼営法', '信託会社',
  '信託財産', '受益証券',
];
const negate = [
  'still awaiting the policy ruling',
  'still awaiting the claim review',
  'まだ保険前', 'まだ告知前',
  'まだ支払中', 'まだ給付前',
];
const nullPins = [
  'about to visit the insurance bureau',
  'about to file the claim form',
];
const establishedPins = [
  ['claim settled', 'close-tab'],
  ['保険業法', 'close-tab'],
  ['損害保険', 'close-tab'],
  ['保険料率', 'close-tab'],
  ['終身保険', 'close-tab'],
  ['自賠責保険', 'close-tab'],
  ['傷害保険', 'close-tab'],
  ['信託業法', 'close-tab'],
  ['まだ契約前', 'negate'],
  ['これから加入', 'negate'],
];

describe('pass DCCIV: insurance business & trusts (haystack)', () => {
  let vc;
  beforeEach(() => { vc = makeVC(); });

  test.each(closeTab.map(p => [p]))('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(closeTabJa.map(p => [p]))('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(negate.map(p => [p]))('"%s" -> negate', (p) => {
    expect(key(vc, p)).toBe('negate');
  });
  test.each(nullPins.map(p => [p]))('"%s" -> null', (p) => {
    expect(key(vc, p)).toBeNull();
  });
  test.each(establishedPins.map(([p, k2]) => [p, k2]))('"%s" stays %s', (p, k2) => {
    expect(key(vc, p)).toBe(k2);
  });
});
