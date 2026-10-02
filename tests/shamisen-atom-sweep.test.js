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
  // daycare & after-school childcare application done (保育園申請の終了側)
  'daycare applied', 'enrollment secured',
  'waitlist confirmed', 'enrollment papers in',
  'care arranged', 'nursery spot secured',
  'club registered', 'placement made',
];
const closeTabJa = [
  '保育園に申し込んで', '入園手続き',
  '児童クラブ', '学童保育',
  '就労証明', '入園面接',
  '保活', '入園決定',
  '延長保育', '園庭開放',
];
const negate = [
  'still waiting',
];
const nullPins = [
  'mid application',
];
const establishedPins = [
  ['subsidy approved', 'close-tab'],
  ['まだ申請中', 'negate'],
  ['これから申し込む', 'negate'],
];

describe('pass CDLXXXII: daycare & childcare-application idioms (shamisen)', () => {
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
