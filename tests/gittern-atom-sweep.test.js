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
  // water service started & meter inspected
  'water service started', 'water meter inspected',
];
const closeTabJa = [
  '水道事業', '給水装置',
  '水道料金', '上水道',
  '水道局', '給水工事',
  'メーター検針', '漏水修理',
  '水道使用開始', '水道使用中止',
  '水質検査', '浄水場',
  '配水管', '汚水処理',
  '受益者負担金', '下水道工事',
  '下水排除', '排水設備工事',
];
const negate = [
  'still before the hookup',
  'まだ開栓前', 'これから給水申請',
];
const nullPins = [
  'about to shut off the water', 'about to start the water service',
];
const establishedPins = [
  ['meter read', 'close-tab'],
  ['下水道使用料', 'close-tab'],
  ['下水道接続', 'close-tab'],
];

describe('pass DXCVI: water & sewer utility idioms (gittern)', () => {
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
