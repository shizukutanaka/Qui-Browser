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
  // tax payment method executed (納税手段の終了側)
  'direct debit set', 'card payment made',
  'qr payment done', 'installments arranged',
  'tax paid in full', 'payment slip settled',
  'bank transfer done', 'payment deadline met',
];
const closeTabJa = [
  '振替納税', 'クレジットカードで納付',
  'qrコードで納付', '分割納付',
  '納付書で払って', '口座振替',
  'コンビニ納付', 'スマホ決済で納付',
  '延納',
];
const negate = [
  'still paying',
];
const nullPins = [
  'mid payment',
];
const establishedPins = [
  ['tax paid', 'close-tab'],
  ['税金を払って', 'close-tab'],
  ['about to pay', 'negate'],
  ['まだ納付中', 'negate'],
  ['これから納付', null],
];

describe('pass CDLXXXI: tax payment-method idioms (mridangam)', () => {
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
