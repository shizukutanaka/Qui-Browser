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
  // special-nursing-home (tokuyou) application procedures done
  'eligibility interview done', 'assessment visit done',
  'waiting list joined', 'documents mailed',
  'priority ranked',
];
const closeTabJa = [
  '特養申込', '入所申込書',
  '判定会議', '順位待ち',
  '申込書提出', '訪問調査',
  '介護認定調査', '短期入所',
  'ショートステイ',
];
const negate = [
  'これから申込',
];
const nullPins = [
  'application pending', 'mid screening',
  '入所待ち', '判定待ち',
];
const establishedPins = [
  ['about to apply', null],
  ['application submitted', 'close-tab'],
  ['still applying', 'negate'],
  ['まだ申込中', 'negate'],
];

describe('pass DIV: special-nursing-home application idioms (binekan)', () => {
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
