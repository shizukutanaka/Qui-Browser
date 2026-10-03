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
  // recall completed & inspection cleared
  'recall completed', 'inspection cleared',
];
const closeTabJa = [
  // 表示・制度
  '食品表示', '食育',
  '食育基本法', '健康食品',
  '機能性表示食品', '特定保健用食品',
  'トクホ', '栄養成分表示',
  // 添加物・安全
  '食品添加物', '残留農薬',
  '食品検査', '輸入食品検査',
  '食中毒', '食品衛生監視員',
  'haccp', '一般衛生管理',
  '食品偽装', 'bse',
  // 品種・期限
  '品種登録', '賞味期限',
  '消費期限', '保存方法',
  // リコール・ロス
  '食品リコール', '食品等自主回収',
  '自主回収', 'フードロス',
  '食品ロス削減',
  // 食品分類・事業
  '冷凍食品', '生鮮食品',
  '加工食品', '食品営業届出',
  '食品産業', '食品事業者',
  'みどりの食料システム戦略',
];
const negate = [
  'still awaiting the recall notice',
  'まだ営業前', 'まだ回収中',
];
const nullPins = [
  'about to file the recall notice',
  'about to visit the food center',
];
const establishedPins = [
  ['食品衛生法', 'close-tab'],
  ['アレルギー表示', 'close-tab'],
  ['still awaiting the food license', 'negate'],
  ['これから開業', 'negate'],
  ['まだ届出前', 'negate'],
  ['まだ回収前', 'negate'],
];

describe('pass DCLXXVII: food-safety administration (shiba)', () => {
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
  test.each(establishedPins)('established pin "%s" stays %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected ?? null);
  });
});
