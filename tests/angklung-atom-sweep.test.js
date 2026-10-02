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
  // education endowment insurance (学資保険) procedures done
  'policy enrolled', 'premium paid',
  'maturity payout received', 'surrendered the policy',
];
const closeTabJa = [
  '学資保険', 'こども保険',
  '教育資金', '満期保険金',
  '祝い金', '払込終了',
  '保険料払込', '契約者貸付',
  '解約返戻金', '返戻率',
  '育英年金', '養育年金',
  '被保険者変更', '受取人変更',
  '告知書', '医師審査',
  '付加特約', '出生前加入',
  '終身保険',
];
const negate = [
  'まだ保険料払込中',
];
const nullPins = [
  'mid underwriting',
];
const establishedPins = [
  ['still comparing plans', 'negate'],
  ['about to enroll', 'negate'],
  ['保険料免除', 'close-tab'],
  ['これから加入', 'negate'],
  ['出産予定日', null],
];

describe('pass DXXXII: education endowment insurance idioms (angklung)', () => {
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
