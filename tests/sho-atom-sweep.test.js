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
  // adult-guardianship & conservatorship filing done (成年後見申立の終了側)
  'guardianship filed', 'conservator appointed',
  'family court petition', 'power of attorney signed',
  'estate managed', 'court order issued',
  'legal capacity assessed', 'guardian named',
  'voluntary guardianship',
];
const closeTabJa = [
  '成年後見', '後見人',
  '家庭裁判所', '任意後見',
  '保佐', '補助',
  '鑑定書', '財産目録',
  '親権',
];
const negate = [
  'still petitioning', 'about to petition',
  'まだ申立中', 'これから申立',
];
const nullPins = [
  'mid hearing',
];
const establishedPins = [
  ['裁判所に行って', 'go-to'],
];

describe('pass CDLXXXVI: guardianship & conservatorship idioms (sho)', () => {
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
