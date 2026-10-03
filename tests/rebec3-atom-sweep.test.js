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
  // export license issued & trade pact signed
  'export license issued', 'trade pact signed',
];
const closeTabJa = [
  '外為法', '外国為替及び外国貿易法',
  '輸出許可', '輸入承認',
  '輸出入管理', '安全保障貿易管理',
  '輸出管理リスト', '経済制裁',
  '貿易保険', '輸出保険',
  '輸出企業', '輸入企業',
  '知的財産権侵害物品', '国境措置',
  '輸入割当', '特恵原産地証明',
  '認定経済事業者', 'aeo事業者',
  '自由貿易地域', '総合保税地域',
  '日本貿易振興機構', 'jetro',
  '通商白書', '貿易赤字',
  '貿易黒字', '国際収支',
  '経常収支', 'サービス貿易',
  '貨物貿易', '自由貿易協定',
  '世界貿易機関', 'wto協定',
  '投資協定', '関税同盟',
  'スパゲッティボウル',
];
const negate = [
  'still awaiting the export license',
  'まだ輸出許可前', 'これから輸出届',
];
const nullPins = [
  'about to file the export declaration',
  'about to join the trade mission',
];
const establishedPins = [
  ['まだ通関前', 'negate'],
];

describe('pass DCLXI: international trade & commerce administration idioms (rebec3)', () => {
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
