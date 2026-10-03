const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

const makeVC = () => {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({ getActiveTab: () => ({ id: 1 }), closeTab: () => {}, tabs: () => [] });
  return vc;
};
const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

const closeTab = [
  'warehouse licensed', 'cargo terminal opened',
  'depot certified',
];
const closeTabJa = [
  '倉庫業法', '倉庫業',
  '倉庫', '倉庫営業',
  '倉庫会社',
  '倉庫証券', '寄託',
  '寄託物',
  '保管物', '荷物保管',
  '倉荷証券',
  '倉庫寄託', '貨物保管',
  '保管料',
  '倉敷料', '梱包業',
  '荷役業',
  '港湾荷役', '運送取次',
  '通運事業',
  '通運業者', 'フォワーダー',
  'ロジスティクス',
  '集配センター', '流通センター',
  '配送センター',
  'コンテナヤード', 'コンテナターミナル',
  '自動倉庫',
  '在庫管理', 'wms',
  '倉庫管理システム',
  '荷さばき所', '保管能力',
  '入出庫',
  '棚卸', '棚卸資産',
  '在庫',
  '流通加工', '検品',
  '仕分け',
  '梱包', 'ピッキング',
  'フォークリフト',
  '荷揚げ', '港湾荷役業',
  '荷主',
  '発送業務', '配送業務',
  '物流業務',
];
const negate = [
  'still awaiting the warehouse permit',
  'still awaiting the cargo inspection',
  'まだ入庫前', 'まだ出庫前',
  'これから納入',
];
const nullPins = [
  'about to visit the warehouse office',
  'about to file the cargo manifest',
];
const establishedPins = [
  ['物流センター', 'close-tab'],
  ['物流拠点', 'close-tab'],
  ['まだ梱包中', 'negate'],
];

describe('pass DCCVI: warehousing & cargo-handling industry (silo)', () => {
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
