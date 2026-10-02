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
  // car purchase & delivery
  'car bought', 'car delivered',
  'took delivery', 'car insurance set',
  'plates arrived', 'first drive done',
  'broke it in', 'dealer paperwork done',
];
const closeTabJa = [
  '納車された', '納車を受けて',
  '車両保険に入って', 'ナンバーが届いて',
  '初ドライブをして', '慣らし運転をして',
  'ディーラーと話して',
];
const negate = [
  'still car shopping',
  'まだ車選び中',
];
const nullPins = [
  'about to buy a car', 'mid paperwork',
  'car contract', 'insurance quote',
  'これから車を買う', '手続きの途中',
  '車の契約書', '見積書',
];
const establishedPins = [
  ['still waiting for delivery', 'negate'],
  ['まだ納車待ち', 'negate'],
  ['車を買って', 'close-tab'],
  ['契約を結んで', 'close-tab'],
  ['登録を済ませて', 'close-tab'],
];

describe('pass CDXIX: car purchase & delivery idioms (gourd)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected);
  });
});
