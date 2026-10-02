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
  // packing & booking prep
  'boxes packed', 'packed the boxes',
  'all packed', 'boxes taped',
  'boxes labeled', 'movers booked',
  'elevator booked', 'utilities scheduled',
  'gas shutoff booked', 'water transfer done',
  'mover confirmed', 'boxes counted',
  'stuff decluttered', 'threw out the junk',
];
const closeTabJa = [
  '荷造り終了', '箱詰め終了',
  '梱包終了', '段ボールに詰めて',
  '業者を予約して', 'エレベーターを予約して',
  'ガス停止を予約して', '水道を止めて',
  '不用品を捨てて', '荷物を数えて',
];
const negate = [
  'still boxing things up',
  'まだ荷造り中', 'まだ梱包中',
];
const nullPins = [
  'still packing', // jasper: mid-move in-progress pin wins
  'about to pack', 'mid packing',
  'cardboard boxes', 'packing tape',
  'これから梱包', '荷造りの途中',
  'ガムテープ', '緩衝材',
];
const establishedPins = [
  ['荷物をまとめて', 'close-tab'],
  ['粗大ゴミを出して', 'close-tab'],
  ['断捨離終了', 'close-tab'],
];

describe('pass CD: packing & move-prep done idioms (wort)', () => {
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
