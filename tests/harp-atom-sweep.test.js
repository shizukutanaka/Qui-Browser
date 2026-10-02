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
  // car-detailing & tire-swap done (洗車・タイヤ交換の終了側)
  'tires swapped', 'winter tires on',
  'summers on', 'seat covers on',
  'trunk emptied',
];
const closeTabJa = [
  'タイヤを交換して', 'スタッドレスに変えて',
  'シートカバーを付けて', 'トランクを整理して',
  '車検を終えて',
];
const negate = [
  'still washing the car', 'about to swap tires',
  'まだ洗車中', 'これからタイヤを換える',
];
const nullPins = [
  'mid cleaning', 'car detailing', 'tire season',
  'タイヤ交換中', '洗車中', '車の清掃',
];
const establishedPins = [
  // existing pins that already cover this domain — kept, not duplicated
  ['car washed', 'close-tab'],
  ['interior vacuumed', 'close-tab'],
  ['車を洗って', 'close-tab'],
  ['車内を掃除して', 'close-tab'],
  ['ワックスをかけて', 'close-tab'],
  ['窓を拭いて', 'close-tab'],
];

describe('pass CDLXI: car-detailing & tire-swap idioms (harp)', () => {
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
