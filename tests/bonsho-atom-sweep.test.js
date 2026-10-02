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
  // health-insurance leave benefit procedures done
  'sick pay granted', 'injury allowance filed',
  'leave benefit extended', 'benefit terminated',
];
const closeTabJa = [
  '傷病手当金', '傷病手当',
  '育児手当', '給与明細差引',
  '標準報酬月額', '休業給付',
  '被保険者証', '療養費',
  '医療給付', '法定給付',
  '付加給付', '自費診療',
  '傷病年金',
];
const negate = [
  'still on sick leave', 'about to apply for the allowance',
  'まだ療養中', 'これから手当申請',
];
const nullPins = [
  'mid treatment',
];
const establishedPins = [
  ['出産手当金', 'close-tab'],
];

describe('pass DXVIII: health-insurance leave benefit idioms (bonsho)', () => {
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
