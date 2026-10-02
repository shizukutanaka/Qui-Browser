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
  // neighborhood cleanup / recycling-duty done (地域清掃・回収当番の終了側)
  'cans sorted', 'cardboard bundled',
  'collection done', 'gomi station swept',
  'bulky trash scheduled', 'duty rota done',
  'street swept',
];
const closeTabJa = [
  '缶を分別して', '瓶を洗って',
  '段ボールを束ねて', '集会所を掃除して',
  '粗大ゴミを予約して', '回収当番を終えて',
  '町内清掃を終えて', 'ゴミ集積所を掃除して',
];
const negate = [
  'still on cleanup duty', 'about to sort',
  'まだ清掃当番中', 'これから分別する',
];
const nullPins = [
  'mid cleanup', 'recycling day', 'trash duty',
  '清掃当番中', 'ゴミ当番',
];
const establishedPins = [
  ['bottles rinsed', 'close-tab'],
  ['資源ゴミを出して', 'close-tab'],
  ['リサイクルに出して', 'close-tab'],
  ['資源ゴミ', 'close-tab'],
];

describe('pass CDLIV: cleanup & recycling-duty idioms (dace)', () => {
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
