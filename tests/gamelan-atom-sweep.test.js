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
  // care-insurance premium billing/refund procedures done
  'premium refunded', 'collection suspended',
  'installment arranged', 'back premiums settled',
];
const closeTabJa = [
  '徴収猶予', '延滞金',
  '督促', '催告状',
  '特別徴収', '普通徴収',
  '年金天引き', '納期限',
  '財産差押',
  '災害免除', '所得段階',
  '保険料率', '基準額',
  '過誤納金', '第2号被保険者',
];
const negate = [
  'still paying premiums', 'about to request the refund',
  'これから保険料納付',
];
const nullPins = [
  'mid billing cycle',
];
const establishedPins = [
  ['介護保険料', 'close-tab'],
  ['還付手続き', 'close-tab'],
  ['口座振替', 'close-tab'],
  ['滞納処分', 'close-tab'],
  ['分割納付', 'close-tab'],
  ['まだ納付中', 'negate'],
  ['納付書', null],
];

describe('pass DXXXIII: care-insurance premium billing idioms (gamelan)', () => {
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
