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
  // ids & licenses
  'passport applied', 'passport arrived',
  'voter registration done', 'id card issued',
  'mynumber card done', 'name change done',
  'family register updated', 'seal registered',
  // filings & fees
  'documents submitted', 'tax form filed',
  'fee paid city hall', 'stamp bought',
  'official seal stamped',
];
const closeTabJa = [
  'パスポートを申請して', 'パスポートが届いて',
  '車検証を更新して', '住民登録終了',
  'マイナンバーカードを受け取って', '改姓手続き終了',
  '印鑑登録終了', '証明書を発行して',
  '手数料を払って', '収入印紙を貼って',
  '実印を押して',
];
const negate = [
  'still at the city hall', 'still in the office',
  'まだ役所にいる', 'まだ窓口にいる',
];
const nullPins = [
  'about to file papers', 'mid application',
  'application form', 'receipt number',
  'これから手続き', '申請の途中',
  '申請書', '受付番号',
];
const establishedPins = [
  ['license renewed', 'close-tab'], ['registration renewed', 'close-tab'],
  ['免許更新終了', 'close-tab'], ['免許を更新して', 'close-tab'],
  ['戸籍を取って', 'close-tab'], ['書類を提出して', 'close-tab'],
  ['certificate issued', 'security-status'],
];

describe('pass CCCLXXXIX: city-hall & license paperwork end idioms (yarrow)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected);
  });
});
