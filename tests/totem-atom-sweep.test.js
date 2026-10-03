const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

const makeVC = () => {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({ getActiveTab: () => ({ id: 1 }), closeTab: () => {}, tabs: () => [] });
  return vc;
};
const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

const closeTab = [
  'block renovation funded', 'estate upgrade approved',
];
const closeTabJa = [
  '住生活基本法', '住生活基本計画',
  '住宅ストック', '住宅性能',
  '良質な住宅',
  '長期固定金利', '住宅ローン証券化',
  '住宅融資', '住宅ローン',
  '公団',
  '住宅公団', '都市再生機構',
  '都市住宅供給公社',
  '団地', '団地再生',
  '集住', '新住宅市街地開発事業',
  '住替団地',
  '都営住宅', '改良住宅',
  '高齢者向け住宅', 'シニア住宅',
  '介護住宅',
  '特定優良賃貸住宅', '賃貸住宅',
  '公団住宅', '賃貸借',
  '借上げ型住宅',
  '指定居住支援法人', '住宅支援',
  'まちづくり交付金', '都市再生緊急整備協議会',
  '重点再開発地区', '特定建築物規制区域',
  '住居表示',
  'マンション管理', '管理組合運営',
  '長期修繕計画', '修繕計画',
  '管理規約',
  '区分所有', '区分所有建物',
  'マンション標準管理規約', '円滑化法',
  '給排水設備',
  '共用部', '専有部',
  '建替え', '耐震建替',
  '建替決議',
  '緊急輸送路沿道', '沿道建築物',
  'ブロック塀', '宅地防災',
];
const negate = [
  'still awaiting the housing grant',
  'still awaiting the tenancy review',
  'まだ入居前', 'まだ建替前',
  'これから改修', 'まだ改築前',
];
const nullPins = [
  'about to visit the housing agency',
  'about to file the renovation notice',
];
const establishedPins = [
  ['住宅金融支援機構', 'close-tab'],
  ['公社住宅', 'close-tab'],
  ['公営住宅', 'close-tab'],
  ['県営住宅', 'close-tab'],
  ['市営住宅', 'close-tab'],
  ['高齢者住宅', 'close-tab'],
  ['サービス付き高齢者向け住宅', 'close-tab'],
  ['サ高住', 'close-tab'],
  ['住宅確保要配慮者', 'close-tab'],
  ['住宅セーフティネット', 'close-tab'],
  ['住基ネット', 'close-tab'],
  ['まだ契約前', 'negate'],
];

describe('pass DCC: housing & residential-life administration (totem)', () => {
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
