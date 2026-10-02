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
  // national-health-insurance switch & social-insurance enrollment done
  'nhi enrolled',
  'premium notice arrived',
];
const closeTabJa = [
  '国保切替', '国民健康保険',
  '社会保険加入', '被扶養者届',
  '保険料通知', '任意継続手続き',
  '退職後保険', '健康保険料',
  '介護保険料', '後期高齢者',
];
const negate = [
  'still switching insurance', 'about to switch coverage',
];
const nullPins = [
  'mid enrollment', 'enrollment pending',
  '加入手続き中',
];
const establishedPins = [
  ['insurance switched', 'close-tab'],
  ['coverage started', 'close-tab'],
  ['資格取得届', 'close-tab'],
  ['資格喪失届', 'close-tab'],
  ['まだ切替中', 'negate'],
  ['これから加入', 'negate'],
];

describe('pass DVII: national-health-insurance switch & enrollment idioms (fue)', () => {
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
