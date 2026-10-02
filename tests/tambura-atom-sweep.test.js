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
  // city health-screening paperwork done
  'screening voucher received', 'health checkup done',
];
const closeTabJa = [
  '検診票', '健康診査',
  '集団検診', 'がん検診',
  '特定健診', '後期高齢者健診',
  '胃がん検診', '大腸がん検診',
  '肺がん検診', '乳がん検診',
  '子宮がん検診', '骨粗鬆症検診',
  '肝炎ウイルス検診', '結核健診',
  '歯周病検診', '問診票',
  '受診券',
];
const negate = [
  'still waiting for results',
  'まだ受診前', 'これから検診',
];
const nullPins = [
  'about to get screened', 'about to schedule',
];
const establishedPins = [
  ['about to visit', 'negate'],
];

describe('pass DLVII: city health-screening idioms (tambura)', () => {
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
