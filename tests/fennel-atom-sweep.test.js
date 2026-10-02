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
  // year-end prep & new-year setup
  'new year cards sent', 'nengajo mailed',
  'osechi ordered', 'kagami mochi set',
  'shimenawa hung', 'year end cleaning done',
  'bath cleaned', 'kotatsu out',
  'new year prep done',
];
const closeTabJa = [
  '年賀状を出して', '年賀状を書いて',
  'おせちを予約して', '鏡餅を飾って',
  'しめ縄を飾って', '大掃除を終えて',
  'こたつを出して', '年末準備を終えて',
];
const negate = [
  'still cleaning the house', 'still writing cards',
  'まだ大掃除中', 'まだ年賀状書き中',
];
const nullPins = [
  'about to do the cleaning', 'mid card writing',
  'card list', 'osechi menu',
  'これから大掃除', '掃除の途中',
  '年賀状リスト', 'おせちメニュー',
];
const establishedPins = [
  ['futon aired', 'close-tab'],
  ['風呂を掃除して', 'close-tab'],
  ['布団を干して', 'close-tab'],
];

describe('pass CDXVIII: year-end prep & new-year setup idioms (fennel)', () => {
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
