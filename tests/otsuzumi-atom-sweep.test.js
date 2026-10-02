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
  // social-welfare fund loan procedures done
  'welfare loan approved', 'small loan disbursed',
  'repayment set', 'funds deposited',
  'loan matured',
];
const closeTabJa = [
  '生活福祉資金', '小口資金',
  '一時生活再建費', '福祉資金貸付',
  '償還計画', '連帯保証人',
  '貸付決定', '借受申込',
  '自立支援資金', '社協窓口',
  '送金受領', '据置期間',
  '返済据置', '貸付終了',
];
const negate = [
  'still awaiting disbursement', 'about to request the loan',
  'まだ貸付審査中', 'これから貸付申請',
];
const nullPins = [
  'mid contract',
];
const establishedPins = [];

describe('pass DXV: social-welfare fund loan idioms (otsuzumi)', () => {
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
});
