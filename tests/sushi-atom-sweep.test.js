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
  'store license issued', 'market inspection done',
];
const closeTabJa = [
  // 小売・流通業種
  '小売業', '小売店',
  '卸売業', '百貨店',
  'スーパーマーケット', 'コンビニエンスストア',
  '量販店', '無人店舗',
  '自動販売機', '小売業者',
  // 卸売市場
  '卸売市場', '中央卸売市場',
  '青果市場', '食肉卸売市場',
  '生鮮卸売', '青果物取引',
  '卸売市場法', '市場調整基金',
  '市場開設', '生鮮市場',
  '市場流通', '仲卸',
  '仲買人', '直売所',
  'ファーマーズマーケット',
  // 物価・統計
  '物価調査', '消費者物価指数',
  '商業統計',
  // 商業施設・法制
  '商業施設', 'ショッピングセンター',
  '百貨店協会', '商店街',
  '商店街振興組合', '中小小売商業振興法',
  '大規模小売店舗法', '大店法',
  '出店調整',
  // 流通近代化
  '流通改善', '流通近代化',
  '流通業務',
];
const negate = [
  'still awaiting the market review',
  'まだ開店前', 'まだ商売中',
  'まだ入荷前',
];
const nullPins = [
  'about to file the retail report',
  'about to visit the wholesale market',
];
const establishedPins = [
  ['消費者物価', 'close-tab'],
  ['消費者委員会', 'close-tab'],
  ['商店会', 'close-tab'],
  ['生鮮食品', 'close-tab'],
  ['これから出店', 'negate'],
  ['まだ開催前', 'negate'],
];

describe('pass DCLXXXVIII: distribution & retail-market administration (sushi)', () => {
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
