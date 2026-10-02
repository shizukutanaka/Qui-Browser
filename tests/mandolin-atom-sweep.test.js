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
  // farm co-op & field-planting done (作付け・出荷・農協用事の終了側)
  'planting done', 'seeds in',
  'fields planted', 'crop shipped',
  'coop visited', 'dues paid',
  'tractor returned', 'rice planted',
];
const closeTabJa = [
  '作付け終了', '種をまいて',
  '出荷して', '組合費を払って',
  '田植え終了', '畑を耕して',
  '野菜を出荷して',
];
const negate = [
  'これから植える',
];
const nullPins = [
  'mid planting', 'farm coop',
  '農協', '畑',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['still planting', 'negate'],
  ['苗を植えて', 'close-tab'],
  ['まだ植え付け中', 'negate'],
  ['農協に行って', 'go-to'],
  // generic "about to plant" collides with borage (CDXIV)'s null pin — documented, not added
  ['about to plant', null],
];

describe('pass CDLXVI: farm co-op & planting idioms (mandolin)', () => {
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
