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
  // hospital accredited & clinic permit granted
  'hospital accredited', 'clinic permit granted',
];
const closeTabJa = [
  '医師法', '医師免許',
  '医療法', '病院開設',
  '診療所', '病床数',
  '救急告示', '臨床研修病院',
  '専門医', '総合診療医',
  '医療安全管理者', '医療事故調査',
  '医療介護連携', '在宅医療',
  '訪問診療', '訪問看護ステーション',
  'オンライン診療', '電子カルテ',
  '医療費適正化', '協会けんぽ',
  '組合健保', '健保組合',
  '標準報酬', '一部負担金',
  '混合診療', '自由診療',
  '保険外併用療養費', '先進医療',
  '高度医療', '緩和ケア',
  '終末期医療', '延命治療',
];
const negate = [
  'still awaiting the hospital accreditation',
  'まだ開院前', 'これから開院',
  'まだ指定前',
];
const nullPins = [
  'about to open the clinic',
  'about to join the medical network',
];
const establishedPins = [
  ['これから届出', 'negate'],
];

describe('pass DCLVII: medical & hospital administration idioms (wagnertuba)', () => {
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
