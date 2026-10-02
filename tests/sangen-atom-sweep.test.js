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
  // car-insurance grade-transfer / switch procedures done
  'insurance grade transferred', 'no-claims bonus kept',
  'new policy issued', 'coverage confirmed',
];
const closeTabJa = [
  '等級継承', '無事故割引',
  '新規契約', '保険切替',
  '書類提出',
  '補償内容', '車両保険',
  '任意保険', '自賠責保険',
];
const negate = [
  'still switching insurers', 'about to switch insurers',
  'まだ切替中', 'これから切替',
];
const nullPins = [
  'renewal pending', 'mid contract',
  '審査中',
];
const establishedPins = [
  ['保険証券', null],
  ['契約更新', null],
  ['documents submitted', 'close-tab'],
  ['policy renewed', 'close-tab'],
];

describe('pass DII: car-insurance grade-transfer idioms (sangen)', () => {
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
