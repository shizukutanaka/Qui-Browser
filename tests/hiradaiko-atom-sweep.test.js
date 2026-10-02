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
  // ETC card & vehicle-tax/registration procedures done
  'etc card issued', 'vehicle tax paid',
  'weight tax settled',
];
const closeTabJa = [
  'etcカード', 'etc車載器',
  '車載器取付', '利用照会',
  '通行料金', '自動車税',
  '軽自動車税', '自賠責保険料',
  '環境性能割',
  '取得税', '納税証明書',
  '車検証', '使用者変更',
  '名義変更届', '抹消登録',
  '一時抹消', '廃車手続き',
  '陸運局', '自動車登録',
  'ナンバー交付', '封印取付',
  '検査標章', '車検予約',
];
const negate = [
  'still waiting for the card', 'about to register the car',
  'これから車検',
];
const nullPins = [
  'mid inspection booking',
];
const establishedPins = [
  ['toll paid', 'close-tab'],
  ['まだ申請中', 'negate'],
  ['重量税', null],
];

describe('pass DXXXI: ETC card & vehicle-tax procedures (hiradaiko)', () => {
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
