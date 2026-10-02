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
  // temp-housing departure & arrival day
  'temp housing over', 'left the rental',
  'moved into the new place', 'first night in the new place',
  'truck arrived', 'movers left',
  'leaving the hotel', 'checked out of the hotel',
  'lived in temporary housing', 'short stay over',
  'handed back the keys', 'returned the room key',
];
const closeTabJa = [
  '仮住まい終了', '仮住まいを出て',
  '賃貸を引き払って', '荷物が届いて',
  'トラックが来て', 'ホテル暮らし終了',
  '短期滞在終了', '仮住まいの鍵を返して',
];
const negate = [
  'still in temporary housing', 'still in the rental',
  'まだ仮住まい中', 'まだホテル暮らし',
];
const nullPins = [
  'about to move in', 'mid move',
  'hotel room', 'temp address',
  'これから入居', '引っ越しの途中',
  '仮住所', 'ホテルの部屋',
];
const establishedPins = [
  ['truck unloaded', 'close-tab'],
  ['truck returned', 'close-tab'],
  ['新居に入って', 'close-tab'],
  ['荷下ろし終了', 'close-tab'],
  ['業者が帰って', 'close-tab'],
  ['ホテルを出て', 'close-tab'],
];

describe('pass CDI: temp-housing & arrival-day idioms (yucca)', () => {
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
