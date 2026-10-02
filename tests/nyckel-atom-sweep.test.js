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
  // boat license renewed & vessel inspection passed
  'boat license renewed', 'vessel inspection passed',
];
const closeTabJa = [
  '船舶検査証書', '海技免状',
  '小型船舶免許', 'ボート免許',
  '船舶検査', '船舶登録',
  'マリーナ', '桟橋',
  '係留', '水上安全',
  '救命胴衣', '船舶保険',
  '定期検査', '航行区域',
  '船長', '臨時検査',
];
const negate = [
  'still unlicensed for the boat',
  'まだ免許前', 'まだ検査前',
];
const nullPins = [
  'about to register the boat', 'about to take the boating exam',
];
const establishedPins = [
  ['中間検査', 'close-tab'],
];

describe('pass DLXXXII: vessel-inspection & boat-license idioms (nyckel)', () => {
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
  test.each(establishedPins)('"%s" keeps pin %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
