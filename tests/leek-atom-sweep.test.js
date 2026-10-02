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
  // mail-order delivery & receipt
  'package received', 'delivery signed for',
  'redelivery scheduled', 'amazon box opened',
  'order unboxed', 'review left',
  'packaging thrown out', 'returns sent',
];
const closeTabJa = [
  '宅配を受け取って', '再配達を頼んで',
  'コンビニで受け取って', '開封して',
  'レビューを書いて', '梱包材を捨てて',
  '返品を出して', '不在票を見て',
];
const negate = [
  'still tracking the package', 'still waiting for the parcel',
  'まだ荷物待ち', 'まだ追跡中',
];
const nullPins = [
  'about to pick it up', 'mid unboxing',
  'tracking number', 'delivery notice',
  'これから受け取り', '開封の途中',
  '追跡番号', '不在票',
];
const establishedPins = [
  ['package picked up', 'close-tab'],
  ['parcel collected', 'close-tab'],
  ['荷物を受け取って', 'close-tab'],
  ['段ボールを開けて', 'go-to'],
];

describe('pass CDXXII: mail-order delivery & receipt idioms (leek)', () => {
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
