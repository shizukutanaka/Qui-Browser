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
  // property-tax assessment done & valuation notice issued
  'property-tax assessment done', 'valuation notice issued',
];
const closeTabJa = [
  '固定資産税', '都市計画税',
  '固定資産評価', '評価替え',
  '縦覧帳簿', '固定資産評価審査委員会',
  '課税標準', '課税明細書',
  '納税通知書', '種別割',
  '保有割', '非課税',
  '住宅用地特例', '新築住宅減額',
  '耐震改修減額', 'バリアフリー改修減額',
  '省エネ改修減額', '未登記家屋',
  '家屋滅失届出', '償却資産',
  '償却資産申告', '土地課税台帳',
  '家屋課税台帳', '地目変換',
];
const negate = [
  'still awaiting the assessment',
  'これから縦覧', 'まだ申告前',
];
const nullPins = [
  'about to file the assessment appeal',
  'about to claim the tax exemption',
];
const establishedPins = [
  ['評価額', 'close-tab'], ['軽自動車税', 'close-tab'],
  ['環境性能割', 'close-tab'], ['まだ評価前', 'negate'],
];

describe('pass DCXVII: property-tax & assessment administration (kulintang)', () => {
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
  test.each(establishedPins)('pinned "%s" stays "%s"', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
