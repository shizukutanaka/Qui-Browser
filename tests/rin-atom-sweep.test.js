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
  // kindergarten enrollment procedures done
  'kindergarten applied', 'entrance fee paid',
  'uniform measured', 'interview passed',
  'admission letter received',
];
const closeTabJa = [
  '幼稚園入園', '入園願書',
  '入園料', '願書提出',
  '制服採寸', '年少',
  '年中', '年長',
  '満3歳', 'プレ保育',
  '未就園児', '入園準備',
  '園バス', '保護者会',
  '入園式',
];
const negate = [
  'still touring schools', 'about to submit the application',
  'まだ園見学中', 'これから入園手続き',
];
const nullPins = [
  'mid enrollment',
];
const establishedPins = [
  ['入園決定', 'close-tab'],
];

describe('pass DXXIII: kindergarten enrollment idioms (rin)', () => {
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
