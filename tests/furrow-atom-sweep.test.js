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
  'pesticide registered', 'seed variety registered',
];
const closeTabJa = [
  // 農薬法
  '農薬取締法', '農薬',
  '殺虫剤', '殺菌剤',
  '除草剤', '植物成長調整剤',
  '土壌消毒剤', '農薬登録',
  // 散布・管理
  '農薬散布', '空中散布',
  'ドローン散布', '農薬管理',
  // 肥料
  '肥料取締法', '肥料',
  '化学肥料', '有機肥料',
  '堆肥', '窒素肥料',
  '緩効性肥料', '配合肥料',
  // 飼料
  '飼料', '飼料安全法',
  '飼料製造', '飼料原料',
  '濃厚飼料', 'サイレージ',
  // 種苗
  '植物新品種保護法', '植物新品種',
  '種苗法', '種苗登録',
  '登録品種', '原種圃',
  '増殖圃', '品種改良',
  // 営農
  '作付計画', '転作',
  '輪作', '休耕地',
  '耕作放棄地',
  // 機械・出荷
  '農機具', 'トラクター',
  'コンバイン', '耕うん',
  '選果場',
  // 認証
  '有機農産物認証', '有機jas',
  '特別栽培農産物', '自然農法',
];
const negate = [
  'still awaiting the pesticide registration',
  'still awaiting the variety decision',
  'まだ散布前', 'まだ作付前',
  'これから散布',
];
const nullPins = [
  'about to visit the farm bureau',
  'about to apply for the pesticide permit',
];
const establishedPins = [
  ['残留農薬', 'close-tab'],
  ['毒物劇物', 'close-tab'],
  ['配合飼料', 'close-tab'],
  ['飼料添加物', 'close-tab'],
  ['粗飼料', 'close-tab'],
  ['飼料米', 'close-tab'],
  ['育成者権', 'close-tab'],
  ['担い手', 'close-tab'],
  ['農業経営', 'close-tab'],
  ['集落営農', 'close-tab'],
  ['出荷', 'close-tab'],
  ['まだ登録前', 'negate'],
  ['まだ収穫前', 'negate'],
];

describe('pass DCXCVI: agricultural chemicals & seed regulation (furrow)', () => {
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
