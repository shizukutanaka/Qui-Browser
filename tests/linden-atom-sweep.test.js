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
  // lease signing & key handover
  'signed the lease',
  'keys picked up',
  'got the keys', 'move in date set',
  'final walkthrough scheduled', 'deposit paid',
  'first months rent paid', 'renters insurance done',
  'contract sealed', 'landlord met',
];
const closeTabJa = [
  '契約を結んで', '鍵を受け取って',
  '入居日が決まって', '敷金を払って',
  '初月家賃を払って', '火災保険に入って',
  '契約が済んで', '大家に会って',
];
const negate = [
  'still signing paperwork', 'still at the signing',
  'まだ契約手続き中',
];
const nullPins = [
  'lease signed', 'contract signed', // epidote: active-contract pins win
  'about to sign the lease', 'mid signing',
  'lease agreement', 'rental agreement',
  'これから契約', '契約の途中',
  '賃貸借契約', '入居契約',
];
const establishedPins = [
  ['契約書にサインして', 'close-tab'],
  ['賃貸契約終了', 'close-tab'],
  ['最終確認をして', 'close-tab'],
  ['まだ契約中', 'negate'],
];

describe('pass CDIII: lease-signing & key handover idioms (linden)', () => {
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
