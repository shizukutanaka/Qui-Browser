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
  // medical-expense deduction & high-cost care procedures done
  'medical deduction filed', 'receipts totaled',
  'self-medication tax claimed', 'hospital receipts sorted',
];
const closeTabJa = [
  'セルフメディケーション', '領収書集計',
  '病院領収書', '通院費',
  '医療費明細書', '還付申請',
  '交通費領収書', '薬代',
  '入院費', '出産育児一時金',
  '高額療養費',
];
const negate = [
  'still totaling receipts', 'about to file the deduction',
  'まだ集計中', 'これから控除',
];
const nullPins = [
  'mid filing', 'deduction pending',
  '控除申請中',
];
const establishedPins = [
  ['医療費控除', 'close-tab'],
];

describe('pass DV: medical-expense deduction & high-cost care idioms (hayashi)', () => {
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
