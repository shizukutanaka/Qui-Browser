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
  // year-end adjustment & deduction forms submitted (年末調整書類の終了側)
  'adjustment submitted', 'withholding done',
  'deduction forms in', 'dependent declared',
  'insurance deduction claimed', 'payroll closed',
  'spouse declared', 'tax slip arrived',
];
const closeTabJa = [
  '年末調整', '扶養控除',
  '保険料控除', '配偶者控除',
  '源泉徴収票が来て', '基礎控除',
  '控除証明書',
];
const negate = [
  'still filling',
  'これから提出',
];
const nullPins = [
  'mid review', '給与天引き',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['refund issued', 'close-tab'],
  ['還付金が振り込まれて', 'close-tab'],
  ['書類を出して', 'close-tab'],
  ['まだ記入中', 'negate'],
  ['about to file', null],
];

describe('pass CDLXXVIII: year-end adjustment & deduction idioms (tabla)', () => {
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
