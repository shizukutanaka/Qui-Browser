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
  // social-insurance card & pension-book procedures done (保険証・社会保険手続きの終了側)
  'insurance card returned', 'enrollment done',
  'dependent added', 'health insurance switched',
  'company withdrew',
];
const closeTabJa = [
  '保険証を返して', '資格喪失届',
  '扶養に入って', '被扶養者',
  '任意継続', '国保に入って',
  '資格取得届',
];
const negate = [
  'still enrolled', 'about to enroll',
  'まだ加入中', 'これから加入',
];
const nullPins = [
  'mid coverage', 'pension office',
  'social insurance', '社会保険料',
  '厚生年金',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['coverage started', 'close-tab'],
  ['年金手帳をもらって', 'close-tab'],
];

describe('pass CDLXXVI: social-insurance card & pension-book idioms (viol)', () => {
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
