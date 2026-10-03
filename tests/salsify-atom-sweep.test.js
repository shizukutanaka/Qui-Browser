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
  // park plan approved & facility merger announced
  'park plan approved', 'facility merger announced',
];
const closeTabJa = [
  '都市公園', '公園緑地',
  '運動公園', '児童公園',
  '近隣公園', '地区公園',
  '街区公園', '総合公園',
  '都市緑地', '緑地保全',
  '都市緑化', '緑化運動',
  '屋上緑化', '街路樹',
  '公共施設マネジメント', '公共施設再編',
  '施設統合', '施設廃止',
  '指定管理者', '指定管理者制度',
  '公共施設白書', '施設利用料',
  '使用料', '利用料金',
  '公の施設', '公物管理',
  '公共施設有効活用', '遊休施設',
  '未利用施設', '施設カルテ',
  '公共施設カルテ', '包括的公共施設',
  '施設整備計画', '施設保全',
  '防災拠点', '防災公園',
  '避難広場', '緑地ネットワーク',
];
const negate = [
  'これから利用登録',
  'まだ再編前',
];
const nullPins = [
  'about to file the facility merger',
  'about to join the park committee',
];
const establishedPins = [
  ['still awaiting the park designation', 'negate'],
  ['生産緑地', 'close-tab'],
  ['まだ指定前', 'negate'],
];

describe('pass DCLXVII: urban-park & public-facility administration (salsify)', () => {
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
